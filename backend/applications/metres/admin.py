"""Administration Django pour les métrés — Plateforme BEE."""

from django.contrib import admin
from .models import Metre, LigneMetre


class LigneMetreInline(admin.TabularInline):
    model = LigneMetre
    extra = 0
    fields = ["numero_ordre", "code_article", "designation", "quantite", "unite", "prix_unitaire_ht"]
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
    list_display = ["numero_ordre", "designation", "quantite", "unite", "prix_unitaire_ht", "metre"]
    search_fields = ["designation", "code_article"]
    raw_id_fields = ["metre", "ligne_bibliotheque"]
