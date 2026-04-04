"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { api } from "@/crochets/useApi";
import {
  ArrowLeft, RefreshCw, Copy, Euro, TrendingUp, TrendingDown, Minus,
  ChevronDown, ChevronRight,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LignePrix {
  id: string;
  numero_ordre: number;
  code: string;
  designation: string;
  unite: string;
  quantite_prevue: number;
  debourse_sec_unitaire: number;
  cout_revient_unitaire: number;
  prix_vente_unitaire: number;
  marge_nette_unitaire: number;
  taux_marge_nette: number;
  marge_nette_totale: number;
  contribution_marge: number;
  etat_rentabilite: string;
  etat_libelle: string;
  causes_non_rentabilite: string[];
}

interface EtudeDetail {
  id: string;
  intitule: string;
  statut: string;
  version: number;
  est_variante: boolean;
  taux_frais_chantier: number | null;
  taux_frais_generaux: number | null;
  taux_aleas: number | null;
  taux_marge_cible: number | null;
  taux_pertes: number | null;
  total_debourse_sec: number;
  total_cout_direct: number;
  total_cout_revient: number;
  total_prix_vente: number;
  total_marge_brute: number;
  total_marge_nette: number;
  taux_marge_nette_global: number;
  lignes: LignePrix[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STYLES_ETAT: Record<string, string> = {
  rentable: "badge-succes",
  surveiller: "badge-alerte",
  faible: "badge-alerte",
  non_rentable: "badge-danger",
  sous_condition: "badge-info",
  deficitaire_origine: "badge-danger",
  indefini: "badge-neutre",
};

function formaterMontant(val: number | null | undefined) {
  if (val == null) return "—";
  return `${Number(val).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

function formaterPourcent(val: number | null | undefined) {
  if (val == null) return "—";
  return `${(Number(val) * 100).toFixed(1)} %`;
}

function IconeMarge({ taux }: { taux: number }) {
  if (taux >= 0.08) return <TrendingUp size={14} className="text-green-500" />;
  if (taux >= 0.03) return <Minus size={14} className="text-yellow-500" />;
  return <TrendingDown size={14} className="text-red-500" />;
}

// ---------------------------------------------------------------------------
// Composant
// ---------------------------------------------------------------------------

export function DetailEtudeEconomique({
  projetId,
  etudeId,
}: {
  projetId: string;
  etudeId: string;
}) {
  const queryClient = useQueryClient();
  const [ligneOuverte, setLigneOuverte] = useState<string | null>(null);

  const { data: etude, isLoading, isError } = useQuery<EtudeDetail>({
    queryKey: ["etude-economique", etudeId],
    queryFn: () => api.get<EtudeDetail>(`/api/economie/${etudeId}/`),
  });

  const { mutate: recalculer, isPending: recalcul } = useMutation({
    mutationFn: () => api.post(`/api/economie/${etudeId}/recalculer/`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["etude-economique", etudeId] }),
  });

  const { mutate: dupliquer, isPending: duplication } = useMutation({
    mutationFn: (est_variante: boolean) =>
      api.post(`/api/economie/${etudeId}/dupliquer/`, { est_variante }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["etudes-economiques", projetId] }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400 text-sm">
        Chargement de l&apos;étude…
      </div>
    );
  }

  if (isError || !etude) {
    return (
      <div className="carte text-center py-12">
        <p className="text-red-500 mb-4">Impossible de charger cette étude.</p>
        <Link href={`/projets/${projetId}/economie`} className="btn-secondaire">
          ← Retour aux études
        </Link>
      </div>
    );
  }

  const tauxGlobal = Number(etude.taux_marge_nette_global);

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href={`/projets/${projetId}/economie`}
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-2"
          >
            <ArrowLeft size={14} /> Économie
          </Link>
          <div className="flex items-center gap-3">
            <h1>{etude.intitule}</h1>
            <span className="font-mono text-xs text-slate-400">v{etude.version}</span>
            {etude.est_variante && <span className="badge-neutre">variante</span>}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => recalculer()}
            disabled={recalcul}
            className="btn-secondaire text-xs flex items-center gap-1"
          >
            <RefreshCw size={12} className={recalcul ? "animate-spin" : ""} />
            Recalculer
          </button>
          <button
            onClick={() => dupliquer(true)}
            disabled={duplication}
            className="btn-secondaire text-xs flex items-center gap-1"
          >
            <Copy size={12} /> Variante
          </button>
        </div>
      </div>

      {/* Synthèse financière */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { lib: "Déboursé sec HT", val: etude.total_debourse_sec },
          { lib: "Coût de revient HT", val: etude.total_cout_revient },
          { lib: "Prix de vente HT", val: etude.total_prix_vente, accent: true },
          { lib: "Marge nette HT", val: etude.total_marge_nette },
        ].map(({ lib, val, accent }) => (
          <div key={lib} className={clsx("carte", accent && "border-primaire-200")}>
            <p className="text-xs text-slate-500 mb-1">{lib}</p>
            <p className={clsx("font-mono font-semibold text-lg", accent && "text-primaire-700")}>
              {formaterMontant(val)}
            </p>
          </div>
        ))}
      </div>

      {/* Indicateur marge globale */}
      <div className="carte flex items-center gap-4">
        <div className="flex items-center gap-2">
          <IconeMarge taux={tauxGlobal} />
          <span className="font-medium">Taux de marge nette global :</span>
        </div>
        <span className={clsx(
          "font-mono text-xl font-bold",
          tauxGlobal >= 0.08 ? "text-green-600" : tauxGlobal >= 0.03 ? "text-yellow-600" : "text-red-600"
        )}>
          {formaterPourcent(etude.taux_marge_nette_global)}
        </span>
        <span className="text-xs text-slate-400 ml-auto">
          {etude.lignes.length} ligne{etude.lignes.length > 1 ? "s" : ""}
        </span>
      </div>

      {/* Lignes de prix */}
      <div className="carte">
        <div className="flex items-center justify-between mb-4">
          <h2 className="flex items-center gap-2">
            <Euro size={16} /> Lignes de prix
          </h2>
          <Link
            href={`/projets/${projetId}/economie/${etudeId}/lignes/nouvelle`}
            className="btn-primaire text-xs"
          >
            + Ajouter
          </Link>
        </div>

        {etude.lignes.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">
            Aucune ligne de prix. Commencez par en ajouter une.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs text-slate-500">
                  <th className="text-left py-2 pr-2 font-medium w-6">#</th>
                  <th className="text-left py-2 pr-4 font-medium">Désignation</th>
                  <th className="text-right py-2 pr-3 font-medium">Qté</th>
                  <th className="text-right py-2 pr-3 font-medium">PV unit. HT</th>
                  <th className="text-right py-2 pr-3 font-medium">PV total HT</th>
                  <th className="text-right py-2 pr-3 font-medium">Marge nette</th>
                  <th className="text-center py-2 font-medium">État</th>
                </tr>
              </thead>
              <tbody>
                {etude.lignes.map((ligne) => (
                  <>
                    <tr
                      key={ligne.id}
                      className="border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={() => setLigneOuverte(ligneOuverte === ligne.id ? null : ligne.id)}
                    >
                      <td className="py-2 pr-2 font-mono text-xs text-slate-400">
                        <div className="flex items-center gap-0.5">
                          {ligneOuverte === ligne.id
                            ? <ChevronDown size={12} />
                            : <ChevronRight size={12} />}
                          {ligne.numero_ordre}
                        </div>
                      </td>
                      <td className="py-2 pr-4">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setLigneOuverte(ligneOuverte === ligne.id ? null : ligne.id);
                          }}
                          className="max-w-xs truncate font-medium text-left transition-colors hover:text-primaire-600"
                        >
                          {ligne.designation}
                        </button>
                        {ligne.code && (
                          <p className="text-xs text-slate-400 font-mono">{ligne.code}</p>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-right font-mono text-xs">
                        {Number(ligne.quantite_prevue).toLocaleString("fr-FR")} {ligne.unite}
                      </td>
                      <td className="py-2 pr-3 text-right font-mono text-xs">
                        {formaterMontant(ligne.prix_vente_unitaire)}
                      </td>
                      <td className="py-2 pr-3 text-right font-mono text-xs font-medium">
                        {formaterMontant(
                          Number(ligne.prix_vente_unitaire) * Number(ligne.quantite_prevue)
                        )}
                      </td>
                      <td className="py-2 pr-3 text-right font-mono text-xs">
                        <span className={clsx(
                          Number(ligne.taux_marge_nette) >= 0.08 ? "text-green-600" :
                          Number(ligne.taux_marge_nette) >= 0.03 ? "text-yellow-600" : "text-red-600"
                        )}>
                          {formaterPourcent(ligne.taux_marge_nette)}
                        </span>
                      </td>
                      <td className="py-2 text-center">
                        <span className={clsx("text-xs", STYLES_ETAT[ligne.etat_rentabilite] || "badge-neutre")}>
                          {ligne.etat_libelle}
                        </span>
                      </td>
                    </tr>
                    {ligneOuverte === ligne.id && (
                      <tr key={`${ligne.id}-detail`} className="bg-slate-50">
                        <td colSpan={7} className="px-6 py-3">
                          <div className="grid grid-cols-3 gap-6 text-xs">
                            <div>
                              <p className="font-medium text-slate-600 mb-2">Décomposition unitaire</p>
                              <dl className="space-y-1 text-slate-500">
                                <div className="flex justify-between">
                                  <dt>Déboursé sec</dt>
                                  <dd className="font-mono">{formaterMontant(ligne.debourse_sec_unitaire)}</dd>
                                </div>
                                <div className="flex justify-between">
                                  <dt>Coût de revient</dt>
                                  <dd className="font-mono">{formaterMontant(ligne.cout_revient_unitaire)}</dd>
                                </div>
                                <div className="flex justify-between">
                                  <dt>Marge nette</dt>
                                  <dd className="font-mono">{formaterMontant(ligne.marge_nette_unitaire)}</dd>
                                </div>
                              </dl>
                            </div>
                            <div>
                              <p className="font-medium text-slate-600 mb-2">Contribution</p>
                              <dl className="space-y-1 text-slate-500">
                                <div className="flex justify-between">
                                  <dt>Marge nette totale</dt>
                                  <dd className="font-mono">{formaterMontant(ligne.marge_nette_totale)}</dd>
                                </div>
                                <div className="flex justify-between">
                                  <dt>Part dans le lot</dt>
                                  <dd className="font-mono">{formaterPourcent(ligne.contribution_marge)}</dd>
                                </div>
                              </dl>
                            </div>
                            {ligne.causes_non_rentabilite.length > 0 && (
                              <div>
                                <p className="font-medium text-red-600 mb-2">Alertes</p>
                                <ul className="space-y-1 text-red-500">
                                  {ligne.causes_non_rentabilite.map((cause, i) => (
                                    <li key={i} className="text-xs leading-relaxed">{cause}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
              {/* Pied de tableau — totaux */}
              <tfoot className="border-t-2 border-slate-200">
                <tr className="font-medium text-sm">
                  <td colSpan={4} className="py-3 pr-3 text-right text-slate-500">Total</td>
                  <td className="py-3 pr-3 text-right font-mono font-bold">
                    {formaterMontant(etude.total_prix_vente)}
                  </td>
                  <td className="py-3 pr-3 text-right font-mono font-bold">
                    <span className={clsx(
                      tauxGlobal >= 0.08 ? "text-green-600" : tauxGlobal >= 0.03 ? "text-yellow-600" : "text-red-600"
                    )}>
                      {formaterPourcent(etude.taux_marge_nette_global)}
                    </span>
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
