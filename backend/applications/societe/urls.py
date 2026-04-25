"""
Routes API — Module Pilotage Société
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    ProfilHoraireViewSet,
    ProfilHoraireUtilisateurViewSet,
    ParametreSocieteViewSet,
    ChargeFixeStructureViewSet,
    SimulationSalaireViewSet,
    TempsPasseViewSet,
    DevisHonorairesViewSet,
    FactureViewSet,
    vue_tableau_de_bord,
    vue_reference_smic,
    vue_validation_devis_client,
    vue_simulations_profil,
    vue_previsualiser_simulation,
)

router = DefaultRouter()
router.register(r"profils-horaires", ProfilHoraireViewSet, basename="profil-horaire")
router.register(r"profils-horaires-utilisateurs", ProfilHoraireUtilisateurViewSet, basename="profil-horaire-utilisateur")
router.register(r"parametres-societe", ParametreSocieteViewSet, basename="parametre-societe")
router.register(r"charges-fixes", ChargeFixeStructureViewSet, basename="charge-fixe-structure")
router.register(r"simulations-salaire", SimulationSalaireViewSet, basename="simulation-salaire")
router.register(r"temps-passes", TempsPasseViewSet, basename="temps-passe")
router.register(r"devis", DevisHonorairesViewSet, basename="devis-honoraires")
router.register(r"factures", FactureViewSet, basename="facture")

urlpatterns = [
    path("tableau-de-bord/", vue_tableau_de_bord, name="societe-tableau-de-bord"),
    path("references/smic/", vue_reference_smic, name="societe-reference-smic"),
    path(
        "validation-client/devis/<str:jeton>/",
        vue_validation_devis_client,
        name="societe-validation-devis-client",
    ),
    # Simulations imbriquées dans le profil
    path(
        "profils-horaires/<str:profil_pk>/simulations/",
        vue_simulations_profil,
        name="societe-simulations-profil",
    ),
    path(
        "profils-horaires/<str:profil_pk>/simulations/previsualiser/",
        vue_previsualiser_simulation,
        name="societe-previsualiser-simulation",
    ),
    path("", include(router.urls)),
]
