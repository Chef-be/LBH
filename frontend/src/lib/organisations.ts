export interface SuggestionAdressePublique {
  id: string;
  label: string;
  adresse: string;
  code_postal: string;
  ville: string;
  contexte: string;
  latitude: number | null;
  longitude: number | null;
}

export interface SuggestionEntreprisePublique {
  siren: string;
  siret: string;
  nom: string;
  nom_raison_sociale: string;
  sigle: string;
  adresse: string;
  code_postal: string;
  ville: string;
  pays: string;
  etat_administratif: string;
  categorie_entreprise: string | null;
  nature_juridique: string;
  activite_principale: string;
  tranche_effectif_salarie: string | null;
  date_creation: string | null;
  est_service_public: boolean;
  est_association: boolean;
  collectivite_territoriale: string;
  siege_est_actif: boolean;
}

export function normaliserCodeOrganisation(nom: string, typeOrganisation: string) {
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

export function typeOrganisationSupporteRecherchePublique(typeOrganisation: string) {
  return [
    "bureau_etudes",
    "entreprise",
    "maitre_ouvrage",
    "partenaire",
    "sous_traitant",
  ].includes(typeOrganisation);
}
