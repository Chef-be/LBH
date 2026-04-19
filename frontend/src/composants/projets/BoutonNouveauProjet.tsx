"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { WizardModalProjet } from "./wizard-modal/WizardModalProjet";

export function BoutonNouveauProjet() {
  const [modalOuvert, setModalOuvert] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOuvert(true)}
        className="btn-primaire"
      >
        <Plus size={16} />
        Nouveau projet
      </button>

      <WizardModalProjet
        ouvert={modalOuvert}
        onFermer={() => setModalOuvert(false)}
      />
    </>
  );
}
