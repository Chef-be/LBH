"use client";

import { clsx } from "clsx";
import {
  Building2, Pencil, HardHat, MoreHorizontal,
  Landmark, Users, Layers, CheckCircle2, ChevronRight,
  Info,
} from "lucide-react";
import type { ParcoursProjet, ReferentielOption, EtatWizard } from "./types";

// ─── Icônes famille client ───────────────────────────────────────────────────

const ICONES_FAMILLE: Record<string, React.ReactNode> = {
  maitrise_ouvrage: <Landmark size={24} />,
  maitrise_oeuvre: <Pencil size={24} />,
  entreprise: <HardHat size={24} />,
  autre: <MoreHorizontal size={24} />,
};

const COULEURS_FAMILLE: Record<string, { border: string; bg: string; icon: string }> = {
  maitrise_ouvrage: { border: "border-blue-500", bg: "bg-blue-50 dark:bg-blue-950/30", icon: "text-blue-600" },
  maitrise_oeuvre:  { border: "border-violet-500", bg: "bg-violet-50 dark:bg-violet-950/30", icon: "text-violet-600" },
  entreprise:       { border: "border-amber-500", bg: "bg-amber-50 dark:bg-amber-950/30", icon: "text-amber-600" },
  autre:            { border: "border-slate-400", bg: "bg-slate-50 dark:bg-slate-800/40", icon: "text-slate-500" },
};

// ─── Composant carte famille client ──────────────────────────────────────────

function CarteClient({
  option,
  selected,
  onClick,
}: {
  option: ReferentielOption;
  selected: boolean;
  onClick: () => void;
}) {
  const couleurs = COULEURS_FAMILLE[option.code] ?? COULEURS_FAMILLE.autre;
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "relative text-left rounded-2xl border-2 p-4 transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-base)]",
        selected
          ? `${couleurs.border} ${couleurs.bg} shadow-md`
          : "border-[color:var(--bordure)] hover:border-[color:var(--bordure-fm)] hover:shadow-sm",
      )}
      style={{ background: selected ? undefined : "var(--fond-carte)" }}
    >
      {selected && (
        <CheckCircle2
          size={18}
          className="absolute top-3 right-3 text-emerald-500"
          strokeWidth={2.5}
        />
      )}
      <span className={clsx("mb-2 block", selected ? couleurs.icon : "text-[color:var(--texte-2)]")}>
        {ICONES_FAMILLE[option.code] ?? <Building2 size={24} />}
      </span>
      <p className="font-semibold text-sm text-[color:var(--texte)]">{option.libelle}</p>
      <p className="mt-1 text-xs text-[color:var(--texte-2)] leading-snug">{option.description}</p>
    </button>
  );
}

// ─── Chips togglables (nature ouvrage, nature marché) ────────────────────────

function GroupeChips<T extends string>({
  options,
  valeur,
  onChange,
}: {
  options: { value: T; label: string; icon?: React.ReactNode }[];
  valeur: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={clsx(
            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium transition-all",
            valeur === opt.value
              ? "border-[color:var(--c-base)] bg-[color:var(--c-leger)] text-[color:var(--c-fort)]"
              : "border-[color:var(--bordure)] text-[color:var(--texte-2)] hover:border-[color:var(--c-base)]"
          )}
          style={
            valeur === opt.value
              ? { background: "var(--c-leger)", color: "var(--c-fort)" }
              : { background: "var(--fond-carte)" }
          }
        >
          {opt.icon}
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ─── Stepper phase MOE ───────────────────────────────────────────────────────

function StepperPhase({
  phases,
  valeur,
  onChange,
}: {
  phases: ReferentielOption[];
  valeur: string;
  onChange: (id: string) => void;
}) {
  if (!phases.length) return null;
  return (
    <div className="relative mt-1">
      <div className="flex items-center gap-0 overflow-x-auto pb-2 hide-scrollbar">
        {phases.map((phase, i) => {
          const actif = valeur === phase.id;
          const isLast = i === phases.length - 1;
          return (
            <div key={phase.id} className="flex items-center shrink-0">
              <button
                type="button"
                onClick={() => onChange(phase.id)}
                title={phase.description || phase.libelle}
                className={clsx(
                  "flex flex-col items-center gap-1 px-2 py-1.5 rounded-xl text-center transition-all",
                  actif
                    ? "bg-[color:var(--c-base)] text-white"
                    : "hover:bg-[color:var(--fond-app)] text-[color:var(--texte-2)]"
                )}
                style={actif ? { background: "var(--c-base)" } : {}}
              >
                <span className="text-[10px] font-bold leading-none uppercase tracking-wider">
                  {phase.code || phase.libelle.split(" ")[0]}
                </span>
                <span className={clsx("text-[9px] leading-none max-w-[60px] text-center", actif ? "text-white/80" : "text-[color:var(--texte-3)]")}>
                  {phase.libelle.length > 18 ? phase.libelle.slice(0, 18) + "…" : phase.libelle}
                </span>
              </button>
              {!isLast && (
                <ChevronRight size={12} className="shrink-0 text-[color:var(--texte-3)] mx-0.5" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Carte mission (multi-select) ────────────────────────────────────────────

function CarteMission({
  option,
  selected,
  onClick,
}: {
  option: ReferentielOption;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "relative text-left rounded-xl border-2 p-3 transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-base)]",
        selected
          ? "border-[color:var(--c-base)] shadow-md"
          : "border-[color:var(--bordure)] hover:border-[color:var(--c-clair)]"
      )}
      style={{
        background: selected ? "var(--c-leger)" : "var(--fond-carte)",
      }}
    >
      {selected && (
        <CheckCircle2 size={16} className="absolute top-2 right-2 text-[color:var(--c-base)]" strokeWidth={2.5} />
      )}
      <p className={clsx("font-semibold text-sm pr-5", selected ? "text-[color:var(--c-fort)]" : "text-[color:var(--texte)]")}>
        {option.libelle}
      </p>
      {option.description && (
        <p className="mt-1 text-xs text-[color:var(--texte-2)] leading-snug">{option.description}</p>
      )}
      {option.types_livrables && option.types_livrables.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {option.types_livrables.slice(0, 3).map((l) => (
            <span key={l} className="text-[9px] px-1.5 py-0.5 rounded-full border border-[color:var(--bordure)] text-[color:var(--texte-3)]">
              {l}
            </span>
          ))}
          {option.types_livrables.length > 3 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full border border-[color:var(--bordure)] text-[color:var(--texte-3)]">
              +{option.types_livrables.length - 3}
            </span>
          )}
        </div>
      )}
    </button>
  );
}

// ─── Composant principal ─────────────────────────────────────────────────────

interface EtapeContexteProps {
  etat: EtatWizard;
  parcours?: ParcoursProjet;
  chargement: boolean;
  erreurs: Record<string, string>;
  onChangeFamilleClient: (id: string) => void;
  onChangeSousTypeClient: (id: string) => void;
  onChangeContexteContractuel: (id: string) => void;
  onChangeMissions: (ids: string[]) => void;
  onChangePhaseIntervention: (id: string) => void;
  onChangeNatureOuvrage: (v: EtatWizard["natureOuvrage"]) => void;
  onChangeNatureMarche: (v: EtatWizard["natureMarche"]) => void;
}

const FAMILLES_FAKE: ReferentielOption[] = [
  { id: "maitrise_ouvrage", code: "maitrise_ouvrage", libelle: "Maîtrise d'ouvrage", description: "Client final ou donneur d'ordre principal." },
  { id: "maitrise_oeuvre", code: "maitrise_oeuvre", libelle: "Maîtrise d'œuvre", description: "Architecte, mandataire ou équipe de conception." },
  { id: "entreprise", code: "entreprise", libelle: "Entreprise", description: "Entreprise générale, lot séparé, groupement ou sous-traitance." },
  { id: "autre", code: "autre", libelle: "Autre contexte", description: "Partenaire, AMO, structure associative ou contexte spécifique." },
];

export function EtapeContexte({
  etat,
  parcours,
  chargement,
  erreurs,
  onChangeFamilleClient,
  onChangeSousTypeClient,
  onChangeContexteContractuel,
  onChangeMissions,
  onChangePhaseIntervention,
  onChangeNatureOuvrage,
  onChangeNatureMarche,
}: EtapeContexteProps) {
  const familles = parcours?.referentiels?.familles_client ?? FAMILLES_FAKE;
  const sousTypes = parcours?.referentiels?.sous_types_client ?? [];
  const contextes = parcours?.referentiels?.contextes_contractuels ?? [];
  const missions = (parcours?.referentiels?.missions_principales ?? []).filter(
    (m) => m.code !== "mission_economique_transversale"
  );
  const phases = parcours?.referentiels?.phases_intervention ?? [];

  const estEntreprise = familles.find((f) => f.id === etat.familleClientId)?.code === "entreprise";
  const estMoe = familles.find((f) => f.id === etat.familleClientId)?.code === "maitrise_oeuvre";

  function toggleMission(id: string) {
    if (etat.missionsPrincipalesSelectionnees.includes(id)) {
      onChangeMissions(etat.missionsPrincipalesSelectionnees.filter((m) => m !== id));
    } else {
      onChangeMissions([...etat.missionsPrincipalesSelectionnees, id]);
    }
  }

  return (
    <div className="space-y-6">
      {/* Famille client */}
      <section>
        <h3 className="font-semibold text-[color:var(--texte)] mb-1">Type de client *</h3>
        <p className="text-xs text-[color:var(--texte-2)] mb-3">
          Sélectionnez la famille qui correspond au donneur d&apos;ordre de cette mission.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {familles.map((famille) => (
            <CarteClient
              key={famille.id}
              option={famille}
              selected={etat.familleClientId === famille.id}
              onClick={() => onChangeFamilleClient(famille.id)}
            />
          ))}
        </div>
        {erreurs.famille_client && (
          <p className="mt-1 text-xs text-red-500">{erreurs.famille_client}</p>
        )}
      </section>

      {/* Nature ouvrage + marché */}
      <div className="grid sm:grid-cols-2 gap-4">
        <section>
          <h3 className="font-semibold text-sm text-[color:var(--texte)] mb-2">Nature de l&apos;ouvrage *</h3>
          <GroupeChips
            options={[
              { value: "batiment" as const, label: "Bâtiment", icon: <Building2 size={14} /> },
              { value: "infrastructure" as const, label: "Infrastructure / VRD", icon: <Layers size={14} /> },
              { value: "mixte" as const, label: "Mixte", icon: <Users size={14} /> },
            ]}
            valeur={etat.natureOuvrage}
            onChange={onChangeNatureOuvrage}
          />
        </section>
        <section>
          <h3 className="font-semibold text-sm text-[color:var(--texte)] mb-2">Type de marché *</h3>
          <GroupeChips
            options={[
              { value: "public" as const, label: "Public" },
              { value: "prive" as const, label: "Privé" },
              { value: "mixte" as const, label: "Mixte" },
              { value: "autre" as const, label: "Autre" },
            ]}
            valeur={etat.natureMarche}
            onChange={onChangeNatureMarche}
          />
        </section>
      </div>

      {/* Sous-type + Contexte contractuel */}
      {etat.familleClientId && (
        <div className={`grid gap-4 ${estEntreprise ? "sm:grid-cols-1" : "sm:grid-cols-2"}`}>
          {sousTypes.length > 0 && (
            <section>
              <label className="libelle-champ">Sous-type de client *</label>
              <select
                className="champ-saisie mt-1"
                value={etat.sousTypeClientId}
                onChange={(e) => onChangeSousTypeClient(e.target.value)}
              >
                <option value="">Sélectionner</option>
                {sousTypes.map((opt) => (
                  <option key={opt.id} value={opt.id}>{opt.libelle}</option>
                ))}
              </select>
              {erreurs.sous_type_client && (
                <p className="mt-1 text-xs text-red-500">{erreurs.sous_type_client}</p>
              )}
            </section>
          )}
          {!estEntreprise && contextes.length > 0 && (
            <section>
              <label className="libelle-champ">Contexte contractuel *</label>
              <select
                className="champ-saisie mt-1"
                value={etat.contexteContractuelId}
                onChange={(e) => onChangeContexteContractuel(e.target.value)}
              >
                <option value="">Sélectionner</option>
                {contextes.map((opt) => (
                  <option key={opt.id} value={opt.id}>{opt.libelle}</option>
                ))}
              </select>
              {erreurs.contexte_contractuel && (
                <p className="mt-1 text-xs text-red-500">{erreurs.contexte_contractuel}</p>
              )}
            </section>
          )}
        </div>
      )}

      {/* Phase d'intervention (MOE ou Bâtiment) */}
      {etat.familleClientId && !estEntreprise && phases.length > 0 && (
        <section>
          <h3 className="font-semibold text-sm text-[color:var(--texte)] mb-2">
            {estMoe
              ? etat.natureOuvrage === "infrastructure"
                ? "Élément de mission infrastructure *"
                : "Élément de mission MOE *"
              : "Phase d'intervention"}
          </h3>
          {chargement ? (
            <div className="h-10 rounded-xl animate-pulse" style={{ background: "var(--fond-app)" }} />
          ) : (
            <StepperPhase
              phases={phases}
              valeur={etat.phaseInterventionId}
              onChange={onChangePhaseIntervention}
            />
          )}
          {erreurs.phase_intervention && (
            <p className="mt-1 text-xs text-red-500">{erreurs.phase_intervention}</p>
          )}
        </section>
      )}

      {/* Missions principales */}
      {etat.familleClientId && missions.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-sm text-[color:var(--texte)]">
              {estEntreprise ? "Processus confiés à LBH *" : estMoe ? "Prestations économiques *" : "Missions principales"}
            </h3>
            {etat.missionsPrincipalesSelectionnees.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "var(--c-leger)", color: "var(--c-fort)" }}>
                {etat.missionsPrincipalesSelectionnees.length} sélectionnée{etat.missionsPrincipalesSelectionnees.length > 1 ? "s" : ""}
              </span>
            )}
          </div>
          {chargement ? (
            <div className="grid grid-cols-2 gap-2">
              {[1,2,3,4].map((i) => (
                <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: "var(--fond-app)" }} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {missions.map((mission) => (
                <CarteMission
                  key={mission.id}
                  option={mission}
                  selected={etat.missionsPrincipalesSelectionnees.includes(mission.id)}
                  onClick={() => toggleMission(mission.id)}
                />
              ))}
            </div>
          )}
          {erreurs.missions_principales && (
            <p className="mt-1 text-xs text-red-500">{erreurs.missions_principales}</p>
          )}
        </section>
      )}

      {/* Info contextuelle si famille sélectionnée mais pas encore de missions */}
      {!etat.familleClientId && (
        <div className="rounded-xl border border-[color:var(--bordure)] p-4 flex items-start gap-3" style={{ background: "var(--fond-carte)" }}>
          <Info size={18} className="text-[color:var(--texte-3)] shrink-0 mt-0.5" />
          <p className="text-sm text-[color:var(--texte-2)]">
            Sélectionnez un type de client pour voir les missions, phases et contextes disponibles.
          </p>
        </div>
      )}
    </div>
  );
}
