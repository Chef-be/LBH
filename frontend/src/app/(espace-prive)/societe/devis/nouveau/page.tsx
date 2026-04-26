"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Plus, RefreshCw, Save, Sparkles, Trash2 } from "lucide-react";

import { api, ErreurApi } from "@/crochets/useApi";
import type {
  AssistantDevisResponse,
  MissionSelectionneeDevis,
  ParcoursProjetSociete,
  ProfilHoraire,
  ProfilHoraireUtilisateur,
} from "@/types/societe";

interface LigneForm {
  ordre: number;
  type_ligne: "horaire" | "forfait" | "frais";
  phase_code: string;
  intitule: string;
  description: string;
  profil: string;
  nb_heures: string;
  taux_horaire: string;
  montant_unitaire_ht: string;
  quantite: string;
  unite: string;
}

interface UtilisateurOption {
  id: string;
  prenom: string;
  nom: string;
  fonction: string;
}

interface OrganisationOption {
  id: string;
  nom: string;
  type_organisation: string;
  siret: string;
  adresse: string;
  code_postal: string;
  ville: string;
  pays: string;
  telephone: string;
  courriel: string;
}

interface EntreprisePubliqueOption {
  siret: string;
  nom: string;
  adresse: string;
  code_postal: string;
  ville: string;
  pays: string;
}

interface DevisForm {
  intitule: string;
  client_nom: string;
  client_contact: string;
  client_email: string;
  client_telephone: string;
  client_adresse: string;
  objet: string;
  date_emission: string;
  date_validite: string;
  taux_tva: string;
  acompte_pct: string;
  delai_paiement_jours: string;
  conditions_particulieres: string;
  projet: string;
  famille_client: string;
  sous_type_client: string;
  contexte_contractuel: string;
  nature_ouvrage: "batiment" | "infrastructure" | "mixte";
  nature_marche: "public" | "prive" | "mixte";
  role_lbh: string;
}

const LIGNE_VIDE: LigneForm = {
  ordre: 0,
  type_ligne: "forfait",
  phase_code: "",
  intitule: "",
  description: "",
  profil: "",
  nb_heures: "8",
  taux_horaire: "0",
  montant_unitaire_ht: "0",
  quantite: "1",
  unite: "forfait",
};

function dateDuJour(): string {
  return new Date().toISOString().split("T")[0];
}

function dateDansTrenteJours(): string {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date.toISOString().split("T")[0];
}

function calculerMontantLigne(ligne: LigneForm): number {
  if (ligne.type_ligne === "horaire") {
    return (parseFloat(ligne.nb_heures) || 0) * (parseFloat(ligne.taux_horaire) || 0);
  }
  return (parseFloat(ligne.quantite) || 0) * (parseFloat(ligne.montant_unitaire_ht) || 0);
}

function libelleNatureOuvrage(valeur: string): string {
  if (valeur === "infrastructure") return "Infrastructure / VRD";
  if (valeur === "mixte") return "Mixte";
  return "Bâtiment";
}

const ROLES_SOCIETE = [
  "Économiste de la construction",
  "AMO économie",
  "Mandataire",
  "Cotraitant",
  "Sous-traitant",
  "OPC",
  "Bureau d'études conseil",
];

export default function PageNouveauDevis() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projetId = searchParams.get("projet");

  const [form, setForm] = useState<DevisForm>({
    intitule: "",
    client_nom: "",
    client_contact: "",
    client_email: "",
    client_telephone: "",
    client_adresse: "",
    objet: "",
    date_emission: dateDuJour(),
    date_validite: dateDansTrenteJours(),
    taux_tva: "0.20",
    acompte_pct: "30",
    delai_paiement_jours: "30",
    conditions_particulieres: "",
    projet: projetId ?? "",
    famille_client: "",
    sous_type_client: "",
    contexte_contractuel: "",
    nature_ouvrage: "batiment",
    nature_marche: "public",
    role_lbh: "",
  });
  const [missionsSelectionnees, setMissionsSelectionnees] = useState<MissionSelectionneeDevis[]>([]);
  const [lignes, setLignes] = useState<LigneForm[]>([{ ...LIGNE_VIDE }]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [assistantInitialise, setAssistantInitialise] = useState(false);
  const [utilisateurPressenti, setUtilisateurPressenti] = useState("");
  const [clientLocalId, setClientLocalId] = useState("");
  const [clientPublicSelectionne, setClientPublicSelectionne] = useState<EntreprisePubliqueOption | null>(null);
  const [roleSocieteAutre, setRoleSocieteAutre] = useState(false);

  const requeteParcours = useMemo(() => {
    const params = new URLSearchParams();
    if (form.famille_client) params.set("famille_client", form.famille_client);
    if (form.sous_type_client) params.set("sous_type_client", form.sous_type_client);
    if (form.contexte_contractuel) params.set("contexte_contractuel", form.contexte_contractuel);
    params.set("nature_ouvrage", form.nature_ouvrage);
    params.set("nature_marche", form.nature_marche);
    return params.toString();
  }, [
    form.contexte_contractuel,
    form.famille_client,
    form.nature_marche,
    form.nature_ouvrage,
    form.sous_type_client,
  ]);

  const { data: parcours } = useQuery<ParcoursProjetSociete>({
    queryKey: ["societe-devis-parcours", requeteParcours],
    queryFn: () => api.get<ParcoursProjetSociete>(`/api/projets/parcours/?${requeteParcours}`),
  });

  const assistantQuery = useQuery<AssistantDevisResponse>({
    queryKey: [
      "societe-devis-assistant",
      form.famille_client,
      form.sous_type_client,
      form.contexte_contractuel,
      form.nature_ouvrage,
      form.nature_marche,
      form.role_lbh,
      utilisateurPressenti,
    ],
    queryFn: () => {
      const params = new URLSearchParams();
      if (form.famille_client) params.set("famille_client", form.famille_client);
      if (form.sous_type_client) params.set("sous_type_client", form.sous_type_client);
      if (form.contexte_contractuel) params.set("contexte_contractuel", form.contexte_contractuel);
      params.set("nature_ouvrage", form.nature_ouvrage);
      params.set("nature_marche", form.nature_marche);
      if (form.role_lbh) params.set("role_lbh", form.role_lbh);
      if (utilisateurPressenti) params.set("utilisateur", utilisateurPressenti);
      return api.get<AssistantDevisResponse>(`/api/societe/devis/assistant/?${params.toString()}`);
    },
    enabled: Boolean(form.famille_client && form.contexte_contractuel),
    staleTime: 60_000,
  });

  const { data: profils = [] } = useQuery<ProfilHoraire[]>({
    queryKey: ["profils-horaires-actifs"],
    queryFn: async () => {
      const reponse = await api.get<{ results?: ProfilHoraire[] } | ProfilHoraire[]>(
        "/api/societe/profils-horaires/?actif=true",
      );
      return Array.isArray(reponse) ? reponse : (reponse.results ?? []);
    },
  });

  const { data: utilisateurs = [] } = useQuery<UtilisateurOption[]>({
    queryKey: ["societe-devis-utilisateurs"],
    queryFn: async () => {
      const reponse = await api.get<{ results?: UtilisateurOption[] } | UtilisateurOption[]>("/api/auth/utilisateurs/");
      return Array.isArray(reponse) ? reponse : (reponse.results ?? []);
    },
  });

  const { data: profilsUtilisateurs = [] } = useQuery<ProfilHoraireUtilisateur[]>({
    queryKey: ["societe-devis-profils-utilisateurs"],
    queryFn: async () => {
      const reponse = await api.get<{ results?: ProfilHoraireUtilisateur[] } | ProfilHoraireUtilisateur[]>("/api/societe/profils-horaires-utilisateurs/");
      return Array.isArray(reponse) ? reponse : (reponse.results ?? []);
    },
  });

  const rechercheClient = form.client_nom.trim();

  const { data: clientsLocaux = [] } = useQuery<OrganisationOption[]>({
    queryKey: ["societe-clients-locaux", rechercheClient],
    enabled: rechercheClient.length >= 2,
    queryFn: async () => {
      const r = await api.get<{ results?: OrganisationOption[] } | OrganisationOption[]>(
        `/api/organisations/?search=${encodeURIComponent(rechercheClient)}`,
      );
      return Array.isArray(r) ? r : (r.results ?? []);
    },
  });

  const { data: clientsPublics = [] } = useQuery<EntreprisePubliqueOption[]>({
    queryKey: ["societe-clients-publics", rechercheClient],
    enabled: rechercheClient.length >= 3 && clientsLocaux.length === 0,
    queryFn: async () => {
      const r = await api.get<{ results: EntreprisePubliqueOption[] }>(
        `/api/organisations/recherche-entreprises/?q=${encodeURIComponent(rechercheClient)}&limit=5`,
      );
      return r.results ?? [];
    },
  });

  useEffect(() => {
    setMissionsSelectionnees([]);
    setAssistantInitialise(false);
  }, [
    form.famille_client,
    form.sous_type_client,
    form.contexte_contractuel,
    form.nature_ouvrage,
    form.nature_marche,
    form.role_lbh,
    utilisateurPressenti,
  ]);

  useEffect(() => {
    if (!assistantQuery.data || assistantInitialise) return;
    const missionsParDefaut = assistantQuery.data.missions
      .filter((mission) => mission.est_obligatoire)
      .map((mission) => ({
        missionCode: mission.code,
        missionLabel: mission.libelle,
        livrablesCodes: mission.livrables.map((livrable) => livrable.code),
        livrablesLabels: mission.livrables.map((livrable) => livrable.libelle),
      }));
    setMissionsSelectionnees(missionsParDefaut);
    setAssistantInitialise(true);
  }, [assistantInitialise, assistantQuery.data]);

  useEffect(() => {
    if (!parcours) return;

    const sousTypes = new Set(parcours.referentiels.sous_types_client.map((item) => item.id));
    if (form.sous_type_client && !sousTypes.has(form.sous_type_client)) {
      setForm((courant) => ({ ...courant, sous_type_client: "" }));
    }

    const contextes = new Set(parcours.referentiels.contextes_contractuels.map((item) => item.id));
    if (form.contexte_contractuel && !contextes.has(form.contexte_contractuel)) {
      setForm((courant) => ({ ...courant, contexte_contractuel: "" }));
    }
  }, [form.contexte_contractuel, form.sous_type_client, parcours]);

  const totalHT = lignes.reduce((somme, ligne) => somme + calculerMontantLigne(ligne), 0);
  const totalTVA = totalHT * (parseFloat(form.taux_tva) || 0);
  const totalTTC = totalHT + totalTVA;
  const analyseRentabilite = useMemo(() => {
    const coutBe = lignes.reduce((somme, ligne) => {
      if (ligne.type_ligne !== "horaire") return somme;
      const profil = profils.find((item) => item.id === ligne.profil);
      const simulations = profil?.simulations.filter((simulation) => simulation.actif) ?? [];
      const dhmo = simulations.length
        ? simulations.reduce((s, simulation) => s + Number(simulation.dhmo), 0) / simulations.length
        : (Number(ligne.taux_horaire) || 0) * 0.75;
      return somme + (Number(ligne.nb_heures) || 0) * dhmo;
    }, 0);
    const marge = totalHT - coutBe;
    const tauxMarge = totalHT > 0 ? marge / totalHT : 0;
    const seuilBas = 0.15;
    const seuilHaut = 0.55;
    const statut = tauxMarge < seuilBas ? "sous_evalue" : tauxMarge > seuilHaut ? "surevalue" : "coherent";
    return { coutBe, marge, tauxMarge, statut };
  }, [lignes, profils, totalHT]);

  const mettreAJourFormulaire = <K extends keyof DevisForm>(champ: K, valeur: DevisForm[K]) => {
    setForm((courant) => ({ ...courant, [champ]: valeur }));
    if (champ === "client_nom") {
      setClientLocalId("");
      setClientPublicSelectionne(null);
    }
    if (champ === "role_lbh") setRoleSocieteAutre(!ROLES_SOCIETE.includes(String(valeur)) && Boolean(valeur));
  };

  const appliquerClientLocal = (client: OrganisationOption) => {
    setClientLocalId(client.id);
    setClientPublicSelectionne(null);
    setForm((courant) => ({
      ...courant,
      client_nom: client.nom,
      client_email: client.courriel || courant.client_email,
      client_telephone: client.telephone || courant.client_telephone,
      client_adresse: [client.adresse, client.code_postal, client.ville, client.pays].filter(Boolean).join(" "),
    }));
  };

  const appliquerClientPublic = (client: EntreprisePubliqueOption) => {
    setClientLocalId("");
    setClientPublicSelectionne(client);
    setForm((courant) => ({
      ...courant,
      client_nom: client.nom,
      client_adresse: [client.adresse, client.code_postal, client.ville, client.pays].filter(Boolean).join(" "),
    }));
  };

  const typeOrganisationDepuisClient = () => {
    if (form.famille_client === "entreprise") return "entreprise";
    if (form.famille_client === "maitrise_ouvrage") return "maitre_ouvrage";
    return "partenaire";
  };

  const enregistrerClientSiNecessaire = async () => {
    if (clientLocalId || !form.client_nom.trim()) return;
    const existe = clientsLocaux.some((client) => client.nom.toLowerCase() === form.client_nom.trim().toLowerCase());
    if (existe) return;
    const adresseSource = clientPublicSelectionne?.adresse || form.client_adresse;
    const codePostalSource = clientPublicSelectionne?.code_postal || "";
    const villeSource = clientPublicSelectionne?.ville || "";
    try {
      const client = await api.post<OrganisationOption>("/api/organisations/", {
        code: `CLIENT-${Date.now()}`,
        nom: form.client_nom.trim(),
        type_organisation: typeOrganisationDepuisClient(),
        siret: clientPublicSelectionne?.siret || "",
        adresse: adresseSource,
        code_postal: codePostalSource,
        ville: villeSource,
        telephone: form.client_telephone,
        courriel: form.client_email,
        pays: clientPublicSelectionne?.pays || "France",
        est_active: true,
      });
      setClientLocalId(client.id);
    } catch {
      // La création du devis ne doit pas être bloquée par une fiche client incomplète.
    }
  };

  const mettreAJourLigne = (index: number, champ: keyof LigneForm, valeur: string) => {
    setLignes((courantes) => {
      const suivantes = [...courantes];
      suivantes[index] = { ...suivantes[index], [champ]: valeur };
      if (champ === "profil") {
        const profil = profils.find((item) => item.id === valeur);
        if (profil) {
          suivantes[index].taux_horaire = profil.taux_horaire_ht;
        }
      }
      return suivantes;
    });
  };

  const ajouterLigne = () => {
    setLignes((courantes) => [...courantes, { ...LIGNE_VIDE, ordre: courantes.length }]);
  };

  const supprimerLigne = (index: number) => {
    setLignes((courantes) => courantes.filter((_, idx) => idx !== index));
  };

  const missionSelectionnee = (code: string) =>
    missionsSelectionnees.find((mission) => mission.missionCode === code);

  const basculerMission = (code: string, libelle: string, livrablesParDefaut: { code: string; libelle: string }[]) => {
    setMissionsSelectionnees((courantes) => {
      const existante = courantes.find((mission) => mission.missionCode === code);
      if (existante) {
        return courantes.filter((mission) => mission.missionCode !== code);
      }
      return [
        ...courantes,
        {
          missionCode: code,
          missionLabel: libelle,
          livrablesCodes: livrablesParDefaut.map((item) => item.code),
          livrablesLabels: livrablesParDefaut.map((item) => item.libelle),
        },
      ];
    });
  };

  const basculerLivrable = (missionCode: string, livrableCode: string, livrableLabel: string) => {
    setMissionsSelectionnees((courantes) =>
      courantes.map((mission) => {
        if (mission.missionCode !== missionCode) return mission;
        const dejaActif = mission.livrablesCodes.includes(livrableCode);
        return {
          ...mission,
          livrablesCodes: dejaActif
            ? mission.livrablesCodes.filter((code) => code !== livrableCode)
            : [...mission.livrablesCodes, livrableCode],
          livrablesLabels: dejaActif
            ? (mission.livrablesLabels ?? []).filter((label) => label !== livrableLabel)
            : [...(mission.livrablesLabels ?? []), livrableLabel],
        };
      }),
    );
  };

  const appliquerPrestationsSelectionnees = () => {
    const assistant = assistantQuery.data;
    if (!assistant) return;

    const selection = missionsSelectionnees
      .map((mission) => {
        const source = assistant.missions.find((item) => item.code === mission.missionCode);
        if (!source) return null;
        const livrables = source.livrables.filter((item) => mission.livrablesCodes.includes(item.code));
        return {
          missionCode: source.code,
          missionLabel: source.libelle,
          livrablesCodes: livrables.map((item) => item.code),
          livrablesLabels: livrables.map((item) => item.libelle),
        };
      })
      .filter(Boolean) as MissionSelectionneeDevis[];

    const lignesImportees = selection.map((mission, index) => {
      const suggestion = assistant.suggestions_prestations.find((item) => item.mission_code === mission.missionCode);
      return {
        ordre: index,
        type_ligne: suggestion?.type_ligne === "horaire" ? "horaire" : "forfait",
        phase_code: suggestion?.phase_code ?? "",
        intitule: suggestion?.intitule ?? mission.missionLabel ?? mission.missionCode,
        description: suggestion?.description ?? "",
        profil: suggestion?.profil_horaire_id ?? "",
        nb_heures: suggestion?.nb_heures_suggerees ?? "8",
        taux_horaire: suggestion?.taux_horaire_suggere ?? "0",
        montant_unitaire_ht: "0",
        quantite: suggestion?.quantite ?? "1",
        unite: suggestion?.unite ?? "forfait",
      } satisfies LigneForm;
    });

    setMissionsSelectionnees(selection);
    setLignes(lignesImportees.length > 0 ? lignesImportees : [{ ...LIGNE_VIDE }]);
    if (!form.intitule.trim()) {
      mettreAJourFormulaire(
        "intitule",
        selection.length === 1 ? selection[0].missionLabel || "" : "Mission d'honoraires",
      );
    }
  };

  const soumettre = async () => {
    if (!form.intitule.trim() || !form.client_nom.trim()) {
      setErreur("L'intitulé et le nom du client sont obligatoires.");
      return;
    }
    if (!form.famille_client || !form.contexte_contractuel) {
      setErreur("Le cadrage client et contractuel doit être renseigné.");
      return;
    }
    if (missionsSelectionnees.length === 0) {
      setErreur("Sélectionnez au moins une mission vendue.");
      return;
    }

    setEnCours(true);
    setErreur(null);

    try {
      await enregistrerClientSiNecessaire();
      const assistant = assistantQuery.data;
      const contexteProjetSaisi = assistant?.contexte_projet_saisi
        ? {
            ...assistant.contexte_projet_saisi,
            famille_client: form.famille_client,
            sous_type_client: form.sous_type_client,
            contexte_contractuel: form.contexte_contractuel,
            nature_ouvrage: form.nature_ouvrage,
            nature_marche: form.nature_marche,
            role_lbh: form.role_lbh,
            mission_principale: missionsSelectionnees[0]?.missionCode || assistant.contexte_projet_saisi.mission_principale || "",
            missions_associees: missionsSelectionnees.map((mission) => mission.missionCode),
            livrables_selectionnes: missionsSelectionnees.flatMap((mission) => mission.livrablesCodes),
          }
        : {
            famille_client: form.famille_client,
            sous_type_client: form.sous_type_client,
            contexte_contractuel: form.contexte_contractuel,
            mission_principale: missionsSelectionnees[0]?.missionCode || "",
            missions_associees: missionsSelectionnees.map((mission) => mission.missionCode),
            livrables_selectionnes: missionsSelectionnees.flatMap((mission) => mission.livrablesCodes),
            phase_intervention: "",
            nature_ouvrage: form.nature_ouvrage,
            nature_marche: form.nature_marche,
            role_lbh: form.role_lbh,
            methode_estimation: "",
            donnees_entree: {},
          };

      const devis = await api.post<{ id: string }>("/api/societe/devis/", {
        ...form,
        projet: form.projet || null,
        taux_tva: parseFloat(form.taux_tva),
        acompte_pct: parseFloat(form.acompte_pct),
        delai_paiement_jours: parseInt(form.delai_paiement_jours, 10),
        missions_selectionnees: missionsSelectionnees,
        contexte_projet_saisie: contexteProjetSaisi,
      });

      for (const [index, ligne] of lignes.entries()) {
        await api.post(`/api/societe/devis/${devis.id}/lignes/`, {
          ordre: index,
          type_ligne: ligne.type_ligne,
          phase_code: ligne.phase_code,
          intitule: ligne.intitule || `Ligne ${index + 1}`,
          description: ligne.description,
          profil: ligne.profil || null,
          nb_heures: ligne.type_ligne === "horaire" ? parseFloat(ligne.nb_heures) : null,
          taux_horaire: ligne.type_ligne === "horaire" ? parseFloat(ligne.taux_horaire) : null,
          montant_unitaire_ht: ligne.type_ligne !== "horaire" ? parseFloat(ligne.montant_unitaire_ht) : null,
          quantite: parseFloat(ligne.quantite),
          unite: ligne.unite,
        });
      }

      router.push(`/societe/devis/${devis.id}`);
    } catch (error) {
      setErreur(
        error instanceof ErreurApi
          ? error.detail
          : "Erreur lors de la création du devis.",
      );
    } finally {
      setEnCours(false);
    }
  };

  const stylesChamp = {
    background: "var(--fond-entree)",
    border: "1px solid var(--bordure)",
    color: "var(--texte)",
  };

  return (
    <div className="max-w-5xl space-y-8">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg p-2 transition hover:opacity-70"
          style={{ background: "var(--fond-entree)", color: "var(--texte-2)" }}
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <h2 style={{ color: "var(--texte)" }}>Nouveau devis d&apos;honoraires</h2>
          <p className="text-sm" style={{ color: "var(--texte-3)" }}>
            Prépare le devis à partir du type de client, du type d&apos;ouvrage et des missions vendues.
          </p>
        </div>
      </div>

      {erreur ? (
        <div
          className="rounded-xl px-4 py-3 text-sm"
          style={{
            background: "color-mix(in srgb, #ef4444 10%, var(--fond-carte))",
            border: "1px solid color-mix(in srgb, #ef4444 20%, var(--fond-carte))",
            color: "#ef4444",
          }}
        >
          {erreur}
        </div>
      ) : null}

      <section
        className="rounded-xl p-6 space-y-5"
        style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}
      >
        <div className="flex items-center gap-2">
          <Sparkles size={16} style={{ color: "var(--c-base)" }} />
          <h3 className="font-semibold" style={{ color: "var(--texte)" }}>Qualification commerciale</h3>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--texte-3)" }}>
              Type de client
            </label>
            <select
              value={form.famille_client}
              onChange={(e) => {
                mettreAJourFormulaire("famille_client", e.target.value);
                mettreAJourFormulaire("sous_type_client", "");
                mettreAJourFormulaire("contexte_contractuel", "");
              }}
              className="w-full rounded-lg px-3 py-2.5 text-sm"
              style={stylesChamp}
            >
              <option value="">Sélectionner</option>
              {parcours?.referentiels.familles_client.map((option) => (
                <option key={option.id} value={option.id}>{option.libelle}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--texte-3)" }}>
              Sous-type de client
            </label>
            <select
              value={form.sous_type_client}
              onChange={(e) => mettreAJourFormulaire("sous_type_client", e.target.value)}
              className="w-full rounded-lg px-3 py-2.5 text-sm"
              style={stylesChamp}
            >
              <option value="">Sélectionner</option>
              {parcours?.referentiels.sous_types_client.map((option) => (
                <option key={option.id} value={option.id}>{option.libelle}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--texte-3)" }}>
              Contexte contractuel
            </label>
            <select
              value={form.contexte_contractuel}
              onChange={(e) => mettreAJourFormulaire("contexte_contractuel", e.target.value)}
              className="w-full rounded-lg px-3 py-2.5 text-sm"
              style={stylesChamp}
            >
              <option value="">Sélectionner</option>
              {parcours?.referentiels.contextes_contractuels.map((option) => (
                <option key={option.id} value={option.id}>{option.libelle}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--texte-3)" }}>
              Nature de l&apos;ouvrage
            </label>
            <select
              value={form.nature_ouvrage}
              onChange={(e) => mettreAJourFormulaire("nature_ouvrage", e.target.value as DevisForm["nature_ouvrage"])}
              className="w-full rounded-lg px-3 py-2.5 text-sm"
              style={stylesChamp}
            >
              <option value="batiment">Bâtiment</option>
              <option value="infrastructure">Infrastructure / VRD</option>
              <option value="mixte">Mixte</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--texte-3)" }}>
              Nature du marché
            </label>
            <select
              value={form.nature_marche}
              onChange={(e) => mettreAJourFormulaire("nature_marche", e.target.value as DevisForm["nature_marche"])}
              className="w-full rounded-lg px-3 py-2.5 text-sm"
              style={stylesChamp}
            >
              <option value="public">Marché public</option>
              <option value="prive">Marché privé</option>
              <option value="mixte">Mixte</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--texte-3)" }}>
              Rôle de la société
            </label>
            <select
              value={roleSocieteAutre ? "autre" : form.role_lbh}
              onChange={(e) => {
                const valeur = e.target.value;
                setRoleSocieteAutre(valeur === "autre");
                mettreAJourFormulaire("role_lbh", valeur === "autre" ? "" : valeur);
              }}
              className="w-full rounded-lg px-3 py-2.5 text-sm"
              style={stylesChamp}
            >
              <option value="">Sélectionner</option>
              {ROLES_SOCIETE.map((role) => <option key={role} value={role}>{role}</option>)}
              <option value="autre">Autre</option>
            </select>
            {roleSocieteAutre ? (
              <input
                type="text"
                value={form.role_lbh}
                onChange={(e) => mettreAJourFormulaire("role_lbh", e.target.value)}
                className="mt-2 w-full rounded-lg px-3 py-2.5 text-sm"
                style={stylesChamp}
                placeholder="Préciser le rôle de la société"
              />
            ) : null}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--texte-3)" }}>
              Collaborateur pressenti
            </label>
            <select
              value={utilisateurPressenti}
              onChange={(e) => setUtilisateurPressenti(e.target.value)}
              className="w-full rounded-lg px-3 py-2.5 text-sm"
              style={stylesChamp}
            >
              <option value="">Aucun</option>
              {utilisateurs.map((utilisateur) => {
                const nom = [utilisateur.prenom, utilisateur.nom].filter(Boolean).join(" ");
                const profil = profilsUtilisateurs.find((item) => item.utilisateur === utilisateur.id);
                return (
                  <option key={utilisateur.id} value={utilisateur.id}>
                    {nom}{profil ? ` · ${profil.profil_horaire_libelle}` : ""}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {assistantQuery.isFetching ? (
          <div className="text-xs" style={{ color: "var(--texte-3)" }}>
            Mise à jour des prestations suggérées…
          </div>
        ) : null}
      </section>

      <section
        className="rounded-xl p-6 space-y-4"
        style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold" style={{ color: "var(--texte)" }}>Missions et livrables vendus</h3>
            <p className="text-sm" style={{ color: "var(--texte-3)" }}>
              Sélectionne les missions à intégrer dans le devis avant d&apos;alimenter les lignes.
            </p>
          </div>
          <button
            type="button"
            onClick={() => assistantQuery.refetch()}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium"
            style={{ background: "var(--fond-entree)", color: "var(--texte-2)", border: "1px solid var(--bordure)" }}
          >
            <RefreshCw size={12} />
            Actualiser
          </button>
        </div>

        <div className="space-y-3">
          {(assistantQuery.data?.missions ?? []).map((mission) => {
            const selection = missionSelectionnee(mission.code);
            const active = Boolean(selection);
            return (
              <div
                key={mission.code}
                className="rounded-xl p-4"
                style={{
                  background: active
                    ? "color-mix(in srgb, var(--c-base) 13%, var(--fond-carte))"
                    : "var(--fond-entree)",
                  border: `1px solid ${active ? "color-mix(in srgb, var(--c-base) 45%, var(--bordure))" : "var(--bordure)"}`,
                }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium" style={{ color: "var(--texte)" }}>{mission.libelle}</p>
                      {mission.est_obligatoire ? (
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: "color-mix(in srgb, #f59e0b 18%, var(--fond-carte))", color: "#b45309" }}>
                          Recommandée
                        </span>
                      ) : null}
                    </div>
                    {mission.description ? (
                      <p className="mt-1 text-sm" style={{ color: "var(--texte-3)" }}>{mission.description}</p>
                    ) : null}
                    <p className="mt-1 text-xs" style={{ color: "var(--texte-3)" }}>
                      {libelleNatureOuvrage(mission.nature_ouvrage)}{mission.phases_concernees.length ? ` · ${mission.phases_concernees.join(", ").toUpperCase()}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => basculerMission(
                      mission.code,
                      mission.libelle,
                      mission.livrables.map((livrable) => ({ code: livrable.code, libelle: livrable.libelle })),
                    )}
                    className="rounded-lg px-3 py-2 text-xs font-semibold"
                    style={{
                      background: active ? "var(--c-base)" : "var(--fond-carte)",
                      color: active ? "#fff" : "var(--texte-2)",
                      border: `1px solid ${active ? "var(--c-base)" : "var(--bordure)"}`,
                    }}
                  >
                    {active ? "Retirée" : "Ajouter"}
                  </button>
                </div>

                {mission.livrables.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {mission.livrables.map((livrable) => {
                      const selected = selection?.livrablesCodes.includes(livrable.code) ?? false;
                      return (
                        <button
                          key={livrable.code}
                          type="button"
                          onClick={() => {
                            if (!active) {
                              basculerMission(
                                mission.code,
                                mission.libelle,
                                mission.livrables.map((item) => ({ code: item.code, libelle: item.libelle })),
                              );
                              return;
                            }
                            basculerLivrable(mission.code, livrable.code, livrable.libelle);
                          }}
                          className="rounded-lg px-3 py-1.5 text-xs font-medium"
                          style={{
                            background: selected ? "var(--c-base)" : "var(--fond-carte)",
                            color: selected ? "#fff" : "var(--texte-2)",
                            border: `1px solid ${selected ? "var(--c-base)" : "var(--bordure)"}`,
                          }}
                        >
                          {livrable.libelle}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-4 rounded-xl px-4 py-3" style={{ background: "var(--fond-entree)", border: "1px solid var(--bordure)" }}>
          <div className="text-sm" style={{ color: "var(--texte-2)" }}>
            {missionsSelectionnees.length} mission{missionsSelectionnees.length > 1 ? "s" : ""} sélectionnée{missionsSelectionnees.length > 1 ? "s" : ""}
          </div>
          <button
            type="button"
            onClick={appliquerPrestationsSelectionnees}
            disabled={missionsSelectionnees.length === 0}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: "var(--c-base)" }}
          >
            <Sparkles size={14} />
            Alimenter le devis
          </button>
        </div>
      </section>

      <section className="rounded-xl p-6 space-y-5" style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}>
        <h3 className="font-semibold" style={{ color: "var(--texte)" }}>Informations générales</h3>
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--texte-3)" }}>
              Intitulé de la mission
            </label>
            <input
              type="text"
              value={form.intitule}
              onChange={(e) => mettreAJourFormulaire("intitule", e.target.value)}
              className="w-full rounded-lg px-3 py-2.5 text-sm"
              style={stylesChamp}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--texte-3)" }}>
              Objet / contexte
            </label>
            <textarea
              value={form.objet}
              onChange={(e) => mettreAJourFormulaire("objet", e.target.value)}
              rows={2}
              className="w-full resize-none rounded-lg px-3 py-2.5 text-sm"
              style={stylesChamp}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--texte-3)" }}>
              Date d&apos;émission
            </label>
            <input type="date" value={form.date_emission} onChange={(e) => mettreAJourFormulaire("date_emission", e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm" style={stylesChamp} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--texte-3)" }}>
              Valable jusqu&apos;au
            </label>
            <input type="date" value={form.date_validite} onChange={(e) => mettreAJourFormulaire("date_validite", e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm" style={stylesChamp} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--texte-3)" }}>
              TVA
            </label>
            <select value={form.taux_tva} onChange={(e) => mettreAJourFormulaire("taux_tva", e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm" style={stylesChamp}>
              <option value="0.20">20 %</option>
              <option value="0.10">10 %</option>
              <option value="0.055">5,5 %</option>
              <option value="0.00">Exonéré (0 %)</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--texte-3)" }}>
              Acompte (%)
            </label>
            <input type="number" value={form.acompte_pct} onChange={(e) => mettreAJourFormulaire("acompte_pct", e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm" style={stylesChamp} />
          </div>
        </div>
      </section>

      <section className="rounded-xl p-6 space-y-4" style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}>
        <h3 className="font-semibold" style={{ color: "var(--texte)" }}>Client destinataire</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="relative">
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--texte-3)" }}>Nom du client</label>
            <input type="text" value={form.client_nom} onChange={(e) => mettreAJourFormulaire("client_nom", e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm" style={stylesChamp} />
            {rechercheClient.length >= 2 && (clientsLocaux.length > 0 || clientsPublics.length > 0) ? (
              <div className="absolute z-20 mt-2 max-h-72 w-full overflow-y-auto rounded-xl p-2 shadow-xl" style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}>
                {clientsLocaux.map((client) => (
                  <button key={client.id} type="button" onClick={() => appliquerClientLocal(client)} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:opacity-80" style={{ color: "var(--texte)" }}>
                    <span className="font-medium">{client.nom}</span>
                    <span className="block text-xs" style={{ color: "var(--texte-3)" }}>{client.ville || client.siret || "Client enregistré"}</span>
                  </button>
                ))}
                {clientsLocaux.length === 0 && clientsPublics.map((client) => (
                  <button key={client.siret} type="button" onClick={() => appliquerClientPublic(client)} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:opacity-80" style={{ color: "var(--texte)" }}>
                    <span className="font-medium">{client.nom}</span>
                    <span className="block text-xs" style={{ color: "var(--texte-3)" }}>{client.siret} · {client.ville}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--texte-3)" }}>Interlocuteur</label>
            <input type="text" value={form.client_contact} onChange={(e) => mettreAJourFormulaire("client_contact", e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm" style={stylesChamp} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--texte-3)" }}>Email</label>
            <input type="email" value={form.client_email} onChange={(e) => mettreAJourFormulaire("client_email", e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm" style={stylesChamp} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--texte-3)" }}>Téléphone</label>
            <input type="tel" value={form.client_telephone} onChange={(e) => mettreAJourFormulaire("client_telephone", e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm" style={stylesChamp} />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--texte-3)" }}>Adresse</label>
            <textarea value={form.client_adresse} onChange={(e) => mettreAJourFormulaire("client_adresse", e.target.value)} rows={2} className="w-full resize-none rounded-lg px-3 py-2.5 text-sm" style={stylesChamp} />
          </div>
        </div>
      </section>

      <section className="rounded-xl p-6 space-y-4" style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}>
        <h3 className="font-semibold" style={{ color: "var(--texte)" }}>Analyse de rentabilité</h3>
        <div className="grid gap-4 md:grid-cols-4">
          {[
            ["Montant HT", totalHT.toLocaleString("fr-FR", { minimumFractionDigits: 2 }) + " €"],
            ["Coût BE estimé", analyseRentabilite.coutBe.toLocaleString("fr-FR", { minimumFractionDigits: 2 }) + " €"],
            ["Marge brute", analyseRentabilite.marge.toLocaleString("fr-FR", { minimumFractionDigits: 2 }) + " €"],
            ["Taux de marge", (analyseRentabilite.tauxMarge * 100).toLocaleString("fr-FR", { minimumFractionDigits: 1 }) + " %"],
          ].map(([label, valeur]) => (
            <div key={label} className="rounded-xl p-4" style={{ background: "var(--fond-entree)", border: "1px solid var(--bordure)" }}>
              <p className="text-xs uppercase tracking-wider" style={{ color: "var(--texte-3)" }}>{label}</p>
              <p className="mt-1 text-lg font-bold" style={{ color: "var(--texte)" }}>{valeur}</p>
            </div>
          ))}
        </div>
        <p className="rounded-xl px-4 py-3 text-sm" style={{
          background: analyseRentabilite.statut === "coherent" ? "color-mix(in srgb, #16a34a 12%, var(--fond-carte))" : "color-mix(in srgb, #f59e0b 14%, var(--fond-carte))",
          border: `1px solid ${analyseRentabilite.statut === "coherent" ? "#16a34a" : "#f59e0b"}`,
          color: "var(--texte)",
        }}>
          {analyseRentabilite.statut === "sous_evalue"
            ? "Le devis semble sous-évalué au regard du coût BE estimé."
            : analyseRentabilite.statut === "surevalue"
              ? "Le devis présente une marge élevée : vérifier la cohérence commerciale avant envoi."
              : "Le devis est cohérent avec le coût BE estimé."}
        </p>
      </section>

      <section className="rounded-xl p-6 space-y-4" style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold" style={{ color: "var(--texte)" }}>Prestations</h3>
          <button
            type="button"
            onClick={ajouterLigne}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium"
            style={{ background: "var(--c-clair)", color: "var(--c-base)", border: "1px solid var(--c-leger)" }}
          >
            <Plus size={12} />
            Ajouter une ligne
          </button>
        </div>

        <div className="space-y-3">
          {lignes.map((ligne, index) => (
            <div key={`${ligne.intitule}-${index}`} className="space-y-3 rounded-xl p-4" style={{ background: "var(--fond-entree)", border: "1px solid var(--bordure)" }}>
              <div className="grid grid-cols-12 gap-3 items-start">
                <div className="col-span-12 md:col-span-2">
                  <label className="mb-1 block text-xs" style={{ color: "var(--texte-3)" }}>Type</label>
                  <select value={ligne.type_ligne} onChange={(e) => mettreAJourLigne(index, "type_ligne", e.target.value)} className="w-full rounded-lg px-2 py-2 text-xs" style={stylesChamp}>
                    <option value="horaire">Horaire</option>
                    <option value="forfait">Forfait</option>
                    <option value="frais">Frais</option>
                  </select>
                </div>
                <div className="col-span-12 md:col-span-7">
                  <label className="mb-1 block text-xs" style={{ color: "var(--texte-3)" }}>Désignation</label>
                  <input type="text" value={ligne.intitule} onChange={(e) => mettreAJourLigne(index, "intitule", e.target.value)} className="w-full rounded-lg px-2 py-2 text-sm" style={stylesChamp} />
                </div>
                <div className="col-span-10 md:col-span-2">
                  <label className="mb-1 block text-xs" style={{ color: "var(--texte-3)" }}>Phase</label>
                  <input type="text" value={ligne.phase_code} onChange={(e) => mettreAJourLigne(index, "phase_code", e.target.value)} className="w-full rounded-lg px-2 py-2 text-sm" style={stylesChamp} />
                </div>
                <div className="col-span-2 md:col-span-1 flex items-end justify-end">
                  <button type="button" onClick={() => supprimerLigne(index)} className="rounded-lg p-2" style={{ color: "#ef4444" }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <textarea value={ligne.description} onChange={(e) => mettreAJourLigne(index, "description", e.target.value)} rows={2} className="w-full resize-none rounded-lg px-2 py-2 text-sm" style={stylesChamp} placeholder="Description détaillée de la prestation" />

              {ligne.type_ligne === "horaire" ? (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs" style={{ color: "var(--texte-3)" }}>Profil</label>
                    <select value={ligne.profil} onChange={(e) => mettreAJourLigne(index, "profil", e.target.value)} className="w-full rounded-lg px-2 py-2 text-xs" style={stylesChamp}>
                      <option value="">Sélectionner</option>
                      {profils.map((profil) => (
                        <option key={profil.id} value={profil.id}>{profil.libelle}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs" style={{ color: "var(--texte-3)" }}>Heures</label>
                    <input type="number" value={ligne.nb_heures} onChange={(e) => mettreAJourLigne(index, "nb_heures", e.target.value)} className="w-full rounded-lg px-2 py-2 text-sm" style={stylesChamp} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs" style={{ color: "var(--texte-3)" }}>Taux horaire HT</label>
                    <input type="number" value={ligne.taux_horaire} onChange={(e) => mettreAJourLigne(index, "taux_horaire", e.target.value)} className="w-full rounded-lg px-2 py-2 text-sm" style={stylesChamp} />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs" style={{ color: "var(--texte-3)" }}>Quantité</label>
                    <input type="number" value={ligne.quantite} onChange={(e) => mettreAJourLigne(index, "quantite", e.target.value)} className="w-full rounded-lg px-2 py-2 text-sm" style={stylesChamp} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs" style={{ color: "var(--texte-3)" }}>Unité</label>
                    <input type="text" value={ligne.unite} onChange={(e) => mettreAJourLigne(index, "unite", e.target.value)} className="w-full rounded-lg px-2 py-2 text-sm" style={stylesChamp} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs" style={{ color: "var(--texte-3)" }}>Montant unitaire HT</label>
                    <input type="number" value={ligne.montant_unitaire_ht} onChange={(e) => mettreAJourLigne(index, "montant_unitaire_ht", e.target.value)} className="w-full rounded-lg px-2 py-2 text-sm" style={stylesChamp} />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="space-y-2 rounded-xl px-4 py-4" style={{ background: "var(--fond-entree)", border: "1px solid var(--bordure)" }}>
          <div className="flex justify-between text-sm">
            <span style={{ color: "var(--texte-3)" }}>Total HT</span>
            <span className="font-mono" style={{ color: "var(--texte)" }}>{totalHT.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</span>
          </div>
          <div className="flex justify-between text-sm">
            <span style={{ color: "var(--texte-3)" }}>TVA</span>
            <span className="font-mono" style={{ color: "var(--texte-2)" }}>{totalTVA.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</span>
          </div>
          <div className="flex justify-between border-t pt-2 text-base font-bold" style={{ borderColor: "var(--bordure)" }}>
            <span style={{ color: "var(--texte)" }}>Total TTC</span>
            <span className="font-mono" style={{ color: "var(--c-base)" }}>{totalTTC.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</span>
          </div>
        </div>
      </section>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={soumettre}
          disabled={enCours}
          className="inline-flex items-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
          style={{ background: "var(--c-base)" }}
        >
          <Save size={14} />
          {enCours ? "Création…" : "Créer le devis"}
        </button>
      </div>
    </div>
  );
}
