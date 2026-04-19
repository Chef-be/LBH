"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { WizardModalProjet } from "@/composants/projets/wizard-modal/WizardModalProjet";

export default function PageNouveauProjet() {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(true);

  useEffect(() => {
    if (!ouvert) {
      router.push("/projets");
    }
  }, [ouvert, router]);

  return (
    <>
      {/* Fond de page minimal — le modal se superpose */}
      <div className="min-h-screen" style={{ background: "var(--fond-app)" }} />
      <WizardModalProjet
        ouvert={ouvert}
        onFermer={() => setOuvert(false)}
      />
    </>
  );
}
