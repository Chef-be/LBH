"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { api, ErreurApi } from "@/crochets/useApi";
import {
  Upload, RefreshCw, BarChart3, Building2, Layers,
  CheckCircle2, AlertCircle, Clock, X, Plus, Edit2,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FicheRatioCout {
  id: string;
  intitule: string;
  type_projet: string;
  localite: string;
  annee_reference: number | null;
  shon: number | null;
  shab: number | null;
  emprise_sol: number | null;
  nombre_niveaux_hors_sol: number | null;
  nombre_niveaux_sous_sol: number;
  type_fondation: string;
  cout_total_ht: number | null;
  cout_infrastructure_ht: number | null;
  cout_superstructure_ht: number | null;
  cout_m2_shon: number | null;
  cout_m2_shab: number | null;
  ratio_infra_pct: number | null;
  ratio_supra_pct: number | null;
  reference_externe: string;
  observations: string;
  date_creation: string;
}

interface RatiosReference {
  ratios: Record<string, { min: number; max: number; moyenne: number; unite: string }>;
  facteurs_fondation: Record<string, { facteur: number; note: string }>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formaterMontant(v: number | null | undefined): string {
  if (v == null) return "—";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
}

function formaterSurface(v: number | null | undefined): string {
  if (v == null) return "—";
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(v)} m²`;
}

const LIBELLES_FONDATION: Record<string, string> = {
  superficielle_semelle: "Semelles superficielles",
  superficielle_radier: "Radier général",
  profonde_pieux_beton: "Pieux béton forés",
  profonde_pieux_metalliques: "Pieux métalliques",
  profonde_micropieux: "Micropieux",
  profonde_paroi_moulee: "Paroi moulée",
  non_identifie: "Non identifié",
};

const LIBELLES_PROJET: Record<string, string> = {
  logement_collectif: "Logement collectif",
  logement_individuel: "Logement individuel",
  bureaux: "Bureaux",
  equipement_scolaire: "Équipement scolaire",
  equipement_sportif: "Équipement sportif",
  equipement_culturel: "Équipement culturel",
  commerce: "Commerce",
  industrie: "Industrie",
  sante: "Santé",
  vrd_amenagements: "VRD / Aménagements",
  autre: "Autre",
};

// ---------------------------------------------------------------------------
// Carte fiche ratio
// ---------------------------------------------------------------------------

function CarteFicheRatio({
  fiche,
  ratiosRef,
  onSupprimer,
}: {
  fiche: FicheRatioCout;
  ratiosRef: RatiosReference | null;
  onSupprimer: (id: string) => void;
}) {
  const ratioRef = ratiosRef?.ratios[fiche.type_projet];
  const facteurFond = ratiosRef?.facteurs_fondation[fiche.type_fondation];

  const coherence = fiche.cout_m2_shon && ratioRef
    ? fiche.cout_m2_shon >= ratioRef.min && fiche.cout_m2_shon <= ratioRef.max
      ? "vert"
      : fiche.cout_m2_shon < ratioRef.min * 0.8 || fiche.cout_m2_shon > ratioRef.max * 1.3
        ? "rouge"
        : "orange"
    : null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      {/* En-tête */}
      <div className="px-5 py-4 border-b border-slate-100">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-semibold text-slate-800">{fiche.intitule}</p>
            <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
              <span className="bg-slate-100 rounded-full px-2 py-0.5 font-medium text-slate-600">
                {LIBELLES_PROJET[fiche.type_projet] || fiche.type_projet}
              </span>
              {fiche.localite && <span>{fiche.localite}</span>}
              {fiche.annee_reference && <span>Réf. {fiche.annee_reference}</span>}
            </div>
          </div>
          <button
            type="button"
            className="rounded p-1 hover:bg-red-50 text-slate-400 hover:text-red-500"
            onClick={() => onSupprimer(fiche.id)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Corps */}
      <div className="px-5 py-4 grid grid-cols-3 gap-5">
        {/* Surfaces */}
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Surfaces</h4>
          <dl className="space-y-1 text-xs">
            <div className="flex justify-between">
              <dt className="text-slate-500">SHON</dt>
              <dd className="font-mono font-medium text-slate-800">{formaterSurface(fiche.shon)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">SHAB</dt>
              <dd className="font-mono font-medium text-slate-800">{formaterSurface(fiche.shab)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Emprise sol</dt>
              <dd className="font-mono font-medium text-slate-800">{formaterSurface(fiche.emprise_sol)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Niveaux HS/SS</dt>
              <dd className="font-mono font-medium text-slate-800">
                R+{fiche.nombre_niveaux_hors_sol ?? "?"} / {fiche.nombre_niveaux_sous_sol > 0 ? `-${fiche.nombre_niveaux_sous_sol}` : "—"}
              </dd>
            </div>
          </dl>
        </div>

        {/* Coûts */}
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Coûts</h4>
          <dl className="space-y-1 text-xs">
            <div className="flex justify-between">
              <dt className="text-slate-500">Total HT</dt>
              <dd className="font-mono font-semibold text-slate-800">{formaterMontant(fiche.cout_total_ht)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Infrastructure</dt>
              <dd className="font-mono text-slate-600">{formaterMontant(fiche.cout_infrastructure_ht)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Superstructure</dt>
              <dd className="font-mono text-slate-600">{formaterMontant(fiche.cout_superstructure_ht)}</dd>
            </div>
            {fiche.ratio_infra_pct && (
              <div className="mt-2">
                <div className="flex h-2 rounded-full overflow-hidden bg-slate-200">
                  <div
                    style={{ width: `${fiche.ratio_infra_pct}%` }}
                    className="bg-amber-400"
                    title={`Infrastructure ${fiche.ratio_infra_pct.toFixed(1)}%`}
                  />
                  <div
                    style={{ width: `${fiche.ratio_supra_pct || (100 - fiche.ratio_infra_pct)}%` }}
                    className="bg-indigo-400"
                    title={`Superstructure ${fiche.ratio_supra_pct?.toFixed(1)}%`}
                  />
                </div>
                <div className="flex justify-between mt-0.5 text-slate-400 text-xs">
                  <span>Infra {fiche.ratio_infra_pct.toFixed(0)}%</span>
                  <span>Supra {(fiche.ratio_supra_pct || (100 - fiche.ratio_infra_pct)).toFixed(0)}%</span>
                </div>
              </div>
            )}
          </dl>
        </div>

        {/* Ratios et cohérence */}
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Ratios</h4>
          <div className="space-y-2">
            {fiche.cout_m2_shon && (
              <div className={clsx(
                "rounded-xl px-3 py-2 text-center border",
                coherence === "vert" ? "bg-green-50 border-green-200" :
                coherence === "orange" ? "bg-orange-50 border-orange-200" :
                coherence === "rouge" ? "bg-red-50 border-red-200" :
                "bg-slate-50 border-slate-200"
              )}>
                <p className="text-xs text-slate-400">Coût/m² SHON</p>
                <p className="text-xl font-bold font-mono text-slate-800 mt-0.5">
                  {new Intl.NumberFormat("fr-FR").format(Math.round(fiche.cout_m2_shon))} €
                </p>
                {ratioRef && (
                  <p className="text-xs text-slate-400 mt-0.5">
                    Réf. {ratioRef.min.toLocaleString("fr-FR")} – {ratioRef.max.toLocaleString("fr-FR")} €/m²
                  </p>
                )}
              </div>
            )}
            {fiche.cout_m2_shab && (
              <div className="rounded-xl px-3 py-2 text-center bg-slate-50 border border-slate-200">
                <p className="text-xs text-slate-400">Coût/m² SHAB</p>
                <p className="text-lg font-bold font-mono text-slate-700">
                  {new Intl.NumberFormat("fr-FR").format(Math.round(fiche.cout_m2_shab))} €
                </p>
              </div>
            )}
          </div>

          {/* Fondation */}
          <div className="mt-2 text-xs">
            <span className="text-slate-400">Fondation : </span>
            <span className="font-medium text-slate-700">{LIBELLES_FONDATION[fiche.type_fondation] || fiche.type_fondation}</span>
            {facteurFond && facteurFond.facteur !== 1.00 && (
              <span className="ml-1 text-orange-500">{facteurFond.note}</span>
            )}
          </div>
        </div>
      </div>

      {fiche.observations && (
        <div className="px-5 pb-4 text-xs text-slate-400 italic border-t border-slate-50 pt-3">
          {fiche.observations}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Composant principal
// ---------------------------------------------------------------------------

export default function BanqueEstimations() {
  const queryClient = useQueryClient();
  const [enUpload, setEnUpload] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [erreurUpload, setErreurUpload] = useState<string | null>(null);
  const [filtreType, setFiltreType] = useState("");

  const { data: fichesData, isLoading } = useQuery({
    queryKey: ["fiches-ratio", filtreType],
    queryFn: () => {
      const p = new URLSearchParams();
      if (filtreType) p.set("type_projet", filtreType);
      return api.get(`/api/ressources/fiches-ratio/?${p.toString()}`);
    },
  });
  const fiches: FicheRatioCout[] = Array.isArray(fichesData) ? fichesData : ((fichesData as { results?: FicheRatioCout[] })?.results ?? []);

  const { data: ratiosRef } = useQuery<RatiosReference>({
    queryKey: ["ratios-reference"],
    queryFn: () => api.get("/api/ressources/fiches-ratio/references/"),
  });

  const uploaderFichier = async (fichier: File) => {
    setEnUpload(true);
    setErreurUpload(null);
    const data = new FormData();
    data.append("fichier", fichier);
    try {
      await api.post("/api/ressources/estimations/", data);
      queryClient.invalidateQueries({ queryKey: ["fiches-ratio"] });
    } catch (e) {
      setErreurUpload(e instanceof ErreurApi ? e.detail : "Téléversement impossible.");
    } finally {
      setEnUpload(false);
    }
  };

  const supprimerFiche = async (id: string) => {
    if (!window.confirm("Supprimer cette fiche ratio ?")) return;
    try {
      await api.supprimer(`/api/ressources/fiches-ratio/${id}/`);
      queryClient.invalidateQueries({ queryKey: ["fiches-ratio"] });
    } catch (e) {
      alert(e instanceof ErreurApi ? e.detail : "Suppression impossible.");
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Estimations &amp; Fiches ratio</h1>
        <p className="text-slate-500 text-sm mt-1">
          Capitalisez vos estimations de coût par m² SHON/SHAB, type de fondation et programme.
          Téléversez PDF, images ou archives pour extraction automatique.
        </p>
      </div>

      {/* Zone upload */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="font-semibold text-slate-800 mb-4">Téléverser une estimation</h2>
        <div
          className={clsx(
            "border-2 border-dashed rounded-2xl p-8 text-center transition-colors cursor-pointer",
            isDragOver ? "border-indigo-400 bg-indigo-50" : "border-slate-300 hover:border-indigo-300 hover:bg-slate-50"
          )}
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragOver(false);
            const f = e.dataTransfer.files[0];
            if (f) uploaderFichier(f);
          }}
          onClick={() => document.getElementById("input-fichier-estim")?.click()}
        >
          <input
            id="input-fichier-estim"
            type="file"
            className="hidden"
            accept=".pdf,.jpg,.jpeg,.png,.zip,.rar,.xlsx,.xls"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) uploaderFichier(f); }}
          />
          {enUpload ? (
            <div className="flex flex-col items-center gap-2">
              <RefreshCw className="h-8 w-8 text-indigo-500 animate-spin" />
              <p className="text-sm text-indigo-600 font-medium">Analyse en cours…</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload className="h-8 w-8 text-slate-400" />
              <p className="text-sm font-medium text-slate-600">
                Glissez-déposez un fichier ou cliquez pour parcourir
              </p>
              <p className="text-xs text-slate-400">PDF, JPG/PNG, ZIP/RAR, XLSX</p>
              <p className="text-xs text-slate-400 mt-1">
                Le service d&apos;analyse extrait automatiquement : surfaces de plancher, emprise au sol,
                niveaux, type de fondation, montant estimé
              </p>
            </div>
          )}
        </div>
        {erreurUpload && (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {erreurUpload}
          </div>
        )}
      </div>

      {/* Ratios de référence marché */}
      {ratiosRef && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-800 mb-3">Ratios de référence marché 2025</h2>
          <div className="grid grid-cols-4 gap-3">
            {Object.entries(ratiosRef.ratios).slice(0, 4).map(([type, ref]) => (
              <div key={type} className="rounded-xl bg-slate-50 border border-slate-100 p-3 text-center">
                <p className="text-xs text-slate-400 mb-1">{LIBELLES_PROJET[type] || type}</p>
                <p className="font-bold font-mono text-slate-800 text-sm">
                  {ref.moyenne.toLocaleString("fr-FR")} €
                </p>
                <p className="text-xs text-slate-400">{ref.min.toLocaleString("fr-FR")} – {ref.max.toLocaleString("fr-FR")}</p>
                <p className="text-xs text-slate-400">{ref.unite}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filtres */}
      <div className="flex gap-3">
        <select
          className="champ-saisie w-auto text-sm"
          value={filtreType}
          onChange={(e) => setFiltreType(e.target.value)}
        >
          <option value="">Tous les types de projet</option>
          {Object.entries(LIBELLES_PROJET).map(([val, lib]) => (
            <option key={val} value={val}>{lib}</option>
          ))}
        </select>
      </div>

      {/* Fiches */}
      {isLoading ? (
        <div className="py-12 text-center text-slate-400 text-sm">Chargement…</div>
      ) : fiches.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-slate-200 rounded-2xl">
          <BarChart3 className="h-8 w-8 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">
            Aucune fiche ratio disponible.<br />
            Téléversez des estimations pour démarrer la capitalisation.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {fiches.map((fiche) => (
            <CarteFicheRatio
              key={fiche.id}
              fiche={fiche}
              ratiosRef={ratiosRef ?? null}
              onSupprimer={supprimerFiche}
            />
          ))}
        </div>
      )}
    </div>
  );
}
