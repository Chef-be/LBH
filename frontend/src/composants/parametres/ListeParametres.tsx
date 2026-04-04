"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { BriefcaseBusiness, Check, History, Lock, Search, Settings2, SlidersHorizontal, X } from "lucide-react";

import { api, ErreurApi } from "@/crochets/useApi";
import { GestionMessagerie } from "@/composants/parametres/GestionMessagerie";

interface Parametre {
  cle: string;
  libelle: string;
  description: string;
  type_valeur: string;
  valeur: string;
  valeur_par_defaut: string;
  est_verrouille: boolean;
  module: string;
  date_modification: string;
  modifie_par_nom: string | null;
}

interface JournalModification {
  id: string;
  cle_parametre: string;
  ancienne_valeur: string;
  nouvelle_valeur: string;
  modifie_par_nom: string | null;
  date_modification: string;
}

type Onglet = "resume" | "parametres" | "messagerie" | "journal";

const ONGLETS: { id: Onglet; libelle: string; description: string }[] = [
  { id: "resume", libelle: "Vue générale", description: "Synthèse des réglages et accès rapides." },
  { id: "parametres", libelle: "Réglages système", description: "Paramètres métier et techniques éditables." },
  { id: "messagerie", libelle: "Messagerie", description: "SMTP, IMAP et accès au webmail." },
  { id: "journal", libelle: "Historique", description: "Traçabilité des dernières modifications." },
];

function formaterDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-FR");
}

function badgeType(type: string) {
  if (type === "decimal" || type === "entier") return "badge-info";
  if (type === "booleen") return "badge-succes";
  if (type === "json" || type === "liste") return "badge-alerte";
  return "badge-neutre";
}

function CarteParametre({ parametre }: { parametre: Parametre }) {
  const queryClient = useQueryClient();
  const [edition, setEdition] = useState(false);
  const [valeur, setValeur] = useState(parametre.valeur);
  const [erreur, setErreur] = useState("");

  const { mutate, isPending } = useMutation({
    mutationFn: (nouvelleValeur: string) => api.patch(`/api/parametres/${parametre.cle}/`, { valeur: nouvelleValeur }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parametres"] });
      queryClient.invalidateQueries({ queryKey: ["journal-parametres"] });
      setEdition(false);
      setErreur("");
    },
    onError: (erreurCourante) => {
      if (erreurCourante instanceof ErreurApi) {
        setErreur(erreurCourante.detail);
      } else {
        setErreur("Enregistrement impossible.");
      }
    },
  });

  function annuler() {
    setValeur(parametre.valeur);
    setEdition(false);
    setErreur("");
  }

  return (
    <div className="rounded-3xl border p-5 space-y-4" style={{ borderColor: "var(--bordure)", background: "var(--fond-carte)" }}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="badge-neutre">{parametre.module}</span>
            <span className={badgeType(parametre.type_valeur)}>{parametre.type_valeur}</span>
            {parametre.est_verrouille && (
              <span className="badge-danger inline-flex items-center gap-1">
                <Lock size={12} />
                Verrouillé
              </span>
            )}
          </div>
          <div>
            <p className="font-semibold" style={{ color: "var(--texte)" }}>{parametre.libelle}</p>
            <p className="mt-1 text-xs font-mono" style={{ color: "var(--texte-3)" }}>{parametre.cle}</p>
          </div>
        </div>
        {!parametre.est_verrouille && !edition && (
          <button onClick={() => setEdition(true)} className="btn-secondaire text-xs">Modifier</button>
        )}
      </div>

      {parametre.description && (
        <p className="text-sm" style={{ color: "var(--texte-2)" }}>{parametre.description}</p>
      )}

      <div className="rounded-2xl border p-4" style={{ borderColor: "var(--bordure)", background: "color-mix(in srgb, var(--fond-carte) 88%, var(--fond-app))" }}>
        <p className="text-xs uppercase tracking-[0.18em]" style={{ color: "var(--texte-3)" }}>Valeur actuelle</p>
        {edition ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              type={parametre.type_valeur === "decimal" || parametre.type_valeur === "entier" ? "number" : "text"}
              className="champ-saisie max-w-sm font-mono"
              value={valeur}
              onChange={(e) => setValeur(e.target.value)}
              step={parametre.type_valeur === "decimal" ? "0.001" : undefined}
            />
            <button onClick={() => mutate(valeur)} disabled={isPending} className="btn-primaire text-xs">
              <Check size={14} />
              Enregistrer
            </button>
            <button onClick={annuler} className="btn-secondaire text-xs">
              <X size={14} />
              Annuler
            </button>
          </div>
        ) : (
          <p className="mt-3 break-all font-mono text-sm font-semibold" style={{ color: "var(--texte)" }}>{parametre.valeur || "—"}</p>
        )}
        {erreur && <p className="mt-2 text-xs text-red-600">{erreur}</p>}
      </div>

      <div className="flex flex-wrap justify-between gap-3 text-xs" style={{ color: "var(--texte-3)" }}>
        <span>Défaut : {parametre.valeur_par_defaut || "—"}</span>
        <span>
          Modifié le {formaterDate(parametre.date_modification)}
          {parametre.modifie_par_nom ? ` par ${parametre.modifie_par_nom}` : ""}
        </span>
      </div>
    </div>
  );
}

export function ListeParametres() {
  const [onglet, setOnglet] = useState<Onglet>("resume");
  const [recherche, setRecherche] = useState("");
  const [moduleActif, setModuleActif] = useState("tous");

  const { data: parametres = [], isLoading, isError } = useQuery<Parametre[]>({
    queryKey: ["parametres"],
    queryFn: () => api.get<Parametre[]>("/api/parametres/"),
    select: (data) => (Array.isArray(data) ? data : ((data as { results?: Parametre[] }).results ?? [])),
  });

  const { data: journal = [] } = useQuery<JournalModification[]>({
    queryKey: ["journal-parametres"],
    queryFn: () => api.get<JournalModification[]>("/api/parametres/journal/"),
    select: (data) => (Array.isArray(data) ? data : ((data as { results?: JournalModification[] }).results ?? [])),
  });

  const modules = useMemo(
    () => Array.from(new Set(parametres.map((parametre) => parametre.module))).sort((a, b) => a.localeCompare(b)),
    [parametres]
  );

  const parametresFiltres = useMemo(() => {
    return parametres.filter((parametre) => {
      const correspondModule = moduleActif === "tous" || parametre.module === moduleActif;
      const terme = recherche.trim().toLowerCase();
      const correspondRecherche =
        terme === "" ||
        parametre.libelle.toLowerCase().includes(terme) ||
        parametre.cle.toLowerCase().includes(terme) ||
        parametre.description.toLowerCase().includes(terme);
      return correspondModule && correspondRecherche;
    });
  }, [moduleActif, parametres, recherche]);

  const resumeModules = useMemo(() => {
    return modules.map((moduleCourant) => ({
      module: moduleCourant,
      total: parametres.filter((parametre) => parametre.module === moduleCourant).length,
    }));
  }, [modules, parametres]);

  if (isLoading) {
    return <div className="py-16 text-center text-sm" style={{ color: "var(--texte-2)" }}>Chargement des paramètres…</div>;
  }

  if (isError) {
    return <div className="py-16 text-center text-sm text-red-600">Erreur lors du chargement des paramètres.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border p-2" style={{ borderColor: "var(--bordure)", background: "var(--fond-carte)" }}>
        <nav className="grid gap-2 md:grid-cols-4">
          {ONGLETS.map((item) => (
            <button
              key={item.id}
              onClick={() => setOnglet(item.id)}
              className={clsx("rounded-2xl px-4 py-4 text-left transition-all", onglet === item.id && "shadow-sm")}
              style={{
                background: onglet === item.id ? "var(--c-leger)" : "transparent",
                border: `1px solid ${onglet === item.id ? "color-mix(in srgb, var(--c-base) 25%, var(--bordure))" : "transparent"}`,
              }}
            >
              <p className="text-sm font-semibold" style={{ color: onglet === item.id ? "var(--c-fort)" : "var(--texte)" }}>{item.libelle}</p>
              <p className="mt-1 text-xs" style={{ color: "var(--texte-2)" }}>{item.description}</p>
            </button>
          ))}
        </nav>
      </div>

      {onglet === "resume" && (
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
              <div>
                <span className="badge-info">Paramètres système</span>
                <h2 className="mt-3 flex items-center gap-2">
                  <Settings2 size={18} />
                  Pilotage global de la plateforme
                </h2>
                <p className="mt-2 text-sm" style={{ color: "var(--texte-2)" }}>
                  Les réglages métier, la messagerie et leur traçabilité sont désormais regroupés dans un espace unique.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { libelle: "Paramètres", valeur: parametres.length.toString() },
                  { libelle: "Modules", valeur: modules.length.toString() },
                  { libelle: "Verrouillés", valeur: parametres.filter((parametre) => parametre.est_verrouille).length.toString() },
                ].map((item) => (
                  <div key={item.libelle} className="rounded-2xl border px-4 py-3" style={{ borderColor: "var(--bordure)", background: "var(--fond-carte)" }}>
                    <p className="text-xs uppercase tracking-[0.18em]" style={{ color: "var(--texte-3)" }}>{item.libelle}</p>
                    <p className="mt-2 text-lg font-semibold" style={{ color: "var(--texte)" }}>{item.valeur}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <button onClick={() => setOnglet("parametres")} className="carte text-left hover:-translate-y-0.5 transition-transform">
              <SlidersHorizontal size={18} style={{ color: "var(--c-base)" }} />
              <h3 className="mt-4">Réglages système</h3>
              <p className="mt-2 text-sm" style={{ color: "var(--texte-2)" }}>
                Modifier les paramètres métier, filtrer par module et suivre les valeurs par défaut.
              </p>
            </button>
            <button onClick={() => setOnglet("messagerie")} className="carte text-left hover:-translate-y-0.5 transition-transform">
              <Settings2 size={18} style={{ color: "var(--c-base)" }} />
              <h3 className="mt-4">Messagerie</h3>
              <p className="mt-2 text-sm" style={{ color: "var(--texte-2)" }}>
                Centraliser SMTP, IMAP, notifications et accès au webmail utilisateur.
              </p>
            </button>
            <button onClick={() => setOnglet("journal")} className="carte text-left hover:-translate-y-0.5 transition-transform">
              <History size={18} style={{ color: "var(--c-base)" }} />
              <h3 className="mt-4">Historique</h3>
              <p className="mt-2 text-sm" style={{ color: "var(--texte-2)" }}>
                Visualiser les dernières évolutions et identifier qui a modifié quoi.
              </p>
            </button>
            <Link href="/parametres/couts-main-oeuvre" className="carte text-left hover:-translate-y-0.5 transition-transform">
              <BriefcaseBusiness size={18} style={{ color: "var(--c-base)" }} />
              <h3 className="mt-4">Paramétrage main-d’œuvre</h3>
              <p className="mt-2 text-sm" style={{ color: "var(--texte-2)" }}>
                Renseigner les profils, taux horaires et hypothèses de production exploitables dans les études de prix.
              </p>
            </Link>
          </div>

          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
            {resumeModules.map((item) => (
              <div key={item.module} className="carte">
                <p className="text-xs uppercase tracking-[0.18em]" style={{ color: "var(--texte-3)" }}>{item.module}</p>
                <p className="mt-3 text-2xl font-semibold" style={{ color: "var(--texte)" }}>{item.total}</p>
                <p className="mt-1 text-sm" style={{ color: "var(--texte-2)" }}>paramètre(s) dans ce module</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {onglet === "parametres" && (
        <div className="space-y-5">
          <div className="carte">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr),220px]">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--texte-3)" }} />
                <input
                  className="champ-saisie pl-9"
                  placeholder="Rechercher par libellé, clé ou description"
                  value={recherche}
                  onChange={(e) => setRecherche(e.target.value)}
                />
              </div>
              <select className="champ-saisie" value={moduleActif} onChange={(e) => setModuleActif(e.target.value)}>
                <option value="tous">Tous les modules</option>
                {modules.map((moduleCourant) => (
                  <option key={moduleCourant} value={moduleCourant}>{moduleCourant}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {parametresFiltres.map((parametre) => (
              <CarteParametre key={parametre.cle} parametre={parametre} />
            ))}
          </div>

          {parametresFiltres.length === 0 && (
            <div className="carte py-14 text-center text-sm" style={{ color: "var(--texte-2)" }}>
              Aucun paramètre ne correspond aux filtres en cours.
            </div>
          )}
        </div>
      )}

      {onglet === "messagerie" && <GestionMessagerie />}

      {onglet === "journal" && (
        <div className="space-y-4">
          {journal.length === 0 ? (
            <div className="carte py-14 text-center text-sm" style={{ color: "var(--texte-2)" }}>
              Aucun historique disponible pour le moment.
            </div>
          ) : (
            journal.slice(0, 50).map((entree) => (
              <div key={entree.id} className="carte">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="font-semibold" style={{ color: "var(--texte)" }}>{entree.cle_parametre}</p>
                    <p className="mt-2 text-sm" style={{ color: "var(--texte-2)" }}>
                      Ancienne valeur : <span className="font-mono">{entree.ancienne_valeur || "—"}</span>
                    </p>
                    <p className="mt-1 text-sm" style={{ color: "var(--texte-2)" }}>
                      Nouvelle valeur : <span className="font-mono">{entree.nouvelle_valeur || "—"}</span>
                    </p>
                  </div>
                  <div className="text-sm md:text-right" style={{ color: "var(--texte-3)" }}>
                    <p>{formaterDate(entree.date_modification)}</p>
                    <p className="mt-1">{entree.modifie_par_nom || "Modification système"}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
