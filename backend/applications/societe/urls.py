"""
Routes API — Module Pilotage Société
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    ProfilHoraireViewSet,
    DevisHonorairesViewSet,
    FactureViewSet,
    vue_tableau_de_bord,
)

router = DefaultRouter()
router.register(r"profils-horaires", ProfilHoraireViewSet, basename="profil-horaire")
router.register(r"devis", DevisHonorairesViewSet, basename="devis-honoraires")
router.register(r"factures", FactureViewSet, basename="facture")

urlpatterns = [
    path("tableau-de-bord/", vue_tableau_de_bord, name="societe-tableau-de-bord"),
    path("", include(router.urls)),
]
