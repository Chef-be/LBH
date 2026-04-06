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

from .models import Projet, Lot, Intervenant, PreanalyseSourcesProjet
from .serialiseurs import (
    ProjetListeSerialiseur,
    ProjetDetailSerialiseur,
    LotSerialiseur,
    IntervenantSerialiseur,
    PreanalyseSourcesProjetSerialiseur,
)
from .services import construire_bilan_documentaire_projet, construire_processus_recommande
from .referentiels import construire_parcours_projet, lister_references_indices_prix
from .taches import executer_preanalyse_sources_projet, importer_sources_preanalyse_dans_projet
from applications.documents.services import synchroniser_dossiers_projet


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
