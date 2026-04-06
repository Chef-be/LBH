"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { clsx } from "clsx";

interface Props {
  ouvert: boolean;
  onFermer: () => void;
  titre?: React.ReactNode;
  children: React.ReactNode;
  pied?: React.ReactNode;
  taille?: "sm" | "md" | "lg" | "xl";
  /** Empêche la fermeture au clic sur le fond */
  immovable?: boolean;
  debordementVisible?: boolean;
}

const LARGEURS = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

export function Modal({
  ouvert, onFermer, titre, children, pied,
  taille = "md", immovable = false, debordementVisible = false,
}: Props) {
  const boiteRef = useRef<HTMLDivElement>(null);

  // Focus trap + fermeture Échap
  useEffect(() => {
    if (!ouvert) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onFermer(); return; }

      // Focus trap basique
      if (e.key === "Tab" && boiteRef.current) {
        const focusables = boiteRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const premier = focusables[0];
        const dernier = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === premier) {
          e.preventDefault(); dernier.focus();
        } else if (!e.shiftKey && document.activeElement === dernier) {
          e.preventDefault(); premier.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    // Empêcher le scroll du body
    const origOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Focus sur le premier élément focusable
    setTimeout(() => {
      boiteRef.current?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea'
      )?.focus();
    }, 50);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = origOverflow;
    };
  }, [ouvert, onFermer]);

  if (!ouvert) return null;

  return (
    <div
      className="modal-fond"
      onClick={immovable ? undefined : onFermer}
      role="dialog"
      aria-modal="true"
    >
      <div
        ref={boiteRef}
        className={clsx("modal-boite w-full", LARGEURS[taille], debordementVisible && "overflow-visible")}
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête */}
        {titre !== undefined && (
          <div className="modal-entete">
            <h2 className="text-base font-semibold" style={{ color: "var(--texte)" }}>
              {titre}
            </h2>
            <button
              onClick={onFermer}
              className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
              style={{ color: "var(--texte-3)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--fond-app)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              aria-label="Fermer"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Corps */}
        <div className="modal-corps">{children}</div>

        {/* Pied */}
        {pied && <div className="modal-pied">{pied}</div>}
      </div>
    </div>
  );
}
