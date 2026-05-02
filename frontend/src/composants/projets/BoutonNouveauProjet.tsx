"use client";

import Link from "next/link";
import { Briefcase } from "lucide-react";

export function BoutonNouveauProjet() {
  return (
    <Link href="/societe" className="btn-primaire">
      <Briefcase size={16} />
      Créer depuis une affaire validée
    </Link>
  );
}
