"""
Vues API — Module Pilotage Société
"""

import re
from decimal import Decimal
from datetime import date, timedelta

from django.db.models import Sum, Count, Q
from django.utils import timezone

from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response

from .models import ProfilHoraire, DevisHonoraires, LigneDevis, Facture, LigneFacture, Paiement
from .serializers import (
    ProfilHoraireSerializer,
    DevisHonorairesListeSerializer, DevisHonorairesDetailSerializer,
    LigneDevisSerializer,
    FactureListeSerializer, FactureDetailSerializer,
    LigneFactureSerializer,
    PaiementSerializer,
)



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


# ─────────────────────────────────────────────
# Profils horaires
# ─────────────────────────────────────────────

class ProfilHoraireViewSet(viewsets.ModelViewSet):
    queryset = ProfilHoraire.objects.all()
    serializer_class = ProfilHoraireSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.query_params.get("actif") == "true":
            qs = qs.filter(actif=True)
        return qs


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

    @action(detail=True, methods=["post"])
    def changer_statut(self, request, pk=None):
        devis = self.get_object()
        nouveau_statut = request.data.get("statut")
        statuts_valides = [s[0] for s in DevisHonoraires.STATUTS]
        if nouveau_statut not in statuts_valides:
            return Response({"detail": "Statut invalide."}, status=status.HTTP_400_BAD_REQUEST)
        if nouveau_statut == "accepte":
            devis.date_acceptation = date.today()
        elif nouveau_statut == "refuse":
            devis.date_refus = date.today()
        devis.statut = nouveau_statut
        devis.save(update_fields=["statut", "date_acceptation", "date_refus"])
        return Response(DevisHonorairesDetailSerializer(devis).data)

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
    })
