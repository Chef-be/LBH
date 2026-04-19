"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ErreurApi, extraireListeResultats } from "@/crochets/useApi";
import { ChampOrganisationRapide, type OrganisationOption } from "@/composants/projets/ChampOrganisationRapide";

interface ReferentielOption {
  id: string;
  code: string;
  libelle: string;
  description: string;
}

interface ModeVariationPrix {
  type_evolution: string;
  cadre_juridique: string;
  indice_reference: string;
  formule_personnalisee: string;
  date_prix_initial?: string;
  date_remise_offre?: string;
  date_demarrage?: string;
  periodicite_revision?: string;
  clause_applicable?: string;
  part_fixe?: string;
}

interface ReferenceIndexPrix {
  code: string;
  libelle: string;
  type_index: string;
  territoire: string;
  periodicite: string;
  base_reference: string;
  derniere_valeur: {
    date_valeur: string;
    valeur: number;
    source_publication_url: string;
    source_donnees_url: string;
  } | null;
}

interface ParcoursProjet {
  referentiels: {
    familles_client: ReferentielOption[];
    sous_types_client: ReferentielOption[];
    contextes_contractuels: ReferentielOption[];
    missions_principales: ReferentielOption[];
    sous_missions: ReferentielOption[];
    phases_intervention: ReferentielOption[];
  };
  champs_dynamiques: Array<{
    groupe: string;
    champs: Array<{
      code: string;
      libelle: string;
      type_champ: "texte" | "texte_long" | "selection" | "multi_selection" | "nombre" | "montant" | "date" | "booleen";
      options: Array<{ value: string; label: string }>;
      obligatoire: boolean;
      placeholder: string;
      aide_courte: string;
      section: string;
    }>;
  }>;
}

interface ProjetDetail {
  id: string;
  reference: string;
  intitule: string;
  type_projet: string;
  type_projet_autre: string;
  statut: string;
  organisation: string | null;
  maitre_ouvrage: string | null;
  maitre_oeuvre: string | null;
  commune?: string;
  departement?: string;
  montant_estime?: number | null;
  montant_marche?: number | null;
  honoraires_prevus?: number | null;
  date_debut_prevue?: string | null;
  date_fin_prevue?: string | null;
  description?: string;
  contexte_projet: {
    famille_client: ReferentielOption;
    sous_type_client: ReferentielOption;
    contexte_contractuel: ReferentielOption;
    mission_principale: ReferentielOption;
    phase_intervention: ReferentielOption | null;
    nature_marche: string;
    partie_contractante: string;
    role_lbh: string;
    methode_estimation: string;
    donnees_entree: Record<string, string | string[] | boolean>;
    sous_missions: ReferentielOption[];
  } | null;
  mode_variation_prix: {
    type_evolution: string;
    cadre_juridique: string;
    indice_reference: string;
    formule_personnalisee: string;
    date_prix_initial?: string | null;
    date_remise_offre?: string | null;
    date_demarrage?: string | null;
    periodicite_revision?: string;
    clause_applicable?: string;
    part_fixe?: string | null;
    reference_officielle?: {
      code: string;
      libelle: string;
      territoire: string;
      date_valeur: string;
      valeur: number;
      source_publication_url: string;
      source_donnees_url: string;
    } | null;
  } | null;
}

export function FormulaireModifierProjet({ projetId }: { projetId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [intitule, setIntitule] = useState("");
  const [typeProjet, setTypeProjet] = useState("etude");
  const [typeProjetAutre, setTypeProjetAutre] = useState("");
  const [statut, setStatut] = useState("en_cours");
  const [organisationId, setOrganisationId] = useState("");
  const [maitreOuvrageId, setMaitreOuvrageId] = useState("");
  const [maitreOeuvreId, setMaitreOeuvreId] = useState("");
  const [familleClientId, setFamilleClientId] = useState("");
  const [sousTypeClientId, setSousTypeClientId] = useState("");
  const [contexteContractuelId, setContexteContractuelId] = useState("");
  const [missionPrincipaleId, setMissionPrincipaleId] = useState("");
  const [phaseInterventionId, setPhaseInterventionId] = useState("");
  const [natureMarche, setNatureMarche] = useState("public");
  const [partieContractante, setPartieContractante] = useState("");
  const [roleLbh, setRoleLbh] = useState("");
  const [methodeEstimation, setMethodeEstimation] = useState("");
  const [sousMissionsSelectionnees, setSousMissionsSelectionnees] = useState<string[]>([]);
  const [donneesEntree, setDonneesEntree] = useState<Record<string, string | string[] | boolean>>({});
  const [commune, setCommune] = useState("");
  const [departement, setDepartement] = useState("");
  const [montantEstime, setMontantEstime] = useState("");
  const [montantMarche, setMontantMarche] = useState("");
  const [honorairesPrevus, setHonorairesPrevus] = useState("");
  const [dateDebutPrevue, setDateDebutPrevue] = useState("");
  const [dateFinPrevue, setDateFinPrevue] = useState("");
  const [description, setDescription] = useState("");

  const [variationPrix, setVariationPrix] = useState<ModeVariationPrix>({
    type_evolution: "aucune",
    cadre_juridique: "public",
    indice_reference: "",
    formule_personnalisee: "",
    date_prix_initial: "",
    date_remise_offre: "",
    date_demarrage: "",
    periodicite_revision: "",
    clause_applicable: "",
    part_fixe: "",
  });

  const { data: projet, isLoading } = useQuery<ProjetDetail>({
    queryKey: ["projet", projetId],
    queryFn: () => api.get<ProjetDetail>(`/api/projets/${projetId}/`),
  });

  const { data: organisations = [] } = useQuery<OrganisationOption[]>({
    queryKey: ["organisations"],
    queryFn: () => api.get<OrganisationOption[]>("/api/organisations/"),
    select: (data) => extraireListeResultats(data),
  });

  const { data: referencesIndicesPrix = [] } = useQuery<ReferenceIndexPrix[]>({
    queryKey: ["projets-indices-prix-references"],
    queryFn: () => api.get<ReferenceIndexPrix[]>("/api/projets/indices-prix/references/?limite=140"),
  });

  const organisationsTriees = useMemo(
    () => [...organisations].sort((a, b) => a.nom.localeCompare(b.nom, "fr")),
    [organisations]
  );

  const referenceIndexSelectionnee = useMemo(
    () => referencesIndicesPrix.find((item) => item.code === variationPrix.indice_reference.trim().toUpperCase()) || null,
    [referencesIndicesPrix, variationPrix.indice_reference]
  );

  const { data: parcours } = useQuery<ParcoursProjet>({
    queryKey: ["projets-parcours-edition", familleClientId, sousTypeClientId, contexteContractuelId, missionPrincipaleId, phaseInterventionId],
    queryFn: () =>
      api.get<ParcoursProjet>(
        `/api/projets/parcours/?famille_client=${encodeURIComponent(familleClientId)}&sous_type_client=${encodeURIComponent(sousTypeClientId)}&contexte_contractuel=${encodeURIComponent(contexteContractuelId)}&mission_principale=${encodeURIComponent(missionPrincipaleId)}&phase_intervention=${encodeURIComponent(phaseInterventionId)}`
      ),
    enabled: Boolean(projet),
  });

  useEffect(() => {
    if (!projet) return;
    setIntitule(projet.intitule);
    setTypeProjet(projet.type_projet);
    setTypeProjetAutre(projet.type_projet_autre || "");
    setStatut(projet.statut);
    setOrganisationId(projet.organisation || "");
    setMaitreOuvrageId(projet.maitre_ouvrage || "");
    setMaitreOeuvreId(projet.maitre_oeuvre || "");
    setFamilleClientId(projet.contexte_projet?.famille_client.id || "");
    setSousTypeClientId(projet.contexte_projet?.sous_type_client.id || "");
    setContexteContractuelId(projet.contexte_projet?.contexte_contractuel.id || "");
    setMissionPrincipaleId(projet.contexte_projet?.mission_principale.id || "");
    setPhaseInterventionId(projet.contexte_projet?.phase_intervention?.id || "");
    setNatureMarche(projet.contexte_projet?.nature_marche || "public");
    setCommune(projet.commune || "");
    setDepartement(projet.departement || "");
    setMontantEstime(projet.montant_estime?.toString() || "");
    setMontantMarche(projet.montant_marche?.toString() || "");
    setHonorairesPrevus(projet.honoraires_prevus?.toString() || "");
    setDateDebutPrevue(projet.date_debut_prevue || "");
    setDateFinPrevue(projet.date_fin_prevue || "");
    setDescription(projet.description || "");
    setPartieContractante(projet.contexte_projet?.partie_contractante || "");
    setRoleLbh(projet.contexte_projet?.role_lbh || "");
    setMethodeEstimation(projet.contexte_projet?.methode_estimation || "");
    setSousMissionsSelectionnees((projet.contexte_projet?.sous_missions || []).map((item) => item.id));
    setDonneesEntree(projet.contexte_projet?.donnees_entree || {});
    if (projet.mode_variation_prix) {
      setVariationPrix({
        type_evolution: projet.mode_variation_prix.type_evolution,
        cadre_juridique: projet.mode_variation_prix.cadre_juridique,
        indice_reference: projet.mode_variation_prix.indice_reference,
        formule_personnalisee: projet.mode_variation_prix.formule_personnalisee,
        date_prix_initial: projet.mode_variation_prix.date_prix_initial || "",
        date_remise_offre: projet.mode_variation_prix.date_remise_offre || "",
        date_demarrage: projet.mode_variation_prix.date_demarrage || "",
        periodicite_revision: projet.mode_variation_prix.periodicite_revision || "",
        clause_applicable: projet.mode_variation_prix.clause_applicable || "",
        part_fixe: projet.mode_variation_prix.part_fixe || "",
      });
    }
  }, [projet]);

  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.patch(`/api/projets/${projetId}/`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projet", projetId] });
      router.push(`/projets/${projetId}`);
    },
    onError: (err) => {
      if (err instanceof ErreurApi && err.erreurs) {
        const nouvellesErreurs: Record<string, string> = {};
        Object.entries(err.erreurs).forEach(([champ, messages]) => {
          if (Array.isArray(messages)) nouvellesErreurs[champ] = messages[0];
        });
        setErreurs(nouvellesErreurs);
      }
    },
  });

  if (isLoading || !projet) {
    return <div className="py-12 text-center text-sm text-slate-400">Chargement…</div>;
  }

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        setErreurs({});
        mutation.mutate({
          intitule,
          type_projet: typeProjet,
          type_projet_autre: typeProjet === "autre" ? typeProjetAutre : "",
          statut,
          organisation: organisationId || null,
          maitre_ouvrage: maitreOuvrageId || null,
          maitre_oeuvre: maitreOeuvreId || null,
          commune: commune || null,
          departement: departement || null,
          montant_estime: montantEstime ? parseFloat(montantEstime.replace(/\s/g, "").replace(",", ".")) : null,
          montant_marche: montantMarche ? parseFloat(montantMarche.replace(/\s/g, "").replace(",", ".")) : null,
          honoraires_prevus: honorairesPrevus ? parseFloat(honorairesPrevus.replace(/\s/g, "").replace(",", ".")) : null,
          date_debut_prevue: dateDebutPrevue || null,
          date_fin_prevue: dateFinPrevue || null,
          description: description || "",
          contexte_projet_saisie: {
            famille_client: familleClientId,
            sous_type_client: sousTypeClientId,
            contexte_contractuel: contexteContractuelId,
            mission_principale: missionPrincipaleId,
            phase_intervention: phaseInterventionId || null,
            sous_missions: sousMissionsSelectionnees,
            nature_marche: natureMarche,
            partie_contractante: partieContractante,
            role_lbh: roleLbh,
            methode_estimation: methodeEstimation,
            donnees_entree: donneesEntree,
            trace_preremplissage: {},
          },
          mode_variation_prix_saisie: variationPrix,
        });
      }}
    >
      <div className="carte space-y-4">
        <div className="flex items-center gap-3">
          <span className="rounded bg-slate-100 px-3 py-2 font-mono text-sm text-slate-500">{projet.reference}</span>
          <p className="text-xs text-slate-400">La référence reste figée.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="libelle-champ" htmlFor="type-projet">Type de projet</label>
            <select id="type-projet" className="champ-saisie" value={typeProjet} onChange={(e) => setTypeProjet(e.target.value)}>
              <option value="etude">Étude</option>
              <option value="travaux">Travaux</option>
              <option value="mission_moe">Mission maîtrise d&apos;œuvre</option>
              <option value="assistance">Assistance</option>
              <option value="expertise">Expertise</option>
              <option value="autre">Autre</option>
            </select>
          </div>
          <div>
            <label className="libelle-champ" htmlFor="statut">Statut</label>
            <select id="statut" className="champ-saisie" value={statut} onChange={(e) => setStatut(e.target.value)}>
              <option value="prospection">Prospection</option>
              <option value="en_cours">En cours</option>
              <option value="suspendu">Suspendu</option>
              <option value="termine">Terminé</option>
              <option value="abandonne">Abandonné</option>
              <option value="archive">Archivé</option>
            </select>
          </div>
          <div>
            <label className="libelle-champ" htmlFor="nature-marche">Nature public / privé</label>
            <select id="nature-marche" className="champ-saisie" value={natureMarche} onChange={(e) => setNatureMarche(e.target.value)}>
              <option value="public">Marché public</option>
              <option value="prive">Marché privé</option>
              <option value="mixte">Contexte mixte</option>
              <option value="autre">Autre</option>
            </select>
          </div>
        </div>

        <div>
          <label className="libelle-champ" htmlFor="intitule">Intitulé</label>
          <input id="intitule" className="champ-saisie" value={intitule} onChange={(e) => setIntitule(e.target.value)} />
          {erreurs.intitule && <p className="mt-1 text-xs text-red-500">{erreurs.intitule}</p>}
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="libelle-champ" htmlFor="montant-estime">Budget estimé HT (€)</label>
            <input id="montant-estime" className="champ-saisie" type="text" inputMode="decimal"
              value={montantEstime} onChange={(e) => setMontantEstime(e.target.value)} placeholder="Ex : 500000" />
          </div>
          <div>
            <label className="libelle-champ" htmlFor="montant-marche">Montant du marché HT (€)</label>
            <input id="montant-marche" className="champ-saisie" type="text" inputMode="decimal"
              value={montantMarche} onChange={(e) => setMontantMarche(e.target.value)} placeholder="Ex : 480000" />
          </div>
          <div>
            <label className="libelle-champ" htmlFor="honoraires-prevus">Honoraires prévus HT (€)</label>
            <input id="honoraires-prevus" className="champ-saisie" type="text" inputMode="decimal"
              value={honorairesPrevus} onChange={(e) => setHonorairesPrevus(e.target.value)} placeholder="Ex : 18000" />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="libelle-champ" htmlFor="date-debut">Date de début prévue</label>
            <input id="date-debut" type="date" className="champ-saisie"
              value={dateDebutPrevue} onChange={(e) => setDateDebutPrevue(e.target.value)} />
          </div>
          <div>
            <label className="libelle-champ" htmlFor="date-fin">Date de fin prévue</label>
            <input id="date-fin" type="date" className="champ-saisie"
              value={dateFinPrevue} onChange={(e) => setDateFinPrevue(e.target.value)} />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="libelle-champ" htmlFor="commune">Commune</label>
            <input id="commune" className="champ-saisie" value={commune} onChange={(e) => setCommune(e.target.value)} placeholder="Lyon" />
          </div>
          <div>
            <label className="libelle-champ" htmlFor="departement">Département</label>
            <input id="departement" className="champ-saisie" value={departement} onChange={(e) => setDepartement(e.target.value)} placeholder="69" />
          </div>
        </div>

        <div>
          <label className="libelle-champ" htmlFor="description">Description</label>
          <textarea id="description" className="champ-saisie min-h-24"
            value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <ChampOrganisationRapide
            label="Bureau d'études"
            name="organisation"
            placeholder="Sélectionner le bureau d'études"
            typeOrganisation="bureau_etudes"
            organisations={organisationsTriees}
            value={organisationId}
            onChange={setOrganisationId}
          />
          <div>
            <label className="libelle-champ" htmlFor="famille-client">Famille de client</label>
            <select id="famille-client" className="champ-saisie" value={familleClientId} onChange={(e) => setFamilleClientId(e.target.value)}>
              <option value="">Sélectionner</option>
              {parcours?.referentiels.familles_client.map((option) => (
                <option key={option.id} value={option.id}>{option.libelle}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="libelle-champ" htmlFor="sous-type-client">Sous-type de client</label>
            <select id="sous-type-client" className="champ-saisie" value={sousTypeClientId} onChange={(e) => setSousTypeClientId(e.target.value)}>
              <option value="">Sélectionner</option>
              {parcours?.referentiels.sous_types_client.map((option) => (
                <option key={option.id} value={option.id}>{option.libelle}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="libelle-champ" htmlFor="contexte-contractuel">Contexte contractuel</label>
            <select id="contexte-contractuel" className="champ-saisie" value={contexteContractuelId} onChange={(e) => setContexteContractuelId(e.target.value)}>
              <option value="">Sélectionner</option>
              {parcours?.referentiels.contextes_contractuels.map((option) => (
                <option key={option.id} value={option.id}>{option.libelle}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="libelle-champ" htmlFor="mission-principale">Mission principale</label>
            <select id="mission-principale" className="champ-saisie" value={missionPrincipaleId} onChange={(e) => setMissionPrincipaleId(e.target.value)}>
              <option value="">Sélectionner</option>
              {parcours?.referentiels.missions_principales.map((option) => (
                <option key={option.id} value={option.id}>{option.libelle}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <ChampOrganisationRapide
            label="Maître d'ouvrage"
            name="maitre_ouvrage"
            placeholder="Sélectionner le maître d'ouvrage"
            typeOrganisation="maitre_ouvrage"
            organisations={organisationsTriees}
            value={maitreOuvrageId}
            onChange={setMaitreOuvrageId}
          />
          <ChampOrganisationRapide
            label="Maître d'œuvre / partenaire"
            name="maitre_oeuvre"
            placeholder="Sélectionner le maître d'œuvre"
            typeOrganisation="partenaire"
            organisations={organisationsTriees}
            value={maitreOeuvreId}
            onChange={setMaitreOeuvreId}
          />
        </div>
      </div>

      {parcours?.champs_dynamiques.map((groupe) => (
        <div key={groupe.groupe} className="carte space-y-4">
          <h2>{groupe.champs[0]?.section || groupe.groupe}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {groupe.champs.map((champ) => (
              <div key={champ.code}>
                <label className="libelle-champ" htmlFor={champ.code}>{champ.libelle}</label>
                {champ.type_champ === "texte_long" ? (
                  <textarea
                    id={champ.code}
                    className="champ-saisie min-h-28"
                    value={typeof donneesEntree[champ.code] === "string" ? String(donneesEntree[champ.code]) : ""}
                    onChange={(e) => setDonneesEntree((courant) => ({ ...courant, [champ.code]: e.target.value }))}
                  />
                ) : champ.type_champ === "selection" ? (
                  <select
                    id={champ.code}
                    className="champ-saisie"
                    value={typeof donneesEntree[champ.code] === "string" ? String(donneesEntree[champ.code]) : ""}
                    onChange={(e) => setDonneesEntree((courant) => ({ ...courant, [champ.code]: e.target.value }))}
                  >
                    <option value="">Sélectionner</option>
                    {champ.options.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={champ.code}
                    type={champ.type_champ === "date" ? "date" : "text"}
                    className="champ-saisie"
                    placeholder={champ.placeholder}
                    value={typeof donneesEntree[champ.code] === "string" ? String(donneesEntree[champ.code]) : ""}
                    onChange={(e) => setDonneesEntree((courant) => ({ ...courant, [champ.code]: e.target.value }))}
                  />
                )}
                {champ.aide_courte && <p className="mt-1 text-xs text-slate-500">{champ.aide_courte}</p>}
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="carte space-y-4">
        <h2>Variation de prix</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="libelle-champ" htmlFor="type-evolution">Type d&apos;évolution</label>
            <select id="type-evolution" className="champ-saisie" value={variationPrix.type_evolution} onChange={(e) => setVariationPrix((courant) => ({ ...courant, type_evolution: e.target.value }))}>
              <option value="aucune">Aucune</option>
              <option value="actualisation">Actualisation</option>
              <option value="revision">Révision</option>
            </select>
          </div>
          {variationPrix.type_evolution !== "aucune" ? (
            <div>
              <label className="libelle-champ" htmlFor="cadre-juridique">Cadre juridique</label>
              <select id="cadre-juridique" className="champ-saisie" value={variationPrix.cadre_juridique} onChange={(e) => setVariationPrix((courant) => ({ ...courant, cadre_juridique: e.target.value }))}>
                <option value="public">Marché public</option>
                <option value="prive">Marché privé</option>
              </select>
            </div>
          ) : null}
          {variationPrix.type_evolution !== "aucune" ? (
            <div>
              <label className="libelle-champ" htmlFor="indice-reference">Indice / index</label>
              <input id="indice-reference" list="indices-prix-options" className="champ-saisie" value={variationPrix.indice_reference} onChange={(e) => setVariationPrix((courant) => ({ ...courant, indice_reference: e.target.value.toUpperCase() }))} placeholder="BT01, BT45, TP02, BTM01, TPM01…" />
              <datalist id="indices-prix-options">
                {referencesIndicesPrix.map((item) => (
                  <option key={item.code} value={item.code}>
                    {`${item.code} — ${item.libelle} (${item.territoire})`}
                  </option>
                ))}
              </datalist>
              {referenceIndexSelectionnee?.derniere_valeur ? (
                <p className="mt-2 text-xs text-slate-500">
                  {referenceIndexSelectionnee.libelle} · {referenceIndexSelectionnee.territoire} · dernière valeur officielle {referenceIndexSelectionnee.derniere_valeur.valeur} au {new Date(referenceIndexSelectionnee.derniere_valeur.date_valeur).toLocaleDateString("fr-FR")}
                </p>
              ) : null}
            </div>
          ) : null}
          {variationPrix.type_evolution !== "aucune" ? (
            <div>
              <label className="libelle-champ" htmlFor="date-prix-initial">Date du prix initial</label>
              <input id="date-prix-initial" type="date" className="champ-saisie" value={variationPrix.date_prix_initial || ""} onChange={(e) => setVariationPrix((courant) => ({ ...courant, date_prix_initial: e.target.value }))} />
            </div>
          ) : null}
          {variationPrix.type_evolution !== "aucune" ? (
            <div>
              <label className="libelle-champ" htmlFor="date-remise-offre">Date de remise d&apos;offre</label>
              <input id="date-remise-offre" type="date" className="champ-saisie" value={variationPrix.date_remise_offre || ""} onChange={(e) => setVariationPrix((courant) => ({ ...courant, date_remise_offre: e.target.value }))} />
            </div>
          ) : null}
          {variationPrix.type_evolution !== "aucune" ? (
            <div>
              <label className="libelle-champ" htmlFor="date-demarrage">Date de démarrage</label>
              <input id="date-demarrage" type="date" className="champ-saisie" value={variationPrix.date_demarrage || ""} onChange={(e) => setVariationPrix((courant) => ({ ...courant, date_demarrage: e.target.value }))} />
            </div>
          ) : null}
          {variationPrix.type_evolution === "revision" ? (
            <div>
              <label className="libelle-champ" htmlFor="periodicite-revision">Périodicité</label>
              <select id="periodicite-revision" className="champ-saisie" value={variationPrix.periodicite_revision || ""} onChange={(e) => setVariationPrix((courant) => ({ ...courant, periodicite_revision: e.target.value }))}>
                <option value="">Sélectionner</option>
                <option value="mensuelle">Mensuelle</option>
                <option value="trimestrielle">Trimestrielle</option>
                <option value="semestrielle">Semestrielle</option>
                <option value="annuelle">Annuelle</option>
                <option value="ponctuelle">Ponctuelle</option>
              </select>
            </div>
          ) : null}
          {variationPrix.type_evolution !== "aucune" ? (
            <div>
              <label className="libelle-champ" htmlFor="part-fixe">Part fixe (%)</label>
              <input id="part-fixe" className="champ-saisie" value={variationPrix.part_fixe || ""} onChange={(e) => setVariationPrix((courant) => ({ ...courant, part_fixe: e.target.value }))} />
            </div>
          ) : null}
          {variationPrix.type_evolution !== "aucune" ? (
            <div className="md:col-span-3">
              <label className="libelle-champ" htmlFor="clause-applicable">Clause applicable</label>
              <textarea id="clause-applicable" className="champ-saisie min-h-24" value={variationPrix.clause_applicable || ""} onChange={(e) => setVariationPrix((courant) => ({ ...courant, clause_applicable: e.target.value }))} />
            </div>
          ) : null}
          {variationPrix.type_evolution === "revision" ? (
            <div className="md:col-span-3">
              <label className="libelle-champ" htmlFor="formule-personnalisee">Formule personnalisée</label>
              <input id="formule-personnalisee" className="champ-saisie" value={variationPrix.formule_personnalisee || ""} onChange={(e) => setVariationPrix((courant) => ({ ...courant, formule_personnalisee: e.target.value }))} placeholder="Exemple: 0.15 + 0.85 * (index_actuel / index_initial)" />
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <button type="button" className="btn-secondaire" onClick={() => router.push(`/projets/${projetId}`)}>
          Annuler
        </button>
        <button type="submit" className="btn-primaire" disabled={mutation.isPending}>
          {mutation.isPending ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    </form>
  );
}
