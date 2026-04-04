"""Administration Django pour les appels d'offres — Plateforme BEE."""

from django.contrib import admin
from .models import AppelOffres, OffreEntreprise


class OffreInline(admin.TabularInline):
    model = OffreEntreprise
    extra = 0
    fields = ["entreprise", "statut", "montant_offre_ht", "note_globale"]
    raw_id_fields = ["entreprise"]


@admin.register(AppelOffres)
class AppelOffresAdmin(admin.ModelAdmin):
    list_display = [
        "intitule", "projet", "type_procedure", "statut",
        "date_limite_remise", "montant_estime_ht",
    ]
    list_filter = ["statut", "type_procedure"]
    search_fields = ["intitule", "projet__reference"]
    raw_id_fields = ["projet", "lot"]
    readonly_fields = ["date_creation", "date_modification"]
    inlines = [OffreInline]


@admin.register(OffreEntreprise)
class OffreEntrepriseAdmin(admin.ModelAdmin):
    list_display = [
        "entreprise", "appel_offres", "statut",
        "montant_offre_ht", "note_globale",
    ]
    list_filter = ["statut"]
    raw_id_fields = ["appel_offres", "entreprise"]
