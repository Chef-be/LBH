"use client";

import { useState } from "react";
import Link from "next/link";
import { clsx } from "clsx";
import { BookOpen, FileText, Plus, UploadCloud } from "lucide-react";
import { OngletPrixBibliotheque } from "@/composants/bibliotheque/OngletPrixBibliotheque";
import { OngletCCTPBibliotheque } from "@/composants/bibliotheque/OngletCCTPBibliotheque";
import { OngletArticlesBibliotheque } from "@/composants/bibliotheque/OngletArticlesBibliotheque";
import { ModalImportBibliotheque } from "@/composants/bibliotheque/ModalImportBibliotheque";

type OngletActif = "prix" | "cctp" | "articles";

export default function PageBibliotheque() {
  const [onglet, setOnglet] = useState<OngletActif>("prix");
  const [modalImport, setModalImport] = useState(false);

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
              Prix, prescriptions CCTP et articles techniques
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
          <Link href="/bibliotheque/nouvelle" className="btn-primaire text-sm">
            <Plus className="h-4 w-4" />
            Nouvelle entrée
          </Link>
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
              <span className="h-2 w-2 rounded-full bg-blue-400" />
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
          <button
            type="button"
            onClick={() => setOnglet("articles")}
            className={clsx(
              "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              onglet === "articles"
                ? "bg-white text-slate-800 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            <span className="flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5" />
              Articles
            </span>
          </button>
        </div>

        {/* Contenu onglet */}
        <div className="space-y-4">
          {onglet === "prix" && <OngletPrixBibliotheque />}
          {onglet === "cctp" && <OngletCCTPBibliotheque />}
          {onglet === "articles" && <OngletArticlesBibliotheque />}
        </div>
      </div>

      {/* Modal import */}
      {modalImport && <ModalImportBibliotheque onFermer={() => setModalImport(false)} />}
    </div>
  );
}
