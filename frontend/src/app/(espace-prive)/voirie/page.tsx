import type { Metadata } from "next";
import { ListeEtudesVoirie } from "@/composants/voirie/ListeEtudesVoirie";

export const metadata: Metadata = {
  title: "Dimensionnement voirie",
};

export default function PageVoirie() {
  return (
    <div className="space-y-6">
      <div>
        <h1>Dimensionnement voirie</h1>
        <p className="text-slate-500 mt-1">Études de dimensionnement de chaussées (SETRA/LCPC 1994)</p>
      </div>
      <ListeEtudesVoirie />
    </div>
  );
}
