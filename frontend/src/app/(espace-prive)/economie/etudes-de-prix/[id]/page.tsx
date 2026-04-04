import type { Metadata } from "next";
import { DetailEtudePrix } from "@/composants/economie/DetailEtudePrix";

export const metadata: Metadata = {
  title: "Détail étude de prix",
};

export default async function PageDetailEtudePrix({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DetailEtudePrix etudeId={id} />;
}
