from django.contrib import admin
from .models import ProfilHoraire, DevisHonoraires, LigneDevis, Facture, LigneFacture, Paiement


@admin.register(ProfilHoraire)
class ProfilHoraireAdmin(admin.ModelAdmin):
    list_display = ["libelle", "taux_horaire_ht", "actif", "ordre"]
    list_editable = ["taux_horaire_ht", "actif", "ordre"]
    ordering = ["ordre"]


class LigneDevisInline(admin.TabularInline):
    model = LigneDevis
    extra = 0


@admin.register(DevisHonoraires)
class DevisHonorairesAdmin(admin.ModelAdmin):
    list_display = ["reference", "intitule", "client_nom", "statut", "montant_ttc", "date_emission"]
    list_filter = ["statut"]
    inlines = [LigneDevisInline]


class LigneFactureInline(admin.TabularInline):
    model = LigneFacture
    extra = 0


class PaiementInline(admin.TabularInline):
    model = Paiement
    extra = 0


@admin.register(Facture)
class FactureAdmin(admin.ModelAdmin):
    list_display = ["reference", "intitule", "client_nom", "statut", "montant_ttc", "montant_paye", "date_echeance"]
    list_filter = ["statut"]
    inlines = [LigneFactureInline, PaiementInline]
