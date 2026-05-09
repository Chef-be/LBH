"""Sérialiseurs pour les paramètres système — Plateforme LBH."""

from rest_framework import serializers
from .models import (
    ConfigurationIAFonctionnelle,
    CorrectionIA,
    FonctionnaliteActivable,
    JournalModificationParametre,
    Parametre,
    TraitementIA,
)


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


class ConfigurationIAFonctionnelleSerialiseur(serializers.ModelSerializer):
    module_libelle = serializers.CharField(source="get_module_display", read_only=True)
    fournisseur_libelle = serializers.CharField(source="get_fournisseur_display", read_only=True)

    class Meta:
        model = ConfigurationIAFonctionnelle
        fields = [
            "id", "code", "libelle", "module", "module_libelle",
            "fournisseur", "fournisseur_libelle", "modele", "modele_fallback",
            "temperature", "top_p", "max_tokens",
            "prompt_systeme", "prompt_controle", "schema_sortie",
            "seuil_confiance", "seuil_validation_automatique",
            "activer_correction_texte", "activer_normalisation",
            "activer_classification", "activer_rapprochement",
            "activer_generation", "activer_validation_auto",
            "validation_humaine_obligatoire", "cout_max_par_traitement",
            "est_actif", "date_creation", "date_modification",
        ]
        read_only_fields = ["id", "date_creation", "date_modification", "module_libelle", "fournisseur_libelle"]

    def validate(self, attrs):
        fournisseur = attrs.get("fournisseur", getattr(self.instance, "fournisseur", "openai"))
        modele = attrs.get("modele", getattr(self.instance, "modele", ""))
        if fournisseur == "openai" and not modele:
            raise serializers.ValidationError({"modele": "Le modèle doit rester paramétrable et renseigné pour ce fournisseur."})
        return attrs


class CorrectionIASerialiseur(serializers.ModelSerializer):
    class Meta:
        model = CorrectionIA
        fields = [
            "id", "traitement", "objet_type", "objet_id", "champ",
            "valeur_originale", "valeur_proposee", "statut",
            "justification", "date_creation",
        ]
        read_only_fields = ["id", "date_creation"]


class TraitementIASerialiseur(serializers.ModelSerializer):
    configuration_libelle = serializers.CharField(source="configuration.libelle", read_only=True)
    utilisateur_nom = serializers.SerializerMethodField()
    corrections = CorrectionIASerialiseur(many=True, read_only=True)

    class Meta:
        model = TraitementIA
        fields = [
            "id", "module", "objet_type", "objet_id", "configuration",
            "configuration_libelle", "statut", "entree", "sortie",
            "score_confiance", "cout_estime", "cout_reel",
            "utilisateur", "utilisateur_nom", "date_creation", "date_fin",
            "erreur", "corrections",
        ]
        read_only_fields = ["id", "utilisateur", "date_creation", "date_fin", "corrections", "utilisateur_nom"]

    def get_utilisateur_nom(self, obj):
        if obj.utilisateur:
            return obj.utilisateur.nom_complet
        return None
