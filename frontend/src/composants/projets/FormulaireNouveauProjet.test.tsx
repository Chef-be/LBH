import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FormulaireNouveauProjet } from "@/composants/projets/FormulaireNouveauProjet";

const {
  mockPush,
  mockBack,
  mockApiGet,
  mockApiPost,
  mockRequeteApiAvecProgression,
} = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockBack: vi.fn(),
  mockApiGet: vi.fn(),
  mockApiPost: vi.fn(),
  mockRequeteApiAvecProgression: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
  }),
}));

vi.mock("@/crochets/useApi", () => {
  class ErreurApi extends Error {
    detail: string;

    constructor(detail: string) {
      super(detail);
      this.detail = detail;
    }
  }

  return {
    api: {
      get: mockApiGet,
      post: mockApiPost,
    },
    ErreurApi,
    extraireListeResultats: (data: unknown) => data,
    requeteApiAvecProgression: mockRequeteApiAvecProgression,
  };
});

vi.mock("@/composants/ui/EtatTeleversement", () => ({
  EtatTeleversement: () => <div data-testid="etat-televersement" />,
}));

vi.mock("@/composants/projets/ChampOrganisationRapide", () => ({
  ChampOrganisationRapide: ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: string;
    onChange: (value: string) => void;
  }) => (
    <label>
      {label}
      <input
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  ),
}));

const parcoursMock = {
  etapes: [
    { code: "client-contexte", titre: "Client et contexte", ordre: 1 },
    { code: "pieces-sources", titre: "Pièces sources", ordre: 2 },
    { code: "donnees-entree", titre: "Données d'entrée métier", ordre: 3 },
    { code: "structuration", titre: "Structuration du projet", ordre: 4 },
    { code: "validation", titre: "Validation", ordre: 5 },
  ],
  referentiels: {
    familles_client: [
      { id: "famille-moa", code: "maitrise_ouvrage", libelle: "Maîtrise d'ouvrage", description: "" },
    ],
    sous_types_client: [
      { id: "sous-type-public", code: "collectivite", libelle: "Collectivité", description: "" },
    ],
    contextes_contractuels: [
      { id: "contexte-direct", code: "client_direct", libelle: "Client direct", description: "" },
    ],
    missions_principales: [
      { id: "mission-lecture", code: "lecture_programme", libelle: "Lecture programme", description: "" },
    ],
    sous_missions: [],
    phases_intervention: [],
  },
  champs_dynamiques: [],
  dossiers_ged: [],
};

const preanalyseMock = {
  analyses: [
    {
      nom_fichier: "programme-mamoudzou.txt",
      confiance: 0.94,
      type_piece: {
        code: "PROG",
        libelle: "Programme",
      },
    },
  ],
  resume: {
    fichiers_analyses: 1,
    types_detectes: [{ code: "PROG", libelle: "Programme", occurrences: 1 }],
    lignes_economiques: 0,
    nature_ouvrage: "batiment",
    nature_marche: "public",
    contexte_contractuel: "client_direct",
  },
  pre_remplissage: {
    intitule: "Construction d'une médiathèque municipale",
    methode_estimation: "ratio",
    missions_suggerees: ["lecture_programme"],
    donnees_entree: {
      acheteur_public: "Commune de Mamoudzou",
    },
    trace: {
      acheteur_public: {
        value: "Commune de Mamoudzou",
        confiance: 0.94,
        source: "programme-mamoudzou.txt",
      },
    },
  },
};

function renderFormulaire() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <FormulaireNouveauProjet />
    </QueryClientProvider>
  );
}

describe("FormulaireNouveauProjet", () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockBack.mockReset();
    mockApiGet.mockReset();
    mockApiPost.mockReset();
    mockRequeteApiAvecProgression.mockReset();

    mockApiGet.mockImplementation(async (url: string) => {
      if (url === "/api/organisations/") {
        return [{ id: "org-1", nom: "LBH", type_organisation: "bureau_etudes" }];
      }
      if (url.startsWith("/api/projets/parcours/")) {
        return parcoursMock;
      }
      if (url === "/api/projets/preanalyse-sources/taches/task-123/") {
        return {
          id: "task-123",
          statut: "terminee",
          progression: 100,
          message: "Analyse terminée",
          nombre_fichiers: 1,
          resultat: preanalyseMock,
          erreur: "",
          date_creation: "2026-04-06T12:00:00Z",
          date_modification: "2026-04-06T12:00:02Z",
          date_fin: "2026-04-06T12:00:02Z",
        };
      }
      throw new Error(`GET inattendu: ${url}`);
    });

    mockApiPost.mockImplementation(async (url: string) => {
      throw new Error(`POST inattendu: ${url}`);
    });

    mockRequeteApiAvecProgression.mockImplementation(async (url: string) => {
      if (url === "/api/projets/preanalyse-sources/taches/") {
        return {
          id: "task-123",
          statut: "en_attente",
          progression: 0,
          message: "Analyse en file d'attente",
          nombre_fichiers: 1,
          resultat: null,
          erreur: "",
          date_creation: "2026-04-06T12:00:00Z",
          date_modification: "2026-04-06T12:00:00Z",
          date_fin: null,
        };
      }
      throw new Error(`UPLOAD inattendu: ${url}`);
    });
  });

  it("affiche l'étape pièces sources et lance la préanalyse des fichiers", async () => {
    const user = userEvent.setup();
    const { container } = renderFormulaire();

    expect(await screen.findByText("Pièces sources")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /Étape 2 Pièces sources/i }));

    const inputFichiers = container.querySelector('input[type="file"]');
    expect(inputFichiers).toBeTruthy();

    const fichier = new File(["contenu programme"], "programme-mamoudzou.txt", {
      type: "text/plain",
    });

    fireEvent.change(inputFichiers as HTMLInputElement, {
      target: { files: [fichier] },
    });

    expect(screen.getByText("Programme mamoudzou")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /Analyser les pièces/i }));

    await waitFor(() => {
      expect(mockRequeteApiAvecProgression).toHaveBeenCalledWith(
        "/api/projets/preanalyse-sources/taches/",
        expect.objectContaining({
          method: "POST",
          corps: expect.any(FormData),
          onProgression: expect.any(Function),
        })
      );
    });

    expect(await screen.findByText("Préremplissage proposé")).toBeTruthy();
    expect(screen.getByText("Construction d'une médiathèque municipale")).toBeTruthy();
  });
});
