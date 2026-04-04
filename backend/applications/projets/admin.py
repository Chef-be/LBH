"""
Administration Django pour les projets — Plateforme LBH.
"""

from django.contrib import admin
from .models import Intervenant, Lot, Projet


class LotInline(admin.TabularInline):
    model = Lot
    extra = 0
    fields = ["numero", "intitule", "montant_estime"]


class IntervenantInline(admin.TabularInline):
    model = Intervenant
    extra = 0
    fields = ["utilisateur", "role", "date_debut", "date_fin"]
    autocomplete_fields = ["utilisateur"]


@admin.register(Projet)
class AdminProjet(admin.ModelAdmin):
    list_display = [
        "reference", "intitule_court", "type_projet",
        "statut", "organisation", "responsable",
        "montant_estime", "date_modification",
    ]
    list_filter = ["statut", "type_projet", "organisation"]
    search_fields = ["reference", "intitule", "commune"]
    ordering = ["-date_modification"]
    readonly_fields = ["reference", "date_creation", "date_modification"]
    inlines = [LotInline, IntervenantInline]

    fieldsets = (
        ("Identification", {"fields": ("reference", "intitule", "type_projet", "statut", "phase_actuelle")}),
        ("Parties prenantes", {"fields": ("organisation", "maitre_ouvrage", "maitre_oeuvre", "responsable")}),
        ("Localisation", {"fields": ("commune", "departement")}),
        ("Calendrier", {"fields": ("date_debut_prevue", "date_fin_prevue", "date_debut_reelle", "date_fin_reelle")}),
        ("Financier", {"fields": ("montant_estime", "montant_marche", "honoraires_prevus")}),
        ("Notes", {"fields": ("description", "observations", "publier_sur_site")}),
        ("Métadonnées", {"fields": ("date_creation", "date_modification"), "classes": ("collapse",)}),
    )

    def intitule_court(self, obj):
        return obj.intitule[:60]
    intitule_court.short_description = "Intitulé"


@admin.register(Lot)
class AdminLot(admin.ModelAdmin):
    list_display = ["projet", "numero", "intitule", "montant_estime"]
    list_filter = ["projet__organisation"]
    search_fields = ["intitule", "projet__reference"]
    autocomplete_fields = ["projet"]
