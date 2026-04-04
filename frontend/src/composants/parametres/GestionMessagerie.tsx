"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Mail, Save, Send, Server, Trash2 } from "lucide-react";

import { api, extraireListeResultats, type ReponsePaginee, ErreurApi } from "@/crochets/useApi";

interface ServeurMessagerie {
  id: string;
  nom: string;
  hote: string;
  port: number;
  chiffrement: "aucun" | "starttls" | "ssl_tls";
  chiffrement_libelle: string;
  utilisateur: string;
  mot_de_passe_defini: boolean;
  imap_hote: string;
  imap_port: number;
  imap_chiffrement: "aucun" | "starttls" | "ssl_tls";
  imap_chiffrement_libelle: string;
  imap_utilisateur: string;
  imap_mot_de_passe_defini: boolean;
  imap_verifier_certificat: boolean;
  imap_dossier_envoyes: string;
  imap_dossier_brouillons: string;
  imap_dossier_archives: string;
  imap_dossier_indesirables: string;
  imap_dossier_corbeille: string;
  expediteur_defaut: string;
  reponse_a: string;
  delai_connexion: number;
  verifier_certificat: boolean;
  usage_envoi_plateforme: boolean;
  usage_notifications: boolean;
  est_actif: boolean;
  est_defaut: boolean;
  notes: string;
  date_modification: string;
  modifie_par_nom: string | null;
}

interface ReponseTestSMTP {
  detail: string;
  latence_ms: number;
  succes: boolean;
}

interface ParametreMessagerie {
  cle: string;
  valeur: string;
  libelle: string;
  description: string;
}

interface ConfigurationRoundcube {
  product_name: string;
  language: string;
  default_task: string;
  support_url: string;
  logo_url: string;
  logo_link: string;
  bureau_nom: string;
}

interface JournalCourriel {
  id: string;
  origine: string;
  statut: "succes" | "echec";
  sujet: string;
  expediteur: string;
  destinataires: string[];
  erreur: string;
  date_envoi: string;
  utilisateur_nom: string | null;
}

interface FormulaireServeur {
  nom: string;
  hote: string;
  port: number;
  chiffrement: "aucun" | "starttls" | "ssl_tls";
  utilisateur: string;
  mot_de_passe: string;
  imap_hote: string;
  imap_port: number;
  imap_chiffrement: "aucun" | "starttls" | "ssl_tls";
  imap_utilisateur: string;
  imap_mot_de_passe: string;
  imap_verifier_certificat: boolean;
  imap_dossier_envoyes: string;
  imap_dossier_brouillons: string;
  imap_dossier_archives: string;
  imap_dossier_indesirables: string;
  imap_dossier_corbeille: string;
  expediteur_defaut: string;
  reponse_a: string;
  delai_connexion: number;
  verifier_certificat: boolean;
  usage_envoi_plateforme: boolean;
  usage_notifications: boolean;
  est_actif: boolean;
  est_defaut: boolean;
  notes: string;
}

interface FormulaireRoundcube {
  nom_application: string;
  langue: string;
  tache_defaut: string;
  lien_logo: string;
  url_aide: string;
}

function formulaireVide(): FormulaireServeur {
  return {
    nom: "",
    hote: "",
    port: 587,
    chiffrement: "starttls",
    utilisateur: "",
    mot_de_passe: "",
    imap_hote: "",
    imap_port: 993,
    imap_chiffrement: "ssl_tls",
    imap_utilisateur: "",
    imap_mot_de_passe: "",
    imap_verifier_certificat: true,
    imap_dossier_envoyes: "INBOX.Sent",
    imap_dossier_brouillons: "INBOX.Drafts",
    imap_dossier_archives: "",
    imap_dossier_indesirables: "INBOX.Spam",
    imap_dossier_corbeille: "INBOX.Trash",
    expediteur_defaut: "",
    reponse_a: "",
    delai_connexion: 15,
    verifier_certificat: true,
    usage_envoi_plateforme: true,
    usage_notifications: true,
    est_actif: true,
    est_defaut: false,
    notes: "",
  };
}

function formulaireRoundcubeVide(): FormulaireRoundcube {
  return {
    nom_application: "Messagerie",
    langue: "fr_FR",
    tache_defaut: "mail",
    lien_logo: "/roundcube/?_task=mail",
    url_aide: "",
  };
}

function formaterDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-FR");
}

export function GestionMessagerie() {
  const queryClient = useQueryClient();
  const [serveurEditionId, setServeurEditionId] = useState<string | null>(null);
  const [formulaire, setFormulaire] = useState<FormulaireServeur>(formulaireVide());
  const [formulaireRoundcube, setFormulaireRoundcube] = useState<FormulaireRoundcube>(formulaireRoundcubeVide());
  const [retour, setRetour] = useState<{ type: "succes" | "erreur"; texte: string } | null>(null);
  const [testCourant, setTestCourant] = useState<ReponseTestSMTP | null>(null);

  const { data } = useQuery<ReponsePaginee<ServeurMessagerie> | ServeurMessagerie[]>({
    queryKey: ["messagerie-serveurs"],
    queryFn: () => api.get<ReponsePaginee<ServeurMessagerie> | ServeurMessagerie[]>("/api/messagerie/serveurs/"),
  });
  const { data: parametresRoundcubeData } = useQuery<ReponsePaginee<ParametreMessagerie> | ParametreMessagerie[]>({
    queryKey: ["messagerie-roundcube-parametres"],
    queryFn: () => api.get<ReponsePaginee<ParametreMessagerie> | ParametreMessagerie[]>("/api/parametres/?module=messagerie"),
  });
  const { data: configurationRoundcube } = useQuery<ConfigurationRoundcube>({
    queryKey: ["messagerie-roundcube-configuration"],
    queryFn: () => api.get<ConfigurationRoundcube>("/api/messagerie/roundcube/configuration/"),
  });
  const { data: journalCourriels } = useQuery<ReponsePaginee<JournalCourriel> | JournalCourriel[]>({
    queryKey: ["messagerie-journal"],
    queryFn: () => api.get<ReponsePaginee<JournalCourriel> | JournalCourriel[]>("/api/messagerie/journal/"),
  });

  const serveurs = extraireListeResultats(data);
  const parametresRoundcube = extraireListeResultats(parametresRoundcubeData);
  const lignesJournal = extraireListeResultats(journalCourriels).slice(0, 12);
  const parametresRoundcubeParCle = useMemo(
    () => Object.fromEntries(parametresRoundcube.map((parametre) => [parametre.cle, parametre])),
    [parametresRoundcube]
  );

  const reinitialiser = () => {
    setServeurEditionId(null);
    setFormulaire(formulaireVide());
    setTestCourant(null);
  };

  const charger = (serveur: ServeurMessagerie) => {
    setServeurEditionId(serveur.id);
    setFormulaire({
      nom: serveur.nom,
      hote: serveur.hote,
      port: serveur.port,
      chiffrement: serveur.chiffrement,
      utilisateur: serveur.utilisateur,
      mot_de_passe: "",
      imap_hote: serveur.imap_hote || "",
      imap_port: serveur.imap_port || 993,
      imap_chiffrement: serveur.imap_chiffrement,
      imap_utilisateur: serveur.imap_utilisateur || "",
      imap_mot_de_passe: "",
      imap_verifier_certificat: serveur.imap_verifier_certificat,
      imap_dossier_envoyes: serveur.imap_dossier_envoyes || "INBOX.Sent",
      imap_dossier_brouillons: serveur.imap_dossier_brouillons || "INBOX.Drafts",
      imap_dossier_archives: serveur.imap_dossier_archives || "",
      imap_dossier_indesirables: serveur.imap_dossier_indesirables || "INBOX.Spam",
      imap_dossier_corbeille: serveur.imap_dossier_corbeille || "INBOX.Trash",
      expediteur_defaut: serveur.expediteur_defaut || "",
      reponse_a: serveur.reponse_a || "",
      delai_connexion: serveur.delai_connexion,
      verifier_certificat: serveur.verifier_certificat,
      usage_envoi_plateforme: serveur.usage_envoi_plateforme,
      usage_notifications: serveur.usage_notifications,
      est_actif: serveur.est_actif,
      est_defaut: serveur.est_defaut,
      notes: serveur.notes || "",
    });
    setRetour(null);
    setTestCourant(null);
  };

  useEffect(() => {
    if (parametresRoundcube.length === 0) return;
    setFormulaireRoundcube({
      nom_application: parametresRoundcubeParCle.ROUNDCUBE_NOM_APPLICATION?.valeur || "Messagerie",
      langue: parametresRoundcubeParCle.ROUNDCUBE_LANGUE?.valeur || "fr_FR",
      tache_defaut: parametresRoundcubeParCle.ROUNDCUBE_TACHE_DEFAUT?.valeur || "mail",
      lien_logo: parametresRoundcubeParCle.ROUNDCUBE_LOGO_LIEN?.valeur || "/roundcube/?_task=mail",
      url_aide: parametresRoundcubeParCle.ROUNDCUBE_URL_AIDE?.valeur || "",
    });
  }, [parametresRoundcube.length, parametresRoundcubeParCle]);

  const { mutate: enregistrerServeur, isPending: enregistrement } = useMutation({
    mutationFn: (payload: FormulaireServeur) => {
      if (serveurEditionId) {
        return api.patch(`/api/messagerie/serveurs/${serveurEditionId}/`, payload);
      }
      return api.post("/api/messagerie/serveurs/", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messagerie-serveurs"] });
      setRetour({ type: "succes", texte: "Configuration de messagerie enregistrée." });
      reinitialiser();
    },
    onError: (erreur) => {
      setRetour({
        type: "erreur",
        texte: erreur instanceof ErreurApi ? erreur.detail : "Impossible d'enregistrer la configuration.",
      });
    },
  });

  const { mutate: supprimerServeur, isPending: suppression } = useMutation({
    mutationFn: (id: string) => api.supprimer(`/api/messagerie/serveurs/${id}/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messagerie-serveurs"] });
      setRetour({ type: "succes", texte: "Serveur de messagerie supprimé." });
      reinitialiser();
    },
    onError: (erreur) => {
      setRetour({
        type: "erreur",
        texte: erreur instanceof ErreurApi ? erreur.detail : "Suppression impossible.",
      });
    },
  });

  const { mutate: testerServeur, isPending: testEnCours } = useMutation({
    mutationFn: (id: string) => api.post<ReponseTestSMTP>(`/api/supervision/serveurs-mail/${id}/tester/`, {}),
    onSuccess: (reponse) => {
      setTestCourant(reponse);
      setRetour({ type: "succes", texte: `Test SMTP réussi en ${reponse.latence_ms} ms.` });
    },
    onError: (erreur) => {
      setRetour({
        type: "erreur",
        texte: erreur instanceof ErreurApi ? erreur.detail : "Le test SMTP a échoué.",
      });
    },
  });

  const { mutate: enregistrerRoundcube, isPending: enregistrementRoundcube } = useMutation({
    mutationFn: async (payload: FormulaireRoundcube) => {
      await Promise.all([
        api.patch("/api/parametres/ROUNDCUBE_NOM_APPLICATION/", { valeur: payload.nom_application }),
        api.patch("/api/parametres/ROUNDCUBE_LANGUE/", { valeur: payload.langue }),
        api.patch("/api/parametres/ROUNDCUBE_TACHE_DEFAUT/", { valeur: payload.tache_defaut }),
        api.patch("/api/parametres/ROUNDCUBE_LOGO_LIEN/", { valeur: payload.lien_logo }),
        api.patch("/api/parametres/ROUNDCUBE_URL_AIDE/", { valeur: payload.url_aide }),
      ]);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["messagerie-roundcube-parametres"] }),
        queryClient.invalidateQueries({ queryKey: ["messagerie-roundcube-configuration"] }),
      ]);
      setRetour({ type: "succes", texte: "Paramètres Roundcube enregistrés." });
    },
    onError: (erreur) => {
      setRetour({
        type: "erreur",
        texte: erreur instanceof ErreurApi ? erreur.detail : "Impossible d'enregistrer les paramètres Roundcube.",
      });
    },
  });

  const serveursActifs = serveurs.filter((serveur) => serveur.est_actif).length;

  return (
    <div className="space-y-6">
      <div
        className="rounded-3xl border p-6 md:p-7"
        style={{
          borderColor: "color-mix(in srgb, var(--c-base) 18%, var(--bordure))",
          background:
            "linear-gradient(135deg, color-mix(in srgb, var(--c-leger) 82%, white) 0%, color-mix(in srgb, var(--fond-carte) 88%, var(--c-leger)) 100%)",
        }}
      >
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <span className="badge-info">Messagerie unifiée</span>
            <div>
              <h2 className="flex items-center gap-2">
                <Mail size={18} />
                Messagerie sortante, entrante et webmail
              </h2>
              <p className="mt-2 text-sm" style={{ color: "var(--texte-2)" }}>
                Cette configuration est réutilisée pour les envois applicatifs, les notifications du site
                vitrine et l’accès au webmail intégré.
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { libelle: "Serveurs", valeur: serveurs.length.toString() },
              { libelle: "Actifs", valeur: serveursActifs.toString() },
              { libelle: "Défaut", valeur: serveurs.find((serveur) => serveur.est_defaut)?.nom || "Aucun" },
            ].map((item) => (
              <div key={item.libelle} className="rounded-2xl border px-4 py-3" style={{ borderColor: "var(--bordure)", background: "var(--fond-carte)" }}>
                <p className="text-xs uppercase tracking-[0.18em]" style={{ color: "var(--texte-3)" }}>{item.libelle}</p>
                <p className="mt-2 text-sm font-semibold" style={{ color: "var(--texte)" }}>{item.valeur}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr,1.25fr]">
        <div className="space-y-4">
          <div className="carte flex items-center justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-2">
                <Server size={16} />
                Serveurs configurés
              </h3>
              <p className="mt-1 text-sm" style={{ color: "var(--texte-2)" }}>
                Le serveur par défaut pilote les usages sortants de la plateforme.
              </p>
            </div>
            <button onClick={reinitialiser} className="btn-secondaire text-xs">Nouveau</button>
          </div>

          {serveurs.length === 0 ? (
            <div className="carte py-10 text-center text-sm" style={{ color: "var(--texte-2)" }}>
              Aucun serveur de messagerie n&apos;est encore configuré.
            </div>
          ) : (
            serveurs.map((serveur) => (
              <div key={serveur.id} className="carte space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold" style={{ color: "var(--texte)" }}>{serveur.nom}</p>
                      {serveur.est_defaut && <span className="badge-info">Défaut</span>}
                      {!serveur.est_actif && <span className="badge-danger">Inactif</span>}
                    </div>
                    <p className="mt-1 text-sm" style={{ color: "var(--texte-2)" }}>
                      SMTP {serveur.hote}:{serveur.port} • {serveur.chiffrement_libelle}
                    </p>
                    <p className="mt-1 text-sm" style={{ color: "var(--texte-2)" }}>
                      IMAP {serveur.imap_hote || "non renseigné"}:{serveur.imap_port} • {serveur.imap_chiffrement_libelle}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => testerServeur(serveur.id)} disabled={testEnCours} className="btn-secondaire text-xs">
                      <Send size={12} />
                      Tester
                    </button>
                    <button onClick={() => charger(serveur)} className="btn-secondaire text-xs">Modifier</button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 text-xs" style={{ color: "var(--texte-3)" }}>
                  <span>Plateforme : {serveur.usage_envoi_plateforme ? "oui" : "non"}</span>
                  <span>Notifications : {serveur.usage_notifications ? "oui" : "non"}</span>
                  <span>IMAP : {serveur.imap_hote ? "oui" : "non"}</span>
                </div>
                <p className="text-xs" style={{ color: "var(--texte-3)" }}>
                  Dernière modification : {formaterDate(serveur.date_modification)}
                  {serveur.modifie_par_nom ? ` par ${serveur.modifie_par_nom}` : ""}
                </p>
              </div>
            ))
          )}
        </div>

        <div className="space-y-6">
          <div className="carte space-y-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3>{serveurEditionId ? "Modifier un service de messagerie" : "Ajouter un service de messagerie"}</h3>
                <p className="mt-1 text-sm" style={{ color: "var(--texte-2)" }}>
                  Un même enregistrement regroupe la partie SMTP, l’entrée IMAP et les dossiers webmail.
                </p>
              </div>
              {serveurEditionId && (
                <button onClick={reinitialiser} className="btn-secondaire text-xs">Annuler</button>
              )}
            </div>

            {retour && (
              <div
                className="rounded-2xl border px-4 py-3 text-sm"
                style={{
                  borderColor: retour.type === "succes" ? "#22c55e" : "#ef4444",
                  background: retour.type === "succes" ? "rgba(34, 197, 94, 0.08)" : "rgba(239, 68, 68, 0.08)",
                  color: retour.type === "succes" ? "#15803d" : "#b91c1c",
                }}
              >
                {retour.texte}
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="libelle-champ">Nom du serveur</label>
                <input className="champ-saisie" value={formulaire.nom} onChange={(e) => setFormulaire((prev) => ({ ...prev, nom: e.target.value }))} />
              </div>
              <div>
                <label className="libelle-champ">Expéditeur par défaut</label>
                <input className="champ-saisie" value={formulaire.expediteur_defaut} onChange={(e) => setFormulaire((prev) => ({ ...prev, expediteur_defaut: e.target.value }))} />
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <div className="rounded-2xl border p-4 space-y-4" style={{ borderColor: "var(--bordure)" }}>
                <div>
                  <p className="text-sm font-semibold" style={{ color: "var(--texte)" }}>Sortie SMTP</p>
                  <p className="mt-1 text-xs" style={{ color: "var(--texte-3)" }}>Courriels applicatifs, notifications et envois webmail.</p>
                </div>
                <div className="grid gap-4">
                  <div>
                    <label className="libelle-champ">Hôte SMTP</label>
                    <input className="champ-saisie" value={formulaire.hote} onChange={(e) => setFormulaire((prev) => ({ ...prev, hote: e.target.value }))} />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="libelle-champ">Port</label>
                      <input type="number" className="champ-saisie" value={formulaire.port} onChange={(e) => setFormulaire((prev) => ({ ...prev, port: Number(e.target.value || 0) }))} />
                    </div>
                    <div>
                      <label className="libelle-champ">Chiffrement</label>
                      <select className="champ-saisie" value={formulaire.chiffrement} onChange={(e) => setFormulaire((prev) => ({ ...prev, chiffrement: e.target.value as FormulaireServeur["chiffrement"] }))}>
                        <option value="aucun">Aucun</option>
                        <option value="starttls">STARTTLS</option>
                        <option value="ssl_tls">SSL / TLS</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="libelle-champ">Utilisateur SMTP</label>
                    <input className="champ-saisie" value={formulaire.utilisateur} onChange={(e) => setFormulaire((prev) => ({ ...prev, utilisateur: e.target.value }))} />
                  </div>
                  <div>
                    <label className="libelle-champ">Mot de passe SMTP</label>
                    <input type="password" className="champ-saisie" value={formulaire.mot_de_passe} onChange={(e) => setFormulaire((prev) => ({ ...prev, mot_de_passe: e.target.value }))} />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border p-4 space-y-4" style={{ borderColor: "var(--bordure)" }}>
                <div>
                  <p className="text-sm font-semibold" style={{ color: "var(--texte)" }}>Entrée IMAP</p>
                  <p className="mt-1 text-xs" style={{ color: "var(--texte-3)" }}>Connexion utilisée par le webmail intégré.</p>
                </div>
                <div className="grid gap-4">
                  <div>
                    <label className="libelle-champ">Hôte IMAP</label>
                    <input className="champ-saisie" value={formulaire.imap_hote} onChange={(e) => setFormulaire((prev) => ({ ...prev, imap_hote: e.target.value }))} placeholder="mail.exemple.com" />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="libelle-champ">Port IMAP</label>
                      <input type="number" className="champ-saisie" value={formulaire.imap_port} onChange={(e) => setFormulaire((prev) => ({ ...prev, imap_port: Number(e.target.value || 0) }))} />
                    </div>
                    <div>
                      <label className="libelle-champ">Chiffrement IMAP</label>
                      <select className="champ-saisie" value={formulaire.imap_chiffrement} onChange={(e) => setFormulaire((prev) => ({ ...prev, imap_chiffrement: e.target.value as FormulaireServeur["imap_chiffrement"] }))}>
                        <option value="aucun">Aucun</option>
                        <option value="starttls">STARTTLS</option>
                        <option value="ssl_tls">SSL / TLS</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="libelle-champ">Utilisateur IMAP</label>
                    <input className="champ-saisie" value={formulaire.imap_utilisateur} onChange={(e) => setFormulaire((prev) => ({ ...prev, imap_utilisateur: e.target.value }))} />
                  </div>
                  <div>
                    <label className="libelle-champ">Mot de passe IMAP</label>
                    <input type="password" className="champ-saisie" value={formulaire.imap_mot_de_passe} onChange={(e) => setFormulaire((prev) => ({ ...prev, imap_mot_de_passe: e.target.value }))} />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <div>
                <label className="libelle-champ">Adresse de réponse</label>
                <input className="champ-saisie" value={formulaire.reponse_a} onChange={(e) => setFormulaire((prev) => ({ ...prev, reponse_a: e.target.value }))} />
              </div>
              <div>
                <label className="libelle-champ">Délai de connexion</label>
                <input type="number" className="champ-saisie" value={formulaire.delai_connexion} onChange={(e) => setFormulaire((prev) => ({ ...prev, delai_connexion: Number(e.target.value || 0) }))} />
              </div>
              <div>
                <label className="libelle-champ">Dossier des envoyés</label>
                <input className="champ-saisie" value={formulaire.imap_dossier_envoyes} onChange={(e) => setFormulaire((prev) => ({ ...prev, imap_dossier_envoyes: e.target.value }))} />
              </div>
              <div>
                <label className="libelle-champ">Dossier des archives</label>
                <input className="champ-saisie" value={formulaire.imap_dossier_archives} onChange={(e) => setFormulaire((prev) => ({ ...prev, imap_dossier_archives: e.target.value }))} />
              </div>
              <div>
                <label className="libelle-champ">Dossier des indésirables</label>
                <input className="champ-saisie" value={formulaire.imap_dossier_indesirables} onChange={(e) => setFormulaire((prev) => ({ ...prev, imap_dossier_indesirables: e.target.value }))} />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="libelle-champ">Dossier des brouillons</label>
                <input className="champ-saisie" value={formulaire.imap_dossier_brouillons} onChange={(e) => setFormulaire((prev) => ({ ...prev, imap_dossier_brouillons: e.target.value }))} />
              </div>
              <div>
                <label className="libelle-champ">Dossier de la corbeille</label>
                <input className="champ-saisie" value={formulaire.imap_dossier_corbeille} onChange={(e) => setFormulaire((prev) => ({ ...prev, imap_dossier_corbeille: e.target.value }))} />
              </div>
            </div>

            <div>
              <label className="libelle-champ">Notes</label>
              <textarea rows={4} className="champ-saisie" value={formulaire.notes} onChange={(e) => setFormulaire((prev) => ({ ...prev, notes: e.target.value }))} />
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {[
                ["verifier_certificat", "Vérifier le certificat SMTP"],
                ["imap_verifier_certificat", "Vérifier le certificat IMAP"],
                ["usage_envoi_plateforme", "Utiliser pour les courriels applicatifs"],
                ["usage_notifications", "Utiliser pour les notifications"],
                ["est_actif", "Serveur actif"],
                ["est_defaut", "Serveur par défaut"],
              ].map(([champ, libelle]) => (
                <label key={champ} className="flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: "var(--bordure)" }}>
                  <input
                    type="checkbox"
                    checked={Boolean(formulaire[champ as keyof FormulaireServeur])}
                    onChange={(e) => setFormulaire((prev) => ({ ...prev, [champ]: e.target.checked }))}
                  />
                  <span style={{ color: "var(--texte)" }}>{libelle}</span>
                </label>
              ))}
            </div>

            {testCourant && (
              <div className="rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: "var(--bordure)" }}>
                Dernier test SMTP : {testCourant.detail} ({testCourant.latence_ms} ms)
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                {serveurEditionId && (
                  <button onClick={() => supprimerServeur(serveurEditionId)} disabled={suppression} className="btn-danger text-xs">
                    <Trash2 size={12} />
                    Supprimer
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {serveurEditionId && (
                  <button onClick={() => testerServeur(serveurEditionId)} disabled={testEnCours} className="btn-secondaire">
                    <Send size={14} />
                    Tester SMTP
                  </button>
                )}
                <button onClick={() => enregistrerServeur(formulaire)} disabled={enregistrement || !formulaire.nom || !formulaire.hote} className="btn-primaire">
                  <Save size={14} />
                  {enregistrement ? "Enregistrement…" : "Enregistrer"}
                </button>
              </div>
            </div>
          </div>

          <div className="carte space-y-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <h3>Roundcube dans l&apos;interface</h3>
                <p className="mt-1 text-sm" style={{ color: "var(--texte-2)" }}>
                  La messagerie s&apos;ouvre désormais dans l&apos;espace utilisateur, avec votre logo et vos réglages.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href="/webmail" className="btn-primaire">
                  <Mail size={14} />
                  Ouvrir la messagerie
                </Link>
                <Link href="/roundcube/" target="_blank" rel="noopener noreferrer" className="btn-secondaire">
                  <ExternalLink size={14} />
                  Nouvel onglet
                </Link>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <div>
                <label className="libelle-champ">Nom affiché</label>
                <input className="champ-saisie" value={formulaireRoundcube.nom_application} onChange={(e) => setFormulaireRoundcube((prev) => ({ ...prev, nom_application: e.target.value }))} />
              </div>
              <div>
                <label className="libelle-champ">Langue</label>
                <input className="champ-saisie" value={formulaireRoundcube.langue} onChange={(e) => setFormulaireRoundcube((prev) => ({ ...prev, langue: e.target.value }))} />
              </div>
              <div>
                <label className="libelle-champ">Écran d&apos;arrivée</label>
                <select className="champ-saisie" value={formulaireRoundcube.tache_defaut} onChange={(e) => setFormulaireRoundcube((prev) => ({ ...prev, tache_defaut: e.target.value }))}>
                  <option value="mail">Courrier</option>
                  <option value="addressbook">Carnet d&apos;adresses</option>
                  <option value="settings">Préférences</option>
                </select>
              </div>
              <div>
                <label className="libelle-champ">Lien du logo</label>
                <input className="champ-saisie" value={formulaireRoundcube.lien_logo} onChange={(e) => setFormulaireRoundcube((prev) => ({ ...prev, lien_logo: e.target.value }))} />
              </div>
              <div>
                <label className="libelle-champ">URL d&apos;aide</label>
                <input className="champ-saisie" value={formulaireRoundcube.url_aide} onChange={(e) => setFormulaireRoundcube((prev) => ({ ...prev, url_aide: e.target.value }))} />
              </div>
            </div>

            <div className="rounded-2xl border px-4 py-4 text-sm" style={{ borderColor: "var(--bordure)" }}>
              <p className="font-medium" style={{ color: "var(--texte)" }}>
                Aperçu actuel
              </p>
              <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-4" style={{ color: "var(--texte-2)" }}>
                <p>Produit : {configurationRoundcube?.product_name || "Messagerie"}</p>
                <p>Langue : {configurationRoundcube?.language || "fr_FR"}</p>
                <p>Écran d&apos;arrivée : {configurationRoundcube?.default_task || "mail"}</p>
                <p>Logo : {configurationRoundcube?.logo_url ? "Configuré" : "Aucun logo"}</p>
              </div>
            </div>

            <div className="flex justify-end">
              <button onClick={() => enregistrerRoundcube(formulaireRoundcube)} disabled={enregistrementRoundcube} className="btn-primaire">
                <Save size={14} />
                {enregistrementRoundcube ? "Enregistrement…" : "Enregistrer Roundcube"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="carte space-y-4">
        <div>
          <h3>Journal des e-mails envoyés</h3>
          <p className="mt-1 text-sm" style={{ color: "var(--texte-2)" }}>
            Historique réservé au super-administrateur pour contrôler les invitations, notifications,
            réinitialisations et autres envois de la plateforme.
          </p>
        </div>

        {lignesJournal.length === 0 ? (
          <div className="rounded-2xl border px-4 py-8 text-sm text-center" style={{ borderColor: "var(--bordure)", color: "var(--texte-2)" }}>
            Aucun e-mail journalisé pour le moment.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: "var(--bordure)" }}>
                  <th className="py-3 pr-4 text-left font-medium">Date</th>
                  <th className="py-3 pr-4 text-left font-medium">Origine</th>
                  <th className="py-3 pr-4 text-left font-medium">Sujet</th>
                  <th className="py-3 pr-4 text-left font-medium">Destinataires</th>
                  <th className="py-3 pr-4 text-left font-medium">Statut</th>
                </tr>
              </thead>
              <tbody>
                {lignesJournal.map((ligne) => (
                  <tr key={ligne.id} className="border-b align-top" style={{ borderColor: "var(--bordure)" }}>
                    <td className="py-3 pr-4 whitespace-nowrap">{formaterDate(ligne.date_envoi)}</td>
                    <td className="py-3 pr-4">
                      <div className="font-medium" style={{ color: "var(--texte)" }}>{ligne.origine}</div>
                      {ligne.utilisateur_nom && (
                        <div className="text-xs" style={{ color: "var(--texte-3)" }}>{ligne.utilisateur_nom}</div>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      <div style={{ color: "var(--texte)" }}>{ligne.sujet}</div>
                      {ligne.erreur && (
                        <div className="mt-1 text-xs text-red-600">{ligne.erreur}</div>
                      )}
                    </td>
                    <td className="py-3 pr-4">{ligne.destinataires.join(", ") || "—"}</td>
                    <td className="py-3 pr-4">
                      <span className={ligne.statut === "succes" ? "badge-succes" : "badge-danger"}>
                        {ligne.statut === "succes" ? "Succès" : "Échec"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
