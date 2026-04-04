import type { Metadata } from "next";
import { FormulaireNouveauProjet } from "@/composants/projets/FormulaireNouveauProjet";

export const metadata: Metadata = {
  title: "Nouveau projet",
};

export default function PageNouveauProjet() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1>Nouveau projet</h1>
        <p className="text-slate-500 mt-1">Créer un nouveau projet ou une nouvelle mission</p>
      </div>
      <FormulaireNouveauProjet />
    </div>
  );
}
