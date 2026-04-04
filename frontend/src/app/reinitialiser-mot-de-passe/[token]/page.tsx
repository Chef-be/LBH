"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import { ArrowLeft, KeyRound } from "lucide-react";

import { api, ErreurApi } from "@/crochets/useApi";

interface DetailJeton {
  courriel: string;
  expire_le: string;
  nom_complet: string;
  nom_plateforme: string;
}

export default function PageReinitialiserMotDePasse({ params }: { params: Promise<{ token: string }> }) {
  const router = useRouter();
  const { token } = use(params);
  const [detail, setDetail] = useState<DetailJeton | null>(null);
  const [motDePasse, setMotDePasse] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);
  const [enregistrement, setEnregistrement] = useState(false);

  useEffect(() => {
    if (!token) return;
    api.get<DetailJeton>(`/api/auth/reinitialisation/${token}/`)
      .then((reponse) => setDetail(reponse))
      .catch((err) => setErreur(err instanceof ErreurApi ? err.detail : "Lien de réinitialisation invalide."))
      .finally(() => setChargement(false));
  }, [token]);

  async function soumettre() {
    setEnregistrement(true);
    setErreur(null);
    setMessage(null);
    try {
      const reponse = await api.post<{ detail: string }>(`/api/auth/reinitialisation/${token}/confirmer/`, {
        mot_de_passe: motDePasse,
        mot_de_passe_confirmation: confirmation,
      });
      setMessage(reponse.detail);
      setTimeout(() => router.push("/connexion"), 1200);
    } catch (err) {
      setErreur(err instanceof ErreurApi ? err.detail : "Impossible de réinitialiser le mot de passe.");
    } finally {
      setEnregistrement(false);
    }
  }

  return (
    <div className="min-h-screen bg-ardoise-900 px-6 py-10">
      <div className="mx-auto max-w-xl">
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
              <KeyRound className="h-5 w-5 text-primaire-700" />
            </div>
            <h1 className="text-2xl font-bold text-ardoise-900">Réinitialiser le mot de passe</h1>
            {detail && (
              <p className="mt-2 text-sm text-ardoise-500">
                Définissez un nouveau mot de passe pour {detail.nom_complet || detail.courriel}.
              </p>
            )}
          </div>

          {chargement && <p className="text-sm text-ardoise-500">Vérification du lien…</p>}
          {!chargement && erreur && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {erreur}
            </div>
          )}
          {message && (
            <div className="mb-5 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              {message}
            </div>
          )}

          {!chargement && detail && !message && (
            <div className="space-y-5">
              <div>
                <label className="libelle-champ">Nouveau mot de passe</label>
                <input
                  type="password"
                  className="champ-saisie"
                  value={motDePasse}
                  onChange={(e) => setMotDePasse(e.target.value)}
                />
              </div>
              <div>
                <label className="libelle-champ">Confirmation</label>
                <input
                  type="password"
                  className="champ-saisie"
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                />
              </div>
              <button
                type="button"
                onClick={soumettre}
                disabled={enregistrement || !motDePasse || !confirmation}
                className="btn-accent w-full justify-center disabled:cursor-not-allowed disabled:opacity-60"
              >
                {enregistrement ? "Enregistrement…" : "Définir mon nouveau mot de passe"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
