"""Administration Django pour les programmes bâtiment — Plateforme LBH."""

from django.contrib import admin
from .models import ProgrammeBatiment, LocalProgramme


class LocalProgrammeInline(admin.TabularInline):
    model = LocalProgramme
    extra = 0
    fields = ["designation", "categorie", "nombre", "surface_unitaire_m2"]
    ordering = ["categorie", "designation"]


@admin.register(ProgrammeBatiment)
class ProgrammeBatimentAdmin(admin.ModelAdmin):
    list_display = [
        "intitule", "projet", "type_operation", "type_batiment",
        "shon_totale", "cout_estime_ht", "date_modification",
    ]
    list_filter = ["type_operation", "type_batiment"]
    search_fields = ["intitule", "projet__reference"]
    readonly_fields = ["cout_estime_ht", "cout_par_m2_shon_ht", "date_creation", "date_modification"]
    raw_id_fields = ["projet"]
    inlines = [LocalProgrammeInline]


@admin.register(LocalProgramme)
class LocalProgrammeAdmin(admin.ModelAdmin):
    list_display = ["designation", "categorie", "nombre", "surface_unitaire_m2", "programme"]
    search_fields = ["designation", "categorie"]
    raw_id_fields = ["programme"]
