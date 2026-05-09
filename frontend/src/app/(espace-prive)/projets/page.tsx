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
          <p className="text-slate-500 mt-1">Suivi des projets issus des affaires validées</p>
        </div>
        <BoutonNouveauProjet />
      </div>

      <div className="carte text-sm" style={{ color: "var(--texte-2)" }}>
        Les projets sont créés depuis les affaires validées dans Pilotage société. Cette page reste dédiée au suivi opérationnel.
      </div>

      <ListeProjets />
    </div>
  );
}
