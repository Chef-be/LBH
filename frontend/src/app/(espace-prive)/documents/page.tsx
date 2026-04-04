import type { Metadata } from "next";
import { ListeDocumentsGlobale } from "@/composants/documents/ListeDocumentsGlobale";

export const metadata: Metadata = {
  title: "Gestion documentaire",
};

export default function PageDocuments() {
  return (
    <div className="space-y-6">
      <div>
        <h1>Gestion documentaire</h1>
        <p className="text-slate-500 mt-1 text-sm">Tous les documents de la plateforme</p>
      </div>
      <ListeDocumentsGlobale />
    </div>
  );
}
