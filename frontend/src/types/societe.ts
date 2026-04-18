/**
 * Types TypeScript — Module Pilotage Société
 */

export interface ProfilHoraire {
  id: string;
  code: string;
  libelle: string;
  description: string;
  taux_horaire_ht: string;
  couleur: string;
  actif: boolean;
  ordre: number;
}

export interface LigneDevis {
  id: string;
  ordre: number;
  type_ligne: "horaire" | "forfait" | "frais" | "sous_traitance";
  phase_code: string;
  intitule: string;
  description: string;
  profil: string | null;
  profil_libelle: string | null;
  profil_couleur: string | null;
  nb_heures: string | null;
  taux_horaire: string | null;
  montant_unitaire_ht: string | null;
  quantite: string;
  unite: string;
  montant_ht: string;
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
  client_nom: string;
  client_contact: string;
  client_email: string;
  client_telephone: string;
  client_adresse: string;
  date_emission: string;
  date_validite: string;
  date_acceptation: string | null;
  date_refus: string | null;
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
  devis_recents: DevisHonoraires[];
  factures_en_retard: Facture[];
}
