"""Vues API pour les programmes bâtiment — Plateforme LBH."""

import sys
import os

from rest_framework import generics, permissions, status, filters
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from .models import ProgrammeBatiment, LocalProgramme
from .serialiseurs import ProgrammeBatimentSerialiseur, LocalProgrammeSerialiseur


class VueListeProgrammesBatiment(generics.ListCreateAPIView):
    """Liste et création de programmes bâtiment."""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ProgrammeBatimentSerialiseur
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["intitule", "projet__reference", "type_batiment"]
    ordering = ["-date_modification"]

    def get_queryset(self):
        qs = ProgrammeBatiment.objects.select_related("projet").prefetch_related("locaux")
        projet_id = self.request.query_params.get("projet")
        if projet_id:
            qs = qs.filter(projet_id=projet_id)
        return qs


class VueDetailProgrammeBatiment(generics.RetrieveUpdateDestroyAPIView):
    """Détail, modification et suppression d'un programme bâtiment."""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ProgrammeBatimentSerialiseur

    def get_queryset(self):
        return ProgrammeBatiment.objects.select_related("projet").prefetch_related("locaux")


class VueListeLocaux(generics.ListCreateAPIView):
    """Locaux d'un programme bâtiment."""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = LocalProgrammeSerialiseur

    def get_queryset(self):
        return LocalProgramme.objects.filter(programme_id=self.kwargs["programme_id"])

    def perform_create(self, serializer):
        programme = generics.get_object_or_404(
            ProgrammeBatiment, pk=self.kwargs["programme_id"]
        )
        serializer.save(programme=programme)


class VueDetailLocal(generics.RetrieveUpdateDestroyAPIView):
    """Détail, modification et suppression d'un local."""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = LocalProgrammeSerialiseur

    def get_queryset(self):
        return LocalProgramme.objects.filter(programme_id=self.kwargs["programme_id"])


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def vue_calculer_batiment(request, pk):
    """
    Pré-dimensionne un programme bâtiment : calcule les surfaces totales
    et estime le coût global HT à partir des coûts unitaires paramétrés.
    """
    programme = generics.get_object_or_404(
        ProgrammeBatiment.objects.prefetch_related("locaux"), pk=pk
    )

    try:
        racine = os.path.dirname(
            os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        )
        if racine not in sys.path:
            sys.path.insert(0, racine)

        from calculs.batiment.moteur_presizing import calculer_programme
        from applications.parametres.models import Parametre

        def _param(cle: str, defaut):
            try:
                return Parametre.objects.get(cle=cle).valeur_typee()
            except Exception:
                return defaut

        couts_unitaires = _param(
            f"BATIMENT_COUT_M2_{programme.type_batiment.upper()}",
            _param("BATIMENT_COUT_M2_DEFAUT", 1500.0),
        )

        resultat = calculer_programme(programme, couts_unitaires)

        programme.shon_totale = resultat.get("shon_totale")
        programme.cout_estime_ht = resultat.get("cout_estime_ht")
        programme.cout_par_m2_shon_ht = resultat.get("cout_par_m2_shon_ht")
        programme.save(update_fields=["shon_totale", "cout_estime_ht", "cout_par_m2_shon_ht"])

        return Response({
            "detail": "Calcul effectué avec succès.",
            "resultats": resultat,
        })

    except ImportError as exc:
        return Response(
            {"detail": f"Moteur de calcul indisponible : {exc}"},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )
    except Exception as exc:
        return Response(
            {"detail": f"Erreur lors du calcul : {exc}"},
            status=status.HTTP_400_BAD_REQUEST,
        )
