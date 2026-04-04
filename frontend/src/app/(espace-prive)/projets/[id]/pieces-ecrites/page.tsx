import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import { ListePiecesEcritesProjet } from "@/composants/pieces-ecrites/ListePiecesEcritesProjet";

export const metadata: Metadata = {
  title: "Pièces écrites",
};

export default async function PagePiecesEcritesProjet({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href={`/projets/${id}`}
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-2"
          >
            <ArrowLeft size={14} /> Fiche projet
          </Link>
          <h1>Pièces écrites</h1>
          <p className="text-slate-500 mt-1 text-sm">
            CCTP, mémoires techniques, rapports, notices
          </p>
        </div>
        <Link
          href={`/projets/${id}/pieces-ecrites/nouvelle`}
          className="btn-primaire text-xs flex items-center gap-1 shrink-0"
        >
          <Plus size={12} /> Nouvelle pièce
        </Link>
      </div>
      <ListePiecesEcritesProjet projetId={id} />
    </div>
  );
}
