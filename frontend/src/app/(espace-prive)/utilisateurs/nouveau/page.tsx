"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, ErreurApi, extraireListeResultats } from "@/crochets/useApi";
import { ArrowLeft, Save, AlertCircle, MailPlus } from "lucide-react";

interface ProfilDroit {
  id: number;
  code: string;
  libelle: string;
  description: string;
}

interface FormData {
  prenom: string;
  nom: string;
  courriel: string;
  telephone: string;
  fonction: string;
  profil: number | "";
}

const VIDE: FormData = {
  prenom: "", nom: "", courriel: "", telephone: "", fonction: "",
  profil: "",
};

export default function PageNouvelUtilisateur() {
  const router = useRouter();
  const [profils, setProfils] = useState<ProfilDroit[]>([]);
  const [form, setForm] = useState<FormData>({ ...VIDE });
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [erreurs, setErreurs] = useState<Record<string, string[]>>({});

  useEffect(() => {
    api.get<ProfilDroit[]>("/api/auth/profils/").then((data) => setProfils(extraireListeResultats(data))).catch(() => {});
  }, []);

  const maj = (champ: keyof FormData, val: string | number | "") =>
    setForm((prev) => ({ ...prev, [champ]: val }));

  const creer = async () => {
    setErreur(null);
    setMessage(null);
    setErreurs({});

    if (!form.prenom.trim() || !form.nom.trim() || !form.courriel.trim()) {
      setErreur("Prénom, nom et adresse de courriel sont obligatoires.");
      return;
    }

    setChargement(true);
    try {
      const corps = {
        prenom: form.prenom,
        nom: form.nom,
        courriel: form.courriel,
        telephone: form.telephone || undefined,
        fonction: form.fonction || undefined,
        profil: form.profil || undefined,
      };
      const reponse = await api.post<{ detail: string }>("/api/auth/utilisateurs/", corps);
      setMessage(reponse.detail);
      setTimeout(() => router.push("/utilisateurs"), 1000);
    } catch (e) {
      if (e instanceof ErreurApi && e.erreurs) {
        setErreurs(e.erreurs as Record<string, string[]>);
        const premier = Object.values(e.erreurs).flat()[0] as string;
        setErreur(premier || e.detail);
      } else {
        setErreur(e instanceof ErreurApi ? e.detail : "Erreur lors de la création.");
      }
    } finally {
      setChargement(false);
    }
  };

  const champErreur = (champ: string) => erreurs[champ]?.[0];

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/utilisateurs" className="text-slate-400 hover:text-slate-600 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1>Nouvel utilisateur</h1>
          <p className="text-slate-500 mt-0.5 text-sm">Créer un compte et envoyer une invitation d&apos;activation</p>
        </div>
      </div>

      {message && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm">
          <MailPlus className="w-4 h-4 shrink-0" />
          {message}
        </div>
      )}
      {erreur && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {erreur}
        </div>
      )}

      {/* Identité */}
      <div className="carte space-y-4">
        <h2 className="font-semibold text-slate-700 text-sm uppercase tracking-wide">Identité</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="libelle-champ">Prénom <span className="text-red-500">*</span></label>
            <input
              type="text" className={`champ-saisie w-full ${champErreur("prenom") ? "border-red-400" : ""}`}
              value={form.prenom} onChange={(e) => maj("prenom", e.target.value)}
              placeholder="Marie"
            />
            {champErreur("prenom") && <p className="mt-1 text-xs text-red-600">{champErreur("prenom")}</p>}
          </div>
          <div>
            <label className="libelle-champ">Nom <span className="text-red-500">*</span></label>
            <input
              type="text" className={`champ-saisie w-full ${champErreur("nom") ? "border-red-400" : ""}`}
              value={form.nom} onChange={(e) => maj("nom", e.target.value)}
              placeholder="Dupont"
            />
            {champErreur("nom") && <p className="mt-1 text-xs text-red-600">{champErreur("nom")}</p>}
          </div>
        </div>

        <div>
          <label className="libelle-champ">Adresse de courriel <span className="text-red-500">*</span></label>
          <input
            type="email" className={`champ-saisie w-full ${champErreur("courriel") ? "border-red-400" : ""}`}
            value={form.courriel} onChange={(e) => maj("courriel", e.target.value)}
            placeholder="marie.dupont@bureau.fr"
          />
          {champErreur("courriel") && <p className="mt-1 text-xs text-red-600">{champErreur("courriel")}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="libelle-champ">Téléphone</label>
            <input
              type="tel" className="champ-saisie w-full"
              value={form.telephone} onChange={(e) => maj("telephone", e.target.value)}
              placeholder="06 00 00 00 00"
            />
          </div>
          <div>
            <label className="libelle-champ">Fonction</label>
            <input
              type="text" className="champ-saisie w-full"
              value={form.fonction} onChange={(e) => maj("fonction", e.target.value)}
              placeholder="Économiste senior"
            />
          </div>
        </div>
      </div>

      {/* Droits */}
      <div className="carte space-y-4">
        <h2 className="font-semibold text-slate-700 text-sm uppercase tracking-wide">Profil de droits</h2>

        <div>
          <label className="libelle-champ">Profil</label>
          <select
            className="champ-saisie w-full bg-white"
            value={form.profil}
            onChange={(e) => maj("profil", e.target.value ? parseInt(e.target.value) : "")}
          >
            <option value="">— Aucun profil (accès minimal) —</option>
            {profils.map((p) => (
              <option key={p.id} value={p.id}>{p.libelle}</option>
            ))}
          </select>
          {form.profil && profils.find(p => p.id === form.profil)?.description && (
            <p className="mt-1 text-xs text-slate-400">
              {profils.find(p => p.id === form.profil)!.description}
            </p>
          )}
        </div>
      </div>

      <div className="carte space-y-4">
        <div>
          <h2 className="font-semibold text-slate-700 text-sm uppercase tracking-wide">Invitation</h2>
          <p className="text-sm text-slate-500 mt-1">
            L&apos;utilisateur recevra un courriel lui permettant de valider son adresse, d&apos;activer son compte
            et de définir lui-même son mot de passe.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        <Link href="/utilisateurs" className="btn-secondaire">Annuler</Link>
        <button
          onClick={creer}
          disabled={chargement}
          className="btn-primaire disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {chargement ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Création en cours…
            </span>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Créer et inviter l&apos;utilisateur
            </>
          )}
        </button>
      </div>
    </div>
  );
}
