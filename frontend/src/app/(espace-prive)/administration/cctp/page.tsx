"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Edit3,
  FileText,
  Layers,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { api, ErreurApi, extraireListeResultats } from "@/crochets/useApi";
import {
  AlerteAdmin,
  CarteSectionAdmin,
  EntetePageAdmin,
} from "@/composants/administration/Presentation";

interface LotCCTP {
  id: string;
  code: string;
  intitule: string;
  description: string;
  nb_articles: number;
  nb_prescriptions: number;
  ordre: number;
}

interface FormulaireCreation {
  code: string;
  intitule: string;
  description: string;
  ordre: number;
}

const VIDE: FormulaireCreation = { code: "", intitule: "", description: "", ordre: 0 };

export default function PageAdminCCTP() {
  const [lots, setLots] = useState<LotCCTP[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  const [recherche, setRecherche] = useState("");
  const [modalCreation, setModalCreation] = useState(false);
  const [modalEdition, setModalEdition] = useState<LotCCTP | null>(null);
  const [formData, setFormData] = useState<FormulaireCreation>(VIDE);
  const [enregistrement, setEnregistrement] = useState(false);

  const charger = () => {
    setChargement(true);
    api.get<LotCCTP[] | { results: LotCCTP[] }>("/api/pieces-ecrites/lots-cctp/")
      .then((data) => setLots(extraireListeResultats(data)))
      .catch(() => setErreur("Impossible de charger les lots CCTP."))
      .finally(() => setChargement(false));
  };

  useEffect(() => { charger(); }, []);

  const lotsFiltrés = lots.filter(
    (l) =>
      !recherche ||
      l.code.toLowerCase().includes(recherche.toLowerCase()) ||
      l.intitule.toLowerCase().includes(recherche.toLowerCase())
  );

  const ouvrirCreation = () => {
    setFormData({ ...VIDE, ordre: lots.length + 1 });
    setModalCreation(true);
    setErreur(null);
  };

  const ouvrirEdition = (lot: LotCCTP) => {
    setFormData({
      code: lot.code,
      intitule: lot.intitule,
      description: lot.description || "",
      ordre: lot.ordre || 0,
    });
    setModalEdition(lot);
    setErreur(null);
  };

  const enregistrerCreation = async () => {
    if (!formData.code || !formData.intitule) {
      setErreur("Le code et l'intitulé sont obligatoires.");
      return;
    }
    setEnregistrement(true);
    setErreur(null);
    try {
      await api.post("/api/pieces-ecrites/lots-cctp/", formData);
      setSucces("Lot CCTP créé.");
      setModalCreation(false);
      charger();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Création impossible.");
    } finally {
      setEnregistrement(false);
    }
  };

  const enregistrerEdition = async () => {
    if (!modalEdition) return;
    if (!formData.code || !formData.intitule) {
      setErreur("Le code et l'intitulé sont obligatoires.");
      return;
    }
    setEnregistrement(true);
    setErreur(null);
    try {
      await api.patch(`/api/pieces-ecrites/lots-cctp/${modalEdition.id}/`, formData);
      setSucces("Lot CCTP mis à jour.");
      setModalEdition(null);
      charger();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Modification impossible.");
    } finally {
      setEnregistrement(false);
    }
  };

  const supprimerLot = async (lot: LotCCTP) => {
    if (!window.confirm(`Supprimer le lot "${lot.code} — ${lot.intitule}" ?\n\nSes articles et prescriptions seront désassociés.`)) return;
    setErreur(null);
    try {
      await api.supprimer(`/api/pieces-ecrites/lots-cctp/${lot.id}/`);
      setSucces(`Lot ${lot.code} supprimé.`);
      charger();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Suppression impossible.");
    }
  };

  const FormulaireLot = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="libelle-champ">Code <span className="text-red-500">*</span></label>
          <input
            type="text"
            className="champ-saisie w-full"
            placeholder="ex : GO, VRD, ELEC"
            value={formData.code}
            onChange={(e) => setFormData((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
          />
        </div>
        <div>
          <label className="libelle-champ">Ordre</label>
          <input
            type="number"
            className="champ-saisie w-full"
            min={0}
            value={formData.ordre}
            onChange={(e) => setFormData((f) => ({ ...f, ordre: Number(e.target.value) }))}
          />
        </div>
      </div>
      <div>
        <label className="libelle-champ">Intitulé <span className="text-red-500">*</span></label>
        <input
          type="text"
          className="champ-saisie w-full"
          placeholder="ex : Gros Œuvre"
          value={formData.intitule}
          onChange={(e) => setFormData((f) => ({ ...f, intitule: e.target.value }))}
        />
      </div>
      <div>
        <label className="libelle-champ">Description</label>
        <textarea
          className="champ-saisie w-full resize-none"
          rows={3}
          placeholder="Description du lot (optionnel)…"
          value={formData.description}
          onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value }))}
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <EntetePageAdmin
        titre="CCTP — Lots & Articles"
        description="Gestion des lots CCTP, articles, prescriptions et normes associées."
        statistiques={[
          { libelle: "Lots CCTP", valeur: lots.length },
          { libelle: "Articles", valeur: lots.reduce((s, l) => s + (l.nb_articles ?? 0), 0) },
          { libelle: "Prescriptions", valeur: lots.reduce((s, l) => s + (l.nb_prescriptions ?? 0), 0) },
        ]}
        actions={(
          <div className="flex gap-2">
            <Link href="/bibliotheque?onglet=cctp" className="btn-secondaire">
              <BookOpen className="h-4 w-4" />
              Bibliothèque CCTP
            </Link>
            <button onClick={ouvrirCreation} className="btn-primaire">
              <Plus className="h-4 w-4" />
              Nouveau lot
            </button>
          </div>
        )}
      />

      {succes && <AlerteAdmin type="succes">{succes}</AlerteAdmin>}
      {erreur && <AlerteAdmin type="erreur">{erreur}</AlerteAdmin>}

      {/* Recherche */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          className="champ-saisie pl-9 w-full"
          placeholder="Rechercher un lot…"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
        />
      </div>

      {/* Liste des lots */}
      <CarteSectionAdmin
        titre={`${lotsFiltrés.length} lot${lotsFiltrés.length > 1 ? "s" : ""} CCTP`}
        description="Cliquez sur un lot pour consulter ses articles et prescriptions."
      >
        {chargement ? (
          <div className="py-12 text-center text-sm text-slate-400">Chargement…</div>
        ) : lotsFiltrés.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-400">
            {recherche ? "Aucun lot ne correspond à la recherche." : "Aucun lot CCTP pour le moment."}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {lotsFiltrés
              .sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0) || a.code.localeCompare(b.code))
              .map((lot) => (
                <div key={lot.id} className="flex items-center gap-4 py-3">
                  {/* Icône lot */}
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50">
                    <Layers className="h-4 w-4 text-emerald-600" />
                  </div>

                  {/* Contenu */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">
                        {lot.code}
                      </span>
                      <p className="text-sm font-medium text-slate-800 truncate">{lot.intitule}</p>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {lot.nb_articles ?? 0} article{(lot.nb_articles ?? 0) > 1 ? "s" : ""} ·{" "}
                      {lot.nb_prescriptions ?? 0} prescription{(lot.nb_prescriptions ?? 0) > 1 ? "s" : ""}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => ouvrirEdition(lot)}
                      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Modifier
                    </button>
                    <button
                      onClick={() => supprimerLot(lot)}
                      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}
      </CarteSectionAdmin>

      {/* Modal création */}
      {modalCreation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="font-semibold text-slate-900">Nouveau lot CCTP</h2>
              <button
                onClick={() => setModalCreation(false)}
                className="rounded-lg p-1.5 hover:bg-slate-100"
              >
                <X className="h-4 w-4 text-slate-500" />
              </button>
            </div>
            <div className="p-6">
              {erreur && <AlerteAdmin type="erreur" >{erreur}</AlerteAdmin>}
              <FormulaireLot />
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
              <button onClick={() => setModalCreation(false)} className="btn-secondaire">
                Annuler
              </button>
              <button onClick={enregistrerCreation} disabled={enregistrement} className="btn-primaire">
                {enregistrement ? (
                  <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />Création…</>
                ) : (
                  <><Save className="h-4 w-4" />Créer le lot</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal édition */}
      {modalEdition && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="font-semibold text-slate-900">Modifier — {modalEdition.code}</h2>
              <button
                onClick={() => setModalEdition(null)}
                className="rounded-lg p-1.5 hover:bg-slate-100"
              >
                <X className="h-4 w-4 text-slate-500" />
              </button>
            </div>
            <div className="p-6">
              {erreur && <AlerteAdmin type="erreur">{erreur}</AlerteAdmin>}
              <FormulaireLot />
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
              <button onClick={() => setModalEdition(null)} className="btn-secondaire">
                Annuler
              </button>
              <button onClick={enregistrerEdition} disabled={enregistrement} className="btn-primaire">
                {enregistrement ? (
                  <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />Enregistrement…</>
                ) : (
                  <><Save className="h-4 w-4" />Enregistrer</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
