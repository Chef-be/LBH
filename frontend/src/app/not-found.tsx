import Link from "next/link";
import { ArrowLeft, SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-ardoise-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center px-6 py-20 text-center">
        <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-accent-300 ring-1 ring-white/10">
          <SearchX className="h-8 w-8" />
        </div>
        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.28em] text-ardoise-400">
          Erreur 404
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
          Cette page est introuvable
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ardoise-300">
          L&apos;adresse demandée n&apos;existe pas ou n&apos;est plus disponible.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link href="/" className="btn-accent px-6 py-3 text-base">
            Retour à l&apos;accueil
          </Link>
          <Link href="/contact" className="btn-contour px-6 py-3 text-base">
            <ArrowLeft className="h-4 w-4" />
            Nous contacter
          </Link>
        </div>
      </div>
    </main>
  );
}
