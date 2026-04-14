"use client";

import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { api, ErreurApi } from "@/crochets/useApi";
import {
  Plus, TrendingUp, LineChart, RefreshCw, Download,
  Upload, FileText, X, Calculator, ChevronDown, ChevronRight, Info,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Indice {
  id: string;
  code: string;
  valeur: number;
  date_publication: string;
  source: string;
}

interface ResultatInsee {
  crees: number;
  ignores: number;
  erreur: string | null;
}

interface ResultatActualisation {
  montant_original_ht: number | null;
  montant_actualise_ht: number | null;
  indice_code: string;
  indice_base_valeur: number | null;
  indice_actuel_valeur: number | null;
  facteur_actualisation: number | null;
  methode: string;
  formule: string;
  entreprise: string;
  date_emission: string;
  texte_extrait: boolean;
}

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const LIBELLES_INDICES: Record<string, string> = {
  BTM:  "BTM — Bâtiment Tous Métiers (agrégé)",
  TPM:  "TPM — Travaux Publics Tous Métiers (agrégé)",
  BT01: "BT01 — Gros œuvre / Bâtiment général",
  BT02: "BT02 — Maçonnerie",
  BT10: "BT10 — Charpente bois",
  BT20: "BT20 — Couverture",
  BT28: "BT28 — Peinture",
  BT37: "BT37 — Menuiserie bois",
  BT40: "BT40 — Serrurerie",
  BT50: "BT50 — Plomberie",
  BT51: "BT51 — CVC / Chauffage",
  BT60: "BT60 — Électricité",
  TP01: "TP01 — Terrassements",
  TP05: "TP05 — Canalisations",
  TP09: "TP09 — Béton hydraulique",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formaterMontant(v: number): string {
  return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
}

function formaterIndice(v: number): string {
  return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 2 }).format(v);
}

function formaterEuro(v: number | null | undefined): string {
  if (v == null) return "—";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(v);
}

// ---------------------------------------------------------------------------
// Composant principal
// ---------------------------------------------------------------------------

export default function GestionIndices() {
  const queryClient = useQueryClient();

  // --- Saisie manuelle d'un indice ---
  const [formVisible, setFormVisible] = useState(false);
  const [form, setForm] = useState({ code: "BT01", valeur: "", date_publication: "", source: "INSEE" });
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);

  // --- Récupération INSEE ---
  const [enRecuperation, setEnRecuperation] = useState(false);
  const [resultatsInsee, setResultatsInsee] = useState<Record<string, ResultatInsee> | null>(null);

  // --- Actualisation montant devis ---
  const [fichierDevis, setFichierDevis] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [indiceActuCode, setIndiceActuCode] = useState("BT01");
  const [indiceActuBase, setIndiceActuBase] = useState("");
  const [methode, setMethode] = useState("ccag");
  const [enCalcul, setEnCalcul] = useState(false);
  const [resultatActu, setResultatActu] = useState<ResultatActualisation | null>(null);
  const [erreurActu, setErreurActu] = useState<string | null>(null);
  const [detailFormuleVisible, setDetailFormuleVisible] = useState(false);

  // --- Données ---
  const { data: courantsData } = useQuery({
    queryKey: ["indices-courants"],
    queryFn: () => api.get("/api/ressources/indices/courants/"),
  });
  const courants: Indice[] = Array.isArray(courantsData) ? courantsData : [];

  const { data: tousData, isLoading } = useQuery({
    queryKey: ["indices-tous"],
    queryFn: () => api.get("/api/ressources/indices/"),
  });
  const tous: Indice[] = Array.isArray(tousData) ? tousData : ((tousData as { results?: Indice[] })?.results ?? []);

  // --- Saisie manuelle ---
  const sauvegarder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.valeur || !form.date_publication) {
      setErreur("Valeur et date sont obligatoires.");
      return;
    }
    setEnvoi(true); setErreur(null);
    try {
      await api.post("/api/ressources/indices/", {
        code: form.code,
        valeur: parseFloat(form.valeur),
        date_publication: form.date_publication,
        source: form.source,
      });
      setSucces("Indice enregistré.");
      setFormVisible(false);
      setForm({ code: "BT01", valeur: "", date_publication: "", source: "INSEE" });
      queryClient.invalidateQueries({ queryKey: ["indices-courants"] });
      queryClient.invalidateQueries({ queryKey: ["indices-tous"] });
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Erreur d'enregistrement.");
    } finally {
      setEnvoi(false);
    }
  };

  // --- Récupération INSEE ---
  const recupererInsee = async () => {
    setEnRecuperation(true);
    setResultatsInsee(null);
    setSucces(null);
    try {
      const res = await api.post<{ detail: string; resultats: Record<string, ResultatInsee> }>(
        "/api/ressources/indices/recuperer-insee/", {}
      );
      setResultatsInsee(res.resultats);
      setSucces(res.detail);
      queryClient.invalidateQueries({ queryKey: ["indices-courants"] });
      queryClient.invalidateQueries({ queryKey: ["indices-tous"] });
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Récupération INSEE impossible.");
    } finally {
      setEnRecuperation(false);
    }
  };

  // --- Actualisation montant ---
  const selectionnerFichier = useCallback((fichier: File) => {
    setFichierDevis(fichier);
    setResultatActu(null);
    setErreurActu(null);
  }, []);

  const calculerActualisation = async () => {
    if (!fichierDevis) return;
    setEnCalcul(true);
    setErreurActu(null);
    setResultatActu(null);
    const data = new FormData();
    data.append("fichier", fichierDevis);
    data.append("indice_code", indiceActuCode);
    data.append("methode", methode);
    if (indiceActuBase) data.append("indice_base_valeur", indiceActuBase);
    try {
      const res = await api.post<ResultatActualisation>("/api/ressources/indices/actualiser-montant/", data);
      setResultatActu(res);
    } catch (e) {
      setErreurActu(e instanceof ErreurApi ? e.detail : "Calcul impossible.");
    } finally {
      setEnCalcul(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) selectionnerFichier(f);
  };

  // Grouper l'historique par code
  const parCode: Record<string, Indice[]> = {};
  for (const indice of tous) {
    if (!parCode[indice.code]) parCode[indice.code] = [];
    parCode[indice.code].push(indice);
  }

  // Indice courant pour l'outil d'actualisation
  const indiceCourant = courants.find((c) => c.code === indiceActuCode);

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 space-y-8">

      {/* En-tête */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Indices BT / TP</h1>
          <p className="text-slate-500 text-sm mt-1">
            Indices publiés par l&apos;INSEE pour l&apos;actualisation et la révision des prix de marché.
            <br />
            Formule CCAG 2021 (art. 10.3) : <span className="font-mono text-slate-700">P = P₀ × [0,15 + 0,85 × (Iₙ / I₀)]</span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            className="btn-secondaire text-sm"
            onClick={recupererInsee}
            disabled={enRecuperation}
          >
            {enRecuperation
              ? <RefreshCw className="h-4 w-4 animate-spin" />
              : <Download className="h-4 w-4" />
            }
            {enRecuperation ? "Récupération…" : "Récupérer depuis l'INSEE"}
          </button>
          <button
            type="button"
            className="btn-primaire text-sm"
            onClick={() => setFormVisible(!formVisible)}
          >
            <Plus className="h-4 w-4" />
            Saisir manuellement
          </button>
        </div>
      </div>

      {/* Messages */}
      {succes && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{succes}</div>
      )}
      {erreur && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erreur}</div>
      )}

      {/* Résultats récupération INSEE */}
      {resultatsInsee && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2">
          <p className="text-sm font-semibold text-slate-700">Détail de la récupération</p>
          <div className="grid grid-cols-5 gap-2">
            {Object.entries(resultatsInsee).map(([code, res]) => (
              <div key={code} className={clsx(
                "rounded-lg px-2 py-1.5 text-center text-xs",
                res.erreur ? "bg-red-50 border border-red-100" :
                res.crees > 0 ? "bg-green-50 border border-green-100" :
                "bg-slate-50 border border-slate-100"
              )}>
                <p className="font-mono font-bold text-slate-700">{code}</p>
                {res.erreur
                  ? <p className="text-red-500 mt-0.5">erreur</p>
                  : <p className={res.crees > 0 ? "text-green-600" : "text-slate-400"}>
                      {res.crees > 0 ? `+${res.crees} valeur${res.crees > 1 ? "s" : ""}` : "à jour"}
                    </p>
                }
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Formulaire saisie manuelle */}
      {formVisible && (
        <form onSubmit={sauvegarder} className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
          <h2 className="font-semibold text-slate-800">Nouveau relevé d&apos;indice</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="etiquette-champ">Code d&apos;indice</label>
              <select className="champ-saisie" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })}>
                {Object.entries(LIBELLES_INDICES).map(([code, lib]) => (
                  <option key={code} value={code}>{lib}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="etiquette-champ">Valeur (base 100 = jan. 2010)</label>
              <input type="number" step="0.01" className="champ-saisie" placeholder="ex. 133.7"
                value={form.valeur} onChange={(e) => setForm({ ...form, valeur: e.target.value })} />
            </div>
            <div>
              <label className="etiquette-champ">Date de publication</label>
              <input type="date" className="champ-saisie"
                value={form.date_publication} onChange={(e) => setForm({ ...form, date_publication: e.target.value })} />
            </div>
            <div>
              <label className="etiquette-champ">Source</label>
              <input type="text" className="champ-saisie"
                value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-3">
            <button type="submit" className="btn-primaire text-sm" disabled={envoi}>
              {envoi && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
              Enregistrer
            </button>
            <button type="button" className="btn-secondaire text-sm" onClick={() => setFormVisible(false)}>Annuler</button>
          </div>
        </form>
      )}

      {/* Valeurs courantes */}
      {courants.length > 0 && (
        <div>
          <h2 className="font-semibold text-slate-800 mb-3">Valeurs courantes</h2>
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-5 lg:grid-cols-6">
            {courants.map((indice) => (
              <div key={indice.id} className="rounded-xl border border-slate-200 bg-white p-3 text-center">
                <p className="font-mono font-bold text-indigo-600 text-sm">{indice.code}</p>
                <p className="text-xl font-bold text-slate-800 mt-1">{formaterIndice(indice.valeur)}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {new Date(indice.date_publication).toLocaleDateString("fr-FR", { month: "short", year: "numeric" })}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Outil d'actualisation d'un montant de devis                         */}
      {/* ------------------------------------------------------------------ */}
      <div className="rounded-2xl border border-indigo-100 bg-white overflow-hidden">
        <div className="px-6 py-4 bg-indigo-50 border-b border-indigo-100 flex items-center gap-2">
          <Calculator className="h-5 w-5 text-indigo-500" />
          <h2 className="font-semibold text-indigo-800">Actualiser le montant d&apos;un devis</h2>
          <span className="text-xs text-indigo-500 ml-1">Téléversez un PDF — le montant total HT est extrait et recalculé avec l&apos;indice courant</span>
        </div>

        <div className="p-6 space-y-5">
          {/* Paramètres */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="etiquette-champ">Indice de révision</label>
              <select className="champ-saisie" value={indiceActuCode} onChange={(e) => setIndiceActuCode(e.target.value)}>
                {Object.entries(LIBELLES_INDICES).map(([code, lib]) => (
                  <option key={code} value={code}>{lib}</option>
                ))}
              </select>
              {indiceCourant && (
                <p className="text-xs text-indigo-600 mt-1 font-mono">
                  Valeur courante : {formaterIndice(indiceCourant.valeur)} ({new Date(indiceCourant.date_publication).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })})
                </p>
              )}
            </div>
            <div>
              <label className="etiquette-champ">Valeur de l&apos;indice à la date du devis</label>
              <input type="number" step="0.01" className="champ-saisie" placeholder="ex. 124.5 (laissez vide si inconnue)"
                value={indiceActuBase} onChange={(e) => setIndiceActuBase(e.target.value)} />
            </div>
            <div>
              <label className="etiquette-champ">Méthode de calcul</label>
              <select className="champ-saisie" value={methode} onChange={(e) => setMethode(e.target.value)}>
                <option value="ccag">CCAG 2021 — P₀ × [0,15 + 0,85 × (Iₙ/I₀)]</option>
                <option value="lineaire">Révision linéaire — P₀ × (Iₙ/I₀)</option>
              </select>
            </div>
          </div>

          {/* Zone upload */}
          {!fichierDevis ? (
            <div
              className={clsx(
                "border-2 border-dashed rounded-2xl p-8 text-center transition-colors cursor-pointer",
                isDragOver ? "border-indigo-400 bg-indigo-50" : "border-slate-300 hover:border-indigo-300 hover:bg-slate-50"
              )}
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={onDrop}
              onClick={() => document.getElementById("input-devis-actualiser")?.click()}
            >
              <input id="input-devis-actualiser" type="file" className="hidden" accept=".pdf"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) selectionnerFichier(f); }} />
              <Upload className="h-7 w-7 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-600">Glissez-déposez un PDF de devis ou cliquez</p>
              <p className="text-xs text-slate-400 mt-1">Le montant total HT est extrait automatiquement</p>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <FileText className="h-5 w-5 text-slate-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{fichierDevis.name}</p>
                <p className="text-xs text-slate-400">{(fichierDevis.size / 1024).toFixed(0)} Ko</p>
              </div>
              <button type="button" onClick={() => { setFichierDevis(null); setResultatActu(null); }}
                className="rounded p-1 hover:bg-slate-200 text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {erreurActu && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erreurActu}</div>
          )}

          {/* Bouton calcul */}
          {fichierDevis && !resultatActu && (
            <div className="flex justify-end">
              <button type="button" className="btn-primaire" onClick={calculerActualisation} disabled={enCalcul}>
                {enCalcul ? <><RefreshCw className="h-4 w-4 animate-spin" />Analyse en cours…</> : <><Calculator className="h-4 w-4" />Calculer le montant actualisé</>}
              </button>
            </div>
          )}

          {/* Résultat */}
          {resultatActu && (
            <div className="space-y-4">
              {/* Métadonnées détectées */}
              {(resultatActu.entreprise || resultatActu.date_emission) && (
                <div className="flex items-center gap-3 text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
                  <Info className="h-3.5 w-3.5 flex-shrink-0" />
                  {resultatActu.entreprise && <span>Entreprise : <span className="text-slate-700 font-medium">{resultatActu.entreprise}</span></span>}
                  {resultatActu.date_emission && <span>· Date : <span className="text-slate-700 font-medium">{new Date(resultatActu.date_emission).toLocaleDateString("fr-FR")}</span></span>}
                  {!resultatActu.texte_extrait && <span className="text-orange-500">— Texte non extrait (PDF scanné ?)</span>}
                </div>
              )}

              {/* Tableau de résultats */}
              {resultatActu.montant_original_ht !== null ? (
                <div className="rounded-2xl border border-slate-200 overflow-hidden">
                  <div className="grid grid-cols-3 divide-x divide-slate-100">
                    <div className="p-5 text-center">
                      <p className="text-xs text-slate-400 uppercase tracking-wide">Montant original HT</p>
                      <p className="text-2xl font-bold text-slate-700 mt-2 font-mono">
                        {formaterEuro(resultatActu.montant_original_ht)}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        Indice {resultatActu.indice_code} = {resultatActu.indice_base_valeur ? formaterIndice(resultatActu.indice_base_valeur) : "non renseigné"}
                      </p>
                    </div>
                    <div className="p-5 text-center bg-slate-50">
                      <p className="text-xs text-slate-400 uppercase tracking-wide">Facteur</p>
                      <p className={clsx("text-2xl font-bold mt-2 font-mono",
                        resultatActu.facteur_actualisation
                          ? resultatActu.facteur_actualisation > 1 ? "text-orange-600" : "text-green-600"
                          : "text-slate-400"
                      )}>
                        {resultatActu.facteur_actualisation ? `× ${resultatActu.facteur_actualisation.toFixed(4)}` : "—"}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        Indice actuel {resultatActu.indice_actuel_valeur ? formaterIndice(resultatActu.indice_actuel_valeur) : "—"}
                      </p>
                    </div>
                    <div className="p-5 text-center bg-indigo-50">
                      <p className="text-xs text-indigo-400 uppercase tracking-wide">Montant actualisé HT</p>
                      <p className="text-2xl font-bold text-indigo-700 mt-2 font-mono">
                        {resultatActu.montant_actualise_ht !== null ? formaterEuro(resultatActu.montant_actualise_ht) : "—"}
                      </p>
                      {resultatActu.montant_actualise_ht && resultatActu.montant_original_ht && (
                        <p className={clsx("text-xs font-medium mt-1",
                          resultatActu.montant_actualise_ht > resultatActu.montant_original_ht ? "text-orange-600" : "text-green-600"
                        )}>
                          {resultatActu.montant_actualise_ht > resultatActu.montant_original_ht ? "+" : ""}
                          {formaterEuro(resultatActu.montant_actualise_ht - resultatActu.montant_original_ht)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Détail formule */}
                  {resultatActu.formule && (
                    <div className="border-t border-slate-100">
                      <button
                        type="button"
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-slate-500 hover:bg-slate-50"
                        onClick={() => setDetailFormuleVisible(!detailFormuleVisible)}
                      >
                        {detailFormuleVisible ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        Détail du calcul
                      </button>
                      {detailFormuleVisible && (
                        <div className="px-4 pb-3 font-mono text-xs text-slate-600 bg-slate-50">
                          {resultatActu.formule}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-700">
                  Montant total non détecté dans le document.
                  {!resultatActu.indice_base_valeur && " Renseignez l'indice de base pour obtenir le facteur d'actualisation."}
                </div>
              )}

              <div className="flex justify-end">
                <button type="button" className="btn-secondaire text-sm"
                  onClick={() => { setFichierDevis(null); setResultatActu(null); }}>
                  Analyser un autre devis
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Historique par code */}
      {isLoading ? (
        <div className="py-12 text-center text-slate-400 text-sm">Chargement…</div>
      ) : Object.keys(parCode).length === 0 ? (
        <div className="py-16 text-center border border-dashed border-slate-200 rounded-2xl">
          <LineChart className="h-8 w-8 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Aucun indice enregistré — cliquez sur « Récupérer depuis l&apos;INSEE ».</p>
        </div>
      ) : (
        <div className="space-y-4">
          <h2 className="font-semibold text-slate-800">Historique</h2>
          {Object.entries(parCode).map(([code, indices]) => (
            <div key={code} className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-indigo-500" />
                <span className="font-mono font-bold text-indigo-600 text-sm">{code}</span>
                <span className="text-xs text-slate-400">{LIBELLES_INDICES[code]?.split(" — ")[1] || ""}</span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-50 text-xs text-slate-400">
                    <th className="text-left py-2 px-4 font-medium">Date de publication</th>
                    <th className="text-right py-2 px-4 font-medium">Valeur</th>
                    <th className="text-right py-2 px-4 font-medium">Variation</th>
                    <th className="text-left py-2 px-4 font-medium">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {indices.map((indice, i) => {
                    const precedent = indices[i + 1];
                    const variation = precedent ? ((indice.valeur - precedent.valeur) / precedent.valeur) * 100 : null;
                    return (
                      <tr key={indice.id} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="py-2 px-4 text-slate-600">
                          {new Date(indice.date_publication).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
                        </td>
                        <td className="py-2 px-4 text-right font-mono font-bold text-slate-800">
                          {formaterIndice(indice.valeur)}
                        </td>
                        <td className="py-2 px-4 text-right text-xs">
                          {variation !== null ? (
                            <span className={variation >= 0 ? "text-orange-500" : "text-green-600"}>
                              {variation >= 0 ? "+" : ""}{variation.toFixed(2)} %
                            </span>
                          ) : "—"}
                        </td>
                        <td className="py-2 px-4 text-xs text-slate-400">{indice.source}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
