"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, ErreurApi } from "@/crochets/useApi";
import {
  DatabaseZap,
  FileUp,
  Plus,
  UploadCloud,
  X,
} from "lucide-react";
import Link from "next/link";

type ModeImport = "artiprix" | "fichier" | "saisie";

interface Props {
  onFermer: () => void;
}

export function ModalImportBibliotheque({ onFermer }: Props) {
  const queryClient = useQueryClient();
  const selecteurFichiersRef = useRef<HTMLInputElement | null>(null);

  const [mode, setMode] = useState<ModeImport | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [succes, setSucces] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const invaliderBibliotheque = () => {
    queryClient.invalidateQueries({ queryKey: ["bibliotheque"] });
  };

  const importerReferentiel = async () => {
    setEnCours(true);
    setErreur(null);
    setSucces(null);
    try {
      const reponse = await api.post<{
        detail: string; fichiers: number; lignes: number; creees: number; mises_a_jour: number;
      }>("/api/bibliotheque/importer-bordereaux/", {});
      setSucces(
        `${reponse.detail} ${reponse.lignes} ligne(s) traitée(s), ${reponse.creees} créée(s), ${reponse.mises_a_jour} mise(s) à jour.`
      );
      invaliderBibliotheque();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Import impossible.");
    } finally {
      setEnCours(false);
    }
  };

  const televerserFichiers = async (event: ChangeEvent<HTMLInputElement>) => {
    const fichiers = Array.from(event.target.files ?? []);
    if (fichiers.length === 0) return;

    const limite = window.prompt("Limiter le nombre de lignes par fichier (laisser vide pour tout importer) ?", "");
    const formData = new FormData();
    fichiers.forEach((f) => formData.append("fichiers", f));
    if (limite?.trim()) formData.append("limite", limite.trim());

    setEnCours(true);
    setErreur(null);
    setSucces(null);
    try {
      const reponse = await api.post<{
        detail: string; fichiers: number; fichiers_ignores: number;
        lignes: number; creees: number; mises_a_jour: number;
      }>("/api/bibliotheque/importer-fichiers/", formData);
      setSucces(
        `${reponse.detail} ${reponse.lignes} ligne(s), ${reponse.creees} créée(s), ${reponse.mises_a_jour} mise(s) à jour.`
      );
      invaliderBibliotheque();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Import fichier impossible.");
    } finally {
      event.target.value = "";
      setEnCours(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        {/* En-tête */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="font-semibold text-slate-900">Importer dans la bibliothèque</h2>
          <button type="button" onClick={onFermer} className="rounded-lg p-1.5 hover:bg-slate-100">
            <X className="h-4 w-4 text-slate-500" />
          </button>
        </div>

        {/* Options */}
        <div className="p-6 space-y-3">
          {/* ARTIPRIX / référentiel partagé */}
          <button
            type="button"
            onClick={() => { setMode("artiprix"); importerReferentiel(); }}
            disabled={enCours}
            className="w-full flex items-start gap-4 rounded-xl border border-slate-200 p-4 text-left hover:border-primaire-300 hover:bg-primaire-50 transition-colors"
          >
            <div className="rounded-lg bg-blue-100 p-2 flex-shrink-0">
              <UploadCloud className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="font-medium text-slate-900">ARTIPRIX — Référentiel partagé</p>
              <p className="text-sm text-slate-500 mt-0.5">
                Importer automatiquement les bordereaux de prix depuis le partage documentaire métier.
              </p>
            </div>
          </button>

          {/* PDF / Excel */}
          <button
            type="button"
            onClick={() => { setMode("fichier"); selecteurFichiersRef.current?.click(); }}
            disabled={enCours}
            className="w-full flex items-start gap-4 rounded-xl border border-slate-200 p-4 text-left hover:border-primaire-300 hover:bg-primaire-50 transition-colors"
          >
            <div className="rounded-lg bg-orange-100 p-2 flex-shrink-0">
              <FileUp className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="font-medium text-slate-900">Fichier PDF ou Excel</p>
              <p className="text-sm text-slate-500 mt-0.5">
                Téléverser un ou plusieurs bordereaux PDF à analyser et intégrer.
              </p>
            </div>
          </button>

          {/* Saisie manuelle */}
          <Link
            href="/bibliotheque/nouvelle"
            className="w-full flex items-start gap-4 rounded-xl border border-slate-200 p-4 text-left hover:border-primaire-300 hover:bg-primaire-50 transition-colors"
            onClick={onFermer}
          >
            <div className="rounded-lg bg-green-100 p-2 flex-shrink-0">
              <Plus className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="font-medium text-slate-900">Saisie manuelle</p>
              <p className="text-sm text-slate-500 mt-0.5">
                Créer une nouvelle entrée directement dans la bibliothèque.
              </p>
            </div>
          </Link>
        </div>

        {/* Retours */}
        {enCours && (
          <div className="px-6 pb-4">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <DatabaseZap className="h-4 w-4 animate-pulse" />
              Import en cours…
            </div>
          </div>
        )}
        {succes && (
          <div className="mx-6 mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {succes}
          </div>
        )}
        {erreur && (
          <div className="mx-6 mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {erreur}
          </div>
        )}

        <div className="flex justify-end border-t border-slate-100 px-6 py-4">
          <button type="button" onClick={onFermer} className="btn-secondaire text-sm">
            Fermer
          </button>
        </div>
      </div>

      <input
        ref={selecteurFichiersRef}
        type="file"
        accept=".pdf,.PDF"
        multiple
        className="hidden"
        onChange={televerserFichiers}
      />
    </div>
  );
}
