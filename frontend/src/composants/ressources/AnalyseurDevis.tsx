"use client";

import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { api, ErreurApi, extraireListeResultats } from "@/crochets/useApi";
import { useNotifications } from "@/contextes/FournisseurNotifications";
import { ModalConfirmation } from "@/composants/ui/ModalConfirmation";
import {
  Upload, FileText, CheckCircle2, AlertCircle, Clock,
  RefreshCw, BookOpen, ChevronDown, ChevronRight,
  X, Sparkles, Send, Eye, TableProperties, AlertTriangle,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MetadonneesPrevisualisation {
  entreprise: string;
  localite: string;
  date_emission: string;
  type_document: string;
  indice_base_code: string;
}

interface DevisAnalyse {
  id: string;
  nom_original: string;
  type_document: string;
  entreprise: string;
  localite: string;
  date_emission: string | null;
  indice_base_code: string;
  indice_base_valeur: number | null;
  statut: "en_attente" | "en_cours" | "termine" | "a_verifier" | "erreur";
  erreur_detail: string;
  capitalise: boolean;
  lignes_count: number;
  nb_lignes_detectees: number;
  nb_lignes_rejetees: number;
  nb_lignes_a_verifier: number;
  score_qualite_extraction: number | string;
  methode_extraction: string;
  message_analyse: string;
  texte_extrait_apercu: string;
  donnees_extraction: Record<string, unknown>;
  date_creation: string;
}

interface LignePrixMarche {
  id: string;
  ordre: number;
  numero: string;
  designation: string;
  designation_originale: string;
  unite: string;
  quantite: number | null;
  prix_ht_original: number;
  prix_ht_actualise: number | null;
  montant_ht: number | null;
  montant_recalcule_ht: number | null;
  ecart_montant_ht: number | null;
  type_ligne: string;
  statut_controle: "ok" | "alerte" | "erreur" | "ignoree" | "corrigee";
  score_confiance: number | string;
  corrections_proposees: string[];
  donnees_import: {
    fragments_supprimes?: string[];
    nettoyage_designation?: boolean;
    designation_originale?: string;
    chapitre?: string;
    capitalisable?: boolean;
    [key: string]: unknown;
  };
  decision_import: string;
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
}

interface DiagnosticExtraction {
  message_analyse: string;
  methode_extraction: string;
  nb_lignes_detectees: number;
  nb_lignes_rejetees: number;
  nb_lignes_a_verifier: number;
  score_qualite_extraction: number | string;
  texte_extrait_apercu: string;
  donnees_extraction: Record<string, unknown>;
}

interface TableauMappingPrix {
  id: string;
  libelle: string;
  lignes: string[][];
  nb_lignes: number;
  nb_colonnes: number;
}

interface PreparationMappingPrix {
  texte_extrait: string;
  tableaux: TableauMappingPrix[];
  colonnes_candidates: Record<string, { index: number; libelle: string }>;
  champs_mapping: string[];
  separateurs_description: string[];
  apercu_structure: Record<string, unknown>;
}

interface LignePreviewMappingPrix {
  ordre: number;
  numero: string;
  chapitre: string;
  designation: string;
  description: string;
  unite: string;
  quantite: string | number | null;
  prix_unitaire_ht: string | number | null;
  montant_ht: string | number | null;
  montant_recalcule_ht: string | number | null;
  ecart_montant_ht: string | number | null;
  type_ligne: string;
  statut_controle: "ok" | "alerte" | "erreur" | "ignoree" | "corrigee";
  statut: string;
  capitalisable: boolean;
  alertes: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function nombreDecimal(v: number | string | null | undefined): number {
  if (v == null || v === "") return 0;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function formaterMontant(v: number | string | null | undefined): string {
  if (v == null) return "—";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2 }).format(nombreDecimal(v));
}

function fragmentsSupprimes(ligne: LignePrixMarche): string[] {
  const fragments = ligne.donnees_import?.fragments_supprimes;
  return Array.isArray(fragments) ? fragments.map(String).filter(Boolean) : [];
}

function ligneCapitalisable(ligne: LignePrixMarche): boolean {
  return ligne.type_ligne === "article"
    && !["erreur", "ignoree"].includes(ligne.statut_controle)
    && Boolean(ligne.designation && ligne.unite)
    && nombreDecimal(ligne.prix_ht_original) > 0
    && nombreDecimal(ligne.score_confiance) >= 0.55
    && ligne.donnees_import?.capitalisable !== false;
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
  a_verifier: { label: "À vérifier", icone: AlertTriangle, classe: "text-orange-700 bg-orange-50" },
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

const INDICES_DISPONIBLES = ["BTM", "TPM", "BT01", "BT02", "BT10", "BT20", "BT28", "BT37", "BT40", "BT50", "BT51", "BT60", "TP01", "TP05", "TP09"];

// ---------------------------------------------------------------------------
// Composant ligne SDP
// ---------------------------------------------------------------------------

function LigneSDP({ ligne }: { ligne: LignePrixMarche }) {
  const [deplie, setDeplie] = useState(false);
  const kpv = nombreDecimal(ligne.kpv_estime);
  const ds = nombreDecimal(ligne.debourse_sec_estime);
  const pctMo = nombreDecimal(ligne.pct_mo_estime);
  const pctMateriaux = nombreDecimal(ligne.pct_materiaux_estime);
  const pctMateriel = nombreDecimal(ligne.pct_materiel_estime);
  const fragments = fragmentsSupprimes(ligne);
  const nettoyageDesignation = Boolean(ligne.donnees_import?.nettoyage_designation || fragments.length > 0);
  const designationOriginale = ligne.designation_originale || String(ligne.donnees_import?.designation_originale || "");
  const chapitre = typeof ligne.donnees_import?.chapitre === "string" ? ligne.donnees_import.chapitre : "";
  const capitalisable = ligneCapitalisable(ligne);

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
          <p className="text-xs text-slate-400 mt-0.5">
            {ligne.numero && <span className="mr-1">{ligne.numero}</span>}
            {chapitre && <span className="mr-1">{chapitre} ·</span>}
            {ligne.corps_etat_libelle || "Corps d'état non identifié"} · {ligne.unite}
            {ligne.quantite != null && <span> · Qté {Number(ligne.quantite).toLocaleString("fr-FR")}</span>}
          </p>
        </div>
        <div className="flex items-center gap-4 flex-shrink-0">
          {ligne.est_ligne_commune && (
            <span className="text-xs bg-indigo-100 text-indigo-700 rounded-full px-2 py-0.5">
              Fusion ×{ligne.nb_occurrences}
            </span>
          )}
          {ligne.statut_controle === "alerte" && (
            <span className="text-xs bg-orange-100 text-orange-700 rounded-full px-2 py-0.5">
              À vérifier
            </span>
          )}
          {!capitalisable && !ligne.ligne_bibliotheque && (
            <span className="text-xs bg-slate-100 text-slate-700 rounded-full px-2 py-0.5">
              Non capitalisable
            </span>
          )}
          {nettoyageDesignation && (
            <span className="text-xs bg-sky-100 text-sky-700 rounded-full px-2 py-0.5">
              Libellé nettoyé
            </span>
          )}
          {chapitre && (
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
              <span className="font-medium">Chapitre :</span> {chapitre}
            </div>
          )}
          {ligne.ligne_bibliotheque && (
            <span className="text-xs bg-green-100 text-green-700 rounded-full px-2 py-0.5 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Capitalisé
            </span>
          )}
          <div className="text-right">
            <p className="font-mono font-bold text-slate-800 text-sm">{formaterMontant(ligne.prix_ht_original)}</p>
            {ligne.montant_ht != null && (
              <p className="text-xs text-slate-400 font-mono">Total {formaterMontant(ligne.montant_ht)}</p>
            )}
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
          {nettoyageDesignation && (
            <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
              <p className="font-semibold">Des fragments numériques ont été retirés automatiquement.</p>
              {designationOriginale && designationOriginale !== ligne.designation && (
                <p className="mt-1"><span className="font-medium">Libellé original :</span> {designationOriginale}</p>
              )}
              {fragments.length > 0 && (
                <p className="mt-1"><span className="font-medium">Fragments retirés :</span> {fragments.join(" ")}</p>
              )}
            </div>
          )}
          {ligne.statut_controle !== "ok" && (
            <div className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-800">
              Ligne à vérifier
              {ligne.ecart_montant_ht != null && ligne.ecart_montant_ht > 0 && (
                <span> · écart calculé {formaterMontant(ligne.ecart_montant_ht)}</span>
              )}
              {ligne.corrections_proposees.length > 0 && (
                <span> · {ligne.corrections_proposees.join(" ")}</span>
              )}
            </div>
          )}
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
                  <p className="font-mono font-bold text-indigo-600 mt-0.5">{pctMo.toFixed(0)}%</p>
                  <p className="text-slate-400 text-xs">{formaterMontant((ds * pctMo) / 100)}</p>
                </div>
                <div className="bg-white rounded-lg p-2 text-center border border-slate-100">
                  <p className="text-slate-400">Matériaux</p>
                  <p className="font-mono font-bold text-emerald-600 mt-0.5">{pctMateriaux.toFixed(0)}%</p>
                  <p className="text-slate-400 text-xs">{formaterMontant((ds * pctMateriaux) / 100)}</p>
                </div>
                <div className="bg-white rounded-lg p-2 text-center border border-slate-100">
                  <p className="text-slate-400">Matériel</p>
                  <p className="font-mono font-bold text-amber-600 mt-0.5">{pctMateriel.toFixed(0)}%</p>
                  <p className="text-slate-400 text-xs">{formaterMontant((ds * pctMateriel) / 100)}</p>
                </div>
              </div>
              <div className="mt-2 flex h-2 rounded-full overflow-hidden bg-slate-200">
                <div style={{ width: `${pctMo}%`, backgroundColor: "#6366f1" }} title="MO" />
                <div style={{ width: `${pctMateriaux}%`, backgroundColor: "#10b981" }} title="Matériaux" />
                <div style={{ width: `${pctMateriel}%`, backgroundColor: "#f59e0b" }} title="Matériel" />
              </div>
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

function ModalMappingDocumentPrix({
  devis,
  modeInitial,
  onFermer,
}: {
  devis: DevisAnalyse;
  modeInitial: "texte" | "mapping";
  onFermer: () => void;
}) {
  const queryClient = useQueryClient();
  const notifications = useNotifications();
  const [etape, setEtape] = useState(modeInitial === "texte" ? 1 : 2);
  const [tableauId, setTableauId] = useState("texte_extrait");
  const [texteMapping, setTexteMapping] = useState("");
  const [colonnes, setColonnes] = useState<Record<string, number | "">>({
    numero: 0,
    chapitre: "",
    sous_chapitre: "",
    designation: 1,
    description: "",
    unite: 2,
    quantite: 3,
    prix_unitaire_ht: 4,
    montant_ht: 5,
    total_ht: "",
    lot: "",
    corps_etat: "",
    observation: "",
    ignorer: "",
  });
  const [regles, setRegles] = useState({
    premiere_ligne: 2,
    derniere_ligne: 0,
    ignorer_entetes: true,
    ignorer_sous_totaux: true,
    ignorer_totaux: true,
    fusionner_lignes_multilignes: true,
    utiliser_ligne_precedente_comme_chapitre: true,
    cellules_vides_continuation_designation: true,
    separateur_description: "",
  });
  const [preview, setPreview] = useState<{ lignes: LignePreviewMappingPrix[]; resume: Record<string, number> } | null>(null);
  const [chargementAction, setChargementAction] = useState(false);
  const [nomModele, setNomModele] = useState("");

  const { data: preparation, isLoading } = useQuery<PreparationMappingPrix>({
    queryKey: ["devis-mapping-preparer", devis.id],
    queryFn: () => api.get(`/api/ressources/devis/${devis.id}/mapping/preparer/`),
  });

  const tableaux = preparation?.tableaux ?? [];
  const tableauActif = tableaux.find((tableau) => tableau.id === tableauId) ?? tableaux[0];
  const nbColonnes = Math.max(10, tableauActif?.nb_colonnes ?? 10);
  const optionsColonnes = Array.from({ length: nbColonnes }, (_, index) => index);
  const libellesChamps: Record<string, string> = {
    numero: "Numéro de prix",
    chapitre: "Chapitre",
    sous_chapitre: "Sous-chapitre",
    designation: "Désignation",
    description: "Description",
    unite: "Unité",
    quantite: "Quantité",
    prix_unitaire_ht: "Prix unitaire HT",
    montant_ht: "Montant HT",
    total_ht: "Total HT",
    lot: "Lot",
    corps_etat: "Corps d’état",
    observation: "Observation",
    ignorer: "Ligne à ignorer",
  };

  const mappingPayload = () => ({
    tableau_id: tableauActif?.id ?? "texte_extrait",
    texte: texteMapping,
    colonnes,
    regles,
  });

  const previsualiser = async () => {
    setChargementAction(true);
    try {
      const resultat = await api.post<{ lignes: LignePreviewMappingPrix[]; resume: Record<string, number> }>(
        `/api/ressources/devis/${devis.id}/mapping/previsualiser/`,
        mappingPayload()
      );
      setPreview(resultat);
      setEtape(4);
      notifications.info(`${resultat.resume.total ?? 0} ligne(s) prévisualisée(s).`);
    } catch (e) {
      notifications.erreur(e instanceof ErreurApi ? e.detail : "Prévisualisation du mapping impossible.");
    } finally {
      setChargementAction(false);
    }
  };

  const validerImport = async () => {
    setChargementAction(true);
    try {
      const resultat = await api.post<{ lignes_importees: number }>(
        `/api/ressources/devis/${devis.id}/mapping/valider/`,
        { mapping: mappingPayload(), options: { importer_corrigees: true, ignorer_non_capitalisables: true } }
      );
      queryClient.invalidateQueries({ queryKey: ["devis-liste"] });
      queryClient.invalidateQueries({ queryKey: ["devis-lignes", devis.id] });
      notifications.succes(`${resultat.lignes_importees} ligne(s) importée(s) par mapping assisté.`);
      onFermer();
    } catch (e) {
      notifications.erreur(e instanceof ErreurApi ? e.detail : "Validation du mapping impossible.");
    } finally {
      setChargementAction(false);
    }
  };

  const sauvegarderModele = async () => {
    if (!nomModele.trim()) {
      notifications.erreur("Indiquez un nom de modèle.");
      return;
    }
    setChargementAction(true);
    try {
      await api.post(`/api/ressources/devis/${devis.id}/mapping/sauvegarder-modele/`, {
        nom: nomModele,
        type_document: devis.type_document,
        entreprise_source: devis.entreprise,
        colonnes,
        regles,
      });
      notifications.succes("Modèle de mapping sauvegardé.");
    } catch (e) {
      notifications.erreur(e instanceof ErreurApi ? e.detail : "Sauvegarde du modèle impossible.");
    } finally {
      setChargementAction(false);
    }
  };

  const badgePreview = (ligne: LignePreviewMappingPrix) => {
    if (ligne.statut_controle === "ignoree") return "bg-slate-700 text-slate-200 border-slate-600";
    if (ligne.capitalisable) return "bg-emerald-500/15 text-emerald-200 border-emerald-500/30";
    if (ligne.statut_controle === "alerte") return "bg-orange-500/15 text-orange-200 border-orange-500/30";
    return "bg-red-500/15 text-red-200 border-red-500/30";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-6xl max-h-[92vh] overflow-hidden rounded-2xl border border-[var(--bordure)] bg-[var(--fond-carte)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--bordure)] px-6 py-4">
          <div>
            <h3 className="text-base font-semibold text-[var(--texte-principal)]">Mapping manuel assisté</h3>
            <p className="text-xs text-[var(--texte-secondaire)] mt-0.5">{devis.nom_original}</p>
          </div>
          <button type="button" className="rounded p-1 text-[var(--texte-secondaire)] hover:bg-white/10 hover:text-[var(--texte-principal)]" onClick={onFermer} aria-label="Fermer">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-[var(--bordure)] px-6 py-3">
          {["Source", "Colonnes", "Règles", "Prévisualisation", "Validation"].map((label, index) => (
            <button
              key={label}
              type="button"
              className={clsx(
                "rounded-full border px-3 py-1.5 text-xs font-medium",
                etape === index + 1 ? "border-indigo-400 bg-indigo-500/20 text-indigo-100" : "border-[var(--bordure)] text-[var(--texte-secondaire)] hover:bg-white/5"
              )}
              onClick={() => setEtape(index + 1)}
            >
              {index + 1}. {label}
            </button>
          ))}
        </div>

        <div className="max-h-[68vh] overflow-y-auto px-6 py-5 text-[var(--texte-principal)]">
          {isLoading ? (
            <div className="py-12 text-center text-sm text-[var(--texte-secondaire)]">Préparation du mapping…</div>
          ) : etape === 1 ? (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-[var(--bordure)] bg-[var(--fond-entree)] p-3">
                  <p className="text-xs text-[var(--texte-secondaire)]">Tableaux détectés</p>
                  <p className="mt-1 font-mono text-xl font-bold">{tableaux.length}</p>
                </div>
                <div className="rounded-xl border border-[var(--bordure)] bg-[var(--fond-entree)] p-3">
                  <p className="text-xs text-[var(--texte-secondaire)]">Méthode</p>
                  <p className="mt-1 text-sm font-medium">{String(preparation?.apercu_structure?.methode_extraction || devis.methode_extraction || "Non renseignée")}</p>
                </div>
                <div className="rounded-xl border border-[var(--bordure)] bg-[var(--fond-entree)] p-3">
                  <p className="text-xs text-[var(--texte-secondaire)]">Score extraction</p>
                  <p className="mt-1 font-mono text-xl font-bold">{String(preparation?.apercu_structure?.score_qualite_extraction || devis.score_qualite_extraction || 0)}%</p>
                </div>
              </div>
              <div>
                <label className="etiquette-champ">Source à mapper</label>
                <select className="champ-saisie" value={tableauActif?.id ?? tableauId} onChange={(e) => setTableauId(e.target.value)}>
                  {tableaux.map((tableau) => (
                    <option key={tableau.id} value={tableau.id}>{tableau.libelle} · {tableau.nb_lignes} ligne(s)</option>
                  ))}
                </select>
              </div>
              <pre className="min-h-72 max-h-96 overflow-auto whitespace-pre-wrap rounded-xl border border-[var(--bordure)] bg-slate-950 p-4 text-xs leading-relaxed text-slate-100">
                {tableauActif ? tableauActif.lignes.slice(0, 25).map((ligne) => ligne.join(" | ")).join("\n") : preparation?.texte_extrait || "Aucun aperçu texte disponible."}
              </pre>
              <textarea
                className="champ-saisie min-h-28 font-mono text-xs"
                placeholder="Optionnel : collez ici un tableau corrigé. Si ce champ est rempli, il devient la source du mapping."
                value={texteMapping}
                onChange={(e) => setTexteMapping(e.target.value)}
              />
            </div>
          ) : etape === 2 ? (
            <div className="grid gap-3 md:grid-cols-4">
              {Object.keys(colonnes).map((champ) => (
                <div key={champ}>
                  <label className="etiquette-champ">{libellesChamps[champ] ?? champ}</label>
                  <select
                    className="champ-saisie"
                    value={colonnes[champ]}
                    onChange={(e) => setColonnes((c) => ({ ...c, [champ]: e.target.value === "" ? "" : Number(e.target.value) }))}
                  >
                    <option value="">Non mappé</option>
                    {optionsColonnes.map((option) => <option key={option} value={option}>Col. {String.fromCharCode(65 + option)}</option>)}
                  </select>
                </div>
              ))}
            </div>
          ) : etape === 3 ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-[var(--bordure)] bg-[var(--fond-entree)] p-4 space-y-3">
                <h4 className="text-sm font-semibold">Bornes de lecture</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="etiquette-champ">Première ligne de données</label>
                    <input className="champ-saisie" type="number" min={1} value={regles.premiere_ligne} onChange={(e) => setRegles((r) => ({ ...r, premiere_ligne: Number(e.target.value) || 1 }))} />
                  </div>
                  <div>
                    <label className="etiquette-champ">Dernière ligne</label>
                    <input className="champ-saisie" type="number" min={0} value={regles.derniere_ligne} onChange={(e) => setRegles((r) => ({ ...r, derniere_ligne: Number(e.target.value) || 0 }))} />
                  </div>
                </div>
                <div>
                  <label className="etiquette-champ">Séparer description à partir de</label>
                  <select className="champ-saisie" value={regles.separateur_description} onChange={(e) => setRegles((r) => ({ ...r, separateur_description: e.target.value }))}>
                    <option value="">Détection automatique</option>
                    {(preparation?.separateurs_description ?? []).map((sep) => <option key={sep} value={sep}>{sep}</option>)}
                  </select>
                </div>
              </div>
              <div className="rounded-xl border border-[var(--bordure)] bg-[var(--fond-entree)] p-4 space-y-2">
                <h4 className="text-sm font-semibold">Règles de nettoyage</h4>
                {[
                  ["ignorer_entetes", "Ignorer les lignes d’en-tête"],
                  ["ignorer_sous_totaux", "Ignorer les sous-totaux"],
                  ["ignorer_totaux", "Ignorer les totaux généraux"],
                  ["fusionner_lignes_multilignes", "Fusionner les lignes multi-lignes"],
                  ["utiliser_ligne_precedente_comme_chapitre", "Utiliser la ligne précédente comme chapitre"],
                  ["cellules_vides_continuation_designation", "Cellules vides = continuation de désignation"],
                ].map(([cle, label]) => (
                  <label key={cle} className="flex items-center gap-2 text-sm text-[var(--texte-secondaire)]">
                    <input type="checkbox" checked={Boolean(regles[cle as keyof typeof regles])} onChange={(e) => setRegles((r) => ({ ...r, [cle]: e.target.checked }))} />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          ) : etape === 4 ? (
            <div className="space-y-4">
              {!preview ? (
                <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-3 text-sm text-orange-100">Lancez la prévisualisation pour contrôler les lignes avant import.</div>
              ) : (
                <>
                  <div className="grid grid-cols-5 gap-3 text-sm">
                    {[
                      ["OK", preview.resume.ok ?? 0],
                      ["À vérifier", preview.resume.a_verifier ?? 0],
                      ["Ignorées", preview.resume.ignorees ?? 0],
                      ["Non capitalisables", preview.resume.non_capitalisables ?? 0],
                      ["Total", preview.resume.total ?? 0],
                    ].map(([label, valeur]) => (
                      <div key={String(label)} className="rounded-xl border border-[var(--bordure)] bg-[var(--fond-entree)] p-3">
                        <p className="text-xs text-[var(--texte-secondaire)]">{label}</p>
                        <p className="mt-1 font-mono text-lg font-bold">{valeur}</p>
                      </div>
                    ))}
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-[var(--bordure)]">
                    <table className="min-w-full text-xs">
                      <thead className="bg-white/5 text-[var(--texte-secondaire)]">
                        <tr>{["Statut", "N°", "Chapitre", "Désignation", "U", "Qté", "PU HT", "Montant", "Écart"].map((titre) => <th key={titre} className="px-3 py-2 text-left font-medium">{titre}</th>)}</tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--bordure)]">
                        {preview.lignes.map((ligne) => (
                          <tr key={`${ligne.ordre}-${ligne.numero}`}>
                            <td className="px-3 py-2"><span className={clsx("rounded-full border px-2 py-0.5", badgePreview(ligne))}>{ligne.statut}</span></td>
                            <td className="px-3 py-2">{ligne.numero}</td>
                            <td className="px-3 py-2">{ligne.chapitre}</td>
                            <td className="px-3 py-2 min-w-80">
                              <p>{ligne.designation}</p>
                              {ligne.alertes?.length > 0 && <p className="mt-1 text-[11px] text-orange-200">{ligne.alertes.join(" · ")}</p>}
                            </td>
                            <td className="px-3 py-2">{ligne.unite}</td>
                            <td className="px-3 py-2 font-mono">{ligne.quantite ?? "—"}</td>
                            <td className="px-3 py-2 font-mono">{formaterMontant(ligne.prix_unitaire_ht)}</td>
                            <td className="px-3 py-2 font-mono">{formaterMontant(ligne.montant_ht)}</td>
                            <td className="px-3 py-2 font-mono">{ligne.ecart_montant_ht ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl border border-[var(--bordure)] bg-[var(--fond-entree)] p-4">
                <h4 className="text-sm font-semibold">Validation de l’import</h4>
                <p className="mt-1 text-sm text-[var(--texte-secondaire)]">Les lignes OK et corrigées seront importées. Les lignes ignorées ou non capitalisables restent hors capitalisation.</p>
              </div>
              <div className="rounded-xl border border-[var(--bordure)] bg-[var(--fond-entree)] p-4">
                <label className="etiquette-champ">Sauvegarder comme modèle réutilisable</label>
                <div className="flex gap-2">
                  <input className="champ-saisie" value={nomModele} onChange={(e) => setNomModele(e.target.value)} placeholder="Ex. DPGF entreprise standard" />
                  <button type="button" className="btn-secondaire" onClick={sauvegarderModele} disabled={chargementAction}>Sauvegarder</button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap justify-between gap-3 border-t border-[var(--bordure)] bg-black/10 px-6 py-4">
          <div className="flex gap-2">
            <button type="button" className="btn-secondaire" onClick={() => setEtape(1)}>Voir l’extraction brute</button>
            <button type="button" className="btn-secondaire" onClick={previsualiser} disabled={chargementAction}>Prévisualiser l’import</button>
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn-secondaire" onClick={onFermer}>Fermer</button>
            <button type="button" className="btn-primaire" onClick={validerImport} disabled={chargementAction || !preview}>
              {chargementAction ? "Traitement…" : "Importer les lignes validées"}
            </button>
          </div>
        </div>
      </div>
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
  onSupprimer: () => void;
}) {
  const queryClient = useQueryClient();
  const notifications = useNotifications();
  const config = STATUT_CONFIG[devis.statut];
  const Icone = config.icone;
  const [deplie, setDeplie] = useState(false);
  const [capitalEnCours, setCapitalEnCours] = useState(false);
  const [modalDiagnostic, setModalDiagnostic] = useState<"texte" | "mapping" | null>(null);
  const aucuneLigne = devis.lignes_count === 0 && (devis.statut === "termine" || devis.statut === "a_verifier");
  const messageDiagnostic = devis.message_analyse || devis.erreur_detail;

  const { data: lignesData, isLoading: lignesChargement, isError: lignesErreur } = useQuery<LignePrixMarche[]>({
    queryKey: ["devis-lignes", devis.id],
    queryFn: () => api.get(`/api/ressources/devis/${devis.id}/lignes/`),
    enabled: deplie && (devis.statut === "termine" || devis.statut === "a_verifier"),
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
      notifications.succes(`${res.capitalise} ligne(s) capitalisée(s) en bibliothèque.`);
    } catch (e) {
      notifications.erreur(e instanceof ErreurApi ? e.detail : "Erreur lors de la capitalisation.");
    } finally {
      setCapitalEnCours(false);
    }
  };

  const relancer = async () => {
    try {
      await api.post(`/api/ressources/devis/${devis.id}/relancer/`, {});
      queryClient.invalidateQueries({ queryKey: ["devis-liste"] });
      notifications.info("L'analyse du devis a été relancée.");
    } catch (e) {
      notifications.erreur(e instanceof ErreurApi ? e.detail : "Erreur.");
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
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
        {(devis.statut === "termine" || devis.statut === "a_verifier") && (
          <span className="text-xs text-slate-500">{devis.lignes_count} ligne(s)</span>
        )}
        <div className="flex items-center gap-2 ml-auto">
          {devis.statut === "termine" && devis.lignes_count > 0 && !devis.capitalise && (
            <button type="button" className="btn-primaire text-xs" onClick={capitaliser} disabled={capitalEnCours}>
              <BookOpen className="h-3.5 w-3.5" />
              {capitalEnCours ? "En cours…" : "Capitaliser"}
            </button>
          )}
          {(devis.statut === "termine" || devis.statut === "a_verifier") && (
            <>
              <button type="button" className="btn-secondaire text-xs" onClick={() => setModalDiagnostic("mapping")}>
                <TableProperties className="h-3.5 w-3.5" /> Mapping manuel
              </button>
              {devis.lignes_count > 0 && (
                <button type="button" className="btn-secondaire text-xs" onClick={() => setModalDiagnostic("mapping")}>
                  <AlertTriangle className="h-3.5 w-3.5" /> Corriger les lignes
                </button>
              )}
              <button type="button" className="btn-secondaire text-xs" onClick={() => setModalDiagnostic("texte")}>
                <Eye className="h-3.5 w-3.5" /> Voir l’extraction brute
              </button>
              <button type="button" className="btn-secondaire text-xs" onClick={relancer}>
                <RefreshCw className="h-3.5 w-3.5" /> Relancer avec OCR
              </button>
            </>
          )}
          {devis.capitalise && (
            <span className="text-xs bg-green-100 text-green-700 rounded-full px-2.5 py-1 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Capitalisé
            </span>
          )}
          {(devis.statut === "erreur" || devis.statut === "a_verifier") && (
            <button type="button" className="btn-secondaire text-xs" onClick={relancer}>
              <RefreshCw className="h-3 w-3" /> Relancer
            </button>
          )}
          {(devis.statut === "termine" || devis.statut === "a_verifier") && devis.lignes_count > 0 && (
            <button type="button" className="btn-secondaire text-xs" onClick={() => setDeplie(!deplie)}>
              {deplie ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              Lignes
            </button>
          )}
          <button
            type="button"
            className="rounded p-1 hover:bg-red-50 text-slate-400 hover:text-red-500"
            onClick={onSupprimer}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {devis.statut === "erreur" && devis.erreur_detail && (
        <div className="px-5 pb-3 text-xs text-red-600 bg-red-50 border-t border-red-100 py-2">
          {devis.erreur_detail}
        </div>
      )}

      {(devis.statut === "a_verifier" || aucuneLigne) && (
        <div className="border-t border-orange-100 bg-orange-50 px-5 py-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-orange-600" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-orange-900">Aucune ligne détectée — vérifier l’analyse</p>
              <p className="mt-1 text-sm text-orange-800">
                {messageDiagnostic || "Aucune ligne de prix n’a été détectée automatiquement. Le document doit être vérifié ou mappé manuellement."}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className="btn-secondaire text-xs bg-white" onClick={relancer}>
                  <RefreshCw className="h-3.5 w-3.5" /> Relancer l’analyse
                </button>
                <button type="button" className="btn-secondaire text-xs bg-white" onClick={() => setModalDiagnostic("mapping")}>
                  <TableProperties className="h-3.5 w-3.5" /> Mapping manuel
                </button>
                <button type="button" className="btn-secondaire text-xs bg-white" onClick={() => setModalDiagnostic("texte")}>
                  <Eye className="h-3.5 w-3.5" /> Voir le texte extrait
                </button>
              </div>
            </div>
            <div className="hidden sm:grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-lg bg-white px-3 py-2 border border-orange-100">
                <p className="text-orange-500">Méthode</p>
                <p className="font-medium text-orange-900">{devis.methode_extraction || "—"}</p>
              </div>
              <div className="rounded-lg bg-white px-3 py-2 border border-orange-100">
                <p className="text-orange-500">Rejets</p>
                <p className="font-mono font-bold text-orange-900">{devis.nb_lignes_rejetees || 0}</p>
              </div>
              <div className="rounded-lg bg-white px-3 py-2 border border-orange-100">
                <p className="text-orange-500">Score</p>
                <p className="font-mono font-bold text-orange-900">{Number(devis.score_qualite_extraction || 0).toFixed(0)}%</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {deplie && (
        <div className="border-t border-slate-100 px-5 py-4 space-y-2 bg-slate-50">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-700">Lignes extraites ({lignes.length})</h3>
            <p className="text-xs text-slate-400">
              Indice {devis.indice_base_code} = {devis.indice_base_valeur ?? "?"}
            </p>
          </div>
          {lignesChargement ? (
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
              Chargement des lignes extraites…
            </div>
          ) : lignesErreur ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              Impossible de charger les lignes extraites. Relancez l’analyse ou ouvrez le diagnostic.
            </div>
          ) : lignes.length === 0 ? (
            <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
              Aucune ligne n’est rattachée à ce devis.
            </div>
          ) : (
            lignes.map((ligne) => (
              <LigneSDP key={ligne.id} ligne={ligne} />
            ))
          )}
        </div>
      )}

      {modalDiagnostic && (
        <ModalMappingDocumentPrix
          devis={devis}
          modeInitial={modalDiagnostic}
          onFermer={() => setModalDiagnostic(null)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Badge "suggéré"
// ---------------------------------------------------------------------------

function BadgeSuggere() {
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-violet-600 bg-violet-50 border border-violet-200 rounded-full px-1.5 py-0.5 ml-1.5 leading-none">
      <Sparkles className="h-2.5 w-2.5" />
      suggéré
    </span>
  );
}

// ---------------------------------------------------------------------------
// Composant principal
// ---------------------------------------------------------------------------

type EtatPrevisualisation = "vide" | "chargement" | "pret";

export default function AnalyseurDevis() {
  const queryClient = useQueryClient();
  const notifications = useNotifications();

  const [fichierSelectionne, setFichierSelectionne] = useState<File | null>(null);
  const [etatPreview, setEtatPreview] = useState<EtatPrevisualisation>("vide");
  const [champsAuto, setChampsAuto] = useState<Set<string>>(new Set());
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
  const [devisASupprimer, setDevisASupprimer] = useState<DevisAnalyse | null>(null);
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);

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

  // ----------- Sélection du fichier + prévisualisation -----------

  const changer = (champ: keyof typeof form, valeur: string) => {
    setForm((f) => ({ ...f, [champ]: valeur }));
    // Si l'utilisateur modifie un champ suggéré, retirer le badge
    setChampsAuto((prev) => { const s = new Set(prev); s.delete(champ); return s; });
  };

  const selectionnerFichier = useCallback(async (fichier: File) => {
    setFichierSelectionne(fichier);
    setErreurUpload(null);

    // Réinitialiser les champs du formulaire
    setForm({ type_document: "devis", entreprise: "", localite: "", date_emission: "", indice_base_code: "BT01", indice_base_valeur: "" });
    setChampsAuto(new Set());

    // N'appeler la prévisualisation que pour les PDF
    if (!fichier.name.toLowerCase().endsWith(".pdf")) {
      setEtatPreview("pret");
      return;
    }

    setEtatPreview("chargement");
    try {
      const formData = new FormData();
      formData.append("fichier", fichier);
      const meta = await api.post<MetadonneesPrevisualisation>("/api/ressources/devis/previsualiser/", formData);

      const auto = new Set<string>();
      const updates: Partial<typeof form> = {};

      if (meta.type_document && meta.type_document !== "devis") {
        updates.type_document = meta.type_document; auto.add("type_document");
      }
      if (meta.entreprise) {
        updates.entreprise = meta.entreprise; auto.add("entreprise");
      }
      if (meta.localite) {
        updates.localite = meta.localite; auto.add("localite");
      }
      if (meta.date_emission) {
        updates.date_emission = meta.date_emission; auto.add("date_emission");
      }
      if (meta.indice_base_code && meta.indice_base_code !== "BT01") {
        updates.indice_base_code = meta.indice_base_code; auto.add("indice_base_code");
      }

      setForm((f) => ({ ...f, ...updates }));
      setChampsAuto(auto);
      setEtatPreview("pret");
    } catch {
      // Pas bloquant : on peut quand même uploader sans prévisualisation
      setEtatPreview("pret");
    }
  }, []);

  // ----------- Upload final -----------

  const analyser = async () => {
    if (!fichierSelectionne) return;
    setEnUpload(true);
    setErreurUpload(null);
    const data = new FormData();
    data.append("fichier", fichierSelectionne);
    Object.entries(form).forEach(([k, v]) => { if (v) data.append(k, v); });
    try {
      await api.post("/api/ressources/devis/", data);
      queryClient.invalidateQueries({ queryKey: ["devis-liste"] });
      notifications.succes("Analyse lancée. Le devis apparaîtra dans la liste et se mettra à jour automatiquement.");
      // Réinitialiser
      setFichierSelectionne(null);
      setEtatPreview("vide");
      setChampsAuto(new Set());
      setForm({ type_document: "devis", entreprise: "", localite: "", date_emission: "", indice_base_code: "BT01", indice_base_valeur: "" });
    } catch (e) {
      setErreurUpload(e instanceof ErreurApi ? e.detail : "Téléversement impossible.");
    } finally {
      setEnUpload(false);
    }
  };

  const supprimerDevis = async () => {
    if (!devisASupprimer) return;
    setSuppressionEnCours(true);
    try {
      await api.supprimer(`/api/ressources/devis/${devisASupprimer.id}/`);
      queryClient.invalidateQueries({ queryKey: ["devis-liste"] });
      notifications.succes("Devis supprimé.");
    } catch (e) {
      notifications.erreur(e instanceof ErreurApi ? e.detail : "Suppression impossible.");
    } finally {
      setSuppressionEnCours(false);
      setDevisASupprimer(null);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const fichier = e.dataTransfer.files[0];
    if (fichier) selectionnerFichier(fichier);
  };

  const reinitialiser = () => {
    setFichierSelectionne(null);
    setEtatPreview("vide");
    setChampsAuto(new Set());
    setErreurUpload(null);
    setForm({ type_document: "devis", entreprise: "", localite: "", date_emission: "", indice_base_code: "BT01", indice_base_valeur: "" });
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

      {/* Formulaire */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">Document à analyser</h2>
          {etatPreview === "pret" && champsAuto.size > 0 && (
            <span className="flex items-center gap-1.5 text-xs text-violet-600">
              <Sparkles className="h-3.5 w-3.5" />
              {champsAuto.size} champ{champsAuto.size > 1 ? "s" : ""} pré-rempli{champsAuto.size > 1 ? "s" : ""} depuis le document
            </span>
          )}
        </div>

        {/* Zone de sélection de fichier */}
        {etatPreview === "vide" ? (
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
              onChange={(e) => { const f = e.target.files?.[0]; if (f) selectionnerFichier(f); }}
            />
            <div className="flex flex-col items-center gap-2">
              <Upload className="h-8 w-8 text-slate-400" />
              <p className="text-sm font-medium text-slate-600">
                Glissez-déposez votre fichier ici ou cliquez pour parcourir
              </p>
              <p className="text-xs text-slate-400">PDF, XLSX, XLS, DOC, DOCX, CSV, ODS</p>
            </div>
          </div>
        ) : (
          /* Fichier sélectionné */
          <div className={clsx(
            "flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors",
            etatPreview === "chargement"
              ? "border-violet-200 bg-violet-50"
              : "border-slate-200 bg-slate-50"
          )}>
            <FileText className="h-5 w-5 text-slate-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800 truncate">{fichierSelectionne?.name}</p>
              {etatPreview === "chargement" ? (
                <p className="text-xs text-violet-600 flex items-center gap-1 mt-0.5">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  Lecture des métadonnées…
                </p>
              ) : champsAuto.size > 0 ? (
                <p className="text-xs text-violet-600 mt-0.5">
                  Informations extraites du document — vérifiez avant de lancer l&apos;analyse
                </p>
              ) : (
                <p className="text-xs text-slate-400 mt-0.5">
                  {fichierSelectionne ? (fichierSelectionne.size / 1024).toFixed(0) + " Ko" : ""}
                </p>
              )}
            </div>
            <button
              type="button"
              className="rounded p-1 hover:bg-slate-200 text-slate-400 hover:text-slate-600 flex-shrink-0"
              onClick={reinitialiser}
              title="Choisir un autre fichier"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Formulaire de métadonnées */}
        {etatPreview !== "vide" && (
          <div className={clsx("grid grid-cols-2 gap-4 transition-opacity", etatPreview === "chargement" && "opacity-50 pointer-events-none")}>
            <div>
              <label className="etiquette-champ flex items-center">
                Type de document
                {champsAuto.has("type_document") && <BadgeSuggere />}
              </label>
              <select
                className={clsx("champ-saisie", champsAuto.has("type_document") && "ring-1 ring-violet-300 bg-violet-50/40")}
                value={form.type_document}
                onChange={(e) => changer("type_document", e.target.value)}
              >
                {TYPES_DOCUMENT.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="etiquette-champ flex items-center">
                Entreprise émettrice
                {champsAuto.has("entreprise") && <BadgeSuggere />}
              </label>
              <input
                type="text"
                className={clsx("champ-saisie", champsAuto.has("entreprise") && "ring-1 ring-violet-300 bg-violet-50/40")}
                placeholder="ex. Bouygues Construction"
                value={form.entreprise}
                onChange={(e) => changer("entreprise", e.target.value)}
              />
            </div>
            <div>
              <label className="etiquette-champ flex items-center">
                Localité / Zone géographique
                {champsAuto.has("localite") && <BadgeSuggere />}
              </label>
              <input
                type="text"
                className={clsx("champ-saisie", champsAuto.has("localite") && "ring-1 ring-violet-300 bg-violet-50/40")}
                placeholder="ex. Paris, Île-de-France, 75"
                value={form.localite}
                onChange={(e) => changer("localite", e.target.value)}
              />
            </div>
            <div>
              <label className="etiquette-champ flex items-center">
                Date d&apos;émission
                {champsAuto.has("date_emission") && <BadgeSuggere />}
              </label>
              <input
                type="date"
                className={clsx("champ-saisie", champsAuto.has("date_emission") && "ring-1 ring-violet-300 bg-violet-50/40")}
                value={form.date_emission}
                onChange={(e) => changer("date_emission", e.target.value)}
              />
            </div>
            <div>
              <label className="etiquette-champ flex items-center">
                Indice BT de référence
                {champsAuto.has("indice_base_code") && <BadgeSuggere />}
              </label>
              <select
                className={clsx("champ-saisie", champsAuto.has("indice_base_code") && "ring-1 ring-violet-300 bg-violet-50/40")}
                value={form.indice_base_code}
                onChange={(e) => changer("indice_base_code", e.target.value)}
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
                onChange={(e) => changer("indice_base_valeur", e.target.value)}
              />
            </div>
          </div>
        )}

        {erreurUpload && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {erreurUpload}
          </div>
        )}

        {/* Bouton lancer l'analyse */}
        {etatPreview === "pret" && (
          <div className="flex justify-end pt-1">
            <button
              type="button"
              className="btn-primaire"
              onClick={analyser}
              disabled={enUpload}
            >
              {enUpload ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Envoi en cours…
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Lancer l&apos;analyse
                </>
              )}
            </button>
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
            <CarteDevis key={devis.id} devis={devis} onSupprimer={() => setDevisASupprimer(devis)} />
          ))
        )}
      </div>

      <ModalConfirmation
        ouverte={Boolean(devisASupprimer)}
        titre="Supprimer le devis"
        message="Supprimer ce devis et ses lignes extraites ? Cette action retire aussi les résultats d'analyse associés."
        libelleBoutonConfirmer="Supprimer"
        variante="danger"
        chargement={suppressionEnCours}
        onAnnuler={() => setDevisASupprimer(null)}
        onConfirmer={supprimerDevis}
      />
    </div>
  );
}
