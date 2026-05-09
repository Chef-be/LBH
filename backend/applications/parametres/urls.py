"""Routes URL pour les paramètres système — Plateforme LBH."""

from django.urls import path
from . import views

urlpatterns = [
    # Administration des traitements métier automatisés
    path("administration/ia/configurations/", views.VueListeConfigurationsIA.as_view(), name="administration-ia-configurations"),
    path("administration/ia/configurations/<uuid:pk>/", views.VueDetailConfigurationIA.as_view(), name="administration-ia-configuration-detail"),
    path("administration/ia/configurations/<uuid:pk>/tester/", views.vue_tester_configuration_ia, name="administration-ia-configuration-tester"),
    path("administration/ia/journaux/", views.VueListeJournauxIA.as_view(), name="administration-ia-journaux"),
    path("administration/ia/couts/", views.vue_couts_ia, name="administration-ia-couts"),

    # Paramètres
    path("", views.VueListeParametres.as_view(), name="parametres-liste"),
    path("journal/", views.VueJournalParametres.as_view(), name="parametres-journal"),

    # Fonctionnalités activables
    path("fonctionnalites/", views.VueListeFonctionnalites.as_view(), name="fonctionnalites-liste"),
    path("fonctionnalites/<str:code>/basculer/", views.vue_basculer_fonctionnalite, name="fonctionnalite-basculer"),
    path("<str:cle>/", views.VueDetailParametre.as_view(), name="parametre-detail"),
    path("<str:cle>/reinitialiser/", views.vue_reinitialiser_parametre, name="parametre-reinitialiser"),
]
