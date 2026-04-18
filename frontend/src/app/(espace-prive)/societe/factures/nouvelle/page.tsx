"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2, Save } from "lucide-react";
import { api } from "@/crochets/useApi";

interface LigneForm { ordre: number; intitule: string; description: string; quantite: string; unite: string; prix_unitaire_ht: string; }
interface FactureForm { intitule: string; client_nom: string; client_contact: string; client_email: string; client_adresse: string; date_emission: string; date_echeance: string; taux_tva: string; notes: string; }

const LIGNE_VIDE: LigneForm = { ordre: 0, intitule: "", description: "", quantite: "1", unite: "forfait", prix_unitaire_ht: "0" };

export default function PageNouvelleFacture() {
  const router = useRouter();
  const [form, setForm] = useState<FactureForm>({
    intitule: "", client_nom: "", client_contact: "", client_email: "", client_adresse: "",
    date_emission: new Date().toISOString().split("T")[0],
    date_echeance: (() => { const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().split("T")[0]; })(),
    taux_tva: "0.20", notes: "",
  });
  const [lignes, setLignes] = useState<LigneForm[]>([{ ...LIGNE_VIDE }]);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const totalHT = lignes.reduce((s, l) => s + (parseFloat(l.quantite) || 0) * (parseFloat(l.prix_unitaire_ht) || 0), 0);
  const tva = totalHT * parseFloat(form.taux_tva || "0");

  const mettreAJourLigne = (idx: number, champ: keyof LigneForm, val: string) =>
    setLignes((prev) => { const n = [...prev]; n[idx] = { ...n[idx], [champ]: val }; return n; });

  const soumettre = async () => {
    if (!form.intitule || !form.client_nom) { setErreur("Intitulé et client obligatoires."); return; }
    setEnCours(true);
    try {
      const facture = await api.post<{ id: string }>("/api/societe/factures/", {
        ...form, taux_tva: parseFloat(form.taux_tva),
        montant_ht: totalHT, montant_tva: tva, montant_ttc: totalHT + tva,
      });
      for (const [i, l] of lignes.entries()) {
        await api.post(`/api/societe/factures/${facture.id}/lignes/`, {
          ordre: i, intitule: l.intitule || `Ligne ${i + 1}`,
          description: l.description, quantite: parseFloat(l.quantite),
          unite: l.unite, prix_unitaire_ht: parseFloat(l.prix_unitaire_ht),
          montant_ht: (parseFloat(l.quantite) || 0) * (parseFloat(l.prix_unitaire_ht) || 0),
        });
      }
      router.push(`/societe/factures/${facture.id}`);
    } catch { setErreur("Erreur lors de la création."); }
    finally { setEnCours(false); }
  };

  const cs = { background: "var(--fond-entree)", border: "1px solid var(--bordure)", color: "var(--texte)" };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => router.back()} className="p-2 rounded-lg" style={{ background: "var(--fond-entree)", color: "var(--texte-2)" }}>
          <ArrowLeft size={16} />
        </button>
        <h2 style={{ color: "var(--texte)" }}>Nouvelle facture</h2>
      </div>

      {erreur && <div className="rounded-xl px-4 py-3 text-sm" style={{ background: "color-mix(in srgb, #ef4444 10%, var(--fond-carte))", color: "#ef4444" }}>{erreur}</div>}

      <div className="rounded-xl p-5 space-y-4" style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}>
        <h3 className="font-semibold" style={{ color: "var(--texte)" }}>Informations</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="text-xs font-medium mb-1 block" style={{ color: "var(--texte-3)" }}>Intitulé *</label>
            <input type="text" value={form.intitule} onChange={(e) => setForm({ ...form, intitule: e.target.value })} className="w-full rounded-lg px-3 py-2 text-sm" style={cs} />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: "var(--texte-3)" }}>Client *</label>
            <input type="text" value={form.client_nom} onChange={(e) => setForm({ ...form, client_nom: e.target.value })} className="w-full rounded-lg px-3 py-2 text-sm" style={cs} />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: "var(--texte-3)" }}>Email client</label>
            <input type="email" value={form.client_email} onChange={(e) => setForm({ ...form, client_email: e.target.value })} className="w-full rounded-lg px-3 py-2 text-sm" style={cs} />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: "var(--texte-3)" }}>Date d&apos;émission</label>
            <input type="date" value={form.date_emission} onChange={(e) => setForm({ ...form, date_emission: e.target.value })} className="w-full rounded-lg px-3 py-2 text-sm" style={cs} />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: "var(--texte-3)" }}>Échéance</label>
            <input type="date" value={form.date_echeance} onChange={(e) => setForm({ ...form, date_echeance: e.target.value })} className="w-full rounded-lg px-3 py-2 text-sm" style={cs} />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: "var(--texte-3)" }}>TVA</label>
            <select value={form.taux_tva} onChange={(e) => setForm({ ...form, taux_tva: e.target.value })} className="w-full rounded-lg px-3 py-2 text-sm" style={cs}>
              <option value="0.20">20 %</option>
              <option value="0.10">10 %</option>
              <option value="0.00">Exonéré</option>
            </select>
          </div>
        </div>
      </div>

      <div className="rounded-xl p-5 space-y-3" style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold" style={{ color: "var(--texte)" }}>Lignes</h3>
          <button type="button" onClick={() => setLignes((p) => [...p, { ...LIGNE_VIDE, ordre: p.length }])} className="text-xs font-medium flex items-center gap-1" style={{ color: "var(--c-base)" }}>
            <Plus size={12} /> Ajouter
          </button>
        </div>
        {lignes.map((l, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 items-end p-3 rounded-xl" style={{ background: "var(--fond-entree)", border: "1px solid var(--bordure)" }}>
            <div className="col-span-5">
              <label className="text-xs mb-1 block" style={{ color: "var(--texte-3)" }}>Désignation</label>
              <input type="text" value={l.intitule} onChange={(e) => mettreAJourLigne(i, "intitule", e.target.value)} placeholder={`Ligne ${i + 1}`} className="w-full rounded-lg px-2 py-2 text-sm" style={cs} />
            </div>
            <div className="col-span-2">
              <label className="text-xs mb-1 block" style={{ color: "var(--texte-3)" }}>Qté</label>
              <input type="number" value={l.quantite} onChange={(e) => mettreAJourLigne(i, "quantite", e.target.value)} min="0" className="w-full rounded-lg px-2 py-2 text-sm" style={cs} />
            </div>
            <div className="col-span-2">
              <label className="text-xs mb-1 block" style={{ color: "var(--texte-3)" }}>Unité</label>
              <input type="text" value={l.unite} onChange={(e) => mettreAJourLigne(i, "unite", e.target.value)} className="w-full rounded-lg px-2 py-2 text-sm" style={cs} />
            </div>
            <div className="col-span-2">
              <label className="text-xs mb-1 block" style={{ color: "var(--texte-3)" }}>PU HT</label>
              <input type="number" value={l.prix_unitaire_ht} onChange={(e) => mettreAJourLigne(i, "prix_unitaire_ht", e.target.value)} min="0" className="w-full rounded-lg px-2 py-2 text-sm font-mono" style={cs} />
            </div>
            {lignes.length > 1 && (
              <div className="col-span-1">
                <button type="button" onClick={() => setLignes((p) => p.filter((_, j) => j !== i))} className="w-8 h-9 rounded-lg flex items-center justify-center" style={{ background: "color-mix(in srgb, #ef4444 10%, var(--fond-carte))", color: "#ef4444" }}>
                  <Trash2 size={12} />
                </button>
              </div>
            )}
          </div>
        ))}
        <div className="flex flex-col items-end gap-1 pt-2" style={{ borderTop: "1px solid var(--bordure)" }}>
          <div className="flex justify-between gap-8 w-48 text-sm">
            <span style={{ color: "var(--texte-3)" }}>HT</span>
            <span className="font-mono font-semibold">{totalHT.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</span>
          </div>
          <div className="flex justify-between gap-8 w-48 text-sm">
            <span style={{ color: "var(--texte-3)" }}>TVA</span>
            <span className="font-mono">{tva.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</span>
          </div>
          <div className="flex justify-between gap-8 w-48 text-base font-bold pt-1" style={{ borderTop: "1px solid var(--bordure)" }}>
            <span>TTC</span>
            <span className="font-mono" style={{ color: "var(--c-base)" }}>{(totalHT + tva).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</span>
          </div>
        </div>
      </div>

      <div className="flex gap-3 pb-6">
        <button type="button" onClick={soumettre} disabled={enCours} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-60" style={{ background: "var(--c-base)" }}>
          <Save size={14} /> {enCours ? "Enregistrement…" : "Créer la facture"}
        </button>
        <button type="button" onClick={() => router.back()} className="px-5 py-3 rounded-xl text-sm border" style={{ borderColor: "var(--bordure)", color: "var(--texte-2)" }}>
          Annuler
        </button>
      </div>
    </div>
  );
}
