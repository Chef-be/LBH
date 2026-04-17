"""
Routes URL pour les projets — Plateforme LBH.
"""

from django.urls import path
from .views import (
    VueListeProjets,
    VueDetailProjet,
    VueLotsProjet,
    VueIntervenantsProjet,
    vue_creer_preanalyse_sources_projet,
    vue_detail_preanalyse_sources_projet,
    vue_parcours_projet,
    vue_references_indices_prix,
    vue_qualification_documentaire_projet,
    vue_orientation_projet,
    vue_statistiques_projets,
    vue_synthese_projet,
    vue_ressources_documentaires,
)

urlpatterns = [
    path("", VueListeProjets.as_view(), name="projets-liste"),
    path("orientation/", vue_orientation_projet, name="projets-orientation"),
    path("parcours/", vue_parcours_projet, name="projets-parcours"),
    path("indices-prix/references/", vue_references_indices_prix, name="projets-indices-prix-references"),
    path("preanalyse-sources/taches/", vue_creer_preanalyse_sources_projet, name="projets-preanalyse-sources-creer"),
    path("preanalyse-sources/taches/<uuid:pk>/", vue_detail_preanalyse_sources_projet, name="projets-preanalyse-sources-detail"),
    path("statistiques/", vue_statistiques_projets, name="projets-statistiques"),
    path("ressources-documentaires/", vue_ressources_documentaires, name="projets-ressources-documentaires"),
    path("<uuid:pk>/", VueDetailProjet.as_view(), name="projets-detail"),
    path("<uuid:projet_id>/qualification-documentaire/", vue_qualification_documentaire_projet, name="projets-qualification-documentaire"),
    path("<uuid:projet_id>/synthese/", vue_synthese_projet, name="projets-synthese"),
    path("<uuid:projet_id>/lots/", VueLotsProjet.as_view(), name="projets-lots"),
    path("<uuid:projet_id>/intervenants/", VueIntervenantsProjet.as_view(), name="projets-intervenants"),
]
