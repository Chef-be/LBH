"use client";

import { useState } from "react";
import { clsx } from "clsx";
import {
  CheckCircle2, Circle, ChevronDown, ChevronUp,
  FileText, Table, ListOrdered, BarChart2, Calendar,
  Calculator, ClipboardCheck, Wallet, Hash, BookOpen,
  Receipt, BadgeCheck, CalendarRange, PieChart, Send,
  Sigma, Search, Lightbulb, Network, Stamp, Activity,
  TrendingUp, BarChart3, FileSearch, CheckSquare,
  Plus, Sparkles,
} from "lucide-react";

// ── Icônes ────────────────────────────────────────────────────────────────────

const ICONES: Record<string, React.ReactNode> = {
  FileText: <FileText size={15} />, Table: <Table size={15} />, ListOrdered: <ListOrdered size={15} />,
  BarChart2: <BarChart2 size={15} />, Calendar: <Calendar size={15} />, Calculator: <Calculator size={15} />,
  ClipboardCheck: <ClipboardCheck size={15} />, Wallet: <Wallet size={15} />, Hash: <Hash size={15} />,
  BookOpen: <BookOpen size={15} />, Receipt: <Receipt size={15} />, BadgeCheck: <BadgeCheck size={15} />,
  CalendarRange: <CalendarRange size={15} />, PieChart: <PieChart size={15} />, Send: <Send size={15} />,
  Sigma: <Sigma size={15} />, Search: <Search size={15} />, Lightbulb: <Lightbulb size={15} />,
  Network: <Network size={15} />, Stamp: <Stamp size={15} />, Activity: <Activity size={15} />,
  TrendingUp: <TrendingUp size={15} />, BarChart3: <BarChart3 size={15} />, FileSearch: <FileSearch size={15} />,
  CheckSquare: <CheckSquare size={15} />,
};

// ── Couleurs ──────────────────────────────────────────────────────────────────

const COULEURS_FOND: Record<string, { badge: string; icone: string }> = {
  blue:   { badge: "bg-blue-100 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400",   icone: "text-blue-600 dark:text-blue-400" },
  violet: { badge: "bg-violet-100 dark:bg-violet-950/30 text-violet-700 dark:text-violet-400", icone: "text-violet-600 dark:text-violet-400" },
  amber:  { badge: "bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400",  icone: "text-amber-600 dark:text-amber-400" },
  green:  { badge: "bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-400",  icone: "text-green-600 dark:text-green-400" },
  teal:   { badge: "bg-teal-100 dark:bg-teal-950/30 text-teal-700 dark:text-teal-400",    icone: "text-teal-600 dark:text-teal-400" },
  indigo: { badge: "bg-indigo-100 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400", icone: "text-indigo-600 dark:text-indigo-400" },
  orange: { badge: "bg-orange-100 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400", icone: "text-orange-600 dark:text-orange-400" },
  red:    { badge: "bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-400",        icone: "text-red-600 dark:text-red-400" },
  slate:  { badge: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-400",   icone: "text-slate-500" },
  purple: { badge: "bg-purple-100 dark:bg-purple-950/30 text-purple-700 dark:text-purple-400", icone: "text-purple-600 dark:text-purple-400" },
};

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MissionProjet {
  code: string;
  libelle: string;
  icone: string;
  couleur: string;
  phases_concernees: string[];
  livrables: {
    code: string;
    libelle: string;
    icone: string;
    couleur: string;
    statut?: "en_attente" | "en_cours" | "produit" | "valide";
  }[];
  statut?: "en_attente" | "en_cours" | "terminee";
}

// ── Carte mission ─────────────────────────────────────────────────────────────

function CarteMission({
  mission,
  onChangerStatutLivrable,
}: {
  mission: MissionProjet;
  onChangerStatutLivrable?: (missionCode: string, livrableCode: string, statut: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const c = COULEURS_FOND[mission.couleur] ?? COULEURS_FOND.slate;
  const livrablesProduits = mission.livrables.filter((l) => l.statut === "produit" || l.statut === "valide").length;
  const progressionLivrables = mission.livrables.length > 0
    ? Math.round((livrablesProduits / mission.livrables.length) * 100)
    : 0;

  return (
    <div
      className="rounded-2xl border overflow-hidden transition-all"
      style={{ background: "var(--fond-carte)", borderColor: "var(--bordure)" }}
    >
      <button
        type="button"
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-[color:var(--fond-entree)] transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Icône mission */}
        <span className={clsx("flex h-8 w-8 shrink-0 items-center justify-center rounded-xl", c.icone)}
          style={{ background: "var(--fond-entree)" }}>
          {ICONES[mission.icone] ?? <CheckSquare size={15} />}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold" style={{ color: "var(--texte)" }}>{mission.libelle}</p>
            {mission.phases_concernees.length > 0 && (
              <div className="flex gap-1 flex-wrap">
                {mission.phases_concernees.map((ph) => (
                  <span key={ph} className="rounded px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase"
                    style={{ background: "var(--fond-app)", color: "var(--texte-3)" }}>
                    {ph}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Barre progression livrables */}
          {mission.livrables.length > 0 && (
            <div className="flex items-center gap-2 mt-1">
              <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "var(--fond-app)" }}>
                <div
                  className="h-1 rounded-full transition-all"
                  style={{
                    width: `${progressionLivrables}%`,
                    background: progressionLivrables === 100 ? "#10b981" : "var(--c-base)",
                  }}
                />
              </div>
              <span className="text-[10px]" style={{ color: "var(--texte-3)" }}>
                {livrablesProduits}/{mission.livrables.length}
              </span>
            </div>
          )}
        </div>

        {/* Statut */}
        <div className="flex items-center gap-2 shrink-0">
          {mission.statut === "terminee" ? (
            <CheckCircle2 size={16} className="text-emerald-500" strokeWidth={2.5} />
          ) : mission.statut === "en_cours" ? (
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute h-3 w-3 rounded-full opacity-75" style={{ background: "var(--c-base)" }} />
              <span className="h-3 w-3 rounded-full" style={{ background: "var(--c-base)" }} />
            </span>
          ) : (
            <Circle size={16} style={{ color: "var(--texte-3)" }} />
          )}
          {expanded
            ? <ChevronUp size={13} style={{ color: "var(--texte-3)" }} />
            : <ChevronDown size={13} style={{ color: "var(--texte-3)" }} />
          }
        </div>
      </button>

      {/* Livrables */}
      {expanded && mission.livrables.length > 0 && (
        <div
          className="px-4 pb-4 pt-1 border-t"
          style={{ background: "var(--fond-entree)", borderColor: "var(--bordure)" }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--texte-3)" }}>
            Livrables
          </p>
          <div className="space-y-1.5">
            {mission.livrables.map((livrable) => {
              const lc = COULEURS_FOND[livrable.couleur] ?? COULEURS_FOND.slate;
              const estProduit = livrable.statut === "produit" || livrable.statut === "valide";
              return (
                <div
                  key={livrable.code}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2"
                  style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}
                >
                  <button
                    type="button"
                    onClick={() => onChangerStatutLivrable?.(
                      mission.code,
                      livrable.code,
                      estProduit ? "en_attente" : "produit"
                    )}
                    className={clsx(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all",
                      estProduit
                        ? "border-emerald-500 bg-emerald-500"
                        : "border-[color:var(--bordure)] hover:border-emerald-500"
                    )}
                  >
                    {estProduit && <Check size={10} className="text-white" strokeWidth={3} />}
                  </button>
                  <span className={clsx("flex h-6 w-6 shrink-0 items-center justify-center rounded-lg", lc.icone)}
                    style={{ background: "var(--fond-entree)" }}>
                    {ICONES[livrable.icone] && (
                      <span className="scale-75">{ICONES[livrable.icone]}</span>
                    )}
                  </span>
                  <span
                    className={clsx("text-xs flex-1", estProduit ? "line-through opacity-60" : "")}
                    style={{ color: "var(--texte)" }}
                  >
                    {livrable.libelle}
                  </span>
                  {livrable.statut === "valide" && (
                    <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">Validé</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────

interface Props {
  missions: MissionProjet[];
  familleClient?: string;
  onAjouterMission?: () => void;
  onChangerStatutLivrable?: (missionCode: string, livrableCode: string, statut: string) => void;
}

// Import manquant — on l'ajoute localement
function Check({ size, className, strokeWidth }: { size: number; className?: string; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={strokeWidth ?? 2} strokeLinecap="round" strokeLinejoin="round"
      className={className}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function PanneauMissionsLivrables({
  missions, familleClient: _fc, onAjouterMission, onChangerStatutLivrable,
}: Props) {
  if (missions.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-3 rounded-2xl border py-10 text-center"
        style={{ background: "var(--fond-entree)", borderColor: "var(--bordure)", borderStyle: "dashed" }}
      >
        <Sparkles size={24} style={{ color: "var(--texte-3)" }} />
        <div>
          <p className="text-sm font-medium" style={{ color: "var(--texte-2)" }}>
            Aucune mission définie
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--texte-3)" }}>
            Les missions sont configurées lors de la création ou de la modification du projet.
          </p>
        </div>
        {onAjouterMission && (
          <button
            type="button"
            onClick={onAjouterMission}
            className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold text-white"
            style={{ background: "var(--c-base)" }}
          >
            <Plus size={12} />
            Ajouter des missions
          </button>
        )}
      </div>
    );
  }

  // Calcul progression globale
  const totalLivrables = missions.reduce((acc, m) => acc + m.livrables.length, 0);
  const livrablesProduits = missions.reduce(
    (acc, m) => acc + m.livrables.filter((l) => l.statut === "produit" || l.statut === "valide").length,
    0
  );
  const progression = totalLivrables > 0 ? Math.round((livrablesProduits / totalLivrables) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold" style={{ color: "var(--texte)" }}>
            {missions.length} mission{missions.length > 1 ? "s" : ""} · {totalLivrables} livrable{totalLivrables > 1 ? "s" : ""}
          </p>
          {totalLivrables > 0 && (
            <div className="flex items-center gap-2 mt-1">
              <div className="w-32 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--fond-app)" }}>
                <div
                  className="h-1.5 rounded-full transition-all"
                  style={{
                    width: `${progression}%`,
                    background: progression === 100 ? "#10b981" : "var(--c-base)",
                  }}
                />
              </div>
              <span className="text-[11px]" style={{ color: "var(--texte-3)" }}>
                {progression}% produits
              </span>
            </div>
          )}
        </div>
        {onAjouterMission && (
          <button
            type="button"
            onClick={onAjouterMission}
            className="flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all hover:border-[color:var(--c-base)] hover:text-[color:var(--c-base)]"
            style={{ borderColor: "var(--bordure)", color: "var(--texte-3)", background: "var(--fond-carte)" }}
          >
            <Plus size={11} />
            Ajouter
          </button>
        )}
      </div>

      {/* Missions */}
      <div className="space-y-2">
        {missions.map((mission) => (
          <CarteMission
            key={mission.code}
            mission={mission}
            onChangerStatutLivrable={onChangerStatutLivrable}
          />
        ))}
      </div>
    </div>
  );
}
