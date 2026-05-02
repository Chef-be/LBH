"use client";

// Composant NavigationProjet : barre de navigation horizontale interne au projet.
// Affiche des onglets vers les modules du projet avec indication de l'onglet actif.

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart2, BookText, Building2, CalendarRange, FileText, FolderOpen,
  Gavel, HardHat, LayoutDashboard, Ruler, TrendingUp,
} from "lucide-react";

interface OngletProjet {
  id: string;
  libelle: string;
  icone: React.ComponentType<{ className?: string }>;
  href: string;
  badge?: number;
}

export interface ModuleActifProjetNavigation {
  code: string;
  libelle: string;
  actif: boolean;
  niveau_pertinence?: "obligatoire" | "recommande" | "optionnel" | "masque" | string;
  ordre?: number;
}

interface NavigationProjetProps {
  idProjet: string;
  modulesActifs?: ModuleActifProjetNavigation[];
  contexte?: {
    afficherEconomie?: boolean;
    afficherMetres?: boolean;
    afficherPiecesEcrites?: boolean;
    afficherAppelsOffres?: boolean;
    afficherPlanning?: boolean;
    afficherExecution?: boolean;
    afficherRentabilite?: boolean;
    afficherVoirie?: boolean;
    afficherBatiment?: boolean;
    nbMetres?: number;
    nbPiecesEcrites?: number;
    nbDocuments?: number;
  };
}

export function NavigationProjet({ idProjet, modulesActifs, contexte = {} }: NavigationProjetProps) {
  const pathname = usePathname();

  const modulesBackend = new Set((modulesActifs || []).filter((m) => m.actif !== false).map((m) => m.code));
  const utiliserModulesBackend = Boolean(modulesActifs && modulesActifs.length > 0);

  const {
    afficherEconomie: afficherEconomieLocal = true,
    afficherMetres: afficherMetresLocal = true,
    afficherPiecesEcrites: afficherPiecesEcritesLocal = true,
    afficherAppelsOffres: afficherAppelsOffresLocal = true,
    afficherPlanning: afficherPlanningLocal = true,
    afficherExecution: afficherExecutionLocal = true,
    afficherRentabilite: afficherRentabiliteLocal = false,
    afficherVoirie: afficherVoirieLocal = false,
    afficherBatiment: afficherBatimentLocal = false,
    nbMetres,
    nbPiecesEcrites,
    nbDocuments,
  } = contexte;
  const afficherEconomie = utiliserModulesBackend ? modulesBackend.has("economie") : afficherEconomieLocal;
  const afficherMetres = utiliserModulesBackend ? modulesBackend.has("metres") : afficherMetresLocal;
  const afficherPiecesEcrites = utiliserModulesBackend ? modulesBackend.has("pieces-ecrites") : afficherPiecesEcritesLocal;
  const afficherAppelsOffres = utiliserModulesBackend ? modulesBackend.has("appels-offres") : afficherAppelsOffresLocal;
  const afficherPlanning = utiliserModulesBackend ? modulesBackend.has("planning") : afficherPlanningLocal;
  const afficherExecution = utiliserModulesBackend ? modulesBackend.has("execution") : afficherExecutionLocal;
  const afficherRentabilite = utiliserModulesBackend ? modulesBackend.has("rentabilite") : afficherRentabiliteLocal;
  const afficherVoirie = utiliserModulesBackend ? modulesBackend.has("voirie") : afficherVoirieLocal;
  const afficherBatiment = utiliserModulesBackend ? modulesBackend.has("batiment") : afficherBatimentLocal;

  const onglets: OngletProjet[] = [
    {
      id: "vue-ensemble",
      libelle: "Vue d'ensemble",
      icone: LayoutDashboard,
      href: `/projets/${idProjet}`,
    },
    ...(afficherEconomie ? [{
      id: "economie",
      libelle: "Économie",
      icone: BarChart2,
      href: `/projets/${idProjet}/economie`,
    }] : []),
    ...(afficherRentabilite ? [{
      id: "rentabilite",
      libelle: "Rentabilité",
      icone: TrendingUp,
      href: `/projets/${idProjet}/rentabilite`,
    }] : []),
    ...(afficherMetres ? [{
      id: "metres",
      libelle: "Métrés",
      icone: Ruler,
      href: `/projets/${idProjet}/metres`,
      badge: nbMetres,
    }] : []),
    ...(afficherPiecesEcrites ? [{
      id: "pieces-ecrites",
      libelle: "Pièces écrites",
      icone: BookText,
      href: `/projets/${idProjet}/pieces-ecrites`,
      badge: nbPiecesEcrites,
    }] : []),
    ...(afficherPlanning ? [{
      id: "planning",
      libelle: "Planning",
      icone: CalendarRange,
      href: `/projets/${idProjet}/planning`,
    }] : []),
    {
      id: "documents",
      libelle: "Documents",
      icone: FolderOpen,
      href: `/projets/${idProjet}/documents`,
      badge: nbDocuments,
    },
    ...(afficherAppelsOffres ? [{
      id: "appels-offres",
      libelle: "Appels d'offres",
      icone: Gavel,
      href: `/projets/${idProjet}/appels-offres`,
    }] : []),
    ...(afficherExecution ? [{
      id: "execution",
      libelle: "Exécution",
      icone: HardHat,
      href: `/projets/${idProjet}/execution`,
    }] : []),
    ...(afficherVoirie ? [{
      id: "voirie",
      libelle: "Voirie",
      icone: Building2,
      href: `/projets/${idProjet}/voirie`,
    }] : []),
    ...(afficherBatiment ? [{
      id: "batiment",
      libelle: "Bâtiment",
      icone: FileText,
      href: `/projets/${idProjet}/batiment`,
    }] : []),
  ];

  return (
    <nav
      aria-label="Navigation du projet"
      className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm scrollbar-none"
    >
      {onglets.map((onglet) => {
        const Icone = onglet.icone;
        // L'onglet "Vue d'ensemble" est actif uniquement sur la page exacte du projet
        const estActif =
          onglet.id === "vue-ensemble"
            ? pathname === `/projets/${idProjet}`
            : pathname.startsWith(onglet.href);

        return (
          <Link
            key={onglet.id}
            href={onglet.href}
            className={`
              relative flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors
              ${estActif
                ? "bg-primaire-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }
            `}
            aria-current={estActif ? "page" : undefined}
          >
            <Icone className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">{onglet.libelle}</span>
            {onglet.badge !== undefined && onglet.badge > 0 && (
              <span
                className={`
                  ml-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-[10px] font-bold
                  ${estActif ? "bg-white/20 text-white" : "bg-primaire-100 text-primaire-700"}
                `}
              >
                {onglet.badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
