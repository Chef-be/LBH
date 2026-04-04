"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { api, ErreurApi } from "@/crochets/useApi";
import { Modal } from "@/composants/ui/Modal";
import { useNotifications } from "@/contextes/FournisseurNotifications";

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

function normaliserCode(nom: string, typeOrganisation: string) {
  const prefixe = typeOrganisation
    .replace(/[^a-z]/gi, "")
    .slice(0, 3)
    .toUpperCase() || "ORG";

  const base = nom
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toUpperCase()
    .slice(0, 24);

  return `${prefixe}-${base || "NOUVELLE"}`;
}

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
    ville: "",
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
      setFormulaire({ nom: "", code: "", ville: "", courriel: "", telephone: "" });
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
    () => normaliserCode(formulaire.nom, typeOrganisation),
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
                ville: formulaire.ville,
                courriel: formulaire.courriel,
                telephone: formulaire.telephone,
                pays: "France",
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
          <input
            id="orga-nom"
            className="champ-saisie"
            value={formulaire.nom}
            onChange={(e) => setFormulaire((prev) => ({ ...prev, nom: e.target.value }))}
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <label className="libelle-champ" htmlFor="orga-telephone">Téléphone</label>
            <input
              id="orga-telephone"
              className="champ-saisie"
              value={formulaire.telephone}
              onChange={(e) => setFormulaire((prev) => ({ ...prev, telephone: e.target.value }))}
              placeholder="Téléphone"
            />
          </div>
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
