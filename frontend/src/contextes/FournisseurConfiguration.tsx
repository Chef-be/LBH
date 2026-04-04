"use client";

/**
 * Fournisseur de configuration du site vitrine — Plateforme BEE.
 * Alimenté côté serveur depuis le layout racine et consommé par les composants client.
 */

import { createContext, useContext } from "react";
import contenuAccueilParDefaut from "@/contenus/site-public/accueil.json";
import contenuContactParDefaut from "@/contenus/site-public/contact.json";
import contenuNotreMethodeParDefaut from "@/contenus/site-public/notre-methode.json";
import contenuPrestationsParDefaut from "@/contenus/site-public/prestations.json";
import contenuReferencesParDefaut from "@/contenus/site-public/references.json";

export type CouleurTheme =
  | "bleu_marine" | "bleu_ciel" | "emeraude" | "violet"
  | "ardoise" | "rouge_brique" | "teal" | "brun_dore";

export type ModeTheme = "automatique" | "clair" | "sombre";
export type Police = "inter" | "roboto" | "poppins" | "raleway" | "lato";

export interface DiapositiveCarrousel {
  titre: string;
  sous_titre: string;
  image_url: string;
  cta_texte: string;
  cta_lien: string;
  couleur_fond: string;
}

export interface ConfigurationSite {
  nom_bureau: string;
  slogan: string;
  sigle: string;
  description_courte: string;
  logo: string | null;
  logo_pied_de_page: string | null;
  favicon: string | null;
  titre_hero: string;
  sous_titre_hero: string;
  etiquette_hero: string;
  texte_cta_principal: string;
  texte_cta_secondaire: string;
  courriel_contact: string;
  telephone_contact: string;
  adresse: string;
  ville: string;
  code_postal: string;
  pays: string;
  afficher_stats: boolean;
  afficher_valeurs: boolean;
  afficher_demarche: boolean;
  afficher_realisations: boolean;
  afficher_equipe: boolean;
  afficher_contact: boolean;
  texte_cta_bandeau: string;
  texte_description_bandeau: string;
  couleur_theme: CouleurTheme;
  mode_theme_defaut: ModeTheme;
  police_principale: Police;
  activer_carrousel_accueil: boolean;
  carousel_accueil: DiapositiveCarrousel[];
  contenu_accueil: {
    metadata: {
      titre_par_defaut: string;
      description_par_defaut: string;
    };
    hero: {
      sous_titre_secours: string;
      indicateurs: string[];
    };
    sections: Record<string, string>;
    secteurs: Array<{
      titre: string;
      icone: string;
      description: string;
      tags: string[];
    }>;
    pilotage: Array<{
      titre: string;
      icone: string;
      description: string;
    }>;
  };
  contenus_pages: {
    contact: Record<string, unknown>;
    notre_methode: Record<string, unknown>;
    prestations: Record<string, unknown>;
    references: Record<string, unknown>;
  };
  meta_titre: string;
  meta_description: string;
  mots_cles: string;
}

export const CONFIGURATION_PAR_DEFAUT: ConfigurationSite = {
  nom_bureau: "",
  slogan: "Économie de la construction, pièces écrites, pilotage et qualité d'exécution",
  sigle: "",
  description_courte: "Bureau d'études dédié au chiffrage, aux métrés, aux CCTP, au pilotage des travaux et à la maîtrise contractuelle des opérations bâtiment et VRD.",
  logo: null,
  logo_pied_de_page: null,
  favicon: null,
  titre_hero: "L'expertise économique au service de vos projets de construction",
  sous_titre_hero: "Économie, dimensionnement voirie, métrés, pièces écrites, appels d'offres et suivi d'exécution — une plateforme intégrée pour des études rigoureuses et traçables.",
  etiquette_hero: "Bureau d'études spécialisé BTP · VRD · Économie de la construction",
  texte_cta_principal: "Nos prestations",
  texte_cta_secondaire: "Nous contacter",
  courriel_contact: "",
  telephone_contact: "",
  adresse: "",
  ville: "",
  code_postal: "",
  pays: "France",
  afficher_stats: true,
  afficher_valeurs: true,
  afficher_demarche: true,
  afficher_realisations: false,
  afficher_equipe: false,
  afficher_contact: true,
  texte_cta_bandeau: "Vous avez un projet de construction ?",
  texte_description_bandeau: "Nous intervenons de l'estimation préalable à la réception des travaux, avec une logique commune de chiffrage, rédaction, suivi contractuel et qualité.",
  couleur_theme: "bleu_marine",
  mode_theme_defaut: "automatique",
  police_principale: "inter",
  activer_carrousel_accueil: true,
  carousel_accueil: [],
  contenu_accueil: contenuAccueilParDefaut,
  contenus_pages: {
    contact: contenuContactParDefaut,
    notre_methode: contenuNotreMethodeParDefaut,
    prestations: contenuPrestationsParDefaut,
    references: contenuReferencesParDefaut,
  },
  meta_titre: "",
  meta_description: "",
  mots_cles: "",
};

const ContexteConfiguration = createContext<ConfigurationSite>(CONFIGURATION_PAR_DEFAUT);

export function FournisseurConfiguration({
  configuration,
  children,
}: {
  configuration: ConfigurationSite;
  children: React.ReactNode;
}) {
  return (
    <ContexteConfiguration.Provider value={configuration}>
      {children}
    </ContexteConfiguration.Provider>
  );
}

export function useConfiguration(): ConfigurationSite {
  return useContext(ContexteConfiguration);
}
