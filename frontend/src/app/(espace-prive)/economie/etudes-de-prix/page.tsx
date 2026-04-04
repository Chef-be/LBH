import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ListeEtudesPrix } from "@/composants/economie/ListeEtudesPrix";

export const metadata: Metadata = {
  title: "Études de prix",
};

export default function PageEtudesDePrix() {
  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/economie"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-2"
        >
          <ArrowLeft size={14} />
          Économie
        </Link>
        <h1>Études de prix analytiques</h1>
        <p className="text-slate-500 mt-1">
          Sous-détails ressource par ressource, validation métier et publication vers la bibliothèque.
        </p>
      </div>
      <ListeEtudesPrix />
    </div>
  );
}
