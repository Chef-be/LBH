"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/crochets/useApi";
import { Facture, Paiement } from "@/types/societe";
import { ArrowLeft, Plus, Trash2, AlertTriangle, Check } from "lucide-react";

function formaterMontant(val: string | number): string {
  const n = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(n)) return "—";
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2 }) + " €";
}

function formaterDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

const STATUTS_CONFIG: Record<string, { couleur: string; label: string }> = {
  brouillon: { couleur: "var(--texte-3)", label: "Brouillon" },
  emise: { couleur: "#3b82f6", label: "Émise" },
  en_retard: { couleur: "#ef4444", label: "En retard" },
  partiellement_payee: { couleur: "#f59e0b", label: "Part. payée" },
  payee: { couleur: "#10b981", label: "Payée" },
  annulee: { couleur: "var(--texte-3)", label: "Annulée" },
};

interface PaiementForm {
  date_paiement: string;
  montant: string;
  mode: string;
  reference: string;
  notes: string;
}

export default function PageFactureDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();
  const [ajouterPaiement, setAjouterPaiement] = useState(false);
  const [paiementForm, setPaiementForm] = useState<PaiementForm>({
    date_paiement: new Date().toISOString().split("T")[0],
    montant: "", mode: "virement", reference: "", notes: "",
  });
  const [erreur, setErreur] = useState<string | null>(null);

  const { data: facture, isLoading } = useQuery<Facture>({
    queryKey: ["facture", id],
    queryFn: () => api.get<Facture>(`/api/societe/factures/${id}/`),
  });

  const changerStatut = useMutation({
    mutationFn: (statut: string) => api.post(`/api/societe/factures/${id}/changer_statut/`, { statut }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["facture", id] }),
  });

  const enregistrerPaiement = useMutation({
    mutationFn: (data: PaiementForm) =>
      api.post<Paiement>(`/api/societe/factures/${id}/enregistrer_paiement/`, {
        ...data,
        montant: parseFloat(data.montant),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["facture", id] });
      setAjouterPaiement(false);
      setPaiementForm({ date_paiement: new Date().toISOString().split("T")[0], montant: "", mode: "virement", reference: "", notes: "" });
    },
    onError: () => setErreur("Impossible d'enregistrer le paiement."),
  });

  const supprimerPaiement = useMutation({
    mutationFn: (paiementId: string) =>
      api.supprimer(`/api/societe/factures/${id}/paiements/${paiementId}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["facture", id] }),
  });

  if (isLoading) return <div className="py-24 text-center text-sm" style={{ color: "var(--texte-3)" }}>Chargement…</div>;
  if (!facture) return <div className="py-24 text-center text-sm" style={{ color: "#ef4444" }}>Facture introuvable.</div>;

  const cfg = STATUTS_CONFIG[facture.statut] ?? STATUTS_CONFIG.emise;
  const champStyle = { background: "var(--fond-entree)", border: "1px solid var(--bordure)", color: "var(--texte)" };
  const tvaPct = Math.round(parseFloat(facture.taux_tva) * 100);

  return (
    <div className="space-y-6 max-w-4xl">
      {/* En-tête */}
      <div className="flex items-start justify-between">
        <div>
          <Link href="/societe/factures" className="inline-flex items-center gap-1 text-sm mb-2" style={{ color: "var(--texte-3)" }}>
            <ArrowLeft size={14} /> Factures
          </Link>
          <div className="flex items-center gap-3">
            <h2 className="font-mono" style={{ color: "var(--texte)" }}>{facture.reference}</h2>
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: `color-mix(in srgb, ${cfg.couleur} 12%, var(--fond-carte))`, color: cfg.couleur }}>
              {cfg.label}
            </span>
            {facture.est_en_retard && (
              <span className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full" style={{ background: "color-mix(in srgb, #ef4444 12%, var(--fond-carte))", color: "#ef4444" }}>
                <AlertTriangle size={10} /> En retard
              </span>
            )}
          </div>
          <p className="text-lg mt-1" style={{ color: "var(--texte-2)" }}>{facture.intitule}</p>
        </div>

        <div className="flex gap-2">
          {facture.statut === "brouillon" && (
            <button
              type="button"
              onClick={() => changerStatut.mutate("emise")}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
              style={{ background: "#3b82f6" }}
            >
              <Check size={13} /> Émettre la facture
            </button>
          )}
          {facture.statut !== "payee" && facture.statut !== "annulee" && (
            <button
              type="button"
              onClick={() => setAjouterPaiement(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
              style={{ background: "var(--c-base)" }}
            >
              <Plus size={13} /> Enregistrer paiement
            </button>
          )}
        </div>
      </div>

      {erreur && (
        <div className="rounded-xl px-4 py-3 text-sm" style={{ background: "color-mix(in srgb, #ef4444 10%, var(--fond-carte))", color: "#ef4444" }}>
          {erreur}
        </div>
      )}

      {/* Barre de progression paiement */}
      {facture.statut !== "brouillon" && (
        <div className="rounded-xl p-5" style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}>
          <div className="flex justify-between text-sm mb-2">
            <span style={{ color: "var(--texte-3)" }}>Progression du paiement</span>
            <span className="font-semibold" style={{ color: "var(--texte)" }}>
              {formaterMontant(facture.montant_paye)} / {formaterMontant(facture.montant_ttc)}
            </span>
          </div>
          <div className="h-3 rounded-full overflow-hidden" style={{ background: "var(--fond-entree)" }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(100, (parseFloat(facture.montant_paye) / parseFloat(facture.montant_ttc)) * 100)}%`,
                background: parseFloat(facture.montant_restant) <= 0 ? "#10b981" : "var(--c-base)",
              }}
            />
          </div>
          <div className="flex justify-between text-xs mt-1">
            <span style={{ color: "#10b981" }}>Encaissé : {formaterMontant(facture.montant_paye)}</span>
            <span style={{ color: facture.est_en_retard ? "#ef4444" : "var(--texte-3)" }}>
              Restant : {formaterMontant(facture.montant_restant)}
            </span>
          </div>
        </div>
      )}

      {/* Formulaire ajout paiement */}
      {ajouterPaiement && (
        <div className="rounded-xl p-5 space-y-4" style={{ background: "var(--fond-carte)", border: "2px solid var(--c-leger)" }}>
          <h3 className="font-semibold" style={{ color: "var(--texte)" }}>Enregistrer un paiement</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: "var(--texte-3)" }}>Date</label>
              <input type="date" value={paiementForm.date_paiement} onChange={(e) => setPaiementForm({ ...paiementForm, date_paiement: e.target.value })} className="w-full rounded-lg px-3 py-2 text-sm" style={champStyle} />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: "var(--texte-3)" }}>Montant TTC (€)</label>
              <input type="number" value={paiementForm.montant} onChange={(e) => setPaiementForm({ ...paiementForm, montant: e.target.value })} placeholder={facture.montant_restant} min="0" step="0.01" className="w-full rounded-lg px-3 py-2 text-sm font-mono" style={champStyle} />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: "var(--texte-3)" }}>Mode</label>
              <select value={paiementForm.mode} onChange={(e) => setPaiementForm({ ...paiementForm, mode: e.target.value })} className="w-full rounded-lg px-3 py-2 text-sm" style={champStyle}>
                <option value="virement">Virement bancaire</option>
                <option value="cheque">Chèque</option>
                <option value="carte">Carte bancaire</option>
                <option value="prelevement">Prélèvement</option>
                <option value="especes">Espèces</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: "var(--texte-3)" }}>Référence</label>
              <input type="text" value={paiementForm.reference} onChange={(e) => setPaiementForm({ ...paiementForm, reference: e.target.value })} placeholder="N° virement, chèque…" className="w-full rounded-lg px-3 py-2 text-sm" style={champStyle} />
            </div>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => enregistrerPaiement.mutate(paiementForm)}
              disabled={enregistrerPaiement.isPending || !paiementForm.montant}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: "var(--c-base)" }}
            >
              <Check size={14} /> {enregistrerPaiement.isPending ? "Enregistrement…" : "Enregistrer"}
            </button>
            <button type="button" onClick={() => setAjouterPaiement(false)} className="px-4 py-2 rounded-lg text-sm border" style={{ borderColor: "var(--bordure)", color: "var(--texte-2)" }}>
              Annuler
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        {/* Client */}
        <div className="rounded-xl p-5 space-y-2" style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}>
          <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--texte-3)" }}>Client</h3>
          <p className="font-semibold" style={{ color: "var(--texte)" }}>{facture.client_nom}</p>
          {facture.client_contact && <p className="text-sm" style={{ color: "var(--texte-2)" }}>{facture.client_contact}</p>}
          {facture.client_email && <p className="text-sm" style={{ color: "var(--texte-2)" }}>{facture.client_email}</p>}
          {facture.client_adresse && <p className="text-xs whitespace-pre-line" style={{ color: "var(--texte-3)" }}>{facture.client_adresse}</p>}
        </div>

        {/* Échéances */}
        <div className="rounded-xl p-5" style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}>
          <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--texte-3)" }}>Dates</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt style={{ color: "var(--texte-3)" }}>Émise le</dt>
              <dd style={{ color: "var(--texte)" }}>{formaterDate(facture.date_emission)}</dd>
            </div>
            <div className="flex justify-between">
              <dt style={{ color: "var(--texte-3)" }}>Échéance</dt>
              <dd style={{ color: facture.est_en_retard ? "#ef4444" : "var(--texte)" }}>{formaterDate(facture.date_echeance)}</dd>
            </div>
            {facture.projet_reference && (
              <div className="flex justify-between">
                <dt style={{ color: "var(--texte-3)" }}>Projet</dt>
                <dd><Link href={`/projets/${facture.projet}`} className="underline text-xs" style={{ color: "var(--c-base)" }}>{facture.projet_reference}</Link></dd>
              </div>
            )}
            {facture.devis_reference && (
              <div className="flex justify-between">
                <dt style={{ color: "var(--texte-3)" }}>Devis</dt>
                <dd><Link href={`/societe/devis/${facture.devis}`} className="underline text-xs" style={{ color: "var(--c-base)" }}>{facture.devis_reference}</Link></dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      {/* Lignes */}
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--bordure)" }}>
        <div className="px-5 py-4" style={{ background: "var(--fond-entree)", borderBottom: "1px solid var(--bordure)" }}>
          <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--texte-3)" }}>Détail des prestations</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "var(--fond-entree)", borderBottom: "1px solid var(--bordure)" }}>
              {["Désignation", "Qté", "Unité", "PU HT", "Montant HT"].map((h) => (
                <th key={h} className="px-4 py-2 text-left text-xs font-semibold" style={{ color: "var(--texte-3)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {facture.lignes.map((l, i) => (
              <tr key={l.id} style={{ borderBottom: i < facture.lignes.length - 1 ? "1px solid var(--bordure)" : "none", background: "var(--fond-carte)" }}>
                <td className="px-4 py-3">
                  <p className="font-medium" style={{ color: "var(--texte)" }}>{l.intitule}</p>
                  {l.description && <p className="text-xs mt-0.5" style={{ color: "var(--texte-3)" }}>{l.description}</p>}
                </td>
                <td className="px-4 py-3 font-mono" style={{ color: "var(--texte-2)" }}>{l.quantite}</td>
                <td className="px-4 py-3 text-xs" style={{ color: "var(--texte-3)" }}>{l.unite}</td>
                <td className="px-4 py-3 font-mono" style={{ color: "var(--texte-2)" }}>{formaterMontant(l.prix_unitaire_ht)}</td>
                <td className="px-4 py-3 font-mono font-semibold text-right" style={{ color: "var(--texte)" }}>{formaterMontant(l.montant_ht)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-5 py-4 space-y-2" style={{ background: "var(--fond-entree)", borderTop: "1px solid var(--bordure)" }}>
          <div className="flex justify-between text-sm">
            <span style={{ color: "var(--texte-3)" }}>Total HT</span>
            <span className="font-mono" style={{ color: "var(--texte)" }}>{formaterMontant(facture.montant_ht)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span style={{ color: "var(--texte-3)" }}>TVA {tvaPct} %</span>
            <span className="font-mono" style={{ color: "var(--texte-2)" }}>{formaterMontant(facture.montant_tva)}</span>
          </div>
          <div className="flex justify-between text-base font-bold pt-2" style={{ borderTop: "1px solid var(--bordure)" }}>
            <span style={{ color: "var(--texte)" }}>Total TTC</span>
            <span className="font-mono text-xl" style={{ color: "var(--c-base)" }}>{formaterMontant(facture.montant_ttc)}</span>
          </div>
        </div>
      </div>

      {/* Historique des paiements */}
      {facture.paiements.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--bordure)" }}>
          <div className="px-5 py-4" style={{ background: "var(--fond-entree)", borderBottom: "1px solid var(--bordure)" }}>
            <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--texte-3)" }}>Historique des paiements</h3>
          </div>
          <ul>
            {facture.paiements.map((p, i) => (
              <li
                key={p.id}
                className="flex items-center justify-between px-5 py-3"
                style={{ borderBottom: i < facture.paiements.length - 1 ? "1px solid var(--bordure)" : "none", background: "var(--fond-carte)" }}
              >
                <div>
                  <p className="text-sm font-medium" style={{ color: "var(--texte)" }}>
                    {formaterMontant(p.montant)} — {p.mode_libelle}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--texte-3)" }}>
                    {new Date(p.date_paiement).toLocaleDateString("fr-FR")}
                    {p.reference && ` · ${p.reference}`}
                    {p.enregistre_par_nom && ` · ${p.enregistre_par_nom}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => { if (confirm("Supprimer ce paiement ?")) supprimerPaiement.mutate(p.id); }}
                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background: "color-mix(in srgb, #ef4444 10%, var(--fond-carte))", color: "#ef4444" }}
                >
                  <Trash2 size={12} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
