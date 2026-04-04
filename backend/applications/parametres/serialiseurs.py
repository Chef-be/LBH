"""Sérialiseurs pour les paramètres système — Plateforme LBH."""

from rest_framework import serializers
from .models import Parametre, FonctionnaliteActivable, JournalModificationParametre


class ParametreSerialiseur(serializers.ModelSerializer):
    valeur_typee = serializers.SerializerMethodField()
    modifie_par_nom = serializers.SerializerMethodField()

    class Meta:
        model = Parametre
        fields = [
            "id", "cle", "libelle", "description", "module",
            "type_valeur", "valeur", "valeur_typee", "valeur_par_defaut",
            "est_verrouille",
            "modifie_par", "modifie_par_nom",
            "date_creation", "date_modification",
        ]
        read_only_fields = [
            "id", "cle", "type_valeur", "module", "valeur_par_defaut",
            "est_verrouille", "date_creation", "date_modification",
            "valeur_typee", "modifie_par_nom",
        ]

    def get_valeur_typee(self, obj):
        try:
            return obj.valeur_typee()
        except Exception:
            return None

    def get_modifie_par_nom(self, obj):
        if obj.modifie_par:
            return f"{obj.modifie_par.prenom} {obj.modifie_par.nom}"
        return None

    def validate_valeur(self, valeur):
        instance = self.instance
        if instance and instance.est_verrouille:
            raise serializers.ValidationError(
                "Ce paramètre est verrouillé et ne peut pas être modifié via l'API."
            )
        return valeur


class JournalModificationSerialiseur(serializers.ModelSerializer):
    modifie_par_nom = serializers.SerializerMethodField()
    cle_parametre = serializers.CharField(source="parametre.cle", read_only=True)

    class Meta:
        model = JournalModificationParametre
        fields = [
            "id", "parametre", "cle_parametre",
            "ancienne_valeur", "nouvelle_valeur",
            "modifie_par", "modifie_par_nom",
            "date_modification",
        ]
        read_only_fields = fields

    def get_modifie_par_nom(self, obj):
        if obj.modifie_par:
            return f"{obj.modifie_par.prenom} {obj.modifie_par.nom}"
        return None


class FonctionnaliteActivableSerialiseur(serializers.ModelSerializer):
    niveau_libelle = serializers.CharField(source="get_niveau_controle_display", read_only=True)
    modifie_par_nom = serializers.SerializerMethodField()

    class Meta:
        model = FonctionnaliteActivable
        fields = [
            "id", "code", "libelle", "description",
            "est_active", "niveau_controle", "niveau_libelle",
            "organisation", "profil", "utilisateur",
            "modules_dependants",
            "modifie_par", "modifie_par_nom",
            "date_modification",
        ]
        read_only_fields = [
            "id", "code", "libelle", "description",
            "niveau_controle", "modules_dependants",
            "date_modification", "niveau_libelle", "modifie_par_nom",
        ]

    def get_modifie_par_nom(self, obj):
        if obj.modifie_par:
            return f"{obj.modifie_par.prenom} {obj.modifie_par.nom}"
        return None
