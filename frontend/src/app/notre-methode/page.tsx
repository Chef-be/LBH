import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight, CheckCircle, Search, PenTool, BarChart3, FileText,
  Wrench, ClipboardCheck,
} from "lucide-react";
import { NavigationPublique } from "@/composants/site-public/NavigationPublique";
import { PiedDePage } from "@/composants/site-public/PiedDePage";
import { CONFIGURATION_PAR_DEFAUT } from "@/contextes/FournisseurConfiguration";
import type { ConfigurationSite } from "@/contextes/FournisseurConfiguration";
import {
  convertirContenuRicheEnHtml,
  normaliserConfigurationSite,
  obtenirContenuNotreMethode,
} from "@/lib/site-public";

export const dynamic = "force-dynamic";

const URL_BACKEND = process.env.URL_BACKEND || "http://bee-backend:8000";
const URL_BASE_PUBLIQUE = process.env.URL_BASE || process.env.NEXTAUTH_URL || "";

async function chargerConfig(): Promise<ConfigurationSite> {
  try {
    const res = await fetch(`${URL_BACKEND}/api/site/configuration/`, { cache: "no-store" });
    return res.ok
      ? normaliserConfigurationSite(await res.json(), URL_BASE_PUBLIQUE)
      : CONFIGURATION_PAR_DEFAUT;
  } catch { return CONFIGURATION_PAR_DEFAUT; }
}

export async function generateMetadata(): Promise<Metadata> {
  const config = await chargerConfig();
  const nom = config.nom_bureau;
  const contenuMethode = obtenirContenuNotreMethode(config);
  return {
    title: nom
      ? `${contenuMethode.metadata.titre_page} | ${nom}`
      : contenuMethode.metadata.titre_page,
    description: nom
      ? contenuMethode.metadata.description_page.replace("notre", `la`)
      : contenuMethode.metadata.description_page,
  };
}

const ICONES_PHASES = {
  Search,
  PenTool,
  BarChart3,
  FileText,
  Wrench,
  ClipboardCheck,
};

export default async function PageNotreMethode() {
  const config = await chargerConfig();
  const nomBureau = config.nom_bureau;
  const contenuMethode = obtenirContenuNotreMethode(config);
  const descriptionHeroHtml = convertirContenuRicheEnHtml(contenuMethode.hero.description);
  const descriptionReferentielsHtml = convertirContenuRicheEnHtml(contenuMethode.referentiels.description);
  const descriptionCtaHtml = convertirContenuRicheEnHtml(contenuMethode.cta.description);

  return (
    <div className="min-h-screen bg-white">
      <NavigationPublique config={config} />

      {/* En-tête */}
      <section className="pt-32 pb-20 bg-ardoise-900 relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="badge-section-clair">{contenuMethode.hero.badge}</div>
          <h1 className="text-4xl sm:text-5xl font-bold text-white tracking-tight mb-4">
            {contenuMethode.hero.titre}
          </h1>
          <div
            className="mx-auto max-w-2xl text-xl text-ardoise-300 [&_p]:mb-4 last:[&_p]:mb-0"
            dangerouslySetInnerHTML={{ __html: descriptionHeroHtml }}
          />
        </div>
        <div
          aria-hidden
          className="absolute bottom-0 left-0 right-0 h-10 bg-white"
          style={{ clipPath: "ellipse(60% 100% at 50% 100%)" }}
        />
      </section>

      {/* Engagements clés */}
      <section className="py-14 bg-white border-b border-ardoise-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
            {contenuMethode.engagements.liste.map((item) => (
              <div key={item.libelle} className="py-8 px-4 rounded-2xl bg-ardoise-50 border border-ardoise-100">
                <div className="text-4xl font-bold text-primaire-600 mb-2">{item.valeur}</div>
                <p className="text-ardoise-500 text-sm">{item.libelle}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Phases de travail */}
      <section className="py-24 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="badge-section">{contenuMethode.phases.badge}</div>
            <h2 className="titre-section">{contenuMethode.phases.titre}</h2>
          </div>

          <div className="space-y-6">
            {contenuMethode.phases.liste.map((phase) => {
              const I = ICONES_PHASES[phase.icone as keyof typeof ICONES_PHASES];
              return (
                <div
                  key={phase.numero}
                  className="grid grid-cols-1 md:grid-cols-5 gap-6 p-7 rounded-2xl bg-ardoise-50 border border-ardoise-100 hover:border-primaire-200 hover:shadow-carte-lg transition-all"
                >
                  <div className="md:col-span-2 flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-primaire-600 text-white flex items-center justify-center shrink-0">
                      <I className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-primaire-500 uppercase tracking-wider mb-1">
                        Phase {phase.numero}
                      </div>
                      <h3 className="text-lg font-bold text-ardoise-900">{phase.titre}</h3>
                    </div>
                  </div>
                  <div className="md:col-span-3">
                    <div
                      className="mb-4 text-sm leading-relaxed text-ardoise-500 [&_p]:mb-4 last:[&_p]:mb-0"
                      dangerouslySetInnerHTML={{ __html: convertirContenuRicheEnHtml(phase.description) }}
                    />
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {phase.points.map((point) => (
                        <li key={point} className="flex items-start gap-2 text-xs text-ardoise-600">
                          <CheckCircle className="w-3.5 h-3.5 text-primaire-500 shrink-0 mt-0.5" aria-hidden />
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Référentiels techniques */}
      <section className="py-20 bg-ardoise-900">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="badge-section-clair">{contenuMethode.referentiels.badge}</div>
            <h2 className="titre-section-clair">{contenuMethode.referentiels.titre}</h2>
            <div
              className="sous-titre-section-clair [&_p]:mb-4 last:[&_p]:mb-0"
              dangerouslySetInnerHTML={{ __html: descriptionReferentielsHtml }}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {contenuMethode.referentiels.liste.map((ref) => (
              <div key={ref.titre} className="bg-ardoise-800/60 border border-ardoise-700 rounded-xl p-5">
                <h3 className="font-semibold text-accent-400 mb-2 text-sm">{ref.titre}</h3>
                <p className="text-ardoise-400 text-sm leading-relaxed">{ref.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-white border-t border-ardoise-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="titre-section mb-4">{contenuMethode.cta.titre}</h2>
          <div
            className="sous-titre-section mb-8 [&_p]:mb-4 last:[&_p]:mb-0"
            dangerouslySetInnerHTML={{ __html: descriptionCtaHtml }}
          />
          <div className="flex flex-wrap gap-3 justify-center">
            <Link href="/contact" className="btn-accent px-7 py-3 text-base">
              {contenuMethode.cta.bouton_principal} <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/prestations" className="btn-secondaire px-7 py-3 text-base">
              {contenuMethode.cta.bouton_secondaire}
            </Link>
          </div>
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
