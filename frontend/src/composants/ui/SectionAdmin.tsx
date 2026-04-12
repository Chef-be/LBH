"use client";

// Composant SectionAdmin : encapsule une section d'administration avec titre, description,
// barre d'actions, état de chargement, gestion erreur, et zone contenu.
// Utilisé pour décomposer les pages admin monolithiques en sections distinctes.

import type { ReactNode } from "react";
import { X } from "lucide-react";

interface SectionAdminProps {
  titre: string;
  description?: string;
  icone?: ReactNode;
  actions?: ReactNode;
  chargement?: boolean;
  erreur?: string | null;
  succes?: string | null;
  onEffacerSucces?: () => void;
  children: ReactNode;
  className?: string;
}

export function SectionAdmin({
  titre,
  description,
  icone,
  actions,
  chargement = false,
  erreur,
  succes,
  onEffacerSucces,
  children,
  className = "",
}: SectionAdminProps) {
  return (
    <div className={`space-y-4 ${className}`.trim()}>
      {/* En-tête */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          {icone && (
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primaire-50 text-primaire-600">
              {icone}
            </div>
          )}
          <div>
            <h2 className="text-base font-semibold text-slate-900">{titre}</h2>
            {description && (
              <p className="mt-0.5 text-sm text-slate-500">{description}</p>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        )}
      </div>

      {/* Bannière succès */}
      {succes && (
        <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          <span className="min-w-0 flex-1">{succes}</span>
          {onEffacerSucces && (
            <button
              type="button"
              onClick={onEffacerSucces}
              className="shrink-0 text-green-500 hover:text-green-700"
              aria-label="Fermer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {/* Bannière erreur */}
      {erreur && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <span className="min-w-0 flex-1">{erreur}</span>
        </div>
      )}

      {/* Contenu ou skeleton */}
      {chargement ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="space-y-3">
            <div className="h-4 w-3/4 animate-pulse rounded-lg bg-slate-200" />
            <div className="h-4 w-1/2 animate-pulse rounded-lg bg-slate-200" />
            <div className="h-4 w-2/3 animate-pulse rounded-lg bg-slate-200" />
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          {children}
        </div>
      )}
    </div>
  );
}
