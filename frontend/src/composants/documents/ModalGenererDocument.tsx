"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { clsx } from "clsx";
import {
  X, FileText, Table, FileSpreadsheet, Loader2,
  Sparkles, ChevronRight, CheckCircle2, AlertCircle,
  ExternalLink, Play,
} from "lucide-react";
import { api, ErreurApi } from "@/crochets/useApi";

// ── Types ─────────────────────────────────────────────────────────────────────

interface VariableModele {
  code: string;
  libelle: string;
  type: "texte" | "nombre" | "date" | "booleen" | "liste";
  obligatoire: boolean;
  options?: string[];
  placeholder?: string;
}

interface ModeleDocument {
  id: string;
  code: string;
  libelle: string;
  type_modele: string;
  type_modele_libelle: string;
  format_sortie: string;
  description: string;
  variables_parametrables: VariableModele[];
  apercu_url: string | null;
}

interface DocumentCree {
  id: string;
  reference: string;
  intitule: string;
}

// ── Groupes de modèles ────────────────────────────────────────────────────────

const GROUPES_TYPES: Record<string, string> = {
  cctp: "CCTP",
  dpgf: "DPGF / BPU",
  bpu: "DPGF / BPU",
  os: "Administration chantier",
  decompte: "Administration chantier",
  avenant: "Administration chantier",
  rapport_analyse: "Analyse",
  cr_chantier: "Analyse",
  contrat: "Contractuel",
  memoire_technique: "Réponse AO",
  note_estimation: "Estimation",
  planning: "Planning",
  autre: "Autre",
};

// ── Icône format ──────────────────────────────────────────────────────────────

function IconeFormat({ format }: { format: string }) {
  if (format === "xlsx" || format === "ods") return <FileSpreadsheet size={14} className="text-emerald-500" />;
  if (format === "docx" || format === "odt") return <FileText size={14} className="text-blue-500" />;
  return <FileText size={14} style={{ color: "var(--texte-3)" }} />;
}

// ── Composant principal ───────────────────────────────────────────────────────

interface Props {
  projetId: string;
  familleClient?: string;
  onFermer: () => void;
  onDocumentCree?: (doc: DocumentCree) => void;
}

export function ModalGenererDocument({ projetId, familleClient, onFermer, onDocumentCree }: Props) {
  const [etape, setEtape] = useState<"selection" | "parametres" | "succes">("selection");
  const [modeleSelectionne, setModeleSelectionne] = useState<ModeleDocument | null>(null);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [documentCree, setDocumentCree] = useState<DocumentCree | null>(null);
  const [erreurGlobale, setErreurGlobale] = useState<string | null>(null);

  // Charger les modèles disponibles
  const { data, isLoading } = useQuery<{ modeles: ModeleDocument[] }>({
    queryKey: ["modeles-documents", familleClient],
    queryFn: () => {
      const p = new URLSearchParams();
      if (familleClient) p.set("famille_client", familleClient);
      return api.get(`/api/projets/modeles-documents/?${p.toString()}`);
    },
  });

  const modeles = data?.modeles ?? [];

  // Grouper par type
  const groupes = modeles.reduce<Record<string, ModeleDocument[]>>((acc, m) => {
    const groupe = GROUPES_TYPES[m.type_modele] ?? "Autre";
    if (!acc[groupe]) acc[groupe] = [];
    acc[groupe].push(m);
    return acc;
  }, {});

  // Mutation création
  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.post<DocumentCree>("/api/projets/modeles-documents/generer/", payload),
  });

  function selectionnerModele(modele: ModeleDocument) {
    setModeleSelectionne(modele);
    // Pré-remplir les variables avec des valeurs vides
    const vars: Record<string, string> = {};
    modele.variables_parametrables.forEach((v) => { vars[v.code] = ""; });
    setVariables(vars);
    setEtape("parametres");
  }

  function validerVariables(): boolean {
    if (!modeleSelectionne) return false;
    const nouvellesErreurs: Record<string, string> = {};
    modeleSelectionne.variables_parametrables.forEach((v) => {
      if (v.obligatoire && !variables[v.code]?.trim()) {
        nouvellesErreurs[v.code] = `${v.libelle} est obligatoire.`;
      }
    });
    setErreurs(nouvellesErreurs);
    return Object.keys(nouvellesErreurs).length === 0;
  }

  async function generer() {
    if (!modeleSelectionne || !validerVariables()) return;
    setErreurGlobale(null);
    try {
      const doc = await mutation.mutateAsync({
        modele_id: modeleSelectionne.id,
        projet_id: projetId,
        variables,
      });
      setDocumentCree(doc);
      setEtape("succes");
      onDocumentCree?.(doc);
    } catch (err) {
      setErreurGlobale(err instanceof ErreurApi ? err.detail : "Erreur lors de la génération.");
    }
  }

  async function ouvrirDansCollabora() {
    if (!documentCree) return;
    try {
      const session = await api.post<{ url_editeur: string }>(
        `/api/documents/${documentCree.id}/session-bureautique/`, {}
      );
      window.open(session.url_editeur, "_blank", "noopener,noreferrer");
    } catch {
      // Ouvrir la page du document comme fallback
      window.open(`/projets/${projetId}/documents/${documentCree.id}`, "_blank");
    }
  }

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-40 backdrop-blur-sm" style={{ background: "rgba(0,0,0,0.5)" }} onClick={onFermer} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="relative w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col"
          style={{ background: "var(--fond-app)", border: "1px solid var(--bordure)", maxHeight: "calc(100vh - 2rem)" }}
        >
          {/* En-tête */}
          <div
            className="flex items-center justify-between gap-3 px-6 py-4 shrink-0"
            style={{ background: "var(--fond-carte)", borderBottom: "1px solid var(--bordure)" }}
          >
            <div className="flex items-center gap-2">
              <Sparkles size={18} style={{ color: "var(--c-base)" }} />
              <div>
                <h2 className="text-base font-bold" style={{ color: "var(--texte)" }}>
                  Générer un document
                </h2>
                <p className="text-xs" style={{ color: "var(--texte-2)" }}>
                  {etape === "selection" && "Choisissez un modèle paramétré"}
                  {etape === "parametres" && `Paramétrer : ${modeleSelectionne?.libelle}`}
                  {etape === "succes" && "Document créé avec succès"}
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

            {/* ── Sélection du modèle ── */}
            {etape === "selection" && (
              <div className="space-y-5">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12 gap-2" style={{ color: "var(--texte-3)" }}>
                    <Loader2 size={18} className="animate-spin" />
                    <span className="text-sm">Chargement des modèles…</span>
                  </div>
                ) : modeles.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                    <FileText size={32} style={{ color: "var(--texte-3)" }} />
                    <div>
                      <p className="text-sm font-medium" style={{ color: "var(--texte-2)" }}>
                        Aucun modèle configuré
                      </p>
                      <p className="text-xs mt-1" style={{ color: "var(--texte-3)" }}>
                        Ajoutez des modèles depuis l&apos;espace d&apos;administration.
                      </p>
                    </div>
                  </div>
                ) : (
                  Object.entries(groupes).map(([groupe, items]) => (
                    <div key={groupe}>
                      <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: "var(--texte-3)" }}>
                        {groupe}
                      </p>
                      <div className="space-y-2">
                        {items.map((modele) => (
                          <button
                            key={modele.id}
                            type="button"
                            onClick={() => selectionnerModele(modele)}
                            className="w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-all hover:border-[color:var(--c-base)] hover:shadow-sm group"
                            style={{ background: "var(--fond-carte)", borderColor: "var(--bordure)" }}
                          >
                            <div
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                              style={{ background: "var(--fond-entree)" }}
                            >
                              <IconeFormat format={modele.format_sortie} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold truncate" style={{ color: "var(--texte)" }}>
                                {modele.libelle}
                              </p>
                              <p className="text-xs truncate" style={{ color: "var(--texte-3)" }}>
                                {modele.description || modele.type_modele_libelle} · .{modele.format_sortie}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {modele.variables_parametrables.length > 0 && (
                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                                  style={{ background: "var(--fond-entree)", color: "var(--texte-3)" }}>
                                  {modele.variables_parametrables.length} var.
                                </span>
                              )}
                              <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" style={{ color: "var(--texte-3)" }} />
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ── Paramétrage ── */}
            {etape === "parametres" && modeleSelectionne && (
              <div className="space-y-5">
                {/* Info modèle */}
                <div
                  className="flex items-center gap-3 rounded-xl p-3"
                  style={{ background: "var(--fond-entree)", border: "1px solid var(--bordure)" }}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "var(--fond-carte)" }}>
                    <IconeFormat format={modeleSelectionne.format_sortie} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "var(--texte)" }}>{modeleSelectionne.libelle}</p>
                    <p className="text-xs" style={{ color: "var(--texte-3)" }}>Format de sortie : .{modeleSelectionne.format_sortie}</p>
                  </div>
                </div>

                {modeleSelectionne.variables_parametrables.length === 0 ? (
                  <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-xs"
                    style={{ background: "var(--fond-entree)", border: "1px solid var(--bordure)", color: "var(--texte-2)" }}>
                    Ce modèle ne nécessite aucune variable. Cliquez sur Générer.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {modeleSelectionne.variables_parametrables.map((v) => (
                      <div key={v.code}>
                        <label className="libelle-champ" htmlFor={`var-${v.code}`}>
                          {v.libelle}
                          {v.obligatoire && " *"}
                        </label>
                        {v.type === "liste" && v.options ? (
                          <select
                            id={`var-${v.code}`}
                            className="champ-saisie mt-1"
                            value={variables[v.code] ?? ""}
                            onChange={(e) => setVariables((prev) => ({ ...prev, [v.code]: e.target.value }))}
                          >
                            <option value="">— Choisir —</option>
                            {v.options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                        ) : v.type === "date" ? (
                          <input
                            id={`var-${v.code}`}
                            type="date"
                            className="champ-saisie mt-1"
                            value={variables[v.code] ?? ""}
                            onChange={(e) => setVariables((prev) => ({ ...prev, [v.code]: e.target.value }))}
                          />
                        ) : v.type === "booleen" ? (
                          <div className="mt-1 flex gap-3">
                            {["Oui", "Non"].map((opt) => (
                              <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: "var(--texte)" }}>
                                <input
                                  type="radio"
                                  name={`var-${v.code}`}
                                  value={opt}
                                  checked={variables[v.code] === opt}
                                  onChange={() => setVariables((prev) => ({ ...prev, [v.code]: opt }))}
                                />
                                {opt}
                              </label>
                            ))}
                          </div>
                        ) : (
                          <input
                            id={`var-${v.code}`}
                            type={v.type === "nombre" ? "number" : "text"}
                            className="champ-saisie mt-1"
                            value={variables[v.code] ?? ""}
                            onChange={(e) => setVariables((prev) => ({ ...prev, [v.code]: e.target.value }))}
                            placeholder={v.placeholder}
                          />
                        )}
                        {erreurs[v.code] && <p className="mt-1 text-xs text-red-500">{erreurs[v.code]}</p>}
                      </div>
                    ))}
                  </div>
                )}

                {erreurGlobale && (
                  <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs text-red-500"
                    style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.3)" }}>
                    <AlertCircle size={13} />
                    {erreurGlobale}
                  </div>
                )}
              </div>
            )}

            {/* ── Succès ── */}
            {etape === "succes" && documentCree && (
              <div className="flex flex-col items-center justify-center py-8 gap-5 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500">
                  <CheckCircle2 size={28} className="text-white" />
                </div>
                <div>
                  <p className="text-base font-bold" style={{ color: "var(--texte)" }}>Document créé !</p>
                  <p className="text-sm mt-1" style={{ color: "var(--texte-2)" }}>
                    {documentCree.reference} — {documentCree.intitule}
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={ouvrirDansCollabora}
                    className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90"
                    style={{ background: "var(--c-base)" }}
                  >
                    <Play size={14} />
                    Ouvrir et éditer
                    <ExternalLink size={12} />
                  </button>
                  <button type="button" onClick={onFermer}
                    className="rounded-xl border px-5 py-2.5 text-sm font-medium transition-all"
                    style={{ borderColor: "var(--bordure)", background: "var(--fond-carte)", color: "var(--texte)" }}>
                    Fermer
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Pied */}
          {etape !== "succes" && (
            <div
              className="flex items-center justify-between gap-3 px-6 py-4 shrink-0"
              style={{ background: "var(--fond-carte)", borderTop: "1px solid var(--bordure)" }}
            >
              {etape === "parametres" ? (
                <>
                  <button
                    type="button"
                    onClick={() => { setEtape("selection"); setErreurGlobale(null); }}
                    className="rounded-xl border px-4 py-2.5 text-sm font-medium transition-all"
                    style={{ borderColor: "var(--bordure)", background: "var(--fond-carte)", color: "var(--texte)" }}
                  >
                    Retour
                  </button>
                  <button
                    type="button"
                    onClick={generer}
                    disabled={mutation.isPending}
                    className="flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold text-white transition-all disabled:opacity-50 hover:opacity-90"
                    style={{ background: "var(--c-base)" }}
                  >
                    {mutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    Générer le document
                  </button>
                </>
              ) : (
                <button type="button" onClick={onFermer}
                  className="ml-auto rounded-xl border px-4 py-2.5 text-sm font-medium"
                  style={{ borderColor: "var(--bordure)", background: "var(--fond-carte)", color: "var(--texte)" }}>
                  Annuler
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
