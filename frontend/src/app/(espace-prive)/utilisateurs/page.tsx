"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { api, extraireListeResultats } from "@/crochets/useApi";
import { Plus, Search, UserCheck, UserX, Pencil, Users } from "lucide-react";

interface Utilisateur {
  id: string;
  courriel: string;
  prenom: string;
  nom: string;
  nom_complet: string;
  fonction: string;
  profil_libelle: string | null;
  organisation_nom: string | null;
  est_actif: boolean;
  est_super_admin: boolean;
  invitation_en_attente?: boolean;
  courriel_verifie_le?: string | null;
  date_creation: string;
  derniere_connexion_ip: string | null;
}

export default function PageUtilisateurs() {
  const [utilisateurs, setUtilisateurs] = useState<Utilisateur[]>([]);
  const [chargement, setChargement] = useState(true);
  const [recherche, setRecherche] = useState("");
  const [filtre, setFiltre] = useState<"tous" | "actifs" | "inactifs">("actifs");

  useEffect(() => {
    api.get<Utilisateur[]>("/api/auth/utilisateurs/")
      .then((data) => setUtilisateurs(extraireListeResultats(data)))
      .catch(() => setUtilisateurs([]))
      .finally(() => setChargement(false));
  }, []);

  const filtrés = utilisateurs.filter((u) => {
    const matchTexte =
      !recherche ||
      u.nom_complet.toLowerCase().includes(recherche.toLowerCase()) ||
      u.courriel.toLowerCase().includes(recherche.toLowerCase()) ||
      (u.fonction || "").toLowerCase().includes(recherche.toLowerCase());
    const matchActif =
      filtre === "tous" || (filtre === "actifs" ? u.est_actif : !u.est_actif);
    return matchTexte && matchActif;
  });

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primaire-100 flex items-center justify-center">
            <Users className="w-5 h-5 text-primaire-600" />
          </div>
          <div>
            <h1>Utilisateurs</h1>
            <p className="text-slate-500 mt-0.5 text-sm">
              Gestion des comptes et droits d&apos;accès
            </p>
          </div>
        </div>
        <Link href="/utilisateurs/nouveau" className="btn-primaire">
          <Plus className="w-4 h-4" />
          Nouvel utilisateur
        </Link>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="search"
            className="champ-saisie pl-9 w-full"
            placeholder="Rechercher par nom, courriel, fonction…"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
          />
        </div>
        <div className="flex gap-1">
          {(["actifs", "tous", "inactifs"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFiltre(f)}
              className={`px-3 py-2 text-sm rounded-lg font-medium transition-colors ${
                filtre === f
                  ? "bg-primaire-100 text-primaire-700"
                  : "text-slate-500 hover:bg-slate-100"
              }`}
            >
              {f === "actifs" ? "Actifs" : f === "inactifs" ? "Inactifs" : "Tous"}
            </button>
          ))}
        </div>
      </div>

      {/* Tableau */}
      <div className="carte">
        {chargement ? (
          <div className="py-12 text-center text-slate-400 text-sm">Chargement…</div>
        ) : filtrés.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">
            {recherche ? "Aucun utilisateur ne correspond à la recherche." : "Aucun utilisateur pour le moment."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-3 pr-4 font-medium text-slate-500">Utilisateur</th>
                  <th className="text-left py-3 pr-4 font-medium text-slate-500 hidden sm:table-cell">Profil</th>
                  <th className="text-left py-3 pr-4 font-medium text-slate-500 hidden lg:table-cell">Organisation</th>
                  <th className="text-left py-3 pr-4 font-medium text-slate-500 hidden md:table-cell">Créé le</th>
                  <th className="text-center py-3 pr-4 font-medium text-slate-500">Statut</th>
                  <th className="text-right py-3 font-medium text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtrés.map((u) => (
                  <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primaire-100 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-primaire-700">
                            {u.prenom.charAt(0)}{u.nom.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-slate-800">{u.nom_complet}</p>
                          <p className="text-xs text-slate-400">{u.courriel}</p>
                          {u.fonction && (
                            <p className="text-xs text-slate-500">{u.fonction}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-4 hidden sm:table-cell">
                      {u.est_super_admin ? (
                        <span className="badge-info text-xs">Super-admin</span>
                      ) : u.profil_libelle ? (
                        <span className="badge-neutre text-xs">{u.profil_libelle}</span>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-slate-500 text-xs hidden lg:table-cell">
                      {u.organisation_nom ?? "—"}
                    </td>
                    <td className="py-3 pr-4 text-slate-400 text-xs hidden md:table-cell">
                      {formatDate(u.date_creation)}
                    </td>
                    <td className="py-3 pr-4 text-center">
                      {u.est_actif ? (
                        <span className="inline-flex items-center gap-1 badge-succes text-xs">
                          <UserCheck className="w-3 h-3" />
                          Actif
                        </span>
                      ) : u.invitation_en_attente ? (
                        <span className="inline-flex items-center gap-1 badge-info text-xs">
                          Invitation en attente
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 badge-danger text-xs">
                          <UserX className="w-3 h-3" />
                          Inactif
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-right">
                      <Link
                        href={`/utilisateurs/${u.id}`}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-500 hover:text-primaire-600 hover:bg-primaire-50 rounded-lg transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Modifier
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-400">
          {filtrés.length} utilisateur{filtrés.length > 1 ? "s" : ""}
          {filtre !== "tous" ? ` ${filtre}` : ""}
        </div>
      </div>
    </div>
  );
}
