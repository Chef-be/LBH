"use client";

import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { api } from "@/crochets/useApi";
import { CheckCircle, AlertCircle, Calculator, Layers } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Couche {
  designation: string;
  materiau: string;
  epaisseur_cm: number;
}

interface ResultatsCalcul {
  trafic_cumule_pl: number;
  classe_trafic: string;
  classe_plateforme: string;
  type_structure: string;
  couches: Couche[];
  epaisseur_totale_cm: number;
  conforme: boolean;
  avertissements: string[];
  justification: string;
  methode: string;
}

interface EtudeVoirie {
  id: string;
  intitule: string;
  type_voie: string;
  type_voie_libelle: string;
  tmja_vl: number | null;
  tmja_pl: number | null;
  duree_vie_ans: number | null;
  taux_croissance_annuel: string | null;
  cbr: string | null;
  classe_plateforme: string | null;
  zone_climatique: string;
  proximite_eau: boolean;
  epaisseur_totale_max_cm: string | null;
  type_structure_prefere: string | null;
  resultats_calcul: ResultatsCalcul | null;
  date_calcul: string | null;
  calcul_conforme: boolean | null;
  observations: string;
}

// ---------------------------------------------------------------------------
// Composant
// ---------------------------------------------------------------------------

export function DetailEtudeVoirie({ projetId, etudeId }: { projetId: string; etudeId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: etude, isLoading, isError } = useQuery<EtudeVoirie>({
    queryKey: ["etude-voirie", etudeId],
    queryFn: () => api.get<EtudeVoirie>(`/api/voirie/${etudeId}/`),
  });

  const { mutate: calculer, isPending } = useMutation({
    mutationFn: () => api.post(`/api/voirie/${etudeId}/calculer/`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["etude-voirie", etudeId] }),
  });

  if (isLoading) return <div className="carte py-12 text-center text-slate-400 text-sm">Chargement…</div>;
  if (isError || !etude) return <div className="carte py-12 text-center text-red-500 text-sm">Erreur de chargement.</div>;

  const res = etude.resultats_calcul;

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500 mb-1">{etude.type_voie_libelle}</p>
          <h2 className="text-lg font-semibold">{etude.intitule}</h2>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {etude.calcul_conforme === true && (
            <span className="flex items-center gap-1 text-green-600 text-sm font-medium">
              <CheckCircle size={16} /> Conforme
            </span>
          )}
          {etude.calcul_conforme === false && (
            <span className="flex items-center gap-1 text-red-500 text-sm font-medium">
              <AlertCircle size={16} /> Non conforme
            </span>
          )}
          <button
            onClick={() => calculer()}
            disabled={isPending}
            className={clsx("btn-primaire text-xs flex items-center gap-1", isPending && "opacity-50")}
          >
            <Calculator size={12} />
            {isPending ? "Calcul…" : "Recalculer"}
          </button>
        </div>
      </div>

      {/* Données d'entrée */}
      <div className="carte">
        <h2 className="mb-4">Données d&apos;entrée</h2>
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-3 text-sm">
          <div>
            <dt className="text-slate-500 text-xs">TMJA PL (sens chargé)</dt>
            <dd className="font-mono font-medium mt-0.5">{etude.tmja_pl ?? "—"} PL/j</dd>
          </div>
          <div>
            <dt className="text-slate-500 text-xs">TMJA VL</dt>
            <dd className="font-mono font-medium mt-0.5">{etude.tmja_vl ?? "—"} VL/j</dd>
          </div>
          <div>
            <dt className="text-slate-500 text-xs">Durée de vie</dt>
            <dd className="font-mono font-medium mt-0.5">{etude.duree_vie_ans ?? "—"} ans</dd>
          </div>
          <div>
            <dt className="text-slate-500 text-xs">CBR</dt>
            <dd className="font-mono font-medium mt-0.5">{etude.cbr ?? etude.classe_plateforme ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500 text-xs">Zone climatique</dt>
            <dd className="font-medium mt-0.5">{etude.zone_climatique}</dd>
          </div>
          <div>
            <dt className="text-slate-500 text-xs">Proximité eau</dt>
            <dd className="font-medium mt-0.5">{etude.proximite_eau ? "Oui" : "Non"}</dd>
          </div>
          {etude.epaisseur_totale_max_cm && (
            <div>
              <dt className="text-slate-500 text-xs">Épaisseur max</dt>
              <dd className="font-mono font-medium mt-0.5">{etude.epaisseur_totale_max_cm} cm</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Résultats */}
      {res ? (
        <>
          {/* Synthèse */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="carte text-center">
              <p className="text-xs text-slate-500 mb-1">Classe trafic</p>
              <p className="text-2xl font-bold font-mono text-primaire-700">{res.classe_trafic}</p>
            </div>
            <div className="carte text-center">
              <p className="text-xs text-slate-500 mb-1">Classe plateforme</p>
              <p className="text-2xl font-bold font-mono text-primaire-700">{res.classe_plateforme}</p>
            </div>
            <div className="carte text-center">
              <p className="text-xs text-slate-500 mb-1">Structure</p>
              <p className="text-xl font-bold text-primaire-700">{res.type_structure}</p>
            </div>
            <div className="carte text-center">
              <p className="text-xs text-slate-500 mb-1">Épaisseur totale</p>
              <p className="text-2xl font-bold font-mono text-primaire-700">{res.epaisseur_totale_cm} cm</p>
            </div>
          </div>

          {/* Couches */}
          <div className="carte">
            <h2 className="mb-4 flex items-center gap-2">
              <Layers size={16} /> Structure de chaussée
            </h2>
            <div className="space-y-2">
              {res.couches.map((couche, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                  <div>
                    <p className="font-medium text-sm">{couche.designation}</p>
                    <p className="text-xs text-slate-400">{couche.materiau}</p>
                  </div>
                  <span className="font-mono text-sm font-semibold text-primaire-700">
                    {couche.epaisseur_cm} cm
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between px-3 pt-2 border-t border-slate-200">
                <span className="text-sm font-semibold text-slate-700">Total</span>
                <span className="font-mono text-sm font-bold text-primaire-700">{res.epaisseur_totale_cm} cm</span>
              </div>
            </div>
          </div>

          {/* Justification et avertissements */}
          {(res.justification || res.avertissements.length > 0) && (
            <div className="carte space-y-3">
              {res.justification && (
                <div>
                  <p className="text-xs text-slate-500 mb-1">Justification ({res.methode})</p>
                  <p className="text-sm text-slate-700">{res.justification}</p>
                </div>
              )}
              {res.avertissements.length > 0 && (
                <div>
                  <p className="text-xs text-orange-500 font-medium mb-1">Avertissements</p>
                  <ul className="space-y-1">
                    {res.avertissements.map((a, i) => (
                      <li key={i} className="text-sm text-orange-600 flex items-start gap-1">
                        <AlertCircle size={12} className="mt-0.5 shrink-0" /> {a}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="carte py-10 text-center text-slate-400 space-y-3">
          <p className="text-sm">Aucun résultat de calcul — lancez le dimensionnement.</p>
          <button onClick={() => calculer()} disabled={isPending} className="btn-primaire text-xs">
            <Calculator size={12} className="inline mr-1" />
            {isPending ? "Calcul en cours…" : "Lancer le calcul"}
          </button>
        </div>
      )}

      {etude.observations && (
        <div className="carte text-sm text-slate-600">
          <p className="text-xs text-slate-400 mb-1">Observations</p>
          <p>{etude.observations}</p>
        </div>
      )}
    </div>
  );
}
