"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ErreurApi, extraireListeResultats } from "@/crochets/useApi";
import { EditeurTexteRiche } from "@/composants/ui/EditeurTexteRiche";
import { ArrowLeft, Save, Trash2, Plus, X, Tag, Link2 } from "lucide-react";

interface LotCCTP {
  id: string;
  code?: string;
  numero?: string;
  intitule: string;
}

interface ArticleCCTP {
  id: string;
  intitule: string;
  chapitre: string;
  numero_article: string;
  code_reference: string;
  corps_article: string;
  lot: string | null;
  lot_code: string | null;
  lot_intitule: string | null;
  normes_applicables: string[];
  tags: string[];
  source: string;
  source_url: string;
  ligne_prix_reference: string | null;
  est_dans_bibliotheque: boolean;
  date_creation: string;
  date_modification: string;
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function PageDetailArticleCCTP({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    intitule: "",
    chapitre: "",
    numero_article: "",
    corps_article: "",
    lot: "",
    normes_applicables: [] as string[],
    tags: [] as string[],
    source: "",
    source_url: "",
    est_dans_bibliotheque: true,
  });
  const [normeInput, setNormeInput] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [enregistrement, setEnregistrement] = useState(false);
  const [suppression, setSuppression] = useState(false);
  const [succes, setSucces] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const { data: article, isLoading } = useQuery<ArticleCCTP>({
    queryKey: ["article-cctp", id],
    queryFn: () => api.get<ArticleCCTP>(`/api/pieces-ecrites/articles/${id}/`),
  });

  const { data: lotsData } = useQuery<LotCCTP[]>({
    queryKey: ["lots-cctp-article"],
    queryFn: () => api.get<LotCCTP[]>("/api/pieces-ecrites/lots-cctp/"),
  });
  const lots = extraireListeResultats(lotsData as unknown as LotCCTP[] | { results: LotCCTP[] } | null | undefined);

  useEffect(() => {
    if (!article) return;
    setFormData({
      intitule: article.intitule || "",
      chapitre: article.chapitre || "",
      numero_article: article.numero_article || "",
      corps_article: article.corps_article || "",
      lot: article.lot || "",
      normes_applicables: article.normes_applicables || [],
      tags: article.tags || [],
      source: article.source || "",
      source_url: article.source_url || "",
      est_dans_bibliotheque: article.est_dans_bibliotheque,
    });
  }, [article]);

  const changer = (champ: string, valeur: string | boolean) => {
    setFormData((f) => ({ ...f, [champ]: valeur }));
    setSucces(null);
  };

  const ajouterNorme = () => {
    const val = normeInput.trim();
    if (!val || formData.normes_applicables.includes(val)) return;
    setFormData((f) => ({ ...f, normes_applicables: [...f.normes_applicables, val] }));
    setNormeInput("");
  };

  const supprimerNorme = (norme: string) => {
    setFormData((f) => ({ ...f, normes_applicables: f.normes_applicables.filter((n) => n !== norme) }));
  };

  const ajouterTag = () => {
    const val = tagInput.trim().toLowerCase();
    if (!val || formData.tags.includes(val)) return;
    setFormData((f) => ({ ...f, tags: [...f.tags, val] }));
    setTagInput("");
  };

  const supprimerTag = (tag: string) => {
    setFormData((f) => ({ ...f, tags: f.tags.filter((t) => t !== tag) }));
  };

  const enregistrer = async () => {
    if (!formData.intitule.trim()) {
      setErreur("L'intitulé est obligatoire.");
      return;
    }
    setEnregistrement(true);
    setErreur(null);
    try {
      await api.patch(`/api/pieces-ecrites/articles/${id}/`, {
        ...formData,
        lot: formData.lot || null,
      });
      setSucces("Article enregistré.");
      queryClient.invalidateQueries({ queryKey: ["article-cctp", id] });
      queryClient.invalidateQueries({ queryKey: ["bibliotheque-cctp-articles-v2"] });
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Enregistrement impossible.");
    } finally {
      setEnregistrement(false);
    }
  };

  const supprimer = async () => {
    if (!window.confirm(`Supprimer définitivement l'article "${article?.intitule}" ?`)) return;
    setSuppression(true);
    setErreur(null);
    try {
      await api.supprimer(`/api/pieces-ecrites/articles/${id}/`);
      queryClient.invalidateQueries({ queryKey: ["bibliotheque-cctp-articles-v2"] });
      router.push("/bibliotheque?onglet=cctp");
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Suppression impossible.");
      setSuppression(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-24 text-center text-slate-400 text-sm">Chargement…</div>
    );
  }

  if (!article) {
    return (
      <div className="py-24 text-center text-slate-400 text-sm">
        Article introuvable.{" "}
        <Link href="/bibliotheque?onglet=cctp" className="text-primaire-600 underline">
          Retour à la bibliothèque
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* En-tête */}
      <div className="flex items-center gap-3">
        <Link href="/bibliotheque?onglet=cctp" className="rounded-lg p-2 hover:bg-slate-100 transition-colors">
          <ArrowLeft className="h-4 w-4 text-slate-500" />
        </Link>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-400 font-mono mb-0.5">
            {article.numero_article || article.code_reference || "—"}
          </p>
          <h1 className="text-xl font-bold text-slate-900 truncate">{article.intitule}</h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            className="btn-danger text-sm"
            onClick={supprimer}
            disabled={suppression}
          >
            <Trash2 className="h-4 w-4" />
            Supprimer
          </button>
          <button
            type="button"
            className="btn-primaire text-sm"
            onClick={enregistrer}
            disabled={enregistrement}
          >
            <Save className="h-4 w-4" />
            {enregistrement ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Colonne principale */}
        <div className="lg:col-span-2 space-y-4">
          {/* Intitulé */}
          <div className="carte space-y-4">
            <h2 className="text-sm font-semibold text-slate-700">Identification</h2>
            <div>
              <label className="libelle-champ">Intitulé <span className="text-red-500">*</span></label>
              <input
                type="text"
                className="champ-saisie w-full"
                value={formData.intitule}
                onChange={(e) => changer("intitule", e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="libelle-champ">Numéro d&apos;article</label>
                <input
                  type="text"
                  className="champ-saisie w-full font-mono"
                  placeholder="ex. II.3.2"
                  value={formData.numero_article}
                  onChange={(e) => changer("numero_article", e.target.value)}
                />
              </div>
              <div>
                <label className="libelle-champ">Chapitre</label>
                <input
                  type="text"
                  className="champ-saisie w-full"
                  placeholder="ex. Mise en œuvre"
                  value={formData.chapitre}
                  onChange={(e) => changer("chapitre", e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Corps de l'article */}
          <div className="carte space-y-3">
            <h2 className="text-sm font-semibold text-slate-700">Corps de l&apos;article</h2>
            <EditeurTexteRiche
              valeur={formData.corps_article}
              onChange={(html) => changer("corps_article", html)}
              placeholder="Rédiger le corps de l'article CCTP…"
              hauteurMinimale="min-h-[400px]"
              barreCollante
            />
            <p className="text-xs text-slate-400">
              Variables de fusion : <code className="bg-slate-100 px-1 rounded text-slate-600">{"{{"} nom_projet {"}}"}</code>
            </p>
          </div>

          {/* Normes applicables */}
          <div className="carte space-y-3">
            <h2 className="text-sm font-semibold text-slate-700">Normes applicables</h2>
            <div className="flex gap-2">
              <input
                type="text"
                className="champ-saisie flex-1"
                placeholder="ex. DTU 60.1, NF EN 806…"
                value={normeInput}
                onChange={(e) => setNormeInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); ajouterNorme(); } }}
              />
              <button type="button" className="btn-secondaire text-sm" onClick={ajouterNorme}>
                <Plus className="h-4 w-4" />
                Ajouter
              </button>
            </div>
            {formData.normes_applicables.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {formData.normes_applicables.map((norme) => (
                  <span
                    key={norme}
                    className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-mono text-blue-700"
                  >
                    {norme}
                    <button type="button" onClick={() => supprimerNorme(norme)} className="hover:text-blue-900 ml-0.5">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Colonne latérale */}
        <div className="space-y-4">
          {/* Corps d'état */}
          <div className="carte space-y-3">
            <h2 className="text-sm font-semibold text-slate-700">Corps d&apos;état</h2>
            <select
              className="champ-saisie w-full"
              value={formData.lot}
              onChange={(e) => changer("lot", e.target.value)}
            >
              <option value="">— Non classifié —</option>
              {lots.map((lot) => (
                <option key={lot.id} value={lot.id}>
                  {lot.code || lot.numero} — {lot.intitule}
                </option>
              ))}
            </select>
          </div>

          {/* Tags */}
          <div className="carte space-y-3">
            <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
              <Tag className="h-3.5 w-3.5 text-slate-400" />
              Tags
            </h2>
            <div className="flex gap-2">
              <input
                type="text"
                className="champ-saisie flex-1 text-sm"
                placeholder="Ajouter un tag…"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); ajouterTag(); } }}
              />
              <button type="button" className="btn-secondaire text-xs" onClick={ajouterTag}>
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            {formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {formData.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                  >
                    {tag}
                    <button type="button" onClick={() => supprimerTag(tag)} className="hover:text-red-500">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Source */}
          <div className="carte space-y-3">
            <h2 className="text-sm font-semibold text-slate-700">Source</h2>
            <div>
              <label className="libelle-champ">Origine</label>
              <input
                type="text"
                className="champ-saisie w-full text-sm"
                placeholder="ex. Prescriptions CCTP — Widloecher"
                value={formData.source}
                onChange={(e) => changer("source", e.target.value)}
              />
            </div>
            <div>
              <label className="libelle-champ">URL de référence</label>
              <input
                type="url"
                className="champ-saisie w-full text-sm font-mono"
                placeholder="https://…"
                value={formData.source_url}
                onChange={(e) => changer("source_url", e.target.value)}
              />
            </div>
          </div>

          {/* Ligne de prix liée */}
          <div className="carte space-y-3">
            <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
              <Link2 className="h-3.5 w-3.5 text-slate-400" />
              Ligne de prix liée
            </h2>
            {article.ligne_prix_reference ? (
              <div className="flex items-center justify-between">
                <span className="text-xs text-green-700 bg-green-100 rounded-full px-2.5 py-1">
                  Liée
                </span>
                <Link
                  href={`/bibliotheque/${article.ligne_prix_reference}`}
                  className="btn-secondaire text-xs"
                >
                  Ouvrir
                </Link>
              </div>
            ) : (
              <p className="text-xs text-slate-400">Aucune ligne de prix associée.</p>
            )}
          </div>

          {/* Bibliothèque */}
          <div className="carte space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.est_dans_bibliotheque}
                onChange={(e) => changer("est_dans_bibliotheque", e.target.checked)}
              />
              <span className="text-sm text-slate-700">Dans la bibliothèque partagée</span>
            </label>
            <p className="text-xs text-slate-400 pl-5">
              Les articles de bibliothèque sont disponibles pour import dans toutes les pièces écrites.
            </p>
          </div>

          {/* Métadonnées */}
          <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 space-y-1.5 text-xs text-slate-400">
            <p>Créé le {new Date(article.date_creation).toLocaleDateString("fr-FR")}</p>
            <p>Modifié le {new Date(article.date_modification).toLocaleDateString("fr-FR")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
