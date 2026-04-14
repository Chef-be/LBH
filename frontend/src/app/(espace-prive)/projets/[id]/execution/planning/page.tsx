"use client";

import { use, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft, Download, GitBranch, Plus, RefreshCcw, Calendar,
  Pencil, Trash2, X, CheckCircle2, FileSearch,
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
  observations: string;
}

interface DependanceTache {
  id: string;
  tache_amont: string;
  tache_aval: string;
  type_dependance: "fd" | "dd";
  decalage_jours: number;
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

interface DevisAnalyse {
  id: string;
  nom_original: string;
  entreprise: string;
  localite: string;
  statut: string;
  lignes_count?: number;
}

interface LignePrixDevis {
  id: string;
  corps_etat: string;
  corps_etat_libelle: string;
  prix_ht_original: number;
  pct_mo_estime: number | null;
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
  semaine: 40,
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
  if (echelle === "trimestre") return formaterDateMois(d);
  return formaterDateCourte(d);
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
// Modal édition de tâche
// ---------------------------------------------------------------------------

function ModalEditionTache({
  tache,
  planningId,
  onFermer,
  onSauvegarde,
}: {
  tache: TachePlanning | null;
  planningId: string;
  onFermer: () => void;
  onSauvegarde: () => void;
}) {
  const [form, setForm] = useState({
    designation: "",
    duree_jours: "1",
    decalage_jours: "0",
    effectif_alloue: "1",
    observations: "",
    code: "",
  });
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (tache) {
      setForm({
        designation: tache.designation,
        duree_jours: String(tache.duree_jours),
        decalage_jours: String(tache.decalage_jours),
        effectif_alloue: String(tache.effectif_alloue),
        observations: tache.observations || "",
        code: tache.code || "",
      });
    } else {
      setForm({ designation: "", duree_jours: "1", decalage_jours: "0", effectif_alloue: "1", observations: "", code: "" });
    }
  }, [tache]);

  const sauvegarder = async () => {
    if (!form.designation.trim()) { setErreur("La désignation est obligatoire."); return; }
    setEnvoi(true);
    setErreur(null);
    try {
      const corps = {
        designation: form.designation.trim(),
        duree_jours: parseFloat(form.duree_jours) || 1,
        decalage_jours: parseFloat(form.decalage_jours) || 0,
        effectif_alloue: parseInt(form.effectif_alloue) || 1,
        observations: form.observations,
        code: form.code,
      };
      if (tache) {
        await api.patch(`/api/execution/plannings/${planningId}/taches/${tache.id}/`, corps);
      } else {
        await api.post(`/api/execution/plannings/${planningId}/taches/`, { ...corps, planning: planningId });
      }
      onSauvegarde();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Enregistrement impossible.");
    } finally {
      setEnvoi(false);
    }
  };

  const supprimer = async () => {
    if (!tache || !window.confirm(`Supprimer la tâche "${tache.designation}" ?`)) return;
    setEnvoi(true);
    try {
      await api.supprimer(`/api/execution/plannings/${planningId}/taches/${tache.id}/`);
      onSauvegarde();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Suppression impossible.");
      setEnvoi(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onFermer}>
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="font-semibold text-slate-900 text-sm">
            {tache ? "Modifier la tâche" : "Nouvelle tâche"}
          </h2>
          <button type="button" onClick={onFermer} className="rounded-lg p-1.5 hover:bg-slate-100">
            <X className="h-4 w-4 text-slate-500" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          {erreur && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{erreur}</div>
          )}
          <div>
            <label className="etiquette-champ">Désignation <span className="text-red-500">*</span></label>
            <input type="text" className="champ-saisie" value={form.designation}
              onChange={(e) => setForm((f) => ({ ...f, designation: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="etiquette-champ">Code</label>
              <input type="text" className="champ-saisie font-mono" placeholder="ex. GO, VRD…"
                value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} />
            </div>
            <div>
              <label className="etiquette-champ">Effectif (pers.)</label>
              <input type="number" min="1" className="champ-saisie" value={form.effectif_alloue}
                onChange={(e) => setForm((f) => ({ ...f, effectif_alloue: e.target.value }))} />
            </div>
            <div>
              <label className="etiquette-champ">Durée (jours)</label>
              <input type="number" min="1" step="0.5" className="champ-saisie" value={form.duree_jours}
                onChange={(e) => setForm((f) => ({ ...f, duree_jours: e.target.value }))} />
            </div>
            <div>
              <label className="etiquette-champ">Décalage (jours)</label>
              <input type="number" min="0" step="1" className="champ-saisie" value={form.decalage_jours}
                onChange={(e) => setForm((f) => ({ ...f, decalage_jours: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="etiquette-champ">Observations</label>
            <textarea className="champ-saisie min-h-[60px] text-sm" value={form.observations}
              onChange={(e) => setForm((f) => ({ ...f, observations: e.target.value }))} />
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4">
          <div>
            {tache && (
              <button type="button" className="btn-danger text-sm" onClick={supprimer} disabled={envoi}>
                <Trash2 className="h-3.5 w-3.5" /> Supprimer
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn-secondaire text-sm" onClick={onFermer}>Annuler</button>
            <button type="button" className="btn-primaire text-sm" onClick={sauvegarder} disabled={envoi}>
              {envoi ? "…" : tache ? "Modifier" : "Créer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal planification depuis un devis
// ---------------------------------------------------------------------------

const TAUX_HORAIRE_MO = 38; // €/h — BTP moyen 2025
const HEURES_PAR_JOUR = 8;

function ModalDepuisDevis({
  planningId,
  suiviId,
  onFermer,
  onSauvegarde,
}: {
  planningId: string;
  suiviId: string;
  onFermer: () => void;
  onSauvegarde: () => void;
}) {
  const [devisList, setDevisList] = useState<DevisAnalyse[]>([]);
  const [devisChoisi, setDevisChoisi] = useState<string>("");
  const [lignes, setLignes] = useState<LignePrixDevis[]>([]);
  const [chargementLignes, setChargementLignes] = useState(false);
  const [effectif, setEffectif] = useState<Record<string, number>>({});
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ results?: DevisAnalyse[] } | DevisAnalyse[]>(`/api/ressources/devis/?statut=termine`)
      .then((data) => {
        const liste = Array.isArray(data) ? data : (data as { results?: DevisAnalyse[] }).results ?? [];
        setDevisList(liste);
      })
      .catch(() => setErreur("Impossible de charger les devis."));
  }, []);

  useEffect(() => {
    if (!devisChoisi) { setLignes([]); return; }
    setChargementLignes(true);
    api.get<LignePrixDevis[] | { results?: LignePrixDevis[] }>(`/api/ressources/devis/${devisChoisi}/lignes/`)
      .then((data) => {
        const liste = Array.isArray(data) ? data : (data as { results?: LignePrixDevis[] }).results ?? [];
        setLignes(liste);
      })
      .catch(() => setErreur("Impossible de charger les lignes du devis."))
      .finally(() => setChargementLignes(false));
  }, [devisChoisi]);

  // Grouper par corps_etat
  const groupes: Record<string, { code: string; libelle: string; totalMO: number; nbLignes: number }> = {};
  for (const l of lignes) {
    const code = l.corps_etat || "NC";
    if (!groupes[code]) {
      groupes[code] = { code, libelle: l.corps_etat_libelle || code, totalMO: 0, nbLignes: 0 };
    }
    const mo = l.pct_mo_estime != null ? l.prix_ht_original * l.pct_mo_estime : l.prix_ht_original * 0.35;
    groupes[code].totalMO += mo;
    groupes[code].nbLignes += 1;
  }

  const tachesPreview = Object.values(groupes).map((g) => {
    const heures = g.totalMO / TAUX_HORAIRE_MO;
    const eff = effectif[g.code] || 2;
    const duree = Math.max(1, Math.round(heures / eff / HEURES_PAR_JOUR));
    return { code: g.code, designation: g.libelle, duree_jours: duree, effectif: eff, heures: Math.round(heures) };
  });

  const creer = async () => {
    if (!devisChoisi || tachesPreview.length === 0) return;
    setEnvoi(true);
    setErreur(null);
    try {
      let decalage = 0;
      for (const t of tachesPreview) {
        await api.post(`/api/execution/plannings/${planningId}/taches/`, {
          planning: planningId,
          code: t.code,
          designation: t.designation,
          duree_jours: t.duree_jours,
          decalage_jours: decalage,
          effectif_alloue: t.effectif,
        });
        decalage += t.duree_jours;
      }
      onSauvegarde();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Création impossible.");
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onFermer}>
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 shrink-0">
          <div>
            <h2 className="font-semibold text-slate-900 text-sm">Planifier depuis un devis</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Génère des tâches à partir des corps d&apos;état du devis, avec durées estimées depuis les débours MO.
            </p>
          </div>
          <button type="button" onClick={onFermer} className="rounded-lg p-1.5 hover:bg-slate-100">
            <X className="h-4 w-4 text-slate-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {erreur && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{erreur}</div>
          )}

          <div>
            <label className="etiquette-champ">Devis analysé</label>
            <select className="champ-saisie" value={devisChoisi} onChange={(e) => setDevisChoisi(e.target.value)}>
              <option value="">— Sélectionner un devis —</option>
              {devisList.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nom_original} {d.entreprise ? `— ${d.entreprise}` : ""} {d.localite ? `(${d.localite})` : ""}
                </option>
              ))}
            </select>
            {devisList.length === 0 && (
              <p className="text-xs text-slate-400 mt-1">
                Aucun devis terminé.{" "}
                <Link href="/ressources/devis" className="text-indigo-600 hover:underline">Analyser un devis</Link>
              </p>
            )}
          </div>

          {chargementLignes && <p className="text-sm text-slate-400 text-center py-4">Chargement…</p>}

          {tachesPreview.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">
                {tachesPreview.length} tâche(s) à créer
              </p>
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 text-slate-500">
                      <th className="text-left py-2 px-3 font-medium">Corps d&apos;état</th>
                      <th className="text-right py-2 px-3 font-medium">Heures MO</th>
                      <th className="text-right py-2 px-3 font-medium">Effectif</th>
                      <th className="text-right py-2 px-3 font-medium">Durée</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tachesPreview.map((t) => (
                      <tr key={t.code} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="py-2 px-3 text-slate-700 font-medium">{t.designation}</td>
                        <td className="py-2 px-3 text-right font-mono text-slate-500">{t.heures} h</td>
                        <td className="py-2 px-3 text-right">
                          <input
                            type="number"
                            min="1"
                            max="20"
                            className="w-14 rounded-lg border border-slate-200 px-2 py-1 text-right font-mono text-xs text-slate-700"
                            value={effectif[t.code] || 2}
                            onChange={(e) => setEffectif((prev) => ({ ...prev, [t.code]: parseInt(e.target.value) || 1 }))}
                          />
                          <span className="ml-1 text-slate-400">pers.</span>
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-indigo-600">
                          {Math.max(1, Math.round(t.heures / (effectif[t.code] || 2) / HEURES_PAR_JOUR))} j
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-slate-400">
                Taux horaire MO : {TAUX_HORAIRE_MO} €/h · Les tâches seront créées en séquence (décalages cumulés).
                Vous pourrez ajuster les dépendances ensuite.
              </p>
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 px-6 py-4 flex items-center justify-end gap-2 shrink-0">
          <button type="button" className="btn-secondaire text-sm" onClick={onFermer}>Annuler</button>
          <button
            type="button"
            className="btn-primaire text-sm"
            onClick={creer}
            disabled={envoi || tachesPreview.length === 0}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            {envoi ? "Création…" : `Créer ${tachesPreview.length} tâche(s)`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Composant SVG Gantt avec dépendances et clic sur tâche
// ---------------------------------------------------------------------------

const HAUTEUR_LIGNE = 32;
const HAUTEUR_EN_TETE = 36;
const LARGEUR_LIBELLE = 300;

function GanttSvg({
  planning,
  echelle,
  dependances,
  onClickTache,
}: {
  planning: PlanningChantier;
  echelle: EchelleZoom;
  dependances: DependanceTache[];
  onClickTache: (tache: TachePlanning) => void;
}) {
  const dateDebut = planning.date_debut_reference;
  const dureeJours = Math.max(Number(planning.synthese_calcul?.duree_totale_jours || 60), 10);
  const pxJour = LARGEUR_COLONNE_JOUR[echelle];
  const colonnes = genererColonnes(dateDebut, dureeJours, echelle);
  const largeurGrille = colonnes.reduce((s, c) => s + c.largeurPx, 0);
  const hauteurSvg = HAUTEUR_EN_TETE + planning.taches.length * HAUTEUR_LIGNE + 8;

  // Calculer xBarre par tâche pour les flèches de dépendance
  const positionsTaches: Record<string, { x: number; y: number; largeur: number }> = {};
  planning.taches.forEach((tache, idx) => {
    const debut = tache.date_debut_calculee
      ? joursEntreDeuxDates(dateDebut, tache.date_debut_calculee)
      : Number(tache.decalage_jours || 0);
    const duree = Math.max(Number(tache.duree_jours || 1), 1);
    positionsTaches[tache.id] = {
      x: debut * pxJour,
      y: HAUTEUR_EN_TETE + idx * HAUTEUR_LIGNE + HAUTEUR_LIGNE / 2,
      largeur: Math.max(duree * pxJour, 4),
    };
  });

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
            <button
              key={tache.id}
              type="button"
              className={`flex w-full items-center gap-2 border-b border-r border-slate-100 px-3 text-xs text-left hover:bg-indigo-50 transition-colors ${
                idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"
              }`}
              style={{ height: HAUTEUR_LIGNE }}
              onClick={() => onClickTache(tache)}
              title="Cliquer pour modifier"
            >
              <span className="shrink-0 font-mono text-slate-400">#{tache.numero_ordre}</span>
              <span
                className={`truncate font-medium ${tache.est_critique ? "text-rose-700" : "text-slate-700"}`}
                title={tache.designation}
              >
                {tache.designation}
              </span>
              {tache.est_critique && (
                <span className="shrink-0 rounded bg-rose-100 px-1 py-0.5 text-[10px] font-semibold text-rose-600">●</span>
              )}
              <Pencil className="ml-auto shrink-0 h-3 w-3 text-slate-300 group-hover:text-slate-500" />
            </button>
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
                    <rect x={x} y={0} width={col.largeurPx} height={HAUTEUR_EN_TETE}
                      fill={i % 2 === 0 ? "#f8fafc" : "#f1f5f9"} />
                    <line x1={x} y1={0} x2={x} y2={hauteurSvg} stroke="#e2e8f0" strokeWidth={1} />
                    <text x={x + col.largeurPx / 2} y={HAUTEUR_EN_TETE / 2 + 5}
                      textAnchor="middle" fontSize={10} fill="#64748b" fontFamily="system-ui">
                      {col.label}
                    </text>
                  </g>
                );
              });
            })()}

            <line x1={0} y1={HAUTEUR_EN_TETE} x2={largeurGrille} y2={HAUTEUR_EN_TETE}
              stroke="#cbd5e1" strokeWidth={1} />

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
                  <rect x={0} y={y} width={largeurGrille} height={HAUTEUR_LIGNE}
                    fill={idx % 2 === 0 ? "white" : "#f8fafc"} />
                  <rect x={xBarre} y={y + 6} width={largeurBarre} height={HAUTEUR_LIGNE - 12}
                    rx={4} fill={couleur} opacity={0.9} />
                  {Number(tache.marge_libre_jours) > 0 && (
                    <rect x={xBarre + largeurBarre} y={y + 10}
                      width={Number(tache.marge_libre_jours) * pxJour}
                      height={HAUTEUR_LIGNE - 20} rx={3} fill={couleurClaire}
                      stroke={couleur} strokeWidth={1} strokeDasharray="3,2" />
                  )}
                  {largeurBarre > 40 && (
                    <text x={xBarre + largeurBarre / 2} y={y + HAUTEUR_LIGNE / 2 + 4}
                      textAnchor="middle" fontSize={9} fill="white"
                      fontWeight="600" fontFamily="system-ui">
                      {duree}j
                    </text>
                  )}
                  <line x1={0} y1={y + HAUTEUR_LIGNE} x2={largeurGrille} y2={y + HAUTEUR_LIGNE}
                    stroke="#f1f5f9" strokeWidth={1} />
                </g>
              );
            })}

            {/* Flèches de dépendance (FD : fin → début) */}
            <defs>
              <marker id="fleche-dep" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L0,6 L6,3 Z" fill="#94a3b8" />
              </marker>
            </defs>
            {dependances.map((dep) => {
              const amont = positionsTaches[dep.tache_amont];
              const aval = positionsTaches[dep.tache_aval];
              if (!amont || !aval) return null;
              const x1 = dep.type_dependance === "dd" ? amont.x : amont.x + amont.largeur;
              const x2 = dep.type_dependance === "dd" ? aval.x : aval.x;
              const y1 = amont.y;
              const y2 = aval.y;
              const cx = (x1 + x2) / 2;
              return (
                <g key={dep.id}>
                  <path
                    d={`M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`}
                    fill="none"
                    stroke="#94a3b8"
                    strokeWidth={1.5}
                    strokeDasharray={dep.type_dependance === "dd" ? "4,2" : undefined}
                    markerEnd="url(#fleche-dep)"
                  />
                </g>
              );
            })}

            {/* Ligne "aujourd'hui" */}
            {(() => {
              const aujourdhui = new Date();
              const debut = new Date(`${dateDebut}T00:00:00`);
              const joursDiff = Math.round((aujourdhui.getTime() - debut.getTime()) / 86400000);
              if (joursDiff < 0 || joursDiff > dureeJours + 30) return null;
              const xAujourdHui = joursDiff * pxJour;
              return (
                <g>
                  <line x1={xAujourdHui} y1={HAUTEUR_EN_TETE} x2={xAujourdHui} y2={hauteurSvg}
                    stroke="#f59e0b" strokeWidth={2} strokeDasharray="4,3" />
                  <text x={xAujourdHui + 3} y={HAUTEUR_EN_TETE + 12} fontSize={9}
                    fill="#d97706" fontWeight="600" fontFamily="system-ui">
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

  // Modales
  const [tacheEditee, setTacheEditee] = useState<TachePlanning | null | "nouveau">(null);
  const [modalDevisOuvert, setModalDevisOuvert] = useState(false);

  // Dépendances
  const [dependances, setDependances] = useState<DependanceTache[]>([]);

  const charger = useCallback(async () => {
    setChargement(true);
    try {
      const repSuivis = await api.get<{ results: SuiviExecution[] }>(
        `/api/execution/?projet=${projetId}`
      );
      const suivis = repSuivis.results ?? [];
      if (suivis.length === 0) { setChargement(false); return; }
      const s = suivis[0];
      setSuivi(s);
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

  // Charger les dépendances quand le planning actif change
  useEffect(() => {
    if (!planningActifId) { setDependances([]); return; }
    api.get<{ results?: DependanceTache[] } | DependanceTache[]>(
      `/api/execution/plannings/${planningActifId}/dependances/`
    ).then((data) => {
      const liste = Array.isArray(data) ? data : (data as { results?: DependanceTache[] }).results ?? [];
      setDependances(liste);
    }).catch(() => setDependances([]));
  }, [planningActifId]);

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

  const apresEditionTache = async () => {
    setTacheEditee(null);
    await charger();
    // Recharger dépendances aussi
    if (planningActifId) {
      api.get<{ results?: DependanceTache[] } | DependanceTache[]>(
        `/api/execution/plannings/${planningActifId}/dependances/`
      ).then((data) => {
        const liste = Array.isArray(data) ? data : (data as { results?: DependanceTache[] }).results ?? [];
        setDependances(liste);
      }).catch(() => {});
    }
  };

  // ---------------------------------------------------------------------------
  // Rendu
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-5">
      {/* Modales */}
      {tacheEditee !== null && planningActif && (
        <ModalEditionTache
          tache={tacheEditee === "nouveau" ? null : tacheEditee}
          planningId={planningActif.id}
          onFermer={() => setTacheEditee(null)}
          onSauvegarde={apresEditionTache}
        />
      )}
      {modalDevisOuvert && planningActif && suivi && (
        <ModalDepuisDevis
          planningId={planningActif.id}
          suiviId={suivi.id}
          onFermer={() => setModalDevisOuvert(false)}
          onSauvegarde={async () => {
            setModalDevisOuvert(false);
            await charger();
          }}
        />
      )}

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
            Visualisation du chemin critique · Cliquer sur une tâche pour la modifier
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
                onClick={() => setTacheEditee("nouveau")}
                className="btn-secondaire text-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                Tâche
              </button>
              <button
                onClick={() => setModalDevisOuvert(true)}
                className="btn-secondaire text-xs"
              >
                <FileSearch className="w-3.5 h-3.5" />
                Depuis devis
              </button>
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

      {/* Formulaire de création de planning */}
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
                  <p className="text-xs text-slate-500 uppercase tracking-wider">Dépendances</p>
                  <p className="mt-1 text-2xl font-bold text-indigo-600 font-mono">
                    {dependances.length}
                  </p>
                </div>
              </div>

              {/* Légende */}
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-6 rounded bg-indigo-500" /> Tâche planifiée
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-6 rounded bg-rose-500" /> Chemin critique
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-6 rounded border border-dashed border-indigo-400 bg-indigo-100" /> Marge libre
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-0.5 bg-amber-400" /> Aujourd&apos;hui
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-0.5 w-6 bg-slate-400" style={{ borderStyle: "solid" }} /> Dépendance FD
                </span>
                <span className="flex items-center gap-1.5">
                  <Pencil size={11} /> Cliquer sur une tâche pour la modifier
                </span>
              </div>

              {/* Gantt SVG */}
              {planningActif.taches.length === 0 ? (
                <div className="carte py-10 text-center text-sm text-slate-400 space-y-3">
                  <p>Aucune tâche. Ajoutez-en manuellement ou générez depuis un devis.</p>
                  <div className="flex justify-center gap-2">
                    <button className="btn-secondaire text-xs" onClick={() => setTacheEditee("nouveau")}>
                      <Plus className="h-3.5 w-3.5" /> Ajouter une tâche
                    </button>
                    <button className="btn-secondaire text-xs" onClick={() => setModalDevisOuvert(true)}>
                      <FileSearch className="h-3.5 w-3.5" /> Depuis un devis
                    </button>
                  </div>
                </div>
              ) : (
                <GanttSvg
                  planning={planningActif}
                  echelle={echelle}
                  dependances={dependances}
                  onClickTache={(t) => setTacheEditee(t)}
                />
              )}

              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Calendar size={12} />
                <span>
                  Planning «{planningActif.intitule}» · Début de référence :{" "}
                  {new Date(`${planningActif.date_debut_reference}T00:00:00`).toLocaleDateString("fr-FR", {
                    day: "2-digit", month: "long", year: "numeric",
                  })}
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
