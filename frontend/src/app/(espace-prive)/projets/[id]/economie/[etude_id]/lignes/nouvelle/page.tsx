import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { FormulaireNouvelleLigne } from "@/composants/economie/FormulaireNouvelleLigne";

export const metadata: Metadata = {
  title: "Nouvelle ligne de prix",
};

export default async function PageNouvelleLigne({
  params,
}: {
  params: Promise<{ id: string; etude_id: string }>;
}) {
  const { id, etude_id } = await params;
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link
          href={`/projets/${id}/economie/${etude_id}`}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-2"
        >
          <ArrowLeft size={14} /> Retour à l&apos;étude
        </Link>
        <h1>Nouvelle ligne de prix</h1>
        <p className="text-slate-500 mt-1">Saisie manuelle ou import depuis la bibliothèque</p>
      </div>
      <FormulaireNouvelleLigne projetId={id} etudeId={etude_id} />
    </div>
  );
}
