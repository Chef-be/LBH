import type { Metadata } from "next";
import { PlanningProjet } from "@/composants/projets/PlanningProjet";

export const metadata: Metadata = {
  title: "Planning du projet",
};

export default async function PagePlanningProjet({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PlanningProjet projetId={id} />;
}
