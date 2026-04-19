"""Sérialiseurs pour l'économie de la construction — Plateforme LBH."""

from rest_framework import serializers
from .models import (
    EtudeEconomique,
    LignePrix,
    EtudePrix,
    LignePrixEtude,
    AchatEtudePrix,
    ConventionCollective,
    RegleConventionnelleProfil,
    VarianteLocaleRegleConventionnelle,
    ReferenceSocialeLocalisation,
    ProfilMainOeuvre,
    AffectationProfilProjet,
    ModelePhaseEtudeEconomique,
    PhaseEtudeEconomique,
    JournalPhaseEtudeEconomique,
)


class LignePrixSerialiseur(serializers.ModelSerializer):
    etat_libelle = serializers.CharField(source="get_etat_rentabilite_display", read_only=True)

    class Meta:
        model = LignePrix
        fields = [
            "id", "numero_ordre", "code", "designation", "unite",
            "quantite_prevue", "quantite_reelle",
            "temps_main_oeuvre", "cout_horaire_mo",
            "cout_matieres", "cout_materiel", "cout_sous_traitance", "cout_transport",
            "taux_pertes_surcharge", "taux_frais_chantier_surcharge",
            "taux_frais_generaux_surcharge", "taux_aleas_surcharge", "taux_marge_surcharge",
            "debourse_sec_unitaire", "cout_direct_unitaire",
            "cout_revient_unitaire", "prix_vente_unitaire",
            "marge_brute_unitaire", "marge_nette_unitaire", "taux_marge_nette",
            "marge_brute_totale", "marge_nette_totale", "contribution_marge",
            "etat_rentabilite", "etat_libelle",
            "seuil_quantite_critique", "seuil_prix_minimum",
            "causes_non_rentabilite", "observations",
            "ref_bibliotheque",
        ]
        read_only_fields = [
            "debourse_sec_unitaire", "cout_direct_unitaire",
            "cout_revient_unitaire", "prix_vente_unitaire",
            "marge_brute_unitaire", "marge_nette_unitaire", "taux_marge_nette",
            "marge_brute_totale", "marge_nette_totale", "contribution_marge",
            "etat_rentabilite", "seuil_quantite_critique", "seuil_prix_minimum",
            "causes_non_rentabilite",
        ]


class EtudeEconomiqueListeSerialiseur(serializers.ModelSerializer):
    """Sérialiseur allégé pour les listes."""
    projet_reference = serializers.CharField(source="projet.reference", read_only=True)

    class Meta:
        model = EtudeEconomique
        fields = [
            "id", "projet", "projet_reference", "lot",
            "intitule", "statut", "version", "est_variante",
            "total_prix_vente", "taux_marge_nette_global",
            "date_modification",
        ]


class EtudeEconomiqueDetailSerialiseur(serializers.ModelSerializer):
    """Sérialiseur complet avec lignes."""
    lignes = LignePrixSerialiseur(many=True, read_only=True)
    projet_reference = serializers.CharField(source="projet.reference", read_only=True)
    phases = serializers.SerializerMethodField()

    class Meta:
        model = EtudeEconomique
        fields = [
            "id", "projet", "projet_reference", "lot",
            "intitule", "statut", "version", "est_variante", "etude_parente",
            "taux_frais_chantier", "taux_frais_generaux",
            "taux_aleas", "taux_marge_cible", "taux_pertes",
            "total_debourse_sec", "total_cout_direct",
            "total_cout_revient", "total_prix_vente",
            "total_marge_brute", "total_marge_nette", "taux_marge_nette_global",
            "phases",
            "lignes",
            "date_creation", "date_modification",
        ]
        read_only_fields = [
            "id", "total_debourse_sec", "total_cout_direct",
            "total_cout_revient", "total_prix_vente",
            "total_marge_brute", "total_marge_nette", "taux_marge_nette_global",
            "date_creation", "date_modification",
        ]

    def get_phases(self, obj):
        return PhaseEtudeEconomiqueSerialiseur(obj.phases_planification.all(), many=True).data


class LignePrixEtudeSerialiseur(serializers.ModelSerializer):
    """Sérialiseur pour une ligne de ressource d'une étude de prix."""

    type_libelle = serializers.CharField(source="get_type_ressource_display", read_only=True)
    profil_main_oeuvre_libelle = serializers.CharField(source="profil_main_oeuvre.libelle", read_only=True)
    profil_main_oeuvre_code = serializers.CharField(source="profil_main_oeuvre.code", read_only=True)

    class Meta:
        model = LignePrixEtude
        fields = [
            "id", "etude", "ordre", "type_ressource", "type_libelle",
            "code", "designation", "unite",
            "quantite", "cout_unitaire_ht", "montant_ht",
            "profil_main_oeuvre", "profil_main_oeuvre_code", "profil_main_oeuvre_libelle",
            "nombre_ressources", "temps_unitaire",
            "taux_horaire", "observations",
        ]
        read_only_fields = ["id", "montant_ht"]
        extra_kwargs = {
            "etude": {"required": False, "allow_null": True},
        }

    def validate(self, attrs):
        type_ressource = attrs.get("type_ressource", getattr(self.instance, "type_ressource", None))
        if type_ressource != "mo":
            attrs["profil_main_oeuvre"] = None
            attrs["nombre_ressources"] = 1
            attrs["temps_unitaire"] = 0
            attrs["taux_horaire"] = 0
        return attrs


class EtudePrixListeSerialiseur(serializers.ModelSerializer):
    """Sérialiseur allégé pour les listes d'études de prix."""

    statut_libelle = serializers.CharField(source="get_statut_display", read_only=True)
    methode_libelle = serializers.CharField(source="get_methode_display", read_only=True)
    lot_libelle = serializers.CharField(source="get_lot_type_display", read_only=True)
    projet_reference = serializers.CharField(source="projet.reference", read_only=True)
    organisation_nom = serializers.CharField(source="organisation.nom", read_only=True)

    class Meta:
        model = EtudePrix
        fields = [
            "id", "code", "intitule",
            "methode", "methode_libelle",
            "lot_type", "lot_libelle",
            "projet", "projet_reference",
            "organisation", "organisation_nom",
            "millesime", "zone_taux_horaire", "taux_horaire_mo",
            "statut", "statut_libelle",
            "debourse_sec_ht", "prix_vente_ht", "coefficient_k",
            "date_etude", "date_modification",
        ]


class EtudePrixDetailSerialiseur(serializers.ModelSerializer):
    """Sérialiseur complet avec lignes de ressources."""

    lignes = LignePrixEtudeSerialiseur(many=True, read_only=True)
    achats = serializers.SerializerMethodField()
    statut_libelle = serializers.CharField(source="get_statut_display", read_only=True)
    methode_libelle = serializers.CharField(source="get_methode_display", read_only=True)
    lot_libelle = serializers.CharField(source="get_lot_type_display", read_only=True)
    auteur_nom = serializers.SerializerMethodField()
    projet_reference = serializers.CharField(source="projet.reference", read_only=True)
    organisation_nom = serializers.CharField(source="organisation.nom", read_only=True)
    ligne_bibliotheque_code = serializers.CharField(
        source="ligne_bibliotheque.code",
        read_only=True,
        allow_null=True,
    )

    class Meta:
        model = EtudePrix
        fields = [
            "id", "code", "intitule", "description",
            "methode", "methode_libelle",
            "lot_type", "lot_libelle",
            "millesime", "zone_taux_horaire", "taux_horaire_mo",
            "taux_frais_chantier", "taux_frais_generaux", "taux_aleas", "taux_marge_cible",
            "projet", "projet_reference",
            "organisation", "organisation_nom",
            "hypotheses", "observations",
            "statut", "statut_libelle",
            "date_etude", "date_validation",
            "auteur", "auteur_nom", "validateur",
            "total_mo_ht", "total_matieres_ht", "total_materiel_ht",
            "total_sous_traitance_ht", "total_transport_ht", "total_frais_divers_ht",
            "debourse_sec_ht",
            "montant_frais_chantier_ht", "montant_frais_generaux_ht", "montant_aleas_ht",
            "cout_revient_ht", "marge_previsionnelle_ht", "prix_vente_ht",
            "coefficient_k", "seuil_rentabilite_ht",
            "ligne_bibliotheque", "ligne_bibliotheque_code",
            "lignes", "achats",
            "date_creation", "date_modification",
        ]
        read_only_fields = [
            "id",
            "total_mo_ht", "total_matieres_ht", "total_materiel_ht",
            "total_sous_traitance_ht", "total_transport_ht", "total_frais_divers_ht",
            "debourse_sec_ht",
            "montant_frais_chantier_ht", "montant_frais_generaux_ht", "montant_aleas_ht",
            "cout_revient_ht", "marge_previsionnelle_ht", "prix_vente_ht",
            "coefficient_k", "seuil_rentabilite_ht",
            "date_creation", "date_modification",
        ]
        extra_kwargs = {
            "auteur": {"required": False, "allow_null": True},
            "validateur": {"required": False, "allow_null": True},
            "projet": {"required": False, "allow_null": True},
            "organisation": {"required": False, "allow_null": True},
        }

    def get_auteur_nom(self, obj):
        if obj.auteur:
            return f"{obj.auteur.prenom} {obj.auteur.nom}"
        return None

    def get_achats(self, obj):
        return AchatEtudePrixSerialiseur(obj.achats.all(), many=True).data


class AchatEtudePrixSerialiseur(serializers.ModelSerializer):
    ligne_source_designation = serializers.CharField(source="ligne_source.designation", read_only=True)

    class Meta:
        model = AchatEtudePrix
        fields = [
            "id", "etude", "ligne_source", "ligne_source_designation", "ordre",
            "designation", "fournisseur", "reference_fournisseur", "unite_achat",
            "quantite_besoin", "quantite_conditionnement", "nombre_conditionnements",
            "quantite_commandee", "prix_unitaire_achat_ht", "cout_total_achat_ht",
            "surcout_conditionnement_ht", "observations",
            "date_creation", "date_modification",
        ]
        read_only_fields = [
            "id", "nombre_conditionnements", "quantite_commandee",
            "cout_total_achat_ht", "surcout_conditionnement_ht",
            "date_creation", "date_modification",
        ]
        extra_kwargs = {
            "etude": {"required": False, "allow_null": True},
            "ligne_source": {"required": False, "allow_null": True},
        }


class ConventionCollectiveSerialiseur(serializers.ModelSerializer):
    class Meta:
        model = ConventionCollective
        fields = [
            "id", "code", "libelle", "idcc", "localisation",
            "contingent_heures_supp_non_cadre", "contingent_heures_supp_cadre",
            "source_officielle", "observations", "est_active",
            "date_creation", "date_modification",
        ]
        read_only_fields = ["id", "date_creation", "date_modification"]


class ReferenceSocialeLocalisationSerialiseur(serializers.ModelSerializer):
    localisation_libelle = serializers.CharField(source="get_localisation_display", read_only=True)

    class Meta:
        model = ReferenceSocialeLocalisation
        fields = [
            "id", "code", "libelle", "localisation", "localisation_libelle",
            "smic_horaire", "heures_legales_mensuelles",
            "commentaire_reglementaire", "source_officielle", "est_active",
            "date_creation", "date_modification",
        ]
        read_only_fields = ["id", "localisation_libelle", "date_creation", "date_modification"]


class VarianteLocaleRegleConventionnelleSerialiseur(serializers.ModelSerializer):
    localisation_libelle = serializers.CharField(source="get_localisation_display", read_only=True)
    regle_libelle = serializers.CharField(source="regle.libelle", read_only=True)

    class Meta:
        model = VarianteLocaleRegleConventionnelle
        fields = [
            "id", "regle", "regle_libelle", "localisation", "localisation_libelle", "libelle",
            "salaire_brut_minimum_mensuel",
            "heures_contractuelles_mensuelles_defaut", "heures_par_jour_defaut",
            "taux_charges_salariales_defaut", "taux_charges_patronales_defaut",
            "mutuelle_employeur_mensuelle_defaut",
            "titres_restaurant_employeur_mensuels_defaut",
            "prime_transport_mensuelle_defaut",
            "taux_absenteisme_defaut", "taux_temps_improductif_defaut",
            "taux_occupation_facturable_defaut",
            "cout_recrutement_initial_defaut",
            "source_officielle", "observations", "est_active",
            "date_creation", "date_modification",
        ]
        read_only_fields = [
            "id", "regle_libelle", "localisation_libelle",
            "date_creation", "date_modification",
        ]


class RegleConventionnelleProfilSerialiseur(serializers.ModelSerializer):
    convention_libelle = serializers.CharField(source="convention.libelle", read_only=True)
    categorie_libelle = serializers.CharField(source="get_categorie_display", read_only=True)
    variantes_locales = VarianteLocaleRegleConventionnelleSerialiseur(many=True, read_only=True)

    class Meta:
        model = RegleConventionnelleProfil
        fields = [
            "id", "convention", "convention_libelle",
            "code", "libelle", "categorie", "categorie_libelle",
            "statut_cadre", "niveau_classification",
            "salaire_brut_minimum_mensuel",
            "heures_contractuelles_mensuelles_defaut", "heures_par_jour_defaut",
            "mutuelle_employeur_mensuelle_defaut",
            "titres_restaurant_employeur_mensuels_defaut",
            "prime_transport_mensuelle_defaut",
            "taux_absenteisme_defaut", "taux_temps_improductif_defaut",
            "cout_recrutement_initial_defaut",
            "variantes_locales",
            "observations", "ordre_affichage", "est_active",
            "date_creation", "date_modification",
        ]
        read_only_fields = [
            "id", "convention_libelle", "categorie_libelle",
            "date_creation", "date_modification",
        ]


class ProfilMainOeuvreSerialiseur(serializers.ModelSerializer):
    categorie_libelle = serializers.CharField(source="get_categorie_display", read_only=True)
    secteur_activite_libelle = serializers.CharField(source="get_secteur_activite_display", read_only=True)
    localisation_libelle = serializers.CharField(source="get_localisation_display", read_only=True)
    convention_collective_libelle = serializers.CharField(source="convention_collective.libelle", read_only=True)
    regle_conventionnelle_libelle = serializers.CharField(source="regle_conventionnelle.libelle", read_only=True)
    salaire_brut_minimum_conventionnel = serializers.SerializerMethodField()
    heures_contractuelles_mensuelles_defaut = serializers.SerializerMethodField()
    heures_par_jour_defaut = serializers.SerializerMethodField()
    taux_absenteisme_defaut = serializers.SerializerMethodField()
    taux_temps_improductif_defaut = serializers.SerializerMethodField()
    mutuelle_employeur_mensuelle_defaut = serializers.SerializerMethodField()
    titres_restaurant_employeur_mensuels_defaut = serializers.SerializerMethodField()
    prime_transport_mensuelle_defaut = serializers.SerializerMethodField()
    cout_recrutement_initial_defaut = serializers.SerializerMethodField()
    taux_horaire_recommande_defaut = serializers.SerializerMethodField()

    class Meta:
        model = ProfilMainOeuvre
        fields = [
            "id", "code", "libelle", "categorie", "categorie_libelle",
            "secteur_activite", "secteur_activite_libelle",
            "corps_etat",
            "metier", "specialite", "niveau_classification", "fonction_equipe",
            "description_emploi", "source_officielle",
            "localisation", "localisation_libelle",
            "convention_collective", "convention_collective_libelle",
            "regle_conventionnelle", "regle_conventionnelle_libelle",
            "salaire_brut_minimum_conventionnel",
            "salaire_brut_mensuel_defaut", "primes_mensuelles_defaut", "avantages_mensuels_defaut",
            "heures_contractuelles_mensuelles", "heures_par_jour",
            "nb_heures_supp_25_mensuelles", "nb_heures_supp_50_mensuelles",
            "panier_repas_journalier", "jours_travail_mensuels_defaut",
            "heures_contractuelles_mensuelles_defaut", "heures_par_jour_defaut",
            "taux_charges_salariales", "taux_charges_patronales",
            "taux_absenteisme", "taux_temps_improductif",
            "taux_absenteisme_defaut", "taux_temps_improductif_defaut",
            "taux_frais_agence", "taux_risque_operationnel", "taux_marge_cible",
            "mutuelle_employeur_mensuelle_defaut",
            "titres_restaurant_employeur_mensuels_defaut",
            "prime_transport_mensuelle_defaut",
            "cout_recrutement_initial_defaut",
            "taux_horaire_recommande_defaut",
            "cout_equipement_mensuel", "cout_transport_mensuel", "cout_structure_mensuel",
            "est_actif", "ordre_affichage", "date_creation", "date_modification",
        ]
        read_only_fields = [
            "id", "date_creation", "date_modification",
            "categorie_libelle", "secteur_activite_libelle", "localisation_libelle",
            "convention_collective_libelle", "regle_conventionnelle_libelle",
            "salaire_brut_minimum_conventionnel",
            "heures_contractuelles_mensuelles_defaut", "heures_par_jour_defaut",
            "taux_absenteisme_defaut", "taux_temps_improductif_defaut",
            "mutuelle_employeur_mensuelle_defaut",
            "titres_restaurant_employeur_mensuels_defaut",
            "prime_transport_mensuelle_defaut",
            "cout_recrutement_initial_defaut",
            "taux_horaire_recommande_defaut",
        ]

    def get_salaire_brut_minimum_conventionnel(self, obj):
        return getattr(getattr(obj, "regle_conventionnelle", None), "salaire_brut_minimum_mensuel", None)

    def get_heures_contractuelles_mensuelles_defaut(self, obj):
        return getattr(
            getattr(obj, "regle_conventionnelle", None),
            "heures_contractuelles_mensuelles_defaut",
            obj.heures_contractuelles_mensuelles,
        )

    def get_heures_par_jour_defaut(self, obj):
        return getattr(getattr(obj, "regle_conventionnelle", None), "heures_par_jour_defaut", obj.heures_par_jour)

    def get_taux_absenteisme_defaut(self, obj):
        return getattr(getattr(obj, "regle_conventionnelle", None), "taux_absenteisme_defaut", obj.taux_absenteisme)

    def get_taux_temps_improductif_defaut(self, obj):
        return getattr(
            getattr(obj, "regle_conventionnelle", None),
            "taux_temps_improductif_defaut",
            obj.taux_temps_improductif,
        )

    def get_mutuelle_employeur_mensuelle_defaut(self, obj):
        return getattr(getattr(obj, "regle_conventionnelle", None), "mutuelle_employeur_mensuelle_defaut", 55)

    def get_titres_restaurant_employeur_mensuels_defaut(self, obj):
        return getattr(getattr(obj, "regle_conventionnelle", None), "titres_restaurant_employeur_mensuels_defaut", 0)

    def get_prime_transport_mensuelle_defaut(self, obj):
        return getattr(getattr(obj, "regle_conventionnelle", None), "prime_transport_mensuelle_defaut", 0)

    def get_cout_recrutement_initial_defaut(self, obj):
        return getattr(getattr(obj, "regle_conventionnelle", None), "cout_recrutement_initial_defaut", 0)

    def get_taux_horaire_recommande_defaut(self, obj):
        try:
            return float(obj.calculer_taux_horaire_recommande())
        except Exception:
            return None


class AffectationProfilProjetSerialiseur(serializers.ModelSerializer):
    profil_libelle = serializers.CharField(source="profil.libelle", read_only=True)
    projet_reference = serializers.CharField(source="projet.reference", read_only=True)
    clientele_libelle = serializers.CharField(source="get_clientele_display", read_only=True)
    mode_facturation_libelle = serializers.CharField(source="get_mode_facturation_display", read_only=True)

    class Meta:
        model = AffectationProfilProjet
        fields = [
            "id", "projet", "projet_reference", "profil", "profil_libelle",
            "clientele", "clientele_libelle",
            "mode_facturation", "mode_facturation_libelle",
            "charge_previsionnelle_jours", "coefficient_k",
            "taux_horaire_recommande", "taux_journalier_recommande",
            "dernier_calcul", "observations", "date_creation", "date_modification",
        ]
        read_only_fields = [
            "id", "projet_reference", "profil_libelle",
            "clientele_libelle", "mode_facturation_libelle",
            "date_creation", "date_modification",
        ]


class JournalPhaseEtudeEconomiqueSerialiseur(serializers.ModelSerializer):
    auteur_nom = serializers.CharField(source="auteur.nom_complet", read_only=True)

    class Meta:
        model = JournalPhaseEtudeEconomique
        fields = [
            "id",
            "auteur",
            "auteur_nom",
            "ancienne_duree_jours",
            "nouvelle_duree_jours",
            "motif",
            "date_creation",
        ]
        read_only_fields = fields


class ModelePhaseEtudeEconomiqueSerialiseur(serializers.ModelSerializer):
    role_intervenant_libelle = serializers.CharField(source="get_role_intervenant_display", read_only=True)
    profil_main_oeuvre_libelle = serializers.CharField(source="profil_main_oeuvre.libelle", read_only=True)

    class Meta:
        model = ModelePhaseEtudeEconomique
        fields = [
            "id",
            "code",
            "libelle",
            "description",
            "ordre",
            "role_intervenant",
            "role_intervenant_libelle",
            "specialite_requise",
            "niveau_intervention",
            "duree_previsionnelle_jours",
            "profil_main_oeuvre",
            "profil_main_oeuvre_libelle",
            "est_actif",
            "date_creation",
            "date_modification",
        ]
        read_only_fields = [
            "id",
            "role_intervenant_libelle",
            "profil_main_oeuvre_libelle",
            "date_creation",
            "date_modification",
        ]


class PhaseEtudeEconomiqueSerialiseur(serializers.ModelSerializer):
    role_intervenant_libelle = serializers.CharField(source="get_role_intervenant_display", read_only=True)
    profil_main_oeuvre_libelle = serializers.CharField(source="profil_main_oeuvre.libelle", read_only=True)
    utilisateur_assigne_nom = serializers.CharField(source="utilisateur_assigne.nom_complet", read_only=True)
    duree_active_jours = serializers.DecimalField(max_digits=8, decimal_places=2, read_only=True)
    journal = JournalPhaseEtudeEconomiqueSerialiseur(source="journal_ajustements", many=True, read_only=True)
    motif_ajustement = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = PhaseEtudeEconomique
        fields = [
            "id",
            "etude",
            "modele",
            "code",
            "libelle",
            "description",
            "ordre",
            "role_intervenant",
            "role_intervenant_libelle",
            "specialite_requise",
            "niveau_intervention",
            "duree_previsionnelle_jours",
            "duree_revisee_jours",
            "duree_active_jours",
            "profil_main_oeuvre",
            "profil_main_oeuvre_libelle",
            "utilisateur_assigne",
            "utilisateur_assigne_nom",
            "statut",
            "motif_dernier_ajustement",
            "motif_ajustement",
            "journal",
            "date_creation",
            "date_modification",
        ]
        read_only_fields = [
            "id",
            "role_intervenant_libelle",
            "profil_main_oeuvre_libelle",
            "utilisateur_assigne_nom",
            "duree_active_jours",
            "motif_dernier_ajustement",
            "journal",
            "date_creation",
            "date_modification",
        ]
        extra_kwargs = {
            "etude": {"required": False, "allow_null": True},
            "modele": {"required": False, "allow_null": True},
            "profil_main_oeuvre": {"required": False, "allow_null": True},
            "utilisateur_assigne": {"required": False, "allow_null": True},
        }


class SimulationMainOeuvreEntreeSerialiseur(serializers.Serializer):
    profil_code = serializers.CharField(required=False, allow_blank=True)
    profil_libelle = serializers.CharField(required=False, allow_blank=True)
    clientele = serializers.ChoiceField(
        choices=[c[0] for c in AffectationProfilProjet.CLIENTELES],
        default="public",
    )
    localisation = serializers.ChoiceField(
        choices=[c[0] for c in ProfilMainOeuvre.LOCALISATIONS],
        default="metropole",
    )
    salaire_brut_mensuel = serializers.DecimalField(max_digits=10, decimal_places=2)
    primes_mensuelles = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, default=0)
    avantages_mensuels = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, default=0)
    contrat_travail = serializers.ChoiceField(choices=["cdi", "cdd"], default="cdi", required=False)
    statut_cadre = serializers.BooleanField(required=False, default=False)
    quotite_travail = serializers.DecimalField(max_digits=5, decimal_places=4, required=False, default="1.0000")
    heures_supplementaires_mensuelles = serializers.DecimalField(max_digits=8, decimal_places=2, required=False, default=0)
    majoration_heures_supplementaires = serializers.DecimalField(max_digits=6, decimal_places=4, required=False, default="0.2500")
    heures_contractuelles_mensuelles = serializers.DecimalField(max_digits=8, decimal_places=2, required=False, default="151.67")
    heures_par_jour = serializers.DecimalField(max_digits=5, decimal_places=2, required=False, default="7.00")
    taux_charges_salariales = serializers.DecimalField(max_digits=6, decimal_places=4)
    taux_charges_patronales = serializers.DecimalField(max_digits=6, decimal_places=4)
    taux_absenteisme = serializers.DecimalField(max_digits=6, decimal_places=4)
    taux_temps_improductif = serializers.DecimalField(max_digits=6, decimal_places=4)
    taux_frais_agence = serializers.DecimalField(max_digits=6, decimal_places=4)
    taux_risque_operationnel = serializers.DecimalField(max_digits=6, decimal_places=4)
    taux_marge_cible = serializers.DecimalField(max_digits=6, decimal_places=4)
    mutuelle_employeur_mensuelle = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, default=0)
    titres_restaurant_employeur_mensuels = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, default=0)
    prime_transport_mensuelle = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, default=0)
    cout_equipement_mensuel = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, default=0)
    cout_transport_mensuel = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, default=0)
    cout_structure_mensuel = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, default=0)
    appliquer_rgdu = serializers.BooleanField(required=False, default=True)
    taux_occupation_facturable = serializers.DecimalField(max_digits=6, decimal_places=4, required=False, default="0.7800")
    jours_facturables_cibles_annuels = serializers.DecimalField(max_digits=8, decimal_places=2, required=False, allow_null=True)
    cout_recrutement_initial = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, default=0)
    nombre_profils = serializers.IntegerField(required=False, min_value=1, default=1)


class LignePilotageActiviteEntreeSerialiseur(SimulationMainOeuvreEntreeSerialiseur):
    effectif = serializers.IntegerField(required=False, min_value=1, default=1)


class PlanActiviteEntreeSerialiseur(serializers.Serializer):
    lignes = LignePilotageActiviteEntreeSerialiseur(many=True)
