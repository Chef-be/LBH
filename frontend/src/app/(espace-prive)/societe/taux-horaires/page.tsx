"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/crochets/useApi";
import { ParametreSociete, ProfilHoraire, ProfilHoraireUtilisateur, SimulationSalaire } from "@/types/societe";
import {
  Plus, Pencil, Trash2, Check, X, ChevronDown, ChevronRight,
  Calculator, TrendingUp, Users, ToggleLeft, ToggleRight,
} from "lucide-react";

// ─── Helpers ───────────────────────────────────────────────────────────────

function fmt(val: string | number | null | undefined, dec = 2): string {
  if (val == null || val === "") return "—";
  const n = parseFloat(String(val));
  if (isNaN(n)) return "—";
  return n.toLocaleString("fr-FR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function pct(val: string | number): string {
  return (parseFloat(String(val)) * 100).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " %";
}

const LIBELLE_TYPE: Record<string, string> = {
  be: "Bureau d'études",
  autre: "Autre",
};

// ─── Formulaire profil ──────────────────────────────────────────────────────

interface FormProfil {
  code: string;
  libelle: string;
  description: string;
  taux_horaire_ht: string;
  couleur: string;
  actif: boolean;
  ordre: number;
  type_profil: string;
  taux_charges_salariales: string;
  taux_charges_patronales: string;
  heures_productives_an: string;
  taux_marge_vente: string;
}

const FORM_VIDE: FormProfil = {
  code: "", libelle: "", description: "",
  taux_horaire_ht: "0", couleur: "#6366f1", actif: true, ordre: 0,
  type_profil: "be",
  taux_charges_salariales: "0.22",
  taux_charges_patronales: "0.42",
  heures_productives_an: "1600",
  taux_marge_vente: "0.15",
};

// type_profil ne peut être que "be" ou "autre" — pas de notion chantier pour ce cabinet

function profilVersForm(p: ProfilHoraire): FormProfil {
  return {
    code: p.code, libelle: p.libelle, description: p.description,
    taux_horaire_ht: p.taux_horaire_ht, couleur: p.couleur,
    actif: p.actif, ordre: p.ordre, type_profil: p.type_profil,
    taux_charges_salariales: p.taux_charges_salariales,
    taux_charges_patronales: p.taux_charges_patronales,
    heures_productives_an: p.heures_productives_an,
    taux_marge_vente: p.taux_marge_vente,
  };
}

function appliquerParametresSociete(data: FormProfil, parametre?: ParametreSociete): FormProfil {
  if (!parametre) return data;
  return {
    ...data,
    taux_charges_salariales: parametre.taux_charges_salariales,
    taux_charges_patronales: parametre.taux_charges_patronales,
    heures_productives_an: parametre.heures_productives_be,
    taux_marge_vente: parametre.objectif_marge_nette,
  };
}

// ─── Formulaire simulation ──────────────────────────────────────────────────

interface FormSim {
  libelle: string;
  salaire_net_mensuel: string;
  primes_mensuelles: string;
  avantages_mensuels: string;
}

const SIM_VIDE: FormSim = {
  libelle: "", salaire_net_mensuel: "", primes_mensuelles: "0", avantages_mensuels: "0",
};

// ─── Ligne fiche de paie ────────────────────────────────────────────────────

function LigneFiche({ label, values, bold, highlight }: {
  label: string;
  values: (string | null)[];
  bold?: boolean;
  highlight?: boolean;
}) {
  return (
    <tr style={{ background: highlight ? "color-mix(in srgb, var(--c-leger) 30%, transparent)" : undefined }}>
      <td
        className="py-2 px-3 text-xs"
        style={{ color: bold ? "var(--texte)" : "var(--texte-2)", fontWeight: bold ? 600 : 400, whiteSpace: "nowrap" }}
      >
        {label}
      </td>
      {values.map((v, i) => (
        <td
          key={i}
          className="py-2 px-3 text-right text-xs font-mono"
          style={{ color: bold ? "var(--texte)" : "var(--texte-2)", fontWeight: bold ? 700 : 400 }}
        >
          {v ?? "—"}
        </td>
      ))}
    </tr>
  );
}

// ─── Calcul de la moyenne des simulations ───────────────────────────────────

function calculerMoyenne(sims: SimulationSalaire[], champ: keyof SimulationSalaire): string | null {
  const actives = sims.filter((s) => s.actif);
  if (!actives.length) return null;
  const somme = actives.reduce((acc, s) => acc + parseFloat(String(s[champ]) || "0"), 0);
  return (somme / actives.length).toFixed(4);
}

// ─── Bloc simulation d'un profil ────────────────────────────────────────────

function BlocSimulations({ profil }: { profil: ProfilHoraire }) {
  const qc = useQueryClient();
  const [ajout, setAjout] = useState(false);
  const [form, setForm] = useState<FormSim>(SIM_VIDE);
  const [enCours, setEnCours] = useState(false);

  const sims = profil.simulations;
  const actives = sims.filter((s) => s.actif);

  const creerSim = useCallback(async () => {
    if (!form.libelle || !form.salaire_net_mensuel) return;
    setEnCours(true);
    try {
      await api.post(`/api/societe/profils-horaires/${profil.id}/simulations/`, form);
      qc.invalidateQueries({ queryKey: ["profils-horaires"] });
      setForm(SIM_VIDE);
      setAjout(false);
    } finally {
      setEnCours(false);
    }
  }, [form, profil.id, qc]);

  const supprimerSim = useCallback(async (simId: string) => {
    await api.supprimer(`/api/societe/simulations-salaire/${simId}/`);
    qc.invalidateQueries({ queryKey: ["profils-horaires"] });
  }, [qc]);

  const toggleActif = useCallback(async (sim: SimulationSalaire) => {
    await api.patch(`/api/societe/simulations-salaire/${sim.id}/`, { actif: !sim.actif });
    qc.invalidateQueries({ queryKey: ["profils-horaires"] });
  }, [qc]);

  const appliquerMoyenne = useCallback(async () => {
    await api.post(`/api/societe/profils-horaires/${profil.id}/appliquer-calcul/`, {});
    qc.invalidateQueries({ queryKey: ["profils-horaires"] });
  }, [profil.id, qc]);

  const desactiverCalcul = useCallback(async () => {
    await api.post(`/api/societe/profils-horaires/${profil.id}/desactiver-calcul/`, {});
    qc.invalidateQueries({ queryKey: ["profils-horaires"] });
  }, [profil.id, qc]);

  // Colonnes : une par simulation active + colonne Moyenne
  const colonnesEntetes = [
    ...sims.map((s) => s.libelle),
    ...(actives.length > 1 ? ["Moyenne"] : []),
  ];

  function val(s: SimulationSalaire, champ: keyof SimulationSalaire) {
    return fmt(s[champ] as string);
  }

  function valeur(champ: keyof SimulationSalaire): (string | null)[] {
    const par = sims.map((s) => val(s, champ));
    const moy = actives.length > 1 ? fmt(calculerMoyenne(sims, champ)) : null;
    return moy !== null ? [...par, moy] : par;
  }

  const moyenneDHMO = actives.length ? calculerMoyenne(sims, "dhmo") : null;
  const moyenneTaux = actives.length ? calculerMoyenne(sims, "taux_vente_horaire") : null;

  return (
    <div className="space-y-4 pt-2">
      {/* Paramètres du profil */}
      <div
        className="rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 gap-3"
        style={{ background: "var(--fond-entree)", border: "1px solid var(--bordure)" }}
      >
        <div>
          <p className="text-xs mb-1" style={{ color: "var(--texte-3)" }}>Charges salariales</p>
          <p className="text-sm font-semibold font-mono" style={{ color: "var(--texte)" }}>
            {pct(profil.taux_charges_salariales)}
          </p>
        </div>
        <div>
          <p className="text-xs mb-1" style={{ color: "var(--texte-3)" }}>Charges patronales</p>
          <p className="text-sm font-semibold font-mono" style={{ color: "var(--texte)" }}>
            {pct(profil.taux_charges_patronales)}
          </p>
        </div>
        <div>
          <p className="text-xs mb-1" style={{ color: "var(--texte-3)" }}>Heures productives / an</p>
          <p className="text-sm font-semibold font-mono" style={{ color: "var(--texte)" }}>
            {fmt(profil.heures_productives_an, 0)} h
          </p>
        </div>
        <div>
          <p className="text-xs mb-1" style={{ color: "var(--texte-3)" }}>Marge de vente cible</p>
          <p className="text-sm font-semibold font-mono" style={{ color: "var(--texte)" }}>
            {pct(profil.taux_marge_vente)}
          </p>
        </div>
      </div>

      {/* Tableau des simulations */}
      {sims.length > 0 && (
        <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid var(--bordure)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "var(--fond-entree)" }}>
                <th className="py-2 px-3 text-left text-xs font-semibold" style={{ color: "var(--texte-2)", minWidth: 180 }}>
                  Poste
                </th>
                {sims.map((s) => (
                  <th key={s.id} className="py-2 px-3 text-right text-xs font-semibold" style={{ color: "var(--texte-2)", minWidth: 110 }}>
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => toggleActif(s)}
                        title={s.actif ? "Exclure de la moyenne" : "Inclure dans la moyenne"}
                        style={{ color: s.actif ? "var(--c-base)" : "var(--texte-3)" }}
                      >
                        {s.actif ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                      </button>
                      <span style={{ color: s.actif ? "var(--texte)" : "var(--texte-3)", opacity: s.actif ? 1 : 0.5 }}>
                        {s.libelle}
                      </span>
                      <button
                        onClick={() => { if (confirm(`Supprimer "${s.libelle}" ?`)) supprimerSim(s.id); }}
                        className="opacity-40 hover:opacity-100 transition"
                        style={{ color: "#ef4444" }}
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </th>
                ))}
                {actives.length > 1 && (
                  <th className="py-2 px-3 text-right text-xs font-semibold" style={{ color: "var(--c-base)", minWidth: 110 }}>
                    Moyenne
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              <LigneFiche label="Salaire net mensuel (€)" values={valeur("salaire_net_mensuel")} />
              <LigneFiche label="Primes mensuelles (€)" values={valeur("primes_mensuelles")} />
              <LigneFiche label="Avantages en nature (€)" values={valeur("avantages_mensuels")} />
              <LigneFiche label="Salaire brut estimé (€)" values={valeur("salaire_brut_estime")} bold />
              <LigneFiche label="Charges salariales (€)" values={valeur("charges_salariales")} />
              <LigneFiche label="Charges patronales (€)" values={valeur("charges_patronales")} />
              <LigneFiche label="Coût employeur mensuel (€)" values={valeur("cout_employeur_mensuel")} bold />
              <LigneFiche label="Coût annuel (€)" values={valeur("cout_annuel")} bold />
              <LigneFiche
                label={`DHMO — coût horaire (€/h)`}
                values={valeur("dhmo")}
                bold highlight
              />
              <LigneFiche
                label={`Taux de vente horaire (€/h)`}
                values={valeur("taux_vente_horaire")}
                bold highlight
              />
            </tbody>
          </table>
        </div>
      )}

      {/* Synthèse + actions pilotage */}
      {actives.length > 0 && (
        <div
          className="rounded-xl p-4 flex flex-wrap items-center justify-between gap-4"
          style={{ background: "color-mix(in srgb, var(--c-leger) 20%, var(--fond-carte))", border: "1px solid var(--c-leger)" }}
        >
          <div className="flex gap-6">
            <div>
              <p className="text-xs mb-0.5" style={{ color: "var(--texte-3)" }}>DHMO moyen</p>
              <p className="text-lg font-bold font-mono" style={{ color: "var(--texte)" }}>
                {fmt(moyenneDHMO)} €/h
              </p>
            </div>
            <div>
              <p className="text-xs mb-0.5" style={{ color: "var(--texte-3)" }}>Taux de vente moyen</p>
              <p className="text-lg font-bold font-mono" style={{ color: "var(--c-base)" }}>
                {fmt(moyenneTaux)} €/h
              </p>
            </div>
            <div>
              <p className="text-xs mb-0.5" style={{ color: "var(--texte-3)" }}>Taux actuel du profil</p>
              <p className="text-lg font-bold font-mono" style={{ color: "var(--texte-2)" }}>
                {fmt(profil.taux_horaire_ht)} €/h
                {profil.utiliser_calcul && (
                  <span className="ml-1 text-xs font-normal px-1.5 py-0.5 rounded" style={{ background: "var(--c-leger)", color: "var(--c-base)" }}>
                    calculé
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {!profil.utiliser_calcul ? (
              <button
                onClick={appliquerMoyenne}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
                style={{ background: "var(--c-base)" }}
              >
                <TrendingUp size={14} />
                Appliquer la moyenne ({fmt(moyenneTaux)} €/h)
              </button>
            ) : (
              <button
                onClick={desactiverCalcul}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border"
                style={{ borderColor: "var(--bordure)", color: "var(--texte-2)" }}
              >
                <Calculator size={14} />
                Repasser en manuel
              </button>
            )}
          </div>
        </div>
      )}

      {/* Formulaire ajout simulation */}
      {ajout ? (
        <div
          className="rounded-xl p-4 space-y-3"
          style={{ background: "var(--fond-carte)", border: "2px solid var(--c-leger)" }}
        >
          <p className="text-sm font-semibold" style={{ color: "var(--texte)" }}>
            Nouvelle simulation salariale
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-medium mb-1 block" style={{ color: "var(--texte-3)" }}>
                Libellé *
              </label>
              <input
                type="text"
                value={form.libelle}
                onChange={(e) => setForm({ ...form, libelle: e.target.value })}
                placeholder="Ex : Salarié actuel, Hypothèse recrutement…"
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={{ background: "var(--fond-entree)", border: "1px solid var(--bordure)", color: "var(--texte)" }}
              />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: "var(--texte-3)" }}>
                Salaire net mensuel (€) *
              </label>
              <input
                type="number"
                value={form.salaire_net_mensuel}
                onChange={(e) => setForm({ ...form, salaire_net_mensuel: e.target.value })}
                placeholder="1 800"
                min="0"
                step="50"
                className="w-full rounded-lg px-3 py-2 text-sm font-mono"
                style={{ background: "var(--fond-entree)", border: "1px solid var(--bordure)", color: "var(--texte)" }}
              />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: "var(--texte-3)" }}>
                Primes mensuelles (€)
              </label>
              <input
                type="number"
                value={form.primes_mensuelles}
                onChange={(e) => setForm({ ...form, primes_mensuelles: e.target.value })}
                min="0"
                step="50"
                className="w-full rounded-lg px-3 py-2 text-sm font-mono"
                style={{ background: "var(--fond-entree)", border: "1px solid var(--bordure)", color: "var(--texte)" }}
              />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={creerSim}
              disabled={enCours || !form.libelle || !form.salaire_net_mensuel}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: "var(--c-base)" }}
            >
              <Check size={14} /> Enregistrer
            </button>
            <button
              onClick={() => { setAjout(false); setForm(SIM_VIDE); }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border"
              style={{ borderColor: "var(--bordure)", color: "var(--texte-2)" }}
            >
              <X size={14} /> Annuler
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAjout(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border"
          style={{ borderColor: "var(--bordure)", color: "var(--texte-2)" }}
        >
          <Plus size={14} /> Nouvelle simulation salariale
        </button>
      )}
    </div>
  );
}

// ─── Carte profil (accordéon) ────────────────────────────────────────────────

function CarteProfil({
  profil,
  onEditer,
  onSupprimer,
}: {
  profil: ProfilHoraire;
  onEditer: (p: ProfilHoraire) => void;
  onSupprimer: (id: string) => void;
}) {
  const [ouvert, setOuvert] = useState(false);

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}
    >
      {/* En-tête */}
      <div className="flex items-center justify-between px-4 py-3">
        <button
          type="button"
          className="flex items-center gap-3 flex-1 text-left"
          onClick={() => setOuvert((v) => !v)}
        >
          <div className="w-3 h-10 rounded-full flex-shrink-0" style={{ background: profil.couleur }} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold" style={{ color: "var(--texte)" }}>{profil.libelle}</p>
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{ background: "var(--fond-entree)", color: "var(--texte-3)" }}
              >
                {LIBELLE_TYPE[profil.type_profil] ?? profil.type_profil}
              </span>
              {profil.nb_simulations > 0 && (
                <span
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{ background: "color-mix(in srgb, var(--c-leger) 30%, transparent)", color: "var(--c-base)" }}
                >
                  {profil.nb_simulations} simulation{profil.nb_simulations > 1 ? "s" : ""}
                </span>
              )}
            </div>
            <p className="text-xs mt-0.5" style={{ color: "var(--texte-3)" }}>
              {profil.code}{profil.description ? ` — ${profil.description}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="text-xl font-bold font-mono" style={{ color: profil.couleur }}>
              {fmt(profil.taux_horaire_ht)} €/h
            </span>
            {ouvert ? <ChevronDown size={16} style={{ color: "var(--texte-3)" }} /> : <ChevronRight size={16} style={{ color: "var(--texte-3)" }} />}
          </div>
        </button>
        <div className="flex gap-1 ml-3">
          <button
            type="button"
            onClick={() => onEditer(profil)}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition hover:opacity-80"
            style={{ background: "var(--fond-entree)", color: "var(--texte-2)" }}
          >
            <Pencil size={13} />
          </button>
          <button
            type="button"
            onClick={() => { if (confirm(`Supprimer le profil "${profil.libelle}" ?`)) onSupprimer(profil.id); }}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition hover:opacity-80"
            style={{ background: "color-mix(in srgb, #ef4444 10%, var(--fond-carte))", color: "#ef4444" }}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Corps accordéon */}
      {ouvert && (
        <div className="px-4 pb-4 pt-1" style={{ borderTop: "1px solid var(--bordure)" }}>
          <BlocSimulations profil={profil} />
        </div>
      )}
    </div>
  );
}

// ─── Formulaire profil ──────────────────────────────────────────────────────

function FormulaireProfil({
  form, setForm, onSave, onCancel, enCours, parametre,
}: {
  form: FormProfil;
  setForm: (f: FormProfil) => void;
  onSave: () => void;
  onCancel: () => void;
  enCours: boolean;
  parametre?: ParametreSociete;
}) {
  const ch = (k: keyof FormProfil, v: string | boolean | number) => setForm({ ...form, [k]: v });
  const param = parametre ? appliquerParametresSociete(form, parametre) : form;

  return (
    <div
      className="rounded-xl p-5 space-y-4"
      style={{ background: "var(--fond-carte)", border: "2px solid var(--c-leger)" }}
    >
      <p className="font-semibold text-sm" style={{ color: "var(--texte)" }}>Informations du profil</p>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: "var(--texte-3)" }}>Libellé *</label>
          <input type="text" value={form.libelle} onChange={(e) => ch("libelle", e.target.value)}
            placeholder="Ex : Économiste senior"
            className="w-full rounded-lg px-3 py-2 text-sm"
            style={{ background: "var(--fond-entree)", border: "1px solid var(--bordure)", color: "var(--texte)" }} />
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: "var(--texte-3)" }}>Code *</label>
          <input type="text" value={form.code}
            onChange={(e) => ch("code", e.target.value.toLowerCase().replace(/\s+/g, "_"))}
            placeholder="economiste_senior" className="w-full rounded-lg px-3 py-2 text-sm font-mono"
            style={{ background: "var(--fond-entree)", border: "1px solid var(--bordure)", color: "var(--texte)" }} />
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: "var(--texte-3)" }}>Type de profil</label>
          <select value={form.type_profil}
            onChange={(e) => setForm({ ...form, type_profil: e.target.value })}
            className="w-full rounded-lg px-3 py-2 text-sm"
            style={{ background: "var(--fond-entree)", border: "1px solid var(--bordure)", color: "var(--texte)" }}>
            <option value="be">Bureau d&apos;études</option>
            <option value="autre">Autre</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: "var(--texte-3)" }}>
            Taux horaire HT (€/h) — calcul automatique
          </label>
          <div
            className="rounded-lg px-3 py-2 text-sm font-mono"
            style={{ background: "var(--fond-entree)", border: "1px solid var(--bordure)", color: "var(--texte)" }}
          >
            {fmt(form.taux_horaire_ht)} €/h
          </div>
          <p className="mt-1 text-xs" style={{ color: "var(--texte-3)" }}>
            Alimenté par les simulations salariales actives du profil.
          </p>
        </div>
      </div>

      <p className="font-semibold text-sm pt-2" style={{ color: "var(--texte)" }}>Paramètres de calcul salarial</p>
      <p className="text-xs" style={{ color: "var(--texte-3)" }}>
        Ces données proviennent de Société &gt; Charges société &gt; Masse salariale.
      </p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: "var(--texte-3)" }}>
            Charges salariales
          </label>
          <div className="w-full rounded-lg px-3 py-2 text-sm font-mono" style={{ background: "var(--fond-entree)", border: "1px solid var(--bordure)", color: "var(--texte)" }}>{pct(param.taux_charges_salariales)}</div>
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: "var(--texte-3)" }}>
            Charges patronales
          </label>
          <div className="w-full rounded-lg px-3 py-2 text-sm font-mono" style={{ background: "var(--fond-entree)", border: "1px solid var(--bordure)", color: "var(--texte)" }}>{pct(param.taux_charges_patronales)}</div>
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: "var(--texte-3)" }}>
            Heures productives/an
          </label>
          <div className="w-full rounded-lg px-3 py-2 text-sm font-mono" style={{ background: "var(--fond-entree)", border: "1px solid var(--bordure)", color: "var(--texte)" }}>{fmt(param.heures_productives_an, 0)} h</div>
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: "var(--texte-3)" }}>
            Marge de vente
          </label>
          <div className="w-full rounded-lg px-3 py-2 text-sm font-mono" style={{ background: "var(--fond-entree)", border: "1px solid var(--bordure)", color: "var(--texte)" }}>{pct(param.taux_marge_vente)}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: "var(--texte-3)" }}>Couleur</label>
          <div className="flex gap-2">
            <input type="color" value={form.couleur} onChange={(e) => ch("couleur", e.target.value)}
              className="w-10 h-10 rounded-lg border cursor-pointer"
              style={{ border: "1px solid var(--bordure)" }} />
            <input type="text" value={form.couleur} onChange={(e) => ch("couleur", e.target.value)}
              className="flex-1 rounded-lg px-3 py-2 text-sm font-mono"
              style={{ background: "var(--fond-entree)", border: "1px solid var(--bordure)", color: "var(--texte)" }} />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: "var(--texte-3)" }}>Description</label>
          <input type="text" value={form.description} onChange={(e) => ch("description", e.target.value)}
            placeholder="Description courte…"
            className="w-full rounded-lg px-3 py-2 text-sm"
            style={{ background: "var(--fond-entree)", border: "1px solid var(--bordure)", color: "var(--texte)" }} />
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button type="button" onClick={onSave}
          disabled={enCours || !form.libelle || !form.code}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
          style={{ background: "var(--c-base)" }}>
          <Check size={14} /> Enregistrer
        </button>
        <button type="button" onClick={onCancel}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border"
          style={{ borderColor: "var(--bordure)", color: "var(--texte-2)" }}>
          <X size={14} /> Annuler
        </button>
      </div>
    </div>
  );
}

// ─── Page principale ─────────────────────────────────────────────────────────

export default function PageTauxHoraires() {
  const qc = useQueryClient();
  const [modifierId, setModifierId] = useState<string | null>(null);
  const [creer, setCreer] = useState(false);
  const [form, setForm] = useState<FormProfil>(FORM_VIDE);

  const { data: profils = [], isLoading } = useQuery<ProfilHoraire[]>({
    queryKey: ["profils-horaires"],
    queryFn: async () => {
      const r = await api.get<{ results?: ProfilHoraire[] } | ProfilHoraire[]>("/api/societe/profils-horaires/");
      return Array.isArray(r) ? r : (r.results ?? []);
    },
  });

  const { data: utilisateurs = [] } = useQuery<Array<{ id: string; prenom: string; nom: string; fonction: string }>>({
    queryKey: ["societe-utilisateurs-taux"],
    queryFn: async () => {
      const r = await api.get<{ results?: Array<{ id: string; prenom: string; nom: string; fonction: string }> } | Array<{ id: string; prenom: string; nom: string; fonction: string }>>("/api/auth/utilisateurs/");
      return Array.isArray(r) ? r : (r.results ?? []);
    },
  });

  const { data: affectations = [] } = useQuery<ProfilHoraireUtilisateur[]>({
    queryKey: ["profils-horaires-utilisateurs"],
    queryFn: async () => {
      const r = await api.get<{ results?: ProfilHoraireUtilisateur[] } | ProfilHoraireUtilisateur[]>("/api/societe/profils-horaires-utilisateurs/");
      return Array.isArray(r) ? r : (r.results ?? []);
    },
  });

  const { data: parametresSociete = [] } = useQuery<ParametreSociete[]>({
    queryKey: ["societe-parametres"],
    queryFn: async () => {
      const r = await api.get<{ results?: ParametreSociete[] } | ParametreSociete[]>("/api/societe/parametres-societe/");
      return Array.isArray(r) ? r : (r.results ?? []);
    },
  });
  const parametreSociete = parametresSociete[0];

  const sauvegarder = useMutation({
    mutationFn: (data: FormProfil) => {
      const donnees = appliquerParametresSociete(data, parametreSociete);
      return modifierId
        ? api.put<ProfilHoraire>(`/api/societe/profils-horaires/${modifierId}/`, { ...donnees, utiliser_calcul: true })
        : api.post<ProfilHoraire>("/api/societe/profils-horaires/", { ...donnees, utiliser_calcul: true });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profils-horaires"] });
      setModifierId(null);
      setCreer(false);
      setForm(FORM_VIDE);
    },
  });

  const supprimer = useMutation({
    mutationFn: (id: string) => api.supprimer(`/api/societe/profils-horaires/${id}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profils-horaires"] }),
  });

  const sauvegarderAffectation = useMutation({
    mutationFn: ({ id, utilisateur, profil_horaire }: { id?: string; utilisateur: string; profil_horaire: string }) =>
      id
        ? api.put(`/api/societe/profils-horaires-utilisateurs/${id}/`, { utilisateur, profil_horaire })
        : api.post("/api/societe/profils-horaires-utilisateurs/", { utilisateur, profil_horaire }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profils-horaires-utilisateurs"] }),
  });

  const ouvrirEdition = (p: ProfilHoraire) => {
    setModifierId(p.id);
    setCreer(false);
    setForm(profilVersForm(p));
  };

  const annuler = () => {
    setModifierId(null);
    setCreer(false);
    setForm(FORM_VIDE);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 style={{ color: "var(--texte)" }}>Profils horaires et simulations salariales</h2>
          <p className="text-sm mt-1" style={{ color: "var(--texte-3)" }}>
            Définissez les taux de facturation par profil et simulez les fiches de paie pour piloter automatiquement vos taux horaires.
          </p>
        </div>
        {!creer && !modifierId && (
          <button type="button"
            onClick={() => { setCreer(true); setModifierId(null); setForm(FORM_VIDE); }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ background: "var(--c-base)" }}>
            <Plus size={14} /> Nouveau profil
          </button>
        )}
      </div>

      {isLoading && (
        <p className="text-sm py-8 text-center" style={{ color: "var(--texte-3)" }}>Chargement…</p>
      )}

      {creer && (
        <FormulaireProfil form={form} setForm={setForm} parametre={parametreSociete}
          onSave={() => sauvegarder.mutate(form)} onCancel={annuler}
          enCours={sauvegarder.isPending} />
      )}

      <div className="space-y-3">
        {profils.map((p) => (
          modifierId === p.id ? (
            <FormulaireProfil key={p.id} form={form} setForm={setForm} parametre={parametreSociete}
              onSave={() => sauvegarder.mutate(form)} onCancel={annuler}
              enCours={sauvegarder.isPending} />
          ) : (
            <CarteProfil key={p.id} profil={p}
              onEditer={ouvrirEdition}
              onSupprimer={(id) => supprimer.mutate(id)} />
          )
        ))}
      </div>

      {!isLoading && profils.length === 0 && !creer && (
        <div className="rounded-xl border-2 border-dashed flex flex-col items-center justify-center py-12 gap-3"
          style={{ borderColor: "var(--bordure)" }}>
          <p className="text-sm" style={{ color: "var(--texte-3)" }}>Aucun profil configuré</p>
          <button type="button" onClick={() => { setCreer(true); setForm(FORM_VIDE); }}
            className="text-sm font-medium underline" style={{ color: "var(--c-base)" }}>
            Créer le premier profil
          </button>
        </div>
      )}

      {/* Affectation salarié → profil */}
      <div className="space-y-3 pt-4">
        <div className="flex items-center gap-2">
          <Users size={16} style={{ color: "var(--texte-3)" }} />
          <div>
            <h3 style={{ color: "var(--texte)" }}>Affectation salarié → profil</h3>
            <p className="text-sm mt-0.5" style={{ color: "var(--texte-3)" }}>
              Profil horaire par défaut repris dans les feuilles de temps et les suggestions de devis.
            </p>
          </div>
        </div>
        <div className="space-y-2">
          {utilisateurs.map((u) => {
            const nomComplet = [u.prenom, u.nom].filter(Boolean).join(" ");
            const affectation = affectations.find((a) => a.utilisateur === u.id);
            return (
              <div key={u.id}
                className="grid grid-cols-1 gap-3 rounded-xl p-4 md:grid-cols-[1.5fr_1fr]"
                style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}>
                <div>
                  <p className="font-medium" style={{ color: "var(--texte)" }}>{nomComplet}</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--texte-3)" }}>
                    {u.fonction || "Fonction non renseignée"}
                  </p>
                </div>
                <select
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  value={affectation?.profil_horaire ?? ""}
                  onChange={(e) => {
                    if (!e.target.value) return;
                    sauvegarderAffectation.mutate({
                      id: affectation?.id,
                      utilisateur: u.id,
                      profil_horaire: e.target.value,
                    });
                  }}
                  style={{ background: "var(--fond-entree)", border: "1px solid var(--bordure)", color: "var(--texte)" }}>
                  <option value="">Aucun profil par défaut</option>
                  {profils.map((profil) => (
                    <option key={profil.id} value={profil.id}>
                      {profil.libelle} · {fmt(profil.taux_horaire_ht)} €/h
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
