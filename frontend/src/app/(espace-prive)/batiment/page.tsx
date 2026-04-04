import type { Metadata } from "next";
import { ListeEtudesBatiment } from "@/composants/batiment/ListeEtudesBatiment";

export const metadata: Metadata = {
  title: "Pré-dimensionnement bâtiment",
};

export default function PageBatiment() {
  return (
    <div className="space-y-6">
      <div>
        <h1>Pré-dimensionnement bâtiment</h1>
        <p className="text-slate-500 mt-1">Estimation des coûts de construction par programme de surfaces</p>
      </div>
      <ListeEtudesBatiment />
    </div>
  );
}
