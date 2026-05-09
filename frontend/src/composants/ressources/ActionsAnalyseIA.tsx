"use client";

import { useEffect, useState } from "react";
import { FlaskConical, Wand2, X } from "lucide-react";
import { api, ErreurApi, extraireListeResultats } from "@/crochets/useApi";

interface ConfigurationIA {
  id: string;
  libelle: string;
  module: string;
}

const MODULE_PAR_TYPE = {
  devis: "ressources_devis",
  prix: "ressources_prix_marche",
  estimations: "ressources_estimations",
  bibliotheque: "bibliotheque_cctp",
} as const;

export function ActionsAnalyseIA({ type }: { type: keyof typeof MODULE_PAR_TYPE }) {
  const [ouvert, setOuvert] = useState(false);
  const [configs, setConfigs] = useState<ConfigurationIA[]>([]);
  const [configuration, setConfiguration] = useState("");
  const [objetId, setObjetId] = useState("");
  const [resultat, setResultat] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (!ouvert) return;
    api.get<ConfigurationIA[]>(`/api/administration/ia/configurations/?module=${MODULE_PAR_TYPE[type]}&actif=1`)
      .then((data) => {
        const liste = extraireListeResultats(data);
        setConfigs(liste);
        setConfiguration(liste[0]?.id || "");
      })
      .catch(() => setConfigs([]));
  }, [ouvert, type]);

  const lancer = async () => {
    setErreur(null);
    setResultat(null);
    try {
      let reponse: { detail?: string; traitement_id?: string };
      if (type === "devis") {
        if (!objetId) {
          setErreur("Renseignez l'identifiant du devis analysé.");
          return;
        }
        reponse = await api.post(`/api/ressources/devis/${objetId}/analyser-ia/`, { configuration });
      } else if (type === "prix") {
        reponse = await api.post("/api/ressources/prix-marche/analyser-ia/", { configuration });
      } else if (type === "estimations") {
        reponse = await api.post("/api/ressources/estimations/generer-ia/", { configuration, programme: "Estimation à partir des références internes" });
      } else {
        reponse = await api.post("/api/bibliotheque/generer-article-cctp/", { configuration, designation: objetId || "Article CCTP à préciser" });
      }
      setResultat(`${reponse.detail || "Traitement enregistré."} Journal : ${reponse.traitement_id || "—"}`);
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Traitement impossible.");
    }
  };

  return (
    <>
      <button type="button" className="btn-secondaire" onClick={() => setOuvert(true)}>
        <Wand2 className="h-4 w-4" />
        {type === "estimations" ? "Générer avec IA" : "Analyser avec IA"}
      </button>
      {ouvert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-2xl p-6 shadow-2xl" style={{ background: "var(--fond-carte)", color: "var(--texte)" }}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2>{type === "devis" ? "Analyse contrôlée du devis" : type === "prix" ? "Analyse des prix marché" : type === "estimations" ? "Génération de scénarios d’estimation" : "Génération d’article CCTP"}</h2>
                <p className="text-sm" style={{ color: "var(--texte-2)" }}>L&apos;utilisateur valide les propositions avant application.</p>
              </div>
              <button className="btn-secondaire text-xs" onClick={() => setOuvert(false)}><X className="h-4 w-4" /></button>
            </div>
            <div className="mt-5 space-y-4">
              <select className="champ-saisie w-full" value={configuration} onChange={(e) => setConfiguration(e.target.value)}>
                <option value="">Choisir une configuration</option>
                {configs.map((config) => <option key={config.id} value={config.id}>{config.libelle}</option>)}
              </select>
              {(type === "devis" || type === "bibliotheque") && (
                <input className="champ-saisie w-full" value={objetId} onChange={(e) => setObjetId(e.target.value)} placeholder={type === "devis" ? "Identifiant du devis" : "Désignation de l'article CCTP"} />
              )}
              <div className="grid gap-2 sm:grid-cols-2 text-sm" style={{ color: "var(--texte-2)" }}>
                {["Corriger les libellés", "Normaliser", "Classer corps d'état", "Rapprocher bibliothèque", "Proposer corrections", "Journaliser le traitement"].map((option) => (
                  <label key={option} className="flex items-center gap-2"><input type="checkbox" defaultChecked />{option}</label>
                ))}
              </div>
              <p className="text-sm" style={{ color: "var(--texte-2)" }}>Coût estimatif : calculé au lancement selon la configuration active.</p>
              {erreur && <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-600">{erreur}</div>}
              {resultat && <div className="rounded-xl border px-4 py-3 text-sm" style={{ borderColor: "var(--bordure)", color: "var(--texte-2)" }}>{resultat}</div>}
              <div className="flex justify-end gap-2">
                <button className="btn-secondaire" onClick={() => setOuvert(false)}>Annuler</button>
                <button className="btn-primaire" disabled={!configuration} onClick={lancer}><FlaskConical className="h-4 w-4" />Lancer</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
