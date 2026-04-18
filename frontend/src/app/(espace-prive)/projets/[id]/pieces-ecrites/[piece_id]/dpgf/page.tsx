"use client";

import { use, useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Plus, Trash2, ChevronDown, ChevronRight,
  Download, FolderPlus, FileText, Save, Search, X,
  BookOpen, BarChart2, Check,
} from "lucide-react";
import { api } from "@/crochets/useApi";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LigneDPGF {
  id: string;
  piece_ecrite: string;
  ordre: number;
  type_ligne: "lot" | "article" | "sous_total" | "commentaire";
  type_libelle: string;
  lot_code: string;
  lot_intitule: string;
  numero: string;
  designation: string;
  unite: string;
  quantite: string | null;
  prix_unitaire_ht: string | null;
  montant_ht: number | null;
}

interface PieceEcrite {
  id: string;
  intitule: string;
  statut: string;
  modele: { type_document: string; libelle: string };
  projet: string;
}

interface LigneForm {
  id?: string;
  ordre: number;
  type_ligne: "lot" | "article" | "sous_total" | "commentaire";
  lot_code: string;
  lot_intitule: string;
  numero: string;
  designation: string;
  unite: string;
  quantite: string;
  prix_unitaire_ht: string;
}

interface LigneBibliotheque {
  id: string;
  code: string;
  famille: string;
  sous_famille: string;
  designation_courte: string;
  unite: string;
  prix_vente_unitaire: string;
  debourse_sec_unitaire: string;
  fiabilite: number;
}

interface LigneTCE {
  designation: string;
  ratio_pct: number;
  montant_ht: number;
  categorie: string;
  couleur: string;
  code?: string;
}

interface EtudeEconomique {
  id: string;
  intitule: string;
  date_creation: string;
  total_prix_vente: number | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const cs = {
  background: "var(--fond-entree)",
  border: "1px solid var(--bordure)",
  color: "var(--texte)",
};

const formatMontant = (v: number | null) =>
  v === null ? "—" : v.toLocaleString("fr-FR", { minimumFractionDigits: 2 }) + " €";

const montantLocal = (qte: string, pu: string): number | null => {
  const q = parseFloat(qte);
  const p = parseFloat(pu);
  if (isNaN(q) || isNaN(p)) return null;
  return q * p;
};

function totalLot(lignes: LigneForm[], lotCode: string): number {
  return lignes
    .filter((l) => l.type_ligne === "article" && l.lot_code === lotCode)
    .reduce((s, l) => s + (montantLocal(l.quantite, l.prix_unitaire_ht) ?? 0), 0);
}

function totalGeneral(lignes: LigneForm[]): number {
  return lignes
    .filter((l) => l.type_ligne === "article")
    .reduce((s, l) => s + (montantLocal(l.quantite, l.prix_unitaire_ht) ?? 0), 0);
}

// ─── Modale recherche bibliothèque ────────────────────────────────────────────

function ModaleBibliotheque({
  onInserer,
  onFermer,
}: {
  onInserer: (ligne: { designation: string; unite: string; prix_unitaire_ht: string }) => void;
  onFermer: () => void;
}) {
  const [recherche, setRecherche] = useState("");
  const [resultats, setResultats] = useState<LigneBibliotheque[]>([]);
  const [chargement, setChargement] = useState(false);
  const [selectionne, setSelectionne] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const chercher = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResultats([]); return; }
    setChargement(true);
    try {
      const r = await api.get<{ results?: LigneBibliotheque[] } | LigneBibliotheque[]>(
        `/api/bibliotheque/?search=${encodeURIComponent(q)}&niveau=reference&page_size=30`
      );
      setResultats(Array.isArray(r) ? r : (r.results ?? []));
    } catch {
      setResultats([]);
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => chercher(recherche), 350);
    return () => clearTimeout(t);
  }, [recherche, chercher]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div
        className="w-full max-w-3xl rounded-2xl flex flex-col max-h-[85vh]"
        style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}
      >
        {/* En-tête */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--bordure)" }}>
          <div className="flex items-center gap-2">
            <BookOpen size={16} style={{ color: "var(--c-base)" }} />
            <h3 className="font-semibold text-sm" style={{ color: "var(--texte)" }}>
              Bibliothèque de prix ARTIPRIX
            </h3>
          </div>
          <button type="button" onClick={onFermer} style={{ color: "var(--texte-3)" }}>
            <X size={16} />
          </button>
        </div>

        {/* Recherche */}
        <div className="px-5 py-3" style={{ borderBottom: "1px solid var(--bordure)" }}>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--texte-3)" }} />
            <input
              ref={inputRef}
              type="text"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Rechercher une prestation (béton, ferraillage, enduit…)"
              className="w-full rounded-lg pl-9 pr-4 py-2 text-sm"
              style={cs}
            />
          </div>
          {chargement && (
            <p className="text-xs mt-1.5" style={{ color: "var(--texte-3)" }}>Recherche en cours…</p>
          )}
        </div>

        {/* Résultats */}
        <div className="flex-1 overflow-y-auto">
          {resultats.length === 0 && !chargement && recherche.length >= 2 && (
            <div className="px-5 py-8 text-center text-sm" style={{ color: "var(--texte-3)" }}>
              Aucune prestation trouvée pour « {recherche} »
            </div>
          )}
          {resultats.length === 0 && recherche.length < 2 && (
            <div className="px-5 py-8 text-center text-sm" style={{ color: "var(--texte-3)" }}>
              Saisissez au moins 2 caractères pour rechercher
            </div>
          )}
          {resultats.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-3 px-5 py-3 cursor-pointer"
              style={{
                borderBottom: "1px solid var(--bordure)",
                background: selectionne === r.id ? "var(--c-leger)" : undefined,
              }}
              onClick={() => setSelectionne(r.id)}
              onDoubleClick={() => {
                onInserer({
                  designation: r.designation_courte,
                  unite: r.unite,
                  prix_unitaire_ht: parseFloat(r.prix_vente_unitaire).toFixed(2),
                });
                onFermer();
              }}
            >
              {selectionne === r.id && (
                <Check size={14} style={{ color: "var(--c-base)", flexShrink: 0 }} />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: "var(--texte)" }}>
                  {r.designation_courte}
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--texte-3)" }}>
                  {r.famille}{r.sous_famille ? ` › ${r.sous_famille}` : ""} · {r.code}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-mono font-semibold" style={{ color: "var(--c-base)" }}>
                  {parseFloat(r.prix_vente_unitaire).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
                </p>
                <p className="text-xs" style={{ color: "var(--texte-3)" }}>/{r.unite}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Pied */}
        <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: "1px solid var(--bordure)" }}>
          <p className="text-xs" style={{ color: "var(--texte-3)" }}>
            {resultats.length > 0 ? `${resultats.length} résultat(s) — double-clic pour insérer` : ""}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onFermer}
              className="px-4 py-2 rounded-lg text-sm border"
              style={{ borderColor: "var(--bordure)", color: "var(--texte-2)" }}
            >
              Annuler
            </button>
            <button
              type="button"
              disabled={!selectionne}
              onClick={() => {
                const r = resultats.find((x) => x.id === selectionne);
                if (!r) return;
                onInserer({
                  designation: r.designation_courte,
                  unite: r.unite,
                  prix_unitaire_ht: parseFloat(r.prix_vente_unitaire).toFixed(2),
                });
                onFermer();
              }}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-40"
              style={{ background: "var(--c-base)" }}
            >
              Insérer la ligne
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Modale import TCE ────────────────────────────────────────────────────────

function ModaleImportTCE({
  projetId,
  onImporter,
  onFermer,
}: {
  projetId: string;
  onImporter: (lignes: LigneForm[]) => void;
  onFermer: () => void;
}) {
  const [etudes, setEtudes] = useState<EtudeEconomique[]>([]);
  const [etudeId, setEtudeId] = useState("");
  const [lignesTCE, setLignesTCE] = useState<LigneTCE[]>([]);
  const [chargement, setChargement] = useState(false);

  useEffect(() => {
    api.get<{ results?: EtudeEconomique[] } | EtudeEconomique[]>(
      `/api/economie/?projet=${projetId}&ordering=-date_creation&page_size=20`
    ).then((r) => {
      const liste = Array.isArray(r) ? r : (r.results ?? []);
      setEtudes(liste);
      if (liste.length > 0) setEtudeId(liste[0].id);
    }).catch(() => {});
  }, [projetId]);

  const chargerLignesTCE = useCallback(async (id: string) => {
    if (!id) return;
    setChargement(true);
    try {
      const r = await api.get<{ results?: Array<{ designation: string; quantite: number; prix_vente_unitaire: number; montant_ht: number; code_lot?: string }> } | Array<{ designation: string; quantite: number; prix_vente_unitaire: number; montant_ht: number; code_lot?: string }>>(
        `/api/economie/${id}/lignes/`
      );
      const lignes = Array.isArray(r) ? r : (r.results ?? []);
      setLignesTCE(lignes.map((l) => ({
        designation: l.designation,
        ratio_pct: 0,
        montant_ht: l.montant_ht ?? (l.quantite * l.prix_vente_unitaire),
        categorie: l.code_lot ?? "GO",
        couleur: "#4A6FA5",
        code: l.code_lot,
      })));
    } catch {
      setLignesTCE([]);
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    if (etudeId) chargerLignesTCE(etudeId);
  }, [etudeId, chargerLignesTCE]);

  const confirmer = () => {
    // Construire des lignes DPGF groupées par catégorie
    const lots = new Map<string, LigneForm[]>();
    lignesTCE.forEach((l, idx) => {
      const lotCode = l.code ?? l.categorie ?? `L${idx + 1}`;
      if (!lots.has(lotCode)) {
        lots.set(lotCode, [
          {
            ordre: 0,
            type_ligne: "lot",
            lot_code: lotCode,
            lot_intitule: l.designation.length < 50 ? l.designation : lotCode,
            numero: "",
            designation: l.designation.length < 50 ? l.designation : lotCode,
            unite: "",
            quantite: "",
            prix_unitaire_ht: "",
          },
        ]);
      }
    });

    const nouvellesLignes: LigneForm[] = [];
    let ordre = 0;

    lignesTCE.forEach((l, idx) => {
      const lotCode = l.code ?? l.categorie ?? `L${idx + 1}`;
      const entete = lots.get(lotCode);
      if (entete && entete.length === 1) {
        entete[0].ordre = ordre++;
        nouvellesLignes.push(entete[0]);
      }
      // Ligne article avec montant forfaitaire
      nouvellesLignes.push({
        ordre: ordre++,
        type_ligne: "article",
        lot_code: lotCode,
        lot_intitule: entete?.[0]?.lot_intitule ?? lotCode,
        numero: `${lotCode}.1`,
        designation: l.designation,
        unite: "ens",
        quantite: "1",
        prix_unitaire_ht: l.montant_ht > 0 ? l.montant_ht.toFixed(2) : "",
      });
    });

    onImporter(nouvellesLignes);
    onFermer();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div
        className="w-full max-w-2xl rounded-2xl flex flex-col max-h-[80vh]"
        style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}
      >
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--bordure)" }}>
          <div className="flex items-center gap-2">
            <BarChart2 size={16} style={{ color: "var(--c-base)" }} />
            <h3 className="font-semibold text-sm" style={{ color: "var(--texte)" }}>
              Importer depuis une estimation TCE
            </h3>
          </div>
          <button type="button" onClick={onFermer} style={{ color: "var(--texte-3)" }}>
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-3" style={{ borderBottom: "1px solid var(--bordure)" }}>
          <label className="text-xs font-medium mb-1 block" style={{ color: "var(--texte-3)" }}>
            Étude économique source
          </label>
          <select
            value={etudeId}
            onChange={(e) => setEtudeId(e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm"
            style={cs}
          >
            {etudes.length === 0 && <option value="">Aucune étude disponible</option>}
            {etudes.map((e) => (
              <option key={e.id} value={e.id}>
                {e.intitule} — {new Date(e.date_creation).toLocaleDateString("fr-FR")}
                {e.total_prix_vente ? ` (${Number(e.total_prix_vente).toLocaleString("fr-FR")} €)` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 overflow-y-auto">
          {chargement && (
            <div className="px-5 py-6 text-sm text-center" style={{ color: "var(--texte-3)" }}>
              Chargement des lignes…
            </div>
          )}
          {!chargement && lignesTCE.length === 0 && (
            <div className="px-5 py-6 text-sm text-center" style={{ color: "var(--texte-3)" }}>
              Aucune ligne trouvée dans cette étude.
            </div>
          )}
          {!chargement && lignesTCE.map((l, i) => (
            <div
              key={i}
              className="flex items-center gap-3 px-5 py-2.5"
              style={{ borderBottom: "1px solid var(--bordure)" }}
            >
              <span
                className="text-xs font-mono font-bold px-1.5 py-0.5 rounded"
                style={{ background: "var(--fond-entree)", color: "var(--texte-3)" }}
              >
                {l.code ?? l.categorie}
              </span>
              <span className="flex-1 text-sm truncate" style={{ color: "var(--texte)" }}>{l.designation}</span>
              <span className="font-mono text-sm font-semibold shrink-0" style={{ color: "var(--c-base)" }}>
                {formatMontant(l.montant_ht)}
              </span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: "1px solid var(--bordure)" }}>
          <p className="text-xs" style={{ color: "var(--texte-3)" }}>
            {lignesTCE.length > 0 ? `${lignesTCE.length} poste(s) seront importés comme lots` : ""}
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={onFermer} className="px-4 py-2 rounded-lg text-sm border"
              style={{ borderColor: "var(--bordure)", color: "var(--texte-2)" }}>
              Annuler
            </button>
            <button
              type="button"
              disabled={lignesTCE.length === 0}
              onClick={confirmer}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-40"
              style={{ background: "var(--c-base)" }}
            >
              Importer {lignesTCE.length > 0 ? `(${lignesTCE.length})` : ""}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function PageEditeurDPGF({
  params,
}: {
  params: Promise<{ id: string; piece_id: string }>;
}) {
  const { id: projetId, piece_id: pieceId } = use(params);
  const router = useRouter();
  const qc = useQueryClient();

  const [lotsReduits, setLotsReduits] = useState<Record<string, boolean>>({});
  const [lignesLocales, setLignesLocales] = useState<LigneForm[] | null>(null);
  const [enregistrementEnCours, setEnregistrementEnCours] = useState(false);
  const [lotSaisieCode, setLotSaisieCode] = useState("");
  const [lotSaisieIntitule, setLotSaisieIntitule] = useState("");
  const [modaleAjoutLot, setModaleAjoutLot] = useState(false);
  const [modaleBibliotheque, setModaleBibliotheque] = useState<{ lotCode: string } | null>(null);
  const [modaleImportTCE, setModaleImportTCE] = useState(false);
  const lotInputRef = useRef<HTMLInputElement>(null);

  // ─── Données API ─────────────────────────────────────────────────────────────

  const { data: piece } = useQuery<PieceEcrite>({
    queryKey: ["piece-ecrite", pieceId],
    queryFn: () => api.get(`/api/pieces-ecrites/${pieceId}/`),
  });

  const { data: lignesAPI, isLoading } = useQuery<LigneDPGF[]>({
    queryKey: ["lignes-dpgf", pieceId],
    queryFn: async () => {
      const r = await api.get<{ results?: LigneDPGF[] } | LigneDPGF[]>(
        `/api/pieces-ecrites/${pieceId}/lignes-dpgf/`
      );
      return Array.isArray(r) ? r : (r.results ?? []);
    },
  });

  useEffect(() => {
    if (lignesAPI && lignesLocales === null) {
      setLignesLocales(
        lignesAPI.map((l: LigneDPGF) => ({
          id: l.id,
          ordre: l.ordre,
          type_ligne: l.type_ligne,
          lot_code: l.lot_code,
          lot_intitule: l.lot_intitule,
          numero: l.numero,
          designation: l.designation,
          unite: l.unite,
          quantite: l.quantite ?? "",
          prix_unitaire_ht: l.prix_unitaire_ht ?? "",
        }))
      );
    }
  }, [lignesAPI, lignesLocales]);

  const lignes: LigneForm[] = lignesLocales ?? [];

  // ─── Lots uniques ─────────────────────────────────────────────────────────────

  const lots = Array.from(
    new Map(
      lignes
        .filter((l) => l.type_ligne === "lot")
        .map((l) => [l.lot_code, { code: l.lot_code, intitule: l.lot_intitule }])
    ).values()
  );

  // ─── Enregistrement en lot ───────────────────────────────────────────────────

  const enregistrerTout = async () => {
    if (!lignes.length) return;
    setEnregistrementEnCours(true);
    try {
      for (const [i, ligne] of lignes.entries()) {
        const payload = {
          ordre: i,
          type_ligne: ligne.type_ligne,
          lot_code: ligne.lot_code,
          lot_intitule: ligne.lot_intitule,
          numero: ligne.numero,
          designation: ligne.designation,
          unite: ligne.unite,
          quantite: ligne.quantite !== "" ? parseFloat(ligne.quantite) : null,
          prix_unitaire_ht: ligne.prix_unitaire_ht !== "" ? parseFloat(ligne.prix_unitaire_ht) : null,
        };
        if (ligne.id) {
          await api.put(`/api/pieces-ecrites/${pieceId}/lignes-dpgf/${ligne.id}/`, payload);
        } else {
          const cree = await api.post<LigneDPGF>(
            `/api/pieces-ecrites/${pieceId}/lignes-dpgf/`,
            payload
          );
          ligne.id = cree.id;
        }
      }
      await qc.invalidateQueries({ queryKey: ["lignes-dpgf", pieceId] });
    } finally {
      setEnregistrementEnCours(false);
    }
  };

  // ─── Actions locales ──────────────────────────────────────────────────────────

  const majLigne = (idx: number, champ: keyof LigneForm, val: string) => {
    setLignesLocales((prev) => {
      if (!prev) return prev;
      const n = [...prev];
      n[idx] = { ...n[idx], [champ]: val };
      return n;
    });
  };

  const ajouterLot = () => {
    if (!lotSaisieCode.trim()) return;
    const nouvelOrdre = lignes.length;
    setLignesLocales((prev) => [
      ...(prev ?? []),
      {
        ordre: nouvelOrdre,
        type_ligne: "lot",
        lot_code: lotSaisieCode.trim().toUpperCase(),
        lot_intitule: lotSaisieIntitule.trim(),
        numero: "",
        designation: lotSaisieIntitule.trim() || lotSaisieCode.trim().toUpperCase(),
        unite: "",
        quantite: "",
        prix_unitaire_ht: "",
      },
    ]);
    setLotSaisieCode("");
    setLotSaisieIntitule("");
    setModaleAjoutLot(false);
  };

  const ajouterArticle = (lotCode: string, valeurs?: Partial<LigneForm>) => {
    const lotLignes = lignes.filter((l) => l.lot_code === lotCode);
    const nbArticles = lotLignes.filter((l) => l.type_ligne === "article").length;
    const nouveauNumero = `${lotCode}.${nbArticles + 1}`;
    const dernierIdx = lignes.reduce(
      (max, l, i) => (l.lot_code === lotCode ? i : max),
      -1
    );
    const insertIdx = dernierIdx === -1 ? lignes.length : dernierIdx + 1;
    const lotEntete = lotLignes.find((l) => l.type_ligne === "lot");
    setLignesLocales((prev) => {
      if (!prev) return prev;
      const n = [...prev];
      n.splice(insertIdx, 0, {
        ordre: insertIdx,
        type_ligne: "article",
        lot_code: lotCode,
        lot_intitule: lotEntete?.lot_intitule ?? "",
        numero: nouveauNumero,
        designation: valeurs?.designation ?? "",
        unite: valeurs?.unite ?? "ens",
        quantite: valeurs?.quantite ?? "1",
        prix_unitaire_ht: valeurs?.prix_unitaire_ht ?? "",
      });
      return n.map((l, i) => ({ ...l, ordre: i }));
    });
  };

  const supprimerLigneLocale = async (idx: number) => {
    const ligne = lignes[idx];
    if (ligne.id) {
      await api.supprimer(`/api/pieces-ecrites/${pieceId}/lignes-dpgf/${ligne.id}/`);
    }
    setLignesLocales((prev) => {
      if (!prev) return prev;
      return prev.filter((_, i) => i !== idx).map((l, i) => ({ ...l, ordre: i }));
    });
  };

  const toggleLot = (code: string) =>
    setLotsReduits((prev) => ({ ...prev, [code]: !prev[code] }));

  const importerTCE = (nouvellesLignes: LigneForm[]) => {
    setLignesLocales((prev) => {
      const base = prev ?? [];
      const depart = base.length;
      return [...base, ...nouvellesLignes.map((l, i) => ({ ...l, ordre: depart + i }))];
    });
  };

  const exporter = () => {
    window.open(`/api/pieces-ecrites/${pieceId}/exporter-dpgf/`, "_blank");
  };

  // ─── Rendu ───────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48" style={{ color: "var(--texte-3)" }}>
        Chargement…
      </div>
    );
  }

  const typePiece = piece?.modele?.type_document?.toUpperCase() ?? "DPGF";
  const totalHT = totalGeneral(lignes);

  return (
    <div className="space-y-4 max-w-5xl">
      {/* Modales */}
      {modaleBibliotheque && (
        <ModaleBibliotheque
          onInserer={(valeurs) => ajouterArticle(modaleBibliotheque.lotCode, valeurs)}
          onFermer={() => setModaleBibliotheque(null)}
        />
      )}
      {modaleImportTCE && (
        <ModaleImportTCE
          projetId={projetId}
          onImporter={importerTCE}
          onFermer={() => setModaleImportTCE(false)}
        />
      )}

      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="p-2 rounded-lg"
            style={{ background: "var(--fond-entree)", color: "var(--texte-2)" }}
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h2 style={{ color: "var(--texte)" }}>{typePiece} — {piece?.intitule}</h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--texte-3)" }}>
              Éditeur de décomposition de prix — saisie ligne par ligne
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={exporter}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm border"
            style={{ borderColor: "var(--bordure)", color: "var(--texte-2)" }}
          >
            <Download size={14} /> Export XLSX
          </button>
          <button
            type="button"
            onClick={enregistrerTout}
            disabled={enregistrementEnCours}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-60"
            style={{ background: "var(--c-base)" }}
          >
            <Save size={14} /> {enregistrementEnCours ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </div>

      {/* Barre de totaux */}
      <div
        className="rounded-xl px-5 py-3 flex items-center justify-between"
        style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}
      >
        <div className="flex gap-6 flex-wrap">
          {lots.map((lot) => (
            <div key={lot.code} className="text-sm">
              <span style={{ color: "var(--texte-3)" }}>{lot.code} </span>
              <span className="font-mono font-semibold" style={{ color: "var(--texte)" }}>
                {formatMontant(totalLot(lignes, lot.code))}
              </span>
            </div>
          ))}
        </div>
        <div className="text-right">
          <div className="text-xs mb-0.5" style={{ color: "var(--texte-3)" }}>Total HT</div>
          <div className="text-lg font-bold font-mono" style={{ color: "var(--c-base)" }}>
            {formatMontant(totalHT)}
          </div>
        </div>
      </div>

      {/* Actions lots */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => { setModaleAjoutLot(true); setTimeout(() => lotInputRef.current?.focus(), 100); }}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium"
          style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)", color: "var(--texte-2)" }}
        >
          <FolderPlus size={13} /> Ajouter un lot
        </button>
        <button
          type="button"
          onClick={() => setModaleImportTCE(true)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium"
          style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)", color: "var(--texte-2)" }}
        >
          <BarChart2 size={13} /> Importer TCE
        </button>
      </div>

      {/* Modale ajout lot */}
      {modaleAjoutLot && (
        <div
          className="rounded-xl p-4 space-y-3"
          style={{ background: "var(--fond-carte)", border: "1px solid var(--c-base)" }}
        >
          <h4 className="text-sm font-semibold" style={{ color: "var(--texte)" }}>Nouveau lot</h4>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs mb-1 block" style={{ color: "var(--texte-3)" }}>Code lot *</label>
              <input
                ref={lotInputRef}
                type="text"
                value={lotSaisieCode}
                onChange={(e) => setLotSaisieCode(e.target.value)}
                placeholder="01"
                className="w-full rounded-lg px-3 py-2 text-sm font-mono uppercase"
                style={cs}
                onKeyDown={(e) => e.key === "Enter" && ajouterLot()}
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs mb-1 block" style={{ color: "var(--texte-3)" }}>Intitulé du lot</label>
              <input
                type="text"
                value={lotSaisieIntitule}
                onChange={(e) => setLotSaisieIntitule(e.target.value)}
                placeholder="Gros Œuvre"
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={cs}
                onKeyDown={(e) => e.key === "Enter" && ajouterLot()}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={ajouterLot}
              disabled={!lotSaisieCode.trim()}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40"
              style={{ background: "var(--c-base)" }}
            >
              Créer le lot
            </button>
            <button
              type="button"
              onClick={() => setModaleAjoutLot(false)}
              className="px-4 py-2 rounded-lg text-sm border"
              style={{ borderColor: "var(--bordure)", color: "var(--texte-2)" }}
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Vide */}
      {lots.length === 0 && lignes.length === 0 && (
        <div
          className="rounded-xl p-10 flex flex-col items-center gap-3"
          style={{ background: "var(--fond-carte)", border: "1px dashed var(--bordure)" }}
        >
          <FileText size={32} style={{ color: "var(--texte-3)" }} />
          <p className="text-sm" style={{ color: "var(--texte-3)" }}>
            Aucune ligne. Ajoutez un lot ou importez depuis une estimation TCE.
          </p>
        </div>
      )}

      {/* Tableau par lot */}
      {lots.map((lot) => {
        const reduit = lotsReduits[lot.code] ?? false;
        const lignesLot = lignes.filter(
          (l) => l.lot_code === lot.code && l.type_ligne === "article"
        );
        const totalLotHT = totalLot(lignes, lot.code);

        return (
          <div
            key={lot.code}
            className="rounded-xl overflow-hidden"
            style={{ border: "1px solid var(--bordure)" }}
          >
            {/* En-tête lot */}
            <div
              className="flex items-center justify-between px-4 py-3 cursor-pointer"
              style={{ background: "var(--fond-carte)" }}
              onClick={() => toggleLot(lot.code)}
            >
              <div className="flex items-center gap-3">
                {reduit ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                <span className="font-mono font-bold text-sm" style={{ color: "var(--c-base)" }}>
                  {lot.code}
                </span>
                <span className="font-semibold text-sm" style={{ color: "var(--texte)" }}>
                  {lot.intitule}
                </span>
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-mono"
                  style={{ background: "var(--fond-entree)", color: "var(--texte-3)" }}
                >
                  {lignesLot.length} ligne{lignesLot.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-sm" style={{ color: "var(--texte)" }}>
                  {formatMontant(totalLotHT)}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setModaleBibliotheque({ lotCode: lot.code });
                  }}
                  className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg"
                  style={{ background: "var(--fond-entree)", color: "var(--texte-3)" }}
                  title="Rechercher dans la bibliothèque"
                >
                  <BookOpen size={11} /> Biblio
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    ajouterArticle(lot.code);
                    if (reduit) toggleLot(lot.code);
                  }}
                  className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg"
                  style={{ background: "var(--fond-entree)", color: "var(--c-base)" }}
                >
                  <Plus size={11} /> Ligne
                </button>
              </div>
            </div>

            {/* Corps */}
            {!reduit && (
              <div style={{ background: "var(--fond-app)" }}>
                {/* En-têtes colonnes */}
                <div
                  className="grid text-xs font-medium px-4 py-2"
                  style={{
                    gridTemplateColumns: "80px 1fr 70px 90px 110px 110px 36px",
                    color: "var(--texte-3)",
                    borderBottom: "1px solid var(--bordure)",
                    background: "var(--fond-carte)",
                  }}
                >
                  <span>N°</span>
                  <span>Désignation</span>
                  <span className="text-right">Unité</span>
                  <span className="text-right">Quantité</span>
                  <span className="text-right">PU HT (€)</span>
                  <span className="text-right">Montant HT</span>
                  <span />
                </div>

                {/* Lignes articles */}
                {lignesLot.map((ligne) => {
                  const idxGlobal = lignes.indexOf(ligne);
                  const montant = montantLocal(ligne.quantite, ligne.prix_unitaire_ht);
                  return (
                    <div
                      key={idxGlobal}
                      className="grid items-center px-4 py-1.5 gap-2"
                      style={{
                        gridTemplateColumns: "80px 1fr 70px 90px 110px 110px 36px",
                        borderBottom: "1px solid var(--bordure)",
                      }}
                    >
                      <input
                        type="text"
                        value={ligne.numero}
                        onChange={(e) => majLigne(idxGlobal, "numero", e.target.value)}
                        className="rounded px-2 py-1 text-xs font-mono"
                        style={cs}
                      />
                      <input
                        type="text"
                        value={ligne.designation}
                        onChange={(e) => majLigne(idxGlobal, "designation", e.target.value)}
                        placeholder="Désignation"
                        className="rounded px-2 py-1 text-xs"
                        style={cs}
                      />
                      <input
                        type="text"
                        value={ligne.unite}
                        onChange={(e) => majLigne(idxGlobal, "unite", e.target.value)}
                        className="rounded px-2 py-1 text-xs text-right"
                        style={cs}
                      />
                      <input
                        type="number"
                        value={ligne.quantite}
                        onChange={(e) => majLigne(idxGlobal, "quantite", e.target.value)}
                        min="0"
                        step="any"
                        className="rounded px-2 py-1 text-xs text-right font-mono"
                        style={cs}
                      />
                      <input
                        type="number"
                        value={ligne.prix_unitaire_ht}
                        onChange={(e) => majLigne(idxGlobal, "prix_unitaire_ht", e.target.value)}
                        min="0"
                        step="any"
                        className="rounded px-2 py-1 text-xs text-right font-mono"
                        style={cs}
                      />
                      <div
                        className="text-xs text-right font-mono font-semibold pr-1"
                        style={{ color: montant !== null ? "var(--texte)" : "var(--texte-3)" }}
                      >
                        {formatMontant(montant)}
                      </div>
                      <button
                        type="button"
                        onClick={() => supprimerLigneLocale(idxGlobal)}
                        className="flex items-center justify-center w-7 h-7 rounded"
                        style={{ color: "#ef4444" }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  );
                })}

                {/* Pied de lot */}
                <div
                  className="grid px-4 py-2"
                  style={{
                    gridTemplateColumns: "80px 1fr 70px 90px 110px 110px 36px",
                    background: "var(--fond-carte)",
                  }}
                >
                  <div
                    className="col-span-5 text-xs font-semibold text-right pr-2"
                    style={{ color: "var(--texte-3)" }}
                  >
                    Total {lot.code} HT
                  </div>
                  <div
                    className="text-sm font-bold font-mono text-right"
                    style={{ color: "var(--c-base)" }}
                  >
                    {formatMontant(totalLotHT)}
                  </div>
                  <div />
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Total général */}
      {lots.length > 0 && (
        <div
          className="rounded-xl px-5 py-4 flex items-center justify-between"
          style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}
        >
          <span className="font-bold text-sm" style={{ color: "var(--texte)" }}>TOTAL GÉNÉRAL HT</span>
          <span className="text-xl font-bold font-mono" style={{ color: "var(--c-base)" }}>
            {formatMontant(totalHT)}
          </span>
        </div>
      )}
    </div>
  );
}
