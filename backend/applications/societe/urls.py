"""
Routes API — Module Pilotage Société
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    ProfilHoraireViewSet,
    ProfilHoraireUtilisateurViewSet,
    TempsPasseViewSet,
    DevisHonorairesViewSet,
    FactureViewSet,
    vue_tableau_de_bord,
    vue_validation_devis_client,
)

router = DefaultRouter()
router.register(r"profils-horaires", ProfilHoraireViewSet, basename="profil-horaire")
router.register(r"profils-horaires-utilisateurs", ProfilHoraireUtilisateurViewSet, basename="profil-horaire-utilisateur")
router.register(r"temps-passes", TempsPasseViewSet, basename="temps-passe")
router.register(r"devis", DevisHonorairesViewSet, basename="devis-honoraires")
router.register(r"factures", FactureViewSet, basename="facture")

urlpatterns = [
    path("tableau-de-bord/", vue_tableau_de_bord, name="societe-tableau-de-bord"),
    path(
        "validation-client/devis/<str:jeton>/",
        vue_validation_devis_client,
        name="societe-validation-devis-client",
    ),
    path("", include(router.urls)),
]
