"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { api, ErreurApi, extraireListeResultats } from "@/crochets/useApi";
import {
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Eye,
  FileText,
  Filter,
  Link2,
  Pencil,
  Plus,
  Search,
  Tag,
  Trash2,
  Wand2,
  X,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LotCCTP {
  id: string;
  code?: string;
  numero?: string;
  intitule: string;
  description?: string;
  normes_principales?: string[];
  est_actif?: boolean;
  ordre?: number;
  nb_prescriptions?: number;
}

interface PrescriptionCCTP {
  id: string;
  intitule: string;
  corps: string;
  type_prescription: string;
  niveau: string;
  normes: string[];
  lot: { id: string; numero: string; intitule: string } | string;
  chapitre?: { id: string; intitule: string } | string;
}

interface ArticleCCTP {
  id: string;
  chapitre: string;
  numero_article: string;
  code_reference: string;
  intitule: string;
  corps_article?: string;
  lot?: string | null;
  lot_code?: string | null;
  lot_intitule?: string | null;
  ligne_prix_reference: string | null;
  source_url: string;
  date_modification: string;
  normes_applicables?: string[];
}

interface LigneBibliothequeResume {
  id: string;
  code: string;
  designation_courte: string;
  unite: string;
  famille: string;
  statut_validation: string;
}

interface PageResultats<T> {
  count?: number;
  next?: string | null;
  results?: T[];
}

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const STYLES_NIVEAU: Record<string, string> = {
  obligatoire: "badge-danger",
  recommande: "badge-avertissement",
  alternatif: "badge-neutre",
  optionnel: "badge-neutre",
};

const LIBELLES_NIVEAU: Record<string, string> = {
  obligatoire: "Obligatoire",
  recommande: "Recommandé",
  alternatif: "Alternatif",
  optionnel: "Optionnel",
};

const LIBELLES_TYPE: Record<string, string> = {
  generalites: "Généralités",
  documents_reference: "Documents de référence",
  materiaux: "Matériaux",
  mise_en_oeuvre: "Mise en œuvre",
  controles: "Contrôles",
  tolerances: "Tolérances",
  garanties: "Garanties",
  interfaces: "Interfaces",
  reception: "Réception",
  entretien: "Entretien",
  securite: "Sécurité",
  environnement: "Environnement",
};

const TYPES_FILTRE = [
  { val: "", lib: "Tous les types" },
  { val: "generalites", lib: "Généralités" },
  { val: "materiaux", lib: "Matériaux" },
  { val: "mise_en_oeuvre", lib: "Mise en œuvre" },
  { val: "controles", lib: "Contrôles" },
  { val: "tolerances", lib: "Tolérances" },
  { val: "garanties", lib: "Garanties" },
];

// ---------------------------------------------------------------------------
// Sous-composant : modal liaison prescriptions
// ---------------------------------------------------------------------------

function ModalLierPrescriptions({
  ligneId,
  onFermer,
}: {
  ligneId: string;
  onFermer: () => void;
}) {
  const queryClient = useQueryClient();
  const [recherche, setRecherche] = useState("");
  const [filtreLot, setFiltreLot] = useState("");
  const [filtreType, setFiltreType] = useState("");
  const [selection, setSelection] = useState<string[]>([]);
  const [envoi, setEnvoi] = useState(false);
  const [succes, setSucces] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const { data: lotsData } = useQuery<LotCCTP[]>({
    queryKey: ["lots-cctp-liste"],
    queryFn: () => api.get<LotCCTP[]>("/api/pieces-ecrites/lots-cctp/"),
  });
  const lots = extraireListeResultats(lotsData as unknown as LotCCTP[] | PageResultats<LotCCTP> | null | undefined);

  const params = new URLSearchParams();
  if (recherche) params.set("search", recherche);
  if (filtreLot) params.set("lot", filtreLot);
  if (filtreType) params.set("type_prescription", filtreType);

  const { data: prescriptionsData, isLoading } = useQuery<PrescriptionCCTP[]>({
    queryKey: ["prescriptions-cctp-modal", recherche, filtreLot, filtreType],
    queryFn: () => api.get<PrescriptionCCTP[]>(`/api/pieces-ecrites/prescriptions/?${params.toString()}`),
  });
  const prescriptions = extraireListeResultats(
    prescriptionsData as unknown as PrescriptionCCTP[] | PageResultats<PrescriptionCCTP> | null | undefined
  );

  const toggleSelection = (id: string) => {
    setSelection((sel) =>
      sel.includes(id) ? sel.filter((s) => s !== id) : [...sel, id]
    );
  };

  const lier = async () => {
    if (selection.length === 0) return;
    setEnvoi(true);
    setErreur(null);
    try {
      const reponse = await api.post<{ detail: string }>(
        `/api/bibliotheque/${ligneId}/lier-prescriptions/`,
        { prescription_ids: selection }
      );
      setSucces(reponse.detail);
      setSelection([]);
      queryClient.invalidateQueries({ queryKey: ["prescriptions-liees", ligneId] });
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Liaison impossible.");
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="font-semibold text-slate-900">Lier des prescriptions CCTP</h2>
          <button type="button" onClick={onFermer} className="rounded-lg p-1.5 hover:bg-slate-100">
            <X className="h-4 w-4 text-slate-500" />
          </button>
        </div>

        <div className="p-4 border-b border-slate-100 flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-40">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="Rechercher…"
              className="champ-saisie pl-8 text-sm"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
            />
          </div>
          <select
            className="champ-saisie w-auto text-sm"
            value={filtreLot}
            onChange={(e) => setFiltreLot(e.target.value)}
          >
            <option value="">Tous les lots</option>
            {lots.map((lot) => (
              <option key={lot.id} value={lot.id}>
                {lot.code || lot.numero} — {lot.intitule}
              </option>
            ))}
          </select>
          <select
            className="champ-saisie w-auto text-sm"
            value={filtreType}
            onChange={(e) => setFiltreType(e.target.value)}
          >
            {TYPES_FILTRE.map((t) => (
              <option key={t.val} value={t.val}>{t.lib}</option>
            ))}
          </select>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {isLoading ? (
            <div className="py-8 text-center text-slate-400 text-sm">Chargement…</div>
          ) : prescriptions.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-sm">Aucune prescription trouvée.</div>
          ) : (
            prescriptions.map((p) => (
              <label
                key={p.id}
                className={clsx(
                  "flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors",
                  selection.includes(p.id)
                    ? "border-primaire-300 bg-primaire-50"
                    : "border-slate-200 hover:border-slate-300"
                )}
              >
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={selection.includes(p.id)}
                  onChange={() => toggleSelection(p.id)}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800">{p.intitule}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <span className="badge-neutre text-xs">{LIBELLES_TYPE[p.type_prescription] || p.type_prescription}</span>
                    <span className={clsx(STYLES_NIVEAU[p.niveau] || "badge-neutre", "text-xs")}>
                      {LIBELLES_NIVEAU[p.niveau] || p.niveau}
                    </span>
                  </div>
                </div>
                {selection.includes(p.id) && (
                  <CheckCircle2 className="h-4 w-4 text-primaire-600 flex-shrink-0 mt-0.5" />
                )}
              </label>
            ))
          )}
        </div>

        {succes && (
          <div className="mx-4 mb-2 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
            {succes}
          </div>
        )}
        {erreur && (
          <div className="mx-4 mb-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {erreur}
          </div>
        )}

        <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4">
          <p className="text-sm text-slate-500">
            {selection.length > 0 ? `${selection.length} sélectionnée(s)` : "Aucune sélection"}
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={onFermer} className="btn-secondaire text-sm">
              Fermer
            </button>
            <button
              type="button"
              className="btn-primaire text-sm"
              onClick={lier}
              disabled={envoi || selection.length === 0}
            >
              <Link2 className="h-3.5 w-3.5" />
              Lier {selection.length > 0 ? `(${selection.length})` : ""}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sous-composant : modal création/édition lot
// ---------------------------------------------------------------------------

interface FormLot {
  code: string;
  intitule: string;
  description: string;
  normes: string;
  est_actif: boolean;
  ordre: string;
}

function ModalLot({
  lot,
  onFermer,
  onSauvegarde,
}: {
  lot?: LotCCTP | null;
  onFermer: () => void;
  onSauvegarde: () => void;
}) {
  const [form, setForm] = useState<FormLot>({
    code: lot?.code || lot?.numero || "",
    intitule: lot?.intitule || "",
    description: lot?.description || "",
    normes: (lot?.normes_principales || []).join(", "),
    est_actif: lot?.est_actif !== false,
    ordre: String(lot?.ordre ?? ""),
  });
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const changer = (champ: keyof FormLot, valeur: string | boolean) => {
    setForm((f) => ({ ...f, [champ]: valeur }));
  };

  const sauvegarder = async () => {
    if (!form.code.trim() || !form.intitule.trim()) {
      setErreur("Le code et l'intitulé sont obligatoires.");
      return;
    }
    setEnvoi(true);
    setErreur(null);

    const corps = {
      code: form.code.trim(),
      intitule: form.intitule.trim(),
      description: form.description.trim() || null,
      normes_principales: form.normes
        .split(",")
        .map((n) => n.trim())
        .filter(Boolean),
      est_actif: form.est_actif,
      ordre: form.ordre ? parseInt(form.ordre, 10) : null,
    };

    try {
      if (lot) {
        await api.patch(`/api/pieces-ecrites/lots-cctp/${lot.id}/`, corps);
      } else {
        await api.post("/api/pieces-ecrites/lots-cctp/", corps);
      }
      onSauvegarde();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Enregistrement impossible.");
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="font-semibold text-slate-900">
            {lot ? "Modifier le lot" : "Nouveau lot CCTP"}
          </h2>
          <button type="button" onClick={onFermer} className="rounded-lg p-1.5 hover:bg-slate-100">
            <X className="h-4 w-4 text-slate-500" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="etiquette-champ">
                Code <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className="champ-saisie"
                maxLength={20}
                placeholder="ex. VRD, GO, ELEC"
                value={form.code}
                onChange={(e) => changer("code", e.target.value)}
              />
            </div>
            <div>
              <label className="etiquette-champ">Ordre</label>
              <input
                type="number"
                className="champ-saisie"
                placeholder="0"
                value={form.ordre}
                onChange={(e) => changer("ordre", e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="etiquette-champ">
              Intitulé <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className="champ-saisie"
              placeholder="ex. VRD et réseaux"
              value={form.intitule}
              onChange={(e) => changer("intitule", e.target.value)}
            />
          </div>

          <div>
            <label className="etiquette-champ">Description</label>
            <textarea
              className="champ-saisie min-h-[80px]"
              placeholder="Description optionnelle du lot…"
              value={form.description}
              onChange={(e) => changer("description", e.target.value)}
            />
          </div>

          <div>
            <label className="etiquette-champ">
              Normes <span className="text-xs text-slate-400">(séparées par des virgules)</span>
            </label>
            <input
              type="text"
              className="champ-saisie"
              placeholder="ex. NF P98-170, DTU 20.1"
              value={form.normes}
              onChange={(e) => changer("normes", e.target.value)}
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.est_actif}
              onChange={(e) => changer("est_actif", e.target.checked)}
            />
            <span className="text-sm text-slate-700">Lot actif</span>
          </label>

          {erreur && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {erreur}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-6 py-4">
          <button type="button" onClick={onFermer} className="btn-secondaire text-sm">
            Annuler
          </button>
          <button
            type="button"
            className="btn-primaire text-sm"
            onClick={sauvegarder}
            disabled={envoi}
          >
            {envoi ? "Enregistrement…" : lot ? "Modifier" : "Créer"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panneau latéral — visualisation du contenu d'un article CCTP
// ---------------------------------------------------------------------------

function PanneauArticleCCTP({
  article,
  onFermer,
}: {
  article: ArticleCCTP;
  onFermer: () => void;
}) {
  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col bg-white shadow-2xl">
      {/* En-tête */}
      <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
        <div className="min-w-0 flex-1 pr-4">
          {(article.lot_code || article.chapitre) && (
            <p className="text-xs font-mono text-slate-400 mb-0.5">
              {article.lot_code && <span className="mr-2">{article.lot_code}</span>}
              {article.chapitre && <span>{article.chapitre}</span>}
            </p>
          )}
          <h2 className="text-base font-semibold text-slate-900 leading-snug">
            {article.numero_article && (
              <span className="font-mono text-slate-400 mr-2 text-sm">{article.numero_article}</span>
            )}
            {article.intitule}
          </h2>
          {article.lot_intitule && (
            <p className="text-xs text-slate-400 mt-0.5">{article.lot_intitule}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onFermer}
          className="flex-shrink-0 rounded-lg p-1.5 hover:bg-slate-100"
        >
          <X className="h-4 w-4 text-slate-500" />
        </button>
      </div>

      {/* Corps */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {article.corps_article ? (
          <div
            className="prose prose-sm prose-slate max-w-none text-sm leading-relaxed"
            dangerouslySetInnerHTML={{ __html: article.corps_article }}
          />
        ) : (
          <p className="text-slate-400 italic text-sm">Aucun contenu rédigé pour cet article.</p>
        )}

        {article.normes_applicables && article.normes_applicables.length > 0 && (
          <div className="mt-6 border-t border-slate-100 pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
              Normes applicables
            </h3>
            <ul className="space-y-1">
              {article.normes_applicables.map((norme, i) => (
                <li key={i} className="text-xs text-slate-600 font-mono">• {norme}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Pied */}
      <div className="border-t border-slate-200 px-6 py-3 flex items-center gap-2">
        <Link
          href={`/bibliotheque/article/${article.id}`}
          className="btn-secondaire text-xs"
        >
          <Pencil className="w-3.5 h-3.5" />
          Éditer
        </Link>
        {article.source_url && (
          <a
            href={article.source_url}
            target="_blank"
            rel="noreferrer"
            className="btn-secondaire text-xs"
          >
            <FileText className="w-3.5 h-3.5" />
            Source
          </a>
        )}
        <button type="button" onClick={onFermer} className="ml-auto btn-secondaire text-xs">
          Fermer
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal rattachement article → lot
// ---------------------------------------------------------------------------

function ModalRattacherLot({
  article,
  lots,
  onFermer,
  onSucces,
}: {
  article: ArticleCCTP;
  lots: LotCCTP[];
  onFermer: () => void;
  onSucces: () => void;
}) {
  const [lotId, setLotId] = useState(article.lot || "");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const rattacher = async () => {
    if (!lotId) { setErreur("Sélectionnez un corps d'état."); return; }
    setEnvoi(true);
    setErreur(null);
    try {
      await api.patch(`/api/pieces-ecrites/articles/${article.id}/`, { lot: lotId });
      onSucces();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Mise à jour impossible.");
      setEnvoi(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="font-semibold text-slate-900">Rattacher à un corps d&apos;état</h2>
          <button type="button" onClick={onFermer} className="rounded-lg p-1.5 hover:bg-slate-100">
            <X className="h-4 w-4 text-slate-500" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-600 font-medium">{article.intitule}</p>
          <div>
            <label className="etiquette-champ">Corps d&apos;état <span className="text-red-500">*</span></label>
            <select
              className="champ-saisie"
              value={lotId as string}
              onChange={(e) => setLotId(e.target.value)}
            >
              <option value="">— Sélectionner —</option>
              {lots.map((lot) => (
                <option key={lot.id} value={lot.id}>
                  {lot.code || lot.numero} — {lot.intitule}
                </option>
              ))}
            </select>
          </div>
          {erreur && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{erreur}</div>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-6 py-4">
          <button type="button" onClick={onFermer} className="btn-secondaire text-sm">Annuler</button>
          <button type="button" className="btn-primaire text-sm" onClick={rattacher} disabled={envoi}>
            {envoi ? "Enregistrement…" : "Rattacher"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sous-onglet : Articles CCTP
// ---------------------------------------------------------------------------

function SousOngletArticles() {
  const queryClient = useQueryClient();
  const { data: lotsData } = useQuery<LotCCTP[]>({
    queryKey: ["lots-cctp-articles"],
    queryFn: () => api.get<LotCCTP[]>("/api/pieces-ecrites/lots-cctp/"),
  });
  const lots = extraireListeResultats(lotsData as unknown as LotCCTP[] | PageResultats<LotCCTP> | null | undefined);

  const [recherche, setRecherche] = useState("");
  const [filtreLot, setFiltreLot] = useState("");
  const [autoClassifEnCours, setAutoClassifEnCours] = useState(false);
  const [succes, setSucces] = useState<string | null>(null);
  const [erreurGlobal, setErreurGlobal] = useState<string | null>(null);
  const [articleARattacher, setArticleARattacher] = useState<ArticleCCTP | null>(null);
  const [articleAVisualiser, setArticleAVisualiser] = useState<ArticleCCTP | null>(null);

  const params = new URLSearchParams({ est_dans_bibliotheque: "true" });
  if (recherche) params.set("search", recherche);
  if (filtreLot) params.set("lot", filtreLot);

  const { data: articlesData, isLoading } = useQuery<ArticleCCTP[] | { results: ArticleCCTP[] }>({
    queryKey: ["bibliotheque-cctp-articles-v2", recherche, filtreLot],
    queryFn: () => api.get(`/api/pieces-ecrites/articles/?${params.toString()}`),
  });
  const articles = extraireListeResultats(articlesData);

  const lancerAutoClassification = async () => {
    setAutoClassifEnCours(true);
    setSucces(null);
    setErreurGlobal(null);
    try {
      const res = await api.post<{ detail: string; classes: number; ignores: number }>(
        "/api/pieces-ecrites/articles/auto-classifier/", {}
      );
      setSucces(`${res.classes} article(s) classifié(s) automatiquement. ${res.ignores > 0 ? `${res.ignores} ignoré(s).` : ""}`);
      queryClient.invalidateQueries({ queryKey: ["bibliotheque-cctp-articles-v2"] });
    } catch (e) {
      setErreurGlobal(e instanceof ErreurApi ? e.detail : "Classification impossible.");
    } finally {
      setAutoClassifEnCours(false);
    }
  };

  const apresRattachement = () => {
    setArticleARattacher(null);
    queryClient.invalidateQueries({ queryKey: ["bibliotheque-cctp-articles-v2"] });
  };

  return (
    <div className="space-y-4">
      {/* Messages globaux */}
      {succes && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{succes}</div>
      )}
      {erreurGlobal && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erreurGlobal}</div>
      )}

      {/* Filtres et actions */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            placeholder="Rechercher un article…"
            className="champ-saisie pl-8 text-sm"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
          />
        </div>
        {lots.length > 0 && (
          <select
            className="champ-saisie w-auto text-sm"
            value={filtreLot}
            onChange={(e) => setFiltreLot(e.target.value)}
          >
            <option value="">Tous les lots</option>
            {lots.map((lot) => (
              <option key={lot.id} value={lot.id}>
                {lot.code || lot.numero} — {lot.intitule}
              </option>
            ))}
          </select>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            className="btn-secondaire text-sm"
            onClick={lancerAutoClassification}
            disabled={autoClassifEnCours}
            title="Rattacher automatiquement les articles sans corps d'état"
          >
            <Wand2 className="h-3.5 w-3.5" />
            {autoClassifEnCours ? "Classification…" : "Auto-classifier"}
          </button>
          <Link href="/bibliotheque/article/nouveau" className="btn-primaire text-sm">
            <Plus className="h-3.5 w-3.5" />
            Ajouter un article
          </Link>
        </div>
      </div>

      {/* Tableau */}
      {isLoading ? (
        <div className="py-12 text-center text-slate-400 text-sm">Chargement…</div>
      ) : articles.length === 0 ? (
        <div className="py-12 text-center text-slate-400 text-sm">
          {recherche || filtreLot ? "Aucun résultat." : "Aucun article CCTP disponible."}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs text-slate-500">
                <th className="text-left py-2 pr-4 font-medium">Intitulé</th>
                <th className="text-left py-2 pr-4 font-medium">Corps d&apos;état</th>
                <th className="text-left py-2 pr-4 font-medium">Chapitre</th>
                <th className="text-left py-2 pr-4 font-medium">Ligne de prix liée</th>
                <th className="text-right py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {articles.map((article) => (
                <tr key={article.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <td className="py-3 pr-4 max-w-xs">
                    <button
                      type="button"
                      className="text-left group"
                      onClick={() => setArticleAVisualiser(article)}
                    >
                      <p className="font-medium text-slate-800 group-hover:text-indigo-600 transition-colors">
                        {article.intitule}
                      </p>
                      {article.numero_article && (
                        <p className="text-xs text-slate-400 mt-0.5">{article.numero_article}</p>
                      )}
                    </button>
                  </td>
                  <td className="py-3 pr-4 text-xs text-slate-500">
                    {article.lot_code
                      ? <span><span className="font-mono mr-1">{article.lot_code}</span>{article.lot_intitule || ""}</span>
                      : <span className="text-orange-500 font-medium">Non classifié</span>}
                  </td>
                  <td className="py-3 pr-4 text-xs text-slate-500">
                    {article.chapitre || "—"}
                  </td>
                  <td className="py-3 pr-4">
                    {article.ligne_prix_reference ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                        <Link2 className="h-3 w-3" />
                        Liée
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                        Non liée
                      </span>
                    )}
                  </td>
                  <td className="py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        className="btn-secondaire text-xs"
                        onClick={() => setArticleARattacher(article)}
                        title="Rattacher à un corps d'état"
                      >
                        <Tag className="w-3.5 h-3.5" />
                        Rattacher
                      </button>
                      <Link href={`/bibliotheque/article/${article.id}`} className="btn-secondaire text-xs">
                        <Pencil className="w-3.5 h-3.5" />
                        Éditer
                      </Link>
                      {article.ligne_prix_reference && (
                        <Link
                          href={`/bibliotheque/${article.ligne_prix_reference}`}
                          className="btn-secondaire text-xs"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Prix
                        </Link>
                      )}
                      {article.source_url && (
                        <a
                          href={article.source_url}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-secondaire text-xs"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          Source
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal rattachement */}
      {articleARattacher && (
        <ModalRattacherLot
          article={articleARattacher}
          lots={lots}
          onFermer={() => setArticleARattacher(null)}
          onSucces={apresRattachement}
        />
      )}

      {/* Panneau visualisation article */}
      {articleAVisualiser && (
        <PanneauArticleCCTP
          article={articleAVisualiser}
          onFermer={() => setArticleAVisualiser(null)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sous-onglet : Prescriptions (ancienne vue CCTP par lot)
// ---------------------------------------------------------------------------

function SousOngletPrescriptions() {
  const [lotSelectionne, setLotSelectionne] = useState<LotCCTP | null>(null);
  const [recherchePrescrip, setRecherchePrescrip] = useState("");
  const [filtreTypePrescrip, setFiltreTypePrescrip] = useState("");
  const [rechercheLigne, setRechercheLigne] = useState("");
  const [sousVue, setSousVue] = useState<"par-lot" | "par-ligne">("par-lot");
  const [modalLiaisonLigneId, setModalLiaisonLigneId] = useState<string | null>(null);

  const { data: lotsData, isLoading: chargementLots } = useQuery<LotCCTP[]>({
    queryKey: ["bibliotheque-lots-cctp"],
    queryFn: () => api.get<LotCCTP[]>("/api/pieces-ecrites/lots-cctp/"),
  });
  const lots = extraireListeResultats(lotsData as unknown as LotCCTP[] | PageResultats<LotCCTP> | null | undefined);

  const paramsPrescriptions = new URLSearchParams();
  if (lotSelectionne) paramsPrescriptions.set("lot", lotSelectionne.id);
  if (recherchePrescrip) paramsPrescriptions.set("search", recherchePrescrip);
  if (filtreTypePrescrip) paramsPrescriptions.set("type_prescription", filtreTypePrescrip);

  const { data: prescriptionsData, isLoading: chargementPrescriptions } = useQuery<PrescriptionCCTP[]>({
    queryKey: ["prescriptions-lot", lotSelectionne?.id, recherchePrescrip, filtreTypePrescrip],
    enabled: sousVue === "par-lot" && !!lotSelectionne,
    queryFn: () =>
      api.get<PrescriptionCCTP[]>(`/api/pieces-ecrites/prescriptions/?${paramsPrescriptions.toString()}`),
  });
  const prescriptions = extraireListeResultats(
    prescriptionsData as unknown as PrescriptionCCTP[] | PageResultats<PrescriptionCCTP> | null | undefined
  );

  const paramsLignes = new URLSearchParams({ statut_validation: "valide", ordering: "famille,code" });
  if (rechercheLigne) paramsLignes.set("search", rechercheLigne);

  const { data: lignesData, isLoading: chargementLignes } = useQuery<{ count: number; results: LigneBibliothequeResume[] }>({
    queryKey: ["bibliotheque-lignes-cctp", rechercheLigne],
    enabled: sousVue === "par-ligne",
    queryFn: () =>
      api.get<{ count: number; results: LigneBibliothequeResume[] }>(`/api/bibliotheque/?${paramsLignes.toString()}`),
  });
  const lignes = lignesData?.results ?? [];

  return (
    <div className="space-y-4">
      {/* Sélecteur sous-vue */}
      <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
        <button
          type="button"
          onClick={() => setSousVue("par-lot")}
          className={clsx(
            "rounded-lg px-3 py-1.5 text-sm transition-colors",
            sousVue === "par-lot" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
          )}
        >
          <span className="flex items-center gap-1.5">
            <BookOpen className="h-3.5 w-3.5" />
            Par lot
          </span>
        </button>
        <button
          type="button"
          onClick={() => setSousVue("par-ligne")}
          className={clsx(
            "rounded-lg px-3 py-1.5 text-sm transition-colors",
            sousVue === "par-ligne" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
          )}
        >
          <span className="flex items-center gap-1.5">
            <Link2 className="h-3.5 w-3.5" />
            Par ligne de prix
          </span>
        </button>
      </div>

      {/* Vue par lot */}
      {sousVue === "par-lot" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 px-1 mb-2">
              Lots CCTP
            </p>
            {chargementLots ? (
              <div className="py-4 text-center text-slate-400 text-sm">Chargement…</div>
            ) : lots.length === 0 ? (
              <div className="py-4 text-center text-slate-400 text-sm">Aucun lot disponible.</div>
            ) : (
              lots.map((lot) => (
                <button
                  key={lot.id}
                  type="button"
                  onClick={() => setLotSelectionne(lot)}
                  className={clsx(
                    "w-full text-left flex items-center justify-between rounded-xl border px-3 py-2.5 text-sm transition-colors",
                    lotSelectionne?.id === lot.id
                      ? "border-primaire-300 bg-primaire-50 text-primaire-800"
                      : "border-slate-200 bg-white hover:border-slate-300 text-slate-700"
                  )}
                >
                  <div>
                    <span className="font-mono text-xs text-slate-400 mr-2">
                      {lot.code || lot.numero}
                    </span>
                    <span className="font-medium">{lot.intitule}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {(lot.nb_prescriptions ?? 0) > 0 && (
                      <span className="badge-neutre text-xs">{lot.nb_prescriptions}</span>
                    )}
                    <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="md:col-span-2 space-y-3">
            {!lotSelectionne ? (
              <div className="py-12 text-center text-slate-400 text-sm">
                Sélectionnez un lot pour voir ses prescriptions.
              </div>
            ) : (
              <>
                <div className="flex flex-wrap gap-2 items-center">
                  <div className="relative flex-1 min-w-40">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="search"
                      placeholder="Rechercher une prescription…"
                      className="champ-saisie pl-8 text-sm"
                      value={recherchePrescrip}
                      onChange={(e) => setRecherchePrescrip(e.target.value)}
                    />
                  </div>
                  <select
                    className="champ-saisie w-auto text-sm"
                    value={filtreTypePrescrip}
                    onChange={(e) => setFiltreTypePrescrip(e.target.value)}
                  >
                    {TYPES_FILTRE.map((t) => (
                      <option key={t.val} value={t.val}>{t.lib}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <Filter size={12} className="text-slate-400" />
                  <h3 className="text-sm font-semibold text-slate-700">
                    {lotSelectionne.code || lotSelectionne.numero} — {lotSelectionne.intitule}
                  </h3>
                  <span className="badge-neutre text-xs">{prescriptions.length} prescription(s)</span>
                </div>

                {chargementPrescriptions ? (
                  <div className="py-8 text-center text-slate-400 text-sm">Chargement…</div>
                ) : prescriptions.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-sm">Aucune prescription pour ce lot.</div>
                ) : (
                  <div className="space-y-2">
                    {prescriptions.map((p) => (
                      <div
                        key={p.id}
                        className="rounded-xl border border-slate-200 bg-white p-4 space-y-2"
                      >
                        <div className="flex flex-wrap items-start gap-2">
                          <p className="flex-1 text-sm font-medium text-slate-800">{p.intitule}</p>
                          <div className="flex gap-1 flex-wrap">
                            <span className="badge-neutre text-xs">
                              {LIBELLES_TYPE[p.type_prescription] || p.type_prescription}
                            </span>
                            <span className={clsx(STYLES_NIVEAU[p.niveau] || "badge-neutre", "text-xs")}>
                              {LIBELLES_NIVEAU[p.niveau] || p.niveau}
                            </span>
                          </div>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">{p.corps}</p>
                        {p.normes && p.normes.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {p.normes.slice(0, 4).map((norme, i) => (
                              <span key={i} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-mono text-slate-600">
                                {norme}
                              </span>
                            ))}
                            {p.normes.length > 4 && (
                              <span className="text-xs text-slate-400">+{p.normes.length - 4}</span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Vue par ligne de prix */}
      {sousVue === "par-ligne" && (
        <div className="space-y-3">
          <div className="relative max-w-sm">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="Rechercher une ligne de prix…"
              className="champ-saisie pl-8 text-sm"
              value={rechercheLigne}
              onChange={(e) => setRechercheLigne(e.target.value)}
            />
          </div>

          {chargementLignes ? (
            <div className="py-8 text-center text-slate-400 text-sm">Chargement…</div>
          ) : lignes.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-sm">
              {rechercheLigne ? "Aucun résultat." : "Bibliothèque vide."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs text-slate-500">
                    <th className="text-left py-2 pr-4 font-medium">Code</th>
                    <th className="text-left py-2 pr-4 font-medium">Désignation</th>
                    <th className="text-center py-2 pr-4 font-medium">Unité</th>
                    <th className="text-left py-2 pr-4 font-medium">Famille</th>
                    <th className="text-right py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {lignes.map((ligne) => (
                    <tr key={ligne.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="py-3 pr-4 font-mono text-xs text-slate-600">{ligne.code || "—"}</td>
                      <td className="py-3 pr-4 max-w-xs">
                        <span className="font-medium text-slate-800">
                          {ligne.designation_courte.length > 70
                            ? `${ligne.designation_courte.slice(0, 70)}…`
                            : ligne.designation_courte}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-center font-mono text-xs text-slate-500">{ligne.unite}</td>
                      <td className="py-3 pr-4 text-xs text-slate-500">{ligne.famille || "—"}</td>
                      <td className="py-3 text-right">
                        <button
                          type="button"
                          className="btn-secondaire text-xs"
                          onClick={() => setModalLiaisonLigneId(ligne.id)}
                        >
                          <Link2 className="h-3 w-3" />
                          Lier prescriptions
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal liaison prescriptions */}
      {modalLiaisonLigneId && (
        <ModalLierPrescriptions
          ligneId={modalLiaisonLigneId}
          onFermer={() => setModalLiaisonLigneId(null)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sous-onglet : Lots CCTP (CRUD)
// ---------------------------------------------------------------------------

function SousOngletLots() {
  const queryClient = useQueryClient();
  const [modalLot, setModalLot] = useState<{ ouvert: boolean; lot?: LotCCTP | null }>({
    ouvert: false,
    lot: null,
  });
  const [suppressionId, setSuppressionId] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);

  const { data: lotsData, isLoading } = useQuery<LotCCTP[]>({
    queryKey: ["lots-cctp-crud"],
    queryFn: () => api.get<LotCCTP[]>("/api/pieces-ecrites/lots-cctp/"),
  });
  const lots = extraireListeResultats(lotsData as unknown as LotCCTP[] | PageResultats<LotCCTP> | null | undefined);

  const invalider = () => {
    queryClient.invalidateQueries({ queryKey: ["lots-cctp-crud"] });
    queryClient.invalidateQueries({ queryKey: ["bibliotheque-lots-cctp"] });
    queryClient.invalidateQueries({ queryKey: ["lots-cctp-liste"] });
    queryClient.invalidateQueries({ queryKey: ["lots-cctp-articles"] });
  };

  const supprimer = async (lot: LotCCTP) => {
    if (!window.confirm(`Supprimer le lot "${lot.intitule}" ?`)) return;
    setSuppressionId(lot.id);
    setErreur(null);
    try {
      await api.supprimer(`/api/pieces-ecrites/lots-cctp/${lot.id}/`);
      setSucces("Lot supprimé.");
      invalider();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Suppression impossible.");
    } finally {
      setSuppressionId(null);
    }
  };

  const apresCreation = () => {
    setModalLot({ ouvert: false, lot: null });
    setSucces("Lot enregistré.");
    invalider();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Gérer les corps d&apos;état (lots CCTP) utilisés pour classifier les articles.
        </p>
        <button
          type="button"
          className="btn-primaire text-sm"
          onClick={() => setModalLot({ ouvert: true, lot: null })}
        >
          <Plus className="h-3.5 w-3.5" />
          Nouveau lot
        </button>
      </div>

      {succes && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {succes}
        </div>
      )}
      {erreur && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {erreur}
        </div>
      )}

      {isLoading ? (
        <div className="py-12 text-center text-slate-400 text-sm">Chargement…</div>
      ) : lots.length === 0 ? (
        <div className="py-12 text-center text-slate-400 text-sm">Aucun lot CCTP défini.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs text-slate-500">
                <th className="text-left py-2 pr-4 font-medium">Code</th>
                <th className="text-left py-2 pr-4 font-medium">Intitulé</th>
                <th className="text-left py-2 pr-4 font-medium">Description</th>
                <th className="text-left py-2 pr-4 font-medium">Normes</th>
                <th className="text-center py-2 pr-4 font-medium">Actif</th>
                <th className="text-right py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {lots.map((lot) => (
                <tr key={lot.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="py-3 pr-4 font-mono text-xs font-medium text-slate-700">
                    {lot.code || lot.numero || "—"}
                  </td>
                  <td className="py-3 pr-4 font-medium text-slate-800">{lot.intitule}</td>
                  <td className="py-3 pr-4 max-w-xs text-xs text-slate-500">
                    {lot.description
                      ? lot.description.length > 60
                        ? `${lot.description.slice(0, 60)}…`
                        : lot.description
                      : "—"}
                  </td>
                  <td className="py-3 pr-4">
                    {lot.normes_principales && lot.normes_principales.length > 0 ? (
                      <div className="flex flex-col gap-0.5">
                        {lot.normes_principales.slice(0, 2).map((norme, i) => (
                          <span key={i} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-mono text-slate-600 truncate max-w-[200px]" title={norme}>
                            {norme.length > 30 ? `${norme.slice(0, 30)}…` : norme}
                          </span>
                        ))}
                        {lot.normes_principales.length > 2 && (
                          <span className="text-xs text-slate-400">
                            <Tag className="inline h-3 w-3 mr-0.5" />
                            +{lot.normes_principales.length - 2} normes
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-center">
                    <span
                      className={clsx(
                        "inline-block h-2 w-2 rounded-full",
                        lot.est_actif !== false ? "bg-green-500" : "bg-slate-300"
                      )}
                    />
                  </td>
                  <td className="py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        className="btn-secondaire text-xs"
                        onClick={() => setModalLot({ ouvert: true, lot })}
                      >
                        <Pencil className="h-3 w-3" />
                        Éditer
                      </button>
                      <button
                        type="button"
                        className="btn-danger text-xs"
                        disabled={suppressionId === lot.id}
                        onClick={() => supprimer(lot)}
                      >
                        <Trash2 className="h-3 w-3" />
                        Supprimer
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal lot */}
      {modalLot.ouvert && (
        <ModalLot
          lot={modalLot.lot}
          onFermer={() => setModalLot({ ouvert: false, lot: null })}
          onSauvegarde={apresCreation}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Composant principal avec 3 sous-onglets
// ---------------------------------------------------------------------------

type SousOngletCCTP = "articles" | "lots";

export function OngletCCTPBibliotheque() {
  const [sousOnglet, setSousOnglet] = useState<SousOngletCCTP>("articles");

  const onglets: { val: SousOngletCCTP; lib: string; icone: React.ReactNode }[] = [
    { val: "articles", lib: "Articles CCTP", icone: <FileText className="h-3.5 w-3.5" /> },
    { val: "lots", lib: "Corps d\u2019état (lots)", icone: <Tag className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="space-y-4">
      {/* Sélecteur sous-onglets */}
      <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
        {onglets.map(({ val, lib, icone }) => (
          <button
            key={val}
            type="button"
            onClick={() => setSousOnglet(val)}
            className={clsx(
              "rounded-lg px-3 py-1.5 text-sm transition-colors",
              sousOnglet === val
                ? "bg-white text-slate-800 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            <span className="flex items-center gap-1.5">
              {icone}
              {lib}
            </span>
          </button>
        ))}
      </div>

      {/* Contenu du sous-onglet actif */}
      {sousOnglet === "articles" && <SousOngletArticles />}
      {sousOnglet === "lots" && <SousOngletLots />}
    </div>
  );
}
