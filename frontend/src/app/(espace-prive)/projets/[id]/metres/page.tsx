import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ListeMetresProjet } from "@/composants/metres/ListeMetresProjet";

export const metadata: Metadata = {
  title: "Métrés du projet",
};

export default async function PageMetresProjet({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link
            href={`/projets/${id}`}
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-2"
          >
            <ArrowLeft size={14} /> Fiche projet
          </Link>
          <h1>Métrés quantitatifs</h1>
        </div>
        <Link
          href={`/projets/${id}/metres/nouveau`}
          className="btn-primaire text-xs shrink-0"
        >
          + Nouveau métré
        </Link>
      </div>
      <ListeMetresProjet projetId={id} />
    </div>
  );
}
