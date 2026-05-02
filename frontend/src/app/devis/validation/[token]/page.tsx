"use client";

import { FormEvent, use, useEffect, useState } from "react";
import { CheckCircle, FileText, XCircle } from "lucide-react";

interface DevisPublic {
  id: string;
  reference: string;
  intitule: string;
  statut: string;
  client_nom: string;
  objet: string;
  montant_ht: string;
  montant_tva: string;
  montant_ttc: string;
  date_validite: string;
  lignes: Array<{ id: string; intitule: string; description: string; montant_ht: string }>;
}

function formaterMontant(valeur: string | number | null | undefined) {
  const nombre = typeof valeur === "number" ? valeur : Number(String(valeur ?? "").replace(",", "."));
  if (!Number.isFinite(nombre)) return "—";
  return nombre.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

async function appelPublic<T>(url: string, corps?: unknown): Promise<T> {
  const reponse = await fetch(url, {
    method: corps ? "POST" : "GET",
    headers: corps ? { "Content-Type": "application/json" } : undefined,
    body: corps ? JSON.stringify(corps) : undefined,
  });
  if (!reponse.ok) {
    let detail = `Erreur ${reponse.status}`;
    try {
      const donnees = await reponse.json();
      detail = donnees.detail || detail;
    } catch {
      // Réponse non JSON.
    }
    throw new Error(detail);
  }
  return reponse.json();
}

export default function PageValidationDevis({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [devis, setDevis] = useState<DevisPublic | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [fonction, setFonction] = useState("");
  const [conditions, setConditions] = useState(false);
  const [motifRefus, setMotifRefus] = useState("");
  const [resultat, setResultat] = useState<string | null>(null);

  useEffect(() => {
    let actif = true;
    setChargement(true);
    appelPublic<DevisPublic>(`/api/public/devis/${token}/`)
      .then((donnees) => {
        if (actif) setDevis(donnees);
      })
      .catch((e) => {
        if (actif) setErreur(e instanceof Error ? e.message : "Impossible de charger le devis.");
      })
      .finally(() => {
        if (actif) setChargement(false);
      });
    return () => {
      actif = false;
    };
  }, [token]);

  const accepter = async (event: FormEvent) => {
    event.preventDefault();
    setErreur(null);
    try {
      await appelPublic(`/api/public/devis/${token}/accepter/`, {
        nom_signataire: nom,
        email_signataire: email,
        fonction_signataire: fonction,
        case_conditions_acceptees: conditions,
      });
      setResultat("Le devis a été accepté. LBH est notifié et pourra créer le projet.");
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Impossible d'accepter le devis.");
    }
  };

  const refuser = async () => {
    setErreur(null);
    try {
      await appelPublic(`/api/public/devis/${token}/refuser/`, { motif_refus: motifRefus });
      setResultat("Le devis a été refusé. La création du projet est bloquée.");
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Impossible de refuser le devis.");
    }
  };

  return (
    <main className="min-h-screen px-4 py-10" style={{ background: "#08111f", color: "#e5edf8" }}>
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="rounded-2xl p-6" style={{ background: "#101b2d", border: "1px solid #243348" }}>
          <div className="flex items-center gap-3 text-sm" style={{ color: "#9fb0c8" }}>
            <FileText size={16} /> Validation sécurisée du devis
          </div>
          <h1 className="mt-3 text-2xl font-semibold">
            {devis ? `${devis.reference} - ${devis.intitule}` : chargement ? "Chargement du devis..." : "Devis indisponible"}
          </h1>
          {devis && (
            <p className="mt-2 text-sm" style={{ color: "#9fb0c8" }}>
              Client : {devis.client_nom || "—"} · Validité : {new Date(devis.date_validite).toLocaleDateString("fr-FR")}
            </p>
          )}
        </header>

        {erreur && (
          <div className="rounded-xl px-4 py-3 text-sm" style={{ background: "rgba(239,68,68,.12)", color: "#fca5a5", border: "1px solid rgba(239,68,68,.3)" }}>
            {erreur}
          </div>
        )}

        {resultat && (
          <div className="rounded-xl px-4 py-3 text-sm" style={{ background: "rgba(16,185,129,.12)", color: "#86efac", border: "1px solid rgba(16,185,129,.3)" }}>
            {resultat}
          </div>
        )}

        {devis && !resultat && (
          <>
            <section className="rounded-2xl overflow-hidden" style={{ background: "#101b2d", border: "1px solid #243348" }}>
              <div className="p-5 border-b" style={{ borderColor: "#243348" }}>
                <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "#9fb0c8" }}>Prestations</h2>
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {devis.lignes.map((ligne) => (
                    <tr key={ligne.id} style={{ borderBottom: "1px solid #243348" }}>
                      <td className="px-5 py-3">
                        <p className="font-medium">{ligne.intitule}</p>
                        {ligne.description && <p className="mt-1 text-xs" style={{ color: "#9fb0c8" }}>{ligne.description}</p>}
                      </td>
                      <td className="px-5 py-3 text-right font-semibold">{formaterMontant(ligne.montant_ht)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="p-5 flex justify-end">
                <div className="w-full max-w-xs space-y-2 text-sm">
                  <div className="flex justify-between"><span style={{ color: "#9fb0c8" }}>Total HT</span><strong>{formaterMontant(devis.montant_ht)}</strong></div>
                  <div className="flex justify-between"><span style={{ color: "#9fb0c8" }}>TVA</span><strong>{formaterMontant(devis.montant_tva)}</strong></div>
                  <div className="flex justify-between text-lg"><span>Total TTC</span><strong>{formaterMontant(devis.montant_ttc)}</strong></div>
                </div>
              </div>
            </section>

            <section className="grid gap-5 lg:grid-cols-2">
              <form onSubmit={accepter} className="rounded-2xl p-5 space-y-4" style={{ background: "#101b2d", border: "1px solid #243348" }}>
                <h2 className="font-semibold">Accepter le devis</h2>
                <input required value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nom du signataire" className="w-full rounded-lg px-3 py-2" style={{ background: "#0b1424", border: "1px solid #243348" }} />
                <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Courriel du signataire" className="w-full rounded-lg px-3 py-2" style={{ background: "#0b1424", border: "1px solid #243348" }} />
                <input value={fonction} onChange={(e) => setFonction(e.target.value)} placeholder="Fonction" className="w-full rounded-lg px-3 py-2" style={{ background: "#0b1424", border: "1px solid #243348" }} />
                <label className="flex items-start gap-2 text-sm" style={{ color: "#cbd5e1" }}>
                  <input type="checkbox" required checked={conditions} onChange={(e) => setConditions(e.target.checked)} className="mt-1" />
                  J&apos;accepte les conditions du devis et confirme disposer de l&apos;autorisation de validation.
                </label>
                <button type="submit" className="inline-flex items-center gap-2 rounded-lg px-4 py-2 font-semibold text-white" style={{ background: "#059669" }}>
                  <CheckCircle size={16} /> Accepter le devis
                </button>
              </form>

              <div className="rounded-2xl p-5 space-y-4" style={{ background: "#101b2d", border: "1px solid #243348" }}>
                <h2 className="font-semibold">Refuser le devis</h2>
                <textarea value={motifRefus} onChange={(e) => setMotifRefus(e.target.value)} rows={5} placeholder="Motif du refus ou commentaire" className="w-full rounded-lg px-3 py-2" style={{ background: "#0b1424", border: "1px solid #243348" }} />
                <button type="button" onClick={refuser} className="inline-flex items-center gap-2 rounded-lg px-4 py-2 font-semibold" style={{ background: "rgba(239,68,68,.12)", color: "#fca5a5" }}>
                  <XCircle size={16} /> Refuser le devis
                </button>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
