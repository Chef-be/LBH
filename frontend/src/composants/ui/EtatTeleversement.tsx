"use client";

import type { ProgressionTeleversement } from "@/crochets/useApi";

function formaterTaille(octets: number): string {
  if (octets < 1024) return `${octets.toFixed(0)} o/s`;
  if (octets < 1024 * 1024) return `${(octets / 1024).toFixed(1)} Ko/s`;
  return `${(octets / (1024 * 1024)).toFixed(1)} Mo/s`;
}

function formaterDuree(secondes: number | null): string {
  if (secondes === null || !Number.isFinite(secondes)) return "Calcul…";
  const total = Math.max(0, Math.round(secondes));
  const minutes = Math.floor(total / 60);
  const reste = total % 60;
  if (minutes === 0) return `${reste}s`;
  return `${minutes} min ${reste}s`;
}

export function EtatTeleversement({
  progression,
  libelle = "Téléversement en cours",
}: {
  progression: ProgressionTeleversement | null;
  libelle?: string;
}) {
  if (!progression) return null;
  const afficherStatistiques = progression.debitOctetsSeconde > 0 && progression.total > 0;

  return (
    <div className="surface-accent rounded-xl p-3">
      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
        <span className="font-medium" style={{ color: "var(--texte)" }}>{libelle}</span>
        <span className="font-semibold" style={{ color: "var(--c-fort)" }}>{progression.pourcentage}%</span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full border"
        style={{
          backgroundColor: "color-mix(in srgb, var(--fond-carte) 88%, var(--fond-app))",
          borderColor: "color-mix(in srgb, var(--bordure) 82%, transparent)",
        }}
      >
        <div
          className="h-full rounded-full bg-primaire-600 transition-[width] duration-150"
          style={{ width: `${progression.pourcentage}%` }}
        />
      </div>
      {afficherStatistiques ? (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs" style={{ color: "var(--texte-2)" }}>
          <span>{formaterTaille(progression.debitOctetsSeconde)}</span>
          <span>Temps estimé : {formaterDuree(progression.tempsRestantSecondes)}</span>
          <span>
            {(progression.charge / (1024 * 1024)).toFixed(1)} / {(progression.total / (1024 * 1024)).toFixed(1)} Mo
          </span>
        </div>
      ) : null}
    </div>
  );
}
