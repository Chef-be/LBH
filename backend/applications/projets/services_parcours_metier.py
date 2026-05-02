"""Construction de la fiche métier projet par type de client."""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Any

from .models import LivrableProjet, LivrableType, MissionClient
from .referentiels import contexte_projet_pour_projet
from .services_coherence_projet import (
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
    mission = _code_option(contexte.get("mission_principale")) or projet.objectif_mission
    phase = _code_option(contexte.get("phase_intervention")) or normaliser_phase_projet(projet.phase_actuelle)
    missions_associees = [_code_option(m) for m in contexte.get("missions_associees", [])]
    sous_missions = [_code_option(m) for m in contexte.get("sous_missions", [])]
    return {
        "source": contexte,
        "famille_client": famille,
        "sous_type_client": sous_type,
        "contexte_contractuel": contexte_contractuel,
        "mission_principale": mission,
        "missions_associees": [m for m in missions_associees if m],
        "sous_missions": [m for m in sous_missions if m],
        "phase_intervention": phase,
        "nature_ouvrage": _code_option(contexte.get("nature_ouvrage")) or "batiment",
        "nature_marche": _code_option(contexte.get("nature_marche") or contexte.get("cadre_juridique")),
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
        "contexte_contractuel": ctx["contexte_contractuel"],
        "phase_intervention": ctx["phase_intervention"],
        "mission_principale": ctx["mission_principale"],
        "missions_principales": ctx["missions_associees"],
        "nature_ouvrage": ctx["nature_ouvrage"],
        "nature_marche": ctx["nature_marche"],
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
        "contexte_contractuel": ctx["contexte_contractuel"],
        "phase_intervention": ctx["phase_intervention"],
        "mission_principale": ctx["mission_principale"],
        "missions_principales": [ctx["mission_principale"], *ctx["missions_associees"]],
        "role_lbh": ctx["role_lbh"],
    })
    for alerte in [*controle["bloquant"], *controle["alertes"]]:
        alertes.append({"niveau": "bloquant" if alerte in controle["bloquant"] else "attention", "code": alerte["code"], "message": alerte["message"]})
    return alertes, actions


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
    return {
        "profil_fiche": profil,
        "en_tete": {
            "reference": projet.reference,
            "intitule": projet.intitule,
            "client": projet.maitre_ouvrage.nom if projet.maitre_ouvrage_id else "",
            "role_lbh": ctx["role_lbh"],
            "type_client": _libelle_option(ctx["source"].get("famille_client"), ctx["famille_client"]),
            "mission": _libelle_option(ctx["source"].get("mission_principale"), ctx["mission_principale"]),
            "phase": libelle_phase_projet(ctx["phase_intervention"]) or ctx["phase_intervention"],
            "statut_metier": projet.get_statut_display(),
        },
        "contexte_metier": {
            "famille_client": libeller_code(ctx["famille_client"]),
            "sous_type_client": libeller_code(ctx["sous_type_client"]),
            "contexte_contractuel": libeller_code(ctx["contexte_contractuel"]),
            "mode_commande": libeller_code(ctx["contexte_contractuel"]),
            "mission_principale": libeller_code(ctx["mission_principale"]),
            "missions_associees": [libeller_code(code) for code in ctx["missions_associees"]],
            "phase_intervention": libeller_code(ctx["phase_intervention"]),
            "nature_ouvrage": libeller_code(ctx["nature_ouvrage"]),
            "nature_marche": libeller_code(ctx["nature_marche"]),
            "cadre_juridique": libeller_code(ctx["nature_marche"]),
            "partie_contractante": ctx["partie_contractante"],
            "role_lbh": libeller_code(ctx["role_lbh"]),
        },
        "parcours_metier": {
            "profil": profil,
            "etapes": [module["libelle"] for module in modules],
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
