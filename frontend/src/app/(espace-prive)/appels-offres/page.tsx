import type { Metadata } from "next";
import { ListeAppelsOffres } from "@/composants/appels-offres/ListeAppelsOffres";

export const metadata: Metadata = {
  title: "Appels d'offres",
};

export default function PageAppelsOffres() {
  return (
    <div className="space-y-6">
      <div>
        <h1>Appels d&apos;offres</h1>
        <p className="text-slate-500 mt-1">Gestion des consultations et analyse des offres</p>
      </div>
      <ListeAppelsOffres />
    </div>
  );
}
