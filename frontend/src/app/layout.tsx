import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { FournisseurRequetes } from "@/contextes/FournisseurRequetes";
import { FournisseurNotifications } from "@/contextes/FournisseurNotifications";
import { FournisseurConfiguration } from "@/contextes/FournisseurConfiguration";
import { FournisseurTheme } from "@/contextes/FournisseurTheme";
import type { ConfigurationSite } from "@/contextes/FournisseurConfiguration";
import { normaliserConfigurationSite, obtenirContenuAccueil, obtenirNomPlateforme } from "@/lib/site-public";
import { PageMaintenance } from "@/composants/site-public/PageMaintenance";

export const dynamic = "force-dynamic";

const inter = Inter({ subsets: ["latin"] });

const URL_BACKEND_INTERNE = process.env.URL_BACKEND || "http://lbh-backend:8000";
const URL_BASE_PUBLIQUE = process.env.URL_BASE || process.env.NEXTAUTH_URL || "";

async function chargerConfiguration(): Promise<ConfigurationSite | null> {
  try {
    const reponse = await fetch(`${URL_BACKEND_INTERNE}/api/site/configuration/`, {
      cache: "no-store",
    });
    if (!reponse.ok) return null;
    const configuration = await reponse.json();
    return normaliserConfigurationSite(configuration, URL_BASE_PUBLIQUE);
  } catch {
    return null;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const config = await chargerConfiguration();
  if (!config) {
    return {
      title: "Maintenance en cours",
      description: "Le site est momentanément indisponible.",
    };
  }
  const nom = obtenirNomPlateforme(config);
  const contenuAccueil = obtenirContenuAccueil(config);
  const titreDefaut = config.meta_titre || nom || contenuAccueil.metadata.titre_par_defaut;
  return {
    title: {
      default: titreDefaut,
      template: nom ? `%s | ${nom}` : "%s",
    },
    description: config.meta_description || contenuAccueil.metadata.description_par_defaut,
    icons: config.favicon ? {
      icon: config.favicon,
      shortcut: config.favicon,
      apple: config.favicon,
    } : undefined,
  };
}

export default async function MiseEnPageRacine({
  children,
}: {
  children: React.ReactNode;
}) {
  const configuration = await chargerConfiguration();
  if (!configuration) {
    return (
      <html lang="fr" suppressHydrationWarning>
        <body className={inter.className}>
          <PageMaintenance afficherLienAccueil={false} />
        </body>
      </html>
    );
  }
  const scriptInitialisationTheme = `
    (() => {
      const html = document.documentElement;
      const prefSauvegardee = localStorage.getItem("lbh-mode-theme");
      const pref = prefSauvegardee || ${JSON.stringify(configuration.mode_theme_defaut ?? "automatique")};
      const estSombre = pref === "sombre" || (
        pref === "automatique" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
      );
      html.classList.toggle("sombre", estSombre);
      html.classList.toggle("dark", estSombre);
    })();
  `;

  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: scriptInitialisationTheme }} />
      </head>
      <body className={inter.className}>
        <FournisseurConfiguration configuration={configuration}>
          <FournisseurTheme
            couleurTheme={configuration.couleur_theme ?? "bleu_marine"}
            modeDefaut={configuration.mode_theme_defaut ?? "automatique"}
            police={configuration.police_principale ?? "inter"}
          >
            <FournisseurRequetes>
              <FournisseurNotifications>
                {children}
              </FournisseurNotifications>
            </FournisseurRequetes>
          </FournisseurTheme>
        </FournisseurConfiguration>
      </body>
    </html>
  );
}
