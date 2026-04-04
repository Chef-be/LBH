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

interface StatistiqueSite {
  id: string;
  valeur: string;
  unite: string;
  libelle: string;
  ordre_affichage: number;
  est_publie: boolean;
}

const VIDE = { valeur: "", unite: "", libelle: "", ordre_affichage: 100, est_publie: true };

function Modal({
  initial, onSave, onClose,
}: {
  initial: StatistiqueSite | null;
  onSave: (d: Partial<StatistiqueSite>) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState(initial ? {
    valeur: initial.valeur, unite: initial.unite, libelle: initial.libelle,
    ordre_affichage: initial.ordre_affichage, est_publie: initial.est_publie,
  } : { ...VIDE });
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const maj = (k: keyof typeof form, v: string | boolean | number) => setForm(p => ({ ...p, [k]: v }));

  const soumettre = async () => {
    if (!form.valeur.trim() || !form.libelle.trim()) { setErreur("La valeur et le libellé sont requis."); return; }
    setChargement(true); setErreur(null);
    try { await onSave(form); onClose(); }
    catch (e) { setErreur(e instanceof ErreurApi ? e.detail : "Erreur."); }
    finally { setChargement(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-800">{initial ? "Modifier le chiffre" : "Nouveau chiffre clé"}</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="p-6 space-y-4">
          {erreur && <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm"><AlertCircle className="w-4 h-4 shrink-0" />{erreur}</div>}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="libelle-champ">Valeur <span className="text-red-500">*</span></label>
              <input type="text" className="champ-saisie w-full" value={form.valeur}
                onChange={e => maj("valeur", e.target.value)} placeholder="15+" />
            </div>
            <div>
              <label className="libelle-champ">Unité</label>
              <input type="text" className="champ-saisie w-full" value={form.unite}
                onChange={e => maj("unite", e.target.value)} placeholder="ans" />
            </div>
          </div>
          <div>
            <label className="libelle-champ">Libellé <span className="text-red-500">*</span></label>
            <input type="text" className="champ-saisie w-full" value={form.libelle}
              onChange={e => maj("libelle", e.target.value)} placeholder="D'expérience dans la construction" />
          </div>
          <div>
            <label className="libelle-champ">Ordre</label>
            <input type="number" className="champ-saisie w-full" value={form.ordre_affichage} min={1}
              onChange={e => maj("ordre_affichage", parseInt(e.target.value) || 100)} />
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 rounded text-primaire-600"
              checked={form.est_publie} onChange={e => maj("est_publie", e.target.checked)} />
            <span className="text-sm font-medium text-slate-700">Publié</span>
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

export default function PageStatistiques() {
  const [items, setItems] = useState<StatistiqueSite[]>([]);
  const [chargement, setChargement] = useState(true);
  const [succes, setSucces] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [modal, setModal] = useState(false);
  const [edition, setEdition] = useState<StatistiqueSite | null>(null);

  const charger = async () => {
    try { setItems(extraireListeResultats(await api.get<StatistiqueSite[]>("/api/site/statistiques/"))); }
    catch { setErreur("Impossible de charger les statistiques."); }
    finally { setChargement(false); }
  };
  useEffect(() => { charger(); }, []);

  const flash = (msg: string) => { setSucces(msg); setTimeout(() => setSucces(null), 3000); };

  const sauvegarder = async (d: Partial<StatistiqueSite>) => {
    if (edition) { await api.patch(`/api/site/statistiques/${edition.id}/`, d); flash("Chiffre modifié."); }
    else { await api.post("/api/site/statistiques/", d); flash("Chiffre créé."); }
    await charger();
  };

  const basculer = async (item: StatistiqueSite) => {
    try { await api.patch(`/api/site/statistiques/${item.id}/`, { est_publie: !item.est_publie }); await charger(); }
    catch { setErreur("Erreur."); }
  };

  const supprimer = async (item: StatistiqueSite) => {
    if (!window.confirm(`Supprimer définitivement le chiffre « ${item.libelle} » ?`)) return;
    try { await api.supprimer(`/api/site/statistiques/${item.id}/`); flash("Chiffre supprimé."); await charger(); }
    catch { setErreur("Impossible de supprimer."); }
  };

  const ouvrir = (item?: StatistiqueSite) => { setEdition(item ?? null); setModal(true); };

  return (
    <div className="space-y-6 max-w-2xl">
      <EntetePageAdmin
        titre="Chiffres clés"
        description="Gérez les indicateurs visibles sur la page d’accueil."
        actions={<button onClick={() => ouvrir()} className="btn-primaire"><Plus className="w-4 h-4" />Nouveau chiffre</button>}
        statistiques={[
          { libelle: "Total", valeur: `${items.length} statistique${items.length > 1 ? "s" : ""}` },
          { libelle: "Publiées", valeur: `${items.filter((item) => item.est_publie).length}` },
          { libelle: "Masquées", valeur: `${items.filter((item) => !item.est_publie).length}` },
        ]}
      />

      {succes && <AlerteAdmin type="succes">{succes}</AlerteAdmin>}
      {erreur && <AlerteAdmin type="erreur" action={<button onClick={() => setErreur(null)} className="ml-auto"><X className="w-4 h-4" /></button>}>{erreur}</AlerteAdmin>}

      <CarteSectionAdmin
        titre="Liste des statistiques"
        description="Chaque chiffre peut être publié, masqué ou réordonné."
      >
      <div className="-m-5 divide-y divide-slate-100">
        {chargement ? <div className="py-10 text-center text-slate-400 text-sm">Chargement…</div>
          : items.length === 0 ? <div className="py-10 text-center text-slate-400 text-sm">Aucun chiffre clé. Créez-en un.</div>
          : items.map(item => (
          <div key={item.id} className="flex items-center gap-4 py-3 px-4 hover:bg-slate-50">
            <GripVertical className="w-4 h-4 text-slate-300 shrink-0" />
            <div className="flex-1">
              <div className="flex items-baseline gap-1">
                <span className="font-bold text-primaire-700 text-lg">{item.valeur}</span>
                {item.unite && <span className="text-slate-500 text-sm">{item.unite}</span>}
              </div>
              <button
                type="button"
                onClick={() => ouvrir(item)}
                className="text-left text-sm text-slate-600 transition-colors hover:text-primaire-600"
              >
                {item.libelle}
              </button>
            </div>
            {!item.est_publie && <span className="badge-neutre text-xs shrink-0">Masqué</span>}
            <ActionsRapidesAdaptatives
              actions={[
                {
                  titre: item.est_publie ? "Masquer" : "Publier",
                  icone: item.est_publie ? Eye : EyeOff,
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
