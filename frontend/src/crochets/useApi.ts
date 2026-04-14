/**
 * Crochet utilitaire pour les appels API authentifiés.
 * Injecte automatiquement le jeton d'accès JWT dans les en-têtes.
 */

import { useSessionStore } from "@/crochets/useSession";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OptionsRequete extends RequestInit {
  corps?: unknown;
}

export interface ProgressionTeleversement {
  charge: number;
  total: number;
  pourcentage: number;
  debitOctetsSeconde: number;
  tempsRestantSecondes: number | null;
}

export interface ReponsePaginee<T> {
  count?: number;
  next?: string | null;
  previous?: string | null;
  results?: T[];
}

export interface ReponseFichier {
  blob: Blob;
  nomFichier: string | null;
  typeMime: string;
}

export class ErreurApi extends Error {
  constructor(
    public statut: number,
    public detail: string,
    public erreurs?: Record<string, string[]>
  ) {
    super(detail);
    this.name = "ErreurApi";
  }
}

// Table de traduction des noms de champs API → libellés lisibles
const NOMS_CHAMPS: Record<string, string> = {
  intitule: "Intitulé",
  designation: "Désignation",
  designation_courte: "Désignation courte",
  corps_article: "Corps de l'article",
  chapitre: "Chapitre",
  numero_article: "Numéro d'article",
  lot: "Corps d'état",
  reference: "Référence",
  code: "Code",
  libelle: "Libellé",
  nom: "Nom",
  prenom: "Prénom",
  email: "Adresse de courriel",
  mot_de_passe: "Mot de passe",
  entreprise: "Entreprise",
  localite: "Localité",
  date_emission: "Date d'émission",
  unite: "Unité",
  prix_ht: "Prix HT",
  prix_vente_unitaire: "Prix de vente unitaire",
  debourse_sec_unitaire: "Déboursé sec unitaire",
  fichier: "Fichier",
  titre: "Titre",
  description: "Description",
  type_projet: "Type de projet",
};

function nomChampLisible(cle: string): string {
  if (NOMS_CHAMPS[cle]) return NOMS_CHAMPS[cle];
  // Transformation de repli : underscores → espaces, première lettre en majuscule
  return cle.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

function extraireMessageErreur(donnees: unknown, _profondeur = 0): string | null {
  if (!donnees || typeof donnees !== "object") return null;

  const enregistrement = donnees as Record<string, unknown>;

  if (typeof enregistrement.detail === "string" && enregistrement.detail.trim()) {
    return enregistrement.detail;
  }

  const erreursGlobales = enregistrement.non_field_errors;
  if (Array.isArray(erreursGlobales) && typeof erreursGlobales[0] === "string") {
    return erreursGlobales[0];
  }

  for (const [cle, valeur] of Object.entries(enregistrement)) {
    if (cle === "detail" || cle === "code" || cle === "non_field_errors") continue;
    const libelle = _profondeur === 0 ? nomChampLisible(cle) : null;
    const prefixe = libelle ? `${libelle} : ` : "";
    if (typeof valeur === "string" && valeur.trim()) {
      return `${prefixe}${valeur}`;
    }
    if (Array.isArray(valeur) && typeof valeur[0] === "string") {
      return `${prefixe}${valeur[0]}`;
    }
    const messageImbrique = extraireMessageErreur(valeur, _profondeur + 1);
    if (messageImbrique) {
      return libelle ? `${libelle} : ${messageImbrique}` : messageImbrique;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Client API de base
// ---------------------------------------------------------------------------

export async function requeteApi<T = unknown>(
  chemin: string,
  options: OptionsRequete = {}
): Promise<T> {
  const { corps, ...restOptions } = options;
  const corpsEstMultipart = corps instanceof FormData || options.body instanceof FormData;
  const corpsRequete = corps instanceof FormData
    ? corps
    : corps !== undefined
      ? JSON.stringify(corps)
      : options.body;

  const executerRequete = async () => {
    const { jetonAcces } = useSessionStore.getState();
    const entetes: HeadersInit = {
      ...(options.headers as Record<string, string>),
    };
    if (!corpsEstMultipart) {
      (entetes as Record<string, string>)["Content-Type"] = "application/json";
    }
    if (jetonAcces) {
      (entetes as Record<string, string>)["Authorization"] = `Bearer ${jetonAcces}`;
    }

    return fetch(chemin, {
      ...restOptions,
      headers: entetes,
      body: corpsRequete,
    });
  };

  let reponse = await executerRequete();
  if (reponse.status === 401 && useSessionStore.getState().jetonRafraichissement) {
    const succes = await useSessionStore.getState().rafraichirSession();
    if (succes) {
      reponse = await executerRequete();
    }
  }

  if (!reponse.ok) {
    let detail = `Erreur ${reponse.status}`;
    let erreurs: Record<string, string[]> | undefined;
    try {
      const donnees = await reponse.json();
      detail = extraireMessageErreur(donnees) || detail;
      erreurs = donnees;
    } catch {
      // Ignorer les erreurs de parsing
    }
    throw new ErreurApi(reponse.status, detail, erreurs);
  }

  if (reponse.status === 204) {
    return undefined as T;
  }

  return reponse.json();
}

export async function telechargerFichierApi(
  chemin: string,
  options: OptionsRequete = {}
): Promise<ReponseFichier> {
  const { corps, ...restOptions } = options;
  const corpsEstMultipart = corps instanceof FormData || options.body instanceof FormData;
  const corpsRequete = corps instanceof FormData
    ? corps
    : corps !== undefined
      ? JSON.stringify(corps)
      : options.body;

  const executerRequete = async () => {
    const { jetonAcces } = useSessionStore.getState();
    const entetes: HeadersInit = {
      ...(options.headers as Record<string, string>),
    };
    if (!corpsEstMultipart && corps !== undefined) {
      (entetes as Record<string, string>)["Content-Type"] = "application/json";
    }
    if (jetonAcces) {
      (entetes as Record<string, string>)["Authorization"] = `Bearer ${jetonAcces}`;
    }

    return fetch(chemin, {
      ...restOptions,
      headers: entetes,
      body: corpsRequete,
    });
  };

  let reponse = await executerRequete();
  if (reponse.status === 401 && useSessionStore.getState().jetonRafraichissement) {
    const succes = await useSessionStore.getState().rafraichirSession();
    if (succes) {
      reponse = await executerRequete();
    }
  }

  if (!reponse.ok) {
    let detail = `Erreur ${reponse.status}`;
    let erreurs: Record<string, string[]> | undefined;
    try {
      const donnees = await reponse.json();
      detail = extraireMessageErreur(donnees) || detail;
      erreurs = donnees;
    } catch {
      // Ignorer les erreurs de parsing
    }
    throw new ErreurApi(reponse.status, detail, erreurs);
  }

  const disposition = reponse.headers.get("Content-Disposition") || "";
  const correspondance = disposition.match(/filename="?([^"]+)"?/i);

  return {
    blob: await reponse.blob(),
    nomFichier: correspondance?.[1] || null,
    typeMime: reponse.headers.get("Content-Type") || "application/octet-stream",
  };
}

export function extraireListeResultats<T>(
  donnees: T[] | ReponsePaginee<T> | null | undefined
): T[] {
  if (Array.isArray(donnees)) return donnees;
  if (!donnees || typeof donnees !== "object") return [];
  return Array.isArray(donnees.results) ? donnees.results : [];
}

// ---------------------------------------------------------------------------
// Helpers CRUD
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Upload multipart (fichiers)
// ---------------------------------------------------------------------------

export async function uploadFichier<T = unknown>(
  chemin: string,
  formData: FormData
): Promise<T> {
  return requeteApiAvecProgression<T>(chemin, {
    method: "POST",
    corps: formData,
  });
}

export async function requeteApiAvecProgression<T = unknown>(
  chemin: string,
  options: OptionsRequete & {
    onProgression?: (progression: ProgressionTeleversement) => void;
  } = {}
): Promise<T> {
  const { corps, onProgression, headers, ...restOptions } = options;
  const corpsRequete =
    corps instanceof FormData
      ? corps
      : corps !== undefined
        ? JSON.stringify(corps)
        : options.body;

  const corpsEstMultipart = corpsRequete instanceof FormData;

  const methode = options.method || "POST";

  const envoyerRequete = async () =>
    new Promise<{ statut: number; texte: string }>((resolve, reject) => {
      const requete = new XMLHttpRequest();
      const debut = Date.now();
      const { jetonAcces } = useSessionStore.getState();
      const entetes: Record<string, string> = {
        ...((headers as Record<string, string> | undefined) ?? {}),
      };

      if (jetonAcces) {
        entetes.Authorization = `Bearer ${jetonAcces}`;
      }
      if (!corpsEstMultipart) {
        entetes["Content-Type"] = "application/json";
      }

      requete.open(methode, chemin, true);
      Object.entries(entetes).forEach(([cle, valeur]) => {
        requete.setRequestHeader(cle, valeur);
      });

      requete.upload.onprogress = (event) => {
        if (!event.lengthComputable || !onProgression) return;
        const dureeSecondes = Math.max((Date.now() - debut) / 1000, 0.1);
        const debit = event.loaded / dureeSecondes;
        const restant = event.total > event.loaded && debit > 0
          ? (event.total - event.loaded) / debit
          : null;

        onProgression({
          charge: event.loaded,
          total: event.total,
          pourcentage: Math.min(100, Math.round((event.loaded / event.total) * 100)),
          debitOctetsSeconde: debit,
          tempsRestantSecondes: restant,
        });
      };

      requete.onload = () => {
        resolve({
          statut: requete.status,
          texte: requete.responseText || "",
        });
      };

      requete.onerror = () => {
        reject(new ErreurApi(0, "Erreur réseau pendant le téléversement."));
      };

      requete.send(corpsRequete as XMLHttpRequestBodyInit | null | undefined);
    });

  let reponse = await envoyerRequete();
  if (reponse.statut === 401 && useSessionStore.getState().jetonRafraichissement) {
    const succes = await useSessionStore.getState().rafraichirSession();
    if (succes) {
      reponse = await envoyerRequete();
    }
  }

  if (reponse.statut < 200 || reponse.statut >= 300) {
    let detail = `Erreur ${reponse.statut}`;
    let erreurs: Record<string, string[]> | undefined;
    try {
      const donnees = JSON.parse(reponse.texte);
      detail = extraireMessageErreur(donnees) || detail;
      erreurs = donnees;
    } catch {
      // Ignorer les erreurs de parsing
    }
    throw new ErreurApi(reponse.statut, detail, erreurs);
  }

  if (!reponse.texte) return undefined as T;
  return JSON.parse(reponse.texte) as T;
}

export const api = {
  get: <T>(chemin: string) => requeteApi<T>(chemin),

  post: <T>(chemin: string, corps: unknown) =>
    requeteApi<T>(chemin, { method: "POST", corps }),

  patch: <T>(chemin: string, corps: unknown) =>
    requeteApi<T>(chemin, { method: "PATCH", corps }),

  put: <T>(chemin: string, corps: unknown) =>
    requeteApi<T>(chemin, { method: "PUT", corps }),

  supprimer: (chemin: string) =>
    requeteApi(chemin, { method: "DELETE" }),

  telecharger: (chemin: string, options?: OptionsRequete) =>
    telechargerFichierApi(chemin, options),
};
