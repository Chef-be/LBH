"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/crochets/useApi";
import { Facture } from "@/types/societe";
import { Plus, Receipt, ChevronRight, AlertTriangle } from "lucide-react";

function formaterMontant(val: string): string {
  const n = parseFloat(val);
  return isNaN(n) ? "—" : n.toLocaleString("fr-FR", { minimumFractionDigits: 0 }) + " €";
}

function formaterDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const STATUTS_CONFIG: Record<string, { couleur: string; label: string }> = {
  brouillon: { couleur: "var(--texte-3)", label: "Brouillon" },
  emise: { couleur: "#3b82f6", label: "Émise" },
  en_retard: { couleur: "#ef4444", label: "En retard" },
  partiellement_payee: { couleur: "#f59e0b", label: "Part. payée" },
  payee: { couleur: "#10b981", label: "Payée" },
  annulee: { couleur: "var(--texte-3)", label: "Annulée" },
  avoir: { couleur: "var(--texte-3)", label: "Avoir" },
};

const FILTRES = ["tous", "emise", "en_retard", "partiellement_payee", "payee", "brouillon"] as const;
type Filtre = typeof FILTRES[number];

export default function PageListeFactures() {
  const [filtre, setFiltre] = useState<Filtre>("tous");

  const { data: factures = [], isLoading } = useQuery<Facture[]>({
    queryKey: ["factures", filtre],
    queryFn: async () => {
      const url = filtre === "tous" ? "/api/societe/factures/" : `/api/societe/factures/?statut=${filtre}`;
      const r = await api.get<{ results?: Facture[] } | Facture[]>(url);
      return Array.isArray(r) ? r : (r.results ?? []);
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 style={{ color: "var(--texte)" }}>Factures</h2>
          <p className="text-sm mt-1" style={{ color: "var(--texte-3)" }}>
            {factures.length} facture{factures.length > 1 ? "s" : ""}
          </p>
        </div>
        <Link
          href="/societe/factures/nouvelle"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
          style={{ background: "var(--c-base)" }}
        >
          <Plus size={14} /> Nouvelle facture
        </Link>
      </div>

      {/* Filtres */}
      <div className="flex gap-2 flex-wrap">
        {FILTRES.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFiltre(f)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1"
            style={{
              background: filtre === f ? "var(--c-base)" : "var(--fond-entree)",
              color: filtre === f ? "white" : "var(--texte-2)",
              border: filtre === f ? "none" : "1px solid var(--bordure)",
            }}
          >
            {f === "en_retard" && <AlertTriangle size={10} />}
            {f === "tous" ? "Toutes" : STATUTS_CONFIG[f]?.label ?? f}
          </button>
        ))}
      </div>

      {isLoading && <p className="text-sm py-8 text-center" style={{ color: "var(--texte-3)" }}>Chargement…</p>}

      {!isLoading && factures.length === 0 && (
        <div className="rounded-xl border-2 border-dashed flex flex-col items-center py-16 gap-4" style={{ borderColor: "var(--bordure)" }}>
          <Receipt size={32} style={{ color: "var(--texte-3)" }} />
          <div className="text-center">
            <p className="font-medium" style={{ color: "var(--texte)" }}>Aucune facture</p>
            <p className="text-sm mt-1" style={{ color: "var(--texte-3)" }}>Créez une facture ou générez-en une depuis un devis accepté</p>
          </div>
        </div>
      )}

      {factures.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--bordure)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "var(--fond-entree)", borderBottom: "1px solid var(--bordure)" }}>
                {["Référence", "Client", "Montant TTC", "Payé", "Restant", "Échéance", "Statut", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--texte-3)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {factures.map((f) => {
                const cfg = STATUTS_CONFIG[f.statut] ?? STATUTS_CONFIG.emise;
                return (
                  <tr key={f.id} style={{ borderBottom: "1px solid var(--bordure)" }} className="hover:opacity-80 transition-opacity">
                    <td className="px-4 py-3 font-mono font-medium" style={{ color: "var(--texte)" }}>{f.reference}</td>
                    <td className="px-4 py-3" style={{ color: "var(--texte)" }}>{f.client_nom}</td>
                    <td className="px-4 py-3 font-mono font-bold" style={{ color: "var(--texte)" }}>{formaterMontant(f.montant_ttc)}</td>
                    <td className="px-4 py-3 font-mono text-sm" style={{ color: "#10b981" }}>{formaterMontant(f.montant_paye)}</td>
                    <td className="px-4 py-3 font-mono text-sm" style={{ color: f.est_en_retard ? "#ef4444" : "var(--texte-2)" }}>
                      {formaterMontant(f.montant_restant)}
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: f.est_en_retard ? "#ef4444" : "var(--texte-2)" }}>
                      {f.est_en_retard && <AlertTriangle size={12} className="inline mr-1" />}
                      {formaterDate(f.date_echeance)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded-full text-xs font-semibold" style={{ background: `color-mix(in srgb, ${cfg.couleur} 12%, var(--fond-carte))`, color: cfg.couleur }}>
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/societe/factures/${f.id}`} className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: "var(--c-base)" }}>
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
