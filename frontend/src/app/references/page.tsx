import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Building2, MapPin, Calendar } from "lucide-react";
import { NavigationPublique } from "@/composants/site-public/NavigationPublique";
import { PiedDePage } from "@/composants/site-public/PiedDePage";
import { CONFIGURATION_PAR_DEFAUT } from "@/contextes/FournisseurConfiguration";
import type { ConfigurationSite } from "@/contextes/FournisseurConfiguration";
import {
  convertirContenuRicheEnHtml,
  normaliserConfigurationSite,
  obtenirContenuReferences,
} from "@/lib/site-public";

export const dynamic = "force-dynamic";

interface Realisation {
  id: string;
  titre: string;
  description: string;
  client: string;
  lieu: string;
  annee: number;
  tags: string[];
  montant_travaux_ht?: number;
  image_principale?: string | null;
}

interface ReponseListe<T> {
  results?: T[];
}

const URL_BACKEND = process.env.URL_BACKEND || "http://bee-backend:8000";
const URL_BASE_PUBLIQUE = process.env.URL_BASE || process.env.NEXTAUTH_URL || "";

async function chargerReferences(): Promise<{ config: ConfigurationSite; realisations: Realisation[] }> {
  try {
    const [resConfig, resReal] = await Promise.all([
      fetch(`${URL_BACKEND}/api/site/configuration/`, { cache: "no-store" }),
      fetch(`${URL_BACKEND}/api/site/realisations/`, { cache: "no-store" }),
    ]);
    const config = resConfig.ok
      ? normaliserConfigurationSite(await resConfig.json(), URL_BASE_PUBLIQUE)
      : CONFIGURATION_PAR_DEFAUT;
    const donneesRealisations: Realisation[] | ReponseListe<Realisation> = resReal.ok ? await resReal.json() : [];
    const realisations = Array.isArray(donneesRealisations)
      ? donneesRealisations
      : (donneesRealisations.results ?? []);
    return { config, realisations };
  } catch {
    return { config: CONFIGURATION_PAR_DEFAUT, realisations: [] };
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const { config } = await chargerReferences();
  const nom = config.nom_bureau;
  const contenuReferences = obtenirContenuReferences(config);
  return {
    title: nom
      ? `${contenuReferences.metadata.titre_page} | ${nom}`
      : contenuReferences.metadata.titre_page,
    description: nom
      ? contenuReferences.metadata.description_page.replace("Découvrez des opérations", `Découvrez les opérations de ${nom}`)
      : contenuReferences.metadata.description_page,
  };
}

export default async function PageReferences() {
  const { config, realisations } = await chargerReferences();
  const nomBureau = config.nom_bureau;
  const contenuReferences = obtenirContenuReferences(config);
  const descriptionHeroHtml = convertirContenuRicheEnHtml(contenuReferences.hero.description);
  const descriptionEtatVideHtml = convertirContenuRicheEnHtml(contenuReferences.etat_vide.description);
  const descriptionCtaHtml = convertirContenuRicheEnHtml(contenuReferences.cta.description);

  const afficherExemples = realisations.length === 0;

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
          <div className="badge-section-clair">{contenuReferences.hero.badge}</div>
          <h1 className="text-4xl sm:text-5xl font-bold text-white tracking-tight mb-4">
            {contenuReferences.hero.titre}
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

      {/* Grille des réalisations */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {afficherExemples ? (
            <>
              <div className="text-center mb-12">
                <p className="text-ardoise-400 text-sm mb-2">{contenuReferences.etat_vide.sur_titre}</p>
                <h2 className="titre-section">{contenuReferences.etat_vide.titre}</h2>
                <div
                  className="sous-titre-section [&_p]:mb-4 last:[&_p]:mb-0"
                  dangerouslySetInnerHTML={{ __html: descriptionEtatVideHtml }}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {contenuReferences.domaines_exemple.map((ex) => (
                  <div key={ex.titre} className="carte-premium p-6">
                    <div className="flex items-start gap-3 mb-4">
                      <div className="w-9 h-9 rounded-lg bg-primaire-50 text-primaire-600 flex items-center justify-center shrink-0">
                        <Building2 className="w-4.5 h-4.5" />
                      </div>
                      <h3 className="font-semibold text-ardoise-900 text-sm leading-snug">{ex.titre}</h3>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-ardoise-400 mb-3">
                      <MapPin className="w-3.5 h-3.5" aria-hidden />
                      {ex.lieu}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {ex.tags.map((t) => <span key={t} className="badge-neutre">{t}</span>)}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="text-center mb-12">
                <h2 className="titre-section">{contenuReferences.liste.titre}</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {realisations.map((r) => (
                  <Link
                    key={r.id}
                    href={`/references/${r.id}`}
                    className="carte-premium group block p-6 transition-all hover:-translate-y-1"
                  >
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <h3 className="font-semibold text-ardoise-900 text-sm leading-snug">{r.titre}</h3>
                      <ArrowRight className="h-4 w-4 shrink-0 text-primaire-500 opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>
                    <div className="space-y-1.5 mb-3">
                      {r.client && (
                        <div className="flex items-center gap-1.5 text-xs text-ardoise-500">
                          <Building2 className="w-3.5 h-3.5 shrink-0" aria-hidden />
                          {r.client}
                        </div>
                      )}
                      {r.lieu && (
                        <div className="flex items-center gap-1.5 text-xs text-ardoise-500">
                          <MapPin className="w-3.5 h-3.5 shrink-0" aria-hidden />
                          {r.lieu}
                        </div>
                      )}
                      {r.annee && (
                        <div className="flex items-center gap-1.5 text-xs text-ardoise-400">
                          <Calendar className="w-3.5 h-3.5 shrink-0" aria-hidden />
                          {r.annee}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {r.tags.map((t) => <span key={t} className="badge-neutre">{t}</span>)}
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {/* Secteurs */}
      <section className="py-16 bg-ardoise-50 border-y border-ardoise-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="titre-section text-center mb-10">{contenuReferences.secteurs.titre}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {contenuReferences.secteurs.liste.map((secteur) => (
              <div key={secteur} className="bg-white rounded-xl border border-ardoise-200 p-4 text-center">
                <span className="text-sm text-ardoise-600 font-medium">{secteur}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-ardoise-900">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl font-bold text-white mb-4">
            {contenuReferences.cta.titre}
          </h2>
          <div
            className="mb-6 text-ardoise-400 [&_p]:mb-4 last:[&_p]:mb-0"
            dangerouslySetInnerHTML={{ __html: descriptionCtaHtml }}
          />
          <Link href="/contact" className="btn-accent px-7 py-3 text-base">
            {contenuReferences.cta.bouton} <ArrowRight className="w-4 h-4" />
          </Link>
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
