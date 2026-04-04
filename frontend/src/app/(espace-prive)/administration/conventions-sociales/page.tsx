"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Eye,
  EyeOff,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { api, ErreurApi, extraireListeResultats } from "@/crochets/useApi";
import {
  AlerteAdmin,
  EntetePageAdmin,
} from "@/composants/administration/Presentation";

interface ConventionCollective {
  id: string;
  code: string;
  libelle: string;
  idcc: string;
  localisation: string;
  contingent_heures_supp_non_cadre: number;
  contingent_heures_supp_cadre: number;
  source_officielle: string;
  observations: string;
  est_active: boolean;
}

interface RegleConventionnelle {
  id: string;
  convention: string;
  convention_libelle: string;
  code: string;
  libelle: string;
  categorie: string;
  categorie_libelle: string;
  statut_cadre: boolean;
  niveau_classification: string;
  salaire_brut_minimum_mensuel: number;
  heures_contractuelles_mensuelles_defaut: number;
  heures_par_jour_defaut: number;
  mutuelle_employeur_mensuelle_defaut: number;
  titres_restaurant_employeur_mensuels_defaut: number;
  prime_transport_mensuelle_defaut: number;
  taux_absenteisme_defaut: number;
  taux_temps_improductif_defaut: number;
  cout_recrutement_initial_defaut: number;
  observations: string;
  ordre_affichage: number;
  est_active: boolean;
  variantes_locales: VarianteLocaleRegleConventionnelle[];
}

interface VarianteLocaleRegleConventionnelle {
  id: string;
  regle: string;
  regle_libelle: string;
  localisation: string;
  localisation_libelle: string;
  libelle: string;
  salaire_brut_minimum_mensuel: number | null;
  heures_contractuelles_mensuelles_defaut: number | null;
  heures_par_jour_defaut: number | null;
  taux_charges_salariales_defaut: number | null;
  taux_charges_patronales_defaut: number | null;
  mutuelle_employeur_mensuelle_defaut: number | null;
  titres_restaurant_employeur_mensuels_defaut: number | null;
  prime_transport_mensuelle_defaut: number | null;
  taux_absenteisme_defaut: number | null;
  taux_temps_improductif_defaut: number | null;
  taux_occupation_facturable_defaut: number | null;
  cout_recrutement_initial_defaut: number | null;
  source_officielle: string;
  observations: string;
  est_active: boolean;
}

interface ReferenceSocialeLocalisation {
  id: string;
  code: string;
  libelle: string;
  localisation: string;
  localisation_libelle: string;
  smic_horaire: number;
  heures_legales_mensuelles: number;
  commentaire_reglementaire: string;
  source_officielle: string;
  est_active: boolean;
}

interface ProfilMainOeuvre {
  id: string;
  code: string;
  libelle: string;
  categorie: string;
  categorie_libelle: string;
  convention_collective: string | null;
  convention_collective_libelle: string;
  regle_conventionnelle: string | null;
  regle_conventionnelle_libelle: string;
}

interface BrouillonProfil {
  convention_collective: string | null;
  regle_conventionnelle: string | null;
}

const CONVENTION_VIDE = {
  code: "",
  libelle: "",
  idcc: "",
  localisation: "nationale",
  contingent_heures_supp_non_cadre: 220,
  contingent_heures_supp_cadre: 220,
  source_officielle: "",
  observations: "",
  est_active: true,
};

function formatMontant(valeur?: number) {
  if (valeur === null || valeur === undefined || Number.isNaN(valeur)) return "—";
  return `${valeur.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} €`;
}

function formatPourcentage(valeur?: number) {
  if (valeur === null || valeur === undefined || Number.isNaN(valeur)) return "—";
  return `${(valeur * 100).toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} %`;
}

function ModalConvention({
  initial,
  onSave,
  onClose,
}: {
  initial: ConventionCollective | null;
  onSave: (donnees: Partial<ConventionCollective>) => Promise<void>;
  onClose: () => void;
}) {
  const [formulaire, setFormulaire] = useState(
    initial
      ? {
          code: initial.code,
          libelle: initial.libelle,
          idcc: initial.idcc,
          localisation: initial.localisation,
          contingent_heures_supp_non_cadre: initial.contingent_heures_supp_non_cadre,
          contingent_heures_supp_cadre: initial.contingent_heures_supp_cadre,
          source_officielle: initial.source_officielle,
          observations: initial.observations,
          est_active: initial.est_active,
        }
      : { ...CONVENTION_VIDE }
  );
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  function maj(cle: keyof typeof formulaire, valeur: string | number | boolean) {
    setFormulaire((precedent) => ({ ...precedent, [cle]: valeur }));
  }

  async function soumettre() {
    if (!formulaire.code.trim() || !formulaire.libelle.trim()) {
      setErreur("Le code et le libellé sont requis.");
      return;
    }
    try {
      setChargement(true);
      setErreur(null);
      await onSave(formulaire);
      onClose();
    } catch (exception) {
      setErreur(exception instanceof ErreurApi ? exception.detail : "Enregistrement impossible.");
    } finally {
      setChargement(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="font-semibold text-slate-800">
            {initial ? "Modifier la convention collective" : "Nouvelle convention collective"}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4 p-6">
          {erreur && (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {erreur}
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="libelle-champ">Code</label>
              <input className="champ-saisie w-full" value={formulaire.code} onChange={(event) => maj("code", event.target.value)} />
            </div>
            <div>
              <label className="libelle-champ">IDCC</label>
              <input className="champ-saisie w-full" value={formulaire.idcc} onChange={(event) => maj("idcc", event.target.value)} />
            </div>
            <div className="md:col-span-2">
              <label className="libelle-champ">Libellé</label>
              <input className="champ-saisie w-full" value={formulaire.libelle} onChange={(event) => maj("libelle", event.target.value)} />
            </div>
            <div>
              <label className="libelle-champ">Localisation</label>
              <select className="champ-saisie w-full bg-white" value={formulaire.localisation} onChange={(event) => maj("localisation", event.target.value)}>
                <option value="nationale">Nationale</option>
                <option value="metropole">Métropole</option>
                <option value="mayotte">Mayotte</option>
                <option value="dom">Autre DOM</option>
              </select>
            </div>
            <div>
              <label className="libelle-champ">Source officielle</label>
              <input className="champ-saisie w-full" value={formulaire.source_officielle} onChange={(event) => maj("source_officielle", event.target.value)} />
            </div>
            <div>
              <label className="libelle-champ">Contingent heures sup. non-cadre</label>
              <input
                type="number"
                className="champ-saisie w-full"
                value={formulaire.contingent_heures_supp_non_cadre}
                onChange={(event) => maj("contingent_heures_supp_non_cadre", Number(event.target.value || 0))}
              />
            </div>
            <div>
              <label className="libelle-champ">Contingent heures sup. cadre</label>
              <input
                type="number"
                className="champ-saisie w-full"
                value={formulaire.contingent_heures_supp_cadre}
                onChange={(event) => maj("contingent_heures_supp_cadre", Number(event.target.value || 0))}
              />
            </div>
            <div className="md:col-span-2">
              <label className="libelle-champ">Observations</label>
              <textarea
                rows={4}
                className="champ-saisie w-full resize-none"
                value={formulaire.observations}
                onChange={(event) => maj("observations", event.target.value)}
              />
            </div>
          </div>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              className="h-4 w-4 rounded text-primaire-600"
              checked={formulaire.est_active}
              onChange={(event) => maj("est_active", event.target.checked)}
            />
            <span className="text-sm font-medium text-slate-700">Convention active</span>
          </label>
        </div>
        <div className="flex justify-end gap-3 rounded-b-2xl border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button onClick={onClose} className="btn-secondaire">Annuler</button>
          <button onClick={soumettre} disabled={chargement} className="btn-primaire disabled:opacity-60">
            <Save className="h-4 w-4" />
            {chargement ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalRegle({
  initial,
  conventionId,
  onSave,
  onClose,
}: {
  initial: RegleConventionnelle | null;
  conventionId: string;
  onSave: (donnees: Partial<RegleConventionnelle>) => Promise<void>;
  onClose: () => void;
}) {
  const [formulaire, setFormulaire] = useState(
    initial
      ? { ...initial }
      : {
          convention: conventionId,
          code: "",
          libelle: "",
          categorie: "technicien",
          statut_cadre: false,
          niveau_classification: "",
          salaire_brut_minimum_mensuel: 0,
          heures_contractuelles_mensuelles_defaut: 151.67,
          heures_par_jour_defaut: 7,
          mutuelle_employeur_mensuelle_defaut: 55,
          titres_restaurant_employeur_mensuels_defaut: 0,
          prime_transport_mensuelle_defaut: 0,
          taux_absenteisme_defaut: 0.03,
          taux_temps_improductif_defaut: 0.12,
          cout_recrutement_initial_defaut: 0,
          observations: "",
          ordre_affichage: 100,
          est_active: true,
          variantes_locales: [],
          id: "",
          convention_libelle: "",
          categorie_libelle: "",
        }
  );
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  function maj(cle: keyof typeof formulaire, valeur: string | number | boolean) {
    setFormulaire((precedent) => ({ ...precedent, [cle]: valeur }));
  }

  async function soumettre() {
    if (!formulaire.convention || !formulaire.code.trim() || !formulaire.libelle.trim()) {
      setErreur("La convention, le code et le libellé sont requis.");
      return;
    }
    try {
      setChargement(true);
      setErreur(null);
      await onSave(formulaire);
      onClose();
    } catch (exception) {
      setErreur(exception instanceof ErreurApi ? exception.detail : "Enregistrement impossible.");
    } finally {
      setChargement(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-5xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="font-semibold text-slate-800">
            {initial ? "Modifier la règle conventionnelle" : "Nouvelle règle conventionnelle"}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4 p-6">
          {erreur && (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {erreur}
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="libelle-champ">Code</label>
              <input className="champ-saisie w-full" value={formulaire.code} onChange={(event) => maj("code", event.target.value)} />
            </div>
            <div className="md:col-span-2">
              <label className="libelle-champ">Libellé</label>
              <input className="champ-saisie w-full" value={formulaire.libelle} onChange={(event) => maj("libelle", event.target.value)} />
            </div>
            <div>
              <label className="libelle-champ">Catégorie</label>
              <select className="champ-saisie w-full bg-white" value={formulaire.categorie} onChange={(event) => maj("categorie", event.target.value)}>
                <option value="ouvrier">Ouvrier</option>
                <option value="compagnon">Compagnon qualifié</option>
                <option value="technicien">Technicien</option>
                <option value="conducteur">Conducteur de travaux</option>
                <option value="ingenieur">Ingénieur</option>
                <option value="economiste">Économiste</option>
                <option value="redacteur">Rédacteur technique</option>
                <option value="administratif">Administratif</option>
                <option value="autre">Autre</option>
              </select>
            </div>
            <div>
              <label className="libelle-champ">Niveau / position</label>
              <input className="champ-saisie w-full" value={formulaire.niveau_classification} onChange={(event) => maj("niveau_classification", event.target.value)} />
            </div>
            <div>
              <label className="libelle-champ">Ordre d&apos;affichage</label>
              <input type="number" className="champ-saisie w-full" value={formulaire.ordre_affichage} onChange={(event) => maj("ordre_affichage", Number(event.target.value || 0))} />
            </div>
            <div>
              <label className="libelle-champ">Salaire brut minimum mensuel</label>
              <input type="number" step="0.01" className="champ-saisie w-full" value={formulaire.salaire_brut_minimum_mensuel} onChange={(event) => maj("salaire_brut_minimum_mensuel", Number(event.target.value || 0))} />
            </div>
            <div>
              <label className="libelle-champ">Heures mensuelles</label>
              <input type="number" step="0.01" className="champ-saisie w-full" value={formulaire.heures_contractuelles_mensuelles_defaut} onChange={(event) => maj("heures_contractuelles_mensuelles_defaut", Number(event.target.value || 0))} />
            </div>
            <div>
              <label className="libelle-champ">Heures par jour</label>
              <input type="number" step="0.01" className="champ-saisie w-full" value={formulaire.heures_par_jour_defaut} onChange={(event) => maj("heures_par_jour_defaut", Number(event.target.value || 0))} />
            </div>
            <div>
              <label className="libelle-champ">Mutuelle employeur</label>
              <input type="number" step="0.01" className="champ-saisie w-full" value={formulaire.mutuelle_employeur_mensuelle_defaut} onChange={(event) => maj("mutuelle_employeur_mensuelle_defaut", Number(event.target.value || 0))} />
            </div>
            <div>
              <label className="libelle-champ">Titres-restaurant</label>
              <input type="number" step="0.01" className="champ-saisie w-full" value={formulaire.titres_restaurant_employeur_mensuels_defaut} onChange={(event) => maj("titres_restaurant_employeur_mensuels_defaut", Number(event.target.value || 0))} />
            </div>
            <div>
              <label className="libelle-champ">Prime transport</label>
              <input type="number" step="0.01" className="champ-saisie w-full" value={formulaire.prime_transport_mensuelle_defaut} onChange={(event) => maj("prime_transport_mensuelle_defaut", Number(event.target.value || 0))} />
            </div>
            <div>
              <label className="libelle-champ">Taux d&apos;absentéisme</label>
              <input type="number" step="0.0001" className="champ-saisie w-full" value={formulaire.taux_absenteisme_defaut} onChange={(event) => maj("taux_absenteisme_defaut", Number(event.target.value || 0))} />
            </div>
            <div>
              <label className="libelle-champ">Temps improductif</label>
              <input type="number" step="0.0001" className="champ-saisie w-full" value={formulaire.taux_temps_improductif_defaut} onChange={(event) => maj("taux_temps_improductif_defaut", Number(event.target.value || 0))} />
            </div>
            <div>
              <label className="libelle-champ">Coût de recrutement initial</label>
              <input type="number" step="0.01" className="champ-saisie w-full" value={formulaire.cout_recrutement_initial_defaut} onChange={(event) => maj("cout_recrutement_initial_defaut", Number(event.target.value || 0))} />
            </div>
            <div className="md:col-span-3">
              <label className="libelle-champ">Observations</label>
              <textarea rows={4} className="champ-saisie w-full resize-none" value={formulaire.observations} onChange={(event) => maj("observations", event.target.value)} />
            </div>
          </div>
          <div className="flex flex-wrap gap-5">
            <label className="flex items-center gap-3">
              <input type="checkbox" className="h-4 w-4 rounded text-primaire-600" checked={formulaire.statut_cadre} onChange={(event) => maj("statut_cadre", event.target.checked)} />
              <span className="text-sm font-medium text-slate-700">Règle cadre</span>
            </label>
            <label className="flex items-center gap-3">
              <input type="checkbox" className="h-4 w-4 rounded text-primaire-600" checked={formulaire.est_active} onChange={(event) => maj("est_active", event.target.checked)} />
              <span className="text-sm font-medium text-slate-700">Règle active</span>
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-3 rounded-b-2xl border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button onClick={onClose} className="btn-secondaire">Annuler</button>
          <button onClick={soumettre} disabled={chargement} className="btn-primaire disabled:opacity-60">
            <Save className="h-4 w-4" />
            {chargement ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalReferenceSociale({
  initial,
  onSave,
  onClose,
}: {
  initial: ReferenceSocialeLocalisation | null;
  onSave: (donnees: Partial<ReferenceSocialeLocalisation>) => Promise<void>;
  onClose: () => void;
}) {
  const [formulaire, setFormulaire] = useState(
    initial
      ? { ...initial }
      : {
          code: "",
          libelle: "",
          localisation: "metropole",
          localisation_libelle: "",
          smic_horaire: 12.02,
          heures_legales_mensuelles: 151.67,
          commentaire_reglementaire: "",
          source_officielle: "",
          est_active: true,
          id: "",
        }
  );
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  function maj(cle: keyof typeof formulaire, valeur: string | number | boolean) {
    setFormulaire((precedent) => ({ ...precedent, [cle]: valeur }));
  }

  async function soumettre() {
    if (!formulaire.code.trim() || !formulaire.libelle.trim()) {
      setErreur("Le code et le libellé sont requis.");
      return;
    }
    try {
      setChargement(true);
      setErreur(null);
      await onSave(formulaire);
      onClose();
    } catch (exception) {
      setErreur(exception instanceof ErreurApi ? exception.detail : "Enregistrement impossible.");
    } finally {
      setChargement(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="font-semibold text-slate-800">
            {initial ? "Modifier le référentiel territorial" : "Nouveau référentiel territorial"}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4 p-6">
          {erreur && (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {erreur}
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="libelle-champ">Code</label>
              <input className="champ-saisie w-full" value={formulaire.code} onChange={(event) => maj("code", event.target.value)} />
            </div>
            <div>
              <label className="libelle-champ">Localisation</label>
              <select className="champ-saisie w-full bg-white" value={formulaire.localisation} onChange={(event) => maj("localisation", event.target.value)}>
                <option value="metropole">Métropole</option>
                <option value="dom">Autre DOM</option>
                <option value="mayotte">Mayotte</option>
                <option value="nationale">Nationale</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="libelle-champ">Libellé</label>
              <input className="champ-saisie w-full" value={formulaire.libelle} onChange={(event) => maj("libelle", event.target.value)} />
            </div>
            <div>
              <label className="libelle-champ">Smic horaire brut</label>
              <input type="number" step="0.01" className="champ-saisie w-full" value={formulaire.smic_horaire} onChange={(event) => maj("smic_horaire", Number(event.target.value || 0))} />
            </div>
            <div>
              <label className="libelle-champ">Heures légales mensuelles</label>
              <input type="number" step="0.01" className="champ-saisie w-full" value={formulaire.heures_legales_mensuelles} onChange={(event) => maj("heures_legales_mensuelles", Number(event.target.value || 0))} />
            </div>
            <div>
              <label className="libelle-champ">Source officielle</label>
              <input className="champ-saisie w-full" value={formulaire.source_officielle} onChange={(event) => maj("source_officielle", event.target.value)} />
            </div>
            <div className="md:col-span-2">
              <label className="libelle-champ">Commentaire réglementaire</label>
              <textarea rows={4} className="champ-saisie w-full resize-none" value={formulaire.commentaire_reglementaire} onChange={(event) => maj("commentaire_reglementaire", event.target.value)} />
            </div>
          </div>
          <label className="flex items-center gap-3">
            <input type="checkbox" className="h-4 w-4 rounded text-primaire-600" checked={formulaire.est_active} onChange={(event) => maj("est_active", event.target.checked)} />
            <span className="text-sm font-medium text-slate-700">Référentiel actif</span>
          </label>
        </div>
        <div className="flex justify-end gap-3 rounded-b-2xl border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button onClick={onClose} className="btn-secondaire">Annuler</button>
          <button onClick={soumettre} disabled={chargement} className="btn-primaire disabled:opacity-60">
            <Save className="h-4 w-4" />
            {chargement ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalVarianteLocale({
  initial,
  regles,
  conventionId,
  onSave,
  onClose,
}: {
  initial: VarianteLocaleRegleConventionnelle | null;
  regles: RegleConventionnelle[];
  conventionId: string;
  onSave: (donnees: Partial<VarianteLocaleRegleConventionnelle>) => Promise<void>;
  onClose: () => void;
}) {
  const reglesDisponibles = regles.filter((regle) => !conventionId || regle.convention === conventionId);
  const [formulaire, setFormulaire] = useState(
    initial
      ? { ...initial }
      : {
          id: "",
          regle: reglesDisponibles[0]?.id || "",
          regle_libelle: "",
          localisation: "mayotte",
          localisation_libelle: "",
          libelle: "",
          salaire_brut_minimum_mensuel: null,
          heures_contractuelles_mensuelles_defaut: null,
          heures_par_jour_defaut: null,
          taux_charges_salariales_defaut: null,
          taux_charges_patronales_defaut: null,
          mutuelle_employeur_mensuelle_defaut: null,
          titres_restaurant_employeur_mensuels_defaut: null,
          prime_transport_mensuelle_defaut: null,
          taux_absenteisme_defaut: null,
          taux_temps_improductif_defaut: null,
          taux_occupation_facturable_defaut: null,
          cout_recrutement_initial_defaut: null,
          source_officielle: "",
          observations: "",
          est_active: true,
        }
  );
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  function maj(cle: keyof typeof formulaire, valeur: string | number | boolean | null) {
    setFormulaire((precedent) => ({ ...precedent, [cle]: valeur }));
  }

  async function soumettre() {
    if (!formulaire.regle || !formulaire.localisation) {
      setErreur("La règle et la localisation sont requises.");
      return;
    }
    try {
      setChargement(true);
      setErreur(null);
      await onSave(formulaire);
      onClose();
    } catch (exception) {
      setErreur(exception instanceof ErreurApi ? exception.detail : "Enregistrement impossible.");
    } finally {
      setChargement(false);
    }
  }

  function champNombre(
    etiquette: string,
    cle:
      | "salaire_brut_minimum_mensuel"
      | "heures_contractuelles_mensuelles_defaut"
      | "heures_par_jour_defaut"
      | "taux_charges_salariales_defaut"
      | "taux_charges_patronales_defaut"
      | "mutuelle_employeur_mensuelle_defaut"
      | "titres_restaurant_employeur_mensuels_defaut"
      | "prime_transport_mensuelle_defaut"
      | "taux_absenteisme_defaut"
      | "taux_temps_improductif_defaut"
      | "taux_occupation_facturable_defaut"
      | "cout_recrutement_initial_defaut",
    pas = "0.01"
  ) {
    return (
      <div>
        <label className="libelle-champ">{etiquette}</label>
        <input
          type="number"
          step={pas}
          className="champ-saisie w-full"
          value={formulaire[cle] ?? ""}
          onChange={(event) => maj(cle, event.target.value === "" ? null : Number(event.target.value))}
          placeholder="Laisser vide pour hériter"
        />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-6xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="font-semibold text-slate-800">
            {initial ? "Modifier la variante locale" : "Nouvelle variante locale"}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4 p-6">
          {erreur && (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {erreur}
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="libelle-champ">Règle</label>
              <select className="champ-saisie w-full bg-white" value={formulaire.regle} onChange={(event) => maj("regle", event.target.value)}>
                {reglesDisponibles.map((regle) => (
                  <option key={regle.id} value={regle.id}>
                    {regle.libelle}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="libelle-champ">Localisation</label>
              <select className="champ-saisie w-full bg-white" value={formulaire.localisation} onChange={(event) => maj("localisation", event.target.value)}>
                <option value="metropole">Métropole</option>
                <option value="dom">Autre DOM</option>
                <option value="mayotte">Mayotte</option>
                <option value="nationale">Nationale</option>
              </select>
            </div>
            <div>
              <label className="libelle-champ">Libellé</label>
              <input className="champ-saisie w-full" value={formulaire.libelle} onChange={(event) => maj("libelle", event.target.value)} />
            </div>
            {champNombre("Salaire brut minimum", "salaire_brut_minimum_mensuel")}
            {champNombre("Heures mensuelles", "heures_contractuelles_mensuelles_defaut")}
            {champNombre("Heures par jour", "heures_par_jour_defaut")}
            {champNombre("Charges salariales", "taux_charges_salariales_defaut", "0.0001")}
            {champNombre("Charges patronales", "taux_charges_patronales_defaut", "0.0001")}
            {champNombre("Mutuelle employeur", "mutuelle_employeur_mensuelle_defaut")}
            {champNombre("Titres-restaurant", "titres_restaurant_employeur_mensuels_defaut")}
            {champNombre("Prime transport", "prime_transport_mensuelle_defaut")}
            {champNombre("Absentéisme", "taux_absenteisme_defaut", "0.0001")}
            {champNombre("Temps improductif", "taux_temps_improductif_defaut", "0.0001")}
            {champNombre("Taux occupation facturable", "taux_occupation_facturable_defaut", "0.0001")}
            {champNombre("Coût recrutement initial", "cout_recrutement_initial_defaut")}
            <div className="md:col-span-3">
              <label className="libelle-champ">Source officielle</label>
              <input className="champ-saisie w-full" value={formulaire.source_officielle} onChange={(event) => maj("source_officielle", event.target.value)} />
            </div>
            <div className="md:col-span-3">
              <label className="libelle-champ">Observations</label>
              <textarea rows={4} className="champ-saisie w-full resize-none" value={formulaire.observations} onChange={(event) => maj("observations", event.target.value)} />
            </div>
          </div>
          <label className="flex items-center gap-3">
            <input type="checkbox" className="h-4 w-4 rounded text-primaire-600" checked={formulaire.est_active} onChange={(event) => maj("est_active", event.target.checked)} />
            <span className="text-sm font-medium text-slate-700">Variante active</span>
          </label>
        </div>
        <div className="flex justify-end gap-3 rounded-b-2xl border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button onClick={onClose} className="btn-secondaire">Annuler</button>
          <button onClick={soumettre} disabled={chargement} className="btn-primaire disabled:opacity-60">
            <Save className="h-4 w-4" />
            {chargement ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PageConventionsSociales() {
  const [conventions, setConventions] = useState<ConventionCollective[]>([]);
  const [referencesLocales, setReferencesLocales] = useState<ReferenceSocialeLocalisation[]>([]);
  const [regles, setRegles] = useState<RegleConventionnelle[]>([]);
  const [profils, setProfils] = useState<ProfilMainOeuvre[]>([]);
  const [brouillonsProfils, setBrouillonsProfils] = useState<Record<string, BrouillonProfil>>({});
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  const [conventionSelectionnee, setConventionSelectionnee] = useState<string>("");
  const [editionConvention, setEditionConvention] = useState<ConventionCollective | null>(null);
  const [editionReference, setEditionReference] = useState<ReferenceSocialeLocalisation | null>(null);
  const [editionRegle, setEditionRegle] = useState<RegleConventionnelle | null>(null);
  const [editionVarianteLocale, setEditionVarianteLocale] = useState<VarianteLocaleRegleConventionnelle | null>(null);
  const [modalConventionOuverte, setModalConventionOuverte] = useState(false);
  const [modalReferenceOuverte, setModalReferenceOuverte] = useState(false);
  const [modalRegleOuverte, setModalRegleOuverte] = useState(false);
  const [modalVarianteLocaleOuverte, setModalVarianteLocaleOuverte] = useState(false);
  const [suppressionConventionId, setSuppressionConventionId] = useState<string | null>(null);
  const [suppressionReferenceId, setSuppressionReferenceId] = useState<string | null>(null);
  const [suppressionRegleId, setSuppressionRegleId] = useState<string | null>(null);
  const [suppressionVarianteLocaleId, setSuppressionVarianteLocaleId] = useState<string | null>(null);
  const [profilEnCours, setProfilEnCours] = useState<string | null>(null);

  const reglesFiltrees = useMemo(
    () => regles.filter((regle) => !conventionSelectionnee || regle.convention === conventionSelectionnee),
    [regles, conventionSelectionnee]
  );

  function flash(message: string) {
    setSucces(message);
    window.setTimeout(() => setSucces(null), 3000);
  }

  function initialiserBrouillons(listeProfils: ProfilMainOeuvre[]) {
    setBrouillonsProfils(
      Object.fromEntries(
        listeProfils.map((profil) => [
          profil.id,
          {
            convention_collective: profil.convention_collective,
            regle_conventionnelle: profil.regle_conventionnelle,
          },
        ])
      )
    );
  }

  const chargerTout = useCallback(async () => {
    try {
      setChargement(true);
      const [conventionsRecues, referencesRecues, reglesRecues, profilsRecus] = await Promise.all([
        api.get<ConventionCollective[] | { results?: ConventionCollective[] }>("/api/economie/conventions-collectives/"),
        api.get<ReferenceSocialeLocalisation[] | { results?: ReferenceSocialeLocalisation[] }>("/api/economie/references-sociales-localisation/"),
        api.get<RegleConventionnelle[] | { results?: RegleConventionnelle[] }>("/api/economie/regles-conventionnelles/"),
        api.get<ProfilMainOeuvre[] | { results?: ProfilMainOeuvre[] }>("/api/economie/profils-main-oeuvre/"),
      ]);
      const conventionsListe = extraireListeResultats(conventionsRecues);
      const referencesListe = extraireListeResultats(referencesRecues);
      const reglesListe = extraireListeResultats(reglesRecues);
      const profilsListe = extraireListeResultats(profilsRecus);
      setConventions(conventionsListe);
      setReferencesLocales(referencesListe);
      setRegles(reglesListe);
      setProfils(profilsListe);
      initialiserBrouillons(profilsListe);
      setConventionSelectionnee((precedent) => {
        if (precedent && conventionsListe.some((convention) => convention.id === precedent)) {
          return precedent;
        }
        return conventionsListe[0]?.id || "";
      });
      setErreur(null);
    } catch {
      setErreur("Impossible de charger les conventions sociales.");
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    chargerTout();
  }, [chargerTout]);

  async function sauvegarderConvention(donnees: Partial<ConventionCollective>) {
    if (editionConvention) {
      await api.patch(`/api/economie/conventions-collectives/${editionConvention.id}/`, donnees);
      flash("Convention collective mise à jour.");
    } else {
      await api.post("/api/economie/conventions-collectives/", donnees);
      flash("Convention collective créée.");
    }
    await chargerTout();
  }

  async function sauvegarderReference(donnees: Partial<ReferenceSocialeLocalisation>) {
    if (editionReference) {
      await api.patch(`/api/economie/references-sociales-localisation/${editionReference.id}/`, donnees);
      flash("Référentiel territorial mis à jour.");
    } else {
      await api.post("/api/economie/references-sociales-localisation/", donnees);
      flash("Référentiel territorial créé.");
    }
    await chargerTout();
  }

  async function sauvegarderRegle(donnees: Partial<RegleConventionnelle>) {
    if (editionRegle) {
      await api.patch(`/api/economie/regles-conventionnelles/${editionRegle.id}/`, donnees);
      flash("Règle conventionnelle mise à jour.");
    } else {
      await api.post("/api/economie/regles-conventionnelles/", donnees);
      flash("Règle conventionnelle créée.");
    }
    await chargerTout();
  }

  async function sauvegarderVarianteLocale(donnees: Partial<VarianteLocaleRegleConventionnelle>) {
    if (editionVarianteLocale) {
      await api.patch(`/api/economie/variantes-locales-regles-conventionnelles/${editionVarianteLocale.id}/`, donnees);
      flash("Variante locale mise à jour.");
    } else {
      await api.post("/api/economie/variantes-locales-regles-conventionnelles/", donnees);
      flash("Variante locale créée.");
    }
    await chargerTout();
  }

  async function basculerConvention(item: ConventionCollective) {
    await api.patch(`/api/economie/conventions-collectives/${item.id}/`, { est_active: !item.est_active });
    flash(item.est_active ? "Convention désactivée." : "Convention activée.");
    await chargerTout();
  }

  async function basculerRegle(item: RegleConventionnelle) {
    await api.patch(`/api/economie/regles-conventionnelles/${item.id}/`, { est_active: !item.est_active });
    flash(item.est_active ? "Règle désactivée." : "Règle activée.");
    await chargerTout();
  }

  async function basculerReference(item: ReferenceSocialeLocalisation) {
    await api.patch(`/api/economie/references-sociales-localisation/${item.id}/`, { est_active: !item.est_active });
    flash(item.est_active ? "Référentiel désactivé." : "Référentiel activé.");
    await chargerTout();
  }

  async function supprimerConvention(id: string) {
    await api.supprimer(`/api/economie/conventions-collectives/${id}/`);
    setSuppressionConventionId(null);
    flash("Convention supprimée.");
    await chargerTout();
  }

  async function supprimerRegle(id: string) {
    await api.supprimer(`/api/economie/regles-conventionnelles/${id}/`);
    setSuppressionRegleId(null);
    flash("Règle supprimée.");
    await chargerTout();
  }

  async function supprimerReference(id: string) {
    await api.supprimer(`/api/economie/references-sociales-localisation/${id}/`);
    setSuppressionReferenceId(null);
    flash("Référentiel supprimé.");
    await chargerTout();
  }

  async function basculerVarianteLocale(item: VarianteLocaleRegleConventionnelle) {
    await api.patch(`/api/economie/variantes-locales-regles-conventionnelles/${item.id}/`, { est_active: !item.est_active });
    flash(item.est_active ? "Variante locale désactivée." : "Variante locale activée.");
    await chargerTout();
  }

  async function supprimerVarianteLocale(id: string) {
    await api.supprimer(`/api/economie/variantes-locales-regles-conventionnelles/${id}/`);
    setSuppressionVarianteLocaleId(null);
    flash("Variante locale supprimée.");
    await chargerTout();
  }

  function majBrouillonProfil(profilId: string, cle: keyof BrouillonProfil, valeur: string | null) {
    setBrouillonsProfils((precedent) => {
      const courant = precedent[profilId] || { convention_collective: null, regle_conventionnelle: null };
      const suivant = { ...courant, [cle]: valeur };
      if (cle === "convention_collective") {
        const regleCourante = regles.find((regle) => regle.id === courant.regle_conventionnelle);
        if (regleCourante && regleCourante.convention !== valeur) {
          suivant.regle_conventionnelle = null;
        }
      }
      return { ...precedent, [profilId]: suivant };
    });
  }

  async function enregistrerProfil(profil: ProfilMainOeuvre) {
    const brouillon = brouillonsProfils[profil.id];
    if (!brouillon) return;

    try {
      setProfilEnCours(profil.id);
      await api.patch(`/api/economie/profils-main-oeuvre/${profil.id}/`, {
        convention_collective: brouillon.convention_collective,
        regle_conventionnelle: brouillon.regle_conventionnelle,
      });
      flash(`Profil « ${profil.libelle} » mis à jour.`);
      await chargerTout();
    } catch (exception) {
      setErreur(exception instanceof ErreurApi ? exception.detail : "Impossible d'enregistrer le profil.");
    } finally {
      setProfilEnCours(null);
    }
  }

  const nombreVariantesLocales = regles.reduce(
    (total, regle) => total + regle.variantes_locales.length,
    0
  );

  return (
    <div className="space-y-6">
      <EntetePageAdmin
        titre="Conventions sociales et profils"
        description="Paramétrez les conventions collectives, les règles par profil et les rattachements utilisés par le simulateur de coût de main-d’œuvre."
        actions={(
          <div className="flex flex-wrap gap-2">
            <button onClick={() => { setEditionConvention(null); setModalConventionOuverte(true); }} className="btn-secondaire">
              <Plus className="h-4 w-4" />
              Nouvelle convention
            </button>
            <button onClick={() => { setEditionReference(null); setModalReferenceOuverte(true); }} className="btn-secondaire">
              <Plus className="h-4 w-4" />
              Nouveau référentiel
            </button>
            <button
              onClick={() => { setEditionRegle(null); setModalRegleOuverte(true); }}
              disabled={!conventionSelectionnee}
              className="btn-primaire disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Nouvelle règle
            </button>
            <button
              onClick={() => { setEditionVarianteLocale(null); setModalVarianteLocaleOuverte(true); }}
              disabled={reglesFiltrees.length === 0}
              className="btn-primaire disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Nouvelle variante locale
            </button>
          </div>
        )}
        statistiques={[
          { libelle: "Conventions", valeur: `${conventions.length}` },
          { libelle: "Règles", valeur: `${regles.length}` },
          { libelle: "Variantes locales", valeur: `${nombreVariantesLocales}` },
          { libelle: "Profils", valeur: `${profils.length}` },
        ]}
      />

      {succes && <AlerteAdmin type="succes">{succes}</AlerteAdmin>}
      {erreur && <AlerteAdmin type="erreur" action={<button onClick={() => setErreur(null)} className="ml-auto text-red-500"><X className="h-4 w-4" /></button>}>{erreur}</AlerteAdmin>}

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="space-y-6">
          <div className="carte p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Conventions collectives</h2>
                <p className="text-sm text-slate-500">{conventions.length} convention(s) paramétrée(s)</p>
              </div>
            </div>

            <div className="space-y-3">
              {chargement && <div className="py-8 text-center text-sm text-slate-400">Chargement…</div>}
              {!chargement && conventions.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                  Aucune convention collective n&apos;est encore paramétrée.
                </div>
              )}
              {conventions.map((convention) => (
                <button
                  key={convention.id}
                  type="button"
                  onClick={() => setConventionSelectionnee(convention.id)}
                  className={`w-full rounded-2xl border p-4 text-left transition ${
                    conventionSelectionnee === convention.id
                      ? "border-primaire-300 bg-primaire-50"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-slate-800">{convention.libelle}</p>
                        {!convention.est_active && <span className="badge-neutre text-xs">Inactive</span>}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {convention.code} · IDCC {convention.idcc || "non renseigné"} · {convention.localisation}
                      </p>
                      {convention.source_officielle && (
                        <p className="mt-2 truncate text-xs text-primaire-700">{convention.source_officielle}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(event) => { event.stopPropagation(); basculerConvention(convention); }}
                        className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                      >
                        {convention.est_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      </button>
                      <button
                        type="button"
                        onClick={(event) => { event.stopPropagation(); setEditionConvention(convention); setModalConventionOuverte(true); }}
                        className="rounded p-1.5 text-slate-400 hover:bg-primaire-50 hover:text-primaire-600"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      {suppressionConventionId === convention.id ? (
                        <div className="flex gap-1">
                          <button type="button" onClick={(event) => { event.stopPropagation(); supprimerConvention(convention.id); }} className="rounded bg-red-600 px-2 py-1 text-xs text-white">
                            Confirmer
                          </button>
                          <button type="button" onClick={(event) => { event.stopPropagation(); setSuppressionConventionId(null); }} className="px-2 py-1 text-xs text-slate-500">
                            Annuler
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={(event) => { event.stopPropagation(); setSuppressionConventionId(convention.id); }}
                          className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="carte p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Rattachement des profils</h2>
                <p className="text-sm text-slate-500">Chaque profil peut hériter d&apos;une convention et d&apos;une règle métier.</p>
              </div>
              <Link href="/parametres/couts-main-oeuvre" className="btn-secondaire">
                Paramétrer les coûts
              </Link>
            </div>

            <div className="space-y-3">
              {profils.map((profil) => {
                const brouillon = brouillonsProfils[profil.id] || {
                  convention_collective: profil.convention_collective,
                  regle_conventionnelle: profil.regle_conventionnelle,
                };
                const reglesProfil = regles.filter(
                  (regle) => !brouillon.convention_collective || regle.convention === brouillon.convention_collective
                );

                return (
                  <div key={profil.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold text-slate-800">{profil.libelle}</p>
                        <p className="text-xs text-slate-500">{profil.code} · {profil.categorie_libelle}</p>
                      </div>
                      <button
                        onClick={() => enregistrerProfil(profil)}
                        disabled={profilEnCours === profil.id}
                        className="btn-primaire disabled:opacity-50"
                      >
                        <Save className="h-4 w-4" />
                        {profilEnCours === profil.id ? "Enregistrement…" : "Appliquer"}
                      </button>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="libelle-champ">Convention collective</label>
                        <select
                          className="champ-saisie w-full bg-white"
                          value={brouillon.convention_collective || ""}
                          onChange={(event) => majBrouillonProfil(profil.id, "convention_collective", event.target.value || null)}
                        >
                          <option value="">Aucune convention</option>
                          {conventions.map((convention) => (
                            <option key={convention.id} value={convention.id}>
                              {convention.libelle}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="libelle-champ">Règle conventionnelle</label>
                        <select
                          className="champ-saisie w-full bg-white"
                          value={brouillon.regle_conventionnelle || ""}
                          onChange={(event) => majBrouillonProfil(profil.id, "regle_conventionnelle", event.target.value || null)}
                        >
                          <option value="">Aucune règle</option>
                          {reglesProfil.map((regle) => (
                            <option key={regle.id} value={regle.id}>
                              {regle.libelle}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="carte p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Référentiels territoriaux</h2>
                <p className="text-sm text-slate-500">
                  Smic, durée légale et commentaires sociaux par localisation, y compris Mayotte.
                </p>
              </div>
            </div>
            <div className="space-y-3">
              {referencesLocales.map((reference) => (
                <div key={reference.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => { setEditionReference(reference); setModalReferenceOuverte(true); }}
                          className="font-semibold text-slate-800 transition-colors hover:text-primaire-600"
                        >
                          {reference.libelle}
                        </button>
                        {!reference.est_active && <span className="badge-neutre text-xs">Inactif</span>}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {reference.code} · {reference.localisation_libelle}
                      </p>
                      <p className="mt-2 text-sm text-slate-700">
                        Smic horaire {formatMontant(reference.smic_horaire)} · {reference.heures_legales_mensuelles.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} h / mois
                      </p>
                      {reference.commentaire_reglementaire && (
                        <p className="mt-2 text-xs text-slate-500">{reference.commentaire_reglementaire}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => basculerReference(reference)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                        {reference.est_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      </button>
                      <button onClick={() => { setEditionReference(reference); setModalReferenceOuverte(true); }} className="rounded p-1.5 text-slate-400 hover:bg-primaire-50 hover:text-primaire-600">
                        <Pencil className="h-4 w-4" />
                      </button>
                      {suppressionReferenceId === reference.id ? (
                        <div className="flex gap-1">
                          <button onClick={() => supprimerReference(reference.id)} className="rounded bg-red-600 px-2 py-1 text-xs text-white">Confirmer</button>
                          <button onClick={() => setSuppressionReferenceId(null)} className="px-2 py-1 text-xs text-slate-500">Annuler</button>
                        </div>
                      ) : (
                        <button onClick={() => setSuppressionReferenceId(reference.id)} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="carte p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Règles conventionnelles</h2>
              <p className="text-sm text-slate-500">
                {reglesFiltrees.length} règle(s) pour la convention sélectionnée
              </p>
            </div>
            <select
              className="champ-saisie w-full max-w-sm bg-white"
              value={conventionSelectionnee}
              onChange={(event) => setConventionSelectionnee(event.target.value)}
            >
              {conventions.map((convention) => (
                <option key={convention.id} value={convention.id}>
                  {convention.libelle}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-3">
            {!chargement && reglesFiltrees.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                Aucune règle n&apos;est définie pour cette convention.
              </div>
            )}
            {reglesFiltrees.map((regle) => (
              <div key={regle.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => { setEditionRegle(regle); setModalRegleOuverte(true); }}
                        className="font-semibold text-slate-800 transition-colors hover:text-primaire-600"
                      >
                        {regle.libelle}
                      </button>
                      {!regle.est_active && <span className="badge-neutre text-xs">Inactive</span>}
                      {regle.statut_cadre && <span className="badge-neutre text-xs">Cadre</span>}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {regle.code} · {regle.categorie_libelle} · {regle.niveau_classification || "Niveau libre"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => basculerRegle(regle)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                      {regle.est_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </button>
                    <button onClick={() => { setEditionRegle(regle); setModalRegleOuverte(true); }} className="rounded p-1.5 text-slate-400 hover:bg-primaire-50 hover:text-primaire-600">
                      <Pencil className="h-4 w-4" />
                    </button>
                    {suppressionRegleId === regle.id ? (
                      <div className="flex gap-1">
                        <button onClick={() => supprimerRegle(regle.id)} className="rounded bg-red-600 px-2 py-1 text-xs text-white">Confirmer</button>
                        <button onClick={() => setSuppressionRegleId(null)} className="px-2 py-1 text-xs text-slate-500">Annuler</button>
                      </div>
                    ) : (
                      <button onClick={() => setSuppressionRegleId(regle.id)} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl bg-slate-50 p-3 text-sm">
                    <p className="text-slate-500">Minimum conventionnel</p>
                    <p className="mt-1 font-semibold text-slate-800">{formatMontant(regle.salaire_brut_minimum_mensuel)}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3 text-sm">
                    <p className="text-slate-500">Temps productif par défaut</p>
                    <p className="mt-1 font-semibold text-slate-800">
                      {regle.heures_contractuelles_mensuelles_defaut.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} h / mois · {regle.heures_par_jour_defaut.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} h / jour
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3 text-sm">
                    <p className="text-slate-500">Compléments employeur</p>
                    <p className="mt-1 font-semibold text-slate-800">
                      Mutuelle {formatMontant(regle.mutuelle_employeur_mensuelle_defaut)} · Titres {formatMontant(regle.titres_restaurant_employeur_mensuels_defaut)} · Transport {formatMontant(regle.prime_transport_mensuelle_defaut)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3 text-sm">
                    <p className="text-slate-500">Taux par défaut</p>
                    <p className="mt-1 font-semibold text-slate-800">
                      Absentéisme {formatPourcentage(regle.taux_absenteisme_defaut)} · Temps improductif {formatPourcentage(regle.taux_temps_improductif_defaut)}
                    </p>
                  </div>
                </div>
                <div className="mt-4 rounded-2xl border border-dashed border-slate-200 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-800">Variantes locales</p>
                      <p className="text-xs text-slate-500">
                        Surcharges territoriales spécifiques à la métropole, aux DOM ou à Mayotte.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setEditionVarianteLocale({
                          id: "",
                          regle: regle.id,
                          regle_libelle: regle.libelle,
                          localisation: "mayotte",
                          localisation_libelle: "",
                          libelle: "",
                          salaire_brut_minimum_mensuel: null,
                          heures_contractuelles_mensuelles_defaut: null,
                          heures_par_jour_defaut: null,
                          taux_charges_salariales_defaut: null,
                          taux_charges_patronales_defaut: null,
                          mutuelle_employeur_mensuelle_defaut: null,
                          titres_restaurant_employeur_mensuels_defaut: null,
                          prime_transport_mensuelle_defaut: null,
                          taux_absenteisme_defaut: null,
                          taux_temps_improductif_defaut: null,
                          taux_occupation_facturable_defaut: null,
                          cout_recrutement_initial_defaut: null,
                          source_officielle: "",
                          observations: "",
                          est_active: true,
                        });
                        setModalVarianteLocaleOuverte(true);
                      }}
                      className="btn-secondaire"
                    >
                      <Plus className="h-4 w-4" />
                      Ajouter
                    </button>
                  </div>
                  <div className="space-y-3">
                    {regle.variantes_locales.length === 0 && (
                      <p className="text-sm text-slate-500">Aucune variante locale définie pour cette règle.</p>
                    )}
                    {regle.variantes_locales.map((variante) => (
                      <div key={variante.id} className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => { setEditionVarianteLocale(variante); setModalVarianteLocaleOuverte(true); }}
                                className="font-medium text-slate-800 transition-colors hover:text-primaire-600"
                              >
                                {variante.libelle || variante.localisation_libelle}
                              </button>
                              {!variante.est_active && <span className="badge-neutre text-xs">Inactive</span>}
                            </div>
                            <p className="mt-1 text-xs text-slate-500">{variante.localisation_libelle}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <button onClick={() => basculerVarianteLocale(variante)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                              {variante.est_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                            </button>
                            <button onClick={() => { setEditionVarianteLocale(variante); setModalVarianteLocaleOuverte(true); }} className="rounded p-1.5 text-slate-400 hover:bg-primaire-50 hover:text-primaire-600">
                              <Pencil className="h-4 w-4" />
                            </button>
                            {suppressionVarianteLocaleId === variante.id ? (
                              <div className="flex gap-1">
                                <button onClick={() => supprimerVarianteLocale(variante.id)} className="rounded bg-red-600 px-2 py-1 text-xs text-white">Confirmer</button>
                                <button onClick={() => setSuppressionVarianteLocaleId(null)} className="px-2 py-1 text-xs text-slate-500">Annuler</button>
                              </div>
                            ) : (
                              <button onClick={() => setSuppressionVarianteLocaleId(variante.id)} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="mt-2 text-xs text-slate-600">
                          {variante.salaire_brut_minimum_mensuel !== null ? `Minimum ${formatMontant(variante.salaire_brut_minimum_mensuel)} · ` : ""}
                          {variante.taux_charges_patronales_defaut !== null ? `Charges patronales ${formatPourcentage(variante.taux_charges_patronales_defaut)} · ` : ""}
                          {variante.mutuelle_employeur_mensuelle_defaut !== null ? `Mutuelle ${formatMontant(variante.mutuelle_employeur_mensuelle_defaut)}` : "Hérite des valeurs générales"}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {modalConventionOuverte && (
        <ModalConvention
          initial={editionConvention}
          onSave={sauvegarderConvention}
          onClose={() => {
            setEditionConvention(null);
            setModalConventionOuverte(false);
          }}
        />
      )}

      {modalReferenceOuverte && (
        <ModalReferenceSociale
          initial={editionReference}
          onSave={sauvegarderReference}
          onClose={() => {
            setEditionReference(null);
            setModalReferenceOuverte(false);
          }}
        />
      )}

      {modalRegleOuverte && (
        <ModalRegle
          initial={editionRegle}
          conventionId={editionRegle?.convention || conventionSelectionnee}
          onSave={sauvegarderRegle}
          onClose={() => {
            setEditionRegle(null);
            setModalRegleOuverte(false);
          }}
        />
      )}

      {modalVarianteLocaleOuverte && (
        <ModalVarianteLocale
          initial={editionVarianteLocale}
          regles={regles}
          conventionId={conventionSelectionnee}
          onSave={sauvegarderVarianteLocale}
          onClose={() => {
            setEditionVarianteLocale(null);
            setModalVarianteLocaleOuverte(false);
          }}
        />
      )}
    </div>
  );
}
