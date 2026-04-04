import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { FormulaireNouvelleEtudeVoirie } from "@/composants/voirie/FormulaireNouvelleEtudeVoirie";

export const metadata: Metadata = {
  title: "Nouvelle étude de voirie",
};

export default async function PageNouvelleEtudeVoirie({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href={`/projets/${id}/voirie`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-2">
          <ArrowLeft size={14} /> Voirie
        </Link>
        <h1>Nouvelle étude de voirie</h1>
        <p className="text-slate-500 mt-1">Dimensionnement de chaussée selon SETRA/LCPC 1994</p>
      </div>
      <FormulaireNouvelleEtudeVoirie projetId={id} />
    </div>
  );
}
