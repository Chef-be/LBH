"use client";

import { use, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/crochets/useApi";
import {
  ArrowLeft, Building2, HardHat, BarChart3, Layers, RefreshCw,
  Plus, Check, AlertCircle, Loader2, ChevronDown, ChevronUp,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LigneTCE {
  code: string;
  designation: string;
  unite: string;
  categorie: string;
  ratio: number;
  montant: number;
  couleur: string;
}

interface ResultatTCE {
  type_ouvrage: string;
  label_ouvrage: string;
  montant_ht: number;
  total_ratio: number;
  lignes: LigneTCE[];
}

interface Projet {
  id: string;
  reference: string;
  intitule: string;
  montant_ht?: string | null;
}

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const TYPES_OUVRAGE = [
  {
    code: "batiment_collectif",
    label: "Bâtiment collectif résidentiel",
    description: "Logements, R+3 et plus, béton armé",
    icone: Building2,
    couleur: "var(--c-base)",
  },
  {
    code: "batiment_tertiaire",
    label: "Tertiaire / Bureaux",
    description: "Bureaux, commerces, bâtiments de services",
    icone: BarChart3,
    couleur: "#8b5cf6",
  },
  {
    code: "erp",
    label: "ERP / Équipement public",
    description: "Écoles, gymnases, mairies, équipements sportifs",
    icone: Layers,
    couleur: "#f59e0b",
  },
  {
    code: "vrd",
    label: "VRD / Aménagement",
    description: "Voirie, réseaux, espaces publics",
    icone: HardHat,
    couleur: "#10b981",
  },
];

const LABELS_CATEGORIE: Record<string, string> = {
  vrd: "VRD",
  structure: "Structure",
  enveloppe: "Enveloppe",
  second_oeuvre: "Second œuvre",
  fluides: "Fluides",
  reseaux: "Réseaux",
  paysager: "Paysager",
};

function formaterMontant(val: number): string {
  return val.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + " €";
}

// ---------------------------------------------------------------------------
// Composant
// ---------------------------------------------------------------------------

export default function PageEstimationTCE({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [projet, setProjet] = useState<Projet | null>(null);
  const [typeOuvrage, setTypeOuvrage] = useState("batiment_collectif");
  const [montantHT, setMontantHT] = useState("");
  const [ajustements, setAjustements] = useState<Record<string, number>>({});
  const [resultat, setResultat] = useState<ResultatTCE | null>(null);
  const [intitule, setIntitule] = useState("");
  const [calculEnCours, setCalculEnCours] = useState(false);
  const [creationEnCours, setCreationEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [lignesOuvertes, setLignesOuvertes] = useState<Record<string, boolean>>({});
  const [etude, setEtude] = useState<{ id: string; intitule: string } | null>(null);

  // Charger le projet pour pré-remplir le montant
  useEffect(() => {
    void api.get<Projet>(`/api/projets/${id}/`).then((p) => {
      setProjet(p);
      if (p.montant_ht && parseFloat(p.montant_ht) > 0) {
        setMontantHT(parseFloat(p.montant_ht).toFixed(0));
      }
    }).catch(() => null);
  }, [id]);

  const calculer = useCallback(async () => {
    const montant = parseFloat(montantHT.replace(/\s/g, "").replace(",", "."));
    if (!montant || montant <= 0) {
      setErreur("Saisissez un montant HT valide.");
      return;
    }
    setCalculEnCours(true);
    setErreur(null);
    try {
      const res = await api.post<ResultatTCE>("/api/economie/estimation-tce/", {
        type_ouvrage: typeOuvrage,
        montant_ht: montant,
        ajustements,
      });
      setResultat(res);
      if (!intitule) {
        setIntitule(`Estimation TCE — ${res.label_ouvrage}`);
      }
    } catch {
      setErreur("Impossible de calculer l'estimation TCE.");
    } finally {
      setCalculEnCours(false);
    }
  }, [montantHT, typeOuvrage, ajustements, intitule]);

  const ajusterRatio = (code: string, valeur: number) => {
    setAjustements((prev) => ({ ...prev, [code]: valeur }));
    setResultat(null); // invalider pour forcer recalcul
  };

  const creerEtude = async () => {
    if (!resultat) return;
    const montant = parseFloat(montantHT.replace(/\s/g, "").replace(",", "."));
    setCreationEnCours(true);
    setErreur(null);
    try {
      const res = await api.post<{ id: string; intitule: string }>("/api/economie/estimation-tce/creer-etude/", {
        projet_id: id,
        intitule: intitule || `Estimation TCE — ${resultat.label_ouvrage}`,
        type_ouvrage: typeOuvrage,
        montant_ht: montant,
        ajustements,
      });
      setEtude(res);
    } catch {
      setErreur("Impossible de créer l'étude économique.");
    } finally {
      setCreationEnCours(false);
    }
  };

  // Calculer automatiquement quand type change et montant présent
  useEffect(() => {
    if (montantHT && parseFloat(montantHT) > 0 && !resultat) {
      void calculer();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeOuvrage]);

  // Grouper les lignes par catégorie
  const lignesParCategorie = resultat
    ? resultat.lignes.reduce<Record<string, LigneTCE[]>>((acc, l) => {
        if (!acc[l.categorie]) acc[l.categorie] = [];
        acc[l.categorie].push(l);
        return acc;
      }, {})
    : {};

  const cs = {
    input: {
      background: "var(--fond-entree)",
      border: "1px solid var(--bordure)",
      color: "var(--texte)",
    },
  };

  if (etude) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-6">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{ background: "color-mix(in srgb, #10b981 15%, var(--fond-carte))" }}
        >
          <Check size={32} style={{ color: "#10b981" }} />
        </div>
        <div className="text-center space-y-1">
          <h2 style={{ color: "var(--texte)" }}>Étude créée</h2>
          <p className="text-sm" style={{ color: "var(--texte-2)" }}>{etude.intitule}</p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.push(`/projets/${id}/economie/${etude.id}`)}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
            style={{ background: "var(--c-base)" }}
          >
            Ouvrir l&apos;étude
          </button>
          <Link
            href={`/projets/${id}/economie`}
            className="px-5 py-2.5 rounded-xl text-sm border"
            style={{ borderColor: "var(--bordure)", color: "var(--texte-2)" }}
          >
            Retour à l&apos;économie
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* En-tête */}
      <div>
        <Link
          href={`/projets/${id}/economie`}
          className="inline-flex items-center gap-1 text-sm mb-2"
          style={{ color: "var(--texte-3)" }}
        >
          <ArrowLeft size={14} /> Économie
        </Link>
        <h2 style={{ color: "var(--texte)" }}>Estimation TCE</h2>
        {projet && (
          <p className="text-sm mt-1" style={{ color: "var(--texte-3)" }}>
            {projet.reference} — {projet.intitule}
          </p>
        )}
      </div>

      {erreur && (
        <div
          className="rounded-xl px-4 py-3 text-sm flex items-center gap-2"
          style={{ background: "color-mix(in srgb, #ef4444 10%, var(--fond-carte))", color: "#ef4444", border: "1px solid color-mix(in srgb, #ef4444 20%, var(--fond-carte))" }}
        >
          <AlertCircle size={14} /> {erreur}
        </div>
      )}

      {/* Sélection type d'ouvrage */}
      <div className="rounded-xl p-5 space-y-4" style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}>
        <h3 className="text-sm font-semibold" style={{ color: "var(--texte)" }}>Type d&apos;ouvrage</h3>
        <div className="grid grid-cols-2 gap-3">
          {TYPES_OUVRAGE.map((t) => {
            const Icone = t.icone;
            const actif = typeOuvrage === t.code;
            return (
              <button
                key={t.code}
                type="button"
                onClick={() => { setTypeOuvrage(t.code); setResultat(null); }}
                className="rounded-xl p-4 text-left transition-all"
                style={{
                  background: actif ? `color-mix(in srgb, ${t.couleur} 10%, var(--fond-entree))` : "var(--fond-entree)",
                  border: actif ? `2px solid ${t.couleur}` : "2px solid var(--bordure)",
                }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icone size={16} style={{ color: actif ? t.couleur : "var(--texte-3)" }} />
                  <span className="text-sm font-semibold" style={{ color: actif ? t.couleur : "var(--texte)" }}>
                    {t.label}
                  </span>
                </div>
                <p className="text-xs" style={{ color: "var(--texte-3)" }}>{t.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Montant de base */}
      <div className="rounded-xl p-5 space-y-4" style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}>
        <h3 className="text-sm font-semibold" style={{ color: "var(--texte)" }}>Montant de base</h3>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="text-xs font-medium mb-1 block" style={{ color: "var(--texte-3)" }}>
              Montant total HT (€)
            </label>
            <input
              type="number"
              min="0"
              step="1000"
              value={montantHT}
              onChange={(e) => { setMontantHT(e.target.value); setResultat(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") void calculer(); }}
              placeholder="Ex : 1 500 000"
              className="w-full rounded-lg px-3 py-2 text-sm font-mono"
              style={cs.input}
            />
          </div>
          <button
            type="button"
            onClick={calculer}
            disabled={calculEnCours || !montantHT}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: "var(--c-base)" }}
          >
            {calculEnCours ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            {resultat ? "Recalculer" : "Calculer"}
          </button>
        </div>
      </div>

      {/* Résultats TCE */}
      {resultat && (
        <>
          {/* Tableau récapitulatif */}
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--bordure)" }}>
            <div
              className="px-5 py-3 flex items-center justify-between"
              style={{ background: "var(--fond-entree)", borderBottom: "1px solid var(--bordure)" }}
            >
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--texte-3)" }}>
                  Répartition TCE
                </span>
                <span className="text-xs ml-2" style={{ color: "var(--texte-3)" }}>
                  {resultat.lignes.length} corps d&apos;état — {formaterMontant(resultat.montant_ht)} HT
                </span>
              </div>
              <span className="text-xs" style={{ color: "var(--texte-3)" }}>
                Cliquez sur une ligne pour ajuster le ratio
              </span>
            </div>

            {/* Barres de répartition globale */}
            <div className="px-5 pt-4 pb-2" style={{ background: "var(--fond-carte)" }}>
              <div className="flex rounded-lg overflow-hidden h-4">
                {resultat.lignes.map((l) => (
                  <div
                    key={l.code}
                    title={`${l.designation} : ${l.ratio.toFixed(1)}%`}
                    style={{
                      width: `${(l.ratio / resultat.total_ratio) * 100}%`,
                      background: l.couleur,
                      opacity: 0.85,
                    }}
                  />
                ))}
              </div>
              {/* Légende catégories */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                {Object.entries(lignesParCategorie).map(([cat, lignes]) => (
                  <div key={cat} className="flex items-center gap-1">
                    <div
                      className="w-2.5 h-2.5 rounded-sm"
                      style={{ background: lignes[0].couleur }}
                    />
                    <span className="text-xs" style={{ color: "var(--texte-3)" }}>
                      {LABELS_CATEGORIE[cat] ?? cat}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <table className="w-full text-sm" style={{ background: "var(--fond-carte)" }}>
              <thead>
                <tr style={{ background: "var(--fond-entree)", borderBottom: "1px solid var(--bordure)" }}>
                  {["Code", "Corps d'état", "Ratio %", "Montant HT", "Ajuster"].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider"
                      style={{ color: "var(--texte-3)" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {resultat.lignes.map((l, i) => {
                  const ouvert = lignesOuvertes[l.code];
                  return (
                    <>
                      <tr
                        key={l.code}
                        style={{ borderBottom: "1px solid var(--bordure)" }}
                        className="hover:opacity-90 transition-opacity"
                      >
                        <td className="px-4 py-3 font-mono text-xs" style={{ color: "var(--texte-3)" }}>
                          {l.code}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-2 h-8 rounded-full shrink-0"
                              style={{ background: l.couleur }}
                            />
                            <span className="font-medium" style={{ color: "var(--texte)" }}>
                              {l.designation}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div
                            className="flex items-center gap-2 w-24 rounded-full px-2 py-0.5"
                            style={{ background: `color-mix(in srgb, ${l.couleur} 12%, var(--fond-entree))` }}
                          >
                            <div
                              className="h-1.5 rounded-full"
                              style={{
                                width: `${Math.min((l.ratio / 35) * 100, 100)}%`,
                                background: l.couleur,
                              }}
                            />
                            <span className="text-xs font-mono font-semibold" style={{ color: l.couleur }}>
                              {l.ratio.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono font-semibold" style={{ color: "var(--texte)" }}>
                          {formaterMontant(l.montant)}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => setLignesOuvertes((prev) => ({ ...prev, [l.code]: !prev[l.code] }))}
                            className="p-1.5 rounded-lg"
                            style={{ background: "var(--fond-entree)", color: "var(--texte-2)" }}
                          >
                            {ouvert ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          </button>
                        </td>
                      </tr>
                      {ouvert && (
                        <tr key={`${l.code}-edit`} style={{ background: "var(--fond-entree)", borderBottom: "1px solid var(--bordure)" }}>
                          <td colSpan={5} className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <span className="text-xs" style={{ color: "var(--texte-3)" }}>
                                Ajuster le ratio pour {l.designation} :
                              </span>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.5"
                                defaultValue={l.ratio}
                                className="rounded-lg px-2 py-1 text-sm font-mono w-20"
                                style={cs.input}
                                onChange={(e) => ajusterRatio(l.code, parseFloat(e.target.value) || l.ratio)}
                              />
                              <span className="text-xs" style={{ color: "var(--texte-3)" }}>%</span>
                              <button
                                type="button"
                                onClick={calculer}
                                className="text-xs font-medium px-3 py-1 rounded-lg text-white"
                                style={{ background: "var(--c-base)" }}
                              >
                                Appliquer
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: "var(--fond-entree)", borderTop: "1px solid var(--bordure)" }}>
                  <td colSpan={2} className="px-4 py-3 font-semibold text-sm" style={{ color: "var(--texte)" }}>
                    Total
                  </td>
                  <td className="px-4 py-3 font-mono font-semibold text-sm" style={{ color: "var(--texte)" }}>
                    {resultat.total_ratio.toFixed(1)}%
                  </td>
                  <td className="px-4 py-3 font-mono font-bold text-base" style={{ color: "var(--c-base)" }}>
                    {formaterMontant(resultat.montant_ht)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Créer l'étude */}
          <div className="rounded-xl p-5 space-y-4" style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}>
            <h3 className="text-sm font-semibold" style={{ color: "var(--texte)" }}>Enregistrer comme étude économique</h3>
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: "var(--texte-3)" }}>
                Intitulé de l&apos;étude
              </label>
              <input
                type="text"
                value={intitule}
                onChange={(e) => setIntitule(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={cs.input}
              />
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={creerEtude}
                disabled={creationEnCours}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
                style={{ background: "var(--c-base)" }}
              >
                {creationEnCours ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                {creationEnCours ? "Création…" : "Créer l'étude économique"}
              </button>
              <Link
                href={`/projets/${id}/economie`}
                className="px-5 py-2.5 rounded-xl text-sm border"
                style={{ borderColor: "var(--bordure)", color: "var(--texte-2)" }}
              >
                Annuler
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
