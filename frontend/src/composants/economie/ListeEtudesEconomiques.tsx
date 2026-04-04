"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { clsx } from "clsx";
import { api } from "@/crochets/useApi";
import { PlusCircle, TrendingUp, TrendingDown, Minus } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EtudeEconomique {
  id: string;
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
  results: EtudeEconomique[];
}

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Composant
// ---------------------------------------------------------------------------

function IconeMarge({ taux }: { taux: number | null }) {
  if (taux == null) return <Minus size={14} className="text-slate-300" />;
  if (taux >= 0.08) return <TrendingUp size={14} className="text-green-500" />;
  if (taux >= 0.03) return <Minus size={14} className="text-yellow-500" />;
  return <TrendingDown size={14} className="text-red-500" />;
}

export function ListeEtudesEconomiques({ projetId }: { projetId: string }) {
  const [filtreStatut, setFiltreStatut] = useState("");

  const params = new URLSearchParams({ projet: projetId, ordering: "-date_modification" });
  if (filtreStatut) params.set("statut", filtreStatut);

  const { data, isLoading, isError } = useQuery<PageResultats>({
    queryKey: ["etudes-economiques", projetId, filtreStatut],
    queryFn: () => api.get<PageResultats>(`/api/economie/?${params.toString()}`),
  });

  const etudes = data?.results ?? [];

  return (
    <div className="space-y-4">
      {/* Barre d'actions */}
      <div className="flex items-center justify-between gap-4">
        <select
          className="champ-saisie w-auto text-sm"
          value={filtreStatut}
          onChange={(e) => setFiltreStatut(e.target.value)}
        >
          <option value="">Tous les statuts</option>
          {Object.entries(LIBELLES_STATUT).map(([val, lib]) => (
            <option key={val} value={val}>{lib}</option>
          ))}
        </select>
        <Link
          href={`/projets/${projetId}/economie/nouvelle`}
          className="btn-primaire text-xs flex items-center gap-1"
        >
          <PlusCircle size={14} /> Nouvelle étude
        </Link>
      </div>

      {/* Contenu */}
      {isLoading ? (
        <div className="carte py-12 text-center text-slate-400 text-sm">Chargement…</div>
      ) : isError ? (
        <div className="carte py-12 text-center text-red-500 text-sm">Erreur lors du chargement.</div>
      ) : etudes.length === 0 ? (
        <div className="carte py-12 text-center">
          <p className="text-slate-400 text-sm mb-4">
            {filtreStatut ? "Aucune étude ne correspond au filtre." : "Aucune étude économique pour ce projet."}
          </p>
          {!filtreStatut && (
            <Link href={`/projets/${projetId}/economie/nouvelle`} className="btn-primaire text-xs">
              Créer la première étude
            </Link>
          )}
        </div>
      ) : (
        <div className="carte overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left py-2 pr-4 font-medium text-slate-500">Intitulé</th>
                <th className="text-left py-2 pr-4 font-medium text-slate-500">Statut</th>
                <th className="text-left py-2 pr-4 font-medium text-slate-500">Version</th>
                <th className="text-right py-2 pr-4 font-medium text-slate-500">Total PV HT</th>
                <th className="text-right py-2 pr-4 font-medium text-slate-500">Taux marge</th>
                <th className="text-right py-2 font-medium text-slate-500">Modifié</th>
              </tr>
            </thead>
            <tbody>
              {etudes.map((etude) => (
                <tr
                  key={etude.id}
                  className="border-b border-slate-50 hover:bg-slate-50 transition-colors"
                >
                  <td className="py-3 pr-4">
                    <Link
                      href={`/projets/${projetId}/economie/${etude.id}`}
                      className="font-medium text-primaire-700 hover:underline"
                    >
                      {etude.intitule}
                    </Link>
                    {etude.est_variante && (
                      <span className="ml-2 badge-neutre text-xs">variante</span>
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    <span className={clsx(STYLES_STATUT[etude.statut] || "badge-neutre")}>
                      {LIBELLES_STATUT[etude.statut] || etude.statut}
                    </span>
                  </td>
                  <td className="py-3 pr-4 font-mono text-xs text-slate-500">v{etude.version}</td>
                  <td className="py-3 pr-4 text-right font-mono text-slate-700 text-xs">
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
    </div>
  );
}
