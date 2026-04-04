/**
 * Crochet Zustand pour la gestion de la session utilisateur.
 * Stocke les jetons JWT et les informations de l'utilisateur connecté.
 * Le jeton de rafraîchissement est persisté en localStorage pour survivre
 * aux rechargements de page ; le jeton d'accès est régénéré automatiquement.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Utilisateur {
  id: string;
  courriel: string;
  prenom: string;
  nom: string;
  nom_complet: string;
  telephone: string;
  fonction: string;
  organisation: string | null;
  organisation_nom: string | null;
  profil: string | null;
  profil_libelle: string | null;
  est_super_admin: boolean;
  langue: string;
  fuseau_horaire: string;
  notifications_courriel: boolean;
  courriel_verifie_le?: string | null;
  invitation_envoyee_le?: string | null;
  invitation_en_attente?: boolean;
}

interface EtatSession {
  utilisateur: Utilisateur | null;
  jetonAcces: string | null;
  jetonRafraichissement: string | null;
  estConnecte: boolean;
  estHydratee: boolean;
  // Actions
  connecter: (courriel: string, motDePasse: string) => Promise<void>;
  deconnecter: () => Promise<void>;
  rafraichirSession: () => Promise<boolean>;
  definirUtilisateur: (utilisateur: Utilisateur) => void;
  definirJetons: (acces: string, rafraichissement: string) => void;
  definirEtatHydratation: (estHydratee: boolean) => void;
}

// ---------------------------------------------------------------------------
// Store Zustand
// ---------------------------------------------------------------------------

export const useSessionStore = create<EtatSession>()(
  persist(
    (set, get) => ({
      utilisateur: null,
      jetonAcces: null,
      jetonRafraichissement: null,
      estConnecte: false,
      estHydratee: false,

      connecter: async (courriel: string, motDePasse: string) => {
        const reponse = await fetch("/api/auth/connexion/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ courriel, mot_de_passe: motDePasse }),
        });

        if (!reponse.ok) {
          const erreur = await reponse.json();
          const message =
            erreur?.non_field_errors?.[0] ||
            erreur?.detail ||
            "Identifiants incorrects.";
          throw new Error(message);
        }

        const donnees = await reponse.json();
        set({
          utilisateur: donnees.utilisateur,
          jetonAcces: donnees.jetons.acces,
          jetonRafraichissement: donnees.jetons.rafraichissement,
          estConnecte: true,
          estHydratee: true,
        });
      },

      deconnecter: async () => {
        const { jetonRafraichissement, jetonAcces } = get();
        try {
          await fetch("/api/auth/deconnexion/", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${jetonAcces}`,
            },
            body: JSON.stringify({ rafraichissement: jetonRafraichissement }),
          });
        } catch {
          // Ignorer les erreurs réseau à la déconnexion
        }
        set({
          utilisateur: null,
          jetonAcces: null,
          jetonRafraichissement: null,
          estConnecte: false,
          estHydratee: true,
        });
      },

      /**
       * Régénère le jeton d'accès à partir du jeton de rafraîchissement.
       * Appelé automatiquement au chargement de l'espace privé.
       * Retourne true si succès, false si le jeton est expiré (→ déconnexion).
       */
      rafraichirSession: async (): Promise<boolean> => {
        const { jetonRafraichissement, estConnecte } = get();

        if (!estConnecte || !jetonRafraichissement) {
          set({
            utilisateur: null,
            jetonAcces: null,
            jetonRafraichissement: null,
            estConnecte: false,
            estHydratee: true,
          });
          return false;
        }

        try {
          const reponse = await fetch("/api/auth/rafraichir/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            // simplejwt attend le champ "refresh"
            body: JSON.stringify({ refresh: jetonRafraichissement }),
          });

          if (reponse.ok) {
            const donnees = await reponse.json();
            set({
              jetonAcces: donnees.access,
              jetonRafraichissement: donnees.refresh ?? jetonRafraichissement,
              estConnecte: true,
              estHydratee: true,
            });
            return true;
          } else {
            // Jeton expiré ou invalide → forcer la déconnexion
            set({
              utilisateur: null,
              jetonAcces: null,
              jetonRafraichissement: null,
              estConnecte: false,
              estHydratee: true,
            });
            return false;
          }
        } catch {
          // Erreur réseau — on ne déconnecte pas pour éviter une boucle offline
          return false;
        }
      },

      definirUtilisateur: (utilisateur) => set({ utilisateur }),
      definirJetons: (acces, rafraichissement) =>
        set({ jetonAcces: acces, jetonRafraichissement: rafraichissement }),
      definirEtatHydratation: (estHydratee) => set({ estHydratee }),
    }),
    {
      name: "session-bee",
      // Persister le jeton de rafraîchissement pour survivre aux rechargements.
      // Le jeton d'accès (court) sera régénéré automatiquement au chargement.
      partialize: (etat) => ({
        utilisateur: etat.utilisateur,
        estConnecte: etat.estConnecte,
        jetonRafraichissement: etat.jetonRafraichissement,
      }),
      onRehydrateStorage: () => (etat) => {
        etat?.definirEtatHydratation?.(true);
      },
    }
  )
);
