"use client";

import { clsx } from "clsx";
import {
  Building2, Wrench, CheckCircle2,
  Home, Factory, Waves, Blend,
  Scale, Users, FileCheck, Eye,
} from "lucide-react";
import type { EtatWizardModal, NatureOuvrage, NatureMarche } from "./types";

// ── Contextes contractuels par famille ─────────────────────────────────────────

const CONTEXTES_PAR_FAMILLE: Record<string, { id: string; libelle: string; description: string }[]> = {
  maitrise_ouvrage: [
    { id: "marche_public",       libelle: "Marché public",             description: "Procédure soumise au Code de la commande publique." },
    { id: "marche_prive",        libelle: "Marché privé",              description: "Contrat librement négocié sans procédure imposée." },
    { id: "accord_cadre",        libelle: "Accord-cadre / subséquent", description: "Marché subséquent à un accord-cadre." },
    { id: "consultation_directe", libelle: "Consultation directe",    description: "Mission confiée sans mise en concurrence formelle." },
  ],
  maitrise_oeuvre: [
    { id: "conception",          libelle: "Mission de conception",     description: "Études de maîtrise d'œuvre (ESQ à PRO)." },
    { id: "dce_consultation",    libelle: "DCE / Consultation",        description: "Rédaction du dossier de consultation des entreprises." },
    { id: "analyse_offres",      libelle: "Analyse des offres",        description: "Analyse et rapport comparatif des offres." },
    { id: "suivi_execution",     libelle: "Suivi d'exécution",         description: "VISA, DET, OPC, AOR — suivi de chantier." },
  ],
  entreprise: [
    { id: "appel_offres",        libelle: "Réponse à appel d'offres",  description: "Chiffrage et dossier de réponse à un appel d'offres." },
    { id: "consultation_directe", libelle: "Consultation directe",    description: "Devis ou offre suite à sollicitation directe." },
    { id: "cotraitance",         libelle: "Co-traitance",              description: "Groupement avec d'autres entreprises." },
    { id: "sous_traitance",      libelle: "Sous-traitance",            description: "Mission réalisée pour le compte d'un entrepreneur principal." },
  ],
  autre: [
    { id: "partenariat",         libelle: "Partenariat",               description: "Mission dans le cadre d'un partenariat." },
    { id: "amo",                 libelle: "Assistance / Conseil",      description: "Mission d'AMO ou de conseil ponctuel." },
    { id: "convention",          libelle: "Convention / Mission ponctuelle", description: "Mission encadrée par une convention." },
    { id: "autre",               libelle: "Autre",                     description: "Contexte spécifique non listé." },
  ],
};

// ── Nature de l'ouvrage ────────────────────────────────────────────────────────

const NATURES_OUVRAGE: { id: NatureOuvrage; libelle: string; description: string; icone: React.ReactNode }[] = [
  { id: "batiment",       libelle: "Bâtiment",              description: "Construction neuve ou réhabilitation.",  icone: <Home size={20} /> },
  { id: "infrastructure", libelle: "Infrastructure / VRD",  description: "Voirie, réseaux, ouvrages d'art.",       icone: <Waves size={20} /> },
  { id: "mixte",          libelle: "Mixte",                 description: "Opération comprenant bâtiment + VRD.",   icone: <Blend size={20} /> },
];

// ── Rôle LBH ──────────────────────────────────────────────────────────────────

const ROLES_LBH: { id: string; libelle: string; icone: React.ReactNode }[] = [
  { id: "economiste_principal",   libelle: "Économiste principal",      icone: <Scale size={16} /> },
  { id: "economiste_associe",     libelle: "Économiste associé",        icone: <Users size={16} /> },
  { id: "sous_traitant_economie", libelle: "Sous-traitant économie",    icone: <FileCheck size={16} /> },
  { id: "observateur_conseil",    libelle: "Observateur / Conseil",     icone: <Eye size={16} /> },
];

interface Props {
  etat: EtatWizardModal;
  erreurs: Record<string, string>;
  onChange: <K extends keyof EtatWizardModal>(champ: K, valeur: EtatWizardModal[K]) => void;
}

function ChipToggle({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-base)]",
        selected
          ? "border-[color:var(--c-base)] text-[color:var(--c-base)]"
          : "border-[color:var(--bordure)] text-[color:var(--texte-2)] hover:border-[color:var(--bordure-fm)]"
      )}
      style={{ background: selected ? "var(--c-leger)" : "var(--fond-carte)" }}
    >
      {selected && <CheckCircle2 size={11} strokeWidth={2.5} />}
      {children}
    </button>
  );
}

export function EtapeContexteContractuel({ etat, erreurs, onChange }: Props) {
  const contextes = CONTEXTES_PAR_FAMILLE[etat.familleClientId] ?? CONTEXTES_PAR_FAMILLE.autre;

  return (
    <div className="space-y-8">
      {/* Contexte contractuel */}
      <div>
        <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--texte)" }}>
          Contexte contractuel
        </h3>
        <p className="text-xs mb-4" style={{ color: "var(--texte-2)" }}>
          Cadre juridique et commercial de la mission.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {contextes.map((ctx) => {
            const selected = etat.contexteContractuelId === ctx.id;
            return (
              <button
                key={ctx.id}
                type="button"
                onClick={() => onChange("contexteContractuelId", ctx.id)}
                className={clsx(
                  "text-left rounded-xl border p-3 transition-all",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-base)]",
                  selected
                    ? "border-[color:var(--c-base)] shadow-sm"
                    : "border-[color:var(--bordure)] hover:border-[color:var(--bordure-fm)]"
                )}
                style={{ background: selected ? "var(--c-leger)" : "var(--fond-carte)" }}
              >
                <div className="flex items-start gap-2">
                  <span
                    className={clsx(
                      "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                      selected ? "border-[color:var(--c-base)] bg-[color:var(--c-base)]" : "border-[color:var(--bordure)]"
                    )}
                  >
                    {selected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                  </span>
                  <div>
                    <p className={clsx("text-sm font-medium", selected ? "text-[color:var(--c-base)]" : "text-[color:var(--texte)]")}>
                      {ctx.libelle}
                    </p>
                    <p className="text-[11px] mt-0.5" style={{ color: "var(--texte-3)" }}>
                      {ctx.description}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        {erreurs.contexte_contractuel && (
          <p className="mt-2 text-xs text-red-500">{erreurs.contexte_contractuel}</p>
        )}
      </div>

      {/* Nature de l'ouvrage */}
      <div>
        <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--texte)" }}>
          Nature de l&apos;ouvrage
        </h3>
        <div className="flex flex-wrap gap-2">
          {NATURES_OUVRAGE.map((nature) => (
            <button
              key={nature.id}
              type="button"
              onClick={() => onChange("natureOuvrage", nature.id)}
              className={clsx(
                "flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm transition-all",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-base)]",
                etat.natureOuvrage === nature.id
                  ? "border-[color:var(--c-base)] font-medium text-[color:var(--c-base)]"
                  : "border-[color:var(--bordure)] text-[color:var(--texte)] hover:border-[color:var(--bordure-fm)]"
              )}
              style={{ background: etat.natureOuvrage === nature.id ? "var(--c-leger)" : "var(--fond-carte)" }}
            >
              <span className={etat.natureOuvrage === nature.id ? "text-[color:var(--c-base)]" : "text-[color:var(--texte-3)]"}>
                {nature.icone}
              </span>
              <span>
                <span className="block font-medium">{nature.libelle}</span>
                <span className="block text-[11px]" style={{ color: "var(--texte-3)" }}>{nature.description}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Nature du marché */}
      <div>
        <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--texte)" }}>
          Nature du marché
        </h3>
        <div className="flex flex-wrap gap-2">
          {(["public", "prive", "mixte"] as NatureMarche[]).map((nm) => (
            <ChipToggle
              key={nm}
              selected={etat.natureMarche === nm}
              onClick={() => onChange("natureMarche", nm)}
            >
              {nm === "public" ? "Marché public" : nm === "prive" ? "Marché privé" : "Mixte"}
            </ChipToggle>
          ))}
        </div>
      </div>

      {/* Rôle LBH dans la mission */}
      <div>
        <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--texte)" }}>
          Rôle de LBH dans la mission
        </h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {ROLES_LBH.map((role) => {
            const selected = etat.roleLbh === role.id;
            return (
              <button
                key={role.id}
                type="button"
                onClick={() => onChange("roleLbh", role.id)}
                className={clsx(
                  "flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-center text-xs font-medium transition-all",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-base)]",
                  selected
                    ? "border-[color:var(--c-base)] text-[color:var(--c-base)]"
                    : "border-[color:var(--bordure)] text-[color:var(--texte-2)] hover:border-[color:var(--bordure-fm)]"
                )}
                style={{ background: selected ? "var(--c-leger)" : "var(--fond-carte)" }}
              >
                <span className={selected ? "text-[color:var(--c-base)]" : "text-[color:var(--texte-3)]"}>
                  {role.icone}
                </span>
                {role.libelle}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
