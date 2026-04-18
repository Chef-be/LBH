"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/crochets/useApi";
import { ProfilHoraire } from "@/types/societe";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";

function formaterTaux(val: string): string {
  return parseFloat(val).toLocaleString("fr-FR", { minimumFractionDigits: 2 }) + " €/h";
}

interface FormProfil {
  code: string;
  libelle: string;
  description: string;
  taux_horaire_ht: string;
  couleur: string;
  actif: boolean;
  ordre: number;
}

const FORME_VIDE: FormProfil = {
  code: "", libelle: "", description: "",
  taux_horaire_ht: "0", couleur: "#6366f1", actif: true, ordre: 0,
};

export default function PageTauxHoraires() {
  const qc = useQueryClient();
  const [modifierId, setModifierItem] = useState<string | null>(null);
  const [creer, setCreer] = useState(false);
  const [form, setForm] = useState<FormProfil>(FORME_VIDE);

  const { data: profils = [], isLoading } = useQuery<ProfilHoraire[]>({
    queryKey: ["profils-horaires"],
    queryFn: async () => {
      const r = await api.get<{ results?: ProfilHoraire[] } | ProfilHoraire[]>("/api/societe/profils-horaires/");
      return Array.isArray(r) ? r : (r.results ?? []);
    },
  });

  const sauvegarder = useMutation({
    mutationFn: (data: FormProfil) =>
      modifierId
        ? api.put<ProfilHoraire>(`/api/societe/profils-horaires/${modifierId}/`, data)
        : api.post<ProfilHoraire>("/api/societe/profils-horaires/", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profils-horaires"] });
      setModifierItem(null);
      setCreer(false);
      setForm(FORME_VIDE);
    },
  });

  const supprimer = useMutation({
    mutationFn: (id: string) => api.supprimer(`/api/societe/profils-horaires/${id}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profils-horaires"] }),
  });

  const ouvrirEdition = (p: ProfilHoraire) => {
    setModifierItem(p.id);
    setCreer(false);
    setForm({
      code: p.code, libelle: p.libelle, description: p.description,
      taux_horaire_ht: p.taux_horaire_ht, couleur: p.couleur,
      actif: p.actif, ordre: p.ordre,
    });
  };

  const annuler = () => {
    setModifierItem(null);
    setCreer(false);
    setForm(FORME_VIDE);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 style={{ color: "var(--texte)" }}>Profils et taux horaires</h2>
          <p className="text-sm mt-1" style={{ color: "var(--texte-3)" }}>
            Définissez les taux de facturation par type d&apos;intervenant
          </p>
        </div>
        {!creer && (
          <button
            type="button"
            onClick={() => { setCreer(true); setModifierItem(null); setForm(FORME_VIDE); }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ background: "var(--c-base)" }}
          >
            <Plus size={14} /> Nouveau profil
          </button>
        )}
      </div>

      {isLoading && (
        <p className="text-sm py-8 text-center" style={{ color: "var(--texte-3)" }}>Chargement…</p>
      )}

      {/* Formulaire création */}
      {creer && (
        <FormulaireProfil
          form={form}
          setForm={setForm}
          onSave={() => sauvegarder.mutate(form)}
          onCancel={annuler}
          enCours={sauvegarder.isPending}
        />
      )}

      {/* Liste des profils */}
      <div className="space-y-3">
        {profils.map((p) => (
          <div key={p.id}>
            {modifierId === p.id ? (
              <FormulaireProfil
                form={form}
                setForm={setForm}
                onSave={() => sauvegarder.mutate(form)}
                onCancel={annuler}
                enCours={sauvegarder.isPending}
              />
            ) : (
              <div
                className="flex items-center justify-between p-4 rounded-xl"
                style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}
              >
                <div className="flex items-center gap-4">
                  <div
                    className="w-3 h-10 rounded-full flex-shrink-0"
                    style={{ background: p.couleur }}
                  />
                  <div>
                    <p className="font-semibold" style={{ color: "var(--texte)" }}>{p.libelle}</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--texte-3)" }}>
                      Code : {p.code} {p.description && `— ${p.description}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span
                    className="text-xl font-bold font-mono"
                    style={{ color: p.couleur }}
                  >
                    {formaterTaux(p.taux_horaire_ht)}
                  </span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => ouvrirEdition(p)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center transition hover:opacity-80"
                      style={{ background: "var(--fond-entree)", color: "var(--texte-2)" }}
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Supprimer le profil "${p.libelle}" ?`)) supprimer.mutate(p.id);
                      }}
                      className="w-8 h-8 rounded-lg flex items-center justify-center transition hover:opacity-80"
                      style={{ background: "color-mix(in srgb, #ef4444 10%, var(--fond-carte))", color: "#ef4444" }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {!isLoading && profils.length === 0 && !creer && (
        <div
          className="rounded-xl border-2 border-dashed flex flex-col items-center justify-center py-12 gap-3"
          style={{ borderColor: "var(--bordure)" }}
        >
          <p className="text-sm" style={{ color: "var(--texte-3)" }}>Aucun profil configuré</p>
          <button
            type="button"
            onClick={() => { setCreer(true); setForm(FORME_VIDE); }}
            className="text-sm font-medium underline"
            style={{ color: "var(--c-base)" }}
          >
            Créer le premier profil
          </button>
        </div>
      )}
    </div>
  );
}

function FormulaireProfil({
  form, setForm, onSave, onCancel, enCours,
}: {
  form: FormProfil;
  setForm: (f: FormProfil) => void;
  onSave: () => void;
  onCancel: () => void;
  enCours: boolean;
}) {
  const changer = (k: keyof FormProfil, v: string | boolean | number) =>
    setForm({ ...form, [k]: v });

  return (
    <div
      className="rounded-xl p-5 space-y-4"
      style={{ background: "var(--fond-carte)", border: "2px solid var(--c-leger)" }}
    >
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: "var(--texte-3)" }}>
            Libellé *
          </label>
          <input
            type="text"
            value={form.libelle}
            onChange={(e) => changer("libelle", e.target.value)}
            placeholder="Ex : Économiste senior"
            className="w-full rounded-lg px-3 py-2 text-sm"
            style={{ background: "var(--fond-entree)", border: "1px solid var(--bordure)", color: "var(--texte)" }}
          />
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: "var(--texte-3)" }}>
            Code technique *
          </label>
          <input
            type="text"
            value={form.code}
            onChange={(e) => changer("code", e.target.value.toLowerCase().replace(/\s+/g, "_"))}
            placeholder="ex : economiste_senior"
            className="w-full rounded-lg px-3 py-2 text-sm font-mono"
            style={{ background: "var(--fond-entree)", border: "1px solid var(--bordure)", color: "var(--texte)" }}
          />
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: "var(--texte-3)" }}>
            Taux horaire HT (€/h) *
          </label>
          <input
            type="number"
            value={form.taux_horaire_ht}
            onChange={(e) => changer("taux_horaire_ht", e.target.value)}
            min="0"
            step="0.50"
            className="w-full rounded-lg px-3 py-2 text-sm font-mono"
            style={{ background: "var(--fond-entree)", border: "1px solid var(--bordure)", color: "var(--texte)" }}
          />
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: "var(--texte-3)" }}>
            Couleur
          </label>
          <div className="flex gap-2">
            <input
              type="color"
              value={form.couleur}
              onChange={(e) => changer("couleur", e.target.value)}
              className="w-10 h-10 rounded-lg border cursor-pointer"
              style={{ border: "1px solid var(--bordure)" }}
            />
            <input
              type="text"
              value={form.couleur}
              onChange={(e) => changer("couleur", e.target.value)}
              className="flex-1 rounded-lg px-3 py-2 text-sm font-mono"
              style={{ background: "var(--fond-entree)", border: "1px solid var(--bordure)", color: "var(--texte)" }}
            />
          </div>
        </div>
        <div className="col-span-2">
          <label className="text-xs font-medium mb-1 block" style={{ color: "var(--texte-3)" }}>
            Description
          </label>
          <input
            type="text"
            value={form.description}
            onChange={(e) => changer("description", e.target.value)}
            placeholder="Description courte du profil…"
            className="w-full rounded-lg px-3 py-2 text-sm"
            style={{ background: "var(--fond-entree)", border: "1px solid var(--bordure)", color: "var(--texte)" }}
          />
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={onSave}
          disabled={enCours || !form.libelle || !form.code}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
          style={{ background: "var(--c-base)" }}
        >
          <Check size={14} /> Enregistrer
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border"
          style={{ borderColor: "var(--bordure)", color: "var(--texte-2)" }}
        >
          <X size={14} /> Annuler
        </button>
      </div>
    </div>
  );
}
