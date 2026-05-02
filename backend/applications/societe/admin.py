from django.contrib import admin
from .models import (
    AffaireCommerciale,
    DevisHonoraires,
    Facture,
    LigneDevis,
    LigneFacture,
    LivraisonLivrable,
    Paiement,
    ProfilHoraire,
    RelanceAutomatique,
)


@admin.register(ProfilHoraire)
class ProfilHoraireAdmin(admin.ModelAdmin):
    list_display = ["libelle", "taux_horaire_ht", "actif", "ordre"]
    list_editable = ["taux_horaire_ht", "actif", "ordre"]
    ordering = ["ordre"]


class LigneDevisInline(admin.TabularInline):
    model = LigneDevis
    extra = 0


@admin.register(AffaireCommerciale)
class AffaireCommercialeAdmin(admin.ModelAdmin):
    list_display = ["reference", "intitule", "statut", "montant_estime_ttc", "mode_paiement_prevu", "date_modification"]
    list_filter = ["statut", "cadre_juridique", "mode_paiement_prevu"]
    search_fields = ["reference", "intitule", "contact_client", "contact_email"]


@admin.register(DevisHonoraires)
class DevisHonorairesAdmin(admin.ModelAdmin):
    list_display = ["reference", "intitule", "client_nom", "statut", "montant_ttc", "date_emission", "affaire"]
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


@admin.register(LivraisonLivrable)
class LivraisonLivrableAdmin(admin.ModelAdmin):
    list_display = ["livrable_code", "projet", "facture", "statut", "condition_livraison", "expiration"]
    list_filter = ["statut", "condition_livraison"]


@admin.register(RelanceAutomatique)
class RelanceAutomatiqueAdmin(admin.ModelAdmin):
    list_display = ["type", "cible_type", "niveau", "statut", "date_prevue", "email_destinataire"]
    list_filter = ["type", "niveau", "statut"]
