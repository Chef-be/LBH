import type { Metadata } from "next";
import GestionIndices from "@/composants/ressources/GestionIndices";

export const metadata: Metadata = {
  title: "Indices BT/TP — Ressources LBH",
};

export default function PageIndices() {
  return <GestionIndices />;
}
