"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api, extraireListeResultats } from "@/crochets/useApi";
import { Eye, FileText, Search } from "lucide-react";

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

export function OngletArticlesBibliotheque() {
  const [recherche, setRecherche] = useState("");

  const { data: articlesData, isLoading } = useQuery<ArticleCCTP[] | { results: ArticleCCTP[] }>({
    queryKey: ["bibliotheque-cctp-articles", recherche],
    queryFn: () =>
      api.get(`/api/pieces-ecrites/articles/${recherche ? `?search=${encodeURIComponent(recherche)}` : ""}`),
  });

  const articles = extraireListeResultats(articlesData);

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          placeholder="Rechercher un article, chapitre ou prescription…"
          className="champ-saisie pl-8"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-slate-400 text-sm">Chargement…</div>
      ) : articles.length === 0 ? (
        <div className="py-12 text-center text-slate-400 text-sm">
          {recherche ? "Aucun résultat." : "Aucun article CCTP disponible."}
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
                      <Link
                        href={`/bibliotheque/${article.ligne_prix_reference}`}
                        className="font-medium block hover:text-primaire-600 transition-colors"
                      >
                        {article.intitule}
                      </Link>
                    ) : (
                      <p className="font-medium text-slate-800">{article.intitule}</p>
                    )}
                    <p className="text-xs text-slate-400 mt-0.5">
                      {article.numero_article || article.code_reference}
                    </p>
                  </td>
                  <td className="py-3 pr-4 text-xs text-slate-500">{article.chapitre || "—"}</td>
                  <td className="py-3 pr-4 font-mono text-xs text-slate-500">{article.code_reference || "—"}</td>
                  <td className="py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {article.ligne_prix_reference && (
                        <Link
                          href={`/bibliotheque/${article.ligne_prix_reference}`}
                          className="btn-secondaire text-xs"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Ouvrir
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
    </div>
  );
}
