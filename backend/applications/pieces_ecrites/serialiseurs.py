"""Sérialiseurs pour les pièces écrites — Plateforme LBH."""

import json

from rest_framework import serializers
from .models import ModeleDocument, PieceEcrite, ArticleCCTP


class ModeleDocumentSerialiseur(serializers.ModelSerializer):
    type_libelle = serializers.CharField(source="get_type_document_display", read_only=True)
    supprimer_gabarit = serializers.BooleanField(write_only=True, required=False, default=False)

    class Meta:
        model = ModeleDocument
        fields = [
            "id", "code", "libelle", "type_document", "type_libelle",
            "description", "gabarit", "variables_fusion", "contenu_modele_html",
            "supprimer_gabarit", "est_actif",
            "date_creation", "date_modification",
        ]
        read_only_fields = ["id", "date_creation", "date_modification", "type_libelle"]

    def to_internal_value(self, data):
        donnees = data.copy()
        variables = donnees.get("variables_fusion")
        if isinstance(variables, str):
            try:
                donnees["variables_fusion"] = json.loads(variables)
            except json.JSONDecodeError as exc:
                raise serializers.ValidationError(
                    {"variables_fusion": "Les variables de fusion doivent être un JSON valide."}
                ) from exc
        return super().to_internal_value(donnees)

    def validate_variables_fusion(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("Les variables de fusion doivent être fournies sous forme de liste.")
        variables_normalisees = []
        for index, variable in enumerate(value):
            if not isinstance(variable, dict):
                raise serializers.ValidationError(f"Variable #{index + 1} invalide.")
            nom = str(variable.get("nom") or "").strip()
            if not nom:
                raise serializers.ValidationError(f"Le nom de la variable #{index + 1} est obligatoire.")
            variables_normalisees.append(
                {
                    "nom": nom,
                    "description": str(variable.get("description") or "").strip(),
                    "exemple": str(variable.get("exemple") or "").strip(),
                }
            )
        return variables_normalisees

    def update(self, instance, validated_data):
        supprimer_gabarit = validated_data.pop("supprimer_gabarit", False)
        if supprimer_gabarit and instance.gabarit:
            instance.gabarit.delete(save=False)
            instance.gabarit = None
        return super().update(instance, validated_data)


class ArticleCCTPSerialiseur(serializers.ModelSerializer):
    class Meta:
        model = ArticleCCTP
        fields = [
            "id", "piece_ecrite", "chapitre", "numero_article",
            "code_reference", "intitule", "corps_article",
            "source", "source_url", "ligne_prix_reference",
            "normes_applicables", "est_dans_bibliotheque", "tags",
            "date_creation", "date_modification",
        ]
        read_only_fields = ["id", "date_creation", "date_modification"]
        extra_kwargs = {
            "piece_ecrite": {"required": False, "allow_null": True},
        }


class PieceEcriteListeSerialiseur(serializers.ModelSerializer):
    modele_libelle = serializers.CharField(source="modele.libelle", read_only=True)
    modele_type_document = serializers.CharField(source="modele.type_document", read_only=True)
    statut_libelle = serializers.CharField(source="get_statut_display", read_only=True)
    projet_reference = serializers.CharField(source="projet.reference", read_only=True)
    modele_variables_fusion = serializers.JSONField(source="modele.variables_fusion", read_only=True)

    class Meta:
        model = PieceEcrite
        fields = [
            "id", "projet", "projet_reference", "lot",
            "modele", "modele_libelle", "modele_type_document",
            "modele_variables_fusion",
            "intitule", "statut", "statut_libelle",
            "date_creation", "date_modification",
        ]


class PieceEcriteDetailSerialiseur(serializers.ModelSerializer):
    articles = ArticleCCTPSerialiseur(many=True, read_only=True)
    modele_libelle = serializers.CharField(source="modele.libelle", read_only=True)
    modele_type_document = serializers.CharField(source="modele.type_document", read_only=True)
    statut_libelle = serializers.CharField(source="get_statut_display", read_only=True)
    projet_reference = serializers.CharField(source="projet.reference", read_only=True)
    redacteur_nom = serializers.SerializerMethodField()
    modele_variables_fusion = serializers.JSONField(source="modele.variables_fusion", read_only=True)

    class Meta:
        model = PieceEcrite
        fields = [
            "id", "projet", "projet_reference", "lot",
            "modele", "modele_libelle", "modele_type_document",
            "intitule", "statut", "statut_libelle",
            "contenu_html", "variables_personnalisees",
            "fichier_genere", "document_ged", "date_generation",
            "redacteur", "redacteur_nom",
            "modele_variables_fusion",
            "articles",
            "date_creation", "date_modification",
        ]
        read_only_fields = [
            "id", "date_creation", "date_modification", "date_generation",
            "modele_libelle", "statut_libelle", "projet_reference", "redacteur_nom",
            "document_ged",
        ]
        extra_kwargs = {
            "redacteur": {"required": False, "allow_null": True},
            "lot": {"required": False, "allow_null": True},
        }

    def get_redacteur_nom(self, obj):
        if obj.redacteur:
            return f"{obj.redacteur.prenom} {obj.redacteur.nom}"
        return None
