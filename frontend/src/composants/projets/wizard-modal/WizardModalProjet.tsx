"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { X, AlertCircle, Save } from "lucide-react";
import { api, ErreurApi, extraireListeResultats, requeteApiAvecProgression } from "@/crochets/useApi";
import { useNotifications } from "@/contextes/FournisseurNotifications";
import type { OrganisationOption } from "@/composants/projets/ChampOrganisationRapide";

import { ProgressionWizard } from "./ProgressionWizard";
import { EtapeTypeClient } from "./EtapeTypeClient";
import { EtapeContexteContractuel } from "./EtapeContexteContractuel";
import { EtapeIdentification } from "./EtapeIdentification";
import { EtapeMissionsLivrables } from "./EtapeMissionsLivrables";
import { EtapeSourcesAnalyse } from "./EtapeSourcesAnalyse";
import { EtapeDonneesEstimation } from "./EtapeDonneesEstimation";
import { EtapeRecapitulatifCreation } from "./EtapeRecapitulatifCreation";
import { ETAPES_WIZARD_MODAL, type EtatWizardModal, type TachePreanalyse, type ResultatPreanalyse } from "./types";

// ── Clé brouillon ─────────────────────────────────────────────────────────────

const CLE_BROUILLON = "lbh-wizard-modal-v1";

function genererReference() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function dateAujourdhuiIso() {
  return new Date().toISOString().slice(0, 10);
}

function etatInitial(): EtatWizardModal {
  return {
    familleClientId: "", sousTypeClientId: "",
    contexteContractuelId: "", natureOuvrage: "batiment", natureMarche: "public", roleLbh: "",
    reference: genererReference(), intitule: "", typeProjet: "etude", typeProjetAutre: "",
    statut: "en_cours", commune: "", departement: "",
    organisationId: "", maitreOuvrageId: "", maitreOeuvreId: "",
    missionsSelectionnees: [], phaseInterventionId: "",
    fichiersSourcesProjet: [], preanalyseSourcesId: null,
    resultatPreanalyse: null, champsPreremplis: new Set<string>(),
    montantEstime: "", dateDebutPrevue: dateAujourdhuiIso(), dateFinPrevue: "",
    description: "", methodeEstimation: "", donneesEntree: {},
    variationPrix: {
      type_evolution: "ferme", cadre_juridique: "", indice_reference: "",
      formule_personnalisee: "", date_prix_initial: "", date_remise_offre: "",
      date_demarrage: "", periodicite_revision: "", clause_applicable: "", part_fixe: "",
    },
  };
}

function lireBrouillon(): Partial<EtatWizardModal> | null {
  if (typeof window === "undefined") return null;
  try {
    const brut = localStorage.getItem(CLE_BROUILLON);
    if (!brut) return null;
    const obj = JSON.parse(brut);
    if (obj?.version !== 1) return null;
    return obj.etat as Partial<EtatWizardModal>;
  } catch { return null; }
}

function sauvegarderBrouillon(etat: EtatWizardModal, etape: number) {
  if (typeof window === "undefined") return;
  try {
    const { fichiersSourcesProjet: _f, resultatPreanalyse: _r, champsPreremplis, ...reste } = etat;
    localStorage.setItem(CLE_BROUILLON, JSON.stringify({
      version: 1, saved_at: new Date().toISOString(), etape,
      etat: { ...reste, champsPreremplis: Array.from(champsPreremplis) },
    }));
  } catch { /* ignoré */ }
}

function supprimerBrouillon() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(CLE_BROUILLON);
}

function nettoyerNomDocument(nom: string): string {
  return nom.replace(/\.[^/.]+$/, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim() || "document";
}

function dedoublonnerFichiers(courants: File[], ajouts: File[]): File[] {
  const suivants = [...courants];
  for (const f of ajouts) {
    if (!suivants.some((e) => e.name === f.name && e.size === f.size)) suivants.push(f);
  }
  return suivants;
}

// ── Composant principal ───────────────────────────────────────────────────────

interface ProjetCree { id: string; reference: string; intitule: string; }

interface WizardModalProjetProps {
  ouvert: boolean;
  onFermer: () => void;
}

export function WizardModalProjet({ ouvert, onFermer }: WizardModalProjetProps) {
  const router = useRouter();
  const notifications = useNotifications();
  const [etape, setEtape] = useState(0);
  const [etat, setEtat] = useState<EtatWizardModal>(etatInitial);
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [enSoumission, setEnSoumission] = useState(false);
  const [etapesValidees, setEtapesValidees] = useState<Set<number>>(new Set());
  const [brouillonRestauré, setBrouillonRestauré] = useState(false);
  const [horodatageSauvegarde, setHorodatageSauvegarde] = useState<string | null>(null);
  const preanalyseAppliqueeRef = useRef<string | null>(null);
  const contenuRef = useRef<HTMLDivElement>(null);

  const majChamp = useCallback(<K extends keyof EtatWizardModal>(champ: K, valeur: EtatWizardModal[K]) => {
    setEtat((prev) => ({ ...prev, [champ]: valeur }));
  }, []);

  const effacerChampExtrait = useCallback((champ: string) => {
    setEtat((prev) => {
      const s = new Set(prev.champsPreremplis);
      s.delete(champ);
      return { ...prev, champsPreremplis: s };
    });
  }, []);

  // ── Organisations ──
  const { data: organisations = [] } = useQuery<OrganisationOption[]>({
    queryKey: ["organisations"],
    queryFn: () => api.get<OrganisationOption[]>("/api/organisations/"),
    select: (data) => extraireListeResultats(data),
    enabled: ouvert,
  });

  // ── Polling préanalyse ──
  const { data: tachePreanalyse } = useQuery<TachePreanalyse>({
    queryKey: ["wizard-preanalyse", etat.preanalyseSourcesId],
    queryFn: () => api.get<TachePreanalyse>(`/api/projets/preanalyse-sources/taches/${etat.preanalyseSourcesId}/`),
    enabled: Boolean(etat.preanalyseSourcesId) && ouvert,
    refetchInterval: (q) => {
      const d = q.state.data as TachePreanalyse | undefined;
      if (!d) return 1500;
      return d.statut === "en_attente" || d.statut === "en_cours" ? 1500 : false;
    },
  });

  // ── Application pré-remplissage ──
  const appliquerPreRemplissage = useCallback((resultat: ResultatPreanalyse) => {
    setEtat((prev) => {
      const nouvelles = new Set(prev.champsPreremplis);
      const updates: Partial<EtatWizardModal> = {};
      const champs = resultat.pre_remplissage?.champs;
      if (champs?.intitule?.valeur && !prev.intitule.trim()) {
        updates.intitule = String(champs.intitule.valeur);
        nouvelles.add("intitule");
      }
      if (champs?.commune?.valeur && !prev.commune.trim()) {
        updates.commune = String(champs.commune.valeur);
        nouvelles.add("commune");
      }
      if (champs?.departement?.valeur && !prev.departement.trim()) {
        updates.departement = String(champs.departement.valeur);
        nouvelles.add("departement");
      }
      if (champs?.montant_estime?.valeur !== undefined && !prev.montantEstime.trim()) {
        updates.montantEstime = String(champs.montant_estime.valeur);
        nouvelles.add("montant_estime");
      }
      if (resultat.pre_remplissage?.description_detectee && !prev.description.trim()) {
        updates.description = resultat.pre_remplissage.description_detectee;
      }
      return { ...prev, ...updates, resultatPreanalyse: resultat, champsPreremplis: nouvelles };
    });
  }, []);

  useEffect(() => {
    if (!tachePreanalyse) return;
    if (tachePreanalyse.statut === "terminee" && tachePreanalyse.resultat) {
      if (preanalyseAppliqueeRef.current !== tachePreanalyse.id) {
        preanalyseAppliqueeRef.current = tachePreanalyse.id;
        appliquerPreRemplissage(tachePreanalyse.resultat);
      }
    }
    if (tachePreanalyse.statut === "echec") {
      setErreurs((prev) => ({ ...prev, analyse: tachePreanalyse.erreur || "Analyse impossible." }));
    }
  }, [tachePreanalyse, appliquerPreRemplissage]);

  // ── Restauration brouillon ──
  useEffect(() => {
    if (!ouvert) return;
    const b = lireBrouillon();
    if (!b) return;
    setEtat((prev) => ({
      ...prev, ...b,
      champsPreremplis: new Set(Array.isArray(b.champsPreremplis) ? (b.champsPreremplis as unknown as string[]) : []),
      fichiersSourcesProjet: [], resultatPreanalyse: null,
    }));
    const brut = localStorage.getItem(CLE_BROUILLON);
    if (brut) {
      try {
        const parsed = JSON.parse(brut);
        setHorodatageSauvegarde(parsed.saved_at);
        if (typeof parsed.etape === "number") {
          setEtape(parsed.etape);
          // Marquer les étapes précédentes comme validées
          setEtapesValidees(new Set(Array.from({ length: parsed.etape }, (_, i) => i)));
        }
      } catch { /**/ }
    }
    setBrouillonRestauré(true);
  }, [ouvert]);

  // ── Sauvegarde automatique ──
  useEffect(() => {
    if (!ouvert || enSoumission) return;
    const timer = window.setTimeout(() => {
      sauvegarderBrouillon(etat, etape);
      setHorodatageSauvegarde(new Date().toISOString());
    }, 800);
    return () => window.clearTimeout(timer);
  }, [etat, etape, enSoumission, ouvert]);

  // ── Scroll en haut à chaque changement d'étape ──
  useEffect(() => {
    contenuRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [etape]);

  // ── Lancer analyse ──
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
      const tache = await requeteApiAvecProgression<TachePreanalyse>(
        "/api/projets/preanalyse-sources/taches/",
        { method: "POST", corps: formData, onProgression: () => {} }
      );
      majChamp("preanalyseSourcesId", tache.id);
    } catch (err) {
      setErreurs((prev) => ({ ...prev, analyse: err instanceof ErreurApi ? err.detail : "Analyse impossible." }));
    }
  }

  const ajouterFichiers = useCallback((nouveaux: File[]) => {
    setEtat((prev) => ({
      ...prev,
      fichiersSourcesProjet: dedoublonnerFichiers(prev.fichiersSourcesProjet, nouveaux),
      preanalyseSourcesId: null, resultatPreanalyse: null, champsPreremplis: new Set<string>(),
    }));
    preanalyseAppliqueeRef.current = null;
  }, []);

  const retirerFichier = useCallback((index: number) => {
    setEtat((prev) => ({
      ...prev,
      fichiersSourcesProjet: prev.fichiersSourcesProjet.filter((_, i) => i !== index),
      preanalyseSourcesId: null, resultatPreanalyse: null, champsPreremplis: new Set<string>(),
    }));
    preanalyseAppliqueeRef.current = null;
  }, []);

  // ── Validation étape ──
  function validerEtape(index: number): boolean {
    const nouvellesErreurs: Record<string, string> = {};
    if (index === 0) {
      if (!etat.familleClientId) nouvellesErreurs.famille_client = "Sélectionnez un type de client.";
    }
    if (index === 1) {
      if (!etat.contexteContractuelId) nouvellesErreurs.contexte_contractuel = "Sélectionnez un contexte contractuel.";
    }
    if (index === 2) {
      if (!etat.reference.trim()) nouvellesErreurs.reference = "Référence obligatoire.";
      if (!etat.intitule.trim()) nouvellesErreurs.intitule = "Intitulé obligatoire.";
    }
    setErreurs(nouvellesErreurs);
    return Object.keys(nouvellesErreurs).length === 0;
  }

  function aller(cible: number) {
    if (cible > etape && !validerEtape(etape)) return;
    setEtapesValidees((prev) => { const n = new Set(prev); n.add(etape); return n; });
    setErreurs({});
    setEtape(cible);
  }

  // ── Création projet ──
  const { mutateAsync } = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post<ProjetCree>("/api/projets/", payload),
  });

  async function televerserFichiers(projet: ProjetCree) {
    for (const [i, fichier] of etat.fichiersSourcesProjet.entries()) {
      const formData = new FormData();
      const estZip = fichier.name.toLowerCase().endsWith(".zip");
      formData.append("fichier", fichier);
      formData.append("projet", projet.id);
      if (!estZip) {
        formData.append("reference", `${projet.reference}-SRC-${String(i + 1).padStart(2, "0")}`);
        formData.append("intitule", nettoyerNomDocument(fichier.name).replace(/^./, (c) => c.toUpperCase()));
      }
      await requeteApiAvecProgression(
        estZip ? "/api/documents/importer-archive/" : "/api/documents/",
        { method: "POST", corps: formData, onProgression: () => {} }
      );
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
          missions_associees: etat.missionsSelectionnees.map((m) => m.missionCode),
          livrables_selectionnes: etat.missionsSelectionnees.flatMap((m) => m.livrablesCodes),
          phase_intervention: etat.phaseInterventionId || null,
          nature_ouvrage: etat.natureOuvrage,
          nature_marche: etat.natureMarche,
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

      if (etat.fichiersSourcesProjet.length && !etat.preanalyseSourcesId) {
        await televerserFichiers(projet);
      }

      // Initialiser les statuts de livrables sélectionnés
      if (etat.missionsSelectionnees.length > 0) {
        const statutsInitiaux: Record<string, string> = {};
        etat.missionsSelectionnees.forEach((m) => {
          m.livrablesCodes.forEach((lcode) => {
            statutsInitiaux[`${m.missionCode}:${lcode}`] = "en_attente";
          });
        });
        await api.patch(`/api/projets/${projet.id}/statuts-livrables/`, statutsInitiaux);
      }

      supprimerBrouillon();
      notifications.succes(`Projet ${projet.reference} créé.`);
      onFermer();
      router.push(`/projets/${projet.id}`);
    } catch (err) {
      if (err instanceof ErreurApi && err.erreurs) {
        const e: Record<string, string> = {};
        Object.entries(err.erreurs).forEach(([champ, msgs]) => {
          if (Array.isArray(msgs)) e[champ] = msgs[0];
        });
        setErreurs(e);
      } else {
        setErreurs({ formulaire: err instanceof Error ? err.message : "Création impossible." });
      }
      setEtape(6); // Retourner au récapitulatif avec l'erreur
    } finally {
      setEnSoumission(false);
    }
  }

  // ── Horodatage brouillon ──
  const horodatageAff = horodatageSauvegarde
    ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(horodatageSauvegarde))
    : null;

  const analyseEnCours = Boolean(
    etat.preanalyseSourcesId &&
    tachePreanalyse?.statut !== "terminee" &&
    tachePreanalyse?.statut !== "echec"
  );

  if (!ouvert) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 backdrop-blur-sm"
        style={{ background: "rgba(0,0,0,0.55)" }}
        onClick={() => !enSoumission && onFermer()}
      />

      {/* Modal */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
        style={{ pointerEvents: "none" }}
      >
        <div
          className="relative flex w-full max-w-5xl overflow-hidden rounded-3xl shadow-2xl"
          style={{
            background: "var(--fond-app)",
            border: "1px solid var(--bordure)",
            maxHeight: "calc(100vh - 2rem)",
            pointerEvents: "auto",
          }}
        >
          {/* Sidebar de progression */}
          <aside
            className="hidden lg:flex flex-col w-56 shrink-0 border-r"
            style={{
              background: "var(--fond-carte)",
              borderColor: "var(--bordure)",
            }}
          >
            {/* Logo / titre */}
            <div className="px-4 pt-5 pb-3" style={{ borderBottom: "1px solid var(--bordure)" }}>
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--c-base)" }}>
                Nouveau projet
              </p>
              <p className="text-[10px] mt-0.5" style={{ color: "var(--texte-3)" }}>
                {ETAPES_WIZARD_MODAL.length} étapes
              </p>
            </div>
            <div className="flex-1 overflow-y-auto">
              <ProgressionWizard
                etapes={ETAPES_WIZARD_MODAL}
                etapeCourante={etape}
                etapesValidees={etapesValidees}
                onNaviguer={(i) => i < etape && setEtape(i)}
              />
            </div>
            {/* Indicateur brouillon */}
            <div className="px-4 py-3 border-t" style={{ borderColor: "var(--bordure)" }}>
              <div className="flex items-center gap-1.5">
                <Save size={10} style={{ color: "var(--texte-3)" }} />
                <span className="text-[10px]" style={{ color: "var(--texte-3)" }}>
                  {horodatageAff ? `Brouillon : ${horodatageAff}` : "Non sauvegardé"}
                </span>
              </div>
            </div>
          </aside>

          {/* Zone contenu */}
          <div className="flex flex-1 min-w-0 flex-col overflow-hidden">
            {/* En-tête modal */}
            <div
              className="flex items-center justify-between gap-3 px-5 py-4 shrink-0"
              style={{ background: "var(--fond-carte)", borderBottom: "1px solid var(--bordure)" }}
            >
              <div className="min-w-0">
                {/* Indicateur mobile */}
                <p className="text-xs font-semibold lg:hidden" style={{ color: "var(--texte-3)" }}>
                  Étape {etape + 1} / {ETAPES_WIZARD_MODAL.length}
                </p>
                <h2 className="text-base font-bold truncate" style={{ color: "var(--texte)" }}>
                  {ETAPES_WIZARD_MODAL[etape].titre}
                </h2>
                <p className="text-xs mt-0.5" style={{ color: "var(--texte-2)" }}>
                  {ETAPES_WIZARD_MODAL[etape].description}
                </p>
              </div>

              {/* Barre de progression mobile */}
              <div className="hidden sm:flex lg:hidden items-center gap-1 shrink-0">
                {ETAPES_WIZARD_MODAL.map((_, i) => (
                  <div
                    key={i}
                    className="h-1.5 rounded-full transition-all"
                    style={{
                      width: i === etape ? "20px" : "6px",
                      background: i <= etape ? "var(--c-base)" : "var(--bordure)",
                    }}
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={() => !enSoumission && onFermer()}
                disabled={enSoumission}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl hover:bg-[color:var(--fond-entree)] transition-colors disabled:opacity-50"
                style={{ color: "var(--texte-3)" }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Contenu scrollable */}
            <div ref={contenuRef} className="flex-1 overflow-y-auto px-5 py-6">
              {/* Bandeau brouillon restauré */}
              {brouillonRestauré && (
                <div
                  className="mb-5 rounded-xl px-4 py-3 flex items-center gap-3 text-xs"
                  style={{ background: "var(--c-leger)", border: "1px solid var(--c-clair)", color: "var(--c-base)" }}
                >
                  <Save size={13} />
                  <span>Brouillon restauré{horodatageAff ? ` (${horodatageAff})` : ""}</span>
                  <button
                    type="button"
                    className="ml-auto underline hover:no-underline"
                    onClick={() => {
                      supprimerBrouillon();
                      setEtat(etatInitial());
                      setEtape(0);
                      setEtapesValidees(new Set());
                      setErreurs({});
                      setBrouillonRestauré(false);
                    }}
                  >
                    Recommencer
                  </button>
                </div>
              )}

              {/* Erreur globale */}
              {erreurs.formulaire && (
                <div
                  className="mb-5 flex items-center gap-2 rounded-xl px-4 py-3 text-sm"
                  style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444" }}
                >
                  <AlertCircle size={15} />
                  {erreurs.formulaire}
                </div>
              )}

              {/* Étape courante */}
              {etape === 0 && (
                <EtapeTypeClient etat={etat} erreurs={erreurs} onChange={majChamp} />
              )}
              {etape === 1 && (
                <EtapeContexteContractuel etat={etat} erreurs={erreurs} onChange={majChamp} />
              )}
              {etape === 2 && (
                <EtapeIdentification
                  etat={etat}
                  organisations={organisations}
                  erreurs={erreurs}
                  onChange={majChamp}
                  onEffacerChampExtrait={effacerChampExtrait}
                />
              )}
              {etape === 3 && (
                <EtapeMissionsLivrables etat={etat} erreurs={erreurs} onChange={majChamp} />
              )}
              {etape === 4 && (
                <EtapeSourcesAnalyse
                  etat={etat}
                  tacheAnalyse={tachePreanalyse ?? null}
                  analyseEnCours={analyseEnCours}
                  erreurs={erreurs}
                  onChange={majChamp}
                  onAjouterFichiers={ajouterFichiers}
                  onSupprimerFichier={retirerFichier}
                  onLancerAnalyse={() => lancerAnalyse(etat.fichiersSourcesProjet)}
                />
              )}
              {etape === 5 && (
                <EtapeDonneesEstimation
                  etat={etat}
                  erreurs={erreurs}
                  onChange={majChamp}
                  onEffacerChampExtrait={effacerChampExtrait}
                />
              )}
              {etape === 6 && (
                <EtapeRecapitulatifCreation
                  etat={etat}
                  enSoumission={enSoumission}
                  erreurs={erreurs}
                  onSoumettre={creerProjet}
                />
              )}
            </div>

            {/* Pied de navigation */}
            <div
              className="flex items-center justify-between gap-3 px-5 py-4 shrink-0"
              style={{ background: "var(--fond-carte)", borderTop: "1px solid var(--bordure)" }}
            >
              <button
                type="button"
                onClick={() => etape > 0 && aller(etape - 1)}
                disabled={etape === 0 || enSoumission}
                className="rounded-xl border px-5 py-2.5 text-sm font-medium transition-all disabled:opacity-40"
                style={{ borderColor: "var(--bordure)", background: "var(--fond-carte)", color: "var(--texte)" }}
              >
                Précédent
              </button>

              <span className="text-xs hidden sm:block" style={{ color: "var(--texte-3)" }}>
                {etape + 1} / {ETAPES_WIZARD_MODAL.length}
              </span>

              {etape < ETAPES_WIZARD_MODAL.length - 1 ? (
                <button
                  type="button"
                  onClick={() => aller(etape + 1)}
                  disabled={enSoumission}
                  className="rounded-xl px-6 py-2.5 text-sm font-semibold text-white transition-all disabled:opacity-50 hover:opacity-90"
                  style={{ background: "var(--c-base)" }}
                >
                  Suivant
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
