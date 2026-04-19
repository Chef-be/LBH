"use client";

import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import {
  CheckCircle2, Circle, Clock, ChevronDown, ChevronUp,
  AlertCircle, Download, RefreshCw, CalendarRange, Target,
} from "lucide-react";
import { api } from "@/crochets/useApi";
import type { MissionProjet } from "./PanneauMissionsLivrables";

/* ─────────────────────────────────────────────────────────────
   TYPES
───────────────────────────────────────────────────────────── */

interface ProjetPlanning {
  id: string;
  reference: string;
  intitule: string;
  phase_actuelle: string;
  phase_libelle: string;
  date_debut_prevue: string | null;
  date_fin_prevue: string | null;
  montant_estime: number | null;
  contexte_projet: {
    famille_client: { code: string; libelle: string };
    missions_associees: Array<{ code: string; libelle: string }>;
    sous_missions: Array<{ code: string; libelle: string }>;
  } | null;
  statuts_livrables: Record<string, string>;
}

type StatutLivrable = "en_attente" | "en_cours" | "produit" | "valide";

const STATUTS_CONFIG: Record<StatutLivrable, { label: string; couleur: string; icone: React.ReactNode }> = {
  en_attente: {
    label: "En attente",
    couleur: "var(--texte-3)",
    icone: <Circle size={13} />,
  },
  en_cours: {
    label: "En cours",
    couleur: "#f59e0b",
    icone: <Clock size={13} />,
  },
  produit: {
    label: "Produit",
    couleur: "#3b82f6",
    icone: <CheckCircle2 size={13} />,
  },
  valide: {
    label: "Validé",
    couleur: "#10b981",
    icone: <CheckCircle2 size={13} />,
  },
};

const ORDRE_STATUT: StatutLivrable[] = ["en_attente", "en_cours", "produit", "valide"];

/* ─────────────────────────────────────────────────────────────
   SELECTEUR DE STATUT
───────────────────────────────────────────────────────────── */

function SelecteurStatut({
  statut,
  onChange,
}: {
  statut: StatutLivrable;
  onChange: (s: StatutLivrable) => void;
}) {
  const [ouvert, setOuvert] = useState(false);
  const cfg = STATUTS_CONFIG[statut] ?? STATUTS_CONFIG.en_attente;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOuvert((v) => !v)}
        className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium border transition-colors hover:opacity-80"
        style={{
          borderColor: `color-mix(in srgb, ${cfg.couleur} 30%, var(--bordure))`,
          color: cfg.couleur,
          background: `color-mix(in srgb, ${cfg.couleur} 10%, var(--fond-entree))`,
        }}
      >
        {cfg.icone}
        {cfg.label}
        <ChevronDown size={10} />
      </button>
      {ouvert && (
        <div
          className="absolute top-full left-0 mt-1 z-20 rounded-xl shadow-xl border overflow-hidden min-w-[130px]"
          style={{ background: "var(--fond-carte)", borderColor: "var(--bordure)" }}
        >
          {ORDRE_STATUT.map((s) => {
            const c = STATUTS_CONFIG[s];
            return (
              <button
                key={s}
                type="button"
                onClick={() => { onChange(s); setOuvert(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium hover:bg-[color:var(--fond-entree)] transition-colors"
                style={{ color: c.couleur }}
              >
                {c.icone} {c.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   CARTE MISSION
───────────────────────────────────────────────────────────── */

function CarteMissionPlanning({
  mission,
  statutsLocaux,
  onChangerStatut,
}: {
  mission: MissionProjet;
  statutsLocaux: Record<string, string>;
  onChangerStatut: (cle: string, statut: StatutLivrable) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  const total = mission.livrables.length;
  const produits = mission.livrables.filter((l) => {
    const s = (statutsLocaux[`${mission.code}:${l.code}`] ?? l.statut) as StatutLivrable;
    return s === "produit" || s === "valide";
  }).length;
  const pct = total > 0 ? Math.round((produits / total) * 100) : 0;

  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ background: "var(--fond-carte)", borderColor: "var(--bordure)" }}
    >
      {/* En-tête mission */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-[color:var(--fond-entree)] transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <p className="text-sm font-bold" style={{ color: "var(--texte)" }}>
              {mission.libelle}
            </p>
            <span
              className="text-[10px] font-mono rounded px-1.5 py-0.5"
              style={{ background: "var(--fond-app)", color: "var(--texte-3)" }}
            >
              {mission.phases_concernees.join(", ") || "—"}
            </span>
          </div>
          {total > 0 && (
            <div className="flex items-center gap-2">
              <div
                className="flex-1 h-1.5 rounded-full overflow-hidden"
                style={{ background: "var(--fond-app)" }}
              >
                <div
                  className="h-1.5 rounded-full transition-all"
                  style={{
                    width: `${pct}%`,
                    background: pct === 100 ? "#10b981" : "var(--c-base)",
                  }}
                />
              </div>
              <span className="text-[10px] shrink-0" style={{ color: "var(--texte-3)" }}>
                {produits}/{total} · {pct}%
              </span>
            </div>
          )}
        </div>
        {expanded
          ? <ChevronUp size={14} style={{ color: "var(--texte-3)" }} />
          : <ChevronDown size={14} style={{ color: "var(--texte-3)" }} />
        }
      </button>

      {/* Livrables */}
      {expanded && total > 0 && (
        <div
          className="border-t"
          style={{ borderColor: "var(--bordure)", background: "var(--fond-entree)" }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--bordure)" }}>
                <th className="text-left px-4 py-2 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--texte-3)" }}>
                  Livrable
                </th>
                <th className="text-center px-3 py-2 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--texte-3)" }}>
                  Statut
                </th>
              </tr>
            </thead>
            <tbody>
              {mission.livrables.map((livrable, i) => {
                const cle = `${mission.code}:${livrable.code}`;
                const statut = (statutsLocaux[cle] ?? livrable.statut ?? "en_attente") as StatutLivrable;
                const cfg = STATUTS_CONFIG[statut] ?? STATUTS_CONFIG.en_attente;
                return (
                  <tr
                    key={livrable.code}
                    style={{
                      borderTop: i > 0 ? "1px solid var(--bordure)" : undefined,
                    }}
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span style={{ color: cfg.couleur }}>{cfg.icone}</span>
                        <span
                          className={clsx(
                            "text-xs",
                            (statut === "produit" || statut === "valide") ? "line-through opacity-60" : ""
                          )}
                          style={{ color: "var(--texte)" }}
                        >
                          {livrable.libelle}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <SelecteurStatut
                        statut={statut}
                        onChange={(s) => onChangerStatut(cle, s)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   GRAPHIQUE PROGRESSION PAR MISSION
───────────────────────────────────────────────────────────── */

function GraphiqueProgression({
  missions,
  statutsLocaux,
}: {
  missions: MissionProjet[];
  statutsLocaux: Record<string, string>;
}) {
  const donnees = missions
    .filter((m) => m.livrables.length > 0)
    .map((m) => {
      const total = m.livrables.length;
      const produits = m.livrables.filter((l) => {
        const s = statutsLocaux[`${m.code}:${l.code}`] ?? l.statut ?? "en_attente";
        return s === "produit" || s === "valide";
      }).length;
      return {
        label: m.libelle.length > 20 ? m.libelle.slice(0, 20) + "…" : m.libelle,
        produits,
        restants: total - produits,
        pct: total > 0 ? Math.round((produits / total) * 100) : 0,
      };
    });

  if (donnees.length === 0) return null;

  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}
    >
      <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: "var(--texte-3)" }}>
        Progression par mission
      </p>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={donnees} layout="vertical" margin={{ left: 8, right: 48, top: 4, bottom: 4 }}>
            <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="var(--bordure)" />
            <XAxis
              type="number"
              domain={[0, "dataMax"]}
              tick={{ fontSize: 10, fill: "var(--texte-3)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="label"
              width={120}
              tick={{ fontSize: 10, fill: "var(--texte-2)" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                background: "var(--fond-carte)",
                border: "1px solid var(--bordure)",
                borderRadius: 8,
                fontSize: 11,
                color: "var(--texte)",
              }}
              formatter={(v, name) => [v, name === "produits" ? "Produits" : "Restants"]}
            />
            <Bar dataKey="produits" stackId="a" radius={[0, 0, 0, 0]}>
              {donnees.map((d, i) => (
                <Cell key={i} fill={d.pct === 100 ? "#10b981" : "var(--c-base)"} />
              ))}
            </Bar>
            <Bar dataKey="restants" stackId="a" radius={[0, 4, 4, 0]}>
              {donnees.map((_, i) => (
                <Cell key={i} fill="var(--fond-app)" />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   COMPOSANT PRINCIPAL
───────────────────────────────────────────────────────────── */

export function PlanningProjet({ projetId }: { projetId: string }) {
  const queryClient = useQueryClient();
  const [statutsLocaux, setStatutsLocaux] = useState<Record<string, string>>({});

  const { data: projet, isLoading: projetEnChargement } = useQuery<ProjetPlanning>({
    queryKey: ["projet", projetId],
    queryFn: () => api.get<ProjetPlanning>(`/api/projets/${projetId}/`),
  });

  useEffect(() => {
    if (!projet) return;
    setStatutsLocaux(projet.statuts_livrables ?? {});
  }, [projet]);

  const familleClient = projet?.contexte_projet?.famille_client?.code ?? "";

  const missionsCodes = new Set([
    ...(projet?.contexte_projet?.missions_associees ?? []).map((m) => m.code),
    ...(projet?.contexte_projet?.sous_missions ?? []).map((s) => s.code),
  ]);

  const { data: missionsDonnees = [], isLoading: missionsEnChargement } = useQuery<MissionProjet[]>({
    queryKey: ["missions-livrables", familleClient],
    queryFn: () => api.get<MissionProjet[]>(`/api/projets/missions-livrables/?famille_client=${familleClient}`),
    enabled: !!familleClient && missionsCodes.size > 0,
    staleTime: 300_000,
  });

  const missions = missionsDonnees.filter((m) => missionsCodes.has(m.code));

  const mutation = useMutation({
    mutationFn: (payload: Record<string, string>) =>
      api.patch<Record<string, string>>(`/api/projets/${projetId}/statuts-livrables/`, payload),
    onSuccess: (data) => {
      setStatutsLocaux((prev) => ({ ...prev, ...data }));
      queryClient.invalidateQueries({ queryKey: ["projet", projetId] });
    },
  });

  const changerStatut = useCallback(
    (cle: string, statut: StatutLivrable) => {
      setStatutsLocaux((prev) => ({ ...prev, [cle]: statut }));
      mutation.mutate({ [cle]: statut });
    },
    [mutation]
  );

  // Statistiques globales
  const totalLivrables = missions.reduce((s, m) => s + m.livrables.length, 0);
  const produitsCount = missions.reduce((s, m) => {
    return s + m.livrables.filter((l) => {
      const st = (statutsLocaux[`${m.code}:${l.code}`] ?? l.statut ?? "en_attente") as StatutLivrable;
      return st === "produit" || st === "valide";
    }).length;
  }, 0);
  const enCoursCount = missions.reduce((s, m) => {
    return s + m.livrables.filter((l) => {
      const st = (statutsLocaux[`${m.code}:${l.code}`] ?? l.statut ?? "en_attente") as StatutLivrable;
      return st === "en_cours";
    }).length;
  }, 0);
  const progressionGlobale = totalLivrables > 0 ? Math.round((produitsCount / totalLivrables) * 100) : 0;

  if (projetEnChargement || missionsEnChargement) {
    return (
      <div className="flex items-center justify-center py-24 text-sm" style={{ color: "var(--texte-3)" }}>
        <RefreshCw size={16} className="animate-spin mr-2" /> Chargement du planning…
      </div>
    );
  }

  if (missions.length === 0) {
    return (
      <div
        className="rounded-2xl border py-16 flex flex-col items-center gap-4 text-center"
        style={{ background: "var(--fond-entree)", borderColor: "var(--bordure)", borderStyle: "dashed" }}
      >
        <CalendarRange size={28} style={{ color: "var(--texte-3)" }} />
        <div>
          <p className="font-semibold text-sm" style={{ color: "var(--texte-2)" }}>Aucune mission configurée</p>
          <p className="text-xs mt-1" style={{ color: "var(--texte-3)" }}>
            Définissez des missions lors de la création ou modification du projet pour accéder au planning.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête avec KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: "Missions",
            valeur: missions.length,
            icone: <Target size={14} />,
            couleur: "var(--c-base)",
          },
          {
            label: "Total livrables",
            valeur: totalLivrables,
            icone: <CalendarRange size={14} />,
            couleur: "#8b5cf6",
          },
          {
            label: "En cours",
            valeur: enCoursCount,
            icone: <Clock size={14} />,
            couleur: "#f59e0b",
          },
          {
            label: "Produits",
            valeur: produitsCount,
            icone: <CheckCircle2 size={14} />,
            couleur: "#10b981",
          },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl p-4"
            style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium" style={{ color: "var(--texte-3)" }}>{kpi.label}</p>
              <span style={{ color: kpi.couleur }}>{kpi.icone}</span>
            </div>
            <p className="text-2xl font-bold" style={{ color: kpi.couleur }}>{kpi.valeur}</p>
          </div>
        ))}
      </div>

      {/* Barre de progression globale */}
      <div
        className="rounded-2xl p-5"
        style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}
      >
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold" style={{ color: "var(--texte)" }}>
            Avancement global — {progressionGlobale}%
          </p>
          <div className="flex items-center gap-2">
            {mutation.isPending && (
              <span className="text-xs" style={{ color: "var(--texte-3)" }}>
                <RefreshCw size={11} className="inline animate-spin mr-1" />
                Sauvegarde…
              </span>
            )}
            {mutation.isError && (
              <span className="text-xs text-red-500">
                <AlertCircle size={11} className="inline mr-1" />
                Erreur de sauvegarde
              </span>
            )}
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-[color:var(--fond-entree)]"
              style={{ borderColor: "var(--bordure)", color: "var(--texte-3)" }}
            >
              <Download size={12} /> Exporter
            </button>
          </div>
        </div>
        <div className="h-3 rounded-full overflow-hidden" style={{ background: "var(--fond-app)" }}>
          <div
            className="h-3 rounded-full transition-all duration-500"
            style={{
              width: `${progressionGlobale}%`,
              background: progressionGlobale === 100
                ? "#10b981"
                : `linear-gradient(90deg, var(--c-base), color-mix(in srgb, var(--c-base) 70%, #8b5cf6))`,
            }}
          />
        </div>
        <div className="flex justify-between mt-2 text-[10px]" style={{ color: "var(--texte-3)" }}>
          <span>{produitsCount} livrable{produitsCount > 1 ? "s" : ""} produit{produitsCount > 1 ? "s" : ""}</span>
          <span>{totalLivrables - produitsCount} restant{totalLivrables - produitsCount > 1 ? "s" : ""}</span>
        </div>
      </div>

      {/* Graphique + missions en deux colonnes */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Graphique progression (col gauche sur large) */}
        <div className="lg:col-span-1">
          <GraphiqueProgression missions={missions} statutsLocaux={statutsLocaux} />
        </div>

        {/* Liste des missions */}
        <div className="lg:col-span-2 space-y-3">
          {missions.map((mission) => (
            <CarteMissionPlanning
              key={mission.code}
              mission={mission}
              statutsLocaux={statutsLocaux}
              onChangerStatut={changerStatut}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
