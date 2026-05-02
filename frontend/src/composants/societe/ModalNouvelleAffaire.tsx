"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Briefcase, FileText } from "lucide-react";
import { Modal } from "@/composants/ui/Modal";
import { api, ErreurApi } from "@/crochets/useApi";
import { AffaireCommerciale } from "@/types/societe";

interface Props {
  ouvert: boolean;
  onFermer: () => void;
}

const OPTIONS_TYPE_CLIENT = [
  ["maitrise_ouvrage", "Maîtrise d'ouvrage"],
  ["maitrise_oeuvre", "Maîtrise d'oeuvre"],
  ["entreprise", "Entreprise"],
  ["amo", "AMO / conseil"],
  ["sous_traitance", "Sous-traitance"],
  ["cotraitance", "Co-traitance"],
];

const OPTIONS_CADRE = [
  ["marche_prive", "Marché privé"],
  ["marche_public", "Marché public"],
  ["mixte", "Mixte"],
  ["hors_marche", "Hors marché / conseil"],
];

const OPTIONS_COMMANDE = [
  ["consultation_directe", "Consultation directe"],
  ["appel_offres", "Appel d'offres"],
  ["accord_cadre", "Accord-cadre"],
  ["marche_subsequent", "Marché subséquent"],
  ["amo", "AMO / conseil"],
  ["sous_traitance", "Sous-traitance"],
  ["cotraitance", "Co-traitance"],
  ["audit", "Audit / expertise"],
];

function ChampTexte({
  label, value, onChange, required = false, type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--texte-3)" }}>
        {label}
      </span>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg px-3 py-2 outline-none"
        style={{ background: "var(--fond-entree)", border: "1px solid var(--bordure)", color: "var(--texte)" }}
      />
    </label>
  );
}

function Selecteur({
  label, value, onChange, options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[][];
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--texte-3)" }}>
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg px-3 py-2 outline-none"
        style={{ background: "var(--fond-entree)", border: "1px solid var(--bordure)", color: "var(--texte)" }}
      >
        {options.map(([code, libelle]) => (
          <option key={code} value={code}>{libelle}</option>
        ))}
      </select>
    </label>
  );
}

export function ModalNouvelleAffaire({ ouvert, onFermer }: Props) {
  const router = useRouter();
  const qc = useQueryClient();
  const [intitule, setIntitule] = useState("");
  const [contactClient, setContactClient] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [typeClient, setTypeClient] = useState("maitrise_ouvrage");
  const [cadreJuridique, setCadreJuridique] = useState("marche_prive");
  const [modeCommande, setModeCommande] = useState("consultation_directe");
  const [montantEstime, setMontantEstime] = useState("");
  const [description, setDescription] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);

  const creation = useMutation({
    mutationFn: () => api.post<AffaireCommerciale>("/api/societe/affaires/", {
      intitule,
      contact_client: contactClient,
      contact_email: contactEmail,
      type_client: typeClient,
      cadre_juridique: cadreJuridique,
      mode_commande: modeCommande,
      montant_estime_ht: montantEstime || "0.00",
      montant_estime_ttc: montantEstime || "0.00",
      description,
      statut: "devis_a_preparer",
    }),
    onSuccess: async (affaire) => {
      await qc.invalidateQueries({ queryKey: ["societe-tdb"] });
      await qc.invalidateQueries({ queryKey: ["societe-affaires"] });
      onFermer();
      router.push(`/societe/devis/nouveau?affaire=${affaire.id}`);
    },
    onError: (error) => setErreur(error instanceof ErreurApi ? error.detail : "Impossible de créer l'affaire."),
  });

  const soumettre = (event: FormEvent) => {
    event.preventDefault();
    setErreur(null);
    creation.mutate();
  };

  return (
    <Modal
      ouvert={ouvert}
      onFermer={onFermer}
      taille="xl"
      titre={<span className="inline-flex items-center gap-2"><Briefcase size={16} /> Nouvelle affaire commerciale</span>}
      pied={(
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs" style={{ color: "var(--texte-3)" }}>
            Le projet sera créé uniquement après acceptation du devis ou validation admin motivée.
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={onFermer} className="px-4 py-2 rounded-lg text-sm" style={{ color: "var(--texte-2)", border: "1px solid var(--bordure)" }}>
              Annuler
            </button>
            <button type="submit" form="form-nouvelle-affaire" disabled={creation.isPending} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: "var(--c-base)" }}>
              <FileText size={14} /> {creation.isPending ? "Création..." : "Créer l'affaire"}
            </button>
          </div>
        </div>
      )}
    >
      <form id="form-nouvelle-affaire" onSubmit={soumettre} className="space-y-5">
        {erreur && (
          <div className="rounded-lg px-3 py-2 text-sm" style={{ background: "color-mix(in srgb, #ef4444 12%, var(--fond-carte))", color: "#fca5a5" }}>
            {erreur}
          </div>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          <ChampTexte label="Intitulé de l'affaire" value={intitule} onChange={setIntitule} required />
          <ChampTexte label="Courriel du contact" value={contactEmail} onChange={setContactEmail} type="email" />
          <ChampTexte label="Contact client" value={contactClient} onChange={setContactClient} />
          <ChampTexte label="Montant estimé HT" value={montantEstime} onChange={setMontantEstime} type="number" />
          <Selecteur label="Type de client" value={typeClient} onChange={setTypeClient} options={OPTIONS_TYPE_CLIENT} />
          <Selecteur label="Cadre juridique" value={cadreJuridique} onChange={setCadreJuridique} options={OPTIONS_CADRE} />
          <div className="md:col-span-2">
            <Selecteur label="Mode de commande / relation contractuelle" value={modeCommande} onChange={setModeCommande} options={OPTIONS_COMMANDE} />
          </div>
        </div>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--texte-3)" }}>
            Description commerciale
          </span>
          <textarea
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-lg px-3 py-2 outline-none"
            style={{ background: "var(--fond-entree)", border: "1px solid var(--bordure)", color: "var(--texte)" }}
          />
        </label>
      </form>
    </Modal>
  );
}
