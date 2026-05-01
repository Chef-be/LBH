"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Sparkles } from "lucide-react";

import { api } from "@/crochets/useApi";
import { SuggestionAssignationAvancee } from "@/types/societe";

interface ProjetOption {
  id: string;
  reference: string;
  intitule: string;
}

function aujourdHui(): string {
  return new Date().toISOString().slice(0, 10);
}

function dansTrenteJours(): string {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date.toISOString().slice(0, 10);
}

function formaterHeures(valeur: string | number | null | undefined): string {
  const nombre = typeof valeur === "string" ? Number(valeur) : valeur;
  if (nombre == null || Number.isNaN(nombre)) return "0 h";
  return `${nombre.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} h`;
}

function formaterPourcentage(valeur: string | number | null | undefined): string {
  const nombre = typeof valeur === "string" ? Number(valeur) : valeur;
  if (nombre == null || Number.isNaN(nombre)) return "0 %";
  return `${(nombre * 100).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} %`;
}

function couleurScore(score: string): string {
  const valeur = Number(score);
  if (valeur >= 70) return "#16a34a";
  if (valeur >= 45) return "#f59e0b";
  return "#dc2626";
}

export default function PageAssignationSociete() {
  const client = useQueryClient();
  const [projetId, setProjetId] = useState("");
  const [dateDebut, setDateDebut] = useState(aujourdHui());
  const [dateFin, setDateFin] = useState(dansTrenteJours());
  const [heuresObjectif, setHeuresObjectif] = useState("21");
  const [priorite, setPriorite] = useState("normale");
  const [profilRecherche, setProfilRecherche] = useState("");
  const [selection, setSelection] = useState<SuggestionAssignationAvancee | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const { data: projets = [] } = useQuery<ProjetOption[]>({
    queryKey: ["societe-assignation-projets"],
    queryFn: async () => {
      const reponse = await api.get<{ results?: ProjetOption[] } | ProjetOption[]>("/api/projets/");
      return Array.isArray(reponse) ? reponse : (reponse.results ?? []);
    },
  });

  const query = useMemo(() => {
    const params = new URLSearchParams({
      projet: projetId,
      date_debut: dateDebut,
      date_fin: dateFin,
      heures_objectif: heuresObjectif || "0",
      priorite,
      profil_recherche: profilRecherche,
    });
    return params.toString();
  }, [dateDebut, dateFin, heuresObjectif, priorite, profilRecherche, projetId]);

  const { data, isFetching } = useQuery<{ suggestions: SuggestionAssignationAvancee[] }>({
    queryKey: ["societe-assignation-suggestions", query],
    enabled: Boolean(projetId),
    queryFn: () => api.get(`/api/societe/assignation-automatique/?${query}`),
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
            date_debut_prevue: dateDebut,
            date_fin_prevue: dateFin,
            heures_objectif: heuresObjectif || "0",
            priorite,
          },
        ],
      });
    },
    onSuccess: (reponse) => {
      setMessage(reponse.detail ?? "Assignation enregistrée.");
      setSelection(null);
      client.invalidateQueries({ queryKey: ["societe-assignation-suggestions"] });
    },
  });

  const suggestions = data?.suggestions ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 style={{ color: "var(--texte)" }}>Assignation automatique</h2>
        <p className="mt-1 text-sm" style={{ color: "var(--texte-3)" }}>
          Classement fondé sur la capacité RH, les absences, les pointages, la charge restante et la continuité dossier.
        </p>
      </div>

      {message ? (
        <div className="rounded-xl px-4 py-3 text-sm" style={{ background: "color-mix(in srgb, #16a34a 12%, var(--fond-carte))", border: "1px solid #16a34a", color: "var(--texte)" }}>
          {message}
        </div>
      ) : null}

      <section className="rounded-xl p-5" style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}>
        <div className="grid gap-4 lg:grid-cols-6">
          <label className="lg:col-span-2">
            <span className="mb-1 block text-xs font-medium" style={{ color: "var(--texte-3)" }}>Projet</span>
            <select className="champ-saisie w-full" value={projetId} onChange={(e) => { setProjetId(e.target.value); setSelection(null); }}>
              <option value="">Sélectionner un projet</option>
              {projets.map((projet) => (
                <option key={projet.id} value={projet.id}>{projet.reference} · {projet.intitule}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium" style={{ color: "var(--texte-3)" }}>Début</span>
            <input className="champ-saisie w-full" type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} />
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium" style={{ color: "var(--texte-3)" }}>Fin</span>
            <input className="champ-saisie w-full" type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} />
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium" style={{ color: "var(--texte-3)" }}>Heures objectif</span>
            <input className="champ-saisie w-full" type="number" min="0" step="0.5" value={heuresObjectif} onChange={(e) => setHeuresObjectif(e.target.value)} />
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium" style={{ color: "var(--texte-3)" }}>Priorité</span>
            <select className="champ-saisie w-full" value={priorite} onChange={(e) => setPriorite(e.target.value)}>
              <option value="basse">Basse</option>
              <option value="normale">Normale</option>
              <option value="haute">Haute</option>
              <option value="urgente">Urgente</option>
            </select>
          </label>
          <label className="lg:col-span-2">
            <span className="mb-1 block text-xs font-medium" style={{ color: "var(--texte-3)" }}>Profil recherché</span>
            <input className="champ-saisie w-full" value={profilRecherche} onChange={(e) => setProfilRecherche(e.target.value)} placeholder="Économiste, OPC, senior…" />
          </label>
        </div>
      </section>

      <section className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--bordure)", background: "var(--fond-carte)" }}>
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--bordure)" }}>
          <h3 className="text-sm font-semibold" style={{ color: "var(--texte)" }}>Propositions de charge</h3>
          <span className="text-xs" style={{ color: "var(--texte-3)" }}>{isFetching ? "Calcul en cours…" : `${suggestions.length} salarié(s)`}</span>
        </div>
        {!projetId ? (
          <p className="p-6 text-sm" style={{ color: "var(--texte-3)" }}>Sélectionner un projet pour calculer les propositions.</p>
        ) : suggestions.length === 0 ? (
          <p className="p-6 text-sm" style={{ color: "var(--texte-3)" }}>Aucune proposition disponible sur cette période.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "var(--fond-entree)", borderBottom: "1px solid var(--bordure)" }}>
                  {["Salarié", "Disponibilité", "Charge", "Objectifs", "Pointage", "Score", "Alertes", ""].map((titre) => (
                    <th key={titre} className="px-4 py-3 text-left text-xs font-semibold uppercase" style={{ color: "var(--texte-3)" }}>{titre}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {suggestions.map((suggestion) => (
                  <tr key={suggestion.utilisateur} style={{ borderBottom: "1px solid var(--bordure)" }}>
                    <td className="px-4 py-3 min-w-[220px]">
                      <p className="font-medium" style={{ color: "var(--texte)" }}>{suggestion.nom_complet}</p>
                      <p className="text-xs" style={{ color: "var(--texte-3)" }}>{suggestion.profil_horaire_libelle || suggestion.profil || "Profil à définir"}</p>
                      <p className="mt-1 text-xs" style={{ color: "var(--texte-2)" }}>{suggestion.justification}</p>
                    </td>
                    <td className="px-4 py-3" style={{ color: "var(--texte-2)" }}>
                      {formaterPourcentage(suggestion.disponibilite)}
                      <p className="text-xs" style={{ color: "var(--texte-3)" }}>{formaterHeures(suggestion.heures_disponibles)} dispo.</p>
                    </td>
                    <td className="px-4 py-3" style={{ color: "var(--texte-2)" }}>
                      {formaterPourcentage(suggestion.taux_charge)}
                      <p className="text-xs" style={{ color: "var(--texte-3)" }}>{formaterHeures(suggestion.heures_deja_affectees)} affectées</p>
                    </td>
                    <td className="px-4 py-3" style={{ color: "var(--texte-2)" }}>
                      {formaterHeures(suggestion.heures_theoriques)}
                      <p className="text-xs" style={{ color: "var(--texte-3)" }}>{formaterHeures(suggestion.heures_deja_realisees)} réalisées</p>
                    </td>
                    <td className="px-4 py-3" style={{ color: "var(--texte-2)" }}>
                      {formaterHeures(suggestion.heures_pointees)}
                      <p className="text-xs" style={{ color: "var(--texte-3)" }}>{formaterHeures(suggestion.heures_absences_validees)} absence</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold" style={{ background: `color-mix(in srgb, ${couleurScore(suggestion.score)} 12%, var(--fond-carte))`, color: couleurScore(suggestion.score) }}>
                        {Number(suggestion.score).toLocaleString("fr-FR", { maximumFractionDigits: 0 })}
                      </span>
                    </td>
                    <td className="px-4 py-3 min-w-[180px]">
                      {suggestion.alertes.length === 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs" style={{ color: "#16a34a" }}><CheckCircle2 size={13} /> Disponible</span>
                      ) : (
                        <div className="space-y-1">
                          {suggestion.alertes.map((alerte) => (
                            <span key={alerte} className="flex items-center gap-1 text-xs" style={{ color: "#f59e0b" }}><AlertTriangle size={13} /> {alerte}</span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button type="button" onClick={() => setSelection(suggestion)} className="rounded-lg px-3 py-1.5 text-xs font-semibold" style={{ background: selection?.utilisateur === suggestion.utilisateur ? "var(--c-base)" : "var(--fond-entree)", color: selection?.utilisateur === suggestion.utilisateur ? "#fff" : "var(--texte-2)" }}>
                        Sélectionner
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <button
        type="button"
        disabled={!projetId || !selection || mutation.isPending}
        onClick={() => mutation.mutate()}
        className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        style={{ background: "var(--c-base)" }}
      >
        <Sparkles size={14} />
        Assigner avec justification RH
      </button>
    </div>
  );
}
