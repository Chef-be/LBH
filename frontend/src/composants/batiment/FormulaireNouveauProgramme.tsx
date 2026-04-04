"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ErreurApi } from "@/crochets/useApi";

interface DonneesProgramme {
  projet: string;
  intitule: string;
  type_operation: string;
  type_batiment: string;
  nombre_niveaux_hors_sol?: string;
  nombre_niveaux_sous_sol?: string;
  observations?: string;
}

export function FormulaireNouveauProgramme({ projetId }: { projetId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [erreurs, setErreurs] = useState<Record<string, string>>({});

  const { mutate, isPending } = useMutation({
    mutationFn: (donnees: DonneesProgramme) => api.post("/api/batiment/", donnees),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["etudes-batiment-projet", projetId] });
      router.push(`/projets/${projetId}/batiment`);
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

    const donnees: DonneesProgramme = {
      projet: projetId,
      intitule: f.get("intitule") as string,
      type_operation: f.get("type_operation") as string,
      type_batiment: f.get("type_batiment") as string,
    };

    const nhs = f.get("nombre_niveaux_hors_sol") as string;
    if (nhs) donnees.nombre_niveaux_hors_sol = nhs;
    const nss = f.get("nombre_niveaux_sous_sol") as string;
    if (nss) donnees.nombre_niveaux_sous_sol = nss;
    const obs = f.get("observations") as string;
    if (obs) donnees.observations = obs;

    mutate(donnees);
  }

  return (
    <form onSubmit={soumettre} className="space-y-6">
      <div className="carte space-y-4">
        <h2>Identification du programme</h2>
        <div>
          <label className="libelle-champ" htmlFor="intitule">Intitulé *</label>
          <input id="intitule" name="intitule" type="text" required className="champ-saisie"
            placeholder="Ex : Programme logements — Lot A" />
          {erreurs.intitule && <p className="text-xs text-red-500 mt-1">{erreurs.intitule}</p>}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="libelle-champ" htmlFor="type_batiment">Type de bâtiment *</label>
            <select id="type_batiment" name="type_batiment" className="champ-saisie" required defaultValue="logement_collectif">
              <option value="logement_collectif">Logement collectif</option>
              <option value="logement_individuel">Logement individuel</option>
              <option value="bureaux">Bureaux</option>
              <option value="commerce">Commerce</option>
              <option value="enseignement">Enseignement</option>
              <option value="sante">Santé</option>
              <option value="sport_loisirs">Sport et loisirs</option>
              <option value="industrie_logistique">Industrie / logistique</option>
              <option value="autre">Autre</option>
            </select>
          </div>
          <div>
            <label className="libelle-champ" htmlFor="type_operation">Type d&apos;opération *</label>
            <select id="type_operation" name="type_operation" className="champ-saisie" required defaultValue="construction_neuve">
              <option value="construction_neuve">Construction neuve</option>
              <option value="rehabilitation">Réhabilitation</option>
              <option value="extension">Extension</option>
              <option value="renovation_lourde">Rénovation lourde</option>
              <option value="demolition_reconstruction">Démolition-reconstruction</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="libelle-champ" htmlFor="nombre_niveaux_hors_sol">Niveaux hors sol</label>
            <input id="nombre_niveaux_hors_sol" name="nombre_niveaux_hors_sol" type="number" min="1" max="50"
              className="champ-saisie font-mono" placeholder="ex : 4" />
          </div>
          <div>
            <label className="libelle-champ" htmlFor="nombre_niveaux_sous_sol">Niveaux en sous-sol</label>
            <input id="nombre_niveaux_sous_sol" name="nombre_niveaux_sous_sol" type="number" min="0" max="10"
              className="champ-saisie font-mono" placeholder="ex : 1" />
          </div>
        </div>
      </div>

      <div className="carte bg-blue-50 border-blue-100">
        <p className="text-sm text-blue-700">
          <strong>Étape suivante :</strong> après création, ajoutez les locaux du programme
          (surface par type de local), puis lancez le calcul pour obtenir l&apos;estimation de coût.
        </p>
      </div>

      <div className="carte">
        <label className="libelle-champ" htmlFor="observations">Observations</label>
        <textarea id="observations" name="observations" rows={2} className="champ-saisie" />
      </div>

      <div className="flex justify-end gap-3 pb-6">
        <button type="button" className="btn-secondaire" onClick={() => router.back()}>Annuler</button>
        <button type="submit" className="btn-primaire" disabled={isPending}>
          {isPending ? "Création…" : "Créer le programme"}
        </button>
      </div>
    </form>
  );
}
