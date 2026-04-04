"use client";

import { useState, useEffect } from "react";
import { api, ErreurApi, extraireListeResultats } from "@/crochets/useApi";
import { Plus, Pencil, Trash2, Eye, EyeOff, Save, X, GripVertical, AlertCircle } from "lucide-react";
import { ActionsRapidesAdaptatives } from "@/composants/ui/ActionsRapides";
import {
  AlerteAdmin,
  CarteSectionAdmin,
  EntetePageAdmin,
} from "@/composants/administration/Presentation";

interface ValeurSite {
  id: string;
  icone: string;
  titre: string;
  description: string;
  ordre_affichage: number;
  est_publiee: boolean;
}

const VIDE = { icone: "Shield", titre: "", description: "", ordre_affichage: 100, est_publiee: true };

function Modal({ initial, onSave, onClose }: { initial: ValeurSite | null; onSave: (d: Partial<ValeurSite>) => Promise<void>; onClose: () => void }) {
  const [form, setForm] = useState(initial ? {
    icone: initial.icone, titre: initial.titre, description: initial.description,
    ordre_affichage: initial.ordre_affichage, est_publiee: initial.est_publiee,
  } : { ...VIDE });
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const maj = (k: keyof typeof form, v: string | boolean | number) => setForm(p => ({ ...p, [k]: v }));

  const soumettre = async () => {
    if (!form.titre.trim()) { setErreur("Le titre est requis."); return; }
    setChargement(true); setErreur(null);
    try { await onSave(form); onClose(); }
    catch (e) { setErreur(e instanceof ErreurApi ? e.detail : "Erreur."); }
    finally { setChargement(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-800">{initial ? "Modifier la valeur" : "Nouvelle valeur"}</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="p-6 space-y-4">
          {erreur && <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm"><AlertCircle className="w-4 h-4 shrink-0" />{erreur}</div>}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="libelle-champ">Icône (lucide-react)</label>
              <input type="text" className="champ-saisie w-full" value={form.icone}
                onChange={e => maj("icone", e.target.value)} placeholder="Shield" />
            </div>
            <div>
              <label className="libelle-champ">Ordre</label>
              <input type="number" className="champ-saisie w-full" value={form.ordre_affichage} min={1}
                onChange={e => maj("ordre_affichage", parseInt(e.target.value) || 100)} />
            </div>
          </div>
          <div>
            <label className="libelle-champ">Titre <span className="text-red-500">*</span></label>
            <input type="text" className="champ-saisie w-full" value={form.titre}
              onChange={e => maj("titre", e.target.value)} placeholder="Expertise reconnue" />
          </div>
          <div>
            <label className="libelle-champ">Description</label>
            <textarea rows={3} className="champ-saisie w-full resize-none" value={form.description}
              onChange={e => maj("description", e.target.value)}
              placeholder="Description de la valeur ou de l'avantage…" />
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 rounded text-primaire-600"
              checked={form.est_publiee} onChange={e => maj("est_publiee", e.target.checked)} />
            <span className="text-sm font-medium text-slate-700">Publiée</span>
          </label>
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

export default function PageValeursAdmin() {
  const [items, setItems] = useState<ValeurSite[]>([]);
  const [chargement, setChargement] = useState(true);
  const [succes, setSucces] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [modal, setModal] = useState(false);
  const [edition, setEdition] = useState<ValeurSite | null>(null);

  const charger = async () => {
    try { setItems(extraireListeResultats(await api.get<ValeurSite[]>("/api/site/valeurs/"))); }
    catch { setErreur("Impossible de charger les valeurs."); }
    finally { setChargement(false); }
  };
  useEffect(() => { charger(); }, []);
  const flash = (msg: string) => { setSucces(msg); setTimeout(() => setSucces(null), 3000); };

  const sauvegarder = async (d: Partial<ValeurSite>) => {
    if (edition) { await api.patch(`/api/site/valeurs/${edition.id}/`, d); flash("Valeur modifiée."); }
    else { await api.post("/api/site/valeurs/", d); flash("Valeur créée."); }
    await charger();
  };

  const basculer = async (item: ValeurSite) => {
    try { await api.patch(`/api/site/valeurs/${item.id}/`, { est_publiee: !item.est_publiee }); await charger(); }
    catch { setErreur("Erreur."); }
  };

  const supprimer = async (item: ValeurSite) => {
    if (!window.confirm(`Supprimer définitivement la valeur « ${item.titre} » ?`)) return;
    try { await api.supprimer(`/api/site/valeurs/${item.id}/`); flash("Valeur supprimée."); await charger(); }
    catch { setErreur("Impossible de supprimer."); }
  };

  const ouvrir = (item?: ValeurSite) => { setEdition(item ?? null); setModal(true); };

  return (
    <div className="space-y-6 max-w-2xl">
      <EntetePageAdmin
        titre="Valeurs et avantages"
        description="Administrez les encarts de réassurance visibles sur le site vitrine."
        actions={<button onClick={() => ouvrir()} className="btn-primaire"><Plus className="w-4 h-4" />Nouvelle valeur</button>}
        statistiques={[
          { libelle: "Total", valeur: `${items.length} élément${items.length > 1 ? "s" : ""}` },
          { libelle: "Publiées", valeur: `${items.filter((item) => item.est_publiee).length}` },
          { libelle: "Masquées", valeur: `${items.filter((item) => !item.est_publiee).length}` },
        ]}
      />

      {succes && <AlerteAdmin type="succes">{succes}</AlerteAdmin>}
      {erreur && <AlerteAdmin type="erreur" action={<button onClick={() => setErreur(null)} className="ml-auto"><X className="w-4 h-4" /></button>}>{erreur}</AlerteAdmin>}

      <CarteSectionAdmin
        titre="Liste des valeurs"
        description="Modifiez l’icône, le texte, l’ordre et la publication de chaque encart."
      >
      <div className="-m-5 divide-y divide-slate-100">
        {chargement ? <div className="py-10 text-center text-slate-400 text-sm">Chargement…</div>
          : items.length === 0 ? <div className="py-10 text-center text-slate-400 text-sm">Aucune valeur. Créez-en une.</div>
          : items.map(item => (
          <div key={item.id} className="flex items-center gap-4 py-3 px-4 hover:bg-slate-50">
            <GripVertical className="w-4 h-4 text-slate-300 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{item.icone}</span>
                <button
                  type="button"
                  onClick={() => ouvrir(item)}
                  className="truncate font-medium text-slate-800 transition-colors hover:text-primaire-600"
                >
                  {item.titre}
                </button>
                {!item.est_publiee && <span className="badge-neutre text-xs shrink-0">Masquée</span>}
              </div>
              <p className="text-xs text-slate-400 truncate mt-0.5">{item.description}</p>
            </div>
            <ActionsRapidesAdaptatives
              actions={[
                {
                  titre: item.est_publiee ? "Masquer" : "Publier",
                  icone: item.est_publiee ? Eye : EyeOff,
                  onClick: () => basculer(item),
                },
                {
                  titre: "Modifier",
                  icone: Pencil,
                  variante: "primaire",
                  onClick: () => ouvrir(item),
                },
                {
                  titre: "Supprimer",
                  icone: Trash2,
                  variante: "danger",
                  onClick: () => supprimer(item),
                },
              ]}
            />
          </div>
        ))}
      </div>
      </CarteSectionAdmin>

      {modal && <Modal initial={edition} onSave={sauvegarder} onClose={() => { setModal(false); setEdition(null); }} />}
    </div>
  );
}
