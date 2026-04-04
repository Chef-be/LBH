"""Administration Django pour les pièces écrites — Plateforme LBH."""

from django.contrib import admin
from .models import ModeleDocument, PieceEcrite, ArticleCCTP


class ArticleCCTPInline(admin.TabularInline):
    model = ArticleCCTP
    extra = 0
    fields = ["numero_article", "chapitre", "intitule", "est_dans_bibliotheque"]
    ordering = ["chapitre", "numero_article"]


@admin.register(ModeleDocument)
class ModeleDocumentAdmin(admin.ModelAdmin):
    list_display = ["code", "libelle", "type_document", "est_actif", "date_modification"]
    list_filter = ["type_document", "est_actif"]
    search_fields = ["code", "libelle"]
    readonly_fields = ["date_creation", "date_modification"]


@admin.register(PieceEcrite)
class PieceEcriteAdmin(admin.ModelAdmin):
    list_display = ["intitule", "projet", "modele", "statut", "date_modification"]
    list_filter = ["statut", "modele__type_document"]
    search_fields = ["intitule", "projet__reference"]
    readonly_fields = ["date_creation", "date_modification", "date_generation"]
    raw_id_fields = ["projet", "lot", "modele", "redacteur"]
    inlines = [ArticleCCTPInline]


@admin.register(ArticleCCTP)
class ArticleCCTPAdmin(admin.ModelAdmin):
    list_display = ["numero_article", "intitule", "chapitre", "est_dans_bibliotheque"]
    list_filter = ["est_dans_bibliotheque"]
    search_fields = ["intitule", "corps_article", "chapitre"]
    raw_id_fields = ["piece_ecrite"]
