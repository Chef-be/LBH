"use client";

import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { api, ErreurApi } from "@/crochets/useApi";
import { BoutonActionRapide, GroupeActionsRapides, LienActionRapide } from "@/composants/ui/ActionsRapides";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";

interface AppelOffres {
  id: string;
  intitule: string;
  type_libelle: string;
  statut: string;
  statut_libelle: string;
  nb_offres: number;
  nb_points_vigilance: number;
  date_limite_remise: string | null;
  montant_estime_ht: number | null;
  date_creation: string;
}

interface PageResultats {
  results: AppelOffres[];
}

const STYLES_STATUT: Record<string, string> = {
  preparation: "badge-neutre",
  publie: "badge-info",
  questions_reponses: "badge-info",
  clos: "badge-alerte",
  depouille: "badge-alerte",
  attribue: "badge-succes",
  infructueux: "badge-danger",
  abandonne: "badge-danger",
};

function formaterDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR");
}

function formaterMontant(val: number | null) {
  if (val == null) return "—";
  return `${Number(val).toLocaleString("fr-FR", { minimumFractionDigits: 0 })} €`;
}

export function ListeAppelsOffresProjet({ projetId }: { projetId: string }) {
  const queryClient = useQueryClient();
  const [actionId, setActionId] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery<PageResultats>({
    queryKey: ["appels-offres-projet", projetId],
    queryFn: () => api.get<PageResultats>(`/api/appels-offres/?projet=${projetId}&ordering=-date_creation`),
  });

  const aos = data?.results ?? [];

  const abandonnerAppelOffres = async (ao: AppelOffres) => {
    const confirmation = window.confirm(`Abandonner l'appel d'offres « ${ao.intitule} » ?`);
    if (!confirmation) return;

    setActionId(ao.id);
    setErreur(null);
    try {
      await api.supprimer(`/api/appels-offres/${ao.id}/`);
      queryClient.invalidateQueries({ queryKey: ["appels-offres-projet", projetId] });
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Impossible de mettre à jour l'appel d'offres.");
    } finally {
      setActionId(null);
    }
  };

  if (isLoading) return <div className="carte py-12 text-center text-slate-400 text-sm">Chargement…</div>;
  if (isError) return <div className="carte py-12 text-center text-red-500 text-sm">Erreur lors du chargement.</div>;

  if (aos.length === 0) {
    return (
      <div className="carte py-12 text-center text-slate-400">
        <p className="text-sm mb-4">Aucun appel d&apos;offres pour ce projet.</p>
        <Link href={`/projets/${projetId}/appels-offres/nouveau`} className="btn-primaire text-xs">
          Créer le premier appel d&apos;offres
        </Link>
      </div>
    );
  }

  return (
    <div className="carte overflow-x-auto">
      {erreur && (
        <div className="mx-4 mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {erreur}
        </div>
      )}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-xs text-slate-500">
            <th className="text-left py-2 pr-4 font-medium">Intitulé / Type</th>
            <th className="text-left py-2 pr-4 font-medium">Statut</th>
            <th className="text-center py-2 pr-4 font-medium">Offres</th>
            <th className="text-right py-2 pr-4 font-medium">Estimé HT</th>
            <th className="text-right py-2 pr-4 font-medium">Date remise</th>
            <th className="text-right py-2 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {aos.map((ao) => (
            <tr key={ao.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
              <td className="py-3 pr-4">
                <Link href={`/projets/${projetId}/appels-offres/${ao.id}`} className="font-medium hover:text-primaire-600 transition-colors block">
                  {ao.intitule}
                </Link>
                <p className="text-xs text-slate-400">
                  {ao.type_libelle}
                  {ao.nb_points_vigilance > 0 && ` • ${ao.nb_points_vigilance} vigilance${ao.nb_points_vigilance > 1 ? "s" : ""}`}
                </p>
              </td>
              <td className="py-3 pr-4">
                <span className={clsx(STYLES_STATUT[ao.statut] || "badge-neutre")}>
                  {ao.statut_libelle}
                </span>
              </td>
              <td className="py-3 pr-4 text-center font-mono text-xs">{ao.nb_offres}</td>
              <td className="py-3 pr-4 text-right font-mono text-xs">{formaterMontant(ao.montant_estime_ht)}</td>
              <td className="py-3 pr-4 text-right text-xs text-slate-500">
                {formaterDate(ao.date_limite_remise)}
              </td>
              <td className="py-3 text-right">
                <GroupeActionsRapides>
                  <LienActionRapide
                    href={`/projets/${projetId}/appels-offres/${ao.id}`}
                    titre="Ouvrir l'appel d'offres"
                    icone={Eye}
                  />
                  <LienActionRapide
                    href={`/projets/${projetId}/appels-offres/${ao.id}`}
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
  );
}
