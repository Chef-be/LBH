"""Administration Django pour la bibliothèque de prix — Plateforme LBH."""

from django.contrib import admin
from .models import LignePrixBibliotheque, SousDetailPrix


class SousDetailPrixInline(admin.TabularInline):
    model = SousDetailPrix
    extra = 0
    fields = ["ordre", "type_ressource", "code", "designation", "unite", "quantite", "cout_unitaire_ht", "montant_ht", "zone_taux"]
    readonly_fields = ["montant_ht"]
    ordering = ["ordre"]


@admin.register(LignePrixBibliotheque)
class LignePrixBibliothequeAdmin(admin.ModelAdmin):
    list_display = [
        "code", "designation_courte", "famille", "sous_famille",
        "unite", "debourse_sec_unitaire", "prix_vente_unitaire",
        "niveau", "statut_validation", "fiabilite",
    ]
    list_filter = ["niveau", "statut_validation", "famille"]
    search_fields = ["code", "designation_courte", "designation_longue", "famille"]
    readonly_fields = ["date_creation", "date_modification"]
    raw_id_fields = ["organisation", "projet", "auteur", "ligne_parente"]
    ordering = ["famille", "sous_famille", "code"]
    inlines = [SousDetailPrixInline]


@admin.register(SousDetailPrix)
class SousDetailPrixAdmin(admin.ModelAdmin):
    list_display = ["ligne_prix", "ordre", "type_ressource", "designation", "unite", "quantite", "cout_unitaire_ht", "montant_ht"]
    list_filter = ["type_ressource", "zone_taux"]
    search_fields = ["designation", "code", "ligne_prix__code"]
    readonly_fields = ["montant_ht", "date_modification"]
    raw_id_fields = ["ligne_prix"]
    ordering = ["ligne_prix", "ordre"]
