"""Vues API pour les métrés — Plateforme LBH."""

import math
from decimal import Decimal

from rest_framework import generics, permissions, status, filters
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from .models import Metre, LigneMetre, FondPlan, ZoneMesure, ExtractionCAO
from .serialiseurs import (
    MetreListeSerialiseur, MetreDetailSerialiseur, LigneMetre_Serialiseur,
    FondPlanSerialiseur, ZoneMesureSerialiseur, ExtractionCAOSerialiseur,
)
from .services import analyser_detail_calcul, calculer_zone_mesure, creer_ligne_depuis_zone


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
        from django.db.models import Max
        metre = generics.get_object_or_404(Metre, pk=self.kwargs["metre_id"])
        numero_ordre = serializer.validated_data.get("numero_ordre") or 0
        if numero_ordre == 0:
            agg = metre.lignes.aggregate(max_ordre=Max("numero_ordre"))
            numero_ordre = (agg["max_ordre"] or 0) + 1
        serializer.save(metre=metre, numero_ordre=numero_ordre)


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


# ---------------------------------------------------------------------------
# Fonds de plan
# ---------------------------------------------------------------------------

class VueListeFondsPlans(generics.ListCreateAPIView):
    """Liste et téléversement des fonds de plan d'un métré."""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = FondPlanSerialiseur
    pagination_class = None  # Retourner toujours la liste complète (jamais paginée)

    def get_queryset(self):
        return FondPlan.objects.filter(
            metre_id=self.kwargs["metre_id"]
        ).prefetch_related("zones")

    def perform_create(self, serializer):
        metre = generics.get_object_or_404(Metre, pk=self.kwargs["metre_id"])
        serializer.save(metre=metre, cree_par=self.request.user)


class VueDetailFondPlan(generics.RetrieveUpdateDestroyAPIView):
    """Détail, mise à jour et suppression d'un fond de plan."""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = FondPlanSerialiseur

    def get_queryset(self):
        return FondPlan.objects.filter(metre_id=self.kwargs["metre_id"])


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def vue_calibrer_fond_plan(request, metre_id, pk):
    """
    Définit l'échelle d'un fond de plan depuis deux points connus.
    Corps attendu : {point_a: [x, y], point_b: [x, y], distance_metres: float}
    """
    fond = generics.get_object_or_404(FondPlan, pk=pk, metre_id=metre_id)

    point_a = request.data.get("point_a")
    point_b = request.data.get("point_b")
    distance_metres = request.data.get("distance_metres")

    if not (point_a and point_b and distance_metres):
        return Response(
            {"detail": "Les champs point_a, point_b et distance_metres sont requis."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        distance_metres = float(distance_metres)
        dx = float(point_b[0]) - float(point_a[0])
        dy = float(point_b[1]) - float(point_a[1])
        distance_px = math.sqrt(dx ** 2 + dy ** 2)
    except (TypeError, ValueError, IndexError) as exc:
        return Response({"detail": f"Données de calibration invalides : {exc}"},
                        status=status.HTTP_400_BAD_REQUEST)

    if distance_metres <= 0 or distance_px <= 0:
        return Response(
            {"detail": "La distance en mètres et la distance en pixels doivent être positives."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    echelle = distance_px / distance_metres
    fond.echelle = Decimal(str(round(echelle, 6)))
    fond.reference_calibration = {
        "point_a": point_a,
        "point_b": point_b,
        "distance_metres": distance_metres,
        "distance_px": round(distance_px, 2),
    }
    fond.save(update_fields=["echelle", "reference_calibration"])

    return Response({
        "echelle": float(fond.echelle),
        "distance_px": round(distance_px, 2),
        "distance_metres": distance_metres,
        "detail": f"Échelle calibrée : {fond.echelle:.4f} px/m",
    })


# ---------------------------------------------------------------------------
# Zones de mesure
# ---------------------------------------------------------------------------

class VueListeZonesMesure(generics.ListCreateAPIView):
    """CRUD des zones de mesure sur un fond de plan."""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ZoneMesureSerialiseur
    pagination_class = None  # Retourner toujours la liste complète

    def get_queryset(self):
        return ZoneMesure.objects.filter(
            fond_plan_id=self.kwargs["fond_plan_id"]
        ).select_related("fond_plan", "ligne_metre")

    def perform_create(self, serializer):
        fond = generics.get_object_or_404(FondPlan, pk=self.kwargs["fond_plan_id"])
        serializer.save(fond_plan=fond)


class VueDetailZoneMesure(generics.RetrieveUpdateDestroyAPIView):
    """Détail, mise à jour et suppression d'une zone de mesure."""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ZoneMesureSerialiseur

    def get_queryset(self):
        return ZoneMesure.objects.filter(fond_plan_id=self.kwargs["fond_plan_id"])


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def vue_calculer_zone(request, fond_plan_id, pk):
    """Calcule et enregistre les valeurs métriques d'une zone (brute, déductions, nette)."""
    zone = generics.get_object_or_404(ZoneMesure, pk=pk, fond_plan_id=fond_plan_id)

    if not zone.fond_plan.echelle:
        return Response(
            {"detail": "Le fond de plan n'est pas calibré. Définissez l'échelle avant de calculer."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    resultats = calculer_zone_mesure(zone)
    zone.valeur_brute = Decimal(str(resultats["valeur_brute"]))
    zone.valeur_deduction = Decimal(str(resultats["valeur_deduction"]))
    zone.valeur_nette = Decimal(str(resultats["valeur_nette"]))
    zone.unite = resultats["unite"]
    zone.save(update_fields=["valeur_brute", "valeur_deduction", "valeur_nette", "unite"])

    return Response(resultats)


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def vue_valider_zones_en_lignes(request, metre_id):
    """
    Convertit toutes les zones calculées d'un métré en lignes de métré.
    Paramètre optionnel : fond_plan_id pour limiter à un fond de plan.
    """
    metre = generics.get_object_or_404(Metre, pk=metre_id)
    fond_plan_id = request.data.get("fond_plan_id")

    zones_qs = ZoneMesure.objects.filter(
        fond_plan__metre=metre,
        ligne_metre__isnull=True,
    ).select_related("fond_plan")

    if fond_plan_id:
        zones_qs = zones_qs.filter(fond_plan_id=fond_plan_id)

    zones = list(zones_qs.order_by("fond_plan", "zone_parente__ordre", "ordre"))
    if not zones:
        return Response({"detail": "Aucune zone non encore convertie.", "nb_lignes": 0})

    # Numérotation à la suite des lignes existantes
    from django.db.models import Max
    agg = metre.lignes.aggregate(max_ordre=Max("numero_ordre"))
    prochain_ordre = (agg["max_ordre"] or 0) + 1

    lignes_creees = []
    for zone in zones:
        if not zone.fond_plan.echelle:
            continue
        ligne = creer_ligne_depuis_zone(zone, metre, prochain_ordre)
        lignes_creees.append(ligne.id)
        prochain_ordre += 1

    serialiseur = LigneMetre_Serialiseur(
        metre.lignes.filter(id__in=lignes_creees),
        many=True, context={"request": request},
    )
    return Response({
        "nb_lignes": len(lignes_creees),
        "lignes": serialiseur.data,
    }, status=status.HTTP_201_CREATED)
