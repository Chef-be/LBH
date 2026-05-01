"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  BookOpen,
  CheckCircle,
  Download,
  Euro,
  FileText,
  PackageOpen,
  Pencil,
  Plus,
  Save,
  Send,
  Sparkles,
  ShoppingCart,
  Trash2,
  X,
} from "lucide-react";
import { api, ErreurApi, extraireListeResultats } from "@/crochets/useApi";

type ValeurNumerique = number | string | null;

interface LignePrixEtude {
  id: string;
  ordre: number;
  type_ressource: string;
  type_libelle: string;
  code: string;
  designation: string;
  unite: string;
  quantite: ValeurNumerique;
  cout_unitaire_ht: ValeurNumerique;
  montant_ht: ValeurNumerique;
  profil_main_oeuvre: string | null;
  profil_main_oeuvre_code: string | null;
  profil_main_oeuvre_libelle: string | null;
  nombre_ressources: ValeurNumerique;
  temps_unitaire: ValeurNumerique;
  taux_horaire: ValeurNumerique;
  observations: string;
}

interface AchatEtudePrix {
  id: string;
  ligne_source: string | null;
  ligne_source_designation: string | null;
  ordre: number;
  designation: string;
  fournisseur: string;
  reference_fournisseur: string;
  unite_achat: string;
  quantite_besoin: ValeurNumerique;
  quantite_conditionnement: ValeurNumerique;
  nombre_conditionnements: ValeurNumerique;
  quantite_commandee: ValeurNumerique;
  prix_unitaire_achat_ht: ValeurNumerique;
  cout_total_achat_ht: ValeurNumerique;
  surcout_conditionnement_ht: ValeurNumerique;
  observations: string;
}

interface ProfilMainOeuvreOption {
  id: string;
  code: string;
  libelle: string;
  categorie_libelle: string;
  secteur_activite_libelle: string;
  niveau_classification: string;
  fonction_equipe: string;
  taux_horaire_recommande_defaut: number | null;
}

interface EtudePrixDetail {
  id: string;
  code: string;
  intitule: string;
  description: string;
  methode: string;
  methode_libelle: string;
  lot_type: string;
  lot_libelle: string;
  millesime: number;
  zone_taux_horaire: string;
  taux_horaire_mo: ValeurNumerique;
  taux_frais_chantier: ValeurNumerique;
  taux_frais_generaux: ValeurNumerique;
  taux_aleas: ValeurNumerique;
  taux_marge_cible: ValeurNumerique;
  projet: string | null;
  projet_reference: string | null;
  organisation: string | null;
  organisation_nom: string | null;
  hypotheses: string;
  observations: string;
  statut: string;
  statut_libelle: string;
  date_etude: string | null;
  date_validation: string | null;
  auteur_nom: string | null;
  total_mo_ht: ValeurNumerique;
  total_matieres_ht: ValeurNumerique;
  total_materiel_ht: ValeurNumerique;
  total_sous_traitance_ht: ValeurNumerique;
  total_transport_ht: ValeurNumerique;
  total_frais_divers_ht: ValeurNumerique;
  debourse_sec_ht: ValeurNumerique;
  montant_frais_chantier_ht: ValeurNumerique;
  montant_frais_generaux_ht: ValeurNumerique;
  montant_aleas_ht: ValeurNumerique;
  cout_revient_ht: ValeurNumerique;
  marge_previsionnelle_ht: ValeurNumerique;
  prix_vente_ht: ValeurNumerique;
  coefficient_k: ValeurNumerique;
  seuil_rentabilite_ht: ValeurNumerique;
  ligne_bibliotheque: string | null;
  ligne_bibliotheque_code: string | null;
  lignes: LignePrixEtude[];
  achats: AchatEtudePrix[];
}

interface AssistantEtudePrix {
  clientele: { code: string; libelle: string } | string;
  objectif: { code: string; libelle: string } | string;
  resume?: string;
  questions: { question: string; type?: string; reponses?: string[] }[];
  methodes_recommandees: { code: string; libelle: string; objectif: string }[];
  livrables_recommandes: string[];
  indicateurs_prioritaires: string[];
  points_vigilance: string[];
  postes_sensibles: { id: string; designation: string; type_ressource: string; montant_ht: number }[];
  couverture_analytique: number;
  achats_prepares: number;
  sous_detail_disponible: boolean;
}

interface ProjetSimilaire {
  id: string;
  reference: string;
  intitule: string;
  type_projet: string;
  clientele_cible: string;
  objectif_mission: string;
  phase_actuelle: string;
  commune: string;
  departement: string;
  surface_reference: ValeurNumerique;
  montant_reference: ValeurNumerique;
  score_similarite: ValeurNumerique;
}

interface ComparatifEtudePrix {
  profil_projet: {
    reference: string;
    intitule: string;
    surface_reference: ValeurNumerique;
    montant_reference: ValeurNumerique;
    montant_metres_ht: ValeurNumerique;
    nombre_lignes_metre: ValeurNumerique;
    nombre_metres: ValeurNumerique;
    nombre_programmes_batiment: ValeurNumerique;
    total_quantites_metrees: ValeurNumerique;
    types_batiment: string[];
    types_operation_batiment: string[];
    categories_locaux: string[];
  };
  projets_similaires: ProjetSimilaire[];
  taux_similarite_moyen: ValeurNumerique;
  estimation_ratio_ht: ValeurNumerique;
  estimation_rex_ht: ValeurNumerique;
  estimation_analytique_ht: ValeurNumerique;
  ecart_ratio_vs_analytique_ht: ValeurNumerique;
  ecart_rex_vs_analytique_ht: ValeurNumerique;
  alertes: string[];
}

interface AuditMoteurPrix {
  statut: string;
  niveau_confiance: string;
  score_confiance: ValeurNumerique;
  score_coherence: ValeurNumerique;
  strategie_principale: string;
  valeurs: Record<string, ValeurNumerique | string | Record<string, unknown> | unknown[]>;
  hypotheses: { code?: string; libelle: string; source?: string; niveau_confiance?: ValeurNumerique; raison?: string }[];
  verifications: { type: string; statut: string; message: string }[];
  alertes: string[];
  erreurs: string[];
  corrections_proposees: { champ: string; valeur_actuelle: unknown; valeur_proposee: unknown; raison: string; niveau_risque?: string }[];
  justification: string;
}

const STATUTS_CSS: Record<string, string> = {
  brouillon: "badge-neutre",
  en_cours: "badge-info",
  a_valider: "badge-alerte",
  validee: "badge-succes",
  publiee: "bg-blue-100 text-blue-700 border border-blue-200",
  archivee: "badge-neutre",
};

const TYPES_RESSOURCE = [
  { valeur: "mo", libelle: "Main-d'œuvre" },
  { valeur: "matiere", libelle: "Matière / fourniture" },
  { valeur: "materiel", libelle: "Matériel / engin" },
  { valeur: "sous_traitance", libelle: "Sous-traitance" },
  { valeur: "transport", libelle: "Transport" },
  { valeur: "frais_divers", libelle: "Frais divers" },
];

const LOTS = [
  { valeur: "7.1", libelle: "7.1 — VRD" },
  { valeur: "7.2", libelle: "7.2 — Terrassements" },
  { valeur: "7.3", libelle: "7.3 — Gros Œuvre" },
  { valeur: "7.4", libelle: "7.4 — Façades" },
  { valeur: "7.8", libelle: "7.8 — Charpente-Couverture-Zinguerie" },
  { valeur: "7.9", libelle: "7.9 — Étanchéité" },
  { valeur: "7.10", libelle: "7.10 — Menuiseries extérieures" },
  { valeur: "7.12", libelle: "7.12 — Isolation-Plâtrerie-Peinture" },
  { valeur: "7.13", libelle: "7.13 — Revêtements sols et carrelage" },
  { valeur: "7.14", libelle: "7.14 — Électricité" },
  { valeur: "7.15", libelle: "7.15 — Plomberie" },
  { valeur: "7.16", libelle: "7.16 — CVC" },
  { valeur: "7.18", libelle: "7.18 — Aménagements paysagers" },
  { valeur: "autre", libelle: "Autre" },
];

const METHODES = [
  { valeur: "analytique", libelle: "Analytique" },
  { valeur: "decompte", libelle: "Décompte" },
  { valeur: "artiprix", libelle: "ARTIPRIX" },
  { valeur: "constate", libelle: "Constaté" },
  { valeur: "estimatif", libelle: "Estimatif" },
];

const TAUX_PAR_ZONE: Record<string, string> = {
  A: "41.0000",
  B: "56.0000",
};

function formaterMontant(valeur: ValeurNumerique): string {
  if (valeur == null || valeur === "") return "—";
  return `${Number(valeur).toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} €`;
}

function formaterNombre(valeur: ValeurNumerique, suffixe = ""): string {
  if (valeur == null || valeur === "") return "—";
  return `${Number(valeur).toLocaleString("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  })}${suffixe}`;
}

function formaterTaux(valeur: ValeurNumerique): string {
  if (valeur == null || valeur === "") return "—";
  return `${(Number(valeur) * 100).toLocaleString("fr-FR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  })} %`;
}

function telechargerBlob(blob: Blob, nomFichier: string) {
  const url = window.URL.createObjectURL(blob);
  const lien = document.createElement("a");
  lien.href = url;
  lien.download = nomFichier;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  window.URL.revokeObjectURL(url);
}

function ModalLigneEtudePrix({
  etudeId,
  ligne,
  onClose,
  onSuccess,
}: {
  etudeId: string;
  ligne: LignePrixEtude | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(false);
  const [typeRessource, setTypeRessource] = useState(ligne?.type_ressource ?? "mo");
  const { data: profilsData } = useQuery({
    queryKey: ["profils-main-oeuvre", "actifs"],
    queryFn: () => api.get<ProfilMainOeuvreOption[] | { results: ProfilMainOeuvreOption[] }>(
      "/api/economie/profils-main-oeuvre/?actifs=1"
    ),
  });
  const profils = extraireListeResultats(profilsData);
  const [zoneHoraire, setZoneHoraire] = useState(
    ligne?.type_ressource === "mo" && Number(ligne?.taux_horaire || 0) >= 50 ? "B" : "A"
  );
  const [profilSelectionne, setProfilSelectionne] = useState(ligne?.profil_main_oeuvre ?? "");
  const [tauxHoraire, setTauxHoraire] = useState(
    ligne?.taux_horaire != null && ligne?.taux_horaire !== ""
      ? String(ligne.taux_horaire)
      : TAUX_PAR_ZONE.A
  );
  const [formulaire, setFormulaire] = useState({
    ordre: String(ligne?.ordre ?? 1),
    code: ligne?.code ?? "",
    designation: ligne?.designation ?? "",
    unite: ligne?.unite ?? "u",
    quantite: ligne?.quantite != null ? String(ligne.quantite) : "1",
    nombre_ressources: ligne?.nombre_ressources != null ? String(ligne.nombre_ressources) : "1",
    temps_unitaire: ligne?.temps_unitaire != null ? String(ligne.temps_unitaire) : "0",
    cout_unitaire_ht:
      ligne?.cout_unitaire_ht != null && ligne?.cout_unitaire_ht !== ""
        ? String(ligne.cout_unitaire_ht)
        : "0",
    observations: ligne?.observations ?? "",
  });

  const quantiteMo = Number(formulaire.nombre_ressources || 0) * Number(formulaire.temps_unitaire || 0);
  const quantiteRetenue = typeRessource === "mo" ? quantiteMo : Number(formulaire.quantite || 0);
  const montantPrevisionnel = quantiteRetenue * Number(
    typeRessource === "mo" ? tauxHoraire || 0 : formulaire.cout_unitaire_ht || 0
  );

  function changerChamp(cle: keyof typeof formulaire, valeur: string) {
    setFormulaire((courant) => ({ ...courant, [cle]: valeur }));
  }

  function changerZone(valeur: "A" | "B") {
    setZoneHoraire(valeur);
    setTauxHoraire(TAUX_PAR_ZONE[valeur]);
  }

  function changerProfil(valeur: string) {
    setProfilSelectionne(valeur);
    const profil = profils.find((item) => item.id === valeur);
    if (!profil) {
      return;
    }
    changerChamp("code", profil.code || "");
    if (!formulaire.designation.trim() || formulaire.designation === ligne?.designation) {
      changerChamp("designation", profil.libelle);
    }
    setZoneHoraire((profil.taux_horaire_recommande_defaut || 0) >= 50 ? "B" : "A");
    if (profil.taux_horaire_recommande_defaut != null) {
      setTauxHoraire(String(profil.taux_horaire_recommande_defaut));
    }
  }

  async function soumettre() {
    if (!formulaire.designation.trim()) {
      setErreur("La désignation est requise.");
      return;
    }

    setChargement(true);
    setErreur(null);
    try {
      const payload = {
        ordre: Number(formulaire.ordre || 1),
        type_ressource: typeRessource,
        code: formulaire.code,
        designation: formulaire.designation,
        unite: typeRessource === "mo" ? "h" : formulaire.unite,
        quantite: typeRessource === "mo" ? String(quantiteMo) : formulaire.quantite || "0",
        cout_unitaire_ht: typeRessource === "mo" ? tauxHoraire || "0" : formulaire.cout_unitaire_ht || "0",
        profil_main_oeuvre: typeRessource === "mo" && profilSelectionne ? profilSelectionne : null,
        nombre_ressources: typeRessource === "mo" ? formulaire.nombre_ressources || "1" : "1",
        temps_unitaire: typeRessource === "mo" ? formulaire.temps_unitaire || "0" : "0",
        taux_horaire: typeRessource === "mo" ? tauxHoraire || "0" : "0",
        observations: formulaire.observations,
      };

      if (ligne) {
        await api.patch(`/api/economie/etudes-de-prix/${etudeId}/lignes/${ligne.id}/`, payload);
      } else {
        await api.post(`/api/economie/etudes-de-prix/${etudeId}/lignes/`, payload);
      }

      onSuccess();
      onClose();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Erreur lors de l'enregistrement de la ressource.");
    } finally {
      setChargement(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2>{ligne ? "Modifier la ressource" : "Nouvelle ressource"}</h2>
          <button type="button" onClick={onClose}>
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {erreur && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {erreur}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="libelle-champ">Ordre</label>
              <input
                type="number"
                min="1"
                className="champ-saisie"
                value={formulaire.ordre}
                onChange={(e) => changerChamp("ordre", e.target.value)}
              />
            </div>
            <div>
              <label className="libelle-champ">Type de ressource</label>
              <select
                className="champ-saisie"
                value={typeRessource}
                onChange={(e) => setTypeRessource(e.target.value)}
              >
                {TYPES_RESSOURCE.map((type) => (
                  <option key={type.valeur} value={type.valeur}>
                    {type.libelle}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="libelle-champ">Code</label>
              <input
                type="text"
                className="champ-saisie font-mono"
                value={formulaire.code}
                onChange={(e) => changerChamp("code", e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="libelle-champ">Désignation *</label>
            <input
              type="text"
              className="champ-saisie"
              value={formulaire.designation}
              onChange={(e) => changerChamp("designation", e.target.value)}
              placeholder="Ex : Chef de chantier, béton C25/30, mini-pelle 5T…"
            />
          </div>

          {typeRessource === "mo" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="libelle-champ">Profil de main-d’œuvre</label>
                <select
                  className="champ-saisie"
                  value={profilSelectionne}
                  onChange={(e) => changerProfil(e.target.value)}
                >
                  <option value="">Saisie libre</option>
                  {profils.map((profil) => (
                    <option key={profil.id} value={profil.id}>
                      {profil.libelle}
                      {profil.niveau_classification ? ` — ${profil.niveau_classification}` : ""}
                    </option>
                  ))}
                </select>
                {profilSelectionne && (
                  <p className="mt-1 text-xs text-slate-500">
                    {profils.find((profil) => profil.id === profilSelectionne)?.secteur_activite_libelle || ""}
                    {profils.find((profil) => profil.id === profilSelectionne)?.fonction_equipe
                      ? ` · ${profils.find((profil) => profil.id === profilSelectionne)?.fonction_equipe}`
                      : ""}
                  </p>
                )}
              </div>
              <div>
                <label className="libelle-champ">Zone horaire</label>
                <select
                  className="champ-saisie"
                  value={zoneHoraire}
                  onChange={(e) => changerZone(e.target.value as "A" | "B")}
                >
                  <option value="A">Zone A — Province</option>
                  <option value="B">Zone B — Île-de-France</option>
                </select>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="libelle-champ">{typeRessource === "mo" ? "Effectif" : "Quantité"}</label>
              <input
                type="number"
                min="0"
                step="0.000001"
                className="champ-saisie font-mono"
                value={typeRessource === "mo" ? formulaire.nombre_ressources : formulaire.quantite}
                onChange={(e) => changerChamp(typeRessource === "mo" ? "nombre_ressources" : "quantite", e.target.value)}
              />
            </div>
            <div>
              <label className="libelle-champ">{typeRessource === "mo" ? "Temps unitaire (h)" : "Unité"}</label>
              {typeRessource === "mo" ? (
                <input
                  type="number"
                  min="0"
                  step="0.000001"
                  className="champ-saisie font-mono"
                  value={formulaire.temps_unitaire}
                  onChange={(e) => changerChamp("temps_unitaire", e.target.value)}
                />
              ) : (
                <input
                  type="text"
                  className="champ-saisie"
                  value={formulaire.unite}
                  onChange={(e) => changerChamp("unite", e.target.value)}
                />
              )}
            </div>
            {typeRessource !== "mo" ? (
              <div>
                <label className="libelle-champ">Coût unitaire HT</label>
                <input
                  type="number"
                  min="0"
                  step="0.000001"
                  className="champ-saisie font-mono"
                  value={formulaire.cout_unitaire_ht}
                  onChange={(e) => changerChamp("cout_unitaire_ht", e.target.value)}
                />
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs text-slate-500 mb-1">Temps total calculé</p>
                <p className="font-mono text-lg font-semibold text-slate-800">
                  {formaterNombre(quantiteMo, " h")}
                </p>
              </div>
            )}
          </div>

          {typeRessource === "mo" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="libelle-champ">Taux horaire retenu</label>
                <input
                  type="number"
                  min="0"
                  step="0.0001"
                  className="champ-saisie font-mono"
                  value={tauxHoraire}
                  onChange={(e) => setTauxHoraire(e.target.value)}
                />
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs text-slate-500 mb-1">Montant prévisionnel</p>
                <p className="font-mono text-lg font-semibold text-slate-800">
                  {formaterMontant(montantPrevisionnel)}
                </p>
              </div>
            </div>
          )}

          {typeRessource !== "mo" && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs text-slate-500 mb-1">Montant prévisionnel</p>
              <p className="font-mono text-lg font-semibold text-slate-800">
                {formaterMontant(montantPrevisionnel)}
              </p>
            </div>
          )}

          <div>
            <label className="libelle-champ">Observations</label>
            <textarea
              rows={3}
              className="champ-saisie"
              value={formulaire.observations}
              onChange={(e) => changerChamp("observations", e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
          <button type="button" className="btn-secondaire" onClick={onClose}>
            Annuler
          </button>
          <button type="button" className="btn-primaire" disabled={chargement} onClick={soumettre}>
            {chargement ? "Enregistrement…" : (
              <>
                <Save className="w-4 h-4" />
                Enregistrer
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalAchatEtudePrix({
  etudeId,
  achat,
  onClose,
  onSuccess,
}: {
  etudeId: string;
  achat: AchatEtudePrix | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [formulaire, setFormulaire] = useState({
    ordre: String(achat?.ordre ?? 1),
    designation: achat?.designation ?? "",
    fournisseur: achat?.fournisseur ?? "",
    reference_fournisseur: achat?.reference_fournisseur ?? "",
    unite_achat: achat?.unite_achat ?? "u",
    quantite_besoin: achat?.quantite_besoin != null ? String(achat.quantite_besoin) : "1",
    quantite_conditionnement: achat?.quantite_conditionnement != null ? String(achat.quantite_conditionnement) : "1",
    prix_unitaire_achat_ht: achat?.prix_unitaire_achat_ht != null ? String(achat.prix_unitaire_achat_ht) : "0",
    observations: achat?.observations ?? "",
  });

  function changerChamp(cle: keyof typeof formulaire, valeur: string) {
    setFormulaire((courant) => ({ ...courant, [cle]: valeur }));
  }

  async function soumettre() {
    if (!formulaire.designation.trim()) {
      setErreur("La désignation de l'achat est requise.");
      return;
    }

    setChargement(true);
    setErreur(null);
    try {
      const payload = {
        ordre: Number(formulaire.ordre || 1),
        designation: formulaire.designation,
        fournisseur: formulaire.fournisseur,
        reference_fournisseur: formulaire.reference_fournisseur,
        unite_achat: formulaire.unite_achat,
        quantite_besoin: formulaire.quantite_besoin || "0",
        quantite_conditionnement: formulaire.quantite_conditionnement || "1",
        prix_unitaire_achat_ht: formulaire.prix_unitaire_achat_ht || "0",
        observations: formulaire.observations,
      };

      if (achat) {
        await api.patch(`/api/economie/etudes-de-prix/${etudeId}/achats/${achat.id}/`, payload);
      } else {
        await api.post(`/api/economie/etudes-de-prix/${etudeId}/achats/`, payload);
      }

      onSuccess();
      onClose();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Impossible d'enregistrer l'achat.");
    } finally {
      setChargement(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2>{achat ? "Modifier l'achat" : "Nouvel achat fournisseur"}</h2>
          <button type="button" onClick={onClose}>
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {erreur && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {erreur}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="libelle-champ">Ordre</label>
              <input
                type="number"
                min="1"
                className="champ-saisie"
                value={formulaire.ordre}
                onChange={(e) => changerChamp("ordre", e.target.value)}
              />
            </div>
            <div>
              <label className="libelle-champ">Unité d&apos;achat</label>
              <input
                type="text"
                className="champ-saisie"
                value={formulaire.unite_achat}
                onChange={(e) => changerChamp("unite_achat", e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <label className="libelle-champ">Désignation *</label>
              <input
                type="text"
                className="champ-saisie"
                value={formulaire.designation}
                onChange={(e) => changerChamp("designation", e.target.value)}
              />
            </div>
            <div>
              <label className="libelle-champ">Fournisseur</label>
              <input
                type="text"
                className="champ-saisie"
                value={formulaire.fournisseur}
                onChange={(e) => changerChamp("fournisseur", e.target.value)}
              />
            </div>
            <div>
              <label className="libelle-champ">Référence fournisseur</label>
              <input
                type="text"
                className="champ-saisie"
                value={formulaire.reference_fournisseur}
                onChange={(e) => changerChamp("reference_fournisseur", e.target.value)}
              />
            </div>
            <div>
              <label className="libelle-champ">Quantité de besoin</label>
              <input
                type="number"
                min="0"
                step="0.000001"
                className="champ-saisie font-mono"
                value={formulaire.quantite_besoin}
                onChange={(e) => changerChamp("quantite_besoin", e.target.value)}
              />
            </div>
            <div>
              <label className="libelle-champ">Conditionnement de vente</label>
              <input
                type="number"
                min="0.000001"
                step="0.000001"
                className="champ-saisie font-mono"
                value={formulaire.quantite_conditionnement}
                onChange={(e) => changerChamp("quantite_conditionnement", e.target.value)}
              />
            </div>
            <div>
              <label className="libelle-champ">Prix unitaire d&apos;achat HT</label>
              <input
                type="number"
                min="0"
                step="0.000001"
                className="champ-saisie font-mono"
                value={formulaire.prix_unitaire_achat_ht}
                onChange={(e) => changerChamp("prix_unitaire_achat_ht", e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="libelle-champ">Observations</label>
            <textarea
              rows={3}
              className="champ-saisie"
              value={formulaire.observations}
              onChange={(e) => changerChamp("observations", e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
          <button type="button" className="btn-secondaire" onClick={onClose}>
            Annuler
          </button>
          <button type="button" className="btn-primaire" disabled={chargement} onClick={soumettre}>
            {chargement ? "Enregistrement…" : (
              <>
                <Save className="w-4 h-4" />
                Enregistrer
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalEditionEtudePrix({
  etude,
  onClose,
  onSuccess,
}: {
  etude: EtudePrixDetail;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(false);
  const [zoneTaux, setZoneTaux] = useState<"A" | "B">(
    etude.zone_taux_horaire === "B" ? "B" : "A"
  );
  const [tauxHoraire, setTauxHoraire] = useState(String(etude.taux_horaire_mo || TAUX_PAR_ZONE.A));
  const [formulaire, setFormulaire] = useState({
    intitule: etude.intitule,
    code: etude.code ?? "",
    description: etude.description ?? "",
    methode: etude.methode,
    lot_type: etude.lot_type,
    millesime: String(etude.millesime),
    taux_frais_chantier: String(etude.taux_frais_chantier || "0"),
    taux_frais_generaux: String(etude.taux_frais_generaux || "0"),
    taux_aleas: String(etude.taux_aleas || "0"),
    taux_marge_cible: String(etude.taux_marge_cible || "0"),
    date_etude: etude.date_etude ?? "",
    hypotheses: etude.hypotheses ?? "",
    observations: etude.observations ?? "",
  });

  function changerChamp(cle: keyof typeof formulaire, valeur: string) {
    setFormulaire((courant) => ({ ...courant, [cle]: valeur }));
  }

  function changerZone(valeur: "A" | "B") {
    setZoneTaux(valeur);
    setTauxHoraire(TAUX_PAR_ZONE[valeur]);
  }

  async function soumettre() {
    if (!formulaire.intitule.trim()) {
      setErreur("L'intitulé est requis.");
      return;
    }

    setChargement(true);
    setErreur(null);
    try {
      await api.patch(`/api/economie/etudes-de-prix/${etude.id}/`, {
        intitule: formulaire.intitule,
        code: formulaire.code,
        description: formulaire.description,
        methode: formulaire.methode,
        lot_type: formulaire.lot_type,
        millesime: Number(formulaire.millesime || etude.millesime),
        zone_taux_horaire: zoneTaux,
        taux_horaire_mo: tauxHoraire,
        taux_frais_chantier: formulaire.taux_frais_chantier || "0",
        taux_frais_generaux: formulaire.taux_frais_generaux || "0",
        taux_aleas: formulaire.taux_aleas || "0",
        taux_marge_cible: formulaire.taux_marge_cible || "0",
        date_etude: formulaire.date_etude || null,
        hypotheses: formulaire.hypotheses,
        observations: formulaire.observations,
      });
      onSuccess();
      onClose();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Impossible de modifier l'étude.");
    } finally {
      setChargement(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2>Modifier l&apos;étude de prix</h2>
          <button type="button" onClick={onClose}>
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {erreur && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {erreur}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="libelle-champ">Intitulé *</label>
              <input
                type="text"
                className="champ-saisie"
                value={formulaire.intitule}
                onChange={(e) => changerChamp("intitule", e.target.value)}
              />
            </div>
            <div>
              <label className="libelle-champ">Code</label>
              <input
                type="text"
                className="champ-saisie font-mono"
                value={formulaire.code}
                onChange={(e) => changerChamp("code", e.target.value)}
              />
            </div>
            <div>
              <label className="libelle-champ">Date de l&apos;étude</label>
              <input
                type="date"
                className="champ-saisie"
                value={formulaire.date_etude}
                onChange={(e) => changerChamp("date_etude", e.target.value)}
              />
            </div>
            <div>
              <label className="libelle-champ">Méthode</label>
              <select
                className="champ-saisie"
                value={formulaire.methode}
                onChange={(e) => changerChamp("methode", e.target.value)}
              >
                {METHODES.map((methode) => (
                  <option key={methode.valeur} value={methode.valeur}>
                    {methode.libelle}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="libelle-champ">Lot / corps d&apos;état</label>
              <select
                className="champ-saisie"
                value={formulaire.lot_type}
                onChange={(e) => changerChamp("lot_type", e.target.value)}
              >
                {LOTS.map((lot) => (
                  <option key={lot.valeur} value={lot.valeur}>
                    {lot.libelle}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="libelle-champ">Millésime</label>
              <input
                type="number"
                min="2020"
                step="1"
                className="champ-saisie font-mono"
                value={formulaire.millesime}
                onChange={(e) => changerChamp("millesime", e.target.value)}
              />
            </div>
            <div>
              <label className="libelle-champ">Zone tarifaire</label>
              <select
                className="champ-saisie"
                value={zoneTaux}
                onChange={(e) => changerZone(e.target.value as "A" | "B")}
              >
                <option value="A">Zone A — Province</option>
                <option value="B">Zone B — Île-de-France</option>
              </select>
            </div>
            <div>
              <label className="libelle-champ">Taux horaire retenu</label>
              <input
                type="number"
                min="0"
                step="0.0001"
                className="champ-saisie font-mono"
                value={tauxHoraire}
                onChange={(e) => setTauxHoraire(e.target.value)}
              />
            </div>
            <div>
              <label className="libelle-champ">Frais de chantier</label>
              <input
                type="number"
                min="0"
                step="0.0001"
                className="champ-saisie font-mono"
                value={formulaire.taux_frais_chantier}
                onChange={(e) => changerChamp("taux_frais_chantier", e.target.value)}
              />
            </div>
            <div>
              <label className="libelle-champ">Frais généraux</label>
              <input
                type="number"
                min="0"
                step="0.0001"
                className="champ-saisie font-mono"
                value={formulaire.taux_frais_generaux}
                onChange={(e) => changerChamp("taux_frais_generaux", e.target.value)}
              />
            </div>
            <div>
              <label className="libelle-champ">Aléas</label>
              <input
                type="number"
                min="0"
                step="0.0001"
                className="champ-saisie font-mono"
                value={formulaire.taux_aleas}
                onChange={(e) => changerChamp("taux_aleas", e.target.value)}
              />
            </div>
            <div>
              <label className="libelle-champ">Marge cible</label>
              <input
                type="number"
                min="0"
                step="0.0001"
                className="champ-saisie font-mono"
                value={formulaire.taux_marge_cible}
                onChange={(e) => changerChamp("taux_marge_cible", e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <label className="libelle-champ">Description</label>
              <textarea
                rows={3}
                className="champ-saisie"
                value={formulaire.description}
                onChange={(e) => changerChamp("description", e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <label className="libelle-champ">Hypothèses</label>
              <textarea
                rows={4}
                className="champ-saisie"
                value={formulaire.hypotheses}
                onChange={(e) => changerChamp("hypotheses", e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <label className="libelle-champ">Observations</label>
              <textarea
                rows={4}
                className="champ-saisie"
                value={formulaire.observations}
                onChange={(e) => changerChamp("observations", e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
          <button type="button" className="btn-secondaire" onClick={onClose}>
            Annuler
          </button>
          <button type="button" className="btn-primaire" disabled={chargement} onClick={soumettre}>
            {chargement ? "Enregistrement…" : (
              <>
                <Save className="w-4 h-4" />
                Mettre à jour
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalPublicationEtudePrix({
  etudeId,
  onClose,
  onSuccess,
}: {
  etudeId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [unite, setUnite] = useState("u");
  const [quantiteOuvrage, setQuantiteOuvrage] = useState("1");
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function publier() {
    setChargement(true);
    setErreur(null);
    try {
      await api.post(`/api/economie/etudes-de-prix/${etudeId}/publier/`, {
        unite,
        quantite_ouvrage: quantiteOuvrage,
      });
      onSuccess();
      onClose();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Impossible de publier l'étude.");
    } finally {
      setChargement(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2>Publier en bibliothèque</h2>
          <button type="button" onClick={onClose}>
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {erreur && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {erreur}
            </div>
          )}
          <div>
            <label className="libelle-champ">Unité d&apos;ouvrage publiée</label>
            <input
              type="text"
              className="champ-saisie"
              value={unite}
              onChange={(e) => setUnite(e.target.value)}
            />
          </div>
          <div>
            <label className="libelle-champ">Quantité d&apos;ouvrage de référence</label>
            <input
              type="number"
              min="0.0001"
              step="0.0001"
              className="champ-saisie font-mono"
              value={quantiteOuvrage}
              onChange={(e) => setQuantiteOuvrage(e.target.value)}
            />
          </div>
          <p className="text-xs text-slate-500">
            La bibliothèque recevra un coût unitaire ramené à cette quantité d&apos;ouvrage.
          </p>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
          <button type="button" className="btn-secondaire" onClick={onClose}>
            Annuler
          </button>
          <button type="button" className="btn-primaire" disabled={chargement} onClick={publier}>
            {chargement ? "Publication…" : (
              <>
                <BookOpen className="w-4 h-4" />
                Publier
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export function DetailEtudePrix({ etudeId }: { etudeId: string }) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const [erreurAction, setErreurAction] = useState<string | null>(null);
  const [ligneEdition, setLigneEdition] = useState<LignePrixEtude | null | undefined>(undefined);
  const [achatEdition, setAchatEdition] = useState<AchatEtudePrix | null | undefined>(undefined);
  const [editionEtude, setEditionEtude] = useState(false);
  const [publicationOuverte, setPublicationOuverte] = useState(false);
  const [suppressionId, setSuppressionId] = useState<string | null>(null);
  const [suppressionAchatId, setSuppressionAchatId] = useState<string | null>(null);
  const [exportXlsxEnCours, setExportXlsxEnCours] = useState(false);

  const { data: etude, isLoading, isError } = useQuery<EtudePrixDetail>({
    queryKey: ["etude-prix", etudeId],
    queryFn: () => api.get<EtudePrixDetail>(`/api/economie/etudes-de-prix/${etudeId}/`),
  });
  const { data: assistant } = useQuery<AssistantEtudePrix>({
    queryKey: ["etude-prix-assistant", etudeId],
    queryFn: () => api.get<AssistantEtudePrix>(`/api/economie/etudes-de-prix/${etudeId}/assistant/`),
  });
  const { data: comparatif } = useQuery<ComparatifEtudePrix>({
    queryKey: ["etude-prix-comparatif", etudeId],
    queryFn: () => api.get<ComparatifEtudePrix>(`/api/economie/etudes-de-prix/${etudeId}/comparatif/`),
  });
  const {
    data: auditPrix,
    refetch: relancerAuditPrix,
    isFetching: auditPrixEnCours,
  } = useQuery<AuditMoteurPrix>({
    queryKey: ["etude-prix-audit-prix", etudeId],
    queryFn: () => api.get<AuditMoteurPrix>(`/api/economie/etudes-de-prix/${etudeId}/audit-prix/`),
    enabled: false,
  });

  const rafraichir = async (messageSucces?: string) => {
    await queryClient.invalidateQueries({ queryKey: ["etude-prix", etudeId] });
    await queryClient.invalidateQueries({ queryKey: ["etude-prix-assistant", etudeId] });
    await queryClient.invalidateQueries({ queryKey: ["etude-prix-comparatif", etudeId] });
    await queryClient.invalidateQueries({ queryKey: ["etudes-prix"] });
    await queryClient.invalidateQueries({ queryKey: ["bibliotheque"] });
    if (messageSucces) {
      setMessage(messageSucces);
      setTimeout(() => setMessage(null), 3500);
    }
    setErreurAction(null);
  };

  const mutationValider = useMutation({
    mutationFn: () => api.post(`/api/economie/etudes-de-prix/${etudeId}/valider/`, {}),
    onSuccess: async () => {
      await rafraichir("Étude de prix validée.");
    },
    onError: (e) => {
      setErreurAction(e instanceof ErreurApi ? e.detail : "Impossible de valider l'étude.");
    },
  });

  const mutationSupprimerLigne = useMutation({
    mutationFn: (ligneId: string) =>
      api.supprimer(`/api/economie/etudes-de-prix/${etudeId}/lignes/${ligneId}/`),
    onSuccess: async () => {
      setSuppressionId(null);
      await rafraichir("Ressource supprimée.");
    },
    onError: (e) => {
      setErreurAction(e instanceof ErreurApi ? e.detail : "Impossible de supprimer la ressource.");
    },
  });

  const mutationSupprimerAchat = useMutation({
    mutationFn: (achatId: string) =>
      api.supprimer(`/api/economie/etudes-de-prix/${etudeId}/achats/${achatId}/`),
    onSuccess: async () => {
      setSuppressionAchatId(null);
      await rafraichir("Achat supprimé.");
    },
    onError: (e) => {
      setErreurAction(e instanceof ErreurApi ? e.detail : "Impossible de supprimer l'achat.");
    },
  });

  const mutationProposerAchats = useMutation({
    mutationFn: () => api.post(`/api/economie/etudes-de-prix/${etudeId}/achats/proposer/`, { remplacer: true }),
    onSuccess: async () => {
      await rafraichir("Achats fournisseurs proposés depuis les fournitures.");
    },
    onError: (e) => {
      setErreurAction(e instanceof ErreurApi ? e.detail : "Impossible de proposer les achats.");
    },
  });

  async function exporterXlsx() {
    setExportXlsxEnCours(true);
    setErreurAction(null);
    try {
      const reponse = await api.telecharger(`/api/economie/etudes-de-prix/${etudeId}/export/xlsx/`);
      telechargerBlob(reponse.blob, reponse.nomFichier || `${etude?.code || "etude-prix"}.xlsx`);
    } catch (e) {
      setErreurAction(e instanceof ErreurApi ? e.detail : "Impossible d’exporter l’étude en XLSX.");
    } finally {
      setExportXlsxEnCours(false);
    }
  }

  async function exporterComparatif() {
    setErreurAction(null);
    try {
      const reponse = await api.telecharger(`/api/economie/etudes-de-prix/${etudeId}/export/comparatif-xlsx/`);
      telechargerBlob(reponse.blob, reponse.nomFichier || `${etude?.code || "etude-prix"}-comparatif.xlsx`);
    } catch (e) {
      setErreurAction(e instanceof ErreurApi ? e.detail : "Impossible d’exporter le comparatif.");
    }
  }

  async function exporterBonCommande() {
    setErreurAction(null);
    try {
      const reponse = await api.telecharger(`/api/economie/etudes-de-prix/${etudeId}/export/achats-xlsx/`);
      telechargerBlob(reponse.blob, reponse.nomFichier || `${etude?.code || "etude-prix"}-bon-commande.xlsx`);
    } catch (e) {
      setErreurAction(e instanceof ErreurApi ? e.detail : "Impossible d’exporter le bon de commande.");
    }
  }

  async function exporterNote(mode: "moa" | "moe") {
    setErreurAction(null);
    try {
      const suffixe = mode === "moa" ? "note-moa" : "note-moe";
      const reponse = await api.telecharger(`/api/economie/etudes-de-prix/${etudeId}/export/${suffixe}-docx/`);
      telechargerBlob(reponse.blob, reponse.nomFichier || `${etude?.code || "etude-prix"}-${suffixe}.docx`);
    } catch (e) {
      setErreurAction(
        e instanceof ErreurApi
          ? e.detail
          : `Impossible d’exporter la ${mode === "moa" ? "note MOA" : "note MOE"}.`,
      );
    }
  }

  if (isLoading) {
    return <div className="py-20 text-center text-slate-400 text-sm">Chargement de l&apos;étude de prix…</div>;
  }

  if (isError || !etude) {
    return (
      <div className="carte text-center py-12">
        <p className="text-red-500 mb-4">Impossible de charger cette étude de prix.</p>
        <Link href="/economie/etudes-de-prix" className="btn-secondaire">
          Retour à la liste
        </Link>
      </div>
    );
  }

  const etudeFinalisee = ["validee", "publiee", "archivee"].includes(etude.statut);
  const ratioSeuil = Number(etude.seuil_rentabilite_ht || 0);
  const ratioVente = Number(etude.prix_vente_ht || 0);
  const largeurSeuil = ratioVente > 0 ? Math.min(100, (ratioSeuil / ratioVente) * 100) : 0;
  const largeurMarge = ratioVente > 0 ? Math.max(0, 100 - largeurSeuil) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <Link href="/economie/etudes-de-prix" className="inline-flex items-center gap-1 hover:text-slate-700">
              <ArrowLeft size={14} />
              Études de prix
            </Link>
            {etude.projet && (
              <>
                <span>•</span>
                <Link href={`/projets/${etude.projet}/economie`} className="hover:text-slate-700">
                  {etude.projet_reference || "Projet"}
                </Link>
              </>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <h1>{etude.intitule}</h1>
            <span className={clsx(STATUTS_CSS[etude.statut] || "badge-neutre")}>
              {etude.statut_libelle}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
            {etude.code && <span className="font-mono">{etude.code}</span>}
            {etude.lot_libelle && <span className="badge-neutre text-xs">{etude.lot_libelle}</span>}
            {etude.organisation_nom && <span>{etude.organisation_nom}</span>}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondaire text-xs" onClick={exporterXlsx} disabled={exportXlsxEnCours}>
            <Download className="w-3.5 h-3.5" />
            {exportXlsxEnCours ? "Export…" : "Exporter XLSX"}
          </button>
          <button type="button" className="btn-secondaire text-xs" onClick={exporterComparatif}>
            <BarChart3 className="w-3.5 h-3.5" />
            Export comparatif
          </button>
          <button type="button" className="btn-secondaire text-xs" onClick={exporterBonCommande}>
            <ShoppingCart className="w-3.5 h-3.5" />
            Bon de commande
          </button>
          <button
            type="button"
            className="btn-secondaire text-xs"
            onClick={() => relancerAuditPrix()}
            disabled={auditPrixEnCours}
          >
            <Sparkles className="w-3.5 h-3.5" />
            {auditPrixEnCours ? "Audit…" : "Auditer le prix"}
          </button>
          <button type="button" className="btn-secondaire text-xs" onClick={() => exporterNote("moa")}>
            <FileText className="w-3.5 h-3.5" />
            Note MOA
          </button>
          <button type="button" className="btn-secondaire text-xs" onClick={() => exporterNote("moe")}>
            <FileText className="w-3.5 h-3.5" />
            Note MOE
          </button>
          {!etudeFinalisee && (
            <button type="button" className="btn-secondaire text-xs" onClick={() => setEditionEtude(true)}>
              <Pencil className="w-3.5 h-3.5" />
              Modifier
            </button>
          )}
          {!etudeFinalisee && etude.lignes.length > 0 && (
            <button
              type="button"
              className="btn-primaire text-xs"
              onClick={() => mutationValider.mutate()}
              disabled={mutationValider.isPending}
            >
              <CheckCircle className="w-3.5 h-3.5" />
              {mutationValider.isPending ? "Validation…" : "Valider"}
            </button>
          )}
          {etude.statut === "validee" && (
            <button
              type="button"
              className="btn-primaire text-xs"
              onClick={() => setPublicationOuverte(true)}
            >
              <Send className="w-3.5 h-3.5" />
              Publier en bibliothèque
            </button>
          )}
          {etude.ligne_bibliotheque && (
            <Link href={`/bibliotheque/${etude.ligne_bibliotheque}`} className="btn-secondaire text-xs">
              <BookOpen className="w-3.5 h-3.5" />
              Voir la ligne publiée
            </Link>
          )}
        </div>
      </div>

      {message && (
        <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          {message}
        </div>
      )}

      {erreurAction && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {erreurAction}
        </div>
      )}

      {etudeFinalisee && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Cette étude est finalisée. Les ressources et métadonnées sont désormais figées. Dupliquez-la si vous devez produire une nouvelle version.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 xl:grid-cols-8 gap-4">
        {[
          { libelle: "Déboursé sec total", valeur: etude.debourse_sec_ht },
          { libelle: "Main-d'œuvre", valeur: etude.total_mo_ht },
          { libelle: "Matières", valeur: etude.total_matieres_ht },
          { libelle: "Matériel et autres coûts", valeur: Number(etude.total_materiel_ht || 0) + Number(etude.total_sous_traitance_ht || 0) + Number(etude.total_transport_ht || 0) + Number(etude.total_frais_divers_ht || 0) },
          { libelle: "Frais de chantier", valeur: etude.montant_frais_chantier_ht },
          { libelle: "Frais généraux + aléas", valeur: Number(etude.montant_frais_generaux_ht || 0) + Number(etude.montant_aleas_ht || 0) },
          { libelle: "Prix de vente HT", valeur: etude.prix_vente_ht },
          { libelle: "Coefficient K", valeur: etude.coefficient_k, type: "nombre" as const },
        ].map((bloc) => (
          <div key={bloc.libelle} className="carte">
            <p className="text-xs text-slate-500 mb-1">{bloc.libelle}</p>
            <p className="font-mono text-lg font-semibold text-slate-800">
              {bloc.type === "nombre" ? formaterNombre(bloc.valeur) : formaterMontant(bloc.valeur)}
            </p>
          </div>
        ))}
      </div>

      <div className="carte space-y-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primaire-600" />
          <h2>Synthèse commerciale</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-slate-500 mb-1">Frais de chantier</p>
            <p className="font-mono text-slate-800">{formaterTaux(etude.taux_frais_chantier)}</p>
          </div>
          <div>
            <p className="text-slate-500 mb-1">Frais généraux</p>
            <p className="font-mono text-slate-800">{formaterTaux(etude.taux_frais_generaux)}</p>
          </div>
          <div>
            <p className="text-slate-500 mb-1">Aléas</p>
            <p className="font-mono text-slate-800">{formaterTaux(etude.taux_aleas)}</p>
          </div>
          <div>
            <p className="text-slate-500 mb-1">Marge cible</p>
            <p className="font-mono text-slate-800">{formaterTaux(etude.taux_marge_cible)}</p>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-slate-500">
            <span>Seuil de rentabilité</span>
            <span>{formaterMontant(etude.seuil_rentabilite_ht)}</span>
          </div>
          <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full bg-amber-400" style={{ width: `${largeurSeuil}%` }} />
            <div className="h-full bg-green-500 -mt-3 ml-auto" style={{ width: `${largeurMarge}%` }} />
          </div>
          <div className="flex justify-between text-xs text-slate-500">
            <span>Prix de vente prévisionnel</span>
            <span>{formaterMontant(etude.prix_vente_ht)}</span>
          </div>
        </div>
      </div>

      {auditPrix && (
        <div className="carte space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primaire-600" />
                Audit adaptatif du prix
              </h2>
              <p className="text-sm text-slate-500 mt-1">{auditPrix.justification}</p>
            </div>
            <div className="rounded-xl border border-slate-200 px-3 py-2 text-right">
              <p className="text-xs text-slate-500">Confiance</p>
              <p className="font-semibold text-slate-800 capitalize">{auditPrix.niveau_confiance}</p>
              <p className="font-mono text-xs text-slate-500">{formaterTaux(auditPrix.score_confiance)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs text-slate-500 mb-1">Statut</p>
              <p className="font-medium text-slate-800">{auditPrix.statut.replaceAll("_", " ")}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs text-slate-500 mb-1">Stratégie retenue</p>
              <p className="font-medium text-slate-800">{auditPrix.strategie_principale.replaceAll("_", " ")}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs text-slate-500 mb-1">Prix proposé</p>
              <p className="font-mono text-slate-800">{formaterMontant(auditPrix.valeurs.prix_vente_unitaire as ValeurNumerique)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs text-slate-500 mb-1">Déboursé estimé</p>
              <p className="font-mono text-slate-800">
                {formaterMontant((auditPrix.valeurs.debourse_sec || auditPrix.valeurs.debourse_sec_estime) as ValeurNumerique)}
              </p>
            </div>
          </div>

          {auditPrix.erreurs.length > 0 && (
            <div className="space-y-2">
              {auditPrix.erreurs.map((erreur) => (
                <div key={erreur} className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {erreur}
                </div>
              ))}
            </div>
          )}
          {auditPrix.alertes.length > 0 && (
            <div className="space-y-2">
              {auditPrix.alertes.map((alerte) => (
                <div key={alerte} className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {alerte}
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-slate-200 p-4">
              <h3 className="text-sm font-semibold text-slate-800 mb-3">Hypothèses</h3>
              <div className="space-y-3">
                {auditPrix.hypotheses.slice(0, 5).map((hypothese) => (
                  <div key={`${hypothese.code || hypothese.libelle}-${hypothese.libelle}`} className="text-sm">
                    <p className="font-medium text-slate-800">{hypothese.libelle}</p>
                    <p className="text-xs text-slate-500">{hypothese.raison || hypothese.source || "À valider"}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 p-4">
              <h3 className="text-sm font-semibold text-slate-800 mb-3">Vérifications</h3>
              <div className="space-y-2">
                {auditPrix.verifications.slice(0, 6).map((verification) => (
                  <div key={`${verification.type}-${verification.message}`} className="text-sm">
                    <span className={clsx(
                      "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium mr-2",
                      verification.statut === "ok" ? "bg-green-100 text-green-700" :
                        verification.statut === "critique" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                    )}>
                      {verification.statut}
                    </span>
                    <span className="text-slate-700">{verification.message}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 p-4">
              <h3 className="text-sm font-semibold text-slate-800 mb-3">Corrections proposées</h3>
              {auditPrix.corrections_proposees.length === 0 ? (
                <p className="text-sm text-slate-500">Aucune correction automatique proposée.</p>
              ) : (
                <div className="space-y-3">
                  {auditPrix.corrections_proposees.map((correction) => (
                    <div key={`${correction.champ}-${correction.raison}`} className="text-sm">
                      <p className="font-medium text-slate-800">{correction.champ}</p>
                      <p className="text-xs text-slate-500">{correction.raison}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {comparatif && (
        <div className="carte space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primaire-600" />
                Estimations comparées
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Vérification par ratio, retour d&apos;expérience et analyse comparative de projets similaires.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 px-3 py-2 text-right">
              <p className="text-xs text-slate-500">Taux moyen de similarité</p>
              <p className="font-mono text-base font-semibold text-slate-800">{formaterTaux(comparatif.taux_similarite_moyen)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs text-slate-500 mb-1">Estimation par ratio</p>
              <p className="font-mono text-lg font-semibold text-slate-800">{formaterMontant(comparatif.estimation_ratio_ht)}</p>
              <p className="text-xs text-slate-500 mt-2">Écart avec analytique : {formaterMontant(comparatif.ecart_ratio_vs_analytique_ht)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs text-slate-500 mb-1">Retour d&apos;expérience</p>
              <p className="font-mono text-lg font-semibold text-slate-800">{formaterMontant(comparatif.estimation_rex_ht)}</p>
              <p className="text-xs text-slate-500 mt-2">Écart avec analytique : {formaterMontant(comparatif.ecart_rex_vs_analytique_ht)}</p>
            </div>
            <div className="rounded-2xl border border-primaire-200 bg-primaire-50 px-4 py-3">
              <p className="text-xs text-primaire-700 mb-1">Estimation analytique</p>
              <p className="font-mono text-lg font-semibold text-primaire-900">{formaterMontant(comparatif.estimation_analytique_ht)}</p>
              <p className="text-xs text-primaire-700 mt-2">Base actuelle de l&apos;étude de prix</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-xs text-slate-500 mb-1">Base métrés</p>
              <p className="font-mono text-lg font-semibold text-slate-800">{formaterMontant(comparatif.profil_projet.montant_metres_ht)}</p>
              <p className="text-xs text-slate-500 mt-2">
                {formaterNombre(comparatif.profil_projet.nombre_lignes_metre)} ligne(s) sur {formaterNombre(comparatif.profil_projet.nombre_metres)} métré(s)
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-xs text-slate-500 mb-1">Programme bâtiment</p>
              <p className="font-medium text-slate-800">
                {comparatif.profil_projet.types_batiment.length > 0
                  ? comparatif.profil_projet.types_batiment.join(", ")
                  : "Non renseigné"}
              </p>
              <p className="text-xs text-slate-500 mt-2">
                {formaterNombre(comparatif.profil_projet.nombre_programmes_batiment)} programme(s)
                {comparatif.profil_projet.types_operation_batiment.length > 0
                  ? ` · ${comparatif.profil_projet.types_operation_batiment.join(", ")}`
                  : ""}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-xs text-slate-500 mb-1">Quantités et catégories</p>
              <p className="font-mono text-lg font-semibold text-slate-800">
                {formaterNombre(comparatif.profil_projet.total_quantites_metrees)}
              </p>
              <p className="text-xs text-slate-500 mt-2">
                {comparatif.profil_projet.categories_locaux.length > 0
                  ? comparatif.profil_projet.categories_locaux.join(", ")
                  : "Aucune catégorie de local renseignée"}
              </p>
            </div>
          </div>

          {comparatif.alertes.length > 0 && (
            <div className="space-y-2">
              {comparatif.alertes.map((alerte) => (
                <div key={alerte} className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {alerte}
                </div>
              ))}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs text-slate-500">
                  <th className="text-left py-2 pr-3 font-medium">Projet similaire</th>
                  <th className="text-right py-2 pr-3 font-medium">Surface</th>
                  <th className="text-right py-2 pr-3 font-medium">Montant</th>
                  <th className="text-right py-2 pr-3 font-medium">Similarité</th>
                </tr>
              </thead>
              <tbody>
                {comparatif.projets_similaires.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-slate-400">
                      Aucun projet comparable suffisamment renseigné.
                    </td>
                  </tr>
                ) : comparatif.projets_similaires.map((projet) => (
                  <tr key={projet.id} className="border-b border-slate-50">
                    <td className="py-3 pr-3">
                      <Link href={`/projets/${projet.id}`} className="font-medium text-slate-800 hover:text-primaire-600">
                        {projet.reference || "Projet"}
                      </Link>
                      <div className="text-xs text-slate-500 mt-1">
                        {projet.intitule}
                        {projet.departement ? ` · ${projet.departement}` : ""}
                        {projet.phase_actuelle ? ` · ${projet.phase_actuelle}` : ""}
                      </div>
                    </td>
                    <td className="py-3 pr-3 text-right font-mono text-xs text-slate-700">
                      {formaterNombre(projet.surface_reference, " m²")}
                    </td>
                    <td className="py-3 pr-3 text-right font-mono text-xs text-slate-700">
                      {formaterMontant(projet.montant_reference)}
                    </td>
                    <td className="py-3 pr-3 text-right font-mono text-xs font-semibold text-slate-800">
                      {formaterTaux(projet.score_similarite)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="carte lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2">
                <Euro size={16} />
                Ressources analytiques
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Poste par poste, depuis la main-d&apos;œuvre jusqu&apos;aux frais divers.
              </p>
            </div>
            {!etudeFinalisee && (
              <button type="button" className="btn-primaire text-xs" onClick={() => setLigneEdition(null)}>
                <Plus className="w-3.5 h-3.5" />
                Ajouter
              </button>
            )}
          </div>

          {etude.lignes.length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-sm">
              Aucune ressource n&apos;a encore été ajoutée à cette étude.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs text-slate-500">
                    <th className="text-left py-2 pr-3 font-medium">Ordre</th>
                    <th className="text-left py-2 pr-4 font-medium">Ressource</th>
                    <th className="text-left py-2 pr-4 font-medium">Type</th>
                    <th className="text-right py-2 pr-4 font-medium">Qté</th>
                    <th className="text-right py-2 pr-4 font-medium">Coût unitaire</th>
                    <th className="text-right py-2 pr-4 font-medium">Montant HT</th>
                    {!etudeFinalisee && <th className="text-right py-2 font-medium">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {etude.lignes.map((ligne) => (
                    <tr key={ligne.id} className="border-b border-slate-50 align-top">
                      <td className="py-3 pr-3 font-mono text-xs text-slate-500">{ligne.ordre}</td>
                      <td className="py-3 pr-4">
                        {!etudeFinalisee ? (
                          <button
                            type="button"
                            onClick={() => setLigneEdition(ligne)}
                            className="font-medium text-slate-800 transition-colors hover:text-primaire-600"
                          >
                            {ligne.designation}
                          </button>
                        ) : (
                          <p className="font-medium text-slate-800">{ligne.designation}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-2 mt-0.5">
                          {ligne.code && <span className="font-mono text-xs text-slate-400">{ligne.code}</span>}
                          {ligne.type_ressource === "mo" && ligne.profil_main_oeuvre_libelle && (
                            <span className="text-xs text-primaire-700">
                              {ligne.profil_main_oeuvre_libelle}
                              {ligne.nombre_ressources != null && ligne.temps_unitaire != null
                                ? ` · ${formaterNombre(ligne.nombre_ressources)} × ${formaterNombre(ligne.temps_unitaire, " h")}`
                                : ""}
                            </span>
                          )}
                          {ligne.observations && <span className="text-xs text-slate-500">{ligne.observations}</span>}
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <span className="badge-neutre text-xs">{ligne.type_libelle}</span>
                      </td>
                      <td className="py-3 pr-4 text-right font-mono text-xs text-slate-700">
                        {formaterNombre(ligne.quantite, ` ${ligne.unite}`)}
                      </td>
                      <td className="py-3 pr-4 text-right font-mono text-xs text-slate-700">
                        {ligne.type_ressource === "mo"
                          ? formaterMontant(ligne.taux_horaire)
                          : formaterMontant(ligne.cout_unitaire_ht)}
                      </td>
                      <td className="py-3 pr-4 text-right font-mono text-xs font-semibold text-slate-800">
                        {formaterMontant(ligne.montant_ht)}
                      </td>
                      {!etudeFinalisee && (
                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              className="text-slate-500 hover:text-primaire-700"
                              title="Modifier la ressource"
                              onClick={() => setLigneEdition(ligne)}
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            {suppressionId === ligne.id ? (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  className="text-xs text-red-600 hover:underline"
                                  onClick={() => mutationSupprimerLigne.mutate(ligne.id)}
                                >
                                  Confirmer
                                </button>
                                <button
                                  type="button"
                                  className="text-xs text-slate-500 hover:underline"
                                  onClick={() => setSuppressionId(null)}
                                >
                                  Annuler
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="text-slate-500 hover:text-red-600"
                                title="Supprimer la ressource"
                                onClick={() => setSuppressionId(ligne.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="carte space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primaire-600" />
              <h2>Assistant métier</h2>
            </div>
            {assistant?.resume && (
              <p className="text-sm text-slate-700">{assistant.resume}</p>
            )}
            {!!assistant?.methodes_recommandees?.length && (
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">Méthodes recommandées</p>
                <div className="space-y-2">
                  {assistant.methodes_recommandees.slice(0, 3).map((methode) => (
                    <div key={methode.code} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                      <p className="text-sm font-medium text-slate-800">{methode.libelle}</p>
                      <p className="text-xs text-slate-500 mt-1">{methode.objectif}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {!!assistant?.questions?.length && (
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">Questions de cadrage</p>
                <ul className="space-y-2 text-sm text-slate-700">
                  {assistant.questions.slice(0, 4).map((question) => (
                    <li key={question.question} className="rounded-xl border border-slate-200 px-3 py-2">
                      {question.question}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="carte space-y-3">
            <h2>Contexte</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Projet</dt>
                <dd className="text-right text-slate-800">
                  {etude.projet ? (
                    <Link href={`/projets/${etude.projet}`} className="text-primaire-700 hover:underline">
                      {etude.projet_reference || "Projet"}
                    </Link>
                  ) : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Organisation</dt>
                <dd className="text-right text-slate-800">{etude.organisation_nom || "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Méthode</dt>
                <dd className="text-right text-slate-800">{etude.methode_libelle}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Zone</dt>
                <dd className="text-right text-slate-800">{etude.zone_taux_horaire}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Taux horaire</dt>
                <dd className="text-right font-mono text-slate-800">{formaterMontant(etude.taux_horaire_mo)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Coût de revient</dt>
                <dd className="text-right font-mono text-slate-800">{formaterMontant(etude.cout_revient_ht)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Marge prévisionnelle</dt>
                <dd className="text-right font-mono text-slate-800">{formaterMontant(etude.marge_previsionnelle_ht)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Date d&apos;étude</dt>
                <dd className="text-right text-slate-800">
                  {etude.date_etude ? new Date(etude.date_etude).toLocaleDateString("fr-FR") : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Validation</dt>
                <dd className="text-right text-slate-800">
                  {etude.date_validation ? new Date(etude.date_validation).toLocaleDateString("fr-FR") : "—"}
                </dd>
              </div>
            </dl>
          </div>

          <div className="carte space-y-3">
            <h2>Notes métier</h2>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">Description</p>
              <p className="text-sm text-slate-700 whitespace-pre-line">
                {etude.description || "Aucune description saisie."}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">Hypothèses</p>
              <p className="text-sm text-slate-700 whitespace-pre-line">
                {etude.hypotheses || "Aucune hypothèse saisie."}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">Observations</p>
              <p className="text-sm text-slate-700 whitespace-pre-line">
                {etude.observations || "Aucune observation saisie."}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="carte space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4" />
              Achats fournisseurs et conditionnements
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Prépare les quantités réellement commandées et mesure le surcoût induit par les conditionnements de vente.
            </p>
          </div>
          {!etudeFinalisee && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-secondaire text-xs"
                onClick={() => mutationProposerAchats.mutate()}
                disabled={mutationProposerAchats.isPending}
              >
                <PackageOpen className="w-3.5 h-3.5" />
                {mutationProposerAchats.isPending ? "Proposition…" : "Proposer depuis les fournitures"}
              </button>
              <button type="button" className="btn-primaire text-xs" onClick={() => setAchatEdition(null)}>
                <Plus className="w-3.5 h-3.5" />
                Ajouter un achat
              </button>
            </div>
          )}
        </div>

        {etude.achats.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-400">
            Aucun achat n&apos;est encore préparé pour cette étude de prix.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs text-slate-500">
                  <th className="text-left py-2 pr-3 font-medium">Achat</th>
                  <th className="text-right py-2 pr-3 font-medium">Besoin</th>
                  <th className="text-right py-2 pr-3 font-medium">Conditionnement</th>
                  <th className="text-right py-2 pr-3 font-medium">Qté commandée</th>
                  <th className="text-right py-2 pr-3 font-medium">Coût achat</th>
                  <th className="text-right py-2 pr-3 font-medium">Surcoût</th>
                  {!etudeFinalisee && <th className="text-right py-2 font-medium">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {etude.achats.map((achat) => (
                  <tr key={achat.id} className="border-b border-slate-50 align-top">
                    <td className="py-3 pr-3">
                      <button
                        type="button"
                        className={clsx(
                          "font-medium text-left",
                          etudeFinalisee ? "text-slate-800 cursor-default" : "text-slate-800 hover:text-primaire-600"
                        )}
                        onClick={() => {
                          if (!etudeFinalisee) {
                            setAchatEdition(achat);
                          }
                        }}
                      >
                        {achat.designation}
                      </button>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        {achat.fournisseur && <span>{achat.fournisseur}</span>}
                        {achat.reference_fournisseur && <span className="font-mono">{achat.reference_fournisseur}</span>}
                        {achat.ligne_source_designation && <span>{achat.ligne_source_designation}</span>}
                      </div>
                    </td>
                    <td className="py-3 pr-3 text-right font-mono text-xs text-slate-700">
                      {formaterNombre(achat.quantite_besoin, ` ${achat.unite_achat}`)}
                    </td>
                    <td className="py-3 pr-3 text-right font-mono text-xs text-slate-700">
                      {formaterNombre(achat.quantite_conditionnement, ` ${achat.unite_achat}`)}
                      <div className="text-[11px] text-slate-400">
                        {formaterNombre(achat.nombre_conditionnements, " colis")}
                      </div>
                    </td>
                    <td className="py-3 pr-3 text-right font-mono text-xs text-slate-700">
                      {formaterNombre(achat.quantite_commandee, ` ${achat.unite_achat}`)}
                    </td>
                    <td className="py-3 pr-3 text-right font-mono text-xs font-semibold text-slate-800">
                      {formaterMontant(achat.cout_total_achat_ht)}
                    </td>
                    <td className="py-3 pr-3 text-right font-mono text-xs text-slate-700">
                      {formaterMontant(achat.surcout_conditionnement_ht)}
                    </td>
                    {!etudeFinalisee && (
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            className="text-slate-500 hover:text-primaire-700"
                            onClick={() => setAchatEdition(achat)}
                            title="Modifier l'achat"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          {suppressionAchatId === achat.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                className="text-xs text-red-600 hover:underline"
                                onClick={() => mutationSupprimerAchat.mutate(achat.id)}
                              >
                                Confirmer
                              </button>
                              <button
                                type="button"
                                className="text-xs text-slate-500 hover:underline"
                                onClick={() => setSuppressionAchatId(null)}
                              >
                                Annuler
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="text-slate-500 hover:text-red-600"
                              onClick={() => setSuppressionAchatId(achat.id)}
                              title="Supprimer l'achat"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {ligneEdition !== undefined && (
        <ModalLigneEtudePrix
          etudeId={etude.id}
          ligne={ligneEdition}
          onClose={() => setLigneEdition(undefined)}
          onSuccess={() => rafraichir(ligneEdition ? "Ressource mise à jour." : "Ressource ajoutée.")}
        />
      )}

      {achatEdition !== undefined && (
        <ModalAchatEtudePrix
          etudeId={etude.id}
          achat={achatEdition}
          onClose={() => setAchatEdition(undefined)}
          onSuccess={() => rafraichir(achatEdition ? "Achat mis à jour." : "Achat ajouté.")}
        />
      )}

      {editionEtude && (
        <ModalEditionEtudePrix
          etude={etude}
          onClose={() => setEditionEtude(false)}
          onSuccess={() => rafraichir("Étude de prix mise à jour.")}
        />
      )}

      {publicationOuverte && (
        <ModalPublicationEtudePrix
          etudeId={etude.id}
          onClose={() => setPublicationOuverte(false)}
          onSuccess={() => rafraichir("Étude publiée dans la bibliothèque de prix.")}
        />
      )}
    </div>
  );
}
