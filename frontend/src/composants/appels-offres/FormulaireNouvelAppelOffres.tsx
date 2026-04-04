"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ErreurApi } from "@/crochets/useApi";

interface DonneesAO {
  projet: string;
  intitule: string;
  type_procedure: string;
  montant_estime_ht?: string;
  delai_execution_jours?: string;
  date_limite_remise?: string;
  date_publication?: string;
  variantes_autorisees?: boolean;
  observations?: string;
}

export function FormulaireNouvelAppelOffres({ projetId }: { projetId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [erreurs, setErreurs] = useState<Record<string, string>>({});

  const { mutate, isPending } = useMutation({
    mutationFn: (donnees: DonneesAO) => api.post("/api/appels-offres/", donnees),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appels-offres-projet", projetId] });
      router.push(`/projets/${projetId}/appels-offres`);
    },
    onError: (err) => {
      if (err instanceof ErreurApi && err.erreurs) {
        const nouvellesErreurs: Record<string, string> = {};
        Object.entries(err.erreurs).forEach(([champ, messages]) => {
          if (Array.isArray(messages)) nouvellesErreurs[champ] = messages[0];
        });
        setErreurs(nouvellesErreurs);
      }
    },
  });

  function soumettre(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErreurs({});
    const f = new FormData(e.currentTarget);

    const donnees: DonneesAO = {
      projet: projetId,
      intitule: f.get("intitule") as string,
      type_procedure: f.get("type_procedure") as string,
    };

    const montant = f.get("montant_estime_ht") as string;
    if (montant) donnees.montant_estime_ht = montant;

    const dateLimite = f.get("date_limite_remise") as string;
    if (dateLimite) donnees.date_limite_remise = dateLimite;

    const datePub = f.get("date_publication") as string;
    if (datePub) donnees.date_publication = datePub;

    const delaiExecution = f.get("delai_execution_jours") as string;
    if (delaiExecution) donnees.delai_execution_jours = delaiExecution;

    donnees.variantes_autorisees = f.get("variantes_autorisees") === "on";

    const obs = f.get("observations") as string;
    if (obs) donnees.observations = obs;

    mutate(donnees);
  }

  return (
    <form onSubmit={soumettre} className="space-y-6">
      <div className="carte space-y-4">
        <h2>Identification</h2>

        <div>
          <label className="libelle-champ" htmlFor="intitule">Intitulé *</label>
          <input
            id="intitule" name="intitule" type="text" required
            className="champ-saisie"
            placeholder="Ex : Consultation entreprises — Lot 1 VRD"
          />
          {erreurs.intitule && <p className="text-xs text-red-500 mt-1">{erreurs.intitule}</p>}
        </div>

        <div>
          <label className="libelle-champ" htmlFor="type_procedure">Type de procédure *</label>
          <select id="type_procedure" name="type_procedure" className="champ-saisie" required defaultValue="procedure_adaptee">
            <option value="appel_offres_ouvert">Appel d&apos;offres ouvert</option>
            <option value="appel_offres_restreint">Appel d&apos;offres restreint</option>
            <option value="procedure_adaptee">Procédure adaptée (MAPA)</option>
            <option value="procedure_negociee">Procédure négociée</option>
            <option value="marche_gre_a_gre">Marché de gré à gré</option>
            <option value="concours">Concours</option>
          </select>
          {erreurs.type_procedure && <p className="text-xs text-red-500 mt-1">{erreurs.type_procedure}</p>}
        </div>

        <div>
          <label className="libelle-champ" htmlFor="montant_estime_ht">Montant estimé HT (€)</label>
          <input
            id="montant_estime_ht" name="montant_estime_ht" type="number"
            min="0" step="0.01"
            className="champ-saisie font-mono"
            placeholder="Ex : 250000"
          />
          {erreurs.montant_estime_ht && <p className="text-xs text-red-500 mt-1">{erreurs.montant_estime_ht}</p>}
        </div>

        <div>
          <label className="libelle-champ" htmlFor="delai_execution_jours">Délai d&apos;exécution visé (jours)</label>
          <input
            id="delai_execution_jours" name="delai_execution_jours" type="number"
            min="0"
            className="champ-saisie font-mono"
            placeholder="Ex : 180"
          />
          {erreurs.delai_execution_jours && <p className="text-xs text-red-500 mt-1">{erreurs.delai_execution_jours}</p>}
        </div>

        <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-4">
          <input id="variantes_autorisees" name="variantes_autorisees" type="checkbox" />
          <span className="text-sm text-slate-700">Autoriser les variantes</span>
        </label>
      </div>

      <div className="carte space-y-4">
        <h2>Calendrier</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="libelle-champ" htmlFor="date_publication">Date de publication</label>
            <input
              id="date_publication" name="date_publication" type="date"
              className="champ-saisie font-mono"
            />
          </div>
          <div>
            <label className="libelle-champ" htmlFor="date_limite_remise">Date limite de remise</label>
            <input
              id="date_limite_remise" name="date_limite_remise" type="datetime-local"
              className="champ-saisie font-mono"
            />
          </div>
        </div>
      </div>

      <div className="carte">
        <label className="libelle-champ" htmlFor="observations">Observations</label>
        <textarea id="observations" name="observations" rows={3} className="champ-saisie" />
      </div>

      <div className="flex justify-end gap-3 pb-6">
        <button type="button" className="btn-secondaire" onClick={() => router.back()}>
          Annuler
        </button>
        <button type="submit" className="btn-primaire" disabled={isPending}>
          {isPending ? "Création…" : "Créer l'appel d'offres"}
        </button>
      </div>
    </form>
  );
}
