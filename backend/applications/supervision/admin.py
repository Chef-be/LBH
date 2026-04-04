"""Administration Django pour la supervision — Plateforme LBH."""

from django.contrib import admin
from .models import EvenementSysteme, MetriqueService, AlerteSupervision


@admin.register(EvenementSysteme)
class EvenementSystemeAdmin(admin.ModelAdmin):
    list_display = ["niveau", "categorie", "message", "source", "date_evenement", "resolu"]
    list_filter = ["niveau", "categorie", "resolu"]
    search_fields = ["message", "source"]
    readonly_fields = ["date_evenement", "date_resolution"]
    raw_id_fields = ["utilisateur"]
    ordering = ["-date_evenement"]


@admin.register(MetriqueService)
class MetriqueServiceAdmin(admin.ModelAdmin):
    list_display = ["service", "disponible", "temps_reponse_ms", "charge_cpu_pct", "horodatage"]
    list_filter = ["service", "disponible"]
    readonly_fields = ["horodatage"]
    ordering = ["-horodatage"]


@admin.register(AlerteSupervision)
class AlerteSupervisionAdmin(admin.ModelAdmin):
    list_display = ["titre", "type_alerte", "niveau", "service_concerne", "est_active", "date_declenchement"]
    list_filter = ["type_alerte", "niveau", "est_active"]
    search_fields = ["titre", "description"]
    readonly_fields = ["date_declenchement"]
    raw_id_fields = ["acquittee_par"]
