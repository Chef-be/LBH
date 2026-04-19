"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { MapPin, Loader2, Sparkles, X, Building2 } from "lucide-react";
import { clsx } from "clsx";
import type { EtatWizardModal } from "./types";
import type { OrganisationOption } from "@/composants/projets/ChampOrganisationRapide";
import { ChampOrganisationRapide } from "@/composants/projets/ChampOrganisationRapide";

// ── Autocomplete commune ──────────────────────────────────────────────────────

interface SuggestionCommune {
  label: string;
  nom: string;
  postcode: string;
  codeDept: string;
}

function extraireCodeDept(postcode: string, context: string): string {
  if (postcode.startsWith("97")) return postcode.slice(0, 3);
  const premierMot = context.split(",")[0].trim();
  if (premierMot === "2A" || premierMot === "2B") return premierMot;
  return postcode.slice(0, 2);
}

function ChampCommuneAutocomplete({
  value, onChange, onSelectCommune, estExtrait, onEffacer,
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
      const res = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&type=municipality&limit=6`);
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
    } catch { /* API indisponible */ } finally { setChargement(false); }
  }, []);

  const handleChange = (v: string) => {
    onChange(v);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => rechercherCommunes(v), 300);
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (conteneurRef.current && !conteneurRef.current.contains(e.target as Node)) setOuvert(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={conteneurRef} className="relative">
      <label className="libelle-champ" htmlFor="commune-modal">
        Commune
        {estExtrait && (
          <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
            style={{ background: "var(--c-leger)", color: "var(--c-fort)" }}>
            <Sparkles size={9} /> Extrait auto
            <button type="button" onClick={onEffacer} className="ml-0.5 hover:text-red-500"><X size={9} /></button>
          </span>
        )}
      </label>
      <div className="mt-1 relative">
        <input
          id="commune-modal" type="text" autoComplete="off"
          className={clsx("champ-saisie pr-8", estExtrait && "border-[color:var(--c-clair)]")}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOuvert(true)}
          placeholder="Ex. : Saint-Denis"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          {chargement ? <Loader2 size={14} className="animate-spin" style={{ color: "var(--texte-3)" }} /> : <MapPin size={14} style={{ color: "var(--texte-3)" }} />}
        </span>
      </div>
      {ouvert && suggestions.length > 0 && (
        <ul className="absolute z-50 left-0 right-0 mt-1 rounded-xl border py-1 shadow-xl overflow-hidden"
          style={{ background: "var(--fond-carte)", borderColor: "var(--bordure)" }}>
          {suggestions.map((s, i) => (
            <li key={i}>
              <button type="button"
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-[color:var(--fond-entree)] transition-colors flex items-center justify-between gap-2"
                onMouseDown={(e) => { e.preventDefault(); onSelectCommune(s.nom, s.codeDept); setSuggestions([]); setOuvert(false); }}>
                <span style={{ color: "var(--texte)" }}>{s.nom}</span>
                <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--fond-entree)", color: "var(--texte-3)" }}>
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

// ── Composant principal ───────────────────────────────────────────────────────

interface Props {
  etat: EtatWizardModal;
  organisations: OrganisationOption[];
  erreurs: Record<string, string>;
  onChange: <K extends keyof EtatWizardModal>(champ: K, valeur: EtatWizardModal[K]) => void;
  onEffacerChampExtrait: (champ: string) => void;
}

export function EtapeIdentification({ etat, organisations, erreurs, onChange, onEffacerChampExtrait }: Props) {
  const estExtrait = (champ: string) => etat.champsPreremplis.has(champ);
  const organisationsTriees = [...organisations].sort((a, b) => a.nom.localeCompare(b.nom, "fr"));

  return (
    <div className="space-y-5">

      {/* Référence + Intitulé */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="sm:col-span-1">
          <label className="libelle-champ" htmlFor="ref-modal">Référence *</label>
          <input
            id="ref-modal" className="champ-saisie mt-1 font-mono text-sm"
            value={etat.reference}
            onChange={(e) => onChange("reference", e.target.value)}
          />
          {erreurs.reference && <p className="mt-1 text-xs text-red-500">{erreurs.reference}</p>}
        </div>
        <div className="sm:col-span-3">
          <label className="libelle-champ" htmlFor="intitule-modal">
            Intitulé du projet *
            {estExtrait("intitule") && (
              <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
                style={{ background: "var(--c-leger)", color: "var(--c-fort)" }}>
                <Sparkles size={9} /> Extrait auto
                <button type="button" onClick={() => onEffacerChampExtrait("intitule")} className="ml-0.5 hover:text-red-500"><X size={9} /></button>
              </span>
            )}
          </label>
          <input
            id="intitule-modal"
            className={clsx("champ-saisie mt-1", estExtrait("intitule") && "border-[color:var(--c-clair)]")}
            value={etat.intitule}
            onChange={(e) => onChange("intitule", e.target.value)}
            placeholder="Ex. : Réhabilitation thermique de l'école Jean Moulin"
          />
          {erreurs.intitule && <p className="mt-1 text-xs text-red-500">{erreurs.intitule}</p>}
        </div>
      </div>

      {/* Type + Statut */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="libelle-champ" htmlFor="type-projet-modal">Type de projet</label>
          <select id="type-projet-modal" className="champ-saisie mt-1" value={etat.typeProjet}
            onChange={(e) => onChange("typeProjet", e.target.value)}>
            <option value="etude">Étude</option>
            <option value="travaux">Travaux</option>
            <option value="mission_moe">Mission maîtrise d&apos;œuvre</option>
            <option value="assistance">Assistance à maîtrise d&apos;ouvrage</option>
            <option value="expertise">Expertise</option>
            <option value="autre">Autre</option>
          </select>
        </div>
        <div>
          <label className="libelle-champ" htmlFor="statut-modal">Statut initial</label>
          <select id="statut-modal" className="champ-saisie mt-1" value={etat.statut}
            onChange={(e) => onChange("statut", e.target.value)}>
            <option value="prospection">Prospection</option>
            <option value="en_cours">En cours</option>
          </select>
        </div>
      </div>

      {/* Localisation */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <ChampCommuneAutocomplete
            value={etat.commune}
            onChange={(v) => onChange("commune", v)}
            onSelectCommune={(nom, dept) => {
              onChange("commune", nom);
              if (!etat.departement) onChange("departement", dept);
            }}
            estExtrait={estExtrait("commune")}
            onEffacer={() => onEffacerChampExtrait("commune")}
          />
        </div>
        <div>
          <label className="libelle-champ" htmlFor="dept-modal">Département</label>
          <input id="dept-modal" className="champ-saisie mt-1" value={etat.departement}
            onChange={(e) => onChange("departement", e.target.value)}
            placeholder="976" />
        </div>
      </div>

      {/* Organisations */}
      <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: "var(--bordure)", background: "var(--fond-entree)" }}>
        <div className="flex items-center gap-2 mb-1">
          <Building2 size={15} style={{ color: "var(--texte-3)" }} />
          <span className="text-xs font-semibold" style={{ color: "var(--texte-2)" }}>Parties prenantes</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <ChampOrganisationRapide
            label="Bureau d'études" name="org-modal"
            placeholder="LBH ou partenaire"
            typeOrganisation="bureau_etudes"
            organisations={organisationsTriees}
            value={etat.organisationId}
            onChange={(v) => onChange("organisationId", v)}
          />
          <ChampOrganisationRapide
            label="Maître d'ouvrage" name="mo-modal"
            placeholder="Optionnel"
            typeOrganisation="maitre_ouvrage"
            organisations={organisationsTriees}
            value={etat.maitreOuvrageId}
            onChange={(v) => onChange("maitreOuvrageId", v)}
          />
          <ChampOrganisationRapide
            label="Maître d'œuvre" name="moe-modal"
            placeholder="Optionnel"
            typeOrganisation="bureau_etudes"
            organisations={organisationsTriees}
            value={etat.maitreOeuvreId}
            onChange={(v) => onChange("maitreOeuvreId", v)}
          />
        </div>
      </div>
    </div>
  );
}
