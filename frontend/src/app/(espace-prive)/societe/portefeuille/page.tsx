"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { api } from "@/crochets/useApi";
import type { DevisHonoraires } from "@/types/societe";

function euros(v: number | string | null | undefined) {
  const n = Number(v ?? 0);
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " €";
}

function pct(v: number) {
  return (v * 100).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " %";
}

function typeClient(code: string) {
  if (code === "maitrise_ouvrage") return "MOA";
  if (code === "maitrise_oeuvre") return "MOE";
  if (code === "entreprise") return "Entreprise";
  return code || "Non défini";
}

export default function PagePortefeuilleSociete() {
  const { data: devis = [] } = useQuery<DevisHonoraires[]>({
    queryKey: ["societe-portefeuille-devis"],
    queryFn: async () => {
      const r = await api.get<{ results?: DevisHonoraires[] } | DevisHonoraires[]>("/api/societe/devis/");
      return Array.isArray(r) ? r : (r.results ?? []);
    },
  });

  const lignes = useMemo(() => devis.map((d) => {
    const heures = (d.lignes ?? []).reduce((s, l) => s + Number(l.nb_heures ?? 0), 0);
    const coutBe = (d.lignes ?? []).reduce((s, l) => {
      const taux = Number(l.taux_horaire ?? 0);
      return s + Number(l.nb_heures ?? 0) * taux * 0.75;
    }, 0);
    const ca = Number(d.montant_ht ?? 0);
    const marge = ca - coutBe;
    return {
      id: d.id,
      type_client: typeClient(d.famille_client),
      client: d.client_nom,
      projet: d.projet_intitule || d.intitule,
      mission: (d.missions_selectionnees ?? []).map((m) => m.missionLabel || m.missionCode).join(", ") || d.intitule,
      statut: d.statut_libelle,
      date: d.date_emission,
      ca,
      heures,
      coutBe,
      marge,
      margePct: ca > 0 ? marge / ca : 0,
    };
  }), [devis]);

  const synthese = lignes.reduce((acc, ligne) => ({
    ca: acc.ca + ligne.ca,
    heures: acc.heures + ligne.heures,
    cout: acc.cout + ligne.coutBe,
    marge: acc.marge + ligne.marge,
  }), { ca: 0, heures: 0, cout: 0, marge: 0 });

  return (
    <div className="space-y-6">
      <div>
        <h2 style={{ color: "var(--texte)" }}>Portefeuille CA</h2>
        <p className="text-sm" style={{ color: "var(--texte-3)" }}>
          Suivi des affaires vendues ou en cours avec CA prévu, heures, coût BE et marge.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          ["CA HT prévu", euros(synthese.ca)],
          ["Heures prévues", synthese.heures.toLocaleString("fr-FR") + " h"],
          ["Coût BE prévu", euros(synthese.cout)],
          ["Marge brute prévue", `${euros(synthese.marge)} · ${pct(synthese.ca > 0 ? synthese.marge / synthese.ca : 0)}`],
        ].map(([label, valeur]) => (
          <div key={label} className="rounded-xl p-4" style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}>
            <p className="text-xs uppercase tracking-wider" style={{ color: "var(--texte-3)" }}>{label}</p>
            <p className="mt-1 text-xl font-bold" style={{ color: "var(--texte)" }}>{valeur}</p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl" style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}>
        <table className="w-full text-sm">
          <thead style={{ background: "var(--fond-entree)", color: "var(--texte-3)" }}>
            <tr>
              {["Type client", "Client", "Projet", "Mission", "Statut", "Début", "CA HT prévu", "Heures", "Coût BE", "Marge", "Marge %"].map((h) => (
                <th key={h} className="whitespace-nowrap p-3 text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lignes.map((ligne) => (
              <tr key={ligne.id} style={{ borderTop: "1px solid var(--bordure)" }}>
                <td className="p-3" style={{ color: "var(--texte)" }}>{ligne.type_client}</td>
                <td className="p-3" style={{ color: "var(--texte)" }}>{ligne.client}</td>
                <td className="p-3" style={{ color: "var(--texte-2)" }}>{ligne.projet}</td>
                <td className="p-3" style={{ color: "var(--texte-2)" }}>{ligne.mission}</td>
                <td className="p-3" style={{ color: "var(--texte-2)" }}>{ligne.statut}</td>
                <td className="p-3 font-mono" style={{ color: "var(--texte-2)" }}>{ligne.date}</td>
                <td className="p-3 text-right font-mono" style={{ color: "var(--texte)" }}>{euros(ligne.ca)}</td>
                <td className="p-3 text-right font-mono" style={{ color: "var(--texte)" }}>{ligne.heures.toLocaleString("fr-FR")}</td>
                <td className="p-3 text-right font-mono" style={{ color: "var(--texte)" }}>{euros(ligne.coutBe)}</td>
                <td className="p-3 text-right font-mono" style={{ color: ligne.marge >= 0 ? "#16a34a" : "#dc2626" }}>{euros(ligne.marge)}</td>
                <td className="p-3 text-right font-mono" style={{ color: "var(--texte)" }}>{pct(ligne.margePct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
