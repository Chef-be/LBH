"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function BoutonNouveauProjet() {
  return (
    <Link href="/societe/devis" className="btn-secondaire">
      Voir les affaires validées
      <ArrowRight size={16} />
    </Link>
  );
}
