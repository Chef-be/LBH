import type { Metadata } from "next";
import BanqueEstimations from "@/composants/ressources/BanqueEstimations";
import { ActionsAnalyseIA } from "@/composants/ressources/ActionsAnalyseIA";

export const metadata: Metadata = {
  title: "Estimations & Fiches ratio — Ressources LBH",
};

export default function PageEstimations() {
  return <div className="space-y-4"><div className="flex justify-end"><ActionsAnalyseIA type="estimations" /></div><BanqueEstimations /></div>;
}
