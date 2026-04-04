"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import { ArrowLeft, UserPlus } from "lucide-react";

import { api, ErreurApi } from "@/crochets/useApi";
import { useSessionStore, type Utilisateur } from "@/crochets/useSession";

interface DetailInvitation {
  courriel: string;
  expire_le: string;
  nom_complet: string;
  profil_libelle: string | null;
  nom_plateforme: string;
}

interface ReponseActivation {
  jetons: {
    acces: string;
    rafraichissement: string;
  };
  utilisateur: Utilisateur;
}

export default function PageActiverCompte({ params }: { params: Promise<{ token: string }> }) {
  const router = useRouter();
  const definirUtilisateur = useSessionStore((etat) => etat.definirUtilisateur);
  const definirJetons = useSessionStore((etat) => etat.definirJetons);
  const { token } = use(params);
  const [detail, setDetail] = useState<DetailInvitation | null>(null);
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [fonction, setFonction] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);
  const [activation, setActivation] = useState(false);

  useEffect(() => {
    if (!token) return;
    api.get<DetailInvitation>(`/api/auth/invitations/${token}/`)
      .then((reponse) => {
        setDetail(reponse);
        const morceaux = (reponse.nom_complet || "").trim().split(/\s+/).filter(Boolean);
        setPrenom(morceaux[0] || "");
        setNom(morceaux.slice(1).join(" "));
      })
      .catch((err) => setErreur(err instanceof ErreurApi ? err.detail : "Lien d'invitation invalide."))
      .finally(() => setChargement(false));
  }, [token]);

  async function activer() {
    setActivation(true);
    setErreur(null);
    try {
      const reponse = await api.post<ReponseActivation>(`/api/auth/invitations/${token}/activer/`, {
        prenom,
        nom,
        telephone,
        fonction,
        mot_de_passe: motDePasse,
        mot_de_passe_confirmation: confirmation,
      });
      definirUtilisateur(reponse.utilisateur);
      definirJetons(reponse.jetons.acces, reponse.jetons.rafraichissement);
      useSessionStore.setState({ estConnecte: true });
      router.push("/tableau-de-bord");
    } catch (err) {
      setErreur(err instanceof ErreurApi ? err.detail : "Impossible d'activer le compte.");
    } finally {
      setActivation(false);
    }
  }

  return (
    <div className="min-h-screen bg-ardoise-900 px-6 py-10">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/connexion"
          className="mb-6 inline-flex items-center gap-2 text-sm text-ardoise-300 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour à la connexion
        </Link>

        <div className="rounded-3xl bg-white p-8 shadow-2xl sm:p-10">
          <div className="mb-6">
            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primaire-100">
              <UserPlus className="h-5 w-5 text-primaire-700" />
            </div>
            <h1 className="text-2xl font-bold text-ardoise-900">Activer votre compte</h1>
            {detail && (
              <p className="mt-2 text-sm text-ardoise-500">
                Finalisez votre accès à {detail.nom_plateforme} et définissez votre mot de passe personnel.
              </p>
            )}
          </div>

          {chargement && <p className="text-sm text-ardoise-500">Vérification de l&apos;invitation…</p>}
          {!chargement && erreur && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {erreur}
            </div>
          )}

          {!chargement && detail && !erreur && (
            <div className="space-y-5">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <p><span className="font-medium text-slate-800">Courriel :</span> {detail.courriel}</p>
                <p className="mt-1"><span className="font-medium text-slate-800">Profil :</span> {detail.profil_libelle || "Accès attribué par l'administrateur"}</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="libelle-champ">Prénom</label>
                  <input className="champ-saisie" value={prenom} onChange={(e) => setPrenom(e.target.value)} />
                </div>
                <div>
                  <label className="libelle-champ">Nom</label>
                  <input className="champ-saisie" value={nom} onChange={(e) => setNom(e.target.value)} />
                </div>
                <div>
                  <label className="libelle-champ">Téléphone</label>
                  <input className="champ-saisie" value={telephone} onChange={(e) => setTelephone(e.target.value)} />
                </div>
                <div>
                  <label className="libelle-champ">Fonction</label>
                  <input className="champ-saisie" value={fonction} onChange={(e) => setFonction(e.target.value)} />
                </div>
                <div>
                  <label className="libelle-champ">Mot de passe</label>
                  <input type="password" className="champ-saisie" value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} />
                </div>
                <div>
                  <label className="libelle-champ">Confirmation du mot de passe</label>
                  <input type="password" className="champ-saisie" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} />
                </div>
              </div>

              <button
                type="button"
                onClick={activer}
                disabled={activation || !motDePasse || !confirmation}
                className="btn-accent w-full justify-center disabled:cursor-not-allowed disabled:opacity-60"
              >
                {activation ? "Activation en cours…" : "Activer mon compte"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
