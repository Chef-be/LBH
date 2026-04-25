"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, History, Lock, Search, Settings2, SlidersHorizontal, ToggleLeft, ToggleRight, X } from "lucide-react";

import { api, ErreurApi } from "@/crochets/useApi";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

interface FonctionnaliteActivable {
  code: string;
  libelle: string;
  description: string;
  module: string;
  est_active: boolean;
  est_verrouillee: boolean;
}

interface JournalModification {
  id: string;
  cle_parametre: string;
  ancienne_valeur: string;
  nouvelle_valeur: string;
  modifie_par_nom: string | null;
  date_modification: string;
}

type Onglet = "modules" | "parametres" | "journal";

const ONGLETS: { id: Onglet; libelle: string; description: string }[] = [
  { id: "modules", libelle: "Modules & Fonctionnalités", description: "Activer ou désactiver les briques fonctionnelles." },
  { id: "parametres", libelle: "Réglages métier", description: "Paramètres techniques et valeurs métier." },
  { id: "journal", libelle: "Historique", description: "Traçabilité des dernières modifications." },
];

// Groupes de modules (icônes thématiques)
const ORDRE_MODULES: Record<string, number> = {
  general: 1,
  economie: 2,
  batiment: 3,
  voirie: 4,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formaterDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-FR");
}

function badgeModule(module: string) {
  const map: Record<string, string> = {
    general: "bg-slate-100 text-slate-600",
    economie: "bg-primaire-100 text-primaire-700",
    batiment: "bg-orange-100 text-orange-700",
    voirie: "bg-emerald-100 text-emerald-700",
    messagerie: "bg-blue-100 text-blue-700",
  };
  return map[module] ?? "bg-slate-100 text-slate-500";
}

// ---------------------------------------------------------------------------
// Carte de paramètre (éditable)
// ---------------------------------------------------------------------------

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
      setErreur(erreurCourante instanceof ErreurApi ? erreurCourante.detail : "Enregistrement impossible.");
    },
  });

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1.5 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${badgeModule(parametre.module)}`}>{parametre.module}</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">{parametre.type_valeur}</span>
            {parametre.est_verrouille && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-600">
                <Lock size={10} /> Verrouillé
              </span>
            )}
          </div>
          <p className="text-sm font-semibold text-slate-800">{parametre.libelle}</p>
          <p className="font-mono text-[11px] text-slate-400">{parametre.cle}</p>
        </div>
        {!parametre.est_verrouille && !edition && (
          <button onClick={() => setEdition(true)} className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:border-primaire-300 hover:text-primaire-700">
            Modifier
          </button>
        )}
      </div>

      {parametre.description && (
        <p className="text-xs text-slate-500">{parametre.description}</p>
      )}

      <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-400">Valeur actuelle</p>
        {edition ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              type={parametre.type_valeur === "decimal" || parametre.type_valeur === "entier" ? "number" : "text"}
              className="champ-saisie max-w-sm font-mono"
              value={valeur}
              onChange={(e) => setValeur(e.target.value)}
              step={parametre.type_valeur === "decimal" ? "0.001" : undefined}
            />
            <button onClick={() => mutate(valeur)} disabled={isPending} className="btn-primaire text-xs py-1.5">
              <Check size={13} /> Enregistrer
            </button>
            <button onClick={() => { setValeur(parametre.valeur); setEdition(false); }} className="btn-secondaire text-xs py-1.5">
              <X size={13} /> Annuler
            </button>
          </div>
        ) : (
          <p className="mt-2 break-all font-mono text-sm font-semibold text-slate-800">{parametre.valeur || "—"}</p>
        )}
        {erreur && <p className="mt-1.5 text-xs text-red-600">{erreur}</p>}
      </div>

      <div className="flex flex-wrap justify-between gap-2 text-[11px] text-slate-400">
        <span>Défaut : <span className="font-mono">{parametre.valeur_par_defaut || "—"}</span></span>
        <span>
          Modifié {formaterDate(parametre.date_modification)}
          {parametre.modifie_par_nom ? ` par ${parametre.modifie_par_nom}` : ""}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Carte de fonctionnalité (toggle)
// ---------------------------------------------------------------------------

function CarteFonctionnalite({ fonctionnalite }: { fonctionnalite: FonctionnaliteActivable }) {
  const queryClient = useQueryClient();
  const [optimiste, setOptimiste] = useState<boolean | null>(null);

  const estActive = optimiste !== null ? optimiste : fonctionnalite.est_active;

  const { mutate, isPending } = useMutation({
    mutationFn: (activer: boolean) =>
      api.patch(`/api/parametres/fonctionnalites/${fonctionnalite.code}/`, { est_active: activer }),
    onMutate: (activer) => setOptimiste(activer),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fonctionnalites"] });
      setOptimiste(null);
    },
    onError: () => {
      setOptimiste(null);
    },
  });

  return (
    <div className={`rounded-2xl border p-4 transition-all ${estActive ? "border-primaire-200 bg-primaire-50" : "border-slate-200 bg-white"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-semibold ${estActive ? "text-primaire-800" : "text-slate-700"}`}>
            {fonctionnalite.libelle}
          </p>
          {fonctionnalite.description && (
            <p className="mt-1 text-xs text-slate-500 leading-relaxed">{fonctionnalite.description}</p>
          )}
          <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${badgeModule(fonctionnalite.module)}`}>
            {fonctionnalite.module}
          </span>
        </div>
        <button
          type="button"
          onClick={() => !fonctionnalite.est_verrouillee && mutate(!estActive)}
          disabled={isPending || fonctionnalite.est_verrouillee}
          className={`shrink-0 transition-colors ${fonctionnalite.est_verrouillee ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
          title={fonctionnalite.est_verrouillee ? "Module verrouillé" : estActive ? "Désactiver" : "Activer"}
        >
          {estActive
            ? <ToggleRight className="h-8 w-8 text-primaire-500" />
            : <ToggleLeft className="h-8 w-8 text-slate-300" />
          }
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Composant principal
// ---------------------------------------------------------------------------

export function ListeParametres() {
  const [onglet, setOnglet] = useState<Onglet>("modules");
  const [recherche, setRecherche] = useState("");
  const [moduleActif, setModuleActif] = useState("tous");

  const { data: parametres = [], isLoading: chargementParametres } = useQuery<Parametre[]>({
    queryKey: ["parametres"],
    queryFn: () => api.get<Parametre[]>("/api/parametres/"),
    select: (data) => (Array.isArray(data) ? data : ((data as { results?: Parametre[] }).results ?? [])),
  });

  const { data: fonctionnalites = [], isLoading: chargementFonctionnalites } = useQuery<FonctionnaliteActivable[]>({
    queryKey: ["fonctionnalites"],
    queryFn: () => api.get<FonctionnaliteActivable[]>("/api/parametres/fonctionnalites/"),
    select: (data) => {
      const liste = Array.isArray(data) ? data : ((data as { results?: FonctionnaliteActivable[] }).results ?? []);
      return liste.sort((a, b) => {
        const oa = ORDRE_MODULES[a.module] ?? 99;
        const ob = ORDRE_MODULES[b.module] ?? 99;
        return oa !== ob ? oa - ob : a.libelle.localeCompare(b.libelle);
      });
    },
  });

  const { data: journal = [] } = useQuery<JournalModification[]>({
    queryKey: ["journal-parametres"],
    queryFn: () => api.get<JournalModification[]>("/api/parametres/journal/"),
    select: (data) => (Array.isArray(data) ? data : ((data as { results?: JournalModification[] }).results ?? [])),
  });

  // Paramètres : exclure le module messagerie (géré dans /administration/messagerie)
  const parametresFiltres = useMemo(() => {
    return parametres
      .filter((p) => p.module !== "messagerie")
      .filter((p) => {
        const correspondModule = moduleActif === "tous" || p.module === moduleActif;
        const terme = recherche.trim().toLowerCase();
        const correspondRecherche =
          terme === "" ||
          p.libelle.toLowerCase().includes(terme) ||
          p.cle.toLowerCase().includes(terme) ||
          p.description.toLowerCase().includes(terme);
        return correspondModule && correspondRecherche;
      });
  }, [moduleActif, parametres, recherche]);

  const modules = useMemo(
    () => Array.from(new Set(parametres.filter((p) => p.module !== "messagerie").map((p) => p.module))).sort(),
    [parametres]
  );

  const nbActives = fonctionnalites.filter((f) => f.est_active).length;
  const nbTotal = fonctionnalites.length;
  const chargement = chargementParametres || chargementFonctionnalites;

  if (chargement) {
    return <div className="py-16 text-center text-sm text-slate-400">Chargement des paramètres…</div>;
  }

  return (
    <div className="space-y-6">
      {/* Navigation onglets */}
      <div className="flex gap-1 rounded-2xl border border-slate-200 bg-slate-50 p-1.5">
        {ONGLETS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setOnglet(item.id)}
            className={`flex-1 rounded-xl px-4 py-3 text-left transition-all ${
              onglet === item.id
                ? "bg-white shadow-sm"
                : "hover:bg-white/60"
            }`}
          >
            <p className={`text-sm font-semibold ${onglet === item.id ? "text-primaire-700" : "text-slate-700"}`}>
              {item.libelle}
            </p>
            <p className="mt-0.5 text-xs text-slate-400">{item.description}</p>
          </button>
        ))}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Onglet Modules & Fonctionnalités                                    */}
      {/* ------------------------------------------------------------------ */}
      {onglet === "modules" && (
        <div className="space-y-6">
          {/* Résumé */}
          <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primaire-100">
              <Settings2 className="h-5 w-5 text-primaire-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">
                {nbActives} module{nbActives !== 1 ? "s" : ""} actif{nbActives !== 1 ? "s" : ""} sur {nbTotal}
              </p>
              <p className="text-xs text-slate-500">Cliquez sur le toggle pour activer ou désactiver un module sans redémarrage.</p>
            </div>
            <div className="ml-auto shrink-0">
              <Link
                href="/administration/messagerie"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:border-primaire-300 hover:text-primaire-700"
              >
                <Settings2 className="h-3.5 w-3.5" />
                Messagerie
              </Link>
            </div>
          </div>

          {/* Grille de toggles */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {fonctionnalites.map((f) => (
              <CarteFonctionnalite key={f.code} fonctionnalite={f} />
            ))}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Onglet Réglages métier                                              */}
      {/* ------------------------------------------------------------------ */}
      {onglet === "parametres" && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="grid gap-3 lg:grid-cols-[1fr_200px]">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  className="champ-saisie pl-9"
                  placeholder="Rechercher par libellé, clé ou description…"
                  value={recherche}
                  onChange={(e) => setRecherche(e.target.value)}
                />
              </div>
              <select className="champ-saisie" value={moduleActif} onChange={(e) => setModuleActif(e.target.value)}>
                <option value="tous">Tous les modules</option>
                {modules.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Les paramètres de messagerie (SMTP/IMAP) sont gérés dans{" "}
              <Link href="/administration/messagerie" className="text-primaire-600 hover:underline">Administration → Messagerie</Link>.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {parametresFiltres.map((p) => (
              <CarteParametre key={p.cle} parametre={p} />
            ))}
          </div>

          {parametresFiltres.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-14 text-center text-sm text-slate-400">
              Aucun paramètre ne correspond à la recherche.
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Onglet Historique                                                   */}
      {/* ------------------------------------------------------------------ */}
      {onglet === "journal" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <History className="h-4 w-4 text-slate-400" />
            <p className="text-sm font-semibold text-slate-700">
              {journal.length} modification{journal.length !== 1 ? "s" : ""} enregistrée{journal.length !== 1 ? "s" : ""}
            </p>
          </div>
          {journal.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-14 text-center text-sm text-slate-400">
              Aucun historique disponible pour le moment.
            </div>
          ) : (
            journal.slice(0, 50).map((entree) => (
              <div key={entree.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-semibold text-slate-800">{entree.cle_parametre}</p>
                    <p className="mt-1.5 text-xs text-slate-500">
                      <span className="text-slate-400">Avant :</span>{" "}
                      <span className="font-mono">{entree.ancienne_valeur || "—"}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      <span className="text-slate-400">Après :</span>{" "}
                      <span className="font-mono text-emerald-700">{entree.nouvelle_valeur || "—"}</span>
                    </p>
                  </div>
                  <div className="shrink-0 text-xs text-slate-400 md:text-right">
                    <p>{formaterDate(entree.date_modification)}</p>
                    <p className="mt-0.5">{entree.modifie_par_nom || "Système"}</p>
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
