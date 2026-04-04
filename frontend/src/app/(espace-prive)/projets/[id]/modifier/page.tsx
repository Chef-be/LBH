import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { FormulaireModifierProjet } from "@/composants/projets/FormulaireModifierProjet";

export const metadata: Metadata = {
  title: "Modifier le projet",
};

export default async function PageModifierProjet({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link
          href={`/projets/${id}`}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-2"
        >
          <ArrowLeft size={14} /> Fiche projet
        </Link>
        <h1>Modifier le projet</h1>
      </div>
      <FormulaireModifierProjet projetId={id} />
    </div>
  );
}
