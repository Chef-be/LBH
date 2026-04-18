"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/crochets/useApi";
import { ProfilHoraire } from "@/types/societe";
import { Plus, Trash2, ArrowLeft, Save } from "lucide-react";

interface LigneForm {
  ordre: number;
  type_ligne: "horaire" | "forfait" | "frais";
  phase_code: string;
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
  conditions_particulieres: string;
  projet: string;
}

const LIGNE_VIDE: LigneForm = {
  ordre: 0, type_ligne: "horaire", phase_code: "", intitule: "",
  description: "", profil: "", nb_heures: "8", taux_horaire: "0",
  montant_unitaire_ht: "0", quantite: "1", unite: "forfait",
};

function today(): string {
  return new Date().toISOString().split("T")[0];
}

function plusTrenteJours(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().split("T")[0];
}

function calculerMontantLigne(l: LigneForm): number {
  if (l.type_ligne === "horaire") {
    return (parseFloat(l.nb_heures) || 0) * (parseFloat(l.taux_horaire) || 0);
  }
  return (parseFloat(l.quantite) || 0) * (parseFloat(l.montant_unitaire_ht) || 0);
}

export default function PageNouveauDevis() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projetId = searchParams.get("projet");

  const [form, setForm] = useState<DevisForm>({
    intitule: "", client_nom: "", client_contact: "", client_email: "",
    client_telephone: "", client_adresse: "", objet: "",
    date_emission: today(), date_validite: plusTrenteJours(),
    taux_tva: "0.20", acompte_pct: "30", delai_paiement_jours: "30",
    conditions_particulieres: "", projet: projetId ?? "",
  });
  const [lignes, setLignes] = useState<LigneForm[]>([{ ...LIGNE_VIDE }]);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const { data: profils = [] } = useQuery<ProfilHoraire[]>({
    queryKey: ["profils-horaires-actifs"],
    queryFn: async () => {
      const r = await api.get<{ results?: ProfilHoraire[] } | ProfilHoraire[]>("/api/societe/profils-horaires/?actif=true");
      return Array.isArray(r) ? r : (r.results ?? []);
    },
  });

  // Pré-remplir le taux depuis le profil sélectionné
  const mettreAJourLigne = (idx: number, champ: keyof LigneForm, val: string) => {
    setLignes((prev) => {
      const nouvelles = [...prev];
      nouvelles[idx] = { ...nouvelles[idx], [champ]: val };
      if (champ === "profil") {
        const profil = profils.find((p) => p.id === val);
        if (profil) nouvelles[idx].taux_horaire = profil.taux_horaire_ht;
      }
      return nouvelles;
    });
  };

  const ajouterLigne = () => setLignes((prev) => [...prev, { ...LIGNE_VIDE, ordre: prev.length }]);
  const supprimerLigne = (idx: number) => setLignes((prev) => prev.filter((_, i) => i !== idx));

  const totalHT = lignes.reduce((s, l) => s + calculerMontantLigne(l), 0);
  const tva = totalHT * parseFloat(form.taux_tva);
  const totalTTC = totalHT + tva;

  const soumettre = async () => {
    if (!form.intitule || !form.client_nom) {
      setErreur("L'intitulé et le nom du client sont obligatoires.");
      return;
    }
    setEnCours(true);
    setErreur(null);
    try {
      const devis = await api.post<{ id: string }>("/api/societe/devis/", {
        ...form,
        projet: form.projet || null,
        taux_tva: parseFloat(form.taux_tva),
        acompte_pct: parseFloat(form.acompte_pct),
        delai_paiement_jours: parseInt(form.delai_paiement_jours),
      });
      // Ajouter les lignes
      for (const [i, ligne] of lignes.entries()) {
        const corps = {
          ordre: i,
          type_ligne: ligne.type_ligne,
          phase_code: ligne.phase_code,
          intitule: ligne.intitule || `Ligne ${i + 1}`,
          description: ligne.description,
          profil: ligne.profil || null,
          nb_heures: ligne.type_ligne === "horaire" ? parseFloat(ligne.nb_heures) : null,
          taux_horaire: ligne.type_ligne === "horaire" ? parseFloat(ligne.taux_horaire) : null,
          montant_unitaire_ht: ligne.type_ligne !== "horaire" ? parseFloat(ligne.montant_unitaire_ht) : null,
          quantite: parseFloat(ligne.quantite),
          unite: ligne.unite,
        };
        await api.post(`/api/societe/devis/${devis.id}/lignes/`, corps);
      }
      router.push(`/societe/devis/${devis.id}`);
    } catch {
      setErreur("Erreur lors de la création du devis. Vérifiez les champs et réessayez.");
    } finally {
      setEnCours(false);
    }
  };

  const champStyle = {
    background: "var(--fond-entree)",
    border: "1px solid var(--bordure)",
    color: "var(--texte)",
  };

  return (
    <div className="space-y-8 max-w-4xl">
      {/* En-tête */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="p-2 rounded-lg transition hover:opacity-70"
          style={{ background: "var(--fond-entree)", color: "var(--texte-2)" }}
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <h2 style={{ color: "var(--texte)" }}>Nouveau devis d&apos;honoraires</h2>
          <p className="text-sm" style={{ color: "var(--texte-3)" }}>
            Remplissez les informations du devis et les lignes de prestations
          </p>
        </div>
      </div>

      {erreur && (
        <div className="rounded-xl px-4 py-3 text-sm" style={{ background: "color-mix(in srgb, #ef4444 10%, var(--fond-carte))", color: "#ef4444", border: "1px solid color-mix(in srgb, #ef4444 20%, var(--fond-carte))" }}>
          {erreur}
        </div>
      )}

      {/* Informations générales */}
      <section className="rounded-xl p-6 space-y-5" style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}>
        <h3 className="font-semibold" style={{ color: "var(--texte)" }}>Informations générales</h3>
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: "var(--texte-3)" }}>Intitulé de la mission *</label>
            <input
              type="text"
              value={form.intitule}
              onChange={(e) => setForm({ ...form, intitule: e.target.value })}
              placeholder="Ex : Mission économiste — Construction école primaire"
              className="w-full rounded-lg px-3 py-2.5 text-sm"
              style={champStyle}
            />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: "var(--texte-3)" }}>Objet / contexte</label>
            <textarea
              value={form.objet}
              onChange={(e) => setForm({ ...form, objet: e.target.value })}
              rows={2}
              placeholder="Contexte de la mission, présentation succincte…"
              className="w-full rounded-lg px-3 py-2.5 text-sm resize-none"
              style={champStyle}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: "var(--texte-3)" }}>Date d&apos;émission</label>
            <input type="date" value={form.date_emission} onChange={(e) => setForm({ ...form, date_emission: e.target.value })} className="w-full rounded-lg px-3 py-2.5 text-sm" style={champStyle} />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: "var(--texte-3)" }}>Valable jusqu&apos;au</label>
            <input type="date" value={form.date_validite} onChange={(e) => setForm({ ...form, date_validite: e.target.value })} className="w-full rounded-lg px-3 py-2.5 text-sm" style={champStyle} />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: "var(--texte-3)" }}>TVA</label>
            <select value={form.taux_tva} onChange={(e) => setForm({ ...form, taux_tva: e.target.value })} className="w-full rounded-lg px-3 py-2.5 text-sm" style={champStyle}>
              <option value="0.20">20 %</option>
              <option value="0.10">10 %</option>
              <option value="0.055">5,5 %</option>
              <option value="0.00">Exonéré (0 %)</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: "var(--texte-3)" }}>Acompte (%)</label>
            <input type="number" value={form.acompte_pct} onChange={(e) => setForm({ ...form, acompte_pct: e.target.value })} min="0" max="100" className="w-full rounded-lg px-3 py-2.5 text-sm" style={champStyle} />
          </div>
        </div>
      </section>

      {/* Client */}
      <section className="rounded-xl p-6 space-y-4" style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}>
        <h3 className="font-semibold" style={{ color: "var(--texte)" }}>Client destinataire</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: "var(--texte-3)" }}>Nom du client *</label>
            <input type="text" value={form.client_nom} onChange={(e) => setForm({ ...form, client_nom: e.target.value })} placeholder="Mairie de…, SCI…" className="w-full rounded-lg px-3 py-2.5 text-sm" style={champStyle} />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: "var(--texte-3)" }}>Interlocuteur</label>
            <input type="text" value={form.client_contact} onChange={(e) => setForm({ ...form, client_contact: e.target.value })} placeholder="M. Dupont" className="w-full rounded-lg px-3 py-2.5 text-sm" style={champStyle} />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: "var(--texte-3)" }}>Email</label>
            <input type="email" value={form.client_email} onChange={(e) => setForm({ ...form, client_email: e.target.value })} className="w-full rounded-lg px-3 py-2.5 text-sm" style={champStyle} />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: "var(--texte-3)" }}>Téléphone</label>
            <input type="tel" value={form.client_telephone} onChange={(e) => setForm({ ...form, client_telephone: e.target.value })} className="w-full rounded-lg px-3 py-2.5 text-sm" style={champStyle} />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium mb-1 block" style={{ color: "var(--texte-3)" }}>Adresse</label>
            <textarea value={form.client_adresse} onChange={(e) => setForm({ ...form, client_adresse: e.target.value })} rows={2} className="w-full rounded-lg px-3 py-2.5 text-sm resize-none" style={champStyle} />
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
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{ background: "var(--c-clair)", color: "var(--c-base)", border: "1px solid var(--c-leger)" }}
          >
            <Plus size={12} /> Ajouter une ligne
          </button>
        </div>

        <div className="space-y-3">
          {lignes.map((ligne, idx) => (
            <div
              key={idx}
              className="rounded-xl p-4 space-y-3"
              style={{ background: "var(--fond-entree)", border: "1px solid var(--bordure)" }}
            >
              <div className="grid grid-cols-12 gap-3 items-start">
                {/* Type */}
                <div className="col-span-2">
                  <label className="text-xs mb-1 block" style={{ color: "var(--texte-3)" }}>Type</label>
                  <select
                    value={ligne.type_ligne}
                    onChange={(e) => mettreAJourLigne(idx, "type_ligne", e.target.value)}
                    className="w-full rounded-lg px-2 py-2 text-xs"
                    style={champStyle}
                  >
                    <option value="horaire">Horaire</option>
                    <option value="forfait">Forfait</option>
                    <option value="frais">Frais</option>
                  </select>
                </div>

                {/* Intitulé */}
                <div className="col-span-5">
                  <label className="text-xs mb-1 block" style={{ color: "var(--texte-3)" }}>Désignation</label>
                  <input
                    type="text"
                    value={ligne.intitule}
                    onChange={(e) => mettreAJourLigne(idx, "intitule", e.target.value)}
                    placeholder="Phase ESQ — Esquisse"
                    className="w-full rounded-lg px-2 py-2 text-sm"
                    style={champStyle}
                  />
                </div>

                {/* Profil (si horaire) */}
                {ligne.type_ligne === "horaire" && (
                  <>
                    <div className="col-span-2">
                      <label className="text-xs mb-1 block" style={{ color: "var(--texte-3)" }}>Profil</label>
                      <select
                        value={ligne.profil}
                        onChange={(e) => mettreAJourLigne(idx, "profil", e.target.value)}
                        className="w-full rounded-lg px-2 py-2 text-xs"
                        style={champStyle}
                      >
                        <option value="">— Profil —</option>
                        {profils.map((p) => (
                          <option key={p.id} value={p.id}>{p.libelle}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-1">
                      <label className="text-xs mb-1 block" style={{ color: "var(--texte-3)" }}>Heures</label>
                      <input
                        type="number"
                        value={ligne.nb_heures}
                        onChange={(e) => mettreAJourLigne(idx, "nb_heures", e.target.value)}
                        min="0"
                        className="w-full rounded-lg px-2 py-2 text-sm font-mono"
                        style={champStyle}
                      />
                    </div>
                    <div className="col-span-1">
                      <label className="text-xs mb-1 block" style={{ color: "var(--texte-3)" }}>€/h HT</label>
                      <input
                        type="number"
                        value={ligne.taux_horaire}
                        onChange={(e) => mettreAJourLigne(idx, "taux_horaire", e.target.value)}
                        min="0"
                        className="w-full rounded-lg px-2 py-2 text-sm font-mono"
                        style={champStyle}
                      />
                    </div>
                  </>
                )}

                {/* Forfait / frais */}
                {ligne.type_ligne !== "horaire" && (
                  <>
                    <div className="col-span-2">
                      <label className="text-xs mb-1 block" style={{ color: "var(--texte-3)" }}>Qté</label>
                      <input
                        type="number"
                        value={ligne.quantite}
                        onChange={(e) => mettreAJourLigne(idx, "quantite", e.target.value)}
                        min="0"
                        className="w-full rounded-lg px-2 py-2 text-sm"
                        style={champStyle}
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs mb-1 block" style={{ color: "var(--texte-3)" }}>PU HT (€)</label>
                      <input
                        type="number"
                        value={ligne.montant_unitaire_ht}
                        onChange={(e) => mettreAJourLigne(idx, "montant_unitaire_ht", e.target.value)}
                        min="0"
                        className="w-full rounded-lg px-2 py-2 text-sm font-mono"
                        style={champStyle}
                      />
                    </div>
                  </>
                )}

                {/* Montant ligne */}
                <div className="col-span-1 flex flex-col items-end justify-end pb-1">
                  <p className="text-xs mb-1" style={{ color: "var(--texte-3)" }}>HT</p>
                  <p className="text-sm font-bold font-mono" style={{ color: "var(--texte)" }}>
                    {calculerMontantLigne(ligne).toLocaleString("fr-FR", { minimumFractionDigits: 0 })} €
                  </p>
                </div>

                {/* Supprimer */}
                {lignes.length > 1 && (
                  <div className="col-span-1 flex items-end pb-1">
                    <button
                      type="button"
                      onClick={() => supprimerLigne(idx)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ background: "color-mix(in srgb, #ef4444 10%, var(--fond-carte))", color: "#ef4444" }}
                    >
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
            <span className="font-mono font-semibold" style={{ color: "var(--texte)" }}>
              {totalHT.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
            </span>
          </div>
          <div className="flex justify-between gap-8 text-sm w-56">
            <span style={{ color: "var(--texte-3)" }}>TVA ({(parseFloat(form.taux_tva) * 100).toFixed(0)} %)</span>
            <span className="font-mono" style={{ color: "var(--texte-2)" }}>
              {tva.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
            </span>
          </div>
          <div className="flex justify-between gap-8 text-base w-56 pt-2" style={{ borderTop: "1px solid var(--bordure)" }}>
            <span className="font-semibold" style={{ color: "var(--texte)" }}>Total TTC</span>
            <span className="font-mono font-bold text-lg" style={{ color: "var(--c-base)" }}>
              {totalTTC.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
            </span>
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
          <Save size={15} /> {enCours ? "Enregistrement…" : "Créer le devis"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-5 py-3 rounded-xl text-sm font-medium border"
          style={{ borderColor: "var(--bordure)", color: "var(--texte-2)" }}
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
