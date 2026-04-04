"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { api, ErreurApi } from "@/crochets/useApi";
import { useSessionStore } from "@/crochets/useSession";
import { decrireReponseQuestion, type QuestionWizardProjet } from "@/composants/projets/WizardQualificationProjet";
import {
  ArrowLeft, Calendar, MapPin, Building2, User,
  Euro, FolderOpen, Users, Pencil, Trash2,
} from "lucide-react";

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
  organisation_nom: string;
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
  qualification_wizard: Record<string, string | string[]>;
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
    wizard: {
      titre: string;
      description: string;
      etapes: Array<{
        code: string;
        titre: string;
        description: string;
        questions: QuestionWizardProjet[];
      }>;
    };
  };
  dossiers_ged: Array<{ code: string; intitule: string; description: string }>;
  lots: Lot[];
  intervenants: Intervenant[];
  date_creation: string;
  date_modification: string;
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

  return (
    <div className="space-y-6">
      {erreurSuppression && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {erreurSuppression}
        </div>
      )}

      {/* En-tête */}
      <div className="flex items-start justify-between gap-4">
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

        <div className="flex gap-2 shrink-0 flex-wrap">
          <Link href={`/projets/${id}/economie`} className="btn-secondaire text-xs">Économie</Link>
          <Link href={`/projets/${id}/rentabilite`} className="btn-secondaire text-xs">Rentabilité</Link>
          <Link href={`/projets/${id}/execution`} className="btn-secondaire text-xs">Exécution</Link>
          <Link href={`/projets/${id}/metres`} className="btn-secondaire text-xs">Métrés</Link>
          <Link href={`/projets/${id}/appels-offres`} className="btn-secondaire text-xs">Appels d&apos;offres</Link>
          <Link href={`/projets/${id}/documents`} className="btn-secondaire text-xs">Documents</Link>
          <Link href={`/projets/${id}/pieces-ecrites`} className="btn-secondaire text-xs">Pièces écrites</Link>
          <Link href={`/projets/${id}/voirie`} className="btn-secondaire text-xs">Voirie</Link>
          <Link href={`/projets/${id}/batiment`} className="btn-secondaire text-xs">Bâtiment</Link>
          <Link href={`/projets/${id}/modifier`} className="btn-primaire text-xs flex items-center gap-1">
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

      {/* Grille informations */}
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
                <dd className="font-medium mt-0.5">{projet.organisation_nom}</dd>
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
            <h2 className="mb-4">Wizard métier et GED projet</h2>
            <p className="text-sm text-slate-500 mb-4">
              {projet.processus_recommande.wizard.description}
            </p>
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
            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Réponses du wizard</h3>
              <div className="grid gap-3 lg:grid-cols-2">
                {projet.processus_recommande.wizard.etapes.flatMap((etape) =>
                  etape.questions.map((question) => (
                    <div key={question.id} className="rounded-lg bg-slate-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{etape.titre}</p>
                      <p className="mt-1 text-sm font-medium text-slate-800">{question.question}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {decrireReponseQuestion(question, projet.qualification_wizard || {})}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
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
