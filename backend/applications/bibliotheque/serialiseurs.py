"""Sérialiseurs pour la bibliothèque de prix — Plateforme LBH."""

from rest_framework import serializers
from .models import LignePrixBibliotheque, SousDetailPrix


class LignePrixBibliothequeListeSerialiseur(serializers.ModelSerializer):
    """Sérialiseur allégé pour les listes et la sélection."""

    class Meta:
        model = LignePrixBibliotheque
        fields = [
            "id", "niveau", "code", "famille", "sous_famille",
            "designation_courte", "unite",
            "debourse_sec_unitaire", "prix_vente_unitaire",
            "fiabilite", "statut_validation",
        ]


class LignePrixBibliothequeDetailSerialiseur(serializers.ModelSerializer):
    """Sérialiseur complet pour la création et la modification."""
    auteur_nom = serializers.SerializerMethodField()
    niveau_libelle = serializers.CharField(source="get_niveau_display", read_only=True)
    statut_libelle = serializers.CharField(source="get_statut_validation_display", read_only=True)

    class Meta:
        model = LignePrixBibliotheque
        fields = [
            "id", "niveau", "niveau_libelle",
            "organisation", "projet",
            "code", "famille", "sous_famille", "corps_etat", "lot",
            "origine_import", "code_source_externe", "url_source",
            "designation_longue", "designation_courte", "unite",
            "hypotheses", "contexte_emploi",
            "observations_techniques", "observations_economiques",
            "prescriptions_techniques", "criteres_metre",
            "normes_applicables", "phases_execution", "dechets_generes",
            "cahier_des_charges_structure", "donnees_analytiques",
            "temps_main_oeuvre", "cout_horaire_mo",
            "cout_matieres", "cout_materiel", "cout_sous_traitance", "cout_transport", "cout_frais_divers",
            "debourse_sec_unitaire", "prix_vente_unitaire",
            "source", "auteur", "auteur_nom", "fiabilite",
            "periode_validite_debut", "periode_validite_fin",
            "version", "statut_validation", "statut_libelle",
            "ligne_parente",
            "territoire", "saison", "coefficient_territoire",
            "date_creation", "date_modification",
        ]
        read_only_fields = ["id", "date_creation", "date_modification", "auteur_nom"]

    def get_auteur_nom(self, obj):
        if obj.auteur:
            return f"{obj.auteur.prenom} {obj.auteur.nom}"
        return None


class SousDetailPrixSerialiseur(serializers.ModelSerializer):
    """Sérialiseur complet pour un sous-détail de ligne de bibliothèque."""

    type_libelle = serializers.CharField(source="get_type_ressource_display", read_only=True)
    zone_libelle = serializers.CharField(source="get_zone_taux_display", read_only=True)
    profil_main_oeuvre_libelle = serializers.CharField(source="profil_main_oeuvre.libelle", read_only=True)
    profil_main_oeuvre_code = serializers.CharField(source="profil_main_oeuvre.code", read_only=True)

    class Meta:
        model = SousDetailPrix
        fields = [
            "id", "ligne_prix", "ordre",
            "type_ressource", "type_libelle",
            "code", "designation", "unite",
            "quantite", "cout_unitaire_ht", "montant_ht",
            "profil_main_oeuvre", "profil_main_oeuvre_code", "profil_main_oeuvre_libelle",
            "nombre_ressources", "temps_unitaire",
            "taux_horaire", "zone_taux", "zone_libelle",
            "observations", "date_modification",
        ]
        read_only_fields = ["id", "montant_ht", "date_modification"]
        extra_kwargs = {
            "unite": {"required": False, "allow_blank": True},
            "designation": {"required": False, "allow_blank": True},
        }

    def validate(self, attrs):
        type_ressource = attrs.get("type_ressource", getattr(self.instance, "type_ressource", None))
        if type_ressource != "mo":
            attrs["profil_main_oeuvre"] = None
            attrs["nombre_ressources"] = 1
            attrs["temps_unitaire"] = 0
            attrs["taux_horaire"] = 0
        return attrs


class LignePrixBibliothequeAvecSousDetailsSerialiseur(LignePrixBibliothequeDetailSerialiseur):
    """Sérialiseur enrichi incluant les sous-détails."""

    sous_details = SousDetailPrixSerialiseur(many=True, read_only=True)
    total_mo = serializers.SerializerMethodField()
    total_matieres = serializers.SerializerMethodField()
    total_materiel = serializers.SerializerMethodField()

    class Meta(LignePrixBibliothequeDetailSerialiseur.Meta):
        fields = LignePrixBibliothequeDetailSerialiseur.Meta.fields + [
            "sous_details", "total_mo", "total_matieres", "total_materiel",
        ]

    def get_total_mo(self, obj):
        return sum(
            sd.montant_ht for sd in obj.sous_details.filter(type_ressource="mo")
        )

    def get_total_matieres(self, obj):
        return sum(
            sd.montant_ht for sd in obj.sous_details.filter(type_ressource="matiere")
        )

    def get_total_materiel(self, obj):
        return sum(
            sd.montant_ht for sd in obj.sous_details.filter(type_ressource="materiel")
        )
