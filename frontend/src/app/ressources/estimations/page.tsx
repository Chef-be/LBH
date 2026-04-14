import type { Metadata } from "next";
import BanqueEstimations from "@/composants/ressources/BanqueEstimations";

export const metadata: Metadata = {
  title: "Estimations & Fiches ratio — Ressources LBH",
};

export default function PageEstimations() {
  return <BanqueEstimations />;
}
