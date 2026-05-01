/**
 * Types TypeScript — Module Pilotage Société
 */

export interface ReferentielOptionSociete {
  id: string;
  code: string;
  libelle: string;
  description?: string;
}

export interface ParcoursProjetSociete {
  referentiels: {
    familles_client: ReferentielOptionSociete[];
    sous_types_client: ReferentielOptionSociete[];
    contextes_contractuels: ReferentielOptionSociete[];
    missions_principales: ReferentielOptionSociete[];
    sous_missions: ReferentielOptionSociete[];
    phases_intervention: ReferentielOptionSociete[];
  };
}

export interface LivrableMissionSociete {
  id: string;
  code: string;
  libelle: string;
  type_document: string;
  format_attendu: string;
  icone: string;
  couleur: string;
}

export interface MissionAssistantSociete {
  id: string;
  code: string;
  libelle: string;
  description: string;
  famille_client: string;
  nature_ouvrage: string;
  phases_concernees: string[];
  icone: string;
  couleur: string;
  est_obligatoire: boolean;
  profil_horaire_defaut_id?: string;
  profil_horaire_defaut_libelle?: string;
  profil_horaire_defaut_taux?: string;
  duree_etude_heures?: string;
  mode_chiffrage_defaut?: ModeChiffrageDevis;
  duree_etude_jours?: string;
  complexite?: "simple" | "standard" | "complexe" | "tres_complexe";
  coefficient_complexite?: string;
  phase_mission?: "ESQ" | "APS" | "APD" | "PRO" | "ACT" | "VISA" | "DET" | "AOR" | "OPC" | "autre";
  nature_livrable?: string;
  inclusion_recommandee_devis?: boolean;
  livrables: LivrableMissionSociete[];
}

export interface MissionSelectionneeDevis {
  missionCode: string;
  missionLabel?: string;
  livrablesCodes: string[];
  livrablesLabels?: string[];
}

export interface ContexteProjetSaisiDevis {
  famille_client: string;
  sous_type_client: string;
  contexte_contractuel: string;
  mission_principale?: string;
  missions_associees: string[];
  livrables_selectionnes: string[];
  phase_intervention: string;
  nature_ouvrage: string;
  nature_marche: string;
  role_lbh: string;
  methode_estimation: string;
  donnees_entree: Record<string, unknown>;
}

export interface SuggestionPrestationDevis {
  ordre: number;
  mission_code: string;
  intitule: string;
  description: string;
  phase_code: string;
  livrables_codes: string[];
  livrables_labels: string[];
  type_ligne: "horaire" | "forfait" | "frais" | "sous_traitance";
  mode_chiffrage?: ModeChiffrageDevis;
  quantite: string;
  unite: string;
  nb_heures_suggerees: string;
  nb_jours_suggerees?: string;
  profil_horaire_id: string;
  profil_horaire_libelle: string;
  taux_horaire_suggere: string;
  forfait_jour_suggere?: string;
}

export interface AssistantDevisResponse {
  reference_suggeree: string;
  missions: MissionAssistantSociete[];
  suggestions_prestations: SuggestionPrestationDevis[];
  contexte_projet_saisi: ContexteProjetSaisiDevis;
  profil_horaire_suggere: {
    id: string;
    libelle: string;
    taux_horaire_ht: string;
  };
}

export interface SimulationSalaire {
  id: string;
  profil: string;
  libelle: string;
  salaire_net_mensuel: string;
  primes_mensuelles: string;
  avantages_mensuels: string;
  salaire_brut_estime: string;
  charges_salariales: string;
  charges_patronales: string;
  cout_employeur_mensuel: string;
  cout_annuel: string;
  dhmo: string;
  cout_direct_horaire: string;
  taux_vente_horaire: string;
  taux_vente_horaire_calcule_k: string;
  forfait_jour_ht_calcule: string;
  actif: boolean;
  ordre: number;
  date_creation: string;
  date_modification: string;
}

export interface ProfilHoraire {
  id: string;
  code: string;
  libelle: string;
  description: string;
  taux_horaire_ht: string;
  couleur: string;
  actif: boolean;
  ordre: number;
  type_profil: "be" | "autre";
  taux_charges_salariales: string;
  taux_charges_patronales: string;
  heures_productives_an: string;
  taux_marge_vente: string;
  taux_horaire_ht_calcule: string | null;
  utiliser_calcul: boolean;
  cout_direct_horaire: string;
  taux_vente_horaire_calcule: string;
  forfait_jour_ht_calcule: string;
  poids_ponderation: string;
  inclure_taux_moyen: boolean;
  coefficient_k_applique: string;
  simulations: SimulationSalaire[];
  nb_simulations: number;
  date_creation: string;
  date_modification: string;
}

export interface ProfilHoraireUtilisateur {
  id: string;
  utilisateur: string;
  utilisateur_nom: string;
  utilisateur_fonction: string;
  profil_horaire: string;
  profil_horaire_libelle: string;
  date_creation: string;
  date_modification: string;
}

export interface ParametreSociete {
  id: string;
  annee: number;
  zone_smic: string;
  smic_horaire_brut: string;
  pmss: string;
  pass_annuel: string;
  taux_charges_salariales: string;
  taux_charges_patronales: string;
  heures_productives_be: string;
  decomposition_heures_productives: Record<string, number>;
  heures_facturables_jour: string;
  objectif_marge_nette: string;
  taux_frais_generaux: string;
  taux_frais_commerciaux: string;
  taux_risque_alea: string;
  taux_imponderables: string;
  taux_marge_cible: string;
  mode_arrondi_tarif: "aucun" | "euro" | "cinq_euros" | "dix_euros";
  pas_arrondi_tarif: string;
  strategie_tarifaire: "taux_unique" | "taux_par_profil" | "mixte";
  taux_tva_defaut: string;
  date_creation: string;
  date_modification: string;
}

export interface ChargeFixeStructure {
  id: string;
  libelle: string;
  categorie: "loyer" | "logiciels" | "assurances" | "comptabilite" | "vehicule" | "telephonie" | "materiel" | "documentation" | "frais_bancaires" | "sous_traitance_structurelle" | "commercial" | "autres";
  montant_mensuel: string;
  montant_annuel: string;
  actif: boolean;
  ordre: number;
  date_creation: string;
  date_modification: string;
}

export type ModeChiffrageDevis =
  | "taux_moyen_be"
  | "taux_profil"
  | "forfait_jour_profil"
  | "forfait_mission"
  | "frais"
  | "sous_traitance";

export interface LigneDevis {
  id: string;
  ordre: number;
  type_ligne: "horaire" | "forfait" | "frais" | "sous_traitance";
  mode_chiffrage: ModeChiffrageDevis | "";
  phase_code: string;
  intitule: string;
  description: string;
  profil: string | null;
  profil_libelle: string | null;
  profil_couleur: string | null;
  nb_heures: string | null;
  nb_jours: string | null;
  taux_horaire: string | null;
  montant_unitaire_ht: string | null;
  quantite: string;
  unite: string;
  montant_ht: string;
  cout_direct_horaire_reference: string | null;
  cout_direct_total_estime: string | null;
  coefficient_k_applique: string | null;
  marge_estimee_ht: string | null;
  taux_marge_estime: string | null;
  forfait_jour_ht_reference: string | null;
  source_tarif: string;
}

export interface PilotageEconomiqueSociete {
  annee: number;
  coefficient_k: string;
  cout_direct_annuel: string;
  charges_structure_annuelles: string;
  frais_generaux_annuels?: string;
  frais_commerciaux_annuels?: string;
  risques_annuels?: string;
  imponderables_annuels?: string;
  cout_complet_annuel: string;
  ca_cible_annuel: string;
  ca_cible_mensuel: string;
  cout_direct_horaire_moyen_pondere: string;
  taux_horaire_moyen_pondere: string;
  forfait_jour_moyen_ht: string;
  heures_facturables_jour: string;
  seuil_rentabilite_annuel?: string;
  seuil_rentabilite_mensuel?: string;
  heures_facturables_annuelles_necessaires?: string;
  jours_facturables_annuels_necessaires?: string;
  ca_signe?: string;
  ca_facture?: string;
  ca_encaisse?: string;
  reste_a_produire?: string;
  montant_en_attente?: string;
  montant_en_retard?: string;
  heures_vendues?: string;
  heures_consommees?: string;
  ecart_heures_vendues_passees?: string;
  marge_previsionnelle?: string;
  marge_reelle?: string;
  taux_occupation_facturable?: string;
  details: Record<string, string>;
}

export interface DevisHonoraires {
  id: string;
  reference: string;
  intitule: string;
  statut: "brouillon" | "envoye" | "accepte" | "refuse" | "expire" | "annule";
  statut_libelle: string;
  projet: string | null;
  projet_reference: string | null;
  projet_intitule: string | null;
  famille_client: string;
  sous_type_client: string;
  contexte_contractuel: string;
  nature_ouvrage: string;
  nature_marche: string;
  role_lbh: string;
  contexte_projet_saisie: ContexteProjetSaisiDevis;
  missions_selectionnees: MissionSelectionneeDevis[];
  client_nom: string;
  client_contact: string;
  client_email: string;
  client_telephone: string;
  client_adresse: string;
  date_emission: string;
  date_validite: string;
  date_acceptation: string | null;
  date_refus: string | null;
  date_envoi_client: string | null;
  date_validation_client: string | null;
  date_expiration_validation: string | null;
  mode_validation: "" | "manuel" | "client";
  validation_client_active: boolean;
  taux_tva: string;
  acompte_pct: string;
  delai_paiement_jours: number;
  montant_ht: string;
  montant_tva: string;
  montant_ttc: string;
  objet: string;
  conditions_particulieres: string;
  notes_internes: string;
  lignes: LigneDevis[];
  nb_factures: number;
  date_creation: string;
  date_modification: string;
}

export interface LigneFacture {
  id: string;
  ordre: number;
  intitule: string;
  description: string;
  quantite: string;
  unite: string;
  prix_unitaire_ht: string;
  montant_ht: string;
}

export interface Paiement {
  id: string;
  date_paiement: string;
  montant: string;
  mode: string;
  mode_libelle: string;
  reference: string;
  notes: string;
  enregistre_par: string | null;
  enregistre_par_nom: string | null;
  date_creation: string;
}

export interface Facture {
  id: string;
  reference: string;
  intitule: string;
  statut: "brouillon" | "emise" | "en_retard" | "partiellement_payee" | "payee" | "annulee" | "avoir";
  statut_libelle: string;
  devis: string | null;
  devis_reference: string | null;
  projet: string | null;
  projet_reference: string | null;
  projet_intitule: string | null;
  client_nom: string;
  client_contact: string;
  client_email: string;
  client_adresse: string;
  date_emission: string;
  date_echeance: string;
  date_relance_1: string | null;
  date_relance_2: string | null;
  date_relance_3: string | null;
  taux_tva: string;
  penalites_retard_pct: string;
  montant_ht: string;
  montant_tva: string;
  montant_ttc: string;
  montant_paye: string;
  montant_restant: string;
  est_en_retard: boolean;
  notes: string;
  notes_internes: string;
  lignes: LigneFacture[];
  paiements: Paiement[];
  date_creation: string;
  date_modification: string;
}

export interface TableauDeBord {
  ca_annee_courante: string;
  ca_mois_courant: string;
  montant_facture: string;
  montant_encaisse: string;
  montant_en_attente: string;
  montant_en_retard: string;
  nb_devis_en_cours: number;
  nb_devis_attente_reponse: number;
  nb_factures_en_retard: number;
  pilotage_economique: PilotageEconomiqueSociete;
  devis_recents: DevisHonoraires[];
  factures_en_retard: Facture[];
  temps_passes_recents: TempsPasse[];
  rentabilite_par_salarie: RentabiliteSalarie[];
  rentabilite_par_dossier: RentabiliteDossier[];
}

export interface TempsPasse {
  id: string;
  projet: string;
  projet_reference: string;
  projet_intitule: string;
  utilisateur: string;
  utilisateur_nom: string;
  profil_horaire: string | null;
  profil_horaire_libelle: string | null;
  date_saisie: string;
  nature: "projet" | "mission" | "livrable";
  nature_libelle: string;
  statut: "brouillon" | "valide";
  statut_libelle: string;
  code_cible: string;
  libelle_cible: string;
  nb_heures: string;
  taux_horaire: string;
  taux_vente_horaire: string;
  cout_direct_horaire: string;
  montant_vendu_associe: string;
  marge_estimee: string;
  cout_total: string;
  commentaires: string;
  date_creation: string;
  date_modification: string;
}

export interface RentabiliteSalarie {
  utilisateur_id: string;
  nom_complet: string;
  total_heures: string;
  total_cout: string;
  honoraires_associes: string;
  marge_estimee: string;
}

export interface RentabiliteDossier {
  projet_id: string;
  reference: string;
  intitule: string;
  total_heures: string;
  total_cout: string;
  honoraires_associes: string;
  marge_estimee: string;
}
