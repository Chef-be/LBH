"""Vues API pour les appels d'offres — Plateforme LBH."""

from rest_framework import generics, permissions, status, filters
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from .models import AppelOffres, OffreEntreprise
from .serialiseurs import (
    AppelOffresListeSerialiseur,
    AppelOffresDetailSerialiseur,
    OffreEntrepriseSerialiseur,
)


class VueListeAppelsOffres(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["intitule", "projet__reference", "type_procedure"]
    ordering = ["-date_creation"]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return AppelOffresDetailSerialiseur
        return AppelOffresListeSerialiseur

    def get_queryset(self):
        qs = AppelOffres.objects.select_related("projet", "lot").prefetch_related("offres")
        projet_id = self.request.query_params.get("projet")
        if projet_id:
            qs = qs.filter(projet_id=projet_id)
        statut = self.request.query_params.get("statut")
        if statut:
            qs = qs.filter(statut=statut)
        return qs


class VueDetailAppelOffres(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = AppelOffresDetailSerialiseur

    def get_queryset(self):
        return AppelOffres.objects.select_related("projet", "lot").prefetch_related(
            "offres__entreprise"
        )

    def destroy(self, request, *args, **kwargs):
        ao = self.get_object()
        if ao.statut in ("attribue", "publie"):
            return Response(
                {"detail": "Un appel d'offres publié ou attribué ne peut pas être supprimé."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        ao.statut = "abandonne"
        ao.save(update_fields=["statut"])
        return Response({"detail": "Appel d'offres abandonné."})


class VueListeOffres(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = OffreEntrepriseSerialiseur

    def get_queryset(self):
        return OffreEntreprise.objects.filter(
            appel_offres_id=self.kwargs["ao_id"]
        ).select_related("entreprise")

    def perform_create(self, serializer):
        ao = generics.get_object_or_404(AppelOffres, pk=self.kwargs["ao_id"])
        serializer.save(appel_offres=ao)


class VueDetailOffre(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = OffreEntrepriseSerialiseur

    def get_queryset(self):
        return OffreEntreprise.objects.filter(appel_offres_id=self.kwargs["ao_id"])


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def vue_attribuer_marche(request, ao_id, offre_id):
    """Attribue le marché à une offre — marque les autres comme rejetées."""
    ao = generics.get_object_or_404(AppelOffres, pk=ao_id)
    offre = generics.get_object_or_404(OffreEntreprise, pk=offre_id, appel_offres=ao)

    OffreEntreprise.objects.filter(appel_offres=ao).exclude(pk=offre_id).update(statut="rejetee")
    offre.statut = "retenue"
    offre.save(update_fields=["statut"])

    ao.statut = "attribue"
    ao.save(update_fields=["statut"])

    return Response({"detail": f"Marché attribué à « {offre.entreprise.nom} »."})


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def vue_analyser_offres(request, ao_id):
    """Calcule la note globale de chaque offre selon les critères de jugement."""
    ao = generics.get_object_or_404(
        AppelOffres.objects.prefetch_related("offres"), pk=ao_id
    )

    if not ao.criteres_jugement:
        return Response(
            {"detail": "Aucun critère de jugement défini."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    total_poids = sum(c.get("ponderation_pct", 0) for c in ao.criteres_jugement)
    if total_poids == 0:
        return Response(
            {"detail": "La somme des pondérations est nulle."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    resultats = []
    for offre in ao.offres.all():
        note = 0.0
        for critere in ao.criteres_jugement:
            code = critere.get("code") or critere.get("libelle", "")
            poids = critere.get("ponderation_pct", 0) / total_poids
            note += poids * float(offre.notes_criteres.get(code, 0))

        offre.note_globale = round(note, 2)
        offre.save(update_fields=["note_globale"])
        resultats.append({
            "offre_id": str(offre.id),
            "entreprise": offre.entreprise.nom,
            "note_globale": float(offre.note_globale),
        })

    resultats.sort(key=lambda x: x["note_globale"], reverse=True)
    return Response({"resultats": resultats})
