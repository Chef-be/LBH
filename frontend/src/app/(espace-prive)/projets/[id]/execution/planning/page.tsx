"use client";

import { use, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft, Download, GitBranch, Plus, RefreshCcw, ZoomIn, ZoomOut, Calendar,
} from "lucide-react";
import { api, ErreurApi } from "@/crochets/useApi";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TachePlanning {
  id: string;
  numero_ordre: number;
  code: string;
  designation: string;
  duree_jours: number | string;
  decalage_jours: number | string;
  date_debut_calculee: string | null;
  date_fin_calculee: string | null;
  est_critique: boolean;
  marge_libre_jours: number | string;
  effectif_alloue: number;
}

interface PlanningChantier {
  id: string;
  intitule: string;
  date_debut_reference: string;
  source_donnees_libelle: string;
  synthese_calcul: {
    duree_totale_jours?: number | string;
    nb_taches?: number;
    nb_taches_critiques?: number;
  };
  taches: TachePlanning[];
}

interface SuiviExecution {
  id: string;
  projet: string;
}

// ---------------------------------------------------------------------------
// Utilitaires Gantt
// ---------------------------------------------------------------------------

const ZOOM_JOURS: Record<string, number> = {
  semaine: 7,
  mois: 30,
  trimestre: 90,
};

const LARGEUR_COLONNE_JOUR = {
  semaine: 40,   // px par jour en vue semaine
  mois: 12,
  trimestre: 4,
};

type EchelleZoom = "semaine" | "mois" | "trimestre";

function ajouterJours(dateIso: string, jours: number): Date {
  const d = new Date(`${dateIso}T00:00:00`);
  d.setDate(d.getDate() + jours);
  return d;
}

function joursEntreDeuxDates(a: string, b: string | null): number {
  if (!b) return 0;
  const da = new Date(`${a}T00:00:00`);
  const db = new Date(`${b}T00:00:00`);
  return Math.max(0, Math.round((db.getTime() - da.getTime()) / 86400000));
}

function formaterDateCourte(d: Date): string {
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

function formaterDateMois(d: Date): string {
  return d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
}

function formaterDateEntete(d: Date, echelle: EchelleZoom): string {
  if (echelle === "semaine") return formaterDateCourte(d);
  if (echelle === "mois") return formaterDateCourte(d);
  return formaterDateMois(d);
}

function genererColonnes(
  dateDebut: string,
  dureeJours: number,
  echelle: EchelleZoom
): { date: Date; label: string; largeurPx: number }[] {
  const pas = ZOOM_JOURS[echelle];
  const pxJour = LARGEUR_COLONNE_JOUR[echelle];
  const colonnes: { date: Date; label: string; largeurPx: number }[] = [];
  let courant = new Date(`${dateDebut}T00:00:00`);
  let joursParcourus = 0;
  while (joursParcourus < dureeJours + pas) {
    const largeur = Math.min(pas, dureeJours + pas - joursParcourus) * pxJour;
    colonnes.push({
      date: new Date(courant),
      label: formaterDateEntete(courant, echelle),
      largeurPx: largeur,
    });
    courant = ajouterJours(courant.toISOString().slice(0, 10), pas);
    joursParcourus += pas;
  }
  return colonnes;
}

// ---------------------------------------------------------------------------
// Composant SVG Gantt
// ---------------------------------------------------------------------------

const HAUTEUR_LIGNE = 32;
const HAUTEUR_EN_TETE = 36;
const LARGEUR_LIBELLE = 280;

function GanttSvg({
  planning,
  echelle,
}: {
  planning: PlanningChantier;
  echelle: EchelleZoom;
}) {
  const dateDebut = planning.date_debut_reference;
  const dureeJours = Math.max(Number(planning.synthese_calcul?.duree_totale_jours || 60), 10);
  const pxJour = LARGEUR_COLONNE_JOUR[echelle];
  const colonnes = genererColonnes(dateDebut, dureeJours, echelle);
  const largeurGrille = colonnes.reduce((s, c) => s + c.largeurPx, 0);
  const hauteurSvg = HAUTEUR_EN_TETE + planning.taches.length * HAUTEUR_LIGNE + 8;

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <div className="flex">
        {/* Colonne libellés (fixe) */}
        <div className="shrink-0" style={{ width: LARGEUR_LIBELLE }}>
          <div
            className="flex items-center border-b border-r border-slate-200 bg-slate-50 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500"
            style={{ height: HAUTEUR_EN_TETE }}
          >
            Tâche
          </div>
          {planning.taches.map((tache, idx) => (
            <div
              key={tache.id}
              className={`flex items-center gap-2 border-b border-r border-slate-100 px-3 text-xs ${
                idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"
              }`}
              style={{ height: HAUTEUR_LIGNE }}
            >
              <span className="shrink-0 font-mono text-slate-400">#{tache.numero_ordre}</span>
              <span
                className={`truncate font-medium ${tache.est_critique ? "text-rose-700" : "text-slate-700"}`}
                title={tache.designation}
              >
                {tache.designation}
              </span>
              {tache.est_critique && (
                <span className="shrink-0 rounded bg-rose-100 px-1 py-0.5 text-[10px] font-semibold text-rose-600">
                  ●
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Zone SVG scrollable */}
        <div className="overflow-x-auto">
          <svg
            width={largeurGrille}
            height={hauteurSvg}
            className="block"
            style={{ minWidth: largeurGrille }}
          >
            {/* En-tête colonnes */}
            {(() => {
              let xCourant = 0;
              return colonnes.map((col, i) => {
                const x = xCourant;
                xCourant += col.largeurPx;
                return (
                  <g key={i}>
                    <rect
                      x={x}
                      y={0}
                      width={col.largeurPx}
                      height={HAUTEUR_EN_TETE}
                      fill={i % 2 === 0 ? "#f8fafc" : "#f1f5f9"}
                    />
                    <line
                      x1={x}
                      y1={0}
                      x2={x}
                      y2={hauteurSvg}
                      stroke="#e2e8f0"
                      strokeWidth={1}
                    />
                    <text
                      x={x + col.largeurPx / 2}
                      y={HAUTEUR_EN_TETE / 2 + 5}
                      textAnchor="middle"
                      fontSize={10}
                      fill="#64748b"
                      fontFamily="system-ui"
                    >
                      {col.label}
                    </text>
                  </g>
                );
              });
            })()}

            {/* Ligne de séparation en-tête */}
            <line
              x1={0}
              y1={HAUTEUR_EN_TETE}
              x2={largeurGrille}
              y2={HAUTEUR_EN_TETE}
              stroke="#cbd5e1"
              strokeWidth={1}
            />

            {/* Barres des tâches */}
            {planning.taches.map((tache, idx) => {
              const y = HAUTEUR_EN_TETE + idx * HAUTEUR_LIGNE;
              const debut = tache.date_debut_calculee
                ? joursEntreDeuxDates(dateDebut, tache.date_debut_calculee)
                : Number(tache.decalage_jours || 0);
              const duree = Math.max(Number(tache.duree_jours || 1), 1);
              const xBarre = debut * pxJour;
              const largeurBarre = Math.max(duree * pxJour, 4);
              const couleur = tache.est_critique ? "#f43f5e" : "#6366f1";
              const couleurClaire = tache.est_critique ? "#ffe4e6" : "#e0e7ff";

              return (
                <g key={tache.id}>
                  {/* Fond de ligne alterné */}
                  <rect
                    x={0}
                    y={y}
                    width={largeurGrille}
                    height={HAUTEUR_LIGNE}
                    fill={idx % 2 === 0 ? "white" : "#f8fafc"}
                  />
                  {/* Barre principale */}
                  <rect
                    x={xBarre}
                    y={y + 6}
                    width={largeurBarre}
                    height={HAUTEUR_LIGNE - 12}
                    rx={4}
                    fill={couleur}
                    opacity={0.9}
                  />
                  {/* Marge libre (flottante, en clair) */}
                  {Number(tache.marge_libre_jours) > 0 && (
                    <rect
                      x={xBarre + largeurBarre}
                      y={y + 10}
                      width={Number(tache.marge_libre_jours) * pxJour}
                      height={HAUTEUR_LIGNE - 20}
                      rx={3}
                      fill={couleurClaire}
                      stroke={couleur}
                      strokeWidth={1}
                      strokeDasharray="3,2"
                    />
                  )}
                  {/* Label durée sur la barre (si place) */}
                  {largeurBarre > 40 && (
                    <text
                      x={xBarre + largeurBarre / 2}
                      y={y + HAUTEUR_LIGNE / 2 + 4}
                      textAnchor="middle"
                      fontSize={9}
                      fill="white"
                      fontWeight="600"
                      fontFamily="system-ui"
                    >
                      {duree}j
                    </text>
                  )}
                  {/* Ligne de séparation */}
                  <line
                    x1={0}
                    y1={y + HAUTEUR_LIGNE}
                    x2={largeurGrille}
                    y2={y + HAUTEUR_LIGNE}
                    stroke="#f1f5f9"
                    strokeWidth={1}
                  />
                </g>
              );
            })}

            {/* Ligne verticale "aujourd'hui" */}
            {(() => {
              const aujourdhui = new Date();
              const debut = new Date(`${dateDebut}T00:00:00`);
              const joursDiff = Math.round(
                (aujourdhui.getTime() - debut.getTime()) / 86400000
              );
              if (joursDiff < 0 || joursDiff > dureeJours + 30) return null;
              const xAujourdHui = joursDiff * pxJour;
              return (
                <g>
                  <line
                    x1={xAujourdHui}
                    y1={HAUTEUR_EN_TETE}
                    x2={xAujourdHui}
                    y2={hauteurSvg}
                    stroke="#f59e0b"
                    strokeWidth={2}
                    strokeDasharray="4,3"
                  />
                  <text
                    x={xAujourdHui + 3}
                    y={HAUTEUR_EN_TETE + 12}
                    fontSize={9}
                    fill="#d97706"
                    fontWeight="600"
                    fontFamily="system-ui"
                  >
                    auj.
                  </text>
                </g>
              );
            })()}
          </svg>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page principale
// ---------------------------------------------------------------------------

export default function PagePlanningGantt({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projetId } = use(params);

  const [suivi, setSuivi] = useState<SuiviExecution | null>(null);
  const [plannings, setPlannings] = useState<PlanningChantier[]>([]);
  const [planningActifId, setPlanningActifId] = useState<string | null>(null);
  const [echelle, setEchelle] = useState<EchelleZoom>("mois");
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [recalculEnCours, setRecalculEnCours] = useState(false);
  const [telechargement, setTelechargement] = useState<string | null>(null);
  const [creationOuverte, setCreationOuverte] = useState(false);
  const [formCreation, setFormCreation] = useState({
    intitule: "Planning travaux",
    date_debut_reference: new Date().toISOString().slice(0, 10),
    source_donnees: "manuel",
  });

  const charger = useCallback(async () => {
    setChargement(true);
    try {
      // Récupérer le suivi d'exécution du projet
      const repSuivis = await api.get<{ results: SuiviExecution[] }>(
        `/api/execution/?projet=${projetId}`
      );
      const suivis = repSuivis.results ?? [];
      if (suivis.length === 0) {
        setChargement(false);
        return;
      }
      const s = suivis[0];
      setSuivi(s);
      // Charger les plannings
      const repPlannings = await api.get<{ results: PlanningChantier[] }>(
        `/api/execution/${s.id}/plannings/`
      );
      const liste = repPlannings.results ?? [];
      setPlannings(liste);
      if (liste.length > 0 && !planningActifId) {
        setPlanningActifId(liste[0].id);
      }
    } catch {
      setErreur("Impossible de charger le planning.");
    } finally {
      setChargement(false);
    }
  }, [projetId, planningActifId]);

  useEffect(() => { charger(); }, [charger]);

  const planningActif = plannings.find((p) => p.id === planningActifId) ?? null;

  async function recalculer() {
    if (!planningActif) return;
    setRecalculEnCours(true);
    setErreur(null);
    try {
      await api.post(`/api/execution/plannings/${planningActif.id}/recalculer/`, {});
      await charger();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Impossible de recalculer.");
    } finally {
      setRecalculEnCours(false);
    }
  }

  async function telecharger(format: "xlsx" | "pdf") {
    if (!planningActif) return;
    setTelechargement(format);
    try {
      const reponse = await api.telecharger(
        `/api/execution/plannings/${planningActif.id}/export/${format}/`
      );
      const url = window.URL.createObjectURL(reponse.blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = reponse.nomFichier || `planning.${format}`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : `Impossible d'exporter en ${format}.`);
    } finally {
      setTelechargement(null);
    }
  }

  async function creerPlanning() {
    if (!suivi) return;
    try {
      await api.post(`/api/execution/${suivi.id}/plannings/`, {
        ...formCreation,
        suivi: suivi.id,
      });
      setCreationOuverte(false);
      await charger();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Impossible de créer le planning.");
    }
  }

  // ---------------------------------------------------------------------------
  // Rendu
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-5">
      {/* En-tête */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href={`/projets/${projetId}/execution`}
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-1"
          >
            <ArrowLeft size={13} /> Suivi d&apos;exécution
          </Link>
          <h1 className="text-xl font-semibold text-slate-900">Planning Gantt</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Visualisation du chemin critique et des tâches travaux
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Zoom */}
          <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1">
            {(["semaine", "mois", "trimestre"] as EchelleZoom[]).map((e) => (
              <button
                key={e}
                onClick={() => setEchelle(e)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  echelle === e
                    ? "bg-primaire-600 text-white"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {e === "semaine" ? "Semaine" : e === "mois" ? "Mois" : "Trimestre"}
              </button>
            ))}
          </div>

          {planningActif && (
            <>
              <button
                onClick={recalculer}
                disabled={recalculEnCours}
                className="btn-secondaire text-xs"
              >
                <GitBranch className="w-3.5 h-3.5" />
                {recalculEnCours ? "Calcul…" : "Recalculer"}
              </button>
              <button
                onClick={() => telecharger("xlsx")}
                disabled={telechargement !== null}
                className="btn-secondaire text-xs"
              >
                <Download className="w-3.5 h-3.5" />
                {telechargement === "xlsx" ? "Export…" : "XLSX"}
              </button>
              <button
                onClick={() => telecharger("pdf")}
                disabled={telechargement !== null}
                className="btn-secondaire text-xs"
              >
                <Download className="w-3.5 h-3.5" />
                {telechargement === "pdf" ? "Export…" : "PDF"}
              </button>
            </>
          )}

          <button
            onClick={() => setCreationOuverte((o) => !o)}
            className="btn-primaire text-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            Nouveau planning
          </button>
        </div>
      </div>

      {erreur && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {erreur}
        </div>
      )}

      {/* Formulaire de création */}
      {creationOuverte && (
        <div className="carte space-y-4">
          <h3 className="text-sm font-semibold text-slate-800">Nouveau planning</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="libelle-champ">Intitulé</label>
              <input
                type="text"
                className="champ-saisie"
                value={formCreation.intitule}
                onChange={(e) => setFormCreation((p) => ({ ...p, intitule: e.target.value }))}
              />
            </div>
            <div>
              <label className="libelle-champ">Début de référence</label>
              <input
                type="date"
                className="champ-saisie"
                value={formCreation.date_debut_reference}
                onChange={(e) => setFormCreation((p) => ({ ...p, date_debut_reference: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setCreationOuverte(false)} className="btn-secondaire text-xs">
              Annuler
            </button>
            <button onClick={creerPlanning} className="btn-primaire text-xs">
              Créer
            </button>
          </div>
        </div>
      )}

      {chargement ? (
        <div className="carte py-12 text-center text-sm text-slate-400">Chargement…</div>
      ) : !suivi ? (
        <div className="carte py-12 text-center space-y-3">
          <p className="text-sm text-slate-500">
            Aucun dossier de suivi d&apos;exécution. Ouvrez-le d&apos;abord depuis l&apos;onglet Exécution.
          </p>
          <Link href={`/projets/${projetId}/execution`} className="btn-primaire text-xs inline-flex">
            Ouvrir le suivi
          </Link>
        </div>
      ) : plannings.length === 0 ? (
        <div className="carte py-12 text-center text-sm text-slate-400">
          Aucun planning. Créez-en un avec le bouton ci-dessus.
        </div>
      ) : (
        <div className="space-y-4">
          {/* Sélecteur de planning */}
          {plannings.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {plannings.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPlanningActifId(p.id)}
                  className={`rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${
                    p.id === planningActifId
                      ? "border-primaire-300 bg-primaire-50 text-primaire-700"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {p.intitule}
                </button>
              ))}
            </div>
          )}

          {/* KPIs */}
          {planningActif && (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="carte py-3 text-center">
                  <p className="text-xs text-slate-500 uppercase tracking-wider">Durée totale</p>
                  <p className="mt-1 text-2xl font-bold text-slate-800 font-mono">
                    {planningActif.synthese_calcul?.duree_totale_jours ?? "—"}
                    <span className="text-sm font-normal text-slate-500 ml-1">j</span>
                  </p>
                </div>
                <div className="carte py-3 text-center">
                  <p className="text-xs text-slate-500 uppercase tracking-wider">Tâches</p>
                  <p className="mt-1 text-2xl font-bold text-slate-800 font-mono">
                    {planningActif.synthese_calcul?.nb_taches ?? planningActif.taches.length}
                  </p>
                </div>
                <div className="carte py-3 text-center">
                  <p className="text-xs text-slate-500 uppercase tracking-wider">Critiques</p>
                  <p className="mt-1 text-2xl font-bold text-rose-600 font-mono">
                    {planningActif.synthese_calcul?.nb_taches_critiques ?? 0}
                  </p>
                </div>
                <div className="carte py-3 text-center">
                  <p className="text-xs text-slate-500 uppercase tracking-wider">Début</p>
                  <p className="mt-1 text-base font-semibold text-slate-800 font-mono">
                    {new Date(`${planningActif.date_debut_reference}T00:00:00`).toLocaleDateString("fr-FR", {
                      day: "2-digit", month: "short", year: "numeric",
                    })}
                  </p>
                </div>
              </div>

              {/* Légende */}
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-6 rounded bg-indigo-500" />
                  Tâche planifiée
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-6 rounded bg-rose-500" />
                  Chemin critique
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-6 rounded border border-dashed border-indigo-400 bg-indigo-100" />
                  Marge libre
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-0.5 bg-amber-400" />
                  Aujourd&apos;hui
                </span>
              </div>

              {/* Gantt SVG */}
              {planningActif.taches.length === 0 ? (
                <div className="carte py-10 text-center text-sm text-slate-400">
                  Aucune tâche dans ce planning. Régénérez-le depuis l&apos;onglet Exécution ou ajoutez des tâches manuellement.
                </div>
              ) : (
                <GanttSvg planning={planningActif} echelle={echelle} />
              )}

              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Calendar size={12} />
                <span>
                  Modifier les tâches, l&apos;équipe et les dépendances depuis l&apos;onglet{" "}
                  <Link
                    href={`/projets/${projetId}/execution`}
                    className="text-primaire-600 hover:underline"
                  >
                    Exécution → Planning
                  </Link>.
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
