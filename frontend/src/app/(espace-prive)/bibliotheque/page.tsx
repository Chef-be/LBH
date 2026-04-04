import type { Metadata } from "next";
import { ListeBibliotheque } from "@/composants/bibliotheque/ListeBibliotheque";

export const metadata: Metadata = {
  title: "Bibliothèque de prix",
};

export default function PageBibliotheque() {
  return (
    <div className="space-y-6">
      <div>
        <h1>Bibliothèque de prix</h1>
        <p className="text-slate-500 mt-1">Lignes de prix de référence</p>
      </div>
      <ListeBibliotheque />
    </div>
  );
}
