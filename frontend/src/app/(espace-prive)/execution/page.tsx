import type { Metadata } from "next";
import { TableauBordExecution } from "@/composants/execution/TableauBordExecution";

export const metadata: Metadata = {
  title: "Suivi d'exécution",
};

export default function PageExecution() {
  return (
    <div className="space-y-6">
      <div>
        <h1>Suivi d&apos;exécution</h1>
        <p className="text-slate-500 mt-1">Comptes rendus de chantier, situations et ordres de service</p>
      </div>
      <TableauBordExecution />
    </div>
  );
}
