"use client";

import { useQuery } from "@tanstack/react-query";
import { clsx } from "clsx";
import { api } from "@/crochets/useApi";

interface PropsTuile {
  libelle: string;
  codeStatistique: string;
  icone: "dossier" | "loupe" | "coche" | "liste";
  couleur: "primaire" | "succes" | "alerte" | "neutre";
}

const couleursParType: Record<PropsTuile["couleur"], string> = {
  primaire: "bg-primaire-50 text-primaire-700",
  succes: "bg-green-50 text-green-700",
  alerte: "bg-amber-50 text-amber-700",
  neutre: "bg-slate-100 text-slate-600",
};

async function chargerStatistiques() {
  return api.get<Record<string, number>>("/api/projets/statistiques/");
}

export function TuileStatistique({ libelle, codeStatistique, couleur }: PropsTuile) {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["statistiques-projets"],
    queryFn: chargerStatistiques,
  });

  const valeur = stats ? (stats[codeStatistique] ?? 0) : null;

  return (
    <div className="carte flex flex-col gap-3">
      <p className="text-sm text-slate-500 font-medium">{libelle}</p>
      <p
        className={clsx(
          "text-3xl font-bold rounded-lg px-3 py-1 self-start",
          couleursParType[couleur]
        )}
      >
        {isLoading ? "…" : (valeur ?? "—")}
      </p>
    </div>
  );
}
