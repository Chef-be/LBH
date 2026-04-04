"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { clsx } from "clsx";
import { api } from "@/crochets/useApi";
import { TrendingUp, AlertTriangle, Calculator } from "lucide-react";

interface DetailEtude {
  id: string;
  intitule: string;
  lot: string | null;
  statut: string;
  total_prix_vente: number;
  total_marge_nette: number;
  taux_marge_nette_global: number;
  nb_lignes_non_rentables: number;
}

interface AnalyseRentabilite {
  projet_id: string;
  nb_etudes: number;
  total_prix_vente: number;
  total_marge_nette: number;
  taux_marge_nette_global: number;
  etudes: DetailEtude[];
}

interface ResultatSimulation {
  etude_id: string;
  intitule: string;
  parametres_simulation: {
    taux_marge: number;
    taux_frais_generaux: number;
    taux_aleas: number;
  };
  resultats: {
    total_debourse_sec: number;
    total_cout_direct: number;
    total_cout_revient: number;
    total_prix_vente_simule: number;
    total_marge_nette_simulee: number;
    taux_marge_nette_effectif: number;
  };
  ecart_vs_actuel: {
    prix_vente: number;
    marge_nette: number;
  };
}

function formaterPct(val: number) {
  return `${(val * 100).toFixed(1)} %`;
}

function formaterEuro(val: number) {
  return `${val.toLocaleString("fr-FR", { minimumFractionDigits: 0 })} €`;
}

function CouleurMarge({ taux }: { taux: number }) {
  if (taux >= 0.12) return <span className="text-green-600 font-mono font-medium">{formaterPct(taux)}</span>;
  if (taux >= 0.08) return <span className="text-yellow-600 font-mono font-medium">{formaterPct(taux)}</span>;
  return <span className="text-red-600 font-mono font-medium">{formaterPct(taux)}</span>;
}

function PanneauSimulation({ etudeId, intitule }: { etudeId: string; intitule: string }) {
  const [tauxMarge, setTauxMarge] = useState("10");
  const [tauxFG, setTauxFG] = useState("10");
  const [tauxAleas, setTauxAleas] = useState("3");
  const [resultat, setResultat] = useState<ResultatSimulation | null>(null);

  const { mutate: simuler, isPending } = useMutation({
    mutationFn: () =>
      api.post<ResultatSimulation>(`/api/rentabilite/simulation/${etudeId}/`, {
        taux_marge: Number(tauxMarge) / 100,
        taux_frais_generaux: Number(tauxFG) / 100,
        taux_aleas: Number(tauxAleas) / 100,
      }),
    onSuccess: (data: ResultatSimulation) => setResultat(data),
  });

  return (
    <div className="mt-4 border border-slate-200 rounded-lg p-4 bg-slate-50 space-y-4">
      <p className="text-sm font-medium text-slate-700">Simulation — {intitule}</p>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="libelle-champ">Taux marge (%)</label>
          <input
            type="number" min="0" max="99" step="0.5"
            value={tauxMarge} onChange={(e) => setTauxMarge(e.target.value)}
            className="champ-saisie font-mono"
          />
        </div>
        <div>
          <label className="libelle-champ">Frais généraux (%)</label>
          <input
            type="number" min="0" max="50" step="0.5"
            value={tauxFG} onChange={(e) => setTauxFG(e.target.value)}
            className="champ-saisie font-mono"
          />
        </div>
        <div>
          <label className="libelle-champ">Aléas (%)</label>
          <input
            type="number" min="0" max="20" step="0.5"
            value={tauxAleas} onChange={(e) => setTauxAleas(e.target.value)}
            className="champ-saisie font-mono"
          />
        </div>
      </div>
      <button
        onClick={() => simuler()}
        disabled={isPending}
        className="btn-primaire text-xs flex items-center gap-1"
      >
        <Calculator size={12} />
        {isPending ? "Simulation…" : "Lancer la simulation"}
      </button>

      {resultat && (
        <div className="grid grid-cols-2 gap-3 text-sm border-t border-slate-200 pt-3">
          <div>
            <p className="text-slate-500 text-xs">Prix de vente simulé</p>
            <p className="font-mono font-medium">{formaterEuro(resultat.resultats.total_prix_vente_simule)}</p>
            <p className={clsx("text-xs font-mono", resultat.ecart_vs_actuel.prix_vente >= 0 ? "text-green-600" : "text-red-600")}>
              {resultat.ecart_vs_actuel.prix_vente >= 0 ? "+" : ""}
              {formaterEuro(resultat.ecart_vs_actuel.prix_vente)} vs actuel
            </p>
          </div>
          <div>
            <p className="text-slate-500 text-xs">Marge nette simulée</p>
            <CouleurMarge taux={resultat.resultats.taux_marge_nette_effectif} />
            <p className={clsx("text-xs font-mono", resultat.ecart_vs_actuel.marge_nette >= 0 ? "text-green-600" : "text-red-600")}>
              {resultat.ecart_vs_actuel.marge_nette >= 0 ? "+" : ""}
              {formaterEuro(resultat.ecart_vs_actuel.marge_nette)} vs actuel
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export function AnalyseRentabiliteProjet({ projetId }: { projetId: string }) {
  const [simulationOuverte, setSimulationOuverte] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery<AnalyseRentabilite>({
    queryKey: ["rentabilite-projet", projetId],
    queryFn: () => api.get<AnalyseRentabilite>(`/api/rentabilite/projet/${projetId}/`),
  });

  if (isLoading) {
    return <div className="carte py-12 text-center text-slate-400 text-sm">Chargement de l&apos;analyse…</div>;
  }

  if (isError || !data) {
    return (
      <div className="carte py-12 text-center text-slate-400 text-sm">
        Aucune étude économique active pour ce projet. Calculez une étude économique pour voir l&apos;analyse de rentabilité.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Synthèse globale */}
      <div className="grid grid-cols-3 gap-4">
        <div className="carte text-center">
          <p className="text-xs text-slate-500 mb-1">Prix de vente total</p>
          <p className="text-2xl font-mono font-semibold text-primaire-700">
            {formaterEuro(data.total_prix_vente)}
          </p>
        </div>
        <div className="carte text-center">
          <p className="text-xs text-slate-500 mb-1">Marge nette totale</p>
          <p className="text-2xl font-mono font-semibold text-green-700">
            {formaterEuro(data.total_marge_nette)}
          </p>
        </div>
        <div className="carte text-center">
          <p className="text-xs text-slate-500 mb-1">Taux de marge global</p>
          <div className="flex items-center justify-center gap-2 mt-1">
            <TrendingUp size={20} className={data.taux_marge_nette_global >= 0.10 ? "text-green-600" : "text-red-500"} />
            <span className="text-2xl font-mono font-semibold">
              <CouleurMarge taux={data.taux_marge_nette_global} />
            </span>
          </div>
        </div>
      </div>

      {/* Détail par étude */}
      <div className="carte">
        <h2 className="mb-4">Détail par étude ({data.nb_etudes})</h2>
        <div className="space-y-3">
          {data.etudes.map((etude) => (
            <div key={etude.id} className="border border-slate-100 rounded-lg p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="font-medium text-sm">{etude.intitule}</p>
                  {etude.lot && <p className="text-xs text-slate-400">{etude.lot}</p>}
                </div>
                <div className="flex items-center gap-6 text-right shrink-0">
                  <div>
                    <p className="text-xs text-slate-500">Prix de vente</p>
                    <p className="font-mono text-sm font-medium">{formaterEuro(etude.total_prix_vente)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Marge nette</p>
                    <CouleurMarge taux={etude.taux_marge_nette_global} />
                  </div>
                  {etude.nb_lignes_non_rentables > 0 && (
                    <div className="flex items-center gap-1 text-orange-500">
                      <AlertTriangle size={14} />
                      <span className="text-xs">{etude.nb_lignes_non_rentables} ligne{etude.nb_lignes_non_rentables > 1 ? "s" : ""}</span>
                    </div>
                  )}
                  <button
                    onClick={() => setSimulationOuverte(simulationOuverte === etude.id ? null : etude.id)}
                    className="btn-secondaire text-xs"
                  >
                    {simulationOuverte === etude.id ? "Fermer" : "Simuler"}
                  </button>
                </div>
              </div>

              {simulationOuverte === etude.id && (
                <PanneauSimulation etudeId={etude.id} intitule={etude.intitule} />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
