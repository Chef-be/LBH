"use client";

import { useState, useEffect, useCallback } from "react";
import {
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  HardHat,
  Info,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { api, ErreurApi, extraireListeResultats } from "@/crochets/useApi";
import {
  AlerteAdmin,
  CarteSectionAdmin,
  EntetePageAdmin,
} from "@/composants/administration/Presentation";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProfilDHMO {
  id: string;
  code: string;
  libelle: string;
  categorie: string;
  categorie_libelle: string;
  secteur_activite: string;
  metier: string;
  specialite: string;
  niveau_classification: string;
  localisation: string;
  salaire_brut_mensuel_defaut: number;
  primes_mensuelles_defaut: number;
  avantages_mensuels_defaut: number;
  heures_contractuelles_mensuelles: number;
  heures_par_jour: number;
  nb_heures_supp_25_mensuelles: number;
  nb_heures_supp_50_mensuelles: number;
  panier_repas_journalier: number;
  jours_travail_mensuels_defaut: number;
  taux_charges_salariales: number;
  taux_charges_patronales: number;
  taux_absenteisme: number;
  taux_temps_improductif: number;
  taux_frais_agence: number;
  taux_risque_operationnel: number;
  taux_marge_cible: number;
  cout_equipement_mensuel: number;
  cout_transport_mensuel: number;
  cout_structure_mensuel: number;
  mutuelle_employeur_mensuelle_defaut: number;
  prime_transport_mensuelle_defaut: number;
  taux_horaire_recommande_defaut: number | null;
  est_actif: boolean;
  ordre_affichage: number;
}

interface SimulationResultat {
  bulletin: {
    salaire_brut_mensuel: number;
    primes_mensuelles: number;
    avantages_mensuels: number;
    nb_heures_supp_25_mensuelles: number;
    nb_heures_supp_50_mensuelles: number;
    montant_hs_25: number;
    montant_hs_50: number;
    montant_heures_supplementaires: number;
    remuneration_brute_mensuelle: number;
    cotisations_salariales: number;
    net_hors_impot: number;
    charges_patronales: number;
    panier_repas_mensuel: number;
    mutuelle_employeur_mensuelle: number;
    prime_transport_mensuelle: number;
    cout_employeur_mensuel: number;
    cout_complet_mensuel: number;
  };
  resultats: {
    dhmo: number;
    taux_horaire_entreprise: number;
    taux_journalier_entreprise: number;
    cout_horaire_productif: number;
  };
  avertissements: string[];
}

interface FormulaireData {
  code: string;
  libelle: string;
  categorie: string;
  secteur_activite: string;
  metier: string;
  specialite: string;
  niveau_classification: string;
  localisation: string;
  salaire_brut_mensuel_defaut: number;
  primes_mensuelles_defaut: number;
  avantages_mensuels_defaut: number;
  heures_contractuelles_mensuelles: number;
  heures_par_jour: number;
  nb_heures_supp_25_mensuelles: number;
  nb_heures_supp_50_mensuelles: number;
  panier_repas_journalier: number;
  jours_travail_mensuels_defaut: number;
  taux_charges_salariales: number;
  taux_charges_patronales: number;
  taux_absenteisme: number;
  taux_temps_improductif: number;
  taux_frais_agence: number;
  taux_risque_operationnel: number;
  taux_marge_cible: number;
  cout_equipement_mensuel: number;
  cout_transport_mensuel: number;
  cout_structure_mensuel: number;
  mutuelle_employeur_mensuelle: number;
  prime_transport_mensuelle: number;
  est_actif: boolean;
  ordre_affichage: number;
}

const VIDE: FormulaireData = {
  code: "", libelle: "", categorie: "ouvrier", secteur_activite: "batiment",
  metier: "", specialite: "", niveau_classification: "", localisation: "metropole",
  salaire_brut_mensuel_defaut: 2200, primes_mensuelles_defaut: 0, avantages_mensuels_defaut: 0,
  heures_contractuelles_mensuelles: 151.67, heures_par_jour: 7,
  nb_heures_supp_25_mensuelles: 0, nb_heures_supp_50_mensuelles: 0,
  panier_repas_journalier: 0, jours_travail_mensuels_defaut: 21.67,
  taux_charges_salariales: 0.22, taux_charges_patronales: 0.42,
  taux_absenteisme: 0.03, taux_temps_improductif: 0.12,
  taux_frais_agence: 0.12, taux_risque_operationnel: 0.02, taux_marge_cible: 0.08,
  cout_equipement_mensuel: 80, cout_transport_mensuel: 50, cout_structure_mensuel: 250,
  mutuelle_employeur_mensuelle: 55, prime_transport_mensuelle: 0,
  est_actif: true, ordre_affichage: 100,
};

const CATEGORIES = [
  { val: "manoeuvre", lib: "Manœuvre" },
  { val: "ouvrier", lib: "Ouvrier" },
  { val: "compagnon", lib: "Compagnon" },
  { val: "chef_equipe", lib: "Chef d'équipe" },
  { val: "chef_chantier", lib: "Chef de chantier" },
  { val: "conducteur", lib: "Conducteur de travaux" },
  { val: "technicien", lib: "Technicien / ETAM" },
  { val: "ingenieur", lib: "Ingénieur / Cadre" },
  { val: "autre", lib: "Autre" },
];

const SECTEURS = [
  { val: "batiment", lib: "Bâtiment" },
  { val: "vrd", lib: "VRD" },
  { val: "maitrise_oeuvre", lib: "Maîtrise d'œuvre" },
  { val: "entreprise_generale", lib: "Entreprise générale" },
  { val: "support", lib: "Support / structure" },
  { val: "autre", lib: "Autre" },
];

const LOCALISATIONS = [
  { val: "metropole", lib: "Métropole" },
  { val: "ile_de_france", lib: "Île-de-France" },
  { val: "dom", lib: "DOM" },
  { val: "mayotte", lib: "Mayotte" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fmt = (v: number | null | undefined, dec = 2) =>
  v == null ? "—" : new Intl.NumberFormat("fr-FR", { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(v);

const pct = (v: number) => `${(v * 100).toFixed(1)} %`;

// ---------------------------------------------------------------------------
// Composant ligne formulaire
// ---------------------------------------------------------------------------

function LigneChamp({
  libelle, aide, children,
}: { libelle: string; aide?: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-4 items-start py-2.5 border-b border-slate-50 last:border-0">
      <div>
        <p className="text-xs font-medium text-slate-700">{libelle}</p>
        {aide && <p className="mt-0.5 text-[11px] text-slate-400 leading-tight">{aide}</p>}
      </div>
      <div className="col-span-2">{children}</div>
    </div>
  );
}

function ChampNum({
  value, onChange, min = 0, step = 1, suffix,
}: {
  value: number; onChange: (v: number) => void; min?: number; step?: number; suffix?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        className="champ-saisie w-32 text-right"
        value={value}
        min={min}
        step={step}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      />
      {suffix && <span className="text-xs text-slate-400">{suffix}</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal de formulaire
// ---------------------------------------------------------------------------

function ModalFormulaire({
  profil,
  onFermer,
  onEnregistre,
}: {
  profil: ProfilDHMO | null;
  onFermer: () => void;
  onEnregistre: () => void;
}) {
  const [form, setForm] = useState<FormulaireData>(profil ? {
    code: profil.code,
    libelle: profil.libelle,
    categorie: profil.categorie,
    secteur_activite: profil.secteur_activite,
    metier: profil.metier || "",
    specialite: profil.specialite || "",
    niveau_classification: profil.niveau_classification || "",
    localisation: profil.localisation,
    salaire_brut_mensuel_defaut: profil.salaire_brut_mensuel_defaut,
    primes_mensuelles_defaut: profil.primes_mensuelles_defaut,
    avantages_mensuels_defaut: profil.avantages_mensuels_defaut,
    heures_contractuelles_mensuelles: profil.heures_contractuelles_mensuelles,
    heures_par_jour: profil.heures_par_jour,
    nb_heures_supp_25_mensuelles: profil.nb_heures_supp_25_mensuelles,
    nb_heures_supp_50_mensuelles: profil.nb_heures_supp_50_mensuelles,
    panier_repas_journalier: profil.panier_repas_journalier,
    jours_travail_mensuels_defaut: profil.jours_travail_mensuels_defaut,
    taux_charges_salariales: profil.taux_charges_salariales,
    taux_charges_patronales: profil.taux_charges_patronales,
    taux_absenteisme: profil.taux_absenteisme,
    taux_temps_improductif: profil.taux_temps_improductif,
    taux_frais_agence: profil.taux_frais_agence,
    taux_risque_operationnel: profil.taux_risque_operationnel,
    taux_marge_cible: profil.taux_marge_cible,
    cout_equipement_mensuel: profil.cout_equipement_mensuel,
    cout_transport_mensuel: profil.cout_transport_mensuel,
    cout_structure_mensuel: profil.cout_structure_mensuel,
    mutuelle_employeur_mensuelle: profil.mutuelle_employeur_mensuelle_defaut || 55,
    prime_transport_mensuelle: profil.prime_transport_mensuelle_defaut || 0,
    est_actif: profil.est_actif,
    ordre_affichage: profil.ordre_affichage,
  } : VIDE);

  const [simulation, setSimulation] = useState<SimulationResultat | null>(null);
  const [calcul, setCalcul] = useState(false);
  const [enregistrement, setEnregistrement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [sectionOuverte, setSectionOuverte] = useState<string>("remuneration");

  const maj = useCallback(<K extends keyof FormulaireData>(champ: K, val: FormulaireData[K]) => {
    setForm((f) => ({ ...f, [champ]: val }));
  }, []);

  const calculerDHMO = useCallback(async () => {
    setCalcul(true);
    try {
      const reponse = await api.post<SimulationResultat>("/api/economie/simulateur-main-oeuvre/", {
        salaire_brut_mensuel: form.salaire_brut_mensuel_defaut,
        primes_mensuelles: form.primes_mensuelles_defaut,
        avantages_mensuels: form.avantages_mensuels_defaut,
        heures_contractuelles_mensuelles: form.heures_contractuelles_mensuelles,
        heures_par_jour: form.heures_par_jour,
        nb_heures_supp_25_mensuelles: form.nb_heures_supp_25_mensuelles,
        nb_heures_supp_50_mensuelles: form.nb_heures_supp_50_mensuelles,
        panier_repas_mensuel: form.panier_repas_journalier * form.jours_travail_mensuels_defaut,
        mutuelle_employeur_mensuelle: form.mutuelle_employeur_mensuelle,
        titres_restaurant_employeur_mensuels: 0,
        prime_transport_mensuelle: form.prime_transport_mensuelle,
        taux_charges_salariales: form.taux_charges_salariales,
        taux_charges_patronales: form.taux_charges_patronales,
        taux_absenteisme: form.taux_absenteisme,
        taux_temps_improductif: form.taux_temps_improductif,
        taux_frais_agence: form.taux_frais_agence,
        taux_risque_operationnel: form.taux_risque_operationnel,
        taux_marge_cible: form.taux_marge_cible,
        cout_equipement_mensuel: form.cout_equipement_mensuel,
        cout_transport_mensuel: form.cout_transport_mensuel,
        cout_structure_mensuel: form.cout_structure_mensuel,
        localisation: form.localisation,
        contrat_travail: "cdi",
        statut_cadre: form.categorie === "ingenieur" || form.categorie === "conducteur",
        clientele: "public",
      });
      setSimulation(reponse);
    } catch {
      setSimulation(null);
    } finally {
      setCalcul(false);
    }
  }, [form]);

  // Recalcul auto quand les paramètres changent
  useEffect(() => {
    const t = setTimeout(() => { calculerDHMO(); }, 600);
    return () => clearTimeout(t);
  }, [calculerDHMO]);

  const enregistrer = async () => {
    if (!form.code || !form.libelle) {
      setErreur("Le code et le libellé sont obligatoires.");
      return;
    }
    setEnregistrement(true);
    setErreur(null);
    try {
      const payload = {
        code: form.code,
        libelle: form.libelle,
        categorie: form.categorie,
        secteur_activite: form.secteur_activite,
        metier: form.metier,
        specialite: form.specialite,
        niveau_classification: form.niveau_classification,
        localisation: form.localisation,
        salaire_brut_mensuel_defaut: form.salaire_brut_mensuel_defaut,
        primes_mensuelles_defaut: form.primes_mensuelles_defaut,
        avantages_mensuels_defaut: form.avantages_mensuels_defaut,
        heures_contractuelles_mensuelles: form.heures_contractuelles_mensuelles,
        heures_par_jour: form.heures_par_jour,
        nb_heures_supp_25_mensuelles: form.nb_heures_supp_25_mensuelles,
        nb_heures_supp_50_mensuelles: form.nb_heures_supp_50_mensuelles,
        panier_repas_journalier: form.panier_repas_journalier,
        jours_travail_mensuels_defaut: form.jours_travail_mensuels_defaut,
        taux_charges_salariales: form.taux_charges_salariales,
        taux_charges_patronales: form.taux_charges_patronales,
        taux_absenteisme: form.taux_absenteisme,
        taux_temps_improductif: form.taux_temps_improductif,
        taux_frais_agence: form.taux_frais_agence,
        taux_risque_operationnel: form.taux_risque_operationnel,
        taux_marge_cible: form.taux_marge_cible,
        cout_equipement_mensuel: form.cout_equipement_mensuel,
        cout_transport_mensuel: form.cout_transport_mensuel,
        cout_structure_mensuel: form.cout_structure_mensuel,
        est_actif: form.est_actif,
        ordre_affichage: form.ordre_affichage,
      };
      if (profil) {
        await api.patch(`/api/economie/profils-main-oeuvre/${profil.id}/`, payload);
      } else {
        await api.post("/api/economie/profils-main-oeuvre/", payload);
      }
      onEnregistre();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Enregistrement impossible.");
    } finally {
      setEnregistrement(false);
    }
  };

  const dhmo = simulation?.resultats?.cout_horaire_productif;
  const avertissements = simulation?.avertissements?.filter((a) =>
    !a.includes("indicative")
  ) ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="my-8 w-full max-w-4xl rounded-2xl bg-white shadow-2xl">
        {/* Entête */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="font-semibold text-slate-900">
              {profil ? `Modifier — ${profil.libelle}` : "Nouveau profil DHMO"}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Paramétrez le déboursé horaire de main-d&apos;œuvre pour ce type d&apos;ouvrier
            </p>
          </div>
          <button onClick={onFermer} className="rounded-lg p-1.5 hover:bg-slate-100">
            <X className="h-4 w-4 text-slate-500" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
          {/* Formulaire */}
          <div className="lg:col-span-2 p-6 space-y-0">
            {erreur && <AlerteAdmin type="erreur">{erreur}</AlerteAdmin>}

            {/* Identification */}
            <AccordeonSection
              titre="Identification"
              ouverte={sectionOuverte === "identification"}
              onToggle={() => setSectionOuverte(s => s === "identification" ? "" : "identification")}
            >
              <LigneChamp libelle="Code" aide="Identifiant unique (ex : MO-G01)">
                <input type="text" className="champ-saisie w-full" value={form.code}
                  onChange={(e) => maj("code", e.target.value.toUpperCase())} placeholder="MO-G01" />
              </LigneChamp>
              <LigneChamp libelle="Libellé">
                <input type="text" className="champ-saisie w-full" value={form.libelle}
                  onChange={(e) => maj("libelle", e.target.value)} placeholder="Maçon N3P2 — zone Nord" />
              </LigneChamp>
              <LigneChamp libelle="Catégorie">
                <select className="champ-saisie w-full" value={form.categorie}
                  onChange={(e) => maj("categorie", e.target.value)}>
                  {CATEGORIES.map((c) => <option key={c.val} value={c.val}>{c.lib}</option>)}
                </select>
              </LigneChamp>
              <LigneChamp libelle="Secteur">
                <select className="champ-saisie w-full" value={form.secteur_activite}
                  onChange={(e) => maj("secteur_activite", e.target.value)}>
                  {SECTEURS.map((s) => <option key={s.val} value={s.val}>{s.lib}</option>)}
                </select>
              </LigneChamp>
              <LigneChamp libelle="Métier">
                <input type="text" className="champ-saisie w-full" value={form.metier}
                  onChange={(e) => maj("metier", e.target.value)} placeholder="Maçon, Électricien…" />
              </LigneChamp>
              <LigneChamp libelle="Classification">
                <input type="text" className="champ-saisie w-full" value={form.niveau_classification}
                  onChange={(e) => maj("niveau_classification", e.target.value)} placeholder="N3P2, Ouvrier qualifié…" />
              </LigneChamp>
              <LigneChamp libelle="Localisation">
                <select className="champ-saisie w-full" value={form.localisation}
                  onChange={(e) => maj("localisation", e.target.value)}>
                  {LOCALISATIONS.map((l) => <option key={l.val} value={l.val}>{l.lib}</option>)}
                </select>
              </LigneChamp>
            </AccordeonSection>

            {/* Rémunération */}
            <AccordeonSection
              titre="Rémunération mensuelle"
              ouverte={sectionOuverte === "remuneration"}
              onToggle={() => setSectionOuverte(s => s === "remuneration" ? "" : "remuneration")}
            >
              <LigneChamp libelle="Salaire brut de base">
                <ChampNum value={form.salaire_brut_mensuel_defaut} step={50}
                  onChange={(v) => maj("salaire_brut_mensuel_defaut", v)} suffix="€/mois" />
              </LigneChamp>
              <LigneChamp libelle="Primes mensuelles" aide="13e mois ramené au mois, primes conventionnelles…">
                <ChampNum value={form.primes_mensuelles_defaut} step={10}
                  onChange={(v) => maj("primes_mensuelles_defaut", v)} suffix="€/mois" />
              </LigneChamp>
              <LigneChamp libelle="Avantages en nature" aide="Logement, véhicule, équipements…">
                <ChampNum value={form.avantages_mensuels_defaut} step={10}
                  onChange={(v) => maj("avantages_mensuels_defaut", v)} suffix="€/mois" />
              </LigneChamp>
              <LigneChamp libelle="Heures contractuelles">
                <ChampNum value={form.heures_contractuelles_mensuelles} step={0.5}
                  onChange={(v) => maj("heures_contractuelles_mensuelles", v)} suffix="h/mois" />
              </LigneChamp>
              <LigneChamp libelle="Heures par journée">
                <ChampNum value={form.heures_par_jour} step={0.5}
                  onChange={(v) => maj("heures_par_jour", v)} suffix="h/j" />
              </LigneChamp>
            </AccordeonSection>

            {/* Heures supplémentaires */}
            <AccordeonSection
              titre="Heures supplémentaires"
              ouverte={sectionOuverte === "hs"}
              onToggle={() => setSectionOuverte(s => s === "hs" ? "" : "hs")}
            >
              <LigneChamp libelle="HS majorées à 25 %" aide="Semaine 36-43 (limite légale)">
                <ChampNum value={form.nb_heures_supp_25_mensuelles} step={0.5}
                  onChange={(v) => maj("nb_heures_supp_25_mensuelles", v)} suffix="h/mois" />
              </LigneChamp>
              <LigneChamp libelle="HS majorées à 50 %" aide="Au-delà de 43 h/sem, dimanches, jours fériés">
                <ChampNum value={form.nb_heures_supp_50_mensuelles} step={0.5}
                  onChange={(v) => maj("nb_heures_supp_50_mensuelles", v)} suffix="h/mois" />
              </LigneChamp>
            </AccordeonSection>

            {/* Compléments employeur */}
            <AccordeonSection
              titre="Compléments employeur"
              ouverte={sectionOuverte === "complements"}
              onToggle={() => setSectionOuverte(s => s === "complements" ? "" : "complements")}
            >
              <LigneChamp libelle="Panier repas" aide="Montant journalier (zone BTP)">
                <ChampNum value={form.panier_repas_journalier} step={0.5}
                  onChange={(v) => maj("panier_repas_journalier", v)} suffix="€/j" />
              </LigneChamp>
              <LigneChamp libelle="Jours travaillés/mois" aide="Base 260 j / 12 = 21,67">
                <ChampNum value={form.jours_travail_mensuels_defaut} step={0.5}
                  onChange={(v) => maj("jours_travail_mensuels_defaut", v)} suffix="j/mois" />
              </LigneChamp>
              <LigneChamp libelle="Mutuelle employeur">
                <ChampNum value={form.mutuelle_employeur_mensuelle} step={5}
                  onChange={(v) => maj("mutuelle_employeur_mensuelle", v)} suffix="€/mois" />
              </LigneChamp>
              <LigneChamp libelle="Prime de transport" aide="Part employeur — 50% du titre de transport">
                <ChampNum value={form.prime_transport_mensuelle} step={5}
                  onChange={(v) => maj("prime_transport_mensuelle", v)} suffix="€/mois" />
              </LigneChamp>
            </AccordeonSection>

            {/* Charges sociales */}
            <AccordeonSection
              titre="Charges sociales"
              ouverte={sectionOuverte === "charges"}
              onToggle={() => setSectionOuverte(s => s === "charges" ? "" : "charges")}
            >
              <LigneChamp libelle="Charges salariales" aide="Sur rémunération brute">
                <ChampNum value={Math.round(form.taux_charges_salariales * 1000) / 10} step={0.1}
                  onChange={(v) => maj("taux_charges_salariales", v / 100)} suffix="%" />
              </LigneChamp>
              <LigneChamp libelle="Charges patronales" aide="Avant réduction Fillon">
                <ChampNum value={Math.round(form.taux_charges_patronales * 1000) / 10} step={0.1}
                  onChange={(v) => maj("taux_charges_patronales", v / 100)} suffix="%" />
              </LigneChamp>
            </AccordeonSection>

            {/* Productivité & structure */}
            <AccordeonSection
              titre="Productivité & structure"
              ouverte={sectionOuverte === "productivite"}
              onToggle={() => setSectionOuverte(s => s === "productivite" ? "" : "productivite")}
            >
              <LigneChamp libelle="Taux d&apos;absentéisme">
                <ChampNum value={Math.round(form.taux_absenteisme * 1000) / 10} step={0.1}
                  onChange={(v) => maj("taux_absenteisme", v / 100)} suffix="%" />
              </LigneChamp>
              <LigneChamp libelle="Temps improductif">
                <ChampNum value={Math.round(form.taux_temps_improductif * 1000) / 10} step={0.1}
                  onChange={(v) => maj("taux_temps_improductif", v / 100)} suffix="%" />
              </LigneChamp>
              <LigneChamp libelle="Frais d&apos;agence">
                <ChampNum value={Math.round(form.taux_frais_agence * 1000) / 10} step={0.1}
                  onChange={(v) => maj("taux_frais_agence", v / 100)} suffix="%" />
              </LigneChamp>
              <LigneChamp libelle="Risque opérationnel">
                <ChampNum value={Math.round(form.taux_risque_operationnel * 1000) / 10} step={0.1}
                  onChange={(v) => maj("taux_risque_operationnel", v / 100)} suffix="%" />
              </LigneChamp>
              <LigneChamp libelle="Marge cible">
                <ChampNum value={Math.round(form.taux_marge_cible * 1000) / 10} step={0.1}
                  onChange={(v) => maj("taux_marge_cible", v / 100)} suffix="%" />
              </LigneChamp>
              <LigneChamp libelle="Coût matériel mensuel">
                <ChampNum value={form.cout_equipement_mensuel} step={10}
                  onChange={(v) => maj("cout_equipement_mensuel", v)} suffix="€/mois" />
              </LigneChamp>
              <LigneChamp libelle="Coût transport mensuel">
                <ChampNum value={form.cout_transport_mensuel} step={10}
                  onChange={(v) => maj("cout_transport_mensuel", v)} suffix="€/mois" />
              </LigneChamp>
              <LigneChamp libelle="Coût structure mensuel" aide="Quote-part frais généraux affectée">
                <ChampNum value={form.cout_structure_mensuel} step={10}
                  onChange={(v) => maj("cout_structure_mensuel", v)} suffix="€/mois" />
              </LigneChamp>
            </AccordeonSection>
          </div>

          {/* Panneau résultats DHMO */}
          <div className="p-6 bg-slate-50 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Résultat DHMO
              </p>
              {calcul && <RefreshCw className="h-3.5 w-3.5 animate-spin text-slate-400" />}
            </div>

            {/* DHMO principal */}
            <div className="rounded-2xl bg-white border border-slate-200 p-5 text-center">
              <p className="text-xs text-slate-500 mb-1">Déboursé horaire MO</p>
              <p className="text-3xl font-bold text-primaire-700">
                {dhmo != null ? fmt(dhmo) : "—"} <span className="text-sm font-normal text-slate-400">€/h</span>
              </p>
              {simulation && (
                <p className="mt-1 text-xs text-slate-400">
                  {fmt(simulation.resultats.taux_journalier_entreprise)} €/j productif
                </p>
              )}
            </div>

            {simulation && (
              <>
                {/* Décomposition bulletin */}
                <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-50">
                  {[
                    { lib: "Salaire brut de base", val: simulation.bulletin.salaire_brut_mensuel },
                    ...(simulation.bulletin.primes_mensuelles > 0 ? [{ lib: "Primes", val: simulation.bulletin.primes_mensuelles }] : []),
                    ...(simulation.bulletin.nb_heures_supp_25_mensuelles > 0 ? [{ lib: `HS 25% (${fmt(simulation.bulletin.nb_heures_supp_25_mensuelles, 1)} h)`, val: simulation.bulletin.montant_hs_25 }] : []),
                    ...(simulation.bulletin.nb_heures_supp_50_mensuelles > 0 ? [{ lib: `HS 50% (${fmt(simulation.bulletin.nb_heures_supp_50_mensuelles, 1)} h)`, val: simulation.bulletin.montant_hs_50 }] : []),
                    { lib: "Rémunération brute", val: simulation.bulletin.remuneration_brute_mensuelle, gras: true },
                    { lib: "Charges patronales", val: simulation.bulletin.charges_patronales },
                    ...(simulation.bulletin.panier_repas_mensuel > 0 ? [{ lib: "Panier repas", val: simulation.bulletin.panier_repas_mensuel }] : []),
                    ...(simulation.bulletin.mutuelle_employeur_mensuelle > 0 ? [{ lib: "Mutuelle", val: simulation.bulletin.mutuelle_employeur_mensuelle }] : []),
                    ...(simulation.bulletin.prime_transport_mensuelle > 0 ? [{ lib: "Transport", val: simulation.bulletin.prime_transport_mensuelle }] : []),
                    { lib: "Coût employeur total", val: simulation.bulletin.cout_employeur_mensuel, gras: true },
                    { lib: "Coût complet (+ structure)", val: simulation.bulletin.cout_complet_mensuel, gras: true },
                  ].map(({ lib, val, gras }) => (
                    <div key={lib} className="flex items-center justify-between px-4 py-2 text-xs">
                      <span className={gras ? "font-semibold text-slate-800" : "text-slate-500"}>{lib}</span>
                      <span className={gras ? "font-bold text-slate-900" : "text-slate-600"}>{fmt(val)} €</span>
                    </div>
                  ))}
                </div>

                {/* Avertissements */}
                {avertissements.length > 0 && (
                  <div className="space-y-2">
                    {avertissements.map((a, i) => (
                      <div key={i} className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        <span>{a}</span>
                      </div>
                    ))}
                  </div>
                )}

                {avertissements.length === 0 && (
                  <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-xs text-green-700">
                    <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                    Paramétrage cohérent
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Pied */}
        <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <button onClick={onFermer} className="btn-secondaire">Annuler</button>
          <button onClick={enregistrer} disabled={enregistrement} className="btn-primaire">
            {enregistrement ? (
              <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />Enregistrement…</>
            ) : (
              <><Save className="h-4 w-4" />Enregistrer</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function AccordeonSection({
  titre, ouverte, onToggle, children,
}: { titre: string; ouverte: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="border-b border-slate-100">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between py-3 text-left"
      >
        <span className="text-sm font-semibold text-slate-800">{titre}</span>
        {ouverte ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
      </button>
      {ouverte && <div className="pb-4 space-y-0">{children}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page principale
// ---------------------------------------------------------------------------

export default function PageAdminDHMO() {
  const [profils, setProfils] = useState<ProfilDHMO[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  const [modalProfil, setModalProfil] = useState<ProfilDHMO | null | "nouveau">(null);

  const charger = () => {
    setChargement(true);
    api.get<ProfilDHMO[] | { results: ProfilDHMO[] }>("/api/economie/profils-main-oeuvre/")
      .then((data) => setProfils(extraireListeResultats(data)))
      .catch(() => setErreur("Impossible de charger les profils DHMO."))
      .finally(() => setChargement(false));
  };

  useEffect(() => { charger(); }, []);

  const supprimerProfil = async (p: ProfilDHMO) => {
    if (!window.confirm(`Supprimer le profil "${p.libelle}" ?`)) return;
    setErreur(null);
    try {
      await api.supprimer(`/api/economie/profils-main-oeuvre/${p.id}/`);
      setSucces(`Profil ${p.libelle} supprimé.`);
      charger();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Suppression impossible.");
    }
  };

  return (
    <div className="space-y-6">
      <EntetePageAdmin
        titre="DHMO — Déboursé Horaire MO"
        description="Paramétrez les taux horaires de main-d'œuvre par type d'ouvrier BTP, utilisés dans la bibliothèque de prix et les études."
        statistiques={[
          { libelle: "Profils définis", valeur: profils.length },
          { libelle: "Actifs", valeur: profils.filter((p) => p.est_actif).length },
          {
            libelle: "DHMO moyen",
            valeur: profils.filter((p) => p.taux_horaire_recommande_defaut).length > 0
              ? `${fmt(profils.filter((p) => p.taux_horaire_recommande_defaut)
                  .reduce((s, p) => s + (p.taux_horaire_recommande_defaut ?? 0), 0) /
                profils.filter((p) => p.taux_horaire_recommande_defaut).length)} €/h`
              : "—",
          },
        ]}
        actions={(
          <button onClick={() => setModalProfil("nouveau")} className="btn-primaire">
            <Plus className="h-4 w-4" />
            Nouveau profil
          </button>
        )}
      />

      {succes && <AlerteAdmin type="succes">{succes}</AlerteAdmin>}
      {erreur && <AlerteAdmin type="erreur">{erreur}</AlerteAdmin>}

      {/* Info DHMO */}
      <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <div>
          <p className="font-medium">Comment fonctionne le DHMO ?</p>
          <p className="mt-1 text-xs text-blue-600 leading-relaxed">
            Le déboursé horaire de main-d&apos;œuvre est calculé à partir du coût complet mensuel (brut + charges + compléments + structure)
            divisé par les heures productives annuelles (hors absentéisme et temps improductif).
            Les valeurs définies ici alimentent automatiquement les lignes de prix de la bibliothèque.
          </p>
        </div>
      </div>

      {/* Liste */}
      <CarteSectionAdmin titre={`${profils.length} profil${profils.length > 1 ? "s" : ""} DHMO`}>
        {chargement ? (
          <div className="py-12 text-center text-sm text-slate-400">Chargement…</div>
        ) : profils.length === 0 ? (
          <div className="py-12 text-center">
            <HardHat className="h-8 w-8 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500">Aucun profil DHMO défini.</p>
            <p className="text-xs text-slate-400 mt-1">Commencez par créer un profil pour chaque type d&apos;ouvrier.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="py-3 pr-4 text-left text-xs font-semibold text-slate-500">Profil</th>
                  <th className="py-3 pr-4 text-left text-xs font-semibold text-slate-500 hidden sm:table-cell">Catégorie</th>
                  <th className="py-3 pr-4 text-right text-xs font-semibold text-slate-500">Brut/mois</th>
                  <th className="py-3 pr-4 text-right text-xs font-semibold text-slate-500 hidden md:table-cell">HS 25%</th>
                  <th className="py-3 pr-4 text-right text-xs font-semibold text-slate-500 hidden md:table-cell">HS 50%</th>
                  <th className="py-3 pr-4 text-right text-xs font-semibold text-primaire-600">DHMO (€/h)</th>
                  <th className="py-3 text-right text-xs font-semibold text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {profils
                  .sort((a, b) => a.ordre_affichage - b.ordre_affichage || a.libelle.localeCompare(b.libelle))
                  .map((p) => (
                    <tr key={p.id} className={`border-b border-slate-50 transition-colors hover:bg-slate-50 ${!p.est_actif ? "opacity-50" : ""}`}>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold text-slate-600">{p.code}</span>
                          <span className="font-medium text-slate-800">{p.libelle}</span>
                        </div>
                        {p.metier && <p className="text-xs text-slate-400">{p.metier}{p.niveau_classification ? ` — ${p.niveau_classification}` : ""}</p>}
                      </td>
                      <td className="py-3 pr-4 text-xs text-slate-500 hidden sm:table-cell">{p.categorie_libelle}</td>
                      <td className="py-3 pr-4 text-right text-xs text-slate-600">{fmt(p.salaire_brut_mensuel_defaut)} €</td>
                      <td className="py-3 pr-4 text-right text-xs text-slate-400 hidden md:table-cell">
                        {p.nb_heures_supp_25_mensuelles > 0 ? `${fmt(p.nb_heures_supp_25_mensuelles, 1)} h` : "—"}
                      </td>
                      <td className="py-3 pr-4 text-right text-xs text-slate-400 hidden md:table-cell">
                        {p.nb_heures_supp_50_mensuelles > 0 ? `${fmt(p.nb_heures_supp_50_mensuelles, 1)} h` : "—"}
                      </td>
                      <td className="py-3 pr-4 text-right">
                        <span className="font-bold text-primaire-700">
                          {p.taux_horaire_recommande_defaut != null ? `${fmt(p.taux_horaire_recommande_defaut)} €` : "—"}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => setModalProfil(p)}
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-100"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Modifier
                          </button>
                          <button
                            onClick={() => supprimerProfil(p)}
                            className="inline-flex items-center rounded-lg px-2 py-1.5 text-xs text-slate-400 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </CarteSectionAdmin>

      {/* Modal */}
      {modalProfil && (
        <ModalFormulaire
          profil={modalProfil === "nouveau" ? null : modalProfil}
          onFermer={() => setModalProfil(null)}
          onEnregistre={() => {
            setModalProfil(null);
            setSucces("Profil DHMO enregistré.");
            charger();
          }}
        />
      )}
    </div>
  );
}
