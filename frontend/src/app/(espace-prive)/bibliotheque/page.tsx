"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { clsx } from "clsx";
import { BookOpen, DollarSign, Euro, FileText, Plus, UploadCloud, X } from "lucide-react";
import { OngletPrixBibliotheque } from "@/composants/bibliotheque/OngletPrixBibliotheque";
import { OngletCCTPBibliotheque } from "@/composants/bibliotheque/OngletCCTPBibliotheque";
import { ModalImportBibliotheque } from "@/composants/bibliotheque/ModalImportBibliotheque";

type OngletActif = "prix" | "cctp";

// ---------------------------------------------------------------------------
// Modal choix nouvelle entrée
// ---------------------------------------------------------------------------

function ModalChoixNouvelleEntree({ onFermer }: { onFermer: () => void }) {
  const router = useRouter();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="font-semibold text-slate-900">Nouvelle entrée dans la bibliothèque</h2>
          <button type="button" onClick={onFermer} className="rounded-lg p-1.5 hover:bg-slate-100">
            <X className="h-4 w-4 text-slate-500" />
          </button>
        </div>

        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Choix 1 : Ligne de prix */}
          <button
            type="button"
            onClick={() => router.push("/bibliotheque/nouvelle")}
            className="group flex flex-col items-start gap-3 rounded-xl border-2 border-slate-200 p-5 text-left transition-colors hover:border-primaire-300 hover:bg-primaire-50"
          >
            <div className="rounded-xl bg-blue-100 p-3 group-hover:bg-blue-200 transition-colors">
              <DollarSign className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="font-semibold text-slate-900">Ligne de prix</p>
              <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                Ajouter une prestation avec son prix unitaire, ses composantes et ses sous-détails
              </p>
            </div>
          </button>

          {/* Choix 2 : Article CCTP */}
          <button
            type="button"
            onClick={() => router.push("/bibliotheque/article/nouveau")}
            className="group flex flex-col items-start gap-3 rounded-xl border-2 border-slate-200 p-5 text-left transition-colors hover:border-primaire-300 hover:bg-primaire-50"
          >
            <div className="rounded-xl bg-emerald-100 p-3 group-hover:bg-emerald-200 transition-colors">
              <FileText className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <p className="font-semibold text-slate-900">Article CCTP</p>
              <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                Rédiger un article de cahier des charges technique lié à une prestation
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page principale
// ---------------------------------------------------------------------------

export default function PageBibliotheque() {
  const searchParams = useSearchParams();
  const [onglet, setOnglet] = useState<OngletActif>(() => {
    return searchParams.get("onglet") === "cctp" ? "cctp" : "prix";
  });
  const [modalImport, setModalImport] = useState(false);
  const [modalNouvelleEntree, setModalNouvelleEntree] = useState(false);

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primaire-50 p-2">
            <BookOpen className="h-5 w-5 text-primaire-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Bibliothèque</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Prix unitaires et articles CCTP par corps d&apos;état
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-secondaire text-sm"
            onClick={() => setModalImport(true)}
          >
            <UploadCloud className="h-4 w-4" />
            Importer
          </button>
          <button
            type="button"
            className="btn-primaire text-sm"
            onClick={() => setModalNouvelleEntree(true)}
          >
            <Plus className="h-4 w-4" />
            Nouvelle entrée
          </button>
        </div>
      </div>

      {/* Onglets principaux */}
      <div className="carte space-y-4">
        <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
          <button
            type="button"
            onClick={() => setOnglet("prix")}
            className={clsx(
              "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              onglet === "prix"
                ? "bg-white text-slate-800 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            <span className="flex items-center gap-1.5">
              <Euro className="h-3.5 w-3.5" />
              Prix
            </span>
          </button>
          <button
            type="button"
            onClick={() => setOnglet("cctp")}
            className={clsx(
              "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              onglet === "cctp"
                ? "bg-white text-slate-800 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            <span className="flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              CCTP
            </span>
          </button>
        </div>

        {/* Contenu onglet */}
        <div className="space-y-4">
          {onglet === "prix" && <OngletPrixBibliotheque />}
          {onglet === "cctp" && <OngletCCTPBibliotheque />}
        </div>
      </div>

      {/* Modal import */}
      {modalImport && <ModalImportBibliotheque onFermer={() => setModalImport(false)} />}

      {/* Modal nouvelle entrée */}
      {modalNouvelleEntree && (
        <ModalChoixNouvelleEntree onFermer={() => setModalNouvelleEntree(false)} />
      )}
    </div>
  );
}
