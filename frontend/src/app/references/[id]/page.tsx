import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, Calendar, MapPin, ArrowRight, BadgeEuro } from "lucide-react";
import { NavigationPublique } from "@/composants/site-public/NavigationPublique";
import { PiedDePage } from "@/composants/site-public/PiedDePage";
import { CONFIGURATION_PAR_DEFAUT } from "@/contextes/FournisseurConfiguration";
import type { ConfigurationSite } from "@/contextes/FournisseurConfiguration";
import {
  absolutiserUrlMedia,
  convertirContenuRicheEnHtml,
  normaliserConfigurationSite,
  obtenirContenuReferences,
  obtenirNomPlateforme,
} from "@/lib/site-public";

export const dynamic = "force-dynamic";

interface Realisation {
  id: string;
  titre: string;
  description: string;
  client: string;
  lieu: string;
  annee: number | null;
  montant_travaux_ht?: number | null;
  image_principale?: string | null;
  tags: string[];
}

const URL_BACKEND = process.env.URL_BACKEND || "http://lbh-backend:8000";
const URL_BASE_PUBLIQUE = process.env.URL_BASE || process.env.NEXTAUTH_URL || "";

async function chargerReference(id: string): Promise<{
  config: ConfigurationSite;
  realisation: Realisation | null;
}> {
  try {
    const [resConfig, resRealisation] = await Promise.all([
      fetch(`${URL_BACKEND}/api/site/configuration/`, { cache: "no-store" }),
      fetch(`${URL_BACKEND}/api/site/realisations/${id}/`, { cache: "no-store" }),
    ]);
    const config = resConfig.ok
      ? normaliserConfigurationSite(await resConfig.json(), URL_BASE_PUBLIQUE)
      : CONFIGURATION_PAR_DEFAUT;
    const realisation = resRealisation.ok ? await resRealisation.json() : null;
    return {
      config,
      realisation: realisation
        ? {
            ...realisation,
            image_principale: absolutiserUrlMedia(realisation.image_principale, URL_BASE_PUBLIQUE),
          }
        : null,
    };
  } catch {
    return { config: CONFIGURATION_PAR_DEFAUT, realisation: null };
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const { config, realisation } = await chargerReference(id);
  const nom = obtenirNomPlateforme(config);
  const contenuReferences = obtenirContenuReferences(config);
  if (!realisation) {
    return {
      title: nom
        ? `${contenuReferences.metadata.titre_page} | ${nom}`
        : contenuReferences.metadata.titre_page,
    };
  }
  return {
    title: nom ? `${realisation.titre} | ${nom}` : realisation.titre,
    description: realisation.description || contenuReferences.hero.description,
  };
}

function formaterMontant(montant?: number | null) {
  if (typeof montant !== "number") return null;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(montant);
}

export default async function PageDetailReference({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { config, realisation } = await chargerReference(id);

  if (!realisation) {
    notFound();
  }

  const nomBureau = obtenirNomPlateforme(config);
  const contenuReferences = obtenirContenuReferences(config);
  const descriptionHtml = convertirContenuRicheEnHtml(realisation.description);
  const descriptionCtaHtml = convertirContenuRicheEnHtml(contenuReferences.cta.description);
  const montant = formaterMontant(realisation.montant_travaux_ht);

  return (
    <div className="min-h-screen bg-white">
      <NavigationPublique config={config} />

      <section className="relative overflow-hidden bg-ardoise-900 pb-20 pt-32">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:px-8">
          <div>
            <Link
              href="/references"
              className="mb-8 inline-flex items-center gap-2 text-sm text-ardoise-400 transition-colors hover:text-ardoise-200"
            >
              <ArrowLeft className="h-4 w-4" />
              Retour aux références
            </Link>
            <div className="badge-section-clair">{contenuReferences.hero.badge}</div>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-5xl">
              {realisation.titre}
            </h1>
            <div className="mt-6 flex flex-wrap gap-3 text-sm text-ardoise-300">
              {realisation.client && (
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                  <Building2 className="h-4 w-4" />
                  {realisation.client}
                </span>
              )}
              {realisation.lieu && (
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                  <MapPin className="h-4 w-4" />
                  {realisation.lieu}
                </span>
              )}
              {realisation.annee && (
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                  <Calendar className="h-4 w-4" />
                  {realisation.annee}
                </span>
              )}
              {montant && (
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                  <BadgeEuro className="h-4 w-4" />
                  {montant}
                </span>
              )}
            </div>
            {realisation.tags.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-2">
                {realisation.tags.map((tag) => (
                  <span key={tag} className="badge-neutre border-white/10 bg-white/5 text-ardoise-200">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-end">
            <div className="w-full overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 shadow-2xl">
              {realisation.image_principale ? (
                <Image
                  src={realisation.image_principale}
                  alt={realisation.titre}
                  width={1200}
                  height={800}
                  unoptimized
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex min-h-[18rem] items-center justify-center bg-gradient-to-br from-white/10 via-white/5 to-transparent text-center text-ardoise-300">
                  <div className="space-y-3 px-8">
                    <Building2 className="mx-auto h-10 w-10 text-accent-300" />
                    <p className="text-sm uppercase tracking-[0.24em] text-ardoise-400">
                      Référence
                    </p>
                    <p className="text-lg font-medium text-white">{realisation.titre}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        <div
          aria-hidden
          className="absolute bottom-0 left-0 right-0 h-10 bg-white"
          style={{ clipPath: "ellipse(60% 100% at 50% 100%)" }}
        />
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:px-8">
          <article className="rounded-3xl border border-ardoise-100 bg-white p-8 shadow-sm">
            <h2 className="titre-section mb-6">Détail de l&apos;intervention</h2>
            {descriptionHtml ? (
              <div
                className="prose prose-slate max-w-none prose-headings:text-ardoise-900 prose-p:text-ardoise-600 prose-li:text-ardoise-600"
                dangerouslySetInnerHTML={{ __html: descriptionHtml }}
              />
            ) : (
              <p className="text-base leading-relaxed text-ardoise-500">
                Cette référence n&apos;a pas encore de descriptif détaillé.
              </p>
            )}
          </article>

          <aside className="rounded-3xl border border-ardoise-100 bg-ardoise-50 p-8 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-ardoise-500">
              Besoin d&apos;un accompagnement similaire ?
            </p>
            <h2 className="mt-3 text-2xl font-bold text-ardoise-900">
              {contenuReferences.cta.titre}
            </h2>
            <div
              className="mt-4 text-sm leading-relaxed text-ardoise-600 [&_p]:mb-4 last:[&_p]:mb-0"
              dangerouslySetInnerHTML={{ __html: descriptionCtaHtml }}
            />
            <Link href="/contact" className="btn-accent mt-8 px-6 py-3 text-base">
              {contenuReferences.cta.bouton}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </aside>
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
