import type { Metadata } from "next";
import AnalyseurDevis from "@/composants/ressources/AnalyseurDevis";

export const metadata: Metadata = {
  title: "Analyser un devis — Ressources LBH",
};

export default function PageAnalyserDevis() {
  return <AnalyseurDevis />;
}
