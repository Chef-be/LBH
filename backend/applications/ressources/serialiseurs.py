"""Sérialiseurs DRF pour l'app ressources."""

from rest_framework import serializers

from .models import (
    DevisAnalyse,
    EstimationSource,
    FicheRatioCout,
    IndiceRevisionPrix,
    LignePrixMarche,
    ModeleMappingDocumentPrix,
)


class IndiceRevisionPrixSerialiseur(serializers.ModelSerializer):
    class Meta:
        model = IndiceRevisionPrix
        fields = ["id", "code", "valeur", "date_publication", "source", "date_creation"]
        read_only_fields = ["id", "date_creation"]


class LignePrixMarcheSerialiseur(serializers.ModelSerializer):
    sdp = serializers.SerializerMethodField()

    class Meta:
        model = LignePrixMarche
        fields = [
            "id", "devis_source", "designation", "designation_normalisee",
            "ordre", "numero", "designation_originale",
            "unite", "quantite", "prix_ht_original", "prix_ht_actualise",
            "montant_ht", "montant_recalcule_ht", "ecart_montant_ht",
            "type_ligne", "statut_controle", "score_confiance",
            "corrections_proposees", "donnees_import", "decision_import",
            "date_indice_actualisation", "indice_code", "indice_valeur_base",
            "indice_valeur_actuelle", "localite",
            "corps_etat", "corps_etat_libelle",
            "debourse_sec_estime", "kpv_estime",
            "pct_mo_estime", "pct_materiaux_estime", "pct_materiel_estime",
            "ligne_bibliotheque", "est_ligne_commune", "nb_occurrences",
            "sdp", "date_creation", "date_modification",
        ]
        read_only_fields = ["id", "date_creation", "date_modification", "designation_normalisee"]

    def get_sdp(self, obj) -> dict:
        if not obj.prix_ht_original:
            return {}
        from .services import estimer_sdp_depuis_prix
        return {k: float(v) for k, v in estimer_sdp_depuis_prix(
            obj.prix_ht_actualise or obj.prix_ht_original,
            obj.corps_etat_libelle or "",
        ).items() if not isinstance(v, str)}


class DevisAnalyseSerialiseur(serializers.ModelSerializer):
    lignes_count = serializers.SerializerMethodField()
    fichier_url = serializers.SerializerMethodField()

    class Meta:
        model = DevisAnalyse
        fields = [
            "id", "fichier", "fichier_url", "nom_original", "type_document",
            "entreprise", "localite", "date_emission",
            "indice_base_code", "indice_base_valeur",
            "statut", "erreur_detail", "date_suppression_programmee",
            "capitalise", "lignes_count",
            "nb_lignes_detectees", "nb_lignes_rejetees", "nb_lignes_a_verifier",
            "score_qualite_extraction", "methode_extraction", "message_analyse",
            "texte_extrait_apercu", "donnees_extraction",
            "date_creation", "date_modification",
        ]
        read_only_fields = [
            "id", "nom_original", "statut", "erreur_detail", "capitalise",
            "nb_lignes_detectees", "nb_lignes_rejetees", "nb_lignes_a_verifier",
            "score_qualite_extraction", "methode_extraction", "message_analyse",
            "texte_extrait_apercu", "donnees_extraction",
            "date_creation", "date_modification",
        ]

    def get_lignes_count(self, obj) -> int:
        return obj.lignes.count()

    def get_fichier_url(self, obj) -> str:
        request = self.context.get("request")
        if obj.fichier and request:
            return request.build_absolute_uri(obj.fichier.url)
        return ""


class ModeleMappingDocumentPrixSerialiseur(serializers.ModelSerializer):
    class Meta:
        model = ModeleMappingDocumentPrix
        fields = [
            "id", "nom", "type_document", "entreprise_source",
            "colonnes_mapping", "regles_nettoyage", "regles_ignore",
            "separateur_description", "est_actif",
            "date_creation", "date_modification",
        ]
        read_only_fields = ["id", "date_creation", "date_modification"]


class EstimationSourceSerialiseur(serializers.ModelSerializer):
    fiches_count = serializers.SerializerMethodField()
    fichier_url = serializers.SerializerMethodField()

    class Meta:
        model = EstimationSource
        fields = [
            "id", "fichier", "fichier_url", "nom_original", "type_document",
            "statut", "erreur_detail", "date_suppression_programmee",
            "fiches_count", "date_creation",
        ]
        read_only_fields = ["id", "nom_original", "statut", "erreur_detail", "date_creation"]

    def get_fiches_count(self, obj) -> int:
        return obj.fiches_ratio.count()

    def get_fichier_url(self, obj) -> str:
        request = self.context.get("request")
        if obj.fichier and request:
            return request.build_absolute_uri(obj.fichier.url)
        return ""


class FicheRatioCoutSerialiseur(serializers.ModelSerializer):
    lots_cctp_codes = serializers.SerializerMethodField()
    ratio_infra_pct_display = serializers.SerializerMethodField()

    class Meta:
        model = FicheRatioCout
        fields = [
            "id", "source", "intitule", "type_projet", "localite", "annee_reference",
            "shon", "shab", "emprise_sol",
            "nombre_niveaux_hors_sol", "nombre_niveaux_sous_sol",
            "type_fondation", "profondeur_fondation_m", "nature_sol",
            "cout_total_ht", "cout_infrastructure_ht", "cout_superstructure_ht",
            "cout_m2_shon", "cout_m2_shab", "cout_m2_emprise",
            "ratio_infra_pct", "ratio_supra_pct",
            "indice_code", "indice_valeur_reference",
            "reference_externe", "observations",
            "lots_cctp", "lots_cctp_codes",
            "ratio_infra_pct_display",
            "date_creation", "date_modification",
        ]
        read_only_fields = [
            "id", "cout_m2_shon", "cout_m2_shab", "cout_m2_emprise",
            "ratio_infra_pct", "ratio_supra_pct",
            "date_creation", "date_modification",
        ]

    def get_lots_cctp_codes(self, obj) -> list:
        return list(obj.lots_cctp.values_list("code", flat=True))

    def get_ratio_infra_pct_display(self, obj) -> str:
        if obj.ratio_infra_pct:
            return f"{obj.ratio_infra_pct:.1f} % infrastructure / {obj.ratio_supra_pct or (100 - float(obj.ratio_infra_pct)):.1f} % superstructure"
        return ""

    def create(self, validated_data):
        instance = super().create(validated_data)
        instance.calculer_ratios()
        instance.save()
        return instance

    def update(self, instance, validated_data):
        instance = super().update(instance, validated_data)
        instance.calculer_ratios()
        instance.save()
        return instance
