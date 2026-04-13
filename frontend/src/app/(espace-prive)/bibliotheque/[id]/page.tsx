"use client";

import { useState, useEffect, use, useCallback } from "react";
import Link from "next/link";
import { api, ErreurApi } from "@/crochets/useApi";
import {
  ArrowLeft, CheckCircle, AlertCircle, X, BookOpen,
  ChevronRight, Star, RefreshCw, Pencil, Trash2, Plus, Save,
} from "lucide-react";

interface SousDetail {
  id: string;
  ordre: number;
  type_ressource: string;
  type_libelle: string;
  code: string;
  designation: string;
  unite: string;
  quantite: number;
  cout_unitaire_ht: number;
  montant_ht: number;
  profil_main_oeuvre: string | null;
  profil_main_oeuvre_code: string | null;
  profil_main_oeuvre_libelle: string | null;
  nombre_ressources: number;
  temps_unitaire: number;
  taux_horaire: number;
}

interface ProfilMainOeuvreOption {
  id: string;
  code: string;
  libelle: string;
  niveau_classification: string;
  secteur_activite_libelle: string;
  fonction_equipe: string;
  taux_horaire_recommande_defaut: number | null;
}

interface LignePrix {
  id: string;
  niveau: string;
  niveau_libelle: string;
  code: string;
  famille: string;
  sous_famille: string;
  corps_etat: string;
  lot: string;
  designation_courte: string;
  designation_longue: string;
  unite: string;
  hypotheses: string;
  contexte_emploi: string;
  observations_techniques: string;
  temps_main_oeuvre: number | null;
  cout_horaire_mo: number | null;
  cout_matieres: number | null;
  cout_materiel: number | null;
  cout_sous_traitance: number | null;
  cout_transport: number | null;
  cout_frais_divers: number | null;
  debourse_sec_unitaire: number | null;
  prix_vente_unitaire: number | null;
  source: string;
  fiabilite: number;
  statut_validation: string;
  statut_libelle: string;
  auteur_nom: string | null;
  date_modification: string;
  sous_details: SousDetail[];
  total_mo: number;
  total_matieres: number;
  total_materiel: number;
}

const TYPES_RESSOURCE: Record<string, string> = {
  mo: "Main-d'œuvre",
  matiere: "Matière",
  materiel: "Matériel",
  sous_traitance: "Sous-traitance",
  transport: "Transport",
  frais_divers: "Frais divers",
};

function fmt(val: number | null, dec = 2): string {
  if (val === null || val === undefined) return "—";
  return Number(val).toLocaleString("fr-FR", { minimumFractionDigits: dec, maximumFractionDigits: dec }) + " €";
}

export default function PageDetailBibliotheque({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [ligne, setLigne] = useState<LignePrix | null>(null);
  const [chargement, setChargement] = useState(true);
  const [succes, setSucces] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [recalcul, setRecalcul] = useState(false);
  const [editSD, setEditSD] = useState<SousDetail | null>(null);
  const [ajoutSD, setAjoutSD] = useState(false);
  const [suppSD, setSuppSD] = useState<string | null>(null);
  const [editionLigne, setEditionLigne] = useState(false);
  const [sauvegardeLigne, setSauvegardeLigne] = useState(false);
  const [formulaireLigne, setFormulaireLigne] = useState({
    code: "",
    famille: "",
    sous_famille: "",
    designation_courte: "",
    designation_longue: "",
    unite: "",
    source: "",
    fiabilite: "3",
    hypotheses: "",
    contexte_emploi: "",
    observations_techniques: "",
    temps_main_oeuvre: "",
    cout_horaire_mo: "",
    cout_matieres: "",
    cout_materiel: "",
    cout_sous_traitance: "",
    cout_transport: "",
    cout_frais_divers: "",
    debourse_sec_unitaire: "",
    prix_vente_unitaire: "",
  });

  const charger = useCallback(async () => {
    try {
      setLigne(await api.get<LignePrix>(`/api/bibliotheque/${id}/complet/`));
    } catch {
      setErreur("Ligne introuvable.");
    } finally {
      setChargement(false);
    }
  }, [id]);

  useEffect(() => { charger(); }, [charger]);
  useEffect(() => {
    if (!ligne) return;
    setFormulaireLigne({
      code: ligne.code || "",
      famille: ligne.famille || "",
      sous_famille: ligne.sous_famille || "",
      designation_courte: ligne.designation_courte || "",
      designation_longue: ligne.designation_longue || "",
      unite: ligne.unite || "",
      source: ligne.source || "",
      fiabilite: String(ligne.fiabilite || 3),
      hypotheses: ligne.hypotheses || "",
      contexte_emploi: ligne.contexte_emploi || "",
      observations_techniques: ligne.observations_techniques || "",
      temps_main_oeuvre: ligne.temps_main_oeuvre != null ? String(ligne.temps_main_oeuvre) : "",
      cout_horaire_mo: ligne.cout_horaire_mo != null ? String(ligne.cout_horaire_mo) : "",
      cout_matieres: ligne.cout_matieres != null ? String(ligne.cout_matieres) : "",
      cout_materiel: ligne.cout_materiel != null ? String(ligne.cout_materiel) : "",
      cout_sous_traitance: ligne.cout_sous_traitance != null ? String(ligne.cout_sous_traitance) : "",
      cout_transport: ligne.cout_transport != null ? String(ligne.cout_transport) : "",
      cout_frais_divers: ligne.cout_frais_divers != null ? String(ligne.cout_frais_divers) : "",
      debourse_sec_unitaire: ligne.debourse_sec_unitaire != null ? String(ligne.debourse_sec_unitaire) : "",
      prix_vente_unitaire: ligne.prix_vente_unitaire != null ? String(ligne.prix_vente_unitaire) : "",
    });
  }, [ligne]);

  const flash = (msg: string) => { setSucces(msg); setTimeout(() => setSucces(null), 3500); };
  const majFormulaireLigne = (champ: keyof typeof formulaireLigne, valeur: string) =>
    setFormulaireLigne((precedent) => ({ ...precedent, [champ]: valeur }));

  const valider = async () => {
    try {
      await api.post(`/api/bibliotheque/${id}/valider/`, {});
      flash("Ligne validée.");
      charger();
    } catch (e) { setErreur(e instanceof ErreurApi ? e.detail : "Impossible de valider."); }
  };

  const lancerRecalcul = async () => {
    setRecalcul(true);
    try {
      await api.post(`/api/bibliotheque/${id}/recalculer/`, {});
      flash("Déboursé sec recalculé depuis les sous-détails.");
      charger();
    } catch (e) { setErreur(e instanceof ErreurApi ? e.detail : "Erreur lors du recalcul."); }
    finally { setRecalcul(false); }
  };

  const supprimerSD = async (sdId: string) => {
    try {
      await api.supprimer(`/api/bibliotheque/${id}/sous-details/${sdId}/`);
      flash("Ressource supprimée.");
      setSuppSD(null);
      charger();
    } catch { setErreur("Impossible de supprimer."); }
  };

  const enregistrerLigne = async () => {
    setSauvegardeLigne(true);
    setErreur(null);
    try {
      await api.patch(`/api/bibliotheque/${id}/`, {
        code: formulaireLigne.code,
        famille: formulaireLigne.famille,
        sous_famille: formulaireLigne.sous_famille,
        designation_courte: formulaireLigne.designation_courte,
        designation_longue: formulaireLigne.designation_longue,
        unite: formulaireLigne.unite,
        source: formulaireLigne.source,
        fiabilite: Number(formulaireLigne.fiabilite || "3"),
        hypotheses: formulaireLigne.hypotheses,
        contexte_emploi: formulaireLigne.contexte_emploi,
        observations_techniques: formulaireLigne.observations_techniques,
        temps_main_oeuvre: formulaireLigne.temps_main_oeuvre ? Number(formulaireLigne.temps_main_oeuvre) : 0,
        cout_horaire_mo: formulaireLigne.cout_horaire_mo ? Number(formulaireLigne.cout_horaire_mo) : 0,
        cout_matieres: formulaireLigne.cout_matieres ? Number(formulaireLigne.cout_matieres) : 0,
        cout_materiel: formulaireLigne.cout_materiel ? Number(formulaireLigne.cout_materiel) : 0,
        cout_sous_traitance: formulaireLigne.cout_sous_traitance ? Number(formulaireLigne.cout_sous_traitance) : 0,
        cout_transport: formulaireLigne.cout_transport ? Number(formulaireLigne.cout_transport) : 0,
        cout_frais_divers: formulaireLigne.cout_frais_divers ? Number(formulaireLigne.cout_frais_divers) : 0,
        debourse_sec_unitaire: formulaireLigne.debourse_sec_unitaire ? Number(formulaireLigne.debourse_sec_unitaire) : 0,
        prix_vente_unitaire: formulaireLigne.prix_vente_unitaire ? Number(formulaireLigne.prix_vente_unitaire) : 0,
      });
      setEditionLigne(false);
      flash("Ligne mise à jour.");
      await charger();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Impossible d'enregistrer cette ligne.");
    } finally {
      setSauvegardeLigne(false);
    }
  };

  if (chargement) return <div className="py-20 text-center text-slate-400 text-sm">Chargement…</div>;
  if (!ligne) return (
    <div className="space-y-4">
      <Link href="/bibliotheque" className="flex items-center gap-2 text-slate-400 hover:text-slate-600 text-sm">
        <ArrowLeft className="w-4 h-4" />Retour
      </Link>
      <div className="py-20 text-center text-red-500">Ligne introuvable.</div>
    </div>
  );

  const fiabilitéEtoiles = Array.from({ length: 5 }, (_, i) => i < (ligne.fiabilite || 0));

  return (
    <div className="space-y-6">
      {/* Fil d'Ariane */}
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Link href="/bibliotheque" className="hover:text-slate-600">Bibliothèque de prix</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-slate-600 font-medium truncate">{ligne.designation_courte}</span>
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
            <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
              <BookOpen className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap mb-1">
                {ligne.code && (
                  <span className="font-mono text-sm font-bold text-primaire-700 bg-primaire-50 px-2.5 py-0.5 rounded">
                    {ligne.code}
                  </span>
                )}
                <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${
                  ligne.statut_validation === "valide" ? "badge-succes" : "badge-neutre"
                }`}>
                  {ligne.statut_libelle}
                </span>
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                  {ligne.niveau_libelle}
                </span>
              </div>
              <h1 className="text-xl font-bold text-slate-800">{ligne.designation_courte}</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                {[ligne.famille, ligne.sous_famille].filter(Boolean).join(" › ")} — {ligne.unite}
              </p>
              <div className="flex items-center gap-1 mt-1.5">
                {fiabilitéEtoiles.map((pleine, i) => (
                  <Star key={i} className={`w-3.5 h-3.5 ${pleine ? "text-amber-400 fill-amber-400" : "text-slate-300"}`} />
                ))}
                {ligne.source && <span className="text-xs text-slate-400 ml-1">— {ligne.source}</span>}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => setEditionLigne((precedent) => !precedent)} className="btn-secondaire">
              <Pencil className="w-4 h-4" />
              {editionLigne ? "Fermer l’édition" : "Modifier"}
            </button>
            {ligne.sous_details.length > 0 && (
              <button onClick={lancerRecalcul} disabled={recalcul} className="btn-secondaire disabled:opacity-60">
                {recalcul ? <><RefreshCw className="w-4 h-4 animate-spin" />Calcul…</> : <><RefreshCw className="w-4 h-4" />Recalculer</>}
              </button>
            )}
            {ligne.statut_validation !== "valide" && (
              <button onClick={valider} className="btn-primaire">
                <CheckCircle className="w-4 h-4" />Valider
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Colonne gauche : informations */}
        <div className="lg:col-span-2 space-y-6">
          {editionLigne && (
            <div className="carte p-6 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold text-slate-800 text-sm uppercase tracking-wider">Édition de la ligne</h3>
                <button onClick={enregistrerLigne} disabled={sauvegardeLigne} className="btn-primaire">
                  <Save className="w-4 h-4" />
                  {sauvegardeLigne ? "Enregistrement…" : "Enregistrer"}
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="libelle-champ">Code</label>
                  <input className="champ-saisie w-full font-mono" value={formulaireLigne.code} onChange={(e) => majFormulaireLigne("code", e.target.value)} />
                </div>
                <div>
                  <label className="libelle-champ">Unité</label>
                  <input className="champ-saisie w-full" value={formulaireLigne.unite} onChange={(e) => majFormulaireLigne("unite", e.target.value)} />
                </div>
                <div>
                  <label className="libelle-champ">Famille</label>
                  <input className="champ-saisie w-full" value={formulaireLigne.famille} onChange={(e) => majFormulaireLigne("famille", e.target.value)} />
                </div>
                <div>
                  <label className="libelle-champ">Sous-famille</label>
                  <input className="champ-saisie w-full" value={formulaireLigne.sous_famille} onChange={(e) => majFormulaireLigne("sous_famille", e.target.value)} />
                </div>
              </div>

              <div>
                <label className="libelle-champ">Désignation courte</label>
                <input className="champ-saisie w-full" value={formulaireLigne.designation_courte} onChange={(e) => majFormulaireLigne("designation_courte", e.target.value)} />
              </div>
              <div>
                <label className="libelle-champ">Désignation longue</label>
                <textarea rows={3} className="champ-saisie w-full" value={formulaireLigne.designation_longue} onChange={(e) => majFormulaireLigne("designation_longue", e.target.value)} />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="libelle-champ">Source</label>
                  <input className="champ-saisie w-full" value={formulaireLigne.source} onChange={(e) => majFormulaireLigne("source", e.target.value)} />
                </div>
                <div>
                  <label className="libelle-champ">Fiabilité</label>
                  <select className="champ-saisie w-full" value={formulaireLigne.fiabilite} onChange={(e) => majFormulaireLigne("fiabilite", e.target.value)}>
                    {[1, 2, 3, 4, 5].map((valeur) => (
                      <option key={valeur} value={valeur}>{valeur}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="libelle-champ">Hypothèses</label>
                  <textarea rows={3} className="champ-saisie w-full" value={formulaireLigne.hypotheses} onChange={(e) => majFormulaireLigne("hypotheses", e.target.value)} />
                </div>
                <div>
                  <label className="libelle-champ">Contexte d’emploi</label>
                  <textarea rows={3} className="champ-saisie w-full" value={formulaireLigne.contexte_emploi} onChange={(e) => majFormulaireLigne("contexte_emploi", e.target.value)} />
                </div>
              </div>

              <div>
                <label className="libelle-champ">Observations techniques</label>
                <textarea rows={3} className="champ-saisie w-full" value={formulaireLigne.observations_techniques} onChange={(e) => majFormulaireLigne("observations_techniques", e.target.value)} />
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div>
                  <label className="libelle-champ">Temps MO</label>
                  <input type="number" step="0.0001" className="champ-saisie w-full" value={formulaireLigne.temps_main_oeuvre} onChange={(e) => majFormulaireLigne("temps_main_oeuvre", e.target.value)} />
                </div>
                <div>
                  <label className="libelle-champ">Coût horaire MO</label>
                  <input type="number" step="0.0001" className="champ-saisie w-full" value={formulaireLigne.cout_horaire_mo} onChange={(e) => majFormulaireLigne("cout_horaire_mo", e.target.value)} />
                </div>
                <div>
                  <label className="libelle-champ">Matières</label>
                  <input type="number" step="0.0001" className="champ-saisie w-full" value={formulaireLigne.cout_matieres} onChange={(e) => majFormulaireLigne("cout_matieres", e.target.value)} />
                </div>
                <div>
                  <label className="libelle-champ">Matériel</label>
                  <input type="number" step="0.0001" className="champ-saisie w-full" value={formulaireLigne.cout_materiel} onChange={(e) => majFormulaireLigne("cout_materiel", e.target.value)} />
                </div>
                <div>
                  <label className="libelle-champ">Sous-traitance</label>
                  <input type="number" step="0.0001" className="champ-saisie w-full" value={formulaireLigne.cout_sous_traitance} onChange={(e) => majFormulaireLigne("cout_sous_traitance", e.target.value)} />
                </div>
                <div>
                  <label className="libelle-champ">Transport</label>
                  <input type="number" step="0.0001" className="champ-saisie w-full" value={formulaireLigne.cout_transport} onChange={(e) => majFormulaireLigne("cout_transport", e.target.value)} />
                </div>
                <div>
                  <label className="libelle-champ">Frais divers</label>
                  <input type="number" step="0.0001" className="champ-saisie w-full" value={formulaireLigne.cout_frais_divers} onChange={(e) => majFormulaireLigne("cout_frais_divers", e.target.value)} />
                </div>
                <div>
                  <label className="libelle-champ">DS unitaire</label>
                  <input type="number" step="0.0001" className="champ-saisie w-full" value={formulaireLigne.debourse_sec_unitaire} onChange={(e) => majFormulaireLigne("debourse_sec_unitaire", e.target.value)} />
                </div>
              </div>

              <div>
                <label className="libelle-champ">Prix de vente unitaire</label>
                <input type="number" step="0.0001" className="champ-saisie w-full md:max-w-xs" value={formulaireLigne.prix_vente_unitaire} onChange={(e) => majFormulaireLigne("prix_vente_unitaire", e.target.value)} />
              </div>
            </div>
          )}

          {/* Description */}
          {(ligne.designation_longue || ligne.hypotheses || ligne.contexte_emploi || ligne.observations_techniques) && (
            <div className="carte p-6 space-y-4">
              <h3 className="font-semibold text-slate-800 text-sm uppercase tracking-wider">Description</h3>
              {ligne.designation_longue && (
                <p className="text-sm text-slate-600 leading-relaxed">{ligne.designation_longue}</p>
              )}
              {ligne.hypotheses && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Hypothèses</p>
                  <p className="text-sm text-slate-600">{ligne.hypotheses}</p>
                </div>
              )}
              {ligne.contexte_emploi && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Contexte d&apos;emploi</p>
                  <p className="text-sm text-slate-600">{ligne.contexte_emploi}</p>
                </div>
              )}
              {ligne.observations_techniques && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Observations techniques</p>
                  <p className="text-sm text-slate-600">{ligne.observations_techniques}</p>
                </div>
              )}
            </div>
          )}

          {/* Sous-détails analytiques */}
          <div className="carte p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800 text-sm uppercase tracking-wider">
                Sous-détail analytique
              </h3>
              <button onClick={() => setAjoutSD(true)} className="btn-secondaire text-xs">
                <Plus className="w-3.5 h-3.5" />Ajouter
              </button>
            </div>

            {ligne.sous_details.length === 0 ? (
              <p className="text-sm text-slate-400 py-4 text-center">Aucun sous-détail analytique.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs text-slate-500">
                    <th className="text-left py-2 pr-3 font-medium">Type</th>
                    <th className="text-left py-2 pr-3 font-medium">Désignation</th>
                    <th className="text-right py-2 pr-3 font-medium">Qté</th>
                    <th className="text-center py-2 pr-3 font-medium">U.</th>
                    <th className="text-right py-2 pr-3 font-medium">PU HT</th>
                    <th className="text-right py-2 pr-3 font-medium">Montant HT</th>
                    <th className="py-2 w-16"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {ligne.sous_details.map(sd => (
                    <tr key={sd.id} className="group hover:bg-slate-50">
                      <td className="py-2 pr-3">
                        <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                          {TYPES_RESSOURCE[sd.type_ressource] ?? sd.type_ressource}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-slate-700">
                        <p>{sd.designation}</p>
                        {sd.type_ressource === "mo" && sd.profil_main_oeuvre_libelle && (
                          <p className="mt-0.5 text-xs text-primaire-700">
                            {sd.profil_main_oeuvre_libelle}
                            {sd.nombre_ressources && sd.temps_unitaire
                              ? ` · ${Number(sd.nombre_ressources).toLocaleString("fr-FR")} × ${Number(sd.temps_unitaire).toLocaleString("fr-FR")} h`
                              : ""}
                          </p>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-right font-mono text-xs">
                        {Number(sd.quantite).toLocaleString("fr-FR")}
                      </td>
                      <td className="py-2 pr-3 text-center text-xs text-slate-500">{sd.unite}</td>
                      <td className="py-2 pr-3 text-right font-mono text-xs text-slate-600">
                        {fmt(sd.cout_unitaire_ht)}
                      </td>
                      <td className="py-2 pr-3 text-right font-mono text-xs font-semibold text-primaire-700">
                        {fmt(sd.montant_ht)}
                      </td>
                      <td className="py-2">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {suppSD === sd.id ? (
                            <>
                              <button onClick={() => supprimerSD(sd.id)}
                                className="text-xs text-red-600 font-medium px-1.5 py-0.5 rounded hover:bg-red-50">
                                Suppr.
                              </button>
                              <button onClick={() => setSuppSD(null)}
                                className="p-1 rounded hover:bg-slate-100">
                                <X className="w-3 h-3 text-slate-400" />
                              </button>
                            </>
                          ) : (
                            <button onClick={() => setSuppSD(sd.id)}
                              className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200">
                    <td colSpan={5} className="py-2 text-right text-xs font-semibold text-slate-600 pr-3">
                      Total déboursé sec
                    </td>
                    <td className="py-2 pr-3 text-right font-mono text-sm font-bold text-primaire-700">
                      {fmt(ligne.sous_details.reduce((s, sd) => s + Number(sd.montant_ht || 0), 0))}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </div>

        {/* Colonne droite : prix */}
        <div className="space-y-4">
          <div className="carte p-6">
            <h3 className="font-semibold text-slate-800 text-sm uppercase tracking-wider mb-4">Prix unitaires</h3>
            <dl className="space-y-3">
              {ligne.temps_main_oeuvre != null && (
                <div className="flex justify-between">
                  <dt className="text-xs text-slate-400">Temps MO</dt>
                  <dd className="font-mono text-sm text-slate-700">{Number(ligne.temps_main_oeuvre).toFixed(3)} h</dd>
                </div>
              )}
              {ligne.cout_horaire_mo != null && (
                <div className="flex justify-between">
                  <dt className="text-xs text-slate-400">Coût horaire MO</dt>
                  <dd className="font-mono text-sm text-slate-700">{fmt(ligne.cout_horaire_mo)}/h</dd>
                </div>
              )}
              {[
                { label: "Main-d'œuvre", val: ligne.total_mo > 0 ? ligne.total_mo : (ligne.temps_main_oeuvre && ligne.cout_horaire_mo ? ligne.temps_main_oeuvre * ligne.cout_horaire_mo : null) },
                { label: "Matières", val: ligne.cout_matieres },
                { label: "Matériel", val: ligne.cout_materiel },
                { label: "Sous-traitance", val: ligne.cout_sous_traitance },
                { label: "Transport", val: ligne.cout_transport },
              ].filter(r => r.val != null && Number(r.val) > 0).map(({ label, val }) => (
                <div key={label} className="flex justify-between">
                  <dt className="text-xs text-slate-400">{label}</dt>
                  <dd className="font-mono text-sm text-slate-700">{fmt(val as number)}</dd>
                </div>
              ))}
              <div className="pt-3 border-t border-slate-100 flex justify-between">
                <dt className="text-sm font-semibold text-slate-700">Déboursé sec HT</dt>
                <dd className="font-mono text-base font-bold text-slate-800">{fmt(ligne.debourse_sec_unitaire)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm font-semibold text-slate-700">Prix de vente HT</dt>
                <dd className="font-mono text-base font-bold text-primaire-700">{fmt(ligne.prix_vente_unitaire)}</dd>
              </div>
              {ligne.debourse_sec_unitaire && ligne.prix_vente_unitaire && ligne.debourse_sec_unitaire > 0 && (
                <div className="flex justify-between pt-2 border-t border-slate-100">
                  <dt className="text-xs text-slate-400">Coefficient</dt>
                  <dd className="font-mono text-sm text-slate-600">
                    {(ligne.prix_vente_unitaire / ligne.debourse_sec_unitaire).toFixed(3)}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          <div className="carte p-6">
            <h3 className="font-semibold text-slate-800 text-sm uppercase tracking-wider mb-3">Informations</h3>
            <dl className="space-y-2">
              {[
                { label: "Unité", val: ligne.unite },
                { label: "Famille", val: ligne.famille },
                { label: "Sous-famille", val: ligne.sous_famille },
                { label: "Corps d'état", val: ligne.corps_etat },
                { label: "Auteur", val: ligne.auteur_nom },
                { label: "Source", val: ligne.source },
                { label: "Modifié le", val: new Date(ligne.date_modification).toLocaleDateString("fr-FR") },
              ].filter(r => r.val).map(({ label, val }) => (
                <div key={label} className="flex justify-between gap-2">
                  <dt className="text-xs text-slate-400 shrink-0">{label}</dt>
                  <dd className="text-xs text-slate-700 text-right">{val}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>

      {/* Modal ajout sous-détail */}
      {ajoutSD && (
        <ModalSousDetail
          ligneId={id}
          onClose={() => setAjoutSD(false)}
          onSuccess={() => { flash("Ressource ajoutée."); charger(); setAjoutSD(false); }}
        />
      )}
    </div>
  );
}

function ModalSousDetail({ ligneId, onClose, onSuccess }: {
  ligneId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    type_ressource: "mo",
    profil_main_oeuvre: "",
    designation: "",
    unite: "h",
    quantite: "",
    nombre_ressources: "1",
    temps_unitaire: "0",
    cout_unitaire_ht: "",
    taux_horaire: "",
  });
  const [profils, setProfils] = useState<ProfilMainOeuvreOption[]>([]);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const maj = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }));
  const quantiteCalculee = Number(form.nombre_ressources || 0) * Number(form.temps_unitaire || 0);

  useEffect(() => {
    let actif = true;
    api
      .get<ProfilMainOeuvreOption[] | { results: ProfilMainOeuvreOption[] }>("/api/economie/profils-main-oeuvre/?actifs=1")
      .then((reponse) => {
        if (actif) {
          const liste = Array.isArray(reponse) ? reponse : Array.isArray(reponse.results) ? reponse.results : [];
          setProfils(liste);
        }
      })
      .catch(() => {
        if (actif) {
          setProfils([]);
        }
      });
    return () => {
      actif = false;
    };
  }, []);

  const changerProfil = (profilId: string) => {
    maj("profil_main_oeuvre", profilId);
    const profil = profils.find((item) => item.id === profilId);
    if (!profil) return;
    maj("designation", profil.libelle);
    maj("taux_horaire", profil.taux_horaire_recommande_defaut != null ? String(profil.taux_horaire_recommande_defaut) : "");
  };

  const soumettre = async () => {
    if (!form.designation.trim()) { setErreur("La désignation est requise."); return; }
    setChargement(true);
    try {
      await api.post(`/api/bibliotheque/${ligneId}/sous-details/`, {
        ligne_prix: ligneId,
        type_ressource: form.type_ressource,
        profil_main_oeuvre: form.type_ressource === "mo" && form.profil_main_oeuvre ? form.profil_main_oeuvre : null,
        designation: form.designation,
        unite: form.type_ressource === "mo" ? "h" : form.unite,
        quantite: form.type_ressource === "mo" ? quantiteCalculee : Number(form.quantite) || 0,
        nombre_ressources: form.type_ressource === "mo" ? Number(form.nombre_ressources) || 1 : 1,
        temps_unitaire: form.type_ressource === "mo" ? Number(form.temps_unitaire) || 0 : 0,
        taux_horaire: form.type_ressource === "mo" ? Number(form.taux_horaire) || 0 : 0,
        cout_unitaire_ht: form.type_ressource === "mo" ? Number(form.taux_horaire) || 0 : Number(form.cout_unitaire_ht) || 0,
      });
      onSuccess();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Erreur.");
    } finally {
      setChargement(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-800">Ajouter une ressource</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="p-6 space-y-4">
          {erreur && <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm"><AlertCircle className="w-4 h-4 shrink-0" />{erreur}</div>}
          <div>
            <label className="libelle-champ">Type</label>
            <select className="champ-saisie w-full bg-white" value={form.type_ressource}
              onChange={e => maj("type_ressource", e.target.value)}>
              {Object.entries({
                mo: "Main-d'œuvre", matiere: "Matière", materiel: "Matériel",
                sous_traitance: "Sous-traitance", transport: "Transport", frais_divers: "Frais divers",
              }).map(([val, lib]) => <option key={val} value={val}>{lib}</option>)}
            </select>
          </div>
          <div>
            <label className="libelle-champ">Désignation <span className="text-red-500">*</span></label>
            <input type="text" className="champ-saisie w-full"
              value={form.designation} onChange={e => maj("designation", e.target.value)} />
          </div>
          {form.type_ressource === "mo" ? (
            <>
              <div>
                <label className="libelle-champ">Profil de main-d’œuvre</label>
                <select className="champ-saisie w-full bg-white" value={form.profil_main_oeuvre}
                  onChange={e => changerProfil(e.target.value)}>
                  <option value="">Saisie libre</option>
                  {profils.map((profil) => (
                    <option key={profil.id} value={profil.id}>
                      {profil.libelle}
                      {profil.niveau_classification ? ` — ${profil.niveau_classification}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="libelle-champ">Effectif</label>
                  <input type="number" step="0.001" className="champ-saisie w-full text-right"
                    value={form.nombre_ressources} onChange={e => maj("nombre_ressources", e.target.value)} />
                </div>
                <div>
                  <label className="libelle-champ">Temps unitaire (h)</label>
                  <input type="number" step="0.001" className="champ-saisie w-full text-right"
                    value={form.temps_unitaire} onChange={e => maj("temps_unitaire", e.target.value)} />
                </div>
                <div>
                  <label className="libelle-champ">Taux horaire (€)</label>
                  <input type="number" step="0.0001" className="champ-saisie w-full text-right"
                    value={form.taux_horaire} onChange={e => maj("taux_horaire", e.target.value)} />
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs text-slate-500 mb-1">Temps total calculé</p>
                <p className="font-mono text-lg font-semibold text-slate-800">
                  {Number.isFinite(quantiteCalculee) ? quantiteCalculee.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 3 }) : "0"} h
                </p>
              </div>
            </>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="libelle-champ">Quantité</label>
                <input type="number" step="0.001" className="champ-saisie w-full text-right"
                  value={form.quantite} onChange={e => maj("quantite", e.target.value)} />
              </div>
              <div>
                <label className="libelle-champ">Unité</label>
                <input type="text" className="champ-saisie w-full"
                  value={form.unite} onChange={e => maj("unite", e.target.value)} />
              </div>
              <div>
                <label className="libelle-champ">PU HT (€)</label>
                <input type="number" step="0.01" className="champ-saisie w-full text-right"
                  value={form.cout_unitaire_ht} onChange={e => maj("cout_unitaire_ht", e.target.value)} />
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
          <button onClick={onClose} className="btn-secondaire">Annuler</button>
          <button onClick={soumettre} disabled={chargement} className="btn-primaire disabled:opacity-60">
            {chargement ? "Ajout…" : <><Save className="w-4 h-4" />Ajouter</>}
          </button>
        </div>
      </div>
    </div>
  );
}
