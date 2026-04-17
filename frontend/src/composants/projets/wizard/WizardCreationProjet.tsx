"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Save, AlertCircle } from "lucide-react";
import {
  api,
  ErreurApi,
  extraireListeResultats,
  requeteApiAvecProgression,
} from "@/crochets/useApi";
import type { OrganisationOption } from "@/composants/projets/ChampOrganisationRapide";

import { IndicateurEtapes } from "./IndicateurEtapes";
import { EtapeContexte } from "./EtapeContexte";
import { EtapeIdentification } from "./EtapeIdentification";
import { EtapeAnalyse } from "./EtapeAnalyse";
import { EtapeMissions } from "./EtapeMissions";
import { EtapeRecapitulatif } from "./EtapeRecapitulatif";
import type {
  EtatWizard,
  ParcoursProjet,
  TachePreanalyseSources,
  ResultatPreanalyseSources,
  ValeurChamp,
} from "./types";

/* ────────────────────────────────────────────────────────────
   CONSTANTES
────────────────────────────────────────────────────────────── */
const CLE_BROUILLON = "lbh-projet-nouveau-brouillon-v2";

const ETAPES_WIZARD = [
  { titre: "Contexte",       description: "Type client et nature" },
  { titre: "Identification", description: "Données du projet" },
  { titre: "Analyse",        description: "Sources et IA" },
  { titre: "Missions",       description: "Livrables et données" },
  { titre: "Récapitulatif",  description: "Création du projet" },
];

function genererReference() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function etatInitial(): EtatWizard {
  return {
    familleClientId: "",
    sousTypeClientId: "",
    contexteContractuelId: "",
    missionsPrincipalesSelectionnees: [],
    phaseInterventionId: "",
    natureOuvrage: "batiment",
    natureMarche: "public",
    reference: genererReference(),
    intitule: "",
    typeProjet: "etude",
    typeProjetAutre: "",
    statut: "en_cours",
    organisationId: "",
    maitreOuvrageId: "",
    maitreOeuvreId: "",
    commune: "",
    departement: "",
    montantEstime: "",
    dateDebutPrevue: "",
    dateFinPrevue: "",
    description: "",
    fichiersSourcesProjet: [],
    preanalyseSourcesId: null,
    resultatPreanalyse: null,
    champsPreremplis: new Set<string>(),
    sousMissionsSelectionnees: [],
    partieContractante: "",
    roleLbh: "",
    methodeEstimation: "",
    donneesEntree: {},
    variationPrix: {
      type_evolution: "ferme",
      cadre_juridique: "",
      indice_reference: "",
      formule_personnalisee: "",
      date_prix_initial: "",
      date_remise_offre: "",
      date_demarrage: "",
      periodicite_revision: "",
      clause_applicable: "",
      part_fixe: "",
    },
  };
}

/* ────────────────────────────────────────────────────────────
   PERSISTANCE BROUILLON
────────────────────────────────────────────────────────────── */
function lireBrouillon(): Partial<EtatWizard> | null {
  if (typeof window === "undefined") return null;
  try {
    const brut = localStorage.getItem(CLE_BROUILLON);
    if (!brut) return null;
    const obj = JSON.parse(brut);
    if (obj?.version !== 2) return null;
    return obj.etat as Partial<EtatWizard>;
  } catch {
    return null;
  }
}

function sauvegarderBrouillon(etat: EtatWizard, etape: number) {
  if (typeof window === "undefined") return;
  try {
    // Les fichiers File[] ne sont pas sérialisables → on les exclut
    const { fichiersSourcesProjet: _f, resultatPreanalyse: _r, champsPreremplis, ...reste } = etat;
    localStorage.setItem(CLE_BROUILLON, JSON.stringify({
      version: 2,
      saved_at: new Date().toISOString(),
      etape,
      etat: {
        ...reste,
        // Set n'est pas sérialisable → convertir en tableau
        champsPreremplis: Array.from(champsPreremplis),
      },
    }));
  } catch {
    /* ignoré */
  }
}

function supprimerBrouillon() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(CLE_BROUILLON);
}

/* ────────────────────────────────────────────────────────────
   HELPERS
────────────────────────────────────────────────────────────── */
function nomSansExtension(nom: string): string {
  return nom.replace(/\.[^/.]+$/, "").trim();
}

function nettoyerNomDocument(nom: string): string {
  return nomSansExtension(nom)
    .replace(/[_-]+/g, " ")
    .replace(/\b(?:v(?:ersion)?|rev(?:ision)?)\s*[a-z0-9]{1,3}\b/gi, " ")
    .replace(/\b(?:finale?|definitif|definitive|copie|scan(?:ne)?|signed)\b/gi, " ")
    .replace(/\b20\d{2}[\s._-]?\d{2}[\s._-]?\d{2}\b/g, " ")
    .replace(/\s+/g, " ")
    .trim() || "document importe";
}

function estArchiveZip(fichier: File): boolean {
  return fichier.name.toLowerCase().endsWith(".zip") || fichier.type === "application/zip";
}

function intituleDocumentSource(fichier: File): string {
  const n = nettoyerNomDocument(fichier.name);
  return n.charAt(0).toUpperCase() + n.slice(1);
}

function referenceDocumentSource(referenceProjet: string, fichier: File, index: number): string {
  const base = nettoyerNomDocument(fichier.name)
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    .toUpperCase().slice(0, 40);
  return `${referenceProjet}-SRC-${String(index + 1).padStart(2, "0")}${base ? `-${base}` : ""}`.slice(0, 100);
}

function dedoublonnerFichiers(courants: File[], ajouts: File[]): File[] {
  const suivants = [...courants];
  for (const f of ajouts) {
    if (!suivants.some((e) => e.name === f.name && e.size === f.size && e.lastModified === f.lastModified)) {
      suivants.push(f);
    }
  }
  return suivants;
}

/* ────────────────────────────────────────────────────────────
   COMPOSANT PRINCIPAL
────────────────────────────────────────────────────────────── */
interface ProjetCree { id: string; reference: string; intitule: string; }

export function WizardCreationProjet() {
  const router = useRouter();
  const [etape, setEtape] = useState(0);
  const [etat, setEtat] = useState<EtatWizard>(etatInitial);
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [enSoumission, setEnSoumission] = useState(false);
  const [brouillonRestaure, setBrouillonRestaure] = useState(false);
  const [brouillonSavedAt, setBrouillonSavedAt] = useState<string | null>(null);
  const referenceInitialeRef = useRef(etat.reference);
  const preanalyseAppliqueeIdRef = useRef<string | null>(null);

  /* ── Modification d'un champ de l'état ── */
  const majChamp = useCallback(<K extends keyof EtatWizard>(champ: K, valeur: EtatWizard[K]) => {
    setEtat((prev) => ({ ...prev, [champ]: valeur }));
  }, []);

  /* ── Effacer un champ pré-rempli ── */
  const effacerChampExtrait = useCallback((champ: string) => {
    setEtat((prev) => {
      const s = new Set(prev.champsPreremplis);
      s.delete(champ);
      return { ...prev, champsPreremplis: s };
    });
  }, []);

  /* ── Organisations ── */
  const { data: organisations = [] } = useQuery<OrganisationOption[]>({
    queryKey: ["organisations"],
    queryFn: () => api.get<OrganisationOption[]>("/api/organisations/"),
    select: (data) => extraireListeResultats(data),
  });

  /* ── Parcours dynamique ── */
  const requeteParcours = useMemo(() => {
    const p = new URLSearchParams();
    if (etat.familleClientId) p.set("famille_client", etat.familleClientId);
    if (etat.sousTypeClientId) p.set("sous_type_client", etat.sousTypeClientId);
    if (etat.contexteContractuelId) p.set("contexte_contractuel", etat.contexteContractuelId);
    if (etat.phaseInterventionId) p.set("phase_intervention", etat.phaseInterventionId);
    for (const id of etat.missionsPrincipalesSelectionnees) p.append("missions_principales", id);
    p.set("nature_ouvrage", etat.natureOuvrage);
    p.set("nature_marche", etat.natureMarche);
    return p.toString();
  }, [
    etat.familleClientId, etat.sousTypeClientId, etat.contexteContractuelId,
    etat.phaseInterventionId, etat.missionsPrincipalesSelectionnees,
    etat.natureOuvrage, etat.natureMarche,
  ]);

  const { data: parcours = null } = useQuery<ParcoursProjet>({
    queryKey: ["projets-parcours", requeteParcours],
    queryFn: () => api.get<ParcoursProjet>(`/api/projets/parcours/?${requeteParcours}`),
    staleTime: 30_000,
  });

  /* ── Préanalyse sources — polling ── */
  const { data: tachePreanalyse } = useQuery<TachePreanalyseSources>({
    queryKey: ["projets-preanalyse-sources", etat.preanalyseSourcesId],
    queryFn: () => api.get<TachePreanalyseSources>(`/api/projets/preanalyse-sources/taches/${etat.preanalyseSourcesId}/`),
    enabled: Boolean(etat.preanalyseSourcesId),
    refetchInterval: (q) => {
      const d = q.state.data as TachePreanalyseSources | undefined;
      if (!d) return 1500;
      return d.statut === "en_attente" || d.statut === "en_cours" ? 1500 : false;
    },
  });

  /* ── Application du pré-remplissage après analyse ── */
  const appliquerPreRemplissage = useCallback((resultat: ResultatPreanalyseSources) => {
    setEtat((prev) => {
      const nouvellesPreremplies = new Set(prev.champsPreremplis);
      const updates: Partial<EtatWizard> = {};

      const pr = resultat.pre_remplissage;
      const champs = pr.champs;

      if (champs?.intitule?.valeur && !prev.intitule.trim()) {
        updates.intitule = String(champs.intitule.valeur);
        nouvellesPreremplies.add("intitule");
      } else if (pr.intitule && !prev.intitule.trim()) {
        updates.intitule = pr.intitule;
        nouvellesPreremplies.add("intitule");
      }

      if (champs?.commune?.valeur && !prev.commune.trim()) {
        updates.commune = String(champs.commune.valeur);
        nouvellesPreremplies.add("commune");
      }
      if (champs?.departement?.valeur && !prev.departement.trim()) {
        updates.departement = String(champs.departement.valeur);
        nouvellesPreremplies.add("departement");
      }
      if (champs?.montant_estime?.valeur !== undefined && !prev.montantEstime.trim()) {
        updates.montantEstime = String(champs.montant_estime.valeur);
        nouvellesPreremplies.add("montant_estime");
      }

      if (pr.methode_estimation && !prev.methodeEstimation) {
        updates.methodeEstimation = pr.methode_estimation;
      }

      // Données d'entrée métier
      const donneesAMerger: Record<string, ValeurChamp> = { ...pr.donnees_entree };
      if (Object.keys(donneesAMerger).length) {
        updates.donneesEntree = { ...donneesAMerger, ...prev.donneesEntree };
      }

      return {
        ...prev,
        ...updates,
        resultatPreanalyse: resultat,
        champsPreremplis: nouvellesPreremplies,
      };
    });
  }, []);

  useEffect(() => {
    if (!tachePreanalyse) return;
    if (tachePreanalyse.statut === "terminee" && tachePreanalyse.resultat) {
      if (preanalyseAppliqueeIdRef.current !== tachePreanalyse.id) {
        preanalyseAppliqueeIdRef.current = tachePreanalyse.id;
        appliquerPreRemplissage(tachePreanalyse.resultat);
      }
    }
    if (tachePreanalyse.statut === "echec") {
      setErreurs((prev) => ({ ...prev, analyse: tachePreanalyse.erreur || "Analyse impossible." }));
    }
  }, [tachePreanalyse, appliquerPreRemplissage]);

  /* ── Restauration brouillon ── */
  useEffect(() => {
    const b = lireBrouillon();
    if (!b) return;
    setEtat((prev) => ({
      ...prev,
      ...b,
      champsPreremplis: new Set(Array.isArray(b.champsPreremplis) ? (b.champsPreremplis as unknown as string[]) : []),
      fichiersSourcesProjet: [],
      resultatPreanalyse: null,
    }));
    const brut = localStorage.getItem(CLE_BROUILLON);
    if (brut) {
      try { setBrouillonSavedAt(JSON.parse(brut).saved_at); } catch { /**/ }
    }
    setBrouillonRestaure(true);
  }, []);

  /* ── Sauvegarde automatique du brouillon ── */
  useEffect(() => {
    if (enSoumission) return;
    const timer = window.setTimeout(() => {
      sauvegarderBrouillon(etat, etape);
      setBrouillonSavedAt(new Date().toISOString());
    }, 800);
    return () => window.clearTimeout(timer);
  }, [etat, etape, enSoumission]);

  /* ── Lancer l'analyse IA ── */
  async function lancerAnalyse(fichiers: File[]) {
    if (!fichiers.length) return;
    setErreurs((prev) => { const n = { ...prev }; delete n.analyse; return n; });
    try {
      const formData = new FormData();
      fichiers.forEach((f) => formData.append("fichiers", f));
      if (etat.familleClientId) formData.append("famille_client", etat.familleClientId);
      if (etat.contexteContractuelId) formData.append("contexte_contractuel", etat.contexteContractuelId);
      formData.append("nature_ouvrage", etat.natureOuvrage);
      formData.append("nature_marche", etat.natureMarche);

      const tache = await requeteApiAvecProgression<TachePreanalyseSources>(
        "/api/projets/preanalyse-sources/taches/",
        { method: "POST", corps: formData, onProgression: () => {} }
      );
      majChamp("preanalyseSourcesId", tache.id);
    } catch (err) {
      setErreurs((prev) => ({
        ...prev,
        analyse: err instanceof ErreurApi ? err.detail : "Analyse impossible.",
      }));
    }
  }

  /* ── Ajout/suppression de fichiers ── */
  const ajouterFichiers = useCallback((nouveaux: File[]) => {
    setEtat((prev) => ({
      ...prev,
      fichiersSourcesProjet: dedoublonnerFichiers(prev.fichiersSourcesProjet, nouveaux),
      preanalyseSourcesId: null,
      resultatPreanalyse: null,
      champsPreremplis: new Set<string>(),
    }));
    preanalyseAppliqueeIdRef.current = null;
  }, []);

  const retirerFichier = useCallback((index: number) => {
    setEtat((prev) => ({
      ...prev,
      fichiersSourcesProjet: prev.fichiersSourcesProjet.filter((_, i) => i !== index),
      preanalyseSourcesId: null,
      resultatPreanalyse: null,
      champsPreremplis: new Set<string>(),
    }));
    preanalyseAppliqueeIdRef.current = null;
  }, []);

  /* ── Validation par étape ── */
  function validerEtape(index: number): boolean {
    const nouvellesErreurs: Record<string, string> = {};

    if (index === 0) {
      if (!etat.familleClientId) nouvellesErreurs.famille_client = "Famille client obligatoire.";
      if (!etat.contexteContractuelId) nouvellesErreurs.contexte_contractuel = "Contexte contractuel obligatoire.";
      if (etat.missionsPrincipalesSelectionnees.length === 0) {
        nouvellesErreurs.missions_principales = "Sélectionnez au moins une mission.";
      }
    }
    if (index === 1) {
      if (!etat.reference.trim()) nouvellesErreurs.reference = "Référence obligatoire.";
      if (!etat.intitule.trim()) nouvellesErreurs.intitule = "Intitulé obligatoire.";
    }

    setErreurs(nouvellesErreurs);
    return Object.keys(nouvellesErreurs).length === 0;
  }

  function aller(cible: number) {
    if (cible > etape && !validerEtape(etape)) return;
    setErreurs({});
    setEtape(cible);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ── Création du projet ── */
  const { mutateAsync } = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post<ProjetCree>("/api/projets/", payload),
  });

  async function televerserFichiers(projet: ProjetCree) {
    for (const [i, fichier] of etat.fichiersSourcesProjet.entries()) {
      const formData = new FormData();
      if (estArchiveZip(fichier)) {
        formData.append("fichier", fichier);
        formData.append("projet", projet.id);
        await requeteApiAvecProgression("/api/documents/importer-archive/", {
          method: "POST", corps: formData, onProgression: () => {},
        });
      } else {
        formData.append("fichier", fichier);
        formData.append("projet", projet.id);
        formData.append("reference", referenceDocumentSource(projet.reference, fichier, i));
        formData.append("intitule", intituleDocumentSource(fichier));
        await requeteApiAvecProgression("/api/documents/", {
          method: "POST", corps: formData, onProgression: () => {},
        });
      }
    }
  }

  async function creerProjet() {
    if (!validerEtape(etape)) return;
    setEnSoumission(true);
    try {
      const projet = await mutateAsync({
        reference: etat.reference,
        intitule: etat.intitule,
        type_projet: etat.typeProjet,
        type_projet_autre: etat.typeProjet === "autre" ? etat.typeProjetAutre : "",
        statut: etat.statut,
        organisation: etat.organisationId || null,
        maitre_ouvrage: etat.maitreOuvrageId || null,
        maitre_oeuvre: etat.maitreOeuvreId || null,
        preanalyse_sources_id: etat.preanalyseSourcesId,
        contexte_projet_saisie: {
          famille_client: etat.familleClientId,
          sous_type_client: etat.sousTypeClientId,
          contexte_contractuel: etat.contexteContractuelId,
          missions_associees: etat.missionsPrincipalesSelectionnees,
          phase_intervention: etat.phaseInterventionId || null,
          sous_missions: etat.sousMissionsSelectionnees,
          nature_ouvrage: etat.natureOuvrage,
          nature_marche: etat.natureMarche,
          partie_contractante: etat.partieContractante,
          role_lbh: etat.roleLbh,
          methode_estimation: etat.methodeEstimation,
          donnees_entree: etat.donneesEntree,
          commune: etat.commune,
          departement: etat.departement,
          montant_estime: etat.montantEstime || null,
          date_debut_prevue: etat.dateDebutPrevue || null,
          date_fin_prevue: etat.dateFinPrevue || null,
          description: etat.description,
        },
        mode_variation_prix_saisie: etat.variationPrix,
      });

      // Téléverser les fichiers sources si pas déjà analysés via Celery
      if (etat.fichiersSourcesProjet.length && !etat.preanalyseSourcesId) {
        await televerserFichiers(projet);
      }

      supprimerBrouillon();
      router.push(`/projets/${projet.id}`);
    } catch (err) {
      if (err instanceof ErreurApi && err.erreurs) {
        const nouvellesErreurs: Record<string, string> = {};
        Object.entries(err.erreurs).forEach(([champ, msgs]) => {
          if (Array.isArray(msgs)) nouvellesErreurs[champ] = msgs[0];
        });
        setErreurs(nouvellesErreurs);
      } else {
        setErreurs({ formulaire: err instanceof Error ? err.message : "Création du projet impossible." });
      }
    } finally {
      setEnSoumission(false);
    }
  }

  /* ── UI ── */
  const horodatageBrouillon = brouillonSavedAt
    ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(brouillonSavedAt))
    : null;

  return (
    <div className="min-h-screen" style={{ background: "var(--fond-app)" }}>
      <div className="max-w-4xl mx-auto px-4 py-8">

        {/* En-tête */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold" style={{ color: "var(--texte)" }}>
            Nouveau projet
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--texte-2)" }}>
            Créez une fiche projet complète en quelques étapes
          </p>
        </div>

        {/* Bandeau brouillon restauré */}
        {brouillonRestaure && (
          <div
            className="mb-6 rounded-xl px-4 py-3 flex items-center gap-3 text-sm"
            style={{ background: "var(--c-leger)", border: "1px solid var(--c-clair)", color: "var(--c-base)" }}
          >
            <Save size={15} />
            <span>
              Brouillon restauré automatiquement
              {horodatageBrouillon && ` — sauvegardé le ${horodatageBrouillon}`}
            </span>
            <button
              type="button"
              className="ml-auto text-xs underline hover:no-underline"
              onClick={() => {
                supprimerBrouillon();
                setEtat(etatInitial());
                setEtape(0);
                setErreurs({});
                setBrouillonRestaure(false);
              }}
            >
              Recommencer à zéro
            </button>
          </div>
        )}

        {/* Indicateur d'étapes */}
        <div className="mb-8">
          <IndicateurEtapes
            etapes={ETAPES_WIZARD}
            etapeCourante={etape}
            onNaviguer={(i) => i < etape && setEtape(i)}
          />
        </div>

        {/* Erreur globale */}
        {erreurs.formulaire && (
          <div
            className="mb-6 rounded-xl px-4 py-3 flex items-center gap-3 text-sm"
            style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444" }}
          >
            <AlertCircle size={15} />
            {erreurs.formulaire}
          </div>
        )}

        {/* Carte principale */}
        <div
          className="rounded-2xl p-6 sm:p-8"
          style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)", boxShadow: "var(--ombre-carte)" }}
        >
          {/* Titre de l'étape */}
          <div className="mb-6 pb-4" style={{ borderBottom: "1px solid var(--bordure)" }}>
            <h2 className="text-lg font-semibold" style={{ color: "var(--texte)" }}>
              {ETAPES_WIZARD[etape].titre}
            </h2>
            <p className="text-sm mt-0.5" style={{ color: "var(--texte-2)" }}>
              {ETAPES_WIZARD[etape].description}
            </p>
          </div>

          {/* Contenu de l'étape */}
          {etape === 0 && (
            <EtapeContexte
              etat={etat}
              parcours={parcours ?? undefined}
              chargement={!parcours}
              erreurs={erreurs}
              onChangeFamilleClient={(id) => majChamp("familleClientId", id)}
              onChangeSousTypeClient={(id) => majChamp("sousTypeClientId", id)}
              onChangeContexteContractuel={(id) => majChamp("contexteContractuelId", id)}
              onChangeMissions={(ids) => majChamp("missionsPrincipalesSelectionnees", ids)}
              onChangePhaseIntervention={(id) => majChamp("phaseInterventionId", id)}
              onChangeNatureOuvrage={(v) => majChamp("natureOuvrage", v)}
              onChangeNatureMarche={(v) => majChamp("natureMarche", v)}
            />
          )}
          {etape === 1 && (
            <EtapeIdentification
              etat={etat}
              organisations={organisations}
              erreurs={erreurs}
              onChange={majChamp}
              onEffacerChampExtrait={effacerChampExtrait}
            />
          )}
          {etape === 2 && (
            <EtapeAnalyse
              etat={etat}
              parcours={parcours ?? undefined}
              tacheAnalyse={tachePreanalyse ?? null}
              analyseEnCours={Boolean(
                etat.preanalyseSourcesId &&
                tachePreanalyse?.statut !== "terminee" &&
                tachePreanalyse?.statut !== "echec"
              )}
              onAjouterFichiers={ajouterFichiers}
              onSupprimerFichier={retirerFichier}
              onLancerAnalyse={() => lancerAnalyse(etat.fichiersSourcesProjet)}
              onAppliquerChamp={(champ, valeur) => {
                majChamp(champ as keyof EtatWizard, valeur as EtatWizard[keyof EtatWizard]);
                setEtat((prev) => {
                  const s = new Set(prev.champsPreremplis);
                  s.add(champ);
                  return { ...prev, champsPreremplis: s };
                });
              }}
            />
          )}
          {etape === 3 && (
            <EtapeMissions
              etat={etat}
              parcours={parcours}
              onChange={majChamp}
            />
          )}
          {etape === 4 && (
            <EtapeRecapitulatif
              etat={etat}
              parcours={parcours}
              erreurs={erreurs}
              enSoumission={enSoumission}
              onSoumettre={creerProjet}
            />
          )}
        </div>

        {/* Navigation */}
        <div className="mt-6 flex items-center justify-between gap-4">
          {/* Sauvegarde automatique */}
          <span className="text-xs" style={{ color: "var(--texte-3)" }}>
            {horodatageBrouillon ? `Brouillon : ${horodatageBrouillon}` : "Brouillon non sauvegardé"}
          </span>

          <div className="flex gap-3">
            {etape > 0 && (
              <button
                type="button"
                onClick={() => aller(etape - 1)}
                disabled={enSoumission}
                className="px-5 py-2.5 rounded-xl text-sm font-medium border transition-all disabled:opacity-50"
                style={{
                  borderColor: "var(--bordure)",
                  background: "var(--fond-carte)",
                  color: "var(--texte)",
                }}
              >
                Précédent
              </button>
            )}
            {etape < ETAPES_WIZARD.length - 1 && (
              <button
                type="button"
                onClick={() => aller(etape + 1)}
                disabled={enSoumission}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 hover:opacity-90"
                style={{ background: "var(--c-base)" }}
              >
                Suivant
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
