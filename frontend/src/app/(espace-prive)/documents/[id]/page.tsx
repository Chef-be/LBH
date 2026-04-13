"use client";

import { useState, useEffect, use, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ErreurApi, extraireListeResultats } from "@/crochets/useApi";
import { useSessionStore } from "@/crochets/useSession";
import {
  ArrowLeft, FileText, CheckCircle, AlertCircle, X, Clock,
  Download, GitBranch, MessageSquare, Send, ScanText,
  Shield, Eye, EyeOff, RefreshCw, ChevronRight, Pencil, Save, Trash2, LibraryBig,
  Layers, FileSpreadsheet, BookOpen, Calculator,
} from "lucide-react";
import { ApercuFichierModal } from "@/composants/ui/ApercuFichierModal";

interface Annotation {
  id: string;
  auteur_nom: string;
  contenu: string;
  page: number | null;
  resolue: boolean;
  date_creation: string;
}

interface Diffusion {
  id: string;
  destinataire_nom: string;
  destinataire_contact: string;
  mode_libelle: string;
  date_diffusion: string;
}

interface TypeDocumentOption {
  id: string;
  libelle: string;
}

interface DossierDocumentOption {
  id: string;
  chemin?: string;
  intitule: string;
}

interface DocumentDetail {
  id: string;
  reference: string;
  intitule: string;
  type_document: string;
  type_libelle: string;
  projet: string;
  projet_reference: string;
  dossier: string | null;
  dossier_libelle: string | null;
  dossier_chemin: string | null;
  version: string;
  statut: string;
  statut_libelle: string;
  origine: string;
  taille_octets: number | null;
  type_mime: string;
  nom_fichier_origine: string;
  empreinte_sha256: string;
  auteur_nom: string | null;
  valide_par_nom: string | null;
  date_creation: string;
  date_modification: string;
  date_validation: string | null;
  ocr_effectue: boolean;
  contenu_texte: string;
  mots_cles: string[];
  analyse_automatique_effectuee: boolean;
  date_analyse_automatique: string | null;
  analyse_automatique: Record<string, unknown>;
  bureautique_editable?: boolean;
  acces_client: boolean;
  acces_partenaire: boolean;
  confidentiel: boolean;
  annotations: Annotation[];
  diffusions: Diffusion[];
  fichier: string | null;
}

const STATUTS: Record<string, { libelle: string; classe: string }> = {
  brouillon:     { libelle: "Brouillon",     classe: "badge-neutre" },
  en_revision:   { libelle: "En révision",   classe: "bg-yellow-100 text-yellow-700 border border-yellow-200" },
  en_validation: { libelle: "En validation", classe: "bg-orange-100 text-orange-700 border border-orange-200" },
  valide:        { libelle: "Validé",        classe: "badge-succes" },
  diffuse:       { libelle: "Diffusé",       classe: "bg-blue-100 text-blue-700 border border-blue-200" },
  obsolete:      { libelle: "Obsolète",      classe: "bg-slate-100 text-slate-500 border border-slate-200" },
  archive:       { libelle: "Archivé",       classe: "badge-danger" },
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatTaille(octets: number | null): string {
  if (!octets) return "—";
  if (octets < 1024) return `${octets} o`;
  if (octets < 1024 * 1024) return `${(octets / 1024).toFixed(0)} Ko`;
  return `${(octets / (1024 * 1024)).toFixed(1)} Mo`;
}

export default function PageDetailDocument({
  params,
  projetId,
}: {
  params: Promise<{ id: string }>;
  projetId?: string;
}) {
  const { id } = use(params);
  const router = useRouter();
  const utilisateur = useSessionStore((etat) => etat.utilisateur);
  const estSuperAdmin = Boolean(utilisateur?.est_super_admin);
  const [doc, setDoc] = useState<DocumentDetail | null>(null);
  const [chargement, setChargement] = useState(true);
  const [succes, setSucces] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [ocrEnCours, setOcrEnCours] = useState(false);
  const [analyseEnCours, setAnalyseEnCours] = useState(false);
  const [onglet, setOnglet] = useState<"details" | "analyse" | "ocr" | "annotations" | "diffusions">("details");
  const [nouvelleAnnotation, setNouvelleAnnotation] = useState("");
  const [envoyerAnnotation, setEnvoyerAnnotation] = useState(false);
  const [afficherTexteOcr, setAfficherTexteOcr] = useState(false);
  const [apercuOuvert, setApercuOuvert] = useState(false);
  const [modeEdition, setModeEdition] = useState(false);
  const [referenceEdition, setReferenceEdition] = useState("");
  const [intituleEdition, setIntituleEdition] = useState("");
  const [typeDocumentEdition, setTypeDocumentEdition] = useState("");
  const [dossierEdition, setDossierEdition] = useState("");
  const [confidentielEdition, setConfidentielEdition] = useState(false);
  const [enregistrementEdition, setEnregistrementEdition] = useState(false);
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);
  const [importBibliothequeEnCours, setImportBibliothequeEnCours] = useState(false);
  const [extractionCctpEnCours, setExtractionCctpEnCours] = useState(false);
  const [creationEtudeEnCours, setCreationEtudeEnCours] = useState(false);
  const [typesDocuments, setTypesDocuments] = useState<TypeDocumentOption[]>([]);
  const [dossiersProjet, setDossiersProjet] = useState<DossierDocumentOption[]>([]);
  const [sessionCollabora, setSessionCollabora] = useState<{
    url_editeur: string; access_token: string; access_token_ttl: number;
    nom_fichier: string; type_bureautique: string;
  } | null>(null);
  const [chargementCollabora, setChargementCollabora] = useState(false);
  const [editeurOuvert, setEditeurOuvert] = useState(false);
  const formulaireCollaboraRef = useRef<HTMLFormElement | null>(null);
  const cibleCollabora = `collabora-doc-${id.replace(/-/g, "")}`;

  const baseDocumentsProjet = projetId ? `/projets/${projetId}/documents` : doc?.projet ? `/projets/${doc.projet}/documents` : null;
  const lienRetour = baseDocumentsProjet || "/documents";
  const libelleRetour = baseDocumentsProjet ? "Documents du projet" : "Documents";

  const charger = useCallback(async () => {
    try {
      const donnees = await api.get<DocumentDetail>(`/api/documents/${id}/`);
      setDoc(donnees);
      setReferenceEdition(donnees.reference);
      setIntituleEdition(donnees.intitule);
      setTypeDocumentEdition(donnees.type_document);
      setDossierEdition(donnees.dossier || "");
      setConfidentielEdition(donnees.confidentiel);
    } catch {
      setErreur("Document introuvable.");
    } finally {
      setChargement(false);
    }
  }, [id]);

  useEffect(() => { charger(); }, [charger]);

  useEffect(() => {
    api.get<TypeDocumentOption[]>("/api/documents/types/")
      .then((donnees) => setTypesDocuments(extraireListeResultats<TypeDocumentOption>(donnees as never)))
      .catch(() => setTypesDocuments([]));
  }, []);

  useEffect(() => {
    const projetCible = projetId || doc?.projet;
    if (!projetCible) return;
    api.get<DossierDocumentOption[]>(`/api/documents/dossiers/?projet=${projetCible}`)
      .then((donnees) => setDossiersProjet(extraireListeResultats<DossierDocumentOption>(donnees as never)))
      .catch(() => setDossiersProjet([]));
  }, [doc?.projet, projetId]);

  const flash = (msg: string) => { setSucces(msg); setTimeout(() => setSucces(null), 3500); };

  const valider = async () => {
    try {
      await api.post(`/api/documents/${id}/valider/`, {});
      flash("Document validé.");
      charger();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Impossible de valider.");
    }
  };

  const lancerOcr = async () => {
    setOcrEnCours(true);
    try {
      const res = await api.post<{ detail: string; pages: number; confiance: number }>(`/api/documents/${id}/ocr/`, {});
      flash(`OCR terminé — ${res.pages} page(s), confiance ${res.confiance}%`);
      setOnglet("ocr");
      charger();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Erreur lors de l'OCR.");
    } finally {
      setOcrEnCours(false);
    }
  };

  const lancerAnalyse = async () => {
    setAnalyseEnCours(true);
    try {
      await api.post(`/api/documents/${id}/analyser/`, {});
      flash("Analyse documentaire terminée.");
      setOnglet("analyse");
      charger();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Erreur lors de l'analyse.");
    } finally {
      setAnalyseEnCours(false);
    }
  };

  const ajouterAnnotation = async () => {
    if (!nouvelleAnnotation.trim()) return;
    setEnvoyerAnnotation(true);
    try {
      await api.post(`/api/documents/${id}/annotations/`, { contenu: nouvelleAnnotation, document: id });
      setNouvelleAnnotation("");
      flash("Annotation ajoutée.");
      charger();
    } catch {
      setErreur("Impossible d'ajouter l'annotation.");
    } finally {
      setEnvoyerAnnotation(false);
    }
  };

  const enregistrerEdition = async () => {
    if (!referenceEdition.trim()) {
      setErreur("La référence du document est requise.");
      return;
    }
    if (!intituleEdition.trim()) {
      setErreur("L'intitulé du document est requis.");
      return;
    }

    setEnregistrementEdition(true);
    try {
      const reponse = await api.patch<DocumentDetail>(`/api/documents/${id}/`, {
        reference: referenceEdition.trim(),
        intitule: intituleEdition.trim(),
        type_document: typeDocumentEdition,
        dossier: dossierEdition || null,
        confidentiel: confidentielEdition,
      });
      setDoc(reponse);
      setReferenceEdition(reponse.reference);
      setIntituleEdition(reponse.intitule);
      setTypeDocumentEdition(reponse.type_document);
      setDossierEdition(reponse.dossier || "");
      setConfidentielEdition(reponse.confidentiel);
      setModeEdition(false);
      flash("Document mis à jour.");
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Impossible d'enregistrer le document.");
    } finally {
      setEnregistrementEdition(false);
    }
  };

  const supprimerDocument = async () => {
    if (!doc) return;
    const confirmation = window.confirm(
      estSuperAdmin
        ? `Supprimer définitivement le document ${doc.reference} ? Cette action est irréversible.`
        : `Archiver le document ${doc.reference} ?`
    );
    if (!confirmation) return;

    setSuppressionEnCours(true);
    try {
      await api.supprimer(`/api/documents/${id}/`);
      router.push(lienRetour);
      router.refresh();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Impossible de supprimer le document.");
    } finally {
      setSuppressionEnCours(false);
    }
  };

  const importerDansBibliotheque = async () => {
    const limite = window.prompt(
      "Limiter le nombre de lignes importées depuis ce document (laisser vide pour tout importer) ?",
      ""
    );

    setImportBibliothequeEnCours(true);
    try {
      const reponse = await api.post<{ detail: string; lignes: number; creees: number; mises_a_jour: number }>(
        `/api/documents/${id}/importer-bibliotheque/`,
        {
          limite: limite?.trim() || undefined,
        }
      );
      flash(
        `${reponse.detail} ${reponse.lignes} ligne(s), ${reponse.creees} création(s), ${reponse.mises_a_jour} mise(s) à jour.`
      );
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Impossible d'importer ce document dans la bibliothèque.");
    } finally {
      setImportBibliothequeEnCours(false);
    }
  };

  const creerEtudePrix = async () => {
    if (!doc) return;
    setCreationEtudeEnCours(true);
    setErreur(null);
    try {
      const reponse = await api.post<{ detail: string; id: string }>(
        `/api/documents/${id}/creer-etude-prix/`,
        { intitule: `${doc.intitule} — Étude de prix` }
      );
      router.push(`/economie/etudes-de-prix/${reponse.id}`);
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Impossible de créer l'étude de prix.");
      setCreationEtudeEnCours(false);
    }
  };

  const extraireCctp = async () => {
    setExtractionCctpEnCours(true);
    setErreur(null);
    try {
      const reponse = await api.post<{ detail: string; nb_articles: number; nb_articles_crees: number; erreurs: string[] }>(
        `/api/pieces-ecrites/analyser-document/${id}/`,
        {}
      );
      flash(reponse.detail);
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Impossible d'extraire les articles CCTP depuis ce document.");
    } finally {
      setExtractionCctpEnCours(false);
    }
  };

  const ouvrirCollabora = async () => {
    setChargementCollabora(true);
    setErreur(null);
    try {
      const session = await api.post<{
        url_editeur: string; access_token: string; access_token_ttl: number;
        nom_fichier: string; type_bureautique: string;
      }>(`/api/documents/${id}/session-bureautique/`, {});
      setSessionCollabora(session);
      setEditeurOuvert(true);
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Impossible d'ouvrir l'éditeur Collabora.");
    } finally {
      setChargementCollabora(false);
    }
  };

  // Soumettre le formulaire caché dès que la session est prête
  useEffect(() => {
    if (!sessionCollabora || !formulaireCollaboraRef.current || !editeurOuvert) return;
    formulaireCollaboraRef.current.submit();
  }, [sessionCollabora, editeurOuvert]);

  const typesMimeOcr = new Set(["application/pdf", "image/png", "image/jpeg", "image/tiff", "image/bmp", "image/webp"]);

  if (chargement) {
    return (
      <div className="py-20 text-center text-slate-400 text-sm">Chargement…</div>
    );
  }

  if (!doc) {
    return (
      <div className="space-y-4">
        <Link href={lienRetour} className="flex items-center gap-2 text-slate-400 hover:text-slate-600 text-sm">
          <ArrowLeft className="w-4 h-4" />Retour
        </Link>
        <div className="py-20 text-center text-red-500">Document introuvable.</div>
      </div>
    );
  }

  const statut = STATUTS[doc.statut] ?? { libelle: doc.statut_libelle, classe: "badge-neutre" };
  const peutValider = doc.statut === "en_validation" || doc.statut === "brouillon";
  const peutOcr = !doc.ocr_effectue && doc.type_mime && typesMimeOcr.has(doc.type_mime);
  const peutImporterBibliotheque = Boolean(doc.contenu_texte || doc.fichier);
  const analyse = doc.analyse_automatique || {};
  const services = (analyse.services as Record<string, Record<string, unknown>> | undefined) || {};
  const classification = (analyse.classification as Record<string, unknown> | undefined) || {};
  const suggestions = (analyse.suggestions as Record<string, Record<string, unknown>> | undefined) || {};
  const erreursAnalyse = Array.isArray(analyse.erreurs) ? analyse.erreurs as Array<Record<string, unknown>> : [];
  const typeDetecte = classification.type_document as Record<string, unknown> | undefined;
  const projetSuggere = suggestions.projet as Record<string, unknown> | undefined;
  // Éditeur plein écran quand la session Collabora est active
  if (editeurOuvert && sessionCollabora) {
    return (
      <div className="-m-6 flex h-[calc(100vh-56px)] flex-col overflow-hidden">
        {/* Barre compacte */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-2.5">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setEditeurOuvert(false)}
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Retour</span>
            </button>
            <div className="h-4 w-px bg-slate-200 shrink-0" />
            {sessionCollabora.type_bureautique === "tableur"
              ? <FileSpreadsheet className="w-4 h-4 shrink-0 text-emerald-500" />
              : <FileText className="w-4 h-4 shrink-0 text-blue-500" />}
            <span className="truncate text-sm font-semibold text-slate-800">{doc.reference}</span>
            <span className="hidden sm:block truncate text-sm text-slate-500">— {doc.intitule}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-700">Sauvegarde auto</span>
            <button
              type="button"
              onClick={ouvrirCollabora}
              disabled={chargementCollabora}
              className="btn-secondaire py-1.5 text-xs"
              title="Relancer l'éditeur"
            >
              <RefreshCw size={13} className={chargementCollabora ? "animate-spin" : ""} />
            </button>
            <button
              type="button"
              onClick={() => setEditeurOuvert(false)}
              className="text-slate-400 hover:text-slate-600 transition-colors"
              title="Fermer l'éditeur"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        {/* Formulaire WOPI caché */}
        <form
          ref={formulaireCollaboraRef}
          action={sessionCollabora.url_editeur}
          method="post"
          target={cibleCollabora}
          className="hidden"
        >
          <input type="hidden" name="access_token" value={sessionCollabora.access_token} />
          <input type="hidden" name="access_token_ttl" value={String(sessionCollabora.access_token_ttl)} />
        </form>
        {/* iframe plein écran */}
        <iframe
          name={cibleCollabora}
          src="about:blank"
          title={`Éditeur ${doc.intitule}`}
          className="flex-1 w-full border-0"
          allow="clipboard-read; clipboard-write; fullscreen"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Navigation */}
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Link href={lienRetour} className="hover:text-slate-600 transition-colors">{libelleRetour}</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-slate-600 font-medium">{doc.reference}</span>
      </div>

      {succes && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm">
          <CheckCircle className="w-4 h-4 shrink-0" />{succes}
        </div>
      )}
      {erreur && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />{erreur}
          <button onClick={() => setErreur(null)} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* En-tête */}
      <div className="carte p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4 flex-1 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-primaire-50 flex items-center justify-center shrink-0">
              <FileText className="w-6 h-6 text-primaire-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="font-mono text-sm font-bold text-primaire-700 bg-primaire-50 px-2.5 py-1 rounded">
                  {doc.reference}
                </span>
                <span className="text-sm text-slate-500">Indice {doc.version}</span>
                <span className={`inline-flex items-center text-xs px-2.5 py-0.5 rounded-full font-medium ${statut.classe}`}>
                  {statut.libelle}
                </span>
                {doc.confidentiel && (
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
                    <Shield className="w-3 h-3" />Confidentiel
                  </span>
                )}
              </div>
              <h1 className="mt-2 text-xl font-bold text-slate-800">{doc.intitule}</h1>
              <p className="text-sm text-slate-500 mt-1">
                {doc.type_libelle} — {doc.nom_fichier_origine || "Aucun fichier"} — {formatTaille(doc.taille_octets)}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {doc.bureautique_editable && (
              <button
                type="button"
                onClick={editeurOuvert ? () => setEditeurOuvert(false) : ouvrirCollabora}
                disabled={chargementCollabora}
                className={`btn-secondaire ${editeurOuvert ? "border-primaire-300 text-primaire-700 bg-primaire-50" : ""}`}
                title="Éditer dans Collabora Online"
              >
                {chargementCollabora
                  ? <><RefreshCw className="w-4 h-4 animate-spin" />Connexion…</>
                  : editeurOuvert
                    ? <><FileText className="w-4 h-4" />Fermer l&apos;éditeur</>
                    : <><Layers className="w-4 h-4" />Éditer dans Collabora</>
                }
              </button>
            )}
            <button
              type="button"
              onClick={() => setModeEdition((precedent) => !precedent)}
              className="btn-secondaire"
            >
              <Pencil className="w-4 h-4" />
              <span className="hidden sm:inline">{modeEdition ? "Fermer" : "Modifier"}</span>
            </button>
            {doc.fichier && (
              <button
                type="button"
                onClick={() => setApercuOuvert(true)}
                className="btn-secondaire"
                title="Prévisualiser le fichier"
                aria-label="Prévisualiser le fichier"
              >
                <Eye className="w-4 h-4" />
                <span className="hidden sm:inline">Aperçu</span>
              </button>
            )}
            {doc.fichier && (
              <a
                href={doc.fichier}
                download={doc.nom_fichier_origine}
                className="btn-secondaire"
                title="Télécharger"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Télécharger</span>
              </a>
            )}
            {peutOcr && (
              <button
                onClick={lancerOcr}
                disabled={ocrEnCours}
                className="btn-secondaire disabled:opacity-60"
              >
                {ocrEnCours
                  ? <><RefreshCw className="w-4 h-4 animate-spin" />OCR en cours…</>
                  : <><ScanText className="w-4 h-4" />Lancer OCR</>
                }
              </button>
            )}
            <button
              onClick={lancerAnalyse}
              disabled={analyseEnCours}
              className="btn-secondaire disabled:opacity-60"
            >
              {analyseEnCours
                ? <><RefreshCw className="w-4 h-4 animate-spin" />Analyse…</>
                : <><RefreshCw className="w-4 h-4" />Analyser</>
              }
            </button>
            {peutImporterBibliotheque && (
              <button
                type="button"
                onClick={importerDansBibliotheque}
                disabled={importBibliothequeEnCours}
                className="btn-secondaire disabled:opacity-60"
              >
                {importBibliothequeEnCours
                  ? <><RefreshCw className="w-4 h-4 animate-spin" />Import…</>
                  : <><LibraryBig className="w-4 h-4" />Vers bibliothèque</>
                }
              </button>
            )}
            {doc.fichier && (
              <button
                type="button"
                onClick={extraireCctp}
                disabled={extractionCctpEnCours}
                className="btn-secondaire disabled:opacity-60"
                title="Analyser le document et extraire les articles CCTP en bibliothèque"
              >
                {extractionCctpEnCours
                  ? <><RefreshCw className="w-4 h-4 animate-spin" />Extraction…</>
                  : <><BookOpen className="w-4 h-4" />Extraire CCTP</>
                }
              </button>
            )}
            <button
              type="button"
              onClick={creerEtudePrix}
              disabled={creationEtudeEnCours}
              className="btn-secondaire disabled:opacity-60"
              title="Créer une étude de prix depuis ce document"
            >
              {creationEtudeEnCours
                ? <><RefreshCw className="w-4 h-4 animate-spin" />Création…</>
                : <><Calculator className="w-4 h-4" />Étude de prix</>
              }
            </button>
            {peutValider && (
              <button onClick={valider} className="btn-primaire">
                <CheckCircle className="w-4 h-4" />Valider
              </button>
            )}
            <button
              type="button"
              onClick={supprimerDocument}
              disabled={suppressionEnCours}
              className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">{suppressionEnCours ? "Suppression…" : "Supprimer"}</span>
            </button>
          </div>
        </div>
      </div>

      {modeEdition && (
        <div className="carte p-6 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-slate-800">Modifier le document</h2>
            <p className="text-sm text-slate-500">Renomme le document, ajuste son type, son dossier GED et sa confidentialité depuis cette fiche.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="libelle-champ">Référence</label>
              <input
                type="text"
                className="champ-saisie w-full"
                value={referenceEdition}
                onChange={(event) => setReferenceEdition(event.target.value)}
              />
            </div>
            <div>
              <label className="libelle-champ">Intitulé</label>
              <input
                type="text"
                className="champ-saisie w-full"
                value={intituleEdition}
                onChange={(event) => setIntituleEdition(event.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="libelle-champ">Type de document</label>
              <select
                className="champ-saisie w-full"
                value={typeDocumentEdition}
                onChange={(event) => setTypeDocumentEdition(event.target.value)}
              >
                {typesDocuments.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.libelle}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="libelle-champ">Dossier GED</label>
              <select
                className="champ-saisie w-full"
                value={dossierEdition}
                onChange={(event) => setDossierEdition(event.target.value)}
              >
                <option value="">Aucun dossier</option>
                {dossiersProjet.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.chemin || item.intitule}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-primaire-600"
              checked={confidentielEdition}
              onChange={(event) => setConfidentielEdition(event.target.checked)}
            />
            Document confidentiel
          </label>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setModeEdition(false);
                if (doc) {
                  setReferenceEdition(doc.reference);
                  setIntituleEdition(doc.intitule);
                  setTypeDocumentEdition(doc.type_document);
                  setDossierEdition(doc.dossier || "");
                  setConfidentielEdition(doc.confidentiel);
                }
              }}
              className="btn-secondaire"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={enregistrerEdition}
              disabled={enregistrementEdition}
              className="btn-primaire disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              {enregistrementEdition ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </div>
      )}

      <ApercuFichierModal
        ouvert={apercuOuvert}
        onFermer={() => setApercuOuvert(false)}
        url={doc.fichier}
        typeMime={doc.type_mime}
        nomFichier={doc.nom_fichier_origine || doc.intitule}
      />

      {/* Onglets */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-1 px-1">
          {[
            { id: "details", libelle: "Détails" },
            { id: "analyse", libelle: `Analyse${doc.analyse_automatique_effectuee ? " ✓" : ""}` },
            { id: "ocr", libelle: `OCR${doc.ocr_effectue ? " ✓" : ""}` },
            { id: "annotations", libelle: `Annotations (${doc.annotations.length})` },
            { id: "diffusions", libelle: `Diffusions (${doc.diffusions.length})` },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setOnglet(tab.id as typeof onglet)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                onglet === tab.id
                  ? "border-primaire-600 text-primaire-700"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
              }`}
            >
              {tab.libelle}
            </button>
          ))}
        </nav>
      </div>

      {/* Contenu onglets */}
      {onglet === "details" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="carte p-6">
            <h3 className="font-semibold text-slate-800 mb-4 text-sm uppercase tracking-wider">Identification</h3>
            <dl className="space-y-3">
              {[
                { label: "Référence", value: doc.reference },
                { label: "Intitulé", value: doc.intitule },
                { label: "Type", value: doc.type_libelle },
                { label: "Projet", value: doc.projet_reference },
                { label: "Dossier GED", value: doc.dossier_chemin || doc.dossier_libelle },
                { label: "Version", value: doc.version },
                { label: "Statut", value: doc.statut_libelle },
                { label: "Origine", value: doc.origine === "interne" ? "Produit en interne" : doc.origine === "recu" ? "Reçu de l'extérieur" : doc.origine },
              ].map(({ label, value }) => (
                <div key={label} className="flex gap-4">
                  <dt className="text-xs text-slate-400 w-28 shrink-0 pt-0.5">{label}</dt>
                  <dd className="text-sm text-slate-700 font-medium">{value || "—"}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="carte p-6">
            <h3 className="font-semibold text-slate-800 mb-4 text-sm uppercase tracking-wider">Traçabilité</h3>
            <dl className="space-y-3">
              {[
                { label: "Auteur", value: doc.auteur_nom },
                { label: "Créé le", value: formatDate(doc.date_creation) },
                { label: "Modifié le", value: formatDate(doc.date_modification) },
                { label: "Validé par", value: doc.valide_par_nom },
                { label: "Validé le", value: formatDate(doc.date_validation) },
                { label: "SHA-256", value: doc.empreinte_sha256 ? `${doc.empreinte_sha256.slice(0, 16)}…` : "—" },
              ].map(({ label, value }) => (
                <div key={label} className="flex gap-4">
                  <dt className="text-xs text-slate-400 w-28 shrink-0 pt-0.5">{label}</dt>
                  <dd className="text-sm text-slate-700 font-medium font-mono text-xs">{value || "—"}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="carte p-6">
            <h3 className="font-semibold text-slate-800 mb-4 text-sm uppercase tracking-wider">Accès et partage</h3>
            <div className="space-y-3">
              {[
                { label: "Accès client", actif: doc.acces_client },
                { label: "Accès partenaire", actif: doc.acces_partenaire },
                { label: "Confidentiel", actif: doc.confidentiel },
              ].map(({ label, actif }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">{label}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${actif ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                    {actif ? "Oui" : "Non"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {onglet === "analyse" && (
        <div className="space-y-6">
          {!doc.analyse_automatique_effectuee ? (
            <div className="carte p-8 text-center text-slate-500">
              <p>Aucune analyse automatique enregistrée.</p>
              <p className="mt-1 text-sm text-slate-400">Utilisez le bouton “Analyser” pour exploiter les services compatibles avec ce fichier.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="carte p-6">
                  <h3 className="font-semibold text-slate-800 mb-3">Classification</h3>
                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="text-slate-400">Type actuel</p>
                      <p className="font-medium text-slate-700">{doc.type_libelle}</p>
                    </div>
                    {typeDetecte && (
                      <div>
                        <p className="text-slate-400">Type détecté</p>
                        <p className="font-medium text-slate-700">{String(typeDetecte.libelle || "—")}</p>
                        <p className="text-xs text-slate-400 mt-1">Score {String(typeDetecte.score || "0")}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-slate-400">Analyse réalisée</p>
                      <p className="font-medium text-slate-700">{formatDate(doc.date_analyse_automatique)}</p>
                    </div>
                  </div>
                </div>

                <div className="carte p-6">
                  <h3 className="font-semibold text-slate-800 mb-3">Projet suggéré</h3>
                  {projetSuggere ? (
                    <div className="space-y-2 text-sm">
                      <p className="font-medium text-slate-700">
                        {String(projetSuggere.reference || "—")} — {String(projetSuggere.intitule || "—")}
                      </p>
                      <p className="text-slate-400">Score {String(projetSuggere.score || "0")}</p>
                      {Boolean(projetSuggere.correspond_au_document) && (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200">
                          Correspond au projet affecté
                        </span>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">Aucune suggestion exploitable.</p>
                  )}
                </div>

                <div className="carte p-6">
                  <h3 className="font-semibold text-slate-800 mb-3">Extraction</h3>
                  <div className="space-y-2 text-sm">
                    <p className="text-slate-700">
                      {doc.contenu_texte ? `${doc.contenu_texte.length.toLocaleString("fr-FR")} caractères extraits` : "Aucun texte exploitable"}
                    </p>
                    <p className="text-slate-400">{doc.mots_cles.length} mot(s)-clé(s) retenu(s)</p>
                    {doc.mots_cles.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {doc.mots_cles.slice(0, 12).map(mot => (
                          <span key={mot} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                            {mot}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="carte p-6">
                  <h3 className="font-semibold text-slate-800 mb-4">Services exploités</h3>
                  <div className="space-y-3 text-sm">
                    {services.pdf && (
                      <div className="rounded-xl border border-slate-200 p-4">
                        <p className="font-medium text-slate-800">Analyse PDF</p>
                        <p className="text-slate-500 mt-1">
                          {String((services.pdf.nb_pages as number | undefined) || 0)} page(s), {String((services.pdf.nb_tableaux as number | undefined) || 0)} tableau(x), {String((services.pdf.nb_images as number | undefined) || 0)} image(s)
                        </p>
                      </div>
                    )}
                    {services.ocr && (
                      <div className="rounded-xl border border-slate-200 p-4">
                        <p className="font-medium text-slate-800">OCR</p>
                        <p className="text-slate-500 mt-1">
                          {String((services.ocr.pages as number | undefined) || 0)} page(s), confiance {String((services.ocr.confiance as number | undefined) || 0)}%
                        </p>
                      </div>
                    )}
                    {services.cao && (
                      <div className="rounded-xl border border-slate-200 p-4">
                        <p className="font-medium text-slate-800">Analyse CAO</p>
                        <p className="text-slate-500 mt-1">
                          {String((services.cao.nb_calques as number | undefined) || 0)} calque(s), {String((services.cao.nb_entites as number | undefined) || 0)} entité(s)
                        </p>
                      </div>
                    )}
                    {!services.pdf && !services.ocr && !services.cao && (
                      <p className="text-slate-400">Aucun microservice spécifique n&apos;a été exploité pour ce fichier.</p>
                    )}
                  </div>
                </div>

                <div className="carte p-6">
                  <h3 className="font-semibold text-slate-800 mb-4">Retours de l’analyse</h3>
                  {erreursAnalyse.length > 0 ? (
                    <div className="space-y-2">
                      {erreursAnalyse.map((item, index) => (
                        <div key={index} className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                          {String(item.service || "service")} : {String(item.detail || "Erreur inconnue")}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">Aucune erreur remontée par les services d’analyse.</p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {onglet === "ocr" && (
        <div className="space-y-4">
          {doc.ocr_effectue ? (
            <>
              {doc.mots_cles.length > 0 && (
                <div className="carte p-6">
                  <h3 className="font-semibold text-slate-800 mb-3 text-sm">Mots-clés extraits</h3>
                  <div className="flex flex-wrap gap-2">
                    {doc.mots_cles.map(mot => (
                      <span key={mot} className="badge-neutre text-xs">{mot}</span>
                    ))}
                  </div>
                </div>
              )}
              <div className="carte p-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-slate-800 text-sm">Texte extrait</h3>
                  <button
                    onClick={() => setAfficherTexteOcr(v => !v)}
                    className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700"
                  >
                    {afficherTexteOcr ? <><EyeOff className="w-3.5 h-3.5" />Masquer</> : <><Eye className="w-3.5 h-3.5" />Afficher</>}
                  </button>
                </div>
                {afficherTexteOcr ? (
                  <pre className="text-xs text-slate-600 whitespace-pre-wrap font-mono bg-slate-50 rounded-xl p-4 max-h-96 overflow-y-auto leading-relaxed">
                    {doc.contenu_texte || "(aucun texte extrait)"}
                  </pre>
                ) : (
                  <p className="text-sm text-slate-400">
                    {doc.contenu_texte.length} caractère{doc.contenu_texte.length !== 1 ? "s" : ""} extraits
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="carte p-10 text-center">
              <ScanText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="font-medium text-slate-600">OCR non effectué</p>
              <p className="text-sm text-slate-400 mt-1 mb-4">
                {peutOcr
                  ? "Ce document peut être analysé par reconnaissance optique de caractères."
                  : "Ce type de fichier n'est pas pris en charge par l'OCR."}
              </p>
              {peutOcr && (
                <button onClick={lancerOcr} disabled={ocrEnCours} className="btn-primaire disabled:opacity-60">
                  {ocrEnCours
                    ? <><RefreshCw className="w-4 h-4 animate-spin" />Analyse en cours…</>
                    : <><ScanText className="w-4 h-4" />Lancer l&apos;OCR</>
                  }
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {onglet === "annotations" && (
        <div className="space-y-4">
          {/* Saisie nouvelle annotation */}
          <div className="carte p-4">
            <textarea
              className="champ-saisie w-full resize-none"
              rows={3}
              placeholder="Ajouter un commentaire ou une annotation…"
              value={nouvelleAnnotation}
              onChange={e => setNouvelleAnnotation(e.target.value)}
            />
            <div className="flex justify-end mt-2">
              <button
                onClick={ajouterAnnotation}
                disabled={envoyerAnnotation || !nouvelleAnnotation.trim()}
                className="btn-primaire disabled:opacity-60"
              >
                <MessageSquare className="w-4 h-4" />
                {envoyerAnnotation ? "Envoi…" : "Annoter"}
              </button>
            </div>
          </div>

          {/* Liste des annotations */}
          {doc.annotations.length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-sm">Aucune annotation.</div>
          ) : (
            <div className="space-y-3">
              {doc.annotations.map(ann => (
                <div key={ann.id} className={`carte p-4 ${ann.resolue ? "opacity-60" : ""}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm text-slate-700">{ann.auteur_nom}</span>
                    <div className="flex items-center gap-2">
                      {ann.page && <span className="text-xs text-slate-400">p.{ann.page}</span>}
                      {ann.resolue && <span className="badge-succes text-xs">Résolue</span>}
                      <span className="text-xs text-slate-400">
                        {new Date(ann.date_creation).toLocaleDateString("fr-FR")}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-slate-600 whitespace-pre-wrap">{ann.contenu}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {onglet === "diffusions" && (
        <div>
          {doc.diffusions.length === 0 ? (
            <div className="py-10 text-center">
              <Send className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">Aucune diffusion enregistrée.</p>
            </div>
          ) : (
            <div className="carte divide-y divide-slate-100">
              {doc.diffusions.map(diff => (
                <div key={diff.id} className="flex items-center gap-4 py-3 px-4">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                    <Send className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800 text-sm">{diff.destinataire_nom}</p>
                    {diff.destinataire_contact && (
                      <p className="text-xs text-slate-400">{diff.destinataire_contact}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="badge-neutre text-xs">{diff.mode_libelle}</span>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {new Date(diff.date_diffusion).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
