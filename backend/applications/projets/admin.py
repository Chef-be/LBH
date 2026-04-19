"""
Administration Django pour les projets — Plateforme LBH.
"""

from django.contrib import admin
from django.utils.html import format_html
from .models import Intervenant, Lot, Projet, MissionClient, LivrableType, ModeleDocument


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


# ─── Missions clients ─────────────────────────────────────────────────────────

class LivrableInline(admin.TabularInline):
    model = LivrableType.missions.through
    extra = 0
    verbose_name = "Livrable associé"
    verbose_name_plural = "Livrables associés"


@admin.register(MissionClient)
class AdminMissionClient(admin.ModelAdmin):
    list_display = [
        "libelle", "famille_client_badge", "nature_ouvrage",
        "est_obligatoire", "est_active", "ordre",
    ]
    list_filter = ["famille_client", "nature_ouvrage", "est_active", "est_obligatoire"]
    search_fields = ["code", "libelle"]
    ordering = ["famille_client", "ordre"]
    prepopulated_fields = {"code": ("libelle",)}
    inlines = [LivrableInline]
    fieldsets = (
        ("Identification", {"fields": ("code", "libelle", "description")}),
        ("Classification client", {"fields": ("famille_client", "sous_types_client", "nature_ouvrage")}),
        ("Paramètres mission", {"fields": ("phases_concernees", "est_obligatoire", "est_active")}),
        ("Affichage", {"fields": ("icone", "couleur", "ordre")}),
    )

    def famille_client_badge(self, obj):
        couleurs = {
            "maitrise_ouvrage": "#3b82f6",
            "maitrise_oeuvre": "#8b5cf6",
            "entreprise": "#f59e0b",
            "autre": "#6b7280",
        }
        couleur = couleurs.get(obj.famille_client, "#6b7280")
        return format_html(
            '<span style="background:{};color:white;padding:2px 8px;border-radius:9999px;font-size:11px">{}</span>',
            couleur,
            obj.get_famille_client_display(),
        )
    famille_client_badge.short_description = "Famille client"


@admin.register(LivrableType)
class AdminLivrableType(admin.ModelAdmin):
    list_display = ["libelle", "type_document", "format_attendu", "est_active", "ordre"]
    list_filter = ["type_document", "format_attendu", "est_active"]
    search_fields = ["code", "libelle"]
    ordering = ["ordre", "libelle"]
    prepopulated_fields = {"code": ("libelle",)}
    filter_horizontal = ["missions"]
    fieldsets = (
        ("Identification", {"fields": ("code", "libelle", "description")}),
        ("Type et format", {"fields": ("type_document", "format_attendu")}),
        ("Missions associées", {"fields": ("missions",)}),
        ("Affichage", {"fields": ("icone", "couleur", "ordre", "est_active")}),
    )


# ─── Modèles de documents ─────────────────────────────────────────────────────

@admin.register(ModeleDocument)
class AdminModeleDocument(admin.ModelAdmin):
    list_display = [
        "libelle", "type_modele", "format_sortie",
        "apercu_miniature", "est_actif", "ordre",
    ]
    list_filter = ["type_modele", "format_sortie", "est_actif"]
    search_fields = ["code", "libelle"]
    ordering = ["type_modele", "ordre"]
    prepopulated_fields = {"code": ("libelle",)}
    readonly_fields = ["date_creation", "date_modification", "apercu_miniature"]
    fieldsets = (
        ("Identification", {"fields": ("code", "libelle", "description")}),
        ("Type et format", {"fields": ("type_modele", "format_sortie", "familles_client")}),
        ("Fichiers", {"fields": ("template_fichier", "apercu_image", "apercu_miniature")}),
        ("Variables paramétrables", {
            "fields": ("variables_parametrables",),
            "description": 'JSON: [{"code": "nom_projet", "libelle": "Nom du projet", "type": "texte", "obligatoire": true}]',
        }),
        ("Statut", {"fields": ("est_actif", "ordre")}),
        ("Métadonnées", {"fields": ("date_creation", "date_modification"), "classes": ("collapse",)}),
    )

    def apercu_miniature(self, obj):
        if obj.apercu_image:
            return format_html(
                '<img src="{}" style="max-height:80px;border-radius:4px;" />',
                obj.apercu_image.url,
            )
        return "—"
    apercu_miniature.short_description = "Aperçu"
