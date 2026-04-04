import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DetailProgrammeBatiment } from "@/composants/batiment/DetailProgrammeBatiment";

export const metadata: Metadata = {
  title: "Programme bâtiment",
};

export default async function PageDetailProgrammeBatiment({
  params,
}: {
  params: Promise<{ id: string; programme_id: string }>;
}) {
  const { id, programme_id } = await params;
  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/projets/${id}/batiment`}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-2"
        >
          <ArrowLeft size={14} /> Bâtiment
        </Link>
        <h1>Programme bâtiment</h1>
      </div>
      <DetailProgrammeBatiment projetId={id} programmeId={programme_id} />
    </div>
  );
}
