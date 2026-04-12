"use client";

import { useEffect, useMemo, useState } from "react";
import { api, ErreurApi, extraireListeResultats, requeteApiAvecProgression } from "@/crochets/useApi";
import { EditeurTexteRiche } from "@/composants/ui/EditeurTexteRiche";
import { ActionsRapidesAdaptatives } from "@/composants/ui/ActionsRapides";
import { SectionAdmin } from "@/composants/ui/SectionAdmin";
import { ModalConfirmation } from "@/composants/ui/ModalConfirmation";
import { EntetePageAdmin } from "@/composants/administration/Presentation";
import {
  AlertCircle, ExternalLink, Eye, EyeOff,
  FolderKanban, Pencil, Plus, Save, Trash2, X,
} from "lucide-react";

interface Realisation {
  id: string;
  titre: string;
  description: string;
  client: string;
  lieu: string;
  annee: number | null;
  montant_travaux_ht: number | null;
  image_principale?: string | null;
  tags: string[];
  est_publie: boolean;
  ordre_affichage: number;
}

const VIDE = {
  titre: "", description: "", client: "", lieu: "",
  annee: "", montant_travaux_ht: "", tagsTexte: "", est_publie: true, ordre_affichage: 100,
};

function ModalReference({
  initial, onEnregistrer, onFermer,
}: {
  initial: Realisation | null;
  onEnregistrer: (v: FormData | Record<string, unknown>) => Promise<void>;
  onFermer: () => void;
}) {
  const [form, setForm] = useState({
    titre: initial?.titre ?? VIDE.titre,
    description: initial?.description ?? VIDE.description,
    client: initial?.client ?? VIDE.client,
    lieu: initial?.lieu ?? VIDE.lieu,
    annee: initial?.annee ? String(initial.annee) : VIDE.annee,
    montant_travaux_ht: typeof initial?.montant_travaux_ht === "number" ? String(initial.montant_travaux_ht) : VIDE.montant_travaux_ht,
    tagsTexte: initial?.tags?.join(", ") ?? VIDE.tagsTexte,
    est_publie: initial?.est_publie ?? VIDE.est_publie,
    ordre_affichage: initial?.ordre_affichage ?? VIDE.ordre_affichage,
  });
  const [imageFichier, setImageFichier] = useState<File | null>(null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const apercuImage = useMemo(() => {
    if (imageFichier) return URL.createObjectURL(imageFichier);
    return initial?.image_principale ?? null;
  }, [imageFichier, initial?.image_principale]);

  const maj = (champ: keyof typeof form, valeur: string | boolean | number) =>
    setForm((prev) => ({ ...prev, [champ]: valeur }));

  const soumettre = async () => {
    if (!form.titre.trim()) { setErreur("Le titre est requis."); return; }
    const tags = form.tagsTexte.split(",").map((t) => t.trim()).filter(Boolean);
    const charge = {
      titre: form.titre.trim(), description: form.description,
      client: form.client.trim(), lieu: form.lieu.trim(),
      annee: form.annee ? Number(form.annee) : null,
      montant_travaux_ht: form.montant_travaux_ht ? Number(form.montant_travaux_ht) : null,
      tags, est_publie: form.est_publie, ordre_affichage: Number(form.ordre_affichage) || 100,
    };
    setChargement(true); setErreur(null);
    try {
      if (imageFichier) {
        const fd = new FormData();
        Object.entries(charge).forEach(([k, v]) => {
          if (Array.isArray(v)) { fd.append(k, JSON.stringify(v)); return; }
          fd.append(k, v === null ? "" : String(v));
        });
        fd.append("image_principale", imageFichier);
        await onEnregistrer(fd);
      } else {
        await onEnregistrer(charge);
      }
      onFermer();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Erreur lors de l'enregistrement.");
    } finally { setChargement(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="font-semibold text-slate-800">{initial ? "Modifier la référence" : "Nouvelle référence"}</h2>
          <button onClick={onFermer} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-5 p-6">
          {erreur && (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />{erreur}
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div>
              <label className="libelle-champ">Titre <span className="text-red-500">*</span></label>
              <input type="text" className="champ-saisie w-full" value={form.titre}
                onChange={(e) => maj("titre", e.target.value)} placeholder="Réhabilitation d'un équipement public" />
            </div>
            <div>
              <label className="libelle-champ">Client</label>
              <input type="text" className="champ-saisie w-full" value={form.client}
                onChange={(e) => maj("client", e.target.value)} placeholder="Commune, promoteur, bailleur…" />
            </div>
            <div>
              <label className="libelle-champ">Lieu</label>
              <input type="text" className="champ-saisie w-full" value={form.lieu}
                onChange={(e) => maj("lieu", e.target.value)} placeholder="Ville, région, zone d'activité…" />
            </div>
            <div>
              <label className="libelle-champ">Mots-clés</label>
              <input type="text" className="champ-saisie w-full" value={form.tagsTexte}
                onChange={(e) => maj("tagsTexte", e.target.value)} placeholder="VRD, CCTP, DCE, métrés" />
              <p className="mt-1 text-xs text-slate-400">Séparez les mots-clés par des virgules.</p>
            </div>
            <div>
              <label className="libelle-champ">Année</label>
              <input type="number" className="champ-saisie w-full" min={1900} max={2100}
                value={form.annee} onChange={(e) => maj("annee", e.target.value)} placeholder="2026" />
            </div>
            <div>
              <label className="libelle-champ">Montant travaux HT</label>
              <input type="number" className="champ-saisie w-full" min={0} step="0.01"
                value={form.montant_travaux_ht} onChange={(e) => maj("montant_travaux_ht", e.target.value)} placeholder="1250000" />
            </div>
            <div>
              <label className="libelle-champ">Ordre d&apos;affichage</label>
              <input type="number" className="champ-saisie w-full" min={1} max={999}
                value={form.ordre_affichage} onChange={(e) => maj("ordre_affichage", Number(e.target.value) || 100)} />
            </div>
            <div className="space-y-3">
              <label className="libelle-champ">Visuel principal</label>
              <label className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50">
                Choisir une image
                <input type="file" accept="image/*" className="hidden"
                  onChange={(e) => setImageFichier(e.target.files?.[0] ?? null)} />
              </label>
              {apercuImage && (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={apercuImage} alt={form.titre || "Aperçu référence"} className="h-48 w-full object-cover" />
                </div>
              )}
            </div>
          </div>
          <label className="flex cursor-pointer items-center gap-3">
            <input type="checkbox" className="h-4 w-4 rounded text-primaire-600"
              checked={form.est_publie} onChange={(e) => maj("est_publie", e.target.checked)} />
            <span className="text-sm font-medium text-slate-700">Référence publiée et visible sur le site</span>
          </label>
          <div>
            <label className="libelle-champ">Description détaillée</label>
            <EditeurTexteRiche valeur={form.description} onChange={(html) => maj("description", html)}
              placeholder="Présentez le contexte, la mission confiée, les enjeux et les livrables réalisés…"
              hauteurMinimale="min-h-[22rem]" />
          </div>
        </div>
        <div className="flex justify-end gap-3 rounded-b-3xl border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button onClick={onFermer} className="btn-secondaire">Annuler</button>
          <button onClick={soumettre} disabled={chargement} className="btn-primaire disabled:opacity-60">
            {chargement ? "Enregistrement…" : <><Save className="h-4 w-4" />Enregistrer</>}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PageAdministrationReferences() {
  const [realisations, setRealisations] = useState<Realisation[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  const [modalOuvert, setModalOuvert] = useState(false);
  const [referenceEnEdition, setReferenceEnEdition] = useState<Realisation | null>(null);
  const [suppressionCible, setSuppressionCible] = useState<Realisation | null>(null);
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);

  const charger = async () => {
    try {
      const data = await api.get<Realisation[]>("/api/site/realisations/");
      setRealisations(extraireListeResultats(data));
    } catch { setErreur("Impossible de charger les références."); }
    finally { setChargement(false); }
  };

  useEffect(() => { void charger(); }, []);

  const flash = (msg: string) => { setSucces(msg); setTimeout(() => setSucces(null), 3000); };

  const enregistrer = async (valeur: FormData | Record<string, unknown>) => {
    if (referenceEnEdition) {
      if (valeur instanceof FormData) {
        await requeteApiAvecProgression(`/api/site/realisations/${referenceEnEdition.id}/`, { method: "PATCH", corps: valeur });
      } else {
        await api.patch(`/api/site/realisations/${referenceEnEdition.id}/`, valeur);
      }
      flash("Référence modifiée.");
    } else {
      if (valeur instanceof FormData) {
        await requeteApiAvecProgression("/api/site/realisations/", { method: "POST", corps: valeur });
      } else {
        await api.post("/api/site/realisations/", valeur);
      }
      flash("Référence créée.");
    }
    await charger();
  };

  const basculerPublication = async (item: Realisation) => {
    try {
      await api.patch(`/api/site/realisations/${item.id}/`, { est_publie: !item.est_publie });
      flash(item.est_publie ? "Référence masquée." : "Référence publiée.");
      await charger();
    } catch { setErreur("Impossible de modifier la publication."); }
  };

  const confirmerSuppression = async () => {
    if (!suppressionCible) return;
    setSuppressionEnCours(true);
    try {
      await api.supprimer(`/api/site/realisations/${suppressionCible.id}/`);
      flash("Référence supprimée.");
      await charger();
    } catch { setErreur("Impossible de supprimer la référence."); }
    finally { setSuppressionEnCours(false); setSuppressionCible(null); }
  };

  return (
    <div className="space-y-6">
      <EntetePageAdmin
        titre="Références et réalisations"
        description="Publiez des fiches projet cliquables avec image, descriptif détaillé et informations de mission."
        actions={(
          <button onClick={() => { setReferenceEnEdition(null); setModalOuvert(true); }} className="btn-primaire">
            <Plus className="h-4 w-4" /> Nouvelle référence
          </button>
        )}
        statistiques={[
          { libelle: "Total", valeur: `${realisations.length} référence${realisations.length > 1 ? "s" : ""}` },
          { libelle: "Publiées", valeur: `${realisations.filter((r) => r.est_publie).length}` },
          { libelle: "Hors ligne", valeur: `${realisations.filter((r) => !r.est_publie).length}` },
          { libelle: "Avec image", valeur: `${realisations.filter((r) => Boolean(r.image_principale)).length}` },
        ]}
      />

      <SectionAdmin
        titre="Bibliothèque des références"
        description="Les références publiées alimentent directement la page publique et ses fiches détail."
        icone={<FolderKanban className="h-4 w-4" />}
        chargement={chargement}
        erreur={erreur}
        succes={succes}
        onEffacerSucces={() => setSucces(null)}
      >
        <div className="divide-y divide-slate-100">
          {realisations.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400">
              Aucune référence publiée pour le moment.
            </div>
          ) : (
            realisations.map((item) => (
              <div key={item.id} className="flex items-center gap-4 px-4 py-4 transition-colors hover:bg-slate-50">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <button type="button"
                      onClick={() => { setReferenceEnEdition(item); setModalOuvert(true); }}
                      className="truncate font-medium text-slate-800 hover:text-primaire-600 transition-colors">
                      {item.titre}
                    </button>
                    {!item.est_publie && <span className="badge-neutre text-xs">Hors ligne</span>}
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    {[item.client, item.lieu, item.annee].filter(Boolean).join(" · ") || "Sans précision"}
                  </p>
                </div>
                <ActionsRapidesAdaptatives actions={[
                  { titre: "Voir la page publique", icone: ExternalLink, href: `/references/${item.id}`, target: "_blank", rel: "noopener noreferrer" },
                  { titre: item.est_publie ? "Masquer" : "Publier", icone: item.est_publie ? Eye : EyeOff, onClick: () => basculerPublication(item) },
                  { titre: "Modifier", icone: Pencil, variante: "primaire", onClick: () => { setReferenceEnEdition(item); setModalOuvert(true); } },
                  { titre: "Supprimer", icone: Trash2, variante: "danger", onClick: () => setSuppressionCible(item) },
                ]} />
              </div>
            ))
          )}
        </div>
      </SectionAdmin>

      {modalOuvert && (
        <ModalReference initial={referenceEnEdition} onEnregistrer={enregistrer}
          onFermer={() => { setModalOuvert(false); setReferenceEnEdition(null); }} />
      )}

      <ModalConfirmation
        ouverte={Boolean(suppressionCible)}
        titre="Supprimer la référence"
        message={`Supprimer définitivement « ${suppressionCible?.titre} » ? Cette action est irréversible.`}
        libelleBoutonConfirmer="Supprimer"
        variante="danger"
        chargement={suppressionEnCours}
        onConfirmer={confirmerSuppression}
        onAnnuler={() => setSuppressionCible(null)}
      />
    </div>
  );
}
