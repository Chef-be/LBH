"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";

import { api } from "@/crochets/useApi";
import type { ProfilHoraire } from "@/types/societe";

interface MissionParametrage {
  id: string;
  code: string;
  libelle: string;
  description: string;
  famille_client: string;
  nature_ouvrage: string;
  phases_concernees: string[];
  sous_types_client: string[];
  est_active: boolean;
  est_obligatoire: boolean;
  profil_horaire_defaut: string | null;
  profil_horaire_defaut_libelle: string;
  duree_etude_heures: string;
  ordre: number;
  livrables_count: number;
}

const FAMILLES: Record<string, string> = {
  maitrise_ouvrage: "MOA publique / privée",
  maitrise_oeuvre: "MOE",
  entreprise: "Entreprise",
  autre: "Autre",
};

const NATURES: Record<string, string> = {
  batiment: "Bâtiment",
  infrastructure: "Infrastructure / VRD",
  mixte: "Mixte",
  tous: "Tous",
};

export default function PageMissionsSociete() {
  const queryClient = useQueryClient();
  const [famille, setFamille] = useState("");

  const { data: missions = [] } = useQuery<MissionParametrage[]>({
    queryKey: ["societe-missions-client", famille],
    queryFn: async () => {
      const url = famille ? `/api/societe/missions-client/?famille_client=${famille}` : "/api/societe/missions-client/";
      const reponse = await api.get<{ results?: MissionParametrage[] } | MissionParametrage[]>(url);
      return Array.isArray(reponse) ? reponse : (reponse.results ?? []);
    },
  });

  const { data: profils = [] } = useQuery<ProfilHoraire[]>({
    queryKey: ["societe-profils-horaires-missions"],
    queryFn: async () => {
      const reponse = await api.get<{ results?: ProfilHoraire[] } | ProfilHoraire[]>("/api/societe/profils-horaires/?actif=true");
      return Array.isArray(reponse) ? reponse : (reponse.results ?? []);
    },
  });

  const mutation = useMutation({
    mutationFn: ({ mission, patch }: { mission: MissionParametrage; patch: Partial<MissionParametrage> }) =>
      api.patch(`/api/societe/missions-client/${mission.id}/`, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["societe-missions-client"] }),
  });

  const maj = (mission: MissionParametrage, patch: Partial<MissionParametrage>) => {
    mutation.mutate({ mission, patch });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 style={{ color: "var(--texte)" }}>Paramétrage des missions</h2>
        <p className="mt-1 text-sm" style={{ color: "var(--texte-3)" }}>
          Durées d’étude, profils et livrables qui alimentent automatiquement le chiffrage.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setFamille("")} className="rounded-lg px-3 py-2 text-xs font-semibold" style={{ background: !famille ? "var(--c-base)" : "var(--fond-entree)", color: !famille ? "#fff" : "var(--texte-2)" }}>Toutes</button>
        {Object.entries(FAMILLES).map(([code, libelle]) => (
          <button key={code} type="button" onClick={() => setFamille(code)} className="rounded-lg px-3 py-2 text-xs font-semibold" style={{ background: famille === code ? "var(--c-base)" : "var(--fond-entree)", color: famille === code ? "#fff" : "var(--texte-2)" }}>{libelle}</button>
        ))}
      </div>

      <div className="space-y-3">
        {missions.map((mission) => (
          <div key={mission.id} className="rounded-xl p-4" style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}>
            <div className="grid gap-4 xl:grid-cols-[1.2fr_160px_220px_120px_120px]">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold" style={{ color: "var(--texte)" }}>{mission.libelle}</p>
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: "var(--fond-entree)", color: "var(--texte-3)" }}>{FAMILLES[mission.famille_client] ?? mission.famille_client}</span>
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: "var(--fond-entree)", color: "var(--texte-3)" }}>{NATURES[mission.nature_ouvrage] ?? mission.nature_ouvrage}</span>
                </div>
                <p className="mt-1 text-sm" style={{ color: "var(--texte-3)" }}>{mission.description || `${mission.livrables_count} livrable(s)`}</p>
              </div>
              <div>
                <label className="mb-1 block text-xs" style={{ color: "var(--texte-3)" }}>Durée défaut</label>
                <input
                  type="number"
                  className="champ-saisie w-full"
                  defaultValue={mission.duree_etude_heures}
                  onBlur={(e) => maj(mission, { duree_etude_heures: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs" style={{ color: "var(--texte-3)" }}>Profil par défaut</label>
                <select
                  className="champ-saisie w-full"
                  value={mission.profil_horaire_defaut ?? ""}
                  onChange={(e) => maj(mission, { profil_horaire_defaut: e.target.value || null })}
                >
                  <option value="">Aucun</option>
                  {profils.map((profil) => <option key={profil.id} value={profil.id}>{profil.libelle}</option>)}
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm" style={{ color: "var(--texte-2)" }}>
                <input type="checkbox" checked={mission.est_obligatoire} onChange={(e) => maj(mission, { est_obligatoire: e.target.checked })} />
                Recommandée
              </label>
              <label className="flex items-center gap-2 text-sm" style={{ color: "var(--texte-2)" }}>
                <input type="checkbox" checked={mission.est_active} onChange={(e) => maj(mission, { est_active: e.target.checked })} />
                Active
              </label>
            </div>
          </div>
        ))}
      </div>

      {mutation.isPending ? (
        <p className="inline-flex items-center gap-2 text-sm" style={{ color: "var(--texte-3)" }}>
          <Save size={14} /> Enregistrement…
        </p>
      ) : null}
    </div>
  );
}
