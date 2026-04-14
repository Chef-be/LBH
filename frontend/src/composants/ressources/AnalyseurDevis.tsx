"use client";

import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { api, ErreurApi, extraireListeResultats } from "@/crochets/useApi";
import {
  Upload, FileText, CheckCircle2, AlertCircle, Clock,
  RefreshCw, BookOpen, ChevronDown, ChevronRight,
  TrendingUp, BarChart3, Layers, X, ExternalLink,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DevisAnalyse {
  id: string;
  nom_original: string;
  type_document: string;
  entreprise: string;
  localite: string;
  date_emission: string | null;
  indice_base_code: string;
  indice_base_valeur: number | null;
  statut: "en_attente" | "en_cours" | "termine" | "erreur";
  erreur_detail: string;
  capitalise: boolean;
  lignes_count: number;
  date_creation: string;
}

interface LignePrixMarche {
  id: string;
  designation: string;
  unite: string;
  prix_ht_original: number;
  prix_ht_actualise: number | null;
  corps_etat: string;
  corps_etat_libelle: string;
  debourse_sec_estime: number | null;
  kpv_estime: number | null;
  pct_mo_estime: number | null;
  pct_materiaux_estime: number | null;
  pct_materiel_estime: number | null;
  est_ligne_commune: boolean;
  nb_occurrences: number;
  ligne_bibliotheque: string | null;
  sdp: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formaterMontant(v: number | null | undefined): string {
  if (v == null) return "—";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2 }).format(v);
}

function classeKpv(kpv: number): string {
  if (kpv <= 0) return "text-slate-400";
  if (kpv < 1.10) return "text-red-600";
  if (kpv < 1.25) return "text-orange-500";
  if (kpv <= 1.55) return "text-green-600";
  if (kpv <= 2.00) return "text-orange-500";
  return "text-red-600";
}

const STATUT_CONFIG = {
  en_attente: { label: "En attente", icone: Clock, classe: "text-slate-500 bg-slate-100" },
  en_cours: { label: "Analyse en cours…", icone: RefreshCw, classe: "text-blue-600 bg-blue-50" },
  termine: { label: "Terminé", icone: CheckCircle2, classe: "text-green-600 bg-green-50" },
  erreur: { label: "Erreur", icone: AlertCircle, classe: "text-red-600 bg-red-50" },
};

const TYPES_DOCUMENT = [
  { value: "devis", label: "Devis" },
  { value: "dqe", label: "DQE" },
  { value: "bpu", label: "BPU" },
  { value: "dpgf", label: "DPGF" },
  { value: "bon_commande", label: "Bon de commande" },
  { value: "autre", label: "Autre" },
];

const INDICES_DISPONIBLES = ["BT01", "BT02", "BT28", "BT37", "BT50", "BT60", "TP01"];

// ---------------------------------------------------------------------------
// Composant ligne SDP
// ---------------------------------------------------------------------------

function LigneSDP({ ligne }: { ligne: LignePrixMarche }) {
  const [deplie, setDeplie] = useState(false);
  const kpv = ligne.kpv_estime || 0;
  const ds = ligne.debourse_sec_estime || 0;

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center gap-3 px-4 py-3 bg-white hover:bg-slate-50 transition-colors text-left"
        onClick={() => setDeplie(!deplie)}
      >
        {deplie ? <ChevronDown className="h-4 w-4 text-slate-400 flex-shrink-0" /> : <ChevronRight className="h-4 w-4 text-slate-400 flex-shrink-0" />}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-slate-800 text-sm truncate">{ligne.designation}</p>
          <p className="text-xs text-slate-400 mt-0.5">{ligne.corps_etat_libelle || "Corps d'état non identifié"} · {ligne.unite}</p>
        </div>
        <div className="flex items-center gap-4 flex-shrink-0">
          {ligne.est_ligne_commune && (
            <span className="text-xs bg-indigo-100 text-indigo-700 rounded-full px-2 py-0.5">
              Fusion ×{ligne.nb_occurrences}
            </span>
          )}
          {ligne.ligne_bibliotheque && (
            <span className="text-xs bg-green-100 text-green-700 rounded-full px-2 py-0.5 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Capitalisé
            </span>
          )}
          <div className="text-right">
            <p className="font-mono font-bold text-slate-800 text-sm">{formaterMontant(ligne.prix_ht_original)}</p>
            {ligne.prix_ht_actualise && ligne.prix_ht_actualise !== ligne.prix_ht_original && (
              <p className="text-xs text-indigo-600 font-mono">→ {formaterMontant(ligne.prix_ht_actualise)} actualisé</p>
            )}
          </div>
          {kpv > 0 && (
            <span className={clsx("font-mono font-bold text-sm", classeKpv(kpv))}>
              Kpv {kpv.toFixed(2)}
            </span>
          )}
        </div>
      </button>

      {deplie && (
        <div className="border-t border-slate-100 px-4 py-4 bg-slate-50 space-y-3">
          {/* SDP estimé */}
          {ds > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                Sous-Détail de Prix estimé
              </h4>
              <div className="grid grid-cols-4 gap-2 text-xs">
                <div className="bg-white rounded-lg p-2 text-center border border-slate-100">
                  <p className="text-slate-400">DS estimé</p>
                  <p className="font-mono font-bold text-slate-800 mt-0.5">{formaterMontant(ds)}</p>
                </div>
                <div className="bg-white rounded-lg p-2 text-center border border-slate-100">
                  <p className="text-slate-400">MO</p>
                  <p className="font-mono font-bold text-indigo-600 mt-0.5">
                    {ligne.pct_mo_estime?.toFixed(0)}%
                  </p>
                  <p className="text-slate-400 text-xs">{formaterMontant((ds * (ligne.pct_mo_estime || 0)) / 100)}</p>
                </div>
                <div className="bg-white rounded-lg p-2 text-center border border-slate-100">
                  <p className="text-slate-400">Matériaux</p>
                  <p className="font-mono font-bold text-emerald-600 mt-0.5">
                    {ligne.pct_materiaux_estime?.toFixed(0)}%
                  </p>
                  <p className="text-slate-400 text-xs">{formaterMontant((ds * (ligne.pct_materiaux_estime || 0)) / 100)}</p>
                </div>
                <div className="bg-white rounded-lg p-2 text-center border border-slate-100">
                  <p className="text-slate-400">Matériel</p>
                  <p className="font-mono font-bold text-amber-600 mt-0.5">
                    {ligne.pct_materiel_estime?.toFixed(0)}%
                  </p>
                  <p className="text-slate-400 text-xs">{formaterMontant((ds * (ligne.pct_materiel_estime || 0)) / 100)}</p>
                </div>
              </div>

              {/* Barre DS */}
              <div className="mt-2 flex h-2 rounded-full overflow-hidden bg-slate-200">
                <div style={{ width: `${ligne.pct_mo_estime || 0}%`, backgroundColor: "#6366f1" }} title="MO" />
                <div style={{ width: `${ligne.pct_materiaux_estime || 0}%`, backgroundColor: "#10b981" }} title="Matériaux" />
                <div style={{ width: `${ligne.pct_materiel_estime || 0}%`, backgroundColor: "#f59e0b" }} title="Matériel" />
              </div>

              {/* Chaîne DS → PV */}
              <div className="mt-3 space-y-0.5 text-xs">
                {(() => {
                  const fc = ds * 0.10;
                  const fop = ds * 0.015;
                  const cd = ds + fc + fop;
                  const pv = cd / (1 - 0.10 - 0.06);
                  return (
                    <>
                      <div className="flex justify-between text-slate-500 py-0.5">
                        <span>DS + FC (10%) + Fop (1.5%)</span>
                        <span className="font-mono">= CD ≈ {formaterMontant(cd)}</span>
                      </div>
                      <div className="flex justify-between font-bold bg-indigo-600 text-white rounded px-2 py-1">
                        <span>= PV HT estimé</span>
                        <span className="font-mono">{formaterMontant(pv)}</span>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Cohérence Kpv */}
          {kpv > 0 && (
            <div className={clsx(
              "rounded-lg px-3 py-2 text-xs font-medium flex items-center justify-between",
              kpv >= 1.25 && kpv <= 1.55 ? "bg-green-50 text-green-700 border border-green-200" :
              kpv >= 1.10 ? "bg-orange-50 text-orange-700 border border-orange-200" :
              "bg-red-50 text-red-700 border border-red-200"
            )}>
              <span>Kpv = {kpv.toFixed(3)}</span>
              <span>Plage normale bâtiment courant : 1.25 – 1.55</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Composant carte devis
// ---------------------------------------------------------------------------

function CarteDevis({
  devis,
  onSupprimer,
}: {
  devis: DevisAnalyse;
  onSupprimer: (id: string) => void;
}) {
  const queryClient = useQueryClient();
  const config = STATUT_CONFIG[devis.statut];
  const Icone = config.icone;
  const [deplie, setDeplie] = useState(false);
  const [capitalEnCours, setCapitalEnCours] = useState(false);

  const { data: lignesData } = useQuery<LignePrixMarche[]>({
    queryKey: ["devis-lignes", devis.id],
    queryFn: () => api.get(`/api/ressources/devis/${devis.id}/lignes/`),
    enabled: deplie && devis.statut === "termine",
  });
  const lignes: LignePrixMarche[] = Array.isArray(lignesData) ? lignesData : ((lignesData as unknown as { results?: LignePrixMarche[] })?.results ?? []);

  const capitaliser = async () => {
    setCapitalEnCours(true);
    try {
      const res = await api.post<{ capitalise: number; erreurs: string[] }>(
        `/api/ressources/devis/${devis.id}/capitaliser/`, {}
      );
      queryClient.invalidateQueries({ queryKey: ["devis-liste"] });
      queryClient.invalidateQueries({ queryKey: ["devis-lignes", devis.id] });
      alert(`${res.capitalise} ligne(s) capitalisée(s) en bibliothèque.`);
    } catch (e) {
      alert(e instanceof ErreurApi ? e.detail : "Erreur lors de la capitalisation.");
    } finally {
      setCapitalEnCours(false);
    }
  };

  const relancer = async () => {
    try {
      await api.post(`/api/ressources/devis/${devis.id}/relancer/`, {});
      queryClient.invalidateQueries({ queryKey: ["devis-liste"] });
    } catch (e) {
      alert(e instanceof ErreurApi ? e.detail : "Erreur.");
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      {/* En-tête */}
      <div className="flex items-center gap-4 px-5 py-4">
        <FileText className="h-5 w-5 text-slate-400 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-800 truncate">{devis.nom_original}</p>
          <p className="text-xs text-slate-400 mt-0.5">
            {devis.entreprise && <span className="mr-2">{devis.entreprise}</span>}
            {devis.localite && <span className="mr-2">· {devis.localite}</span>}
            {devis.date_emission && <span>· {new Date(devis.date_emission).toLocaleDateString("fr-FR")}</span>}
          </p>
        </div>

        <span className={clsx("flex items-center gap-1.5 text-xs font-medium rounded-full px-2.5 py-1", config.classe)}>
          <Icone className="h-3 w-3" />
          {config.label}
        </span>

        {devis.statut === "termine" && (
          <span className="text-xs text-slate-500">{devis.lignes_count} ligne(s)</span>
        )}

        <div className="flex items-center gap-2 ml-auto">
          {devis.statut === "termine" && !devis.capitalise && (
            <button
              type="button"
              className="btn-primaire text-xs"
              onClick={capitaliser}
              disabled={capitalEnCours}
            >
              <BookOpen className="h-3.5 w-3.5" />
              {capitalEnCours ? "En cours…" : "Capitaliser"}
            </button>
          )}
          {devis.capitalise && (
            <span className="text-xs bg-green-100 text-green-700 rounded-full px-2.5 py-1 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Capitalisé
            </span>
          )}
          {devis.statut === "erreur" && (
            <button type="button" className="btn-secondaire text-xs" onClick={relancer}>
              <RefreshCw className="h-3 w-3" /> Relancer
            </button>
          )}
          {devis.statut === "termine" && devis.lignes_count > 0 && (
            <button
              type="button"
              className="btn-secondaire text-xs"
              onClick={() => setDeplie(!deplie)}
            >
              {deplie ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              Lignes
            </button>
          )}
          <button
            type="button"
            className="rounded p-1 hover:bg-red-50 text-slate-400 hover:text-red-500"
            onClick={() => onSupprimer(devis.id)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Erreur */}
      {devis.statut === "erreur" && devis.erreur_detail && (
        <div className="px-5 pb-3 text-xs text-red-600 bg-red-50 border-t border-red-100 py-2">
          {devis.erreur_detail}
        </div>
      )}

      {/* Lignes extraites */}
      {deplie && lignes.length > 0 && (
        <div className="border-t border-slate-100 px-5 py-4 space-y-2 bg-slate-50">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-700">
              Lignes extraites ({lignes.length})
            </h3>
            <p className="text-xs text-slate-400">
              Indice {devis.indice_base_code} = {devis.indice_base_valeur ?? "?"}
            </p>
          </div>
          {lignes.map((ligne) => (
            <LigneSDP key={ligne.id} ligne={ligne} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Composant principal
// ---------------------------------------------------------------------------

export default function AnalyseurDevis() {
  const queryClient = useQueryClient();
  const [enUpload, setEnUpload] = useState(false);
  const [form, setForm] = useState({
    type_document: "devis",
    entreprise: "",
    localite: "",
    date_emission: "",
    indice_base_code: "BT01",
    indice_base_valeur: "",
  });
  const [erreurUpload, setErreurUpload] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const { data: devisData, isLoading } = useQuery({
    queryKey: ["devis-liste"],
    queryFn: () => api.get("/api/ressources/devis/"),
    refetchInterval: (data) => {
      const liste = Array.isArray(data) ? data : ((data as { results?: DevisAnalyse[] })?.results ?? []);
      return liste.some((d: DevisAnalyse) => d.statut === "en_cours" || d.statut === "en_attente") ? 3000 : false;
    },
  });
  const devisList: DevisAnalyse[] = Array.isArray(devisData)
    ? devisData
    : ((devisData as { results?: DevisAnalyse[] })?.results ?? []);

  const uploaderFichier = useCallback(async (fichier: File) => {
    if (!fichier) return;
    setEnUpload(true);
    setErreurUpload(null);
    const data = new FormData();
    data.append("fichier", fichier);
    Object.entries(form).forEach(([k, v]) => { if (v) data.append(k, v); });
    try {
      await api.post("/api/ressources/devis/", data);
      queryClient.invalidateQueries({ queryKey: ["devis-liste"] });
    } catch (e) {
      setErreurUpload(e instanceof ErreurApi ? e.detail : "Téléversement impossible.");
    } finally {
      setEnUpload(false);
    }
  }, [form, queryClient]);

  const supprimerDevis = async (id: string) => {
    if (!window.confirm("Supprimer ce devis et ses lignes extraites ?")) return;
    try {
      await api.supprimer(`/api/ressources/devis/${id}/`);
      queryClient.invalidateQueries({ queryKey: ["devis-liste"] });
    } catch (e) {
      alert(e instanceof ErreurApi ? e.detail : "Suppression impossible.");
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const fichier = e.dataTransfer.files[0];
    if (fichier) uploaderFichier(fichier);
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 space-y-8">
      {/* En-tête */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Analyser un devis</h1>
        <p className="text-slate-500 text-sm mt-1">
          Téléversez un devis, BPU, DQE ou DPGF pour en extraire les lignes de prix,
          générer les sous-détails analytiques et capitaliser dans la bibliothèque.
        </p>
      </div>

      {/* Formulaire + zone upload */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5">
        <h2 className="font-semibold text-slate-800">Informations du document</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="etiquette-champ">Type de document</label>
            <select
              className="champ-saisie"
              value={form.type_document}
              onChange={(e) => setForm({ ...form, type_document: e.target.value })}
            >
              {TYPES_DOCUMENT.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="etiquette-champ">Entreprise émettrice</label>
            <input
              type="text"
              className="champ-saisie"
              placeholder="ex. Bouygues Construction"
              value={form.entreprise}
              onChange={(e) => setForm({ ...form, entreprise: e.target.value })}
            />
          </div>
          <div>
            <label className="etiquette-champ">Localité / Zone géographique</label>
            <input
              type="text"
              className="champ-saisie"
              placeholder="ex. Paris, Île-de-France, 75"
              value={form.localite}
              onChange={(e) => setForm({ ...form, localite: e.target.value })}
            />
          </div>
          <div>
            <label className="etiquette-champ">Date d&apos;émission</label>
            <input
              type="date"
              className="champ-saisie"
              value={form.date_emission}
              onChange={(e) => setForm({ ...form, date_emission: e.target.value })}
            />
          </div>
          <div>
            <label className="etiquette-champ">Indice BT de référence</label>
            <select
              className="champ-saisie"
              value={form.indice_base_code}
              onChange={(e) => setForm({ ...form, indice_base_code: e.target.value })}
            >
              {INDICES_DISPONIBLES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="etiquette-champ">Valeur de l&apos;indice à la date du devis</label>
            <input
              type="number"
              className="champ-saisie"
              placeholder="ex. 130.5 (laisser vide si inconnue)"
              value={form.indice_base_valeur}
              onChange={(e) => setForm({ ...form, indice_base_valeur: e.target.value })}
            />
          </div>
        </div>

        {/* Zone drag & drop */}
        <div
          className={clsx(
            "border-2 border-dashed rounded-2xl p-10 text-center transition-colors cursor-pointer",
            isDragOver ? "border-indigo-400 bg-indigo-50" : "border-slate-300 hover:border-indigo-300 hover:bg-slate-50"
          )}
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={onDrop}
          onClick={() => document.getElementById("input-fichier-devis")?.click()}
        >
          <input
            id="input-fichier-devis"
            type="file"
            className="hidden"
            accept=".pdf,.xlsx,.xls,.doc,.docx,.csv,.ods"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) uploaderFichier(f); }}
          />
          {enUpload ? (
            <div className="flex flex-col items-center gap-2">
              <RefreshCw className="h-8 w-8 text-indigo-500 animate-spin" />
              <p className="text-sm text-indigo-600 font-medium">Téléversement en cours…</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload className="h-8 w-8 text-slate-400" />
              <p className="text-sm font-medium text-slate-600">
                Glissez-déposez votre fichier ici ou cliquez pour parcourir
              </p>
              <p className="text-xs text-slate-400">PDF, XLSX, XLS, DOC, DOCX, CSV, ODS</p>
            </div>
          )}
        </div>

        {erreurUpload && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {erreurUpload}
          </div>
        )}
      </div>

      {/* Liste des devis */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">
            Devis analysés
            {devisList.length > 0 && (
              <span className="ml-2 text-slate-400 font-normal text-sm">({devisList.length})</span>
            )}
          </h2>
          {devisList.some((d) => d.statut === "en_cours" || d.statut === "en_attente") && (
            <div className="flex items-center gap-1.5 text-xs text-blue-600">
              <RefreshCw className="h-3 w-3 animate-spin" />
              Analyse en cours…
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-slate-400 text-sm">Chargement…</div>
        ) : devisList.length === 0 ? (
          <div className="py-16 text-center border border-dashed border-slate-200 rounded-2xl">
            <FileText className="h-8 w-8 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">Aucun devis analysé — téléversez votre premier document ci-dessus.</p>
          </div>
        ) : (
          devisList.map((devis) => (
            <CarteDevis key={devis.id} devis={devis} onSupprimer={supprimerDevis} />
          ))
        )}
      </div>
    </div>
  );
}
