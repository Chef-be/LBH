"use client";

import { useEffect, useState } from "react";
import { BadgeInfo, Building2, Loader2 } from "lucide-react";
import { api } from "@/crochets/useApi";
import {
  type SuggestionEntreprisePublique,
  typeOrganisationSupporteRecherchePublique,
} from "@/lib/organisations";

function badgeSecondaire(visible: boolean, libelle: string) {
  if (!visible) return null;
  return (
    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
      {libelle}
    </span>
  );
}

export function ChampNomOrganisationAnnuaire({
  id,
  typeOrganisation,
  value,
  onChange,
  onSelection,
  placeholder,
  className = "champ-saisie",
}: {
  id: string;
  typeOrganisation: string;
  value: string;
  onChange: (value: string) => void;
  onSelection: (suggestion: SuggestionEntreprisePublique) => void;
  placeholder?: string;
  className?: string;
}) {
  const recherchePubliqueActive = typeOrganisationSupporteRecherchePublique(typeOrganisation);
  const [requete, setRequete] = useState(value);
  const [suggestions, setSuggestions] = useState<SuggestionEntreprisePublique[]>([]);
  const [chargement, setChargement] = useState(false);
  const [ouvert, setOuvert] = useState(false);
  const [erreurRecherche, setErreurRecherche] = useState<string | null>(null);

  useEffect(() => {
    setRequete(value);
  }, [value]);

  useEffect(() => {
    if (!recherchePubliqueActive) {
      setSuggestions([]);
      setChargement(false);
      setErreurRecherche(null);
      return;
    }

    const recherche = requete.trim();
    if (recherche.length < 3) {
      setSuggestions([]);
      setChargement(false);
      setErreurRecherche(null);
      return;
    }

    let actif = true;
    const timer = window.setTimeout(async () => {
      setChargement(true);
      setErreurRecherche(null);
      try {
        const reponse = await api.get<{ results: SuggestionEntreprisePublique[] }>(
          `/api/organisations/recherche-entreprises/?q=${encodeURIComponent(recherche)}&type_organisation=${encodeURIComponent(typeOrganisation)}&limit=6`
        );
        if (!actif) return;
        setSuggestions(reponse.results ?? []);
        setOuvert(true);
      } catch {
        if (!actif) return;
        setSuggestions([]);
        setErreurRecherche("Recherche publique temporairement indisponible.");
        setOuvert(true);
      } finally {
        if (actif) setChargement(false);
      }
    }, 350);

    return () => {
      actif = false;
      window.clearTimeout(timer);
    };
  }, [requete, recherchePubliqueActive, typeOrganisation]);

  return (
    <div className="relative">
      <input
        id={id}
        className={className}
        value={requete}
        onChange={(e) => {
          setRequete(e.target.value);
          onChange(e.target.value);
          if (recherchePubliqueActive) setOuvert(true);
        }}
        onFocus={() => {
          if (suggestions.length) setOuvert(true);
        }}
        onBlur={() => {
          window.setTimeout(() => setOuvert(false), 150);
        }}
        placeholder={placeholder}
        autoComplete="off"
      />

      {chargement ? (
        <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
      ) : null}

      {recherchePubliqueActive ? (
        <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-500">
          <BadgeInfo className="h-3.5 w-3.5" />
          Recherche dans l&apos;annuaire public par saisie du nom.
        </div>
      ) : null}

      {erreurRecherche ? (
        <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          {erreurRecherche}
        </div>
      ) : null}

      {ouvert && suggestions.length ? (
        <div className="absolute z-20 mt-2 max-h-80 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
          {suggestions.map((suggestion) => (
            <button
              key={`${suggestion.siren}-${suggestion.siret}`}
              type="button"
              className="flex w-full items-start gap-3 border-b border-slate-100 px-3 py-3 text-left last:border-b-0 hover:bg-slate-50"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setRequete(suggestion.nom);
                onChange(suggestion.nom);
                onSelection(suggestion);
                setOuvert(false);
              }}
            >
              <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-slate-800">{suggestion.nom}</span>
                <span className="mt-1 flex flex-wrap gap-1.5">
                  {badgeSecondaire(Boolean(suggestion.siret), `SIRET ${suggestion.siret}`)}
                  {badgeSecondaire(suggestion.est_service_public, "Service public")}
                  {badgeSecondaire(suggestion.est_association, "Association")}
                  {badgeSecondaire(Boolean(suggestion.collectivite_territoriale), suggestion.collectivite_territoriale)}
                </span>
                {suggestion.adresse ? (
                  <span className="mt-1 block text-xs text-slate-500">
                    Siège social: {suggestion.adresse}
                  </span>
                ) : null}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      {ouvert && !chargement && !erreurRecherche && requete.trim().length >= 3 && suggestions.length === 0 ? (
        <div className="absolute z-20 mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 shadow-lg">
          Aucune proposition trouvée dans l&apos;annuaire public.
        </div>
      ) : null}
    </div>
  );
}
