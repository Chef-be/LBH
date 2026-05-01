"""Vues API pour les métrés — Plateforme LBH."""

import math
from decimal import Decimal

from rest_framework import generics, permissions, status, filters
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from .models import Metre, LigneMetre, FondPlan, ZoneMesure, ExtractionCAO, GeometrieFondPlan, DPGFQuantitative
from .serialiseurs import (
    MetreListeSerialiseur, MetreDetailSerialiseur, LigneMetre_Serialiseur,
    FondPlanSerialiseur, ZoneMesureSerialiseur, ExtractionCAOSerialiseur,
    GeometrieFondPlanSerialiseur, DPGFQuantitativeSerialiseur,
)
from .services import (
    analyser_detail_calcul,
    calculer_zone_mesure,
    controle_coherence_metre,
    creer_ligne_depuis_zone,
    extraire_et_stocker_geometrie_fond_plan,
    generer_dpgf_quantitative,
    previsualiser_dpgf_metre,
    synchroniser_ligne_depuis_zone,
    synchroniser_zones_metre,
)


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
        ).select_related("ligne_bibliotheque", "article_cctp", "source_fond_plan", "source_zone_mesure")

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


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def vue_controle_coherence(request, pk):
    metre = generics.get_object_or_404(Metre, pk=pk)
    return Response(controle_coherence_metre(metre))


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def vue_previsualiser_dpgf(request, pk):
    metre = generics.get_object_or_404(Metre, pk=pk)
    return Response(previsualiser_dpgf_metre(metre))


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def vue_generer_dpgf(request, pk):
    metre = generics.get_object_or_404(Metre, pk=pk)
    try:
        dpgf = generer_dpgf_quantitative(metre, cree_par=request.user, forcer=bool(request.data.get("forcer")))
    except ValueError as exc:
        return Response({"detail": str(exc), "controle": controle_coherence_metre(metre)}, status=status.HTTP_400_BAD_REQUEST)
    nb_lignes = dpgf.lignes.count()
    lignes_a_completer = dpgf.lignes.filter(statut="a_completer").count()
    return Response({
        "detail": "DPGF générée depuis l'avant-métré.",
        "dpgf_id": str(dpgf.id),
        "nb_lignes": nb_lignes,
        "lignes_a_completer": lignes_a_completer,
    }, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def vue_synchroniser_zones_metre(request, pk):
    metre = generics.get_object_or_404(Metre, pk=pk)
    lignes = synchroniser_zones_metre(metre)
    return Response({"detail": "Zones synchronisées.", "nb_lignes": len(lignes)})


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def vue_importer_depuis_bibliotheque(request, metre_id):
    """Compatibilité historique : importe une ligne de prix sans rendre le prix obligatoire."""
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
        ligne_bibliotheque=entree,
        designation_source="importee",
        source_type="import",
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


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def vue_echelle_auto_fond_plan(request, metre_id, pk):
    """Détecte automatiquement l'échelle d'un fond de plan (DXF → $INSUNITS, PDF → taille papier)."""
    from .services import detecter_echelle_auto
    fond = generics.get_object_or_404(FondPlan, pk=pk, metre_id=metre_id)
    return Response(detecter_echelle_auto(fond))


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def vue_geometrie_fond_plan(request, metre_id, pk):
    """
    Retourne les points d'accroche du DXF en coordonnées normalisées [0,1].
    Utilisé par le canvas pour le snapping (accroche objet).
    """
    from .services import extraire_geometrie_fond_plan
    fond = generics.get_object_or_404(FondPlan, pk=pk, metre_id=metre_id)
    return Response(extraire_geometrie_fond_plan(fond))


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
    fond.echelle_x = Decimal(str(round(echelle, 6)))
    fond.echelle_y = Decimal(str(round(echelle, 6)))
    fond.statut_calibration = "calibre"
    fond.reference_calibration = {
        "point_a": point_a,
        "point_b": point_b,
        "distance_metres": distance_metres,
        "distance_px": round(distance_px, 2),
    }
    fond.save(update_fields=["echelle", "echelle_x", "echelle_y", "statut_calibration", "reference_calibration"])

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
def vue_calculer_zone(request, metre_id, fond_plan_id, pk):
    """Calcule et enregistre les valeurs métriques d'une zone (brute, déductions, nette)."""
    zone = generics.get_object_or_404(ZoneMesure, pk=pk, fond_plan_id=fond_plan_id, fond_plan__metre_id=metre_id)

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
    from django.utils import timezone
    zone.statut_calcul = "calculee"
    zone.date_dernier_calcul = timezone.now()
    zone.message_erreur_calcul = ""
    zone.save(update_fields=[
        "valeur_brute", "valeur_deduction", "valeur_nette", "unite",
        "statut_calcul", "date_dernier_calcul", "message_erreur_calcul",
    ])

    return Response(resultats)


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def vue_synchroniser_ligne_zone(request, metre_id, fond_plan_id, pk):
    zone = generics.get_object_or_404(ZoneMesure, pk=pk, fond_plan_id=fond_plan_id, fond_plan__metre_id=metre_id)
    try:
        ligne = synchroniser_ligne_depuis_zone(zone)
    except ValueError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    return Response(LigneMetre_Serialiseur(ligne, context={"request": request}).data)


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def vue_creer_zone_depuis_contour(request, metre_id, fond_plan_id):
    fond = generics.get_object_or_404(FondPlan, pk=fond_plan_id, metre_id=metre_id)
    points = request.data.get("points_px") or request.data.get("points") or []
    if len(points) < 2:
        return Response({"detail": "Une sélection vectorielle doit contenir au moins deux points."}, status=status.HTTP_400_BAD_REQUEST)
    zone = ZoneMesure.objects.create(
        fond_plan=fond,
        designation=request.data.get("designation") or "Contour détecté",
        localisation=request.data.get("localisation") or "",
        type_mesure=request.data.get("type_mesure") or ("surface" if len(points) >= 3 else "longueur"),
        points_px=points,
        source_article_cctp="zone_visuelle",
    )
    return Response(ZoneMesureSerialiseur(zone, context={"request": request}).data, status=status.HTTP_201_CREATED)


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


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def vue_generer_apercus_fond_plan(request, metre_id, pk):
    fond = generics.get_object_or_404(FondPlan, pk=pk, metre_id=metre_id)
    from .taches import tache_generer_apercus_fond_plan
    fond.statut_traitement = "rendu_en_cours"
    fond.message_traitement = ""
    fond.save(update_fields=["statut_traitement", "message_traitement"])
    tache_generer_apercus_fond_plan.delay(str(fond.id))
    return Response({"detail": "Génération des aperçus lancée.", "statut_traitement": fond.statut_traitement})


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def vue_vectoriser_fond_plan(request, metre_id, pk):
    fond = generics.get_object_or_404(FondPlan, pk=pk, metre_id=metre_id)
    synchrone = request.data.get("synchrone") is True
    fond.statut_vectorisation = "en_cours"
    fond.message_vectorisation = ""
    fond.save(update_fields=["statut_vectorisation", "message_vectorisation"])
    if synchrone:
        return Response(extraire_et_stocker_geometrie_fond_plan(fond))
    from .taches import tache_vectoriser_fond_plan
    tache_vectoriser_fond_plan.delay(str(fond.id))
    return Response({"statut": "en_cours", "detail": "Vectorisation lancée."})


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def vue_geometrie_stockee_fond_plan(request, metre_id, pk):
    fond = generics.get_object_or_404(FondPlan, pk=pk, metre_id=metre_id)
    geometrie = GeometrieFondPlan.objects.filter(fond_plan=fond).order_by("-date_generation").first()
    if not geometrie:
        return Response(extraire_et_stocker_geometrie_fond_plan(fond))
    return Response(GeometrieFondPlanSerialiseur(geometrie, context={"request": request}).data)


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def vue_points_accroche_fond_plan(request, metre_id, pk):
    fond = generics.get_object_or_404(FondPlan, pk=pk, metre_id=metre_id)
    geometrie = GeometrieFondPlan.objects.filter(fond_plan=fond, statut="disponible").order_by("-date_generation").first()
    if geometrie:
        return Response({"points": geometrie.points_accroche, "nb_points": len(geometrie.points_accroche)})
    from .services import extraire_geometrie_fond_plan
    donnees = extraire_geometrie_fond_plan(fond)
    points = donnees.get("points", [])
    return Response({"points": points, "nb_points": len(points)})


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def vue_transmettre_dpgf_economie(request, pk):
    dpgf = generics.get_object_or_404(DPGFQuantitative, pk=pk)
    dpgf.statut = "transmise_economie"
    dpgf.save(update_fields=["statut", "date_modification"])
    return Response({
        "detail": "DPGF quantitative transmise au module Économie pour chiffrage ultérieur.",
        "dpgf_id": str(dpgf.id),
    })


class VueDetailDPGFQuantitative(generics.RetrieveUpdateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = DPGFQuantitativeSerialiseur
    queryset = DPGFQuantitative.objects.select_related("projet", "metre_source").prefetch_related("lignes")
