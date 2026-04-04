import type { Metadata } from "next";
import PageDetailDocument from "@/app/(espace-prive)/documents/[id]/page";

export const metadata: Metadata = {
  title: "Document du projet",
};

export default async function PageDocumentProjet({
  params,
}: {
  params: Promise<{ id: string; document_id: string }>;
}) {
  const { id, document_id } = await params;
  return (
    <PageDetailDocument
      params={Promise.resolve({ id: document_id })}
      projetId={id}
    />
  );
}
