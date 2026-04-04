"""
Sérialiseurs pour l'application Projets — Plateforme LBH.
"""

from rest_framework import serializers
from .models import Projet, Lot, Intervenant
from .services import construire_processus_recommande


class LotSerialiseur(serializers.ModelSerializer):
    class Meta:
        model = Lot
        fields = [
            "id", "numero", "intitule", "description", "montant_estime",
        ]
        extra_kwargs = {
            "projet": {"required": False, "allow_null": True},
        }


class IntervenantSerialiseur(serializers.ModelSerializer):
    utilisateur_nom = serializers.CharField(source="utilisateur.nom_complet", read_only=True)
    role_libelle = serializers.CharField(source="get_role_display", read_only=True)

    class Meta:
        model = Intervenant
        fields = [
            "id", "utilisateur", "utilisateur_nom",
            "role", "role_libelle",
            "date_debut", "date_fin",
        ]
        extra_kwargs = {
            "projet": {"required": False, "allow_null": True},
        }


class ProjetListeSerialiseur(serializers.ModelSerializer):
    """Sérialiseur allégé pour les listes de projets."""

    organisation_nom = serializers.CharField(source="organisation.nom", read_only=True)
    responsable_nom = serializers.CharField(source="responsable.nom_complet", read_only=True)
    type_libelle = serializers.SerializerMethodField()
    clientele_cible_libelle = serializers.CharField(source="get_clientele_cible_display", read_only=True)

    def get_type_libelle(self, obj):
        if obj.type_projet == "autre" and obj.type_projet_autre:
            return obj.type_projet_autre
        return obj.get_type_projet_display()

    class Meta:
        model = Projet
        fields = [
            "id", "reference", "intitule", "type_projet", "type_projet_autre", "type_libelle",
            "clientele_cible", "clientele_cible_libelle", "objectif_mission",
            "statut", "phase_actuelle",
            "organisation", "organisation_nom",
            "responsable", "responsable_nom",
            "commune", "departement",
            "montant_estime", "montant_marche",
            "date_debut_prevue", "date_fin_prevue",
            "date_modification",
        ]


class ProjetDetailSerialiseur(serializers.ModelSerializer):
    """Sérialiseur complet pour la fiche projet."""

    lots = LotSerialiseur(many=True, read_only=True)
    intervenants = IntervenantSerialiseur(many=True, read_only=True)
    organisation_nom = serializers.CharField(source="organisation.nom", read_only=True)
    responsable_nom = serializers.CharField(source="responsable.nom_complet", read_only=True)
    maitre_ouvrage_nom = serializers.CharField(
        source="maitre_ouvrage.nom", read_only=True, allow_null=True,
    )
    maitre_oeuvre_nom = serializers.CharField(
        source="maitre_oeuvre.nom", read_only=True, allow_null=True,
    )
    statut_libelle = serializers.CharField(source="get_statut_display", read_only=True)
    type_libelle = serializers.SerializerMethodField()
    phase_libelle = serializers.CharField(source="get_phase_actuelle_display", read_only=True)
    clientele_cible_libelle = serializers.CharField(source="get_clientele_cible_display", read_only=True)
    objectif_mission_libelle = serializers.CharField(source="get_objectif_mission_display", read_only=True)
    processus_recommande = serializers.SerializerMethodField()
    dossiers_ged = serializers.SerializerMethodField()

    def get_type_libelle(self, obj):
        if obj.type_projet == "autre" and obj.type_projet_autre:
            return obj.type_projet_autre
        return obj.get_type_projet_display()

    def get_processus_recommande(self, obj):
        return construire_processus_recommande(obj)

    def get_dossiers_ged(self, obj):
        return construire_processus_recommande(obj).get("dossiers_ged", [])

    def validate(self, attrs):
        type_projet = attrs.get("type_projet", getattr(self.instance, "type_projet", ""))
        type_projet_autre = attrs.get(
            "type_projet_autre",
            getattr(self.instance, "type_projet_autre", ""),
        )

        if type_projet == "autre" and not (type_projet_autre or "").strip():
            raise serializers.ValidationError(
                {"type_projet_autre": "Veuillez préciser le type de projet."}
            )

        if type_projet != "autre":
            attrs["type_projet_autre"] = ""

        return attrs

    class Meta:
        model = Projet
        fields = [
            "id", "reference", "intitule", "type_projet", "type_projet_autre", "type_libelle",
            "clientele_cible", "clientele_cible_libelle",
            "objectif_mission", "objectif_mission_libelle",
            "statut", "statut_libelle", "phase_actuelle", "phase_libelle",
            "organisation", "organisation_nom",
            "maitre_ouvrage", "maitre_ouvrage_nom",
            "maitre_oeuvre", "maitre_oeuvre_nom",
            "responsable", "responsable_nom",
            "commune", "departement",
            "date_debut_prevue", "date_fin_prevue",
            "date_debut_reelle", "date_fin_reelle",
            "montant_estime", "montant_marche", "honoraires_prevus",
            "description", "observations", "qualification_wizard",
            "processus_recommande",
            "dossiers_ged",
            "publier_sur_site",
            "lots", "intervenants",
            "date_creation", "date_modification",
        ]
        read_only_fields = ["id", "reference", "date_creation", "date_modification"]
        extra_kwargs = {
            "responsable": {"required": False, "allow_null": True},
            "maitre_ouvrage": {"required": False, "allow_null": True},
            "maitre_oeuvre": {"required": False, "allow_null": True},
            "date_debut_prevue": {"required": False, "allow_null": True},
            "date_fin_prevue": {"required": False, "allow_null": True},
            "date_debut_reelle": {"required": False, "allow_null": True},
            "date_fin_reelle": {"required": False, "allow_null": True},
            "montant_estime": {"required": False, "allow_null": True},
            "montant_marche": {"required": False, "allow_null": True},
            "honoraires_prevus": {"required": False, "allow_null": True},
        }
