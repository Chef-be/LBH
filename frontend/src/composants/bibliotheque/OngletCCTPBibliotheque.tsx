"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { api, ErreurApi, extraireListeResultats } from "@/crochets/useApi";
import {
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Filter,
  Link2,
  Search,
  X,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LotCCTP {
  id: string;
  numero: string;
  intitule: string;
  nb_prescriptions: number;
}

interface PrescriptionCCTP {
  id: string;
  intitule: string;
  corps: string;
  type_prescription: string;
  niveau: string;
  normes: string[];
  lot: { id: string; numero: string; intitule: string } | string;
  chapitre?: { id: string; intitule: string } | string;
}

interface LigneBibliothequeResume {
  id: string;
  code: string;
  designation_courte: string;
  unite: string;
  famille: string;
  statut_validation: string;
}

interface PageResultats<T> {
  count?: number;
  next?: string | null;
  results?: T[];
}

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const STYLES_NIVEAU: Record<string, string> = {
  obligatoire: "badge-danger",
  recommande: "badge-avertissement",
  alternatif: "badge-neutre",
  optionnel: "badge-neutre",
};

const LIBELLES_NIVEAU: Record<string, string> = {
  obligatoire: "Obligatoire",
  recommande: "Recommandé",
  alternatif: "Alternatif",
  optionnel: "Optionnel",
};

const LIBELLES_TYPE: Record<string, string> = {
  generalites: "Généralités",
  documents_reference: "Documents de référence",
  materiaux: "Matériaux",
  mise_en_oeuvre: "Mise en œuvre",
  controles: "Contrôles",
  tolerances: "Tolérances",
  garanties: "Garanties",
  interfaces: "Interfaces",
  reception: "Réception",
  entretien: "Entretien",
  securite: "Sécurité",
  environnement: "Environnement",
};

const TYPES_FILTRE = [
  { val: "", lib: "Tous les types" },
  { val: "generalites", lib: "Généralités" },
  { val: "materiaux", lib: "Matériaux" },
  { val: "mise_en_oeuvre", lib: "Mise en œuvre" },
  { val: "controles", lib: "Contrôles" },
  { val: "tolerances", lib: "Tolérances" },
  { val: "garanties", lib: "Garanties" },
];

// ---------------------------------------------------------------------------
// Sous-composant : modal liaison prescriptions
// ---------------------------------------------------------------------------

function ModalLierPrescriptions({
  ligneId,
  onFermer,
}: {
  ligneId: string;
  onFermer: () => void;
}) {
  const queryClient = useQueryClient();
  const [recherche, setRecherche] = useState("");
  const [filtreLot, setFiltreLot] = useState("");
  const [filtreType, setFiltreType] = useState("");
  const [selection, setSelection] = useState<string[]>([]);
  const [envoi, setEnvoi] = useState(false);
  const [succes, setSucces] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const { data: lotsData } = useQuery<LotCCTP[]>({
    queryKey: ["lots-cctp-liste"],
    queryFn: () => api.get<LotCCTP[]>("/api/bibliotheque/lots-cctp/"),
  });
  const lots = extraireListeResultats(lotsData as unknown as LotCCTP[] | PageResultats<LotCCTP> | null | undefined);

  const params = new URLSearchParams();
  if (recherche) params.set("search", recherche);
  if (filtreLot) params.set("lot", filtreLot);
  if (filtreType) params.set("type_prescription", filtreType);

  const { data: prescriptionsData, isLoading } = useQuery<PrescriptionCCTP[]>({
    queryKey: ["prescriptions-cctp-modal", recherche, filtreLot, filtreType],
    queryFn: () => api.get<PrescriptionCCTP[]>(`/api/pieces-ecrites/prescriptions/?${params.toString()}`),
  });
  const prescriptions = extraireListeResultats(
    prescriptionsData as unknown as PrescriptionCCTP[] | PageResultats<PrescriptionCCTP> | null | undefined
  );

  const toggleSelection = (id: string) => {
    setSelection((sel) =>
      sel.includes(id) ? sel.filter((s) => s !== id) : [...sel, id]
    );
  };

  const lier = async () => {
    if (selection.length === 0) return;
    setEnvoi(true);
    setErreur(null);
    try {
      const reponse = await api.post<{ detail: string }>(
        `/api/bibliotheque/${ligneId}/lier-prescriptions/`,
        { prescription_ids: selection }
      );
      setSucces(reponse.detail);
      setSelection([]);
      queryClient.invalidateQueries({ queryKey: ["prescriptions-liees", ligneId] });
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Liaison impossible.");
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="font-semibold text-slate-900">Lier des prescriptions CCTP</h2>
          <button type="button" onClick={onFermer} className="rounded-lg p-1.5 hover:bg-slate-100">
            <X className="h-4 w-4 text-slate-500" />
          </button>
        </div>

        <div className="p-4 border-b border-slate-100 flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-40">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="Rechercher…"
              className="champ-saisie pl-8 text-sm"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
            />
          </div>
          <select
            className="champ-saisie w-auto text-sm"
            value={filtreLot}
            onChange={(e) => setFiltreLot(e.target.value)}
          >
            <option value="">Tous les lots</option>
            {lots.map((lot) => (
              <option key={lot.id} value={lot.id}>{lot.numero} — {lot.intitule}</option>
            ))}
          </select>
          <select
            className="champ-saisie w-auto text-sm"
            value={filtreType}
            onChange={(e) => setFiltreType(e.target.value)}
          >
            {TYPES_FILTRE.map((t) => (
              <option key={t.val} value={t.val}>{t.lib}</option>
            ))}
          </select>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {isLoading ? (
            <div className="py-8 text-center text-slate-400 text-sm">Chargement…</div>
          ) : prescriptions.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-sm">Aucune prescription trouvée.</div>
          ) : (
            prescriptions.map((p) => (
              <label
                key={p.id}
                className={clsx(
                  "flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors",
                  selection.includes(p.id)
                    ? "border-primaire-300 bg-primaire-50"
                    : "border-slate-200 hover:border-slate-300"
                )}
              >
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={selection.includes(p.id)}
                  onChange={() => toggleSelection(p.id)}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800">{p.intitule}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <span className="badge-neutre text-xs">{LIBELLES_TYPE[p.type_prescription] || p.type_prescription}</span>
                    <span className={clsx(STYLES_NIVEAU[p.niveau] || "badge-neutre", "text-xs")}>
                      {LIBELLES_NIVEAU[p.niveau] || p.niveau}
                    </span>
                  </div>
                </div>
                {selection.includes(p.id) && (
                  <CheckCircle2 className="h-4 w-4 text-primaire-600 flex-shrink-0 mt-0.5" />
                )}
              </label>
            ))
          )}
        </div>

        {succes && (
          <div className="mx-4 mb-2 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
            {succes}
          </div>
        )}
        {erreur && (
          <div className="mx-4 mb-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {erreur}
          </div>
        )}

        <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4">
          <p className="text-sm text-slate-500">
            {selection.length > 0 ? `${selection.length} sélectionnée(s)` : "Aucune sélection"}
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={onFermer} className="btn-secondaire text-sm">
              Fermer
            </button>
            <button
              type="button"
              className="btn-primaire text-sm"
              onClick={lier}
              disabled={envoi || selection.length === 0}
            >
              <Link2 className="h-3.5 w-3.5" />
              Lier {selection.length > 0 ? `(${selection.length})` : ""}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Composant principal
// ---------------------------------------------------------------------------

export function OngletCCTPBibliotheque() {
  const [sousVue, setSousVue] = useState<"par-lot" | "par-ligne">("par-lot");
  const [lotSelectionne, setLotSelectionne] = useState<LotCCTP | null>(null);
  const [recherchePrescrip, setRecherchePrescrip] = useState("");
  const [filtreTypePrescrip, setFiltreTypePrescrip] = useState("");
  const [rechercheLigne, setRechercheLigne] = useState("");
  const [modalLiaisonLigneId, setModalLiaisonLigneId] = useState<string | null>(null);

  // Lots CCTP
  const { data: lotsData, isLoading: chargementLots } = useQuery<LotCCTP[]>({
    queryKey: ["bibliotheque-lots-cctp"],
    queryFn: () => api.get<LotCCTP[]>("/api/bibliotheque/lots-cctp/"),
  });
  const lots = extraireListeResultats(lotsData as unknown as LotCCTP[] | PageResultats<LotCCTP> | null | undefined);

  // Prescriptions du lot sélectionné
  const paramsPrescriptions = new URLSearchParams();
  if (lotSelectionne) paramsPrescriptions.set("lot", lotSelectionne.id);
  if (recherchePrescrip) paramsPrescriptions.set("search", recherchePrescrip);
  if (filtreTypePrescrip) paramsPrescriptions.set("type_prescription", filtreTypePrescrip);

  const { data: prescriptionsData, isLoading: chargementPrescriptions } = useQuery<PrescriptionCCTP[]>({
    queryKey: ["prescriptions-lot", lotSelectionne?.id, recherchePrescrip, filtreTypePrescrip],
    enabled: sousVue === "par-lot" && !!lotSelectionne,
    queryFn: () =>
      api.get<PrescriptionCCTP[]>(`/api/pieces-ecrites/prescriptions/?${paramsPrescriptions.toString()}`),
  });
  const prescriptions = extraireListeResultats(
    prescriptionsData as unknown as PrescriptionCCTP[] | PageResultats<PrescriptionCCTP> | null | undefined
  );

  // Lignes de bibliothèque (vue par ligne)
  const paramsLignes = new URLSearchParams({ statut_validation: "valide", ordering: "famille,code" });
  if (rechercheLigne) paramsLignes.set("search", rechercheLigne);

  const { data: lignesData, isLoading: chargementLignes } = useQuery<{ count: number; results: LigneBibliothequeResume[] }>({
    queryKey: ["bibliotheque-lignes-cctp", rechercheLigne],
    enabled: sousVue === "par-ligne",
    queryFn: () =>
      api.get<{ count: number; results: LigneBibliothequeResume[] }>(`/api/bibliotheque/?${paramsLignes.toString()}`),
  });
  const lignes = lignesData?.results ?? [];

  return (
    <div className="space-y-4">
      {/* Sélecteur sous-vue */}
      <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
        <button
          type="button"
          onClick={() => setSousVue("par-lot")}
          className={clsx(
            "rounded-lg px-3 py-1.5 text-sm transition-colors",
            sousVue === "par-lot" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
          )}
        >
          <span className="flex items-center gap-1.5">
            <BookOpen className="h-3.5 w-3.5" />
            Par lot
          </span>
        </button>
        <button
          type="button"
          onClick={() => setSousVue("par-ligne")}
          className={clsx(
            "rounded-lg px-3 py-1.5 text-sm transition-colors",
            sousVue === "par-ligne" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
          )}
        >
          <span className="flex items-center gap-1.5">
            <Link2 className="h-3.5 w-3.5" />
            Par ligne de prix
          </span>
        </button>
      </div>

      {/* Vue par lot */}
      {sousVue === "par-lot" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Colonne lots */}
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 px-1 mb-2">
              18 lots CCTP
            </p>
            {chargementLots ? (
              <div className="py-4 text-center text-slate-400 text-sm">Chargement…</div>
            ) : lots.length === 0 ? (
              <div className="py-4 text-center text-slate-400 text-sm">Aucun lot disponible.</div>
            ) : (
              lots.map((lot) => (
                <button
                  key={lot.id}
                  type="button"
                  onClick={() => setLotSelectionne(lot)}
                  className={clsx(
                    "w-full text-left flex items-center justify-between rounded-xl border px-3 py-2.5 text-sm transition-colors",
                    lotSelectionne?.id === lot.id
                      ? "border-primaire-300 bg-primaire-50 text-primaire-800"
                      : "border-slate-200 bg-white hover:border-slate-300 text-slate-700"
                  )}
                >
                  <div>
                    <span className="font-mono text-xs text-slate-400 mr-2">{lot.numero}</span>
                    <span className="font-medium">{lot.intitule}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {lot.nb_prescriptions > 0 && (
                      <span className="badge-neutre text-xs">{lot.nb_prescriptions}</span>
                    )}
                    <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Colonne prescriptions */}
          <div className="md:col-span-2 space-y-3">
            {!lotSelectionne ? (
              <div className="py-12 text-center text-slate-400 text-sm">
                Sélectionnez un lot pour voir ses prescriptions.
              </div>
            ) : (
              <>
                <div className="flex flex-wrap gap-2 items-center">
                  <div className="relative flex-1 min-w-40">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="search"
                      placeholder="Rechercher une prescription…"
                      className="champ-saisie pl-8 text-sm"
                      value={recherchePrescrip}
                      onChange={(e) => setRecherchePrescrip(e.target.value)}
                    />
                  </div>
                  <select
                    className="champ-saisie w-auto text-sm"
                    value={filtreTypePrescrip}
                    onChange={(e) => setFiltreTypePrescrip(e.target.value)}
                  >
                    {TYPES_FILTRE.map((t) => (
                      <option key={t.val} value={t.val}>{t.lib}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <Filter size={12} className="text-slate-400" />
                  <h3 className="text-sm font-semibold text-slate-700">
                    {lotSelectionne.numero} — {lotSelectionne.intitule}
                  </h3>
                  <span className="badge-neutre text-xs">{prescriptions.length} prescription(s)</span>
                </div>

                {chargementPrescriptions ? (
                  <div className="py-8 text-center text-slate-400 text-sm">Chargement…</div>
                ) : prescriptions.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-sm">Aucune prescription pour ce lot.</div>
                ) : (
                  <div className="space-y-2">
                    {prescriptions.map((p) => (
                      <div
                        key={p.id}
                        className="rounded-xl border border-slate-200 bg-white p-4 space-y-2"
                      >
                        <div className="flex flex-wrap items-start gap-2">
                          <p className="flex-1 text-sm font-medium text-slate-800">{p.intitule}</p>
                          <div className="flex gap-1 flex-wrap">
                            <span className="badge-neutre text-xs">
                              {LIBELLES_TYPE[p.type_prescription] || p.type_prescription}
                            </span>
                            <span className={clsx(STYLES_NIVEAU[p.niveau] || "badge-neutre", "text-xs")}>
                              {LIBELLES_NIVEAU[p.niveau] || p.niveau}
                            </span>
                          </div>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">{p.corps}</p>
                        {p.normes && p.normes.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {p.normes.slice(0, 4).map((norme, i) => (
                              <span key={i} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-mono text-slate-600">
                                {norme}
                              </span>
                            ))}
                            {p.normes.length > 4 && (
                              <span className="text-xs text-slate-400">+{p.normes.length - 4}</span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Vue par ligne de prix */}
      {sousVue === "par-ligne" && (
        <div className="space-y-3">
          <div className="relative max-w-sm">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="Rechercher une ligne de prix…"
              className="champ-saisie pl-8 text-sm"
              value={rechercheLigne}
              onChange={(e) => setRechercheLigne(e.target.value)}
            />
          </div>

          {chargementLignes ? (
            <div className="py-8 text-center text-slate-400 text-sm">Chargement…</div>
          ) : lignes.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-sm">
              {rechercheLigne ? "Aucun résultat." : "Bibliothèque vide."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs text-slate-500">
                    <th className="text-left py-2 pr-4 font-medium">Code</th>
                    <th className="text-left py-2 pr-4 font-medium">Désignation</th>
                    <th className="text-center py-2 pr-4 font-medium">Unité</th>
                    <th className="text-left py-2 pr-4 font-medium">Famille</th>
                    <th className="text-right py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {lignes.map((ligne) => (
                    <tr key={ligne.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="py-3 pr-4 font-mono text-xs text-slate-600">{ligne.code || "—"}</td>
                      <td className="py-3 pr-4 max-w-xs">
                        <span className="font-medium text-slate-800">
                          {ligne.designation_courte.length > 70
                            ? `${ligne.designation_courte.slice(0, 70)}…`
                            : ligne.designation_courte}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-center font-mono text-xs text-slate-500">{ligne.unite}</td>
                      <td className="py-3 pr-4 text-xs text-slate-500">{ligne.famille || "—"}</td>
                      <td className="py-3 text-right">
                        <button
                          type="button"
                          className="btn-secondaire text-xs"
                          onClick={() => setModalLiaisonLigneId(ligne.id)}
                        >
                          <Link2 className="h-3 w-3" />
                          Lier prescriptions
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal liaison prescriptions */}
      {modalLiaisonLigneId && (
        <ModalLierPrescriptions
          ligneId={modalLiaisonLigneId}
          onFermer={() => setModalLiaisonLigneId(null)}
        />
      )}
    </div>
  );
}
