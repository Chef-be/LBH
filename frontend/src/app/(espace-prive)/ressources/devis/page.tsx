import type { Metadata } from "next";
import AnalyseurDevis from "@/composants/ressources/AnalyseurDevis";
import { ActionsAnalyseIA } from "@/composants/ressources/ActionsAnalyseIA";

export const metadata: Metadata = {
  title: "Analyser un devis — Ressources LBH",
};

export default function PageAnalyserDevis() {
  return <div className="space-y-4"><div className="flex justify-end"><ActionsAnalyseIA type="devis" /></div><AnalyseurDevis /></div>;
}
