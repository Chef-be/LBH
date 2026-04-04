"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { clsx } from "clsx";
import { PlusCircle, Search } from "lucide-react";
import { api } from "@/crochets/useApi";

interface EtudePrix {
  id: string;
  code: string;
  intitule: string;
  methode: string;
  methode_libelle: string;
  lot_type: string;
  lot_libelle: string;
  projet: string | null;
  projet_reference: string | null;
  organisation: string | null;
  organisation_nom: string | null;
  millesime: number;
  zone_taux_horaire: string;
  taux_horaire_mo: number | null;
  statut: string;
  statut_libelle: string;
  debourse_sec_ht: number | null;
  date_etude: string | null;
  date_modification: string;
}

interface PageResultats {
  count: number;
  next: string | null;
  results: EtudePrix[];
}

const STYLES_STATUT: Record<string, string> = {
  brouillon: "badge-neutre",
  en_cours: "badge-info",
  a_valider: "badge-alerte",
  validee: "badge-succes",
  publiee: "bg-blue-100 text-blue-700 border border-blue-200",
  archivee: "badge-neutre",
};

const LIBELLES_STATUT: Record<string, string> = {
  brouillon: "Brouillon",
  en_cours: "En cours",
  a_valider: "À valider",
  validee: "Validée",
  publiee: "Publiée",
  archivee: "Archivée",
};

function formaterMontant(valeur: number | null): string {
  if (valeur == null) return "—";
  return `${Number(valeur).toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} €`;
}

export function ListeEtudesPrix({ projetId }: { projetId?: string }) {
  const [recherche, setRecherche] = useState("");
  const [filtreStatut, setFiltreStatut] = useState("");
  const [page, setPage] = useState(1);

  const params = new URLSearchParams({
    ordering: "-date_modification",
    page: String(page),
  });
  if (projetId) params.set("projet", projetId);
  if (recherche) params.set("search", recherche);
  if (filtreStatut) params.set("statut", filtreStatut);

  const { data, isLoading, isError } = useQuery<PageResultats>({
    queryKey: ["etudes-prix", projetId ?? "global", recherche, filtreStatut, page],
    queryFn: () => api.get<PageResultats>(`/api/economie/etudes-de-prix/?${params.toString()}`),
  });

  const etudes = data?.results ?? [];
  const lienCreation = projetId
    ? `/economie/etudes-de-prix/nouvelle?projet=${projetId}`
    : "/economie/etudes-de-prix/nouvelle";

  return (
    <div className="carte space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-1 min-w-60 flex-wrap gap-3">
          <div className="relative flex-1 min-w-52">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="Rechercher par code, intitulé ou lot…"
              className="champ-saisie pl-8 w-full"
              value={recherche}
              onChange={(e) => {
                setRecherche(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <select
            className="champ-saisie w-auto min-w-40"
            value={filtreStatut}
            onChange={(e) => {
              setFiltreStatut(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Tous les statuts</option>
            {Object.entries(LIBELLES_STATUT).map(([valeur, libelle]) => (
              <option key={valeur} value={valeur}>
                {libelle}
              </option>
            ))}
          </select>
        </div>
        <Link href={lienCreation} className="btn-primaire text-xs flex items-center gap-1">
          <PlusCircle size={14} />
          Nouvelle étude de prix
        </Link>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-slate-400 text-sm">Chargement…</div>
      ) : isError ? (
        <div className="py-12 text-center text-red-500 text-sm">Erreur lors du chargement.</div>
      ) : etudes.length === 0 ? (
        <div className="py-12 text-center text-slate-400 text-sm">
          {recherche || filtreStatut
            ? "Aucune étude de prix ne correspond aux filtres."
            : projetId
              ? "Aucune étude de prix analytique pour ce projet."
              : "Aucune étude de prix analytique."}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs text-slate-500">
                {!projetId && <th className="text-left py-2 pr-4 font-medium">Projet</th>}
                <th className="text-left py-2 pr-4 font-medium">Étude</th>
                <th className="text-left py-2 pr-4 font-medium">Méthode</th>
                <th className="text-left py-2 pr-4 font-medium">Statut</th>
                <th className="text-right py-2 pr-4 font-medium">Déboursé sec</th>
                <th className="text-right py-2 font-medium">Modifié</th>
              </tr>
            </thead>
            <tbody>
              {etudes.map((etude) => (
                <tr key={etude.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  {!projetId && (
                    <td className="py-3 pr-4">
                      {etude.projet ? (
                        <Link
                          href={`/projets/${etude.projet}`}
                          className="font-mono text-xs text-primaire-700 hover:underline"
                        >
                          {etude.projet_reference || "Projet"}
                        </Link>
                      ) : (
                        <span className="text-xs text-slate-400">Sans projet</span>
                      )}
                    </td>
                  )}
                  <td className="py-3 pr-4">
                    <Link
                      href={`/economie/etudes-de-prix/${etude.id}`}
                      className="font-medium text-slate-800 hover:text-primaire-700 transition-colors"
                    >
                      {etude.intitule}
                    </Link>
                    <div className="flex flex-wrap items-center gap-2 mt-0.5">
                      {etude.code && <span className="font-mono text-xs text-slate-400">{etude.code}</span>}
                      {etude.lot_libelle && <span className="badge-neutre text-xs">{etude.lot_libelle}</span>}
                      {etude.organisation_nom && (
                        <span className="text-xs text-slate-500">{etude.organisation_nom}</span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    <span className="badge-neutre">{etude.methode_libelle}</span>
                  </td>
                  <td className="py-3 pr-4">
                    <span className={clsx(STYLES_STATUT[etude.statut] || "badge-neutre")}>
                      {etude.statut_libelle || LIBELLES_STATUT[etude.statut] || etude.statut}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-right font-mono text-xs text-slate-700">
                    {formaterMontant(etude.debourse_sec_ht)}
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

      {data && data.count > 20 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-slate-400">
            {data.count} étude{data.count > 1 ? "s" : ""}
          </p>
          <div className="flex gap-2">
            <button
              className="btn-secondaire py-1 px-3 text-xs"
              disabled={page === 1}
              onClick={() => setPage((courante) => Math.max(1, courante - 1))}
            >
              ← Précédent
            </button>
            <button
              className="btn-secondaire py-1 px-3 text-xs"
              disabled={!data.next}
              onClick={() => setPage((courante) => courante + 1)}
            >
              Suivant →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
