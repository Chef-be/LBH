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

  return (
    <div className="rounded-xl border border-primaire-200 bg-primaire-50/80 p-3">
      <div className="flex items-center justify-between gap-3 text-sm mb-2">
        <span className="font-medium text-primaire-900">{libelle}</span>
        <span className="font-semibold text-primaire-700">{progression.pourcentage}%</span>
      </div>
      <div className="h-2 rounded-full bg-white/80 overflow-hidden border border-primaire-100">
        <div
          className="h-full rounded-full bg-primaire-600 transition-[width] duration-150"
          style={{ width: `${progression.pourcentage}%` }}
        />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-primaire-800">
        <span>{formaterTaille(progression.debitOctetsSeconde)}</span>
        <span>Temps estimé : {formaterDuree(progression.tempsRestantSecondes)}</span>
        <span>
          {(progression.charge / (1024 * 1024)).toFixed(1)} / {(progression.total / (1024 * 1024)).toFixed(1)} Mo
        </span>
      </div>
    </div>
  );
}
