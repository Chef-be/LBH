"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import {
  X, Folder, FolderOpen, CheckCircle2, Tag, Loader2,
  FileText, FileSpreadsheet, Image, File, ChevronRight,
  AlertCircle, Sparkles, Check,
} from "lucide-react";
import { api, ErreurApi } from "@/crochets/useApi";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DossierGED {
  id: string;
  code: string;
  intitule: string;
  enfants?: DossierGED[];
}

interface DocumentAClasser {
  id: string;
  reference: string;
  intitule: string;
  nom_fichier_origine: string;
  type_mime: string;
  type_detecte?: string;
  dossier_id?: string | null;
  dossier_intitule?: string | null;
  classification_ia?: string;
  confiance_ia?: number;
}

// ── Icône fichier ─────────────────────────────────────────────────────────────

function IconeFichier({ nom }: { nom: string }) {
  const ext = nom.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return <FileText size={16} className="text-red-500" />;
  if (["xlsx", "xls", "ods"].includes(ext)) return <FileSpreadsheet size={16} className="text-emerald-500" />;
  if (["docx", "doc", "odt"].includes(ext)) return <FileText size={16} className="text-blue-500" />;
  if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) return <Image size={16} className="text-purple-500" />;
  return <File size={16} style={{ color: "var(--texte-3)" }} />;
}

// ── Couleurs par type de document ─────────────────────────────────────────────

const COULEURS_TYPE: Record<string, string> = {
  CCTP: "bg-blue-100 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border-blue-200",
  BPU: "bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200",
  DPGF: "bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200",
  DQE: "bg-teal-100 dark:bg-teal-950/30 text-teal-700 dark:text-teal-300 border-teal-200",
  PLAN: "bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200",
  NOTE_CALCUL: "bg-indigo-100 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 border-indigo-200",
  RAPPORT: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200",
  RC: "bg-orange-100 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300 border-orange-200",
};

// ── Arborescence GED ──────────────────────────────────────────────────────────

function NoeudDossier({
  dossier, selected, onSelect, niveau,
}: {
  dossier: DossierGED; selected: boolean; onSelect: (id: string) => void; niveau: number;
}) {
  const [ouvert, setOuvert] = useState(niveau < 1);
  const aEnfants = dossier.enfants && dossier.enfants.length > 0;

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          onSelect(dossier.id);
          if (aEnfants) setOuvert((v) => !v);
        }}
        className={clsx(
          "w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-left transition-all",
          "focus:outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--c-base)]",
          selected
            ? "bg-[color:var(--c-leger)] text-[color:var(--c-base)] font-semibold border border-[color:var(--c-clair)]"
            : "hover:bg-[color:var(--fond-entree)] text-[color:var(--texte)]"
        )}
        style={{ paddingLeft: `${8 + niveau * 16}px` }}
      >
        {aEnfants
          ? (ouvert ? <FolderOpen size={13} style={{ color: "var(--c-base)" }} /> : <Folder size={13} style={{ color: "var(--texte-3)" }} />)
          : <Folder size={13} style={{ color: "var(--texte-3)" }} />
        }
        <span className="flex-1 truncate">{dossier.intitule}</span>
        {selected && <Check size={11} strokeWidth={3} className="text-emerald-500 shrink-0" />}
        {aEnfants && !selected && (
          <ChevronRight size={11} className={clsx("shrink-0 transition-transform", ouvert && "rotate-90")} style={{ color: "var(--texte-3)" }} />
        )}
      </button>
      {aEnfants && ouvert && (
        <div>
          {dossier.enfants!.map((enfant) => (
            <NoeudDossier key={enfant.id} dossier={enfant} selected={selected && false} onSelect={onSelect} niveau={niveau + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────

interface Props {
  projetId: string;
  documents: DocumentAClasser[];
  onFermer: () => void;
  onClassificationAppliquee?: () => void;
}

export function ModalClassificationGED({ projetId, documents, onFermer, onClassificationAppliquee }: Props) {
  const queryClient = useQueryClient();
  const [documentCourant, setDocumentCourant] = useState(0);
  const [dossierSelectionne, setDossierSelectionne] = useState<string>("");
  const [classifications, setClassifications] = useState<Record<string, string>>({});
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [termine, setTermine] = useState(false);

  // Charger l'arborescence GED du projet
  const { data: dossiersData, isLoading: dossiersEnChargement } = useQuery<DossierGED[] | { results: DossierGED[] }>({
    queryKey: ["dossiers-ged", projetId],
    queryFn: () => api.get<DossierGED[] | { results: DossierGED[] }>(`/api/documents/dossiers/?projet=${projetId}&parent__isnull=true`),
  });

  const dossiers: DossierGED[] = Array.isArray(dossiersData) ? dossiersData : (dossiersData?.results ?? []);
  const doc = documents[documentCourant];

  // Présélectionner le dossier suggéré par l'IA
  useState(() => {
    if (doc?.dossier_id) setDossierSelectionne(doc.dossier_id);
  });

  const mutation = useMutation({
    mutationFn: ({ documentId, dossierId }: { documentId: string; dossierId: string }) =>
      api.patch(`/api/documents/${documentId}/`, { dossier: dossierId }),
  });

  async function appliquerClassification() {
    if (!dossierSelectionne || !doc) return;
    setEnCours(true);
    setErreur(null);
    try {
      await mutation.mutateAsync({ documentId: doc.id, dossierId: dossierSelectionne });
      setClassifications((prev) => ({ ...prev, [doc.id]: dossierSelectionne }));
      if (documentCourant < documents.length - 1) {
        const suivant = documentCourant + 1;
        setDocumentCourant(suivant);
        setDossierSelectionne(documents[suivant]?.dossier_id ?? "");
      } else {
        setTermine(true);
        queryClient.invalidateQueries({ queryKey: ["documents"] });
        onClassificationAppliquee?.();
      }
    } catch (err) {
      setErreur(err instanceof ErreurApi ? err.detail : "Erreur lors de la classification.");
    } finally {
      setEnCours(false);
    }
  }

  async function appliquerTout() {
    setEnCours(true);
    setErreur(null);
    let erreurs = 0;
    for (const d of documents) {
      const dossierId = d.dossier_id;
      if (!dossierId) continue;
      try {
        await mutation.mutateAsync({ documentId: d.id, dossierId });
        setClassifications((prev) => ({ ...prev, [d.id]: dossierId }));
      } catch {
        erreurs++;
      }
    }
    setEnCours(false);
    if (erreurs === 0) {
      setTermine(true);
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      onClassificationAppliquee?.();
    } else {
      setErreur(`${erreurs} document(s) n'ont pas pu être classés.`);
    }
  }

  const documentsAvecSuggestion = documents.filter((d) => d.dossier_id);
  const progression = (Object.keys(classifications).length / documents.length) * 100;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-40 backdrop-blur-sm" style={{ background: "rgba(0,0,0,0.5)" }} onClick={onFermer} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="relative w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden flex flex-col"
          style={{ background: "var(--fond-app)", border: "1px solid var(--bordure)", maxHeight: "calc(100vh - 2rem)" }}
        >
          {/* En-tête */}
          <div
            className="flex items-center justify-between gap-3 px-6 py-4 shrink-0"
            style={{ background: "var(--fond-carte)", borderBottom: "1px solid var(--bordure)" }}
          >
            <div className="flex items-center gap-2">
              <Tag size={18} style={{ color: "var(--c-base)" }} />
              <div>
                <h2 className="text-base font-bold" style={{ color: "var(--texte)" }}>
                  Classification documentaire
                </h2>
                <p className="text-xs" style={{ color: "var(--texte-2)" }}>
                  {documents.length} document{documents.length > 1 ? "s" : ""} à classer dans la GED
                </p>
              </div>
            </div>
            <button type="button" onClick={onFermer}
              className="flex h-8 w-8 items-center justify-center rounded-xl hover:bg-[color:var(--fond-entree)] transition-colors"
              style={{ color: "var(--texte-3)" }}>
              <X size={16} />
            </button>
          </div>

          {/* Contenu */}
          <div className="flex-1 overflow-y-auto p-6">
            {termine ? (
              /* Écran de succès */
              <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500">
                  <CheckCircle2 size={32} className="text-white" />
                </div>
                <div>
                  <p className="text-lg font-bold" style={{ color: "var(--texte)" }}>Classification terminée</p>
                  <p className="text-sm mt-1" style={{ color: "var(--texte-2)" }}>
                    {Object.keys(classifications).length} document{Object.keys(classifications).length > 1 ? "s" : ""} classé{Object.keys(classifications).length > 1 ? "s" : ""} avec succès.
                  </p>
                </div>
                <button type="button" onClick={onFermer}
                  className="rounded-xl px-6 py-2.5 text-sm font-semibold text-white"
                  style={{ background: "var(--c-base)" }}>
                  Fermer
                </button>
              </div>
            ) : (
              <div className="flex gap-6">
                {/* Document courant */}
                <div className="flex-1 space-y-4">
                  {/* Progression */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-medium" style={{ color: "var(--texte-2)" }}>
                        Document {documentCourant + 1} / {documents.length}
                      </span>
                      <span className="text-xs" style={{ color: "var(--texte-3)" }}>
                        {Math.round(progression)}% classés
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--fond-app)" }}>
                      <div className="h-1.5 rounded-full transition-all" style={{ width: `${progression}%`, background: "var(--c-base)" }} />
                    </div>
                  </div>

                  {/* Carte document courant */}
                  {doc && (
                    <div
                      className="rounded-2xl border p-4 space-y-3"
                      style={{ background: "var(--fond-carte)", borderColor: "var(--bordure)" }}
                    >
                      <div className="flex items-center gap-2">
                        <IconeFichier nom={doc.nom_fichier_origine} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate" style={{ color: "var(--texte)" }}>{doc.intitule}</p>
                          <p className="text-[11px] truncate" style={{ color: "var(--texte-3)" }}>{doc.nom_fichier_origine}</p>
                        </div>
                        {doc.type_detecte && (
                          <span className={clsx("shrink-0 rounded border px-2 py-0.5 text-[10px] font-bold",
                            COULEURS_TYPE[doc.type_detecte] ?? "bg-slate-100 text-slate-600 border-slate-200")}>
                            {doc.type_detecte}
                          </span>
                        )}
                      </div>

                      {doc.classification_ia && (
                        <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
                          style={{ background: "var(--c-leger)", border: "1px solid var(--c-clair)" }}>
                          <Sparkles size={12} style={{ color: "var(--c-base)" }} />
                          <span style={{ color: "var(--c-fort)" }}>
                            Dossier suggéré par l&apos;IA : <strong>{doc.classification_ia}</strong>
                            {doc.confiance_ia !== undefined && (
                              <span style={{ color: "var(--texte-3)" }}> ({Math.round(doc.confiance_ia * 100)}%)</span>
                            )}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Navigation entre documents */}
                  <div className="flex gap-1.5 flex-wrap">
                    {documents.map((d, i) => (
                      <button key={d.id} type="button"
                        onClick={() => { setDocumentCourant(i); setDossierSelectionne(d.dossier_id ?? ""); }}
                        className={clsx(
                          "h-6 w-6 rounded text-[10px] font-bold transition-all border",
                          i === documentCourant
                            ? "border-[color:var(--c-base)] text-[color:var(--c-base)]"
                            : classifications[d.id]
                            ? "border-emerald-500 bg-emerald-500 text-white"
                            : "border-[color:var(--bordure)] text-[color:var(--texte-3)] hover:border-[color:var(--bordure-fm)]"
                        )}
                        style={{ background: i === documentCourant ? "var(--c-leger)" : undefined }}
                      >
                        {classifications[d.id] ? <Check size={10} className="mx-auto" /> : i + 1}
                      </button>
                    ))}
                  </div>

                  {erreur && (
                    <div className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-red-500"
                      style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.3)" }}>
                      <AlertCircle size={13} />
                      {erreur}
                    </div>
                  )}
                </div>

                {/* Arborescence GED */}
                <div
                  className="w-52 shrink-0 rounded-2xl border overflow-hidden"
                  style={{ borderColor: "var(--bordure)" }}
                >
                  <div className="px-3 py-2 border-b" style={{ background: "var(--fond-carte)", borderColor: "var(--bordure)" }}>
                    <p className="text-xs font-semibold" style={{ color: "var(--texte-2)" }}>
                      Choisir le dossier GED
                    </p>
                  </div>
                  <div className="p-2 overflow-y-auto" style={{ maxHeight: "280px", background: "var(--fond-entree)" }}>
                    {dossiersEnChargement ? (
                      <div className="flex items-center justify-center py-4 gap-2 text-xs" style={{ color: "var(--texte-3)" }}>
                        <Loader2 size={12} className="animate-spin" />
                        Chargement…
                      </div>
                    ) : (
                      dossiers.map((d) => (
                        <NoeudDossier
                          key={d.id}
                          dossier={d}
                          selected={dossierSelectionne === d.id}
                          onSelect={setDossierSelectionne}
                          niveau={0}
                        />
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Pied */}
          {!termine && (
            <div
              className="flex items-center justify-between gap-3 px-6 py-4 shrink-0"
              style={{ background: "var(--fond-carte)", borderTop: "1px solid var(--bordure)" }}
            >
              {documentsAvecSuggestion.length > 1 && (
                <button
                  type="button"
                  onClick={appliquerTout}
                  disabled={enCours}
                  className="flex items-center gap-1.5 rounded-xl border px-4 py-2.5 text-xs font-semibold transition-all disabled:opacity-50"
                  style={{ borderColor: "var(--bordure)", background: "var(--fond-carte)", color: "var(--texte)" }}
                >
                  {enCours ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                  Appliquer les suggestions IA ({documentsAvecSuggestion.length})
                </button>
              )}
              <div className="flex items-center gap-2 ml-auto">
                {documentCourant < documents.length - 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      const suivant = documentCourant + 1;
                      setDocumentCourant(suivant);
                      setDossierSelectionne(documents[suivant]?.dossier_id ?? "");
                    }}
                    className="rounded-xl border px-4 py-2.5 text-xs font-medium transition-all"
                    style={{ borderColor: "var(--bordure)", background: "var(--fond-carte)", color: "var(--texte)" }}
                  >
                    Ignorer
                  </button>
                )}
                <button
                  type="button"
                  onClick={appliquerClassification}
                  disabled={!dossierSelectionne || enCours}
                  className="flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-xs font-semibold text-white transition-all disabled:opacity-50"
                  style={{ background: "var(--c-base)" }}
                >
                  {enCours ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                  Classer ici
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
