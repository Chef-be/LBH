"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Sparkles, X, MapPin, Loader2 } from "lucide-react";
import { clsx } from "clsx";
import { ChampOrganisationRapide, type OrganisationOption } from "@/composants/projets/ChampOrganisationRapide";
import type { EtatWizard, ChampsExtraits } from "./types";

interface EtapeIdentificationProps {
  etat: EtatWizard;
  organisations: OrganisationOption[];
  champsExtraits?: ChampsExtraits;
  erreurs: Record<string, string>;
  onChange: <K extends keyof EtatWizard>(champ: K, valeur: EtatWizard[K]) => void;
  onEffacerChampExtrait: (champ: string) => void;
}

/** Badge "Extrait automatiquement" avec bouton effacer */
function BadgeExtrait({ onEffacer }: { onEffacer: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium"
      style={{ background: "var(--c-leger)", color: "var(--c-fort)" }}>
      <Sparkles size={10} />
      Extrait auto
      <button type="button" onClick={onEffacer} className="ml-0.5 hover:text-red-500 transition-colors">
        <X size={10} />
      </button>
    </span>
  );
}

/** Champ texte enrichi avec badge pré-remplissage */
function ChampAvecExtraction({
  id, label, value, onChange, onEffacer, erreur, placeholder, requis, type = "text", estExtrait,
}: {
  id: string; label: string; value: string; onChange: (v: string) => void;
  onEffacer: () => void; erreur?: string; placeholder?: string; requis?: boolean;
  type?: string; estExtrait: boolean;
}) {
  return (
    <div>
      <label className="libelle-champ" htmlFor={id}>
        {label}{requis && " *"}
        {estExtrait && <BadgeExtrait onEffacer={onEffacer} />}
      </label>
      <input
        id={id} type={type}
        className={clsx("champ-saisie mt-1", estExtrait && "border-[color:var(--c-clair)]")}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {erreur && <p className="mt-1 text-xs text-red-500">{erreur}</p>}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   CHAMP MONTANT FORMATÉ
────────────────────────────────────────────────────────────── */
function formaterMontantFR(valeur: string): string {
  if (!valeur) return "";
  const num = parseFloat(valeur.replace(/\s/g, "").replace(",", "."));
  if (Number.isNaN(num)) return valeur;
  // Formatage fr-FR avec espace comme séparateur de milliers
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num);
}

function ChampMontantFormate({
  id, label, value, onChange, onEffacer, erreur, placeholder, estExtrait,
}: {
  id: string; label: string; value: string; onChange: (v: string) => void;
  onEffacer: () => void; erreur?: string; placeholder?: string; estExtrait: boolean;
}) {
  const [enEdition, setEnEdition] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Valeur brute pour l'édition, formatée pour l'affichage
  const valeurAffichee = enEdition ? value : formaterMontantFR(value);

  return (
    <div>
      <label className="libelle-champ" htmlFor={id}>
        {label}
        {estExtrait && <BadgeExtrait onEffacer={onEffacer} />}
      </label>
      <div className="mt-1 relative">
        <input
          ref={inputRef}
          id={id}
          type="text"
          inputMode="decimal"
          className={clsx(
            "champ-saisie pr-8",
            estExtrait && "border-[color:var(--c-clair)]"
          )}
          value={valeurAffichee}
          onFocus={() => setEnEdition(true)}
          onBlur={() => setEnEdition(false)}
          onChange={(e) => {
            // Nettoyer la saisie : garder chiffres, point, virgule
            const brut = e.target.value.replace(/[^\d,.\s]/g, "").replace(",", ".").replace(/\s/g, "");
            onChange(brut);
          }}
          placeholder={placeholder ?? "850 000"}
        />
        <span
          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium pointer-events-none select-none"
          style={{ color: "var(--texte-3)" }}
        >
          €
        </span>
      </div>
      {value && !enEdition && (
        <p className="mt-0.5 text-xs" style={{ color: "var(--texte-3)" }}>
          {formaterMontantFR(value)} € HT
        </p>
      )}
      {erreur && <p className="mt-1 text-xs text-red-500">{erreur}</p>}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   AUTOCOMPLETE COMMUNE — API data.gouv.fr
────────────────────────────────────────────────────────────── */
interface SuggestionCommune {
  label: string;
  nom: string;
  postcode: string;
  codeDept: string;
}

function extraireCodeDept(postcode: string, context: string): string {
  // DOM-TOM : 971, 972, 973, 974, 976
  if (postcode.startsWith("97")) return postcode.slice(0, 3);
  // Corse : 2A, 2B via context (ex: "2A, Corse-du-Sud, Corse")
  const premierMot = context.split(",")[0].trim();
  if (premierMot === "2A" || premierMot === "2B") return premierMot;
  return postcode.slice(0, 2);
}

function ChampCommuneAutocomplete({
  value,
  onChange,
  onSelectCommune,
  estExtrait,
  onEffacer,
}: {
  value: string;
  onChange: (v: string) => void;
  onSelectCommune: (nom: string, dept: string) => void;
  estExtrait: boolean;
  onEffacer: () => void;
}) {
  const [suggestions, setSuggestions] = useState<SuggestionCommune[]>([]);
  const [chargement, setChargement] = useState(false);
  const [ouvert, setOuvert] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const conteneurRef = useRef<HTMLDivElement>(null);

  const rechercherCommunes = useCallback(async (q: string) => {
    if (q.length < 2) { setSuggestions([]); setOuvert(false); return; }
    setChargement(true);
    try {
      const res = await fetch(
        `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&type=municipality&limit=6`
      );
      if (!res.ok) return;
      const data = await res.json();
      const items: SuggestionCommune[] = (data.features ?? []).map((f: {
        properties: { label: string; name: string; postcode: string; context: string };
      }) => ({
        label: f.properties.label,
        nom: f.properties.name,
        postcode: f.properties.postcode,
        codeDept: extraireCodeDept(f.properties.postcode, f.properties.context),
      }));
      setSuggestions(items);
      setOuvert(items.length > 0);
    } catch {
      /* API indisponible — pas bloquant */
    } finally {
      setChargement(false);
    }
  }, []);

  const handleChange = (v: string) => {
    onChange(v);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => rechercherCommunes(v), 300);
  };

  const handleSelect = (s: SuggestionCommune) => {
    onSelectCommune(s.nom, s.codeDept);
    setSuggestions([]);
    setOuvert(false);
  };

  // Fermer si clic extérieur
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (conteneurRef.current && !conteneurRef.current.contains(e.target as Node)) {
        setOuvert(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={conteneurRef} className="relative">
      <label className="libelle-champ" htmlFor="commune">
        Commune
        {estExtrait && <BadgeExtrait onEffacer={onEffacer} />}
      </label>
      <div className="mt-1 relative">
        <input
          id="commune"
          type="text"
          className={clsx("champ-saisie pr-8", estExtrait && "border-[color:var(--c-clair)]")}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOuvert(true)}
          placeholder="Ex. : Bordeaux"
          autoComplete="off"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          {chargement
            ? <Loader2 size={14} className="animate-spin" style={{ color: "var(--texte-3)" }} />
            : <MapPin size={14} style={{ color: "var(--texte-3)" }} />
          }
        </span>
      </div>

      {/* Dropdown suggestions */}
      {ouvert && suggestions.length > 0 && (
        <ul
          className="absolute z-50 left-0 right-0 mt-1 rounded-xl border py-1 shadow-lg overflow-hidden"
          style={{ background: "var(--fond-carte)", borderColor: "var(--bordure)" }}
        >
          {suggestions.map((s, i) => (
            <li key={i}>
              <button
                type="button"
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-[color:var(--fond-entree)] transition-colors flex items-center justify-between gap-2"
                onMouseDown={(e) => { e.preventDefault(); handleSelect(s); }}
              >
                <span style={{ color: "var(--texte)" }}>{s.nom}</span>
                <span
                  className="text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0"
                  style={{ background: "var(--fond-entree)", color: "var(--texte-3)" }}
                >
                  {s.postcode} · Dép. {s.codeDept}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   COMPOSANT PRINCIPAL
────────────────────────────────────────────────────────────── */
export function EtapeIdentification({
  etat, organisations, champsExtraits: _champsExtraits, erreurs, onChange, onEffacerChampExtrait,
}: EtapeIdentificationProps) {
  const organisationsTriees = [...organisations].sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
  const estExtrait = (champ: string) => etat.champsPreremplis.has(champ);

  const handleSelectCommune = (nom: string, codeDept: string) => {
    onChange("commune", nom);
    if (!etat.departement) onChange("departement", codeDept);
  };

  return (
    <div className="space-y-5">
      {/* Référence + Intitulé */}
      <div className="grid gap-4 xl:grid-cols-4">
        <div className="xl:col-span-1">
          <label className="libelle-champ" htmlFor="reference">Référence *</label>
          <input
            id="reference"
            className="champ-saisie mt-1 font-mono"
            value={etat.reference}
            onChange={(e) => onChange("reference", e.target.value)}
          />
          {erreurs.reference && <p className="mt-1 text-xs text-red-500">{erreurs.reference}</p>}
        </div>
        <div className="xl:col-span-3">
          <ChampAvecExtraction
            id="intitule" label="Intitulé du projet" requis
            value={etat.intitule}
            onChange={(v) => onChange("intitule", v)}
            onEffacer={() => onEffacerChampExtrait("intitule")}
            erreur={erreurs.intitule}
            placeholder="Ex. : Réhabilitation de l'école primaire Jean Moulin"
            estExtrait={estExtrait("intitule")}
          />
        </div>
      </div>

      {/* Type projet + Statut */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="libelle-champ" htmlFor="type-projet">Type de projet</label>
          <select id="type-projet" className="champ-saisie mt-1" value={etat.typeProjet}
            onChange={(e) => onChange("typeProjet", e.target.value)}>
            <option value="etude">Étude</option>
            <option value="travaux">Travaux</option>
            <option value="mission_moe">Mission maîtrise d&apos;œuvre</option>
            <option value="assistance">Assistance</option>
            <option value="expertise">Expertise</option>
            <option value="autre">Autre</option>
          </select>
        </div>
        <div>
          <label className="libelle-champ" htmlFor="statut">Statut</label>
          <select id="statut" className="champ-saisie mt-1" value={etat.statut}
            onChange={(e) => onChange("statut", e.target.value)}>
            <option value="prospection">Prospection</option>
            <option value="en_cours">En cours</option>
            <option value="suspendu">Suspendu</option>
            <option value="termine">Terminé</option>
            <option value="abandonne">Abandonné</option>
          </select>
        </div>
      </div>

      {/* Localisation — Commune avec autocomplete + Département auto */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <ChampCommuneAutocomplete
            value={etat.commune}
            onChange={(v) => onChange("commune", v)}
            onSelectCommune={handleSelectCommune}
            estExtrait={estExtrait("commune")}
            onEffacer={() => onEffacerChampExtrait("commune")}
          />
        </div>
        <div>
          <ChampAvecExtraction
            id="departement" label="Département"
            value={etat.departement}
            onChange={(v) => onChange("departement", v)}
            onEffacer={() => onEffacerChampExtrait("departement")}
            placeholder="33"
            estExtrait={estExtrait("departement")}
          />
          <p className="mt-0.5 text-xs" style={{ color: "var(--texte-3)" }}>
            Renseigné automatiquement à la sélection
          </p>
        </div>
      </div>

      {/* Organisations */}
      <div className="grid gap-4 sm:grid-cols-3">
        <ChampOrganisationRapide
          label="Bureau d'études" name="organisation"
          placeholder="Sélectionner le bureau d'études"
          typeOrganisation="bureau_etudes"
          organisations={organisationsTriees}
          value={etat.organisationId}
          onChange={(v) => onChange("organisationId", v)}
        />
        <ChampOrganisationRapide
          label="Maître d'ouvrage" name="maitre-ouvrage"
          placeholder="Optionnel"
          typeOrganisation="maitre_ouvrage"
          organisations={organisationsTriees}
          value={etat.maitreOuvrageId}
          onChange={(v) => onChange("maitreOuvrageId", v)}
        />
        <ChampOrganisationRapide
          label="Maître d'œuvre" name="maitre-oeuvre"
          placeholder="Optionnel"
          typeOrganisation="bureau_etudes"
          organisations={organisationsTriees}
          value={etat.maitreOeuvreId}
          onChange={(v) => onChange("maitreOeuvreId", v)}
        />
      </div>

      {/* Budget + Dates */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <ChampMontantFormate
            id="montant-estime" label="Budget estimé (€ HT)"
            value={etat.montantEstime}
            onChange={(v) => onChange("montantEstime", v)}
            onEffacer={() => onEffacerChampExtrait("montant_estime")}
            placeholder="850 000"
            estExtrait={estExtrait("montant_estime")}
          />
        </div>
        <div>
          <label className="libelle-champ" htmlFor="date-debut">Date de début prévue</label>
          <input id="date-debut" type="date" className="champ-saisie mt-1"
            value={etat.dateDebutPrevue}
            onChange={(e) => onChange("dateDebutPrevue", e.target.value)}
          />
        </div>
        <div>
          <label className="libelle-champ" htmlFor="date-fin">Date de fin prévue</label>
          <input id="date-fin" type="date" className="champ-saisie mt-1"
            value={etat.dateFinPrevue}
            onChange={(e) => onChange("dateFinPrevue", e.target.value)}
          />
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="libelle-champ" htmlFor="description">Description du projet</label>
        <textarea
          id="description" className="champ-saisie mt-1 min-h-[80px] resize-y"
          value={etat.description}
          onChange={(e) => onChange("description", e.target.value)}
          placeholder="Description libre du contexte, objectifs ou contraintes particulières…"
        />
      </div>

      {etat.typeProjet === "autre" && (
        <div>
          <label className="libelle-champ" htmlFor="type-autre">Type personnalisé *</label>
          <input id="type-autre" className="champ-saisie mt-1"
            value={etat.typeProjetAutre}
            onChange={(e) => onChange("typeProjetAutre", e.target.value)}
          />
        </div>
      )}
    </div>
  );
}
