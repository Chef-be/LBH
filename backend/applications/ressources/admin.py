from django.contrib import admin

from .models import (
    DevisAnalyse,
    EstimationSource,
    FicheRatioCout,
    IndiceRevisionPrix,
    LignePrixMarche,
    ModeleMappingDocumentPrix,
)


@admin.register(IndiceRevisionPrix)
class IndiceRevisionPrixAdmin(admin.ModelAdmin):
    list_display = ("code", "valeur", "date_publication", "source")
    list_filter = ("code", "source")
    ordering = ("code", "-date_publication")
    search_fields = ("code",)


class LignePrixMarcheInline(admin.TabularInline):
    model = LignePrixMarche
    extra = 0
    fields = ("designation", "unite", "prix_ht_original", "corps_etat", "est_ligne_commune", "ligne_bibliotheque")
    readonly_fields = ("est_ligne_commune",)
    show_change_link = True


@admin.register(DevisAnalyse)
class DevisAnalyseAdmin(admin.ModelAdmin):
    list_display = ("nom_original", "entreprise", "localite", "statut", "capitalise", "date_creation")
    list_filter = ("statut", "capitalise", "type_document")
    search_fields = ("nom_original", "entreprise", "localite")
    readonly_fields = ("date_creation", "date_modification")
    ordering = ("-date_creation",)
    inlines = [LignePrixMarcheInline]


@admin.register(LignePrixMarche)
class LignePrixMarcheAdmin(admin.ModelAdmin):
    list_display = ("designation", "unite", "prix_ht_original", "corps_etat", "localite", "est_ligne_commune", "nb_occurrences")
    list_filter = ("corps_etat", "est_ligne_commune")
    search_fields = ("designation", "localite")
    ordering = ("-nb_occurrences", "designation")
    readonly_fields = ("designation_normalisee",)


@admin.register(ModeleMappingDocumentPrix)
class ModeleMappingDocumentPrixAdmin(admin.ModelAdmin):
    list_display = ("nom", "type_document", "entreprise_source", "est_actif", "date_modification")
    list_filter = ("type_document", "est_actif")
    search_fields = ("nom", "entreprise_source")
    readonly_fields = ("date_creation", "date_modification")


@admin.register(EstimationSource)
class EstimationSourceAdmin(admin.ModelAdmin):
    list_display = ("nom_original", "type_document", "statut", "date_creation")
    list_filter = ("statut", "type_document")
    search_fields = ("nom_original",)
    ordering = ("-date_creation",)


@admin.register(FicheRatioCout)
class FicheRatioCoutAdmin(admin.ModelAdmin):
    list_display = ("intitule", "type_projet", "localite", "annee_reference", "cout_total_ht", "cout_m2_shon")
    list_filter = ("type_projet", "type_fondation")
    search_fields = ("intitule", "localite")
    ordering = ("-date_creation",)
