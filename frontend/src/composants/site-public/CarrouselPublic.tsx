"use client";

import { Carrousel } from "@/composants/ui/Carrousel";
import type { DiapositiveCarrousel } from "@/contextes/FournisseurConfiguration";

export function CarrouselPublic({ diapositives }: { diapositives: DiapositiveCarrousel[] }) {
  return (
    <Carrousel
      diapositives={diapositives}
      hauteur="min(90vh, 640px)"
      delai={6000}
      fleches
      points
    />
  );
}
