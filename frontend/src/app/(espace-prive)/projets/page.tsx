import type { Metadata } from "next";
import Link from "next/link";
import { ListeProjets } from "@/composants/projets/ListeProjets";
import { Plus } from "lucide-react";

export const metadata: Metadata = {
  title: "Projets",
};

export default function PageProjets() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1>Projets</h1>
          <p className="text-slate-500 mt-1">Gestion de l&apos;ensemble des affaires et missions</p>
        </div>
        <Link href="/projets/nouveau" className="btn-primaire">
          <Plus size={16} />
          Nouveau projet
        </Link>
      </div>

      <ListeProjets />
    </div>
  );
}
