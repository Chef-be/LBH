"use client";

import { clsx } from "clsx";
import { CheckCircle2, Landmark, Pencil, HardHat, MoreHorizontal } from "lucide-react";
import type { EtatWizardModal } from "./types";

// ── Familles client ────────────────────────────────────────────────────────────

const FAMILLES = [
  {
    id: "maitrise_ouvrage",
    libelle: "Maîtrise d'ouvrage",
    description: "Client final ou donneur d'ordre : collectivité, promoteur, bailleur social.",
    icone: <Landmark size={28} />,
    couleur: { border: "border-blue-500", bg: "bg-blue-50 dark:bg-blue-950/30", icone: "text-blue-600 dark:text-blue-400" },
    sousTyes: [
      { id: "collectivite",       libelle: "Collectivité / Établissement public" },
      { id: "promoteur_prive",    libelle: "Promoteur immobilier / Investisseur privé" },
      { id: "bailleur_social",    libelle: "Bailleur social (OPH, ESH, SA HLM)" },
      { id: "syndicat_copropriete", libelle: "Syndicat de copropriété" },
    ],
  },
  {
    id: "maitrise_oeuvre",
    libelle: "Maîtrise d'œuvre",
    description: "Architecte, BET ou équipe pluridisciplinaire en charge de la conception.",
    icone: <Pencil size={28} />,
    couleur: { border: "border-violet-500", bg: "bg-violet-50 dark:bg-violet-950/30", icone: "text-violet-600 dark:text-violet-400" },
    sousTyes: [
      { id: "architecte",              libelle: "Architecte mandataire" },
      { id: "equipe_pluridisciplinaire", libelle: "Équipe pluridisciplinaire (archi + BET)" },
      { id: "opc",                     libelle: "OPC / AMO technique" },
      { id: "economiste_associe",      libelle: "Économiste associé / co-traitant" },
    ],
  },
  {
    id: "entreprise",
    libelle: "Entreprise de travaux",
    description: "Entreprise générale, lot séparé, co-traitance ou sous-traitance.",
    icone: <HardHat size={28} />,
    couleur: { border: "border-amber-500", bg: "bg-amber-50 dark:bg-amber-950/30", icone: "text-amber-600 dark:text-amber-400" },
    sousTyes: [
      { id: "entreprise_generale", libelle: "Entreprise générale (marché global)" },
      { id: "lot_separe",          libelle: "Lot séparé (corps d'état)" },
      { id: "groupement",          libelle: "Groupement / co-traitance" },
      { id: "sous_traitance",      libelle: "Sous-traitant" },
    ],
  },
  {
    id: "autre",
    libelle: "Autre contexte",
    description: "AMO, association, partenaire institutionnel ou contexte spécifique.",
    icone: <MoreHorizontal size={28} />,
    couleur: { border: "border-slate-400", bg: "bg-slate-50 dark:bg-slate-800/40", icone: "text-slate-500" },
    sousTyes: [
      { id: "amo",        libelle: "AMO / Conseil" },
      { id: "partenaire", libelle: "Partenaire" },
      { id: "association", libelle: "Association / Organisme" },
      { id: "autre",      libelle: "Autre" },
    ],
  },
];

interface EtapeTypeClientProps {
  etat: EtatWizardModal;
  erreurs: Record<string, string>;
  onChange: <K extends keyof EtatWizardModal>(champ: K, valeur: EtatWizardModal[K]) => void;
}

export function EtapeTypeClient({ etat, erreurs, onChange }: EtapeTypeClientProps) {
  const familleCourante = FAMILLES.find((f) => f.id === etat.familleClientId);

  return (
    <div className="space-y-8">
      {/* Titre section */}
      <div>
        <h3 className="text-base font-semibold" style={{ color: "var(--texte)" }}>
          Quelle est la nature du client ?
        </h3>
        <p className="text-sm mt-1" style={{ color: "var(--texte-2)" }}>
          Le type de client détermine les missions recommandées et les livrables attendus.
        </p>
      </div>

      {/* Grille familles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {FAMILLES.map((famille) => {
          const selected = etat.familleClientId === famille.id;
          return (
            <button
              key={famille.id}
              type="button"
              onClick={() => {
                onChange("familleClientId", famille.id);
                onChange("sousTypeClientId", "");
              }}
              className={clsx(
                "relative text-left rounded-2xl border-2 p-4 transition-all duration-150",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-base)]",
                selected
                  ? `${famille.couleur.border} ${famille.couleur.bg} shadow-md`
                  : "border-[color:var(--bordure)] hover:border-[color:var(--bordure-fm)] hover:shadow-sm"
              )}
              style={{ background: selected ? undefined : "var(--fond-carte)" }}
            >
              {selected && (
                <CheckCircle2 size={16} className="absolute top-3 right-3 text-emerald-500" strokeWidth={2.5} />
              )}
              <span className={clsx("mb-2 block", selected ? famille.couleur.icone : "text-[color:var(--texte-3)]")}>
                {famille.icone}
              </span>
              <p className="font-semibold text-sm text-[color:var(--texte)] leading-snug">{famille.libelle}</p>
              <p className="mt-1 text-[11px] text-[color:var(--texte-2)] leading-snug hidden sm:block">
                {famille.description}
              </p>
            </button>
          );
        })}
      </div>
      {erreurs.famille_client && (
        <p className="text-xs text-red-500">{erreurs.famille_client}</p>
      )}

      {/* Sous-types — apparaissent après sélection famille */}
      {familleCourante && (
        <div
          className="rounded-2xl p-5 border transition-all"
          style={{ background: "var(--fond-entree)", borderColor: "var(--bordure)" }}
        >
          <p className="text-sm font-medium mb-3" style={{ color: "var(--texte)" }}>
            Préciser le type de {familleCourante.libelle.toLowerCase()}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {familleCourante.sousTyes.map((st) => {
              const selected = etat.sousTypeClientId === st.id;
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => onChange("sousTypeClientId", st.id)}
                  className={clsx(
                    "flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-left transition-all",
                    "border focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-base)]",
                    selected
                      ? "border-[color:var(--c-base)] text-[color:var(--c-base)] font-medium"
                      : "border-[color:var(--bordure)] text-[color:var(--texte)] hover:border-[color:var(--bordure-fm)]"
                  )}
                  style={{ background: selected ? "var(--c-leger)" : "var(--fond-carte)" }}
                >
                  <span
                    className={clsx(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                      selected ? "border-[color:var(--c-base)] bg-[color:var(--c-base)]" : "border-[color:var(--bordure)]"
                    )}
                  >
                    {selected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                  </span>
                  {st.libelle}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
