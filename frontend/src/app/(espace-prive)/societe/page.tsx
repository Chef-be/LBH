"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/crochets/useApi";
import { TableauDeBord, DevisHonoraires, Facture, RentabiliteDossier, RentabiliteSalarie, TempsPasse } from "@/types/societe";
import { Euro, FileText, Receipt, AlertTriangle, TrendingUp, Clock, Plus, ChevronRight } from "lucide-react";

function formaterMontant(val: string | number | null | undefined): string {
  if (val == null) return "—";
  const n = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(n)) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)} M€`;
  if (n >= 1_000) return `${Math.round(n / 1_000)} k€`;
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 0 }) + " €";
}

function formaterDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formaterHeures(val: string | number | null | undefined): string {
  if (val == null) return "—";
  const n = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(n)) return "—";
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " h";
}

const COULEURS_STATUT_DEVIS: Record<string, string> = {
  brouillon: "var(--texte-3)",
  envoye: "#f59e0b",
  accepte: "#10b981",
  refuse: "#ef4444",
  expire: "#6b7280",
  annule: "#6b7280",
};

const COULEURS_STATUT_FACTURE: Record<string, string> = {
  brouillon: "var(--texte-3)",
  emise: "#3b82f6",
  en_retard: "#ef4444",
  partiellement_payee: "#f59e0b",
  payee: "#10b981",
  annulee: "#6b7280",
  avoir: "#6b7280",
};

function TuileKpi({
  icone, label, valeur, sous, couleur, href,
}: {
  icone: React.ReactNode; label: string; valeur: string; sous?: string;
  couleur: string; href?: string;
}) {
  const contenu = (
    <div
      className="rounded-xl p-5 flex flex-col gap-3 transition-all"
      style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}
    >
      <div className="flex items-start justify-between">
        <span
          className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ background: `color-mix(in srgb, ${couleur} 12%, var(--fond-app))`, color: couleur }}
        >
          {icone}
        </span>
        {href && <ChevronRight size={14} style={{ color: "var(--texte-3)" }} />}
      </div>
      <div>
        <p className="text-xs uppercase tracking-wider" style={{ color: "var(--texte-3)" }}>{label}</p>
        <p className="text-2xl font-bold mt-1" style={{ color: "var(--texte)" }}>{valeur}</p>
        {sous && <p className="text-xs mt-0.5" style={{ color: "var(--texte-2)" }}>{sous}</p>}
      </div>
    </div>
  );
  if (href) {
    return <Link href={href} className="block hover:scale-[1.01] transition-transform">{contenu}</Link>;
  }
  return contenu;
}

export default function PageTableauDeBordSociete() {
  const { data: tdb, isLoading } = useQuery<TableauDeBord>({
    queryKey: ["societe-tdb"],
    queryFn: () => api.get<TableauDeBord>("/api/societe/tableau-de-bord/"),
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24" style={{ color: "var(--texte-3)" }}>
        Chargement…
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <TuileKpi
          icone={<TrendingUp size={16} />}
          label="CA HT (année)"
          valeur={formaterMontant(tdb?.ca_annee_courante)}
          sous={`Ce mois : ${formaterMontant(tdb?.ca_mois_courant)}`}
          couleur="var(--c-base)"
        />
        <TuileKpi
          icone={<Euro size={16} />}
          label="Encaissé"
          valeur={formaterMontant(tdb?.montant_encaisse)}
          sous="Paiements reçus cette année"
          couleur="#10b981"
        />
        <TuileKpi
          icone={<Clock size={16} />}
          label="En attente"
          valeur={formaterMontant(tdb?.montant_en_attente)}
          sous={`${tdb?.nb_devis_attente_reponse ?? 0} devis sans réponse`}
          couleur="#f59e0b"
          href="/societe/factures"
        />
        <TuileKpi
          icone={<AlertTriangle size={16} />}
          label="En retard"
          valeur={formaterMontant(tdb?.montant_en_retard)}
          sous={`${tdb?.nb_factures_en_retard ?? 0} facture${(tdb?.nb_factures_en_retard ?? 0) > 1 ? "s" : ""} impayée${(tdb?.nb_factures_en_retard ?? 0) > 1 ? "s" : ""}`}
          couleur="#ef4444"
          href="/societe/factures"
        />
      </div>

      {/* Actions rapides */}
      <div className="flex flex-wrap gap-3">
        <Link
          href="/societe/devis/nouveau"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition hover:opacity-90"
          style={{ background: "var(--c-base)" }}
        >
          <Plus size={14} /> Nouvelle affaire
        </Link>
      </div>

      {/* Double colonne : devis récents + factures en retard */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Devis récents */}
        <section
          className="rounded-xl p-5"
          style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--texte-3)" }}>
              <FileText size={14} className="inline mr-2" />Devis récents
            </h2>
            <Link href="/societe/devis" className="text-xs underline" style={{ color: "var(--texte-3)" }}>
              Voir tous
            </Link>
          </div>

          {(!tdb?.devis_recents || tdb.devis_recents.length === 0) ? (
            <p className="text-sm py-6 text-center" style={{ color: "var(--texte-3)" }}>Aucun devis pour l&apos;instant</p>
          ) : (
            <ul className="space-y-2">
              {tdb.devis_recents.map((d: DevisHonoraires) => (
                <li key={d.id}>
                  <Link
                    href={`/societe/devis/${d.id}`}
                    className="flex items-center justify-between p-3 rounded-lg transition hover:opacity-80"
                    style={{ background: "var(--fond-entree)" }}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{d.reference} — {d.client_nom}</p>
                      <p className="text-xs truncate mt-0.5" style={{ color: "var(--texte-3)" }}>{d.intitule}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-3">
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{
                          color: COULEURS_STATUT_DEVIS[d.statut] ?? "var(--texte-3)",
                          background: `color-mix(in srgb, ${COULEURS_STATUT_DEVIS[d.statut] ?? "gray"} 12%, var(--fond-carte))`,
                        }}
                      >
                        {d.statut_libelle}
                      </span>
                      <span className="text-sm font-mono font-bold" style={{ color: "var(--texte)" }}>
                        {formaterMontant(d.montant_ttc)}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Factures en retard */}
        <section
          className="rounded-xl p-5"
          style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--texte-3)" }}>
              <Receipt size={14} className="inline mr-2" />Factures en retard
            </h2>
            <Link href="/societe/factures?en_retard=true" className="text-xs underline" style={{ color: "var(--texte-3)" }}>
              Voir toutes
            </Link>
          </div>

          {(!tdb?.factures_en_retard || tdb.factures_en_retard.length === 0) ? (
            <div className="flex flex-col items-center justify-center py-6 gap-2">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "color-mix(in srgb, #10b981 12%, var(--fond-app))" }}>
                <Euro size={20} style={{ color: "#10b981" }} />
              </div>
              <p className="text-sm font-medium" style={{ color: "#10b981" }}>Aucune facture en retard</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {tdb.factures_en_retard.map((f: Facture) => (
                <li key={f.id}>
                  <Link
                    href={`/societe/factures/${f.id}`}
                    className="flex items-center justify-between p-3 rounded-lg transition hover:opacity-80"
                    style={{ background: "var(--fond-entree)" }}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{f.reference} — {f.client_nom}</p>
                      <p className="text-xs mt-0.5" style={{ color: "#ef4444" }}>
                        Échue le {formaterDate(f.date_echeance)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-3">
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: "color-mix(in srgb, #ef4444 12%, var(--fond-carte))", color: "#ef4444" }}>
                        Restant : {formaterMontant(f.montant_restant)}
                      </span>
                      <span className="text-xs font-mono" style={{ color: "var(--texte-3)" }}>
                        Total : {formaterMontant(f.montant_ttc)}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section
          className="rounded-xl p-5"
          style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--texte-3)" }}>
              Rentabilité par salarié
            </h2>
            <Link href="/societe/temps" className="text-xs underline" style={{ color: "var(--texte-3)" }}>
              Saisir les temps
            </Link>
          </div>
          {(!tdb?.rentabilite_par_salarie || tdb.rentabilite_par_salarie.length === 0) ? (
            <p className="text-sm py-6 text-center" style={{ color: "var(--texte-3)" }}>
              Aucune donnée de temps.
            </p>
          ) : (
            <div className="space-y-2">
              {tdb.rentabilite_par_salarie.map((ligne: RentabiliteSalarie) => (
                <div key={ligne.utilisateur_id} className="rounded-lg p-3" style={{ background: "var(--fond-entree)" }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{ligne.nom_complet}</p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--texte-3)" }}>
                        {formaterHeures(ligne.total_heures)} · coût {formaterMontant(ligne.total_cout)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs" style={{ color: "var(--texte-3)" }}>Marge estimée</p>
                      <p className="text-sm font-semibold" style={{ color: "var(--texte)" }}>
                        {formaterMontant(ligne.marge_estimee)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section
          className="rounded-xl p-5"
          style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--texte-3)" }}>
              Rentabilité par dossier
            </h2>
            <Link href="/societe/temps" className="text-xs underline" style={{ color: "var(--texte-3)" }}>
              Voir les temps
            </Link>
          </div>
          {(!tdb?.rentabilite_par_dossier || tdb.rentabilite_par_dossier.length === 0) ? (
            <p className="text-sm py-6 text-center" style={{ color: "var(--texte-3)" }}>
              Aucune donnée dossier.
            </p>
          ) : (
            <div className="space-y-2">
              {tdb.rentabilite_par_dossier.map((ligne: RentabiliteDossier) => (
                <div key={ligne.projet_id} className="rounded-lg p-3" style={{ background: "var(--fond-entree)" }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{ligne.reference} — {ligne.intitule}</p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--texte-3)" }}>
                        {formaterHeures(ligne.total_heures)} · coût {formaterMontant(ligne.total_cout)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs" style={{ color: "var(--texte-3)" }}>Honoraires</p>
                      <p className="text-sm font-semibold">{formaterMontant(ligne.honoraires_associes)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section
        className="rounded-xl p-5"
        style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--texte-3)" }}>
            Temps passés récents
          </h2>
          <Link href="/societe/temps" className="text-xs underline" style={{ color: "var(--texte-3)" }}>
            Gérer les temps
          </Link>
        </div>
        {(!tdb?.temps_passes_recents || tdb.temps_passes_recents.length === 0) ? (
          <p className="text-sm py-6 text-center" style={{ color: "var(--texte-3)" }}>
            Aucune saisie récente.
          </p>
        ) : (
          <ul className="space-y-2">
            {tdb.temps_passes_recents.map((ligne: TempsPasse) => (
              <li key={ligne.id} className="rounded-lg p-3" style={{ background: "var(--fond-entree)" }}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {ligne.utilisateur_nom} · {ligne.projet_reference}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--texte-3)" }}>
                      {ligne.libelle_cible || ligne.nature_libelle} · {formaterDate(ligne.date_saisie)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{formaterHeures(ligne.nb_heures)}</p>
                    <p className="text-xs" style={{ color: "var(--texte-3)" }}>{formaterMontant(ligne.cout_total)}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
