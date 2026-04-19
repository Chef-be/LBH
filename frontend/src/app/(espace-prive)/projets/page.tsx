import type { Metadata } from "next";
import { ListeProjets } from "@/composants/projets/ListeProjets";
import { BoutonNouveauProjet } from "@/composants/projets/BoutonNouveauProjet";

export const metadata: Metadata = {
  title: "Projets",
};

export default function PageProjets() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1>Projets</h1>
          <p className="text-slate-500 mt-1">Gestion de l&apos;ensemble des affaires et missions</p>
        </div>
        <BoutonNouveauProjet />
      </div>

      <ListeProjets />
    </div>
  );
}
