"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { clsx } from "clsx";
import { api, ErreurApi } from "@/crochets/useApi";
import { useSessionStore } from "@/crochets/useSession";
import { useNotifications } from "@/contextes/FournisseurNotifications";
import { BoutonActionRapide, GroupeActionsRapides, LienActionRapide } from "@/composants/ui/ActionsRapides";
import { ModalConfirmation } from "@/composants/ui/ModalConfirmation";
import { Search, SlidersHorizontal, Eye, Pencil, Trash2 } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Projet {
  id: string;
  reference: string;
  intitule: string;
  statut: string;
  type_projet: string;
  type_libelle?: string;
  organisation_nom: string | null;
  responsable_nom: string;
  commune: string;
  montant_estime: number | null;
  date_modification: string;
}

interface PageResultats {
  count: number;
  next: string | null;
  previous: string | null;
  results: Projet[];
}

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

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

const LIBELLES_TYPE: Record<string, string> = {
  etude: "Étude",
  travaux: "Travaux",
  mission_moe: "MOE",
  assistance: "AMO",
  expertise: "Expertise",
  autre: "Autre",
};

// ---------------------------------------------------------------------------
// Composant
// ---------------------------------------------------------------------------

export function ListeProjets() {
  const queryClient = useQueryClient();
  const notifications = useNotifications();
  const utilisateur = useSessionStore((etat) => etat.utilisateur);
  const estSuperAdmin = Boolean(utilisateur?.est_super_admin);
  const [recherche, setRecherche] = useState("");
  const [filtreStatut, setFiltreStatut] = useState("");
  const [page, setPage] = useState(1);
  const [suppressionId, setSuppressionId] = useState<string | null>(null);
  const [projetASupprimer, setProjetASupprimer] = useState<Projet | null>(null);

  const params = new URLSearchParams();
  if (recherche) params.set("search", recherche);
  if (filtreStatut) params.set("statut", filtreStatut);
  params.set("ordering", "-date_modification");
  params.set("page", String(page));

  const { data, isLoading, isError } = useQuery<PageResultats>({
    queryKey: ["projets", recherche, filtreStatut, page],
    queryFn: () => api.get<PageResultats>(`/api/projets/?${params.toString()}`),
  });

  const projets = data?.results ?? [];

  const confirmerSuppressionProjet = async () => {
    if (!projetASupprimer) return;
    setSuppressionId(projetASupprimer.id);
    try {
      await api.supprimer(`/api/projets/${projetASupprimer.id}/`);
      notifications.succes(`Projet ${projetASupprimer.reference} supprimé.`);
      queryClient.invalidateQueries({ queryKey: ["projets"] });
    } catch (e) {
      notifications.erreur(e instanceof ErreurApi ? e.detail : "Impossible de supprimer le projet.");
    } finally {
      setProjetASupprimer(null);
      setSuppressionId(null);
    }
  };

  return (
    <div className="carte space-y-4">
      {/* Barre de filtres */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            placeholder="Rechercher par référence, intitulé…"
            className="champ-saisie pl-8"
            value={recherche}
            onChange={(e) => { setRecherche(e.target.value); setPage(1); }}
          />
        </div>
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={14} className="text-slate-400" />
          <select
            className="champ-saisie w-auto"
            value={filtreStatut}
            onChange={(e) => { setFiltreStatut(e.target.value); setPage(1); }}
          >
            <option value="">Tous les statuts</option>
            {Object.entries(LIBELLES_STATUT).map(([val, lib]) => (
              <option key={val} value={val}>{lib}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tableau */}
      {isLoading ? (
        <div className="py-12 text-center text-slate-400 text-sm">Chargement…</div>
      ) : isError ? (
        <div className="py-12 text-center text-red-500 text-sm">Erreur lors du chargement des projets.</div>
      ) : projets.length === 0 ? (
        <div className="py-12 text-center text-slate-400 text-sm">
          {recherche || filtreStatut ? "Aucun projet ne correspond aux filtres." : "Aucun projet pour le moment."}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left py-2 pr-4 font-medium text-slate-500">Référence</th>
                <th className="text-left py-2 pr-4 font-medium text-slate-500">Intitulé</th>
                <th className="text-left py-2 pr-4 font-medium text-slate-500">Type</th>
                <th className="text-left py-2 pr-4 font-medium text-slate-500">Statut</th>
                <th className="text-left py-2 pr-4 font-medium text-slate-500">Responsable</th>
                <th className="text-right py-2 pr-4 font-medium text-slate-500">Montant estimé</th>
                <th className="text-right py-2 font-medium text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {projets.map((projet) => (
                <tr key={projet.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <td className="py-3 pr-4">
                    <Link
                      href={`/projets/${projet.id}`}
                      className="font-mono text-primaire-700 hover:underline font-medium"
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
                    {projet.commune && (
                      <p className="text-xs text-slate-400 mt-0.5">{projet.commune}</p>
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    <span className="badge-neutre">
                      {projet.type_libelle || LIBELLES_TYPE[projet.type_projet] || projet.type_projet}
                    </span>
                  </td>
                  <td className="py-3 pr-4">
                    <span className={clsx(STYLES_STATUT[projet.statut] || "badge-neutre")}>
                      {LIBELLES_STATUT[projet.statut] || projet.statut}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-slate-600 text-xs">{projet.responsable_nom}</td>
                  <td className="py-3 pr-4 text-right font-mono text-slate-700 text-xs">
                    {projet.montant_estime
                      ? `${Number(projet.montant_estime).toLocaleString("fr-FR")} €`
                      : "—"}
                  </td>
                  <td className="py-3 text-right">
                    <GroupeActionsRapides>
                      <LienActionRapide
                        href={`/projets/${projet.id}`}
                        titre="Ouvrir le projet"
                        icone={Eye}
                      />
                      <LienActionRapide
                        href={`/projets/${projet.id}/modifier`}
                        titre="Modifier le projet"
                        icone={Pencil}
                        variante="primaire"
                      />
                      {estSuperAdmin && (
                        <BoutonActionRapide
                          titre="Supprimer le projet"
                          icone={Trash2}
                          variante="danger"
                          disabled={suppressionId === projet.id}
                          onClick={() => setProjetASupprimer(projet)}
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

      {/* Pagination */}
      {data && data.count > 20 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-slate-400">
            {data.count} projet{data.count > 1 ? "s" : ""}
          </p>
          <div className="flex gap-2">
            <button
              className="btn-secondaire py-1 px-3 text-xs"
              disabled={!data.previous}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ← Précédent
            </button>
            <button
              className="btn-secondaire py-1 px-3 text-xs"
              disabled={!data.next}
              onClick={() => setPage((p) => p + 1)}
            >
              Suivant →
            </button>
          </div>
        </div>
      )}

      <ModalConfirmation
        ouverte={Boolean(projetASupprimer)}
        titre="Supprimer le projet"
        message={
          projetASupprimer
            ? `Supprimer définitivement le projet ${projetASupprimer.reference} et ses éléments liés ? Cette action est irréversible.`
            : ""
        }
        libelleBoutonConfirmer="Supprimer"
        variante="danger"
        chargement={Boolean(projetASupprimer && suppressionId === projetASupprimer.id)}
        onAnnuler={() => setProjetASupprimer(null)}
        onConfirmer={confirmerSuppressionProjet}
      />
    </div>
  );
}
