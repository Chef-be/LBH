"use client";

import { Sparkles, X } from "lucide-react";
import { clsx } from "clsx";
import { ChampOrganisationRapide, type OrganisationOption } from "@/composants/projets/ChampOrganisationRapide";
import type { EtatWizard, ChampsExtraits } from "./types";

interface EtapeIdentificationProps {
  etat: EtatWizard;
  organisations: OrganisationOption[];
  champsExtraits?: ChampsExtraits;
  erreurs: Record<string, string>;
  onChange: <K extends keyof EtatWizard>(champ: K, valeur: EtatWizard[K]) => void;
  onEffacerChampExtrait: (champ: string) => void;
}

/** Badge "Extrait automatiquement" avec bouton effacer */
function BadgeExtrait({ onEffacer }: { onEffacer: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium"
      style={{ background: "var(--c-leger)", color: "var(--c-fort)" }}>
      <Sparkles size={10} />
      Extrait auto
      <button type="button" onClick={onEffacer} className="ml-0.5 hover:text-red-500 transition-colors">
        <X size={10} />
      </button>
    </span>
  );
}

/** Champ texte enrichi avec badge pré-remplissage */
function ChampAvecExtraction({
  id,
  label,
  value,
  onChange,
  onEffacer,
  erreur,
  placeholder,
  requis,
  type = "text",
  estExtrait,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  onEffacer: () => void;
  erreur?: string;
  placeholder?: string;
  requis?: boolean;
  type?: string;
  estExtrait: boolean;
}) {
  return (
    <div>
      <label className="libelle-champ" htmlFor={id}>
        {label}{requis && " *"}
        {estExtrait && <BadgeExtrait onEffacer={onEffacer} />}
      </label>
      <input
        id={id}
        type={type}
        className={clsx(
          "champ-saisie mt-1",
          estExtrait && "border-[color:var(--c-clair)]"
        )}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {erreur && <p className="mt-1 text-xs text-red-500">{erreur}</p>}
    </div>
  );
}

export function EtapeIdentification({
  etat,
  organisations,
  champsExtraits,
  erreurs,
  onChange,
  onEffacerChampExtrait,
}: EtapeIdentificationProps) {
  const organisationsTriees = [...organisations].sort((a, b) => a.nom.localeCompare(b.nom, "fr"));

  const estExtrait = (champ: string) => etat.champsPreremplis.has(champ);

  return (
    <div className="space-y-5">
      {/* Référence + Intitulé */}
      <div className="grid gap-4 xl:grid-cols-4">
        <div className="xl:col-span-1">
          <label className="libelle-champ" htmlFor="reference">Référence *</label>
          <input
            id="reference"
            className="champ-saisie mt-1 font-mono"
            value={etat.reference}
            onChange={(e) => onChange("reference", e.target.value)}
          />
          {erreurs.reference && <p className="mt-1 text-xs text-red-500">{erreurs.reference}</p>}
        </div>
        <div className="xl:col-span-3">
          <ChampAvecExtraction
            id="intitule"
            label="Intitulé du projet"
            requis
            value={etat.intitule}
            onChange={(v) => onChange("intitule", v)}
            onEffacer={() => onEffacerChampExtrait("intitule")}
            erreur={erreurs.intitule}
            placeholder="Ex. : Réhabilitation de l'école primaire Jean Moulin"
            estExtrait={estExtrait("intitule")}
          />
        </div>
      </div>

      {/* Type projet + Statut */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="libelle-champ" htmlFor="type-projet">Type de projet</label>
          <select
            id="type-projet"
            className="champ-saisie mt-1"
            value={etat.typeProjet}
            onChange={(e) => onChange("typeProjet", e.target.value)}
          >
            <option value="etude">Étude</option>
            <option value="travaux">Travaux</option>
            <option value="mission_moe">Mission maîtrise d&apos;œuvre</option>
            <option value="assistance">Assistance</option>
            <option value="expertise">Expertise</option>
            <option value="autre">Autre</option>
          </select>
        </div>
        <div>
          <label className="libelle-champ" htmlFor="statut">Statut</label>
          <select
            id="statut"
            className="champ-saisie mt-1"
            value={etat.statut}
            onChange={(e) => onChange("statut", e.target.value)}
          >
            <option value="prospection">Prospection</option>
            <option value="en_cours">En cours</option>
            <option value="suspendu">Suspendu</option>
            <option value="termine">Terminé</option>
            <option value="abandonne">Abandonné</option>
          </select>
        </div>
      </div>

      {/* Localisation */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <ChampAvecExtraction
            id="commune"
            label="Commune"
            value={etat.commune}
            onChange={(v) => onChange("commune", v)}
            onEffacer={() => onEffacerChampExtrait("commune")}
            placeholder="Ex. : Bordeaux"
            estExtrait={estExtrait("commune")}
          />
        </div>
        <div>
          <ChampAvecExtraction
            id="departement"
            label="Département"
            value={etat.departement}
            onChange={(v) => onChange("departement", v)}
            onEffacer={() => onEffacerChampExtrait("departement")}
            placeholder="33"
            estExtrait={estExtrait("departement")}
          />
        </div>
      </div>

      {/* Organisations */}
      <div className="grid gap-4 sm:grid-cols-3">
        <ChampOrganisationRapide
          label="Bureau d'études"
          name="organisation"
          placeholder="Sélectionner le bureau d'études"
          typeOrganisation="bureau_etudes"
          organisations={organisationsTriees}
          value={etat.organisationId}
          onChange={(v) => onChange("organisationId", v)}
        />
        <ChampOrganisationRapide
          label="Maître d'ouvrage"
          name="maitre-ouvrage"
          placeholder="Optionnel"
          typeOrganisation="maitre_ouvrage"
          organisations={organisationsTriees}
          value={etat.maitreOuvrageId}
          onChange={(v) => onChange("maitreOuvrageId", v)}
        />
        <ChampOrganisationRapide
          label="Maître d'œuvre"
          name="maitre-oeuvre"
          placeholder="Optionnel"
          typeOrganisation="bureau_etudes"
          organisations={organisationsTriees}
          value={etat.maitreOeuvreId}
          onChange={(v) => onChange("maitreOeuvreId", v)}
        />
      </div>

      {/* Budget + Dates */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <ChampAvecExtraction
            id="montant-estime"
            label="Budget estimé (€ HT)"
            type="number"
            value={etat.montantEstime}
            onChange={(v) => onChange("montantEstime", v)}
            onEffacer={() => onEffacerChampExtrait("montant_estime")}
            placeholder="850 000"
            estExtrait={estExtrait("montant_estime")}
          />
        </div>
        <div>
          <label className="libelle-champ" htmlFor="date-debut">Date de début prévue</label>
          <input
            id="date-debut"
            type="date"
            className="champ-saisie mt-1"
            value={etat.dateDebutPrevue}
            onChange={(e) => onChange("dateDebutPrevue", e.target.value)}
          />
        </div>
        <div>
          <label className="libelle-champ" htmlFor="date-fin">Date de fin prévue</label>
          <input
            id="date-fin"
            type="date"
            className="champ-saisie mt-1"
            value={etat.dateFinPrevue}
            onChange={(e) => onChange("dateFinPrevue", e.target.value)}
          />
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="libelle-champ" htmlFor="description">Description du projet</label>
        <textarea
          id="description"
          className="champ-saisie mt-1 min-h-[80px] resize-y"
          value={etat.description}
          onChange={(e) => onChange("description", e.target.value)}
          placeholder="Description libre du contexte, objectifs ou contraintes particulières…"
        />
      </div>

      {/* Si type "autre" */}
      {etat.typeProjet === "autre" && (
        <div>
          <label className="libelle-champ" htmlFor="type-autre">Type personnalisé *</label>
          <input
            id="type-autre"
            className="champ-saisie mt-1"
            value={etat.typeProjetAutre}
            onChange={(e) => onChange("typeProjetAutre", e.target.value)}
          />
        </div>
      )}
    </div>
  );
}
