"use client";

import { useEffect, useState } from "react";
import { MailCheck, Save, ShieldCheck } from "lucide-react";

import { api, ErreurApi } from "@/crochets/useApi";
import { useSessionStore } from "@/crochets/useSession";

interface ProfilUtilisateur {
  id: string;
  courriel: string;
  prenom: string;
  nom: string;
  nom_complet: string;
  telephone: string;
  fonction: string;
  langue: string;
  fuseau_horaire: string;
  notifications_courriel: boolean;
  organisation_nom: string | null;
  profil_libelle: string | null;
  courriel_verifie_le: string | null;
}

export default function PageMonProfil() {
  const definirUtilisateur = useSessionStore((etat) => etat.definirUtilisateur);
  const utilisateurSession = useSessionStore((etat) => etat.utilisateur);
  const [profil, setProfil] = useState<ProfilUtilisateur | null>(null);
  const [motDePasse, setMotDePasse] = useState({ ancien: "", nouveau: "", confirmation: "" });
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);
  const [enregistrement, setEnregistrement] = useState(false);
  const [changementMdp, setChangementMdp] = useState(false);
  const [envoiVerification, setEnvoiVerification] = useState(false);

  useEffect(() => {
    api.get<ProfilUtilisateur>("/api/auth/moi/")
      .then((reponse) => setProfil(reponse))
      .catch(() => setErreur("Impossible de charger votre profil."))
      .finally(() => setChargement(false));
  }, []);

  async function enregistrerProfil() {
    if (!profil) return;
    setEnregistrement(true);
    setErreur(null);
    setMessage(null);
    try {
      const reponse = await api.patch<ProfilUtilisateur>("/api/auth/moi/", {
        telephone: profil.telephone,
        langue: profil.langue,
        fuseau_horaire: profil.fuseau_horaire,
        notifications_courriel: profil.notifications_courriel,
      });
      setProfil(reponse);
      if (utilisateurSession) {
        definirUtilisateur({
          ...utilisateurSession,
          prenom: reponse.prenom,
          nom: reponse.nom,
          nom_complet: reponse.nom_complet,
          telephone: reponse.telephone,
          fonction: reponse.fonction,
          langue: reponse.langue,
          fuseau_horaire: reponse.fuseau_horaire,
          notifications_courriel: reponse.notifications_courriel,
          courriel_verifie_le: reponse.courriel_verifie_le,
        });
      }
      setMessage("Profil mis à jour.");
    } catch (err) {
      setErreur(err instanceof ErreurApi ? err.detail : "Impossible d'enregistrer le profil.");
    } finally {
      setEnregistrement(false);
    }
  }

  async function modifierMotDePasse() {
    setChangementMdp(true);
    setErreur(null);
    setMessage(null);
    try {
      const reponse = await api.post<{ detail: string }>("/api/auth/modifier-mot-de-passe/", {
        ancien_mot_de_passe: motDePasse.ancien,
        nouveau_mot_de_passe: motDePasse.nouveau,
        confirmation: motDePasse.confirmation,
      });
      setMotDePasse({ ancien: "", nouveau: "", confirmation: "" });
      setMessage(reponse.detail);
    } catch (err) {
      setErreur(err instanceof ErreurApi ? err.detail : "Impossible de modifier le mot de passe.");
    } finally {
      setChangementMdp(false);
    }
  }

  async function envoyerVerification() {
    setEnvoiVerification(true);
    setErreur(null);
    setMessage(null);
    try {
      const reponse = await api.post<{ detail: string }>("/api/auth/moi/envoyer-verification/", {});
      setMessage(reponse.detail);
    } catch (err) {
      setErreur(err instanceof ErreurApi ? err.detail : "Impossible d'envoyer le lien de vérification.");
    } finally {
      setEnvoiVerification(false);
    }
  }

  if (chargement) {
    return <div className="py-16 text-center text-sm text-slate-500">Chargement du profil…</div>;
  }

  if (!profil) {
    return <div className="py-16 text-center text-sm text-red-600">{erreur || "Profil introuvable."}</div>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1>Mon profil</h1>
        <p className="mt-1 text-sm text-slate-500">
          Gérez vos informations personnelles, vos préférences et votre mot de passe.
        </p>
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

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="carte space-y-4">
          <div>
            <h2>Informations personnelles</h2>
            <p className="mt-1 text-sm text-slate-500">
              Ces informations sont utilisées par votre compte et vos notifications.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="libelle-champ">Prénom</label>
              <input className="champ-saisie cursor-not-allowed bg-slate-50 text-slate-500" value={profil.prenom} readOnly />
            </div>
            <div>
              <label className="libelle-champ">Nom</label>
              <input className="champ-saisie cursor-not-allowed bg-slate-50 text-slate-500" value={profil.nom} readOnly />
            </div>
            <div>
              <label className="libelle-champ">Téléphone</label>
              <input className="champ-saisie" value={profil.telephone} onChange={(e) => setProfil((prev) => prev ? { ...prev, telephone: e.target.value } : prev)} />
            </div>
            <div>
              <label className="libelle-champ">Fonction</label>
              <input className="champ-saisie cursor-not-allowed bg-slate-50 text-slate-500" value={profil.fonction} readOnly />
            </div>
            <div>
              <label className="libelle-champ">Langue</label>
              <select className="champ-saisie" value={profil.langue} onChange={(e) => setProfil((prev) => prev ? { ...prev, langue: e.target.value } : prev)}>
                <option value="fr">Français</option>
                <option value="en">English</option>
              </select>
            </div>
            <div>
              <label className="libelle-champ">Fuseau horaire</label>
              <input className="champ-saisie" value={profil.fuseau_horaire} onChange={(e) => setProfil((prev) => prev ? { ...prev, fuseau_horaire: e.target.value } : prev)} />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <p><span className="font-medium text-slate-800">Courriel :</span> {profil.courriel}</p>
            <p className="mt-1"><span className="font-medium text-slate-800">Profil :</span> {profil.profil_libelle || "Non défini"}</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <p><span className="font-medium text-slate-800">Adresse vérifiée :</span> {profil.courriel_verifie_le ? "Oui" : "Non"}</p>
              {!profil.courriel_verifie_le && (
                <button
                  type="button"
                  onClick={envoyerVerification}
                  disabled={envoiVerification}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 disabled:opacity-60"
                >
                  <MailCheck className="h-3.5 w-3.5" />
                  {envoiVerification ? "Envoi…" : "Envoyer le lien"}
                </button>
              )}
            </div>
          </div>

          <label className="inline-flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={profil.notifications_courriel}
              onChange={(e) => setProfil((prev) => prev ? { ...prev, notifications_courriel: e.target.checked } : prev)}
            />
            Recevoir les notifications par courriel
          </label>

          <div className="flex justify-end">
            <button onClick={enregistrerProfil} disabled={enregistrement} className="btn-primaire disabled:opacity-60">
              <Save className="h-4 w-4" />
              {enregistrement ? "Enregistrement…" : "Enregistrer le profil"}
            </button>
          </div>
        </div>

        <div className="carte space-y-4">
          <div>
            <h2 className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primaire-600" />
              Sécurité du compte
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Définissez un nouveau mot de passe personnel.
            </p>
          </div>

          <div>
            <label className="libelle-champ">Mot de passe actuel</label>
            <input
              type="password"
              className="champ-saisie"
              value={motDePasse.ancien}
              onChange={(e) => setMotDePasse((prev) => ({ ...prev, ancien: e.target.value }))}
            />
          </div>
          <div>
            <label className="libelle-champ">Nouveau mot de passe</label>
            <input
              type="password"
              className="champ-saisie"
              value={motDePasse.nouveau}
              onChange={(e) => setMotDePasse((prev) => ({ ...prev, nouveau: e.target.value }))}
            />
          </div>
          <div>
            <label className="libelle-champ">Confirmation du nouveau mot de passe</label>
            <input
              type="password"
              className="champ-saisie"
              value={motDePasse.confirmation}
              onChange={(e) => setMotDePasse((prev) => ({ ...prev, confirmation: e.target.value }))}
            />
          </div>

          <div className="flex justify-end">
            <button onClick={modifierMotDePasse} disabled={changementMdp} className="btn-primaire disabled:opacity-60">
              <ShieldCheck className="h-4 w-4" />
              {changementMdp ? "Mise à jour…" : "Modifier le mot de passe"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
