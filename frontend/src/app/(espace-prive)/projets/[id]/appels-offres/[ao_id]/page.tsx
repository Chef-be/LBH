"use client";

import { useEffect, useState, use, useCallback } from "react";
import Link from "next/link";
import clsx from "clsx";
import { api, ErreurApi, extraireListeResultats } from "@/crochets/useApi";
import {
  ChevronRight, CheckCircle, AlertCircle, X, Plus,
  Pencil, Trophy, BarChart3, Calendar, Building2, Save,
} from "lucide-react";

interface Critere {
  libelle: string;
  ponderation_pct: number;
}

interface Offre {
  id: string;
  entreprise: string;
  entreprise_nom: string;
  statut: string;
  statut_libelle: string;
  montant_offre_ht: number | null;
  montant_negociee_ht: number | null;
  delai_propose_jours: number | null;
  conformite_administrative: string;
  conformite_administrative_libelle: string;
  conformite_technique: string;
  conformite_technique_libelle: string;
  points_forts: string;
  points_faibles: string;
  ecart_estimation_pct: number | null;
  notes_criteres: Record<string, number>;
  note_globale: number | null;
  observations: string;
  date_reception: string;
}

interface AppelOffres {
  id: string;
  projet: string;
  projet_reference: string;
  intitule: string;
  type_procedure: string;
  type_libelle: string;
  statut: string;
  statut_libelle: string;
  date_publication: string | null;
  date_limite_questions: string | null;
  date_limite_remise: string | null;
  date_ouverture_plis: string | null;
  date_attribution: string | null;
  montant_estime_ht: number | null;
  criteres_jugement: Critere[];
  pieces_consultation: string[];
  points_vigilance: string[];
  analyse_contractuelle: string;
  conditions_paiement: string;
  garanties_exigees: string;
  delai_execution_jours: number | null;
  variantes_autorisees: boolean;
  observations: string;
  offres: Offre[];
}

interface Organisation {
  id: string;
  nom: string;
}

interface FormulaireCadreConsultation {
  pieces_consultation: string;
  points_vigilance: string;
  analyse_contractuelle: string;
  conditions_paiement: string;
  garanties_exigees: string;
  delai_execution_jours: string;
  variantes_autorisees: boolean;
}

const STATUTS_AO: Record<string, string> = {
  preparation: "badge-neutre",
  publie: "bg-blue-100 text-blue-700 border border-blue-200",
  questions_reponses: "bg-yellow-100 text-yellow-700 border border-yellow-200",
  clos: "bg-orange-100 text-orange-700 border border-orange-200",
  depouille: "bg-slate-200 text-slate-700 border border-slate-300",
  attribue: "badge-succes",
  infructueux: "badge-danger",
  abandonne: "badge-danger",
};

const STATUTS_OFFRE: Record<string, string> = {
  recue: "badge-neutre",
  non_conforme: "badge-danger",
  conforme: "bg-blue-100 text-blue-700 border border-blue-200",
  retenue: "badge-succes",
  rejetee: "badge-danger",
};

const STYLES_CONFORMITE: Record<string, string> = {
  a_verifier: "badge-neutre",
  conforme: "badge-succes",
  reserve: "badge-alerte",
  non_conforme: "badge-danger",
};

function fmt(val: number | null): string {
  if (val === null || val === undefined) return "—";
  return `${Number(val).toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtPourcentage(valeur: number | null) {
  if (valeur === null || valeur === undefined) return "—";
  const prefixe = valeur > 0 ? "+" : "";
  return `${prefixe}${valeur.toFixed(1)} %`;
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

function initialiserCadreConsultation(ao: AppelOffres): FormulaireCadreConsultation {
  return {
    pieces_consultation: listeVersTexte(ao.pieces_consultation),
    points_vigilance: listeVersTexte(ao.points_vigilance),
    analyse_contractuelle: ao.analyse_contractuelle || "",
    conditions_paiement: ao.conditions_paiement || "",
    garanties_exigees: ao.garanties_exigees || "",
    delai_execution_jours: ao.delai_execution_jours != null ? String(ao.delai_execution_jours) : "",
    variantes_autorisees: Boolean(ao.variantes_autorisees),
  };
}

function ModalOffre({
  aoId,
  organisations,
  initial,
  offreId,
  criteres,
  onSuccess,
  onClose,
}: {
  aoId: string;
  organisations: Organisation[];
  initial?: Partial<Offre>;
  offreId?: string;
  criteres: Critere[];
  onSuccess: () => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    entreprise: initial?.entreprise || "",
    montant_offre_ht: initial?.montant_offre_ht != null ? String(initial.montant_offre_ht) : "",
    delai_propose_jours: initial?.delai_propose_jours != null ? String(initial.delai_propose_jours) : "",
    conformite_administrative: initial?.conformite_administrative || "a_verifier",
    conformite_technique: initial?.conformite_technique || "a_verifier",
    points_forts: initial?.points_forts || "",
    points_faibles: initial?.points_faibles || "",
    observations: initial?.observations || "",
    notes_criteres: (initial?.notes_criteres || {}) as Record<string, number>,
  });
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const majNote = (libelle: string, val: string) =>
    setForm((precedent) => ({
      ...precedent,
      notes_criteres: { ...precedent.notes_criteres, [libelle]: Number(val) },
    }));

  const soumettre = async () => {
    if (!form.entreprise) {
      setErreur("Sélectionnez une entreprise.");
      return;
    }
    setChargement(true);
    setErreur(null);
    try {
      const payload = {
        appel_offres: aoId,
        entreprise: form.entreprise,
        montant_offre_ht: form.montant_offre_ht ? Number(form.montant_offre_ht) : null,
        delai_propose_jours: form.delai_propose_jours ? Number(form.delai_propose_jours) : null,
        conformite_administrative: form.conformite_administrative,
        conformite_technique: form.conformite_technique,
        points_forts: form.points_forts,
        points_faibles: form.points_faibles,
        observations: form.observations,
        notes_criteres: form.notes_criteres,
      };
      if (offreId) {
        await api.patch(`/api/appels-offres/${aoId}/offres/${offreId}/`, payload);
      } else {
        await api.post(`/api/appels-offres/${aoId}/offres/`, payload);
      }
      onSuccess();
      onClose();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Erreur lors de l'enregistrement.");
    } finally {
      setChargement(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-800">{offreId ? "Modifier l'offre" : "Saisir une offre"}</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>

        <div className="p-6 space-y-4">
          {erreur && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />{erreur}
            </div>
          )}

          <div>
            <label className="libelle-champ">Entreprise <span className="text-red-500">*</span></label>
            <select
              className="champ-saisie w-full bg-white"
              value={form.entreprise}
              onChange={(e) => setForm((precedent) => ({ ...precedent, entreprise: e.target.value }))}
            >
              <option value="">— Sélectionner —</option>
              {organisations.map((organisation) => <option key={organisation.id} value={organisation.id}>{organisation.nom}</option>)}
            </select>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="libelle-champ">Montant offre HT (€)</label>
              <input
                type="number"
                step="0.01"
                className="champ-saisie w-full text-right"
                value={form.montant_offre_ht}
                onChange={(e) => setForm((precedent) => ({ ...precedent, montant_offre_ht: e.target.value }))}
              />
            </div>
            <div>
              <label className="libelle-champ">Délai proposé (jours)</label>
              <input
                type="number"
                className="champ-saisie w-full text-right"
                value={form.delai_propose_jours}
                onChange={(e) => setForm((precedent) => ({ ...precedent, delai_propose_jours: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="libelle-champ">Conformité administrative</label>
              <select
                className="champ-saisie w-full bg-white"
                value={form.conformite_administrative}
                onChange={(e) => setForm((precedent) => ({ ...precedent, conformite_administrative: e.target.value }))}
              >
                <option value="a_verifier">À vérifier</option>
                <option value="conforme">Conforme</option>
                <option value="reserve">Avec réserve</option>
                <option value="non_conforme">Non conforme</option>
              </select>
            </div>
            <div>
              <label className="libelle-champ">Conformité technique</label>
              <select
                className="champ-saisie w-full bg-white"
                value={form.conformite_technique}
                onChange={(e) => setForm((precedent) => ({ ...precedent, conformite_technique: e.target.value }))}
              >
                <option value="a_verifier">À vérifier</option>
                <option value="conforme">Conforme</option>
                <option value="reserve">Avec réserve</option>
                <option value="non_conforme">Non conforme</option>
              </select>
            </div>
          </div>

          {criteres.length > 0 && (
            <div>
              <label className="libelle-champ">Notes par critère (/100)</label>
              <div className="space-y-2 mt-1">
                {criteres.map((critere) => (
                  <div key={critere.libelle} className="flex items-center gap-3">
                    <span className="text-sm text-slate-600 flex-1">{critere.libelle}</span>
                    <span className="text-xs text-slate-400 w-12 text-right">{critere.ponderation_pct}%</span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      className="champ-saisie w-24 text-right"
                      value={form.notes_criteres[critere.libelle] ?? ""}
                      onChange={(e) => majNote(critere.libelle, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="libelle-champ">Points forts</label>
              <textarea
                rows={3}
                className="champ-saisie w-full"
                value={form.points_forts}
                onChange={(e) => setForm((precedent) => ({ ...precedent, points_forts: e.target.value }))}
              />
            </div>
            <div>
              <label className="libelle-champ">Points faibles</label>
              <textarea
                rows={3}
                className="champ-saisie w-full"
                value={form.points_faibles}
                onChange={(e) => setForm((precedent) => ({ ...precedent, points_faibles: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="libelle-champ">Observations</label>
            <textarea
              rows={2}
              className="champ-saisie w-full"
              value={form.observations}
              onChange={(e) => setForm((precedent) => ({ ...precedent, observations: e.target.value }))}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
          <button onClick={onClose} className="btn-secondaire">Annuler</button>
          <button onClick={soumettre} disabled={chargement} className="btn-primaire disabled:opacity-60">
            {chargement ? "Enregistrement…" : <><Save className="w-4 h-4" />Enregistrer</>}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PageDetailAO({
  params,
}: {
  params: Promise<{ id: string; ao_id: string }>;
}) {
  const { id: projetId, ao_id: aoId } = use(params);
  const [ao, setAo] = useState<AppelOffres | null>(null);
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [cadreConsultation, setCadreConsultation] = useState<FormulaireCadreConsultation>({
    pieces_consultation: "",
    points_vigilance: "",
    analyse_contractuelle: "",
    conditions_paiement: "",
    garanties_exigees: "",
    delai_execution_jours: "",
    variantes_autorisees: false,
  });
  const [chargement, setChargement] = useState(true);
  const [succes, setSucces] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [modal, setModal] = useState(false);
  const [offreEdit, setOffreEdit] = useState<Offre | null>(null);
  const [analyse, setAnalyse] = useState(false);
  const [sauvegardeCadre, setSauvegardeCadre] = useState(false);

  const charger = useCallback(async () => {
    try {
      const [data, orgs] = await Promise.all([
        api.get<AppelOffres>(`/api/appels-offres/${aoId}/`),
        api.get<Organisation[]>("/api/organisations/"),
      ]);
      setAo(data);
      setOrganisations(extraireListeResultats(orgs));
      setCadreConsultation(initialiserCadreConsultation(data));
    } catch {
      setErreur("Impossible de charger l'appel d'offres.");
    } finally {
      setChargement(false);
    }
  }, [aoId]);

  useEffect(() => {
    charger();
  }, [charger]);

  const flash = (msg: string) => {
    setSucces(msg);
    setTimeout(() => setSucces(null), 3500);
  };

  const analyserOffres = async () => {
    setAnalyse(true);
    try {
      await api.post(`/api/appels-offres/${aoId}/analyser/`, {});
      flash("Notes globales calculées depuis les critères.");
      charger();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Erreur d'analyse.");
    } finally {
      setAnalyse(false);
    }
  };

  const attribuer = async (offreId: string) => {
    try {
      await api.post(`/api/appels-offres/${aoId}/offres/${offreId}/attribuer/`, {});
      flash("Marché attribué.");
      charger();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Impossible d'attribuer.");
    }
  };

  const sauvegarderCadreConsultation = async () => {
    setSauvegardeCadre(true);
    setErreur(null);
    try {
      await api.patch(`/api/appels-offres/${aoId}/`, {
        pieces_consultation: texteVersListe(cadreConsultation.pieces_consultation),
        points_vigilance: texteVersListe(cadreConsultation.points_vigilance),
        analyse_contractuelle: cadreConsultation.analyse_contractuelle,
        conditions_paiement: cadreConsultation.conditions_paiement,
        garanties_exigees: cadreConsultation.garanties_exigees,
        delai_execution_jours: cadreConsultation.delai_execution_jours
          ? Number(cadreConsultation.delai_execution_jours)
          : null,
        variantes_autorisees: cadreConsultation.variantes_autorisees,
      });
      flash("Cadre de consultation mis à jour.");
      charger();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Impossible d'enregistrer le cadre de consultation.");
    } finally {
      setSauvegardeCadre(false);
    }
  };

  if (chargement) return <div className="py-20 text-center text-slate-400 text-sm">Chargement…</div>;
  if (!ao) {
    return (
      <div className="space-y-4">
        <Link href={`/projets/${projetId}/appels-offres`} className="text-slate-400 hover:text-slate-600 text-sm flex items-center gap-2">
          Retour
        </Link>
        <div className="py-20 text-center text-red-500">Appel d&apos;offres introuvable.</div>
      </div>
    );
  }

  const classeStatut = STATUTS_AO[ao.statut] ?? "badge-neutre";
  const offresTriees = [...ao.offres].sort((a, b) => {
    if (a.note_globale !== null && b.note_globale !== null) return b.note_globale - a.note_globale;
    if (a.montant_offre_ht !== null && b.montant_offre_ht !== null) return a.montant_offre_ht - b.montant_offre_ht;
    return 0;
  });
  const peutSaisir = !["attribue", "infructueux", "abandonne"].includes(ao.statut);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Link href={`/projets/${projetId}`} className="hover:text-slate-600">{ao.projet_reference}</Link>
        <ChevronRight className="w-3 h-3" />
        <Link href={`/projets/${projetId}/appels-offres`} className="hover:text-slate-600">Appels d&apos;offres</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-slate-600 font-medium truncate">{ao.intitule}</span>
      </div>

      {succes && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm">
          <CheckCircle className="w-4 h-4 shrink-0" />{succes}
        </div>
      )}
      {erreur && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />{erreur}
          <button onClick={() => setErreur(null)} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="carte p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap mb-2">
              <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${classeStatut}`}>
                {ao.statut_libelle}
              </span>
              <span className="badge-neutre text-xs">{ao.type_libelle}</span>
              {ao.montant_estime_ht && (
                <span className="text-xs text-slate-500 font-mono">
                  Estimé : {fmt(ao.montant_estime_ht)}
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold text-slate-800">{ao.intitule}</h1>
            {ao.observations && <p className="text-sm text-slate-400 mt-1">{ao.observations}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {ao.offres.length >= 2 && (
              <button onClick={analyserOffres} disabled={analyse} className="btn-secondaire disabled:opacity-60">
                <BarChart3 className="w-4 h-4" />
                {analyse ? "Analyse…" : "Analyser"}
              </button>
            )}
            {peutSaisir && (
              <button onClick={() => { setOffreEdit(null); setModal(true); }} className="btn-primaire">
                <Plus className="w-4 h-4" />Saisir une offre
              </button>
            )}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Publication", date: ao.date_publication },
            { label: "Limite questions", date: ao.date_limite_questions },
            { label: "Remise des offres", date: ao.date_limite_remise },
            { label: "Attribution", date: ao.date_attribution },
          ].map(({ label, date }) => (
            <div key={label} className="bg-slate-50 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs text-slate-400">{label}</span>
              </div>
              <p className={`text-sm font-medium ${date ? "text-slate-700" : "text-slate-300"}`}>
                {fmtDate(date)}
              </p>
            </div>
          ))}
        </div>
      </div>

      {ao.criteres_jugement && ao.criteres_jugement.length > 0 && (
        <div className="carte p-6">
          <h3 className="font-semibold text-slate-700 mb-3 text-sm uppercase tracking-wider">Critères de jugement</h3>
          <div className="flex flex-wrap gap-3">
            {ao.criteres_jugement.map((critere) => (
              <div key={critere.libelle} className="bg-slate-50 rounded-xl px-4 py-2 flex items-center gap-2">
                <span className="text-sm font-medium text-slate-700">{critere.libelle}</span>
                <span className="font-mono text-sm font-bold text-primaire-600">{critere.ponderation_pct}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="carte p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold text-slate-800">Cadre contractuel et consultation</h2>
            <p className="text-sm text-slate-500 mt-1">
              Cette zone sert à structurer la lecture du DCE, les pièces à vérifier et les points de vigilance relevés.
            </p>
          </div>
          <button onClick={sauvegarderCadreConsultation} disabled={sauvegardeCadre} className="btn-primaire shrink-0">
            <Save className="w-4 h-4" />
            {sauvegardeCadre ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wider text-slate-500">Pièces identifiées</p>
            <p className="mt-2 text-2xl font-semibold text-slate-800">{ao.pieces_consultation.length}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wider text-slate-500">Points de vigilance</p>
            <p className="mt-2 text-2xl font-semibold text-slate-800">{ao.points_vigilance.length}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wider text-slate-500">Délai visé</p>
            <p className="mt-2 text-2xl font-semibold text-slate-800">{ao.delai_execution_jours ?? "—"}</p>
            <p className="text-sm text-slate-500">{ao.variantes_autorisees ? "Variantes autorisées" : "Variantes non prévues"}</p>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 p-4 space-y-2">
              <label className="libelle-champ">Pièces de consultation à contrôler</label>
              <textarea
                rows={8}
                className="champ-saisie"
                value={cadreConsultation.pieces_consultation}
                onChange={(e) => setCadreConsultation((precedent) => ({ ...precedent, pieces_consultation: e.target.value }))}
                placeholder="Une ligne par pièce"
              />
            </div>
            <div className="rounded-xl border border-slate-200 p-4 space-y-2">
              <label className="libelle-champ">Points de vigilance contractuels</label>
              <textarea
                rows={8}
                className="champ-saisie"
                value={cadreConsultation.points_vigilance}
                onChange={(e) => setCadreConsultation((precedent) => ({ ...precedent, points_vigilance: e.target.value }))}
                placeholder="Une ligne par vigilance"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="libelle-champ">Délai d&apos;exécution visé</label>
                <input
                  type="number"
                  className="champ-saisie"
                  value={cadreConsultation.delai_execution_jours}
                  onChange={(e) => setCadreConsultation((precedent) => ({ ...precedent, delai_execution_jours: e.target.value }))}
                />
              </div>
              <label className="rounded-xl border border-slate-200 p-4 flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cadreConsultation.variantes_autorisees}
                  onChange={(e) => setCadreConsultation((precedent) => ({ ...precedent, variantes_autorisees: e.target.checked }))}
                />
                <span className="text-sm text-slate-700">Variantes autorisées</span>
              </label>
            </div>

            <div className="rounded-xl border border-slate-200 p-4 space-y-2">
              <label className="libelle-champ">Analyse contractuelle</label>
              <textarea
                rows={5}
                className="champ-saisie"
                value={cadreConsultation.analyse_contractuelle}
                onChange={(e) => setCadreConsultation((precedent) => ({ ...precedent, analyse_contractuelle: e.target.value }))}
              />
            </div>
            <div className="rounded-xl border border-slate-200 p-4 space-y-2">
              <label className="libelle-champ">Conditions de paiement</label>
              <textarea
                rows={4}
                className="champ-saisie"
                value={cadreConsultation.conditions_paiement}
                onChange={(e) => setCadreConsultation((precedent) => ({ ...precedent, conditions_paiement: e.target.value }))}
              />
            </div>
            <div className="rounded-xl border border-slate-200 p-4 space-y-2">
              <label className="libelle-champ">Garanties et assurances</label>
              <textarea
                rows={4}
                className="champ-saisie"
                value={cadreConsultation.garanties_exigees}
                onChange={(e) => setCadreConsultation((precedent) => ({ ...precedent, garanties_exigees: e.target.value }))}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="font-semibold text-slate-700">
          {ao.offres.length} offre{ao.offres.length !== 1 ? "s" : ""} reçue{ao.offres.length !== 1 ? "s" : ""}
        </h2>

        {ao.offres.length === 0 ? (
          <div className="carte py-12 text-center">
            <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">Aucune offre reçue</p>
            <p className="text-slate-400 text-sm mt-1">Saisissez les offres des entreprises consultées.</p>
          </div>
        ) : (
          <div className="carte overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Entreprise</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Statut</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Montant HT</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider hidden md:table-cell">Délai</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider hidden lg:table-cell">Note</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider hidden xl:table-cell">Reçue le</th>
                  <th className="px-4 py-3 w-28"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {offresTriees.map((offre, idx) => {
                  const estRetenue = offre.statut === "retenue";
                  return (
                    <tr key={offre.id} className={`group hover:bg-slate-50 ${estRetenue ? "bg-green-50/50" : ""}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {idx === 0 && ao.offres.length > 1 && offre.note_globale !== null && (
                            <Trophy className="w-4 h-4 text-amber-500 shrink-0" />
                          )}
                          <span className="font-medium text-slate-800">{offre.entreprise_nom}</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          <span className={clsx("text-[11px] px-2 py-0.5 rounded-full", STYLES_CONFORMITE[offre.conformite_administrative] || "badge-neutre")}>
                            Adm. {offre.conformite_administrative_libelle}
                          </span>
                          <span className={clsx("text-[11px] px-2 py-0.5 rounded-full", STYLES_CONFORMITE[offre.conformite_technique] || "badge-neutre")}>
                            Tech. {offre.conformite_technique_libelle}
                          </span>
                        </div>
                        {offre.points_faibles && (
                          <p className="text-xs text-slate-400 mt-1 line-clamp-1">{offre.points_faibles}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUTS_OFFRE[offre.statut] ?? "badge-neutre"}`}>
                          {offre.statut_libelle}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm font-semibold text-slate-700">
                        {fmt(offre.montant_offre_ht)}
                        <p className="text-xs font-normal text-slate-400 mt-1">
                          {fmtPourcentage(offre.ecart_estimation_pct)} vs estimé
                        </p>
                        {offre.montant_negociee_ht && offre.montant_negociee_ht !== offre.montant_offre_ht && (
                          <p className="text-xs text-green-600 font-normal">{fmt(offre.montant_negociee_ht)} négocié</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm hidden md:table-cell text-slate-600">
                        {offre.delai_propose_jours ?? "—"} j
                      </td>
                      <td className="px-4 py-3 text-right hidden lg:table-cell">
                        {offre.note_globale !== null ? (
                          <span className={`font-mono text-sm font-bold ${offre.note_globale >= 70 ? "text-green-600" : offre.note_globale >= 50 ? "text-amber-600" : "text-red-600"}`}>
                            {Number(offre.note_globale).toFixed(1)}/100
                          </span>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-slate-400 hidden xl:table-cell">
                        {fmtDate(offre.date_reception)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                          <button
                            onClick={() => { setOffreEdit(offre); setModal(true); }}
                            className="p-1.5 rounded text-slate-400 hover:text-primaire-600 hover:bg-primaire-50"
                            title="Modifier"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {!estRetenue && peutSaisir && (
                            <button
                              onClick={() => attribuer(offre.id)}
                              className="flex items-center gap-1 text-xs text-green-600 hover:text-green-800 font-medium px-2 py-1 rounded hover:bg-green-50"
                              title="Attribuer le marché"
                            >
                              <Trophy className="w-3.5 h-3.5" />Attribuer
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <ModalOffre
          aoId={aoId}
          organisations={organisations}
          criteres={ao.criteres_jugement || []}
          initial={offreEdit ?? undefined}
          offreId={offreEdit?.id}
          onSuccess={() => { flash(offreEdit ? "Offre modifiée." : "Offre saisie."); charger(); }}
          onClose={() => { setModal(false); setOffreEdit(null); }}
        />
      )}
    </div>
  );
}
