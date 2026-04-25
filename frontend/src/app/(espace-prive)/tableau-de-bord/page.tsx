"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { clsx } from "clsx";
import {
  Briefcase,
  Target,
  CheckCircle,
  FolderOpen,
  Plus,
  FileText,
  BarChart2,
  ClipboardList,
  Receipt,
  CalendarDays,
  GitBranch,
  TrendingUp,
  FileCheck,
  Wrench,
  Calculator,
  Activity,
} from "lucide-react";
import { useSessionStore } from "@/crochets/useSession";
import { api } from "@/crochets/useApi";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StatistiquesProjets {
  en_cours: number;
  en_prospection: number;
  termines: number;
  total: number;
}

interface ProjetResume {
  id: string;
  reference: string;
  intitule: string;
  statut: string;
  phase?: string | null;
  organisation_nom: string | null;
  montant_estime: number | null;
  date_modification: string;
}

interface ReponsePaginee {
  results?: ProjetResume[];
}

interface AffectationProjetTableauDeBord {
  id: string;
  nature: string;
  nature_libelle: string;
  code_cible: string;
  libelle_cible: string;
  role: string;
  role_libelle: string;
  commentaires: string;
  date_creation: string;
  date_modification: string;
  projet: {
    id: string;
    reference: string;
    intitule: string;
    statut: string;
    phase_actuelle: string | null;
    responsable_nom: string;
    organisation_nom: string;
  };
}

// ---------------------------------------------------------------------------
// Constantes affichage
// ---------------------------------------------------------------------------

const LIBELLES_STATUT: Record<string, string> = {
  prospection: "Prospection",
  en_cours: "En cours",
  suspendu: "Suspendu",
  termine: "Terminé",
  abandonne: "Abandonné",
  archive: "Archivé",
};

const STYLES_STATUT: Record<string, string> = {
  en_cours: "badge-info",
  termine: "badge-succes",
  suspendu: "badge-alerte",
  abandonne: "badge-danger",
  prospection: "badge-neutre",
  archive: "badge-neutre",
};

const LIBELLES_PHASE: Record<string, string> = {
  esq: "ESQ",
  avp: "AVP",
  pro: "PRO",
  exe: "EXE",
  aps: "APS",
  apd: "APD",
  dce: "DCE",
  act: "ACT",
  visa: "VISA",
  det: "DET",
  aor: "AOR",
};

const STYLES_PHASE: Record<string, string> = {
  esq: "bg-slate-100 text-slate-600",
  avp: "bg-blue-50 text-blue-700",
  aps: "bg-blue-50 text-blue-700",
  apd: "bg-indigo-50 text-indigo-700",
  pro: "bg-violet-50 text-violet-700",
  dce: "bg-amber-50 text-amber-700",
  act: "bg-amber-50 text-amber-700",
  exe: "bg-orange-50 text-orange-700",
  visa: "bg-orange-50 text-orange-700",
  det: "bg-rose-50 text-rose-700",
  aor: "bg-green-50 text-green-700",
};

// ---------------------------------------------------------------------------
// Données chargement
// ---------------------------------------------------------------------------

async function chargerStatistiques(): Promise<StatistiquesProjets> {
  return api.get<StatistiquesProjets>("/api/projets/statistiques/");
}

async function chargerProjetsRecents(): Promise<ProjetResume[]> {
  const donnees = await api.get<ReponsePaginee | ProjetResume[]>(
    "/api/projets/?ordering=-date_modification&page_size=5"
  );
  const liste = (donnees as ReponsePaginee).results ?? (donnees as ProjetResume[]);
  return liste.slice(0, 5);
}

async function chargerMesAffectations(): Promise<AffectationProjetTableauDeBord[]> {
  const donnees = await api.get<{ affectations: AffectationProjetTableauDeBord[] }>(
    "/api/projets/mes-affectations/"
  );
  return donnees.affectations ?? [];
}

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

function formaterDate(valeur: string): string {
  return new Date(valeur).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formaterMontant(valeur: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(valeur);
}

function dateJourEnFrancais(): string {
  return new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Sous-composants
// ---------------------------------------------------------------------------

function TuileStatistique({
  libelle,
  valeur,
  icone: Icone,
  couleurFond,
  couleurTexte,
  href,
  chargement,
}: {
  libelle: string;
  valeur: number | null;
  icone: React.ComponentType<{ size?: number; className?: string }>;
  couleurFond: string;
  couleurTexte: string;
  href: string;
  chargement: boolean;
}) {
  return (
    <Link
      href={href}
      className="carte group flex items-center gap-4 hover:shadow-md transition-shadow"
    >
      <div className={clsx("shrink-0 flex items-center justify-center w-12 h-12 rounded-xl", couleurFond)}>
        <Icone size={22} className={couleurTexte} />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-slate-900">
          {chargement ? (
            <span className="inline-block w-8 h-6 bg-slate-200 rounded animate-pulse" />
          ) : (
            valeur ?? "—"
          )}
        </p>
        <p className="text-sm text-slate-500 mt-0.5">{libelle}</p>
      </div>
    </Link>
  );
}

interface LienRapide {
  libelle: string;
  href: string;
  icone: React.ComponentType<{ size?: number; className?: string }>;
}

function CarteAccesRapide({
  titre,
  couleurBordure,
  couleurTitre,
  couleurIcone,
  liens,
}: {
  titre: string;
  couleurBordure: string;
  couleurTitre: string;
  couleurIcone: string;
  liens: LienRapide[];
}) {
  return (
    <div className={clsx("carte border-t-4", couleurBordure)}>
      <h3 className={clsx("text-sm font-semibold uppercase tracking-wide mb-3", couleurTitre)}>
        {titre}
      </h3>
      <div className="grid grid-cols-2 gap-2">
        {liens.map((lien) => {
          const Ic = lien.icone;
          return (
            <Link
              key={lien.href}
              href={lien.href}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
            >
              <Ic size={14} className={clsx("shrink-0", couleurIcone)} />
              <span className="truncate">{lien.libelle}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Activité récente (données statiques de substitution)
// ---------------------------------------------------------------------------

const ACTIVITE_STATIQUE = [
  { date: "Aujourd'hui", type: "Projet", libelle: "Mise à jour des documents de DCE" },
  { date: "Hier", type: "Document", libelle: "Nouvelle pièce écrite importée" },
  { date: "Il y a 2 jours", type: "Projet", libelle: "Phase EXE démarrée" },
  { date: "Il y a 3 jours", type: "Calcul", libelle: "Révision du bordereau de prix" },
];

// ---------------------------------------------------------------------------
// Page principale
// ---------------------------------------------------------------------------

export default function PageTableauDeBord() {
  const utilisateur = useSessionStore((s) => s.utilisateur);

  const { data: stats, isLoading: chargementStats } = useQuery({
    queryKey: ["statistiques-projets"],
    queryFn: chargerStatistiques,
  });

  const { data: projets = [], isLoading: chargementProjets, isError: erreurProjets } =
    useQuery({
      queryKey: ["projets-recents-tableau-bord"],
      queryFn: chargerProjetsRecents,
    });
  const {
    data: affectations = [],
    isLoading: chargementAffectations,
    isError: erreurAffectations,
  } = useQuery({
    queryKey: ["mes-affectations-projets"],
    queryFn: chargerMesAffectations,
  });

  const prenom = utilisateur?.prenom || utilisateur?.nom_complet || "Bienvenue";

  return (
    <div className="space-y-8 relative pb-20">

      {/* ------------------------------------------------------------------ */}
      {/* BLOC 1 — Bienvenue contextuelle                                     */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Bonjour, {prenom}&nbsp;👋
          </h1>
          <p className="text-sm text-slate-500 mt-1 capitalize">{dateJourEnFrancais()}</p>
        </div>
        <span className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-primaire-50 text-primaire-700 border border-primaire-200">
          <Activity size={12} />
          Bureau d&apos;études économiste
        </span>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* BLOC 2 — Statistiques 4 tuiles                                      */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <TuileStatistique
          libelle="Projets en cours"
          valeur={stats?.en_cours ?? null}
          icone={Briefcase}
          couleurFond="bg-blue-50"
          couleurTexte="text-blue-600"
          href="/projets?statut=en_cours"
          chargement={chargementStats}
        />
        <TuileStatistique
          libelle="En prospection"
          valeur={stats?.en_prospection ?? null}
          icone={Target}
          couleurFond="bg-violet-50"
          couleurTexte="text-violet-600"
          href="/projets?statut=prospection"
          chargement={chargementStats}
        />
        <TuileStatistique
          libelle="Projets terminés"
          valeur={stats?.termines ?? null}
          icone={CheckCircle}
          couleurFond="bg-green-50"
          couleurTexte="text-green-600"
          href="/projets?statut=termine"
          chargement={chargementStats}
        />
        <TuileStatistique
          libelle="Total projets"
          valeur={stats?.total ?? null}
          icone={FolderOpen}
          couleurFond="bg-slate-100"
          couleurTexte="text-slate-600"
          href="/projets"
          chargement={chargementStats}
        />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* BLOC 3 — Accès rapides par contexte                                 */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <CarteAccesRapide
          titre="Maître d'ouvrage public"
          couleurBordure="border-t-blue-500"
          couleurTitre="text-blue-700"
          couleurIcone="text-blue-500"
          liens={[
            { libelle: "Estimation TCE", href: "/bibliotheque", icone: Calculator },
            { libelle: "DPGF", href: "/projets", icone: ClipboardList },
            { libelle: "Analyse d'offres", href: "/projets", icone: BarChart2 },
            { libelle: "DGD", href: "/projets", icone: FileCheck },
          ]}
        />
        <CarteAccesRapide
          titre="Maître d'œuvre"
          couleurBordure="border-t-violet-500"
          couleurTitre="text-violet-700"
          couleurIcone="text-violet-500"
          liens={[
            { libelle: "Honoraires", href: "/projets", icone: Receipt },
            { libelle: "Planning", href: "/projets", icone: CalendarDays },
            { libelle: "OPC", href: "/projets", icone: GitBranch },
            { libelle: "Rapport", href: "/projets", icone: FileText },
          ]}
        />
        <CarteAccesRapide
          titre="Entreprise BTP"
          couleurBordure="border-t-amber-500"
          couleurTitre="text-amber-700"
          couleurIcone="text-amber-500"
          liens={[
            { libelle: "Étude de prix", href: "/bibliotheque", icone: Calculator },
            { libelle: "BPU / DQE", href: "/projets", icone: ClipboardList },
            { libelle: "Marge", href: "/projets", icone: TrendingUp },
            { libelle: "Situation travaux", href: "/projets", icone: Wrench },
          ]}
        />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* BLOC 4 — Mes affectations                                            */}
      {/* ------------------------------------------------------------------ */}
      <div className="carte">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-800">Mes affectations</h2>
          <Link href="/projets" className="text-sm text-primaire-600 hover:underline">
            Voir mes projets →
          </Link>
        </div>

        {chargementAffectations ? (
          <div className="space-y-3 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-slate-100 rounded-lg" />
            ))}
          </div>
        ) : erreurAffectations ? (
          <p className="text-sm text-slate-400 py-6 text-center">
            Impossible de charger les affectations.
          </p>
        ) : affectations.length === 0 ? (
          <p className="text-sm text-slate-400 py-6 text-center">
            Aucune affectation ciblée pour le moment.
          </p>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {affectations.slice(0, 6).map((affectation) => (
              <Link
                key={affectation.id}
                href={`/projets/${affectation.projet.id}`}
                className="rounded-xl border border-slate-200 p-4 hover:border-primaire-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-primaire-700">
                      {affectation.projet.reference}
                    </p>
                    <h3 className="mt-1 font-semibold text-slate-900 truncate">
                      {affectation.projet.intitule}
                    </h3>
                  </div>
                  <span className={clsx(STYLES_STATUT[affectation.projet.statut] || "badge-neutre")}>
                    {LIBELLES_STATUT[affectation.projet.statut] || affectation.projet.statut}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                    {affectation.nature_libelle}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-primaire-50 px-2.5 py-1 text-xs font-medium text-primaire-700">
                    {affectation.role_libelle}
                  </span>
                  {affectation.projet.phase_actuelle ? (
                    <span
                      className={clsx(
                        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
                        STYLES_PHASE[affectation.projet.phase_actuelle] ?? "bg-slate-100 text-slate-600"
                      )}
                    >
                      {LIBELLES_PHASE[affectation.projet.phase_actuelle] ??
                        affectation.projet.phase_actuelle.toUpperCase()}
                    </span>
                  ) : null}
                </div>

                <div className="mt-3 space-y-1 text-sm text-slate-600">
                  <p className="font-medium text-slate-800">{affectation.libelle_cible}</p>
                  {affectation.commentaires ? (
                    <p className="line-clamp-2">{affectation.commentaires}</p>
                  ) : null}
                  <p className="text-xs text-slate-400">
                    Responsable dossier : {affectation.projet.responsable_nom || "—"}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* BLOC 5 — Projets récents enrichis                                   */}
      {/* ------------------------------------------------------------------ */}
      <div className="carte">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-800">Projets récents</h2>
          <Link href="/projets" className="text-sm text-primaire-600 hover:underline">
            Voir tous les projets →
          </Link>
        </div>

        {chargementProjets ? (
          <div className="space-y-3 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-slate-100 rounded-lg" />
            ))}
          </div>
        ) : erreurProjets ? (
          <p className="text-sm text-slate-400 py-6 text-center">
            Impossible de charger les projets.
          </p>
        ) : projets.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-slate-400">Aucun projet pour le moment.</p>
            <Link
              href="/projets/nouveau"
              className="mt-2 inline-block text-sm text-primaire-600 hover:underline"
            >
              Créer le premier projet
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-2 pr-3 font-medium text-slate-500 whitespace-nowrap">Réf.</th>
                  <th className="text-left py-2 pr-3 font-medium text-slate-500">Intitulé</th>
                  <th className="text-left py-2 pr-3 font-medium text-slate-500 whitespace-nowrap">Phase</th>
                  <th className="text-left py-2 pr-3 font-medium text-slate-500">Statut</th>
                  <th className="text-right py-2 pr-3 font-medium text-slate-500 whitespace-nowrap">Montant estimé</th>
                  <th className="text-right py-2 font-medium text-slate-500 whitespace-nowrap">Modifié</th>
                </tr>
              </thead>
              <tbody>
                {projets.map((projet) => (
                  <tr
                    key={projet.id}
                    className="border-b border-slate-50 hover:bg-slate-50 transition-colors"
                  >
                    <td className="py-3 pr-3">
                      <Link
                        href={`/projets/${projet.id}`}
                        className="font-mono text-xs text-primaire-700 hover:underline whitespace-nowrap"
                      >
                        {projet.reference}
                      </Link>
                    </td>
                    <td className="py-3 pr-3 max-w-xs">
                      <Link
                        href={`/projets/${projet.id}`}
                        className="block truncate font-medium text-slate-800 hover:text-primaire-600 transition-colors"
                      >
                        {projet.intitule}
                      </Link>
                      {projet.organisation_nom && (
                        <p className="text-xs text-slate-400 mt-0.5 truncate">
                          {projet.organisation_nom}
                        </p>
                      )}
                    </td>
                    <td className="py-3 pr-3 whitespace-nowrap">
                      {projet.phase ? (
                        <span
                          className={clsx(
                            "inline-block px-2 py-0.5 rounded text-xs font-medium",
                            STYLES_PHASE[projet.phase] ?? "bg-slate-100 text-slate-600"
                          )}
                        >
                          {LIBELLES_PHASE[projet.phase] ?? projet.phase.toUpperCase()}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="py-3 pr-3 whitespace-nowrap">
                      <span className={clsx(STYLES_STATUT[projet.statut] || "badge-neutre")}>
                        {LIBELLES_STATUT[projet.statut] || projet.statut}
                      </span>
                    </td>
                    <td className="py-3 pr-3 text-right font-mono text-slate-700 whitespace-nowrap">
                      {projet.montant_estime ? formaterMontant(projet.montant_estime) : "—"}
                    </td>
                    <td className="py-3 text-right text-slate-400 whitespace-nowrap">
                      {formaterDate(projet.date_modification)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* BLOC 6 — Activité récente                                           */}
      {/* ------------------------------------------------------------------ */}
      <div className="carte">
        <h2 className="text-base font-semibold text-slate-800 mb-4">Activité récente</h2>
        <ul className="space-y-3">
          {ACTIVITE_STATIQUE.map((item, i) => (
            <li key={i} className="flex items-start gap-3 text-sm">
              <span className="shrink-0 mt-0.5 w-2 h-2 rounded-full bg-primaire-400 mt-2" />
              <div className="min-w-0">
                <span className="text-slate-800">{item.libelle}</span>
                <span className="ml-2 text-xs text-slate-400">
                  {item.type} · {item.date}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* FAB — Nouveau projet                                                */}
      {/* ------------------------------------------------------------------ */}
      <Link
        href="/projets/nouveau"
        className="fixed bottom-8 right-8 z-50 inline-flex items-center gap-2 px-4 py-3 rounded-full shadow-lg text-sm font-semibold text-white transition-transform hover:scale-105 active:scale-95"
        style={{ background: "var(--c-base)" }}
        title="Nouveau projet"
      >
        <Plus size={18} />
        <span className="hidden sm:inline">Nouveau projet</span>
      </Link>
    </div>
  );
}
