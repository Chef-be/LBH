"""Sérialiseurs pour les organisations — Plateforme LBH."""

from rest_framework import serializers
from .models import Organisation, GroupeUtilisateurs


class OrganisationSerialiseur(serializers.ModelSerializer):
    nombre_membres = serializers.SerializerMethodField()

    class Meta:
        model = Organisation
        fields = [
            "id", "code", "nom", "type_organisation",
            "siret", "adresse", "code_postal", "ville", "pays",
            "telephone", "courriel", "site_web", "logo",
            "est_active", "organisation_parente",
            "nombre_membres", "date_creation",
        ]
        read_only_fields = ["id", "date_creation"]

    def get_nombre_membres(self, obj):
        return obj.membres.count()


class GroupeUtilisateursSerialiseur(serializers.ModelSerializer):
    class Meta:
        model = GroupeUtilisateurs
        fields = ["id", "organisation", "nom", "description", "membres"]
        extra_kwargs = {
            "organisation": {"required": False, "allow_null": True},
        }
