"""
Routes URL pour les projets — Plateforme LBH.
"""

from django.urls import path
from .views import (
    VueListeProjets,
    VueDetailProjet,
    VueLotsProjet,
    VueIntervenantsProjet,
    vue_qualification_documentaire_projet,
    vue_orientation_projet,
    vue_statistiques_projets,
)

urlpatterns = [
    path("", VueListeProjets.as_view(), name="projets-liste"),
    path("orientation/", vue_orientation_projet, name="projets-orientation"),
    path("statistiques/", vue_statistiques_projets, name="projets-statistiques"),
    path("<uuid:pk>/", VueDetailProjet.as_view(), name="projets-detail"),
    path("<uuid:projet_id>/qualification-documentaire/", vue_qualification_documentaire_projet, name="projets-qualification-documentaire"),
    path("<uuid:projet_id>/lots/", VueLotsProjet.as_view(), name="projets-lots"),
    path("<uuid:projet_id>/intervenants/", VueIntervenantsProjet.as_view(), name="projets-intervenants"),
]
