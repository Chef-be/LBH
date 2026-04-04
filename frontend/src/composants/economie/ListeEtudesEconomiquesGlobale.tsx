"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { clsx } from "clsx";
import { api } from "@/crochets/useApi";
import { Search, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface EtudeEconomique {
  id: string;
  projet: string;
  projet_reference: string;
  intitule: string;
  statut: string;
  version: number;
  est_variante: boolean;
  total_prix_vente: number | null;
  taux_marge_nette_global: number | null;
  date_modification: string;
}

interface PageResultats {
  count: number;
  next: string | null;
  results: EtudeEconomique[];
}

const STYLES_STATUT: Record<string, string> = {
  brouillon: "badge-neutre",
  en_cours: "badge-info",
  a_valider: "badge-alerte",
  validee: "badge-succes",
  archivee: "badge-neutre",
};

const LIBELLES_STATUT: Record<string, string> = {
  brouillon: "Brouillon",
  en_cours: "En cours",
  a_valider: "À valider",
  validee: "Validée",
  archivee: "Archivée",
};

function IconeMarge({ taux }: { taux: number | null }) {
  if (taux == null) return <Minus size={14} className="text-slate-300" />;
  if (taux >= 0.08) return <TrendingUp size={14} className="text-green-500" />;
  if (taux >= 0.03) return <Minus size={14} className="text-yellow-500" />;
  return <TrendingDown size={14} className="text-red-500" />;
}

export function ListeEtudesEconomiquesGlobale() {
  const [recherche, setRecherche] = useState("");
  const [filtreStatut, setFiltreStatut] = useState("");
  const [page, setPage] = useState(1);

  const params = new URLSearchParams({ ordering: "-date_modification", page: String(page) });
  if (recherche) params.set("search", recherche);
  if (filtreStatut) params.set("statut", filtreStatut);
  if (filtreStatut !== "archivee") params.set("variantes", "0");

  const { data, isLoading, isError } = useQuery<PageResultats>({
    queryKey: ["etudes-economiques-globale", recherche, filtreStatut, page],
    queryFn: () => api.get<PageResultats>(`/api/economie/?${params.toString()}`),
  });

  const etudes = data?.results ?? [];

  return (
    <div className="carte space-y-4">
      {/* Filtres */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            placeholder="Rechercher par intitulé, projet…"
            className="champ-saisie pl-8"
            value={recherche}
            onChange={(e) => { setRecherche(e.target.value); setPage(1); }}
          />
        </div>
        <select
          className="champ-saisie w-auto"
          value={filtreStatut}
          onChange={(e) => { setFiltreStatut(e.target.value); setPage(1); }}
        >
          <option value="">Tous les statuts</option>
          {Object.entries(LIBELLES_STATUT).map(([val, lib]) => (
            <option key={val} value={val}>{lib}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-slate-400 text-sm">Chargement…</div>
      ) : isError ? (
        <div className="py-12 text-center text-red-500 text-sm">Erreur lors du chargement.</div>
      ) : etudes.length === 0 ? (
        <div className="py-12 text-center text-slate-400 text-sm">
          {recherche || filtreStatut ? "Aucune étude ne correspond aux filtres." : "Aucune étude économique."}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs text-slate-500">
                <th className="text-left py-2 pr-4 font-medium">Projet</th>
                <th className="text-left py-2 pr-4 font-medium">Étude</th>
                <th className="text-left py-2 pr-4 font-medium">Statut</th>
                <th className="text-right py-2 pr-4 font-medium">Total PV HT</th>
                <th className="text-right py-2 pr-4 font-medium">Taux marge</th>
                <th className="text-right py-2 font-medium">Modifié</th>
              </tr>
            </thead>
            <tbody>
              {etudes.map((etude) => (
                <tr key={etude.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <td className="py-3 pr-4">
                    <Link
                      href={`/projets/${etude.projet}`}
                      className="font-mono text-xs text-primaire-700 hover:underline"
                    >
                      {etude.projet_reference}
                    </Link>
                  </td>
                  <td className="py-3 pr-4">
                    <Link
                      href={`/projets/${etude.projet}/economie/${etude.id}`}
                      className="font-medium hover:text-primaire-700 hover:underline"
                    >
                      {etude.intitule}
                    </Link>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-mono text-xs text-slate-400">v{etude.version}</span>
                      {etude.est_variante && <span className="badge-neutre text-xs">variante</span>}
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    <span className={clsx(STYLES_STATUT[etude.statut] || "badge-neutre")}>
                      {LIBELLES_STATUT[etude.statut] || etude.statut}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-right font-mono text-xs text-slate-700">
                    {etude.total_prix_vente != null
                      ? `${Number(etude.total_prix_vente).toLocaleString("fr-FR", { minimumFractionDigits: 0 })} €`
                      : "—"}
                  </td>
                  <td className="py-3 pr-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <IconeMarge taux={etude.taux_marge_nette_global} />
                      <span className={clsx(
                        "font-mono text-xs",
                        etude.taux_marge_nette_global != null && etude.taux_marge_nette_global >= 0.08
                          ? "text-green-600"
                          : etude.taux_marge_nette_global != null && etude.taux_marge_nette_global >= 0.03
                          ? "text-yellow-600"
                          : "text-red-600"
                      )}>
                        {etude.taux_marge_nette_global != null
                          ? `${(Number(etude.taux_marge_nette_global) * 100).toFixed(1)} %`
                          : "—"}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 text-right text-xs text-slate-400">
                    {new Date(etude.date_modification).toLocaleDateString("fr-FR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {data && data.count > 20 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-slate-400">{data.count} étude{data.count > 1 ? "s" : ""}</p>
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
    </div>
  );
}
