"use client";

/**
 * FournisseurTheme — Plateforme BEE
 * Gère le mode clair/sombre/auto et applique le thème couleur admin
 * via des classes CSS sur <html>.
 */

import {
  createContext, useContext, useEffect, useState, useCallback,
} from "react";
import type { CouleurTheme, ModeTheme, Police } from "./FournisseurConfiguration";

// ---------------------------------------------------------------------------
// Correspondance thème → classe CSS html
// ---------------------------------------------------------------------------

const CLASSE_THEME: Record<CouleurTheme, string> = {
  bleu_marine:   "",                   // défaut — pas de classe additionnelle
  bleu_ciel:     "theme-bleu-ciel",
  emeraude:      "theme-emeraude",
  violet:        "theme-violet",
  ardoise:       "theme-ardoise",
  rouge_brique:  "theme-rouge-brique",
  teal:          "theme-teal",
  brun_dore:     "theme-brun-dore",
};

const URL_POLICE: Record<Police, string> = {
  inter:   "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
  roboto:  "https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap",
  poppins: "https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap",
  raleway: "https://fonts.googleapis.com/css2?family=Raleway:wght@400;500;600;700&display=swap",
  lato:    "https://fonts.googleapis.com/css2?family=Lato:wght@400;700&display=swap",
};

const NOM_POLICE: Record<Police, string> = {
  inter: "Inter", roboto: "Roboto", poppins: "Poppins",
  raleway: "Raleway", lato: "Lato",
};

type ModeEffectif = "clair" | "sombre";

interface ContexteTheme {
  mode: ModeEffectif;
  modePreference: ModeTheme;
  basculerMode: () => void;
  definirMode: (m: ModeTheme) => void;
  couleurTheme: CouleurTheme;
}

const Contexte = createContext<ContexteTheme>({
  mode: "clair",
  modePreference: "automatique",
  basculerMode: () => {},
  definirMode: () => {},
  couleurTheme: "bleu_marine",
});

// ---------------------------------------------------------------------------
// Fournisseur
// ---------------------------------------------------------------------------

export function FournisseurTheme({
  couleurTheme,
  modeDefaut,
  police,
  children,
}: {
  couleurTheme: CouleurTheme;
  modeDefaut: ModeTheme;
  police: Police;
  children: React.ReactNode;
}) {
  const [modePreference, setModePreference] = useState<ModeTheme>(modeDefaut);
  const [mode, setMode] = useState<ModeEffectif>("clair");

  // Calcul du mode effectif
  const calculerModeEffectif = useCallback(
    (pref: ModeTheme): ModeEffectif => {
      if (pref === "clair") return "clair";
      if (pref === "sombre") return "sombre";
      // automatique → suit le système
      if (typeof window !== "undefined") {
        return window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "sombre"
          : "clair";
      }
      return "clair";
    },
    []
  );

  // Initialisation : lire la préférence sauvegardée
  useEffect(() => {
    const sauvegarde = localStorage.getItem("bee-mode-theme") as ModeTheme | null;
    const pref = sauvegarde ?? modeDefaut;
    setModePreference(pref);
    setMode(calculerModeEffectif(pref));
  }, [modeDefaut, calculerModeEffectif]);

  // Écouter le changement de préférence système (pour le mode auto)
  useEffect(() => {
    if (modePreference !== "automatique") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => setMode(mq.matches ? "sombre" : "clair");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [modePreference]);

  // Appliquer les classes sur <html>
  useEffect(() => {
    const html = document.documentElement;

    // Mode sombre
    html.classList.toggle("sombre", mode === "sombre");
    html.classList.toggle("dark", mode === "sombre"); // pour les dark: Tailwind

    // Thème couleur — retirer toutes les classes précédentes
    Object.values(CLASSE_THEME).forEach((c) => { if (c) html.classList.remove(c); });
    const classe = CLASSE_THEME[couleurTheme];
    if (classe) html.classList.add(classe);
  }, [mode, couleurTheme]);

  // Charger la police via Google Fonts
  useEffect(() => {
    const nomPolice = NOM_POLICE[police];
    document.documentElement.style.setProperty("--police", `"${nomPolice}"`);

    // Injecter le lien si pas déjà là
    const id = `font-${police}`;
    if (!document.getElementById(id)) {
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href = URL_POLICE[police];
      document.head.appendChild(link);
    }
  }, [police]);

  const definirMode = useCallback((m: ModeTheme) => {
    setModePreference(m);
    const effectif = calculerModeEffectif(m);
    setMode(effectif);
    localStorage.setItem("bee-mode-theme", m);
  }, [calculerModeEffectif]);

  const basculerMode = useCallback(() => {
    const suivant: ModeTheme = mode === "clair" ? "sombre" : "clair";
    definirMode(suivant);
  }, [mode, definirMode]);

  return (
    <Contexte.Provider value={{ mode, modePreference, basculerMode, definirMode, couleurTheme }}>
      {children}
    </Contexte.Provider>
  );
}

export function useTheme() {
  return useContext(Contexte);
}
