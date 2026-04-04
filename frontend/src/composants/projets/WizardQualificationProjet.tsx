"use client";

interface OptionWizard {
  value: string;
  label: string;
}

export interface QuestionWizardProjet {
  id: string;
  question: string;
  type: string;
  options?: OptionWizard[];
  reponses?: string[];
  multiple?: boolean;
  obligatoire?: boolean;
}

export interface EtapeWizardProjet {
  code: string;
  titre: string;
  description: string;
  questions: QuestionWizardProjet[];
}

export interface OrientationProjetWizard {
  clientele: { code: string; libelle: string };
  objectif: { code: string; libelle: string };
  methodes_estimation: Array<{ code: string; libelle: string; objectif: string }>;
  livrables_prioritaires: string[];
  points_de_controle: string[];
  automatismes: string[];
  sources_methodologiques: string[];
  dossiers_ged: Array<{ code: string; intitule: string; description: string }>;
  controle_documentaire: {
    resume: string;
    pieces_attendues: Array<{
      code: string;
      intitule: string;
      description: string;
      obligatoire: boolean;
      types_documents: string[];
      mots_cles: string[];
      dossier_code?: string | null;
    }>;
  };
  documents_attendus: string[];
  documents_a_generer: string[];
  wizard: {
    titre: string;
    description: string;
    etapes: EtapeWizardProjet[];
  };
}

type ReponsesWizard = Record<string, string | string[]>;

function valeurQuestion(reponses: ReponsesWizard, identifiant: string) {
  return reponses[identifiant];
}

export function decrireReponseQuestion(question: QuestionWizardProjet, reponses: ReponsesWizard): string {
  const valeur = valeurQuestion(reponses, question.id);
  if (Array.isArray(valeur)) {
    if (question.options?.length) {
      const etiquettes = question.options
        .filter((option) => valeur.includes(option.value))
        .map((option) => option.label);
      return etiquettes.join(" · ");
    }
    return valeur.join(" · ");
  }
  if (!valeur) return "Non renseigné";
  if (question.options?.length) {
    const option = question.options.find((element) => element.value === valeur);
    return option?.label || String(valeur);
  }
  return String(valeur);
}

export function WizardQualificationProjet({
  orientation,
  reponses,
  onChange,
  afficherSynthese = true,
}: {
  orientation: OrientationProjetWizard;
  reponses: ReponsesWizard;
  onChange: (identifiant: string, valeur: string | string[]) => void;
  afficherSynthese?: boolean;
}) {
  return (
    <div className="space-y-5 rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-primaire-600">Wizard projet</p>
        <h3 className="mt-1 text-base font-semibold text-slate-800">
          {orientation.clientele.libelle} · {orientation.objectif.libelle}
        </h3>
        <p className="mt-1 text-sm text-slate-500">{orientation.wizard.description}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {orientation.wizard.etapes.map((etape) => (
          <div key={etape.code} className="rounded-xl border border-slate-200 bg-white p-4">
            <h4 className="text-sm font-semibold text-slate-800">{etape.titre}</h4>
            <p className="mt-1 text-xs text-slate-500">{etape.description}</p>

            <div className="mt-4 space-y-4">
              {etape.questions.map((question) => {
                const valeur = valeurQuestion(reponses, question.id);
                if (question.type === "cases") {
                  const selection = Array.isArray(valeur) ? valeur : [];
                  return (
                    <div key={question.id}>
                      <p className="libelle-champ">
                        {question.question}
                        {question.obligatoire ? " *" : ""}
                      </p>
                      <div className="mt-2 grid gap-2">
                        {(question.options || []).map((option) => (
                          <label key={option.value} className="flex items-start gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
                            <input
                              type="checkbox"
                              checked={selection.includes(option.value)}
                              onChange={(e) => {
                                const prochaineValeur = e.target.checked
                                  ? [...selection, option.value]
                                  : selection.filter((item) => item !== option.value);
                                onChange(question.id, prochaineValeur);
                              }}
                              className="mt-0.5 rounded"
                            />
                            <span>{option.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                }

                if (question.type === "choix") {
                  return (
                    <div key={question.id}>
                      <label className="libelle-champ" htmlFor={question.id}>
                        {question.question}
                        {question.obligatoire ? " *" : ""}
                      </label>
                      <select
                        id={question.id}
                        className="champ-saisie"
                        value={typeof valeur === "string" ? valeur : ""}
                        onChange={(e) => onChange(question.id, e.target.value)}
                      >
                        <option value="">— Sélectionner —</option>
                        {(question.options || []).map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                }

                return (
                  <div key={question.id}>
                    <label className="libelle-champ" htmlFor={question.id}>
                      {question.question}
                    </label>
                    <input
                      id={question.id}
                      type="text"
                      className="champ-saisie"
                      value={typeof valeur === "string" ? valeur : ""}
                      onChange={(e) => onChange(question.id, e.target.value)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {afficherSynthese && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Méthodes</p>
            <ul className="mt-2 space-y-2 text-sm text-slate-700">
              {orientation.methodes_estimation.map((methode, index) => (
                <li key={methode.code}>
                  <span className="font-medium">{index + 1}. {methode.libelle}</span>
                  <p className="text-xs text-slate-500">{methode.objectif}</p>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Dossiers GED</p>
            <ul className="mt-2 space-y-2 text-sm text-slate-700">
              {orientation.dossiers_ged.map((dossier) => (
                <li key={dossier.code}>
                  <span className="font-medium">{dossier.intitule}</span>
                  <p className="text-xs text-slate-500">{dossier.description}</p>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Documents à générer</p>
            <ul className="mt-2 space-y-2 text-sm text-slate-700">
              {orientation.documents_a_generer.map((document) => (
                <li key={document}>• {document}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
