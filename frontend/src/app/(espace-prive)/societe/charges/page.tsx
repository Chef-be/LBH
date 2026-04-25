"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Save, Trash2 } from "lucide-react";

import { api } from "@/crochets/useApi";
import type { ChargeFixeStructure, ParametreSociete, ProfilHoraire } from "@/types/societe";

type Onglet = "charges" | "salaires";

const PARAM_VIDE = {
  annee: 2026,
  zone_smic: "Mayotte",
  smic_horaire_brut: "9.33",
  pmss: "4005.00",
  pass_annuel: "48060.00",
  taux_charges_salariales: "0.2200",
  taux_charges_patronales: "0.4200",
  heures_productives_be: "1600.00",
  objectif_marge_nette: "0.1500",
  taux_tva_defaut: "0.200",
};

function euros(valeur: number | string | null | undefined) {
  const n = Number(valeur ?? 0);
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " €";
}

function pct(valeur: string | number) {
  return (Number(valeur) * 100).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " %";
}

export default function PageChargesSociete() {
  const qc = useQueryClient();
  const [onglet, setOnglet] = useState<Onglet>("charges");
  const [nouvelleCharge, setNouvelleCharge] = useState({ libelle: "", montant_mensuel: "0" });

  const { data: parametres = [] } = useQuery<ParametreSociete[]>({
    queryKey: ["societe-parametres"],
    queryFn: async () => {
      const r = await api.get<{ results?: ParametreSociete[] } | ParametreSociete[]>("/api/societe/parametres-societe/");
      return Array.isArray(r) ? r : (r.results ?? []);
    },
  });
  const parametre = parametres[0];
  const [formParam, setFormParam] = useState(PARAM_VIDE);

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
        objectif_marge_nette: parametre.objectif_marge_nette,
        taux_tva_defaut: parametre.taux_tva_defaut,
      });
    }
  }, [parametre]);

  const totalFraisFixes = charges.filter((c) => c.actif).reduce((s, c) => s + Number(c.montant_annuel), 0);
  const coutSalaires = profils.reduce((s, profil) => (
    s + profil.simulations.filter((sim) => sim.actif).reduce((ss, sim) => ss + Number(sim.cout_annuel), 0)
  ), 0);
  const coutComplet = totalFraisFixes + coutSalaires;
  const caCible = coutComplet / Math.max(0.01, 1 - Number(formParam.objectif_marge_nette));

  const sauverParametre = useMutation({
    mutationFn: () => parametre
      ? api.put(`/api/societe/parametres-societe/${parametre.id}/`, formParam)
      : api.post("/api/societe/parametres-societe/", formParam),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["societe-parametres"] }),
  });

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
          ["Coût annuel salaires", euros(coutSalaires)],
          ["Coût complet annuel", euros(coutComplet)],
          ["CA cible annuel", euros(caCible)],
        ].map(([label, valeur]) => (
          <div key={label} className="rounded-xl p-4" style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}>
            <p className="text-xs uppercase tracking-wider" style={{ color: "var(--texte-3)" }}>{label}</p>
            <p className="mt-1 text-xl font-bold" style={{ color: "var(--texte)" }}>{valeur}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 rounded-xl p-1" style={{ background: "var(--fond-entree)", border: "1px solid var(--bordure)" }}>
        <button onClick={() => setOnglet("charges")} className="rounded-lg px-4 py-2 text-sm font-medium" style={onglet === "charges" ? { background: "var(--c-base)", color: "#fff" } : { color: "var(--texte-2)" }}>Charges fixes</button>
        <button onClick={() => setOnglet("salaires")} className="rounded-lg px-4 py-2 text-sm font-medium" style={onglet === "salaires" ? { background: "var(--c-base)", color: "#fff" } : { color: "var(--texte-2)" }}>Masse salariale</button>
      </div>

      {onglet === "charges" ? (
        <section className="rounded-xl p-5" style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}>
          <div className="space-y-3">
            {charges.map((charge) => (
              <div key={charge.id} className="grid gap-3 rounded-xl p-3 md:grid-cols-[1fr_160px_160px_80px]" style={{ background: "var(--fond-entree)", border: "1px solid var(--bordure)" }}>
                <input value={charge.libelle} onChange={(e) => majCharge.mutate({ ...charge, libelle: e.target.value })} className="rounded-lg px-3 py-2 text-sm" style={champ} />
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
              ["Taux charges salariales", "taux_charges_salariales"],
              ["Taux charges patronales", "taux_charges_patronales"],
              ["Heures productives BE/an", "heures_productives_be"],
              ["Objectif marge nette", "objectif_marge_nette"],
              ["SMIC horaire brut", "smic_horaire_brut"],
              ["PMSS", "pmss"],
              ["PASS", "pass_annuel"],
              ["TVA par défaut", "taux_tva_defaut"],
              ["Zone SMIC", "zone_smic"],
            ].map(([label, key]) => (
              <label key={key} className="space-y-1">
                <span className="text-xs font-medium" style={{ color: "var(--texte-3)" }}>{label}</span>
                <input value={String(formParam[key as keyof typeof formParam])} onChange={(e) => setFormParam((p) => ({ ...p, [key]: e.target.value }))} className="w-full rounded-lg px-3 py-2 text-sm" style={champ} />
              </label>
            ))}
          </div>
          <button onClick={() => sauverParametre.mutate()} className="mt-5 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ background: "var(--c-base)" }}>
            <Save size={14} /> Enregistrer
          </button>

          <div className="mt-6 overflow-x-auto rounded-xl" style={{ border: "1px solid var(--bordure)" }}>
            <table className="w-full text-sm">
              <thead style={{ background: "var(--fond-entree)", color: "var(--texte-3)" }}>
                <tr>
                  <th className="p-3 text-left">Profil</th>
                  <th className="p-3 text-right">Coût annuel</th>
                  <th className="p-3 text-right">DHMO moyen</th>
                  <th className="p-3 text-right">Taux vente calculé</th>
                  <th className="p-3 text-right">Marge cible</th>
                </tr>
              </thead>
              <tbody>
                {profils.map((profil) => {
                  const sims = profil.simulations.filter((s) => s.actif);
                  const cout = sims.reduce((s, sim) => s + Number(sim.cout_annuel), 0);
                  const dhmo = sims.length ? sims.reduce((s, sim) => s + Number(sim.dhmo), 0) / sims.length : 0;
                  return (
                    <tr key={profil.id} style={{ borderTop: "1px solid var(--bordure)" }}>
                      <td className="p-3" style={{ color: "var(--texte)" }}>{profil.libelle}</td>
                      <td className="p-3 text-right font-mono" style={{ color: "var(--texte)" }}>{euros(cout)}</td>
                      <td className="p-3 text-right font-mono" style={{ color: "var(--texte)" }}>{euros(dhmo)}</td>
                      <td className="p-3 text-right font-mono" style={{ color: "var(--c-base)" }}>{euros(profil.taux_horaire_ht_calcule ?? profil.taux_horaire_ht)}</td>
                      <td className="p-3 text-right font-mono" style={{ color: "var(--texte-2)" }}>{pct(profil.taux_marge_vente)}</td>
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
