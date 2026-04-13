"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ErreurApi, telechargerFichierApi } from "@/crochets/useApi";
import {
  ArrowLeft, ArrowRight, CheckCircle, AlertCircle, ChevronDown, ChevronRight,
  Download, FileText, Loader2, X,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Prescription {
  id: string;
  code: string;
  intitule: string;
  corps: string;
  exclue: boolean;
  corpsPersonnalise: string;
}

interface ChapitreAvecPrescriptions {
  id: string;
  code: string;
  intitule: string;
  prescriptions: Prescription[];
  ouvert: boolean;
}

interface LotCCTP {
  id: string;
  numero: string;
  intitule: string;
  nombre_prescriptions: number;
  chapitres?: ChapitreAvecPrescriptions[];
}

interface VariablesFusion {
  intitule: string;
  date_redaction: string;
  phase: string;
}

type Etape = 1 | 2 | 3 | 4;

const PHASES = ["ESQ", "APS", "APD", "PRO", "DCE", "ACT", "EXE", "REC"];

// ---------------------------------------------------------------------------
// Composant principal
// ---------------------------------------------------------------------------

export default function PageNouveauCCTP({ params }: { params: Promise<{ id: string }> }) {
  const { id: projetId } = use(params);
  const router = useRouter();

  const [etape, setEtape] = useState<Etape>(1);
  const [lots, setLots] = useState<LotCCTP[]>([]);
  const [lotsSelectionnes, setLotsSelectionnes] = useState<Set<string>>(new Set());
  const [lotsDetails, setLotsDetails] = useState<Map<string, ChapitreAvecPrescriptions[]>>(new Map());
  const [variables, setVariables] = useState<VariablesFusion>({
    intitule: "",
    date_redaction: new Date().toISOString().slice(0, 10),
    phase: "DCE",
  });
  const [prescriptionsExclues, setPrescriptionsExclues] = useState<Set<string>>(new Set());
  const [prescriptionsPersonnalisees, setPrescriptionsPersonnalisees] = useState<Map<string, string>>(new Map());
  const [chargementLots, setChargementLots] = useState(true);
  const [chargementDetails, setChargementDetails] = useState(false);
  const [generation, setGeneration] = useState(false);
  const [lienTelechargement, setLienTelechargement] = useState<string | null>(null);
  const [nomFichierGenere, setNomFichierGenere] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  // Charger la liste des lots
  useEffect(() => {
    void (async () => {
      try {
        const reponse = await api.get<LotCCTP[] | { results: LotCCTP[] }>("/api/pieces-ecrites/lots/");
        const liste = Array.isArray(reponse) ? reponse : reponse.results ?? [];
        setLots(liste);
      } catch (e) {
        setErreur(e instanceof ErreurApi ? e.detail : "Impossible de charger les lots CCTP.");
      } finally {
        setChargementLots(false);
      }
    })();
  }, []);

  // Charger les détails (chapitres/prescriptions) pour les lots sélectionnés
  const chargerDetailsLots = async (idsLots: Set<string>) => {
    const nouveauxIds = [...idsLots].filter((id) => !lotsDetails.has(id));
    if (nouveauxIds.length === 0) return;

    setChargementDetails(true);
    try {
      await Promise.all(
        nouveauxIds.map(async (id) => {
          try {
            const reponse = await api.get<{ chapitres: ChapitreAvecPrescriptions[] }>(
              `/api/pieces-ecrites/lots/${id}/prescriptions/`
            );
            const chapitres = (reponse.chapitres || []).map((ch) => ({
              ...ch,
              ouvert: true,
              prescriptions: (ch.prescriptions || []).map((p) => ({
                ...p,
                exclue: false,
                corpsPersonnalise: "",
              })),
            }));
            setLotsDetails((prev) => new Map(prev).set(id, chapitres));
          } catch {
            // Lot sans prescriptions disponibles — on ignore
          }
        })
      );
    } finally {
      setChargementDetails(false);
    }
  };

  const toggleLot = (id: string) => {
    setLotsSelectionnes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const togglePrescription = (prescriptionId: string) => {
    setPrescriptionsExclues((prev) => {
      const next = new Set(prev);
      if (next.has(prescriptionId)) {
        next.delete(prescriptionId);
      } else {
        next.add(prescriptionId);
      }
      return next;
    });
  };

  const toggleChapitre = (lotId: string, chapitreId: string) => {
    setLotsDetails((prev) => {
      const copie = new Map(prev);
      const chapitres = copie.get(lotId);
      if (!chapitres) return prev;
      copie.set(
        lotId,
        chapitres.map((ch) => (ch.id === chapitreId ? { ...ch, ouvert: !ch.ouvert } : ch))
      );
      return copie;
    });
  };

  const modifierCorpsPrescription = (prescriptionId: string, valeur: string) => {
    setPrescriptionsPersonnalisees((prev) => {
      const copie = new Map(prev);
      if (valeur.trim()) {
        copie.set(prescriptionId, valeur);
      } else {
        copie.delete(prescriptionId);
      }
      return copie;
    });
  };

  const allerEtape2 = async () => {
    if (lotsSelectionnes.size === 0) {
      setErreur("Sélectionnez au moins un lot.");
      return;
    }
    setErreur(null);
    await chargerDetailsLots(lotsSelectionnes);
    setEtape(2);
  };

  const genererCCTP = async () => {
    if (!variables.intitule.trim()) {
      setErreur("L'intitulé du CCTP est requis.");
      return;
    }
    setGeneration(true);
    setErreur(null);
    setLienTelechargement(null);

    try {
      const payload = {
        projet_id: projetId,
        intitule: variables.intitule.trim(),
        date_redaction: variables.date_redaction,
        phase: variables.phase,
        lots: [...lotsSelectionnes],
        prescriptions_exclues: [...prescriptionsExclues],
        prescriptions_personnalisees: Object.fromEntries(prescriptionsPersonnalisees),
        variables: {
          intitule: variables.intitule,
          date_redaction: variables.date_redaction,
          phase: variables.phase,
        },
      };

      const reponse = await telechargerFichierApi("/api/pieces-ecrites/generer-cctp/", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
      });

      const url = window.URL.createObjectURL(reponse.blob);
      setLienTelechargement(url);
      setNomFichierGenere(reponse.nomFichier || `CCTP_${variables.phase}_${projetId}.docx`);
      setEtape(4);
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Impossible de générer le CCTP.");
    } finally {
      setGeneration(false);
    }
  };

  const telecharger = () => {
    if (!lienTelechargement) return;
    const lien = document.createElement("a");
    lien.href = lienTelechargement;
    lien.download = nomFichierGenere || "CCTP.docx";
    document.body.appendChild(lien);
    lien.click();
    lien.remove();
  };

  // Calcul du plan synthétique
  const planCCTP: string[] = [];
  for (const lotId of lotsSelectionnes) {
    const lot = lots.find((l) => l.id === lotId);
    if (!lot) continue;
    planCCTP.push(`Lot ${lot.numero} — ${lot.intitule}`);
    const chapitres = lotsDetails.get(lotId) || [];
    for (const ch of chapitres) {
      planCCTP.push(`  ${ch.code} ${ch.intitule}`);
    }
  }

  const ETAPES = [
    { num: 1, libelle: "Sélection des lots" },
    { num: 2, libelle: "Personnalisation" },
    { num: 3, libelle: "Variables" },
    { num: 4, libelle: "Génération" },
  ];

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div>
        <Link
          href={`/projets/${projetId}/pieces-ecrites`}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-2"
        >
          <ArrowLeft size={14} /> Pièces écrites
        </Link>
        <h1>Générateur CCTP multi-lots</h1>
        <p className="text-slate-500 mt-1 text-sm">
          Sélectionnez les lots, personnalisez les prescriptions et générez le CCTP en Word.
        </p>
      </div>

      {erreur && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm p-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {erreur}
          <button onClick={() => setErreur(null)} className="ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Indicateur d'étapes */}
      <div className="flex items-center gap-2">
        {ETAPES.map((e, index) => (
          <div key={e.num} className="flex items-center gap-2">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                etape === e.num
                  ? "bg-primaire-600 text-white"
                  : etape > e.num
                    ? "bg-green-500 text-white"
                    : "bg-slate-200 text-slate-500"
              }`}
            >
              {etape > e.num ? <CheckCircle className="h-4 w-4" /> : e.num}
            </div>
            <span className={`text-sm font-medium ${etape === e.num ? "text-primaire-700" : "text-slate-400"}`}>
              {e.libelle}
            </span>
            {index < ETAPES.length - 1 && <ChevronRight className="h-4 w-4 text-slate-300" />}
          </div>
        ))}
      </div>

      {/* ÉTAPE 1 — Sélection des lots */}
      {etape === 1 && (
        <div className="carte p-6 space-y-5">
          <div>
            <h2 className="text-base font-semibold text-slate-800">Sélection des lots</h2>
            <p className="text-sm text-slate-500 mt-1">
              Cochez les lots à inclure dans le CCTP. {lotsSelectionnes.size} lot(s) sélectionné(s).
            </p>
          </div>

          {chargementLots ? (
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Chargement des lots…
            </div>
          ) : lots.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500 text-center">
              Aucun lot disponible dans la bibliothèque CCTP.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {lots.map((lot) => {
                const selectionne = lotsSelectionnes.has(lot.id);
                return (
                  <label
                    key={lot.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${
                      selectionne
                        ? "border-primaire-200 bg-primaire-50"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectionne}
                      onChange={() => toggleLot(lot.id)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primaire-600 focus:ring-primaire-500"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-primaire-600 bg-primaire-50 rounded px-1.5 py-0.5">
                          {lot.numero}
                        </span>
                      </div>
                      <p className="mt-1 font-medium text-slate-800 text-sm">{lot.intitule}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {lot.nombre_prescriptions} prescription(s)
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={allerEtape2}
              disabled={lotsSelectionnes.size === 0}
              className="btn-primaire disabled:opacity-60"
            >
              Suivant <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ÉTAPE 2 — Personnalisation */}
      {etape === 2 && (
        <div className="space-y-5">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="carte p-6 space-y-5">
              <div>
                <h2 className="text-base font-semibold text-slate-800">Personnalisation des prescriptions</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Décochez les prescriptions à exclure ou modifiez leur contenu.
                </p>
              </div>

              {chargementDetails ? (
                <div className="flex items-center gap-2 text-slate-400 text-sm py-6">
                  <Loader2 className="h-4 w-4 animate-spin" /> Chargement des prescriptions…
                </div>
              ) : (
                <div className="space-y-4">
                  {[...lotsSelectionnes].map((lotId) => {
                    const lot = lots.find((l) => l.id === lotId);
                    const chapitres = lotsDetails.get(lotId) || [];
                    return (
                      <div key={lotId} className="rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden">
                        <div className="flex items-center gap-3 bg-slate-100 px-4 py-3">
                          <FileText className="h-4 w-4 text-primaire-600" />
                          <p className="font-semibold text-slate-800">
                            Lot {lot?.numero} — {lot?.intitule}
                          </p>
                        </div>
                        <div className="divide-y divide-slate-200">
                          {chapitres.map((ch) => (
                            <div key={ch.id}>
                              <button
                                type="button"
                                onClick={() => toggleChapitre(lotId, ch.id)}
                                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-100"
                              >
                                {ch.ouvert
                                  ? <ChevronDown className="h-4 w-4 text-slate-400" />
                                  : <ChevronRight className="h-4 w-4 text-slate-400" />
                                }
                                <span className="font-mono text-xs text-primaire-600 mr-1">{ch.code}</span>
                                {ch.intitule}
                                <span className="ml-auto text-xs text-slate-400">
                                  {ch.prescriptions.filter((p) => !prescriptionsExclues.has(p.id)).length}/{ch.prescriptions.length}
                                </span>
                              </button>
                              {ch.ouvert && (
                                <div className="divide-y divide-slate-100 bg-white">
                                  {ch.prescriptions.map((p) => {
                                    const exclue = prescriptionsExclues.has(p.id);
                                    const personnalise = prescriptionsPersonnalisees.get(p.id) || "";
                                    return (
                                      <div key={p.id} className={`px-4 py-3 ${exclue ? "opacity-50" : ""}`}>
                                        <div className="flex items-start gap-3">
                                          <input
                                            type="checkbox"
                                            checked={!exclue}
                                            onChange={() => togglePrescription(p.id)}
                                            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primaire-600"
                                          />
                                          <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-slate-800">{p.intitule}</p>
                                            {!exclue && (
                                              <div className="mt-2">
                                                <label className="text-xs text-slate-400">
                                                  Corps personnalisé (laissez vide pour utiliser la prescription par défaut)
                                                </label>
                                                <textarea
                                                  className="champ-saisie mt-1 w-full min-h-[80px] text-sm font-mono"
                                                  placeholder={p.corps || "Prescription par défaut de la bibliothèque"}
                                                  value={personnalise}
                                                  onChange={(e) => modifierCorpsPrescription(p.id, e.target.value)}
                                                />
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          ))}
                          {chapitres.length === 0 && (
                            <p className="px-4 py-3 text-sm text-slate-400">
                              Aucune prescription disponible pour ce lot.
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Aperçu du plan */}
            <div className="carte p-4 space-y-3 xl:sticky xl:top-24 self-start">
              <p className="text-sm font-semibold text-slate-800">Plan synthétique du CCTP</p>
              {planCCTP.length === 0 ? (
                <p className="text-sm text-slate-400">Sélectionnez des lots pour voir le plan.</p>
              ) : (
                <div className="max-h-96 overflow-y-auto space-y-1 text-xs">
                  {planCCTP.map((ligne, index) => (
                    <p
                      key={index}
                      className={ligne.startsWith("  ") ? "text-slate-500 pl-4" : "font-semibold text-slate-800 mt-2"}
                    >
                      {ligne.trim()}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-between">
            <button type="button" onClick={() => setEtape(1)} className="btn-secondaire">
              <ArrowLeft className="w-4 h-4" /> Précédent
            </button>
            <button type="button" onClick={() => { setErreur(null); setEtape(3); }} className="btn-primaire">
              Suivant <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ÉTAPE 3 — Variables de fusion */}
      {etape === 3 && (
        <div className="carte p-6 space-y-5">
          <div>
            <h2 className="text-base font-semibold text-slate-800">Variables de fusion</h2>
            <p className="text-sm text-slate-500 mt-1">
              Ces valeurs seront substituées dans les prescriptions qui les contiennent.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="libelle-champ" htmlFor="intitule-cctp">
                Intitulé du CCTP <span className="text-red-500">*</span>
              </label>
              <input
                id="intitule-cctp"
                type="text"
                className="champ-saisie w-full"
                placeholder="CCTP — Réhabilitation du groupe scolaire — Lots TCE"
                value={variables.intitule}
                onChange={(e) => setVariables((prev) => ({ ...prev, intitule: e.target.value }))}
              />
            </div>
            <div>
              <label className="libelle-champ" htmlFor="date-redaction">
                Date de rédaction
              </label>
              <input
                id="date-redaction"
                type="date"
                className="champ-saisie w-full"
                value={variables.date_redaction}
                onChange={(e) => setVariables((prev) => ({ ...prev, date_redaction: e.target.value }))}
              />
            </div>
            <div>
              <label className="libelle-champ" htmlFor="phase">
                Phase
              </label>
              <select
                id="phase"
                className="champ-saisie w-full"
                value={variables.phase}
                onChange={(e) => setVariables((prev) => ({ ...prev, phase: e.target.value }))}
              >
                {PHASES.map((ph) => (
                  <option key={ph} value={ph}>{ph}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Récapitulatif */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2">
            <p className="text-sm font-semibold text-slate-700">Récapitulatif</p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-slate-400">Lots sélectionnés</span>
                <p className="font-medium text-slate-800">{lotsSelectionnes.size}</p>
              </div>
              <div>
                <span className="text-slate-400">Prescriptions exclues</span>
                <p className="font-medium text-slate-800">{prescriptionsExclues.size}</p>
              </div>
              <div>
                <span className="text-slate-400">Corps personnalisés</span>
                <p className="font-medium text-slate-800">{prescriptionsPersonnalisees.size}</p>
              </div>
              <div>
                <span className="text-slate-400">Phase</span>
                <p className="font-medium text-slate-800">{variables.phase}</p>
              </div>
            </div>
          </div>

          <div className="flex justify-between">
            <button type="button" onClick={() => setEtape(2)} className="btn-secondaire">
              <ArrowLeft className="w-4 h-4" /> Précédent
            </button>
            <button
              type="button"
              onClick={genererCCTP}
              disabled={generation || !variables.intitule.trim()}
              className="btn-primaire disabled:opacity-60"
            >
              {generation
                ? <><Loader2 className="w-4 h-4 animate-spin" />Génération en cours…</>
                : <><FileText className="w-4 h-4" />Générer le CCTP Word</>
              }
            </button>
          </div>
        </div>
      )}

      {/* ÉTAPE 4 — Succès */}
      {etape === 4 && (
        <div className="carte p-8 text-center space-y-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">CCTP généré avec succès</h2>
            <p className="text-slate-500 mt-2 text-sm">
              Le fichier Word a été généré et est prêt au téléchargement.
              {nomFichierGenere && <><br /><span className="font-mono text-xs">{nomFichierGenere}</span></>}
            </p>
          </div>
          <div className="flex items-center justify-center gap-3">
            <button type="button" onClick={telecharger} className="btn-primaire">
              <Download className="w-4 h-4" /> Télécharger le CCTP
            </button>
            <Link href={`/projets/${projetId}/pieces-ecrites`} className="btn-secondaire">
              Retour aux pièces écrites
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
