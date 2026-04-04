"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ErreurApi } from "@/crochets/useApi";

interface DonneesVoirie {
  projet: string;
  intitule: string;
  type_voie: string;
  tmja_vl?: string;
  tmja_pl: string;
  duree_vie_ans: string;
  taux_croissance_annuel?: string;
  cbr?: string;
  classe_plateforme?: string;
  zone_climatique?: string;
  proximite_eau: boolean;
  type_structure_prefere?: string;
  epaisseur_totale_max_cm?: string;
  observations?: string;
}

export function FormulaireNouvelleEtudeVoirie({ projetId }: { projetId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [erreurs, setErreurs] = useState<Record<string, string>>({});

  const { mutate, isPending } = useMutation({
    mutationFn: (donnees: DonneesVoirie) => api.post<{ id: string }>("/api/voirie/", donnees),
    onSuccess: (etude: { id: string }) => {
      queryClient.invalidateQueries({ queryKey: ["etudes-voirie", projetId] });
      router.push(`/projets/${projetId}/voirie`);
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

    const donnees: DonneesVoirie = {
      projet: projetId,
      intitule: f.get("intitule") as string,
      type_voie: f.get("type_voie") as string,
      tmja_pl: f.get("tmja_pl") as string,
      duree_vie_ans: f.get("duree_vie_ans") as string || "20",
      proximite_eau: f.get("proximite_eau") === "true",
    };

    const optionnels = [
      "tmja_vl", "taux_croissance_annuel", "cbr", "classe_plateforme",
      "zone_climatique", "type_structure_prefere", "epaisseur_totale_max_cm", "observations",
    ];
    optionnels.forEach((cle) => {
      const val = f.get(cle) as string;
      if (val) (donnees as unknown as Record<string, string>)[cle] = val;
    });

    mutate(donnees);
  }

  return (
    <form onSubmit={soumettre} className="space-y-6">
      {/* Identification */}
      <div className="carte space-y-4">
        <h2>Identification</h2>
        <div>
          <label className="libelle-champ" htmlFor="intitule">Intitulé *</label>
          <input id="intitule" name="intitule" type="text" required className="champ-saisie"
            placeholder="Ex : Dimensionnement VRD — rue du Château" />
          {erreurs.intitule && <p className="text-xs text-red-500 mt-1">{erreurs.intitule}</p>}
        </div>
        <div>
          <label className="libelle-champ" htmlFor="type_voie">Type de voie *</label>
          <select id="type_voie" name="type_voie" className="champ-saisie" required defaultValue="voie_urbaine">
            <option value="voie_urbaine">Voie urbaine</option>
            <option value="route_departementale">Route départementale</option>
            <option value="voie_communale">Voie communale</option>
            <option value="parking">Parking / aire de stationnement</option>
            <option value="voie_industrielle">Voie industrielle / desserte</option>
            <option value="piste_cyclable">Piste cyclable</option>
            <option value="trottoir">Trottoir / cheminement piéton</option>
          </select>
        </div>
      </div>

      {/* Trafic */}
      <div className="carte space-y-4">
        <h2>Trafic</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="libelle-champ" htmlFor="tmja_pl">TMJA PL/j (poids lourds) *</label>
            <input id="tmja_pl" name="tmja_pl" type="number" min="0" step="1" required
              className="champ-saisie font-mono" placeholder="ex : 150" />
            {erreurs.tmja_pl && <p className="text-xs text-red-500 mt-1">{erreurs.tmja_pl}</p>}
          </div>
          <div>
            <label className="libelle-champ" htmlFor="tmja_vl">TMJA VL/j (véhicules légers)</label>
            <input id="tmja_vl" name="tmja_vl" type="number" min="0" step="1"
              className="champ-saisie font-mono" placeholder="ex : 2500" />
          </div>
          <div>
            <label className="libelle-champ" htmlFor="duree_vie_ans">Durée de vie (ans)</label>
            <input id="duree_vie_ans" name="duree_vie_ans" type="number" min="5" max="50"
              defaultValue="20" className="champ-saisie font-mono" />
          </div>
          <div>
            <label className="libelle-champ" htmlFor="taux_croissance_annuel">Taux de croissance annuel</label>
            <input id="taux_croissance_annuel" name="taux_croissance_annuel" type="number"
              min="0" max="0.20" step="0.001" className="champ-saisie font-mono" placeholder="ex : 0.02" />
          </div>
        </div>
      </div>

      {/* Sol et structure */}
      <div className="carte space-y-4">
        <h2>Sol support et structure</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="libelle-champ" htmlFor="cbr">CBR du sol support</label>
            <input id="cbr" name="cbr" type="number" min="0" max="100" step="0.1"
              className="champ-saisie font-mono" placeholder="ex : 5" />
          </div>
          <div>
            <label className="libelle-champ" htmlFor="classe_plateforme">Classe de plateforme</label>
            <select id="classe_plateforme" name="classe_plateforme" className="champ-saisie" defaultValue="">
              <option value="">— Non spécifiée —</option>
              <option value="PF1">PF1</option>
              <option value="PF2">PF2</option>
              <option value="PF3">PF3</option>
              <option value="PF4">PF4</option>
            </select>
          </div>
          <div>
            <label className="libelle-champ" htmlFor="zone_climatique">Zone climatique</label>
            <input id="zone_climatique" name="zone_climatique" type="text"
              className="champ-saisie" placeholder="ex : tempérée" />
          </div>
          <div>
            <label className="libelle-champ" htmlFor="type_structure_prefere">Structure préférée</label>
            <select id="type_structure_prefere" name="type_structure_prefere" className="champ-saisie" defaultValue="">
              <option value="">— Au choix du moteur —</option>
              <option value="bitumineuse">Bitumineuse</option>
              <option value="grave_beton">Grave-béton</option>
              <option value="beton_de_ciment">Béton de ciment</option>
            </select>
          </div>
          <div>
            <label className="libelle-champ" htmlFor="epaisseur_totale_max_cm">Épaisseur totale max (cm)</label>
            <input id="epaisseur_totale_max_cm" name="epaisseur_totale_max_cm" type="number"
              min="5" max="150" step="1" className="champ-saisie font-mono" placeholder="ex : 60" />
          </div>
          <div className="flex items-center gap-3 pt-4">
            <label className="libelle-champ mb-0" htmlFor="proximite_eau">Proximité nappe phréatique</label>
            <select id="proximite_eau" name="proximite_eau" className="champ-saisie w-auto" defaultValue="false">
              <option value="false">Non</option>
              <option value="true">Oui</option>
            </select>
          </div>
        </div>
      </div>

      <div className="carte">
        <label className="libelle-champ" htmlFor="observations">Observations</label>
        <textarea id="observations" name="observations" rows={2} className="champ-saisie" />
      </div>

      <div className="flex justify-end gap-3 pb-6">
        <button type="button" className="btn-secondaire" onClick={() => router.back()}>Annuler</button>
        <button type="submit" className="btn-primaire" disabled={isPending}>
          {isPending ? "Création…" : "Créer l'étude"}
        </button>
      </div>
    </form>
  );
}
