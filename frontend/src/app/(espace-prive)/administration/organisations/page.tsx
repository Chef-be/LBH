"use client";

import { useState, useEffect, useCallback } from "react";
import { api, ErreurApi, extraireListeResultats } from "@/crochets/useApi";
import { Plus, Pencil, Search, Building2, Phone, Mail, MapPin, Save, X, AlertCircle, Eye, EyeOff, Trash2 } from "lucide-react";
import { ActionsRapidesAdaptatives } from "@/composants/ui/ActionsRapides";
import { ChampAdresseRecherche } from "@/composants/organisations/ChampAdresseRecherche";
import { ChampNomOrganisationAnnuaire } from "@/composants/organisations/ChampNomOrganisationAnnuaire";
import {
  AlerteAdmin,
  CarteSectionAdmin,
  EntetePageAdmin,
} from "@/composants/administration/Presentation";
import {
  normaliserCodeOrganisation,
  type SuggestionAdressePublique,
  type SuggestionEntreprisePublique,
} from "@/lib/organisations";

interface Organisation {
  id: string;
  code: string;
  nom: string;
  type_organisation: string;
  siret: string;
  adresse: string;
  code_postal: string;
  ville: string;
  pays: string;
  telephone: string;
  courriel: string;
  site_web: string;
  est_active: boolean;
  nombre_membres: number;
}

const TYPES: Record<string, string> = {
  bureau_etudes: "Bureau d'études",
  entreprise: "Entreprise",
  maitre_ouvrage: "Maître d'ouvrage",
  partenaire: "Partenaire",
  sous_traitant: "Sous-traitant",
};

const VIDE = {
  code: "", nom: "", type_organisation: "entreprise",
  siret: "", adresse: "", code_postal: "", ville: "", pays: "France",
  telephone: "", courriel: "", site_web: "", est_active: true,
};

function Modal({ initial, onSave, onClose }: { initial: Organisation | null; onSave: (d: Partial<Organisation>) => Promise<void>; onClose: () => void }) {
  const [form, setForm] = useState(initial ? {
    code: initial.code, nom: initial.nom, type_organisation: initial.type_organisation,
    siret: initial.siret, adresse: initial.adresse, code_postal: initial.code_postal,
    ville: initial.ville, pays: initial.pays, telephone: initial.telephone,
    courriel: initial.courriel, site_web: initial.site_web, est_active: initial.est_active,
  } : { ...VIDE });
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const maj = (k: keyof typeof form, v: string | boolean) => setForm(p => ({ ...p, [k]: v }));

  const soumettre = async () => {
    if (!form.nom.trim() || !form.code.trim()) { setErreur("Le code et le nom sont requis."); return; }
    setChargement(true); setErreur(null);
    try { await onSave(form); onClose(); }
    catch (e) { setErreur(e instanceof ErreurApi ? e.detail : "Erreur lors de l'enregistrement."); }
    finally { setChargement(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-visible">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-800">{initial ? "Modifier l'organisation" : "Nouvelle organisation"}</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="p-6 space-y-4">
          {erreur && <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm"><AlertCircle className="w-4 h-4 shrink-0" />{erreur}</div>}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="libelle-champ">Code <span className="text-red-500">*</span></label>
              <input type="text" className="champ-saisie w-full" value={form.code}
                onChange={e => maj("code", e.target.value.toUpperCase())}
                placeholder="MOA-001" readOnly={!!initial} />
            </div>
            <div>
              <label className="libelle-champ">Type</label>
              <select className="champ-saisie w-full bg-white" value={form.type_organisation}
                onChange={e => maj("type_organisation", e.target.value)}>
                {Object.entries(TYPES).map(([val, lib]) => <option key={val} value={val}>{lib}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="libelle-champ">Nom <span className="text-red-500">*</span></label>
            <ChampNomOrganisationAnnuaire
              id="organisation-nom"
              className="champ-saisie w-full"
              typeOrganisation={form.type_organisation}
              value={form.nom}
              onChange={(valeur) => maj("nom", valeur)}
              onSelection={(suggestion: SuggestionEntreprisePublique) => {
                setForm((prev) => ({
                  ...prev,
                  nom: suggestion.nom,
                  code: prev.code || normaliserCodeOrganisation(suggestion.nom, prev.type_organisation),
                  siret: suggestion.siret || prev.siret,
                  adresse: suggestion.adresse || prev.adresse,
                  code_postal: suggestion.code_postal || prev.code_postal,
                  ville: suggestion.ville || prev.ville,
                  pays: suggestion.pays || prev.pays || "France",
                }));
              }}
              placeholder="Mairie de…"
            />
          </div>

          <div>
            <label className="libelle-champ">N° SIRET</label>
            <input type="text" className="champ-saisie w-full" value={form.siret}
              onChange={e => maj("siret", e.target.value)} placeholder="00000000000000" maxLength={14} />
          </div>

          <div>
            <label className="libelle-champ">Adresse</label>
            <ChampAdresseRecherche
              id="organisation-adresse"
              className="champ-saisie w-full"
              value={form.adresse}
              onChange={(valeur) => maj("adresse", valeur)}
              onSelection={(suggestion: SuggestionAdressePublique) => {
                setForm((prev) => ({
                  ...prev,
                  adresse: suggestion.adresse || suggestion.label,
                  code_postal: suggestion.code_postal || prev.code_postal,
                  ville: suggestion.ville || prev.ville,
                  pays: "France",
                }));
              }}
              placeholder="1 place de la Mairie"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="libelle-champ">Code postal</label>
              <input type="text" className="champ-saisie w-full" value={form.code_postal}
                onChange={e => maj("code_postal", e.target.value)} placeholder="00000" />
            </div>
            <div className="col-span-2">
              <label className="libelle-champ">Ville</label>
              <input type="text" className="champ-saisie w-full" value={form.ville}
                onChange={e => maj("ville", e.target.value)} placeholder="Bordeaux" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="libelle-champ">Téléphone</label>
              <input type="tel" className="champ-saisie w-full" value={form.telephone}
                onChange={e => maj("telephone", e.target.value)} placeholder="05 00 00 00 00" />
            </div>
            <div>
              <label className="libelle-champ">Courriel</label>
              <input type="email" className="champ-saisie w-full" value={form.courriel}
                onChange={e => maj("courriel", e.target.value)} placeholder="contact@mairie.fr" />
            </div>
          </div>

          <div>
            <label className="libelle-champ">Site web</label>
            <input type="text" className="champ-saisie w-full" value={form.site_web}
              onChange={e => maj("site_web", e.target.value)} placeholder="https://www.mairie.fr" />
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 rounded text-primaire-600"
              checked={form.est_active} onChange={e => maj("est_active", e.target.checked)} />
            <span className="text-sm font-medium text-slate-700">Organisation active</span>
          </label>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
          <button onClick={onClose} className="btn-secondaire">Annuler</button>
          <button onClick={soumettre} disabled={chargement} className="btn-primaire disabled:opacity-60">
            {chargement ? "Enregistrement…" : <><Save className="w-4 h-4" />Enregistrer</>}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PageOrganisations() {
  const [items, setItems] = useState<Organisation[]>([]);
  const [chargement, setChargement] = useState(true);
  const [recherche, setRecherche] = useState("");
  const [filtreType, setFiltreType] = useState("");
  const [succes, setSucces] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [modal, setModal] = useState(false);
  const [edition, setEdition] = useState<Organisation | null>(null);
  const [suppressionEnCoursId, setSuppressionEnCoursId] = useState<string | null>(null);

  const charger = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (recherche) params.set("search", recherche);
      if (filtreType) params.set("type", filtreType);
      setItems(extraireListeResultats(await api.get(`/api/organisations/?${params}`)));
    } catch { setErreur("Impossible de charger les organisations."); }
    finally { setChargement(false); }
  }, [filtreType, recherche]);
  useEffect(() => { charger(); }, [charger]);
  const flash = (msg: string) => { setSucces(msg); setTimeout(() => setSucces(null), 3000); };

  const sauvegarder = async (d: Partial<Organisation>) => {
    if (edition) { await api.patch(`/api/organisations/${edition.id}/`, d); flash("Organisation modifiée."); }
    else { await api.post("/api/organisations/", d); flash("Organisation créée."); }
    await charger();
  };

  const basculerActivation = async (organisation: Organisation) => {
    try {
      await api.patch(`/api/organisations/${organisation.id}/`, { est_active: !organisation.est_active });
      flash(organisation.est_active ? "Organisation désactivée." : "Organisation réactivée.");
      await charger();
    } catch {
      setErreur("Impossible de modifier le statut de l'organisation.");
    }
  };

  const supprimer = async (organisation: Organisation) => {
    const confirmation = window.confirm(
      `Supprimer l'organisation "${organisation.nom}" ?`
    );
    if (!confirmation) return;

    setErreur(null);
    setSuppressionEnCoursId(organisation.id);
    try {
      await api.supprimer(`/api/organisations/${organisation.id}/`);
      flash("Organisation supprimée.");
      await charger();
    } catch (e) {
      setErreur(
        e instanceof ErreurApi
          ? e.detail
          : "Impossible de supprimer l'organisation."
      );
    } finally {
      setSuppressionEnCoursId(null);
    }
  };

  const ouvrir = (item?: Organisation) => { setEdition(item ?? null); setModal(true); };

  return (
    <div className="space-y-6">
      <EntetePageAdmin
        titre="Organisations"
        description="Répertoire des maîtres d’ouvrage, partenaires et structures enregistrées."
        actions={<button onClick={() => ouvrir()} className="btn-primaire"><Plus className="w-4 h-4" />Nouvelle organisation</button>}
        statistiques={[
          { libelle: "Total", valeur: `${items.length} organisation${items.length > 1 ? "s" : ""}` },
          { libelle: "Actives", valeur: `${items.filter((item) => item.est_active).length}` },
          { libelle: "Inactives", valeur: `${items.filter((item) => !item.est_active).length}` },
          { libelle: "Types", valeur: `${new Set(items.map((item) => item.type_organisation)).size}` },
        ]}
      />

      {succes && <AlerteAdmin type="succes">{succes}</AlerteAdmin>}
      {erreur && <AlerteAdmin type="erreur" action={<button onClick={() => setErreur(null)} className="ml-auto"><X className="w-4 h-4" /></button>}>{erreur}</AlerteAdmin>}

      <CarteSectionAdmin titre="Recherche et filtres" description="Affinez la liste par mot-clé ou type d’organisation.">
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="search" className="champ-saisie pl-9 w-full"
            placeholder="Rechercher par nom, code, ville…"
            value={recherche} onChange={e => setRecherche(e.target.value)} />
        </div>
        <select className="champ-saisie w-auto bg-white" value={filtreType} onChange={e => setFiltreType(e.target.value)}>
          <option value="">Tous les types</option>
          {Object.entries(TYPES).map(([val, lib]) => <option key={val} value={val}>{lib}</option>)}
        </select>
      </div>
      </CarteSectionAdmin>

      <CarteSectionAdmin titre="Liste des organisations">
      <div className="-m-5 divide-y divide-slate-100">
        {chargement ? <div className="py-10 text-center text-slate-400 text-sm">Chargement…</div>
          : items.length === 0 ? <div className="py-10 text-center text-slate-400 text-sm">Aucune organisation trouvée.</div>
          : items.map(org => (
          <div key={org.id} className="flex items-center gap-4 py-3 px-4 hover:bg-slate-50">
            <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5 text-orange-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => ouvrir(org)}
                  className="truncate font-medium text-slate-800 transition-colors hover:text-primaire-600"
                >
                  {org.nom}
                </button>
                <span className="badge-neutre text-xs shrink-0">{TYPES[org.type_organisation] ?? org.type_organisation}</span>
                {!org.est_active && <span className="badge-danger text-xs shrink-0">Inactive</span>}
              </div>
              <div className="flex items-center gap-4 mt-0.5">
                {org.ville && <span className="flex items-center gap-1 text-xs text-slate-400"><MapPin className="w-3 h-3" />{org.code_postal} {org.ville}</span>}
                {org.telephone && <span className="flex items-center gap-1 text-xs text-slate-400"><Phone className="w-3 h-3" />{org.telephone}</span>}
                {org.courriel && <span className="flex items-center gap-1 text-xs text-slate-400"><Mail className="w-3 h-3" />{org.courriel}</span>}
                <span className="text-xs text-slate-400">{org.nombre_membres} membre{org.nombre_membres > 1 ? "s" : ""}</span>
              </div>
            </div>
            <ActionsRapidesAdaptatives
              actions={[
                {
                  titre: "Modifier",
                  icone: Pencil,
                  variante: "primaire",
                  onClick: () => ouvrir(org),
                },
                {
                  titre: org.est_active ? "Désactiver" : "Réactiver",
                  icone: org.est_active ? EyeOff : Eye,
                  onClick: () => basculerActivation(org),
                  disabled: suppressionEnCoursId === org.id,
                },
                {
                  titre: "Supprimer",
                  icone: Trash2,
                  variante: "danger",
                  onClick: () => supprimer(org),
                  disabled: suppressionEnCoursId === org.id,
                },
              ]}
            />
          </div>
        ))}
      </div>
      </CarteSectionAdmin>

      {modal && <Modal initial={edition} onSave={sauvegarder} onClose={() => { setModal(false); setEdition(null); }} />}
    </div>
  );
}
