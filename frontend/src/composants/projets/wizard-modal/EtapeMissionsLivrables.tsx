"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { clsx } from "clsx";
import {
  ChevronDown, ChevronUp, CheckSquare, Square, Lock,
  FileText, Table, ListOrdered, BarChart2, Calendar,
  Calculator, Layers, ClipboardCheck, Wallet, Loader2,
  AlertCircle, Hash, BookOpen, Receipt, BadgeCheck,
  CalendarRange, PieChart, Send, Sigma, Search, Lightbulb,
  Route, FileStack, Network, Stamp, Activity, ShieldCheck,
  TrendingUp, BarChart3, FileSearch,
} from "lucide-react";
import { api } from "@/crochets/useApi";
import type { EtatWizardModal, MissionDisponible, LivrableDisponible, MissionSelectionnee } from "./types";

// ── Icônes Lucide disponibles ─────────────────────────────────────────────────

const ICONES: Record<string, React.ReactNode> = {
  FileText: <FileText size={18} />, Table: <Table size={18} />, ListOrdered: <ListOrdered size={18} />,
  BarChart2: <BarChart2 size={18} />, Calendar: <Calendar size={18} />, Calculator: <Calculator size={18} />,
  Layers: <Layers size={18} />, ClipboardCheck: <ClipboardCheck size={18} />, Wallet: <Wallet size={18} />,
  Hash: <Hash size={18} />, BookOpen: <BookOpen size={18} />, Receipt: <Receipt size={18} />,
  BadgeCheck: <BadgeCheck size={18} />, CalendarRange: <CalendarRange size={18} />, PieChart: <PieChart size={18} />,
  Send: <Send size={18} />, Sigma: <Sigma size={18} />, Search: <Search size={18} />,
  Lightbulb: <Lightbulb size={18} />, Network: <Network size={18} />, Stamp: <Stamp size={18} />,
  Activity: <Activity size={18} />, ShieldCheck: <ShieldCheck size={18} />, TrendingUp: <TrendingUp size={18} />,
  BarChart3: <BarChart3 size={18} />, FileSearch: <FileSearch size={18} />, CheckSquare: <CheckSquare size={18} />,
  Route: <Route size={18} />, FileStack: <FileStack size={18} />,
};

// ── Couleurs par code ─────────────────────────────────────────────────────────

const COULEURS_FOND: Record<string, string> = {
  blue: "bg-blue-100 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800",
  violet: "bg-violet-100 dark:bg-violet-950/30 text-violet-700 dark:text-violet-400 border-violet-200 dark:border-violet-800",
  amber: "bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800",
  green: "bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800",
  teal: "bg-teal-100 dark:bg-teal-950/30 text-teal-700 dark:text-teal-400 border-teal-200 dark:border-teal-800",
  indigo: "bg-indigo-100 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800",
  orange: "bg-orange-100 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800",
  red: "bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800",
  slate: "bg-slate-100 dark:bg-slate-800/50 text-slate-700 dark:text-slate-400 border-slate-200 dark:border-slate-700",
  purple: "bg-purple-100 dark:bg-purple-950/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800",
};

// ── Badge livrable ────────────────────────────────────────────────────────────

function BadgeLivrable({
  livrable,
  selectionne,
  onToggle,
}: {
  livrable: LivrableDisponible;
  selectionne: boolean;
  onToggle: () => void;
}) {
  const couleurClasses = COULEURS_FOND[livrable.couleur] ?? COULEURS_FOND.slate;
  return (
    <button
      type="button"
      onClick={onToggle}
      className={clsx(
        "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-all",
        "focus:outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--c-base)]",
        selectionne ? couleurClasses : "border-[color:var(--bordure)] text-[color:var(--texte-3)] hover:border-[color:var(--bordure-fm)]"
      )}
      style={selectionne ? {} : { background: "var(--fond-carte)" }}
    >
      {selectionne ? <CheckSquare size={11} strokeWidth={2.5} /> : <Square size={11} />}
      {ICONES[livrable.icone] && (
        <span className={selectionne ? "" : "opacity-50"}>{ICONES[livrable.icone]}</span>
      )}
      {livrable.libelle}
    </button>
  );
}

// ── Carte mission ─────────────────────────────────────────────────────────────

function CarteMission({
  mission,
  selectionne,
  livrablesSelectionnes,
  onToggle,
  onToggleLivrable,
}: {
  mission: MissionDisponible;
  selectionne: boolean;
  livrablesSelectionnes: string[];
  onToggle: () => void;
  onToggleLivrable: (code: string) => void;
}) {
  const [expanded, setExpanded] = useState(selectionne);
  const couleurClasses = COULEURS_FOND[mission.couleur] ?? COULEURS_FOND.slate;

  return (
    <div
      className={clsx(
        "rounded-2xl border-2 transition-all duration-200",
        selectionne
          ? "border-[color:var(--c-base)] shadow-md"
          : "border-[color:var(--bordure)] hover:border-[color:var(--bordure-fm)] hover:shadow-sm"
      )}
      style={{ background: "var(--fond-carte)" }}
    >
      {/* En-tête mission */}
      <div className="flex items-start gap-3 p-4">
        {/* Icône + badge obligatoire */}
        <span
          className={clsx(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border",
            selectionne ? couleurClasses : "border-[color:var(--bordure)] text-[color:var(--texte-3)]"
          )}
          style={selectionne ? {} : { background: "var(--fond-entree)" }}
        >
          {ICONES[mission.icone] ?? <FileText size={18} />}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={clsx("text-sm font-semibold", selectionne ? "text-[color:var(--c-base)]" : "text-[color:var(--texte)]")}>
              {mission.libelle}
            </p>
            {mission.est_obligatoire && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                <Lock size={9} /> Recommandée
              </span>
            )}
            {mission.phases_concernees.length > 0 && (
              <div className="flex gap-1 flex-wrap">
                {mission.phases_concernees.map((ph) => (
                  <span key={ph} className="rounded px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase"
                    style={{ background: "var(--fond-entree)", color: "var(--texte-3)" }}>
                    {ph}
                  </span>
                ))}
              </div>
            )}
          </div>
          {mission.description && (
            <p className="mt-0.5 text-xs leading-snug" style={{ color: "var(--texte-2)" }}>
              {mission.description}
            </p>
          )}
        </div>

        {/* Boutons sélection + expand */}
        <div className="flex items-center gap-2 shrink-0">
          {selectionne && mission.livrables.length > 0 && (
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              className="rounded-lg p-1.5 transition-colors hover:bg-[color:var(--fond-entree)]"
              title={expanded ? "Réduire" : "Voir les livrables"}
            >
              {expanded ? <ChevronUp size={14} style={{ color: "var(--texte-3)" }} /> : <ChevronDown size={14} style={{ color: "var(--texte-3)" }} />}
            </button>
          )}
          <button
            type="button"
            onClick={() => { onToggle(); if (!selectionne) setExpanded(true); }}
            className={clsx(
              "flex h-8 w-8 items-center justify-center rounded-xl border-2 transition-all",
              selectionne
                ? "border-[color:var(--c-base)] bg-[color:var(--c-base)] text-white"
                : "border-[color:var(--bordure)] hover:border-[color:var(--c-base)] text-[color:var(--texte-3)]"
            )}
          >
            {selectionne ? <CheckSquare size={15} strokeWidth={2.5} /> : <Square size={15} />}
          </button>
        </div>
      </div>

      {/* Livrables associés */}
      {selectionne && expanded && mission.livrables.length > 0 && (
        <div
          className="mx-4 mb-4 rounded-xl p-3 border"
          style={{ background: "var(--fond-entree)", borderColor: "var(--bordure)" }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--texte-3)" }}>
            Livrables attendus
          </p>
          <div className="flex flex-wrap gap-1.5">
            {mission.livrables.map((lv) => (
              <BadgeLivrable
                key={lv.code}
                livrable={lv}
                selectionne={livrablesSelectionnes.includes(lv.code)}
                onToggle={() => onToggleLivrable(lv.code)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────

interface Props {
  etat: EtatWizardModal;
  erreurs: Record<string, string>;
  onChange: <K extends keyof EtatWizardModal>(champ: K, valeur: EtatWizardModal[K]) => void;
}

export function EtapeMissionsLivrables({ etat, erreurs, onChange }: Props) {
  // Charger les missions disponibles depuis l'API
  const { data, isLoading, isError } = useQuery<{ missions: MissionDisponible[] }>({
    queryKey: ["missions-livrables", etat.familleClientId, etat.sousTypeClientId, etat.natureOuvrage],
    queryFn: () => {
      const p = new URLSearchParams();
      if (etat.familleClientId) p.set("famille_client", etat.familleClientId);
      if (etat.sousTypeClientId) p.set("sous_type_client", etat.sousTypeClientId);
      if (etat.natureOuvrage) p.set("nature_ouvrage", etat.natureOuvrage);
      return api.get(`/api/projets/missions-livrables/?${p.toString()}`);
    },
    staleTime: 60_000,
  });

  const missions = data?.missions ?? [];
  const missionsSelectionnees = etat.missionsSelectionnees;

  function getMissionSelectionnee(code: string): MissionSelectionnee | undefined {
    return missionsSelectionnees.find((m) => m.missionCode === code);
  }

  function toggleMission(mission: MissionDisponible) {
    const existante = getMissionSelectionnee(mission.code);
    let nouvelles: MissionSelectionnee[];
    if (existante) {
      nouvelles = missionsSelectionnees.filter((m) => m.missionCode !== mission.code);
    } else {
      // Pré-sélectionner tous les livrables lors de l'ajout
      nouvelles = [
        ...missionsSelectionnees,
        {
          missionCode: mission.code,
          livrablesCodes: mission.livrables.map((lv) => lv.code),
        },
      ];
    }
    onChange("missionsSelectionnees", nouvelles);
  }

  function toggleLivrable(missionCode: string, livrableCode: string) {
    const nouvelles = missionsSelectionnees.map((m) => {
      if (m.missionCode !== missionCode) return m;
      const codes = m.livrablesCodes.includes(livrableCode)
        ? m.livrablesCodes.filter((c) => c !== livrableCode)
        : [...m.livrablesCodes, livrableCode];
      return { ...m, livrablesCodes: codes };
    });
    onChange("missionsSelectionnees", nouvelles);
  }

  // Total livrables sélectionnés
  const totalLivrables = missionsSelectionnees.reduce((acc, m) => acc + m.livrablesCodes.length, 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 gap-3" style={{ color: "var(--texte-3)" }}>
        <Loader2 size={20} className="animate-spin" />
        <span className="text-sm">Chargement des missions disponibles…</span>
      </div>
    );
  }

  if (isError || missions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
        <AlertCircle size={24} className="text-amber-500" />
        <p className="text-sm" style={{ color: "var(--texte-2)" }}>
          Aucune mission disponible pour ce type de client.
          <br />
          <span className="text-xs" style={{ color: "var(--texte-3)" }}>
            L&apos;administrateur peut configurer les missions depuis l&apos;espace d&apos;administration.
          </span>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête avec compteur */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: "var(--texte)" }}>
            Périmètre de la mission
          </h3>
          <p className="text-xs mt-0.5" style={{ color: "var(--texte-2)" }}>
            Sélectionnez les missions à réaliser. Les livrables associés s&apos;ajustent automatiquement.
          </p>
        </div>
        {missionsSelectionnees.length > 0 && (
          <div
            className="rounded-xl px-3 py-1.5 text-center shrink-0"
            style={{ background: "var(--c-leger)", border: "1px solid var(--c-clair)" }}
          >
            <p className="text-sm font-bold" style={{ color: "var(--c-base)" }}>
              {missionsSelectionnees.length}
            </p>
            <p className="text-[10px]" style={{ color: "var(--c-fort)" }}>
              mission{missionsSelectionnees.length > 1 ? "s" : ""}
            </p>
            {totalLivrables > 0 && (
              <p className="text-[10px] font-medium" style={{ color: "var(--texte-3)" }}>
                {totalLivrables} livrable{totalLivrables > 1 ? "s" : ""}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Grille missions */}
      <div className="space-y-3">
        {missions.map((mission) => {
          const selectionne = Boolean(getMissionSelectionnee(mission.code));
          const livrablesSelectionnes = getMissionSelectionnee(mission.code)?.livrablesCodes ?? [];
          return (
            <CarteMission
              key={mission.code}
              mission={mission}
              selectionne={selectionne}
              livrablesSelectionnes={livrablesSelectionnes}
              onToggle={() => toggleMission(mission)}
              onToggleLivrable={(code) => toggleLivrable(mission.code, code)}
            />
          );
        })}
      </div>

      {erreurs.missions && (
        <p className="text-xs text-red-500">{erreurs.missions}</p>
      )}
    </div>
  );
}
