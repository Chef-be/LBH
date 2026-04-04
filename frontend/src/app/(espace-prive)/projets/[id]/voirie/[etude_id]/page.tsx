import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DetailEtudeVoirie } from "@/composants/voirie/DetailEtudeVoirie";

export const metadata: Metadata = {
  title: "Étude de voirie",
};

export default async function PageDetailEtudeVoirie({
  params,
}: {
  params: Promise<{ id: string; etude_id: string }>;
}) {
  const { id, etude_id } = await params;
  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/projets/${id}/voirie`}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-2"
        >
          <ArrowLeft size={14} /> Voirie
        </Link>
        <h1>Dimensionnement de chaussée</h1>
      </div>
      <DetailEtudeVoirie projetId={id} etudeId={etude_id} />
    </div>
  );
}
