"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { api, ErreurApi } from "@/crochets/useApi";
import { EditeurTexteRiche } from "@/composants/ui/EditeurTexteRiche";
import type { ConfigurationSite } from "@/contextes/FournisseurConfiguration";
import {
  obtenirContenuAccueil,
  obtenirContenuContact,
  obtenirContenuNotreMethode,
  obtenirContenuPrestations,
  obtenirContenuReferences,
  obtenirNomPlateforme,
  type ContenuAccueil,
  type ContenuContact,
  type ContenuNotreMethode,
  type ContenuPrestations,
  type ContenuReferences,
} from "@/lib/site-public";
import {
  AlerteAdmin,
  EntetePageAdmin,
} from "@/composants/administration/Presentation";

type OngletId = "accueil" | "contact" | "methode" | "prestations" | "references";

const ONGLETS: { id: OngletId; libelle: string }[] = [
  { id: "accueil", libelle: "Accueil" },
  { id: "contact", libelle: "Contact" },
  { id: "methode", libelle: "Notre méthode" },
  { id: "prestations", libelle: "Prestations" },
  { id: "references", libelle: "Références" },
];

const CHAMP_TEXTE = "champ-saisie w-full";
const CHAMP_TEXTAREA = "champ-saisie w-full resize-none";

function Libelle({ children }: { children: React.ReactNode }) {
  return <label className="libelle-champ">{children}</label>;
}

function CarteEdition({
  titre,
  description,
  children,
}: {
  titre: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">{titre}</h2>
        {description && <p className="mt-1 text-xs text-slate-500">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function ChampListeLignes({
  valeur,
  onChange,
  placeholder,
  rows = 4,
}: {
  valeur: string[];
  onChange: (valeur: string[]) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      rows={rows}
      className={CHAMP_TEXTAREA}
      value={valeur.join("\n")}
      onChange={(e) =>
        onChange(
          e.target.value
            .split("\n")
            .map((ligne) => ligne.trim())
            .filter(Boolean)
        )
      }
      placeholder={placeholder}
    />
  );
}

function ChampTexteRiche({
  valeur,
  onChange,
  placeholder,
}: {
  valeur: string;
  onChange: (valeur: string) => void;
  placeholder?: string;
}) {
  return (
    <EditeurTexteRiche
      valeur={valeur}
      onChange={onChange}
      placeholder={placeholder}
      hauteurMinimale="min-h-[180px]"
    />
  );
}

export default function PageContenusEditoriaux() {
  const [onglet, setOnglet] = useState<OngletId>("accueil");
  const [chargement, setChargement] = useState(true);
  const [enregistrement, setEnregistrement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState(false);
  const [nomBureau, setNomBureau] = useState("");
  const [contenuAccueil, setContenuAccueil] = useState<ContenuAccueil>(obtenirContenuAccueil());
  const [contenuContact, setContenuContact] = useState<ContenuContact>(obtenirContenuContact());
  const [contenuMethode, setContenuMethode] = useState<ContenuNotreMethode>(obtenirContenuNotreMethode());
  const [contenuPrestations, setContenuPrestations] = useState<ContenuPrestations>(obtenirContenuPrestations());
  const [contenuReferences, setContenuReferences] = useState<ContenuReferences>(obtenirContenuReferences());

  useEffect(() => {
    api.get<ConfigurationSite>("/api/site/configuration/")
      .then((configuration) => {
        setNomBureau(obtenirNomPlateforme(configuration));
        setContenuAccueil(obtenirContenuAccueil(configuration));
        setContenuContact(obtenirContenuContact(configuration));
        setContenuMethode(obtenirContenuNotreMethode(configuration));
        setContenuPrestations(obtenirContenuPrestations(configuration));
        setContenuReferences(obtenirContenuReferences(configuration));
      })
      .catch(() => setErreur("Impossible de charger les contenus éditoriaux."))
      .finally(() => setChargement(false));
  }, []);

  const chargeUtile = useMemo(
    () => ({
      contenu_accueil: contenuAccueil,
      contenus_pages: {
        contact: contenuContact,
        notre_methode: contenuMethode,
        prestations: contenuPrestations,
        references: contenuReferences,
      },
    }),
    [contenuAccueil, contenuContact, contenuMethode, contenuPrestations, contenuReferences]
  );

  const enregistrer = async () => {
    setEnregistrement(true);
    setErreur(null);
    setSucces(false);
    try {
      await api.patch("/api/site/configuration/", chargeUtile);
      setSucces(true);
      setTimeout(() => setSucces(false), 3000);
    } catch (cause) {
      setErreur(cause instanceof ErreurApi ? cause.detail : "Impossible d'enregistrer les contenus.");
    } finally {
      setEnregistrement(false);
    }
  };

  if (chargement) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-slate-500">
        Chargement des contenus éditoriaux…
      </div>
    );
  }

  return (
      <div className="space-y-6 max-w-6xl">
      <EntetePageAdmin
        titre="Contenus éditoriaux"
        description={`Gérez les textes, encarts et pages publiques${nomBureau ? ` de ${nomBureau}` : ""} sans manipuler le JSON.`}
        actions={(
          <button
            onClick={enregistrer}
            disabled={enregistrement}
            className="btn-primaire disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {enregistrement ? "Enregistrement…" : (
              <>
                <Save className="w-4 h-4" />
                Enregistrer
              </>
            )}
          </button>
        )}
        statistiques={[
          { libelle: "Accueil", valeur: contenuAccueil.sections.prestations_titre || "Configuré" },
          { libelle: "Contact", valeur: contenuContact.hero.titre || "Configuré" },
          { libelle: "Méthode", valeur: `${contenuMethode.phases.liste.length} phase(s)` },
          { libelle: "Références", valeur: `${contenuReferences.domaines_exemple.length} exemple(s)` },
        ]}
      />

      {succes && (
        <AlerteAdmin type="succes">Les contenus éditoriaux ont été enregistrés.</AlerteAdmin>
      )}
      {erreur && (
        <AlerteAdmin type="erreur">{erreur}</AlerteAdmin>
      )}

      <div className="border-b border-slate-200">
        <nav className="flex flex-wrap gap-1">
          {ONGLETS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setOnglet(item.id)}
              className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                onglet === item.id
                  ? "border-primaire-600 text-primaire-700"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {item.libelle}
            </button>
          ))}
        </nav>
      </div>

      {onglet === "accueil" && (
        <div className="space-y-5">
          <CarteEdition
            titre="Référencement et héros"
            description="Ces contenus alimentent le sous-titre de secours de l’accueil, les indicateurs et les intitulés des grandes sections."
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <Libelle>Description SEO par défaut</Libelle>
                <textarea
                  rows={3}
                  className={CHAMP_TEXTAREA}
                  value={contenuAccueil.metadata.description_par_defaut}
                  onChange={(e) =>
                    setContenuAccueil((prev) => ({
                      ...prev,
                      metadata: { ...prev.metadata, description_par_defaut: e.target.value },
                    }))
                  }
                />
              </div>
              <div>
                <Libelle>Indicateurs de confiance</Libelle>
                <ChampListeLignes
                  valeur={contenuAccueil.hero.indicateurs}
                  onChange={(indicateurs) =>
                    setContenuAccueil((prev) => ({
                      ...prev,
                      hero: { ...prev.hero, indicateurs },
                    }))
                  }
                  placeholder={"Économie de la construction\nDimensionnement VRD"}
                />
              </div>
            </div>
            <div>
              <Libelle>Sous-titre de secours</Libelle>
              <ChampTexteRiche
                valeur={contenuAccueil.hero.sous_titre_secours}
                onChange={(sous_titre_secours) =>
                  setContenuAccueil((prev) => ({
                    ...prev,
                    hero: { ...prev.hero, sous_titre_secours },
                  }))
                }
                placeholder="Texte de secours affiché si aucun sous-titre personnalisé n'est saisi dans l'identité du site."
              />
            </div>
          </CarteEdition>

          <CarteEdition
            titre="Intitulés des sections"
            description="Personnalisez les badges, titres, descriptions et boutons de la page d’accueil."
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <Libelle>Badge prestations</Libelle>
                <input
                  type="text"
                  className={CHAMP_TEXTE}
                  value={contenuAccueil.sections.prestations_badge}
                  onChange={(e) =>
                    setContenuAccueil((prev) => ({
                      ...prev,
                      sections: { ...prev.sections, prestations_badge: e.target.value },
                    }))
                  }
                />
              </div>
              <div>
                <Libelle>Titre prestations</Libelle>
                <input
                  type="text"
                  className={CHAMP_TEXTE}
                  value={contenuAccueil.sections.prestations_titre}
                  onChange={(e) =>
                    setContenuAccueil((prev) => ({
                      ...prev,
                      sections: { ...prev.sections, prestations_titre: e.target.value },
                    }))
                  }
                />
              </div>
              <div className="lg:col-span-2">
                <Libelle>Description prestations</Libelle>
                <ChampTexteRiche
                  valeur={contenuAccueil.sections.prestations_description}
                  onChange={(prestations_description) =>
                    setContenuAccueil((prev) => ({
                      ...prev,
                      sections: { ...prev.sections, prestations_description },
                    }))
                  }
                />
              </div>
              <div>
                <Libelle>Bouton prestations</Libelle>
                <input
                  type="text"
                  className={CHAMP_TEXTE}
                  value={contenuAccueil.sections.prestations_bouton}
                  onChange={(e) =>
                    setContenuAccueil((prev) => ({
                      ...prev,
                      sections: { ...prev.sections, prestations_bouton: e.target.value },
                    }))
                  }
                />
              </div>
              <div>
                <Libelle>Badge valeurs</Libelle>
                <input
                  type="text"
                  className={CHAMP_TEXTE}
                  value={contenuAccueil.sections.valeurs_badge}
                  onChange={(e) =>
                    setContenuAccueil((prev) => ({
                      ...prev,
                      sections: { ...prev.sections, valeurs_badge: e.target.value },
                    }))
                  }
                />
              </div>
              <div>
                <Libelle>Titre valeurs</Libelle>
                <input
                  type="text"
                  className={CHAMP_TEXTE}
                  value={contenuAccueil.sections.valeurs_titre}
                  onChange={(e) =>
                    setContenuAccueil((prev) => ({
                      ...prev,
                      sections: { ...prev.sections, valeurs_titre: e.target.value },
                    }))
                  }
                />
              </div>
              <div>
                <Libelle>Badge secteurs</Libelle>
                <input
                  type="text"
                  className={CHAMP_TEXTE}
                  value={contenuAccueil.sections.secteurs_badge}
                  onChange={(e) =>
                    setContenuAccueil((prev) => ({
                      ...prev,
                      sections: { ...prev.sections, secteurs_badge: e.target.value },
                    }))
                  }
                />
              </div>
              <div>
                <Libelle>Titre secteurs</Libelle>
                <input
                  type="text"
                  className={CHAMP_TEXTE}
                  value={contenuAccueil.sections.secteurs_titre}
                  onChange={(e) =>
                    setContenuAccueil((prev) => ({
                      ...prev,
                      sections: { ...prev.sections, secteurs_titre: e.target.value },
                    }))
                  }
                />
              </div>
              <div className="lg:col-span-2">
                <Libelle>Description secteurs</Libelle>
                <ChampTexteRiche
                  valeur={contenuAccueil.sections.secteurs_description}
                  onChange={(secteurs_description) =>
                    setContenuAccueil((prev) => ({
                      ...prev,
                      sections: { ...prev.sections, secteurs_description },
                    }))
                  }
                />
              </div>
              <div>
                <Libelle>Badge méthode</Libelle>
                <input
                  type="text"
                  className={CHAMP_TEXTE}
                  value={contenuAccueil.sections.pilotage_badge}
                  onChange={(e) =>
                    setContenuAccueil((prev) => ({
                      ...prev,
                      sections: { ...prev.sections, pilotage_badge: e.target.value },
                    }))
                  }
                />
              </div>
              <div>
                <Libelle>Titre méthode</Libelle>
                <input
                  type="text"
                  className={CHAMP_TEXTE}
                  value={contenuAccueil.sections.pilotage_titre}
                  onChange={(e) =>
                    setContenuAccueil((prev) => ({
                      ...prev,
                      sections: { ...prev.sections, pilotage_titre: e.target.value },
                    }))
                  }
                />
              </div>
              <div className="lg:col-span-2">
                <Libelle>Description méthode</Libelle>
                <ChampTexteRiche
                  valeur={contenuAccueil.sections.pilotage_description}
                  onChange={(pilotage_description) =>
                    setContenuAccueil((prev) => ({
                      ...prev,
                      sections: { ...prev.sections, pilotage_description },
                    }))
                  }
                />
              </div>
              <div>
                <Libelle>Badge démarche</Libelle>
                <input
                  type="text"
                  className={CHAMP_TEXTE}
                  value={contenuAccueil.sections.demarche_badge}
                  onChange={(e) =>
                    setContenuAccueil((prev) => ({
                      ...prev,
                      sections: { ...prev.sections, demarche_badge: e.target.value },
                    }))
                  }
                />
              </div>
              <div>
                <Libelle>Titre démarche</Libelle>
                <input
                  type="text"
                  className={CHAMP_TEXTE}
                  value={contenuAccueil.sections.demarche_titre}
                  onChange={(e) =>
                    setContenuAccueil((prev) => ({
                      ...prev,
                      sections: { ...prev.sections, demarche_titre: e.target.value },
                    }))
                  }
                />
              </div>
              <div className="lg:col-span-2">
                <Libelle>Description démarche</Libelle>
                <ChampTexteRiche
                  valeur={contenuAccueil.sections.demarche_description}
                  onChange={(demarche_description) =>
                    setContenuAccueil((prev) => ({
                      ...prev,
                      sections: { ...prev.sections, demarche_description },
                    }))
                  }
                />
              </div>
              <div>
                <Libelle>Bouton démarche</Libelle>
                <input
                  type="text"
                  className={CHAMP_TEXTE}
                  value={contenuAccueil.sections.demarche_bouton}
                  onChange={(e) =>
                    setContenuAccueil((prev) => ({
                      ...prev,
                      sections: { ...prev.sections, demarche_bouton: e.target.value },
                    }))
                  }
                />
              </div>
              <div>
                <Libelle>Badge réalisations</Libelle>
                <input
                  type="text"
                  className={CHAMP_TEXTE}
                  value={contenuAccueil.sections.realisations_badge}
                  onChange={(e) =>
                    setContenuAccueil((prev) => ({
                      ...prev,
                      sections: { ...prev.sections, realisations_badge: e.target.value },
                    }))
                  }
                />
              </div>
              <div>
                <Libelle>Titre réalisations</Libelle>
                <input
                  type="text"
                  className={CHAMP_TEXTE}
                  value={contenuAccueil.sections.realisations_titre}
                  onChange={(e) =>
                    setContenuAccueil((prev) => ({
                      ...prev,
                      sections: { ...prev.sections, realisations_titre: e.target.value },
                    }))
                  }
                />
              </div>
              <div>
                <Libelle>Bouton réalisations</Libelle>
                <input
                  type="text"
                  className={CHAMP_TEXTE}
                  value={contenuAccueil.sections.realisations_bouton}
                  onChange={(e) =>
                    setContenuAccueil((prev) => ({
                      ...prev,
                      sections: { ...prev.sections, realisations_bouton: e.target.value },
                    }))
                  }
                />
              </div>
              <div>
                <Libelle>Badge contact</Libelle>
                <input
                  type="text"
                  className={CHAMP_TEXTE}
                  value={contenuAccueil.sections.contact_badge}
                  onChange={(e) =>
                    setContenuAccueil((prev) => ({
                      ...prev,
                      sections: { ...prev.sections, contact_badge: e.target.value },
                    }))
                  }
                />
              </div>
              <div>
                <Libelle>Titre contact</Libelle>
                <input
                  type="text"
                  className={CHAMP_TEXTE}
                  value={contenuAccueil.sections.contact_titre}
                  onChange={(e) =>
                    setContenuAccueil((prev) => ({
                      ...prev,
                      sections: { ...prev.sections, contact_titre: e.target.value },
                    }))
                  }
                />
              </div>
              <div className="lg:col-span-2">
                <Libelle>Description contact</Libelle>
                <ChampTexteRiche
                  valeur={contenuAccueil.sections.contact_description}
                  onChange={(contact_description) =>
                    setContenuAccueil((prev) => ({
                      ...prev,
                      sections: { ...prev.sections, contact_description },
                    }))
                  }
                />
              </div>
            </div>
          </CarteEdition>

          <CarteEdition titre="Encarts secteurs d'intervention">
            <div className="space-y-4">
              {contenuAccueil.secteurs.map((secteur, index) => (
                <div key={`${secteur.titre}-${index}`} className="rounded-xl border border-slate-200 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-slate-800">Secteur {index + 1}</h3>
                    <button
                      type="button"
                      className="text-red-500 hover:text-red-700"
                      onClick={() =>
                        setContenuAccueil((prev) => ({
                          ...prev,
                          secteurs: prev.secteurs.filter((_, itemIndex) => itemIndex !== index),
                        }))
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div>
                      <Libelle>Titre</Libelle>
                      <input
                        type="text"
                        className={CHAMP_TEXTE}
                        value={secteur.titre}
                        onChange={(e) =>
                          setContenuAccueil((prev) => ({
                            ...prev,
                            secteurs: prev.secteurs.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, titre: e.target.value } : item
                            ),
                          }))
                        }
                      />
                    </div>
                    <div>
                      <Libelle>Icône Lucide</Libelle>
                      <input
                        type="text"
                        className={CHAMP_TEXTE}
                        value={secteur.icone}
                        onChange={(e) =>
                          setContenuAccueil((prev) => ({
                            ...prev,
                            secteurs: prev.secteurs.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, icone: e.target.value } : item
                            ),
                          }))
                        }
                        placeholder="Building2"
                      />
                    </div>
                    <div className="lg:col-span-2">
                      <Libelle>Description</Libelle>
                      <ChampTexteRiche
                        valeur={secteur.description}
                        onChange={(description) =>
                          setContenuAccueil((prev) => ({
                            ...prev,
                            secteurs: prev.secteurs.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, description } : item
                            ),
                          }))
                        }
                      />
                    </div>
                    <div className="lg:col-span-2">
                      <Libelle>Tags</Libelle>
                      <ChampListeLignes
                        valeur={secteur.tags}
                        onChange={(tags) =>
                          setContenuAccueil((prev) => ({
                            ...prev,
                            secteurs: prev.secteurs.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, tags } : item
                            ),
                          }))
                        }
                        placeholder={"Estimation préalable\nContrôle des coûts"}
                        rows={3}
                      />
                    </div>
                  </div>
                </div>
              ))}
              <button
                type="button"
                className="btn-secondaire text-sm"
                onClick={() =>
                  setContenuAccueil((prev) => ({
                    ...prev,
                    secteurs: [
                      ...prev.secteurs,
                      { titre: "Nouveau secteur", icone: "Building2", description: "", tags: [] },
                    ],
                  }))
                }
              >
                <Plus className="h-4 w-4" />
                Ajouter un encart secteur
              </button>
            </div>
          </CarteEdition>

          <CarteEdition titre="Encarts méthode et garanties">
            <div className="space-y-4">
              {contenuAccueil.pilotage.map((bloc, index) => (
                <div key={`${bloc.titre}-${index}`} className="rounded-xl border border-slate-200 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-slate-800">Bloc {index + 1}</h3>
                    <button
                      type="button"
                      className="text-red-500 hover:text-red-700"
                      onClick={() =>
                        setContenuAccueil((prev) => ({
                          ...prev,
                          pilotage: prev.pilotage.filter((_, itemIndex) => itemIndex !== index),
                        }))
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div>
                      <Libelle>Titre</Libelle>
                      <input
                        type="text"
                        className={CHAMP_TEXTE}
                        value={bloc.titre}
                        onChange={(e) =>
                          setContenuAccueil((prev) => ({
                            ...prev,
                            pilotage: prev.pilotage.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, titre: e.target.value } : item
                            ),
                          }))
                        }
                      />
                    </div>
                    <div>
                      <Libelle>Icône Lucide</Libelle>
                      <input
                        type="text"
                        className={CHAMP_TEXTE}
                        value={bloc.icone}
                        onChange={(e) =>
                          setContenuAccueil((prev) => ({
                            ...prev,
                            pilotage: prev.pilotage.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, icone: e.target.value } : item
                            ),
                          }))
                        }
                      />
                    </div>
                    <div className="lg:col-span-2">
                      <Libelle>Description</Libelle>
                      <ChampTexteRiche
                        valeur={bloc.description}
                        onChange={(description) =>
                          setContenuAccueil((prev) => ({
                            ...prev,
                            pilotage: prev.pilotage.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, description } : item
                            ),
                          }))
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}
              <button
                type="button"
                className="btn-secondaire text-sm"
                onClick={() =>
                  setContenuAccueil((prev) => ({
                    ...prev,
                    pilotage: [
                      ...prev.pilotage,
                      { titre: "Nouveau bloc", icone: "FileText", description: "" },
                    ],
                  }))
                }
              >
                <Plus className="h-4 w-4" />
                Ajouter un encart méthode
              </button>
            </div>
          </CarteEdition>
        </div>
      )}

      {onglet === "contact" && (
        <div className="space-y-5">
          <CarteEdition titre="Métadonnées et en-tête">
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <Libelle>Titre de page</Libelle>
                <input
                  type="text"
                  className={CHAMP_TEXTE}
                  value={contenuContact.metadata.titre_page}
                  onChange={(e) =>
                    setContenuContact((prev) => ({
                      ...prev,
                      metadata: { ...prev.metadata, titre_page: e.target.value },
                    }))
                  }
                />
              </div>
              <div>
                <Libelle>Description SEO</Libelle>
                <textarea
                  rows={3}
                  className={CHAMP_TEXTAREA}
                  value={contenuContact.metadata.description_page}
                  onChange={(e) =>
                    setContenuContact((prev) => ({
                      ...prev,
                      metadata: { ...prev.metadata, description_page: e.target.value },
                    }))
                  }
                />
              </div>
              <div>
                <Libelle>Badge</Libelle>
                <input
                  type="text"
                  className={CHAMP_TEXTE}
                  value={contenuContact.hero.badge}
                  onChange={(e) =>
                    setContenuContact((prev) => ({
                      ...prev,
                      hero: { ...prev.hero, badge: e.target.value },
                    }))
                  }
                />
              </div>
              <div>
                <Libelle>Titre</Libelle>
                <input
                  type="text"
                  className={CHAMP_TEXTE}
                  value={contenuContact.hero.titre}
                  onChange={(e) =>
                    setContenuContact((prev) => ({
                      ...prev,
                      hero: { ...prev.hero, titre: e.target.value },
                    }))
                  }
                />
              </div>
              <div className="lg:col-span-2">
                <Libelle>Description</Libelle>
                <ChampTexteRiche
                  valeur={contenuContact.hero.description}
                  onChange={(description) =>
                    setContenuContact((prev) => ({
                      ...prev,
                      hero: { ...prev.hero, description },
                    }))
                  }
                />
              </div>
            </div>
          </CarteEdition>

          <CarteEdition titre="Blocs de la page contact">
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <Libelle>Titre coordonnées</Libelle>
                <input
                  type="text"
                  className={CHAMP_TEXTE}
                  value={contenuContact.coordonnees.titre}
                  onChange={(e) =>
                    setContenuContact((prev) => ({
                      ...prev,
                      coordonnees: { ...prev.coordonnees, titre: e.target.value },
                    }))
                  }
                />
              </div>
              <div>
                <Libelle>Titre formulaire</Libelle>
                <input
                  type="text"
                  className={CHAMP_TEXTE}
                  value={contenuContact.formulaire.titre}
                  onChange={(e) =>
                    setContenuContact((prev) => ({
                      ...prev,
                      formulaire: { ...prev.formulaire, titre: e.target.value },
                    }))
                  }
                />
              </div>
              <div>
                <Libelle>Libellé délai</Libelle>
                <input
                  type="text"
                  className={CHAMP_TEXTE}
                  value={contenuContact.coordonnees.delai_titre}
                  onChange={(e) =>
                    setContenuContact((prev) => ({
                      ...prev,
                      coordonnees: { ...prev.coordonnees, delai_titre: e.target.value },
                    }))
                  }
                />
              </div>
              <div>
                <Libelle>Valeur délai</Libelle>
                <input
                  type="text"
                  className={CHAMP_TEXTE}
                  value={contenuContact.coordonnees.delai_valeur}
                  onChange={(e) =>
                    setContenuContact((prev) => ({
                      ...prev,
                      coordonnees: { ...prev.coordonnees, delai_valeur: e.target.value },
                    }))
                  }
                />
              </div>
              <div>
                <Libelle>Titre exemples</Libelle>
                <input
                  type="text"
                  className={CHAMP_TEXTE}
                  value={contenuContact.exemples.titre}
                  onChange={(e) =>
                    setContenuContact((prev) => ({
                      ...prev,
                      exemples: { ...prev.exemples, titre: e.target.value },
                    }))
                  }
                />
              </div>
              <div>
                <Libelle>Question espace privé</Libelle>
                <input
                  type="text"
                  className={CHAMP_TEXTE}
                  value={contenuContact.espace_prive.question}
                  onChange={(e) =>
                    setContenuContact((prev) => ({
                      ...prev,
                      espace_prive: { ...prev.espace_prive, question: e.target.value },
                    }))
                  }
                />
              </div>
              <div>
                <Libelle>Bouton espace privé</Libelle>
                <input
                  type="text"
                  className={CHAMP_TEXTE}
                  value={contenuContact.espace_prive.bouton}
                  onChange={(e) =>
                    setContenuContact((prev) => ({
                      ...prev,
                      espace_prive: { ...prev.espace_prive, bouton: e.target.value },
                    }))
                  }
                />
              </div>
              <div className="lg:col-span-2">
                <Libelle>Liste des exemples</Libelle>
                <ChampListeLignes
                  valeur={contenuContact.exemples.liste}
                  onChange={(liste) =>
                    setContenuContact((prev) => ({
                      ...prev,
                      exemples: { ...prev.exemples, liste },
                    }))
                  }
                  placeholder={"Demande de devis\nAccompagnement maîtrise d'œuvre"}
                  rows={5}
                />
              </div>
            </div>
          </CarteEdition>
        </div>
      )}

      {onglet === "methode" && (
        <div className="space-y-5">
          <CarteEdition titre="Métadonnées et en-tête">
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <Libelle>Titre de page</Libelle>
                <input
                  type="text"
                  className={CHAMP_TEXTE}
                  value={contenuMethode.metadata.titre_page}
                  onChange={(e) =>
                    setContenuMethode((prev) => ({
                      ...prev,
                      metadata: { ...prev.metadata, titre_page: e.target.value },
                    }))
                  }
                />
              </div>
              <div>
                <Libelle>Description SEO</Libelle>
                <textarea
                  rows={3}
                  className={CHAMP_TEXTAREA}
                  value={contenuMethode.metadata.description_page}
                  onChange={(e) =>
                    setContenuMethode((prev) => ({
                      ...prev,
                      metadata: { ...prev.metadata, description_page: e.target.value },
                    }))
                  }
                />
              </div>
              <div>
                <Libelle>Badge</Libelle>
                <input
                  type="text"
                  className={CHAMP_TEXTE}
                  value={contenuMethode.hero.badge}
                  onChange={(e) =>
                    setContenuMethode((prev) => ({
                      ...prev,
                      hero: { ...prev.hero, badge: e.target.value },
                    }))
                  }
                />
              </div>
              <div>
                <Libelle>Titre</Libelle>
                <input
                  type="text"
                  className={CHAMP_TEXTE}
                  value={contenuMethode.hero.titre}
                  onChange={(e) =>
                    setContenuMethode((prev) => ({
                      ...prev,
                      hero: { ...prev.hero, titre: e.target.value },
                    }))
                  }
                />
              </div>
              <div className="lg:col-span-2">
                <Libelle>Description</Libelle>
                <ChampTexteRiche
                  valeur={contenuMethode.hero.description}
                  onChange={(description) =>
                    setContenuMethode((prev) => ({
                      ...prev,
                      hero: { ...prev.hero, description },
                    }))
                  }
                />
              </div>
            </div>
          </CarteEdition>

          <CarteEdition titre="Encarts engagements">
            <div className="space-y-4">
              {contenuMethode.engagements.liste.map((engagement, index) => (
                <div key={`${engagement.libelle}-${index}`} className="grid gap-4 lg:grid-cols-[140px,1fr,auto] items-end rounded-xl border border-slate-200 p-4">
                  <div>
                    <Libelle>Valeur</Libelle>
                    <input
                      type="text"
                      className={CHAMP_TEXTE}
                      value={engagement.valeur}
                      onChange={(e) =>
                        setContenuMethode((prev) => ({
                          ...prev,
                          engagements: {
                            ...prev.engagements,
                            liste: prev.engagements.liste.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, valeur: e.target.value } : item
                            ),
                          },
                        }))
                      }
                    />
                  </div>
                  <div>
                    <Libelle>Libellé</Libelle>
                    <input
                      type="text"
                      className={CHAMP_TEXTE}
                      value={engagement.libelle}
                      onChange={(e) =>
                        setContenuMethode((prev) => ({
                          ...prev,
                          engagements: {
                            ...prev.engagements,
                            liste: prev.engagements.liste.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, libelle: e.target.value } : item
                            ),
                          },
                        }))
                      }
                    />
                  </div>
                  <button
                    type="button"
                    className="mb-1 text-red-500 hover:text-red-700"
                    onClick={() =>
                      setContenuMethode((prev) => ({
                        ...prev,
                        engagements: {
                          ...prev.engagements,
                          liste: prev.engagements.liste.filter((_, itemIndex) => itemIndex !== index),
                        },
                      }))
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="btn-secondaire text-sm"
                onClick={() =>
                  setContenuMethode((prev) => ({
                    ...prev,
                    engagements: {
                      ...prev.engagements,
                      liste: [...prev.engagements.liste, { valeur: "", libelle: "" }],
                    },
                  }))
                }
              >
                <Plus className="h-4 w-4" />
                Ajouter un engagement
              </button>
            </div>
          </CarteEdition>

          <CarteEdition titre="Phases de travail">
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <Libelle>Badge</Libelle>
                <input
                  type="text"
                  className={CHAMP_TEXTE}
                  value={contenuMethode.phases.badge}
                  onChange={(e) =>
                    setContenuMethode((prev) => ({
                      ...prev,
                      phases: { ...prev.phases, badge: e.target.value },
                    }))
                  }
                />
              </div>
              <div>
                <Libelle>Titre</Libelle>
                <input
                  type="text"
                  className={CHAMP_TEXTE}
                  value={contenuMethode.phases.titre}
                  onChange={(e) =>
                    setContenuMethode((prev) => ({
                      ...prev,
                      phases: { ...prev.phases, titre: e.target.value },
                    }))
                  }
                />
              </div>
            </div>
            <div className="space-y-4">
              {contenuMethode.phases.liste.map((phase, index) => (
                <div key={`${phase.numero}-${index}`} className="rounded-xl border border-slate-200 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-slate-800">Phase {phase.numero || index + 1}</h3>
                    <button
                      type="button"
                      className="text-red-500 hover:text-red-700"
                      onClick={() =>
                        setContenuMethode((prev) => ({
                          ...prev,
                          phases: {
                            ...prev.phases,
                            liste: prev.phases.liste.filter((_, itemIndex) => itemIndex !== index),
                          },
                        }))
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-3">
                    <div>
                      <Libelle>Numéro</Libelle>
                      <input
                        type="text"
                        className={CHAMP_TEXTE}
                        value={phase.numero}
                        onChange={(e) =>
                          setContenuMethode((prev) => ({
                            ...prev,
                            phases: {
                              ...prev.phases,
                              liste: prev.phases.liste.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, numero: e.target.value } : item
                              ),
                            },
                          }))
                        }
                      />
                    </div>
                    <div>
                      <Libelle>Icône</Libelle>
                      <input
                        type="text"
                        className={CHAMP_TEXTE}
                        value={phase.icone}
                        onChange={(e) =>
                          setContenuMethode((prev) => ({
                            ...prev,
                            phases: {
                              ...prev.phases,
                              liste: prev.phases.liste.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, icone: e.target.value } : item
                              ),
                            },
                          }))
                        }
                      />
                    </div>
                    <div>
                      <Libelle>Titre</Libelle>
                      <input
                        type="text"
                        className={CHAMP_TEXTE}
                        value={phase.titre}
                        onChange={(e) =>
                          setContenuMethode((prev) => ({
                            ...prev,
                            phases: {
                              ...prev.phases,
                              liste: prev.phases.liste.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, titre: e.target.value } : item
                              ),
                            },
                          }))
                        }
                      />
                    </div>
                    <div className="lg:col-span-3">
                      <Libelle>Description</Libelle>
                      <ChampTexteRiche
                        valeur={phase.description}
                        onChange={(description) =>
                          setContenuMethode((prev) => ({
                            ...prev,
                            phases: {
                              ...prev.phases,
                              liste: prev.phases.liste.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, description } : item
                              ),
                            },
                          }))
                        }
                      />
                    </div>
                    <div className="lg:col-span-3">
                      <Libelle>Points clés</Libelle>
                      <ChampListeLignes
                        valeur={phase.points}
                        onChange={(points) =>
                          setContenuMethode((prev) => ({
                            ...prev,
                            phases: {
                              ...prev.phases,
                              liste: prev.phases.liste.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, points } : item
                              ),
                            },
                          }))
                        }
                        rows={5}
                      />
                    </div>
                  </div>
                </div>
              ))}
              <button
                type="button"
                className="btn-secondaire text-sm"
                onClick={() =>
                  setContenuMethode((prev) => ({
                    ...prev,
                    phases: {
                      ...prev.phases,
                      liste: [
                        ...prev.phases.liste,
                        { numero: "", icone: "Search", titre: "", description: "", points: [] },
                      ],
                    },
                  }))
                }
              >
                <Plus className="h-4 w-4" />
                Ajouter une phase
              </button>
            </div>
          </CarteEdition>

          <CarteEdition titre="Référentiels et appel à l'action">
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <Libelle>Badge référentiels</Libelle>
                <input
                  type="text"
                  className={CHAMP_TEXTE}
                  value={contenuMethode.referentiels.badge}
                  onChange={(e) =>
                    setContenuMethode((prev) => ({
                      ...prev,
                      referentiels: { ...prev.referentiels, badge: e.target.value },
                    }))
                  }
                />
              </div>
              <div>
                <Libelle>Titre référentiels</Libelle>
                <input
                  type="text"
                  className={CHAMP_TEXTE}
                  value={contenuMethode.referentiels.titre}
                  onChange={(e) =>
                    setContenuMethode((prev) => ({
                      ...prev,
                      referentiels: { ...prev.referentiels, titre: e.target.value },
                    }))
                  }
                />
              </div>
              <div className="lg:col-span-2">
                <Libelle>Description référentiels</Libelle>
                <ChampTexteRiche
                  valeur={contenuMethode.referentiels.description}
                  onChange={(description) =>
                    setContenuMethode((prev) => ({
                      ...prev,
                      referentiels: { ...prev.referentiels, description },
                    }))
                  }
                />
              </div>
            </div>
            <div className="space-y-4">
              {contenuMethode.referentiels.liste.map((reference, index) => (
                <div key={`${reference.titre}-${index}`} className="grid gap-4 lg:grid-cols-[1fr,2fr,auto] items-end rounded-xl border border-slate-200 p-4">
                  <div>
                    <Libelle>Titre</Libelle>
                    <input
                      type="text"
                      className={CHAMP_TEXTE}
                      value={reference.titre}
                      onChange={(e) =>
                        setContenuMethode((prev) => ({
                          ...prev,
                          referentiels: {
                            ...prev.referentiels,
                            liste: prev.referentiels.liste.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, titre: e.target.value } : item
                            ),
                          },
                        }))
                      }
                    />
                  </div>
                  <div>
                    <Libelle>Description</Libelle>
                    <textarea
                      rows={3}
                      className={CHAMP_TEXTAREA}
                      value={reference.description}
                      onChange={(e) =>
                        setContenuMethode((prev) => ({
                          ...prev,
                          referentiels: {
                            ...prev.referentiels,
                            liste: prev.referentiels.liste.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, description: e.target.value } : item
                            ),
                          },
                        }))
                      }
                    />
                  </div>
                  <button
                    type="button"
                    className="mb-1 text-red-500 hover:text-red-700"
                    onClick={() =>
                      setContenuMethode((prev) => ({
                        ...prev,
                        referentiels: {
                          ...prev.referentiels,
                          liste: prev.referentiels.liste.filter((_, itemIndex) => itemIndex !== index),
                        },
                      }))
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="btn-secondaire text-sm"
                onClick={() =>
                  setContenuMethode((prev) => ({
                    ...prev,
                    referentiels: {
                      ...prev.referentiels,
                      liste: [...prev.referentiels.liste, { titre: "", description: "" }],
                    },
                  }))
                }
              >
                <Plus className="h-4 w-4" />
                Ajouter un référentiel
              </button>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <Libelle>Titre CTA</Libelle>
                <input
                  type="text"
                  className={CHAMP_TEXTE}
                  value={contenuMethode.cta.titre}
                  onChange={(e) =>
                    setContenuMethode((prev) => ({
                      ...prev,
                      cta: { ...prev.cta, titre: e.target.value },
                    }))
                  }
                />
              </div>
              <div>
                <Libelle>Bouton principal</Libelle>
                <input
                  type="text"
                  className={CHAMP_TEXTE}
                  value={contenuMethode.cta.bouton_principal}
                  onChange={(e) =>
                    setContenuMethode((prev) => ({
                      ...prev,
                      cta: { ...prev.cta, bouton_principal: e.target.value },
                    }))
                  }
                />
              </div>
              <div>
                <Libelle>Bouton secondaire</Libelle>
                <input
                  type="text"
                  className={CHAMP_TEXTE}
                  value={contenuMethode.cta.bouton_secondaire}
                  onChange={(e) =>
                    setContenuMethode((prev) => ({
                      ...prev,
                      cta: { ...prev.cta, bouton_secondaire: e.target.value },
                    }))
                  }
                />
              </div>
              <div className="lg:col-span-2">
                <Libelle>Description CTA</Libelle>
                <ChampTexteRiche
                  valeur={contenuMethode.cta.description}
                  onChange={(description) =>
                    setContenuMethode((prev) => ({
                      ...prev,
                      cta: { ...prev.cta, description },
                    }))
                  }
                />
              </div>
            </div>
          </CarteEdition>
        </div>
      )}

      {onglet === "prestations" && (
        <div className="space-y-5">
          <CarteEdition titre="En-tête et CTA de la page">
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <Libelle>Titre de page</Libelle>
                <input
                  type="text"
                  className={CHAMP_TEXTE}
                  value={contenuPrestations.metadata.titre_page}
                  onChange={(e) =>
                    setContenuPrestations((prev) => ({
                      ...prev,
                      metadata: { ...prev.metadata, titre_page: e.target.value },
                    }))
                  }
                />
              </div>
              <div>
                <Libelle>Description SEO</Libelle>
                <textarea
                  rows={3}
                  className={CHAMP_TEXTAREA}
                  value={contenuPrestations.metadata.description_page}
                  onChange={(e) =>
                    setContenuPrestations((prev) => ({
                      ...prev,
                      metadata: { ...prev.metadata, description_page: e.target.value },
                    }))
                  }
                />
              </div>
              <div>
                <Libelle>Badge</Libelle>
                <input
                  type="text"
                  className={CHAMP_TEXTE}
                  value={contenuPrestations.hero.badge}
                  onChange={(e) =>
                    setContenuPrestations((prev) => ({
                      ...prev,
                      hero: { ...prev.hero, badge: e.target.value },
                    }))
                  }
                />
              </div>
              <div>
                <Libelle>Titre</Libelle>
                <input
                  type="text"
                  className={CHAMP_TEXTE}
                  value={contenuPrestations.hero.titre}
                  onChange={(e) =>
                    setContenuPrestations((prev) => ({
                      ...prev,
                      hero: { ...prev.hero, titre: e.target.value },
                    }))
                  }
                />
              </div>
              <div className="lg:col-span-2">
                <Libelle>Description</Libelle>
                <ChampTexteRiche
                  valeur={contenuPrestations.hero.description}
                  onChange={(description) =>
                    setContenuPrestations((prev) => ({
                      ...prev,
                      hero: { ...prev.hero, description },
                    }))
                  }
                />
              </div>
              <div>
                <Libelle>Titre CTA bas de page</Libelle>
                <input
                  type="text"
                  className={CHAMP_TEXTE}
                  value={contenuPrestations.cta_bas_page.titre}
                  onChange={(e) =>
                    setContenuPrestations((prev) => ({
                      ...prev,
                      cta_bas_page: { ...prev.cta_bas_page, titre: e.target.value },
                    }))
                  }
                />
              </div>
              <div>
                <Libelle>Bouton CTA</Libelle>
                <input
                  type="text"
                  className={CHAMP_TEXTE}
                  value={contenuPrestations.cta_bas_page.bouton}
                  onChange={(e) =>
                    setContenuPrestations((prev) => ({
                      ...prev,
                      cta_bas_page: { ...prev.cta_bas_page, bouton: e.target.value },
                    }))
                  }
                />
              </div>
              <div className="lg:col-span-2">
                <Libelle>Description CTA</Libelle>
                <ChampTexteRiche
                  valeur={contenuPrestations.cta_bas_page.description}
                  onChange={(description) =>
                    setContenuPrestations((prev) => ({
                      ...prev,
                      cta_bas_page: { ...prev.cta_bas_page, description },
                    }))
                  }
                />
              </div>
            </div>
          </CarteEdition>

          <CarteEdition titre="Catégories et libellés des pages détail">
            <div className="grid gap-4 lg:grid-cols-2">
              {Object.entries(contenuPrestations.categories).map(([cle, valeur]) => (
                <div key={cle}>
                  <Libelle>{cle}</Libelle>
                  <input
                    type="text"
                    className={CHAMP_TEXTE}
                    value={valeur}
                    onChange={(e) =>
                      setContenuPrestations((prev) => ({
                        ...prev,
                        categories: { ...prev.categories, [cle]: e.target.value },
                      }))
                    }
                  />
                </div>
              ))}
              {Object.entries(contenuPrestations.detail).map(([cle, valeur]) => (
                <div key={cle}>
                  <Libelle>{cle}</Libelle>
                  <input
                    type="text"
                    className={CHAMP_TEXTE}
                    value={valeur}
                    onChange={(e) =>
                      setContenuPrestations((prev) => ({
                        ...prev,
                        detail: { ...prev.detail, [cle]: e.target.value },
                      }))
                    }
                  />
                </div>
              ))}
            </div>
          </CarteEdition>
        </div>
      )}

      {onglet === "references" && (
        <div className="space-y-5">
          <CarteEdition titre="En-tête et états de la page">
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <Libelle>Titre de page</Libelle>
                <input
                  type="text"
                  className={CHAMP_TEXTE}
                  value={contenuReferences.metadata.titre_page}
                  onChange={(e) =>
                    setContenuReferences((prev) => ({
                      ...prev,
                      metadata: { ...prev.metadata, titre_page: e.target.value },
                    }))
                  }
                />
              </div>
              <div>
                <Libelle>Description SEO</Libelle>
                <textarea
                  rows={3}
                  className={CHAMP_TEXTAREA}
                  value={contenuReferences.metadata.description_page}
                  onChange={(e) =>
                    setContenuReferences((prev) => ({
                      ...prev,
                      metadata: { ...prev.metadata, description_page: e.target.value },
                    }))
                  }
                />
              </div>
              <div>
                <Libelle>Badge</Libelle>
                <input
                  type="text"
                  className={CHAMP_TEXTE}
                  value={contenuReferences.hero.badge}
                  onChange={(e) =>
                    setContenuReferences((prev) => ({
                      ...prev,
                      hero: { ...prev.hero, badge: e.target.value },
                    }))
                  }
                />
              </div>
              <div>
                <Libelle>Titre</Libelle>
                <input
                  type="text"
                  className={CHAMP_TEXTE}
                  value={contenuReferences.hero.titre}
                  onChange={(e) =>
                    setContenuReferences((prev) => ({
                      ...prev,
                      hero: { ...prev.hero, titre: e.target.value },
                    }))
                  }
                />
              </div>
              <div className="lg:col-span-2">
                <Libelle>Description</Libelle>
                <ChampTexteRiche
                  valeur={contenuReferences.hero.description}
                  onChange={(description) =>
                    setContenuReferences((prev) => ({
                      ...prev,
                      hero: { ...prev.hero, description },
                    }))
                  }
                />
              </div>
              <div>
                <Libelle>Sur-titre état vide</Libelle>
                <input
                  type="text"
                  className={CHAMP_TEXTE}
                  value={contenuReferences.etat_vide.sur_titre}
                  onChange={(e) =>
                    setContenuReferences((prev) => ({
                      ...prev,
                      etat_vide: { ...prev.etat_vide, sur_titre: e.target.value },
                    }))
                  }
                />
              </div>
              <div>
                <Libelle>Titre état vide</Libelle>
                <input
                  type="text"
                  className={CHAMP_TEXTE}
                  value={contenuReferences.etat_vide.titre}
                  onChange={(e) =>
                    setContenuReferences((prev) => ({
                      ...prev,
                      etat_vide: { ...prev.etat_vide, titre: e.target.value },
                    }))
                  }
                />
              </div>
              <div className="lg:col-span-2">
                <Libelle>Description état vide</Libelle>
                <ChampTexteRiche
                  valeur={contenuReferences.etat_vide.description}
                  onChange={(description) =>
                    setContenuReferences((prev) => ({
                      ...prev,
                      etat_vide: { ...prev.etat_vide, description },
                    }))
                  }
                />
              </div>
              <div>
                <Libelle>Titre liste</Libelle>
                <input
                  type="text"
                  className={CHAMP_TEXTE}
                  value={contenuReferences.liste.titre}
                  onChange={(e) =>
                    setContenuReferences((prev) => ({
                      ...prev,
                      liste: { ...prev.liste, titre: e.target.value },
                    }))
                  }
                />
              </div>
              <div>
                <Libelle>Titre secteurs</Libelle>
                <input
                  type="text"
                  className={CHAMP_TEXTE}
                  value={contenuReferences.secteurs.titre}
                  onChange={(e) =>
                    setContenuReferences((prev) => ({
                      ...prev,
                      secteurs: { ...prev.secteurs, titre: e.target.value },
                    }))
                  }
                />
              </div>
              <div className="lg:col-span-2">
                <Libelle>Liste des secteurs</Libelle>
                <ChampListeLignes
                  valeur={contenuReferences.secteurs.liste}
                  onChange={(liste) =>
                    setContenuReferences((prev) => ({
                      ...prev,
                      secteurs: { ...prev.secteurs, liste },
                    }))
                  }
                  rows={5}
                />
              </div>
            </div>
          </CarteEdition>

          <CarteEdition titre="Exemples et CTA">
            <div className="space-y-4">
              {contenuReferences.domaines_exemple.map((exemple, index) => (
                <div key={`${exemple.titre}-${index}`} className="rounded-xl border border-slate-200 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-slate-800">Exemple {index + 1}</h3>
                    <button
                      type="button"
                      className="text-red-500 hover:text-red-700"
                      onClick={() =>
                        setContenuReferences((prev) => ({
                          ...prev,
                          domaines_exemple: prev.domaines_exemple.filter((_, itemIndex) => itemIndex !== index),
                        }))
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div>
                      <Libelle>Titre</Libelle>
                      <input
                        type="text"
                        className={CHAMP_TEXTE}
                        value={exemple.titre}
                        onChange={(e) =>
                          setContenuReferences((prev) => ({
                            ...prev,
                            domaines_exemple: prev.domaines_exemple.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, titre: e.target.value } : item
                            ),
                          }))
                        }
                      />
                    </div>
                    <div>
                      <Libelle>Lieu</Libelle>
                      <input
                        type="text"
                        className={CHAMP_TEXTE}
                        value={exemple.lieu}
                        onChange={(e) =>
                          setContenuReferences((prev) => ({
                            ...prev,
                            domaines_exemple: prev.domaines_exemple.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, lieu: e.target.value } : item
                            ),
                          }))
                        }
                      />
                    </div>
                    <div className="lg:col-span-2">
                      <Libelle>Tags</Libelle>
                      <ChampListeLignes
                        valeur={exemple.tags}
                        onChange={(tags) =>
                          setContenuReferences((prev) => ({
                            ...prev,
                            domaines_exemple: prev.domaines_exemple.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, tags } : item
                            ),
                          }))
                        }
                        rows={4}
                      />
                    </div>
                  </div>
                </div>
              ))}
              <button
                type="button"
                className="btn-secondaire text-sm"
                onClick={() =>
                  setContenuReferences((prev) => ({
                    ...prev,
                    domaines_exemple: [
                      ...prev.domaines_exemple,
                      { titre: "", lieu: "", tags: [] },
                    ],
                  }))
                }
              >
                <Plus className="h-4 w-4" />
                Ajouter un exemple
              </button>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <Libelle>Titre CTA</Libelle>
                <input
                  type="text"
                  className={CHAMP_TEXTE}
                  value={contenuReferences.cta.titre}
                  onChange={(e) =>
                    setContenuReferences((prev) => ({
                      ...prev,
                      cta: { ...prev.cta, titre: e.target.value },
                    }))
                  }
                />
              </div>
              <div>
                <Libelle>Bouton CTA</Libelle>
                <input
                  type="text"
                  className={CHAMP_TEXTE}
                  value={contenuReferences.cta.bouton}
                  onChange={(e) =>
                    setContenuReferences((prev) => ({
                      ...prev,
                      cta: { ...prev.cta, bouton: e.target.value },
                    }))
                  }
                />
              </div>
              <div className="lg:col-span-2">
                <Libelle>Description CTA</Libelle>
                <ChampTexteRiche
                  valeur={contenuReferences.cta.description}
                  onChange={(description) =>
                    setContenuReferences((prev) => ({
                      ...prev,
                      cta: { ...prev.cta, description },
                    }))
                  }
                />
              </div>
            </div>
          </CarteEdition>
        </div>
      )}

      <details className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <summary className="cursor-pointer text-sm font-semibold text-slate-800">
          Mode avancé JSON
        </summary>
        <p className="mt-2 text-xs text-slate-500">
          Vue de contrôle des données envoyées au backend. Ce bloc reste disponible pour les ajustements très spécifiques.
        </p>
        <textarea
          readOnly
          rows={18}
          className={`${CHAMP_TEXTAREA} mt-4 font-mono text-xs bg-white`}
          value={JSON.stringify(chargeUtile, null, 2)}
        />
      </details>

      <div className="flex justify-end">
        <button
          onClick={enregistrer}
          disabled={enregistrement}
          className="btn-primaire disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {enregistrement ? "Enregistrement…" : (
            <>
              <Save className="w-4 h-4" />
              Enregistrer les contenus
            </>
          )}
        </button>
      </div>
    </div>
  );
}
