"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Bot,
  CheckCircle2,
  ChevronRight,
  Database,
  FileJson,
  FlaskConical,
  History,
  Loader2,
  Plus,
  Save,
  Search,
  Settings2,
  Sparkles,
  X,
} from "lucide-react";
import { api, ErreurApi, extraireListeResultats } from "@/crochets/useApi";

type Fournisseur = "openai" | "autre";

interface ConfigurationIA {
  id: string;
  code: string;
  libelle: string;
  module: string;
  module_libelle?: string;
  fournisseur: Fournisseur;
  modele: string;
  modele_fallback: string;
  temperature: string;
  top_p: string;
  max_tokens: number;
  prompt_systeme: string;
  prompt_controle: string;
  prompt_correction: string;
  prompt_normalisation: string;
  prompt_classification: string;
  prompt_generation: string;
  schema_sortie: Record<string, unknown>;
  exemple_sortie_attendue: Record<string, unknown>;
  options_metier: Record<string, unknown>;
  seuil_confiance: string;
  seuil_validation_automatique: string;
  activer_correction_texte: boolean;
  activer_normalisation: boolean;
  activer_classification: boolean;
  activer_rapprochement: boolean;
  activer_generation: boolean;
  activer_validation_auto: boolean;
  validation_humaine_obligatoire: boolean;
  mode_simulation_autorise: boolean;
  mode_reel_autorise: boolean;
  cout_max_par_traitement: string;
  est_actif: boolean;
}

interface TraitementIA {
  id: string;
  module: string;
  configuration?: string;
  configuration_libelle?: string;
  statut: string;
  mode_execution: string;
  modele_utilise: string;
  sortie: Record<string, unknown>;
  erreur: string;
  cout_estime?: string;
  cout_reel?: string;
  duree_ms?: number;
  tokens_entree?: number;
  tokens_sortie?: number;
  date_creation: string;
}

interface SyntheseModule {
  module: string;
  libelle: string;
  configurations: number;
  configurations_actives: number;
  dernier_traitement?: TraitementIA | null;
  erreurs: number;
  cout_estime: string | number;
  cout_reel: string | number;
}

interface ModeleDisponible {
  id: string;
  proprietaire?: string;
  date_creation?: number;
}

interface PresetIA {
  code: string;
  libelle: string;
  module: string;
  prompt_systeme: string;
  prompt_controle: string;
  schema_sortie: Record<string, unknown>;
  options_metier: Record<string, unknown>;
}

const MODULES = [
  ["ressources_devis", "Analyse des devis / BPU / DPGF / DQE"],
  ["ressources_prix_marche", "Prix marché"],
  ["ressources_estimations", "Estimations & ratios"],
  ["bibliotheque_prix", "Bibliothèque de prix"],
  ["bibliotheque_cctp", "CCTP / pièces écrites"],
  ["pieces_ecrites", "Pièces écrites"],
];

const ONGLETS = ["Général", "Comportement", "Prompts", "Schéma", "Options", "Test", "Journaux"] as const;

const OPTIONS_PAR_MODULE: Record<string, Array<[string, string]>> = {
  ressources_devis: [
    ["correction_libelles", "Correction des libellés"],
    ["normalisation_unites", "Normalisation des unités"],
    ["classification_corps_etat", "Classification corps d’état"],
    ["rapprochement_bibliotheque", "Rapprochement bibliothèque"],
    ["detection_doublons", "Détection doublons"],
    ["detection_prix_incoherents", "Détection prix incohérents"],
    ["proposition_capitalisation", "Proposition de capitalisation"],
    ["validation_humaine_obligatoire", "Validation humaine obligatoire"],
  ],
  ressources_prix_marche: [
    ["normalisation", "Normalisation"],
    ["fusion_doublons", "Fusion doublons après validation"],
    ["rapprochement_prix_similaires", "Rapprochement prix similaires"],
    ["enrichissement_description", "Enrichissement description"],
    ["detection_prix_atypiques", "Détection prix atypiques"],
    ["classification_corps_etat", "Classification corps d’état"],
  ],
  ressources_estimations: [
    ["generation_ratios", "Génération de ratios"],
    ["scenarios_budgetaires", "Scénarios budgétaires"],
    ["note_hypotheses", "Note d’hypothèses"],
    ["controle_coherence", "Contrôle de cohérence"],
    ["comparaison_prix_marche", "Comparaison prix marché"],
  ],
  bibliotheque_cctp: [
    ["generation_descriptif", "Génération descriptif"],
    ["cahier_des_charges", "Cahier des charges"],
    ["exigences_mise_en_oeuvre", "Exigences de mise en œuvre"],
    ["controles_attendus", "Contrôles attendus"],
    ["limites_prestation", "Limites de prestation"],
    ["variantes", "Variantes"],
    ["dechets", "Déchets"],
    ["normes_references", "Normes / références"],
    ["statut_a_verifier_obligatoire", "Statut à vérifier obligatoire"],
  ],
  bibliotheque_prix: [
    ["recherche_semantique", "Recherche sémantique"],
    ["similarite", "Similarité"],
    ["suggestions", "Suggestions"],
    ["decomposition", "Décomposition de prix"],
  ],
};

function configurationVide(): Partial<ConfigurationIA> {
  return {
    code: "",
    libelle: "",
    module: "ressources_devis",
    fournisseur: "openai",
    modele: "",
    modele_fallback: "",
    temperature: "0.20",
    top_p: "1.00",
    max_tokens: 2500,
    prompt_systeme: "",
    prompt_controle: "",
    prompt_correction: "",
    prompt_normalisation: "",
    prompt_classification: "",
    prompt_generation: "",
    schema_sortie: {},
    exemple_sortie_attendue: {},
    options_metier: {},
    seuil_confiance: "0.75",
    seuil_validation_automatique: "0.92",
    activer_correction_texte: true,
    activer_normalisation: true,
    activer_classification: true,
    activer_rapprochement: true,
    activer_generation: false,
    activer_validation_auto: false,
    validation_humaine_obligatoire: true,
    mode_simulation_autorise: true,
    mode_reel_autorise: false,
    cout_max_par_traitement: "0.0000",
    est_actif: true,
  };
}

function detailErreur(e: unknown, secours: string) {
  return e instanceof ErreurApi ? e.detail : secours;
}

function jsonLisible(valeur: unknown) {
  return JSON.stringify(valeur || {}, null, 2);
}

function BadgeStatut({ actif }: { actif: boolean }) {
  return <span className={actif ? "badge-succes" : "badge-neutre"}>{actif ? "Actif" : "Inactif"}</span>;
}

function DrawerResultatTestIA({ traitement, onFermer }: { traitement: TraitementIA; onFermer: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex justify-end bg-black/50">
      <aside className="h-full w-full max-w-xl overflow-y-auto p-6 shadow-2xl" style={{ background: "var(--fond-carte)", color: "var(--texte)" }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2>Résultat du test</h2>
            <p className="text-sm" style={{ color: "var(--texte-2)" }}>{traitement.mode_execution || "mode non précisé"} · {traitement.statut}</p>
          </div>
          <button className="btn-secondaire text-xs" onClick={onFermer}><X className="h-4 w-4" /></button>
        </div>
        <div className="mt-5 grid gap-3 text-sm">
          <div className="carte">
            <p className="font-semibold">Modèle utilisé</p>
            <p style={{ color: "var(--texte-2)" }}>{traitement.modele_utilise || "Non renseigné"}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="carte"><p className="text-xs">Durée</p><p>{traitement.duree_ms ?? "—"} ms</p></div>
            <div className="carte"><p className="text-xs">Tokens entrée</p><p>{traitement.tokens_entree ?? "—"}</p></div>
            <div className="carte"><p className="text-xs">Tokens sortie</p><p>{traitement.tokens_sortie ?? "—"}</p></div>
          </div>
          {traitement.erreur && <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-500">{traitement.erreur}</div>}
          <pre className="max-h-[520px] overflow-auto rounded-xl border p-4 text-xs" style={{ borderColor: "var(--bordure)", background: "var(--fond)" }}>{jsonLisible(traitement.sortie)}</pre>
        </div>
      </aside>
    </div>
  );
}

function ModalConfigurationIAAvancee({
  configuration,
  presets,
  onFermer,
  onEnregistre,
}: {
  configuration: Partial<ConfigurationIA>;
  presets: PresetIA[];
  onFermer: () => void;
  onEnregistre: () => void;
}) {
  const [form, setForm] = useState<Partial<ConfigurationIA>>(configuration);
  const [onglet, setOnglet] = useState<(typeof ONGLETS)[number]>("Général");
  const [erreur, setErreur] = useState<string | null>(null);
  const [modeles, setModeles] = useState<ModeleDisponible[]>([]);
  const [chargementModeles, setChargementModeles] = useState(false);
  const [schemaTexte, setSchemaTexte] = useState(jsonLisible(configuration.schema_sortie));
  const [exempleTexte, setExempleTexte] = useState(jsonLisible(configuration.exemple_sortie_attendue));
  const [promptTest, setPromptTest] = useState(configuration.prompt_controle || "");
  const [jeuTest, setJeuTest] = useState('{"designation":"Fourniture et pose d’un ouvrage type","unite":"u","quantite":1}');
  const [traitements, setTraitements] = useState<TraitementIA[]>([]);
  const [resultatTest, setResultatTest] = useState<TraitementIA | null>(null);
  const [testEnCours, setTestEnCours] = useState(false);

  useEffect(() => {
    if (!form.id || onglet !== "Journaux") return;
    api.get<TraitementIA[]>(`/api/administration/ia/journaux/?configuration=${form.id}`)
      .then((data) => setTraitements(extraireListeResultats(data)))
      .catch(() => setTraitements([]));
  }, [form.id, onglet]);

  const modifier = (patch: Partial<ConfigurationIA>) => setForm((precedent) => ({ ...precedent, ...patch }));

  const recupererModeles = async () => {
    setErreur(null);
    setChargementModeles(true);
    try {
      const reponse = await api.get<{ modeles: ModeleDisponible[]; detail?: string }>(`/api/administration/ia/modeles-disponibles/?fournisseur=${form.fournisseur || "openai"}`);
      setModeles(reponse.modeles || []);
    } catch (e) {
      setModeles([]);
      setErreur(detailErreur(e, "Récupération des modèles impossible."));
    } finally {
      setChargementModeles(false);
    }
  };

  const appliquerPreset = (code: string) => {
    const preset = presets.find((item) => item.code === code);
    if (!preset) return;
    modifier({
      libelle: form.libelle || preset.libelle,
      code: form.code || preset.code.toUpperCase(),
      module: preset.module,
      prompt_systeme: preset.prompt_systeme,
      prompt_controle: preset.prompt_controle,
      schema_sortie: preset.schema_sortie,
      options_metier: preset.options_metier,
      validation_humaine_obligatoire: true,
    });
    setSchemaTexte(jsonLisible(preset.schema_sortie));
  };

  const chargerSchemaDefaut = () => {
    const preset = presets.find((item) => item.module === form.module);
    if (preset) {
      modifier({ schema_sortie: preset.schema_sortie, options_metier: { ...(form.options_metier || {}), ...preset.options_metier } });
      setSchemaTexte(jsonLisible(preset.schema_sortie));
    }
  };

  const enregistrer = async () => {
    setErreur(null);
    let schema: Record<string, unknown>;
    let exemple: Record<string, unknown>;
    try {
      schema = JSON.parse(schemaTexte || "{}");
      exemple = JSON.parse(exempleTexte || "{}");
    } catch {
      setErreur("Le schéma ou l’exemple de sortie n’est pas un JSON valide.");
      return;
    }
    const payload = { ...form, schema_sortie: schema, exemple_sortie_attendue: exemple };
    try {
      if (form.id) {
        await api.patch(`/api/administration/ia/configurations/${form.id}/`, payload);
      } else {
        await api.post("/api/administration/ia/configurations/", payload);
      }
      onEnregistre();
    } catch (e) {
      setErreur(detailErreur(e, "Enregistrement impossible."));
    }
  };

  const tester = async (mode: "simulation" | "reel") => {
    if (!form.id) {
      setErreur("Enregistrez la configuration avant de lancer un test.");
      return;
    }
    setErreur(null);
    setTestEnCours(true);
    try {
      let jeu_donnees = {};
      try {
        jeu_donnees = JSON.parse(jeuTest || "{}");
      } catch {
        setErreur("Le jeu de données de test n’est pas un JSON valide.");
        return;
      }
      const reponse = await api.post<{ detail: string; traitement: TraitementIA }>(
        `/api/administration/ia/configurations/${form.id}/tester/`,
        { mode, prompt_test: promptTest, jeu_donnees },
      );
      setResultatTest(reponse.traitement);
    } catch (e) {
      setErreur(detailErreur(e, "Test impossible."));
    } finally {
      setTestEnCours(false);
    }
  };

  const optionsModule = OPTIONS_PAR_MODULE[form.module || "ressources_devis"] || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
      <div className="flex max-h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl shadow-2xl" style={{ background: "var(--fond-carte)", color: "var(--texte)" }}>
        <div className="flex items-start justify-between gap-4 border-b p-5" style={{ borderColor: "var(--bordure)" }}>
          <div>
            <h2>Configuration avancée</h2>
            <p className="text-sm" style={{ color: "var(--texte-2)" }}>Paramétrage serveur, prompts, schémas, tests et journaux.</p>
          </div>
          <button className="btn-secondaire text-xs" onClick={onFermer}><X className="h-4 w-4" /></button>
        </div>

        <div className="flex flex-wrap gap-2 border-b p-3" style={{ borderColor: "var(--bordure)" }}>
          {ONGLETS.map((item) => (
            <button key={item} className={onglet === item ? "btn-primaire text-xs" : "btn-secondaire text-xs"} onClick={() => setOnglet(item)}>
              {item}
            </button>
          ))}
        </div>

        {erreur && <div className="mx-5 mt-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-500">{erreur}</div>}

        <div className="flex-1 overflow-y-auto p-5">
          {onglet === "Général" && (
            <div className="grid gap-4 lg:grid-cols-2">
              <input className="champ-saisie" placeholder="Code" value={form.code || ""} onChange={(e) => modifier({ code: e.target.value })} />
              <input className="champ-saisie" placeholder="Libellé" value={form.libelle || ""} onChange={(e) => modifier({ libelle: e.target.value })} />
              <select className="champ-saisie" value={form.module} onChange={(e) => modifier({ module: e.target.value })}>
                {MODULES.map(([code, libelle]) => <option key={code} value={code}>{libelle}</option>)}
              </select>
              <select className="champ-saisie" value={form.fournisseur} onChange={(e) => modifier({ fournisseur: e.target.value as Fournisseur })}>
                <option value="openai">Fournisseur configuré OpenAI</option>
                <option value="autre">Autre fournisseur</option>
              </select>
              <div className="lg:col-span-2 rounded-xl border p-4" style={{ borderColor: "var(--bordure)" }}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-semibold">Modèles disponibles</p>
                  <button className="btn-secondaire text-xs" onClick={recupererModeles} disabled={chargementModeles}>
                    {chargementModeles ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
                    Récupérer les modèles disponibles
                  </button>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <input className="champ-saisie" placeholder="Modèle principal, saisissable manuellement" value={form.modele || ""} onChange={(e) => modifier({ modele: e.target.value })} list="modeles-disponibles" />
                  <input className="champ-saisie" placeholder="Modèle de secours" value={form.modele_fallback || ""} onChange={(e) => modifier({ modele_fallback: e.target.value })} list="modeles-disponibles" />
                  <datalist id="modeles-disponibles">
                    {modeles.map((modele) => <option key={modele.id} value={modele.id} />)}
                  </datalist>
                </div>
                {modeles.length > 0 && (
                  <div className="mt-3 flex max-h-36 flex-wrap gap-2 overflow-auto">
                    {modeles.map((modele) => (
                      <button key={modele.id} className="btn-secondaire text-xs" onClick={() => modifier({ modele: modele.id })}>{modele.id}</button>
                    ))}
                  </div>
                )}
              </div>
              <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={Boolean(form.est_actif)} onChange={(e) => modifier({ est_actif: e.target.checked })} />Configuration active</label>
              <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={Boolean(form.validation_humaine_obligatoire)} onChange={(e) => modifier({ validation_humaine_obligatoire: e.target.checked })} />Validation humaine obligatoire</label>
              <div className="lg:col-span-2 rounded-xl border p-4" style={{ borderColor: "var(--bordure)" }}>
                <label className="text-sm font-semibold">Créer depuis un modèle</label>
                <div className="mt-3 flex flex-wrap gap-2">
                  {presets.map((preset) => (
                    <button key={preset.code} className="btn-secondaire text-xs" onClick={() => appliquerPreset(preset.code)}>
                      <Sparkles className="h-3.5 w-3.5" />{preset.libelle}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {onglet === "Comportement" && (
            <div className="grid gap-4 md:grid-cols-3">
              <input className="champ-saisie" type="number" step="0.01" placeholder="Température" value={form.temperature || ""} onChange={(e) => modifier({ temperature: e.target.value })} />
              <input className="champ-saisie" type="number" step="0.01" placeholder="Top P" value={form.top_p || ""} onChange={(e) => modifier({ top_p: e.target.value })} />
              <input className="champ-saisie" type="number" placeholder="Max tokens" value={form.max_tokens || 0} onChange={(e) => modifier({ max_tokens: Number(e.target.value) })} />
              <input className="champ-saisie" type="number" step="0.01" placeholder="Seuil confiance" value={form.seuil_confiance || ""} onChange={(e) => modifier({ seuil_confiance: e.target.value })} />
              <input className="champ-saisie" type="number" step="0.01" placeholder="Seuil validation automatique" value={form.seuil_validation_automatique || ""} onChange={(e) => modifier({ seuil_validation_automatique: e.target.value })} />
              <input className="champ-saisie" type="number" step="0.0001" placeholder="Coût maximal par traitement" value={form.cout_max_par_traitement || ""} onChange={(e) => modifier({ cout_max_par_traitement: e.target.value })} />
              {[
                ["mode_simulation_autorise", "Mode simulation autorisé"],
                ["mode_reel_autorise", "Mode réel autorisé"],
                ["activer_validation_auto", "Validation automatique autorisée"],
              ].map(([champ, libelle]) => (
                <label key={champ} className="flex items-center gap-3 text-sm"><input type="checkbox" checked={Boolean(form[champ as keyof ConfigurationIA])} onChange={(e) => modifier({ [champ]: e.target.checked } as Partial<ConfigurationIA>)} />{libelle}</label>
              ))}
            </div>
          )}

          {onglet === "Prompts" && (
            <div className="grid gap-4">
              {[
                ["prompt_systeme", "Prompt système"],
                ["prompt_controle", "Prompt de contrôle"],
                ["prompt_correction", "Prompt de correction"],
                ["prompt_normalisation", "Prompt de normalisation"],
                ["prompt_classification", "Prompt de classification"],
                ["prompt_generation", "Prompt de génération"],
              ].map(([champ, libelle]) => (
                <label key={champ} className="grid gap-2">
                  <span className="text-sm font-semibold">{libelle}</span>
                  <textarea className="champ-saisie min-h-28" value={String(form[champ as keyof ConfigurationIA] || "")} onChange={(e) => modifier({ [champ]: e.target.value } as Partial<ConfigurationIA>)} />
                </label>
              ))}
              <div className="rounded-xl border p-4 text-sm" style={{ borderColor: "var(--bordure)", color: "var(--texte-2)" }}>
                Variables disponibles : <code>{"{{designation}}"}</code>, <code>{"{{unite}}"}</code>, <code>{"{{corps_etat}}"}</code>, <code>{"{{prix_unitaire}}"}</code>, <code>{"{{references_internes}}"}</code>.
              </div>
            </div>
          )}

          {onglet === "Schéma" && (
            <div className="grid gap-4 lg:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-semibold">Schéma de sortie JSON</span>
                <textarea className="champ-saisie min-h-[420px] font-mono text-xs" value={schemaTexte} onChange={(e) => setSchemaTexte(e.target.value)} />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-semibold">Exemple de sortie attendue</span>
                <textarea className="champ-saisie min-h-[420px] font-mono text-xs" value={exempleTexte} onChange={(e) => setExempleTexte(e.target.value)} />
              </label>
              <button className="btn-secondaire w-fit text-xs" onClick={chargerSchemaDefaut}><FileJson className="h-4 w-4" />Charger un modèle de schéma par défaut</button>
            </div>
          )}

          {onglet === "Options" && (
            <div className="grid gap-4 md:grid-cols-2">
              {optionsModule.map(([code, libelle]) => (
                <label key={code} className="flex items-center justify-between gap-3 rounded-xl border p-4 text-sm" style={{ borderColor: "var(--bordure)" }}>
                  <span>{libelle}</span>
                  <input
                    type="checkbox"
                    checked={Boolean((form.options_metier || {})[code])}
                    onChange={(e) => modifier({ options_metier: { ...(form.options_metier || {}), [code]: e.target.checked } })}
                  />
                </label>
              ))}
              {form.module === "ressources_devis" && (
                <input className="champ-saisie" type="number" step="0.01" placeholder="Seuil capitalisation" value={String((form.options_metier || {}).seuil_capitalisation || "")} onChange={(e) => modifier({ options_metier: { ...(form.options_metier || {}), seuil_capitalisation: Number(e.target.value) } })} />
              )}
            </div>
          )}

          {onglet === "Test" && (
            <div className="grid gap-4 lg:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-semibold">Prompt de test</span>
                <textarea className="champ-saisie min-h-60" value={promptTest} onChange={(e) => setPromptTest(e.target.value)} />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-semibold">Jeu de données test JSON</span>
                <textarea className="champ-saisie min-h-60 font-mono text-xs" value={jeuTest} onChange={(e) => setJeuTest(e.target.value)} />
              </label>
              <div className="flex flex-wrap gap-2">
                <button className="btn-secondaire" onClick={() => tester("simulation")} disabled={testEnCours}>{testEnCours ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}Tester en simulation</button>
                <button className="btn-primaire" onClick={() => tester("reel")} disabled={testEnCours}>{testEnCours ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}Tester réellement</button>
              </div>
            </div>
          )}

          {onglet === "Journaux" && (
            <div className="space-y-3">
              {traitements.map((traitement) => (
                <button key={traitement.id} className="carte flex w-full items-center justify-between gap-3 text-left" onClick={() => setResultatTest(traitement)}>
                  <div>
                    <p className="font-semibold">{traitement.statut} · {traitement.mode_execution || "mode non précisé"}</p>
                    <p className="text-xs" style={{ color: "var(--texte-2)" }}>{new Date(traitement.date_creation).toLocaleString("fr-FR")} · {traitement.modele_utilise || "modèle non renseigné"}</p>
                    {traitement.erreur && <p className="mt-1 text-xs text-red-500">{traitement.erreur}</p>}
                  </div>
                  <ChevronRight className="h-4 w-4" />
                </button>
              ))}
              {traitements.length === 0 && <div className="carte text-sm" style={{ color: "var(--texte-2)" }}>Aucun journal lié à cette configuration.</div>}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t p-4" style={{ borderColor: "var(--bordure)" }}>
          <button className="btn-secondaire" onClick={onFermer}>Annuler</button>
          <button className="btn-primaire" onClick={enregistrer}><Save className="h-4 w-4" />Enregistrer</button>
        </div>
      </div>
      {resultatTest && <DrawerResultatTestIA traitement={resultatTest} onFermer={() => setResultatTest(null)} />}
    </div>
  );
}

export default function PageParametrageIA() {
  const [configurations, setConfigurations] = useState<ConfigurationIA[]>([]);
  const [synthese, setSynthese] = useState<SyntheseModule[]>([]);
  const [journaux, setJournaux] = useState<TraitementIA[]>([]);
  const [couts, setCouts] = useState<{ couts: Array<Record<string, unknown>>; total_estime: string; total_reel: string } | null>(null);
  const [presets, setPresets] = useState<PresetIA[]>([]);
  const [edition, setEdition] = useState<Partial<ConfigurationIA> | null>(null);
  const [journalDetail, setJournalDetail] = useState<TraitementIA | null>(null);
  const [moduleFiltre, setModuleFiltre] = useState("");
  const [etatFiltre, setEtatFiltre] = useState("");
  const [recherche, setRecherche] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(() => {
    setErreur(null);
    const params = new URLSearchParams();
    if (moduleFiltre) params.set("module", moduleFiltre);
    if (etatFiltre === "actif") params.set("actif", "1");
    if (etatFiltre === "erreurs") params.set("erreurs", "1");
    Promise.all([
      api.get<ConfigurationIA[]>(`/api/administration/ia/configurations/?${params.toString()}`),
      api.get<{ modules: SyntheseModule[] }>("/api/administration/ia/synthese/"),
      api.get<TraitementIA[]>("/api/administration/ia/journaux/"),
      api.get<{ couts: Array<Record<string, unknown>>; total_estime: string; total_reel: string }>("/api/administration/ia/couts/"),
      api.get<{ presets: PresetIA[] }>("/api/administration/ia/presets/"),
    ])
      .then(([configs, stats, logs, coutsIa, presetsIa]) => {
        setConfigurations(extraireListeResultats(configs));
        setSynthese(stats.modules || []);
        setJournaux(extraireListeResultats(logs).slice(0, 12));
        setCouts(coutsIa);
        setPresets(presetsIa.presets || []);
      })
      .catch((e) => setErreur(detailErreur(e, "Chargement de l’administration impossible.")));
  }, [moduleFiltre, etatFiltre]);

  useEffect(() => { charger(); }, [charger]);

  const configsFiltrees = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    if (!q) return configurations;
    return configurations.filter((config) => [config.code, config.libelle, config.modele, config.module_libelle, config.module].some((valeur) => String(valeur || "").toLowerCase().includes(q)));
  }, [configurations, recherche]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1>Intelligence artificielle métier</h1>
          <p className="text-sm" style={{ color: "var(--texte-2)" }}>Centre de pilotage des modèles, prompts, schémas, tests, journaux et coûts.</p>
        </div>
        <button className="btn-primaire" onClick={() => setEdition(configurationVide())}><Plus className="h-4 w-4" />Nouvelle configuration</button>
      </div>

      {erreur && <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-500">{erreur}</div>}

      <div className="grid gap-4 xl:grid-cols-3">
        {synthese.map((module) => (
          <div key={module.module} className="carte space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{module.libelle}</p>
                <p className="text-xs" style={{ color: "var(--texte-2)" }}>{module.configurations_actives} active(s) / {module.configurations} configuration(s)</p>
              </div>
              {module.erreurs > 0 ? <AlertTriangle className="h-5 w-5 text-red-500" /> : <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg border p-3" style={{ borderColor: "var(--bordure)" }}>Erreurs<br /><strong>{module.erreurs}</strong></div>
              <div className="rounded-lg border p-3" style={{ borderColor: "var(--bordure)" }}>Coût estimé<br /><strong>{String(module.cout_estime || 0)}</strong></div>
            </div>
            <button className="btn-secondaire w-full text-xs" onClick={() => setModuleFiltre(module.module)}><Settings2 className="h-4 w-4" />Configurer</button>
          </div>
        ))}
      </div>

      <div className="carte flex flex-wrap items-center gap-3">
        <div className="relative min-w-64 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--texte-2)" }} />
          <input className="champ-saisie w-full pl-10" placeholder="Rechercher une configuration" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
        </div>
        <select className="champ-saisie" value={moduleFiltre} onChange={(e) => setModuleFiltre(e.target.value)}>
          <option value="">Tous les modules</option>
          {MODULES.map(([code, libelle]) => <option key={code} value={code}>{libelle}</option>)}
        </select>
        <select className="champ-saisie" value={etatFiltre} onChange={(e) => setEtatFiltre(e.target.value)}>
          <option value="">Tous les états</option>
          <option value="actif">Actifs</option>
          <option value="erreurs">Avec erreurs</option>
        </select>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {configsFiltrees.map((configuration) => (
          <div key={configuration.id} className="carte space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{configuration.libelle}</p>
                <p className="text-xs" style={{ color: "var(--texte-2)" }}>{configuration.module_libelle || configuration.module} · {configuration.modele || "Modèle non renseigné"}</p>
              </div>
              <BadgeStatut actif={configuration.est_actif} />
            </div>
            <div className="grid gap-2 text-xs sm:grid-cols-3" style={{ color: "var(--texte-2)" }}>
              <span>Simulation : {configuration.mode_simulation_autorise ? "oui" : "non"}</span>
              <span>Réel : {configuration.mode_reel_autorise ? "oui" : "non"}</span>
              <span>Validation humaine : {configuration.validation_humaine_obligatoire ? "oui" : "non"}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="btn-secondaire text-xs" onClick={() => setEdition(configuration)}><Bot className="h-3.5 w-3.5" />Configurer</button>
              <button className="btn-secondaire text-xs" onClick={() => { setEdition(configuration); }}><FlaskConical className="h-3.5 w-3.5" />Tester</button>
              <button className="btn-secondaire text-xs" onClick={() => setModuleFiltre(configuration.module)}><History className="h-3.5 w-3.5" />Journaux</button>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <div className="carte">
          <div className="mb-4 flex items-center gap-2"><History className="h-5 w-5" /><h2>Derniers journaux</h2></div>
          <div className="space-y-2">
            {journaux.map((journal) => (
              <button key={journal.id} className="flex w-full items-center justify-between rounded-xl border p-3 text-left text-sm" style={{ borderColor: "var(--bordure)" }} onClick={() => setJournalDetail(journal)}>
                <span>{journal.configuration_libelle || journal.module}<br /><small style={{ color: "var(--texte-2)" }}>{journal.statut} · {journal.mode_execution || "mode non précisé"}</small></span>
                <ChevronRight className="h-4 w-4" />
              </button>
            ))}
          </div>
        </div>
        <div className="carte">
          <div className="mb-4 flex items-center gap-2"><BarChart3 className="h-5 w-5" /><h2>Coûts</h2></div>
          <p className="text-sm" style={{ color: "var(--texte-2)" }}>Total estimé : {String(couts?.total_estime || 0)}</p>
          <p className="text-sm" style={{ color: "var(--texte-2)" }}>Total réel : {String(couts?.total_reel || 0)}</p>
          <div className="mt-4 space-y-2">
            {(couts?.couts || []).map((ligne) => (
              <div key={String(ligne.module)} className="rounded-xl border p-3 text-sm" style={{ borderColor: "var(--bordure)" }}>
                <strong>{String(ligne.module)}</strong><br />
                <span style={{ color: "var(--texte-2)" }}>Estimé : {String(ligne.cout_estime_total || 0)} · Réel : {String(ligne.cout_reel_total || 0)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {edition && <ModalConfigurationIAAvancee configuration={edition} presets={presets} onFermer={() => setEdition(null)} onEnregistre={() => { setEdition(null); charger(); }} />}
      {journalDetail && <DrawerResultatTestIA traitement={journalDetail} onFermer={() => setJournalDetail(null)} />}
    </div>
  );
}
