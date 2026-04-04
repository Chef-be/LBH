"use client";

import { useState, type ComponentType } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import {
  Activity,
  AlertTriangle,
  Boxes,
  CheckCircle,
  Cpu,
  HardDrive,
  Mail,
  RefreshCw,
  Save,
  Send,
  Server,
  Trash2,
  XCircle,
} from "lucide-react";
import { api, extraireListeResultats, type ReponsePaginee, ErreurApi } from "@/crochets/useApi";

type Onglet = "vue-ensemble" | "conteneurs" | "messagerie";

interface Alerte {
  id: string;
  niveau: string;
  titre: string;
  description: string;
  service_concerne: string;
  date_declenchement: string;
}

interface InstantaneServeur {
  id?: number;
  charge_cpu_pct: number;
  memoire_pct: number;
  disque_pct: number;
  charge_moyenne_1m: number | null;
  charge_moyenne_5m: number | null;
  charge_moyenne_15m: number | null;
  memoire_totale_octets: number | null;
  memoire_utilisee_octets: number | null;
  disque_total_octets: number | null;
  disque_utilise_octets: number | null;
  horodatage: string;
}

interface ServiceSupervision {
  code: string;
  nom: string;
  statut: "ok" | "alerte" | "ko";
  niveau: "nominal" | "avertissement" | "critique";
  message: string;
  sante: string;
  derniere_verification: string;
  conteneur: string;
}

interface ConteneurDocker {
  id: string;
  nom: string;
  service: string;
  image: string;
  etat: string;
  statut: string;
  sante: string;
  redemarrages: number;
  demarre_le: string | null;
  cree_le: string | null;
  ports: string[];
}

interface TableauBord {
  horodatage: string;
  alertes_actives: number;
  alertes_critiques: number;
  erreurs_non_resolues: number;
  services_ko: number;
  services_indisponibles: string[];
  etat_global: "nominal" | "avertissement" | "critique";
  serveur: InstantaneServeur;
  historique_serveur: InstantaneServeur[];
  services: ServiceSupervision[];
  conteneurs: ConteneurDocker[];
  alertes: Alerte[];
  meta: {
    docker_disponible: boolean;
    docker_erreur: string | null;
    source_metriques: string | null;
  };
}

interface ServeurMail {
  id: string;
  nom: string;
  hote: string;
  port: number;
  chiffrement: "aucun" | "starttls" | "ssl_tls";
  chiffrement_libelle: string;
  utilisateur: string;
  mot_de_passe?: string;
  mot_de_passe_defini: boolean;
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

interface FormulaireServeurMail {
  nom: string;
  hote: string;
  port: number;
  chiffrement: "aucun" | "starttls" | "ssl_tls";
  utilisateur: string;
  mot_de_passe: string;
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

const ONGLETS: { id: Onglet; libelle: string; icone: ComponentType<{ size?: number; className?: string }> }[] = [
  { id: "vue-ensemble", libelle: "Vue d'ensemble", icone: Activity },
  { id: "conteneurs", libelle: "Services & conteneurs", icone: Boxes },
];

const STYLES_NIVEAU: Record<string, string> = {
  nominal: "badge-succes",
  avertissement: "badge-alerte",
  critique: "badge-danger",
  ok: "badge-succes",
  alerte: "badge-alerte",
  ko: "badge-danger",
};

function formulaireVide(): FormulaireServeurMail {
  return {
    nom: "",
    hote: "",
    port: 587,
    chiffrement: "starttls",
    utilisateur: "",
    mot_de_passe: "",
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

function formaterDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-FR");
}

function formaterOctets(valeur: number | null | undefined) {
  if (valeur == null) return "—";
  const unites = ["o", "Ko", "Mo", "Go", "To"];
  let taille = valeur;
  let index = 0;
  while (taille >= 1024 && index < unites.length - 1) {
    taille /= 1024;
    index += 1;
  }
  return `${taille.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} ${unites[index]}`;
}

function pointsCourbe(valeurs: number[]) {
  if (valeurs.length === 0) return "";
  const max = Math.max(...valeurs, 1);
  return valeurs
    .map((valeur, index) => {
      const x = (index / Math.max(valeurs.length - 1, 1)) * 100;
      const y = 32 - (valeur / max) * 28 - 2;
      return `${x},${Math.max(2, Math.min(30, y))}`;
    })
    .join(" ");
}

function LigneCourbe({ valeurs, couleur }: { valeurs: number[]; couleur: string }) {
  if (valeurs.length === 0) {
    return (
      <div className="h-10 flex items-center text-xs" style={{ color: "var(--texte-3)" }}>
        Historique insuffisant.
      </div>
    );
  }
  return (
    <svg viewBox="0 0 100 32" className="w-full h-10">
      <polyline
        fill="none"
        stroke={couleur}
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={pointsCourbe(valeurs)}
      />
    </svg>
  );
}

function JaugeUsage({
  icone,
  titre,
  pourcentage,
  detail,
  historique,
  couleur,
}: {
  icone: React.ReactNode;
  titre: string;
  pourcentage: number;
  detail: string;
  historique: number[];
  couleur: string;
}) {
  const valeur = Number.isFinite(pourcentage) ? Math.max(0, Math.min(100, pourcentage)) : 0;
  return (
    <div className="carte space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: couleur, color: "#fff" }}>
            {icone}
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--texte)" }}>{titre}</p>
            <p className="text-xs" style={{ color: "var(--texte-2)" }}>{detail}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold" style={{ color: "var(--texte)" }}>
            {valeur.toLocaleString("fr-FR", { maximumFractionDigits: 0 })}%
          </p>
        </div>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: "color-mix(in srgb, var(--bordure) 70%, transparent)" }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${valeur}%`, background: couleur }} />
      </div>
      <LigneCourbe valeurs={historique} couleur={couleur} />
    </div>
  );
}

function MessageVide({ texte }: { texte: string }) {
  return (
    <div className="carte py-10 text-center text-sm" style={{ color: "var(--texte-2)" }}>
      {texte}
    </div>
  );
}

function EtatGlobal({ etat }: { etat: TableauBord["etat_global"] }) {
  const mapping = {
    nominal: { libelle: "Nominal", icone: <CheckCircle size={16} />, classe: "badge-succes" },
    avertissement: { libelle: "Sous surveillance", icone: <AlertTriangle size={16} />, classe: "badge-alerte" },
    critique: { libelle: "Critique", icone: <XCircle size={16} />, classe: "badge-danger" },
  }[etat];
  return <span className={clsx(mapping.classe, "gap-1 inline-flex items-center")}>{mapping.icone}{mapping.libelle}</span>;
}

export function TableauBordSupervision() {
  const queryClient = useQueryClient();
  const [onglet, setOnglet] = useState<Onglet>("vue-ensemble");
  const [serveurEditionId, setServeurEditionId] = useState<string | null>(null);
  const [formulaireMail, setFormulaireMail] = useState<FormulaireServeurMail>(formulaireVide());
  const [retourMessagerie, setRetourMessagerie] = useState<{ type: "succes" | "erreur"; texte: string } | null>(null);

  const {
    data: tableau,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery<TableauBord>({
    queryKey: ["supervision-tableau-bord"],
    queryFn: () => api.get<TableauBord>("/api/supervision/"),
    refetchInterval: 60_000,
  });

  const { data: reponseServeursMail } = useQuery<ReponsePaginee<ServeurMail> | ServeurMail[]>({
    queryKey: ["supervision-serveurs-mail"],
    queryFn: () => api.get<ReponsePaginee<ServeurMail> | ServeurMail[]>("/api/supervision/serveurs-mail/"),
  });

  const serveursMail = extraireListeResultats(reponseServeursMail);

  const reinitialiserFormulaire = () => {
    setServeurEditionId(null);
    setFormulaireMail(formulaireVide());
  };

  const chargerServeurDansFormulaire = (serveur: ServeurMail) => {
    setServeurEditionId(serveur.id);
    setFormulaireMail({
      nom: serveur.nom,
      hote: serveur.hote,
      port: serveur.port,
      chiffrement: serveur.chiffrement,
      utilisateur: serveur.utilisateur,
      mot_de_passe: "",
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
    setOnglet("messagerie");
  };

  const { mutate: acquitter } = useMutation({
    mutationFn: (id: string) => api.post(`/api/supervision/alertes/${id}/acquitter/`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["supervision-tableau-bord"] }),
  });

  const { mutate: enregistrerServeur, isPending: enregistrementMail } = useMutation({
    mutationFn: (payload: FormulaireServeurMail) => {
      if (serveurEditionId) {
        return api.patch(`/api/supervision/serveurs-mail/${serveurEditionId}/`, payload);
      }
      return api.post("/api/supervision/serveurs-mail/", payload);
    },
    onSuccess: () => {
      setRetourMessagerie({ type: "succes", texte: "Configuration de messagerie enregistrée." });
      queryClient.invalidateQueries({ queryKey: ["supervision-serveurs-mail"] });
      reinitialiserFormulaire();
    },
    onError: (erreur) => {
      setRetourMessagerie({
        type: "erreur",
        texte: erreur instanceof ErreurApi ? erreur.detail : "Impossible d'enregistrer le serveur de mail.",
      });
    },
  });

  const { mutate: supprimerServeur, isPending: suppressionMail } = useMutation({
    mutationFn: (id: string) => api.supprimer(`/api/supervision/serveurs-mail/${id}/`),
    onSuccess: () => {
      setRetourMessagerie({ type: "succes", texte: "Serveur de mail supprimé." });
      queryClient.invalidateQueries({ queryKey: ["supervision-serveurs-mail"] });
      if (serveurEditionId) reinitialiserFormulaire();
    },
    onError: (erreur) => {
      setRetourMessagerie({
        type: "erreur",
        texte: erreur instanceof ErreurApi ? erreur.detail : "Impossible de supprimer le serveur de mail.",
      });
    },
  });

  const { mutate: testerServeur, isPending: testMailEnCours, data: resultatTestMail } = useMutation({
    mutationFn: (id: string) => api.post<ReponseTestSMTP>(`/api/supervision/serveurs-mail/${id}/tester/`, {}),
    onSuccess: (resultat) => {
      setRetourMessagerie({
        type: "succes",
        texte: `${resultat.detail} Latence mesurée : ${resultat.latence_ms} ms.`,
      });
    },
    onError: (erreur) => {
      setRetourMessagerie({
        type: "erreur",
        texte: erreur instanceof ErreurApi ? erreur.detail : "Le test SMTP a échoué.",
      });
    },
  });

  if (isLoading) {
    return <div className="py-12 text-center text-sm" style={{ color: "var(--texte-2)" }}>Chargement de la supervision…</div>;
  }

  if (isError || !tableau) {
    return (
      <div className="carte py-12 text-center text-sm" style={{ color: "#dc2626" }}>
        Impossible de charger les données de supervision.
      </div>
    );
  }

  const historiqueCpu = tableau.historique_serveur.map((point) => Number(point.charge_cpu_pct ?? 0));
  const historiqueMemoire = tableau.historique_serveur.map((point) => Number(point.memoire_pct ?? 0));
  const historiqueDisque = tableau.historique_serveur.map((point) => Number(point.disque_pct ?? 0));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <EtatGlobal etat={tableau.etat_global} />
            <span className="text-xs" style={{ color: "var(--texte-3)" }}>
              Dernière collecte : {formaterDate(tableau.horodatage)}
            </span>
          </div>
          <p className="text-sm" style={{ color: "var(--texte-2)" }}>
            Source métriques : {tableau.meta.source_metriques === "hote" ? "serveur hôte" : "conteneur backend"}
          </p>
        </div>
        <button onClick={() => refetch()} disabled={isFetching} className="btn-secondaire">
          <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} />
          Actualiser
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {ONGLETS.map(({ id, libelle, icone: Icone }) => (
          <button
            key={id}
            onClick={() => setOnglet(id)}
            className={clsx(
              "px-4 py-2 rounded-xl border text-sm font-medium transition-colors inline-flex items-center gap-2",
              onglet === id ? "text-white" : ""
            )}
            style={
              onglet === id
                ? { backgroundColor: "var(--c-base)", borderColor: "var(--c-base)" }
                : { backgroundColor: "var(--fond-carte)", color: "var(--texte-2)", borderColor: "var(--bordure)" }
            }
          >
            <Icone size={14} />
            {libelle}
          </button>
        ))}
      </div>

      {onglet === "vue-ensemble" && (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="carte">
              <p className="text-xs uppercase tracking-wide" style={{ color: "var(--texte-3)" }}>Alertes critiques</p>
              <p className="mt-3 text-3xl font-bold" style={{ color: tableau.alertes_critiques > 0 ? "#dc2626" : "var(--texte)" }}>
                {tableau.alertes_critiques}
              </p>
            </div>
            <div className="carte">
              <p className="text-xs uppercase tracking-wide" style={{ color: "var(--texte-3)" }}>Alertes actives</p>
              <p className="mt-3 text-3xl font-bold" style={{ color: tableau.alertes_actives > 0 ? "#d97706" : "var(--texte)" }}>
                {tableau.alertes_actives}
              </p>
            </div>
            <div className="carte">
              <p className="text-xs uppercase tracking-wide" style={{ color: "var(--texte-3)" }}>Services indisponibles</p>
              <p className="mt-3 text-3xl font-bold" style={{ color: tableau.services_ko > 0 ? "#dc2626" : "var(--texte)" }}>
                {tableau.services_ko}
              </p>
            </div>
            <div className="carte">
              <p className="text-xs uppercase tracking-wide" style={{ color: "var(--texte-3)" }}>Erreurs non résolues</p>
              <p className="mt-3 text-3xl font-bold" style={{ color: tableau.erreurs_non_resolues > 0 ? "#d97706" : "var(--texte)" }}>
                {tableau.erreurs_non_resolues}
              </p>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <JaugeUsage
              icone={<Cpu size={18} />}
              titre="Charge CPU"
              pourcentage={Number(tableau.serveur.charge_cpu_pct ?? 0)}
              detail={`Charge moyenne 1 min : ${tableau.serveur.charge_moyenne_1m ?? "—"}`}
              historique={historiqueCpu}
              couleur="#2563eb"
            />
            <JaugeUsage
              icone={<Server size={18} />}
              titre="Mémoire vive"
              pourcentage={Number(tableau.serveur.memoire_pct ?? 0)}
              detail={`${formaterOctets(tableau.serveur.memoire_utilisee_octets)} / ${formaterOctets(tableau.serveur.memoire_totale_octets)}`}
              historique={historiqueMemoire}
              couleur="#0f766e"
            />
            <JaugeUsage
              icone={<HardDrive size={18} />}
              titre="Espace disque"
              pourcentage={Number(tableau.serveur.disque_pct ?? 0)}
              detail={`${formaterOctets(tableau.serveur.disque_utilise_octets)} / ${formaterOctets(tableau.serveur.disque_total_octets)}`}
              historique={historiqueDisque}
              couleur="#9333ea"
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.4fr,1fr]">
            <div className="carte">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h2 className="flex items-center gap-2">
                  <Server size={16} />
                  Services applicatifs
                </h2>
                <span className="text-xs" style={{ color: "var(--texte-3)" }}>{tableau.services.length} service(s)</span>
              </div>
              {tableau.services.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--texte-2)" }}>
                  {tableau.meta.docker_erreur || "Aucun service détecté."}
                </p>
              ) : (
                <div className="space-y-2">
                  {tableau.services.map((service) => (
                    <div
                      key={service.code}
                      className="rounded-xl border p-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between"
                      style={{ borderColor: "var(--bordure)" }}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium" style={{ color: "var(--texte)" }}>{service.nom}</p>
                          <span className={STYLES_NIVEAU[service.statut]}>{service.statut.toUpperCase()}</span>
                        </div>
                        <p className="text-xs" style={{ color: "var(--texte-2)" }}>{service.message || "Aucun message."}</p>
                      </div>
                      <div className="text-xs md:text-right" style={{ color: "var(--texte-3)" }}>
                        <p>Conteneur : {service.conteneur}</p>
                        <p>Santé Docker : {service.sante}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="carte">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h2 className="flex items-center gap-2">
                  <AlertTriangle size={16} />
                  Alertes en cours
                </h2>
                <span className="text-xs" style={{ color: "var(--texte-3)" }}>{tableau.alertes.length} alerte(s)</span>
              </div>
              {tableau.alertes.length === 0 ? (
                <div className="py-8 text-center">
                  <CheckCircle size={32} className="mx-auto mb-3 text-green-500" />
                  <p className="font-medium" style={{ color: "var(--texte)" }}>Aucune alerte active</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {tableau.alertes.map((alerte) => (
                    <div key={alerte.id} className="rounded-xl border p-4 space-y-3" style={{ borderColor: "var(--bordure)" }}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={STYLES_NIVEAU[alerte.niveau] || "badge-neutre"}>{alerte.niveau}</span>
                            <p className="font-medium" style={{ color: "var(--texte)" }}>{alerte.titre}</p>
                          </div>
                          <p className="text-sm" style={{ color: "var(--texte-2)" }}>
                            {alerte.description || "Aucun détail complémentaire."}
                          </p>
                        </div>
                        <button onClick={() => acquitter(alerte.id)} className="btn-secondaire text-xs">
                          Acquitter
                        </button>
                      </div>
                      <div className="text-xs flex flex-wrap gap-3" style={{ color: "var(--texte-3)" }}>
                        <span>Service : {alerte.service_concerne || "—"}</span>
                        <span>Déclenchée : {formaterDate(alerte.date_declenchement)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {onglet === "conteneurs" && (
        <div className="space-y-6">
          {!tableau.meta.docker_disponible && (
            <div className="carte text-sm" style={{ color: "#b45309" }}>
              {tableau.meta.docker_erreur || "Le socket Docker n'est pas accessible depuis le backend."}
            </div>
          )}
          {tableau.conteneurs.length === 0 ? (
            <MessageVide texte="Aucun conteneur Docker du projet n'a été remonté." />
          ) : (
            <div className="carte overflow-x-auto">
              <table className="w-full text-sm min-w-[920px]">
                <thead>
                  <tr className="border-b" style={{ borderColor: "var(--bordure)" }}>
                    <th className="text-left py-3 pr-4 font-medium" style={{ color: "var(--texte-2)" }}>Service</th>
                    <th className="text-left py-3 pr-4 font-medium" style={{ color: "var(--texte-2)" }}>Conteneur</th>
                    <th className="text-left py-3 pr-4 font-medium" style={{ color: "var(--texte-2)" }}>État</th>
                    <th className="text-left py-3 pr-4 font-medium" style={{ color: "var(--texte-2)" }}>Santé</th>
                    <th className="text-left py-3 pr-4 font-medium" style={{ color: "var(--texte-2)" }}>Image</th>
                    <th className="text-left py-3 pr-4 font-medium" style={{ color: "var(--texte-2)" }}>Ports</th>
                    <th className="text-right py-3 font-medium" style={{ color: "var(--texte-2)" }}>Redémarrages</th>
                  </tr>
                </thead>
                <tbody>
                  {tableau.conteneurs.map((conteneur) => (
                    <tr key={conteneur.id} className="border-b last:border-0" style={{ borderColor: "var(--bordure)" }}>
                      <td className="py-3 pr-4">
                        <div className="font-medium" style={{ color: "var(--texte)" }}>{conteneur.service}</div>
                        <div className="text-xs" style={{ color: "var(--texte-3)" }}>{formaterDate(conteneur.demarre_le)}</div>
                      </td>
                      <td className="py-3 pr-4 font-mono text-xs" style={{ color: "var(--texte-2)" }}>{conteneur.nom}</td>
                      <td className="py-3 pr-4"><span className={STYLES_NIVEAU[conteneur.etat === "running" ? "ok" : "ko"]}>{conteneur.etat}</span></td>
                      <td className="py-3 pr-4"><span className={STYLES_NIVEAU[conteneur.sante === "healthy" ? "ok" : conteneur.sante === "stopped" ? "ko" : "alerte"]}>{conteneur.sante}</span></td>
                      <td className="py-3 pr-4 text-xs" style={{ color: "var(--texte-2)" }}>{conteneur.image}</td>
                      <td className="py-3 pr-4 text-xs" style={{ color: "var(--texte-2)" }}>{conteneur.ports.join(", ") || "—"}</td>
                      <td className="py-3 text-right font-mono" style={{ color: "var(--texte)" }}>{conteneur.redemarrages}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {onglet === "messagerie" && (
        <div className="grid gap-6 xl:grid-cols-[1.05fr,1.35fr]">
          <div className="space-y-4">
            <div className="carte flex items-center justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2">
                  <Mail size={16} />
                  Relais SMTP
                </h2>
                <p className="text-sm mt-1" style={{ color: "var(--texte-2)" }}>
                  Serveurs utilisés pour les envois applicatifs et les notifications.
                </p>
              </div>
              <button onClick={reinitialiserFormulaire} className="btn-secondaire text-xs">
                Nouveau serveur
              </button>
            </div>

            {serveursMail.length === 0 ? (
              <MessageVide texte="Aucun serveur de mail n'est encore configuré." />
            ) : (
              serveursMail.map((serveur) => (
                <div key={serveur.id} className="carte space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold" style={{ color: "var(--texte)" }}>{serveur.nom}</p>
                        {serveur.est_defaut && <span className="badge-info">Défaut</span>}
                        {!serveur.est_actif && <span className="badge-danger">Inactif</span>}
                      </div>
                      <p className="text-sm mt-1" style={{ color: "var(--texte-2)" }}>
                        {serveur.hote}:{serveur.port} • {serveur.chiffrement_libelle}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => testerServeur(serveur.id)} disabled={testMailEnCours} className="btn-secondaire text-xs">
                        <Send size={12} />
                        Tester
                      </button>
                      <button onClick={() => chargerServeurDansFormulaire(serveur)} className="btn-secondaire text-xs">
                        Modifier
                      </button>
                    </div>
                  </div>
                  <div className="text-xs flex flex-wrap gap-3" style={{ color: "var(--texte-3)" }}>
                    <span>Plateforme : {serveur.usage_envoi_plateforme ? "oui" : "non"}</span>
                    <span>Notifications : {serveur.usage_notifications ? "oui" : "non"}</span>
                    <span>Utilisateur : {serveur.utilisateur || "anonyme"}</span>
                  </div>
                  <div className="text-xs" style={{ color: "var(--texte-3)" }}>
                    Dernière modification : {formaterDate(serveur.date_modification)}
                    {serveur.modifie_par_nom ? ` par ${serveur.modifie_par_nom}` : ""}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="carte space-y-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2>{serveurEditionId ? "Modifier un serveur de mail" : "Ajouter un serveur de mail"}</h2>
                <p className="text-sm mt-1" style={{ color: "var(--texte-2)" }}>
                  La plateforme utilisera le serveur marqué par défaut pour les futurs envois sortants.
                </p>
              </div>
              {serveurEditionId && (
                <button onClick={reinitialiserFormulaire} className="btn-secondaire text-xs">
                  Annuler l&apos;édition
                </button>
              )}
            </div>

            {retourMessagerie && (
              <div
                className="rounded-xl border px-4 py-3 text-sm"
                style={{
                  borderColor: retourMessagerie.type === "succes" ? "#22c55e" : "#ef4444",
                  color: retourMessagerie.type === "succes" ? "#15803d" : "#b91c1c",
                  backgroundColor: retourMessagerie.type === "succes" ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
                }}
              >
                {retourMessagerie.texte}
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="libelle-champ">Nom du serveur</label>
                <input className="champ-saisie" value={formulaireMail.nom} onChange={(e) => setFormulaireMail((prev) => ({ ...prev, nom: e.target.value }))} />
              </div>
              <div>
                <label className="libelle-champ">Hôte SMTP</label>
                <input className="champ-saisie" value={formulaireMail.hote} onChange={(e) => setFormulaireMail((prev) => ({ ...prev, hote: e.target.value }))} />
              </div>
              <div>
                <label className="libelle-champ">Port</label>
                <input
                  type="number"
                  className="champ-saisie"
                  value={formulaireMail.port}
                  onChange={(e) => setFormulaireMail((prev) => ({ ...prev, port: Number(e.target.value || 0) }))}
                />
              </div>
              <div>
                <label className="libelle-champ">Chiffrement</label>
                <select
                  className="champ-saisie"
                  value={formulaireMail.chiffrement}
                  onChange={(e) => setFormulaireMail((prev) => ({ ...prev, chiffrement: e.target.value as FormulaireServeurMail["chiffrement"] }))}
                >
                  <option value="aucun">Aucun</option>
                  <option value="starttls">STARTTLS</option>
                  <option value="ssl_tls">SSL / TLS</option>
                </select>
              </div>
              <div>
                <label className="libelle-champ">Utilisateur</label>
                <input className="champ-saisie" value={formulaireMail.utilisateur} onChange={(e) => setFormulaireMail((prev) => ({ ...prev, utilisateur: e.target.value }))} />
              </div>
              <div>
                <label className="libelle-champ">
                  Mot de passe {serveurEditionId && <span style={{ color: "var(--texte-3)" }}>(laisser vide pour conserver)</span>}
                </label>
                <input
                  type="password"
                  className="champ-saisie"
                  value={formulaireMail.mot_de_passe}
                  onChange={(e) => setFormulaireMail((prev) => ({ ...prev, mot_de_passe: e.target.value }))}
                />
              </div>
              <div>
                <label className="libelle-champ">Expéditeur par défaut</label>
                <input className="champ-saisie" value={formulaireMail.expediteur_defaut} onChange={(e) => setFormulaireMail((prev) => ({ ...prev, expediteur_defaut: e.target.value }))} />
              </div>
              <div>
                <label className="libelle-champ">Adresse de réponse</label>
                <input className="champ-saisie" value={formulaireMail.reponse_a} onChange={(e) => setFormulaireMail((prev) => ({ ...prev, reponse_a: e.target.value }))} />
              </div>
              <div>
                <label className="libelle-champ">Délai de connexion (secondes)</label>
                <input
                  type="number"
                  className="champ-saisie"
                  value={formulaireMail.delai_connexion}
                  onChange={(e) => setFormulaireMail((prev) => ({ ...prev, delai_connexion: Number(e.target.value || 0) }))}
                />
              </div>
            </div>

            <div>
              <label className="libelle-champ">Notes</label>
              <textarea
                rows={4}
                className="champ-saisie"
                value={formulaireMail.notes}
                onChange={(e) => setFormulaireMail((prev) => ({ ...prev, notes: e.target.value }))}
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {[
                ["verifier_certificat", "Vérifier le certificat TLS"],
                ["usage_envoi_plateforme", "Utiliser pour les mails de la plateforme"],
                ["usage_notifications", "Utiliser pour les notifications"],
                ["est_actif", "Serveur actif"],
                ["est_defaut", "Serveur par défaut"],
              ].map(([champ, libelle]) => (
                <label key={champ} className="flex items-center gap-3 rounded-xl border px-4 py-3 cursor-pointer" style={{ borderColor: "var(--bordure)" }}>
                  <input
                    type="checkbox"
                    checked={Boolean(formulaireMail[champ as keyof FormulaireServeurMail])}
                    onChange={(e) =>
                      setFormulaireMail((prev) => ({ ...prev, [champ]: e.target.checked }))
                    }
                  />
                  <span className="text-sm" style={{ color: "var(--texte)" }}>{libelle}</span>
                </label>
              ))}
            </div>

            {resultatTestMail && (
              <div className="rounded-xl border px-4 py-3 text-sm" style={{ borderColor: "var(--bordure)" }}>
                Dernier test SMTP : {resultatTestMail.detail} ({resultatTestMail.latence_ms} ms)
              </div>
            )}

            <div className="flex flex-wrap justify-between gap-3">
              <div>
                {serveurEditionId && (
                  <button
                    onClick={() => supprimerServeur(serveurEditionId)}
                    disabled={suppressionMail}
                    className="btn-danger text-xs"
                  >
                    <Trash2 size={12} />
                    Supprimer
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {serveurEditionId && (
                  <button onClick={() => testerServeur(serveurEditionId)} disabled={testMailEnCours} className="btn-secondaire">
                    <Send size={14} />
                    Tester ce serveur
                  </button>
                )}
                <button
                  onClick={() => enregistrerServeur(formulaireMail)}
                  disabled={enregistrementMail || !formulaireMail.nom || !formulaireMail.hote}
                  className="btn-primaire"
                >
                  <Save size={14} />
                  {enregistrementMail ? "Enregistrement…" : "Enregistrer"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
