"""
Vues API pour les projets — Plateforme BEE.
"""

from rest_framework import generics, permissions, filters
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from .models import Projet, Lot, Intervenant
from .serialiseurs import (
    ProjetListeSerialiseur,
    ProjetDetailSerialiseur,
    LotSerialiseur,
    IntervenantSerialiseur,
)
from .services import construire_bilan_documentaire_projet, construire_processus_recommande
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
def vue_qualification_documentaire_projet(requete, projet_id):
    """Retourne l'état documentaire d'un projet à partir de l'analyse réelle des pièces versées."""
    projet = generics.get_object_or_404(Projet, pk=projet_id)
    return Response(construire_bilan_documentaire_projet(projet))
