import type { Metadata } from "next";
import Link from "next/link";
import { ListeMetres } from "@/composants/metres/ListeMetres";

export const metadata: Metadata = {
  title: "Métrés quantitatifs",
};

export default function PageMetres() {
  return (
    <div className="space-y-6">
      <div>
        <h1>Métrés quantitatifs</h1>
        <p className="text-slate-500 mt-1">Relevés et calculs de métrés</p>
      </div>
      <ListeMetres />
    </div>
  );
}
