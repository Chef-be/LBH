"""Routes URL pour les métrés — Plateforme LBH."""

from django.urls import path
from . import views

urlpatterns = [
    path("", views.VueListeMetres.as_view(), name="metres-liste"),
    path("apercu-calcul/", views.vue_apercu_calcul_metre, name="metres-apercu-calcul"),
    path("<uuid:pk>/", views.VueDetailMetre.as_view(), name="metre-detail"),
    path("<uuid:pk>/valider/", views.vue_valider_metre, name="metre-valider"),
    path("<uuid:pk>/controle-coherence/", views.vue_controle_coherence, name="metre-controle-coherence"),
    path("<uuid:pk>/previsualiser-dpgf/", views.vue_previsualiser_dpgf, name="metre-previsualiser-dpgf"),
    path("<uuid:pk>/generer-dpgf/", views.vue_generer_dpgf, name="metre-generer-dpgf"),
    path("<uuid:pk>/synchroniser-zones/", views.vue_synchroniser_zones_metre, name="metre-synchroniser-zones"),
    path("<uuid:metre_id>/lignes/", views.VueListeLignesMetres.as_view(), name="lignes-metre-liste"),
    path("<uuid:metre_id>/lignes/<uuid:pk>/", views.VueDetailLigneMetre.as_view(), name="ligne-metre-detail"),
    path("<uuid:metre_id>/importer-bibliotheque/", views.vue_importer_depuis_bibliotheque, name="metre-importer"),

    # Fonds de plan
    path("<uuid:metre_id>/fonds-plan/", views.VueListeFondsPlans.as_view(), name="fonds-plan-liste"),
    path("<uuid:metre_id>/fonds-plan/<uuid:pk>/", views.VueDetailFondPlan.as_view(), name="fond-plan-detail"),
    path("<uuid:metre_id>/fonds-plan/<uuid:pk>/calibrer/", views.vue_calibrer_fond_plan, name="fond-plan-calibrer"),
    path("<uuid:metre_id>/fonds-plan/<uuid:pk>/appliquer-calibration/", views.vue_calibrer_fond_plan, name="fond-plan-appliquer-calibration"),
    path("<uuid:metre_id>/fonds-plan/<uuid:pk>/generer-apercus/", views.vue_generer_apercus_fond_plan, name="fond-plan-generer-apercus"),
    path("<uuid:metre_id>/fonds-plan/<uuid:pk>/vectoriser/", views.vue_vectoriser_fond_plan, name="fond-plan-vectoriser"),
    path("<uuid:metre_id>/fonds-plan/<uuid:pk>/geometrie/", views.vue_geometrie_stockee_fond_plan, name="fond-plan-geometrie"),
    path("<uuid:metre_id>/fonds-plan/<uuid:pk>/points-accroche/", views.vue_points_accroche_fond_plan, name="fond-plan-points-accroche"),
    path("<uuid:metre_id>/fonds-plan/<uuid:pk>/echelle-auto/", views.vue_echelle_auto_fond_plan, name="fond-plan-echelle-auto"),
    path("<uuid:metre_id>/fonds-plan/<uuid:pk>/detecter-echelle/", views.vue_echelle_auto_fond_plan, name="fond-plan-detecter-echelle"),

    # Zones de mesure
    path("<uuid:metre_id>/fonds-plan/<uuid:fond_plan_id>/zones/", views.VueListeZonesMesure.as_view(), name="zones-mesure-liste"),
    path("<uuid:metre_id>/fonds-plan/<uuid:fond_plan_id>/zones/creer-depuis-contour/", views.vue_creer_zone_depuis_contour, name="zone-creer-depuis-contour"),
    path("<uuid:metre_id>/fonds-plan/<uuid:fond_plan_id>/zones/creer-depuis-selection-vectorielle/", views.vue_creer_zone_depuis_contour, name="zone-creer-depuis-selection-vectorielle"),
    path("<uuid:metre_id>/fonds-plan/<uuid:fond_plan_id>/zones/<uuid:pk>/", views.VueDetailZoneMesure.as_view(), name="zone-mesure-detail"),
    path("<uuid:metre_id>/fonds-plan/<uuid:fond_plan_id>/zones/<uuid:pk>/calculer/", views.vue_calculer_zone, name="zone-mesure-calculer"),
    path("<uuid:metre_id>/fonds-plan/<uuid:fond_plan_id>/zones/<uuid:pk>/synchroniser-ligne/", views.vue_synchroniser_ligne_zone, name="zone-synchroniser-ligne"),

    # Conversion zones -> lignes
    path("<uuid:metre_id>/valider-zones/", views.vue_valider_zones_en_lignes, name="metre-valider-zones"),

    # DPGF quantitative sans prix
    path("dpgf/<uuid:pk>/", views.VueDetailDPGFQuantitative.as_view(), name="dpgf-quantitative-detail"),
    path("dpgf/<uuid:pk>/transmettre-economie/", views.vue_transmettre_dpgf_economie, name="dpgf-transmettre-economie"),
]
