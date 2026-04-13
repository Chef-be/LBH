"use client";

import { useEffect, useState } from "react";
import { Download, ExternalLink, FileText } from "lucide-react";
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
  const [imageErreur, setImageErreur] = useState(false);

  useEffect(() => {
    setImageErreur(false);
  }, [url, ouvert]);

  if (!ouvert || !url) return null;

  const image = estImage(typeMime, url);
  const pdf = estPdf(typeMime, url);
  const titre = nomFichier || "Aperçu du fichier";
  const urlApercu = pdf ? `${url}#view=FitH` : url;

  return (
    <Modal
      ouvert={ouvert}
      onFermer={onFermer}
      titre={titre}
      taille="xl"
      pied={(
        <div className="flex justify-end gap-2">
          <a href={url} target="_blank" rel="noreferrer" className="btn-secondaire">
            <ExternalLink className="w-4 h-4" />
            Ouvrir
          </a>
          <a href={url} target="_blank" rel="noreferrer" className="btn-secondaire">
            <Download className="w-4 h-4" />
            Télécharger
          </a>
        </div>
      )}
    >
      {image && !imageErreur ? (
        <div className="flex min-h-[32vh] items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-950/5">
          <img
            src={url}
            alt={titre}
            className="max-h-[70vh] w-auto max-w-full object-contain"
            onError={() => setImageErreur(true)}
          />
        </div>
      ) : pdf ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Si l&apos;aperçu PDF ne s&apos;affiche pas dans cette fenêtre, utilisez
            {" "}
            <span className="font-medium text-slate-800">Ouvrir</span>
            {" "}
            ou
            {" "}
            <span className="font-medium text-slate-800">Télécharger</span>.
          </div>
          <iframe
            src={urlApercu}
            title={titre}
            className="h-[70vh] w-full rounded-xl border border-slate-200 bg-white"
          />
        </div>
      ) : (
        <div className="flex h-[32vh] flex-col items-center justify-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-6 text-center">
          <FileText className="w-10 h-10 text-slate-400" />
          <p className="text-sm font-medium text-slate-800">
            {imageErreur
              ? "Le fichier image n'a pas pu être affiché dans l'aperçu."
              : "L'aperçu intégré n'est pas disponible pour ce format."}
          </p>
          <p className="text-sm text-slate-500">
            Utilisez le bouton d&apos;ouverture ou de téléchargement.
          </p>
        </div>
      )}
    </Modal>
  );
}
