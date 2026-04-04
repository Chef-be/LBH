import type { Metadata } from "next";
import { DetailEtudeEconomique } from "@/composants/economie/DetailEtudeEconomique";

export const metadata: Metadata = {
  title: "Étude économique",
};

export default async function PageDetailEtude({
  params,
}: {
  params: Promise<{ id: string; etude_id: string }>;
}) {
  const { id, etude_id } = await params;
  return <DetailEtudeEconomique projetId={id} etudeId={etude_id} />;
}
