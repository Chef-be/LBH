import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { FormulaireNouvelleEtudePrix } from "@/composants/economie/FormulaireNouvelleEtudePrix";

export const metadata: Metadata = {
  title: "Nouvelle étude de prix",
};

export default async function PageNouvelleEtudePrix({
  searchParams,
}: {
  searchParams: Promise<{ projet?: string | string[] }>;
}) {
  const params = await searchParams;
  const projetInitial = Array.isArray(params.projet) ? params.projet[0] : params.projet;

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <Link
          href="/economie/etudes-de-prix"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-2"
        >
          <ArrowLeft size={14} />
          Études de prix
        </Link>
        <h1>Nouvelle étude de prix</h1>
        <p className="text-slate-500 mt-1">
          Créer un sous-détail analytique rattaché à un projet et prêt à être publié en bibliothèque.
        </p>
      </div>
      <FormulaireNouvelleEtudePrix projetInitialId={projetInitial} />
    </div>
  );
}
