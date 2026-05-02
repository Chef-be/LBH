"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  AlertTriangle, CheckCircle2, ClipboardList, FileText, FolderOpen,
  Lightbulb, Route, Settings2, WalletCards,
} from "lucide-react";

interface ModuleActifProjet {
  code: string;
  libelle: string;
  actif: boolean;
  raison_activation: string;
  niveau_pertinence: string;
  actions_recommandees: string[];
  ordre: number;
}

interface FicheMetierProjetData {
  profil_fiche: string;
  en_tete: Record<string, string>;
  contexte_metier: Record<string, string | string[] | { code?: string; libelle?: string } | Array<{ code?: string; libelle?: string }>>;
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
}

function formaterMontant(valeur: string | number | null | undefined) {
  if (valeur == null || valeur === "") return "—";
  const nombre = Number(valeur);
  if (!Number.isFinite(nombre)) return "—";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(nombre);
}

function libelleProfil(code: string) {
  return {
    moa_enveloppe: "Fiche maîtrise d'ouvrage",
    moe_dce: "Fiche maîtrise d'œuvre",
    entreprise_ao: "Fiche entreprise - appel d'offres",
    entreprise_devis: "Fiche entreprise - devis direct",
    cotraitance: "Fiche co-traitance",
    sous_traitance: "Fiche sous-traitance",
    amo: "Fiche AMO / conseil",
    generique: "Fiche projet générique",
  }[code] || code;
}

function afficherValeurMetier(valeur: FicheMetierProjetData["contexte_metier"][string]) {
  if (Array.isArray(valeur)) {
    return valeur.map((item) => typeof item === "string" ? item : item.libelle || item.code || "").filter(Boolean).join(", ");
  }
  if (typeof valeur === "object" && valeur !== null) return valeur.libelle || valeur.code || "—";
  return valeur || "—";
}

function hrefModuleProjet(projetId: string, code: string) {
  if (code === "ressources") return "/ressources/devis";
  return `/projets/${projetId}/${code}`;
}

function CarteSection({ titre, icone, children }: { titre: string; icone: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">{icone}</span>
        <h2 className="text-sm font-semibold text-slate-900">{titre}</h2>
      </div>
      {children}
    </section>
  );
}

export function FicheMetierProjet({ projetId, fiche }: { projetId: string; fiche: FicheMetierProjetData }) {
  const modules = [...fiche.modules_actifs].sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{libelleProfil(fiche.profil_fiche)}</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">{fiche.en_tete.mission || "Mission à préciser"}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {fiche.en_tete.type_client || "Type client à préciser"} · {fiche.en_tete.phase || "Phase à préciser"} · {fiche.en_tete.role_lbh || "Rôle LBH à préciser"}
            </p>
          </div>
          <Link href={`/projets/${projetId}/economie`} className="btn-secondaire text-xs">
            Ouvrir le module Économie
          </Link>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2 space-y-6">
          <CarteSection titre="Contexte métier" icone={<ClipboardList size={16} />}>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {Object.entries(fiche.contexte_metier).filter(([, valeur]) => afficherValeurMetier(valeur) !== "—").map(([cle, valeur]) => (
                <div key={cle} className="rounded-xl bg-slate-50 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-slate-400">{cle.replace(/_/g, " ")}</p>
                  <p className="text-sm font-medium text-slate-800">{afficherValeurMetier(valeur)}</p>
                </div>
              ))}
            </div>
          </CarteSection>

          <CarteSection titre="Pièces sources" icone={<FolderOpen size={16} />}>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div>
                <p className="mb-2 text-xs font-semibold text-slate-500">Attendues</p>
                <ul className="space-y-1 text-sm text-slate-700">
                  {fiche.pieces_sources.attendues.map((piece) => <li key={piece.code}>• {piece.libelle}</li>)}
                </ul>
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold text-slate-500">Disponibles</p>
                {fiche.pieces_sources.detectees.length === 0 ? (
                  <p className="text-sm text-orange-700">Aucune pièce source détectée.</p>
                ) : (
                  <ul className="space-y-1 text-sm text-slate-700">
                    {fiche.pieces_sources.detectees.slice(0, 6).map((piece) => <li key={piece.id}>• {piece.intitule}</li>)}
                  </ul>
                )}
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold text-slate-500">Manquantes</p>
                {fiche.pieces_sources.manquantes.length === 0 ? (
                  <p className="text-sm text-emerald-700">Aucune pièce obligatoire manquante détectée.</p>
                ) : (
                  <ul className="space-y-1 text-sm text-orange-700">
                    {fiche.pieces_sources.manquantes.slice(0, 6).map((piece) => <li key={piece.code}>• {piece.libelle}</li>)}
                  </ul>
                )}
              </div>
            </div>
          </CarteSection>

          <CarteSection titre="Livrables attendus" icone={<CheckCircle2 size={16} />}>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {fiche.livrables.attendus.map((livrable) => (
                <div key={livrable.code} className="rounded-xl border border-slate-200 px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-slate-800">{livrable.libelle}</p>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">{livrable.statut}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">Module : {livrable.module_source || "documents"}</p>
                </div>
              ))}
            </div>
          </CarteSection>

          <CarteSection titre="Documents à produire" icone={<FileText size={16} />}>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {fiche.documents_a_produire.map((document) => (
                <div key={document.code} className="rounded-xl bg-slate-50 px-3 py-3">
                  <p className="text-sm font-medium text-slate-800">{document.libelle}</p>
                  <p className="mt-1 text-xs text-slate-500">{document.modele_disponible ? "Modèle disponible" : "Modèle à créer ou document à importer"} · {document.module_concerne}</p>
                </div>
              ))}
            </div>
          </CarteSection>
        </div>

        <div className="space-y-6">
          <CarteSection titre="Synthèse économique compacte" icone={<WalletCards size={16} />}>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-4"><dt className="text-slate-500">État</dt><dd className="font-medium text-slate-900">{fiche.synthese_economique.libelle_etat}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-500">Opération</dt><dd className="font-mono">{formaterMontant(fiche.synthese_economique.montant_operation_estime)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-500">Marché</dt><dd className="font-mono">{formaterMontant(fiche.synthese_economique.montant_marche)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-500">Honoraires</dt><dd className="font-mono">{formaterMontant(fiche.synthese_economique.honoraires_prevus)}</dd></div>
            </dl>
          </CarteSection>

          <CarteSection titre="Modules actifs" icone={<Settings2 size={16} />}>
            <div className="space-y-2">
              {modules.map((module) => (
                <Link key={module.code} href={hrefModuleProjet(projetId, module.code)} className="block rounded-xl border border-slate-200 px-3 py-2 transition hover:bg-slate-50">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-slate-800">{module.libelle}</p>
                    <span className="text-[11px] text-slate-400">{module.niveau_pertinence}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{module.raison_activation}</p>
                </Link>
              ))}
            </div>
          </CarteSection>

          <CarteSection titre="Alertes métier" icone={<AlertTriangle size={16} />}>
            {fiche.alertes_metier.length === 0 ? (
              <p className="text-sm text-emerald-700">Aucune alerte métier bloquante.</p>
            ) : (
              <ul className="space-y-2 text-sm text-orange-800">
                {fiche.alertes_metier.map((alerte) => <li key={alerte.code}>• {alerte.message}</li>)}
              </ul>
            )}
          </CarteSection>

          <CarteSection titre="Actions recommandées" icone={<Lightbulb size={16} />}>
            {fiche.actions_recommandees.length === 0 ? (
              <p className="text-sm text-slate-500">Aucune action immédiate.</p>
            ) : (
              <ul className="space-y-2 text-sm text-slate-700">
                {fiche.actions_recommandees.map((action) => <li key={action.code}>• {action.libelle}</li>)}
              </ul>
            )}
          </CarteSection>

          <CarteSection titre="Chaîne de production" icone={<Route size={16} />}>
            <p className="text-sm text-slate-600">Pièces sources → production métier → contrôle → livrable validé.</p>
          </CarteSection>
        </div>
      </div>
    </div>
  );
}
