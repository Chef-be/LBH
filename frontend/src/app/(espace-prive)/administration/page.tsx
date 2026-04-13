"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Activity,
  BarChart2,
  BookOpen,
  BriefcaseBusiness,
  Building2,
  Calculator,
  ChevronRight,
  Cog,
  Edit3,
  FileText,
  FileCog,
  Globe,
  HardHat,
  Heart,
  Link2,
  Mail,
  Settings,
  Shield,
  ShieldCheck,
  Star,
  FolderKanban,
  Shapes,
  Users,
  Zap,
} from "lucide-react";
import { api } from "@/crochets/useApi";
import { useConfiguration } from "@/contextes/FournisseurConfiguration";
import { obtenirNomPlateforme } from "@/lib/site-public";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StatsPlateforme {
  nb_utilisateurs: number;
  nb_projets: number;
  nb_lignes_bibliotheque: number;
  nb_articles_cctp: number;
  nb_lots_cctp: number;
  nb_fonctionnalites_actives: number;
}

interface SectionAdmin {
  titre: string;
  description: string;
  iconeSection: React.ComponentType<{ className?: string }>;
  couleurSection: string;
  cartes: CarteAdmin[];
}

interface CarteAdmin {
  chemin: string;
  externe?: boolean;
  icone: React.ComponentType<{ className?: string }>;
  titre: string;
  description: string;
  couleur: string;
  badge?: string;
}

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const SECTIONS: SectionAdmin[] = [
  {
    titre: "Accès & Sécurité",
    description: "Gestion des comptes, profils et habilitations de la plateforme.",
    iconeSection: Shield,
    couleurSection: "text-violet-600",
    cartes: [
      {
        chemin: "/utilisateurs",
        icone: Users,
        titre: "Utilisateurs",
        description: "Comptes utilisateurs, invitations, activation et droits d'accès.",
        couleur: "text-violet-600 bg-violet-50",
      },
      {
        chemin: "/utilisateurs/nouveau",
        icone: ShieldCheck,
        titre: "Nouvel utilisateur",
        description: "Créer un compte et définir ses habilitations sur la plateforme.",
        couleur: "text-indigo-600 bg-indigo-50",
      },
    ],
  },
  {
    titre: "Paramétrage métier",
    description: "Réglages qui gouvernent les calculs, modules et comportements de la plateforme.",
    iconeSection: Cog,
    couleurSection: "text-primaire-600",
    cartes: [
      {
        chemin: "/parametres",
        icone: Zap,
        titre: "Fonctionnalités & Modules",
        description: "Activer ou désactiver les modules (bibliothèque, webmail, etc.) et paramétrer les valeurs métier.",
        couleur: "text-primaire-600 bg-primaire-50",
      },
      {
        chemin: "/administration/conventions-sociales",
        icone: BriefcaseBusiness,
        titre: "Conventions sociales",
        description: "Règles RH et conventions collectives utilisées par les modules économiques.",
        couleur: "text-teal-700 bg-teal-50",
      },
      {
        chemin: "/administration/organisations",
        icone: Building2,
        titre: "Organisations",
        description: "Maîtres d'ouvrage, partenaires et structures référencées.",
        couleur: "text-orange-600 bg-orange-50",
      },
    ],
  },
  {
    titre: "Bases de données métier",
    description: "Gestion des référentiels techniques au cœur de l'économie de la construction.",
    iconeSection: BookOpen,
    couleurSection: "text-emerald-600",
    cartes: [
      {
        chemin: "/administration/bibliotheque-prix",
        icone: Calculator,
        titre: "Bibliothèque de prix",
        description: "Vue d'ensemble, import de bordereaux, recalcul analytique inversé et liaisons CCTP.",
        couleur: "text-blue-600 bg-blue-50",
      },
      {
        chemin: "/administration/cctp",
        icone: FileText,
        titre: "CCTP — Lots & Articles",
        description: "Gestion des lots CCTP, articles, prescriptions et normes associées.",
        couleur: "text-emerald-600 bg-emerald-50",
      },
      {
        chemin: "/administration/dhmo",
        icone: HardHat,
        titre: "DHMO — Main-d'œuvre",
        description: "Déboursé horaire de main-d'œuvre par type d'ouvrier BTP : salaires, charges, HS, panier, DHMO calculé.",
        couleur: "text-orange-600 bg-orange-50",
      },
      {
        chemin: "/administration/modeles-documents",
        icone: FileCog,
        titre: "Modèles de documents",
        description: "Gabarits DOCX/ODT, variables de fusion et identité documentaire.",
        couleur: "text-violet-600 bg-violet-50",
      },
    ],
  },
  {
    titre: "Site public",
    description: "Contenus éditoriaux, configuration et visibilité du site vitrine.",
    iconeSection: Globe,
    couleurSection: "text-indigo-600",
    cartes: [
      {
        chemin: "/administration/configuration",
        icone: Settings,
        titre: "Configuration générale",
        description: "Identité, coordonnées, SEO, apparence et sections globales du site.",
        couleur: "text-primaire-600 bg-primaire-50",
      },
      {
        chemin: "/administration/contenus-editoriaux",
        icone: Edit3,
        titre: "Contenus éditoriaux",
        description: "Accueil, blocs, accroches et textes riches du site vitrine.",
        couleur: "text-indigo-600 bg-indigo-50",
      },
      {
        chemin: "/administration/prestations",
        icone: Star,
        titre: "Prestations",
        description: "Cartes de prestations, pages détail et contenus longs.",
        couleur: "text-accent-600 bg-amber-50",
      },
      {
        chemin: "/administration/references",
        icone: FolderKanban,
        titre: "Références",
        description: "Réalisations, visuels et descriptifs publiés sur le site.",
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
        titre: "Valeurs",
        description: "Encarts de réassurance et positionnement qualité.",
        couleur: "text-rose-600 bg-rose-50",
      },
      {
        chemin: "/administration/demarche",
        icone: Shapes,
        titre: "Démarche",
        description: "Étapes de la méthode d'intervention affichées sur la vitrine.",
        couleur: "text-emerald-600 bg-emerald-50",
      },
      {
        chemin: "/administration/pages-statiques",
        icone: FileText,
        titre: "Pages institutionnelles",
        description: "Mentions légales, confidentialité, cookies et contenus statiques.",
        couleur: "text-slate-600 bg-slate-100",
      },
      {
        chemin: "/administration/contacts",
        icone: Mail,
        titre: "Demandes de contact",
        description: "Consulter les demandes reçues via le formulaire public.",
        couleur: "text-green-600 bg-green-50",
      },
    ],
  },
  {
    titre: "Supervision & Système",
    description: "Santé des services, tâches de fond et paramétrage technique.",
    iconeSection: Activity,
    couleurSection: "text-rose-600",
    cartes: [
      {
        chemin: "/supervision",
        icone: Activity,
        titre: "Supervision technique",
        description: "État des conteneurs Docker, CPU, mémoire, Redis et alertes système.",
        couleur: "text-rose-600 bg-rose-50",
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Composant compteur
// ---------------------------------------------------------------------------

function Compteur({ valeur, libelle }: { valeur: number | null; libelle: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{libelle}</p>
      <p className="mt-2 text-xl font-bold text-slate-800">
        {valeur === null ? (
          <span className="inline-block h-6 w-12 animate-pulse rounded bg-slate-100" />
        ) : (
          valeur.toLocaleString("fr-FR")
        )}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PageAdministration() {
  const configuration = useConfiguration();
  const nomBureau = obtenirNomPlateforme(configuration) || "la plateforme";
  const [stats, setStats] = useState<Partial<StatsPlateforme>>({});

  useEffect(() => {
    // Utilisateurs
    api.get<{ count?: number; results?: unknown[] }>("/api/auth/utilisateurs/")
      .then((d) => setStats((s) => ({ ...s, nb_utilisateurs: d.count ?? (d.results ?? []).length })))
      .catch(() => {});

    // Bibliothèque
    api.get<{ count?: number }>("/api/bibliotheque/?page_size=1")
      .then((d) => setStats((s) => ({ ...s, nb_lignes_bibliotheque: d.count ?? 0 })))
      .catch(() => {});

    // Lots CCTP
    api.get<{ count?: number; results?: unknown[] }>("/api/pieces-ecrites/lots-cctp/")
      .then((d) => setStats((s) => ({ ...s, nb_lots_cctp: d.count ?? (d.results ?? []).length })))
      .catch(() => {});

    // Articles CCTP
    api.get<{ count?: number }>("/api/pieces-ecrites/articles/?page_size=1")
      .then((d) => setStats((s) => ({ ...s, nb_articles_cctp: d.count ?? 0 })))
      .catch(() => {});

    // Projets
    api.get<{ count?: number }>("/api/projets/?page_size=1")
      .then((d) => setStats((s) => ({ ...s, nb_projets: d.count ?? 0 })))
      .catch(() => {});

    // Fonctionnalités actives
    api.get<{ est_active: boolean }[]>("/api/parametres/fonctionnalites/")
      .then((data) => {
        const liste = Array.isArray(data) ? data : ((data as { results?: { est_active: boolean }[] }).results ?? []);
        setStats((s) => ({
          ...s,
          nb_fonctionnalites_actives: liste.filter((f) => f.est_active).length,
        }));
      })
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-8">
      {/* En-tête */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primaire-100">
            <Shield className="h-6 w-6 text-primaire-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Administration</h1>
            <p className="mt-1 text-sm text-slate-500">
              Pilotage complet de {nomBureau} — accès, paramétrage, référentiels, site public et supervision.
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition-colors hover:border-primaire-300 hover:text-primaire-700"
          >
            <Globe className="h-3.5 w-3.5" />
            Site public
            <ChevronRight className="h-3.5 w-3.5 opacity-50" />
          </a>
          <Link
            href="/supervision"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition-colors hover:border-rose-300 hover:text-rose-700"
          >
            <Activity className="h-3.5 w-3.5" />
            Supervision
          </Link>
        </div>
      </div>

      {/* Compteurs globaux */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <Compteur valeur={stats.nb_utilisateurs ?? null} libelle="Utilisateurs" />
        <Compteur valeur={stats.nb_projets ?? null} libelle="Projets" />
        <Compteur valeur={stats.nb_lignes_bibliotheque ?? null} libelle="Lignes de prix" />
        <Compteur valeur={stats.nb_articles_cctp ?? null} libelle="Articles CCTP" />
        <Compteur valeur={stats.nb_lots_cctp ?? null} libelle="Lots CCTP" />
        <Compteur valeur={stats.nb_fonctionnalites_actives ?? null} libelle="Modules actifs" />
      </div>

      {/* Sections */}
      {SECTIONS.map((section) => {
        const IconeSection = section.iconeSection;
        return (
          <section key={section.titre} className="space-y-4">
            {/* Titre de section */}
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <IconeSection className={`h-4 w-4 ${section.couleurSection}`} />
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">
                  {section.titre}
                </p>
                <p className="mt-0.5 text-xs text-slate-400">{section.description}</p>
              </div>
            </div>

            {/* Grille de cartes */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {section.cartes.map((carte) => {
                const Icone = carte.icone;
                return (
                  <Link
                    key={carte.chemin}
                    href={carte.chemin}
                    target={carte.externe ? "_blank" : undefined}
                    rel={carte.externe ? "noopener noreferrer" : undefined}
                    className="groupe carte group flex items-start gap-4 p-5 transition-all hover:shadow-md hover:border-primaire-200"
                  >
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${carte.couleur}`}
                    >
                      <Icone className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h2 className="text-sm font-semibold text-slate-800 transition-colors group-hover:text-primaire-700">
                          {carte.titre}
                        </h2>
                        {carte.badge && (
                          <span className="shrink-0 rounded-full bg-primaire-100 px-2 py-0.5 text-[11px] font-semibold text-primaire-700">
                            {carte.badge}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-slate-500">
                        {carte.description}
                      </p>
                    </div>
                    <Link2 className="h-4 w-4 shrink-0 text-slate-300 transition-colors group-hover:text-primaire-400" />
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
