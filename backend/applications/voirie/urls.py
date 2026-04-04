"""Routes URL pour les études de voirie — Plateforme LBH."""

from django.urls import path
from . import views

urlpatterns = [
    path("", views.VueListeEtudesVoirie.as_view(), name="voirie-liste"),
    path("<uuid:pk>/", views.VueDetailEtudeVoirie.as_view(), name="voirie-detail"),
    path("<uuid:pk>/calculer/", views.vue_calculer_voirie, name="voirie-calculer"),
]
