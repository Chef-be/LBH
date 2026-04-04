import { PageMaintenance } from "@/composants/site-public/PageMaintenance";

export const dynamic = "force-dynamic";

export default function PageMaintenancePublique() {
  return <PageMaintenance afficherLienAccueil={false} />;
}
