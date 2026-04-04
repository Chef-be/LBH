import Image from "next/image";
import Link from "next/link";
import { Mail, Phone, MapPin, ArrowRight } from "lucide-react";
import { obtenirMarqueAffichee } from "@/lib/site-public";

interface LienPrestation {
  slug: string;
  titre: string;
}

interface PropsPiedDePage {
  nomBureau?: string;
  sigle?: string;
  slogan?: string;
  descriptionCourte?: string;
  logo?: string | null;
  logoPiedDePage?: string | null;
  courriel?: string;
  telephone?: string;
  adresse?: string;
  ville?: string;
  codePostal?: string;
  prestations?: LienPrestation[];
}

const LIENS_LEGAUX = [
  { libelle: "Mentions légales", href: "/pages/mentions-legales" },
  { libelle: "Politique de confidentialité", href: "/pages/politique-de-confidentialite" },
];

export function PiedDePage({
  nomBureau = "",
  sigle = "",
  slogan,
  descriptionCourte,
  logo,
  logoPiedDePage,
  courriel,
  telephone,
  adresse,
  ville,
  codePostal,
  prestations = [],
}: PropsPiedDePage) {
  const annee = new Date().getFullYear();
  const logoAffiche = logoPiedDePage || logo;
  const marque = obtenirMarqueAffichee({ nom_bureau: nomBureau, sigle });

  const descriptionAffichee = descriptionCourte ||
    "Expertise en économie de la construction, dimensionnement voirie et pré-dimensionnement bâtiment. Au service des maîtres d'ouvrage, maîtres d'œuvre et entreprises BTP.";

  return (
    <footer className="bg-ardoise-900 border-t border-ardoise-700/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-8">

        {/* Grille principale */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">

          {/* Identité */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              {logoAffiche ? (
                <div className="relative h-12 min-w-12 max-w-[10rem] rounded-2xl bg-white/95 px-3 py-2 shrink-0 shadow-accent border border-white/10">
                  <Image
                    src={logoAffiche}
                    alt={nomBureau || "Logo"}
                    fill
                    unoptimized
                    sizes="160px"
                    className="object-contain p-2"
                  />
                </div>
              ) : marque ? (
                <div className="w-9 h-9 rounded-xl bg-accent-500 flex items-center justify-center shrink-0 shadow-accent">
                  <span className="text-white font-bold">{marque}</span>
                </div>
              ) : (
                <div className="w-9 h-9 rounded-xl border border-white/15 bg-white/5 shrink-0" />
              )}
              <div>
                {nomBureau && (
                  <span className="text-white font-bold text-lg leading-none">{nomBureau}</span>
                )}
                {slogan && (
                  <p className="text-ardoise-300 text-xs mt-0.5">{slogan}</p>
                )}
              </div>
            </div>
            {slogan && nomBureau && (
              <p className="text-accent-400 text-sm font-medium mb-2 italic">{slogan}</p>
            )}
            <p className="text-ardoise-400 text-sm leading-relaxed max-w-sm">
              {descriptionAffichee}
            </p>

            {/* Contact inline */}
            <div className="mt-5 space-y-2">
              {courriel && (
                <a
                  href={`mailto:${courriel}`}
                  className="flex items-center gap-2 text-sm text-ardoise-400 hover:text-accent-400 transition-colors group"
                >
                  <Mail className="w-4 h-4 text-accent-500 shrink-0" />
                  <span>{courriel}</span>
                </a>
              )}
              {telephone && (
                <div className="flex items-center gap-2 text-sm text-ardoise-400">
                  <Phone className="w-4 h-4 text-accent-500 shrink-0" />
                  <span>{telephone}</span>
                </div>
              )}
              {(ville || adresse) && (
                <div className="flex items-start gap-2 text-sm text-ardoise-400">
                  <MapPin className="w-4 h-4 text-accent-500 shrink-0 mt-0.5" />
                  <span>
                    {adresse && <>{adresse}<br /></>}
                    {codePostal && `${codePostal} `}{ville || "France"}
                  </span>
                </div>
              )}
              {!courriel && !telephone && !ville && (
                <div className="flex items-center gap-2 text-sm text-ardoise-400">
                  <MapPin className="w-4 h-4 text-accent-500 shrink-0" />
                  <span>France</span>
                </div>
              )}
            </div>
          </div>

          {/* Prestations */}
          <div>
            <h3 className="text-white font-semibold text-sm mb-4 uppercase tracking-wider">Nos prestations</h3>
            <ul className="space-y-2">
              {prestations.length > 0 ? (
                prestations.map((p) => (
                  <li key={p.slug}>
                    <Link
                      href={`/prestations/${p.slug}`}
                      className="text-sm text-ardoise-400 hover:text-accent-400 transition-colors flex items-center gap-1.5 group"
                    >
                      <span className="w-1 h-1 rounded-full bg-ardoise-600 group-hover:bg-accent-500 transition-colors shrink-0" />
                      {p.titre}
                    </Link>
                  </li>
                ))
              ) : (
                <>
                  {["Économie de la construction", "Dimensionnement voirie", "Pré-dimensionnement bâtiment", "Métrés quantitatifs", "Assistance maîtrise d'œuvre", "Appels d'offres"].map((titre) => (
                    <li key={titre}>
                      <Link href="/prestations" className="text-sm text-ardoise-400 hover:text-accent-400 transition-colors flex items-center gap-1.5 group">
                        <span className="w-1 h-1 rounded-full bg-ardoise-600 group-hover:bg-accent-500 transition-colors shrink-0" />
                        {titre}
                      </Link>
                    </li>
                  ))}
                </>
              )}
            </ul>
          </div>

          {/* Navigation */}
          <div>
            <h3 className="text-white font-semibold text-sm mb-4 uppercase tracking-wider">Navigation</h3>
            <ul className="space-y-2">
              {[
                { libelle: "Accueil", href: "/" },
                { libelle: "Prestations", href: "/prestations" },
                { libelle: "Notre méthode", href: "/notre-methode" },
                { libelle: "Références", href: "/references" },
                { libelle: "Contact", href: "/contact" },
              ].map((lien) => (
                <li key={lien.href}>
                  <Link
                    href={lien.href}
                    className="text-sm text-ardoise-400 hover:text-accent-400 transition-colors flex items-center gap-1.5 group"
                  >
                    <span className="w-1 h-1 rounded-full bg-ardoise-600 group-hover:bg-accent-500 transition-colors shrink-0" />
                    {lien.libelle}
                  </Link>
                </li>
              ))}
              <li className="pt-2">
                <Link
                  href="/connexion"
                  className="inline-flex items-center gap-1.5 text-sm text-accent-400 hover:text-accent-300 font-medium transition-colors"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  Espace de travail
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Barre basse */}
        <div className="pt-6 border-t border-ardoise-700/60 flex flex-col sm:flex-row justify-between items-center gap-3 text-ardoise-500 text-xs">
          <span>
            © {annee}{nomBureau ? ` ${nomBureau}` : ""} {nomBureau ? "— " : ""}
            Tous droits réservés.
          </span>
          <div className="flex items-center gap-4">
            {LIENS_LEGAUX.map((l) => (
              <Link key={l.href} href={l.href} className="hover:text-ardoise-300 transition-colors">
                {l.libelle}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
