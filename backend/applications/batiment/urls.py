"""Routes URL pour les programmes bâtiment — Plateforme LBH."""

from django.urls import path
from . import views

urlpatterns = [
    # Programmes bâtiment
    path("", views.VueListeProgrammesBatiment.as_view(), name="batiment-liste"),
    path("<uuid:pk>/", views.VueDetailProgrammeBatiment.as_view(), name="batiment-detail"),
    path("<uuid:pk>/calculer/", views.vue_calculer_batiment, name="batiment-calculer"),

    # Locaux
    path("<uuid:programme_id>/locaux/", views.VueListeLocaux.as_view(), name="locaux-liste"),
    path("<uuid:programme_id>/locaux/<uuid:pk>/", views.VueDetailLocal.as_view(), name="local-detail"),
]
