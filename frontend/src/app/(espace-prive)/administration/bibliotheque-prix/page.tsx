"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Calculator,
  CheckCircle,
  FileSpreadsheet,
  Link2,
  RefreshCw,
  UploadCloud,
  X,
} from "lucide-react";
import { api, ErreurApi, extraireListeResultats } from "@/crochets/useApi";
import {
  AlerteAdmin,
  CarteSectionAdmin,
  EntetePageAdmin,
} from "@/composants/administration/Presentation";

interface StatsBibliotheque {
  total: number;
  valides: number;
  a_valider: number;
  brouillons: number;
  avec_sous_details: number;
  sans_prix_vente: number;
  avec_lot_cctp: number;
  sans_lot_cctp: number;
}

interface ProgressionRecalcul {
  statut: string;
  pourcentage: number;
  traites: number;
  total: number;
  message: string;
  lignes_inversees?: number;
  lignes_recalculees?: number;
}

export default function PageAdminBibliothequePrix() {
  const [stats, setStats] = useState<StatsBibliotheque | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  const [action, setAction] = useState<string | null>(null);

  // Recalcul progression
  const [recalculTacheId, setRecalculTacheId] = useState<string | null>(null);
  const [recalculProgression, setRecalculProgression] = useState<ProgressionRecalcul | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Polling progression
  useEffect(() => {
    if (!recalculTacheId) return;
    intervalRef.current = setInterval(async () => {
      try {
        const prog = await api.get<ProgressionRecalcul>(
          `/api/bibliotheque/recalcul-progression/${recalculTacheId}/`
        );
        setRecalculProgression(prog);
        if (prog.statut === "termine" || prog.statut === "erreur") {
          if (intervalRef.current) clearInterval(intervalRef.current);
          setAction(null);
          chargerStats();
        }
      } catch {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setAction(null);
      }
    }, 2000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [recalculTacheId]); // eslint-disable-line react-hooks/exhaustive-deps

  const chargerStats = () => {
    setChargement(true);
    // Chargement en parallèle de plusieurs endpoints
    Promise.all([
      api.get<{ count?: number; results?: unknown[] }>("/api/bibliotheque/?page_size=1"),
      api.get<{ count?: number; results?: unknown[] }>("/api/bibliotheque/?statut_validation=valide&page_size=1"),
      api.get<{ count?: number; results?: unknown[] }>("/api/bibliotheque/?statut_validation=a_valider&page_size=1"),
      api.get<{ count?: number; results?: unknown[] }>("/api/bibliotheque/?statut_validation=brouillon&page_size=1"),
    ])
      .then(([total, valides, aValider, brouillons]) => {
        setStats({
          total: total.count ?? 0,
          valides: valides.count ?? 0,
          a_valider: aValider.count ?? 0,
          brouillons: brouillons.count ?? 0,
          avec_sous_details: 0,
          sans_prix_vente: 0,
          avec_lot_cctp: 0,
          sans_lot_cctp: 0,
        });
      })
      .catch(() => setErreur("Impossible de charger les statistiques."))
      .finally(() => setChargement(false));
  };

  useEffect(() => {
    chargerStats();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const lancerRecalcul = async () => {
    if (!window.confirm(
      "Lancer le recalcul analytique inversé de toute la bibliothèque ?\n\n" +
      "Chaque ligne sera traitée par étude de prix inversée (DS = PV × Kpv) " +
      "La décomposition est calculée par étude de prix inversée (DS = PV × Kpv, ratios par corps d'état)."
    )) return;
    setErreur(null);
    setSucces(null);
    setAction("recalcul");
    setRecalculProgression(null);
    try {
      const reponse = await api.post<{ detail: string; tache_id: string }>(
        "/api/bibliotheque/recalculer-tous/", {}
      );
      setRecalculTacheId(reponse.tache_id);
      setRecalculProgression({
        statut: "en_attente", pourcentage: 0, traites: 0, total: 0, message: "Démarrage...",
      });
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Impossible de lancer le recalcul.");
      setAction(null);
    }
  };

  const lierAutomatiquement = async () => {
    setErreur(null);
    setSucces(null);
    setAction("lier");
    try {
      const reponse = await api.post<{ detail: string; liaisons_creees: number }>(
        "/api/bibliotheque/lier-auto/", {}
      );
      const nb = reponse.liaisons_creees ?? 0;
      setSucces(`${nb} liaison${nb > 1 ? "s" : ""} créée${nb > 1 ? "s" : ""} entre prix et articles CCTP.`);
      chargerStats();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Liaison automatique impossible.");
    } finally {
      setAction(null);
    }
  };

  const STAT_CARTES = stats
    ? [
        { libelle: "Total lignes", valeur: stats.total, couleur: "text-slate-800" },
        { libelle: "Validées", valeur: stats.valides, couleur: "text-green-700" },
        { libelle: "À valider", valeur: stats.a_valider, couleur: "text-amber-700" },
        { libelle: "Brouillons", valeur: stats.brouillons, couleur: "text-slate-500" },
      ]
    : [];

  return (
    <div className="space-y-6">
      <EntetePageAdmin
        titre="Bibliothèque de prix"
        description="Vue d'ensemble des lignes de prix, imports, recalculs et liaisons CCTP."
        statistiques={STAT_CARTES.map((s) => ({
          libelle: s.libelle,
          valeur: chargement ? "…" : s.valeur,
        }))}
        actions={(
          <Link href="/bibliotheque" className="btn-secondaire">
            <BookOpen className="h-4 w-4" />
            Ouvrir la bibliothèque
            <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      />

      {succes && <AlerteAdmin type="succes">{succes}</AlerteAdmin>}
      {erreur && <AlerteAdmin type="erreur">{erreur}</AlerteAdmin>}

      {/* Actions rapides */}
      <CarteSectionAdmin
        titre="Actions de maintenance"
        description="Opérations globales sur la bibliothèque de prix."
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {/* Recalcul analytique */}
          <div className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50">
              <Calculator className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">Recalcul analytique inversé</p>
              <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                Recalcule le déboursé sec de toutes les lignes par étude de prix inversée (DS = PV &times; Kpv) par corps d&apos;état.
              </p>
            </div>
            <button
              onClick={lancerRecalcul}
              disabled={action === "recalcul"}
              className="btn-secondaire justify-center disabled:opacity-60"
            >
              {action === "recalcul" ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  En cours…
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Lancer le recalcul
                </>
              )}
            </button>
          </div>

          {/* Liaison CCTP */}
          <div className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50">
              <Link2 className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">Liaison automatique prix ↔ CCTP</p>
              <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                Relie automatiquement les lignes de prix aux articles CCTP par similarité de texte (≥ 2 mots significatifs).
              </p>
            </div>
            <button
              onClick={lierAutomatiquement}
              disabled={action === "lier"}
              className="btn-secondaire justify-center disabled:opacity-60"
            >
              {action === "lier" ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Liaison en cours…
                </>
              ) : (
                <>
                  <Link2 className="h-4 w-4" />
                  Lier automatiquement
                </>
              )}
            </button>
          </div>

          {/* Import */}
          <div className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50">
              <FileSpreadsheet className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">Importer un bordereau</p>
              <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                Téléverser un fichier Excel ou PDF pour extraire et enrichir la bibliothèque de prix.
              </p>
            </div>
            <Link href="/bibliotheque" className="btn-secondaire justify-center">
              <UploadCloud className="h-4 w-4" />
              Aller à l&apos;import
            </Link>
          </div>
        </div>
      </CarteSectionAdmin>

      {/* Planification automatique */}
      <CarteSectionAdmin
        titre="Planification automatique"
        description="Tâches Celery programmées pour la bibliothèque."
      >
        <div className="space-y-3">
          {[
            {
              heure: "03h30",
              libelle: "Liaison automatique prix ↔ CCTP",
              description: "Relie quotidiennement les lignes sans association CCTP aux articles correspondants.",
              frequence: "Quotidien",
            },
            {
              heure: "03h30",
              libelle: "Nettoyage fichiers temporaires OCR",
              description: "Supprime les fichiers temporaires générés lors des imports PDF.",
              frequence: "Quotidien",
            },
          ].map((tache) => (
            <div key={tache.libelle} className="flex items-center gap-4 rounded-xl border border-slate-100 bg-slate-50 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white border border-slate-200">
                <span className="text-xs font-bold text-slate-700">{tache.heure}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-800">{tache.libelle}</p>
                <p className="mt-0.5 text-xs text-slate-500">{tache.description}</p>
              </div>
              <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                {tache.frequence}
              </span>
            </div>
          ))}
        </div>
      </CarteSectionAdmin>

      {/* Modal progression recalcul */}
      {recalculProgression && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="font-semibold text-slate-900">Recalcul en cours…</h2>
              {recalculProgression.statut === "termine" && (
                <button
                  onClick={() => { setRecalculProgression(null); setRecalculTacheId(null); }}
                  className="rounded-lg p-1.5 hover:bg-slate-100"
                >
                  <X className="h-4 w-4 text-slate-500" />
                </button>
              )}
            </div>
            <div className="p-6 space-y-4">
              {recalculProgression.statut === "termine" && (
                <div className="flex items-center gap-2 text-green-700 text-sm font-medium">
                  <CheckCircle className="h-5 w-5" />
                  Recalcul terminé avec succès
                </div>
              )}
              <div>
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                  <span>{recalculProgression.message}</span>
                  <span className="font-semibold">{recalculProgression.pourcentage} %</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      recalculProgression.statut === "termine" ? "bg-green-500" : "bg-primaire-600"
                    }`}
                    style={{ width: `${recalculProgression.pourcentage}%` }}
                  />
                </div>
                {recalculProgression.total > 0 && (
                  <p className="mt-1.5 text-xs text-slate-400 text-right">
                    {recalculProgression.traites} / {recalculProgression.total} lignes
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
