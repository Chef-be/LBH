"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { api, ErreurApi } from "@/crochets/useApi";
import { Modal } from "@/composants/ui/Modal";
import { useNotifications } from "@/contextes/FournisseurNotifications";
import { ChampAdresseRecherche } from "@/composants/organisations/ChampAdresseRecherche";
import { ChampNomOrganisationAnnuaire } from "@/composants/organisations/ChampNomOrganisationAnnuaire";
import {
  normaliserCodeOrganisation,
  type SuggestionAdressePublique,
  type SuggestionEntreprisePublique,
} from "@/lib/organisations";

export interface OrganisationOption {
  id: string;
  nom: string;
  type_organisation: string;
}

interface OrganisationCreee extends OrganisationOption {
  code: string;
}

const TYPES_LIBELLES: Record<string, string> = {
  bureau_etudes: "Bureau d'études",
  entreprise: "Entreprise",
  maitre_ouvrage: "Maître d'ouvrage",
  partenaire: "Partenaire",
  sous_traitant: "Sous-traitant",
};

function ModalOrganisationRapide({
  ouvert,
  typeOrganisation,
  onFermer,
  onCreee,
}: {
  ouvert: boolean;
  typeOrganisation: string;
  onFermer: () => void;
  onCreee: (organisation: OrganisationCreee) => void;
}) {
  const queryClient = useQueryClient();
  const notifications = useNotifications();
  const [formulaire, setFormulaire] = useState({
    nom: "",
    code: "",
    siret: "",
    adresse: "",
    code_postal: "",
    ville: "",
    pays: "France",
    courriel: "",
    telephone: "",
  });
  const [codePersonnalise, setCodePersonnalise] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (payload: Record<string, string>) =>
      api.post<OrganisationCreee>("/api/organisations/", payload),
    onSuccess: async (organisation) => {
      await queryClient.invalidateQueries({ queryKey: ["organisations"] });
      notifications.succes(`${TYPES_LIBELLES[typeOrganisation] ?? "Organisation"} ajoutée.`);
      setErreur(null);
      setFormulaire({
        nom: "",
        code: "",
        siret: "",
        adresse: "",
        code_postal: "",
        ville: "",
        pays: "France",
        courriel: "",
        telephone: "",
      });
      setCodePersonnalise(false);
      onCreee(organisation);
      onFermer();
    },
    onError: (err) => {
      if (err instanceof ErreurApi) {
        setErreur(err.detail);
        return;
      }
      setErreur("Impossible de créer l'organisation.");
    },
  });

  const codeSuggere = useMemo(
    () => normaliserCodeOrganisation(formulaire.nom, typeOrganisation),
    [formulaire.nom, typeOrganisation]
  );

  return (
    <Modal
      ouvert={ouvert}
      onFermer={onFermer}
      titre={`Ajouter ${TYPES_LIBELLES[typeOrganisation] ?? "une organisation"}`}
      taille="md"
      pied={(
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onFermer} className="btn-secondaire">
            Annuler
          </button>
          <button
            type="button"
            className="btn-primaire"
            disabled={mutation.isPending}
            onClick={() => {
              setErreur(null);
              mutation.mutate({
                nom: formulaire.nom,
                code: (codePersonnalise ? formulaire.code : codeSuggere).trim(),
                type_organisation: typeOrganisation,
                siret: formulaire.siret,
                adresse: formulaire.adresse,
                code_postal: formulaire.code_postal,
                ville: formulaire.ville,
                courriel: formulaire.courriel,
                telephone: formulaire.telephone,
                pays: formulaire.pays || "France",
              });
            }}
          >
            {mutation.isPending ? "Création…" : "Créer"}
          </button>
        </div>
      )}
    >
      <div className="space-y-4">
        {erreur && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {erreur}
          </div>
        )}
        <div>
          <label className="libelle-champ" htmlFor="orga-nom">Nom</label>
          <ChampNomOrganisationAnnuaire
            id="orga-nom"
            className="champ-saisie"
            typeOrganisation={typeOrganisation}
            value={formulaire.nom}
            onChange={(valeur) => setFormulaire((prev) => ({ ...prev, nom: valeur }))}
            onSelection={(suggestion: SuggestionEntreprisePublique) =>
              setFormulaire((prev) => ({
                ...prev,
                nom: suggestion.nom,
                siret: suggestion.siret || prev.siret,
                adresse: suggestion.adresse || prev.adresse,
                code_postal: suggestion.code_postal || prev.code_postal,
                ville: suggestion.ville || prev.ville,
                pays: suggestion.pays || prev.pays || "France",
              }))
            }
            placeholder="Nom de l'organisation"
          />
        </div>
        <div>
          <label className="libelle-champ" htmlFor="orga-code">Code</label>
          <input
            id="orga-code"
            className="champ-saisie font-mono"
            value={codePersonnalise ? formulaire.code : codeSuggere}
            onChange={(e) => {
              setCodePersonnalise(true);
              setFormulaire((prev) => ({ ...prev, code: e.target.value.toUpperCase() }));
            }}
            placeholder="Code interne"
          />
        </div>
        <div>
          <div>
            <label className="libelle-champ" htmlFor="orga-siret">SIRET</label>
            <input
              id="orga-siret"
              className="champ-saisie"
              value={formulaire.siret}
              onChange={(e) => setFormulaire((prev) => ({ ...prev, siret: e.target.value }))}
              placeholder="00000000000000"
              maxLength={14}
            />
          </div>
        </div>
        <div>
          <label className="libelle-champ" htmlFor="orga-adresse">Adresse</label>
          <ChampAdresseRecherche
            id="orga-adresse"
            className="champ-saisie"
            value={formulaire.adresse}
            onChange={(valeur) => setFormulaire((prev) => ({ ...prev, adresse: valeur }))}
            onSelection={(suggestion: SuggestionAdressePublique) =>
              setFormulaire((prev) => ({
                ...prev,
                adresse: suggestion.adresse || suggestion.label,
                code_postal: suggestion.code_postal || prev.code_postal,
                ville: suggestion.ville || prev.ville,
                pays: "France",
              }))
            }
            placeholder="1 place de la Mairie"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="libelle-champ" htmlFor="orga-code-postal">Code postal</label>
            <input
              id="orga-code-postal"
              className="champ-saisie"
              value={formulaire.code_postal}
              onChange={(e) => setFormulaire((prev) => ({ ...prev, code_postal: e.target.value }))}
              placeholder="00000"
            />
          </div>
          <div>
            <label className="libelle-champ" htmlFor="orga-ville">Ville</label>
            <input
              id="orga-ville"
              className="champ-saisie"
              value={formulaire.ville}
              onChange={(e) => setFormulaire((prev) => ({ ...prev, ville: e.target.value }))}
              placeholder="Ville"
            />
          </div>
          <div>
            <label className="libelle-champ" htmlFor="orga-pays">Pays</label>
            <input
              id="orga-pays"
              className="champ-saisie"
              value={formulaire.pays}
              onChange={(e) => setFormulaire((prev) => ({ ...prev, pays: e.target.value }))}
              placeholder="France"
            />
          </div>
        </div>
        <div>
          <label className="libelle-champ" htmlFor="orga-telephone">Téléphone</label>
          <input
            id="orga-telephone"
            className="champ-saisie"
            value={formulaire.telephone}
            onChange={(e) => setFormulaire((prev) => ({ ...prev, telephone: e.target.value }))}
            placeholder="Téléphone"
          />
        </div>
        <div>
          <label className="libelle-champ" htmlFor="orga-courriel">Courriel</label>
          <input
            id="orga-courriel"
            type="email"
            className="champ-saisie"
            value={formulaire.courriel}
            onChange={(e) => setFormulaire((prev) => ({ ...prev, courriel: e.target.value }))}
            placeholder="contact@organisation.fr"
          />
        </div>
      </div>
    </Modal>
  );
}

export function ChampOrganisationRapide({
  label,
  name,
  required = false,
  placeholder,
  typeOrganisation,
  organisations,
  value,
  onChange,
}: {
  label: string;
  name: string;
  required?: boolean;
  placeholder: string;
  typeOrganisation: string;
  organisations: OrganisationOption[];
  value: string;
  onChange: (valeur: string) => void;
}) {
  const [modalOuverte, setModalOuverte] = useState(false);

  const options = organisations.filter((org) => org.type_organisation === typeOrganisation);

  return (
    <>
      <div>
        <div className="mb-1.5 flex items-center justify-between gap-3">
          <label className="libelle-champ mb-0" htmlFor={name}>
            {label}{required ? " *" : ""}
          </label>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
            onClick={() => setModalOuverte(true)}
            title={`Ajouter ${label.toLowerCase()}`}
          >
            <Plus className="w-3.5 h-3.5" />
            Ajouter
          </button>
        </div>
        <select
          id={name}
          name={name}
          className="champ-saisie"
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">{placeholder}</option>
          {options.map((org) => (
            <option key={org.id} value={org.id}>{org.nom}</option>
          ))}
        </select>
      </div>

      <ModalOrganisationRapide
        ouvert={modalOuverte}
        typeOrganisation={typeOrganisation}
        onFermer={() => setModalOuverte(false)}
        onCreee={(organisation) => onChange(organisation.id)}
      />
    </>
  );
}
