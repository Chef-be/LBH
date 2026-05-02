"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Briefcase, Check, ChevronLeft, ChevronRight, FileText, Search } from "lucide-react";
import { Modal } from "@/composants/ui/Modal";
import { api, ErreurApi } from "@/crochets/useApi";
import { AffaireCommerciale } from "@/types/societe";

interface Props {
  ouvert: boolean;
  onFermer: () => void;
}

interface OrganisationOption {
  id: string;
  nom: string;
  type_organisation: string;
  siret: string;
  adresse: string;
  code_postal: string;
  ville: string;
  pays: string;
  telephone: string;
  courriel: string;
}

interface EntreprisePubliqueOption {
  siret: string;
  nom: string;
  adresse: string;
  code_postal: string;
  ville: string;
  pays: string;
}

type Etape = "client" | "contexte" | "chiffrage" | "recapitulatif";

const ETAPES: Array<{ code: Etape; libelle: string }> = [
  { code: "client", libelle: "Client" },
  { code: "contexte", libelle: "Contexte" },
  { code: "chiffrage", libelle: "Chiffrage" },
  { code: "recapitulatif", libelle: "Récapitulatif" },
];

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

const OPTIONS_FACTURATION = [
  ["forfait", "Forfait"],
  ["temps_passe", "Temps passé"],
  ["echeancier", "Échéancier"],
  ["avancement", "Avancement"],
  ["mixte", "Mixte"],
];

const OPTIONS_PAIEMENT = [
  ["virement", "Virement"],
  ["carte", "Carte bancaire"],
  ["chorus_pro", "Chorus Pro"],
  ["mixte", "Mixte"],
];

function dateIsoDans(jours: number): string {
  const date = new Date();
  date.setDate(date.getDate() + jours);
  return date.toISOString().split("T")[0];
}

function champStyle() {
  return { background: "var(--fond-entree)", border: "1px solid var(--bordure)", color: "var(--texte)" };
}

function libelle(options: string[][], valeur: string) {
  return options.find(([code]) => code === valeur)?.[1] ?? (valeur || "-");
}

export function ModalNouvelleAffaire({ ouvert, onFermer }: Props) {
  const router = useRouter();
  const qc = useQueryClient();
  const [etape, setEtape] = useState<Etape>("client");
  const indexEtape = ETAPES.findIndex((item) => item.code === etape);

  const [clientLocalId, setClientLocalId] = useState("");
  const [clientPublicSelectionne, setClientPublicSelectionne] = useState<EntreprisePubliqueOption | null>(null);
  const [suggestionsOuvertes, setSuggestionsOuvertes] = useState(false);
  const [clientNomSelectionne, setClientNomSelectionne] = useState("");

  const [form, setForm] = useState({
    intitule: "",
    client_nom: "",
    contact_client: "",
    contact_email: "",
    client_telephone: "",
    client_adresse: "",
    type_client: "maitrise_ouvrage",
    cadre_juridique: "marche_prive",
    mode_commande: "consultation_directe",
    mode_facturation: "forfait",
    mode_paiement_prevu: "virement",
    montant_estime_ht: "",
    taux_tva: "0.20",
    acompte_pct: "30",
    delai_validite_devis_jours: "30",
    delai_paiement_jours: "30",
    description: "",
  });
  const [erreur, setErreur] = useState<string | null>(null);

  const rechercheClient = form.client_nom.trim();
  const suggestionsActives = ouvert
    && suggestionsOuvertes
    && rechercheClient.length >= 2
    && rechercheClient !== clientNomSelectionne;

  const { data: clientsLocaux = [] } = useQuery<OrganisationOption[]>({
    queryKey: ["modal-affaire-clients-locaux", rechercheClient],
    enabled: suggestionsActives,
    queryFn: async () => {
      const r = await api.get<{ results?: OrganisationOption[] } | OrganisationOption[]>(
        `/api/organisations/?search=${encodeURIComponent(rechercheClient)}`,
      );
      return Array.isArray(r) ? r : (r.results ?? []);
    },
  });

  const { data: clientsPublics = [] } = useQuery<EntreprisePubliqueOption[]>({
    queryKey: ["modal-affaire-clients-publics", rechercheClient],
    enabled: suggestionsActives && rechercheClient.length >= 3 && clientsLocaux.length === 0,
    queryFn: async () => {
      const r = await api.get<{ results: EntreprisePubliqueOption[] }>(
        `/api/organisations/recherche-entreprises/?q=${encodeURIComponent(rechercheClient)}&limit=5`,
      );
      return r.results ?? [];
    },
  });

  const totalHT = Number(String(form.montant_estime_ht || "0").replace(",", ".")) || 0;
  const totalTVA = totalHT * (Number(form.taux_tva) || 0);
  const totalTTC = totalHT + totalTVA;

  const contexteProjet = useMemo(() => ({
    famille_client: form.type_client,
    sous_type_client: "",
    contexte_contractuel: form.mode_commande,
    mission_principale: "",
    missions_associees: [],
    livrables_selectionnes: [],
    phase_intervention: "",
    nature_ouvrage: "batiment",
    nature_marche: form.cadre_juridique === "marche_public" ? "public" : form.cadre_juridique === "mixte" ? "mixte" : "prive",
    role_lbh: "",
    methode_estimation: "",
    donnees_entree: {
      source_affaire: "pilotage_societe",
      cadre_juridique: form.cadre_juridique,
      mode_commande: form.mode_commande,
      mode_facturation: form.mode_facturation,
      mode_paiement_prevu: form.mode_paiement_prevu,
    },
  }), [form.cadre_juridique, form.mode_commande, form.mode_facturation, form.mode_paiement_prevu, form.type_client]);

  const maj = (champ: keyof typeof form, valeur: string) => {
    setForm((courant) => ({ ...courant, [champ]: valeur }));
    if (champ === "client_nom") {
      setClientLocalId("");
      setClientPublicSelectionne(null);
      setClientNomSelectionne("");
      setSuggestionsOuvertes(true);
    }
  };

  const appliquerClientLocal = (client: OrganisationOption) => {
    setClientLocalId(client.id);
    setClientPublicSelectionne(null);
    setClientNomSelectionne(client.nom);
    setSuggestionsOuvertes(false);
    setForm((courant) => ({
      ...courant,
      client_nom: client.nom,
      contact_email: client.courriel || courant.contact_email,
      client_telephone: client.telephone || courant.client_telephone,
      client_adresse: [client.adresse, client.code_postal, client.ville, client.pays].filter(Boolean).join(" "),
    }));
  };

  const appliquerClientPublic = (client: EntreprisePubliqueOption) => {
    setClientLocalId("");
    setClientPublicSelectionne(client);
    setClientNomSelectionne(client.nom);
    setSuggestionsOuvertes(false);
    setForm((courant) => ({
      ...courant,
      client_nom: client.nom,
      client_adresse: [client.adresse, client.code_postal, client.ville, client.pays].filter(Boolean).join(" "),
    }));
  };

  const typeOrganisationDepuisClient = () => {
    if (form.type_client === "entreprise") return "entreprise";
    if (form.type_client === "maitrise_ouvrage") return "maitre_ouvrage";
    return "partenaire";
  };

  const enregistrerClientSiNecessaire = async (): Promise<string | null> => {
    if (clientLocalId) return clientLocalId;
    if (!form.client_nom.trim()) return null;
    try {
      const client = await api.post<OrganisationOption>("/api/organisations/", {
        code: `CLIENT-${Date.now()}`,
        nom: form.client_nom.trim(),
        type_organisation: typeOrganisationDepuisClient(),
        siret: clientPublicSelectionne?.siret || "",
        adresse: clientPublicSelectionne?.adresse || form.client_adresse,
        code_postal: clientPublicSelectionne?.code_postal || "",
        ville: clientPublicSelectionne?.ville || "",
        telephone: form.client_telephone,
        courriel: form.contact_email,
        pays: clientPublicSelectionne?.pays || "France",
        est_active: true,
      });
      setClientLocalId(client.id);
      return client.id;
    } catch {
      return null;
    }
  };

  const creation = useMutation({
    mutationFn: async () => {
      const clientId = await enregistrerClientSiNecessaire();
      const affaire = await api.post<AffaireCommerciale>("/api/societe/affaires/", {
        intitule: form.intitule,
        client: clientId,
        contact_client: form.contact_client,
        contact_email: form.contact_email,
        type_client: form.type_client,
        cadre_juridique: form.cadre_juridique,
        mode_commande: form.mode_commande,
        mode_facturation: form.mode_facturation,
        mode_paiement_prevu: form.mode_paiement_prevu,
        delai_validite_devis_jours: Number(form.delai_validite_devis_jours) || 30,
        montant_estime_ht: totalHT.toFixed(2),
        montant_estime_ttc: totalTTC.toFixed(2),
        description: form.description,
        statut: "devis_a_preparer",
        donnees_metier: contexteProjet,
      });
      const devis = await api.post<{ id: string }>("/api/societe/devis/", {
        affaire: affaire.id,
        intitule: form.intitule,
        statut: "brouillon",
        famille_client: form.type_client,
        contexte_contractuel: form.mode_commande,
        nature_ouvrage: "batiment",
        nature_marche: contexteProjet.nature_marche,
        role_lbh: "",
        contexte_projet_saisie: contexteProjet,
        missions_selectionnees: [],
        client_nom: form.client_nom,
        client_contact: form.contact_client,
        client_email: form.contact_email,
        client_telephone: form.client_telephone,
        client_adresse: form.client_adresse,
        date_emission: new Date().toISOString().split("T")[0],
        date_validite: dateIsoDans(Number(form.delai_validite_devis_jours) || 30),
        taux_tva: Number(form.taux_tva),
        acompte_pct: Number(form.acompte_pct) || 0,
        delai_paiement_jours: Number(form.delai_paiement_jours) || 30,
        objet: form.description,
      });
      return { affaire, devis };
    },
    onSuccess: async ({ devis }) => {
      await qc.invalidateQueries({ queryKey: ["societe-tdb"] });
      await qc.invalidateQueries({ queryKey: ["societe-affaires"] });
      await qc.invalidateQueries({ queryKey: ["devis"] });
      onFermer();
      router.push(`/societe/devis/${devis.id}`);
    },
    onError: (error) => setErreur(error instanceof ErreurApi ? error.detail : "Impossible de créer l'affaire et le devis."),
  });

  const champsEtapeValides = () => {
    if (etape === "client") return Boolean(form.client_nom.trim());
    if (etape === "contexte") return Boolean(form.intitule.trim() && form.type_client && form.cadre_juridique && form.mode_commande);
    return true;
  };

  const allerSuivant = () => {
    setErreur(null);
    if (!champsEtapeValides()) {
      setErreur(etape === "client" ? "Le nom du client est obligatoire." : "L'intitulé, le type client, le cadre juridique et le mode de commande sont obligatoires.");
      return;
    }
    setEtape(ETAPES[Math.min(indexEtape + 1, ETAPES.length - 1)].code);
  };

  const fermer = () => {
    setSuggestionsOuvertes(false);
    onFermer();
  };

  return (
    <Modal
      ouvert={ouvert}
      onFermer={fermer}
      taille="xl"
      titre={<span className="inline-flex items-center gap-2"><Briefcase size={16} /> Nouvelle affaire commerciale</span>}
      pied={(
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs" style={{ color: "var(--texte-3)" }}>
            Les informations saisies alimentent l&apos;affaire, le devis puis le futur wizard projet.
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={fermer} className="px-4 py-2 rounded-lg text-sm" style={{ color: "var(--texte-2)", border: "1px solid var(--bordure)" }}>
              Annuler
            </button>
            {indexEtape > 0 && (
              <button type="button" onClick={() => setEtape(ETAPES[indexEtape - 1].code)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm" style={{ color: "var(--texte-2)", border: "1px solid var(--bordure)" }}>
                <ChevronLeft size={14} /> Retour
              </button>
            )}
            {etape !== "recapitulatif" ? (
              <button type="button" onClick={allerSuivant} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: "var(--c-base)" }}>
                Suivant <ChevronRight size={14} />
              </button>
            ) : (
              <button type="button" onClick={() => creation.mutate()} disabled={creation.isPending} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: "var(--c-base)" }}>
                <FileText size={14} /> {creation.isPending ? "Création..." : "Créer affaire et devis"}
              </button>
            )}
          </div>
        </div>
      )}
    >
      <div className="space-y-5">
        <div className="grid grid-cols-4 gap-2">
          {ETAPES.map((item, index) => (
            <button
              key={item.code}
              type="button"
              onClick={() => index <= indexEtape && setEtape(item.code)}
              className="rounded-lg px-3 py-2 text-xs font-semibold"
              style={{
                background: index <= indexEtape ? "color-mix(in srgb, var(--c-base) 18%, var(--fond-entree))" : "var(--fond-entree)",
                color: index <= indexEtape ? "var(--texte)" : "var(--texte-3)",
                border: "1px solid var(--bordure)",
              }}
            >
              {index < indexEtape ? <Check size={12} className="mr-1 inline" /> : null}{item.libelle}
            </button>
          ))}
        </div>

        {erreur && (
          <div className="rounded-lg px-3 py-2 text-sm" style={{ background: "color-mix(in srgb, #ef4444 12%, var(--fond-carte))", color: "#fca5a5" }}>
            {erreur}
          </div>
        )}

        {etape === "client" && (
          <div className="grid gap-4 md:grid-cols-2">
            <label className="relative block text-sm md:col-span-2">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--texte-3)" }}>Nom du client</span>
              <div className="relative">
                <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--texte-3)" }} />
                <input
                  type="text"
                  required
                  value={form.client_nom}
                  onFocus={() => {
                    if (form.client_nom.trim() !== clientNomSelectionne) setSuggestionsOuvertes(true);
                  }}
                  onChange={(e) => maj("client_nom", e.target.value)}
                  className="w-full rounded-lg py-2 pl-9 pr-3 outline-none"
                  style={champStyle()}
                />
              </div>
              {suggestionsActives && (clientsLocaux.length > 0 || clientsPublics.length > 0) && (
                <div className="absolute z-30 mt-2 max-h-64 w-full overflow-y-auto rounded-xl p-2 shadow-xl" style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}>
                  {clientsLocaux.map((client) => (
                    <button key={client.id} type="button" onClick={() => appliquerClientLocal(client)} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:opacity-80" style={{ color: "var(--texte)" }}>
                      <span className="font-medium">{client.nom}</span>
                      <span className="block text-xs" style={{ color: "var(--texte-3)" }}>{client.ville || client.siret || "Client enregistré"}</span>
                    </button>
                  ))}
                  {clientsLocaux.length === 0 && clientsPublics.map((client) => (
                    <button key={client.siret} type="button" onClick={() => appliquerClientPublic(client)} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:opacity-80" style={{ color: "var(--texte)" }}>
                      <span className="font-medium">{client.nom}</span>
                      <span className="block text-xs" style={{ color: "var(--texte-3)" }}>{client.siret} · {client.ville}</span>
                    </button>
                  ))}
                </div>
              )}
            </label>
            <Champ label="Interlocuteur" value={form.contact_client} onChange={(v) => maj("contact_client", v)} />
            <Champ label="Courriel du contact" value={form.contact_email} onChange={(v) => maj("contact_email", v)} type="email" />
            <Champ label="Téléphone" value={form.client_telephone} onChange={(v) => maj("client_telephone", v)} />
            <label className="block text-sm md:col-span-2">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--texte-3)" }}>Adresse</span>
              <textarea value={form.client_adresse} onChange={(e) => maj("client_adresse", e.target.value)} rows={2} className="w-full rounded-lg px-3 py-2 outline-none" style={champStyle()} />
            </label>
          </div>
        )}

        {etape === "contexte" && (
          <div className="grid gap-4 md:grid-cols-2">
            <Champ label="Intitulé de l'affaire / mission" value={form.intitule} onChange={(v) => maj("intitule", v)} required />
            <Selecteur label="Type de client" value={form.type_client} onChange={(v) => maj("type_client", v)} options={OPTIONS_TYPE_CLIENT} />
            <Selecteur label="Cadre juridique" value={form.cadre_juridique} onChange={(v) => maj("cadre_juridique", v)} options={OPTIONS_CADRE} />
            <Selecteur label="Mode de commande" value={form.mode_commande} onChange={(v) => maj("mode_commande", v)} options={OPTIONS_COMMANDE} />
            <label className="block text-sm md:col-span-2">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--texte-3)" }}>Description / besoin client</span>
              <textarea value={form.description} onChange={(e) => maj("description", e.target.value)} rows={4} className="w-full rounded-lg px-3 py-2 outline-none" style={champStyle()} />
            </label>
          </div>
        )}

        {etape === "chiffrage" && (
          <div className="grid gap-4 md:grid-cols-2">
            <Champ label="Montant estimé HT" value={form.montant_estime_ht} onChange={(v) => maj("montant_estime_ht", v)} type="number" />
            <Selecteur label="Mode de facturation" value={form.mode_facturation} onChange={(v) => maj("mode_facturation", v)} options={OPTIONS_FACTURATION} />
            <Selecteur label="Mode de paiement prévu" value={form.mode_paiement_prevu} onChange={(v) => maj("mode_paiement_prevu", v)} options={OPTIONS_PAIEMENT} />
            <Selecteur label="TVA" value={form.taux_tva} onChange={(v) => maj("taux_tva", v)} options={[["0.20", "20 %"], ["0.10", "10 %"], ["0.055", "5,5 %"], ["0.00", "Exonéré"]]} />
            <Champ label="Acompte prévu (%)" value={form.acompte_pct} onChange={(v) => maj("acompte_pct", v)} type="number" />
            <Champ label="Délai paiement facture (jours)" value={form.delai_paiement_jours} onChange={(v) => maj("delai_paiement_jours", v)} type="number" />
          </div>
        )}

        {etape === "recapitulatif" && (
          <div className="grid gap-3 md:grid-cols-2">
            {[
              ["Client", form.client_nom],
              ["Affaire", form.intitule],
              ["Type client", libelle(OPTIONS_TYPE_CLIENT, form.type_client)],
              ["Cadre juridique", libelle(OPTIONS_CADRE, form.cadre_juridique)],
              ["Mode commande", libelle(OPTIONS_COMMANDE, form.mode_commande)],
              ["Facturation", libelle(OPTIONS_FACTURATION, form.mode_facturation)],
              ["Paiement", libelle(OPTIONS_PAIEMENT, form.mode_paiement_prevu)],
              ["Total TTC estimé", totalTTC.toLocaleString("fr-FR", { minimumFractionDigits: 2 }) + " €"],
            ].map(([titre, valeur]) => (
              <div key={titre} className="rounded-lg p-3" style={{ background: "var(--fond-entree)", border: "1px solid var(--bordure)" }}>
                <p className="text-xs uppercase tracking-wide" style={{ color: "var(--texte-3)" }}>{titre}</p>
                <p className="mt-1 text-sm font-semibold" style={{ color: "var(--texte)" }}>{valeur || "-"}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

function Champ({
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
        style={champStyle()}
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
        style={champStyle()}
      >
        {options.map(([code, texte]) => (
          <option key={code} value={code}>{texte}</option>
        ))}
      </select>
    </label>
  );
}
