"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, ErreurApi, extraireListeResultats } from "@/crochets/useApi";
import { ArrowLeft, Save, AlertCircle, CheckCircle, UserX, UserCheck, MailPlus } from "lucide-react";

interface ProfilDroit {
  id: number;
  code: string;
  libelle: string;
}

interface Utilisateur {
  id: string;
  prenom: string;
  nom: string;
  nom_complet: string;
  courriel: string;
  telephone: string;
  fonction: string;
  profil: number | null;
  profil_libelle: string | null;
  organisation_nom: string | null;
  est_actif: boolean;
  est_super_admin: boolean;
  invitation_en_attente?: boolean;
  courriel_verifie_le?: string | null;
}

export default function PageModifierUtilisateur({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [profils, setProfils] = useState<ProfilDroit[]>([]);
  const [utilisateur, setUtilisateur] = useState<Utilisateur | null>(null);
  const [form, setForm] = useState({ prenom: "", nom: "", telephone: "", fonction: "", profil: "" as number | "" });
  const [chargement, setChargement] = useState(true);
  const [enregistrement, setEnregistrement] = useState(false);
  const [renvoiInvitation, setRenvoiInvitation] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get<Utilisateur>(`/api/auth/utilisateurs/${id}/`),
      api.get<ProfilDroit[]>("/api/auth/profils/"),
    ]).then(([u, p]) => {
      setUtilisateur(u);
      setProfils(extraireListeResultats(p));
      setForm({
        prenom: u.prenom,
        nom: u.nom,
        telephone: u.telephone,
        fonction: u.fonction,
        profil: u.profil ?? "",
      });
    }).catch(() => setErreur("Impossible de charger cet utilisateur."))
      .finally(() => setChargement(false));
  }, [id]);

  const maj = (champ: keyof typeof form, val: string | number | "") =>
    setForm((prev) => ({ ...prev, [champ]: val }));

  const enregistrer = async () => {
    setEnregistrement(true);
    setErreur(null);
    setSucces(false);
    try {
      await api.patch(`/api/auth/utilisateurs/${id}/`, {
        prenom: form.prenom,
        nom: form.nom,
        telephone: form.telephone,
        fonction: form.fonction,
        profil: form.profil || null,
      });
      setSucces(true);
      setTimeout(() => setSucces(false), 3000);
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Erreur lors de l'enregistrement.");
    } finally {
      setEnregistrement(false);
    }
  };

  const basculerStatut = async () => {
    if (!utilisateur) return;
    try {
      await api.patch(`/api/auth/utilisateurs/${id}/`, { est_actif: !utilisateur.est_actif });
      setUtilisateur((prev) => prev ? { ...prev, est_actif: !prev.est_actif } : null);
    } catch {
      setErreur("Impossible de modifier le statut.");
    }
  };

  const renvoyerInvitation = async () => {
    setRenvoiInvitation(true);
    setErreur(null);
    setSucces(false);
    try {
      await api.post(`/api/auth/utilisateurs/${id}/renvoyer-invitation/`, {});
      setSucces(true);
      setUtilisateur((prev) => prev ? { ...prev, invitation_en_attente: true } : null);
      setTimeout(() => setSucces(false), 3000);
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Impossible de renvoyer l'invitation.");
    } finally {
      setRenvoiInvitation(false);
    }
  };

  if (chargement) {
    return <div className="py-20 text-center text-slate-400 text-sm">Chargement…</div>;
  }

  if (!utilisateur && !chargement) {
    return (
      <div className="py-20 text-center">
        <p className="text-slate-500">Utilisateur introuvable.</p>
        <Link href="/utilisateurs" className="mt-4 inline-block text-primaire-600 hover:underline text-sm">
          ← Retour à la liste
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/utilisateurs" className="text-slate-400 hover:text-slate-600 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1>{utilisateur?.nom_complet}</h1>
          <p className="text-slate-400 text-sm mt-0.5">{utilisateur?.courriel}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {utilisateur?.est_super_admin && (
            <span className="badge-info text-xs">Super-admin</span>
          )}
          {utilisateur?.est_actif ? (
            <span className="badge-succes text-xs">Actif</span>
          ) : utilisateur?.invitation_en_attente ? (
            <span className="badge-info text-xs">Invitation en attente</span>
          ) : (
            <span className="badge-danger text-xs">Inactif</span>
          )}
        </div>
      </div>

      {succes && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm">
          <CheckCircle className="w-4 h-4 shrink-0" />
          Modifications enregistrées.
        </div>
      )}
      {erreur && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {erreur}
        </div>
      )}

      {/* Informations */}
      <div className="carte space-y-4">
        <h2 className="font-semibold text-slate-700 text-sm uppercase tracking-wide">Informations personnelles</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="libelle-champ">Prénom</label>
            <input type="text" className="champ-saisie w-full"
              value={form.prenom} onChange={(e) => maj("prenom", e.target.value)} />
          </div>
          <div>
            <label className="libelle-champ">Nom</label>
            <input type="text" className="champ-saisie w-full"
              value={form.nom} onChange={(e) => maj("nom", e.target.value)} />
          </div>
        </div>

        <div>
          <label className="libelle-champ">Adresse de courriel</label>
          <input
            type="email" className="champ-saisie w-full bg-slate-50 cursor-not-allowed"
            value={utilisateur?.courriel ?? ""} readOnly
          />
          <p className="text-xs text-slate-400 mt-1">L&apos;adresse de courriel ne peut pas être modifiée ici.</p>
          {utilisateur?.courriel_verifie_le ? (
            <p className="text-xs text-green-600 mt-1">Adresse de courriel vérifiée.</p>
          ) : (
            <p className="text-xs text-amber-600 mt-1">Adresse de courriel non encore validée.</p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="libelle-champ">Téléphone</label>
            <input type="tel" className="champ-saisie w-full"
              value={form.telephone} onChange={(e) => maj("telephone", e.target.value)} />
          </div>
          <div>
            <label className="libelle-champ">Fonction</label>
            <input type="text" className="champ-saisie w-full"
              value={form.fonction} onChange={(e) => maj("fonction", e.target.value)}
              placeholder="Économiste junior" />
          </div>
        </div>
      </div>

      {/* Profil de droits */}
      <div className="carte space-y-4">
        <h2 className="font-semibold text-slate-700 text-sm uppercase tracking-wide">Profil de droits</h2>
        <div>
          <label className="libelle-champ">Profil</label>
          <select
            className="champ-saisie w-full bg-white"
            value={form.profil}
            onChange={(e) => maj("profil", e.target.value ? parseInt(e.target.value) : "")}
            disabled={utilisateur?.est_super_admin}
          >
            <option value="">— Aucun profil —</option>
            {profils.map((p) => (
              <option key={p.id} value={p.id}>{p.libelle}</option>
            ))}
          </select>
          {utilisateur?.est_super_admin && (
            <p className="text-xs text-slate-400 mt-1">
              Le super-administrateur dispose de tous les droits.
            </p>
          )}
        </div>
      </div>

      {/* Actions compte */}
      {!utilisateur?.est_super_admin && (
        <div className="carte">
          <h2 className="font-semibold text-slate-700 text-sm uppercase tracking-wide mb-4">Statut du compte</h2>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm text-slate-700 font-medium">
                {utilisateur?.est_actif ? "Compte actif" : utilisateur?.invitation_en_attente ? "Invitation envoyée" : "Compte désactivé"}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                {utilisateur?.est_actif
                  ? "L'utilisateur peut se connecter à la plateforme."
                  : utilisateur?.invitation_en_attente
                    ? "L'utilisateur doit encore activer son compte depuis le lien reçu par courriel."
                    : "L'utilisateur ne peut plus se connecter."}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {!utilisateur?.est_actif && (
                <button
                  onClick={renvoyerInvitation}
                  disabled={renvoiInvitation}
                  className="btn-secondaire text-sm text-primaire-700 border-primaire-200 hover:bg-primaire-50 disabled:opacity-60"
                >
                  <MailPlus className="w-4 h-4" />
                  {renvoiInvitation ? "Envoi…" : "Renvoyer l'invitation"}
                </button>
              )}
              <button
                onClick={basculerStatut}
                className={utilisateur?.est_actif
                  ? "btn-secondaire text-sm text-red-600 border-red-200 hover:bg-red-50"
                  : "btn-secondaire text-sm text-green-600 border-green-200 hover:bg-green-50"}
              >
                {utilisateur?.est_actif ? (
                  <><UserX className="w-4 h-4" /> Désactiver</>
                ) : (
                  <><UserCheck className="w-4 h-4" /> Réactiver</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        <Link href="/utilisateurs" className="btn-secondaire">Annuler</Link>
        <button
          onClick={enregistrer}
          disabled={enregistrement}
          className="btn-primaire disabled:opacity-60"
        >
          {enregistrement ? "Enregistrement…" : (
            <><Save className="w-4 h-4" /> Enregistrer</>
          )}
        </button>
      </div>
    </div>
  );
}
