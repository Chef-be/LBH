import { GestionMessagerie } from "@/composants/parametres/GestionMessagerie";

export const metadata = {
  title: "Communication plateforme",
};

export default function PageAdministrationMessagerie() {
  return (
    <div className="max-w-7xl">
      <GestionMessagerie />
    </div>
  );
}
