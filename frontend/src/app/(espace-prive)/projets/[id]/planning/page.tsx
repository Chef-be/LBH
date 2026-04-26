"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { BarChart3, CalendarRange } from "lucide-react";
import { PlanningProjet } from "@/composants/projets/PlanningProjet";
import { PlanningGeneralGantt } from "@/composants/planning/PlanningGeneralGantt";

type Onglet = "gantt" | "livrables";

export default function PagePlanningProjet() {
  const params = useParams();
  const projetId = params.id as string;
  const [onglet, setOnglet] = useState<Onglet>("gantt");

  return (
    <div className="flex flex-col gap-6 px-6 py-6 max-w-screen-2xl mx-auto w-full">
      {/* Onglets */}
      <div className="flex gap-1 p-1 bg-gris-100 rounded-xl w-fit">
        <button
          onClick={() => setOnglet("gantt")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            onglet === "gantt"
              ? "bg-white text-primaire-700 shadow-sm"
              : "text-gris-500 hover:text-gris-700"
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Planning Gantt
        </button>
        <button
          onClick={() => setOnglet("livrables")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            onglet === "livrables"
              ? "bg-white text-primaire-700 shadow-sm"
              : "text-gris-500 hover:text-gris-700"
          }`}
        >
          <CalendarRange className="w-4 h-4" />
          Suivi livrables
        </button>
      </div>

      {/* Contenu */}
      {onglet === "gantt" && <PlanningGeneralGantt projetId={projetId} />}
      {onglet === "livrables" && <PlanningProjet projetId={projetId} />}
    </div>
  );
}
