"use client";

import { useEffect, useState } from "react";
import { Bot, FlaskConical, Plus, Save, X } from "lucide-react";
import { api, ErreurApi, extraireListeResultats } from "@/crochets/useApi";

interface ConfigurationIA {
  id: string;
  code: string;
  libelle: string;
  module: string;
  module_libelle?: string;
  fournisseur: "openai" | "autre";
  modele: string;
  modele_fallback: string;
  temperature: string;
  max_tokens: number;
  prompt_systeme: string;
  prompt_controle: string;
  seuil_confiance: string;
  validation_humaine_obligatoire: boolean;
  est_actif: boolean;
}

const MODULES = [
  ["ressources_devis", "Analyse des devis / BPU / DPGF / DQE"],
  ["ressources_prix_marche", "Prix marché"],
  ["ressources_estimations", "Estimations & ratios"],
  ["bibliotheque_prix", "Bibliothèque de prix"],
  ["bibliotheque_cctp", "CCTP / pièces écrites"],
  ["pieces_ecrites", "Pièces écrites"],
];

function configurationVide(): Partial<ConfigurationIA> {
  return {
    code: "",
    libelle: "",
    module: "ressources_devis",
    fournisseur: "openai",
    modele: "gpt-5.1",
    modele_fallback: "",
    temperature: "0.20",
    max_tokens: 2500,
    prompt_systeme: "",
    prompt_controle: "",
    seuil_confiance: "0.75",
    validation_humaine_obligatoire: true,
    est_actif: true,
  };
}

function ModalConfigurationIA({
  configuration,
  onFermer,
  onEnregistre,
}: {
  configuration: Partial<ConfigurationIA>;
  onFermer: () => void;
  onEnregistre: () => void;
}) {
  const [form, setForm] = useState<Partial<ConfigurationIA>>(configuration);
  const [erreur, setErreur] = useState<string | null>(null);

  const enregistrer = async () => {
    setErreur(null);
    try {
      if (form.id) {
        await api.patch(`/api/administration/ia/configurations/${form.id}/`, form);
      } else {
        await api.post("/api/administration/ia/configurations/", form);
      }
      onEnregistre();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Enregistrement impossible.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-4xl rounded-2xl p-6 shadow-2xl" style={{ background: "var(--fond-carte)", color: "var(--texte)" }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2>Configuration métier</h2>
            <p className="text-sm" style={{ color: "var(--texte-2)" }}>Paramétrage serveur uniquement, aucune clé n&apos;est exposée.</p>
          </div>
          <button onClick={onFermer} className="btn-secondaire text-xs"><X className="h-4 w-4" /></button>
        </div>
        {erreur && <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-600">{erreur}</div>}
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <input className="champ-saisie" placeholder="Code" value={form.code || ""} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))} />
          <input className="champ-saisie" placeholder="Libellé" value={form.libelle || ""} onChange={(e) => setForm((p) => ({ ...p, libelle: e.target.value }))} />
          <select className="champ-saisie" value={form.module} onChange={(e) => setForm((p) => ({ ...p, module: e.target.value }))}>
            {MODULES.map(([code, libelle]) => <option key={code} value={code}>{libelle}</option>)}
          </select>
          <input className="champ-saisie" placeholder="Modèle administrable" value={form.modele || ""} onChange={(e) => setForm((p) => ({ ...p, modele: e.target.value }))} />
          <input className="champ-saisie" placeholder="Modèle de secours" value={form.modele_fallback || ""} onChange={(e) => setForm((p) => ({ ...p, modele_fallback: e.target.value }))} />
          <input className="champ-saisie" type="number" step="0.01" placeholder="Seuil confiance" value={form.seuil_confiance || ""} onChange={(e) => setForm((p) => ({ ...p, seuil_confiance: e.target.value }))} />
          <textarea className="champ-saisie md:col-span-2" rows={5} placeholder="Prompt système" value={form.prompt_systeme || ""} onChange={(e) => setForm((p) => ({ ...p, prompt_systeme: e.target.value }))} />
          <textarea className="champ-saisie md:col-span-2" rows={4} placeholder="Prompt de contrôle" value={form.prompt_controle || ""} onChange={(e) => setForm((p) => ({ ...p, prompt_controle: e.target.value }))} />
          <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={Boolean(form.validation_humaine_obligatoire)} onChange={(e) => setForm((p) => ({ ...p, validation_humaine_obligatoire: e.target.checked }))} />Validation humaine obligatoire</label>
          <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={Boolean(form.est_actif)} onChange={(e) => setForm((p) => ({ ...p, est_actif: e.target.checked }))} />Configuration active</label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-secondaire" onClick={onFermer}>Annuler</button>
          <button className="btn-primaire" onClick={enregistrer}><Save className="h-4 w-4" />Enregistrer</button>
        </div>
      </div>
    </div>
  );
}

export default function PageParametrageIA() {
  const [configurations, setConfigurations] = useState<ConfigurationIA[]>([]);
  const [edition, setEdition] = useState<Partial<ConfigurationIA> | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const charger = () => api.get<ConfigurationIA[]>("/api/administration/ia/configurations/")
    .then((data) => setConfigurations(extraireListeResultats(data)))
    .catch(() => setConfigurations([]));

  useEffect(() => { charger(); }, []);

  const tester = async (configuration: ConfigurationIA) => {
    const reponse = await api.post<{ detail: string }>(`/api/administration/ia/configurations/${configuration.id}/tester/`, { prompt: configuration.prompt_controle });
    setMessage(reponse.detail);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1>Intelligence artificielle métier</h1>
          <p className="text-sm" style={{ color: "var(--texte-2)" }}>Modèles, prompts, seuils, validations, journaux et coûts.</p>
        </div>
        <button className="btn-primaire" onClick={() => setEdition(configurationVide())}><Plus className="h-4 w-4" />Nouvelle configuration</button>
      </div>
      {message && <div className="carte text-sm" style={{ color: "var(--texte-2)" }}>{message}</div>}
      <div className="grid gap-4 lg:grid-cols-2">
        {configurations.map((configuration) => (
          <div key={configuration.id} className="carte space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold" style={{ color: "var(--texte)" }}>{configuration.libelle}</p>
                <p className="text-xs" style={{ color: "var(--texte-2)" }}>{configuration.module_libelle || configuration.module} · {configuration.modele}</p>
              </div>
              <span className={configuration.est_actif ? "badge-succes" : "badge-neutre"}>{configuration.est_actif ? "Actif" : "Inactif"}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="btn-secondaire text-xs" onClick={() => setEdition(configuration)}><Bot className="h-3.5 w-3.5" />Modifier</button>
              <button className="btn-secondaire text-xs" onClick={() => tester(configuration)}><FlaskConical className="h-3.5 w-3.5" />Tester le prompt</button>
            </div>
          </div>
        ))}
      </div>
      {edition && <ModalConfigurationIA configuration={edition} onFermer={() => setEdition(null)} onEnregistre={() => { setEdition(null); charger(); }} />}
    </div>
  );
}
