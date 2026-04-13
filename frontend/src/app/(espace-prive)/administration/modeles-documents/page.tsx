"use client";

import { useEffect, useId, useMemo, useRef, useState, useCallback } from "react";
import {
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink,
  FileCog,
  FileSpreadsheet,
  FileText,
  Info,
  Layers,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Upload,
  Variable,
  X,
} from "lucide-react";
import { api, ErreurApi, requeteApiAvecProgression, type ProgressionTeleversement } from "@/crochets/useApi";
import { EtatTeleversement } from "@/composants/ui/EtatTeleversement";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VariableFusion {
  nom: string;
  description: string;
  exemple: string;
}

interface ModeleDocument {
  id: string;
  code: string;
  libelle: string;
  type_document: string;
  type_libelle: string;
  description: string;
  gabarit: string | null;
  variables_fusion: VariableFusion[];
  contenu_modele_html: string;
  est_actif: boolean;
  date_creation: string;
  date_modification: string;
}

interface SessionBureautique {
  url_editeur: string;
  nom_fichier: string;
  type_bureautique: "texte" | "tableur";
  extension: string;
  access_token: string;
  access_token_ttl: number;
  gabarit: string | null;
}

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const TYPES_DOCUMENTS = [
  { valeur: "cctp", libelle: "CCTP" },
  { valeur: "dpgf", libelle: "DPGF" },
  { valeur: "bpu", libelle: "BPU" },
  { valeur: "dqe", libelle: "DQE" },
  { valeur: "rc", libelle: "RC" },
  { valeur: "ae", libelle: "AE" },
  { valeur: "ccap", libelle: "CCAP" },
  { valeur: "rapport", libelle: "Rapport technique" },
  { valeur: "note_calcul", libelle: "Note de calcul" },
  { valeur: "autre", libelle: "Autre pièce écrite" },
];

const TYPES_TABLEUR = new Set(["dpgf", "bpu", "dqe"]);

/** Variables système automatiquement disponibles dans tous les modèles */
const VARIABLES_SYSTEME: { groupe: string; variables: { cle: string; description: string }[] }[] = [
  {
    groupe: "Projet",
    variables: [
      { cle: "nom_projet", description: "Intitulé du projet" },
      { cle: "reference_projet", description: "Référence du projet" },
      { cle: "description_projet", description: "Description sommaire" },
      { cle: "commune_projet", description: "Commune" },
      { cle: "departement_projet", description: "Département" },
      { cle: "phase_projet", description: "Phase (ESQ, APD, PRO…)" },
      { cle: "statut_projet", description: "Statut courant" },
    ],
  },
  {
    groupe: "Intervenants",
    variables: [
      { cle: "maitre_ouvrage", description: "Maître d'ouvrage" },
      { cle: "maitre_oeuvre", description: "Maître d'œuvre" },
      { cle: "organisation", description: "Bureau d'études" },
      { cle: "responsable_projet", description: "Responsable de mission" },
      { cle: "redacteur_nom", description: "Rédacteur du document" },
    ],
  },
  {
    groupe: "Document",
    variables: [
      { cle: "date_generation", description: "Date de génération" },
      { cle: "piece_intitule", description: "Intitulé de la pièce" },
      { cle: "modele_libelle", description: "Nom du modèle" },
    ],
  },
  {
    groupe: "Lot CCTP",
    variables: [
      { cle: "lot_intitule", description: "Intitulé du lot" },
      { cle: "lot_numero", description: "Numéro du lot" },
      { cle: "contenu_principal", description: "Contenu injecté automatiquement" },
    ],
  },
];

const MODELE_VIDE: ModeleDocument = {
  id: "",
  code: "",
  libelle: "",
  type_document: "cctp",
  type_libelle: "CCTP",
  description: "",
  gabarit: null,
  variables_fusion: [],
  contenu_modele_html: "",
  est_actif: true,
  date_creation: "",
  date_modification: "",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function typeBureautique(typeDocument: string) {
  return TYPES_TABLEUR.has(typeDocument) ? "tableur" : "texte";
}

function libelleEditeur(typeDocument: string) {
  return typeBureautique(typeDocument) === "tableur" ? "Excel" : "Word";
}

function normaliserModele(modele?: Partial<ModeleDocument> | null): ModeleDocument {
  return {
    ...MODELE_VIDE,
    ...modele,
    variables_fusion: Array.isArray(modele?.variables_fusion)
      ? modele.variables_fusion.map((v) => ({ nom: v.nom || "", description: v.description || "", exemple: v.exemple || "" }))
      : [],
  };
}

function extraireNomFichier(url: string | null) {
  if (!url) return null;
  try {
    const u = new URL(url, window.location.origin);
    return decodeURIComponent(u.pathname.split("/").pop() || "");
  } catch {
    return url.split("/").pop() || url;
  }
}

function formaterDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

// ---------------------------------------------------------------------------
// Page principale
// ---------------------------------------------------------------------------

export default function PageAdministrationModelesDocuments() {
  const identifiantIframe = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const cibleIframe = `collabora-modele-${identifiantIframe}`;
  const formulaireBureautiqueRef = useRef<HTMLFormElement | null>(null);

  const [modeles, setModeles] = useState<ModeleDocument[]>([]);
  const [selectionId, setSelectionId] = useState<string>("");
  const [edition, setEdition] = useState<ModeleDocument>(MODELE_VIDE);
  const [chargement, setChargement] = useState(true);
  const [enregistrement, setEnregistrement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  const [fichierGabarit, setFichierGabarit] = useState<File | null>(null);
  const [supprimerGabarit, setSupprimerGabarit] = useState(false);
  const [progressionTeleversement, setProgressionTeleversement] = useState<ProgressionTeleversement | null>(null);
  const [sessionBureautique, setSessionBureautique] = useState<SessionBureautique | null>(null);
  const [chargementBureautique, setChargementBureautique] = useState(false);
  const [nouveauModele, setNouveauModele] = useState(false);
  const [groupeOuvert, setGroupeOuvert] = useState<string>("Projet");
  const [panneauDroit, setPanneauDroit] = useState<"proprietes" | "variables" | "gabarit">("variables");

  // -------------------------------------------------------------------------
  // Chargement
  // -------------------------------------------------------------------------

  async function chargerModeles(selectionCible?: string) {
    setChargement(true);
    setErreur(null);
    try {
      const reponse = await api.get<{ results?: ModeleDocument[] }>("/api/pieces-ecrites/modeles/?inclure_inactifs=1");
      const liste = reponse.results ?? [];
      setModeles(liste);

      const idCible = selectionCible ?? selectionId;
      if (idCible) {
        const trouve = liste.find((m) => m.id === idCible);
        if (trouve) {
          setSelectionId(trouve.id);
          setEdition(normaliserModele(trouve));
          return;
        }
      }
      if (liste.length > 0) {
        setSelectionId(liste[0].id);
        setEdition(normaliserModele(liste[0]));
      } else {
        setSelectionId("");
        setEdition(normaliserModele(null));
        setNouveauModele(true);
      }
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Impossible de charger les modèles.");
    } finally {
      setChargement(false);
    }
  }

  useEffect(() => { void chargerModeles(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset session quand le modèle change
  useEffect(() => { setSessionBureautique(null); }, [edition.id, edition.type_document]);

  // Soumettre le formulaire caché dès que la session est prête
  useEffect(() => {
    if (!sessionBureautique || !formulaireBureautiqueRef.current) return;
    formulaireBureautiqueRef.current.submit();
  }, [sessionBureautique]);

  // -------------------------------------------------------------------------
  // Actions modèles
  // -------------------------------------------------------------------------

  function selectionnerModele(modele: ModeleDocument) {
    setSelectionId(modele.id);
    setEdition(normaliserModele(modele));
    setFichierGabarit(null);
    setSupprimerGabarit(false);
    setSessionBureautique(null);
    setNouveauModele(false);
    setErreur(null);
    setSucces(null);
  }

  function demarrerNouveauModele() {
    setSelectionId("");
    setEdition(normaliserModele(null));
    setFichierGabarit(null);
    setSupprimerGabarit(false);
    setSessionBureautique(null);
    setNouveauModele(true);
    setErreur(null);
    setSucces(null);
  }

  async function ouvrirEditeurBureautique() {
    if (!edition.id) {
      setErreur("Enregistrez d'abord le modèle pour ouvrir l'éditeur.");
      return;
    }
    setChargementBureautique(true);
    setErreur(null);
    try {
      const session = await api.post<SessionBureautique>(`/api/pieces-ecrites/modeles/${edition.id}/session-bureautique/`, {});
      setSessionBureautique(session);
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Impossible d'ouvrir l'éditeur Collabora.");
    } finally {
      setChargementBureautique(false);
    }
  }

  async function copierVariable(placeholder: string) {
    try {
      await navigator.clipboard.writeText(placeholder);
      setSucces(`Copié : ${placeholder}`);
      setTimeout(() => setSucces(null), 2000);
    } catch {
      setErreur(`Impossible de copier ${placeholder}.`);
    }
  }

  // Variables fusion
  const majVariable = useCallback((index: number, champ: keyof VariableFusion, valeur: string) => {
    setEdition((prev) => {
      const vars = [...prev.variables_fusion];
      vars[index] = { ...vars[index], [champ]: valeur };
      return { ...prev, variables_fusion: vars };
    });
  }, []);

  function ajouterVariable() {
    setEdition((prev) => ({ ...prev, variables_fusion: [...prev.variables_fusion, { nom: "", description: "", exemple: "" }] }));
  }

  function supprimerVariableFusion(index: number) {
    setEdition((prev) => ({ ...prev, variables_fusion: prev.variables_fusion.filter((_, i) => i !== index) }));
  }

  // -------------------------------------------------------------------------
  // Enregistrement
  // -------------------------------------------------------------------------

  async function enregistrerModele() {
    if (!edition.code.trim() || !edition.libelle.trim()) {
      setErreur("Le code et le libellé sont obligatoires.");
      return;
    }
    setEnregistrement(true);
    setErreur(null);
    setSucces(null);
    setProgressionTeleversement(null);

    try {
      const formData = new FormData();
      formData.append("code", edition.code.trim());
      formData.append("libelle", edition.libelle.trim());
      formData.append("type_document", edition.type_document);
      formData.append("description", edition.description);
      formData.append("contenu_modele_html", edition.contenu_modele_html);
      formData.append("variables_fusion", JSON.stringify(edition.variables_fusion.filter((v) => v.nom.trim())));
      formData.append("est_actif", String(edition.est_actif));
      if (fichierGabarit) formData.append("gabarit", fichierGabarit);
      if (supprimerGabarit) formData.append("supprimer_gabarit", "true");

      const url = edition.id ? `/api/pieces-ecrites/modeles/${edition.id}/` : "/api/pieces-ecrites/modeles/";
      const methode = edition.id ? "PATCH" : "POST";

      const sauvegarde = await requeteApiAvecProgression<ModeleDocument>(url, {
        method: methode,
        corps: formData,
        onProgression: setProgressionTeleversement,
      });

      const estNouveauCreation = !edition.id;
      await chargerModeles(sauvegarde.id);
      setFichierGabarit(null);
      setSupprimerGabarit(false);
      setNouveauModele(false);
      setSucces(estNouveauCreation ? "Modèle créé — vous pouvez maintenant ouvrir l'éditeur Collabora." : "Modèle mis à jour.");
      setTimeout(() => setSucces(null), 4000);

      // Auto-ouvrir Collabora après création
      if (estNouveauCreation) {
        setTimeout(() => void ouvrirEditeurBureautique(), 800);
      }
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Impossible d'enregistrer le modèle.");
    } finally {
      setEnregistrement(false);
      setTimeout(() => setProgressionTeleversement(null), 500);
    }
  }

  async function supprimerModele() {
    if (!edition.id) return;
    if (!window.confirm(`Supprimer définitivement le modèle « ${edition.libelle} » ?`)) return;
    try {
      await api.supprimer(`/api/pieces-ecrites/modeles/${edition.id}/`);
      await chargerModeles();
      demarrerNouveauModele();
      setSucces("Modèle supprimé.");
      setTimeout(() => setSucces(null), 3000);
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Impossible de supprimer le modèle.");
    }
  }

  // -------------------------------------------------------------------------
  // Rendu
  // -------------------------------------------------------------------------

  const nomGabarit = fichierGabarit?.name || (supprimerGabarit ? null : extraireNomFichier(edition.gabarit));
  const estBureautiqueOuvert = !!sessionBureautique;
  const aModeleSelectionne = !!edition.id;

  const totalVariables = VARIABLES_SYSTEME.reduce((acc, g) => acc + g.variables.length, 0) + edition.variables_fusion.length;

  return (
    <div className="flex h-[calc(100vh-72px)] flex-col overflow-hidden">
      {/* ------------------------------------------------------------------ */}
      {/* Barre supérieure                                                     */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100">
            <FileCog className="h-5 w-5 text-violet-600" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900">Modèles de documents</h1>
            <p className="text-xs text-slate-500">
              Créez et mettez en page vos gabarits Word/Excel directement dans l&apos;éditeur Collabora — les variables de fusion sont injectées automatiquement.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {succes && (
            <span className="rounded-xl bg-green-100 px-3 py-1.5 text-xs font-semibold text-green-700">{succes}</span>
          )}
          {erreur && (
            <span className="max-w-xs rounded-xl bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-700">{erreur}</span>
          )}
          <button type="button" onClick={demarrerNouveauModele} className="btn-primaire">
            <Plus size={15} /> Nouveau modèle
          </button>
        </div>
      </div>

      <EtatTeleversement progression={progressionTeleversement} libelle="Enregistrement du modèle" />

      {/* ------------------------------------------------------------------ */}
      {/* Corps — 3 panneaux                                                  */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex min-h-0 flex-1">

        {/* ============================================================== */}
        {/* Panneau gauche — liste des modèles                              */}
        {/* ============================================================== */}
        <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-slate-50">
          <div className="shrink-0 border-b border-slate-200 px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
              {modeles.length} modèle{modeles.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto py-2">
            {chargement ? (
              <div className="px-4 py-6 text-xs text-slate-400">Chargement…</div>
            ) : modeles.length === 0 && !nouveauModele ? (
              <div className="px-4 py-6 text-xs text-slate-500">Aucun modèle. Créez le premier.</div>
            ) : (
              <>
                {nouveauModele && (
                  <div className="mx-2 mb-1 rounded-xl border border-primaire-200 bg-primaire-50 px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <Plus className="h-3.5 w-3.5 text-primaire-600" />
                      <span className="text-xs font-semibold text-primaire-700">Nouveau modèle</span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-primaire-500">En cours de création</p>
                  </div>
                )}
                {modeles.map((modele) => (
                  <button
                    key={modele.id}
                    type="button"
                    onClick={() => selectionnerModele(modele)}
                    className={`group mx-2 mb-1 w-[calc(100%-16px)] rounded-xl px-3 py-2.5 text-left transition ${
                      selectionId === modele.id
                        ? "bg-white shadow-sm ring-1 ring-primaire-200"
                        : "hover:bg-white hover:shadow-sm"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-slate-800">{modele.libelle}</p>
                        <p className="mt-0.5 font-mono text-[10px] text-slate-400">{modele.code}</p>
                      </div>
                      {TYPES_TABLEUR.has(modele.type_document)
                        ? <FileSpreadsheet className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                        : <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-400" />}
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">{modele.type_libelle}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${modele.est_actif ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                        {modele.est_actif ? "Actif" : "Inactif"}
                      </span>
                    </div>
                  </button>
                ))}
              </>
            )}
          </div>
        </aside>

        {/* ============================================================== */}
        {/* Zone centrale — éditeur Collabora                               */}
        {/* ============================================================== */}
        <main className="flex min-w-0 flex-1 flex-col bg-slate-100">
          {/* Barre de l'éditeur */}
          <div className="flex shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 py-2.5">
            {aModeleSelectionne ? (
              <>
                <div className="flex items-center gap-2 min-w-0">
                  {TYPES_TABLEUR.has(edition.type_document)
                    ? <FileSpreadsheet className="h-4 w-4 shrink-0 text-emerald-500" />
                    : <FileText className="h-4 w-4 shrink-0 text-blue-500" />}
                  <span className="truncate text-sm font-semibold text-slate-800">{edition.libelle || edition.code}</span>
                  <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">{edition.type_libelle}</span>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  {sessionBureautique?.gabarit && (
                    <a href={sessionBureautique.gabarit} target="_blank" rel="noopener noreferrer" className="btn-secondaire py-1.5 text-xs">
                      <ExternalLink size={13} /> Télécharger
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={ouvrirEditeurBureautique}
                    disabled={chargementBureautique}
                    className="btn-primaire py-1.5 text-xs"
                  >
                    {chargementBureautique ? (
                      <RefreshCw size={13} className="animate-spin" />
                    ) : estBureautiqueOuvert ? (
                      <RefreshCw size={13} />
                    ) : (
                      <Layers size={13} />
                    )}
                    {chargementBureautique ? "Connexion…" : estBureautiqueOuvert ? "Relancer" : `Ouvrir ${libelleEditeur(edition.type_document)}`}
                  </button>
                </div>
              </>
            ) : (
              <span className="text-sm text-slate-400">
                {nouveauModele ? "Remplissez les propriétés et enregistrez pour ouvrir l'éditeur" : "Sélectionnez ou créez un modèle"}
              </span>
            )}
          </div>

          {/* Zone iframe / état vide */}
          <div className="flex-1 overflow-hidden">
            {!aModeleSelectionne ? (
              <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-100">
                  <FileCog className="h-8 w-8 text-violet-500" />
                </div>
                <div>
                  <p className="text-base font-semibold text-slate-700">Aucun modèle sélectionné</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Choisissez un modèle dans la liste ou créez-en un nouveau, puis cliquez sur &quot;Ouvrir Word/Excel&quot; pour démarrer l&apos;éditeur Collabora.
                  </p>
                </div>
                <button type="button" onClick={demarrerNouveauModele} className="btn-primaire">
                  <Plus size={15} /> Créer un modèle
                </button>
              </div>
            ) : !estBureautiqueOuvert ? (
              <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100">
                  {TYPES_TABLEUR.has(edition.type_document)
                    ? <FileSpreadsheet className="h-8 w-8 text-emerald-500" />
                    : <FileText className="h-8 w-8 text-blue-500" />}
                </div>
                <div>
                  <p className="text-base font-semibold text-slate-700">
                    Éditeur {libelleEditeur(edition.type_document)} — Collabora Online
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Cliquez sur le bouton ci-dessous pour ouvrir le gabarit dans l&apos;éditeur bureautique intégré.
                    Les modifications sont sauvegardées automatiquement.
                  </p>
                </div>
                <button type="button" onClick={ouvrirEditeurBureautique} disabled={chargementBureautique} className="btn-primaire">
                  {chargementBureautique ? <RefreshCw size={15} className="animate-spin" /> : <Layers size={15} />}
                  {chargementBureautique ? "Connexion au serveur bureautique…" : `Ouvrir dans ${libelleEditeur(edition.type_document)} / Collabora`}
                </button>
                <p className="text-xs text-slate-400">
                  Les variables comme <code className="text-violet-600">{"{nom_projet}"}</code> seront remplacées lors de la génération des pièces écrites.
                </p>
              </div>
            ) : (
              <>
                {/* Formulaire caché pour la session WOPI */}
                <form
                  ref={formulaireBureautiqueRef}
                  action={sessionBureautique.url_editeur}
                  method="post"
                  target={cibleIframe}
                  className="hidden"
                >
                  <input type="hidden" name="access_token" value={sessionBureautique.access_token} />
                  <input type="hidden" name="access_token_ttl" value={String(sessionBureautique.access_token_ttl)} />
                </form>
                <iframe
                  name={cibleIframe}
                  src="about:blank"
                  title={`Éditeur ${edition.libelle || edition.code}`}
                  className="h-full w-full border-0"
                  allow="clipboard-read; clipboard-write"
                />
              </>
            )}
          </div>
        </main>

        {/* ============================================================== */}
        {/* Panneau droit — propriétés + variables                          */}
        {/* ============================================================== */}
        <aside className="flex w-80 shrink-0 flex-col border-l border-slate-200 bg-white">
          {/* Navigation du panneau */}
          <div className="flex shrink-0 border-b border-slate-200">
            {(["proprietes", "variables", "gabarit"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPanneauDroit(p)}
                className={`flex-1 py-2.5 text-xs font-semibold transition ${
                  panneauDroit === p
                    ? "border-b-2 border-primaire-500 text-primaire-700"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {p === "proprietes" ? "Propriétés" : p === "variables" ? `Variables (${totalVariables})` : "Gabarit"}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">

            {/* ---------------------------------------------------------- */}
            {/* Panneau : Propriétés                                        */}
            {/* ---------------------------------------------------------- */}
            {panneauDroit === "proprietes" && (
              <div className="space-y-4 p-4">
                <div>
                  <label className="libelle-champ">Code <span className="text-red-500">*</span></label>
                  <input
                    className="champ-saisie w-full"
                    value={edition.code}
                    onChange={(e) => setEdition((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
                    placeholder="CCTP_STANDARD"
                  />
                </div>
                <div>
                  <label className="libelle-champ">Libellé <span className="text-red-500">*</span></label>
                  <input
                    className="champ-saisie w-full"
                    value={edition.libelle}
                    onChange={(e) => setEdition((p) => ({ ...p, libelle: e.target.value }))}
                    placeholder="CCTP standard bâtiments"
                  />
                </div>
                <div>
                  <label className="libelle-champ">Type de document</label>
                  <select
                    className="champ-saisie w-full"
                    value={edition.type_document}
                    onChange={(e) => setEdition((p) => ({ ...p, type_document: e.target.value }))}
                  >
                    {TYPES_DOCUMENTS.map((t) => (
                      <option key={t.valeur} value={t.valeur}>{t.libelle}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="libelle-champ">Description</label>
                  <textarea
                    className="champ-saisie w-full min-h-[80px]"
                    value={edition.description}
                    onChange={(e) => setEdition((p) => ({ ...p, description: e.target.value }))}
                    placeholder="Usage, contexte, règles de fusion…"
                  />
                </div>
                <label className="flex items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-primaire-600"
                    checked={edition.est_actif}
                    onChange={(e) => setEdition((p) => ({ ...p, est_actif: e.target.checked }))}
                  />
                  <span className="text-slate-700">Modèle actif</span>
                </label>

                {edition.date_modification && (
                  <p className="text-[11px] text-slate-400">
                    Modifié le {formaterDate(edition.date_modification)}
                  </p>
                )}

                <div className="flex flex-col gap-2 pt-2">
                  <button
                    type="button"
                    onClick={enregistrerModele}
                    disabled={enregistrement}
                    className="btn-primaire w-full justify-center"
                  >
                    {enregistrement ? <RefreshCw size={15} className="animate-spin" /> : <Save size={15} />}
                    {enregistrement ? "Enregistrement…" : edition.id ? "Mettre à jour" : "Créer le modèle"}
                  </button>
                  {edition.id && (
                    <button
                      type="button"
                      onClick={supprimerModele}
                      className="btn-secondaire w-full justify-center text-red-600 hover:border-red-300 hover:bg-red-50"
                    >
                      <Trash2 size={15} /> Supprimer
                    </button>
                  )}
                </div>

                {/* Astuce */}
                <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-700">
                  <div className="mb-1 flex items-center gap-1.5 font-semibold">
                    <Info size={12} /> Bon à savoir
                  </div>
                  <ul className="list-disc space-y-1 pl-4">
                    <li>CCTP, CCAP, RC, AE, Rapports → <strong>Word .docx</strong></li>
                    <li>BPU, DQE, DPGF → <strong>Excel .xlsx</strong></li>
                    <li>Utilisez <code className="font-mono">{"{nom_variable}"}</code> pour insérer les variables.</li>
                  </ul>
                </div>
              </div>
            )}

            {/* ---------------------------------------------------------- */}
            {/* Panneau : Variables de fusion                               */}
            {/* ---------------------------------------------------------- */}
            {panneauDroit === "variables" && (
              <div className="divide-y divide-slate-100">
                {/* Variables système */}
                <div className="p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Variable className="h-4 w-4 text-violet-500" />
                    <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-slate-500">Variables système</h3>
                  </div>
                  <p className="mb-3 text-[11px] text-slate-400">
                    Cliquez sur une variable pour la copier, puis collez-la dans le document Collabora.
                  </p>
                  {VARIABLES_SYSTEME.map((groupe) => (
                    <div key={groupe.groupe} className="mb-2">
                      <button
                        type="button"
                        onClick={() => setGroupeOuvert((prev) => prev === groupe.groupe ? "" : groupe.groupe)}
                        className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 hover:bg-slate-50"
                      >
                        {groupe.groupe}
                        {groupeOuvert === groupe.groupe
                          ? <ChevronDown className="h-3 w-3" />
                          : <ChevronRight className="h-3 w-3" />}
                      </button>
                      {groupeOuvert === groupe.groupe && (
                        <div className="mt-1 space-y-1">
                          {groupe.variables.map((variable) => {
                            const placeholder = `{${variable.cle}}`;
                            return (
                              <button
                                key={variable.cle}
                                type="button"
                                onClick={() => void copierVariable(placeholder)}
                                className="flex w-full items-center justify-between rounded-lg border border-slate-100 bg-white px-3 py-2 text-left hover:border-violet-200 hover:bg-violet-50 group"
                              >
                                <div className="min-w-0">
                                  <code className="block text-[11px] font-mono text-violet-700">{placeholder}</code>
                                  <span className="text-[10px] text-slate-400">{variable.description}</span>
                                </div>
                                <Copy className="h-3 w-3 shrink-0 text-slate-300 group-hover:text-violet-400" />
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Variables personnalisées */}
                <div className="p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Pencil className="h-4 w-4 text-orange-500" />
                      <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-slate-500">Variables personnalisées</h3>
                    </div>
                    <button type="button" onClick={ajouterVariable} className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:border-primaire-300 hover:text-primaire-700">
                      <Plus className="inline h-3 w-3" /> Ajouter
                    </button>
                  </div>

                  {edition.variables_fusion.length === 0 ? (
                    <p className="text-[11px] text-slate-400">Aucune variable personnalisée définie.</p>
                  ) : (
                    <div className="space-y-2">
                      {edition.variables_fusion.map((variable, index) => {
                        const placeholder = `{${variable.nom || `variable_${index + 1}`}}`;
                        return (
                          <div key={`${variable.nom}-${index}`} className="rounded-xl border border-orange-100 bg-orange-50 p-3">
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <button
                                type="button"
                                onClick={() => void copierVariable(placeholder)}
                                className="group flex items-center gap-1.5"
                              >
                                <code className="text-[11px] font-mono text-orange-700">{placeholder}</code>
                                <Copy className="h-3 w-3 text-orange-300 group-hover:text-orange-500" />
                              </button>
                              <button type="button" onClick={() => supprimerVariableFusion(index)} className="text-slate-300 hover:text-red-500">
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                            <input
                              className="champ-saisie w-full mb-1.5"
                              placeholder="nom_variable"
                              value={variable.nom}
                              onChange={(e) => majVariable(index, "nom", e.target.value)}
                            />
                            <input
                              className="champ-saisie w-full mb-1.5"
                              placeholder="Description…"
                              value={variable.description}
                              onChange={(e) => majVariable(index, "description", e.target.value)}
                            />
                            <input
                              className="champ-saisie w-full"
                              placeholder="Exemple de valeur"
                              value={variable.exemple}
                              onChange={(e) => majVariable(index, "exemple", e.target.value)}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {edition.variables_fusion.length > 0 && (
                    <button
                      type="button"
                      onClick={enregistrerModele}
                      disabled={enregistrement}
                      className="mt-3 btn-primaire w-full justify-center text-xs py-1.5"
                    >
                      <Save size={13} /> Sauvegarder les variables
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ---------------------------------------------------------- */}
            {/* Panneau : Gabarit                                           */}
            {/* ---------------------------------------------------------- */}
            {panneauDroit === "gabarit" && (
              <div className="space-y-4 p-4">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-slate-500 mb-1">Gabarit bureautique</h3>
                  <p className="text-[11px] text-slate-400">
                    Téléversez un fichier existant (.docx ou .xlsx) ou laissez l&apos;éditeur Collabora créer le gabarit initial.
                  </p>
                </div>

                {/* Fichier actuel */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center gap-2">
                    {TYPES_TABLEUR.has(edition.type_document)
                      ? <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
                      : <FileText className="h-4 w-4 text-blue-400" />}
                    <span className="flex-1 truncate text-xs text-slate-600">{nomGabarit || "Aucun gabarit"}</span>
                  </div>
                  {edition.gabarit && !supprimerGabarit && (
                    <div className="mt-2 flex gap-2">
                      <a href={edition.gabarit} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600 hover:border-primaire-300">
                        <ExternalLink size={11} /> Télécharger
                      </a>
                      <button type="button" onClick={() => setSupprimerGabarit(true)}
                        className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] text-red-500 hover:border-red-200">
                        <Trash2 size={11} /> Supprimer
                      </button>
                    </div>
                  )}
                  {supprimerGabarit && (
                    <p className="mt-2 text-[11px] text-red-600">Le gabarit sera supprimé lors de la prochaine sauvegarde.</p>
                  )}
                </div>

                {/* Upload */}
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center hover:border-primaire-300 hover:bg-primaire-50 transition">
                  <Upload className="mb-2 h-5 w-5 text-slate-400" />
                  <span className="text-xs font-medium text-slate-700">
                    {fichierGabarit ? fichierGabarit.name : "Choisir un fichier"}
                  </span>
                  <span className="mt-1 text-[11px] text-slate-400">
                    {typeBureautique(edition.type_document) === "tableur" ? ".xlsx" : ".docx"} recommandé
                  </span>
                  <input
                    type="file"
                    accept=".docx,.xlsx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    className="hidden"
                    onChange={(e) => { setFichierGabarit(e.target.files?.[0] || null); setSupprimerGabarit(false); }}
                  />
                </label>

                {fichierGabarit && (
                  <button type="button" onClick={enregistrerModele} disabled={enregistrement} className="btn-primaire w-full justify-center">
                    <Upload size={14} /> {enregistrement ? "Téléversement…" : "Téléverser le gabarit"}
                  </button>
                )}

                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-[11px] text-slate-500">
                  <strong className="text-slate-600">Conseil :</strong> Rédigez directement le gabarit dans Collabora — le fichier est auto-sauvegardé via WOPI. Téléversez un fichier existant uniquement pour migrer un gabarit Word/Excel déjà finalisé.
                </div>
              </div>
            )}
          </div>

          {/* Pied de panneau — actions rapides */}
          {panneauDroit !== "proprietes" && (
            <div className="shrink-0 border-t border-slate-200 p-3">
              <button
                type="button"
                onClick={enregistrerModele}
                disabled={enregistrement || (!edition.code && !edition.id)}
                className="btn-primaire w-full justify-center text-xs py-2"
              >
                {enregistrement ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
                {enregistrement ? "Enregistrement…" : edition.id ? "Mettre à jour" : "Créer le modèle"}
              </button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
