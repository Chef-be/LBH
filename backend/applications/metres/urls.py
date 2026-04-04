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
]
