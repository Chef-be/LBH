import type { Metadata } from "next";
import PageParametrageMainOeuvre from "@/app/(espace-prive)/economie/simulateur-main-oeuvre/page";

export const metadata: Metadata = {
  title: "Paramétrage main-d’œuvre",
};

export default function PageCoutsMainOeuvreDepuisParametres() {
  return <PageParametrageMainOeuvre />;
}
