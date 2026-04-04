import type { Metadata } from "next";
import { TableauBordSupervision } from "@/composants/supervision/TableauBordSupervision";

export const metadata: Metadata = {
  title: "Supervision",
};

export default function PageSupervision() {
  return (
    <div className="space-y-6">
      <div>
        <h1>Supervision</h1>
        <p className="text-slate-500 mt-1">
          Graphiques serveur, état Docker et alertes techniques de la plateforme
        </p>
      </div>
      <TableauBordSupervision />
    </div>
  );
}
