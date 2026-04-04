"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { api, ErreurApi, extraireListeResultats } from "@/crochets/useApi";
import processusExecution from "@/contenus/execution/processus.json";
import {
  ClipboardList, Download, FileCheck, GitBranch, Plus, RefreshCcw, Save, Send, Users, CheckCircle,
} from "lucide-react";

interface ProcessusDefinition {
  code: string;
  libelle: string;
  description: string;
}

interface SuiviExecution {
  id: string;
  projet: string;
  projet_reference: string;
  entreprise_nom: string | null;
  date_os_demarrage: string | null;
  date_fin_contractuelle: string | null;
  montant_marche_ht: number | null;
  montant_total_ht: number;
  processus_maitrise: Record<string, boolean>;
  points_vigilance: string[];
  prochaines_actions: string[];
  observations_pilotage: string;
  total_processus: number;
  nb_processus_maitrises: number;
  taux_maitrise_processus: number;
}

interface CompteRendu {
  id: string;
  numero: number;
  date_reunion: string;
  avancement_physique_pct: string | null;
  redacteur_nom: string | null;
  decisions: string;
}

interface Situation {
  id: string;
  numero: number;
  periode_debut: string;
  periode_fin: string;
  statut: string;
  statut_libelle: string;
  montant_cumule_ht: number;
  montant_periode_ht: number;
}

interface OrdreService {
  id: string;
  numero: number;
  type_ordre: string;
  type_libelle: string;
  date_emission: string;
  objet: string;
}

interface AffectationEquipeTache {
  id?: string;
  profil: string;
  profil_libelle?: string;
  effectif: number;
  rendement_relatif: string;
  est_chef_equipe: boolean;
}

interface TachePlanning {
  id: string;
  planning: string;
  numero_ordre: number;
  code: string;
  designation: string;
  unite: string;
  quantite: number | string;
  temps_unitaire_heures: number | string;
  heures_totales: number | string;
  effectif_alloue: number;
  duree_jours: number | string;
  decalage_jours: number | string;
  date_debut_calculee: string | null;
  date_fin_calculee: string | null;
  marge_libre_jours: number | string;
  est_critique: boolean;
  mode_calcul: "auto" | "manuel";
  ref_ligne_economique: string | null;
  ref_ligne_economique_code: string | null;
  ref_ligne_prix: string | null;
  ref_ligne_prix_code: string | null;
  metadata_calcul: Record<string, string>;
  observations: string;
  affectations_equipe: AffectationEquipeTache[];
  dependances_entrantes: DependancePlanning[];
}

interface DependancePlanning {
  id: string;
  tache_amont: string;
  tache_amont_designation: string;
  tache_aval: string;
  tache_aval_designation: string;
  type_dependance: "fd" | "dd";
  type_dependance_libelle: string;
  decalage_jours: number | string;
}

interface PlanningChantier {
  id: string;
  intitule: string;
  source_donnees: "manuel" | "etude_economique" | "etude_prix";
  source_donnees_libelle: string;
  etude_economique: string | null;
  etude_economique_intitule: string | null;
  etude_prix: string | null;
  etude_prix_intitule: string | null;
  date_debut_reference: string;
  heures_par_jour: number | string;
  coefficient_rendement_global: number | string;
  jours_ouvres: number[];
  jours_feries: string[];
  lisser_ressources_partagees: boolean;
  chemin_critique: string[];
  synthese_calcul: {
    duree_totale_jours?: string;
    nb_taches?: number;
    nb_taches_critiques?: number;
    nb_conflits_ressources?: number;
  };
  taches: TachePlanning[];
}

interface EtudeEconomiqueListe {
  id: string;
  intitule: string;
  projet_reference: string | null;
  total_prix_vente: number | string;
}

interface EtudePrixListe {
  id: string;
  intitule: string;
  projet_reference: string | null;
  debourse_sec_ht: number | string;
}

interface ProfilMainOeuvre {
  id: string;
  code: string;
  libelle: string;
  categorie_libelle: string;
}

interface FormulairePilotage {
  processus_maitrise: Record<string, boolean>;
  points_vigilance: string;
  prochaines_actions: string;
  observations_pilotage: string;
}

const STYLES_SITUATION: Record<string, string> = {
  en_cours: "badge-info",
  soumise: "badge-alerte",
  acceptee: "badge-alerte",
  contestee: "badge-danger",
  validee_moa: "badge-succes",
  payee: "badge-succes",
};

const JOURS_SEMAINE = [
  { valeur: 0, libelle: "Lun" },
  { valeur: 1, libelle: "Mar" },
  { valeur: 2, libelle: "Mer" },
  { valeur: 3, libelle: "Jeu" },
  { valeur: 4, libelle: "Ven" },
  { valeur: 5, libelle: "Sam" },
  { valeur: 6, libelle: "Dim" },
];

function formaterDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR");
}

function formaterMontant(val: number | null) {
  if (val == null) return "—";
  return `${Number(val).toLocaleString("fr-FR", { minimumFractionDigits: 0 })} €`;
}

function formaterNombre(valeur: number | string | null, decimales = 2) {
  if (valeur == null || valeur === "") return "—";
  return Number(valeur).toLocaleString("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimales,
  });
}

function formaterDuree(valeur: number | string | null) {
  if (valeur == null || valeur === "") return "—";
  return `${formaterNombre(valeur, 2)} j`;
}

function listeVersTexte(elements: string[] | null | undefined) {
  return (elements ?? []).join("\n");
}

function texteVersListe(texte: string) {
  return texte
    .split("\n")
    .map((ligne) => ligne.trim())
    .filter(Boolean);
}

function initialiserFormulairePilotage(suivi: SuiviExecution): FormulairePilotage {
  return {
    processus_maitrise: { ...(suivi.processus_maitrise || {}) },
    points_vigilance: listeVersTexte(suivi.points_vigilance),
    prochaines_actions: listeVersTexte(suivi.prochaines_actions),
    observations_pilotage: suivi.observations_pilotage || "",
  };
}

function listeDatesVersTexte(elements: string[] | null | undefined) {
  return (elements ?? []).join("\n");
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

function calculerJoursEcart(debut: string | null, fin: string | null) {
  if (!debut || !fin) return 0;
  const dateDebut = new Date(`${debut}T00:00:00`);
  const dateFin = new Date(`${fin}T00:00:00`);
  return Math.max(Math.round((dateFin.getTime() - dateDebut.getTime()) / 86400000), 0);
}

function largeurTache(planning: PlanningChantier, tache: TachePlanning) {
  const total = Math.max(Number(planning.synthese_calcul?.duree_totale_jours || 1), 1);
  const debut = calculerJoursEcart(planning.date_debut_reference, tache.date_debut_calculee);
  const duree = Math.max(Number(tache.duree_jours || 1), 1);
  return {
    left: `${Math.min((debut / total) * 100, 100)}%`,
    width: `${Math.max((duree / total) * 100, 3)}%`,
  };
}

function OngletComptesRendus({ suiviId }: { suiviId: string }) {
  const [ouvert, setOuvert] = useState(false);
  const [form, setForm] = useState({ date_reunion: "", contenu: "", decisions: "" });
  const queryClient = useQueryClient();

  const { data } = useQuery<{ results: CompteRendu[] }>({
    queryKey: ["comptes-rendus", suiviId],
    queryFn: () => api.get<{ results: CompteRendu[] }>(`/api/execution/${suiviId}/comptes-rendus/?ordering=-date_reunion`),
  });

  const { mutate: creer, isPending } = useMutation({
    mutationFn: () => api.post(`/api/execution/${suiviId}/comptes-rendus/`, {
      suivi: suiviId,
      numero: (data?.results.length ?? 0) + 1,
      ...form,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comptes-rendus", suiviId] });
      setOuvert(false);
      setForm({ date_reunion: "", contenu: "", decisions: "" });
    },
  });

  const crs = data?.results ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-600">
          <ClipboardList size={14} className="inline mr-1" />
          Comptes rendus ({crs.length})
        </p>
        <button onClick={() => setOuvert(!ouvert)} className="btn-secondaire text-xs flex items-center gap-1">
          <Plus size={12} /> Nouveau CR
        </button>
      </div>

      {ouvert && (
        <div className="border border-slate-200 rounded-lg p-4 space-y-3 bg-slate-50">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="libelle-champ">Date de réunion</label>
              <input
                type="date"
                className="champ-saisie font-mono"
                value={form.date_reunion}
                onChange={(e) => setForm((precedent) => ({ ...precedent, date_reunion: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="libelle-champ">Contenu *</label>
            <textarea
              rows={3}
              className="champ-saisie"
              value={form.contenu}
              onChange={(e) => setForm((precedent) => ({ ...precedent, contenu: e.target.value }))}
            />
          </div>
          <div>
            <label className="libelle-champ">Décisions</label>
            <textarea
              rows={2}
              className="champ-saisie"
              value={form.decisions}
              onChange={(e) => setForm((precedent) => ({ ...precedent, decisions: e.target.value }))}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setOuvert(false)} className="btn-secondaire text-xs">Annuler</button>
            <button
              onClick={() => creer()}
              disabled={isPending || !form.date_reunion || !form.contenu}
              className="btn-primaire text-xs"
            >
              {isPending ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </div>
      )}

      {crs.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-4">Aucun compte rendu.</p>
      ) : (
        <div className="space-y-2">
          {crs.map((cr) => (
            <div key={cr.id} className="flex items-start justify-between p-3 bg-slate-50 rounded-lg text-sm">
              <div>
                <span className="font-mono text-xs text-slate-500 mr-2">CR #{cr.numero}</span>
                <span className="font-medium">{formaterDate(cr.date_reunion)}</span>
                {cr.decisions && <p className="text-xs text-slate-500 mt-1 truncate max-w-lg">{cr.decisions}</p>}
              </div>
              {cr.avancement_physique_pct && (
                <span className="badge-info font-mono text-xs">{cr.avancement_physique_pct}%</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function OngletSituations({ suiviId }: { suiviId: string }) {
  const queryClient = useQueryClient();

  const { data } = useQuery<{ results: Situation[] }>({
    queryKey: ["situations", suiviId],
    queryFn: () => api.get<{ results: Situation[] }>(`/api/execution/${suiviId}/situations/?ordering=-numero`),
  });

  const { mutate: valider, variables: validationEnCours } = useMutation({
    mutationFn: (id: string) => api.post(`/api/execution/${suiviId}/situations/${id}/valider/`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["situations", suiviId] }),
  });

  const situations = data?.results ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-600">
          <FileCheck size={14} className="inline mr-1" />
          Situations de travaux ({situations.length})
        </p>
      </div>

      {situations.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-4">Aucune situation de travaux.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-xs text-slate-500">
              <th className="text-left py-2 pr-4 font-medium">N°</th>
              <th className="text-left py-2 pr-4 font-medium">Période</th>
              <th className="text-left py-2 pr-4 font-medium">Statut</th>
              <th className="text-right py-2 pr-4 font-medium">Montant période</th>
              <th className="text-right py-2 pr-4 font-medium">Cumulé</th>
              <th className="text-right py-2 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {situations.map((situation) => (
              <tr key={situation.id} className="border-b border-slate-50">
                <td className="py-3 pr-4 font-mono text-xs">#{situation.numero}</td>
                <td className="py-3 pr-4 text-xs text-slate-500">
                  {formaterDate(situation.periode_debut)} → {formaterDate(situation.periode_fin)}
                </td>
                <td className="py-3 pr-4">
                  <span className={clsx(STYLES_SITUATION[situation.statut] || "badge-neutre")}>
                    {situation.statut_libelle}
                  </span>
                </td>
                <td className="py-3 pr-4 text-right font-mono text-xs">{formaterMontant(situation.montant_periode_ht)}</td>
                <td className="py-3 pr-4 text-right font-mono text-xs font-medium">{formaterMontant(situation.montant_cumule_ht)}</td>
                <td className="py-3 text-right">
                  {situation.statut === "soumise" && (
                    <button
                      onClick={() => valider(situation.id)}
                      disabled={validationEnCours === situation.id}
                      className="btn-secondaire text-xs flex items-center gap-1 ml-auto"
                    >
                      <CheckCircle size={12} />
                      {validationEnCours === situation.id ? "…" : "Valider"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function OngletOrdresService({ suiviId }: { suiviId: string }) {
  const [ouvert, setOuvert] = useState(false);
  const [form, setForm] = useState({ type_ordre: "demarrage", date_emission: "", objet: "" });
  const queryClient = useQueryClient();

  const { data } = useQuery<{ results: OrdreService[] }>({
    queryKey: ["ordres-service", suiviId],
    queryFn: () => api.get<{ results: OrdreService[] }>(`/api/execution/${suiviId}/ordres-service/?ordering=-date_emission`),
  });

  const { mutate: creer, isPending } = useMutation({
    mutationFn: () => api.post(`/api/execution/${suiviId}/ordres-service/`, {
      suivi: suiviId,
      numero: (data?.results.length ?? 0) + 1,
      ...form,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ordres-service", suiviId] });
      setOuvert(false);
      setForm({ type_ordre: "demarrage", date_emission: "", objet: "" });
    },
  });

  const os = data?.results ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-600">
          <Send size={14} className="inline mr-1" />
          Ordres de service ({os.length})
        </p>
        <button onClick={() => setOuvert(!ouvert)} className="btn-secondaire text-xs flex items-center gap-1">
          <Plus size={12} /> Nouvel OS
        </button>
      </div>

      {ouvert && (
        <div className="border border-slate-200 rounded-lg p-4 space-y-3 bg-slate-50">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="libelle-champ">Type</label>
              <select
                className="champ-saisie"
                value={form.type_ordre}
                onChange={(e) => setForm((precedent) => ({ ...precedent, type_ordre: e.target.value }))}
              >
                <option value="demarrage">Démarrage</option>
                <option value="suspension">Suspension</option>
                <option value="reprise">Reprise</option>
                <option value="modification">Modification</option>
                <option value="arret_definitif">Arrêt définitif</option>
              </select>
            </div>
            <div>
              <label className="libelle-champ">Date d&apos;émission</label>
              <input
                type="date"
                className="champ-saisie font-mono"
                value={form.date_emission}
                onChange={(e) => setForm((precedent) => ({ ...precedent, date_emission: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="libelle-champ">Objet *</label>
            <input
              type="text"
              className="champ-saisie"
              value={form.objet}
              onChange={(e) => setForm((precedent) => ({ ...precedent, objet: e.target.value }))}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setOuvert(false)} className="btn-secondaire text-xs">Annuler</button>
            <button
              onClick={() => creer()}
              disabled={isPending || !form.date_emission || !form.objet}
              className="btn-primaire text-xs"
            >
              {isPending ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </div>
      )}

      {os.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-4">Aucun ordre de service.</p>
      ) : (
        <div className="space-y-2">
          {os.map((ordre) => (
            <div key={ordre.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg text-sm">
              <div>
                <span className="font-mono text-xs text-slate-500 mr-2">OS #{ordre.numero}</span>
                <span className="badge-neutre mr-2">{ordre.type_libelle}</span>
                <span className="font-medium">{ordre.objet}</span>
              </div>
              <span className="text-xs text-slate-400 shrink-0 ml-4">{formaterDate(ordre.date_emission)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function OngletPlanning({ suiviId, projetId }: { suiviId: string; projetId: string }) {
  const queryClient = useQueryClient();
  const [creationOuverte, setCreationOuverte] = useState(false);
  const [planningActifId, setPlanningActifId] = useState<string | null>(null);
  const [tacheOuverteId, setTacheOuverteId] = useState<string | null>(null);
  const [telechargementXlsx, setTelechargementXlsx] = useState<string | null>(null);
  const [telechargementPlanning, setTelechargementPlanning] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [formCreation, setFormCreation] = useState({
    intitule: "Planning travaux",
    source_donnees: "etude_economique" as PlanningChantier["source_donnees"],
    etude_economique: "",
    etude_prix: "",
    date_debut_reference: new Date().toISOString().slice(0, 10),
    heures_par_jour: "7.00",
    coefficient_rendement_global: "1.0000",
  });
  const [formConfigurationPlanning, setFormConfigurationPlanning] = useState({
    date_debut_reference: new Date().toISOString().slice(0, 10),
    heures_par_jour: "7.00",
    coefficient_rendement_global: "1.0000",
    jours_ouvres: [0, 1, 2, 3, 4] as number[],
    jours_feries: "",
    lisser_ressources_partagees: true,
  });
  const [brouillonsTaches, setBrouillonsTaches] = useState<Record<string, {
    quantite: string;
    temps_unitaire_heures: string;
    effectif_alloue: string;
    decalage_jours: string;
    mode_calcul: "auto" | "manuel";
    observations: string;
  }>>({});
  const [brouillonsAffectations, setBrouillonsAffectations] = useState<Record<string, AffectationEquipeTache[]>>({});
  const [brouillonsDependances, setBrouillonsDependances] = useState<Record<string, {
    tache_amont: string;
    type_dependance: "fd" | "dd";
    decalage_jours: string;
  }>>({});

  const { data: reponsePlannings } = useQuery<{ results?: PlanningChantier[] }>({
    queryKey: ["plannings-chantier", suiviId],
    queryFn: () => api.get<{ results?: PlanningChantier[] }>(`/api/execution/${suiviId}/plannings/`),
  });
  const { data: reponseEtudesEconomiques } = useQuery<{ results?: EtudeEconomiqueListe[] }>({
    queryKey: ["etudes-economiques", projetId],
    queryFn: () => api.get<{ results?: EtudeEconomiqueListe[] }>(`/api/economie/?projet=${projetId}`),
  });
  const { data: reponseEtudesPrix } = useQuery<{ results?: EtudePrixListe[] }>({
    queryKey: ["etudes-prix", projetId],
    queryFn: () => api.get<{ results?: EtudePrixListe[] }>(`/api/economie/etudes-de-prix/?projet=${projetId}`),
  });
  const { data: reponseProfils } = useQuery<{ results?: ProfilMainOeuvre[] }>({
    queryKey: ["profils-main-oeuvre-actifs"],
    queryFn: () => api.get<{ results?: ProfilMainOeuvre[] }>("/api/economie/profils-main-oeuvre/?actifs=1"),
  });

  const plannings = extraireListeResultats(reponsePlannings);
  const etudesEconomiques = extraireListeResultats(reponseEtudesEconomiques);
  const etudesPrix = extraireListeResultats(reponseEtudesPrix);
  const profils = extraireListeResultats(reponseProfils);

  useEffect(() => {
    if (!planningActifId && plannings.length > 0) {
      setPlanningActifId(plannings[0].id);
    }
    if (planningActifId && !plannings.some((planning) => planning.id === planningActifId)) {
      setPlanningActifId(plannings[0]?.id || null);
    }
  }, [planningActifId, plannings]);

  const planningActif = plannings.find((planning) => planning.id === planningActifId) || null;

  useEffect(() => {
    if (!planningActif) return;
    setFormConfigurationPlanning({
      date_debut_reference: planningActif.date_debut_reference,
      heures_par_jour: String(planningActif.heures_par_jour ?? "7.00"),
      coefficient_rendement_global: String(planningActif.coefficient_rendement_global ?? "1.0000"),
      jours_ouvres: planningActif.jours_ouvres?.length ? planningActif.jours_ouvres : [0, 1, 2, 3, 4],
      jours_feries: listeDatesVersTexte(planningActif.jours_feries),
      lisser_ressources_partagees: Boolean(planningActif.lisser_ressources_partagees),
    });
    setBrouillonsTaches((precedent) => {
      const prochain = { ...precedent };
      for (const tache of planningActif.taches) {
        if (!prochain[tache.id]) {
          prochain[tache.id] = {
            quantite: String(tache.quantite ?? 0),
            temps_unitaire_heures: String(tache.temps_unitaire_heures ?? 0),
            effectif_alloue: String(tache.effectif_alloue ?? 1),
            decalage_jours: String(tache.decalage_jours ?? 0),
            mode_calcul: tache.mode_calcul,
            observations: tache.observations || "",
          };
        }
      }
      return prochain;
    });
    setBrouillonsAffectations((precedent) => {
      const prochain = { ...precedent };
      for (const tache of planningActif.taches) {
        if (!prochain[tache.id]) {
          prochain[tache.id] = tache.affectations_equipe?.length
            ? tache.affectations_equipe.map((affectation) => ({
                profil: affectation.profil,
                profil_libelle: affectation.profil_libelle,
                effectif: affectation.effectif,
                rendement_relatif: String(affectation.rendement_relatif ?? "1.0000"),
                est_chef_equipe: affectation.est_chef_equipe,
              }))
            : [];
        }
      }
      return prochain;
    });
    setBrouillonsDependances((precedent) => {
      const prochain = { ...precedent };
      for (const tache of planningActif.taches) {
        if (!prochain[tache.id]) {
          prochain[tache.id] = {
            tache_amont: planningActif.taches.find((candidate) => candidate.id !== tache.id)?.id || "",
            type_dependance: "fd",
            decalage_jours: "0",
          };
        }
      }
      return prochain;
    });
  }, [planningActif]);

  const invaliderPlanning = async (messageSucces?: string) => {
    await queryClient.invalidateQueries({ queryKey: ["plannings-chantier", suiviId] });
    if (messageSucces) setErreur(null);
  };

  const mutationCreerPlanning = useMutation({
    mutationFn: () => {
      const payload: Record<string, unknown> = {
        intitule: formCreation.intitule,
        source_donnees: formCreation.source_donnees,
        date_debut_reference: formCreation.date_debut_reference,
        heures_par_jour: formCreation.heures_par_jour,
        coefficient_rendement_global: formCreation.coefficient_rendement_global,
      };
      if (formCreation.source_donnees === "etude_economique") {
        payload.etude_economique = formCreation.etude_economique;
      }
      if (formCreation.source_donnees === "etude_prix") {
        payload.etude_prix = formCreation.etude_prix;
      }
      return api.post(`/api/execution/${suiviId}/plannings/`, payload);
    },
    onSuccess: async () => {
      setCreationOuverte(false);
      await invaliderPlanning();
    },
    onError: (e) => {
      setErreur(e instanceof ErreurApi ? e.detail : "Impossible de créer le planning.");
    },
  });

  const mutationRecalculer = useMutation({
    mutationFn: (planningId: string) => api.post(`/api/execution/plannings/${planningId}/recalculer/`, {}),
    onSuccess: async () => {
      await invaliderPlanning();
    },
    onError: (e) => {
      setErreur(e instanceof ErreurApi ? e.detail : "Impossible de recalculer le planning.");
    },
  });

  const mutationSauverConfigurationPlanning = useMutation({
    mutationFn: (planningId: string) => api.patch(`/api/execution/plannings/${planningId}/`, {
      date_debut_reference: formConfigurationPlanning.date_debut_reference,
      heures_par_jour: formConfigurationPlanning.heures_par_jour,
      coefficient_rendement_global: formConfigurationPlanning.coefficient_rendement_global,
      jours_ouvres: formConfigurationPlanning.jours_ouvres,
      jours_feries: texteVersListe(formConfigurationPlanning.jours_feries),
      lisser_ressources_partagees: formConfigurationPlanning.lisser_ressources_partagees,
    }),
    onSuccess: async () => {
      await invaliderPlanning();
    },
    onError: (e) => {
      setErreur(e instanceof ErreurApi ? e.detail : "Impossible de mettre à jour le calendrier du planning.");
    },
  });

  const mutationRegenerer = useMutation({
    mutationFn: (planningId: string) => api.post(`/api/execution/plannings/${planningId}/regenerer/`, {}),
    onSuccess: async () => {
      await invaliderPlanning();
    },
    onError: (e) => {
      setErreur(e instanceof ErreurApi ? e.detail : "Impossible de régénérer les tâches.");
    },
  });

  const mutationNouvelleTache = useMutation({
    mutationFn: (planningId: string) =>
      api.post(`/api/execution/plannings/${planningId}/taches/`, {
        designation: "Nouvelle tâche",
        quantite: "1.000",
        unite: "u",
        temps_unitaire_heures: "7.0000",
        effectif_alloue: 1,
        mode_calcul: "auto",
      }),
    onSuccess: async () => {
      await invaliderPlanning();
    },
    onError: (e) => {
      setErreur(e instanceof ErreurApi ? e.detail : "Impossible d’ajouter la tâche.");
    },
  });

  const mutationSauverTache = useMutation({
    mutationFn: async (tache: TachePlanning) => {
      const brouillon = brouillonsTaches[tache.id];
      const affectations = (brouillonsAffectations[tache.id] || []).filter((affectation) => affectation.profil);
      await api.patch(`/api/execution/plannings/${tache.planning}/taches/${tache.id}/`, {
        quantite: brouillon.quantite,
        temps_unitaire_heures: brouillon.temps_unitaire_heures,
        effectif_alloue: Number(brouillon.effectif_alloue || 1),
        decalage_jours: brouillon.decalage_jours || "0",
        mode_calcul: brouillon.mode_calcul,
        observations: brouillon.observations,
      });
      await api.put(`/api/execution/plannings/${tache.planning}/taches/${tache.id}/affectations/`, {
        affectations: affectations.map((affectation) => ({
          profil: affectation.profil,
          effectif: Number(affectation.effectif || 1),
          rendement_relatif: affectation.rendement_relatif || "1.0000",
          est_chef_equipe: affectation.est_chef_equipe,
        })),
      });
    },
    onSuccess: async () => {
      await invaliderPlanning();
    },
    onError: (e) => {
      setErreur(e instanceof ErreurApi ? e.detail : "Impossible d’enregistrer la tâche.");
    },
  });

  const mutationCreerDependance = useMutation({
    mutationFn: ({ planningId, tacheId }: { planningId: string; tacheId: string }) => {
      const brouillon = brouillonsDependances[tacheId];
      return api.post(`/api/execution/plannings/${planningId}/dependances/`, {
        tache_amont: brouillon.tache_amont,
        tache_aval: tacheId,
        type_dependance: brouillon.type_dependance,
        decalage_jours: brouillon.decalage_jours || "0",
      });
    },
    onSuccess: async () => {
      await invaliderPlanning();
    },
    onError: (e) => {
      setErreur(e instanceof ErreurApi ? e.detail : "Impossible de créer la dépendance.");
    },
  });

  const mutationModifierDependance = useMutation({
    mutationFn: ({
      planningId,
      dependanceId,
      type_dependance,
      decalage_jours,
    }: {
      planningId: string;
      dependanceId: string;
      type_dependance: "fd" | "dd";
      decalage_jours: string;
    }) => api.patch(`/api/execution/plannings/${planningId}/dependances/${dependanceId}/`, {
      type_dependance,
      decalage_jours,
    }),
    onSuccess: async () => {
      await invaliderPlanning();
    },
    onError: (e) => {
      setErreur(e instanceof ErreurApi ? e.detail : "Impossible de modifier la dépendance.");
    },
  });

  const mutationSupprimerDependance = useMutation({
    mutationFn: ({ planningId, dependanceId }: { planningId: string; dependanceId: string }) =>
      api.supprimer(`/api/execution/plannings/${planningId}/dependances/${dependanceId}/`),
    onSuccess: async () => {
      await invaliderPlanning();
    },
    onError: (e) => {
      setErreur(e instanceof ErreurApi ? e.detail : "Impossible de supprimer la dépendance.");
    },
  });

  function changerChampTache(
    tacheId: string,
    champ: "quantite" | "temps_unitaire_heures" | "effectif_alloue" | "decalage_jours" | "mode_calcul" | "observations",
    valeur: string
  ) {
    setBrouillonsTaches((precedent) => ({
      ...precedent,
      [tacheId]: {
        ...precedent[tacheId],
        [champ]: valeur,
      },
    }));
  }

  function basculerJourOuvre(jour: number) {
    setFormConfigurationPlanning((precedent) => {
      const actif = precedent.jours_ouvres.includes(jour);
      const jours = actif
        ? precedent.jours_ouvres.filter((element) => element !== jour)
        : [...precedent.jours_ouvres, jour].sort((a, b) => a - b);
      return {
        ...precedent,
        jours_ouvres: jours.length > 0 ? jours : precedent.jours_ouvres,
      };
    });
  }

  function ajouterAffectation(tacheId: string) {
    setBrouillonsAffectations((precedent) => ({
      ...precedent,
      [tacheId]: [
        ...(precedent[tacheId] || []),
        {
          profil: profils[0]?.id || "",
          effectif: 1,
          rendement_relatif: "1.0000",
          est_chef_equipe: false,
        },
      ],
    }));
  }

  function modifierAffectation(
    tacheId: string,
    index: number,
    champ: "profil" | "effectif" | "rendement_relatif" | "est_chef_equipe",
    valeur: string | number | boolean
  ) {
    setBrouillonsAffectations((precedent) => ({
      ...precedent,
      [tacheId]: (precedent[tacheId] || []).map((affectation, position) =>
        position === index ? { ...affectation, [champ]: valeur } : affectation
      ),
    }));
  }

  function supprimerAffectation(tacheId: string, index: number) {
    setBrouillonsAffectations((precedent) => ({
      ...precedent,
      [tacheId]: (precedent[tacheId] || []).filter((_, position) => position !== index),
    }));
  }

  function changerBrouillonDependance(
    tacheId: string,
    champ: "tache_amont" | "type_dependance" | "decalage_jours",
    valeur: string
  ) {
    setBrouillonsDependances((precedent) => ({
      ...precedent,
      [tacheId]: {
        ...precedent[tacheId],
        [champ]: valeur,
      },
    }));
  }

  async function telechargerEtudePrixXlsx(etudePrixId: string) {
    setTelechargementXlsx(etudePrixId);
    setErreur(null);
    try {
      const reponse = await api.telecharger(`/api/economie/etudes-de-prix/${etudePrixId}/export/xlsx/`);
      telechargerBlob(reponse.blob, reponse.nomFichier || "bordereau.xlsx");
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Impossible d’exporter le tableur.");
    } finally {
      setTelechargementXlsx(null);
    }
  }

  async function telechargerPlanning(planningId: string, format: "xlsx" | "pdf" | "archive") {
    setTelechargementPlanning(format);
    setErreur(null);
    try {
      const reponse = await api.telecharger(`/api/execution/plannings/${planningId}/export/${format}/`);
      telechargerBlob(reponse.blob, reponse.nomFichier || `planning.${format === "archive" ? "zip" : format}`);
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Impossible d’exporter le planning.");
    } finally {
      setTelechargementPlanning(null);
    }
  }

  const sourceSelectionnee = formCreation.source_donnees;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Plannings chantier</h3>
              <p className="text-xs text-slate-500 mt-1">
                Le planning Gantt se base sur les désignations de DPGF, devis ou étude de prix, puis adapte les durées à l’équipe affectée.
              </p>
            </div>
            <button type="button" className="btn-primaire text-xs" onClick={() => setCreationOuverte((precedent) => !precedent)}>
              <Plus className="w-3.5 h-3.5" />
              Nouveau planning
            </button>
          </div>

          {creationOuverte && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="libelle-champ">Intitulé</label>
                  <input
                    type="text"
                    className="champ-saisie"
                    value={formCreation.intitule}
                    onChange={(e) => setFormCreation((precedent) => ({ ...precedent, intitule: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="libelle-champ">Source des tâches</label>
                  <select
                    className="champ-saisie"
                    value={formCreation.source_donnees}
                    onChange={(e) => setFormCreation((precedent) => ({ ...precedent, source_donnees: e.target.value as PlanningChantier["source_donnees"] }))}
                  >
                    <option value="etude_economique">DPGF / étude économique</option>
                    <option value="etude_prix">Devis / BPU / étude de prix</option>
                    <option value="manuel">Structure manuelle</option>
                  </select>
                </div>
                <div>
                  <label className="libelle-champ">Début de référence</label>
                  <input
                    type="date"
                    className="champ-saisie"
                    value={formCreation.date_debut_reference}
                    onChange={(e) => setFormCreation((precedent) => ({ ...precedent, date_debut_reference: e.target.value }))}
                  />
                </div>
                {sourceSelectionnee === "etude_economique" && (
                  <div className="md:col-span-2">
                    <label className="libelle-champ">DPGF / étude économique</label>
                    <select
                      className="champ-saisie"
                      value={formCreation.etude_economique}
                      onChange={(e) => setFormCreation((precedent) => ({ ...precedent, etude_economique: e.target.value }))}
                    >
                      <option value="">Sélectionner une étude économique</option>
                      {etudesEconomiques.map((etude) => (
                        <option key={etude.id} value={etude.id}>
                          {etude.intitule}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {sourceSelectionnee === "etude_prix" && (
                  <div className="md:col-span-2">
                    <label className="libelle-champ">Devis / étude de prix</label>
                    <div className="grid gap-2 md:grid-cols-[1fr_auto]">
                      <select
                        className="champ-saisie"
                        value={formCreation.etude_prix}
                        onChange={(e) => setFormCreation((precedent) => ({ ...precedent, etude_prix: e.target.value }))}
                      >
                        <option value="">Sélectionner une étude de prix</option>
                        {etudesPrix.map((etude) => (
                          <option key={etude.id} value={etude.id}>
                            {etude.intitule}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="btn-secondaire text-xs"
                        disabled={!formCreation.etude_prix || telechargementXlsx === formCreation.etude_prix}
                        onClick={() => telechargerEtudePrixXlsx(formCreation.etude_prix)}
                      >
                        {telechargementXlsx === formCreation.etude_prix ? "Export…" : "Exporter XLSX"}
                      </button>
                    </div>
                  </div>
                )}
                <div>
                  <label className="libelle-champ">Heures par jour</label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    className="champ-saisie"
                    value={formCreation.heures_par_jour}
                    onChange={(e) => setFormCreation((precedent) => ({ ...precedent, heures_par_jour: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="libelle-champ">Coefficient global de rendement</label>
                  <input
                    type="number"
                    min="0.1"
                    step="0.0001"
                    className="champ-saisie"
                    value={formCreation.coefficient_rendement_global}
                    onChange={(e) => setFormCreation((precedent) => ({ ...precedent, coefficient_rendement_global: e.target.value }))}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button type="button" className="btn-secondaire text-xs" onClick={() => setCreationOuverte(false)}>
                  Annuler
                </button>
                <button
                  type="button"
                  className="btn-primaire text-xs"
                  disabled={
                    mutationCreerPlanning.isPending
                    || !formCreation.intitule
                    || (sourceSelectionnee === "etude_economique" && !formCreation.etude_economique)
                    || (sourceSelectionnee === "etude_prix" && !formCreation.etude_prix)
                  }
                  onClick={() => mutationCreerPlanning.mutate()}
                >
                  {mutationCreerPlanning.isPending ? "Création…" : "Créer le planning"}
                </button>
              </div>
            </div>
          )}

          {plannings.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">
              Aucun planning encore généré pour ce chantier.
            </p>
          ) : (
            <div className="space-y-2">
              {plannings.map((planning) => (
                <button
                  key={planning.id}
                  type="button"
                  className={clsx(
                    "w-full rounded-xl border p-3 text-left transition-colors",
                    planning.id === planningActifId ? "border-primaire-200 bg-primaire-50" : "border-slate-200 bg-white"
                  )}
                  onClick={() => setPlanningActifId(planning.id)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{planning.intitule}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {planning.source_donnees_libelle} • Début {formaterDate(planning.date_debut_reference)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-sm text-slate-700">
                        {planning.synthese_calcul?.duree_totale_jours || "0"} j
                      </p>
                      <p className="text-xs text-slate-500">
                        {planning.synthese_calcul?.nb_taches_critiques || 0} critiques
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-slate-800">Perspective DPGF / BPU / planning</h3>
          <div className="space-y-3 text-sm text-slate-600">
            <p>
              Le DPGF reste la matrice de quantités et de désignations métier. Chaque ligne peut alimenter une tâche de planning, dont la durée est calculée à partir du temps unitaire et de l’équipe réellement allouée.
            </p>
            <p>
              Le BPU ou devis détaillé reste éditable en tableur via l’export XLSX. Les montants, libellés et formules peuvent être repris dans un flux de chiffrage sans casser la cohérence avec le chantier.
            </p>
            <p>
              Quand les effectifs, les temps unitaires ou les décalages changent, le recalcul met à jour les dates, les marges et le chemin critique automatiquement.
            </p>
          </div>
        </div>
      </div>

      {erreur && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {erreur}
        </div>
      )}

      {!planningActif ? null : (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-5">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wider text-slate-500">Durée totale</p>
              <p className="mt-2 text-2xl font-semibold text-slate-800">
                {planningActif.synthese_calcul?.duree_totale_jours || "0"} j
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wider text-slate-500">Tâches</p>
              <p className="mt-2 text-2xl font-semibold text-slate-800">
                {planningActif.synthese_calcul?.nb_taches || planningActif.taches.length}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wider text-slate-500">Chemin critique</p>
              <p className="mt-2 text-2xl font-semibold text-slate-800">
                {planningActif.synthese_calcul?.nb_taches_critiques || 0}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wider text-slate-500">Source active</p>
              <p className="mt-2 text-sm font-semibold text-slate-800">
                {planningActif.etude_economique_intitule || planningActif.etude_prix_intitule || "Paramétrage manuel"}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wider text-slate-500">Conflits ressources</p>
              <p className="mt-2 text-2xl font-semibold text-slate-800">
                {planningActif.synthese_calcul?.nb_conflits_ressources || 0}
              </p>
              <p className="text-sm text-slate-500">Tâches décalées par lissage</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm text-slate-500">
              Le diagramme reprend les décalages, les effectifs, les dépendances et le calendrier ouvré du chantier.
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-secondaire text-xs"
                onClick={() => telechargerPlanning(planningActif.id, "xlsx")}
                disabled={telechargementPlanning !== null}
              >
                <Download className="w-3.5 h-3.5" />
                {telechargementPlanning === "xlsx" ? "Export…" : "Exporter XLSX"}
              </button>
              <button
                type="button"
                className="btn-secondaire text-xs"
                onClick={() => telechargerPlanning(planningActif.id, "pdf")}
                disabled={telechargementPlanning !== null}
              >
                <Download className="w-3.5 h-3.5" />
                {telechargementPlanning === "pdf" ? "Export…" : "Exporter PDF"}
              </button>
              <button
                type="button"
                className="btn-secondaire text-xs"
                onClick={() => telechargerPlanning(planningActif.id, "archive")}
                disabled={telechargementPlanning !== null}
              >
                <Download className="w-3.5 h-3.5" />
                {telechargementPlanning === "archive" ? "Export…" : "Archive complète"}
              </button>
              <button
                type="button"
                className="btn-secondaire text-xs"
                onClick={() => mutationNouvelleTache.mutate(planningActif.id)}
                disabled={mutationNouvelleTache.isPending}
              >
                <Plus className="w-3.5 h-3.5" />
                Ajouter une tâche
              </button>
              <button
                type="button"
                className="btn-secondaire text-xs"
                onClick={() => mutationRegenerer.mutate(planningActif.id)}
                disabled={mutationRegenerer.isPending || planningActif.source_donnees === "manuel"}
              >
                <RefreshCcw className="w-3.5 h-3.5" />
                {mutationRegenerer.isPending ? "Régénération…" : "Régénérer depuis la source"}
              </button>
              <button
                type="button"
                className="btn-primaire text-xs"
                onClick={() => mutationRecalculer.mutate(planningActif.id)}
                disabled={mutationRecalculer.isPending}
              >
                <GitBranch className="w-3.5 h-3.5" />
                {mutationRecalculer.isPending ? "Calcul…" : "Recalculer le chemin critique"}
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-4 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Calendrier et ressources</h3>
              <p className="text-xs text-slate-500 mt-1">
                Définit les jours ouvrés, les dates neutralisées et le lissage automatique des ressources partagées.
              </p>
            </div>
            <div className="grid gap-3 lg:grid-cols-[140px_140px_160px_1fr]">
              <div>
                <label className="libelle-champ">Début</label>
                <input
                  type="date"
                  className="champ-saisie"
                  value={formConfigurationPlanning.date_debut_reference}
                  onChange={(e) => setFormConfigurationPlanning((precedent) => ({ ...precedent, date_debut_reference: e.target.value }))}
                />
              </div>
              <div>
                <label className="libelle-champ">Heures/jour</label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  className="champ-saisie"
                  value={formConfigurationPlanning.heures_par_jour}
                  onChange={(e) => setFormConfigurationPlanning((precedent) => ({ ...precedent, heures_par_jour: e.target.value }))}
                />
              </div>
              <div>
                <label className="libelle-champ">Rendement global</label>
                <input
                  type="number"
                  min="0.1"
                  step="0.0001"
                  className="champ-saisie"
                  value={formConfigurationPlanning.coefficient_rendement_global}
                  onChange={(e) => setFormConfigurationPlanning((precedent) => ({ ...precedent, coefficient_rendement_global: e.target.value }))}
                />
              </div>
              <div>
                <label className="libelle-champ">Jours ouvrés</label>
                <div className="flex flex-wrap gap-2">
                  {JOURS_SEMAINE.map((jour) => (
                    <label key={jour.valeur} className={clsx(
                      "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs",
                      formConfigurationPlanning.jours_ouvres.includes(jour.valeur)
                        ? "border-primaire-300 bg-primaire-50 text-primaire-700"
                        : "border-slate-200 bg-white text-slate-600"
                    )}>
                      <input
                        type="checkbox"
                        checked={formConfigurationPlanning.jours_ouvres.includes(jour.valeur)}
                        onChange={() => basculerJourOuvre(jour.valeur)}
                      />
                      {jour.libelle}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
              <div>
                <label className="libelle-champ">Jours fériés / neutralisés</label>
                <textarea
                  rows={3}
                  className="champ-saisie"
                  value={formConfigurationPlanning.jours_feries}
                  onChange={(e) => setFormConfigurationPlanning((precedent) => ({ ...precedent, jours_feries: e.target.value }))}
                  placeholder="Une date ISO par ligne, ex. 2026-04-27"
                />
              </div>
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={formConfigurationPlanning.lisser_ressources_partagees}
                    onChange={(e) => setFormConfigurationPlanning((precedent) => ({ ...precedent, lisser_ressources_partagees: e.target.checked }))}
                  />
                  Lisser les ressources partagées
                </label>
                <button
                  type="button"
                  className="btn-primaire text-xs"
                  onClick={() => mutationSauverConfigurationPlanning.mutate(planningActif.id)}
                  disabled={mutationSauverConfigurationPlanning.isPending}
                >
                  <Save className="w-3.5 h-3.5" />
                  {mutationSauverConfigurationPlanning.isPending ? "Enregistrement…" : "Appliquer le calendrier"}
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Vue Gantt</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Début de référence: {formaterDate(planningActif.date_debut_reference)}
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-rose-500" /> Chemin critique</span>
                <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-primaire-500" /> Tâche planifiée</span>
              </div>
            </div>

            <div className="space-y-3">
              {planningActif.taches.map((tache) => {
                const styleBarre = largeurTache(planningActif, tache);
                const brouillon = brouillonsTaches[tache.id];
                const affectations = brouillonsAffectations[tache.id] || [];
                const brouillonDependance = brouillonsDependances[tache.id];
                return (
                  <div key={tache.id} className="rounded-xl border border-slate-200 bg-white">
                    <button
                      type="button"
                      className="w-full px-4 py-3 text-left"
                      onClick={() => setTacheOuverteId((precedent) => precedent === tache.id ? null : tache.id)}
                    >
                      <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr_120px] lg:items-center">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs text-slate-400">#{tache.numero_ordre}</span>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setTacheOuverteId((precedent) => precedent === tache.id ? null : tache.id);
                              }}
                              className="font-medium text-slate-800 transition-colors hover:text-primaire-600"
                            >
                              {tache.designation}
                            </button>
                            {tache.est_critique && <span className="badge-danger text-xs">Critique</span>}
                            {tache.code && <span className="badge-neutre text-xs">{tache.code}</span>}
                          </div>
                          <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-slate-500">
                            <span>{formaterNombre(tache.quantite, 3)} {tache.unite || ""}</span>
                            <span>{formaterNombre(tache.temps_unitaire_heures, 3)} h/u</span>
                            <span>{formaterNombre(tache.heures_totales, 2)} h totales</span>
                            <span>{tache.effectif_alloue} pers.</span>
                            <span>Marge {formaterDuree(tache.marge_libre_jours)}</span>
                          </div>
                        </div>
                        <div className="relative h-10 rounded-lg bg-slate-100 overflow-hidden">
                          <div
                            className={clsx(
                              "absolute top-1.5 h-7 rounded-md",
                              tache.est_critique ? "bg-rose-500" : "bg-primaire-500"
                            )}
                            style={styleBarre}
                          />
                        </div>
                        <div className="text-right text-xs text-slate-500">
                          <div>{formaterDate(tache.date_debut_calculee)}</div>
                          <div>{formaterDate(tache.date_fin_calculee)}</div>
                          <div className="font-mono text-slate-700 mt-1">{formaterDuree(tache.duree_jours)}</div>
                        </div>
                      </div>
                    </button>

                    {tacheOuverteId === tache.id && brouillon && (
                      <div className="border-t border-slate-200 bg-slate-50 p-4 space-y-4">
                        <div className="grid gap-3 md:grid-cols-5">
                          <div>
                            <label className="libelle-champ">Quantité</label>
                            <input
                              type="number"
                              step="0.001"
                              className="champ-saisie"
                              value={brouillon.quantite}
                              onChange={(e) => changerChampTache(tache.id, "quantite", e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="libelle-champ">Temps unitaire (h)</label>
                            <input
                              type="number"
                              step="0.0001"
                              className="champ-saisie"
                              value={brouillon.temps_unitaire_heures}
                              onChange={(e) => changerChampTache(tache.id, "temps_unitaire_heures", e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="libelle-champ">Effectif par défaut</label>
                            <input
                              type="number"
                              min="1"
                              className="champ-saisie"
                              value={brouillon.effectif_alloue}
                              onChange={(e) => changerChampTache(tache.id, "effectif_alloue", e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="libelle-champ">Décalage (jours)</label>
                            <input
                              type="number"
                              step="0.01"
                              className="champ-saisie"
                              value={brouillon.decalage_jours}
                              onChange={(e) => changerChampTache(tache.id, "decalage_jours", e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="libelle-champ">Mode de calcul</label>
                            <select
                              className="champ-saisie"
                              value={brouillon.mode_calcul}
                              onChange={(e) => changerChampTache(tache.id, "mode_calcul", e.target.value)}
                            >
                              <option value="auto">Automatique</option>
                              <option value="manuel">Manuel</option>
                            </select>
                          </div>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Users className="w-4 h-4 text-slate-500" />
                              <h4 className="text-sm font-semibold text-slate-800">Équipe travaux affectée</h4>
                            </div>
                            <button type="button" className="btn-secondaire text-xs" onClick={() => ajouterAffectation(tache.id)}>
                              <Plus className="w-3.5 h-3.5" />
                              Ajouter un profil
                            </button>
                          </div>

                          {affectations.length === 0 ? (
                            <p className="text-xs text-slate-500">
                              Aucune équipe détaillée. La durée s’appuiera uniquement sur l’effectif par défaut.
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {affectations.map((affectation, index) => (
                                <div key={`${tache.id}-${index}`} className="grid gap-2 md:grid-cols-[1.4fr_110px_140px_auto_auto] md:items-center">
                                  <select
                                    className="champ-saisie"
                                    value={affectation.profil}
                                    onChange={(e) => modifierAffectation(tache.id, index, "profil", e.target.value)}
                                  >
                                    <option value="">Profil</option>
                                    {profils.map((profil) => (
                                      <option key={profil.id} value={profil.id}>
                                        {profil.libelle}
                                      </option>
                                    ))}
                                  </select>
                                  <input
                                    type="number"
                                    min="1"
                                    className="champ-saisie"
                                    value={affectation.effectif}
                                    onChange={(e) => modifierAffectation(tache.id, index, "effectif", Number(e.target.value || 1))}
                                  />
                                  <input
                                    type="number"
                                    min="0.1"
                                    step="0.0001"
                                    className="champ-saisie"
                                    value={affectation.rendement_relatif}
                                    onChange={(e) => modifierAffectation(tache.id, index, "rendement_relatif", e.target.value)}
                                  />
                                  <label className="flex items-center gap-2 text-xs text-slate-600">
                                    <input
                                      type="checkbox"
                                      checked={Boolean(affectation.est_chef_equipe)}
                                      onChange={(e) => modifierAffectation(tache.id, index, "est_chef_equipe", e.target.checked)}
                                    />
                                    Chef
                                  </label>
                                  <button type="button" className="text-xs text-red-600 hover:underline" onClick={() => supprimerAffectation(tache.id, index)}>
                                    Retirer
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="text-sm font-semibold text-slate-800">Dépendances et décalages</h4>
                              <p className="text-xs text-slate-500 mt-1">
                                Les liaisons entre tâches pilotent automatiquement le chemin critique et les glissements.
                              </p>
                            </div>
                            <button
                              type="button"
                              className="btn-secondaire text-xs"
                              disabled={mutationCreerDependance.isPending || !brouillonDependance?.tache_amont}
                              onClick={() => mutationCreerDependance.mutate({ planningId: planningActif.id, tacheId: tache.id })}
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Ajouter une liaison
                            </button>
                          </div>

                          {tache.dependances_entrantes.length === 0 ? (
                            <p className="text-xs text-slate-500">Aucune dépendance entrante pour cette tâche.</p>
                          ) : (
                            <div className="space-y-2">
                              {tache.dependances_entrantes.map((dependance) => (
                                <div key={dependance.id} className="grid gap-2 md:grid-cols-[1.5fr_140px_120px_auto] md:items-center">
                                  <div className="text-sm text-slate-700">
                                    {dependance.tache_amont_designation}
                                  </div>
                                  <select
                                    className="champ-saisie"
                                    value={dependance.type_dependance}
                                    onChange={(e) => mutationModifierDependance.mutate({
                                      planningId: planningActif.id,
                                      dependanceId: dependance.id,
                                      type_dependance: e.target.value as "fd" | "dd",
                                      decalage_jours: String(dependance.decalage_jours ?? "0"),
                                    })}
                                  >
                                    <option value="fd">Fin -&gt; Début</option>
                                    <option value="dd">Début -&gt; Début</option>
                                  </select>
                                  <input
                                    type="number"
                                    step="0.01"
                                    className="champ-saisie"
                                    defaultValue={String(dependance.decalage_jours ?? 0)}
                                    onBlur={(e) => mutationModifierDependance.mutate({
                                      planningId: planningActif.id,
                                      dependanceId: dependance.id,
                                      type_dependance: dependance.type_dependance,
                                      decalage_jours: e.target.value || "0",
                                    })}
                                  />
                                  <button
                                    type="button"
                                    className="text-xs text-red-600 hover:underline"
                                    onClick={() => mutationSupprimerDependance.mutate({ planningId: planningActif.id, dependanceId: dependance.id })}
                                  >
                                    Supprimer
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}

                          {brouillonDependance && (
                            <div className="grid gap-2 md:grid-cols-[1.5fr_140px_120px]">
                              <select
                                className="champ-saisie"
                                value={brouillonDependance.tache_amont}
                                onChange={(e) => changerBrouillonDependance(tache.id, "tache_amont", e.target.value)}
                              >
                                <option value="">Tâche amont</option>
                                {planningActif.taches.filter((candidate) => candidate.id !== tache.id).map((candidate) => (
                                  <option key={candidate.id} value={candidate.id}>
                                    {candidate.numero_ordre}. {candidate.designation}
                                  </option>
                                ))}
                              </select>
                              <select
                                className="champ-saisie"
                                value={brouillonDependance.type_dependance}
                                onChange={(e) => changerBrouillonDependance(tache.id, "type_dependance", e.target.value)}
                              >
                                <option value="fd">Fin -&gt; Début</option>
                                <option value="dd">Début -&gt; Début</option>
                              </select>
                              <input
                                type="number"
                                step="0.01"
                                className="champ-saisie"
                                value={brouillonDependance.decalage_jours}
                                onChange={(e) => changerBrouillonDependance(tache.id, "decalage_jours", e.target.value)}
                              />
                            </div>
                          )}
                        </div>

                        <div>
                          <label className="libelle-champ">Observations</label>
                          <textarea
                            rows={3}
                            className="champ-saisie"
                            value={brouillon.observations}
                            onChange={(e) => changerChampTache(tache.id, "observations", e.target.value)}
                          />
                        </div>

                        <div className="flex justify-end">
                          <button
                            type="button"
                            className="btn-primaire text-xs"
                            disabled={mutationSauverTache.isPending}
                            onClick={() => mutationSauverTache.mutate(tache)}
                          >
                            <Save className="w-3.5 h-3.5" />
                            {mutationSauverTache.isPending ? "Enregistrement…" : "Appliquer et recalculer"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function OngletPilotage({
  suivi,
  form,
  onChanger,
  onBasculerProcessus,
  onSauvegarder,
  sauvegardeEnCours,
}: {
  suivi: SuiviExecution;
  form: FormulairePilotage;
  onChanger: (champ: keyof FormulairePilotage, valeur: string | Record<string, boolean>) => void;
  onBasculerProcessus: (code: string) => void;
  onSauvegarder: () => void;
  sauvegardeEnCours: boolean;
}) {
  const definitions = processusExecution as ProcessusDefinition[];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs uppercase tracking-wider text-slate-500">Maîtrise des processus</p>
          <p className="mt-2 text-2xl font-semibold text-slate-800">
            {suivi.nb_processus_maitrises}/{suivi.total_processus}
          </p>
          <p className="text-sm text-slate-500">{suivi.taux_maitrise_processus}% de jalons préparés</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs uppercase tracking-wider text-slate-500">Points de vigilance</p>
          <p className="mt-2 text-2xl font-semibold text-slate-800">{suivi.points_vigilance.length}</p>
          <p className="text-sm text-slate-500">Sujets à verrouiller sur le chantier</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs uppercase tracking-wider text-slate-500">Prochaines actions</p>
          <p className="mt-2 text-2xl font-semibold text-slate-800">{suivi.prochaines_actions.length}</p>
          <p className="text-sm text-slate-500">Décisions et relances à conduire</p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-xl border border-slate-200 p-4 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Check-list MOE / OPC</h3>
            <p className="text-xs text-slate-500 mt-1">
              Cette grille reprend les étapes structurantes relevées dans les documents méthodologiques du dossier Samba.
            </p>
          </div>
          <div className="space-y-2">
            {definitions.map((processus) => {
              const actif = Boolean(form.processus_maitrise[processus.code]);
              return (
                <label
                  key={processus.code}
                  className={clsx(
                    "flex items-start gap-3 rounded-xl border p-3 transition-colors cursor-pointer",
                    actif ? "border-primaire-200 bg-primaire-50" : "border-slate-200 bg-white"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={actif}
                    onChange={() => onBasculerProcessus(processus.code)}
                    className="mt-1"
                  />
                  <div>
                    <p className="text-sm font-medium text-slate-700">{processus.libelle}</p>
                    <p className="text-xs text-slate-500 mt-1">{processus.description}</p>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 p-4 space-y-2">
            <label className="libelle-champ">Points de vigilance</label>
            <textarea
              rows={7}
              className="champ-saisie"
              value={form.points_vigilance}
              onChange={(e) => onChanger("points_vigilance", e.target.value)}
              placeholder={"Une ligne par point de vigilance"}
            />
          </div>
          <div className="rounded-xl border border-slate-200 p-4 space-y-2">
            <label className="libelle-champ">Prochaines actions</label>
            <textarea
              rows={7}
              className="champ-saisie"
              value={form.prochaines_actions}
              onChange={(e) => onChanger("prochaines_actions", e.target.value)}
              placeholder={"Une ligne par action à conduire"}
            />
          </div>
          <div className="rounded-xl border border-slate-200 p-4 space-y-2">
            <label className="libelle-champ">Observations de pilotage</label>
            <textarea
              rows={6}
              className="champ-saisie"
              value={form.observations_pilotage}
              onChange={(e) => onChanger("observations_pilotage", e.target.value)}
            />
          </div>
          <div className="flex justify-end">
            <button onClick={onSauvegarder} disabled={sauvegardeEnCours} className="btn-primaire text-sm">
              <Save className="w-4 h-4" />
              {sauvegardeEnCours ? "Enregistrement…" : "Enregistrer le pilotage"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

type Onglet = "pilotage" | "planning" | "cr" | "situations" | "os";

export function SuiviExecutionProjet({ projetId }: { projetId: string }) {
  const [onglet, setOnglet] = useState<Onglet>("pilotage");
  const [erreurCreation, setErreurCreation] = useState<string | null>(null);
  const [formPilotage, setFormPilotage] = useState<FormulairePilotage>({
    processus_maitrise: {},
    points_vigilance: "",
    prochaines_actions: "",
    observations_pilotage: "",
  });
  const queryClient = useQueryClient();

  const { data: suivi, isLoading, isError } = useQuery<SuiviExecution>({
    queryKey: ["suivi-execution", projetId],
    queryFn: () => api.get<{ results?: SuiviExecution[] }>(`/api/execution/?projet=${projetId}`).then(
      (donnees) => {
        const liste = donnees.results ?? [];
        if (liste.length > 0) return liste[0];
        throw new Error("no_suivi");
      }
    ),
    retry: false,
  });

  useEffect(() => {
    if (suivi) {
      setFormPilotage(initialiserFormulairePilotage(suivi));
    }
  }, [suivi]);

  const { mutate: creerSuivi, isPending: creationEnCours } = useMutation({
    mutationFn: () => api.post("/api/execution/", { projet: projetId }),
    onSuccess: () => {
      setErreurCreation(null);
      queryClient.invalidateQueries({ queryKey: ["suivi-execution", projetId] });
    },
    onError: (err) => {
      if (err instanceof ErreurApi) setErreurCreation(err.detail);
    },
  });

  const { mutate: sauvegarderPilotage, isPending: sauvegardePilotageEnCours } = useMutation({
    mutationFn: () => {
      if (!suivi) {
        throw new Error("suivi_introuvable");
      }
      return api.patch(`/api/execution/${suivi.id}/`, {
        processus_maitrise: formPilotage.processus_maitrise,
        points_vigilance: texteVersListe(formPilotage.points_vigilance),
        prochaines_actions: texteVersListe(formPilotage.prochaines_actions),
        observations_pilotage: formPilotage.observations_pilotage,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suivi-execution", projetId] });
    },
  });

  function changerPilotage(champ: keyof FormulairePilotage, valeur: string | Record<string, boolean>) {
    setFormPilotage((precedent) => ({ ...precedent, [champ]: valeur }));
  }

  function basculerProcessus(code: string) {
    setFormPilotage((precedent) => ({
      ...precedent,
      processus_maitrise: {
        ...precedent.processus_maitrise,
        [code]: !precedent.processus_maitrise[code],
      },
    }));
  }

  if (isLoading) return <div className="carte py-12 text-center text-slate-400 text-sm">Chargement…</div>;

  if (isError || !suivi) {
    return (
      <div className="carte py-12 text-center text-slate-400 space-y-4">
        <p className="text-sm">Aucun dossier de suivi d&apos;exécution pour ce projet.</p>
        {erreurCreation && <p className="text-xs text-red-500">{erreurCreation}</p>}
        <button onClick={() => creerSuivi()} disabled={creationEnCours} className="btn-primaire text-xs">
          {creationEnCours ? "Création…" : "Ouvrir le dossier de suivi"}
        </button>
      </div>
    );
  }

  const libellesOnglets: Record<Onglet, string> = {
    pilotage: "Pilotage",
    planning: "Planning",
    cr: "Comptes rendus",
    situations: "Situations",
    os: "Ordres de service",
  };

  return (
    <div className="space-y-6">
      <div className="carte">
        <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-5">
          <div>
            <p className="text-xs text-slate-500">Entreprise</p>
            <p className="font-medium mt-0.5">{suivi.entreprise_nom || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">OS démarrage</p>
            <p className="font-medium font-mono mt-0.5">{formaterDate(suivi.date_os_demarrage)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Fin contractuelle</p>
            <p className="font-medium font-mono mt-0.5">{formaterDate(suivi.date_fin_contractuelle)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Montant marché HT</p>
            <p className="font-medium font-mono mt-0.5">{formaterMontant(suivi.montant_marche_ht)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Pilotage prêt</p>
            <p className="font-medium font-mono mt-0.5">{suivi.taux_maitrise_processus}%</p>
          </div>
        </div>
      </div>

      <div className="carte space-y-4">
        <div className="flex gap-1 border-b border-slate-100 pb-3">
          {(["pilotage", "planning", "cr", "situations", "os"] as Onglet[]).map((nomOnglet) => (
            <button
              key={nomOnglet}
              onClick={() => setOnglet(nomOnglet)}
              className={clsx(
                "px-3 py-1.5 text-sm rounded-lg transition-colors",
                onglet === nomOnglet
                  ? "bg-primaire-100 text-primaire-700 font-medium"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              {libellesOnglets[nomOnglet]}
            </button>
          ))}
        </div>

        {onglet === "pilotage" && (
          <OngletPilotage
            suivi={suivi}
            form={formPilotage}
            onChanger={changerPilotage}
            onBasculerProcessus={basculerProcessus}
            onSauvegarder={() => sauvegarderPilotage()}
            sauvegardeEnCours={sauvegardePilotageEnCours}
          />
        )}
        {onglet === "planning" && <OngletPlanning suiviId={suivi.id} projetId={projetId} />}
        {onglet === "cr" && <OngletComptesRendus suiviId={suivi.id} />}
        {onglet === "situations" && <OngletSituations suiviId={suivi.id} />}
        {onglet === "os" && <OngletOrdresService suiviId={suivi.id} />}
      </div>
    </div>
  );
}
