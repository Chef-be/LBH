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
    MissionClientSocieteViewSet,
    SimulationSalaireViewSet,
    TempsPasseViewSet,
    ProfilRHSalarieViewSet,
    CalendrierTravailSocieteViewSet,
    PointageJournalierViewSet,
    EvenementPointageViewSet,
    DemandeAbsenceViewSet,
    SoldeAbsenceSalarieViewSet,
    CompteurTempsSalarieViewSet,
    DevisHonorairesViewSet,
    AffaireCommercialeViewSet,
    FactureViewSet,
    PaiementViewSet,
    LivraisonLivrableViewSet,
    RelanceAutomatiqueViewSet,
    vue_tableau_de_bord,
    vue_tableau_de_bord_rh,
    vue_pilotage_economique,
    vue_recalculer_tarifs,
    vue_reference_smic,
    vue_assignation_automatique,
    vue_simuler_assignation_automatique,
    vue_capacite_salaries,
    vue_capacite_salarie,
    vue_validation_devis_client,
    vue_public_devis,
    vue_public_devis_accepter,
    vue_public_devis_refuser,
    vue_simulations_profil,
    vue_previsualiser_simulation,
)

router = DefaultRouter()
router.register(r"profils-horaires", ProfilHoraireViewSet, basename="profil-horaire")
router.register(r"profils-horaires-utilisateurs", ProfilHoraireUtilisateurViewSet, basename="profil-horaire-utilisateur")
router.register(r"parametres-societe", ParametreSocieteViewSet, basename="parametre-societe")
router.register(r"charges-fixes", ChargeFixeStructureViewSet, basename="charge-fixe-structure")
router.register(r"missions-client", MissionClientSocieteViewSet, basename="mission-client-societe")
router.register(r"simulations-salaire", SimulationSalaireViewSet, basename="simulation-salaire")
router.register(r"temps-passes", TempsPasseViewSet, basename="temps-passe")
router.register(r"profils-rh-salaries", ProfilRHSalarieViewSet, basename="profil-rh-salarie")
router.register(r"calendriers-travail", CalendrierTravailSocieteViewSet, basename="calendrier-travail-societe")
router.register(r"pointages", PointageJournalierViewSet, basename="pointage-journalier")
router.register(r"evenements-pointage", EvenementPointageViewSet, basename="evenement-pointage")
router.register(r"absences", DemandeAbsenceViewSet, basename="demande-absence")
router.register(r"soldes-absences", SoldeAbsenceSalarieViewSet, basename="solde-absence-salarie")
router.register(r"compteurs-temps", CompteurTempsSalarieViewSet, basename="compteur-temps-salarie")
router.register(r"devis", DevisHonorairesViewSet, basename="devis-honoraires")
router.register(r"affaires", AffaireCommercialeViewSet, basename="affaire-commerciale")
router.register(r"factures", FactureViewSet, basename="facture")
router.register(r"paiements", PaiementViewSet, basename="paiement")
router.register(r"livraisons", LivraisonLivrableViewSet, basename="livraison-livrable")
router.register(r"relances", RelanceAutomatiqueViewSet, basename="relance-automatique")

urlpatterns = [
    path("tableau-de-bord/", vue_tableau_de_bord, name="societe-tableau-de-bord"),
    path("tableau-de-bord-rh/", vue_tableau_de_bord_rh, name="societe-tableau-de-bord-rh"),
    path("pilotage-economique/", vue_pilotage_economique, name="societe-pilotage-economique"),
    path("recalculer-tarifs/", vue_recalculer_tarifs, name="societe-recalculer-tarifs"),
    path("references/smic/", vue_reference_smic, name="societe-reference-smic"),
    path("assignation-automatique/", vue_assignation_automatique, name="societe-assignation-automatique"),
    path("assignation-automatique/simuler/", vue_simuler_assignation_automatique, name="societe-assignation-automatique-simuler"),
    path("capacite-salaries/", vue_capacite_salaries, name="societe-capacite-salaries"),
    path("capacite-salaries/<str:utilisateur_id>/", vue_capacite_salarie, name="societe-capacite-salarie"),
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
