"use client";

import Link from "next/link";
import { ArrowLeft, Briefcase, Lock } from "lucide-react";

export default function PageNouveauProjet() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4" style={{ background: "var(--fond-app)" }}>
      <section className="max-w-2xl w-full rounded-2xl p-8" style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}>
        <Link href="/projets" className="inline-flex items-center gap-2 text-sm mb-6" style={{ color: "var(--texte-3)" }}>
          <ArrowLeft size={14} /> Retour aux projets
        </Link>
        <div className="flex items-start gap-4">
          <span className="h-12 w-12 rounded-xl flex items-center justify-center" style={{ background: "color-mix(in srgb, var(--c-base) 14%, var(--fond-entree))", color: "var(--c-base)" }}>
            <Lock size={20} />
          </span>
          <div className="space-y-3">
            <h1 className="text-2xl font-semibold" style={{ color: "var(--texte)" }}>
              La création directe d&apos;un projet est bloquée
            </h1>
            <p className="text-sm leading-relaxed" style={{ color: "var(--texte-2)" }}>
              Un projet doit maintenant être créé depuis une affaire commerciale validée : nouvelle affaire, devis envoyé au client, acceptation ou validation manuelle motivée, puis création du projet depuis Pilotage société.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link href="/societe" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white" style={{ background: "var(--c-base)" }}>
                <Briefcase size={15} /> Aller au pilotage société
              </Link>
              <Link href="/societe/devis" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold" style={{ border: "1px solid var(--bordure)", color: "var(--texte-2)" }}>
                Voir les devis
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
