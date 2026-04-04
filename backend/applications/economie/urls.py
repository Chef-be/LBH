"""Routes URL pour l'économie de la construction — Plateforme LBH."""

from django.urls import path
from . import views

urlpatterns = [
    # Études économiques
    path("", views.VueListeEtudesEconomiques.as_view(), name="etudes-liste"),
    path("<uuid:pk>/", views.VueDetailEtudeEconomique.as_view(), name="etude-detail"),
    path("<uuid:pk>/recalculer/", views.vue_recalculer_etude, name="etude-recalculer"),
    path("<uuid:pk>/dupliquer/", views.vue_dupliquer_etude, name="etude-dupliquer"),

    # Lignes de prix d'études économiques
    path("<uuid:etude_id>/lignes/", views.VueListeLignesPrix.as_view(), name="lignes-liste"),
    path("<uuid:etude_id>/lignes/<uuid:pk>/", views.VueDetailLignePrix.as_view(), name="ligne-detail"),

    # Études de prix (base de données de prix analytiques)
    path("etudes-de-prix/", views.VueListeEtudesPrix.as_view(), name="etudes-prix-liste"),
    path("etudes-de-prix/<uuid:pk>/", views.VueDetailEtudePrix.as_view(), name="etude-prix-detail"),
    path("etudes-de-prix/<uuid:pk>/valider/", views.vue_valider_etude_prix, name="etude-prix-valider"),
    path("etudes-de-prix/<uuid:pk>/publier/", views.vue_publier_etude_prix, name="etude-prix-publier"),
    path("etudes-de-prix/<uuid:pk>/export/xlsx/", views.vue_exporter_etude_prix_xlsx, name="etude-prix-export-xlsx"),
    path("etudes-de-prix/<uuid:pk>/cadrage/", views.vue_cadrage_etude_prix, name="etude-prix-cadrage"),
    path("etudes-de-prix/<uuid:pk>/comparatif/", views.vue_comparatif_etude_prix, name="etude-prix-comparatif"),
    path("etudes-de-prix/<uuid:pk>/export/comparatif-xlsx/", views.vue_exporter_comparatif_etude_prix_xlsx, name="etude-prix-export-comparatif-xlsx"),
    path("etudes-de-prix/<uuid:pk>/export/achats-xlsx/", views.vue_exporter_achats_etude_prix_xlsx, name="etude-prix-export-achats-xlsx"),
    path("etudes-de-prix/<uuid:pk>/export/note-moa-docx/", views.vue_exporter_note_moa_etude_prix_docx, name="etude-prix-export-note-moa-docx"),
    path("etudes-de-prix/<uuid:pk>/export/note-moe-docx/", views.vue_exporter_note_moe_etude_prix_docx, name="etude-prix-export-note-moe-docx"),
    path("etudes-de-prix/<uuid:pk>/achats/proposer/", views.vue_proposer_achats_etude_prix, name="etude-prix-achats-proposer"),

    # Lignes de ressources des études de prix
    path("etudes-de-prix/<uuid:etude_id>/lignes/", views.VueListeLignesPrixEtude.as_view(), name="lignes-etude-prix-liste"),
    path("etudes-de-prix/<uuid:etude_id>/lignes/<uuid:pk>/", views.VueDetailLignePrixEtude.as_view(), name="ligne-etude-prix-detail"),
    path("etudes-de-prix/<uuid:etude_id>/achats/", views.VueListeAchatsEtudePrix.as_view(), name="achats-etude-prix-liste"),
    path("etudes-de-prix/<uuid:etude_id>/achats/<uuid:pk>/", views.VueDetailAchatEtudePrix.as_view(), name="achat-etude-prix-detail"),

    # Conventions collectives, profils de main-d'œuvre, simulateur et affectations projet
    path("conventions-collectives/", views.VueListeConventionsCollectives.as_view(), name="conventions-collectives-liste"),
    path("conventions-collectives/<uuid:pk>/", views.VueDetailConventionCollective.as_view(), name="convention-collective-detail"),
    path("references-sociales-localisation/", views.VueListeReferencesSocialesLocalisation.as_view(), name="references-sociales-localisation-liste"),
    path("references-sociales-localisation/<uuid:pk>/", views.VueDetailReferenceSocialeLocalisation.as_view(), name="reference-sociale-localisation-detail"),
    path("regles-conventionnelles/", views.VueListeReglesConventionnelles.as_view(), name="regles-conventionnelles-liste"),
    path("regles-conventionnelles/<uuid:pk>/", views.VueDetailRegleConventionnelle.as_view(), name="regle-conventionnelle-detail"),
    path("variantes-locales-regles-conventionnelles/", views.VueListeVariantesLocalesReglesConventionnelles.as_view(), name="variantes-locales-regles-conventionnelles-liste"),
    path("variantes-locales-regles-conventionnelles/<uuid:pk>/", views.VueDetailVarianteLocaleRegleConventionnelle.as_view(), name="variante-locale-regle-conventionnelle-detail"),
    path("profils-main-oeuvre/", views.VueListeProfilsMainOeuvre.as_view(), name="profils-main-oeuvre-liste"),
    path("profils-main-oeuvre/<uuid:pk>/", views.VueDetailProfilMainOeuvre.as_view(), name="profil-main-oeuvre-detail"),
    path("profils-main-oeuvre/<uuid:pk>/simulation-defauts/", views.vue_recuperer_defauts_simulation_profil, name="profil-main-oeuvre-simulation-defauts"),
    path("affectations-profils/", views.VueListeAffectationsProfilsProjet.as_view(), name="affectations-profils-liste"),
    path("affectations-profils/<uuid:pk>/", views.VueDetailAffectationProfilProjet.as_view(), name="affectation-profil-detail"),
    path("simulateur-main-oeuvre/", views.vue_simuler_cout_main_oeuvre, name="simulateur-main-oeuvre"),
    path("simulateur-main-oeuvre/export/pdf/", views.vue_exporter_simulation_main_oeuvre_pdf, name="simulateur-main-oeuvre-export-pdf"),
    path("simulateur-main-oeuvre/affecter/", views.vue_creer_affectation_depuis_simulation, name="simulateur-main-oeuvre-affecter"),
    path("pilotage-activite/simuler/", views.vue_simuler_plan_activite, name="pilotage-activite-simuler"),
]
