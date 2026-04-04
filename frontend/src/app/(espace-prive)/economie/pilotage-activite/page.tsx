"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BriefcaseBusiness, Plus, Trash2, TrendingUp, Users } from "lucide-react";
import { api, ErreurApi, extraireListeResultats } from "@/crochets/useApi";

interface ProfilMainOeuvre {
  id: string;
  code: string;
  libelle: string;
  categorie_libelle: string;
  salaire_brut_mensuel_defaut: number;
}

interface LigneSimulation {
  profil_code: string;
  profil_libelle: string;
  effectif: number;
  clientele: string;
  clientele_libelle: string;
  cout_total_annuel: number;
  chiffre_affaires_cible_annuel: number;
  marge_previsionnelle_annuelle: number;
}

interface PlanActiviteSimulation {
  lignes: LigneSimulation[];
  totaux: {
    cout_total_annuel: number;
    chiffre_affaires_cible_annuel: number;
    marge_previsionnelle_annuelle: number;
    taux_marge_previsionnelle: number;
  };
  avertissements: string[];
}

interface LigneFormulaire {
  id: string;
  profil_code: string;
  clientele: string;
  effectif: string;
  salaire_brut_mensuel: string;
  jours_facturables_cibles_annuels: string;
  cout_recrutement_initial: string;
}

function formatMontant(valeur?: number) {
  if (valeur === null || valeur === undefined || Number.isNaN(valeur)) return "—";
  return `${valeur.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

function formatPourcentage(valeur?: number) {
  if (valeur === null || valeur === undefined || Number.isNaN(valeur)) return "—";
  return `${(valeur * 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`;
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function normaliserNombre(valeur: string) {
  return valeur.replace(",", ".");
}

export default function PagePilotageActivite() {
  const [profils, setProfils] = useState<ProfilMainOeuvre[]>([]);
  const [lignes, setLignes] = useState<LigneFormulaire[]>([]);
  const [simulation, setSimulation] = useState<PlanActiviteSimulation | null>(null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ results?: ProfilMainOeuvre[] } | ProfilMainOeuvre[]>("/api/economie/profils-main-oeuvre/?actifs=1")
      .then((reponse) => {
        const liste = extraireListeResultats<ProfilMainOeuvre>(reponse);
        setProfils(liste);
        if (liste.length > 0) {
          setLignes([
            {
              id: uid(),
              profil_code: liste[0].code,
              clientele: "public",
              effectif: "1",
              salaire_brut_mensuel: liste[0].salaire_brut_mensuel_defaut.toString(),
              jours_facturables_cibles_annuels: "155",
              cout_recrutement_initial: "0",
            },
          ]);
        }
      })
      .catch(() => setErreur("Impossible de charger les profils de main-d’œuvre."));
  }, []);

  const payload = useMemo(() => {
    if (lignes.length === 0) return null;
    return {
      lignes: lignes.map((ligne) => ({
        profil_code: ligne.profil_code,
        clientele: ligne.clientele,
        effectif: Number(ligne.effectif || "1"),
        salaire_brut_mensuel: normaliserNombre(ligne.salaire_brut_mensuel || "0"),
        jours_facturables_cibles_annuels: normaliserNombre(ligne.jours_facturables_cibles_annuels || "0"),
        cout_recrutement_initial: normaliserNombre(ligne.cout_recrutement_initial || "0"),
        primes_mensuelles: "0",
        avantages_mensuels: "0",
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
        cout_equipement_mensuel: "80",
        cout_transport_mensuel: "50",
        cout_structure_mensuel: "250",
        appliquer_rgdu: true,
        taux_occupation_facturable: "0.78",
      })),
    };
  }, [lignes]);

  useEffect(() => {
    if (!payload) {
      setSimulation(null);
      return;
    }
    const temporisateur = window.setTimeout(async () => {
      try {
        setChargement(true);
        const reponse = await api.post<PlanActiviteSimulation>("/api/economie/pilotage-activite/simuler/", payload);
        setSimulation(reponse);
        setErreur(null);
      } catch (exception) {
        setSimulation(null);
        setErreur(exception instanceof ErreurApi ? exception.detail : "Simulation d'activité impossible.");
      } finally {
        setChargement(false);
      }
    }, 300);

    return () => window.clearTimeout(temporisateur);
  }, [payload]);

  function ajouterLigne() {
    if (profils.length === 0) return;
    setLignes((precedent) => [
      ...precedent,
      {
        id: uid(),
        profil_code: profils[0].code,
        clientele: "public",
        effectif: "1",
        salaire_brut_mensuel: profils[0].salaire_brut_mensuel_defaut.toString(),
        jours_facturables_cibles_annuels: "155",
        cout_recrutement_initial: "0",
      },
    ]);
  }

  function majLigne(id: string, cle: keyof LigneFormulaire, valeur: string) {
    setLignes((precedent) =>
      precedent.map((ligne) => (ligne.id === id ? { ...ligne, [cle]: valeur } : ligne))
    );
  }

  function supprimerLigne(id: string) {
    setLignes((precedent) => precedent.filter((ligne) => ligne.id !== id));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/economie" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-2">
            <ArrowLeft size={14} />
            Économie
          </Link>
          <h1>Pilotage d’activité et recrutements</h1>
          <p className="mt-1 max-w-3xl text-slate-500">
            Simulez une équipe cible, son coût annuel, le chiffre d’affaires à produire et la marge prévisionnelle à atteindre.
          </p>
        </div>
        <button onClick={ajouterLigne} className="btn-primaire">
          <Plus className="w-4 h-4" />
          Ajouter un profil
        </button>
      </div>

      {erreur && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erreur}</div>}

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="carte p-6">
          <div className="mb-4 flex items-center gap-3">
            <Users className="h-5 w-5 text-slate-500" />
            <h2 className="text-base font-semibold text-slate-900">Composition prévisionnelle</h2>
          </div>
          <div className="space-y-4">
            {lignes.map((ligne) => (
              <div key={ligne.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="grid gap-4 md:grid-cols-6">
                  <div className="md:col-span-2">
                    <label className="libelle-champ">Profil</label>
                    <select className="champ-saisie w-full bg-white" value={ligne.profil_code} onChange={(event) => majLigne(ligne.id, "profil_code", event.target.value)}>
                      {profils.map((profil) => (
                        <option key={profil.code} value={profil.code}>
                          {profil.libelle} ({profil.categorie_libelle})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="libelle-champ">Clientèle</label>
                    <select className="champ-saisie w-full bg-white" value={ligne.clientele} onChange={(event) => majLigne(ligne.id, "clientele", event.target.value)}>
                      <option value="public">Public</option>
                      <option value="particulier_pme">PME / particulier</option>
                      <option value="cotraitrance">Co-traitance</option>
                      <option value="sous_traitance">Sous-traitance</option>
                      <option value="autre">Autre</option>
                    </select>
                  </div>
                  <div>
                    <label className="libelle-champ">Effectif</label>
                    <input className="champ-saisie w-full" value={ligne.effectif} onChange={(event) => majLigne(ligne.id, "effectif", event.target.value)} />
                  </div>
                  <div>
                    <label className="libelle-champ">Brut mensuel</label>
                    <input className="champ-saisie w-full" value={ligne.salaire_brut_mensuel} onChange={(event) => majLigne(ligne.id, "salaire_brut_mensuel", event.target.value)} />
                  </div>
                  <div className="flex items-end justify-end">
                    <button onClick={() => supprimerLigne(ligne.id)} className="btn-secondaire text-sm">
                      <Trash2 className="w-4 h-4" />
                      Supprimer
                    </button>
                  </div>
                  <div>
                    <label className="libelle-champ">Jours facturables / an</label>
                    <input className="champ-saisie w-full" value={ligne.jours_facturables_cibles_annuels} onChange={(event) => majLigne(ligne.id, "jours_facturables_cibles_annuels", event.target.value)} />
                  </div>
                  <div>
                    <label className="libelle-champ">Coût de recrutement</label>
                    <input className="champ-saisie w-full" value={ligne.cout_recrutement_initial} onChange={(event) => majLigne(ligne.id, "cout_recrutement_initial", event.target.value)} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <aside className="space-y-4">
          <div className="carte p-5">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-5 w-5 text-slate-500" />
              <div>
                <h2 className="text-base font-semibold text-slate-900">Synthèse économique</h2>
                <p className="text-sm text-slate-500">Projection consolidée de l’activité.</p>
              </div>
            </div>

            {chargement && <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">Recalcul en cours…</div>}

            {simulation && (
              <div className="mt-4 space-y-4">
                <div className="rounded-2xl bg-primaire-900 p-4 text-white">
                  <p className="text-xs uppercase tracking-wide text-primaire-100">Chiffre d’affaires cible</p>
                  <p className="mt-2 text-3xl font-semibold">{formatMontant(simulation.totaux.chiffre_affaires_cible_annuel)}</p>
                  <p className="mt-2 text-sm text-primaire-100">Pour l’équipe projetée</p>
                </div>

                <dl className="rounded-2xl border border-slate-200 p-4 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Coût total annuel</dt>
                    <dd className="font-medium text-slate-800">{formatMontant(simulation.totaux.cout_total_annuel)}</dd>
                  </div>
                  <div className="mt-2 flex justify-between gap-3">
                    <dt className="text-slate-500">Marge annuelle</dt>
                    <dd className="font-medium text-slate-800">{formatMontant(simulation.totaux.marge_previsionnelle_annuelle)}</dd>
                  </div>
                  <div className="mt-2 flex justify-between gap-3">
                    <dt className="text-slate-500">Taux de marge</dt>
                    <dd className="font-medium text-slate-800">{formatPourcentage(simulation.totaux.taux_marge_previsionnelle)}</dd>
                  </div>
                </dl>

                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-center gap-2 text-slate-700">
                    <BriefcaseBusiness className="h-4 w-4" />
                    <p className="font-semibold">Par profil</p>
                  </div>
                  <div className="mt-3 space-y-3">
                    {simulation.lignes.map((ligne) => (
                      <div key={`${ligne.profil_code}-${ligne.clientele}`} className="rounded-xl bg-slate-50 px-3 py-3 text-sm">
                        <p className="font-semibold text-slate-900">{ligne.profil_libelle} × {ligne.effectif}</p>
                        <p className="text-slate-500">{ligne.clientele_libelle}</p>
                        <div className="mt-2 flex justify-between gap-3">
                          <span className="text-slate-500">Coût</span>
                          <span className="font-medium text-slate-800">{formatMontant(ligne.cout_total_annuel)}</span>
                        </div>
                        <div className="mt-1 flex justify-between gap-3">
                          <span className="text-slate-500">CA cible</span>
                          <span className="font-medium text-slate-800">{formatMontant(ligne.chiffre_affaires_cible_annuel)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {simulation.avertissements?.length > 0 && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    <ul className="list-disc space-y-1 pl-5">
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
