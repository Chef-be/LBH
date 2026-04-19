// Types TypeScript pour le wizard modal de création de projet
// Plateforme LBH — Bureau d'Études Économiste

export interface ReferentielOption {
  id: string;
  code: string;
  libelle: string;
  description?: string;
}

export interface MissionDisponible {
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
  livrables: LivrableDisponible[];
}

export interface LivrableDisponible {
  id: string;
  code: string;
  libelle: string;
  type_document: string;
  format_attendu: string;
  icone: string;
  couleur: string;
}

export interface MissionSelectionnee {
  missionCode: string;
  livrablesCodes: string[];
}

export interface VariationPrix {
  type_evolution: string;
  cadre_juridique: string;
  indice_reference: string;
  formule_personnalisee: string;
  date_prix_initial: string;
  date_remise_offre: string;
  date_demarrage: string;
  periodicite_revision: string;
  clause_applicable: string;
  part_fixe: string;
}

export interface EtatWizardModal {
  // Étape 1 — Type client
  familleClientId: string;
  sousTypeClientId: string;

  // Étape 2 — Contexte contractuel
  contexteContractuelId: string;
  natureOuvrage: string;
  natureMarche: string;
  roleLbh: string;

  // Étape 3 — Localisation / Identification
  reference: string;
  intitule: string;
  typeProjet: string;
  typeProjetAutre: string;
  statut: string;
  commune: string;
  departement: string;
  organisationId: string;
  maitreOuvrageId: string;
  maitreOeuvreId: string;

  // Étape 4 — Missions / Livrables
  missionsSelectionnees: MissionSelectionnee[];
  phaseInterventionId: string;

  // Étape 5 — Sources / Analyse IA
  fichiersSourcesProjet: File[];
  preanalyseSourcesId: string | null;
  resultatPreanalyse: ResultatPreanalyse | null;
  champsPreremplis: Set<string>;

  // Étape 6 — Données / Estimation
  montantEstime: string;
  dateDebutPrevue: string;
  dateFinPrevue: string;
  description: string;
  methodeEstimation: string;
  donneesEntree: Record<string, unknown>;
  variationPrix: VariationPrix;
}

export interface ResultatPreanalyse {
  pre_remplissage: {
    intitule?: string;
    champs?: {
      intitule?: { valeur: string; confiance: number };
      commune?: { valeur: string; confiance: number };
      departement?: { valeur: string; confiance: number };
      montant_estime?: { valeur: number; confiance: number };
    };
    description_detectee?: string;
    methode_estimation?: string;
    donnees_entree?: Record<string, unknown>;
    type_document_detecte?: string;
    lot_detecte?: string;
  };
  documents_analyses?: DocumentAnalyse[];
  confidence_globale?: number;
}

export interface DocumentAnalyse {
  nom_fichier: string;
  type_detecte: string;
  confiance: number;
  dossier_ged_suggere?: string;
  informations?: Record<string, unknown>;
  classification_confirmee?: boolean;
}

export interface TachePreanalyse {
  id: string;
  statut: "en_attente" | "en_cours" | "terminee" | "echec";
  progression: number;
  message: string;
  resultat?: ResultatPreanalyse;
  erreur?: string;
}

export interface EtapeWizard {
  id: string;
  titre: string;
  description: string;
  icone: string;
}

export const ETAPES_WIZARD_MODAL: EtapeWizard[] = [
  { id: "type-client",          titre: "Type de client",         description: "Famille et sous-type",     icone: "Users" },
  { id: "contexte",             titre: "Contexte",               description: "Nature et cadre contractuel", icone: "FileSignature" },
  { id: "identification",       titre: "Identification",         description: "Nom, lieu, intervenants",  icone: "MapPin" },
  { id: "missions-livrables",   titre: "Missions & Livrables",   description: "Périmètre de la mission",  icone: "CheckSquare" },
  { id: "sources-analyse",      titre: "Sources & Analyse IA",   description: "Documents et extraction",  icone: "Sparkles" },
  { id: "donnees-estimation",   titre: "Données & Estimation",   description: "Budget et calendrier",     icone: "Calculator" },
  { id: "recapitulatif",        titre: "Récapitulatif",          description: "Vérification et création", icone: "Rocket" },
];

export type NatureOuvrage = "batiment" | "infrastructure" | "mixte";
export type NatureMarche = "public" | "prive" | "mixte";
