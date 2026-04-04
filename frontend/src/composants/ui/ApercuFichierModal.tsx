"use client";

import Image from "next/image";
import { Download, FileText } from "lucide-react";
import { Modal } from "@/composants/ui/Modal";

function estImage(typeMime?: string | null, url?: string | null) {
  return Boolean(
    (typeMime && typeMime.startsWith("image/")) ||
    (url && /\.(png|jpe?g|gif|webp|svg)$/i.test(url))
  );
}

function estPdf(typeMime?: string | null, url?: string | null) {
  return typeMime === "application/pdf" || Boolean(url && /\.pdf($|\?)/i.test(url));
}

export function ApercuFichierModal({
  ouvert,
  onFermer,
  url,
  typeMime,
  nomFichier,
}: {
  ouvert: boolean;
  onFermer: () => void;
  url?: string | null;
  typeMime?: string | null;
  nomFichier?: string | null;
}) {
  if (!ouvert || !url) return null;

  const image = estImage(typeMime, url);
  const pdf = estPdf(typeMime, url);
  const titre = nomFichier || "Aperçu du fichier";

  return (
    <Modal
      ouvert={ouvert}
      onFermer={onFermer}
      titre={titre}
      taille="xl"
      pied={(
        <div className="flex justify-end">
          <a href={url} target="_blank" rel="noreferrer" className="btn-secondaire">
            <Download className="w-4 h-4" />
            Télécharger
          </a>
        </div>
      )}
    >
      {image ? (
        <div className="relative h-[70vh] w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-950/5">
          <Image
            src={url}
            alt={titre}
            fill
            unoptimized
            className="object-contain"
            sizes="100vw"
          />
        </div>
      ) : pdf ? (
        <iframe
          src={url}
          title={titre}
          className="h-[70vh] w-full rounded-xl border border-slate-200 bg-white"
        />
      ) : (
        <div className="flex h-[32vh] flex-col items-center justify-center gap-3 rounded-xl border border-slate-200 bg-slate-50 text-center">
          <FileText className="w-10 h-10 text-slate-400" />
          <p className="text-sm font-medium text-slate-800">
            L&apos;aperçu intégré n&apos;est pas disponible pour ce format.
          </p>
          <p className="text-sm text-slate-500">
            Utilisez le bouton de téléchargement pour ouvrir le fichier.
          </p>
        </div>
      )}
    </Modal>
  );
}
