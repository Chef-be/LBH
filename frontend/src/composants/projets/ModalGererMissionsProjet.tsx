"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import {
  X, CheckSquare, Square, ChevronDown, ChevronUp,
  Save, Loader2, AlertCircle, ListChecks,
} from "lucide-react";
import { api, ErreurApi } from "@/crochets/useApi";
import { useNotifications } from "@/contextes/FournisseurNotifications";
import type { MissionDisponible, LivrableDisponible } from "./wizard-modal/types";

/* ─────────────────────────────────────────────────────────────
   CONSTANTES
───────────────────────────────────────────────────────────── */

const COULEURS_FOND: Record<string, { badge: string; icone: string }> = {
  blue:   { badge: "bg-blue-100 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border-blue-200", icone: "text-blue-600" },
  violet: { badge: "bg-violet-100 dark:bg-violet-950/30 text-violet-700 dark:text-violet-400 border-violet-200", icone: "text-violet-600" },
  amber:  { badge: "bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200", icone: "text-amber-600" },
  green:  { badge: "bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-400 border-green-200", icone: "text-green-600" },
  teal:   { badge: "bg-teal-100 dark:bg-teal-950/30 text-teal-700 dark:text-teal-400 border-teal-200", icone: "text-teal-600" },
  indigo: { badge: "bg-indigo-100 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400 border-indigo-200", icone: "text-indigo-600" },
  orange: { badge: "bg-orange-100 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 border-orange-200", icone: "text-orange-600" },
  red:    { badge: "bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-400 border-red-200", icone: "text-red-600" },
  slate:  { badge: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-400 border-slate-200", icone: "text-slate-500" },
  purple: { badge: "bg-purple-100 dark:bg-purple-950/30 text-purple-700 dark:text-purple-400 border-purple-200", icone: "text-purple-600" },
};

/* ─────────────────────────────────────────────────────────────
   BADGE LIVRABLE
───────────────────────────────────────────────────────────── */

function BadgeLivrable({
  livrable,
  selectionne,
  onToggle,
}: {
  livrable: LivrableDisponible;
  selectionne: boolean;
  onToggle: () => void;
}) {
  const c = COULEURS_FOND[livrable.couleur] ?? COULEURS_FOND.slate;
  return (
    <button
      type="button"
      onClick={onToggle}
      className={clsx(
        "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-all",
        selectionne
          ? clsx(c.badge, "border-current")
          : "border-[color:var(--bordure)] text-[color:var(--texte-3)] hover:border-[color:var(--c-base)] hover:text-[color:var(--c-base)]"
      )}
      style={selectionne ? {} : { background: "var(--fond-carte)" }}
    >
      {selectionne ? <CheckSquare size={11} strokeWidth={2.5} /> : <Square size={11} />}
      {livrable.libelle}
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────
   CARTE MISSION
───────────────────────────────────────────────────────────── */

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
  const c = COULEURS_FOND[mission.couleur] ?? COULEURS_FOND.slate;
  const nbSelectionnes = livrablesSelectionnes.length;

  return (
    <div
      className={clsx(
        "rounded-2xl border-2 transition-all duration-200",
        selectionne
          ? "border-[color:var(--c-base)] shadow-md"
          : "border-[color:var(--bordure)] hover:border-[color:var(--bordure)]"
      )}
      style={{ background: "var(--fond-carte)" }}
    >
      <div className="flex items-start gap-3 p-4">
        {/* Bouton sélection */}
        <button
          type="button"
          onClick={onToggle}
          className={clsx(
            "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all",
            selectionne
              ? "border-[color:var(--c-base)] bg-[color:var(--c-base)] text-white"
              : "border-[color:var(--bordure)] hover:border-[color:var(--c-base)]"
          )}
        >
          {selectionne && <span className="text-[9px] font-bold">✓</span>}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p
              className={clsx(
                "text-sm font-semibold transition-colors",
                selectionne ? "text-[color:var(--texte)]" : "text-[color:var(--texte-2)]"
              )}
            >
              {mission.libelle}
            </p>
            {mission.est_obligatoire && (
              <span className={clsx("rounded-full px-2 py-0.5 text-[10px] font-semibold border", c.badge)}>
                Obligatoire
              </span>
            )}
            {mission.phases_concernees.length > 0 && (
              <div className="flex gap-1">
                {mission.phases_concernees.map((ph) => (
                  <span
                    key={ph}
                    className="rounded px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase"
                    style={{ background: "var(--fond-entree)", color: "var(--texte-3)" }}
                  >
                    {ph}
                  </span>
                ))}
              </div>
            )}
          </div>
          {mission.description && (
            <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--texte-3)" }}>
              {mission.description}
            </p>
          )}
        </div>

        {mission.livrables.length > 0 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 text-xs shrink-0 mt-0.5"
            style={{ color: "var(--texte-3)" }}
          >
            {nbSelectionnes > 0 && (
              <span
                className="rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                style={{ background: "var(--c-clair)", color: "var(--c-base)" }}
              >
                {nbSelectionnes}
              </span>
            )}
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        )}
      </div>

      {/* Livrables */}
      {expanded && mission.livrables.length > 0 && (
        <div
          className="border-t px-4 pb-4 pt-3"
          style={{ borderColor: "var(--bordure)", background: "var(--fond-entree)" }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--texte-3)" }}>
            Livrables associés
          </p>
          <div className="flex flex-wrap gap-1.5">
            {mission.livrables.map((l) => (
              <BadgeLivrable
                key={l.code}
                livrable={l}
                selectionne={livrablesSelectionnes.includes(l.code)}
                onToggle={() => onToggleLivrable(l.code)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   COMPOSANT PRINCIPAL
───────────────────────────────────────────────────────────── */

interface Props {
  projetId: string;
  familleClient: string;
  missionsActuelles: string[];         // codes des missions déjà sélectionnées
  statutsActuels: Record<string, string>;
  onFermer: () => void;
  onSauvegarde?: () => void;
}

export function ModalGererMissionsProjet({
  projetId,
  familleClient,
  missionsActuelles,
  statutsActuels,
  onFermer,
  onSauvegarde,
}: Props) {
  const queryClient = useQueryClient();
  const notifications = useNotifications();

  // Sélections locales : code mission → list de codes livrables
  const [selectionMissions, setSelectionMissions] = useState<Record<string, string[]>>(() => {
    const init: Record<string, string[]> = {};
    missionsActuelles.forEach((code) => { init[code] = []; });
    // Pré-remplir les livrables depuis les statuts existants
    Object.keys(statutsActuels).forEach((cle) => {
      const [mCode, lCode] = cle.split(":", 2);
      if (mCode && lCode) {
        if (!init[mCode]) init[mCode] = [];
        if (!init[mCode].includes(lCode)) init[mCode].push(lCode);
      }
    });
    return init;
  });

  const [erreur, setErreur] = useState<string | null>(null);

  const { data: missions = [], isLoading } = useQuery<MissionDisponible[]>({
    queryKey: ["missions-livrables", familleClient],
    queryFn: () =>
      api.get<MissionDisponible[]>(`/api/projets/missions-livrables/?famille_client=${familleClient}`),
    enabled: !!familleClient,
    staleTime: 300_000,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const missionsCodes = Object.keys(selectionMissions);
      // 1. Mettre à jour le contexte du projet
      await api.patch(`/api/projets/${projetId}/`, {
        contexte_projet_saisie: {
          missions_associees: missionsCodes,
        },
      });
      // 2. Initialiser les statuts des nouveaux livrables
      const nouveauxStatuts: Record<string, string> = {};
      missionsCodes.forEach((mCode) => {
        const livrables = selectionMissions[mCode] ?? [];
        livrables.forEach((lCode) => {
          const cle = `${mCode}:${lCode}`;
          if (!(cle in statutsActuels)) {
            nouveauxStatuts[cle] = "en_attente";
          }
        });
      });
      if (Object.keys(nouveauxStatuts).length > 0) {
        await api.patch(`/api/projets/${projetId}/statuts-livrables/`, nouveauxStatuts);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projet", projetId] });
      notifications.succes("Missions mises à jour.");
      onSauvegarde?.();
      onFermer();
    },
    onError: (err) => {
      const msg = err instanceof ErreurApi ? err.detail : "Impossible de sauvegarder.";
      setErreur(msg);
    },
  });

  const toggleMission = (code: string) => {
    setSelectionMissions((prev) => {
      if (code in prev) {
        const next = { ...prev };
        delete next[code];
        return next;
      }
      return { ...prev, [code]: [] };
    });
  };

  const toggleLivrable = (missionCode: string, livrableCode: string) => {
    setSelectionMissions((prev) => {
      const liste = prev[missionCode] ?? [];
      const existe = liste.includes(livrableCode);
      return {
        ...prev,
        [missionCode]: existe
          ? liste.filter((c) => c !== livrableCode)
          : [...liste, livrableCode],
      };
    });
  };

  const nbMissions = Object.keys(selectionMissions).length;
  const nbLivrables = Object.values(selectionMissions).reduce((s, l) => s + l.length, 0);

  // Grouper par famille/couleur pour l'affichage
  const missionsGroupees = useMemo(() => {
    const groupes: Record<string, MissionDisponible[]> = {};
    missions.forEach((m) => {
      const key = m.couleur || "slate";
      if (!groupes[key]) groupes[key] = [];
      groupes[key].push(m);
    });
    return Object.entries(groupes);
  }, [missions]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto"
      style={{ background: "rgba(0,0,0,0.6)", paddingTop: "2rem", paddingBottom: "2rem" }}
      onClick={(e) => { if (e.target === e.currentTarget) onFermer(); }}
    >
      <div
        className="relative w-full max-w-3xl mx-4 rounded-3xl shadow-2xl flex flex-col"
        style={{
          background: "var(--fond-carte)",
          border: "1px solid var(--bordure)",
          maxHeight: "90vh",
        }}
      >
        {/* En-tête */}
        <div
          className="flex items-center justify-between p-5 border-b flex-shrink-0"
          style={{ borderColor: "var(--bordure)" }}
        >
          <div className="flex items-center gap-3">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{ background: "var(--c-clair)", color: "var(--c-base)" }}
            >
              <ListChecks size={18} />
            </span>
            <div>
              <h2 className="text-base font-bold" style={{ color: "var(--texte)" }}>
                Gérer les missions
              </h2>
              <p className="text-xs mt-0.5" style={{ color: "var(--texte-3)" }}>
                Sélectionnez les missions et livrables associés à ce projet
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onFermer}
            className="rounded-xl p-2 transition-colors hover:bg-[color:var(--fond-entree)]"
            style={{ color: "var(--texte-3)" }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Corps */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-sm" style={{ color: "var(--texte-3)" }}>
              <Loader2 size={16} className="animate-spin mr-2" /> Chargement des missions…
            </div>
          ) : missions.length === 0 ? (
            <div className="text-center py-10 text-sm" style={{ color: "var(--texte-3)" }}>
              Aucune mission disponible pour ce type de client.
            </div>
          ) : (
            missionsGroupees.map(([, groupe]) =>
              groupe.map((mission) => (
                <CarteMission
                  key={mission.code}
                  mission={mission}
                  selectionne={mission.code in selectionMissions}
                  livrablesSelectionnes={selectionMissions[mission.code] ?? []}
                  onToggle={() => toggleMission(mission.code)}
                  onToggleLivrable={(lCode) => toggleLivrable(mission.code, lCode)}
                />
              ))
            )
          )}
        </div>

        {/* Pied */}
        <div
          className="flex items-center justify-between p-4 border-t flex-shrink-0"
          style={{ borderColor: "var(--bordure)", background: "var(--fond-entree)" }}
        >
          <div className="text-sm" style={{ color: "var(--texte-3)" }}>
            {nbMissions > 0 ? (
              <span>
                <strong style={{ color: "var(--texte)" }}>{nbMissions}</strong> mission{nbMissions > 1 ? "s" : ""}
                {nbLivrables > 0 && (
                  <> · <strong style={{ color: "var(--texte)" }}>{nbLivrables}</strong> livrable{nbLivrables > 1 ? "s" : ""}</>
                )}
              </span>
            ) : (
              "Aucune mission sélectionnée"
            )}
          </div>

          <div className="flex items-center gap-2">
            {erreur && (
              <span className="text-xs text-red-500 flex items-center gap-1">
                <AlertCircle size={12} /> {erreur}
              </span>
            )}
            <button
              type="button"
              onClick={onFermer}
              className="rounded-xl border px-4 py-2 text-sm font-medium transition-colors hover:bg-[color:var(--fond-carte)]"
              style={{ borderColor: "var(--bordure)", color: "var(--texte-3)" }}
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white transition-all disabled:opacity-60"
              style={{ background: "var(--c-base)" }}
            >
              {mutation.isPending
                ? <><Loader2 size={14} className="animate-spin" /> Sauvegarde…</>
                : <><Save size={14} /> Enregistrer</>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
