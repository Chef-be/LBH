"use client";

import Link from "next/link";
import { Clock3, RefreshCcw, Wrench } from "lucide-react";

export function PageMaintenance({
  titre = "Maintenance en cours",
  description = "Le site est momentanément indisponible. Nous faisons le nécessaire pour le rétablir dans les meilleurs délais.",
  afficherLienAccueil = true,
}: {
  titre?: string;
  description?: string;
  afficherLienAccueil?: boolean;
}) {
  return (
    <main className="min-h-screen bg-ardoise-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-6 py-20 text-center">
        <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-accent-300 ring-1 ring-white/10">
          <Wrench className="h-8 w-8" />
        </div>

        <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-ardoise-300">
          <Clock3 className="h-3.5 w-3.5" />
          Intervention technique
        </p>

        <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-white sm:text-5xl">
          {titre}
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ardoise-300">
          {description}
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="btn-accent px-6 py-3 text-base"
          >
            <RefreshCcw className="h-4 w-4" />
            Réessayer
          </button>
          {afficherLienAccueil && (
            <Link href="/" className="btn-contour px-6 py-3 text-base">
              Retour à l&apos;accueil
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
