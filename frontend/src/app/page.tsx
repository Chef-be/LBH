import type { Metadata } from "next";
import Link from "next/link";
import {
  TrendingUp, Hammer, Building2, Calculator, FileText, Megaphone,
  CheckCircle, ArrowRight, Shield, Clock, Users, BarChart3,
  HelpCircle, ChevronRight, Phone, Mail,
} from "lucide-react";
import { NavigationPublique } from "@/composants/site-public/NavigationPublique";
import { PiedDePage } from "@/composants/site-public/PiedDePage";
import { FormulaireContact } from "@/composants/site-public/FormulaireContact";
import { CarrouselPublic } from "@/composants/site-public/CarrouselPublic";
import { CONFIGURATION_PAR_DEFAUT } from "@/contextes/FournisseurConfiguration";
import type { ConfigurationSite } from "@/contextes/FournisseurConfiguration";
import {
  convertirContenuRicheEnHtml,
  normaliserConfigurationSite,
  obtenirContenuAccueil,
  obtenirNomPlateforme,
} from "@/lib/site-public";

export const dynamic = "force-dynamic";

// ─── Types ──────────────────────────────────────────────────────────────────

interface PrestationResume {
  id: string;
  slug: string;
  titre: string;
  categorie: string;
  description_courte: string;
  icone: string;
  couleur: string;
  points_forts: string[];
}

interface StatistiqueSite {
  id: string;
  valeur: string;
  unite: string;
  libelle: string;
}

interface ValeurSite {
  id: string;
  icone: string;
  titre: string;
  description: string;
}

interface EtapeDemarche {
  id: string;
  numero: string;
  titre: string;
  description: string;
}

interface RealisationResume {
  id: string;
  titre: string;
  client: string;
  lieu: string;
  annee: number;
  tags: string[];
}

interface DonneesAccueil {
  configuration: ConfigurationSite;
  prestations: PrestationResume[];
  statistiques: StatistiqueSite[];
  valeurs: ValeurSite[];
  demarche: EtapeDemarche[];
  realisations: RealisationResume[];
}

// ─── Correspondances icônes et couleurs ─────────────────────────────────────

const ICONES_LUCIDE: Record<string, React.FC<{ className?: string }>> = {
  TrendingUp, Hammer, Building2, Calculator, FileText, Megaphone,
  Shield, Clock, Users, BarChart3,
};

function Icone({ nom, className }: { nom: string; className?: string }) {
  const C = ICONES_LUCIDE[nom] ?? HelpCircle;
  return <C className={className} />;
}

const CLASSES_COULEUR: Record<string, { bg: string; texte: string; bord: string; fond: string }> = {
  primaire: { bg: "bg-primaire-600", texte: "text-primaire-600", bord: "border-primaire-200", fond: "bg-primaire-50" },
  amber:    { bg: "bg-amber-500",    texte: "text-amber-600",    bord: "border-amber-200",    fond: "bg-amber-50" },
  green:    { bg: "bg-green-600",    texte: "text-green-600",    bord: "border-green-200",    fond: "bg-green-50" },
  indigo:   { bg: "bg-indigo-600",   texte: "text-indigo-600",   bord: "border-indigo-200",   fond: "bg-indigo-50" },
  purple:   { bg: "bg-purple-600",   texte: "text-purple-600",   bord: "border-purple-200",   fond: "bg-purple-50" },
  rose:     { bg: "bg-rose-600",     texte: "text-rose-600",     bord: "border-rose-200",     fond: "bg-rose-50" },
  slate:    { bg: "bg-ardoise-600",  texte: "text-ardoise-600",  bord: "border-ardoise-200",  fond: "bg-ardoise-50" },
  orange:   { bg: "bg-orange-500",   texte: "text-orange-600",   bord: "border-orange-200",   fond: "bg-orange-50" },
};

function cl(couleur: string) {
  return CLASSES_COULEUR[couleur] ?? CLASSES_COULEUR.primaire;
}

// ─── Fetch serveur ───────────────────────────────────────────────────────────

const URL_BACKEND = process.env.URL_BACKEND || "http://lbh-backend:8000";
const URL_BASE_PUBLIQUE = process.env.URL_BASE || process.env.NEXTAUTH_URL || "";

async function chargerAccueil(): Promise<DonneesAccueil | null> {
  try {
    const res = await fetch(`${URL_BACKEND}/api/site/accueil/`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const donnees = await res.json();
    return {
      ...donnees,
      configuration: normaliserConfigurationSite(donnees.configuration, URL_BASE_PUBLIQUE),
    };
  } catch {
    return null;
  }
}

// ─── Métadonnées dynamiques ──────────────────────────────────────────────────

export async function generateMetadata(): Promise<Metadata> {
  const d = await chargerAccueil();
  const c = d?.configuration;
  const contenuAccueil = obtenirContenuAccueil(c);
  const nom = c?.nom_bureau;
  return {
    title: c?.meta_titre || (nom ? `${nom} | ${contenuAccueil.metadata.titre_par_defaut}` : contenuAccueil.metadata.titre_par_defaut),
    description: c?.meta_description || contenuAccueil.metadata.description_par_defaut,
    robots: "index, follow",
  };
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function PageAccueil() {
  const donnees = await chargerAccueil();

  const config: ConfigurationSite = donnees?.configuration ?? CONFIGURATION_PAR_DEFAUT;
  const prestations = donnees?.prestations ?? [];
  const statistiques = donnees?.statistiques ?? [];
  const valeurs = donnees?.valeurs ?? [];
  const demarche = donnees?.demarche ?? [];
  const realisations = donnees?.realisations ?? [];
  const contenuAccueil = obtenirContenuAccueil(config);

  const nomBureau       = obtenirNomPlateforme(config);
  const titreHero       = config.titre_hero || nomBureau;
  const sousTitreHero   = config.sous_titre_hero || "";
  const etiquetteHero   = config.etiquette_hero || config.slogan;
  const ctaPrincipal    = config.texte_cta_principal || contenuAccueil.sections.prestations_bouton;
  const ctaSecondaire   = config.texte_cta_secondaire || contenuAccueil.sections.contact_titre;
  const titreCtaBandeau = config.texte_cta_bandeau;
  const descCtaBandeau  = config.texte_description_bandeau || "";
  const sousTitreSecoursHtml = convertirContenuRicheEnHtml(contenuAccueil.hero.sous_titre_secours);
  const prestationsDescriptionHtml = convertirContenuRicheEnHtml(contenuAccueil.sections.prestations_description);
  const secteursDescriptionHtml = convertirContenuRicheEnHtml(contenuAccueil.sections.secteurs_description);
  const pilotageDescriptionHtml = convertirContenuRicheEnHtml(contenuAccueil.sections.pilotage_description);
  const demarcheDescriptionHtml = convertirContenuRicheEnHtml(contenuAccueil.sections.demarche_description);
  const contactDescriptionHtml = convertirContenuRicheEnHtml(contenuAccueil.sections.contact_description);

  return (
      <div className="min-h-screen bg-white text-ardoise-950">
      <NavigationPublique
        config={config}
        prestations={prestations.map((p) => ({ slug: p.slug, titre: p.titre, icone: p.icone }))}
      />

      {/* ══════════════════════════════════════════════════════════════
          CARROUSEL (si configuré) ou SECTION HÉROS STATIQUE
          ══════════════════════════════════════════════════════════════ */}
      {config.activer_carrousel_accueil && config.carousel_accueil && config.carousel_accueil.length > 0 ? (
        <section id="accueil" className="pt-16">
          <CarrouselPublic diapositives={config.carousel_accueil} />
        </section>
      ) : null}

      {/* Section héros statique — affichée si pas de carrousel */}
      {(!config.activer_carrousel_accueil || !config.carousel_accueil || config.carousel_accueil.length === 0) && (
      <section
        id="accueil"
        className="relative min-h-screen flex items-center bg-ardoise-900 overflow-hidden pt-16"
      >
        {/* Grille décorative */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
        {/* Dégradé radial accent */}
        <div
          aria-hidden
          className="absolute top-0 right-0 w-1/2 h-full opacity-10"
          style={{
            background: "radial-gradient(ellipse at 80% 20%, #f59e0b 0%, transparent 60%)",
          }}
        />
        {/* Dégradé radial bas gauche */}
        <div
          aria-hidden
          className="absolute bottom-0 left-0 w-1/3 h-1/2 opacity-8"
          style={{
            background: "radial-gradient(ellipse at 20% 100%, #4561f7 0%, transparent 60%)",
          }}
        />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32">
          <div className="max-w-4xl">
            {/* Badge */}
            {etiquetteHero && (
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/8 border border-white/10 text-accent-300 text-xs font-medium mb-7 tracking-wide">
                <span className="w-1.5 h-1.5 rounded-full bg-accent-400 animate-pulse-lent" aria-hidden />
                {etiquetteHero}
              </div>
            )}

            {/* Titre principal */}
            {titreHero && (
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-[1.1] tracking-tight mb-6">
                {titreHero.split(" ").map((mot, i) => (
                  <span key={i}>
                    {i > 0 && " "}
                    {mot === "expertise" || mot === "économique" || mot === "L'expertise"
                      ? <span className="text-accent-400">{mot}</span>
                      : mot}
                  </span>
                ))}
              </h1>
            )}

            {/* Sous-titre */}
            {sousTitreHero && (
              <p className="text-ardoise-300 text-lg sm:text-xl leading-relaxed mb-10 max-w-2xl">
                {sousTitreHero}
              </p>
            )}
            {!sousTitreHero && (
              <div
                className="mb-10 max-w-2xl text-lg leading-relaxed text-ardoise-200 [&_p]:mb-4 last:[&_p]:mb-0"
                dangerouslySetInnerHTML={{ __html: sousTitreSecoursHtml }}
              />
            )}

            {/* CTAs */}
            <div className="flex flex-wrap gap-3 mb-14">
              <Link
                href="/prestations"
                className="btn-accent text-base px-6 py-3"
              >
                {ctaPrincipal}
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/contact"
                className="btn-contour text-base px-6 py-3"
              >
                {ctaSecondaire}
              </Link>
            </div>

            {/* Indicateurs de confiance */}
            <div className="flex flex-wrap gap-6 items-center">
              {contenuAccueil.hero.indicateurs.map((label) => (
                <div key={label} className="flex items-center gap-2 text-ardoise-300 text-sm">
                  <CheckCircle className="w-4 h-4 text-accent-500 shrink-0" aria-hidden />
                  {label}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Vague basse */}
        <div
          aria-hidden
          className="absolute bottom-0 left-0 right-0 h-12 bg-white"
          style={{ clipPath: "ellipse(60% 100% at 50% 100%)" }}
        />
      </section>
      )}

      {/* ══════════════════════════════════════════════════════════════
          CHIFFRES CLÉS
          ══════════════════════════════════════════════════════════════ */}
      {config.afficher_stats !== false && statistiques.length > 0 && (
        <section aria-label="Chiffres clés" className="py-14 bg-white border-b border-ardoise-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {statistiques.map((stat, i) => (
                <div
                  key={stat.id}
                  className="relative text-center py-8 px-4 rounded-2xl bg-ardoise-50 border border-ardoise-100 hover:border-accent-200 hover:bg-accent-50/30 transition-all group"
                >
                  <div className="text-4xl font-bold text-ardoise-900 leading-none mb-1">
                    {stat.valeur}
                    {stat.unite && (
                      <span className="text-xl text-ardoise-500 ml-1">{stat.unite}</span>
                    )}
                  </div>
                  <p className="text-ardoise-600 text-sm mt-2 leading-snug">{stat.libelle}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════════
          NOS EXPERTISES (PRESTATIONS)
          ══════════════════════════════════════════════════════════════ */}
      {prestations.length > 0 && (
        <section id="prestations" className="py-24 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-14">
              <div className="badge-section">{contenuAccueil.sections.prestations_badge}</div>
              <h2 className="titre-section">{contenuAccueil.sections.prestations_titre}</h2>
              <div
                className="sous-titre-section [&_p]:mb-4 last:[&_p]:mb-0"
                dangerouslySetInnerHTML={{ __html: prestationsDescriptionHtml }}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {prestations.map((p) => {
                const c = cl(p.couleur);
                return (
                  <Link
                    key={p.id}
                    href={`/prestations/${p.slug}`}
                    className={`group rounded-2xl border ${c.bord} ${c.fond} p-6 flex flex-col gap-4 hover:shadow-carte-lg hover:-translate-y-0.5 transition-all duration-200`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className={`p-2.5 rounded-xl bg-white shadow-sm ${c.texte} shrink-0`}>
                        <Icone nom={p.icone} className="w-5 h-5" />
                      </div>
                      <ChevronRight className={`w-4 h-4 ${c.texte} opacity-0 group-hover:opacity-100 transition-opacity mt-1 shrink-0`} />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-ardoise-900 leading-snug mb-1.5">
                        {p.titre}
                      </h3>
                      <p className="text-ardoise-700 text-sm leading-relaxed truncate-3">
                        {p.description_courte}
                      </p>
                    </div>
                    {p.points_forts.length > 0 && (
                      <ul className="space-y-1.5 mt-auto pt-3 border-t border-current/10">
                        {p.points_forts.slice(0, 3).map((point) => (
                          <li key={point} className="flex items-start gap-2 text-xs text-ardoise-700">
                            <CheckCircle className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${c.texte}`} aria-hidden />
                            {point}
                          </li>
                        ))}
                      </ul>
                    )}
                  </Link>
                );
              })}
            </div>

            <div className="text-center mt-10">
              <Link href="/prestations" className="btn-contour-sombre">
                {contenuAccueil.sections.prestations_bouton}
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════════
          VALEURS / AVANTAGES
          ══════════════════════════════════════════════════════════════ */}
      {config.afficher_valeurs !== false && valeurs.length > 0 && (
        <section aria-label="Nos valeurs" className="py-20 bg-ardoise-50 border-y border-ardoise-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <div className="badge-section">{contenuAccueil.sections.valeurs_badge}</div>
              <h2 className="titre-section">{contenuAccueil.sections.valeurs_titre}</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {valeurs.map((v) => (
                <div key={v.id} className="bg-white rounded-2xl border border-ardoise-100 p-6 text-center hover:shadow-carte-lg hover:border-primaire-200 transition-all">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primaire-50 text-primaire-600 mb-4">
                    <Icone nom={v.icone} className="w-6 h-6" />
                  </div>
                  <h3 className="font-semibold text-ardoise-900 mb-2">{v.titre}</h3>
                  <p className="text-ardoise-700 text-sm leading-relaxed">{v.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════════
          SECTEURS D'INTERVENTION
          ══════════════════════════════════════════════════════════════ */}
      <section aria-label="Secteurs d'intervention" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="badge-section">{contenuAccueil.sections.secteurs_badge}</div>
            <h2 className="titre-section">{contenuAccueil.sections.secteurs_titre}</h2>
            <div
              className="sous-titre-section [&_p]:mb-4 last:[&_p]:mb-0"
              dangerouslySetInnerHTML={{ __html: secteursDescriptionHtml }}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {contenuAccueil.secteurs.map((secteur) => {
              const I = ICONES_LUCIDE[secteur.icone] ?? HelpCircle;
              return (
                <div key={secteur.titre} className="rounded-2xl border border-ardoise-100 bg-ardoise-50 p-7 hover:shadow-carte-lg hover:border-primaire-200 transition-all">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primaire-600 text-white mb-5 shadow-primaire">
                    <I className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-semibold text-ardoise-900 mb-3">{secteur.titre}</h3>
                  <div
                    className="mb-4 text-sm leading-relaxed text-ardoise-700 [&_p]:mb-4 last:[&_p]:mb-0"
                    dangerouslySetInnerHTML={{ __html: convertirContenuRicheEnHtml(secteur.description) }}
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {secteur.tags.map((t) => (
                      <span key={t} className="badge-neutre text-xs">{t}</span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          PILOTAGE MÉTIER
          ══════════════════════════════════════════════════════════════ */}
      <section aria-label="Méthodes métier" className="py-20 bg-ardoise-50 border-y border-ardoise-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="badge-section">{contenuAccueil.sections.pilotage_badge}</div>
            <h2 className="titre-section">{contenuAccueil.sections.pilotage_titre}</h2>
            <div
              className="sous-titre-section [&_p]:mb-4 last:[&_p]:mb-0"
              dangerouslySetInnerHTML={{ __html: pilotageDescriptionHtml }}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {contenuAccueil.pilotage.map((bloc) => (
              <div
                key={bloc.titre}
                className="rounded-2xl border border-ardoise-200 bg-white p-6 hover:shadow-carte-lg hover:border-primaire-200 transition-all"
              >
                <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-accent-50 text-accent-600 mb-4">
                  <Icone nom={bloc.icone} className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-semibold text-ardoise-900 mb-2">{bloc.titre}</h3>
                <div
                  className="text-sm leading-relaxed text-ardoise-700 [&_p]:mb-4 last:[&_p]:mb-0"
                  dangerouslySetInnerHTML={{ __html: convertirContenuRicheEnHtml(bloc.description) }}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          DÉMARCHE
          ══════════════════════════════════════════════════════════════ */}
      {config.afficher_demarche !== false && demarche.length > 0 && (
        <section id="demarche" className="py-24 bg-ardoise-900 relative overflow-hidden">
          {/* Deco */}
          <div
            aria-hidden
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
              backgroundSize: "60px 60px",
            }}
          />
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-14">
              <div className="badge-section-clair">{contenuAccueil.sections.demarche_badge}</div>
              <h2 className="titre-section-clair">{contenuAccueil.sections.demarche_titre}</h2>
              <div
                className="sous-titre-section-clair [&_p]:mb-4 last:[&_p]:mb-0"
                dangerouslySetInnerHTML={{ __html: demarcheDescriptionHtml }}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
              {demarche.map((etape, i) => (
                <div key={etape.id} className="relative">
                  {/* Connecteur (masqué sur mobile) */}
                  {i < demarche.length - 1 && (
                    <div
                      aria-hidden
                      className="hidden md:block absolute top-10 left-full w-full h-px bg-ardoise-700 z-0"
                      style={{ width: "calc(100% - 2rem)", left: "calc(100% + 0rem)" }}
                    />
                  )}
                  <div className="relative z-10">
                    {/* Numéro */}
                    <div className="flex items-center gap-4 mb-5">
                      <div className="w-10 h-10 rounded-xl bg-accent-500 flex items-center justify-center shrink-0 shadow-accent">
                        <span className="text-white font-bold text-sm">{etape.numero}</span>
                      </div>
                      <div className="h-px flex-1 bg-ardoise-700" />
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-3">{etape.titre}</h3>
                    <p className="text-ardoise-300 text-sm leading-relaxed">{etape.description}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* CTA bandeau dans la section démarche */}
            {titreCtaBandeau && (
              <div className="mt-16 relative">
                <div className="rounded-2xl bg-accent-500/10 border border-accent-500/20 p-8 sm:p-10 text-center">
                  <h3 className="text-2xl font-bold text-white mb-2">{titreCtaBandeau}</h3>
                  {descCtaBandeau && (
                    <p className="text-ardoise-200 text-base mb-6 max-w-xl mx-auto">{descCtaBandeau}</p>
                  )}
                  <Link
                    href="/contact"
                    className="btn-accent text-base px-7 py-3"
                  >
                    {contenuAccueil.sections.demarche_bouton}
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════════
          RÉALISATIONS
          ══════════════════════════════════════════════════════════════ */}
      {config.afficher_realisations !== false && realisations.length > 0 && (
        <section id="realisations" className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <div className="badge-section">{contenuAccueil.sections.realisations_badge}</div>
              <h2 className="titre-section">{contenuAccueil.sections.realisations_titre}</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {realisations.map((r) => (
                <div key={r.id} className="carte-premium">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <h3 className="font-semibold text-ardoise-900 text-sm leading-snug">{r.titre}</h3>
                    {r.annee && (
                      <span className="text-xs text-ardoise-500 shrink-0">{r.annee}</span>
                    )}
                  </div>
                  {r.client && <p className="text-xs text-ardoise-700 mb-2">{r.client}</p>}
                  {r.lieu && <p className="text-xs text-ardoise-600 mb-3">{r.lieu}</p>}
                  <div className="flex flex-wrap gap-1">
                    {r.tags.map((t) => (
                      <span key={t} className="badge-neutre text-xs">{t}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="text-center mt-8">
              <Link href="/references" className="btn-contour-sombre">
                {contenuAccueil.sections.realisations_bouton} <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════════
          CONTACT
          ══════════════════════════════════════════════════════════════ */}
      {config.afficher_contact !== false && (
        <section id="contact" className="py-24 bg-ardoise-50 border-t border-ardoise-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">
              {/* Infos contact */}
              <div className="lg:col-span-2">
                <div className="badge-section">{contenuAccueil.sections.contact_badge}</div>
                <h2 className="titre-section mb-4">{contenuAccueil.sections.contact_titre}</h2>
                <div
                  className="mb-8 text-base leading-relaxed text-ardoise-700 [&_p]:mb-4 last:[&_p]:mb-0"
                  dangerouslySetInnerHTML={{ __html: contactDescriptionHtml }}
                />

                <div className="space-y-5">
                  {config.courriel_contact && (
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primaire-50 text-primaire-600 flex items-center justify-center shrink-0">
                        <Mail className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs text-ardoise-500 mb-0.5">{contenuAccueil.sections.contact_courriel}</p>
                        <a href={`mailto:${config.courriel_contact}`} className="text-sm font-medium text-ardoise-900 hover:text-primaire-600 transition-colors">
                          {config.courriel_contact}
                        </a>
                      </div>
                    </div>
                  )}
                  {config.telephone_contact && (
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primaire-50 text-primaire-600 flex items-center justify-center shrink-0">
                        <Phone className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs text-ardoise-500 mb-0.5">{contenuAccueil.sections.contact_telephone}</p>
                        <span className="text-sm font-medium text-ardoise-900">{config.telephone_contact}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-8 pt-8 border-t border-ardoise-200">
                  <p className="text-sm text-ardoise-600 mb-3">{contenuAccueil.sections.contact_collaborateur_question}</p>
                  <Link
                    href="/connexion"
                    className="btn-contour-sombre text-sm"
                  >
                    {contenuAccueil.sections.contact_collaborateur_bouton}
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>

              {/* Formulaire */}
              <div className="lg:col-span-3">
                <div className="bg-white rounded-2xl border border-ardoise-200 shadow-carte-lg p-7 sm:p-8">
                  <h3 className="text-xl font-semibold text-ardoise-950 mb-6">{contenuAccueil.sections.contact_formulaire_titre}</h3>
                  <FormulaireContact />
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      <PiedDePage
        nomBureau={nomBureau}
        slogan={config.slogan}
        sigle={config.sigle}
        descriptionCourte={config.description_courte}
        logo={config.logo}
        logoPiedDePage={config.logo_pied_de_page}
        courriel={config.courriel_contact}
        telephone={config.telephone_contact}
        adresse={config.adresse}
        ville={config.ville}
        codePostal={config.code_postal}
        prestations={prestations.map((p) => ({ slug: p.slug, titre: p.titre }))}
      />
    </div>
  );
}
