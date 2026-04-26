"use client";

import { useState, useCallback, useRef, type JSX } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import {
  Plus, Save, Trash2, ChevronDown, ChevronRight,
  Calendar, Layers, BarChart3, Download, Users, X,
  Edit2, Check, Link2, AlertCircle,
} from "lucide-react";
import { api } from "@/crochets/useApi";
import type { TacheGanttFrappe } from "./GanttFrappe";

const GanttFrappe = dynamic(() => import("./GanttFrappe"), { ssr: false });

/* ── Types ───────────────────────────────────────────────────────────────── */

interface Ressource {
  nom: string;
  role: string;
  charge: number;
  unite: "j" | "h" | "ens";
}

interface TacheLocale {
  id: string;
  tache_parente: string | null;
  type_tache: "lot" | "article" | "tache" | "jalon";
  ordre: number;
  code: string;
  intitule: string;
  date_debut: string;
  date_fin: string;
  progression: number;
  dependances: string[];
  ressources: Ressource[];
  montant_ht: number | null;
  source_ligne_dpgf: string | null;
  couleur: string;
  _deplie?: boolean;
}

interface PlanningBackend {
  id: string;
  projet: string;
  intitule: string;
  mode: "general" | "execution";
  date_debut: string | null;
  date_fin: string | null;
  taches: (TacheLocale & { planning: string })[];
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

interface LigneDPGF {
  id: string;
  type_ligne: "lot" | "article" | "sous_total" | "commentaire";
  lot_code: string;
  lot_intitule: string;
  numero: string;
  designation: string;
  unite: string;
  quantite: number | null;
  prix_unitaire_ht: number | null;
  montant_ht: number | null;
}

type ViewMode = "Day" | "Week" | "Month" | "Quarter Year" | "Year";

/* ── Utilitaires ─────────────────────────────────────────────────────────── */

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
  return new Intl.NumberFormat("fr-FR", {
    style: "currency", currency: "EUR", maximumFractionDigits: 0,
  }).format(val);
}

function genId(): string {
  return `new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/* ── Modal ressources ────────────────────────────────────────────────────── */

function ModalRessources({
  tache,
  onSauvegarder,
  onFermer,
}: {
  tache: TacheLocale;
  onSauvegarder: (ressources: Ressource[]) => void;
  onFermer: () => void;
}) {
  const [ressources, setRessources] = useState<Ressource[]>(tache.ressources ?? []);

  function ajouter() {
    setRessources((r) => [...r, { nom: "", role: "", charge: 0, unite: "j" }]);
  }

  function modifier(i: number, champ: keyof Ressource, val: string | number) {
    setRessources((r) => r.map((x, j) => (j === i ? { ...x, [champ]: val } : x)));
  }

  function supprimer(i: number) {
    setRessources((r) => r.filter((_, j) => j !== i));
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--fond-carte)] rounded-2xl shadow-xl w-full max-w-xl border border-[var(--bordure-fm)]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--bordure)]">
          <div>
            <h3 className="text-sm font-semibold text-[var(--texte)]">Ressources affectées</h3>
            <p className="text-xs text-[var(--texte-3)] mt-0.5 truncate max-w-xs">{tache.code ? `${tache.code} — ` : ""}{tache.intitule}</p>
          </div>
          <button onClick={onFermer} className="text-[var(--texte-3)] hover:text-[var(--texte-2)]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-2 max-h-72 overflow-y-auto">
          {ressources.length === 0 && (
            <p className="text-xs text-[var(--texte-3)] text-center py-4">Aucune ressource affectée</p>
          )}
          {ressources.map((r, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                className="champ-saisie flex-1 min-w-0 !py-1 !px-2 !text-xs"
                placeholder="Nom / Équipe"
                value={r.nom}
                onChange={(e) => modifier(i, "nom", e.target.value)}
              />
              <input
                className="champ-saisie w-28 !py-1 !px-2 !text-xs"
                placeholder="Rôle"
                value={r.role}
                onChange={(e) => modifier(i, "role", e.target.value)}
              />
              <input
                type="number"
                min={0}
                className="champ-saisie w-16 !py-1 !px-2 !text-xs text-right"
                placeholder="0"
                value={r.charge || ""}
                onChange={(e) => modifier(i, "charge", parseFloat(e.target.value) || 0)}
              />
              <select
                className="champ-saisie w-14 !py-1 !px-1 !text-xs"
                value={r.unite}
                onChange={(e) => modifier(i, "unite", e.target.value)}
              >
                <option value="j">j</option>
                <option value="h">h</option>
                <option value="ens">ens</option>
              </select>
              <button onClick={() => supprimer(i)} className="text-rouge-400 hover:text-rouge-600 shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="px-5 py-3 border-t border-[var(--bordure)] flex justify-between items-center">
          <button
            onClick={ajouter}
            className="flex items-center gap-1.5 text-xs text-primaire-600 hover:text-primaire-700 font-medium"
          >
            <Plus className="w-3.5 h-3.5" />
            Ajouter une ressource
          </button>
          <div className="flex gap-2">
            <button onClick={onFermer} className="px-3 py-1.5 text-xs text-[var(--texte-2)] border border-[var(--bordure-fm)] rounded-lg hover:bg-[var(--fond-app)]">
              Annuler
            </button>
            <button
              onClick={() => onSauvegarder(ressources)}
              className="px-3 py-1.5 text-xs font-medium text-white bg-primaire-600 rounded-lg hover:bg-primaire-700"
            >
              Valider
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Modal dépendances ───────────────────────────────────────────────────── */

function ModalDependances({
  tache,
  toutesLesTaches,
  onSauvegarder,
  onFermer,
}: {
  tache: TacheLocale;
  toutesLesTaches: TacheLocale[];
  onSauvegarder: (deps: string[]) => void;
  onFermer: () => void;
}) {
  const [deps, setDeps] = useState<string[]>(tache.dependances ?? []);

  function basculer(id: string) {
    setDeps((prev) => prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]);
  }

  const candidats = toutesLesTaches.filter((t) => t.id !== tache.id);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--fond-carte)] rounded-2xl shadow-xl w-full max-w-md border border-[var(--bordure-fm)]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--bordure)]">
          <h3 className="text-sm font-semibold text-[var(--texte)]">Dépendances (finit-début)</h3>
          <button onClick={onFermer} className="text-[var(--texte-3)] hover:text-[var(--texte-2)]"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 py-4 max-h-64 overflow-y-auto space-y-1">
          {candidats.length === 0 && (
            <p className="text-xs text-[var(--texte-3)] text-center py-4">Aucune autre tâche disponible</p>
          )}
          {candidats.map((t) => (
            <label key={t.id} className="flex items-center gap-2.5 py-1.5 cursor-pointer hover:bg-[var(--fond-app)] rounded px-2">
              <input
                type="checkbox"
                checked={deps.includes(t.id)}
                onChange={() => basculer(t.id)}
                className="rounded border-[var(--bordure-fm)] text-primaire-600"
              />
              <span className="text-xs text-[var(--texte-2)]">{t.code ? `${t.code} — ` : ""}{t.intitule}</span>
            </label>
          ))}
        </div>
        <div className="px-5 py-3 border-t border-[var(--bordure)] flex justify-end gap-2">
          <button onClick={onFermer} className="px-3 py-1.5 text-xs text-[var(--texte-2)] border border-[var(--bordure-fm)] rounded-lg hover:bg-[var(--fond-app)]">Annuler</button>
          <button onClick={() => onSauvegarder(deps)} className="px-3 py-1.5 text-xs font-medium text-white bg-primaire-600 rounded-lg hover:bg-primaire-700">Valider</button>
        </div>
      </div>
    </div>
  );
}

/* ── Ligne de tâche éditable ─────────────────────────────────────────────── */

function LigneTache({
  tache,
  niveau,
  estDeplie,
  onBasculer,
  onModifier,
  onSupprimer,
  onRessources,
  onDependances,
}: {
  tache: TacheLocale;
  niveau: number;
  estDeplie: boolean;
  onBasculer: () => void;
  onModifier: (champ: keyof TacheLocale, val: unknown) => void;
  onSupprimer: () => void;
  onRessources: () => void;
  onDependances: () => void;
}) {
  const [editionIntitule, setEditionIntitule] = useState(false);
  const [valeurIntitule, setValeurIntitule] = useState(tache.intitule);
  const inputRef = useRef<HTMLInputElement>(null);

  function validerIntitule() {
    if (valeurIntitule.trim()) onModifier("intitule", valeurIntitule.trim());
    setEditionIntitule(false);
  }

  const estLot = tache.type_tache === "lot";
  const totalCharge = tache.ressources?.reduce((s, r) => s + r.charge, 0) ?? 0;

  return (
    <div
      className={`flex items-center gap-1.5 px-3 py-1.5 hover:bg-[var(--fond-app)] group text-xs ${estLot ? "bg-[var(--fond-app)]/50 border-b border-[var(--bordure)]" : ""}`}
      style={{ paddingLeft: `${12 + niveau * 20}px` }}
    >
      {/* Expand / collapse pour les lots */}
      {estLot ? (
        <button onClick={onBasculer} className="text-[var(--texte-3)] hover:text-[var(--texte-2)] shrink-0">
          {estDeplie ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>
      ) : (
        <div className="w-3.5 shrink-0" />
      )}

      {/* Code */}
      <span className={`font-mono text-[var(--texte-3)] w-10 shrink-0 ${estLot ? "font-bold text-[var(--texte-2)]" : ""}`}>
        {tache.code || "—"}
      </span>

      {/* Intitulé (éditable) */}
      <div className="flex-1 min-w-0 flex items-center gap-1">
        {editionIntitule ? (
          <input
            ref={inputRef}
            autoFocus
            value={valeurIntitule}
            onChange={(e) => setValeurIntitule(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") validerIntitule(); if (e.key === "Escape") setEditionIntitule(false); }}
            onBlur={validerIntitule}
            className="champ-saisie flex-1 !py-0.5 !px-1.5 !text-xs"
          />
        ) : (
          <span
            className={`truncate cursor-text ${estLot ? "font-semibold text-[var(--texte)]" : "text-[var(--texte-2)]"}`}
            onDoubleClick={() => { setEditionIntitule(true); setValeurIntitule(tache.intitule); }}
            title={tache.intitule}
          >
            {tache.intitule}
          </span>
        )}
      </div>

      {/* Dates */}
      <div className="hidden lg:flex items-center gap-1 shrink-0">
        <input
          type="date"
          value={tache.date_debut}
          onChange={(e) => onModifier("date_debut", e.target.value)}
          className="w-28 border-0 bg-transparent text-[var(--texte-3)] text-xs focus:outline-none focus:bg-[var(--fond-entree)] focus:border focus:border-[var(--bordure-fm)] rounded px-1"
        />
        <span className="text-[var(--texte-3)]">→</span>
        <input
          type="date"
          value={tache.date_fin}
          onChange={(e) => onModifier("date_fin", e.target.value)}
          className="w-28 border-0 bg-transparent text-[var(--texte-3)] text-xs focus:outline-none focus:bg-[var(--fond-entree)] focus:border focus:border-[var(--bordure-fm)] rounded px-1"
        />
      </div>

      {/* Avancement */}
      <div className="hidden md:flex items-center gap-1 shrink-0 w-20">
        <div className="flex-1 h-1.5 bg-[var(--fond-app)] rounded-full">
          <div className="h-full bg-primaire-400 rounded-full" style={{ width: `${tache.progression}%` }} />
        </div>
        <span className="text-[var(--texte-3)] w-7 text-right">{tache.progression}%</span>
      </div>

      {/* Ressources badge */}
      {tache.ressources?.length > 0 && (
        <div className="flex items-center gap-0.5 shrink-0">
          <Users className="w-3 h-3 text-primaire-400" />
          <span className="text-primaire-600 text-xs">{tache.ressources.length}</span>
          {totalCharge > 0 && (
            <span className="text-[var(--texte-3)] text-xs ml-0.5">({totalCharge}j)</span>
          )}
        </div>
      )}

      {/* Montant */}
      {tache.montant_ht != null && (
        <span className="hidden xl:block text-[var(--texte-3)] w-20 text-right shrink-0">{formaterEuro(tache.montant_ht)}</span>
      )}

      {/* Actions (visibles au survol) */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button
          onClick={onRessources}
          className="text-[var(--texte-3)] hover:text-primaire-600"
          title="Ressources"
        >
          <Users className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onDependances}
          className="text-[var(--texte-3)] hover:text-primaire-600"
          title="Dépendances"
        >
          <Link2 className="w-3.5 h-3.5" />
        </button>
        <button onClick={onSupprimer} className="text-rouge-400 hover:text-rouge-600" title="Supprimer">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

/* ── Panneau ressources ──────────────────────────────────────────────────── */

function PanneauRessources({ taches }: { taches: TacheLocale[] }) {
  const index: Record<string, { nom: string; role: string; taches: string[]; chargeTotal: number; unite: string }> = {};

  for (const t of taches) {
    for (const r of t.ressources ?? []) {
      if (!r.nom) continue;
      const key = r.nom;
      if (!index[key]) index[key] = { nom: r.nom, role: r.role, taches: [], chargeTotal: 0, unite: r.unite };
      index[key].taches.push(t.intitule);
      index[key].chargeTotal += r.charge;
    }
  }

  const liste = Object.values(index);

  if (liste.length === 0) {
    return (
      <div className="text-xs text-[var(--texte-3)] text-center py-6">
        Aucune ressource affectée — double-cliquez sur une tâche pour affecter des ressources.
      </div>
    );
  }

  return (
    <div className="divide-y divide-gris-50">
      {liste.map((r) => (
        <div key={r.nom} className="flex items-start gap-3 px-4 py-2.5">
          <div className="w-8 h-8 rounded-full bg-primaire-100 flex items-center justify-center shrink-0">
            <span className="text-xs font-semibold text-primaire-700">{r.nom.slice(0, 2).toUpperCase()}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-[var(--texte)]">{r.nom}</span>
              {r.role && <span className="text-xs text-[var(--texte-3)]">— {r.role}</span>}
            </div>
            <p className="text-xs text-[var(--texte-3)] truncate mt-0.5">{r.taches.slice(0, 3).join(", ")}{r.taches.length > 3 ? ` +${r.taches.length - 3}` : ""}</p>
          </div>
          {r.chargeTotal > 0 && (
            <span className="text-xs font-medium text-primaire-600 shrink-0">{r.chargeTotal} {r.unite}</span>
          )}
        </div>
      ))}
    </div>
  );
}

/* ── Composant principal ─────────────────────────────────────────────────── */

export function PlanningGeneralGantt({ projetId }: { projetId: string }) {
  const qc = useQueryClient();
  const [planningActifId, setPlanningActifId] = useState<string | null>(null);
  const [modeVue, setModeVue] = useState<ViewMode>("Month");
  const [tachesLocales, setTachesLocales] = useState<TacheLocale[]>([]);
  const [modifie, setModifie] = useState(false);
  const [lotsDepliees, setLotsDepliees] = useState<Set<string>>(new Set());
  const [modalCreation, setModalCreation] = useState(false);
  const [nomNouveauPlanning, setNomNouveauPlanning] = useState("Planning général");
  const [modeNouveauPlanning, setModeNouveauPlanning] = useState<"general" | "execution">("general");
  const [tacheRessources, setTacheRessources] = useState<TacheLocale | null>(null);
  const [tacheDependances, setTacheDependances] = useState<TacheLocale | null>(null);
  const [ongletPanneau, setOngletPanneau] = useState<"taches" | "ressources">("taches");

  /* ── Données backend ── */
  const { data: plannings = [], isLoading } = useQuery<PlanningBackend[]>({
    queryKey: ["plannings", projetId],
    queryFn: () => api.get(`/api/projets/${projetId}/plannings/`) as Promise<PlanningBackend[]>,
  });

  const planningActif = plannings.find((p) => p.id === planningActifId) ?? null;

  const { data: dpgfPieceId } = useQuery<string | null>({
    queryKey: ["dpgf-piece-id", projetId],
    queryFn: async () => {
      const pieces = await api.get(`/api/pieces-ecrites/?projet=${projetId}&type_piece=dpgf`) as { id: string }[];
      return pieces?.[0]?.id ?? null;
    },
    staleTime: 120000,
  });

  const { data: syntheseDPGF } = useQuery<SyntheseDPGF>({
    queryKey: ["synthese-dpgf-planning", dpgfPieceId],
    enabled: !!dpgfPieceId,
    queryFn: () => api.get(`/api/pieces-ecrites/${dpgfPieceId}/synthese-dpgf/`) as Promise<SyntheseDPGF>,
    staleTime: 60000,
  });

  const { data: lignesDPGF } = useQuery<LigneDPGF[]>({
    queryKey: ["lignes-dpgf-planning", dpgfPieceId],
    enabled: !!dpgfPieceId && planningActif?.mode === "execution",
    queryFn: () => api.get(`/api/pieces-ecrites/${dpgfPieceId}/lignes-dpgf/`) as Promise<LigneDPGF[]>,
    staleTime: 60000,
  });

  /* ── Mutations ── */
  const mutCreerPlanning = useMutation({
    mutationFn: (data: { intitule: string; mode: string }) =>
      api.post(`/api/projets/${projetId}/plannings/`, data) as Promise<PlanningBackend>,
    onSuccess: (planning) => {
      qc.invalidateQueries({ queryKey: ["plannings", projetId] });
      setPlanningActifId(planning.id);
      setTachesLocales([]);
      setModalCreation(false);
    },
  });

  const mutSauvegarder = useMutation({
    mutationFn: (taches: TacheLocale[]) =>
      api.post(`/api/projets/${projetId}/plannings/${planningActifId}/sauvegarder/`, { taches }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plannings", projetId] });
      setModifie(false);
    },
  });

  const mutSupprimerPlanning = useMutation({
    mutationFn: (id: string) => api.supprimer(`/api/projets/${projetId}/plannings/${id}/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plannings", projetId] });
      setPlanningActifId(null);
      setTachesLocales([]);
    },
  });

  /* ── Actions ── */
  const chargerPlanning = useCallback((p: PlanningBackend) => {
    setPlanningActifId(p.id);
    setTachesLocales(p.taches?.map(({ planning: _, ...t }) => t) ?? []);
    setModifie(false);
    setLotsDepliees(new Set());
  }, []);

  const modifierTache = useCallback((id: string, champ: keyof TacheLocale, val: unknown) => {
    setTachesLocales((prev) => prev.map((t) => t.id === id ? { ...t, [champ]: val } : t));
    setModifie(true);
  }, []);

  const supprimerTache = useCallback((id: string) => {
    setTachesLocales((prev) => prev.filter((t) => t.id !== id && t.tache_parente !== id));
    setModifie(true);
  }, []);

  const basculerLot = useCallback((id: string) => {
    setLotsDepliees((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }, []);

  /* ── Import DPGF ── */
  const importerLotsGeneraux = useCallback(() => {
    if (!syntheseDPGF?.lots?.length) return;
    const debut = dateAujourdhui();
    const nouvelles: TacheLocale[] = syntheseDPGF.lots.map((lot, i) => ({
      id: genId(),
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
    setLotsDepliees(new Set());
    setModifie(true);
  }, [syntheseDPGF]);

  const importerArticlesExecution = useCallback(() => {
    if (!lignesDPGF?.length) return;
    const debut = dateAujourdhui();
    const taches: TacheLocale[] = [];
    const lotsIndex: Record<string, string> = {};
    let ordre = 0;

    for (const ligne of lignesDPGF) {
      if (ligne.type_ligne === "lot") {
        const idLot = genId();
        lotsIndex[ligne.lot_code || ligne.designation] = idLot;
        taches.push({
          id: idLot,
          tache_parente: null,
          type_tache: "lot",
          ordre: ordre++,
          code: ligne.lot_code,
          intitule: ligne.lot_intitule || ligne.designation,
          date_debut: dateAvancer(debut, taches.length * 10),
          date_fin: dateAvancer(debut, taches.length * 10 + 29),
          progression: 0,
          dependances: [],
          ressources: [],
          montant_ht: null,
          source_ligne_dpgf: ligne.id,
          couleur: "",
        });
      } else if (ligne.type_ligne === "article") {
        const cle = ligne.lot_code || "";
        const parentId = lotsIndex[cle] ?? null;
        taches.push({
          id: genId(),
          tache_parente: parentId,
          type_tache: "article",
          ordre: ordre++,
          code: ligne.numero,
          intitule: ligne.designation,
          date_debut: dateAvancer(debut, 0),
          date_fin: dateAvancer(debut, 14),
          progression: 0,
          dependances: [],
          ressources: [],
          montant_ht: ligne.montant_ht,
          source_ligne_dpgf: ligne.id,
          couleur: "",
        });
      }
    }

    setTachesLocales(taches);
    setLotsDepliees(new Set(Object.values(lotsIndex)));
    setModifie(true);
  }, [lignesDPGF]);

  const ajouterTacheLibre = useCallback(() => {
    setTachesLocales((prev) => [
      ...prev,
      {
        id: genId(),
        tache_parente: null,
        type_tache: "tache",
        ordre: prev.length,
        code: "",
        intitule: "Nouvelle tâche",
        date_debut: dateAujourdhui(),
        date_fin: dateAvancer(dateAujourdhui(), 14),
        progression: 0,
        dependances: [],
        ressources: [],
        montant_ht: null,
        source_ligne_dpgf: null,
        couleur: "",
      },
    ]);
    setModifie(true);
  }, []);

  const mettreAJourDateTache = useCallback((tacheFrappe: TacheGanttFrappe, debut: Date, fin: Date) => {
    const id = tacheFrappe.id.replace(/^t-/, "");
    setTachesLocales((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, date_debut: debut.toISOString().slice(0, 10), date_fin: fin.toISOString().slice(0, 10) } : t
      )
    );
    setModifie(true);
  }, []);

  const mettreAJourProgressionTache = useCallback((tacheFrappe: TacheGanttFrappe, progression: number) => {
    const id = tacheFrappe.id.replace(/^t-/, "");
    setTachesLocales((prev) =>
      prev.map((t) => t.id === id ? { ...t, progression: Math.round(progression) } : t)
    );
    setModifie(true);
  }, []);

  /* ── Tâches pour le Gantt (filtre : uniquement visibles) ── */
  const tachesVisibles: TacheLocale[] = tachesLocales.filter((t) => {
    if (!t.tache_parente) return true;
    return lotsDepliees.has(t.tache_parente);
  });

  const tachesFrappe: TacheGanttFrappe[] = tachesVisibles.map((t) => {
    const frappeId = t.id.startsWith("new-") ? t.id : `t-${t.id}`;
    const parentFrappe = t.tache_parente
      ? (t.tache_parente.startsWith("new-") ? t.tache_parente : `t-${t.tache_parente}`)
      : undefined;
    const deps = (t.dependances ?? [])
      .map((d) => (d.startsWith("new-") ? d : `t-${d}`))
      .filter((d) => tachesVisibles.some((v) => (v.id.startsWith("new-") ? v.id : `t-${v.id}`) === d));

    return {
      id: frappeId,
      name: t.code ? `${t.code} — ${t.intitule}` : t.intitule,
      start: t.date_debut,
      end: t.date_fin,
      progress: t.progression,
      dependencies: deps.join(","),
      custom_class: t.type_tache === "lot" ? "tache-lot" : t.type_tache === "jalon" ? "tache-jalon" : "",
    };
  });

  /* ── Hierarchie affichée dans la liste ── */
  function renderListeTaches() {
    const lignes: JSX.Element[] = [];

    for (const t of tachesLocales) {
      const estLot = t.type_tache === "lot";
      const estDeplie = lotsDepliees.has(t.id);
      if (t.tache_parente && !lotsDepliees.has(t.tache_parente)) continue;
      const niveau = t.tache_parente ? 1 : 0;

      lignes.push(
        <LigneTache
          key={t.id}
          tache={t}
          niveau={niveau}
          estDeplie={estDeplie}
          onBasculer={() => basculerLot(t.id)}
          onModifier={(champ, val) => modifierTache(t.id, champ, val)}
          onSupprimer={() => supprimerTache(t.id)}
          onRessources={() => setTacheRessources(t)}
          onDependances={() => setTacheDependances(t)}
        />
      );
    }

    return lignes;
  }

  const modeActif = planningActif?.mode ?? "general";
  const peutImporter = modeActif === "general" ? !!(syntheseDPGF?.lots?.length) : !!(lignesDPGF?.length);

  return (
    <div className="flex flex-col gap-6">
      {/* En-tête */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primaire-600" />
          <h2 className="text-lg font-semibold text-[var(--texte)]">Planning Gantt</h2>
          {planningActif && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              planningActif.mode === "execution"
                ? "bg-orange-100 text-orange-700"
                : "bg-primaire-100 text-primaire-700"
            }`}>
              {planningActif.mode === "execution" ? "Exécution" : "Général"}
            </span>
          )}
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

      {/* Onglets plannings */}
      {isLoading ? (
        <div className="text-sm text-[var(--texte-3)] animate-pulse">Chargement…</div>
      ) : plannings.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--bordure-fm)] p-8 text-center">
          <Calendar className="w-10 h-10 text-[var(--texte-3)] mx-auto mb-3" />
          <p className="text-sm font-medium text-[var(--texte-2)] mb-1">Aucun planning créé</p>
          <p className="text-xs text-[var(--texte-3)] mb-4">Créez votre premier planning Gantt pour ce projet.</p>
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
                  : "bg-[var(--fond-carte)] text-[var(--texte-2)] border-[var(--bordure-fm)] hover:border-primaire-300"
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
        <div className="rounded-xl border border-[var(--bordure)] bg-[var(--fond-carte)] overflow-hidden">
          {/* Barre d'outils */}
          <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[var(--bordure)] flex-wrap bg-[var(--fond-app)]">
            {/* Modes de vue */}
            <div className="flex items-center gap-0.5 bg-[var(--fond-carte)] rounded-lg p-0.5 border border-[var(--bordure)]">
              {MODES_VUE.map((m) => (
                <button
                  key={m.val}
                  onClick={() => setModeVue(m.val)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    modeVue === m.val ? "bg-primaire-600 text-white" : "text-[var(--texte-3)] hover:text-[var(--texte-2)]"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <div className="flex-1" />

            {/* Import DPGF */}
            {peutImporter && (
              <button
                onClick={modeActif === "execution" ? importerArticlesExecution : importerLotsGeneraux}
                className="flex items-center gap-1.5 text-xs text-primaire-600 hover:text-primaire-700 font-medium border border-primaire-200 rounded-lg px-2.5 py-1.5 hover:bg-primaire-50"
              >
                <Download className="w-3.5 h-3.5" />
                {modeActif === "execution"
                  ? `Importer articles DPGF (${lignesDPGF?.filter((l) => l.type_ligne === "article").length ?? 0})`
                  : `Importer lots DPGF (${syntheseDPGF?.lots.length ?? 0})`
                }
              </button>
            )}

            <button
              onClick={ajouterTacheLibre}
              className="flex items-center gap-1.5 text-xs text-[var(--texte-2)] hover:text-[var(--texte)] font-medium border border-[var(--bordure-fm)] rounded-lg px-2.5 py-1.5 hover:bg-[var(--fond-carte)]"
            >
              <Plus className="w-3.5 h-3.5" />
              Tâche libre
            </button>

            <button
              onClick={() => { if (confirm("Supprimer ce planning ?")) mutSupprimerPlanning.mutate(planningActif.id); }}
              className="text-rouge-400 hover:text-rouge-600 p-1.5"
              title="Supprimer ce planning"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {/* Gantt */}
          <div className="p-4 border-b border-[var(--bordure)]">
            <GanttFrappe
              taches={tachesFrappe}
              viewMode={modeVue}
              onDateChange={mettreAJourDateTache}
              onProgressChange={mettreAJourProgressionTache}
            />
          </div>

          {/* Onglets panneau inférieur */}
          {tachesLocales.length > 0 && (
            <>
              <div className="flex border-b border-[var(--bordure)]">
                <button
                  onClick={() => setOngletPanneau("taches")}
                  className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors border-b-2 ${
                    ongletPanneau === "taches"
                      ? "border-primaire-500 text-primaire-700"
                      : "border-transparent text-[var(--texte-3)] hover:text-[var(--texte-2)]"
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  Tâches ({tachesLocales.length})
                </button>
                <button
                  onClick={() => setOngletPanneau("ressources")}
                  className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors border-b-2 ${
                    ongletPanneau === "ressources"
                      ? "border-primaire-500 text-primaire-700"
                      : "border-transparent text-[var(--texte-3)] hover:text-[var(--texte-2)]"
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  Ressources ({tachesLocales.flatMap((t) => t.ressources ?? []).filter((r) => r.nom).length})
                </button>
              </div>

              {ongletPanneau === "taches" ? (
                <div className="divide-y divide-gris-50 max-h-96 overflow-y-auto">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--fond-app)] text-xs font-medium text-[var(--texte-3)] uppercase tracking-wide sticky top-0">
                    <div className="w-3.5 shrink-0" />
                    <span className="w-10 shrink-0">Code</span>
                    <span className="flex-1">Désignation</span>
                    <span className="hidden lg:block w-60 shrink-0">Dates</span>
                    <span className="hidden md:block w-20 shrink-0">Avancement</span>
                    <span className="w-16 shrink-0" />
                  </div>
                  {renderListeTaches()}
                </div>
              ) : (
                <div className="max-h-96 overflow-y-auto">
                  <PanneauRessources taches={tachesLocales} />
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Modales */}
      {tacheRessources && (
        <ModalRessources
          tache={tacheRessources}
          onSauvegarder={(ressources) => {
            modifierTache(tacheRessources.id, "ressources", ressources);
            setTacheRessources(null);
          }}
          onFermer={() => setTacheRessources(null)}
        />
      )}

      {tacheDependances && (
        <ModalDependances
          tache={tacheDependances}
          toutesLesTaches={tachesLocales}
          onSauvegarder={(deps) => {
            modifierTache(tacheDependances.id, "dependances", deps);
            setTacheDependances(null);
          }}
          onFermer={() => setTacheDependances(null)}
        />
      )}

      {/* Modal création planning */}
      {modalCreation && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--fond-carte)] rounded-2xl shadow-xl w-full max-w-md p-6 border border-[var(--bordure-fm)]">
            <h3 className="text-base font-semibold text-[var(--texte)] mb-4">Nouveau planning Gantt</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--texte-2)] mb-1">Intitulé</label>
                <input
                  type="text"
                  value={nomNouveauPlanning}
                  onChange={(e) => setNomNouveauPlanning(e.target.value)}
                  className="champ-saisie"
                  placeholder="Ex : Planning de chantier 2025"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--texte-2)] mb-2">Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    {
                      val: "general",
                      label: "Planning général",
                      desc: "Lots comme tâches — MOE / OPC",
                    },
                    {
                      val: "execution",
                      label: "Planning d'exécution",
                      desc: "Articles DPGF + ressources — Entreprise",
                    },
                  ].map((m) => (
                    <button
                      key={m.val}
                      onClick={() => setModeNouveauPlanning(m.val as "general" | "execution")}
                      className={`text-left p-3 rounded-xl border-2 transition-colors ${
                        modeNouveauPlanning === m.val
                          ? "border-primaire-400 bg-primaire-50 dark:bg-primaire-900/20"
                          : "border-[var(--bordure-fm)] hover:border-[var(--bordure-fort)]"
                      }`}
                    >
                      <div className={`text-sm font-medium ${modeNouveauPlanning === m.val ? "text-primaire-700" : "text-[var(--texte)]"}`}>
                        {m.label}
                      </div>
                      <div className="text-xs text-[var(--texte-3)] mt-0.5">{m.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setModalCreation(false)}
                className="flex-1 px-4 py-2 text-sm text-[var(--texte-2)] border border-[var(--bordure-fm)] rounded-lg hover:bg-[var(--fond-app)]"
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
