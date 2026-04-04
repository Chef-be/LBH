"""Administration Django pour le site vitrine public — Plateforme LBH."""

from django.contrib import admin
from .models import Prestation, Realisation, MembreEquipe, DemandeContact


@admin.register(Prestation)
class PrestationAdmin(admin.ModelAdmin):
    list_display = ["titre", "est_publie", "ordre_affichage", "date_modification"]
    list_filter = ["est_publie"]
    ordering = ["ordre_affichage"]


@admin.register(Realisation)
class RealisationAdmin(admin.ModelAdmin):
    list_display = ["titre", "client", "lieu", "annee", "est_publie", "ordre_affichage"]
    list_filter = ["est_publie", "annee"]
    search_fields = ["titre", "client", "lieu"]
    raw_id_fields = ["projet"]
    ordering = ["-annee", "ordre_affichage"]


@admin.register(MembreEquipe)
class MembreEquipeAdmin(admin.ModelAdmin):
    list_display = ["prenom", "nom", "fonction", "est_publie", "ordre_affichage"]
    list_filter = ["est_publie"]
    raw_id_fields = ["utilisateur"]
    ordering = ["ordre_affichage", "nom"]


@admin.register(DemandeContact)
class DemandeContactAdmin(admin.ModelAdmin):
    list_display = ["nom", "courriel", "sujet", "traitee", "date_reception"]
    list_filter = ["sujet", "traitee"]
    search_fields = ["nom", "courriel", "message"]
    readonly_fields = ["date_reception", "adresse_ip"]
    ordering = ["-date_reception"]

    actions = ["marquer_traitees"]

    @admin.action(description="Marquer comme traitées")
    def marquer_traitees(self, request, queryset):
        queryset.update(traitee=True)
