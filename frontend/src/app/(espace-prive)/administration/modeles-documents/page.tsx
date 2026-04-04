"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  Copy,
  Eye,
  ExternalLink,
  FileCog,
  FileSpreadsheet,
  FileText,
  MonitorUp,
  Plus,
  Save,
  Trash2,
  Upload,
} from "lucide-react";
import { api, ErreurApi, requeteApiAvecProgression, type ProgressionTeleversement } from "@/crochets/useApi";
import { EtatTeleversement } from "@/composants/ui/EtatTeleversement";
import { EditeurTexteRiche } from "@/composants/ui/EditeurTexteRiche";
import {
  AlerteAdmin,
  EntetePageAdmin,
} from "@/composants/administration/Presentation";

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

type OngletModele = "bureautique" | "edition" | "apercu" | "gabarit";

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

const VALEURS_APERCU_PAR_DEFAUT: Record<string, string> = {
  nom_projet: "Réhabilitation du groupe scolaire de Mamoudzou",
  reference_projet: "2026-0012",
  description_projet: "Rénovation complète et extension de bâtiments existants.",
  commune_projet: "Mamoudzou",
  departement_projet: "Mayotte",
  phase_projet: "PRO",
  statut_projet: "En cours",
  maitre_ouvrage: "Ville de Mamoudzou",
  maitre_oeuvre: "Cabinet ABC Architecture",
  organisation: "BEE",
  responsable_projet: "Anne Rédactrice",
  date_generation: "02/04/2026",
  lot_intitule: "Gros œuvre",
  lot_numero: "01",
  redacteur_nom: "Anne Rédactrice",
  piece_intitule: "CCTP Lot 01 — Gros œuvre",
  modele_libelle: "Modèle standard",
  contenu_principal: "Contenu principal injecté automatiquement dans le gabarit bureautique.",
};

const MODELE_VIDE: ModeleDocument = {
  id: "",
  code: "",
  libelle: "",
  type_document: "cctp",
  type_libelle: "CCTP",
  description: "",
  gabarit: null,
  variables_fusion: [],
  contenu_modele_html: "<h1>{piece_intitule}</h1><p><strong>Projet :</strong> {reference_projet} — {nom_projet}</p>",
  est_actif: true,
  date_creation: "",
  date_modification: "",
};

const TYPES_TABLEUR = new Set(["dpgf", "bpu", "dqe"]);

function typeBureautique(typeDocument: string) {
  return TYPES_TABLEUR.has(typeDocument) ? "tableur" : "texte";
}

function libelleEditeur(typeDocument: string) {
  return typeBureautique(typeDocument) === "tableur" ? "Excel" : "Word";
}

function echapperHtml(valeur: string) {
  return valeur
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normaliserModele(modele?: Partial<ModeleDocument> | null): ModeleDocument {
  return {
    ...MODELE_VIDE,
    ...modele,
    variables_fusion: Array.isArray(modele?.variables_fusion)
      ? modele.variables_fusion.map((variable) => ({
          nom: variable.nom || "",
          description: variable.description || "",
          exemple: variable.exemple || "",
        }))
      : [],
    contenu_modele_html: modele?.contenu_modele_html || MODELE_VIDE.contenu_modele_html,
  };
}

function extraireNomFichier(url: string | null) {
  if (!url) return null;
  try {
    const urlComplete = new URL(url, window.location.origin);
    return decodeURIComponent(urlComplete.pathname.split("/").pop() || "");
  } catch {
    return url.split("/").pop() || url;
  }
}

function construireApercu(modele: ModeleDocument) {
  const contenu = (modele.contenu_modele_html || "").trim();
  if (!contenu) return "<p>Aucun contenu visuel n'est encore défini pour ce modèle.</p>";

  const valeurs = { ...VALEURS_APERCU_PAR_DEFAUT };
  for (const variable of modele.variables_fusion) {
    if (!variable.nom.trim()) continue;
    valeurs[variable.nom.trim()] =
      variable.exemple.trim() || variable.description.trim() || `Valeur de démonstration pour ${variable.nom.trim()}`;
  }

  return contenu.replace(/\{([^{}]+)\}/g, (_correspondance, nomBrut) => {
    const nom = String(nomBrut || "").trim();
    return echapperHtml(valeurs[nom] || "");
  });
}

export default function PageAdministrationModelesDocuments() {
  const identifiantIframe = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const cibleIframe = `collabora-modele-${identifiantIframe}`;
  const formulaireBureautiqueRef = useRef<HTMLFormElement | null>(null);
  const [modeles, setModeles] = useState<ModeleDocument[]>([]);
  const [selectionId, setSelectionId] = useState<string>("");
  const [edition, setEdition] = useState<ModeleDocument>(MODELE_VIDE);
  const [onglet, setOnglet] = useState<OngletModele>("bureautique");
  const [chargement, setChargement] = useState(true);
  const [enregistrement, setEnregistrement] = useState(false);
  const [suppression, setSuppression] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  const [fichierGabarit, setFichierGabarit] = useState<File | null>(null);
  const [supprimerGabarit, setSupprimerGabarit] = useState(false);
  const [progressionTeleversement, setProgressionTeleversement] = useState<ProgressionTeleversement | null>(null);
  const [sessionBureautique, setSessionBureautique] = useState<SessionBureautique | null>(null);
  const [chargementBureautique, setChargementBureautique] = useState(false);

  async function chargerModeles(selectionCible?: string) {
    setChargement(true);
    setErreur(null);
    try {
      const reponse = await api.get<{ results?: ModeleDocument[] }>("/api/pieces-ecrites/modeles/?inclure_inactifs=1");
      const liste = reponse.results ?? [];
      setModeles(liste);

      const idSelection = selectionCible ?? selectionId;
      if (idSelection) {
        const modeleSelectionne = liste.find((modele) => modele.id === idSelection);
        if (modeleSelectionne) {
          setSelectionId(modeleSelectionne.id);
          setEdition(normaliserModele(modeleSelectionne));
          return;
        }
      }

      if (liste.length > 0) {
        setSelectionId(liste[0].id);
        setEdition(normaliserModele(liste[0]));
      } else {
        setSelectionId("");
        setEdition(normaliserModele(null));
      }
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Impossible de charger les modèles de documents.");
    } finally {
      setChargement(false);
    }
  }

  useEffect(() => {
    void chargerModeles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    setSessionBureautique(null);
  }, [edition.id, edition.type_document]);
  useEffect(() => {
    if (!sessionBureautique || !formulaireBureautiqueRef.current) return;
    formulaireBureautiqueRef.current.submit();
  }, [sessionBureautique]);

  const apercuHtml = useMemo(() => construireApercu(edition), [edition]);
  const onglets: { id: OngletModele; libelle: string }[] = [
    { id: "bureautique", libelle: `${libelleEditeur(edition.type_document)} / Collabora` },
    { id: "edition", libelle: "Variables" },
    { id: "apercu", libelle: "Aperçu HTML" },
    { id: "gabarit", libelle: "Gabarit bureautique" },
  ];

  function selectionnerModele(modele: ModeleDocument) {
    setSelectionId(modele.id);
    setEdition(normaliserModele(modele));
    setFichierGabarit(null);
    setSupprimerGabarit(false);
    setSessionBureautique(null);
    setErreur(null);
    setSucces(null);
  }

  function nouveauModele() {
    setSelectionId("");
    setEdition(normaliserModele(null));
    setFichierGabarit(null);
    setSupprimerGabarit(false);
    setSessionBureautique(null);
    setErreur(null);
    setSucces(null);
    setOnglet("bureautique");
  }

  async function ouvrirEditeurBureautique() {
    if (!edition.id) {
      setErreur("Enregistrez d'abord le modèle avant d'ouvrir l'éditeur bureautique.");
      return;
    }

    setChargementBureautique(true);
    setErreur(null);
    try {
      const session = await api.post<SessionBureautique>(`/api/pieces-ecrites/modeles/${edition.id}/session-bureautique/`, {});
      setSessionBureautique(session);
      setSucces(`Éditeur ${session.type_bureautique === "tableur" ? "Excel" : "Word"} prêt.`);
      setTimeout(() => setSucces(null), 2500);
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Impossible d'ouvrir l'éditeur bureautique.");
    } finally {
      setChargementBureautique(false);
    }
  }

  async function copierPlaceholder(placeholder: string) {
    try {
      await navigator.clipboard.writeText(placeholder);
      setSucces(`Variable copiée : ${placeholder}`);
      setTimeout(() => setSucces(null), 2000);
    } catch {
      setErreur(`Impossible de copier ${placeholder}.`);
    }
  }

  function mettreAJourVariable(index: number, champ: keyof VariableFusion, valeur: string) {
    setEdition((precedent) => {
      const variables = [...precedent.variables_fusion];
      variables[index] = { ...variables[index], [champ]: valeur };
      return { ...precedent, variables_fusion: variables };
    });
  }

  function ajouterVariable() {
    setEdition((precedent) => ({
      ...precedent,
      variables_fusion: [...precedent.variables_fusion, { nom: "", description: "", exemple: "" }],
    }));
  }

  function supprimerVariable(index: number) {
    setEdition((precedent) => ({
      ...precedent,
      variables_fusion: precedent.variables_fusion.filter((_, i) => i !== index),
    }));
  }

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
      formData.append("variables_fusion", JSON.stringify(edition.variables_fusion.filter((variable) => variable.nom.trim())));
      formData.append("est_actif", String(edition.est_actif));
      if (fichierGabarit) {
        formData.append("gabarit", fichierGabarit);
      }
      if (supprimerGabarit) {
        formData.append("supprimer_gabarit", "true");
      }

      const url = edition.id ? `/api/pieces-ecrites/modeles/${edition.id}/` : "/api/pieces-ecrites/modeles/";
      const methode = edition.id ? "PATCH" : "POST";

      const modeleSauvegarde = await requeteApiAvecProgression<ModeleDocument>(url, {
        method: methode,
        corps: formData,
        onProgression: setProgressionTeleversement,
      });

      await chargerModeles(modeleSauvegarde.id);
      setFichierGabarit(null);
      setSupprimerGabarit(false);
      setSucces(edition.id ? "Modèle mis à jour." : "Modèle créé.");
      setTimeout(() => setSucces(null), 3000);
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Impossible d'enregistrer le modèle.");
    } finally {
      setEnregistrement(false);
      setTimeout(() => setProgressionTeleversement(null), 500);
    }
  }

  async function supprimerModele() {
    if (!edition.id) return;
    if (!window.confirm(`Supprimer définitivement le modèle « ${edition.libelle} » ?`)) {
      return;
    }

    setSuppression(true);
    setErreur(null);
    setSucces(null);
    try {
      await api.supprimer(`/api/pieces-ecrites/modeles/${edition.id}/`);
      await chargerModeles();
      nouveauModele();
      setSucces("Modèle supprimé.");
      setTimeout(() => setSucces(null), 3000);
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Impossible de supprimer le modèle.");
    } finally {
      setSuppression(false);
    }
  }

  const nomGabarit = fichierGabarit?.name || (supprimerGabarit ? null : extraireNomFichier(edition.gabarit));

  return (
    <div className="space-y-6">
      <EntetePageAdmin
        titre="Modèles de documents"
        description="Édition visuelle, variables de fusion et gabarits bureautiques pour les pièces écrites."
        actions={<button type="button" onClick={nouveauModele} className="btn-primaire"><Plus size={16} /> Nouveau modèle</button>}
        statistiques={[
          { libelle: "Modèles", valeur: `${modeles.length}` },
          { libelle: "Variables par défaut", valeur: `${Object.keys(VALEURS_APERCU_PAR_DEFAUT).length}` },
          { libelle: "Élément actif", valeur: edition.libelle || "Aucun" },
        ]}
      />

      {erreur && <AlerteAdmin type="erreur">{erreur}</AlerteAdmin>}
      {succes && <AlerteAdmin type="succes">{succes}</AlerteAdmin>}

      <EtatTeleversement progression={progressionTeleversement} libelle="Enregistrement du modèle et du gabarit" />

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="carte p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-slate-800">Bibliothèque des modèles</h2>
            <span className="text-xs text-slate-400">{modeles.length} modèle(s)</span>
          </div>

          {chargement ? (
            <div className="py-6 text-sm text-slate-400">Chargement des modèles…</div>
          ) : modeles.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
              Aucun modèle n&apos;est encore défini.
            </div>
          ) : (
            <div className="space-y-2">
              {modeles.map((modele) => (
                <button
                  key={modele.id}
                  type="button"
                  onClick={() => selectionnerModele(modele)}
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                    selectionId === modele.id
                      ? "border-primaire-200 bg-primaire-50"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-800">{modele.libelle}</div>
                      <div className="mt-1 text-xs font-mono text-slate-500">{modele.code}</div>
                    </div>
                    <span
                      className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                        modele.est_actif ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {modele.est_actif ? "Actif" : "Inactif"}
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-slate-500">{modele.type_libelle}</div>
                </button>
              ))}
            </div>
          )}
        </aside>

        <section className="space-y-5">
          <div className="carte space-y-5">
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <label className="libelle-champ" htmlFor="code">
                  Code <span className="text-red-500">*</span>
                </label>
                <input
                  id="code"
                  className="champ-saisie w-full"
                  value={edition.code}
                  onChange={(event) => setEdition((precedent) => ({ ...precedent, code: event.target.value.toUpperCase() }))}
                  placeholder="Ex. : CCTP_STANDARD"
                />
              </div>
              <div>
                <label className="libelle-champ" htmlFor="libelle">
                  Libellé <span className="text-red-500">*</span>
                </label>
                <input
                  id="libelle"
                  className="champ-saisie w-full"
                  value={edition.libelle}
                  onChange={(event) => setEdition((precedent) => ({ ...precedent, libelle: event.target.value }))}
                  placeholder="Ex. : CCTP standard bâtiments"
                />
              </div>
              <div>
                <label className="libelle-champ" htmlFor="type-document">
                  Type de document
                </label>
                <select
                  id="type-document"
                  className="champ-saisie w-full"
                  value={edition.type_document}
                  onChange={(event) => setEdition((precedent) => ({ ...precedent, type_document: event.target.value }))}
                >
                  {TYPES_DOCUMENTS.map((typeDocument) => (
                    <option key={typeDocument.valeur} value={typeDocument.valeur}>
                      {typeDocument.libelle}
                    </option>
                  ))}
                </select>
              </div>
              <label className="mt-7 inline-flex items-center gap-3 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-primaire-600 focus:ring-primaire-500"
                  checked={edition.est_actif}
                  onChange={(event) => setEdition((precedent) => ({ ...precedent, est_actif: event.target.checked }))}
                />
                Modèle actif pour la génération des nouvelles pièces
              </label>
            </div>

            <div>
              <label className="libelle-champ" htmlFor="description">
                Description métier
              </label>
              <textarea
                id="description"
                className="champ-saisie w-full min-h-[96px]"
                value={edition.description}
                onChange={(event) => setEdition((precedent) => ({ ...precedent, description: event.target.value }))}
                placeholder="Décrivez l'usage, le contexte et les règles de fusion de ce modèle."
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-1">
              {onglets.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setOnglet(item.id)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    onglet === item.id
                      ? "bg-primaire-100 text-primaire-700"
                      : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                  }`}
                >
                  {item.libelle}
                </button>
              ))}
            </div>

            {onglet === "bureautique" && (
              <div className="grid gap-5 xl:grid-cols-[1.25fr_0.85fr]">
                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h2 className="text-sm font-semibold text-slate-800">
                          Éditeur {libelleEditeur(edition.type_document)} intégré
                        </h2>
                        <p className="mt-1 text-sm text-slate-500">
                          Mise en page bureautique réelle via Collabora Online. Les placeholders comme
                          <code className="ml-1">{"{nom_projet}"}</code> ou <code className="ml-1">{"{reference_projet}"}</code>
                          seront remplacés lors des exports.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={ouvrirEditeurBureautique} className="btn-primaire" disabled={chargementBureautique || !edition.id}>
                          <MonitorUp size={16} />
                          {chargementBureautique ? "Ouverture…" : `Ouvrir ${libelleEditeur(edition.type_document)}`}
                        </button>
                        {sessionBureautique?.gabarit && (
                          <a href={sessionBureautique.gabarit} target="_blank" rel="noopener noreferrer" className="btn-secondaire">
                            <ExternalLink size={16} />
                            Télécharger le gabarit
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  {!edition.id ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-500">
                      Enregistrez d&apos;abord le modèle pour créer son gabarit Word/Excel et ouvrir l&apos;éditeur.
                    </div>
                  ) : !sessionBureautique ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-500">
                      Cliquez sur « Ouvrir {libelleEditeur(edition.type_document)} » pour éditer le gabarit bureautique réel.
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                      <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
                        <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                          {sessionBureautique.type_bureautique === "tableur" ? <FileSpreadsheet size={16} /> : <FileText size={16} />}
                          {sessionBureautique.nom_fichier}
                        </div>
                        <span className="badge-neutre">
                          {sessionBureautique.type_bureautique === "tableur" ? "Mode tableur" : "Mode traitement de texte"}
                        </span>
                      </div>
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
                        title={`Éditeur bureautique ${edition.libelle || edition.code}`}
                        className="h-[980px] w-full border-0"
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <h3 className="text-sm font-semibold text-slate-800">Variables à coller dans le document</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Collez ces marqueurs directement dans Word/Excel. Ils seront remplacés par les valeurs du projet.
                    </p>
                    <div className="mt-3 space-y-2">
                      {Object.keys(VALEURS_APERCU_PAR_DEFAUT).map((cle) => {
                        const placeholder = `{${cle}}`;
                        return (
                          <button
                            key={cle}
                            type="button"
                            onClick={() => copierPlaceholder(placeholder)}
                            className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-left font-mono text-xs text-slate-700 hover:border-primaire-200 hover:bg-primaire-50"
                          >
                            <span>{placeholder}</span>
                            <Copy size={14} className="text-slate-400" />
                          </button>
                        );
                      })}
                      {edition.variables_fusion.map((variable, index) => {
                        const placeholder = `{${variable.nom || `variable_${index + 1}`}}`;
                        return (
                          <button
                            key={`${variable.nom}-${index}`}
                            type="button"
                            onClick={() => copierPlaceholder(placeholder)}
                            className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-left"
                          >
                            <div>
                              <div className="font-mono text-xs text-slate-700">{placeholder}</div>
                              <div className="mt-1 text-xs text-slate-500">{variable.description || "Variable personnalisée"}</div>
                            </div>
                            <Copy size={14} className="text-slate-400" />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                    <h3 className="text-sm font-semibold text-slate-800">Bon usage</h3>
                    <ul className="mt-3 list-disc space-y-2 pl-5">
                      <li>Pour les CCTP, CCAP, RC, AE et rapports, utilisez un gabarit Word `.docx`.</li>
                      <li>Pour les BPU, DQE et DPGF, utilisez un gabarit Excel `.xlsx`.</li>
                      <li>Saisissez les variables sous la forme exacte <code>{"{nom_variable}"}</code>.</li>
                      <li>Évitez de styliser différemment les caractères à l&apos;intérieur d&apos;une même variable.</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {onglet === "edition" && (
              <div className="space-y-5">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-semibold text-slate-800">Variables de fusion</h2>
                      <p className="mt-1 text-xs text-slate-500">
                        Définissez les placeholders disponibles dans le modèle visuel et dans le gabarit bureautique.
                      </p>
                    </div>
                    <button type="button" onClick={ajouterVariable} className="btn-secondaire">
                      <Plus size={14} /> Ajouter
                    </button>
                  </div>

                  <div className="space-y-3">
                    {edition.variables_fusion.length === 0 && (
                      <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-5 text-sm text-slate-500">
                        Aucune variable personnalisée pour le moment.
                      </div>
                    )}
                    {edition.variables_fusion.map((variable, index) => (
                      <div key={`${variable.nom}-${index}`} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-[1fr_1.2fr_1.2fr_auto]">
                        <input
                          className="champ-saisie w-full"
                          placeholder="nom_variable"
                          value={variable.nom}
                          onChange={(event) => mettreAJourVariable(index, "nom", event.target.value)}
                        />
                        <input
                          className="champ-saisie w-full"
                          placeholder="Description"
                          value={variable.description}
                          onChange={(event) => mettreAJourVariable(index, "description", event.target.value)}
                        />
                        <input
                          className="champ-saisie w-full"
                          placeholder="Exemple"
                          value={variable.exemple}
                          onChange={(event) => mettreAJourVariable(index, "exemple", event.target.value)}
                        />
                        <button type="button" onClick={() => supprimerVariable(index)} className="btn-secondaire justify-center">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-semibold text-slate-800">Contenu HTML hérité</h2>
                      <p className="mt-1 text-xs text-slate-500">
                        Cette zone reste disponible pour l&apos;ancien moteur HTML, mais l&apos;éditeur recommandé est désormais l&apos;onglet bureautique.
                      </p>
                    </div>
                    <button type="button" onClick={() => setOnglet("apercu")} className="btn-secondaire">
                      <Eye size={14} /> Voir l&apos;aperçu
                    </button>
                  </div>
                  <EditeurTexteRiche
                    valeur={edition.contenu_modele_html}
                    onChange={(contenu) => setEdition((precedent) => ({ ...precedent, contenu_modele_html: contenu }))}
                    placeholder="Rédigez le modèle visuel complet avec vos titres, tableaux, styles et placeholders de fusion."
                    hauteurMinimale="min-h-[460px]"
                  />
                </div>
              </div>
            )}

            {onglet === "apercu" && (
              <div className="grid gap-5 xl:grid-cols-[1.6fr_0.9fr]">
                <div className="rounded-2xl border border-slate-200 bg-white">
                  <div className="border-b border-slate-200 px-4 py-3">
                    <h2 className="text-sm font-semibold text-slate-800">Aperçu rendu du modèle</h2>
                    <p className="mt-1 text-xs text-slate-500">
                      Les placeholders sont remplacés ici par des valeurs de démonstration.
                    </p>
                  </div>
                  <div className="webmail-editeur min-h-[480px] px-5 py-5" dangerouslySetInnerHTML={{ __html: apercuHtml }} />
                </div>

                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <h3 className="text-sm font-semibold text-slate-800">Variables automatiques disponibles</h3>
                    <div className="mt-3 space-y-2 text-sm text-slate-600">
                      {Object.keys(VALEURS_APERCU_PAR_DEFAUT).map((cle) => (
                        <div key={cle} className="rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs">
                          {`{${cle}}`}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <h3 className="text-sm font-semibold text-slate-800">Variables du modèle</h3>
                    <div className="mt-3 space-y-2">
                      {edition.variables_fusion.length === 0 && (
                        <p className="text-sm text-slate-500">Aucune variable personnalisée définie.</p>
                      )}
                      {edition.variables_fusion.map((variable, index) => (
                        <div key={`${variable.nom}-${index}`} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                          <div className="font-mono text-xs text-slate-700">{`{${variable.nom || "nom_variable"}}`}</div>
                          <div className="mt-1 text-xs text-slate-500">{variable.description || "Sans description"}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {onglet === "gabarit" && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h2 className="text-sm font-semibold text-slate-800">Gabarit bureautique</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Téléversez un fichier <code>.docx</code> ou <code>.xlsx</code> contenant les placeholders à fusionner.
                  </p>

                  <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-8 text-center">
                    <Upload className="mb-3 h-6 w-6 text-slate-400" />
                    <span className="text-sm font-medium text-slate-700">
                      {fichierGabarit ? "Remplacer le gabarit sélectionné" : "Choisir un gabarit bureautique"}
                    </span>
                    <span className="mt-1 text-xs text-slate-500">
                      {typeBureautique(edition.type_document) === "tableur"
                        ? "XLSX recommandé pour les BPU, DQE et DPGF."
                        : "DOCX recommandé pour la fusion complète des contenus et tableaux."}
                    </span>
                    <input
                      type="file"
                      accept=".docx,.xlsx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                      className="hidden"
                      onChange={(event) => setFichierGabarit(event.target.files?.[0] || null)}
                    />
                  </label>

                  <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <FileText size={16} className="text-slate-400" />
                        <span>{nomGabarit || "Aucun gabarit rattaché."}</span>
                      </div>
                      {edition.gabarit && !supprimerGabarit && (
                        <button type="button" onClick={() => setSupprimerGabarit(true)} className="btn-secondaire">
                          <Trash2 size={14} /> Retirer
                        </button>
                      )}
                    </div>
                    {edition.gabarit && !supprimerGabarit && (
                      <a
                        href={edition.gabarit}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-flex text-sm text-primaire-600 hover:underline"
                      >
                        Ouvrir le gabarit actuel
                      </a>
                    )}
                    {supprimerGabarit && (
                      <p className="mt-3 text-sm text-amber-700">
                        Le gabarit actuel sera supprimé lors du prochain enregistrement.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-4">
              <button type="button" onClick={enregistrerModele} className="btn-primaire" disabled={enregistrement}>
                <Save size={16} /> {enregistrement ? "Enregistrement…" : "Enregistrer le modèle"}
              </button>
              <button
                type="button"
                onClick={supprimerModele}
                className="btn-secondaire"
                disabled={!edition.id || suppression}
              >
                <Trash2 size={16} /> {suppression ? "Suppression…" : "Supprimer"}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
