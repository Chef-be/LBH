"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ErreurApi } from "@/crochets/useApi";
import { Plus, TrendingUp, LineChart, RefreshCw } from "lucide-react";

interface Indice {
  id: string;
  code: string;
  valeur: number;
  date_publication: string;
  source: string;
}

const LIBELLES_INDICES: Record<string, string> = {
  BTM:  "BTM — Bâtiment Tous Métiers (agrégé)",
  TPM:  "TPM — Travaux Publics Tous Métiers (agrégé)",
  BT01: "BT01 — Gros œuvre / Bâtiment général",
  BT02: "BT02 — Maçonnerie",
  BT10: "BT10 — Charpente bois",
  BT20: "BT20 — Couverture",
  BT28: "BT28 — Peinture",
  BT37: "BT37 — Menuiserie bois",
  BT40: "BT40 — Serrurerie",
  BT50: "BT50 — Plomberie",
  BT51: "BT51 — CVC / Chauffage",
  BT60: "BT60 — Électricité",
  TP01: "TP01 — Terrassements",
  TP05: "TP05 — Canalisations",
  TP09: "TP09 — Béton hydraulique",
};

function formaterMontant(v: number): string {
  return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 2 }).format(v);
}

export default function GestionIndices() {
  const queryClient = useQueryClient();
  const [formVisible, setFormVisible] = useState(false);
  const [form, setForm] = useState({
    code: "BT01",
    valeur: "",
    date_publication: "",
    source: "INSEE",
  });
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);

  const { data: courantsData } = useQuery({
    queryKey: ["indices-courants"],
    queryFn: () => api.get("/api/ressources/indices/courants/"),
  });
  const courants: Indice[] = Array.isArray(courantsData) ? courantsData : [];

  const { data: tousData, isLoading } = useQuery({
    queryKey: ["indices-tous"],
    queryFn: () => api.get("/api/ressources/indices/"),
  });
  const tous: Indice[] = Array.isArray(tousData) ? tousData : ((tousData as { results?: Indice[] })?.results ?? []);

  const sauvegarder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.valeur || !form.date_publication) {
      setErreur("Valeur et date sont obligatoires.");
      return;
    }
    setEnvoi(true);
    setErreur(null);
    try {
      await api.post("/api/ressources/indices/", {
        code: form.code,
        valeur: parseFloat(form.valeur),
        date_publication: form.date_publication,
        source: form.source,
      });
      setSucces("Indice enregistré.");
      setFormVisible(false);
      setForm({ code: "BT01", valeur: "", date_publication: "", source: "INSEE" });
      queryClient.invalidateQueries({ queryKey: ["indices-courants"] });
      queryClient.invalidateQueries({ queryKey: ["indices-tous"] });
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Erreur d'enregistrement.");
    } finally {
      setEnvoi(false);
    }
  };

  // Grouper par code
  const parCode: Record<string, Indice[]> = {};
  for (const indice of tous) {
    if (!parCode[indice.code]) parCode[indice.code] = [];
    parCode[indice.code].push(indice);
  }

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Indices BT / TP</h1>
          <p className="text-slate-500 text-sm mt-1">
            Historique des indices publiés par l&apos;INSEE pour l&apos;actualisation et la révision des prix.
            <br />
            Formule révision CCAG 2021 : P = P₀ × [0,125 + 0,875 × (BT/BT₀)]
          </p>
        </div>
        <button
          type="button"
          className="btn-primaire text-sm"
          onClick={() => setFormVisible(!formVisible)}
        >
          <Plus className="h-4 w-4" />
          Ajouter un indice
        </button>
      </div>

      {succes && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{succes}</div>
      )}

      {/* Formulaire */}
      {formVisible && (
        <form onSubmit={sauvegarder} className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
          <h2 className="font-semibold text-slate-800">Nouveau relevé d&apos;indice</h2>
          {erreur && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erreur}</div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="etiquette-champ">Code d&apos;indice</label>
              <select
                className="champ-saisie"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              >
                {Object.entries(LIBELLES_INDICES).map(([code, lib]) => (
                  <option key={code} value={code}>{lib}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="etiquette-champ">Valeur (base 100 = janvier 2010)</label>
              <input
                type="number"
                step="0.01"
                className="champ-saisie"
                placeholder="ex. 133.7"
                value={form.valeur}
                onChange={(e) => setForm({ ...form, valeur: e.target.value })}
              />
            </div>
            <div>
              <label className="etiquette-champ">Date de publication</label>
              <input
                type="date"
                className="champ-saisie"
                value={form.date_publication}
                onChange={(e) => setForm({ ...form, date_publication: e.target.value })}
              />
            </div>
            <div>
              <label className="etiquette-champ">Source</label>
              <input
                type="text"
                className="champ-saisie"
                value={form.source}
                onChange={(e) => setForm({ ...form, source: e.target.value })}
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button type="submit" className="btn-primaire text-sm" disabled={envoi}>
              {envoi ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : null}
              Enregistrer
            </button>
            <button type="button" className="btn-secondaire text-sm" onClick={() => setFormVisible(false)}>
              Annuler
            </button>
          </div>
        </form>
      )}

      {/* Valeurs courantes */}
      {courants.length > 0 && (
        <div>
          <h2 className="font-semibold text-slate-800 mb-3">Valeurs courantes</h2>
          <div className="grid grid-cols-4 gap-3">
            {courants.map((indice) => (
              <div key={indice.id} className="rounded-xl border border-slate-200 bg-white p-3 text-center">
                <p className="font-mono font-bold text-indigo-600 text-sm">{indice.code}</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">{formaterMontant(indice.valeur)}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {new Date(indice.date_publication).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Historique par code */}
      {isLoading ? (
        <div className="py-12 text-center text-slate-400 text-sm">Chargement…</div>
      ) : Object.keys(parCode).length === 0 ? (
        <div className="py-16 text-center border border-dashed border-slate-200 rounded-2xl">
          <LineChart className="h-8 w-8 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Aucun indice enregistré.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <h2 className="font-semibold text-slate-800">Historique</h2>
          {Object.entries(parCode).map(([code, indices]) => (
            <div key={code} className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-indigo-500" />
                <span className="font-mono font-bold text-indigo-600 text-sm">{code}</span>
                <span className="text-xs text-slate-400">{LIBELLES_INDICES[code]?.split(" — ")[1] || ""}</span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-50 text-xs text-slate-400">
                    <th className="text-left py-2 px-4 font-medium">Date de publication</th>
                    <th className="text-right py-2 px-4 font-medium">Valeur</th>
                    <th className="text-right py-2 px-4 font-medium">Variation</th>
                    <th className="text-left py-2 px-4 font-medium">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {indices.map((indice, i) => {
                    const precedent = indices[i + 1];
                    const variation = precedent ? ((indice.valeur - precedent.valeur) / precedent.valeur) * 100 : null;
                    return (
                      <tr key={indice.id} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="py-2 px-4 text-slate-600">
                          {new Date(indice.date_publication).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
                        </td>
                        <td className="py-2 px-4 text-right font-mono font-bold text-slate-800">
                          {formaterMontant(indice.valeur)}
                        </td>
                        <td className="py-2 px-4 text-right text-xs">
                          {variation !== null ? (
                            <span className={variation >= 0 ? "text-orange-500" : "text-green-600"}>
                              {variation >= 0 ? "+" : ""}{variation.toFixed(2)}%
                            </span>
                          ) : "—"}
                        </td>
                        <td className="py-2 px-4 text-xs text-slate-400">{indice.source}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
