"use client";

import { useEffect, useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import { api } from "@/crochets/useApi";
import type { SuggestionAdressePublique } from "@/lib/organisations";

export function ChampAdresseRecherche({
  id,
  value,
  onChange,
  onSelection,
  placeholder,
  className = "champ-saisie",
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onSelection: (suggestion: SuggestionAdressePublique) => void;
  placeholder?: string;
  className?: string;
}) {
  const [requete, setRequete] = useState(value);
  const [suggestions, setSuggestions] = useState<SuggestionAdressePublique[]>([]);
  const [chargement, setChargement] = useState(false);
  const [ouvert, setOuvert] = useState(false);

  useEffect(() => {
    setRequete(value);
  }, [value]);

  useEffect(() => {
    const recherche = requete.trim();
    if (recherche.length < 3) {
      setSuggestions([]);
      setChargement(false);
      return;
    }

    let actif = true;
    const timer = window.setTimeout(async () => {
      setChargement(true);
      try {
        const reponse = await api.get<{ results: SuggestionAdressePublique[] }>(
          `/api/organisations/recherche-adresses/?q=${encodeURIComponent(recherche)}&limit=5`
        );
        if (!actif) return;
        setSuggestions(reponse.results ?? []);
        setOuvert(true);
      } catch {
        if (!actif) return;
        setSuggestions([]);
      } finally {
        if (actif) setChargement(false);
      }
    }, 300);

    return () => {
      actif = false;
      window.clearTimeout(timer);
    };
  }, [requete]);

  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        className={className}
        value={requete}
        onChange={(e) => {
          setRequete(e.target.value);
          onChange(e.target.value);
          setOuvert(true);
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

      {ouvert && suggestions.length ? (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.id}
              type="button"
              className="flex w-full items-start gap-3 border-b border-slate-100 px-3 py-3 text-left last:border-b-0 hover:bg-slate-50"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setRequete(suggestion.adresse || suggestion.label);
                onChange(suggestion.adresse || suggestion.label);
                onSelection(suggestion);
                setOuvert(false);
              }}
            >
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-slate-800">{suggestion.label}</span>
                {suggestion.contexte ? (
                  <span className="mt-0.5 block truncate text-xs text-slate-500">{suggestion.contexte}</span>
                ) : null}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
