"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/crochets/useApi";
import { ClipboardList, FileCheck, AlertTriangle } from "lucide-react";

interface StatExecutionProjet {
  projet_id: string;
  projet_reference: string;
  projet_intitule: string;
  nb_cr_chantier: number;
  nb_situations: number;
  nb_os: number;
  derniere_activite: string | null;
}

interface ResumeExecution {
  projets_en_execution: StatExecutionProjet[];
  total_situations_a_valider: number;
  total_os_en_cours: number;
}

function TuileChiffre({
  icone: Icone,
  valeur,
  libelle,
  couleur,
}: {
  icone: React.ComponentType<{ size?: number; className?: string }>;
  valeur: number;
  libelle: string;
  couleur: string;
}) {
  return (
    <div className="carte flex items-center gap-4">
      <div className={`p-3 rounded-lg ${couleur}`}>
        <Icone size={20} className="text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold">{valeur}</p>
        <p className="text-sm text-slate-500">{libelle}</p>
      </div>
    </div>
  );
}

export function TableauBordExecution() {
  const { data, isLoading, isError } = useQuery<ResumeExecution>({
    queryKey: ["execution-resume"],
    queryFn: () => api.get<ResumeExecution>("/api/execution/resume/"),
  });

  if (isLoading) {
    return <div className="py-12 text-center text-slate-400 text-sm">Chargement…</div>;
  }

  if (isError || !data) {
    return (
      <div className="carte py-12 text-center">
        <p className="text-slate-500 text-sm">
          Module de suivi d&apos;exécution — les données sont accessibles depuis la fiche de chaque projet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Indicateurs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <TuileChiffre
          icone={FileCheck}
          valeur={data.total_situations_a_valider}
          libelle="Situations à valider"
          couleur="bg-yellow-500"
        />
        <TuileChiffre
          icone={AlertTriangle}
          valeur={data.total_os_en_cours}
          libelle="Ordres de service en cours"
          couleur="bg-orange-500"
        />
        <TuileChiffre
          icone={ClipboardList}
          valeur={data.projets_en_execution.length}
          libelle="Projets en exécution"
          couleur="bg-primaire-600"
        />
      </div>

      {/* Liste des projets en exécution */}
      {data.projets_en_execution.length > 0 && (
        <div className="carte">
          <h2 className="mb-4">Projets en cours d&apos;exécution</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs text-slate-500">
                  <th className="text-left py-2 pr-4 font-medium">Projet</th>
                  <th className="text-center py-2 pr-4 font-medium">CR chantier</th>
                  <th className="text-center py-2 pr-4 font-medium">Situations</th>
                  <th className="text-center py-2 pr-4 font-medium">OS</th>
                  <th className="text-right py-2 font-medium">Dernière activité</th>
                </tr>
              </thead>
              <tbody>
                {data.projets_en_execution.map((p) => (
                  <tr key={p.projet_id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="py-3 pr-4">
                      <Link href={`/projets/${p.projet_id}`} className="font-medium hover:text-primaire-700 hover:underline">
                        {p.projet_intitule}
                      </Link>
                      <p className="font-mono text-xs text-slate-400">{p.projet_reference}</p>
                    </td>
                    <td className="py-3 pr-4 text-center font-mono text-xs">{p.nb_cr_chantier}</td>
                    <td className="py-3 pr-4 text-center font-mono text-xs">{p.nb_situations}</td>
                    <td className="py-3 pr-4 text-center font-mono text-xs">{p.nb_os}</td>
                    <td className="py-3 text-right text-xs text-slate-400">
                      {p.derniere_activite ? new Date(p.derniere_activite).toLocaleDateString("fr-FR") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
