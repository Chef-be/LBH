"use client";

import { Check, Users, FileSignature, MapPin, CheckSquare, Sparkles, Calculator, Rocket } from "lucide-react";
import { clsx } from "clsx";
import type { EtapeWizard } from "./types";

const ICONES: Record<string, React.ReactNode> = {
  Users:         <Users size={16} />,
  FileSignature: <FileSignature size={16} />,
  MapPin:        <MapPin size={16} />,
  CheckSquare:   <CheckSquare size={16} />,
  Sparkles:      <Sparkles size={16} />,
  Calculator:    <Calculator size={16} />,
  Rocket:        <Rocket size={16} />,
};

interface ProgressionWizardProps {
  etapes: EtapeWizard[];
  etapeCourante: number;
  etapesValidees: Set<number>;
  onNaviguer: (index: number) => void;
}

export function ProgressionWizard({
  etapes,
  etapeCourante,
  etapesValidees,
  onNaviguer,
}: ProgressionWizardProps) {
  return (
    <nav className="flex flex-col gap-1 px-3 py-4">
      {etapes.map((etape, index) => {
        const estCourante = index === etapeCourante;
        const estValidee = etapesValidees.has(index);
        const estAccessible = estValidee || index === etapeCourante || (index > 0 && etapesValidees.has(index - 1));

        return (
          <button
            key={etape.id}
            type="button"
            onClick={() => estAccessible && index !== etapeCourante && onNaviguer(index)}
            disabled={!estAccessible}
            className={clsx(
              "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-150",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-base)]",
              estCourante
                ? "shadow-sm"
                : estAccessible
                ? "hover:bg-[color:var(--fond-entree)] cursor-pointer"
                : "opacity-40 cursor-not-allowed"
            )}
            style={
              estCourante
                ? {
                    background: "var(--c-leger)",
                    border: "1px solid var(--c-clair)",
                  }
                : { border: "1px solid transparent" }
            }
          >
            {/* Icône / numéro / coche */}
            <span
              className={clsx(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all",
                estValidee && !estCourante
                  ? "bg-emerald-500 text-white"
                  : estCourante
                  ? "text-white"
                  : "text-[color:var(--texte-3)]"
              )}
              style={
                estCourante
                  ? { background: "var(--c-base)" }
                  : estValidee
                  ? {}
                  : { background: "var(--fond-entree)" }
              }
            >
              {estValidee && !estCourante ? (
                <Check size={13} strokeWidth={3} />
              ) : (
                ICONES[etape.icone] ?? <span>{index + 1}</span>
              )}
            </span>

            {/* Texte */}
            <span className="min-w-0 flex-1">
              <span
                className={clsx(
                  "block text-xs font-semibold leading-tight truncate",
                  estCourante ? "text-[color:var(--c-base)]" : "text-[color:var(--texte)]"
                )}
              >
                {etape.titre}
              </span>
              <span
                className="block text-[10px] leading-tight truncate mt-0.5"
                style={{ color: "var(--texte-3)" }}
              >
                {etape.description}
              </span>
            </span>

            {/* Indicateur étape courante */}
            {estCourante && (
              <span
                className="ml-auto h-1.5 w-1.5 rounded-full shrink-0"
                style={{ background: "var(--c-base)" }}
              />
            )}
          </button>
        );
      })}
    </nav>
  );
}
