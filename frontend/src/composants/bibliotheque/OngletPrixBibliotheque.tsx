"use client";

import { useRef, useState, useEffect, type ChangeEvent } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { api, ErreurApi, extraireListeResultats } from "@/crochets/useApi";
import { useSessionStore } from "@/crochets/useSession";
import { ActionsRapidesAdaptatives } from "@/composants/ui/ActionsRapides";
import {
  Calculator,
  CheckCircle,
  DatabaseZap,
  Eye,
  FileText,
  FileUp,
  Filter,
  Pencil,
  Search,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LigneBibliotheque {
  id: string;
  code: string;
  designation_courte: string;
  designation_longue?: string;
  unite: string;
  famille: string;
  sous_famille: string;
  statut_validation: string;
  niveau?: string;
  debourse_sec_unitaire: string | number | null;
  prix_vente_unitaire: string | number | null;
  cout_matieres?: string | number | null;
  cout_materiel?: string | number | null;
  cout_consommables?: string | number | null;
  cout_sous_traitance?: string | number | null;
  cout_transport?: string | number | null;
  cout_frais_divers?: string | number | null;
  temps_main_oeuvre?: string | number | null;
  cout_horaire_mo?: string | number | null;
  lot_cctp_reference_detail?: { id: string; numero: string; intitule: string } | null;
}

interface LotCCTP {
  id: string;
  numero: string;
  intitule: string;
  nb_prescriptions: number;
}

interface PageResultats {
  count: number;
  next: string | null;
  results: LigneBibliotheque[];
}

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const STYLES_STATUT: Record<string, string> = {
  brouillon: "badge-neutre",
  a_valider: "badge-avertissement",
  valide: "badge-succes",
  obsolete: "badge-danger",
};

const LIBELLES_STATUT: Record<string, string> = {
  brouillon: "Brouillon",
  a_valider: "À valider",
  valide: "Validé",
  obsolete: "Obsolète",
};

const COULEURS_DS: Record<string, string> = {
  mo: "#3b82f6",
  matieres: "#10b981",
  materiel: "#f59e0b",
  consommables: "#8b5cf6",
  sous_traitance: "#06b6d4",
  transport: "#64748b",
  frais_divers: "#f43f5e",
};

const LIBELLES_DS: Record<string, string> = {
  mo: "MO",
  matieres: "Mat.",
  materiel: "Matériel",
  consommables: "Consom.",
  sous_traitance: "S-T",
  transport: "Transp.",
  frais_divers: "Frais",
};

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

function toNumber(val: string | number | null | undefined): number {
  if (val == null) return 0;
  return typeof val === "string" ? parseFloat(val) || 0 : val;
}

function formaterMontant(val: string | number | null | undefined): string {
  const n = toNumber(val);
  if (n === 0) return "—";
  return `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

function calculerComposantesMO(ligne: LigneBibliotheque): Record<string, number> {
  const mo = toNumber(ligne.temps_main_oeuvre) * toNumber(ligne.cout_horaire_mo);
  const matieres = toNumber(ligne.cout_matieres);
  const materiel = toNumber(ligne.cout_materiel);
  const consommables = toNumber(ligne.cout_consommables);
  const sous_traitance = toNumber(ligne.cout_sous_traitance);
  const transport = toNumber(ligne.cout_transport);
  const frais_divers = toNumber(ligne.cout_frais_divers);
  return { mo, matieres, materiel, consommables, sous_traitance, transport, frais_divers };
}

// ---------------------------------------------------------------------------
// Sous-composant : barres DS proportionnelles
// ---------------------------------------------------------------------------

function BarresDS({ ligne }: { ligne: LigneBibliotheque }) {
  const ds = toNumber(ligne.debourse_sec_unitaire);
  if (ds === 0) return <span className="text-xs text-slate-400">—</span>;

  const composantes = calculerComposantesMO(ligne);
  const total = Object.values(composantes).reduce((a, b) => a + b, 0) || ds;

  return (
    <div className="flex items-center gap-1">
      <div className="flex h-3 w-24 overflow-hidden rounded-full bg-slate-100">
        {Object.entries(composantes).map(([cle, valeur]) => {
          if (valeur <= 0) return null;
          const pct = Math.round((valeur / total) * 100);
          if (pct < 1) return null;
          return (
            <div
              key={cle}
              style={{ width: `${pct}%`, backgroundColor: COULEURS_DS[cle] }}
              title={`${LIBELLES_DS[cle]} : ${formaterMontant(valeur)} (${pct}%)`}
            />
          );
        })}
      </div>
      <span className="text-xs font-mono text-slate-600">{formaterMontant(ds)}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panneau latéral de détail
// ---------------------------------------------------------------------------

interface SousDetailPrix {
  id: string;
  ordre: number;
  type_ressource: string;
  type_libelle: string;
  code?: string;
  designation?: string;
  unite?: string;
  quantite: number | string;
  cout_unitaire_ht: number | string | null;
  montant_ht: number | string | null;
  taux_horaire?: number | string | null;
  zone_taux?: string;
  zone_libelle?: string;
  profil_main_oeuvre_code?: string;
  profil_main_oeuvre_libelle?: string;
  nombre_ressources?: number;
  temps_unitaire?: number | string | null;
  observations?: string;
}

// Couleurs par type de ressource (SDP)
const COULEURS_RESSOURCE: Record<string, string> = {
  mo: "#6366f1",
  matiere: "#10b981",
  materiel: "#f59e0b",
  consommable: "#8b5cf6",
  sous_traitance: "#ef4444",
  transport: "#06b6d4",
  frais_divers: "#64748b",
};

const LIBELLES_RESSOURCE: Record<string, string> = {
  mo: "Main-d'œuvre",
  matiere: "Matériaux",
  materiel: "Matériel",
  consommable: "Consommables",
  sous_traitance: "Sous-traitance",
  transport: "Transport",
  frais_divers: "Frais divers",
};

// Plages de cohérence Kpv selon Manuel Cusant & Widloecher
// Kpv = PV HT / DS = 1 / (1 - FC% - Fop% - FG% - B&A%)
// Zone verte : 1.25–1.55 (standard bâtiment courant)
// Zone orange : 1.55–2.00 (forte part de frais / marges élevées)
// Zone rouge : > 2.00 ou < 1.10 (anomalie probable)
function classeKpv(kpv: number): { classe: string; label: string; message: string } {
  if (kpv <= 0) return { classe: "text-slate-400", label: "N/A", message: "PV non renseigné" };
  if (kpv < 1.10) return { classe: "text-red-600", label: "Très bas", message: "< 1.10 : marges insuffisantes" };
  if (kpv < 1.25) return { classe: "text-orange-500", label: "Bas", message: "1.10–1.25 : couverture faible des frais" };
  if (kpv <= 1.55) return { classe: "text-green-600", label: "Normal", message: "1.25–1.55 : plage standard bâtiment" };
  if (kpv <= 2.00) return { classe: "text-orange-500", label: "Élevé", message: "1.55–2.00 : vérifier FC/FG/marges" };
  return { classe: "text-red-600", label: "Très élevé", message: "> 2.00 : anomalie probable ou prix distribution" };
}

// Plages % par type de ressource (ratios ARTIPRIX 2025 + Cusant & Widloecher)
const PLAGES_PCT_DS: Record<string, [number, number, string]> = {
  mo: [15, 55, "15–55 % selon corps d'état"],
  matiere: [20, 60, "20–60 % selon fournitures"],
  materiel: [5, 35, "5–35 % selon équipements"],
  consommable: [0, 10, "0–10 %"],
  sous_traitance: [0, 80, "0–80 %"],
  transport: [0, 15, "0–15 %"],
  frais_divers: [0, 10, "0–10 %"],
};

function classePctDS(type: string, pct: number): string {
  const plage = PLAGES_PCT_DS[type];
  if (!plage || pct === 0) return "text-slate-500";
  if (pct < plage[0]) return "text-orange-500";
  if (pct > plage[1]) return "text-orange-500";
  return "text-green-700";
}

function PanneauDetailLigne({
  ligne,
  onFermer,
}: {
  ligne: LigneBibliotheque;
  onFermer: () => void;
}) {
  const queryClient = useQueryClient();
  const ds = toNumber(ligne.debourse_sec_unitaire);
  const pv = toNumber(ligne.prix_vente_unitaire);
  const kpv = ds > 0 && pv > 0 ? pv / ds : 0;
  const infoKpv = classeKpv(kpv);
  const composantes = calculerComposantesMO(ligne);

  const { data: sousDetailsData, isLoading: chargementSD, refetch: rechargerSD } = useQuery<SousDetailPrix[]>({
    queryKey: ["sous-details-bibliotheque", ligne.id],
    queryFn: () => api.get<SousDetailPrix[]>(`/api/bibliotheque/${ligne.id}/sous-details/`),
  });
  const sousDetails: SousDetailPrix[] = Array.isArray(sousDetailsData)
    ? (sousDetailsData as SousDetailPrix[])
    : ((sousDetailsData as unknown as { results?: SousDetailPrix[] })?.results ?? []);

  const [completionEnCours, setCompletionEnCours] = useState(false);

  const completerSousDetails = async () => {
    setCompletionEnCours(true);
    try {
      await api.post(`/api/bibliotheque/${ligne.id}/completer-sous-details/`, {});
      queryClient.invalidateQueries({ queryKey: ["sous-details-bibliotheque", ligne.id] });
      rechargerSD();
    } finally {
      setCompletionEnCours(false);
    }
  };

  // Grouper les sous-détails par type pour l'affichage SDP
  const sdParType: Record<string, SousDetailPrix[]> = {};
  for (const sd of sousDetails) {
    if (!sdParType[sd.type_ressource]) sdParType[sd.type_ressource] = [];
    sdParType[sd.type_ressource].push(sd);
  }

  // Totaux SDP réels (depuis les sous-détails)
  const totalSDPMatx = sousDetails.filter(sd => sd.type_ressource === "matiere").reduce((acc, sd) => acc + toNumber(sd.montant_ht), 0);
  const totalSDPMatl = sousDetails.filter(sd => sd.type_ressource === "materiel").reduce((acc, sd) => acc + toNumber(sd.montant_ht), 0);
  const totalSDPMO = sousDetails.filter(sd => sd.type_ressource === "mo").reduce((acc, sd) => acc + toNumber(sd.montant_ht), 0);
  const totalSDPDivers = sousDetails.filter(sd => !["matiere","materiel","mo"].includes(sd.type_ressource)).reduce((acc, sd) => acc + toNumber(sd.montant_ht), 0);
  const totalSDP = sousDetails.reduce((acc, sd) => acc + toNumber(sd.montant_ht), 0);

  // Types à afficher dans l'ordre SDP
  const typesSDP = ["matiere", "materiel", "mo", "consommable", "sous_traitance", "transport", "frais_divers"];

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col bg-white shadow-2xl">
      {/* En-tête */}
      <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-mono text-slate-400">{ligne.code || "—"} · {ligne.unite}</p>
          <h2 className="mt-0.5 text-base font-semibold text-slate-900 truncate">{ligne.designation_courte}</h2>
          <p className="text-xs text-slate-400 mt-0.5">{ligne.famille}{ligne.sous_famille ? ` / ${ligne.sous_famille}` : ""}</p>
        </div>
        <button type="button" onClick={onFermer} className="ml-4 rounded-lg p-1.5 hover:bg-slate-100 flex-shrink-0">
          <X className="h-4 w-4 text-slate-500" />
        </button>
      </div>

      {/* Corps */}
      <div className="flex-1 overflow-y-auto">

        {/* ── Bloc Kpv + synthèse DS→PV ── */}
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-start gap-6 flex-wrap">
            {/* DS */}
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide">DS unitaire</p>
              <p className="text-xl font-bold font-mono text-slate-800 mt-0.5">{ds > 0 ? formaterMontant(ds) : "—"}</p>
            </div>
            {/* PV */}
            {pv > 0 && (
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide">Prix de vente HT</p>
                <p className="text-xl font-bold font-mono text-primaire-700 mt-0.5">{formaterMontant(pv)}</p>
              </div>
            )}
            {/* Kpv */}
            <div className="ml-auto">
              <p className="text-xs text-slate-400 uppercase tracking-wide">Coefficient Kpv</p>
              <div className="flex items-baseline gap-2 mt-0.5">
                <p className={clsx("text-2xl font-bold font-mono", infoKpv.classe)}>
                  {kpv > 0 ? kpv.toFixed(3) : "—"}
                </p>
                {kpv > 0 && (
                  <span className={clsx("text-xs font-medium", infoKpv.classe)}>{infoKpv.label}</span>
                )}
              </div>
              {kpv > 0 && (
                <p className="text-xs text-slate-400 mt-0.5 max-w-[180px]">{infoKpv.message}</p>
              )}
            </div>
          </div>

          {/* Barre empilée DS par composante */}
          {ds > 0 && (
            <div className="mt-3">
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-200">
                {typesSDP.map((type) => {
                  const sdsType = sdParType[type] ?? [];
                  const montantType = sdsType.reduce((acc, sd) => acc + toNumber(sd.montant_ht), 0);
                  if (montantType <= 0) return null;
                  const pct = totalSDP > 0 ? (montantType / totalSDP) * 100 : 0;
                  if (pct < 0.5) return null;
                  return (
                    <div
                      key={type}
                      style={{ width: `${pct}%`, backgroundColor: COULEURS_RESSOURCE[type] ?? "#94a3b8" }}
                      title={`${LIBELLES_RESSOURCE[type] ?? type} : ${formaterMontant(montantType)} (${pct.toFixed(0)}%)`}
                    />
                  );
                })}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
                {typesSDP.map((type) => {
                  const sdsType = sdParType[type] ?? [];
                  const montantType = sdsType.reduce((acc, sd) => acc + toNumber(sd.montant_ht), 0);
                  if (montantType <= 0) return null;
                  const pct = totalSDP > 0 ? (montantType / totalSDP) * 100 : 0;
                  return (
                    <span key={type} className="text-xs text-slate-500 flex items-center gap-1">
                      <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: COULEURS_RESSOURCE[type] ?? "#94a3b8" }} />
                      {(LIBELLES_RESSOURCE[type] ?? type).substring(0, 10)} {pct.toFixed(0)} %
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* ── Tableau SDP (Sous-Détail de Prix) — logique Manuel Cusant & Widloecher ── */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Sous-Détail de Prix (SDP)
              </h3>
              {chargementSD ? null : (
                <button
                  type="button"
                  className="text-xs text-primaire-600 hover:underline"
                  onClick={completerSousDetails}
                  disabled={completionEnCours}
                >
                  {completionEnCours ? "Complétion…" : "Compléter depuis composantes"}
                </button>
              )}
            </div>

            {chargementSD ? (
              <p className="text-sm text-slate-400">Chargement…</p>
            ) : sousDetails.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-400">
                Aucun sous-détail renseigné.{" "}
                <button type="button" className="text-primaire-600 hover:underline" onClick={completerSousDetails} disabled={completionEnCours}>
                  Générer depuis composantes agrégées
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400">
                      <th className="text-left py-1.5 pr-2 font-medium">Désignation</th>
                      <th className="text-right py-1.5 pr-2 font-medium">Qe/TU</th>
                      <th className="text-left py-1.5 pr-2 font-medium">U</th>
                      <th className="text-right py-1.5 pr-2 font-medium">DU/DHMO</th>
                      <th className="text-right py-1.5 pr-2 font-medium text-green-700">Dé.Matx</th>
                      <th className="text-right py-1.5 pr-2 font-medium text-amber-600">Dé.Matl</th>
                      <th className="text-right py-1.5 font-medium text-indigo-600">Dé.MO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sousDetails.sort((a, b) => a.ordre - b.ordre).map((sd) => {
                      const isMO = sd.type_ressource === "mo";
                      const isMatl = sd.type_ressource === "materiel";
                      const isMatx = sd.type_ressource === "matiere";
                      const montant = toNumber(sd.montant_ht);
                      const pct = totalSDP > 0 ? (montant / totalSDP) * 100 : 0;
                      const couleur = COULEURS_RESSOURCE[sd.type_ressource] ?? "#94a3b8";
                      return (
                        <tr key={sd.id} className="border-b border-slate-50 hover:bg-slate-50">
                          <td className="py-2 pr-2 max-w-[160px]">
                            <div className="flex items-start gap-1.5">
                              <div className="mt-1 h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: couleur }} />
                              <div>
                                <p className="font-medium text-slate-700 leading-tight">
                                  {sd.designation || sd.code || LIBELLES_RESSOURCE[sd.type_ressource] || sd.type_ressource}
                                </p>
                                {sd.profil_main_oeuvre_libelle && (
                                  <p className="text-slate-400">{sd.profil_main_oeuvre_code}</p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-2 pr-2 text-right font-mono text-slate-600">
                            {isMO && toNumber(sd.temps_unitaire) > 0
                              ? toNumber(sd.temps_unitaire).toFixed(4)
                              : toNumber(sd.quantite) > 0
                                ? toNumber(sd.quantite).toFixed(4)
                                : "—"}
                          </td>
                          <td className="py-2 pr-2 text-slate-500">{sd.unite || "—"}</td>
                          <td className="py-2 pr-2 text-right font-mono text-slate-600">
                            {isMO && toNumber(sd.taux_horaire) > 0
                              ? formaterMontant(sd.taux_horaire)
                              : toNumber(sd.cout_unitaire_ht) > 0
                                ? formaterMontant(sd.cout_unitaire_ht)
                                : "—"}
                          </td>
                          {/* Colonnes SDP : Dé.Matx / Dé.Matl / Dé.MO */}
                          <td className="py-2 pr-2 text-right font-mono">
                            {isMatx ? <span className="text-green-700 font-semibold">{formaterMontant(montant)}</span> : <span className="text-slate-200">—</span>}
                          </td>
                          <td className="py-2 pr-2 text-right font-mono">
                            {isMatl ? <span className="text-amber-600 font-semibold">{formaterMontant(montant)}</span> : <span className="text-slate-200">—</span>}
                          </td>
                          <td className="py-2 text-right font-mono">
                            {isMO ? <span className="text-indigo-600 font-semibold">{formaterMontant(montant)}</span> : <span className="text-slate-200">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                    {/* Ligne TOTAL DSu */}
                    <tr className="border-t-2 border-slate-200 font-semibold text-xs">
                      <td className="py-2 pr-2 text-slate-700" colSpan={4}>DSu = Σ Dé.Matx + Σ Dé.Matl + Σ Dé.MO</td>
                      <td className="py-2 pr-2 text-right font-mono text-green-700">{totalSDPMatx > 0 ? formaterMontant(totalSDPMatx) : "—"}</td>
                      <td className="py-2 pr-2 text-right font-mono text-amber-600">{totalSDPMatl > 0 ? formaterMontant(totalSDPMatl) : "—"}</td>
                      <td className="py-2 text-right font-mono text-indigo-600">{totalSDPMO > 0 ? formaterMontant(totalSDPMO) : "—"}</td>
                    </tr>
                    {totalSDPDivers > 0 && (
                      <tr className="text-xs">
                        <td className="py-1 pr-2 text-slate-500" colSpan={4}>Frais divers / Autres</td>
                        <td colSpan={3} className="py-1 text-right font-mono text-slate-600">{formaterMontant(totalSDPDivers)}</td>
                      </tr>
                    )}
                    <tr className="bg-slate-50 font-bold text-sm">
                      <td className="py-2 pr-2 text-slate-800" colSpan={4}>Total DSu</td>
                      <td className="py-2 text-right font-mono text-slate-800" colSpan={3}>{formaterMontant(totalSDP)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* ── Analyse des composantes DS (plages de cohérence) ── */}
          {sousDetails.length > 0 && totalSDP > 0 && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">
                Analyse DS — Plages de cohérence
              </h3>
              <div className="space-y-2">
                {typesSDP.map((type) => {
                  const sdsType = sdParType[type] ?? [];
                  const montantType = sdsType.reduce((acc, sd) => acc + toNumber(sd.montant_ht), 0);
                  if (montantType <= 0) return null;
                  const pct = totalSDP > 0 ? (montantType / totalSDP) * 100 : 0;
                  const classePct = classePctDS(type, pct);
                  const plage = PLAGES_PCT_DS[type];
                  return (
                    <div key={type} className="flex items-center gap-3">
                      <div className="w-24 text-xs text-slate-600 flex-shrink-0">
                        {LIBELLES_RESSOURCE[type] ?? type}
                      </div>
                      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(pct, 100)}%`,
                            backgroundColor: COULEURS_RESSOURCE[type] ?? "#94a3b8",
                            opacity: pct >= (plage?.[0] ?? 0) && pct <= (plage?.[1] ?? 100) ? 1 : 0.5,
                          }}
                        />
                      </div>
                      <div className={clsx("text-xs font-mono font-semibold w-12 text-right flex-shrink-0", classePct)}>
                        {pct.toFixed(0)} %
                      </div>
                      <div className="text-xs text-slate-400 flex-shrink-0 hidden xl:block">
                        {plage ? `[${plage[0]}–${plage[1]}%]` : ""}
                      </div>
                    </div>
                  );
                })}
                {/* Écart DS SDP vs DS agrégé */}
                {ds > 0 && Math.abs(totalSDP - ds) > 0.01 && (
                  <div className="mt-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-700">
                    Écart SDP/DS : Total SDP = {formaterMontant(totalSDP)}, DS agrégé = {formaterMontant(ds)}{" "}
                    (Δ = {formaterMontant(Math.abs(totalSDP - ds))})
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ── Chaîne DS → PV HT (Kpv) ── */}
          {ds > 0 && (() => {
            // Taux standard BTP (valeurs médianes de marché)
            const FC_PCT  = 0.10;   // Frais de Chantier — médiane 10% DS (plage 5–15%)
            const FOP_PCT = 0.015;  // Frais d'opération — médiane 1.5% DS (plage 1–2%)
            const FG_PCT  = 0.10;   // Frais Généraux — médiane 10% PV (plage 8–12%)
            const BA_PCT  = 0.06;   // Bénéfice & Aléas — médiane 6% PV (plage 4–8%)

            // DS → PV : PV = DS × (1 + FC + Fop) / (1 − FG − B&A)
            const fc_val   = ds * FC_PCT;
            const fop_val  = ds * FOP_PCT;
            const cd_val   = ds + fc_val + fop_val;
            const pvEstime = cd_val / (1 - FG_PCT - BA_PCT);
            const fg_val   = pvEstime * FG_PCT;
            const ba_val   = pvEstime * BA_PCT;
            const kpvEstime = pvEstime / ds;

            // Si PV réel connu — on remonte les taux implicites
            let fcImplicit = "—", fopNote = "", cdReel = 0, fgImplicit = "—", baImplicit = "—";
            if (pv > 0) {
              // On ne peut pas isoler FC/Fop séparément sans les données de chantier,
              // mais on peut estimer CD réel = DS × (1 + FC_med + Fop_med)
              cdReel = ds + fc_val + fop_val;
              const margeApparente = pv - cdReel;
              fgImplicit  = `≈ ${formaterMontant(pv * FG_PCT)} (10% PV estimé)`;
              baImplicit  = `≈ ${formaterMontant(pv * BA_PCT)} (6% PV estimé)`;
              fcImplicit  = `≈ ${formaterMontant(fc_val)} (10% DS)`;
              fopNote     = margeApparente > 0
                ? `Marge brute implicite ≈ ${formaterMontant(margeApparente)} (${((margeApparente / pv) * 100).toFixed(1)}% PV)`
                : "";
            }

            return (
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">
                  Chaîne DS → PV HT
                </h3>
                {pv === 0 && (
                  <p className="text-xs text-amber-600 bg-amber-50 rounded px-2 py-1 mb-2 italic">
                    Prix de vente non renseigné — estimations calculées avec les taux médianes BTP
                  </p>
                )}
                <div className="space-y-0.5 text-sm">
                  {/* DS */}
                  <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                    <span className="text-slate-700 font-medium">DS — Déboursé Sec</span>
                    <span className="font-mono font-bold text-slate-800">{formaterMontant(ds)}</span>
                  </div>
                  {/* FC */}
                  <div className="flex justify-between items-center py-1 border-b border-slate-50">
                    <span className="text-slate-500 text-xs">
                      + FC — Frais de Chantier
                      <span className="ml-1 text-slate-400">(médiane 10% DS, plage 5–15%)</span>
                    </span>
                    <span className="font-mono text-xs text-slate-600">
                      {pv > 0 ? fcImplicit : `≈ ${formaterMontant(fc_val)}`}
                    </span>
                  </div>
                  {/* Fop */}
                  <div className="flex justify-between items-center py-1 border-b border-slate-50">
                    <span className="text-slate-500 text-xs">
                      + Fop — Frais d&apos;opération
                      <span className="ml-1 text-slate-400">(médiane 1.5% DS, plage 1–2%)</span>
                    </span>
                    <span className="font-mono text-xs text-slate-600">≈ {formaterMontant(fop_val)}</span>
                  </div>
                  {/* CD */}
                  <div className="flex justify-between items-center py-1.5 border-b border-slate-200 bg-slate-50 rounded px-2">
                    <span className="text-slate-600 text-xs font-semibold">= CD — Coût Direct</span>
                    <span className="font-mono text-xs font-semibold text-slate-700">
                      ≈ {formaterMontant(pv > 0 ? cdReel : cd_val)}
                    </span>
                  </div>
                  {/* FG */}
                  <div className="flex justify-between items-center py-1 border-b border-slate-50">
                    <span className="text-slate-500 text-xs">
                      + FG — Frais Généraux
                      <span className="ml-1 text-slate-400">(médiane 10% PV, plage 8–12%)</span>
                    </span>
                    <span className="font-mono text-xs text-slate-600">
                      {pv > 0 ? fgImplicit : `≈ ${formaterMontant(fg_val)}`}
                    </span>
                  </div>
                  {/* B&A */}
                  <div className="flex justify-between items-center py-1 border-b border-slate-50">
                    <span className="text-slate-500 text-xs">
                      + B&amp;A — Bénéfice &amp; Aléas
                      <span className="ml-1 text-slate-400">(médiane 6% PV, plage 4–8%)</span>
                    </span>
                    <span className="font-mono text-xs text-slate-600">
                      {pv > 0 ? baImplicit : `≈ ${formaterMontant(ba_val)}`}
                    </span>
                  </div>
                  {/* PV */}
                  <div className="flex justify-between items-center py-2 mt-1 bg-indigo-600 rounded-lg px-3 font-bold">
                    <span className="text-white text-sm tracking-wide">
                      {pv > 0 ? "= PV HT" : "≈ PV HT estimé"}
                    </span>
                    <span className="font-mono text-white text-sm">
                      {formaterMontant(pv > 0 ? pv : pvEstime)}
                    </span>
                  </div>
                  {/* Kpv */}
                  <div className="flex justify-between items-center py-1.5 px-2 mt-0.5 bg-slate-100 rounded-md">
                    <span className="text-slate-600 text-xs font-medium">
                      Kpv = PV / DS
                      {pv === 0 && <span className="ml-1 text-slate-400">(estimé)</span>}
                    </span>
                    <span className={clsx("font-mono font-bold text-base", pv > 0 ? infoKpv.classe : "text-slate-400")}>
                      {(pv > 0 ? kpv : kpvEstime).toFixed(3)}
                      <span className="text-xs ml-1 font-normal">
                        ({pv > 0 ? infoKpv.label : "médiane BTP"})
                      </span>
                    </span>
                  </div>
                  {pv > 0 && fopNote && (
                    <p className="text-xs text-slate-500 px-2 italic">{fopNote}</p>
                  )}
                  <p className="text-xs text-slate-400 px-2 italic">
                    Plage normale bâtiment courant : Kpv = 1.25 – 1.55
                  </p>
                </div>
              </section>
            );
          })()}

          {/* ── Informations techniques ── */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">
              Paramètres techniques
            </h3>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
              <dt className="text-slate-400">Taux horaire MO</dt>
              <dd className="font-mono text-slate-700">{toNumber(ligne.cout_horaire_mo) > 0 ? `${formaterMontant(ligne.cout_horaire_mo)}/h` : "—"}</dd>
              <dt className="text-slate-400">Temps MO</dt>
              <dd className="font-mono text-slate-700">{toNumber(ligne.temps_main_oeuvre) > 0 ? `${toNumber(ligne.temps_main_oeuvre).toFixed(4)} h` : "—"}</dd>
              <dt className="text-slate-400">Statut</dt>
              <dd><span className={clsx(STYLES_STATUT[ligne.statut_validation] || "badge-neutre", "text-xs")}>{LIBELLES_STATUT[ligne.statut_validation] || ligne.statut_validation}</span></dd>
              {ligne.lot_cctp_reference_detail && (
                <>
                  <dt className="text-slate-400">Lot CCTP</dt>
                  <dd className="text-slate-600">{ligne.lot_cctp_reference_detail.numero} — {ligne.lot_cctp_reference_detail.intitule}</dd>
                </>
              )}
            </dl>
          </section>
        </div>
      </div>

      {/* Pied */}
      <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-6 py-4">
        <button type="button" onClick={onFermer} className="btn-secondaire text-sm">
          Fermer
        </button>
        <Link href={`/bibliotheque/${ligne.id}`} className="btn-primaire text-sm">
          <Pencil className="h-3.5 w-3.5" />
          Modifier
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Composant principal
// ---------------------------------------------------------------------------

export function OngletPrixBibliotheque() {
  const queryClient = useQueryClient();
  const utilisateur = useSessionStore((etat) => etat.utilisateur);
  const estSuperAdmin = Boolean(utilisateur?.est_super_admin);
  const selecteurFichiersRef = useRef<HTMLInputElement | null>(null);

  const [recherche, setRecherche] = useState("");
  const [filtreStatut, setFiltreStatut] = useState("valide");
  const [filtreLotCCTP, setFiltreLotCCTP] = useState("");
  const [page, setPage] = useState(1);
  const [suppressionId, setSuppressionId] = useState<string | null>(null);
  const [actionGlobale, setActionGlobale] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [ligneDetaillee, setLigneDetaillee] = useState<LigneBibliotheque | null>(null);

  // Suivi progression recalcul
  const [recalculTacheId, setRecalculTacheId] = useState<string | null>(null);
  const [recalculProgression, setRecalculProgression] = useState<{
    statut: string; pourcentage: number; traites: number; total: number;
    message: string; lignes_inversees?: number; lignes_recalculees?: number;
    lignes_ignorees?: number;
  } | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const params = new URLSearchParams({ ordering: "famille,code", page: String(page) });
  if (recherche) params.set("search", recherche);
  if (filtreStatut) params.set("statut_validation", filtreStatut);

  const { data, isLoading, isError } = useQuery<PageResultats>({
    queryKey: ["bibliotheque", recherche, filtreStatut, filtreLotCCTP, page],
    queryFn: () => api.get<PageResultats>(`/api/bibliotheque/?${params.toString()}`),
  });

  const { data: lotsData } = useQuery<LotCCTP[]>({
    queryKey: ["bibliotheque-lots-cctp"],
    queryFn: () => api.get<LotCCTP[]>("/api/bibliotheque/lots-cctp/"),
  });

  const lignes = data?.results ?? [];
  const lots = extraireListeResultats(lotsData as unknown as LotCCTP[] | { results: LotCCTP[] } | null | undefined);

  const invaliderBibliotheque = () => {
    queryClient.invalidateQueries({ queryKey: ["bibliotheque"] });
  };

  const supprimerLigne = async (ligne: LigneBibliotheque) => {
    const confirmation = window.confirm(
      estSuperAdmin
        ? `Supprimer définitivement la ligne ${ligne.code || ligne.designation_courte} ?`
        : `Archiver la ligne ${ligne.code || ligne.designation_courte} ?`
    );
    if (!confirmation) return;

    setSuppressionId(ligne.id);
    setErreur(null);
    try {
      await api.supprimer(`/api/bibliotheque/${ligne.id}/`);
      setSucces(estSuperAdmin ? "Ligne supprimée définitivement." : "Ligne archivée.");
      invaliderBibliotheque();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Impossible de traiter cette ligne.");
    } finally {
      setSuppressionId(null);
    }
  };

  const importerReferentielPartage = async () => {
    setActionGlobale("referentiel");
    setErreur(null);
    try {
      const reponse = await api.post<{
        detail: string; fichiers: number; lignes: number; creees: number; mises_a_jour: number;
      }>("/api/bibliotheque/importer-bordereaux/", {});
      setSucces(
        `${reponse.detail} ${reponse.lignes} ligne(s) traitée(s), ${reponse.creees} créée(s), ${reponse.mises_a_jour} mise(s) à jour.`
      );
      invaliderBibliotheque();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Import du référentiel impossible.");
    } finally {
      setActionGlobale(null);
    }
  };

  const televerserFichiers = async (event: ChangeEvent<HTMLInputElement>) => {
    const fichiers = Array.from(event.target.files ?? []);
    if (fichiers.length === 0) return;

    const limite = window.prompt("Limiter le nombre de lignes importées par fichier ?", "");
    const formData = new FormData();
    fichiers.forEach((fichier) => formData.append("fichiers", fichier));
    if (limite?.trim()) formData.append("limite", limite.trim());

    setActionGlobale("televersement");
    setErreur(null);
    try {
      const reponse = await api.post<{
        detail: string; fichiers: number; fichiers_ignores: number;
        lignes: number; creees: number; mises_a_jour: number;
      }>("/api/bibliotheque/importer-fichiers/", formData);
      setSucces(
        `${reponse.detail} ${reponse.lignes} ligne(s) traitée(s), ${reponse.creees} créée(s), ${reponse.mises_a_jour} mise(s) à jour.`
      );
      invaliderBibliotheque();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Import des fichiers impossible.");
    } finally {
      event.target.value = "";
      setActionGlobale(null);
    }
  };

  // Polling de la progression toutes les 2 secondes
  useEffect(() => {
    if (!recalculTacheId) return;
    intervalRef.current = setInterval(async () => {
      try {
        const prog = await api.get<typeof recalculProgression>(
          `/api/bibliotheque/recalcul-progression/${recalculTacheId}/`
        );
        setRecalculProgression(prog);
        if (prog?.statut === "termine") {
          clearInterval(intervalRef.current!);
          setActionGlobale(null);
          invaliderBibliotheque();
        }
      } catch {
        clearInterval(intervalRef.current!);
        setActionGlobale(null);
      }
    }, 2000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [recalculTacheId]); // eslint-disable-line react-hooks/exhaustive-deps

  const lancerRecalcul = async () => {
    if (!window.confirm(
      "Lancer le recalcul analytique de toute la bibliothèque ?\n\n" +
      "Chaque ligne sera traitée par étude de prix inversée (DS = PV × Kpv)."
    )) return;

    setErreur(null);
    setRecalculProgression(null);
    setActionGlobale("recalcul-global");

    try {
      const reponse = await api.post<{ detail: string; tache_id: string }>(
        "/api/bibliotheque/recalculer-tous/", {}
      );
      setRecalculTacheId(reponse.tache_id);
      setRecalculProgression({
        statut: "en_attente", pourcentage: 0, traites: 0, total: 0,
        message: "Démarrage...",
      });
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Impossible de lancer le recalcul.");
      setActionGlobale(null);
    }
  };

  const fermerModalRecalcul = () => {
    setRecalculTacheId(null);
    setRecalculProgression(null);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const lierAutomatiquement = async () => {
    setActionGlobale("lier-auto");
    setErreur(null);
    try {
      const reponse = await api.post<{ detail: string; liaisons_creees: number }>(
        "/api/bibliotheque/lier-auto/",
        {}
      );
      const nb = reponse.liaisons_creees ?? 0;
      setSucces(
        reponse.detail
          ? reponse.detail
          : `${nb} liaison${nb > 1 ? "s" : ""} créée${nb > 1 ? "s" : ""}.`
      );
      invaliderBibliotheque();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Liaison automatique impossible.");
    } finally {
      setActionGlobale(null);
    }
  };

  const viderBibliotheque = async () => {
    if (!estSuperAdmin) return;
    if (!window.confirm("Vider entièrement la bibliothèque de prix ?")) return;
    setActionGlobale("purge");
    setErreur(null);
    try {
      const reponse = await api.supprimer("/api/bibliotheque/vider/") as {
        detail: string; lignes_supprimees: number;
      };
      setSucces(`${reponse.detail} ${reponse.lignes_supprimees} ligne(s) supprimée(s).`);
      setPage(1);
      invaliderBibliotheque();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Purge impossible.");
    } finally {
      setActionGlobale(null);
    }
  };

  return (
    <>
      <input
        ref={selecteurFichiersRef}
        type="file"
        accept=".pdf,.PDF,.xlsx,.xls"
        multiple
        className="hidden"
        onChange={televerserFichiers}
      />

      {/* Barre de filtres */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            placeholder="Rechercher par code, désignation…"
            className="champ-saisie pl-8"
            value={recherche}
            onChange={(e) => { setRecherche(e.target.value); setPage(1); }}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-slate-400" />
          <select
            className="champ-saisie w-auto"
            value={filtreStatut}
            onChange={(e) => { setFiltreStatut(e.target.value); setPage(1); }}
          >
            <option value="">Tous statuts</option>
            {Object.entries(LIBELLES_STATUT).map(([val, lib]) => (
              <option key={val} value={val}>{lib}</option>
            ))}
          </select>
        </div>
        {lots.length > 0 && (
          <select
            className="champ-saisie w-auto"
            value={filtreLotCCTP}
            onChange={(e) => { setFiltreLotCCTP(e.target.value); setPage(1); }}
          >
            <option value="">Tous lots CCTP</option>
            {lots.map((lot) => (
              <option key={lot.id} value={lot.id}>{lot.numero} — {lot.intitule}</option>
            ))}
          </select>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-secondaire text-sm"
          onClick={() => selecteurFichiersRef.current?.click()}
          disabled={actionGlobale === "televersement"}
        >
          <FileUp className="w-4 h-4" />
          Importer PDF
        </button>
        <button
          type="button"
          className="btn-secondaire text-sm"
          onClick={importerReferentielPartage}
          disabled={actionGlobale === "referentiel"}
        >
          <UploadCloud className="w-4 h-4" />
          Importer référentiel
        </button>
        <button
          type="button"
          className="btn-secondaire text-sm"
          onClick={lierAutomatiquement}
          disabled={actionGlobale === "lier-auto"}
        >
          <DatabaseZap className="w-4 h-4" />
          {actionGlobale === "lier-auto" ? "Liaison en cours…" : "Lier automatiquement"}
        </button>
        <button
          type="button"
          className="btn-secondaire text-sm"
          onClick={lancerRecalcul}
          disabled={actionGlobale === "recalcul-global"}
        >
          <Calculator className="w-4 h-4" />
          {actionGlobale === "recalcul-global" ? "Recalcul en cours…" : "Recalculer"}
        </button>
        <Link href="/documents" className="btn-secondaire text-sm">
          <FileText className="w-4 h-4" />
          GED
        </Link>
        {estSuperAdmin && (
          <button
            type="button"
            className="btn-danger text-sm"
            onClick={viderBibliotheque}
            disabled={actionGlobale === "purge"}
          >
            <Trash2 className="w-4 h-4" />
            Vider
          </button>
        )}
      </div>

      {succes && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {succes}
        </div>
      )}
      {erreur && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {erreur}
        </div>
      )}

      {isLoading ? (
        <div className="py-12 text-center text-slate-400 text-sm">Chargement…</div>
      ) : isError ? (
        <div className="py-12 text-center text-red-500 text-sm">Erreur lors du chargement.</div>
      ) : lignes.length === 0 ? (
        <div className="py-12 text-center text-slate-400 text-sm">
          {recherche || filtreStatut ? "Aucun résultat." : "Bibliothèque vide."}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs text-slate-500">
                <th className="text-left py-2 pr-4 font-medium">Code</th>
                <th className="text-left py-2 pr-4 font-medium">Désignation</th>
                <th className="text-left py-2 pr-4 font-medium">Famille</th>
                <th className="text-center py-2 pr-4 font-medium">Unité</th>
                <th className="text-left py-2 pr-4 font-medium">Déboursé sec</th>
                <th className="text-right py-2 pr-4 font-medium">PV HT</th>
                <th className="text-left py-2 pr-4 font-medium">Statut</th>
                <th className="text-right py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((ligne) => (
                <tr
                  key={ligne.id}
                  className="border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer"
                  onClick={() => setLigneDetaillee(ligne)}
                >
                  <td className="py-3 pr-4 font-mono text-xs text-slate-600">{ligne.code || "—"}</td>
                  <td className="py-3 pr-4 max-w-xs">
                    <span className="font-medium truncate block text-slate-800">
                      {ligne.designation_courte.length > 80
                        ? `${ligne.designation_courte.slice(0, 80)}…`
                        : ligne.designation_courte}
                    </span>
                    {ligne.sous_famille && (
                      <p className="text-xs text-slate-400 mt-0.5">{ligne.sous_famille}</p>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-xs text-slate-500">{ligne.famille || "—"}</td>
                  <td className="py-3 pr-4 text-center font-mono text-xs text-slate-500">{ligne.unite}</td>
                  <td className="py-3 pr-4" onClick={(e) => e.stopPropagation()}>
                    <BarresDS ligne={ligne} />
                  </td>
                  <td className="py-3 pr-4 text-right font-mono text-xs font-medium text-primaire-700">
                    {formaterMontant(ligne.prix_vente_unitaire)}
                  </td>
                  <td className="py-3 pr-4">
                    <span className={clsx(STYLES_STATUT[ligne.statut_validation] || "badge-neutre")}>
                      {LIBELLES_STATUT[ligne.statut_validation] || ligne.statut_validation}
                    </span>
                  </td>
                  <td className="py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <ActionsRapidesAdaptatives
                      actions={[
                        {
                          onClick: () => setLigneDetaillee(ligne),
                          titre: "Voir le détail",
                          icone: Eye,
                        },
                        {
                          href: `/bibliotheque/${ligne.id}`,
                          titre: "Modifier",
                          icone: Pencil,
                          variante: "primaire",
                        },
                        {
                          titre: estSuperAdmin ? "Supprimer" : "Archiver",
                          icone: Trash2,
                          variante: "danger",
                          disabled: suppressionId === ligne.id,
                          onClick: () => supprimerLigne(ligne),
                        },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && data.count > 20 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-slate-400">
            {data.count} ligne{data.count > 1 ? "s" : ""}
          </p>
          <div className="flex gap-2">
            <button
              className="btn-secondaire py-1 px-3 text-xs"
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ← Précédent
            </button>
            <button
              className="btn-secondaire py-1 px-3 text-xs"
              disabled={!data.next}
              onClick={() => setPage((p) => p + 1)}
            >
              Suivant →
            </button>
          </div>
        </div>
      )}

      {/* Panneau latéral de détail */}
      {ligneDetaillee && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/20"
            onClick={() => setLigneDetaillee(null)}
          />
          <PanneauDetailLigne
            ligne={ligneDetaillee}
            onFermer={() => setLigneDetaillee(null)}
          />
        </>
      )}

      {/* Modal de progression du recalcul */}
      {recalculProgression && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
            {/* En-tête */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-primaire-50 p-2">
                  <Calculator className="h-5 w-5 text-primaire-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">Recalcul analytique</h3>
                  <p className="text-xs text-slate-500">Étude de prix inversée analytique</p>
                </div>
              </div>
              {recalculProgression.statut === "termine" && (
                <button
                  type="button"
                  onClick={fermerModalRecalcul}
                  className="rounded-lg p-1.5 hover:bg-slate-100"
                >
                  <X className="h-4 w-4 text-slate-500" />
                </button>
              )}
            </div>

            {/* Barre de progression */}
            <div className="mb-4">
              <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                <span>{recalculProgression.message}</span>
                <span className="font-mono font-medium text-slate-700">
                  {recalculProgression.pourcentage} %
                </span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className={clsx(
                    "h-full rounded-full transition-all duration-500",
                    recalculProgression.statut === "termine"
                      ? "bg-green-500"
                      : "bg-primaire-500"
                  )}
                  style={{ width: `${recalculProgression.pourcentage}%` }}
                />
              </div>
              {recalculProgression.total > 0 && (
                <p className="mt-1 text-xs text-slate-400 text-right">
                  {recalculProgression.traites} / {recalculProgression.total} lignes
                </p>
              )}
            </div>

            {/* Statistiques (affichées en cours et à la fin) */}
            {(recalculProgression.lignes_inversees !== undefined ||
              recalculProgression.lignes_recalculees !== undefined) && (
              <div className="grid grid-cols-3 gap-3 mb-5">
                {recalculProgression.lignes_recalculees !== undefined && (
                  <div className="rounded-xl bg-blue-50 p-3 text-center">
                    <p className="text-lg font-bold text-blue-700">
                      {recalculProgression.lignes_recalculees}
                    </p>
                    <p className="text-xs text-blue-500">Sous-détails</p>
                  </div>
                )}
                {recalculProgression.lignes_inversees !== undefined && (
                  <div className="rounded-xl bg-green-50 p-3 text-center">
                    <p className="text-lg font-bold text-green-700">
                      {recalculProgression.lignes_inversees}
                    </p>
                    <p className="text-xs text-green-500">Inversées</p>
                  </div>
                )}
                {recalculProgression.lignes_ignorees !== undefined && (
                  <div className="rounded-xl bg-slate-50 p-3 text-center">
                    <p className="text-lg font-bold text-slate-500">
                      {recalculProgression.lignes_ignorees}
                    </p>
                    <p className="text-xs text-slate-400">Ignorées</p>
                  </div>
                )}
              </div>
            )}

            {/* Message de fin */}
            {recalculProgression.statut === "termine" && (
              <div className="flex items-center gap-2 rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
                <CheckCircle className="h-4 w-4 shrink-0" />
                Recalcul terminé. Les prix de vente et composantes ont été mis à jour.
              </div>
            )}

            {/* Bouton fermeture */}
            {recalculProgression.statut === "termine" && (
              <button
                type="button"
                onClick={fermerModalRecalcul}
                className="mt-4 w-full btn-primaire justify-center"
              >
                Fermer
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
