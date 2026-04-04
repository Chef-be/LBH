"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { Menu, X, ChevronDown, TrendingUp, Hammer, Building2, Calculator, FileText, Megaphone } from "lucide-react";
import type { ConfigurationSite } from "@/contextes/FournisseurConfiguration";
import { obtenirMarqueAffichee, obtenirNomPlateforme } from "@/lib/site-public";

interface PropsNavigationPublique {
  config: ConfigurationSite;
}

const ICONES_PRESTATIONS: Record<string, React.FC<{ className?: string }>> = {
  TrendingUp, Hammer, Building2, Calculator, FileText, Megaphone,
};

interface LienPrestation {
  slug: string;
  titre: string;
  icone: string;
}

interface PropsNavigationPublique {
  config: ConfigurationSite;
  prestations?: LienPrestation[];
}

const LIENS_NAV = [
  { libelle: "Accueil", href: "/" },
  { libelle: "Prestations", href: "/prestations", sousMenu: true },
  { libelle: "Notre méthode", href: "/notre-methode" },
  { libelle: "Références", href: "/references" },
  { libelle: "Contact", href: "/contact" },
];

export function NavigationPublique({
  config,
  prestations = [],
}: PropsNavigationPublique) {
  const chemin = usePathname();
  const [menuOuvert, setMenuOuvert] = useState(false);
  const [sousMenuOuvert, setSousMenuOuvert] = useState(false);
  const [defileEnCours, setDefileEnCours] = useState(false);
  const nomBureau = obtenirNomPlateforme(config);
  const marque = obtenirMarqueAffichee(config);
  const logo = config.logo;

  useEffect(() => {
    const handleScroll = () => setDefileEnCours(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const estActif = (href: string) => {
    if (href === "/") return chemin === "/";
    return chemin.startsWith(href);
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        defileEnCours || menuOuvert
          ? "bg-ardoise-900/98 backdrop-blur-md border-b border-ardoise-700/60 shadow-lg"
          : "bg-ardoise-900/80 backdrop-blur-sm"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-18">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 shrink-0 group">
            {logo ? (
              <div className="relative h-10 min-w-10 max-w-[9rem] rounded-xl bg-white/95 px-2 py-1 shrink-0 shadow-accent border border-white/10">
                <Image
                  src={logo}
                  alt={nomBureau || "Logo"}
                  fill
                  unoptimized
                  sizes="144px"
                  className="object-contain p-1"
                />
              </div>
            ) : marque ? (
              <div className="w-8 h-8 rounded-lg bg-accent-500 flex items-center justify-center shrink-0 shadow-accent group-hover:bg-accent-400 transition-colors">
                <span className="text-white font-bold text-sm">{marque}</span>
              </div>
            ) : (
              <div className="w-8 h-8 rounded-lg border border-white/15 bg-white/5 shrink-0" />
            )}
            {(nomBureau || config.slogan) && (
              <div className="hidden sm:block">
                {nomBureau && <span className="text-white font-bold text-base leading-none">{nomBureau}</span>}
                {config.slogan && (
                  <p className="text-ardoise-300 text-xs leading-none mt-0.5">{config.slogan}</p>
                )}
              </div>
            )}
          </Link>

          {/* Navigation desktop */}
          <nav className="hidden lg:flex items-center gap-0.5" aria-label="Navigation principale">
            {LIENS_NAV.map((lien) => (
              lien.sousMenu && prestations.length > 0 ? (
                <div key={lien.href} className="relative" onMouseLeave={() => setSousMenuOuvert(false)}>
                  <button
                    onMouseEnter={() => setSousMenuOuvert(true)}
                    className={`flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-lg transition-all ${
                      estActif(lien.href)
                        ? "text-white bg-white/10"
                        : "text-ardoise-300 hover:text-white hover:bg-white/8"
                    }`}
                  >
                    {lien.libelle}
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${sousMenuOuvert ? "rotate-180" : ""}`} />
                  </button>
                  {sousMenuOuvert && (
                    <div className="absolute top-full left-0 mt-1 w-64 bg-ardoise-900 border border-ardoise-700 rounded-xl shadow-2xl py-2 overflow-hidden">
                      {prestations.map((p) => {
                        const Icone = ICONES_PRESTATIONS[p.icone] ?? TrendingUp;
                        return (
                          <Link
                            key={p.slug}
                            href={`/prestations/${p.slug}`}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-ardoise-300 hover:text-white hover:bg-ardoise-800 transition-colors"
                            onClick={() => setSousMenuOuvert(false)}
                          >
                            <Icone className="w-4 h-4 text-accent-400 shrink-0" />
                            <span>{p.titre}</span>
                          </Link>
                        );
                      })}
                      <div className="mt-2 pt-2 border-t border-ardoise-700 mx-2">
                        <Link
                          href="/prestations"
                          className="flex items-center justify-center gap-1 px-4 py-2 text-xs text-accent-400 hover:text-accent-300 font-medium transition-colors"
                          onClick={() => setSousMenuOuvert(false)}
                        >
                          Voir toutes les prestations →
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  key={lien.href}
                  href={lien.href}
                  className={`px-3 py-2 text-sm font-medium rounded-lg transition-all ${
                    estActif(lien.href)
                      ? "text-white bg-white/10"
                      : "text-ardoise-300 hover:text-white hover:bg-white/8"
                  }`}
                >
                  {lien.libelle}
                </Link>
              )
            ))}
          </nav>

          {/* Bouton connexion + menu mobile */}
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/connexion"
              className="hidden sm:inline-flex btn-accent text-sm py-1.5 px-4"
            >
              Connexion
            </Link>
            <button
              onClick={() => setMenuOuvert(!menuOuvert)}
              className="lg:hidden p-2 text-ardoise-300 hover:text-white rounded-lg hover:bg-white/8 transition-colors"
              aria-label={menuOuvert ? "Fermer le menu" : "Ouvrir le menu"}
              aria-expanded={menuOuvert}
            >
              {menuOuvert ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Menu mobile */}
      {menuOuvert && (
        <div className="lg:hidden bg-ardoise-900 border-t border-ardoise-700/60 px-4 pt-3 pb-5 space-y-0.5">
          {LIENS_NAV.map((lien) => (
            <Link
              key={lien.href}
              href={lien.href}
              onClick={() => setMenuOuvert(false)}
              className={`flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                estActif(lien.href)
                  ? "text-white bg-white/10"
                  : "text-ardoise-300 hover:text-white hover:bg-ardoise-800"
              }`}
            >
              {lien.libelle}
            </Link>
          ))}
          <div className="pt-3 border-t border-ardoise-700 mt-3">
            <Link
              href="/connexion"
              onClick={() => setMenuOuvert(false)}
              className="flex items-center justify-center btn-accent w-full py-2.5"
            >
              Connexion à l&apos;espace de travail
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
