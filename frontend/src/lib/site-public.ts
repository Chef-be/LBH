import type { ConfigurationSite } from "@/contextes/FournisseurConfiguration";
import contenuAccueilParDefaut from "@/contenus/site-public/accueil.json";
import contenuContactParDefaut from "@/contenus/site-public/contact.json";
import contenuNotreMethodeParDefaut from "@/contenus/site-public/notre-methode.json";
import contenuPrestationsParDefaut from "@/contenus/site-public/prestations.json";
import contenuReferencesParDefaut from "@/contenus/site-public/references.json";

export interface BlocTexteAccueil {
  titre: string;
  icone: string;
  description: string;
}

export interface SecteurAccueil {
  titre: string;
  icone: string;
  description: string;
  tags: string[];
}

export interface ContenuAccueil {
  metadata: {
    titre_par_defaut: string;
    description_par_defaut: string;
  };
  hero: {
    sous_titre_secours: string;
    indicateurs: string[];
  };
  sections: Record<string, string>;
  secteurs: SecteurAccueil[];
  pilotage: BlocTexteAccueil[];
}

export interface ContenuContact {
  metadata: { titre_page: string; description_page: string };
  hero: { badge: string; titre: string; description: string };
  coordonnees: {
    titre: string;
    courriel: string;
    telephone: string;
    adresse: string;
    delai_titre: string;
    delai_valeur: string;
  };
  exemples: { titre: string; liste: string[] };
  espace_prive: { question: string; bouton: string };
  formulaire: { titre: string };
}

export interface ContenuNotreMethode {
  metadata: { titre_page: string; description_page: string };
  hero: { badge: string; titre: string; description: string };
  engagements: { liste: Array<{ valeur: string; libelle: string }> };
  phases: {
    badge: string;
    titre: string;
    liste: Array<{
      numero: string;
      icone: string;
      titre: string;
      description: string;
      points: string[];
    }>;
  };
  referentiels: {
    badge: string;
    titre: string;
    description: string;
    liste: Array<{ titre: string; description: string }>;
  };
  cta: {
    titre: string;
    description: string;
    bouton_principal: string;
    bouton_secondaire: string;
  };
}

export interface ContenuPrestations {
  metadata: { titre_page: string; description_page: string };
  hero: { badge: string; titre: string; description: string };
  cta_bas_page: { titre: string; description: string; bouton: string };
  categories: Record<string, string>;
  detail: {
    retour: string;
    bouton_contact: string;
    bloc_points_forts: string;
    bloc_description: string;
    bloc_avantages: string;
    bloc_livrables: string;
    bloc_autres_titre: string;
    bloc_autres_bouton: string;
    cta_titre: string;
    cta_description: string;
    cta_bouton: string;
  };
}

export interface ContenuReferences {
  metadata: { titre_page: string; description_page: string };
  hero: { badge: string; titre: string; description: string };
  etat_vide: { sur_titre: string; titre: string; description: string };
  liste: { titre: string };
  secteurs: { titre: string; liste: string[] };
  cta: { titre: string; description: string; bouton: string };
  domaines_exemple: Array<{ titre: string; lieu: string; tags: string[] }>;
}

export const CONTENU_ACCUEIL_VIDE: ContenuAccueil = {
  metadata: {
    titre_par_defaut: "Accueil",
    description_par_defaut: "",
  },
  hero: {
    sous_titre_secours: "",
    indicateurs: [],
  },
  sections: {},
  secteurs: [],
  pilotage: [],
};

export const CONTENUS_PAGES_VIDES: ConfigurationSite["contenus_pages"] = {
  contact: {},
  notre_methode: {},
  prestations: {},
  references: {},
};

const CONTENU_NOTRE_METHODE_DEFAUT: ContenuNotreMethode = {
  ...(contenuNotreMethodeParDefaut as unknown as Omit<ContenuNotreMethode, "cta">),
  cta: {
    titre: "Prêt à travailler avec nous ?",
    description: "Décrivez-nous votre projet et nous vous proposerons une intervention adaptée.",
    bouton_principal: "Nous contacter",
    bouton_secondaire: "Voir nos prestations",
  },
};

const CONTENU_PRESTATIONS_DEFAUT: ContenuPrestations = {
  ...(contenuPrestationsParDefaut as unknown as Omit<ContenuPrestations, "detail">),
  detail: {
    ...(contenuPrestationsParDefaut.detail as unknown as Omit<
      ContenuPrestations["detail"],
      "bloc_autres_titre" | "bloc_autres_bouton" | "cta_titre" | "cta_description" | "cta_bouton"
    >),
    bloc_autres_titre: "Nos autres prestations",
    bloc_autres_bouton: "Voir toutes les prestations",
    cta_titre: "Besoin d'une intervention pour votre projet ?",
    cta_description: "Décrivez-nous votre projet et nous vous proposerons une réponse adaptée.",
    cta_bouton: "Prendre contact",
  },
};

function avecSecours<T>(valeur: unknown, secours: T): T {
  if (!valeur) return secours;
  if (typeof valeur === "object" && !Array.isArray(valeur) && Object.keys(valeur as object).length === 0) {
    return secours;
  }
  return valeur as T;
}

export function obtenirContenuAccueil(
  configuration?: ConfigurationSite | null
): ContenuAccueil {
  return avecSecours(configuration?.contenu_accueil, contenuAccueilParDefaut as ContenuAccueil);
}

export function obtenirContenusPages(
  configuration?: ConfigurationSite | null
): ConfigurationSite["contenus_pages"] {
  return configuration?.contenus_pages ?? CONTENUS_PAGES_VIDES;
}

export function obtenirContenuContact(
  configuration?: ConfigurationSite | null
): ContenuContact {
  return avecSecours(obtenirContenusPages(configuration).contact, contenuContactParDefaut as ContenuContact);
}

export function obtenirContenuNotreMethode(
  configuration?: ConfigurationSite | null
): ContenuNotreMethode {
  return avecSecours(obtenirContenusPages(configuration).notre_methode, CONTENU_NOTRE_METHODE_DEFAUT);
}

export function obtenirContenuPrestations(
  configuration?: ConfigurationSite | null
): ContenuPrestations {
  return avecSecours(obtenirContenusPages(configuration).prestations, CONTENU_PRESTATIONS_DEFAUT);
}

export function obtenirContenuReferences(
  configuration?: ConfigurationSite | null
): ContenuReferences {
  return avecSecours(obtenirContenusPages(configuration).references, contenuReferencesParDefaut as ContenuReferences);
}

export function obtenirNomPlateforme(
  configuration?: Pick<ConfigurationSite, "nom_bureau"> | null
): string {
  return configuration?.nom_bureau?.trim() ?? "";
}

export function obtenirSigleAffiche(
  configuration?: Pick<ConfigurationSite, "sigle"> | null
): string {
  return configuration?.sigle?.trim() ?? "";
}

export function obtenirInitialesNom(nom: string): string {
  return nom
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((partie) => partie[0]?.toUpperCase() ?? "")
    .join("");
}

export function absolutiserUrlMedia(
  url: string | null | undefined,
  origine = ""
): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  if (!origine) return url;
  try {
    return new URL(url, origine).toString();
  } catch {
    return url;
  }
}

export function convertirContenuRicheEnHtml(
  contenu: string | null | undefined
): string {
  const valeur = contenu?.trim() ?? "";
  if (!valeur) return "";
  if (/<[a-z][\s\S]*>/i.test(valeur)) {
    return valeur;
  }
  return valeur
    .split(/\n{2,}/)
    .map((bloc) => bloc.trim())
    .filter(Boolean)
    .map((bloc) => `<p>${bloc.replace(/\n/g, "<br />")}</p>`)
    .join("");
}

export function normaliserConfigurationSite(
  configuration: ConfigurationSite,
  origine = ""
): ConfigurationSite {
  return {
    ...configuration,
    logo: absolutiserUrlMedia(configuration.logo, origine),
    logo_pied_de_page: absolutiserUrlMedia(configuration.logo_pied_de_page, origine),
    favicon: absolutiserUrlMedia(configuration.favicon, origine),
    carousel_accueil: Array.isArray(configuration.carousel_accueil)
      ? configuration.carousel_accueil.map((diapositive) => ({
          ...diapositive,
          image_url: absolutiserUrlMedia(diapositive.image_url, origine) ?? "",
        }))
      : [],
  };
}

export function obtenirMarqueAffichee(
  configuration?: Pick<ConfigurationSite, "nom_bureau" | "sigle"> | null
): string {
  const sigle = obtenirSigleAffiche(configuration);
  if (sigle) return sigle;

  const nom = obtenirNomPlateforme(configuration);
  if (!nom) return "";

  return obtenirInitialesNom(nom);
}
