"""Vues API pour les métrés — Plateforme LBH."""

from rest_framework import generics, permissions, status, filters
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from .models import Metre, LigneMetre
from .serialiseurs import MetreListeSerialiseur, MetreDetailSerialiseur, LigneMetre_Serialiseur
from .services import analyser_detail_calcul


class VueListeMetres(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["intitule", "projet__reference"]
    ordering = ["-date_modification"]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return MetreDetailSerialiseur
        return MetreListeSerialiseur

    def get_queryset(self):
        qs = Metre.objects.select_related("projet", "lot", "cree_par")
        projet_id = self.request.query_params.get("projet")
        if projet_id:
            qs = qs.filter(projet_id=projet_id)
        type_metre = self.request.query_params.get("type")
        if type_metre:
            qs = qs.filter(type_metre=type_metre)
        return qs

    def perform_create(self, serializer):
        serializer.save(cree_par=self.request.user)


class VueDetailMetre(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = MetreDetailSerialiseur

    def get_queryset(self):
        return Metre.objects.select_related("projet", "lot").prefetch_related("lignes")

    def destroy(self, request, *args, **kwargs):
        metre = self.get_object()
        if metre.statut == "valide":
            return Response(
                {"detail": "Un métré validé ne peut pas être supprimé."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        metre.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class VueListeLignesMetres(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = LigneMetre_Serialiseur
    ordering = ["numero_ordre"]

    def get_queryset(self):
        return LigneMetre.objects.filter(
            metre_id=self.kwargs["metre_id"]
        ).select_related("ligne_bibliotheque")

    def perform_create(self, serializer):
        metre = generics.get_object_or_404(Metre, pk=self.kwargs["metre_id"])
        serializer.save(metre=metre)


class VueDetailLigneMetre(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = LigneMetre_Serialiseur

    def get_queryset(self):
        return LigneMetre.objects.filter(metre_id=self.kwargs["metre_id"])


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def vue_valider_metre(request, pk):
    metre = generics.get_object_or_404(Metre, pk=pk)
    metre.statut = "valide"
    metre.save(update_fields=["statut"])
    return Response({"detail": "Métré validé."})


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def vue_importer_depuis_bibliotheque(request, metre_id):
    """Importe une ligne de la bibliothèque de prix dans le métré."""
    metre = generics.get_object_or_404(Metre, pk=metre_id)

    bibliotheque_id = request.data.get("bibliotheque_id")
    quantite = request.data.get("quantite", 0)
    numero_ordre = request.data.get("numero_ordre", 1)

    if not bibliotheque_id:
        return Response(
            {"detail": "Le champ « bibliotheque_id » est requis."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    from applications.bibliotheque.models import LignePrixBibliotheque
    entree = generics.get_object_or_404(LignePrixBibliotheque, pk=bibliotheque_id)

    ligne = LigneMetre.objects.create(
        metre=metre,
        numero_ordre=numero_ordre,
        code_article=entree.code,
        designation=entree.designation_longue or entree.designation_courte,
        nature="travaux",
        quantite=quantite,
        unite=entree.unite,
        prix_unitaire_ht=entree.prix_vente_unitaire or None,
        ligne_bibliotheque=entree,
    )

    serialiseur = LigneMetre_Serialiseur(ligne, context={"request": request})
    return Response(serialiseur.data, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def vue_apercu_calcul_metre(request):
    detail_calcul = request.data.get("detail_calcul", "")
    if not str(detail_calcul).strip():
        return Response(
            {"detail": "Le champ « detail_calcul » est requis."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        return Response(analyser_detail_calcul(str(detail_calcul)))
    except ValueError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
