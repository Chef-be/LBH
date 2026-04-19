"use client";

import { useState, useEffect, use, useCallback, useRef } from "react";
import Link from "next/link";
import { api, ErreurApi, requeteApiAvecProgression } from "@/crochets/useApi";
import {
  ArrowLeft, Plus, Pencil, Trash2, CheckCircle,
  AlertCircle, X, Save, ChevronRight, Calculator,
  Ruler, MousePointer, Square, Minus as LineIcon, Hash, ScanLine, Upload, CheckSquare,
} from "lucide-react";

interface LigneMetre {
  id: string;
  metre: string;
  numero_ordre: number;
  code_article: string;
  designation: string;
  nature: string;
  nature_libelle: string;
  quantite: number | null;
  unite: string;
  detail_calcul: string;
  prix_unitaire_ht: number | null;
  montant_ht: number | null;
  observations: string;
  quantite_calculee?: number | null;
  apercu_calcul?: ApercuCalcul | null;
}

interface ApercuCalcul {
  detail_normalise: string;
  quantite_calculee: number;
  etapes: Array<{
    type: "variable" | "ligne";
    libelle: string;
    expression: string;
    valeur: number;
  }>;
  variables: Record<string, number>;
}

interface MetreDetail {
  id: string;
  projet: string;
  projet_reference: string;
  intitule: string;
  type_metre: string;
  type_libelle: string;
  statut: string;
  statut_libelle: string;
  montant_total_ht: number;
  lignes: LigneMetre[];
  date_modification: string;
}

const NATURES = [
  { val: "travaux", lib: "Travaux" },
  { val: "fourniture", lib: "Fourniture" },
  { val: "prestation", lib: "Prestation" },
  { val: "installation_chantier", lib: "Installation de chantier" },
  { val: "provision", lib: "Provision / réserve" },
];

const VIDE_LIGNE = {
  numero_ordre: "",
  code_article: "",
  designation: "",
  nature: "travaux",
  quantite: "",
  unite: "u",
  detail_calcul: "",
  prix_unitaire_ht: "",
  observations: "",
};

function formatMontant(val: number | null, suffix = " €"): string {
  if (val === null || val === undefined) return "—";
  return Number(val).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + suffix;
}

interface FormLigneProps {
  initial: Partial<typeof VIDE_LIGNE>;
  metreId: string;
  onSuccess: () => void;
  onClose: () => void;
  ligneId?: string;
  numeroOrdreInitial: number;
}

function FormLigne({ initial, metreId, onSuccess, onClose, ligneId, numeroOrdreInitial }: FormLigneProps) {
  const [form, setForm] = useState({ ...VIDE_LIGNE, numero_ordre: String(numeroOrdreInitial), ...initial });
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [apercuCalcul, setApercuCalcul] = useState<ApercuCalcul | null>(null);
  const [chargementCalcul, setChargementCalcul] = useState(false);

  const maj = (k: keyof typeof VIDE_LIGNE, v: string) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!form.detail_calcul.trim()) {
      setApercuCalcul(null);
      return;
    }

    const temporisateur = window.setTimeout(async () => {
      try {
        setChargementCalcul(true);
        const reponse = await api.post<ApercuCalcul>("/api/metres/apercu-calcul/", {
          detail_calcul: form.detail_calcul,
        });
        setApercuCalcul(reponse);
      } catch {
        setApercuCalcul(null);
      } finally {
        setChargementCalcul(false);
      }
    }, 300);

    return () => window.clearTimeout(temporisateur);
  }, [form.detail_calcul]);

  const soumettre = async () => {
    if (!form.designation.trim()) { setErreur("La désignation est requise."); return; }
    if (!form.numero_ordre.trim()) { setErreur("Le numéro d'ordre est requis."); return; }
    setChargement(true);
    setErreur(null);
    try {
      const payload = {
        metre: metreId,
        numero_ordre: Number(form.numero_ordre),
        code_article: form.code_article,
        designation: form.designation,
        nature: form.nature,
        quantite: form.quantite === "" ? null : Number(form.quantite),
        unite: form.unite,
        detail_calcul: form.detail_calcul,
        prix_unitaire_ht: form.prix_unitaire_ht === "" ? null : Number(form.prix_unitaire_ht),
        observations: form.observations,
      };
      if (ligneId) {
        await api.patch(`/api/metres/${metreId}/lignes/${ligneId}/`, payload);
      } else {
        await api.post(`/api/metres/${metreId}/lignes/`, payload);
      }
      onSuccess();
      onClose();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Erreur lors de l'enregistrement.");
    } finally {
      setChargement(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-800">{ligneId ? "Modifier la ligne" : "Nouvelle ligne"}</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>

        <div className="p-6 space-y-4">
          {erreur && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />{erreur}
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="libelle-champ">N° d&apos;ordre</label>
              <input type="number" min="1" className="champ-saisie w-full text-right"
                value={form.numero_ordre} onChange={e => maj("numero_ordre", e.target.value)} />
            </div>
            <div>
              <label className="libelle-champ">Code article</label>
              <input type="text" className="champ-saisie w-full" placeholder="VRD-001"
                value={form.code_article} onChange={e => maj("code_article", e.target.value)} />
            </div>
            <div>
              <label className="libelle-champ">Nature</label>
              <select className="champ-saisie w-full bg-white" value={form.nature}
                onChange={e => maj("nature", e.target.value)}>
                {NATURES.map(n => <option key={n.val} value={n.val}>{n.lib}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="libelle-champ">Désignation <span className="text-red-500">*</span></label>
            <input type="text" className="champ-saisie w-full"
              placeholder="Terrassements généraux en déblai — tout venant"
              value={form.designation} onChange={e => maj("designation", e.target.value)} />
          </div>

          <div>
            <label className="libelle-champ">Détail de calcul</label>
            <textarea className="champ-saisie min-h-28 w-full font-mono text-sm"
              placeholder={"L = 5,00\nl = 3,00\nL × l × 2"}
              value={form.detail_calcul} onChange={e => maj("detail_calcul", e.target.value)} />
            <p className="mt-1 text-xs text-slate-400">
              Variables, parenthèses et plusieurs lignes sont acceptées. Chaque ligne de calcul s&apos;additionne.
            </p>
            {chargementCalcul && (
              <p className="mt-2 text-xs text-slate-500">Calcul du métré en cours…</p>
            )}
            {apercuCalcul && (
              <div className="mt-3 rounded-2xl border border-blue-200 bg-blue-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-blue-900">Quantité calculée</p>
                    <p className="text-2xl font-semibold text-blue-900">
                      {apercuCalcul.quantite_calculee.toLocaleString("fr-FR", {
                        minimumFractionDigits: 3,
                        maximumFractionDigits: 3,
                      })}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => maj("quantite", String(apercuCalcul.quantite_calculee))}
                    className="btn-secondaire text-sm"
                  >
                    Reprendre ce résultat
                  </button>
                </div>
                <div className="mt-3 grid gap-2 text-xs text-blue-950">
                  {apercuCalcul.etapes.map((etape, index) => (
                    <div key={`${etape.libelle}-${index}`} className="rounded-xl border border-blue-100 bg-white px-3 py-2">
                      <p className="font-medium">{etape.libelle}</p>
                      <p className="font-mono">{etape.expression}</p>
                      <p className="mt-1 text-blue-700">= {etape.valeur.toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="libelle-champ">Quantité</label>
              <input type="number" step="0.001" className="champ-saisie w-full text-right"
                value={form.quantite} onChange={e => maj("quantite", e.target.value)} />
            </div>
            <div>
              <label className="libelle-champ">Unité</label>
              <input type="text" className="champ-saisie w-full" placeholder="m²"
                value={form.unite} onChange={e => maj("unite", e.target.value)} maxLength={20} />
            </div>
            <div>
              <label className="libelle-champ">PU HT (€)</label>
              <input type="number" step="0.01" className="champ-saisie w-full text-right"
                value={form.prix_unitaire_ht} onChange={e => maj("prix_unitaire_ht", e.target.value)} />
            </div>
          </div>

          <div>
            <label className="libelle-champ">Observations</label>
            <input type="text" className="champ-saisie w-full"
              value={form.observations} onChange={e => maj("observations", e.target.value)} />
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
          <button onClick={onClose} className="btn-secondaire">Annuler</button>
          <button onClick={soumettre} disabled={chargement} className="btn-primaire disabled:opacity-60">
            {chargement ? "Enregistrement…" : <><Save className="w-4 h-4" />Enregistrer</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Types Métré visuel
// ---------------------------------------------------------------------------

type OutilCanvas = "selection" | "surface" | "longueur" | "comptage" | "calibrer";

interface PointCanvas {
  x: number;
  y: number;
}

interface ZoneVisualisee {
  id: string;
  type: "surface" | "longueur" | "comptage";
  designation: string;
  unite: string;
  points: PointCanvas[];
  valeur: number;
  deductions: Array<{ designation: string; valeur: number }>;
  couleur: string;
}

const COULEURS_ZONES = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1",
];

function calculerSurface(points: PointCanvas[]): number {
  if (points.length < 3) return 0;
  let aire = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    aire += points[i].x * points[j].y;
    aire -= points[j].x * points[i].y;
  }
  return Math.abs(aire / 2);
}

function calculerLongueur(points: PointCanvas[]): number {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    total += Math.sqrt(dx * dx + dy * dy);
  }
  return total;
}

// ---------------------------------------------------------------------------
// Composant Métré visuel
// ---------------------------------------------------------------------------

function MetreVisuel({ metreId, onLignesCreees }: { metreId: string; onLignesCreees: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fondPlan, setFondPlan] = useState<HTMLImageElement | null>(null);
  const [chargementFond, setChargementFond] = useState(false);
  const [erreurFond, setErreurFond] = useState<string | null>(null);
  const [outil, setOutil] = useState<OutilCanvas>("selection");
  const [zoom, setZoom] = useState(1);
  const [offset, setOffsetCanvas] = useState<PointCanvas>({ x: 0, y: 0 });
  const [pointsEnCours, setPointsEnCours] = useState<PointCanvas[]>([]);
  const [zones, setZones] = useState<ZoneVisualisee[]>([]);
  const [zoneSelectionnee, setZoneSelectionnee] = useState<string | null>(null);
  const [echellePixelParMetre, setEchellePixelParMetre] = useState(50); // défaut : 50px = 1m
  const [calibrationPoints, setCalibrationPoints] = useState<PointCanvas[]>([]);
  const [longueurConnue, setLongueurConnue] = useState("");
  const [enregistrement, setEnregistrement] = useState(false);
  const [succes, setSucces] = useState<string | null>(null);
  const isDragging = useRef(false);
  const lastMouse = useRef<PointCanvas>({ x: 0, y: 0 });

  const dessiner = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(offset.x, offset.y);
    ctx.scale(zoom, zoom);

    // Fond de plan
    if (fondPlan) {
      ctx.drawImage(fondPlan, 0, 0);
    } else {
      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(0, 0, canvas.width / zoom, canvas.height / zoom);
      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 1 / zoom;
      for (let x = 0; x < canvas.width / zoom; x += 50) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height / zoom);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height / zoom; y += 50) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width / zoom, y);
        ctx.stroke();
      }
    }

    // Zones existantes
    zones.forEach((zone) => {
      if (zone.points.length === 0) return;
      const estSelectionnee = zone.id === zoneSelectionnee;
      ctx.globalAlpha = estSelectionnee ? 0.8 : 0.5;
      ctx.fillStyle = zone.couleur;
      ctx.strokeStyle = zone.couleur;
      ctx.lineWidth = (estSelectionnee ? 2.5 : 1.5) / zoom;

      if (zone.type === "surface" && zone.points.length >= 3) {
        ctx.beginPath();
        ctx.moveTo(zone.points[0].x, zone.points[0].y);
        zone.points.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.stroke();
      } else if (zone.type === "longueur" && zone.points.length >= 2) {
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.moveTo(zone.points[0].x, zone.points[0].y);
        zone.points.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
        ctx.stroke();
      } else if (zone.type === "comptage") {
        zone.points.forEach((p) => {
          ctx.globalAlpha = 1;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 8 / zoom, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      // Libellé
      if (zone.points.length > 0) {
        const cx = zone.points.reduce((s, p) => s + p.x, 0) / zone.points.length;
        const cy = zone.points.reduce((s, p) => s + p.y, 0) / zone.points.length;
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#1e293b";
        ctx.font = `bold ${13 / zoom}px system-ui`;
        ctx.textAlign = "center";
        const valeurAffichee = zone.type === "comptage"
          ? `${zone.points.length} u`
          : `${(zone.valeur / echellePixelParMetre).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} ${zone.unite}`;
        ctx.fillText(zone.designation, cx, cy);
        ctx.font = `${11 / zoom}px system-ui`;
        ctx.fillStyle = zone.couleur;
        ctx.fillText(valeurAffichee, cx, cy + 14 / zoom);
      }
    });

    // Points en cours
    if (pointsEnCours.length > 0) {
      ctx.globalAlpha = 1;
      ctx.strokeStyle = "#0ea5e9";
      ctx.fillStyle = "#0ea5e9";
      ctx.lineWidth = 2 / zoom;
      ctx.setLineDash([5 / zoom, 3 / zoom]);
      ctx.beginPath();
      ctx.moveTo(pointsEnCours[0].x, pointsEnCours[0].y);
      pointsEnCours.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
      ctx.stroke();
      ctx.setLineDash([]);
      pointsEnCours.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4 / zoom, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    ctx.restore();
  }, [fondPlan, zones, zoneSelectionnee, pointsEnCours, offset, zoom, echellePixelParMetre]);

  useEffect(() => {
    dessiner();
  }, [dessiner]);

  const coordCanvas = (e: React.MouseEvent<HTMLCanvasElement>): PointCanvas => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left - offset.x) / zoom,
      y: (e.clientY - rect.top - offset.y) / zoom,
    };
  };

  const gererClic = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (outil === "selection") return;
    const pt = coordCanvas(e);

    if (outil === "calibrer") {
      setCalibrationPoints((prev) => {
        const next = [...prev, pt];
        if (next.length === 2 && longueurConnue) {
          const dx = next[1].x - next[0].x;
          const dy = next[1].y - next[0].y;
          const pixels = Math.sqrt(dx * dx + dy * dy);
          const metres = parseFloat(longueurConnue);
          if (metres > 0 && pixels > 0) {
            setEchellePixelParMetre(pixels / metres);
          }
          return [];
        }
        return next;
      });
      return;
    }

    setPointsEnCours((prev) => [...prev, pt]);
  };

  const gererDoubleClick = () => {
    if (pointsEnCours.length < 2) return;
    const typeZone: "surface" | "longueur" | "comptage" =
      outil === "surface" ? "surface" : outil === "longueur" ? "longueur" : "comptage";
    const valeurBrute = typeZone === "surface"
      ? calculerSurface(pointsEnCours)
      : typeZone === "longueur"
        ? calculerLongueur(pointsEnCours)
        : pointsEnCours.length;
    const valeurReelle = typeZone === "comptage"
      ? valeurBrute
      : valeurBrute / (echellePixelParMetre * echellePixelParMetre);

    const nouvelleZone: ZoneVisualisee = {
      id: `zone-${Date.now()}`,
      type: typeZone,
      designation: `Zone ${zones.length + 1}`,
      unite: typeZone === "surface" ? "m²" : typeZone === "longueur" ? "ml" : "u",
      points: [...pointsEnCours],
      valeur: valeurReelle,
      deductions: [],
      couleur: COULEURS_ZONES[zones.length % COULEURS_ZONES.length],
    };
    setZones((prev) => [...prev, nouvelleZone]);
    setPointsEnCours([]);
    setZoneSelectionnee(nouvelleZone.id);
  };

  const gererMolette = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const facteur = e.deltaY < 0 ? 1.1 : 0.9;
    setZoom((z) => Math.min(5, Math.max(0.2, z * facteur)));
  };

  const gererMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (outil === "selection") {
      isDragging.current = true;
      lastMouse.current = { x: e.clientX, y: e.clientY };
    }
  };

  const gererMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging.current && outil === "selection") {
      setOffsetCanvas((prev) => ({
        x: prev.x + (e.clientX - lastMouse.current.x),
        y: prev.y + (e.clientY - lastMouse.current.y),
      }));
      lastMouse.current = { x: e.clientX, y: e.clientY };
    }
  };

  const gererMouseUp = () => { isDragging.current = false; };

  const uploaderFond = async (fichier: File) => {
    setChargementFond(true);
    setErreurFond(null);
    try {
      const formData = new FormData();
      formData.append("fichier", fichier);
      formData.append("metre", metreId);
      const reponse = await requeteApiAvecProgression<{ url: string }>(
        `/api/metres/${metreId}/fonds-plan/`,
        { method: "POST", corps: formData }
      );
      const img = new Image();
      img.onload = () => setFondPlan(img);
      img.src = reponse.url;
    } catch (e) {
      setErreurFond(e instanceof ErreurApi ? e.detail : "Impossible de téléverser le fond de plan.");
    } finally {
      setChargementFond(false);
    }
  };

  const supprimerZone = (id: string) => {
    setZones((prev) => prev.filter((z) => z.id !== id));
    if (zoneSelectionnee === id) setZoneSelectionnee(null);
  };

  const modifierDesignationZone = (id: string, designation: string) => {
    setZones((prev) => prev.map((z) => z.id === id ? { ...z, designation } : z));
  };

  const validerEtCreerLignes = async () => {
    if (zones.length === 0) return;
    setEnregistrement(true);
    try {
      const lignesPayload = zones.map((zone) => {
        const valeurNette = zone.type === "comptage"
          ? zone.points.length
          : zone.valeur - zone.deductions.reduce((s, d) => s + d.valeur, 0);
        return {
          metre: metreId,
          designation: zone.designation,
          nature: zone.type === "surface" ? "travaux" : "travaux",
          quantite: Math.max(0, valeurNette),
          unite: zone.unite,
          detail_calcul: `Métré visuel — ${zone.type}`,
          numero_ordre: 0,
        };
      });
      for (const ligne of lignesPayload) {
        await api.post(`/api/metres/${metreId}/lignes/`, ligne);
      }
      setSucces(`${zones.length} ligne(s) créée(s) depuis le métré visuel.`);
      setTimeout(() => setSucces(null), 4000);
      onLignesCreees();
    } catch (e) {
      setErreurFond(e instanceof ErreurApi ? e.detail : "Erreur lors de la création des lignes.");
    } finally {
      setEnregistrement(false);
    }
  };

  return (
    <div className="space-y-4">
      {erreurFond && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm p-3">
          <AlertCircle className="w-4 h-4 shrink-0" />{erreurFond}
          <button onClick={() => setErreurFond(null)} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}
      {succes && (
        <div className="flex items-center gap-2 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm p-3">
          <CheckCircle className="w-4 h-4 shrink-0" />{succes}
        </div>
      )}

      {/* Upload fond de plan */}
      {!fondPlan && (
        <div className="carte p-6 space-y-3">
          <p className="font-semibold text-slate-700">Importer un fond de plan</p>
          <p className="text-sm text-slate-400">Formats acceptés : image (PNG, JPEG) ou PDF.</p>
          <label className="flex cursor-pointer items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-10 hover:border-primaire-300 hover:bg-primaire-50 transition">
            {chargementFond
              ? <><Calculator className="w-6 h-6 animate-spin text-slate-400" /><span className="text-sm text-slate-500">Téléversement…</span></>
              : <><Upload className="w-6 h-6 text-slate-400" /><span className="text-sm text-slate-500">Cliquez pour importer le fond de plan</span></>
            }
            <input
              type="file"
              accept="image/*,.pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploaderFond(f);
                e.currentTarget.value = "";
              }}
            />
          </label>
        </div>
      )}

      {/* Interface canvas */}
      <div className="grid gap-4 xl:grid-cols-[60px_minmax(0,1fr)_280px]">
        {/* Barre d'outils */}
        <div className="flex xl:flex-col gap-2 flex-wrap">
          {[
            { id: "selection" as OutilCanvas, icone: <MousePointer className="w-4 h-4" />, titre: "Sélection / Déplacement" },
            { id: "surface" as OutilCanvas, icone: <Square className="w-4 h-4" />, titre: "Surface (polygone)" },
            { id: "longueur" as OutilCanvas, icone: <LineIcon className="w-4 h-4" />, titre: "Longueur (ligne)" },
            { id: "comptage" as OutilCanvas, icone: <Hash className="w-4 h-4" />, titre: "Comptage" },
            { id: "calibrer" as OutilCanvas, icone: <ScanLine className="w-4 h-4" />, titre: "Calibrer l'échelle" },
          ].map((o) => (
            <button
              key={o.id}
              type="button"
              title={o.titre}
              onClick={() => { setOutil(o.id); setPointsEnCours([]); }}
              className={`flex h-10 w-10 items-center justify-center rounded-xl border transition ${
                outil === o.id
                  ? "border-primaire-300 bg-primaire-50 text-primaire-700"
                  : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
              }`}
            >
              {o.icone}
            </button>
          ))}
          {outil === "calibrer" && (
            <div className="xl:mt-2 space-y-1">
              <input
                type="number"
                className="champ-saisie w-full text-xs"
                placeholder="Long. (m)"
                value={longueurConnue}
                onChange={(e) => setLongueurConnue(e.target.value)}
              />
              <p className="text-[10px] text-slate-400">
                {calibrationPoints.length}/2 pts
              </p>
            </div>
          )}
        </div>

        {/* Canvas */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
          <canvas
            ref={canvasRef}
            width={800}
            height={600}
            className="w-full cursor-crosshair"
            onClick={gererClic}
            onDoubleClick={gererDoubleClick}
            onWheel={gererMolette}
            onMouseDown={gererMouseDown}
            onMouseMove={gererMouseMove}
            onMouseUp={gererMouseUp}
            onMouseLeave={gererMouseUp}
            style={{ cursor: outil === "selection" ? "grab" : "crosshair" }}
          />
          <div className="flex items-center justify-between border-t border-slate-200 bg-white px-4 py-2 text-xs text-slate-500">
            <span>
              {outil === "surface" && "Cliquez pour ajouter des points — Double-clic pour fermer"}
              {outil === "longueur" && "Cliquez pour tracer des segments — Double-clic pour terminer"}
              {outil === "comptage" && "Cliquez sur chaque élément à compter — Double-clic pour terminer"}
              {outil === "selection" && "Molette pour zoomer — Glisser pour déplacer"}
              {outil === "calibrer" && "Tracez un segment de longueur connue (2 points)"}
            </span>
            <span>Zoom : {Math.round(zoom * 100)} % — Échelle : {echellePixelParMetre.toFixed(1)} px/m</span>
          </div>
        </div>

        {/* Panel zones */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700">
              Zones mesurées ({zones.length})
            </p>
            {zones.length > 0 && (
              <button
                type="button"
                onClick={validerEtCreerLignes}
                disabled={enregistrement}
                className="btn-primaire text-xs disabled:opacity-60"
              >
                {enregistrement
                  ? <><Calculator className="w-3 h-3 animate-spin" />Création…</>
                  : <><CheckSquare className="w-3 h-3" />Valider</>
                }
              </button>
            )}
          </div>

          {zones.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-400">
              Aucune zone mesurée.<br />Sélectionnez un outil et dessinez sur le plan.
            </div>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {zones.map((zone) => (
                <div
                  key={zone.id}
                  className={`rounded-xl border p-3 cursor-pointer transition ${
                    zone.id === zoneSelectionnee
                      ? "border-primaire-200 bg-primaire-50"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                  onClick={() => setZoneSelectionnee(zone.id === zoneSelectionnee ? null : zone.id)}
                >
                  <div className="flex items-start gap-2">
                    <div
                      className="mt-1 h-3 w-3 rounded-full shrink-0"
                      style={{ background: zone.couleur }}
                    />
                    <div className="flex-1 min-w-0">
                      <input
                        type="text"
                        className="champ-saisie w-full text-xs py-1"
                        value={zone.designation}
                        onChange={(e) => modifierDesignationZone(zone.id, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <p className="mt-1 font-mono text-xs text-slate-600">
                        {zone.type === "comptage"
                          ? `${zone.points.length} u`
                          : `${(zone.valeur).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} ${zone.unite}`
                        }
                      </p>
                      <div className="mt-1 flex gap-2 text-[10px] text-slate-400">
                        <span className="capitalize">{zone.type}</span>
                        <span>{zone.points.length} pt(s)</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); supprimerZone(zone.id); }}
                      className="p-1 text-slate-300 hover:text-red-500"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Calibration info */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center gap-2">
              <Ruler className="w-3 h-3 text-slate-400" />
              <p className="text-xs font-medium text-slate-600">Calibration</p>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              1 m = {echellePixelParMetre.toFixed(1)} px
            </p>
            {outil !== "calibrer" && (
              <button
                type="button"
                onClick={() => setOutil("calibrer")}
                className="mt-2 text-xs text-primaire-600 hover:underline"
              >
                Modifier l&apos;échelle
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page principale
// ---------------------------------------------------------------------------

export default function PageDetailMetre({
  params,
}: {
  params: Promise<{ id: string; metre_id: string }>;
}) {
  const { id: projetId, metre_id: metreId } = use(params);
  const [metre, setMetre] = useState<MetreDetail | null>(null);
  const [chargement, setChargement] = useState(true);
  const [succes, setSucces] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [modal, setModal] = useState(false);
  const [edition, setEdition] = useState<LigneMetre | null>(null);
  const [suppressionId, setSuppressionId] = useState<string | null>(null);
  const [onglet, setOnglet] = useState<"lignes" | "visuel">("lignes");

  const charger = useCallback(async () => {
    try {
      setMetre(await api.get<MetreDetail>(`/api/metres/${metreId}/`));
    } catch {
      setErreur("Impossible de charger le métré.");
    } finally {
      setChargement(false);
    }
  }, [metreId]);

  useEffect(() => { charger(); }, [charger]);

  const flash = (msg: string) => { setSucces(msg); setTimeout(() => setSucces(null), 3000); };

  const supprimerLigne = async (ligneId: string) => {
    try {
      await api.supprimer(`/api/metres/${metreId}/lignes/${ligneId}/`);
      flash("Ligne supprimée.");
      setSuppressionId(null);
      charger();
    } catch {
      setErreur("Impossible de supprimer la ligne.");
    }
  };

  const valider = async () => {
    try {
      await api.post(`/api/metres/${metreId}/valider/`, {});
      flash("Métré validé.");
      charger();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Impossible de valider.");
    }
  };

  if (chargement) return <div className="py-20 text-center text-slate-400 text-sm">Chargement…</div>;
  if (!metre) return (
    <div className="space-y-4">
      <Link href={`/projets/${projetId}/metres`} className="flex items-center gap-2 text-slate-400 hover:text-slate-600 text-sm">
        <ArrowLeft className="w-4 h-4" />Retour
      </Link>
      <div className="py-20 text-center text-red-500">Métré introuvable.</div>
    </div>
  );

  const lignes = metre.lignes ?? [];
  const totalLignes = lignes.reduce((s, l) => s + (l.montant_ht ?? 0), 0);

  // Grouper par nature
  const parNature: Record<string, LigneMetre[]> = {};
  lignes.forEach(l => {
    if (!parNature[l.nature]) parNature[l.nature] = [];
    parNature[l.nature].push(l);
  });

  return (
    <div className="space-y-6">
      {/* Fil d'Ariane */}
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Link href={`/projets/${projetId}`} className="hover:text-slate-600 transition-colors">
          {metre.projet_reference}
        </Link>
        <ChevronRight className="w-3 h-3" />
        <Link href={`/projets/${projetId}/metres`} className="hover:text-slate-600 transition-colors">
          Métrés
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-slate-600 font-medium truncate">{metre.intitule}</span>
      </div>

      {succes && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm">
          <CheckCircle className="w-4 h-4 shrink-0" />{succes}
        </div>
      )}
      {erreur && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />{erreur}
          <button onClick={() => setErreur(null)} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* En-tête métré */}
      <div className="carte p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
              <Calculator className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${
                  metre.statut === "valide" ? "badge-succes" :
                  metre.statut === "en_cours" ? "bg-blue-100 text-blue-700 border border-blue-200" :
                  "badge-neutre"
                }`}>
                  {metre.statut_libelle}
                </span>
                <span className="text-sm text-slate-400">{metre.type_libelle}</span>
              </div>
              <h1 className="mt-1 text-xl font-bold text-slate-800">{metre.intitule}</h1>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <p className="text-xs text-slate-400">Total HT</p>
              <p className="text-2xl font-bold text-primaire-700 font-mono">
                {formatMontant(totalLignes)}
              </p>
            </div>
            {metre.statut !== "valide" && (
              <button onClick={valider} className="btn-primaire">
                <CheckCircle className="w-4 h-4" />Valider
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Navigation onglets */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-1 px-1">
          {[
            { id: "lignes", libelle: `Lignes de métré (${lignes.length})` },
            { id: "visuel", libelle: "Métré visuel" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setOnglet(tab.id as typeof onglet)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                onglet === tab.id
                  ? "border-primaire-600 text-primaire-700"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
              }`}
            >
              {tab.libelle}
            </button>
          ))}
        </nav>
      </div>

      {/* Onglet Métré visuel */}
      {onglet === "visuel" && (
        <MetreVisuel metreId={metreId} onLignesCreees={() => { charger(); setOnglet("lignes"); }} />
      )}

      {/* Tableau des lignes */}
      {onglet === "lignes" && <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-slate-700">
            {lignes.length} ligne{lignes.length !== 1 ? "s" : ""}
          </p>
          {metre.statut !== "valide" && (
            <button onClick={() => { setEdition(null); setModal(true); }} className="btn-primaire">
              <Plus className="w-4 h-4" />Ajouter une ligne
            </button>
          )}
        </div>

        {lignes.length === 0 ? (
          <div className="carte py-12 text-center">
            <Calculator className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">Aucune ligne</p>
            <p className="text-slate-400 text-sm mt-1">Ajoutez des lignes pour commencer le métré.</p>
          </div>
        ) : (
          <div className="carte overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider w-8">#</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Désignation</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider hidden sm:table-cell">Nature</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Qté</th>
                  <th className="text-center px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Unité</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider hidden md:table-cell">PU HT</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Montant HT</th>
                  {metre.statut !== "valide" && <th className="px-4 py-3 w-20"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {lignes.map((ligne, idx) => (
                  <tr key={ligne.id} className="hover:bg-slate-50 group">
                    <td className="px-4 py-3 text-xs text-slate-400 font-mono">{idx + 1}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{ligne.designation}</p>
                      {ligne.code_article && (
                        <p className="text-xs text-slate-400 font-mono">{ligne.code_article}</p>
                      )}
                      {ligne.detail_calcul && (
                        <p className="text-xs text-slate-400 font-mono mt-0.5 italic">{ligne.detail_calcul}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        {ligne.nature_libelle}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-slate-700">
                      {ligne.quantite != null ? Number(ligne.quantite).toLocaleString("fr-FR") : "—"}
                    </td>
                    <td className="px-4 py-3 text-center font-mono text-xs text-slate-500">
                      {ligne.unite}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-slate-600 hidden md:table-cell">
                      {formatMontant(ligne.prix_unitaire_ht)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm font-semibold text-primaire-700">
                      {formatMontant(ligne.montant_ht)}
                    </td>
                    {metre.statut !== "valide" && (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                          <button
                            onClick={() => { setEdition(ligne); setModal(true); }}
                            className="p-1.5 rounded text-slate-400 hover:text-primaire-600 hover:bg-primaire-50"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {suppressionId === ligne.id ? (
                            <div className="flex items-center gap-1">
                              <button onClick={() => supprimerLigne(ligne.id)}
                                className="text-xs text-red-600 font-medium px-1.5 py-1 rounded hover:bg-red-50">
                                Suppr.
                              </button>
                              <button onClick={() => setSuppressionId(null)}
                                className="p-1 rounded hover:bg-slate-100">
                                <X className="w-3 h-3 text-slate-400" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setSuppressionId(ligne.id)}
                              className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50">
                  <td colSpan={metre.statut !== "valide" ? 6 : 5} className="px-4 py-3 text-right text-sm font-semibold text-slate-600 hidden md:table-cell">
                    Total HT
                  </td>
                  <td colSpan={metre.statut !== "valide" ? 6 : 5} className="px-4 py-3 text-right text-sm font-semibold text-slate-600 md:hidden">
                    Total HT
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-base font-bold text-primaire-700">
                    {formatMontant(totalLignes)}
                  </td>
                  {metre.statut !== "valide" && <td></td>}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>}

      {modal && onglet === "lignes" && (
        <FormLigne
          metreId={metreId}
          initial={edition ? {
            numero_ordre: String(edition.numero_ordre),
            code_article: edition.code_article,
            designation: edition.designation,
            nature: edition.nature,
            quantite: edition.quantite != null ? String(edition.quantite) : "",
            unite: edition.unite,
            detail_calcul: edition.detail_calcul,
            prix_unitaire_ht: edition.prix_unitaire_ht != null ? String(edition.prix_unitaire_ht) : "",
            observations: edition.observations,
          } : {}}
          ligneId={edition?.id}
          numeroOrdreInitial={(metre.lignes?.length || 0) + 1}
          onSuccess={() => { flash(edition ? "Ligne modifiée." : "Ligne ajoutée."); charger(); }}
          onClose={() => { setModal(false); setEdition(null); }}
        />
      )}
    </div>
  );
}
