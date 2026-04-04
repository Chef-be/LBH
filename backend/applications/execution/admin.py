"""Administration Django pour le suivi d'exécution — Plateforme LBH."""

from django.contrib import admin
from .models import SuiviExecution, CompteRenduChantier, SituationTravaux, OrdreService


class CompteRenduInline(admin.TabularInline):
    model = CompteRenduChantier
    extra = 0
    fields = ["numero", "date_reunion", "avancement_physique_pct"]
    ordering = ["-date_reunion"]


class SituationInline(admin.TabularInline):
    model = SituationTravaux
    extra = 0
    fields = ["numero", "periode_debut", "periode_fin", "statut", "montant_cumule_ht"]
    ordering = ["numero"]


class OrdreServiceInline(admin.TabularInline):
    model = OrdreService
    extra = 0
    fields = ["numero", "type_ordre", "date_emission", "objet"]
    ordering = ["numero"]


@admin.register(SuiviExecution)
class SuiviExecutionAdmin(admin.ModelAdmin):
    list_display = [
        "projet", "entreprise_principale",
        "date_os_demarrage", "date_fin_contractuelle", "montant_marche_ht",
    ]
    search_fields = ["projet__reference"]
    raw_id_fields = ["projet", "entreprise_principale"]
    readonly_fields = ["date_creation", "date_modification"]
    inlines = [CompteRenduInline, SituationInline, OrdreServiceInline]


@admin.register(CompteRenduChantier)
class CompteRenduChantierAdmin(admin.ModelAdmin):
    list_display = ["numero", "date_reunion", "suivi", "avancement_physique_pct"]
    ordering = ["-date_reunion"]
    raw_id_fields = ["suivi", "redacteur"]


@admin.register(SituationTravaux)
class SituationTravauxAdmin(admin.ModelAdmin):
    list_display = ["numero", "suivi", "periode_debut", "periode_fin", "statut", "montant_cumule_ht"]
    list_filter = ["statut"]
    raw_id_fields = ["suivi"]


@admin.register(OrdreService)
class OrdreServiceAdmin(admin.ModelAdmin):
    list_display = ["numero", "type_ordre", "date_emission", "objet", "suivi"]
    list_filter = ["type_ordre"]
    raw_id_fields = ["suivi"]
