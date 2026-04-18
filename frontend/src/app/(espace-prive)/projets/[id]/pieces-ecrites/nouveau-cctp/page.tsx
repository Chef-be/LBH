"use client";

import { useState, useEffect, use, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ErreurApi, telechargerFichierApi } from "@/crochets/useApi";
import {
  ArrowLeft, ArrowRight, CheckCircle, AlertCircle, ChevronDown, ChevronRight,
  Download, FileText, Loader2, X, Eye, Building2, Layers, Wrench, Zap,
  Trees, Check, RotateCcw,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Prescription {
  id: string;
  intitule: string;
  corps: string;
  niveau: string;
  normes: string[];
  exclue: boolean;
  corpsPersonnalise: string;
}

interface ChapitreAvecPrescriptions {
  numero: string;
  intitule: string;
  prescriptions: Prescription[];
  ouvert: boolean;
}

interface LotCCTP {
  id: string;
  code: string;
  intitule: string;
  description: string;
  nb_prescriptions: number;
  chapitres?: ChapitreAvecPrescriptions[];
}

interface ProjetData {
  intitule: string;
  commune?: string;
  departement?: string;
  phase_actuelle?: string;
  maitre_ouvrage?: { nom?: string; raison_sociale?: string };
  organisation?: { nom?: string; raison_sociale?: string };
}

interface VariablesFusion {
  intitule: string;
  date_redaction: string;
  phase: string;
  maitre_ouvrage: string;
  commune: string;
  departement: string;
  adresse_chantier: string;
  montant_estime: string;
  bureau_etudes: string;
}

interface ApercuPrescription {
  id: string;
  intitule: string;
  corps: string;
  normes: string[];
  niveau: string;
}
interface ApercuChapitre { numero: string; intitule: string; prescriptions: ApercuPrescription[] }
interface ApercuLot { code: string; intitule: string; chapitres: ApercuChapitre[] }

type Etape = 1 | 2 | 3 | 4 | 5;

const PHASES = ["ESQ", "APS", "APD", "PRO", "DCE", "ACT", "EXE", "REC"];

// Catégories de lots pour grouper l'affichage
const CATEGORIES_LOTS = [
  {
    id: "structure",
    libelle: "Structure et Gros Œuvre",
    icone: Building2,
    codes: ["GO", "MOB", "CHMET"],
  },
  {
    id: "enveloppe",
    libelle: "Enveloppe du bâtiment",
    icone: Layers,
    codes: ["CHCZ", "FAC", "MRC", "ETAN", "MENUEXT"],
  },
  {
    id: "second-oeuvre",
    libelle: "Second Œuvre",
    icone: Wrench,
    codes: ["MENUINT", "IPP", "RSC"],
  },
  {
    id: "fluides",
    libelle: "Fluides et Équipements",
    icone: Zap,
    codes: ["ELEC", "PLB", "CVC", "ASC"],
  },
  {
    id: "vrd",
    libelle: "VRD et Extérieur",
    icone: Trees,
    codes: ["VRD", "TERR", "PAY"],
  },
];

const NIVEAUX_COULEURS: Record<string, string> = {
  obligatoire: "bg-red-100 text-red-700",
  recommande: "bg-blue-100 text-blue-700",
  alternatif: "bg-yellow-100 text-yellow-700",
  optionnel: "bg-slate-100 text-slate-600",
};

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
    maitre_ouvrage: "",
    commune: "",
    departement: "",
    adresse_chantier: "",
    montant_estime: "",
    bureau_etudes: "LBH Économiste",
  });
  const [prescriptionsExclues, setPrescriptionsExclues] = useState<Set<string>>(new Set());
  const [prescriptionsPersonnalisees, setPrescriptionsPersonnalisees] = useState<Map<string, string>>(new Map());
  const [chargementLots, setChargementLots] = useState(true);
  const [chargementDetails, setChargementDetails] = useState(false);
  const [chargementApercu, setChargementApercu] = useState(false);
  const [generation, setGeneration] = useState(false);
  const [apercu, setApercu] = useState<ApercuLot[] | null>(null);
  const [lienTelechargement, setLienTelechargement] = useState<string | null>(null);
  const [nomFichierGenere, setNomFichierGenere] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  // Charger les données du projet pour pré-remplir les variables
  useEffect(() => {
    void (async () => {
      try {
        const projet = await api.get<ProjetData>(`/api/projets/${projetId}/`);
        setVariables((prev) => ({
          ...prev,
          intitule: prev.intitule || `CCTP — ${projet.intitule || ""}`,
          phase: projet.phase_actuelle || prev.phase,
          commune: prev.commune || projet.commune || "",
          departement: prev.departement || projet.departement || "",
          maitre_ouvrage:
            prev.maitre_ouvrage ||
            projet.maitre_ouvrage?.raison_sociale ||
            projet.maitre_ouvrage?.nom ||
            "",
        }));
      } catch {
        // Projet non chargeable — on continue sans pré-remplissage
      }
    })();
  }, [projetId]);

  // Charger la liste des lots
  useEffect(() => {
    void (async () => {
      try {
        const reponse = await api.get<LotCCTP[] | { results: LotCCTP[] }>("/api/pieces-ecrites/lots/");
        const liste = Array.isArray(reponse) ? reponse : (reponse as { results: LotCCTP[] }).results ?? [];
        setLots(liste);
      } catch (e) {
        setErreur(e instanceof ErreurApi ? e.detail : "Impossible de charger les lots CCTP.");
      } finally {
        setChargementLots(false);
      }
    })();
  }, []);

  // Charger les détails d'un lot quand il est sélectionné
  const chargerDetailsLots = useCallback(async (idsLots: Set<string>) => {
    const codesPourIds = [...idsLots].map((id) => {
      const lot = lots.find((l) => l.id === id);
      return lot ? lot.code : null;
    }).filter(Boolean) as string[];

    const nouveauxIds = [...idsLots].filter((id) => !lotsDetails.has(id));
    if (nouveauxIds.length === 0) return;

    setChargementDetails(true);
    try {
      await Promise.all(
        nouveauxIds.map(async (id) => {
          const lot = lots.find((l) => l.id === id);
          if (!lot) return;
          try {
            const reponse = await api.get<{ chapitres?: ChapitreAvecPrescriptions[] }>(
              `/api/pieces-ecrites/lots/${lot.code}/prescriptions/`
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
            setLotsDetails((prev) => new Map(prev).set(id, []));
          }
        })
      );
    } finally {
      setChargementDetails(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lots, lotsDetails]);

  const toggleLot = (id: string) => {
    setLotsSelectionnes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleCategorie = (codes: string[]) => {
    const idsCategorie = lots.filter((l) => codes.includes(l.code)).map((l) => l.id);
    const tousSelectionnes = idsCategorie.every((id) => lotsSelectionnes.has(id));
    setLotsSelectionnes((prev) => {
      const next = new Set(prev);
      if (tousSelectionnes) idsCategorie.forEach((id) => next.delete(id));
      else idsCategorie.forEach((id) => next.add(id));
      return next;
    });
  };

  const togglePrescription = (prescriptionId: string) => {
    setPrescriptionsExclues((prev) => {
      const next = new Set(prev);
      if (next.has(prescriptionId)) next.delete(prescriptionId);
      else next.add(prescriptionId);
      return next;
    });
  };

  const toggleChapitre = (lotId: string, chapitreNumero: string) => {
    setLotsDetails((prev) => {
      const copie = new Map(prev);
      const chapitres = copie.get(lotId);
      if (!chapitres) return prev;
      copie.set(
        lotId,
        chapitres.map((ch) => (ch.numero === chapitreNumero ? { ...ch, ouvert: !ch.ouvert } : ch))
      );
      return copie;
    });
  };

  const modifierCorpsPrescription = (prescriptionId: string, valeur: string) => {
    setPrescriptionsPersonnalisees((prev) => {
      const copie = new Map(prev);
      if (valeur.trim()) copie.set(prescriptionId, valeur);
      else copie.delete(prescriptionId);
      return copie;
    });
  };

  const allerEtape2 = async () => {
    if (lotsSelectionnes.size === 0) { setErreur("Sélectionnez au moins un lot."); return; }
    setErreur(null);
    await chargerDetailsLots(lotsSelectionnes);
    setEtape(2);
  };

  const chargerApercu = async () => {
    setChargementApercu(true);
    try {
      const payload = {
        lots: [...lotsSelectionnes].map((id) => lots.find((l) => l.id === id)?.code).filter(Boolean),
        prescriptions_exclues: [...prescriptionsExclues],
        variables: {
          intitule: variables.intitule,
          date_redaction: variables.date_redaction,
          phase: variables.phase,
          maitre_ouvrage: variables.maitre_ouvrage,
          commune: variables.commune,
          departement: variables.departement,
          adresse_chantier: variables.adresse_chantier,
          montant_estime: variables.montant_estime,
          bureau_etudes: variables.bureau_etudes,
        },
      };
      const reponse = await api.post<{ apercu: ApercuLot[] }>("/api/pieces-ecrites/apercu-cctp/", payload);
      setApercu(reponse.apercu);
      setEtape(4);
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Impossible de générer l'aperçu.");
    } finally {
      setChargementApercu(false);
    }
  };

  const genererCCTP = async () => {
    if (!variables.intitule.trim()) { setErreur("L'intitulé du CCTP est requis."); return; }
    setGeneration(true);
    setErreur(null);
    setLienTelechargement(null);
    try {
      const payload = {
        projet_id: projetId,
        intitule: variables.intitule.trim(),
        lots: [...lotsSelectionnes].map((id) => lots.find((l) => l.id === id)?.code).filter(Boolean),
        prescriptions_exclues: [...prescriptionsExclues],
        prescriptions_personnalisees: Object.fromEntries(prescriptionsPersonnalisees),
        variables: {
          intitule: variables.intitule,
          date_redaction: variables.date_redaction,
          phase: variables.phase,
          maitre_ouvrage: variables.maitre_ouvrage,
          commune: variables.commune,
          departement: variables.departement,
          adresse_chantier: variables.adresse_chantier,
          montant_estime: variables.montant_estime,
          bureau_etudes: variables.bureau_etudes,
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
      setEtape(5);
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

  // ---------------------------------------------------------------------------
  // Rendu — barre de progression
  // ---------------------------------------------------------------------------

  const ETAPES_LIBELLES = ["Sélection des lots", "Personnalisation", "Variables", "Aperçu", "Génération"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* En-tête */}
      <div>
        <Link
          href={`/projets/${projetId}/pieces-ecrites`}
          style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", fontSize: "0.875rem", color: "var(--texte-3)", marginBottom: "0.5rem" }}
        >
          <ArrowLeft size={14} /> Pièces écrites
        </Link>
        <h1 style={{ color: "var(--texte)" }}>Générateur CCTP multi-lots</h1>
        <p style={{ color: "var(--texte-3)", marginTop: "0.25rem", fontSize: "0.875rem" }}>
          Sélectionnez les lots, personnalisez les prescriptions et générez le CCTP en Word.
        </p>
      </div>

      {erreur && (
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", borderRadius: "0.75rem", background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", fontSize: "0.875rem", padding: "0.75rem" }}>
          <AlertCircle style={{ width: "1rem", height: "1rem", flexShrink: 0 }} />
          {erreur}
          <button onClick={() => setErreur(null)} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "#b91c1c" }}>
            <X style={{ width: "1rem", height: "1rem" }} />
          </button>
        </div>
      )}

      {/* Barre de progression */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
        {ETAPES_LIBELLES.map((libelle, index) => {
          const num = index + 1;
          const fait = etape > num;
          const actif = etape === num;
          return (
            <div key={num} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: "1.75rem", height: "1.75rem", borderRadius: "50%", fontSize: "0.75rem", fontWeight: 700,
                background: fait ? "#22c55e" : actif ? "var(--c-base)" : "var(--bordure)",
                color: fait || actif ? "#fff" : "var(--texte-3)",
              }}>
                {fait ? <Check size={12} /> : num}
              </div>
              <span style={{ fontSize: "0.875rem", fontWeight: 500, color: actif ? "var(--c-base)" : "var(--texte-3)" }}>
                {libelle}
              </span>
              {index < ETAPES_LIBELLES.length - 1 && <ChevronRight size={14} style={{ color: "var(--bordure-fm)" }} />}
            </div>
          );
        })}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* ÉTAPE 1 — Sélection des lots par catégorie                          */}
      {/* ------------------------------------------------------------------ */}
      {etape === 1 && (
        <div className="carte" style={{ padding: "1.5rem" }}>
          <div style={{ marginBottom: "1.25rem" }}>
            <h2 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--texte)" }}>Sélection des lots</h2>
            <p style={{ fontSize: "0.875rem", color: "var(--texte-3)", marginTop: "0.25rem" }}>
              {lotsSelectionnes.size === 0
                ? "Cochez les lots à inclure dans le CCTP."
                : `${lotsSelectionnes.size} lot(s) sélectionné(s) — ${[...lotsSelectionnes].map((id) => lots.find((l) => l.id === id)?.code).filter(Boolean).join(", ")}`}
            </p>
          </div>

          {chargementLots ? (
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--texte-3)", fontSize: "0.875rem" }}>
              <Loader2 style={{ width: "1rem", height: "1rem", animation: "spin 1s linear infinite" }} /> Chargement des lots…
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              {CATEGORIES_LOTS.map((categorie) => {
                const lotsCategorie = lots.filter((l) => categorie.codes.includes(l.code));
                if (lotsCategorie.length === 0) return null;
                const idsCategorie = lotsCategorie.map((l) => l.id);
                const nbSelectionnes = idsCategorie.filter((id) => lotsSelectionnes.has(id)).length;
                const tousSelectionnes = nbSelectionnes === lotsCategorie.length;
                const Icone = categorie.icone;
                return (
                  <div key={categorie.id}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
                      <Icone size={16} style={{ color: "var(--c-base)" }} />
                      <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--texte)" }}>{categorie.libelle}</span>
                      <button
                        type="button"
                        onClick={() => toggleCategorie(categorie.codes)}
                        style={{
                          marginLeft: "auto", fontSize: "0.75rem", padding: "0.2rem 0.6rem",
                          borderRadius: "0.5rem", border: "1px solid var(--bordure)",
                          background: tousSelectionnes ? "var(--c-leger)" : "var(--fond-carte)",
                          color: tousSelectionnes ? "var(--c-base)" : "var(--texte-3)",
                          cursor: "pointer",
                        }}
                      >
                        {tousSelectionnes ? "Tout désélectionner" : "Tout sélectionner"}
                      </button>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "0.625rem" }}>
                      {lotsCategorie.map((lot) => {
                        const selectionne = lotsSelectionnes.has(lot.id);
                        return (
                          <label
                            key={lot.id}
                            style={{
                              display: "flex", alignItems: "flex-start", gap: "0.625rem", cursor: "pointer",
                              borderRadius: "1rem", border: `1px solid ${selectionne ? "var(--c-base)" : "var(--bordure)"}`,
                              padding: "0.875rem",
                              background: selectionne ? "var(--c-leger)" : "var(--fond-carte)",
                              transition: "border-color 0.15s, background 0.15s",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={selectionne}
                              onChange={() => toggleLot(lot.id)}
                              style={{ marginTop: "0.125rem", width: "1rem", height: "1rem" }}
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <span style={{
                                display: "inline-block", fontSize: "0.7rem", fontFamily: "monospace", fontWeight: 700,
                                color: "var(--c-base)", background: "var(--c-clair)", borderRadius: "0.25rem",
                                padding: "0.1rem 0.4rem", marginBottom: "0.25rem",
                              }}>
                                {lot.code}
                              </span>
                              <p style={{ fontSize: "0.8125rem", fontWeight: 500, color: "var(--texte)", margin: 0 }}>{lot.intitule}</p>
                              <p style={{ fontSize: "0.75rem", color: "var(--texte-3)", margin: 0 }}>
                                {lot.nb_prescriptions} prescription(s)
                              </p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1.5rem" }}>
            <button
              type="button"
              onClick={allerEtape2}
              disabled={lotsSelectionnes.size === 0}
              className="btn-primaire"
              style={{ opacity: lotsSelectionnes.size === 0 ? 0.5 : 1 }}
            >
              Suivant <ArrowRight style={{ width: "1rem", height: "1rem" }} />
            </button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* ÉTAPE 2 — Personnalisation des prescriptions                        */}
      {/* ------------------------------------------------------------------ */}
      {etape === 2 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div style={{ display: "grid", gap: "1.5rem", gridTemplateColumns: "minmax(0,1fr) 300px" }}>
            <div className="carte" style={{ padding: "1.5rem" }}>
              <h2 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--texte)", marginBottom: "0.25rem" }}>
                Personnalisation des prescriptions
              </h2>
              <p style={{ fontSize: "0.875rem", color: "var(--texte-3)", marginBottom: "1.25rem" }}>
                Décochez pour exclure ou modifiez le contenu de chaque prescription.
              </p>

              {chargementDetails ? (
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--texte-3)", fontSize: "0.875rem", padding: "1.5rem 0" }}>
                  <Loader2 style={{ width: "1rem", height: "1rem", animation: "spin 1s linear infinite" }} /> Chargement des prescriptions…
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  {[...lotsSelectionnes].map((lotId) => {
                    const lot = lots.find((l) => l.id === lotId);
                    const chapitres = lotsDetails.get(lotId) || [];
                    const nbTotal = chapitres.reduce((s, ch) => s + ch.prescriptions.length, 0);
                    const nbExclues = chapitres.reduce((s, ch) => s + ch.prescriptions.filter((p) => prescriptionsExclues.has(p.id)).length, 0);
                    return (
                      <div key={lotId} style={{ borderRadius: "1rem", border: "1px solid var(--bordure)", overflow: "hidden" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", background: "var(--fond-entree)", padding: "0.75rem 1rem" }}>
                          <FileText size={15} style={{ color: "var(--c-base)" }} />
                          <p style={{ fontWeight: 600, color: "var(--texte)", fontSize: "0.875rem", margin: 0, flex: 1 }}>
                            LOT {lot?.code} — {lot?.intitule}
                          </p>
                          <span style={{ fontSize: "0.75rem", color: "var(--texte-3)" }}>
                            {nbTotal - nbExclues}/{nbTotal} incluses
                          </span>
                        </div>
                        <div style={{ borderTop: "1px solid var(--bordure)" }}>
                          {chapitres.map((ch) => (
                            <div key={ch.numero}>
                              <button
                                type="button"
                                onClick={() => toggleChapitre(lotId, ch.numero)}
                                style={{
                                  display: "flex", width: "100%", alignItems: "center", gap: "0.5rem",
                                  padding: "0.625rem 1rem", textAlign: "left", fontSize: "0.8125rem",
                                  fontWeight: 500, color: "var(--texte)", background: "none", border: "none",
                                  borderBottom: "1px solid var(--bordure)", cursor: "pointer",
                                }}
                              >
                                {ch.ouvert ? <ChevronDown size={14} style={{ color: "var(--texte-3)" }} /> : <ChevronRight size={14} style={{ color: "var(--texte-3)" }} />}
                                <span style={{ fontFamily: "monospace", fontSize: "0.7rem", color: "var(--c-base)", marginRight: "0.25rem" }}>{ch.numero}</span>
                                {ch.intitule}
                                <span style={{ marginLeft: "auto", fontSize: "0.75rem", color: "var(--texte-3)" }}>
                                  {ch.prescriptions.filter((p) => !prescriptionsExclues.has(p.id)).length}/{ch.prescriptions.length}
                                </span>
                              </button>
                              {ch.ouvert && (
                                <div>
                                  {ch.prescriptions.map((p) => {
                                    const exclue = prescriptionsExclues.has(p.id);
                                    const personnalise = prescriptionsPersonnalisees.get(p.id) || "";
                                    return (
                                      <div key={p.id} style={{
                                        padding: "0.75rem 1rem", borderBottom: "1px solid var(--bordure)",
                                        opacity: exclue ? 0.45 : 1, background: "var(--fond-carte)",
                                      }}>
                                        <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
                                          <input
                                            type="checkbox"
                                            checked={!exclue}
                                            onChange={() => togglePrescription(p.id)}
                                            style={{ marginTop: "0.125rem", width: "1rem", height: "1rem", cursor: "pointer" }}
                                          />
                                          <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.375rem" }}>
                                              <p style={{ fontSize: "0.8125rem", fontWeight: 500, color: "var(--texte)", margin: 0 }}>{p.intitule}</p>
                                              {p.niveau && (
                                                <span className={NIVEAUX_COULEURS[p.niveau] || NIVEAUX_COULEURS.optionnel} style={{ fontSize: "0.7rem", padding: "0.1rem 0.4rem", borderRadius: "0.25rem" }}>
                                                  {p.niveau}
                                                </span>
                                              )}
                                            </div>
                                            {!exclue && (
                                              <div style={{ marginTop: "0.5rem" }}>
                                                <label style={{ fontSize: "0.75rem", color: "var(--texte-3)" }}>
                                                  Corps personnalisé (optionnel — laissez vide pour utiliser la bibliothèque)
                                                </label>
                                                <textarea
                                                  className="champ-saisie"
                                                  style={{ marginTop: "0.25rem", width: "100%", minHeight: "4rem", fontSize: "0.8125rem", fontFamily: "monospace" }}
                                                  placeholder={p.corps.slice(0, 120) + "…"}
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
                            <p style={{ padding: "0.75rem 1rem", fontSize: "0.875rem", color: "var(--texte-3)" }}>
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

            {/* Plan synthétique */}
            <div className="carte" style={{ padding: "1rem", alignSelf: "start", position: "sticky", top: "6rem" }}>
              <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--texte)", marginBottom: "0.75rem" }}>Plan du CCTP</p>
              <div style={{ maxHeight: "24rem", overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.125rem" }}>
                {[...lotsSelectionnes].map((lotId) => {
                  const lot = lots.find((l) => l.id === lotId);
                  const chapitres = lotsDetails.get(lotId) || [];
                  return (
                    <div key={lotId} style={{ marginBottom: "0.5rem" }}>
                      <p style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--texte)", margin: 0 }}>
                        LOT {lot?.code} — {lot?.intitule}
                      </p>
                      {chapitres.map((ch) => (
                        <p key={ch.numero} style={{ fontSize: "0.75rem", color: "var(--texte-2)", margin: "0.125rem 0 0 0.75rem", paddingLeft: "0.5rem", borderLeft: "2px solid var(--bordure)" }}>
                          {ch.numero} {ch.intitule}
                        </p>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <button type="button" onClick={() => setEtape(1)} className="btn-secondaire">
              <ArrowLeft style={{ width: "1rem", height: "1rem" }} /> Précédent
            </button>
            <button type="button" onClick={() => { setErreur(null); setEtape(3); }} className="btn-primaire">
              Suivant <ArrowRight style={{ width: "1rem", height: "1rem" }} />
            </button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* ÉTAPE 3 — Variables de fusion                                       */}
      {/* ------------------------------------------------------------------ */}
      {etape === 3 && (
        <div className="carte" style={{ padding: "1.5rem" }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--texte)", marginBottom: "0.25rem" }}>Variables de fusion</h2>
          <p style={{ fontSize: "0.875rem", color: "var(--texte-3)", marginBottom: "1.5rem" }}>
            Ces valeurs seront substituées dans les prescriptions qui contiennent <code style={{ background: "var(--fond-entree)", borderRadius: "0.25rem", padding: "0 0.25rem" }}>{"{variable}"}</code>.
          </p>

          <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(2, 1fr)" }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <label className="libelle-champ" htmlFor="intitule-cctp">
                Intitulé du CCTP <span style={{ color: "var(--erreur)" }}>*</span>
              </label>
              <input
                id="intitule-cctp"
                type="text"
                className="champ-saisie"
                style={{ width: "100%" }}
                placeholder="CCTP — Réhabilitation du groupe scolaire — Lots TCE"
                value={variables.intitule}
                onChange={(e) => setVariables((prev) => ({ ...prev, intitule: e.target.value }))}
              />
            </div>

            <div>
              <label className="libelle-champ">Maître d&apos;ouvrage</label>
              <input
                type="text"
                className="champ-saisie"
                style={{ width: "100%" }}
                placeholder="Commune de…"
                value={variables.maitre_ouvrage}
                onChange={(e) => setVariables((prev) => ({ ...prev, maitre_ouvrage: e.target.value }))}
              />
            </div>

            <div>
              <label className="libelle-champ">Bureau d&apos;études</label>
              <input
                type="text"
                className="champ-saisie"
                style={{ width: "100%" }}
                placeholder="LBH Économiste"
                value={variables.bureau_etudes}
                onChange={(e) => setVariables((prev) => ({ ...prev, bureau_etudes: e.target.value }))}
              />
            </div>

            <div>
              <label className="libelle-champ">Commune</label>
              <input
                type="text"
                className="champ-saisie"
                style={{ width: "100%" }}
                placeholder="Nom de la commune"
                value={variables.commune}
                onChange={(e) => setVariables((prev) => ({ ...prev, commune: e.target.value }))}
              />
            </div>

            <div>
              <label className="libelle-champ">Département</label>
              <input
                type="text"
                className="champ-saisie"
                style={{ width: "100%" }}
                placeholder="ex : Réunion (974)"
                value={variables.departement}
                onChange={(e) => setVariables((prev) => ({ ...prev, departement: e.target.value }))}
              />
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <label className="libelle-champ">Adresse du chantier</label>
              <input
                type="text"
                className="champ-saisie"
                style={{ width: "100%" }}
                placeholder="123 rue de la Paix, 97400 Saint-Denis"
                value={variables.adresse_chantier}
                onChange={(e) => setVariables((prev) => ({ ...prev, adresse_chantier: e.target.value }))}
              />
            </div>

            <div>
              <label className="libelle-champ">Montant estimé HT</label>
              <input
                type="text"
                className="champ-saisie"
                style={{ width: "100%" }}
                placeholder="1 200 000 €"
                value={variables.montant_estime}
                onChange={(e) => setVariables((prev) => ({ ...prev, montant_estime: e.target.value }))}
              />
            </div>

            <div>
              <label className="libelle-champ">Phase</label>
              <select
                className="champ-saisie"
                style={{ width: "100%" }}
                value={variables.phase}
                onChange={(e) => setVariables((prev) => ({ ...prev, phase: e.target.value }))}
              >
                {PHASES.map((ph) => <option key={ph} value={ph}>{ph}</option>)}
              </select>
            </div>

            <div>
              <label className="libelle-champ">Date de rédaction</label>
              <input
                type="date"
                className="champ-saisie"
                style={{ width: "100%" }}
                value={variables.date_redaction}
                onChange={(e) => setVariables((prev) => ({ ...prev, date_redaction: e.target.value }))}
              />
            </div>
          </div>

          {/* Récapitulatif */}
          <div style={{ marginTop: "1.5rem", borderRadius: "0.75rem", border: "1px solid var(--bordure)", background: "var(--fond-entree)", padding: "1rem" }}>
            <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--texte)", marginBottom: "0.75rem" }}>Récapitulatif</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.75rem" }}>
              {[
                { label: "Lots sélectionnés", valeur: lotsSelectionnes.size },
                { label: "Prescriptions exclues", valeur: prescriptionsExclues.size },
                { label: "Corps personnalisés", valeur: prescriptionsPersonnalisees.size },
                { label: "Phase", valeur: variables.phase },
              ].map((item) => (
                <div key={item.label}>
                  <span style={{ fontSize: "0.75rem", color: "var(--texte-3)" }}>{item.label}</span>
                  <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--texte)", margin: 0 }}>{item.valeur}</p>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "1.5rem" }}>
            <button type="button" onClick={() => setEtape(2)} className="btn-secondaire">
              <ArrowLeft style={{ width: "1rem", height: "1rem" }} /> Précédent
            </button>
            <button
              type="button"
              onClick={chargerApercu}
              disabled={chargementApercu || !variables.intitule.trim()}
              className="btn-primaire"
              style={{ opacity: chargementApercu || !variables.intitule.trim() ? 0.6 : 1 }}
            >
              {chargementApercu
                ? <><Loader2 style={{ width: "1rem", height: "1rem", animation: "spin 1s linear infinite" }} />Génération de l&apos;aperçu…</>
                : <><Eye style={{ width: "1rem", height: "1rem" }} />Aperçu du CCTP</>
              }
            </button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* ÉTAPE 4 — Aperçu du CCTP rendu                                     */}
      {/* ------------------------------------------------------------------ */}
      {etape === 4 && apercu && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div className="carte" style={{ padding: "1.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.25rem" }}>
              <Eye size={18} style={{ color: "var(--c-base)" }} />
              <h2 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--texte)", margin: 0 }}>Aperçu du CCTP</h2>
              <span style={{ marginLeft: "auto", fontSize: "0.75rem", color: "var(--texte-3)" }}>
                {apercu.length} lot(s) — Cliquez sur Générer pour créer le Word
              </span>
            </div>

            <div style={{ maxHeight: "60vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: "1.5rem", paddingRight: "0.5rem" }}>
              {apercu.map((lot) => (
                <div key={lot.code}>
                  <div style={{ padding: "0.5rem 0.75rem", background: "var(--c-leger)", borderLeft: "3px solid var(--c-base)", borderRadius: "0.25rem", marginBottom: "0.75rem" }}>
                    <p style={{ fontWeight: 700, color: "var(--texte)", fontSize: "0.875rem", margin: 0 }}>
                      LOT {lot.code} — {lot.intitule.toUpperCase()}
                    </p>
                  </div>
                  {lot.chapitres.map((ch) => (
                    <div key={ch.numero} style={{ marginBottom: "1rem", paddingLeft: "1rem" }}>
                      <p style={{ fontWeight: 600, color: "var(--texte)", fontSize: "0.8125rem", marginBottom: "0.5rem", borderBottom: "1px solid var(--bordure)", paddingBottom: "0.25rem" }}>
                        {ch.numero} — {ch.intitule}
                      </p>
                      {ch.prescriptions.map((p) => (
                        <div key={p.id} style={{ marginBottom: "0.75rem", paddingLeft: "0.75rem" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                            <p style={{ fontWeight: 600, fontSize: "0.8125rem", color: "var(--texte)", margin: 0 }}>{p.intitule}</p>
                            {p.niveau && (
                              <span className={NIVEAUX_COULEURS[p.niveau] || NIVEAUX_COULEURS.optionnel} style={{ fontSize: "0.7rem", padding: "0.1rem 0.4rem", borderRadius: "0.25rem" }}>
                                {p.niveau}
                              </span>
                            )}
                          </div>
                          <p style={{ fontSize: "0.8125rem", color: "var(--texte-2)", whiteSpace: "pre-wrap", margin: 0, lineHeight: 1.6 }}>{p.corps}</p>
                          {p.normes && p.normes.length > 0 && (
                            <p style={{ fontSize: "0.75rem", color: "var(--texte-3)", fontStyle: "italic", marginTop: "0.25rem" }}>
                              Normes : {p.normes.join(", ")}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <button type="button" onClick={() => setEtape(3)} className="btn-secondaire">
              <ArrowLeft style={{ width: "1rem", height: "1rem" }} /> Modifier les variables
            </button>
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button type="button" onClick={() => setEtape(1)} className="btn-secondaire">
                <RotateCcw style={{ width: "1rem", height: "1rem" }} /> Recommencer
              </button>
              <button
                type="button"
                onClick={genererCCTP}
                disabled={generation}
                className="btn-primaire"
                style={{ opacity: generation ? 0.6 : 1 }}
              >
                {generation
                  ? <><Loader2 style={{ width: "1rem", height: "1rem", animation: "spin 1s linear infinite" }} />Génération en cours…</>
                  : <><FileText style={{ width: "1rem", height: "1rem" }} />Générer le CCTP Word</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* ÉTAPE 5 — Téléchargement                                           */}
      {/* ------------------------------------------------------------------ */}
      {etape === 5 && (
        <div className="carte" style={{ padding: "3rem", textAlign: "center" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "4rem", height: "4rem", borderRadius: "50%", background: "#dcfce7", margin: "0 auto 1.5rem" }}>
            <CheckCircle style={{ width: "2rem", height: "2rem", color: "#16a34a" }} />
          </div>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--texte)", marginBottom: "0.5rem" }}>CCTP généré avec succès</h2>
          <p style={{ fontSize: "0.875rem", color: "var(--texte-3)", marginBottom: "0.25rem" }}>
            Le fichier Word est prêt au téléchargement.
          </p>
          {nomFichierGenere && (
            <p style={{ fontFamily: "monospace", fontSize: "0.8125rem", color: "var(--texte-2)", marginBottom: "1.5rem" }}>{nomFichierGenere}</p>
          )}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.75rem" }}>
            <button type="button" onClick={telecharger} className="btn-primaire">
              <Download style={{ width: "1rem", height: "1rem" }} /> Télécharger le CCTP
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
