"use client";

import { useState, useEffect } from "react";
import { api, ErreurApi, extraireListeResultats } from "@/crochets/useApi";
import { EditeurTexteRiche } from "@/composants/ui/EditeurTexteRiche";
import { ActionsRapidesAdaptatives } from "@/composants/ui/ActionsRapides";
import {
  Plus, Pencil, Trash2, Eye, EyeOff, GripVertical,
  X, Save, AlertCircle,
} from "lucide-react";
import {
  AlerteAdmin,
  CarteSectionAdmin,
  EntetePageAdmin,
} from "@/composants/administration/Presentation";

interface Prestation {
  id: string;
  slug: string;
  titre: string;
  categorie: string;
  description_courte: string;
  description_longue: string;
  icone: string;
  couleur: string;
  points_forts: string[];
  titre_page: string;
  accroche_page: string;
  livrables: string[];
  ordre_affichage: number;
  est_publie: boolean;
}

const CATEGORIES: Record<string, string> = {
  economie: "Économie de la construction",
  vrd: "Voirie et réseaux divers",
  batiment: "Bâtiment",
  assistance: "Assistance MOE",
  documents: "Documents de marché",
  autre: "Autre",
};

const COULEURS = [
  "primaire", "amber", "green", "indigo", "purple", "rose", "slate", "orange",
];

const VIDE: Omit<Prestation, "id" | "slug"> = {
  titre: "",
  categorie: "autre",
  description_courte: "",
  description_longue: "",
  icone: "FileText",
  couleur: "primaire",
  points_forts: [],
  titre_page: "",
  accroche_page: "",
  livrables: [],
  ordre_affichage: 100,
  est_publie: true,
};

function listeVersTexte(valeur: string[] | undefined) {
  return (valeur ?? []).join("\n");
}

function texteVersListe(valeur: string) {
  return valeur
    .split("\n")
    .map((ligne) => ligne.trim())
    .filter(Boolean);
}

function ModalPrestation({
  initial,
  onEnregistrer,
  onFermer,
}: {
  initial: Prestation | null;
  onEnregistrer: (donnees: Partial<Prestation>) => Promise<void>;
  onFermer: () => void;
}) {
  const [form, setForm] = useState<Omit<Prestation, "id" | "slug">>(initial ? {
    titre: initial.titre,
    categorie: initial.categorie,
    description_courte: initial.description_courte,
    description_longue: initial.description_longue,
    icone: initial.icone,
    couleur: initial.couleur,
    points_forts: initial.points_forts ?? [],
    titre_page: initial.titre_page ?? "",
    accroche_page: initial.accroche_page ?? "",
    livrables: initial.livrables ?? [],
    ordre_affichage: initial.ordre_affichage,
    est_publie: initial.est_publie,
  } : { ...VIDE });
  const [pointsFortsTexte, setPointsFortsTexte] = useState(listeVersTexte(initial?.points_forts));
  const [livrablesTexte, setLivrablesTexte] = useState(listeVersTexte(initial?.livrables));
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const maj = (champ: keyof typeof form, val: string | boolean | number) =>
    setForm((prev) => ({ ...prev, [champ]: val }));

  const soumettre = async () => {
    if (!form.titre.trim()) { setErreur("Le titre est requis."); return; }
    setChargement(true);
    setErreur(null);
    try {
      await onEnregistrer({
        ...form,
        points_forts: texteVersListe(pointsFortsTexte),
        livrables: texteVersListe(livrablesTexte),
      });
      onFermer();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Erreur lors de l'enregistrement.");
    } finally {
      setChargement(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-800">
            {initial ? "Modifier la prestation" : "Nouvelle prestation"}
          </h2>
          <button onClick={onFermer} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {erreur && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {erreur}
            </div>
          )}

          <div>
            <label className="libelle-champ">Titre <span className="text-red-500">*</span></label>
            <input
              type="text" className="champ-saisie w-full"
              value={form.titre}
              onChange={(e) => maj("titre", e.target.value)}
              placeholder="Économie de la construction"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="libelle-champ">Catégorie</label>
              <select className="champ-saisie w-full bg-white" value={form.categorie}
                onChange={(e) => maj("categorie", e.target.value)}>
                {Object.entries(CATEGORIES).map(([val, lib]) => (
                  <option key={val} value={val}>{lib}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="libelle-champ">Couleur de la carte</label>
              <select className="champ-saisie w-full bg-white" value={form.couleur}
                onChange={(e) => maj("couleur", e.target.value)}>
                {COULEURS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="libelle-champ">Description courte</label>
            <textarea
              rows={3} className="champ-saisie w-full resize-none"
              value={form.description_courte}
              onChange={(e) => maj("description_courte", e.target.value)}
              placeholder="Description affichée sur la carte (400 car. max)"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <label className="libelle-champ">Titre de la page détail</label>
              <input
                type="text"
                className="champ-saisie w-full"
                value={form.titre_page}
                onChange={(e) => maj("titre_page", e.target.value)}
                placeholder="Titre spécifique pour la page prestation"
              />
            </div>
            <div>
              <label className="libelle-champ">Accroche de la page détail</label>
              <textarea
                rows={3}
                className="champ-saisie w-full resize-none"
                value={form.accroche_page}
                onChange={(e) => maj("accroche_page", e.target.value)}
                placeholder="Texte d'introduction affiché sous le titre"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="libelle-champ">Icône (lucide-react)</label>
              <input
                type="text" className="champ-saisie w-full"
                value={form.icone}
                onChange={(e) => maj("icone", e.target.value)}
                placeholder="TrendingUp"
              />
            </div>
            <div>
              <label className="libelle-champ">Ordre d&apos;affichage</label>
              <input
                type="number" className="champ-saisie w-full" min={1} max={999}
                value={form.ordre_affichage}
                onChange={(e) => maj("ordre_affichage", parseInt(e.target.value) || 100)}
              />
            </div>
          </div>

          <div>
            <label className="libelle-champ">Description détaillée</label>
            <EditeurTexteRiche
              valeur={form.description_longue}
              onChange={(html) => maj("description_longue", html)}
              placeholder="Développez la mission, le périmètre, la méthode et les livrables de cette prestation…"
              hauteurMinimale="min-h-[20rem]"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <label className="libelle-champ">Points forts</label>
              <textarea
                rows={6}
                className="champ-saisie w-full resize-none"
                value={pointsFortsTexte}
                onChange={(e) => setPointsFortsTexte(e.target.value)}
                placeholder={"Un point fort par ligne\nAnalyse de rentabilité\nRévision des prix"}
              />
            </div>
            <div>
              <label className="libelle-champ">Livrables</label>
              <textarea
                rows={6}
                className="champ-saisie w-full resize-none"
                value={livrablesTexte}
                onChange={(e) => setLivrablesTexte(e.target.value)}
                placeholder={"Un livrable par ligne\nDPGF / BPU / DQE\nNote méthodologique"}
              />
            </div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="w-4 h-4 rounded text-primaire-600"
              checked={form.est_publie}
              onChange={(e) => maj("est_publie", e.target.checked)}
            />
            <span className="text-sm text-slate-700 font-medium">Publiée (visible sur le site)</span>
          </label>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
          <button onClick={onFermer} className="btn-secondaire">Annuler</button>
          <button onClick={soumettre} disabled={chargement} className="btn-primaire disabled:opacity-60">
            {chargement ? "Enregistrement…" : (
              <><Save className="w-4 h-4" /> Enregistrer</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PagePrestationsAdmin() {
  const [prestations, setPrestations] = useState<Prestation[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  const [modalOuvert, setModalOuvert] = useState(false);
  const [prestationEnEdition, setPrestationEnEdition] = useState<Prestation | null>(null);

  const charger = async () => {
    try {
      const data = await api.get<Prestation[]>("/api/site/prestations/");
      setPrestations(extraireListeResultats(data));
    } catch {
      setErreur("Impossible de charger les prestations.");
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => { charger(); }, []);

  const afficherSucces = (msg: string) => {
    setSucces(msg);
    setTimeout(() => setSucces(null), 3000);
  };

  const creerOuModifier = async (donnees: Partial<Prestation>) => {
    if (prestationEnEdition) {
      await api.patch(`/api/site/prestations/${prestationEnEdition.id}/`, donnees);
      afficherSucces("Prestation modifiée.");
    } else {
      await api.post("/api/site/prestations/", donnees);
      afficherSucces("Prestation créée.");
    }
    await charger();
  };

  const basculerPublication = async (prestation: Prestation) => {
    try {
      await api.patch(`/api/site/prestations/${prestation.id}/`, { est_publie: !prestation.est_publie });
      afficherSucces(prestation.est_publie ? "Prestation masquée." : "Prestation publiée.");
      await charger();
    } catch {
      setErreur("Impossible de modifier la publication.");
    }
  };

  const supprimer = async (prestation: Prestation) => {
    if (!window.confirm(`Supprimer définitivement la prestation « ${prestation.titre} » ?`)) return;
    try {
      await api.supprimer(`/api/site/prestations/${prestation.id}/`);
      afficherSucces("Prestation supprimée.");
      await charger();
    } catch {
      setErreur("Impossible de supprimer la prestation.");
    }
  };

  const ouvrir = (prestation?: Prestation) => {
    setPrestationEnEdition(prestation ?? null);
    setModalOuvert(true);
  };

  return (
    <div className="space-y-6">
      <EntetePageAdmin
        titre="Prestations"
        description="Administrez les cartes de service, leur page détail et leur visibilité sur le site."
        actions={(
          <button onClick={() => ouvrir()} className="btn-primaire">
            <Plus className="w-4 h-4" />
            Nouvelle prestation
          </button>
        )}
        statistiques={[
          { libelle: "Total", valeur: `${prestations.length} prestation${prestations.length > 1 ? "s" : ""}` },
          { libelle: "Publiées", valeur: `${prestations.filter((prestation) => prestation.est_publie).length}` },
          { libelle: "Masquées", valeur: `${prestations.filter((prestation) => !prestation.est_publie).length}` },
          { libelle: "Catégories", valeur: `${new Set(prestations.map((prestation) => prestation.categorie)).size}` },
        ]}
      />

      {succes && <AlerteAdmin type="succes">{succes}</AlerteAdmin>}
      {erreur && <AlerteAdmin type="erreur" action={<button onClick={() => setErreur(null)} className="ml-auto"><X className="w-4 h-4" /></button>}>{erreur}</AlerteAdmin>}

      <CarteSectionAdmin
        titre="Catalogue des prestations"
        description="Chaque ligne contrôle la publication, l’édition détaillée et la suppression."
      >
      <div className="-m-5 divide-y divide-slate-100">
        {chargement ? (
          <div className="py-12 text-center text-slate-400 text-sm">Chargement…</div>
        ) : prestations.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">
            Aucune prestation. Créez-en une en cliquant sur &quot;Nouvelle prestation&quot;.
          </div>
        ) : (
          prestations.map((p) => (
            <div key={p.id} className="flex items-center gap-4 py-3 px-4 hover:bg-slate-50 transition-colors">
              <GripVertical className="w-4 h-4 text-slate-300 shrink-0 cursor-grab" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => ouvrir(p)}
                    className="truncate font-medium text-slate-800 transition-colors hover:text-primaire-600"
                  >
                    {p.titre}
                  </button>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 shrink-0">
                    {CATEGORIES[p.categorie] ?? p.categorie}
                  </span>
                  {!p.est_publie && (
                    <span className="badge-neutre text-xs shrink-0">Non publiée</span>
                  )}
                </div>
                {p.description_courte && (
                  <p className="text-xs text-slate-400 truncate mt-0.5">{p.description_courte}</p>
                )}
              </div>
              <ActionsRapidesAdaptatives
                actions={[
                  {
                    titre: p.est_publie ? "Masquer" : "Publier",
                    icone: p.est_publie ? Eye : EyeOff,
                    onClick: () => basculerPublication(p),
                  },
                  {
                    titre: "Modifier",
                    icone: Pencil,
                    variante: "primaire",
                    onClick: () => ouvrir(p),
                  },
                  {
                    titre: "Supprimer",
                    icone: Trash2,
                    variante: "danger",
                    onClick: () => supprimer(p),
                  },
                ]}
              />
            </div>
          ))
        )}
      </div>
      </CarteSectionAdmin>

      {modalOuvert && (
        <ModalPrestation
          initial={prestationEnEdition}
          onEnregistrer={creerOuModifier}
          onFermer={() => { setModalOuvert(false); setPrestationEnEdition(null); }}
        />
      )}
    </div>
  );
}
