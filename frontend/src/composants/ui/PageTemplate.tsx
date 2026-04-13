"use client";

import { clsx } from "clsx";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Onglet {
  id: string;
  libelle: string;
  icone?: React.ReactNode;
}

interface PageTemplateProps {
  titre: string;
  description?: string;
  icone?: React.ReactNode;
  /** Boutons ou actions affichés en haut à droite */
  actions?: React.ReactNode;
  onglets?: Onglet[];
  ongletActif?: string;
  onOngletChange?: (id: string) => void;
  chargement?: boolean;
  erreur?: string | null;
  children: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Squelette de chargement
// ---------------------------------------------------------------------------

function SqueletteLignes() {
  return (
    <div className="space-y-4 animate-pulse" aria-hidden="true">
      <div className="h-4 bg-slate-200 rounded w-3/4" />
      <div className="h-4 bg-slate-200 rounded w-1/2" />
      <div className="h-4 bg-slate-200 rounded w-2/3" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Composant principal
// ---------------------------------------------------------------------------

export function PageTemplate({
  titre,
  description,
  icone,
  actions,
  onglets,
  ongletActif,
  onOngletChange,
  chargement = false,
  erreur = null,
  children,
}: PageTemplateProps) {
  const aOnglets = onglets && onglets.length > 0;

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {icone && (
            <div className="shrink-0 flex items-center justify-center w-10 h-10 rounded-xl bg-primaire-50 text-primaire-600">
              {icone}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-slate-900 leading-tight">{titre}</h1>
            {description && (
              <p className="text-sm text-slate-500 mt-0.5 truncate">{description}</p>
            )}
          </div>
        </div>
        {actions && (
          <div className="shrink-0 flex items-center gap-2">{actions}</div>
        )}
      </div>

      {/* Barre d'onglets */}
      {aOnglets && (
        <div className="flex items-center gap-1 border-b border-slate-200 pb-0 -mb-2">
          {onglets!.map((onglet) => {
            const actif = onglet.id === ongletActif;
            return (
              <button
                key={onglet.id}
                type="button"
                onClick={() => onOngletChange?.(onglet.id)}
                className={clsx(
                  "inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors",
                  actif
                    ? "bg-white border border-b-white border-slate-200 text-primaire-700 -mb-px"
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                )}
                aria-selected={actif}
                role="tab"
              >
                {onglet.icone && <span className="shrink-0">{onglet.icone}</span>}
                {onglet.libelle}
              </button>
            );
          })}
        </div>
      )}

      {/* Bannière d'erreur */}
      {erreur && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {erreur}
        </div>
      )}

      {/* Zone de contenu */}
      <div>{chargement ? <SqueletteLignes /> : children}</div>
    </div>
  );
}
