"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { clsx } from "clsx";
import { api } from "@/crochets/useApi";

interface ProjetResume {
  id: string;
  reference: string;
  intitule: string;
  statut: string;
  organisation_nom: string | null;
  montant_estime: number | null;
  date_modification: string;
}

interface ReponsePaginee {
  results?: ProjetResume[];
}

const LIBELLES_STATUT: Record<string, string> = {
  prospection: "Prospection",
  en_cours: "En cours",
  suspendu: "Suspendu",
  termine: "Terminé",
  abandonne: "Abandonné",
  archive: "Archivé",
};

const STYLES_STATUT: Record<string, string> = {
  en_cours: "badge-info",
  termine: "badge-succes",
  suspendu: "badge-alerte",
  abandonne: "badge-danger",
  prospection: "badge-neutre",
  archive: "badge-neutre",
};

async function chargerProjetsRecents(): Promise<ProjetResume[]> {
  const donnees = await api.get<ReponsePaginee | ProjetResume[]>(
    "/api/projets/?ordering=-date_modification&page_size=10"
  );
  const liste = (donnees as ReponsePaginee).results ?? (donnees as ProjetResume[]);
  return liste.slice(0, 10);
}

export function ListeProjetsRecents() {
  const { data: projets = [], isLoading, isError } = useQuery({
    queryKey: ["projets-recents"],
    queryFn: chargerProjetsRecents,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-slate-400 text-sm">
        Chargement des projets…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center py-8 text-slate-400 text-sm">
        Impossible de charger les projets.
      </div>
    );
  }

  if (!projets.length) {
    return (
      <div className="text-center py-8 text-slate-400 text-sm">
        Aucun projet pour le moment.{" "}
        <Link href="/projets/nouveau" className="text-primaire-600 hover:underline">
          Créer un projet
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100">
            <th className="text-left py-2 pr-4 font-medium text-slate-500">Référence</th>
            <th className="text-left py-2 pr-4 font-medium text-slate-500">Intitulé</th>
            <th className="text-left py-2 pr-4 font-medium text-slate-500">Statut</th>
            <th className="text-right py-2 font-medium text-slate-500">Montant estimé</th>
          </tr>
        </thead>
        <tbody>
          {projets.map((projet) => (
            <tr key={projet.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
              <td className="py-3 pr-4">
                <Link
                  href={`/projets/${projet.id}`}
                  className="font-mono text-primaire-700 hover:underline"
                >
                  {projet.reference}
                </Link>
              </td>
              <td className="py-3 pr-4 max-w-xs">
                <Link
                  href={`/projets/${projet.id}`}
                  className="block truncate font-medium text-slate-800 transition-colors hover:text-primaire-600"
                >
                  {projet.intitule}
                </Link>
                {projet.organisation_nom && (
                  <p className="text-xs text-slate-400 mt-0.5">{projet.organisation_nom}</p>
                )}
              </td>
              <td className="py-3 pr-4">
                <span className={clsx(STYLES_STATUT[projet.statut] || "badge-neutre")}>
                  {LIBELLES_STATUT[projet.statut] || projet.statut}
                </span>
              </td>
              <td className="py-3 text-right font-mono text-slate-700">
                {projet.montant_estime
                  ? `${Number(projet.montant_estime).toLocaleString("fr-FR")} €`
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 text-right">
        <Link href="/projets" className="text-sm text-primaire-600 hover:underline">
          Voir tous les projets →
        </Link>
      </div>
    </div>
  );
}
