"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { api, requeteApiAvecProgression, type ProgressionTeleversement, ErreurApi } from "@/crochets/useApi";
import { ArrowRight, Save, Plus, Trash2, GripVertical, Upload } from "lucide-react";
import Link from "next/link";
import { EtatTeleversement } from "@/composants/ui/EtatTeleversement";
import {
  AlerteAdmin,
  CarteSectionAdmin,
  EntetePageAdmin,
} from "@/composants/administration/Presentation";

interface DiapositiveCarrousel {
  titre: string;
  sous_titre: string;
  image_url: string;
  cta_texte: string;
  cta_lien: string;
  couleur_fond: string;
}

interface ConfigurationSite {
  nom_bureau: string;
  slogan: string;
  sigle: string;
  description_courte: string;
  logo: string | null;
  logo_pied_de_page: string | null;
  favicon: string | null;
  titre_hero: string;
  sous_titre_hero: string;
  etiquette_hero: string;
  texte_cta_principal: string;
  texte_cta_secondaire: string;
  courriel_contact: string;
  telephone_contact: string;
  adresse: string;
  ville: string;
  code_postal: string;
  pays: string;
  afficher_stats: boolean;
  afficher_valeurs: boolean;
  afficher_demarche: boolean;
  afficher_realisations: boolean;
  afficher_equipe: boolean;
  afficher_contact: boolean;
  texte_cta_bandeau: string;
  texte_description_bandeau: string;
  couleur_theme: string;
  mode_theme_defaut: string;
  police_principale: string;
  activer_carrousel_accueil: boolean;
  carousel_accueil: DiapositiveCarrousel[];
  contenu_accueil: Record<string, unknown>;
  contenus_pages: Record<string, unknown>;
  meta_titre: string;
  meta_description: string;
  mots_cles: string;
}

type OngletId = "identite" | "accueil" | "coordonnees" | "sections" | "apparence" | "carrousel" | "seo";

const ONGLETS: { id: OngletId; libelle: string }[] = [
  { id: "identite",   libelle: "Identité" },
  { id: "accueil",    libelle: "Page d'accueil" },
  { id: "coordonnees", libelle: "Coordonnées" },
  { id: "sections",   libelle: "Sections" },
  { id: "apparence",  libelle: "Apparence" },
  { id: "carrousel",  libelle: "Carrousel" },
  { id: "seo",        libelle: "SEO" },
];

const CHAMP_TEXTE = "champ-saisie w-full";
const CHAMP_TEXTAREA = "champ-saisie w-full resize-none";
type ChampMedia = "logo" | "logo_pied_de_page" | "favicon";

function Libelle({ children, requis }: { children: React.ReactNode; requis?: boolean }) {
  return (
    <label className="libelle-champ">
      {children}
      {requis && <span className="text-red-500 ml-0.5" aria-label="obligatoire">*</span>}
    </label>
  );
}

export default function PageConfiguration() {
  const [onglet, setOnglet] = useState<OngletId>("identite");
  const [chargement, setChargement] = useState(true);
  const [enregistrement, setEnregistrement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState(false);
  const [progressionTeleversement, setProgressionTeleversement] = useState<ProgressionTeleversement | null>(null);
  const [libelleTeleversement, setLibelleTeleversement] = useState("Téléversement en cours");
  const [config, setConfig] = useState<ConfigurationSite>({
    nom_bureau: "", slogan: "", sigle: "", description_courte: "",
    logo: null, logo_pied_de_page: null, favicon: null,
    titre_hero: "", sous_titre_hero: "", etiquette_hero: "",
    texte_cta_principal: "Nos prestations", texte_cta_secondaire: "Nous contacter",
    courriel_contact: "", telephone_contact: "",
    adresse: "", ville: "", code_postal: "", pays: "France",
    afficher_stats: true, afficher_valeurs: true, afficher_demarche: true,
    afficher_realisations: false, afficher_equipe: false, afficher_contact: true,
    texte_cta_bandeau: "", texte_description_bandeau: "",
    couleur_theme: "bleu_marine", mode_theme_defaut: "automatique",
    police_principale: "inter", activer_carrousel_accueil: true, carousel_accueil: [], contenu_accueil: {}, contenus_pages: {},
    meta_titre: "", meta_description: "", mots_cles: "",
  });
  const [fichiersMedia, setFichiersMedia] = useState<Record<ChampMedia, File | null>>({
    logo: null,
    logo_pied_de_page: null,
    favicon: null,
  });
  const [apercusMedia, setApercusMedia] = useState<Record<ChampMedia, string | null>>({
    logo: null,
    logo_pied_de_page: null,
    favicon: null,
  });

  useEffect(() => {
    api.get<ConfigurationSite>("/api/site/configuration/")
      .then((configuration) => {
        setConfig(configuration);
      })
      .catch(() => setErreur("Impossible de charger la configuration."))
      .finally(() => setChargement(false));
  }, []);

  const maj = (champ: keyof ConfigurationSite, val: string | boolean | DiapositiveCarrousel[]) =>
    setConfig((prev) => ({ ...prev, [champ]: val }));

  const majMedia = (champ: ChampMedia, fichier: File | null) => {
    setFichiersMedia((prev) => ({ ...prev, [champ]: fichier }));
    setApercusMedia((prev) => ({
      ...prev,
      [champ]: fichier ? URL.createObjectURL(fichier) : null,
    }));
  };

  const enregistrer = async () => {
    setEnregistrement(true);
    setErreur(null);
    setSucces(false);
    setProgressionTeleversement(null);
    try {
      const contientFichier = Object.values(fichiersMedia).some(Boolean);
      const {
        logo: _logo,
        logo_pied_de_page: _logoPiedDePage,
        favicon: _favicon,
        ...configurationSansMedias
      } = config;

      if (contientFichier) {
        const formData = new FormData();
        Object.entries(configurationSansMedias).forEach(([champ, valeur]) => {
          if (champ === "contenu_accueil") {
            formData.append(champ, JSON.stringify(config.contenu_accueil ?? {}));
            return;
          }
          if (champ === "contenus_pages") {
            formData.append(champ, JSON.stringify(config.contenus_pages ?? {}));
            return;
          }
          if (Array.isArray(valeur)) {
            formData.append(champ, JSON.stringify(valeur));
            return;
          }
          formData.append(champ, String(valeur ?? ""));
        });

        (Object.entries(fichiersMedia) as [ChampMedia, File | null][]).forEach(([champ, fichier]) => {
          if (fichier) {
            formData.append(champ, fichier);
          }
        });

        setLibelleTeleversement("Téléversement des médias et enregistrement");
        await requeteApiAvecProgression("/api/site/configuration/", {
          method: "PATCH",
          corps: formData,
          onProgression: setProgressionTeleversement,
        });
      } else {
        await api.patch("/api/site/configuration/", configurationSansMedias);
      }

      const configurationRafraichie = await api.get<ConfigurationSite>("/api/site/configuration/");
      setConfig(configurationRafraichie);
      setFichiersMedia({ logo: null, logo_pied_de_page: null, favicon: null });
      setApercusMedia({ logo: null, logo_pied_de_page: null, favicon: null });
      setSucces(true);
      setTimeout(() => setSucces(false), 3000);
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Erreur lors de l'enregistrement.");
    } finally {
      setEnregistrement(false);
      setTimeout(() => setProgressionTeleversement(null), 500);
    }
  };

  const majDiapositive = (index: number, patch: Partial<DiapositiveCarrousel>) => {
    const nouv = [...config.carousel_accueil];
    nouv[index] = { ...nouv[index], ...patch };
    maj("carousel_accueil", nouv);
  };

  const televerserImageCarrousel = async (index: number, fichier: File | null) => {
    if (!fichier) return;
    setErreur(null);
    setLibelleTeleversement(`Téléversement de l'image de la diapositive ${index + 1}`);
    setProgressionTeleversement(null);
    try {
      const formData = new FormData();
      formData.append("usage", "carrousel");
      formData.append("fichier", fichier);
      const reponse = await requeteApiAvecProgression<{ url: string }>("/api/site/configuration/televersement-media/", {
        method: "POST",
        corps: formData,
        onProgression: setProgressionTeleversement,
      });
      majDiapositive(index, { image_url: reponse.url });
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.detail : "Impossible de téléverser l'image du carrousel.");
    } finally {
      setTimeout(() => setProgressionTeleversement(null), 500);
    }
  };

  if (chargement) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400 text-sm">
        Chargement de la configuration…
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* En-tête */}
      <EntetePageAdmin
        titre="Configuration du site"
        description="Identité, coordonnées, sections globales, apparence et SEO."
        actions={(
          <button
            onClick={enregistrer}
            disabled={enregistrement}
            className="btn-primaire disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {enregistrement ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Enregistrement…
              </span>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Enregistrer
              </>
            )}
          </button>
        )}
        statistiques={[
          { libelle: "Nom du bureau", valeur: config.nom_bureau || "Non renseigné" },
          { libelle: "Mode du site", valeur: config.mode_theme_defaut },
          { libelle: "Couleur", valeur: config.couleur_theme },
          { libelle: "Carrousel", valeur: config.activer_carrousel_accueil ? `${config.carousel_accueil.length} diapositive(s)` : "Désactivé" },
        ]}
      />

      {succes && (
        <AlerteAdmin type="succes">Configuration enregistrée avec succès.</AlerteAdmin>
      )}
      {erreur && (
        <AlerteAdmin type="erreur">{erreur}</AlerteAdmin>
      )}
      <EtatTeleversement
        progression={progressionTeleversement}
        libelle={libelleTeleversement}
      />

      {/* Onglets */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-1">
          {ONGLETS.map((o) => (
            <button
              key={o.id}
              onClick={() => setOnglet(o.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                onglet === o.id
                  ? "border-primaire-600 text-primaire-700"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {o.libelle}
            </button>
          ))}
        </nav>
      </div>

      {/* Contenu onglet */}
      <CarteSectionAdmin
        titre={ONGLETS.find((item) => item.id === onglet)?.libelle}
        description="Les contenus riches et les encarts éditoriaux avancés se pilotent depuis l’écran dédié."
      >
      <div className="space-y-5">
        {onglet === "identite" && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {([
                {
                  champ: "logo",
                  titre: "Logo principal",
                  description: "Utilisé dans la navigation et l'identité du site.",
                  accept: "image/*",
                },
                {
                  champ: "logo_pied_de_page",
                  titre: "Logo pied de page",
                  description: "Optionnel. S'il est absent, le logo principal est réutilisé.",
                  accept: "image/*",
                },
                {
                  champ: "favicon",
                  titre: "Favicon",
                  description: "Icône affichée dans l'onglet du navigateur.",
                  accept: ".ico,image/png,image/svg+xml",
                },
              ] as {
                champ: ChampMedia;
                titre: string;
                description: string;
                accept: string;
              }[]).map(({ champ, titre, description, accept }) => {
                const apercu = apercusMedia[champ] ?? config[champ];
                return (
                  <div key={champ} className="rounded-xl border border-slate-200 p-4 bg-slate-50/70">
                    <p className="text-sm font-semibold text-slate-900">{titre}</p>
                    <p className="text-xs text-slate-500 mt-1">{description}</p>
                    <div className="mt-4 h-24 rounded-xl border border-dashed border-slate-300 bg-white flex items-center justify-center overflow-hidden">
                      {apercu ? (
                        <div className="relative h-full w-full">
                          <Image
                            src={apercu}
                            alt={titre}
                            fill
                            unoptimized
                            className="object-contain"
                            sizes="192px"
                          />
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">Aucun visuel chargé</span>
                      )}
                    </div>
                    <label className="mt-4 inline-flex items-center justify-center w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors">
                      Choisir un fichier
                      <input
                        type="file"
                        accept={accept}
                        className="sr-only"
                        onChange={(e) => majMedia(champ, e.target.files?.[0] ?? null)}
                      />
                    </label>
                    {fichiersMedia[champ] && (
                      <p className="text-xs text-slate-500 mt-2 truncate">
                        {fichiersMedia[champ]?.name}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            <div>
              <Libelle requis>Nom du bureau</Libelle>
              <input
                type="text" className={CHAMP_TEXTE}
                value={config.nom_bureau}
                onChange={(e) => maj("nom_bureau", e.target.value)}
                placeholder="LBH Économiste"
              />
            </div>
            <div>
              <Libelle>Sigle de remplacement</Libelle>
              <input
                type="text" className={CHAMP_TEXTE}
                value={config.sigle}
                onChange={(e) => maj("sigle", e.target.value.toUpperCase())}
                placeholder="LBH"
                maxLength={12}
              />
              <p className="text-xs text-slate-400 mt-1">
                Utilisé si aucun logo n&apos;est chargé. Le sigle remplace alors le bloc logo sans déformer le design.
              </p>
            </div>
            <div>
              <Libelle>Slogan</Libelle>
              <input
                type="text" className={CHAMP_TEXTE}
                value={config.slogan}
                onChange={(e) => maj("slogan", e.target.value)}
                placeholder="L'expertise économique à votre service"
              />
            </div>
            <div>
              <Libelle>Description courte</Libelle>
              <textarea
                rows={4} className={CHAMP_TEXTAREA}
                value={config.description_courte}
                onChange={(e) => maj("description_courte", e.target.value)}
                placeholder="Présentation synthétique du bureau affichée dans le pied de page…"
              />
            </div>
          </>
        )}

        {onglet === "accueil" && (
          <>
            <div className="rounded-2xl border border-primaire-200 bg-primaire-50/70 p-4">
              <p className="text-sm font-semibold text-primaire-900">Contenus éditoriaux avancés</p>
              <p className="mt-1 text-sm text-primaire-800">
                Les textes longs, encarts, pages publiques, exemples et blocs éditoriaux se gèrent maintenant depuis l&apos;écran dédié.
              </p>
              <Link
                href="/administration/contenus-editoriaux"
                className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-primaire-700 hover:text-primaire-900"
              >
                Ouvrir l&apos;éditeur éditorial
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div>
              <Libelle>Étiquette héros</Libelle>
              <input
                type="text" className={CHAMP_TEXTE}
                value={config.etiquette_hero}
                onChange={(e) => maj("etiquette_hero", e.target.value)}
                placeholder="Bureau d'études spécialisé BTP · VRD · Économie de la construction"
              />
              <p className="text-xs text-slate-400 mt-1">Petit texte affiché au-dessus du titre principal.</p>
            </div>
            <div>
              <Libelle requis>Titre principal (héros)</Libelle>
              <input
                type="text" className={CHAMP_TEXTE}
                value={config.titre_hero}
                onChange={(e) => maj("titre_hero", e.target.value)}
                placeholder="L'expertise économique au service de vos projets de construction"
              />
            </div>
            <div>
              <Libelle>Sous-titre (héros)</Libelle>
              <textarea
                rows={3} className={CHAMP_TEXTAREA}
                value={config.sous_titre_hero}
                onChange={(e) => maj("sous_titre_hero", e.target.value)}
                placeholder="Complément descriptif sous le titre principal…"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Libelle>Texte bouton principal</Libelle>
                <input
                  type="text" className={CHAMP_TEXTE}
                  value={config.texte_cta_principal}
                  onChange={(e) => maj("texte_cta_principal", e.target.value)}
                  placeholder="Nos prestations"
                />
              </div>
              <div>
                <Libelle>Texte bouton secondaire</Libelle>
                <input
                  type="text" className={CHAMP_TEXTE}
                  value={config.texte_cta_secondaire}
                  onChange={(e) => maj("texte_cta_secondaire", e.target.value)}
                  placeholder="Nous contacter"
                />
              </div>
            </div>
            <div>
              <Libelle>Titre du bandeau d&apos;appel à l&apos;action</Libelle>
              <input
                type="text" className={CHAMP_TEXTE}
                value={config.texte_cta_bandeau}
                onChange={(e) => maj("texte_cta_bandeau", e.target.value)}
                placeholder="Vous avez un projet de construction ?"
              />
            </div>
            <div>
              <Libelle>Description du bandeau</Libelle>
              <textarea
                rows={2} className={CHAMP_TEXTAREA}
                value={config.texte_description_bandeau}
                onChange={(e) => maj("texte_description_bandeau", e.target.value)}
                placeholder="Texte complémentaire sous le titre du bandeau…"
              />
            </div>
          </>
        )}

        {onglet === "coordonnees" && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Libelle>Adresse de courriel de contact</Libelle>
                <input
                  type="email" className={CHAMP_TEXTE}
                  value={config.courriel_contact}
                  onChange={(e) => maj("courriel_contact", e.target.value)}
                  placeholder="contact@exemple.fr"
                />
              </div>
              <div>
                <Libelle>Téléphone de contact</Libelle>
                <input
                  type="tel" className={CHAMP_TEXTE}
                  value={config.telephone_contact}
                  onChange={(e) => maj("telephone_contact", e.target.value)}
                  placeholder="05 00 00 00 00"
                />
              </div>
            </div>
            <div>
              <Libelle>Adresse (rue)</Libelle>
              <input
                type="text" className={CHAMP_TEXTE}
                value={config.adresse}
                onChange={(e) => maj("adresse", e.target.value)}
                placeholder="1 rue de l'Économiste"
              />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <Libelle>Code postal</Libelle>
                <input
                  type="text" className={CHAMP_TEXTE}
                  value={config.code_postal}
                  onChange={(e) => maj("code_postal", e.target.value)}
                  placeholder="00000"
                />
              </div>
              <div>
                <Libelle>Ville</Libelle>
                <input
                  type="text" className={CHAMP_TEXTE}
                  value={config.ville}
                  onChange={(e) => maj("ville", e.target.value)}
                  placeholder="Bordeaux"
                />
              </div>
              <div>
                <Libelle>Pays</Libelle>
                <input
                  type="text" className={CHAMP_TEXTE}
                  value={config.pays}
                  onChange={(e) => maj("pays", e.target.value)}
                  placeholder="France"
                />
              </div>
            </div>
          </>
        )}

        {onglet === "sections" && (
          <div className="space-y-3">
            <p className="text-sm text-slate-500">
              Activez ou désactivez les sections affichées sur la page d&apos;accueil.
            </p>
            {([
              { champ: "afficher_stats", libelle: "Chiffres clés (statistiques)" },
              { champ: "afficher_valeurs", libelle: "Valeurs / avantages" },
              { champ: "afficher_demarche", libelle: "Notre démarche" },
              { champ: "afficher_realisations", libelle: "Réalisations (références)" },
              { champ: "afficher_equipe", libelle: "L'équipe" },
              { champ: "afficher_contact", libelle: "Formulaire de contact" },
            ] as { champ: keyof ConfigurationSite; libelle: string }[]).map(({ champ, libelle }) => (
              <label key={champ} className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded text-primaire-600"
                  checked={config[champ] as boolean}
                  onChange={(e) => maj(champ, e.target.checked)}
                />
                <span className="text-sm text-slate-700 font-medium">{libelle}</span>
              </label>
            ))}
          </div>
        )}

        {onglet === "apparence" && (
          <div className="space-y-6">
            {/* Thème couleur */}
            <div>
              <Libelle>Thème couleur</Libelle>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
                {([
                  { val: "bleu_marine",  libelle: "Bleu marine",  fond: "#10154f", accent: "#2e3fed" },
                  { val: "bleu_ciel",    libelle: "Bleu ciel",    fond: "#0c4a6e", accent: "#0284c7" },
                  { val: "emeraude",     libelle: "Émeraude",     fond: "#064e3b", accent: "#059669" },
                  { val: "violet",       libelle: "Violet",       fond: "#2e1065", accent: "#7c3aed" },
                  { val: "ardoise",      libelle: "Ardoise",      fond: "#0f172a", accent: "#475569" },
                  { val: "rouge_brique", libelle: "Rouge brique", fond: "#450a0a", accent: "#dc2626" },
                  { val: "teal",         libelle: "Teal",         fond: "#042f2e", accent: "#0d9488" },
                  { val: "brun_dore",    libelle: "Brun doré",    fond: "#451a03", accent: "#b45309" },
                ] as { val: string; libelle: string; fond: string; accent: string }[]).map(({ val, libelle, fond, accent }) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => maj("couleur_theme", val)}
                    className="relative flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all duration-150"
                    style={{
                      borderColor: config.couleur_theme === val ? accent : "var(--bordure)",
                      background: config.couleur_theme === val ? "var(--c-leger)" : "var(--fond-carte)",
                    }}
                  >
                    <div className="flex gap-1.5">
                      <div className="w-5 h-5 rounded-full" style={{ background: fond }} />
                      <div className="w-5 h-5 rounded-full" style={{ background: accent }} />
                    </div>
                    <span className="text-xs font-medium" style={{ color: "var(--texte-2)" }}>{libelle}</span>
                    {config.couleur_theme === val && (
                      <div className="absolute top-2 right-2 w-3 h-3 rounded-full" style={{ background: accent }} />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Mode sombre */}
            <div>
              <Libelle>Mode par défaut</Libelle>
              <div className="grid grid-cols-3 gap-3 mt-2">
                {([
                  { val: "clair",       libelle: "Toujours clair",    desc: "☀️" },
                  { val: "sombre",      libelle: "Toujours sombre",   desc: "🌙" },
                  { val: "automatique", libelle: "Automatique",       desc: "⚙️" },
                ] as { val: string; libelle: string; desc: string }[]).map(({ val, libelle, desc }) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => maj("mode_theme_defaut", val)}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all"
                    style={{
                      borderColor: config.mode_theme_defaut === val ? "var(--c-base)" : "var(--bordure)",
                      background: config.mode_theme_defaut === val ? "var(--c-leger)" : "var(--fond-carte)",
                    }}
                  >
                    <span className="text-xl">{desc}</span>
                    <span className="text-xs font-medium" style={{ color: "var(--texte-2)" }}>{libelle}</span>
                  </button>
                ))}
              </div>
              <p className="text-xs mt-2" style={{ color: "var(--texte-3)" }}>
                Les utilisateurs peuvent toujours changer leur préférence via la barre de navigation.
              </p>
            </div>

            {/* Police */}
            <div>
              <Libelle>Police principale</Libelle>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-2">
                {([
                  { val: "inter",   libelle: "Inter",   style: { fontFamily: "Inter, sans-serif" } },
                  { val: "roboto",  libelle: "Roboto",  style: { fontFamily: "Roboto, sans-serif" } },
                  { val: "poppins", libelle: "Poppins", style: { fontFamily: "Poppins, sans-serif" } },
                  { val: "raleway", libelle: "Raleway", style: { fontFamily: "Raleway, sans-serif" } },
                  { val: "lato",    libelle: "Lato",    style: { fontFamily: "Lato, sans-serif" } },
                ] as { val: string; libelle: string; style: React.CSSProperties }[]).map(({ val, libelle, style }) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => maj("police_principale", val)}
                    className="p-3 rounded-xl border-2 text-center transition-all"
                    style={{
                      ...style,
                      borderColor: config.police_principale === val ? "var(--c-base)" : "var(--bordure)",
                      background: config.police_principale === val ? "var(--c-leger)" : "var(--fond-carte)",
                      color: "var(--texte)",
                    }}
                  >
                    <p className="text-sm font-semibold">{libelle}</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--texte-3)" }}>Aa Bb 123</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {onglet === "carrousel" && (
          <div className="space-y-4">
            <div
              className="rounded-xl p-4 flex items-center justify-between gap-4"
              style={{ border: "1px solid var(--bordure)", background: "var(--fond-app)" }}
            >
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--texte)" }}>
                  Affichage du carrousel
                </p>
                <p className="text-xs mt-1" style={{ color: "var(--texte-3)" }}>
                  Désactive l&apos;affichage public du carrousel sans supprimer les diapositives enregistrées.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={config.activer_carrousel_accueil}
                onClick={() => maj("activer_carrousel_accueil", !config.activer_carrousel_accueil)}
                className="inline-flex items-center gap-3 rounded-full border px-3 py-2 text-sm font-medium transition-colors"
                style={{
                  borderColor: config.activer_carrousel_accueil ? "var(--c-moyen)" : "var(--bordure)",
                  background: config.activer_carrousel_accueil ? "var(--c-leger)" : "var(--fond-carte)",
                  color: config.activer_carrousel_accueil ? "var(--c-fort)" : "var(--texte-2)",
                }}
              >
                <span
                  className="relative inline-flex h-6 w-11 rounded-full transition-colors"
                  style={{
                    background: config.activer_carrousel_accueil ? "var(--c-fort)" : "#cbd5e1",
                  }}
                >
                  <span
                    className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all"
                    style={{
                      left: config.activer_carrousel_accueil ? "calc(100% - 22px)" : "2px",
                    }}
                  />
                </span>
                {config.activer_carrousel_accueil ? "Activé" : "Désactivé"}
              </button>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-sm" style={{ color: "var(--texte-2)" }}>
                {!config.activer_carrousel_accueil
                  ? "Le carrousel est désactivé. La section héros statique sera affichée."
                  : config.carousel_accueil.length === 0
                  ? "Aucune diapositive. La section héros statique sera affichée."
                  : `${config.carousel_accueil.length} diapositive${config.carousel_accueil.length > 1 ? "s" : ""}`}
              </p>
              <button
                type="button"
                className="btn-primaire text-xs"
                onClick={() => {
                  const nouvelle: DiapositiveCarrousel = {
                    titre: "Titre de la diapositive",
                    sous_titre: "",
                    image_url: "",
                    cta_texte: "",
                    cta_lien: "",
                    couleur_fond: "",
                  };
                  maj("carousel_accueil", [...config.carousel_accueil, nouvelle]);
                }}
              >
                <Plus size={14} /> Ajouter une diapositive
              </button>
            </div>

            {config.carousel_accueil.map((d, i) => (
              <div
                key={i}
                className="rounded-xl p-4 space-y-3"
                style={{ border: "1px solid var(--bordure)", background: "var(--fond-app)" }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GripVertical size={14} style={{ color: "var(--texte-3)" }} />
                    <span className="text-sm font-medium" style={{ color: "var(--texte-2)" }}>
                      Diapositive {i + 1}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="text-red-500 hover:text-red-700 transition-colors"
                    onClick={() => {
                      const nouv = [...config.carousel_accueil];
                      nouv.splice(i, 1);
                      maj("carousel_accueil", nouv);
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Libelle>Titre</Libelle>
                    <input
                      type="text" className={CHAMP_TEXTE}
                      value={d.titre}
                      onChange={(e) => {
                        const nouv = [...config.carousel_accueil];
                        nouv[i] = { ...d, titre: e.target.value };
                        maj("carousel_accueil", nouv);
                      }}
                      placeholder="Titre principal de la diapositive"
                    />
                  </div>
                  <div>
                    <Libelle>URL de l&apos;image de fond</Libelle>
                    <input
                      type="url" className={CHAMP_TEXTE}
                      value={d.image_url}
                      onChange={(e) => {
                        majDiapositive(i, { image_url: e.target.value });
                      }}
                      placeholder="https://…/image.jpg"
                    />
                    <label className="mt-2 inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors">
                      <Upload className="w-4 h-4" />
                      Téléverser une image
                      <input
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={(e) => {
                          const fichier = e.target.files?.[0] ?? null;
                          void televerserImageCarrousel(i, fichier);
                          e.currentTarget.value = "";
                        }}
                      />
                    </label>
                  </div>
                  <div className="sm:col-span-2">
                    <Libelle>Sous-titre</Libelle>
                    <input
                      type="text" className={CHAMP_TEXTE}
                      value={d.sous_titre}
                      onChange={(e) => {
                        majDiapositive(i, { sous_titre: e.target.value });
                      }}
                      placeholder="Texte descriptif sous le titre"
                    />
                  </div>
                  <div>
                    <Libelle>Texte du bouton</Libelle>
                    <input
                      type="text" className={CHAMP_TEXTE}
                      value={d.cta_texte}
                      onChange={(e) => {
                        majDiapositive(i, { cta_texte: e.target.value });
                      }}
                      placeholder="En savoir plus"
                    />
                  </div>
                  <div>
                    <Libelle>Lien du bouton</Libelle>
                    <input
                      type="text" className={CHAMP_TEXTE}
                      value={d.cta_lien}
                      onChange={(e) => {
                        majDiapositive(i, { cta_lien: e.target.value });
                      }}
                      placeholder="/prestations"
                    />
                  </div>
                  <div>
                    <Libelle>Couleur de fond (si pas d&apos;image)</Libelle>
                    <div className="flex gap-2 items-center">
                      <input
                        type="color"
                        className="w-10 h-10 rounded cursor-pointer border"
                        style={{ borderColor: "var(--bordure)" }}
                        value={d.couleur_fond || "#10154f"}
                        onChange={(e) => {
                          majDiapositive(i, { couleur_fond: e.target.value });
                        }}
                      />
                      <input
                        type="text" className={CHAMP_TEXTE}
                        value={d.couleur_fond}
                        onChange={(e) => {
                          majDiapositive(i, { couleur_fond: e.target.value });
                        }}
                        placeholder="#10154f"
                        style={{ fontFamily: "monospace" }}
                      />
                    </div>
                  </div>
                </div>

                {/* Aperçu miniature */}
                {(d.titre || d.image_url) && (
                  <div
                    className="rounded-lg h-20 flex items-center justify-center relative overflow-hidden"
                    style={{
                      background: d.image_url
                        ? `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), url(${d.image_url}) center/cover`
                        : d.couleur_fond || "#10154f",
                    }}
                  >
                    <p className="text-white text-sm font-semibold text-center px-4 truncate">
                      {d.titre || "—"}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {onglet === "seo" && (
          <>
            <div>
              <Libelle>Méta-titre (balise &lt;title&gt;)</Libelle>
              <input
                type="text" className={CHAMP_TEXTE}
                value={config.meta_titre}
                onChange={(e) => maj("meta_titre", e.target.value)}
                placeholder="LBH Économiste — Bureau d'études BTP"
              />
              <p className="text-xs text-slate-400 mt-1">Recommandé : 50–60 caractères.</p>
            </div>
            <div>
              <Libelle>Méta-description</Libelle>
              <textarea
                rows={3} className={CHAMP_TEXTAREA}
                value={config.meta_description}
                onChange={(e) => maj("meta_description", e.target.value)}
                placeholder="Bureau d'études économiste spécialisé en économie de la construction…"
              />
              <p className="text-xs text-slate-400 mt-1">Recommandé : 150–160 caractères.</p>
            </div>
            <div>
              <Libelle>Mots-clés</Libelle>
              <input
                type="text" className={CHAMP_TEXTE}
                value={config.mots_cles}
                onChange={(e) => maj("mots_cles", e.target.value)}
                placeholder="bureau études économiste, BTP, VRD, économie construction"
              />
              <p className="text-xs text-slate-400 mt-1">Mots-clés séparés par des virgules.</p>
            </div>
          </>
        )}
      </div>
      </CarteSectionAdmin>

      {/* Bouton bas de page */}
      <div className="flex justify-end">
        <button
          onClick={enregistrer}
          disabled={enregistrement}
          className="btn-primaire disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {enregistrement ? "Enregistrement…" : (
            <>
              <Save className="w-4 h-4" />
              Enregistrer les modifications
            </>
          )}
        </button>
      </div>
    </div>
  );
}
