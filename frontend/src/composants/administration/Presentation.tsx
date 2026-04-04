"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

export function EntetePageAdmin({
  titre,
  description,
  retourHref = "/administration",
  actions,
  statistiques = [],
}: {
  titre: string;
  description?: ReactNode;
  retourHref?: string;
  actions?: ReactNode;
  statistiques?: Array<{ libelle: string; valeur: ReactNode }>;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex items-start gap-3">
          <Link
            href={retourHref}
            className="mt-1 text-slate-400 transition-colors hover:text-slate-600"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1>{titre}</h1>
            {description && <div className="mt-1 text-sm text-slate-500">{description}</div>}
          </div>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>

      {statistiques.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {statistiques.map((statistique) => (
            <div
              key={String(statistique.libelle)}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                {statistique.libelle}
              </p>
              <div className="mt-2 text-sm font-semibold text-slate-800">{statistique.valeur}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function CarteSectionAdmin({
  titre,
  description,
  actions,
  children,
  className = "",
}: {
  titre?: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`.trim()}>
      {(titre || description || actions) && (
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            {titre && <h2 className="text-sm font-semibold text-slate-900">{titre}</h2>}
            {description && <div className="mt-1 text-sm text-slate-500">{description}</div>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function AlerteAdmin({
  type,
  children,
  action,
}: {
  type: "succes" | "erreur" | "info";
  children: ReactNode;
  action?: ReactNode;
}) {
  const classes =
    type === "succes"
      ? "border-green-200 bg-green-50 text-green-700"
      : type === "erreur"
        ? "border-red-200 bg-red-50 text-red-700"
        : "border-blue-200 bg-blue-50 text-blue-700";

  return (
    <div className={`flex items-center gap-2 rounded-xl border p-3 text-sm ${classes}`}>
      <div className="min-w-0 flex-1">{children}</div>
      {action}
    </div>
  );
}
