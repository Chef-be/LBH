import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { FormulaireNouvelAppelOffres } from "@/composants/appels-offres/FormulaireNouvelAppelOffres";

export const metadata: Metadata = {
  title: "Nouvel appel d'offres",
};

export default async function PageNouvelAppelOffres({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link
          href={`/projets/${id}/appels-offres`}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-2"
        >
          <ArrowLeft size={14} /> Appels d&apos;offres
        </Link>
        <h1>Nouvel appel d&apos;offres</h1>
      </div>
      <FormulaireNouvelAppelOffres projetId={id} />
    </div>
  );
}
