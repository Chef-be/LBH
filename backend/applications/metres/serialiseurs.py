"""Sérialiseurs pour les métrés — Plateforme LBH."""

from decimal import Decimal

from rest_framework import serializers
from .models import (
    Metre,
    LigneMetre,
    FondPlan,
    ZoneMesure,
    ExtractionCAO,
    GeometrieFondPlan,
    DPGFQuantitative,
    LigneDPGFQuantitative,
)
from .services import analyser_detail_calcul


class LigneMetre_Serialiseur(serializers.ModelSerializer):
    montant_ht = serializers.SerializerMethodField()
    nature_libelle = serializers.CharField(source="get_nature_display", read_only=True)
    article_cctp_intitule = serializers.CharField(source="article_cctp.intitule", read_only=True, allow_null=True)
    article_cctp_statut = serializers.CharField(source="article_cctp.statut", read_only=True, allow_null=True)
    quantite_calculee = serializers.SerializerMethodField()
    apercu_calcul = serializers.SerializerMethodField()

    class Meta:
        model = LigneMetre
        fields = [
            "id", "metre", "numero_ordre", "code_article",
            "article_cctp", "article_cctp_intitule", "article_cctp_statut",
            "article_cctp_code", "article_cctp_libelle",
            "chapitre_cctp", "lot_cctp", "designation_source", "article_a_completer",
            "localisation", "designation", "nature", "nature_libelle",
            "niveau", "batiment_zone", "piece",
            "quantite", "unite", "detail_calcul",
            "quantite_calculee", "apercu_calcul",
            "prix_unitaire_ht", "montant_ht",
            "ligne_bibliotheque", "observations",
            "source_type", "source_fond_plan", "source_zone_mesure",
            "statut_ligne", "statut_synchronisation",
            "date_derniere_synchronisation", "quantite_modifiee_manuellement",
            "ordre_dpgf", "inclure_dpgf",
        ]
        read_only_fields = [
            "id", "montant_ht", "nature_libelle", "quantite_calculee", "apercu_calcul",
            "article_cctp_intitule", "article_cctp_statut", "date_derniere_synchronisation",
        ]
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
    quantites_par_unite = serializers.SerializerMethodField()
    nb_lignes = serializers.SerializerMethodField()
    nb_zones_mesurees = serializers.SerializerMethodField()
    projet_reference = serializers.CharField(source="projet.reference", read_only=True)

    class Meta:
        model = Metre
        fields = [
            "id", "projet", "projet_reference", "lot",
            "type_metre", "type_libelle",
            "intitule", "statut", "statut_libelle",
            "montant_total_ht", "quantites_par_unite", "nb_lignes", "nb_zones_mesurees",
            "date_creation", "date_modification",
        ]

    def get_montant_total_ht(self, obj):
        return float(obj.montant_total_ht)

    def get_quantites_par_unite(self, obj):
        totaux = {}
        for ligne in obj.lignes.all():
            if ligne.quantite is None:
                continue
            unite = ligne.unite or "u"
            totaux[unite] = float(Decimal(str(totaux.get(unite, 0))) + ligne.quantite)
        return totaux

    def get_nb_lignes(self, obj):
        return obj.lignes.count()

    def get_nb_zones_mesurees(self, obj):
        return ZoneMesure.objects.filter(fond_plan__metre=obj).count()


class MetreDetailSerialiseur(serializers.ModelSerializer):
    lignes = LigneMetre_Serialiseur(many=True, read_only=True)
    type_libelle = serializers.CharField(source="get_type_metre_display", read_only=True)
    statut_libelle = serializers.CharField(source="get_statut_display", read_only=True)
    montant_total_ht = serializers.SerializerMethodField()
    quantites_par_unite = serializers.SerializerMethodField()
    nb_zones_mesurees = serializers.SerializerMethodField()
    projet_reference = serializers.CharField(source="projet.reference", read_only=True)

    class Meta:
        model = Metre
        fields = [
            "id", "projet", "projet_reference", "lot",
            "type_metre", "type_libelle",
            "intitule", "statut", "statut_libelle",
            "montant_total_ht", "quantites_par_unite", "nb_zones_mesurees",
            "lignes",
            "date_creation", "date_modification",
        ]
        read_only_fields = [
            "id", "date_creation", "date_modification",
            "montant_total_ht", "type_libelle", "statut_libelle", "projet_reference",
        ]

    def get_montant_total_ht(self, obj):
        return float(obj.montant_total_ht)

    def get_quantites_par_unite(self, obj):
        totaux = {}
        for ligne in obj.lignes.all():
            if ligne.quantite is None:
                continue
            unite = ligne.unite or "u"
            totaux[unite] = float(Decimal(str(totaux.get(unite, 0))) + ligne.quantite)
        return totaux

    def get_nb_zones_mesurees(self, obj):
        return ZoneMesure.objects.filter(fond_plan__metre=obj).count()


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
            "statut_traitement", "statut_calibration", "statut_vectorisation",
            "message_traitement", "message_vectorisation",
            "numero_page", "page_pdf_total", "rotation", "echelle_x", "echelle_y",
            "unite_plan", "transformation_coordonnees",
            "largeur_px", "hauteur_px",
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
    article_cctp_intitule = serializers.CharField(source="article_cctp.intitule", read_only=True, allow_null=True)

    class Meta:
        model = ZoneMesure
        fields = [
            "id", "fond_plan", "zone_parente", "numero", "ligne_metre",
            "localisation", "localisation_structuree", "designation",
            "article_cctp", "article_cctp_intitule", "source_article_cctp",
            "code_article", "chapitre_cctp", "lot_cctp",
            "type_mesure", "type_libelle",
            "points_px", "deductions", "hauteur",
            "valeur_brute", "valeur_deduction", "valeur_nette", "unite",
            "couleur", "ordre",
            "statut_calcul", "statut_conversion", "statut_synchronisation",
            "date_dernier_calcul", "date_derniere_conversion",
            "message_erreur_calcul", "geometrie_modifiee_depuis_conversion",
            "date_modification",
        ]
        read_only_fields = [
            "id", "fond_plan", "ligne_metre", "valeur_brute", "valeur_deduction", "valeur_nette",
            "date_modification", "type_libelle", "article_cctp_intitule",
            "date_dernier_calcul", "date_derniere_conversion",
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


class GeometrieFondPlanSerialiseur(serializers.ModelSerializer):
    class Meta:
        model = GeometrieFondPlan
        fields = [
            "id", "fond_plan", "page", "type_source", "statut",
            "donnees_geojson", "segments", "contours", "points_accroche",
            "calques", "statistiques", "message_erreur",
            "date_generation", "date_modification",
        ]
        read_only_fields = ["id", "date_generation", "date_modification"]


class LigneDPGFQuantitativeSerialiseur(serializers.ModelSerializer):
    article_cctp_intitule = serializers.CharField(source="article_cctp.intitule", read_only=True, allow_null=True)

    class Meta:
        model = LigneDPGFQuantitative
        fields = [
            "id", "dpgf", "ligne_metre_source", "zone_mesure_source",
            "article_cctp", "article_cctp_intitule",
            "lot", "chapitre", "code_article", "designation",
            "localisation", "quantite", "unite", "ordre",
            "observations", "statut", "date_creation",
        ]
        read_only_fields = ["id", "article_cctp_intitule", "date_creation"]


class DPGFQuantitativeSerialiseur(serializers.ModelSerializer):
    lignes = LigneDPGFQuantitativeSerialiseur(many=True, read_only=True)
    projet_reference = serializers.CharField(source="projet.reference", read_only=True)
    metre_intitule = serializers.CharField(source="metre_source.intitule", read_only=True)

    class Meta:
        model = DPGFQuantitative
        fields = [
            "id", "projet", "projet_reference", "metre_source", "metre_intitule",
            "intitule", "statut", "lignes",
            "date_creation", "date_modification", "cree_par",
        ]
        read_only_fields = ["id", "date_creation", "date_modification", "cree_par"]
