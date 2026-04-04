"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Mail } from "lucide-react";

import { api, ErreurApi } from "@/crochets/useApi";
import { useConfiguration } from "@/contextes/FournisseurConfiguration";
import { obtenirNomPlateforme } from "@/lib/site-public";

export default function PageMotDePasseOublie() {
  const configuration = useConfiguration();
  const nomPlateforme = obtenirNomPlateforme(configuration);
  const [courriel, setCourriel] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(false);

  async function soumettre() {
    setChargement(true);
    setErreur(null);
    setMessage(null);
    try {
      const reponse = await api.post<{ detail: string }>("/api/auth/mot-de-passe-oublie/", { courriel });
      setMessage(reponse.detail);
    } catch (err) {
      setErreur(err instanceof ErreurApi ? err.detail : "Impossible d'envoyer le lien de réinitialisation.");
    } finally {
      setChargement(false);
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
              <Mail className="h-5 w-5 text-primaire-700" />
            </div>
            <h1 className="text-2xl font-bold text-ardoise-900">Mot de passe oublié</h1>
            <p className="mt-2 text-sm text-ardoise-500">
              Saisissez votre adresse de courriel pour recevoir un lien de réinitialisation
              {nomPlateforme ? ` pour ${nomPlateforme}` : ""}.
            </p>
          </div>

          {message && (
            <div className="mb-5 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              {message}
            </div>
          )}
          {erreur && (
            <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {erreur}
            </div>
          )}

          <div className="space-y-5">
            <div>
              <label className="libelle-champ">Adresse de courriel</label>
              <input
                type="email"
                className="champ-saisie"
                value={courriel}
                onChange={(e) => setCourriel(e.target.value)}
                placeholder="prenom.nom@exemple.fr"
              />
            </div>

            <button
              type="button"
              onClick={soumettre}
              disabled={chargement || !courriel.trim()}
              className="btn-accent w-full justify-center disabled:cursor-not-allowed disabled:opacity-60"
            >
              {chargement ? "Envoi en cours…" : "Envoyer le lien"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
