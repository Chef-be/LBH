"""Sérialiseurs pour les programmes bâtiment — Plateforme BEE."""

from rest_framework import serializers
from .models import ProgrammeBatiment, LocalProgramme


class LocalProgrammeSerialiseur(serializers.ModelSerializer):
    surface_totale_m2 = serializers.DecimalField(
        max_digits=10, decimal_places=2, read_only=True
    )

    class Meta:
        model = LocalProgramme
        fields = [
            "id", "programme", "designation", "categorie",
            "nombre", "surface_unitaire_m2", "surface_totale_m2",
        ]
        read_only_fields = ["id", "surface_totale_m2"]
        extra_kwargs = {
            "programme": {"required": False, "allow_null": True},
        }


class ProgrammeBatimentSerialiseur(serializers.ModelSerializer):
    locaux = LocalProgrammeSerialiseur(many=True, read_only=True)
    projet_reference = serializers.CharField(source="projet.reference", read_only=True)
    type_operation_libelle = serializers.CharField(
        source="get_type_operation_display", read_only=True
    )
    type_batiment_libelle = serializers.CharField(
        source="get_type_batiment_display", read_only=True
    )

    class Meta:
        model = ProgrammeBatiment
        fields = [
            "id", "projet", "projet_reference",
            "intitule", "type_operation", "type_operation_libelle",
            "type_batiment", "type_batiment_libelle",
            "shon_totale", "shab_totale", "emprise_sol",
            "nombre_niveaux_hors_sol", "nombre_niveaux_sous_sol",
            "cout_estime_ht", "cout_par_m2_shon_ht",
            "indice_base", "date_valeur",
            "observations", "locaux",
            "date_creation", "date_modification",
        ]
        read_only_fields = [
            "id", "cout_estime_ht", "cout_par_m2_shon_ht",
            "date_creation", "date_modification",
            "projet_reference", "type_operation_libelle", "type_batiment_libelle",
        ]
