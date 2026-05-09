import type { Metadata } from "next";
import BanquePrixMarche from "@/composants/ressources/BanquePrixMarche";
import { ActionsAnalyseIA } from "@/composants/ressources/ActionsAnalyseIA";

export const metadata: Metadata = {
  title: "Banque de prix marché — Ressources LBH",
};

export default function PagePrixMarche() {
  return <div className="space-y-4"><div className="flex justify-end"><ActionsAnalyseIA type="prix" /></div><BanquePrixMarche /></div>;
}
