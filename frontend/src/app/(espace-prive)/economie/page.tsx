import type { Metadata } from "next";
import Link from "next/link";
import { Calculator, BookOpen, BadgeEuro, TrendingUp } from "lucide-react";
import { ListeEtudesEconomiquesGlobale } from "@/composants/economie/ListeEtudesEconomiquesGlobale";
import { ListeEtudesPrix } from "@/composants/economie/ListeEtudesPrix";

export const metadata: Metadata = {
  title: "Économie de la construction",
};

export default function PageEconomie() {
  const parcours = [
    {
      titre: "Maîtrise d’ouvrage publique",
      intro: "Contrôler l’enveloppe travaux puis consolider l’estimation par degrés de précision.",
      etapes: [
        "1. Estimation par ratio sur projets similaires",
        "2. Vérification par retour d’expérience extrait des pièces téléversées",
        "3. Consolidation analytique lorsque le dossier le permet",
      ],
    },
    {
      titre: "Maîtrise d’œuvre",
      intro: "Produire une estimation fiable et des pièces cohérentes avec objectif de précision resserré en phase aboutie.",
      etapes: [
        "1. Décomposer le projet en lots et ouvrages élémentaires",
        "2. Aligner CCTP, BPU, DPGF et bibliothèque de prix",
        "3. Comparer ratio, REX et analytique avant diffusion",
      ],
    },
    {
      titre: "Entreprise de travaux",
      intro: "Chiffrer l’offre par sous-détail analytique, calculer K et sécuriser les achats.",
      etapes: [
        "1. Importer BPU, DPGF, devis ou pièces sources",
        "2. Calculer déboursés secs, DHMO, frais et coefficient K",
        "3. Mesurer rentabilité, seuils et besoins d’achats fournisseurs",
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1>Économie de la construction</h1>
          <p className="text-slate-500 mt-1">
            Études économiques, sous-détails analytiques et publication dans la bibliothèque de prix.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/economie/pilotage-activite" className="btn-secondaire text-sm">
            <TrendingUp className="w-4 h-4" />
            Pilotage d&apos;activité
          </Link>
          <Link href="/parametres/couts-main-oeuvre" className="btn-secondaire text-sm">
            <BadgeEuro className="w-4 h-4" />
            Paramétrage main-d’œuvre
          </Link>
          <Link href="/economie/etudes-de-prix" className="btn-secondaire text-sm">
            <BookOpen className="w-4 h-4" />
            Études de prix
          </Link>
          <Link href="/economie/etudes-de-prix/nouvelle" className="btn-primaire text-sm">
            <Calculator className="w-4 h-4" />
            Nouvelle étude de prix
          </Link>
        </div>
      </div>

      <section className="grid gap-4 lg:grid-cols-3">
        {parcours.map((bloc) => (
          <article key={bloc.titre} className="carte p-5">
            <h2 className="text-base">{bloc.titre}</h2>
            <p className="mt-2 text-sm text-slate-500">{bloc.intro}</p>
            <ul className="mt-4 space-y-2 text-sm text-slate-700">
              {bloc.etapes.map((etape) => (
                <li key={etape}>• {etape}</li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      <section className="space-y-3">
        <div>
          <h2>Études économiques</h2>
          <p className="text-sm text-slate-500 mt-1">
            Estimations, déboursés, prix de vente et rentabilité par projet.
          </p>
        </div>
        <ListeEtudesEconomiquesGlobale />
      </section>

      <section className="space-y-3">
        <div>
          <h2>Études de prix analytiques</h2>
          <p className="text-sm text-slate-500 mt-1">
            Sous-détails ressource par ressource, validation métier et publication vers la bibliothèque.
          </p>
        </div>
        <ListeEtudesPrix />
      </section>
    </div>
  );
}
