"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { api, ErreurApi } from "@/crochets/useApi";
import { useSessionStore } from "@/crochets/useSession";
import { ArrowLeft, Calendar, MapPin, Building2, User, Euro, FolderOpen, Users, Pencil, Trash2 } from "lucide-react";
import { NavigationProjet } from "@/composants/projets/NavigationProjet";
import { DashboardProjet } from "@/composants/projets/DashboardProjet";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Lot {
  id: string;
  numero: number;
  intitule: string;
  description: string;
  montant_estime: number | null;
}

interface Intervenant {
  id: string;
  utilisateur_nom: string;
  role: string;
  role_libelle: string;
}

interface ProjetDetail {
  id: string;
  reference: string;
  intitule: string;
  statut: string;
  statut_libelle: string;
  type_projet: string;
  type_projet_autre?: string;
  type_libelle: string;
  clientele_cible: string;
  clientele_cible_libelle: string;
  objectif_mission: string;
  objectif_mission_libelle: string;
  phase_actuelle: string;
  phase_libelle: string;
  organisation_nom: string | null;
  maitre_ouvrage_nom: string | null;
  maitre_oeuvre_nom: string | null;
  responsable_nom: string;
  commune: string;
  departement: string;
  date_debut_prevue: string | null;
  date_fin_prevue: string | null;
  date_debut_reelle: string | null;
  date_fin_reelle: string | null;
  montant_estime: number | null;
  montant_marche: number | null;
  honoraires_prevus: number | null;
  description: string;
  contexte_projet: {
    famille_client: { code: string; libelle: string };
    sous_type_client: { code: string; libelle: string };
    contexte_contractuel: { code: string; libelle: string };
    mission_principale: { code: string; libelle: string };
    missions_associees: Array<{ code: string; libelle: string }>;
    phase_intervention: { code: string; libelle: string } | null;
    nature_ouvrage: string;
    nature_marche: string;
    partie_contractante: string;
    role_lbh: string;
    methode_estimation: string;
    donnees_entree: Record<string, string | string[] | boolean>;
    sous_missions: Array<{ code: string; libelle: string; types_livrables?: string[] }>;
  } | null;
  processus_recommande: {
    clientele: { code: string; libelle: string };
    objectif: { code: string; libelle: string };
    points_de_controle: string[];
    methodes_estimation: Array<{ code: string; libelle: string; objectif: string }>;
    livrables_prioritaires: string[];
    indicateurs_clefs: string[];
    documents_attendus: string[];
    documents_a_generer: string[];
    automatismes: string[];
    sources_methodologiques: string[];
  };
  dossiers_ged: Array<{ code: string; intitule: string; description: string }>;
  lots: Lot[];
  intervenants: Intervenant[];
  date_creation: string;
  date_modification: string;
  mode_variation_prix?: {
    type_evolution: string;
    cadre_juridique: string;
    indice_reference: string;
    formule_personnalisee?: string;
    date_prix_initial?: string | null;
    date_remise_offre?: string | null;
    date_demarrage?: string | null;
    periodicite_revision?: string;
    clause_applicable?: string;
    part_fixe?: string | null;
    reference_officielle?: {
      code: string;
      libelle: string;
      territoire: string;
      date_valeur: string;
      valeur: number;
      source_publication_url: string;
      source_donnees_url: string;
    } | null;
  } | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STYLES_STATUT: Record<string, string> = {
  en_cours: "badge-info",
  termine: "badge-succes",
  suspendu: "badge-alerte",
  abandonne: "badge-danger",
  prospection: "badge-neutre",
  archive: "badge-neutre",
};

function formaterDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

function formaterMontant(val: number | null) {
  if (val == null) return "—";
  return `${Number(val).toLocaleString("fr-FR", { minimumFractionDigits: 0 })} €`;
}

function formaterValeurContexte(valeur: string | string[] | boolean) {
  if (Array.isArray(valeur)) return valeur.join(", ") || "—";
  if (typeof valeur === "boolean") return valeur ? "Oui" : "Non";
  return valeur || "—";
}

// ---------------------------------------------------------------------------
// Composant
// ---------------------------------------------------------------------------

export function DetailProjet({ id }: { id: string }) {
  const router = useRouter();
  const utilisateur = useSessionStore((etat) => etat.utilisateur);
  const estSuperAdmin = Boolean(utilisateur?.est_super_admin);
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);
  const [erreurSuppression, setErreurSuppression] = useState<string | null>(null);
  const { data: projet, isLoading, isError } = useQuery<ProjetDetail>({
    queryKey: ["projet", id],
    queryFn: () => api.get<ProjetDetail>(`/api/projets/${id}/`),
  });

  const supprimerProjet = async () => {
    if (!projet) return;
    const confirmation = window.confirm(
      `Supprimer définitivement le projet ${projet.reference} et tous ses éléments liés ? Cette action est irréversible.`
    );
    if (!confirmation) return;

    setSuppressionEnCours(true);
    setErreurSuppression(null);
    try {
      await api.supprimer(`/api/projets/${id}/`);
      router.push("/projets");
      router.refresh();
    } catch (erreur) {
      setErreurSuppression(
        erreur instanceof ErreurApi ? erreur.detail : "Impossible de supprimer le projet."
      );
    } finally {
      setSuppressionEnCours(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400 text-sm">
        Chargement du projet…
      </div>
    );
  }

  if (isError || !projet) {
    return (
      <div className="carte text-center py-12">
        <p className="text-red-500 mb-4">Impossible de charger ce projet.</p>
        <Link href="/projets" className="btn-secondaire">← Retour aux projets</Link>
      </div>
    );
  }

  const contexte = projet.contexte_projet;
  const familleClient = contexte?.famille_client.code || "";
  const objectifMission = projet.objectif_mission || "";
  const natureOuvrage = contexte?.nature_ouvrage || "";
  const codesMission = new Set([
    contexte?.mission_principale.code,
    ...(contexte?.missions_associees ?? []).map((mission) => mission.code),
    contexte?.phase_intervention?.code,
  ].filter(Boolean));

  const estEntreprise = familleClient === "entreprise";
  const estMaitriseOeuvre = familleClient === "maitrise_oeuvre";
  const estMaitriseOuvrage = familleClient === "maitrise_ouvrage";
  const contexteExecution =
    objectifMission === "suivi_execution" ||
    ["exe", "visa", "det", "opc", "aor", "execution", "planning_execution"].some((code) => codesMission.has(code));
  const contexteAppelsOffres =
    ["reponse_ao_entreprise", "prospection_ao", "redaction_dce_cctp"].includes(objectifMission) ||
    ["act", "act_infrastructure", "rapport_analyse_offres", "analyse_offres_infrastructure", "reponse_appel_offres"].some((code) => codesMission.has(code));
  const contextePiecesEcrites =
    ["redaction_dce_cctp", "estimation_moe"].includes(objectifMission) ||
    ["redaction_cctp", "redaction_bpu", "redaction_dpgf", "redaction_ccap", "redaction_rc", "redaction_pieces_marche_infrastructure"].some((code) => codesMission.has(code));
  const contexteRentabilite =
    estEntreprise ||
    ["reponse_ao_entreprise", "devis_entreprise", "suivi_execution"].includes(objectifMission) ||
    codesMission.has("suivi_rentabilite");
  const contexteMetres =
    !estEntreprise ||
    ["verifier_enveloppe", "estimation_moe", "redaction_dce_cctp"].includes(objectifMission) ||
    ["estimation_par_lot", "estimation_infrastructure"].some((code) => codesMission.has(code));
  const afficherVoirie = natureOuvrage === "infrastructure" || natureOuvrage === "mixte";
  const afficherBatiment = natureOuvrage === "batiment" || natureOuvrage === "mixte" || (!natureOuvrage && (estMaitriseOeuvre || estMaitriseOuvrage));

  return (
    <div className="space-y-6">
      {erreurSuppression && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {erreurSuppression}
        </div>
      )}

      {/* En-tête */}
      <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-start 2xl:justify-between">
        <div>
          <Link href="/projets" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-2">
            <ArrowLeft size={14} /> Projets
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="font-mono">{projet.reference}</h1>
            <span className={clsx(STYLES_STATUT[projet.statut] || "badge-neutre")}>
              {projet.statut_libelle}
            </span>
            {projet.phase_libelle && (
              <span className="badge-neutre">{projet.phase_libelle}</span>
            )}
          </div>
          <p className="text-slate-600 mt-1 text-lg">{projet.intitule}</p>
        </div>

        <div className="flex items-center gap-2">
          <Link href={`/projets/${id}/modifier`} className="btn-primaire text-xs">
            <Pencil size={12} /> Modifier
          </Link>
          {estSuperAdmin && (
            <button
              type="button"
              onClick={supprimerProjet}
              disabled={suppressionEnCours}
              className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Trash2 size={12} />
              {suppressionEnCours ? "Suppression…" : "Supprimer"}
            </button>
          )}
        </div>
      </div>

      {/* Navigation interne au projet */}
      <NavigationProjet
        idProjet={id}
        contexte={{
          afficherMetres: contexteMetres,
          afficherPiecesEcrites: contextePiecesEcrites,
          afficherAppelsOffres: contexteAppelsOffres,
          afficherExecution: contexteExecution,
          afficherRentabilite: contexteRentabilite,
          afficherVoirie: afficherVoirie,
          afficherBatiment: afficherBatiment,
        }}
      />

      {/* Dashboard projet */}
      <DashboardProjet projet={projet} />

      {/* Grille informations complémentaires (conservée) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Colonne gauche : données principales */}
        <div className="lg:col-span-2 space-y-6">
          {/* Informations générales */}
          <div className="carte">
            <h2 className="mb-4">Informations générales</h2>
            <dl className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
              <div>
                <dt className="text-slate-500 flex items-center gap-1">
                  <Building2 size={12} /> Bureau d&apos;études
                </dt>
                <dd className="font-medium mt-0.5">{projet.organisation_nom || "—"}</dd>
              </div>
              {projet.maitre_ouvrage_nom && (
                <div>
                  <dt className="text-slate-500">Maître d&apos;ouvrage</dt>
                  <dd className="font-medium mt-0.5">{projet.maitre_ouvrage_nom}</dd>
                </div>
              )}
              {projet.maitre_oeuvre_nom && (
                <div>
                  <dt className="text-slate-500">Maître d&apos;œuvre</dt>
                  <dd className="font-medium mt-0.5">{projet.maitre_oeuvre_nom}</dd>
                </div>
              )}
              <div>
                <dt className="text-slate-500 flex items-center gap-1">
                  <User size={12} /> Responsable
                </dt>
                <dd className="font-medium mt-0.5">{projet.responsable_nom}</dd>
              </div>
              {(projet.commune || projet.departement) && (
                <div>
                  <dt className="text-slate-500 flex items-center gap-1">
                    <MapPin size={12} /> Localisation
                  </dt>
                  <dd className="font-medium mt-0.5">
                    {[projet.commune, projet.departement ? `(${projet.departement})` : ""].filter(Boolean).join(" ")}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-slate-500">Type</dt>
                <dd className="font-medium mt-0.5">{projet.type_libelle}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Clientèle cible</dt>
                <dd className="font-medium mt-0.5">{projet.clientele_cible_libelle}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Objectif principal</dt>
                <dd className="font-medium mt-0.5">{projet.objectif_mission_libelle}</dd>
              </div>
            </dl>
          </div>

          {/* Calendrier */}
          <div className="carte">
            <h2 className="mb-4 flex items-center gap-2">
              <Calendar size={16} /> Calendrier
            </h2>
            <dl className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
              <div>
                <dt className="text-slate-500">Début prévu</dt>
                <dd className="font-medium mt-0.5">{formaterDate(projet.date_debut_prevue)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Fin prévue</dt>
                <dd className="font-medium mt-0.5">{formaterDate(projet.date_fin_prevue)}</dd>
              </div>
              {projet.date_debut_reelle && (
                <div>
                  <dt className="text-slate-500">Début réel</dt>
                  <dd className="font-medium mt-0.5">{formaterDate(projet.date_debut_reelle)}</dd>
                </div>
              )}
              {projet.date_fin_reelle && (
                <div>
                  <dt className="text-slate-500">Fin réelle</dt>
                  <dd className="font-medium mt-0.5">{formaterDate(projet.date_fin_reelle)}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Lots */}
          {projet.lots.length > 0 && (
            <div className="carte">
              <div className="flex items-center justify-between mb-4">
                <h2 className="flex items-center gap-2">
                  <FolderOpen size={16} /> Lots ({projet.lots.length})
                </h2>
              </div>
              <div className="space-y-2">
                {projet.lots.map((lot) => (
                  <div key={lot.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                    <div>
                      <span className="font-mono text-xs text-slate-500 mr-2">Lot {lot.numero}</span>
                      <span className="font-medium text-sm">{lot.intitule}</span>
                      {lot.description && (
                        <p className="text-xs text-slate-400 mt-0.5">{lot.description}</p>
                      )}
                    </div>
                    {lot.montant_estime != null && (
                      <span className="font-mono text-sm text-slate-700">
                        {formaterMontant(lot.montant_estime)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="carte">
            <h2 className="mb-4">Contexte métier et GED projet</h2>
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-xl bg-slate-50 p-4">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Documents attendus</h3>
                <ul className="space-y-2 text-sm text-slate-600">
                  {projet.processus_recommande.documents_attendus.map((ligne) => (
                    <li key={ligne}>• {ligne}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl bg-amber-50 p-4">
                <h3 className="text-sm font-semibold text-amber-800 mb-3">Points de contrôle</h3>
                <ul className="space-y-2 text-sm text-slate-700">
                  {projet.processus_recommande.points_de_controle.map((ligne) => (
                    <li key={ligne}>• {ligne}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl bg-emerald-50 p-4">
                <h3 className="text-sm font-semibold text-emerald-800 mb-3">Documents à générer</h3>
                <ul className="space-y-2 text-sm text-slate-700">
                  {projet.processus_recommande.documents_a_generer.map((ligne) => (
                    <li key={ligne}>• {ligne}</li>
                  ))}
                </ul>
              </div>
            </div>
            {projet.contexte_projet && (
              <div className="mt-4 grid gap-4 lg:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <h3 className="mb-3 text-sm font-semibold text-slate-700">Client et mission</h3>
                  <dl className="space-y-2 text-sm text-slate-700">
                    <div>
                      <dt className="text-slate-500">Famille client</dt>
                      <dd className="font-medium">{projet.contexte_projet.famille_client.libelle}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Sous-type</dt>
                      <dd className="font-medium">{projet.contexte_projet.sous_type_client.libelle}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Contexte contractuel</dt>
                      <dd className="font-medium">{projet.contexte_projet.contexte_contractuel.libelle}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Mission principale</dt>
                      <dd className="font-medium">{projet.contexte_projet.mission_principale.libelle}</dd>
                    </div>
                  </dl>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <h3 className="mb-3 text-sm font-semibold text-slate-700">Paramètres de mission</h3>
                  <dl className="space-y-2 text-sm text-slate-700">
                    <div>
                      <dt className="text-slate-500">Nature du marché</dt>
                      <dd className="font-medium">{projet.contexte_projet.nature_marche}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Partie contractante</dt>
                      <dd className="font-medium">{projet.contexte_projet.partie_contractante || "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Rôle LBH</dt>
                      <dd className="font-medium">{projet.contexte_projet.role_lbh || "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Méthode d&apos;estimation</dt>
                      <dd className="font-medium">{projet.contexte_projet.methode_estimation || "—"}</dd>
                    </div>
                  </dl>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <h3 className="mb-3 text-sm font-semibold text-slate-700">Sous-missions activées</h3>
                  <ul className="space-y-2 text-sm text-slate-700">
                    {projet.contexte_projet.sous_missions.length ? projet.contexte_projet.sous_missions.map((ligne) => (
                      <li key={ligne.code}>
                        <p>• {ligne.libelle}</p>
                        {ligne.types_livrables?.length ? (
                          <div className="mt-1 flex flex-wrap gap-1.5 pl-4">
                            {ligne.types_livrables.map((type) => (
                              <span key={type} className="rounded-full border border-primaire-200 bg-primaire-50 px-2 py-0.5 text-[11px] font-medium text-primaire-800">
                                {type.replace(/_/g, " ")}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </li>
                    )) : <li>Aucune sous-mission activée.</li>}
                  </ul>
                </div>
              </div>
            )}
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              <div className="rounded-xl bg-white p-4 border border-slate-200">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Méthodes ordonnées</h3>
                <ul className="space-y-3 text-sm text-slate-700">
                  {projet.processus_recommande.methodes_estimation.map((ligne, index) => (
                    <li key={ligne.code}>
                      <p className="font-medium">{index + 1}. {ligne.libelle}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{ligne.objectif}</p>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl bg-white p-4 border border-slate-200">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Livrables prioritaires</h3>
                <ul className="space-y-2 text-sm text-slate-700">
                  {projet.processus_recommande.livrables_prioritaires.map((ligne) => (
                    <li key={ligne}>• {ligne}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl bg-white p-4 border border-slate-200">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Indicateurs clefs</h3>
                <ul className="space-y-2 text-sm text-slate-700">
                  {projet.processus_recommande.indicateurs_clefs.map((ligne) => (
                    <li key={ligne}>• {ligne}</li>
                  ))}
                </ul>
              </div>
            </div>
            {projet.mode_variation_prix && projet.mode_variation_prix.type_evolution !== "aucune" ? (
              <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Variation de prix</h3>
                <dl className="grid gap-3 lg:grid-cols-3 text-sm">
                  <div><dt className="text-xs uppercase tracking-wide text-slate-500">Type</dt><dd className="mt-1 font-medium text-slate-900">{projet.mode_variation_prix.type_evolution}</dd></div>
                  <div><dt className="text-xs uppercase tracking-wide text-slate-500">Cadre</dt><dd className="mt-1 font-medium text-slate-900">{projet.mode_variation_prix.cadre_juridique}</dd></div>
                  <div><dt className="text-xs uppercase tracking-wide text-slate-500">Indice / index</dt><dd className="mt-1 font-medium text-slate-900">{projet.mode_variation_prix.indice_reference || "—"}</dd></div>
                  <div><dt className="text-xs uppercase tracking-wide text-slate-500">Prix initial</dt><dd className="mt-1 font-medium text-slate-900">{formaterDate(projet.mode_variation_prix.date_prix_initial || null)}</dd></div>
                  <div><dt className="text-xs uppercase tracking-wide text-slate-500">Remise d&apos;offre</dt><dd className="mt-1 font-medium text-slate-900">{formaterDate(projet.mode_variation_prix.date_remise_offre || null)}</dd></div>
                  <div><dt className="text-xs uppercase tracking-wide text-slate-500">Démarrage</dt><dd className="mt-1 font-medium text-slate-900">{formaterDate(projet.mode_variation_prix.date_demarrage || null)}</dd></div>
                  <div><dt className="text-xs uppercase tracking-wide text-slate-500">Périodicité</dt><dd className="mt-1 font-medium text-slate-900">{projet.mode_variation_prix.periodicite_revision || "—"}</dd></div>
                  <div><dt className="text-xs uppercase tracking-wide text-slate-500">Part fixe</dt><dd className="mt-1 font-medium text-slate-900">{projet.mode_variation_prix.part_fixe || "—"}</dd></div>
                  <div><dt className="text-xs uppercase tracking-wide text-slate-500">Dernière valeur officielle</dt><dd className="mt-1 font-medium text-slate-900">{projet.mode_variation_prix.reference_officielle ? `${projet.mode_variation_prix.reference_officielle.valeur} · ${formaterDate(projet.mode_variation_prix.reference_officielle.date_valeur)}` : "—"}</dd></div>
                  <div><dt className="text-xs uppercase tracking-wide text-slate-500">Territoire</dt><dd className="mt-1 font-medium text-slate-900">{projet.mode_variation_prix.reference_officielle?.territoire || "—"}</dd></div>
                </dl>
                {projet.mode_variation_prix.clause_applicable ? (
                  <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                    {projet.mode_variation_prix.clause_applicable}
                  </div>
                ) : null}
              </div>
            ) : null}
            {projet.contexte_projet && Object.keys(projet.contexte_projet.donnees_entree || {}).length > 0 && (
              <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Données d&apos;entrée métier</h3>
                <div className="grid gap-3 lg:grid-cols-2">
                  {Object.entries(projet.contexte_projet.donnees_entree).map(([cle, valeur]) => (
                    <div key={cle} className="rounded-lg bg-slate-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{cle.replace(/_/g, " ")}</p>
                      <p className="mt-1 text-sm font-medium text-slate-800">{formaterValeurContexte(valeur)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Dossiers GED du projet</h3>
              <div className="grid gap-3 lg:grid-cols-2">
                {projet.dossiers_ged.map((dossier) => (
                  <div key={dossier.code} className="rounded-lg bg-slate-50 p-3">
                    <p className="text-sm font-medium text-slate-800">{dossier.intitule}</p>
                    <p className="mt-1 text-xs text-slate-500">{dossier.description}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Automatismes et sources</h3>
              <ul className="space-y-2 text-sm text-slate-700 mb-4">
                {projet.processus_recommande.automatismes.map((source) => (
                  <li key={source}>• {source}</li>
                ))}
              </ul>
              <ul className="space-y-2 text-sm text-slate-700">
                {projet.processus_recommande.sources_methodologiques.map((source) => (
                  <li key={source}>• {source}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Colonne droite : synthèse financière + équipe */}
        <div className="space-y-6">
          {/* Synthèse financière */}
          <div className="carte">
            <h2 className="mb-4 flex items-center gap-2">
              <Euro size={16} /> Synthèse financière
            </h2>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Montant estimé HT</dt>
                <dd className="font-mono font-medium">{formaterMontant(projet.montant_estime)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Montant du marché HT</dt>
                <dd className="font-mono font-medium">{formaterMontant(projet.montant_marche)}</dd>
              </div>
              <div className="flex justify-between border-t border-slate-100 pt-3">
                <dt className="text-slate-500">Honoraires prévus HT</dt>
                <dd className="font-mono font-medium text-primaire-700">
                  {formaterMontant(projet.honoraires_prevus)}
                </dd>
              </div>
            </dl>
          </div>

          {/* Intervenants */}
          <div className="carte">
            <h2 className="mb-4 flex items-center gap-2">
              <Users size={16} /> Équipe ({projet.intervenants.length})
            </h2>
            {projet.intervenants.length === 0 ? (
              <p className="text-sm text-slate-400">Aucun intervenant affecté.</p>
            ) : (
              <ul className="space-y-2">
                {projet.intervenants.map((intervenant, idx) => (
                  <li key={idx} className="flex items-center justify-between text-sm">
                    <span className="font-medium">{intervenant.utilisateur_nom}</span>
                    <span className="badge-neutre">{intervenant.role_libelle}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Métadonnées */}
          <div className="carte text-xs text-slate-400 space-y-1">
            <p>Créé le {formaterDate(projet.date_creation)}</p>
            <p>Modifié le {formaterDate(projet.date_modification)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
