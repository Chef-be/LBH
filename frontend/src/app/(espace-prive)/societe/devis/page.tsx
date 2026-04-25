"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/crochets/useApi";
import { DevisHonoraires } from "@/types/societe";
import { Plus, FileText, ChevronRight } from "lucide-react";

function formaterMontant(val: string): string {
  const n = parseFloat(val);
  if (isNaN(n)) return "—";
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 0 }) + " €";
}

function formaterDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const STATUTS_COULEUR: Record<string, { bg: string; text: string; label: string }> = {
  brouillon: { bg: "var(--fond-entree)", text: "var(--texte-3)", label: "Brouillon" },
  envoye: { bg: "color-mix(in srgb, #f59e0b 12%, var(--fond-carte))", text: "#f59e0b", label: "Envoyé" },
  accepte: { bg: "color-mix(in srgb, #10b981 12%, var(--fond-carte))", text: "#10b981", label: "Accepté" },
  refuse: { bg: "color-mix(in srgb, #ef4444 12%, var(--fond-carte))", text: "#ef4444", label: "Refusé" },
  expire: { bg: "var(--fond-entree)", text: "var(--texte-3)", label: "Expiré" },
  annule: { bg: "var(--fond-entree)", text: "var(--texte-3)", label: "Annulé" },
};

const FILTRES = ["tous", "brouillon", "envoye", "accepte", "refuse"] as const;
type Filtre = typeof FILTRES[number];

export default function PageListeDevis() {
  const [filtre, setFiltre] = useState<Filtre>("tous");

  const { data: devis = [], isLoading } = useQuery<DevisHonoraires[]>({
    queryKey: ["devis", filtre],
    queryFn: async () => {
      const url = filtre === "tous" ? "/api/societe/devis/" : `/api/societe/devis/?statut=${filtre}`;
      const r = await api.get<{ results?: DevisHonoraires[] } | DevisHonoraires[]>(url);
      return Array.isArray(r) ? r : (r.results ?? []);
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 style={{ color: "var(--texte)" }}>Devis d&apos;honoraires</h2>
          <p className="text-sm mt-1" style={{ color: "var(--texte-3)" }}>
            {devis.length} devis{filtre !== "tous" ? ` (${STATUTS_COULEUR[filtre]?.label ?? filtre})` : ""}
          </p>
        </div>
        <Link
          href="/societe/devis/nouveau"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
          style={{ background: "var(--c-base)" }}
        >
          <Plus size={14} /> Nouvelle affaire
        </Link>
      </div>

      {/* Filtres */}
      <div className="flex gap-2 flex-wrap">
        {FILTRES.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFiltre(f)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition"
            style={{
              background: filtre === f ? "var(--c-base)" : "var(--fond-entree)",
              color: filtre === f ? "white" : "var(--texte-2)",
              border: filtre === f ? "none" : "1px solid var(--bordure)",
            }}
          >
            {f === "tous" ? "Tous" : STATUTS_COULEUR[f]?.label ?? f}
          </button>
        ))}
      </div>

      {isLoading && (
        <p className="text-sm py-8 text-center" style={{ color: "var(--texte-3)" }}>Chargement…</p>
      )}

      {!isLoading && devis.length === 0 && (
        <div
          className="rounded-xl border-2 border-dashed flex flex-col items-center py-16 gap-4"
          style={{ borderColor: "var(--bordure)" }}
        >
          <FileText size={32} style={{ color: "var(--texte-3)" }} />
          <div className="text-center">
            <p className="font-medium" style={{ color: "var(--texte)" }}>Aucun devis</p>
            <p className="text-sm mt-1" style={{ color: "var(--texte-3)" }}>
              Créez votre premier devis d&apos;honoraires
            </p>
          </div>
          <Link
            href="/societe/devis/nouveau"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ background: "var(--c-base)" }}
          >
            <Plus size={14} /> Nouvelle affaire
          </Link>
        </div>
      )}

      {devis.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--bordure)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "var(--fond-entree)", borderBottom: "1px solid var(--bordure)" }}>
                {["Référence", "Client", "Mission", "Montant TTC", "Émis le", "Valable jusqu'au", "Statut", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--texte-3)" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {devis.map((d) => {
                const style = STATUTS_COULEUR[d.statut] ?? STATUTS_COULEUR.brouillon;
                return (
                  <tr
                    key={d.id}
                    style={{ borderBottom: "1px solid var(--bordure)" }}
                    className="hover:opacity-80 transition-opacity"
                  >
                    <td className="px-4 py-3 font-mono font-medium" style={{ color: "var(--texte)" }}>
                      {d.reference}
                    </td>
                    <td className="px-4 py-3" style={{ color: "var(--texte)" }}>{d.client_nom}</td>
                    <td className="px-4 py-3 max-w-xs truncate" style={{ color: "var(--texte-2)" }}>{d.intitule}</td>
                    <td className="px-4 py-3 font-mono font-bold" style={{ color: "var(--texte)" }}>
                      {formaterMontant(d.montant_ttc)}
                    </td>
                    <td className="px-4 py-3" style={{ color: "var(--texte-2)" }}>{formaterDate(d.date_emission)}</td>
                    <td className="px-4 py-3" style={{ color: "var(--texte-2)" }}>{formaterDate(d.date_validite)}</td>
                    <td className="px-4 py-3">
                      <span
                        className="px-2 py-1 rounded-full text-xs font-semibold"
                        style={{ background: style.bg, color: style.text }}
                      >
                        {d.statut_libelle}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/societe/devis/${d.id}`}
                        className="inline-flex items-center gap-1 text-xs font-medium"
                        style={{ color: "var(--c-base)" }}
                      >
                        Ouvrir <ChevronRight size={12} />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
