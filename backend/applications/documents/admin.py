"""Administration Django pour la gestion documentaire — Plateforme LBH."""

from django.contrib import admin
from .models import TypeDocument, Document, AnnotationDocument, DiffusionDocument


@admin.register(TypeDocument)
class TypeDocumentAdmin(admin.ModelAdmin):
    list_display = ["code", "libelle", "ordre_affichage"]
    ordering = ["ordre_affichage"]


class AnnotationInline(admin.TabularInline):
    model = AnnotationDocument
    extra = 0
    fields = ["auteur", "contenu", "page", "resolue", "date_creation"]
    readonly_fields = ["date_creation"]


class DiffusionInline(admin.TabularInline):
    model = DiffusionDocument
    extra = 0
    fields = ["destinataire", "destinataire_contact", "mode_diffusion", "date_diffusion"]
    readonly_fields = ["date_diffusion"]


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = [
        "reference", "intitule", "type_document", "projet",
        "version", "statut", "est_version_courante", "date_modification",
    ]
    list_filter = ["statut", "type_document", "origine", "confidentiel", "est_version_courante"]
    search_fields = ["reference", "intitule", "contenu_texte"]
    readonly_fields = ["date_creation", "date_modification", "empreinte_sha256"]
    raw_id_fields = ["projet", "lot", "auteur", "valide_par", "document_parent"]
    inlines = [AnnotationInline, DiffusionInline]

    def get_queryset(self, request):
        return super().get_queryset(request).select_related(
            "type_document", "projet", "auteur"
        )
