"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ErreurApi } from "@/crochets/useApi";
import { DevisHonoraires } from "@/types/societe";
import {
  ArrowLeft,
  FileText,
  CheckCircle,
  XCircle,
  Send,
  ReceiptText,
  Pencil,
  Download,
  Briefcase,
  MailCheck,
} from "lucide-react";

function formaterMontant(val: string | number): string {
  const n = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(n)) return "—";
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2 }) + " €";
}

function formaterDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

function telechargerBlob(blob: Blob, nomFichier: string) {
  const url = window.URL.createObjectURL(blob);
  const lien = document.createElement("a");
  lien.href = url;
  lien.download = nomFichier;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  window.URL.revokeObjectURL(url);
}

const STATUTS_CONFIG: Record<string, { couleur: string; label: string }> = {
  brouillon: { couleur: "var(--texte-3)", label: "Brouillon" },
  envoye: { couleur: "#f59e0b", label: "Envoyé" },
  accepte: { couleur: "#10b981", label: "Accepté" },
  refuse: { couleur: "#ef4444", label: "Refusé" },
  expire: { couleur: "#6b7280", label: "Expiré" },
  annule: { couleur: "#6b7280", label: "Annulé" },
};

export default function PageDevisDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const qc = useQueryClient();
  const [erreur, setErreur] = useState<string | null>(null);

  const { data: devis, isLoading } = useQuery<DevisHonoraires>({
    queryKey: ["devis", id],
    queryFn: () => api.get<DevisHonoraires>(`/api/societe/devis/${id}/`),
  });

  const changerStatut = useMutation({
    mutationFn: (statut: string) =>
      api.post(`/api/societe/devis/${id}/changer_statut/`, { statut }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["devis", id] }),
    onError: (error) => setErreur(error instanceof ErreurApi ? error.detail : "Impossible de changer le statut."),
  });

  const genererFacture = useMutation({
    mutationFn: () => api.post<{ id: string }>(`/api/societe/devis/${id}/generer_facture/`, {}),
    onSuccess: (facture) => router.push(`/societe/factures/${facture.id}`),
    onError: (error) => setErreur(error instanceof ErreurApi ? error.detail : "Impossible de générer la facture."),
  });

  const telechargerPdf = useMutation({
    mutationFn: () => api.telecharger(`/api/societe/devis/${id}/export-pdf/`),
    onSuccess: (reponse) => {
      telechargerBlob(reponse.blob, reponse.nomFichier || `devis-${id}.pdf`);
    },
    onError: (error) => setErreur(error instanceof ErreurApi ? error.detail : "Impossible de générer le PDF."),
  });

  const envoyerClient = useMutation({
    mutationFn: () => api.post(`/api/societe/devis/${id}/envoyer-client/`, { expiration_jours: 14 }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["devis", id] }),
    onError: (error) => setErreur(error instanceof ErreurApi ? error.detail : "Impossible d'envoyer le devis au client."),
  });

  const creerProjet = useMutation({
    mutationFn: () => api.post<{ projet: { id: string } }>(`/api/societe/devis/${id}/creer-projet/`, {}),
    onSuccess: (reponse) => router.push(`/projets/${reponse.projet.id}`),
    onError: (error) => setErreur(error instanceof ErreurApi ? error.detail : "Impossible de créer le projet."),
  });

  if (isLoading) {
    return <div className="py-24 text-center text-sm" style={{ color: "var(--texte-3)" }}>Chargement…</div>;
  }

  if (!devis) {
    return <div className="py-24 text-center text-sm" style={{ color: "#ef4444" }}>Devis introuvable.</div>;
  }

  const cfg = STATUTS_CONFIG[devis.statut] ?? STATUTS_CONFIG.brouillon;
  const totalHT = parseFloat(devis.montant_ht);
  const tvaPct = Math.round(parseFloat(devis.taux_tva) * 100);

  return (
    <div className="space-y-6 max-w-4xl">
      {/* En-tête */}
      <div className="flex items-start justify-between">
        <div>
          <Link href="/societe/devis" className="inline-flex items-center gap-1 text-sm mb-2" style={{ color: "var(--texte-3)" }}>
            <ArrowLeft size={14} /> Devis
          </Link>
          <div className="flex items-center gap-3">
            <h2 className="font-mono" style={{ color: "var(--texte)" }}>{devis.reference}</h2>
            <span
              className="px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{ background: `color-mix(in srgb, ${cfg.couleur} 12%, var(--fond-carte))`, color: cfg.couleur }}
            >
              {cfg.label}
            </span>
          </div>
          <p className="text-lg mt-1" style={{ color: "var(--texte-2)" }}>{devis.intitule}</p>
        </div>

        {/* Actions selon statut */}
        <div className="flex flex-wrap gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={() => telechargerPdf.mutate()}
            disabled={telechargerPdf.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border"
            style={{ borderColor: "var(--bordure)", color: "var(--texte-2)" }}
          >
            <Download size={13} /> {telechargerPdf.isPending ? "PDF…" : "PDF"}
          </button>
          {devis.statut === "brouillon" && (
            <>
              <button
                type="button"
                onClick={() => envoyerClient.mutate()}
                disabled={envoyerClient.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
                style={{ background: "#f59e0b" }}
              >
                <Send size={13} /> {envoyerClient.isPending ? "Envoi…" : "Envoyer au client"}
              </button>
              <Link
                href={`/societe/devis/${id}/modifier`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border"
                style={{ borderColor: "var(--bordure)", color: "var(--texte-2)" }}
              >
                <Pencil size={13} /> Modifier
              </Link>
            </>
          )}
          {devis.statut === "envoye" && (
            <>
              <button
                type="button"
                onClick={() => changerStatut.mutate("accepte")}
                disabled={changerStatut.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
                style={{ background: "#10b981" }}
              >
                <CheckCircle size={13} /> Accepté
              </button>
              <button
                type="button"
                onClick={() => changerStatut.mutate("refuse")}
                disabled={changerStatut.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
                style={{ background: "color-mix(in srgb, #ef4444 10%, var(--fond-carte))", color: "#ef4444" }}
              >
                <XCircle size={13} /> Refusé
              </button>
            </>
          )}
          {devis.statut === "accepte" && (
            <>
              {!devis.projet && (
                <button
                  type="button"
                  onClick={() => creerProjet.mutate()}
                  disabled={creerProjet.isPending}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
                  style={{ background: "#0f766e" }}
                >
                  <Briefcase size={13} /> {creerProjet.isPending ? "Création…" : "Créer l'affaire"}
                </button>
              )}
              <button
                type="button"
                onClick={() => genererFacture.mutate()}
                disabled={genererFacture.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
                style={{ background: "var(--c-base)" }}
              >
                <ReceiptText size={13} /> {genererFacture.isPending ? "Génération…" : "Générer une facture"}
              </button>
            </>
          )}
        </div>
      </div>

      {erreur && (
        <div className="rounded-xl px-4 py-3 text-sm" style={{ background: "color-mix(in srgb, #ef4444 10%, var(--fond-carte))", color: "#ef4444" }}>
          {erreur}
        </div>
      )}

      {/* Informations devis */}
      <div className="grid grid-cols-2 gap-6">
        <div className="rounded-xl p-5 space-y-3" style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}>
          <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--texte-3)" }}>Client</h3>
          <div className="space-y-1 text-sm">
            <p className="font-semibold" style={{ color: "var(--texte)" }}>{devis.client_nom}</p>
            {devis.client_contact && <p style={{ color: "var(--texte-2)" }}>{devis.client_contact}</p>}
            {devis.client_email && <p style={{ color: "var(--texte-2)" }}>{devis.client_email}</p>}
            {devis.client_telephone && <p style={{ color: "var(--texte-2)" }}>{devis.client_telephone}</p>}
            {devis.client_adresse && <p className="text-xs whitespace-pre-line" style={{ color: "var(--texte-3)" }}>{devis.client_adresse}</p>}
          </div>
        </div>

        <div className="rounded-xl p-5 space-y-3" style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}>
          <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--texte-3)" }}>Conditions</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt style={{ color: "var(--texte-3)" }}>Type de client</dt>
              <dd style={{ color: "var(--texte)" }}>{devis.famille_client || "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt style={{ color: "var(--texte-3)" }}>Sous-type</dt>
              <dd style={{ color: "var(--texte)" }}>{devis.sous_type_client || "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt style={{ color: "var(--texte-3)" }}>Ouvrage</dt>
              <dd style={{ color: "var(--texte)" }}>{devis.nature_ouvrage || "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt style={{ color: "var(--texte-3)" }}>Émis le</dt>
              <dd style={{ color: "var(--texte)" }}>{formaterDate(devis.date_emission)}</dd>
            </div>
            <div className="flex justify-between">
              <dt style={{ color: "var(--texte-3)" }}>Valable jusqu&apos;au</dt>
              <dd style={{ color: "var(--texte)" }}>{formaterDate(devis.date_validite)}</dd>
            </div>
            <div className="flex justify-between">
              <dt style={{ color: "var(--texte-3)" }}>Acompte</dt>
              <dd style={{ color: "var(--texte)" }}>{devis.acompte_pct} %</dd>
            </div>
            <div className="flex justify-between">
              <dt style={{ color: "var(--texte-3)" }}>Délai paiement</dt>
              <dd style={{ color: "var(--texte)" }}>{devis.delai_paiement_jours} jours</dd>
            </div>
            <div className="flex justify-between">
              <dt style={{ color: "var(--texte-3)" }}>Validation client</dt>
              <dd style={{ color: "var(--texte)" }}>
                {devis.mode_validation === "client"
                  ? "Client"
                  : devis.mode_validation === "manuel"
                    ? "Manuelle"
                    : devis.validation_client_active
                      ? "En attente"
                      : "—"}
              </dd>
            </div>
            {devis.projet_reference && (
              <div className="flex justify-between">
                <dt style={{ color: "var(--texte-3)" }}>Projet</dt>
                <dd>
                  <Link href={`/projets/${devis.projet}`} className="underline text-xs" style={{ color: "var(--c-base)" }}>
                    {devis.projet_reference}
                  </Link>
                </dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      {devis.missions_selectionnees.length > 0 && (
        <div className="rounded-xl p-5" style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}>
          <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--texte-3)" }}>
            Missions vendues
          </h3>
          <div className="space-y-3">
            {devis.missions_selectionnees.map((mission) => (
              <div key={mission.missionCode} className="rounded-lg px-4 py-3" style={{ background: "var(--fond-entree)" }}>
                <p className="font-medium text-sm" style={{ color: "var(--texte)" }}>
                  {mission.missionLabel || mission.missionCode}
                </p>
                {mission.livrablesLabels && mission.livrablesLabels.length > 0 && (
                  <p className="text-xs mt-1" style={{ color: "var(--texte-3)" }}>
                    {mission.livrablesLabels.join(", ")}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {(devis.date_envoi_client || devis.date_validation_client || devis.date_expiration_validation) && (
        <div className="rounded-xl p-5" style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}>
          <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--texte-3)" }}>
            Suivi de validation
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p style={{ color: "var(--texte-3)" }}>Envoi client</p>
              <p style={{ color: "var(--texte)" }}>{formaterDate(devis.date_envoi_client)}</p>
            </div>
            <div>
              <p style={{ color: "var(--texte-3)" }}>Validation</p>
              <p style={{ color: "var(--texte)" }}>{formaterDate(devis.date_validation_client)}</p>
            </div>
            <div>
              <p style={{ color: "var(--texte-3)" }}>Expiration</p>
              <p style={{ color: "var(--texte)" }}>{formaterDate(devis.date_expiration_validation)}</p>
            </div>
          </div>
          {devis.validation_client_active && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium" style={{ background: "color-mix(in srgb, #f59e0b 10%, var(--fond-carte))", color: "#b45309" }}>
              <MailCheck size={12} />
              Lien de validation actif
            </div>
          )}
        </div>
      )}

      {/* Objet */}
      {devis.objet && (
        <div className="rounded-xl p-5" style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}>
          <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--texte-3)" }}>Objet de la mission</h3>
          <p className="text-sm leading-relaxed" style={{ color: "var(--texte-2)" }}>{devis.objet}</p>
        </div>
      )}

      {/* Lignes de prestations */}
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--bordure)" }}>
        <div className="px-5 py-4" style={{ background: "var(--fond-entree)", borderBottom: "1px solid var(--bordure)" }}>
          <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--texte-3)" }}>
            <FileText size={12} className="inline mr-2" />Prestations
          </h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "var(--fond-entree)", borderBottom: "1px solid var(--bordure)" }}>
              {["Désignation", "Type", "Détail", "Montant HT"].map((h) => (
                <th key={h} className="px-4 py-2 text-left text-xs font-semibold" style={{ color: "var(--texte-3)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {devis.lignes.map((ligne, i) => (
              <tr key={ligne.id} style={{ borderBottom: i < devis.lignes.length - 1 ? "1px solid var(--bordure)" : "none", background: "var(--fond-carte)" }}>
                <td className="px-4 py-3">
                  <p className="font-medium" style={{ color: "var(--texte)" }}>{ligne.intitule}</p>
                  {ligne.description && <p className="text-xs mt-0.5" style={{ color: "var(--texte-3)" }}>{ligne.description}</p>}
                </td>
                <td className="px-4 py-3 text-xs" style={{ color: "var(--texte-3)" }}>
                  {ligne.type_ligne === "horaire" ? "Horaire" : ligne.type_ligne === "forfait" ? "Forfait" : "Frais"}
                </td>
                <td className="px-4 py-3 font-mono text-xs" style={{ color: "var(--texte-2)" }}>
                  {ligne.type_ligne === "horaire"
                    ? `${ligne.nb_heures} h × ${parseFloat(ligne.taux_horaire ?? "0").toLocaleString("fr-FR")} €/h`
                    : `${ligne.quantite} × ${parseFloat(ligne.montant_unitaire_ht ?? "0").toLocaleString("fr-FR")} €`
                  }
                  {ligne.profil_libelle && (
                    <span
                      className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium"
                      style={{ background: `color-mix(in srgb, ${ligne.profil_couleur ?? "gray"} 12%, var(--fond-carte))`, color: ligne.profil_couleur ?? "var(--texte-3)" }}
                    >
                      {ligne.profil_libelle}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 font-mono font-semibold text-right" style={{ color: "var(--texte)" }}>
                  {formaterMontant(ligne.montant_ht)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totaux */}
        <div className="px-5 py-4 space-y-2" style={{ background: "var(--fond-entree)", borderTop: "1px solid var(--bordure)" }}>
          <div className="flex justify-between text-sm">
            <span style={{ color: "var(--texte-3)" }}>Total HT</span>
            <span className="font-mono" style={{ color: "var(--texte)" }}>{formaterMontant(totalHT)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span style={{ color: "var(--texte-3)" }}>TVA {tvaPct} %</span>
            <span className="font-mono" style={{ color: "var(--texte-2)" }}>{formaterMontant(devis.montant_tva)}</span>
          </div>
          <div className="flex justify-between text-base font-bold pt-2" style={{ borderTop: "1px solid var(--bordure)" }}>
            <span style={{ color: "var(--texte)" }}>Total TTC</span>
            <span className="font-mono text-xl" style={{ color: "var(--c-base)" }}>{formaterMontant(devis.montant_ttc)}</span>
          </div>
          {devis.acompte_pct && parseFloat(devis.acompte_pct) > 0 && (
            <div className="flex justify-between text-sm pt-1">
              <span style={{ color: "var(--texte-3)" }}>Acompte à la commande ({devis.acompte_pct} %)</span>
              <span className="font-mono font-semibold" style={{ color: "#f59e0b" }}>
                {formaterMontant(parseFloat(devis.montant_ttc) * parseFloat(devis.acompte_pct) / 100)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Factures liées */}
      {devis.nb_factures > 0 && (
        <div className="rounded-xl p-4" style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}>
          <p className="text-sm" style={{ color: "var(--texte-2)" }}>
            {devis.nb_factures} facture{devis.nb_factures > 1 ? "s" : ""} générée{devis.nb_factures > 1 ? "s" : ""} depuis ce devis.
          </p>
        </div>
      )}
    </div>
  );
}
