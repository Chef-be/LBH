import type { Metadata } from "next";
import { FormulaireNouveauProjet } from "@/composants/projets/FormulaireNouveauProjet";

export const metadata: Metadata = {
  title: "Nouveau projet",
};

export default function PageNouveauProjet() {
  return (
    <div className="space-y-6 max-w-none">
      <div>
        <h1>Nouveau projet</h1>
        <p className="mt-1 text-slate-500">Créer un projet métier, qualifier le contexte et structurer les informations utiles avant validation.</p>
      </div>
      <FormulaireNouveauProjet />
    </div>
  );
}
