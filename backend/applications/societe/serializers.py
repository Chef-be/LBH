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
    ProfilRHSalarie,
    CalendrierTravailSociete,
    PointageJournalier,
    EvenementPointage,
    DemandeAbsence,
    SoldeAbsenceSalarie,
    CompteurTempsSalarie,
)
from applications.projets.models import MissionClient


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
            "dhmo", "cout_direct_horaire", "taux_vente_horaire",
            "taux_vente_horaire_calcule_k", "forfait_jour_ht_calcule",
            "actif", "ordre",
            "date_creation", "date_modification",
        ]
        read_only_fields = [
            "id", "profil",
            "salaire_brut_estime", "charges_salariales", "charges_patronales",
            "cout_employeur_mensuel", "cout_annuel", "dhmo", "cout_direct_horaire",
            "taux_vente_horaire", "taux_vente_horaire_calcule_k", "forfait_jour_ht_calcule",
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
            "cout_direct_horaire", "taux_vente_horaire_calcule",
            "forfait_jour_ht_calcule", "poids_ponderation",
            "inclure_taux_moyen", "coefficient_k_applique",
            "simulations", "nb_simulations",
            "date_creation", "date_modification",
        ]
        read_only_fields = [
            "id", "taux_horaire_ht_calcule", "taux_vente_horaire_calcule",
            "forfait_jour_ht_calcule", "coefficient_k_applique",
            "date_creation", "date_modification",
        ]

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


class ProfilRHSalarieSerializer(serializers.ModelSerializer):
    utilisateur_nom = serializers.CharField(source="utilisateur.nom_complet", read_only=True)
    profil_horaire_societe_libelle = serializers.CharField(source="profil_horaire_societe.libelle", read_only=True)

    class Meta:
        model = ProfilRHSalarie
        fields = [
            "id", "utilisateur", "utilisateur_nom", "organisation",
            "type_contrat", "regime_temps_travail",
            "heures_hebdomadaires_contractuelles", "jours_travailles_semaine",
            "heure_debut_theorique", "heure_fin_theorique", "pause_midi_minutes",
            "taux_activite", "droit_rtt_annuel", "droit_conges_payes_annuel",
            "solde_rtt_initial", "solde_conges_initial", "solde_recuperation_initial",
            "date_entree", "date_sortie", "actif",
            "profil_horaire_societe", "profil_horaire_societe_libelle",
            "date_creation", "date_modification",
        ]
        read_only_fields = ["id", "utilisateur_nom", "date_creation", "date_modification"]


class CalendrierTravailSocieteSerializer(serializers.ModelSerializer):
    class Meta:
        model = CalendrierTravailSociete
        fields = [
            "id", "annee", "organisation", "libelle", "zone",
            "jours_feries", "jours_non_travailles_exceptionnels", "semaine_type",
            "actif", "date_creation", "date_modification",
        ]
        read_only_fields = ["id", "date_creation", "date_modification"]


class PointageJournalierSerializer(serializers.ModelSerializer):
    utilisateur_nom = serializers.CharField(source="utilisateur.nom_complet", read_only=True)
    valide_par_nom = serializers.CharField(source="valide_par.nom_complet", read_only=True)
    heures_travaillees = serializers.DecimalField(max_digits=8, decimal_places=2, read_only=True)
    statut_libelle = serializers.CharField(source="get_statut_display", read_only=True)

    class Meta:
        model = PointageJournalier
        fields = [
            "id", "utilisateur", "utilisateur_nom", "date",
            "heure_arrivee", "heure_depart", "pause_minutes", "source",
            "statut", "statut_libelle", "commentaire_salarie",
            "commentaire_validateur", "valide_par", "valide_par_nom",
            "date_validation", "heures_travaillees",
            "date_creation", "date_modification",
        ]
        read_only_fields = ["id", "valide_par", "date_validation", "heures_travaillees", "date_creation", "date_modification"]


class EvenementPointageSerializer(serializers.ModelSerializer):
    utilisateur_nom = serializers.CharField(source="utilisateur.nom_complet", read_only=True)

    class Meta:
        model = EvenementPointage
        fields = [
            "id", "utilisateur", "utilisateur_nom", "pointage",
            "horodatage", "type_evenement", "source", "commentaire", "date_creation",
        ]
        read_only_fields = ["id", "date_creation"]


class DemandeAbsenceSerializer(serializers.ModelSerializer):
    utilisateur_nom = serializers.CharField(source="utilisateur.nom_complet", read_only=True)
    valide_par_nom = serializers.CharField(source="valide_par.nom_complet", read_only=True)
    type_absence_libelle = serializers.CharField(source="get_type_absence_display", read_only=True)
    statut_libelle = serializers.CharField(source="get_statut_display", read_only=True)

    class Meta:
        model = DemandeAbsence
        fields = [
            "id", "utilisateur", "utilisateur_nom", "type_absence",
            "type_absence_libelle", "date_debut", "date_fin",
            "demi_journee_debut", "demi_journee_fin",
            "nombre_jours_ouvres_calcule", "nombre_heures_calcule",
            "statut", "statut_libelle", "motif", "justificatif",
            "commentaire_salarie", "commentaire_validateur",
            "valide_par", "valide_par_nom", "date_validation",
            "impacte_solde", "impacte_capacite",
            "date_creation", "date_modification",
        ]
        read_only_fields = [
            "id", "utilisateur_nom", "nombre_jours_ouvres_calcule",
            "nombre_heures_calcule", "valide_par", "date_validation",
            "date_creation", "date_modification",
        ]


class SoldeAbsenceSalarieSerializer(serializers.ModelSerializer):
    utilisateur_nom = serializers.CharField(source="utilisateur.nom_complet", read_only=True)

    class Meta:
        model = SoldeAbsenceSalarie
        fields = [
            "id", "utilisateur", "utilisateur_nom", "annee", "type_absence",
            "acquis", "pris", "en_attente_validation", "solde",
            "report_annee_precedente", "ajuste_manuellement", "commentaire",
            "date_creation", "date_modification",
        ]
        read_only_fields = ["id", "utilisateur_nom", "pris", "en_attente_validation", "solde", "date_creation", "date_modification"]


class CompteurTempsSalarieSerializer(serializers.ModelSerializer):
    utilisateur_nom = serializers.CharField(source="utilisateur.nom_complet", read_only=True)

    class Meta:
        model = CompteurTempsSalarie
        fields = [
            "id", "utilisateur", "utilisateur_nom", "periode_debut", "periode_fin",
            "heures_theoriques", "heures_pointees", "heures_normales",
            "heures_supplementaires", "heures_weekend", "heures_jour_ferie",
            "heures_absence", "heures_formation", "heures_productives",
            "heures_non_productives", "heures_recuperation_acquises",
            "heures_recuperation_prises", "solde_recuperation",
            "statut", "date_calcul", "details_calcul",
            "date_creation", "date_modification",
        ]
        read_only_fields = ["id", "date_calcul", "date_creation", "date_modification"]


class ParametreSocieteSerializer(serializers.ModelSerializer):
    class Meta:
        model = ParametreSociete
        fields = [
            "id", "annee", "zone_smic", "smic_horaire_brut", "pmss", "pass_annuel",
            "taux_charges_salariales", "taux_charges_patronales",
            "heures_productives_be", "decomposition_heures_productives",
            "heures_facturables_jour",
            "objectif_marge_nette", "taux_frais_generaux", "taux_frais_commerciaux",
            "taux_risque_alea", "taux_imponderables", "taux_marge_cible",
            "mode_arrondi_tarif", "pas_arrondi_tarif", "strategie_tarifaire",
            "taux_tva_defaut",
            "date_creation", "date_modification",
        ]
        read_only_fields = ["id", "date_creation", "date_modification"]


class ChargeFixeStructureSerializer(serializers.ModelSerializer):
    montant_annuel = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = ChargeFixeStructure
        fields = [
            "id", "libelle", "categorie", "montant_mensuel", "montant_annuel",
            "actif", "ordre", "date_creation", "date_modification",
        ]
        read_only_fields = ["id", "montant_annuel", "date_creation", "date_modification"]


class MissionClientSocieteSerializer(serializers.ModelSerializer):
    livrables_count = serializers.IntegerField(source="livrables.count", read_only=True)
    profil_horaire_defaut_libelle = serializers.CharField(source="profil_horaire_defaut.libelle", read_only=True)

    class Meta:
        model = MissionClient
        fields = [
            "id",
            "code",
            "libelle",
            "description",
            "famille_client",
            "sous_types_client",
            "nature_ouvrage",
            "phases_concernees",
            "est_active",
            "est_obligatoire",
            "profil_horaire_defaut",
            "profil_horaire_defaut_libelle",
            "duree_etude_heures",
            "mode_chiffrage_defaut",
            "duree_etude_jours",
            "complexite",
            "coefficient_complexite",
            "phase_mission",
            "nature_livrable",
            "inclusion_recommandee_devis",
            "ordre",
            "livrables_count",
            "date_creation",
        ]
        read_only_fields = ["id", "date_creation", "livrables_count", "profil_horaire_defaut_libelle"]


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
            "mode_chiffrage",
            "intitule", "description",
            "profil", "profil_libelle", "profil_couleur",
            "nb_heures", "nb_jours", "taux_horaire",
            "montant_unitaire_ht", "quantite", "unite",
            "montant_ht", "cout_direct_horaire_reference",
            "cout_direct_total_estime", "coefficient_k_applique",
            "marge_estimee_ht", "taux_marge_estime",
            "forfait_jour_ht_reference", "source_tarif",
        ]
        read_only_fields = [
            "id", "montant_ht", "cout_direct_total_estime",
            "coefficient_k_applique", "marge_estimee_ht",
            "taux_marge_estime", "source_tarif",
        ]

    def validate(self, data):
        type_ligne = data.get("type_ligne", "horaire")
        mode = data.get("mode_chiffrage") or ""
        if type_ligne == "horaire" and mode not in ("taux_moyen_be", "taux_profil"):
            if not data.get("nb_heures") or not data.get("taux_horaire"):
                raise serializers.ValidationError(
                    "Une ligne horaire nécessite un nombre d'heures et un taux."
                )
        return data

    def create(self, validated_data):
        instance = super().create(validated_data)
        instance.calculer_montant()
        instance.save(update_fields=[
            "mode_chiffrage", "taux_horaire", "forfait_jour_ht_reference",
            "cout_direct_horaire_reference", "cout_direct_total_estime",
            "coefficient_k_applique", "montant_ht", "marge_estimee_ht",
            "taux_marge_estime", "source_tarif",
        ])
        instance.devis.recalculer_totaux()
        return instance

    def update(self, instance, validated_data):
        instance = super().update(instance, validated_data)
        instance.calculer_montant()
        instance.save(update_fields=[
            "mode_chiffrage", "taux_horaire", "forfait_jour_ht_reference",
            "cout_direct_horaire_reference", "cout_direct_total_estime",
            "coefficient_k_applique", "montant_ht", "marge_estimee_ht",
            "taux_marge_estime", "source_tarif",
        ])
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
            "pointage_journalier",
            "est_productif",
            "categorie_temps",
            "nb_heures",
            "heures_objectif_associees",
            "ecart_heures",
            "taux_horaire",
            "taux_vente_horaire",
            "taux_vente_horaire_reference",
            "cout_direct_horaire",
            "montant_vendu_associe",
            "marge_estimee",
            "cout_total",
            "cout_total_interne",
            "commentaires",
            "date_creation",
            "date_modification",
        ]
        read_only_fields = ["id", "ecart_heures", "cout_total", "cout_total_interne", "date_creation", "date_modification"]


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
