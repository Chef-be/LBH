"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="fr">
      <body>
        <main className="min-h-screen bg-ardoise-950 text-white">
          <div className="mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center px-6 py-20 text-center">
            <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-accent-300 ring-1 ring-white/10">
              <AlertTriangle className="h-8 w-8" />
            </div>
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.28em] text-ardoise-400">
              Incident applicatif
            </p>
            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
              Une erreur est survenue
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ardoise-300">
              La page n&apos;a pas pu être affichée correctement. Vous pouvez relancer le chargement.
            </p>
            <button
              type="button"
              onClick={() => reset()}
              className="btn-accent mt-10 px-6 py-3 text-base"
            >
              Réessayer
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
