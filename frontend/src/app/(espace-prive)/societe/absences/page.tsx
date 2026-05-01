"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, X } from "lucide-react";

import { api } from "@/crochets/useApi";
import { DemandeAbsence } from "@/types/societe";

function couleurStatut(statut: string): string {
  if (statut === "valide") return "#16a34a";
  if (statut === "refuse") return "#dc2626";
  if (statut === "soumis") return "#f59e0b";
  return "var(--texte-3)";
}

export default function PageAbsencesSociete() {
  const client = useQueryClient();
  const { data, isLoading } = useQuery<{ results?: DemandeAbsence[] } | DemandeAbsence[]>({
    queryKey: ["societe-absences"],
    queryFn: () => api.get("/api/societe/absences/"),
  });
  const demandes = Array.isArray(data) ? data : (data?.results ?? []);

  const action = useMutation({
    mutationFn: ({ id, type }: { id: string; type: "valider" | "refuser" }) =>
      api.post<DemandeAbsence>(`/api/societe/absences/${id}/${type}/`, {}),
    onSuccess: () => client.invalidateQueries({ queryKey: ["societe-absences"] }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 style={{ color: "var(--texte)" }}>Absences et RTT</h2>
        <p className="mt-1 text-sm" style={{ color: "var(--texte-3)" }}>Validation des demandes et suivi de leur impact sur la capacité de production.</p>
      </div>

      <section className="rounded-xl overflow-hidden" style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}>
        {isLoading ? (
          <p className="p-6 text-sm" style={{ color: "var(--texte-3)" }}>Chargement…</p>
        ) : demandes.length === 0 ? (
          <p className="p-6 text-sm" style={{ color: "var(--texte-3)" }}>Aucune demande d’absence.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "var(--fond-entree)" }}>
                {["Salarié", "Type", "Période", "Impact", "Statut", ""].map((titre) => (
                  <th key={titre} className="px-4 py-3 text-left text-xs uppercase" style={{ color: "var(--texte-3)" }}>{titre}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {demandes.map((demande) => (
                <tr key={demande.id} style={{ borderTop: "1px solid var(--bordure)" }}>
                  <td className="px-4 py-3 font-medium" style={{ color: "var(--texte)" }}>{demande.utilisateur_nom}</td>
                  <td className="px-4 py-3" style={{ color: "var(--texte-2)" }}>{demande.type_absence_libelle}</td>
                  <td className="px-4 py-3" style={{ color: "var(--texte-2)" }}>{demande.date_debut} → {demande.date_fin}</td>
                  <td className="px-4 py-3" style={{ color: "var(--texte-2)" }}>{demande.nombre_jours_ouvres_calcule} j · {demande.nombre_heures_calcule} h</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full px-2 py-1 text-xs font-semibold" style={{ background: `color-mix(in srgb, ${couleurStatut(demande.statut)} 12%, var(--fond-carte))`, color: couleurStatut(demande.statut) }}>
                      {demande.statut_libelle}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {demande.statut === "soumis" ? (
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => action.mutate({ id: demande.id, type: "valider" })} className="rounded-lg p-2 text-white" style={{ background: "#16a34a" }} aria-label="Valider">
                          <Check size={14} />
                        </button>
                        <button type="button" onClick={() => action.mutate({ id: demande.id, type: "refuser" })} className="rounded-lg p-2 text-white" style={{ background: "#dc2626" }} aria-label="Refuser">
                          <X size={14} />
                        </button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
