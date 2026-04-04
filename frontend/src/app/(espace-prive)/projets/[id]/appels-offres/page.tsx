import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ListeAppelsOffresProjet } from "@/composants/appels-offres/ListeAppelsOffresProjet";

export const metadata: Metadata = {
  title: "Appels d'offres du projet",
};

export default async function PageAppelsOffresProjet({ params }: { params: Promise<{ id: string }> }) {
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
          <h1>Appels d&apos;offres</h1>
        </div>
        <Link
          href={`/projets/${id}/appels-offres/nouveau`}
          className="btn-primaire text-xs shrink-0"
        >
          + Nouvel appel d&apos;offres
        </Link>
      </div>
      <ListeAppelsOffresProjet projetId={id} />
    </div>
  );
}
