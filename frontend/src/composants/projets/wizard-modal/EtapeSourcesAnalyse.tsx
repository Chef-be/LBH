"use client";

import { useRef, useState } from "react";
import { clsx } from "clsx";
import {
  Upload, FileText, FileSpreadsheet, Image, File, X, Zap,
  CheckCircle2, AlertCircle, FolderOpen, Sparkles, Loader2,
  Tag, ChevronDown, ChevronUp, Info,
} from "lucide-react";
import type { EtatWizardModal, TachePreanalyse, ResultatPreanalyse, DocumentAnalyse } from "./types";

// ── Icône fichier ─────────────────────────────────────────────────────────────

function IconeFichier({ nom }: { nom: string }) {
  const ext = nom.split(".").pop()?.toLowerCase() ?? "";
  if (["pdf"].includes(ext)) return <FileText size={16} className="text-red-500" />;
  if (["xlsx", "xls", "csv", "ods"].includes(ext)) return <FileSpreadsheet size={16} className="text-emerald-500" />;
  if (["docx", "doc", "odt"].includes(ext)) return <FileText size={16} className="text-blue-500" />;
  if (["png", "jpg", "jpeg", "gif", "webp", "tiff"].includes(ext)) return <Image size={16} className="text-purple-500" />;
  if (["dxf", "dwg", "ifc"].includes(ext)) return <FolderOpen size={16} className="text-amber-500" />;
  return <File size={16} className="text-[color:var(--texte-3)]" />;
}

function tailleLisible(octets: number): string {
  if (octets < 1024) return `${octets} o`;
  if (octets < 1024 * 1024) return `${(octets / 1024).toFixed(1)} Ko`;
  return `${(octets / (1024 * 1024)).toFixed(1)} Mo`;
}

// ── Couleurs par type de document détecté ────────────────────────────────────

const COULEURS_TYPE: Record<string, string> = {
  CCTP:        "bg-blue-100 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border-blue-200",
  BPU:         "bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200",
  DPGF:        "bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200",
  DQE:         "bg-teal-100 dark:bg-teal-950/30 text-teal-700 dark:text-teal-300 border-teal-200",
  PLAN:        "bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200",
  NOTE_CALCUL: "bg-indigo-100 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 border-indigo-200",
  RAPPORT:     "bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 border-slate-200",
  RC:          "bg-orange-100 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300 border-orange-200",
  PHOTO:       "bg-pink-100 dark:bg-pink-950/30 text-pink-700 dark:text-pink-300 border-pink-200",
  AE:          "bg-violet-100 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300 border-violet-200",
};

// ── Barre de confiance ────────────────────────────────────────────────────────

function BarreConfiance({ score }: { score: number }) {
  const pct = score <= 1 ? Math.round(score * 100) : Math.min(Math.round((score / 15) * 100), 100);
  const couleur = pct >= 75 ? "bg-emerald-500" : pct >= 45 ? "bg-amber-400" : "bg-red-400";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full" style={{ background: "var(--fond-app)" }}>
        <div className={`h-1.5 rounded-full ${couleur}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] font-mono" style={{ color: "var(--texte-3)" }}>{pct}%</span>
    </div>
  );
}

// ── Card document analysé ─────────────────────────────────────────────────────

function CarteDocumentAnalyse({ doc }: { doc: DocumentAnalyse }) {
  const [ouvert, setOuvert] = useState(false);
  const couleurType = COULEURS_TYPE[doc.type_detecte] ?? "bg-slate-100 text-slate-600 border-slate-200";

  return (
    <div
      className="rounded-xl border p-3 transition-all"
      style={{ background: "var(--fond-carte)", borderColor: "var(--bordure)" }}
    >
      <div className="flex items-center gap-2">
        <IconeFichier nom={doc.nom_fichier} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate" style={{ color: "var(--texte)" }}>{doc.nom_fichier}</p>
          <BarreConfiance score={doc.confiance} />
        </div>
        <span className={clsx("shrink-0 rounded px-2 py-0.5 text-[10px] font-bold border", couleurType)}>
          {doc.type_detecte}
        </span>
        {Object.keys(doc.informations ?? {}).length > 0 && (
          <button type="button" onClick={() => setOuvert((v) => !v)}
            className="p-1 rounded hover:bg-[color:var(--fond-entree)] transition-colors">
            {ouvert ? <ChevronUp size={13} style={{ color: "var(--texte-3)" }} /> : <ChevronDown size={13} style={{ color: "var(--texte-3)" }} />}
          </button>
        )}
      </div>

      {doc.dossier_ged_suggere && (
        <p className="mt-1.5 text-[10px] flex items-center gap-1" style={{ color: "var(--texte-3)" }}>
          <FolderOpen size={10} />
          Classé dans : <span className="font-medium text-[color:var(--texte-2)]">{doc.dossier_ged_suggere}</span>
        </p>
      )}

      {ouvert && doc.informations && (
        <div className="mt-2 text-[10px] space-y-0.5 pl-2 border-l-2 border-[color:var(--bordure)]">
          {Object.entries(doc.informations).map(([k, v]) => (
            <div key={k} className="flex gap-2">
              <span style={{ color: "var(--texte-3)" }}>{k} :</span>
              <span style={{ color: "var(--texte-2)" }}>{String(v)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────

interface Props {
  etat: EtatWizardModal;
  tacheAnalyse: TachePreanalyse | null;
  analyseEnCours: boolean;
  erreurs: Record<string, string>;
  onChange: <K extends keyof EtatWizardModal>(champ: K, valeur: EtatWizardModal[K]) => void;
  onAjouterFichiers: (fichiers: File[]) => void;
  onSupprimerFichier: (index: number) => void;
  onLancerAnalyse: () => void;
}

export function EtapeSourcesAnalyse({
  etat, tacheAnalyse, analyseEnCours, erreurs,
  onChange, onAjouterFichiers, onSupprimerFichier, onLancerAnalyse,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    onAjouterFichiers(Array.from(files));
  };

  const analyseTerminee = tacheAnalyse?.statut === "terminee";
  const analyseEchec = tacheAnalyse?.statut === "echec";
  const documentsAnalyses = (tacheAnalyse?.resultat?.documents_analyses ?? []) as DocumentAnalyse[];
  const preRemplissage = tacheAnalyse?.resultat?.pre_remplissage;

  return (
    <div className="space-y-6">
      {/* Zone de dépôt */}
      <div>
        <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--texte)" }}>
          Documents sources du projet
        </h3>
        <p className="text-xs mb-4" style={{ color: "var(--texte-2)" }}>
          Déposez les pièces du dossier (CCTP, plans, estimations, cahier des charges…).
          L&apos;IA analyse et pré-remplit les informations du projet.
        </p>

        {/* Zone drag-and-drop */}
        <div
          className={clsx(
            "relative rounded-2xl border-2 border-dashed p-8 text-center transition-all cursor-pointer",
            dragging ? "border-[color:var(--c-base)] scale-[1.01]" : "border-[color:var(--bordure)] hover:border-[color:var(--bordure-fm)]"
          )}
          style={{ background: dragging ? "var(--c-leger)" : "var(--fond-entree)" }}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
        >
          <Upload size={28} className="mx-auto mb-3" style={{ color: "var(--texte-3)" }} />
          <p className="text-sm font-medium" style={{ color: "var(--texte)" }}>
            Glissez vos fichiers ici ou{" "}
            <span style={{ color: "var(--c-base)" }}>cliquez pour parcourir</span>
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--texte-3)" }}>
            PDF, Word, Excel, images, plans DXF/DWG/IFC, archives ZIP
          </p>
          <input
            ref={inputRef} type="file" multiple className="hidden"
            accept=".pdf,.docx,.doc,.xlsx,.xls,.odt,.ods,.png,.jpg,.jpeg,.gif,.dxf,.dwg,.ifc,.zip"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
      </div>

      {/* Liste des fichiers */}
      {etat.fichiersSourcesProjet.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold" style={{ color: "var(--texte-2)" }}>
              {etat.fichiersSourcesProjet.length} fichier{etat.fichiersSourcesProjet.length > 1 ? "s" : ""} sélectionné{etat.fichiersSourcesProjet.length > 1 ? "s" : ""}
            </p>
            {!etat.preanalyseSourcesId && !analyseEnCours && (
              <button
                type="button"
                onClick={onLancerAnalyse}
                className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold text-white transition-all hover:opacity-90"
                style={{ background: "var(--c-base)" }}
              >
                <Zap size={13} />
                Analyser avec l&apos;IA
              </button>
            )}
          </div>

          <div className="space-y-2">
            {etat.fichiersSourcesProjet.map((f, i) => (
              <div
                key={i}
                className="flex items-center gap-2.5 rounded-xl border px-3 py-2 transition-all hover:border-[color:var(--bordure-fm)]"
                style={{ background: "var(--fond-carte)", borderColor: "var(--bordure)" }}
              >
                <IconeFichier nom={f.name} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate" style={{ color: "var(--texte)" }}>{f.name}</p>
                  <p className="text-[10px]" style={{ color: "var(--texte-3)" }}>{tailleLisible(f.size)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onSupprimerFichier(i)}
                  className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-500 transition-colors"
                  style={{ color: "var(--texte-3)" }}
                >
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Progression analyse */}
      {analyseEnCours && tacheAnalyse && (
        <div
          className="rounded-2xl border p-4 space-y-3"
          style={{ background: "var(--fond-entree)", borderColor: "var(--c-clair)" }}
        >
          <div className="flex items-center gap-2">
            <Loader2 size={16} className="animate-spin" style={{ color: "var(--c-base)" }} />
            <span className="text-sm font-medium" style={{ color: "var(--texte)" }}>Analyse en cours…</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--fond-app)" }}>
            <div
              className="h-2 rounded-full transition-all duration-500"
              style={{ width: `${tacheAnalyse.progression}%`, background: "var(--c-base)" }}
            />
          </div>
          <p className="text-xs" style={{ color: "var(--texte-3)" }}>
            {tacheAnalyse.message || "Extraction du contenu des documents…"}
          </p>
        </div>
      )}

      {/* Résultats analyse */}
      {analyseTerminee && tacheAnalyse?.resultat && (
        <div className="space-y-4">
          {/* En-tête succès */}
          <div
            className="flex items-center gap-2 rounded-xl px-4 py-3"
            style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)" }}
          >
            <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                Analyse terminée
              </p>
              {tacheAnalyse.resultat.confidence_globale !== undefined && (
                <p className="text-xs" style={{ color: "var(--texte-3)" }}>
                  Confiance globale : {Math.round((tacheAnalyse.resultat.confidence_globale ?? 0) * 100)}%
                </p>
              )}
            </div>
          </div>

          {/* Pré-remplissage détecté */}
          {preRemplissage?.description_detectee && (
            <div
              className="rounded-xl p-3 border"
              style={{ background: "var(--c-leger)", borderColor: "var(--c-clair)" }}
            >
              <div className="flex items-start gap-2">
                <Sparkles size={14} className="shrink-0 mt-0.5" style={{ color: "var(--c-base)" }} />
                <div>
                  <p className="text-xs font-semibold mb-1" style={{ color: "var(--c-base)" }}>Description extraite</p>
                  <p className="text-xs leading-relaxed" style={{ color: "var(--texte-2)" }}>
                    {preRemplissage.description_detectee}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Documents classés */}
          {documentsAnalyses.length > 0 && (
            <div>
              <p className="text-xs font-semibold mb-2 flex items-center gap-1.5" style={{ color: "var(--texte-2)" }}>
                <Tag size={12} />
                {documentsAnalyses.length} document{documentsAnalyses.length > 1 ? "s" : ""} classé{documentsAnalyses.length > 1 ? "s" : ""}
              </p>
              <div className="space-y-2">
                {documentsAnalyses.map((doc, i) => (
                  <CarteDocumentAnalyse key={i} doc={doc} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Erreur analyse */}
      {(analyseEchec || erreurs.analyse) && (
        <div
          className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm"
          style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444" }}
        >
          <AlertCircle size={15} />
          {tacheAnalyse?.erreur ?? erreurs.analyse ?? "L'analyse a échoué."}
        </div>
      )}

      {/* Note si pas de fichiers */}
      {etat.fichiersSourcesProjet.length === 0 && (
        <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-xs" style={{ color: "var(--texte-3)", background: "var(--fond-entree)", border: "1px solid var(--bordure)" }}>
          <Info size={13} />
          Cette étape est optionnelle. Vous pouvez ajouter des documents après la création du projet depuis la GED.
        </div>
      )}
    </div>
  );
}
