import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  TrendingUp, Hammer, Building2, Calculator, FileText, Megaphone,
  ArrowRight, CheckCircle, Package, HelpCircle, ChevronLeft,
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
  TrendingUp, Hammer, Building2, Calculator, FileText, Megaphone, Package,
};
function Icone({ nom, className }: { nom: string; className?: string }) {
  const C = ICONES[nom] ?? HelpCircle;
  return <C className={className} />;
}

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
  avantages: { icone: string; titre: string; description: string }[];
  livrables: string[];
  titre_page: string;
  accroche_page: string;
  meta_titre: string;
  meta_description: string;
}

interface PrestationResume {
  id: string;
  slug: string;
  titre: string;
  icone: string;
}

interface ReponseListe<T> {
  results?: T[];
}

const CLASSES: Record<string, { texte: string; fond: string; bord: string; bg: string; texte_bg: string }> = {
  primaire: { texte: "text-primaire-600", fond: "bg-primaire-50",  bord: "border-primaire-200", bg: "bg-primaire-600", texte_bg: "text-white" },
  amber:    { texte: "text-amber-700",    fond: "bg-amber-50",     bord: "border-amber-200",    bg: "bg-amber-500",   texte_bg: "text-white" },
  green:    { texte: "text-green-700",    fond: "bg-green-50",     bord: "border-green-200",    bg: "bg-green-600",   texte_bg: "text-white" },
  indigo:   { texte: "text-indigo-700",   fond: "bg-indigo-50",    bord: "border-indigo-200",   bg: "bg-indigo-600",  texte_bg: "text-white" },
  purple:   { texte: "text-purple-700",   fond: "bg-purple-50",    bord: "border-purple-200",   bg: "bg-purple-600",  texte_bg: "text-white" },
  rose:     { texte: "text-rose-700",     fond: "bg-rose-50",      bord: "border-rose-200",     bg: "bg-rose-600",    texte_bg: "text-white" },
  slate:    { texte: "text-ardoise-700",  fond: "bg-ardoise-50",   bord: "border-ardoise-200",  bg: "bg-ardoise-700", texte_bg: "text-white" },
  orange:   { texte: "text-orange-700",   fond: "bg-orange-50",    bord: "border-orange-200",   bg: "bg-orange-500",  texte_bg: "text-white" },
};

const URL_BACKEND = process.env.URL_BACKEND || "http://lbh-backend:8000";
const URL_BASE_PUBLIQUE = process.env.URL_BASE || process.env.NEXTAUTH_URL || "";

async function chargerPrestation(slug: string): Promise<{
  config: ConfigurationSite;
  prestation: Prestation | null;
  autres: PrestationResume[];
}> {
  try {
    const [resConfig, resPrestation, resTous] = await Promise.all([
      fetch(`${URL_BACKEND}/api/site/configuration/`, { cache: "no-store" }),
      fetch(`${URL_BACKEND}/api/site/prestations/slug/${slug}/`, { cache: "no-store" }),
      fetch(`${URL_BACKEND}/api/site/prestations/`, { cache: "no-store" }),
    ]);
    const config = resConfig.ok
      ? normaliserConfigurationSite(await resConfig.json(), URL_BASE_PUBLIQUE)
      : CONFIGURATION_PAR_DEFAUT;
    const prestation = resPrestation.ok ? await resPrestation.json() : null;
    const listePrestations: Prestation[] | ReponseListe<Prestation> = resTous.ok ? await resTous.json() : [];
    const tous = Array.isArray(listePrestations)
      ? listePrestations
      : (listePrestations.results ?? []);
    const autres = tous
      .filter((p) => p.slug !== slug)
      .map((p) => ({ id: p.id, slug: p.slug, titre: p.titre, icone: p.icone }));
    return { config, prestation, autres };
  } catch {
    return { config: CONFIGURATION_PAR_DEFAUT, prestation: null, autres: [] };
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const { config, prestation } = await chargerPrestation(slug);
  const nom = config.nom_bureau;
  const contenuPrestations = obtenirContenuPrestations(config);
  if (!prestation) {
    return {
      title: nom
        ? `${contenuPrestations.metadata.titre_page} | ${nom}`
        : contenuPrestations.metadata.titre_page,
    };
  }
  return {
    title: prestation.meta_titre || (nom ? `${prestation.titre} | ${nom}` : prestation.titre),
    description: prestation.meta_description || prestation.description_courte,
  };
}

export default async function PageDetailPrestation({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { config, prestation, autres } = await chargerPrestation(slug);

  if (!prestation) {
    notFound();
  }

  const c = CLASSES[prestation.couleur] ?? CLASSES.primaire;
  const nomBureau = config.nom_bureau;
  const contenuPrestations = obtenirContenuPrestations(config);
  const titrePage = prestation.titre_page || prestation.titre;
  const accroche = prestation.accroche_page || prestation.description_courte;
  const descriptionLongueHtml = convertirContenuRicheEnHtml(prestation.description_longue);

  return (
    <div className="min-h-screen bg-white">
      <NavigationPublique
        config={config}
        prestations={[{ slug: prestation.slug, titre: prestation.titre, icone: prestation.icone }, ...autres.map((a) => ({ slug: a.slug, titre: a.titre, icone: a.icone }))]}
      />

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
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link
            href="/prestations"
            className="inline-flex items-center gap-1.5 text-sm text-ardoise-400 hover:text-accent-400 transition-colors mb-8"
          >
            <ChevronLeft className="w-4 h-4" />
            {contenuPrestations.detail.retour}
          </Link>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl ${c.bg} mb-6 shadow-lg`}>
                <Icone nom={prestation.icone} className={`w-7 h-7 ${c.texte_bg}`} />
              </div>
              <h1 className="text-4xl sm:text-5xl font-bold text-white tracking-tight mb-5">
                {titrePage}
              </h1>
              <p className="text-ardoise-300 text-xl leading-relaxed">
                {accroche}
              </p>
              <div className="mt-8">
                <Link href="/contact" className="btn-accent text-base px-6 py-3">
                  {contenuPrestations.detail.bouton_contact} <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* Points forts */}
            {prestation.points_forts.length > 0 && (
              <div className={`rounded-2xl ${c.fond} ${c.bord} border p-7`}>
                <h2 className="text-sm font-semibold text-ardoise-600 uppercase tracking-wider mb-4">
                  {contenuPrestations.detail.bloc_points_forts}
                </h2>
                <ul className="space-y-3">
                  {prestation.points_forts.map((point) => (
                    <li key={point} className="flex items-start gap-3">
                      <CheckCircle className={`w-5 h-5 ${c.texte} shrink-0 mt-0.5`} aria-hidden />
                      <span className="text-ardoise-700 text-sm">{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
        <div
          aria-hidden
          className="absolute bottom-0 left-0 right-0 h-10 bg-white"
          style={{ clipPath: "ellipse(60% 100% at 50% 100%)" }}
        />
      </section>

      {/* Description longue */}
      {prestation.description_longue && (
        <section className="py-20 bg-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="titre-section mb-6">{contenuPrestations.detail.bloc_description}</h2>
            <div
              className="prose prose-slate max-w-none text-ardoise-600 leading-relaxed text-base prose-headings:text-ardoise-900 prose-li:text-ardoise-600 prose-strong:text-ardoise-800"
              dangerouslySetInnerHTML={{ __html: descriptionLongueHtml }}
            />
          </div>
        </section>
      )}

      {/* Avantages */}
      {prestation.avantages && prestation.avantages.length > 0 && (
        <section className="py-16 bg-ardoise-50 border-y border-ardoise-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="titre-section text-center mb-10">{contenuPrestations.detail.bloc_avantages}</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {prestation.avantages.map((av) => (
                <div key={av.titre} className="bg-white rounded-2xl border border-ardoise-100 p-6 hover:shadow-carte-lg transition-all">
                  <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl ${c.fond} ${c.texte} mb-4`}>
                    <Icone nom={av.icone} className="w-5 h-5" />
                  </div>
                  <h3 className="font-semibold text-ardoise-900 mb-2">{av.titre}</h3>
                  <p className="text-ardoise-500 text-sm leading-relaxed">{av.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Livrables */}
      {prestation.livrables && prestation.livrables.length > 0 && (
        <section className="py-16 bg-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="titre-section mb-8">{contenuPrestations.detail.bloc_livrables}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {prestation.livrables.map((livrable) => (
                <div key={livrable} className={`flex items-start gap-3 p-4 rounded-xl ${c.fond} border ${c.bord}`}>
                  <Package className={`w-4 h-4 ${c.texte} shrink-0 mt-0.5`} aria-hidden />
                  <span className="text-ardoise-700 text-sm font-medium">{livrable}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Autres prestations */}
      {autres.length > 0 && (
        <section className="py-16 bg-ardoise-50 border-t border-ardoise-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="titre-section mb-8 text-center">{contenuPrestations.detail.bloc_autres_titre}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {autres.slice(0, 5).map((a) => (
                <Link
                  key={a.slug}
                  href={`/prestations/${a.slug}`}
                  className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl border border-ardoise-200 hover:border-primaire-300 hover:shadow-carte transition-all text-center group"
                >
                  <Icone nom={a.icone} className="w-6 h-6 text-primaire-500 group-hover:text-primaire-600" />
                  <span className="text-xs font-medium text-ardoise-700 leading-snug">{a.titre}</span>
                </Link>
              ))}
            </div>
            <div className="text-center mt-6">
              <Link href="/prestations" className="btn-contour-sombre text-sm">
                {contenuPrestations.detail.bloc_autres_bouton} <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="py-16 bg-ardoise-900">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl font-bold text-white mb-4">{contenuPrestations.detail.cta_titre}</h2>
          <p className="text-ardoise-400 mb-6">{contenuPrestations.detail.cta_description}</p>
          <Link href="/contact" className="btn-accent px-7 py-3 text-base">
            {contenuPrestations.detail.cta_bouton} <ArrowRight className="w-4 h-4" />
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
