"""Routes URL pour la bibliothèque de prix — Plateforme LBH."""

from django.urls import path
from . import views

urlpatterns = [
    # Bibliothèque — liste et création
    path("", views.VueListeBibliotheque.as_view(), name="bibliotheque-liste"),
    path("familles/", views.vue_familles, name="bibliotheque-familles"),
    path("importer-bordereaux/", views.vue_importer_bordereaux_prix, name="bibliotheque-importer-bordereaux"),
    path("importer-fichiers/", views.vue_importer_bordereaux_fichiers, name="bibliotheque-importer-fichiers"),
    path("importer-prix-construction/", views.vue_importer_prix_construction, name="bibliotheque-importer-prix-construction"),
    path("recalculer-tous/", views.vue_recalculer_bibliotheque, name="bibliotheque-recalculer-tous"),
    path("vider/", views.vue_vider_bibliotheque, name="bibliotheque-vider"),

    # Bibliothèque — détail et actions
    path("<uuid:pk>/", views.VueDetailBibliotheque.as_view(), name="bibliotheque-detail"),
    path("<uuid:pk>/complet/", views.VueDetailBibliothequeAvecSousDetails.as_view(), name="bibliotheque-detail-complet"),
    path("<uuid:pk>/valider/", views.vue_valider_entree, name="bibliotheque-valider"),
    path("<uuid:pk>/recalculer/", views.vue_recalculer_sous_details, name="bibliotheque-recalculer"),

    # Sous-détails de prix
    path("<uuid:ligne_pk>/sous-details/", views.VueListeSousDetailPrix.as_view(), name="sous-details-liste"),
    path("<uuid:ligne_pk>/sous-details/<uuid:pk>/", views.VueDetailSousDetailPrix.as_view(), name="sous-details-detail"),
]
