"""Routes URL pour la bibliothèque de prix — Plateforme LBH."""

from django.urls import path
from . import views

urlpatterns = [
    # Bibliothèque — liste et création
    path("", views.VueListeBibliotheque.as_view(), name="bibliotheque-liste"),
    path("familles/", views.vue_familles, name="bibliotheque-familles"),
    path("lots-cctp/", views.vue_lots_cctp, name="bibliotheque-lots-cctp"),
    path("importer-bordereaux/", views.vue_importer_bordereaux_prix, name="bibliotheque-importer-bordereaux"),
    path("importer-fichiers/", views.vue_importer_bordereaux_fichiers, name="bibliotheque-importer-fichiers"),
    path("importer-prix-construction/", views.vue_importer_prix_construction, name="bibliotheque-importer-prix-construction"),
    path("recalculer-tous/", views.vue_recalculer_bibliotheque, name="bibliotheque-recalculer-tous"),
    path("recalcul-progression/<str:tache_id>/", views.vue_progression_recalcul, name="bibliotheque-progression-recalcul"),
    path("lier-auto/", views.vue_lier_auto_prix_articles, name="lier-auto-prix-articles"),
    path("vider/", views.vue_vider_bibliotheque, name="bibliotheque-vider"),

    # Bibliothèque — détail et actions
    path("<uuid:pk>/", views.VueDetailBibliotheque.as_view(), name="bibliotheque-detail"),
    path("<uuid:pk>/complet/", views.VueDetailBibliothequeAvecSousDetails.as_view(), name="bibliotheque-detail-complet"),
    path("<uuid:pk>/detail-complet/", views.VueDetailBibliothequeComplet.as_view(), name="bibliotheque-detail-complet-v2"),
    path("<uuid:pk>/valider/", views.vue_valider_entree, name="bibliotheque-valider"),
    path("<uuid:pk>/recalculer/", views.vue_recalculer_sous_details, name="bibliotheque-recalculer"),
    path("<uuid:pk>/audit-sdp-ds/", views.vue_audit_sdp_ds, name="bibliotheque-audit-sdp-ds"),
    path("<uuid:pk>/recalculer-ds-depuis-sdp/", views.vue_recalculer_ds_depuis_sdp, name="bibliotheque-recalculer-ds-depuis-sdp"),
    path("<uuid:pk>/proposer-complement-sdp/", views.vue_proposer_complement_sdp, name="bibliotheque-proposer-complement-sdp"),
    path("<uuid:pk>/creer-complement-sdp/", views.vue_creer_complement_sdp, name="bibliotheque-creer-complement-sdp"),
    path("<uuid:pk>/proposer-decomposition-estimee/", views.vue_proposer_decomposition_estimee, name="bibliotheque-proposer-decomposition-estimee"),
    path("<uuid:pk>/completer-sous-details/", views.vue_completer_sous_details, name="bibliotheque-completer-sous-details"),
    path("completer-tous-sous-details/", views.vue_completer_tous_sous_details, name="bibliotheque-completer-tous"),
    path("<uuid:pk>/prescriptions/", views.vue_prescriptions_liees, name="bibliotheque-prescriptions"),
    path("<uuid:pk>/lier-prescriptions/", views.vue_lier_prescriptions, name="bibliotheque-lier-prescriptions"),
    path("<uuid:pk>/caracteristiques/", views.vue_caracteristiques, name="bibliotheque-caracteristiques"),

    # Sous-détails de prix
    path("<uuid:ligne_pk>/sous-details/", views.VueListeSousDetailPrix.as_view(), name="sous-details-liste"),
    path("<uuid:ligne_pk>/sous-details/<uuid:pk>/", views.VueDetailSousDetailPrix.as_view(), name="sous-details-detail"),
]
