"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { LogOut, Sun, Moon, Monitor, ChevronRight, Bell, CheckCheck, X, UserCog, Save } from "lucide-react";
import { useSessionStore } from "@/crochets/useSession";
import { useTheme } from "@/contextes/FournisseurTheme";
import { useNotifications } from "@/contextes/FournisseurNotifications";
import type { ModeTheme } from "@/contextes/FournisseurConfiguration";
import { api, ErreurApi } from "@/crochets/useApi";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Fil d'Ariane automatique
// ---------------------------------------------------------------------------

const LIBELLES: Record<string, string> = {
  "tableau-de-bord": "Tableau de bord",
  projets: "Projets", nouveau: "Nouveau", modifier: "Modifier",
  documents: "Documents", metres: "Métrés",
  economie: "Économie", bibliotheque: "Bibliothèque de prix",
  "etudes-de-prix": "Études de prix",
  "pilotage-activite": "Pilotage d'activité",
  voirie: "Voirie", batiment: "Bâtiment",
  "pieces-ecrites": "Pièces écrites", "appels-offres": "Appels d'offres",
  execution: "Exécution", supervision: "Supervision",
  parametres: "Paramètres", administration: "Administration",
  "couts-main-oeuvre": "Paramétrage main-d'œuvre",
  "contenus-editoriaux": "Contenus éditoriaux",
  configuration: "Configuration", prestations: "Prestations",
  references: "Références",
  statistiques: "Chiffres clés", valeurs: "Valeurs",
  demarche: "Démarche", "pages-statiques": "Pages légales",
  organisations: "Organisations", contacts: "Contacts", "mon-profil": "Mon profil",
  utilisateurs: "Utilisateurs", nouvelle: "Nouvelle",
};

function FilAriane() {
  const chemin = usePathname();
  const segments = chemin.split("/").filter(Boolean);

  // Exclure les UUIDs (pas de libellé lisible)
  const estUuid = (s: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

  const parties = [];
  const segmentsCumules: string[] = [];
  for (const segment of segments) {
    segmentsCumules.push(segment);
    if (estUuid(segment)) continue;
    parties.push({
      libelle: LIBELLES[segment] ?? segment,
      href: `/${segmentsCumules.join("/")}`,
    });
  }

  return (
    <nav className="hidden sm:flex items-center gap-1 text-xs" style={{ color: "var(--texte-3)" }}>
      {parties.map((partie, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight size={11} />}
          {i === parties.length - 1 ? (
            <span
              className="font-medium"
              style={{ color: "var(--texte-2)" }}
            >
              {partie.libelle}
            </span>
          ) : (
            <Link
              href={partie.href}
              className="transition-colors hover:underline"
              style={{ color: "var(--texte-3)" }}
            >
              {partie.libelle}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Bascule de thème
// ---------------------------------------------------------------------------

function BasculeTheme() {
  const { modePreference, definirMode } = useTheme();

  const options: { valeur: ModeTheme; icone: React.ReactNode; titre: string }[] = [
    { valeur: "clair",       icone: <Sun size={14} />,     titre: "Mode clair" },
    { valeur: "automatique", icone: <Monitor size={14} />, titre: "Automatique" },
    { valeur: "sombre",      icone: <Moon size={14} />,    titre: "Mode sombre" },
  ];

  return (
    <div
      className="flex items-center rounded-lg p-0.5 gap-0.5"
      style={{ background: "var(--fond-app)", border: "1px solid var(--bordure)" }}
    >
      {options.map(({ valeur, icone, titre }) => (
        <button
          key={valeur}
          onClick={() => definirMode(valeur)}
          title={titre}
          className="flex items-center justify-center w-7 h-7 rounded-md transition-all duration-150"
          style={{
            background: modePreference === valeur ? "var(--fond-carte)" : "transparent",
            color: modePreference === valeur ? "var(--c-base)" : "var(--texte-3)",
            boxShadow: modePreference === valeur ? "var(--ombre-carte)" : "none",
          }}
        >
          {icone}
        </button>
      ))}
    </div>
  );
}

function CentreNotifications() {
  const {
    notifications,
    nombreNonLues,
    marquerCommeLue,
    marquerToutesCommeLues,
    supprimerNotification,
  } = useNotifications();
  const [ouvert, setOuvert] = useState(false);
  const conteneurRef = useRef<HTMLDivElement>(null);
  const notificationsRecentes = useMemo(() => notifications.slice(0, 8), [notifications]);

  useEffect(() => {
    if (!ouvert) return;
    const handler = (event: MouseEvent) => {
      if (conteneurRef.current && !conteneurRef.current.contains(event.target as Node)) {
        setOuvert(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [ouvert]);

  const formaterDate = (dateCreation: number) =>
    new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(dateCreation));

  return (
    <div ref={conteneurRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setOuvert((precedent) => {
            const prochain = !precedent;
            if (prochain) marquerToutesCommeLues();
            return prochain;
          });
        }}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl transition-colors hover:bg-black/5"
        style={{ color: "var(--texte-3)" }}
        title="Notifications"
        aria-label="Notifications"
      >
        <Bell size={16} />
        {nombreNonLues > 0 && (
          <span
            className="absolute -right-1 -top-1 min-w-[1.2rem] rounded-full px-1 py-0.5 text-center text-[10px] font-bold text-white"
            style={{ background: "#dc2626" }}
          >
            {nombreNonLues > 9 ? "9+" : nombreNonLues}
          </span>
        )}
      </button>

      {ouvert && (
        <div
          className="absolute right-0 top-11 z-40 w-80 overflow-hidden rounded-2xl border shadow-2xl"
          style={{ background: "var(--fond-carte)", borderColor: "var(--bordure)" }}
        >
          <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: "var(--bordure)" }}>
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--texte)" }}>Notifications</p>
              <p className="text-xs" style={{ color: "var(--texte-3)" }}>
                {notifications.length} élément{notifications.length > 1 ? "s" : ""} récent{notifications.length > 1 ? "s" : ""}
              </p>
            </div>
            {notifications.length > 0 && (
              <button
                type="button"
                onClick={marquerToutesCommeLues}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors hover:bg-black/5"
                style={{ color: "var(--c-base)" }}
              >
                <CheckCheck size={13} />
                Tout lire
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notificationsRecentes.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm" style={{ color: "var(--texte-3)" }}>
                Aucune notification pour le moment.
              </div>
            ) : (
              notificationsRecentes.map((notification) => (
                <div
                  key={notification.id}
                  className="flex items-start gap-3 border-b px-4 py-3"
                  style={{
                    borderColor: "var(--bordure)",
                    background: notification.lue ? "transparent" : "color-mix(in srgb, var(--c-leger) 55%, transparent)",
                  }}
                  onMouseEnter={() => marquerCommeLue(notification.id)}
                >
                  <span
                    className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{
                      background:
                        notification.type === "succes" ? "#16a34a" :
                        notification.type === "erreur" ? "#dc2626" :
                        notification.type === "alerte" ? "#d97706" :
                        "#0284c7",
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-snug" style={{ color: "var(--texte)" }}>
                      {notification.message}
                    </p>
                    <p className="mt-1 text-[11px]" style={{ color: "var(--texte-3)" }}>
                      {formaterDate(notification.dateCreation)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => supprimerNotification(notification.id)}
                    className="rounded p-1 transition-colors hover:bg-black/5"
                    style={{ color: "var(--texte-3)" }}
                    aria-label="Supprimer la notification"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MenuUtilisateur() {
  const router = useRouter();
  const { utilisateur, deconnecter, definirUtilisateur } = useSessionStore();
  const [ouvert, setOuvert] = useState(false);
  const [modalProfil, setModalProfil] = useState(false);
  const [form, setForm] = useState({
    telephone: utilisateur?.telephone ?? "",
    langue: utilisateur?.langue ?? "fr",
    fuseau_horaire: utilisateur?.fuseau_horaire ?? "Europe/Paris",
    notifications_courriel: utilisateur?.notifications_courriel ?? true,
  });
  const [enregistrement, setEnregistrement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const conteneurRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setForm({
      telephone: utilisateur?.telephone ?? "",
      langue: utilisateur?.langue ?? "fr",
      fuseau_horaire: utilisateur?.fuseau_horaire ?? "Europe/Paris",
      notifications_courriel: utilisateur?.notifications_courriel ?? true,
    });
  }, [utilisateur]);

  useEffect(() => {
    if (!ouvert) return;
    const handler = (event: MouseEvent) => {
      if (conteneurRef.current && !conteneurRef.current.contains(event.target as Node)) {
        setOuvert(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [ouvert]);

  if (!utilisateur) return null;

  const initiales = utilisateur.nom_complet
    ? utilisateur.nom_complet.split(" ").map((m) => m[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  const gererDeconnexion = async () => {
    await deconnecter();
    router.push("/connexion");
  };

  const enregistrerProfil = async () => {
    setEnregistrement(true);
    setErreur(null);
    try {
      const reponse = await api.patch<typeof utilisateur>("/api/auth/moi/", form);
      definirUtilisateur({ ...utilisateur, ...reponse });
      setModalProfil(false);
      setOuvert(false);
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Impossible d'enregistrer le profil.");
    } finally {
      setEnregistrement(false);
    }
  };

  return (
    <div ref={conteneurRef} className="relative">
      <button
        type="button"
        onClick={() => setOuvert((v) => !v)}
        className="flex items-center gap-2 rounded-xl px-2 py-1.5 transition-colors hover:bg-black/5"
      >
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0"
          style={{ background: "var(--c-base)" }}
          title={utilisateur.nom_complet}
        >
          {initiales}
        </div>
        <div className="hidden md:block text-right">
          <p className="text-sm font-medium leading-none" style={{ color: "var(--texte)" }}>
            {utilisateur.nom_complet}
          </p>
          {utilisateur.profil_libelle && (
            <p className="text-xs mt-0.5" style={{ color: "var(--texte-3)" }}>
              {utilisateur.profil_libelle}
            </p>
          )}
        </div>
      </button>

      {ouvert && (
        <div
          className="absolute right-0 top-11 z-40 w-72 rounded-2xl border p-2 shadow-2xl"
          style={{ background: "var(--fond-carte)", borderColor: "var(--bordure)" }}
        >
          <button
            type="button"
            onClick={() => {
              setModalProfil(true);
              setOuvert(false);
            }}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-black/5"
            style={{ color: "var(--texte)" }}
          >
            <UserCog size={15} />
            Éditer mon profil
          </button>
          <div className="my-2 rounded-xl border p-3" style={{ borderColor: "var(--bordure)" }}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--texte-3)" }}>
              Thème
            </p>
            <BasculeTheme />
          </div>
          <button
            type="button"
            onClick={gererDeconnexion}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-red-600 transition-colors hover:bg-red-50"
          >
            <LogOut size={15} />
            Déconnexion
          </button>
        </div>
      )}

      {modalProfil && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4">
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Mon profil</h2>
                <p className="text-sm text-slate-500">{utilisateur.courriel}</p>
              </div>
              <button type="button" onClick={() => setModalProfil(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
              {erreur && <div className="sm:col-span-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{erreur}</div>}
              <div>
                <label className="libelle-champ">Prénom</label>
                <input className="champ-saisie cursor-not-allowed bg-slate-50 text-slate-500" value={utilisateur.prenom} readOnly />
              </div>
              <div>
                <label className="libelle-champ">Nom</label>
                <input className="champ-saisie cursor-not-allowed bg-slate-50 text-slate-500" value={utilisateur.nom} readOnly />
              </div>
              <div>
                <label className="libelle-champ">Téléphone</label>
                <input className="champ-saisie" value={form.telephone} onChange={(e) => setForm((p) => ({ ...p, telephone: e.target.value }))} />
              </div>
              <div>
                <label className="libelle-champ">Fonction</label>
                <input className="champ-saisie cursor-not-allowed bg-slate-50 text-slate-500" value={utilisateur.fonction} readOnly />
              </div>
              <div>
                <label className="libelle-champ">Langue</label>
                <select className="champ-saisie" value={form.langue} onChange={(e) => setForm((p) => ({ ...p, langue: e.target.value }))}>
                  <option value="fr">Français</option>
                  <option value="en">English</option>
                </select>
              </div>
              <div>
                <label className="libelle-champ">Fuseau horaire</label>
                <input className="champ-saisie" value={form.fuseau_horaire} onChange={(e) => setForm((p) => ({ ...p, fuseau_horaire: e.target.value }))} />
              </div>
              <label className="sm:col-span-2 inline-flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.notifications_courriel}
                  onChange={(e) => setForm((p) => ({ ...p, notifications_courriel: e.target.checked }))}
                />
                Recevoir les notifications par courriel
              </label>
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
              <button type="button" onClick={() => setModalProfil(false)} className="btn-secondaire">Annuler</button>
              <button type="button" onClick={enregistrerProfil} disabled={enregistrement} className="btn-primaire disabled:opacity-60">
                <Save className="h-4 w-4" />
                {enregistrement ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Composant principal
// ---------------------------------------------------------------------------

export function BarreNavigation() {
  return (
    <header
      className="h-14 flex items-center justify-between px-4 sm:px-6 gap-4 shrink-0 z-20"
      style={{
        background: "var(--barre-fond)",
        borderBottom: "1px solid var(--barre-bord)",
      }}
    >
      {/* Titre / fil d'Ariane */}
      <div className="flex items-center gap-3 min-w-0">
        <FilAriane />
      </div>

      {/* Actions droite */}
      <div className="flex items-center gap-3 shrink-0">
        <CentreNotifications />
        <MenuUtilisateur />
      </div>
    </header>
  );
}
