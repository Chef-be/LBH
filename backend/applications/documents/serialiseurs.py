"""Sérialiseurs pour la gestion documentaire — Plateforme LBH."""

from rest_framework import serializers
from .models import (
    TypeDocument,
    DossierDocumentProjet,
    Document,
    AnnotationDocument,
    DiffusionDocument,
)
from .services import extraire_suggestions_document


class TypeDocumentSerialiseur(serializers.ModelSerializer):
    class Meta:
        model = TypeDocument
        fields = ["id", "code", "libelle", "description", "icone", "ordre_affichage"]
        read_only_fields = ["id"]


class DossierDocumentProjetSerialiseur(serializers.ModelSerializer):
    parent_intitule = serializers.CharField(source="parent.intitule", read_only=True)
    chemin = serializers.SerializerMethodField()
    niveau = serializers.SerializerMethodField()

    class Meta:
        model = DossierDocumentProjet
        fields = [
            "id", "projet", "parent", "parent_intitule",
            "code", "intitule", "description",
            "chemin", "niveau",
            "ordre", "est_systeme",
            "date_creation", "date_modification",
        ]
        read_only_fields = ["id", "date_creation", "date_modification", "parent_intitule"]

    def get_chemin(self, obj):
        segments = [obj.intitule]
        parent = obj.parent
        while parent:
            segments.append(parent.intitule)
            parent = parent.parent
        return " / ".join(reversed(segments))

    def get_niveau(self, obj):
        niveau = 0
        parent = obj.parent
        while parent:
            niveau += 1
            parent = parent.parent
        return niveau


class AnnotationDocumentSerialiseur(serializers.ModelSerializer):
    auteur_nom = serializers.SerializerMethodField()

    class Meta:
        model = AnnotationDocument
        fields = [
            "id", "document", "auteur", "auteur_nom",
            "contenu", "page", "resolue", "date_creation",
        ]
        read_only_fields = ["id", "auteur_nom", "date_creation"]
        extra_kwargs = {
            "document": {"required": False, "allow_null": True},
            "auteur": {"required": False, "allow_null": True},
        }

    def get_auteur_nom(self, obj):
        return f"{obj.auteur.prenom} {obj.auteur.nom}"


class DiffusionDocumentSerialiseur(serializers.ModelSerializer):
    destinataire_nom = serializers.CharField(source="destinataire.nom", read_only=True)
    mode_libelle = serializers.CharField(source="get_mode_diffusion_display", read_only=True)

    class Meta:
        model = DiffusionDocument
        fields = [
            "id", "document", "destinataire", "destinataire_nom",
            "destinataire_contact", "mode_diffusion", "mode_libelle",
            "date_diffusion", "observations",
        ]
        read_only_fields = ["id", "date_diffusion", "destinataire_nom", "mode_libelle"]
        extra_kwargs = {
            "document": {"required": False, "allow_null": True},
        }


class DocumentListeSerialiseur(serializers.ModelSerializer):
    type_libelle = serializers.CharField(source="type_document.libelle", read_only=True)
    statut_libelle = serializers.CharField(source="get_statut_display", read_only=True)
    auteur_nom = serializers.SerializerMethodField()
    projet_reference = serializers.CharField(source="projet.reference", read_only=True)
    dossier_libelle = serializers.CharField(source="dossier.intitule", read_only=True)
    dossier_chemin = serializers.SerializerMethodField()
    suggestions_classement = serializers.SerializerMethodField()

    class Meta:
        model = Document
        fields = [
            "id", "reference", "intitule",
            "type_document", "type_libelle",
            "projet", "projet_reference", "lot", "dossier", "dossier_libelle", "dossier_chemin",
            "version", "est_version_courante",
            "statut", "statut_libelle", "origine",
            "fichier", "nom_fichier_origine", "taille_octets", "type_mime",
            "analyse_automatique_effectuee", "date_analyse_automatique",
            "suggestions_classement",
            "auteur", "auteur_nom",
            "date_creation", "date_modification",
        ]

    def get_auteur_nom(self, obj):
        if obj.auteur:
            return f"{obj.auteur.prenom} {obj.auteur.nom}"
        return None

    def get_dossier_chemin(self, obj):
        if not obj.dossier:
            return None
        segments = [obj.dossier.intitule]
        parent = obj.dossier.parent
        while parent:
            segments.append(parent.intitule)
            parent = parent.parent
        return " / ".join(reversed(segments))

    def get_suggestions_classement(self, obj):
        return extraire_suggestions_document(obj)


class DocumentDetailSerialiseur(serializers.ModelSerializer):
    type_libelle = serializers.CharField(source="type_document.libelle", read_only=True)
    statut_libelle = serializers.CharField(source="get_statut_display", read_only=True)
    auteur_nom = serializers.SerializerMethodField()
    valide_par_nom = serializers.SerializerMethodField()
    projet_reference = serializers.CharField(source="projet.reference", read_only=True)
    dossier_libelle = serializers.CharField(source="dossier.intitule", read_only=True)
    dossier_chemin = serializers.SerializerMethodField()
    annotations = AnnotationDocumentSerialiseur(many=True, read_only=True)
    diffusions = DiffusionDocumentSerialiseur(many=True, read_only=True)
    suggestions_classement = serializers.SerializerMethodField()

    class Meta:
        model = Document
        fields = [
            "id", "reference", "intitule",
            "type_document", "type_libelle",
            "projet", "projet_reference", "lot", "dossier", "dossier_libelle", "dossier_chemin",
            "version", "est_version_courante", "document_parent",
            "fichier", "nom_fichier_origine", "taille_octets", "type_mime", "empreinte_sha256",
            "statut", "statut_libelle", "origine",
            "ocr_effectue", "contenu_texte", "mots_cles",
            "analyse_automatique_effectuee", "date_analyse_automatique", "analyse_automatique",
            "suggestions_classement",
            "auteur", "auteur_nom",
            "date_creation", "date_modification", "date_validation",
            "valide_par", "valide_par_nom",
            "acces_client", "acces_partenaire", "confidentiel",
            "annotations", "diffusions",
        ]
        read_only_fields = [
            "id", "date_creation", "date_modification",
            "est_version_courante", "document_parent",
            "empreinte_sha256", "ocr_effectue", "contenu_texte", "mots_cles",
            "analyse_automatique_effectuee", "date_analyse_automatique", "analyse_automatique",
            "auteur", "auteur_nom",
            "date_validation", "valide_par", "valide_par_nom",
            "type_libelle", "statut_libelle",
        ]
        extra_kwargs = {
            "projet": {"required": False, "allow_null": True},
            "lot": {"required": False, "allow_null": True},
            "dossier": {"required": False, "allow_null": True},
            "type_document": {"required": False, "allow_null": True},
        }

    def get_auteur_nom(self, obj):
        if obj.auteur:
            return f"{obj.auteur.prenom} {obj.auteur.nom}"
        return None

    def get_valide_par_nom(self, obj):
        if obj.valide_par:
            return f"{obj.valide_par.prenom} {obj.valide_par.nom}"
        return None

    def get_dossier_chemin(self, obj):
        if not obj.dossier:
            return None
        segments = [obj.dossier.intitule]
        parent = obj.dossier.parent
        while parent:
            segments.append(parent.intitule)
            parent = parent.parent
        return " / ".join(reversed(segments))

    def get_suggestions_classement(self, obj):
        return extraire_suggestions_document(obj)
