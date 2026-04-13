import type { Metadata } from "next";
import { ListeParametres } from "@/composants/parametres/ListeParametres";
import { Settings2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Modules & Paramètres",
};

export default function PageParametres() {
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primaire-100">
          <Settings2 className="h-5 w-5 text-primaire-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Modules & Paramètres</h1>
          <p className="mt-1 text-sm text-slate-500">
            Activez ou désactivez les briques fonctionnelles de la plateforme — les réglages métier (marges, taux, seuils) sont modifiables par module.
          </p>
        </div>
      </div>
      <ListeParametres />
    </div>
  );
}
