"use client";

import { Check } from "lucide-react";
import { clsx } from "clsx";

export interface DefinitionEtape {
  titre: string;
  description?: string;
}

interface IndicateurEtapesProps {
  etapes: DefinitionEtape[];
  etapeCourante: number;
  onNaviguer?: (index: number) => void;
}

export function IndicateurEtapes({ etapes, etapeCourante, onNaviguer }: IndicateurEtapesProps) {
  return (
    <nav aria-label="Étapes du wizard" className="w-full">
      <ol className="flex items-center w-full">
        {etapes.map((etape, index) => {
          const estTerminee = index < etapeCourante;
          const estActive = index === etapeCourante;
          const estFuture = index > etapeCourante;
          const estDernier = index === etapes.length - 1;

          return (
            <li
              key={index}
              className={clsx(
                "flex items-center",
                estDernier ? "flex-none" : "flex-1"
              )}
            >
              {/* Cercle + label */}
              <button
                type="button"
                onClick={() => estTerminee && onNaviguer?.(index)}
                disabled={!estTerminee || !onNaviguer}
                className={clsx(
                  "flex flex-col items-center gap-1.5 min-w-0",
                  estTerminee && onNaviguer ? "cursor-pointer group" : "cursor-default"
                )}
                aria-current={estActive ? "step" : undefined}
              >
                {/* Cercle */}
                <span
                  className={clsx(
                    "flex items-center justify-center w-9 h-9 rounded-full border-2 text-sm font-bold transition-all duration-200 shrink-0",
                    estTerminee && [
                      "border-emerald-500 bg-emerald-500 text-white",
                      onNaviguer && "group-hover:bg-emerald-600 group-hover:border-emerald-600",
                    ],
                    estActive && "border-[color:var(--c-base)] bg-[color:var(--c-base)] text-white shadow-lg",
                    estFuture && "border-[color:var(--bordure)] bg-[color:var(--fond-carte)] text-[color:var(--texte-3)]"
                  )}
                >
                  {estTerminee ? (
                    <Check size={16} strokeWidth={2.5} />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </span>

                {/* Titre (masqué sur très petit écran) */}
                <span
                  className={clsx(
                    "hidden sm:block text-xs font-medium text-center leading-tight max-w-[80px] transition-colors",
                    estActive && "text-[color:var(--c-base)]",
                    estTerminee && "text-emerald-600",
                    estFuture && "text-[color:var(--texte-3)]"
                  )}
                >
                  {etape.titre}
                </span>
              </button>

              {/* Ligne de connexion */}
              {!estDernier && (
                <div className="flex-1 mx-2 sm:mx-3 h-0.5 mt-[-18px] sm:mt-[-20px] rounded-full transition-colors duration-300"
                  style={{
                    background: estTerminee
                      ? "rgb(16, 185, 129)" // emerald-500
                      : "var(--bordure)",
                  }}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
