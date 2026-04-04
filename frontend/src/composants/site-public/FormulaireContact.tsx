"use client";

import { useState } from "react";
import { Send, CheckCircle, AlertCircle } from "lucide-react";

interface DonneesContact {
  nom: string;
  courriel: string;
  telephone: string;
  organisation: string;
  sujet: string;
  message: string;
}

const SUJETS = [
  { valeur: "devis", libelle: "Demande de devis" },
  { valeur: "information", libelle: "Demande d'information" },
  { valeur: "partenariat", libelle: "Partenariat" },
  { valeur: "recrutement", libelle: "Candidature" },
  { valeur: "autre", libelle: "Autre" },
];

const ETAT_INITIAL: DonneesContact = {
  nom: "", courriel: "", telephone: "", organisation: "", sujet: "information", message: "",
};

export function FormulaireContact() {
  const [donnees, setDonnees] = useState<DonneesContact>(ETAT_INITIAL);
  const [envoi, setEnvoi] = useState<"idle" | "chargement" | "succes" | "erreur">("idle");
  const [messageErreur, setMessageErreur] = useState("");

  const maj = (champ: keyof DonneesContact, val: string) =>
    setDonnees((prev) => ({ ...prev, [champ]: val }));

  const soumettre = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnvoi("chargement");
    setMessageErreur("");
    try {
      const res = await fetch("/api/site/contact/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(donnees),
      });
      if (res.ok) {
        setEnvoi("succes");
        setDonnees(ETAT_INITIAL);
      } else {
        const erreurs = await res.json();
        const premier = Object.values(erreurs as Record<string, string[]>).flat()[0] as string;
        setMessageErreur(premier || "Une erreur est survenue. Veuillez réessayer.");
        setEnvoi("erreur");
      }
    } catch {
      setMessageErreur("Impossible d'envoyer le message. Vérifiez votre connexion internet.");
      setEnvoi("erreur");
    }
  };

  if (envoi === "succes") {
    return (
      <div className="flex flex-col items-center justify-center py-14 gap-4 text-center">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle className="w-9 h-9 text-green-600" aria-hidden />
        </div>
        <h3 className="text-xl font-bold text-ardoise-900">Message envoyé !</h3>
        <p className="text-ardoise-500 max-w-sm text-sm leading-relaxed">
          Votre demande a bien été transmise. Nous vous répondrons dans les meilleurs délais.
        </p>
        <button
          onClick={() => setEnvoi("idle")}
          className="mt-1 text-sm text-primaire-600 hover:text-primaire-800 underline transition-colors"
        >
          Envoyer une autre demande
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={soumettre} className="space-y-5" noValidate>
      {envoi === "erreur" && messageErreur && (
        <div className="flex items-start gap-2.5 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
          {messageErreur}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="libelle-champ">
            Nom et prénom <span className="text-red-500 ml-0.5" aria-label="obligatoire">*</span>
          </label>
          <input
            type="text" required value={donnees.nom}
            onChange={(e) => maj("nom", e.target.value)}
            placeholder="Jean Dupont"
            className="champ-saisie"
          />
        </div>
        <div>
          <label className="libelle-champ">
            Adresse de courriel <span className="text-red-500 ml-0.5" aria-label="obligatoire">*</span>
          </label>
          <input
            type="email" required value={donnees.courriel}
            onChange={(e) => maj("courriel", e.target.value)}
            placeholder="jean.dupont@exemple.fr"
            className="champ-saisie"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="libelle-champ">Téléphone</label>
          <input
            type="tel" value={donnees.telephone}
            onChange={(e) => maj("telephone", e.target.value)}
            placeholder="06 00 00 00 00"
            className="champ-saisie"
          />
        </div>
        <div>
          <label className="libelle-champ">Organisation</label>
          <input
            type="text" value={donnees.organisation}
            onChange={(e) => maj("organisation", e.target.value)}
            placeholder="Mairie de…, Cabinet…"
            className="champ-saisie"
          />
        </div>
      </div>

      <div>
        <label className="libelle-champ">
          Sujet <span className="text-red-500 ml-0.5" aria-label="obligatoire">*</span>
        </label>
        <select
          required value={donnees.sujet}
          onChange={(e) => maj("sujet", e.target.value)}
          className="champ-saisie bg-white"
        >
          {SUJETS.map((s) => (
            <option key={s.valeur} value={s.valeur}>{s.libelle}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="libelle-champ">
          Message <span className="text-red-500 ml-0.5" aria-label="obligatoire">*</span>
        </label>
        <textarea
          required rows={5} value={donnees.message}
          onChange={(e) => maj("message", e.target.value)}
          placeholder="Décrivez votre besoin, votre projet, les prestations recherchées…"
          className="champ-saisie resize-none"
        />
      </div>

      <div className="flex justify-end pt-1">
        <button
          type="submit"
          disabled={envoi === "chargement"}
          className="btn-primaire px-6 py-2.5 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {envoi === "chargement" ? (
            <span className="flex items-center gap-2">
              <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-hidden />
              Envoi en cours…
            </span>
          ) : (
            <>
              <Send className="w-4 h-4" aria-hidden />
              Envoyer le message
            </>
          )}
        </button>
      </div>
    </form>
  );
}
