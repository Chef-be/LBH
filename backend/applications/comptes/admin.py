"""
Administration Django pour les comptes — Plateforme BEE.
"""

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.utils.html import format_html

from .models import DroitFin, JournalConnexion, ProfilDroit, Utilisateur


class DroitFinInline(admin.TabularInline):
    model = DroitFin
    extra = 0
    fields = ["code", "module", "action", "accorde"]
    fk_name = "utilisateur"


@admin.register(Utilisateur)
class AdminUtilisateur(UserAdmin):
    list_display = [
        "courriel", "nom_complet", "organisation",
        "profil", "est_actif", "est_super_admin", "date_creation",
    ]
    list_filter = ["est_actif", "est_super_admin", "profil", "organisation"]
    search_fields = ["courriel", "prenom", "nom"]
    ordering = ["nom", "prenom"]
    inlines = [DroitFinInline]

    fieldsets = (
        (None, {"fields": ("courriel", "password")}),
        ("Identité", {"fields": ("prenom", "nom", "telephone", "fonction", "avatar")}),
        ("Organisation", {"fields": ("organisation", "profil")}),
        ("Statut", {"fields": ("est_actif", "est_staff", "est_super_admin")}),
        ("Sécurité", {"fields": ("tentatives_connexion", "verrouille_jusqu_au")}),
        ("Préférences", {"fields": ("langue", "fuseau_horaire", "notifications_courriel")}),
        ("Permissions Django", {"fields": ("groups", "user_permissions"), "classes": ("collapse",)}),
    )
    add_fieldsets = (
        (None, {
            "classes": ("wide",),
            "fields": ("courriel", "prenom", "nom", "password1", "password2"),
        }),
    )

    def nom_complet(self, obj):
        return obj.nom_complet
    nom_complet.short_description = "Nom complet"


@admin.register(ProfilDroit)
class AdminProfilDroit(admin.ModelAdmin):
    list_display = ["code", "libelle", "est_actif", "ordre_affichage"]
    list_filter = ["est_actif"]
    search_fields = ["code", "libelle"]
    ordering = ["ordre_affichage"]

    inlines = [
        type("DroitFinProfilInline", (admin.TabularInline,), {
            "model": DroitFin,
            "extra": 0,
            "fields": ["code", "module", "action", "accorde"],
            "fk_name": "profil",
        })
    ]


@admin.register(JournalConnexion)
class AdminJournalConnexion(admin.ModelAdmin):
    list_display = [
        "courriel_saisi", "succes_formate", "adresse_ip",
        "date_tentative", "motif_echec",
    ]
    list_filter = ["succes"]
    search_fields = ["courriel_saisi", "adresse_ip"]
    ordering = ["-date_tentative"]
    readonly_fields = [
        "utilisateur", "courriel_saisi", "date_tentative",
        "succes", "adresse_ip", "agent_navigateur", "motif_echec",
    ]

    def succes_formate(self, obj):
        if obj.succes:
            return format_html('<span style="color:green">✓ Succès</span>')
        return format_html('<span style="color:red">✗ Échec</span>')
    succes_formate.short_description = "Résultat"

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
