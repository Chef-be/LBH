"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { api, ErreurApi } from "@/crochets/useApi";
import { useSessionStore } from "@/crochets/useSession";
import { useNotifications } from "@/contextes/FournisseurNotifications";
import {
  ArrowLeft, RefreshCw, Copy, Euro, TrendingUp, TrendingDown, Minus,
  ChevronDown, ChevronRight, Save, Wand2,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LignePrix {
  id: string;
  numero_ordre: number;
  code: string;
  designation: string;
  unite: string;
  quantite_prevue: number;
  debourse_sec_unitaire: number;
  cout_revient_unitaire: number;
  prix_vente_unitaire: number;
  marge_nette_unitaire: number;
  taux_marge_nette: number;
  marge_nette_totale: number;
  contribution_marge: number;
  etat_rentabilite: string;
  etat_libelle: string;
  causes_non_rentabilite: string[];
}

interface JournalPhase {
  id: string;
  auteur_nom: string | null;
  nouvelle_duree_jours: number | string;
  motif: string;
  date_creation: string;
}

interface PhaseEtude {
  id: string;
  code: string;
  libelle: string;
  description: string;
  ordre: number;
  role_intervenant: string;
  role_intervenant_libelle: string;
  specialite_requise: string;
  niveau_intervention: string;
  duree_previsionnelle_jours: number | string;
  duree_revisee_jours: number | string | null;
  duree_active_jours: number | string;
  profil_main_oeuvre_libelle: string | null;
  utilisateur_assigne: string | null;
  utilisateur_assigne_nom: string | null;
  statut: string;
  motif_dernier_ajustement: string;
  journal: JournalPhase[];
}

interface UtilisateurOption {
  id: string;
  nom_complet: string;
  fonction: string;
  profil_libelle: string | null;
}

interface EtudeDetail {
  id: string;
  intitule: string;
  statut: string;
  version: number;
  est_variante: boolean;
  taux_frais_chantier: number | null;
  taux_frais_generaux: number | null;
  taux_aleas: number | null;
  taux_marge_cible: number | null;
  taux_pertes: number | null;
  total_debourse_sec: number;
  total_cout_direct: number;
  total_cout_revient: number;
  total_prix_vente: number;
  total_marge_brute: number;
  total_marge_nette: number;
  taux_marge_nette_global: number;
  phases: PhaseEtude[];
  lignes: LignePrix[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STYLES_ETAT: Record<string, string> = {
  rentable: "badge-succes",
  surveiller: "badge-alerte",
  faible: "badge-alerte",
  non_rentable: "badge-danger",
  sous_condition: "badge-info",
  deficitaire_origine: "badge-danger",
  indefini: "badge-neutre",
};

function formaterMontant(val: number | null | undefined) {
  if (val == null) return "—";
  return `${Number(val).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

function formaterPourcent(val: number | null | undefined) {
  if (val == null) return "—";
  return `${(Number(val) * 100).toFixed(1)} %`;
}

function formaterDateHeure(val: string | null | undefined) {
  if (!val) return "—";
  return new Date(val).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function IconeMarge({ taux }: { taux: number }) {
  if (taux >= 0.08) return <TrendingUp size={14} className="text-green-500" />;
  if (taux >= 0.03) return <Minus size={14} className="text-yellow-500" />;
  return <TrendingDown size={14} className="text-red-500" />;
}

// ---------------------------------------------------------------------------
// Composant
// ---------------------------------------------------------------------------

export function DetailEtudeEconomique({
  projetId,
  etudeId,
}: {
  projetId: string;
  etudeId: string;
}) {
  const queryClient = useQueryClient();
  const utilisateur = useSessionStore((etat) => etat.utilisateur);
  const notifications = useNotifications();
  const [ligneOuverte, setLigneOuverte] = useState<string | null>(null);
  const [phaseEnregistrementId, setPhaseEnregistrementId] = useState<string | null>(null);
  const [phasesEdition, setPhasesEdition] = useState<Record<string, {
    utilisateurAssigne: string;
    dureePrevisionnelle: string;
    dureeRevisee: string;
    statut: string;
    motif: string;
  }>>({});

  const { data: etude, isLoading, isError } = useQuery<EtudeDetail>({
    queryKey: ["etude-economique", etudeId],
    queryFn: () => api.get<EtudeDetail>(`/api/economie/${etudeId}/`),
  });
  const { data: utilisateurs = [] } = useQuery<UtilisateurOption[]>({
    queryKey: ["utilisateurs-actifs", projetId],
    queryFn: async () => {
      const reponse = await api.get<{ results?: UtilisateurOption[] } | UtilisateurOption[]>("/api/comptes/utilisateurs/");
      const liste = Array.isArray(reponse) ? reponse : (reponse.results ?? []);
      return liste.filter((element) => Boolean(element.id));
    },
    enabled: Boolean(utilisateur?.est_super_admin),
    staleTime: 60_000,
  });

  const { mutate: recalculer, isPending: recalcul } = useMutation({
    mutationFn: () => api.post(`/api/economie/${etudeId}/recalculer/`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["etude-economique", etudeId] }),
  });

  const { mutate: dupliquer, isPending: duplication } = useMutation({
    mutationFn: (est_variante: boolean) =>
      api.post(`/api/economie/${etudeId}/dupliquer/`, { est_variante }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["etudes-economiques", projetId] }),
  });

  const { mutate: autoAffecter, isPending: autoAffectationEnCours } = useMutation({
    mutationFn: () => api.post<{ detail: string; non_trouvees?: string[] }>(`/api/economie/${etudeId}/auto-affecter-phases/`, {}),
    onSuccess: async (reponse) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["etude-economique", etudeId] }),
        queryClient.invalidateQueries({ queryKey: ["projet", projetId] }),
        queryClient.invalidateQueries({ queryKey: ["projet-synthese", projetId] }),
      ]);
      const complement = reponse.non_trouvees?.length
        ? ` Phases sans candidat : ${reponse.non_trouvees.join(", ")}.`
        : "";
      notifications.succes(`${reponse.detail}${complement}`);
    },
    onError: (erreur) => {
      notifications.erreur(
        erreur instanceof ErreurApi ? erreur.detail : "Affectation automatique impossible."
      );
    },
  });

  useEffect(() => {
    if (!etude) return;
    setPhasesEdition((precedent) => {
      const suivant = { ...precedent };
      etude.phases.forEach((phase) => {
        suivant[phase.id] = {
          utilisateurAssigne: phase.utilisateur_assigne ?? "",
          dureePrevisionnelle: String(phase.duree_previsionnelle_jours ?? ""),
          dureeRevisee: phase.duree_revisee_jours == null ? "" : String(phase.duree_revisee_jours),
          statut: phase.statut,
          motif: precedent[phase.id]?.motif ?? "",
        };
      });
      return suivant;
    });
  }, [etude]);

  function mettreAJourPhase(
    phaseId: string,
    champ: "utilisateurAssigne" | "dureePrevisionnelle" | "dureeRevisee" | "statut" | "motif",
    valeur: string
  ) {
    setPhasesEdition((precedent) => ({
      ...precedent,
      [phaseId]: {
        utilisateurAssigne: precedent[phaseId]?.utilisateurAssigne ?? "",
        dureePrevisionnelle: precedent[phaseId]?.dureePrevisionnelle ?? "",
        dureeRevisee: precedent[phaseId]?.dureeRevisee ?? "",
        statut: precedent[phaseId]?.statut ?? "a_planifier",
        motif: precedent[phaseId]?.motif ?? "",
        [champ]: valeur,
      },
    }));
  }

  async function enregistrerPhase(phase: PhaseEtude) {
    const edition = phasesEdition[phase.id];
    if (!edition) return;

    const payload: Record<string, unknown> = {};
    if (edition.utilisateurAssigne !== (phase.utilisateur_assigne ?? "")) {
      payload.utilisateur_assigne = edition.utilisateurAssigne || null;
    }
    if (edition.dureePrevisionnelle !== String(phase.duree_previsionnelle_jours ?? "")) {
      payload.duree_previsionnelle_jours = edition.dureePrevisionnelle === "" ? null : edition.dureePrevisionnelle;
    }
    const dureeReviseeActuelle = phase.duree_revisee_jours == null ? "" : String(phase.duree_revisee_jours);
    if (edition.dureeRevisee !== dureeReviseeActuelle) {
      payload.duree_revisee_jours = edition.dureeRevisee === "" ? null : edition.dureeRevisee;
    }
    if (edition.statut !== phase.statut) {
      payload.statut = edition.statut;
    }
    if (edition.motif.trim()) {
      payload.motif_ajustement = edition.motif.trim();
    }

    if (Object.keys(payload).length === 0) {
      notifications.info("Aucune modification à enregistrer sur cette phase.");
      return;
    }

    setPhaseEnregistrementId(phase.id);
    try {
      await api.patch(`/api/economie/${etudeId}/phases/${phase.id}/`, payload);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["etude-economique", etudeId] }),
        queryClient.invalidateQueries({ queryKey: ["projet", projetId] }),
        queryClient.invalidateQueries({ queryKey: ["projet-synthese", projetId] }),
      ]);
      notifications.succes(`Phase « ${phase.libelle} » mise à jour.`);
      setPhasesEdition((precedent) => ({
        ...precedent,
        [phase.id]: {
          ...precedent[phase.id],
          motif: "",
        },
      }));
    } catch (erreur) {
      notifications.erreur(
        erreur instanceof ErreurApi ? erreur.detail : "Impossible d'enregistrer cette phase."
      );
    } finally {
      setPhaseEnregistrementId(null);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400 text-sm">
        Chargement de l&apos;étude…
      </div>
    );
  }

  if (isError || !etude) {
    return (
      <div className="carte text-center py-12">
        <p className="text-red-500 mb-4">Impossible de charger cette étude.</p>
        <Link href={`/projets/${projetId}/economie`} className="btn-secondaire">
          ← Retour aux études
        </Link>
      </div>
    );
  }

  const tauxGlobal = Number(etude.taux_marge_nette_global);

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href={`/projets/${projetId}/economie`}
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-2"
          >
            <ArrowLeft size={14} /> Économie
          </Link>
          <div className="flex items-center gap-3">
            <h1>{etude.intitule}</h1>
            <span className="font-mono text-xs text-slate-400">v{etude.version}</span>
            {etude.est_variante && <span className="badge-neutre">variante</span>}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => recalculer()}
            disabled={recalcul}
            className="btn-secondaire text-xs flex items-center gap-1"
          >
            <RefreshCw size={12} className={recalcul ? "animate-spin" : ""} />
            Recalculer
          </button>
          <button
            onClick={() => dupliquer(true)}
            disabled={duplication}
            className="btn-secondaire text-xs flex items-center gap-1"
          >
            <Copy size={12} /> Variante
          </button>
        </div>
      </div>

      {/* Synthèse financière */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { lib: "Déboursé sec HT", val: etude.total_debourse_sec },
          { lib: "Coût de revient HT", val: etude.total_cout_revient },
          { lib: "Prix de vente HT", val: etude.total_prix_vente, accent: true },
          { lib: "Marge nette HT", val: etude.total_marge_nette },
        ].map(({ lib, val, accent }) => (
          <div key={lib} className={clsx("carte", accent && "border-primaire-200")}>
            <p className="text-xs text-slate-500 mb-1">{lib}</p>
            <p className={clsx("font-mono font-semibold text-lg", accent && "text-primaire-700")}>
              {formaterMontant(val)}
            </p>
          </div>
        ))}
      </div>

      {/* Indicateur marge globale */}
      <div className="carte flex items-center gap-4">
        <div className="flex items-center gap-2">
          <IconeMarge taux={tauxGlobal} />
          <span className="font-medium">Taux de marge nette global :</span>
        </div>
        <span className={clsx(
          "font-mono text-xl font-bold",
          tauxGlobal >= 0.08 ? "text-green-600" : tauxGlobal >= 0.03 ? "text-yellow-600" : "text-red-600"
        )}>
          {formaterPourcent(etude.taux_marge_nette_global)}
        </span>
        <span className="text-xs text-slate-400 ml-auto">
          {etude.lignes.length} ligne{etude.lignes.length > 1 ? "s" : ""}
        </span>
      </div>

      {/* Planification des phases */}
      <div className="carte space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="flex items-center gap-2">
              <Wand2 size={16} /> Phases et intervenants
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Durées prévues, collaborateurs affectés et journal des ajustements de l&apos;étude.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => autoAffecter()}
              disabled={autoAffectationEnCours}
              className="btn-primaire text-xs flex items-center gap-1"
            >
              <Wand2 size={12} />
              {autoAffectationEnCours ? "Affectation…" : "Auto-affecter"}
            </button>
            {utilisateur?.est_super_admin && (
              <Link href="/administration/phases-etudes" className="btn-secondaire text-xs">
                Administrer les modèles
              </Link>
            )}
          </div>
        </div>

        {etude.phases.length === 0 ? (
          <p className="text-sm text-slate-500">Aucune phase n&apos;est encore définie pour cette étude.</p>
        ) : (
          <div className="space-y-4">
            {etude.phases
              .slice()
              .sort((a, b) => a.ordre - b.ordre)
              .map((phase) => {
                const edition = phasesEdition[phase.id] ?? {
                  utilisateurAssigne: phase.utilisateur_assigne ?? "",
                  dureePrevisionnelle: String(phase.duree_previsionnelle_jours ?? ""),
                  dureeRevisee: phase.duree_revisee_jours == null ? "" : String(phase.duree_revisee_jours),
                  statut: phase.statut,
                  motif: "",
                };
                const utilisateurPeutAjuster = Boolean(
                  utilisateur?.est_super_admin || phase.utilisateur_assigne === utilisateur?.id
                );

                return (
                  <div key={phase.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold text-slate-900">{phase.ordre}. {phase.libelle}</h3>
                          <span className="badge-neutre">{phase.role_intervenant_libelle}</span>
                          <span className="badge-info">{phase.statut.replace(/_/g, " ")}</span>
                        </div>
                        {phase.description && (
                          <p className="text-sm text-slate-500 mt-1">{phase.description}</p>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-xs text-slate-500 md:grid-cols-4">
                        <div>
                          <p className="uppercase tracking-wide">Spécialité</p>
                          <p className="mt-1 text-sm font-medium text-slate-800">{phase.specialite_requise || "—"}</p>
                        </div>
                        <div>
                          <p className="uppercase tracking-wide">Niveau</p>
                          <p className="mt-1 text-sm font-medium text-slate-800">{phase.niveau_intervention || "—"}</p>
                        </div>
                        <div>
                          <p className="uppercase tracking-wide">Affecté</p>
                          <p className="mt-1 text-sm font-medium text-slate-800">{phase.utilisateur_assigne_nom || "Non affecté"}</p>
                        </div>
                        <div>
                          <p className="uppercase tracking-wide">Durée active</p>
                          <p className="mt-1 text-sm font-medium text-slate-800">{phase.duree_active_jours} j</p>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="grid gap-3 md:grid-cols-2">
                        <div>
                          <label className="libelle-champ">Durée prévisionnelle (j)</label>
                          <input
                            type="number"
                            min="0"
                            step="0.25"
                            className="champ-saisie w-full"
                            value={edition.dureePrevisionnelle}
                            disabled={!utilisateur?.est_super_admin}
                            onChange={(event) => mettreAJourPhase(phase.id, "dureePrevisionnelle", event.target.value)}
                          />
                        </div>
                        <div>
                          <label className="libelle-champ">Durée révisée (j)</label>
                          <input
                            type="number"
                            min="0"
                            step="0.25"
                            className="champ-saisie w-full"
                            value={edition.dureeRevisee}
                            disabled={!utilisateurPeutAjuster}
                            onChange={(event) => mettreAJourPhase(phase.id, "dureeRevisee", event.target.value)}
                          />
                        </div>
                        <div>
                          <label className="libelle-champ">Collaborateur</label>
                          <select
                            className="champ-saisie w-full"
                            value={edition.utilisateurAssigne}
                            disabled={!utilisateur?.est_super_admin}
                            onChange={(event) => mettreAJourPhase(phase.id, "utilisateurAssigne", event.target.value)}
                          >
                            <option value="">Non affecté</option>
                            {utilisateurs.map((option) => (
                              <option key={option.id} value={option.id}>
                                {option.nom_complet}{option.fonction ? ` — ${option.fonction}` : ""}{option.profil_libelle ? ` (${option.profil_libelle})` : ""}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="libelle-champ">Statut</label>
                          <select
                            className="champ-saisie w-full"
                            value={edition.statut}
                            disabled={!utilisateur?.est_super_admin}
                            onChange={(event) => mettreAJourPhase(phase.id, "statut", event.target.value)}
                          >
                            <option value="a_planifier">À planifier</option>
                            <option value="planifiee">Planifiée</option>
                            <option value="en_cours">En cours</option>
                            <option value="terminee">Terminée</option>
                            <option value="bloquee">Bloquée</option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="libelle-champ">Motif d&apos;ajustement</label>
                          <textarea
                            className="champ-saisie min-h-[108px] w-full"
                            placeholder={utilisateurPeutAjuster ? "Expliquer l'ajustement de charge, de durée ou d'affectation." : "Seul l'intervenant concerné ou l'administrateur peut saisir un motif."}
                            value={edition.motif}
                            disabled={!utilisateurPeutAjuster && !utilisateur?.est_super_admin}
                            onChange={(event) => mettreAJourPhase(phase.id, "motif", event.target.value)}
                          />
                        </div>
                        {phase.motif_dernier_ajustement && (
                          <p className="text-xs text-slate-500">
                            Dernier motif enregistré : {phase.motif_dernier_ajustement}
                          </p>
                        )}
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => enregistrerPhase(phase)}
                            disabled={phaseEnregistrementId === phase.id || (!utilisateurPeutAjuster && !utilisateur?.est_super_admin)}
                            className="btn-secondaire text-xs inline-flex items-center gap-1"
                          >
                            <Save size={12} />
                            {phaseEnregistrementId === phase.id ? "Enregistrement…" : "Enregistrer la phase"}
                          </button>
                        </div>
                      </div>
                    </div>

                    {phase.journal.length > 0 && (
                      <div className="rounded-xl border border-slate-200 bg-white p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                          Journal des ajustements
                        </p>
                        <ul className="space-y-2 text-sm text-slate-600">
                          {phase.journal.slice(0, 4).map((entree) => (
                            <li key={entree.id} className="rounded-lg bg-slate-50 px-3 py-2">
                              <span className="font-medium text-slate-800">{entree.auteur_nom || "Système"}</span>
                              {" · "}
                              <span>{entree.nouvelle_duree_jours} j</span>
                              {" · "}
                              <span>{formaterDateHeure(entree.date_creation)}</span>
                              <p className="mt-1 text-xs text-slate-500">{entree.motif}</p>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* Lignes de prix */}
      <div className="carte">
        <div className="flex items-center justify-between mb-4">
          <h2 className="flex items-center gap-2">
            <Euro size={16} /> Lignes de prix
          </h2>
          <Link
            href={`/projets/${projetId}/economie/${etudeId}/lignes/nouvelle`}
            className="btn-primaire text-xs"
          >
            + Ajouter
          </Link>
        </div>

        {etude.lignes.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">
            Aucune ligne de prix. Commencez par en ajouter une.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs text-slate-500">
                  <th className="text-left py-2 pr-2 font-medium w-6">#</th>
                  <th className="text-left py-2 pr-4 font-medium">Désignation</th>
                  <th className="text-right py-2 pr-3 font-medium">Qté</th>
                  <th className="text-right py-2 pr-3 font-medium">PV unit. HT</th>
                  <th className="text-right py-2 pr-3 font-medium">PV total HT</th>
                  <th className="text-right py-2 pr-3 font-medium">Marge nette</th>
                  <th className="text-center py-2 font-medium">État</th>
                </tr>
              </thead>
              <tbody>
                {etude.lignes.map((ligne) => (
                  <>
                    <tr
                      key={ligne.id}
                      className="border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={() => setLigneOuverte(ligneOuverte === ligne.id ? null : ligne.id)}
                    >
                      <td className="py-2 pr-2 font-mono text-xs text-slate-400">
                        <div className="flex items-center gap-0.5">
                          {ligneOuverte === ligne.id
                            ? <ChevronDown size={12} />
                            : <ChevronRight size={12} />}
                          {ligne.numero_ordre}
                        </div>
                      </td>
                      <td className="py-2 pr-4">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setLigneOuverte(ligneOuverte === ligne.id ? null : ligne.id);
                          }}
                          className="max-w-xs truncate font-medium text-left transition-colors hover:text-primaire-600"
                        >
                          {ligne.designation}
                        </button>
                        {ligne.code && (
                          <p className="text-xs text-slate-400 font-mono">{ligne.code}</p>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-right font-mono text-xs">
                        {Number(ligne.quantite_prevue).toLocaleString("fr-FR")} {ligne.unite}
                      </td>
                      <td className="py-2 pr-3 text-right font-mono text-xs">
                        {formaterMontant(ligne.prix_vente_unitaire)}
                      </td>
                      <td className="py-2 pr-3 text-right font-mono text-xs font-medium">
                        {formaterMontant(
                          Number(ligne.prix_vente_unitaire) * Number(ligne.quantite_prevue)
                        )}
                      </td>
                      <td className="py-2 pr-3 text-right font-mono text-xs">
                        <span className={clsx(
                          Number(ligne.taux_marge_nette) >= 0.08 ? "text-green-600" :
                          Number(ligne.taux_marge_nette) >= 0.03 ? "text-yellow-600" : "text-red-600"
                        )}>
                          {formaterPourcent(ligne.taux_marge_nette)}
                        </span>
                      </td>
                      <td className="py-2 text-center">
                        <span className={clsx("text-xs", STYLES_ETAT[ligne.etat_rentabilite] || "badge-neutre")}>
                          {ligne.etat_libelle}
                        </span>
                      </td>
                    </tr>
                    {ligneOuverte === ligne.id && (
                      <tr key={`${ligne.id}-detail`} className="bg-slate-50">
                        <td colSpan={7} className="px-6 py-3">
                          <div className="grid grid-cols-3 gap-6 text-xs">
                            <div>
                              <p className="font-medium text-slate-600 mb-2">Décomposition unitaire</p>
                              <dl className="space-y-1 text-slate-500">
                                <div className="flex justify-between">
                                  <dt>Déboursé sec</dt>
                                  <dd className="font-mono">{formaterMontant(ligne.debourse_sec_unitaire)}</dd>
                                </div>
                                <div className="flex justify-between">
                                  <dt>Coût de revient</dt>
                                  <dd className="font-mono">{formaterMontant(ligne.cout_revient_unitaire)}</dd>
                                </div>
                                <div className="flex justify-between">
                                  <dt>Marge nette</dt>
                                  <dd className="font-mono">{formaterMontant(ligne.marge_nette_unitaire)}</dd>
                                </div>
                              </dl>
                            </div>
                            <div>
                              <p className="font-medium text-slate-600 mb-2">Contribution</p>
                              <dl className="space-y-1 text-slate-500">
                                <div className="flex justify-between">
                                  <dt>Marge nette totale</dt>
                                  <dd className="font-mono">{formaterMontant(ligne.marge_nette_totale)}</dd>
                                </div>
                                <div className="flex justify-between">
                                  <dt>Part dans le lot</dt>
                                  <dd className="font-mono">{formaterPourcent(ligne.contribution_marge)}</dd>
                                </div>
                              </dl>
                            </div>
                            {ligne.causes_non_rentabilite.length > 0 && (
                              <div>
                                <p className="font-medium text-red-600 mb-2">Alertes</p>
                                <ul className="space-y-1 text-red-500">
                                  {ligne.causes_non_rentabilite.map((cause, i) => (
                                    <li key={i} className="text-xs leading-relaxed">{cause}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
              {/* Pied de tableau — totaux */}
              <tfoot className="border-t-2 border-slate-200">
                <tr className="font-medium text-sm">
                  <td colSpan={4} className="py-3 pr-3 text-right text-slate-500">Total</td>
                  <td className="py-3 pr-3 text-right font-mono font-bold">
                    {formaterMontant(etude.total_prix_vente)}
                  </td>
                  <td className="py-3 pr-3 text-right font-mono font-bold">
                    <span className={clsx(
                      tauxGlobal >= 0.08 ? "text-green-600" : tauxGlobal >= 0.03 ? "text-yellow-600" : "text-red-600"
                    )}>
                      {formaterPourcent(etude.taux_marge_nette_global)}
                    </span>
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
