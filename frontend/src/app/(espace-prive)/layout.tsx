"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSessionStore } from "@/crochets/useSession";
import { BarreNavigation } from "@/composants/navigation/BarreNavigation";
import { MenuLateral } from "@/composants/navigation/MenuLateral";
import { useConfiguration } from "@/contextes/FournisseurConfiguration";
import { obtenirMarqueAffichee } from "@/lib/site-public";

export default function MiseEnPageEspacePrivé({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { estConnecte, estHydratee, jetonAcces, rafraichirSession } = useSessionStore();
  const [initialisation, setInitialisation] = useState(true);
  const configuration = useConfiguration();
  const marque = obtenirMarqueAffichee(configuration) || "P";

  useEffect(() => {
    if (!estHydratee) {
      return;
    }

    const preparer = async () => {
      if (!estConnecte) {
        router.replace("/connexion");
        setInitialisation(false);
        return;
      }

      // Si connecté mais sans jeton d'accès (rechargement de page),
      // tenter de régénérer le jeton via le jeton de rafraîchissement.
      if (!jetonAcces) {
        const succes = await rafraichirSession();
        if (!succes) {
          router.replace("/connexion");
          setInitialisation(false);
          return;
        }
      }

      setInitialisation(false);
    };

    preparer();
  }, [estConnecte, estHydratee, jetonAcces, rafraichirSession, router]);

  // Pendant l'initialisation, afficher un écran de chargement neutre
  if (initialisation) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primaire-600 flex items-center justify-center animate-pulse">
            <span className="text-white font-bold text-sm">{marque}</span>
          </div>
          <p className="text-sm text-slate-500">Chargement de votre espace…</p>
        </div>
      </div>
    );
  }

  if (!estConnecte) {
    return null;
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Menu latéral */}
      <MenuLateral />

      {/* Contenu principal */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <BarreNavigation />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
