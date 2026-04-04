"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { api } from "@/crochets/useApi";
import { Calculator, Plus, Layers } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Local {
  id: string;
  designation: string;
  categorie: string;
  categorie_libelle: string;
  nombre: number;
  surface_unitaire_m2: string;
  surface_totale_m2: string;
}

interface ResultatsCalcul {
  shon_totale_m2: number;
  shob_totale_m2: number;
  cout_estime_ht: number;
  cout_par_m2_shon_ht: number;
  cout_par_m2_shob_ht: number;
  ratio_shob_shon: number;
  detail_par_categorie: Array<{
    categorie: string;
    categorie_libelle: string;
    surface_shon_m2: number;
    cout_ht: number;
    ratio_m2: number;
  }>;
  avertissements: string[];
  justification: string;
}

interface ProgrammeBatiment {
  id: string;
  intitule: string;
  type_batiment: string;
  type_batiment_libelle: string;
  type_operation: string;
  type_operation_libelle: string;
  localisation: string;
  zone_climatique: string;
  zone_sismique: string;
  niveau_qualite: string;
  niveau_qualite_libelle: string;
  annee_reference: number | null;
  observations: string;
  locaux: Local[];
  resultats_calcul: ResultatsCalcul | null;
  shon_totale: number | null;
  cout_estime_ht: number | null;
  cout_par_m2_shon_ht: number | null;
  date_calcul: string | null;
}

// ---------------------------------------------------------------------------
// Formulaire d'ajout de local
// ---------------------------------------------------------------------------

function FormulaireAjoutLocal({
  programmeId,
  onSuccess,
}: {
  programmeId: string;
  onSuccess: () => void;
}) {
  const [designation, setDesignation] = useState("");
  const [categorie, setCategorie] = useState("bureau");
  const [nombre, setNombre] = useState(1);
  const [surfaceUnitaire, setSurfaceUnitaire] = useState("");

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      api.post(`/api/batiment/${programmeId}/locaux/`, {
        designation,
        categorie,
        nombre,
        surface_unitaire_m2: surfaceUnitaire,
      }),
    onSuccess: () => {
      setDesignation("");
      setSurfaceUnitaire("");
      setNombre(1);
      onSuccess();
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutate();
      }}
      className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-50 rounded-lg"
    >
      <div className="sm:col-span-2">
        <label className="bloc-label">Désignation</label>
        <input
          className="champ-texte"
          value={designation}
          onChange={(e) => setDesignation(e.target.value)}
          placeholder="Ex. : Bureau standard"
          required
        />
      </div>
      <div>
        <label className="bloc-label">Catégorie</label>
        <select
          className="champ-texte"
          value={categorie}
          onChange={(e) => setCategorie(e.target.value)}
        >
          <option value="bureau">Bureau</option>
          <option value="salle_reunion">Salle de réunion</option>
          <option value="hall">Hall / Accueil</option>
          <option value="circulation">Circulation</option>
          <option value="sanitaire">Sanitaire</option>
          <option value="technique">Local technique</option>
          <option value="logement">Logement</option>
          <option value="commerce">Commerce</option>
          <option value="parking">Parking</option>
          <option value="autre">Autre</option>
        </select>
      </div>
      <div>
        <label className="bloc-label">Nombre</label>
        <input
          type="number"
          min={1}
          className="champ-texte"
          value={nombre}
          onChange={(e) => setNombre(Number(e.target.value))}
          required
        />
      </div>
      <div>
        <label className="bloc-label">Surface unitaire (m²)</label>
        <input
          type="number"
          step="0.01"
          min="0"
          className="champ-texte"
          value={surfaceUnitaire}
          onChange={(e) => setSurfaceUnitaire(e.target.value)}
          placeholder="0,00"
          required
        />
      </div>
      <div className="flex items-end sm:col-span-3">
        <button
          type="submit"
          disabled={isPending}
          className={clsx("btn-primaire text-xs flex items-center gap-1", isPending && "opacity-50")}
        >
          <Plus size={12} /> {isPending ? "Ajout…" : "Ajouter le local"}
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Composant principal
// ---------------------------------------------------------------------------

function formaterMontant(val: number | null | undefined) {
  if (val == null) return "—";
  return `${Number(val).toLocaleString("fr-FR", { minimumFractionDigits: 0 })} €`;
}

function formaterSurface(val: number | null | undefined) {
  if (val == null) return "—";
  return `${Number(val).toLocaleString("fr-FR", { minimumFractionDigits: 0 })} m²`;
}

export function DetailProgrammeBatiment({
  projetId,
  programmeId,
}: {
  projetId: string;
  programmeId: string;
}) {
  const queryClient = useQueryClient();
  const [ajoutLocal, setAjoutLocal] = useState(false);

  const { data: programme, isLoading, isError } = useQuery<ProgrammeBatiment>({
    queryKey: ["programme-batiment", programmeId],
    queryFn: () => api.get<ProgrammeBatiment>(`/api/batiment/${programmeId}/`),
  });

  const { mutate: calculer, isPending } = useMutation({
    mutationFn: () => api.post(`/api/batiment/${programmeId}/calculer/`, {}),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["programme-batiment", programmeId] }),
  });

  if (isLoading)
    return <div className="carte py-12 text-center text-slate-400 text-sm">Chargement…</div>;
  if (isError || !programme)
    return <div className="carte py-12 text-center text-red-500 text-sm">Erreur de chargement.</div>;

  const res = programme.resultats_calcul;

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500 mb-1">
            {programme.type_batiment_libelle} — {programme.type_operation_libelle}
          </p>
          <h2 className="text-lg font-semibold">{programme.intitule}</h2>
          {programme.localisation && (
            <p className="text-xs text-slate-400 mt-0.5">{programme.localisation}</p>
          )}
        </div>
        <button
          onClick={() => calculer()}
          disabled={isPending}
          className={clsx("btn-primaire text-xs flex items-center gap-1 shrink-0", isPending && "opacity-50")}
        >
          <Calculator size={12} />
          {isPending ? "Calcul…" : "Recalculer"}
        </button>
      </div>

      {/* Caractéristiques */}
      <div className="carte">
        <h2 className="mb-4">Caractéristiques</h2>
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-3 text-sm">
          <div>
            <dt className="text-slate-500 text-xs">Zone climatique</dt>
            <dd className="font-medium mt-0.5">{programme.zone_climatique || "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500 text-xs">Zone sismique</dt>
            <dd className="font-medium mt-0.5">{programme.zone_sismique || "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500 text-xs">Niveau de qualité</dt>
            <dd className="font-medium mt-0.5">{programme.niveau_qualite_libelle}</dd>
          </div>
          {programme.annee_reference && (
            <div>
              <dt className="text-slate-500 text-xs">Année de référence</dt>
              <dd className="font-mono font-medium mt-0.5">{programme.annee_reference}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Résultats synthèse */}
      {res && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="carte text-center">
            <p className="text-xs text-slate-500 mb-1">SHON totale</p>
            <p className="text-2xl font-bold font-mono text-primaire-700">
              {Number(res.shon_totale_m2).toLocaleString("fr-FR")}
            </p>
            <p className="text-xs text-slate-400">m²</p>
          </div>
          <div className="carte text-center">
            <p className="text-xs text-slate-500 mb-1">SHOB totale</p>
            <p className="text-2xl font-bold font-mono text-primaire-700">
              {Number(res.shob_totale_m2).toLocaleString("fr-FR")}
            </p>
            <p className="text-xs text-slate-400">m²</p>
          </div>
          <div className="carte text-center">
            <p className="text-xs text-slate-500 mb-1">Coût estimé HT</p>
            <p className="text-xl font-bold text-primaire-700">
              {formaterMontant(res.cout_estime_ht)}
            </p>
          </div>
          <div className="carte text-center">
            <p className="text-xs text-slate-500 mb-1">€/m² SHON HT</p>
            <p className="text-xl font-bold text-primaire-700">
              {formaterMontant(res.cout_par_m2_shon_ht)}
            </p>
          </div>
        </div>
      )}

      {/* Programme des locaux */}
      <div className="carte">
        <div className="flex items-center justify-between mb-4">
          <h2 className="flex items-center gap-2">
            <Layers size={16} /> Programme des locaux ({programme.locaux.length})
          </h2>
          <button
            onClick={() => setAjoutLocal(!ajoutLocal)}
            className="btn-secondaire text-xs flex items-center gap-1"
          >
            <Plus size={12} /> Ajouter un local
          </button>
        </div>

        {ajoutLocal && (
          <div className="mb-4">
            <FormulaireAjoutLocal
              programmeId={programmeId}
              onSuccess={() => {
                setAjoutLocal(false);
                queryClient.invalidateQueries({ queryKey: ["programme-batiment", programmeId] });
              }}
            />
          </div>
        )}

        {programme.locaux.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">
            Aucun local — ajoutez des locaux pour constituer le programme.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs text-slate-500">
                  <th className="text-left py-2 pr-4 font-medium">Désignation</th>
                  <th className="text-left py-2 pr-4 font-medium">Catégorie</th>
                  <th className="text-right py-2 pr-4 font-medium">Nb</th>
                  <th className="text-right py-2 pr-4 font-medium">Surface unit. (m²)</th>
                  <th className="text-right py-2 font-medium">Surface totale (m²)</th>
                </tr>
              </thead>
              <tbody>
                {programme.locaux.map((local) => (
                  <tr key={local.id} className="border-b border-slate-50">
                    <td className="py-2 pr-4 font-medium">{local.designation}</td>
                    <td className="py-2 pr-4 text-xs text-slate-500">{local.categorie_libelle}</td>
                    <td className="py-2 pr-4 text-right font-mono text-xs">{local.nombre}</td>
                    <td className="py-2 pr-4 text-right font-mono text-xs">
                      {Number(local.surface_unitaire_m2).toLocaleString("fr-FR", {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td className="py-2 text-right font-mono text-xs font-semibold">
                      {Number(local.surface_totale_m2).toLocaleString("fr-FR", {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                ))}
                {programme.locaux.length > 0 && (
                  <tr className="border-t border-slate-200">
                    <td colSpan={4} className="py-2 text-sm font-semibold text-slate-700">
                      Total programme
                    </td>
                    <td className="py-2 text-right font-mono text-sm font-bold text-primaire-700">
                      {formaterSurface(programme.shon_totale)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Détail par catégorie (si résultats) */}
      {res && res.detail_par_categorie && res.detail_par_categorie.length > 0 && (
        <div className="carte">
          <h2 className="mb-4">Détail par catégorie</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs text-slate-500">
                  <th className="text-left py-2 pr-4 font-medium">Catégorie</th>
                  <th className="text-right py-2 pr-4 font-medium">Surface SHON (m²)</th>
                  <th className="text-right py-2 pr-4 font-medium">Ratio (€/m²)</th>
                  <th className="text-right py-2 font-medium">Coût estimé HT</th>
                </tr>
              </thead>
              <tbody>
                {res.detail_par_categorie.map((ligne, i) => (
                  <tr key={i} className="border-b border-slate-50">
                    <td className="py-2 pr-4 font-medium">{ligne.categorie_libelle}</td>
                    <td className="py-2 pr-4 text-right font-mono text-xs">
                      {Number(ligne.surface_shon_m2).toLocaleString("fr-FR")}
                    </td>
                    <td className="py-2 pr-4 text-right font-mono text-xs">
                      {formaterMontant(ligne.ratio_m2)}
                    </td>
                    <td className="py-2 text-right font-mono text-xs font-semibold text-primaire-700">
                      {formaterMontant(ligne.cout_ht)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Justification et avertissements */}
      {res && (res.justification || res.avertissements.length > 0) && (
        <div className="carte space-y-3">
          {res.justification && (
            <div>
              <p className="text-xs text-slate-500 mb-1">Justification</p>
              <p className="text-sm text-slate-700">{res.justification}</p>
            </div>
          )}
          {res.avertissements.length > 0 && (
            <div>
              <p className="text-xs text-orange-500 font-medium mb-1">Avertissements</p>
              <ul className="space-y-1">
                {res.avertissements.map((a, i) => (
                  <li key={i} className="text-sm text-orange-600">
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* État initial sans calcul */}
      {!res && programme.locaux.length > 0 && (
        <div className="carte py-8 text-center text-slate-400 space-y-3">
          <p className="text-sm">Aucun résultat de calcul — lancez l&apos;estimation.</p>
          <button
            onClick={() => calculer()}
            disabled={isPending}
            className="btn-primaire text-xs flex items-center gap-1 mx-auto"
          >
            <Calculator size={12} />
            {isPending ? "Calcul en cours…" : "Lancer le calcul"}
          </button>
        </div>
      )}

      {programme.observations && (
        <div className="carte text-sm text-slate-600">
          <p className="text-xs text-slate-400 mb-1">Observations</p>
          <p>{programme.observations}</p>
        </div>
      )}
    </div>
  );
}
