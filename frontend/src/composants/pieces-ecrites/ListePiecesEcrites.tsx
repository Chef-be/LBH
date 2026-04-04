"use client";

import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { api, ErreurApi } from "@/crochets/useApi";
import { useSessionStore } from "@/crochets/useSession";
import { BoutonActionRapide, GroupeActionsRapides, LienActionRapide } from "@/composants/ui/ActionsRapides";
import { Search, Eye, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";

interface PieceEcrite {
  id: string;
  intitule: string;
  modele: string;
  modele_libelle: string;
  projet_reference: string;
  projet: string;
  statut: string;
  statut_libelle: string;
  date_modification: string;
}

interface PageResultats {
  count: number;
  next: string | null;
  results: PieceEcrite[];
}

const STYLES_STATUT: Record<string, string> = {
  brouillon: "badge-neutre",
  en_cours: "badge-info",
  valide: "badge-succes",
  archive: "badge-neutre",
};

export function ListePiecesEcrites() {
  const queryClient = useQueryClient();
  const utilisateur = useSessionStore((etat) => etat.utilisateur);
  const estSuperAdmin = Boolean(utilisateur?.est_super_admin);
  const [recherche, setRecherche] = useState("");
  const [page, setPage] = useState(1);
  const [suppressionId, setSuppressionId] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const params = new URLSearchParams({ ordering: "-date_modification", page: String(page) });
  if (recherche) params.set("search", recherche);

  const { data, isLoading, isError } = useQuery<PageResultats>({
    queryKey: ["pieces-ecrites", recherche, page],
    queryFn: () => api.get<PageResultats>(`/api/pieces-ecrites/?${params.toString()}`),
  });

  const pieces = data?.results ?? [];

  const supprimerPiece = async (piece: PieceEcrite) => {
    const confirmation = window.confirm(
      `Supprimer définitivement la pièce écrite « ${piece.intitule} » ? Cette action est irréversible.`
    );
    if (!confirmation) return;

    setSuppressionId(piece.id);
    setErreur(null);
    try {
      await api.supprimer(`/api/pieces-ecrites/${piece.id}/`);
      setSucces(`Pièce écrite « ${piece.intitule} » supprimée.`);
      queryClient.invalidateQueries({ queryKey: ["pieces-ecrites"] });
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Impossible de supprimer la pièce écrite.");
    } finally {
      setSuppressionId(null);
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
      ) : pieces.length === 0 ? (
        <div className="py-12 text-center text-slate-400 text-sm">Aucune pièce écrite.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs text-slate-500">
                <th className="text-left py-2 pr-4 font-medium">Projet</th>
                <th className="text-left py-2 pr-4 font-medium">Intitulé</th>
                <th className="text-left py-2 pr-4 font-medium">Modèle</th>
                <th className="text-left py-2 pr-4 font-medium">Statut</th>
                <th className="text-right py-2 pr-4 font-medium">Modifié</th>
                <th className="text-right py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pieces.map((p) => (
                <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <td className="py-3 pr-4">
                    <Link href={`/projets/${p.projet}`} className="font-mono text-xs text-primaire-700 hover:underline">
                      {p.projet_reference}
                    </Link>
                  </td>
                  <td className="py-3 pr-4 font-medium">
                    <Link href={`/projets/${p.projet}/pieces-ecrites/${p.id}`} className="hover:text-primaire-600 transition-colors">
                      {p.intitule}
                    </Link>
                  </td>
                  <td className="py-3 pr-4">
                    <span className="badge-neutre">{p.modele_libelle || "—"}</span>
                  </td>
                  <td className="py-3 pr-4">
                    <span className={clsx(STYLES_STATUT[p.statut] || "badge-neutre")}>
                      {p.statut_libelle || p.statut}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-right text-xs text-slate-400">
                    {new Date(p.date_modification).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="py-3 text-right">
                    <GroupeActionsRapides>
                      <LienActionRapide
                        href={`/projets/${p.projet}/pieces-ecrites/${p.id}`}
                        titre="Ouvrir la pièce écrite"
                        icone={Eye}
                      />
                      <LienActionRapide
                        href={`/projets/${p.projet}/pieces-ecrites/${p.id}`}
                        titre="Modifier la pièce écrite"
                        icone={Pencil}
                        variante="primaire"
                      />
                      {estSuperAdmin && (
                        <BoutonActionRapide
                          titre="Supprimer la pièce écrite"
                          icone={Trash2}
                          variante="danger"
                          disabled={suppressionId === p.id}
                          onClick={() => supprimerPiece(p)}
                        />
                      )}
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
