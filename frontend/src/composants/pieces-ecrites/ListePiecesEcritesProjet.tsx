"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { api, ErreurApi } from "@/crochets/useApi";
import { useSessionStore } from "@/crochets/useSession";
import { BoutonActionRapide, GroupeActionsRapides, LienActionRapide } from "@/composants/ui/ActionsRapides";
import { FileText, Download, Eye, Pencil, Trash2, CheckCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

interface PieceEcrite {
  id: string;
  intitule: string;
  modele: string;
  modele_libelle: string;
  modele_type_document?: string | null;
  statut: string;
  statut_libelle: string;
  date_modification: string;
}

interface PageResultats {
  results: PieceEcrite[];
}

const STYLES_STATUT: Record<string, string> = {
  brouillon: "badge-neutre",
  en_cours: "badge-info",
  valide: "badge-succes",
  archive: "badge-neutre",
};

const TYPES_TABLEUR = new Set(["bpu", "dpgf", "dqe"]);

export function ListePiecesEcritesProjet({ projetId }: { projetId: string }) {
  const queryClient = useQueryClient();
  const utilisateur = useSessionStore((etat) => etat.utilisateur);
  const estSuperAdmin = Boolean(utilisateur?.est_super_admin);
  const [exportEnCours, setExportEnCours] = useState<string | null>(null);
  const [suppressionId, setSuppressionId] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery<PageResultats>({
    queryKey: ["pieces-ecrites-projet", projetId],
    queryFn: () =>
      api.get<PageResultats>(`/api/pieces-ecrites/?projet=${projetId}&ordering=-date_modification`),
  });

  const { mutate: valider, variables: validationEnCours } = useMutation({
    mutationFn: (id: string) => api.post(`/api/pieces-ecrites/${id}/valider/`, {}),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["pieces-ecrites-projet", projetId] }),
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
      queryClient.invalidateQueries({ queryKey: ["pieces-ecrites-projet", projetId] });
    } catch (error) {
      setErreur(error instanceof ErreurApi ? error.detail : "Impossible de supprimer la pièce écrite.");
    } finally {
      setSuppressionId(null);
    }
  };

  const exporter = async (pieceId: string, format: "docx" | "xlsx" | "pdf", intitule: string) => {
    setExportEnCours(`${pieceId}:${format}`);
    try {
      const reponse = await api.telecharger(`/api/pieces-ecrites/${pieceId}/export/${format}/`);
      const url = window.URL.createObjectURL(reponse.blob);
      const lien = document.createElement("a");
      lien.href = url;
      lien.download = reponse.nomFichier || `${intitule}.${format}`;
      document.body.appendChild(lien);
      lien.click();
      lien.remove();
      window.URL.revokeObjectURL(url);
      queryClient.invalidateQueries({ queryKey: ["pieces-ecrites-projet", projetId] });
    } catch (error) {
      const detail = error instanceof ErreurApi ? error.detail : `Impossible d'exporter en ${format.toUpperCase()}.`;
      window.alert(detail);
    } finally {
      setExportEnCours(null);
    }
  };

  if (isLoading)
    return <div className="carte py-12 text-center text-slate-400 text-sm">Chargement…</div>;
  if (isError)
    return <div className="carte py-12 text-center text-red-500 text-sm">Erreur lors du chargement.</div>;

  if (pieces.length === 0) {
    return (
      <div className="carte py-12 text-center text-slate-400">
        <FileText size={32} className="mx-auto mb-3 opacity-30" />
        <p className="text-sm mb-4">Aucune pièce écrite pour ce projet.</p>
        <Link
          href={`/projets/${projetId}/pieces-ecrites/nouvelle`}
          className="btn-primaire text-xs"
        >
          Créer la première pièce
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
            <th className="text-left py-2 pr-4 font-medium">Modèle</th>
            <th className="text-left py-2 pr-4 font-medium">Statut</th>
            <th className="text-right py-2 pr-4 font-medium">Modifié</th>
            <th className="text-right py-2 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {pieces.map((p) => (
            <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
              <td className="py-3 pr-4 font-medium">
                <Link href={`/projets/${projetId}/pieces-ecrites/${p.id}`} className="hover:text-primaire-600 transition-colors">
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
                    href={`/projets/${projetId}/pieces-ecrites/${p.id}`}
                    titre="Ouvrir la pièce écrite"
                    icone={Eye}
                  />
                  <LienActionRapide
                    href={`/projets/${projetId}/pieces-ecrites/${p.id}`}
                    titre="Modifier la pièce écrite"
                    icone={Pencil}
                    variante="primaire"
                  />
                  <BoutonActionRapide
                    titre={TYPES_TABLEUR.has(p.modele_type_document || "") ? "Exporter en XLSX" : "Exporter en DOCX"}
                    icone={Download}
                    onClick={() => exporter(p.id, TYPES_TABLEUR.has(p.modele_type_document || "") ? "xlsx" : "docx", p.intitule)}
                    disabled={exportEnCours !== null}
                  />
                  <BoutonActionRapide
                    titre="Exporter en PDF"
                    icone={Download}
                    onClick={() => exporter(p.id, "pdf", p.intitule)}
                    disabled={exportEnCours !== null}
                  />
                  {p.statut !== "valide" && (
                    <BoutonActionRapide
                      titre={validationEnCours === p.id ? "Validation en cours" : "Valider la pièce écrite"}
                      icone={CheckCircle}
                      variante="primaire"
                      disabled={validationEnCours === p.id}
                      onClick={() => valider(p.id)}
                    />
                  )}
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
  );
}
