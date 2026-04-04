"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { DiapositiveCarrousel } from "@/contextes/FournisseurConfiguration";

interface Props {
  diapositives: DiapositiveCarrousel[];
  /** Hauteur en rem. Défaut : 28rem */
  hauteur?: string;
  /** Délai en ms entre diapositives. 0 = pas d'auto-play. Défaut : 5000 */
  delai?: number;
  /** Afficher les flèches de navigation */
  fleches?: boolean;
  /** Afficher les points de navigation */
  points?: boolean;
}

export function Carrousel({
  diapositives,
  hauteur = "28rem",
  delai = 5000,
  fleches = true,
  points = true,
}: Props) {
  const [actif, setActif] = useState(0);
  const [pause, setPause] = useState(false);
  const [direction, setDirection] = useState<"gauche" | "droite">("droite");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const n = diapositives.length;

  const aller = useCallback(
    (index: number, dir: "gauche" | "droite" = "droite") => {
      setDirection(dir);
      setActif(((index % n) + n) % n);
    },
    [n]
  );

  const suivant = useCallback(() => aller(actif + 1, "droite"), [actif, aller]);
  const precedent = useCallback(() => aller(actif - 1, "gauche"), [actif, aller]);

  // Auto-play
  useEffect(() => {
    if (!delai || pause || n <= 1) return;
    timerRef.current = setTimeout(suivant, delai);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [actif, pause, delai, n, suivant]);

  // Clavier
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") precedent();
      if (e.key === "ArrowRight") suivant();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [precedent, suivant]);

  if (n === 0) return null;

  const diapo = diapositives[actif];

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{ height: hauteur }}
      onMouseEnter={() => setPause(true)}
      onMouseLeave={() => setPause(false)}
      role="region"
      aria-label="Carrousel"
    >
      {/* Diapositives */}
      {diapositives.map((d, i) => (
        <div
          key={i}
          className="absolute inset-0 transition-all duration-500 ease-in-out"
          style={{
            opacity: i === actif ? 1 : 0,
            zIndex: i === actif ? 1 : 0,
            transform: i === actif
              ? "translateX(0)"
              : direction === "droite"
                ? i < actif ? "translateX(-100%)" : "translateX(100%)"
                : i > actif ? "translateX(100%)" : "translateX(-100%)",
            background: d.couleur_fond
              ? d.couleur_fond
              : "linear-gradient(135deg, var(--c-sombre) 0%, var(--c-fort) 100%)",
          }}
        >
          {/* Image de fond */}
          {d.image_url && (
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${d.image_url})` }}
            >
              <div className="absolute inset-0 bg-black/40" />
            </div>
          )}

          {/* Contenu */}
          <div className="relative z-10 flex flex-col items-center justify-center h-full text-center px-6 sm:px-12">
            {d.titre && (
              <h2 className="text-3xl sm:text-5xl font-bold text-white mb-4 leading-tight max-w-4xl">
                {d.titre}
              </h2>
            )}
            {d.sous_titre && (
              <p className="text-base sm:text-xl text-white/80 mb-8 max-w-2xl leading-relaxed">
                {d.sous_titre}
              </p>
            )}
            {d.cta_texte && d.cta_lien && (
              <Link
                href={d.cta_lien}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold
                           bg-white text-ardoise-900 hover:bg-white/90 transition-all duration-150 shadow-lg"
              >
                {d.cta_texte}
              </Link>
            )}
          </div>
        </div>
      ))}

      {/* Flèches */}
      {fleches && n > 1 && (
        <>
          <button
            onClick={precedent}
            className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full
                       bg-black/30 hover:bg-black/50 text-white flex items-center justify-center
                       transition-all duration-150 backdrop-blur-sm"
            aria-label="Diapositive précédente"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={suivant}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full
                       bg-black/30 hover:bg-black/50 text-white flex items-center justify-center
                       transition-all duration-150 backdrop-blur-sm"
            aria-label="Diapositive suivante"
          >
            <ChevronRight size={20} />
          </button>
        </>
      )}

      {/* Points */}
      {points && n > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
          {diapositives.map((_, i) => (
            <button
              key={i}
              onClick={() => aller(i, i > actif ? "droite" : "gauche")}
              className="rounded-full transition-all duration-200"
              style={{
                width: i === actif ? "24px" : "8px",
                height: "8px",
                background: i === actif ? "#ffffff" : "rgba(255,255,255,0.4)",
              }}
              aria-label={`Aller à la diapositive ${i + 1}`}
            />
          ))}
        </div>
      )}

      {/* Barre de progression */}
      {delai > 0 && n > 1 && !pause && (
        <div className="absolute bottom-0 left-0 right-0 z-20 h-0.5 bg-white/20">
          <div
            key={actif}
            className="h-full bg-white/70"
            style={{ animation: `barre-progression ${delai}ms linear forwards` }}
          />
        </div>
      )}
    </div>
  );
}
