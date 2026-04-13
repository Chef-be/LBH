"use client";

import { useRef, useState, useEffect, type ChangeEvent } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { api, ErreurApi, extraireListeResultats } from "@/crochets/useApi";
import { useSessionStore } from "@/crochets/useSession";
import { ActionsRapidesAdaptatives } from "@/composants/ui/ActionsRapides";
import {
  Calculator,
  CheckCircle,
  DatabaseZap,
  FileSpreadsheet,
  FileUp,
  FileText,
  Filter,
  Link2,
  Pencil,
  Plus,
  Search,
  Trash2,
  UploadCloud,
  Eye,
  X,
} from "lucide-react";

interface LigneBibliotheque {
  id: string;
  code: string;
  designation_courte: string;
  designation_longue?: string;
  unite: string;
  famille: string;
  sous_famille: string;
  statut_validation: string;
  debourse_sec_unitaire: number | null;
  prix_vente_unitaire: number | null;
}

interface PageResultats {
  count: number;
  next: string | null;
  results: LigneBibliotheque[];
}

interface ArticleCCTP {
  id: string;
  chapitre: string;
  numero_article: string;
  code_reference: string;
  intitule: string;
  ligne_prix_reference: string | null;
  source_url: string;
  date_modification: string;
}

const STYLES_STATUT: Record<string, string> = {
  brouillon: "badge-neutre",
  valide: "badge-succes",
  obsolete: "badge-danger",
};

const LIBELLES_STATUT: Record<string, string> = {
  brouillon: "Brouillon",
  valide: "Validée",
  obsolete: "Obsolète",
};

function formaterMontant(val: number | null) {
  if (val == null) return "—";
  return `${Number(val).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

export function ListeBibliotheque() {
  const queryClient = useQueryClient();
  const utilisateur = useSessionStore((etat) => etat.utilisateur);
  const estSuperAdmin = Boolean(utilisateur?.est_super_admin);
  const selecteurFichiersRef = useRef<HTMLInputElement | null>(null);

  const [recherche, setRecherche] = useState("");
  const [filtreStatut, setFiltreStatut] = useState("valide");
  const [onglet, setOnglet] = useState<"prix" | "cctp">("prix");
  const [page, setPage] = useState(1);
  const [suppressionId, setSuppressionId] = useState<string | null>(null);
  const [actionGlobale, setActionGlobale] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  // Suivi progression recalcul (async)
  const [recalculTacheId, setRecalculTacheId] = useState<string | null>(null);
  const [recalculProgression, setRecalculProgression] = useState<{
    statut: string; pourcentage: number; traites: number; total: number;
    message: string; lignes_inversees?: number; lignes_recalculees?: number;
    lignes_ignorees?: number;
  } | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Polling progression recalcul
  useEffect(() => {
    if (!recalculTacheId) return;
    intervalRef.current = setInterval(async () => {
      try {
        const prog = await api.get<typeof recalculProgression>(
          `/api/bibliotheque/recalcul-progression/${recalculTacheId}/`
        );
        if (prog) {
          setRecalculProgression(prog);
          if (prog.statut === "termine" || prog.statut === "erreur") {
            clearInterval(intervalRef.current!);
            setActionGlobale(null);
            if (prog.statut === "termine") invaliderBibliotheque();
          }
        }
      } catch { /* ignoré */ }
    }, 2000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [recalculTacheId]); // eslint-disable-line react-hooks/exhaustive-deps

  const fermerModalRecalcul = () => {
    setRecalculTacheId(null);
    setRecalculProgression(null);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const params = new URLSearchParams({ ordering: "famille,code", page: String(page) });
  if (recherche) params.set("search", recherche);
  if (filtreStatut) params.set("statut_validation", filtreStatut);

  const { data, isLoading, isError } = useQuery<PageResultats>({
    queryKey: ["bibliotheque", recherche, filtreStatut, page],
    queryFn: () => api.get<PageResultats>(`/api/bibliotheque/?${params.toString()}`),
  });
  const { data: articlesData, isLoading: chargementArticles } = useQuery<ArticleCCTP[] | { results: ArticleCCTP[] }>({
    queryKey: ["bibliotheque-cctp", recherche],
    enabled: onglet === "cctp",
    queryFn: () => api.get(`/api/pieces-ecrites/articles/${recherche ? `?search=${encodeURIComponent(recherche)}` : ""}`),
  });

  const lignes = data?.results ?? [];
  const articles = extraireListeResultats(articlesData);

  const invaliderBibliotheque = () => {
    queryClient.invalidateQueries({ queryKey: ["bibliotheque"] });
  };

  const supprimerLigne = async (ligne: LigneBibliotheque) => {
    const confirmation = window.confirm(
      estSuperAdmin
        ? `Supprimer définitivement la ligne ${ligne.code || ligne.designation_courte} ?`
        : `Archiver la ligne ${ligne.code || ligne.designation_courte} ?`
    );
    if (!confirmation) return;

    setSuppressionId(ligne.id);
    setErreur(null);
    try {
      await api.supprimer(`/api/bibliotheque/${ligne.id}/`);
      setSucces(estSuperAdmin ? "Ligne supprimée définitivement." : "Ligne archivée.");
      invaliderBibliotheque();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Impossible de traiter cette ligne.");
    } finally {
      setSuppressionId(null);
    }
  };

  const importerReferentielPartage = async () => {
    setActionGlobale("referentiel");
    setErreur(null);
    try {
      const reponse = await api.post<{ detail: string; fichiers: number; lignes: number; creees: number; mises_a_jour: number }>(
        "/api/bibliotheque/importer-bordereaux/",
        {}
      );
      setSucces(
        `${reponse.detail} ${reponse.lignes} ligne(s) traitée(s), ${reponse.creees} créée(s), ${reponse.mises_a_jour} mise(s) à jour.`
      );
      invaliderBibliotheque();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Import du référentiel impossible.");
    } finally {
      setActionGlobale(null);
    }
  };

  const televerserFichiers = async (event: ChangeEvent<HTMLInputElement>) => {
    const fichiers = Array.from(event.target.files ?? []);
    if (fichiers.length === 0) return;

    const limite = window.prompt("Limiter le nombre de lignes importées par fichier (laisser vide pour tout importer) ?", "");
    const formData = new FormData();
    fichiers.forEach((fichier) => formData.append("fichiers", fichier));
    if (limite && limite.trim()) {
      formData.append("limite", limite.trim());
    }

    setActionGlobale("televersement");
    setErreur(null);
    try {
      const reponse = await api.post<{
        detail: string;
        fichiers: number;
        fichiers_ignores: number;
        lignes: number;
        creees: number;
        mises_a_jour: number;
      }>("/api/bibliotheque/importer-fichiers/", formData);
      setSucces(
        `${reponse.detail} ${reponse.lignes} ligne(s) traitée(s), ${reponse.creees} créée(s), ${reponse.mises_a_jour} mise(s) à jour.`
      );
      invaliderBibliotheque();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Import des fichiers impossible.");
    } finally {
      event.target.value = "";
      setActionGlobale(null);
    }
  };

  const importerPrixConstruction = async () => {
    const saisie = window.prompt(
      "Collez une ou plusieurs URL prix-construction.info séparées par des retours à la ligne.",
      "https://prix-construction.info/"
    );
    if (!saisie) return;

    const urls = saisie
      .split(/\r?\n/)
      .map((url) => url.trim())
      .filter(Boolean);

    if (urls.length === 0) return;

    const limite = window.prompt("Limiter le nombre de fiches importées (laisser vide pour aucune limite) ?", "");

    setActionGlobale("prix-construction");
    setErreur(null);
    try {
      const reponse = await api.post<{
        detail: string;
        fiches: number;
        creees: number;
        mises_a_jour: number;
        articles_cctp: number;
      }>("/api/bibliotheque/importer-prix-construction/", {
        urls,
        limite: limite?.trim() || undefined,
        creer_articles_cctp: true,
      });
      setSucces(
        `${reponse.detail} ${reponse.fiches} fiche(s), ${reponse.creees} création(s), ${reponse.mises_a_jour} mise(s) à jour, ${reponse.articles_cctp} article(s) CCTP.`
      );
      invaliderBibliotheque();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Import prix-construction impossible.");
    } finally {
      setActionGlobale(null);
    }
  };

  const recalculerTousLesSousDetails = async () => {
    if (!window.confirm(
      "Lancer le recalcul analytique inversé de toute la bibliothèque ?\n\n" +
      "Chaque ligne sera traitée par étude de prix inversée (DS = PV × Kpv)\n" +
      "La décomposition est calculée par étude de prix inversée (DS = PV × Kpv)."
    )) return;

    setErreur(null);
    setRecalculProgression(null);
    setActionGlobale("recalcul-global");

    try {
      const reponse = await api.post<{ detail: string; tache_id: string }>(
        "/api/bibliotheque/recalculer-tous/", {}
      );
      setRecalculTacheId(reponse.tache_id);
      setRecalculProgression({
        statut: "en_attente", pourcentage: 0, traites: 0, total: 0,
        message: "Démarrage...",
      });
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Impossible de lancer le recalcul.");
      setActionGlobale(null);
    }
  };

  const lierAutomatiquement = async () => {
    setActionGlobale("lier-auto");
    setErreur(null);
    try {
      const reponse = await api.post<{ detail: string; liaisons_creees: number }>(
        "/api/bibliotheque/lier-auto/", {}
      );
      const nb = reponse.liaisons_creees ?? 0;
      setSucces(`${nb} liaison${nb > 1 ? "s" : ""} prix↔CCTP créée${nb > 1 ? "s" : ""}.`);
      invaliderBibliotheque();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Liaison automatique impossible.");
    } finally {
      setActionGlobale(null);
    }
  };

  const viderBibliotheque = async () => {
    if (!estSuperAdmin) return;
    const confirmation = window.confirm(
      "Vider entièrement la bibliothèque de prix ? Toutes les lignes et leurs sous-détails seront supprimés définitivement."
    );
    if (!confirmation) return;

    setActionGlobale("purge");
    setErreur(null);
    try {
      const reponse = await api.supprimer("/api/bibliotheque/vider/") as { detail: string; lignes_supprimees: number };
      setSucces(`${reponse.detail} ${reponse.lignes_supprimees} ligne(s) supprimée(s).`);
      setPage(1);
      invaliderBibliotheque();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Purge impossible.");
    } finally {
      setActionGlobale(null);
    }
  };

  return (
    <div className="carte space-y-4">
      <input
        ref={selecteurFichiersRef}
        type="file"
        accept=".pdf,.PDF,.xlsx,.xls,.XLSX,.XLS"
        multiple
        className="hidden"
        onChange={televerserFichiers}
      />

      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <span className="text-sm text-slate-500">
            {onglet === "prix"
              ? data ? `${data.count} ligne${data.count > 1 ? "s" : ""}` : ""
              : `${articles.length} article${articles.length > 1 ? "s" : ""}`}
          </span>
          <p className="mt-1 text-xs text-slate-400">
            {onglet === "prix"
              ? "Référentiel éditable, imports analytiques et actions de masse."
              : "Prescriptions techniques synchronisées depuis la bibliothèque et les pièces écrites."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              onClick={() => setOnglet("prix")}
              className={clsx("rounded-lg px-3 py-1.5 text-sm", onglet === "prix" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500")}
            >
              Bibliothèque de prix
            </button>
            <button
              type="button"
              onClick={() => setOnglet("cctp")}
              className={clsx("rounded-lg px-3 py-1.5 text-sm", onglet === "cctp" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500")}
            >
              Bibliothèque CCTP
            </button>
          </div>
          {onglet === "prix" && (
            <>
          <button
            type="button"
            className="btn-secondaire text-sm"
            onClick={() => selecteurFichiersRef.current?.click()}
            disabled={actionGlobale === "televersement"}
          >
            <FileSpreadsheet className="w-4 h-4" />
            Importer PDF / Excel
          </button>
          <button
            type="button"
            className="btn-secondaire text-sm"
            onClick={importerReferentielPartage}
            disabled={actionGlobale === "referentiel"}
          >
            <UploadCloud className="w-4 h-4" />
            Importer référentiel
          </button>
          <button
            type="button"
            className="btn-secondaire text-sm"
            onClick={importerPrixConstruction}
            disabled={actionGlobale === "prix-construction"}
          >
            <DatabaseZap className="w-4 h-4" />
            Importer prix-construction
          </button>
          <button
            type="button"
            className="btn-secondaire text-sm"
            onClick={lierAutomatiquement}
            disabled={actionGlobale === "lier-auto"}
          >
            <Link2 className="w-4 h-4" />
            Lier prix ↔ CCTP
          </button>
          <button
            type="button"
            className="btn-secondaire text-sm"
            onClick={recalculerTousLesSousDetails}
            disabled={actionGlobale === "recalcul-global"}
          >
            <Calculator className="w-4 h-4" />
            {actionGlobale === "recalcul-global" ? "Recalcul en cours…" : "Recalculer tous"}
          </button>
          <Link href="/documents" className="btn-secondaire text-sm">
            <FileText className="w-4 h-4" />
            Importer depuis la GED
          </Link>
          {estSuperAdmin && (
            <button
              type="button"
              className="btn-danger text-sm"
              onClick={viderBibliotheque}
              disabled={actionGlobale === "purge"}
            >
              <Trash2 className="w-4 h-4" />
              Vider la bibliothèque
            </button>
          )}
          <Link href="/bibliotheque/nouvelle" className="btn-primaire text-sm">
            <Plus className="w-4 h-4" />
            Nouvelle ligne
          </Link>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            placeholder={onglet === "prix" ? "Rechercher par code, désignation…" : "Rechercher un article, chapitre ou prescription…"}
            className="champ-saisie pl-8"
            value={recherche}
            onChange={(e) => { setRecherche(e.target.value); setPage(1); }}
          />
        </div>
        {onglet === "prix" && (
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-slate-400" />
          <select
            className="champ-saisie w-auto"
            value={filtreStatut}
            onChange={(e) => { setFiltreStatut(e.target.value); setPage(1); }}
          >
            <option value="">Tous</option>
            {Object.entries(LIBELLES_STATUT).map(([val, lib]) => (
              <option key={val} value={val}>{lib}</option>
            ))}
          </select>
        </div>
        )}
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

      {onglet === "prix" && isLoading ? (
        <div className="py-12 text-center text-slate-400 text-sm">Chargement…</div>
      ) : onglet === "prix" && isError ? (
        <div className="py-12 text-center text-red-500 text-sm">Erreur lors du chargement.</div>
      ) : onglet === "prix" && lignes.length === 0 ? (
        <div className="py-12 text-center text-slate-400 text-sm">
          {recherche || filtreStatut ? "Aucun résultat." : "Bibliothèque vide."}
        </div>
      ) : onglet === "prix" ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs text-slate-500">
                <th className="text-left py-2 pr-4 font-medium">Code</th>
                <th className="text-left py-2 pr-4 font-medium">Désignation</th>
                <th className="text-left py-2 pr-4 font-medium">Famille</th>
                <th className="text-center py-2 pr-4 font-medium">Unité</th>
                <th className="text-right py-2 pr-4 font-medium">DS unit. HT</th>
                <th className="text-right py-2 pr-4 font-medium">PV unit. HT</th>
                <th className="text-left py-2 pr-4 font-medium">Statut</th>
                <th className="text-right py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((ligne) => (
                <tr key={ligne.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <td className="py-3 pr-4 font-mono text-xs text-slate-600">{ligne.code || "—"}</td>
                  <td className="py-3 pr-4 max-w-xs">
                    <Link href={`/bibliotheque/${ligne.id}`} className="font-medium truncate block hover:text-primaire-600 transition-colors">
                      {ligne.designation_courte}
                    </Link>
                    {ligne.sous_famille && (
                      <p className="text-xs text-slate-400 mt-0.5">{ligne.sous_famille}</p>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-xs text-slate-500">{ligne.famille || "—"}</td>
                  <td className="py-3 pr-4 text-center font-mono text-xs text-slate-500">{ligne.unite}</td>
                  <td className="py-3 pr-4 text-right font-mono text-xs text-slate-700">
                    {formaterMontant(ligne.debourse_sec_unitaire)}
                  </td>
                  <td className="py-3 pr-4 text-right font-mono text-xs font-medium text-primaire-700">
                    {formaterMontant(ligne.prix_vente_unitaire)}
                  </td>
                  <td className="py-3 pr-4">
                    <span className={clsx(STYLES_STATUT[ligne.statut_validation] || "badge-neutre")}>
                      {LIBELLES_STATUT[ligne.statut_validation] || ligne.statut_validation}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    <ActionsRapidesAdaptatives
                      actions={[
                        {
                          href: `/bibliotheque/${ligne.id}`,
                          titre: "Ouvrir la ligne",
                          icone: Eye,
                        },
                        {
                          href: `/bibliotheque/${ligne.id}`,
                          titre: "Modifier la ligne",
                          icone: Pencil,
                          variante: "primaire",
                        },
                        {
                          titre: estSuperAdmin ? "Supprimer la ligne" : "Archiver la ligne",
                          icone: Trash2,
                          variante: "danger",
                          disabled: suppressionId === ligne.id,
                          onClick: () => supprimerLigne(ligne),
                        },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : chargementArticles ? (
        <div className="py-12 text-center text-slate-400 text-sm">Chargement…</div>
      ) : articles.length === 0 ? (
        <div className="py-12 text-center text-slate-400 text-sm">
          Aucun article CCTP disponible.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs text-slate-500">
                <th className="text-left py-2 pr-4 font-medium">Article</th>
                <th className="text-left py-2 pr-4 font-medium">Chapitre</th>
                <th className="text-left py-2 pr-4 font-medium">Référence</th>
                <th className="text-right py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {articles.map((article) => (
                <tr key={article.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <td className="py-3 pr-4 max-w-md">
                    {article.ligne_prix_reference ? (
                      <Link href={`/bibliotheque/${article.ligne_prix_reference}`} className="font-medium block hover:text-primaire-600 transition-colors">
                        {article.intitule}
                      </Link>
                    ) : (
                      <p className="font-medium text-slate-800">{article.intitule}</p>
                    )}
                    <p className="text-xs text-slate-400 mt-0.5">{article.numero_article || article.code_reference}</p>
                  </td>
                  <td className="py-3 pr-4 text-xs text-slate-500">{article.chapitre || "—"}</td>
                  <td className="py-3 pr-4 font-mono text-xs text-slate-500">{article.code_reference || "—"}</td>
                  <td className="py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {article.ligne_prix_reference && (
                        <Link href={`/bibliotheque/${article.ligne_prix_reference}`} className="btn-secondaire text-xs">
                          <Eye className="w-3.5 h-3.5" />
                          Ouvrir
                        </Link>
                      )}
                      {article.source_url && (
                        <a href={article.source_url} target="_blank" rel="noreferrer" className="btn-secondaire text-xs">
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

      {onglet === "prix" && data && data.count > 20 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-slate-400">{data.count} ligne{data.count > 1 ? "s" : ""}</p>
          <div className="flex gap-2">
            <button
              className="btn-secondaire py-1 px-3 text-xs"
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ← Précédent
            </button>
            <button
              className="btn-secondaire py-1 px-3 text-xs"
              disabled={!data.next}
              onClick={() => setPage((p) => p + 1)}
            >
              Suivant →
            </button>
          </div>
        </div>
      )}

      {/* Modal de progression recalcul */}
      {recalculProgression && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-primaire-50 p-2">
                  <Calculator className="h-5 w-5 text-primaire-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">Recalcul analytique</h3>
                  <p className="text-xs text-slate-500">Étude de prix inversée analytique</p>
                </div>
              </div>
              {recalculProgression.statut === "termine" && (
                <button type="button" onClick={fermerModalRecalcul} className="rounded-lg p-1.5 hover:bg-slate-100">
                  <X className="h-4 w-4 text-slate-500" />
                </button>
              )}
            </div>

            <div className="mb-4">
              <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                <span>{recalculProgression.message}</span>
                <span className="font-mono font-medium text-slate-700">{recalculProgression.pourcentage} %</span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className={clsx("h-full rounded-full transition-all duration-500",
                    recalculProgression.statut === "termine" ? "bg-green-500" : "bg-primaire-500"
                  )}
                  style={{ width: `${recalculProgression.pourcentage}%` }}
                />
              </div>
              {recalculProgression.total > 0 && (
                <p className="mt-1 text-xs text-slate-400 text-right">
                  {recalculProgression.traites} / {recalculProgression.total} lignes
                </p>
              )}
            </div>

            {(recalculProgression.lignes_inversees !== undefined || recalculProgression.lignes_recalculees !== undefined) && (
              <div className="grid grid-cols-3 gap-3 mb-5">
                {recalculProgression.lignes_recalculees !== undefined && (
                  <div className="rounded-xl bg-blue-50 p-3 text-center">
                    <p className="text-lg font-bold text-blue-700">{recalculProgression.lignes_recalculees}</p>
                    <p className="text-xs text-blue-500">Sous-détails</p>
                  </div>
                )}
                {recalculProgression.lignes_inversees !== undefined && (
                  <div className="rounded-xl bg-green-50 p-3 text-center">
                    <p className="text-lg font-bold text-green-700">{recalculProgression.lignes_inversees}</p>
                    <p className="text-xs text-green-500">Inversées</p>
                  </div>
                )}
                {recalculProgression.lignes_ignorees !== undefined && (
                  <div className="rounded-xl bg-slate-50 p-3 text-center">
                    <p className="text-lg font-bold text-slate-500">{recalculProgression.lignes_ignorees}</p>
                    <p className="text-xs text-slate-400">Ignorées</p>
                  </div>
                )}
              </div>
            )}

            {recalculProgression.statut === "termine" && (
              <div className="flex items-center gap-2 rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
                <CheckCircle className="h-4 w-4 shrink-0" />
                Recalcul terminé. Données mises à jour.
              </div>
            )}
            {recalculProgression.statut === "termine" && (
              <button type="button" onClick={fermerModalRecalcul} className="mt-4 w-full btn-primaire justify-center">
                Fermer
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
