"use client";

import Link from "next/link";
import { useState } from "react";
import { clsx } from "clsx";
import {
  AlertTriangle, CheckCircle2, FolderOpen, Layers3, Lightbulb, Route, X,
} from "lucide-react";

interface ModuleActifProjet {
  code: string;
  libelle: string;
  actif: boolean;
  raison_activation: string;
  niveau_pertinence: string;
  dependances?: string[];
  livrables_associes?: string[];
  actions_recommandees?: string[];
  ordre: number;
  statut?: string;
}

interface FicheMetierProjetData {
  profil_fiche: string;
  resume?: {
    titre: string;
    sous_titre: string;
    badge_coherence: string;
    score_coherence: number;
    statut_global: string;
  };
  contexte_compact?: Array<{ code: string; valeur_code?: string; libelle: string }>;
  contexte_detaille?: Record<string, unknown>;
  kpi?: Record<string, number>;
  visualisations?: Record<string, Array<Record<string, unknown>>>;
  parcours_metier: {
    profil?: string;
    etapes?: Array<{ code: string; libelle: string; statut: string; progression_pct: number; action_principale: string; alerte?: string } | string>;
  };
  en_tete: Record<string, string>;
  contexte_metier: Record<string, unknown>;
  modules_actifs: ModuleActifProjet[];
  pieces_sources: {
    attendues: Array<{ code: string; libelle: string; obligatoire?: boolean }>;
    detectees: Array<{ id: string; reference: string; intitule: string; type_document: string }>;
    manquantes: Array<{ code: string; libelle: string; obligatoire?: boolean }>;
  };
  livrables: {
    attendus: Array<{ id?: string; code: string; libelle: string; statut: string; module_source: string; document_lie?: string | null; document_lie_libelle?: string }>;
    produits: Array<{ code: string; libelle: string; statut: string }>;
    manquants: Array<{ code: string; libelle: string; statut: string }>;
  };
  documents_a_produire: Array<{ code: string; libelle: string; module_concerne: string; statut: string; modele_disponible: boolean }>;
  synthese_economique: {
    montant_operation_estime: string | number | null;
    montant_marche: string | number | null;
    honoraires_prevus: string | number | null;
    libelle_etat: string;
    lien_module: string;
  };
  alertes_metier: Array<{ niveau: string; code: string; message: string }>;
  actions_recommandees: Array<{ code: string; libelle: string; module: string }>;
  suggestions_correction?: Array<{ code: string; message: string }>;
}

function formaterMontant(valeur: string | number | null | undefined) {
  if (valeur == null || valeur === "") return "Non renseigné";
  const nombre = Number(String(valeur).replace(",", "."));
  if (!Number.isFinite(nombre)) return "Non renseigné";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(nombre);
}

function afficherValeurMetier(valeur: unknown): string {
  if (Array.isArray(valeur)) {
    return valeur.map((item) => afficherValeurMetier(item)).filter((v) => v && v !== "Non renseigné").join(", ");
  }
  if (typeof valeur === "object" && valeur !== null) {
    const obj = valeur as { libelle?: string; code?: string; valeur_code?: string };
    return obj.libelle || obj.code || obj.valeur_code || "Non renseigné";
  }
  if (typeof valeur === "boolean") return valeur ? "Oui" : "Non";
  return String(valeur || "Non renseigné");
}

function hrefModuleProjet(projetId: string, code: string) {
  if (code === "ressources") return "/ressources/devis";
  return `/projets/${projetId}/${code}`;
}

function couleurStatut(statut?: string) {
  if (statut === "incoherent" || statut === "bloquant") return "text-red-300 border-red-500/40 bg-red-500/10";
  if (statut === "a_verifier" || statut === "attention") return "text-orange-200 border-orange-400/40 bg-orange-500/10";
  if (statut === "pret" || statut === "coherent") return "text-emerald-200 border-emerald-400/40 bg-emerald-500/10";
  return "text-sky-200 border-sky-400/40 bg-sky-500/10";
}

function CarteSombre({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section
      className={clsx("rounded-2xl border p-5 shadow-sm", className)}
      style={{ background: "var(--fond-carte)", borderColor: "var(--bordure)" }}
    >
      {children}
    </section>
  );
}

function ProgressionProjetRing({ valeur }: { valeur: number }) {
  const pct = Math.max(0, Math.min(100, Number(valeur) || 0));
  return (
    <div className="relative h-24 w-24 rounded-full" style={{ background: `conic-gradient(var(--c-base) ${pct * 3.6}deg, color-mix(in srgb, var(--fond-entree) 80%, var(--bordure)) 0deg)` }}>
      <div className="absolute inset-3 flex items-center justify-center rounded-full" style={{ background: "var(--fond-carte)" }}>
        <span className="font-mono text-lg font-bold" style={{ color: "var(--texte-1)" }}>{pct}%</span>
      </div>
    </div>
  );
}

function KpiProjetCard({ libelle, valeur, detail, ton = "info" }: { libelle: string; valeur: string | number; detail?: string; ton?: "info" | "success" | "warning" | "danger" }) {
  const couleur = { info: "#38bdf8", success: "#34d399", warning: "#f59e0b", danger: "#f87171" }[ton];
  return (
    <div className="rounded-xl border p-4" style={{ background: "var(--fond-entree)", borderColor: "var(--bordure)" }}>
      <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--texte-3)" }}>{libelle}</p>
      <p className="mt-2 font-mono text-2xl font-bold" style={{ color: couleur }}>{valeur}</p>
      {detail && <p className="mt-1 text-xs" style={{ color: "var(--texte-3)" }}>{detail}</p>}
    </div>
  );
}

function ModalProjet({ titre, ouvert, onFermer, children }: { titre: string; ouvert: boolean; onFermer: () => void; children: React.ReactNode }) {
  if (!ouvert) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 px-4 py-8" onClick={(e) => { if (e.target === e.currentTarget) onFermer(); }}>
      <div className="w-full max-w-5xl rounded-2xl border p-6 shadow-2xl" style={{ background: "var(--fond-carte)", borderColor: "var(--bordure)" }}>
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold" style={{ color: "var(--texte-1)" }}>{titre}</h2>
          <button type="button" className="rounded-lg p-2 transition hover:opacity-70" onClick={onFermer} aria-label="Fermer">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function DrawerModuleProjet({ projetId, module, onFermer }: { projetId: string; module: ModuleActifProjet | null; onFermer: () => void }) {
  if (!module) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60" onClick={(e) => { if (e.target === e.currentTarget) onFermer(); }}>
      <aside className="h-full w-full max-w-md overflow-y-auto border-l p-6" style={{ background: "var(--fond-carte)", borderColor: "var(--bordure)" }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide" style={{ color: "var(--texte-3)" }}>Module projet</p>
            <h2 className="mt-1 text-lg font-semibold">{module.libelle}</h2>
          </div>
          <button type="button" onClick={onFermer} aria-label="Fermer"><X size={18} /></button>
        </div>
        <div className="mt-6 space-y-4 text-sm">
          <p style={{ color: "var(--texte-2)" }}>{module.raison_activation}</p>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--texte-3)" }}>Dépendances</p>
            {(module.dependances || []).length ? module.dependances?.map((dep) => <span key={dep} className="mr-2 rounded-full border px-2 py-1 text-xs" style={{ borderColor: "var(--bordure)" }}>{dep}</span>) : <span style={{ color: "var(--texte-3)" }}>Aucune dépendance bloquante.</span>}
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--texte-3)" }}>Actions</p>
            <ul className="space-y-1" style={{ color: "var(--texte-2)" }}>
              {(module.actions_recommandees || []).map((action) => <li key={action}>• {action}</li>)}
            </ul>
          </div>
          <Link href={hrefModuleProjet(projetId, module.code)} className="btn-primaire inline-flex text-sm">Ouvrir le module</Link>
        </div>
      </aside>
    </div>
  );
}

function BandeauSyntheseProjet({ fiche, onContexte, onControle, onMission }: { fiche: FicheMetierProjetData; onContexte: () => void; onControle: () => void; onMission: () => void }) {
  const resume = fiche.resume;
  const titre = resume?.titre || fiche.en_tete.mission || fiche.en_tete.intitule || "Mission à préciser";
  const sousTitre = resume?.sous_titre || [fiche.en_tete.type_client, fiche.en_tete.phase, fiche.en_tete.role_lbh].filter(Boolean).join(" · ");
  return (
    <CarteSombre className="overflow-hidden">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--texte-3)" }}>{fiche.profil_fiche.replace(/_/g, " ")}</p>
          <h2 className="mt-1 text-2xl font-semibold" style={{ color: "var(--texte-1)" }}>{titre}</h2>
          <p className="mt-2 max-w-4xl text-sm" style={{ color: "var(--texte-2)" }}>{sousTitre || "Contexte métier à compléter"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={clsx("rounded-full border px-3 py-1 text-xs font-semibold", couleurStatut(resume?.statut_global))}>{resume?.badge_coherence || "À qualifier"}</span>
          <span className="rounded-full border px-3 py-1 text-xs font-semibold" style={{ borderColor: "var(--bordure)", color: "var(--texte-2)" }}>Score {resume?.score_coherence ?? 0}/100</span>
          <button type="button" className="btn-secondaire text-xs" onClick={onContexte}>Voir / modifier le contexte</button>
          <button type="button" className="btn-secondaire text-xs" onClick={onControle}>Contrôle métier</button>
          <button type="button" className="btn-primaire text-xs" onClick={onMission}>Modifier mission</button>
        </div>
      </div>
    </CarteSombre>
  );
}

function TimelineParcoursMetier({ etapes }: { etapes: FicheMetierProjetData["parcours_metier"]["etapes"] }) {
  const liste = (etapes || []).map((etape, index) => (
    typeof etape === "string"
      ? { code: `etape-${index}`, libelle: etape, statut: "non_demarre", progression_pct: 0, action_principale: "" }
      : etape
  ));
  return (
    <CarteSombre>
      <div className="mb-4 flex items-center gap-2">
        <Route size={17} style={{ color: "var(--c-base)" }} />
        <h3 className="text-sm font-semibold">Parcours métier</h3>
      </div>
      <div className="grid gap-3 md:grid-cols-7">
        {liste.map((etape) => (
          <div key={etape.code} className="rounded-xl border p-3" style={{ background: "var(--fond-entree)", borderColor: "var(--bordure)" }}>
            <p className="text-xs font-semibold" style={{ color: "var(--texte-1)" }}>{etape.libelle}</p>
            <div className="mt-3 h-1.5 rounded-full" style={{ background: "color-mix(in srgb, var(--fond-carte) 70%, var(--bordure))" }}>
              <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, etape.progression_pct || 0))}%`, background: "var(--c-base)" }} />
            </div>
            <p className="mt-2 text-[11px]" style={{ color: "var(--texte-3)" }}>{etape.action_principale}</p>
          </div>
        ))}
      </div>
    </CarteSombre>
  );
}

export function FicheMetierProjet({ projetId, fiche }: { projetId: string; fiche: FicheMetierProjetData }) {
  const [modal, setModal] = useState<"contexte" | "controle" | "mission" | "pieces" | "livrables" | null>(null);
  const [moduleDetail, setModuleDetail] = useState<ModuleActifProjet | null>(null);
  const modules = [...(fiche.modules_actifs || [])].sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
  const kpi = fiche.kpi || {};
  const progression = Number(kpi.progression_globale_pct || 0);
  const alertesBloquantes = Number(kpi.alertes_bloquantes || 0);
  const alertesAttention = Number(kpi.alertes_attention || 0);

  return (
    <div className="space-y-6">
      <BandeauSyntheseProjet fiche={fiche} onContexte={() => setModal("contexte")} onControle={() => setModal("controle")} onMission={() => setModal("mission")} />

      <div className="grid gap-4 xl:grid-cols-[auto_1fr]">
        <CarteSombre className="flex items-center justify-center">
          <ProgressionProjetRing valeur={progression} />
        </CarteSombre>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <KpiProjetCard libelle="Pièces sources" valeur={`${kpi.pieces_sources_disponibles ?? 0}/${kpi.pieces_sources_total ?? 0}`} detail={`${kpi.pieces_sources_manquantes ?? 0} manquante(s)`} />
          <KpiProjetCard libelle="Livrables" valeur={`${kpi.livrables_produits ?? 0}/${kpi.livrables_total ?? 0}`} detail={`${kpi.livrables_valides ?? 0} validé(s)`} ton="success" />
          <KpiProjetCard libelle="Modules obligatoires" valeur={`${kpi.modules_prets ?? 0}/${kpi.modules_obligatoires ?? 0}`} detail="Prêts / attendus" />
          <KpiProjetCard libelle="Alertes" valeur={alertesBloquantes + alertesAttention} detail={`${alertesBloquantes} bloquante(s)`} ton={alertesBloquantes ? "danger" : alertesAttention ? "warning" : "success"} />
          <KpiProjetCard libelle="État économique" valeur={fiche.synthese_economique.libelle_etat} detail={formaterMontant(fiche.synthese_economique.montant_operation_estime)} ton="info" />
        </div>
      </div>

      <TimelineParcoursMetier etapes={fiche.parcours_metier.etapes} />

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
        <CarteSombre>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Layers3 size={17} style={{ color: "var(--c-base)" }} />
              <h3 className="text-sm font-semibold">Modules actifs</h3>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {modules.map((module) => (
              <div key={module.code} className="rounded-xl border p-4" style={{ background: "var(--fond-entree)", borderColor: "var(--bordure)" }}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{module.libelle}</p>
                    <p className="mt-1 text-xs" style={{ color: "var(--texte-3)" }}>{module.niveau_pertinence}</p>
                  </div>
                  <span className={clsx("rounded-full border px-2 py-0.5 text-[11px]", module.niveau_pertinence === "obligatoire" ? "border-orange-400/40 text-orange-200" : "border-sky-400/40 text-sky-200")}>{module.niveau_pertinence}</span>
                </div>
                <p className="mt-3 text-sm" style={{ color: "var(--texte-2)" }}>{module.raison_activation}</p>
                {(module.dependances || []).length > 0 && <p className="mt-2 text-xs text-orange-200">Dépendances : {(module.dependances || []).join(", ")}</p>}
                <div className="mt-4 flex gap-2">
                  <Link href={hrefModuleProjet(projetId, module.code)} className="btn-primaire text-xs">Ouvrir</Link>
                  <button type="button" className="btn-secondaire text-xs" onClick={() => setModuleDetail(module)}>Détail</button>
                </div>
              </div>
            ))}
          </div>
        </CarteSombre>

        <div className="space-y-6">
          <CarteSombre>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2"><FolderOpen size={16} style={{ color: "var(--c-base)" }} /><h3 className="text-sm font-semibold">Pièces sources</h3></div>
              <button type="button" className="btn-secondaire text-xs" onClick={() => setModal("pieces")}>Gérer</button>
            </div>
            <p className="text-2xl font-mono font-bold">{kpi.pieces_sources_disponibles ?? 0}/{kpi.pieces_sources_total ?? 0}</p>
            <p className="mt-1 text-sm text-orange-200">{fiche.pieces_sources.manquantes.slice(0, 2).map((p) => p.libelle).join(", ") || "Pièces critiques non détectées."}</p>
          </CarteSombre>

          <CarteSombre>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2"><CheckCircle2 size={16} style={{ color: "var(--c-base)" }} /><h3 className="text-sm font-semibold">Livrables</h3></div>
              <button type="button" className="btn-secondaire text-xs" onClick={() => setModal("livrables")}>Gérer</button>
            </div>
            <p className="text-2xl font-mono font-bold">{kpi.livrables_produits ?? 0}/{kpi.livrables_total ?? 0}</p>
            <p className="mt-1 text-sm" style={{ color: "var(--texte-3)" }}>{fiche.livrables.manquants.length} livrable(s) manquant(s)</p>
          </CarteSombre>

          <CarteSombre>
            <div className="mb-3 flex items-center gap-2"><AlertTriangle size={16} style={{ color: alertesBloquantes ? "#f87171" : "#f59e0b" }} /><h3 className="text-sm font-semibold">Alertes métier</h3></div>
            {fiche.alertes_metier.length === 0 ? (
              <p className="text-sm text-emerald-200">Aucune alerte métier bloquante.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {fiche.alertes_metier.slice(0, 4).map((alerte) => <li key={alerte.code} className={alerte.niveau === "bloquant" ? "text-red-200" : "text-orange-200"}>• {alerte.message}</li>)}
              </ul>
            )}
          </CarteSombre>
        </div>
      </div>

      <CarteSombre>
        <div className="mb-4 flex items-center gap-2"><Lightbulb size={16} style={{ color: "var(--c-base)" }} /><h3 className="text-sm font-semibold">Actions recommandées</h3></div>
        <div className="grid gap-3 md:grid-cols-3">
          {(fiche.actions_recommandees.length ? fiche.actions_recommandees : [{ code: "controle", libelle: "Contrôler les points métier", module: "projet" }]).map((action) => (
            <div key={action.code} className="rounded-xl border p-3 text-sm" style={{ background: "var(--fond-entree)", borderColor: "var(--bordure)" }}>
              <p className="font-medium">{action.libelle}</p>
              <p className="mt-1 text-xs" style={{ color: "var(--texte-3)" }}>Module : {action.module}</p>
            </div>
          ))}
        </div>
      </CarteSombre>

      <ModalProjet titre="Contexte projet" ouvert={modal === "contexte"} onFermer={() => setModal(null)}>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {Object.entries(fiche.contexte_detaille || fiche.contexte_metier || {}).map(([cle, valeur]) => (
            <div key={cle} className="rounded-xl border p-3" style={{ background: "var(--fond-entree)", borderColor: "var(--bordure)" }}>
              <p className="text-xs uppercase tracking-wide" style={{ color: "var(--texte-3)" }}>{cle.replace(/_/g, " ")}</p>
              <p className="mt-1 text-sm font-medium">{afficherValeurMetier(valeur)}</p>
            </div>
          ))}
        </div>
      </ModalProjet>

      <ModalProjet titre="Contrôle de cohérence métier" ouvert={modal === "controle"} onFermer={() => setModal(null)}>
        <div className="grid gap-4 lg:grid-cols-[auto_1fr]">
          <ProgressionProjetRing valeur={fiche.resume?.score_coherence ?? 0} />
          <div className="space-y-3">
            {fiche.alertes_metier.map((alerte) => (
              <div key={alerte.code} className={clsx("rounded-xl border p-3 text-sm", couleurStatut(alerte.niveau))}>{alerte.message}</div>
            ))}
            {(fiche.suggestions_correction || []).map((suggestion) => (
              <div key={suggestion.code} className="rounded-xl border p-3 text-sm text-sky-200" style={{ borderColor: "var(--bordure)" }}>{suggestion.message}</div>
            ))}
            {fiche.alertes_metier.length === 0 && <p className="text-sm text-emerald-200">La combinaison métier ne présente pas d&apos;incohérence bloquante.</p>}
          </div>
        </div>
      </ModalProjet>

      <ModalProjet titre="Modifier la mission" ouvert={modal === "mission"} onFermer={() => setModal(null)}>
        <p className="text-sm" style={{ color: "var(--texte-2)" }}>La modification de mission se fait depuis l&apos;écran de modification projet. Cette fenêtre présente les impacts métier à vérifier avant modification.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {modules.map((module) => <div key={module.code} className="rounded-xl border p-3 text-sm" style={{ background: "var(--fond-entree)", borderColor: "var(--bordure)" }}>{module.libelle} · {module.niveau_pertinence}</div>)}
        </div>
      </ModalProjet>

      <ModalProjet titre="Pièces sources" ouvert={modal === "pieces"} onFermer={() => setModal(null)}>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h3 className="mb-3 text-sm font-semibold">Attendues</h3>
            <ul className="space-y-2 text-sm">{fiche.pieces_sources.attendues.map((piece) => <li key={piece.code}>• {piece.libelle}</li>)}</ul>
          </div>
          <div>
            <h3 className="mb-3 text-sm font-semibold">Disponibles</h3>
            <ul className="space-y-2 text-sm">{fiche.pieces_sources.detectees.length ? fiche.pieces_sources.detectees.map((piece) => <li key={piece.id}>• {piece.intitule}</li>) : <li>Aucune pièce source classée.</li>}</ul>
          </div>
        </div>
      </ModalProjet>

      <ModalProjet titre="Livrables projet" ouvert={modal === "livrables"} onFermer={() => setModal(null)}>
        <div className="grid gap-3 md:grid-cols-2">
          {fiche.livrables.attendus.map((livrable) => (
            <div key={livrable.code} className="rounded-xl border p-3" style={{ background: "var(--fond-entree)", borderColor: "var(--bordure)" }}>
              <p className="font-medium">{livrable.libelle}</p>
              <p className="mt-1 text-xs" style={{ color: "var(--texte-3)" }}>{livrable.statut} · {livrable.module_source}</p>
            </div>
          ))}
        </div>
      </ModalProjet>

      <DrawerModuleProjet projetId={projetId} module={moduleDetail} onFermer={() => setModuleDetail(null)} />
    </div>
  );
}
