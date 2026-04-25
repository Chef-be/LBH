"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { LayoutDashboard, FileText, Receipt, Clock, TimerReset } from "lucide-react";

const ONGLETS = [
  { libelle: "Tableau de bord", href: "/societe", icone: LayoutDashboard, exact: true },
  { libelle: "Devis", href: "/societe/devis", icone: FileText },
  { libelle: "Factures", href: "/societe/factures", icone: Receipt },
  { libelle: "Taux horaires", href: "/societe/taux-horaires", icone: Clock },
  { libelle: "Temps passés", href: "/societe/temps", icone: TimerReset },
];

export default function LayoutSociete({ children }: { children: React.ReactNode }) {
  const chemin = usePathname();

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--texte)" }}>Pilotage société</h1>
        <p className="text-sm mt-1" style={{ color: "var(--texte-3)" }}>
          Devis d&apos;honoraires, facturation et suivi de trésorerie
        </p>
      </div>

      {/* Navigation interne */}
      <nav
        className="flex gap-1 p-1 rounded-xl"
        style={{ background: "var(--fond-entree)", border: "1px solid var(--bordure)" }}
      >
        {ONGLETS.map(({ libelle, href, icone: Icone, exact }) => {
          const actif = exact ? chemin === href : chemin.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                actif
                  ? "text-white shadow-sm"
                  : "hover:opacity-80"
              )}
              style={actif
                ? { background: "var(--c-base)", color: "white" }
                : { color: "var(--texte-2)" }
              }
            >
              <Icone size={14} />
              {libelle}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}
