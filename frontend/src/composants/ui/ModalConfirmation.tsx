"use client";

// Composant ModalConfirmation : remplace les window.confirm() avec une modale accessible.
// Supporte trois variantes visuelles (danger, attention, info) et la fermeture sur Échap.

import { useEffect } from "react";
import { AlertTriangle, AlertCircle, Info, X } from "lucide-react";

interface ModalConfirmationProps {
  ouverte: boolean;
  titre: string;
  message: string;
  libelleBoutonConfirmer?: string;
  libelleBoutonAnnuler?: string;
  variante?: "danger" | "attention" | "info";
  chargement?: boolean;
  onConfirmer: () => void | Promise<void>;
  onAnnuler: () => void;
}

const CONFIG_VARIANTE = {
  danger: {
    icone: AlertTriangle,
    couleurIcone: "text-red-600",
    fondIcone: "bg-red-100",
    boutonConfirmer:
      "inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60",
  },
  attention: {
    icone: AlertCircle,
    couleurIcone: "text-orange-600",
    fondIcone: "bg-orange-100",
    boutonConfirmer:
      "inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60",
  },
  info: {
    icone: Info,
    couleurIcone: "text-blue-600",
    fondIcone: "bg-blue-100",
    boutonConfirmer:
      "inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60",
  },
};

export function ModalConfirmation({
  ouverte,
  titre,
  message,
  libelleBoutonConfirmer = "Confirmer",
  libelleBoutonAnnuler = "Annuler",
  variante = "danger",
  chargement = false,
  onConfirmer,
  onAnnuler,
}: ModalConfirmationProps) {
  // Fermeture sur Échap
  useEffect(() => {
    if (!ouverte) return;
    const gererTouche = (e: KeyboardEvent) => {
      if (e.key === "Escape") onAnnuler();
    };
    document.addEventListener("keydown", gererTouche);
    return () => document.removeEventListener("keydown", gererTouche);
  }, [ouverte, onAnnuler]);

  if (!ouverte) return null;

  const config = CONFIG_VARIANTE[variante];
  const Icone = config.icone;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) onAnnuler(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-titre"
    >
      <div className="w-full max-w-md animate-in fade-in zoom-in-95 rounded-2xl bg-white shadow-2xl duration-150">
        {/* En-tête */}
        <div className="flex items-start justify-between px-6 pt-6">
          <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${config.fondIcone}`}>
            <Icone className={`h-5 w-5 ${config.couleurIcone}`} />
          </div>
          <button
            type="button"
            onClick={onAnnuler}
            className="text-slate-400 transition hover:text-slate-600"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Corps */}
        <div className="px-6 py-4">
          <h3 id="modal-titre" className="text-base font-semibold text-slate-900">
            {titre}
          </h3>
          <p className="mt-2 text-sm text-slate-600 leading-relaxed">{message}</p>
        </div>

        {/* Boutons */}
        <div className="flex justify-end gap-3 rounded-b-2xl border-t border-slate-100 bg-slate-50 px-6 py-4">
          <button
            type="button"
            onClick={onAnnuler}
            disabled={chargement}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {libelleBoutonAnnuler}
          </button>
          <button
            type="button"
            onClick={() => void onConfirmer()}
            disabled={chargement}
            className={config.boutonConfirmer}
          >
            {chargement ? "En cours…" : libelleBoutonConfirmer}
          </button>
        </div>
      </div>
    </div>
  );
}
