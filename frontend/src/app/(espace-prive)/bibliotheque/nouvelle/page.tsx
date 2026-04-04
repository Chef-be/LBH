"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, ErreurApi } from "@/crochets/useApi";
import { ArrowLeft, Save, Plus, Trash2, AlertCircle, X } from "lucide-react";

const NIVEAUX = [
  { val: "reference", lib: "Référence (général)" },
  { val: "territorial", lib: "Territorial (zone géo)" },
  { val: "entreprise", lib: "Entreprise" },
  { val: "affaire", lib: "Affaire (projet)" },
  { val: "negocie", lib: "Négocié" },
  { val: "constate", lib: "Constaté" },
];

const TYPES_RESSOURCE = [
  { val: "mo", lib: "Main-d'œuvre" },
  { val: "matiere", lib: "Matière" },
  { val: "materiel", lib: "Matériel" },
  { val: "sous_traitance", lib: "Sous-traitance" },
  { val: "transport", lib: "Transport" },
  { val: "frais_divers", lib: "Frais divers" },
];

interface SousDetail {
  type_ressource: string;
  code: string;
  designation: string;
  unite: string;
  quantite: string;
  cout_unitaire_ht: string;
}

const VIDE_SOUS_DETAIL: SousDetail = {
  type_ressource: "mo",
  code: "",
  designation: "",
  unite: "h",
  quantite: "",
  cout_unitaire_ht: "",
};

export default function PageNouvelleLigneBibliotheque() {
  const router = useRouter();
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [sousDetails, setSousDetails] = useState<SousDetail[]>([]);

  const [form, setForm] = useState({
    niveau: "reference",
    code: "",
    famille: "",
    sous_famille: "",
    corps_etat: "",
    lot: "",
    designation_courte: "",
    designation_longue: "",
    unite: "u",
    hypotheses: "",
    contexte_emploi: "",
    observations_techniques: "",
    temps_main_oeuvre: "",
    cout_horaire_mo: "",
    cout_matieres: "",
    cout_materiel: "",
    cout_sous_traitance: "",
    cout_transport: "",
    debourse_sec_unitaire: "",
    prix_vente_unitaire: "",
    source: "",
    fiabilite: "3",
  });

  const maj = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }));

  const majSd = (i: number, k: keyof SousDetail, v: string) =>
    setSousDetails(prev => prev.map((sd, idx) => idx === i ? { ...sd, [k]: v } : sd));

  const ajouterSd = () => setSousDetails(prev => [...prev, { ...VIDE_SOUS_DETAIL }]);
  const supprimerSd = (i: number) => setSousDetails(prev => prev.filter((_, idx) => idx !== i));

  // Calcul automatique du déboursé sec depuis les sous-détails
  const recalculer = () => {
    const totalMo = sousDetails
      .filter(sd => sd.type_ressource === "mo")
      .reduce((s, sd) => s + (Number(sd.quantite) || 0) * (Number(sd.cout_unitaire_ht) || 0), 0);
    const totalMatieres = sousDetails
      .filter(sd => sd.type_ressource === "matiere")
      .reduce((s, sd) => s + (Number(sd.quantite) || 0) * (Number(sd.cout_unitaire_ht) || 0), 0);
    const totalMateriel = sousDetails
      .filter(sd => sd.type_ressource === "materiel")
      .reduce((s, sd) => s + (Number(sd.quantite) || 0) * (Number(sd.cout_unitaire_ht) || 0), 0);
    const totalSt = sousDetails
      .filter(sd => sd.type_ressource === "sous_traitance")
      .reduce((s, sd) => s + (Number(sd.quantite) || 0) * (Number(sd.cout_unitaire_ht) || 0), 0);
    const totalTransport = sousDetails
      .filter(sd => sd.type_ressource === "transport")
      .reduce((s, sd) => s + (Number(sd.quantite) || 0) * (Number(sd.cout_unitaire_ht) || 0), 0);

    const ds = totalMo + totalMatieres + totalMateriel + totalSt + totalTransport;
    setForm(p => ({
      ...p,
      debourse_sec_unitaire: ds.toFixed(2),
      cout_matieres: totalMatieres.toFixed(2),
      cout_materiel: totalMateriel.toFixed(2),
      cout_sous_traitance: totalSt.toFixed(2),
      cout_transport: totalTransport.toFixed(2),
    }));
  };

  const soumettre = async () => {
    if (!form.designation_courte.trim()) { setErreur("La désignation courte est requise."); return; }
    if (!form.unite.trim()) { setErreur("L'unité est requise."); return; }

    setChargement(true);
    setErreur(null);
    setErreurs({});
    try {
      const payload: Record<string, unknown> = {
        niveau: form.niveau,
        code: form.code || null,
        famille: form.famille,
        sous_famille: form.sous_famille,
        corps_etat: form.corps_etat,
        lot: form.lot,
        designation_courte: form.designation_courte,
        designation_longue: form.designation_longue,
        unite: form.unite,
        hypotheses: form.hypotheses,
        contexte_emploi: form.contexte_emploi,
        observations_techniques: form.observations_techniques,
        temps_main_oeuvre: form.temps_main_oeuvre ? Number(form.temps_main_oeuvre) : null,
        cout_horaire_mo: form.cout_horaire_mo ? Number(form.cout_horaire_mo) : null,
        cout_matieres: form.cout_matieres ? Number(form.cout_matieres) : null,
        cout_materiel: form.cout_materiel ? Number(form.cout_materiel) : null,
        cout_sous_traitance: form.cout_sous_traitance ? Number(form.cout_sous_traitance) : null,
        cout_transport: form.cout_transport ? Number(form.cout_transport) : null,
        debourse_sec_unitaire: form.debourse_sec_unitaire ? Number(form.debourse_sec_unitaire) : null,
        prix_vente_unitaire: form.prix_vente_unitaire ? Number(form.prix_vente_unitaire) : null,
        source: form.source,
        fiabilite: Number(form.fiabilite),
        statut_validation: "brouillon",
      };

      const ligne = await api.post<{ id: string }>("/api/bibliotheque/", payload);

      // Créer les sous-détails si présents
      if (sousDetails.length > 0) {
        for (const [i, sd] of sousDetails.entries()) {
          await api.post(`/api/bibliotheque/${ligne.id}/sous-details/`, {
            ligne_prix: ligne.id,
            ordre: i + 1,
            type_ressource: sd.type_ressource,
            code: sd.code,
            designation: sd.designation,
            unite: sd.unite,
            quantite: sd.quantite ? Number(sd.quantite) : 0,
            cout_unitaire_ht: sd.cout_unitaire_ht ? Number(sd.cout_unitaire_ht) : 0,
          });
        }
      }

      router.push(`/bibliotheque/${ligne.id}`);
    } catch (e) {
      if (e instanceof ErreurApi && e.erreurs) {
        const errs: Record<string, string> = {};
        Object.entries(e.erreurs).forEach(([k, v]) => {
          if (Array.isArray(v)) errs[k] = v[0];
        });
        setErreurs(errs);
        setErreur("Veuillez corriger les erreurs ci-dessous.");
      } else {
        setErreur(e instanceof ErreurApi ? e.detail : "Erreur lors de la création.");
      }
    } finally {
      setChargement(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/bibliotheque" className="text-slate-400 hover:text-slate-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1>Nouvelle ligne de prix</h1>
          <p className="text-slate-500 text-sm mt-0.5">Bibliothèque de prix</p>
        </div>
      </div>

      {erreur && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />{erreur}
          <button onClick={() => setErreur(null)} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Identification */}
      <div className="carte p-6 space-y-4">
        <h2 className="font-semibold text-slate-800">Identification</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="libelle-champ">Niveau</label>
            <select className="champ-saisie w-full bg-white" value={form.niveau}
              onChange={e => maj("niveau", e.target.value)}>
              {NIVEAUX.map(n => <option key={n.val} value={n.val}>{n.lib}</option>)}
            </select>
          </div>
          <div>
            <label className="libelle-champ">Code</label>
            <input type="text" className="champ-saisie w-full font-mono" placeholder="VRD-TERS-001"
              value={form.code} onChange={e => maj("code", e.target.value)} />
            {erreurs.code && <p className="text-xs text-red-500 mt-1">{erreurs.code}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="libelle-champ">Famille</label>
            <input type="text" className="champ-saisie w-full" placeholder="VRD"
              value={form.famille} onChange={e => maj("famille", e.target.value)} />
          </div>
          <div>
            <label className="libelle-champ">Sous-famille</label>
            <input type="text" className="champ-saisie w-full" placeholder="Terrassements"
              value={form.sous_famille} onChange={e => maj("sous_famille", e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="libelle-champ">Corps d&apos;état</label>
            <input type="text" className="champ-saisie w-full" placeholder="Gros œuvre"
              value={form.corps_etat} onChange={e => maj("corps_etat", e.target.value)} />
          </div>
          <div>
            <label className="libelle-champ">Lot</label>
            <input type="text" className="champ-saisie w-full" placeholder="Lot 7 — VRD"
              value={form.lot} onChange={e => maj("lot", e.target.value)} />
          </div>
        </div>

        <div>
          <label className="libelle-champ">Désignation courte <span className="text-red-500">*</span></label>
          <input type="text" className="champ-saisie w-full"
            placeholder="Terrassements généraux en déblai — tout venant"
            value={form.designation_courte} onChange={e => maj("designation_courte", e.target.value)} />
          {erreurs.designation_courte && <p className="text-xs text-red-500 mt-1">{erreurs.designation_courte}</p>}
        </div>

        <div>
          <label className="libelle-champ">Désignation longue</label>
          <textarea rows={3} className="champ-saisie w-full"
            placeholder="Description technique détaillée incluant les conditions d'emploi, les hypothèses de pose et les tolérances applicables…"
            value={form.designation_longue} onChange={e => maj("designation_longue", e.target.value)} />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="libelle-champ">Unité <span className="text-red-500">*</span></label>
            <input type="text" className="champ-saisie w-full" placeholder="m³"
              value={form.unite} onChange={e => maj("unite", e.target.value)} maxLength={20} />
          </div>
          <div>
            <label className="libelle-champ">Fiabilité (1–5)</label>
            <select className="champ-saisie w-full bg-white" value={form.fiabilite}
              onChange={e => maj("fiabilite", e.target.value)}>
              {[1, 2, 3, 4, 5].map(n => (
                <option key={n} value={n}>{n} — {["", "Faible", "Assez faible", "Moyenne", "Bonne", "Excellente"][n]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="libelle-champ">Source</label>
            <input type="text" className="champ-saisie w-full" placeholder="ARTIPRIX 2025"
              value={form.source} onChange={e => maj("source", e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="libelle-champ">Hypothèses de base</label>
            <textarea rows={2} className="champ-saisie w-full" placeholder="Terrain plat, sol argileux…"
              value={form.hypotheses} onChange={e => maj("hypotheses", e.target.value)} />
          </div>
          <div>
            <label className="libelle-champ">Contexte d&apos;emploi</label>
            <textarea rows={2} className="champ-saisie w-full" placeholder="Hors zone inondable…"
              value={form.contexte_emploi} onChange={e => maj("contexte_emploi", e.target.value)} />
          </div>
        </div>
      </div>

      {/* Décomposition des coûts */}
      <div className="carte p-6 space-y-4">
        <h2 className="font-semibold text-slate-800">Décomposition des coûts</h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div>
            <label className="libelle-champ">Temps MO (h/u)</label>
            <input type="number" step="0.001" className="champ-saisie w-full text-right"
              value={form.temps_main_oeuvre} onChange={e => maj("temps_main_oeuvre", e.target.value)} />
          </div>
          <div>
            <label className="libelle-champ">Coût horaire MO (€/h)</label>
            <input type="number" step="0.01" className="champ-saisie w-full text-right"
              value={form.cout_horaire_mo} onChange={e => maj("cout_horaire_mo", e.target.value)} />
          </div>
          <div>
            <label className="libelle-champ">Matières (€)</label>
            <input type="number" step="0.01" className="champ-saisie w-full text-right"
              value={form.cout_matieres} onChange={e => maj("cout_matieres", e.target.value)} />
          </div>
          <div>
            <label className="libelle-champ">Matériel (€)</label>
            <input type="number" step="0.01" className="champ-saisie w-full text-right"
              value={form.cout_materiel} onChange={e => maj("cout_materiel", e.target.value)} />
          </div>
          <div>
            <label className="libelle-champ">Sous-traitance (€)</label>
            <input type="number" step="0.01" className="champ-saisie w-full text-right"
              value={form.cout_sous_traitance} onChange={e => maj("cout_sous_traitance", e.target.value)} />
          </div>
          <div>
            <label className="libelle-champ">Transport (€)</label>
            <input type="number" step="0.01" className="champ-saisie w-full text-right"
              value={form.cout_transport} onChange={e => maj("cout_transport", e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
          <div>
            <label className="libelle-champ font-semibold">Déboursé sec unit. HT (€)</label>
            <input type="number" step="0.01" className="champ-saisie w-full text-right font-mono font-semibold"
              value={form.debourse_sec_unitaire} onChange={e => maj("debourse_sec_unitaire", e.target.value)} />
          </div>
          <div>
            <label className="libelle-champ font-semibold">Prix de vente unit. HT (€)</label>
            <input type="number" step="0.01" className="champ-saisie w-full text-right font-mono font-semibold"
              value={form.prix_vente_unitaire} onChange={e => maj("prix_vente_unitaire", e.target.value)} />
          </div>
        </div>
      </div>

      {/* Sous-détails */}
      <div className="carte p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">Sous-détail analytique</h2>
          <div className="flex items-center gap-2">
            {sousDetails.length > 0 && (
              <button onClick={recalculer} className="btn-secondaire text-xs">
                Recalculer DS
              </button>
            )}
            <button onClick={ajouterSd} className="btn-secondaire">
              <Plus className="w-4 h-4" />Ajouter une ressource
            </button>
          </div>
        </div>

        {sousDetails.length === 0 ? (
          <p className="text-sm text-slate-400 py-4 text-center">
            Aucun sous-détail. Les coûts peuvent être saisis directement ci-dessus.
          </p>
        ) : (
          <div className="space-y-3">
            {sousDetails.map((sd, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-end p-3 bg-slate-50 rounded-xl">
                <div className="col-span-3">
                  {i === 0 && <label className="libelle-champ">Type</label>}
                  <select className="champ-saisie w-full bg-white text-xs" value={sd.type_ressource}
                    onChange={e => majSd(i, "type_ressource", e.target.value)}>
                    {TYPES_RESSOURCE.map(t => <option key={t.val} value={t.val}>{t.lib}</option>)}
                  </select>
                </div>
                <div className="col-span-4">
                  {i === 0 && <label className="libelle-champ">Désignation</label>}
                  <input type="text" className="champ-saisie w-full text-xs" placeholder="Terrassier"
                    value={sd.designation} onChange={e => majSd(i, "designation", e.target.value)} />
                </div>
                <div className="col-span-1">
                  {i === 0 && <label className="libelle-champ">Unité</label>}
                  <input type="text" className="champ-saisie w-full text-xs" placeholder="h"
                    value={sd.unite} onChange={e => majSd(i, "unite", e.target.value)} />
                </div>
                <div className="col-span-2">
                  {i === 0 && <label className="libelle-champ">Qté</label>}
                  <input type="number" step="0.001" className="champ-saisie w-full text-right text-xs"
                    value={sd.quantite} onChange={e => majSd(i, "quantite", e.target.value)} />
                </div>
                <div className="col-span-1">
                  {i === 0 && <label className="libelle-champ">PU HT</label>}
                  <input type="number" step="0.01" className="champ-saisie w-full text-right text-xs"
                    value={sd.cout_unitaire_ht} onChange={e => majSd(i, "cout_unitaire_ht", e.target.value)} />
                </div>
                <div className="col-span-1 flex justify-end">
                  <button onClick={() => supprimerSd(i)} className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3 pb-6">
        <Link href="/bibliotheque" className="btn-secondaire">Annuler</Link>
        <button onClick={soumettre} disabled={chargement} className="btn-primaire disabled:opacity-60">
          {chargement ? "Création…" : <><Save className="w-4 h-4" />Créer la ligne</>}
        </button>
      </div>
    </div>
  );
}
