"use client";

// Composant TableauCRUD : liste générique avec recherche, pagination et skeleton de chargement.
// Factorise la logique commune à toutes les pages admin (liste + pagination + recherche).

import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";

export interface ColonneTableau<T> {
  id: string;
  entete: string;
  rendu: (item: T) => React.ReactNode;
  largeur?: string;
}

interface PaginationProps {
  page: number;
  total: number;
  parPage: number;
  onChange: (page: number) => void;
}

interface TableauCRUDProps<T> {
  colonnes: ColonneTableau<T>[];
  donnees: T[];
  cle?: (item: T) => string;
  chargement?: boolean;
  rechercheActive?: boolean;
  valeurRecherche?: string;
  onRecherche?: (valeur: string) => void;
  pagination?: PaginationProps;
  actions?: (item: T) => React.ReactNode;
  messageVide?: string;
  className?: string;
}

function Pagination({ page, total, parPage, onChange }: PaginationProps) {
  const nbPages = Math.ceil(total / parPage);
  if (nbPages <= 1) return null;

  const pages: number[] = [];
  for (let i = 1; i <= nbPages; i++) {
    if (i === 1 || i === nbPages || (i >= page - 2 && i <= page + 2)) {
      pages.push(i);
    }
  }

  // Insérer les ellipses
  const avecEllipses: Array<number | "..."> = [];
  for (let i = 0; i < pages.length; i++) {
    if (i > 0 && pages[i] - pages[i - 1] > 1) {
      avecEllipses.push("...");
    }
    avecEllipses.push(pages[i]);
  }

  return (
    <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
      <p className="text-xs text-slate-500">
        {total} élément{total > 1 ? "s" : ""}
      </p>
      <div className="flex items-center gap-1">
        {avecEllipses.map((p, i) =>
          p === "..." ? (
            <span key={`ellipse-${i}`} className="px-2 text-slate-400 text-sm">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onChange(p)}
              className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-medium transition ${
                p === page
                  ? "bg-primaire-600 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {p}
            </button>
          )
        )}
      </div>
    </div>
  );
}

export function TableauCRUD<T>({
  colonnes,
  donnees,
  cle,
  chargement = false,
  rechercheActive = false,
  valeurRecherche = "",
  onRecherche,
  pagination,
  actions,
  messageVide = "Aucun élément à afficher.",
  className = "",
}: TableauCRUDProps<T>) {
  const [rechercheCourante, setRechercheCourante] = useState(valeurRecherche);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Synchronise la valeur externe
  useEffect(() => {
    setRechercheCourante(valeurRecherche);
  }, [valeurRecherche]);

  const gererRecherche = (valeur: string) => {
    setRechercheCourante(valeur);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onRecherche?.(valeur);
    }, 300);
  };

  const colonnesAvecActions = actions
    ? [...colonnes, { id: "__actions__", entete: "", rendu: actions, largeur: "w-auto" }]
    : colonnes;

  return (
    <div className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`.trim()}>
      {/* Barre de recherche */}
      {rechercheActive && (
        <div className="border-b border-slate-100 px-4 py-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={rechercheCourante}
              onChange={(e) => gererRecherche(e.target.value)}
              placeholder="Rechercher…"
              className="champ-saisie w-full pl-9"
            />
          </div>
        </div>
      )}

      {/* Tableau */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              {colonnesAvecActions.map((col) => (
                <th
                  key={col.id}
                  className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 ${col.largeur ?? ""}`}
                >
                  {col.entete}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {chargement ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {colonnesAvecActions.map((col) => (
                    <td key={col.id} className="px-4 py-3">
                      <div className="h-4 animate-pulse rounded-lg bg-slate-200" />
                    </td>
                  ))}
                </tr>
              ))
            ) : donnees.length === 0 ? (
              <tr>
                <td
                  colSpan={colonnesAvecActions.length}
                  className="px-4 py-12 text-center text-sm text-slate-400"
                >
                  {messageVide}
                </td>
              </tr>
            ) : (
              donnees.map((item, i) => (
                <tr
                  key={cle ? cle(item) : i}
                  className="transition-colors hover:bg-slate-50"
                >
                  {colonnesAvecActions.map((col) => (
                    <td key={col.id} className={`px-4 py-3 ${col.largeur ?? ""}`}>
                      {col.rendu(item)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && !chargement && donnees.length > 0 && (
        <Pagination {...pagination} />
      )}
    </div>
  );
}
