"use client";

import { useState, useEffect, use, useCallback, useRef } from "react";
import Link from "next/link";
import { api, ErreurApi, requeteApiAvecProgression, type ProgressionTeleversement } from "@/crochets/useApi";
import { OverlayTeleversement } from "@/composants/ui/EtatTeleversement";
import {
  ArrowLeft, Plus, Pencil, Trash2, CheckCircle,
  AlertCircle, X, Save, ChevronRight, Calculator,
  Ruler, MousePointer, Square, Minus as LineIcon, Hash, ScanLine, Upload, CheckSquare,
  MinusSquare, FunctionSquare,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types lignes de métré
// ---------------------------------------------------------------------------

interface LigneMetre {
  id: string;
  metre: string;
  numero_ordre: number;
  code_article: string;
  designation: string;
  nature: string;
  nature_libelle: string;
  quantite: number | null;
  unite: string;
  detail_calcul: string;
  observations: string;
  quantite_calculee?: number | null;
  apercu_calcul?: ApercuCalcul | null;
}

interface ApercuCalcul {
  detail_normalise: string;
  quantite_calculee: number;
  etapes: Array<{
    type: "variable" | "ligne";
    libelle: string;
    expression: string;
    valeur: number;
  }>;
  variables: Record<string, number>;
}

interface MetreDetail {
  id: string;
  projet: string;
  projet_reference: string;
  intitule: string;
  type_metre: string;
  type_libelle: string;
  statut: string;
  statut_libelle: string;
  lignes: LigneMetre[];
  date_modification: string;
}

const NATURES = [
  { val: "travaux", lib: "Travaux" },
  { val: "fourniture", lib: "Fourniture" },
  { val: "prestation", lib: "Prestation" },
  { val: "installation_chantier", lib: "Installation de chantier" },
  { val: "provision", lib: "Provision / réserve" },
];

const VIDE_LIGNE = {
  numero_ordre: "",
  code_article: "",
  designation: "",
  nature: "travaux",
  quantite: "",
  unite: "u",
  detail_calcul: "",
  observations: "",
};

// ---------------------------------------------------------------------------
// Formules géométriques — catalogue
// ---------------------------------------------------------------------------

interface FormuleGeo {
  id: string;
  libelle: string;
  categorie: string;
  variables: { nom: string; desc: string; unite?: string }[];
  formule: (vars: Record<string, number>) => number;
  expression: (vars: Record<string, number>) => string;
  unite_resultat: string;
}

const FORMULES: FormuleGeo[] = [
  {
    id: "rect_surface", libelle: "Rectangle — Surface", categorie: "Surfaces",
    variables: [
      { nom: "L", desc: "Longueur", unite: "m" },
      { nom: "l", desc: "Largeur", unite: "m" },
    ],
    formule: (v) => v.L * v.l,
    expression: (v) => `L = ${v.L}\nl = ${v.l}\nL × l`,
    unite_resultat: "m²",
  },
  {
    id: "rect_perimetre", libelle: "Rectangle — Périmètre", categorie: "Longueurs",
    variables: [
      { nom: "L", desc: "Longueur", unite: "m" },
      { nom: "l", desc: "Largeur", unite: "m" },
    ],
    formule: (v) => 2 * (v.L + v.l),
    expression: (v) => `L = ${v.L}\nl = ${v.l}\n2 × (L + l)`,
    unite_resultat: "ml",
  },
  {
    id: "cercle_surface", libelle: "Cercle — Surface", categorie: "Surfaces",
    variables: [{ nom: "R", desc: "Rayon", unite: "m" }],
    formule: (v) => Math.PI * v.R * v.R,
    expression: (v) => `R = ${v.R}\nπ × R²`,
    unite_resultat: "m²",
  },
  {
    id: "cercle_perimetre", libelle: "Cercle — Périmètre", categorie: "Longueurs",
    variables: [{ nom: "R", desc: "Rayon", unite: "m" }],
    formule: (v) => 2 * Math.PI * v.R,
    expression: (v) => `R = ${v.R}\n2 × π × R`,
    unite_resultat: "ml",
  },
  {
    id: "triangle_surface", libelle: "Triangle — Surface (base × hauteur)", categorie: "Surfaces",
    variables: [
      { nom: "b", desc: "Base", unite: "m" },
      { nom: "h", desc: "Hauteur", unite: "m" },
    ],
    formule: (v) => 0.5 * v.b * v.h,
    expression: (v) => `b = ${v.b}\nh = ${v.h}\nb × h / 2`,
    unite_resultat: "m²",
  },
  {
    id: "trapeze_surface", libelle: "Trapèze — Surface", categorie: "Surfaces",
    variables: [
      { nom: "a", desc: "Grande base", unite: "m" },
      { nom: "b", desc: "Petite base", unite: "m" },
      { nom: "h", desc: "Hauteur", unite: "m" },
    ],
    formule: (v) => 0.5 * (v.a + v.b) * v.h,
    expression: (v) => `a = ${v.a}\nb = ${v.b}\nh = ${v.h}\n(a + b) × h / 2`,
    unite_resultat: "m²",
  },
  {
    id: "mur_surface", libelle: "Mur — Surface brute (L × H)", categorie: "Surfaces",
    variables: [
      { nom: "L", desc: "Longueur", unite: "m" },
      { nom: "H", desc: "Hauteur", unite: "m" },
    ],
    formule: (v) => v.L * v.H,
    expression: (v) => `L = ${v.L}\nH = ${v.H}\nL × H`,
    unite_resultat: "m²",
  },
  {
    id: "ouverture_deduction", libelle: "Ouverture — Déduction (L × H)", categorie: "Déductions",
    variables: [
      { nom: "L", desc: "Largeur ouverture", unite: "m" },
      { nom: "H", desc: "Hauteur ouverture", unite: "m" },
      { nom: "nb", desc: "Nombre d'ouvertures", unite: "u" },
    ],
    formule: (v) => v.L * v.H * v.nb,
    expression: (v) => `L = ${v.L}\nH = ${v.H}\nnb = ${v.nb}\nL × H × nb`,
    unite_resultat: "m²",
  },
  {
    id: "volume_parallelepipede", libelle: "Parallélépipède — Volume", categorie: "Volumes",
    variables: [
      { nom: "L", desc: "Longueur", unite: "m" },
      { nom: "l", desc: "Largeur", unite: "m" },
      { nom: "H", desc: "Hauteur", unite: "m" },
    ],
    formule: (v) => v.L * v.l * v.H,
    expression: (v) => `L = ${v.L}\nl = ${v.l}\nH = ${v.H}\nL × l × H`,
    unite_resultat: "m³",
  },
  {
    id: "volume_cylindre", libelle: "Cylindre — Volume", categorie: "Volumes",
    variables: [
      { nom: "R", desc: "Rayon", unite: "m" },
      { nom: "H", desc: "Hauteur", unite: "m" },
    ],
    formule: (v) => Math.PI * v.R * v.R * v.H,
    expression: (v) => `R = ${v.R}\nH = ${v.H}\nπ × R² × H`,
    unite_resultat: "m³",
  },
];

const CATEGORIES_FORMULES = [...new Set(FORMULES.map((f) => f.categorie))];

// ---------------------------------------------------------------------------
// Modal formules géométriques
// ---------------------------------------------------------------------------

function ModalFormules({ onInserer, onFermer }: { onInserer: (texte: string, unite: string) => void; onFermer: () => void }) {
  const [categorieActive, setCategorieActive] = useState(CATEGORIES_FORMULES[0]);
  const [formuleActive, setFormuleActive] = useState<FormuleGeo>(FORMULES[0]);
  const [valeurs, setValeurs] = useState<Record<string, string>>({});
  const [resultat, setResultat] = useState<number | null>(null);

  const formulesCategorie = FORMULES.filter((f) => f.categorie === categorieActive);

  const selectionnerFormule = (f: FormuleGeo) => {
    setFormuleActive(f);
    setValeurs({});
    setResultat(null);
  };

  const calculer = () => {
    const numValeurs: Record<string, number> = {};
    for (const v of formuleActive.variables) {
      const n = parseFloat(valeurs[v.nom] ?? "");
      if (isNaN(n)) return;
      numValeurs[v.nom] = n;
    }
    setResultat(formuleActive.formule(numValeurs));
  };

  const inserer = () => {
    const numValeurs: Record<string, number> = {};
    for (const v of formuleActive.variables) {
      numValeurs[v.nom] = parseFloat(valeurs[v.nom] ?? "0") || 0;
    }
    onInserer(formuleActive.expression(numValeurs), formuleActive.unite_resultat);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-800 flex items-center gap-2">
            <FunctionSquare className="w-5 h-5 text-primaire-600" />
            Formules géométriques
          </h2>
          <button onClick={onFermer}><X className="w-5 h-5 text-slate-400" /></button>
        </div>

        <div className="flex h-full">
          {/* Sidebar catégories */}
          <div className="w-44 border-r border-slate-100 bg-slate-50 rounded-bl-2xl shrink-0">
            <div className="p-2 space-y-1">
              {CATEGORIES_FORMULES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => { setCategorieActive(cat); selectionnerFormule(FORMULES.find((f) => f.categorie === cat)!); }}
                  className={`w-full text-left text-sm px-3 py-2 rounded-lg transition ${
                    categorieActive === cat
                      ? "bg-primaire-100 text-primaire-700 font-medium"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 p-5 space-y-4">
            {/* Liste formules */}
            <div className="grid grid-cols-2 gap-2">
              {formulesCategorie.map((f) => (
                <button
                  key={f.id}
                  onClick={() => selectionnerFormule(f)}
                  className={`text-left text-sm px-3 py-2 rounded-xl border transition ${
                    formuleActive.id === f.id
                      ? "border-primaire-300 bg-primaire-50 text-primaire-700"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  {f.libelle}
                </button>
              ))}
            </div>

            {/* Variables */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Valeurs pour : {formuleActive.libelle}
              </p>
              <div className="grid grid-cols-2 gap-3">
                {formuleActive.variables.map((v) => (
                  <div key={v.nom}>
                    <label className="libelle-champ">
                      {v.nom} — {v.desc} {v.unite && <span className="text-slate-400">({v.unite})</span>}
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      className="champ-saisie w-full text-right"
                      value={valeurs[v.nom] ?? ""}
                      onChange={(e) => setValeurs((p) => ({ ...p, [v.nom]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Résultat */}
            {resultat !== null && (
              <div className="rounded-xl bg-blue-50 border border-blue-200 p-3">
                <p className="text-xs text-blue-600 font-medium">Résultat</p>
                <p className="text-xl font-bold text-blue-900 font-mono">
                  {resultat.toLocaleString("fr-FR", { maximumFractionDigits: 4 })} {formuleActive.unite_resultat}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
          <button onClick={onFermer} className="btn-secondaire">Annuler</button>
          <button onClick={calculer} className="btn-secondaire">
            <Calculator className="w-4 h-4" />Calculer
          </button>
          <button
            onClick={inserer}
            disabled={formuleActive.variables.some((v) => !valeurs[v.nom])}
            className="btn-primaire disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />Insérer dans le détail
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Formulaire ligne de métré
// ---------------------------------------------------------------------------

interface ArticleCCTPSuggestion {
  id: string;
  intitule: string;
  code_reference: string;
  chapitre: string;
  lot_intitule: string | null;
  statut: string;
  statut_libelle: string;
  ligne_prix_designation: string | null;
}

interface FormLigneProps {
  initial: Partial<typeof VIDE_LIGNE>;
  metreId: string;
  onSuccess: () => void;
  onClose: () => void;
  ligneId?: string;
  numeroOrdreInitial: number;
}

function FormLigne({ initial, metreId, onSuccess, onClose, ligneId, numeroOrdreInitial }: FormLigneProps) {
  const [form, setForm] = useState({ ...VIDE_LIGNE, numero_ordre: String(numeroOrdreInitial), ...initial });
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [apercuCalcul, setApercuCalcul] = useState<ApercuCalcul | null>(null);
  const [chargementCalcul, setChargementCalcul] = useState(false);
  const [modalFormules, setModalFormules] = useState(false);

  // Autocomplete CCTP
  const [suggestions, setSuggestions] = useState<ArticleCCTPSuggestion[]>([]);
  const [chargementSuggestions, setChargementSuggestions] = useState(false);
  const [afficherSuggestions, setAfficherSuggestions] = useState(false);
  const [articleLie, setArticleLie] = useState<ArticleCCTPSuggestion | null>(null);
  const [creationCCTP, setCreationCCTP] = useState(false);
  const [succesCCTP, setSuccesCCTP] = useState<string | null>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const maj = (k: keyof typeof VIDE_LIGNE, v: string) => setForm((p) => ({ ...p, [k]: v }));

  // Fermer le dropdown si clic extérieur
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setAfficherSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Recherche d'articles CCTP (debounced, min 2 chars)
  useEffect(() => {
    const q = form.designation.trim();
    if (q.length < 2) { setSuggestions([]); setAfficherSuggestions(false); return; }
    const t = window.setTimeout(async () => {
      try {
        setChargementSuggestions(true);
        const r = await api.get<{ results?: ArticleCCTPSuggestion[]; count?: number } | ArticleCCTPSuggestion[]>(
          `/api/pieces-ecrites/articles/?search=${encodeURIComponent(q)}&est_dans_bibliotheque=true`
        );
        const liste = Array.isArray(r) ? r : (r.results ?? []);
        setSuggestions(liste.slice(0, 8));
        setAfficherSuggestions(true);
      } catch { setSuggestions([]); }
      finally { setChargementSuggestions(false); }
    }, 350);
    return () => window.clearTimeout(t);
  }, [form.designation]);

  // Calcul aperçu
  useEffect(() => {
    if (!form.detail_calcul.trim()) { setApercuCalcul(null); return; }
    const t = window.setTimeout(async () => {
      try {
        setChargementCalcul(true);
        const r = await api.post<ApercuCalcul>("/api/metres/apercu-calcul/", { detail_calcul: form.detail_calcul });
        setApercuCalcul(r);
      } catch { setApercuCalcul(null); }
      finally { setChargementCalcul(false); }
    }, 300);
    return () => window.clearTimeout(t);
  }, [form.detail_calcul]);

  const selectionnerArticle = (article: ArticleCCTPSuggestion) => {
    maj("designation", article.intitule);
    if (article.code_reference) maj("code_article", article.code_reference);
    setArticleLie(article);
    setAfficherSuggestions(false);
    setSuggestions([]);
  };

  const creerArticleCCTP = async () => {
    const intitule = form.designation.trim();
    if (!intitule) return;
    setCreationCCTP(true);
    try {
      const r = await api.post<{ article: ArticleCCTPSuggestion; detail: string }>(
        "/api/pieces-ecrites/articles/creation-rapide/",
        { intitule, unite: form.unite || "u" }
      );
      setArticleLie(r.article);
      if (r.article.code_reference) maj("code_article", r.article.code_reference);
      setSuccesCCTP("Article CCTP créé dans la bibliothèque — à compléter.");
      setAfficherSuggestions(false);
      setTimeout(() => setSuccesCCTP(null), 5000);
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Impossible de créer l'article CCTP.");
    } finally { setCreationCCTP(false); }
  };

  const insererFormule = (texte: string, unite: string) => {
    const actuel = form.detail_calcul.trim();
    maj("detail_calcul", actuel ? actuel + "\n" + texte : texte);
    if (!form.unite) maj("unite", unite);
    setModalFormules(false);
  };

  const soumettre = async () => {
    if (!form.designation.trim()) { setErreur("La désignation est requise."); return; }
    if (!form.numero_ordre.trim()) { setErreur("Le numéro d'ordre est requis."); return; }
    setChargement(true); setErreur(null);
    try {
      const payload = {
        metre: metreId,
        numero_ordre: Number(form.numero_ordre),
        code_article: form.code_article,
        designation: form.designation,
        nature: form.nature,
        quantite: form.quantite === "" ? null : Number(form.quantite),
        unite: form.unite,
        detail_calcul: form.detail_calcul,
        observations: form.observations,
      };
      if (ligneId) await api.patch(`/api/metres/${metreId}/lignes/${ligneId}/`, payload);
      else await api.post(`/api/metres/${metreId}/lignes/`, payload);
      onSuccess();
      onClose();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Erreur lors de l'enregistrement.");
    } finally { setChargement(false); }
  };

  return (
    <>
      {modalFormules && (
        <ModalFormules onInserer={insererFormule} onFermer={() => setModalFormules(false)} />
      )}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
            <h2 className="font-semibold text-slate-800">{ligneId ? "Modifier la ligne" : "Nouvelle ligne"}</h2>
            <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
          </div>

          <div className="p-6 space-y-4">
            {erreur && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />{erreur}
              </div>
            )}
            {succesCCTP && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm">
                <CheckCircle className="w-4 h-4 shrink-0" />{succesCCTP}
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="libelle-champ">N° d&apos;ordre</label>
                <input type="number" min="1" className="champ-saisie w-full text-right"
                  value={form.numero_ordre} onChange={(e) => maj("numero_ordre", e.target.value)} />
              </div>
              <div>
                <label className="libelle-champ">Code article</label>
                <input type="text" className="champ-saisie w-full" placeholder="VRD-001"
                  value={form.code_article} onChange={(e) => maj("code_article", e.target.value)} />
              </div>
              <div>
                <label className="libelle-champ">Nature</label>
                <select className="champ-saisie w-full bg-white" value={form.nature}
                  onChange={(e) => maj("nature", e.target.value)}>
                  {NATURES.map((n) => <option key={n.val} value={n.val}>{n.lib}</option>)}
                </select>
              </div>
            </div>

            {/* Désignation avec autocomplete CCTP */}
            <div className="relative" ref={suggestionsRef}>
              <div className="flex items-center justify-between mb-1">
                <label className="libelle-champ !mb-0">
                  Désignation <span className="text-red-500">*</span>
                </label>
                {chargementSuggestions && (
                  <span className="text-xs text-slate-400">Recherche…</span>
                )}
              </div>
              <input
                type="text"
                className="champ-saisie w-full"
                placeholder="Terrassements généraux en déblai — tout venant"
                value={form.designation}
                onChange={(e) => {
                  maj("designation", e.target.value);
                  setArticleLie(null);
                }}
                onFocus={() => { if (suggestions.length > 0) setAfficherSuggestions(true); }}
                autoComplete="off"
              />

              {/* Article lié */}
              {articleLie && (
                <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-green-600 shrink-0" />
                  <span className="text-xs text-green-700 flex-1">
                    Article CCTP lié
                    {articleLie.lot_intitule && <> — {articleLie.lot_intitule}</>}
                    {articleLie.statut === "a_completer" && (
                      <span className="ml-1.5 text-amber-600 font-medium">· à compléter dans la bibliothèque</span>
                    )}
                  </span>
                  <button type="button" onClick={() => setArticleLie(null)} className="text-green-500 hover:text-green-700">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}

              {/* Dropdown suggestions */}
              {afficherSuggestions && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
                  {suggestions.length > 0 ? (
                    <>
                      <div className="px-3 py-2 bg-slate-50 border-b border-slate-100">
                        <p className="text-xs font-medium text-slate-500">Articles CCTP dans la bibliothèque</p>
                      </div>
                      <ul className="max-h-56 overflow-y-auto divide-y divide-slate-50">
                        {suggestions.map((art) => (
                          <li key={art.id}>
                            <button
                              type="button"
                              className="w-full text-left px-3 py-2.5 hover:bg-primaire-50 transition"
                              onClick={() => selectionnerArticle(art)}
                            >
                              <p className="text-sm font-medium text-slate-800 truncate">{art.intitule}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                {art.code_reference && (
                                  <span className="text-xs font-mono text-slate-400">{art.code_reference}</span>
                                )}
                                {art.lot_intitule && (
                                  <span className="text-xs text-slate-400">{art.lot_intitule}</span>
                                )}
                                {art.statut === "a_completer" && (
                                  <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">à compléter</span>
                                )}
                              </div>
                            </button>
                          </li>
                        ))}
                      </ul>
                      <div className="px-3 py-2 border-t border-slate-100 bg-slate-50">
                        <button
                          type="button"
                          disabled={creationCCTP}
                          onClick={creerArticleCCTP}
                          className="flex items-center gap-1.5 text-xs text-primaire-600 hover:text-primaire-700 disabled:opacity-50"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          {creationCCTP ? "Création…" : `Créer « ${form.designation.trim().substring(0, 40)} » dans la bibliothèque`}
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="p-3">
                      <p className="text-xs text-slate-500 mb-2">Aucun article CCTP trouvé pour cette désignation.</p>
                      <button
                        type="button"
                        disabled={creationCCTP || form.designation.trim().length < 3}
                        onClick={creerArticleCCTP}
                        className="flex items-center gap-1.5 text-xs font-medium text-primaire-600 hover:text-primaire-700 disabled:opacity-50"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        {creationCCTP ? "Création…" : `Créer cet article CCTP dans la bibliothèque`}
                      </button>
                      <p className="mt-1 text-xs text-slate-400">
                        Il sera classé « à compléter » et lié à une fiche de prix vierge.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="libelle-champ !mb-0">Détail de calcul</label>
                <button
                  type="button"
                  onClick={() => setModalFormules(true)}
                  className="flex items-center gap-1 text-xs text-primaire-600 hover:text-primaire-700"
                >
                  <FunctionSquare className="w-3.5 h-3.5" />
                  Formules géométriques
                </button>
              </div>
              <textarea
                className="champ-saisie min-h-28 w-full font-mono text-sm"
                placeholder={"L = 5,00\nl = 3,00\nL × l × 2"}
                value={form.detail_calcul}
                onChange={(e) => maj("detail_calcul", e.target.value)}
              />
              <p className="mt-1 text-xs text-slate-400">
                Variables, parenthèses et plusieurs lignes sont acceptées. Chaque ligne de calcul s&apos;additionne.
              </p>
              {chargementCalcul && <p className="mt-2 text-xs text-slate-500">Calcul en cours…</p>}
              {apercuCalcul && (
                <div className="mt-3 rounded-2xl border border-blue-200 bg-blue-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-blue-900">Quantité calculée</p>
                      <p className="text-2xl font-semibold text-blue-900">
                        {apercuCalcul.quantite_calculee.toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                      </p>
                    </div>
                    <button type="button" onClick={() => maj("quantite", String(apercuCalcul.quantite_calculee))}
                      className="btn-secondaire text-sm">
                      Reprendre ce résultat
                    </button>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-blue-950">
                    {apercuCalcul.etapes.map((etape, i) => (
                      <div key={i} className="rounded-xl border border-blue-100 bg-white px-3 py-2">
                        <p className="font-medium">{etape.libelle}</p>
                        <p className="font-mono">{etape.expression}</p>
                        <p className="mt-1 text-blue-700">= {etape.valeur.toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="libelle-champ">Quantité</label>
                <input type="number" step="0.001" className="champ-saisie w-full text-right"
                  value={form.quantite} onChange={(e) => maj("quantite", e.target.value)} />
              </div>
              <div>
                <label className="libelle-champ">Unité</label>
                <input type="text" className="champ-saisie w-full" placeholder="m²"
                  value={form.unite} onChange={(e) => maj("unite", e.target.value)} maxLength={20} />
              </div>
            </div>

            <div>
              <label className="libelle-champ">Observations</label>
              <input type="text" className="champ-saisie w-full"
                value={form.observations} onChange={(e) => maj("observations", e.target.value)} />
            </div>
          </div>

          <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
            <button onClick={onClose} className="btn-secondaire">Annuler</button>
            <button onClick={soumettre} disabled={chargement} className="btn-primaire disabled:opacity-60">
              {chargement ? "Enregistrement…" : <><Save className="w-4 h-4" />Enregistrer</>}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Types canvas
// ---------------------------------------------------------------------------

type OutilCanvas = "selection" | "surface" | "longueur" | "comptage" | "calibrer" | "soustraction_surface" | "soustraction_longueur";

interface PointCanvas { x: number; y: number; }

interface ZoneVisualisee {
  id: string;
  type: "surface" | "longueur" | "comptage";
  mode: "ajout" | "soustraction";
  designation: string;
  unite: string;
  points: PointCanvas[];
  valeur: number;
  hauteur?: number;      // pour les longueurs → surface = longueur × hauteur
  deductions: Array<{ designation: string; valeur: number }>;
  couleur: string;
}

const COULEURS_AJOUT = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16", "#f97316"];
const COULEUR_SOUSTRACTION = "#ef4444";

function calculerSurface(points: PointCanvas[]): number {
  if (points.length < 3) return 0;
  let aire = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    aire += points[i].x * points[j].y;
    aire -= points[j].x * points[i].y;
  }
  return Math.abs(aire / 2);
}

function calculerLongueur(points: PointCanvas[]): number {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    total += Math.sqrt(dx * dx + dy * dy);
  }
  return total;
}

// ---------------------------------------------------------------------------
// Composant Métré visuel
// ---------------------------------------------------------------------------

function MetreVisuel({ metreId, onLignesCreees }: { metreId: string; onLignesCreees: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const conteneurRef = useRef<HTMLDivElement>(null);
  const [fondPlan, setFondPlan] = useState<HTMLImageElement | null>(null);
  const [chargementFond, setChargementFond] = useState(false);
  const [erreurFond, setErreurFond] = useState<string | null>(null);
  const [progressionFond, setProgressionFond] = useState<ProgressionTeleversement | null>(null);
  const [outil, setOutil] = useState<OutilCanvas>("selection");
  const [zoom, setZoom] = useState(1);
  const [offset, setOffsetCanvas] = useState<PointCanvas>({ x: 0, y: 0 });
  const [pointsEnCours, setPointsEnCours] = useState<PointCanvas[]>([]);
  const [mousePos, setMousePos] = useState<PointCanvas | null>(null);
  const [zones, setZones] = useState<ZoneVisualisee[]>([]);
  const [zoneSelectionnee, setZoneSelectionnee] = useState<string | null>(null);
  const [echellePixelParMetre, setEchellePixelParMetre] = useState(50);
  const [calibrationPoints, setCalibrationPoints] = useState<PointCanvas[]>([]);
  const [longueurConnue, setLongueurConnue] = useState("");
  const [enregistrement, setEnregistrement] = useState(false);
  const [succes, setSucces] = useState<string | null>(null);
  const [modalHauteur, setModalHauteur] = useState<{ zoneId: string; hauteurActuelle: string } | null>(null);
  const isDragging = useRef(false);
  const lastMouse = useRef<PointCanvas>({ x: 0, y: 0 });

  // Adapte le canvas à la taille du conteneur
  useEffect(() => {
    const conteneur = conteneurRef.current;
    const canvas = canvasRef.current;
    if (!conteneur || !canvas) return;

    const ajusterTaille = () => {
      const w = conteneur.clientWidth;
      const h = Math.max(480, Math.round(w * 0.6));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    };

    ajusterTaille();
    const obs = new ResizeObserver(ajusterTaille);
    obs.observe(conteneur);
    return () => obs.disconnect();
  }, []);

  // Conversion coordonnées écran → canvas (corrige le décalage lié au scaling CSS)
  const coordCanvas = useCallback((e: React.MouseEvent<HTMLCanvasElement>): PointCanvas => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: ((e.clientX - rect.left) * scaleX - offset.x) / zoom,
      y: ((e.clientY - rect.top) * scaleY - offset.y) / zoom,
    };
  }, [offset, zoom]);

  const dessiner = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(offset.x, offset.y);
    ctx.scale(zoom, zoom);

    // Fond de plan ou grille
    if (fondPlan) {
      ctx.drawImage(fondPlan, 0, 0);
    } else {
      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(0, 0, canvas.width / zoom, canvas.height / zoom);
      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 1 / zoom;
      for (let x = 0; x < canvas.width / zoom; x += 50) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height / zoom); ctx.stroke();
      }
      for (let y = 0; y < canvas.height / zoom; y += 50) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width / zoom, y); ctx.stroke();
      }
    }

    // Zones existantes
    zones.forEach((zone) => {
      if (zone.points.length === 0) return;
      const estSelectionnee = zone.id === zoneSelectionnee;
      const couleur = zone.mode === "soustraction" ? COULEUR_SOUSTRACTION : zone.couleur;

      ctx.globalAlpha = estSelectionnee ? 0.8 : 0.5;
      ctx.fillStyle = couleur;
      ctx.strokeStyle = couleur;
      ctx.lineWidth = (estSelectionnee ? 2.5 : 1.5) / zoom;

      if ((zone.type === "surface" || (zone.type === "longueur" && zone.hauteur)) && zone.points.length >= 2) {
        if (zone.type === "surface" && zone.points.length >= 3) {
          ctx.beginPath();
          ctx.moveTo(zone.points[0].x, zone.points[0].y);
          zone.points.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
          ctx.closePath();
          ctx.fill();
          ctx.globalAlpha = 1;
          ctx.stroke();
        } else if (zone.type === "longueur") {
          ctx.globalAlpha = 1;
          ctx.beginPath();
          ctx.moveTo(zone.points[0].x, zone.points[0].y);
          zone.points.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
          ctx.stroke();
        }
      } else if (zone.type === "longueur" && zone.points.length >= 2) {
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.moveTo(zone.points[0].x, zone.points[0].y);
        zone.points.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
        ctx.stroke();
        // Points de contrôle sur la polyligne
        zone.points.forEach((p) => {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 3 / zoom, 0, Math.PI * 2);
          ctx.fill();
        });
      } else if (zone.type === "comptage") {
        zone.points.forEach((p) => {
          ctx.globalAlpha = 1;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 8 / zoom, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      // Libellé centré
      if (zone.points.length > 0) {
        const cx = zone.points.reduce((s, p) => s + p.x, 0) / zone.points.length;
        const cy = zone.points.reduce((s, p) => s + p.y, 0) / zone.points.length;
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#1e293b";
        ctx.font = `bold ${13 / zoom}px system-ui`;
        ctx.textAlign = "center";

        let valAff = "";
        if (zone.type === "comptage") {
          valAff = `${zone.points.length} u`;
        } else if (zone.type === "longueur" && zone.hauteur) {
          const surf = zone.valeur * zone.hauteur / (echellePixelParMetre * echellePixelParMetre);
          valAff = `${surf.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} m²`;
        } else {
          const val = zone.type === "surface"
            ? zone.valeur / (echellePixelParMetre * echellePixelParMetre)
            : zone.valeur / echellePixelParMetre;
          valAff = `${val.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} ${zone.unite}`;
        }

        if (zone.mode === "soustraction") {
          ctx.fillStyle = COULEUR_SOUSTRACTION;
          ctx.fillText(`− ${zone.designation}`, cx, cy);
        } else {
          ctx.fillText(zone.designation, cx, cy);
        }
        ctx.font = `${11 / zoom}px system-ui`;
        ctx.fillStyle = couleur;
        ctx.fillText(valAff, cx, cy + 14 / zoom);
      }
    });

    // Tracé en cours (pointillés bleus)
    if (pointsEnCours.length > 0) {
      ctx.globalAlpha = 1;
      const couleurTrace = (outil === "soustraction_surface" || outil === "soustraction_longueur")
        ? "#ef4444" : "#0ea5e9";
      ctx.strokeStyle = couleurTrace;
      ctx.fillStyle = couleurTrace;
      ctx.lineWidth = 2 / zoom;
      ctx.setLineDash([5 / zoom, 3 / zoom]);
      ctx.beginPath();
      ctx.moveTo(pointsEnCours[0].x, pointsEnCours[0].y);
      pointsEnCours.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
      // Ligne vers la souris
      if (mousePos && outil !== "comptage") {
        ctx.lineTo(mousePos.x, mousePos.y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      pointsEnCours.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4 / zoom, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    ctx.restore();
  }, [fondPlan, zones, zoneSelectionnee, pointsEnCours, mousePos, offset, zoom, echellePixelParMetre, outil]);

  useEffect(() => { dessiner(); }, [dessiner]);

  const finaliserZone = useCallback(() => {
    if (pointsEnCours.length < (outil === "comptage" || outil === "longueur" || outil === "soustraction_longueur" ? 2 : 3)) return;

    const estSoustraction = outil === "soustraction_surface" || outil === "soustraction_longueur";
    const typeZone: ZoneVisualisee["type"] =
      outil === "surface" || outil === "soustraction_surface" ? "surface"
        : outil === "longueur" || outil === "soustraction_longueur" ? "longueur"
          : "comptage";

    const valeurBrute = typeZone === "surface"
      ? calculerSurface(pointsEnCours)
      : typeZone === "longueur"
        ? calculerLongueur(pointsEnCours)
        : pointsEnCours.length;

    const valeurReelle = typeZone === "comptage"
      ? valeurBrute
      : typeZone === "surface"
        ? valeurBrute / (echellePixelParMetre * echellePixelParMetre)
        : valeurBrute / echellePixelParMetre;

    const couleur = estSoustraction
      ? COULEUR_SOUSTRACTION
      : COULEURS_AJOUT[(zones.filter((z) => z.mode === "ajout").length) % COULEURS_AJOUT.length];

    const nouvelleZone: ZoneVisualisee = {
      id: `zone-${Date.now()}`,
      type: typeZone,
      mode: estSoustraction ? "soustraction" : "ajout",
      designation: estSoustraction ? `Déduction ${zones.filter((z) => z.mode === "soustraction").length + 1}` : `Zone ${zones.filter((z) => z.mode === "ajout").length + 1}`,
      unite: typeZone === "surface" ? "m²" : typeZone === "longueur" ? "ml" : "u",
      points: [...pointsEnCours],
      valeur: valeurReelle,
      deductions: [],
      couleur,
    };
    setZones((prev) => [...prev, nouvelleZone]);
    setPointsEnCours([]);
    setZoneSelectionnee(nouvelleZone.id);
  }, [outil, pointsEnCours, echellePixelParMetre, zones]);

  const gererClic = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    if (outil === "selection") {
      // Sélection d'une zone par clic
      const pt = coordCanvas(e);
      const trouve = zones.find((z) => {
        if (z.points.length === 0) return false;
        const dx = Math.min(...z.points.map((p) => Math.abs(p.x - pt.x)));
        const dy = Math.min(...z.points.map((p) => Math.abs(p.y - pt.y)));
        return Math.sqrt(dx * dx + dy * dy) < 20 / zoom;
      });
      setZoneSelectionnee(trouve ? trouve.id : null);
      return;
    }
    if (outil === "calibrer") {
      const pt = coordCanvas(e);
      setCalibrationPoints((prev) => {
        const next = [...prev, pt];
        if (next.length === 2 && longueurConnue) {
          const dx = next[1].x - next[0].x;
          const dy = next[1].y - next[0].y;
          const pixels = Math.sqrt(dx * dx + dy * dy);
          const metres = parseFloat(longueurConnue);
          if (metres > 0 && pixels > 0) setEchellePixelParMetre(pixels / metres);
          return [];
        }
        return next;
      });
      return;
    }
    const pt = coordCanvas(e);
    setPointsEnCours((prev) => [...prev, pt]);
  };

  const gererClicDroit = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (outil === "selection") return;
    finaliserZone();
  };

  // Zoom via molette — utilise addEventListener natif avec passive:false
  // pour pouvoir appeler e.preventDefault() et empêcher le défilement de page.
  const zoomRef = useRef(zoom);
  const offsetRef = useRef(offset);
  zoomRef.current = zoom;
  offsetRef.current = offset;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const mx = (e.clientX - rect.left) * scaleX;
      const my = (e.clientY - rect.top) * scaleY;
      const facteur = e.deltaY < 0 ? 1.1 : 0.9;
      const z = zoomRef.current;
      const o = offsetRef.current;
      const nz = Math.min(5, Math.max(0.1, z * facteur));
      setZoom(nz);
      setOffsetCanvas({
        x: mx - (mx - o.x) * (nz / z),
        y: my - (my - o.y) * (nz / z),
      });
    };
    canvas.addEventListener("wheel", handler, { passive: false });
    return () => canvas.removeEventListener("wheel", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const gererMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (outil === "selection") {
      isDragging.current = true;
      lastMouse.current = { x: e.clientX, y: e.clientY };
    }
  };

  const gererMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pt = coordCanvas(e);
    setMousePos(pt);
    if (isDragging.current && outil === "selection") {
      setOffsetCanvas((prev) => ({
        x: prev.x + (e.clientX - lastMouse.current.x),
        y: prev.y + (e.clientY - lastMouse.current.y),
      }));
      lastMouse.current = { x: e.clientX, y: e.clientY };
    }
  };

  const gererMouseUp = () => { isDragging.current = false; };

  const uploaderFond = async (fichier: File) => {
    setChargementFond(true);
    setErreurFond(null);
    setProgressionFond(null);
    try {
      const formData = new FormData();
      formData.append("fichier", fichier);
      formData.append("metre", metreId);
      const reponse = await requeteApiAvecProgression<{ fichier?: string; url?: string }>(
        `/api/metres/${metreId}/fonds-plan/`,
        { method: "POST", corps: formData, onProgression: setProgressionFond }
      );
      const url = reponse.fichier ?? reponse.url ?? "";
      if (!url) { setErreurFond("Aucune URL retournée par le serveur."); return; }
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = canvasRef.current;
        if (canvas && canvas.width > 0 && img.width > 0 && img.height > 0) {
          const fitZoom = Math.min(canvas.width / img.width, canvas.height / img.height) * 0.92;
          setZoom(fitZoom);
          setOffsetCanvas({
            x: (canvas.width - img.width * fitZoom) / 2,
            y: (canvas.height - img.height * fitZoom) / 2,
          });
        }
        setFondPlan(img);
        setTimeout(() => setProgressionFond(null), 600);
      };
      img.onerror = () => setErreurFond(`Impossible de charger l'image. URL: ${url.substring(0, 60)}…`);
      img.src = url;
    } catch (e) {
      setErreurFond(e instanceof ErreurApi ? e.detail : "Impossible de téléverser le fond de plan.");
      setProgressionFond(null);
    } finally { setChargementFond(false); }
  };

  const supprimerZone = (id: string) => {
    setZones((prev) => prev.filter((z) => z.id !== id));
    if (zoneSelectionnee === id) setZoneSelectionnee(null);
  };

  const modifierZone = (id: string, champs: Partial<ZoneVisualisee>) => {
    setZones((prev) => prev.map((z) => z.id === id ? { ...z, ...champs } : z));
  };

  const validerEtCreerLignes = async () => {
    if (zones.length === 0) return;
    setEnregistrement(true);
    try {
      // Calcule valeur nette par zone (soustraction = valeur négative)
      const lignesPayload = zones.map((zone) => {
        let valeurNette: number;
        if (zone.type === "comptage") {
          valeurNette = zone.mode === "soustraction" ? -zone.points.length : zone.points.length;
        } else if (zone.type === "longueur" && zone.hauteur) {
          const surf = zone.valeur * zone.hauteur;
          valeurNette = zone.mode === "soustraction" ? -surf : surf;
        } else {
          valeurNette = zone.mode === "soustraction" ? -zone.valeur : zone.valeur;
        }
        const unite = (zone.type === "longueur" && zone.hauteur) ? "m²" : zone.unite;
        const detail = zone.mode === "soustraction"
          ? `Déduction — ${zone.type}${zone.hauteur ? ` × h=${zone.hauteur}m` : ""}`
          : `Métré visuel — ${zone.type}${zone.hauteur ? ` × h=${zone.hauteur}m` : ""}`;
        return {
          metre: metreId,
          designation: zone.designation,
          nature: "travaux",
          quantite: Math.round(valeurNette * 1000) / 1000,
          unite,
          detail_calcul: detail,
          numero_ordre: 0,
        };
      });
      for (const ligne of lignesPayload) {
        await api.post(`/api/metres/${metreId}/lignes/`, ligne);
      }
      setSucces(`${zones.length} ligne(s) créée(s) depuis le métré visuel.`);
      setTimeout(() => setSucces(null), 4000);
      onLignesCreees();
    } catch (e) {
      setErreurFond(e instanceof ErreurApi ? e.detail : "Erreur lors de la création des lignes.");
    } finally { setEnregistrement(false); }
  };

  const outils = [
    { id: "selection" as OutilCanvas, icone: <MousePointer className="w-4 h-4" />, titre: "Sélection / Déplacement" },
    { id: "surface" as OutilCanvas, icone: <Square className="w-4 h-4" />, titre: "Surface (polygone)" },
    { id: "soustraction_surface" as OutilCanvas, icone: <MinusSquare className="w-4 h-4 text-red-500" />, titre: "Soustraire surface" },
    { id: "longueur" as OutilCanvas, icone: <LineIcon className="w-4 h-4" />, titre: "Longueur (polyligne)" },
    { id: "soustraction_longueur" as OutilCanvas, icone: <LineIcon className="w-4 h-4 text-red-500" />, titre: "Soustraire longueur" },
    { id: "comptage" as OutilCanvas, icone: <Hash className="w-4 h-4" />, titre: "Comptage" },
    { id: "calibrer" as OutilCanvas, icone: <ScanLine className="w-4 h-4" />, titre: "Calibrer l'échelle" },
  ];

  const instructionOutil = {
    selection: "Clic pour sélectionner une zone — Molette pour zoomer — Glisser pour déplacer",
    surface: "Clic pour placer des points — Clic droit pour fermer le polygone",
    soustraction_surface: "Surface à soustraire (rouge) — Clic droit pour fermer",
    longueur: "Clic pour ajouter un segment — Clic droit pour terminer la polyligne",
    soustraction_longueur: "Longueur à soustraire (rouge) — Clic droit pour terminer",
    comptage: "Clic sur chaque élément — Clic droit pour terminer",
    calibrer: "Tracez un segment de longueur connue (2 points)",
  }[outil];

  return (
    <div className="space-y-4">
      <OverlayTeleversement progression={progressionFond} libelle="Téléversement du fond de plan…" />

      {/* Modal hauteur polyligne */}
      {modalHauteur && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-semibold text-slate-800">Hauteur de la polyligne</h3>
            <p className="text-sm text-slate-500">
              En renseignant une hauteur, la longueur sera multipliée pour obtenir une surface (ex: mur vertical, ouverture).
            </p>
            <div>
              <label className="libelle-champ">Hauteur (m)</label>
              <input
                type="number" step="0.01" className="champ-saisie w-full text-right"
                value={modalHauteur.hauteurActuelle}
                onChange={(e) => setModalHauteur((p) => p ? { ...p, hauteurActuelle: e.target.value } : null)}
              />
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setModalHauteur(null)} className="btn-secondaire">Annuler</button>
              <button
                onClick={() => {
                  const h = parseFloat(modalHauteur.hauteurActuelle);
                  modifierZone(modalHauteur.zoneId, { hauteur: isNaN(h) || h <= 0 ? undefined : h });
                  setModalHauteur(null);
                }}
                className="btn-primaire"
              >
                <Save className="w-4 h-4" />Appliquer
              </button>
            </div>
          </div>
        </div>
      )}

      {erreurFond && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm p-3">
          <AlertCircle className="w-4 h-4 shrink-0" />{erreurFond}
          <button onClick={() => setErreurFond(null)} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}
      {succes && (
        <div className="flex items-center gap-2 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm p-3">
          <CheckCircle className="w-4 h-4 shrink-0" />{succes}
        </div>
      )}

      {/* Upload fond de plan */}
      {!fondPlan && (
        <div className="carte p-6 space-y-3">
          <p className="font-semibold text-slate-700">Importer un fond de plan</p>
          <p className="text-sm text-slate-400">Formats acceptés : image (PNG, JPEG, TIFF) ou PDF.</p>
          <label className="flex cursor-pointer items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-10 hover:border-primaire-300 hover:bg-primaire-50 transition">
            {chargementFond
              ? <><Calculator className="w-6 h-6 animate-spin text-slate-400" /><span className="text-sm text-slate-500">Téléversement…</span></>
              : <><Upload className="w-6 h-6 text-slate-400" /><span className="text-sm text-slate-500">Cliquez pour importer le fond de plan</span></>
            }
            <input type="file" accept="image/*,.pdf" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploaderFond(f); e.currentTarget.value = ""; }}
            />
          </label>
        </div>
      )}

      {/* Interface canvas */}
      <div className="grid gap-4 xl:grid-cols-[60px_minmax(0,1fr)_290px]">
        {/* Barre d'outils */}
        <div className="flex xl:flex-col gap-2 flex-wrap">
          {outils.map((o) => (
            <button key={o.id} type="button" title={o.titre}
              onClick={() => { setOutil(o.id); setPointsEnCours([]); }}
              className={`flex h-10 w-10 items-center justify-center rounded-xl border transition ${
                outil === o.id
                  ? (o.id.startsWith("soustraction") ? "border-red-300 bg-red-50 text-red-700" : "border-primaire-300 bg-primaire-50 text-primaire-700")
                  : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
              }`}
            >
              {o.icone}
            </button>
          ))}
          {outil === "calibrer" && (
            <div className="xl:mt-2 space-y-1 w-10">
              <input type="number" className="champ-saisie w-full text-xs py-1" placeholder="m"
                value={longueurConnue} onChange={(e) => setLongueurConnue(e.target.value)} />
              <p className="text-[10px] text-slate-400 text-center">{calibrationPoints.length}/2</p>
            </div>
          )}
        </div>

        {/* Canvas */}
        <div ref={conteneurRef} className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
          <canvas
            ref={canvasRef}
            className="block w-full"
            onClick={gererClic}
            onContextMenu={gererClicDroit}
            onMouseDown={gererMouseDown}
            onMouseMove={gererMouseMove}
            onMouseUp={gererMouseUp}
            onMouseLeave={() => { isDragging.current = false; setMousePos(null); }}
            style={{ cursor: outil === "selection" ? (isDragging.current ? "grabbing" : "grab") : "crosshair" }}
          />
          <div className="flex items-center justify-between border-t border-slate-200 bg-white px-4 py-2 text-xs text-slate-500">
            <span className="truncate">{instructionOutil}</span>
            <div className="flex items-center gap-3 shrink-0">
              {fondPlan && (
                <button
                  type="button"
                  className="text-primaire-600 hover:text-primaire-700 font-medium"
                  onClick={() => {
                    const canvas = canvasRef.current;
                    if (!canvas || !fondPlan) return;
                    const fitZoom = Math.min(canvas.width / fondPlan.width, canvas.height / fondPlan.height) * 0.92;
                    setZoom(fitZoom);
                    setOffsetCanvas({
                      x: (canvas.width - fondPlan.width * fitZoom) / 2,
                      y: (canvas.height - fondPlan.height * fitZoom) / 2,
                    });
                  }}
                >
                  Centrer
                </button>
              )}
              <span>Zoom {Math.round(zoom * 100)}% — {echellePixelParMetre.toFixed(1)} px/m</span>
            </div>
          </div>
        </div>

        {/* Panel zones */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700">Zones ({zones.length})</p>
            {zones.length > 0 && (
              <button type="button" onClick={validerEtCreerLignes} disabled={enregistrement}
                className="btn-primaire text-xs disabled:opacity-60">
                {enregistrement
                  ? <><Calculator className="w-3 h-3 animate-spin" />Création…</>
                  : <><CheckSquare className="w-3 h-3" />Créer les lignes</>
                }
              </button>
            )}
          </div>

          {zones.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-400">
              Aucune zone mesurée.<br />Sélectionnez un outil et dessinez.<br />
              <span className="text-xs">Clic droit pour valider une zone.</span>
            </div>
          ) : (
            <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
              {zones.map((zone) => (
                <div key={zone.id}
                  className={`rounded-xl border p-3 cursor-pointer transition ${
                    zone.id === zoneSelectionnee
                      ? (zone.mode === "soustraction" ? "border-red-200 bg-red-50" : "border-primaire-200 bg-primaire-50")
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                  onClick={() => setZoneSelectionnee(zone.id === zoneSelectionnee ? null : zone.id)}
                >
                  <div className="flex items-start gap-2">
                    <div className="mt-1 h-3 w-3 rounded-full shrink-0"
                      style={{ background: zone.mode === "soustraction" ? COULEUR_SOUSTRACTION : zone.couleur }} />
                    <div className="flex-1 min-w-0">
                      <input
                        type="text" className="champ-saisie w-full text-xs py-1"
                        value={zone.designation}
                        onChange={(e) => modifierZone(zone.id, { designation: e.target.value })}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="mt-1 flex items-center gap-2">
                        <p className="font-mono text-xs text-slate-600">
                          {zone.type === "comptage"
                            ? `${zone.points.length} u`
                            : zone.type === "longueur" && zone.hauteur
                              ? `${(zone.valeur * zone.hauteur).toLocaleString("fr-FR", { maximumFractionDigits: 3 })} m²`
                              : `${zone.valeur.toLocaleString("fr-FR", { maximumFractionDigits: 3 })} ${zone.unite}`
                          }
                        </p>
                        {zone.mode === "soustraction" && (
                          <span className="text-[10px] font-medium text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded">−</span>
                        )}
                      </div>
                      {zone.type === "longueur" && (
                        <button
                          type="button"
                          className="mt-1 text-[10px] text-primaire-600 hover:underline"
                          onClick={(e) => { e.stopPropagation(); setModalHauteur({ zoneId: zone.id, hauteurActuelle: zone.hauteur ? String(zone.hauteur) : "" }); }}
                        >
                          {zone.hauteur ? `× h = ${zone.hauteur} m → surface` : "Ajouter une hauteur →surface"}
                        </button>
                      )}
                    </div>
                    <button type="button" onClick={(e) => { e.stopPropagation(); supprimerZone(zone.id); }}
                      className="p-1 text-slate-300 hover:text-red-500">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Calibration */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center gap-2">
              <Ruler className="w-3 h-3 text-slate-400" />
              <p className="text-xs font-medium text-slate-600">Calibration</p>
            </div>
            <p className="mt-1 text-xs text-slate-500">1 m = {echellePixelParMetre.toFixed(1)} px</p>
            {outil !== "calibrer" && (
              <button type="button" onClick={() => setOutil("calibrer")}
                className="mt-2 text-xs text-primaire-600 hover:underline">
                Modifier l&apos;échelle
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page principale
// ---------------------------------------------------------------------------

export default function PageDetailMetre({ params }: { params: Promise<{ id: string; metre_id: string }> }) {
  const { id: projetId, metre_id: metreId } = use(params);
  const [metre, setMetre] = useState<MetreDetail | null>(null);
  const [chargement, setChargement] = useState(true);
  const [succes, setSucces] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [modal, setModal] = useState(false);
  const [edition, setEdition] = useState<LigneMetre | null>(null);
  const [suppressionId, setSuppressionId] = useState<string | null>(null);
  const [onglet, setOnglet] = useState<"lignes" | "visuel">("lignes");

  const charger = useCallback(async () => {
    try { setMetre(await api.get<MetreDetail>(`/api/metres/${metreId}/`)); }
    catch { setErreur("Impossible de charger le métré."); }
    finally { setChargement(false); }
  }, [metreId]);

  useEffect(() => { charger(); }, [charger]);

  const flash = (msg: string) => { setSucces(msg); setTimeout(() => setSucces(null), 3000); };

  const supprimerLigne = async (ligneId: string) => {
    try {
      await api.supprimer(`/api/metres/${metreId}/lignes/${ligneId}/`);
      flash("Ligne supprimée."); setSuppressionId(null); charger();
    } catch { setErreur("Impossible de supprimer la ligne."); }
  };

  const valider = async () => {
    try { await api.post(`/api/metres/${metreId}/valider/`, {}); flash("Métré validé."); charger(); }
    catch (e) { setErreur(e instanceof ErreurApi ? e.detail : "Impossible de valider."); }
  };

  if (chargement) return <div className="py-20 text-center text-slate-400 text-sm">Chargement…</div>;
  if (!metre) return (
    <div className="space-y-4">
      <Link href={`/projets/${projetId}/metres`} className="flex items-center gap-2 text-slate-400 hover:text-slate-600 text-sm">
        <ArrowLeft className="w-4 h-4" />Retour
      </Link>
      <div className="py-20 text-center text-red-500">Métré introuvable.</div>
    </div>
  );

  const lignes = metre.lignes ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Link href={`/projets/${projetId}`} className="hover:text-slate-600 transition-colors">{metre.projet_reference}</Link>
        <ChevronRight className="w-3 h-3" />
        <Link href={`/projets/${projetId}/metres`} className="hover:text-slate-600 transition-colors">Métrés</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-slate-600 font-medium truncate">{metre.intitule}</span>
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

      {/* En-tête */}
      <div className="carte p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
              <Calculator className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${
                  metre.statut === "valide" ? "badge-succes" :
                  metre.statut === "en_cours" ? "bg-blue-100 text-blue-700 border border-blue-200" : "badge-neutre"
                }`}>{metre.statut_libelle}</span>
                <span className="text-sm text-slate-400">{metre.type_libelle}</span>
              </div>
              <h1 className="mt-1 text-xl font-bold text-slate-800">{metre.intitule}</h1>
              <p className="text-sm text-slate-400 mt-1">{lignes.length} ligne{lignes.length !== 1 ? "s" : ""} de quantification</p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {metre.statut !== "valide" && (
              <button onClick={valider} className="btn-primaire">
                <CheckCircle className="w-4 h-4" />Valider
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Onglets */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-1 px-1">
          {[
            { id: "lignes", libelle: `Lignes de quantification (${lignes.length})` },
            { id: "visuel", libelle: "Métré visuel" },
          ].map((tab) => (
            <button key={tab.id} type="button" onClick={() => setOnglet(tab.id as typeof onglet)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                onglet === tab.id
                  ? "border-primaire-600 text-primaire-700"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
              }`}>
              {tab.libelle}
            </button>
          ))}
        </nav>
      </div>

      {onglet === "visuel" && (
        <MetreVisuel metreId={metreId} onLignesCreees={() => { charger(); setOnglet("lignes"); }} />
      )}

      {onglet === "lignes" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-slate-700">
              {lignes.length} ligne{lignes.length !== 1 ? "s" : ""} de quantification
            </p>
            {metre.statut !== "valide" && (
              <button onClick={() => { setEdition(null); setModal(true); }} className="btn-primaire">
                <Plus className="w-4 h-4" />Ajouter une ligne
              </button>
            )}
          </div>

          {lignes.length === 0 ? (
            <div className="carte py-12 text-center">
              <Calculator className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">Aucune ligne de quantification</p>
              <p className="text-slate-400 text-sm mt-1">
                Ajoutez des lignes manuellement ou utilisez le métré visuel.
              </p>
            </div>
          ) : (
            <div className="carte overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider w-8">#</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Désignation</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider hidden sm:table-cell">Nature</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Quantité</th>
                    <th className="text-center px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Unité</th>
                    {metre.statut !== "valide" && <th className="px-4 py-3 w-20"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {lignes.map((ligne, idx) => (
                    <tr key={ligne.id} className={`hover:bg-slate-50 group ${ligne.quantite !== null && ligne.quantite < 0 ? "bg-red-50/40" : ""}`}>
                      <td className="px-4 py-3 text-xs text-slate-400 font-mono">{idx + 1}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">{ligne.designation}</p>
                        {ligne.code_article && <p className="text-xs text-slate-400 font-mono">{ligne.code_article}</p>}
                        {ligne.detail_calcul && (
                          <p className="text-xs text-slate-400 font-mono mt-0.5 italic">{ligne.detail_calcul}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{ligne.nature_libelle}</span>
                      </td>
                      <td className={`px-4 py-3 text-right font-mono text-sm font-semibold ${
                        ligne.quantite !== null && ligne.quantite < 0 ? "text-red-600" : "text-slate-800"
                      }`}>
                        {ligne.quantite != null ? Number(ligne.quantite).toLocaleString("fr-FR", { maximumFractionDigits: 3 }) : "—"}
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-xs text-slate-500">{ligne.unite}</td>
                      {metre.statut !== "valide" && (
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                            <button onClick={() => { setEdition(ligne); setModal(true); }}
                              className="p-1.5 rounded text-slate-400 hover:text-primaire-600 hover:bg-primaire-50">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            {suppressionId === ligne.id ? (
                              <div className="flex items-center gap-1">
                                <button onClick={() => supprimerLigne(ligne.id)}
                                  className="text-xs text-red-600 font-medium px-1.5 py-1 rounded hover:bg-red-50">Suppr.</button>
                                <button onClick={() => setSuppressionId(null)} className="p-1 rounded hover:bg-slate-100">
                                  <X className="w-3 h-3 text-slate-400" />
                                </button>
                              </div>
                            ) : (
                              <button onClick={() => setSuppressionId(ligne.id)}
                                className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {modal && onglet === "lignes" && (
        <FormLigne
          metreId={metreId}
          initial={edition ? {
            numero_ordre: String(edition.numero_ordre),
            code_article: edition.code_article,
            designation: edition.designation,
            nature: edition.nature,
            quantite: edition.quantite != null ? String(edition.quantite) : "",
            unite: edition.unite,
            detail_calcul: edition.detail_calcul,
            observations: edition.observations,
          } : {}}
          ligneId={edition?.id}
          numeroOrdreInitial={edition ? edition.numero_ordre : lignes.length + 1}
          onSuccess={() => { flash(edition ? "Ligne modifiée." : "Ligne ajoutée."); charger(); }}
          onClose={() => { setModal(false); setEdition(null); }}
        />
      )}
    </div>
  );
}
