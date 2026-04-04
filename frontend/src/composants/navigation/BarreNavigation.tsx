"use client";

import { useRouter, usePathname } from "next/navigation";
import { LogOut, Sun, Moon, Monitor, ChevronRight } from "lucide-react";
import { useSessionStore } from "@/crochets/useSession";
import { useTheme } from "@/contextes/FournisseurTheme";
import type { ModeTheme } from "@/contextes/FournisseurConfiguration";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Fil d'Ariane automatique
// ---------------------------------------------------------------------------

const LIBELLES: Record<string, string> = {
  "tableau-de-bord": "Tableau de bord",
  projets: "Projets", nouveau: "Nouveau", modifier: "Modifier",
  documents: "Documents", metres: "Métrés",
  economie: "Économie", bibliotheque: "Bibliothèque de prix",
  "etudes-de-prix": "Études de prix",
  "pilotage-activite": "Pilotage d'activité",
  voirie: "Voirie", batiment: "Bâtiment",
  "pieces-ecrites": "Pièces écrites", "appels-offres": "Appels d'offres",
  execution: "Exécution", supervision: "Supervision",
  parametres: "Paramètres", administration: "Administration",
  "couts-main-oeuvre": "Paramétrage main-d'œuvre",
  "contenus-editoriaux": "Contenus éditoriaux",
  configuration: "Configuration", prestations: "Prestations",
  references: "Références",
  statistiques: "Chiffres clés", valeurs: "Valeurs",
  demarche: "Démarche", "pages-statiques": "Pages légales",
  organisations: "Organisations", contacts: "Contacts", "mon-profil": "Mon profil",
  utilisateurs: "Utilisateurs", nouvelle: "Nouvelle",
};

function FilAriane() {
  const chemin = usePathname();
  const segments = chemin.split("/").filter(Boolean);

  // Exclure les UUIDs (pas de libellé lisible)
  const estUuid = (s: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

  const parties = [];
  const segmentsCumules: string[] = [];
  for (const segment of segments) {
    segmentsCumules.push(segment);
    if (estUuid(segment)) continue;
    parties.push({
      libelle: LIBELLES[segment] ?? segment,
      href: `/${segmentsCumules.join("/")}`,
    });
  }

  return (
    <nav className="hidden sm:flex items-center gap-1 text-xs" style={{ color: "var(--texte-3)" }}>
      {parties.map((partie, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight size={11} />}
          {i === parties.length - 1 ? (
            <span
              className="font-medium"
              style={{ color: "var(--texte-2)" }}
            >
              {partie.libelle}
            </span>
          ) : (
            <Link
              href={partie.href}
              className="transition-colors hover:underline"
              style={{ color: "var(--texte-3)" }}
            >
              {partie.libelle}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Bascule de thème
// ---------------------------------------------------------------------------

function BasculeTheme() {
  const { modePreference, definirMode } = useTheme();

  const options: { valeur: ModeTheme; icone: React.ReactNode; titre: string }[] = [
    { valeur: "clair",       icone: <Sun size={14} />,     titre: "Mode clair" },
    { valeur: "automatique", icone: <Monitor size={14} />, titre: "Automatique" },
    { valeur: "sombre",      icone: <Moon size={14} />,    titre: "Mode sombre" },
  ];

  return (
    <div
      className="flex items-center rounded-lg p-0.5 gap-0.5"
      style={{ background: "var(--fond-app)", border: "1px solid var(--bordure)" }}
    >
      {options.map(({ valeur, icone, titre }) => (
        <button
          key={valeur}
          onClick={() => definirMode(valeur)}
          title={titre}
          className="flex items-center justify-center w-7 h-7 rounded-md transition-all duration-150"
          style={{
            background: modePreference === valeur ? "var(--fond-carte)" : "transparent",
            color: modePreference === valeur ? "var(--c-base)" : "var(--texte-3)",
            boxShadow: modePreference === valeur ? "var(--ombre-carte)" : "none",
          }}
        >
          {icone}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Composant principal
// ---------------------------------------------------------------------------

export function BarreNavigation() {
  const router = useRouter();
  const { utilisateur, deconnecter } = useSessionStore();

  const gererDeconnexion = async () => {
    await deconnecter();
    router.push("/connexion");
  };

  // Initiales pour l'avatar
  const initiales = utilisateur?.nom_complet
    ? utilisateur.nom_complet.split(" ").map((m) => m[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  return (
    <header
      className="h-14 flex items-center justify-between px-4 sm:px-6 gap-4 shrink-0 z-20"
      style={{
        background: "var(--barre-fond)",
        borderBottom: "1px solid var(--barre-bord)",
      }}
    >
      {/* Titre / fil d'Ariane */}
      <div className="flex items-center gap-3 min-w-0">
        <FilAriane />
      </div>

      {/* Actions droite */}
      <div className="flex items-center gap-3 shrink-0">
        <BasculeTheme />

        {utilisateur && (
          <div className="flex items-center gap-2">
            <Link href="/mon-profil" className="flex items-center gap-2 rounded-xl px-2 py-1.5 transition-colors hover:bg-black/5">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0"
                style={{ background: "var(--c-base)" }}
                title={utilisateur.nom_complet}
              >
                {initiales}
              </div>

              <div className="hidden md:block text-right">
                <p className="text-sm font-medium leading-none" style={{ color: "var(--texte)" }}>
                  {utilisateur.nom_complet}
                </p>
                {utilisateur.profil_libelle && (
                  <p className="text-xs mt-0.5" style={{ color: "var(--texte-3)" }}>
                    {utilisateur.profil_libelle}
                  </p>
                )}
              </div>
            </Link>

            {/* Déconnexion */}
            <button
              onClick={gererDeconnexion}
              className="flex items-center gap-1.5 text-sm px-2 py-1.5 rounded-lg transition-colors"
              style={{ color: "var(--texte-3)" }}
              title="Se déconnecter"
              onMouseEnter={(e) => (e.currentTarget.style.color = "#dc2626")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--texte-3)")}
            >
              <LogOut size={15} />
              <span className="hidden sm:inline">Déconnexion</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
