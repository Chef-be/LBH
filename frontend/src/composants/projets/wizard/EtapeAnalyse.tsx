"use client";

import { useRef, useState, useCallback } from "react";
import { clsx } from "clsx";
import {
  Upload, FileText, FileSpreadsheet, Image, File, X, Zap,
  CheckCircle2, AlertCircle, FolderOpen, ChevronDown,
  ChevronUp, Sparkles,
} from "lucide-react";
import type { EtatWizard, ResultatPreanalyseSources, TachePreanalyseSources, ParcoursProjet } from "./types";

// ─── Icônes par extension ────────────────────────────────────────────────────

function IconeFichier({ nom, type }: { nom: string; type?: string }) {
  const ext = nom.split(".").pop()?.toLowerCase() ?? "";
  if (["pdf"].includes(ext)) return <FileText size={18} className="text-red-500" />;
  if (["xlsx", "xls", "csv", "ods"].includes(ext)) return <FileSpreadsheet size={18} className="text-emerald-500" />;
  if (["docx", "doc", "odt", "txt", "rtf"].includes(ext)) return <FileText size={18} className="text-blue-500" />;
  if (["png", "jpg", "jpeg", "gif", "svg", "webp", "tiff"].includes(ext)) return <Image size={18} className="text-purple-500" />;
  if (["dxf", "dwg", "ifc"].includes(ext)) return <FolderOpen size={18} className="text-amber-500" />;
  if (["zip", "7z", "tar", "gz"].includes(ext)) return <File size={18} className="text-slate-500" />;
  return <File size={18} className="text-[color:var(--texte-3)]" />;
}

function tailleLisible(octets: number): string {
  if (octets < 1024) return `${octets} o`;
  if (octets < 1024 * 1024) return `${(octets / 1024).toFixed(1)} Ko`;
  return `${(octets / (1024 * 1024)).toFixed(1)} Mo`;
}

// ─── Barre de confiance ──────────────────────────────────────────────────────

function BarreConfiance({ score }: { score: number }) {
  const pct = score <= 1 ? Math.round(score * 100) : Math.min(Math.round((score / 15) * 100), 100);
  const couleur = pct >= 75 ? "bg-emerald-500" : pct >= 45 ? "bg-amber-400" : "bg-red-400";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full" style={{ background: "var(--fond-app)" }}>
        <div className={`h-1.5 rounded-full transition-all ${couleur}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] font-mono text-[color:var(--texte-3)] w-8 shrink-0">{pct}%</span>
    </div>
  );
}

// ─── Badge type document ─────────────────────────────────────────────────────

const COULEURS_TYPE: Record<string, string> = {
  CCTP: "bg-blue-100 text-blue-700 border-blue-200",
  BPU: "bg-emerald-100 text-emerald-700 border-emerald-200",
  DPGF: "bg-emerald-100 text-emerald-700 border-emerald-200",
  DQE: "bg-teal-100 text-teal-700 border-teal-200",
  AE: "bg-violet-100 text-violet-700 border-violet-200",
  PLAN: "bg-amber-100 text-amber-700 border-amber-200",
  NOTE_CALCUL: "bg-indigo-100 text-indigo-700 border-indigo-200",
  RAPPORT: "bg-slate-100 text-slate-600 border-slate-200",
  RC: "bg-orange-100 text-orange-700 border-orange-200",
  PHOTO: "bg-pink-100 text-pink-700 border-pink-200",
};

function BadgeType({ code, libelle }: { code: string; libelle: string }) {
  const classes = COULEURS_TYPE[code] ?? "bg-slate-100 text-slate-600 border-slate-200";
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${classes}`}>
      {code}
    </span>
  );
}

// ─── Composant principal ─────────────────────────────────────────────────────

interface EtapeAnalyseProps {
  etat: EtatWizard;
  parcours?: ParcoursProjet;
  tacheAnalyse?: TachePreanalyseSources | null;
  analyseEnCours: boolean;
  onAjouterFichiers: (fichiers: File[]) => void;
  onSupprimerFichier: (index: number) => void;
  onLancerAnalyse: () => void;
  onAppliquerChamp: (champ: string, valeur: string) => void;
}

const ETAPES_ANALYSE = [
  "Extraction du texte",
  "Classification des documents",
  "Extraction des données métier",
  "Synthèse et pré-remplissage",
];

export function EtapeAnalyse({
  etat,
  parcours,
  tacheAnalyse,
  analyseEnCours,
  onAjouterFichiers,
  onSupprimerFichier,
  onLancerAnalyse,
  onAppliquerChamp,
}: EtapeAnalyseProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [survol, setSurvol] = useState(false);
  const [resultatEtendu, setResultatEtendu] = useState(false);

  const statut = tacheAnalyse?.statut;
  const progression = tacheAnalyse?.progression ?? 0;
  const resultat = etat.resultatPreanalyse;
  const etapeAnalyse = Math.floor((progression / 100) * ETAPES_ANALYSE.length);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setSurvol(false);
    const fichiers = Array.from(e.dataTransfer.files);
    onAjouterFichiers(fichiers);
  }, [onAjouterFichiers]);

  const handleInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      onAjouterFichiers(Array.from(e.target.files));
    }
    e.target.value = "";
  }, [onAjouterFichiers]);

  const preRemplissage = resultat?.pre_remplissage?.champs;

  return (
    <div className="space-y-5">
      {/* Zone d'upload */}
      <div>
        <h3 className="font-semibold text-[color:var(--texte)] mb-1">Pièces sources du projet</h3>
        <p className="text-xs text-[color:var(--texte-2)] mb-3">
          Déposez les documents reçus (CCTP, DPGF, BPU, plans, programmes…). Le moteur les analysera
          et pré-remplira automatiquement les données du projet.
        </p>

        {/* Drop zone */}
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setSurvol(true); }}
          onDragLeave={() => setSurvol(false)}
          onDrop={handleDrop}
          className={clsx(
            "relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200",
            survol
              ? "border-[color:var(--c-base)] bg-[color:var(--c-leger)]"
              : "border-[color:var(--bordure)] hover:border-[color:var(--c-clair)] hover:bg-[color:var(--fond-app)]"
          )}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.txt,.zip,.dxf,.dwg,.png,.jpg,.jpeg,.tiff"
            className="hidden"
            onChange={handleInput}
          />
          <Upload
            size={32}
            className="mx-auto mb-3 transition-transform duration-200"
            style={{ color: survol ? "var(--c-base)" : "var(--texte-3)" }}
          />
          <p className="font-medium text-sm" style={{ color: survol ? "var(--c-base)" : "var(--texte-2)" }}>
            Glissez vos fichiers ici ou <span className="underline">cliquez pour parcourir</span>
          </p>
          <p className="mt-1 text-xs text-[color:var(--texte-3)]">
            PDF, Word, Excel, DXF, images — jusqu&apos;à 100 Mo par fichier
          </p>
        </div>

        {/* Liste des fichiers */}
        {etat.fichiersSourcesProjet.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {etat.fichiersSourcesProjet.map((f, i) => (
              <div
                key={`${f.name}-${f.size}`}
                className="flex items-center gap-3 px-3 py-2 rounded-xl"
                style={{ background: "var(--fond-app)", border: "1px solid var(--bordure)" }}
              >
                <IconeFichier nom={f.name} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[color:var(--texte)] truncate">{f.name}</p>
                  <p className="text-[10px] text-[color:var(--texte-3)]">{tailleLisible(f.size)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onSupprimerFichier(i)}
                  className="text-[color:var(--texte-3)] hover:text-red-500 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Bouton d'analyse */}
        {etat.fichiersSourcesProjet.length > 0 && !analyseEnCours && statut !== "terminee" && (
          <div className="mt-3">
            <button
              type="button"
              onClick={onLancerAnalyse}
              className="btn-primaire text-xs"
            >
              <Zap size={14} />
              Analyser les pièces ({etat.fichiersSourcesProjet.length})
            </button>
          </div>
        )}
      </div>

      {/* Progression de l'analyse */}
      {(analyseEnCours || statut === "en_cours" || statut === "en_attente") && (
        <div className="rounded-2xl p-4 space-y-3" style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-[color:var(--texte)]">Analyse en cours…</p>
            <span className="text-xs font-mono text-[color:var(--c-base)]">{progression}%</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--fond-app)" }}>
            <div
              className="h-2 rounded-full transition-all duration-500"
              style={{ width: `${progression}%`, background: "var(--c-base)" }}
            />
          </div>
          <p className="text-xs text-[color:var(--texte-2)]">
            {tacheAnalyse?.message || ETAPES_ANALYSE[Math.min(etapeAnalyse, ETAPES_ANALYSE.length - 1)]}
          </p>
          <div className="flex gap-1.5 flex-wrap">
            {ETAPES_ANALYSE.map((etape, i) => (
              <span
                key={etape}
                className={clsx(
                  "text-[9px] px-2 py-0.5 rounded-full border font-medium",
                  i < etapeAnalyse
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                    : i === etapeAnalyse
                    ? "border-[color:var(--c-clair)] text-[color:var(--c-base)]"
                    : "border-[color:var(--bordure)] text-[color:var(--texte-3)]"
                )}
                style={i === etapeAnalyse ? { background: "var(--c-leger)" } : {}}
              >
                {etape}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Erreur d'analyse */}
      {statut === "echec" && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-start gap-3">
          <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-700">L&apos;analyse a échoué</p>
            <p className="text-xs text-red-600 mt-0.5">{tacheAnalyse?.erreur || "Erreur inconnue"}</p>
          </div>
        </div>
      )}

      {/* Résultats de l'analyse */}
      {statut === "terminee" && resultat && (
        <div className="space-y-4">
          {/* Succès */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 flex items-center gap-3">
            <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
            <p className="text-sm font-medium text-emerald-700">
              {resultat.resume.fichiers_analyses} fichier{resultat.resume.fichiers_analyses > 1 ? "s" : ""} analysé{resultat.resume.fichiers_analyses > 1 ? "s" : ""}
              {" "}— {resultat.resume.types_detectes.length} type{resultat.resume.types_detectes.length > 1 ? "s" : ""} détecté{resultat.resume.types_detectes.length > 1 ? "s" : ""}
            </p>
          </div>

          {/* Cards fichiers analysés */}
          <div>
            <button
              type="button"
              onClick={() => setResultatEtendu(!resultatEtendu)}
              className="w-full flex items-center justify-between py-2 text-sm font-semibold text-[color:var(--texte)]"
            >
              <span>Détail par fichier</span>
              {resultatEtendu ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {resultatEtendu && (
              <div className="space-y-2">
                {resultat.analyses.map((analyse, i) => (
                  <div
                    key={i}
                    className="rounded-xl p-3 space-y-2"
                    style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}
                  >
                    <div className="flex items-start gap-2">
                      <IconeFichier nom={analyse.nom_fichier} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-[color:var(--texte)] truncate">{analyse.nom_affichage || analyse.nom_fichier}</p>
                          {analyse.type_piece && (
                            <BadgeType code={analyse.type_piece.code} libelle={analyse.type_piece.libelle} />
                          )}
                        </div>
                        <BarreConfiance score={analyse.confiance} />
                      </div>
                    </div>
                    {analyse.mots_cles && analyse.mots_cles.length > 0 && (
                      <div className="flex flex-wrap gap-1 pl-6">
                        {analyse.mots_cles.slice(0, 6).map((mc) => (
                          <span key={mc} className="text-[9px] px-1.5 py-0.5 rounded-full text-[color:var(--texte-3)]"
                            style={{ background: "var(--fond-app)", border: "1px solid var(--bordure)" }}>
                            {mc}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Données pré-remplies */}
          {preRemplissage && Object.keys(preRemplissage).length > 0 && (
            <div className="rounded-2xl p-4 space-y-3" style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}>
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-[color:var(--c-base)]" />
                <p className="text-sm font-semibold text-[color:var(--texte)]">Données extraites automatiquement</p>
              </div>
              <div className="space-y-2">
                {(["intitule", "commune", "departement", "montant_estime", "phase"] as const).map((cle) => {
                  const champ = preRemplissage[cle];
                  if (!champ || typeof champ !== "object" || !("valeur" in champ)) return null;
                  const pct = Math.round((champ as { valeur: string | number; confiance: number; source: string }).confiance * 100);
                  const val = String((champ as { valeur: string | number; confiance: number; source: string }).valeur);
                  const src = (champ as { valeur: string | number; confiance: number; source: string }).source;
                  const deja = etat.champsPreremplis.has(cle);
                  return (
                    <div key={cle} className="flex items-center gap-3 text-sm">
                      <div className="min-w-0 flex-1">
                        <span className="text-xs text-[color:var(--texte-3)] uppercase tracking-wide">{cle.replace("_", " ")}</span>
                        <p className="font-medium text-[color:var(--texte)] truncate">{val}</p>
                        <p className="text-[10px] text-[color:var(--texte-3)]">{src} — confiance {pct}%</p>
                      </div>
                      {!deja && (
                        <button
                          type="button"
                          onClick={() => onAppliquerChamp(cle, val)}
                          className="shrink-0 text-xs px-2 py-1 rounded-lg font-medium transition-colors"
                          style={{ background: "var(--c-leger)", color: "var(--c-fort)" }}
                        >
                          Appliquer
                        </button>
                      )}
                      {deja && (
                        <CheckCircle2 size={16} className="shrink-0 text-emerald-500" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Aperçu structure GED */}
          {parcours && parcours.dossiers_ged.length > 0 && (
            <div className="rounded-2xl p-4" style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}>
              <div className="flex items-center gap-2 mb-3">
                <FolderOpen size={16} className="text-amber-500" />
                <p className="text-sm font-semibold text-[color:var(--texte)]">Structure GED à créer</p>
              </div>
              <div className="space-y-1">
                {parcours.dossiers_ged.slice(0, 8).map((dossier) => (
                  <div key={dossier.code} className="flex items-center gap-2 text-xs text-[color:var(--texte-2)]"
                    style={{ paddingLeft: dossier.parent_code ? "1.5rem" : "0" }}>
                    <FolderOpen size={12} className="shrink-0 text-amber-400" />
                    <span className="font-mono text-[color:var(--texte-3)] shrink-0">{dossier.code}</span>
                    <span className="truncate">{dossier.intitule}</span>
                    {dossier.est_systeme && (
                      <span className="ml-auto shrink-0 text-[9px] px-1 rounded" style={{ background: "var(--fond-app)", color: "var(--texte-3)" }}>
                        Système
                      </span>
                    )}
                  </div>
                ))}
                {parcours.dossiers_ged.length > 8 && (
                  <p className="text-[10px] text-[color:var(--texte-3)] pl-0.5">
                    +{parcours.dossiers_ged.length - 8} dossiers supplémentaires
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Cette étape est optionnelle */}
      {etat.fichiersSourcesProjet.length === 0 && statut !== "terminee" && (
        <p className="text-xs text-center text-[color:var(--texte-3)] italic">
          Cette étape est optionnelle — vous pouvez ajouter des documents plus tard depuis la fiche projet.
        </p>
      )}

    </div>
  );
}
