"""Routes URL pour la section Ressources — Plateforme LBH."""

from django.urls import path
from . import views

urlpatterns = [
    # Indices BT/TP
    path("indices/", views.VueListeIndices.as_view(), name="ressources-indices"),
    path("indices/courants/", views.vue_indices_courants, name="ressources-indices-courants"),
    path("indices/recuperer-insee/", views.vue_recuperer_indices_insee, name="ressources-indices-insee"),
    path("indices/actualiser-montant/", views.vue_actualiser_montant_devis, name="ressources-actualiser-montant"),
    path("indices/<uuid:pk>/", views.VueDetailIndice.as_view(), name="ressources-indice-detail"),

    # Devis analysés
    path("devis/previsualiser/", views.vue_previsualiser_devis, name="ressources-devis-previsualiser"),
    path("devis/", views.VueListeDevis.as_view(), name="ressources-devis"),
    path("devis/<uuid:pk>/", views.VueDetailDevis.as_view(), name="ressources-devis-detail"),
    path("devis/<uuid:pk>/relancer/", views.vue_relancer_analyse, name="ressources-devis-relancer"),
    path("devis/<uuid:pk>/lignes/", views.vue_lignes_devis, name="ressources-devis-lignes"),
    path("devis/<uuid:pk>/texte-extrait/", views.vue_texte_extrait_devis, name="ressources-devis-texte-extrait"),
    path("devis/<uuid:pk>/mapping-manuel/", views.vue_mapping_manuel_devis, name="ressources-devis-mapping-manuel"),
    path("devis/<uuid:pk>/capitaliser/", views.vue_capitaliser_devis, name="ressources-devis-capitaliser"),
    path("devis/vider-expires/", views.vue_vider_devis_expires, name="ressources-devis-vider-expires"),

    # Banque de prix marché
    path("prix-marche/", views.VueListePrixMarche.as_view(), name="ressources-prix-marche"),
    path("prix-marche/actualiser/", views.vue_actualiser_prix, name="ressources-prix-actualiser"),
    path("prix-marche/<uuid:pk>/", views.VueDetailPrixMarche.as_view(), name="ressources-prix-marche-detail"),
    path("prix-marche/<uuid:pk>/capitaliser/", views.vue_capitaliser_ligne, name="ressources-prix-capitaliser"),

    # Estimations et fiches ratio
    path("estimations/", views.VueListeEstimations.as_view(), name="ressources-estimations"),
    path("estimations/<uuid:pk>/", views.VueDetailEstimation.as_view(), name="ressources-estimation-detail"),
    path("fiches-ratio/", views.VueListeFichesRatio.as_view(), name="ressources-fiches-ratio"),
    path("fiches-ratio/references/", views.vue_ratios_reference, name="ressources-ratios-reference"),
    path("fiches-ratio/<uuid:pk>/", views.VueDetailFicheRatio.as_view(), name="ressources-fiche-ratio-detail"),
]
