"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api, ErreurApi } from "@/crochets/useApi";

interface Lot {
  id: string;
  numero: number;
  intitule: string;
}

interface ProjetLots {
  lots: Lot[];
}

interface DonneesEtude {
  projet: string;
  intitule: string;
  statut: string;
  lot?: string;
  taux_frais_chantier?: string;
  taux_frais_generaux?: string;
  taux_aleas?: string;
  taux_marge_cible?: string;
  taux_pertes?: string;
}

export function FormulaireNouvelleEtude({ projetId }: { projetId: string }) {
  const router = useRouter();
  const [erreurs, setErreurs] = useState<Record<string, string>>({});

  const { data: projet } = useQuery<ProjetLots>({
    queryKey: ["projet", projetId],
    queryFn: () => api.get<ProjetLots>(`/api/projets/${projetId}/`),
    select: (data: ProjetLots) => data,
  });

  const { mutate, isPending } = useMutation({
    mutationFn: (donnees: DonneesEtude) => api.post<{ id: string }>("/api/economie/", donnees),
    onSuccess: (etude: { id: string }) => {
      router.push(`/projets/${projetId}/economie/${etude.id}`);
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
    const donnees: DonneesEtude = {
      projet: projetId,
      intitule: f.get("intitule") as string,
      statut: f.get("statut") as string,
    };
    const lot = f.get("lot") as string;
    if (lot) donnees.lot = lot;
    ["taux_frais_chantier", "taux_frais_generaux", "taux_aleas", "taux_marge_cible", "taux_pertes"].forEach((cle) => {
      const val = f.get(cle) as string;
      if (val) (donnees as unknown as Record<string, string>)[cle] = val;
    });
    mutate(donnees);
  }

  return (
    <form onSubmit={soumettre} className="carte space-y-5">
      {/* Identification */}
      <div>
        <label className="libelle-champ" htmlFor="intitule">Intitulé de l&apos;étude *</label>
        <input
          id="intitule"
          name="intitule"
          type="text"
          required
          placeholder="Ex : Étude économique VRD — Phase PRO"
          className="champ-saisie"
        />
        {erreurs.intitule && <p className="text-xs text-red-500 mt-1">{erreurs.intitule}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="libelle-champ" htmlFor="statut">Statut initial</label>
          <select id="statut" name="statut" className="champ-saisie" defaultValue="brouillon">
            <option value="brouillon">Brouillon</option>
            <option value="en_cours">En cours</option>
          </select>
        </div>
        <div>
          <label className="libelle-champ" htmlFor="lot">Lot associé</label>
          <select id="lot" name="lot" className="champ-saisie">
            <option value="">— Aucun lot —</option>
            {(projet?.lots ?? []).map((lot) => (
              <option key={lot.id} value={lot.id}>
                Lot {lot.numero} — {lot.intitule}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Paramètres économiques */}
      <div>
        <p className="libelle-champ mb-3">Paramètres économiques <span className="font-normal text-slate-400">(laisser vide pour utiliser les valeurs système)</span></p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { id: "taux_frais_chantier", label: "Frais de chantier", placeholder: "ex : 0.08" },
            { id: "taux_frais_generaux", label: "Frais généraux", placeholder: "ex : 0.12" },
            { id: "taux_aleas", label: "Aléas", placeholder: "ex : 0.03" },
            { id: "taux_marge_cible", label: "Marge cible", placeholder: "ex : 0.10" },
            { id: "taux_pertes", label: "Pertes matières", placeholder: "ex : 0.05" },
          ].map(({ id, label, placeholder }) => (
            <div key={id}>
              <label className="libelle-champ text-xs" htmlFor={id}>{label}</label>
              <input
                id={id}
                name={id}
                type="number"
                min="0"
                max="1"
                step="0.001"
                placeholder={placeholder}
                className="champ-saisie font-mono"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" className="btn-secondaire" onClick={() => router.back()}>
          Annuler
        </button>
        <button type="submit" className="btn-primaire" disabled={isPending}>
          {isPending ? "Création…" : "Créer l'étude"}
        </button>
      </div>
    </form>
  );
}
