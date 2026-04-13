"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import Link from "next/link";
import { api, ErreurApi, extraireListeResultats } from "@/crochets/useApi";
import { useSessionStore } from "@/crochets/useSession";
import { BoutonActionRapide, GroupeActionsRapides, LienActionRapide } from "@/composants/ui/ActionsRapides";
import { ApercuFichierModal } from "@/composants/ui/ApercuFichierModal";
import { FileText, Filter, Eye, Pencil, Trash2 } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Document {
  id: string;
  reference: string;
  intitule: string;
  dossier: string | null;
  dossier_libelle: string | null;
  dossier_chemin?: string | null;
  type_libelle: string;
  statut: string;
  statut_libelle: string;
  version: string;
  est_version_courante: boolean;
  origine: string;
  fichier: string | null;
  nom_fichier_origine: string;
  taille_octets: number | null;
  type_mime: string;
  auteur_nom: string;
  date_modification: string;
}

interface PageResultats {
  count: number;
  results: Document[];
}

interface DossierDocument {
  id: string;
  code: string;
  intitule: string;
  description: string;
  chemin?: string;
  niveau?: number;
}

interface BlocDossierDocuments {
  id: string;
  intitule: string;
  description: string;
  chemin?: string;
  documents: Document[];
}

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const STYLES_STATUT: Record<string, string> = {
  brouillon: "badge-neutre",
  en_cours: "badge-info",
  a_valider: "badge-alerte",
  valide: "badge-succes",
  archive: "badge-neutre",
  annule: "badge-danger",
};

function formaterTaille(octets: number | null) {
  if (!octets) return "";
  if (octets < 1024) return `${octets} o`;
  if (octets < 1024 * 1024) return `${(octets / 1024).toFixed(1)} Ko`;
  return `${(octets / (1024 * 1024)).toFixed(1)} Mo`;
}

// ---------------------------------------------------------------------------
// Composant
// ---------------------------------------------------------------------------

export function ListeDocuments({
  projetId,
  baseLienDocument,
}: {
  projetId: string;
  baseLienDocument?: string;
}) {
  const queryClient = useQueryClient();
  const utilisateur = useSessionStore((etat) => etat.utilisateur);
  const estSuperAdmin = Boolean(utilisateur?.est_super_admin);
  const [filtreStatut, setFiltreStatut] = useState("");
  const [versionsCourantes, setVersionsCourantes] = useState(true);
  const [suppressionId, setSuppressionId] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  const [documentApercu, setDocumentApercu] = useState<Document | null>(null);

  const params = new URLSearchParams({ projet: projetId, ordering: "-date_modification" });
  if (filtreStatut) params.set("statut", filtreStatut);
  if (versionsCourantes) params.set("est_version_courante", "true");

  const { data, isLoading, isError } = useQuery<PageResultats>({
    queryKey: ["documents", projetId, filtreStatut, versionsCourantes],
    queryFn: () => api.get<PageResultats>(`/api/documents/?${params.toString()}`),
  });
  const { data: dossiers = [] } = useQuery<DossierDocument[]>({
    queryKey: ["documents-dossiers", projetId],
    queryFn: () => api.get<DossierDocument[]>(`/api/documents/dossiers/?projet=${projetId}`),
    select: (data) => extraireListeResultats<DossierDocument>(data),
  });

  const documents = data?.results ?? [];
  const construireLienDocument = (documentId: string) =>
    baseLienDocument ? `${baseLienDocument}/${documentId}` : `/documents/${documentId}`;
  const documentsParDossier: BlocDossierDocuments[] = dossiers.map((dossier) => ({
    ...dossier,
    documents: documents.filter((document) => document.dossier === dossier.id),
  }));
  const documentsSansDossier = documents.filter((document) => !document.dossier);
  const blocsDocuments: BlocDossierDocuments[] = [
    ...documentsParDossier,
    ...(documentsSansDossier.length > 0
      ? [
          {
            id: "sans-dossier",
            intitule: "Documents non classés",
            description: "Documents encore non affectés à un dossier GED.",
            chemin: "Documents non classés",
            documents: documentsSansDossier,
          },
        ]
      : []),
  ];

  const supprimerDocument = async (document: Document) => {
    const confirmation = window.confirm(
      estSuperAdmin
        ? `Supprimer définitivement le document ${document.reference || document.intitule} ?`
        : `Archiver le document ${document.reference || document.intitule} ?`
    );
    if (!confirmation) return;

    setSuppressionId(document.id);
    setErreur(null);
    try {
      await api.supprimer(`/api/documents/${document.id}/`);
      setSucces(estSuperAdmin ? "Document supprimé." : "Document archivé.");
      queryClient.invalidateQueries({ queryKey: ["documents", projetId] });
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Impossible de traiter le document.");
    } finally {
      setSuppressionId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filtres */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-slate-400" />
          <select
            className="champ-saisie w-auto text-sm"
            value={filtreStatut}
            onChange={(e) => setFiltreStatut(e.target.value)}
          >
            <option value="">Tous les statuts</option>
            <option value="brouillon">Brouillon</option>
            <option value="en_cours">En cours</option>
            <option value="a_valider">À valider</option>
            <option value="valide">Validé</option>
            <option value="archive">Archivé</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
          <input
            type="checkbox"
            checked={versionsCourantes}
            onChange={(e) => setVersionsCourantes(e.target.checked)}
            className="rounded"
          />
          Versions courantes uniquement
        </label>
        {data && (
          <span className="text-xs text-slate-400 ml-auto">
            {data.count} document{data.count > 1 ? "s" : ""}
          </span>
        )}
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

      {/* Contenu */}
      {isLoading ? (
        <div className="carte py-12 text-center text-slate-400 text-sm">Chargement…</div>
      ) : isError ? (
        <div className="carte py-12 text-center text-red-500 text-sm">Erreur lors du chargement.</div>
      ) : documents.length === 0 ? (
        <div className="carte py-12 text-center text-slate-400">
          <FileText size={32} className="mx-auto mb-3 text-slate-200" />
          <p className="text-sm">
            {filtreStatut ? "Aucun document ne correspond au filtre." : "Aucun document pour ce projet."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {blocsDocuments
            .filter((bloc) => bloc.documents.length > 0)
            .map((bloc) => (
              <div key={bloc.id} className="carte overflow-x-auto">
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-slate-800">{bloc.intitule}</h3>
                  <p className="mt-1 text-xs text-slate-400">{bloc.chemin || bloc.intitule}</p>
                  {bloc.description && <p className="mt-1 text-xs text-slate-500">{bloc.description}</p>}
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs text-slate-500">
                      <th className="text-left py-2 pr-4 font-medium">Référence</th>
                      <th className="text-left py-2 pr-4 font-medium">Intitulé</th>
                      <th className="text-left py-2 pr-4 font-medium">Type</th>
                      <th className="text-left py-2 pr-4 font-medium">Statut</th>
                      <th className="text-center py-2 pr-4 font-medium">Version</th>
                      <th className="text-right py-2 pr-4 font-medium">Taille</th>
                      <th className="text-right py-2 pr-4 font-medium">Modifié</th>
                      <th className="text-right py-2 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bloc.documents.map((doc) => (
                      <tr key={doc.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                        <td className="py-3 pr-4">
                          <Link href={construireLienDocument(doc.id)} className="font-mono text-xs text-primaire-700 hover:underline">
                            {doc.reference || "—"}
                          </Link>
                        </td>
                        <td className="py-3 pr-4 max-w-xs">
                          <div className="flex items-center gap-2">
                            <FileText size={14} className="text-slate-300 shrink-0" />
                            <Link href={construireLienDocument(doc.id)} className="font-medium truncate hover:text-primaire-600 transition-colors">
                              {doc.intitule}
                            </Link>
                          </div>
                          {doc.dossier_chemin && (
                            <p className="text-xs text-slate-400 mt-0.5 ml-5">{doc.dossier_chemin}</p>
                          )}
                          {doc.auteur_nom && (
                            <p className="text-xs text-slate-400 mt-0.5 ml-5">{doc.auteur_nom}</p>
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          <span className="badge-neutre text-xs">{doc.type_libelle}</span>
                        </td>
                        <td className="py-3 pr-4">
                          <span className={clsx(STYLES_STATUT[doc.statut] || "badge-neutre")}>
                            {doc.statut_libelle}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-center font-mono text-xs text-slate-500">
                          {doc.version}
                        </td>
                        <td className="py-3 pr-4 text-right text-xs text-slate-400">
                          {formaterTaille(doc.taille_octets)}
                        </td>
                        <td className="py-3 pr-4 text-right text-xs text-slate-400">
                          {new Date(doc.date_modification).toLocaleDateString("fr-FR")}
                        </td>
                        <td className="py-3 text-right">
                          <GroupeActionsRapides>
                            {doc.fichier ? (
                              <BoutonActionRapide
                                titre="Prévisualiser le fichier"
                                icone={Eye}
                                onClick={() => setDocumentApercu(doc)}
                              />
                            ) : (
                              <LienActionRapide
                                href={construireLienDocument(doc.id)}
                                titre="Ouvrir le document"
                                icone={Eye}
                              />
                            )}
                            <LienActionRapide
                              href={construireLienDocument(doc.id)}
                              titre="Modifier le document"
                              icone={Pencil}
                              variante="primaire"
                            />
                            <BoutonActionRapide
                              titre={estSuperAdmin ? "Supprimer le document" : "Archiver le document"}
                              icone={Trash2}
                              variante="danger"
                              disabled={suppressionId === doc.id}
                              onClick={() => supprimerDocument(doc)}
                            />
                          </GroupeActionsRapides>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
        </div>
      )}

      <ApercuFichierModal
        ouvert={Boolean(documentApercu)}
        onFermer={() => setDocumentApercu(null)}
        url={documentApercu?.fichier}
        typeMime={documentApercu?.type_mime}
        nomFichier={documentApercu?.nom_fichier_origine || documentApercu?.intitule}
      />
    </div>
  );
}
