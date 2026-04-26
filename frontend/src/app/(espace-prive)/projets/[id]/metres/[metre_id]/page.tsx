"use client";

import { useState, useEffect, use, useCallback, useRef } from "react";
import Link from "next/link";
import { api, ErreurApi, requeteApiAvecProgression, type ProgressionTeleversement } from "@/crochets/useApi";
import { OverlayTeleversement } from "@/composants/ui/EtatTeleversement";
import {
  ArrowLeft, Plus, Pencil, Trash2, CheckCircle,
  AlertCircle, X, Save, ChevronRight, Calculator,
  Ruler, MousePointer, Square, Minus as LineIcon, Hash, ScanLine, Upload, CheckSquare,
  MinusSquare, FunctionSquare, Layers, ImagePlus,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types lignes de métré
// ---------------------------------------------------------------------------

interface LigneMetre {
  id: string;
  metre: string;
  numero_ordre: number;
  code_article: string;
  localisation: string;
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
  localisation: "",
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

// Formate une valeur mesurée : 2 décimales pour m²/ml, 3 décimales pour m³
function formaterMesure(valeur: number, unite: string): string {
  const isVolume = /m[³3]/i.test(unite);
  const dec = isVolume ? 3 : 2;
  return valeur.toLocaleString("fr-FR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

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

// Champ de désignation avec autocomplete CCTP — version compacte pour les zones
function ChampCCTP({ value, onChange, placeholder = "Désignation de la prestation…", className = "" }: {
  value: string; onChange: (v: string) => void; placeholder?: string; className?: string;
}) {
  const [sugg, setSugg] = useState<ArticleCCTPSuggestion[]>([]);
  const [ouvert, setOuvert] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOuvert(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  useEffect(() => {
    const q = value.trim();
    if (q.length < 2) { setSugg([]); return; }
    const t = setTimeout(async () => {
      try {
        const r = await api.get<{ results?: ArticleCCTPSuggestion[] } | ArticleCCTPSuggestion[]>(
          `/api/pieces-ecrites/articles/?search=${encodeURIComponent(q)}&est_dans_bibliotheque=true`
        );
        const liste = Array.isArray(r) ? r : (r.results ?? []);
        setSugg(liste.slice(0, 6));
        if (liste.length > 0) setOuvert(true);
      } catch { setSugg([]); }
    }, 350);
    return () => clearTimeout(t);
  }, [value]);
  return (
    <div className={`relative ${className}`} ref={ref}>
      <input
        type="text" className="champ-saisie w-full text-xs py-1"
        value={value}
        onChange={(e) => { onChange(e.target.value); setOuvert(true); }}
        onFocus={() => { if (sugg.length > 0) setOuvert(true); }}
        placeholder={placeholder} autoComplete="off"
      />
      {ouvert && sugg.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-0.5 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
          <ul className="max-h-44 overflow-y-auto divide-y divide-slate-50">
            {sugg.map((art) => (
              <li key={art.id}>
                <button type="button" className="w-full text-left px-3 py-2 hover:bg-primaire-50 transition"
                  onMouseDown={(e) => { e.preventDefault(); onChange(art.intitule); setSugg([]); setOuvert(false); }}>
                  <p className="text-xs font-medium text-slate-800 truncate">{art.intitule}</p>
                  {(art.code_reference || art.lot_intitule) && (
                    <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                      {[art.code_reference, art.lot_intitule].filter(Boolean).join(" — ")}
                    </p>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
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
        localisation: form.localisation,
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

            {/* Localisation */}
            <div>
              <label className="libelle-champ">Localisation</label>
              <input type="text" className="champ-saisie w-full" placeholder="Ex. : RDC — Séjour, Bât. A niveau 2…"
                value={form.localisation} onChange={(e) => maj("localisation", e.target.value)} />
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
                        {formaterMesure(apercuCalcul.quantite_calculee, form.unite)}
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
                        <p className="mt-1 text-blue-700">= {formaterMesure(etape.valeur, form.unite)}</p>
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

type OutilCanvas = "selection" | "surface" | "longueur" | "comptage" | "calibrer" | "soustraction_surface" | "soustraction_longueur" | "regle";

interface PointCanvas { x: number; y: number; }

interface ZoneVisualisee {
  id: string;
  dbId?: string;          // ID en base (ZoneMesure.id)
  type: "surface" | "longueur" | "comptage";
  mode: "ajout" | "soustraction";
  parentZoneId?: string;  // Pour les soustractions : ID de la zone parent
  sousZoneDeId?: string;  // Pour la hiérarchie : ID de la zone parente (zone 1.1 sous zone 1)
  numeroZone?: string;    // Numéro d'affichage (ex: "1", "1.1", "1.2")
  localisation?: string;
  designation: string;
  unite: string;
  points: PointCanvas[];
  valeur: number;
  hauteur?: number;       // pour les longueurs → surface = longueur × hauteur
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
  const [fondPlanId, setFondPlanId] = useState<string | null>(null); // ID backend du fond de plan actif
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
  const [modalParentSoustraction, setModalParentSoustraction] = useState<ZoneVisualisee | null>(null);
  const [pendingParentId, setPendingParentId] = useState<string | null>(null); // sous-zone en attente : prochaine forme → sous-zone de ce parent
  const [sauvegardeEnCours, setSauvegardeEnCours] = useState(false);
  const [derniereErreurSauvegarde, setDerniereErreurSauvegarde] = useState<string | null>(null);
  const isDragging = useRef(false);
  const isMidDragging = useRef(false); // pan avec bouton milieu (tous outils)
  const didDrag = useRef(false);       // distingue clic simple vs glissement (mode règle)
  const lastMouse = useRef<PointCanvas>({ x: 0, y: 0 });
  const espacePresse = useRef(false); // Space+drag pour panner sans changer d'outil
  const [mesureEnCours, setMesureEnCours] = useState<string | null>(null); // dimension affichée en bas
  const timerSauvegarde = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerPollMiniature = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [miniatureEnCours, setMiniatureEnCours] = useState(false);
  const [chargementImage, setChargementImage] = useState(false);
  // Anti-concurrence : empêche deux saves simultanés ; stocke le dernier snapshot en attente
  const sauvegardeEnCoursRef = useRef(false);
  const pendingZonesRef = useRef<{ zones: ZoneVisualisee[]; fpId: string } | null>(null);
  // Image en attente d'application quand le canvas n'est pas encore visible (onglet inactif)
  const imagePendingRef = useRef<HTMLImageElement | null>(null);
  // Règle de mesure — points temporaires (max 2), réinitialisés à chaque nouvelle mesure
  const [reglePoints, setReglePoints] = useState<PointCanvas[]>([]);
  // Gestion multipage — tous les fonds de plan disponibles pour ce métré
  const [fondsPlans, setFondsPlans] = useState<Array<{
    id: string; intitule: string; url_fichier?: string; url_apercu?: string; url_miniature?: string; format_fichier?: string; echelle?: number;
  }>>([]);
  // true tant que la miniature HD n'est pas encore chargée (aperçu affiché en attendant)
  const [fondPlanEstApercu, setFondPlanEstApercu] = useState(false);
  // Fond de plan secondaire (superposition semi-transparente)
  const [fondPlanSecondaire, setFondPlanSecondaire] = useState<HTMLImageElement | null>(null);
  const [fondPlanSecondaireId, setFondPlanSecondaireId] = useState<string | null>(null);
  const [opaciteSecondaire, setOpaciteSecondaire] = useState(0.4);
  const [panneauSuppressionFond, setPanneauSuppressionFond] = useState(false);

  // Accroche objet (snap) — points en coordonnées image normalisées [0,1] + type ("e","m","c","q","z")
  const [pointsAccroche, setPointsAccroche] = useState<Array<[number, number, string?]>>([]);
  const [pointSnap, setPointSnap] = useState<PointCanvas | null>(null);
  const [pointSnapType, setPointSnapType] = useState<string>("e");
  const [accrocheActive, setAccrocheActive] = useState(true);
  const [echelleAutoInfo, setEchelleAutoInfo] = useState<{ confiance: string; methode: string; details: string } | null>(null);
  const RAYON_SNAP_PX = 16; // pixels écran

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
      // Image en attente (canvas était masqué lors du chargement) → appliquer maintenant
      if (w > 0 && imagePendingRef.current) {
        const img = imagePendingRef.current;
        imagePendingRef.current = null;
        const fitZoom = Math.min(w / img.width, h / img.height) * 0.92;
        setZoom(fitZoom);
        setOffsetCanvas({ x: (w - img.width * fitZoom) / 2, y: (h - img.height * fitZoom) / 2 });
        setFondPlan(img);
        setTimeout(() => setProgressionFond(null), 600);
      }
    };

    ajusterTaille();
    const obs = new ResizeObserver(ajusterTaille);
    obs.observe(conteneur);
    return () => {
      obs.disconnect();
      if (timerPollMiniature.current) clearTimeout(timerPollMiniature.current);
    };
  }, []);

  // Sauvegarde atomique des zones en BDD — une seule instance à la fois
  const sauvegarderZonesBDD = useCallback(async (zonesAEnregistrer: ZoneVisualisee[], fpId: string) => {
    if (!fpId) return;
    // Si une sauvegarde tourne déjà, stocker le snapshot le plus récent et sortir
    if (sauvegardeEnCoursRef.current) {
      pendingZonesRef.current = { zones: zonesAEnregistrer, fpId };
      return;
    }
    sauvegardeEnCoursRef.current = true;
    setSauvegardeEnCours(true);
    setDerniereErreurSauvegarde(null);
    try {
      const zonesExistantes = await api.get<Array<{ id: string }>>(`/api/metres/${metreId}/fonds-plan/${fpId}/zones/`);
      const idsExistants = new Set(zonesExistantes.map((z) => z.id));
      const idsLocaux = new Set(zonesAEnregistrer.filter((z) => z.dbId).map((z) => z.dbId!));
      for (const id of idsExistants) {
        if (!idsLocaux.has(id)) {
          await api.supprimer(`/api/metres/${metreId}/fonds-plan/${fpId}/zones/${id}/`);
        }
      }
      const nouvellesAssociations: Record<string, string> = {};
      for (const zone of zonesAEnregistrer.filter((z) => z.mode === "ajout")) {
        if (zone.points.length === 0) continue; // zone vide, on ignore
        const deductionsFilles = zonesAEnregistrer
          .filter((z) => z.mode === "soustraction" && z.parentZoneId === zone.id)
          .map((d) => ({
            designation: d.designation,
            points_px: d.points.map((p) => [p.x, p.y]),
            surface_m2: d.valeur,
          }));
        // Résoudre le dbId de la zone parente (hiérarchie)
        const parentDbId = zone.sousZoneDeId
          ? (zonesAEnregistrer.find((z) => z.id === zone.sousZoneDeId)?.dbId ?? null)
          : null;
        const payload = {
          localisation: zone.localisation ?? "",
          designation: zone.designation,
          type_mesure: zone.type,
          points_px: zone.points.map((p) => [p.x, p.y]),
          deductions: deductionsFilles,
          unite: zone.unite,
          couleur: zone.couleur,
          ordre: zonesAEnregistrer.filter((z) => z.mode === "ajout").indexOf(zone),
          zone_parente: parentDbId,
          numero: zone.numeroZone ?? "",
        };
        if (zone.dbId) {
          await api.patch(`/api/metres/${metreId}/fonds-plan/${fpId}/zones/${zone.dbId}/`, payload);
        } else {
          const result = await api.post<{ id: string }>(`/api/metres/${metreId}/fonds-plan/${fpId}/zones/`, payload);
          nouvellesAssociations[zone.id] = result.id;
        }
      }
      if (Object.keys(nouvellesAssociations).length > 0) {
        setZones((prev) => prev.map((z) =>
          nouvellesAssociations[z.id] ? { ...z, dbId: nouvellesAssociations[z.id] } : z
        ));
      }
    } catch {
      setDerniereErreurSauvegarde("Sauvegarde impossible — travail non perdu");
    } finally {
      sauvegardeEnCoursRef.current = false;
      setSauvegardeEnCours(false);
      // S'il y a un snapshot plus récent en attente, le sauvegarder immédiatement
      if (pendingZonesRef.current) {
        const pending = pendingZonesRef.current;
        pendingZonesRef.current = null;
        void sauvegarderZonesBDD(pending.zones, pending.fpId);
      }
    }
  }, [metreId]);

  const planifierSauvegarde = useCallback((zonesAEnregistrer: ZoneVisualisee[], fpId: string | null) => {
    if (!fpId) return;
    if (timerSauvegarde.current) clearTimeout(timerSauvegarde.current);
    // Toujours garder le snapshot le plus récent pour le timer
    pendingZonesRef.current = { zones: zonesAEnregistrer, fpId };
    timerSauvegarde.current = setTimeout(() => {
      if (pendingZonesRef.current) {
        const pending = pendingZonesRef.current;
        pendingZonesRef.current = null;
        void sauvegarderZonesBDD(pending.zones, pending.fpId);
      }
    }, 1500);
  }, [sauvegarderZonesBDD]);

  // Chargement initial — tous les fonds de plan + zones du premier
  useEffect(() => {
    const chargerExistant = async () => {
      try {
        const fonds = await api.get<Array<{
          id: string; intitule: string; url_fichier?: string; url_apercu?: string; url_miniature?: string; format_fichier?: string; echelle?: unknown;
        }>>(`/api/metres/${metreId}/fonds-plan/`);
        if (!fonds.length) return;
        const fondsNorm = fonds.map((f) => ({
          ...f,
          echelle: f.echelle != null ? Number(f.echelle) : undefined,
        }));
        setFondsPlans(fondsNorm);
        // chargerFondActif est défini plus bas dans le composant — accessible via closure
        await chargerFondActif(fondsNorm[0]);
      } catch {
        // Pas de fond plan existant — cas normal
      }
    };
    void chargerExistant();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metreId]);

  // Export PNG
  const exporterImage = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const lien = document.createElement("a");
    lien.download = `metre-visuel-${Date.now()}.png`;
    lien.href = canvas.toDataURL("image/png");
    lien.click();
  }, []);

  // Export PDF via fenêtre d'impression avec légende
  const exporterPDF = useCallback((zonesLocales: ZoneVisualisee[], echelle: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const imageUrl = canvas.toDataURL("image/png");
    const lignesLegende = zonesLocales.filter((z) => z.mode === "ajout").map((z) => {
      const deductions = zonesLocales.filter((d) => d.mode === "soustraction" && d.parentZoneId === z.id);
      const totalDeductions = deductions.reduce((s, d) => s + d.valeur, 0);
      const valeurNette = z.valeur - totalDeductions;
      return { ...z, totalDeductions, valeurNette, deductions_zones: deductions };
    });
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Métré visuel — Export PDF</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 0; padding: 20px; }
  img.plan { max-width: 100%; border: 1px solid #e2e8f0; border-radius: 8px; display: block; margin-bottom: 24px; }
  h1 { font-size: 18px; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { background: #f1f5f9; padding: 6px 10px; text-align: left; border: 1px solid #e2e8f0; font-weight: 600; }
  td { padding: 5px 10px; border: 1px solid #e2e8f0; }
  tr.soustraction td { color: #dc2626; font-size: 11px; padding-left: 24px; }
  tr.nette td { font-weight: 600; background: #f0fdf4; }
  .puce { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 6px; vertical-align: middle; }
  @media print { body { padding: 0; } }
</style></head><body>
<h1>Métré visuel — ${new Date().toLocaleDateString("fr-FR")}</h1>
<img class="plan" src="${imageUrl}" />
<table>
<thead><tr><th>Zone</th><th>Type</th><th>Valeur brute</th><th>Unité</th><th>Échelle</th></tr></thead>
<tbody>
${lignesLegende.map((z) => `
  <tr>
    <td><span class="puce" style="background:${z.couleur}"></span>${z.designation}</td>
    <td>${z.type === "surface" ? "Surface" : z.type === "longueur" ? "Longueur" : "Comptage"}</td>
    <td>${formaterMesure(z.valeur, z.unite)}</td>
    <td>${z.unite}</td>
    <td>${echelle.toFixed(1)} px/m</td>
  </tr>
  ${z.deductions_zones.map((d) => `
  <tr class="soustraction">
    <td>↳ − ${d.designation}</td>
    <td>Déduction</td>
    <td>− ${formaterMesure(d.valeur, z.unite)}</td>
    <td>${d.unite}</td>
    <td></td>
  </tr>`).join("")}
  ${z.deductions_zones.length > 0 ? `
  <tr class="nette">
    <td colspan="2">Valeur nette — ${z.designation}</td>
    <td>${formaterMesure(z.valeurNette, z.unite)}</td>
    <td>${z.unite}</td>
    <td></td>
  </tr>` : ""}
`).join("")}
</tbody></table>
<script>window.onload = function() { window.print(); }</script>
</body></html>`;
    const fenetre = window.open("", "_blank");
    if (fenetre) { fenetre.document.write(html); fenetre.document.close(); }
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
      // Superposition semi-transparente du fond secondaire
      if (fondPlanSecondaire) {
        ctx.globalAlpha = opaciteSecondaire;
        ctx.drawImage(fondPlanSecondaire, 0, 0);
        ctx.globalAlpha = 1;
      }
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

        // zone.valeur est déjà en unités réelles (m², ml, u) — ne pas diviser à nouveau par l'échelle
        let valAff = "";
        if (zone.type === "comptage") {
          valAff = `${zone.points.length} u`;
        } else if (zone.type === "longueur" && zone.hauteur) {
          const surf = zone.valeur * zone.hauteur; // ml × m → m²
          valAff = `${surf.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} m²`;
        } else {
          valAff = `${zone.valeur.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} ${zone.unite}`;
        }

        if (zone.mode === "soustraction") {
          ctx.fillStyle = COULEUR_SOUSTRACTION;
          ctx.fillText(`− ${zone.localisation || zone.designation}`, cx, cy);
        } else {
          ctx.fillText(zone.localisation || zone.designation, cx, cy);
        }
        ctx.font = `${11 / zoom}px system-ui`;
        ctx.fillStyle = couleur;
        ctx.fillText(valAff, cx, cy + 14 / zoom);
      }
    });

    // Ligne de calibration en cours
    if (outil === "calibrer" && calibrationPoints.length >= 1) {
      ctx.globalAlpha = 1;
      ctx.strokeStyle = "#f59e0b";
      ctx.fillStyle = "#f59e0b";
      ctx.lineWidth = 2 / zoom;
      ctx.setLineDash([6 / zoom, 3 / zoom]);
      ctx.beginPath();
      ctx.moveTo(calibrationPoints[0].x, calibrationPoints[0].y);
      if (mousePos) ctx.lineTo(mousePos.x, mousePos.y);
      ctx.stroke();
      ctx.setLineDash([]);
      // Croix sur le 1er point
      const r = 6 / zoom;
      ctx.beginPath(); ctx.arc(calibrationPoints[0].x, calibrationPoints[0].y, r, 0, Math.PI * 2); ctx.fill();
    }

    // Tracé en cours (pointillés)
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
      // Fermeture visuelle de la surface
      if ((outil === "surface" || outil === "soustraction_surface") && pointsEnCours.length >= 3 && mousePos) {
        ctx.lineTo(mousePos.x, mousePos.y);
        // Aperçu fermeture
        ctx.setLineDash([2 / zoom, 4 / zoom]);
        ctx.lineTo(pointsEnCours[0].x, pointsEnCours[0].y);
      } else if (mousePos && outil !== "comptage") {
        ctx.lineTo(mousePos.x, mousePos.y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      // Points de contrôle
      pointsEnCours.forEach((p, i) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4 / zoom, 0, Math.PI * 2);
        ctx.fill();
        // Numéro du point
        if (i === 0) {
          ctx.fillStyle = "#1e293b";
          ctx.font = `bold ${9 / zoom}px system-ui`;
          ctx.textAlign = "center";
          ctx.fillText("①", p.x, p.y - 6 / zoom);
          ctx.fillStyle = couleurTrace;
        }
      });

      // Étiquette de mesure temps réel près de la souris
      if (mousePos && echellePixelParMetre > 0) {
        let label = "";
        if (outil === "longueur" || outil === "soustraction_longueur") {
          const longueurM = calculerLongueur([...pointsEnCours, mousePos]) / echellePixelParMetre;
          label = `${longueurM.toFixed(2)} ml`;
        } else if ((outil === "surface" || outil === "soustraction_surface") && pointsEnCours.length >= 2) {
          const surfaceM2 = calculerSurface([...pointsEnCours, mousePos]) / (echellePixelParMetre * echellePixelParMetre);
          label = `${surfaceM2.toFixed(2)} m²`;
        }
        if (label) {
          const lx = mousePos.x + 12 / zoom;
          const ly = mousePos.y - 8 / zoom;
          ctx.font = `bold ${11 / zoom}px system-ui`;
          ctx.textAlign = "left";
          const w = ctx.measureText(label).width;
          ctx.fillStyle = "rgba(15,23,42,0.75)";
          ctx.fillRect(lx - 3 / zoom, ly - 12 / zoom, w + 6 / zoom, 16 / zoom);
          ctx.fillStyle = "#f1f5f9";
          ctx.fillText(label, lx, ly);
        }
      }
    }

    // Règle de mesure — tracé temporaire en vert avec cotation (multi-points)
    if (outil === "regle" && echellePixelParMetre > 0) {
      const tousPoints = mousePos && reglePoints.length >= 1
        ? [...reglePoints, mousePos]
        : reglePoints;
      if (tousPoints.length >= 2) {
        ctx.globalAlpha = 1;
        ctx.strokeStyle = "#16a34a";
        ctx.lineWidth = 2 / zoom;
        ctx.setLineDash([]);
        // Tracé polyline
        ctx.beginPath();
        ctx.moveTo(tousPoints[0].x, tousPoints[0].y);
        for (let i = 1; i < tousPoints.length; i++) ctx.lineTo(tousPoints[i].x, tousPoints[i].y);
        ctx.stroke();
        // Remplissage polygone si >= 3 points fixés
        if (reglePoints.length >= 3) {
          ctx.globalAlpha = 0.1;
          ctx.fillStyle = "#16a34a";
          ctx.beginPath();
          ctx.moveTo(reglePoints[0].x, reglePoints[0].y);
          for (let i = 1; i < reglePoints.length; i++) ctx.lineTo(reglePoints[i].x, reglePoints[i].y);
          ctx.closePath();
          ctx.fill();
          ctx.globalAlpha = 1;
        }
        // Longueur totale
        let perimPx = 0;
        for (let i = 0; i < tousPoints.length - 1; i++) {
          const dx = tousPoints[i + 1].x - tousPoints[i].x;
          const dy = tousPoints[i + 1].y - tousPoints[i].y;
          perimPx += Math.sqrt(dx * dx + dy * dy);
        }
        const perimM = perimPx / echellePixelParMetre;
        // Étiquette longueur totale au centroïde
        const cxR = tousPoints.reduce((s, p) => s + p.x, 0) / tousPoints.length;
        const cyR = tousPoints.reduce((s, p) => s + p.y, 0) / tousPoints.length - 14 / zoom;
        ctx.font = `bold ${12 / zoom}px system-ui`;
        ctx.textAlign = "center";
        let labelRegle = `${perimM.toFixed(2)} ml`;
        // Surface si >= 3 points fixés
        if (reglePoints.length >= 3) {
          const surfPx = calculerSurface(reglePoints);
          const surfM2 = surfPx / (echellePixelParMetre * echellePixelParMetre);
          labelRegle = `${perimM.toFixed(2)} ml  |  ${surfM2.toFixed(2)} m²`;
        }
        const tw = ctx.measureText(labelRegle).width;
        ctx.fillStyle = "#15803d";
        ctx.fillRect(cxR - tw / 2 - 4 / zoom, cyR - 13 / zoom, tw + 8 / zoom, 17 / zoom);
        ctx.fillStyle = "white";
        ctx.fillText(labelRegle, cxR, cyR);
        // Segment actif : étiquette distance depuis dernier point fixé
        if (mousePos && reglePoints.length >= 1) {
          const last = reglePoints[reglePoints.length - 1];
          const ddx = mousePos.x - last.x;
          const ddy = mousePos.y - last.y;
          const segM = Math.sqrt(ddx * ddx + ddy * ddy) / echellePixelParMetre;
          const smx = (last.x + mousePos.x) / 2;
          const smy = (last.y + mousePos.y) / 2 - 8 / zoom;
          const segLabel = `${segM.toFixed(2)} ml`;
          const stw = ctx.measureText(segLabel).width;
          ctx.globalAlpha = 0.85;
          ctx.fillStyle = "#15803d";
          ctx.fillRect(smx - stw / 2 - 3 / zoom, smy - 11 / zoom, stw + 6 / zoom, 14 / zoom);
          ctx.fillStyle = "white";
          ctx.fillText(segLabel, smx, smy);
          ctx.globalAlpha = 1;
        }
      } else if (reglePoints.length === 0 && mousePos) {
        // Aperçu premier point
        ctx.globalAlpha = 0.6;
        ctx.strokeStyle = "#16a34a";
        ctx.lineWidth = 1.5 / zoom;
        ctx.setLineDash([5 / zoom, 3 / zoom]);
        ctx.beginPath(); ctx.moveTo(mousePos.x, mousePos.y); ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }
      // Points fixés
      ctx.fillStyle = "#16a34a";
      ctx.globalAlpha = 1;
      for (const rp of reglePoints) {
        ctx.beginPath(); ctx.arc(rp.x, rp.y, 4 / zoom, 0, Math.PI * 2); ctx.fill();
      }
    }

    // Réticule de précision — remplace le curseur OS pour tous les outils de tracé
    const outilsTracé: OutilCanvas[] = ["regle", "surface", "longueur", "soustraction_surface", "soustraction_longueur", "comptage", "calibrer"];
    if (mousePos && outilsTracé.includes(outil) && !isDragging.current && !isMidDragging.current) {
      const cx = mousePos.x;
      const cy = mousePos.y;
      const bras = 14 / zoom;
      const gap = 4 / zoom;
      const couleurReticule = outil === "regle" || outil === "calibrer" ? "#16a34a"
        : (outil === "soustraction_surface" || outil === "soustraction_longueur") ? "#ef4444"
        : "#0ea5e9";

      ctx.globalAlpha = 1;
      ctx.setLineDash([]);

      // Ombre portée pour contraste sur fonds clairs et sombres
      const dessinerBras = (couleur: string, lw: number) => {
        ctx.strokeStyle = couleur;
        ctx.lineWidth = lw / zoom;
        ctx.beginPath();
        ctx.moveTo(cx - bras, cy); ctx.lineTo(cx - gap, cy);
        ctx.moveTo(cx + gap, cy); ctx.lineTo(cx + bras, cy);
        ctx.moveTo(cx, cy - bras); ctx.lineTo(cx, cy - gap);
        ctx.moveTo(cx, cy + gap); ctx.lineTo(cx, cy + bras);
        ctx.stroke();
      };

      dessinerBras("rgba(0,0,0,0.5)", 3);   // ombre
      dessinerBras(couleurReticule, 1.5);    // réticule coloré

      // Petit point central
      ctx.fillStyle = couleurReticule;
      ctx.beginPath();
      ctx.arc(cx, cy, 1.5 / zoom, 0, Math.PI * 2);
      ctx.fill();

      const etiquetteTemporaireDejaDessinee =
        pointsEnCours.length > 0 && (
          outil === "longueur"
          || outil === "soustraction_longueur"
          || outil === "surface"
          || outil === "soustraction_surface"
        );

      // Coordonnées en temps réel (distance depuis dernier point posé)
      if (!etiquetteTemporaireDejaDessinee && echellePixelParMetre > 0 && (outil === "regle" ? reglePoints.length === 1 : pointsEnCours.length > 0)) {
        const ptRef = outil === "regle" ? reglePoints[reglePoints.length - 1] : pointsEnCours[pointsEnCours.length - 1];
        if (ptRef) {
          const dxPx = cx - ptRef.x;
          const dyPx = cy - ptRef.y;
          const distPx = Math.sqrt(dxPx * dxPx + dyPx * dyPx);
          const dist = outil === "surface" || outil === "soustraction_surface"
            ? `≈ ${(distPx / echellePixelParMetre).toFixed(2)} m`
            : `${(distPx / echellePixelParMetre).toFixed(2)} m`;
          ctx.font = `${10 / zoom}px system-ui`;
          ctx.textAlign = "left";
          const tw = ctx.measureText(dist).width;
          const lx = cx + bras + 4 / zoom;
          const ly = cy - 4 / zoom;
          ctx.fillStyle = "rgba(15,23,42,0.75)";
          ctx.fillRect(lx - 2 / zoom, ly - 10 / zoom, tw + 6 / zoom, 13 / zoom);
          ctx.fillStyle = "#f8fafc";
          ctx.fillText(dist, lx + 1 / zoom, ly);
        }
      }
    }

    // Indicateur d'accroche objet — visuel différencié par type
    if (pointSnap && outil !== "selection") {
      const r = 9 / zoom;
      const lw = 1.5 / zoom;
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.lineWidth = lw;

      const COULEURS: Record<string, [string, string]> = {
        e: ["#f59e0b", "rgba(251,191,36,0.15)"],  // Extrémité — jaune
        m: ["#3b82f6", "rgba(59,130,246,0.15)"],  // Milieu — bleu
        c: ["#10b981", "rgba(16,185,129,0.15)"],  // Centre — vert
        q: ["#8b5cf6", "rgba(139,92,246,0.15)"],  // Quadrant — violet
        z: ["#ef4444", "rgba(239,68,68,0.15)"],   // Zone — rouge
      };
      const [stroke, fill] = COULEURS[pointSnapType] ?? COULEURS["e"];
      ctx.strokeStyle = stroke;
      ctx.fillStyle = fill;

      if (pointSnapType === "e" || pointSnapType === "z") {
        // Carré pour extrémité / sommet de zone
        ctx.beginPath();
        ctx.rect(pointSnap.x - r, pointSnap.y - r, r * 2, r * 2);
        ctx.fill(); ctx.stroke();
      } else if (pointSnapType === "m") {
        // Losange pour milieu
        ctx.beginPath();
        ctx.moveTo(pointSnap.x, pointSnap.y - r);
        ctx.lineTo(pointSnap.x + r, pointSnap.y);
        ctx.lineTo(pointSnap.x, pointSnap.y + r);
        ctx.lineTo(pointSnap.x - r, pointSnap.y);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
      } else if (pointSnapType === "c") {
        // Cercle + point central pour centre
        ctx.beginPath();
        ctx.arc(pointSnap.x, pointSnap.y, r, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        ctx.beginPath();
        ctx.arc(pointSnap.x, pointSnap.y, r * 0.2, 0, Math.PI * 2);
        ctx.fillStyle = stroke; ctx.fill();
      } else {
        // Cercle + croix pour quadrant
        ctx.beginPath();
        ctx.arc(pointSnap.x, pointSnap.y, r, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(pointSnap.x - r * 0.7, pointSnap.y);
        ctx.lineTo(pointSnap.x + r * 0.7, pointSnap.y);
        ctx.moveTo(pointSnap.x, pointSnap.y - r * 0.7);
        ctx.lineTo(pointSnap.x, pointSnap.y + r * 0.7);
        ctx.stroke();
      }

      // Label de type
      const LABELS: Record<string, string> = {
        e: "Extrémité", m: "Milieu", c: "Centre", q: "Quadrant", z: "Zone",
      };
      const label = LABELS[pointSnapType] ?? "Accroche";
      ctx.font = `${10 / zoom}px system-ui`;
      ctx.textAlign = "left";
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = stroke;
      ctx.fillRect(pointSnap.x + r + 2 / zoom, pointSnap.y - 9 / zoom, tw + 4 / zoom, 12 / zoom);
      ctx.fillStyle = "#fff";
      ctx.fillText(label, pointSnap.x + r + 4 / zoom, pointSnap.y);

      ctx.restore();
    }

    ctx.restore();
  }, [fondPlan, fondPlanSecondaire, opaciteSecondaire, zones, zoneSelectionnee, pointsEnCours, mousePos, pointSnap, pointSnapType, offset, zoom, echellePixelParMetre, outil, calibrationPoints, reglePoints]);

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

    const zonesAjout = zones.filter((z) => z.mode === "ajout");

    // Calcul du numéro et du parent pour la sous-zone
    let sousZoneDeId: string | undefined;
    let numeroZone: string | undefined;
    let designation: string;

    let localisation = "";
    if (!estSoustraction && pendingParentId) {
      // Mode sous-zone : tag la zone avec le parent
      const parent = zones.find((z) => z.id === pendingParentId);
      sousZoneDeId = pendingParentId;
      const existingChildren = zones.filter((z) => z.sousZoneDeId === pendingParentId);
      const parentNum = parent?.numeroZone || String(zonesAjout.filter((z) => !z.sousZoneDeId).indexOf(parent!) + 1);
      numeroZone = `${parentNum}.${existingChildren.length + 1}`;
      localisation = `Zone ${numeroZone}`;
      designation = "";
    } else {
      if (estSoustraction) {
        localisation = `Déduction ${zones.filter((z) => z.mode === "soustraction").length + 1}`;
      } else {
        localisation = `Zone ${zonesAjout.filter((z) => !z.sousZoneDeId).length + 1}`;
      }
      designation = "";
    }

    const nouvelleZone: ZoneVisualisee = {
      id: `zone-${Date.now()}`,
      type: typeZone,
      mode: estSoustraction ? "soustraction" : "ajout",
      localisation,
      designation,
      sousZoneDeId,
      numeroZone,
      unite: typeZone === "surface" ? "m²" : typeZone === "longueur" ? "ml" : "u",
      points: [...pointsEnCours],
      valeur: valeurReelle,
      deductions: [],
      couleur,
    };

    if (estSoustraction) {
      if (zonesAjout.length === 0) {
        setErreurFond("Créez d'abord une zone de base (surface ou longueur) avant d'ajouter une déduction.");
        setPointsEnCours([]);
        return;
      }
      // Cherche la zone sélectionnée parmi les zones ajout (y compris sous-zones)
      const parentSelectionne = zonesAjout.find((z) => z.id === zoneSelectionnee);
      if (parentSelectionne) {
        nouvelleZone.parentZoneId = parentSelectionne.id;
        setZones((prev) => {
          const nouvelles = [...prev, nouvelleZone];
          planifierSauvegarde(nouvelles, fondPlanId);
          return nouvelles;
        });
        setPointsEnCours([]);
        setZoneSelectionnee(nouvelleZone.id);
        // Pour une déduction longueur, demander la hauteur automatiquement
        if (typeZone === "longueur") {
          setModalHauteur({ zoneId: nouvelleZone.id, hauteurActuelle: "" });
        }
      } else {
        setModalParentSoustraction(nouvelleZone);
        setPointsEnCours([]);
      }
      return;
    }

    // Zone d'ajout (principale ou sous-zone)
    setPendingParentId(null); // réinitialiser le mode sous-zone après création
    setZones((prev) => {
      // Insérer la sous-zone après les sous-zones existantes du même parent, ou à la fin
      if (sousZoneDeId) {
        const lastChildIdx = prev.reduce((acc, z, i) => z.sousZoneDeId === sousZoneDeId ? i : acc, -1);
        const insertAt = lastChildIdx >= 0 ? lastChildIdx + 1 : prev.length;
        const res = [...prev];
        res.splice(insertAt, 0, nouvelleZone);
        planifierSauvegarde(res, fondPlanId);
        return res;
      }
      const nouvelles = [...prev, nouvelleZone];
      planifierSauvegarde(nouvelles, fondPlanId);
      return nouvelles;
    });
    setPointsEnCours([]);
    setZoneSelectionnee(nouvelleZone.id);
  }, [outil, pointsEnCours, echellePixelParMetre, zones, zoneSelectionnee, fondPlanId, planifierSauvegarde, pendingParentId]);

  const gererClic = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    // Si l'utilisateur a glissé pour panner, ignorer ce clic (ne pas ajouter de point)
    if (didDrag.current) {
      didDrag.current = false;
      return;
    }
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
      const pt = pointSnap ?? coordCanvas(e);
      setCalibrationPoints((prev) => {
        const next = [...prev, pt];
        if (next.length === 2 && longueurConnue) {
          const dx = next[1].x - next[0].x;
          const dy = next[1].y - next[0].y;
          const pixels = Math.sqrt(dx * dx + dy * dy);
          const metres = parseFloat(longueurConnue);
          if (metres > 0 && pixels > 0) {
            const nouvelleEchelle = pixels / metres;
            setEchellePixelParMetre(nouvelleEchelle);
            setEchelleAutoInfo(null); // Calibration manuelle — effacer le bandeau auto
            // Persiste l'échelle en base de données
            if (fondPlanId) {
              void api.post(`/api/metres/${metreId}/fonds-plan/${fondPlanId}/calibrer/`, {
                point_a: [next[0].x, next[0].y],
                point_b: [next[1].x, next[1].y],
                distance_metres: metres,
              }).then(() => {
                // Met à jour l'entrée dans fondsPlans pour que le switch de plan recharge la bonne échelle
                setFondsPlans((prev) => prev.map((fp) =>
                  fp.id === fondPlanId ? { ...fp, echelle: nouvelleEchelle } : fp
                ));
              }).catch(() => {
                // Calibration sauvegardée localement uniquement en cas d'erreur réseau
              });
            }
          }
          return [];
        }
        return next;
      });
      return;
    }
    if (outil === "regle") {
      const pt = pointSnap ?? coordCanvas(e);
      setReglePoints((prev) => [...prev, pt]);
      return;
    }
    const pt = pointSnap ?? coordCanvas(e);
    setPointsEnCours((prev) => [...prev, pt]);
  };

  const gererClicDroit = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (outil === "selection") return;
    if (outil === "regle") { setReglePoints([]); return; }
    finaliserZone();
  };

  // Zoom via molette — utilise addEventListener natif avec passive:false
  // pour pouvoir appeler e.preventDefault() et empêcher le défilement de page.
  // Clamp offset pour garder au moins 60px de l'image toujours visible
  const clampOffset = useCallback((ox: number, oy: number, z: number): PointCanvas => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: ox, y: oy };
    const marge = 60; // px minimum visibles
    const largeurContenu = fondPlan ? fondPlan.width * z : canvas.width;
    const hauteurContenu = fondPlan ? fondPlan.height * z : canvas.height;
    const xMin = marge - largeurContenu;
    const xMax = canvas.width - marge;
    const yMin = marge - hauteurContenu;
    const yMax = canvas.height - marge;
    return {
      x: Math.min(xMax, Math.max(xMin, ox)),
      y: Math.min(yMax, Math.max(yMin, oy)),
    };
  }, [fondPlan]);

  const zoomRef = useRef(zoom);
  const offsetRef = useRef(offset);
  zoomRef.current = zoom;
  offsetRef.current = offset;

  const clampOffsetRef = useRef(clampOffset);
  clampOffsetRef.current = clampOffset;

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
      const facteur = e.deltaY < 0 ? 1.12 : 0.9;
      const z = zoomRef.current;
      const o = offsetRef.current;
      const nz = Math.min(10, Math.max(0.05, z * facteur));
      const nx = mx - (mx - o.x) * (nz / z);
      const ny = my - (my - o.y) * (nz / z);
      const clamped = clampOffsetRef.current(nx, ny, nz);
      setZoom(nz);
      setOffsetCanvas(clamped);
    };
    canvas.addEventListener("wheel", handler, { passive: false });
    return () => canvas.removeEventListener("wheel", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const gererMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    lastMouse.current = { x: e.clientX, y: e.clientY };
    // Bouton milieu → pan universel (preventDefault natif via useEffect dédié)
    if (e.button === 1) {
      isMidDragging.current = true;
      didDrag.current = false;
      return;
    }
    // Bouton gauche → pan potentiel dans tous les outils (didDrag discrimine clic vs glissement)
    if (e.button === 0) {
      isDragging.current = true;
      didDrag.current = false;
    }
  };

  const gererMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pt = coordCanvas(e);

    // Accroche objet : cherche le point le plus proche (plan + zones existantes)
    let snap: PointCanvas | null = null;
    let snapType = "e";
    if (accrocheActive && fondPlan && outil !== "selection") {
      const imgW = fondPlan.naturalWidth;
      const imgH = fondPlan.naturalHeight;
      const rayonImg = RAYON_SNAP_PX / zoom;
      // Priorité : endpoints (e/q) > milieux (m) > centres (c) > zones (z)
      const PRIO: Record<string, number> = { e: 0, q: 1, m: 2, c: 3, z: 4 };
      let distMin = Infinity;
      let prioMin = 9;

      // Points extraits du plan
      for (const [nx, ny, typ] of pointsAccroche) {
        const px = nx * imgW;
        const py = ny * imgH;
        const d = Math.hypot(px - pt.x, py - pt.y);
        const p = PRIO[typ ?? "e"] ?? 4;
        if (d < rayonImg && (d < distMin - 1 || (d < distMin + 1 && p < prioMin))) {
          distMin = d; prioMin = p;
          snap = { x: px, y: py }; snapType = typ ?? "e";
        }
      }

      // Accroche sur les sommets des zones existantes
      for (const zone of zones) {
        for (const zpt of zone.points) {
          const d = Math.hypot(zpt.x - pt.x, zpt.y - pt.y);
          const p = PRIO["z"];
          if (d < rayonImg && (d < distMin - 1 || (d < distMin + 1 && p < prioMin))) {
            distMin = d; prioMin = p;
            snap = { x: zpt.x, y: zpt.y }; snapType = "z";
          }
        }
      }
    }
    setPointSnap(snap);
    setPointSnapType(snapType);
    setMousePos(snap ?? pt);

    const isPanning = isDragging.current || isMidDragging.current;
    if (isPanning) {
      const dx = e.clientX - lastMouse.current.x;
      const dy = e.clientY - lastMouse.current.y;
      // Seuil minimal pour distinguer un clic d'un glissement (5 px)
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) didDrag.current = true;
      if (didDrag.current) {
        setOffsetCanvas((prev) => clampOffset(prev.x + dx, prev.y + dy, zoomRef.current));
      }
      lastMouse.current = { x: e.clientX, y: e.clientY };
      return;
    }
    lastMouse.current = { x: e.clientX, y: e.clientY };

    // Mesure temps réel pendant le tracé
    if (mousePos && pointsEnCours.length > 0) {
      if (outil === "longueur" || outil === "soustraction_longueur") {
        const longueurPx = calculerLongueur([...pointsEnCours, pt]);
        setMesureEnCours(`${(longueurPx / echellePixelParMetre).toFixed(2)} ml`);
      } else if (outil === "surface" || outil === "soustraction_surface") {
        if (pointsEnCours.length >= 2) {
          const surfacePx = calculerSurface([...pointsEnCours, pt]);
          setMesureEnCours(`≈ ${(surfacePx / (echellePixelParMetre * echellePixelParMetre)).toFixed(2)} m²`);
        }
      } else if (outil === "calibrer" && calibrationPoints.length === 1) {
        const dx = pt.x - calibrationPoints[0].x;
        const dy = pt.y - calibrationPoints[0].y;
        const pixels = Math.sqrt(dx * dx + dy * dy);
        const m = parseFloat(longueurConnue);
        setMesureEnCours(m > 0 ? `1m = ${(pixels / m).toFixed(1)} px/m` : `${pixels.toFixed(0)} px`);
      } else {
        setMesureEnCours(null);
      }
    } else {
      setMesureEnCours(null);
    }
  };

  const gererMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 1) {
      isMidDragging.current = false;
    } else {
      isDragging.current = false;
    }
  };

  // Espace pour activer temporairement le pan
  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.code === "Space" && !e.repeat) espacePresse.current = true; };
    const up = (e: KeyboardEvent) => { if (e.code === "Space") espacePresse.current = false; };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  // Bloque le comportement natif "auto-scroll" du navigateur sur bouton milieu (passive: false requis)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const bloquerScrollMilieu = (e: MouseEvent) => {
      if (e.button === 1) e.preventDefault();
    };
    canvas.addEventListener("mousedown", bloquerScrollMilieu, { passive: false });
    canvas.addEventListener("auxclick", bloquerScrollMilieu, { passive: false });
    return () => {
      canvas.removeEventListener("mousedown", bloquerScrollMilieu);
      canvas.removeEventListener("auxclick", bloquerScrollMilieu);
    };
  }, []);

  const chargerImageDepuisUrl = (url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Impossible de charger : ${url.substring(0, 80)}`));
      img.src = url;
    });
  };

  const chargerPremierePage = async (url: string): Promise<HTMLImageElement> => {
    const pdfjsLib = await import("pdfjs-dist");
    pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    const tache = pdfjsLib.getDocument({ url, withCredentials: false });
    const pdf = await tache.promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 2.0 });
    const offscreen = document.createElement("canvas");
    offscreen.width = viewport.width;
    offscreen.height = viewport.height;
    const ctx = offscreen.getContext("2d")!;
    await page.render({ canvasContext: ctx, canvas: offscreen, viewport }).promise;
    const dataUrl = offscreen.toDataURL("image/png");
    return chargerImageDepuisUrl(dataUrl);
  };

  const appliquerImageSurCanvas = (img: HTMLImageElement, tentative = 0) => {
    const canvas = canvasRef.current;
    if (canvas && canvas.width > 0 && img.width > 0 && img.height > 0) {
      const fitZoom = Math.min(canvas.width / img.width, canvas.height / img.height) * 0.92;
      setZoom(fitZoom);
      setOffsetCanvas({
        x: (canvas.width - img.width * fitZoom) / 2,
        y: (canvas.height - img.height * fitZoom) / 2,
      });
      setFondPlan(img);
      setTimeout(() => setProgressionFond(null), 600);
    } else if (tentative < 20) {
      // Canvas pas encore dimensionné par le ResizeObserver — réessayer dans 50ms
      setTimeout(() => appliquerImageSurCanvas(img, tentative + 1), 50);
      return;
    } else {
      // Canvas toujours masqué (onglet inactif) — stocker pour application au prochain resize
      imagePendingRef.current = img;
    }
  };

  // Chargement complet d'un fond de plan (image + zones) — appelé au changement de plan actif
  const chargerFondActif = async (fp: {
    id: string; url_fichier?: string; url_apercu?: string; url_miniature?: string; format_fichier?: string; echelle?: number;
  }) => {
    if (timerSauvegarde.current) { clearTimeout(timerSauvegarde.current); timerSauvegarde.current = null; }
    pendingZonesRef.current = null;
    setFondPlanId(fp.id);
    setEchelleAutoInfo(null);
    // Appliquer l'échelle sauvegardée, ou réinitialiser à 50 si non calibré
    setEchellePixelParMetre(fp.echelle && fp.echelle > 0 ? fp.echelle : 50);
    // Si pas d'échelle calibrée, tenter la détection automatique
    if (!(fp.echelle && fp.echelle > 0)) {
      api.get<{ echelle: number | null; confiance: string; methode: string; details: string }>(
        `/api/metres/${metreId}/fonds-plan/${fp.id}/echelle-auto/`
      ).then((res) => {
        if (res.echelle && res.echelle > 0) {
          setEchellePixelParMetre(res.echelle);
          setEchelleAutoInfo({ confiance: res.confiance, methode: res.methode, details: res.details });
        }
      }).catch(() => { /* détection auto silencieuse */ });
    }
    const url = fp.url_fichier ?? "";
    const estVectoriel = fp.format_fichier === "dxf" || /\.(dxf|dwg)$/i.test(url);
    if (estVectoriel) {
      const urlApercu = fp.url_apercu ?? "";
      const urlHD = fp.url_miniature ?? "";
      const urlPremier = urlApercu || urlHD;
      if (urlPremier) {
        try {
          setChargementImage(true);
          const img = await chargerImageDepuisUrl(urlPremier);
          appliquerImageSurCanvas(img);
          const hdDisponible = !!urlApercu && !!urlHD && urlApercu !== urlHD;
          setFondPlanEstApercu(hdDisponible);
          if (hdDisponible) {
            // HD disponible → charger en arrière-plan et swapper silencieusement
            chargerImageDepuisUrl(urlHD).then((imgHD) => {
              // Recalculer zoom/offset pour la HD (résolution différente de l'aperçu)
              const cv = canvasRef.current;
              if (cv && cv.width > 0 && imgHD.naturalWidth > 0 && imgHD.naturalHeight > 0) {
                const fz = Math.min(cv.width / imgHD.naturalWidth, cv.height / imgHD.naturalHeight) * 0.92;
                setZoom(fz);
                setOffsetCanvas({ x: (cv.width - imgHD.naturalWidth * fz) / 2, y: (cv.height - imgHD.naturalHeight * fz) / 2 });
              }
              setFondPlan(imgHD);
              setFondPlanEstApercu(false);
            }).catch(() => { setFondPlanEstApercu(false); });
          } else if (urlApercu && !urlHD) {
            // Aperçu disponible mais HD pas encore prête → polling pour la HD
            setMiniatureEnCours(true);
            demarrerPollMiniature(fp.id);
          }
        } catch {
          setSucces("Fond de plan CAO — aperçu non disponible, dessinez les zones sur la grille.");
          setTimeout(() => setSucces(null), 5000);
        } finally {
          setChargementImage(false);
        }
      } else {
        // Aucun rendu encore — le fichier est peut-être en cours de génération en arrière-plan
        setMiniatureEnCours(true);
        demarrerPollMiniature(fp.id);
      }
    } else if (url) {
      try {
        setChargementImage(true);
        const estPDF = fp.format_fichier === "pdf";
        const img = estPDF ? await chargerPremierePage(url) : await chargerImageDepuisUrl(url);
        appliquerImageSurCanvas(img);
      } catch {
        setErreurFond("Impossible de charger l'image du fond de plan.");
      } finally {
        setChargementImage(false);
      }
    }
    // Charger les points d'accroche (tous formats : DXF, PDF, image)
    setPointsAccroche([]);
    api.get<{ points: Array<[number, number]>; nb_points: number }>(`/api/metres/${metreId}/fonds-plan/${fp.id}/geometrie/`)
      .then((geo) => { if ((geo.nb_points ?? 0) > 0) setPointsAccroche(geo.points); })
      .catch(() => { /* silencieux — accroche indisponible */ });

    // Charger les zones pour ce fond de plan
    const echelle = (fp.echelle && fp.echelle > 0) ? fp.echelle : 50;
    try {
      const zonesExistantes = await api.get<Array<{
        id: string; localisation?: string; designation: string; type_mesure: string;
        points_px: Array<[number, number]>;
        deductions: Array<{designation: string; points_px: Array<[number, number]>; surface_m2: number}>;
        unite: string; couleur: string; ordre: number;
        zone_parente?: string | null;
        numero?: string;
      }>>(`/api/metres/${metreId}/fonds-plan/${fp.id}/zones/`);
      if (!zonesExistantes.length) { setZones([]); return; }
      const zonesChargees: ZoneVisualisee[] = [];
      // Map dbId -> localId pour résoudre les relations parente
      const dbIdToLocalId: Record<string, string> = {};
      for (const z of zonesExistantes) {
        const type = (z.type_mesure === "surface" || z.type_mesure === "longueur" || z.type_mesure === "comptage") ? z.type_mesure : "surface";
        const pts = z.points_px.map(([x, y]) => ({ x, y }));
        const valeur = type === "surface"
          ? calculerSurface(pts) / (echelle * echelle)
          : type === "longueur" ? calculerLongueur(pts) / echelle : z.points_px.length;
        const localId = `zone-chargee-${z.id}`;
        dbIdToLocalId[z.id] = localId;
        zonesChargees.push({
          id: localId, dbId: z.id, type, mode: "ajout",
          localisation: z.localisation ?? "",
          designation: z.designation, unite: z.unite, points: pts, valeur,
          couleur: z.couleur, deductions: z.deductions.map((d) => ({ designation: d.designation, valeur: d.surface_m2 })),
          numeroZone: z.numero || undefined,
        });
        for (let i = 0; i < z.deductions.length; i++) {
          const d = z.deductions[i];
          const ptsDed = d.points_px.map(([x, y]) => ({ x, y }));
          const valDed = type === "surface"
            ? calculerSurface(ptsDed) / (echelle * echelle)
            : calculerLongueur(ptsDed) / echelle;
          zonesChargees.push({
            id: `ded-chargee-${z.id}-${i}`, type: type === "surface" ? "surface" : "longueur",
            mode: "soustraction", parentZoneId: localId,
            designation: d.designation, unite: z.unite, points: ptsDed, valeur: valDed,
            couleur: COULEUR_SOUSTRACTION, deductions: [],
          });
        }
      }
      // Résoudre les relations zone_parente (hiérarchie)
      for (const z of zonesExistantes) {
        if (z.zone_parente && dbIdToLocalId[z.zone_parente]) {
          const localId = dbIdToLocalId[z.id];
          const idx = zonesChargees.findIndex((zc) => zc.id === localId);
          if (idx >= 0) zonesChargees[idx] = { ...zonesChargees[idx], sousZoneDeId: dbIdToLocalId[z.zone_parente] };
        }
      }
      setZones(zonesChargees);
    } catch { setZones([]); }
  };

  // Chargement d'un fond secondaire (image uniquement, pas de zones)
  const chargerFondSecondaire = async (fp: {
    id: string; url_fichier?: string; url_miniature?: string; format_fichier?: string; echelle?: number;
  }) => {
    const estVectoriel = fp.format_fichier === "dxf" || /\.(dxf|dwg)$/i.test(fp.url_fichier ?? "");
    const url = estVectoriel ? (fp.url_miniature ?? fp.url_fichier ?? "") : (fp.url_fichier ?? "");
    if (!url) return;
    try {
      const estPDF = fp.format_fichier === "pdf";
      const img = estPDF ? await chargerPremierePage(url) : await chargerImageDepuisUrl(url);
      setFondPlanSecondaire(img);
      setFondPlanSecondaireId(fp.id);
    } catch { /* ignore */ }
  };

  // Suppression du fond de plan actif avec toutes ses zones
  const supprimerFondPlanActif = async () => {
    if (!fondPlanId) return;
    setPanneauSuppressionFond(false);
    try {
      await api.supprimer(`/api/metres/${metreId}/fonds-plan/${fondPlanId}/`);
      const restants = fondsPlans.filter((fp) => fp.id !== fondPlanId);
      setFondsPlans(restants);
      setZones([]);
      setFondPlan(null);
      if (fondPlanSecondaireId === fondPlanId) {
        setFondPlanSecondaire(null);
        setFondPlanSecondaireId(null);
      }
      if (restants.length > 0) {
        await chargerFondActif(restants[0]);
      } else {
        setFondPlanId(null);
      }
    } catch {
      setErreurFond("Impossible de supprimer le fond de plan.");
    }
  };

  const demarrerPollMiniature = (fpId: string, tentative = 0) => {
    const MAX_TENTATIVES = 30; // 30 × 4s = 2 minutes max
    if (tentative >= MAX_TENTATIVES) {
      setMiniatureEnCours(false);
      setSucces("Le rendu du plan CAO est disponible — rechargez si nécessaire.");
      setTimeout(() => setSucces(null), 5000);
      return;
    }
    timerPollMiniature.current = setTimeout(async () => {
      try {
        const fp = await api.get<{
          id: string; url_apercu?: string; url_miniature?: string; format_fichier?: string;
        }>(`/api/metres/${metreId}/fonds-plan/${fpId}/`);

        // Phase 1 : aperçu disponible → afficher immédiatement, continuer le poll pour la HD
        if (fp.url_apercu && !fondPlan) {
          setFondsPlans((prev) => prev.map((f) => f.id === fpId ? { ...f, url_apercu: fp.url_apercu } : f));
          try {
            const img = await chargerImageDepuisUrl(fp.url_apercu);
            appliquerImageSurCanvas(img);
            setFondPlanEstApercu(true);
          } catch { /* silencieux */ }
        }

        // Phase 2 : HD disponible → swap et arrêt du poll
        if (fp.url_miniature) {
          setMiniatureEnCours(false);
          setFondsPlans((prev) => prev.map((f) => f.id === fpId ? { ...f, url_miniature: fp.url_miniature } : f));
          try {
            const imgHD = await chargerImageDepuisUrl(fp.url_miniature);
            setFondPlan(imgHD);
            setFondPlanEstApercu(false);
            setSucces("Rendu du plan CAO disponible — tracez vos zones de mesure par-dessus.");
            setTimeout(() => setSucces(null), 6000);
          } catch { /* silencieux */ }
        } else {
          demarrerPollMiniature(fpId, tentative + 1);
        }
      } catch {
        demarrerPollMiniature(fpId, tentative + 1);
      }
    }, 4000);
  };

  const uploaderFond = async (fichier: File) => {
    setChargementFond(true);
    setErreurFond(null);
    setProgressionFond(null);
    try {
      const formData = new FormData();
      formData.append("fichier", fichier);
      formData.append("metre", metreId);
      const reponse = await requeteApiAvecProgression<{
        id?: string; fichier?: string; url?: string; url_fichier?: string; url_apercu?: string; url_miniature?: string; format_fichier?: string;
      }>(
        `/api/metres/${metreId}/fonds-plan/`,
        { method: "POST", corps: formData, onProgression: setProgressionFond }
      );
      const url = reponse.url_fichier ?? reponse.fichier ?? reponse.url ?? "";
      if (!url) { setErreurFond("Aucune URL retournée par le serveur."); return; }
      const fpId = reponse.id ?? null;
      if (fpId) {
        setFondPlanId(fpId);
        const nouveauFp = {
          id: fpId, intitule: fichier.name,
          url_fichier: url, url_apercu: reponse.url_apercu, url_miniature: reponse.url_miniature,
          format_fichier: reponse.format_fichier, echelle: undefined,
        };
        setFondsPlans((prev) => prev.some((f) => f.id === fpId) ? prev : [...prev, nouveauFp]);
        setZones([]);
      }

      const estPDF = reponse.format_fichier === "pdf" || fichier.name.toLowerCase().endsWith(".pdf");
      const estVectoriel = reponse.format_fichier === "dxf" || /\.(dxf|dwg)$/i.test(fichier.name);
      if (estVectoriel) {
        const urlApercu = reponse.url_apercu ?? "";
        const urlHD = reponse.url_miniature ?? "";
        const urlPremier = urlApercu || urlHD;
        if (urlPremier) {
          // Aperçu ou HD déjà disponible → afficher immédiatement
          try {
            const img = await chargerImageDepuisUrl(urlPremier);
            appliquerImageSurCanvas(img);
            setFondPlanEstApercu(!!urlApercu && !!urlHD && urlApercu !== urlHD);
            setSucces("Fichier CAO importé — aperçu affiché. Tracez vos zones de mesure par-dessus.");
            setTimeout(() => setSucces(null), 6000);
            // Charger la HD en arrière-plan si on a que l'aperçu
            if (urlApercu && urlHD && urlApercu !== urlHD) {
              chargerImageDepuisUrl(urlHD).then((imgHD) => {
                setFondPlan(imgHD);
                setFondPlanEstApercu(false);
              }).catch(() => { setFondPlanEstApercu(false); });
            }
          } catch {
            setSucces("Fichier CAO importé. Dessinez vos zones de mesure sur la grille.");
            setTimeout(() => setSucces(null), 5000);
          }
        } else if (fpId) {
          // Rien de disponible encore — polling
          setMiniatureEnCours(true);
          setSucces("Fichier CAO importé — rendu en cours de génération…");
          demarrerPollMiniature(fpId);
        }
      } else if (estPDF) {
        const img = await chargerPremierePage(url);
        appliquerImageSurCanvas(img);
      } else {
        const img = await chargerImageDepuisUrl(url);
        appliquerImageSurCanvas(img);
      }
    } catch (e) {
      setErreurFond(e instanceof ErreurApi ? e.detail : String(e instanceof Error ? e.message : "Impossible de charger le fond de plan."));
      setProgressionFond(null);
    } finally { setChargementFond(false); }
  };

  const supprimerZone = (id: string) => {
    // Supprimer aussi les soustractions liées à cette zone
    setZones((prev) => {
      const nouvelles = prev.filter((z) => z.id !== id && z.parentZoneId !== id);
      planifierSauvegarde(nouvelles, fondPlanId);
      return nouvelles;
    });
    if (zoneSelectionnee === id) setZoneSelectionnee(null);
  };

  const modifierZone = (id: string, champs: Partial<ZoneVisualisee>) => {
    setZones((prev) => {
      const nouvelles = prev.map((z) => z.id === id ? { ...z, ...champs } : z);
      planifierSauvegarde(nouvelles, fondPlanId);
      return nouvelles;
    });
  };

  const validerEtCreerLignes = async () => {
    const zonesAjout = zones.filter((z) => z.mode === "ajout");
    if (zonesAjout.length === 0) return;
    setEnregistrement(true);
    setErreurFond(null);
    try {
      if (fondPlanId) {
        // Flush les sauvegardes en attente avant de créer les lignes
        if (timerSauvegarde.current) {
          clearTimeout(timerSauvegarde.current);
          timerSauvegarde.current = null;
        }
        if (pendingZonesRef.current) {
          const pending = pendingZonesRef.current;
          pendingZonesRef.current = null;
          await sauvegarderZonesBDD(pending.zones, pending.fpId);
        }
        const resultat = await api.post<{ nb_lignes: number; detail?: string }>(
          `/api/metres/${metreId}/valider-zones/`,
          { fond_plan_id: fondPlanId }
        );
        if (resultat.nb_lignes === 0) {
          setErreurFond("Aucune ligne créée. Calibrez d'abord le plan (outil Règle) pour que les mesures soient précises.");
        } else {
          setSucces(`${resultat.nb_lignes} ligne(s) créée(s) depuis le métré visuel.`);
          setTimeout(() => setSucces(null), 4000);
          onLignesCreees();
        }
      } else {
        // Fallback sans fond de plan sauvegardé
        for (const zone of zonesAjout) {
          const soustractions = zones.filter((z) => z.mode === "soustraction" && z.parentZoneId === zone.id);
          const totalDeductions = soustractions.reduce(
            (s, d) => s + (d.type === "longueur" && d.hauteur ? d.valeur * d.hauteur : d.valeur), 0
          );
          let valeurBrute: number;
          if (zone.type === "comptage") {
            valeurBrute = zone.points.length;
          } else if (zone.type === "longueur" && zone.hauteur) {
            valeurBrute = zone.valeur * zone.hauteur;
          } else {
            valeurBrute = zone.valeur;
          }
          const valeurNette = Math.max(0, valeurBrute - totalDeductions);
          const unite = zone.type === "longueur" && zone.hauteur ? "m2" : zone.unite;
          await api.post(`/api/metres/${metreId}/lignes/`, {
            metre: metreId,
            designation: zone.designation,
            nature: "travaux",
            quantite: Math.round(valeurNette * 1000) / 1000,
            unite,
            detail_calcul: "",
            numero_ordre: 0,
          });
        }
        setSucces(`${zonesAjout.length} ligne(s) créée(s) depuis le métré visuel.`);
        setTimeout(() => setSucces(null), 4000);
        onLignesCreees();
      }
    } catch (e) {
      setErreurFond(e instanceof ErreurApi ? e.detail : "Erreur lors de la création des lignes.");
    } finally {
      setEnregistrement(false);
    }
  };

  // Outils principaux — les sous-outils de déduction sont hiérarchisés sous leur parent
  const outils: Array<{
    id: OutilCanvas; icone: React.ReactNode; titre: string;
    sous?: Array<{ id: OutilCanvas; icone: React.ReactNode; titre: string }>;
  }> = [
    { id: "selection", icone: <MousePointer className="w-4 h-4" />, titre: "Sélection / Déplacement" },
    { id: "regle", icone: <Ruler className="w-4 h-4 text-green-600" />, titre: "Règle — mesure ponctuelle (non enregistrée)" },
    {
      id: "surface", icone: <Square className="w-4 h-4" />, titre: "Surface (polygone)",
      sous: [{ id: "soustraction_surface", icone: <MinusSquare className="w-3.5 h-3.5" />, titre: "Soustraire une surface" }],
    },
    {
      id: "longueur", icone: <LineIcon className="w-4 h-4" />, titre: "Longueur (polyligne)",
      sous: [{ id: "soustraction_longueur", icone: <LineIcon className="w-3.5 h-3.5" />, titre: "Soustraire une longueur" }],
    },
    { id: "comptage", icone: <Hash className="w-4 h-4" />, titre: "Comptage" },
    { id: "calibrer", icone: <ScanLine className="w-4 h-4" />, titre: "Calibrer l'échelle" },
  ];

  const instructionOutil = {
    selection: "Glisser pour naviguer — Molette pour zoomer",
    regle: reglePoints.length === 0
      ? "Clic pour poser le 1er point — clic droit pour réinitialiser"
      : reglePoints.length === 1
        ? "Clic pour ajouter un point — longueur totale s'affiche en vert"
        : reglePoints.length >= 3
          ? `${reglePoints.length} pts — longueur + surface affichées — clic droit pour réinitialiser`
          : `${reglePoints.length} pts posés — continuez pour mesurer une surface (≥ 3 pts) — clic droit pour réinitialiser`,
    surface: "Clic pour poser un point — Clic droit pour fermer le polygone",
    soustraction_surface: "Surface à déduire (rouge) — Clic droit pour fermer",
    longueur: "Clic pour ajouter un segment — Clic droit pour terminer",
    soustraction_longueur: "Longueur à déduire (rouge) — Clic droit pour terminer",
    comptage: "Clic sur chaque élément — Clic droit pour valider le comptage",
    calibrer: longueurConnue
      ? `Entrez la longueur connue → cliquez sur 2 points (${calibrationPoints.length}/2)`
      : "Étape 1 : entrez la longueur connue dans la case à gauche",
  }[outil];

  // Instruction outil avec info déduction
  const instructionSoustraction = (outil === "soustraction_surface" || outil === "soustraction_longueur")
    ? zones.filter((z) => z.mode === "ajout").length === 0
      ? " ⚠ Créez d'abord une zone de base"
      : zoneSelectionnee && zones.find((z) => z.id === zoneSelectionnee && z.mode === "ajout")
        ? ` → liée à «\u00a0${zones.find((z) => z.id === zoneSelectionnee)?.designation}\u00a0»`
        : " → sélectionnez la zone parent dans le panneau"
    : "";

  return (
    <div className="space-y-4">
      <OverlayTeleversement progression={progressionFond} libelle="Téléversement du fond de plan…" />

      {/* Modal sélection zone parent pour une déduction */}
      {modalParentSoustraction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-semibold text-slate-800">Associer la déduction à une zone</h3>
            <p className="text-sm text-slate-500">
              <strong>{modalParentSoustraction.designation}</strong> doit être liée à une zone de base.
              Sélectionnez la zone dont cette déduction sera soustraite.
            </p>
            <div className="space-y-2">
              {zones.filter((z) => z.mode === "ajout").map((z) => (
                <button
                  key={z.id}
                  type="button"
                  onClick={() => {
                    const avecParent = { ...modalParentSoustraction, parentZoneId: z.id };
                    setZones((prev) => {
                      const nouvelles = [...prev, avecParent];
                      planifierSauvegarde(nouvelles, fondPlanId);
                      return nouvelles;
                    });
                    setZoneSelectionnee(avecParent.id);
                    setModalParentSoustraction(null);
                    if (modalParentSoustraction!.type === "longueur") {
                      setModalHauteur({ zoneId: avecParent.id, hauteurActuelle: "" });
                    }
                  }}
                  className="w-full flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-left text-sm hover:border-primaire-300 hover:bg-primaire-50 transition"
                >
                  {z.sousZoneDeId && <span className="text-slate-300">└</span>}
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ background: z.couleur }} />
                  <span className="font-medium">
                    {z.numeroZone ? <span className="text-slate-400 text-xs font-mono mr-1">{z.numeroZone}</span> : null}
                    {z.designation}
                  </span>
                  <span className="ml-auto font-mono text-xs text-slate-400">
                    {z.valeur.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} {z.unite}
                  </span>
                </button>
              ))}
            </div>
            <div className="flex justify-end">
              <button onClick={() => setModalParentSoustraction(null)} className="btn-secondaire">Annuler</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal hauteur polyligne */}
      {modalHauteur && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-semibold text-slate-800">Hauteur à appliquer</h3>
            <p className="text-sm text-slate-500">
              Indiquez la hauteur (m) à multiplier par la longueur tracée pour obtenir la surface (m²).
              Exemple : largeur d&apos;une ouverture × hauteur = surface à déduire.
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

      {/* Gestionnaire de fonds de plan — toujours visible */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Liste des fonds de plan disponibles */}
          {fondsPlans.map((fp) => (
            <div key={fp.id} className="flex items-center gap-1">
              <button
                type="button"
                title={`Activer : ${fp.intitule}`}
                onClick={() => { void chargerFondActif(fp); }}
                className={`max-w-[140px] truncate rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                  fp.id === fondPlanId
                    ? "border-primaire-300 bg-primaire-50 text-primaire-700"
                    : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300"
                }`}
              >
                {fp.id === fondPlanId && <span className="inline-block w-1.5 h-1.5 rounded-full bg-primaire-500 mr-1 mb-0.5" />}
                {fp.intitule || `Plan ${fondsPlans.indexOf(fp) + 1}`}
              </button>
              {/* Bouton superposition secondaire */}
              {fp.id !== fondPlanId && fondPlan && (
                <button
                  type="button"
                  title={fondPlanSecondaireId === fp.id ? "Retirer la superposition" : "Superposer ce plan (semi-transparent)"}
                  onClick={() => {
                    if (fondPlanSecondaireId === fp.id) {
                      setFondPlanSecondaire(null);
                      setFondPlanSecondaireId(null);
                    } else {
                      void chargerFondSecondaire(fp);
                    }
                  }}
                  className={`p-1 rounded-lg border transition ${
                    fondPlanSecondaireId === fp.id
                      ? "border-purple-300 bg-purple-50 text-purple-600"
                      : "border-slate-200 bg-white text-slate-400 hover:text-purple-500"
                  }`}
                >
                  <Layers className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}

          {/* Upload d'un nouveau fond de plan */}
          <label className={`flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed px-2.5 py-1.5 text-xs transition ${
            chargementFond ? "border-slate-200 text-slate-400" : "border-slate-300 text-slate-500 hover:border-primaire-400 hover:text-primaire-600"
          }`}>
            {chargementFond
              ? <><Calculator className="w-3 h-3 animate-spin" />Chargement…</>
              : <><ImagePlus className="w-3 h-3" />Ajouter un plan</>
            }
            <input type="file" accept="image/*,.pdf,.dxf,.dwg" className="hidden"
              disabled={chargementFond}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploaderFond(f); e.currentTarget.value = ""; }}
            />
          </label>

          {/* Opacité de la superposition */}
          {fondPlanSecondaire && (
            <div className="flex items-center gap-2 ml-auto">
              <Layers className="w-3 h-3 text-purple-500 shrink-0" />
              <input
                type="range" min={0} max={1} step={0.05}
                value={opaciteSecondaire}
                onChange={(e) => setOpaciteSecondaire(parseFloat(e.target.value))}
                className="w-20 accent-purple-500"
                title={`Opacité superposition : ${Math.round(opaciteSecondaire * 100)}%`}
              />
              <span className="text-xs text-purple-600 font-mono w-8 text-right">{Math.round(opaciteSecondaire * 100)}%</span>
            </div>
          )}

          {/* Suppression du fond de plan actif */}
          {fondPlanId && (
            <div className="ml-auto flex items-center gap-2">
              {panneauSuppressionFond ? (
                <>
                  <span className="text-xs text-red-600">Supprimer ce plan et ses métrés ?</span>
                  <button type="button" onClick={() => void supprimerFondPlanActif()}
                    className="rounded-lg border border-red-300 bg-red-50 px-2 py-1 text-xs text-red-600 hover:bg-red-100">
                    Confirmer
                  </button>
                  <button type="button" onClick={() => setPanneauSuppressionFond(false)}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-500 hover:bg-slate-50">
                    Annuler
                  </button>
                </>
              ) : (
                <button type="button" onClick={() => setPanneauSuppressionFond(true)}
                  title="Supprimer ce fond de plan et toutes ses zones"
                  className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-400 hover:border-red-200 hover:text-red-500 transition">
                  <Trash2 className="w-3 h-3" />Supprimer le plan
                </button>
              )}
            </div>
          )}
        </div>

        {/* Zone d'upload initiale (aucun fond de plan) */}
        {fondsPlans.length === 0 && !chargementFond && (
          <label className="mt-3 flex cursor-pointer items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-8 hover:border-primaire-300 hover:bg-primaire-50 transition">
            <Upload className="w-5 h-5 text-slate-400" />
            <span className="text-sm text-slate-500">Cliquez pour importer votre premier fond de plan (image, PDF, DXF ou DWG)</span>
            <input type="file" accept="image/*,.pdf,.dxf,.dwg" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploaderFond(f); e.currentTarget.value = ""; }}
            />
          </label>
        )}
      </div>

      {/* Interface canvas */}
      <div className="grid gap-4 xl:grid-cols-[60px_minmax(0,1fr)_340px]">
        {/* Barre d'outils — avec sous-outils de déduction hiérarchisés */}
        <div className="flex xl:flex-col gap-1 flex-wrap">
          {outils.map((o) => {
            const sousActif = o.sous?.some((s) => s.id === outil) ?? false;
            const parentActif = outil === o.id || sousActif;
            return (
              <div key={o.id} className="flex xl:flex-col gap-1">
                <button type="button" title={o.titre}
                  onClick={() => { setOutil(o.id); setPointsEnCours([]); setReglePoints([]); }}
                  className={`flex h-10 w-10 items-center justify-center rounded-xl border transition ${
                    parentActif
                      ? o.id === "regle" ? "border-green-300 bg-green-50 text-green-700"
                        : "border-primaire-300 bg-primaire-50 text-primaire-700"
                      : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  {o.icone}
                </button>
                {/* Sous-outils de déduction — affichés uniquement quand l'outil parent est actif */}
                {parentActif && o.sous?.map((so) => (
                  <button key={so.id} type="button" title={so.titre}
                    onClick={() => { setOutil(so.id); setPointsEnCours([]); }}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg border transition xl:ml-1 ${
                      outil === so.id
                        ? "border-red-300 bg-red-50 text-red-600"
                        : "border-red-200 bg-white text-red-400 hover:bg-red-50"
                    }`}
                  >
                    {so.icone}
                  </button>
                ))}
              </div>
            );
          })}
          {/* Bouton accroche objet (visible uniquement si points DXF disponibles) */}
          {pointsAccroche.length > 0 && (
            <button
              type="button"
              title={accrocheActive ? "Accroche objet activée — cliquez pour désactiver" : "Accroche objet désactivée — cliquez pour activer"}
              onClick={() => setAccrocheActive((v) => !v)}
              className={`flex h-10 w-10 items-center justify-center rounded-xl border transition ${
                accrocheActive
                  ? "border-amber-300 bg-amber-50 text-amber-600"
                  : "border-slate-200 bg-white text-slate-400 hover:bg-slate-50"
              }`}
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <circle cx="12" cy="12" r="8" strokeDasharray="3 2" />
                <line x1="12" y1="2" x2="12" y2="5" />
                <line x1="12" y1="19" x2="12" y2="22" />
                <line x1="2" y1="12" x2="5" y2="12" />
                <line x1="19" y1="12" x2="22" y2="12" />
              </svg>
            </button>
          )}
        </div>

        {/* Canvas */}
        <div ref={conteneurRef} className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
          {/* Bandeau génération miniature CAO */}
          {miniatureEnCours && (
            <div className="absolute inset-x-0 top-0 z-20 flex items-center gap-2 bg-amber-50 px-4 py-2 text-sm text-amber-800 border-b border-amber-200">
              <svg className="h-4 w-4 animate-spin text-amber-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
              <span>Génération du rendu du plan CAO en cours — l&apos;aperçu s&apos;affichera automatiquement…</span>
            </div>
          )}
          {/* Bandeau échelle détectée automatiquement */}
          {echelleAutoInfo && (
            <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-2 bg-blue-50 px-4 py-2 text-sm text-blue-800 border-b border-blue-200">
              <div className="flex items-center gap-2">
                <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-blue-500" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>
                  Échelle détectée automatiquement — {echelleAutoInfo.details}
                  {echelleAutoInfo.confiance === "faible" && " (confiance faible — calibration recommandée)"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setEchelleAutoInfo(null)}
                className="shrink-0 rounded p-0.5 hover:bg-blue-100"
                title="Fermer"
              >
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          )}
          {/* Overlay chargement image fond de plan */}
          {chargementImage && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-slate-900/60 rounded-2xl">
              <svg className="h-10 w-10 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
              <span className="text-sm font-medium text-white">Chargement du fond de plan…</span>
            </div>
          )}
          {/* Badge discret HD en cours de chargement */}
          {fondPlanEstApercu && !chargementImage && (
            <div className="absolute bottom-10 right-3 z-10 flex items-center gap-1.5 rounded-full bg-slate-800/70 px-2.5 py-1 text-xs text-slate-300">
              <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
              HD en cours…
            </div>
          )}
          {/* Bandeau mode sous-zone */}
          {pendingParentId && (() => {
            const parent = zones.find((z) => z.id === pendingParentId);
            return parent ? (
              <div className="flex items-center gap-2 bg-primaire-600 px-3 py-1.5 text-xs text-white font-medium">
                <span className="shrink-0">Sous-zone de :</span>
                <span className="font-bold truncate">{parent.numeroZone ? `${parent.numeroZone} — ` : ""}{parent.designation}</span>
                <span className="mx-1 opacity-50">·</span>
                <span className="opacity-75">Sélectionnez un outil et dessinez</span>
                <button type="button" className="ml-auto shrink-0 opacity-75 hover:opacity-100"
                  onClick={() => setPendingParentId(null)}>Annuler ×</button>
              </div>
            ) : null;
          })()}
          <canvas
            ref={canvasRef}
            className="block w-full"
            onClick={gererClic}
            onContextMenu={gererClicDroit}
            onMouseDown={gererMouseDown}
            onMouseMove={gererMouseMove}
            onMouseUp={gererMouseUp}
            onMouseLeave={() => {
              isDragging.current = false;
              isMidDragging.current = false;
              setMousePos(null);
              setMesureEnCours(null);
            }}
            style={{
              cursor: (isDragging.current || isMidDragging.current)
                ? "grabbing"
                : outil === "selection" ? "grab"
                : "none", // réticule dessiné directement sur le canvas pour tous les outils de tracé
            }}
          />
          <div className="flex items-center justify-between border-t border-slate-200 bg-white px-4 py-2 text-xs text-slate-500">
            <span className="truncate flex items-center gap-2">
              {instructionOutil}{instructionSoustraction}
              {mesureEnCours && (
                <span className="ml-2 font-mono font-bold text-primaire-700 bg-primaire-50 border border-primaire-200 px-2 py-0.5 rounded">
                  {mesureEnCours}
                </span>
              )}
            </span>
            <div className="flex items-center gap-3 shrink-0">
              {sauvegardeEnCours && <span className="text-slate-400 animate-pulse">Sauvegarde…</span>}
              {derniereErreurSauvegarde && <span className="text-amber-500">{derniereErreurSauvegarde}</span>}
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
            <p className="text-sm font-semibold text-slate-700">
              Zones ({zones.filter((z) => z.mode === "ajout").length})
              {sauvegardeEnCours && <span className="ml-2 text-xs text-slate-400 font-normal animate-pulse">●</span>}
            </p>
            {zones.filter((z) => z.mode === "ajout").length > 0 && (
              <button type="button" onClick={validerEtCreerLignes} disabled={enregistrement}
                className="btn-primaire text-xs disabled:opacity-60">
                {enregistrement
                  ? <><Calculator className="w-3 h-3 animate-spin" />Création…</>
                  : <><CheckSquare className="w-3 h-3" />Créer les lignes</>
                }
              </button>
            )}
          </div>

          {/* Boutons export */}
          {fondPlan && zones.length > 0 && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={exporterImage}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition"
                title="Exporter en image PNG"
              >
                <Upload className="w-3 h-3" />PNG
              </button>
              <button
                type="button"
                onClick={() => exporterPDF(zones, echellePixelParMetre)}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition"
                title="Exporter en PDF avec légende"
              >
                <Upload className="w-3 h-3" />PDF
              </button>
            </div>
          )}

          {zones.filter((z) => z.mode === "ajout").length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-400">
              Aucune zone mesurée.<br />Sélectionnez un outil et dessinez.<br />
              <span className="text-xs">Clic droit pour valider une zone.</span>
            </div>
          ) : (
            <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
              {zones.filter((z) => z.mode === "ajout" && !z.sousZoneDeId).map((zone) => {
                const sousZones = zones.filter((z2) => z2.mode === "ajout" && z2.sousZoneDeId === zone.id);
                const soustractions = zones.filter((d) => d.mode === "soustraction" && d.parentZoneId === zone.id);
                const totalDeductions = soustractions.reduce((s, d) => s + (d.type === "longueur" && d.hauteur ? d.valeur * d.hauteur : d.valeur), 0);
                const valeurBrute = zone.type === "longueur" && zone.hauteur ? zone.valeur * zone.hauteur : zone.type === "comptage" ? zone.points.length : zone.valeur;
                const valeurNette = valeurBrute - totalDeductions;

                const activerModeSousZone = (e: React.MouseEvent) => {
                  e.stopPropagation();
                  setPendingParentId(zone.id);
                  // Passer en outil surface par défaut si on est en sélection
                  if (outil === "selection" || outil === "calibrer" || outil === "regle") {
                    setOutil("surface");
                  }
                  setPointsEnCours([]);
                };

                return (
                  <div key={zone.id} className="space-y-1">
                    {/* Zone principale */}
                    <div
                      className={`rounded-xl border p-3 cursor-pointer transition ${
                        zone.id === zoneSelectionnee
                          ? "border-primaire-200 bg-primaire-50"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                      onClick={() => setZoneSelectionnee(zone.id === zoneSelectionnee ? null : zone.id)}
                    >
                      <div className="flex items-start gap-2">
                        <div className="mt-1 h-3 w-3 rounded-full shrink-0" style={{ background: zone.couleur }} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1 mb-0.5">
                            {zone.numeroZone && (
                              <span className="text-[10px] font-bold text-slate-400 font-mono">{zone.numeroZone}</span>
                            )}
                          </div>
                          <input
                            type="text" className="champ-saisie w-full text-xs py-1 mb-1"
                            value={zone.localisation ?? ""}
                            onChange={(e) => modifierZone(zone.id, { localisation: e.target.value })}
                            onClick={(e) => e.stopPropagation()}
                            placeholder="Localisation (pièce, niveau…)"
                          />
                          <div onClick={(e) => e.stopPropagation()}>
                            <ChampCCTP
                              value={zone.designation}
                              onChange={(v) => modifierZone(zone.id, { designation: v })}
                              placeholder="Désignation de la prestation…"
                            />
                          </div>
                          <div className="mt-1 flex items-center gap-2">
                            <p className="font-mono text-xs text-slate-600">
                              {zone.type === "comptage"
                                ? `${zone.points.length} u`
                                : zone.type === "longueur" && zone.hauteur
                                  ? `${formaterMesure(zone.valeur * zone.hauteur, "m²")} m²`
                                  : `${formaterMesure(zone.valeur, zone.unite)} ${zone.unite}`
                              }
                            </p>
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
                          <button
                            type="button"
                            className={`mt-1 text-[10px] hover:underline font-medium transition ${
                              pendingParentId === zone.id
                                ? "text-primaire-700 underline"
                                : "text-primaire-500 hover:text-primaire-700"
                            }`}
                            onClick={activerModeSousZone}
                          >
                            {pendingParentId === zone.id ? "▶ Dessinez la sous-zone…" : "+ Sous-zone"}
                          </button>
                        </div>
                        <button type="button" onClick={(e) => { e.stopPropagation(); supprimerZone(zone.id); }}
                          className="p-1 text-slate-300 hover:text-red-500">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Sous-zones (hiérarchie) */}
                    {sousZones.map((sz) => {
                      const szSoustractions = zones.filter((d) => d.mode === "soustraction" && d.parentZoneId === sz.id);
                      const szDeductions = szSoustractions.reduce((s, d) => s + (d.type === "longueur" && d.hauteur ? d.valeur * d.hauteur : d.valeur), 0);
                      const szBrute = sz.type === "longueur" && sz.hauteur ? sz.valeur * sz.hauteur : sz.type === "comptage" ? sz.points.length : sz.valeur;
                      const szNette = Math.max(0, szBrute - szDeductions);
                      return (
                        <div key={sz.id} className="ml-4 space-y-1">
                          <div
                            className={`rounded-xl border p-2.5 cursor-pointer transition ${
                              sz.id === zoneSelectionnee ? "border-primaire-200 bg-primaire-50" : "border-slate-200 bg-slate-50/60 hover:border-slate-300"
                            }`}
                            onClick={() => setZoneSelectionnee(sz.id === zoneSelectionnee ? null : sz.id)}
                          >
                            <div className="flex items-start gap-2">
                              <div className="mt-0.5 flex items-center gap-1 shrink-0">
                                {sz.numeroZone && <span className="text-[10px] font-bold text-slate-400 font-mono">{sz.numeroZone}</span>}
                                <div className="h-2.5 w-2.5 rounded-full" style={{ background: sz.couleur }} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <input
                                  type="text" className="w-full text-xs border-none bg-transparent p-0 focus:ring-0 text-slate-700"
                                  value={sz.designation}
                                  onChange={(e) => modifierZone(sz.id, { designation: e.target.value })}
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <div className="mt-0.5 font-mono text-xs text-slate-500">
                                  {sz.type === "comptage" ? `${sz.points.length} u`
                                    : sz.type === "longueur" && sz.hauteur
                                      ? `${szNette.toLocaleString("fr-FR", { maximumFractionDigits: 3 })} m²`
                                      : `${szNette.toLocaleString("fr-FR", { maximumFractionDigits: 3 })} ${sz.unite}`}
                                </div>
                                {sz.type === "longueur" && (
                                  <button type="button" className="mt-0.5 text-[10px] text-primaire-600 hover:underline"
                                    onClick={(e) => { e.stopPropagation(); setModalHauteur({ zoneId: sz.id, hauteurActuelle: sz.hauteur ? String(sz.hauteur) : "" }); }}>
                                    {sz.hauteur ? `× h = ${sz.hauteur} m → surface` : "Ajouter une hauteur → surface"}
                                  </button>
                                )}
                              </div>
                              <button type="button" onClick={(e) => { e.stopPropagation(); supprimerZone(sz.id); }}
                                className="p-0.5 text-slate-200 hover:text-red-400 shrink-0 mt-0.5">
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                          {/* Déductions de cette sous-zone */}
                          {szSoustractions.map((ded) => (
                            <div key={ded.id}
                              className={`ml-4 rounded-lg border p-2 cursor-pointer transition ${
                                ded.id === zoneSelectionnee ? "border-red-200 bg-red-50" : "border-red-100 bg-red-50/40 hover:border-red-200"
                              }`}
                              onClick={() => setZoneSelectionnee(ded.id === zoneSelectionnee ? null : ded.id)}
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-red-400 text-xs font-bold shrink-0">−</span>
                                <input type="text" className="flex-1 min-w-0 text-xs border-none bg-transparent p-0 focus:ring-0 text-red-700 font-medium"
                                  value={ded.designation}
                                  onChange={(e) => modifierZone(ded.id, { designation: e.target.value })}
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <span className="font-mono text-xs text-red-600 shrink-0">
                                  {ded.type === "longueur" && ded.hauteur
                                    ? `${(ded.valeur * ded.hauteur).toLocaleString("fr-FR", { maximumFractionDigits: 3 })} m²`
                                    : `${ded.valeur.toLocaleString("fr-FR", { maximumFractionDigits: 3 })} ${ded.unite}`}
                                </span>
                                <button type="button" onClick={(e) => { e.stopPropagation(); supprimerZone(ded.id); }}
                                  className="p-0.5 text-red-200 hover:text-red-500 shrink-0">
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                              {ded.type === "longueur" && (
                                <button type="button" className="mt-0.5 ml-4 text-[10px] text-red-500 hover:underline"
                                  onClick={(e) => { e.stopPropagation(); setModalHauteur({ zoneId: ded.id, hauteurActuelle: ded.hauteur ? String(ded.hauteur) : "" }); }}>
                                  {ded.hauteur ? `× h = ${ded.hauteur} m → surface déduite` : "Ajouter une hauteur → surface déduite"}
                                </button>
                              )}
                            </div>
                          ))}
                          {szSoustractions.length > 0 && (
                            <div className="ml-4 rounded-lg bg-green-50 border border-green-200 px-2.5 py-1 flex items-center justify-between">
                              <span className="text-xs text-green-700 font-medium">Net sous-zone</span>
                              <span className="font-mono text-xs font-bold text-green-800">
                                {szNette.toLocaleString("fr-FR", { maximumFractionDigits: 3 })} {sz.type === "longueur" && sz.hauteur ? "m²" : sz.unite}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Soustractions liées */}
                    {soustractions.map((ded) => (
                      <div key={ded.id}
                        className={`ml-5 rounded-xl border p-2.5 cursor-pointer transition ${
                          ded.id === zoneSelectionnee ? "border-red-200 bg-red-50" : "border-red-100 bg-red-50/50 hover:border-red-200"
                        }`}
                        onClick={() => setZoneSelectionnee(ded.id === zoneSelectionnee ? null : ded.id)}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-red-400 text-xs font-bold shrink-0">−</span>
                          <input
                            type="text" className="flex-1 min-w-0 text-xs border-none bg-transparent p-0 focus:ring-0 text-red-700 font-medium"
                            value={ded.designation}
                            onChange={(e) => modifierZone(ded.id, { designation: e.target.value })}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <span className="font-mono text-xs text-red-600 shrink-0">
                            {ded.type === "longueur" && ded.hauteur
                              ? `${(ded.valeur * ded.hauteur).toLocaleString("fr-FR", { maximumFractionDigits: 3 })} m²`
                              : `${ded.valeur.toLocaleString("fr-FR", { maximumFractionDigits: 3 })} ${ded.unite}`
                            }
                          </span>
                          <button type="button" onClick={(e) => { e.stopPropagation(); supprimerZone(ded.id); }}
                            className="p-0.5 text-red-200 hover:text-red-500 shrink-0">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                        {ded.type === "longueur" && (
                          <button
                            type="button"
                            className="mt-1 ml-4 text-[10px] text-red-500 hover:underline"
                            onClick={(e) => { e.stopPropagation(); setModalHauteur({ zoneId: ded.id, hauteurActuelle: ded.hauteur ? String(ded.hauteur) : "" }); }}
                          >
                            {ded.hauteur ? `× h = ${ded.hauteur} m → surface déduite` : "Ajouter une hauteur → surface déduite"}
                          </button>
                        )}
                      </div>
                    ))}

                    {/* Valeur nette si déductions */}
                    {soustractions.length > 0 && (
                      <div className="ml-5 rounded-lg bg-green-50 border border-green-200 px-3 py-1.5 flex items-center justify-between">
                        <span className="text-xs text-green-700 font-medium">Valeur nette</span>
                        <span className="font-mono text-xs font-bold text-green-800">
                          {formaterMesure(valeurNette, zone.type === "longueur" && zone.hauteur ? "m²" : zone.unite)} {zone.type === "longueur" && zone.hauteur ? "m²" : zone.unite}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Calibration */}
          <div
            className="rounded-xl border p-4 transition-colors"
            style={{
              borderColor: outil === "calibrer"
                ? "color-mix(in srgb, var(--bordure) 62%, var(--c-base) 38%)"
                : "var(--bordure)",
              background: outil === "calibrer"
                ? "color-mix(in srgb, var(--fond-carte) 84%, var(--c-base) 16%)"
                : "color-mix(in srgb, var(--fond-carte) 74%, var(--fond-app))",
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {outil === "calibrer"
                    ? <ScanLine className="w-4 h-4 shrink-0" style={{ color: "var(--c-base)" }} />
                    : <Ruler className="w-4 h-4 shrink-0" style={{ color: "var(--texte-3)" }} />
                  }
                  <p className="text-sm font-semibold" style={{ color: "var(--texte)" }}>
                    Calibration de l&apos;échelle
                  </p>
                </div>
                <p className="mt-1 text-xs" style={{ color: "var(--texte-2)" }}>
                  {outil === "calibrer"
                    ? "Renseignez une distance réelle, puis cliquez deux points sur le plan actif."
                    : `Échelle active : 1 m = ${echellePixelParMetre.toFixed(1)} px`
                  }
                </p>
              </div>
              {outil === "calibrer" ? (
                <button
                  type="button"
                  onClick={() => {
                    setOutil("selection");
                    setCalibrationPoints([]);
                    setMesureEnCours(null);
                  }}
                  className="btn-secondaire px-2.5 py-1 text-xs"
                >
                  Fermer
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setOutil("calibrer");
                    setCalibrationPoints([]);
                  }}
                  className="btn-secondaire px-2.5 py-1 text-xs"
                  style={{ color: "var(--c-base)", borderColor: "color-mix(in srgb, var(--bordure) 70%, var(--c-base) 30%)" }}
                >
                  Recalibrer
                </button>
              )}
            </div>

            {outil === "calibrer" && (
              <div className="mt-4 space-y-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--texte)" }}>
                    Longueur connue sur le plan
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      className="champ-saisie w-full font-mono text-sm"
                      placeholder="Ex. 5,00"
                      title="Longueur connue en mètres"
                      value={longueurConnue}
                      onChange={(e) => { setLongueurConnue(e.target.value); setCalibrationPoints([]); }}
                    />
                    <span
                      className="rounded-lg border px-3 py-2 text-sm font-medium"
                      style={{
                        borderColor: "var(--bordure)",
                        background: "var(--fond-entree)",
                        color: "var(--texte-2)",
                      }}
                    >
                      m
                    </span>
                  </div>
                </div>

                <div
                  className="rounded-lg border px-3 py-2"
                  style={{
                    borderColor: "var(--bordure)",
                    background: "color-mix(in srgb, var(--fond-carte) 78%, var(--fond-app))",
                  }}
                >
                  <div className="flex items-center gap-2">
                    {[0, 1].map((i) => (
                      <div
                        key={i}
                        className="h-2.5 w-2.5 rounded-full border"
                        style={{
                          borderColor: calibrationPoints.length > i ? "var(--c-base)" : "var(--bordure-fm)",
                          background: calibrationPoints.length > i ? "var(--c-base)" : "color-mix(in srgb, var(--fond-app) 82%, var(--fond-carte))",
                        }}
                      />
                    ))}
                    <span className="text-xs font-medium" style={{ color: "var(--texte)" }}>
                      {calibrationPoints.length === 0
                        ? "Étape 1 : cliquez le premier point de référence"
                        : "Étape 2 : cliquez le second point de référence"
                      }
                    </span>
                  </div>
                  <p className="mt-1 text-xs" style={{ color: "var(--texte-2)" }}>
                    La nouvelle échelle est enregistrée automatiquement dès le second clic.
                  </p>
                </div>
              </div>
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
            localisation: edition.localisation ?? "",
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
