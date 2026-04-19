"""
Sérialiseurs pour l'application Projets — Plateforme LBH.
"""

from django.utils import timezone
from rest_framework import serializers
from .models import Projet, Lot, Intervenant, PreanalyseSourcesProjet
from .services import (
    construire_processus_recommande,
    construire_suggestion_phase_projet,
    libelle_phase_projet,
    normaliser_phase_projet,
)
from .referentiels import (
    clientele_depuis_famille,
    contexte_projet_pour_projet,
    mode_variation_pour_projet,
    normaliser_contexte_persistant,
    normaliser_mode_variation_persistant,
    objectif_depuis_contexte,
    phase_depuis_contexte,
)


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

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["phase_actuelle"] = normaliser_phase_projet(instance.phase_actuelle)
        return data


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
    phase_libelle = serializers.SerializerMethodField()
    phase_suggeree = serializers.SerializerMethodField()
    clientele_cible_libelle = serializers.CharField(source="get_clientele_cible_display", read_only=True)
    objectif_mission_libelle = serializers.CharField(source="get_objectif_mission_display", read_only=True)
    processus_recommande = serializers.SerializerMethodField()
    dossiers_ged = serializers.SerializerMethodField()
    contexte_projet = serializers.SerializerMethodField()
    mode_variation_prix = serializers.SerializerMethodField()
    statuts_livrables = serializers.SerializerMethodField()
    contexte_projet_saisie = serializers.JSONField(write_only=True, required=False)
    mode_variation_prix_saisie = serializers.JSONField(write_only=True, required=False)

    def get_type_libelle(self, obj):
        if obj.type_projet == "autre" and obj.type_projet_autre:
            return obj.type_projet_autre
        return obj.get_type_projet_display()

    def get_processus_recommande(self, obj):
        return construire_processus_recommande(obj)

    def get_phase_libelle(self, obj):
        return libelle_phase_projet(obj.phase_actuelle)

    def get_phase_suggeree(self, obj):
        return construire_suggestion_phase_projet(obj)

    def get_dossiers_ged(self, obj):
        return construire_processus_recommande(obj).get("dossiers_ged", [])

    def get_contexte_projet(self, obj):
        return contexte_projet_pour_projet(obj)

    def get_mode_variation_prix(self, obj):
        return mode_variation_pour_projet(obj)

    def get_statuts_livrables(self, obj):
        return dict(obj.qualification_wizard or {}).get("statuts_livrables", {})

    def _appliquer_contexte_avance(self, projet, contexte_saisi, mode_variation_saisi):
        qualification = dict(projet.qualification_wizard or {})

        if contexte_saisi is not None:
            contexte_normalise = normaliser_contexte_persistant(contexte_saisi)
            qualification["contexte_projet"] = contexte_normalise
            projet.clientele_cible = clientele_depuis_famille(contexte_normalise["famille_client"])
            projet.objectif_mission = objectif_depuis_contexte(
                famille_client=contexte_normalise["famille_client"],
                mission_principale=contexte_normalise["phase_intervention"] or contexte_normalise["mission_principale"],
                contexte_contractuel=contexte_normalise["contexte_contractuel"],
            )
            projet.phase_actuelle = normaliser_phase_projet(phase_depuis_contexte(
                contexte_normalise["phase_intervention"],
                contexte_normalise["mission_principale"],
            ))
            if not projet.description and contexte_normalise["partie_contractante"]:
                projet.description = f"Partie contractante : {contexte_normalise['partie_contractante']}"

        if mode_variation_saisi is not None:
            qualification["mode_variation_prix"] = normaliser_mode_variation_persistant(mode_variation_saisi)

        projet.qualification_wizard = qualification
        projet.save(
            update_fields=[
                "qualification_wizard",
                "clientele_cible",
                "objectif_mission",
                "phase_actuelle",
                "description",
                "date_modification",
            ]
        )

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

        if "phase_actuelle" in attrs:
            phase_brute = attrs.get("phase_actuelle")
            if phase_brute:
                phase_normalisee = normaliser_phase_projet(phase_brute)
                if not phase_normalisee:
                    raise serializers.ValidationError(
                        {"phase_actuelle": "Phase actuelle invalide."}
                    )
                attrs["phase_actuelle"] = phase_normalisee
            else:
                attrs["phase_actuelle"] = ""

        if self.instance is None and attrs.get("organisation", serializers.empty) is serializers.empty:
            attrs["organisation"] = None

        return attrs

    def create(self, validated_data):
        contexte_saisi = validated_data.pop("contexte_projet_saisie", None)
        mode_variation_saisi = validated_data.pop("mode_variation_prix_saisie", None)
        if validated_data.get("date_debut_prevue", serializers.empty) in (serializers.empty, None):
            validated_data["date_debut_prevue"] = timezone.localdate()
        projet = super().create(validated_data)
        if contexte_saisi is not None or mode_variation_saisi is not None:
            self._appliquer_contexte_avance(projet, contexte_saisi, mode_variation_saisi)
        return projet

    def update(self, instance, validated_data):
        contexte_saisi = validated_data.pop("contexte_projet_saisie", None)
        mode_variation_saisi = validated_data.pop("mode_variation_prix_saisie", None)
        projet = super().update(instance, validated_data)
        if contexte_saisi is not None or mode_variation_saisi is not None:
            self._appliquer_contexte_avance(projet, contexte_saisi, mode_variation_saisi)
        return projet

    class Meta:
        model = Projet
        fields = [
            "id", "reference", "intitule", "type_projet", "type_projet_autre", "type_libelle",
            "clientele_cible", "clientele_cible_libelle",
            "objectif_mission", "objectif_mission_libelle",
            "statut", "statut_libelle", "phase_actuelle", "phase_libelle",
            "phase_suggeree",
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
            "contexte_projet",
            "mode_variation_prix",
            "statuts_livrables",
            "contexte_projet_saisie",
            "mode_variation_prix_saisie",
            "publier_sur_site",
            "lots", "intervenants",
            "date_creation", "date_modification",
        ]
        read_only_fields = ["id", "date_creation", "date_modification"]
        extra_kwargs = {
            "organisation": {"required": False, "allow_null": True},
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

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["phase_actuelle"] = normaliser_phase_projet(instance.phase_actuelle)
        data["phase_libelle"] = libelle_phase_projet(instance.phase_actuelle)
        return data


class PreanalyseSourcesProjetSerialiseur(serializers.ModelSerializer):
    class Meta:
        model = PreanalyseSourcesProjet
        fields = [
            "id",
            "statut",
            "progression",
            "message",
            "nombre_fichiers",
            "resultat",
            "erreur",
            "date_creation",
            "date_modification",
            "date_fin",
        ]
