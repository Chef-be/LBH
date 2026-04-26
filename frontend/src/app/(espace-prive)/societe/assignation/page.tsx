"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";

import { api } from "@/crochets/useApi";

interface ProjetOption {
  id: string;
  reference: string;
  intitule: string;
}

interface SuggestionAssignation {
  utilisateur: string;
  nom_complet: string;
  fonction: string;
  profil_droits: string;
  profil_horaire_libelle: string;
  nb_affectations: number;
  heures_30j: string;
  score: number;
}

export default function PageAssignationSociete() {
  const [projetId, setProjetId] = useState("");
  const [selection, setSelection] = useState<SuggestionAssignation | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const { data: projets = [] } = useQuery<ProjetOption[]>({
    queryKey: ["societe-assignation-projets"],
    queryFn: async () => {
      const reponse = await api.get<{ results?: ProjetOption[] } | ProjetOption[]>("/api/projets/");
      return Array.isArray(reponse) ? reponse : (reponse.results ?? []);
    },
  });

  const { data } = useQuery<{ suggestions: SuggestionAssignation[] }>({
    queryKey: ["societe-assignation-suggestions", projetId],
    enabled: Boolean(projetId),
    queryFn: () => api.get(`/api/societe/assignation-automatique/?projet=${projetId}`),
  });

  const mutation = useMutation({
    mutationFn: () => {
      if (!selection) throw new Error("Aucun salarié sélectionné.");
      return api.post<{ detail?: string }>("/api/societe/assignation-automatique/", {
        projet: projetId,
        utilisateur: selection.utilisateur,
        responsable: true,
        affectations: [
          {
            nature: "projet",
            code_cible: "",
            libelle_cible: "Pilotage du dossier",
            role: "pilotage",
          },
        ],
      });
    },
    onSuccess: (reponse: { detail?: string }) => setMessage(reponse.detail ?? "Assignation enregistrée."),
  });

  const suggestions = data?.suggestions ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 style={{ color: "var(--texte)" }}>Assignation automatique</h2>
        <p className="mt-1 text-sm" style={{ color: "var(--texte-3)" }}>
          Proposition de responsable en fonction de la charge, des affectations existantes et du profil salarié.
        </p>
      </div>

      {message ? (
        <div className="rounded-xl px-4 py-3 text-sm" style={{ background: "color-mix(in srgb, #16a34a 12%, var(--fond-carte))", border: "1px solid #16a34a", color: "var(--texte)" }}>
          {message}
        </div>
      ) : null}

      <section className="rounded-xl p-5" style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}>
        <label className="mb-1 block text-xs font-medium" style={{ color: "var(--texte-3)" }}>Projet à affecter</label>
        <select className="champ-saisie w-full max-w-2xl" value={projetId} onChange={(e) => { setProjetId(e.target.value); setSelection(null); }}>
          <option value="">Sélectionner un projet</option>
          {projets.map((projet) => (
            <option key={projet.id} value={projet.id}>{projet.reference} · {projet.intitule}</option>
          ))}
        </select>
      </section>

      {projetId ? (
        <section className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--bordure)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "var(--fond-entree)", borderBottom: "1px solid var(--bordure)" }}>
                {["Salarié", "Profil", "Charge 30 j", "Affectations", "Score", ""].map((titre) => (
                  <th key={titre} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--texte-3)" }}>{titre}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {suggestions.map((suggestion) => (
                <tr key={suggestion.utilisateur} style={{ borderBottom: "1px solid var(--bordure)" }}>
                  <td className="px-4 py-3">
                    <p className="font-medium" style={{ color: "var(--texte)" }}>{suggestion.nom_complet}</p>
                    <p className="text-xs" style={{ color: "var(--texte-3)" }}>{suggestion.fonction || suggestion.profil_droits}</p>
                  </td>
                  <td className="px-4 py-3" style={{ color: "var(--texte-2)" }}>{suggestion.profil_horaire_libelle || "Non défini"}</td>
                  <td className="px-4 py-3" style={{ color: "var(--texte-2)" }}>{Number(suggestion.heures_30j).toLocaleString("fr-FR")} h</td>
                  <td className="px-4 py-3" style={{ color: "var(--texte-2)" }}>{suggestion.nb_affectations}</td>
                  <td className="px-4 py-3 font-semibold" style={{ color: "var(--texte)" }}>{suggestion.score}</td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" onClick={() => setSelection(suggestion)} className="rounded-lg px-3 py-1.5 text-xs font-semibold" style={{ background: selection?.utilisateur === suggestion.utilisateur ? "var(--c-base)" : "var(--fond-entree)", color: selection?.utilisateur === suggestion.utilisateur ? "#fff" : "var(--texte-2)" }}>
                      Sélectionner
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      <button
        type="button"
        disabled={!projetId || !selection || mutation.isPending}
        onClick={() => mutation.mutate()}
        className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        style={{ background: "var(--c-base)" }}
      >
        <Sparkles size={14} />
        Assigner automatiquement
      </button>
    </div>
  );
}
