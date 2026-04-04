import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { FormulaireNouveauProgramme } from "@/composants/batiment/FormulaireNouveauProgramme";

export const metadata: Metadata = {
  title: "Nouveau programme bâtiment",
};

export default async function PageNouveauProgramme({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href={`/projets/${id}/batiment`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-2">
          <ArrowLeft size={14} /> Bâtiment
        </Link>
        <h1>Nouveau programme bâtiment</h1>
        <p className="text-slate-500 mt-1">Pré-dimensionnement et estimation de coûts</p>
      </div>
      <FormulaireNouveauProgramme projetId={id} />
    </div>
  );
}
