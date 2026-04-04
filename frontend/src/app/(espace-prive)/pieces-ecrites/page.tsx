import type { Metadata } from "next";
import { ListePiecesEcrites } from "@/composants/pieces-ecrites/ListePiecesEcrites";

export const metadata: Metadata = {
  title: "Pièces écrites",
};

export default function PagePiecesEcrites() {
  return (
    <div className="space-y-6">
      <div>
        <h1>Pièces écrites</h1>
        <p className="text-slate-500 mt-1">CCTP, CCAP, RC et autres pièces contractuelles</p>
      </div>
      <ListePiecesEcrites />
    </div>
  );
}
