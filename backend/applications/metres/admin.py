"""Administration Django pour les métrés — Plateforme LBH."""

from django.contrib import admin
from .models import (
    DPGFQuantitative,
    FondPlan,
    GeometrieFondPlan,
    LigneDPGFQuantitative,
    LigneMetre,
    Metre,
    ZoneMesure,
)


class LigneMetreInline(admin.TabularInline):
    model = LigneMetre
    extra = 0
    fields = ["numero_ordre", "code_article", "designation", "localisation", "quantite", "unite", "article_cctp"]
    ordering = ["numero_ordre"]


@admin.register(Metre)
class MetreAdmin(admin.ModelAdmin):
    list_display = ["intitule", "projet", "lot", "type_metre", "statut", "date_modification"]
    list_filter = ["type_metre", "statut"]
    search_fields = ["intitule", "projet__reference"]
    raw_id_fields = ["projet", "lot", "cree_par"]
    readonly_fields = ["date_creation", "date_modification"]
    inlines = [LigneMetreInline]


@admin.register(LigneMetre)
class LigneMetreAdmin(admin.ModelAdmin):
    list_display = ["numero_ordre", "designation", "localisation", "quantite", "unite", "designation_source", "metre"]
    list_filter = ["designation_source", "statut_ligne", "statut_synchronisation", "inclure_dpgf"]
    search_fields = ["designation", "code_article", "article_cctp_code", "localisation"]
    raw_id_fields = ["metre", "article_cctp", "ligne_bibliotheque", "source_fond_plan", "source_zone_mesure"]


@admin.register(FondPlan)
class FondPlanAdmin(admin.ModelAdmin):
    list_display = ["intitule", "metre", "format_fichier", "statut_traitement", "statut_calibration", "statut_vectorisation"]
    list_filter = ["format_fichier", "statut_traitement", "statut_calibration", "statut_vectorisation"]
    raw_id_fields = ["metre", "cree_par"]


@admin.register(ZoneMesure)
class ZoneMesureAdmin(admin.ModelAdmin):
    list_display = ["designation", "fond_plan", "type_mesure", "valeur_nette", "unite", "statut_calcul", "statut_conversion"]
    list_filter = ["type_mesure", "statut_calcul", "statut_conversion"]
    raw_id_fields = ["fond_plan", "zone_parente", "ligne_metre", "article_cctp"]


@admin.register(GeometrieFondPlan)
class GeometrieFondPlanAdmin(admin.ModelAdmin):
    list_display = ["fond_plan", "page", "type_source", "statut", "date_generation"]
    list_filter = ["type_source", "statut"]
    raw_id_fields = ["fond_plan"]


class LigneDPGFQuantitativeInline(admin.TabularInline):
    model = LigneDPGFQuantitative
    extra = 0
    fields = ["ordre", "code_article", "designation", "localisation", "quantite", "unite", "statut"]
    readonly_fields = ["date_creation"]


@admin.register(DPGFQuantitative)
class DPGFQuantitativeAdmin(admin.ModelAdmin):
    list_display = ["intitule", "projet", "metre_source", "statut", "date_creation"]
    list_filter = ["statut"]
    search_fields = ["intitule", "projet__reference"]
    raw_id_fields = ["projet", "metre_source", "cree_par"]
    inlines = [LigneDPGFQuantitativeInline]
