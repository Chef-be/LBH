"""Routes URL pour le suivi d'exécution des travaux — Plateforme LBH."""

from django.urls import path
from . import views

urlpatterns = [
    # Tableau de bord résumé
    path("resume/", views.vue_resume_execution, name="execution-resume"),

    # Suivis d'exécution
    path("", views.VueListeSuivisExecution.as_view(), name="suivis-liste"),
    path("<uuid:pk>/", views.VueDetailSuiviExecution.as_view(), name="suivi-detail"),
    path("<uuid:suivi_id>/plannings/", views.VueListePlanningsChantier.as_view(), name="plannings-liste"),

    # Comptes rendus de chantier
    path("<uuid:suivi_id>/comptes-rendus/", views.VueListeComptesRendus.as_view(), name="comptes-rendus-liste"),
    path("<uuid:suivi_id>/comptes-rendus/<uuid:pk>/", views.VueDetailCompteRendu.as_view(), name="compte-rendu-detail"),

    # Situations de travaux
    path("<uuid:suivi_id>/situations/", views.VueListeSituations.as_view(), name="situations-liste"),
    path("<uuid:suivi_id>/situations/<uuid:pk>/", views.VueDetailSituation.as_view(), name="situation-detail"),
    path("<uuid:suivi_id>/situations/<uuid:pk>/valider/", views.vue_valider_situation, name="situation-valider"),

    # Ordres de service
    path("<uuid:suivi_id>/ordres-service/", views.VueListeOrdresService.as_view(), name="ordres-service-liste"),
    path("<uuid:suivi_id>/ordres-service/<uuid:pk>/", views.VueDetailOrdreService.as_view(), name="ordre-service-detail"),

    # Planning chantier
    path("plannings/<uuid:pk>/", views.VueDetailPlanningChantier.as_view(), name="planning-detail"),
    path("plannings/<uuid:planning_id>/regenerer/", views.vue_regenerer_planning, name="planning-regenerer"),
    path("plannings/<uuid:planning_id>/recalculer/", views.vue_recalculer_planning, name="planning-recalculer"),
    path("plannings/<uuid:planning_id>/export/xlsx/", views.vue_exporter_planning_xlsx, name="planning-export-xlsx"),
    path("plannings/<uuid:planning_id>/export/pdf/", views.vue_exporter_planning_pdf, name="planning-export-pdf"),
    path("plannings/<uuid:planning_id>/export/archive/", views.vue_exporter_planning_archive, name="planning-export-archive"),
    path("plannings/<uuid:planning_id>/taches/", views.VueListeTachesPlanning.as_view(), name="planning-taches-liste"),
    path("plannings/<uuid:planning_id>/taches/<uuid:pk>/", views.VueDetailTachePlanning.as_view(), name="planning-tache-detail"),
    path("plannings/<uuid:planning_id>/taches/<uuid:pk>/affectations/", views.vue_affecter_equipe_tache, name="planning-tache-affectations"),
    path("plannings/<uuid:planning_id>/dependances/", views.VueListeDependancesPlanning.as_view(), name="planning-dependances-liste"),
    path("plannings/<uuid:planning_id>/dependances/<uuid:pk>/", views.VueDetailDependancePlanning.as_view(), name="planning-dependance-detail"),
]
