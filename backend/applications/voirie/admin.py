"""Administration Django pour les études de voirie — Plateforme BEE."""

from django.contrib import admin
from .models import EtudeVoirie


@admin.register(EtudeVoirie)
class EtudeVoirieAdmin(admin.ModelAdmin):
    list_display = [
        "intitule", "projet", "type_voie",
        "tmja_pl", "cbr", "calcul_conforme", "date_modification",
    ]
    list_filter = ["type_voie", "zone_climatique", "calcul_conforme"]
    search_fields = ["intitule", "projet__reference"]
    readonly_fields = ["resultats_calcul", "date_calcul", "calcul_conforme", "date_creation", "date_modification"]
    raw_id_fields = ["projet", "lot", "cree_par"]
