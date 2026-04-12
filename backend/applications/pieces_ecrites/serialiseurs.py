"""Sérialiseurs pour les pièces écrites — Plateforme LBH."""

import json

from rest_framework import serializers
from .models import ModeleDocument, PieceEcrite, ArticleCCTP, LotCCTP, ChapitrePrescrip, PrescriptionCCTP, GenerateurCCTP


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


class PrescriptionCCTPSerialiseur(serializers.ModelSerializer):
    type_libelle = serializers.CharField(source="get_type_prescription_display", read_only=True)
    niveau_libelle = serializers.CharField(source="get_niveau_display", read_only=True)
    lot_numero = serializers.CharField(source="lot.numero", read_only=True)
    chapitre_intitule = serializers.CharField(source="chapitre.intitule", read_only=True)

    class Meta:
        model = PrescriptionCCTP
        fields = [
            "id", "lot", "lot_numero", "chapitre", "chapitre_intitule",
            "code", "intitule", "corps",
            "type_prescription", "type_libelle",
            "niveau", "niveau_libelle",
            "normes", "tags", "source",
            "contient_variables", "est_actif", "ordre",
            "date_creation", "date_modification",
        ]
        read_only_fields = ["id", "date_creation", "date_modification"]


class ChapitrePrescripSerialiseur(serializers.ModelSerializer):
    prescriptions = PrescriptionCCTPSerialiseur(many=True, read_only=True)

    class Meta:
        model = ChapitrePrescrip
        fields = ["id", "lot", "numero", "intitule", "ordre", "prescriptions"]
        read_only_fields = ["id"]


class LotCCTPSerialiseur(serializers.ModelSerializer):
    chapitres = ChapitrePrescripSerialiseur(many=True, read_only=True)
    numero_libelle = serializers.CharField(source="get_numero_display", read_only=True)
    nb_prescriptions = serializers.SerializerMethodField()

    class Meta:
        model = LotCCTP
        fields = [
            "id", "numero", "numero_libelle", "intitule", "description",
            "normes_principales", "est_actif", "ordre",
            "nb_prescriptions", "chapitres",
        ]
        read_only_fields = ["id"]

    def get_nb_prescriptions(self, obj):
        return obj.prescriptions.filter(est_actif=True).count()


class GenerateurCCTPCreationSerialiseur(serializers.Serializer):
    projet_id = serializers.UUIDField()
    intitule = serializers.CharField(max_length=300)
    lots = serializers.ListField(
        child=serializers.CharField(max_length=10),
        required=False, default=list,
    )
    prescriptions_exclues = serializers.ListField(
        child=serializers.UUIDField(),
        required=False, default=list,
    )
    variables = serializers.DictField(
        child=serializers.CharField(allow_blank=True),
        required=False, default=dict,
    )
