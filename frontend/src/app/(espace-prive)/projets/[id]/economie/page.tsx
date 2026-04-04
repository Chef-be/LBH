import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, BadgeEuro, TrendingUp } from "lucide-react";
import { ListeEtudesEconomiques } from "@/composants/economie/ListeEtudesEconomiques";
import { ListeEtudesPrix } from "@/composants/economie/ListeEtudesPrix";

export const metadata: Metadata = {
  title: "Économie du projet",
};

export default async function PageEconomieProjet({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/projets/${id}`}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-2"
        >
          <ArrowLeft size={14} /> Fiche projet
        </Link>
        <h1>Économie</h1>
        <p className="text-slate-500 mt-1 text-sm">Études économiques et analyses de rentabilité</p>
        <div className="mt-4">
          <div className="flex flex-wrap gap-2">
            <Link href={`/parametres/couts-main-oeuvre?projet=${id}`} className="btn-secondaire text-sm">
              <BadgeEuro className="w-4 h-4" />
              Paramétrer les taux du projet
            </Link>
            <Link href="/economie/pilotage-activite" className="btn-secondaire text-sm">
              <TrendingUp className="w-4 h-4" />
              Projeter l&apos;activité
            </Link>
          </div>
        </div>
      </div>
      <section className="space-y-3">
        <div>
          <h2>Études économiques</h2>
          <p className="text-sm text-slate-500 mt-1">
            Déboursés, prix de vente, marges et variantes de l&apos;opération.
          </p>
        </div>
        <ListeEtudesEconomiques projetId={id} />
      </section>
      <section className="space-y-3">
        <div>
          <h2>Études de prix analytiques</h2>
          <p className="text-sm text-slate-500 mt-1">
            Sous-détails ressource par ressource rattachés à ce projet, jusqu&apos;à la publication en bibliothèque.
          </p>
        </div>
        <ListeEtudesPrix projetId={id} />
      </section>
    </div>
  );
}
