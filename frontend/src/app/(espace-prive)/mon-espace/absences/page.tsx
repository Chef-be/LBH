"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/crochets/useApi";
import { DemandeAbsence, SoldeAbsenceSalarie } from "@/types/societe";

function dateIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function PageAbsencesSalarie() {
  const client = useQueryClient();
  const [typeAbsence, setTypeAbsence] = useState<DemandeAbsence["type_absence"]>("conge_paye");
  const [dateDebut, setDateDebut] = useState(dateIso());
  const [dateFin, setDateFin] = useState(dateIso());
  const [motif, setMotif] = useState("");

  const { data: demandesData } = useQuery<{ results?: DemandeAbsence[] } | DemandeAbsence[]>({
    queryKey: ["mes-absences"],
    queryFn: () => api.get("/api/societe/absences/"),
  });
  const demandes = Array.isArray(demandesData) ? demandesData : (demandesData?.results ?? []);

  const { data: soldesData } = useQuery<{ results?: SoldeAbsenceSalarie[] } | SoldeAbsenceSalarie[]>({
    queryKey: ["mes-soldes-absences"],
    queryFn: () => api.get("/api/societe/soldes-absences/"),
  });
  const soldes = Array.isArray(soldesData) ? soldesData : (soldesData?.results ?? []);

  const creerDemande = useMutation({
    mutationFn: async () => {
      const demande = await api.post<DemandeAbsence>("/api/societe/absences/", {
        type_absence: typeAbsence,
        date_debut: dateDebut,
        date_fin: dateFin,
        motif,
        commentaire_salarie: motif,
      });
      return api.post<DemandeAbsence>(`/api/societe/absences/${demande.id}/soumettre/`, {});
    },
    onSuccess: () => {
      setMotif("");
      client.invalidateQueries({ queryKey: ["mes-absences"] });
      client.invalidateQueries({ queryKey: ["mes-soldes-absences"] });
    },
  });

  function soumettre(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    creerDemande.mutate();
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 style={{ color: "var(--texte)" }}>Mes absences</h2>
        <p className="mt-1 text-sm" style={{ color: "var(--texte-3)" }}>Congés, RTT, récupération, formation et absences soumises à validation.</p>
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        {["conge_paye", "rtt", "recuperation"].map((type) => {
          const solde = soldes.find((item) => item.type_absence === type);
          return (
            <div key={type} className="rounded-xl p-4" style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}>
              <p className="text-xs uppercase" style={{ color: "var(--texte-3)" }}>{type.replace("_", " ")}</p>
              <p className="mt-1 text-2xl font-semibold" style={{ color: "var(--texte)" }}>{solde?.solde ?? "0.00"} j</p>
              <p className="text-xs" style={{ color: "var(--texte-3)" }}>En attente : {solde?.en_attente_validation ?? "0.00"} j</p>
            </div>
          );
        })}
      </section>

      <form onSubmit={soumettre} className="rounded-xl p-5" style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}>
        <h3 className="text-sm font-semibold" style={{ color: "var(--texte)" }}>Nouvelle demande</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-4">
          <label>
            <span className="mb-1 block text-xs" style={{ color: "var(--texte-3)" }}>Type</span>
            <select className="champ-saisie w-full" value={typeAbsence} onChange={(e) => setTypeAbsence(e.target.value as DemandeAbsence["type_absence"])}>
              <option value="conge_paye">Congé payé</option>
              <option value="rtt">RTT</option>
              <option value="recuperation">Récupération</option>
              <option value="formation">Formation</option>
              <option value="maladie">Maladie</option>
              <option value="absence_autorisee">Absence autorisée</option>
              <option value="autre">Autre</option>
            </select>
          </label>
          <label>
            <span className="mb-1 block text-xs" style={{ color: "var(--texte-3)" }}>Début</span>
            <input className="champ-saisie w-full" type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} />
          </label>
          <label>
            <span className="mb-1 block text-xs" style={{ color: "var(--texte-3)" }}>Fin</span>
            <input className="champ-saisie w-full" type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} />
          </label>
          <label>
            <span className="mb-1 block text-xs" style={{ color: "var(--texte-3)" }}>Motif</span>
            <input className="champ-saisie w-full" value={motif} onChange={(e) => setMotif(e.target.value)} />
          </label>
        </div>
        <button type="submit" disabled={creerDemande.isPending} className="mt-4 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: "var(--c-base)" }}>
          Soumettre la demande
        </button>
      </form>

      <section className="rounded-xl overflow-hidden" style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "var(--fond-entree)" }}>
              {["Type", "Période", "Jours", "Statut"].map((titre) => <th key={titre} className="px-4 py-3 text-left text-xs uppercase" style={{ color: "var(--texte-3)" }}>{titre}</th>)}
            </tr>
          </thead>
          <tbody>
            {demandes.map((demande) => (
              <tr key={demande.id} style={{ borderTop: "1px solid var(--bordure)" }}>
                <td className="px-4 py-3" style={{ color: "var(--texte)" }}>{demande.type_absence_libelle}</td>
                <td className="px-4 py-3" style={{ color: "var(--texte-2)" }}>{demande.date_debut} → {demande.date_fin}</td>
                <td className="px-4 py-3" style={{ color: "var(--texte-2)" }}>{demande.nombre_jours_ouvres_calcule} j</td>
                <td className="px-4 py-3" style={{ color: "var(--texte-2)" }}>{demande.statut_libelle}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
