"""Routes URL pour les paramètres système — Plateforme LBH."""

from django.urls import path
from . import views

urlpatterns = [
    # Paramètres
    path("", views.VueListeParametres.as_view(), name="parametres-liste"),
    path("journal/", views.VueJournalParametres.as_view(), name="parametres-journal"),

    # Fonctionnalités activables
    path("fonctionnalites/", views.VueListeFonctionnalites.as_view(), name="fonctionnalites-liste"),
    path("fonctionnalites/<str:code>/basculer/", views.vue_basculer_fonctionnalite, name="fonctionnalite-basculer"),
    path("<str:cle>/", views.VueDetailParametre.as_view(), name="parametre-detail"),
    path("<str:cle>/reinitialiser/", views.vue_reinitialiser_parametre, name="parametre-reinitialiser"),
]
