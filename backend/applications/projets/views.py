"""
Vues API pour les projets — Plateforme LBH.
"""

import uuid
from pathlib import Path

from django.conf import settings
from rest_framework import generics, permissions, filters
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from .models import Projet, Lot, Intervenant, PreanalyseSourcesProjet, MissionClient, LivrableType, ModeleDocument, AffectationProjet
from .serialiseurs import (
    ProjetListeSerialiseur,
    ProjetDetailSerialiseur,
    LotSerialiseur,
    IntervenantSerialiseur,
    AffectationProjetSerialiseur,
    PreanalyseSourcesProjetSerialiseur,
)
from .services import (
    construire_bilan_documentaire_projet,
    construire_processus_recommande,
    construire_suggestion_phase_projet,
    index_phase_projet,
    libelle_phase_projet,
    normaliser_phase_projet,
)
from .referentiels import construire_parcours_projet, lister_references_indices_prix
from .taches import executer_preanalyse_sources_projet, importer_sources_preanalyse_dans_projet
from applications.documents.services import synchroniser_dossiers_projet


def _assurer_intervenant_responsable(projet: Projet) -> None:
    if not projet.responsable_id:
        return
    Intervenant.objects.get_or_create(
        projet=projet,
        utilisateur=projet.responsable,
        defaults={"role": "responsable"},
    )


def _assurer_intervenant_affecte(projet: Projet, utilisateur, role: str = "economiste") -> None:
    if not utilisateur:
        return
    Intervenant.objects.get_or_create(
        projet=projet,
        utilisateur=utilisateur,
        defaults={"role": role},
    )


class VueListeProjets(generics.ListCreateAPIView):
    """
    GET  /api/projets/          → liste des projets accessibles à l'utilisateur
    POST /api/projets/          → création d'un projet
    """

    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["reference", "intitule", "commune"]
    ordering_fields = ["reference", "date_modification", "statut"]
    ordering = ["-date_modification"]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return ProjetDetailSerialiseur
        return ProjetListeSerialiseur

    def get_queryset(self):
        utilisateur = self.request.user
        qs = Projet.objects.select_related(
            "organisation", "responsable", "maitre_ouvrage"
        )
        if not utilisateur.est_super_admin:
            # Restreindre aux projets de l'organisation ou où l'utilisateur intervient
            qs = qs.filter(
                organisation=utilisateur.organisation
            ) | qs.filter(
                intervenants__utilisateur=utilisateur
            )
            qs = qs.distinct()

        # Filtres optionnels
        statut = self.request.query_params.get("statut")
        if statut:
            qs = qs.filter(statut=statut)

        return qs

    def perform_create(self, serialiseur):
        projet = serialiseur.save(
            responsable=self.request.user,
            cree_par=self.request.user,
        )
        _assurer_intervenant_responsable(projet)
        synchroniser_dossiers_projet(projet)
        preanalyse_id = self.request.data.get("preanalyse_sources_id")
        if preanalyse_id:
            queryset = PreanalyseSourcesProjet.objects.filter(pk=preanalyse_id)
            if not self.request.user.est_super_admin:
                queryset = queryset.filter(utilisateur=self.request.user)
            preanalyse = queryset.first()
            if preanalyse:
                importer_sources_preanalyse_dans_projet.apply_async(
                    args=[str(preanalyse.id), str(projet.id), str(self.request.user.id)],
                    queue="documents",
                    routing_key="documents",
                )


class VueDetailProjet(generics.RetrieveUpdateDestroyAPIView):
    """
    GET    /api/projets/<id>/
    PATCH  /api/projets/<id>/
    DELETE /api/projets/<id>/  → archivage (pas de suppression physique)
    """

    serializer_class = ProjetDetailSerialiseur
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        utilisateur = self.request.user
        return Projet.objects.select_related(
            "organisation", "responsable", "maitre_ouvrage"
        ).prefetch_related("lots", "intervenants__utilisateur")

    def perform_update(self, serializer):
        projet = serializer.save()
        _assurer_intervenant_responsable(projet)
        synchroniser_dossiers_projet(projet)

    def destroy(self, requete, *args, **kwargs):
        projet = self.get_object()
        if requete.user.est_super_admin:
            reference = projet.reference
            projet.delete()
            return Response({"detail": f"Projet {reference} supprimé définitivement."})
        projet.statut = "archive"
        projet.save(update_fields=["statut"])
        return Response({"detail": "Projet archivé."})


class VueLotsProjet(generics.ListCreateAPIView):
    """
    GET  /api/projets/<projet_id>/lots/
    POST /api/projets/<projet_id>/lots/
    """

    serializer_class = LotSerialiseur
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Lot.objects.filter(projet_id=self.kwargs["projet_id"])

    def perform_create(self, serialiseur):
        serialiseur.save(projet_id=self.kwargs["projet_id"])


class VueIntervenantsProjet(generics.ListCreateAPIView):
    """
    GET  /api/projets/<projet_id>/intervenants/
    POST /api/projets/<projet_id>/intervenants/
    """

    serializer_class = IntervenantSerialiseur
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Intervenant.objects.filter(
            projet_id=self.kwargs["projet_id"]
        ).select_related("utilisateur")

    def perform_create(self, serialiseur):
        serialiseur.save(projet_id=self.kwargs["projet_id"])


class VueAffectationsProjet(generics.ListCreateAPIView):
    serializer_class = AffectationProjetSerialiseur
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return AffectationProjet.objects.filter(
            projet_id=self.kwargs["projet_id"]
        ).select_related("utilisateur")

    def perform_create(self, serialiseur):
        projet = generics.get_object_or_404(Projet, pk=self.kwargs["projet_id"])
        affectation = serialiseur.save(
            projet=projet,
            cree_par=self.request.user,
        )
        _assurer_intervenant_affecte(projet, affectation.utilisateur)


class VueAffectationProjetDetail(generics.DestroyAPIView):
    serializer_class = AffectationProjetSerialiseur
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return AffectationProjet.objects.filter(
            projet_id=self.kwargs["projet_id"]
        )


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def vue_equipe_assignable_projet(requete, projet_id):
    projet = generics.get_object_or_404(Projet, pk=projet_id)
    organisation = projet.organisation or requete.user.organisation
    if not organisation:
        return Response({"utilisateurs": []})

    from applications.comptes.models import Utilisateur

    utilisateurs = Utilisateur.objects.filter(
        organisation=organisation,
        est_actif=True,
    ).select_related("profil").order_by("nom", "prenom")

    return Response({
        "utilisateurs": [
            {
                "id": str(utilisateur.id),
                "nom_complet": utilisateur.nom_complet,
                "fonction": utilisateur.fonction,
                "courriel": utilisateur.courriel,
                "profil_libelle": utilisateur.profil.libelle if utilisateur.profil else "",
            }
            for utilisateur in utilisateurs
        ]
    })


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def vue_mes_affectations_projets(requete):
    affectations = (
        AffectationProjet.objects.filter(utilisateur=requete.user)
        .select_related("projet", "projet__organisation", "projet__responsable", "cree_par")
        .order_by("-date_modification", "-date_creation")
    )

    return Response({
        "affectations": [
            {
                "id": str(affectation.id),
                "nature": affectation.nature,
                "nature_libelle": affectation.get_nature_display(),
                "code_cible": affectation.code_cible,
                "libelle_cible": affectation.libelle_cible,
                "role": affectation.role,
                "role_libelle": affectation.get_role_display(),
                "commentaires": affectation.commentaires,
                "date_creation": affectation.date_creation,
                "date_modification": affectation.date_modification,
                "projet": {
                    "id": str(affectation.projet.id),
                    "reference": affectation.projet.reference,
                    "intitule": affectation.projet.intitule,
                    "statut": affectation.projet.statut,
                    "phase_actuelle": affectation.projet.phase_actuelle,
                    "responsable_nom": affectation.projet.responsable.nom_complet if affectation.projet.responsable_id else "",
                    "organisation_nom": affectation.projet.organisation.nom if affectation.projet.organisation_id else "",
                },
            }
            for affectation in affectations
        ]
    })


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def vue_statistiques_projets(requete):
    """
    GET /api/projets/statistiques/
    Statistiques globales sur les projets de l'utilisateur.
    """
    utilisateur = requete.user
    qs = Projet.objects.filter(organisation=utilisateur.organisation)

    stats = {
        "total": qs.count(),
        "en_cours": qs.filter(statut="en_cours").count(),
        "termines": qs.filter(statut="termine").count(),
        "en_prospection": qs.filter(statut="prospection").count(),
        "suspendus": qs.filter(statut="suspendu").count(),
    }

    return Response(stats)


@api_view(["GET", "POST"])
@permission_classes([permissions.IsAuthenticated])
def vue_orientation_projet(requete):
    """Prévisualise le processus métier recommandé avant création du projet."""
    donnees = requete.data if requete.method == "POST" else requete.query_params
    return Response(
        construire_processus_recommande(
            clientele_cible=donnees.get("clientele_cible"),
            objectif_mission=donnees.get("objectif_mission"),
            type_projet=donnees.get("type_projet"),
            phase=donnees.get("phase_actuelle"),
        )
    )


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def vue_parcours_projet(requete):
    missions = requete.query_params.getlist("missions_principales")
    mission_principale = requete.query_params.get("mission_principale")
    if mission_principale and mission_principale not in missions:
        missions.insert(0, mission_principale)
    return Response(
        construire_parcours_projet(
            famille_client=requete.query_params.get("famille_client", ""),
            sous_type_client=requete.query_params.get("sous_type_client", ""),
            contexte_contractuel=requete.query_params.get("contexte_contractuel", ""),
            missions_principales=missions,
            phase_intervention=requete.query_params.get("phase_intervention", ""),
            nature_ouvrage=requete.query_params.get("nature_ouvrage", "batiment"),
            nature_marche=requete.query_params.get("nature_marche", "public"),
        )
    )


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def vue_references_indices_prix(requete):
    limite = requete.query_params.get("limite")
    try:
        limite_int = int(limite) if limite else None
    except ValueError:
        raise ValidationError({"limite": "La limite doit être un entier."})
    return Response(lister_references_indices_prix(limite_int))


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def vue_creer_preanalyse_sources_projet(requete):
    fichiers = requete.FILES.getlist("fichiers")
    if not fichiers:
        raise ValidationError({"fichiers": "Ajoutez au moins un fichier à analyser."})

    contexte = {
        "famille_client": requete.data.get("famille_client", ""),
        "contexte_contractuel": requete.data.get("contexte_contractuel", ""),
        "nature_ouvrage": requete.data.get("nature_ouvrage", "batiment"),
        "nature_marche": requete.data.get("nature_marche", "public"),
    }
    identifiant = uuid.uuid4()
    repertoire = Path(settings.MEDIA_ROOT) / "preanalyses-sources" / str(identifiant)
    repertoire.mkdir(parents=True, exist_ok=True)

    for fichier in fichiers:
        destination = repertoire / Path(fichier.name).name
        with destination.open("wb") as sortie:
            for bloc in fichier.chunks():
                sortie.write(bloc)

    preanalyse = PreanalyseSourcesProjet.objects.create(
        id=identifiant,
        utilisateur=requete.user,
        statut="en_attente",
        progression=0,
        message="Analyse en file d'attente",
        nombre_fichiers=len(fichiers),
        contexte=contexte,
        repertoire_temp=str(repertoire),
    )
    resultat_tache = executer_preanalyse_sources_projet.apply_async(
        args=[str(preanalyse.id)],
        queue="principale",
        routing_key="principale",
    )
    if resultat_tache and getattr(resultat_tache, "id", ""):
        preanalyse.tache_celery_id = resultat_tache.id
        preanalyse.save(update_fields=["tache_celery_id", "date_modification"])
    return Response(PreanalyseSourcesProjetSerialiseur(preanalyse).data, status=201)


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def vue_detail_preanalyse_sources_projet(requete, pk):
    queryset = PreanalyseSourcesProjet.objects.all()
    if not requete.user.est_super_admin:
        queryset = queryset.filter(utilisateur=requete.user)
    preanalyse = generics.get_object_or_404(queryset, pk=pk)
    return Response(PreanalyseSourcesProjetSerialiseur(preanalyse).data)


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def vue_qualification_documentaire_projet(requete, projet_id):
    """Retourne l'état documentaire d'un projet à partir de l'analyse réelle des pièces versées."""
    projet = generics.get_object_or_404(Projet, pk=projet_id)
    return Response(construire_bilan_documentaire_projet(projet))


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def vue_synthese_projet(requete, projet_id):
    """
    GET /api/projets/<uuid>/synthese/
    Synthèse agrégée du projet : documents, études, montants, progression de phase.
    Utilisée par le dashboard projet.
    """
    from applications.documents.models import Document
    from applications.economie.models import EtudeEconomique

    projet = generics.get_object_or_404(Projet, pk=projet_id)

    # Index de phase pour la jauge de progression (0 = début, 9 = clos)
    phase_code = normaliser_phase_projet(projet.phase_actuelle)
    phase_index = index_phase_projet(phase_code)

    nb_documents = Document.objects.filter(
        projet=projet, est_version_courante=True
    ).count()

    etudes = EtudeEconomique.objects.filter(projet=projet)
    nb_etudes = etudes.count()
    etudes_actives = etudes.filter(statut__in=["en_cours", "a_valider", "validee"])
    total_prix_vente = sum(float(e.total_prix_vente or 0) for e in etudes_actives)
    total_marge_nette = sum(float(e.total_marge_nette or 0) for e in etudes_actives)

    # Documents par statut
    from applications.documents.models import Document as Doc
    docs_qs = Doc.objects.filter(projet=projet, est_version_courante=True)
    nb_docs_valides = docs_qs.filter(statut="valide").count()
    nb_docs_brouillon = docs_qs.filter(statut="brouillon").count()

    # Activité récente (derniers documents et études modifiés)
    activite = []
    for doc in docs_qs.select_related("auteur").order_by("-date_modification")[:3]:
        activite.append({
            "type": "document",
            "libelle": doc.intitule,
            "statut": doc.statut,
            "utilisateur": doc.auteur.get_full_name() if hasattr(doc, "auteur") and doc.auteur else "—",
            "date": doc.date_modification.isoformat(),
        })
    for etude in etudes.order_by("-date_modification")[:3]:
        activite.append({
            "type": "etude",
            "libelle": etude.intitule,
            "statut": etude.statut,
            "utilisateur": "—",
            "date": etude.date_modification.isoformat(),
        })
    activite.sort(key=lambda x: x["date"], reverse=True)

    return Response({
        "nb_documents": nb_documents,
        "nb_docs_valides": nb_docs_valides,
        "nb_docs_brouillon": nb_docs_brouillon,
        "nb_etudes_economiques": nb_etudes,
        "total_prix_vente_etudes": total_prix_vente,
        "total_marge_nette_etudes": total_marge_nette,
        "phase_index": phase_index,
        "nb_phases": len(Projet.PHASES),
        "phase_code": phase_code,
        "phase_libelle": libelle_phase_projet(phase_code),
        "activite_recente": activite[:5],
    })


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def vue_appliquer_phase_suggeree(requete, projet_id):
    projet = generics.get_object_or_404(Projet, pk=projet_id)
    suggestion = construire_suggestion_phase_projet(projet)
    phase_code = suggestion.get("code") or ""

    if not phase_code:
        raise ValidationError({"detail": "Aucune phase suggérée ne peut être calculée pour ce projet."})

    phase_actuelle = normaliser_phase_projet(projet.phase_actuelle)
    if phase_code == phase_actuelle:
        return Response(
            {
                "detail": f"La phase officielle est déjà « {libelle_phase_projet(phase_code)} ».",
                "phase_actuelle": phase_code,
                "phase_libelle": libelle_phase_projet(phase_code),
            }
        )

    projet.phase_actuelle = phase_code
    projet.save(update_fields=["phase_actuelle", "date_modification"])

    return Response(
        {
            "detail": f"Phase actuelle mise à jour en « {libelle_phase_projet(phase_code)} ».",
            "projet": ProjetDetailSerialiseur(projet, context={"request": requete}).data,
        }
    )


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def vue_ressources_documentaires(requete):
    """
    GET /api/projets/ressources-documentaires/
    Liste les fichiers dans le volume /ressources (partage Samba monté en lecture seule).
    """
    import os

    chemin = "/ressources"
    fichiers = []
    if os.path.isdir(chemin):
        for nom in sorted(os.listdir(chemin)):
            chemin_complet = os.path.join(chemin, nom)
            if os.path.isfile(chemin_complet):
                stat = os.stat(chemin_complet)
                ext = os.path.splitext(nom)[1].lower()
                # Nom lisible : retirer les préfixes numériques et les tirets
                nom_base = os.path.splitext(nom)[0]
                nom_affichage = nom_base.replace("-", " ").replace("_", " ")
                # Retirer les préfixes numériques type "123456789-"
                import re
                nom_affichage = re.sub(r"^\d{5,}-", "", nom_affichage).strip()
                nom_affichage = nom_affichage[0].upper() + nom_affichage[1:] if nom_affichage else nom
                fichiers.append({
                    "nom": nom,
                    "nom_affichage": nom_affichage,
                    "extension": ext.lstrip("."),
                    "taille_octets": stat.st_size,
                    "type": "pdf" if ext == ".pdf" else ("tableur" if ext in (".xlsx", ".xls") else "texte"),
                })

    return Response({"fichiers": fichiers, "total": len(fichiers)})


# ─── Missions / Livrables ─────────────────────────────────────────────────────

@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def vue_missions_livrables(requete):
    """
    GET /api/projets/missions-livrables/
    Retourne la matrice des missions et leurs livrables associés,
    filtrée par famille_client, sous_type_client et nature_ouvrage.
    """
    famille = requete.query_params.get("famille_client", "")
    sous_type = requete.query_params.get("sous_type_client", "")
    nature = requete.query_params.get("nature_ouvrage", "")

    missions_qs = MissionClient.objects.filter(est_active=True).prefetch_related("livrables")

    if famille:
        missions_qs = missions_qs.filter(famille_client=famille)
    if nature:
        missions_qs = missions_qs.filter(
            nature_ouvrage__in=[nature, "tous"]
        )

    missions = []
    for m in missions_qs:
        # Filtrage sous-types
        if sous_type and m.sous_types_client and sous_type not in m.sous_types_client:
            continue

        livrables = [
            {
                "id": str(lv.id),
                "code": lv.code,
                "libelle": lv.libelle,
                "type_document": lv.type_document,
                "format_attendu": lv.format_attendu,
                "icone": lv.icone,
                "couleur": lv.couleur,
            }
            for lv in m.livrables.filter(est_active=True).order_by("ordre")
        ]

        missions.append({
            "id": str(m.id),
            "code": m.code,
            "libelle": m.libelle,
            "description": m.description,
            "famille_client": m.famille_client,
            "nature_ouvrage": m.nature_ouvrage,
            "phases_concernees": m.phases_concernees,
            "icone": m.icone,
            "couleur": m.couleur,
            "est_obligatoire": m.est_obligatoire,
            "livrables": livrables,
        })

    return Response({"count": len(missions), "missions": missions})


# ─── Modèles de documents ─────────────────────────────────────────────────────

@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def vue_modeles_documents(requete):
    """
    GET /api/projets/modeles-documents/
    Retourne les modèles de documents disponibles,
    filtrés par famille_client et/ou type_modele.
    """
    famille = requete.query_params.get("famille_client", "")
    type_modele = requete.query_params.get("type_modele", "")

    modeles_qs = ModeleDocument.objects.filter(est_actif=True).order_by("type_modele", "ordre")

    if type_modele:
        modeles_qs = modeles_qs.filter(type_modele=type_modele)

    modeles = []
    for modele in modeles_qs:
        # Filtrage famille client
        if famille and modele.familles_client and famille not in modele.familles_client:
            continue

        modeles.append({
            "id": str(modele.id),
            "code": modele.code,
            "libelle": modele.libelle,
            "type_modele": modele.type_modele,
            "type_modele_libelle": modele.get_type_modele_display(),
            "format_sortie": modele.format_sortie,
            "description": modele.description,
            "familles_client": modele.familles_client,
            "variables_parametrables": modele.variables_parametrables,
            "a_template": bool(modele.template_fichier),
            "apercu_url": modele.apercu_image.url if modele.apercu_image else None,
        })

    return Response({"count": len(modeles), "modeles": modeles})


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def vue_generer_depuis_modele(requete):
    """
    POST /api/projets/modeles-documents/<uuid>/generer/
    Génère un document dans la GED à partir d'un modèle paramétré.
    """
    modele_id = requete.data.get("modele_id")
    projet_id = requete.data.get("projet_id")
    variables = requete.data.get("variables", {})
    dossier_id = requete.data.get("dossier_id")

    if not modele_id or not projet_id:
        raise ValidationError({"detail": "modele_id et projet_id sont obligatoires."})

    modele = generics.get_object_or_404(ModeleDocument, pk=modele_id, est_actif=True)
    projet = generics.get_object_or_404(Projet, pk=projet_id)

    # Vérification des variables obligatoires
    manquantes = [
        v["code"] for v in modele.variables_parametrables
        if v.get("obligatoire") and not variables.get(v["code"])
    ]
    if manquantes:
        raise ValidationError({"variables": f"Variables obligatoires manquantes : {', '.join(manquantes)}"})

    # Création d'un document bureautique via l'API Collabora existante
    from applications.documents.views import creer_document_bureautique_depuis_modele
    try:
        document = creer_document_bureautique_depuis_modele(
            modele=modele,
            projet=projet,
            variables=variables,
            dossier_id=dossier_id,
            auteur=requete.user,
        )
        return Response({
            "id": str(document.id),
            "reference": document.reference,
            "intitule": document.intitule,
            "detail": "Document généré avec succès.",
        }, status=201)
    except Exception as exc:
        raise ValidationError({"detail": str(exc)}) from exc


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def vue_calculer_variation_prix(requete, projet_id):
    """
    POST /api/projets/<uuid>/variation-prix/calculer/
    Calcule le coefficient d'actualisation ou de révision selon le mode configuré.
    """
    from applications.projets.referentiels import mode_variation_pour_projet, reference_indice_par_code

    projet = generics.get_object_or_404(Projet, pk=projet_id)
    mode = mode_variation_pour_projet(projet)

    if not mode or mode.get("type_evolution") == "aucune":
        return Response({"detail": "Aucun mode de variation de prix configuré.", "coefficient": None})

    type_evolution = mode.get("type_evolution", "aucune")
    indice_code = mode.get("indice_reference", "")
    part_fixe_str = mode.get("part_fixe", "") or "0"
    try:
        part_fixe = float(part_fixe_str) / 100.0
    except (ValueError, TypeError):
        part_fixe = 0.0

    ref = reference_indice_par_code(indice_code) if indice_code else None
    valeur_actuelle = None
    if ref and ref.get("derniere_valeur"):
        valeur_actuelle = ref["derniere_valeur"].get("valeur")

    resultat = {
        "type_evolution": type_evolution,
        "indice_reference": indice_code,
        "valeur_actuelle": valeur_actuelle,
        "date_valeur_actuelle": ref["derniere_valeur"].get("date_valeur") if ref and ref.get("derniere_valeur") else None,
        "part_fixe": float(part_fixe_str),
        "coefficient": None,
        "formule_appliquee": None,
        "avertissement": None,
    }

    if valeur_actuelle is None:
        resultat["avertissement"] = f"Indice {indice_code} introuvable ou sans valeur publiée."
        return Response(resultat)

    # Calcul du coefficient
    formule_personnalisee = mode.get("formule_personnalisee", "")
    if formule_personnalisee:
        resultat["formule_appliquee"] = formule_personnalisee
        resultat["avertissement"] = "La formule personnalisée nécessite une évaluation manuelle."
    else:
        # Formule standard : Ko = part_fixe + (1 - part_fixe) * (Io / I0)
        # Sans I0 connu, on retourne I_actuel et la formule à titre indicatif
        resultat["formule_appliquee"] = (
            f"Ko = {part_fixe:.2f} + {(1 - part_fixe):.2f} × (I_actuel / I_initial)"
        )
        resultat["avertissement"] = (
            "I_initial requis (date de prix initial) pour calculer Ko. "
            f"Valeur actuelle {indice_code} : {valeur_actuelle}."
        )

    # Sauvegarder la valeur actuelle dans l'historique si souhaité
    sauvegarder = requete.data.get("sauvegarder", False)
    if sauvegarder and ref:
        qualification = dict(projet.qualification_wizard or {})
        mode_persiste = qualification.get("mode_variation_prix", {})
        historique = list(mode_persiste.get("historique_valeurs", []))
        historique.append({
            "date": ref["derniere_valeur"]["date_valeur"],
            "indice": indice_code,
            "valeur": valeur_actuelle,
            "enregistre_le": __import__("datetime").date.today().isoformat(),
        })
        mode_persiste["historique_valeurs"] = historique[-12:]  # 12 entrées max
        qualification["mode_variation_prix"] = mode_persiste
        projet.qualification_wizard = qualification
        projet.save(update_fields=["qualification_wizard", "date_modification"])

    return Response(resultat)


@api_view(["GET", "PATCH"])
@permission_classes([permissions.IsAuthenticated])
def vue_statuts_livrables(requete, projet_id):
    """Lecture et mise à jour des statuts de livrables d'un projet."""
    from django.shortcuts import get_object_or_404
    projet = get_object_or_404(Projet, pk=projet_id)

    if requete.method == "GET":
        statuts = dict(projet.qualification_wizard or {}).get("statuts_livrables", {})
        return Response(statuts)

    # PATCH : mise à jour partielle
    qualification = dict(projet.qualification_wizard or {})
    statuts = dict(qualification.get("statuts_livrables", {}))
    statuts.update(requete.data)
    qualification["statuts_livrables"] = statuts
    projet.qualification_wizard = qualification
    projet.save(update_fields=["qualification_wizard", "date_modification"])
    return Response(statuts)
