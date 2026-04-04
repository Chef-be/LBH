"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Building2, FolderSearch, Info } from "lucide-react";
import { api, ErreurApi, extraireListeResultats } from "@/crochets/useApi";

interface ProjetSelection {
  id: string;
  reference: string;
  intitule: string;
  organisation: string;
  organisation_nom: string;
}

interface ReponseListeProjets {
  count?: number;
  results?: ProjetSelection[];
}

interface DonneesEtudePrix {
  intitule: string;
  code?: string;
  description?: string;
  methode: string;
  lot_type: string;
  millesime: number;
  zone_taux_horaire: string;
  taux_horaire_mo: string;
  projet: string;
  organisation: string;
  statut?: string;
  date_etude?: string;
  hypotheses?: string;
  observations?: string;
}

const METHODES = [
  { valeur: "analytique", libelle: "Analytique" },
  { valeur: "decompte", libelle: "Décompte" },
  { valeur: "artiprix", libelle: "ARTIPRIX" },
  { valeur: "constate", libelle: "Constaté" },
  { valeur: "estimatif", libelle: "Estimatif" },
];

const LOTS = [
  { valeur: "7.1", libelle: "7.1 — VRD" },
  { valeur: "7.2", libelle: "7.2 — Terrassements" },
  { valeur: "7.3", libelle: "7.3 — Gros Œuvre" },
  { valeur: "7.4", libelle: "7.4 — Façades" },
  { valeur: "7.8", libelle: "7.8 — Charpente-Couverture-Zinguerie" },
  { valeur: "7.9", libelle: "7.9 — Étanchéité" },
  { valeur: "7.10", libelle: "7.10 — Menuiseries extérieures" },
  { valeur: "7.12", libelle: "7.12 — Isolation-Plâtrerie-Peinture" },
  { valeur: "7.13", libelle: "7.13 — Revêtements sols et carrelage" },
  { valeur: "7.14", libelle: "7.14 — Électricité" },
  { valeur: "7.15", libelle: "7.15 — Plomberie" },
  { valeur: "7.16", libelle: "7.16 — CVC" },
  { valeur: "7.18", libelle: "7.18 — Aménagements paysagers" },
  { valeur: "autre", libelle: "Autre" },
];

const STATUTS_INITIAUX = [
  { valeur: "brouillon", libelle: "Brouillon" },
  { valeur: "en_cours", libelle: "En cours" },
];

const TAUX_PAR_ZONE: Record<string, string> = {
  A: "41.0000",
  B: "56.0000",
};

export function FormulaireNouvelleEtudePrix({
  projetInitialId,
}: {
  projetInitialId?: string;
}) {
  const router = useRouter();
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [rechercheProjet, setRechercheProjet] = useState("");
  const [selectionProjet, setSelectionProjet] = useState<ProjetSelection | null>(null);
  const [zoneTaux, setZoneTaux] = useState<"A" | "B">("A");
  const [tauxHoraire, setTauxHoraire] = useState(TAUX_PAR_ZONE.A);

  const { data: projetInitial } = useQuery<ProjetSelection>({
    queryKey: ["projet-etude-prix-initial", projetInitialId],
    queryFn: () => api.get<ProjetSelection>(`/api/projets/${projetInitialId}/`),
    enabled: Boolean(projetInitialId),
  });

  useEffect(() => {
    if (projetInitial) {
      setSelectionProjet({
        id: projetInitial.id,
        reference: projetInitial.reference,
        intitule: projetInitial.intitule,
        organisation: projetInitial.organisation,
        organisation_nom: projetInitial.organisation_nom,
      });
    }
  }, [projetInitial]);

  const { data: projetsTrouves } = useQuery<ReponseListeProjets>({
    queryKey: ["projets-recherche-etude-prix", rechercheProjet],
    queryFn: () =>
      api.get<ReponseListeProjets>(
        `/api/projets/?search=${encodeURIComponent(rechercheProjet)}&ordering=-date_modification`
      ),
    enabled: rechercheProjet.trim().length >= 2,
  });

  const { mutate, isPending } = useMutation({
    mutationFn: (donnees: DonneesEtudePrix) =>
      api.post<{ id: string }>("/api/economie/etudes-de-prix/", donnees),
    onSuccess: (etude) => {
      router.push(`/economie/etudes-de-prix/${etude.id}`);
    },
    onError: (erreur) => {
      if (erreur instanceof ErreurApi && erreur.erreurs) {
        const nouvellesErreurs: Record<string, string> = {};
        Object.entries(erreur.erreurs).forEach(([champ, messages]) => {
          if (Array.isArray(messages) && messages.length > 0) {
            nouvellesErreurs[champ] = messages[0];
          }
        });
        setErreurs(nouvellesErreurs);
      }
    },
  });

  const projets = extraireListeResultats(projetsTrouves);

  function selectionnerProjet(projet: ProjetSelection) {
    setSelectionProjet(projet);
    setRechercheProjet("");
    setErreurs((courantes) => {
      const prochaine = { ...courantes };
      delete prochaine.projet;
      return prochaine;
    });
  }

  function changerZone(valeur: "A" | "B") {
    setZoneTaux(valeur);
    setTauxHoraire(TAUX_PAR_ZONE[valeur]);
  }

  function soumettre(evenement: React.FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    setErreurs({});

    if (!selectionProjet) {
      setErreurs({ projet: "Sélectionnez un projet support pour l'étude de prix." });
      return;
    }

    const formulaire = new FormData(evenement.currentTarget);
    const donnees: DonneesEtudePrix = {
      intitule: formulaire.get("intitule") as string,
      methode: formulaire.get("methode") as string,
      lot_type: formulaire.get("lot_type") as string,
      millesime: Number(formulaire.get("millesime") || 2025),
      zone_taux_horaire: formulaire.get("zone_taux_horaire") as string,
      taux_horaire_mo: tauxHoraire,
      projet: selectionProjet.id,
      organisation: selectionProjet.organisation,
      statut: formulaire.get("statut") as string,
    };

    const code = (formulaire.get("code") as string)?.trim();
    const description = (formulaire.get("description") as string)?.trim();
    const dateEtude = formulaire.get("date_etude") as string;
    const hypotheses = (formulaire.get("hypotheses") as string)?.trim();
    const observations = (formulaire.get("observations") as string)?.trim();

    if (code) donnees.code = code;
    if (description) donnees.description = description;
    if (dateEtude) donnees.date_etude = dateEtude;
    if (hypotheses) donnees.hypotheses = hypotheses;
    if (observations) donnees.observations = observations;

    mutate(donnees);
  }

  return (
    <form onSubmit={soumettre} className="space-y-6">
      <div className="carte space-y-4">
        <div className="flex items-center gap-2 text-slate-700">
          <FolderSearch size={16} />
          <h2>Projet support</h2>
        </div>

        {selectionProjet ? (
          <div className="rounded-2xl border border-primaire-200 bg-primaire-50/70 p-4 flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="font-medium text-primaire-900">
                {selectionProjet.reference} — {selectionProjet.intitule}
              </p>
              <p className="text-sm text-primaire-700 flex items-center gap-1.5">
                <Building2 size={14} />
                {selectionProjet.organisation_nom}
              </p>
            </div>
            <button
              type="button"
              className="btn-secondaire text-xs"
              onClick={() => setSelectionProjet(null)}
            >
              Changer de projet
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <input
              type="search"
              value={rechercheProjet}
              onChange={(e) => setRechercheProjet(e.target.value)}
              className="champ-saisie"
              placeholder="Rechercher un projet par référence ou intitulé…"
            />
            {erreurs.projet && <p className="text-xs text-red-500">{erreurs.projet}</p>}
            {rechercheProjet.trim().length >= 2 && (
              <div className="rounded-2xl border border-slate-200 overflow-hidden">
                {projets.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-slate-400">
                    Aucun projet ne correspond à cette recherche.
                  </p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {projets.map((projet) => (
                      <li key={projet.id}>
                        <button
                          type="button"
                          className="w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors"
                          onClick={() => selectionnerProjet(projet)}
                        >
                          <p className="font-medium text-slate-800">
                            {projet.reference} — {projet.intitule}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">{projet.organisation_nom}</p>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="carte space-y-4">
        <h2>Identification de l&apos;étude</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="libelle-champ" htmlFor="intitule">
              Intitulé de l&apos;étude *
            </label>
            <input
              id="intitule"
              name="intitule"
              type="text"
              required
              className="champ-saisie"
              placeholder="Ex : Sous-détail analytique VRD - terrassements"
            />
            {erreurs.intitule && <p className="text-xs text-red-500 mt-1">{erreurs.intitule}</p>}
          </div>
          <div>
            <label className="libelle-champ" htmlFor="code">
              Code
            </label>
            <input
              id="code"
              name="code"
              type="text"
              className="champ-saisie font-mono"
              placeholder="Ex : EP-VRD-001"
            />
          </div>
          <div>
            <label className="libelle-champ" htmlFor="date_etude">
              Date de l&apos;étude
            </label>
            <input id="date_etude" name="date_etude" type="date" className="champ-saisie" />
          </div>
          <div>
            <label className="libelle-champ" htmlFor="methode">
              Méthode
            </label>
            <select id="methode" name="methode" className="champ-saisie" defaultValue="analytique">
              {METHODES.map((methode) => (
                <option key={methode.valeur} value={methode.valeur}>
                  {methode.libelle}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="libelle-champ" htmlFor="lot_type">
              Lot / corps d&apos;état
            </label>
            <select id="lot_type" name="lot_type" className="champ-saisie" defaultValue="7.1">
              {LOTS.map((lot) => (
                <option key={lot.valeur} value={lot.valeur}>
                  {lot.libelle}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="libelle-champ" htmlFor="statut">
              Statut initial
            </label>
            <select id="statut" name="statut" className="champ-saisie" defaultValue="brouillon">
              {STATUTS_INITIAUX.map((statut) => (
                <option key={statut.valeur} value={statut.valeur}>
                  {statut.libelle}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="libelle-champ" htmlFor="millesime">
              Millésime
            </label>
            <input
              id="millesime"
              name="millesime"
              type="number"
              min="2020"
              step="1"
              defaultValue="2025"
              className="champ-saisie font-mono"
            />
          </div>
          <div>
            <label className="libelle-champ" htmlFor="zone_taux_horaire">
              Zone tarifaire
            </label>
            <select
              id="zone_taux_horaire"
              name="zone_taux_horaire"
              className="champ-saisie"
              value={zoneTaux}
              onChange={(e) => changerZone(e.target.value as "A" | "B")}
            >
              <option value="A">Zone A — Province</option>
              <option value="B">Zone B — Île-de-France</option>
            </select>
          </div>
          <div>
            <label className="libelle-champ" htmlFor="taux_horaire_mo">
              Taux horaire retenu (€ / h)
            </label>
            <input
              id="taux_horaire_mo"
              name="taux_horaire_mo"
              type="number"
              min="0"
              step="0.0001"
              className="champ-saisie font-mono"
              value={tauxHoraire}
              onChange={(e) => setTauxHoraire(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="libelle-champ" htmlFor="description">
            Description
          </label>
          <textarea id="description" name="description" rows={3} className="champ-saisie" />
        </div>
      </div>

      <div className="carte space-y-4">
        <div className="flex items-center gap-2 text-slate-700">
          <Info size={16} />
          <h2>Hypothèses et remarques</h2>
        </div>
        <div>
          <label className="libelle-champ" htmlFor="hypotheses">
            Hypothèses de calcul
          </label>
          <textarea
            id="hypotheses"
            name="hypotheses"
            rows={5}
            className="champ-saisie"
            placeholder="Conditions de chantier, hypothèses de rendement, contraintes logistiques, hypothèses d'approvisionnement…"
          />
        </div>
        <div>
          <label className="libelle-champ" htmlFor="observations">
            Observations
          </label>
          <textarea
            id="observations"
            name="observations"
            rows={4}
            className="champ-saisie"
            placeholder="Commentaires, limites de validité, remarques contractuelles…"
          />
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <button type="button" className="btn-secondaire" onClick={() => router.back()}>
          Annuler
        </button>
        <button type="submit" className="btn-primaire" disabled={isPending}>
          {isPending ? "Création…" : "Créer l'étude de prix"}
        </button>
      </div>
    </form>
  );
}
