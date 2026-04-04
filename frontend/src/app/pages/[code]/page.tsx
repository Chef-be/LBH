import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { NavigationPublique } from "@/composants/site-public/NavigationPublique";
import { PiedDePage } from "@/composants/site-public/PiedDePage";
import { CONFIGURATION_PAR_DEFAUT } from "@/contextes/FournisseurConfiguration";
import type { ConfigurationSite } from "@/contextes/FournisseurConfiguration";
import { ArrowLeft, Calendar } from "lucide-react";
import { normaliserConfigurationSite, obtenirNomPlateforme } from "@/lib/site-public";

export const dynamic = "force-dynamic";

interface PageStatique {
  id: string;
  code: string;
  titre: string;
  contenu: string;
  est_publiee: boolean;
  date_modification: string;
}

const URL_BACKEND = process.env.URL_BACKEND || "http://lbh-backend:8000";
const URL_BASE_PUBLIQUE = process.env.URL_BASE || process.env.NEXTAUTH_URL || "";

async function chargerPage(code: string): Promise<{ config: ConfigurationSite; page: PageStatique | null }> {
  try {
    const [resConfig, resPage] = await Promise.all([
      fetch(`${URL_BACKEND}/api/site/configuration/`, { cache: "no-store" }),
      fetch(`${URL_BACKEND}/api/site/pages/${code}/`, { cache: "no-store" }),
    ]);
    const config = resConfig.ok
      ? normaliserConfigurationSite(await resConfig.json(), URL_BASE_PUBLIQUE)
      : CONFIGURATION_PAR_DEFAUT;
    const page = resPage.ok ? await resPage.json() : null;
    return { config, page };
  } catch {
    return { config: CONFIGURATION_PAR_DEFAUT, page: null };
  }
}

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  const { page, config } = await chargerPage(code);
  if (!page) return { title: "Page introuvable" };
  const nom = obtenirNomPlateforme(config);
  return {
    title: nom ? `${page.titre} | ${nom}` : page.titre,
  };
}

export default async function PageStatiquePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const { config, page } = await chargerPage(code);

  if (!page) notFound();

  const nomBureau = obtenirNomPlateforme(config);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <div className="min-h-screen bg-white">
      <NavigationPublique config={config} />

      {/* En-tête */}
      <section className="pt-32 pb-16 bg-ardoise-900 relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-ardoise-400 hover:text-ardoise-200 text-sm mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour au site
          </Link>
          <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
            {page.titre}
          </h1>
          <div className="flex items-center gap-2 mt-3 text-ardoise-400 text-sm">
            <Calendar className="w-4 h-4" />
            Mise à jour le {formatDate(page.date_modification)}
          </div>
        </div>
        <div
          aria-hidden
          className="absolute bottom-0 left-0 right-0 h-8 bg-white"
          style={{ clipPath: "ellipse(60% 100% at 50% 100%)" }}
        />
      </section>

      {/* Contenu */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div
            className="prose prose-slate max-w-none
              prose-headings:font-bold prose-headings:text-ardoise-900
              prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-3
              prose-h3:text-base prose-h3:mt-6 prose-h3:mb-2
              prose-p:text-ardoise-600 prose-p:leading-relaxed
              prose-a:text-primaire-600 prose-a:no-underline hover:prose-a:underline
              prose-strong:text-ardoise-800
              prose-ul:text-ardoise-600 prose-li:my-1"
            dangerouslySetInnerHTML={{ __html: page.contenu }}
          />

          {!page.contenu && (
            <div className="text-center py-16 text-ardoise-400">
              <p className="text-lg font-medium">Cette page est en cours de rédaction.</p>
              <p className="text-sm mt-2">Contactez-nous pour toute question.</p>
              <Link href="/contact" className="mt-6 inline-block btn-primaire">
                Nous contacter
              </Link>
            </div>
          )}
        </div>
      </section>

      <PiedDePage
        nomBureau={nomBureau}
        slogan={config.slogan}
        sigle={config.sigle}
        descriptionCourte={config.description_courte}
        logo={config.logo}
        logoPiedDePage={config.logo_pied_de_page}
        courriel={config.courriel_contact}
        telephone={config.telephone_contact}
        ville={config.ville}
      />
    </div>
  );
}
