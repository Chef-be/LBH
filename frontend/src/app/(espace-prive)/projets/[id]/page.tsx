import type { Metadata } from "next";
import { DetailProjet } from "@/composants/projets/DetailProjet";

export const metadata: Metadata = {
  title: "Détail du projet",
};

export default async function PageDetailProjet({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DetailProjet id={id} />;
}
