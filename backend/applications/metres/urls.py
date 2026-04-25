"""Routes URL pour les métrés — Plateforme LBH."""

from django.urls import path
from . import views

urlpatterns = [
    path("", views.VueListeMetres.as_view(), name="metres-liste"),
    path("apercu-calcul/", views.vue_apercu_calcul_metre, name="metres-apercu-calcul"),
    path("<uuid:pk>/", views.VueDetailMetre.as_view(), name="metre-detail"),
    path("<uuid:pk>/valider/", views.vue_valider_metre, name="metre-valider"),
    path("<uuid:metre_id>/lignes/", views.VueListeLignesMetres.as_view(), name="lignes-metre-liste"),
    path("<uuid:metre_id>/lignes/<uuid:pk>/", views.VueDetailLigneMetre.as_view(), name="ligne-metre-detail"),
    path("<uuid:metre_id>/importer-bibliotheque/", views.vue_importer_depuis_bibliotheque, name="metre-importer"),

    # Fonds de plan
    path("<uuid:metre_id>/fonds-plan/", views.VueListeFondsPlans.as_view(), name="fonds-plan-liste"),
    path("<uuid:metre_id>/fonds-plan/<uuid:pk>/", views.VueDetailFondPlan.as_view(), name="fond-plan-detail"),
    path("<uuid:metre_id>/fonds-plan/<uuid:pk>/calibrer/", views.vue_calibrer_fond_plan, name="fond-plan-calibrer"),
    path("<uuid:metre_id>/fonds-plan/<uuid:pk>/geometrie/", views.vue_geometrie_fond_plan, name="fond-plan-geometrie"),

    # Zones de mesure
    path("<uuid:metre_id>/fonds-plan/<uuid:fond_plan_id>/zones/", views.VueListeZonesMesure.as_view(), name="zones-mesure-liste"),
    path("<uuid:metre_id>/fonds-plan/<uuid:fond_plan_id>/zones/<uuid:pk>/", views.VueDetailZoneMesure.as_view(), name="zone-mesure-detail"),
    path("<uuid:metre_id>/fonds-plan/<uuid:fond_plan_id>/zones/<uuid:pk>/calculer/", views.vue_calculer_zone, name="zone-mesure-calculer"),

    # Conversion zones -> lignes
    path("<uuid:metre_id>/valider-zones/", views.vue_valider_zones_en_lignes, name="metre-valider-zones"),
]
