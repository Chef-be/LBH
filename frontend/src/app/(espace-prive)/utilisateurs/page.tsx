"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { api, ErreurApi, extraireListeResultats } from "@/crochets/useApi";
import { Plus, Search, UserCheck, UserX, Pencil, Users, Trash2, KeyRound, MailPlus, X, Save } from "lucide-react";

interface ProfilDroit {
  id: number;
  code: string;
  libelle: string;
}

interface Utilisateur {
  id: string;
  courriel: string;
  prenom: string;
  nom: string;
  nom_complet: string;
  telephone: string;
  fonction: string;
  profil: number | null;
  profil_libelle: string | null;
  organisation_nom: string | null;
  est_actif: boolean;
  est_super_admin: boolean;
  invitation_en_attente?: boolean;
  courriel_verifie_le?: string | null;
  date_creation: string;
  derniere_connexion_ip: string | null;
}

export default function PageUtilisateurs() {
  const [utilisateurs, setUtilisateurs] = useState<Utilisateur[]>([]);
  const [profils, setProfils] = useState<ProfilDroit[]>([]);
  const [chargement, setChargement] = useState(true);
  const [recherche, setRecherche] = useState("");
  const [filtre, setFiltre] = useState<"tous" | "actifs" | "inactifs">("actifs");
  const [utilisateurEdition, setUtilisateurEdition] = useState<Utilisateur | null>(null);
  const [utilisateurSuppression, setUtilisateurSuppression] = useState<Utilisateur | null>(null);
  const [form, setForm] = useState({ prenom: "", nom: "", telephone: "", fonction: "", profil: "" as number | "" });
  const [actionEnCours, setActionEnCours] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const chargerUtilisateurs = () =>
    api.get<Utilisateur[]>("/api/auth/utilisateurs/")
      .then((data) => setUtilisateurs(extraireListeResultats(data)))
      .catch(() => setUtilisateurs([]))
      .finally(() => setChargement(false));

  useEffect(() => {
    chargerUtilisateurs();
    api.get<ProfilDroit[]>("/api/auth/profils/")
      .then((data) => setProfils(extraireListeResultats(data)))
      .catch(() => setProfils([]));
  }, []);

  const ouvrirEdition = (utilisateur: Utilisateur) => {
    setMessage(null);
    setErreur(null);
    setUtilisateurEdition(utilisateur);
    setForm({
      prenom: utilisateur.prenom,
      nom: utilisateur.nom,
      telephone: utilisateur.telephone ?? "",
      fonction: utilisateur.fonction ?? "",
      profil: (utilisateur as Utilisateur & { profil?: number | null }).profil ?? "",
    });
  };

  const executerAction = async (cle: string, action: () => Promise<void>, succes: string) => {
    setActionEnCours(cle);
    setMessage(null);
    setErreur(null);
    try {
      await action();
      await chargerUtilisateurs();
      setMessage(succes);
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Action impossible.");
    } finally {
      setActionEnCours(null);
    }
  };

  const enregistrerEdition = () => {
    if (!utilisateurEdition) return;
    executerAction(
      `edition-${utilisateurEdition.id}`,
      async () => {
        const utilisateur = await api.patch<Utilisateur>(`/api/auth/utilisateurs/${utilisateurEdition.id}/`, {
          prenom: form.prenom,
          nom: form.nom,
          telephone: form.telephone,
          fonction: form.fonction,
          profil: form.profil || null,
        });
        setUtilisateurEdition(null);
        setUtilisateurs((prev) => prev.map((u) => u.id === utilisateur.id ? utilisateur : u));
      },
      "Profil utilisateur mis à jour."
    );
  };

  const supprimerUtilisateur = () => {
    if (!utilisateurSuppression) return;
    executerAction(
      `suppression-${utilisateurSuppression.id}`,
      async () => {
        const reponse = await api.supprimer(`/api/auth/utilisateurs/${utilisateurSuppression.id}/`) as { detail?: string; suppression_definitive?: boolean; reaffecte_a?: string };
        setUtilisateurSuppression(null);
        if (reponse?.detail) setMessage(reponse.detail + (reponse.reaffecte_a ? ` Reprise par ${reponse.reaffecte_a}.` : ""));
      },
      utilisateurSuppression.est_actif ? "Compte utilisateur désactivé." : "Compte utilisateur supprimé définitivement."
    );
  };

  const filtrés = utilisateurs.filter((u) => {
    const matchTexte =
      !recherche ||
      u.nom_complet.toLowerCase().includes(recherche.toLowerCase()) ||
      u.courriel.toLowerCase().includes(recherche.toLowerCase()) ||
      (u.fonction || "").toLowerCase().includes(recherche.toLowerCase());
    const matchActif =
      filtre === "tous" || (filtre === "actifs" ? u.est_actif : !u.est_actif);
    return matchTexte && matchActif;
  });

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primaire-100 flex items-center justify-center">
            <Users className="w-5 h-5 text-primaire-600" />
          </div>
          <div>
            <h1>Utilisateurs</h1>
            <p className="text-slate-500 mt-0.5 text-sm">
              Gestion des comptes et droits d&apos;accès
            </p>
          </div>
        </div>
        <Link href="/utilisateurs/nouveau" className="btn-primaire">
          <Plus className="w-4 h-4" />
          Nouvel utilisateur
        </Link>
      </div>

      {message && (
        <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {message}
        </div>
      )}
      {erreur && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {erreur}
        </div>
      )}

      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="search"
            className="champ-saisie pl-9 w-full"
            placeholder="Rechercher par nom, courriel, fonction…"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
          />
        </div>
        <div className="flex gap-1">
          {(["actifs", "tous", "inactifs"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFiltre(f)}
              className={`px-3 py-2 text-sm rounded-lg font-medium transition-colors ${
                filtre === f
                  ? "bg-primaire-100 text-primaire-700"
                  : "text-slate-500 hover:bg-slate-100"
              }`}
            >
              {f === "actifs" ? "Actifs" : f === "inactifs" ? "Inactifs" : "Tous"}
            </button>
          ))}
        </div>
      </div>

      {/* Tableau */}
      <div className="carte">
        {chargement ? (
          <div className="py-12 text-center text-slate-400 text-sm">Chargement…</div>
        ) : filtrés.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">
            {recherche ? "Aucun utilisateur ne correspond à la recherche." : "Aucun utilisateur pour le moment."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-3 pr-4 font-medium text-slate-500">Utilisateur</th>
                  <th className="text-left py-3 pr-4 font-medium text-slate-500 hidden sm:table-cell">Profil</th>
                  <th className="text-left py-3 pr-4 font-medium text-slate-500 hidden lg:table-cell">Organisation</th>
                  <th className="text-left py-3 pr-4 font-medium text-slate-500 hidden md:table-cell">Créé le</th>
                  <th className="text-center py-3 pr-4 font-medium text-slate-500">Statut</th>
                  <th className="text-right py-3 font-medium text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtrés.map((u) => (
                  <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primaire-100 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-primaire-700">
                            {u.prenom.charAt(0)}{u.nom.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-slate-800">{u.nom_complet}</p>
                          <p className="text-xs text-slate-400">{u.courriel}</p>
                          {u.fonction && (
                            <p className="text-xs text-slate-500">{u.fonction}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-4 hidden sm:table-cell">
                      {u.est_super_admin ? (
                        <span className="badge-info text-xs">Super-admin</span>
                      ) : u.profil_libelle ? (
                        <span className="badge-neutre text-xs">{u.profil_libelle}</span>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-slate-500 text-xs hidden lg:table-cell">
                      {u.organisation_nom ?? "—"}
                    </td>
                    <td className="py-3 pr-4 text-slate-400 text-xs hidden md:table-cell">
                      {formatDate(u.date_creation)}
                    </td>
                    <td className="py-3 pr-4 text-center">
                      {u.est_actif ? (
                        <span className="inline-flex items-center gap-1 badge-succes text-xs">
                          <UserCheck className="w-3 h-3" />
                          Actif
                        </span>
                      ) : u.invitation_en_attente ? (
                        <span className="inline-flex items-center gap-1 badge-info text-xs">
                          Invitation en attente
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 badge-danger text-xs">
                          <UserX className="w-3 h-3" />
                          Inactif
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => ouvrirEdition(u)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-500 hover:text-primaire-600 hover:bg-primaire-50 rounded-lg transition-colors"
                        >
                        <Pencil className="w-3.5 h-3.5" />
                        Modifier
                        </button>
                        {!u.est_actif && (
                          <button
                            type="button"
                            disabled={actionEnCours === `invitation-${u.id}`}
                            onClick={() => executerAction(
                              `invitation-${u.id}`,
                              () => api.post(`/api/auth/utilisateurs/${u.id}/renvoyer-invitation/`, {}),
                              "Invitation envoyée."
                            )}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-500 hover:text-primaire-600 hover:bg-primaire-50 rounded-lg transition-colors disabled:opacity-60"
                          >
                            <MailPlus className="w-3.5 h-3.5" />
                            Invitation
                          </button>
                        )}
                        {u.est_actif && (
                          <button
                            type="button"
                            disabled={actionEnCours === `reset-${u.id}`}
                            onClick={() => executerAction(
                              `reset-${u.id}`,
                              () => api.post(`/api/auth/utilisateurs/${u.id}/envoyer-reinitialisation/`, {}),
                              "Lien de réinitialisation envoyé."
                            )}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-500 hover:text-primaire-600 hover:bg-primaire-50 rounded-lg transition-colors disabled:opacity-60"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                            MDP
                          </button>
                        )}
                        {!u.est_super_admin && (
                          <button
                            type="button"
                            onClick={() => setUtilisateurSuppression(u)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Supprimer
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-400">
          {filtrés.length} utilisateur{filtrés.length > 1 ? "s" : ""}
          {filtre !== "tous" ? ` ${filtre}` : ""}
        </div>
      </div>

      {utilisateurEdition && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Modifier le profil</h2>
                <p className="text-sm text-slate-500">{utilisateurEdition.courriel}</p>
              </div>
              <button type="button" onClick={() => setUtilisateurEdition(null)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
              <div>
                <label className="libelle-champ">Prénom</label>
                <input className="champ-saisie w-full" value={form.prenom} onChange={(e) => setForm((p) => ({ ...p, prenom: e.target.value }))} />
              </div>
              <div>
                <label className="libelle-champ">Nom</label>
                <input className="champ-saisie w-full" value={form.nom} onChange={(e) => setForm((p) => ({ ...p, nom: e.target.value }))} />
              </div>
              <div>
                <label className="libelle-champ">Téléphone</label>
                <input className="champ-saisie w-full" value={form.telephone} onChange={(e) => setForm((p) => ({ ...p, telephone: e.target.value }))} />
              </div>
              <div>
                <label className="libelle-champ">Fonction</label>
                <input className="champ-saisie w-full" value={form.fonction} onChange={(e) => setForm((p) => ({ ...p, fonction: e.target.value }))} />
              </div>
              <div className="sm:col-span-2">
                <label className="libelle-champ">Profil de droits</label>
                <select
                  className="champ-saisie w-full bg-white"
                  value={form.profil}
                  onChange={(e) => setForm((p) => ({ ...p, profil: e.target.value ? parseInt(e.target.value) : "" }))}
                  disabled={utilisateurEdition.est_super_admin}
                >
                  <option value="">Aucun profil</option>
                  {profils.map((profil) => (
                    <option key={profil.id} value={profil.id}>{profil.libelle}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
              <button type="button" onClick={() => setUtilisateurEdition(null)} className="btn-secondaire">Annuler</button>
              <button
                type="button"
                disabled={actionEnCours === `edition-${utilisateurEdition.id}`}
                onClick={enregistrerEdition}
                className="btn-primaire disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {actionEnCours === `edition-${utilisateurEdition.id}` ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {utilisateurSuppression && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-slate-900">Confirmer la suppression</h2>
            <p className="mt-2 text-sm text-slate-600">
              {utilisateurSuppression.est_actif
                ? `Le compte de ${utilisateurSuppression.nom_complet} sera désactivé.`
                : `Le compte inactif de ${utilisateurSuppression.nom_complet} sera supprimé définitivement. Ses dossiers seront repris par un super-administrateur.`}
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setUtilisateurSuppression(null)} className="btn-secondaire">Annuler</button>
              <button
                type="button"
                disabled={actionEnCours === `suppression-${utilisateurSuppression.id}`}
                onClick={supprimerUtilisateur}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                <Trash2 className="h-4 w-4" />
                {actionEnCours === `suppression-${utilisateurSuppression.id}` ? "Suppression…" : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
