"""Routes URL pour la gestion documentaire — Plateforme LBH."""

from django.urls import path
from . import views

urlpatterns = [
    # Types de documents
    path("types/", views.VueListeTypesDocuments.as_view(), name="types-documents"),
    path("dossiers/", views.VueListeDossiersDocumentsProjet.as_view(), name="documents-dossiers-liste"),
    path("dossiers/<uuid:pk>/", views.VueDetailDossierDocumentProjet.as_view(), name="documents-dossiers-detail"),

    # Documents
    path("", views.VueListeDocuments.as_view(), name="documents-liste"),
    path("importer-archive/", views.vue_importer_archive_documents, name="documents-importer-archive"),
    path("appliquer-suggestions/", views.vue_appliquer_suggestions_documents, name="documents-appliquer-suggestions"),
    path("previsualiser-suggestions/", views.vue_previsualiser_suggestions_documents, name="documents-previsualiser-suggestions"),
    path("<uuid:pk>/", views.VueDetailDocument.as_view(), name="document-detail"),
    path("<uuid:pk>/valider/", views.vue_valider_document, name="document-valider"),
    path("<uuid:pk>/nouvelle-version/", views.vue_nouvelle_version, name="document-nouvelle-version"),
    path("<uuid:pk>/ocr/", views.vue_lancer_ocr, name="document-ocr"),
    path("<uuid:pk>/analyser/", views.vue_lancer_analyse_document, name="document-analyser"),
    path("<uuid:pk>/importer-bibliotheque/", views.vue_importer_document_bibliotheque, name="document-importer-bibliotheque"),
    path("<uuid:pk>/appliquer-suggestions/", views.vue_appliquer_suggestions_document, name="document-appliquer-suggestions"),

    # Annotations et diffusions
    path("<uuid:doc_id>/annotations/", views.VueAnnotationsDocument.as_view(), name="document-annotations"),
    path("<uuid:doc_id>/diffusions/", views.VueDiffusionsDocument.as_view(), name="document-diffusions"),
]
