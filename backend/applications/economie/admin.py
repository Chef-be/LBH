"""Administration Django pour l'économie de la construction — Plateforme LBH."""

from django.contrib import admin
from .models import EtudeEconomique, LignePrix, EtudePrix, LignePrixEtude


class LignePrixInline(admin.TabularInline):
    model = LignePrix
    extra = 0
    fields = [
        "numero_ordre", "code", "designation", "unite",
        "quantite_prevue", "prix_vente_unitaire", "etat_rentabilite",
    ]
    readonly_fields = ["prix_vente_unitaire", "etat_rentabilite"]
    ordering = ["numero_ordre"]


@admin.register(EtudeEconomique)
class EtudeEconomiqueAdmin(admin.ModelAdmin):
    list_display = [
        "intitule", "projet", "statut", "version",
        "total_prix_vente", "taux_marge_nette_global", "date_modification",
    ]
    list_filter = ["statut", "est_variante"]
    search_fields = ["intitule", "projet__reference"]
    readonly_fields = [
        "total_debourse_sec", "total_cout_direct", "total_cout_revient",
        "total_prix_vente", "total_marge_brute", "total_marge_nette",
        "taux_marge_nette_global", "date_creation", "date_modification",
    ]
    raw_id_fields = ["projet", "lot", "etude_parente", "cree_par"]
    inlines = [LignePrixInline]


@admin.register(LignePrix)
class LignePrixAdmin(admin.ModelAdmin):
    list_display = [
        "code", "designation", "unite", "quantite_prevue",
        "prix_vente_unitaire", "etat_rentabilite", "etude",
    ]
    list_filter = ["etat_rentabilite"]
    search_fields = ["code", "designation"]
    readonly_fields = [
        "debourse_sec_unitaire", "cout_direct_unitaire", "cout_revient_unitaire",
        "prix_vente_unitaire", "marge_brute_unitaire", "marge_nette_unitaire",
        "taux_marge_nette", "marge_brute_totale", "marge_nette_totale",
        "contribution_marge", "etat_rentabilite", "seuil_quantite_critique",
        "seuil_prix_minimum", "causes_non_rentabilite",
    ]
    raw_id_fields = ["etude", "ref_bibliotheque"]


class LignePrixEtudeInline(admin.TabularInline):
    model = LignePrixEtude
    extra = 0
    fields = ["ordre", "type_ressource", "code", "designation", "unite", "quantite", "cout_unitaire_ht", "montant_ht", "taux_horaire"]
    readonly_fields = ["montant_ht"]
    ordering = ["ordre"]


@admin.register(EtudePrix)
class EtudePrixAdmin(admin.ModelAdmin):
    list_display = [
        "code", "intitule", "lot_type", "millesime",
        "zone_taux_horaire", "statut", "debourse_sec_ht", "date_etude",
    ]
    list_filter = ["statut", "methode", "lot_type", "millesime", "zone_taux_horaire"]
    search_fields = ["code", "intitule"]
    readonly_fields = [
        "total_mo_ht", "total_matieres_ht", "total_materiel_ht",
        "total_sous_traitance_ht", "total_transport_ht", "total_frais_divers_ht",
        "debourse_sec_ht", "date_creation", "date_modification",
    ]
    raw_id_fields = ["projet", "organisation", "auteur", "validateur", "ligne_bibliotheque"]
    inlines = [LignePrixEtudeInline]
