"""Administration Django pour les paramètres système — Plateforme LBH."""

from django.contrib import admin
from .models import Parametre, FonctionnaliteActivable, JournalModificationParametre


class JournalInline(admin.TabularInline):
    model = JournalModificationParametre
    extra = 0
    fields = ["ancienne_valeur", "nouvelle_valeur", "modifie_par", "date_modification"]
    readonly_fields = ["ancienne_valeur", "nouvelle_valeur", "modifie_par", "date_modification"]
    ordering = ["-date_modification"]
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(Parametre)
class ParametreAdmin(admin.ModelAdmin):
    list_display = ["cle", "libelle", "module", "type_valeur", "valeur", "est_verrouille"]
    list_filter = ["module", "type_valeur", "est_verrouille"]
    search_fields = ["cle", "libelle"]
    readonly_fields = ["id", "date_creation", "date_modification"]
    ordering = ["module", "cle"]
    inlines = [JournalInline]

    def get_readonly_fields(self, request, obj=None):
        fields = list(super().get_readonly_fields(request, obj))
        if obj and obj.est_verrouille:
            fields += ["valeur"]
        return fields


@admin.register(FonctionnaliteActivable)
class FonctionnaliteActivableAdmin(admin.ModelAdmin):
    list_display = ["code", "libelle", "est_active", "niveau_controle", "date_modification"]
    list_filter = ["est_active", "niveau_controle"]
    search_fields = ["code", "libelle"]
    readonly_fields = ["date_modification"]
    raw_id_fields = ["organisation", "profil", "utilisateur", "modifie_par"]


@admin.register(JournalModificationParametre)
class JournalModificationParametreAdmin(admin.ModelAdmin):
    list_display = ["parametre", "ancienne_valeur", "nouvelle_valeur", "modifie_par", "date_modification"]
    readonly_fields = ["parametre", "ancienne_valeur", "nouvelle_valeur", "modifie_par", "date_modification"]
    ordering = ["-date_modification"]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
