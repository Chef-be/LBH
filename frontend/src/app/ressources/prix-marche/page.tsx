import type { Metadata } from "next";
import BanquePrixMarche from "@/composants/ressources/BanquePrixMarche";

export const metadata: Metadata = {
  title: "Banque de prix marché — Ressources LBH",
};

export default function PagePrixMarche() {
  return <BanquePrixMarche />;
}
