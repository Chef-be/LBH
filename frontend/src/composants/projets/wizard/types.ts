/**
 * Types partagés par tous les composants du wizard de création de projet.
 */

export interface ReferentielOption {
  id: string;
  code: string;
  libelle: string;
  description: string;
  types_livrables?: string[];
  source_reglementaire?: string;
}

export interface ChampDynamique {
  id: string;
  code: string;
  libelle: string;
  type_champ: "texte" | "texte_long" | "selection" | "multi_selection" | "nombre" | "montant" | "date" | "booleen";
  groupe: string;
  section: string;
  placeholder: string;
  aide_courte: string;
  obligatoire: boolean;
  multiple: boolean;
  options: Array<{ value: string; label: string }>;
  source_reglementaire: string;
}

export interface ParcoursProjet {
  etapes: Array<{ code: string; titre: string; ordre: number }>;
  selection?: {
    nature_marche?: string;
    nature_ouvrage?: string;
    missions_principales?: string[];
  };
  referentiels: {
    familles_client: ReferentielOption[];
    sous_types_client: ReferentielOption[];
    contextes_contractuels: ReferentielOption[];
    missions_principales: ReferentielOption[];
    sous_missions: ReferentielOption[];
    phases_intervention: ReferentielOption[];
  };
  champs_dynamiques: Array<{ groupe: string; champs: ChampDynamique[] }>;
  dossiers_ged: Array<{
    code: string;
    intitule: string;
    description: string;
    parent_code?: string;
    est_systeme?: boolean;
  }>;
}

export interface ChampExtrait {
  valeur: string | number;
  confiance: number;
  source: string;
}

export interface LotExtrait {
  numero: string;
  intitule: string;
  montant?: number;
}

export interface ChampsExtraits {
  intitule?: ChampExtrait;
  reference?: ChampExtrait;
  maitre_ouvrage_nom?: ChampExtrait;
  maitre_oeuvre_nom?: ChampExtrait;
  commune?: ChampExtrait;
  departement?: ChampExtrait;
  montant_estime?: ChampExtrait;
  montant_marche?: ChampExtrait;
  date_debut_prevue?: ChampExtrait;
  phase?: ChampExtrait;
  type_projet?: ChampExtrait;
  lots?: LotExtrait[];
}

export interface ResultatPreanalyseSources {
  analyses: Array<{
    nom_fichier: string;
    nom_affichage?: string;
    extension?: string;
    type_mime?: string;
    source_parent?: string | null;
    detail?: string;
    confiance: number;
    mots_cles?: string[];
    type_piece?: { code: string; libelle: string } | null;
  }>;
  resume: {
    fichiers_analyses: number;
    types_detectes: Array<{ code: string; libelle?: string; occurrences: number }>;
    lignes_economiques: number;
    nature_ouvrage: string;
    nature_marche: string;
    contexte_contractuel: string;
  };
  pre_remplissage: {
    donnees_entree: Record<string, string>;
    champs?: ChampsExtraits;
    trace: Record<string, unknown>;
    missions_suggerees: string[];
    methode_estimation: string;
    intitule: string;
  };
}

export interface TachePreanalyseSources {
  id: string;
  statut: "en_attente" | "en_cours" | "terminee" | "echec";
  progression: number;
  message: string;
  nombre_fichiers: number;
  resultat: ResultatPreanalyseSources | null;
  erreur: string;
  date_creation: string;
  date_modification: string;
  date_fin: string | null;
}

export type ValeurChamp = string | string[] | boolean;

export interface ModeVariationPrix {
  type_evolution: string;
  cadre_juridique: string;
  indice_reference: string;
  formule_personnalisee: string;
  date_prix_initial?: string;
  date_remise_offre?: string;
  date_demarrage?: string;
  periodicite_revision?: string;
  clause_applicable?: string;
  part_fixe?: string;
}

export interface ReferenceIndice {
  code: string;
  libelle: string;
  type_index: string;
  territoire: string;
  periodicite: string;
  base_reference: string;
  derniere_valeur: {
    date_valeur: string;
    valeur: number;
    source_publication_url: string;
    source_donnees_url: string;
  } | null;
}

/** État global du wizard, partagé entre tous les composants */
export interface EtatWizard {
  // Étape 1 — Contexte
  familleClientId: string;
  sousTypeClientId: string;
  contexteContractuelId: string;
  missionsPrincipalesSelectionnees: string[];
  phaseInterventionId: string;
  natureOuvrage: "batiment" | "infrastructure" | "mixte";
  natureMarche: "public" | "prive" | "mixte" | "autre";

  // Étape 2 — Identification
  reference: string;
  intitule: string;
  typeProjet: string;
  typeProjetAutre: string;
  statut: string;
  organisationId: string;
  maitreOuvrageId: string;
  maitreOeuvreId: string;
  commune: string;
  departement: string;
  montantEstime: string;
  dateDebutPrevue: string;
  dateFinPrevue: string;
  description: string;

  // Étape 3 — Analyse
  fichiersSourcesProjet: File[];
  preanalyseSourcesId: string | null;
  resultatPreanalyse: ResultatPreanalyseSources | null;
  champsPreremplis: Set<string>; // clés des champs pré-remplis par l'analyse

  // Étape 4 — Missions
  sousMissionsSelectionnees: string[];
  partieContractante: string;
  roleLbh: string;
  methodeEstimation: string;
  donneesEntree: Record<string, ValeurChamp>;
  variationPrix: ModeVariationPrix;
}
