import type { Metadata } from "next";
import Link from "next/link";
import {
  TrendingUp, Hammer, Building2, Calculator, FileText, Megaphone,
  ArrowRight, CheckCircle, HelpCircle,
} from "lucide-react";
import { NavigationPublique } from "@/composants/site-public/NavigationPublique";
import { PiedDePage } from "@/composants/site-public/PiedDePage";
import { CONFIGURATION_PAR_DEFAUT } from "@/contextes/FournisseurConfiguration";
import type { ConfigurationSite } from "@/contextes/FournisseurConfiguration";
import {
  convertirContenuRicheEnHtml,
  normaliserConfigurationSite,
  obtenirContenuPrestations,
} from "@/lib/site-public";

export const dynamic = "force-dynamic";

const ICONES: Record<string, React.FC<{ className?: string }>> = {
  TrendingUp, Hammer, Building2, Calculator, FileText, Megaphone,
};
function Icone({ nom, className }: { nom: string; className?: string }) {
  const C = ICONES[nom] ?? HelpCircle;
  return <C className={className} />;
}

const CLASSES_COULEUR: Record<string, { texte: string; fond: string; bord: string; bg: string }> = {
  primaire: { texte: "text-primaire-600", fond: "bg-primaire-50",  bord: "border-primaire-200", bg: "bg-primaire-600" },
  amber:    { texte: "text-amber-600",    fond: "bg-amber-50",     bord: "border-amber-200",    bg: "bg-amber-500" },
  green:    { texte: "text-green-600",    fond: "bg-green-50",     bord: "border-green-200",    bg: "bg-green-600" },
  indigo:   { texte: "text-indigo-600",   fond: "bg-indigo-50",    bord: "border-indigo-200",   bg: "bg-indigo-600" },
  purple:   { texte: "text-purple-600",   fond: "bg-purple-50",    bord: "border-purple-200",   bg: "bg-purple-600" },
  rose:     { texte: "text-rose-600",     fond: "bg-rose-50",      bord: "border-rose-200",     bg: "bg-rose-600" },
  slate:    { texte: "text-ardoise-600",  fond: "bg-ardoise-50",   bord: "border-ardoise-200",  bg: "bg-ardoise-600" },
  orange:   { texte: "text-orange-600",   fond: "bg-orange-50",    bord: "border-orange-200",   bg: "bg-orange-500" },
};

interface Prestation {
  id: string;
  slug: string;
  titre: string;
  categorie: string;
  description_courte: string;
  description_longue: string;
  icone: string;
  couleur: string;
  points_forts: string[];
  livrables: string[];
}

interface ReponseListe<T> {
  results?: T[];
}

const URL_BACKEND = process.env.URL_BACKEND || "http://bee-backend:8000";
const URL_BASE_PUBLIQUE = process.env.URL_BASE || process.env.NEXTAUTH_URL || "";

async function chargerPrestations(): Promise<{ config: ConfigurationSite; prestations: Prestation[] }> {
  try {
    const [resConfig, resPrestations] = await Promise.all([
      fetch(`${URL_BACKEND}/api/site/configuration/`, { cache: "no-store" }),
      fetch(`${URL_BACKEND}/api/site/prestations/`, { cache: "no-store" }),
    ]);
    const config = resConfig.ok
      ? normaliserConfigurationSite(await resConfig.json(), URL_BASE_PUBLIQUE)
      : CONFIGURATION_PAR_DEFAUT;
    const donneesPrestations: Prestation[] | ReponseListe<Prestation> = resPrestations.ok ? await resPrestations.json() : [];
    const prestations = Array.isArray(donneesPrestations)
      ? donneesPrestations
      : (donneesPrestations.results ?? []);
    return { config, prestations };
  } catch {
    return { config: CONFIGURATION_PAR_DEFAUT, prestations: [] };
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const { config } = await chargerPrestations();
  const nom = config.nom_bureau;
  const contenuPrestations = obtenirContenuPrestations(config);
  return {
    title: nom
      ? `${contenuPrestations.metadata.titre_page} | ${nom}`
      : contenuPrestations.metadata.titre_page,
    description: nom
      ? contenuPrestations.metadata.description_page.replace("du bureau", `de ${nom}`)
      : contenuPrestations.metadata.description_page,
  };
}

export default async function PagePrestations() {
  const { config, prestations } = await chargerPrestations();
  const nomBureau = config.nom_bureau;
  const contenuPrestations = obtenirContenuPrestations(config);
  const libellesCategories = contenuPrestations.categories;
  const descriptionHeroHtml = convertirContenuRicheEnHtml(contenuPrestations.hero.description);
  const descriptionCtaHtml = convertirContenuRicheEnHtml(contenuPrestations.cta_bas_page.description);

  return (
    <div className="min-h-screen bg-white">
      <NavigationPublique
        config={config}
        prestations={prestations.map((p) => ({ slug: p.slug, titre: p.titre, icone: p.icone }))}
      />

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
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="badge-section-clair">{contenuPrestations.hero.badge}</div>
          <h1 className="text-4xl sm:text-5xl font-bold text-white tracking-tight mb-4">
            {contenuPrestations.hero.titre}
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

      {/* Grille complète */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {prestations.map((p) => {
              const c = CLASSES_COULEUR[p.couleur] ?? CLASSES_COULEUR.primaire;
              return (
                <Link
                  key={p.id}
                  href={`/prestations/${p.slug}`}
                  className={`group flex flex-col rounded-2xl border ${c.bord} ${c.fond} p-7 hover:shadow-carte-lg hover:-translate-y-0.5 transition-all duration-200`}
                >
                  <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl ${c.bg} text-white mb-5 shadow-sm`}>
                    <Icone nom={p.icone} className="w-6 h-6" />
                  </div>
                  <h2 className="text-xl font-bold text-ardoise-900 mb-3">{p.titre}</h2>
                  {libellesCategories[p.categorie] && (
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ardoise-500 mb-2">
                      {libellesCategories[p.categorie]}
                    </p>
                  )}
                  <p className="text-ardoise-500 text-sm leading-relaxed mb-5 flex-1">
                    {p.description_courte}
                  </p>
                  {p.points_forts.length > 0 && (
                    <ul className="space-y-1.5 mb-5 pt-4 border-t border-current/10">
                      {p.points_forts.map((point) => (
                        <li key={point} className="flex items-start gap-2 text-xs text-ardoise-600">
                          <CheckCircle className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${c.texte}`} aria-hidden />
                          {point}
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className={`flex items-center gap-1.5 text-sm font-medium ${c.texte} group-hover:gap-2.5 transition-all mt-auto`}>
                    En savoir plus <ArrowRight className="w-4 h-4" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA bas de page */}
      <section className="py-16 bg-ardoise-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            {contenuPrestations.cta_bas_page.titre}
          </h2>
          <div
            className="mb-8 text-lg text-ardoise-400 [&_p]:mb-4 last:[&_p]:mb-0"
            dangerouslySetInnerHTML={{ __html: descriptionCtaHtml }}
          />
          <Link href="/contact" className="btn-accent text-base px-7 py-3">
            {contenuPrestations.cta_bas_page.bouton} <ArrowRight className="w-4 h-4" />
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
        prestations={prestations.map((p) => ({ slug: p.slug, titre: p.titre }))}
      />
    </div>
  );
}
