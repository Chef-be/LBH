"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, RefreshCw, Save, Trash2 } from "lucide-react";

import { api } from "@/crochets/useApi";
import type { ChargeFixeStructure, ParametreSociete, PilotageEconomiqueSociete, ProfilHoraire } from "@/types/societe";

type Onglet = "charges" | "salaires";
type DecompositionHeuresProductives = {
  heures_theoriques_annuelles: number;
  conges_payes: number;
  jours_feries_et_absences: number;
  administratif_interne: number;
  formation_veille: number;
  commercial_non_facturable: number;
};
type FormParametreSociete = Omit<
  ParametreSociete,
  "id" | "date_creation" | "date_modification" | "decomposition_heures_productives"
> & {
  decomposition_heures_productives: DecompositionHeuresProductives;
};

const PARAM_VIDE: FormParametreSociete = {
  annee: 2026,
  zone_smic: "Mayotte",
  smic_horaire_brut: "9.33",
  pmss: "4005.00",
  pass_annuel: "48060.00",
  taux_charges_salariales: "0.2200",
  taux_charges_patronales: "0.4200",
  heures_productives_be: "1600.00",
  heures_facturables_jour: "7.00",
  decomposition_heures_productives: {
    heures_theoriques_annuelles: 1820,
    conges_payes: 175,
    jours_feries_et_absences: 35,
    administratif_interne: 10,
    formation_veille: 0,
    commercial_non_facturable: 0,
  },
  objectif_marge_nette: "0.1500",
  taux_frais_generaux: "0.0000",
  taux_frais_commerciaux: "0.0000",
  taux_risque_alea: "0.0000",
  taux_imponderables: "0.0000",
  taux_marge_cible: "0.1500",
  mode_arrondi_tarif: "aucun",
  pas_arrondi_tarif: "1.00",
  strategie_tarifaire: "mixte",
  taux_tva_defaut: "0.200",
};

function normaliserDecomposition(source?: Record<string, number>): DecompositionHeuresProductives {
  return {
    ...PARAM_VIDE.decomposition_heures_productives,
    ...(source ?? {}),
  };
}

function euros(valeur: number | string | null | undefined) {
  const n = Number(valeur ?? 0);
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " €";
}

function pct(valeur: string | number) {
  return (Number(valeur) * 100).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " %";
}

function valeurPourcentage(valeur: string | number) {
  return String(Number(valeur || 0) * 100);
}

function tauxDepuisPourcentage(valeur: string) {
  return String((Number(valeur || 0) / 100).toFixed(4));
}

export default function PageChargesSociete() {
  const qc = useQueryClient();
  const [onglet, setOnglet] = useState<Onglet>("charges");
  const [nouvelleCharge, setNouvelleCharge] = useState({ libelle: "", montant_mensuel: "0" });
  const [sourceSmic, setSourceSmic] = useState<{ source: string; mode: string } | null>(null);

  const { data: parametres = [] } = useQuery<ParametreSociete[]>({
    queryKey: ["societe-parametres"],
    queryFn: async () => {
      const r = await api.get<{ results?: ParametreSociete[] } | ParametreSociete[]>("/api/societe/parametres-societe/");
      return Array.isArray(r) ? r : (r.results ?? []);
    },
  });
  const parametre = parametres[0];
  const [formParam, setFormParam] = useState<FormParametreSociete>(PARAM_VIDE);

  const { data: charges = [] } = useQuery<ChargeFixeStructure[]>({
    queryKey: ["societe-charges-fixes"],
    queryFn: async () => {
      const r = await api.get<{ results?: ChargeFixeStructure[] } | ChargeFixeStructure[]>("/api/societe/charges-fixes/");
      return Array.isArray(r) ? r : (r.results ?? []);
    },
  });

  const { data: profils = [] } = useQuery<ProfilHoraire[]>({
    queryKey: ["profils-horaires"],
    queryFn: async () => {
      const r = await api.get<{ results?: ProfilHoraire[] } | ProfilHoraire[]>("/api/societe/profils-horaires/");
      return Array.isArray(r) ? r : (r.results ?? []);
    },
  });
  const { data: pilotage } = useQuery<PilotageEconomiqueSociete>({
    queryKey: ["societe-pilotage-economique"],
    queryFn: () => api.get<PilotageEconomiqueSociete>("/api/societe/pilotage-economique/"),
  });

  useEffect(() => {
    if (parametre) {
      setFormParam({
        annee: parametre.annee,
        zone_smic: parametre.zone_smic,
        smic_horaire_brut: parametre.smic_horaire_brut,
        pmss: parametre.pmss,
        pass_annuel: parametre.pass_annuel,
        taux_charges_salariales: parametre.taux_charges_salariales,
        taux_charges_patronales: parametre.taux_charges_patronales,
        heures_productives_be: parametre.heures_productives_be,
        heures_facturables_jour: parametre.heures_facturables_jour ?? "7.00",
        objectif_marge_nette: parametre.objectif_marge_nette,
        taux_frais_generaux: parametre.taux_frais_generaux ?? "0.0000",
        taux_frais_commerciaux: parametre.taux_frais_commerciaux ?? "0.0000",
        taux_risque_alea: parametre.taux_risque_alea ?? "0.0000",
        taux_imponderables: parametre.taux_imponderables ?? "0.0000",
        taux_marge_cible: parametre.taux_marge_cible ?? parametre.objectif_marge_nette,
        mode_arrondi_tarif: parametre.mode_arrondi_tarif ?? "aucun",
        pas_arrondi_tarif: parametre.pas_arrondi_tarif ?? "1.00",
        strategie_tarifaire: parametre.strategie_tarifaire ?? "mixte",
        taux_tva_defaut: parametre.taux_tva_defaut,
        decomposition_heures_productives: normaliserDecomposition(parametre.decomposition_heures_productives),
      });
    }
  }, [parametre]);

  const totalFraisFixes = charges.filter((c) => c.actif).reduce((s, c) => s + Number(c.montant_annuel), 0);
  const coutSalaires = profils.reduce((s, profil) => (
    s + profil.simulations.filter((sim) => sim.actif).reduce((ss, sim) => ss + Number(sim.cout_annuel), 0)
  ), 0);
  const coutComplet = totalFraisFixes + coutSalaires;
  const caCible = coutComplet / Math.max(0.01, 1 - Number(formParam.objectif_marge_nette));
  const decomposition = formParam.decomposition_heures_productives;
  const heuresProductives = Math.max(
    0,
    Number(decomposition.heures_theoriques_annuelles || 0)
      - Number(decomposition.conges_payes || 0)
      - Number(decomposition.jours_feries_et_absences || 0)
      - Number(decomposition.administratif_interne || 0)
      - Number(decomposition.formation_veille || 0)
      - Number(decomposition.commercial_non_facturable || 0)
  );

  const sauverParametre = useMutation({
    mutationFn: () => {
      const corps = { ...formParam, heures_productives_be: heuresProductives.toFixed(2) };
      return parametre
        ? api.put(`/api/societe/parametres-societe/${parametre.id}/`, corps)
        : api.post("/api/societe/parametres-societe/", corps);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["societe-parametres"] });
      qc.invalidateQueries({ queryKey: ["societe-pilotage-economique"] });
    },
  });
  const recalculerTarifs = useMutation({
    mutationFn: () => api.post<PilotageEconomiqueSociete>("/api/societe/recalculer-tarifs/", {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["societe-pilotage-economique"] });
      qc.invalidateQueries({ queryKey: ["profils-horaires"] });
    },
  });

  const suggererSmic = async (zone: string) => {
    const r = await api.get<{ smic_horaire_brut: string; source: string; mode: string }>(`/api/societe/references/smic/?zone=${encodeURIComponent(zone)}`);
    setSourceSmic({ source: r.source, mode: r.mode });
    setFormParam((p) => ({ ...p, smic_horaire_brut: r.smic_horaire_brut }));
  };

  const creerCharge = useMutation({
    mutationFn: () => api.post("/api/societe/charges-fixes/", {
      ...nouvelleCharge,
      ordre: charges.length + 1,
      actif: true,
    }),
    onSuccess: () => {
      setNouvelleCharge({ libelle: "", montant_mensuel: "0" });
      qc.invalidateQueries({ queryKey: ["societe-charges-fixes"] });
    },
  });

  const majCharge = useMutation({
    mutationFn: (charge: ChargeFixeStructure) => api.put(`/api/societe/charges-fixes/${charge.id}/`, charge),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["societe-charges-fixes"] }),
  });

  const supprimerCharge = useMutation({
    mutationFn: (id: string) => api.supprimer(`/api/societe/charges-fixes/${id}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["societe-charges-fixes"] }),
  });

  const champ = {
    background: "var(--fond-entree)",
    border: "1px solid var(--bordure)",
    color: "var(--texte)",
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 style={{ color: "var(--texte)" }}>Charges société</h2>
        <p className="text-sm" style={{ color: "var(--texte-3)" }}>
          Paramètres économiques utilisés pour calculer les taux, la rentabilité et le seuil de CA.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          ["Frais fixes annuels", euros(totalFraisFixes)],
          ["Coût annuel salaires", euros(pilotage?.cout_direct_annuel ?? coutSalaires)],
          ["Coût complet annuel", euros(pilotage?.cout_complet_annuel ?? coutComplet)],
          ["CA cible annuel", euros(pilotage?.ca_cible_annuel ?? caCible)],
          ["Coefficient K", Number(pilotage?.coefficient_k ?? 1).toLocaleString("fr-FR", { maximumFractionDigits: 2 })],
          ["Taux moyen pondéré", euros(pilotage?.taux_horaire_moyen_pondere ?? 0) + "/h"],
          ["Forfait jour moyen", euros(pilotage?.forfait_jour_moyen_ht ?? 0)],
        ].map(([label, valeur]) => (
          <div key={label} className="rounded-xl p-4" style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}>
            <p className="text-xs uppercase tracking-wider" style={{ color: "var(--texte-3)" }}>{label}</p>
            <p className="mt-1 text-xl font-bold" style={{ color: "var(--texte)" }}>{valeur}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl p-1" style={{ background: "var(--fond-entree)", border: "1px solid var(--bordure)" }}>
        <button onClick={() => setOnglet("charges")} className="rounded-lg px-4 py-2 text-sm font-medium" style={onglet === "charges" ? { background: "var(--c-base)", color: "#fff" } : { color: "var(--texte-2)" }}>Charges fixes</button>
        <button onClick={() => setOnglet("salaires")} className="rounded-lg px-4 py-2 text-sm font-medium" style={onglet === "salaires" ? { background: "var(--c-base)", color: "#fff" } : { color: "var(--texte-2)" }}>Masse salariale</button>
        <button onClick={() => recalculerTarifs.mutate()} className="ml-auto inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={recalculerTarifs.isPending} style={{ background: "var(--c-base)" }}>
          <RefreshCw size={14} /> Recalculer les tarifs
        </button>
      </div>

      {pilotage ? (
        <section className="rounded-xl p-5" style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}>
          <h3 style={{ color: "var(--texte)" }}>Coefficient K</h3>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            {[
              ["Coûts directs", pilotage.cout_direct_annuel],
              ["Charges fixes", pilotage.charges_structure_annuelles],
              ["Frais généraux", pilotage.frais_generaux_annuels ?? "0"],
              ["Frais commerciaux", pilotage.frais_commerciaux_annuels ?? "0"],
              ["Risques", pilotage.risques_annuels ?? "0"],
              ["Impondérables", pilotage.imponderables_annuels ?? "0"],
              ["CA cible mensuel", pilotage.ca_cible_mensuel],
              ["Seuil mensuel", pilotage.seuil_rentabilite_mensuel ?? "0"],
            ].map(([label, valeur]) => (
              <div key={label} className="rounded-lg p-3" style={{ background: "var(--fond-entree)", border: "1px solid var(--bordure)" }}>
                <p className="text-xs" style={{ color: "var(--texte-3)" }}>{label}</p>
                <p className="font-semibold" style={{ color: "var(--texte)" }}>{euros(valeur)}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {onglet === "charges" ? (
        <section className="rounded-xl p-5" style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}>
          <div className="space-y-3">
            {charges.map((charge) => (
              <div key={charge.id} className="grid gap-3 rounded-xl p-3 md:grid-cols-[1fr_180px_160px_160px_80px]" style={{ background: "var(--fond-entree)", border: "1px solid var(--bordure)" }}>
                <input value={charge.libelle} onChange={(e) => majCharge.mutate({ ...charge, libelle: e.target.value })} className="rounded-lg px-3 py-2 text-sm" style={champ} />
                <select value={charge.categorie ?? "autres"} onChange={(e) => majCharge.mutate({ ...charge, categorie: e.target.value as ChargeFixeStructure["categorie"] })} className="rounded-lg px-3 py-2 text-sm" style={champ}>
                  <option value="loyer">Loyer</option>
                  <option value="logiciels">Logiciels</option>
                  <option value="assurances">Assurances</option>
                  <option value="comptabilite">Comptabilité</option>
                  <option value="vehicule">Véhicule</option>
                  <option value="telephonie">Téléphonie</option>
                  <option value="materiel">Matériel</option>
                  <option value="documentation">Documentation</option>
                  <option value="frais_bancaires">Frais bancaires</option>
                  <option value="sous_traitance_structurelle">Sous-traitance structurelle</option>
                  <option value="commercial">Commercial</option>
                  <option value="autres">Autres</option>
                </select>
                <input type="number" value={charge.montant_mensuel} onChange={(e) => majCharge.mutate({ ...charge, montant_mensuel: e.target.value })} className="rounded-lg px-3 py-2 text-sm font-mono" style={champ} />
                <div className="rounded-lg px-3 py-2 text-sm font-mono" style={{ background: "var(--fond-carte)", color: "var(--texte)" }}>{euros(charge.montant_annuel)}</div>
                <button onClick={() => supprimerCharge.mutate(charge.id)} className="rounded-lg px-3 py-2 text-red-500 hover:bg-red-50"><Trash2 size={15} /></button>
              </div>
            ))}
            <div className="grid gap-3 rounded-xl p-3 md:grid-cols-[1fr_160px_120px]" style={{ background: "var(--fond-entree)", border: "1px dashed var(--bordure)" }}>
              <input placeholder="Nouvelle charge" value={nouvelleCharge.libelle} onChange={(e) => setNouvelleCharge((p) => ({ ...p, libelle: e.target.value }))} className="rounded-lg px-3 py-2 text-sm" style={champ} />
              <input type="number" value={nouvelleCharge.montant_mensuel} onChange={(e) => setNouvelleCharge((p) => ({ ...p, montant_mensuel: e.target.value }))} className="rounded-lg px-3 py-2 text-sm font-mono" style={champ} />
              <button disabled={!nouvelleCharge.libelle.trim()} onClick={() => creerCharge.mutate()} className="inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: "var(--c-base)" }}><Plus size={14} /> Ajouter</button>
            </div>
          </div>
        </section>
      ) : (
        <section className="rounded-xl p-5" style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { label: "Taux charges salariales", key: "taux_charges_salariales", pct: true },
              { label: "Taux charges patronales", key: "taux_charges_patronales", pct: true },
              { label: "Taux marge cible", key: "taux_marge_cible", pct: true },
              { label: "Frais généraux", key: "taux_frais_generaux", pct: true },
              { label: "Frais commerciaux", key: "taux_frais_commerciaux", pct: true },
              { label: "Risque / aléas", key: "taux_risque_alea", pct: true },
              { label: "Impondérables", key: "taux_imponderables", pct: true },
              { label: "TVA par défaut", key: "taux_tva_defaut", pct: true },
              { label: "Heures facturables / jour", key: "heures_facturables_jour" },
              { label: "SMIC horaire brut", key: "smic_horaire_brut" },
              { label: "PMSS", key: "pmss", aide: "Plafond mensuel de la sécurité sociale : base de calcul de certaines cotisations sociales." },
              { label: "PASS", key: "pass_annuel", aide: "Plafond annuel de la sécurité sociale : référence annuelle issue du PMSS." },
            ].map(({ label, key, pct: estPct, aide }) => (
              <label key={key} className="space-y-1">
                <span className="text-xs font-medium" style={{ color: "var(--texte-3)" }} title={aide}>{label}</span>
                <input
                  disabled={key === "smic_horaire_brut"}
                  value={estPct
                    ? valeurPourcentage(String(formParam[key as keyof typeof formParam]))
                    : String(formParam[key as keyof typeof formParam])}
                  onChange={(e) => setFormParam((p) => ({
                    ...p,
                    [key]: estPct
                      ? tauxDepuisPourcentage(e.target.value)
                      : e.target.value,
                  }))}
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={{
                    ...champ,
                    opacity: key === "smic_horaire_brut" ? 0.72 : 1,
                    cursor: key === "smic_horaire_brut" ? "not-allowed" : "text",
                  }}
                />
              </label>
            ))}
            <label className="space-y-1">
              <span className="text-xs font-medium" style={{ color: "var(--texte-3)" }}>Zone SMIC</span>
              <select
                value={formParam.zone_smic}
                onChange={(e) => setFormParam((p) => ({ ...p, zone_smic: e.target.value }))}
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={champ}
              >
                <option value="Mayotte">Mayotte</option>
                <option value="France hors Mayotte">France hors Mayotte</option>
              </select>
            </label>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <select value={formParam.strategie_tarifaire} onChange={(e) => setFormParam((p) => ({ ...p, strategie_tarifaire: e.target.value as ParametreSociete["strategie_tarifaire"] }))} className="rounded-lg px-3 py-2 text-sm" style={champ}>
              <option value="taux_unique">Taux moyen unique</option>
              <option value="taux_par_profil">Taux par profil</option>
              <option value="mixte">Mixte</option>
            </select>
            <select value={formParam.mode_arrondi_tarif} onChange={(e) => setFormParam((p) => ({ ...p, mode_arrondi_tarif: e.target.value as ParametreSociete["mode_arrondi_tarif"] }))} className="rounded-lg px-3 py-2 text-sm" style={champ}>
              <option value="aucun">Sans arrondi</option>
              <option value="euro">Arrondi euro</option>
              <option value="cinq_euros">Arrondi 5 €</option>
              <option value="dix_euros">Arrondi 10 €</option>
            </select>
            <button onClick={() => suggererSmic(formParam.zone_smic)} className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold" style={{ background: "var(--fond-entree)", border: "1px solid var(--bordure)", color: "var(--texte)" }}>
              Mettre à jour automatiquement le SMIC
            </button>
            <button onClick={() => sauverParametre.mutate()} className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ background: "var(--c-base)" }}>
              <Save size={14} /> Enregistrer
            </button>
          </div>
          <p className="mt-2 text-xs" style={{ color: "var(--texte-3)" }}>
            Le SMIC horaire brut est verrouillé et se met à jour depuis Service-Public selon la zone sélectionnée.
          </p>
          {sourceSmic ? (
            <p className="mt-2 text-xs" style={{ color: "var(--texte-3)" }}>
              Source SMIC : <a href={sourceSmic.source} target="_blank" rel="noreferrer" className="underline">Service-Public.fr</a>
              {sourceSmic.mode === "repli_service_public" ? " (valeur de repli alignée sur Service-Public)" : ""}
            </p>
          ) : null}

          <div className="mt-6 rounded-xl p-4" style={{ background: "var(--fond-entree)", border: "1px solid var(--bordure)" }}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--texte)" }}>Décomposition des heures productives par an</p>
                <p className="text-xs" style={{ color: "var(--texte-3)" }}>Le total calculé alimente automatiquement les profils horaires.</p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-3">
                <p className="text-2xl font-bold font-mono" style={{ color: "var(--c-base)" }}>{heuresProductives.toLocaleString("fr-FR")} h</p>
                <button
                  type="button"
                  onClick={() => sauverParametre.mutate()}
                  disabled={sauverParametre.isPending}
                  className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                  style={{ background: "var(--c-base)" }}
                >
                  <Save size={13} /> Enregistrer
                </button>
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {([
                ["Heures théoriques annuelles", "heures_theoriques_annuelles"],
                ["Congés payés", "conges_payes"],
                ["Jours fériés / absences", "jours_feries_et_absences"],
                ["Administratif interne", "administratif_interne"],
                ["Formation / veille", "formation_veille"],
                ["Commercial non facturable", "commercial_non_facturable"],
              ] as Array<[string, keyof DecompositionHeuresProductives]>).map(([label, key]) => (
                <label key={key} className="space-y-1">
                  <span className="text-xs" style={{ color: "var(--texte-3)" }}>{label}</span>
                  <input
                    type="number"
                    value={decomposition[key] ?? 0}
                    onChange={(e) => setFormParam((p) => ({
                      ...p,
                      decomposition_heures_productives: {
                        ...p.decomposition_heures_productives,
                        [key]: Number(e.target.value || 0),
                      },
                    }))}
                    className="w-full rounded-lg px-3 py-2 text-sm font-mono"
                    style={champ}
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="mt-6 overflow-x-auto rounded-xl" style={{ border: "1px solid var(--bordure)" }}>
            <table className="w-full text-sm">
              <thead style={{ background: "var(--fond-entree)", color: "var(--texte-3)" }}>
                <tr>
                  <th className="p-3 text-left">Profil</th>
                  <th className="p-3 text-right">Coût annuel</th>
                  <th className="p-3 text-right">Coût direct moyen</th>
                  <th className="p-3 text-right">Taux vente calculé</th>
                  <th className="p-3 text-right">Forfait jour</th>
                </tr>
              </thead>
              <tbody>
                {profils.map((profil) => {
                  const sims = profil.simulations.filter((s) => s.actif);
                  const cout = sims.reduce((s, sim) => s + Number(sim.cout_annuel), 0);
                  const coutDirect = sims.length ? sims.reduce((s, sim) => s + Number(sim.cout_direct_horaire || sim.dhmo), 0) / sims.length : Number(profil.cout_direct_horaire || 0);
                  return (
                    <tr key={profil.id} style={{ borderTop: "1px solid var(--bordure)" }}>
                      <td className="p-3" style={{ color: "var(--texte)" }}>{profil.libelle}</td>
                      <td className="p-3 text-right font-mono" style={{ color: "var(--texte)" }}>{euros(cout)}</td>
                      <td className="p-3 text-right font-mono" style={{ color: "var(--texte)" }}>{euros(coutDirect)}</td>
                      <td className="p-3 text-right font-mono" style={{ color: "var(--c-base)" }}>{euros(profil.taux_vente_horaire_calcule || profil.taux_horaire_ht_calcule || profil.taux_horaire_ht)}</td>
                      <td className="p-3 text-right font-mono" style={{ color: "var(--texte-2)" }}>{euros(profil.forfait_jour_ht_calcule)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
