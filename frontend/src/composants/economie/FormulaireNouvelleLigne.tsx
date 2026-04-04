"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ErreurApi } from "@/crochets/useApi";
import { Info } from "lucide-react";

interface LigneBibliotheque {
  id: string;
  code: string;
  designation: string;
  unite: string;
  temps_main_oeuvre: number;
  cout_horaire_mo: number;
  cout_matieres: number;
  cout_materiel: number;
  cout_sous_traitance: number;
  cout_transport: number;
}

interface DonneesLigne {
  numero_ordre: number;
  code: string;
  designation: string;
  unite: string;
  quantite_prevue: string;
  temps_main_oeuvre: string;
  cout_horaire_mo: string;
  cout_matieres: string;
  cout_materiel: string;
  cout_sous_traitance: string;
  cout_transport: string;
  taux_pertes_surcharge?: string;
  taux_frais_chantier_surcharge?: string;
  taux_frais_generaux_surcharge?: string;
  taux_aleas_surcharge?: string;
  taux_marge_surcharge?: string;
  observations?: string;
  ref_bibliotheque?: string;
}

export function FormulaireNouvelleLigne({
  projetId,
  etudeId,
}: {
  projetId: string;
  etudeId: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [refBibliotheque, setRefBibliotheque] = useState<LigneBibliotheque | null>(null);
  const [rechercheBiblio, setRechercheBiblio] = useState("");
  const [afficherBiblio, setAfficherBiblio] = useState(false);

  // Recherche dans la bibliothèque
  const { data: resultsBiblio } = useQuery<{ results: LigneBibliotheque[] }>({
    queryKey: ["bibliotheque-recherche", rechercheBiblio],
    queryFn: () => api.get<{ results: LigneBibliotheque[] }>(`/api/bibliotheque/?search=${encodeURIComponent(rechercheBiblio)}&statut=valide`),
    enabled: rechercheBiblio.length >= 2,
  });

  const { mutate, isPending } = useMutation({
    mutationFn: (donnees: DonneesLigne) =>
      api.post(`/api/economie/${etudeId}/lignes/`, donnees),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["etude-economique", etudeId] });
      router.push(`/projets/${projetId}/economie/${etudeId}`);
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

  function selectionnerDepuisBiblio(ligne: LigneBibliotheque) {
    setRefBibliotheque(ligne);
    setAfficherBiblio(false);
    setRechercheBiblio("");
  }

  function soumettre(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErreurs({});
    const f = new FormData(e.currentTarget);

    const donnees: DonneesLigne = {
      numero_ordre: parseInt(f.get("numero_ordre") as string) || 1,
      code: f.get("code") as string,
      designation: f.get("designation") as string,
      unite: f.get("unite") as string,
      quantite_prevue: f.get("quantite_prevue") as string,
      temps_main_oeuvre: f.get("temps_main_oeuvre") as string || "0",
      cout_horaire_mo: f.get("cout_horaire_mo") as string || "0",
      cout_matieres: f.get("cout_matieres") as string || "0",
      cout_materiel: f.get("cout_materiel") as string || "0",
      cout_sous_traitance: f.get("cout_sous_traitance") as string || "0",
      cout_transport: f.get("cout_transport") as string || "0",
    };

    if (refBibliotheque) donnees.ref_bibliotheque = refBibliotheque.id;

    const obs = f.get("observations") as string;
    if (obs) donnees.observations = obs;

    // Surcharges de taux (optionnel)
    const champs_taux = [
      "taux_pertes_surcharge", "taux_frais_chantier_surcharge",
      "taux_frais_generaux_surcharge", "taux_aleas_surcharge", "taux_marge_surcharge",
    ] as const;
    champs_taux.forEach((cle) => {
      const val = f.get(cle) as string;
      if (val) (donnees as unknown as Record<string, string>)[cle] = val;
    });

    mutate(donnees);
  }

  // Pré-remplissage depuis bibliothèque
  const valDefaut = (champ: keyof LigneBibliotheque) =>
    refBibliotheque ? String(refBibliotheque[champ]) : "";

  return (
    <form onSubmit={soumettre} className="space-y-6">
      {/* Import depuis bibliothèque */}
      <div className="carte bg-slate-50 border-dashed">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-slate-600 flex items-center gap-2">
            <Info size={14} /> Import depuis la bibliothèque de prix
          </p>
          <button
            type="button"
            className="btn-secondaire text-xs"
            onClick={() => setAfficherBiblio(!afficherBiblio)}
          >
            {afficherBiblio ? "Fermer" : "Rechercher"}
          </button>
        </div>

        {afficherBiblio && (
          <div className="space-y-2">
            <input
              type="search"
              placeholder="Code ou désignation…"
              className="champ-saisie w-full"
              value={rechercheBiblio}
              onChange={(e) => setRechercheBiblio(e.target.value)}
              autoFocus
            />
            {resultsBiblio && resultsBiblio.results.length > 0 && (
              <ul className="border border-slate-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                {resultsBiblio.results.map((l) => (
                  <li key={l.id}>
                    <button
                      type="button"
                      className="w-full text-left px-4 py-2 hover:bg-primaire-50 text-sm border-b border-slate-100 last:border-0"
                      onClick={() => selectionnerDepuisBiblio(l)}
                    >
                      <span className="font-mono text-xs text-slate-500 mr-2">{l.code}</span>
                      <span className="font-medium">{l.designation}</span>
                      <span className="text-xs text-slate-400 ml-2">{l.unite}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {refBibliotheque && (
          <div className="flex items-center justify-between mt-2 p-2 bg-white rounded border border-primaire-200">
            <p className="text-sm">
              <span className="font-mono text-xs text-slate-400 mr-2">{refBibliotheque.code}</span>
              <span className="font-medium">{refBibliotheque.designation}</span>
            </p>
            <button
              type="button"
              className="text-xs text-red-500 hover:underline"
              onClick={() => setRefBibliotheque(null)}
            >
              Retirer
            </button>
          </div>
        )}
      </div>

      {/* Identification */}
      <div className="carte space-y-4">
        <h3 className="font-medium text-slate-700">Identification</h3>
        <div className="grid grid-cols-4 gap-4">
          <div>
            <label className="libelle-champ" htmlFor="numero_ordre">N° d&apos;ordre</label>
            <input id="numero_ordre" name="numero_ordre" type="number" min="1" defaultValue="1" className="champ-saisie" />
          </div>
          <div>
            <label className="libelle-champ" htmlFor="code">Code</label>
            <input id="code" name="code" type="text" className="champ-saisie font-mono"
              defaultValue={valDefaut("code")} />
          </div>
          <div className="col-span-2">
            <label className="libelle-champ" htmlFor="unite">Unité</label>
            <input id="unite" name="unite" type="text" defaultValue={valDefaut("unite") || "m²"}
              className="champ-saisie" required />
          </div>
        </div>
        <div>
          <label className="libelle-champ" htmlFor="designation">Désignation *</label>
          <textarea
            id="designation"
            name="designation"
            rows={2}
            required
            className="champ-saisie"
            defaultValue={valDefaut("designation")}
          />
          {erreurs.designation && <p className="text-xs text-red-500 mt-1">{erreurs.designation}</p>}
        </div>
        <div className="w-48">
          <label className="libelle-champ" htmlFor="quantite_prevue">Quantité prévue *</label>
          <input id="quantite_prevue" name="quantite_prevue" type="number" min="0.001" step="0.001"
            required className="champ-saisie font-mono" />
          {erreurs.quantite_prevue && <p className="text-xs text-red-500 mt-1">{erreurs.quantite_prevue}</p>}
        </div>
      </div>

      {/* Déboursé sec */}
      <div className="carte space-y-4">
        <h3 className="font-medium text-slate-700">Déboursé sec unitaire (€/unité)</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <label className="libelle-champ" htmlFor="temps_main_oeuvre">Temps MO (h/u)</label>
            <input id="temps_main_oeuvre" name="temps_main_oeuvre" type="number" min="0" step="0.0001"
              defaultValue={valDefaut("temps_main_oeuvre") || "0"} className="champ-saisie font-mono" />
          </div>
          <div>
            <label className="libelle-champ" htmlFor="cout_horaire_mo">Coût horaire MO (€/h)</label>
            <input id="cout_horaire_mo" name="cout_horaire_mo" type="number" min="0" step="0.01"
              defaultValue={valDefaut("cout_horaire_mo") || "0"} className="champ-saisie font-mono" />
          </div>
          <div>
            <label className="libelle-champ" htmlFor="cout_matieres">Matières (€/u)</label>
            <input id="cout_matieres" name="cout_matieres" type="number" min="0" step="0.01"
              defaultValue={valDefaut("cout_matieres") || "0"} className="champ-saisie font-mono" />
          </div>
          <div>
            <label className="libelle-champ" htmlFor="cout_materiel">Matériel (€/u)</label>
            <input id="cout_materiel" name="cout_materiel" type="number" min="0" step="0.01"
              defaultValue={valDefaut("cout_materiel") || "0"} className="champ-saisie font-mono" />
          </div>
          <div>
            <label className="libelle-champ" htmlFor="cout_sous_traitance">Sous-traitance (€/u)</label>
            <input id="cout_sous_traitance" name="cout_sous_traitance" type="number" min="0" step="0.01"
              defaultValue={valDefaut("cout_sous_traitance") || "0"} className="champ-saisie font-mono" />
          </div>
          <div>
            <label className="libelle-champ" htmlFor="cout_transport">Transport (€/u)</label>
            <input id="cout_transport" name="cout_transport" type="number" min="0" step="0.01"
              defaultValue={valDefaut("cout_transport") || "0"} className="champ-saisie font-mono" />
          </div>
        </div>
      </div>

      {/* Surcharges de taux (optionnel) */}
      <details className="carte">
        <summary className="font-medium text-slate-700 cursor-pointer text-sm">
          Surcharges de taux <span className="font-normal text-slate-400">(optionnel — remplace les taux de l&apos;étude)</span>
        </summary>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
          {[
            { id: "taux_pertes_surcharge", label: "Pertes matières" },
            { id: "taux_frais_chantier_surcharge", label: "Frais de chantier" },
            { id: "taux_frais_generaux_surcharge", label: "Frais généraux" },
            { id: "taux_aleas_surcharge", label: "Aléas" },
            { id: "taux_marge_surcharge", label: "Marge" },
          ].map(({ id, label }) => (
            <div key={id}>
              <label className="libelle-champ text-xs" htmlFor={id}>{label}</label>
              <input id={id} name={id} type="number" min="0" max="1" step="0.001"
                placeholder="ex : 0.05" className="champ-saisie font-mono text-xs" />
            </div>
          ))}
        </div>
      </details>

      {/* Observations */}
      <div className="carte">
        <label className="libelle-champ" htmlFor="observations">Observations</label>
        <textarea id="observations" name="observations" rows={2} className="champ-saisie" />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <button type="button" className="btn-secondaire" onClick={() => router.back()}>
          Annuler
        </button>
        <button type="submit" className="btn-primaire" disabled={isPending}>
          {isPending ? "Création…" : "Ajouter la ligne"}
        </button>
      </div>
    </form>
  );
}
