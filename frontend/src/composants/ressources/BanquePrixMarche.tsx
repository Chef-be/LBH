"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { api, ErreurApi } from "@/crochets/useApi";
import {
  Search, TrendingUp, RefreshCw, BookOpen, CheckCircle2,
  ArrowUpRight, Filter, ChevronDown, ChevronRight,
} from "lucide-react";

interface LignePrixMarche {
  id: string;
  designation: string;
  unite: string;
  prix_ht_original: number;
  prix_ht_actualise: number | null;
  date_indice_actualisation: string | null;
  indice_code: string;
  indice_valeur_base: number | null;
  indice_valeur_actuelle: number | null;
  localite: string;
  corps_etat: string;
  corps_etat_libelle: string;
  kpv_estime: number | null;
  pct_mo_estime: number | null;
  pct_materiaux_estime: number | null;
  pct_materiel_estime: number | null;
  est_ligne_commune: boolean;
  nb_occurrences: number;
  ligne_bibliotheque: string | null;
}

function formaterMontant(v: number | null | undefined): string {
  if (v == null) return "—";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2 }).format(v);
}

function classeKpv(kpv: number): string {
  if (kpv <= 0) return "text-slate-400";
  if (kpv < 1.10) return "text-red-600";
  if (kpv < 1.25) return "text-orange-500";
  if (kpv <= 1.55) return "text-green-600";
  if (kpv <= 2.00) return "text-orange-500";
  return "text-red-600";
}

const CORPS_ETAT_OPTIONS = [
  { value: "", label: "Tous les corps d'état" },
  { value: "GO", label: "Gros œuvre" },
  { value: "TERR", label: "Terrassements" },
  { value: "VRD", label: "VRD" },
  { value: "CHCZ", label: "Charpente / Couverture" },
  { value: "ETAN", label: "Étanchéité" },
  { value: "FAC", label: "Façades / ITE" },
  { value: "MENUEXT", label: "Menuiseries extérieures" },
  { value: "MENUINT", label: "Menuiseries intérieures" },
  { value: "IPP", label: "Isolation / Plâtrerie / Peinture" },
  { value: "RSC", label: "Revêtements de sol" },
  { value: "ELEC", label: "Électricité" },
  { value: "PLB", label: "Plomberie" },
  { value: "CVC", label: "CVC" },
  { value: "PAY", label: "Paysager" },
];

function LignePrixRow({ ligne, onCapitaliser }: { ligne: LignePrixMarche; onCapitaliser: (id: string) => void }) {
  const [deplie, setDeplie] = useState(false);
  const variation = ligne.prix_ht_actualise && ligne.prix_ht_original
    ? ((ligne.prix_ht_actualise - ligne.prix_ht_original) / ligne.prix_ht_original) * 100
    : 0;

  return (
    <>
      <tr
        className="border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer"
        onClick={() => setDeplie(!deplie)}
      >
        <td className="py-3 pr-4">
          <div className="flex items-center gap-2">
            {deplie ? <ChevronDown className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />}
            <div>
              <p className="font-medium text-slate-800 text-sm">{ligne.designation.length > 60 ? `${ligne.designation.slice(0, 60)}…` : ligne.designation}</p>
              <p className="text-xs text-slate-400 mt-0.5">{ligne.corps_etat_libelle || ligne.corps_etat || "Non classifié"}</p>
            </div>
          </div>
        </td>
        <td className="py-3 pr-4 text-xs text-slate-500 font-mono">{ligne.unite || "—"}</td>
        <td className="py-3 pr-4 text-right">
          <p className="font-mono font-bold text-slate-800 text-sm">{formaterMontant(ligne.prix_ht_original)}</p>
        </td>
        <td className="py-3 pr-4 text-right">
          {ligne.prix_ht_actualise ? (
            <div>
              <p className="font-mono font-bold text-indigo-700 text-sm">{formaterMontant(ligne.prix_ht_actualise)}</p>
              {Math.abs(variation) > 0.1 && (
                <p className={clsx("text-xs flex items-center justify-end gap-0.5", variation > 0 ? "text-orange-500" : "text-green-600")}>
                  <ArrowUpRight className="h-3 w-3" />
                  {variation > 0 ? "+" : ""}{variation.toFixed(1)}%
                </p>
              )}
            </div>
          ) : <span className="text-slate-300">—</span>}
        </td>
        <td className="py-3 pr-4 text-xs text-slate-500">{ligne.localite || "—"}</td>
        <td className="py-3 pr-4 text-xs font-mono text-slate-500">
          {ligne.indice_code}
          {ligne.indice_valeur_base && <span className="text-slate-300 ml-1">= {ligne.indice_valeur_base}</span>}
        </td>
        <td className="py-3 text-right">
          <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
            {ligne.est_ligne_commune && (
              <span className="text-xs bg-indigo-50 text-indigo-600 rounded-full px-2 py-0.5">×{ligne.nb_occurrences}</span>
            )}
            {ligne.ligne_bibliotheque ? (
              <span className="text-xs bg-green-50 text-green-600 rounded-full px-2 py-0.5 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Capitalisé
              </span>
            ) : (
              <button
                type="button"
                className="btn-secondaire text-xs"
                onClick={() => onCapitaliser(ligne.id)}
              >
                <BookOpen className="h-3 w-3" />
                Capitaliser
              </button>
            )}
          </div>
        </td>
      </tr>
      {deplie && (
        <tr className="bg-slate-50 border-b border-slate-100">
          <td colSpan={7} className="px-8 py-4">
            <div className="grid grid-cols-3 gap-4 text-xs">
              <div>
                <p className="text-slate-400 mb-1 font-medium">SDP estimé</p>
                <div className="space-y-0.5">
                  <div className="flex justify-between"><span className="text-slate-500">MO</span><span className="font-mono text-indigo-600">{ligne.pct_mo_estime?.toFixed(0)}%</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Matériaux</span><span className="font-mono text-emerald-600">{ligne.pct_materiaux_estime?.toFixed(0)}%</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Matériel</span><span className="font-mono text-amber-600">{ligne.pct_materiel_estime?.toFixed(0)}%</span></div>
                </div>
              </div>
              <div>
                <p className="text-slate-400 mb-1 font-medium">Actualisation</p>
                <div className="space-y-0.5">
                  <div className="flex justify-between"><span className="text-slate-500">Indice base</span><span className="font-mono">{ligne.indice_valeur_base ?? "—"}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Indice actuel</span><span className="font-mono">{ligne.indice_valeur_actuelle ?? "—"}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Date</span><span className="font-mono">{ligne.date_indice_actualisation ? new Date(ligne.date_indice_actualisation).toLocaleDateString("fr-FR") : "—"}</span></div>
                </div>
              </div>
              <div>
                <p className="text-slate-400 mb-1 font-medium">Coefficient Kpv</p>
                {ligne.kpv_estime ? (
                  <p className={clsx("text-2xl font-bold font-mono", classeKpv(ligne.kpv_estime))}>
                    {ligne.kpv_estime.toFixed(3)}
                  </p>
                ) : <p className="text-slate-400">Non calculé</p>}
                <p className="text-slate-400 mt-1">Plage normale : 1.25 – 1.55</p>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function BanquePrixMarche() {
  const queryClient = useQueryClient();
  const [recherche, setRecherche] = useState("");
  const [filtreCorpsEtat, setFiltreCorpsEtat] = useState("");
  const [filtreLocalite, setFiltreLocalite] = useState("");
  const [actualisationEnCours, setActualisationEnCours] = useState(false);

  const params = new URLSearchParams();
  if (recherche) params.set("search", recherche);
  if (filtreCorpsEtat) params.set("corps_etat", filtreCorpsEtat);
  if (filtreLocalite) params.set("localite", filtreLocalite);

  const { data, isLoading } = useQuery({
    queryKey: ["prix-marche", recherche, filtreCorpsEtat, filtreLocalite],
    queryFn: () => api.get(`/api/ressources/prix-marche/?${params.toString()}`),
  });
  const lignes: LignePrixMarche[] = Array.isArray(data) ? data : ((data as { results?: LignePrixMarche[] })?.results ?? []);

  const capitaliser = async (id: string) => {
    try {
      await api.post(`/api/ressources/prix-marche/${id}/capitaliser/`, {});
      queryClient.invalidateQueries({ queryKey: ["prix-marche"] });
    } catch (e) {
      alert(e instanceof ErreurApi ? e.detail : "Erreur lors de la capitalisation.");
    }
  };

  const actualiserTous = async () => {
    setActualisationEnCours(true);
    try {
      const res = await api.post<{ detail: string }>("/api/ressources/prix-marche/actualiser/", { code_indice: "BT01" });
      queryClient.invalidateQueries({ queryKey: ["prix-marche"] });
      alert(res.detail);
    } catch (e) {
      alert(e instanceof ErreurApi ? e.detail : "Erreur.");
    } finally {
      setActualisationEnCours(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Banque de prix marché</h1>
          <p className="text-slate-500 text-sm mt-1">
            Prix extraits de devis analysés, sectorisés par localité et corps d&apos;état.
            Actualisés automatiquement avec les indices BT/TP.
          </p>
        </div>
        <button
          type="button"
          className="btn-secondaire text-sm"
          onClick={actualiserTous}
          disabled={actualisationEnCours}
        >
          <RefreshCw className={clsx("h-4 w-4", actualisationEnCours && "animate-spin")} />
          Actualiser BT01
        </button>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            placeholder="Rechercher une prestation…"
            className="champ-saisie pl-8 text-sm"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
          />
        </div>
        <select
          className="champ-saisie w-auto text-sm"
          value={filtreCorpsEtat}
          onChange={(e) => setFiltreCorpsEtat(e.target.value)}
        >
          {CORPS_ETAT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <input
          type="text"
          className="champ-saisie text-sm w-48"
          placeholder="Localité…"
          value={filtreLocalite}
          onChange={(e) => setFiltreLocalite(e.target.value)}
        />
      </div>

      {/* Tableau */}
      {isLoading ? (
        <div className="py-12 text-center text-slate-400 text-sm">Chargement…</div>
      ) : lignes.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-slate-200 rounded-2xl">
          <TrendingUp className="h-8 w-8 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">
            Aucun prix marché disponible.
            <br />
            Analysez des devis pour alimenter cette banque de données.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs text-slate-500">
                <th className="text-left py-3 px-4 font-medium">Désignation</th>
                <th className="text-left py-3 pr-4 font-medium">Unité</th>
                <th className="text-right py-3 pr-4 font-medium">Prix original</th>
                <th className="text-right py-3 pr-4 font-medium">Prix actualisé</th>
                <th className="text-left py-3 pr-4 font-medium">Localité</th>
                <th className="text-left py-3 pr-4 font-medium">Indice</th>
                <th className="text-right py-3 pr-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((ligne) => (
                <LignePrixRow key={ligne.id} ligne={ligne} onCapitaliser={capitaliser} />
              ))}
            </tbody>
          </table>
          <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-400">
            {lignes.length} ligne(s) — Prix actualisés avec l&apos;indice BT01 courant
          </div>
        </div>
      )}
    </div>
  );
}
