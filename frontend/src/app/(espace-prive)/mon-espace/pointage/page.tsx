"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, Coffee, LogIn, LogOut } from "lucide-react";

import { api } from "@/crochets/useApi";
import { PointageJournalier } from "@/types/societe";

function dateIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function heureLocale(): string {
  return new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export default function PagePointageSalarie() {
  const client = useQueryClient();
  const aujourdHui = dateIso();

  const { data } = useQuery<{ results?: PointageJournalier[] } | PointageJournalier[]>({
    queryKey: ["mon-pointage", aujourdHui],
    queryFn: () => api.get(`/api/societe/pointages/?date=${aujourdHui}`),
  });

  const pointages = Array.isArray(data) ? data : (data?.results ?? []);
  const pointage = pointages.find((item) => item.date === aujourdHui);

  const action = useMutation({
    mutationFn: (chemin: string) => api.post<PointageJournalier>(chemin, chemin.includes("pause") ? { minutes: 60 } : {}),
    onSuccess: () => client.invalidateQueries({ queryKey: ["mon-pointage"] }),
  });

  const boutons = [
    { label: "Pointer arrivée", icone: <LogIn size={18} />, chemin: "/api/societe/pointages/pointer-arrivee/", actif: !pointage?.heure_arrivee },
    { label: "Début pause", icone: <Coffee size={18} />, chemin: "/api/societe/pointages/debut-pause/", actif: Boolean(pointage?.heure_arrivee && !pointage?.heure_depart) },
    { label: "Fin pause", icone: <Coffee size={18} />, chemin: "/api/societe/pointages/fin-pause/", actif: Boolean(pointage?.heure_arrivee && !pointage?.heure_depart) },
    { label: "Pointer départ", icone: <LogOut size={18} />, chemin: "/api/societe/pointages/pointer-depart/", actif: Boolean(pointage?.heure_arrivee && !pointage?.heure_depart) },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 style={{ color: "var(--texte)" }}>Mon pointage</h2>
        <p className="mt-1 text-sm" style={{ color: "var(--texte-3)" }}>Heure serveur estimée : {heureLocale()}</p>
      </div>

      <section className="rounded-xl p-5" style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}>
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="rounded-lg p-4" style={{ background: "var(--fond-entree)", border: "1px solid var(--bordure)" }}>
            <p className="text-xs" style={{ color: "var(--texte-3)" }}>Arrivée</p>
            <p className="mt-1 text-xl font-semibold" style={{ color: "var(--texte)" }}>{pointage?.heure_arrivee?.slice(0, 5) ?? "—"}</p>
          </div>
          <div className="rounded-lg p-4" style={{ background: "var(--fond-entree)", border: "1px solid var(--bordure)" }}>
            <p className="text-xs" style={{ color: "var(--texte-3)" }}>Départ</p>
            <p className="mt-1 text-xl font-semibold" style={{ color: "var(--texte)" }}>{pointage?.heure_depart?.slice(0, 5) ?? "—"}</p>
          </div>
          <div className="rounded-lg p-4" style={{ background: "var(--fond-entree)", border: "1px solid var(--bordure)" }}>
            <p className="text-xs" style={{ color: "var(--texte-3)" }}>Pause</p>
            <p className="mt-1 text-xl font-semibold" style={{ color: "var(--texte)" }}>{pointage?.pause_minutes ?? 0} min</p>
          </div>
          <div className="rounded-lg p-4" style={{ background: "var(--fond-entree)", border: "1px solid var(--bordure)" }}>
            <p className="text-xs" style={{ color: "var(--texte-3)" }}>Total</p>
            <p className="mt-1 text-xl font-semibold" style={{ color: "var(--texte)" }}>{pointage?.heures_travaillees ?? "0.00"} h</p>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {boutons.map((bouton) => (
          <button
            key={bouton.label}
            type="button"
            disabled={!bouton.actif || action.isPending}
            onClick={() => action.mutate(bouton.chemin)}
            className="inline-flex min-h-20 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-45"
            style={{ background: "var(--c-base)" }}
          >
            {bouton.icone}
            {bouton.label}
          </button>
        ))}
      </section>

      {action.error ? (
        <div className="rounded-xl px-4 py-3 text-sm" style={{ background: "color-mix(in srgb, #dc2626 12%, var(--fond-carte))", border: "1px solid #dc2626", color: "var(--texte)" }}>
          {(action.error as Error).message}
        </div>
      ) : null}

      <section className="rounded-xl p-5" style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}>
        <h3 className="text-sm font-semibold" style={{ color: "var(--texte)" }}>Historique récent</h3>
        <div className="mt-3 divide-y" style={{ borderColor: "var(--bordure)" }}>
          {pointages.length === 0 ? (
            <p className="py-4 text-sm" style={{ color: "var(--texte-3)" }}>Aucun pointage enregistré.</p>
          ) : pointages.slice(0, 7).map((item) => (
            <div key={item.id} className="flex items-center justify-between py-3 text-sm">
              <span style={{ color: "var(--texte)" }}><Clock size={14} className="mr-2 inline" />{new Date(item.date).toLocaleDateString("fr-FR")}</span>
              <span style={{ color: "var(--texte-2)" }}>{item.heures_travaillees} h · {item.statut_libelle}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
