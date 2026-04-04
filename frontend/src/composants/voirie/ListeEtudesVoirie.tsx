"use client";

import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ErreurApi } from "@/crochets/useApi";
import { BoutonActionRapide, GroupeActionsRapides, LienActionRapide } from "@/composants/ui/ActionsRapides";
import { Search, Eye, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";

interface EtudeVoirie {
  id: string;
  intitule: string;
  projet_reference: string;
  projet: string;
  type_voie: string;
  type_voie_libelle: string;
  tmja_pl: number | null;
  calcul_conforme: boolean | null;
  date_modification: string;
}

interface PageResultats {
  count: number;
  next: string | null;
  results: EtudeVoirie[];
}

export function ListeEtudesVoirie() {
  const queryClient = useQueryClient();
  const [recherche, setRecherche] = useState("");
  const [page, setPage] = useState(1);
  const [actionId, setActionId] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);

  const params = new URLSearchParams({ ordering: "-date_modification", page: String(page) });
  if (recherche) params.set("search", recherche);

  const { data, isLoading, isError } = useQuery<PageResultats>({
    queryKey: ["etudes-voirie", recherche, page],
    queryFn: () => api.get<PageResultats>(`/api/voirie/?${params.toString()}`),
  });

  const etudes = data?.results ?? [];

  const supprimerEtude = async (etude: EtudeVoirie) => {
    const confirmation = window.confirm(`Supprimer l'étude de voirie « ${etude.intitule} » ?`);
    if (!confirmation) return;

    setActionId(etude.id);
    setErreur(null);
    try {
      await api.supprimer(`/api/voirie/${etude.id}/`);
      setSucces(`Étude de voirie « ${etude.intitule} » supprimée.`);
      queryClient.invalidateQueries({ queryKey: ["etudes-voirie"] });
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Impossible de supprimer l'étude de voirie.");
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="carte space-y-4">
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            placeholder="Rechercher…"
            className="champ-saisie pl-8"
            value={recherche}
            onChange={(e) => { setRecherche(e.target.value); setPage(1); }}
          />
        </div>
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
      ) : etudes.length === 0 ? (
        <div className="py-12 text-center text-slate-400 text-sm">
          <p>Aucune étude de voirie.</p>
          <p className="mt-2 text-xs">Créez des études depuis la fiche d&apos;un projet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs text-slate-500">
                <th className="text-left py-2 pr-4 font-medium">Projet</th>
                <th className="text-left py-2 pr-4 font-medium">Intitulé</th>
                <th className="text-right py-2 pr-4 font-medium">TMJA PL/j</th>
                <th className="text-left py-2 pr-4 font-medium">Type de voie</th>
                <th className="text-right py-2 pr-4 font-medium">Modifié</th>
                <th className="text-right py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {etudes.map((etude) => (
                <tr key={etude.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <td className="py-3 pr-4">
                    <Link href={`/projets/${etude.projet}`} className="font-mono text-xs text-primaire-700 hover:underline">
                      {etude.projet_reference}
                    </Link>
                  </td>
                  <td className="py-3 pr-4 font-medium">
                    <Link href={`/projets/${etude.projet}/voirie/${etude.id}`} className="hover:text-primaire-600 transition-colors">
                      {etude.intitule}
                    </Link>
                  </td>
                  <td className="py-3 pr-4 text-right font-mono text-xs">
                    {etude.tmja_pl != null ? etude.tmja_pl.toLocaleString("fr-FR") : "—"}
                  </td>
                  <td className="py-3 pr-4 text-xs text-slate-500">{etude.type_voie_libelle || "—"}</td>
                  <td className="py-3 pr-4 text-right text-xs text-slate-400">
                    {new Date(etude.date_modification).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="py-3 text-right">
                    <GroupeActionsRapides>
                      <LienActionRapide
                        href={`/projets/${etude.projet}/voirie/${etude.id}`}
                        titre="Ouvrir l'étude de voirie"
                        icone={Eye}
                      />
                      <LienActionRapide
                        href={`/projets/${etude.projet}/voirie/${etude.id}`}
                        titre="Modifier l'étude de voirie"
                        icone={Pencil}
                        variante="primaire"
                      />
                      <BoutonActionRapide
                        titre="Supprimer l'étude de voirie"
                        icone={Trash2}
                        variante="danger"
                        disabled={actionId === etude.id}
                        onClick={() => supprimerEtude(etude)}
                      />
                    </GroupeActionsRapides>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && data.count > 20 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-slate-400">{data.count} étude{data.count > 1 ? "s" : ""}</p>
          <div className="flex gap-2">
            <button className="btn-secondaire py-1 px-3 text-xs" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>← Précédent</button>
            <button className="btn-secondaire py-1 px-3 text-xs" disabled={!data.next} onClick={() => setPage((p) => p + 1)}>Suivant →</button>
          </div>
        </div>
      )}
    </div>
  );
}
