"use client";

import { useState, useEffect, use, useCallback } from "react";
import Link from "next/link";
import { api, ErreurApi } from "@/crochets/useApi";
import {
  ArrowLeft, Plus, Pencil, Trash2, CheckCircle,
  AlertCircle, X, Save, ChevronRight, Calculator,
} from "lucide-react";

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
  prix_unitaire_ht: number | null;
  montant_ht: number | null;
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
  montant_total_ht: number;
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
  prix_unitaire_ht: "",
  observations: "",
};

function formatMontant(val: number | null, suffix = " €"): string {
  if (val === null || val === undefined) return "—";
  return Number(val).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + suffix;
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

  const maj = (k: keyof typeof VIDE_LIGNE, v: string) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!form.detail_calcul.trim()) {
      setApercuCalcul(null);
      return;
    }

    const temporisateur = window.setTimeout(async () => {
      try {
        setChargementCalcul(true);
        const reponse = await api.post<ApercuCalcul>("/api/metres/apercu-calcul/", {
          detail_calcul: form.detail_calcul,
        });
        setApercuCalcul(reponse);
      } catch {
        setApercuCalcul(null);
      } finally {
        setChargementCalcul(false);
      }
    }, 300);

    return () => window.clearTimeout(temporisateur);
  }, [form.detail_calcul]);

  const soumettre = async () => {
    if (!form.designation.trim()) { setErreur("La désignation est requise."); return; }
    if (!form.numero_ordre.trim()) { setErreur("Le numéro d'ordre est requis."); return; }
    setChargement(true);
    setErreur(null);
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
        prix_unitaire_ht: form.prix_unitaire_ht === "" ? null : Number(form.prix_unitaire_ht),
        observations: form.observations,
      };
      if (ligneId) {
        await api.patch(`/api/metres/${metreId}/lignes/${ligneId}/`, payload);
      } else {
        await api.post(`/api/metres/${metreId}/lignes/`, payload);
      }
      onSuccess();
      onClose();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Erreur lors de l'enregistrement.");
    } finally {
      setChargement(false);
    }
  };

  return (
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

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="libelle-champ">N° d&apos;ordre</label>
              <input type="number" min="1" className="champ-saisie w-full text-right"
                value={form.numero_ordre} onChange={e => maj("numero_ordre", e.target.value)} />
            </div>
            <div>
              <label className="libelle-champ">Code article</label>
              <input type="text" className="champ-saisie w-full" placeholder="VRD-001"
                value={form.code_article} onChange={e => maj("code_article", e.target.value)} />
            </div>
            <div>
              <label className="libelle-champ">Nature</label>
              <select className="champ-saisie w-full bg-white" value={form.nature}
                onChange={e => maj("nature", e.target.value)}>
                {NATURES.map(n => <option key={n.val} value={n.val}>{n.lib}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="libelle-champ">Désignation <span className="text-red-500">*</span></label>
            <input type="text" className="champ-saisie w-full"
              placeholder="Terrassements généraux en déblai — tout venant"
              value={form.designation} onChange={e => maj("designation", e.target.value)} />
          </div>

          <div>
            <label className="libelle-champ">Détail de calcul</label>
            <textarea className="champ-saisie min-h-28 w-full font-mono text-sm"
              placeholder={"L = 5,00\nl = 3,00\nL × l × 2"}
              value={form.detail_calcul} onChange={e => maj("detail_calcul", e.target.value)} />
            <p className="mt-1 text-xs text-slate-400">
              Variables, parenthèses et plusieurs lignes sont acceptées. Chaque ligne de calcul s&apos;additionne.
            </p>
            {chargementCalcul && (
              <p className="mt-2 text-xs text-slate-500">Calcul du métré en cours…</p>
            )}
            {apercuCalcul && (
              <div className="mt-3 rounded-2xl border border-blue-200 bg-blue-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-blue-900">Quantité calculée</p>
                    <p className="text-2xl font-semibold text-blue-900">
                      {apercuCalcul.quantite_calculee.toLocaleString("fr-FR", {
                        minimumFractionDigits: 3,
                        maximumFractionDigits: 3,
                      })}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => maj("quantite", String(apercuCalcul.quantite_calculee))}
                    className="btn-secondaire text-sm"
                  >
                    Reprendre ce résultat
                  </button>
                </div>
                <div className="mt-3 grid gap-2 text-xs text-blue-950">
                  {apercuCalcul.etapes.map((etape, index) => (
                    <div key={`${etape.libelle}-${index}`} className="rounded-xl border border-blue-100 bg-white px-3 py-2">
                      <p className="font-medium">{etape.libelle}</p>
                      <p className="font-mono">{etape.expression}</p>
                      <p className="mt-1 text-blue-700">= {etape.valeur.toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="libelle-champ">Quantité</label>
              <input type="number" step="0.001" className="champ-saisie w-full text-right"
                value={form.quantite} onChange={e => maj("quantite", e.target.value)} />
            </div>
            <div>
              <label className="libelle-champ">Unité</label>
              <input type="text" className="champ-saisie w-full" placeholder="m²"
                value={form.unite} onChange={e => maj("unite", e.target.value)} maxLength={20} />
            </div>
            <div>
              <label className="libelle-champ">PU HT (€)</label>
              <input type="number" step="0.01" className="champ-saisie w-full text-right"
                value={form.prix_unitaire_ht} onChange={e => maj("prix_unitaire_ht", e.target.value)} />
            </div>
          </div>

          <div>
            <label className="libelle-champ">Observations</label>
            <input type="text" className="champ-saisie w-full"
              value={form.observations} onChange={e => maj("observations", e.target.value)} />
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
  );
}

export default function PageDetailMetre({
  params,
}: {
  params: Promise<{ id: string; metre_id: string }>;
}) {
  const { id: projetId, metre_id: metreId } = use(params);
  const [metre, setMetre] = useState<MetreDetail | null>(null);
  const [chargement, setChargement] = useState(true);
  const [succes, setSucces] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [modal, setModal] = useState(false);
  const [edition, setEdition] = useState<LigneMetre | null>(null);
  const [suppressionId, setSuppressionId] = useState<string | null>(null);

  const charger = useCallback(async () => {
    try {
      setMetre(await api.get<MetreDetail>(`/api/metres/${metreId}/`));
    } catch {
      setErreur("Impossible de charger le métré.");
    } finally {
      setChargement(false);
    }
  }, [metreId]);

  useEffect(() => { charger(); }, [charger]);

  const flash = (msg: string) => { setSucces(msg); setTimeout(() => setSucces(null), 3000); };

  const supprimerLigne = async (ligneId: string) => {
    try {
      await api.supprimer(`/api/metres/${metreId}/lignes/${ligneId}/`);
      flash("Ligne supprimée.");
      setSuppressionId(null);
      charger();
    } catch {
      setErreur("Impossible de supprimer la ligne.");
    }
  };

  const valider = async () => {
    try {
      await api.post(`/api/metres/${metreId}/valider/`, {});
      flash("Métré validé.");
      charger();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Impossible de valider.");
    }
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
  const totalLignes = lignes.reduce((s, l) => s + (l.montant_ht ?? 0), 0);

  // Grouper par nature
  const parNature: Record<string, LigneMetre[]> = {};
  lignes.forEach(l => {
    if (!parNature[l.nature]) parNature[l.nature] = [];
    parNature[l.nature].push(l);
  });

  return (
    <div className="space-y-6">
      {/* Fil d'Ariane */}
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Link href={`/projets/${projetId}`} className="hover:text-slate-600 transition-colors">
          {metre.projet_reference}
        </Link>
        <ChevronRight className="w-3 h-3" />
        <Link href={`/projets/${projetId}/metres`} className="hover:text-slate-600 transition-colors">
          Métrés
        </Link>
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

      {/* En-tête métré */}
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
                  metre.statut === "en_cours" ? "bg-blue-100 text-blue-700 border border-blue-200" :
                  "badge-neutre"
                }`}>
                  {metre.statut_libelle}
                </span>
                <span className="text-sm text-slate-400">{metre.type_libelle}</span>
              </div>
              <h1 className="mt-1 text-xl font-bold text-slate-800">{metre.intitule}</h1>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <p className="text-xs text-slate-400">Total HT</p>
              <p className="text-2xl font-bold text-primaire-700 font-mono">
                {formatMontant(totalLignes)}
              </p>
            </div>
            {metre.statut !== "valide" && (
              <button onClick={valider} className="btn-primaire">
                <CheckCircle className="w-4 h-4" />Valider
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tableau des lignes */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-slate-700">
            {lignes.length} ligne{lignes.length !== 1 ? "s" : ""}
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
            <p className="text-slate-500 font-medium">Aucune ligne</p>
            <p className="text-slate-400 text-sm mt-1">Ajoutez des lignes pour commencer le métré.</p>
          </div>
        ) : (
          <div className="carte overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider w-8">#</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Désignation</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider hidden sm:table-cell">Nature</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Qté</th>
                  <th className="text-center px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Unité</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider hidden md:table-cell">PU HT</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Montant HT</th>
                  {metre.statut !== "valide" && <th className="px-4 py-3 w-20"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {lignes.map((ligne, idx) => (
                  <tr key={ligne.id} className="hover:bg-slate-50 group">
                    <td className="px-4 py-3 text-xs text-slate-400 font-mono">{idx + 1}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{ligne.designation}</p>
                      {ligne.code_article && (
                        <p className="text-xs text-slate-400 font-mono">{ligne.code_article}</p>
                      )}
                      {ligne.detail_calcul && (
                        <p className="text-xs text-slate-400 font-mono mt-0.5 italic">{ligne.detail_calcul}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        {ligne.nature_libelle}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-slate-700">
                      {ligne.quantite != null ? Number(ligne.quantite).toLocaleString("fr-FR") : "—"}
                    </td>
                    <td className="px-4 py-3 text-center font-mono text-xs text-slate-500">
                      {ligne.unite}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-slate-600 hidden md:table-cell">
                      {formatMontant(ligne.prix_unitaire_ht)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm font-semibold text-primaire-700">
                      {formatMontant(ligne.montant_ht)}
                    </td>
                    {metre.statut !== "valide" && (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                          <button
                            onClick={() => { setEdition(ligne); setModal(true); }}
                            className="p-1.5 rounded text-slate-400 hover:text-primaire-600 hover:bg-primaire-50"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {suppressionId === ligne.id ? (
                            <div className="flex items-center gap-1">
                              <button onClick={() => supprimerLigne(ligne.id)}
                                className="text-xs text-red-600 font-medium px-1.5 py-1 rounded hover:bg-red-50">
                                Suppr.
                              </button>
                              <button onClick={() => setSuppressionId(null)}
                                className="p-1 rounded hover:bg-slate-100">
                                <X className="w-3 h-3 text-slate-400" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setSuppressionId(ligne.id)}
                              className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50">
                  <td colSpan={metre.statut !== "valide" ? 6 : 5} className="px-4 py-3 text-right text-sm font-semibold text-slate-600 hidden md:table-cell">
                    Total HT
                  </td>
                  <td colSpan={metre.statut !== "valide" ? 6 : 5} className="px-4 py-3 text-right text-sm font-semibold text-slate-600 md:hidden">
                    Total HT
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-base font-bold text-primaire-700">
                    {formatMontant(totalLignes)}
                  </td>
                  {metre.statut !== "valide" && <td></td>}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {modal && (
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
            prix_unitaire_ht: edition.prix_unitaire_ht != null ? String(edition.prix_unitaire_ht) : "",
            observations: edition.observations,
          } : {}}
          ligneId={edition?.id}
          numeroOrdreInitial={(metre.lignes?.length || 0) + 1}
          onSuccess={() => { flash(edition ? "Ligne modifiée." : "Ligne ajoutée."); charger(); }}
          onClose={() => { setModal(false); setEdition(null); }}
        />
      )}
    </div>
  );
}
