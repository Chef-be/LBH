export type SourceDesignationMetre = "cctp" | "libre" | "importee" | "zone_visuelle";
export type SourceLigneMetre = "manuel" | "formule" | "zone_visuelle" | "extraction_vectorielle" | "import";
export type StatutLigneMetre = "brouillon" | "calculee" | "verifiee" | "validee" | "integree_dpgf";
export type StatutSynchronisationMetre = "manuel" | "synchronisee" | "desynchronisee";
export type StatutCalculZone = "brouillon" | "calculee" | "erreur";
export type StatutConversionZone = "non_convertie" | "convertie" | "desynchronisee" | "synchronisee";
export type StatutDPGFQuantitative = "brouillon" | "generee" | "transmise_economie" | "archivee";
export type StatutLigneDPGFQuantitative = "brouillon" | "validee" | "a_completer";

export interface LigneMetreQuantitative {
  id: string;
  metre: string;
  numero_ordre: number;
  code_article: string;
  article_cctp: string | null;
  article_cctp_intitule?: string | null;
  article_cctp_statut?: string | null;
  article_cctp_code: string;
  article_cctp_libelle: string;
  chapitre_cctp: string;
  lot_cctp: string;
  designation_source: SourceDesignationMetre;
  article_a_completer: boolean;
  localisation: string;
  niveau: string;
  batiment_zone: string;
  piece: string;
  designation: string;
  nature: string;
  nature_libelle?: string;
  quantite: string | number | null;
  unite: string;
  detail_calcul: string;
  observations: string;
  source_type: SourceLigneMetre;
  source_fond_plan: string | null;
  source_zone_mesure: string | null;
  statut_ligne: StatutLigneMetre;
  statut_synchronisation: StatutSynchronisationMetre;
  date_derniere_synchronisation: string | null;
  quantite_modifiee_manuellement: boolean;
  ordre_dpgf: number | null;
  inclure_dpgf: boolean;
}

export interface FondPlanMetre {
  id: string;
  metre: string;
  intitule: string;
  format_fichier: "pdf" | "image" | "dxf";
  statut_traitement: "televerse" | "rendu_en_cours" | "pret" | "erreur";
  statut_calibration: "non_calibre" | "calibre" | "calibration_a_verifier";
  statut_vectorisation: "non_vectorise" | "en_cours" | "vectorise" | "erreur";
  message_traitement: string;
  message_vectorisation: string;
  echelle: string | number | null;
  echelle_x: string | number | null;
  echelle_y: string | number | null;
  unite_plan: string;
  transformation_coordonnees: Record<string, unknown>;
  page_pdf_total: number;
  rotation: number;
  largeur_px: number | null;
  hauteur_px: number | null;
}

export interface ZoneMesureMetre {
  id: string;
  fond_plan: string;
  ligne_metre: string | null;
  localisation: string;
  localisation_structuree: Record<string, unknown>;
  designation: string;
  article_cctp: string | null;
  source_article_cctp: SourceDesignationMetre;
  code_article: string;
  chapitre_cctp: string;
  lot_cctp: string;
  type_mesure: "surface" | "longueur" | "comptage" | "perimetre";
  points_px: Array<[number, number]>;
  deductions: unknown[];
  valeur_brute: string | number | null;
  valeur_deduction: string | number | null;
  valeur_nette: string | number | null;
  unite: string;
  statut_calcul: StatutCalculZone;
  statut_conversion: StatutConversionZone;
  statut_synchronisation: StatutConversionZone;
  geometrie_modifiee_depuis_conversion: boolean;
}

export interface GeometrieFondPlanMetre {
  id: string;
  fond_plan: string;
  page: number;
  type_source: "dxf" | "pdf_vectoriel" | "raster_vectorise";
  statut: "en_attente" | "en_cours" | "disponible" | "erreur";
  donnees_geojson: Record<string, unknown>;
  segments: unknown[];
  contours: unknown[];
  points_accroche: Array<[number, number, string?]>;
  calques: unknown[];
  statistiques: Record<string, unknown>;
  message_erreur: string;
  date_generation: string | null;
}

export interface LigneDPGFQuantitative {
  id: string;
  ligne_metre_source: string | null;
  zone_mesure_source: string | null;
  article_cctp: string | null;
  lot: string;
  chapitre: string;
  code_article: string;
  designation: string;
  localisation: string;
  quantite: string | number;
  unite: string;
  ordre: number;
  observations: string;
  statut: StatutLigneDPGFQuantitative;
}

export interface DPGFQuantitative {
  id: string;
  projet: string;
  metre_source: string;
  intitule: string;
  statut: StatutDPGFQuantitative;
  lignes: LigneDPGFQuantitative[];
  date_creation: string;
  date_modification: string;
}

export interface ControleCoherenceMetre {
  bloquant: boolean;
  alertes: Array<{ code: string; message: string; ligne?: string; zone?: string; fond_plan?: string }>;
  erreurs: Array<{ code: string; message: string; ligne?: string; zone?: string; fond_plan?: string }>;
  nb_lignes: number;
  nb_zones_non_converties: number;
  nb_lignes_sans_article_cctp: number;
}
