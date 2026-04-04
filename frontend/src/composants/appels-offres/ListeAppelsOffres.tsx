"use client";

import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { api, ErreurApi } from "@/crochets/useApi";
import { BoutonActionRapide, GroupeActionsRapides, LienActionRapide } from "@/composants/ui/ActionsRapides";
import { Search, Eye, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";

interface AppelOffres {
  id: string;
  intitule: string;
  type_libelle: string;
  projet_reference: string;
  projet: string;
  statut: string;
  statut_libelle: string;
  type_procedure: string;
  nb_offres: number;
  date_limite_remise: string | null;
  date_creation: string;
}

interface PageResultats {
  count: number;
  next: string | null;
  results: AppelOffres[];
}

const STYLES_STATUT: Record<string, string> = {
  preparation: "badge-neutre",
  publie: "badge-info",
  cloture: "badge-alerte",
  analyse: "badge-info",
  attribue: "badge-succes",
  infructueux: "badge-danger",
  annule: "badge-danger",
};

export function ListeAppelsOffres() {
  const queryClient = useQueryClient();
  const [recherche, setRecherche] = useState("");
  const [page, setPage] = useState(1);
  const [actionId, setActionId] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);

  const params = new URLSearchParams({ ordering: "-date_creation", page: String(page) });
  if (recherche) params.set("search", recherche);

  const { data, isLoading, isError } = useQuery<PageResultats>({
    queryKey: ["appels-offres", recherche, page],
    queryFn: () => api.get<PageResultats>(`/api/appels-offres/?${params.toString()}`),
  });

  const aos = data?.results ?? [];

  const abandonnerAppelOffres = async (ao: AppelOffres) => {
    const confirmation = window.confirm(`Abandonner l'appel d'offres « ${ao.intitule} » ?`);
    if (!confirmation) return;

    setActionId(ao.id);
    setErreur(null);
    try {
      await api.supprimer(`/api/appels-offres/${ao.id}/`);
      setSucces(`Appel d'offres « ${ao.intitule} » abandonné.`);
      queryClient.invalidateQueries({ queryKey: ["appels-offres"] });
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Impossible de mettre à jour l'appel d'offres.");
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
      ) : aos.length === 0 ? (
        <div className="py-12 text-center text-slate-400 text-sm">Aucun appel d&apos;offres.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs text-slate-500">
                <th className="text-left py-2 pr-4 font-medium">Projet</th>
                <th className="text-left py-2 pr-4 font-medium">Intitulé / Type</th>
                <th className="text-left py-2 pr-4 font-medium">Statut</th>
                <th className="text-center py-2 pr-4 font-medium">Offres</th>
                <th className="text-right py-2 pr-4 font-medium">Date remise</th>
                <th className="text-right py-2 pr-4 font-medium">Modifié</th>
                <th className="text-right py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {aos.map((ao) => (
                <tr key={ao.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <td className="py-3 pr-4">
                    <Link href={`/projets/${ao.projet}`} className="font-mono text-xs text-primaire-700 hover:underline">
                      {ao.projet_reference}
                    </Link>
                  </td>
                  <td className="py-3 pr-4">
                    <Link href={`/projets/${ao.projet}/appels-offres/${ao.id}`} className="font-medium hover:text-primaire-600 transition-colors block">
                      {ao.intitule}
                    </Link>
                    <p className="text-xs text-slate-400">{ao.type_libelle}</p>
                  </td>
                  <td className="py-3 pr-4">
                    <span className={clsx(STYLES_STATUT[ao.statut] || "badge-neutre")}>
                      {ao.statut_libelle || ao.statut}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-center font-mono text-xs">{ao.nb_offres}</td>
                  <td className="py-3 pr-4 text-right text-xs text-slate-500">
                    {ao.date_limite_remise ? new Date(ao.date_limite_remise).toLocaleDateString("fr-FR") : "—"}
                  </td>
                  <td className="py-3 pr-4 text-right text-xs text-slate-400">
                    {new Date(ao.date_creation).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="py-3 text-right">
                    <GroupeActionsRapides>
                      <LienActionRapide
                        href={`/projets/${ao.projet}/appels-offres/${ao.id}`}
                        titre="Ouvrir l'appel d'offres"
                        icone={Eye}
                      />
                      <LienActionRapide
                        href={`/projets/${ao.projet}/appels-offres/${ao.id}`}
                        titre="Modifier l'appel d'offres"
                        icone={Pencil}
                        variante="primaire"
                      />
                      <BoutonActionRapide
                        titre="Abandonner l'appel d'offres"
                        icone={Trash2}
                        variante="danger"
                        disabled={actionId === ao.id}
                        onClick={() => abandonnerAppelOffres(ao)}
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
