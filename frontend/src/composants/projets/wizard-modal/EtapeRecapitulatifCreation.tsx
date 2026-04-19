"use client";

import { clsx } from "clsx";
import {
  Rocket, MapPin, Users, CheckSquare, Euro,
  CalendarDays, FileText, Loader2, AlertCircle, CheckCircle2,
} from "lucide-react";
import type { EtatWizardModal } from "./types";

// ── Labels lisibles ───────────────────────────────────────────────────────────

const FAMILLE_LABELS: Record<string, string> = {
  maitrise_ouvrage: "Maîtrise d'ouvrage",
  maitrise_oeuvre: "Maîtrise d'œuvre",
  entreprise: "Entreprise de travaux",
  autre: "Autre contexte",
};

const CONTEXTE_LABELS: Record<string, string> = {
  marche_public: "Marché public", marche_prive: "Marché privé",
  accord_cadre: "Accord-cadre", consultation_directe: "Consultation directe",
  conception: "Mission de conception", dce_consultation: "DCE / Consultation",
  analyse_offres: "Analyse des offres", suivi_execution: "Suivi d'exécution",
  appel_offres: "Réponse à appel d'offres", cotraitance: "Co-traitance",
  sous_traitance: "Sous-traitance", partenariat: "Partenariat",
  amo: "AMO / Conseil", convention: "Convention", autre: "Autre",
};

const NATURE_LABELS: Record<string, string> = {
  batiment: "Bâtiment", infrastructure: "Infrastructure / VRD", mixte: "Mixte",
};

function formaterMontantFR(valeur: string): string {
  if (!valeur) return "—";
  const num = parseFloat(valeur.replace(/\s/g, "").replace(",", "."));
  if (Number.isNaN(num)) return valeur;
  return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(num) + " € HT";
}

function formaterDate(d: string): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("fr-FR").format(new Date(d));
}

// ── Ligne de récap ────────────────────────────────────────────────────────────

function LigneRecap({
  icone, label, valeur, secondaire,
}: {
  icone?: React.ReactNode; label: string; valeur: string; secondaire?: string;
}) {
  return (
    <div className="flex items-start gap-3 py-2" style={{ borderBottom: "1px solid var(--bordure)" }}>
      {icone && <span className="shrink-0 mt-0.5" style={{ color: "var(--texte-3)" }}>{icone}</span>}
      <span className="text-xs font-medium w-36 shrink-0" style={{ color: "var(--texte-3)" }}>{label}</span>
      <div>
        <span className="text-sm font-semibold" style={{ color: "var(--texte)" }}>{valeur}</span>
        {secondaire && <span className="block text-xs" style={{ color: "var(--texte-3)" }}>{secondaire}</span>}
      </div>
    </div>
  );
}

interface Props {
  etat: EtatWizardModal;
  enSoumission: boolean;
  erreurs: Record<string, string>;
  onSoumettre: () => void;
}

export function EtapeRecapitulatifCreation({ etat, enSoumission, erreurs, onSoumettre }: Props) {
  const totalLivrables = etat.missionsSelectionnees.reduce((acc, m) => acc + m.livrablesCodes.length, 0);

  return (
    <div className="space-y-6">
      {/* Titre */}
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl shrink-0"
          style={{ background: "var(--c-leger)" }}
        >
          <Rocket size={20} style={{ color: "var(--c-base)" }} />
        </div>
        <div>
          <h3 className="text-base font-bold" style={{ color: "var(--texte)" }}>
            Prêt à créer le projet
          </h3>
          <p className="text-xs" style={{ color: "var(--texte-2)" }}>
            Vérifiez les informations avant de finaliser.
          </p>
        </div>
      </div>

      {/* Fiche récapitulative */}
      <div
        className="rounded-2xl border overflow-hidden"
        style={{ borderColor: "var(--bordure)" }}
      >
        {/* En-tête projet */}
        <div
          className="px-5 py-4"
          style={{ background: "var(--c-leger)", borderBottom: "1px solid var(--c-clair)" }}
        >
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <p className="font-mono text-xs font-bold" style={{ color: "var(--c-fort)" }}>
                {etat.reference}
              </p>
              <p className="text-base font-bold mt-0.5" style={{ color: "var(--texte)" }}>
                {etat.intitule || <span style={{ color: "var(--texte-3)" }}>Intitulé non renseigné</span>}
              </p>
            </div>
            <span
              className="text-xs font-semibold px-3 py-1 rounded-full"
              style={{ background: "var(--c-base)", color: "white" }}
            >
              {FAMILLE_LABELS[etat.familleClientId] ?? "—"}
            </span>
          </div>
        </div>

        {/* Données */}
        <div className="px-5 py-2">
          <LigneRecap icone={<MapPin size={14} />} label="Localisation"
            valeur={[etat.commune, etat.departement ? `Dép. ${etat.departement}` : ""].filter(Boolean).join(" — ") || "—"} />
          <LigneRecap icone={<Users size={14} />} label="Contexte"
            valeur={CONTEXTE_LABELS[etat.contexteContractuelId] ?? "—"}
            secondaire={NATURE_LABELS[etat.natureOuvrage]} />
          <LigneRecap icone={<Euro size={14} />} label="Budget estimé"
            valeur={formaterMontantFR(etat.montantEstime)} />
          <LigneRecap icone={<CalendarDays size={14} />} label="Calendrier"
            valeur={
              etat.dateDebutPrevue || etat.dateFinPrevue
                ? `${formaterDate(etat.dateDebutPrevue)} → ${formaterDate(etat.dateFinPrevue)}`
                : "Non renseigné"
            }
          />
        </div>
      </div>

      {/* Missions et livrables */}
      {etat.missionsSelectionnees.length > 0 && (
        <div
          className="rounded-2xl border p-4"
          style={{ background: "var(--fond-entree)", borderColor: "var(--bordure)" }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CheckSquare size={14} style={{ color: "var(--c-base)" }} />
              <span className="text-xs font-semibold" style={{ color: "var(--texte)" }}>
                {etat.missionsSelectionnees.length} mission{etat.missionsSelectionnees.length > 1 ? "s" : ""} sélectionnée{etat.missionsSelectionnees.length > 1 ? "s" : ""}
              </span>
            </div>
            <span className="text-xs" style={{ color: "var(--texte-3)" }}>
              {totalLivrables} livrable{totalLivrables > 1 ? "s" : ""}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {etat.missionsSelectionnees.map((m) => (
              <span key={m.missionCode}
                className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-medium"
                style={{ background: "var(--c-leger)", color: "var(--c-fort)", border: "1px solid var(--c-clair)" }}>
                <CheckCircle2 size={9} />
                {m.missionCode}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Documents sources */}
      {etat.fichiersSourcesProjet.length > 0 && (
        <div className="flex items-center gap-3 rounded-xl px-4 py-3"
          style={{ background: "var(--fond-entree)", border: "1px solid var(--bordure)" }}>
          <FileText size={15} style={{ color: "var(--texte-3)" }} />
          <span className="text-xs" style={{ color: "var(--texte-2)" }}>
            <strong>{etat.fichiersSourcesProjet.length}</strong> document{etat.fichiersSourcesProjet.length > 1 ? "s" : ""} seront importés dans la GED
            {etat.preanalyseSourcesId && " (classement automatique)"}
          </span>
        </div>
      )}

      {/* Erreur globale */}
      {erreurs.formulaire && (
        <div className="flex items-start gap-2 rounded-xl px-4 py-3 text-sm"
          style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444" }}>
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          <div>{erreurs.formulaire}</div>
        </div>
      )}

      {/* Bouton de création */}
      <button
        type="button"
        onClick={onSoumettre}
        disabled={enSoumission}
        className={clsx(
          "w-full flex items-center justify-center gap-2 rounded-2xl py-4 text-sm font-bold text-white transition-all",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-base)] focus-visible:ring-offset-2",
          enSoumission ? "opacity-70 cursor-not-allowed" : "hover:opacity-90 active:scale-[0.98]"
        )}
        style={{ background: "var(--c-base)" }}
      >
        {enSoumission ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Création en cours…
          </>
        ) : (
          <>
            <Rocket size={16} />
            Créer le projet
          </>
        )}
      </button>
    </div>
  );
}
