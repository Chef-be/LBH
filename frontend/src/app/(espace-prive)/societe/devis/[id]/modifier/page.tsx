"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/crochets/useApi";
import { ProfilHoraire, DevisHonoraires } from "@/types/societe";
import { Plus, Trash2, ArrowLeft, Save } from "lucide-react";

interface LigneForm {
  id?: string;
  ordre: number;
  type_ligne: "horaire" | "forfait" | "frais";
  intitule: string;
  description: string;
  profil: string;
  nb_heures: string;
  taux_horaire: string;
  montant_unitaire_ht: string;
  quantite: string;
  unite: string;
}

interface DevisForm {
  intitule: string;
  client_nom: string;
  client_contact: string;
  client_email: string;
  client_telephone: string;
  client_adresse: string;
  objet: string;
  date_emission: string;
  date_validite: string;
  taux_tva: string;
  acompte_pct: string;
  delai_paiement_jours: string;
}

const LIGNE_VIDE: LigneForm = {
  ordre: 0, type_ligne: "horaire", intitule: "",
  description: "", profil: "", nb_heures: "8", taux_horaire: "0",
  montant_unitaire_ht: "0", quantite: "1", unite: "forfait",
};

function calculerMontantLigne(l: LigneForm): number {
  if (l.type_ligne === "horaire") {
    return (parseFloat(l.nb_heures) || 0) * (parseFloat(l.taux_horaire) || 0);
  }
  return (parseFloat(l.quantite) || 0) * (parseFloat(l.montant_unitaire_ht) || 0);
}

export default function PageModifierDevis({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [form, setForm] = useState<DevisForm | null>(null);
  const [lignes, setLignes] = useState<LigneForm[]>([]);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const { data: devis, isLoading } = useQuery<DevisHonoraires>({
    queryKey: ["devis", id],
    queryFn: () => api.get<DevisHonoraires>(`/api/societe/devis/${id}/`),
  });

  const { data: profils = [] } = useQuery<ProfilHoraire[]>({
    queryKey: ["profils-horaires-actifs"],
    queryFn: async () => {
      const r = await api.get<{ results?: ProfilHoraire[] } | ProfilHoraire[]>("/api/societe/profils-horaires/?actif=true");
      return Array.isArray(r) ? r : (r.results ?? []);
    },
  });

  // Pré-remplir le formulaire depuis le devis chargé
  useEffect(() => {
    if (!devis) return;
    setForm({
      intitule: devis.intitule,
      client_nom: devis.client_nom,
      client_contact: devis.client_contact ?? "",
      client_email: devis.client_email ?? "",
      client_telephone: devis.client_telephone ?? "",
      client_adresse: devis.client_adresse ?? "",
      objet: devis.objet ?? "",
      date_emission: devis.date_emission,
      date_validite: devis.date_validite,
      taux_tva: String(devis.taux_tva),
      acompte_pct: String(devis.acompte_pct),
      delai_paiement_jours: String(devis.delai_paiement_jours),
    });
    setLignes(
      devis.lignes.map((l, i) => ({
        id: l.id,
        ordre: i,
        type_ligne: l.type_ligne as "horaire" | "forfait" | "frais",
        intitule: l.intitule,
        description: l.description ?? "",
        profil: l.profil ?? "",
        nb_heures: String(l.nb_heures ?? "8"),
        taux_horaire: String(l.taux_horaire ?? "0"),
        montant_unitaire_ht: String(l.montant_unitaire_ht ?? "0"),
        quantite: String(l.quantite ?? "1"),
        unite: l.unite ?? "forfait",
      }))
    );
  }, [devis]);

  const mettreAJourLigne = (idx: number, champ: keyof LigneForm, val: string) => {
    setLignes((prev) => {
      const n = [...prev];
      n[idx] = { ...n[idx], [champ]: val };
      if (champ === "profil") {
        const profil = profils.find((p) => p.id === val);
        if (profil) n[idx].taux_horaire = profil.taux_horaire_ht;
      }
      return n;
    });
  };

  const ajouterLigne = () => setLignes((prev) => [...prev, { ...LIGNE_VIDE, ordre: prev.length }]);
  const supprimerLigne = (idx: number) => setLignes((prev) => prev.filter((_, i) => i !== idx));

  if (!form) {
    if (isLoading) return <p className="text-center py-24 text-sm" style={{ color: "var(--texte-3)" }}>Chargement…</p>;
    return null;
  }

  const totalHT = lignes.reduce((s, l) => s + calculerMontantLigne(l), 0);
  const tva = totalHT * parseFloat(form.taux_tva || "0");
  const totalTTC = totalHT + tva;

  const soumettre = async () => {
    if (!form.intitule || !form.client_nom) {
      setErreur("L'intitulé et le nom du client sont obligatoires.");
      return;
    }
    setEnCours(true);
    setErreur(null);
    try {
      // Mettre à jour le devis (header)
      await api.put(`/api/societe/devis/${id}/`, {
        ...form,
        projet: devis?.projet ?? null,
        taux_tva: parseFloat(form.taux_tva),
        acompte_pct: parseFloat(form.acompte_pct),
        delai_paiement_jours: parseInt(form.delai_paiement_jours),
      });

      // Supprimer les lignes supprimées et mettre à jour / créer les lignes
      const lignesOriginalesIds = new Set((devis?.lignes ?? []).map((l) => l.id));
      const lignesGardeesIds = new Set(lignes.filter((l) => l.id).map((l) => l.id));

      // Supprimer les lignes qui n'existent plus
      for (const lId of lignesOriginalesIds) {
        if (!lignesGardeesIds.has(lId)) {
          await api.supprimer(`/api/societe/devis/${id}/lignes/${lId}/`);
        }
      }

      // Mettre à jour / créer chaque ligne
      for (const [i, ligne] of lignes.entries()) {
        const corps = {
          ordre: i,
          type_ligne: ligne.type_ligne,
          intitule: ligne.intitule || `Ligne ${i + 1}`,
          description: ligne.description,
          profil: ligne.profil || null,
          nb_heures: ligne.type_ligne === "horaire" ? parseFloat(ligne.nb_heures) : null,
          taux_horaire: ligne.type_ligne === "horaire" ? parseFloat(ligne.taux_horaire) : null,
          montant_unitaire_ht: ligne.type_ligne !== "horaire" ? parseFloat(ligne.montant_unitaire_ht) : null,
          quantite: parseFloat(ligne.quantite),
          unite: ligne.unite,
        };
        if (ligne.id) {
          await api.put(`/api/societe/devis/${id}/lignes/${ligne.id}/`, corps);
        } else {
          await api.post(`/api/societe/devis/${id}/lignes/`, corps);
        }
      }

      router.push(`/societe/devis/${id}`);
    } catch {
      setErreur("Erreur lors de la mise à jour du devis.");
    } finally {
      setEnCours(false);
    }
  };

  const cs = {
    background: "var(--fond-entree)",
    border: "1px solid var(--bordure)",
    color: "var(--texte)",
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="p-2 rounded-lg"
          style={{ background: "var(--fond-entree)", color: "var(--texte-2)" }}
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <h2 style={{ color: "var(--texte)" }}>Modifier le devis</h2>
          <p className="text-sm font-mono" style={{ color: "var(--texte-3)" }}>{devis?.reference}</p>
        </div>
      </div>

      {erreur && (
        <div
          className="rounded-xl px-4 py-3 text-sm"
          style={{ background: "color-mix(in srgb, #ef4444 10%, var(--fond-carte))", color: "#ef4444" }}
        >
          {erreur}
        </div>
      )}

      {/* Informations générales */}
      <section className="rounded-xl p-6 space-y-4" style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}>
        <h3 className="font-semibold" style={{ color: "var(--texte)" }}>Informations générales</h3>
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: "var(--texte-3)" }}>Intitulé de la mission *</label>
          <input type="text" value={form.intitule} onChange={(e) => setForm({ ...form, intitule: e.target.value })} className="w-full rounded-lg px-3 py-2.5 text-sm" style={cs} />
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: "var(--texte-3)" }}>Objet / contexte</label>
          <textarea value={form.objet} onChange={(e) => setForm({ ...form, objet: e.target.value })} rows={2} className="w-full rounded-lg px-3 py-2.5 text-sm resize-none" style={cs} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: "var(--texte-3)" }}>Date d&apos;émission</label>
            <input type="date" value={form.date_emission} onChange={(e) => setForm({ ...form, date_emission: e.target.value })} className="w-full rounded-lg px-3 py-2 text-sm" style={cs} />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: "var(--texte-3)" }}>Valable jusqu&apos;au</label>
            <input type="date" value={form.date_validite} onChange={(e) => setForm({ ...form, date_validite: e.target.value })} className="w-full rounded-lg px-3 py-2 text-sm" style={cs} />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: "var(--texte-3)" }}>TVA</label>
            <select value={form.taux_tva} onChange={(e) => setForm({ ...form, taux_tva: e.target.value })} className="w-full rounded-lg px-3 py-2 text-sm" style={cs}>
              <option value="0.20">20 %</option>
              <option value="0.10">10 %</option>
              <option value="0.055">5,5 %</option>
              <option value="0.00">Exonéré (0 %)</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: "var(--texte-3)" }}>Acompte (%)</label>
            <input type="number" value={form.acompte_pct} onChange={(e) => setForm({ ...form, acompte_pct: e.target.value })} min="0" max="100" className="w-full rounded-lg px-3 py-2 text-sm" style={cs} />
          </div>
        </div>
      </section>

      {/* Client */}
      <section className="rounded-xl p-6 space-y-4" style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}>
        <h3 className="font-semibold" style={{ color: "var(--texte)" }}>Client destinataire</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: "var(--texte-3)" }}>Nom du client *</label>
            <input type="text" value={form.client_nom} onChange={(e) => setForm({ ...form, client_nom: e.target.value })} className="w-full rounded-lg px-3 py-2.5 text-sm" style={cs} />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: "var(--texte-3)" }}>Interlocuteur</label>
            <input type="text" value={form.client_contact} onChange={(e) => setForm({ ...form, client_contact: e.target.value })} className="w-full rounded-lg px-3 py-2.5 text-sm" style={cs} />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: "var(--texte-3)" }}>Email</label>
            <input type="email" value={form.client_email} onChange={(e) => setForm({ ...form, client_email: e.target.value })} className="w-full rounded-lg px-3 py-2.5 text-sm" style={cs} />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: "var(--texte-3)" }}>Téléphone</label>
            <input type="tel" value={form.client_telephone} onChange={(e) => setForm({ ...form, client_telephone: e.target.value })} className="w-full rounded-lg px-3 py-2.5 text-sm" style={cs} />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium mb-1 block" style={{ color: "var(--texte-3)" }}>Adresse</label>
            <textarea value={form.client_adresse} onChange={(e) => setForm({ ...form, client_adresse: e.target.value })} rows={2} className="w-full rounded-lg px-3 py-2.5 text-sm resize-none" style={cs} />
          </div>
        </div>
      </section>

      {/* Lignes de prestations */}
      <section className="rounded-xl p-6 space-y-4" style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold" style={{ color: "var(--texte)" }}>Prestations</h3>
          <button
            type="button"
            onClick={ajouterLigne}
            className="inline-flex items-center gap-1 text-xs font-medium"
            style={{ color: "var(--c-base)" }}
          >
            <Plus size={12} /> Ajouter
          </button>
        </div>

        <div className="space-y-3">
          {lignes.map((ligne, idx) => (
            <div key={idx} className="rounded-xl p-4 space-y-3" style={{ background: "var(--fond-entree)", border: "1px solid var(--bordure)" }}>
              <div className="grid grid-cols-12 gap-3 items-start">
                <div className="col-span-2">
                  <label className="text-xs mb-1 block" style={{ color: "var(--texte-3)" }}>Type</label>
                  <select value={ligne.type_ligne} onChange={(e) => mettreAJourLigne(idx, "type_ligne", e.target.value)} className="w-full rounded-lg px-2 py-2 text-xs" style={cs}>
                    <option value="horaire">Horaire</option>
                    <option value="forfait">Forfait</option>
                    <option value="frais">Frais</option>
                  </select>
                </div>
                <div className="col-span-5">
                  <label className="text-xs mb-1 block" style={{ color: "var(--texte-3)" }}>Désignation</label>
                  <input type="text" value={ligne.intitule} onChange={(e) => mettreAJourLigne(idx, "intitule", e.target.value)} placeholder={`Ligne ${idx + 1}`} className="w-full rounded-lg px-2 py-2 text-sm" style={cs} />
                </div>
                {ligne.type_ligne === "horaire" && (
                  <>
                    <div className="col-span-2">
                      <label className="text-xs mb-1 block" style={{ color: "var(--texte-3)" }}>Profil</label>
                      <select value={ligne.profil} onChange={(e) => mettreAJourLigne(idx, "profil", e.target.value)} className="w-full rounded-lg px-2 py-2 text-xs" style={cs}>
                        <option value="">— Profil —</option>
                        {profils.map((p) => <option key={p.id} value={p.id}>{p.libelle}</option>)}
                      </select>
                    </div>
                    <div className="col-span-1">
                      <label className="text-xs mb-1 block" style={{ color: "var(--texte-3)" }}>Heures</label>
                      <input type="number" value={ligne.nb_heures} onChange={(e) => mettreAJourLigne(idx, "nb_heures", e.target.value)} min="0" className="w-full rounded-lg px-2 py-2 text-sm font-mono" style={cs} />
                    </div>
                    <div className="col-span-1">
                      <label className="text-xs mb-1 block" style={{ color: "var(--texte-3)" }}>€/h HT</label>
                      <input type="number" value={ligne.taux_horaire} onChange={(e) => mettreAJourLigne(idx, "taux_horaire", e.target.value)} min="0" className="w-full rounded-lg px-2 py-2 text-sm font-mono" style={cs} />
                    </div>
                  </>
                )}
                {ligne.type_ligne !== "horaire" && (
                  <>
                    <div className="col-span-2">
                      <label className="text-xs mb-1 block" style={{ color: "var(--texte-3)" }}>Qté</label>
                      <input type="number" value={ligne.quantite} onChange={(e) => mettreAJourLigne(idx, "quantite", e.target.value)} min="0" className="w-full rounded-lg px-2 py-2 text-sm" style={cs} />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs mb-1 block" style={{ color: "var(--texte-3)" }}>PU HT (€)</label>
                      <input type="number" value={ligne.montant_unitaire_ht} onChange={(e) => mettreAJourLigne(idx, "montant_unitaire_ht", e.target.value)} min="0" className="w-full rounded-lg px-2 py-2 text-sm font-mono" style={cs} />
                    </div>
                  </>
                )}
                <div className="col-span-1 flex flex-col items-end justify-end pb-1">
                  <p className="text-xs mb-1" style={{ color: "var(--texte-3)" }}>HT</p>
                  <p className="text-sm font-bold font-mono" style={{ color: "var(--texte)" }}>
                    {calculerMontantLigne(ligne).toLocaleString("fr-FR", { minimumFractionDigits: 0 })} €
                  </p>
                </div>
                {lignes.length > 1 && (
                  <div className="col-span-1 flex items-end pb-1">
                    <button type="button" onClick={() => supprimerLigne(idx)} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "color-mix(in srgb, #ef4444 10%, var(--fond-carte))", color: "#ef4444" }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Totaux */}
        <div className="flex flex-col items-end gap-1 pt-4" style={{ borderTop: "1px solid var(--bordure)" }}>
          <div className="flex justify-between gap-8 text-sm w-56">
            <span style={{ color: "var(--texte-3)" }}>Total HT</span>
            <span className="font-mono font-semibold" style={{ color: "var(--texte)" }}>{totalHT.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</span>
          </div>
          <div className="flex justify-between gap-8 text-sm w-56">
            <span style={{ color: "var(--texte-3)" }}>TVA ({(parseFloat(form.taux_tva) * 100).toFixed(0)} %)</span>
            <span className="font-mono" style={{ color: "var(--texte-2)" }}>{tva.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</span>
          </div>
          <div className="flex justify-between gap-8 text-base w-56 pt-2" style={{ borderTop: "1px solid var(--bordure)" }}>
            <span className="font-semibold" style={{ color: "var(--texte)" }}>Total TTC</span>
            <span className="font-mono font-bold text-lg" style={{ color: "var(--c-base)" }}>{totalTTC.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</span>
          </div>
        </div>
      </section>

      {/* Actions */}
      <div className="flex items-center gap-3 pb-6">
        <button
          type="button"
          onClick={soumettre}
          disabled={enCours}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-60"
          style={{ background: "var(--c-base)" }}
        >
          <Save size={15} /> {enCours ? "Enregistrement…" : "Enregistrer les modifications"}
        </button>
        <button type="button" onClick={() => router.back()} className="px-5 py-3 rounded-xl text-sm font-medium border" style={{ borderColor: "var(--bordure)", color: "var(--texte-2)" }}>
          Annuler
        </button>
      </div>
    </div>
  );
}
