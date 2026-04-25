"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Plus, RefreshCw, Save, Sparkles, Trash2 } from "lucide-react";

import { api, ErreurApi } from "@/crochets/useApi";
import type {
  AssistantDevisResponse,
  DevisHonoraires,
  MissionSelectionneeDevis,
  ParcoursProjetSociete,
  ProfilHoraire,
} from "@/types/societe";

interface LigneForm {
  id?: string;
  ordre: number;
  type_ligne: "horaire" | "forfait" | "frais";
  phase_code: string;
  intitule: string;
  description: string;
  profil: string;
  nb_heures: string;
  taux_horaire: string;
  montant_unitaire_ht: string;
  quantite: string;
  unite: string;
}

interface DevisForm {
  intitule: string;
  client_nom: string;
  client_contact: string;
  client_email: string;
  client_telephone: string;
  client_adresse: string;
  objet: string;
  date_emission: string;
  date_validite: string;
  taux_tva: string;
  acompte_pct: string;
  delai_paiement_jours: string;
  conditions_particulieres: string;
  projet: string;
  famille_client: string;
  sous_type_client: string;
  contexte_contractuel: string;
  nature_ouvrage: "batiment" | "infrastructure" | "mixte";
  nature_marche: "public" | "prive" | "mixte";
  role_lbh: string;
}

const LIGNE_VIDE: LigneForm = {
  ordre: 0,
  type_ligne: "forfait",
  phase_code: "",
  intitule: "",
  description: "",
  profil: "",
  nb_heures: "8",
  taux_horaire: "0",
  montant_unitaire_ht: "0",
  quantite: "1",
  unite: "forfait",
};

function calculerMontantLigne(ligne: LigneForm): number {
  if (ligne.type_ligne === "horaire") {
    return (parseFloat(ligne.nb_heures) || 0) * (parseFloat(ligne.taux_horaire) || 0);
  }
  return (parseFloat(ligne.quantite) || 0) * (parseFloat(ligne.montant_unitaire_ht) || 0);
}

function libelleNatureOuvrage(valeur: string): string {
  if (valeur === "infrastructure") return "Infrastructure / VRD";
  if (valeur === "mixte") return "Mixte";
  return "Bâtiment";
}

export default function PageModifierDevis({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [form, setForm] = useState<DevisForm | null>(null);
  const [lignes, setLignes] = useState<LigneForm[]>([]);
  const [missionsSelectionnees, setMissionsSelectionnees] = useState<MissionSelectionneeDevis[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [initialiseDepuisDevis, setInitialiseDepuisDevis] = useState(false);

  const { data: devis, isLoading } = useQuery<DevisHonoraires>({
    queryKey: ["devis", id],
    queryFn: () => api.get<DevisHonoraires>(`/api/societe/devis/${id}/`),
  });

  const requeteParcours = useMemo(() => {
    if (!form) return "";
    const params = new URLSearchParams();
    if (form.famille_client) params.set("famille_client", form.famille_client);
    if (form.sous_type_client) params.set("sous_type_client", form.sous_type_client);
    if (form.contexte_contractuel) params.set("contexte_contractuel", form.contexte_contractuel);
    params.set("nature_ouvrage", form.nature_ouvrage);
    params.set("nature_marche", form.nature_marche);
    return params.toString();
  }, [form]);

  const { data: parcours } = useQuery<ParcoursProjetSociete>({
    queryKey: ["societe-devis-parcours-modifier", requeteParcours],
    queryFn: () => api.get<ParcoursProjetSociete>(`/api/projets/parcours/?${requeteParcours}`),
    enabled: Boolean(form),
  });

  const assistantQuery = useQuery<AssistantDevisResponse>({
    queryKey: [
      "societe-devis-assistant-modifier",
      form?.famille_client || "",
      form?.sous_type_client || "",
      form?.contexte_contractuel || "",
      form?.nature_ouvrage || "",
      form?.nature_marche || "",
      form?.role_lbh || "",
    ],
    queryFn: () => {
      const params = new URLSearchParams();
      if (form?.famille_client) params.set("famille_client", form.famille_client);
      if (form?.sous_type_client) params.set("sous_type_client", form.sous_type_client);
      if (form?.contexte_contractuel) params.set("contexte_contractuel", form.contexte_contractuel);
      params.set("nature_ouvrage", form?.nature_ouvrage || "batiment");
      params.set("nature_marche", form?.nature_marche || "public");
      if (form?.role_lbh) params.set("role_lbh", form.role_lbh);
      return api.get<AssistantDevisResponse>(`/api/societe/devis/assistant/?${params.toString()}`);
    },
    enabled: Boolean(form?.famille_client && form?.contexte_contractuel),
    staleTime: 60_000,
  });

  const { data: profils = [] } = useQuery<ProfilHoraire[]>({
    queryKey: ["profils-horaires-actifs"],
    queryFn: async () => {
      const reponse = await api.get<{ results?: ProfilHoraire[] } | ProfilHoraire[]>(
        "/api/societe/profils-horaires/?actif=true",
      );
      return Array.isArray(reponse) ? reponse : (reponse.results ?? []);
    },
  });

  useEffect(() => {
    if (!devis || initialiseDepuisDevis) return;
    setForm({
      intitule: devis.intitule,
      client_nom: devis.client_nom,
      client_contact: devis.client_contact ?? "",
      client_email: devis.client_email ?? "",
      client_telephone: devis.client_telephone ?? "",
      client_adresse: devis.client_adresse ?? "",
      objet: devis.objet ?? "",
      date_emission: devis.date_emission,
      date_validite: devis.date_validite,
      taux_tva: String(devis.taux_tva),
      acompte_pct: String(devis.acompte_pct),
      delai_paiement_jours: String(devis.delai_paiement_jours),
      conditions_particulieres: devis.conditions_particulieres ?? "",
      projet: devis.projet ?? "",
      famille_client: devis.famille_client || "",
      sous_type_client: devis.sous_type_client || "",
      contexte_contractuel: devis.contexte_contractuel || "",
      nature_ouvrage: (devis.nature_ouvrage || "batiment") as DevisForm["nature_ouvrage"],
      nature_marche: (devis.nature_marche || "public") as DevisForm["nature_marche"],
      role_lbh: devis.role_lbh || "",
    });
    setMissionsSelectionnees(devis.missions_selectionnees ?? []);
    setLignes(
      devis.lignes.map((ligne, index) => ({
        id: ligne.id,
        ordre: index,
        type_ligne: ligne.type_ligne as "horaire" | "forfait" | "frais",
        phase_code: ligne.phase_code ?? "",
        intitule: ligne.intitule,
        description: ligne.description ?? "",
        profil: ligne.profil ?? "",
        nb_heures: String(ligne.nb_heures ?? "8"),
        taux_horaire: String(ligne.taux_horaire ?? "0"),
        montant_unitaire_ht: String(ligne.montant_unitaire_ht ?? "0"),
        quantite: String(ligne.quantite ?? "1"),
        unite: ligne.unite ?? "forfait",
      })),
    );
    setInitialiseDepuisDevis(true);
  }, [devis, initialiseDepuisDevis]);

  useEffect(() => {
    if (!form || !parcours) return;

    const sousTypes = new Set(parcours.referentiels.sous_types_client.map((item) => item.id));
    if (form.sous_type_client && !sousTypes.has(form.sous_type_client)) {
      setForm((courant) => courant ? { ...courant, sous_type_client: "" } : courant);
    }

    const contextes = new Set(parcours.referentiels.contextes_contractuels.map((item) => item.id));
    if (form.contexte_contractuel && !contextes.has(form.contexte_contractuel)) {
      setForm((courant) => courant ? { ...courant, contexte_contractuel: "" } : courant);
    }
  }, [form, parcours]);

  const totalHT = lignes.reduce((somme, ligne) => somme + calculerMontantLigne(ligne), 0);
  const totalTVA = totalHT * (parseFloat(form?.taux_tva || "0") || 0);
  const totalTTC = totalHT + totalTVA;

  const mettreAJourFormulaire = <K extends keyof DevisForm>(champ: K, valeur: DevisForm[K]) => {
    setForm((courant) => (courant ? { ...courant, [champ]: valeur } : courant));
  };

  const mettreAJourLigne = (index: number, champ: keyof LigneForm, valeur: string) => {
    setLignes((courantes) => {
      const suivantes = [...courantes];
      suivantes[index] = { ...suivantes[index], [champ]: valeur };
      if (champ === "profil") {
        const profil = profils.find((item) => item.id === valeur);
        if (profil) {
          suivantes[index].taux_horaire = profil.taux_horaire_ht;
        }
      }
      return suivantes;
    });
  };

  const ajouterLigne = () => setLignes((courantes) => [...courantes, { ...LIGNE_VIDE, ordre: courantes.length }]);
  const supprimerLigne = (index: number) => setLignes((courantes) => courantes.filter((_, idx) => idx !== index));

  const missionSelectionnee = (code: string) =>
    missionsSelectionnees.find((mission) => mission.missionCode === code);

  const basculerMission = (code: string, libelle: string, livrablesParDefaut: { code: string; libelle: string }[]) => {
    setMissionsSelectionnees((courantes) => {
      const existante = courantes.find((mission) => mission.missionCode === code);
      if (existante) {
        return courantes.filter((mission) => mission.missionCode !== code);
      }
      return [
        ...courantes,
        {
          missionCode: code,
          missionLabel: libelle,
          livrablesCodes: livrablesParDefaut.map((item) => item.code),
          livrablesLabels: livrablesParDefaut.map((item) => item.libelle),
        },
      ];
    });
  };

  const basculerLivrable = (missionCode: string, livrableCode: string, livrableLabel: string) => {
    setMissionsSelectionnees((courantes) =>
      courantes.map((mission) => {
        if (mission.missionCode !== missionCode) return mission;
        const dejaActif = mission.livrablesCodes.includes(livrableCode);
        return {
          ...mission,
          livrablesCodes: dejaActif
            ? mission.livrablesCodes.filter((code) => code !== livrableCode)
            : [...mission.livrablesCodes, livrableCode],
          livrablesLabels: dejaActif
            ? (mission.livrablesLabels ?? []).filter((label) => label !== livrableLabel)
            : [...(mission.livrablesLabels ?? []), livrableLabel],
        };
      }),
    );
  };

  const appliquerPrestationsSelectionnees = () => {
    const assistant = assistantQuery.data;
    if (!assistant) return;

    const selection = missionsSelectionnees
      .map((mission) => {
        const source = assistant.missions.find((item) => item.code === mission.missionCode);
        if (!source) return mission;
        const livrables = source.livrables.filter((item) => mission.livrablesCodes.includes(item.code));
        return {
          missionCode: source.code,
          missionLabel: source.libelle,
          livrablesCodes: livrables.map((item) => item.code),
          livrablesLabels: livrables.map((item) => item.libelle),
        };
      });

    const lignesImportees = selection.map((mission, index) => {
      const suggestion = assistant.suggestions_prestations.find((item) => item.mission_code === mission.missionCode);
      const existante = lignes.find((ligne) => ligne.intitule === (suggestion?.intitule ?? mission.missionLabel ?? ""));
      return {
        id: existante?.id,
        ordre: index,
        type_ligne: suggestion?.type_ligne === "horaire" ? "horaire" : "forfait",
        phase_code: suggestion?.phase_code ?? "",
        intitule: suggestion?.intitule ?? mission.missionLabel ?? mission.missionCode,
        description: suggestion?.description ?? "",
        profil: existante?.profil ?? "",
        nb_heures: existante?.nb_heures ?? "8",
        taux_horaire: existante?.taux_horaire ?? "0",
        montant_unitaire_ht: existante?.montant_unitaire_ht ?? "0",
        quantite: suggestion?.quantite ?? "1",
        unite: suggestion?.unite ?? "forfait",
      } satisfies LigneForm;
    });

    setMissionsSelectionnees(selection);
    setLignes(lignesImportees.length > 0 ? lignesImportees : [{ ...LIGNE_VIDE }]);
  };

  const soumettre = async () => {
    if (!form) return;
    if (!form.intitule.trim() || !form.client_nom.trim()) {
      setErreur("L'intitulé et le nom du client sont obligatoires.");
      return;
    }
    if (!form.famille_client || !form.contexte_contractuel) {
      setErreur("Le cadrage client et contractuel doit être renseigné.");
      return;
    }
    if (missionsSelectionnees.length === 0) {
      setErreur("Sélectionnez au moins une mission vendue.");
      return;
    }

    setEnCours(true);
    setErreur(null);

    try {
      const assistant = assistantQuery.data;
      const contexteProjetSaisi = assistant?.contexte_projet_saisi
        ? {
            ...assistant.contexte_projet_saisi,
            famille_client: form.famille_client,
            sous_type_client: form.sous_type_client,
            contexte_contractuel: form.contexte_contractuel,
            nature_ouvrage: form.nature_ouvrage,
            nature_marche: form.nature_marche,
            role_lbh: form.role_lbh,
            mission_principale: missionsSelectionnees[0]?.missionCode || assistant.contexte_projet_saisi.mission_principale || "",
            missions_associees: missionsSelectionnees.map((mission) => mission.missionCode),
            livrables_selectionnes: missionsSelectionnees.flatMap((mission) => mission.livrablesCodes),
          }
        : {
            famille_client: form.famille_client,
            sous_type_client: form.sous_type_client,
            contexte_contractuel: form.contexte_contractuel,
            mission_principale: missionsSelectionnees[0]?.missionCode || "",
            missions_associees: missionsSelectionnees.map((mission) => mission.missionCode),
            livrables_selectionnes: missionsSelectionnees.flatMap((mission) => mission.livrablesCodes),
            phase_intervention: "",
            nature_ouvrage: form.nature_ouvrage,
            nature_marche: form.nature_marche,
            role_lbh: form.role_lbh,
            methode_estimation: "",
            donnees_entree: {},
          };

      await api.put(`/api/societe/devis/${id}/`, {
        ...form,
        projet: form.projet || null,
        taux_tva: parseFloat(form.taux_tva),
        acompte_pct: parseFloat(form.acompte_pct),
        delai_paiement_jours: parseInt(form.delai_paiement_jours, 10),
        missions_selectionnees: missionsSelectionnees,
        contexte_projet_saisie: contexteProjetSaisi,
      });

      const lignesOriginalesIds = new Set((devis?.lignes ?? []).map((ligne) => ligne.id));
      const lignesGardeesIds = new Set(lignes.filter((ligne) => ligne.id).map((ligne) => ligne.id as string));

      for (const ligneId of lignesOriginalesIds) {
        if (!lignesGardeesIds.has(ligneId)) {
          await api.supprimer(`/api/societe/devis/${id}/lignes/${ligneId}/`);
        }
      }

      for (const [index, ligne] of lignes.entries()) {
        const corps = {
          ordre: index,
          type_ligne: ligne.type_ligne,
          phase_code: ligne.phase_code,
          intitule: ligne.intitule || `Ligne ${index + 1}`,
          description: ligne.description,
          profil: ligne.profil || null,
          nb_heures: ligne.type_ligne === "horaire" ? parseFloat(ligne.nb_heures) : null,
          taux_horaire: ligne.type_ligne === "horaire" ? parseFloat(ligne.taux_horaire) : null,
          montant_unitaire_ht: ligne.type_ligne !== "horaire" ? parseFloat(ligne.montant_unitaire_ht) : null,
          quantite: parseFloat(ligne.quantite),
          unite: ligne.unite,
        };
        if (ligne.id) {
          await api.put(`/api/societe/devis/${id}/lignes/${ligne.id}/`, corps);
        } else {
          await api.post(`/api/societe/devis/${id}/lignes/`, corps);
        }
      }

      router.push(`/societe/devis/${id}`);
    } catch (error) {
      setErreur(error instanceof ErreurApi ? error.detail : "Erreur lors de la mise à jour du devis.");
    } finally {
      setEnCours(false);
    }
  };

  if (isLoading || !form) {
    return <p className="py-24 text-center text-sm" style={{ color: "var(--texte-3)" }}>Chargement…</p>;
  }

  const stylesChamp = {
    background: "var(--fond-entree)",
    border: "1px solid var(--bordure)",
    color: "var(--texte)",
  };

  return (
    <div className="max-w-5xl space-y-8">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg p-2 transition hover:opacity-70"
          style={{ background: "var(--fond-entree)", color: "var(--texte-2)" }}
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <h2 style={{ color: "var(--texte)" }}>Modifier le devis</h2>
          <p className="text-sm font-mono" style={{ color: "var(--texte-3)" }}>{devis?.reference}</p>
        </div>
      </div>

      {erreur ? (
        <div className="rounded-xl px-4 py-3 text-sm" style={{ background: "color-mix(in srgb, #ef4444 10%, var(--fond-carte))", color: "#ef4444" }}>
          {erreur}
        </div>
      ) : null}

      <section className="rounded-xl p-6 space-y-5" style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Sparkles size={16} style={{ color: "var(--c-base)" }} />
            <h3 className="font-semibold" style={{ color: "var(--texte)" }}>Qualification commerciale</h3>
          </div>
          <button
            type="button"
            onClick={() => assistantQuery.refetch()}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium"
            style={{ background: "var(--fond-entree)", color: "var(--texte-2)", border: "1px solid var(--bordure)" }}
          >
            <RefreshCw size={12} />
            Actualiser
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--texte-3)" }}>Type de client</label>
            <select
              value={form.famille_client}
              onChange={(e) => {
                mettreAJourFormulaire("famille_client", e.target.value);
                mettreAJourFormulaire("sous_type_client", "");
                mettreAJourFormulaire("contexte_contractuel", "");
              }}
              className="w-full rounded-lg px-3 py-2.5 text-sm"
              style={stylesChamp}
            >
              <option value="">Sélectionner</option>
              {parcours?.referentiels.familles_client.map((option) => (
                <option key={option.id} value={option.id}>{option.libelle}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--texte-3)" }}>Sous-type de client</label>
            <select value={form.sous_type_client} onChange={(e) => mettreAJourFormulaire("sous_type_client", e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm" style={stylesChamp}>
              <option value="">Sélectionner</option>
              {parcours?.referentiels.sous_types_client.map((option) => (
                <option key={option.id} value={option.id}>{option.libelle}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--texte-3)" }}>Contexte contractuel</label>
            <select value={form.contexte_contractuel} onChange={(e) => mettreAJourFormulaire("contexte_contractuel", e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm" style={stylesChamp}>
              <option value="">Sélectionner</option>
              {parcours?.referentiels.contextes_contractuels.map((option) => (
                <option key={option.id} value={option.id}>{option.libelle}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--texte-3)" }}>Nature de l&apos;ouvrage</label>
            <select value={form.nature_ouvrage} onChange={(e) => mettreAJourFormulaire("nature_ouvrage", e.target.value as DevisForm["nature_ouvrage"])} className="w-full rounded-lg px-3 py-2.5 text-sm" style={stylesChamp}>
              <option value="batiment">Bâtiment</option>
              <option value="infrastructure">Infrastructure / VRD</option>
              <option value="mixte">Mixte</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--texte-3)" }}>Nature du marché</label>
            <select value={form.nature_marche} onChange={(e) => mettreAJourFormulaire("nature_marche", e.target.value as DevisForm["nature_marche"])} className="w-full rounded-lg px-3 py-2.5 text-sm" style={stylesChamp}>
              <option value="public">Marché public</option>
              <option value="prive">Marché privé</option>
              <option value="mixte">Mixte</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--texte-3)" }}>Rôle LBH</label>
            <input type="text" value={form.role_lbh} onChange={(e) => mettreAJourFormulaire("role_lbh", e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm" style={stylesChamp} />
          </div>
        </div>
      </section>

      <section className="rounded-xl p-6 space-y-4" style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold" style={{ color: "var(--texte)" }}>Missions et livrables vendus</h3>
            <p className="text-sm" style={{ color: "var(--texte-3)" }}>
              Ajuste les missions contractualisées puis réinjecte les désignations dans les lignes du devis.
            </p>
          </div>
          <button
            type="button"
            onClick={appliquerPrestationsSelectionnees}
            disabled={missionsSelectionnees.length === 0}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: "var(--c-base)" }}
          >
            <Sparkles size={14} />
            Réinjecter
          </button>
        </div>

        <div className="space-y-3">
          {(assistantQuery.data?.missions ?? []).map((mission) => {
            const selection = missionSelectionnee(mission.code);
            const active = Boolean(selection);
            return (
              <div key={mission.code} className="rounded-xl p-4" style={{ background: active ? "var(--c-leger)" : "var(--fond-entree)", border: `1px solid ${active ? "var(--c-clair)" : "var(--bordure)"}` }}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium" style={{ color: "var(--texte)" }}>{mission.libelle}</p>
                      {mission.est_obligatoire ? <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: "color-mix(in srgb, #f59e0b 18%, var(--fond-carte))", color: "#b45309" }}>Recommandée</span> : null}
                    </div>
                    {mission.description ? <p className="mt-1 text-sm" style={{ color: "var(--texte-3)" }}>{mission.description}</p> : null}
                    <p className="mt-1 text-xs" style={{ color: "var(--texte-3)" }}>
                      {libelleNatureOuvrage(mission.nature_ouvrage)}{mission.phases_concernees.length ? ` · ${mission.phases_concernees.join(", ").toUpperCase()}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => basculerMission(mission.code, mission.libelle, mission.livrables.map((livrable) => ({ code: livrable.code, libelle: livrable.libelle })))}
                    className="rounded-lg px-3 py-2 text-xs font-semibold"
                    style={{ background: active ? "var(--c-base)" : "var(--fond-carte)", color: active ? "#fff" : "var(--texte-2)", border: `1px solid ${active ? "var(--c-base)" : "var(--bordure)"}` }}
                  >
                    {active ? "Retirée" : "Ajouter"}
                  </button>
                </div>

                {mission.livrables.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {mission.livrables.map((livrable) => {
                      const selected = selection?.livrablesCodes.includes(livrable.code) ?? false;
                      return (
                        <button
                          key={livrable.code}
                          type="button"
                          onClick={() => {
                            if (!active) {
                              basculerMission(mission.code, mission.libelle, mission.livrables.map((item) => ({ code: item.code, libelle: item.libelle })));
                              return;
                            }
                            basculerLivrable(mission.code, livrable.code, livrable.libelle);
                          }}
                          className="rounded-lg px-3 py-1.5 text-xs font-medium"
                          style={{ background: selected ? "var(--c-base)" : "var(--fond-carte)", color: selected ? "#fff" : "var(--texte-2)", border: `1px solid ${selected ? "var(--c-base)" : "var(--bordure)"}` }}
                        >
                          {livrable.libelle}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl p-6 space-y-4" style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}>
        <h3 className="font-semibold" style={{ color: "var(--texte)" }}>Informations générales</h3>
        <div>
          <label className="mb-1 block text-xs font-medium" style={{ color: "var(--texte-3)" }}>Intitulé de la mission</label>
          <input type="text" value={form.intitule} onChange={(e) => mettreAJourFormulaire("intitule", e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm" style={stylesChamp} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium" style={{ color: "var(--texte-3)" }}>Objet / contexte</label>
          <textarea value={form.objet} onChange={(e) => mettreAJourFormulaire("objet", e.target.value)} rows={2} className="w-full resize-none rounded-lg px-3 py-2.5 text-sm" style={stylesChamp} />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--texte-3)" }}>Date d&apos;émission</label>
            <input type="date" value={form.date_emission} onChange={(e) => mettreAJourFormulaire("date_emission", e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm" style={stylesChamp} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--texte-3)" }}>Valable jusqu&apos;au</label>
            <input type="date" value={form.date_validite} onChange={(e) => mettreAJourFormulaire("date_validite", e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm" style={stylesChamp} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--texte-3)" }}>TVA</label>
            <select value={form.taux_tva} onChange={(e) => mettreAJourFormulaire("taux_tva", e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm" style={stylesChamp}>
              <option value="0.20">20 %</option>
              <option value="0.10">10 %</option>
              <option value="0.055">5,5 %</option>
              <option value="0.00">Exonéré (0 %)</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--texte-3)" }}>Acompte (%)</label>
            <input type="number" value={form.acompte_pct} onChange={(e) => mettreAJourFormulaire("acompte_pct", e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm" style={stylesChamp} />
          </div>
        </div>
      </section>

      <section className="rounded-xl p-6 space-y-4" style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}>
        <h3 className="font-semibold" style={{ color: "var(--texte)" }}>Client destinataire</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--texte-3)" }}>Nom du client</label>
            <input type="text" value={form.client_nom} onChange={(e) => mettreAJourFormulaire("client_nom", e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm" style={stylesChamp} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--texte-3)" }}>Interlocuteur</label>
            <input type="text" value={form.client_contact} onChange={(e) => mettreAJourFormulaire("client_contact", e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm" style={stylesChamp} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--texte-3)" }}>Email</label>
            <input type="email" value={form.client_email} onChange={(e) => mettreAJourFormulaire("client_email", e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm" style={stylesChamp} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--texte-3)" }}>Téléphone</label>
            <input type="tel" value={form.client_telephone} onChange={(e) => mettreAJourFormulaire("client_telephone", e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm" style={stylesChamp} />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--texte-3)" }}>Adresse</label>
            <textarea value={form.client_adresse} onChange={(e) => mettreAJourFormulaire("client_adresse", e.target.value)} rows={2} className="w-full resize-none rounded-lg px-3 py-2.5 text-sm" style={stylesChamp} />
          </div>
        </div>
      </section>

      <section className="rounded-xl p-6 space-y-4" style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold" style={{ color: "var(--texte)" }}>Prestations</h3>
          <button type="button" onClick={ajouterLigne} className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium" style={{ background: "var(--c-clair)", color: "var(--c-base)", border: "1px solid var(--c-leger)" }}>
            <Plus size={12} />
            Ajouter une ligne
          </button>
        </div>

        <div className="space-y-3">
          {lignes.map((ligne, index) => (
            <div key={`${ligne.id || "new"}-${index}`} className="space-y-3 rounded-xl p-4" style={{ background: "var(--fond-entree)", border: "1px solid var(--bordure)" }}>
              <div className="grid grid-cols-12 gap-3 items-start">
                <div className="col-span-12 md:col-span-2">
                  <label className="mb-1 block text-xs" style={{ color: "var(--texte-3)" }}>Type</label>
                  <select value={ligne.type_ligne} onChange={(e) => mettreAJourLigne(index, "type_ligne", e.target.value)} className="w-full rounded-lg px-2 py-2 text-xs" style={stylesChamp}>
                    <option value="horaire">Horaire</option>
                    <option value="forfait">Forfait</option>
                    <option value="frais">Frais</option>
                  </select>
                </div>
                <div className="col-span-12 md:col-span-7">
                  <label className="mb-1 block text-xs" style={{ color: "var(--texte-3)" }}>Désignation</label>
                  <input type="text" value={ligne.intitule} onChange={(e) => mettreAJourLigne(index, "intitule", e.target.value)} className="w-full rounded-lg px-2 py-2 text-sm" style={stylesChamp} />
                </div>
                <div className="col-span-10 md:col-span-2">
                  <label className="mb-1 block text-xs" style={{ color: "var(--texte-3)" }}>Phase</label>
                  <input type="text" value={ligne.phase_code} onChange={(e) => mettreAJourLigne(index, "phase_code", e.target.value)} className="w-full rounded-lg px-2 py-2 text-sm" style={stylesChamp} />
                </div>
                <div className="col-span-2 md:col-span-1 flex items-end justify-end">
                  <button type="button" onClick={() => supprimerLigne(index)} className="rounded-lg p-2" style={{ color: "#ef4444" }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <textarea value={ligne.description} onChange={(e) => mettreAJourLigne(index, "description", e.target.value)} rows={2} className="w-full resize-none rounded-lg px-2 py-2 text-sm" style={stylesChamp} placeholder="Description détaillée de la prestation" />

              {ligne.type_ligne === "horaire" ? (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs" style={{ color: "var(--texte-3)" }}>Profil</label>
                    <select value={ligne.profil} onChange={(e) => mettreAJourLigne(index, "profil", e.target.value)} className="w-full rounded-lg px-2 py-2 text-xs" style={stylesChamp}>
                      <option value="">Sélectionner</option>
                      {profils.map((profil) => (
                        <option key={profil.id} value={profil.id}>{profil.libelle}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs" style={{ color: "var(--texte-3)" }}>Heures</label>
                    <input type="number" value={ligne.nb_heures} onChange={(e) => mettreAJourLigne(index, "nb_heures", e.target.value)} className="w-full rounded-lg px-2 py-2 text-sm" style={stylesChamp} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs" style={{ color: "var(--texte-3)" }}>Taux horaire HT</label>
                    <input type="number" value={ligne.taux_horaire} onChange={(e) => mettreAJourLigne(index, "taux_horaire", e.target.value)} className="w-full rounded-lg px-2 py-2 text-sm" style={stylesChamp} />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs" style={{ color: "var(--texte-3)" }}>Quantité</label>
                    <input type="number" value={ligne.quantite} onChange={(e) => mettreAJourLigne(index, "quantite", e.target.value)} className="w-full rounded-lg px-2 py-2 text-sm" style={stylesChamp} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs" style={{ color: "var(--texte-3)" }}>Unité</label>
                    <input type="text" value={ligne.unite} onChange={(e) => mettreAJourLigne(index, "unite", e.target.value)} className="w-full rounded-lg px-2 py-2 text-sm" style={stylesChamp} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs" style={{ color: "var(--texte-3)" }}>Montant unitaire HT</label>
                    <input type="number" value={ligne.montant_unitaire_ht} onChange={(e) => mettreAJourLigne(index, "montant_unitaire_ht", e.target.value)} className="w-full rounded-lg px-2 py-2 text-sm" style={stylesChamp} />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="space-y-2 rounded-xl px-4 py-4" style={{ background: "var(--fond-entree)", border: "1px solid var(--bordure)" }}>
          <div className="flex justify-between text-sm">
            <span style={{ color: "var(--texte-3)" }}>Total HT</span>
            <span className="font-mono" style={{ color: "var(--texte)" }}>{totalHT.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</span>
          </div>
          <div className="flex justify-between text-sm">
            <span style={{ color: "var(--texte-3)" }}>TVA</span>
            <span className="font-mono" style={{ color: "var(--texte-2)" }}>{totalTVA.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</span>
          </div>
          <div className="flex justify-between border-t pt-2 text-base font-bold" style={{ borderColor: "var(--bordure)" }}>
            <span style={{ color: "var(--texte)" }}>Total TTC</span>
            <span className="font-mono" style={{ color: "var(--c-base)" }}>{totalTTC.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</span>
          </div>
        </div>
      </section>

      <div className="flex items-center gap-3 pb-6">
        <button type="button" onClick={soumettre} disabled={enCours} className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-white disabled:opacity-60" style={{ background: "var(--c-base)" }}>
          <Save size={15} />
          {enCours ? "Enregistrement…" : "Enregistrer les modifications"}
        </button>
        <button type="button" onClick={() => router.back()} className="rounded-xl border px-5 py-3 text-sm font-medium" style={{ borderColor: "var(--bordure)", color: "var(--texte-2)" }}>
          Annuler
        </button>
      </div>
    </div>
  );
}
