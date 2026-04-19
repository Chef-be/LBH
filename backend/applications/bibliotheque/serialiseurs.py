"""Sérialiseurs pour la bibliothèque de prix — Plateforme LBH."""

from decimal import Decimal

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
            "cout_matieres", "cout_materiel", "cout_consommables",
            "cout_sous_traitance", "cout_transport", "cout_frais_divers",
            "debourse_sec_unitaire", "prix_vente_unitaire",
            "lot_cctp_reference", "caracteristiques_techniques", "conditions_mise_en_oeuvre",
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


# ---------------------------------------------------------------------------
# Sérialiseurs CCTP liés
# ---------------------------------------------------------------------------

class PrescriptionLieeSerialiseur(serializers.Serializer):
    """Résumé d'une prescription CCTP liée à une ligne de bibliothèque."""
    id = serializers.UUIDField()
    intitule = serializers.CharField()
    type_prescription = serializers.CharField()
    niveau = serializers.CharField()
    lot_numero = serializers.SerializerMethodField()
    lot_intitule = serializers.SerializerMethodField()

    def get_lot_numero(self, obj):
        return obj.lot.code if obj.lot_id else None

    def get_lot_intitule(self, obj):
        return obj.lot.intitule if obj.lot_id else None


class LotCCTPResumeSerialiseur(serializers.Serializer):
    """Résumé d'un lot CCTP."""
    id = serializers.UUIDField()
    numero = serializers.CharField(source="code")
    intitule = serializers.CharField()
    nb_prescriptions = serializers.SerializerMethodField()

    def get_nb_prescriptions(self, obj):
        return obj.prescriptions.filter(est_actif=True).count()


# ---------------------------------------------------------------------------
# Sérialiseur complet avec répartition DS
# ---------------------------------------------------------------------------

# Couleurs DS par composante
COULEURS_DS = {
    "mo":            "#3b82f6",
    "matieres":      "#10b981",
    "materiel":      "#f59e0b",
    "consommables":  "#8b5cf6",
    "sous_traitance": "#06b6d4",
    "transport":     "#64748b",
    "frais_divers":  "#f43f5e",
}


def _calculer_repartition_ds(obj):
    """Calcule la répartition en pourcentage du déboursé sec."""
    ds = obj.debourse_sec_unitaire or Decimal("0")
    if ds == 0:
        return {k: 0 for k in COULEURS_DS}
    mo = (obj.temps_main_oeuvre or Decimal("0")) * (obj.cout_horaire_mo or Decimal("0"))
    composantes = {
        "mo":            mo,
        "matieres":      obj.cout_matieres or Decimal("0"),
        "materiel":      obj.cout_materiel or Decimal("0"),
        "consommables":  obj.cout_consommables or Decimal("0"),
        "sous_traitance": obj.cout_sous_traitance or Decimal("0"),
        "transport":     obj.cout_transport or Decimal("0"),
        "frais_divers":  obj.cout_frais_divers or Decimal("0"),
    }
    return {
        k: round(float(v / ds * 100), 2)
        for k, v in composantes.items()
    }


class LignePrixBibliothequeCompletSerialiseur(LignePrixBibliothequeAvecSousDetailsSerialiseur):
    """Sérialiseur complet avec répartition DS, prescriptions liées et lot CCTP."""

    prescriptions_liees_detail = serializers.SerializerMethodField()
    lot_cctp_reference_detail = serializers.SerializerMethodField()
    repartition_ds = serializers.SerializerMethodField()
    graphique_ds = serializers.SerializerMethodField()

    class Meta(LignePrixBibliothequeAvecSousDetailsSerialiseur.Meta):
        fields = LignePrixBibliothequeAvecSousDetailsSerialiseur.Meta.fields + [
            "prescriptions_liees_detail",
            "lot_cctp_reference_detail",
            "repartition_ds",
            "graphique_ds",
        ]

    def get_prescriptions_liees_detail(self, obj):
        prescriptions = obj.prescriptions_liees.select_related("lot").all()
        return [
            {
                "id": str(p.id),
                "intitule": p.intitule,
                "type_prescription": p.type_prescription,
                "niveau": p.niveau,
                "lot_numero": p.lot.code if p.lot_id else None,
                "lot_intitule": p.lot.intitule if p.lot_id else None,
            }
            for p in prescriptions
        ]

    def get_lot_cctp_reference_detail(self, obj):
        if not obj.lot_cctp_reference_id:
            return None
        lot = obj.lot_cctp_reference
        return {"id": str(lot.id), "numero": lot.code, "intitule": lot.intitule}

    def get_repartition_ds(self, obj):
        repartition = _calculer_repartition_ds(obj)
        return {f"{k}_pct": v for k, v in repartition.items()}

    def get_graphique_ds(self, obj):
        repartition = _calculer_repartition_ds(obj)
        libelles = {
            "mo": "Main-d'œuvre",
            "matieres": "Matériaux",
            "materiel": "Matériel",
            "consommables": "Consommables",
            "sous_traitance": "Sous-traitance",
            "transport": "Transport",
            "frais_divers": "Frais divers",
        }
        return [
            {"label": libelles[k], "valeur": v, "couleur": COULEURS_DS[k]}
            for k, v in repartition.items()
            if v > 0
        ]
