"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { api } from "@/crochets/useApi";

interface ModeleDocument {
  id: string;
  code: string;
  libelle: string;
  type_document: string;
  type_libelle: string;
  description?: string;
  variables_fusion?: Array<{ nom: string; description?: string; exemple?: string }>;
}

interface Lot {
  id: string;
  numero: number;
  intitule: string;
}

interface ProjetResume {
  id: string;
  reference: string;
  lots: Lot[];
}

export default function PageNouvellePieceEcrite({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type_document?: string; assistant?: string; intitule?: string }>;
}) {
  const { id: projetId } = use(params);
  const recherche = use(searchParams);
  const router = useRouter();

  const [modeles, setModeles] = useState<ModeleDocument[]>([]);
  const [projet, setProjet] = useState<ProjetResume | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const [intitule, setIntitule] = useState("");
  const [modeleId, setModeleId] = useState("");
  const [lotId, setLotId] = useState("");
  const [variablesPersonnalisees, setVariablesPersonnalisees] = useState<Record<string, string>>({});

  useEffect(() => {
    api.get<{ results: ModeleDocument[] }>("/api/pieces-ecrites/modeles/")
      .then((r) => setModeles(r.results ?? []))
      .catch(() => setModeles([]));

    api.get<ProjetResume>(`/api/projets/${projetId}/`)
      .then(setProjet)
      .catch(() => null);
  }, [projetId]);

  useEffect(() => {
    if (recherche.intitule) {
      setIntitule(recherche.intitule);
    }
  }, [recherche.intitule]);

  useEffect(() => {
    setVariablesPersonnalisees({});
  }, [modeleId]);

  useEffect(() => {
    if (!recherche.type_document || modeles.length === 0 || modeleId) return;
    const modeleCompatible = modeles.find((modele) => modele.type_document === recherche.type_document);
    if (modeleCompatible) {
      setModeleId(modeleCompatible.id);
    }
  }, [modeleId, modeles, recherche.type_document]);

  const modeleActif = modeles.find((modele) => modele.id === modeleId) || null;

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();
    if (!intitule.trim()) { setErreur("L'intitulé est obligatoire."); return; }
    setEnvoi(true);
    setErreur(null);
    try {
      const corps: Record<string, unknown> = { projet: projetId, intitule: intitule.trim() };
      if (modeleId) corps.modele = modeleId;
      if (lotId) corps.lot = lotId;
      if (Object.keys(variablesPersonnalisees).length > 0) corps.variables_personnalisees = variablesPersonnalisees;

      const piece = await api.post<{ id: string }>("/api/pieces-ecrites/", corps);
      router.push(`/projets/${projetId}/pieces-ecrites/${piece.id}`);
    } catch {
      setErreur("Erreur lors de la création. Veuillez réessayer.");
      setEnvoi(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link
          href={`/projets/${projetId}/pieces-ecrites`}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-2"
        >
          <ArrowLeft size={14} /> Pièces écrites
        </Link>
        <h1>Nouvelle pièce écrite</h1>
        {projet && (
          <p className="text-slate-500 mt-1 text-sm">
            Projet <span className="font-mono">{projet.reference}</span>
          </p>
        )}
        {recherche.assistant && (
          <p className="mt-2 text-sm text-primaire-700">
            Assistant actif : <span className="font-medium">{recherche.assistant}</span>
          </p>
        )}
      </div>

      <form onSubmit={soumettre} className="carte space-y-5">
        {erreur && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
            {erreur}
          </div>
        )}

        <div>
          <label className="libelle-champ" htmlFor="intitule">
            Intitulé <span className="text-red-500">*</span>
          </label>
          <input
            id="intitule"
            type="text"
            className="champ-saisie w-full"
            placeholder="Ex. : CCTP lot 01 — Gros œuvre"
            value={intitule}
            onChange={(e) => setIntitule(e.target.value)}
            required
            autoFocus
          />
        </div>

        <div>
          <label className="libelle-champ" htmlFor="modele">
            Modèle de document
          </label>
          <select
            id="modele"
            className="champ-saisie w-full"
            value={modeleId}
            onChange={(e) => setModeleId(e.target.value)}
          >
            <option value="">— Sans modèle —</option>
            {modeles.map((m) => (
              <option key={m.id} value={m.id}>
                {m.libelle} ({m.type_libelle})
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-400 mt-1">
            Le modèle définit la structure et les variables de fusion du document.
          </p>
        </div>

        {modeleActif && (modeleActif.variables_fusion?.length || 0) > 0 && (
          <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Variables de fusion</h2>
              <p className="text-xs text-slate-500 mt-1">
                Les valeurs saisies ici alimenteront la génération initiale de la pièce écrite à partir du modèle.
              </p>
            </div>
            {modeleActif.variables_fusion?.map((variable) => (
              <div key={variable.nom}>
                <label className="libelle-champ" htmlFor={`variable-${variable.nom}`}>
                  {variable.description || variable.nom}
                </label>
                <input
                  id={`variable-${variable.nom}`}
                  type="text"
                  className="champ-saisie w-full"
                  placeholder={variable.exemple || variable.nom}
                  value={variablesPersonnalisees[variable.nom] || ""}
                  onChange={(e) =>
                    setVariablesPersonnalisees((precedent) => ({
                      ...precedent,
                      [variable.nom]: e.target.value,
                    }))
                  }
                />
              </div>
            ))}
          </div>
        )}

        {projet && projet.lots.length > 0 && (
          <div>
            <label className="libelle-champ" htmlFor="lot">
              Lot concerné
            </label>
            <select
              id="lot"
              className="champ-saisie w-full"
              value={lotId}
              onChange={(e) => setLotId(e.target.value)}
            >
              <option value="">— Tous les lots —</option>
              {projet.lots.map((l) => (
                <option key={l.id} value={l.id}>
                  Lot {l.numero} — {l.intitule}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button type="submit" className="btn-primaire" disabled={envoi}>
            {envoi ? "Création…" : "Créer la pièce écrite"}
          </button>
          <Link href={`/projets/${projetId}/pieces-ecrites`} className="btn-secondaire">
            Annuler
          </Link>
        </div>
      </form>
    </div>
  );
}
