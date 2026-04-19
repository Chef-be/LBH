import { redirect } from "next/navigation";

export default async function PageLignesEtude({
  params,
}: {
  params: Promise<{ id: string; etude_id: string }>;
}) {
  const { id, etude_id } = await params;
  redirect(`/projets/${id}/economie/${etude_id}`);
}
