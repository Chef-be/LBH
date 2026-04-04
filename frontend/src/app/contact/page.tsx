import type { Metadata } from "next";
import Link from "next/link";
import { Mail, Phone, MapPin, Clock, ArrowRight } from "lucide-react";
import { NavigationPublique } from "@/composants/site-public/NavigationPublique";
import { PiedDePage } from "@/composants/site-public/PiedDePage";
import { FormulaireContact } from "@/composants/site-public/FormulaireContact";
import { CONFIGURATION_PAR_DEFAUT } from "@/contextes/FournisseurConfiguration";
import type { ConfigurationSite } from "@/contextes/FournisseurConfiguration";
import {
  convertirContenuRicheEnHtml,
  normaliserConfigurationSite,
  obtenirContenuContact,
} from "@/lib/site-public";

export const dynamic = "force-dynamic";

const URL_BACKEND = process.env.URL_BACKEND || "http://lbh-backend:8000";
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
  const contenuContact = obtenirContenuContact(config);
  return {
    title: nom
      ? `${contenuContact.metadata.titre_page} | ${nom}`
      : contenuContact.metadata.titre_page,
    description: nom
      ? contenuContact.metadata.description_page.replace("le bureau", nom)
      : contenuContact.metadata.description_page,
  };
}

export default async function PageContact() {
  const config = await chargerConfig();
  const nomBureau = config.nom_bureau;
  const contenuContact = obtenirContenuContact(config);
  const descriptionHeroHtml = convertirContenuRicheEnHtml(contenuContact.hero.description);

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
          <div className="badge-section-clair">{contenuContact.hero.badge}</div>
          <h1 className="text-4xl sm:text-5xl font-bold text-white tracking-tight mb-4">
            {contenuContact.hero.titre}
          </h1>
          <div
            className="mx-auto max-w-xl text-xl text-ardoise-300 [&_p]:mb-4 last:[&_p]:mb-0"
            dangerouslySetInnerHTML={{ __html: descriptionHeroHtml }}
          />
        </div>
        <div
          aria-hidden
          className="absolute bottom-0 left-0 right-0 h-10 bg-white"
          style={{ clipPath: "ellipse(60% 100% at 50% 100%)" }}
        />
      </section>

      {/* Formulaire + infos */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-14">

            {/* Infos de contact */}
            <div className="lg:col-span-2">
              <h2 className="text-2xl font-bold text-ardoise-900 mb-6">{contenuContact.coordonnees.titre}</h2>

              <div className="space-y-5">
                {config.courriel_contact && (
                  <div className="flex items-start gap-4">
                    <div className="w-11 h-11 rounded-xl bg-primaire-50 text-primaire-600 flex items-center justify-center shrink-0">
                      <Mail className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs text-ardoise-400 mb-1 uppercase tracking-wide font-medium">{contenuContact.coordonnees.courriel}</p>
                      <a
                        href={`mailto:${config.courriel_contact}`}
                        className="text-ardoise-800 font-medium hover:text-primaire-600 transition-colors"
                      >
                        {config.courriel_contact}
                      </a>
                    </div>
                  </div>
                )}

                {config.telephone_contact && (
                  <div className="flex items-start gap-4">
                    <div className="w-11 h-11 rounded-xl bg-primaire-50 text-primaire-600 flex items-center justify-center shrink-0">
                      <Phone className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs text-ardoise-400 mb-1 uppercase tracking-wide font-medium">{contenuContact.coordonnees.telephone}</p>
                      <span className="text-ardoise-800 font-medium">{config.telephone_contact}</span>
                    </div>
                  </div>
                )}

                {(config.ville || config.adresse) && (
                  <div className="flex items-start gap-4">
                    <div className="w-11 h-11 rounded-xl bg-primaire-50 text-primaire-600 flex items-center justify-center shrink-0">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs text-ardoise-400 mb-1 uppercase tracking-wide font-medium">{contenuContact.coordonnees.adresse}</p>
                      <span className="text-ardoise-800">
                        {config.adresse && <>{config.adresse}<br /></>}
                        {config.code_postal && `${config.code_postal} `}{config.ville || config.pays}
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-xl bg-primaire-50 text-primaire-600 flex items-center justify-center shrink-0">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs text-ardoise-400 mb-1 uppercase tracking-wide font-medium">{contenuContact.coordonnees.delai_titre}</p>
                    <span className="text-ardoise-800">{contenuContact.coordonnees.delai_valeur}</span>
                  </div>
                </div>
              </div>

              {/* Cas d'usage */}
              <div className="mt-10 p-6 bg-ardoise-50 rounded-2xl border border-ardoise-200">
                <h3 className="font-semibold text-ardoise-900 mb-4 text-sm">{contenuContact.exemples.titre}</h3>
                <ul className="space-y-2">
                  {contenuContact.exemples.liste.map((cas) => (
                    <li key={cas} className="flex items-center gap-2 text-sm text-ardoise-500">
                      <ArrowRight className="w-3.5 h-3.5 text-accent-500 shrink-0" aria-hidden />
                      {cas}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-8 pt-6 border-t border-ardoise-200">
                <p className="text-sm text-ardoise-400 mb-3">{contenuContact.espace_prive.question}</p>
                <Link href="/connexion" className="btn-contour-sombre text-sm">
                  {contenuContact.espace_prive.bouton} <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* Formulaire */}
            <div className="lg:col-span-3">
              <div className="bg-white rounded-2xl border border-ardoise-200 shadow-carte-lg p-8 sm:p-10">
                <h2 className="text-xl font-bold text-ardoise-900 mb-6">{contenuContact.formulaire.titre}</h2>
                <FormulaireContact />
              </div>
            </div>
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
