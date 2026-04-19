"use client";

import type { ProgressionTeleversement } from "@/crochets/useApi";

function formaterDebit(octetsParSeconde: number): string {
  if (octetsParSeconde < 1024) return `${octetsParSeconde.toFixed(0)} o/s`;
  if (octetsParSeconde < 1024 * 1024) return `${(octetsParSeconde / 1024).toFixed(1)} Ko/s`;
  return `${(octetsParSeconde / (1024 * 1024)).toFixed(1)} Mo/s`;
}

function formaterTaille(octets: number): string {
  if (octets < 1024) return `${octets} o`;
  if (octets < 1024 * 1024) return `${(octets / 1024).toFixed(1)} Ko`;
  return `${(octets / (1024 * 1024)).toFixed(1)} Mo`;
}

function formaterDuree(secondes: number | null): string {
  if (secondes === null || !Number.isFinite(secondes) || secondes < 0) return "Calcul…";
  const total = Math.max(0, Math.round(secondes));
  if (total === 0) return "Presque fini…";
  const minutes = Math.floor(total / 60);
  const reste = total % 60;
  if (minutes === 0) return `${reste}s`;
  return `${minutes} min ${reste}s`;
}

/**
 * Barre de progression inline — s'intègre dans le flux du document.
 * Affiche : libellé, pourcentage, barre animée, débit, temps restant, taille transférée.
 */
export function EtatTeleversement({
  progression,
  libelle = "Téléversement en cours",
}: {
  progression: ProgressionTeleversement | null;
  libelle?: string;
}) {
  if (!progression) return null;

  const avecStats = progression.debitOctetsSeconde > 0 && progression.total > 0;
  const pct = progression.pourcentage;

  return (
    <div
      className="rounded-xl border p-3 space-y-2"
      style={{
        backgroundColor: "color-mix(in srgb, var(--fond-carte) 92%, var(--c-fort))",
        borderColor: "color-mix(in srgb, var(--bordure) 70%, var(--c-fort))",
      }}
    >
      {/* Libellé + pourcentage */}
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium truncate" style={{ color: "var(--texte)" }}>
          {libelle}
        </span>
        <span className="font-bold tabular-nums shrink-0" style={{ color: "var(--c-fort)" }}>
          {pct}%
        </span>
      </div>

      {/* Barre de progression */}
      <div
        className="h-2.5 overflow-hidden rounded-full"
        style={{ backgroundColor: "color-mix(in srgb, var(--fondateur) 18%, var(--fond-carte))" }}
      >
        <div
          className="h-full rounded-full transition-[width] duration-200 ease-out"
          style={{
            width: `${pct}%`,
            background: "linear-gradient(90deg, var(--c-fort), color-mix(in srgb, var(--c-fort) 70%, #38bdf8))",
          }}
        />
      </div>

      {/* Stats : débit, temps restant, taille */}
      {avecStats && (
        <div
          className="flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs"
          style={{ color: "var(--texte-2)" }}
        >
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 16 16">
              <path d="M2 8h12M10 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {formaterDebit(progression.debitOctetsSeconde)}
          </span>
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 16 16">
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M8 5v3.5l2 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            {formaterDuree(progression.tempsRestantSecondes)}
          </span>
          <span className="tabular-nums">
            {formaterTaille(progression.charge)} / {formaterTaille(progression.total)}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Overlay flottant de progression — affiché par-dessus le contenu pendant un téléversement long.
 * Se fixe en bas à droite de l'écran avec une ombre prononcée.
 */
export function OverlayTeleversement({
  progression,
  libelle = "Téléversement en cours",
}: {
  progression: ProgressionTeleversement | null;
  libelle?: string;
}) {
  if (!progression) return null;

  return (
    <div
      className="fixed bottom-6 right-6 z-50 w-80 shadow-2xl rounded-2xl border overflow-hidden"
      style={{
        backgroundColor: "var(--fond-carte)",
        borderColor: "color-mix(in srgb, var(--c-fort) 40%, var(--bordure))",
        boxShadow: "0 8px 32px -4px rgba(0,0,0,0.25), 0 0 0 1px color-mix(in srgb, var(--c-fort) 20%, transparent)",
      }}
    >
      {/* Barre de progression en haut (fine) */}
      <div className="h-1 w-full" style={{ backgroundColor: "var(--fond-app)" }}>
        <div
          className="h-full transition-[width] duration-200 ease-out"
          style={{
            width: `${progression.pourcentage}%`,
            background: "linear-gradient(90deg, var(--c-fort), color-mix(in srgb, var(--c-fort) 60%, #38bdf8))",
          }}
        />
      </div>

      <div className="p-4 space-y-3">
        {/* Icône + libellé + % */}
        <div className="flex items-start gap-3">
          <div
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: "color-mix(in srgb, var(--c-fort) 15%, var(--fond-carte))" }}
          >
            {/* Icône upload animée */}
            <svg
              className="w-4 h-4 animate-bounce"
              style={{ color: "var(--c-fort)" }}
              fill="none" viewBox="0 0 16 16"
            >
              <path d="M8 2v8M5 5l3-3 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 11v1a2 2 0 002 2h8a2 2 0 002-2v-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate" style={{ color: "var(--texte)" }}>
              {libelle}
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--texte-2)" }}>
              Ne fermez pas cette page
            </p>
          </div>
          <span
            className="text-lg font-bold tabular-nums shrink-0"
            style={{ color: "var(--c-fort)" }}
          >
            {progression.pourcentage}%
          </span>
        </div>

        {/* Barre large */}
        <div
          className="h-3 overflow-hidden rounded-full"
          style={{ backgroundColor: "color-mix(in srgb, var(--fond-app) 80%, var(--bordure))" }}
        >
          <div
            className="h-full rounded-full transition-[width] duration-200 ease-out"
            style={{
              width: `${progression.pourcentage}%`,
              background: "linear-gradient(90deg, var(--c-fort), color-mix(in srgb, var(--c-fort) 60%, #38bdf8))",
            }}
          />
        </div>

        {/* Stats */}
        {progression.debitOctetsSeconde > 0 && progression.total > 0 && (
          <div
            className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs"
            style={{ color: "var(--texte-2)" }}
          >
            <span className="font-medium" style={{ color: "var(--texte)" }}>
              {formaterDebit(progression.debitOctetsSeconde)}
            </span>
            <span>
              Temps restant : <strong style={{ color: "var(--texte)" }}>
                {formaterDuree(progression.tempsRestantSecondes)}
              </strong>
            </span>
            <span className="tabular-nums w-full">
              {formaterTaille(progression.charge)} / {formaterTaille(progression.total)} transférés
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
