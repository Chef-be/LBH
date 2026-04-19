"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Settings2, Plus, Save, Trash2 } from "lucide-react";
import { api, ErreurApi } from "@/crochets/useApi";
import { useNotifications } from "@/contextes/FournisseurNotifications";

interface ProfilMainOeuvre {
  id: string;
  libelle: string;
  code: string;
}

interface ModelePhaseEtude {
  id: string;
  code: string;
  libelle: string;
  description: string;
  ordre: number;
  role_intervenant: string;
  role_intervenant_libelle: string;
  specialite_requise: string;
  niveau_intervention: string;
  duree_previsionnelle_jours: string;
  profil_main_oeuvre: string | null;
  profil_main_oeuvre_libelle: string | null;
  est_actif: boolean;
}

interface FormulaireModele {
  id?: string;
  code: string;
  libelle: string;
  description: string;
  ordre: string;
  role_intervenant: string;
  specialite_requise: string;
  niveau_intervention: string;
  duree_previsionnelle_jours: string;
  profil_main_oeuvre: string;
  est_actif: boolean;
}

const ETAT_INITIAL: FormulaireModele = {
  code: "",
  libelle: "",
  description: "",
  ordre: "10",
  role_intervenant: "economiste",
  specialite_requise: "",
  niveau_intervention: "",
  duree_previsionnelle_jours: "1.00",
  profil_main_oeuvre: "",
  est_actif: true,
};

function extraireListe<T>(reponse: T[] | { results?: T[] }) {
  return Array.isArray(reponse) ? reponse : (reponse.results ?? []);
}

export default function PageAdministrationPhasesEtudes() {
  const notifications = useNotifications();
  const [formulaire, setFormulaire] = useState<FormulaireModele>(ETAT_INITIAL);
  const [enregistrementEnCours, setEnregistrementEnCours] = useState(false);
  const [suppressionEnCours, setSuppressionEnCours] = useState<string | null>(null);

  const { data: modeles = [], refetch: rechargerModeles } = useQuery<ModelePhaseEtude[]>({
    queryKey: ["administration-modeles-phases-etudes"],
    queryFn: async () => extraireListe(
      await api.get<ModelePhaseEtude[] | { results?: ModelePhaseEtude[] }>("/api/economie/modeles-phases-etudes/")
    ),
  });

  const { data: profils = [] } = useQuery<ProfilMainOeuvre[]>({
    queryKey: ["administration-profils-main-oeuvre-liste"],
    queryFn: async () => extraireListe(
      await api.get<ProfilMainOeuvre[] | { results?: ProfilMainOeuvre[] }>("/api/economie/profils-main-oeuvre/?actifs=1")
    ),
  });

  const modelesTries = useMemo(
    () => [...modeles].sort((a, b) => a.ordre - b.ordre || a.libelle.localeCompare(b.libelle, "fr-FR")),
    [modeles]
  );

  function charger(modele: ModelePhaseEtude) {
    setFormulaire({
      id: modele.id,
      code: modele.code,
      libelle: modele.libelle,
      description: modele.description || "",
      ordre: String(modele.ordre),
      role_intervenant: modele.role_intervenant,
      specialite_requise: modele.specialite_requise || "",
      niveau_intervention: modele.niveau_intervention || "",
      duree_previsionnelle_jours: String(modele.duree_previsionnelle_jours ?? "1.00"),
      profil_main_oeuvre: modele.profil_main_oeuvre || "",
      est_actif: modele.est_actif,
    });
  }

  function reinitialiser() {
    setFormulaire(ETAT_INITIAL);
  }

  async function enregistrer() {
    setEnregistrementEnCours(true);
    try {
      const payload = {
        code: formulaire.code.trim(),
        libelle: formulaire.libelle.trim(),
        description: formulaire.description.trim(),
        ordre: Number(formulaire.ordre || 0),
        role_intervenant: formulaire.role_intervenant,
        specialite_requise: formulaire.specialite_requise.trim(),
        niveau_intervention: formulaire.niveau_intervention.trim(),
        duree_previsionnelle_jours: formulaire.duree_previsionnelle_jours || "0",
        profil_main_oeuvre: formulaire.profil_main_oeuvre || null,
        est_actif: formulaire.est_actif,
      };
      if (formulaire.id) {
        await api.patch(`/api/economie/modeles-phases-etudes/${formulaire.id}/`, payload);
        notifications.succes("Modèle de phase mis à jour.");
      } else {
        await api.post("/api/economie/modeles-phases-etudes/", payload);
        notifications.succes("Modèle de phase créé.");
      }
      reinitialiser();
      await rechargerModeles();
    } catch (erreur) {
      notifications.erreur(
        erreur instanceof ErreurApi ? erreur.detail : "Impossible d'enregistrer ce modèle."
      );
    } finally {
      setEnregistrementEnCours(false);
    }
  }

  async function supprimer(modele: ModelePhaseEtude) {
    setSuppressionEnCours(modele.id);
    try {
      await api.supprimer(`/api/economie/modeles-phases-etudes/${modele.id}/`);
      notifications.succes(`Modèle « ${modele.libelle} » supprimé.`);
      if (formulaire.id === modele.id) {
        reinitialiser();
      }
      await rechargerModeles();
    } catch (erreur) {
      notifications.erreur(
        erreur instanceof ErreurApi ? erreur.detail : "Suppression impossible."
      );
    } finally {
      setSuppressionEnCours(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="flex items-center gap-2">
            <Settings2 size={20} /> Phases d&apos;études économiques
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Paramètre les phases, les types d&apos;intervenants, les spécialités et les durées qui serviront à la création et à l&apos;affectation automatique des études.
          </p>
        </div>
        <button type="button" onClick={reinitialiser} className="btn-secondaire text-sm inline-flex items-center gap-1 self-start">
          <Plus size={14} /> Nouveau modèle
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.95fr]">
        <section className="carte space-y-4">
          <div className="flex items-center justify-between">
            <h2>Modèles enregistrés</h2>
            <span className="badge-neutre">{modelesTries.length} phase{modelesTries.length > 1 ? "s" : ""}</span>
          </div>
          <div className="space-y-3">
            {modelesTries.map((modele) => (
              <article key={modele.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-slate-900">{modele.ordre}. {modele.libelle}</h3>
                      <span className="badge-neutre">{modele.role_intervenant_libelle}</span>
                      {!modele.est_actif && <span className="badge-danger">Inactif</span>}
                    </div>
                    <p className="mt-1 text-xs font-mono text-slate-400">{modele.code}</p>
                    {modele.description && <p className="mt-2 text-sm text-slate-600">{modele.description}</p>}
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => charger(modele)} className="btn-secondaire text-xs">
                      Modifier
                    </button>
                    <button
                      type="button"
                      onClick={() => supprimer(modele)}
                      disabled={suppressionEnCours === modele.id}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700"
                    >
                      <Trash2 size={12} />
                      {suppressionEnCours === modele.id ? "Suppression…" : "Supprimer"}
                    </button>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 text-sm md:grid-cols-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">Durée</p>
                    <p className="mt-1 font-medium text-slate-800">{modele.duree_previsionnelle_jours} j</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">Spécialité</p>
                    <p className="mt-1 font-medium text-slate-800">{modele.specialite_requise || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">Niveau</p>
                    <p className="mt-1 font-medium text-slate-800">{modele.niveau_intervention || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">Profil DHMO</p>
                    <p className="mt-1 font-medium text-slate-800">{modele.profil_main_oeuvre_libelle || "—"}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <aside className="carte space-y-4">
          <div>
            <h2>{formulaire.id ? "Modifier le modèle" : "Nouveau modèle"}</h2>
            <p className="mt-1 text-sm text-slate-500">
              Ce modèle sera recopié à la création d&apos;une étude économique puis utilisé par l&apos;auto-affectation.
            </p>
          </div>

          <div className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="libelle-champ">Code</label>
                <input className="champ-saisie w-full" value={formulaire.code} onChange={(event) => setFormulaire((precedent) => ({ ...precedent, code: event.target.value }))} />
              </div>
              <div>
                <label className="libelle-champ">Ordre</label>
                <input className="champ-saisie w-full" type="number" min="0" value={formulaire.ordre} onChange={(event) => setFormulaire((precedent) => ({ ...precedent, ordre: event.target.value }))} />
              </div>
            </div>

            <div>
              <label className="libelle-champ">Libellé</label>
              <input className="champ-saisie w-full" value={formulaire.libelle} onChange={(event) => setFormulaire((precedent) => ({ ...precedent, libelle: event.target.value }))} />
            </div>

            <div>
              <label className="libelle-champ">Description</label>
              <textarea className="champ-saisie min-h-[100px] w-full" value={formulaire.description} onChange={(event) => setFormulaire((precedent) => ({ ...precedent, description: event.target.value }))} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="libelle-champ">Type d&apos;intervenant</label>
                <select className="champ-saisie w-full" value={formulaire.role_intervenant} onChange={(event) => setFormulaire((precedent) => ({ ...precedent, role_intervenant: event.target.value }))}>
                  <option value="responsable">Responsable</option>
                  <option value="charge_affaires">Chargé d&apos;affaires</option>
                  <option value="economiste">Économiste</option>
                  <option value="redacteur">Rédacteur</option>
                  <option value="verificateur">Vérificateur</option>
                  <option value="conducteur_travaux">Conducteur de travaux</option>
                </select>
              </div>
              <div>
                <label className="libelle-champ">Durée prévisionnelle (j)</label>
                <input className="champ-saisie w-full" type="number" min="0" step="0.25" value={formulaire.duree_previsionnelle_jours} onChange={(event) => setFormulaire((precedent) => ({ ...precedent, duree_previsionnelle_jours: event.target.value }))} />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="libelle-champ">Spécialité requise</label>
                <input className="champ-saisie w-full" value={formulaire.specialite_requise} onChange={(event) => setFormulaire((precedent) => ({ ...precedent, specialite_requise: event.target.value }))} />
              </div>
              <div>
                <label className="libelle-champ">Niveau d&apos;intervention</label>
                <input className="champ-saisie w-full" value={formulaire.niveau_intervention} onChange={(event) => setFormulaire((precedent) => ({ ...precedent, niveau_intervention: event.target.value }))} />
              </div>
            </div>

            <div>
              <label className="libelle-champ">Profil DHMO conseillé</label>
              <select className="champ-saisie w-full" value={formulaire.profil_main_oeuvre} onChange={(event) => setFormulaire((precedent) => ({ ...precedent, profil_main_oeuvre: event.target.value }))}>
                <option value="">Aucun profil conseillé</option>
                {profils.map((profil) => (
                  <option key={profil.id} value={profil.id}>
                    {profil.libelle} ({profil.code})
                  </option>
                ))}
              </select>
            </div>

            <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
              <input type="checkbox" checked={formulaire.est_actif} onChange={(event) => setFormulaire((precedent) => ({ ...precedent, est_actif: event.target.checked }))} />
              Modèle actif
            </label>

            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <button type="button" onClick={reinitialiser} className="btn-secondaire">
                Réinitialiser
              </button>
              <button type="button" onClick={enregistrer} disabled={enregistrementEnCours} className="btn-primaire inline-flex items-center gap-1">
                <Save size={14} />
                {enregistrementEnCours ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
