import type { Metadata } from "next";
import { WizardCreationProjet } from "@/composants/projets/wizard/WizardCreationProjet";

export const metadata: Metadata = {
  title: "Nouveau projet",
};

export default function PageNouveauProjet() {
  return <WizardCreationProjet />;
}
