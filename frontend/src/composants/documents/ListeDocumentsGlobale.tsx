"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { api, extraireListeResultats, requeteApiAvecProgression, type ProgressionTeleversement, ErreurApi } from "@/crochets/useApi";
import { useSessionStore } from "@/crochets/useSession";
import {
  FileText, Upload, Search, Plus, Eye, Archive, X,
  CheckCircle, AlertCircle, FileUp, RefreshCw,
  Clock, Send, Shield, ScanText,
} from "lucide-react";
import { EtatTeleversement } from "@/composants/ui/EtatTeleversement";
import { ApercuFichierModal } from "@/composants/ui/ApercuFichierModal";

interface TypeDocument {
  id: string;
  code: string;
  libelle: string;
}

interface Projet {
  id: string;
  reference: string;
  intitule: string;
}

interface Document {
  id: string;
  reference: string;
  intitule: string;
  type_document: string;
  type_libelle: string;
  projet: string | null;
  projet_reference: string | null;
  version: string;
  statut: string;
  statut_libelle: string;
  taille_octets: number | null;
  type_mime: string;
  fichier: string | null;
  nom_fichier_origine: string;
  auteur_nom: string | null;
  date_modification: string;
  ocr_effectue: boolean;
  analyse_automatique_effectuee: boolean;
  date_analyse_automatique: string | null;
  suggestions_classement?: {
    type_document?: {
      code: string;
      libelle: string;
      score: number;
      applicable: boolean;
    };
    projet?: {
      id: string;
      reference: string;
      intitule: string;
      score: number;
      applicable: boolean;
    };
  };
}

interface PageResultats {
  count?: number;
  next?: string | null;
  results?: Document[];
}

interface ApercuSuggestionDocument {
  id: string;
  reference: string;
  intitule: string;
  actuel: {
    type_document: { code: string; libelle: string };
    projet: { id: string | null; reference: string; intitule: string };
  };
  suggere: {
    type_document?: { libelle: string; score: number; applicable: boolean };
    projet?: { reference: string; intitule: string; score: number; applicable: boolean };
  };
  changements: string[];
}

function ModalImportArchive({
  projets,
  projetId,
  onClose,
  onSuccess,
}: {
  projets: Projet[];
  projetId?: string;
  onClose: () => void;
  onSuccess: (message: string) => void;
}) {
  const [fichier, setFichier] = useState<File | null>(null);
  const [projet, setProjet] = useState(projetId || (projets.length === 1 ? projets[0]?.id ?? "" : ""));
  const [chargement, setChargement] = useState(false);
  const [progression, setProgression] = useState<ProgressionTeleversement | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (projetId) {
      setProjet(projetId);
      return;
    }
    if (!projet && projets.length === 1) {
      setProjet(projets[0].id);
    }
  }, [projet, projetId, projets]);

  const importer = async () => {
    if (!fichier) {
      setErreur("Sélectionne une archive ZIP.");
      return;
    }
    setChargement(true);
    setErreur(null);
    try {
      const formData = new FormData();
      formData.append("fichier", fichier);
      if (projet) formData.append("projet", projet);
      const reponse = await requeteApiAvecProgression("/api/documents/importer-archive/", {
        method: "POST",
        corps: formData,
        onProgression: setProgression,
      }) as { importes: number; erreurs: { fichier: string; detail: string }[] };
      if (reponse.importes === 0 && reponse.erreurs?.length) {
        setErreur(reponse.erreurs.map((item) => `${item.fichier} : ${item.detail}`).join(" | "));
        return;
      }
      const message = reponse.erreurs?.length
        ? `${reponse.importes} document(s) importé(s), ${reponse.erreurs.length} erreur(s).`
        : `${reponse.importes} document(s) importé(s) depuis l’archive.`;
      onSuccess(message);
      onClose();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Impossible d'importer l'archive.");
    } finally {
      setChargement(false);
      setTimeout(() => setProgression(null), 400);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="font-semibold text-slate-800">Importer une archive</h2>
            <p className="mt-1 text-sm text-slate-500">Extraction ZIP, classement automatique, détection du projet et création des versions.</p>
          </div>
          <button onClick={onClose}><X className="h-5 w-5 text-slate-400" /></button>
        </div>

        <div className="space-y-4 p-6">
          {erreur && (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />{erreur}
            </div>
          )}
          <EtatTeleversement progression={progression} libelle="Import de l’archive" />
          <div
            onClick={() => inputRef.current?.click()}
            className={`cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition-colors ${fichier ? "border-emerald-400 bg-emerald-50" : "border-slate-300 hover:border-primaire-300 hover:bg-slate-50"}`}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".zip,application/zip"
              className="hidden"
              onChange={(event) => setFichier(event.target.files?.[0] || null)}
            />
            {fichier ? (
              <>
                <FileUp className="mx-auto mb-2 h-8 w-8 text-emerald-600" />
                <p className="text-sm font-medium text-emerald-800">{fichier.name}</p>
                <p className="text-xs text-emerald-700">{formatTaille(fichier.size)}</p>
              </>
            ) : (
              <>
                <Upload className="mx-auto mb-2 h-8 w-8 text-slate-400" />
                <p className="text-sm font-medium text-slate-700">Choisir une archive ZIP</p>
                <p className="text-xs text-slate-400">Les fichiers seront extraits et analysés automatiquement.</p>
              </>
            )}
          </div>
          {!projetId && (
            <div>
              <label className="libelle-champ">Projet par défaut</label>
              <select className="champ-saisie w-full bg-white" value={projet} onChange={(event) => setProjet(event.target.value)}>
                <option value="">Détection automatique si possible</option>
                {projets.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.reference} — {item.intitule}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 rounded-b-2xl border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button onClick={onClose} className="btn-secondaire">Annuler</button>
          <button onClick={importer} disabled={chargement} className="btn-primaire disabled:opacity-50">
            {chargement ? "Import…" : "Importer l’archive"}
          </button>
        </div>
      </div>
    </div>
  );
}

const STATUTS: Record<string, { libelle: string; classe: string }> = {
  brouillon:     { libelle: "Brouillon",     classe: "badge-neutre" },
  en_revision:   { libelle: "En révision",   classe: "bg-yellow-100 text-yellow-700 border border-yellow-200" },
  en_validation: { libelle: "En validation", classe: "bg-orange-100 text-orange-700 border border-orange-200" },
  valide:        { libelle: "Validé",        classe: "badge-succes" },
  diffuse:       { libelle: "Diffusé",       classe: "bg-blue-100 text-blue-700 border border-blue-200" },
  obsolete:      { libelle: "Obsolète",      classe: "bg-slate-100 text-slate-500 border border-slate-200" },
  archive:       { libelle: "Archivé",       classe: "badge-danger" },
};

function formatTaille(octets: number | null): string {
  if (!octets) return "—";
  if (octets < 1024) return `${octets} o`;
  if (octets < 1024 * 1024) return `${(octets / 1024).toFixed(0)} Ko`;
  return `${(octets / (1024 * 1024)).toFixed(1)} Mo`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

// ─── Modal d'ajout ───────────────────────────────────────────────────────────

function ModalAjout({
  types,
  projets,
  projetId,
  onClose,
  onSuccess,
}: {
  types: TypeDocument[];
  projets: Projet[];
  projetId?: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [fichier, setFichier] = useState<File | null>(null);
  const [glisser, setGlisser] = useState(false);
  const [form, setForm] = useState({
    intitule: "",
    reference: "",
    projet: projetId || (projets.length === 1 ? projets[0]?.id ?? "" : ""),
    type_document: "",
    version: "A",
    origine: "interne",
    confidentiel: false,
  });
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [progression, setProgression] = useState<ProgressionTeleversement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const maj = (k: keyof typeof form, v: string | boolean) =>
    setForm(p => ({ ...p, [k]: v }));

  useEffect(() => {
    if (projetId) {
      setForm((precedent) => ({ ...precedent, projet: projetId }));
      return;
    }
    if (!form.projet && projets.length === 1) {
      setForm((precedent) => ({ ...precedent, projet: projets[0].id }));
    }
  }, [form.projet, projetId, projets]);

  const choisirFichier = (f: File) => {
    setFichier(f);
    if (!form.intitule) {
      maj("intitule", f.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "));
    }
  };

  const soumettre = async () => {
    if (!fichier) { setErreur("Veuillez sélectionner un fichier."); return; }
    if (!form.intitule.trim()) { setErreur("L'intitulé est requis."); return; }
    if (!form.reference.trim()) { setErreur("La référence est requise."); return; }
    setChargement(true);
    setErreur(null);
    setProgression(null);
    try {
      const fd = new FormData();
      fd.append("fichier", fichier);
      fd.append("intitule", form.intitule);
      fd.append("reference", form.reference);
      if (form.projet) fd.append("projet", form.projet);
      if (form.type_document) fd.append("type_document", form.type_document);
      fd.append("version", form.version);
      fd.append("origine", form.origine);
      fd.append("confidentiel", String(form.confidentiel));
      await requeteApiAvecProgression("/api/documents/", {
        method: "POST",
        corps: fd,
        onProgression: setProgression,
      });
      onSuccess();
      onClose();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Erreur lors de l'envoi.");
    } finally {
      setChargement(false);
      setTimeout(() => setProgression(null), 400);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-800">Ajouter un document</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>

        <div className="p-6 space-y-4">
          {erreur && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />{erreur}
            </div>
          )}

          <EtatTeleversement
            progression={progression}
            libelle="Téléversement du document"
          />

          {/* Zone de dépôt */}
          <div
            onDragOver={e => { e.preventDefault(); setGlisser(true); }}
            onDragLeave={() => setGlisser(false)}
            onDrop={e => {
              e.preventDefault(); setGlisser(false);
              const f = e.dataTransfer.files[0];
              if (f) choisirFichier(f);
            }}
            onClick={() => inputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
              glisser
                ? "border-primaire-400 bg-primaire-50"
                : fichier
                ? "border-green-400 bg-green-50"
                : "border-slate-300 hover:border-primaire-300 hover:bg-slate-50"
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) choisirFichier(f); }}
            />
            {fichier ? (
              <div className="flex items-center justify-center gap-3">
                <FileUp className="w-6 h-6 text-green-600 shrink-0" />
                <div className="text-left">
                  <p className="font-medium text-green-800 text-sm">{fichier.name}</p>
                  <p className="text-xs text-green-600">{formatTaille(fichier.size)}</p>
                </div>
              </div>
            ) : (
              <>
                <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-sm text-slate-600 font-medium">Glisser-déposer ou cliquer pour choisir</p>
                <p className="text-xs text-slate-400 mt-1">PDF, Word, Excel, images — 100 Mo max</p>
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {!projetId && (
              <div className="col-span-2">
                <label className="libelle-champ">Projet</label>
                <select className="champ-saisie w-full bg-white" value={form.projet}
                  onChange={e => maj("projet", e.target.value)}>
                  <option value="">Détection automatique si possible</option>
                  {projets.map(projet => (
                    <option key={projet.id} value={projet.id}>
                      {projet.reference} — {projet.intitule}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-400">
                  Si la référence projet est détectée dans le nom du fichier ou dans la référence document, le classement peut être proposé automatiquement.
                </p>
              </div>
            )}
            <div>
              <label className="libelle-champ">Référence <span className="text-red-500">*</span></label>
              <input type="text" className="champ-saisie w-full" placeholder="DOC-2025-001"
                value={form.reference} onChange={e => maj("reference", e.target.value)} />
            </div>
            <div>
              <label className="libelle-champ">Indice</label>
              <input type="text" className="champ-saisie w-full" placeholder="A"
                value={form.version} onChange={e => maj("version", e.target.value)} maxLength={5} />
            </div>
          </div>

          <div>
            <label className="libelle-champ">Intitulé <span className="text-red-500">*</span></label>
            <input type="text" className="champ-saisie w-full" placeholder="Note de calcul — fondations"
              value={form.intitule} onChange={e => maj("intitule", e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="libelle-champ">Type</label>
              <select className="champ-saisie w-full bg-white" value={form.type_document}
                onChange={e => maj("type_document", e.target.value)}>
                <option value="">Détection automatique</option>
                {types.map(t => <option key={t.id} value={t.id}>{t.libelle}</option>)}
              </select>
              <p className="mt-1 text-xs text-slate-400">Laisse vide pour laisser la plateforme détecter la nature du document.</p>
            </div>
            <div>
              <label className="libelle-champ">Origine</label>
              <select className="champ-saisie w-full bg-white" value={form.origine}
                onChange={e => maj("origine", e.target.value)}>
                <option value="interne">Produit en interne</option>
                <option value="recu">Reçu de l&apos;extérieur</option>
                <option value="ocr">Numérisé via OCR</option>
              </select>
            </div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 rounded text-primaire-600"
              checked={form.confidentiel} onChange={e => maj("confidentiel", e.target.checked)} />
            <span className="text-sm font-medium text-slate-700">Document confidentiel</span>
          </label>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
          <button onClick={onClose} className="btn-secondaire">Annuler</button>
          <button onClick={soumettre} disabled={chargement} className="btn-primaire disabled:opacity-60">
            {chargement ? "Envoi en cours…" : <><Upload className="w-4 h-4" />Envoyer</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalPrevisualisationSuggestions({
  apercus,
  chargement,
  onFermer,
  onConfirmer,
}: {
  apercus: ApercuSuggestionDocument[];
  chargement: boolean;
  onFermer: () => void;
  onConfirmer: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="font-semibold text-slate-800">Prévisualisation du reclassement</h2>
            <p className="mt-1 text-sm text-slate-500">Vérifie les changements proposés avant application en masse.</p>
          </div>
          <button onClick={onFermer}><X className="h-5 w-5 text-slate-400" /></button>
        </div>

        <div className="max-h-[65vh] overflow-y-auto p-6 space-y-4">
          {apercus.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
              Aucun changement applicable sur la sélection.
            </div>
          ) : (
            apercus.map((apercu) => (
              <div key={apercu.id} className="rounded-2xl border border-slate-200 p-5 space-y-3">
                <div>
                  <p className="font-mono text-xs font-semibold text-primaire-700">{apercu.reference}</p>
                  <h3 className="font-semibold text-slate-800">{apercu.intitule}</h3>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 text-sm">
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-wider text-slate-400">Actuel</p>
                    <p className="mt-2 text-slate-700">Type : {apercu.actuel.type_document.libelle || "—"}</p>
                    <p className="text-slate-700">Projet : {apercu.actuel.projet.reference || "—"}</p>
                  </div>
                  <div className="rounded-xl bg-amber-50 p-4">
                    <p className="text-xs uppercase tracking-wider text-amber-700">Suggéré</p>
                    <p className="mt-2 text-slate-700">
                      Type : {apercu.suggere.type_document?.libelle || "—"}
                    </p>
                    <p className="text-slate-700">
                      Projet : {apercu.suggere.projet?.reference || "—"}
                    </p>
                  </div>
                </div>
                <div className="space-y-1">
                  {apercu.changements.map((changement) => (
                    <p key={changement} className="text-sm text-amber-800">
                      {changement}
                    </p>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button onClick={onFermer} className="btn-secondaire">Fermer</button>
          <button onClick={onConfirmer} disabled={chargement || apercus.length === 0} className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50">
            {chargement ? "Application…" : "Confirmer le reclassement"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

interface Props {
  projetId?: string;
}

export function ListeDocumentsGlobale({ projetId }: Props) {
  const utilisateur = useSessionStore((etat) => etat.utilisateur);
  const estSuperAdmin = Boolean(utilisateur?.est_super_admin);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [total, setTotal] = useState(0);
  const [types, setTypes] = useState<TypeDocument[]>([]);
  const [projets, setProjets] = useState<Projet[]>([]);
  const [chargement, setChargement] = useState(true);
  const [recherche, setRecherche] = useState("");
  const [filtreStatut, setFiltreStatut] = useState("");
  const [filtreType, setFiltreType] = useState("");
  const [succes, setSucces] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [modal, setModal] = useState(false);
  const [modalArchive, setModalArchive] = useState(false);
  const [archivageId, setArchivageId] = useState<string | null>(null);
  const [ocrEnCours, setOcrEnCours] = useState<string | null>(null);
  const [analyseEnCours, setAnalyseEnCours] = useState<string | null>(null);
  const [applicationSuggestionsId, setApplicationSuggestionsId] = useState<string | null>(null);
  const [selectionSuggestions, setSelectionSuggestions] = useState<string[]>([]);
  const [applicationMasseEnCours, setApplicationMasseEnCours] = useState(false);
  const [apercuSuggestions, setApercuSuggestions] = useState<ApercuSuggestionDocument[]>([]);
  const [modalApercuOuvert, setModalApercuOuvert] = useState(false);
  const [chargementApercu, setChargementApercu] = useState(false);
  const [documentApercu, setDocumentApercu] = useState<Document | null>(null);

  const charger = useCallback(async () => {
    setChargement(true);
    try {
      const params = new URLSearchParams();
      if (recherche) params.set("search", recherche);
      if (filtreStatut) params.set("statut", filtreStatut);
      if (filtreType) params.set("type", filtreType);
      if (projetId) params.set("projet", projetId);

      const reponse = await api.get<Document[] | PageResultats>(`/api/documents/?${params}`);
      if (Array.isArray(reponse)) {
        setDocuments(reponse);
        setTotal(reponse.length);
      } else {
        setDocuments(reponse.results ?? []);
        setTotal(reponse.count ?? 0);
      }
    } catch {
      setErreur("Impossible de charger les documents.");
    } finally {
      setChargement(false);
    }
  }, [recherche, filtreStatut, filtreType, projetId]);

  useEffect(() => { charger(); }, [charger]);
  useEffect(() => {
    setSelectionSuggestions((precedent) =>
      precedent.filter((id) =>
        documents.some((doc) => doc.id === id && (doc.suggestions_classement?.type_document?.applicable || doc.suggestions_classement?.projet?.applicable))
      )
    );
  }, [documents]);
  useEffect(() => {
    api.get<TypeDocument[]>("/api/documents/types/").then((data) => setTypes(extraireListeResultats(data))).catch(() => {});
  }, []);
  useEffect(() => {
    if (projetId) return;
    api.get<Projet[]>("/api/projets/").then((data) => setProjets(extraireListeResultats(data))).catch(() => {});
  }, [projetId]);

  const flash = (msg: string) => {
    setSucces(msg);
    setTimeout(() => setSucces(null), 3500);
  };

  const archiver = async (id: string) => {
    try {
      await api.supprimer(`/api/documents/${id}/`);
      flash(estSuperAdmin ? "Document supprimé définitivement." : "Document archivé.");
      setArchivageId(null);
      charger();
    } catch {
      setErreur(estSuperAdmin ? "Impossible de supprimer le document." : "Impossible d'archiver le document.");
    }
  };

  const lancerOcr = async (id: string) => {
    setOcrEnCours(id);
    try {
      const res = await api.post<{ detail: string; pages: number; confiance: number }>(`/api/documents/${id}/ocr/`, {});
      flash(`OCR terminé — ${res.pages} page(s), confiance ${res.confiance}%`);
      charger();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Erreur OCR.");
    } finally {
      setOcrEnCours(null);
    }
  };

  const lancerAnalyse = async (id: string) => {
    setAnalyseEnCours(id);
    try {
      await api.post(`/api/documents/${id}/analyser/`, {});
      flash("Analyse documentaire terminée.");
      charger();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Erreur d'analyse.");
    } finally {
      setAnalyseEnCours(null);
    }
  };

  const appliquerSuggestions = async (id: string) => {
    setApplicationSuggestionsId(id);
    try {
      const reponse = await api.post<{ detail: string }>(`/api/documents/${id}/appliquer-suggestions/`, {});
      flash(reponse.detail);
      charger();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Impossible d'appliquer les suggestions.");
    } finally {
      setApplicationSuggestionsId(null);
    }
  };

  const appliquerSuggestionsSelection = async () => {
    if (!selectionSuggestions.length) return;
    setApplicationMasseEnCours(true);
    try {
      const reponse = await api.post<{ detail: string }>(
        "/api/documents/appliquer-suggestions/",
        { ids: selectionSuggestions }
      );
      flash(reponse.detail);
      setSelectionSuggestions([]);
      charger();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Impossible d'appliquer les suggestions sélectionnées.");
    } finally {
      setApplicationMasseEnCours(false);
    }
  };

  const ouvrirPrevisualisationSuggestions = async () => {
    if (!selectionSuggestions.length) return;
    setChargementApercu(true);
    try {
      const reponse = await api.post<{ details: ApercuSuggestionDocument[] }>(
        "/api/documents/previsualiser-suggestions/",
        { ids: selectionSuggestions }
      );
      setApercuSuggestions((reponse.details || []).filter((item) => item.changements.length > 0));
      setModalApercuOuvert(true);
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Impossible de prévisualiser les suggestions.");
    } finally {
      setChargementApercu(false);
    }
  };

  const basculerSelection = (id: string, actif: boolean) => {
    setSelectionSuggestions((precedent) =>
      actif ? [...new Set([...precedent, id])] : precedent.filter((element) => element !== id)
    );
  };

  const typesMimeOcr = new Set(["application/pdf", "image/png", "image/jpeg", "image/tiff", "image/bmp", "image/webp"]);

  return (
    <div className="space-y-4">
      {/* En-tête */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-slate-500 text-sm">{total} document{total !== 1 ? "s" : ""}</p>
        <div className="flex items-center gap-2">
          <button onClick={() => setModalArchive(true)} className="btn-secondaire">
            <FileUp className="w-4 h-4" />Importer une archive
          </button>
          <button onClick={() => setModal(true)} className="btn-primaire">
            <Plus className="w-4 h-4" />Ajouter
          </button>
        </div>
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

      {selectionSuggestions.length > 0 && (
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-amber-900">
              {selectionSuggestions.length} document{selectionSuggestions.length > 1 ? "s" : ""} sélectionné{selectionSuggestions.length > 1 ? "s" : ""}
            </p>
            <p className="text-xs text-amber-700">Validation prête pour application en masse des suggestions de reclassement.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectionSuggestions([])}
              className="btn-secondaire text-xs"
            >
              Effacer
            </button>
            <button
              onClick={ouvrirPrevisualisationSuggestions}
              disabled={chargementApercu || applicationMasseEnCours}
              className="btn-secondaire text-xs disabled:opacity-50"
            >
              {chargementApercu ? "Prévisualisation…" : "Prévisualiser"}
            </button>
            <button
              onClick={appliquerSuggestionsSelection}
              disabled={applicationMasseEnCours}
              className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {applicationMasseEnCours ? "Application…" : "Appliquer en masse"}
            </button>
          </div>
        </div>
      )}

      {/* Filtres */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="search"
            className="champ-saisie pl-9 w-full"
            placeholder="Référence, intitulé, contenu…"
            value={recherche}
            onChange={e => setRecherche(e.target.value)}
          />
        </div>
        <select className="champ-saisie w-auto bg-white" value={filtreStatut}
          onChange={e => setFiltreStatut(e.target.value)}>
          <option value="">Tous les statuts</option>
          {Object.entries(STATUTS).map(([val, { libelle }]) => (
            <option key={val} value={val}>{libelle}</option>
          ))}
        </select>
        <select className="champ-saisie w-auto bg-white" value={filtreType}
          onChange={e => setFiltreType(e.target.value)}>
          <option value="">Tous les types</option>
          {types.map(t => <option key={t.code} value={t.code}>{t.libelle}</option>)}
        </select>
        <button onClick={charger} className="btn-secondaire" title="Actualiser">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Tableau */}
      <div className="carte overflow-hidden">
        {chargement ? (
          <div className="py-12 text-center text-slate-400 text-sm">Chargement…</div>
        ) : documents.length === 0 ? (
          <div className="py-12 text-center">
            <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">Aucun document trouvé</p>
            <p className="text-slate-400 text-sm mt-1">
              {recherche || filtreStatut || filtreType
                ? "Aucun document ne correspond aux filtres."
                : "Ajoutez votre premier document avec le bouton ci-dessus."}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-4 py-3 w-10"></th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Référence</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Intitulé</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider hidden sm:table-cell">Type</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider hidden md:table-cell">Statut</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider hidden lg:table-cell">Taille</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider hidden lg:table-cell">Modifié</th>
                <th className="px-4 py-3 w-28"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {documents.map(doc => {
                const statut = STATUTS[doc.statut] ?? { libelle: doc.statut_libelle, classe: "badge-neutre" };
                const peutOcr = !doc.ocr_effectue && doc.type_mime && typesMimeOcr.has(doc.type_mime);
                const suggestionType = doc.suggestions_classement?.type_document;
                const suggestionProjet = doc.suggestions_classement?.projet;
                const suggestionsApplicables = Boolean(suggestionType?.applicable || suggestionProjet?.applicable);
                return (
                  <tr key={doc.id} className="hover:bg-slate-50 group">
                    <td className="px-4 py-3">
                      {suggestionsApplicables && (
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 text-primaire-600"
                          checked={selectionSuggestions.includes(doc.id)}
                          onChange={(e) => basculerSelection(doc.id, e.target.checked)}
                          aria-label={`Sélectionner ${doc.reference}`}
                        />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-medium text-primaire-700 bg-primaire-50 px-2 py-0.5 rounded">
                          {doc.reference}
                        </span>
                        <span className="text-xs text-slate-400">v{doc.version}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                          href={`/documents/${doc.id}`}
                          className="font-medium text-slate-800 hover:text-primaire-600 line-clamp-1 transition-colors"
                        >
                        {doc.intitule}
                      </Link>
                      {doc.projet_reference && (
                        <p className="text-xs text-slate-400 mt-0.5">{doc.projet_reference}</p>
                      )}
                      {doc.auteur_nom && (
                        <p className="text-xs text-slate-400">{doc.auteur_nom}</p>
                      )}
                      {doc.analyse_automatique_effectuee && (
                        <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 border border-emerald-200">
                          Analyse automatique
                        </span>
                      )}
                      {suggestionProjet?.applicable && (
                        <p className="mt-1 text-xs text-amber-700">
                          Projet suggéré : {suggestionProjet.reference}
                        </p>
                      )}
                      {suggestionType?.applicable && (
                        <p className="text-xs text-amber-700">
                          Type suggéré : {suggestionType.libelle}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="text-xs text-slate-600">{doc.type_libelle}</span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${statut.classe}`}>
                        {statut.libelle}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-xs text-slate-400 text-right">
                      {formatTaille(doc.taille_octets)}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-xs text-slate-400 text-right">
                      {formatDate(doc.date_modification)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                        {doc.fichier ? (
                          <button
                            type="button"
                            onClick={() => setDocumentApercu(doc)}
                            className="p-1.5 rounded text-slate-400 hover:text-primaire-600 hover:bg-primaire-50"
                            title="Prévisualiser le fichier"
                            aria-label="Prévisualiser le fichier"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        ) : (
                          <Link
                            href={`/documents/${doc.id}`}
                            className="p-1.5 rounded text-slate-400 hover:text-primaire-600 hover:bg-primaire-50"
                            title="Ouvrir la fiche"
                            aria-label="Ouvrir la fiche"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
                        )}
                        {peutOcr && (
                          <button
                            onClick={() => lancerOcr(doc.id)}
                            disabled={ocrEnCours === doc.id}
                            className="p-1.5 rounded text-slate-400 hover:text-accent-600 hover:bg-accent-50 disabled:opacity-50"
                            title="Lancer l'OCR"
                          >
                            <ScanText className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => lancerAnalyse(doc.id)}
                          disabled={analyseEnCours === doc.id}
                          className="p-1.5 rounded text-slate-400 hover:text-primaire-600 hover:bg-primaire-50 disabled:opacity-50"
                          title="Relancer l'analyse documentaire"
                        >
                          <RefreshCw className={`w-4 h-4 ${analyseEnCours === doc.id ? "animate-spin" : ""}`} />
                        </button>
                        {suggestionsApplicables && (
                          <button
                            onClick={() => appliquerSuggestions(doc.id)}
                            disabled={applicationSuggestionsId === doc.id}
                            className="rounded px-2 py-1 text-[11px] font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 disabled:opacity-50"
                            title="Appliquer les suggestions de reclassement"
                          >
                            {applicationSuggestionsId === doc.id ? "Application…" : "Reclasser"}
                          </button>
                        )}
                        {archivageId === doc.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => archiver(doc.id)}
                              className="text-xs text-red-600 hover:text-red-800 font-medium px-1.5 py-1 rounded hover:bg-red-50"
                            >
                              {estSuperAdmin ? "Supprimer" : "Archiver"}
                            </button>
                            <button
                              onClick={() => setArchivageId(null)}
                              className="text-xs text-slate-500 px-1 py-1 rounded hover:bg-slate-100"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setArchivageId(doc.id)}
                            className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"
                            title={estSuperAdmin ? "Supprimer" : "Archiver"}
                          >
                            <Archive className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <ModalAjout
          types={types}
          projets={projets}
          projetId={projetId}
          onClose={() => setModal(false)}
          onSuccess={() => { flash("Document ajouté avec succès."); charger(); }}
        />
      )}

      {modalArchive && (
        <ModalImportArchive
          projets={projets}
          projetId={projetId}
          onClose={() => setModalArchive(false)}
          onSuccess={(message) => { flash(message); charger(); }}
        />
      )}

      <ApercuFichierModal
        ouvert={Boolean(documentApercu)}
        onFermer={() => setDocumentApercu(null)}
        url={documentApercu?.fichier}
        typeMime={documentApercu?.type_mime}
        nomFichier={documentApercu?.nom_fichier_origine || documentApercu?.intitule}
      />

      {modalApercuOuvert && (
        <ModalPrevisualisationSuggestions
          apercus={apercuSuggestions}
          chargement={applicationMasseEnCours}
          onFermer={() => setModalApercuOuvert(false)}
          onConfirmer={async () => {
            await appliquerSuggestionsSelection();
            setModalApercuOuvert(false);
          }}
        />
      )}
    </div>
  );
}
