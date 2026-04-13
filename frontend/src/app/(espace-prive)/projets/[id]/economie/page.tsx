"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { api, ErreurApi } from "@/crochets/useApi";
import {
  ArrowLeft, BadgeEuro, TrendingUp, Calculator, FileText, Users, Building2,
  ChevronRight, AlertCircle, X, BarChart3, Loader2,
} from "lucide-react";
import { ListeEtudesEconomiques } from "@/composants/economie/ListeEtudesEconomiques";
import { ListeEtudesPrix } from "@/composants/economie/ListeEtudesPrix";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Projet {
  id: string;
  reference: string;
  nom: string;
  type_client?: string;
  contexte?: { famille_client?: string };
}

interface ResultatDecomposition {
  debourse_sec_unitaire: number;
  cout_direct_unitaire: number;
  cout_revient_unitaire: number;
  prix_vente_unitaire: number;
  marge_unitaire: number;
  taux_marge_pct: number;
  coefficients: {
    kpv: number;
    k_fc: number;
    k_fg: number;
    k_ba: number;
  };
  composition_ds: {
    main_oeuvre_unitaire: number;
    matieres_unitaire: number;
    materiel_unitaire: number;
    sous_traitance_unitaire: number;
    taux_mo_pct: number;
    taux_matieres_pct: number;
    taux_materiel_pct: number;
    taux_st_pct: number;
  };
  graphique_pyramide: Array<{ label: string; valeur: number; couleur: string }>;
}

const LOTS_SELECTEUR = [
  { valeur: "7.1", libelle: "7.1 — VRD" },
  { valeur: "7.3", libelle: "7.3 — Gros œuvre" },
  { valeur: "7.4", libelle: "7.4 — Charpente bois" },
  { valeur: "7.5", libelle: "7.5 — Couverture" },
  { valeur: "7.6", libelle: "7.6 — Etanchéité" },
  { valeur: "7.7", libelle: "7.7 — Menuiseries ext." },
  { valeur: "7.8", libelle: "7.8 — Menuiseries int." },
  { valeur: "7.9", libelle: "7.9 — Isolation" },
  { valeur: "7.10", libelle: "7.10 — Plâtrerie" },
  { valeur: "7.11", libelle: "7.11 — Revêtements de sol" },
  { valeur: "7.12", libelle: "7.12 — Peinture" },
  { valeur: "7.13", libelle: "7.13 — Électricité" },
  { valeur: "7.14", libelle: "7.14 — Plomberie / Sanitaires" },
  { valeur: "7.15", libelle: "7.15 — CVC" },
  { valeur: "7.16", libelle: "7.16 — Ascenseurs" },
  { valeur: "7.17", libelle: "7.17 — Espaces verts" },
  { valeur: "7.18", libelle: "7.18 — Mobilier" },
];

function detecterTypeClient(projet: Projet): "moa_public" | "moe" | "entreprise" | "generique" {
  const typeClient = (projet.type_client || projet.contexte?.famille_client || "").toLowerCase();
  if (typeClient.includes("public") || typeClient.includes("collectivite") || typeClient.includes("moa")) {
    return "moa_public";
  }
  if (typeClient.includes("moe") || typeClient.includes("architecte") || typeClient.includes("bureau")) {
    return "moe";
  }
  if (typeClient.includes("entreprise") || typeClient.includes("btp") || typeClient.includes("constructeur")) {
    return "entreprise";
  }
  return "generique";
}

function formaterMontant(val: number, decimales = 2): string {
  return val.toLocaleString("fr-FR", { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
}

function BarreDecomposition({ libelle, valeur, total, couleur }: {
  libelle: string;
  valeur: number;
  total: number;
  couleur: string;
}) {
  const largeur = total > 0 ? Math.max(2, (valeur / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-32 shrink-0 text-right text-slate-600">{libelle}</span>
      <div className="flex-1 rounded-full bg-slate-100 h-5 overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${largeur}%`, backgroundColor: couleur }}
        />
      </div>
      <span className="w-20 shrink-0 font-mono text-xs text-slate-700">
        {formaterMontant(valeur)} €
      </span>
      <span className="w-12 shrink-0 text-xs text-slate-400">
        {total > 0 ? `${formaterMontant((valeur / total) * 100, 1)} %` : "—"}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Composant principal
// ---------------------------------------------------------------------------

export default function PageEconomieProjet({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [projet, setProjet] = useState<Projet | null>(null);
  const [chargementProjet, setChargementProjet] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  // Décomposition inverse de prix
  const [prixVente, setPrixVente] = useState("");
  const [lotDecomp, setLotDecomp] = useState("7.3");
  const [decomposition, setDecomposition] = useState<ResultatDecomposition | null>(null);
  const [decompositionEnCours, setDecompositionEnCours] = useState(false);
  const [erreurDecomp, setErreurDecomp] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const donnees = await api.get<Projet>(`/api/projets/${id}/`);
        setProjet(donnees);
      } catch (e) {
        setErreur(e instanceof ErreurApi ? e.detail : "Impossible de charger le projet.");
      } finally {
        setChargementProjet(false);
      }
    })();
  }, [id]);

  const decomposerPrix = async () => {
    const pv = parseFloat(prixVente.replace(",", "."));
    if (!pv || pv <= 0) {
      setErreurDecomp("Saisissez un prix de vente valide.");
      return;
    }
    setDecompositionEnCours(true);
    setErreurDecomp(null);
    setDecomposition(null);
    try {
      const reponse = await api.post<ResultatDecomposition>("/api/economie/decomposer-prix/", {
        prix_vente_unitaire: pv,
        lot_type: lotDecomp,
        methode: "ratios_artiprix",
      });
      setDecomposition(reponse);
    } catch (e) {
      setErreurDecomp(e instanceof ErreurApi ? e.detail : "Erreur lors de la décomposition.");
    } finally {
      setDecompositionEnCours(false);
    }
  };

  const typeClient = projet ? detecterTypeClient(projet) : "generique";

  // Modules selon le type de client
  const modules = {
    moa_public: [
      { libelle: "Estimation TCE", description: "Estimation tous corps d'état en phase amont", href: `/projets/${id}/economie/nouvelle`, icone: <BadgeEuro className="w-5 h-5 text-blue-600" /> },
      { libelle: "DPGF", description: "Décomposition du prix global et forfaitaire", href: `/projets/${id}/pieces-ecrites/nouvelle?type=dpgf`, icone: <FileText className="w-5 h-5 text-indigo-600" /> },
      { libelle: "DQE", description: "Détail quantitatif estimatif", href: `/projets/${id}/pieces-ecrites/nouvelle?type=dqe`, icone: <FileText className="w-5 h-5 text-violet-600" /> },
      { libelle: "Analyse d'offres", description: "Comparatif des offres des entreprises", href: `/projets/${id}/appels-offres`, icone: <BarChart3 className="w-5 h-5 text-emerald-600" /> },
      { libelle: "Suivi DGD", description: "Décompte général définitif (CCAG 2021)", href: `/projets/${id}/execution`, icone: <TrendingUp className="w-5 h-5 text-amber-600" /> },
      { libelle: "Révision de prix", description: "Calcul de la révision selon index BT/TP", href: `/projets/${id}/execution`, icone: <Calculator className="w-5 h-5 text-orange-600" /> },
    ],
    moe: [
      { libelle: "Honoraires MOE", description: "Calcul des honoraires de maîtrise d'œuvre", href: `/projets/${id}/rentabilite`, icone: <BadgeEuro className="w-5 h-5 text-blue-600" /> },
      { libelle: "Planning mission", description: "Phasage de la mission MOE", href: `/projets/${id}/execution`, icone: <TrendingUp className="w-5 h-5 text-emerald-600" /> },
      { libelle: "OPC", description: "Ordonnancement, Pilotage et Coordination", href: `/projets/${id}/execution`, icone: <Users className="w-5 h-5 text-violet-600" /> },
    ],
    entreprise: [
      { libelle: "Étude de prix analytique", description: "DS / FC / FG / B&A jusqu'au PV", href: `/projets/${id}/economie/nouvelle`, icone: <Calculator className="w-5 h-5 text-blue-600" /> },
      { libelle: "BPU / DQE", description: "Bordereau des prix unitaires et quantitatif", href: `/projets/${id}/pieces-ecrites/nouvelle?type=bpu`, icone: <FileText className="w-5 h-5 text-indigo-600" /> },
      { libelle: "Analyse de marge", description: "Rentabilité prévisionnelle et risques", href: `/projets/${id}/rentabilite`, icone: <BarChart3 className="w-5 h-5 text-emerald-600" /> },
    ],
    generique: [],
  }[typeClient];

  const iconeTypeClient = {
    moa_public: <Building2 className="w-5 h-5 text-blue-600" />,
    moe: <Users className="w-5 h-5 text-violet-600" />,
    entreprise: <Calculator className="w-5 h-5 text-emerald-600" />,
    generique: <BadgeEuro className="w-5 h-5 text-slate-400" />,
  }[typeClient];

  const libelleTypeClient = {
    moa_public: "Maître d'ouvrage public",
    moe: "Maître d'œuvre",
    entreprise: "Entreprise BTP",
    generique: "Client générique",
  }[typeClient];

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div>
        <Link
          href={`/projets/${id}`}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-2"
        >
          <ArrowLeft size={14} /> Fiche projet
        </Link>
        <h1>Économie</h1>
        <p className="text-slate-500 mt-1 text-sm">Études économiques et analyses de rentabilité</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`/parametres/couts-main-oeuvre?projet=${id}`} className="btn-secondaire text-sm">
            <BadgeEuro className="w-4 h-4" />
            Paramétrer les taux du projet
          </Link>
          <Link href="/economie/pilotage-activite" className="btn-secondaire text-sm">
            <TrendingUp className="w-4 h-4" />
            Projeter l&apos;activité
          </Link>
        </div>
      </div>

      {erreur && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm p-3">
          <AlertCircle className="w-4 h-4 shrink-0" />{erreur}
          <button onClick={() => setErreur(null)} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Modules selon le type de client */}
      {!chargementProjet && (
        <section className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100">
              {iconeTypeClient}
            </div>
            <div>
              <h2>Modules disponibles</h2>
              <p className="text-sm text-slate-500">Profil client : {libelleTypeClient}</p>
            </div>
          </div>

          {modules.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {modules.map((module) => (
                <Link
                  key={module.libelle}
                  href={module.href}
                  className="carte flex items-start gap-3 p-4 hover:border-primaire-200 hover:bg-primaire-50 transition group"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 group-hover:bg-white transition">
                    {module.icone}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 group-hover:text-primaire-700">{module.libelle}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{module.description}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-primaire-500 shrink-0 mt-3" />
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500 text-center">
              Type de client non identifié — tous les modules sont accessibles via les sections ci-dessous.
            </div>
          )}
        </section>
      )}

      {/* Études économiques */}
      <section className="space-y-3">
        <div>
          <h2>Études économiques</h2>
          <p className="text-sm text-slate-500 mt-1">
            Déboursés, prix de vente, marges et variantes de l&apos;opération.
          </p>
        </div>
        <ListeEtudesEconomiques projetId={id} />
      </section>

      {/* Études de prix */}
      <section className="space-y-3">
        <div>
          <h2>Études de prix analytiques</h2>
          <p className="text-sm text-slate-500 mt-1">
            Sous-détails ressource par ressource rattachés à ce projet, jusqu&apos;à la publication en bibliothèque.
          </p>
        </div>
        <ListeEtudesPrix projetId={id} />
      </section>

      {/* Bloc décomposition inverse de prix */}
      <section className="space-y-4">
        <div>
          <h2>Décomposition inverse de prix</h2>
          <p className="text-sm text-slate-500 mt-1">
            À partir d&apos;un prix de vente unitaire, retrouvez la structure DS / FC / FG / marge.
          </p>
        </div>

        <div className="carte p-6 space-y-5">
          <div className="grid gap-4 sm:grid-cols-[1fr_auto_auto]">
            <div>
              <label className="libelle-champ" htmlFor="prix-vente">
                Prix de vente unitaire (€/unité)
              </label>
              <input
                id="prix-vente"
                type="number"
                min="0"
                step="0.01"
                className="champ-saisie w-full"
                placeholder="1 250,00"
                value={prixVente}
                onChange={(e) => setPrixVente(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void decomposerPrix(); }}
              />
            </div>
            <div>
              <label className="libelle-champ" htmlFor="lot-decomp">
                Lot de référence
              </label>
              <select
                id="lot-decomp"
                className="champ-saisie"
                value={lotDecomp}
                onChange={(e) => setLotDecomp(e.target.value)}
              >
                {LOTS_SELECTEUR.map((l) => (
                  <option key={l.valeur} value={l.valeur}>{l.libelle}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={decomposerPrix}
                disabled={decompositionEnCours || !prixVente}
                className="btn-primaire disabled:opacity-60 whitespace-nowrap"
              >
                {decompositionEnCours
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Calcul…</>
                  : <><Calculator className="w-4 h-4" />Décomposer</>
                }
              </button>
            </div>
          </div>

          {erreurDecomp && (
            <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm p-3">
              <AlertCircle className="w-4 h-4 shrink-0" />{erreurDecomp}
            </div>
          )}

          {decomposition && (
            <div className="space-y-5">
              {/* Tableau de résultats */}
              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      {["DS unitaire", "Charges directes", "Coût de revient", "Prix de vente", "Marge"].map((col) => (
                        <th key={col} className="px-4 py-3 text-left font-semibold text-slate-700">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-100">
                      <td className="px-4 py-3 font-mono">{formaterMontant(decomposition.debourse_sec_unitaire)} €</td>
                      <td className="px-4 py-3 font-mono">{formaterMontant(decomposition.cout_direct_unitaire)} €</td>
                      <td className="px-4 py-3 font-mono">{formaterMontant(decomposition.cout_revient_unitaire)} €</td>
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">{formaterMontant(decomposition.prix_vente_unitaire)} €</td>
                      <td className="px-4 py-3">
                        <span className={`badge-${decomposition.taux_marge_pct >= 5 ? "succes" : decomposition.taux_marge_pct >= 0 ? "alerte" : "danger"}`}>
                          {formaterMontant(decomposition.taux_marge_pct, 1)} %
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Graphique en barres empilées horizontal */}
              <div className="space-y-3">
                <p className="text-sm font-semibold text-slate-700">Structure du prix de vente</p>
                {decomposition.graphique_pyramide.map((item) => (
                  <BarreDecomposition
                    key={item.label}
                    libelle={item.label}
                    valeur={Number(item.valeur)}
                    total={decomposition.prix_vente_unitaire}
                    couleur={item.couleur}
                  />
                ))}
              </div>

              {/* Coefficients */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { libelle: "Kpv", valeur: decomposition.coefficients.kpv },
                  { libelle: "Kfc", valeur: decomposition.coefficients.k_fc },
                  { libelle: "Kfg", valeur: decomposition.coefficients.k_fg },
                  { libelle: "K B&A", valeur: decomposition.coefficients.k_ba },
                ].map((coef) => (
                  <div key={coef.libelle} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{coef.libelle}</p>
                    <p className="mt-1 text-xl font-bold text-slate-800 font-mono">
                      {formaterMontant(coef.valeur, 4)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
