"""Sérialiseurs pour les études de voirie — Plateforme LBH."""

from rest_framework import serializers
from .models import EtudeVoirie


class EtudeVoirieSerialiseur(serializers.ModelSerializer):
    type_voie_libelle = serializers.CharField(source="get_type_voie_display", read_only=True)
    projet_reference = serializers.CharField(source="projet.reference", read_only=True)

    class Meta:
        model = EtudeVoirie
        fields = [
            "id", "projet", "projet_reference", "lot",
            "intitule", "type_voie", "type_voie_libelle",
            "tmja_vl", "tmja_pl",
            "duree_vie_ans", "taux_croissance_annuel",
            "cbr", "classe_plateforme", "zone_climatique", "proximite_eau",
            "epaisseur_totale_max_cm", "type_structure_prefere",
            "resultats_calcul", "date_calcul", "calcul_conforme",
            "observations",
            "date_creation", "date_modification",
        ]
        read_only_fields = [
            "id", "resultats_calcul", "date_calcul", "calcul_conforme",
            "date_creation", "date_modification",
            "type_voie_libelle", "projet_reference",
        ]
