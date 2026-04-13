"""Routes URL pour les pièces écrites — Plateforme LBH."""

from django.urls import path
from . import views

urlpatterns = [
    # Modèles de documents
    path("modeles/", views.VueListeModelesDocuments.as_view(), name="modeles-documents"),
    path("modeles/<uuid:pk>/", views.VueDetailModeleDocument.as_view(), name="modele-document-detail"),
    path("modeles/<uuid:pk>/session-bureautique/", views.vue_modele_document_session_bureautique, name="modele-document-session-bureautique"),
    path("wopi/modeles/<uuid:pk>/", views.vue_modele_document_wopi_fichier, name="modele-document-wopi-fichier"),
    path("wopi/modeles/<uuid:pk>", views.vue_modele_document_wopi_fichier),  # sans slash final (CheckFileInfo depuis Collabora)
    path("wopi/modeles/<uuid:pk>/contents", views.vue_modele_document_wopi_contenu, name="modele-document-wopi-contenu"),
    path("editeur/televersement-image/", views.vue_televerser_image_editeur, name="pieces-ecrites-editeur-televersement-image"),
    path("editeur/importer-word/", views.vue_importer_fichier_word_editeur, name="pieces-ecrites-editeur-importer-word"),

    # Bibliothèque de prescriptions CCTP — lots et générateur
    path("lots/", views.VueListeLotsTypesCCTP.as_view(), name="lots-cctp"),
    path("lots/<str:lot_numero>/prescriptions/", views.VueListePrescriptionsLot.as_view(), name="prescriptions-lot"),
    path("lots-cctp/", views.VueLotCCTPListeCreation.as_view(), name="lots-cctp-liste"),
    path("lots-cctp/<uuid:pk>/", views.VueLotCCTPDetail.as_view(), name="lots-cctp-detail"),
    path("generer-cctp/", views.vue_generer_cctp_multi_lots, name="generer-cctp"),

    # Bibliothèque d'articles CCTP
    path("articles/", views.VueListeArticlesCCTP.as_view(), name="articles-cctp-bibliotheque"),
    path("articles/<uuid:pk>/", views.VueDetailArticleCCTP.as_view(), name="article-cctp-detail"),

    # Pièces écrites
    path("", views.VueListePiecesEcrites.as_view(), name="pieces-ecrites-liste"),
    path("<uuid:pk>/", views.VueDetailPieceEcrite.as_view(), name="piece-ecrite-detail"),
    path("<uuid:pk>/valider/", views.vue_valider_piece_ecrite, name="piece-ecrite-valider"),
    path("<uuid:pk>/generer/", views.vue_generer_piece_ecrite, name="piece-ecrite-generer"),
    path("<uuid:pk>/proposition-cctp/", views.vue_proposition_article_cctp, name="piece-ecrite-proposition-cctp"),
    path("<uuid:pk>/generer-modele/", views.vue_generer_piece_depuis_modele, name="piece-ecrite-generer-modele"),
    path("<uuid:pk>/export/<str:format_sortie>/", views.vue_exporter_piece_ecrite, name="piece-ecrite-export"),
    path("<uuid:piece_id>/articles/", views.VueListeArticlesCCTP.as_view(), name="piece-articles-liste"),
    path("<uuid:piece_id>/articles/<uuid:pk>/", views.VueDetailArticleCCTP.as_view(), name="piece-article-detail"),
]
