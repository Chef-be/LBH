"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import {
  Plus, Save, Download, Upload, Trash2, ChevronDown, ChevronRight,
  Calendar, Layers, BarChart3, Settings2, RefreshCw,
} from "lucide-react";
import { api } from "@/crochets/useApi";
import type { TacheGanttFrappe } from "./GanttFrappe";

const GanttFrappe = dynamic(() => import("./GanttFrappe"), { ssr: false });

interface TacheBackend {
  id: string;
  planning: string;
  tache_parente: string | null;
  type_tache: "lot" | "article" | "tache" | "jalon";
  ordre: number;
  code: string;
  intitule: string;
  date_debut: string;
  date_fin: string;
  progression: number;
  dependances: string[];
  ressources: { nom: string; role?: string }[];
  montant_ht: number | null;
  source_ligne_dpgf: string | null;
  couleur: string;
}

interface PlanningBackend {
  id: string;
  projet: string;
  intitule: string;
  mode: "general" | "execution";
  date_debut: string | null;
  date_fin: string | null;
  taches: TacheBackend[];
}

interface LotDPGF {
  code: string;
  intitule: string;
  total_ht: number;
  nb_articles: number;
}

interface SyntheseDPGF {
  lots: LotDPGF[];
  total_ht: number;
}

type ViewMode = "Day" | "Week" | "Month" | "Quarter Year" | "Year";

const MODES_VUE: { val: ViewMode; label: string }[] = [
  { val: "Day", label: "Jour" },
  { val: "Week", label: "Semaine" },
  { val: "Month", label: "Mois" },
  { val: "Quarter Year", label: "Trimestre" },
  { val: "Year", label: "Année" },
];

function dateAujourdhui(): string {
  return new Date().toISOString().slice(0, 10);
}

function dateAvancer(date: string, jours: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + jours);
  return d.toISOString().slice(0, 10);
}

function formaterEuro(val: number | null): string {
  if (val == null) return "—";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(val);
}

export function PlanningGeneralGantt({ projetId }: { projetId: string }) {
  const qc = useQueryClient();
  const [planningActifId, setPlanningActifId] = useState<string | null>(null);
  const [modeVue, setModeVue] = useState<ViewMode>("Month");
  const [tachesLocales, setTachesLocales] = useState<TacheBackend[]>([]);
  const [modifie, setModifie] = useState(false);
  const [lotsDepliees, setLotsDepliees] = useState<Set<string>>(new Set());
  const [modalCreation, setModalCreation] = useState(false);
  const [nomNouveauPlanning, setNomNouveauPlanning] = useState("Planning général");
  const [modeNouveauPlanning, setModeNouveauPlanning] = useState<"general" | "execution">("general");

  const { data: plannings = [], isLoading: chargementPlannings } = useQuery<PlanningBackend[]>({
    queryKey: ["plannings", projetId],
    queryFn: () => api.get(`/api/projets/${projetId}/plannings/`),
  });

  const planningActif = plannings.find((p) => p.id === planningActifId) ?? null;

  const { data: syntheseDPGF } = useQuery<SyntheseDPGF>({
    queryKey: ["synthese-dpgf-planning", projetId],
    queryFn: async () => {
      const pieces = await api.get(`/api/pieces-ecrites/?projet=${projetId}&type_piece=dpgf`) as { id: string }[];
      if (!pieces || pieces.length === 0) return { lots: [], total_ht: 0 };
      return api.get(`/api/pieces-ecrites/${pieces[0].id}/synthese-dpgf/`) as Promise<SyntheseDPGF>;
    },
    staleTime: 60000,
  });

  const mutCreerPlanning = useMutation({
    mutationFn: (data: { intitule: string; mode: string }) =>
      api.post(`/api/projets/${projetId}/plannings/`, data) as Promise<PlanningBackend>,
    onSuccess: (planning: PlanningBackend) => {
      qc.invalidateQueries({ queryKey: ["plannings", projetId] });
      setPlanningActifId(planning.id);
      setTachesLocales(planning.taches ?? []);
      setModalCreation(false);
    },
  });

  const mutSauvegarder = useMutation({
    mutationFn: (taches: TacheBackend[]) =>
      api.post(`/api/projets/${projetId}/plannings/${planningActifId}/sauvegarder/`, { taches }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plannings", projetId] });
      setModifie(false);
    },
  });

  const mutSupprimerPlanning = useMutation({
    mutationFn: (id: string) =>
      api.supprimer(`/api/projets/${projetId}/plannings/${id}/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plannings", projetId] });
      setPlanningActifId(null);
      setTachesLocales([]);
    },
  });

  const chargerPlanning = useCallback((p: PlanningBackend) => {
    setPlanningActifId(p.id);
    setTachesLocales(p.taches ?? []);
    setModifie(false);
  }, []);

  const importerDepuisDPGF = useCallback(() => {
    if (!syntheseDPGF?.lots?.length) return;
    const debut = dateAujourdhui();
    const nouvelles: TacheBackend[] = syntheseDPGF.lots.map((lot, i) => ({
      id: `new-${i}`,
      planning: planningActifId ?? "",
      tache_parente: null,
      type_tache: "lot",
      ordre: i,
      code: lot.code,
      intitule: lot.intitule,
      date_debut: dateAvancer(debut, i * 30),
      date_fin: dateAvancer(debut, i * 30 + 29),
      progression: 0,
      dependances: [],
      ressources: [],
      montant_ht: lot.total_ht,
      source_ligne_dpgf: null,
      couleur: "",
    }));
    setTachesLocales(nouvelles);
    setModifie(true);
  }, [syntheseDPGF, planningActifId]);

  const mettreAJourDateTache = useCallback((tacheFrappe: TacheGanttFrappe, debut: Date, fin: Date) => {
    setTachesLocales((prev) =>
      prev.map((t) =>
        t.id === tacheFrappe.id || `t-${t.id}` === tacheFrappe.id
          ? { ...t, date_debut: debut.toISOString().slice(0, 10), date_fin: fin.toISOString().slice(0, 10) }
          : t
      )
    );
    setModifie(true);
  }, []);

  const mettreAJourProgressionTache = useCallback((tacheFrappe: TacheGanttFrappe, progression: number) => {
    setTachesLocales((prev) =>
      prev.map((t) =>
        t.id === tacheFrappe.id || `t-${t.id}` === tacheFrappe.id
          ? { ...t, progression: Math.round(progression) }
          : t
      )
    );
    setModifie(true);
  }, []);

  const ajouterTacheLibre = useCallback(() => {
    const debut = dateAujourdhui();
    const nouvelle: TacheBackend = {
      id: `new-${Date.now()}`,
      planning: planningActifId ?? "",
      tache_parente: null,
      type_tache: "tache",
      ordre: tachesLocales.length,
      code: "",
      intitule: "Nouvelle tâche",
      date_debut: debut,
      date_fin: dateAvancer(debut, 14),
      progression: 0,
      dependances: [],
      ressources: [],
      montant_ht: null,
      source_ligne_dpgf: null,
      couleur: "",
    };
    setTachesLocales((prev) => [...prev, nouvelle]);
    setModifie(true);
  }, [planningActifId, tachesLocales.length]);

  const supprimerTache = useCallback((id: string) => {
    setTachesLocales((prev) => prev.filter((t) => t.id !== id));
    setModifie(true);
  }, []);

  const basculerLot = useCallback((id: string) => {
    setLotsDepliees((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }, []);

  const tachesFrappe: TacheGanttFrappe[] = tachesLocales.map((t) => ({
    id: t.id.startsWith("new-") ? t.id : `t-${t.id}`,
    name: t.code ? `${t.code} — ${t.intitule}` : t.intitule,
    start: t.date_debut,
    end: t.date_fin,
    progress: t.progression,
    dependencies: t.dependances?.join(",") || "",
    custom_class: t.type_tache === "lot" ? "tache-lot" : t.type_tache === "jalon" ? "tache-jalon" : "",
  }));

  return (
    <div className="flex flex-col gap-6">
      {/* En-tête */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primaire-600" />
          <h2 className="text-lg font-semibold text-gris-900">Planning général</h2>
        </div>
        <div className="flex items-center gap-2">
          {modifie && planningActifId && (
            <button
              onClick={() => mutSauvegarder.mutate(tachesLocales)}
              disabled={mutSauvegarder.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primaire-600 text-white rounded-lg text-sm font-medium hover:bg-primaire-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {mutSauvegarder.isPending ? "Sauvegarde…" : "Sauvegarder"}
            </button>
          )}
          <button
            onClick={() => setModalCreation(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-primaire-300 text-primaire-700 rounded-lg text-sm font-medium hover:bg-primaire-50"
          >
            <Plus className="w-4 h-4" />
            Nouveau planning
          </button>
        </div>
      </div>

      {/* Liste des plannings */}
      {chargementPlannings ? (
        <div className="text-sm text-gris-400 animate-pulse">Chargement…</div>
      ) : plannings.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gris-200 p-8 text-center">
          <Calendar className="w-10 h-10 text-gris-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-gris-700 mb-1">Aucun planning créé</p>
          <p className="text-xs text-gris-400 mb-4">Créez votre premier planning Gantt pour ce projet.</p>
          <button
            onClick={() => setModalCreation(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-primaire-600 text-white rounded-lg text-sm font-medium hover:bg-primaire-700"
          >
            <Plus className="w-4 h-4" />
            Créer un planning
          </button>
        </div>
      ) : (
        <div className="flex gap-2 flex-wrap">
          {plannings.map((p) => (
            <button
              key={p.id}
              onClick={() => chargerPlanning(p)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                planningActifId === p.id
                  ? "bg-primaire-600 text-white border-primaire-600"
                  : "bg-white text-gris-700 border-gris-200 hover:border-primaire-300"
              }`}
            >
              {p.intitule}
              <span className="ml-1.5 text-xs opacity-70">
                ({p.mode === "general" ? "Général" : "Exécution"})
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Zone de travail */}
      {planningActif && (
        <div className="rounded-xl border border-gris-200 bg-white overflow-hidden">
          {/* Barre d'outils */}
          <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gris-100 flex-wrap">
            <div className="flex items-center gap-1 bg-gris-50 rounded-lg p-0.5">
              {MODES_VUE.map((m) => (
                <button
                  key={m.val}
                  onClick={() => setModeVue(m.val)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    modeVue === m.val ? "bg-white text-primaire-700 shadow-sm" : "text-gris-500 hover:text-gris-700"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <div className="flex-1" />
            {syntheseDPGF && syntheseDPGF.lots.length > 0 && (
              <button
                onClick={importerDepuisDPGF}
                className="flex items-center gap-1.5 text-xs text-primaire-600 hover:text-primaire-700 font-medium"
              >
                <Download className="w-3.5 h-3.5" />
                Importer depuis DPGF ({syntheseDPGF.lots.length} lots)
              </button>
            )}
            <button
              onClick={ajouterTacheLibre}
              className="flex items-center gap-1.5 text-xs text-gris-600 hover:text-gris-800 font-medium"
            >
              <Plus className="w-3.5 h-3.5" />
              Ajouter une tâche
            </button>
            <button
              onClick={() => mutSupprimerPlanning.mutate(planningActif.id)}
              className="flex items-center gap-1 text-xs text-rouge-500 hover:text-rouge-700"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Supprimer
            </button>
          </div>

          {/* Gantt */}
          <div className="p-4">
            <GanttFrappe
              taches={tachesFrappe}
              viewMode={modeVue}
              onDateChange={mettreAJourDateTache}
              onProgressChange={mettreAJourProgressionTache}
            />
          </div>

          {/* Liste des tâches */}
          {tachesLocales.length > 0 && (
            <div className="border-t border-gris-100">
              <div className="px-4 py-2 bg-gris-50 text-xs font-medium text-gris-500 uppercase tracking-wide flex items-center gap-2">
                <Layers className="w-3.5 h-3.5" />
                Tâches ({tachesLocales.length})
              </div>
              <div className="divide-y divide-gris-50">
                {tachesLocales.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center gap-3 px-4 py-2 hover:bg-gris-50 group"
                  >
                    {t.type_tache === "lot" && (
                      <button
                        onClick={() => basculerLot(t.id)}
                        className="text-gris-400 hover:text-gris-600"
                      >
                        {lotsDepliees.has(t.id) ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </button>
                    )}
                    {t.type_tache !== "lot" && <div className="w-4" />}
                    <span className={`text-xs font-mono text-gris-400 w-12 shrink-0 ${t.type_tache === "lot" ? "font-bold" : ""}`}>
                      {t.code || "—"}
                    </span>
                    <span className={`flex-1 text-sm ${t.type_tache === "lot" ? "font-semibold text-gris-900" : "text-gris-700"}`}>
                      {t.intitule}
                    </span>
                    <span className="text-xs text-gris-400 w-24 shrink-0">
                      {t.date_debut} → {t.date_fin}
                    </span>
                    <div className="w-20 h-1.5 bg-gris-100 rounded-full shrink-0">
                      <div
                        className="h-full bg-primaire-400 rounded-full"
                        style={{ width: `${t.progression}%` }}
                      />
                    </div>
                    <span className="text-xs text-gris-400 w-8 text-right shrink-0">{t.progression}%</span>
                    {t.montant_ht != null && (
                      <span className="text-xs text-gris-400 w-24 text-right shrink-0">
                        {formaterEuro(t.montant_ht)}
                      </span>
                    )}
                    <button
                      onClick={() => supprimerTache(t.id)}
                      className="opacity-0 group-hover:opacity-100 text-rouge-400 hover:text-rouge-600 transition-opacity"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal création planning */}
      {modalCreation && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-base font-semibold text-gris-900 mb-4">Nouveau planning Gantt</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gris-700 mb-1">Intitulé</label>
                <input
                  type="text"
                  value={nomNouveauPlanning}
                  onChange={(e) => setNomNouveauPlanning(e.target.value)}
                  className="w-full rounded-lg border border-gris-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primaire-400"
                  placeholder="Ex : Planning de chantier 2025"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gris-700 mb-1">Mode</label>
                <div className="flex gap-2">
                  {[
                    { val: "general", label: "Planning général (MOE / OPC)" },
                    { val: "execution", label: "Planning d'exécution" },
                  ].map((m) => (
                    <button
                      key={m.val}
                      onClick={() => setModeNouveauPlanning(m.val as "general" | "execution")}
                      className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
                        modeNouveauPlanning === m.val
                          ? "bg-primaire-50 border-primaire-400 text-primaire-700 font-medium"
                          : "border-gris-200 text-gris-600 hover:border-gris-300"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setModalCreation(false)}
                className="flex-1 px-4 py-2 text-sm text-gris-600 border border-gris-200 rounded-lg hover:bg-gris-50"
              >
                Annuler
              </button>
              <button
                onClick={() => mutCreerPlanning.mutate({ intitule: nomNouveauPlanning, mode: modeNouveauPlanning })}
                disabled={!nomNouveauPlanning.trim() || mutCreerPlanning.isPending}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-primaire-600 rounded-lg hover:bg-primaire-700 disabled:opacity-50"
              >
                {mutCreerPlanning.isPending ? "Création…" : "Créer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
