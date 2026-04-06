import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChampNomOrganisationAnnuaire } from "@/composants/organisations/ChampNomOrganisationAnnuaire";

const { mockApiGet } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
}));

vi.mock("@/crochets/useApi", () => ({
  api: {
    get: mockApiGet,
  },
}));

describe("ChampNomOrganisationAnnuaire", () => {
  beforeEach(() => {
    mockApiGet.mockReset();
  });

  it.each([
    ["bureau_etudes", "BET Alpha"],
    ["partenaire", "Architectes Associes"],
  ])("interroge l'annuaire public pour %s et affiche les suggestions", async (typeOrganisation, nomSuggestion) => {
    mockApiGet.mockResolvedValue({
      results: [
        {
          siren: "123456789",
          siret: "12345678900010",
          nom: nomSuggestion,
          nom_raison_sociale: nomSuggestion,
          sigle: "",
          adresse: "1 rue de Paris",
          code_postal: "75001",
          ville: "Paris",
          pays: "France",
          etat_administratif: "A",
          categorie_entreprise: "PME",
          nature_juridique: "5710",
          activite_principale: "71.12B",
          tranche_effectif_salarie: null,
          date_creation: null,
          est_service_public: false,
          est_association: false,
          collectivite_territoriale: "",
          siege_est_actif: true,
        },
      ],
    });

    render(
      <ChampNomOrganisationAnnuaire
        id={`organisation-${typeOrganisation}`}
        typeOrganisation={typeOrganisation}
        value=""
        onChange={() => undefined}
        onSelection={() => undefined}
        placeholder="Nom de l'organisation"
      />
    );

    const input = document.getElementById(`organisation-${typeOrganisation}`);
    expect(input).toBeTruthy();

    fireEvent.change(input as HTMLInputElement, { target: { value: "alph" } });

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith(
        `/api/organisations/recherche-entreprises/?q=alph&type_organisation=${typeOrganisation}&limit=6`
      );
    }, { timeout: 1500 });

    expect(await screen.findByText(nomSuggestion, {}, { timeout: 1500 })).toBeTruthy();
  });
});
