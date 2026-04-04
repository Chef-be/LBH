"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  BriefcaseBusiness,
  Calculator,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Save,
  UserRoundCog,
} from "lucide-react";
import { api, ErreurApi, extraireListeResultats } from "@/crochets/useApi";

interface ProfilMainOeuvre {
  id: string;
  code: string;
  libelle: string;
  categorie: string;
  categorie_libelle: string;
  secteur_activite: string;
  secteur_activite_libelle: string;
  metier: string;
  specialite: string;
  niveau_classification: string;
  fonction_equipe: string;
  description_emploi: string;
  source_officielle: string;
  localisation: string;
  convention_collective_libelle: string;
  regle_conventionnelle_libelle: string;
  salaire_brut_minimum_conventionnel: number | null;
  salaire_brut_mensuel_defaut: number;
  primes_mensuelles_defaut: number;
  avantages_mensuels_defaut: number;
  heures_contractuelles_mensuelles: number;
  heures_par_jour: number;
  heures_contractuelles_mensuelles_defaut: number;
  heures_par_jour_defaut: number;
  taux_charges_salariales: number;
  taux_charges_patronales: number;
  taux_absenteisme: number;
  taux_temps_improductif: number;
  taux_absenteisme_defaut: number;
  taux_temps_improductif_defaut: number;
  taux_frais_agence: number;
  taux_risque_operationnel: number;
  taux_marge_cible: number;
  mutuelle_employeur_mensuelle_defaut: number;
  titres_restaurant_employeur_mensuels_defaut: number;
  prime_transport_mensuelle_defaut: number;
  cout_recrutement_initial_defaut: number;
  taux_horaire_recommande_defaut: number | null;
  cout_equipement_mensuel: number;
  cout_transport_mensuel: number;
  cout_structure_mensuel: number;
}

interface ProjetResume {
  id: string;
  reference: string;
  intitule: string;
}

interface SimulationMainOeuvre {
  clientele_libelle: string;
  profil_libelle: string;
  convention_collective_libelle: string;
  regle_conventionnelle_libelle: string;
  variante_locale_regle_libelle: string;
  reference_sociale_localisation_libelle: string;
  localisation_libelle: string;
  bulletin: Record<string, number>;
  production: Record<string, number>;
  coefficients: Record<string, number>;
  resultats: Record<string, number>;
  projection_annuelle: Record<string, number>;
  hypotheses_reglementaires: Record<string, string | number | boolean>;
  avertissements: string[];
}

interface DefautsSimulationProfil {
  statut_cadre: boolean;
  salaire_brut_mensuel: string | number;
  primes_mensuelles: string | number;
  avantages_mensuels: string | number;
  heures_contractuelles_mensuelles: string | number;
  heures_par_jour: string | number;
  taux_charges_salariales: string | number;
  taux_charges_patronales: string | number;
  taux_absenteisme: string | number;
  taux_temps_improductif: string | number;
  mutuelle_employeur_mensuelle: string | number;
  titres_restaurant_employeur_mensuels: string | number;
  prime_transport_mensuelle: string | number;
  cout_equipement_mensuel: string | number;
  cout_transport_mensuel: string | number;
  cout_structure_mensuel: string | number;
  taux_occupation_facturable: string | number;
  cout_recrutement_initial: string | number;
}

const ETAPES = [
  {
    cle: "profil",
    titre: "Contexte de facturation",
    question: "Pour quel profil et quel type de mission souhaitez-vous calculer un taux exploitable ?",
  },
  {
    cle: "remuneration",
    titre: "Rémunération réelle",
    question: "Quelle rémunération mensuelle complète faut-il retenir pour ce profil ?",
  },
  {
    cle: "contrat",
    titre: "Contrat et compléments",
    question: "Quels éléments employeur faut-il intégrer au-delà du brut : cadre, CDD, mutuelle, titres-restaurant, transport, heures supplémentaires ?",
  },
  {
    cle: "production",
    titre: "Temps réellement productif",
    question: "Combien d'heures facturables restent réellement une fois l'absentéisme et le temps improductif pris en compte ?",
  },
  {
    cle: "structure",
    titre: "Structure, risque et marge",
    question: "Quels frais de structure, aléas et marges faut-il intégrer pour obtenir un taux vendable ?",
  },
  {
    cle: "projection",
    titre: "Projection annuelle",
    question: "Quel niveau d'activité, de recrutement initial et de chiffre d'affaires faut-il viser sur l'année ?",
  },
] as const;

function formatMontant(valeur?: number, decimales = 2) {
  if (valeur === null || valeur === undefined || Number.isNaN(valeur)) return "—";
  return `${valeur.toLocaleString("fr-FR", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  })} €`;
}

function formatPourcentage(valeur?: number) {
  if (valeur === null || valeur === undefined || Number.isNaN(valeur)) return "—";
  return `${(valeur * 100).toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} %`;
}

function formatNombre(valeur?: number, decimales = 2, suffixe = "") {
  if (valeur === null || valeur === undefined || Number.isNaN(valeur)) return "—";
  return `${valeur.toLocaleString("fr-FR", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  })}${suffixe}`;
}

function telechargerBlob(blob: Blob, nomFichier: string) {
  const url = window.URL.createObjectURL(blob);
  const lien = document.createElement("a");
  lien.href = url;
  lien.download = nomFichier;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  window.URL.revokeObjectURL(url);
}

function toInputNumber(valeur: number) {
  return valeur.toString().replace(".", ",");
}

function versNombre(valeur: string | number | null | undefined, defaut = 0) {
  const nombre = Number(valeur);
  return Number.isFinite(nombre) ? nombre : defaut;
}

function normaliserNombre(valeur: string) {
  return valeur.replace(",", ".");
}

export default function PageSimulateurMainOeuvre() {
  const searchParams = useSearchParams();
  const projetId = searchParams.get("projet");

  const [etapeActive, setEtapeActive] = useState(0);
  const [profils, setProfils] = useState<ProfilMainOeuvre[]>([]);
  const [profilId, setProfilId] = useState("");
  const [projet, setProjet] = useState<ProjetResume | null>(null);
  const [simulation, setSimulation] = useState<SimulationMainOeuvre | null>(null);
  const [chargementSimulation, setChargementSimulation] = useState(false);
  const [telechargement, setTelechargement] = useState(false);
  const [enregistrement, setEnregistrement] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const [formulaire, setFormulaire] = useState({
    clientele: "public",
    localisation: "mayotte",
    mode_facturation: "journalier",
    contrat_travail: "cdi",
    statut_cadre: "0",
    quotite_travail: "1",
    charge_previsionnelle_jours: "20",
    salaire_brut_mensuel: "",
    primes_mensuelles: "0",
    avantages_mensuels: "0",
    heures_supplementaires_mensuelles: "0",
    majoration_heures_supplementaires: "0.25",
    heures_contractuelles_mensuelles: "151.67",
    heures_par_jour: "7",
    taux_charges_salariales: "0.22",
    taux_charges_patronales: "0.42",
    taux_absenteisme: "0.03",
    taux_temps_improductif: "0.12",
    taux_frais_agence: "0.12",
    taux_risque_operationnel: "0.02",
    taux_marge_cible: "0.08",
    mutuelle_employeur_mensuelle: "55",
    titres_restaurant_employeur_mensuels: "0",
    prime_transport_mensuelle: "0",
    cout_equipement_mensuel: "0",
    cout_transport_mensuel: "0",
    cout_structure_mensuel: "0",
    appliquer_rgdu: "1",
    taux_occupation_facturable: "0.78",
    jours_facturables_cibles_annuels: "",
    cout_recrutement_initial: "0",
    observations: "",
  });

  useEffect(() => {
    api.get<{ results?: ProfilMainOeuvre[] } | ProfilMainOeuvre[]>("/api/economie/profils-main-oeuvre/?actifs=1")
      .then((reponse) => {
        const liste = extraireListeResultats<ProfilMainOeuvre>(reponse);
        setProfils(liste);
        if (liste.length > 0) {
          appliquerProfil(liste[0]);
        }
      })
      .catch(() => setErreur("Impossible de charger les profils de main-d’œuvre."));
  }, []);

  useEffect(() => {
    if (!projetId) return;
    api.get<ProjetResume>(`/api/projets/${projetId}/`)
      .then(setProjet)
      .catch(() => setProjet(null));
  }, [projetId]);

  const profilActif = useMemo(
    () => profils.find((profil) => profil.id === profilId) || null,
    [profils, profilId]
  );

  const chargerDefautsProfil = useCallback(async (profil: ProfilMainOeuvre, localisation: string) => {
    const reponse = await api.get<DefautsSimulationProfil>(
      `/api/economie/profils-main-oeuvre/${profil.id}/simulation-defauts/?localisation=${localisation}`
    );
    setFormulaire((precedent) => ({
      ...precedent,
      localisation,
      statut_cadre: reponse.statut_cadre ? "1" : "0",
      salaire_brut_mensuel: toInputNumber(versNombre(reponse.salaire_brut_mensuel)),
      primes_mensuelles: toInputNumber(versNombre(reponse.primes_mensuelles)),
      avantages_mensuels: toInputNumber(versNombre(reponse.avantages_mensuels)),
      heures_contractuelles_mensuelles: toInputNumber(versNombre(reponse.heures_contractuelles_mensuelles, 151.67)),
      heures_par_jour: toInputNumber(versNombre(reponse.heures_par_jour, 7)),
      taux_charges_salariales: versNombre(reponse.taux_charges_salariales).toString(),
      taux_charges_patronales: versNombre(reponse.taux_charges_patronales).toString(),
      taux_absenteisme: versNombre(reponse.taux_absenteisme).toString(),
      taux_temps_improductif: versNombre(reponse.taux_temps_improductif).toString(),
      mutuelle_employeur_mensuelle: toInputNumber(versNombre(reponse.mutuelle_employeur_mensuelle)),
      titres_restaurant_employeur_mensuels: toInputNumber(versNombre(reponse.titres_restaurant_employeur_mensuels)),
      prime_transport_mensuelle: toInputNumber(versNombre(reponse.prime_transport_mensuelle)),
      cout_equipement_mensuel: toInputNumber(versNombre(reponse.cout_equipement_mensuel)),
      cout_transport_mensuel: toInputNumber(versNombre(reponse.cout_transport_mensuel)),
      cout_structure_mensuel: toInputNumber(versNombre(reponse.cout_structure_mensuel)),
      taux_occupation_facturable: versNombre(reponse.taux_occupation_facturable, 0.78).toString(),
      cout_recrutement_initial: toInputNumber(versNombre(reponse.cout_recrutement_initial)),
    }));
  }, []);

  function appliquerProfil(profil: ProfilMainOeuvre) {
    setProfilId(profil.id);
    setFormulaire((precedent) => ({
      ...precedent,
      localisation: profil.localisation || precedent.localisation,
      taux_frais_agence: profil.taux_frais_agence.toString(),
      taux_risque_operationnel: profil.taux_risque_operationnel.toString(),
      taux_marge_cible: profil.taux_marge_cible.toString(),
    }));
    setErreur(null);
  }

  useEffect(() => {
    if (!profilActif) return;
    chargerDefautsProfil(profilActif, formulaire.localisation).catch(() =>
      setErreur("Impossible de mettre à jour les hypothèses pour la localisation choisie.")
    );
  }, [chargerDefautsProfil, profilActif, formulaire.localisation]);

  function majChamp(cle: keyof typeof formulaire, valeur: string) {
    setFormulaire((precedent) => ({ ...precedent, [cle]: valeur }));
  }

  const chargeSimulation = useMemo(() => {
    if (!profilActif || !formulaire.salaire_brut_mensuel) {
      return null;
    }
    return {
      profil_code: profilActif.code,
      profil_libelle: profilActif.libelle,
      clientele: formulaire.clientele,
      localisation: formulaire.localisation,
      contrat_travail: formulaire.contrat_travail,
      statut_cadre: formulaire.statut_cadre === "1",
      quotite_travail: normaliserNombre(formulaire.quotite_travail || "1"),
      salaire_brut_mensuel: normaliserNombre(formulaire.salaire_brut_mensuel || "0"),
      primes_mensuelles: normaliserNombre(formulaire.primes_mensuelles || "0"),
      avantages_mensuels: normaliserNombre(formulaire.avantages_mensuels || "0"),
      heures_supplementaires_mensuelles: normaliserNombre(formulaire.heures_supplementaires_mensuelles || "0"),
      majoration_heures_supplementaires: normaliserNombre(formulaire.majoration_heures_supplementaires || "0.25"),
      heures_contractuelles_mensuelles: normaliserNombre(formulaire.heures_contractuelles_mensuelles || "151.67"),
      heures_par_jour: normaliserNombre(formulaire.heures_par_jour || "7"),
      taux_charges_salariales: normaliserNombre(formulaire.taux_charges_salariales || "0"),
      taux_charges_patronales: normaliserNombre(formulaire.taux_charges_patronales || "0"),
      taux_absenteisme: normaliserNombre(formulaire.taux_absenteisme || "0"),
      taux_temps_improductif: normaliserNombre(formulaire.taux_temps_improductif || "0"),
      taux_frais_agence: normaliserNombre(formulaire.taux_frais_agence || "0"),
      taux_risque_operationnel: normaliserNombre(formulaire.taux_risque_operationnel || "0"),
      taux_marge_cible: normaliserNombre(formulaire.taux_marge_cible || "0"),
      mutuelle_employeur_mensuelle: normaliserNombre(formulaire.mutuelle_employeur_mensuelle || "0"),
      titres_restaurant_employeur_mensuels: normaliserNombre(formulaire.titres_restaurant_employeur_mensuels || "0"),
      prime_transport_mensuelle: normaliserNombre(formulaire.prime_transport_mensuelle || "0"),
      cout_equipement_mensuel: normaliserNombre(formulaire.cout_equipement_mensuel || "0"),
      cout_transport_mensuel: normaliserNombre(formulaire.cout_transport_mensuel || "0"),
      cout_structure_mensuel: normaliserNombre(formulaire.cout_structure_mensuel || "0"),
      appliquer_rgdu: formulaire.appliquer_rgdu === "1",
      taux_occupation_facturable: normaliserNombre(formulaire.taux_occupation_facturable || "0.78"),
      jours_facturables_cibles_annuels: formulaire.jours_facturables_cibles_annuels
        ? normaliserNombre(formulaire.jours_facturables_cibles_annuels)
        : null,
      cout_recrutement_initial: normaliserNombre(formulaire.cout_recrutement_initial || "0"),
    };
  }, [profilActif, formulaire]);

  useEffect(() => {
    if (!chargeSimulation) {
      setSimulation(null);
      return;
    }

    const temporisateur = window.setTimeout(async () => {
      try {
        setChargementSimulation(true);
        const reponse = await api.post<SimulationMainOeuvre>(
          "/api/economie/simulateur-main-oeuvre/",
          chargeSimulation
        );
        setSimulation(reponse);
        setErreur(null);
      } catch (exception) {
        setSimulation(null);
        setErreur(exception instanceof ErreurApi ? exception.detail : "Simulation impossible.");
      } finally {
        setChargementSimulation(false);
      }
    }, 350);

    return () => window.clearTimeout(temporisateur);
  }, [chargeSimulation]);

  async function telechargerPdf() {
    if (!chargeSimulation) return;
    try {
      setTelechargement(true);
      const reponse = await api.telecharger("/api/economie/simulateur-main-oeuvre/export/pdf/", {
        method: "POST",
        corps: chargeSimulation,
      });
      telechargerBlob(reponse.blob, reponse.nomFichier || "fiche-simulation-main-oeuvre.pdf");
    } catch (exception) {
      setErreur(exception instanceof ErreurApi ? exception.detail : "Export PDF impossible.");
    } finally {
      setTelechargement(false);
    }
  }

  async function enregistrerAffectation() {
    if (!chargeSimulation || !profilId || !projetId) return;
    try {
      setEnregistrement(true);
      await api.post("/api/economie/simulateur-main-oeuvre/affecter/", {
        ...chargeSimulation,
        projet: projetId,
        profil: profilId,
        mode_facturation: formulaire.mode_facturation,
        charge_previsionnelle_jours: normaliserNombre(formulaire.charge_previsionnelle_jours || "0"),
        observations: formulaire.observations,
      });
      setMessage("Affectation enregistrée sur le projet avec les taux recommandés du simulateur.");
      setErreur(null);
    } catch (exception) {
      setErreur(exception instanceof ErreurApi ? exception.detail : "Enregistrement impossible.");
    } finally {
      setEnregistrement(false);
    }
  }

  const etape = ETAPES[etapeActive];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href={projetId ? `/projets/${projetId}/economie` : "/economie"}
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-2"
          >
            <ArrowLeft size={14} />
            {projetId ? "Économie du projet" : "Économie"}
          </Link>
          <h1>Paramétrage du coût de la main-d’œuvre</h1>
          <p className="text-slate-500 mt-1 max-w-3xl">
            Assistant métier pour renseigner un coût horaire ou journalier cohérent à partir du salaire,
            des charges, du temps réellement productif et des frais de structure.
          </p>
          {projet && (
            <p className="text-sm text-slate-500 mt-2">
              Projet ciblé : <span className="font-mono">{projet.reference}</span> — {projet.intitule}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Link href="/economie/pilotage-activite" className="btn-secondaire">
            <FileSpreadsheet className="w-4 h-4" />
            Pilotage d&apos;activité
          </Link>
          <Link href="/administration/conventions-sociales" className="btn-secondaire">
            <BriefcaseBusiness className="w-4 h-4" />
            Conventions sociales
          </Link>
          <button onClick={telechargerPdf} disabled={!simulation || telechargement} className="btn-secondaire disabled:opacity-50">
            <Download className="w-4 h-4" />
            {telechargement ? "Export…" : "Exporter la fiche PDF"}
          </button>
          {projetId && (
            <button onClick={enregistrerAffectation} disabled={!simulation || enregistrement} className="btn-primaire disabled:opacity-50">
              <Save className="w-4 h-4" />
              {enregistrement ? "Enregistrement…" : "Enregistrer sur le projet"}
            </button>
          )}
        </div>
      </div>

      {message && (
        <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {message}
        </div>
      )}
      {erreur && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {erreur}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            {ETAPES.map((item, index) => (
              <button
                key={item.cle}
                type="button"
                onClick={() => setEtapeActive(index)}
                className={`rounded-2xl border px-4 py-3 text-left transition ${
                  index === etapeActive
                    ? "border-primaire-300 bg-primaire-50 shadow-sm"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <p className="text-xs uppercase tracking-wide text-slate-400">Étape {index + 1}</p>
                <p className="mt-1 text-sm font-semibold text-slate-800">{item.titre}</p>
              </button>
            ))}
          </div>

          <div className="carte space-y-6 p-6">
            <div>
              <p className="text-xs uppercase tracking-wide text-primaire-600">Question {etapeActive + 1}</p>
              <h2 className="mt-1">{etape.titre}</h2>
              <p className="mt-2 text-sm text-slate-500">{etape.question}</p>
            </div>

            {etape.cle === "profil" && (
              <div className="space-y-5">
                <div className="grid gap-3 md:grid-cols-2">
                  {profils.map((profil) => (
                    <button
                      key={profil.id}
                      type="button"
                      onClick={() => appliquerProfil(profil)}
                      className={`rounded-2xl border p-4 text-left transition ${
                        profil.id === profilId
                          ? "border-primaire-300 bg-primaire-50"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                          <UserRoundCog className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">{profil.libelle}</p>
                          <p className="text-xs text-slate-500">
                            {[profil.categorie_libelle, profil.metier || profil.secteur_activite_libelle].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500">
                        <span>Salaire brut : {formatMontant(profil.salaire_brut_mensuel_defaut)}</span>
                        <span>Localisation : {profil.localisation}</span>
                        <span>Convention : {profil.convention_collective_libelle || "Aucune"}</span>
                        <span>Règle : {profil.regle_conventionnelle_libelle || "Libre"}</span>
                        <span>Niveau : {profil.niveau_classification || "À préciser"}</span>
                        <span>Taux conseillé : {formatMontant(profil.taux_horaire_recommande_defaut ?? undefined, 4)}</span>
                      </div>
                      {(profil.specialite || profil.fonction_equipe) && (
                        <p className="mt-2 text-xs text-slate-500">
                          {[profil.specialite, profil.fonction_equipe].filter(Boolean).join(" · ")}
                        </p>
                      )}
                      {profil.salaire_brut_minimum_conventionnel ? (
                        <p className="mt-3 text-xs text-amber-700">
                          Minimum conventionnel : {formatMontant(profil.salaire_brut_minimum_conventionnel)}
                        </p>
                      ) : null}
                    </button>
                  ))}
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="libelle-champ">Clientèle</label>
                    <select className="champ-saisie w-full bg-white" value={formulaire.clientele} onChange={(event) => majChamp("clientele", event.target.value)}>
                      <option value="particulier_pme">Particulier / petite PME</option>
                      <option value="public">Maître d&apos;ouvrage public</option>
                      <option value="cotraitrance">Co-traitance</option>
                      <option value="sous_traitance">Sous-traitance</option>
                      <option value="autre">Autre contexte</option>
                    </select>
                  </div>
                  <div>
                    <label className="libelle-champ">Localisation</label>
                    <select className="champ-saisie w-full bg-white" value={formulaire.localisation} onChange={(event) => majChamp("localisation", event.target.value)}>
                      <option value="metropole">Métropole</option>
                      <option value="mayotte">Mayotte</option>
                      <option value="dom">Autre DOM</option>
                    </select>
                  </div>
                  <div>
                    <label className="libelle-champ">Mode de facturation</label>
                    <select className="champ-saisie w-full bg-white" value={formulaire.mode_facturation} onChange={(event) => majChamp("mode_facturation", event.target.value)}>
                      <option value="horaire">Taux horaire</option>
                      <option value="journalier">Taux journalier</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {etape.cle === "remuneration" && (
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="libelle-champ">Salaire brut mensuel</label>
                  <input className="champ-saisie w-full" value={formulaire.salaire_brut_mensuel} onChange={(event) => majChamp("salaire_brut_mensuel", event.target.value)} />
                </div>
                <div>
                  <label className="libelle-champ">Primes mensuelles</label>
                  <input className="champ-saisie w-full" value={formulaire.primes_mensuelles} onChange={(event) => majChamp("primes_mensuelles", event.target.value)} />
                </div>
                <div>
                  <label className="libelle-champ">Avantages mensuels</label>
                  <input className="champ-saisie w-full" value={formulaire.avantages_mensuels} onChange={(event) => majChamp("avantages_mensuels", event.target.value)} />
                </div>
                <div>
                  <label className="libelle-champ">Charges salariales</label>
                  <input className="champ-saisie w-full" value={formulaire.taux_charges_salariales} onChange={(event) => majChamp("taux_charges_salariales", event.target.value)} />
                  <p className="mt-1 text-xs text-slate-400">Saisir un taux décimal, par exemple `0,22`.</p>
                </div>
                <div>
                  <label className="libelle-champ">Charges patronales</label>
                  <input className="champ-saisie w-full" value={formulaire.taux_charges_patronales} onChange={(event) => majChamp("taux_charges_patronales", event.target.value)} />
                </div>
                <div>
                  <label className="libelle-champ">Charge prévisionnelle projet</label>
                  <input className="champ-saisie w-full" value={formulaire.charge_previsionnelle_jours} onChange={(event) => majChamp("charge_previsionnelle_jours", event.target.value)} />
                  <p className="mt-1 text-xs text-slate-400">Utilisé lors de l’enregistrement sur projet.</p>
                </div>
              </div>
            )}

            {etape.cle === "contrat" && (
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="libelle-champ">Contrat de travail</label>
                  <select className="champ-saisie w-full bg-white" value={formulaire.contrat_travail} onChange={(event) => majChamp("contrat_travail", event.target.value)}>
                    <option value="cdi">CDI</option>
                    <option value="cdd">CDD</option>
                  </select>
                </div>
                <div>
                  <label className="libelle-champ">Statut</label>
                  <select className="champ-saisie w-full bg-white" value={formulaire.statut_cadre} onChange={(event) => majChamp("statut_cadre", event.target.value)}>
                    <option value="0">Non cadre</option>
                    <option value="1">Cadre</option>
                  </select>
                </div>
                <div>
                  <label className="libelle-champ">Quotité de travail</label>
                  <input className="champ-saisie w-full" value={formulaire.quotite_travail} onChange={(event) => majChamp("quotite_travail", event.target.value)} />
                  <p className="mt-1 text-xs text-slate-400">Exemple : `1` pour temps plein, `0,8` pour 80 %.</p>
                </div>
                <div>
                  <label className="libelle-champ">Heures supplémentaires / mois</label>
                  <input className="champ-saisie w-full" value={formulaire.heures_supplementaires_mensuelles} onChange={(event) => majChamp("heures_supplementaires_mensuelles", event.target.value)} />
                </div>
                <div>
                  <label className="libelle-champ">Majoration heures sup.</label>
                  <input className="champ-saisie w-full" value={formulaire.majoration_heures_supplementaires} onChange={(event) => majChamp("majoration_heures_supplementaires", event.target.value)} />
                </div>
                <div>
                  <label className="libelle-champ">Réduction générale estimative</label>
                  <select className="champ-saisie w-full bg-white" value={formulaire.appliquer_rgdu} onChange={(event) => majChamp("appliquer_rgdu", event.target.value)}>
                    <option value="1">Oui</option>
                    <option value="0">Non</option>
                  </select>
                </div>
                <div>
                  <label className="libelle-champ">Mutuelle employeur / mois</label>
                  <input className="champ-saisie w-full" value={formulaire.mutuelle_employeur_mensuelle} onChange={(event) => majChamp("mutuelle_employeur_mensuelle", event.target.value)} />
                </div>
                <div>
                  <label className="libelle-champ">Titres-restaurant employeur / mois</label>
                  <input className="champ-saisie w-full" value={formulaire.titres_restaurant_employeur_mensuels} onChange={(event) => majChamp("titres_restaurant_employeur_mensuels", event.target.value)} />
                </div>
                <div>
                  <label className="libelle-champ">Prime transport / mois</label>
                  <input className="champ-saisie w-full" value={formulaire.prime_transport_mensuelle} onChange={(event) => majChamp("prime_transport_mensuelle", event.target.value)} />
                </div>
              </div>
            )}

            {etape.cle === "production" && (
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="libelle-champ">Heures contractuelles mensuelles</label>
                  <input className="champ-saisie w-full" value={formulaire.heures_contractuelles_mensuelles} onChange={(event) => majChamp("heures_contractuelles_mensuelles", event.target.value)} />
                </div>
                <div>
                  <label className="libelle-champ">Heures par jour</label>
                  <input className="champ-saisie w-full" value={formulaire.heures_par_jour} onChange={(event) => majChamp("heures_par_jour", event.target.value)} />
                </div>
                <div>
                  <label className="libelle-champ">Taux d&apos;absentéisme</label>
                  <input className="champ-saisie w-full" value={formulaire.taux_absenteisme} onChange={(event) => majChamp("taux_absenteisme", event.target.value)} />
                </div>
                <div>
                  <label className="libelle-champ">Temps improductif</label>
                  <input className="champ-saisie w-full" value={formulaire.taux_temps_improductif} onChange={(event) => majChamp("taux_temps_improductif", event.target.value)} />
                </div>
                <div>
                  <label className="libelle-champ">Taux d&apos;occupation facturable</label>
                  <input className="champ-saisie w-full" value={formulaire.taux_occupation_facturable} onChange={(event) => majChamp("taux_occupation_facturable", event.target.value)} />
                </div>
                <div>
                  <label className="libelle-champ">Jours facturables cibles / an</label>
                  <input className="champ-saisie w-full" value={formulaire.jours_facturables_cibles_annuels} onChange={(event) => majChamp("jours_facturables_cibles_annuels", event.target.value)} placeholder="Laisser vide pour calcul automatique" />
                </div>
              </div>
            )}

            {etape.cle === "structure" && (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="libelle-champ">Frais agence</label>
                    <input className="champ-saisie w-full" value={formulaire.taux_frais_agence} onChange={(event) => majChamp("taux_frais_agence", event.target.value)} />
                  </div>
                  <div>
                    <label className="libelle-champ">Risque opérationnel</label>
                    <input className="champ-saisie w-full" value={formulaire.taux_risque_operationnel} onChange={(event) => majChamp("taux_risque_operationnel", event.target.value)} />
                  </div>
                  <div>
                    <label className="libelle-champ">Marge cible</label>
                    <input className="champ-saisie w-full" value={formulaire.taux_marge_cible} onChange={(event) => majChamp("taux_marge_cible", event.target.value)} />
                  </div>
                  <div>
                    <label className="libelle-champ">Équipement mensuel</label>
                    <input className="champ-saisie w-full" value={formulaire.cout_equipement_mensuel} onChange={(event) => majChamp("cout_equipement_mensuel", event.target.value)} />
                  </div>
                  <div>
                    <label className="libelle-champ">Transport mensuel</label>
                    <input className="champ-saisie w-full" value={formulaire.cout_transport_mensuel} onChange={(event) => majChamp("cout_transport_mensuel", event.target.value)} />
                  </div>
                  <div>
                    <label className="libelle-champ">Structure mensuelle</label>
                    <input className="champ-saisie w-full" value={formulaire.cout_structure_mensuel} onChange={(event) => majChamp("cout_structure_mensuel", event.target.value)} />
                  </div>
                </div>
              </div>
            )}

            {etape.cle === "projection" && (
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="libelle-champ">Charge prévisionnelle projet</label>
                  <input className="champ-saisie w-full" value={formulaire.charge_previsionnelle_jours} onChange={(event) => majChamp("charge_previsionnelle_jours", event.target.value)} />
                </div>
                <div>
                  <label className="libelle-champ">Coût initial de recrutement</label>
                  <input className="champ-saisie w-full" value={formulaire.cout_recrutement_initial} onChange={(event) => majChamp("cout_recrutement_initial", event.target.value)} />
                </div>
                {projetId && (
                  <div className="md:col-span-2">
                    <label className="libelle-champ">Observations d&apos;affectation</label>
                    <textarea
                      className="champ-saisie min-h-28 w-full"
                      value={formulaire.observations}
                      onChange={(event) => majChamp("observations", event.target.value)}
                      placeholder="Hypothèses retenues, niveau de séniorité, prestation forfaitaire ou en régie, points de vigilance…"
                    />
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={() => setEtapeActive((precedent) => Math.max(0, precedent - 1))}
                disabled={etapeActive === 0}
                className="btn-secondaire disabled:opacity-50"
              >
                <ChevronLeft className="w-4 h-4" />
                Retour
              </button>
              <button
                type="button"
                onClick={() => setEtapeActive((precedent) => Math.min(ETAPES.length - 1, precedent + 1))}
                disabled={etapeActive === ETAPES.length - 1}
                className="btn-primaire disabled:opacity-50"
              >
                Suivant
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="carte p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                <Calculator className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900">Résultat instantané</h2>
                <p className="text-sm text-slate-500">Le calcul se met à jour au fil des réponses.</p>
              </div>
            </div>

            {chargementSimulation && (
              <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
                Recalcul en cours…
              </div>
            )}

            {!simulation && !chargementSimulation && (
              <div className="mt-4 rounded-xl border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-500">
                Sélectionnez un profil puis renseignez les hypothèses de coût pour obtenir les taux recommandés.
              </div>
            )}

            {simulation && (
              <div className="mt-4 space-y-4">
                <div className="rounded-2xl bg-primaire-900 p-4 text-white">
                  <p className="text-xs uppercase tracking-wide text-primaire-100">Taux recommandé</p>
                  <p className="mt-2 text-3xl font-semibold">
                    {formulaire.mode_facturation === "horaire"
                      ? formatMontant(simulation.resultats.taux_horaire_entreprise, 4)
                      : formatMontant(simulation.resultats.taux_journalier_entreprise, 2)}
                  </p>
                  <p className="mt-2 text-sm text-primaire-100">
                    {simulation.profil_libelle} · {simulation.clientele_libelle}
                  </p>
                  {(simulation.convention_collective_libelle || simulation.regle_conventionnelle_libelle) && (
                    <p className="mt-2 text-xs text-primaire-100">
                      {simulation.convention_collective_libelle || "Convention libre"}
                      {simulation.regle_conventionnelle_libelle ? ` · ${simulation.regle_conventionnelle_libelle}` : ""}
                    </p>
                  )}
                  {(simulation.reference_sociale_localisation_libelle || simulation.variante_locale_regle_libelle) && (
                    <p className="mt-1 text-xs text-primaire-100">
                      {simulation.localisation_libelle}
                      {simulation.reference_sociale_localisation_libelle ? ` · ${simulation.reference_sociale_localisation_libelle}` : ""}
                      {simulation.variante_locale_regle_libelle ? ` · ${simulation.variante_locale_regle_libelle}` : ""}
                    </p>
                  )}
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
                  <div className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-center gap-2 text-slate-700">
                      <BriefcaseBusiness className="h-4 w-4" />
                      <p className="font-semibold">Bulletin synthétique</p>
                    </div>
                    <dl className="mt-3 space-y-2 text-sm">
                      <div className="flex justify-between gap-3">
                        <dt className="text-slate-500">Réduction générale estimée</dt>
                        <dd className="font-medium text-slate-800">{formatMontant(simulation.bulletin.reduction_generale_estimee)}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-slate-500">Brut mensuel chargé</dt>
                        <dd className="font-medium text-slate-800">{formatMontant(simulation.bulletin.remuneration_brute_mensuelle)}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-slate-500">Net hors impôt</dt>
                        <dd className="font-medium text-slate-800">{formatMontant(simulation.bulletin.net_hors_impot)}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-slate-500">Coût employeur mensuel</dt>
                        <dd className="font-medium text-slate-800">{formatMontant(simulation.bulletin.cout_employeur_mensuel)}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-slate-500">Coût complet mensuel</dt>
                        <dd className="font-medium text-slate-800">{formatMontant(simulation.bulletin.cout_complet_mensuel)}</dd>
                      </div>
                    </dl>
                  </div>

                  <div className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-center gap-2 text-slate-700">
                      <FileSpreadsheet className="h-4 w-4" />
                      <p className="font-semibold">Productivité et coefficient K</p>
                    </div>
                    <dl className="mt-3 space-y-2 text-sm">
                      <div className="flex justify-between gap-3">
                        <dt className="text-slate-500">Heures productives annuelles</dt>
                        <dd className="font-medium text-slate-800">{formatNombre(simulation.production.heures_productives_annuelles, 2, " h")}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-slate-500">K global</dt>
                        <dd className="font-medium text-slate-800">{formatNombre(simulation.coefficients.coefficient_k_global, 4)}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-slate-500">K structure</dt>
                        <dd className="font-medium text-slate-800">{formatNombre(simulation.coefficients.k_structure, 4)}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-slate-500">Temps improductif</dt>
                        <dd className="font-medium text-slate-800">{formatPourcentage(simulation.production.taux_temps_improductif)}</dd>
                      </div>
                    </dl>
                  </div>

                  <div className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-center gap-2 text-slate-700">
                      <FileSpreadsheet className="h-4 w-4" />
                      <p className="font-semibold">Projection annuelle</p>
                    </div>
                    <dl className="mt-3 space-y-2 text-sm">
                      <div className="flex justify-between gap-3">
                        <dt className="text-slate-500">Coût total première année</dt>
                        <dd className="font-medium text-slate-800">{formatMontant(simulation.projection_annuelle.cout_total_premiere_annee)}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-slate-500">CA cible annuel</dt>
                        <dd className="font-medium text-slate-800">{formatMontant(simulation.projection_annuelle.chiffre_affaires_cible_annuel)}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-slate-500">Marge annuelle</dt>
                        <dd className="font-medium text-slate-800">{formatMontant(simulation.projection_annuelle.marge_previsionnelle_annuelle)}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-slate-500">Smic de référence</dt>
                        <dd className="font-medium text-slate-800">{formatMontant(Number(simulation.hypotheses_reglementaires.smic_mensuel_reference || 0))}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-slate-500">Minimum conventionnel</dt>
                        <dd className="font-medium text-slate-800">{formatMontant(Number(simulation.hypotheses_reglementaires.minimum_conventionnel_reference || 0))}</dd>
                      </div>
                      {typeof simulation.hypotheses_reglementaires.commentaire_reglementaire_localisation === "string" &&
                        simulation.hypotheses_reglementaires.commentaire_reglementaire_localisation && (
                          <div className="pt-2 text-xs text-slate-500">
                            {simulation.hypotheses_reglementaires.commentaire_reglementaire_localisation}
                          </div>
                        )}
                    </dl>
                  </div>
                </div>

                {simulation.avertissements?.length > 0 && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    <p className="font-semibold">Points de vigilance</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5">
                      {simulation.avertissements.map((avertissement) => (
                        <li key={avertissement}>{avertissement}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
