import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SuiviExecutionProjet } from "@/composants/execution/SuiviExecutionProjet";

export const metadata: Metadata = {
  title: "Suivi d'exécution",
};

export default async function PageExecutionProjet({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/projets/${id}`}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-2"
        >
          <ArrowLeft size={14} /> Fiche projet
        </Link>
        <h1>Suivi d&apos;exécution</h1>
        <p className="text-slate-500 mt-1 text-sm">
          Comptes rendus de chantier, situations de travaux, ordres de service
        </p>
      </div>
      <SuiviExecutionProjet projetId={id} />
    </div>
  );
}
