"use client";

import { useState } from "react";
import { clsx } from "clsx";
import {
  Euro, CalendarDays, Hash, Ruler, TrendingUp, Info,
  ChevronDown, ChevronUp, Sparkles, X,
} from "lucide-react";
import type { EtatWizardModal } from "./types";

// ── Formatage montant ─────────────────────────────────────────────────────────

function formaterMontantFR(valeur: string): string {
  if (!valeur) return "";
  const num = parseFloat(valeur.replace(/\s/g, "").replace(",", "."));
  if (Number.isNaN(num)) return valeur;
  return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(num);
}

function ChampMontant({
  id, label, value, onChange, placeholder, estExtrait, onEffacer,
}: {
  id: string; label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; estExtrait?: boolean; onEffacer?: () => void;
}) {
  const [enEdition, setEnEdition] = useState(false);
  const valeurAff = enEdition ? value : formaterMontantFR(value);

  return (
    <div>
      <label className="libelle-champ" htmlFor={id}>
        {label}
        {estExtrait && (
          <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
            style={{ background: "var(--c-leger)", color: "var(--c-fort)" }}>
            <Sparkles size={9} /> Extrait auto
            {onEffacer && <button type="button" onClick={onEffacer} className="ml-0.5 hover:text-red-500"><X size={9} /></button>}
          </span>
        )}
      </label>
      <div className="mt-1 relative">
        <input
          id={id} type="text" inputMode="decimal"
          className={clsx("champ-saisie pr-8", estExtrait && "border-[color:var(--c-clair)]")}
          value={valeurAff}
          onFocus={() => setEnEdition(true)}
          onBlur={() => setEnEdition(false)}
          onChange={(e) => {
            const brut = e.target.value.replace(/[^\d,.\s]/g, "").replace(",", ".").replace(/\s/g, "");
            onChange(brut);
          }}
          placeholder={placeholder ?? "0"}
        />
        <Euro size={13} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--texte-3)" }} />
      </div>
      {value && !enEdition && (
        <p className="mt-0.5 text-xs" style={{ color: "var(--texte-3)" }}>
          {formaterMontantFR(value)} € HT
        </p>
      )}
    </div>
  );
}

// ── Méthodes d'estimation ─────────────────────────────────────────────────────

const METHODES_ESTIMATION = [
  { id: "ratio_m2",        libelle: "Ratio au m²",            description: "Estimation par ratio €/m² SHON ou SHOB." },
  { id: "par_lot",         libelle: "Estimation par lot",     description: "Somme des estimations par corps d'état." },
  { id: "etude_prix",      libelle: "Étude de prix",          description: "Décomposition analytique DS, FC, PV." },
  { id: "base_artiprix",   libelle: "Base ARTIPRIX",          description: "Bibliothèque de prix unitaires ARTIPRIX." },
  { id: "retour_experience", libelle: "Retour d'expérience",  description: "Estimation par comparaison avec projets similaires." },
  { id: "bim_metres",      libelle: "BIM / Métrés",           description: "Quantités extraites d'un maquette BIM." },
];

// ── Modes variation des prix ──────────────────────────────────────────────────

const TYPES_EVOLUTION = [
  { id: "ferme",        libelle: "Prix ferme",          description: "Prix non révisable pendant toute la durée du marché." },
  { id: "actualisable", libelle: "Prix actualisable",   description: "Prix pouvant être actualisé jusqu'à la notification." },
  { id: "revisable",    libelle: "Prix révisable",      description: "Prix révisé périodiquement selon une formule paramétrique." },
];

interface Props {
  etat: EtatWizardModal;
  erreurs: Record<string, string>;
  onChange: <K extends keyof EtatWizardModal>(champ: K, valeur: EtatWizardModal[K]) => void;
  onEffacerChampExtrait: (champ: string) => void;
}

export function EtapeDonneesEstimation({ etat, erreurs, onChange, onEffacerChampExtrait }: Props) {
  const [showVariationPrix, setShowVariationPrix] = useState(false);
  const estExtrait = (champ: string) => etat.champsPreremplis.has(champ);

  return (
    <div className="space-y-7">

      {/* Budget et dates */}
      <div>
        <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--texte)" }}>
          Budget et calendrier
        </h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <ChampMontant
            id="montant-est-modal" label="Budget estimé (€ HT)"
            value={etat.montantEstime}
            onChange={(v) => onChange("montantEstime", v)}
            placeholder="850 000"
            estExtrait={estExtrait("montant_estime")}
            onEffacer={() => onEffacerChampExtrait("montant_estime")}
          />
          <div>
            <label className="libelle-champ" htmlFor="date-debut-modal">
              <CalendarDays size={12} className="inline mr-1" /> Date de début prévue
            </label>
            <input id="date-debut-modal" type="date" className="champ-saisie mt-1"
              value={etat.dateDebutPrevue} onChange={(e) => onChange("dateDebutPrevue", e.target.value)} />
          </div>
          <div>
            <label className="libelle-champ" htmlFor="date-fin-modal">
              <CalendarDays size={12} className="inline mr-1" /> Date de fin prévue
            </label>
            <input id="date-fin-modal" type="date" className="champ-saisie mt-1"
              value={etat.dateFinPrevue} onChange={(e) => onChange("dateFinPrevue", e.target.value)} />
          </div>
        </div>
      </div>

      {/* Méthode d'estimation */}
      <div>
        <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--texte)" }}>
          Méthode d&apos;estimation
        </h3>
        <p className="text-xs mb-3" style={{ color: "var(--texte-2)" }}>
          Comment le budget sera-t-il calculé ?
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {METHODES_ESTIMATION.map((m) => {
            const selected = etat.methodeEstimation === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onChange("methodeEstimation", m.id)}
                className={clsx(
                  "text-left rounded-xl border px-3 py-2.5 text-xs transition-all",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-base)]",
                  selected
                    ? "border-[color:var(--c-base)] font-medium text-[color:var(--c-base)]"
                    : "border-[color:var(--bordure)] text-[color:var(--texte-2)] hover:border-[color:var(--bordure-fm)]"
                )}
                style={{ background: selected ? "var(--c-leger)" : "var(--fond-carte)" }}
              >
                <p className={selected ? "font-semibold" : "font-medium"}>{m.libelle}</p>
                <p className="mt-0.5 text-[10px] opacity-80">{m.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Données d'entrée techniques */}
      <div
        className="rounded-2xl border p-4 space-y-4"
        style={{ background: "var(--fond-entree)", borderColor: "var(--bordure)" }}
      >
        <div className="flex items-center gap-2">
          <Ruler size={14} style={{ color: "var(--texte-3)" }} />
          <h3 className="text-xs font-semibold" style={{ color: "var(--texte-2)" }}>Données techniques</h3>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="libelle-champ" htmlFor="surface-modal">Surface / métrique principale</label>
            <div className="mt-1 relative">
              <input
                id="surface-modal" type="text" inputMode="decimal" className="champ-saisie pr-10"
                value={(etat.donneesEntree.surface_plancher as string) ?? ""}
                onChange={(e) => onChange("donneesEntree", { ...etat.donneesEntree, surface_plancher: e.target.value })}
                placeholder="ex. 1 200"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-medium pointer-events-none" style={{ color: "var(--texte-3)" }}>
                m²
              </span>
            </div>
          </div>
          <div>
            <label className="libelle-champ" htmlFor="ratio-modal">Ratio €/m² estimé</label>
            <div className="mt-1 relative">
              <input
                id="ratio-modal" type="text" inputMode="decimal" className="champ-saisie pr-12"
                value={(etat.donneesEntree.ratio_m2 as string) ?? ""}
                onChange={(e) => onChange("donneesEntree", { ...etat.donneesEntree, ratio_m2: e.target.value })}
                placeholder="ex. 1 800"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-medium pointer-events-none" style={{ color: "var(--texte-3)" }}>
                €/m²
              </span>
            </div>
          </div>
          <div>
            <label className="libelle-champ" htmlFor="nb-lots-modal">Nombre de lots prévu</label>
            <div className="mt-1 relative">
              <input
                id="nb-lots-modal" type="number" min="1" max="99" className="champ-saisie pr-8"
                value={(etat.donneesEntree.nombre_lots as string) ?? ""}
                onChange={(e) => onChange("donneesEntree", { ...etat.donneesEntree, nombre_lots: e.target.value })}
                placeholder="1"
              />
              <Hash size={13} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--texte-3)" }} />
            </div>
          </div>
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="libelle-champ" htmlFor="desc-modal">Description du projet</label>
        <textarea
          id="desc-modal" className="champ-saisie mt-1 min-h-[80px] resize-y"
          value={etat.description}
          onChange={(e) => onChange("description", e.target.value)}
          placeholder="Contexte, objectifs, contraintes particulières, programme de l'opération…"
        />
      </div>

      {/* Variation des prix — accordéon */}
      <div
        className="rounded-2xl border overflow-hidden"
        style={{ borderColor: "var(--bordure)" }}
      >
        <button
          type="button"
          onClick={() => setShowVariationPrix((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-[color:var(--fond-entree)] transition-colors"
          style={{ background: "var(--fond-carte)" }}
        >
          <span className="flex items-center gap-2 text-sm font-medium" style={{ color: "var(--texte)" }}>
            <TrendingUp size={15} style={{ color: "var(--texte-3)" }} />
            Variation des prix (optionnel)
          </span>
          {showVariationPrix
            ? <ChevronUp size={15} style={{ color: "var(--texte-3)" }} />
            : <ChevronDown size={15} style={{ color: "var(--texte-3)" }} />}
        </button>

        {showVariationPrix && (
          <div className="p-4 space-y-4" style={{ background: "var(--fond-entree)", borderTop: "1px solid var(--bordure)" }}>
            {/* Type d'évolution */}
            <div>
              <label className="libelle-champ">Type d&apos;évolution des prix</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {TYPES_EVOLUTION.map((te) => {
                  const selected = etat.variationPrix.type_evolution === te.id;
                  return (
                    <button
                      key={te.id}
                      type="button"
                      onClick={() => onChange("variationPrix", { ...etat.variationPrix, type_evolution: te.id })}
                      className={clsx(
                        "rounded-lg border px-3 py-2 text-xs text-left transition-all",
                        selected
                          ? "border-[color:var(--c-base)] text-[color:var(--c-base)]"
                          : "border-[color:var(--bordure)] text-[color:var(--texte-2)] hover:border-[color:var(--bordure-fm)]"
                      )}
                      style={{ background: selected ? "var(--c-leger)" : "var(--fond-carte)" }}
                    >
                      <p className="font-semibold">{te.libelle}</p>
                      <p className="text-[10px] mt-0.5 opacity-80">{te.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Indice de référence */}
            {etat.variationPrix.type_evolution === "revisable" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="libelle-champ">Indice de référence</label>
                  <input
                    type="text" className="champ-saisie mt-1"
                    value={etat.variationPrix.indice_reference}
                    onChange={(e) => onChange("variationPrix", { ...etat.variationPrix, indice_reference: e.target.value })}
                    placeholder="BT01, TP01…"
                  />
                </div>
                <div>
                  <label className="libelle-champ">Date des prix initiaux</label>
                  <input
                    type="date" className="champ-saisie mt-1"
                    value={etat.variationPrix.date_prix_initial}
                    onChange={(e) => onChange("variationPrix", { ...etat.variationPrix, date_prix_initial: e.target.value })}
                  />
                </div>
              </div>
            )}

            <div className="flex items-start gap-2 text-[11px] rounded-lg px-3 py-2" style={{ background: "var(--fond-app)", color: "var(--texte-3)" }}>
              <Info size={11} className="shrink-0 mt-0.5" />
              Ces informations s&apos;appliqueront automatiquement aux marchés et avenants du projet.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
