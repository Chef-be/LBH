"use client";

import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { api, ErreurApi } from "@/crochets/useApi";
import { BoutonActionRapide, GroupeActionsRapides, LienActionRapide } from "@/composants/ui/ActionsRapides";
import { CheckCircle, Eye, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";

interface Metre {
  id: string;
  intitule: string;
  type_metre: string;
  type_libelle: string;
  statut: string;
  statut_libelle: string;
  date_modification: string;
}

interface PageResultats {
  results: Metre[];
}

const STYLES_STATUT: Record<string, string> = {
  en_cours: "badge-info",
  valide: "badge-succes",
  archive: "badge-neutre",
};

export function ListeMetresProjet({ projetId }: { projetId: string }) {
  const queryClient = useQueryClient();
  const [actionId, setActionId] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery<PageResultats>({
    queryKey: ["metres-projet", projetId],
    queryFn: () => api.get<PageResultats>(`/api/metres/?projet=${projetId}&ordering=-date_modification`),
  });

  const { mutate: valider, variables: validationEnCours } = useMutation({
    mutationFn: (id: string) => api.post(`/api/metres/${id}/valider/`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["metres-projet", projetId] }),
  });

  const metres = data?.results ?? [];

  const supprimerMetre = async (metre: Metre) => {
    const confirmation = window.confirm(`Supprimer le métré « ${metre.intitule} » ?`);
    if (!confirmation) return;

    setActionId(metre.id);
    setErreur(null);
    try {
      await api.supprimer(`/api/metres/${metre.id}/`);
      queryClient.invalidateQueries({ queryKey: ["metres-projet", projetId] });
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Impossible de supprimer le métré.");
    } finally {
      setActionId(null);
    }
  };

  if (isLoading) return <div className="carte py-12 text-center text-slate-400 text-sm">Chargement…</div>;
  if (isError) return <div className="carte py-12 text-center text-red-500 text-sm">Erreur lors du chargement.</div>;

  if (metres.length === 0) {
    return (
      <div className="carte py-12 text-center text-slate-400">
        <p className="text-sm mb-4">Aucun métré pour ce projet.</p>
        <Link href={`/projets/${projetId}/metres/nouveau`} className="btn-primaire text-xs">
          Créer le premier métré
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
            <th className="text-left py-2 pr-4 font-medium">Intitulé</th>
            <th className="text-left py-2 pr-4 font-medium">Type</th>
            <th className="text-left py-2 pr-4 font-medium">Statut</th>
            <th className="text-right py-2 pr-4 font-medium">Modifié</th>
            <th className="text-right py-2 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {metres.map((m) => (
            <tr key={m.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
              <td className="py-3 pr-4 font-medium">
                <Link href={`/projets/${projetId}/metres/${m.id}`} className="hover:text-primaire-600 transition-colors">
                  {m.intitule}
                </Link>
              </td>
              <td className="py-3 pr-4 text-xs text-slate-500">{m.type_libelle}</td>
              <td className="py-3 pr-4">
                <span className={clsx(STYLES_STATUT[m.statut] || "badge-neutre")}>
                  {m.statut_libelle}
                </span>
              </td>
              <td className="py-3 pr-4 text-right text-xs text-slate-400">
                {new Date(m.date_modification).toLocaleDateString("fr-FR")}
              </td>
              <td className="py-3 text-right">
                <GroupeActionsRapides>
                  <LienActionRapide
                    href={`/projets/${projetId}/metres/${m.id}`}
                    titre="Ouvrir le métré"
                    icone={Eye}
                  />
                  <LienActionRapide
                    href={`/projets/${projetId}/metres/${m.id}`}
                    titre="Modifier le métré"
                    icone={Pencil}
                    variante="primaire"
                  />
                  {m.statut !== "valide" && (
                    <BoutonActionRapide
                      titre={validationEnCours === m.id ? "Validation en cours" : "Valider le métré"}
                      icone={CheckCircle}
                      variante="primaire"
                      disabled={validationEnCours === m.id}
                      onClick={() => valider(m.id)}
                    />
                  )}
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
  );
}
