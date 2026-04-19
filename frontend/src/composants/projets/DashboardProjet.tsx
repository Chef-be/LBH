"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  RadialBarChart, RadialBar, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
} from "recharts";
import {
  FileText, BarChart2, Layers, PenTool, Hammer, Search,
  TrendingUp, ChevronDown, ChevronUp, Euro, Calendar,
  MapPin, Building2, ExternalLink, Plus, FolderOpen, ReceiptText,
  ChevronRight, AlertTriangle, Wand2, Settings2,
} from "lucide-react";
import { api, ErreurApi } from "@/crochets/useApi";
import { PanneauMissionsLivrables, MissionProjet } from "./PanneauMissionsLivrables";
import { ModalGenererDocument } from "@/composants/documents/ModalGenererDocument";
import { ModalGererMissionsProjet } from "./ModalGererMissionsProjet";
import { ModalConfirmation } from "@/composants/ui/ModalConfirmation";
import { useNotifications } from "@/contextes/FournisseurNotifications";

/* ────────────────────────────────────────────────────────────
   TYPES
────────────────────────────────────────────────────────────── */
interface DevisResume {
  id: string;
  reference: string;
  intitule: string;
  statut: string;
  montant_ttc: string;
  date_emission: string;
  client_nom: string;
}

interface FactureResume {
  id: string;
  reference: string;
  client_nom: string;
  statut: string;
  montant_ttc: string;
  montant_restant: string;
  est_en_retard: boolean;
  date_echeance: string;
}

interface SyntheseProjet {
  nb_documents: number;
  nb_etudes_economiques: number;
  total_prix_vente_etudes: number;
  total_marge_nette_etudes?: number;
  phase_index: number;      // 0-9
  phase_code: string;
  phase_libelle: string;
  activite_recente: Array<{
    date: string;
    type: string;
    libelle: string;
    utilisateur: string;
  }>;
}

interface PhaseSuggeree {
  code: string;
  libelle: string;
  raison: string;
  indices: string[];
  differe: boolean;
  avancee_superieure: boolean;
  phase_actuelle: string;
  phase_actuelle_libelle: string;
}

interface ProjetDetail {
  id: string;
  reference: string;
  intitule: string;
  statut: string;
  statut_libelle: string;
  type_libelle: string;
  phase_actuelle: string;
  phase_libelle: string;
  phase_suggeree?: PhaseSuggeree | null;
  organisation_nom: string | null;
  maitre_ouvrage_nom: string | null;
  maitre_oeuvre_nom: string | null;
  responsable_nom: string;
  commune: string;
  departement: string;
  date_debut_prevue: string | null;
  date_fin_prevue: string | null;
  montant_estime: number | null;
  montant_marche: number | null;
  description: string;
  contexte_projet: {
    famille_client: { code: string; libelle: string };
    nature_ouvrage: string;
    nature_marche: string;
    missions_associees: Array<{ code: string; libelle: string }>;
    sous_missions: Array<{ code: string; libelle: string }>;
    partie_contractante: string;
    role_lbh: string;
    methode_estimation: string;
  } | null;
  processus_recommande: {
    points_de_controle: string[];
    methodes_estimation: Array<{ code: string; libelle: string; objectif: string }>;
    livrables_prioritaires: string[];
    indicateurs_clefs: string[];
  };
  dossiers_ged: Array<{ code: string; intitule: string; description: string }>;
  statuts_livrables: Record<string, string>;
}

/* ────────────────────────────────────────────────────────────
   HELPERS
────────────────────────────────────────────────────────────── */
const PHASES_CYCLE = ["faisabilite", "programmation", "esquisse", "avp", "pro", "dce", "ao", "exe", "reception", "clos"];
const LABELS_PHASES: Record<string, string> = {
  faisabilite: "Faisabilité",
  programmation: "Programmation",
  esquisse: "ESQ",
  avp: "AVP",
  pro: "PRO",
  dce: "DCE",
  ao: "AO",
  exe: "EXE",
  reception: "AOR",
  clos: "Clos",
};

function formaterMontant(val: number | null, zero = "—"): string {
  if (val == null || val === 0) return zero;
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(2)}M€`;
  if (val >= 1_000) return `${Math.round(val / 1_000)} k€`;
  return `${val.toLocaleString("fr-FR")} €`;
}

function formaterDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/* ────────────────────────────────────────────────────────────
   TUILE KPI
────────────────────────────────────────────────────────────── */
function TuileKpi({
  icone, label, valeur, sous, couleur = "var(--c-base)",
}: {
  icone: React.ReactNode; label: string; valeur: string; sous?: string; couleur?: string;
}) {
  return (
    <div
      className="rounded-xl p-4"
      style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--texte-3)" }}>{label}</p>
          <p className="text-xl font-bold mt-1" style={{ color: "var(--texte)" }}>{valeur}</p>
          {sous && <p className="text-xs mt-0.5" style={{ color: "var(--texte-2)" }}>{sous}</p>}
        </div>
        <span
          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: `color-mix(in srgb, ${couleur} 12%, var(--fond-app))`, color: couleur }}
        >
          {icone}
        </span>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   GAUGE PHASE
────────────────────────────────────────────────────────────── */
function GaugePhase({ phaseIndex, phaseLibelle }: { phaseIndex: number; phaseLibelle: string }) {
  const pct = Math.round(((phaseIndex + 1) / PHASES_CYCLE.length) * 100);
  const data = [{ name: "phase", valeur: pct, fill: "var(--c-base)" }];

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-36 h-24">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            cx="50%" cy="100%"
            innerRadius="76%" outerRadius="100%"
            startAngle={180} endAngle={0}
            data={data}
          >
            <RadialBar dataKey="valeur" cornerRadius={4} background={{ fill: "var(--fond-entree)" }} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-x-0 bottom-3 flex justify-center">
          <span
            className="rounded-full px-2 py-0.5 text-sm font-bold leading-none"
            style={{ color: "var(--c-base)", background: "var(--fond-carte)" }}
          >
            {pct}%
          </span>
        </div>
      </div>
      <p className="text-xs font-semibold mt-1" style={{ color: "var(--texte)" }}>{phaseLibelle || "—"}</p>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   TIMELINE PHASES
────────────────────────────────────────────────────────────── */
function TimelinePhases({ phaseActuelle }: { phaseActuelle: string }) {
  const idxActuel = PHASES_CYCLE.indexOf(phaseActuelle);

  return (
    <div className="flex items-center gap-0 overflow-x-auto pb-1">
      {PHASES_CYCLE.map((phase, i) => {
        const fait = i < idxActuel;
        const actif = i === idxActuel;
        const dernier = i === PHASES_CYCLE.length - 1;
        return (
          <div key={phase} className="flex items-center flex-shrink-0">
            <div className="flex flex-col items-center gap-1">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold"
                style={{
                  background: fait ? "rgb(16,185,129)" : actif ? "var(--c-base)" : "var(--fond-entree)",
                  color: fait || actif ? "white" : "var(--texte-3)",
                  border: fait || actif ? "none" : "1px solid var(--bordure)",
                }}
              >
                {i + 1}
              </div>
              <span
                className="text-[9px] text-center leading-none whitespace-nowrap"
                style={{ color: actif ? "var(--c-base)" : fait ? "rgb(16,185,129)" : "var(--texte-3)" }}
              >
                {LABELS_PHASES[phase] ?? phase}
              </span>
            </div>
            {!dernier && (
              <div
                className="w-5 h-0.5 mb-3 flex-shrink-0"
                style={{ background: fait ? "rgb(16,185,129)" : "var(--bordure)" }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   CARTE MODULE
────────────────────────────────────────────────────────────── */
function CarteModule({
  href, icone, titre, nb, libelle, couleur = "var(--c-base)", actif = true,
}: {
  href: string; icone: React.ReactNode; titre: string;
  nb?: number; libelle?: string; couleur?: string; actif?: boolean;
}) {
  if (!actif) return null;
  return (
    <Link
      href={href}
      className="group rounded-xl p-4 transition-all duration-200 hover:shadow-md flex flex-col gap-3"
      style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}
    >
      <div className="flex items-center justify-between">
        <span
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: `color-mix(in srgb, ${couleur} 12%, var(--fond-app))`, color: couleur }}
        >
          {icone}
        </span>
        <ExternalLink size={12} style={{ color: "var(--texte-3)" }} className="opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <div>
        <p className="text-sm font-semibold" style={{ color: "var(--texte)" }}>{titre}</p>
        {nb !== undefined && (
          <p className="text-xl font-bold mt-0.5" style={{ color: couleur }}>{nb}</p>
        )}
        {libelle && <p className="text-xs mt-0.5" style={{ color: "var(--texte-2)" }}>{libelle}</p>}
      </div>
    </Link>
  );
}

/* ────────────────────────────────────────────────────────────
   ACCORDÉON PROCESSUS
────────────────────────────────────────────────────────────── */
function AccordeonProcessus({
  titre, items, icone, actions = [],
}: {
  titre: string;
  items: string[];
  icone: React.ReactNode;
  actions?: Array<{ href: string; libelle: string }>;
}) {
  const [ouvert, setOuvert] = useState(false);
  if (items.length === 0) return null;
  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ borderColor: "var(--bordure)" }}
    >
      <button
        type="button"
        onClick={() => setOuvert(!ouvert)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-[color:var(--fond-entree)] transition-colors"
      >
        <div className="flex items-center gap-2">
          <span style={{ color: "var(--c-base)" }}>{icone}</span>
          <span className="text-sm font-semibold" style={{ color: "var(--texte)" }}>{titre}</span>
          <span
            className="text-xs px-1.5 py-0.5 rounded-full"
            style={{ background: "var(--fond-entree)", color: "var(--texte-3)", border: "1px solid var(--bordure)" }}
          >
            {items.length}
          </span>
        </div>
        {ouvert ? <ChevronUp size={14} style={{ color: "var(--texte-3)" }} /> : <ChevronDown size={14} style={{ color: "var(--texte-3)" }} />}
      </button>
      {ouvert && (
        <div className="px-4 pb-4 pt-1 border-t space-y-3" style={{ borderColor: "var(--bordure)" }}>
          <ul className="space-y-2">
            {items.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm" style={{ color: "var(--texte-2)" }}>
                <span className="mt-1.5 w-1 h-1 rounded-full flex-shrink-0" style={{ background: "var(--c-base)" }} />
                {item}
              </li>
            ))}
          </ul>
          {actions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {actions.map((action) => (
                <Link
                  key={`${titre}-${action.href}-${action.libelle}`}
                  href={action.href}
                  className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                  style={{ background: "var(--c-clair)", color: "var(--c-base)", border: "1px solid var(--c-leger)" }}
                >
                  {action.libelle}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   GRAPHIQUE FINANCIER
────────────────────────────────────────────────────────────── */
function GrafiqueFinancier({
  montantEstime, montantMarche, totalEtudes, totalDevis, totalFacture,
}: {
  montantEstime: number | null;
  montantMarche: number | null;
  totalEtudes: number;
  totalDevis: number;
  totalFacture: number;
}) {
  const donnees = [
    { label: "Estimé", valeur: montantEstime ?? 0, couleur: "var(--c-base)" },
    { label: "Marché", valeur: montantMarche ?? 0, couleur: "#8b5cf6" },
    { label: "Études", valeur: totalEtudes, couleur: "#0f766e" },
    { label: "Devis", valeur: totalDevis, couleur: "#f59e0b" },
    { label: "Facturé", valeur: totalFacture, couleur: "#10b981" },
  ].filter((d) => d.valeur > 0);

  if (donnees.length === 0) {
    return (
      <div
        className="rounded-xl p-5"
        style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}
      >
        <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--texte-3)" }}>
          Synthèse financière
        </p>
        <p className="text-sm" style={{ color: "var(--texte-2)" }}>
          Aucune donnée financière consolidée n&apos;est encore disponible pour ce projet.
        </p>
      </div>
    );
  }

  const max = Math.max(...donnees.map((d) => d.valeur));

  return (
    <div
      className="rounded-xl p-5"
      style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}
    >
      <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: "var(--texte-3)" }}>
        Synthèse financière
      </p>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={donnees} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "var(--texte-3)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[0, max * 1.15]}
              tickFormatter={(v: number) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1_000 ? `${Math.round(v / 1_000)}k` : String(v)}
              tick={{ fontSize: 9, fill: "var(--texte-3)" }}
              axisLine={false}
              tickLine={false}
              width={36}
            />
            <Tooltip
              contentStyle={{
                background: "var(--fond-carte)",
                border: "1px solid var(--bordure)",
                borderRadius: 8,
                fontSize: 11,
                color: "var(--texte)",
              }}
              formatter={(v) => [`${Number(v).toLocaleString("fr-FR")} €`, ""]}
              cursor={{ fill: "var(--fond-entree)" }}
            />
            <Bar dataKey="valeur" radius={[4, 4, 0, 0]}>
              {donnees.map((d, i) => (
                <Cell key={i} fill={d.couleur} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   COMPOSANT PRINCIPAL
────────────────────────────────────────────────────────────── */
const STATUTS_DEVIS: Record<string, { couleur: string; label: string }> = {
  brouillon: { couleur: "var(--texte-3)", label: "Brouillon" },
  envoye: { couleur: "#f59e0b", label: "Envoyé" },
  accepte: { couleur: "#10b981", label: "Accepté" },
  refuse: { couleur: "#ef4444", label: "Refusé" },
  expire: { couleur: "#6b7280", label: "Expiré" },
};

const STATUTS_FACTURE: Record<string, { couleur: string; label: string }> = {
  brouillon: { couleur: "var(--texte-3)", label: "Brouillon" },
  emise: { couleur: "#3b82f6", label: "Émise" },
  en_retard: { couleur: "#ef4444", label: "En retard" },
  partiellement_payee: { couleur: "#f59e0b", label: "Part. payée" },
  payee: { couleur: "#10b981", label: "Payée" },
  annulee: { couleur: "var(--texte-3)", label: "Annulée" },
};

export function DashboardProjet({ projet }: { projet: ProjetDetail }) {
  const queryClient = useQueryClient();
  const notifications = useNotifications();
  const [modalePhaseOuverte, setModalePhaseOuverte] = useState(false);
  const [applicationPhaseEnCours, setApplicationPhaseEnCours] = useState(false);

  const { data: synthese } = useQuery<SyntheseProjet>({
    queryKey: ["projet-synthese", projet.id],
    queryFn: () => api.get<SyntheseProjet>(`/api/projets/${projet.id}/synthese/`),
    staleTime: 60_000,
  });

  const { data: devisProjet = [] } = useQuery<DevisResume[]>({
    queryKey: ["devis-projet", projet.id],
    queryFn: async () => {
      const r = await api.get<{ results?: DevisResume[] } | DevisResume[]>(`/api/societe/devis/?projet=${projet.id}`);
      return Array.isArray(r) ? r : (r.results ?? []);
    },
    staleTime: 60_000,
  });

  const { data: facturesProjet = [] } = useQuery<FactureResume[]>({
    queryKey: ["factures-projet", projet.id],
    queryFn: async () => {
      const r = await api.get<{ results?: FactureResume[] } | FactureResume[]>(`/api/societe/factures/?projet=${projet.id}`);
      return Array.isArray(r) ? r : (r.results ?? []);
    },
    staleTime: 60_000,
  });

  const idProjet = projet.id;
  const contexte = projet.contexte_projet;
  const processus = projet.processus_recommande;
  const familleClient = contexte?.famille_client?.code || "";
  const natureOuvrage = contexte?.nature_ouvrage || "";

  const missionsCodes = new Set([
    ...(contexte?.missions_associees ?? []).map((m) => m.code),
    ...(contexte?.sous_missions ?? []).map((s) => s.code),
  ]);

  const { data: missionsDonnees = [] } = useQuery<MissionProjet[]>({
    queryKey: ["missions-livrables", familleClient],
    queryFn: () => api.get<MissionProjet[]>(`/api/projets/missions-livrables/?famille_client=${familleClient}`),
    enabled: !!familleClient && missionsCodes.size > 0,
    staleTime: 300_000,
  });

  // Statuts de livrables initiaux depuis le serveur, mis à jour localement
  const [statutsLocaux, setStatutsLocaux] = useState<Record<string, string>>(
    () => projet.statuts_livrables ?? {}
  );

  const mutationStatutLivrable = useMutation({
    mutationFn: (payload: Record<string, string>) =>
      api.patch<Record<string, string>>(`/api/projets/${projet.id}/statuts-livrables/`, payload),
    onSuccess: (data) => setStatutsLocaux(data),
  });

  const changerStatutLivrable = useCallback(
    (missionCode: string, livrableCode: string, statut: string) => {
      const cle = `${missionCode}:${livrableCode}`;
      setStatutsLocaux((prev) => ({ ...prev, [cle]: statut }));
      mutationStatutLivrable.mutate({ [cle]: statut });
    },
    [mutationStatutLivrable]
  );

  // Injecter les statuts persistés dans les livrables de chaque mission
  const missionsProjet: MissionProjet[] = missionsDonnees
    .filter((m) => missionsCodes.has(m.code))
    .map((m) => ({
      ...m,
      livrables: m.livrables.map((l) => ({
        ...l,
        statut: (statutsLocaux[`${m.code}:${l.code}`] as MissionProjet["livrables"][number]["statut"]) ?? l.statut,
      })),
    }));

  const [modaleDocumentOuverte, setModaleDocumentOuverte] = useState(false);
  const [modaleGestionMissionsOuverte, setModaleGestionMissionsOuverte] = useState(false);

  const totalDevis = devisProjet.reduce((s, d) => s + parseFloat(d.montant_ttc || "0"), 0);
  const totalFacture = facturesProjet.reduce((s, f) => s + (parseFloat(f.montant_ttc || "0") - parseFloat(f.montant_restant || "0")), 0);
  const totalEtudes = synthese?.total_prix_vente_etudes ?? 0;

  const estEntreprise = familleClient === "entreprise";
  const estMOE = familleClient === "maitrise_oeuvre";
  const estMOA = familleClient === "maitrise_ouvrage";
  const afficherInfra = natureOuvrage === "infrastructure" || natureOuvrage === "mixte";
  const afficherBatiment = natureOuvrage === "batiment" || natureOuvrage === "mixte" || !natureOuvrage;

  const codesMission = new Set([
    ...(contexte?.missions_associees ?? []).map((m) => m.code),
    ...(contexte?.sous_missions ?? []).map((s) => s.code),
  ]);

  const afficherPiecesEcrites =
    estMOE || estMOA ||
    ["redaction_cctp", "redaction_bpu", "redaction_dpgf", "redaction_pieces_marche_infrastructure"].some((c) => codesMission.has(c));
  const afficherExecution =
    ["exe", "visa", "det", "opc", "aor"].some((c) => codesMission.has(c));
  const afficherAppelsOffres =
    ["act", "rapport_analyse_offres", "reponse_appel_offres"].some((c) => codesMission.has(c));
  const afficherRentabilite = estEntreprise;

  const phaseActuelle = projet.phase_actuelle || synthese?.phase_code || "";
  const phaseIndex = synthese?.phase_index ?? PHASES_CYCLE.indexOf(phaseActuelle);
  const phaseSuggeree = projet.phase_suggeree ?? null;
  const afficherSuggestionPhase = Boolean(phaseSuggeree?.code && phaseSuggeree.differe);

  async function appliquerPhaseSuggeree() {
    setApplicationPhaseEnCours(true);
    try {
      const reponse = await api.post<{ detail: string }>(
        `/api/projets/${projet.id}/phase-suggeree/appliquer/`,
        {}
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["projet", projet.id] }),
        queryClient.invalidateQueries({ queryKey: ["projet-synthese", projet.id] }),
        queryClient.invalidateQueries({ queryKey: ["projets"] }),
      ]);
      notifications.succes(reponse.detail || `Phase mise à jour en ${phaseSuggeree?.libelle}.`);
      setModalePhaseOuverte(false);
    } catch (erreur) {
      notifications.erreur(
        erreur instanceof ErreurApi
          ? erreur.detail
          : "Impossible d'appliquer la phase suggérée."
      );
    } finally {
      setApplicationPhaseEnCours(false);
    }
  }

  return (
    <div className="space-y-6">
      {afficherSuggestionPhase && phaseSuggeree && (
        <section
          className="rounded-2xl border p-5"
          style={{
            background: "color-mix(in srgb, var(--c-base) 8%, white)",
            borderColor: "color-mix(in srgb, var(--c-base) 28%, var(--bordure))",
          }}
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--texte-3)" }}>
                Phase suggérée
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="badge-neutre">
                  {phaseSuggeree.phase_actuelle_libelle || "Non définie"}
                </span>
                <ChevronRight size={14} style={{ color: "var(--texte-3)" }} />
                <span className="badge-info">{phaseSuggeree.libelle}</span>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: "var(--texte-2)" }}>
                {phaseSuggeree.raison}
              </p>
              {phaseSuggeree.indices.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {phaseSuggeree.indices.map((indice) => (
                    <span
                      key={indice}
                      className="rounded-full px-2.5 py-1 text-xs"
                      style={{
                        background: "rgba(255, 255, 255, 0.72)",
                        border: "1px solid var(--bordure)",
                        color: "var(--texte-2)",
                      }}
                    >
                      {indice}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setModalePhaseOuverte(true)}
              className="btn-primaire"
            >
              Appliquer la suggestion
            </button>
          </div>
        </section>
      )}

      {/* ── KPIs ── */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <TuileKpi
          icone={<Euro size={16} />}
          label="Budget estimé"
          valeur={formaterMontant(projet.montant_estime)}
          sous={projet.montant_marche ? `Marché : ${formaterMontant(projet.montant_marche)}` : undefined}
          couleur="var(--c-base)"
        />
        <TuileKpi
          icone={<BarChart2 size={16} />}
          label="Études économiques"
          valeur={String(synthese?.nb_etudes_economiques ?? "—")}
          sous={synthese?.total_prix_vente_etudes ? `Total PV : ${formaterMontant(synthese.total_prix_vente_etudes)}` : undefined}
          couleur="#8b5cf6"
        />
        <TuileKpi
          icone={<FileText size={16} />}
          label="Documents GED"
          valeur={String(synthese?.nb_documents ?? "—")}
          sous={`${projet.dossiers_ged.length} dossier${projet.dossiers_ged.length > 1 ? "s" : ""} configuré${projet.dossiers_ged.length > 1 ? "s" : ""}`}
          couleur="#f59e0b"
        />
        <TuileKpi
          icone={<Calendar size={16} />}
          label="Calendrier"
          valeur={formaterDate(projet.date_debut_prevue)}
          sous={projet.date_fin_prevue ? `Fin prévue : ${formaterDate(projet.date_fin_prevue)}` : undefined}
          couleur="#10b981"
        />
      </div>

      {/* ── Progression + Infos ── */}
      <div className="grid gap-6 lg:grid-cols-3">

        {/* Gauge + timeline */}
        <div
          className="rounded-xl p-5 flex flex-col gap-5"
          style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}
        >
          <div>
            <p className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: "var(--texte-3)" }}>
              Phase actuelle
            </p>
            <GaugePhase
              phaseIndex={phaseIndex}
              phaseLibelle={synthese?.phase_libelle ?? projet.phase_libelle ?? "—"}
            />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: "var(--texte-3)" }}>
              Cycle de vie
            </p>
            <TimelinePhases phaseActuelle={phaseActuelle} />
          </div>
        </div>

        {/* Informations projet */}
        <div
          className="lg:col-span-2 rounded-xl p-5"
          style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}
        >
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--texte-3)" }}>
              Identification
            </p>
            <Link
              href={`/projets/${idProjet}/modifier`}
              className="text-xs underline"
              style={{ color: "var(--texte-3)" }}
            >
              Modifier
            </Link>
          </div>
          <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
            {projet.organisation_nom && (
              <div>
                <dt className="flex items-center gap-1 text-xs" style={{ color: "var(--texte-3)" }}>
                  <Building2 size={11} /> Bureau d&apos;études
                </dt>
                <dd className="font-medium mt-0.5" style={{ color: "var(--texte)" }}>{projet.organisation_nom}</dd>
              </div>
            )}
            {projet.maitre_ouvrage_nom && (
              <div>
                <dt className="text-xs" style={{ color: "var(--texte-3)" }}>Maître d&apos;ouvrage</dt>
                <dd className="font-medium mt-0.5" style={{ color: "var(--texte)" }}>{projet.maitre_ouvrage_nom}</dd>
              </div>
            )}
            {(projet.commune || projet.departement) && (
              <div>
                <dt className="flex items-center gap-1 text-xs" style={{ color: "var(--texte-3)" }}>
                  <MapPin size={11} /> Localisation
                </dt>
                <dd className="font-medium mt-0.5" style={{ color: "var(--texte)" }}>
                  {[projet.commune, projet.departement ? `(${projet.departement})` : ""].filter(Boolean).join(" ")}
                </dd>
              </div>
            )}
            <div>
              <dt className="text-xs" style={{ color: "var(--texte-3)" }}>Type</dt>
              <dd className="font-medium mt-0.5" style={{ color: "var(--texte)" }}>{projet.type_libelle}</dd>
            </div>
            {contexte?.role_lbh && (
              <div>
                <dt className="text-xs" style={{ color: "var(--texte-3)" }}>Rôle LBH</dt>
                <dd className="font-medium mt-0.5" style={{ color: "var(--texte)" }}>{contexte.role_lbh}</dd>
              </div>
            )}
            {contexte?.methode_estimation && (
              <div>
                <dt className="text-xs" style={{ color: "var(--texte-3)" }}>Méthode estimation</dt>
                <dd className="font-medium mt-0.5" style={{ color: "var(--texte)" }}>{contexte.methode_estimation}</dd>
              </div>
            )}
          </dl>
          {projet.description && (
            <p className="mt-4 text-sm leading-relaxed" style={{ color: "var(--texte-2)", borderTop: "1px solid var(--bordure)", paddingTop: "1rem" }}>
              {projet.description}
            </p>
          )}
        </div>
      </div>

      {/* ── Modules ── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--texte-3)" }}>
            Modules
          </h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <CarteModule
            href={`/projets/${idProjet}/economie`}
            icone={<BarChart2 size={16} />}
            titre="Études économiques"
            nb={synthese?.nb_etudes_economiques}
            libelle={synthese?.total_prix_vente_etudes ? formaterMontant(synthese.total_prix_vente_etudes, "0 €") + " PV" : "Aucune étude"}
            couleur="#8b5cf6"
          />
          <CarteModule
            href={`/projets/${idProjet}/documents`}
            icone={<FolderOpen size={16} />}
            titre="Documents GED"
            nb={synthese?.nb_documents}
            libelle="Documents du projet"
            couleur="#f59e0b"
          />
          <CarteModule
            href={`/projets/${idProjet}/pieces-ecrites`}
            icone={<PenTool size={16} />}
            titre="Pièces écrites"
            libelle="CCTP, BPU, DPGF…"
            couleur="#6366f1"
            actif={afficherPiecesEcrites}
          />
          <CarteModule
            href={`/projets/${idProjet}/metres`}
            icone={<Layers size={16} />}
            titre="Métrés"
            libelle={afficherInfra ? "Bâtiment + VRD" : afficherBatiment ? "Métrés bâtiment" : "Métrés"}
            couleur="var(--c-base)"
          />
          <CarteModule
            href={`/projets/${idProjet}/appels-offres`}
            icone={<Search size={16} />}
            titre="Appels d&apos;offres"
            libelle="Analyse des offres"
            couleur="#10b981"
            actif={afficherAppelsOffres}
          />
          <CarteModule
            href={`/projets/${idProjet}/execution`}
            icone={<Hammer size={16} />}
            titre="Exécution"
            libelle="Suivi de chantier"
            couleur="#f97316"
            actif={afficherExecution}
          />
          <CarteModule
            href={`/projets/${idProjet}/rentabilite`}
            icone={<TrendingUp size={16} />}
            titre="Rentabilité"
            libelle="Analyse financière"
            couleur="#ef4444"
            actif={afficherRentabilite}
          />
        </div>
      </section>

      {/* ── Missions & Livrables ── */}
      {(missionsProjet.length > 0 || familleClient) && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--texte-3)" }}>
              Missions &amp; Livrables
            </h3>
            {familleClient && (
              <button
                type="button"
                onClick={() => setModaleGestionMissionsOuverte(true)}
                className="flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-[color:var(--fond-entree)]"
                style={{ borderColor: "var(--bordure)", color: "var(--texte-3)" }}
              >
                <Settings2 size={12} /> Gérer
              </button>
            )}
          </div>
          {missionsProjet.length > 0 ? (
            <PanneauMissionsLivrables
              missions={missionsProjet}
              familleClient={familleClient}
              onChangerStatutLivrable={changerStatutLivrable}
            />
          ) : (
            <div
              className="rounded-xl border py-10 flex flex-col items-center gap-3 text-center"
              style={{ background: "var(--fond-entree)", borderColor: "var(--bordure)", borderStyle: "dashed" }}
            >
              <p className="text-xs font-medium" style={{ color: "var(--texte-3)" }}>
                Aucune mission associée à ce projet.
              </p>
              <button
                type="button"
                onClick={() => setModaleGestionMissionsOuverte(true)}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                style={{ background: "var(--c-clair)", color: "var(--c-base)" }}
              >
                <Settings2 size={12} /> Configurer les missions
              </button>
            </div>
          )}
        </section>
      )}

      {/* ── Actions rapides ── */}
      <section
        className="rounded-xl p-5"
        style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}
      >
        <h3 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: "var(--texte-3)" }}>
          Actions rapides
        </h3>
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/projets/${idProjet}/economie/nouvelle`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all hover:opacity-90"
            style={{ background: "var(--c-base)" }}
          >
            <Plus size={14} /> Nouvelle étude économique
          </Link>
          <Link
            href={`/projets/${idProjet}/documents`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all hover:bg-[color:var(--fond-entree)]"
            style={{ borderColor: "var(--bordure)", color: "var(--texte)" }}
          >
            <FileText size={14} /> Ajouter un document
          </Link>
          {afficherPiecesEcrites && (
            <Link
              href={`/projets/${idProjet}/pieces-ecrites/nouvelle`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all hover:bg-[color:var(--fond-entree)]"
              style={{ borderColor: "var(--bordure)", color: "var(--texte)" }}
            >
              <PenTool size={14} /> Nouvelle pièce écrite
            </Link>
          )}
          <Link
            href={`/societe/devis/nouveau?projet=${idProjet}`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all hover:bg-[color:var(--fond-entree)]"
            style={{ borderColor: "var(--bordure)", color: "var(--texte)" }}
          >
            <ReceiptText size={14} /> Créer un devis
          </Link>
          <Link
            href={`/projets/${idProjet}/modifier`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all hover:bg-[color:var(--fond-entree)]"
            style={{ borderColor: "var(--bordure)", color: "var(--texte)" }}
          >
            Modifier le projet
          </Link>
          <button
            type="button"
            onClick={() => setModaleDocumentOuverte(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all hover:bg-[color:var(--fond-entree)]"
            style={{ borderColor: "var(--bordure)", color: "var(--texte)" }}
          >
            <Wand2 size={14} /> Générer un document
          </button>
        </div>
      </section>

      {/* ── Modal gestion missions ── */}
      {modaleGestionMissionsOuverte && familleClient && (
        <ModalGererMissionsProjet
          projetId={projet.id}
          familleClient={familleClient}
          missionsActuelles={[...missionsCodes]}
          statutsActuels={statutsLocaux}
          onFermer={() => setModaleGestionMissionsOuverte(false)}
          onSauvegarde={() => {
            queryClient.invalidateQueries({ queryKey: ["projet", projet.id] });
            queryClient.invalidateQueries({ queryKey: ["missions-livrables", familleClient] });
          }}
        />
      )}

      {/* ── Modal génération document ── */}
      {modaleDocumentOuverte && (
        <ModalGenererDocument
          onFermer={() => setModaleDocumentOuverte(false)}
          projetId={idProjet}
          familleClient={familleClient}
        />
      )}

      {/* ── Graphique financier ── */}
      <GrafiqueFinancier
        montantEstime={projet.montant_estime}
        montantMarche={projet.montant_marche}
        totalEtudes={totalEtudes}
        totalDevis={totalDevis}
        totalFacture={totalFacture}
      />

      {/* ── Synthèse financière ── */}
      {(devisProjet.length > 0 || facturesProjet.length > 0) && (
        <section className="grid gap-4 lg:grid-cols-2">
          {/* Devis */}
          {devisProjet.length > 0 && (
            <div
              className="rounded-xl overflow-hidden"
              style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}
            >
              <div
                className="flex items-center justify-between px-4 py-3"
                style={{ borderBottom: "1px solid var(--bordure)" }}
              >
                <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--texte-3)" }}>
                  Devis honoraires ({devisProjet.length})
                </h3>
                <Link href="/societe/devis" className="text-xs" style={{ color: "var(--c-base)" }}>
                  Voir tout
                </Link>
              </div>
              <ul className="divide-y" style={{ borderColor: "var(--bordure)" }}>
                {devisProjet.slice(0, 4).map((d) => {
                  const cfg = STATUTS_DEVIS[d.statut] ?? STATUTS_DEVIS.brouillon;
                  return (
                    <li key={d.id}>
                      <Link
                        href={`/societe/devis/${d.id}`}
                        className="flex items-center justify-between px-4 py-3 hover:opacity-80 transition-opacity"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: "var(--texte)" }}>{d.intitule}</p>
                          <p className="text-xs font-mono" style={{ color: "var(--texte-3)" }}>{d.reference}</p>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                          <span
                            className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{ background: `color-mix(in srgb, ${cfg.couleur} 12%, var(--fond-entree))`, color: cfg.couleur }}
                          >
                            {cfg.label}
                          </span>
                          <span className="text-sm font-mono font-semibold" style={{ color: "var(--texte)" }}>
                            {parseFloat(d.montant_ttc).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €
                          </span>
                          <ChevronRight size={12} style={{ color: "var(--texte-3)" }} />
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Factures */}
          {facturesProjet.length > 0 && (
            <div
              className="rounded-xl overflow-hidden"
              style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}
            >
              <div
                className="flex items-center justify-between px-4 py-3"
                style={{ borderBottom: "1px solid var(--bordure)" }}
              >
                <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--texte-3)" }}>
                  Factures ({facturesProjet.length})
                </h3>
                <Link href="/societe/factures" className="text-xs" style={{ color: "var(--c-base)" }}>
                  Voir tout
                </Link>
              </div>
              <ul className="divide-y" style={{ borderColor: "var(--bordure)" }}>
                {facturesProjet.slice(0, 4).map((f) => {
                  const cfg = STATUTS_FACTURE[f.statut] ?? STATUTS_FACTURE.emise;
                  const restant = parseFloat(f.montant_restant);
                  return (
                    <li key={f.id}>
                      <Link
                        href={`/societe/factures/${f.id}`}
                        className="flex items-center justify-between px-4 py-3 hover:opacity-80 transition-opacity"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-mono font-medium" style={{ color: "var(--texte)" }}>
                            {f.est_en_retard && <AlertTriangle size={11} className="inline mr-1" style={{ color: "#ef4444" }} />}
                            {f.reference}
                          </p>
                          <p className="text-xs" style={{ color: "var(--texte-3)" }}>{f.client_nom}</p>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                          <span
                            className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{ background: `color-mix(in srgb, ${cfg.couleur} 12%, var(--fond-entree))`, color: cfg.couleur }}
                          >
                            {cfg.label}
                          </span>
                          {restant > 0 && (
                            <span className="text-xs font-mono" style={{ color: f.est_en_retard ? "#ef4444" : "var(--texte-2)" }}>
                              -{restant.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €
                            </span>
                          )}
                          <ChevronRight size={12} style={{ color: "var(--texte-3)" }} />
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* ── Processus recommandé ── */}
      {(processus.points_de_controle.length > 0 || processus.livrables_prioritaires.length > 0 || processus.methodes_estimation.length > 0) && (
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--texte-3)" }}>
            Processus recommandé
          </h3>
          <AccordeonProcessus
            titre="Points de contrôle"
            items={processus.points_de_controle}
            icone={<Search size={14} />}
            actions={[
              { href: `/projets/${idProjet}/documents`, libelle: "Voir les documents" },
              { href: `/projets/${idProjet}/modifier`, libelle: "Ajuster le calendrier" },
            ]}
          />
          <AccordeonProcessus
            titre="Livrables prioritaires"
            items={processus.livrables_prioritaires}
            icone={<FileText size={14} />}
            actions={[
              ...(afficherPiecesEcrites ? [{ href: `/projets/${idProjet}/pieces-ecrites/nouvelle`, libelle: "Créer une pièce" }] : []),
              { href: `/projets/${idProjet}/documents`, libelle: "Ajouter un document" },
            ]}
          />
          <AccordeonProcessus
            titre="Méthodes d'estimation"
            items={processus.methodes_estimation.map((m) => `${m.libelle} — ${m.objectif}`)}
            icone={<BarChart2 size={14} />}
            actions={[
              { href: `/projets/${idProjet}/economie/nouvelle`, libelle: "Lancer une étude" },
              ...(afficherAppelsOffres ? [{ href: `/projets/${idProjet}/appels-offres/nouveau`, libelle: "Créer un AO" }] : []),
            ]}
          />
        </section>
      )}

      {/* ── Activité récente ── */}
      {synthese?.activite_recente && synthese.activite_recente.length > 0 && (
        <section
          className="rounded-xl p-5"
          style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}
        >
          <h3 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: "var(--texte-3)" }}>
            Activité récente
          </h3>
          <ul className="space-y-3">
            {synthese.activite_recente.slice(0, 8).map((activite, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <span
                  className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: "var(--c-base)" }}
                />
                <div className="flex-1 min-w-0">
                  <span style={{ color: "var(--texte)" }}>{activite.libelle}</span>
                  <span className="ml-1 text-xs" style={{ color: "var(--texte-3)" }}>
                    — {activite.utilisateur}
                  </span>
                </div>
                <span className="text-xs flex-shrink-0" style={{ color: "var(--texte-3)" }}>
                  {new Date(activite.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ModalConfirmation
        ouverte={modalePhaseOuverte}
        titre="Appliquer la phase suggérée"
        message={
          phaseSuggeree
            ? `La phase officielle passera à « ${phaseSuggeree.libelle} ». ${phaseSuggeree.raison}`
            : "Appliquer la phase suggérée à ce projet ?"
        }
        libelleBoutonConfirmer="Appliquer"
        libelleBoutonAnnuler="Conserver l'actuelle"
        variante="info"
        chargement={applicationPhaseEnCours}
        onConfirmer={appliquerPhaseSuggeree}
        onAnnuler={() => {
          if (!applicationPhaseEnCours) {
            setModalePhaseOuverte(false);
          }
        }}
      />
    </div>
  );
}
