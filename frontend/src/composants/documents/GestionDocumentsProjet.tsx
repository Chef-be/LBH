"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, FileUp } from "lucide-react";
import { ListeDocuments } from "@/composants/documents/ListeDocuments";
import { EtatTeleversement } from "@/composants/ui/EtatTeleversement";
import {
  api,
  ErreurApi,
  extraireListeResultats,
  requeteApiAvecProgression,
  type ProgressionTeleversement,
} from "@/crochets/useApi";

interface DossierDocument {
  id: string;
  code: string;
  intitule: string;
  chemin?: string;
}

interface TypeDocument {
  id: string;
  code: string;
  libelle: string;
}

interface ProjetDocumentsDetail {
  id: string;
  reference: string;
  intitule: string;
}

function slugifierNomFichier(nom: string): string {
  return nom
    .replace(/\.[^/.]+$/, "")
    .trim()
    .replace(/\s+/g, " ");
}

function referenceParDefaut(projetReference: string): string {
  const horodatage = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 12);
  return `${projetReference}-DOC-${horodatage}`;
}

export function GestionDocumentsProjet({ projetId }: { projetId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [fichier, setFichier] = useState<File | null>(null);
  const [reference, setReference] = useState("");
  const [intitule, setIntitule] = useState("");
  const [typeDocument, setTypeDocument] = useState("");
  const [dossier, setDossier] = useState("");
  const [confidentiel, setConfidentiel] = useState(false);
  const [televersementEnCours, setTeleversementEnCours] = useState(false);
  const [progression, setProgression] = useState<ProgressionTeleversement | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const { data: projet } = useQuery<ProjetDocumentsDetail>({
    queryKey: ["projet-documents", projetId],
    queryFn: () => api.get<ProjetDocumentsDetail>(`/api/projets/${projetId}/`),
  });

  const { data: dossiers = [] } = useQuery<DossierDocument[]>({
    queryKey: ["documents-dossiers", projetId],
    queryFn: () => api.get<DossierDocument[]>(`/api/documents/dossiers/?projet=${projetId}`),
    select: (data) => extraireListeResultats<DossierDocument>(data),
  });

  const { data: typesDocuments = [] } = useQuery<TypeDocument[]>({
    queryKey: ["documents-types"],
    queryFn: () => api.get<TypeDocument[]>("/api/documents/types/"),
    select: (data) => extraireListeResultats<TypeDocument>(data as never),
  });

  const typesTries = useMemo(
    () => [...typesDocuments].sort((a, b) => a.libelle.localeCompare(b.libelle, "fr")),
    [typesDocuments]
  );

  const dossiersTries = useMemo(
    () => [...dossiers].sort((a, b) => (a.chemin || a.intitule).localeCompare(b.chemin || b.intitule, "fr")),
    [dossiers]
  );

  const televerserDocument = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!fichier) {
      setErreur("Sélectionne un fichier à affecter au projet.");
      return;
    }
    if (!reference.trim()) {
      setErreur("La référence du document est requise.");
      return;
    }
    if (!intitule.trim()) {
      setErreur("L'intitulé du document est requis.");
      return;
    }

    setErreur(null);
    setTeleversementEnCours(true);
    try {
      const formData = new FormData();
      formData.append("fichier", fichier);
      formData.append("reference", reference.trim());
      formData.append("intitule", intitule.trim());
      formData.append("projet", projetId);
      if (typeDocument) formData.append("type_document", typeDocument);
      if (dossier) formData.append("dossier", dossier);
      if (confidentiel) formData.append("confidentiel", "true");

      const reponse = await requeteApiAvecProgression<{ id: string }>("/api/documents/", {
        method: "POST",
        corps: formData,
        onProgression: setProgression,
      });

      await queryClient.invalidateQueries({ queryKey: ["documents", projetId] });
      await queryClient.invalidateQueries({ queryKey: ["documents-dossiers", projetId] });
      router.push(`/projets/${projetId}/documents/${reponse.id}`);
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Impossible de téléverser ce document.");
    } finally {
      setTeleversementEnCours(false);
      setTimeout(() => setProgression(null), 400);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <form onSubmit={televerserDocument} className="carte space-y-4">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-primaire-50 p-3 text-primaire-700">
              <FileUp className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-800">Affecter un document au projet</h2>
              <p className="mt-1 text-sm text-slate-500">
                Le document est créé directement dans la GED du projet et classé automatiquement si aucun dossier n’est choisi.
              </p>
            </div>
          </div>

          {erreur && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{erreur}</span>
              </div>
            </div>
          )}

          <EtatTeleversement progression={progression} libelle="Téléversement du document projet" />

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="libelle-champ" htmlFor="document-fichier">Fichier</label>
              <input
                id="document-fichier"
                type="file"
                className="champ-saisie w-full"
                onChange={(event) => {
                  const prochainFichier = event.target.files?.[0] || null;
                  setFichier(prochainFichier);
                  if (prochainFichier) {
                    setIntitule((precedent) => precedent || slugifierNomFichier(prochainFichier.name));
                    setReference((precedent) => precedent || referenceParDefaut(projet?.reference || "PROJET"));
                  }
                }}
              />
            </div>
            <div>
              <label className="libelle-champ" htmlFor="document-reference">Référence</label>
              <input
                id="document-reference"
                type="text"
                className="champ-saisie w-full"
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                placeholder={projet ? referenceParDefaut(projet.reference) : "Référence du document"}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="libelle-champ" htmlFor="document-intitule">Intitulé</label>
              <input
                id="document-intitule"
                type="text"
                className="champ-saisie w-full"
                value={intitule}
                onChange={(event) => setIntitule(event.target.value)}
                placeholder="Intitulé du document"
              />
            </div>
            <div>
              <label className="libelle-champ" htmlFor="document-type">Type de document</label>
              <select
                id="document-type"
                className="champ-saisie w-full"
                value={typeDocument}
                onChange={(event) => setTypeDocument(event.target.value)}
              >
                <option value="">Classement automatique selon le contenu</option>
                {typesTries.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.libelle}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="libelle-champ" htmlFor="document-dossier">Dossier GED</label>
              <select
                id="document-dossier"
                className="champ-saisie w-full"
                value={dossier}
                onChange={(event) => setDossier(event.target.value)}
              >
                <option value="">Classement automatique dans la GED du projet</option>
                {dossiersTries.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.chemin || item.intitule}
                  </option>
                ))}
              </select>
            </div>
            <label className="mt-7 flex items-center gap-3 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-primaire-600"
                checked={confidentiel}
                onChange={(event) => setConfidentiel(event.target.checked)}
              />
              Document confidentiel
            </label>
          </div>

          <div className="flex justify-end">
            <button type="submit" className="btn-primaire" disabled={televersementEnCours}>
              {televersementEnCours ? "Téléversement…" : "Créer le document du projet"}
            </button>
          </div>
        </form>
      </div>

      <ListeDocuments projetId={projetId} baseLienDocument={`/projets/${projetId}/documents`} />
    </div>
  );
}
