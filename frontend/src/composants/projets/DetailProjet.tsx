"use client";

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { api, ErreurApi } from "@/crochets/useApi";
import { useSessionStore } from "@/crochets/useSession";
import { ArrowLeft, Euro, FolderOpen, Users, Pencil, Trash2, X, Info, ChevronRight, Plus, Target } from "lucide-react";
import { NavigationProjet } from "@/composants/projets/NavigationProjet";
import { DashboardProjet } from "@/composants/projets/DashboardProjet";
import { ModalConfirmation } from "@/composants/ui/ModalConfirmation";
import { useNotifications } from "@/contextes/FournisseurNotifications";

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

interface AffectationProjet {
  id: string;
  utilisateur: string;
  utilisateur_nom: string;
  utilisateur_fonction: string;
  nature: string;
  nature_libelle: string;
  code_cible: string;
  libelle_cible: string;
  role: string;
  role_libelle: string;
  commentaires: string;
}

interface UtilisateurAssignable {
  id: string;
  nom_complet: string;
  fonction: string;
  courriel: string;
  profil_libelle: string;
}

interface PhaseSuggeree {
  code: string;
  libelle: string;
  raison: string;
  indices: string[];
  differe: boolean;
  avancee_superieure: boolean;
  phase_actuelle: string;
  phase_actuelle_libelle: string;
}

interface SyntheseProjet {
  total_prix_vente_etudes: number;
  total_marge_nette_etudes?: number;
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
  phase_suggeree?: PhaseSuggeree | null;
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
  statuts_livrables: Record<string, string>;
  lots: Lot[];
  intervenants: Intervenant[];
  affectations: AffectationProjet[];
  date_creation: string;
  date_modification: string;
  responsable: string;
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

function normaliserTexteModules(...valeurs: Array<string | undefined | null>) {
  return valeurs
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function extraireVisibiliteModules(affectations: AffectationProjet[]) {
  const visibilite = {
    afficherEconomie: false,
    afficherMetres: false,
    afficherPiecesEcrites: false,
    afficherAppelsOffres: false,
    afficherExecution: false,
    afficherRentabilite: false,
  };

  for (const affectation of affectations) {
    const texte = normaliserTexteModules(
      affectation.role,
      affectation.role_libelle,
      affectation.nature,
      affectation.code_cible,
      affectation.libelle_cible,
      affectation.commentaires
    );

    if (affectation.nature === "projet" || affectation.role === "pilotage") {
      return {
        afficherEconomie: true,
        afficherMetres: true,
        afficherPiecesEcrites: true,
        afficherAppelsOffres: true,
        afficherExecution: true,
        afficherRentabilite: true,
      };
    }

    if (["redaction", "verification", "contribution"].includes(affectation.role)) {
      visibilite.afficherPiecesEcrites = true;
    }
    if (["etude_prix", "verification", "contribution"].includes(affectation.role)) {
      visibilite.afficherEconomie = true;
    }
    if (["planning", "opc"].includes(affectation.role)) {
      visibilite.afficherExecution = true;
    }

    if (/(cctp|dpgf|dqe|bpu|ccap|rc|piece|livrable|notice|memoire)/.test(texte)) {
      visibilite.afficherPiecesEcrites = true;
      visibilite.afficherEconomie = true;
    }
    if (/(metre|metres|quantite|quantitatif)/.test(texte)) {
      visibilite.afficherMetres = true;
      visibilite.afficherEconomie = true;
    }
    if (/(prix|sous detail|sous-detail|debourse|debours|kpv|rentabilite|marge)/.test(texte)) {
      visibilite.afficherEconomie = true;
      visibilite.afficherRentabilite = true;
      visibilite.afficherMetres = true;
    }
    if (/(offre|appel offres|appel d offres|analyse offres|act)/.test(texte)) {
      visibilite.afficherAppelsOffres = true;
      visibilite.afficherEconomie = true;
      visibilite.afficherPiecesEcrites = true;
    }
    if (/(planning|opc|det|visa|aor|execution|chantier|suivi travaux)/.test(texte)) {
      visibilite.afficherExecution = true;
    }
  }

  return visibilite;
}

// ---------------------------------------------------------------------------
// Composant
// ---------------------------------------------------------------------------

export function DetailProjet({ id }: { id: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const utilisateur = useSessionStore((etat) => etat.utilisateur);
  const notifications = useNotifications();
  const estSuperAdmin = Boolean(utilisateur?.est_super_admin);
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);
  const [modaleSuppressionOuverte, setModaleSuppressionOuverte] = useState(false);
  const [erreurSuppression, setErreurSuppression] = useState<string | null>(null);
  const [affectationForm, setAffectationForm] = useState({
    utilisateur: "",
    nature: "mission",
    code_cible: "",
    libelle_cible: "",
    role: "contribution",
    commentaires: "",
  });
  const [affectationEnCours, setAffectationEnCours] = useState(false);
  const { data: projet, isLoading, isError } = useQuery<ProjetDetail>({
    queryKey: ["projet", id],
    queryFn: () => api.get<ProjetDetail>(`/api/projets/${id}/`),
  });
  const { data: synthese } = useQuery<SyntheseProjet>({
    queryKey: ["projet-synthese", id],
    queryFn: () => api.get<SyntheseProjet>(`/api/projets/${id}/synthese/`),
    enabled: Boolean(projet),
  });
  const { data: equipeAssignable } = useQuery<{ utilisateurs: UtilisateurAssignable[] }>({
    queryKey: ["projet-equipe-assignable", id],
    queryFn: () => api.get<{ utilisateurs: UtilisateurAssignable[] }>(`/api/projets/${id}/equipe-assignable/`),
    enabled: Boolean(projet),
  });

  const supprimerProjet = async () => {
    if (!projet) return;
    setSuppressionEnCours(true);
    setErreurSuppression(null);
    try {
      await api.supprimer(`/api/projets/${id}/`);
      notifications.succes(`Projet ${projet.reference} supprimé.`);
      router.push("/projets");
      router.refresh();
    } catch (erreur) {
      const message = erreur instanceof ErreurApi ? erreur.detail : "Impossible de supprimer le projet.";
      setErreurSuppression(message);
      notifications.erreur(message);
    } finally {
      setSuppressionEnCours(false);
      setModaleSuppressionOuverte(false);
    }
  };

  const ajouterAffectation = async () => {
    if (!affectationForm.utilisateur || !affectationForm.libelle_cible.trim()) {
      notifications.erreur("Utilisateur et libellé d'affectation obligatoires.");
      return;
    }
    setAffectationEnCours(true);
    try {
      await api.post(`/api/projets/${id}/affectations/`, affectationForm);
      notifications.succes("Affectation enregistrée.");
      setAffectationForm({
        utilisateur: "",
        nature: "mission",
        code_cible: "",
        libelle_cible: "",
        role: "contribution",
        commentaires: "",
      });
      queryClient.invalidateQueries({ queryKey: ["projet", id] });
      queryClient.invalidateQueries({ queryKey: ["projets"] });
    } catch (erreur) {
      notifications.erreur(erreur instanceof ErreurApi ? erreur.detail : "Impossible d'ajouter l'affectation.");
    } finally {
      setAffectationEnCours(false);
    }
  };

  const supprimerAffectation = async (affectationId: string) => {
    try {
      await api.supprimer(`/api/projets/${id}/affectations/${affectationId}/`);
      notifications.succes("Affectation supprimée.");
      queryClient.invalidateQueries({ queryKey: ["projet", id] });
      queryClient.invalidateQueries({ queryKey: ["projets"] });
    } catch (erreur) {
      notifications.erreur(erreur instanceof ErreurApi ? erreur.detail : "Impossible de supprimer l'affectation.");
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
  const estGestionProjet =
    estSuperAdmin ||
    utilisateur?.id === projet.responsable ||
    projet.intervenants.some(
      (intervenant) =>
        intervenant.role === "responsable" &&
        intervenant.utilisateur_nom === utilisateur?.nom_complet
    );
  const affectationsUtilisateur = projet.affectations.filter(
    (affectation) => affectation.utilisateur === utilisateur?.id
  );
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
  const modulesAffectes = extraireVisibiliteModules(affectationsUtilisateur);
  const estIntervenantProjet = projet.intervenants.some(
    (intervenant) => intervenant.utilisateur_nom === utilisateur?.nom_complet
  );
  const navigationFiltree = !estGestionProjet && affectationsUtilisateur.length > 0;
  const equipeProjet = projet.intervenants.length > 0
    ? projet.intervenants
    : (projet.responsable_nom
      ? [{
          id: "responsable-defaut",
          utilisateur_nom: projet.responsable_nom,
          role: "responsable",
          role_libelle: "Responsable",
        }]
      : []);
  const syntheseFinanciere = [
    { libelle: "Montant estimé HT", valeur: projet.montant_estime },
    { libelle: "Montant du marché HT", valeur: projet.montant_marche },
    { libelle: "Études économiques HT", valeur: synthese?.total_prix_vente_etudes ?? null },
    { libelle: "Marge nette études HT", valeur: synthese?.total_marge_nette_etudes ?? null },
    { libelle: "Honoraires prévus HT", valeur: projet.honoraires_prevus, accent: true },
  ];

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
          {estGestionProjet && (
            <Link href={`/projets/${id}/modifier`} className="btn-primaire text-xs">
              <Pencil size={12} /> Modifier
            </Link>
          )}
          {estSuperAdmin && (
            <button
              type="button"
              onClick={() => setModaleSuppressionOuverte(true)}
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
          afficherEconomie: !navigationFiltree ? true : modulesAffectes.afficherEconomie,
          afficherMetres: !navigationFiltree ? contexteMetres : contexteMetres && modulesAffectes.afficherMetres,
          afficherPiecesEcrites: !navigationFiltree ? contextePiecesEcrites : contextePiecesEcrites && modulesAffectes.afficherPiecesEcrites,
          afficherAppelsOffres: !navigationFiltree ? contexteAppelsOffres : contexteAppelsOffres && modulesAffectes.afficherAppelsOffres,
          afficherPlanning: !navigationFiltree ? true : modulesAffectes.afficherExecution,
          afficherExecution: !navigationFiltree ? contexteExecution : contexteExecution && modulesAffectes.afficherExecution,
          afficherRentabilite: !navigationFiltree ? contexteRentabilite : contexteRentabilite && modulesAffectes.afficherRentabilite,
          afficherVoirie: afficherVoirie,
          afficherBatiment: afficherBatiment,
        }}
      />

      {/* Dashboard projet */}
      <DashboardProjet projet={projet} />

      {/* Grille compacte */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Colonne gauche */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contexte compact */}
          <ContexteCompact projet={projet} />

          {estIntervenantProjet && affectationsUtilisateur.length > 0 && (
            <div className="carte">
              <div className="mb-4 flex items-center gap-2">
                <Target size={16} />
                <h2>Mes affectations sur ce dossier</h2>
              </div>
              <div className="space-y-2">
                {affectationsUtilisateur.map((affectation) => (
                  <div
                    key={affectation.id}
                    className="rounded-xl border px-3 py-3 text-sm"
                    style={{ borderColor: "var(--bordure)", background: "var(--fond-entree)" }}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="badge-neutre">{affectation.nature_libelle}</span>
                      <span className="badge-info">{affectation.role_libelle}</span>
                    </div>
                    <p className="mt-2 font-medium">{affectation.libelle_cible || affectation.code_cible}</p>
                    {affectation.commentaires ? (
                      <p className="mt-1 text-xs" style={{ color: "var(--texte-3)" }}>
                        {affectation.commentaires}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Lots */}
          {projet.lots.length > 0 && (
            <div className="carte">
              <h2 className="mb-4 flex items-center gap-2">
                <FolderOpen size={16} /> Lots ({projet.lots.length})
              </h2>
              <div className="space-y-2">
                {projet.lots.map((lot) => (
                  <div key={lot.id} className="flex items-center justify-between p-3 rounded-lg" style={{ background: "var(--fond-entree)" }}>
                    <div>
                      <span className="font-mono text-xs mr-2" style={{ color: "var(--texte-3)" }}>Lot {lot.numero}</span>
                      <span className="font-medium text-sm">{lot.intitule}</span>
                      {lot.description && (
                        <p className="text-xs mt-0.5" style={{ color: "var(--texte-3)" }}>{lot.description}</p>
                      )}
                    </div>
                    {lot.montant_estime != null && (
                      <span className="font-mono text-sm" style={{ color: "var(--texte-2)" }}>
                        {formaterMontant(lot.montant_estime)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Colonne droite : synthèse financière + équipe */}
        <div className="space-y-6">
          {/* Synthèse financière */}
          <div className="carte">
            <h2 className="mb-4 flex items-center gap-2">
              <Euro size={16} /> Synthèse financière
            </h2>
            <dl className="space-y-3 text-sm">
              {syntheseFinanciere.map((ligne) => (
                <div
                  key={ligne.libelle}
                  className={ligne.accent ? "flex justify-between pt-3" : "flex justify-between"}
                  style={ligne.accent ? { borderTop: "1px solid var(--bordure)" } : undefined}
                >
                  <dt style={{ color: "var(--texte-3)" }}>{ligne.libelle}</dt>
                  <dd className="font-mono font-medium" style={ligne.accent ? { color: "var(--c-base)" } : undefined}>
                    {formaterMontant(ligne.valeur)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Intervenants */}
          <div className="carte">
            <h2 className="mb-4 flex items-center gap-2">
              <Users size={16} /> Équipe ({equipeProjet.length})
            </h2>
            {equipeProjet.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--texte-3)" }}>Aucun intervenant affecté.</p>
            ) : (
              <ul className="space-y-2">
                {equipeProjet.map((intervenant, idx) => (
                  <li key={idx} className="flex items-center justify-between text-sm">
                    <span className="font-medium">{intervenant.utilisateur_nom}</span>
                    <span className="badge-neutre">{intervenant.role_libelle}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="carte">
            <div className="mb-4 flex items-center gap-2">
              <Target size={16} />
              <h2>Affectations ciblées ({projet.affectations.length})</h2>
            </div>

            <div className="space-y-3">
              {projet.affectations.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--texte-3)" }}>Aucune affectation ciblée.</p>
              ) : (
                <ul className="space-y-2">
                  {projet.affectations.map((affectation) => (
                    <li key={affectation.id} className="rounded-xl border px-3 py-3 text-sm" style={{ borderColor: "var(--bordure)", background: "var(--fond-entree)" }}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{affectation.utilisateur_nom}</p>
                          <p className="text-xs" style={{ color: "var(--texte-3)" }}>
                            {affectation.nature_libelle} · {affectation.role_libelle}
                          </p>
                          <p className="mt-1 text-sm">{affectation.libelle_cible || affectation.code_cible}</p>
                          {affectation.commentaires ? (
                            <p className="mt-1 text-xs" style={{ color: "var(--texte-3)" }}>{affectation.commentaires}</p>
                          ) : null}
                        </div>
                        {estGestionProjet ? (
                          <button
                            type="button"
                            onClick={() => supprimerAffectation(affectation.id)}
                            className="rounded-lg p-2 text-red-600 transition hover:bg-red-50"
                            title="Supprimer l'affectation"
                          >
                            <Trash2 size={13} />
                          </button>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {estGestionProjet ? (
              <div className="mt-4 space-y-3 rounded-xl border p-4" style={{ borderColor: "var(--bordure)", background: "var(--fond-entree)" }}>
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--texte-3)" }}>
                  Nouvelle affectation
                </p>
                <div className="grid gap-3 md:grid-cols-2">
                  <select
                    className="champ-saisie"
                    value={affectationForm.utilisateur}
                    onChange={(e) => setAffectationForm((courant) => ({ ...courant, utilisateur: e.target.value }))}
                  >
                    <option value="">Sélectionner un salarié</option>
                    {(equipeAssignable?.utilisateurs ?? []).map((membre) => (
                      <option key={membre.id} value={membre.id}>
                        {membre.nom_complet}{membre.fonction ? ` · ${membre.fonction}` : ""}
                      </option>
                    ))}
                  </select>
                  <select
                    className="champ-saisie"
                    value={affectationForm.nature}
                    onChange={(e) => setAffectationForm((courant) => ({ ...courant, nature: e.target.value }))}
                  >
                    <option value="mission">Mission</option>
                    <option value="livrable">Livrable</option>
                    <option value="projet">Projet complet</option>
                  </select>
                  <input
                    className="champ-saisie"
                    value={affectationForm.code_cible}
                    onChange={(e) => setAffectationForm((courant) => ({ ...courant, code_cible: e.target.value }))}
                    placeholder="Code mission / livrable"
                  />
                  <select
                    className="champ-saisie"
                    value={affectationForm.role}
                    onChange={(e) => setAffectationForm((courant) => ({ ...courant, role: e.target.value }))}
                  >
                    <option value="contribution">Contribution</option>
                    <option value="redaction">Rédaction</option>
                    <option value="etude_prix">Étude de prix</option>
                    <option value="verification">Vérification</option>
                    <option value="planning">Planning</option>
                    <option value="opc">OPC</option>
                    <option value="pilotage">Pilotage</option>
                  </select>
                </div>
                <input
                  className="champ-saisie"
                  value={affectationForm.libelle_cible}
                  onChange={(e) => setAffectationForm((courant) => ({ ...courant, libelle_cible: e.target.value }))}
                  placeholder="Libellé à affecter"
                />
                <textarea
                  className="champ-saisie min-h-24"
                  value={affectationForm.commentaires}
                  onChange={(e) => setAffectationForm((courant) => ({ ...courant, commentaires: e.target.value }))}
                  placeholder="Consigne ou précision"
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={ajouterAffectation}
                    disabled={affectationEnCours}
                    className="btn-primaire text-xs"
                  >
                    <Plus size={12} />
                    {affectationEnCours ? "Affectation…" : "Affecter"}
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          {/* Métadonnées */}
          <div className="carte text-xs space-y-1" style={{ color: "var(--texte-3)" }}>
            <p>Créé le {formaterDate(projet.date_creation)}</p>
            <p>Modifié le {formaterDate(projet.date_modification)}</p>
          </div>
        </div>
      </div>

      {/* Modal contexte détaillé */}
      <ModalContexte projet={projet} />
      <ModalConfirmation
        ouverte={modaleSuppressionOuverte}
        titre="Supprimer ce projet"
        message={`Supprimer définitivement le projet ${projet.reference} et tous ses éléments liés ? Cette action est irréversible.`}
        libelleBoutonConfirmer="Supprimer"
        libelleBoutonAnnuler="Annuler"
        variante="danger"
        chargement={suppressionEnCours}
        onConfirmer={supprimerProjet}
        onAnnuler={() => {
          if (!suppressionEnCours) {
            setModaleSuppressionOuverte(false);
          }
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Contexte compact avec bouton "Voir les détails"
// ---------------------------------------------------------------------------

function ContexteCompact({ projet }: { projet: ProjetDetail }) {
  return (
    <div className="carte">
      <div className="flex items-center justify-between mb-4">
        <h2>Contexte du projet</h2>
        <button
          type="button"
          onClick={() => {
            const evt = new CustomEvent("ouvrir-modal-contexte");
            window.dispatchEvent(evt);
          }}
          className="inline-flex items-center gap-1 text-xs font-medium rounded-lg px-3 py-1.5 transition"
          style={{ color: "var(--c-base)", background: "var(--c-clair)", border: "1px solid var(--c-leger)" }}
        >
          <Info size={12} /> Voir les détails <ChevronRight size={12} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
        {projet.contexte_projet && (
          <>
            <div>
              <p className="text-xs uppercase tracking-wide mb-0.5" style={{ color: "var(--texte-3)" }}>Famille client</p>
              <p className="font-medium">{projet.contexte_projet.famille_client.libelle}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide mb-0.5" style={{ color: "var(--texte-3)" }}>Contexte contractuel</p>
              <p className="font-medium">{projet.contexte_projet.contexte_contractuel.libelle}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide mb-0.5" style={{ color: "var(--texte-3)" }}>Mission principale</p>
              <p className="font-medium">{projet.contexte_projet.mission_principale.libelle}</p>
            </div>
            {projet.contexte_projet.phase_intervention && (
              <div>
                <p className="text-xs uppercase tracking-wide mb-0.5" style={{ color: "var(--texte-3)" }}>Phase d&apos;intervention</p>
                <p className="font-medium">{projet.contexte_projet.phase_intervention.libelle}</p>
              </div>
            )}
            {projet.contexte_projet.sous_missions.length > 0 && (
              <div className="col-span-2">
                <p className="text-xs uppercase tracking-wide mb-1.5" style={{ color: "var(--texte-3)" }}>Sous-missions</p>
                <div className="flex flex-wrap gap-1.5">
                  {projet.contexte_projet.sous_missions.map((sm) => (
                    <span key={sm.code} className="rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ background: "var(--c-clair)", color: "var(--c-base)", border: "1px solid var(--c-leger)" }}>
                      {sm.libelle}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
        {!projet.contexte_projet && (
          <div className="col-span-2">
            <p className="text-sm" style={{ color: "var(--texte-3)" }}>Aucun contexte métier renseigné.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal contexte détaillé
// ---------------------------------------------------------------------------

function ModalContexte({ projet }: { projet: ProjetDetail }) {
  const [ouvert, setOuvert] = useState(false);

  // Écoute l'événement personnalisé du bouton ContexteCompact
  useEffect(() => {
    const handler = () => setOuvert(true);
    window.addEventListener("ouvrir-modal-contexte", handler);
    return () => window.removeEventListener("ouvrir-modal-contexte", handler);
  }, []);

  if (!ouvert) return null;

  const c = projet.contexte_projet;
  const pr = projet.processus_recommande;
  const vp = projet.mode_variation_prix;
  const codesMission = new Set([
    c?.mission_principale.code,
    ...(c?.missions_associees ?? []).map((mission) => mission.code),
    c?.phase_intervention?.code,
  ].filter(Boolean));
  const contextePiecesEcrites =
    projet.objectif_mission === "redaction_dce_cctp" ||
    projet.objectif_mission === "estimation_moe" ||
    ["redaction_cctp", "redaction_bpu", "redaction_dpgf", "redaction_ccap", "redaction_rc", "redaction_pieces_marche_infrastructure"].some((code) => codesMission.has(code));
  const contexteAppelsOffres =
    ["reponse_ao_entreprise", "prospection_ao", "redaction_dce_cctp"].includes(projet.objectif_mission) ||
    ["act", "act_infrastructure", "rapport_analyse_offres", "analyse_offres_infrastructure", "reponse_appel_offres"].some((code) => codesMission.has(code));

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto"
      style={{ background: "rgba(0,0,0,0.55)", paddingTop: "2rem", paddingBottom: "2rem" }}
      onClick={(e) => { if (e.target === e.currentTarget) setOuvert(false); }}
    >
      <div
        className="relative w-full max-w-4xl mx-4 rounded-2xl p-8 shadow-2xl space-y-8"
        style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Contexte détaillé du projet</h2>
          <button
            type="button"
            onClick={() => setOuvert(false)}
            className="rounded-lg p-2 transition hover:opacity-70"
            style={{ color: "var(--texte-2)" }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Client et mission */}
        {c && (
          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--texte-3)" }}>Client et mission</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "Famille client", valeur: c.famille_client.libelle },
                { label: "Sous-type", valeur: c.sous_type_client.libelle },
                { label: "Contexte contractuel", valeur: c.contexte_contractuel.libelle },
                { label: "Mission principale", valeur: c.mission_principale.libelle },
                { label: "Nature d'ouvrage", valeur: c.nature_ouvrage || "—" },
                { label: "Nature du marché", valeur: c.nature_marche || "—" },
                { label: "Partie contractante", valeur: c.partie_contractante || "—" },
                { label: "Méthode d'estimation", valeur: c.methode_estimation || "—" },
              ].map(({ label, valeur }) => (
                <div key={label} className="rounded-xl p-3" style={{ background: "var(--fond-entree)" }}>
                  <p className="text-xs uppercase tracking-wide mb-1" style={{ color: "var(--texte-3)" }}>{label}</p>
                  <p className="text-sm font-medium">{valeur}</p>
                </div>
              ))}
            </div>

            {/* Missions associées */}
            {c.missions_associees.length > 0 && (
              <div className="mt-4">
                <p className="text-xs uppercase tracking-wide mb-2" style={{ color: "var(--texte-3)" }}>Missions associées</p>
                <div className="flex flex-wrap gap-2">
                  {c.missions_associees.map((m) => (
                    <span key={m.code} className="rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ background: "var(--c-clair)", color: "var(--c-base)", border: "1px solid var(--c-leger)" }}>
                      {m.libelle}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Sous-missions */}
        {c && c.sous_missions.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--texte-3)" }}>Sous-missions activées</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {c.sous_missions.map((sm) => (
                <div key={sm.code} className="rounded-xl p-3" style={{ background: "var(--fond-entree)", border: "1px solid var(--bordure)" }}>
                  <p className="text-sm font-medium mb-1">{sm.libelle}</p>
                  {sm.types_livrables && sm.types_livrables.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {sm.types_livrables.map((t) => (
                        <span key={t} className="rounded px-1.5 py-0.5 text-[11px]" style={{ background: "var(--fond-carte)", color: "var(--texte-3)" }}>
                          {t.replace(/_/g, " ")}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Données d'entrée métier */}
        {c && Object.keys(c.donnees_entree || {}).length > 0 && (
          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--texte-3)" }}>Données d&apos;entrée métier</h3>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.entries(c.donnees_entree).map(([cle, valeur]) => (
                <div key={cle} className="rounded-xl p-3" style={{ background: "var(--fond-entree)" }}>
                  <p className="text-xs uppercase tracking-wide mb-1" style={{ color: "var(--texte-3)" }}>{cle.replace(/_/g, " ")}</p>
                  <p className="text-sm font-medium">{formaterValeurContexte(valeur)}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Processus recommandé */}
        <section>
          <h3 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--texte-3)" }}>Processus recommandé</h3>
          <div className="flex flex-wrap gap-2 mb-4">
            <Link
              href={`/projets/${projet.id}/economie/nouvelle`}
              className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium"
              style={{ background: "var(--c-base)", color: "#fff" }}
            >
              Lancer une étude
            </Link>
            <Link
              href={`/projets/${projet.id}/documents`}
              className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium"
              style={{ background: "var(--c-clair)", color: "var(--c-base)", border: "1px solid var(--c-leger)" }}
            >
              Ajouter un document
            </Link>
            {contextePiecesEcrites && (
              <Link
                href={`/projets/${projet.id}/pieces-ecrites/nouvelle`}
                className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium"
                style={{ background: "var(--c-clair)", color: "var(--c-base)", border: "1px solid var(--c-leger)" }}
              >
                Créer une pièce
              </Link>
            )}
            {contexteAppelsOffres && (
              <Link
                href={`/projets/${projet.id}/appels-offres/nouveau`}
                className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium"
                style={{ background: "var(--c-clair)", color: "var(--c-base)", border: "1px solid var(--c-leger)" }}
              >
                Créer un AO
              </Link>
            )}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {pr.methodes_estimation.length > 0 && (
              <div className="rounded-xl p-4" style={{ background: "var(--fond-entree)" }}>
                <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--texte-3)" }}>Méthodes d&apos;estimation</p>
                <ol className="space-y-2 text-sm">
                  {pr.methodes_estimation.map((m, i) => (
                    <li key={m.code}>
                      <p className="font-medium">{i + 1}. {m.libelle}</p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--texte-3)" }}>{m.objectif}</p>
                    </li>
                  ))}
                </ol>
              </div>
            )}
            {pr.livrables_prioritaires.length > 0 && (
              <div className="rounded-xl p-4" style={{ background: "var(--fond-entree)" }}>
                <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--texte-3)" }}>Livrables prioritaires</p>
                <ul className="space-y-1.5 text-sm">
                  {pr.livrables_prioritaires.map((l) => <li key={l}>• {l}</li>)}
                </ul>
              </div>
            )}
            {pr.points_de_controle.length > 0 && (
              <div className="rounded-xl p-4" style={{ background: "var(--fond-entree)" }}>
                <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--texte-3)" }}>Points de contrôle</p>
                <ul className="space-y-1.5 text-sm">
                  {pr.points_de_controle.map((p) => <li key={p}>• {p}</li>)}
                </ul>
              </div>
            )}
            {pr.documents_attendus.length > 0 && (
              <div className="rounded-xl p-4" style={{ background: "var(--fond-entree)" }}>
                <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--texte-3)" }}>Documents attendus</p>
                <ul className="space-y-1.5 text-sm">
                  {pr.documents_attendus.map((d) => <li key={d}>• {d}</li>)}
                </ul>
              </div>
            )}
            {pr.documents_a_generer.length > 0 && (
              <div className="rounded-xl p-4" style={{ background: "var(--fond-entree)" }}>
                <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--texte-3)" }}>Documents à générer</p>
                <ul className="space-y-1.5 text-sm">
                  {pr.documents_a_generer.map((d) => <li key={d}>• {d}</li>)}
                </ul>
              </div>
            )}
            {pr.indicateurs_clefs.length > 0 && (
              <div className="rounded-xl p-4" style={{ background: "var(--fond-entree)" }}>
                <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--texte-3)" }}>Indicateurs clefs</p>
                <ul className="space-y-1.5 text-sm">
                  {pr.indicateurs_clefs.map((i) => <li key={i}>• {i}</li>)}
                </ul>
              </div>
            )}
          </div>
        </section>

        {/* Dossiers GED */}
        {projet.dossiers_ged.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--texte-3)" }}>Structure GED du projet</h3>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {projet.dossiers_ged.map((dossier) => (
                <div key={dossier.code} className="rounded-xl p-3" style={{ background: "var(--fond-entree)", border: "1px solid var(--bordure)" }}>
                  <p className="text-sm font-medium">{dossier.intitule}</p>
                  <p className="text-xs mt-1" style={{ color: "var(--texte-3)" }}>{dossier.description}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Variation de prix */}
        {vp && vp.type_evolution !== "aucune" && (
          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--texte-3)" }}>Variation de prix</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: "Type", valeur: vp.type_evolution },
                { label: "Cadre juridique", valeur: vp.cadre_juridique },
                { label: "Indice / index", valeur: vp.indice_reference || "—" },
                { label: "Périodicité", valeur: vp.periodicite_revision || "—" },
                { label: "Part fixe", valeur: vp.part_fixe || "—" },
                { label: "Date prix initial", valeur: formaterDate(vp.date_prix_initial || null) },
                { label: "Remise d'offre", valeur: formaterDate(vp.date_remise_offre || null) },
                { label: "Démarrage", valeur: formaterDate(vp.date_demarrage || null) },
              ].map(({ label, valeur }) => (
                <div key={label} className="rounded-xl p-3" style={{ background: "var(--fond-entree)" }}>
                  <p className="text-xs uppercase tracking-wide mb-1" style={{ color: "var(--texte-3)" }}>{label}</p>
                  <p className="text-sm font-medium">{valeur}</p>
                </div>
              ))}
            </div>
            {vp.reference_officielle && (
              <div className="mt-3 rounded-xl p-3 text-sm" style={{ background: "var(--fond-entree)", border: "1px solid var(--bordure)" }}>
                <span className="font-medium">Dernière valeur officielle : </span>
                {vp.reference_officielle.valeur} · {vp.reference_officielle.territoire} · {formaterDate(vp.reference_officielle.date_valeur)}
              </div>
            )}
            {vp.clause_applicable && (
              <div className="mt-3 rounded-xl p-3 text-sm" style={{ background: "var(--fond-entree)" }}>
                {vp.clause_applicable}
              </div>
            )}
          </section>
        )}

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={() => setOuvert(false)}
            className="btn-secondaire"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
