"use client";

import { useState, useEffect } from "react";
import { api, ErreurApi, extraireListeResultats } from "@/crochets/useApi";
import { EditeurTexteRiche } from "@/composants/ui/EditeurTexteRiche";
import { Plus, Pencil, Eye, EyeOff, Save, X, ExternalLink, AlertCircle, Trash2 } from "lucide-react";
import { ActionsRapidesAdaptatives } from "@/composants/ui/ActionsRapides";
import {
  AlerteAdmin,
  CarteSectionAdmin,
  EntetePageAdmin,
} from "@/composants/administration/Presentation";

interface PageStatique {
  id: string;
  code: string;
  type_page: string;
  titre: string;
  contenu: string;
  est_publiee: boolean;
  afficher_dans_pied_de_page: boolean;
}

const TYPES_PAGE: Record<string, string> = {
  politique_confidentialite: "Politique de confidentialité",
  mentions_legales: "Mentions légales",
  cgu: "CGU",
  gestion_cookies: "Cookies",
  autre: "Autre",
};

const PAGES_PRECREES = [
  { code: "mentions-legales", type_page: "mentions_legales", titre: "Mentions légales" },
  { code: "politique-de-confidentialite", type_page: "politique_confidentialite", titre: "Politique de confidentialité" },
  { code: "conditions-generales", type_page: "cgu", titre: "Conditions générales d'utilisation" },
];

function Modal({ initial, onSave, onClose }: { initial: PageStatique | null; onSave: (d: Partial<PageStatique>) => Promise<void>; onClose: () => void }) {
  const [form, setForm] = useState(initial ? {
    code: initial.code, type_page: initial.type_page, titre: initial.titre,
    contenu: initial.contenu, est_publiee: initial.est_publiee,
    afficher_dans_pied_de_page: initial.afficher_dans_pied_de_page,
  } : { code: "", type_page: "autre", titre: "", contenu: "", est_publiee: true, afficher_dans_pied_de_page: true });
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const maj = (k: keyof typeof form, v: string | boolean) => setForm(p => ({ ...p, [k]: v }));

  const soumettre = async () => {
    if (!form.titre.trim() || !form.code.trim()) { setErreur("Le code et le titre sont requis."); return; }
    setChargement(true); setErreur(null);
    try { await onSave(form); onClose(); }
    catch (e) { setErreur(e instanceof ErreurApi ? e.detail : "Erreur."); }
    finally { setChargement(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-800">{initial ? `Modifier — ${initial.titre}` : "Nouvelle page légale"}</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="p-6 space-y-4">
          {erreur && <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm"><AlertCircle className="w-4 h-4 shrink-0" />{erreur}</div>}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="libelle-champ">Type de page</label>
              <select className="champ-saisie w-full bg-white" value={form.type_page} onChange={e => maj("type_page", e.target.value)}>
                {Object.entries(TYPES_PAGE).map(([val, lib]) => <option key={val} value={val}>{lib}</option>)}
              </select>
            </div>
            <div>
              <label className="libelle-champ">Code URL (slug) <span className="text-red-500">*</span></label>
              <input type="text" className="champ-saisie w-full" value={form.code}
                onChange={e => maj("code", e.target.value.toLowerCase().replace(/\s+/g, "-"))}
                placeholder="mentions-legales" readOnly={!!initial} />
              {!initial && <p className="text-xs text-slate-400 mt-1">Ex : mentions-legales → /pages/mentions-legales</p>}
            </div>
          </div>
          <div>
            <label className="libelle-champ">Titre <span className="text-red-500">*</span></label>
            <input type="text" className="champ-saisie w-full" value={form.titre}
              onChange={e => maj("titre", e.target.value)} placeholder="Mentions légales" />
          </div>
          <div>
            <label className="libelle-champ">Contenu éditorial</label>
            <EditeurTexteRiche
              valeur={form.contenu}
              onChange={(html) => maj("contenu", html)}
              placeholder="Rédigez le contenu de la page, ajoutez des titres, tableaux, images et liens…"
              hauteurMinimale="min-h-[22rem]"
            />
            <p className="text-xs text-slate-400 mt-2">
              Le contenu est enregistré en HTML propre et affiché tel quel sur la page publique.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 rounded text-primaire-600"
                checked={form.est_publiee} onChange={e => maj("est_publiee", e.target.checked)} />
              <span className="text-sm font-medium text-slate-700">Page publiée (accessible au public)</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 rounded text-primaire-600"
                checked={form.afficher_dans_pied_de_page} onChange={e => maj("afficher_dans_pied_de_page", e.target.checked)} />
              <span className="text-sm font-medium text-slate-700">Lien dans le pied de page</span>
            </label>
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

export default function PagesPagesStatiques() {
  const [items, setItems] = useState<PageStatique[]>([]);
  const [chargement, setChargement] = useState(true);
  const [succes, setSucces] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [modal, setModal] = useState(false);
  const [edition, setEdition] = useState<PageStatique | null>(null);

  const charger = async () => {
    try {
      const data = await api.get<PageStatique[]>("/api/site/pages/admin/");
      setItems(extraireListeResultats(data));
    } catch {
      setErreur("Impossible de charger les pages.");
    } finally {
      setChargement(false);
    }
  };
  useEffect(() => { charger(); }, []);
  const flash = (msg: string) => { setSucces(msg); setTimeout(() => setSucces(null), 3000); };

  const sauvegarder = async (d: Partial<PageStatique>) => {
    if (edition) {
      await api.patch(`/api/site/pages/admin/${edition.id}/`, d);
      flash("Page modifiée.");
    } else {
      await api.post("/api/site/pages/admin/", d);
      flash("Page créée.");
    }
    await charger();
  };

  const basculer = async (item: PageStatique) => {
    try { await api.patch(`/api/site/pages/admin/${item.id}/`, { est_publiee: !item.est_publiee }); await charger(); }
    catch { setErreur("Erreur."); }
  };

  const supprimer = async (item: PageStatique) => {
    if (!window.confirm(`Supprimer définitivement la page « ${item.titre} » ?`)) return;
    try {
      await api.supprimer(`/api/site/pages/admin/${item.id}/`);
      flash("Page supprimée.");
      await charger();
    } catch {
      setErreur("Impossible de supprimer la page.");
    }
  };

  const ouvrir = (item?: PageStatique) => { setEdition(item ?? null); setModal(true); };

  const pagesPrecreesManquantes = PAGES_PRECREES.filter(
    p => !items.some(i => i.code === p.code)
  );

  return (
    <div className="space-y-6 max-w-3xl">
      <EntetePageAdmin
        titre="Pages légales"
        description="Administrez les pages institutionnelles et les liens du pied de page."
        actions={<button onClick={() => ouvrir()} className="btn-primaire"><Plus className="w-4 h-4" />Nouvelle page</button>}
        statistiques={[
          { libelle: "Total", valeur: `${items.length} page${items.length > 1 ? "s" : ""}` },
          { libelle: "Publiées", valeur: `${items.filter((item) => item.est_publiee).length}` },
          { libelle: "Liées au pied de page", valeur: `${items.filter((item) => item.afficher_dans_pied_de_page).length}` },
          { libelle: "Recommandées manquantes", valeur: `${pagesPrecreesManquantes.length}` },
        ]}
      />

      {succes && <AlerteAdmin type="succes">{succes}</AlerteAdmin>}
      {erreur && <AlerteAdmin type="erreur" action={<button onClick={() => setErreur(null)} className="ml-auto"><X className="w-4 h-4" /></button>}>{erreur}</AlerteAdmin>}

      {pagesPrecreesManquantes.length > 0 && (
        <CarteSectionAdmin
          titre="Pages recommandées manquantes"
          description="Ces pages évitent les liens cassés et couvrent les obligations les plus fréquentes."
          className="border-amber-200 bg-amber-50"
        >
          <p className="text-sm font-medium text-amber-800 mb-3">Pages recommandées à créer :</p>
          <div className="flex flex-wrap gap-2">
            {pagesPrecreesManquantes.map(p => (
              <button
                key={p.code}
                onClick={() => { setEdition(null); setModal(true); }}
                className="text-xs px-3 py-1.5 bg-white border border-amber-200 text-amber-700 rounded-lg hover:bg-amber-100 transition-colors"
              >
                + {p.titre}
              </button>
            ))}
          </div>
        </CarteSectionAdmin>
      )}

      <CarteSectionAdmin
        titre="Bibliothèque des pages"
        description="Activez les pages publiques, ouvrez leur aperçu et pilotez leur présence dans le pied de page."
      >
      <div className="-m-5 divide-y divide-slate-100">
        {chargement ? <div className="py-10 text-center text-slate-400 text-sm">Chargement…</div>
          : items.length === 0 ? (
          <div className="py-10 text-center space-y-2">
            <p className="text-slate-400 text-sm">Aucune page légale.</p>
            <p className="text-xs text-slate-400">Créez les pages Mentions légales et Politique de confidentialité pour éviter les liens cassés dans le pied de page.</p>
          </div>
        ) : items.map(item => (
          <div key={item.id} className="flex items-center gap-4 py-3 px-4 hover:bg-slate-50">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => ouvrir(item)}
                  className="truncate font-medium text-slate-800 transition-colors hover:text-primaire-600"
                >
                  {item.titre}
                </button>
                <span className="badge-neutre text-xs shrink-0">{TYPES_PAGE[item.type_page] ?? item.type_page}</span>
                {!item.est_publiee && <span className="badge-danger text-xs shrink-0">Hors ligne</span>}
                {item.afficher_dans_pied_de_page && <span className="badge-info text-xs shrink-0">Pied de page</span>}
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">/pages/{item.code}</p>
            </div>
            <ActionsRapidesAdaptatives
              actions={[
                {
                  titre: "Aperçu public",
                  icone: ExternalLink,
                  href: `/pages/${item.code}`,
                  target: "_blank",
                  rel: "noopener noreferrer",
                },
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
