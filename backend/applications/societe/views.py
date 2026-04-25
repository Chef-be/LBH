"""
Vues API — Module Pilotage Société
"""

import re
from decimal import Decimal
from html import unescape
from datetime import date, timedelta

import requests
from django.http import HttpResponse
from django.db.models import Sum, Count, Q
from django.shortcuts import get_object_or_404
from django.urls import reverse
from django.utils import timezone

from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from .models import ChargeFixeStructure, ParametreSociete, ProfilHoraire, ProfilHoraireUtilisateur, SimulationSalaire, DevisHonoraires, LigneDevis, Facture, LigneFacture, Paiement, TempsPasse
from .serializers import (
    ProfilHoraireSerializer,
    ProfilHoraireUtilisateurSerializer,
    ParametreSocieteSerializer,
    ChargeFixeStructureSerializer,
    SimulationSalaireSerializer,
    DevisHonorairesListeSerializer, DevisHonorairesDetailSerializer,
    LigneDevisSerializer,
    FactureListeSerializer, FactureDetailSerializer,
    LigneFactureSerializer,
    PaiementSerializer,
    TempsPasseSerializer,
)
from .services import (
    construire_contexte_projet_saisi,
    construire_suggestions_prestations,
    generer_jeton_validation,
    generer_pdf_devis,
    lister_missions_livrables,
    rendu_validation_html,
)
from applications.messagerie.services import MessagerieErreur, envoyer_courriel
from applications.projets.models import Projet
from applications.projets.serialiseurs import ProjetDetailSerialiseur


# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────

def _generer_reference_devis():
    """Génère une référence DVZ-YYYY-NNN auto-incrémentée."""
    annee = date.today().year
    prefix = f"DVZ-{annee}-"
    dernier = (
        DevisHonoraires.objects.filter(reference__startswith=prefix)
        .order_by("-reference")
        .values_list("reference", flat=True)
        .first()
    )
    if dernier:
        m = re.search(r"-(\d+)$", dernier)
        num = int(m.group(1)) + 1 if m else 1
    else:
        num = 1
    return f"{prefix}{num:03d}"


def _generer_reference_facture():
    """Génère une référence FAC-YYYY-NNN auto-incrémentée."""
    annee = date.today().year
    prefix = f"FAC-{annee}-"
    dernier = (
        Facture.objects.filter(reference__startswith=prefix)
        .order_by("-reference")
        .values_list("reference", flat=True)
        .first()
    )
    if dernier:
        m = re.search(r"-(\d+)$", dernier)
        num = int(m.group(1)) + 1 if m else 1
    else:
        num = 1
    return f"{prefix}{num:03d}"


def _type_projet_depuis_devis(devis: DevisHonoraires) -> str:
    if devis.famille_client == "maitrise_oeuvre":
        return "mission_moe"
    if devis.famille_client == "maitrise_ouvrage":
        return "assistance"
    return "etude"


def _initialiser_statuts_livrables(projet: Projet, missions_selectionnees: list[dict]) -> None:
    statuts = {}
    for mission in missions_selectionnees or []:
        for code in mission.get("livrablesCodes", []):
            if code:
                statuts.setdefault(code, "a_faire")

    if not statuts:
        return

    qualification = dict(projet.qualification_wizard or {})
    qualification["statuts_livrables"] = {
        **dict(qualification.get("statuts_livrables", {})),
        **statuts,
    }
    projet.qualification_wizard = qualification
    projet.save(update_fields=["qualification_wizard", "date_modification"])


def _normaliser_texte_suggestion(*valeurs):
    return " ".join(str(valeur or "") for valeur in valeurs).lower()


def _heures_defaut_par_role(role: str) -> Decimal:
    table = {
        "pilotage": Decimal("3.00"),
        "contribution": Decimal("4.00"),
        "redaction": Decimal("8.00"),
        "etude_prix": Decimal("12.00"),
        "verification": Decimal("4.00"),
        "planning": Decimal("6.00"),
        "opc": Decimal("6.00"),
    }
    return table.get(role or "", Decimal("7.00"))


def _devis_reference_pour_projet(projet: Projet):
    source_devis_id = dict(projet.qualification_wizard or {}).get("source_devis_id")
    if source_devis_id:
        devis = DevisHonoraires.objects.filter(pk=source_devis_id).prefetch_related("lignes").first()
        if devis:
            return devis
    return (
        DevisHonoraires.objects.filter(projet=projet, statut="accepte")
        .prefetch_related("lignes")
        .order_by("-date_acceptation", "-date_creation")
        .first()
    )


def _heures_suggerees_pour_affectation(devis, affectation) -> Decimal:
    if not devis:
        return _heures_defaut_par_role(affectation.role)

    lignes_horaires = devis.lignes.filter(type_ligne="horaire")
    if affectation.nature == "projet":
        total = sum((ligne.nb_heures or Decimal("0")) for ligne in lignes_horaires)
        return total or _heures_defaut_par_role(affectation.role)

    texte_cible = _normaliser_texte_suggestion(
        affectation.code_cible,
        affectation.libelle_cible,
        affectation.role,
        affectation.commentaires,
    )
    correspondances = []
    for ligne in lignes_horaires:
        texte_ligne = _normaliser_texte_suggestion(
            ligne.phase_code,
            ligne.intitule,
            ligne.description,
        )
        if not texte_cible:
            continue
        if affectation.code_cible and affectation.code_cible.lower() in texte_ligne:
            correspondances.append(ligne)
            continue
        if affectation.libelle_cible and affectation.libelle_cible.lower() in texte_ligne:
            correspondances.append(ligne)
            continue
        mots = [mot for mot in texte_cible.split() if len(mot) >= 4]
        if mots and any(mot in texte_ligne for mot in mots):
            correspondances.append(ligne)

    heures = sum((ligne.nb_heures or Decimal("0")) for ligne in correspondances)
    return heures or _heures_defaut_par_role(affectation.role)


# ─────────────────────────────────────────────
# Profils horaires
# ─────────────────────────────────────────────

class ProfilHoraireViewSet(viewsets.ModelViewSet):
    queryset = ProfilHoraire.objects.prefetch_related("simulations").all()
    serializer_class = ProfilHoraireSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.query_params.get("actif") == "true":
            qs = qs.filter(actif=True)
        return qs

    @action(detail=True, methods=["post"], url_path="appliquer-calcul")
    def appliquer_calcul(self, request, pk=None):
        """Active le pilotage par simulations et applique immédiatement la moyenne."""
        from .services import recalculer_taux_profil
        profil = self.get_object()
        profil.utiliser_calcul = True
        profil.save(update_fields=["utiliser_calcul"])
        recalculer_taux_profil(profil)
        profil.refresh_from_db()
        return Response(ProfilHoraireSerializer(profil).data)

    @action(detail=True, methods=["post"], url_path="desactiver-calcul")
    def desactiver_calcul(self, request, pk=None):
        """Repasse en mode manuel : taux_horaire_ht n'est plus mis à jour automatiquement."""
        profil = self.get_object()
        profil.utiliser_calcul = False
        profil.save(update_fields=["utiliser_calcul"])
        return Response(ProfilHoraireSerializer(profil).data)


class SimulationSalaireViewSet(viewsets.ModelViewSet):
    serializer_class = SimulationSalaireSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = SimulationSalaire.objects.select_related("profil").all()


class ProfilHoraireUtilisateurViewSet(viewsets.ModelViewSet):
    serializer_class = ProfilHoraireUtilisateurSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return ProfilHoraireUtilisateur.objects.select_related("utilisateur", "profil_horaire")


class ParametreSocieteViewSet(viewsets.ModelViewSet):
    serializer_class = ParametreSocieteSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = ParametreSociete.objects.all()


class ChargeFixeStructureViewSet(viewsets.ModelViewSet):
    serializer_class = ChargeFixeStructureSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = ChargeFixeStructure.objects.all()


SOURCE_SMIC_SERVICE_PUBLIC = "https://www.service-public.gouv.fr/particuliers/vosdroits/F2300"


def _decimal_depuis_prix_service_public(valeur: str) -> Decimal:
    normalisee = (
        unescape(valeur)
        .replace("\xa0", "")
        .replace(" ", "")
        .replace("€", "")
        .replace(",", ".")
        .strip()
    )
    return Decimal(normalisee)


def _extraire_smic_service_public(html: str, est_mayotte: bool) -> Decimal:
    repere = "Montant du Smic à Mayotte" if est_mayotte else "Tableau - Montants du Smic"
    debut = html.find(repere)
    if debut < 0:
        raise ValueError("Tableau SMIC introuvable sur Service-Public")

    section = html[debut:debut + 4000]
    ligne = re.search(r"Smic horaire.*?sp-prix[^>]*>([^<]+)</span>", section, flags=re.S)
    if not ligne:
        raise ValueError("Montant horaire SMIC introuvable sur Service-Public")
    return _decimal_depuis_prix_service_public(ligne.group(1))


def _recuperer_smic_service_public(est_mayotte: bool) -> tuple[Decimal, str]:
    response = requests.get(
        SOURCE_SMIC_SERVICE_PUBLIC,
        timeout=10,
        headers={"User-Agent": "LBH-Economiste/1.0 (+https://www.lbh-economiste.com)"},
    )
    response.raise_for_status()
    return _extraire_smic_service_public(response.text, est_mayotte), "service_public"


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def vue_reference_smic(request):
    zone = (request.query_params.get("zone") or "").lower()
    est_mayotte = "mayotte" in zone or zone in {"976", "yt"}
    try:
        valeur, mode = _recuperer_smic_service_public(est_mayotte)
    except Exception:
        valeur = Decimal("9.33") if est_mayotte else Decimal("12.02")
        mode = "repli_service_public"

    return Response(
        {
            "zone": "Mayotte" if est_mayotte else "France hors Mayotte",
            "smic_horaire_brut": str(valeur),
            "date_effet": "2026-01-01",
            "source": SOURCE_SMIC_SERVICE_PUBLIC,
            "mode": mode,
        }
    )


def _profil_horaire_par_defaut_utilisateur(utilisateur_id: str | None):
    if not utilisateur_id:
        return None
    affectation = (
        ProfilHoraireUtilisateur.objects.select_related("profil_horaire")
        .filter(utilisateur_id=utilisateur_id)
        .first()
    )
    return affectation.profil_horaire if affectation else None


class TempsPasseViewSet(viewsets.ModelViewSet):
    serializer_class = TempsPasseSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = TempsPasse.objects.select_related("projet", "utilisateur", "profil_horaire")
        projet_id = self.request.query_params.get("projet")
        utilisateur_id = self.request.query_params.get("utilisateur")
        if projet_id:
            qs = qs.filter(projet_id=projet_id)
        if utilisateur_id:
            qs = qs.filter(utilisateur_id=utilisateur_id)
        return qs

    def perform_create(self, serializer):
        serializer.save(cree_par=self.request.user)

    @action(detail=True, methods=["post"], url_path="changer-statut")
    def changer_statut(self, request, pk=None):
        temps = self.get_object()
        statut_cible = request.data.get("statut")
        if statut_cible not in {code for code, _ in TempsPasse.STATUTS}:
            return Response({"detail": "Statut invalide."}, status=status.HTTP_400_BAD_REQUEST)
        temps.statut = statut_cible
        temps.save(update_fields=["statut", "date_modification"])
        return Response(TempsPasseSerializer(temps).data)

    @action(detail=False, methods=["get"])
    def suggestions(self, request):
        projet_id = request.query_params.get("projet")
        if not projet_id:
            return Response({"detail": "Le paramètre projet est requis."}, status=status.HTTP_400_BAD_REQUEST)

        projet = get_object_or_404(Projet.objects.prefetch_related("affectations"), pk=projet_id)
        utilisateur_id = request.query_params.get("utilisateur")
        devis = _devis_reference_pour_projet(projet)
        affectations = projet.affectations.all()
        if utilisateur_id:
            affectations = affectations.filter(utilisateur_id=utilisateur_id)

        ligne_horaire_reference = (
            devis.lignes.filter(type_ligne="horaire", profil__isnull=False).order_by("ordre").first()
            if devis
            else None
        )

        suggestions = []
        for affectation in affectations:
            deja_saisi = TempsPasse.objects.filter(
                projet=projet,
                utilisateur_id=affectation.utilisateur_id,
                nature=affectation.nature,
                code_cible=affectation.code_cible,
            ).exists()
            profil_horaire_utilisateur = _profil_horaire_par_defaut_utilisateur(str(affectation.utilisateur_id))
            taux_suggere = (
                profil_horaire_utilisateur.taux_horaire_ht
                if profil_horaire_utilisateur
                else (ligne_horaire_reference.taux_horaire if ligne_horaire_reference else Decimal("0"))
            )
            suggestions.append({
                "affectation_id": str(affectation.id),
                "utilisateur": str(affectation.utilisateur_id),
                "utilisateur_nom": affectation.utilisateur.nom_complet,
                "nature": affectation.nature,
                "nature_libelle": affectation.get_nature_display(),
                "code_cible": affectation.code_cible,
                "libelle_cible": affectation.libelle_cible,
                "role": affectation.role,
                "role_libelle": affectation.get_role_display(),
                "commentaires": affectation.commentaires,
                "nb_heures_suggerees": _heures_suggerees_pour_affectation(devis, affectation),
                "taux_horaire_suggere": taux_suggere,
                "profil_horaire_id": str(profil_horaire_utilisateur.id) if profil_horaire_utilisateur else "",
                "profil_horaire_libelle": profil_horaire_utilisateur.libelle if profil_horaire_utilisateur else "",
                "deja_saisi": deja_saisi,
                "devis_reference": devis.reference if devis else "",
            })

        return Response({
            "projet_id": str(projet.id),
            "projet_reference": projet.reference,
            "devis_reference": devis.reference if devis else "",
            "suggestions": suggestions,
        })

    @action(detail=False, methods=["post"], url_path="initialiser-depuis-affectations")
    def initialiser_depuis_affectations(self, request):
        projet_id = request.data.get("projet")
        if not projet_id:
            return Response({"detail": "Le champ projet est requis."}, status=status.HTTP_400_BAD_REQUEST)

        projet = get_object_or_404(Projet.objects.prefetch_related("affectations"), pk=projet_id)
        utilisateur_id = request.data.get("utilisateur")
        date_saisie = request.data.get("date_saisie") or str(timezone.localdate())
        profil_horaire_id = request.data.get("profil_horaire")
        profil_horaire = None
        if profil_horaire_id:
            profil_horaire = get_object_or_404(ProfilHoraire, pk=profil_horaire_id)

        devis = _devis_reference_pour_projet(projet)
        ligne_horaire_reference = (
            devis.lignes.filter(type_ligne="horaire", profil__isnull=False).order_by("ordre").first()
            if devis
            else None
        )
        affectations = projet.affectations.all()
        if utilisateur_id:
            affectations = affectations.filter(utilisateur_id=utilisateur_id)

        creations = []
        for affectation in affectations:
            existe = TempsPasse.objects.filter(
                projet=projet,
                utilisateur_id=affectation.utilisateur_id,
                nature=affectation.nature,
                code_cible=affectation.code_cible,
                statut="brouillon",
            ).exists()
            if existe:
                continue
            profil_effectif = profil_horaire or _profil_horaire_par_defaut_utilisateur(str(affectation.utilisateur_id))

            temps = TempsPasse.objects.create(
                projet=projet,
                utilisateur_id=affectation.utilisateur_id,
                profil_horaire=profil_effectif,
                date_saisie=date_saisie,
                nature=affectation.nature,
                statut="brouillon",
                code_cible=affectation.code_cible,
                libelle_cible=affectation.libelle_cible,
                nb_heures=_heures_suggerees_pour_affectation(devis, affectation),
                taux_horaire=(
                    profil_effectif.taux_horaire_ht
                    if profil_effectif
                    else (ligne_horaire_reference.taux_horaire if ligne_horaire_reference else Decimal("0"))
                ),
                commentaires=affectation.commentaires or affectation.get_role_display(),
                cree_par=request.user,
            )
            creations.append(temps)

        return Response({
            "detail": f"{len(creations)} saisie(s) brouillon générée(s).",
            "temps_passes": TempsPasseSerializer(creations, many=True).data,
        }, status=status.HTTP_201_CREATED)


# ─────────────────────────────────────────────
# Devis d'honoraires
# ─────────────────────────────────────────────

class DevisHonorairesViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = DevisHonoraires.objects.select_related("projet", "cree_par").prefetch_related("lignes")
        statut = self.request.query_params.get("statut")
        projet_id = self.request.query_params.get("projet")
        if statut:
            qs = qs.filter(statut=statut)
        if projet_id:
            qs = qs.filter(projet_id=projet_id)
        return qs

    def get_serializer_class(self):
        if self.action in ("list",):
            return DevisHonorairesListeSerializer
        return DevisHonorairesDetailSerializer

    def perform_create(self, serializer):
        ref = self.request.data.get("reference") or _generer_reference_devis()
        serializer.save(cree_par=self.request.user, reference=ref)

    @action(detail=False, methods=["get"])
    def assistant(self, request):
        famille_client = request.query_params.get("famille_client", "")
        sous_type_client = request.query_params.get("sous_type_client", "")
        nature_ouvrage = request.query_params.get("nature_ouvrage", "")
        contexte_contractuel = request.query_params.get("contexte_contractuel", "")
        nature_marche = request.query_params.get("nature_marche", "")
        role_lbh = request.query_params.get("role_lbh", "")
        utilisateur_id = request.query_params.get("utilisateur", "")

        missions = lister_missions_livrables(
            famille_client=famille_client,
            sous_type_client=sous_type_client,
            nature_ouvrage=nature_ouvrage,
        )
        profil_horaire = _profil_horaire_par_defaut_utilisateur(utilisateur_id)
        suggestions = construire_suggestions_prestations(missions, profil_horaire=profil_horaire)
        contexte = construire_contexte_projet_saisi(
            famille_client=famille_client,
            sous_type_client=sous_type_client,
            contexte_contractuel=contexte_contractuel,
            nature_ouvrage=nature_ouvrage,
            nature_marche=nature_marche,
            role_lbh=role_lbh,
            missions_selectionnees=[
                {
                    "missionCode": mission["code"],
                    "livrablesCodes": [livrable["code"] for livrable in mission["livrables"]],
                }
                for mission in missions
            ],
        )

        return Response({
            "reference_suggeree": _generer_reference_devis(),
            "missions": missions,
            "suggestions_prestations": suggestions,
            "contexte_projet_saisi": contexte,
            "profil_horaire_suggere": {
                "id": str(profil_horaire.id) if profil_horaire else "",
                "libelle": profil_horaire.libelle if profil_horaire else "",
                "taux_horaire_ht": str(profil_horaire.taux_horaire_ht) if profil_horaire else "0.00",
            },
        })

    @action(detail=True, methods=["post"])
    def changer_statut(self, request, pk=None):
        devis = self.get_object()
        nouveau_statut = request.data.get("statut")
        statuts_valides = [s[0] for s in DevisHonoraires.STATUTS]
        if nouveau_statut not in statuts_valides:
            return Response({"detail": "Statut invalide."}, status=status.HTTP_400_BAD_REQUEST)
        champs_a_mettre_a_jour = ["statut", "date_acceptation", "date_refus"]
        if nouveau_statut == "accepte":
            devis.date_acceptation = date.today()
            if not devis.mode_validation:
                devis.mode_validation = "manuel"
                champs_a_mettre_a_jour.append("mode_validation")
        elif nouveau_statut == "refuse":
            devis.date_refus = date.today()
        devis.statut = nouveau_statut
        devis.save(update_fields=champs_a_mettre_a_jour)
        return Response(DevisHonorairesDetailSerializer(devis).data)

    @action(detail=True, methods=["get"], url_path="export-pdf")
    def export_pdf(self, request, pk=None):
        devis = self.get_object()
        pdf = generer_pdf_devis(
            devis,
            base_url=request.build_absolute_uri("/"),
        )
        response = HttpResponse(pdf, content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="{devis.reference}.pdf"'
        return response

    @action(detail=True, methods=["post"], url_path="envoyer-client")
    def envoyer_client(self, request, pk=None):
        devis = self.get_object()
        if not devis.client_email:
            return Response(
                {"detail": "Le devis doit contenir une adresse email client."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        expiration_jours = int(request.data.get("expiration_jours") or 14)
        now = timezone.now()
        devis.jeton_validation_client = generer_jeton_validation()
        devis.date_expiration_validation = now + timedelta(days=expiration_jours)
        devis.date_envoi_client = now
        devis.statut = "envoye"

        validation_path = reverse(
            "societe-validation-devis-client",
            kwargs={"jeton": devis.jeton_validation_client},
        )
        validation_url = request.build_absolute_uri(validation_path)
        pdf = generer_pdf_devis(
            devis,
            validation_url=validation_url,
            base_url=request.build_absolute_uri("/"),
        )

        sujet = f"Devis {devis.reference} - {devis.intitule}"
        corps_texte = (
            f"Bonjour,\n\n"
            f"Veuillez trouver ci-joint le devis {devis.reference}.\n"
            f"Pour valider ce devis, utilisez le lien suivant avant expiration :\n"
            f"{validation_url}\n"
        )
        corps_html = (
            f"<p>Bonjour,</p>"
            f"<p>Veuillez trouver ci-joint le devis <strong>{devis.reference}</strong>.</p>"
            f"<p><a href=\"{validation_url}\">Valider le devis</a></p>"
        )

        try:
            envoyer_courriel(
                sujet=sujet,
                destinataires=[devis.client_email],
                corps_texte=corps_texte,
                corps_html=corps_html,
                utilisateur=request.user,
                contexte_journal={
                    "module": "societe",
                    "devis_id": str(devis.id),
                    "reference": devis.reference,
                },
                pieces_jointes=[
                    {
                        "nom": f"{devis.reference}.pdf",
                        "contenu": pdf,
                        "type_mime": "application/pdf",
                    }
                ],
            )
        except MessagerieErreur as exc:
            return Response(
                {"detail": f"Envoi impossible : {exc}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        devis.save(update_fields=[
            "jeton_validation_client",
            "date_expiration_validation",
            "date_envoi_client",
            "statut",
            "date_modification",
        ])
        return Response({
            "detail": "Le devis a été envoyé au client.",
            "validation_url": validation_url,
            "devis": DevisHonorairesDetailSerializer(devis).data,
        })

    @action(detail=True, methods=["post"], url_path="creer-projet")
    def creer_projet(self, request, pk=None):
        devis = self.get_object()
        if devis.projet_id:
            return Response(
                {"detail": "Un projet est déjà rattaché à ce devis.", "projet_id": str(devis.projet_id)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if devis.statut != "accepte":
            return Response(
                {"detail": "Le devis doit être accepté avant de créer un projet."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        contexte = dict(devis.contexte_projet_saisie or {})
        if not contexte:
            contexte = construire_contexte_projet_saisi(
                famille_client=devis.famille_client,
                sous_type_client=devis.sous_type_client,
                contexte_contractuel=devis.contexte_contractuel,
                nature_ouvrage=devis.nature_ouvrage,
                nature_marche=devis.nature_marche,
                role_lbh=devis.role_lbh,
                missions_selectionnees=devis.missions_selectionnees or [],
            )

        serializer = ProjetDetailSerialiseur(
            data={
                "reference": Projet().generer_reference(),
                "intitule": devis.intitule,
                "type_projet": _type_projet_depuis_devis(devis),
                "statut": "en_cours",
                "organisation": str(request.user.organisation_id) if request.user.organisation_id else None,
                "description": devis.objet,
                "observations": devis.conditions_particulieres,
                "honoraires_prevus": devis.montant_ht,
                "qualification_wizard": {
                    "source_devis_id": str(devis.id),
                    "source_devis_reference": devis.reference,
                },
                "contexte_projet_saisie": contexte,
            },
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        projet = serializer.save(
            responsable=request.user,
            cree_par=request.user,
        )
        _initialiser_statuts_livrables(projet, devis.missions_selectionnees or [])
        devis.projet = projet
        devis.save(update_fields=["projet", "date_modification"])

        return Response(
            {
                "detail": "Le projet a été créé à partir du devis accepté.",
                "projet": ProjetDetailSerialiseur(projet, context={"request": request}).data,
                "devis": DevisHonorairesDetailSerializer(devis).data,
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"])
    def generer_facture(self, request, pk=None):
        """Génère une facture depuis un devis accepté."""
        devis = self.get_object()
        if devis.statut != "accepte":
            return Response(
                {"detail": "Le devis doit être accepté pour générer une facture."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        ref = _generer_reference_facture()
        echeance = date.today() + timedelta(days=devis.delai_paiement_jours)
        facture = Facture.objects.create(
            reference=ref,
            devis=devis,
            projet=devis.projet,
            intitule=devis.intitule,
            client_nom=devis.client_nom,
            client_contact=devis.client_contact,
            client_email=devis.client_email,
            client_adresse=devis.client_adresse,
            date_echeance=echeance,
            taux_tva=devis.taux_tva,
            montant_ht=devis.montant_ht,
            montant_tva=devis.montant_tva,
            montant_ttc=devis.montant_ttc,
            cree_par=request.user,
        )
        # Copier les lignes du devis vers la facture
        for i, ligne in enumerate(devis.lignes.all().order_by("ordre")):
            LigneFacture.objects.create(
                facture=facture,
                ordre=i,
                intitule=ligne.intitule,
                description=ligne.description,
                quantite=ligne.quantite if ligne.type_ligne != "horaire" else ligne.nb_heures or 1,
                unite="h" if ligne.type_ligne == "horaire" else ligne.unite,
                prix_unitaire_ht=ligne.taux_horaire or ligne.montant_unitaire_ht or Decimal("0"),
                montant_ht=ligne.montant_ht,
            )
        return Response(FactureDetailSerializer(facture).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get", "post"], url_path="lignes")
    def lignes(self, request, pk=None):
        devis = self.get_object()
        if request.method == "GET":
            return Response(LigneDevisSerializer(devis.lignes.order_by("ordre"), many=True).data)
        serializer = LigneDevisSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ligne = serializer.save(devis=devis)
        ligne.calculer_montant()
        ligne.save(update_fields=["montant_ht"])
        devis.recalculer_totaux()
        return Response(LigneDevisSerializer(ligne).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["put", "delete"], url_path="lignes/(?P<ligne_pk>[^/.]+)")
    def ligne_detail(self, request, pk=None, ligne_pk=None):
        devis = self.get_object()
        try:
            ligne = LigneDevis.objects.get(pk=ligne_pk, devis=devis)
        except LigneDevis.DoesNotExist:
            return Response({"detail": "Ligne introuvable."}, status=status.HTTP_404_NOT_FOUND)
        if request.method == "DELETE":
            ligne.delete()
            devis.recalculer_totaux()
            return Response(status=status.HTTP_204_NO_CONTENT)
        serializer = LigneDevisSerializer(ligne, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        ligne = serializer.save()
        ligne.calculer_montant()
        ligne.save(update_fields=["montant_ht"])
        devis.recalculer_totaux()
        return Response(LigneDevisSerializer(ligne).data)

    @action(detail=False, methods=["post"])
    def depuis_projet(self, request):
        """Pré-génère un devis depuis les données d'un projet."""
        from applications.projets.models import Projet
        projet_id = request.data.get("projet_id")
        if not projet_id:
            return Response({"detail": "projet_id requis."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            projet = Projet.objects.get(pk=projet_id)
        except Projet.DoesNotExist:
            return Response({"detail": "Projet introuvable."}, status=status.HTTP_404_NOT_FOUND)

        # Construire des lignes par phase selon le contexte du projet
        ref = _generer_reference_devis()
        phases_devis = _phases_depuis_projet(projet)
        profil_defaut = ProfilHoraire.objects.filter(actif=True).order_by("ordre").first()
        taux_defaut = profil_defaut.taux_horaire_ht if profil_defaut else Decimal("80.00")

        return Response({
            "reference_suggeree": ref,
            "intitule_suggere": f"Mission économiste — {projet.intitule}",
            "client_nom_suggere": projet.maitre_ouvrage_nom or projet.organisation_nom or "",
            "projet_id": str(projet.id),
            "projet_reference": projet.reference,
            "phases_suggerees": phases_devis,
            "taux_defaut": float(taux_defaut),
            "profil_defaut_id": str(profil_defaut.id) if profil_defaut else None,
        })


def _phases_depuis_projet(projet):
    """Génère des phases de mission suggérées selon le contexte du projet."""
    PHASES_LABELS = {
        "esq": ("ESQ — Esquisse", 8),
        "aps": ("APS — Avant-projet sommaire", 12),
        "apd": ("APD — Avant-projet définitif", 16),
        "pro": ("PRO — Projet", 20),
        "dce": ("DCE — Dossier consultation des entreprises", 24),
        "act": ("ACT — Assistance contrats", 8),
        "exe": ("EXE — Études d'exécution", 16),
        "suivi": ("Suivi de chantier", 30),
        "aor": ("AOR — Assistance opération de réception", 8),
    }
    phases = []
    contexte = getattr(projet, "contexte_projet", None)
    if contexte:
        phase_actuelle = getattr(contexte, "phase_intervention", None)
        if phase_actuelle:
            code = phase_actuelle.get("code", "") if isinstance(phase_actuelle, dict) else ""
            if code in PHASES_LABELS:
                label, heures = PHASES_LABELS[code]
                phases.append({"phase_code": code, "intitule": label, "nb_heures_suggere": heures})
    if not phases:
        # Phases standard par défaut
        for code, (label, heures) in list(PHASES_LABELS.items())[:5]:
            phases.append({"phase_code": code, "intitule": label, "nb_heures_suggere": heures})
    return phases


# ─────────────────────────────────────────────
# Lignes de devis
# ─────────────────────────────────────────────

class LigneDevisViewSet(viewsets.ModelViewSet):
    serializer_class = LigneDevisSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return LigneDevis.objects.filter(devis_id=self.kwargs["devis_pk"])

    def perform_create(self, validated_data):
        validated_data["devis_id"] = self.kwargs["devis_pk"]

    def perform_destroy(self, instance):
        devis = instance.devis
        instance.delete()
        devis.recalculer_totaux()


# ─────────────────────────────────────────────
# Factures
# ─────────────────────────────────────────────

class FactureViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = Facture.objects.select_related("projet", "devis", "cree_par").prefetch_related("lignes", "paiements")
        statut = self.request.query_params.get("statut")
        projet_id = self.request.query_params.get("projet")
        en_retard = self.request.query_params.get("en_retard")
        if statut:
            qs = qs.filter(statut=statut)
        if projet_id:
            qs = qs.filter(projet_id=projet_id)
        if en_retard == "true":
            qs = qs.filter(
                statut__in=("emise", "partiellement_payee"),
                date_echeance__lt=date.today(),
            )
        return qs

    def get_serializer_class(self):
        if self.action == "list":
            return FactureListeSerializer
        return FactureDetailSerializer

    def perform_create(self, serializer):
        ref = self.request.data.get("reference") or _generer_reference_facture()
        serializer.save(cree_par=self.request.user, reference=ref)

    @action(detail=True, methods=["post"])
    def changer_statut(self, request, pk=None):
        facture = self.get_object()
        nouveau_statut = request.data.get("statut")
        statuts_valides = [s[0] for s in Facture.STATUTS]
        if nouveau_statut not in statuts_valides:
            return Response({"detail": "Statut invalide."}, status=status.HTTP_400_BAD_REQUEST)
        facture.statut = nouveau_statut
        facture.save(update_fields=["statut"])
        return Response(FactureDetailSerializer(facture).data)

    @action(detail=True, methods=["post"])
    def enregistrer_paiement(self, request, pk=None):
        """Enregistre un paiement sur la facture."""
        facture = self.get_object()
        serializer = PaiementSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        paiement = serializer.save(facture=facture, enregistre_par=request.user)
        return Response(PaiementSerializer(paiement).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get", "post"], url_path="lignes")
    def lignes(self, request, pk=None):
        facture = self.get_object()
        if request.method == "GET":
            return Response(LigneFactureSerializer(facture.lignes.order_by("ordre"), many=True).data)
        serializer = LigneFactureSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ligne = serializer.save(facture=facture)
        ligne.calculer_montant()
        ligne.save(update_fields=["montant_ht"])
        facture.recalculer_totaux()
        return Response(LigneFactureSerializer(ligne).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["put", "delete"], url_path="lignes/(?P<ligne_pk>[^/.]+)")
    def ligne_detail(self, request, pk=None, ligne_pk=None):
        facture = self.get_object()
        try:
            ligne = LigneFacture.objects.get(pk=ligne_pk, facture=facture)
        except LigneFacture.DoesNotExist:
            return Response({"detail": "Ligne introuvable."}, status=status.HTTP_404_NOT_FOUND)
        if request.method == "DELETE":
            ligne.delete()
            facture.recalculer_totaux()
            return Response(status=status.HTTP_204_NO_CONTENT)
        serializer = LigneFactureSerializer(ligne, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        ligne = serializer.save()
        ligne.calculer_montant()
        ligne.save(update_fields=["montant_ht"])
        facture.recalculer_totaux()
        return Response(LigneFactureSerializer(ligne).data)

    @action(detail=True, methods=["delete"], url_path="paiements/(?P<paiement_pk>[^/.]+)")
    def supprimer_paiement(self, request, pk=None, paiement_pk=None):
        try:
            paiement = Paiement.objects.get(pk=paiement_pk, facture_id=pk)
        except Paiement.DoesNotExist:
            return Response({"detail": "Paiement introuvable."}, status=status.HTTP_404_NOT_FOUND)
        facture = paiement.facture
        paiement.delete()
        # Recalculer le montant payé
        total_paye = sum(p.montant for p in facture.paiements.all())
        facture.montant_paye = total_paye
        facture.save(update_fields=["montant_paye"])
        facture.mettre_a_jour_statut()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ─────────────────────────────────────────────
# Tableau de bord
# ─────────────────────────────────────────────

@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def vue_tableau_de_bord(request):
    """Agrégats financiers pour le tableau de bord société."""
    aujourd_hui = date.today()
    debut_annee = aujourd_hui.replace(month=1, day=1)
    debut_mois = aujourd_hui.replace(day=1)

    # Factures émises cette année (toutes sauf brouillon/annulée)
    factures_annee = Facture.objects.filter(
        date_emission__gte=debut_annee,
        statut__in=("emise", "en_retard", "partiellement_payee", "payee"),
    )
    ca_annee = factures_annee.aggregate(total=Sum("montant_ht"))["total"] or Decimal("0")

    factures_mois = factures_annee.filter(date_emission__gte=debut_mois)
    ca_mois = factures_mois.aggregate(total=Sum("montant_ht"))["total"] or Decimal("0")

    # Encaissements
    paiements_annee = Paiement.objects.filter(date_paiement__gte=debut_annee)
    montant_encaisse = paiements_annee.aggregate(total=Sum("montant"))["total"] or Decimal("0")

    # En attente
    factures_ouvertes = Facture.objects.filter(statut__in=("emise", "partiellement_payee", "en_retard"))
    montant_en_attente = sum(f.montant_restant for f in factures_ouvertes)
    factures_retard = [f for f in factures_ouvertes if f.est_en_retard]
    montant_en_retard = sum(f.montant_restant for f in factures_retard)

    # Devis
    nb_devis_en_cours = DevisHonoraires.objects.filter(statut="brouillon").count()
    nb_devis_attente = DevisHonoraires.objects.filter(statut="envoye").count()

    devis_recents = DevisHonoraires.objects.order_by("-date_creation")[:5]
    factures_retard_qs = Facture.objects.filter(
        statut__in=("emise", "partiellement_payee"),
        date_echeance__lt=aujourd_hui,
    ).order_by("date_echeance")[:10]
    temps_passes = TempsPasse.objects.select_related("projet", "utilisateur").order_by("-date_saisie", "-date_creation")

    rentabilite_par_salarie = []
    for ligne in (
        temps_passes.values("utilisateur_id", "utilisateur__prenom", "utilisateur__nom")
        .annotate(total_heures=Sum("nb_heures"), total_cout=Sum("cout_total"))
        .order_by("-total_cout")[:8]
    ):
        projets_ids = list(
            temps_passes.filter(utilisateur_id=ligne["utilisateur_id"])
            .values_list("projet_id", flat=True)
            .distinct()
        )
        honoraires = (
            DevisHonoraires.objects.filter(projet_id__in=projets_ids, statut="accepte")
            .aggregate(total=Sum("montant_ht"))["total"]
            or Decimal("0")
        )
        rentabilite_par_salarie.append({
            "utilisateur_id": str(ligne["utilisateur_id"]),
            "nom_complet": f"{ligne['utilisateur__prenom']} {ligne['utilisateur__nom']}".strip(),
            "total_heures": ligne["total_heures"] or Decimal("0"),
            "total_cout": ligne["total_cout"] or Decimal("0"),
            "honoraires_associes": honoraires,
            "marge_estimee": honoraires - (ligne["total_cout"] or Decimal("0")),
        })

    rentabilite_par_dossier = []
    for ligne in (
        temps_passes.values("projet_id", "projet__reference", "projet__intitule")
        .annotate(total_heures=Sum("nb_heures"), total_cout=Sum("cout_total"))
        .order_by("-total_cout")[:8]
    ):
        honoraires = (
            DevisHonoraires.objects.filter(projet_id=ligne["projet_id"], statut="accepte")
            .aggregate(total=Sum("montant_ht"))["total"]
            or Decimal("0")
        )
        rentabilite_par_dossier.append({
            "projet_id": str(ligne["projet_id"]),
            "reference": ligne["projet__reference"] or "",
            "intitule": ligne["projet__intitule"] or "",
            "total_heures": ligne["total_heures"] or Decimal("0"),
            "total_cout": ligne["total_cout"] or Decimal("0"),
            "honoraires_associes": honoraires,
            "marge_estimee": honoraires - (ligne["total_cout"] or Decimal("0")),
        })

    return Response({
        "ca_annee_courante": ca_annee,
        "ca_mois_courant": ca_mois,
        "montant_facture": factures_annee.aggregate(total=Sum("montant_ttc"))["total"] or Decimal("0"),
        "montant_encaisse": montant_encaisse,
        "montant_en_attente": montant_en_attente,
        "montant_en_retard": montant_en_retard,
        "nb_devis_en_cours": nb_devis_en_cours,
        "nb_devis_attente_reponse": nb_devis_attente,
        "nb_factures_en_retard": len(factures_retard),
        "devis_recents": DevisHonorairesListeSerializer(devis_recents, many=True).data,
        "factures_en_retard": FactureListeSerializer(factures_retard_qs, many=True).data,
        "temps_passes_recents": TempsPasseSerializer(temps_passes[:10], many=True).data,
        "rentabilite_par_salarie": rentabilite_par_salarie,
        "rentabilite_par_dossier": rentabilite_par_dossier,
    })


# ─────────────────────────────────────────────
# Simulations salariales imbriquées dans un profil
# ─────────────────────────────────────────────

@api_view(["GET", "POST"])
@permission_classes([permissions.IsAuthenticated])
def vue_simulations_profil(request, profil_pk):
    profil = get_object_or_404(ProfilHoraire, pk=profil_pk)
    if request.method == "GET":
        sims = SimulationSalaire.objects.filter(profil=profil).order_by("ordre", "date_creation")
        return Response(SimulationSalaireSerializer(sims, many=True).data)
    # POST — création
    ser = SimulationSalaireSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    ser.save(profil=profil)
    return Response(ser.data, status=status.HTTP_201_CREATED)


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def vue_previsualiser_simulation(request, profil_pk):
    """Calcule une fiche sans persister — prévisualisation temps réel."""
    from .services import calculer_fiche_salaire
    profil = get_object_or_404(ProfilHoraire, pk=profil_pk)
    try:
        fiche = calculer_fiche_salaire(
            salaire_net=request.query_params.get("salaire_net", "0"),
            primes=request.query_params.get("primes", "0"),
            avantages=request.query_params.get("avantages", "0"),
            taux_sal=profil.taux_charges_salariales,
            taux_pat=profil.taux_charges_patronales,
            heures_an=profil.heures_productives_an,
            taux_marge=profil.taux_marge_vente,
        )
    except Exception as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    return Response({k: str(v) for k, v in fiche.items()})


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def vue_validation_devis_client(request, jeton):
    devis = get_object_or_404(DevisHonoraires, jeton_validation_client=jeton)

    if devis.statut == "accepte":
        contenu = rendu_validation_html(
            "Devis déjà validé",
            f"Le devis {devis.reference} a déjà été validé.",
        )
        return HttpResponse(contenu)

    if devis.statut != "envoye":
        contenu = rendu_validation_html(
            "Validation indisponible",
            f"Le devis {devis.reference} ne peut plus être validé avec ce lien.",
        )
        return HttpResponse(contenu, status=400)

    if not devis.date_expiration_validation or devis.date_expiration_validation < timezone.now():
        devis.statut = "expire"
        devis.save(update_fields=["statut", "date_modification"])
        contenu = rendu_validation_html(
            "Lien expiré",
            f"Le lien de validation du devis {devis.reference} a expiré.",
        )
        return HttpResponse(contenu, status=410)

    now = timezone.now()
    devis.statut = "accepte"
    devis.mode_validation = "client"
    devis.date_validation_client = now
    devis.date_acceptation = now.date()
    devis.jeton_validation_client = None
    devis.date_expiration_validation = None
    devis.save(update_fields=[
        "statut",
        "mode_validation",
        "date_validation_client",
        "date_acceptation",
        "jeton_validation_client",
        "date_expiration_validation",
        "date_modification",
    ])
    contenu = rendu_validation_html(
        "Devis validé",
        f"Votre validation du devis {devis.reference} a bien été enregistrée.",
    )
    return HttpResponse(contenu)
