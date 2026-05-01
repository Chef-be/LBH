"use client";

import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { api, ErreurApi } from "@/crochets/useApi";
import { BoutonActionRapide, GroupeActionsRapides, LienActionRapide } from "@/composants/ui/ActionsRapides";
import { Search, Eye, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";

interface Metre {
  id: string;
  intitule: string;
  projet_reference: string;
  projet: string;
  statut: string;
  statut_libelle: string;
  quantites_par_unite?: Record<string, number | string>;
  nb_lignes?: number;
  nb_zones_mesurees?: number;
  date_modification: string;
}

interface PageResultats {
  count: number;
  next: string | null;
  results: Metre[];
}

const STYLES_STATUT: Record<string, string> = {
  brouillon: "badge-neutre",
  en_cours: "badge-info",
  valide: "badge-succes",
  archive: "badge-neutre",
};

function resumeQuantites(metre: Metre): string {
  const entrees = Object.entries(metre.quantites_par_unite ?? {});
  if (entrees.length === 0) return "—";
  return entrees
    .slice(0, 3)
    .map(([unite, valeur]) => `${Number(valeur || 0).toLocaleString("fr-FR")} ${unite}`)
    .join(" · ");
}

export function ListeMetres() {
  const queryClient = useQueryClient();
  const [recherche, setRecherche] = useState("");
  const [page, setPage] = useState(1);
  const [actionId, setActionId] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);

  const params = new URLSearchParams({ ordering: "-date_modification", page: String(page) });
  if (recherche) params.set("search", recherche);

  const { data, isLoading, isError } = useQuery<PageResultats>({
    queryKey: ["metres", recherche, page],
    queryFn: () => api.get<PageResultats>(`/api/metres/?${params.toString()}`),
  });

  const metres = data?.results ?? [];

  const supprimerMetre = async (metre: Metre) => {
    const confirmation = window.confirm(`Supprimer le métré « ${metre.intitule} » ?`);
    if (!confirmation) return;

    setActionId(metre.id);
    setErreur(null);
    try {
      await api.supprimer(`/api/metres/${metre.id}/`);
      setSucces(`Métré « ${metre.intitule} » supprimé.`);
      queryClient.invalidateQueries({ queryKey: ["metres"] });
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Impossible de supprimer le métré.");
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="carte space-y-4">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          placeholder="Rechercher…"
          className="champ-saisie pl-8 w-full"
          value={recherche}
          onChange={(e) => { setRecherche(e.target.value); setPage(1); }}
        />
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
      ) : isError ? (
        <div className="py-12 text-center text-red-500 text-sm">Erreur lors du chargement.</div>
      ) : metres.length === 0 ? (
        <div className="py-12 text-center text-slate-400 text-sm">Aucun métré.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs text-slate-500">
                <th className="text-left py-2 pr-4 font-medium">Projet</th>
                <th className="text-left py-2 pr-4 font-medium">Intitulé</th>
                <th className="text-left py-2 pr-4 font-medium">Statut</th>
                <th className="text-right py-2 pr-4 font-medium">Quantités</th>
                <th className="text-right py-2 pr-4 font-medium">Modifié</th>
                <th className="text-right py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {metres.map((m) => (
                <tr key={m.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <td className="py-3 pr-4">
                    <Link href={`/projets/${m.projet}`} className="font-mono text-xs text-primaire-700 hover:underline">
                      {m.projet_reference}
                    </Link>
                  </td>
                  <td className="py-3 pr-4 font-medium">
                    <Link href={`/projets/${m.projet}/metres/${m.id}`} className="hover:text-primaire-600 transition-colors">
                      {m.intitule}
                    </Link>
                  </td>
                  <td className="py-3 pr-4">
                    <span className={clsx(STYLES_STATUT[m.statut] || "badge-neutre")}>
                      {m.statut_libelle || m.statut}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-right font-mono text-xs">
                    {resumeQuantites(m)}
                    {typeof m.nb_lignes === "number" && (
                      <span className="ml-2 text-slate-400">({m.nb_lignes} ligne{m.nb_lignes > 1 ? "s" : ""})</span>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-right text-xs text-slate-400">
                    {new Date(m.date_modification).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="py-3 text-right">
                    <GroupeActionsRapides>
                      <LienActionRapide
                        href={`/projets/${m.projet}/metres/${m.id}`}
                        titre="Ouvrir le métré"
                        icone={Eye}
                      />
                      <LienActionRapide
                        href={`/projets/${m.projet}/metres/${m.id}`}
                        titre="Modifier le métré"
                        icone={Pencil}
                        variante="primaire"
                      />
                      <BoutonActionRapide
                        titre="Supprimer le métré"
                        icone={Trash2}
                        variante="danger"
                        disabled={actionId === m.id}
                        onClick={() => supprimerMetre(m)}
                      />
                    </GroupeActionsRapides>
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
