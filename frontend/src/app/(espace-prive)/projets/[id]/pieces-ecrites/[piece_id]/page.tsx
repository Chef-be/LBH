"use client";

import { useState, useEffect, use, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ErreurApi } from "@/crochets/useApi";
import { useSessionStore } from "@/crochets/useSession";
import { EditeurTexteRiche } from "@/composants/ui/EditeurTexteRiche";
import {
  ChevronRight, CheckCircle, AlertCircle, X, Plus,
  Pencil, Trash2, Save, FileText, GripVertical, RefreshCw, Download, Sparkles, Clock3, ListTree,
} from "lucide-react";

interface ArticleCCTP {
  id: string;
  chapitre: string;
  numero_article: string;
  code_reference?: string;
  intitule: string;
  corps_article: string;
  ligne_prix_reference?: string | null;
  normes_applicables: string | string[];
  est_dans_bibliotheque: boolean;
  tags: string | string[];
}

interface LigneBibliothequeOption {
  id: string;
  code: string;
  designation_courte: string;
  famille?: string;
  lot?: string;
}

interface PieceEcrite {
  id: string;
  projet: string;
  projet_reference: string;
  intitule: string;
  modele: string | null;
  modele_libelle: string;
  modele_type_document?: string | null;
  modele_variables_fusion?: Array<{ nom: string; description?: string; exemple?: string }>;
  statut: string;
  statut_libelle: string;
  contenu_html: string;
  variables_personnalisees: Record<string, string>;
  fichier_genere?: string | null;
  redacteur_nom: string | null;
  articles: ArticleCCTP[];
  date_modification: string;
}

const STATUTS: Record<string, string> = {
  brouillon:    "badge-neutre",
  en_relecture: "bg-yellow-100 text-yellow-700 border border-yellow-200",
  valide:       "badge-succes",
  diffuse:      "bg-blue-100 text-blue-700 border border-blue-200",
  archive:      "badge-danger",
};

const TYPES_TABLEUR = new Set(["bpu", "dpgf", "dqe"]);

const VIDE_ARTICLE = {
  chapitre: "",
  numero_article: "",
  ligne_prix_reference: "",
  intitule: "",
  corps_article: "",
  normes_applicables: "",
  est_dans_bibliotheque: false,
  tags: "",
};

function versTexteListe(valeur: string | string[] | null | undefined): string {
  if (Array.isArray(valeur)) return valeur.join(", ");
  return valeur || "";
}

interface PlanDocumentItem {
  id: string;
  niveau: number;
  titre: string;
}

interface StatistiquesDocument {
  mots: number;
  caracteres: number;
  paragraphes: number;
  lectureMinutes: number;
}

function slugifierPlan(valeur: string, index: number) {
  const base = valeur
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${base || "section"}-${index + 1}`;
}

function construireHtmlArticles(intitule: string, articles: ArticleCCTP[]) {
  if (articles.length === 0) {
    return intitule ? `<h1>${intitule}</h1><p></p>` : "<p></p>";
  }

  return [
    intitule ? `<h1>${intitule}</h1>` : "",
    ...articles.map((article) => {
      const titre = [article.chapitre, article.numero_article].filter(Boolean).join(".")
        + (article.intitule ? ` — ${article.intitule}` : "");
      const normes = versTexteListe(article.normes_applicables);
      return [
        `<h2>${titre || "Article"}</h2>`,
        article.corps_article || "<p></p>",
        normes ? `<p><em>Normes : ${normes}</em></p>` : "",
      ].join("");
    }),
  ].join("");
}

function analyserDocumentRiche(contenuHtml: string, repliHtml: string) {
  const htmlSource = (contenuHtml || "").trim() || repliHtml || "<p></p>";

  if (typeof window === "undefined") {
    return {
      html: htmlSource,
      plan: [] as PlanDocumentItem[],
      stats: { mots: 0, caracteres: 0, paragraphes: 0, lectureMinutes: 0 },
    };
  }

  const documentHtml = new DOMParser().parseFromString(`<article>${htmlSource}</article>`, "text/html");
  const racine = documentHtml.body.firstElementChild || documentHtml.body;
  const elementsPlan = Array.from(racine.querySelectorAll("h1, h2, h3"));
  const plan: PlanDocumentItem[] = elementsPlan.map((element, index) => {
    const titre = (element.textContent || "").trim() || `Section ${index + 1}`;
    const id = slugifierPlan(titre, index);
    element.setAttribute("id", id);
    return {
      id,
      niveau: Number(element.tagName.slice(1)),
      titre,
    };
  });

  const texte = (racine.textContent || "").replace(/\s+/g, " ").trim();
  const mots = texte ? texte.split(" ").filter(Boolean).length : 0;
  const paragraphes = racine.querySelectorAll("p, li, blockquote").length;

  return {
    html: racine.innerHTML,
    plan,
    stats: {
      mots,
      caracteres: texte.length,
      paragraphes,
      lectureMinutes: mots > 0 ? Math.max(1, Math.round(mots / 180)) : 0,
    },
  };
}

function formaterDateRelative(iso: string | null) {
  if (!iso) return "Jamais";
  const differenceMs = new Date(iso).getTime() - Date.now();
  const differenceMinutes = Math.round(differenceMs / 60000);
  const valeurAbsolue = Math.abs(differenceMinutes);

  if (valeurAbsolue < 1) return "à l'instant";
  if (valeurAbsolue < 60) return `il y a ${valeurAbsolue} min`;

  const differenceHeures = Math.round(valeurAbsolue / 60);
  if (differenceHeures < 24) return `il y a ${differenceHeures} h`;

  const differenceJours = Math.round(differenceHeures / 24);
  return `il y a ${differenceJours} j`;
}

function ModalArticle({
  pieceId,
  initial,
  articleId,
  onSuccess,
  onClose,
}: {
  pieceId: string;
  initial: typeof VIDE_ARTICLE;
  articleId?: string;
  onSuccess: () => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({ ...VIDE_ARTICLE, ...initial });
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [referencesPrix, setReferencesPrix] = useState<LigneBibliothequeOption[]>([]);
  const [assistantEnCours, setAssistantEnCours] = useState(false);
  const maj = (k: keyof typeof VIDE_ARTICLE, v: string | boolean) =>
    setForm(p => ({ ...p, [k]: v }));

  useEffect(() => {
    let actif = true;
    api.get<LigneBibliothequeOption[] | { results: LigneBibliothequeOption[] }>("/api/bibliotheque/")
      .then((reponse) => {
        if (!actif) return;
        const liste = Array.isArray(reponse) ? reponse : reponse.results || [];
        setReferencesPrix(liste.slice(0, 100));
      })
      .catch(() => {
        if (actif) {
          setReferencesPrix([]);
        }
      });
    return () => { actif = false; };
  }, []);

  const genererDepuisAssistant = async () => {
    setAssistantEnCours(true);
    setErreur(null);
    try {
      const reponse = await api.post<{ article: typeof VIDE_ARTICLE & {
        code_reference?: string;
        source?: string;
        source_url?: string;
        ligne_prix_reference?: string | null;
      }}>(`/api/pieces-ecrites/${pieceId}/assistant-cctp/`, {
        chapitre: form.chapitre,
        numero_article: form.numero_article,
        ligne_prix_reference: form.ligne_prix_reference || null,
        intitule: form.intitule,
        niveau_detail: "detaille",
        inclure_mise_en_oeuvre: true,
        inclure_controles: true,
        inclure_dechets: true,
      });
      setForm((precedent) => ({
        ...precedent,
        chapitre: reponse.article.chapitre || precedent.chapitre,
        numero_article: reponse.article.numero_article || precedent.numero_article,
        ligne_prix_reference: reponse.article.ligne_prix_reference || precedent.ligne_prix_reference,
        intitule: reponse.article.intitule || precedent.intitule,
        corps_article: reponse.article.corps_article || precedent.corps_article,
        normes_applicables: versTexteListe(reponse.article.normes_applicables),
        tags: versTexteListe(reponse.article.tags),
      }));
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Impossible de générer le brouillon via l'assistant.");
    } finally {
      setAssistantEnCours(false);
    }
  };

  const soumettre = async () => {
    if (!form.intitule.trim()) { setErreur("L'intitulé est requis."); return; }
    setChargement(true);
    setErreur(null);
    try {
      const payload = { piece_ecrite: pieceId, ...form };
      if (articleId) {
        await api.patch(`/api/pieces-ecrites/${pieceId}/articles/${articleId}/`, payload);
      } else {
        await api.post(`/api/pieces-ecrites/${pieceId}/articles/`, payload);
      }
      onSuccess();
      onClose();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Erreur lors de l'enregistrement.");
    } finally {
      setChargement(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-800">{articleId ? "Modifier l'article" : "Nouvel article"}</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>

        <div className="p-6 space-y-4">
          {erreur && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />{erreur}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="libelle-champ">Chapitre</label>
              <input type="text" className="champ-saisie w-full" placeholder="1"
                value={form.chapitre} onChange={e => maj("chapitre", e.target.value)} />
            </div>
            <div>
              <label className="libelle-champ">N° article</label>
              <input type="text" className="champ-saisie w-full" placeholder="1.1"
                value={form.numero_article} onChange={e => maj("numero_article", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
            <div>
              <label className="libelle-champ">Référence bibliothèque de prix</label>
              <select
                className="champ-saisie w-full"
                value={form.ligne_prix_reference}
                onChange={e => maj("ligne_prix_reference", e.target.value)}
              >
                <option value="">Sans référence liée</option>
                {referencesPrix.map((reference) => (
                  <option key={reference.id} value={reference.id}>
                    {reference.code} — {reference.designation_courte}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={genererDepuisAssistant}
              disabled={assistantEnCours}
              className="btn-secondaire whitespace-nowrap disabled:opacity-60"
            >
              {assistantEnCours
                ? "Assistant…"
                : <><Sparkles className="w-4 h-4" />Assistant CCTP</>
              }
            </button>
          </div>

          <div>
            <label className="libelle-champ">Intitulé <span className="text-red-500">*</span></label>
            <input type="text" className="champ-saisie w-full"
              placeholder="Prescriptions générales sur les matériaux"
              value={form.intitule} onChange={e => maj("intitule", e.target.value)} />
          </div>

          <div>
            <label className="libelle-champ">Corps de l&apos;article</label>
            <EditeurTexteRiche
              valeur={form.corps_article}
              onChange={(valeur) => maj("corps_article", valeur)}
              placeholder="Le présent article définit les prescriptions techniques applicables aux matériaux mis en œuvre…"
              hauteurMinimale="min-h-[260px]"
            />
          </div>

          <div>
            <label className="libelle-champ">Normes applicables</label>
            <input type="text" className="champ-saisie w-full"
              placeholder="NF EN 206, NF EN 13670, DTU 21"
              value={form.normes_applicables} onChange={e => maj("normes_applicables", e.target.value)} />
          </div>

          <div>
            <label className="libelle-champ">Mots-clés (tags)</label>
            <input type="text" className="champ-saisie w-full"
              placeholder="béton, fondations, armatures"
              value={form.tags} onChange={e => maj("tags", e.target.value)} />
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 rounded text-primaire-600"
              checked={form.est_dans_bibliotheque}
              onChange={e => maj("est_dans_bibliotheque", e.target.checked)} />
            <span className="text-sm font-medium text-slate-700">Enregistrer dans la bibliothèque CCTP</span>
          </label>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
          <button onClick={onClose} className="btn-secondaire">Annuler</button>
          <button onClick={soumettre} disabled={chargement} className="btn-primaire disabled:opacity-60">
            {chargement ? "Enregistrement…" : <><Save className="w-4 h-4" />Enregistrer</>}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PageDetailPieceEcrite({
  params,
}: {
  params: Promise<{ id: string; piece_id: string }>;
}) {
  const { id: projetId, piece_id: pieceId } = use(params);
  const router = useRouter();
  const utilisateur = useSessionStore((etat) => etat.utilisateur);
  const estSuperAdmin = Boolean(utilisateur?.est_super_admin);
  const [piece, setPiece] = useState<PieceEcrite | null>(null);
  const [chargement, setChargement] = useState(true);
  const [succes, setSucces] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [modal, setModal] = useState(false);
  const [articleEdit, setArticleEdit] = useState<ArticleCCTP | null>(null);
  const [suppressionId, setSuppressionId] = useState<string | null>(null);
  const [onglet, setOnglet] = useState<"articles" | "modele" | "editeur" | "apercu">("editeur");
  const [contenuHtml, setContenuHtml] = useState("");
  const [enregistrementContenu, setEnregistrementContenu] = useState(false);
  const [generationEnCours, setGenerationEnCours] = useState(false);
  const [generationModeleEnCours, setGenerationModeleEnCours] = useState(false);
  const [exportEnCours, setExportEnCours] = useState<"docx" | "xlsx" | "pdf" | null>(null);
  const [variablesPersonnalisees, setVariablesPersonnalisees] = useState<Record<string, string>>({});
  const [modeEditionPiece, setModeEditionPiece] = useState(false);
  const [intituleEditionPiece, setIntituleEditionPiece] = useState("");
  const [enregistrementPiece, setEnregistrementPiece] = useState(false);
  const [suppressionPieceEnCours, setSuppressionPieceEnCours] = useState(false);
  const [etatSauvegardeContenu, setEtatSauvegardeContenu] = useState<"synchro" | "modifie" | "sauvegarde" | "erreur">("synchro");
  const [derniereSauvegardeContenu, setDerniereSauvegardeContenu] = useState<string | null>(null);
  const [planDocument, setPlanDocument] = useState<PlanDocumentItem[]>([]);
  const [apercuDocumentHtml, setApercuDocumentHtml] = useState("");
  const [statistiquesDocument, setStatistiquesDocument] = useState<StatistiquesDocument>({
    mots: 0,
    caracteres: 0,
    paragraphes: 0,
    lectureMinutes: 0,
  });
  const [ancrePlanActive, setAncrePlanActive] = useState<string | null>(null);
  const contenuSynchroniseRef = useRef("");

  const charger = useCallback(async () => {
    try {
      const donnees = await api.get<PieceEcrite>(`/api/pieces-ecrites/${pieceId}/`);
      setPiece(donnees);
      setIntituleEditionPiece(donnees.intitule);
    } catch {
      setErreur("Impossible de charger la pièce écrite.");
    } finally {
      setChargement(false);
    }
  }, [pieceId]);

  const flash = useCallback((msg: string) => {
    setSucces(msg);
    setTimeout(() => setSucces(null), 3000);
  }, []);

  const sauvegarderContenu = useCallback(async (silencieux = false) => {
    if (contenuHtml === contenuSynchroniseRef.current) {
      if (!silencieux) {
        flash("Le contenu est déjà synchronisé.");
      }
      return;
    }

    setEtatSauvegardeContenu("sauvegarde");
    setEnregistrementContenu(true);
    try {
      const reponse = await api.patch<PieceEcrite>(`/api/pieces-ecrites/${pieceId}/`, { contenu_html: contenuHtml });
      contenuSynchroniseRef.current = reponse.contenu_html || "";
      setPiece(reponse);
      setContenuHtml(reponse.contenu_html || "");
      setDerniereSauvegardeContenu(reponse.date_modification);
      setEtatSauvegardeContenu("synchro");
      if (!silencieux) {
        flash("Contenu enregistré.");
      }
    } catch (e) {
      setEtatSauvegardeContenu("erreur");
      setErreur(e instanceof ErreurApi ? e.detail : "Impossible d'enregistrer le contenu.");
    } finally {
      setEnregistrementContenu(false);
    }
  }, [contenuHtml, flash, pieceId]);

  useEffect(() => { charger(); }, [charger]);
  useEffect(() => {
    const contenuInitial = piece?.contenu_html || "";
    contenuSynchroniseRef.current = contenuInitial;
    setContenuHtml(contenuInitial);
    setDerniereSauvegardeContenu(piece?.date_modification || null);
    setEtatSauvegardeContenu("synchro");
  }, [piece?.contenu_html, piece?.date_modification]);
  useEffect(() => {
    setVariablesPersonnalisees(piece?.variables_personnalisees || {});
  }, [piece?.variables_personnalisees]);
  useEffect(() => {
    const htmlRepli = construireHtmlArticles(piece?.intitule || "", piece?.articles || []);
    const analyse = analyserDocumentRiche(contenuHtml, htmlRepli);
    setPlanDocument(analyse.plan);
    setApercuDocumentHtml(analyse.html);
    setStatistiquesDocument(analyse.stats);
    setAncrePlanActive((precedent) => {
      if (precedent && analyse.plan.some((item) => item.id === precedent)) {
        return precedent;
      }
      return analyse.plan[0]?.id || null;
    });
  }, [contenuHtml, piece?.articles, piece?.intitule]);
  useEffect(() => {
    if (enregistrementContenu) return;
    setEtatSauvegardeContenu(contenuHtml === contenuSynchroniseRef.current ? "synchro" : "modifie");
  }, [contenuHtml, enregistrementContenu]);
  useEffect(() => {
    if (!piece || onglet !== "editeur" || enregistrementContenu) return;
    if (contenuHtml === contenuSynchroniseRef.current) return;
    const timer = window.setTimeout(() => {
      void sauvegarderContenu(true);
    }, 1600);
    return () => window.clearTimeout(timer);
  }, [contenuHtml, enregistrementContenu, onglet, piece, sauvegarderContenu]);
  useEffect(() => {
    const gererAvantQuitter = (event: BeforeUnloadEvent) => {
      if (contenuHtml === contenuSynchroniseRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", gererAvantQuitter);
    return () => window.removeEventListener("beforeunload", gererAvantQuitter);
  }, [contenuHtml]);

  const supprimerArticle = async (artId: string) => {
    try {
      await api.supprimer(`/api/pieces-ecrites/${pieceId}/articles/${artId}/`);
      flash("Article supprimé.");
      setSuppressionId(null);
      charger();
    } catch { setErreur("Impossible de supprimer l'article."); }
  };

  const valider = async () => {
    try {
      await api.post(`/api/pieces-ecrites/${pieceId}/valider/`, {});
      flash("Pièce écrite validée.");
      charger();
    } catch (e) { setErreur(e instanceof ErreurApi ? e.detail : "Impossible de valider."); }
  };

  const genererDepuisArticles = async () => {
    setGenerationEnCours(true);
    try {
      const reponse = await api.post<{ detail: string; piece: PieceEcrite }>(`/api/pieces-ecrites/${pieceId}/generer/`, {});
      setPiece(reponse.piece);
      setContenuHtml(reponse.piece.contenu_html || "");
      setOnglet("editeur");
      flash(reponse.detail);
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Impossible de générer la pièce écrite.");
    } finally {
      setGenerationEnCours(false);
    }
  };

  const genererDepuisModele = async () => {
    setGenerationModeleEnCours(true);
    try {
      const reponse = await api.post<{ detail: string; piece: PieceEcrite }>(
        `/api/pieces-ecrites/${pieceId}/generer-modele/`,
        { variables_personnalisees: variablesPersonnalisees }
      );
      setPiece(reponse.piece);
      setContenuHtml(reponse.piece.contenu_html || "");
      setVariablesPersonnalisees(reponse.piece.variables_personnalisees || {});
      setOnglet("editeur");
      flash(reponse.detail);
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Impossible de générer à partir du modèle.");
    } finally {
      setGenerationModeleEnCours(false);
    }
  };

  const exporter = async (format: "docx" | "xlsx" | "pdf") => {
    setExportEnCours(format);
    try {
      const reponse = await api.telecharger(`/api/pieces-ecrites/${pieceId}/export/${format}/`);
      const url = window.URL.createObjectURL(reponse.blob);
      const lien = document.createElement("a");
      lien.href = url;
      lien.download = reponse.nomFichier || `${piece?.intitule || "piece-ecrite"}.${format}`;
      document.body.appendChild(lien);
      lien.click();
      lien.remove();
      window.URL.revokeObjectURL(url);
      flash(`Export ${format.toUpperCase()} prêt.`);
      charger();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : `Impossible d'exporter en ${format.toUpperCase()}.`);
    } finally {
      setExportEnCours(null);
    }
  };

  const enregistrerPiece = async () => {
    if (!intituleEditionPiece.trim()) {
      setErreur("L'intitulé de la pièce écrite est requis.");
      return;
    }

    setEnregistrementPiece(true);
    try {
      const reponse = await api.patch<PieceEcrite>(`/api/pieces-ecrites/${pieceId}/`, {
        intitule: intituleEditionPiece.trim(),
      });
      setPiece(reponse);
      setIntituleEditionPiece(reponse.intitule);
      setModeEditionPiece(false);
      flash("Pièce écrite mise à jour.");
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Impossible d'enregistrer la pièce écrite.");
    } finally {
      setEnregistrementPiece(false);
    }
  };

  const supprimerPiece = async () => {
    if (!piece) return;
    const confirmation = window.confirm(
      estSuperAdmin
        ? `Supprimer définitivement la pièce écrite « ${piece.intitule} » ? Cette action est irréversible.`
        : `Archiver la pièce écrite « ${piece.intitule} » ?`
    );
    if (!confirmation) return;

    setSuppressionPieceEnCours(true);
    try {
      await api.supprimer(`/api/pieces-ecrites/${pieceId}/`);
      router.push(`/projets/${projetId}/pieces-ecrites`);
      router.refresh();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Impossible de supprimer la pièce écrite.");
    } finally {
      setSuppressionPieceEnCours(false);
    }
  };

  const nettoyerHtml = (valeur: string) => valeur.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const contenuModifie = contenuHtml !== contenuSynchroniseRef.current;
  const variablesRenseignees = Object.values(variablesPersonnalisees).filter((valeur) => String(valeur || "").trim()).length;
  const pieceEstTableur = TYPES_TABLEUR.has(piece?.modele_type_document || "");

  const naviguerVersSection = (idSection: string) => {
    setAncrePlanActive(idSection);
    window.requestAnimationFrame(() => {
      document.getElementById(idSection)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  if (chargement) return <div className="py-20 text-center text-slate-400 text-sm">Chargement…</div>;
  if (!piece) return (
    <div className="space-y-4">
      <Link href={`/projets/${projetId}/pieces-ecrites`} className="flex items-center gap-2 text-slate-400 hover:text-slate-600 text-sm">
        Retour
      </Link>
      <div className="py-20 text-center text-red-500">Pièce écrite introuvable.</div>
    </div>
  );

  const articles = [...(piece.articles ?? [])].sort((a, b) => {
    const cmp = (a.chapitre || "").localeCompare(b.chapitre || "");
    if (cmp !== 0) return cmp;
    return (a.numero_article || "").localeCompare(b.numero_article || "");
  });

  const classeStatut = STATUTS[piece.statut] ?? "badge-neutre";
  const configurationSauvegarde = {
    synchro: {
      classe: "badge-succes",
      libelle: "Synchronisé",
      detail: derniereSauvegardeContenu
        ? `Dernière sauvegarde ${formaterDateRelative(derniereSauvegardeContenu)}`
        : "Contenu à jour",
    },
    modifie: {
      classe: "badge-alerte",
      libelle: "Modifications locales",
      detail: "Autosave en attente",
    },
    sauvegarde: {
      classe: "badge-info",
      libelle: "Sauvegarde en cours",
      detail: "Le contenu est en cours d'envoi",
    },
    erreur: {
      classe: "badge-danger",
      libelle: "Erreur de sauvegarde",
      detail: "Le contenu local doit être resynchronisé",
    },
  }[etatSauvegardeContenu];

  return (
    <div className="space-y-6">
      {/* Fil d'Ariane */}
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Link href={`/projets/${projetId}`} className="hover:text-slate-600">{piece.projet_reference}</Link>
        <ChevronRight className="w-3 h-3" />
        <Link href={`/projets/${projetId}/pieces-ecrites`} className="hover:text-slate-600">Pièces écrites</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-slate-600 font-medium truncate">{piece.intitule}</span>
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
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
              <FileText className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap mb-1">
                <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${classeStatut}`}>
                  {piece.statut_libelle}
                </span>
                {piece.modele_libelle && (
                  <span className="badge-neutre text-xs">{piece.modele_libelle}</span>
                )}
              </div>
              <h1 className="text-xl font-bold text-slate-800">{piece.intitule}</h1>
              {piece.redacteur_nom && (
                <p className="text-sm text-slate-400 mt-0.5">Rédigé par {piece.redacteur_nom}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => setModeEditionPiece((precedent) => !precedent)} className="btn-secondaire">
              <Pencil className="w-4 h-4" />
              <span className="hidden sm:inline">{modeEditionPiece ? "Fermer" : "Modifier"}</span>
            </button>
            {pieceEstTableur ? (
              <button onClick={() => exporter("xlsx")} disabled={exportEnCours !== null} className="btn-secondaire disabled:opacity-60">
                {exportEnCours === "xlsx" ? "XLSX…" : <><Download className="w-4 h-4" />XLSX</>}
              </button>
            ) : (
              <button onClick={() => exporter("docx")} disabled={exportEnCours !== null} className="btn-secondaire disabled:opacity-60">
                {exportEnCours === "docx" ? "DOCX…" : <><Download className="w-4 h-4" />DOCX</>}
              </button>
            )}
            <button onClick={() => exporter("pdf")} disabled={exportEnCours !== null} className="btn-secondaire disabled:opacity-60">
              {exportEnCours === "pdf" ? "PDF…" : <><Download className="w-4 h-4" />PDF</>}
            </button>
            <button onClick={genererDepuisArticles} disabled={generationEnCours} className="btn-secondaire disabled:opacity-60">
              {generationEnCours
                ? <><RefreshCw className="w-4 h-4 animate-spin" />Génération…</>
                : <><RefreshCw className="w-4 h-4" />Générer depuis les articles</>
              }
            </button>
            {piece.modele && (
              <button onClick={genererDepuisModele} disabled={generationModeleEnCours} className="btn-secondaire disabled:opacity-60">
                {generationModeleEnCours
                  ? <><RefreshCw className="w-4 h-4 animate-spin" />Fusion…</>
                  : <><RefreshCw className="w-4 h-4" />Générer depuis le modèle</>
                }
              </button>
            )}
            {piece.statut !== "valide" && (
              <button onClick={valider} className="btn-primaire">
                <CheckCircle className="w-4 h-4" />Valider
              </button>
            )}
            <button
              onClick={supprimerPiece}
              disabled={suppressionPieceEnCours}
              className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">{suppressionPieceEnCours ? "Suppression…" : "Supprimer"}</span>
            </button>
          </div>
        </div>
      </div>

      {modeEditionPiece && (
        <div className="carte p-6 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-slate-800">Modifier la pièce écrite</h2>
            <p className="text-sm text-slate-500">Renomme la pièce sans quitter cette fiche.</p>
          </div>
          <div>
            <label className="libelle-champ">Intitulé</label>
            <input
              type="text"
              className="champ-saisie w-full"
              value={intituleEditionPiece}
              onChange={(event) => setIntituleEditionPiece(event.target.value)}
            />
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setModeEditionPiece(false);
                if (piece) {
                  setIntituleEditionPiece(piece.intitule);
                }
              }}
              className="btn-secondaire"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={enregistrerPiece}
              disabled={enregistrementPiece}
              className="btn-primaire disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              {enregistrementPiece ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[280px,minmax(0,1fr)]">
        <aside className="space-y-4 xl:sticky xl:top-24 self-start">
          <div className="carte space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-800">Atelier de rédaction</p>
                <p className="text-xs text-slate-500 mt-1">Espace de travail enrichi pour la rédaction documentaire.</p>
              </div>
              <span className={configurationSauvegarde.classe}>{configurationSauvegarde.libelle}</span>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <Clock3 className="h-4 w-4 text-slate-400" />
                {configurationSauvegarde.detail}
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {contenuModifie ? "Vous pouvez quitter l'onglet après synchronisation." : "Aucune modification locale en attente."}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-slate-400">Mots</p>
                <p className="mt-1 text-xl font-semibold text-slate-800">{statistiquesDocument.mots}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-slate-400">Lecture</p>
                <p className="mt-1 text-xl font-semibold text-slate-800">
                  {statistiquesDocument.lectureMinutes > 0 ? `${statistiquesDocument.lectureMinutes} min` : "—"}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-slate-400">Paragraphes</p>
                <p className="mt-1 text-xl font-semibold text-slate-800">{statistiquesDocument.paragraphes}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-slate-400">Variables</p>
                <p className="mt-1 text-xl font-semibold text-slate-800">{variablesRenseignees}</p>
              </div>
            </div>
          </div>

          <div className="carte space-y-4">
            <div className="flex items-center gap-2">
              <ListTree className="h-4 w-4 text-slate-400" />
              <p className="text-sm font-semibold text-slate-800">Sommaire</p>
            </div>
            {planDocument.length === 0 ? (
              <p className="text-sm text-slate-400">Ajoutez des titres pour structurer le document.</p>
            ) : (
              <div className="space-y-1">
                {planDocument.map((section) => (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => naviguerVersSection(section.id)}
                    className={`flex w-full items-center rounded-xl px-3 py-2 text-left text-sm transition ${
                      ancrePlanActive === section.id
                        ? "bg-primaire-50 text-primaire-700"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                    style={{ paddingLeft: `${0.75 + (section.niveau - 1) * 0.9}rem` }}
                  >
                    <span className="line-clamp-2">{section.titre}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {piece.modele && (
            <div className="carte space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800">Fusion métier</p>
                  <p className="text-xs text-slate-500 mt-1">{piece.modele_libelle}</p>
                </div>
                <span className="badge-neutre">{variablesRenseignees}/{piece.modele_variables_fusion?.length || 0}</span>
              </div>
              <button
                type="button"
                onClick={() => setOnglet("modele")}
                className="btn-secondaire w-full justify-center"
              >
                Ouvrir les variables
              </button>
            </div>
          )}
        </aside>

        <div className="space-y-6">
          <div className="border-b border-slate-200">
            <nav className="flex gap-1 px-1 overflow-x-auto">
              {[
                { id: "articles", libelle: `Articles (${articles.length})` },
                ...(piece.modele ? [{ id: "modele", libelle: "Fusion modèle" as const }] : []),
                { id: "editeur", libelle: "Rédaction" },
                { id: "apercu", libelle: "Aperçu" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setOnglet(tab.id as typeof onglet)}
                  className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
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

          {onglet === "articles" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-slate-700">
                  {articles.length} article{articles.length !== 1 ? "s" : ""}
                </p>
                {piece.statut !== "valide" && (
                  <button onClick={() => { setArticleEdit(null); setModal(true); }} className="btn-primaire">
                    <Plus className="w-4 h-4" />Ajouter un article
                  </button>
                )}
              </div>

              {articles.length === 0 ? (
                <div className="carte py-12 text-center">
                  <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500 font-medium">Aucun article</p>
                  <p className="text-slate-400 text-sm mt-1">Ajoutez des articles pour rédiger le CCTP.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {articles.map((art) => (
                    <div key={art.id} className="carte p-4 group">
                      <div className="flex items-start gap-3">
                        <div className="flex items-center gap-2 shrink-0 mt-0.5">
                          <GripVertical className="w-4 h-4 text-slate-300" />
                          <span className="font-mono text-xs font-bold text-primaire-600 bg-primaire-50 px-2 py-0.5 rounded min-w-[3rem] text-center">
                            {[art.chapitre, art.numero_article].filter(Boolean).join(".") || "—"}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-800">{art.intitule}</p>
                          {art.corps_article && (
                            <p className="text-sm text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                              {nettoyerHtml(art.corps_article)}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            {art.code_reference && (
                              <span className="text-xs text-primaire-700 bg-primaire-50 px-2 py-0.5 rounded">
                                {art.code_reference}
                              </span>
                            )}
                            {art.normes_applicables && (
                              <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                                {versTexteListe(art.normes_applicables)}
                              </span>
                            )}
                            {art.est_dans_bibliotheque && (
                              <span className="badge-succes text-xs">Bibliothèque</span>
                            )}
                            {versTexteListe(art.tags).split(",").map((tag) => tag.trim()).filter(Boolean).map((tag) => (
                              <span key={tag} className="text-xs text-slate-400 border border-slate-200 px-1.5 py-0.5 rounded">
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                        {piece.statut !== "valide" && (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <button
                              onClick={() => { setArticleEdit(art); setModal(true); }}
                              className="p-1.5 rounded text-slate-400 hover:text-primaire-600 hover:bg-primaire-50"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            {suppressionId === art.id ? (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => supprimerArticle(art.id)}
                                  className="text-xs text-red-600 font-medium px-1.5 py-1 rounded hover:bg-red-50"
                                >
                                  Suppr.
                                </button>
                                <button onClick={() => setSuppressionId(null)} className="p-1 rounded hover:bg-slate-100">
                                  <X className="w-3 h-3 text-slate-400" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setSuppressionId(art.id)}
                                className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {onglet === "editeur" && (
            <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr),360px]">
              <div className="space-y-4">
                <div className="carte flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-semibold text-slate-700">Rédaction en cours</p>
                    <p className="text-sm text-slate-400">
                      Autosave actif, import Word, images, tableaux et aperçu continu du document.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={configurationSauvegarde.classe}>{configurationSauvegarde.libelle}</span>
                    <button
                      onClick={() => sauvegarderContenu(false)}
                      disabled={enregistrementContenu || !contenuModifie}
                      className="btn-primaire disabled:opacity-60"
                    >
                      {enregistrementContenu ? "Enregistrement…" : <><Save className="w-4 h-4" />Enregistrer</>}
                    </button>
                  </div>
                </div>

                <EditeurTexteRiche
                  valeur={contenuHtml}
                  onChange={setContenuHtml}
                  placeholder="Rédigez votre pièce écrite avec une mise en forme complète…"
                  hauteurMinimale="min-h-[960px]"
                  classeRacine="piece-office-shell"
                  classeContenu="piece-office-editor"
                  barreCollante
                />
              </div>

              <div className="space-y-4">
                <div className="carte space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-700">Aperçu en direct</p>
                      <p className="text-sm text-slate-400">Mise en page continue du document pendant la rédaction.</p>
                    </div>
                    <button type="button" onClick={() => setOnglet("apercu")} className="btn-secondaire">
                      Agrandir
                    </button>
                  </div>
                  <div className="piece-office-preview max-h-[72vh] overflow-auto">
                    <article className="piece-office-page">
                      <div
                        className="piece-office-document"
                        dangerouslySetInnerHTML={{ __html: apercuDocumentHtml }}
                      />
                    </article>
                  </div>
                </div>

                {piece.modele && (
                  <div className="carte space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-700">Variables métier</p>
                        <p className="text-sm text-slate-400">{variablesRenseignees} variable(s) renseignée(s).</p>
                      </div>
                      <button type="button" onClick={() => setOnglet("modele")} className="btn-secondaire">
                        Modifier
                      </button>
                    </div>
                    <div className="space-y-2">
                      {(piece.modele_variables_fusion || []).slice(0, 6).map((variable) => (
                        <div key={variable.nom} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{variable.nom}</p>
                          <p className="mt-1 text-sm text-slate-700 line-clamp-2">
                            {variablesPersonnalisees[variable.nom] || variable.exemple || "Non renseigné"}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {onglet === "modele" && piece.modele && (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-slate-700">Variables de fusion du modèle</p>
                  <p className="text-sm text-slate-400">Ces valeurs alimentent la génération métier initiale depuis le modèle sélectionné.</p>
                </div>
                <button onClick={genererDepuisModele} disabled={generationModeleEnCours} className="btn-primaire disabled:opacity-60">
                  {generationModeleEnCours ? "Génération…" : "Générer le contenu"}
                </button>
              </div>

              <div className="carte p-6 space-y-4">
                {(piece.modele_variables_fusion || []).length === 0 ? (
                  <p className="text-sm text-slate-400">Ce modèle ne définit pas encore de variables de fusion explicites.</p>
                ) : (
                  piece.modele_variables_fusion?.map((variable) => (
                    <div key={variable.nom}>
                      <label className="libelle-champ" htmlFor={`fusion-${variable.nom}`}>
                        {variable.description || variable.nom}
                      </label>
                      <input
                        id={`fusion-${variable.nom}`}
                        type="text"
                        className="champ-saisie w-full"
                        placeholder={variable.exemple || variable.nom}
                        value={variablesPersonnalisees[variable.nom] || ""}
                        onChange={(e) =>
                          setVariablesPersonnalisees((precedent) => ({
                            ...precedent,
                            [variable.nom]: e.target.value,
                          }))
                        }
                      />
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {onglet === "apercu" && (
            <div className="carte p-4 md:p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-700">Aperçu pleine largeur</p>
                  <p className="text-sm text-slate-400">Version prête à relire avant export DOCX ou PDF.</p>
                </div>
                <button type="button" onClick={() => setOnglet("editeur")} className="btn-secondaire">
                  Retour à l&apos;édition
                </button>
              </div>
              <div className="piece-office-preview">
                <article className="piece-office-page">
                  {apercuDocumentHtml ? (
                    <div
                      className="piece-office-document"
                      dangerouslySetInnerHTML={{ __html: apercuDocumentHtml }}
                    />
                  ) : (
                    <div className="py-12 text-center text-slate-400">
                      <p>Aucun contenu à afficher. Ajoutez des articles ou rédigez directement dans l&apos;éditeur.</p>
                    </div>
                  )}
                </article>
              </div>
            </div>
          )}
        </div>
      </div>

      {modal && (
        <ModalArticle
          pieceId={pieceId}
          initial={articleEdit ? {
            chapitre: articleEdit.chapitre,
            numero_article: articleEdit.numero_article,
            ligne_prix_reference: articleEdit.ligne_prix_reference || "",
            intitule: articleEdit.intitule,
            corps_article: articleEdit.corps_article,
            normes_applicables: versTexteListe(articleEdit.normes_applicables),
            est_dans_bibliotheque: articleEdit.est_dans_bibliotheque,
            tags: versTexteListe(articleEdit.tags),
          } : VIDE_ARTICLE}
          articleId={articleEdit?.id}
          onSuccess={() => { flash(articleEdit ? "Article modifié." : "Article ajouté."); charger(); }}
          onClose={() => { setModal(false); setArticleEdit(null); }}
        />
      )}
    </div>
  );
}
