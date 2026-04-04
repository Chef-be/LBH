"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { useSessionStore } from "@/crochets/useSession";
import { useConfiguration } from "@/contextes/FournisseurConfiguration";
import { obtenirMarqueAffichee, obtenirNomPlateforme } from "@/lib/site-public";

const schemaConnexion = z.object({
  courriel: z.string().email("Adresse de courriel invalide."),
  mot_de_passe: z.string().min(1, "Le mot de passe est requis."),
});

type DonneesConnexion = z.infer<typeof schemaConnexion>;

export default function PageConnexion() {
  const router = useRouter();
  const { connecter } = useSessionStore();
  const config = useConfiguration();
  const nomBureau = obtenirNomPlateforme(config);
  const marque = obtenirMarqueAffichee(config);

  const [erreurGlobale, setErreurGlobale] = useState<string | null>(null);
  const [chargement, setChargement] = useState(false);
  const [afficherMotDePasse, setAfficherMotDePasse] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DonneesConnexion>({
    resolver: zodResolver(schemaConnexion),
  });

  const soumettre = async (donnees: DonneesConnexion) => {
    setErreurGlobale(null);
    setChargement(true);
    try {
      await connecter(donnees.courriel, donnees.mot_de_passe);
      router.push("/tableau-de-bord");
    } catch (err: unknown) {
      setErreurGlobale(
        err instanceof Error
          ? err.message
          : "Identifiants incorrects. Vérifiez votre courriel et votre mot de passe."
      );
    } finally {
      setChargement(false);
    }
  };

  return (
    <div className="min-h-screen bg-ardoise-900 flex">
      {/* Panneau gauche — identité */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12 bg-ardoise-950">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
        <div
          aria-hidden
          className="absolute top-0 right-0 w-full h-full opacity-10"
          style={{ background: "radial-gradient(ellipse at 100% 0%, #f59e0b 0%, transparent 60%)" }}
        />

        {/* Logo */}
        <div className="relative">
          <div className="flex items-center gap-3">
            {config.logo ? (
              <div className="relative h-10 min-w-10 max-w-[9rem] rounded-xl bg-white/95 px-2 py-1 shadow-accent">
                <Image
                  src={config.logo}
                  alt={nomBureau || "Logo"}
                  fill
                  unoptimized
                  sizes="144px"
                  className="object-contain p-1"
                />
              </div>
            ) : marque ? (
              <div className="w-9 h-9 rounded-xl bg-accent-500 flex items-center justify-center shadow-accent">
                <span className="text-white font-bold">{marque}</span>
              </div>
            ) : (
              <div className="w-9 h-9 rounded-xl border border-white/15 bg-white/5" />
            )}
            {nomBureau && (
              <div>
                <span className="text-white font-bold text-lg">{nomBureau}</span>
                {config.slogan && <p className="text-ardoise-300 text-xs">{config.slogan}</p>}
              </div>
            )}
          </div>
        </div>

        {/* Message central */}
        <div className="relative max-w-md">
          <blockquote className="text-ardoise-200 text-2xl font-light leading-relaxed mb-6">
            &ldquo;L&apos;expertise économique au service
            de vos projets de construction.&rdquo;
          </blockquote>
          <div className="flex flex-col gap-3">
            {[
              "Économie de la construction",
              "Dimensionnement voirie VRD",
              "Pré-dimensionnement bâtiment",
              "Assistance maîtrise d'œuvre",
            ].map((item) => (
              <div key={item} className="flex items-center gap-2.5 text-ardoise-400 text-sm">
                <div className="w-1.5 h-1.5 rounded-full bg-accent-500 shrink-0" aria-hidden />
                {item}
              </div>
            ))}
          </div>
        </div>

        {/* Lien retour */}
        <div className="relative">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-ardoise-500 hover:text-ardoise-300 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour au site
          </Link>
        </div>
      </div>

      {/* Panneau droit — formulaire */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">

          {/* Logo mobile */}
          <div className="lg:hidden text-center mb-8">
            {config.logo ? (
              <div className="relative inline-flex items-center justify-center h-14 w-[11rem] rounded-2xl bg-white/95 px-4 py-2 mb-4 shadow-accent">
                <Image
                  src={config.logo}
                  alt={nomBureau || "Logo"}
                  fill
                  unoptimized
                  sizes="176px"
                  className="object-contain p-2"
                />
              </div>
            ) : marque ? (
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-accent-500 mb-4 shadow-accent">
                <span className="text-2xl font-bold text-white">{marque}</span>
              </div>
            ) : null}
            {nomBureau && <h1 className="text-xl font-bold text-white">{nomBureau}</h1>}
            {config.slogan && <p className="text-ardoise-300 text-sm mt-1">{config.slogan}</p>}
          </div>

          {/* Carte formulaire */}
          <div className="bg-white rounded-2xl shadow-2xl p-8 sm:p-10">
            <div className="mb-7">
              <h2 className="text-2xl font-bold text-ardoise-900">Connexion</h2>
              <p className="text-ardoise-500 text-sm mt-1">
                Accédez à votre espace de travail
              </p>
            </div>

            {erreurGlobale && (
              <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2.5">
                <span className="shrink-0 mt-0.5">⚠</span>
                {erreurGlobale}
              </div>
            )}

            <form onSubmit={handleSubmit(soumettre)} className="space-y-5" noValidate>
              <div>
                <label htmlFor="courriel" className="libelle-champ">
                  Adresse de courriel
                </label>
                <input
                  id="courriel"
                  type="email"
                  autoComplete="email"
                  className="champ-saisie"
                  placeholder="prenom.nom@exemple.fr"
                  {...register("courriel")}
                />
                {errors.courriel && (
                  <p className="mt-1.5 text-xs text-red-600">{errors.courriel.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="mot_de_passe" className="libelle-champ">
                  Mot de passe
                </label>
                <div className="relative">
                  <input
                    id="mot_de_passe"
                    type={afficherMotDePasse ? "text" : "password"}
                    autoComplete="current-password"
                    className="champ-saisie pr-10"
                    placeholder="••••••••••••"
                    {...register("mot_de_passe")}
                  />
                  <button
                    type="button"
                    onClick={() => setAfficherMotDePasse(!afficherMotDePasse)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-ardoise-400 hover:text-ardoise-600 transition-colors"
                    aria-label={afficherMotDePasse ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  >
                    {afficherMotDePasse ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.mot_de_passe && (
                  <p className="mt-1.5 text-xs text-red-600">{errors.mot_de_passe.message}</p>
                )}
                <div className="mt-2 text-right">
                  <Link
                    href="/mot-de-passe-oublie"
                    className="text-xs font-medium text-primaire-600 hover:text-primaire-700"
                  >
                    Mot de passe oublié ?
                  </Link>
                </div>
              </div>

              <button
                type="submit"
                disabled={chargement}
                className="w-full btn-accent justify-center py-3 text-base disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {chargement ? (
                  <span className="flex items-center gap-2">
                    <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-hidden />
                    Connexion en cours…
                  </span>
                ) : (
                  "Se connecter"
                )}
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-ardoise-100">
              <p className="text-xs text-ardoise-400 text-center">
                Accès réservé aux membres autorisés{nomBureau ? ` de ${nomBureau}` : ""}.
              </p>
            </div>
          </div>

          {/* Lien retour mobile */}
          <div className="lg:hidden text-center mt-6">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-sm text-ardoise-400 hover:text-ardoise-200 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Retour au site
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
