"""
Sérialiseurs — Module Pilotage Société
"""

from rest_framework import serializers
from .models import (
    ChargeFixeStructure,
    ParametreSociete,
    ProfilHoraire,
    ProfilHoraireUtilisateur,
    SimulationSalaire,
    DevisHonoraires,
    LigneDevis,
    Facture,
    LigneFacture,
    Paiement,
    TempsPasse,
)


# ─────────────────────────────────────────────
# Profils horaires + simulations salariales
# ─────────────────────────────────────────────

class SimulationSalaireSerializer(serializers.ModelSerializer):
    class Meta:
        model = SimulationSalaire
        fields = [
            "id", "profil", "libelle",
            "salaire_net_mensuel", "primes_mensuelles", "avantages_mensuels",
            "salaire_brut_estime", "charges_salariales", "charges_patronales",
            "cout_employeur_mensuel", "cout_annuel",
            "dhmo", "taux_vente_horaire",
            "actif", "ordre",
            "date_creation", "date_modification",
        ]
        read_only_fields = [
            "id", "profil",
            "salaire_brut_estime", "charges_salariales", "charges_patronales",
            "cout_employeur_mensuel", "cout_annuel", "dhmo", "taux_vente_horaire",
            "date_creation", "date_modification",
        ]


class ProfilHoraireSerializer(serializers.ModelSerializer):
    simulations = SimulationSalaireSerializer(many=True, read_only=True)
    nb_simulations = serializers.SerializerMethodField()

    class Meta:
        model = ProfilHoraire
        fields = [
            "id", "code", "libelle", "description",
            "taux_horaire_ht", "couleur", "actif", "ordre",
            "type_profil",
            "taux_charges_salariales", "taux_charges_patronales",
            "heures_productives_an", "taux_marge_vente",
            "taux_horaire_ht_calcule", "utiliser_calcul",
            "simulations", "nb_simulations",
            "date_creation", "date_modification",
        ]
        read_only_fields = ["id", "taux_horaire_ht_calcule", "date_creation", "date_modification"]

    def get_nb_simulations(self, obj):
        return obj.simulations.filter(actif=True).count()


class ProfilHoraireUtilisateurSerializer(serializers.ModelSerializer):
    utilisateur_nom = serializers.CharField(source="utilisateur.nom_complet", read_only=True)
    utilisateur_fonction = serializers.CharField(source="utilisateur.fonction", read_only=True)
    profil_horaire_libelle = serializers.CharField(source="profil_horaire.libelle", read_only=True)

    class Meta:
        model = ProfilHoraireUtilisateur
        fields = [
            "id",
            "utilisateur",
            "utilisateur_nom",
            "utilisateur_fonction",
            "profil_horaire",
            "profil_horaire_libelle",
            "date_creation",
            "date_modification",
        ]
        read_only_fields = ["id", "date_creation", "date_modification"]


class ParametreSocieteSerializer(serializers.ModelSerializer):
    class Meta:
        model = ParametreSociete
        fields = [
            "id", "annee", "zone_smic", "smic_horaire_brut", "pmss", "pass_annuel",
            "taux_charges_salariales", "taux_charges_patronales",
            "heures_productives_be", "decomposition_heures_productives",
            "objectif_marge_nette", "taux_tva_defaut",
            "date_creation", "date_modification",
        ]
        read_only_fields = ["id", "date_creation", "date_modification"]


class ChargeFixeStructureSerializer(serializers.ModelSerializer):
    montant_annuel = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = ChargeFixeStructure
        fields = [
            "id", "libelle", "montant_mensuel", "montant_annuel",
            "actif", "ordre", "date_creation", "date_modification",
        ]
        read_only_fields = ["id", "montant_annuel", "date_creation", "date_modification"]


# ─────────────────────────────────────────────
# Lignes de devis
# ─────────────────────────────────────────────

class LigneDevisSerializer(serializers.ModelSerializer):
    profil_libelle = serializers.CharField(source="profil.libelle", read_only=True)
    profil_couleur = serializers.CharField(source="profil.couleur", read_only=True)

    class Meta:
        model = LigneDevis
        fields = [
            "id", "ordre", "type_ligne", "phase_code",
            "intitule", "description",
            "profil", "profil_libelle", "profil_couleur",
            "nb_heures", "taux_horaire",
            "montant_unitaire_ht", "quantite", "unite",
            "montant_ht",
        ]
        read_only_fields = ["id", "montant_ht"]

    def validate(self, data):
        type_ligne = data.get("type_ligne", "horaire")
        if type_ligne == "horaire":
            if not data.get("nb_heures") or not data.get("taux_horaire"):
                raise serializers.ValidationError(
                    "Une ligne horaire nécessite un nombre d'heures et un taux."
                )
        return data

    def create(self, validated_data):
        instance = super().create(validated_data)
        instance.calculer_montant()
        instance.save(update_fields=["montant_ht"])
        instance.devis.recalculer_totaux()
        return instance

    def update(self, instance, validated_data):
        instance = super().update(instance, validated_data)
        instance.calculer_montant()
        instance.save(update_fields=["montant_ht"])
        instance.devis.recalculer_totaux()
        return instance


# ─────────────────────────────────────────────
# Devis d'honoraires
# ─────────────────────────────────────────────

class DevisHonorairesListeSerializer(serializers.ModelSerializer):
    """Sérialiseur léger pour les listes."""
    projet_reference = serializers.CharField(source="projet.reference", read_only=True)
    projet_intitule = serializers.CharField(source="projet.intitule", read_only=True)
    statut_libelle = serializers.CharField(source="get_statut_display", read_only=True)
    validation_client_active = serializers.BooleanField(read_only=True)

    class Meta:
        model = DevisHonoraires
        fields = [
            "id", "reference", "intitule", "statut", "statut_libelle",
            "famille_client", "sous_type_client", "nature_ouvrage",
            "client_nom", "date_emission", "date_validite",
            "date_envoi_client", "date_validation_client", "validation_client_active",
            "montant_ht", "montant_ttc",
            "projet", "projet_reference", "projet_intitule",
        ]


class DevisHonorairesDetailSerializer(serializers.ModelSerializer):
    """Sérialiseur complet avec lignes."""
    lignes = LigneDevisSerializer(many=True, read_only=True)
    projet_reference = serializers.CharField(source="projet.reference", read_only=True)
    projet_intitule = serializers.CharField(source="projet.intitule", read_only=True)
    statut_libelle = serializers.CharField(source="get_statut_display", read_only=True)
    nb_factures = serializers.SerializerMethodField()
    validation_client_active = serializers.BooleanField(read_only=True)

    class Meta:
        model = DevisHonoraires
        fields = [
            "id", "reference", "intitule", "statut", "statut_libelle",
            "projet", "projet_reference", "projet_intitule",
            "famille_client", "sous_type_client", "contexte_contractuel",
            "nature_ouvrage", "nature_marche", "role_lbh",
            "contexte_projet_saisie", "missions_selectionnees",
            "client_nom", "client_contact", "client_email",
            "client_telephone", "client_adresse",
            "date_emission", "date_validite", "date_acceptation", "date_refus",
            "date_envoi_client", "date_validation_client", "date_expiration_validation",
            "mode_validation", "validation_client_active",
            "taux_tva", "acompte_pct", "delai_paiement_jours",
            "montant_ht", "montant_tva", "montant_ttc",
            "objet", "conditions_particulieres", "notes_internes",
            "lignes", "nb_factures",
            "date_creation", "date_modification",
        ]
        read_only_fields = [
            "id", "montant_ht", "montant_tva", "montant_ttc",
            "date_creation", "date_modification",
            "date_envoi_client", "date_validation_client", "date_expiration_validation",
            "mode_validation", "validation_client_active",
        ]

    def get_nb_factures(self, obj):
        return obj.factures.count()


# ─────────────────────────────────────────────
# Lignes de facture
# ─────────────────────────────────────────────

class LigneFactureSerializer(serializers.ModelSerializer):
    class Meta:
        model = LigneFacture
        fields = [
            "id", "ordre", "intitule", "description",
            "quantite", "unite", "prix_unitaire_ht", "montant_ht",
        ]
        read_only_fields = ["id", "montant_ht"]

    def create(self, validated_data):
        instance = super().create(validated_data)
        instance.calculer_montant()
        instance.save(update_fields=["montant_ht"])
        instance.facture.recalculer_totaux()
        return instance

    def update(self, instance, validated_data):
        instance = super().update(instance, validated_data)
        instance.calculer_montant()
        instance.save(update_fields=["montant_ht"])
        instance.facture.recalculer_totaux()
        return instance


# ─────────────────────────────────────────────
# Paiements
# ─────────────────────────────────────────────

class PaiementSerializer(serializers.ModelSerializer):
    mode_libelle = serializers.CharField(source="get_mode_display", read_only=True)
    enregistre_par_nom = serializers.CharField(source="enregistre_par.get_full_name", read_only=True)

    class Meta:
        model = Paiement
        fields = [
            "id", "date_paiement", "montant", "mode", "mode_libelle",
            "reference", "notes",
            "enregistre_par", "enregistre_par_nom",
            "date_creation",
        ]
        read_only_fields = ["id", "enregistre_par", "date_creation"]


class TempsPasseSerializer(serializers.ModelSerializer):
    utilisateur_nom = serializers.CharField(source="utilisateur.nom_complet", read_only=True)
    projet_reference = serializers.CharField(source="projet.reference", read_only=True)
    projet_intitule = serializers.CharField(source="projet.intitule", read_only=True)
    profil_horaire_libelle = serializers.CharField(source="profil_horaire.libelle", read_only=True)
    nature_libelle = serializers.CharField(source="get_nature_display", read_only=True)
    statut_libelle = serializers.CharField(source="get_statut_display", read_only=True)

    class Meta:
        model = TempsPasse
        fields = [
            "id",
            "projet",
            "projet_reference",
            "projet_intitule",
            "utilisateur",
            "utilisateur_nom",
            "profil_horaire",
            "profil_horaire_libelle",
            "date_saisie",
            "nature",
            "nature_libelle",
            "statut",
            "statut_libelle",
            "code_cible",
            "libelle_cible",
            "nb_heures",
            "taux_horaire",
            "cout_total",
            "commentaires",
            "date_creation",
            "date_modification",
        ]
        read_only_fields = ["id", "cout_total", "date_creation", "date_modification"]


# ─────────────────────────────────────────────
# Factures
# ─────────────────────────────────────────────

class FactureListeSerializer(serializers.ModelSerializer):
    """Sérialiseur léger pour les listes."""
    statut_libelle = serializers.CharField(source="get_statut_display", read_only=True)
    projet_reference = serializers.CharField(source="projet.reference", read_only=True)
    montant_restant = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    est_en_retard = serializers.BooleanField(read_only=True)

    class Meta:
        model = Facture
        fields = [
            "id", "reference", "intitule", "statut", "statut_libelle",
            "client_nom", "date_emission", "date_echeance",
            "montant_ht", "montant_ttc", "montant_paye", "montant_restant",
            "est_en_retard",
            "projet", "projet_reference",
        ]


class FactureDetailSerializer(serializers.ModelSerializer):
    """Sérialiseur complet avec lignes et paiements."""
    lignes = LigneFactureSerializer(many=True, read_only=True)
    paiements = PaiementSerializer(many=True, read_only=True)
    statut_libelle = serializers.CharField(source="get_statut_display", read_only=True)
    projet_reference = serializers.CharField(source="projet.reference", read_only=True)
    projet_intitule = serializers.CharField(source="projet.intitule", read_only=True)
    devis_reference = serializers.CharField(source="devis.reference", read_only=True)
    montant_restant = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    est_en_retard = serializers.BooleanField(read_only=True)

    class Meta:
        model = Facture
        fields = [
            "id", "reference", "intitule", "statut", "statut_libelle",
            "devis", "devis_reference",
            "projet", "projet_reference", "projet_intitule",
            "client_nom", "client_contact", "client_email", "client_adresse",
            "date_emission", "date_echeance",
            "date_relance_1", "date_relance_2", "date_relance_3",
            "taux_tva", "penalites_retard_pct",
            "montant_ht", "montant_tva", "montant_ttc",
            "montant_paye", "montant_restant", "est_en_retard",
            "notes", "notes_internes",
            "lignes", "paiements",
            "date_creation", "date_modification",
        ]
        read_only_fields = [
            "id", "montant_ht", "montant_tva", "montant_ttc",
            "montant_paye", "date_creation", "date_modification",
        ]


# ─────────────────────────────────────────────
# Tableau de bord société
# ─────────────────────────────────────────────

class TableauDeBordSerializer(serializers.Serializer):
    """Agrégats pour le tableau de bord société."""
    ca_annee_courante = serializers.DecimalField(max_digits=14, decimal_places=2)
    ca_mois_courant = serializers.DecimalField(max_digits=14, decimal_places=2)
    montant_facture = serializers.DecimalField(max_digits=14, decimal_places=2)
    montant_encaisse = serializers.DecimalField(max_digits=14, decimal_places=2)
    montant_en_attente = serializers.DecimalField(max_digits=14, decimal_places=2)
    montant_en_retard = serializers.DecimalField(max_digits=14, decimal_places=2)
    nb_devis_en_cours = serializers.IntegerField()
    nb_devis_attente_reponse = serializers.IntegerField()
    nb_factures_en_retard = serializers.IntegerField()
    devis_recents = DevisHonorairesListeSerializer(many=True)
    factures_en_retard = FactureListeSerializer(many=True)
