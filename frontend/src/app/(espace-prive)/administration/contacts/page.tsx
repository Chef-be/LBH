"use client";

import { useState, useEffect, useCallback } from "react";
import { api, extraireListeResultats } from "@/crochets/useApi";
import { Mail, Phone, Building2, Check, RefreshCw, Filter } from "lucide-react";
import {
  CarteSectionAdmin,
  EntetePageAdmin,
} from "@/composants/administration/Presentation";

interface DemandeContact {
  id: string;
  nom: string;
  courriel: string;
  telephone: string;
  organisation: string;
  sujet: string;
  message: string;
  traitee: boolean;
  date_reception: string;
}

const LIBELLES_SUJET: Record<string, string> = {
  devis: "Demande de devis",
  information: "Demande d'information",
  partenariat: "Partenariat",
  recrutement: "Candidature",
  autre: "Autre",
};

export default function PageContactsAdmin() {
  const [demandes, setDemandes] = useState<DemandeContact[]>([]);
  const [chargement, setChargement] = useState(true);
  const [filtre, setFiltre] = useState<"toutes" | "non-traitees" | "traitees">("non-traitees");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [traitementEnCours, setTraitementEnCours] = useState<string | null>(null);

  const charger = useCallback(async () => {
    setChargement(true);
    try {
      const params = filtre === "non-traitees" ? "?traitee=0" : filtre === "traitees" ? "?traitee=1" : "";
      const data = await api.get<DemandeContact[]>(`/api/site/contact/demandes/${params}`);
      setDemandes(extraireListeResultats(data));
    } catch {
      setDemandes([]);
    } finally {
      setChargement(false);
    }
  }, [filtre]);

  useEffect(() => { charger(); }, [charger]);

  const marquerTraitee = async (id: string) => {
    setTraitementEnCours(id);
    try {
      await api.patch(`/api/site/contact/demandes/${id}/traiter/`, {});
      await charger();
      if (selectedId === id) setSelectedId(null);
    } finally {
      setTraitementEnCours(null);
    }
  };

  const selected = demandes.find((d) => d.id === selectedId);
  const demandesNonTraitees = demandes.filter((demande) => !demande.traitee).length;
  const demandesTraitees = demandes.filter((demande) => demande.traitee).length;

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="space-y-6">
      <EntetePageAdmin
        titre="Demandes de contact"
        description="Messages reçus via le formulaire du site, à qualifier puis à traiter."
        actions={(
          <button onClick={charger} className="btn-secondaire py-2 px-3">
            <RefreshCw className="w-4 h-4" />
            Actualiser
          </button>
        )}
        statistiques={[
          { libelle: "Filtre actif", valeur: filtre === "non-traitees" ? "Non traitées" : filtre === "traitees" ? "Traitées" : "Toutes" },
          { libelle: "Total chargé", valeur: `${demandes.length} demande${demandes.length > 1 ? "s" : ""}` },
          { libelle: "En attente", valeur: `${demandesNonTraitees}` },
          { libelle: "Traitées", valeur: `${demandesTraitees}` },
        ]}
      />

      <CarteSectionAdmin
        titre="Filtres de consultation"
        description="Affinez la liste pour traiter rapidement les messages en attente."
      >
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          {(["non-traitees", "toutes", "traitees"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFiltre(f)}
              className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                filtre === f
                  ? "bg-primaire-100 text-primaire-700"
                  : "text-slate-500 hover:bg-slate-100"
              }`}
            >
              {f === "non-traitees" ? "Non traitées" : f === "traitees" ? "Traitées" : "Toutes"}
            </button>
          ))}
        </div>
      </CarteSectionAdmin>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        <CarteSectionAdmin
          titre="Liste des demandes"
          description="Sélectionnez un message pour afficher son contenu détaillé."
          className="lg:col-span-1"
        >
          <div className="-m-5 divide-y divide-slate-100">
          {chargement ? (
            <div className="py-12 text-center text-slate-400 text-sm">Chargement…</div>
          ) : demandes.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              Aucune demande {filtre === "non-traitees" ? "en attente" : ""}.
            </div>
          ) : (
            demandes.map((d) => (
              <button
                key={d.id}
                onClick={() => setSelectedId(d.id === selectedId ? null : d.id)}
                className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors ${
                  selectedId === d.id ? "bg-primaire-50" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800 truncate text-sm">{d.nom}</p>
                    <p className="text-xs text-slate-500 truncate">{d.courriel}</p>
                  </div>
                  {d.traitee ? (
                    <span className="badge-succes text-xs shrink-0">Traitée</span>
                  ) : (
                    <span className="badge-alerte text-xs shrink-0">En attente</span>
                  )}
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="badge-neutre text-xs">{LIBELLES_SUJET[d.sujet] ?? d.sujet}</span>
                  <span className="text-xs text-slate-400">
                    {new Date(d.date_reception).toLocaleDateString("fr-FR")}
                  </span>
                </div>
              </button>
            ))
          )}
          </div>
        </CarteSectionAdmin>

        <div className="lg:col-span-2">
          {selected ? (
            <CarteSectionAdmin
              titre="Détail de la demande"
              description="Informations de contact, sujet et contenu du message."
            >
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-semibold text-slate-800">{selected.nom}</h2>
                  <p className="text-sm text-slate-500">{formatDate(selected.date_reception)}</p>
                </div>
                {!selected.traitee && (
                  <button
                    onClick={() => marquerTraitee(selected.id)}
                    disabled={traitementEnCours === selected.id}
                    className="btn-primaire text-sm py-2 disabled:opacity-60"
                  >
                    <Check className="w-4 h-4" />
                    Marquer comme traitée
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-xl">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                  <a href={`mailto:${selected.courriel}`} className="text-primaire-600 hover:underline truncate">
                    {selected.courriel}
                  </a>
                </div>
                {selected.telephone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="text-slate-700">{selected.telephone}</span>
                  </div>
                )}
                {selected.organisation && (
                  <div className="flex items-center gap-2 text-sm sm:col-span-2">
                    <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="text-slate-700">{selected.organisation}</span>
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-2">
                  Sujet — {LIBELLES_SUJET[selected.sujet] ?? selected.sujet}
                </p>
                <div className="p-4 bg-ardoise-50 rounded-xl border border-ardoise-200 text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">
                  {selected.message}
                </div>
              </div>
            </div>
            </CarteSectionAdmin>
          ) : (
            <CarteSectionAdmin>
              <div className="py-16 text-center text-slate-400 text-sm">
              Sélectionnez une demande dans la liste pour voir son contenu.
              </div>
            </CarteSectionAdmin>
          )}
        </div>
      </div>
    </div>
  );
}
