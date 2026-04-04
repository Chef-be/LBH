"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { clsx } from "clsx";
import { api, ErreurApi } from "@/crochets/useApi";
import { BoutonActionRapide, GroupeActionsRapides, LienActionRapide } from "@/composants/ui/ActionsRapides";
import { Calculator, Eye, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";

interface EtudeBatiment {
  id: string;
  intitule: string;
  type_batiment_libelle: string;
  type_operation_libelle: string;
  shon_totale: number | null;
  cout_estime_ht: number | null;
  cout_par_m2_shon_ht: number | null;
  date_modification: string;
}

interface PageResultats {
  results: EtudeBatiment[];
}

function formaterMontant(val: number | null) {
  if (val == null) return "—";
  return `${Number(val).toLocaleString("fr-FR", { minimumFractionDigits: 0 })} €`;
}

export function ListeEtudesBatimentProjet({ projetId }: { projetId: string }) {
  const queryClient = useQueryClient();
  const [actionId, setActionId] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery<PageResultats>({
    queryKey: ["etudes-batiment-projet", projetId],
    queryFn: () => api.get<PageResultats>(`/api/batiment/?projet=${projetId}&ordering=-date_modification`),
  });

  const { mutate: calculer, variables: calculsEnCours } = useMutation({
    mutationFn: (id: string) => api.post(`/api/batiment/${id}/calculer/`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["etudes-batiment-projet", projetId] }),
  });

  const etudes = data?.results ?? [];

  const supprimerProgramme = async (etude: EtudeBatiment) => {
    const confirmation = window.confirm(`Supprimer le programme bâtiment « ${etude.intitule} » ?`);
    if (!confirmation) return;

    setActionId(etude.id);
    setErreur(null);
    try {
      await api.supprimer(`/api/batiment/${etude.id}/`);
      queryClient.invalidateQueries({ queryKey: ["etudes-batiment-projet", projetId] });
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Impossible de supprimer le programme bâtiment.");
    } finally {
      setActionId(null);
    }
  };

  if (isLoading) return <div className="carte py-12 text-center text-slate-400 text-sm">Chargement…</div>;
  if (isError) return <div className="carte py-12 text-center text-red-500 text-sm">Erreur lors du chargement.</div>;

  if (etudes.length === 0) {
    return (
      <div className="carte py-12 text-center text-slate-400">
        <p className="text-sm mb-4">Aucun programme bâtiment pour ce projet.</p>
        <Link href={`/projets/${projetId}/batiment/nouvelle`} className="btn-primaire text-xs">
          Créer le premier programme
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
            <th className="text-left py-2 pr-4 font-medium">Type / Opération</th>
            <th className="text-right py-2 pr-4 font-medium">SHON (m²)</th>
            <th className="text-right py-2 pr-4 font-medium">Coût estimé HT</th>
            <th className="text-right py-2 pr-4 font-medium">€/m² SHON</th>
            <th className="text-right py-2 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {etudes.map((etude) => (
            <tr key={etude.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
              <td className="py-3 pr-4 font-medium">
                <Link href={`/projets/${projetId}/batiment/${etude.id}`} className="hover:text-primaire-700">
                  {etude.intitule}
                </Link>
              </td>
              <td className="py-3 pr-4 text-xs text-slate-500">
                <p>{etude.type_batiment_libelle}</p>
                <p className="text-slate-400">{etude.type_operation_libelle}</p>
              </td>
              <td className="py-3 pr-4 text-right font-mono text-xs">
                {etude.shon_totale != null ? Number(etude.shon_totale).toLocaleString("fr-FR") : "—"}
              </td>
              <td className="py-3 pr-4 text-right font-mono text-xs font-medium text-primaire-700">
                {formaterMontant(etude.cout_estime_ht)}
              </td>
              <td className="py-3 pr-4 text-right font-mono text-xs">
                {formaterMontant(etude.cout_par_m2_shon_ht)}
              </td>
              <td className="py-3 text-right">
                <GroupeActionsRapides>
                  <LienActionRapide
                    href={`/projets/${projetId}/batiment/${etude.id}`}
                    titre="Ouvrir le programme bâtiment"
                    icone={Eye}
                  />
                  <LienActionRapide
                    href={`/projets/${projetId}/batiment/${etude.id}`}
                    titre="Modifier le programme bâtiment"
                    icone={Pencil}
                    variante="primaire"
                  />
                  <BoutonActionRapide
                    titre={calculsEnCours === etude.id ? "Calcul en cours" : "Calculer le programme bâtiment"}
                    icone={Calculator}
                    variante="primaire"
                    disabled={calculsEnCours === etude.id}
                    onClick={() => calculer(etude.id)}
                  />
                  <BoutonActionRapide
                    titre="Supprimer le programme bâtiment"
                    icone={Trash2}
                    variante="danger"
                    disabled={actionId === etude.id}
                    onClick={() => supprimerProgramme(etude)}
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
