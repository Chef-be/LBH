"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { EtatTeleversement } from "@/composants/ui/EtatTeleversement";
import {
  api,
  ErreurApi,
  extraireListeResultats,
  requeteApiAvecProgression,
  type ProgressionTeleversement,
} from "@/crochets/useApi";
import { ChampOrganisationRapide, type OrganisationOption } from "@/composants/projets/ChampOrganisationRapide";
import { WizardQualificationProjet, type OrientationProjetWizard } from "@/composants/projets/WizardQualificationProjet";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DonneesProjet {
  reference: string;
  intitule: string;
  type_projet: string;
  type_projet_autre?: string;
  clientele_cible: string;
  objectif_mission: string;
  phase_actuelle?: string;
  statut: string;
  organisation: string;
  maitre_ouvrage?: string;
  maitre_oeuvre?: string;
  commune?: string;
  departement?: string;
  date_debut_prevue?: string;
  date_fin_prevue?: string;
  montant_estime?: string;
  honoraires_prevus?: string;
  qualification_wizard?: Record<string, string | string[]>;
}

interface ProjetCree {
  id: string;
  reference: string;
  intitule: string;
}

interface PieceDocumentaireVerifiee {
  code: string;
  intitule: string;
  description: string;
  obligatoire: boolean;
  presence: boolean;
  documents: Array<{
    id: string;
    reference: string;
    intitule: string;
    type_document: string;
    dossier_chemin?: string | null;
  }>;
}

interface QualificationDocumentaireProjet {
  synthese: {
    documents_total: number;
    documents_analyses: number;
    pieces_attendues: number;
    pieces_obligatoires: number;
    pieces_couvertes: number;
    pieces_manquantes: number;
    taux_couverture: number;
  };
  pieces: PieceDocumentaireVerifiee[];
  alertes: string[];
}

interface ResultatCreationProjet {
  projet: ProjetCree;
  qualification: QualificationDocumentaireProjet;
  importes: number;
  erreursImport: string[];
}

function nomSansExtension(nom: string): string {
  return nom.replace(/\.[^/.]+$/, "").trim();
}

function estArchiveZip(fichier: File): boolean {
  return fichier.name.toLowerCase().endsWith(".zip") || fichier.type === "application/zip";
}

function intituleDocumentSource(fichier: File): string {
  return nomSansExtension(fichier.name).replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim() || "Document source";
}

function referenceDocumentSource(referenceProjet: string, fichier: File, index: number): string {
  const base = nomSansExtension(fichier.name)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toUpperCase()
    .slice(0, 32);
  return `${referenceProjet}-SRC-${String(index + 1).padStart(2, "0")}${base ? `-${base}` : ""}`.slice(0, 100);
}

function tailleLisible(octets: number): string {
  if (octets < 1024) return `${octets} o`;
  if (octets < 1024 * 1024) return `${(octets / 1024).toFixed(1)} Ko`;
  return `${(octets / (1024 * 1024)).toFixed(1)} Mo`;
}

// ---------------------------------------------------------------------------
// Composant
// ---------------------------------------------------------------------------

export function FormulaireNouveauProjet() {
  const router = useRouter();
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [typeProjet, setTypeProjet] = useState("etude");
  const [typeProjetAutre, setTypeProjetAutre] = useState("");
  const [clienteleCible, setClienteleCible] = useState("moa_publique");
  const [objectifMission, setObjectifMission] = useState("verifier_enveloppe");
  const [phaseActuelle, setPhaseActuelle] = useState("");
  const [organisationId, setOrganisationId] = useState("");
  const [maitreOuvrageId, setMaitreOuvrageId] = useState("");
  const [maitreOeuvreId, setMaitreOeuvreId] = useState("");
  const [reponsesWizard, setReponsesWizard] = useState<Record<string, string | string[]>>({});
  const [fichiersSources, setFichiersSources] = useState<File[]>([]);
  const [progressionTeleversement, setProgressionTeleversement] = useState<ProgressionTeleversement | null>(null);
  const [libelleTeleversement, setLibelleTeleversement] = useState("Téléversement des pièces sources");
  const [resultatCreation, setResultatCreation] = useState<ResultatCreationProjet | null>(null);
  const [soumissionEnCours, setSoumissionEnCours] = useState(false);

  const { data: organisations = [] } = useQuery<OrganisationOption[]>({
    queryKey: ["organisations"],
    queryFn: () => api.get<OrganisationOption[]>("/api/organisations/"),
    select: (data) => extraireListeResultats(data),
  });

  const organisationsTriees = useMemo(
    () => [...organisations].sort((a, b) => a.nom.localeCompare(b.nom, "fr")),
    [organisations]
  );

  const { data: orientation } = useQuery<OrientationProjetWizard>({
    queryKey: ["projets-orientation", clienteleCible, objectifMission, typeProjet, phaseActuelle],
    queryFn: () =>
      api.get<OrientationProjetWizard>(
        `/api/projets/orientation/?clientele_cible=${encodeURIComponent(clienteleCible)}&objectif_mission=${encodeURIComponent(objectifMission)}&type_projet=${encodeURIComponent(typeProjet)}&phase_actuelle=${encodeURIComponent(phaseActuelle)}`
      ),
  });

  const { mutateAsync } = useMutation({
    mutationFn: (donnees: DonneesProjet) => api.post<ProjetCree>("/api/projets/", donnees),
  });

  const piecesAttendues = orientation?.controle_documentaire.pieces_attendues ?? [];

  function ajouterFichiers(selection: FileList | null) {
    if (!selection?.length) return;
    setFichiersSources((courants) => {
      const suivants = [...courants];
      for (const fichier of Array.from(selection)) {
        const dejaPresent = suivants.some(
          (element) =>
            element.name === fichier.name &&
            element.size === fichier.size &&
            element.lastModified === fichier.lastModified
        );
        if (!dejaPresent) {
          suivants.push(fichier);
        }
      }
      return suivants;
    });
  }

  function retirerFichier(index: number) {
    setFichiersSources((courants) => courants.filter((_, position) => position !== index));
  }

  async function televerserPiecesSources(projet: ProjetCree) {
    let importes = 0;
    const erreursImport: string[] = [];

    for (const [index, fichier] of fichiersSources.entries()) {
      try {
        if (estArchiveZip(fichier)) {
          setLibelleTeleversement(`Import de l’archive ${fichier.name}`);
          const formData = new FormData();
          formData.append("fichier", fichier);
          formData.append("projet", projet.id);
          const reponse = await requeteApiAvecProgression<{
            importes: number;
            erreurs?: Array<{ fichier: string; detail: string }>;
          }>("/api/documents/importer-archive/", {
            method: "POST",
            corps: formData,
            onProgression: setProgressionTeleversement,
          });
          importes += reponse.importes ?? 0;
          for (const erreur of reponse.erreurs ?? []) {
            erreursImport.push(`${erreur.fichier} : ${erreur.detail}`);
          }
          continue;
        }

        setLibelleTeleversement(`Analyse de ${fichier.name}`);
        const formData = new FormData();
        formData.append("fichier", fichier);
        formData.append("projet", projet.id);
        formData.append("reference", referenceDocumentSource(projet.reference, fichier, index));
        formData.append("intitule", intituleDocumentSource(fichier));
        await requeteApiAvecProgression<{ id: string }>("/api/documents/", {
          method: "POST",
          corps: formData,
          onProgression: setProgressionTeleversement,
        });
        importes += 1;
      } catch (erreur) {
        erreursImport.push(
          `${fichier.name} : ${erreur instanceof ErreurApi ? erreur.detail : "import impossible"}`
        );
      }
    }

    const qualification = await api.get<QualificationDocumentaireProjet>(
      `/api/projets/${projet.id}/qualification-documentaire/`
    );
    return { importes, erreursImport, qualification };
  }

  async function soumettre(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErreurs({});
    setResultatCreation(null);
    setProgressionTeleversement(null);
    setLibelleTeleversement("Téléversement des pièces sources");
    setSoumissionEnCours(true);
    const formulaire = new FormData(e.currentTarget);
    const donnees: DonneesProjet = {
      reference: formulaire.get("reference") as string,
      intitule: formulaire.get("intitule") as string,
      type_projet: typeProjet,
      clientele_cible: clienteleCible,
      objectif_mission: objectifMission,
      qualification_wizard: reponsesWizard,
      statut: formulaire.get("statut") as string,
      organisation: organisationId,
    };
    if (phaseActuelle) donnees.phase_actuelle = phaseActuelle;
    if (typeProjet === "autre" && typeProjetAutre.trim()) {
      donnees.type_projet_autre = typeProjetAutre.trim();
    }
    if (maitreOuvrageId) donnees.maitre_ouvrage = maitreOuvrageId;
    if (maitreOeuvreId) donnees.maitre_oeuvre = maitreOeuvreId;
    const commune = formulaire.get("commune") as string;
    if (commune) donnees.commune = commune;
    const dept = formulaire.get("departement") as string;
    if (dept) donnees.departement = dept;
    const debut = formulaire.get("date_debut_prevue") as string;
    if (debut) donnees.date_debut_prevue = debut;
    const fin = formulaire.get("date_fin_prevue") as string;
    if (fin) donnees.date_fin_prevue = fin;
    const montant = formulaire.get("montant_estime") as string;
    if (montant) donnees.montant_estime = montant;
    const honoraires = formulaire.get("honoraires_prevus") as string;
    if (honoraires) donnees.honoraires_prevus = honoraires;

    try {
      const projet = await mutateAsync(donnees);
      if (!fichiersSources.length) {
        router.push(`/projets/${projet.id}`);
        return;
      }
      const resultatTeleversement = await televerserPiecesSources(projet);
      setResultatCreation({
        projet,
        importes: resultatTeleversement.importes,
        erreursImport: resultatTeleversement.erreursImport,
        qualification: resultatTeleversement.qualification,
      });
      setTimeout(() => setProgressionTeleversement(null), 400);
    } catch (err) {
      if (err instanceof ErreurApi && err.erreurs) {
        const nouvellesErreurs: Record<string, string> = {};
        Object.entries(err.erreurs).forEach(([champ, messages]) => {
          if (Array.isArray(messages)) {
            nouvellesErreurs[champ] = messages[0];
          }
        });
        setErreurs(nouvellesErreurs);
        return;
      }
      setErreurs({ formulaire: err instanceof Error ? err.message : "Création du projet impossible." });
    } finally {
      setSoumissionEnCours(false);
    }
  }

  if (resultatCreation) {
    const piecesPresentes = resultatCreation.qualification.pieces.filter((piece) => piece.presence);
    const piecesManquantes = resultatCreation.qualification.pieces.filter(
      (piece) => piece.obligatoire && !piece.presence
    );

    return (
      <div className="carte space-y-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primaire-600">Projet créé</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-900">
            {resultatCreation.projet.reference} · {resultatCreation.projet.intitule}
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Les fichiers sources ont été versés dans la GED du projet puis analysés pour contrôler les pièces présentes et manquantes.
          </p>
        </div>

        <EtatTeleversement progression={progressionTeleversement} libelle={libelleTeleversement} />

        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Imports</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{resultatCreation.importes}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Documents analysés</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {resultatCreation.qualification.synthese.documents_analyses} / {resultatCreation.qualification.synthese.documents_total}
            </p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-xs uppercase tracking-wide text-emerald-700">Pièces couvertes</p>
            <p className="mt-2 text-2xl font-semibold text-emerald-900">
              {resultatCreation.qualification.synthese.pieces_couvertes}
            </p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs uppercase tracking-wide text-amber-700">Pièces manquantes</p>
            <p className="mt-2 text-2xl font-semibold text-amber-900">
              {resultatCreation.qualification.synthese.pieces_manquantes}
            </p>
          </div>
        </div>

        {resultatCreation.erreursImport.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-semibold">Imports partiels</p>
            <ul className="mt-2 space-y-1">
              {resultatCreation.erreursImport.map((erreur) => (
                <li key={erreur}>• {erreur}</li>
              ))}
            </ul>
          </div>
        )}

        {resultatCreation.qualification.alertes.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <p className="font-semibold text-slate-900">Contrôles documentaires</p>
            <ul className="mt-2 space-y-1">
              {resultatCreation.qualification.alertes.map((alerte) => (
                <li key={alerte}>• {alerte}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
            <p className="text-sm font-semibold text-emerald-900">Pièces détectées</p>
            <ul className="mt-3 space-y-2 text-sm text-emerald-950">
              {piecesPresentes.length ? piecesPresentes.map((piece) => (
                <li key={piece.code}>
                  <span className="font-medium">{piece.intitule}</span>
                  <span className="text-emerald-800"> · {piece.documents.length} document(s)</span>
                </li>
              )) : <li>Aucune pièce reconnue pour l’instant.</li>}
            </ul>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
            <p className="text-sm font-semibold text-amber-900">Pièces encore attendues</p>
            <ul className="mt-3 space-y-2 text-sm text-amber-950">
              {piecesManquantes.length ? piecesManquantes.map((piece) => (
                <li key={piece.code}>
                  <span className="font-medium">{piece.intitule}</span>
                  <p className="text-xs text-amber-900/80">{piece.description}</p>
                </li>
              )) : <li>Toutes les pièces obligatoires ont été repérées.</li>}
            </ul>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-secondaire" onClick={() => router.push("/projets")}>
            Revenir à la liste
          </button>
          <button
            type="button"
            className="btn-primaire"
            onClick={() => router.push(`/projets/${resultatCreation.projet.id}`)}
          >
            Ouvrir le projet
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={soumettre} className="carte space-y-5">
      {/* Identification */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="libelle-champ" htmlFor="reference">Référence *</label>
          <input
            id="reference"
            name="reference"
            type="text"
            required
            placeholder="Ex : 2026-VRD-001"
            className="champ-saisie font-mono"
          />
          {erreurs.reference && <p className="text-xs text-red-500 mt-1">{erreurs.reference}</p>}
        </div>

        <div>
          <label className="libelle-champ" htmlFor="type_projet">Type de projet *</label>
          <select
            id="type_projet"
            name="type_projet"
            className="champ-saisie"
            required
            value={typeProjet}
            onChange={(e) => setTypeProjet(e.target.value)}
          >
            <option value="etude">Étude</option>
            <option value="travaux">Travaux</option>
            <option value="mission_moe">Mission MOE</option>
            <option value="assistance">Assistance à MOA</option>
            <option value="expertise">Expertise</option>
            <option value="autre">Autre</option>
          </select>
        </div>
      </div>

      <div>
        <label className="libelle-champ" htmlFor="intitule">Intitulé *</label>
        <input
          id="intitule"
          name="intitule"
          type="text"
          required
          placeholder="Description courte du projet"
          className="champ-saisie"
        />
        {erreurs.intitule && <p className="text-xs text-red-500 mt-1">{erreurs.intitule}</p>}
      </div>

      {typeProjet === "autre" && (
        <div>
          <label className="libelle-champ" htmlFor="type_projet_autre">Préciser le type de projet *</label>
          <input
            id="type_projet_autre"
            name="type_projet_autre"
            type="text"
            value={typeProjetAutre}
            onChange={(e) => setTypeProjetAutre(e.target.value)}
            required
            placeholder="Définir le type de projet"
            className="champ-saisie"
          />
          {erreurs.type_projet_autre && <p className="text-xs text-red-500 mt-1">{erreurs.type_projet_autre}</p>}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="libelle-champ" htmlFor="clientele_cible">Clientèle cible *</label>
          <select
            id="clientele_cible"
            name="clientele_cible"
            className="champ-saisie"
            value={clienteleCible}
            onChange={(e) => setClienteleCible(e.target.value)}
          >
            <option value="moa_publique">Maîtrise d&apos;ouvrage publique</option>
            <option value="moe_conception">Équipe de maîtrise d&apos;œuvre</option>
            <option value="entreprise_travaux">Entreprise de travaux</option>
            <option value="cotraitrance">Co-traitance</option>
            <option value="sous_traitance">Sous-traitance</option>
            <option value="autre">Autre contexte</option>
          </select>
        </div>

        <div>
          <label className="libelle-champ" htmlFor="objectif_mission">Objectif principal *</label>
          <select
            id="objectif_mission"
            name="objectif_mission"
            className="champ-saisie"
            value={objectifMission}
            onChange={(e) => setObjectifMission(e.target.value)}
          >
            <option value="verifier_enveloppe">Vérifier l&apos;enveloppe budgétaire</option>
            <option value="estimation_moe">Estimation analytique de maîtrise d&apos;œuvre</option>
            <option value="redaction_dce_cctp">Rédaction DCE / CCTP</option>
            <option value="reponse_ao_entreprise">Réponse à appel d&apos;offres entreprise</option>
            <option value="devis_entreprise">Chiffrage de devis / BPU / DPGF</option>
            <option value="prospection_ao">Prospection d&apos;appels d&apos;offres</option>
            <option value="suivi_execution">Suivi d&apos;exécution et bilan</option>
            <option value="autre">Autre objectif</option>
          </select>
        </div>
      </div>

      <div>
        <label className="libelle-champ" htmlFor="phase_actuelle">Phase actuelle</label>
        <select
          id="phase_actuelle"
          name="phase_actuelle"
          className="champ-saisie"
          value={phaseActuelle}
          onChange={(e) => setPhaseActuelle(e.target.value)}
        >
          <option value="">— À préciser —</option>
          <option value="faisabilite">Faisabilité</option>
          <option value="programmation">Programmation</option>
          <option value="esquisse">Esquisse / ESQ</option>
          <option value="avp">APS</option>
          <option value="pro">APD / PRO</option>
          <option value="dce">DCE</option>
          <option value="ao">Appel d&apos;offres</option>
          <option value="exe">Exécution / DET</option>
          <option value="reception">Réception / AOR</option>
          <option value="clos">Clos</option>
        </select>
      </div>

      {orientation && (
        <WizardQualificationProjet
          orientation={orientation}
          reponses={reponsesWizard}
          afficherSynthese={false}
          onChange={(identifiant, valeur) =>
            setReponsesWizard((courant) => ({ ...courant, [identifiant]: valeur }))
          }
        />
      )}

      <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primaire-600">Pièces sources</p>
          <h3 className="mt-1 text-base font-semibold text-slate-900">Téléverser les documents à analyser dès la création</h3>
          <p className="mt-1 text-sm text-slate-600">
            Les fichiers et archives ZIP seront versés dans la GED du projet, analysés automatiquement, puis contrôlés selon leur contenu réel pour vérifier les pièces présentes ou manquantes.
          </p>
        </div>

        <EtatTeleversement progression={progressionTeleversement} libelle={libelleTeleversement} />

        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-3">
            <label className="libelle-champ" htmlFor="fichiers-sources">
              Fichiers source et archives
            </label>
            <input
              id="fichiers-sources"
              type="file"
              className="champ-saisie"
              multiple
              accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.odt,.ods,.zip,.png,.jpg,.jpeg,.tif,.tiff,.dwg,.dxf"
              onChange={(event) => {
                ajouterFichiers(event.target.files);
                event.currentTarget.value = "";
              }}
            />
            <p className="text-xs text-slate-500">
              Formats admis : PDF, Word, Excel, images, DWG/DXF, textes structurés et archives ZIP.
            </p>

            <div className="space-y-2">
              {fichiersSources.length ? fichiersSources.map((fichier, index) => (
                <div
                  key={`${fichier.name}-${fichier.lastModified}-${index}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900">{fichier.name}</p>
                    <p className="text-xs text-slate-500">
                      {tailleLisible(fichier.size)} · {estArchiveZip(fichier) ? "Archive ZIP" : "Fichier source"}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="text-sm font-medium text-slate-500 hover:text-red-600"
                    onClick={() => retirerFichier(index)}
                  >
                    Retirer
                  </button>
                </div>
              )) : (
                <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-5 text-sm text-slate-500">
                  Aucun document source sélectionné pour l’instant.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-900">Contrôle documentaire attendu</p>
            <p className="mt-1 text-xs text-slate-500">
              {orientation?.controle_documentaire.resume || "Le wizard contrôle les pièces réellement détectées après analyse."}
            </p>
            <ul className="mt-3 space-y-3">
              {piecesAttendues.length ? piecesAttendues.map((piece) => (
                <li key={piece.code} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-sm font-medium text-slate-900">{piece.intitule}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${piece.obligatoire ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"}`}>
                      {piece.obligatoire ? "Obligatoire" : "Complémentaire"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{piece.description}</p>
                  {piece.types_documents.length > 0 && (
                    <p className="mt-2 text-[11px] uppercase tracking-wide text-slate-400">
                      Types suivis : {piece.types_documents.join(" · ")}
                    </p>
                  )}
                </li>
              )) : (
                <li className="text-sm text-slate-500">Les pièces attendues apparaîtront selon la clientèle et l’objectif sélectionnés.</li>
              )}
            </ul>
          </div>
        </div>
      </div>

      {/* Organisation et statut */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <ChampOrganisationRapide
            label="Bureau d'études"
            name="organisation"
            required
            placeholder="— Sélectionner —"
            typeOrganisation="bureau_etudes"
            organisations={organisationsTriees}
            value={organisationId}
            onChange={setOrganisationId}
          />
          {erreurs.organisation && <p className="text-xs text-red-500 mt-1">{erreurs.organisation}</p>}
        </div>

        <div>
          <label className="libelle-champ" htmlFor="statut">Statut initial</label>
          <select id="statut" name="statut" className="champ-saisie" defaultValue="en_cours">
            <option value="prospection">Prospection</option>
            <option value="en_cours">En cours</option>
          </select>
        </div>
      </div>

      {/* Maître d'ouvrage */}
      <div>
        <ChampOrganisationRapide
          label="Maître d'ouvrage"
          name="maitre_ouvrage"
          placeholder="— Optionnel —"
          typeOrganisation="maitre_ouvrage"
          organisations={organisationsTriees}
          value={maitreOuvrageId}
          onChange={setMaitreOuvrageId}
        />
      </div>

      <div>
        <label className="libelle-champ" htmlFor="maitre_oeuvre">Maître d&apos;œuvre</label>
        <select
          id="maitre_oeuvre"
          name="maitre_oeuvre"
          className="champ-saisie"
          value={maitreOeuvreId}
          onChange={(e) => setMaitreOeuvreId(e.target.value)}
        >
          <option value="">— Optionnel —</option>
          {organisationsTriees
            .filter((org) => ["bureau_etudes", "partenaire"].includes(org.type_organisation))
            .map((org) => (
              <option key={org.id} value={org.id}>{org.nom}</option>
            ))}
        </select>
      </div>

      {/* Localisation */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <label className="libelle-champ" htmlFor="commune">Commune</label>
          <input id="commune" name="commune" type="text" placeholder="Ex : Lyon" className="champ-saisie" />
        </div>
        <div>
          <label className="libelle-champ" htmlFor="departement">Département</label>
          <input id="departement" name="departement" type="text" placeholder="Ex : 69" maxLength={3} className="champ-saisie" />
        </div>
      </div>

      {/* Calendrier */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="libelle-champ" htmlFor="date_debut_prevue">Début prévu</label>
          <input id="date_debut_prevue" name="date_debut_prevue" type="date" className="champ-saisie" />
        </div>
        <div>
          <label className="libelle-champ" htmlFor="date_fin_prevue">Fin prévue</label>
          <input id="date_fin_prevue" name="date_fin_prevue" type="date" className="champ-saisie" />
        </div>
      </div>

      {/* Financier */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="libelle-champ" htmlFor="montant_estime">Montant estimé HT (€)</label>
          <input
            id="montant_estime"
            name="montant_estime"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            className="champ-saisie"
          />
        </div>
        <div>
          <label className="libelle-champ" htmlFor="honoraires_prevus">Honoraires prévus HT (€)</label>
          <input
            id="honoraires_prevus"
            name="honoraires_prevus"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            className="champ-saisie"
          />
        </div>
      </div>

      {erreurs.formulaire && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {erreurs.formulaire}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" className="btn-secondaire" onClick={() => router.back()} disabled={soumissionEnCours}>
          Annuler
        </button>
        <button type="submit" className="btn-primaire" disabled={soumissionEnCours}>
          {soumissionEnCours ? "Création et analyse en cours…" : "Créer le projet"}
        </button>
      </div>
    </form>
  );
}
