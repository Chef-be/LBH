"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ErreurApi } from "@/crochets/useApi";

interface DonneesMetre {
  projet: string;
  intitule: string;
  type_metre: string;
  observations?: string;
}

export function FormulaireNouveauMetre({ projetId }: { projetId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [erreurs, setErreurs] = useState<Record<string, string>>({});

  const { mutate, isPending } = useMutation({
    mutationFn: (donnees: DonneesMetre) => api.post("/api/metres/", donnees),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["metres-projet", projetId] });
      router.push(`/projets/${projetId}/metres`);
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

    const donnees: DonneesMetre = {
      projet: projetId,
      intitule: f.get("intitule") as string,
      type_metre: f.get("type_metre") as string,
    };

    const obs = f.get("observations") as string;
    if (obs) donnees.observations = obs;

    mutate(donnees);
  }

  return (
    <form onSubmit={soumettre} className="space-y-6">
      <div className="carte space-y-4">
        <h2>Identification du métré</h2>

        <div>
          <label className="libelle-champ" htmlFor="intitule">Intitulé *</label>
          <input
            id="intitule" name="intitule" type="text" required
            className="champ-saisie"
            placeholder="Ex : Avant-métré terrassements — Lot 1"
          />
          {erreurs.intitule && <p className="text-xs text-red-500 mt-1">{erreurs.intitule}</p>}
        </div>

        <div>
          <label className="libelle-champ" htmlFor="type_metre">Type de métré *</label>
          <select id="type_metre" name="type_metre" className="champ-saisie" required defaultValue="avant_metre">
            <option value="avant_metre">Avant-métré</option>
            <option value="metre_definitif">Métré définitif</option>
            <option value="metre_contradictoire">Métré contradictoire</option>
          </select>
          {erreurs.type_metre && <p className="text-xs text-red-500 mt-1">{erreurs.type_metre}</p>}
        </div>

        <div>
          <label className="libelle-champ" htmlFor="observations">Observations</label>
          <textarea id="observations" name="observations" rows={2} className="champ-saisie" />
        </div>
      </div>

      <div className="flex justify-end gap-3 pb-6">
        <button type="button" className="btn-secondaire" onClick={() => router.back()}>
          Annuler
        </button>
        <button type="submit" className="btn-primaire" disabled={isPending}>
          {isPending ? "Création…" : "Créer le métré"}
        </button>
      </div>
    </form>
  );
}
