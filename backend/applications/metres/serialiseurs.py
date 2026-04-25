"""Sérialiseurs pour les métrés — Plateforme LBH."""

from decimal import Decimal

from rest_framework import serializers
from .models import Metre, LigneMetre, FondPlan, ZoneMesure, ExtractionCAO
from .services import analyser_detail_calcul


class LigneMetre_Serialiseur(serializers.ModelSerializer):
    montant_ht = serializers.SerializerMethodField()
    nature_libelle = serializers.CharField(source="get_nature_display", read_only=True)
    quantite_calculee = serializers.SerializerMethodField()
    apercu_calcul = serializers.SerializerMethodField()

    class Meta:
        model = LigneMetre
        fields = [
            "id", "metre", "numero_ordre", "code_article",
            "designation", "nature", "nature_libelle",
            "quantite", "unite", "detail_calcul",
            "quantite_calculee", "apercu_calcul",
            "prix_unitaire_ht", "montant_ht",
            "ligne_bibliotheque", "observations",
        ]
        read_only_fields = ["id", "montant_ht", "nature_libelle", "quantite_calculee", "apercu_calcul"]
        extra_kwargs = {
            "metre": {"required": False, "allow_null": True},
            "quantite": {"required": False, "allow_null": True},
        }
        validators = []

    def validate(self, attrs):
        detail_calcul = attrs.get("detail_calcul")
        quantite = attrs.get("quantite")

        if detail_calcul and quantite is None:
            try:
                analyse = analyser_detail_calcul(detail_calcul)
                attrs["quantite"] = Decimal(str(analyse["quantite_calculee"]))
            except Exception:
                pass
        return attrs

    def get_montant_ht(self, obj):
        m = obj.montant_ht
        return float(m) if m is not None else None

    def get_quantite_calculee(self, obj):
        if not obj.detail_calcul:
            return None
        try:
            return analyser_detail_calcul(obj.detail_calcul)["quantite_calculee"]
        except Exception:
            return None

    def get_apercu_calcul(self, obj):
        if not obj.detail_calcul:
            return None
        try:
            return analyser_detail_calcul(obj.detail_calcul)
        except Exception:
            return None


class MetreListeSerialiseur(serializers.ModelSerializer):
    type_libelle = serializers.CharField(source="get_type_metre_display", read_only=True)
    statut_libelle = serializers.CharField(source="get_statut_display", read_only=True)
    montant_total_ht = serializers.SerializerMethodField()
    projet_reference = serializers.CharField(source="projet.reference", read_only=True)

    class Meta:
        model = Metre
        fields = [
            "id", "projet", "projet_reference", "lot",
            "type_metre", "type_libelle",
            "intitule", "statut", "statut_libelle",
            "montant_total_ht",
            "date_creation", "date_modification",
        ]

    def get_montant_total_ht(self, obj):
        return float(obj.montant_total_ht)


class MetreDetailSerialiseur(serializers.ModelSerializer):
    lignes = LigneMetre_Serialiseur(many=True, read_only=True)
    type_libelle = serializers.CharField(source="get_type_metre_display", read_only=True)
    statut_libelle = serializers.CharField(source="get_statut_display", read_only=True)
    montant_total_ht = serializers.SerializerMethodField()
    projet_reference = serializers.CharField(source="projet.reference", read_only=True)

    class Meta:
        model = Metre
        fields = [
            "id", "projet", "projet_reference", "lot",
            "type_metre", "type_libelle",
            "intitule", "statut", "statut_libelle",
            "montant_total_ht",
            "lignes",
            "date_creation", "date_modification",
        ]
        read_only_fields = [
            "id", "date_creation", "date_modification",
            "montant_total_ht", "type_libelle", "statut_libelle", "projet_reference",
        ]

    def get_montant_total_ht(self, obj):
        return float(obj.montant_total_ht)


class FondPlanSerialiseur(serializers.ModelSerializer):
    format_libelle = serializers.CharField(source="get_format_fichier_display", read_only=True)
    nb_zones = serializers.SerializerMethodField()
    intitule = serializers.CharField(required=False, default="", allow_blank=True)
    format_fichier = serializers.CharField(required=False, default="image")
    url_fichier = serializers.SerializerMethodField()
    url_apercu = serializers.SerializerMethodField()
    url_miniature = serializers.SerializerMethodField()

    class Meta:
        model = FondPlan
        fields = [
            "id", "metre", "intitule", "format_fichier", "format_libelle",
            "fichier", "url_fichier", "echelle", "reference_calibration",
            "numero_page", "largeur_px", "hauteur_px",
            "apercu", "url_apercu", "miniature", "url_miniature",
            "nb_zones", "date_creation",
        ]
        read_only_fields = [
            "id", "date_creation", "nb_zones", "format_libelle",
            "url_fichier", "url_apercu", "url_miniature",
        ]

    def get_url_fichier(self, obj):
        if obj.fichier:
            try:
                return obj.fichier.url
            except Exception:
                return None
        return None

    def get_url_apercu(self, obj):
        if obj.apercu:
            try:
                url = obj.apercu.url
                ts = int(obj.date_creation.timestamp()) if obj.date_creation else 0
                sep = "&" if "?" in url else "?"
                return f"{url}{sep}v={ts}"
            except Exception:
                return None
        return None

    def get_url_miniature(self, obj):
        if obj.miniature:
            try:
                url = obj.miniature.url
                ts = int(obj.date_creation.timestamp()) if obj.date_creation else 0
                sep = "&" if "?" in url else "?"
                return f"{url}{sep}v={ts}"
            except Exception:
                return None
        return None

    def get_nb_zones(self, obj):
        return obj.zones.count()

    @staticmethod
    def _detecter_format(nom_fichier: str) -> str:
        import os
        ext = os.path.splitext(nom_fichier)[1].lower()
        if ext == ".pdf":
            return "pdf"
        if ext in (".dxf", ".dwg"):
            return "dxf"
        return "image"

    def create(self, validated_data):
        import os
        fichier = validated_data.get("fichier")
        if fichier:
            validated_data["format_fichier"] = self._detecter_format(fichier.name)
        if not validated_data.get("intitule") and fichier:
            validated_data["intitule"] = os.path.splitext(fichier.name)[0][:200]
        if not validated_data.get("intitule"):
            validated_data["intitule"] = "Plan sans titre"
        instance = super().create(validated_data)
        # Lancer la génération de miniature en tâche asynchrone (évite le timeout)
        if instance.format_fichier == "dxf":
            from .taches import tache_generer_miniature_fond_plan
            tache_generer_miniature_fond_plan.delay(str(instance.id))
        return instance


class ZoneMesureSerialiseur(serializers.ModelSerializer):
    type_libelle = serializers.CharField(source="get_type_mesure_display", read_only=True)

    class Meta:
        model = ZoneMesure
        fields = [
            "id", "fond_plan", "zone_parente", "numero", "ligne_metre",
            "designation", "type_mesure", "type_libelle",
            "points_px", "deductions",
            "valeur_brute", "valeur_deduction", "valeur_nette", "unite",
            "couleur", "ordre", "date_modification",
        ]
        read_only_fields = [
            "id", "fond_plan", "ligne_metre", "valeur_brute", "valeur_deduction", "valeur_nette",
            "date_modification", "type_libelle",
        ]


class ExtractionCAOSerialiseur(serializers.ModelSerializer):
    statut_libelle = serializers.CharField(source="get_statut_display", read_only=True)

    class Meta:
        model = ExtractionCAO
        fields = [
            "id", "metre", "fond_plan", "statut", "statut_libelle",
            "resultat_brut", "propositions",
            "nb_calques", "nb_entites", "nb_propositions",
            "message_erreur", "date_extraction", "date_creation",
        ]
        read_only_fields = [
            "id", "statut_libelle", "resultat_brut", "propositions",
            "nb_calques", "nb_entites", "nb_propositions",
            "message_erreur", "date_extraction", "date_creation",
        ]
