"""Sérialiseurs pour les appels d'offres — Plateforme LBH."""

from rest_framework import serializers
from .models import AppelOffres, OffreEntreprise


class OffreEntrepriseSerialiseur(serializers.ModelSerializer):
    entreprise_nom = serializers.CharField(source="entreprise.nom", read_only=True)
    statut_libelle = serializers.CharField(source="get_statut_display", read_only=True)
    conformite_administrative_libelle = serializers.CharField(
        source="get_conformite_administrative_display", read_only=True
    )
    conformite_technique_libelle = serializers.CharField(
        source="get_conformite_technique_display", read_only=True
    )
    ecart_estimation_pct = serializers.SerializerMethodField()

    class Meta:
        model = OffreEntreprise
        fields = [
            "id", "appel_offres", "entreprise", "entreprise_nom",
            "statut", "statut_libelle",
            "montant_offre_ht", "montant_negociee_ht",
            "delai_propose_jours",
            "conformite_administrative", "conformite_administrative_libelle",
            "conformite_technique", "conformite_technique_libelle",
            "points_forts", "points_faibles", "ecart_estimation_pct",
            "notes_criteres", "note_globale",
            "observations", "date_reception",
        ]
        read_only_fields = [
            "id", "date_reception", "entreprise_nom", "statut_libelle",
            "conformite_administrative_libelle", "conformite_technique_libelle",
            "ecart_estimation_pct",
        ]
        extra_kwargs = {
            "appel_offres": {"required": False, "allow_null": True},
        }
        validators = []

    def get_ecart_estimation_pct(self, obj):
        return obj.ecart_estimation_pct


class AppelOffresListeSerialiseur(serializers.ModelSerializer):
    type_libelle = serializers.CharField(source="get_type_procedure_display", read_only=True)
    statut_libelle = serializers.CharField(source="get_statut_display", read_only=True)
    projet_reference = serializers.CharField(source="projet.reference", read_only=True)
    nb_offres = serializers.SerializerMethodField()
    nb_points_vigilance = serializers.SerializerMethodField()

    class Meta:
        model = AppelOffres
        fields = [
            "id", "projet", "projet_reference", "lot",
            "intitule", "type_procedure", "type_libelle",
            "statut", "statut_libelle",
            "date_limite_remise", "montant_estime_ht",
            "nb_offres", "nb_points_vigilance",
            "date_creation",
        ]

    def get_nb_offres(self, obj):
        return obj.offres.count()

    def get_nb_points_vigilance(self, obj):
        return len(obj.points_vigilance or [])


class AppelOffresDetailSerialiseur(serializers.ModelSerializer):
    type_libelle = serializers.CharField(source="get_type_procedure_display", read_only=True)
    statut_libelle = serializers.CharField(source="get_statut_display", read_only=True)
    projet_reference = serializers.CharField(source="projet.reference", read_only=True)
    offres = OffreEntrepriseSerialiseur(many=True, read_only=True)

    class Meta:
        model = AppelOffres
        fields = [
            "id", "projet", "projet_reference", "lot",
            "intitule", "type_procedure", "type_libelle",
            "statut", "statut_libelle",
            "date_publication", "date_limite_questions",
            "date_limite_remise", "date_ouverture_plis", "date_attribution",
            "montant_estime_ht", "criteres_jugement",
            "pieces_consultation", "points_vigilance",
            "analyse_contractuelle", "conditions_paiement", "garanties_exigees",
            "delai_execution_jours", "variantes_autorisees",
            "observations", "offres",
            "parametres_analyse", "synthese_analyse",
            "date_creation", "date_modification",
        ]
        read_only_fields = [
            "id", "date_creation", "date_modification",
            "type_libelle", "statut_libelle", "projet_reference",
            "synthese_analyse",
        ]
