"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { useConfiguration } from "@/contextes/FournisseurConfiguration";
import { api, extraireListeResultats } from "@/crochets/useApi";
import {
  LayoutDashboard, FolderKanban, BookOpen, FileEdit, Settings,
  Activity, Globe, Users, Mail,
  ChevronLeft, Menu,
} from "lucide-react";
import { obtenirMarqueAffichee, obtenirNomPlateforme } from "@/lib/site-public";

interface EntreeMenu {
  libelle: string;
  chemin: string;
  icone: React.ComponentType<{ className?: string; size?: number }>;
  codeModule?: string;
  nouvelOnglet?: boolean;
}

interface GroupeMenu {
  titre: string;
  entrees: EntreeMenu[];
}

const GROUPES_MENU: GroupeMenu[] = [
  {
    titre: "Pilotage",
    entrees: [
      { libelle: "Tableau de bord", chemin: "/tableau-de-bord", icone: LayoutDashboard },
      { libelle: "Projets", chemin: "/projets", icone: FolderKanban },
    ],
  },
  {
    titre: "Bibliothèques",
    entrees: [
      { libelle: "Bibliothèque", chemin: "/bibliotheque", icone: BookOpen, codeModule: "BIBLIOTHEQUE_PRIX" },
    ],
  },
  {
    titre: "Communication",
    entrees: [
      { libelle: "Messagerie", chemin: "/webmail", icone: Mail, codeModule: "MODULE_WEBMAIL" },
    ],
  },
];

const GROUPE_ADMIN: GroupeMenu = {
  titre: "Administration",
  entrees: [
    { libelle: "Site public", chemin: "/", icone: Globe, nouvelOnglet: true },
    { libelle: "Contenus du site", chemin: "/administration", icone: Settings },
    { libelle: "Modèles de documents", chemin: "/administration/modeles-documents", icone: FileEdit },
    { libelle: "Utilisateurs", chemin: "/utilisateurs", icone: Users },
    { libelle: "Supervision", chemin: "/supervision", icone: Activity },
    { libelle: "Paramètres", chemin: "/parametres", icone: Settings },
  ],
};

export function MenuLateral() {
  const chemin = usePathname();
  const config = useConfiguration();
  const nomBureau = obtenirNomPlateforme(config);
  const marque = obtenirMarqueAffichee(config);
  const [reduit, setReduit] = useState(false);
  const [modulesActifs, setModulesActifs] = useState<Record<string, boolean> | null>(null);

  useEffect(() => {
    // Restaurer l'état du menu depuis localStorage
    const sauvegarde = localStorage.getItem("lbh-menu-reduit");
    if (sauvegarde === "1") setReduit(true);
  }, []);

  useEffect(() => {
    api.get<{ code: string; est_active: boolean }[]>("/api/parametres/fonctionnalites/")
      .then((data) => {
        const map: Record<string, boolean> = {};
        extraireListeResultats(data).forEach((f) => { map[f.code] = f.est_active; });
        setModulesActifs(map);
      })
      .catch(() => setModulesActifs({}));
  }, []);

  const basculerMenu = () => {
    const nouvel = !reduit;
    setReduit(nouvel);
    localStorage.setItem("lbh-menu-reduit", nouvel ? "1" : "0");
  };

  const estActif = (c: string) => chemin === c || chemin.startsWith(c + "/");
  const estVisible = (e: EntreeMenu) => {
    if (!e.codeModule) return true;
    if (modulesActifs === null) return true;
    return modulesActifs[e.codeModule] !== false;
  };

  return (
    <nav
      className={clsx(
        "flex flex-col h-full shrink-0 transition-all duration-200 relative",
        reduit ? "w-16" : "w-64"
      )}
      style={{
        background: "var(--menu-fond)",
        boxShadow: "var(--ombre-menu)",
      }}
      aria-label="Navigation principale"
    >
      {/* Logo */}
      <div
        className={clsx(
          "shrink-0 px-4 py-4",
          reduit ? "flex flex-col items-center gap-3" : "flex items-center justify-between"
        )}
        style={{ borderBottom: "1px solid var(--menu-sep)" }}
      >
        {!reduit && (
          <Link href="/tableau-de-bord" className="flex items-center gap-3 min-w-0">
            {config.logo ? (
              <Image
                src={config.logo}
                alt={nomBureau || "Logo"}
                width={40}
                height={40}
                className="h-10 w-10 rounded-lg object-contain shrink-0"
                loading="eager"
                unoptimized
              />
            ) : marque ? (
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-white shrink-0"
                style={{ background: "var(--c-base)" }}
              >
                {marque}
              </div>
            ) : (
              <div className="w-8 h-8 rounded-lg border" style={{ borderColor: "var(--menu-sep)" }} />
            )}
            <div className="min-w-0">
              {nomBureau && <p className="text-sm font-semibold text-white truncate">{nomBureau}</p>}
              {config.slogan && (
                <p className="text-xs truncate" style={{ color: "var(--menu-texte)" }}>
                  {config.slogan}
                </p>
              )}
            </div>
          </Link>
        )}
        {reduit && (
          <Link
            href="/tableau-de-bord"
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            title={nomBureau || "Accueil"}
            style={{ background: config.logo ? "transparent" : "var(--c-base)" }}
          >
            {config.logo ? (
              <Image
                src={config.logo}
                alt={nomBureau || "Logo"}
                width={32}
                height={32}
                className="h-8 w-8 object-contain"
                loading="eager"
                unoptimized
              />
            ) : (
              <span className="text-sm font-bold text-white">{marque || " "}</span>
            )}
          </Link>
        )}
        <button
          onClick={basculerMenu}
          className={clsx(
            "flex items-center justify-center w-7 h-7 rounded-lg transition-colors shrink-0",
            reduit && "mx-auto"
          )}
          style={{ color: "var(--menu-texte)" }}
          title={reduit ? "Déployer le menu" : "Réduire le menu"}
        >
          {reduit ? <Menu size={15} /> : <ChevronLeft size={15} />}
        </button>
      </div>

      {/* Liens */}
      <div className="flex-1 overflow-y-auto py-3 px-2">
        {[...GROUPES_MENU, GROUPE_ADMIN].map((groupe, index) => {
          const entreesVisibles = groupe.entrees.filter(estVisible);
          if (entreesVisibles.length === 0) return null;

          return (
            <div key={groupe.titre} className={clsx(index > 0 && "mt-4")}>
              {!reduit && (
                <p
                  className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider"
                  style={{ color: "var(--menu-sep)" }}
                >
                  {groupe.titre}
                </p>
              )}
              {reduit && index > 0 && (
                <div className="my-3" style={{ borderTop: "1px solid var(--menu-sep)" }} />
              )}

              <ul className="space-y-0.5">
                {entreesVisibles.map((e) => {
                  const Ic = e.icone;
                  const actif = estActif(e.chemin);
                  const libelle = e.chemin === "/" && nomBureau ? nomBureau : e.libelle;
                  return (
                    <li key={e.chemin}>
                      <Link
                        href={e.chemin}
                        target={e.nouvelOnglet ? "_blank" : undefined}
                        rel={e.nouvelOnglet ? "noopener noreferrer" : undefined}
                        title={reduit ? libelle : undefined}
                        className={clsx(
                          "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150",
                          reduit && "justify-center px-2"
                        )}
                        style={{
                          background: actif ? "var(--menu-actif)" : "transparent",
                          color: actif ? "var(--menu-texte-a)" : "var(--menu-texte)",
                          fontWeight: actif ? "500" : "400",
                        }}
                        onMouseEnter={(el) => {
                          if (!actif) el.currentTarget.style.background = "var(--menu-survol)";
                        }}
                        onMouseLeave={(el) => {
                          if (!actif) el.currentTarget.style.background = "transparent";
                        }}
                      >
                        <Ic size={16} className="shrink-0" />
                        {!reduit && <span className="truncate">{libelle}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </nav>
  );
}
