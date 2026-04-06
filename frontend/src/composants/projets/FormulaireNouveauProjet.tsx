"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { EtatTeleversement } from "@/composants/ui/EtatTeleversement";
import {
  api,
  ErreurApi,
  extraireListeResultats,
  requeteApiAvecProgression,
  type ProgressionTeleversement,
} from "@/crochets/useApi";
import { ChampOrganisationRapide, type OrganisationOption } from "@/composants/projets/ChampOrganisationRapide";

interface ReferentielOption {
  id: string;
  code: string;
  libelle: string;
  description: string;
  types_livrables?: string[];
  source_reglementaire?: string;
}

interface ChampDynamique {
  id: string;
  code: string;
  libelle: string;
  type_champ: "texte" | "texte_long" | "selection" | "multi_selection" | "nombre" | "montant" | "date" | "booleen";
  groupe: string;
  section: string;
  placeholder: string;
  aide_courte: string;
  obligatoire: boolean;
  multiple: boolean;
  options: Array<{ value: string; label: string }>;
  source_reglementaire: string;
}

interface ParcoursProjet {
  etapes: Array<{ code: string; titre: string; ordre: number }>;
  selection?: {
    nature_marche?: string;
    nature_ouvrage?: string;
    missions_principales?: string[];
  };
  referentiels: {
    familles_client: ReferentielOption[];
    sous_types_client: ReferentielOption[];
    contextes_contractuels: ReferentielOption[];
    missions_principales: ReferentielOption[];
    sous_missions: ReferentielOption[];
    phases_intervention: ReferentielOption[];
  };
  champs_dynamiques: Array<{ groupe: string; champs: ChampDynamique[] }>;
  dossiers_ged: Array<{
    code: string;
    intitule: string;
    description: string;
    parent_code?: string;
  }>;
}

interface ProjetCree {
  id: string;
  reference: string;
  intitule: string;
}

interface ModeVariationPrix {
  type_evolution: string;
  cadre_juridique: string;
  indice_reference: string;
  formule_personnalisee: string;
  date_prix_initial?: string;
  date_remise_offre?: string;
  date_demarrage?: string;
  periodicite_revision?: string;
  clause_applicable?: string;
  part_fixe?: string;
}

interface ReferenceIndexPrix {
  code: string;
  libelle: string;
  type_index: string;
  territoire: string;
  periodicite: string;
  base_reference: string;
  derniere_valeur: {
    date_valeur: string;
    valeur: number;
    source_publication_url: string;
    source_donnees_url: string;
  } | null;
}

interface ResultatPreanalyseSources {
  analyses: Array<{
    nom_fichier: string;
    nom_affichage?: string;
    extension?: string;
    type_mime?: string;
    source_parent?: string | null;
    detail?: string;
    confiance: number;
    mots_cles?: string[];
    type_piece?: {
      code: string;
      libelle: string;
    } | null;
  }>;
  resume: {
    fichiers_analyses: number;
    types_detectes: Array<{
      code: string;
      libelle?: string;
      occurrences: number;
    }>;
    lignes_economiques: number;
    nature_ouvrage: string;
    nature_marche: string;
    contexte_contractuel: string;
  };
  pre_remplissage: {
    donnees_entree: Record<string, string>;
    trace: Record<string, unknown>;
    missions_suggerees: string[];
    methode_estimation: string;
    intitule: string;
  };
}

interface TachePreanalyseSources {
  id: string;
  statut: "en_attente" | "en_cours" | "terminee" | "echec";
  progression: number;
  message: string;
  nombre_fichiers: number;
  resultat: ResultatPreanalyseSources | null;
  erreur: string;
  date_creation: string;
  date_modification: string;
  date_fin: string | null;
}

type ValeurChamp = string | string[] | boolean;
interface BrouillonProjetLocal {
  version: 1;
  saved_at: string;
  etape_courante: number;
  reference: string;
  intitule: string;
  type_projet: string;
  type_projet_autre: string;
  statut: string;
  organisation: string;
  maitre_ouvrage: string;
  maitre_oeuvre: string;
  famille_client: string;
  sous_type_client: string;
  contexte_contractuel: string;
  missions_principales: string[];
  phase_intervention: string;
  nature_ouvrage: "batiment" | "infrastructure" | "mixte";
  nature_marche: "public" | "prive" | "mixte" | "autre";
  partie_contractante: string;
  role_lbh: string;
  methode_estimation: string;
  sous_missions: string[];
  donnees_entree: Record<string, ValeurChamp>;
  variation_prix: ModeVariationPrix;
  trace_preremplissage: Record<string, unknown>;
}

const CLE_BROUILLON_PROJET = "lbh-projet-nouveau-brouillon-v1";
const BROUILLON_LOCAL_ACTIVE = false;
const CODES_PROCESS_ENTREPRISE = ["reponse_appel_offres", "chiffrage_direct", "devis", "planning_execution", "suivi_rentabilite"];
const CODES_MISSIONS_MASQUEES_UI = ["mission_economique_transversale"];
const DERIVES_MOE_PAR_PHASE: Record<string, string[]> = {
  esq: ["estimation_par_lot"],
  aps: ["estimation_par_lot"],
  apd: ["estimation_par_lot"],
  pro: ["estimation_par_lot", "redaction_cctp", "redaction_bpu", "redaction_dpgf", "redaction_ccap", "redaction_rc"],
  act: ["rapport_analyse_offres"],
  exe: ["mission_economique_transversale"],
  visa: ["mission_economique_transversale"],
  det: ["mission_economique_transversale"],
  opc: ["planning_previsionnel_travaux"],
  aor: ["mission_economique_transversale"],
};
const DERIVES_INFRA_PAR_PHASE: Record<string, string[]> = {
  diagnostic_infrastructure: ["estimation_infrastructure"],
  etudes_preliminaires_infrastructure: ["estimation_infrastructure"],
  avp_infrastructure: ["estimation_infrastructure"],
  pro_infrastructure: ["estimation_infrastructure", "redaction_pieces_marche_infrastructure"],
  act_infrastructure: ["analyse_offres_infrastructure"],
  visa_infrastructure: [],
  det_infrastructure: [],
  opc_infrastructure: ["planning_travaux_infrastructure"],
  aor_infrastructure: [],
};
const DERIVES_ENTREPRISE_PAR_PROCESS: Record<string, string[]> = {
  reponse_appel_offres: ["memoire_technique", "bpu_dpgf_dqe_entreprise", "calcul_debourses_secs", "coefficient_k"],
  chiffrage_direct: ["devis", "calcul_debourses_secs", "coefficient_k"],
  devis: ["calcul_debourses_secs", "coefficient_k"],
  planning_execution: [],
  suivi_rentabilite: [],
};

function nomSansExtension(nom: string): string {
  return nom.replace(/\.[^/.]+$/, "").trim();
}

function nettoyerNomDocument(nom: string): string {
  const base = nomSansExtension(nom)
    .replace(/[_-]+/g, " ")
    .replace(/\b(?:v(?:ersion)?|rev(?:ision)?)\s*[a-z0-9]{1,3}\b/gi, " ")
    .replace(/\b(?:finale?|definitif|definitive|copie|scan(?:ne)?|signed)\b/gi, " ")
    .replace(/\b20\d{2}[\s._-]?\d{2}[\s._-]?\d{2}\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return base || "document importe";
}

function estArchiveZip(fichier: File): boolean {
  return fichier.name.toLowerCase().endsWith(".zip") || fichier.type === "application/zip";
}

function intituleDocumentSource(fichier: File): string {
  const nettoye = nettoyerNomDocument(fichier.name);
  return nettoye.charAt(0).toUpperCase() + nettoye.slice(1);
}

function referenceDocumentSource(referenceProjet: string, fichier: File, index: number): string {
  const base = nettoyerNomDocument(fichier.name)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toUpperCase()
    .slice(0, 40);
  return `${referenceProjet}-SRC-${String(index + 1).padStart(2, "0")}${base ? `-${base}` : ""}`.slice(0, 100);
}

function extensionDepuisNom(nom: string): string {
  const position = nom.lastIndexOf(".");
  return position >= 0 ? nom.slice(position + 1).toLowerCase() : "";
}

function formaterConfianceClassification(score: number): string {
  if (!score) return "faible";
  if (score <= 1) return `${Math.round(score * 100)}%`;
  if (score >= 14) return "très forte";
  if (score >= 9) return "forte";
  if (score >= 5) return "moyenne";
  return "faible";
}

function tailleLisible(octets: number): string {
  if (octets < 1024) return `${octets} o`;
  if (octets < 1024 * 1024) return `${(octets / 1024).toFixed(1)} Ko`;
  return `${(octets / (1024 * 1024)).toFixed(1)} Mo`;
}

function dedoublonnerFichiers(courants: File[], ajouts: FileList | File[] | null): File[] {
  if (!ajouts) return courants;
  const suivants = [...courants];
  for (const fichier of Array.from(ajouts)) {
    const dejaPresent = suivants.some(
      (element) =>
        element.name === fichier.name &&
        element.size === fichier.size &&
        element.lastModified === fichier.lastModified
    );
    if (!dejaPresent) suivants.push(fichier);
  }
  return suivants;
}

function regrouperChamps(parcours?: ParcoursProjet) {
  return (parcours?.champs_dynamiques ?? []).filter((groupe) => groupe.champs.length > 0);
}

function libelleNatureOuvrage(valeur: string) {
  if (valeur === "batiment") return "Bâtiment";
  if (valeur === "infrastructure") return "Infrastructure / VRD";
  if (valeur === "mixte") return "Mixte";
  return valeur || "—";
}

function genererReferenceProjetParDefaut() {
  const maintenant = new Date();
  const annee = maintenant.getFullYear();
  const mois = String(maintenant.getMonth() + 1).padStart(2, "0");
  const jour = String(maintenant.getDate()).padStart(2, "0");
  const heures = String(maintenant.getHours()).padStart(2, "0");
  const minutes = String(maintenant.getMinutes()).padStart(2, "0");
  const secondes = String(maintenant.getSeconds()).padStart(2, "0");
  return `${annee}-${mois}${jour}-${heures}${minutes}${secondes}`;
}

function lireBrouillonProjetLocal(): BrouillonProjetLocal | null {
  if (!BROUILLON_LOCAL_ACTIVE) return null;
  if (typeof window === "undefined") return null;
  try {
    const brut = window.localStorage.getItem(CLE_BROUILLON_PROJET);
    if (!brut) return null;
    const brouillon = JSON.parse(brut) as BrouillonProjetLocal;
    if (brouillon?.version !== 1) return null;
    return brouillon;
  } catch {
    return null;
  }
}

function supprimerBrouillonProjetLocal() {
  if (!BROUILLON_LOCAL_ACTIVE) return;
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(CLE_BROUILLON_PROJET);
}

function formaterHorodatageBrouillon(valeur: string) {
  const date = new Date(valeur);
  if (Number.isNaN(date.getTime())) return valeur;
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export function FormulaireNouveauProjet() {
  const router = useRouter();
  const inputPiecesSourcesRef = useRef<HTMLInputElement | null>(null);
  const referenceInitialeRef = useRef("");
  const [etapeCourante, setEtapeCourante] = useState(0);
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [reference, setReference] = useState(() => genererReferenceProjetParDefaut());
  const [intitule, setIntitule] = useState("");
  const [typeProjet, setTypeProjet] = useState("etude");
  const [typeProjetAutre, setTypeProjetAutre] = useState("");
  const [statut, setStatut] = useState("en_cours");
  const [organisationId, setOrganisationId] = useState("");
  const [maitreOuvrageId, setMaitreOuvrageId] = useState("");
  const [maitreOeuvreId, setMaitreOeuvreId] = useState("");
  const [familleClientId, setFamilleClientId] = useState("");
  const [sousTypeClientId, setSousTypeClientId] = useState("");
  const [contexteContractuelId, setContexteContractuelId] = useState("");
  const [missionsPrincipalesSelectionnees, setMissionsPrincipalesSelectionnees] = useState<string[]>([]);
  const [phaseInterventionId, setPhaseInterventionId] = useState("");
  const [natureOuvrage, setNatureOuvrage] = useState<"batiment" | "infrastructure" | "mixte">("batiment");
  const [natureMarche, setNatureMarche] = useState<"public" | "prive" | "mixte" | "autre">("public");
  const [partieContractante, setPartieContractante] = useState("");
  const [roleLbh, setRoleLbh] = useState("");
  const [methodeEstimation, setMethodeEstimation] = useState("");
  const [sousMissionsSelectionnees, setSousMissionsSelectionnees] = useState<string[]>([]);
  const [donneesEntree, setDonneesEntree] = useState<Record<string, ValeurChamp>>({});
  const [variationPrix, setVariationPrix] = useState<ModeVariationPrix>({
    type_evolution: "aucune",
    cadre_juridique: "public",
    indice_reference: "",
    formule_personnalisee: "",
    date_prix_initial: "",
    date_remise_offre: "",
    date_demarrage: "",
    periodicite_revision: "",
    clause_applicable: "",
    part_fixe: "",
  });
  const [fichiersSourcesProjet, setFichiersSourcesProjet] = useState<File[]>([]);
  const [resultatPreanalyse, setResultatPreanalyse] = useState<ResultatPreanalyseSources | null>(null);
  const [progressionTeleversement, setProgressionTeleversement] = useState<ProgressionTeleversement | null>(null);
  const [libelleTeleversement, setLibelleTeleversement] = useState("Analyse des pièces sources");
  const [tracePreremplissage, setTracePreremplissage] = useState<Record<string, unknown>>({});
  const [analyseSourcesEnCours, setAnalyseSourcesEnCours] = useState(false);
  const [soumissionEnCours, setSoumissionEnCours] = useState(false);
  const [editionSousMissionsOuverte, setEditionSousMissionsOuverte] = useState(false);
  const [preanalyseSourcesId, setPreanalyseSourcesId] = useState<string | null>(null);
  const [preanalyseAppliqueeId, setPreanalyseAppliqueeId] = useState<string | null>(null);
  const [brouillonDisponible, setBrouillonDisponible] = useState<BrouillonProjetLocal | null>(null);
  const [brouillonInitialise, setBrouillonInitialise] = useState(false);
  const [brouillonRestaure, setBrouillonRestaure] = useState(false);
  const [derniereSauvegardeBrouillon, setDerniereSauvegardeBrouillon] = useState<string | null>(null);

  if (!referenceInitialeRef.current) {
    referenceInitialeRef.current = reference;
  }

  const { data: organisations = [] } = useQuery<OrganisationOption[]>({
    queryKey: ["organisations"],
    queryFn: () => api.get<OrganisationOption[]>("/api/organisations/"),
    select: (data) => extraireListeResultats(data),
  });

  const organisationsTriees = useMemo(
    () => [...organisations].sort((a, b) => a.nom.localeCompare(b.nom, "fr")),
    [organisations]
  );

  const { data: referencesIndicesPrix = [] } = useQuery<ReferenceIndexPrix[]>({
    queryKey: ["projets-indices-prix-references"],
    queryFn: () => api.get<ReferenceIndexPrix[]>("/api/projets/indices-prix/references/?limite=140"),
  });

  const referenceIndexSelectionnee = useMemo(
    () => referencesIndicesPrix.find((item) => item.code === variationPrix.indice_reference.trim().toUpperCase()) || null,
    [referencesIndicesPrix, variationPrix.indice_reference]
  );

  const requeteParcours = useMemo(() => {
    const params = new URLSearchParams();
    if (familleClientId) params.set("famille_client", familleClientId);
    if (sousTypeClientId) params.set("sous_type_client", sousTypeClientId);
    if (contexteContractuelId) params.set("contexte_contractuel", contexteContractuelId);
    if (missionsPrincipalesSelectionnees[0]) params.set("mission_principale", missionsPrincipalesSelectionnees[0]);
    for (const missionId of missionsPrincipalesSelectionnees) {
      params.append("missions_principales", missionId);
    }
    if (phaseInterventionId) params.set("phase_intervention", phaseInterventionId);
    params.set("nature_ouvrage", natureOuvrage);
    params.set("nature_marche", natureMarche);
    return params.toString();
  }, [
    familleClientId,
    sousTypeClientId,
    contexteContractuelId,
    missionsPrincipalesSelectionnees,
    phaseInterventionId,
    natureOuvrage,
    natureMarche,
  ]);

  const { data: parcours } = useQuery<ParcoursProjet>({
    queryKey: ["projets-parcours", requeteParcours],
    queryFn: () => api.get<ParcoursProjet>(`/api/projets/parcours/?${requeteParcours}`),
  });

  const { data: preanalyseSources } = useQuery<TachePreanalyseSources>({
    queryKey: ["projets-preanalyse-sources", preanalyseSourcesId],
    queryFn: () => api.get<TachePreanalyseSources>(`/api/projets/preanalyse-sources/taches/${preanalyseSourcesId}/`),
    enabled: Boolean(preanalyseSourcesId),
    refetchInterval: (query) => {
      const donnees = query.state.data as TachePreanalyseSources | undefined;
      if (!donnees) return 1500;
      return donnees.statut === "en_attente" || donnees.statut === "en_cours" ? 1500 : false;
    },
  });

  const groupesChamps = regrouperChamps(parcours);
  const familleClientSelectionnee = useMemo(
    () => parcours?.referentiels.familles_client.find((item) => item.id === familleClientId) ?? null,
    [parcours?.referentiels.familles_client, familleClientId]
  );
  const contexteSelectionne = useMemo(
    () => parcours?.referentiels.contextes_contractuels.find((item) => item.id === contexteContractuelId) ?? null,
    [parcours?.referentiels.contextes_contractuels, contexteContractuelId]
  );
  const estMaitriseOuvrage = familleClientSelectionnee?.code === "maitrise_ouvrage";
  const estMaitriseOeuvre = familleClientSelectionnee?.code === "maitrise_oeuvre";
  const estEntreprise = familleClientSelectionnee?.code === "entreprise";
  const codesPhasesActives = useMemo(
    () => new Set((parcours?.referentiels.phases_intervention ?? []).map((item) => item.code)),
    [parcours?.referentiels.phases_intervention]
  );
  const missionElementMoeIds = useMemo(() => {
    if (!estMaitriseOeuvre || !phaseInterventionId) return [];
    const phase = parcours?.referentiels.phases_intervention.find((item) => item.id === phaseInterventionId);
    if (!phase) return [];
    return (parcours?.referentiels.missions_principales ?? [])
      .filter((item) => item.code === phase.code)
      .map((item) => item.id);
  }, [
    estMaitriseOeuvre,
    phaseInterventionId,
    parcours?.referentiels.phases_intervention,
    parcours?.referentiels.missions_principales,
  ]);
  const missionsDeriveesDePhase = useMemo(() => {
    if (!estMaitriseOeuvre || !phaseInterventionId) return [];
    const phase = parcours?.referentiels.phases_intervention.find((item) => item.id === phaseInterventionId);
    if (!phase) return [];
    const deriveesParPhase = natureOuvrage === "infrastructure" ? DERIVES_INFRA_PAR_PHASE : DERIVES_MOE_PAR_PHASE;
    const codes = deriveesParPhase[phase.code] || [];
    return (parcours?.referentiels.missions_principales ?? [])
      .filter((item) => codes.includes(item.code))
      .map((item) => item.id);
  }, [
    estMaitriseOeuvre,
    phaseInterventionId,
    natureOuvrage,
    parcours?.referentiels.phases_intervention,
    parcours?.referentiels.missions_principales,
  ]);
  const missionsDeriveesEntreprise = useMemo(() => {
    if (!estEntreprise) return [];
    const codes = Array.from(
      new Set(
        missionsPrincipalesSelectionnees.flatMap((id) => {
          const mission = (parcours?.referentiels.missions_principales ?? []).find((item) => item.id === id);
          return mission ? DERIVES_ENTREPRISE_PAR_PROCESS[mission.code] || [] : [];
        })
      )
    );
    return (parcours?.referentiels.missions_principales ?? [])
      .filter((item) => codes.includes(item.code))
      .map((item) => item.id);
  }, [estEntreprise, missionsPrincipalesSelectionnees, parcours?.referentiels.missions_principales]);
  const missionsSelectionneesEffectives = useMemo(
    () => Array.from(new Set([...missionElementMoeIds, ...missionsDeriveesDePhase, ...missionsPrincipalesSelectionnees, ...missionsDeriveesEntreprise])),
    [missionElementMoeIds, missionsDeriveesDePhase, missionsPrincipalesSelectionnees, missionsDeriveesEntreprise]
  );

  useEffect(() => {
    if (!parcours) return;
    const idsSousTypes = new Set(parcours.referentiels.sous_types_client.map((item) => item.id));
    if (sousTypeClientId && !idsSousTypes.has(sousTypeClientId)) setSousTypeClientId("");

    const idsContextes = new Set(parcours.referentiels.contextes_contractuels.map((item) => item.id));
    if (contexteContractuelId && !idsContextes.has(contexteContractuelId)) setContexteContractuelId("");

    const idsMissions = new Set(parcours.referentiels.missions_principales.map((item) => item.id));
    setMissionsPrincipalesSelectionnees((courantes) => courantes.filter((id) => idsMissions.has(id)));

    const idsSousMissions = new Set(parcours.referentiels.sous_missions.map((item) => item.id));
    setSousMissionsSelectionnees((courantes) => courantes.filter((id) => idsSousMissions.has(id)));

    const idsPhases = new Set(parcours.referentiels.phases_intervention.map((item) => item.id));
    if (phaseInterventionId && !idsPhases.has(phaseInterventionId)) setPhaseInterventionId("");
  }, [parcours, sousTypeClientId, contexteContractuelId, phaseInterventionId]);

  useEffect(() => {
    if (estEntreprise && phaseInterventionId) {
      setPhaseInterventionId("");
    }
  }, [estEntreprise, phaseInterventionId]);

  useEffect(() => {
    setResultatPreanalyse(null);
    setTracePreremplissage({});
  }, [familleClientId, contexteContractuelId, natureOuvrage, natureMarche]);

  useEffect(() => {
    if (!BROUILLON_LOCAL_ACTIVE) {
      setBrouillonInitialise(true);
      return;
    }
    const brouillon = lireBrouillonProjetLocal();
    if (brouillon) {
      setBrouillonDisponible(brouillon);
      setDerniereSauvegardeBrouillon(brouillon.saved_at);
    }
    setBrouillonInitialise(true);
  }, []);

  const { mutateAsync } = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post<ProjetCree>("/api/projets/", payload),
  });

  const brouillonProjetAUnContenu = useCallback(
    () => (
      reference.trim() !== referenceInitialeRef.current ||
      Boolean(intitule.trim()) ||
      typeProjet !== "etude" ||
      Boolean(typeProjetAutre.trim()) ||
      statut !== "en_cours" ||
      Boolean(organisationId) ||
      Boolean(maitreOuvrageId) ||
      Boolean(maitreOeuvreId) ||
      Boolean(familleClientId) ||
      Boolean(sousTypeClientId) ||
      Boolean(contexteContractuelId) ||
      missionsPrincipalesSelectionnees.length > 0 ||
      Boolean(phaseInterventionId) ||
      natureOuvrage !== "batiment" ||
      natureMarche !== "public" ||
      Boolean(partieContractante.trim()) ||
      Boolean(roleLbh.trim()) ||
      Boolean(methodeEstimation.trim()) ||
      sousMissionsSelectionnees.length > 0 ||
      Object.keys(donneesEntree).length > 0 ||
      Object.values(variationPrix).some((valeur) => Boolean(valeur)) ||
      Object.keys(tracePreremplissage).length > 0 ||
      fichiersSourcesProjet.length > 0 ||
      Boolean(resultatPreanalyse)
    ),
    [
      reference,
      intitule,
      typeProjet,
      typeProjetAutre,
      statut,
      organisationId,
      maitreOuvrageId,
      maitreOeuvreId,
      familleClientId,
      sousTypeClientId,
      contexteContractuelId,
      missionsPrincipalesSelectionnees,
      phaseInterventionId,
      natureOuvrage,
      natureMarche,
      partieContractante,
      roleLbh,
      methodeEstimation,
      sousMissionsSelectionnees,
      donneesEntree,
      variationPrix,
      tracePreremplissage,
      fichiersSourcesProjet,
      resultatPreanalyse,
    ]
  );

  const construireBrouillonProjet = useCallback(
    (): BrouillonProjetLocal => ({
      version: 1,
      saved_at: new Date().toISOString(),
      etape_courante: etapeCourante,
      reference,
      intitule,
      type_projet: typeProjet,
      type_projet_autre: typeProjetAutre,
      statut,
      organisation: organisationId,
      maitre_ouvrage: maitreOuvrageId,
      maitre_oeuvre: maitreOeuvreId,
      famille_client: familleClientId,
      sous_type_client: sousTypeClientId,
      contexte_contractuel: contexteContractuelId,
      missions_principales: missionsPrincipalesSelectionnees,
      phase_intervention: phaseInterventionId,
      nature_ouvrage: natureOuvrage,
      nature_marche: natureMarche,
      partie_contractante: partieContractante,
      role_lbh: roleLbh,
      methode_estimation: methodeEstimation,
      sous_missions: sousMissionsSelectionnees,
      donnees_entree: donneesEntree,
      variation_prix: variationPrix,
      trace_preremplissage: tracePreremplissage,
    }),
    [
      etapeCourante,
      reference,
      intitule,
      typeProjet,
      typeProjetAutre,
      statut,
      organisationId,
      maitreOuvrageId,
      maitreOeuvreId,
      familleClientId,
      sousTypeClientId,
      contexteContractuelId,
      missionsPrincipalesSelectionnees,
      phaseInterventionId,
      natureOuvrage,
      natureMarche,
      partieContractante,
      roleLbh,
      methodeEstimation,
      sousMissionsSelectionnees,
      donneesEntree,
      variationPrix,
      tracePreremplissage,
    ]
  );

  function appliquerBrouillonProjet(brouillon: BrouillonProjetLocal) {
    setEtapeCourante(Math.max(0, brouillon.etape_courante || 0));
    setErreurs({});
    setReference(brouillon.reference || genererReferenceProjetParDefaut());
    setIntitule(brouillon.intitule || "");
    setTypeProjet(brouillon.type_projet || "etude");
    setTypeProjetAutre(brouillon.type_projet_autre || "");
    setStatut(brouillon.statut || "en_cours");
    setOrganisationId(brouillon.organisation || "");
    setMaitreOuvrageId(brouillon.maitre_ouvrage || "");
    setMaitreOeuvreId(brouillon.maitre_oeuvre || "");
    setFamilleClientId(brouillon.famille_client || "");
    setSousTypeClientId(brouillon.sous_type_client || "");
    setContexteContractuelId(brouillon.contexte_contractuel || "");
    setMissionsPrincipalesSelectionnees(brouillon.missions_principales || []);
    setPhaseInterventionId(brouillon.phase_intervention || "");
    setNatureOuvrage(brouillon.nature_ouvrage || "batiment");
    setNatureMarche(brouillon.nature_marche || "public");
    setPartieContractante(brouillon.partie_contractante || "");
    setRoleLbh(brouillon.role_lbh || "");
    setMethodeEstimation(brouillon.methode_estimation || "");
    setSousMissionsSelectionnees(brouillon.sous_missions || []);
    setDonneesEntree(brouillon.donnees_entree || {});
    setVariationPrix(
      brouillon.variation_prix || {
        type_evolution: "aucune",
        cadre_juridique: "public",
        indice_reference: "",
        formule_personnalisee: "",
        date_prix_initial: "",
        date_remise_offre: "",
        date_demarrage: "",
        periodicite_revision: "",
        clause_applicable: "",
        part_fixe: "",
      }
    );
    setTracePreremplissage(brouillon.trace_preremplissage || {});
    setFichiersSourcesProjet([]);
    setResultatPreanalyse(null);
    setProgressionTeleversement(null);
    setLibelleTeleversement("Analyse des pièces sources");
    setBrouillonRestaure(true);
    setDerniereSauvegardeBrouillon(brouillon.saved_at);
    setBrouillonDisponible(brouillon);
  }

  function effacerBrouillonProjet() {
    supprimerBrouillonProjetLocal();
    setBrouillonDisponible(null);
    setDerniereSauvegardeBrouillon(null);
    setBrouillonRestaure(false);
  }

  useEffect(() => {
    if (!BROUILLON_LOCAL_ACTIVE) return;
    if (!brouillonInitialise || soumissionEnCours) return;

    if (!brouillonProjetAUnContenu()) {
      supprimerBrouillonProjetLocal();
      return;
    }

    const timer = window.setTimeout(() => {
      const brouillon = construireBrouillonProjet();
      window.localStorage.setItem(CLE_BROUILLON_PROJET, JSON.stringify(brouillon));
      setBrouillonDisponible(brouillon);
      setDerniereSauvegardeBrouillon(brouillon.saved_at);
    }, 800);

    return () => window.clearTimeout(timer);
  }, [
    brouillonInitialise,
    soumissionEnCours,
    etapeCourante,
    reference,
    intitule,
    typeProjet,
    typeProjetAutre,
    statut,
    organisationId,
    maitreOuvrageId,
    maitreOeuvreId,
    familleClientId,
    sousTypeClientId,
    contexteContractuelId,
    missionsPrincipalesSelectionnees,
    phaseInterventionId,
    natureOuvrage,
    natureMarche,
    partieContractante,
    roleLbh,
    methodeEstimation,
    sousMissionsSelectionnees,
    donneesEntree,
    variationPrix,
    tracePreremplissage,
    fichiersSourcesProjet,
    resultatPreanalyse,
    brouillonProjetAUnContenu,
    construireBrouillonProjet,
  ]);

  function ajouterPiecesSourcesProjet(selection: FileList | null) {
    setFichiersSourcesProjet((courants) => dedoublonnerFichiers(courants, selection));
    setPreanalyseSourcesId(null);
    setPreanalyseAppliqueeId(null);
    setResultatPreanalyse(null);
    setTracePreremplissage({});
  }

  function retirerPieceSourceProjet(index: number) {
    setFichiersSourcesProjet((courants) => courants.filter((_, position) => position !== index));
    setPreanalyseSourcesId(null);
    setPreanalyseAppliqueeId(null);
    setResultatPreanalyse(null);
    setTracePreremplissage({});
  }

  function mettreAJourChamp(code: string, valeur: ValeurChamp) {
    setDonneesEntree((courant) => ({ ...courant, [code]: valeur }));
  }

  function basculerSousMission(id: string) {
    setSousMissionsSelectionnees((courant) =>
      courant.includes(id) ? courant.filter((valeur) => valeur !== id) : [...courant, id]
    );
  }

  function basculerMissionPrincipale(id: string) {
    setMissionsPrincipalesSelectionnees((courant) =>
      courant.includes(id) ? courant.filter((valeur) => valeur !== id) : [...courant, id]
    );
  }

  const appliquerPreRemplissage = useCallback((resultat: ResultatPreanalyseSources) => {
    const preRemplissage = resultat.pre_remplissage;

    if (preRemplissage.intitule) {
      setIntitule((courant) => courant.trim() || preRemplissage.intitule);
    }
    const referenceExtraite = typeof preRemplissage.donnees_entree.reference_consultation === "string"
      ? preRemplissage.donnees_entree.reference_consultation
      : "";
    if (referenceExtraite) {
      setReference((courant) => courant.trim() || referenceExtraite);
    }
    if (preRemplissage.methode_estimation) {
      setMethodeEstimation((courant) => courant || preRemplissage.methode_estimation);
    }
    if (Object.keys(preRemplissage.donnees_entree).length) {
      setDonneesEntree((courant) => ({
        ...preRemplissage.donnees_entree,
        ...courant,
      }));
    }
    if (preRemplissage.missions_suggerees.length) {
      const idsCompatibles = (parcours?.referentiels.missions_principales ?? [])
        .filter((mission) => preRemplissage.missions_suggerees.includes(mission.code))
        .map((mission) => mission.id);
      if (idsCompatibles.length) {
        setMissionsPrincipalesSelectionnees((courant) => Array.from(new Set([...courant, ...idsCompatibles])));
      }
    }
    setTracePreremplissage(preRemplissage.trace ?? {});
  }, [parcours?.referentiels.missions_principales]);

  useEffect(() => {
    if (!preanalyseSources) return;

    if (preanalyseSources.statut === "en_attente" || preanalyseSources.statut === "en_cours") {
      setAnalyseSourcesEnCours(true);
      setLibelleTeleversement(preanalyseSources.message || "Analyse des pièces sources");
      setProgressionTeleversement({
        charge: preanalyseSources.progression,
        total: 100,
        pourcentage: preanalyseSources.progression,
        debitOctetsSeconde: 0,
        tempsRestantSecondes: null,
      });
      return;
    }

    setAnalyseSourcesEnCours(false);
    setProgressionTeleversement(null);

    if (preanalyseSources.statut === "terminee" && preanalyseSources.resultat && preanalyseAppliqueeId !== preanalyseSources.id) {
      setResultatPreanalyse(preanalyseSources.resultat);
      appliquerPreRemplissage(preanalyseSources.resultat);
      setPreanalyseAppliqueeId(preanalyseSources.id);
      return;
    }

    if (preanalyseSources.statut === "echec") {
      setErreurs((courant) => ({
        ...courant,
        pieces_sources: preanalyseSources.erreur || "Analyse des pièces impossible.",
      }));
    }
  }, [preanalyseSources, preanalyseAppliqueeId, appliquerPreRemplissage]);

  async function analyserPiecesSources() {
    if (!fichiersSourcesProjet.length) {
      setErreurs((courant) => ({ ...courant, pieces_sources: "Ajoute au moins un fichier à analyser." }));
      return;
    }

    setAnalyseSourcesEnCours(true);
    setErreurs((courant) => {
      const suivantes = { ...courant };
      delete suivantes.pieces_sources;
      delete suivantes.formulaire;
      return suivantes;
    });
    setLibelleTeleversement("Analyse des pièces sources");
    setProgressionTeleversement(null);
    setPreanalyseAppliqueeId(null);
    setResultatPreanalyse(null);
    setTracePreremplissage({});

    try {
      const formData = new FormData();
      fichiersSourcesProjet.forEach((fichier) => formData.append("fichiers", fichier));
      if (familleClientId) formData.append("famille_client", familleClientId);
      if (contexteContractuelId) formData.append("contexte_contractuel", contexteContractuelId);
      formData.append("nature_ouvrage", natureOuvrage);
      formData.append("nature_marche", natureMarche);

      const tache = await requeteApiAvecProgression<TachePreanalyseSources>("/api/projets/preanalyse-sources/taches/", {
        method: "POST",
        corps: formData,
        onProgression: setProgressionTeleversement,
      });
      setPreanalyseSourcesId(tache.id);
      setLibelleTeleversement(tache.message || "Analyse en file d'attente");
      setProgressionTeleversement({
        charge: 0,
        total: 100,
        pourcentage: 0,
        debitOctetsSeconde: 0,
        tempsRestantSecondes: null,
      });
    } catch (erreur) {
      setErreurs((courant) => ({
        ...courant,
        pieces_sources: erreur instanceof ErreurApi ? erreur.detail : "Analyse des pièces impossible.",
      }));
      setAnalyseSourcesEnCours(false);
    }
  }

  function validerEtapeCourante() {
    const nouvellesErreurs: Record<string, string> = {};

    if (etapeCourante === 0) {
      if (!reference.trim()) nouvellesErreurs.reference = "Référence obligatoire.";
      if (!intitule.trim()) nouvellesErreurs.intitule = "Intitulé obligatoire.";
      if (!familleClientId) nouvellesErreurs.famille_client = "Famille client obligatoire.";
      if (!sousTypeClientId) nouvellesErreurs.sous_type_client = "Sous-type de client obligatoire.";
      if (!contexteContractuelId) nouvellesErreurs.contexte_contractuel = "Contexte contractuel obligatoire.";
      if (estMaitriseOeuvre && !phaseInterventionId) {
        nouvellesErreurs.phase_intervention =
          natureOuvrage === "infrastructure"
            ? "Élément de mission infrastructure obligatoire."
            : "Phase de mission obligatoire.";
      }
      if (!missionsSelectionneesEffectives.length) nouvellesErreurs.missions_principales = estMaitriseOeuvre ? "Choisis une phase et, si besoin, des prestations complémentaires." : "Sélectionne au moins une mission.";
    }

    if (etapeCourante === 1 && fichiersSourcesProjet.length && !resultatPreanalyse) {
      nouvellesErreurs.pieces_sources = "Analyse les pièces téléversées avant de continuer.";
    }

    if (etapeCourante === 2) {
      for (const groupe of groupesChamps) {
        for (const champ of groupe.champs) {
          if (!champ.obligatoire) continue;
          const valeur = donneesEntree[champ.code];
          const estVide =
            valeur == null ||
            valeur === "" ||
            (Array.isArray(valeur) && valeur.length === 0) ||
            valeur === false;
          if (estVide) nouvellesErreurs[champ.code] = "Champ obligatoire.";
        }
      }
    }

    setErreurs((courant) => ({ ...courant, ...nouvellesErreurs }));
    return Object.keys(nouvellesErreurs).length === 0;
  }

  async function televerserPiecesSources(projet: ProjetCree) {
    for (const [index, fichier] of fichiersSourcesProjet.entries()) {
      if (estArchiveZip(fichier)) {
        setLibelleTeleversement(`Import de l'archive ${fichier.name}`);
        const formData = new FormData();
        formData.append("fichier", fichier);
        formData.append("projet", projet.id);
        await requeteApiAvecProgression("/api/documents/importer-archive/", {
          method: "POST",
          corps: formData,
          onProgression: setProgressionTeleversement,
        });
        continue;
      }

      setLibelleTeleversement(`Import de ${fichier.name}`);
      const formData = new FormData();
      formData.append("fichier", fichier);
      formData.append("projet", projet.id);
      formData.append("reference", referenceDocumentSource(projet.reference, fichier, index));
      formData.append("intitule", intituleDocumentSource(fichier));
      await requeteApiAvecProgression("/api/documents/", {
        method: "POST",
        corps: formData,
        onProgression: setProgressionTeleversement,
      });
    }
  }

  async function creerProjet() {
    setSoumissionEnCours(true);

    try {
      const projet = await mutateAsync({
        reference,
        intitule,
        type_projet: typeProjet,
        type_projet_autre: typeProjet === "autre" ? typeProjetAutre : "",
        statut,
        organisation: organisationId || null,
        maitre_ouvrage: maitreOuvrageId || null,
        maitre_oeuvre: maitreOeuvreId || null,
        preanalyse_sources_id: preanalyseSourcesId,
        contexte_projet_saisie: {
          famille_client: familleClientId,
          sous_type_client: sousTypeClientId,
          contexte_contractuel: contexteContractuelId,
          mission_principale: missionsSelectionneesEffectives[0],
          missions_associees: missionsSelectionneesEffectives,
          phase_intervention: phaseInterventionId || null,
          sous_missions: sousMissionsSelectionnees,
          nature_ouvrage: natureOuvrage,
          nature_marche: natureMarche,
          partie_contractante: partieContractante,
          role_lbh: roleLbh,
          methode_estimation: methodeEstimation,
          donnees_entree: donneesEntree,
          trace_preremplissage: tracePreremplissage,
        },
        mode_variation_prix_saisie: variationPrix,
      });
      if (fichiersSourcesProjet.length && !preanalyseSourcesId) {
        setLibelleTeleversement("Import des pièces sources dans le projet");
        await televerserPiecesSources(projet);
      }
      supprimerBrouillonProjetLocal();
      router.push(`/projets/${projet.id}`);
    } catch (err) {
      if (err instanceof ErreurApi && err.erreurs) {
        const nouvellesErreurs: Record<string, string> = {};
        Object.entries(err.erreurs).forEach(([champ, messages]) => {
          if (Array.isArray(messages)) nouvellesErreurs[champ] = messages[0];
        });
        setErreurs(nouvellesErreurs);
      } else {
        setErreurs({ formulaire: err instanceof Error ? err.message : "Création du projet impossible." });
      }
    } finally {
      setSoumissionEnCours(false);
    }
  }

  function renderChamp(champ: ChampDynamique) {
    const valeur = donneesEntree[champ.code];
    const erreur = erreurs[champ.code];
    const classesBloc = champ.type_champ === "texte_long" ? "xl:col-span-2" : "";

    if (champ.type_champ === "texte_long") {
      return (
        <div key={champ.code} className={classesBloc}>
          <label className="libelle-champ" htmlFor={champ.code}>{champ.libelle}{champ.obligatoire ? " *" : ""}</label>
          <textarea
            id={champ.code}
            className="champ-saisie min-h-28"
            placeholder={champ.placeholder}
            value={typeof valeur === "string" ? valeur : ""}
            onChange={(e) => mettreAJourChamp(champ.code, e.target.value)}
          />
          <p className="mt-1 text-xs text-slate-500">{champ.aide_courte || champ.source_reglementaire}</p>
          {erreur && <p className="mt-1 text-xs text-red-500">{erreur}</p>}
        </div>
      );
    }

    if (champ.type_champ === "selection") {
      return (
        <div key={champ.code} className={classesBloc}>
          <label className="libelle-champ" htmlFor={champ.code}>{champ.libelle}{champ.obligatoire ? " *" : ""}</label>
          <select
            id={champ.code}
            className="champ-saisie"
            value={typeof valeur === "string" ? valeur : ""}
            onChange={(e) => mettreAJourChamp(champ.code, e.target.value)}
          >
            <option value="">Sélectionner</option>
            {champ.options.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">{champ.aide_courte || champ.source_reglementaire}</p>
          {erreur && <p className="mt-1 text-xs text-red-500">{erreur}</p>}
        </div>
      );
    }

    if (champ.type_champ === "multi_selection") {
      const selection = Array.isArray(valeur) ? valeur : [];
      return (
        <div key={champ.code} className="rounded-xl border border-slate-200 bg-white p-4 xl:col-span-2">
          <p className="text-sm font-medium text-slate-900">{champ.libelle}{champ.obligatoire ? " *" : ""}</p>
          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {champ.options.map((option) => {
              const coche = selection.includes(option.value);
              return (
                <label key={option.value} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={coche}
                    onChange={() =>
                      mettreAJourChamp(
                        champ.code,
                        coche ? selection.filter((item) => item !== option.value) : [...selection, option.value]
                      )
                    }
                  />
                  {option.label}
                </label>
              );
            })}
          </div>
          {erreur && <p className="mt-2 text-xs text-red-500">{erreur}</p>}
        </div>
      );
    }

    if (champ.type_champ === "booleen") {
      return (
        <label key={champ.code} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={Boolean(valeur)}
            onChange={(e) => mettreAJourChamp(champ.code, e.target.checked)}
          />
          {champ.libelle}
        </label>
      );
    }

    const typeInput = champ.type_champ === "date" ? "date" : champ.type_champ === "nombre" || champ.type_champ === "montant" ? "number" : "text";
    return (
      <div key={champ.code} className={classesBloc}>
        <label className="libelle-champ" htmlFor={champ.code}>{champ.libelle}{champ.obligatoire ? " *" : ""}</label>
        <input
          id={champ.code}
          type={typeInput}
          className="champ-saisie"
          placeholder={champ.placeholder}
          value={typeof valeur === "string" ? valeur : ""}
          onChange={(e) => mettreAJourChamp(champ.code, e.target.value)}
        />
        <p className="mt-1 text-xs text-slate-500">{champ.aide_courte || champ.source_reglementaire}</p>
        {erreur && <p className="mt-1 text-xs text-red-500">{erreur}</p>}
      </div>
    );
  }

  const etapes = parcours?.etapes ?? [
    { code: "client-contexte", titre: "Client et contexte", ordre: 1 },
    { code: "pieces-sources", titre: "Pièces sources", ordre: 2 },
    { code: "donnees-entree", titre: "Données d'entrée métier", ordre: 3 },
    { code: "structuration", titre: "Structuration du projet", ordre: 4 },
    { code: "validation", titre: "Validation", ordre: 5 },
  ];

  const missionOptions = useMemo(() => {
    const options = parcours?.referentiels.missions_principales ?? [];
    if (estMaitriseOeuvre) {
      return options.filter((option) => !codesPhasesActives.has(option.code) && !CODES_MISSIONS_MASQUEES_UI.includes(option.code));
    }
    if (estEntreprise) {
      return options.filter((option) => CODES_PROCESS_ENTREPRISE.includes(option.code));
    }
    return options.filter((option) => !CODES_MISSIONS_MASQUEES_UI.includes(option.code));
  }, [parcours?.referentiels.missions_principales, estMaitriseOeuvre, estEntreprise, codesPhasesActives]);
  const sousMissionOptions = parcours?.referentiels.sous_missions ?? [];
  const missionsDeriveesAffichees = useMemo(
    () =>
      missionsSelectionneesEffectives
        .map((id) => (parcours?.referentiels.missions_principales ?? []).find((item) => item.id === id))
        .filter((item): item is ReferentielOption => Boolean(item))
        .filter((item) => {
          if (CODES_MISSIONS_MASQUEES_UI.includes(item.code)) return false;
          if (estMaitriseOeuvre) return !codesPhasesActives.has(item.code) && !missionsPrincipalesSelectionnees.includes(item.id);
          return !missionsPrincipalesSelectionnees.includes(item.id);
        }),
    [
      missionsSelectionneesEffectives,
      parcours?.referentiels.missions_principales,
      estMaitriseOeuvre,
      codesPhasesActives,
      missionsPrincipalesSelectionnees,
    ]
  );
  const sousMissionsSelectionneesAffichees = useMemo(
    () => sousMissionOptions.filter((option) => sousMissionsSelectionnees.includes(option.id)),
    [sousMissionOptions, sousMissionsSelectionnees]
  );
  const livrablesActifs = useMemo(
    () => Array.from(new Set(sousMissionsSelectionneesAffichees.flatMap((option) => option.types_livrables ?? []))),
    [sousMissionsSelectionneesAffichees]
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-3 xl:grid-cols-5">
        {etapes.map((etape, index) => {
          const active = index === etapeCourante;
          const done = index < etapeCourante;
          return (
            <button
              key={etape.code}
              type="button"
              className={`rounded-2xl border px-4 py-3 text-left transition ${
                active
                  ? "border-primaire-500 bg-primaire-50"
                  : done
                    ? "border-emerald-300 bg-emerald-100"
                    : "border-slate-200 bg-white"
              }`}
              onClick={() => setEtapeCourante(index)}
            >
              <p
                className={`text-xs font-semibold uppercase tracking-wide ${
                  active ? "text-primaire-700" : done ? "text-emerald-800" : "text-slate-500"
                }`}
              >
                Étape {index + 1}
              </p>
              <p
                className={`mt-1 text-sm font-semibold ${
                  active ? "text-primaire-950" : done ? "text-emerald-950" : "text-slate-900"
                }`}
              >
                {etape.titre}
              </p>
            </button>
          );
        })}
      </div>

      {erreurs.formulaire ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erreurs.formulaire}</div> : null}

      {BROUILLON_LOCAL_ACTIVE && brouillonDisponible && !brouillonRestaure ? (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-semibold">Un brouillon local de projet est disponible.</p>
              <p className="mt-1 text-amber-800">
                Dernière sauvegarde: {formaterHorodatageBrouillon(brouillonDisponible.saved_at)}.
                Les fichiers téléversés devront être ajoutés de nouveau.
              </p>
            </div>
            <div className="flex gap-2">
              <button type="button" className="btn-secondaire" onClick={effacerBrouillonProjet}>
                Supprimer le brouillon
              </button>
              <button type="button" className="btn-primaire" onClick={() => appliquerBrouillonProjet(brouillonDisponible)}>
                Reprendre le brouillon
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {BROUILLON_LOCAL_ACTIVE && (brouillonRestaure || derniereSauvegardeBrouillon) ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <p>
              {brouillonRestaure ? "Brouillon restauré." : "Autosauvegarde active."}
              {derniereSauvegardeBrouillon ? ` Dernière sauvegarde: ${formaterHorodatageBrouillon(derniereSauvegardeBrouillon)}.` : ""}
            </p>
            <button type="button" className="text-sm font-medium text-slate-600 hover:text-red-600" onClick={effacerBrouillonProjet}>
              Effacer le brouillon local
            </button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_22rem]">
        <div className="carte space-y-6">
          {etapeCourante === 0 && (
            <div className="space-y-5">
              <div className="grid gap-4 xl:grid-cols-4">
                <div className="xl:col-span-1">
                  <label className="libelle-champ" htmlFor="reference">Référence *</label>
                  <input id="reference" className="champ-saisie font-mono" value={reference} onChange={(e) => setReference(e.target.value)} />
                  {erreurs.reference ? <p className="mt-1 text-xs text-red-500">{erreurs.reference}</p> : null}
                </div>
                <div className="xl:col-span-3">
                  <label className="libelle-champ" htmlFor="intitule">Intitulé *</label>
                  <input id="intitule" className="champ-saisie" value={intitule} onChange={(e) => setIntitule(e.target.value)} />
                  {erreurs.intitule ? <p className="mt-1 text-xs text-red-500">{erreurs.intitule}</p> : null}
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-5">
                <div>
                  <label className="libelle-champ" htmlFor="type-projet">Type de projet</label>
                  <select id="type-projet" className="champ-saisie" value={typeProjet} onChange={(e) => setTypeProjet(e.target.value)}>
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
                  <select id="statut" className="champ-saisie" value={statut} onChange={(e) => setStatut(e.target.value)}>
                    <option value="prospection">Prospection</option>
                    <option value="en_cours">En cours</option>
                    <option value="suspendu">Suspendu</option>
                    <option value="termine">Terminé</option>
                    <option value="abandonne">Abandonné</option>
                    <option value="archive">Archivé</option>
                  </select>
                </div>
                <div>
                  <label className="libelle-champ" htmlFor="nature-ouvrage">Nature d&apos;ouvrage *</label>
                  <select
                    id="nature-ouvrage"
                    className="champ-saisie"
                    value={natureOuvrage}
                    onChange={(e) => {
                      setNatureOuvrage(e.target.value as typeof natureOuvrage);
                      setPhaseInterventionId("");
                      setMissionsPrincipalesSelectionnees([]);
                      setSousMissionsSelectionnees([]);
                    }}
                  >
                    <option value="batiment">Bâtiment</option>
                    <option value="infrastructure">Infrastructure / VRD</option>
                    <option value="mixte">Mixte</option>
                  </select>
                </div>
                <div>
                  <label className="libelle-champ" htmlFor="nature-marche">Type de marché *</label>
                  <select
                    id="nature-marche"
                    className="champ-saisie"
                    value={natureMarche}
                    onChange={(e) => {
                      setNatureMarche(e.target.value as typeof natureMarche);
                      setContexteContractuelId("");
                    }}
                  >
                    <option value="public">Marché public</option>
                    <option value="prive">Marché privé</option>
                    <option value="mixte">Mixte</option>
                    <option value="autre">Autre</option>
                  </select>
                </div>
                {typeProjet === "autre" ? (
                  <div>
                    <label className="libelle-champ" htmlFor="type-projet-autre">Type personnalisé *</label>
                    <input id="type-projet-autre" className="champ-saisie" value={typeProjetAutre} onChange={(e) => setTypeProjetAutre(e.target.value)} />
                  </div>
                ) : null}
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <ChampOrganisationRapide
                  label="Bureau d'études"
                  name="organisation"
                  placeholder="Sélectionner le bureau d'études"
                  typeOrganisation="bureau_etudes"
                  organisations={organisationsTriees}
                  value={organisationId}
                  onChange={setOrganisationId}
                />
                <div>
                  <label className="libelle-champ" htmlFor="famille-client">Type de client *</label>
                  <select
                    id="famille-client"
                    className="champ-saisie"
                    value={familleClientId}
                    onChange={(e) => {
                      setFamilleClientId(e.target.value);
                      setSousTypeClientId("");
                      setContexteContractuelId("");
                      setMissionsPrincipalesSelectionnees([]);
                      setSousMissionsSelectionnees([]);
                    }}
                  >
                    <option value="">Sélectionner</option>
                    {parcours?.referentiels.familles_client.map((option) => <option key={option.id} value={option.id}>{option.libelle}</option>)}
                  </select>
                  {erreurs.famille_client ? <p className="mt-1 text-xs text-red-500">{erreurs.famille_client}</p> : null}
                </div>
              </div>

              <div className={`grid gap-4 ${estEntreprise ? "xl:grid-cols-2" : "xl:grid-cols-3"}`}>
                <div>
                  <label className="libelle-champ" htmlFor="sous-type-client">Sous-type de client *</label>
                  <select id="sous-type-client" className="champ-saisie" value={sousTypeClientId} onChange={(e) => setSousTypeClientId(e.target.value)}>
                    <option value="">Sélectionner</option>
                    {parcours?.referentiels.sous_types_client.map((option) => <option key={option.id} value={option.id}>{option.libelle}</option>)}
                  </select>
                  {erreurs.sous_type_client ? <p className="mt-1 text-xs text-red-500">{erreurs.sous_type_client}</p> : null}
                </div>
                <div>
                  <label className="libelle-champ" htmlFor="contexte-contractuel">Contexte contractuel *</label>
                  <select id="contexte-contractuel" className="champ-saisie" value={contexteContractuelId} onChange={(e) => setContexteContractuelId(e.target.value)}>
                    <option value="">Sélectionner</option>
                    {parcours?.referentiels.contextes_contractuels.map((option) => <option key={option.id} value={option.id}>{option.libelle}</option>)}
                  </select>
                  {erreurs.contexte_contractuel ? <p className="mt-1 text-xs text-red-500">{erreurs.contexte_contractuel}</p> : null}
                </div>
                {!estEntreprise ? (
                  <div>
                    <label className="libelle-champ" htmlFor="phase-intervention">
                      {estMaitriseOeuvre
                        ? natureOuvrage === "infrastructure"
                          ? "Élément de mission infrastructure *"
                          : "Élément de mission MOE *"
                        : "Phase d'intervention"}
                    </label>
                    <select id="phase-intervention" className="champ-saisie" value={phaseInterventionId} onChange={(e) => setPhaseInterventionId(e.target.value)}>
                      <option value="">Sélectionner</option>
                      {parcours?.referentiels.phases_intervention.map((option) => <option key={option.id} value={option.id}>{option.libelle}</option>)}
                    </select>
                    {erreurs.phase_intervention ? <p className="mt-1 text-xs text-red-500">{erreurs.phase_intervention}</p> : null}
                  </div>
                ) : null}
              </div>

              {familleClientId ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-slate-900">
                        {estMaitriseOeuvre
                          ? natureOuvrage === "infrastructure"
                            ? "Prestations infrastructure confiées à LBH"
                            : "Prestations économiques confiées à LBH"
                          : estEntreprise
                            ? "Processus entreprise confiés à LBH"
                            : "Missions principales"}
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
                        {estMaitriseOeuvre
                          ? natureOuvrage === "infrastructure"
                            ? "L'élément de mission infrastructure est porté par la phase. Ici, ne sélectionne que les prestations complémentaires réellement confiées à LBH."
                            : "L'élément de mission MOE est porté par la phase. Ici, ne sélectionne que les prestations économiques complémentaires réellement confiées à LBH."
                          : estEntreprise
                            ? "Ici, sélectionne le ou les processus confiés. Les livrables internes de réponse ou de chiffrage seront déduits automatiquement."
                            : "Les missions proposées dépendent du type de client sélectionné."}
                      </p>
                    </div>
                    {erreurs.missions_principales ? <span className="text-xs font-medium text-red-600">{erreurs.missions_principales}</span> : null}
                  </div>
                  {estMaitriseOeuvre && phaseInterventionId ? (
                    <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                      Élément de mission retenu : <span className="font-semibold">{parcours?.referentiels.phases_intervention.find((item) => item.id === phaseInterventionId)?.libelle || "—"}</span>
                    </div>
                  ) : null}
                  {(estMaitriseOeuvre || estEntreprise) && missionsDeriveesAffichees.length ? (
                    <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {estMaitriseOeuvre
                          ? natureOuvrage === "infrastructure"
                            ? "Livrables / prestations déduits de la mission infrastructure"
                            : "Livrables / prestations déduits de la mission"
                          : "Livrables / prestations déduits du processus"}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {missionsDeriveesAffichees.map((item) => (
                          <span key={item.id} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-800">
                            {item.libelle}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {missionOptions.map((option) => {
                      const coche = missionsPrincipalesSelectionnees.includes(option.id);
                      return (
                        <label key={option.id} className={`rounded-xl border px-4 py-3 text-sm transition ${coche ? "border-primaire-500 bg-primaire-50" : "border-slate-200 bg-white"}`}>
                          <div className="flex items-start gap-3">
                            <input type="checkbox" checked={coche} onChange={() => basculerMissionPrincipale(option.id)} className="mt-1" />
                            <div>
                              <p className="font-medium text-slate-900">{option.libelle}</p>
                              {option.description ? <p className="mt-1 text-xs text-slate-500">{option.description}</p> : null}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <div className="grid gap-4 xl:grid-cols-2">
                <div>
                  <label className="libelle-champ" htmlFor="partie-contractante">Partie contractante</label>
                  <input id="partie-contractante" className="champ-saisie" value={partieContractante} onChange={(e) => setPartieContractante(e.target.value)} />
                </div>
                <div>
                  <label className="libelle-champ" htmlFor="role-lbh">Rôle de LBH</label>
                  <input id="role-lbh" className="champ-saisie" value={roleLbh} onChange={(e) => setRoleLbh(e.target.value)} placeholder="AMO économique, économiste cotraitant, appui chiffrage…" />
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                {estMaitriseOuvrage ? (
                  <ChampOrganisationRapide
                    label="Maître d'ouvrage / acheteur"
                    name="maitre_ouvrage"
                    placeholder="Sélectionner l'acheteur ou le maître d'ouvrage"
                    typeOrganisation="maitre_ouvrage"
                    organisations={organisationsTriees}
                    value={maitreOuvrageId}
                    onChange={setMaitreOuvrageId}
                  />
                ) : null}

                {estMaitriseOeuvre ? (
                  <>
                    <ChampOrganisationRapide
                      label="Maître d'ouvrage"
                      name="maitre_ouvrage"
                      placeholder="Sélectionner le maître d'ouvrage"
                      typeOrganisation="maitre_ouvrage"
                      organisations={organisationsTriees}
                      value={maitreOuvrageId}
                      onChange={setMaitreOuvrageId}
                    />
                    <ChampOrganisationRapide
                      label="Mandataire / partenaire MOE"
                      name="maitre_oeuvre"
                      placeholder="Sélectionner l'architecte ou le mandataire"
                      typeOrganisation="partenaire"
                      organisations={organisationsTriees}
                      value={maitreOeuvreId}
                      onChange={setMaitreOeuvreId}
                    />
                  </>
                ) : null}

                {estEntreprise ? (
                  <>
                    <ChampOrganisationRapide
                      label="Entreprise cliente"
                      name="maitre_oeuvre"
                      placeholder="Sélectionner l'entreprise ou le mandataire"
                      typeOrganisation="entreprise"
                      organisations={organisationsTriees}
                      value={maitreOeuvreId}
                      onChange={setMaitreOeuvreId}
                    />
                    <ChampOrganisationRapide
                      label="Donneur d'ordre / maître d'ouvrage"
                      name="maitre_ouvrage"
                      placeholder="Sélectionner le donneur d'ordre"
                      typeOrganisation="maitre_ouvrage"
                      organisations={organisationsTriees}
                      value={maitreOuvrageId}
                      onChange={setMaitreOuvrageId}
                    />
                  </>
                ) : null}

                {!estMaitriseOuvrage && !estMaitriseOeuvre && !estEntreprise ? (
                  <>
                    <ChampOrganisationRapide
                      label="Partie cliente"
                      name="maitre_ouvrage"
                      placeholder="Sélectionner l'organisation cliente"
                      typeOrganisation="maitre_ouvrage"
                      organisations={organisationsTriees}
                      value={maitreOuvrageId}
                      onChange={setMaitreOuvrageId}
                    />
                    <ChampOrganisationRapide
                      label="Partenaire / donneur d'ordre"
                      name="maitre_oeuvre"
                      placeholder="Sélectionner l'organisation partenaire"
                      typeOrganisation="partenaire"
                      organisations={organisationsTriees}
                      value={maitreOeuvreId}
                      onChange={setMaitreOeuvreId}
                    />
                  </>
                ) : null}
              </div>
            </div>
          )}

          {etapeCourante === 1 && (
            <div className="space-y-5">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">Pièces sources à analyser</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Téléverse ici les programmes, CCTP, BPU, DPGF, DQE, archives ZIP et autres pièces d&apos;entrée.
                      Leur contenu sera analysé pour proposer un préremplissage, puis importé dans le GED du projet lors de la création.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="btn-secondaire" onClick={() => inputPiecesSourcesRef.current?.click()}>
                      Ajouter des fichiers
                    </button>
                    <button
                      type="button"
                      className="btn-primaire"
                      onClick={analyserPiecesSources}
                      disabled={analyseSourcesEnCours || !fichiersSourcesProjet.length}
                    >
                      {analyseSourcesEnCours ? "Analyse…" : "Analyser les pièces"}
                    </button>
                  </div>
                </div>

                <input
                  ref={inputPiecesSourcesRef}
                  type="file"
                  className="hidden"
                  multiple
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.odt,.ods,.zip,.png,.jpg,.jpeg,.tif,.tiff,.dwg,.dxf"
                  onChange={(event) => {
                    ajouterPiecesSourcesProjet(event.target.files);
                    event.currentTarget.value = "";
                  }}
                />

                <div className="mt-4">
                  <EtatTeleversement progression={progressionTeleversement} libelle={libelleTeleversement} />
                  {erreurs.pieces_sources ? <p className="mt-2 text-xs text-red-500">{erreurs.pieces_sources}</p> : null}
                </div>

                <div className="mt-4 grid gap-3">
                  {fichiersSourcesProjet.length ? fichiersSourcesProjet.map((fichier, index) => (
                    <div key={`${fichier.name}-${index}`} className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3">
                      <div className="min-w-0">
                        <p className="break-words text-sm font-medium text-slate-900">{intituleDocumentSource(fichier)}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {tailleLisible(fichier.size)} · {extensionDepuisNom(fichier.name).toUpperCase() || "FICHIER"} · {estArchiveZip(fichier) ? "Archive à extraire" : "Fichier source"}
                        </p>
                        {nettoyerNomDocument(fichier.name) !== nomSansExtension(fichier.name) ? (
                          <p className="mt-1 break-all text-[11px] text-slate-400">
                            Nom d&apos;origine : {fichier.name}
                          </p>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        className="text-sm text-slate-500 hover:text-red-600"
                        onClick={() => retirerPieceSourceProjet(index)}
                      >
                        Retirer
                      </button>
                    </div>
                  )) : (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-5 text-sm text-slate-500">
                      Aucun fichier source sélectionné.
                    </div>
                  )}
                </div>
              </div>

              {resultatPreanalyse ? (
                <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                      <h3 className="text-base font-semibold text-slate-900">Classification détectée</h3>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {resultatPreanalyse.resume.types_detectes.length ? resultatPreanalyse.resume.types_detectes.map((item) => (
                          <span key={item.code} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-800">
                            {item.libelle || item.code} · {item.occurrences}
                          </span>
                        )) : (
                          <span className="text-sm text-slate-500">Aucun type reconnu.</span>
                        )}
                      </div>
                      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50">
                        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                          <p className="text-sm font-medium text-slate-900">
                            {resultatPreanalyse.resume.fichiers_analyses} fichier{resultatPreanalyse.resume.fichiers_analyses > 1 ? "s" : ""} inspecté{resultatPreanalyse.resume.fichiers_analyses > 1 ? "s" : ""}
                          </p>
                          <p className="text-xs text-slate-500">
                            Liste compacte, regroupée par fichier
                          </p>
                        </div>
                        <ul className="max-h-[28rem] space-y-0 overflow-auto px-4 py-2">
                          {resultatPreanalyse.analyses.map((analyse) => (
                            <li key={`${analyse.source_parent ?? "racine"}-${analyse.nom_fichier}`} className="border-b border-slate-200/80 py-3 last:border-b-0">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <p className="break-words text-sm font-medium text-slate-900">
                                    {analyse.nom_affichage || analyse.nom_fichier}
                                  </p>
                                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                                    <span>{analyse.type_piece?.libelle || "Type non reconnu"}</span>
                                    <span>Confiance {formaterConfianceClassification(analyse.confiance || 0)}</span>
                                    {analyse.extension ? <span>{analyse.extension.toUpperCase()}</span> : null}
                                    {analyse.source_parent ? <span>Archive : {analyse.source_parent}</span> : null}
                                  </div>
                                  {analyse.nom_affichage && analyse.nom_affichage !== analyse.nom_fichier ? (
                                    <p className="mt-1 break-all text-[11px] text-slate-400">
                                      Nom d&apos;origine : {analyse.nom_fichier}
                                    </p>
                                  ) : null}
                                  {analyse.mots_cles?.length ? (
                                    <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-slate-500">
                                      <li>Mots-clés : {analyse.mots_cles.join(", ")}</li>
                                    </ul>
                                  ) : null}
                                  {analyse.detail ? <p className="mt-2 break-words text-xs text-amber-700">{analyse.detail}</p> : null}
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                      <h3 className="text-base font-semibold text-emerald-950">Préremplissage proposé</h3>
                      <dl className="mt-4 space-y-3 text-sm">
                        <div>
                          <dt className="text-xs uppercase tracking-wide text-emerald-700">Intitulé</dt>
                          <dd className="mt-1 font-medium text-emerald-950">{resultatPreanalyse.pre_remplissage.intitule || "Aucune proposition"}</dd>
                        </div>
                        <div>
                          <dt className="text-xs uppercase tracking-wide text-emerald-700">Méthode d&apos;estimation</dt>
                          <dd className="mt-1 font-medium text-emerald-950">{resultatPreanalyse.pre_remplissage.methode_estimation || "Aucune proposition"}</dd>
                        </div>
                        <div>
                          <dt className="text-xs uppercase tracking-wide text-emerald-700">Missions suggérées</dt>
                          <dd className="mt-1 font-medium text-emerald-950">
                            {resultatPreanalyse.pre_remplissage.missions_suggerees.length
                              ? resultatPreanalyse.pre_remplissage.missions_suggerees.join(", ")
                              : "Aucune mission suggérée"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs uppercase tracking-wide text-emerald-700">Champs extraits</dt>
                          <dd className="mt-1 font-medium text-emerald-950">
                            {Object.keys(resultatPreanalyse.pre_remplissage.donnees_entree).length}
                          </dd>
                        </div>
                      </dl>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                      <h3 className="text-base font-semibold text-slate-900">Import prévu dans le projet</h3>
                      <p className="mt-2 text-sm text-slate-500">
                        Les fichiers analysés resteront attachés à la création du projet et seront importés dans le GED après validation du formulaire.
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {etapeCourante === 2 && (
            <div className="space-y-5">
              {groupesChamps.length ? groupesChamps.map((groupe) => (
                <section key={groupe.groupe} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <h3 className="text-base font-semibold text-slate-900">{groupe.champs[0]?.section || groupe.groupe}</h3>
                  <div className="mt-4 grid gap-4 xl:grid-cols-3">
                    {groupe.champs.map((champ) => renderChamp(champ))}
                  </div>
                </section>
              )) : <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">Les champs métier apparaissent dès que le client, le contexte contractuel et les missions sont qualifiés.</div>}
            </div>
          )}

          {etapeCourante === 3 && (
            <div className="space-y-5">
              <div className="surface-subtile rounded-2xl p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="max-w-3xl">
                    <h3 className="text-base font-semibold" style={{ color: "var(--texte)" }}>Compléments activés automatiquement</h3>
                    <p className="mt-2 text-sm" style={{ color: "var(--texte-2)" }}>
                      Cette étape ne requalifie pas le projet. La plateforme se base sur vos choix précédents pour préparer les sous-missions et livrables utiles.
                      Vous n&apos;avez rien à ressaisir ici sauf si vous voulez ajuster manuellement les compléments proposés.
                    </p>
                  </div>
                  {sousMissionOptions.length ? (
                    <button
                      type="button"
                      className="btn-secondaire"
                      onClick={() => setEditionSousMissionsOuverte((courant) => !courant)}
                    >
                      {editionSousMissionsOuverte ? "Masquer les ajustements" : "Ajuster manuellement"}
                    </button>
                  ) : null}
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="surface-douce rounded-xl px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--texte-2)" }}>Missions actives</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {missionsDeriveesAffichees.length ? missionsDeriveesAffichees.map((item) => (
                        <span key={item.id} className="rounded-full px-2.5 py-1 text-xs font-medium" style={{ backgroundColor: "color-mix(in srgb, var(--fond-carte) 78%, var(--c-base) 22%)", color: "var(--texte)" }}>
                          {item.libelle}
                        </span>
                      )) : (
                        <span className="text-sm" style={{ color: "var(--texte-2)" }}>Aucune mission complémentaire affichée.</span>
                      )}
                    </div>
                  </div>
                  <div className="surface-douce rounded-xl px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--texte-2)" }}>Sous-missions retenues</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {sousMissionsSelectionneesAffichees.length ? sousMissionsSelectionneesAffichees.map((option) => (
                        <span key={option.id} className="rounded-full px-2.5 py-1 text-xs font-medium" style={{ backgroundColor: "color-mix(in srgb, var(--fond-carte) 84%, var(--fond-app))", color: "var(--texte)" }}>
                          {option.libelle}
                        </span>
                      )) : (
                        <span className="text-sm" style={{ color: "var(--texte-2)" }}>Aucune sous-mission additionnelle sélectionnée.</span>
                      )}
                    </div>
                  </div>
                  <div className="surface-douce rounded-xl px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--texte-2)" }}>Livrables associés</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {livrablesActifs.length ? livrablesActifs.map((type) => (
                        <span key={type} className="rounded-full px-2.5 py-1 text-xs font-medium" style={{ backgroundColor: "color-mix(in srgb, var(--fond-carte) 82%, var(--c-base) 18%)", color: "var(--texte)" }}>
                          {type.replace(/_/g, " ")}
                        </span>
                      )) : (
                        <span className="text-sm" style={{ color: "var(--texte-2)" }}>Les livrables seront déduits automatiquement du projet.</span>
                      )}
                    </div>
                  </div>
                </div>

                {editionSousMissionsOuverte ? (
                  <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                    {sousMissionOptions.length ? sousMissionOptions.map((option) => (
                      <label key={option.id} className="surface-douce rounded-xl px-4 py-3 text-sm" style={{ color: "var(--texte-2)" }}>
                        <div className="flex items-start gap-2">
                          <input type="checkbox" className="mt-1" checked={sousMissionsSelectionnees.includes(option.id)} onChange={() => basculerSousMission(option.id)} />
                          <div className="min-w-0">
                            <p className="font-medium" style={{ color: "var(--texte)" }}>{option.libelle}</p>
                            {option.description ? (
                              <p className="mt-1 text-xs" style={{ color: "var(--texte-2)" }}>{option.description}</p>
                            ) : null}
                            {option.types_livrables?.length ? (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {option.types_livrables.map((type) => (
                                  <span key={type} className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ backgroundColor: "color-mix(in srgb, var(--fond-carte) 82%, var(--c-base) 18%)", color: "var(--texte)" }}>
                                    {type.replace(/_/g, " ")}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </label>
                    )) : <p className="text-sm" style={{ color: "var(--texte-2)" }}>Aucune sous-mission spécifique proposée.</p>}
                  </div>
                ) : null}
              </div>

              <div className="grid gap-4 xl:grid-cols-3">
                <div>
                  <label className="libelle-champ" htmlFor="methode-estimation">Méthode d&apos;estimation</label>
                  <select id="methode-estimation" className="champ-saisie" value={methodeEstimation} onChange={(e) => setMethodeEstimation(e.target.value)}>
                    <option value="">Sélectionner</option>
                    <option value="ratio">Ratio</option>
                    <option value="analytique">Analytique</option>
                    <option value="retour_experience">Retour d&apos;expérience</option>
                    <option value="mixte">Mixte</option>
                  </select>
                </div>
                <div>
                  <label className="libelle-champ" htmlFor="type-evolution">Variation de prix</label>
                  <select id="type-evolution" className="champ-saisie" value={variationPrix.type_evolution} onChange={(e) => setVariationPrix((courant) => ({ ...courant, type_evolution: e.target.value }))}>
                    <option value="aucune">Aucune</option>
                    <option value="actualisation">Actualisation</option>
                    <option value="revision">Révision</option>
                  </select>
                </div>
                {variationPrix.type_evolution !== "aucune" ? (
                  <div>
                    <label className="libelle-champ" htmlFor="cadre-juridique">Cadre juridique</label>
                    <select id="cadre-juridique" className="champ-saisie" value={variationPrix.cadre_juridique} onChange={(e) => setVariationPrix((courant) => ({ ...courant, cadre_juridique: e.target.value }))}>
                      <option value="public">Marché public</option>
                      <option value="prive">Marché privé</option>
                    </select>
                  </div>
                ) : null}
                {variationPrix.type_evolution !== "aucune" ? (
                  <div className="xl:col-span-2">
                    <label className="libelle-champ" htmlFor="indice-reference">Indice / index</label>
                    <input id="indice-reference" list="indices-prix-options" className="champ-saisie" value={variationPrix.indice_reference} onChange={(e) => setVariationPrix((courant) => ({ ...courant, indice_reference: e.target.value.toUpperCase() }))} placeholder="BT01, BT45, TP02, BTM01, TPM01…" />
                    <datalist id="indices-prix-options">
                      {referencesIndicesPrix.map((item) => (
                        <option key={item.code} value={item.code}>
                          {`${item.code} — ${item.libelle} (${item.territoire})`}
                        </option>
                      ))}
                    </datalist>
                    {referenceIndexSelectionnee?.derniere_valeur ? (
                      <p className="mt-2 text-xs text-slate-500">
                        {referenceIndexSelectionnee.libelle} · {referenceIndexSelectionnee.territoire} · dernière valeur officielle {referenceIndexSelectionnee.derniere_valeur.valeur} au {new Date(referenceIndexSelectionnee.derniere_valeur.date_valeur).toLocaleDateString("fr-FR")}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                {variationPrix.type_evolution !== "aucune" ? (
                  <div>
                    <label className="libelle-champ" htmlFor="date-prix-initial">Date du prix initial</label>
                    <input id="date-prix-initial" type="date" className="champ-saisie" value={variationPrix.date_prix_initial || ""} onChange={(e) => setVariationPrix((courant) => ({ ...courant, date_prix_initial: e.target.value }))} />
                  </div>
                ) : null}
                {variationPrix.type_evolution !== "aucune" ? (
                  <div>
                    <label className="libelle-champ" htmlFor="date-remise-offre-variation">Date de remise d&apos;offre</label>
                    <input id="date-remise-offre-variation" type="date" className="champ-saisie" value={variationPrix.date_remise_offre || ""} onChange={(e) => setVariationPrix((courant) => ({ ...courant, date_remise_offre: e.target.value }))} />
                  </div>
                ) : null}
                {variationPrix.type_evolution !== "aucune" ? (
                  <div>
                    <label className="libelle-champ" htmlFor="date-demarrage">Date de démarrage</label>
                    <input id="date-demarrage" type="date" className="champ-saisie" value={variationPrix.date_demarrage || ""} onChange={(e) => setVariationPrix((courant) => ({ ...courant, date_demarrage: e.target.value }))} />
                  </div>
                ) : null}
                {variationPrix.type_evolution === "revision" ? (
                  <div>
                    <label className="libelle-champ" htmlFor="periodicite-revision">Périodicité de révision</label>
                    <select id="periodicite-revision" className="champ-saisie" value={variationPrix.periodicite_revision || ""} onChange={(e) => setVariationPrix((courant) => ({ ...courant, periodicite_revision: e.target.value }))}>
                      <option value="">Sélectionner</option>
                      <option value="mensuelle">Mensuelle</option>
                      <option value="trimestrielle">Trimestrielle</option>
                      <option value="semestrielle">Semestrielle</option>
                      <option value="annuelle">Annuelle</option>
                      <option value="ponctuelle">Ponctuelle</option>
                    </select>
                  </div>
                ) : null}
                {variationPrix.type_evolution !== "aucune" ? (
                  <div>
                    <label className="libelle-champ" htmlFor="part-fixe">Part fixe (%)</label>
                    <input id="part-fixe" className="champ-saisie" value={variationPrix.part_fixe || ""} onChange={(e) => setVariationPrix((courant) => ({ ...courant, part_fixe: e.target.value }))} placeholder="0 à 100" />
                  </div>
                ) : null}
                {variationPrix.type_evolution !== "aucune" ? (
                  <div className="xl:col-span-3">
                    <label className="libelle-champ" htmlFor="clause-applicable">Clause applicable</label>
                    <textarea id="clause-applicable" className="champ-saisie min-h-24" value={variationPrix.clause_applicable || ""} onChange={(e) => setVariationPrix((courant) => ({ ...courant, clause_applicable: e.target.value }))} placeholder="Clause contractuelle d'actualisation ou de révision retenue" />
                  </div>
                ) : null}
                {variationPrix.type_evolution === "revision" ? (
                  <div className="xl:col-span-3">
                    <label className="libelle-champ" htmlFor="formule-personnalisee">Formule personnalisée</label>
                    <input id="formule-personnalisee" className="champ-saisie" value={variationPrix.formule_personnalisee || ""} onChange={(e) => setVariationPrix((courant) => ({ ...courant, formule_personnalisee: e.target.value }))} placeholder="Exemple: 0.15 + 0.85 * (index_actuel / index_initial)" />
                  </div>
                ) : null}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <h3 className="text-base font-semibold text-slate-900">Dossiers projet générés</h3>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {(parcours?.dossiers_ged ?? []).slice(0, 18).map((dossier) => (
                    <div key={dossier.code} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-sm font-medium text-slate-900">{dossier.intitule}</p>
                      <p className="mt-1 text-xs text-slate-500">{dossier.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {etapeCourante === 4 && (
            <div className="space-y-5">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <h3 className="text-base font-semibold text-slate-900">Résumé métier</h3>
                <dl className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div><dt className="text-xs uppercase tracking-wide text-slate-500">Référence</dt><dd className="mt-1 text-sm font-medium text-slate-900">{reference || "—"}</dd></div>
                  <div><dt className="text-xs uppercase tracking-wide text-slate-500">Intitulé</dt><dd className="mt-1 text-sm font-medium text-slate-900">{intitule || "—"}</dd></div>
                  <div><dt className="text-xs uppercase tracking-wide text-slate-500">Champs métier</dt><dd className="mt-1 text-sm font-medium text-slate-900">{Object.keys(donneesEntree).length}</dd></div>
                  <div><dt className="text-xs uppercase tracking-wide text-slate-500">Sous-missions</dt><dd className="mt-1 text-sm font-medium text-slate-900">{sousMissionsSelectionnees.length}</dd></div>
                </dl>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-slate-200 pt-4">
            <button type="button" className="btn-secondaire" onClick={() => setEtapeCourante((courante) => Math.max(0, courante - 1))} disabled={etapeCourante === 0 || soumissionEnCours}>Retour</button>
            <div className="flex gap-3">
              {etapeCourante < etapes.length - 1 ? (
                <button
                  type="button"
                  className="btn-primaire"
                  onClick={() => {
                    if (!validerEtapeCourante()) return;
                    setEtapeCourante((courante) => Math.min(etapes.length - 1, courante + 1));
                  }}
                >
                  Étape suivante
                </button>
              ) : (
                <button type="button" className="btn-primaire" onClick={creerProjet} disabled={soumissionEnCours}>
                  {soumissionEnCours ? "Création…" : "Créer le projet"}
                </button>
              )}
            </div>
          </div>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          <div className="carte">
            <p className="text-sm font-semibold text-slate-900">Contexte courant</p>
            <dl className="mt-4 space-y-3 text-sm">
              <div><dt className="text-xs uppercase tracking-wide text-slate-500">Ouvrage</dt><dd className="mt-1 font-medium text-slate-900">{libelleNatureOuvrage(natureOuvrage)}</dd></div>
              <div><dt className="text-xs uppercase tracking-wide text-slate-500">Marché</dt><dd className="mt-1 font-medium text-slate-900">{natureMarche}</dd></div>
              <div><dt className="text-xs uppercase tracking-wide text-slate-500">Famille</dt><dd className="mt-1 font-medium text-slate-900">{familleClientSelectionnee?.libelle || "—"}</dd></div>
              <div><dt className="text-xs uppercase tracking-wide text-slate-500">Client</dt><dd className="mt-1 font-medium text-slate-900">{parcours?.referentiels.sous_types_client.find((item) => item.id === sousTypeClientId)?.libelle || "—"}</dd></div>
              <div><dt className="text-xs uppercase tracking-wide text-slate-500">Contexte</dt><dd className="mt-1 font-medium text-slate-900">{contexteSelectionne?.libelle || "—"}</dd></div>
              {!estEntreprise ? <div><dt className="text-xs uppercase tracking-wide text-slate-500">{estMaitriseOeuvre ? (natureOuvrage === "infrastructure" ? "Mission infra" : "Élément de mission") : "Phase"}</dt><dd className="mt-1 font-medium text-slate-900">{parcours?.referentiels.phases_intervention.find((item) => item.id === phaseInterventionId)?.libelle || "—"}</dd></div> : null}
              <div><dt className="text-xs uppercase tracking-wide text-slate-500">{estEntreprise ? "Processus" : "Prestations"}</dt><dd className="mt-1 font-medium text-slate-900">{missionsPrincipalesSelectionnees.length ? missionsPrincipalesSelectionnees.map((id) => (parcours?.referentiels.missions_principales.find((item) => item.id === id)?.libelle || id)).join(", ") : "—"}</dd></div>
            </dl>
          </div>

          <div className="carte">
            <p className="text-sm font-semibold text-slate-900">Pilotage</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Champs compatibles</p><p className="mt-1 text-xl font-semibold text-slate-900">{groupesChamps.reduce((total, groupe) => total + groupe.champs.length, 0)}</p></div>
              <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Prestations actives</p><p className="mt-1 text-xl font-semibold text-slate-900">{missionsPrincipalesSelectionnees.length}</p></div>
              <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Sous-missions</p><p className="mt-1 text-xl font-semibold text-slate-900">{sousMissionsSelectionnees.length}</p></div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
