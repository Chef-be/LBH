"use client";

import { useState } from "react";
import { Check, ChevronDown, ChevronUp, FileText, Calculator, PenTool, ClipboardList, Search, Settings } from "lucide-react";
import { clsx } from "clsx";
import type { EtatWizard, ParcoursProjet, ValeurChamp, ChampDynamique } from "./types";

interface EtapeMissionsProps {
  etat: EtatWizard;
  parcours: ParcoursProjet | null;
  onChange: <K extends keyof EtatWizard>(champ: K, valeur: EtatWizard[K]) => void;
}

/* ────────────────────────────────────────────────────────────
   ICÔNES PAR CATÉGORIE DE SOUS-MISSION
────────────────────────────────────────────────────────────── */
function iconeCategorie(code: string) {
  if (code.startsWith("EC") || code.startsWith("EST")) return <Calculator size={14} />;
  if (code.startsWith("RED") || code.startsWith("CCTP") || code.startsWith("PE")) return <PenTool size={14} />;
  if (code.startsWith("SUV") || code.startsWith("DET") || code.startsWith("OPC")) return <ClipboardList size={14} />;
  if (code.startsWith("ANA") || code.startsWith("DIAG")) return <Search size={14} />;
  return <FileText size={14} />;
}

function couleurCategorie(code: string): string {
  if (code.startsWith("EC") || code.startsWith("EST")) return "var(--c-base)";
  if (code.startsWith("RED") || code.startsWith("CCTP") || code.startsWith("PE")) return "#8b5cf6";
  if (code.startsWith("SUV") || code.startsWith("DET") || code.startsWith("OPC")) return "#f59e0b";
  if (code.startsWith("ANA") || code.startsWith("DIAG")) return "#10b981";
  return "var(--texte-2)";
}

/* ────────────────────────────────────────────────────────────
   CARTE SOUS-MISSION
────────────────────────────────────────────────────────────── */
interface CarteSousMissionProps {
  code: string;
  libelle: string;
  description: string;
  livrables: string[];
  selectionnee: boolean;
  onToggle: () => void;
}

function CarteSousMission({ code, libelle, description, livrables, selectionnee, onToggle }: CarteSousMissionProps) {
  const couleur = couleurCategorie(code);

  return (
    <button
      type="button"
      onClick={onToggle}
      className={clsx(
        "w-full text-left rounded-xl border-2 p-4 transition-all duration-200",
        "hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        selectionnee
          ? "shadow-sm"
          : "border-[color:var(--bordure)] bg-[color:var(--fond-carte)]"
      )}
      style={selectionnee ? {
        borderColor: couleur,
        background: `color-mix(in srgb, ${couleur} 6%, var(--fond-carte))`,
      } : undefined}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox visuel */}
        <span
          className={clsx(
            "mt-0.5 flex-shrink-0 flex items-center justify-center w-5 h-5 rounded border-2 transition-all",
            selectionnee ? "border-transparent" : "border-[color:var(--bordure)]"
          )}
          style={selectionnee ? { background: couleur } : undefined}
        >
          {selectionnee && <Check size={12} className="text-white" strokeWidth={3} />}
        </span>

        <div className="flex-1 min-w-0">
          {/* En-tête */}
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded"
              style={{ background: `color-mix(in srgb, ${couleur} 12%, var(--fond-app))`, color: couleur }}
            >
              {iconeCategorie(code)}
              {code}
            </span>
            <span className="text-sm font-semibold" style={{ color: selectionnee ? couleur : "var(--texte)" }}>
              {libelle}
            </span>
          </div>

          {/* Description */}
          {description && (
            <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--texte-2)" }}>
              {description}
            </p>
          )}

          {/* Livrables */}
          {livrables.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {livrables.map((livrable, i) => (
                <span
                  key={i}
                  className="inline-block text-[10px] px-1.5 py-0.5 rounded"
                  style={{ background: "var(--fond-entree)", color: "var(--texte-3)", border: "1px solid var(--bordure)" }}
                >
                  {livrable}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

/* ────────────────────────────────────────────────────────────
   CHAMP DYNAMIQUE GÉNÉRIQUE
────────────────────────────────────────────────────────────── */
interface ChampDynamiqueRenduProps {
  champ: ChampDynamique;
  valeur: ValeurChamp;
  onChange: (valeur: ValeurChamp) => void;
}

function ChampDynamiqueRendu({ champ, valeur, onChange }: ChampDynamiqueRenduProps) {
  const labelId = `champ-${champ.code}`;

  const baseClasse = "champ-saisie mt-1 w-full";

  switch (champ.type_champ) {
    case "booleen":
      return (
        <div className="flex items-center gap-3">
          <button
            type="button"
            role="switch"
            aria-checked={Boolean(valeur)}
            onClick={() => onChange(!valeur)}
            className={clsx(
              "relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent",
              "transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
              valeur ? "bg-[color:var(--c-base)]" : "bg-[color:var(--bordure)]"
            )}
          >
            <span
              className={clsx(
                "inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200",
                valeur ? "translate-x-5" : "translate-x-0"
              )}
            />
          </button>
          <span className="text-sm" style={{ color: "var(--texte-2)" }}>
            {valeur ? "Oui" : "Non"}
          </span>
        </div>
      );

    case "selection":
      return (
        <select
          id={labelId}
          className={baseClasse}
          value={String(valeur ?? "")}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">{champ.placeholder || "Choisir…"}</option>
          {champ.options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      );

    case "multi_selection":
      return (
        <div className="mt-1 flex flex-wrap gap-2">
          {champ.options.map((opt) => {
            const vals = Array.isArray(valeur) ? valeur : [];
            const actif = vals.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  const nv = actif ? vals.filter((v) => v !== opt.value) : [...vals, opt.value];
                  onChange(nv);
                }}
                className={clsx(
                  "px-3 py-1 rounded-full text-xs font-medium border transition-all",
                  actif
                    ? "border-[color:var(--c-base)] text-[color:var(--c-base)]"
                    : "border-[color:var(--bordure)] text-[color:var(--texte-2)]"
                )}
                style={actif ? { background: "var(--c-leger)" } : { background: "var(--fond-entree)" }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      );

    case "texte_long":
      return (
        <textarea
          id={labelId}
          className={clsx(baseClasse, "min-h-[72px] resize-y")}
          value={String(valeur ?? "")}
          onChange={(e) => onChange(e.target.value)}
          placeholder={champ.placeholder}
        />
      );

    case "date":
      return (
        <input
          id={labelId}
          type="date"
          className={baseClasse}
          value={String(valeur ?? "")}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "nombre":
    case "montant":
      return (
        <div className="mt-1 relative">
          <input
            id={labelId}
            type="number"
            className="champ-saisie w-full pr-8"
            value={String(valeur ?? "")}
            onChange={(e) => onChange(e.target.value)}
            placeholder={champ.placeholder}
          />
          {champ.type_champ === "montant" && (
            <span
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium pointer-events-none"
              style={{ color: "var(--texte-3)" }}
            >
              €
            </span>
          )}
        </div>
      );

    default: // texte
      return (
        <input
          id={labelId}
          type="text"
          className={baseClasse}
          value={String(valeur ?? "")}
          onChange={(e) => onChange(e.target.value)}
          placeholder={champ.placeholder}
        />
      );
  }
}

/* ────────────────────────────────────────────────────────────
   SECTION VARIATION PRIX (ACCORDÉON)
────────────────────────────────────────────────────────────── */
function SectionVariationPrix({
  variationPrix,
  onChange,
}: {
  variationPrix: EtatWizard["variationPrix"];
  onChange: <K extends keyof EtatWizard>(champ: K, valeur: EtatWizard[K]) => void;
}) {
  const [ouvert, setOuvert] = useState(false);

  const update = (champ: keyof typeof variationPrix, valeur: string) => {
    onChange("variationPrix", { ...variationPrix, [champ]: valeur });
  };

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ borderColor: "var(--bordure)", background: "var(--fond-carte)" }}
    >
      {/* En-tête accordéon */}
      <button
        type="button"
        onClick={() => setOuvert(!ouvert)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-[color:var(--fond-entree)] transition-colors"
      >
        <div className="flex items-center gap-3">
          <Settings size={16} style={{ color: "var(--texte-2)" }} />
          <div>
            <span className="text-sm font-semibold" style={{ color: "var(--texte)" }}>
              Configuration de la variation de prix
            </span>
            {variationPrix.type_evolution && variationPrix.type_evolution !== "ferme" && (
              <span
                className="ml-2 text-xs px-2 py-0.5 rounded-full"
                style={{ background: "var(--c-leger)", color: "var(--c-base)" }}
              >
                {variationPrix.type_evolution}
              </span>
            )}
          </div>
        </div>
        {ouvert ? (
          <ChevronUp size={16} style={{ color: "var(--texte-3)" }} />
        ) : (
          <ChevronDown size={16} style={{ color: "var(--texte-3)" }} />
        )}
      </button>

      {/* Corps accordéon */}
      {ouvert && (
        <div
          className="px-5 pb-5 pt-1 border-t space-y-4"
          style={{ borderColor: "var(--bordure)" }}
        >
          {/* Type évolution */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="libelle-champ" htmlFor="type-evolution">Type d&apos;évolution des prix</label>
              <select
                id="type-evolution"
                className="champ-saisie mt-1"
                value={variationPrix.type_evolution}
                onChange={(e) => update("type_evolution", e.target.value)}
              >
                <option value="ferme">Prix ferme</option>
                <option value="actualisable">Prix actualisable</option>
                <option value="revisable">Prix révisable</option>
                <option value="ferme_actualisable">Ferme puis actualisable</option>
              </select>
            </div>
            <div>
              <label className="libelle-champ" htmlFor="cadre-juridique">Cadre juridique</label>
              <select
                id="cadre-juridique"
                className="champ-saisie mt-1"
                value={variationPrix.cadre_juridique}
                onChange={(e) => update("cadre_juridique", e.target.value)}
              >
                <option value="">Non précisé</option>
                <option value="ccag_travaux">CCAG Travaux 2021</option>
                <option value="ccag_pi">CCAG PI 2021</option>
                <option value="ccag_fcs">CCAG FCS 2021</option>
                <option value="marche_prive">Marché privé</option>
                <option value="personnalise">Personnalisé</option>
              </select>
            </div>
          </div>

          {/* Indice + Formule */}
          {(variationPrix.type_evolution === "actualisable" || variationPrix.type_evolution === "revisable" || variationPrix.type_evolution === "ferme_actualisable") && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="libelle-champ" htmlFor="indice-ref">Indice de référence</label>
                  <input
                    id="indice-ref"
                    type="text"
                    className="champ-saisie mt-1"
                    value={variationPrix.indice_reference}
                    onChange={(e) => update("indice_reference", e.target.value)}
                    placeholder="Ex. : BT01, TP01, ICC…"
                  />
                </div>
                <div>
                  <label className="libelle-champ" htmlFor="periodicite">Périodicité de révision</label>
                  <select
                    id="periodicite"
                    className="champ-saisie mt-1"
                    value={variationPrix.periodicite_revision ?? ""}
                    onChange={(e) => update("periodicite_revision", e.target.value)}
                  >
                    <option value="">Non définie</option>
                    <option value="mensuelle">Mensuelle</option>
                    <option value="trimestrielle">Trimestrielle</option>
                    <option value="semestrielle">Semestrielle</option>
                    <option value="annuelle">Annuelle</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="libelle-champ" htmlFor="formule">Formule de révision</label>
                <input
                  id="formule"
                  type="text"
                  className="champ-saisie mt-1 font-mono text-sm"
                  value={variationPrix.formule_personnalisee}
                  onChange={(e) => update("formule_personnalisee", e.target.value)}
                  placeholder="Ex. : P = P0 × (0.15 + 0.85 × In/I0)"
                />
                <p className="mt-1 text-xs" style={{ color: "var(--texte-3)" }}>
                  P0 = prix initial, In = indice à la date de révision, I0 = indice à la date de référence
                </p>
              </div>

              <div>
                <label className="libelle-champ" htmlFor="part-fixe">Part fixe (%)</label>
                <input
                  id="part-fixe"
                  type="number"
                  min={0}
                  max={100}
                  className="champ-saisie mt-1"
                  style={{ maxWidth: 120 }}
                  value={variationPrix.part_fixe ?? ""}
                  onChange={(e) => update("part_fixe", e.target.value)}
                  placeholder="15"
                />
              </div>
            </>
          )}

          {/* Dates */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="libelle-champ" htmlFor="date-prix-init">Date du prix initial</label>
              <input
                id="date-prix-init"
                type="date"
                className="champ-saisie mt-1"
                value={variationPrix.date_prix_initial ?? ""}
                onChange={(e) => update("date_prix_initial", e.target.value)}
              />
            </div>
            <div>
              <label className="libelle-champ" htmlFor="date-offre">Date de remise de l&apos;offre</label>
              <input
                id="date-offre"
                type="date"
                className="champ-saisie mt-1"
                value={variationPrix.date_remise_offre ?? ""}
                onChange={(e) => update("date_remise_offre", e.target.value)}
              />
            </div>
            <div>
              <label className="libelle-champ" htmlFor="date-demarrage">Date de démarrage</label>
              <input
                id="date-demarrage"
                type="date"
                className="champ-saisie mt-1"
                value={variationPrix.date_demarrage ?? ""}
                onChange={(e) => update("date_demarrage", e.target.value)}
              />
            </div>
          </div>

          {/* Clause */}
          <div>
            <label className="libelle-champ" htmlFor="clause-applicable">Clause contractuelle applicable</label>
            <textarea
              id="clause-applicable"
              className="champ-saisie mt-1 min-h-[64px] resize-y text-sm"
              value={variationPrix.clause_applicable ?? ""}
              onChange={(e) => update("clause_applicable", e.target.value)}
              placeholder="Référence à l'article ou à la clause du marché…"
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   SECTION DONNÉES D'ENTRÉE MÉTIER
────────────────────────────────────────────────────────────── */
function SectionDonneesEntree({
  groupes,
  donneesEntree,
  onChange,
}: {
  groupes: ParcoursProjet["champs_dynamiques"];
  donneesEntree: Record<string, ValeurChamp>;
  onChange: (code: string, valeur: ValeurChamp) => void;
}) {
  const [groupesOuverts, setGroupesOuverts] = useState<Set<string>>(() => {
    const s = new Set<string>();
    if (groupes.length > 0) s.add(groupes[0].groupe);
    return s;
  });

  const toggleGroupe = (g: string) => {
    setGroupesOuverts((prev) => {
      const n = new Set(prev);
      if (n.has(g)) n.delete(g);
      else n.add(g);
      return n;
    });
  };

  if (groupes.length === 0) {
    return (
      <p className="text-sm italic py-4 text-center" style={{ color: "var(--texte-3)" }}>
        Aucune donnée métier requise pour les missions sélectionnées.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {groupes.map(({ groupe, champs }) => {
        const ouvert = groupesOuverts.has(groupe);
        const nbRemplis = champs.filter((c) => {
          const v = donneesEntree[c.code];
          return v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0);
        }).length;

        return (
          <div
            key={groupe}
            className="rounded-xl border overflow-hidden"
            style={{ borderColor: "var(--bordure)", background: "var(--fond-carte)" }}
          >
            <button
              type="button"
              onClick={() => toggleGroupe(groupe)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-[color:var(--fond-entree)] transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold" style={{ color: "var(--texte)" }}>
                  {groupe}
                </span>
                <span
                  className="text-xs px-1.5 py-0.5 rounded-full"
                  style={{
                    background: nbRemplis === champs.length ? "var(--c-leger)" : "var(--fond-entree)",
                    color: nbRemplis === champs.length ? "var(--c-base)" : "var(--texte-3)",
                    border: "1px solid var(--bordure)",
                  }}
                >
                  {nbRemplis}/{champs.length}
                </span>
              </div>
              {ouvert ? (
                <ChevronUp size={14} style={{ color: "var(--texte-3)" }} />
              ) : (
                <ChevronDown size={14} style={{ color: "var(--texte-3)" }} />
              )}
            </button>

            {ouvert && (
              <div
                className="px-4 pb-4 pt-1 border-t grid gap-4 sm:grid-cols-2"
                style={{ borderColor: "var(--bordure)" }}
              >
                {champs.map((champ) => (
                  <div
                    key={champ.code}
                    className={clsx(
                      champ.type_champ === "texte_long" && "sm:col-span-2"
                    )}
                  >
                    <label
                      className="libelle-champ"
                      htmlFor={`champ-${champ.code}`}
                    >
                      {champ.libelle}
                      {champ.obligatoire && " *"}
                    </label>
                    {champ.aide_courte && (
                      <p className="text-xs mb-1" style={{ color: "var(--texte-3)" }}>
                        {champ.aide_courte}
                      </p>
                    )}
                    <ChampDynamiqueRendu
                      champ={champ}
                      valeur={donneesEntree[champ.code] ?? (champ.type_champ === "multi_selection" ? [] : champ.type_champ === "booleen" ? false : "")}
                      onChange={(v) => onChange(champ.code, v)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   COMPOSANT PRINCIPAL
────────────────────────────────────────────────────────────── */
export function EtapeMissions({ etat, parcours, onChange }: EtapeMissionsProps) {
  const sousMissions = parcours?.referentiels?.sous_missions ?? [];
  const champsDynamiques = parcours?.champs_dynamiques ?? [];

  /* Regrouper les sous-missions par catégorie (préfixe du code) */
  const groupesSousMissions = sousMissions.reduce<Record<string, typeof sousMissions>>((acc, sm) => {
    const categorie = sm.code.split("_")[0] || "Autre";
    if (!acc[categorie]) acc[categorie] = [];
    acc[categorie].push(sm);
    return acc;
  }, {});

  const nbSelectionnees = etat.sousMissionsSelectionnees.length;
  const nbTotal = sousMissions.length;

  const toggleSousMission = (id: string) => {
    const actuel = etat.sousMissionsSelectionnees;
    const nv = actuel.includes(id)
      ? actuel.filter((x) => x !== id)
      : [...actuel, id];
    onChange("sousMissionsSelectionnees", nv);
  };

  const majDonneeEntree = (code: string, valeur: ValeurChamp) => {
    onChange("donneesEntree", { ...etat.donneesEntree, [code]: valeur });
  };

  return (
    <div className="space-y-8">

      {/* ── Sélection des sous-missions ── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold" style={{ color: "var(--texte)" }}>
              Sous-missions &amp; livrables
            </h3>
            <p className="text-xs mt-0.5" style={{ color: "var(--texte-2)" }}>
              Sélectionnez les sous-missions à inclure dans ce projet
            </p>
          </div>
          {nbTotal > 0 && (
            <span
              className="text-xs px-2.5 py-1 rounded-full font-medium"
              style={{
                background: nbSelectionnees > 0 ? "var(--c-leger)" : "var(--fond-entree)",
                color: nbSelectionnees > 0 ? "var(--c-base)" : "var(--texte-3)",
                border: "1px solid var(--bordure)",
              }}
            >
              {nbSelectionnees} / {nbTotal} sélectionnée{nbSelectionnees > 1 ? "s" : ""}
            </span>
          )}
        </div>

        {sousMissions.length === 0 ? (
          <div
            className="rounded-xl border-2 border-dashed p-8 text-center"
            style={{ borderColor: "var(--bordure)" }}
          >
            <FileText size={32} className="mx-auto mb-3" style={{ color: "var(--texte-3)" }} />
            <p className="text-sm" style={{ color: "var(--texte-2)" }}>
              Les sous-missions disponibles dépendent des missions principales sélectionnées à l&apos;étape précédente.
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--texte-3)" }}>
              Retournez à l&apos;étape 1 pour sélectionner les missions.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupesSousMissions).map(([categorie, missions]) => (
              <div key={categorie}>
                {/* Titre de catégorie */}
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className="text-xs font-bold uppercase tracking-wider"
                    style={{ color: couleurCategorie(categorie + "_") }}
                  >
                    {categorie}
                  </span>
                  <div className="flex-1 h-px" style={{ background: "var(--bordure)" }} />
                  <span className="text-xs" style={{ color: "var(--texte-3)" }}>
                    {missions.filter((m) => etat.sousMissionsSelectionnees.includes(m.id)).length}/{missions.length}
                  </span>
                </div>

                {/* Grid de cards */}
                <div className="grid gap-3 sm:grid-cols-2">
                  {missions.map((sm) => (
                    <CarteSousMission
                      key={sm.id}
                      code={sm.code}
                      libelle={sm.libelle}
                      description={sm.description}
                      livrables={sm.types_livrables ?? []}
                      selectionnee={etat.sousMissionsSelectionnees.includes(sm.id)}
                      onToggle={() => toggleSousMission(sm.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Rôle et méthode ── */}
      <section>
        <h3 className="text-base font-semibold mb-4" style={{ color: "var(--texte)" }}>
          Rôle &amp; méthode d&apos;estimation
        </h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="libelle-champ" htmlFor="partie-contractante">Partie contractante</label>
            <input
              id="partie-contractante"
              type="text"
              className="champ-saisie mt-1"
              value={etat.partieContractante}
              onChange={(e) => onChange("partieContractante", e.target.value)}
              placeholder="Nom de l'entité contractante"
            />
          </div>
          <div>
            <label className="libelle-champ" htmlFor="role-lbh">Rôle LBH dans ce projet</label>
            <select
              id="role-lbh"
              className="champ-saisie mt-1"
              value={etat.roleLbh}
              onChange={(e) => onChange("roleLbh", e.target.value)}
            >
              <option value="">Non défini</option>
              <option value="economiste">Économiste de la construction</option>
              <option value="moe">Maître d&apos;œuvre</option>
              <option value="moe_delegation">MOE par délégation</option>
              <option value="assistant_moa">Assistant à la MOA</option>
              <option value="opc">OPC</option>
              <option value="coordinateur">Coordinateur SPS</option>
              <option value="controleur">Contrôleur technique</option>
            </select>
          </div>
          <div>
            <label className="libelle-champ" htmlFor="methode-estimation">Méthode d&apos;estimation</label>
            <select
              id="methode-estimation"
              className="champ-saisie mt-1"
              value={etat.methodeEstimation}
              onChange={(e) => onChange("methodeEstimation", e.target.value)}
            >
              <option value="">Non définie</option>
              <option value="ratio_surface">Ratio au m²</option>
              <option value="ratio_volume">Ratio au m³</option>
              <option value="detail_quantitatif">Détail quantitatif</option>
              <option value="bordereau_prix">Bordereau de prix</option>
              <option value="devis_descriptif">Devis descriptif</option>
              <option value="comparatif_offres">Comparatif d&apos;offres</option>
              <option value="expertise">Expertise</option>
            </select>
          </div>
        </div>
      </section>

      {/* ── Données d'entrée métier ── */}
      {champsDynamiques.length > 0 && (
        <section>
          <h3 className="text-base font-semibold mb-4" style={{ color: "var(--texte)" }}>
            Données métier du projet
          </h3>
          <SectionDonneesEntree
            groupes={champsDynamiques}
            donneesEntree={etat.donneesEntree}
            onChange={majDonneeEntree}
          />
        </section>
      )}

      {/* ── Variation de prix ── */}
      <section>
        <h3 className="text-base font-semibold mb-4" style={{ color: "var(--texte)" }}>
          Conditions financières
        </h3>
        <SectionVariationPrix variationPrix={etat.variationPrix} onChange={onChange} />
      </section>
    </div>
  );
}
