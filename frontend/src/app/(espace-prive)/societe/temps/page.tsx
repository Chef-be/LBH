"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { api, ErreurApi } from "@/crochets/useApi";
import { useNotifications } from "@/contextes/FournisseurNotifications";
import { TempsPasse, ProfilHoraire } from "@/types/societe";

interface ProjetOption {
  id: string;
  reference: string;
  intitule: string;
}

interface ReponsePagineeProjets {
  results?: ProjetOption[];
}

interface AffectationProjetTemps {
  id: string;
  utilisateur: string;
  utilisateur_nom: string;
  nature: "projet" | "mission" | "livrable";
  nature_libelle: string;
  code_cible: string;
  libelle_cible: string;
  role: string;
  role_libelle: string;
  commentaires: string;
}

interface ProjetDetailTemps {
  id: string;
  reference: string;
  intitule: string;
  responsable: string;
  responsable_nom: string;
  affectations: AffectationProjetTemps[];
}

interface SuggestionTemps {
  affectation_id: string;
  utilisateur: string;
  utilisateur_nom: string;
  nature: "projet" | "mission" | "livrable";
  nature_libelle: string;
  code_cible: string;
  libelle_cible: string;
  role: string;
  role_libelle: string;
  commentaires: string;
  nb_heures_suggerees: string;
  taux_horaire_suggere: string;
  deja_saisi: boolean;
  devis_reference: string;
}

function formaterMontant(valeur: string | number | null | undefined) {
  if (valeur == null) return "—";
  const nombre = typeof valeur === "string" ? parseFloat(valeur) : valeur;
  if (Number.isNaN(nombre)) return "—";
  return nombre.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

function formaterHeures(valeur: string | number | null | undefined) {
  if (valeur == null) return "—";
  const nombre = typeof valeur === "string" ? parseFloat(valeur) : valeur;
  if (Number.isNaN(nombre)) return "—";
  return nombre.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " h";
}

export default function PageTempsSociete() {
  const notifications = useNotifications();
  const queryClient = useQueryClient();
  const [formulaire, setFormulaire] = useState({
    projet: "",
    utilisateur: "",
    profil_horaire: "",
    date_saisie: new Date().toISOString().slice(0, 10),
    nature: "mission",
    code_cible: "",
    libelle_cible: "",
    nb_heures: "7.00",
    taux_horaire: "",
    commentaires: "",
  });
  const [enregistrementEnCours, setEnregistrementEnCours] = useState(false);
  const [generationEnCours, setGenerationEnCours] = useState(false);

  const { data: temps = [] } = useQuery<TempsPasse[]>({
    queryKey: ["societe-temps-passes"],
    queryFn: () => api.get<TempsPasse[]>("/api/societe/temps-passes/"),
  });
  const { data: profils = [] } = useQuery<ProfilHoraire[]>({
    queryKey: ["societe-profils-horaires"],
    queryFn: () => api.get<ProfilHoraire[]>("/api/societe/profils-horaires/?actif=true"),
  });
  const { data: projets = [] } = useQuery<ProjetOption[]>({
    queryKey: ["societe-projets-options"],
    queryFn: async () => {
      const donnees = await api.get<ReponsePagineeProjets | ProjetOption[]>("/api/projets/?ordering=-date_modification&page_size=100");
      return (donnees as ReponsePagineeProjets).results ?? (donnees as ProjetOption[]);
    },
  });
  const { data: utilisateurs = [] } = useQuery<Array<{ id: string; prenom: string; nom: string; fonction: string }>>({
    queryKey: ["societe-utilisateurs"],
    queryFn: async () => {
      const donnees = await api.get<{ results?: Array<{ id: string; prenom: string; nom: string; fonction: string }> } | Array<{ id: string; prenom: string; nom: string; fonction: string }>>("/api/auth/utilisateurs/");
      return (donnees as { results?: Array<{ id: string; prenom: string; nom: string; fonction: string }> }).results
        ?? (donnees as Array<{ id: string; prenom: string; nom: string; fonction: string }>);
    },
  });
  const { data: projetSelectionne } = useQuery<ProjetDetailTemps>({
    queryKey: ["societe-temps-projet-detail", formulaire.projet],
    queryFn: () => api.get<ProjetDetailTemps>(`/api/projets/${formulaire.projet}/`),
    enabled: Boolean(formulaire.projet),
  });
  const { data: suggestionsTemps } = useQuery<{ suggestions: SuggestionTemps[]; devis_reference: string }>({
    queryKey: ["societe-temps-suggestions", formulaire.projet, formulaire.utilisateur],
    queryFn: () =>
      api.get<{ suggestions: SuggestionTemps[]; devis_reference: string }>(
        `/api/societe/temps-passes/suggestions/?projet=${formulaire.projet}${formulaire.utilisateur ? `&utilisateur=${formulaire.utilisateur}` : ""}`
      ),
    enabled: Boolean(formulaire.projet),
  });

  const totalHeures = useMemo(
    () => temps.reduce((somme, ligne) => somme + parseFloat(ligne.nb_heures || "0"), 0),
    [temps]
  );
  const totalCout = useMemo(
    () => temps.reduce((somme, ligne) => somme + parseFloat(ligne.cout_total || "0"), 0),
    [temps]
  );
  const utilisateursProjet = useMemo(() => {
    if (!projetSelectionne) {
      return utilisateurs.map((utilisateur) => ({
        id: utilisateur.id,
        nom_complet: [utilisateur.prenom, utilisateur.nom].filter(Boolean).join(" "),
        fonction: utilisateur.fonction,
      }));
    }

    const indexUtilisateurs = new Map(
      utilisateurs.map((utilisateur) => [
        utilisateur.id,
        {
          id: utilisateur.id,
          nom_complet: [utilisateur.prenom, utilisateur.nom].filter(Boolean).join(" "),
          fonction: utilisateur.fonction,
        },
      ])
    );
    const resultat = new Map<string, { id: string; nom_complet: string; fonction: string }>();

    if (projetSelectionne.responsable) {
      const responsable = indexUtilisateurs.get(projetSelectionne.responsable);
      resultat.set(
        projetSelectionne.responsable,
        responsable ?? {
          id: projetSelectionne.responsable,
          nom_complet: projetSelectionne.responsable_nom,
          fonction: "",
        }
      );
    }

    for (const affectation of projetSelectionne.affectations) {
      const utilisateur = indexUtilisateurs.get(affectation.utilisateur);
      resultat.set(
        affectation.utilisateur,
        utilisateur ?? {
          id: affectation.utilisateur,
          nom_complet: affectation.utilisateur_nom,
          fonction: "",
        }
      );
    }

    return Array.from(resultat.values());
  }, [projetSelectionne, utilisateurs]);
  const suggestionsAffectations = useMemo(
    () => suggestionsTemps?.suggestions ?? [],
    [suggestionsTemps]
  );

  useEffect(() => {
    if (!projetSelectionne) return;
    setFormulaire((courant) => {
      if (courant.utilisateur) {
        return courant;
      }
      return {
        ...courant,
        utilisateur: projetSelectionne.responsable || courant.utilisateur,
        nature: projetSelectionne.affectations[0]?.nature ?? courant.nature,
        code_cible: projetSelectionne.affectations[0]?.code_cible ?? courant.code_cible,
        libelle_cible: projetSelectionne.affectations[0]?.libelle_cible ?? courant.libelle_cible,
      };
    });
  }, [projetSelectionne]);

  const enregistrerTemps = async () => {
    if (!formulaire.projet || !formulaire.utilisateur || !formulaire.nb_heures) {
      notifications.erreur("Projet, salarié et durée sont obligatoires.");
      return;
    }
    setEnregistrementEnCours(true);
    try {
      await api.post("/api/societe/temps-passes/", {
        ...formulaire,
        profil_horaire: formulaire.profil_horaire || null,
        taux_horaire: formulaire.taux_horaire || "0",
      });
      notifications.succes("Temps enregistré.");
      setFormulaire((courant) => ({
        ...courant,
        code_cible: "",
        libelle_cible: "",
        nb_heures: "7.00",
        taux_horaire: "",
        commentaires: "",
      }));
      queryClient.invalidateQueries({ queryKey: ["societe-temps-passes"] });
      queryClient.invalidateQueries({ queryKey: ["societe-tdb"] });
    } catch (erreur) {
      notifications.erreur(erreur instanceof ErreurApi ? erreur.detail : "Impossible d'enregistrer le temps.");
    } finally {
      setEnregistrementEnCours(false);
    }
  };

  const genererBrouillons = async () => {
    if (!formulaire.projet) {
      notifications.erreur("Sélectionne d'abord un projet.");
      return;
    }
    setGenerationEnCours(true);
    try {
      const reponse = await api.post<{ detail: string }>(
        "/api/societe/temps-passes/initialiser-depuis-affectations/",
        {
          projet: formulaire.projet,
          utilisateur: formulaire.utilisateur || undefined,
          date_saisie: formulaire.date_saisie,
          profil_horaire: formulaire.profil_horaire || null,
        }
      );
      notifications.succes(reponse.detail || "Brouillons générés.");
      queryClient.invalidateQueries({ queryKey: ["societe-temps-passes"] });
      queryClient.invalidateQueries({ queryKey: ["societe-tdb"] });
      queryClient.invalidateQueries({ queryKey: ["societe-temps-suggestions", formulaire.projet, formulaire.utilisateur] });
    } catch (erreur) {
      notifications.erreur(erreur instanceof ErreurApi ? erreur.detail : "Impossible de générer les brouillons.");
    } finally {
      setGenerationEnCours(false);
    }
  };

  const changerStatutTemps = async (tempsId: string, statut: "brouillon" | "valide") => {
    try {
      await api.post(`/api/societe/temps-passes/${tempsId}/changer-statut/`, { statut });
      queryClient.invalidateQueries({ queryKey: ["societe-temps-passes"] });
      queryClient.invalidateQueries({ queryKey: ["societe-tdb"] });
    } catch (erreur) {
      notifications.erreur(erreur instanceof ErreurApi ? erreur.detail : "Impossible de changer le statut.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="carte">
          <p className="text-xs uppercase tracking-wider" style={{ color: "var(--texte-3)" }}>Saisies</p>
          <p className="mt-2 text-2xl font-bold">{temps.length}</p>
        </div>
        <div className="carte">
          <p className="text-xs uppercase tracking-wider" style={{ color: "var(--texte-3)" }}>Total heures</p>
          <p className="mt-2 text-2xl font-bold">{formaterHeures(totalHeures)}</p>
        </div>
        <div className="carte">
          <p className="text-xs uppercase tracking-wider" style={{ color: "var(--texte-3)" }}>Coût valorisé</p>
          <p className="mt-2 text-2xl font-bold">{formaterMontant(totalCout)}</p>
        </div>
        <div className="carte">
          <p className="text-xs uppercase tracking-wider" style={{ color: "var(--texte-3)" }}>Projets couverts</p>
          <p className="mt-2 text-2xl font-bold">{new Set(temps.map((ligne) => ligne.projet)).size}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-1 carte space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--texte-3)" }}>
            Nouvelle saisie
          </h2>
          <select className="champ-saisie" value={formulaire.projet} onChange={(e) => setFormulaire((c) => ({ ...c, projet: e.target.value }))}>
            <option value="">Sélectionner un projet</option>
            {projets.map((projet) => (
              <option key={projet.id} value={projet.id}>
                {projet.reference} · {projet.intitule}
              </option>
            ))}
          </select>
          <select className="champ-saisie" value={formulaire.utilisateur} onChange={(e) => setFormulaire((c) => ({ ...c, utilisateur: e.target.value }))}>
            <option value="">Sélectionner un salarié</option>
            {utilisateursProjet.map((utilisateur) => (
              <option key={utilisateur.id} value={utilisateur.id}>
                {utilisateur.nom_complet}{utilisateur.fonction ? ` · ${utilisateur.fonction}` : ""}
              </option>
            ))}
          </select>
          <select
            className="champ-saisie"
            value={formulaire.profil_horaire}
            onChange={(e) => {
              const profil = profils.find((item) => item.id === e.target.value);
              setFormulaire((courant) => ({
                ...courant,
                profil_horaire: e.target.value,
                taux_horaire: profil?.taux_horaire_ht ?? courant.taux_horaire,
              }));
            }}
          >
            <option value="">Profil horaire</option>
            {profils.map((profil) => (
              <option key={profil.id} value={profil.id}>
                {profil.libelle} · {profil.taux_horaire_ht} €/h
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <input className="champ-saisie" type="date" value={formulaire.date_saisie} onChange={(e) => setFormulaire((c) => ({ ...c, date_saisie: e.target.value }))} />
            <select className="champ-saisie" value={formulaire.nature} onChange={(e) => setFormulaire((c) => ({ ...c, nature: e.target.value }))}>
              <option value="mission">Mission</option>
              <option value="livrable">Livrable</option>
              <option value="projet">Projet</option>
            </select>
          </div>
          <input className="champ-saisie" placeholder="Code cible" value={formulaire.code_cible} onChange={(e) => setFormulaire((c) => ({ ...c, code_cible: e.target.value }))} />
          <input className="champ-saisie" placeholder="Libellé cible" value={formulaire.libelle_cible} onChange={(e) => setFormulaire((c) => ({ ...c, libelle_cible: e.target.value }))} />
          <div className="grid grid-cols-2 gap-3">
            <input className="champ-saisie" placeholder="Heures" value={formulaire.nb_heures} onChange={(e) => setFormulaire((c) => ({ ...c, nb_heures: e.target.value }))} />
            <input className="champ-saisie" placeholder="Taux horaire" value={formulaire.taux_horaire} onChange={(e) => setFormulaire((c) => ({ ...c, taux_horaire: e.target.value }))} />
          </div>
          {suggestionsAffectations.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--texte-3)" }}>
                Affectations suggérées
              </p>
              {suggestionsTemps?.devis_reference ? (
                <p className="text-xs" style={{ color: "var(--texte-3)" }}>
                  Base devis : {suggestionsTemps.devis_reference}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {suggestionsAffectations.map((affectation) => (
                  <button
                    key={affectation.affectation_id}
                    type="button"
                    className="rounded-full border px-3 py-1.5 text-xs transition hover:opacity-80"
                    style={{ borderColor: "var(--bordure)", background: "var(--fond-entree)", color: "var(--texte)" }}
                    onClick={() =>
                      setFormulaire((courant) => ({
                        ...courant,
                        utilisateur: affectation.utilisateur,
                        nature: affectation.nature,
                        code_cible: affectation.code_cible,
                        libelle_cible: affectation.libelle_cible,
                        nb_heures: affectation.nb_heures_suggerees || courant.nb_heures,
                        taux_horaire: affectation.taux_horaire_suggere || courant.taux_horaire,
                        commentaires: courant.commentaires || affectation.commentaires || affectation.role_libelle,
                      }))
                    }
                  >
                    {(affectation.libelle_cible || affectation.code_cible || affectation.nature_libelle)}
                    {" · "}
                    {formaterHeures(affectation.nb_heures_suggerees)}
                    {affectation.deja_saisi ? " · déjà saisi" : ""}
                  </button>
                ))}
              </div>
            </div>
          )}
          <textarea className="champ-saisie min-h-24" placeholder="Commentaire" value={formulaire.commentaires} onChange={(e) => setFormulaire((c) => ({ ...c, commentaires: e.target.value }))} />
          <div className="grid grid-cols-1 gap-2">
            <button type="button" onClick={genererBrouillons} disabled={generationEnCours} className="btn-secondaire w-full">
              {generationEnCours ? "Génération…" : "Générer les brouillons"}
            </button>
            <button type="button" onClick={enregistrerTemps} disabled={enregistrementEnCours} className="btn-primaire w-full">
              {enregistrementEnCours ? "Enregistrement…" : "Enregistrer le temps"}
            </button>
          </div>
        </div>

        <div className="xl:col-span-2 carte">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--texte-3)" }}>
              Dernières saisies
            </h2>
          </div>
          {temps.length === 0 ? (
            <p className="text-sm py-6 text-center" style={{ color: "var(--texte-3)" }}>
              Aucune saisie de temps.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b" style={{ borderColor: "var(--bordure)" }}>
                    <th className="py-2 pr-3 text-left">Date</th>
                    <th className="py-2 pr-3 text-left">Projet</th>
                    <th className="py-2 pr-3 text-left">Salarié</th>
                    <th className="py-2 pr-3 text-left">Cible</th>
                    <th className="py-2 pr-3 text-left">Statut</th>
                    <th className="py-2 pr-3 text-right">Heures</th>
                    <th className="py-2 text-right">Coût</th>
                  </tr>
                </thead>
                <tbody>
                  {temps.map((ligne) => (
                    <tr key={ligne.id} className="border-b" style={{ borderColor: "var(--bordure)" }}>
                      <td className="py-3 pr-3">{ligne.date_saisie}</td>
                      <td className="py-3 pr-3">
                        <Link href={`/projets/${ligne.projet}`} className="hover:underline">
                          {ligne.projet_reference}
                        </Link>
                      </td>
                      <td className="py-3 pr-3">{ligne.utilisateur_nom}</td>
                      <td className="py-3 pr-3">{ligne.libelle_cible || ligne.nature_libelle}</td>
                      <td className="py-3 pr-3">
                        <button
                          type="button"
                          onClick={() => changerStatutTemps(ligne.id, ligne.statut === "valide" ? "brouillon" : "valide")}
                          className="rounded-full px-2.5 py-1 text-xs font-medium"
                          style={{
                            background: ligne.statut === "valide" ? "rgba(16,185,129,0.12)" : "rgba(245,158,11,0.12)",
                            color: ligne.statut === "valide" ? "#10b981" : "#f59e0b",
                          }}
                        >
                          {ligne.statut_libelle}
                        </button>
                      </td>
                      <td className="py-3 pr-3 text-right">{formaterHeures(ligne.nb_heures)}</td>
                      <td className="py-3 text-right">{formaterMontant(ligne.cout_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
