"use client";

import { useMemo } from "react";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
} from "recharts";
import {
  MapPin, Building2, Calendar, Euro, FileText, CheckCircle2,
  Folder, Target, Users, Layers
} from "lucide-react";
import type { EtatWizard, ParcoursProjet } from "./types";

interface EtapeRecapitulatifProps {
  etat: EtatWizard;
  parcours: ParcoursProjet | null;
  erreurs: Record<string, string>;
  enSoumission: boolean;
  onSoumettre: () => void;
}

/* ────────────────────────────────────────────────────────────
   TUILE KPI
────────────────────────────────────────────────────────────── */
function TuileInfo({
  icone,
  label,
  valeur,
  sous,
}: {
  icone: React.ReactNode;
  label: string;
  valeur: string;
  sous?: string;
}) {
  return (
    <div
      className="rounded-xl p-4 flex items-start gap-3"
      style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}
    >
      <span
        className="mt-0.5 flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
        style={{ background: "var(--c-leger)", color: "var(--c-base)" }}
      >
        {icone}
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wider" style={{ color: "var(--texte-3)" }}>
          {label}
        </p>
        <p className="text-sm font-semibold mt-0.5 truncate" style={{ color: "var(--texte)" }}>
          {valeur || <span style={{ color: "var(--texte-3)" }}>Non renseigné</span>}
        </p>
        {sous && (
          <p className="text-xs mt-0.5" style={{ color: "var(--texte-2)" }}>{sous}</p>
        )}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   GRAPHIQUE RADAR — PROFIL MISSIONS
────────────────────────────────────────────────────────────── */
function RadarMissions({ sousMissionsIds, parcours }: { sousMissionsIds: string[]; parcours: ParcoursProjet | null }) {
  const data = useMemo(() => {
    const categories = [
      { sujet: "Économie", codes: ["EC", "EST", "CHIF"] },
      { sujet: "Rédaction", codes: ["RED", "CCTP", "PE", "DOC"] },
      { sujet: "Suivi", codes: ["SUV", "DET", "OPC", "EXE"] },
      { sujet: "Analyse", codes: ["ANA", "DIAG", "ETU"] },
      { sujet: "Conformité", codes: ["VISA", "VERIF", "CERT"] },
    ];

    const sousMissions = parcours?.referentiels?.sous_missions ?? [];

    return categories.map(({ sujet, codes }) => {
      const total = sousMissions.filter((sm) =>
        codes.some((c) => sm.code.startsWith(c))
      ).length;
      const selec = sousMissions.filter(
        (sm) => sousMissionsIds.includes(sm.id) && codes.some((c) => sm.code.startsWith(c))
      ).length;
      return {
        sujet,
        valeur: total > 0 ? Math.round((selec / total) * 100) : 0,
        fullMark: 100,
      };
    });
  }, [sousMissionsIds, parcours]);

  if (sousMissionsIds.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-xs text-center" style={{ color: "var(--texte-3)" }}>
          Aucune sous-mission sélectionnée
        </p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <RadarChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
        <PolarGrid stroke="var(--bordure)" />
        <PolarAngleAxis
          dataKey="sujet"
          tick={{ fontSize: 11, fill: "var(--texte-2)" }}
        />
        <Radar
          name="Profil"
          dataKey="valeur"
          stroke="var(--c-base)"
          fill="var(--c-base)"
          fillOpacity={0.25}
          strokeWidth={2}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}

/* ────────────────────────────────────────────────────────────
   GAUGE BUDGET — SVG semi-cercle
────────────────────────────────────────────────────────────── */
function GaugeBudget({ montant }: { montant: string }) {
  const valeur = parseFloat(montant.replace(/\s/g, "").replace(",", ".")) || 0;

  const seuilsKpi = [100_000, 500_000, 1_000_000, 5_000_000, 10_000_000];
  const niveaux = ["Très petit", "Petit", "Moyen", "Grand", "Très grand", "Majeur"];
  const niveauIdx = seuilsKpi.findIndex((s) => valeur < s);
  const niveau = niveauIdx === -1 ? niveaux[5] : niveaux[niveauIdx];
  const pct = Math.min(
    niveauIdx === -1 ? 100 : Math.round(((niveauIdx + (valeur / seuilsKpi[niveauIdx])) / seuilsKpi.length) * 100),
    100
  );

  const couleur = pct < 30 ? "#10b981" : pct < 60 ? "#3b82f6" : pct < 85 ? "#f59e0b" : "#ef4444";

  const montantFormate = valeur >= 1_000_000
    ? `${(valeur / 1_000_000).toFixed(1)}M€`
    : valeur >= 1_000
    ? `${Math.round(valeur / 1_000)} k€`
    : valeur > 0 ? `${valeur} €` : "—";

  // SVG semi-cercle : centre (60,58), rayon 42
  const R = 42;
  const cx = 60;
  const cy = 58;
  const ARC = Math.PI * R; // longueur de la demi-circonférence
  const dashOffset = ARC * (1 - pct / 100);

  return (
    <div className="flex flex-col items-center gap-0">
      <svg viewBox="0 0 120 68" width="148" height="84" aria-hidden="true">
        {/* Track (fond) */}
        <path
          d={`M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`}
          fill="none"
          stroke="var(--fond-entree)"
          strokeWidth="10"
          strokeLinecap="round"
        />
        {/* Arc de progression */}
        <path
          d={`M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`}
          fill="none"
          stroke={couleur}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={ARC}
          strokeDashoffset={dashOffset}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
        {/* Valeur centrée DANS l'arc */}
        <text
          x={cx} y={cy - 4}
          textAnchor="middle"
          fill={couleur}
          fontSize="14"
          fontWeight="700"
          fontFamily="inherit"
        >
          {montantFormate}
        </text>
        {/* Pourcentage en petit */}
        <text
          x={cx} y={cy + 10}
          textAnchor="middle"
          fill="var(--texte-3)"
          fontSize="9"
          fontFamily="inherit"
        >
          {pct}% de l&apos;échelle
        </text>
      </svg>
      <p className="text-xs font-semibold -mt-1" style={{ color: "var(--texte-2)" }}>{niveau}</p>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   SECTION MISSIONS RÉSUMÉ
────────────────────────────────────────────────────────────── */
function ResumeMissions({ etat, parcours }: { etat: EtatWizard; parcours: ParcoursProjet | null }) {
  const missionsPrincipales = parcours?.referentiels?.missions_principales ?? [];
  const sousMissions = parcours?.referentiels?.sous_missions ?? [];

  const principalesSelectionnees = missionsPrincipales.filter((m) =>
    etat.missionsPrincipalesSelectionnees.includes(m.id)
  );
  const sousSelectionnees = sousMissions.filter((sm) =>
    etat.sousMissionsSelectionnees.includes(sm.id)
  );

  if (principalesSelectionnees.length === 0 && sousSelectionnees.length === 0) {
    return (
      <p className="text-sm italic" style={{ color: "var(--texte-3)" }}>
        Aucune mission sélectionnée
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {principalesSelectionnees.map((mp) => {
        const ss = sousSelectionnees.filter((sm) =>
          sm.code.startsWith(mp.code)
        );
        return (
          <div key={mp.id}>
            <div className="flex items-center gap-2 mb-1.5">
              <CheckCircle2 size={14} style={{ color: "var(--c-base)" }} />
              <span className="text-sm font-semibold" style={{ color: "var(--texte)" }}>
                {mp.libelle}
              </span>
            </div>
            {ss.length > 0 && (
              <div className="ml-6 flex flex-wrap gap-1.5">
                {ss.map((s) => (
                  <span
                    key={s.id}
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{
                      background: "var(--fond-entree)",
                      color: "var(--texte-2)",
                      border: "1px solid var(--bordure)",
                    }}
                  >
                    {s.libelle}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
      {/* Sous-missions orphelines (pas de mission principale parente) */}
      {sousSelectionnees.filter((sm) =>
        !principalesSelectionnees.some((mp) => sm.code.startsWith(mp.code))
      ).map((sm) => (
        <div key={sm.id} className="flex items-center gap-2">
          <CheckCircle2 size={14} style={{ color: "var(--texte-2)" }} />
          <span className="text-sm" style={{ color: "var(--texte-2)" }}>{sm.libelle}</span>
        </div>
      ))}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   COMPOSANT PRINCIPAL
────────────────────────────────────────────────────────────── */
export function EtapeRecapitulatif({
  etat,
  parcours,
  erreurs,
  enSoumission,
  onSoumettre,
}: EtapeRecapitulatifProps) {
  const familles = parcours?.referentiels?.familles_client ?? [];
  const contextes = parcours?.referentiels?.contextes_contractuels ?? [];

  const labelFamille = familles.find((f) => f.id === etat.familleClientId)?.libelle ?? "";
  const labelContexte = contextes.find((c) => c.id === etat.contexteContractuelId)?.libelle ?? "";

  const nbFichiers = etat.fichiersSourcesProjet.length;
  const nbSousMissions = etat.sousMissionsSelectionnees.length;
  const nbDossiers = parcours?.dossiers_ged?.length ?? 0;

  const erreursList = Object.values(erreurs).filter(Boolean);

  return (
    <div className="space-y-8">

      {/* Erreurs de validation */}
      {erreursList.length > 0 && (
        <div
          className="rounded-xl border p-4"
          style={{ borderColor: "#ef4444", background: "rgba(239,68,68,0.06)" }}
        >
          <p className="text-sm font-semibold text-red-500 mb-2">
            Veuillez corriger les erreurs suivantes avant de créer le projet :
          </p>
          <ul className="list-disc list-inside space-y-1">
            {erreursList.map((e, i) => (
              <li key={i} className="text-sm text-red-500">{e}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Grille KPI ── */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <TuileInfo
          icone={<FileText size={16} />}
          label="Référence"
          valeur={etat.reference}
          sous={etat.typeProjet !== "autre" ? etat.typeProjet : etat.typeProjetAutre}
        />
        <TuileInfo
          icone={<MapPin size={16} />}
          label="Localisation"
          valeur={[etat.commune, etat.departement].filter(Boolean).join(" — ")}
        />
        <TuileInfo
          icone={<Calendar size={16} />}
          label="Période prévisionnelle"
          valeur={etat.dateDebutPrevue || etat.dateFinPrevue
            ? [etat.dateDebutPrevue, etat.dateFinPrevue].filter(Boolean).join(" → ")
            : ""}
        />
        <TuileInfo
          icone={<Euro size={16} />}
          label="Budget estimé"
          valeur={etat.montantEstime
            ? `${Number(etat.montantEstime).toLocaleString("fr-FR")} € HT`
            : ""}
        />
      </section>

      {/* ── Intitulé ── */}
      <section
        className="rounded-xl p-5"
        style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}
      >
        <h3 className="text-lg font-bold" style={{ color: "var(--texte)" }}>
          {etat.intitule || <span style={{ color: "var(--texte-3)" }}>Intitulé non renseigné</span>}
        </h3>
        {etat.description && (
          <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--texte-2)" }}>
            {etat.description}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {labelFamille && (
            <span
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium"
              style={{ background: "var(--c-leger)", color: "var(--c-base)" }}
            >
              <Users size={11} />
              {labelFamille}
            </span>
          )}
          {labelContexte && (
            <span
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full"
              style={{ background: "var(--fond-entree)", color: "var(--texte-2)", border: "1px solid var(--bordure)" }}
            >
              <Building2 size={11} />
              {labelContexte}
            </span>
          )}
          {etat.natureOuvrage && (
            <span
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full"
              style={{ background: "var(--fond-entree)", color: "var(--texte-2)", border: "1px solid var(--bordure)" }}
            >
              <Layers size={11} />
              {etat.natureOuvrage === "batiment" ? "Bâtiment" : etat.natureOuvrage === "infrastructure" ? "Infrastructure" : "Mixte"}
            </span>
          )}
          {etat.statut && (
            <span
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full"
              style={{ background: "var(--fond-entree)", color: "var(--texte-2)", border: "1px solid var(--bordure)" }}
            >
              <Target size={11} />
              {etat.statut === "prospection" ? "Prospection" :
               etat.statut === "en_cours" ? "En cours" :
               etat.statut === "suspendu" ? "Suspendu" :
               etat.statut === "termine" ? "Terminé" :
               etat.statut === "abandonne" ? "Abandonné" : etat.statut}
            </span>
          )}
        </div>
      </section>

      {/* ── Missions + Radar ── */}
      <section className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <h3 className="text-base font-semibold mb-4" style={{ color: "var(--texte)" }}>
            Missions sélectionnées
            {nbSousMissions > 0 && (
              <span
                className="ml-2 text-xs px-2 py-0.5 rounded-full"
                style={{ background: "var(--c-leger)", color: "var(--c-base)" }}
              >
                {nbSousMissions} sous-mission{nbSousMissions > 1 ? "s" : ""}
              </span>
            )}
          </h3>
          <ResumeMissions etat={etat} parcours={parcours} />
        </div>

        <div
          className="lg:col-span-2 rounded-xl p-4 flex flex-col items-center justify-center"
          style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}
        >
          <p className="text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: "var(--texte-3)" }}>
            Profil des missions
          </p>
          <RadarMissions
            sousMissionsIds={etat.sousMissionsSelectionnees}
            parcours={parcours}
          />
        </div>
      </section>

      {/* ── Budget gauge + Fichiers + GED ── */}
      <section className="grid gap-4 sm:grid-cols-3">
        {/* Budget */}
        <div
          className="rounded-xl p-4 flex flex-col items-center justify-center"
          style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}
        >
          <p className="text-xs font-medium mb-3 uppercase tracking-wider" style={{ color: "var(--texte-3)" }}>
            Enveloppe budgétaire
          </p>
          {etat.montantEstime ? (
            <GaugeBudget montant={etat.montantEstime} />
          ) : (
            <p className="text-sm" style={{ color: "var(--texte-3)" }}>Non renseigné</p>
          )}
        </div>

        {/* Fichiers sources */}
        <div
          className="rounded-xl p-4"
          style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}
        >
          <div className="flex items-center gap-2 mb-3">
            <FileText size={14} style={{ color: "var(--c-base)" }} />
            <p className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--texte-3)" }}>
              Fichiers sources
            </p>
          </div>
          {nbFichiers === 0 ? (
            <p className="text-sm" style={{ color: "var(--texte-3)" }}>Aucun fichier joint</p>
          ) : (
            <>
              <p className="text-2xl font-bold mb-1" style={{ color: "var(--texte)" }}>
                {nbFichiers}
              </p>
              <p className="text-xs" style={{ color: "var(--texte-2)" }}>
                fichier{nbFichiers > 1 ? "s" : ""} analysé{nbFichiers > 1 ? "s" : ""}
              </p>
              {etat.resultatPreanalyse && (
                <p className="text-xs mt-2 font-medium" style={{ color: "var(--c-base)" }}>
                  {etat.resultatPreanalyse.resume.types_detectes.length} type{etat.resultatPreanalyse.resume.types_detectes.length > 1 ? "s" : ""} détecté{etat.resultatPreanalyse.resume.types_detectes.length > 1 ? "s" : ""}
                </p>
              )}
            </>
          )}
        </div>

        {/* Structure GED */}
        <div
          className="rounded-xl p-4"
          style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Folder size={14} style={{ color: "#f59e0b" }} />
            <p className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--texte-3)" }}>
              Structure GED
            </p>
          </div>
          {nbDossiers === 0 ? (
            <p className="text-sm" style={{ color: "var(--texte-3)" }}>Aucun dossier configuré</p>
          ) : (
            <>
              <p className="text-2xl font-bold mb-1" style={{ color: "var(--texte)" }}>
                {nbDossiers}
              </p>
              <p className="text-xs" style={{ color: "var(--texte-2)" }}>
                dossier{nbDossiers > 1 ? "s" : ""} créé{nbDossiers > 1 ? "s" : ""} automatiquement
              </p>
            </>
          )}
        </div>
      </section>

      {/* ── Variation de prix ── */}
      {etat.variationPrix.type_evolution && etat.variationPrix.type_evolution !== "ferme" && (
        <section
          className="rounded-xl p-4"
          style={{ background: "var(--fond-carte)", border: "1px solid var(--bordure)" }}
        >
          <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: "var(--texte-3)" }}>
            Variation de prix
          </p>
          <div className="flex flex-wrap gap-3 text-sm">
            <span style={{ color: "var(--texte-2)" }}>
              Type : <strong style={{ color: "var(--texte)" }}>{etat.variationPrix.type_evolution}</strong>
            </span>
            {etat.variationPrix.indice_reference && (
              <span style={{ color: "var(--texte-2)" }}>
                Indice : <strong style={{ color: "var(--texte)" }}>{etat.variationPrix.indice_reference}</strong>
              </span>
            )}
            {etat.variationPrix.formule_personnalisee && (
              <span className="font-mono text-xs" style={{ color: "var(--texte)" }}>
                {etat.variationPrix.formule_personnalisee}
              </span>
            )}
          </div>
        </section>
      )}

      {/* ── Bouton de création ── */}
      <div className="pt-2">
        <button
          type="button"
          onClick={onSoumettre}
          disabled={enSoumission || erreursList.length > 0}
          className="w-full py-3.5 px-6 rounded-xl font-semibold text-white text-base transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed hover:opacity-90 active:scale-[0.99]"
          style={{ background: erreursList.length > 0 ? "var(--texte-3)" : "var(--c-base)" }}
        >
          {enSoumission ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Création en cours…
            </span>
          ) : (
            "Créer le projet"
          )}
        </button>

        {erreursList.length > 0 && (
          <p className="text-center text-xs mt-2" style={{ color: "var(--texte-3)" }}>
            Corrigez les erreurs ci-dessus pour pouvoir créer le projet
          </p>
        )}
      </div>
    </div>
  );
}
