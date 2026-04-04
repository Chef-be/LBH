import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ListeEtudesBatimentProjet } from "@/composants/batiment/ListeEtudesBatimentProjet";

export const metadata: Metadata = {
  title: "Bâtiment — programmes",
};

export default async function PageBatimentProjet({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link href={`/projets/${id}`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-2">
            <ArrowLeft size={14} /> Fiche projet
          </Link>
          <h1>Pré-dimensionnement bâtiment</h1>
        </div>
        <Link href={`/projets/${id}/batiment/nouvelle`} className="btn-primaire text-xs shrink-0">
          + Nouveau programme
        </Link>
      </div>
      <ListeEtudesBatimentProjet projetId={id} />
    </div>
  );
}
