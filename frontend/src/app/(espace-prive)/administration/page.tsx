"use client";

import Link from "next/link";
import {
  BarChart2,
  BriefcaseBusiness,
  Building2,
  Edit3,
  FileCog,
  FileText,
  Globe,
  Heart,
  Mail,
  Settings,
  Star,
  ArrowRight,
  FolderKanban,
  Shapes,
} from "lucide-react";
import { useConfiguration } from "@/contextes/FournisseurConfiguration";
import { obtenirNomPlateforme } from "@/lib/site-public";

interface CarteAdministration {
  chemin: string;
  icone: React.ComponentType<{ className?: string }>;
  titre: string;
  description: string;
  couleur: string;
}

const RUBRIQUES: Array<{
  titre: string;
  description: string;
  cartes: CarteAdministration[];
}> = [
  {
    titre: "Identité et structure",
    description: "Réglez la présentation générale du site, les pages éditoriales et le parcours visiteur.",
    cartes: [
      {
        chemin: "/administration/contenus-editoriaux",
        icone: Edit3,
        titre: "Contenus éditoriaux",
        description: "Accueil, pages publiques, accroches, blocs éditoriaux et textes riches du site vitrine.",
        couleur: "text-indigo-600 bg-indigo-50",
      },
      {
        chemin: "/administration/configuration",
        icone: Settings,
        titre: "Configuration générale",
        description: "Nom du bureau, coordonnées, SEO, maintenance visuelle et sections globales.",
        couleur: "text-primaire-600 bg-primaire-50",
      },
      {
        chemin: "/administration/pages-statiques",
        icone: FileText,
        titre: "Pages éditoriales",
        description: "Mentions légales, confidentialité, cookies et contenus institutionnels en édition riche.",
        couleur: "text-slate-600 bg-slate-100",
      },
      {
        chemin: "/administration/contacts",
        icone: Mail,
        titre: "Demandes de contact",
        description: "Consultez les demandes reçues via le formulaire public.",
        couleur: "text-green-600 bg-green-50",
      },
    ],
  },
  {
    titre: "Offres et preuves",
    description: "Gérez les prestations, références et éléments de réassurance visibles sur le site.",
    cartes: [
      {
        chemin: "/administration/prestations",
        icone: Star,
        titre: "Prestations",
        description: "Cartes, pages détail, contenus longs, livrables et promesses client.",
        couleur: "text-accent-600 bg-amber-50",
      },
      {
        chemin: "/administration/references",
        icone: FolderKanban,
        titre: "Références",
        description: "Réalisations, visuels, descriptifs détaillés et publication sur la page références.",
        couleur: "text-indigo-600 bg-indigo-50",
      },
      {
        chemin: "/administration/statistiques",
        icone: BarChart2,
        titre: "Chiffres clés",
        description: "Encarts statistiques affichés sur la page d'accueil.",
        couleur: "text-cyan-700 bg-cyan-50",
      },
      {
        chemin: "/administration/valeurs",
        icone: Heart,
        titre: "Valeurs et avantages",
        description: "Encarts de réassurance, positionnement et engagement qualité.",
        couleur: "text-rose-600 bg-rose-50",
      },
      {
        chemin: "/administration/demarche",
        icone: Shapes,
        titre: "Démarche",
        description: "Étapes de la méthode d'intervention affichées sur la vitrine.",
        couleur: "text-emerald-600 bg-emerald-50",
      },
    ],
  },
  {
    titre: "Outils transverses",
    description: "Paramètres qui alimentent les contenus, les modèles et les données transversales du bureau.",
    cartes: [
      {
        chemin: "/administration/modeles-documents",
        icone: FileCog,
        titre: "Modèles de documents",
        description: "Gabarits DOCX/ODT, variables de fusion et identité documentaire.",
        couleur: "text-violet-600 bg-violet-50",
      },
      {
        chemin: "/administration/organisations",
        icone: Building2,
        titre: "Organisations",
        description: "Maîtres d'ouvrage, partenaires et structures référencées.",
        couleur: "text-orange-600 bg-orange-50",
      },
      {
        chemin: "/administration/conventions-sociales",
        icone: BriefcaseBusiness,
        titre: "Conventions sociales",
        description: "Règles RH et conventions utilisées par les modules économiques.",
        couleur: "text-teal-700 bg-teal-50",
      },
    ],
  },
];

export default function PageAdministration() {
  const configuration = useConfiguration();
  const nomBureau = obtenirNomPlateforme(configuration) || "le bureau";

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primaire-100">
            <Globe className="h-5 w-5 text-primaire-600" />
          </div>
          <div>
            <h1>Administration de {nomBureau}</h1>
            <p className="mt-1 text-sm text-slate-500">
              Le site public est organisé par thématiques pour centraliser les contenus, preuves et réglages éditoriaux.
            </p>
          </div>
        </div>

        <div className="carte p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
            Accès rapide
          </p>
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-primaire-600 hover:underline"
          >
            Ouvrir le site public
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>

      {RUBRIQUES.map((rubrique) => (
        <section key={rubrique.titre} className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
              {rubrique.titre}
            </p>
            <p className="mt-1 text-sm text-slate-500">{rubrique.description}</p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {rubrique.cartes.map((section) => {
              const Icone = section.icone;
              return (
                <Link
                  key={section.chemin}
                  href={section.chemin}
                  className="carte group p-5 transition-shadow hover:shadow-md"
                >
                  <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${section.couleur}`}>
                    <Icone className="h-5 w-5" />
                  </div>
                  <h2 className="mb-1 text-sm font-semibold text-slate-800 transition-colors group-hover:text-primaire-700">
                    {section.titre}
                  </h2>
                  <p className="text-xs leading-relaxed text-slate-500">
                    {section.description}
                  </p>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
