import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { GestionDocumentsProjet } from "@/composants/documents/GestionDocumentsProjet";

export const metadata: Metadata = {
  title: "Documents du projet",
};

export default async function PageDocumentsProjet({ params }: { params: Promise<{ id: string }> }) {
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
        <h1>Documents du projet</h1>
        <p className="text-slate-500 mt-1 text-sm">GED projet, téléversements et génération documentaire guidée</p>
      </div>
      <GestionDocumentsProjet projetId={id} />
    </div>
  );
}
