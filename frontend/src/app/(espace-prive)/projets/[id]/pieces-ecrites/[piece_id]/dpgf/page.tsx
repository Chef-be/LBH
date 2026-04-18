"use client";

import { use, useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Plus, Trash2, ChevronDown, ChevronRight,
  Download, GripVertical, FolderPlus, FileText, Save
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

// ─── Composant ────────────────────────────────────────────────────────────────

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
  const lotInputRef = useRef<HTMLInputElement>(null);

  // ─── Données API ────────────────────────────────────────────────────────────

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

  // ─── Lots uniques ───────────────────────────────────────────────────────────

  const lots = Array.from(
    new Map(
      lignes
        .filter((l) => l.type_ligne === "lot")
        .map((l) => [l.lot_code, { code: l.lot_code, intitule: l.lot_intitule }])
    ).values()
  );

  // ─── Mutations ──────────────────────────────────────────────────────────────

  const creerLigne = useMutation({
    mutationFn: (data: Partial<LigneForm>) =>
      api.post<LigneDPGF>(`/api/pieces-ecrites/${pieceId}/lignes-dpgf/`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lignes-dpgf", pieceId] }),
  });

  const supprimerLigne = useMutation({
    mutationFn: (ligneId: string) =>
      api.supprimer(`/api/pieces-ecrites/${pieceId}/lignes-dpgf/${ligneId}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lignes-dpgf", pieceId] }),
  });

  // ─── Enregistrement en lot ──────────────────────────────────────────────────

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

  // ─── Actions locales ────────────────────────────────────────────────────────

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

  const ajouterArticle = (lotCode: string) => {
    const lotLignes = lignes.filter((l) => l.lot_code === lotCode);
    const nbArticles = lotLignes.filter((l) => l.type_ligne === "article").length;
    const nouveauNumero = `${lotCode}.${nbArticles + 1}`;
    // Insérer après la dernière ligne du lot
    const dernierIdx = lignes.reduce(
      (max, l, i) => (l.lot_code === lotCode ? i : max),
      -1
    );
    const insertIdx = dernierIdx === -1 ? lignes.length : dernierIdx + 1;
    setLignesLocales((prev) => {
      if (!prev) return prev;
      const n = [...prev];
      n.splice(insertIdx, 0, {
        ordre: insertIdx,
        type_ligne: "article",
        lot_code: lotCode,
        lot_intitule: lotLignes[0]?.lot_intitule ?? "",
        numero: nouveauNumero,
        designation: "",
        unite: "ens",
        quantite: "1",
        prix_unitaire_ht: "",
      });
      return n.map((l, i) => ({ ...l, ordre: i }));
    });
  };

  const supprimerLigneLocale = async (idx: number) => {
    const ligne = lignes[idx];
    if (ligne.id) {
      await supprimerLigne.mutateAsync(ligne.id);
    }
    setLignesLocales((prev) => {
      if (!prev) return prev;
      return prev.filter((_, i) => i !== idx).map((l, i) => ({ ...l, ordre: i }));
    });
  };

  const toggleLot = (code: string) =>
    setLotsReduits((prev) => ({ ...prev, [code]: !prev[code] }));

  // ─── Export ─────────────────────────────────────────────────────────────────

  const exporter = () => {
    window.open(`/api/pieces-ecrites/${pieceId}/exporter-dpgf/`, "_blank");
  };

  // ─── Rendu ──────────────────────────────────────────────────────────────────

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
        <div className="flex gap-6">
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
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => { setModaleAjoutLot(true); setTimeout(() => lotInputRef.current?.focus(), 100); }}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium"
          style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)", color: "var(--texte-2)" }}
        >
          <FolderPlus size={13} /> Ajouter un lot
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

      {/* Tableau par lot */}
      {lots.length === 0 && lignes.length === 0 && (
        <div
          className="rounded-xl p-10 flex flex-col items-center gap-3"
          style={{ background: "var(--fond-carte)", border: "1px dashed var(--bordure)" }}
        >
          <FileText size={32} style={{ color: "var(--texte-3)" }} />
          <p className="text-sm" style={{ color: "var(--texte-3)" }}>
            Aucune ligne. Commencez par ajouter un lot.
          </p>
        </div>
      )}

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
              <div className="flex items-center gap-3">
                <span className="font-mono font-bold text-sm" style={{ color: "var(--texte)" }}>
                  {formatMontant(totalLotHT)}
                </span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); ajouterArticle(lot.code); if (reduit) toggleLot(lot.code); }}
                  className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg"
                  style={{ background: "var(--fond-entree)", color: "var(--c-base)" }}
                >
                  <Plus size={11} /> Ligne
                </button>
              </div>
            </div>

            {/* Corps du lot */}
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
                        placeholder="Désignation de l'ouvrage"
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
