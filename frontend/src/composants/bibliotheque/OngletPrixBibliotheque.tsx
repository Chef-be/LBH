"use client";

import { useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { api, ErreurApi, extraireListeResultats } from "@/crochets/useApi";
import { useSessionStore } from "@/crochets/useSession";
import { ActionsRapidesAdaptatives } from "@/composants/ui/ActionsRapides";
import {
  Calculator,
  DatabaseZap,
  Eye,
  FileText,
  FileUp,
  Filter,
  Pencil,
  Search,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LigneBibliotheque {
  id: string;
  code: string;
  designation_courte: string;
  designation_longue?: string;
  unite: string;
  famille: string;
  sous_famille: string;
  statut_validation: string;
  niveau?: string;
  debourse_sec_unitaire: string | number | null;
  prix_vente_unitaire: string | number | null;
  cout_matieres?: string | number | null;
  cout_materiel?: string | number | null;
  cout_consommables?: string | number | null;
  cout_sous_traitance?: string | number | null;
  cout_transport?: string | number | null;
  cout_frais_divers?: string | number | null;
  temps_main_oeuvre?: string | number | null;
  cout_horaire_mo?: string | number | null;
  lot_cctp_reference_detail?: { id: string; numero: string; intitule: string } | null;
}

interface LotCCTP {
  id: string;
  numero: string;
  intitule: string;
  nb_prescriptions: number;
}

interface PageResultats {
  count: number;
  next: string | null;
  results: LigneBibliotheque[];
}

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const STYLES_STATUT: Record<string, string> = {
  brouillon: "badge-neutre",
  a_valider: "badge-avertissement",
  valide: "badge-succes",
  obsolete: "badge-danger",
};

const LIBELLES_STATUT: Record<string, string> = {
  brouillon: "Brouillon",
  a_valider: "À valider",
  valide: "Validé",
  obsolete: "Obsolète",
};

const COULEURS_DS: Record<string, string> = {
  mo: "#3b82f6",
  matieres: "#10b981",
  materiel: "#f59e0b",
  consommables: "#8b5cf6",
  sous_traitance: "#06b6d4",
  transport: "#64748b",
  frais_divers: "#f43f5e",
};

const LIBELLES_DS: Record<string, string> = {
  mo: "MO",
  matieres: "Mat.",
  materiel: "Matériel",
  consommables: "Consom.",
  sous_traitance: "S-T",
  transport: "Transp.",
  frais_divers: "Frais",
};

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

function toNumber(val: string | number | null | undefined): number {
  if (val == null) return 0;
  return typeof val === "string" ? parseFloat(val) || 0 : val;
}

function formaterMontant(val: string | number | null | undefined): string {
  const n = toNumber(val);
  if (n === 0) return "—";
  return `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

function calculerComposantesMO(ligne: LigneBibliotheque): Record<string, number> {
  const mo = toNumber(ligne.temps_main_oeuvre) * toNumber(ligne.cout_horaire_mo);
  const matieres = toNumber(ligne.cout_matieres);
  const materiel = toNumber(ligne.cout_materiel);
  const consommables = toNumber(ligne.cout_consommables);
  const sous_traitance = toNumber(ligne.cout_sous_traitance);
  const transport = toNumber(ligne.cout_transport);
  const frais_divers = toNumber(ligne.cout_frais_divers);
  return { mo, matieres, materiel, consommables, sous_traitance, transport, frais_divers };
}

// ---------------------------------------------------------------------------
// Sous-composant : barres DS proportionnelles
// ---------------------------------------------------------------------------

function BarresDS({ ligne }: { ligne: LigneBibliotheque }) {
  const ds = toNumber(ligne.debourse_sec_unitaire);
  if (ds === 0) return <span className="text-xs text-slate-400">—</span>;

  const composantes = calculerComposantesMO(ligne);
  const total = Object.values(composantes).reduce((a, b) => a + b, 0) || ds;

  return (
    <div className="flex items-center gap-1">
      <div className="flex h-3 w-24 overflow-hidden rounded-full bg-slate-100">
        {Object.entries(composantes).map(([cle, valeur]) => {
          if (valeur <= 0) return null;
          const pct = Math.round((valeur / total) * 100);
          if (pct < 1) return null;
          return (
            <div
              key={cle}
              style={{ width: `${pct}%`, backgroundColor: COULEURS_DS[cle] }}
              title={`${LIBELLES_DS[cle]} : ${formaterMontant(valeur)} (${pct}%)`}
            />
          );
        })}
      </div>
      <span className="text-xs font-mono text-slate-600">{formaterMontant(ds)}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panneau latéral de détail
// ---------------------------------------------------------------------------

function PanneauDetailLigne({
  ligne,
  onFermer,
}: {
  ligne: LigneBibliotheque;
  onFermer: () => void;
}) {
  const ds = toNumber(ligne.debourse_sec_unitaire);
  const composantes = calculerComposantesMO(ligne);
  const total = Object.values(composantes).reduce((a, b) => a + b, 0) || ds;

  const lignesDS = [
    { cle: "mo", libelle: "Main-d'œuvre" },
    { cle: "matieres", libelle: "Matériaux" },
    { cle: "materiel", libelle: "Matériel" },
    { cle: "consommables", libelle: "Consommables" },
    { cle: "sous_traitance", libelle: "Sous-traitance" },
    { cle: "transport", libelle: "Transport" },
    { cle: "frais_divers", libelle: "Frais divers" },
  ];

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col bg-white shadow-2xl">
      {/* En-tête */}
      <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
        <div>
          <p className="text-xs font-mono text-slate-400">{ligne.code || "—"}</p>
          <h2 className="mt-0.5 text-base font-semibold text-slate-900">{ligne.designation_courte}</h2>
        </div>
        <button type="button" onClick={onFermer} className="rounded-lg p-1.5 hover:bg-slate-100">
          <X className="h-4 w-4 text-slate-500" />
        </button>
      </div>

      {/* Corps */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Informations générales */}
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">
            Informations générales
          </h3>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-slate-500">Famille</dt>
            <dd className="font-medium text-slate-800">{ligne.famille || "—"}</dd>
            <dt className="text-slate-500">Sous-famille</dt>
            <dd className="text-slate-700">{ligne.sous_famille || "—"}</dd>
            <dt className="text-slate-500">Unité</dt>
            <dd className="font-mono text-slate-700">{ligne.unite}</dd>
            <dt className="text-slate-500">Statut</dt>
            <dd>
              <span className={clsx(STYLES_STATUT[ligne.statut_validation] || "badge-neutre")}>
                {LIBELLES_STATUT[ligne.statut_validation] || ligne.statut_validation}
              </span>
            </dd>
            {ligne.lot_cctp_reference_detail && (
              <>
                <dt className="text-slate-500">Lot CCTP</dt>
                <dd className="text-slate-700">
                  {ligne.lot_cctp_reference_detail.numero} — {ligne.lot_cctp_reference_detail.intitule}
                </dd>
              </>
            )}
          </dl>
        </section>

        {/* Décomposition DS */}
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">
            Décomposition DS
          </h3>
          {ds === 0 ? (
            <p className="text-sm text-slate-400">Déboursé sec non renseigné.</p>
          ) : (
            <>
              {/* Barre empilée globale */}
              <div className="flex h-4 w-full overflow-hidden rounded-full bg-slate-100 mb-4">
                {lignesDS.map(({ cle, libelle }) => {
                  const valeur = composantes[cle];
                  if (valeur <= 0) return null;
                  const pct = Math.round((valeur / total) * 100);
                  if (pct < 1) return null;
                  return (
                    <div
                      key={cle}
                      style={{ width: `${pct}%`, backgroundColor: COULEURS_DS[cle] }}
                      title={`${libelle} : ${pct}%`}
                    />
                  );
                })}
              </div>

              {/* Tableau composantes */}
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs text-slate-400">
                    <th className="text-left py-1.5 font-medium">Composante</th>
                    <th className="text-right py-1.5 font-medium">Montant HT</th>
                    <th className="text-right py-1.5 font-medium">% DS</th>
                  </tr>
                </thead>
                <tbody>
                  {lignesDS.map(({ cle, libelle }) => {
                    const valeur = composantes[cle];
                    if (valeur <= 0) return null;
                    const pct = total > 0 ? Math.round((valeur / total) * 100) : 0;
                    return (
                      <tr key={cle} className="border-b border-slate-50">
                        <td className="py-2">
                          <div className="flex items-center gap-2">
                            <div
                              className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: COULEURS_DS[cle] }}
                            />
                            <span>{libelle}</span>
                          </div>
                        </td>
                        <td className="py-2 text-right font-mono text-slate-700">
                          {formaterMontant(valeur)}
                        </td>
                        <td className="py-2 text-right text-slate-500">{pct} %</td>
                      </tr>
                    );
                  })}
                  <tr className="border-t border-slate-200 font-semibold">
                    <td className="py-2">Déboursé sec total</td>
                    <td className="py-2 text-right font-mono">{formaterMontant(ds)}</td>
                    <td className="py-2 text-right">100 %</td>
                  </tr>
                  {toNumber(ligne.prix_vente_unitaire) > 0 && (
                    <tr>
                      <td className="py-1.5 text-slate-500">Prix de vente</td>
                      <td className="py-1.5 text-right font-mono text-primaire-700">
                        {formaterMontant(ligne.prix_vente_unitaire)}
                      </td>
                      <td />
                    </tr>
                  )}
                </tbody>
              </table>
            </>
          )}
        </section>
      </div>

      {/* Pied */}
      <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-6 py-4">
        <button type="button" onClick={onFermer} className="btn-secondaire text-sm">
          Fermer
        </button>
        <Link href={`/bibliotheque/${ligne.id}`} className="btn-primaire text-sm">
          <Pencil className="h-3.5 w-3.5" />
          Modifier
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Composant principal
// ---------------------------------------------------------------------------

export function OngletPrixBibliotheque() {
  const queryClient = useQueryClient();
  const utilisateur = useSessionStore((etat) => etat.utilisateur);
  const estSuperAdmin = Boolean(utilisateur?.est_super_admin);
  const selecteurFichiersRef = useRef<HTMLInputElement | null>(null);

  const [recherche, setRecherche] = useState("");
  const [filtreStatut, setFiltreStatut] = useState("valide");
  const [filtreLotCCTP, setFiltreLotCCTP] = useState("");
  const [page, setPage] = useState(1);
  const [suppressionId, setSuppressionId] = useState<string | null>(null);
  const [actionGlobale, setActionGlobale] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [ligneDetaillee, setLigneDetaillee] = useState<LigneBibliotheque | null>(null);

  const params = new URLSearchParams({ ordering: "famille,code", page: String(page) });
  if (recherche) params.set("search", recherche);
  if (filtreStatut) params.set("statut_validation", filtreStatut);

  const { data, isLoading, isError } = useQuery<PageResultats>({
    queryKey: ["bibliotheque", recherche, filtreStatut, filtreLotCCTP, page],
    queryFn: () => api.get<PageResultats>(`/api/bibliotheque/?${params.toString()}`),
  });

  const { data: lotsData } = useQuery<LotCCTP[]>({
    queryKey: ["bibliotheque-lots-cctp"],
    queryFn: () => api.get<LotCCTP[]>("/api/bibliotheque/lots-cctp/"),
  });

  const lignes = data?.results ?? [];
  const lots = extraireListeResultats(lotsData as unknown as LotCCTP[] | { results: LotCCTP[] } | null | undefined);

  const invaliderBibliotheque = () => {
    queryClient.invalidateQueries({ queryKey: ["bibliotheque"] });
  };

  const supprimerLigne = async (ligne: LigneBibliotheque) => {
    const confirmation = window.confirm(
      estSuperAdmin
        ? `Supprimer définitivement la ligne ${ligne.code || ligne.designation_courte} ?`
        : `Archiver la ligne ${ligne.code || ligne.designation_courte} ?`
    );
    if (!confirmation) return;

    setSuppressionId(ligne.id);
    setErreur(null);
    try {
      await api.supprimer(`/api/bibliotheque/${ligne.id}/`);
      setSucces(estSuperAdmin ? "Ligne supprimée définitivement." : "Ligne archivée.");
      invaliderBibliotheque();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Impossible de traiter cette ligne.");
    } finally {
      setSuppressionId(null);
    }
  };

  const importerReferentielPartage = async () => {
    setActionGlobale("referentiel");
    setErreur(null);
    try {
      const reponse = await api.post<{
        detail: string; fichiers: number; lignes: number; creees: number; mises_a_jour: number;
      }>("/api/bibliotheque/importer-bordereaux/", {});
      setSucces(
        `${reponse.detail} ${reponse.lignes} ligne(s) traitée(s), ${reponse.creees} créée(s), ${reponse.mises_a_jour} mise(s) à jour.`
      );
      invaliderBibliotheque();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Import du référentiel impossible.");
    } finally {
      setActionGlobale(null);
    }
  };

  const televerserFichiers = async (event: ChangeEvent<HTMLInputElement>) => {
    const fichiers = Array.from(event.target.files ?? []);
    if (fichiers.length === 0) return;

    const limite = window.prompt("Limiter le nombre de lignes importées par fichier ?", "");
    const formData = new FormData();
    fichiers.forEach((fichier) => formData.append("fichiers", fichier));
    if (limite?.trim()) formData.append("limite", limite.trim());

    setActionGlobale("televersement");
    setErreur(null);
    try {
      const reponse = await api.post<{
        detail: string; fichiers: number; fichiers_ignores: number;
        lignes: number; creees: number; mises_a_jour: number;
      }>("/api/bibliotheque/importer-fichiers/", formData);
      setSucces(
        `${reponse.detail} ${reponse.lignes} ligne(s) traitée(s), ${reponse.creees} créée(s), ${reponse.mises_a_jour} mise(s) à jour.`
      );
      invaliderBibliotheque();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Import des fichiers impossible.");
    } finally {
      event.target.value = "";
      setActionGlobale(null);
    }
  };

  const recalculerTousLesSousDetails = async () => {
    if (!window.confirm("Recalculer les sous-détails analytiques de toute la bibliothèque ?")) return;
    setActionGlobale("recalcul-global");
    setErreur(null);
    try {
      const reponse = await api.post<{
        detail: string; lignes_recalculees: number; lignes_regenerees: number;
        sous_details_generes: number; lignes_ignorees: number;
      }>("/api/bibliotheque/recalculer-tous/", { regenerer_absents: true });
      setSucces(
        `${reponse.detail} ${reponse.lignes_recalculees} ligne(s), ${reponse.sous_details_generes} sous-détail(s).`
      );
      invaliderBibliotheque();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Recalcul global impossible.");
    } finally {
      setActionGlobale(null);
    }
  };

  const viderBibliotheque = async () => {
    if (!estSuperAdmin) return;
    if (!window.confirm("Vider entièrement la bibliothèque de prix ?")) return;
    setActionGlobale("purge");
    setErreur(null);
    try {
      const reponse = await api.supprimer("/api/bibliotheque/vider/") as {
        detail: string; lignes_supprimees: number;
      };
      setSucces(`${reponse.detail} ${reponse.lignes_supprimees} ligne(s) supprimée(s).`);
      setPage(1);
      invaliderBibliotheque();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Purge impossible.");
    } finally {
      setActionGlobale(null);
    }
  };

  return (
    <>
      <input
        ref={selecteurFichiersRef}
        type="file"
        accept=".pdf,.PDF"
        multiple
        className="hidden"
        onChange={televerserFichiers}
      />

      {/* Barre de filtres */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            placeholder="Rechercher par code, désignation…"
            className="champ-saisie pl-8"
            value={recherche}
            onChange={(e) => { setRecherche(e.target.value); setPage(1); }}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-slate-400" />
          <select
            className="champ-saisie w-auto"
            value={filtreStatut}
            onChange={(e) => { setFiltreStatut(e.target.value); setPage(1); }}
          >
            <option value="">Tous statuts</option>
            {Object.entries(LIBELLES_STATUT).map(([val, lib]) => (
              <option key={val} value={val}>{lib}</option>
            ))}
          </select>
        </div>
        {lots.length > 0 && (
          <select
            className="champ-saisie w-auto"
            value={filtreLotCCTP}
            onChange={(e) => { setFiltreLotCCTP(e.target.value); setPage(1); }}
          >
            <option value="">Tous lots CCTP</option>
            {lots.map((lot) => (
              <option key={lot.id} value={lot.id}>{lot.numero} — {lot.intitule}</option>
            ))}
          </select>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-secondaire text-sm"
          onClick={() => selecteurFichiersRef.current?.click()}
          disabled={actionGlobale === "televersement"}
        >
          <FileUp className="w-4 h-4" />
          Importer PDF
        </button>
        <button
          type="button"
          className="btn-secondaire text-sm"
          onClick={importerReferentielPartage}
          disabled={actionGlobale === "referentiel"}
        >
          <UploadCloud className="w-4 h-4" />
          Importer référentiel
        </button>
        <button
          type="button"
          className="btn-secondaire text-sm"
          onClick={recalculerTousLesSousDetails}
          disabled={actionGlobale === "recalcul-global"}
        >
          <Calculator className="w-4 h-4" />
          Recalculer
        </button>
        <Link href="/documents" className="btn-secondaire text-sm">
          <FileText className="w-4 h-4" />
          GED
        </Link>
        {estSuperAdmin && (
          <button
            type="button"
            className="btn-danger text-sm"
            onClick={viderBibliotheque}
            disabled={actionGlobale === "purge"}
          >
            <Trash2 className="w-4 h-4" />
            Vider
          </button>
        )}
      </div>

      {succes && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {succes}
        </div>
      )}
      {erreur && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {erreur}
        </div>
      )}

      {isLoading ? (
        <div className="py-12 text-center text-slate-400 text-sm">Chargement…</div>
      ) : isError ? (
        <div className="py-12 text-center text-red-500 text-sm">Erreur lors du chargement.</div>
      ) : lignes.length === 0 ? (
        <div className="py-12 text-center text-slate-400 text-sm">
          {recherche || filtreStatut ? "Aucun résultat." : "Bibliothèque vide."}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs text-slate-500">
                <th className="text-left py-2 pr-4 font-medium">Code</th>
                <th className="text-left py-2 pr-4 font-medium">Désignation</th>
                <th className="text-left py-2 pr-4 font-medium">Famille</th>
                <th className="text-center py-2 pr-4 font-medium">Unité</th>
                <th className="text-left py-2 pr-4 font-medium">Déboursé sec</th>
                <th className="text-right py-2 pr-4 font-medium">PV HT</th>
                <th className="text-left py-2 pr-4 font-medium">Statut</th>
                <th className="text-right py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((ligne) => (
                <tr
                  key={ligne.id}
                  className="border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer"
                  onClick={() => setLigneDetaillee(ligne)}
                >
                  <td className="py-3 pr-4 font-mono text-xs text-slate-600">{ligne.code || "—"}</td>
                  <td className="py-3 pr-4 max-w-xs">
                    <span className="font-medium truncate block text-slate-800">
                      {ligne.designation_courte.length > 80
                        ? `${ligne.designation_courte.slice(0, 80)}…`
                        : ligne.designation_courte}
                    </span>
                    {ligne.sous_famille && (
                      <p className="text-xs text-slate-400 mt-0.5">{ligne.sous_famille}</p>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-xs text-slate-500">{ligne.famille || "—"}</td>
                  <td className="py-3 pr-4 text-center font-mono text-xs text-slate-500">{ligne.unite}</td>
                  <td className="py-3 pr-4" onClick={(e) => e.stopPropagation()}>
                    <BarresDS ligne={ligne} />
                  </td>
                  <td className="py-3 pr-4 text-right font-mono text-xs font-medium text-primaire-700">
                    {formaterMontant(ligne.prix_vente_unitaire)}
                  </td>
                  <td className="py-3 pr-4">
                    <span className={clsx(STYLES_STATUT[ligne.statut_validation] || "badge-neutre")}>
                      {LIBELLES_STATUT[ligne.statut_validation] || ligne.statut_validation}
                    </span>
                  </td>
                  <td className="py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <ActionsRapidesAdaptatives
                      actions={[
                        {
                          onClick: () => setLigneDetaillee(ligne),
                          titre: "Voir le détail",
                          icone: Eye,
                        },
                        {
                          href: `/bibliotheque/${ligne.id}`,
                          titre: "Modifier",
                          icone: Pencil,
                          variante: "primaire",
                        },
                        {
                          titre: estSuperAdmin ? "Supprimer" : "Archiver",
                          icone: Trash2,
                          variante: "danger",
                          disabled: suppressionId === ligne.id,
                          onClick: () => supprimerLigne(ligne),
                        },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && data.count > 20 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-slate-400">
            {data.count} ligne{data.count > 1 ? "s" : ""}
          </p>
          <div className="flex gap-2">
            <button
              className="btn-secondaire py-1 px-3 text-xs"
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ← Précédent
            </button>
            <button
              className="btn-secondaire py-1 px-3 text-xs"
              disabled={!data.next}
              onClick={() => setPage((p) => p + 1)}
            >
              Suivant →
            </button>
          </div>
        </div>
      )}

      {/* Panneau latéral */}
      {ligneDetaillee && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/20"
            onClick={() => setLigneDetaillee(null)}
          />
          <PanneauDetailLigne
            ligne={ligneDetaillee}
            onFermer={() => setLigneDetaillee(null)}
          />
        </>
      )}
    </>
  );
}
