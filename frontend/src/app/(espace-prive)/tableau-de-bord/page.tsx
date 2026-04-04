import type { Metadata } from "next";
import { TuileStatistique } from "@/composants/tableau-de-bord/TuileStatistique";
import { ListeProjetsRecents } from "@/composants/tableau-de-bord/ListeProjetsRecents";

export const metadata: Metadata = {
  title: "Tableau de bord",
};

export default function PageTableauDeBord() {
  return (
    <div className="space-y-6">
      <div>
        <h1>Tableau de bord</h1>
        <p className="text-slate-500 mt-1">
          Vue d&apos;ensemble de l&apos;activité du bureau
        </p>
      </div>

      {/* Tuiles statistiques */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <TuileStatistique
          libelle="Projets en cours"
          codeStatistique="en_cours"
          icone="dossier"
          couleur="primaire"
        />
        <TuileStatistique
          libelle="En prospection"
          codeStatistique="en_prospection"
          icone="loupe"
          couleur="alerte"
        />
        <TuileStatistique
          libelle="Projets terminés"
          codeStatistique="termines"
          icone="coche"
          couleur="succes"
        />
        <TuileStatistique
          libelle="Total projets"
          codeStatistique="total"
          icone="liste"
          couleur="neutre"
        />
      </div>

      {/* Projets récents */}
      <div className="carte">
        <h2 className="mb-4">Projets récents</h2>
        <ListeProjetsRecents />
      </div>
    </div>
  );
}
