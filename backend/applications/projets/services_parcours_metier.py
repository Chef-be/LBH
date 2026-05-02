"""Construction de la fiche métier projet par type de client."""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Any

from .models import LivrableProjet, LivrableType, MissionClient
from .referentiels import contexte_projet_pour_projet
from .services_coherence_projet import (
    calculer_score_coherence_projet,
    construire_livrables_attendus,
    construire_modules_actifs as construire_modules_actifs_coherence,
    libeller_code,
    valider_combinaison_projet,
)
from .services import libelle_phase_projet, normaliser_phase_projet


@dataclass(frozen=True)
class ModuleActifProjet:
    code: str
    libelle: str
    actif: bool
    raison_activation: str
    niveau_pertinence: str
    dependances: list[str]
    livrables_associes: list[str]
    actions_recommandees: list[str]
    ordre: int

    def as_dict(self) -> dict[str, Any]:
        return {
            "code": self.code,
            "libelle": self.libelle,
            "actif": self.actif,
            "raison_activation": self.raison_activation,
            "niveau_pertinence": self.niveau_pertinence,
            "dependances": self.dependances,
            "livrables_associes": self.livrables_associes,
            "actions_recommandees": self.actions_recommandees,
            "ordre": self.ordre,
        }


def _code_option(option: Any) -> str:
    if isinstance(option, dict):
        return str(option.get("code") or option.get("id") or "")
    return str(option or "")


def _libelle_option(option: Any, defaut: str = "") -> str:
    if isinstance(option, dict):
        return str(option.get("libelle") or option.get("code") or option.get("id") or defaut)
    return str(option or defaut)


def _contexte_normalise(projet) -> dict[str, Any]:
    contexte = contexte_projet_pour_projet(projet) or {}
    famille = _code_option(contexte.get("famille_client")) or _famille_depuis_clientele(projet.clientele_cible)
    sous_type = _code_option(contexte.get("sous_type_client"))
    contexte_contractuel = _code_option(contexte.get("contexte_contractuel"))
    mode_commande = _code_option(contexte.get("mode_commande")) or contexte_contractuel
    cadre_juridique = _code_option(contexte.get("cadre_juridique") or contexte.get("nature_marche"))
    mission = _code_option(contexte.get("mission_principale")) or projet.objectif_mission
    phase = _code_option(contexte.get("phase_intervention")) or normaliser_phase_projet(projet.phase_actuelle)
    missions_associees = [_code_option(m) for m in contexte.get("missions_associees", [])]
    sous_missions = [_code_option(m) for m in contexte.get("sous_missions", [])]
    return {
        "source": contexte,
        "famille_client": famille,
        "sous_type_client": sous_type,
        "contexte_contractuel": mode_commande,
        "mode_commande": mode_commande,
        "mission_principale": mission,
        "missions_associees": [m for m in missions_associees if m],
        "sous_missions": [m for m in sous_missions if m],
        "phase_intervention": phase,
        "nature_ouvrage": _code_option(contexte.get("nature_ouvrage")) or "batiment",
        "nature_marche": cadre_juridique,
        "cadre_juridique": cadre_juridique,
        "partie_contractante": str(contexte.get("partie_contractante") or ""),
        "role_lbh": _code_option(contexte.get("role_lbh")),
    }


def _famille_depuis_clientele(clientele: str) -> str:
    table = {
        "moa_publique": "maitrise_ouvrage",
        "moe_conception": "maitrise_oeuvre",
        "entreprise_travaux": "entreprise",
        "cotraitrance": "entreprise",
        "sous_traitance": "entreprise",
    }
    return table.get(clientele or "", "autre")


def _profil_fiche(ctx: dict[str, Any]) -> str:
    famille = ctx["famille_client"]
    sous_type = ctx["sous_type_client"]
    contexte = ctx["contexte_contractuel"]
    if contexte == "cotraitance" or sous_type == "groupement":
        return "cotraitance"
    if contexte == "sous_traitance" or sous_type == "sous_traitance":
        return "sous_traitance"
    if famille == "maitrise_ouvrage":
        return "moa_enveloppe"
    if famille == "maitrise_oeuvre":
        return "moe_dce"
    if famille == "entreprise":
        return "entreprise_ao" if contexte == "appel_offres" else "entreprise_devis"
    if contexte == "amo" or sous_type == "amo":
        return "amo"
    return "generique"


def _module(code: str, libelle: str, actif: bool, niveau: str, raison: str, ordre: int, actions=None, livrables=None, dependances=None) -> ModuleActifProjet:
    return ModuleActifProjet(
        code=code,
        libelle=libelle,
        actif=actif,
        raison_activation=raison,
        niveau_pertinence=niveau if actif else "masque",
        dependances=dependances or [],
        livrables_associes=livrables or [],
        actions_recommandees=actions or [],
        ordre=ordre,
    )


def construire_modules_actifs(ctx: dict[str, Any]) -> list[dict[str, Any]]:
    modules = construire_modules_actifs_coherence({
        "famille_client": ctx["famille_client"],
        "sous_type_client": ctx["sous_type_client"],
        "contexte_contractuel": ctx["mode_commande"],
        "mode_commande": ctx["mode_commande"],
        "phase_intervention": ctx["phase_intervention"],
        "mission_principale": ctx["mission_principale"],
        "missions_principales": ctx["missions_associees"],
        "nature_ouvrage": ctx["nature_ouvrage"],
        "nature_marche": ctx["cadre_juridique"],
        "cadre_juridique": ctx["cadre_juridique"],
        "role_lbh": ctx["role_lbh"],
    })
    if modules:
        return modules
    profil = _profil_fiche(ctx)
    phase = ctx["phase_intervention"]
    nature = ctx["nature_ouvrage"]
    mission_codes = {ctx["mission_principale"], *ctx["missions_associees"], *ctx["sous_missions"], phase}

    moe_dce = profil == "moe_dce" and phase in {"pro", "dce", "apd"}
    moe_act = profil == "moe_dce" and phase in {"act", "ao"}
    execution = phase in {"exe", "det", "visa", "opc", "aor", "reception"} or "suivi_execution" in mission_codes
    entreprise = profil in {"entreprise_ao", "entreprise_devis"}
    moa = profil == "moa_enveloppe"

    modules = [
        _module("documents", "Documents", True, "obligatoire", "Les pièces sources et livrables du dossier doivent être classés.", 10, ["Importer les pièces sources"]),
        _module("ressources", "Ressources", entreprise or moa, "recommande", "Analyse de DCE, DPGF, BPU ou références économiques.", 20, ["Analyser DPGF/BPU"], ["analyse_sources"]),
        _module("metres", "Métrés", moe_dce or entreprise or "metres_detail" in mission_codes, "obligatoire" if moe_dce else "recommande", "Quantités nécessaires à la production économique du dossier.", 30, ["Créer un avant-métré"], ["tableaux_quantitatifs"]),
        _module("pieces-ecrites", "Pièces écrites", moe_dce or entreprise or profil in {"sous_traitance", "amo"}, "obligatoire" if moe_dce else "recommande", "Des documents rédactionnels ou pièces marché sont attendus.", 40, ["Rédiger les pièces attendues"], ["cctp", "memoire_technique", "rapport"]),
        _module("economie", "Économie", True, "obligatoire", "Une synthèse économique dossier doit être suivie sans doublon de facturation.", 50, ["Ouvrir le module Économie"], ["estimation", "dpgf"]),
        _module("appels-offres", "Appels d'offres", moe_act or profil == "entreprise_ao", "obligatoire", "Analyse ou réponse à consultation identifiée.", 60, ["Préparer l'analyse des offres"], ["rapport_analyse"]),
        _module("planning", "Planning", execution or entreprise or "planning_execution" in mission_codes, "recommande", "Un planning est utile pour la remise, l'exécution ou la coordination.", 70, ["Produire un planning"]),
        _module("execution", "Exécution", execution, "recommande", "Phase d'exécution ou réception détectée.", 80, ["Suivre les situations et réserves"]),
        _module("voirie", "Voirie", nature in {"infrastructure", "mixte"}, "optionnel", "Nature d'ouvrage infrastructure ou mixte.", 90),
        _module("batiment", "Bâtiment", nature in {"batiment", "mixte", ""}, "optionnel", "Nature d'ouvrage bâtiment ou mixte.", 100),
    ]
    if moa:
        modules = [
            m if m.code not in {"metres", "pieces-ecrites", "planning"} else _module(
                m.code, m.libelle, m.code == "pieces-ecrites", "optionnel",
                "Activé seulement si une note ou un rapport est attendu.", m.ordre, m.actions_recommandees,
            )
            for m in modules
        ]
    return [m.as_dict() for m in modules if m.actif]


def _pieces_sources(ctx: dict[str, Any]) -> list[dict[str, Any]]:
    profil = _profil_fiche(ctx)
    if profil == "moa_enveloppe":
        codes = [("programme", "Programme"), ("surfaces", "Tableau de surfaces"), ("enveloppe", "Enveloppe financière"), ("plans", "Plans existants")]
    elif profil == "moe_dce":
        codes = [("plans", "Plans"), ("programme", "Programme"), ("diagnostics", "Diagnostics"), ("contraintes", "Contraintes"), ("cctp_existant", "CCTP existant")]
    elif profil in {"entreprise_ao", "entreprise_devis"}:
        codes = [("rc", "RC"), ("ae", "AE"), ("ccap", "CCAP"), ("cctp", "CCTP"), ("bpu", "BPU"), ("dpgf", "DPGF"), ("dqe", "DQE"), ("plans", "Plans"), ("additifs", "Additifs")]
    elif profil == "cotraitance":
        codes = [("convention_groupement", "Convention de groupement"), ("perimetre_lbh", "Périmètre LBH"), ("livrables_partenaires", "Livrables partenaires")]
    elif profil == "sous_traitance":
        codes = [("demande_donneur_ordre", "Demande du donneur d'ordre"), ("fichiers_sources", "Fichiers sources"), ("format_attendu", "Format attendu"), ("echeance", "Échéance")]
    else:
        codes = [("demande_client", "Demande client"), ("documents_sources", "Documents sources"), ("hypotheses", "Hypothèses")]
    return [{"code": code, "libelle": libelle, "obligatoire": True} for code, libelle in codes]


def _documents_disponibles(projet) -> list[dict[str, Any]]:
    try:
        from applications.documents.models import Document
        documents = Document.objects.filter(projet=projet, est_version_courante=True).select_related("type_document")[:100]
    except Exception:
        return []
    return [
        {
            "id": str(doc.id),
            "reference": doc.reference,
            "intitule": doc.intitule,
            "type_document": getattr(doc.type_document, "code", ""),
        }
        for doc in documents
    ]


def _livrables_attendus(ctx: dict[str, Any]) -> list[dict[str, Any]]:
    livrables = construire_livrables_attendus({
        "famille_client": ctx["famille_client"],
        "sous_type_client": ctx["sous_type_client"],
        "contexte_contractuel": ctx["contexte_contractuel"],
        "phase_intervention": ctx["phase_intervention"],
        "mission_principale": ctx["mission_principale"],
        "missions_principales": ctx["missions_associees"],
    })
    if livrables:
        return [
            {**livrable, "module_source": livrable.get("module_source", "documents"), "document_lie": None, "ordre": index}
            for index, livrable in enumerate(livrables, start=1)
        ]
    profil = _profil_fiche(ctx)
    if profil == "moa_enveloppe":
        items = [("note_budgetaire", "Note budgétaire", "pieces-ecrites"), ("estimation_previsionnelle", "Estimation prévisionnelle", "economie"), ("comparaison_scenarios", "Comparaison de scénarios", "economie")]
    elif profil == "moe_dce":
        phase = ctx["phase_intervention"]
        if phase in {"act", "ao"}:
            items = [("tableau_comparatif", "Tableau comparatif des offres", "appels-offres"), ("rapport_analyse", "Rapport d'analyse des offres", "appels-offres")]
        elif phase in {"aps", "avp", "apd"}:
            items = [("note_economique", "Note économique", "economie"), ("estimation_lots", "Estimation par lots", "economie")]
        else:
            items = [("metre", "Avant-métré", "metres"), ("cctp", "CCTP", "pieces-ecrites"), ("dpgf", "DPGF quantitative", "economie"), ("dce", "Dossier de consultation", "documents")]
    elif profil in {"entreprise_ao", "entreprise_devis"}:
        items = [("analyse_dce", "Analyse DCE", "ressources"), ("etude_prix", "Étude de prix", "economie"), ("memoire_technique", "Mémoire technique", "pieces-ecrites"), ("offre_finale", "Offre finale", "documents")]
    elif profil == "cotraitance":
        items = [("perimetre_lbh", "Périmètre LBH", "documents"), ("livrables_lbh", "Livrables LBH", "documents"), ("validation_croisee", "Validation croisée", "documents")]
    elif profil == "sous_traitance":
        items = [("production_attendue", "Production attendue", "documents"), ("controle_interne", "Contrôle interne", "documents"), ("transmission", "Transmission donneur d'ordre", "documents")]
    else:
        items = [("rapport", "Rapport", "pieces-ecrites"), ("recommandations", "Recommandations", "documents")]
    return [
        {"code": code, "libelle": libelle, "module_source": module, "statut": "attendu", "document_lie": None, "ordre": index}
        for index, (code, libelle, module) in enumerate(items, start=1)
    ]


def _documents_a_produire(ctx: dict[str, Any], livrables: list[dict[str, Any]]) -> list[dict[str, Any]]:
    familles = [ctx["famille_client"]]
    modeles = []
    try:
        qs = LivrableType.objects.filter(est_active=True).order_by("ordre", "libelle")[:200]
        types_livrables = {l["code"] for l in livrables}
        modeles = [
            {
                "code": lv.code,
                "libelle": lv.libelle,
                "module_concerne": next((l["module_source"] for l in livrables if l["code"] == lv.code), "documents"),
                "livrable_associe": lv.code if lv.code in types_livrables else "",
                "statut": "à produire",
                "modele_disponible": True,
                "familles_client": familles,
            }
            for lv in qs
            if lv.code in types_livrables or lv.type_document in {l["code"] for l in livrables}
        ]
    except Exception:
        modeles = []
    if modeles:
        return modeles[:8]
    return [
        {
            "code": livrable["code"],
            "libelle": livrable["libelle"],
            "module_concerne": livrable["module_source"],
            "livrable_associe": livrable["code"],
            "statut": "à produire",
            "modele_disponible": False,
            "familles_client": familles,
        }
        for livrable in livrables
    ]


def _synthese_economique(projet) -> dict[str, Any]:
    etat = "non_chiffre"
    try:
        from applications.economie.models import EtudeEconomique
        etudes = EtudeEconomique.objects.filter(projet=projet)
        if etudes.filter(statut="validee").exists():
            etat = "etude_economique_validee"
        elif etudes.exists():
            etat = "etude_economique_en_cours"
    except Exception:
        pass
    if projet.montant_estime and etat == "non_chiffre":
        etat = "estimation_validee"
    return {
        "montant_operation_estime": projet.montant_estime,
        "montant_marche": projet.montant_marche,
        "honoraires_prevus": projet.honoraires_prevus,
        "etat_economique": etat,
        "libelle_etat": {
            "non_chiffre": "Non chiffré",
            "estimation_validee": "Estimation validée",
            "etude_economique_en_cours": "Étude économique en cours",
            "etude_economique_validee": "Étude économique validée",
        }.get(etat, etat),
        "lien_module": "economie",
    }


def _alertes_et_actions(projet, ctx: dict[str, Any], pieces_attendues: list[dict[str, Any]], pieces_detectees: list[dict[str, Any]], livrables: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    alertes = []
    actions = []
    if not pieces_detectees:
        alertes.append({"niveau": "attention", "code": "pieces_sources_absentes", "message": "Aucune pièce source n'est encore classée sur ce dossier."})
        actions.append({"code": "importer_sources", "libelle": "Importer les pièces sources", "module": "documents"})
    if not projet.montant_estime and ctx["famille_client"] == "maitrise_ouvrage":
        alertes.append({"niveau": "attention", "code": "enveloppe_absente", "message": "L'enveloppe financière ou l'estimation d'opération n'est pas renseignée."})
        actions.append({"code": "completer_enveloppe", "libelle": "Compléter l'enveloppe financière", "module": "economie"})
    if livrables and not LivrableProjet.objects.filter(projet=projet).exists():
        actions.append({"code": "generer_livrables", "libelle": "Générer les livrables attendus", "module": "projet"})
    controle = valider_combinaison_projet({
        "famille_client": ctx["famille_client"],
        "sous_type_client": ctx["sous_type_client"],
        "contexte_contractuel": ctx["mode_commande"],
        "mode_commande": ctx["mode_commande"],
        "phase_intervention": ctx["phase_intervention"],
        "mission_principale": ctx["mission_principale"],
        "missions_principales": [ctx["mission_principale"], *ctx["missions_associees"]],
        "role_lbh": ctx["role_lbh"],
    })
    for alerte in [*controle["bloquant"], *controle["alertes"]]:
        alertes.append({"niveau": "bloquant" if alerte in controle["bloquant"] else "attention", "code": alerte["code"], "message": alerte["message"]})
    return alertes, actions


def _module_est_pret(module: dict[str, Any], livrables: list[dict[str, Any]]) -> bool:
    codes_livrables = set(module.get("livrables_associes") or [])
    if not codes_livrables:
        return False
    return any(l.get("code") in codes_livrables and l.get("statut") in {"produit", "soumis", "valide"} for l in livrables)


def _kpi_fiche(pieces_attendues, pieces_detectees, livrables, modules, alertes) -> dict[str, int]:
    livrables_produits = [l for l in livrables if l.get("statut") in {"produit", "soumis", "valide"}]
    livrables_valides = [l for l in livrables if l.get("statut") == "valide"]
    modules_obligatoires = [m for m in modules if m.get("niveau_pertinence") == "obligatoire"]
    modules_prets = [m for m in modules_obligatoires if _module_est_pret(m, livrables)]
    bloquantes = [a for a in alertes if a.get("niveau") == "bloquant"]
    attention = [a for a in alertes if a.get("niveau") != "bloquant"]
    total_pieces = len(pieces_attendues)
    pieces_ok = min(len(pieces_detectees), total_pieces) if total_pieces else 0
    total_livrables = len(livrables)
    total_modules = len(modules_obligatoires)
    progression = 0
    poids = 0
    if total_pieces:
        progression += int((pieces_ok / total_pieces) * 30)
        poids += 30
    if total_livrables:
        progression += int((len(livrables_produits) / total_livrables) * 35)
        poids += 35
    if total_modules:
        progression += int((len(modules_prets) / total_modules) * 25)
        poids += 25
    progression += max(0, 10 - len(bloquantes) * 10 - len(attention) * 3)
    poids += 10
    return {
        "pieces_sources_total": total_pieces,
        "pieces_sources_disponibles": pieces_ok,
        "pieces_sources_manquantes": max(0, total_pieces - pieces_ok),
        "livrables_total": total_livrables,
        "livrables_produits": len(livrables_produits),
        "livrables_valides": len(livrables_valides),
        "modules_obligatoires": total_modules,
        "modules_prets": len(modules_prets),
        "alertes_bloquantes": len(bloquantes),
        "alertes_attention": len(attention),
        "progression_globale_pct": max(0, min(100, int((progression / poids) * 100) if poids else 0)),
    }


def _visualisations(kpi: dict[str, int], modules: list[dict[str, Any]], livrables: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    return {
        "progression_dossier": [{"code": "global", "libelle": "Progression globale", "valeur": kpi["progression_globale_pct"]}],
        "etat_modules": [
            {"code": m["code"], "libelle": m["libelle"], "niveau": m.get("niveau_pertinence"), "statut": m.get("statut", "non_demarre")}
            for m in modules
        ],
        "etat_livrables": [
            {"code": "produits", "libelle": "Produits", "valeur": kpi["livrables_produits"]},
            {"code": "attendus", "libelle": "Attendus", "valeur": kpi["livrables_total"]},
        ],
        "etat_pieces_sources": [
            {"code": "disponibles", "libelle": "Disponibles", "valeur": kpi["pieces_sources_disponibles"]},
            {"code": "attendues", "libelle": "Attendues", "valeur": kpi["pieces_sources_total"]},
        ],
        "alertes_par_niveau": [
            {"code": "bloquant", "libelle": "Bloquantes", "valeur": kpi["alertes_bloquantes"]},
            {"code": "attention", "libelle": "À surveiller", "valeur": kpi["alertes_attention"]},
        ],
    }


def _parcours_interactif(kpi: dict[str, int], modules: list[dict[str, Any]], livrables: list[dict[str, Any]]) -> dict[str, Any]:
    def etape(code, libelle, progression, action, alerte=""):
        statut = "pret" if progression >= 100 else "a_completer" if progression < 50 else "en_cours"
        return {"code": code, "libelle": libelle, "statut": statut, "progression_pct": progression, "action_principale": action, "alerte": alerte}

    pieces_pct = int((kpi["pieces_sources_disponibles"] / kpi["pieces_sources_total"]) * 100) if kpi["pieces_sources_total"] else 0
    livrables_pct = int((kpi["livrables_produits"] / kpi["livrables_total"]) * 100) if kpi["livrables_total"] else 0
    modules_pct = int((kpi["modules_prets"] / kpi["modules_obligatoires"]) * 100) if kpi["modules_obligatoires"] else 0
    return {
        "etapes": [
            etape("qualification", "Qualification", 100 if kpi["alertes_bloquantes"] == 0 else 45, "Contrôler la cohérence métier", "Incohérence à corriger" if kpi["alertes_bloquantes"] else ""),
            etape("sources", "Pièces sources", pieces_pct, "Importer les pièces sources"),
            etape("analyse", "Analyse", modules_pct, "Ouvrir les modules obligatoires"),
            etape("production", "Production", modules_pct, "Produire les documents métier"),
            etape("controle", "Contrôle", 100 if kpi["alertes_bloquantes"] == 0 and kpi["alertes_attention"] == 0 else 40, "Lever les alertes métier"),
            etape("livrables", "Livrables", livrables_pct, "Gérer les livrables"),
            etape("cloture", "Clôture", 100 if livrables_pct == 100 and kpi["alertes_bloquantes"] == 0 else 10, "Vérifier la clôture métier"),
        ]
    }


def _statut_global(kpi: dict[str, int], score: int) -> tuple[str, str]:
    if kpi["alertes_bloquantes"]:
        return "incoherent", "Incohérent"
    if score < 70 or kpi["alertes_attention"]:
        return "a_verifier", "À vérifier"
    if kpi["progression_globale_pct"] >= 90:
        return "pret", "Prêt"
    return "coherent", "Cohérent"


def construire_fiche_metier_projet(projet) -> dict[str, Any]:
    ctx = _contexte_normalise(projet)
    profil = _profil_fiche(ctx)
    modules = construire_modules_actifs(ctx)
    pieces_attendues = _pieces_sources(ctx)
    pieces_detectees = _documents_disponibles(projet)
    livrables_attendus = _livrables_attendus(ctx)
    livrables_structures = list(
        LivrableProjet.objects.filter(projet=projet)
        .select_related("document_lie", "livrable_type", "mission_client")
        .order_by("ordre", "libelle")
    )
    livrables = [
        {
            "id": str(l.id),
            "code": l.code,
            "libelle": l.libelle,
            "description": l.description,
            "statut": l.statut,
            "document_lie": str(l.document_lie_id) if l.document_lie_id else None,
            "document_lie_libelle": l.document_lie.intitule if l.document_lie_id else "",
            "module_source": l.module_source,
            "ordre": l.ordre,
        }
        for l in livrables_structures
    ] or livrables_attendus
    documents = _documents_a_produire(ctx, livrables_attendus)
    alertes, actions = _alertes_et_actions(projet, ctx, pieces_attendues, pieces_detectees, livrables_attendus)
    modules_codes = {m["code"] for m in modules}
    economie_detaillee = any(m["code"] == "economie" and "metres" in (m.get("dependances") or []) for m in modules)
    if economie_detaillee and "metres" not in modules_codes:
        alertes.append({
            "niveau": "bloquant",
            "code": "economie_detaillee_sans_metres",
            "message": "Une économie détaillée nécessite un quantitatif : le module Métrés doit être actif et relié à l'Économie.",
        })
    kpi = _kpi_fiche(pieces_attendues, pieces_detectees, livrables, modules, alertes)
    fiche_partielle = {"kpi": kpi, "alertes_metier": alertes}
    score = calculer_score_coherence_projet(projet, fiche_partielle)
    statut_global, badge_coherence = _statut_global(kpi, score)
    mission_resume = libeller_code(ctx["mission_principale"])["libelle"] if ctx["mission_principale"] else (projet.get_objectif_mission_display() if getattr(projet, "objectif_mission", "") else projet.intitule)
    if not mission_resume or mission_resume == "—":
        mission_resume = projet.intitule or projet.reference
    contexte_resume = [
        libeller_code(ctx["famille_client"])["libelle"],
        libeller_code(ctx["sous_type_client"])["libelle"],
        libeller_code(ctx["cadre_juridique"])["libelle"],
        libeller_code(ctx["mode_commande"])["libelle"],
        libeller_code(ctx["role_lbh"])["libelle"],
    ]
    contexte_compact = [
        {"code": "type_client", "valeur_code": ctx["famille_client"], "libelle": libeller_code(ctx["famille_client"])["libelle"]},
        {"code": "sous_type_client", "valeur_code": ctx["sous_type_client"], "libelle": libeller_code(ctx["sous_type_client"])["libelle"]},
        {"code": "cadre_juridique", "valeur_code": ctx["cadre_juridique"], "libelle": libeller_code(ctx["cadre_juridique"])["libelle"]},
        {"code": "mode_commande", "valeur_code": ctx["mode_commande"], "libelle": libeller_code(ctx["mode_commande"])["libelle"]},
        {"code": "role_lbh", "valeur_code": ctx["role_lbh"], "libelle": libeller_code(ctx["role_lbh"])["libelle"]},
    ]
    contexte_detaille = {
        "type_client": libeller_code(ctx["famille_client"]),
        "sous_type_client": libeller_code(ctx["sous_type_client"]),
        "cadre_juridique": libeller_code(ctx["cadre_juridique"]),
        "mode_commande": libeller_code(ctx["mode_commande"]),
        "role_lbh": libeller_code(ctx["role_lbh"]),
        "mission_principale": libeller_code(ctx["mission_principale"]),
        "phase_intervention": libeller_code(ctx["phase_intervention"]),
        "nature_ouvrage": libeller_code(ctx["nature_ouvrage"]),
        "donnees_entree": ctx["source"].get("donnees_entree", {}) if isinstance(ctx.get("source"), dict) else {},
    }
    suggestions_correction = valider_combinaison_projet({
        "famille_client": ctx["famille_client"],
        "phase_intervention": ctx["phase_intervention"],
        "mission_principale": ctx["mission_principale"],
        "missions_principales": [ctx["mission_principale"], *ctx["missions_associees"]],
        "role_lbh": ctx["role_lbh"],
    }).get("suggestions", [])

    return {
        "profil_fiche": profil,
        "resume": {
            "titre": mission_resume,
            "sous_titre": " · ".join([v for v in contexte_resume if v and v != "Non renseigné"]),
            "badge_coherence": badge_coherence,
            "score_coherence": score,
            "statut_global": statut_global,
        },
        "contexte_compact": contexte_compact,
        "contexte_detaille": contexte_detaille,
        "kpi": kpi,
        "visualisations": _visualisations(kpi, modules, livrables),
        "en_tete": {
            "reference": projet.reference,
            "intitule": projet.intitule,
            "client": projet.maitre_ouvrage.nom if projet.maitre_ouvrage_id else "",
            "role_lbh": libeller_code(ctx["role_lbh"])["libelle"],
            "type_client": _libelle_option(ctx["source"].get("famille_client"), ctx["famille_client"]),
            "mission": _libelle_option(ctx["source"].get("mission_principale"), ctx["mission_principale"]),
            "phase": libelle_phase_projet(ctx["phase_intervention"]) or ctx["phase_intervention"],
            "statut_metier": projet.get_statut_display(),
        },
        "contexte_metier": {
            "famille_client": libeller_code(ctx["famille_client"]),
            "sous_type_client": libeller_code(ctx["sous_type_client"]),
            "mode_commande": libeller_code(ctx["mode_commande"]),
            "mission_principale": libeller_code(ctx["mission_principale"]),
            "missions_associees": [libeller_code(code) for code in ctx["missions_associees"]],
            "phase_intervention": libeller_code(ctx["phase_intervention"]),
            "nature_ouvrage": libeller_code(ctx["nature_ouvrage"]),
            "cadre_juridique": libeller_code(ctx["cadre_juridique"]),
            "partie_contractante": ctx["partie_contractante"],
            "role_lbh": libeller_code(ctx["role_lbh"]),
        },
        "parcours_metier": {
            "profil": profil,
            **_parcours_interactif(kpi, modules, livrables),
        },
        "blocs_fiche": [
            "en_tete", "contexte_metier", "parcours_metier", "pieces_sources",
            "livrables", "documents_a_produire", "synthese_economique", "alertes_metier", "modules_actifs",
        ],
        "modules_actifs": modules,
        "pieces_sources": {
            "attendues": pieces_attendues,
            "detectees": pieces_detectees,
            "manquantes": pieces_attendues if not pieces_detectees else [],
        },
        "livrables": {
            "attendus": livrables,
            "produits": [l for l in livrables if l.get("statut") in {"produit", "soumis", "valide"}],
            "manquants": [l for l in livrables if l.get("statut") == "attendu"],
        },
        "documents_a_produire": documents,
        "synthese_economique": _synthese_economique(projet),
        "alertes_metier": alertes,
        "actions_recommandees": actions,
        "suggestions_correction": suggestions_correction,
        "chaines_production": [
            {"code": "sources_production_validation", "libelle": "Pièces sources → production métier → contrôle → livrable validé"}
        ],
    }


def generer_livrables_depuis_parcours(projet, utilisateur=None) -> list[LivrableProjet]:
    fiche = construire_fiche_metier_projet(projet)
    crees: list[LivrableProjet] = []
    for item in fiche["livrables"]["attendus"]:
        livrable_type = LivrableType.objects.filter(code=item["code"]).first()
        livrable, cree = LivrableProjet.objects.get_or_create(
            projet=projet,
            code=item["code"],
            defaults={
                "livrable_type": livrable_type,
                "libelle": item["libelle"],
                "description": item.get("description", ""),
                "module_source": item.get("module_source", ""),
                "responsable": utilisateur,
                "ordre": item.get("ordre") or 0,
            },
        )
        if cree:
            crees.append(livrable)
    return crees
