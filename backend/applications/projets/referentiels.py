"""Référentiels statiques et helpers de contexte projet pour le frontend actuel."""

from __future__ import annotations

from copy import deepcopy
from typing import Any


def _option(code: str, libelle: str, description: str = "", **extras: Any) -> dict[str, Any]:
    return {
        "id": code,
        "code": code,
        "libelle": libelle,
        "description": description,
        **extras,
    }


FAMILLES_CLIENT = [
    _option("maitrise_ouvrage", "Maîtrise d'ouvrage", "Client final ou donneur d'ordre principal."),
    _option("maitrise_oeuvre", "Maîtrise d'œuvre", "Architecte, mandataire ou équipe de conception."),
    _option("entreprise", "Entreprise", "Entreprise générale, lot séparé, groupement ou sous-traitance."),
    _option("autre", "Autre contexte", "Partenaire, AMO, structure associative ou contexte spécifique."),
]

SOUS_TYPES_CLIENT_PAR_FAMILLE = {
    "maitrise_ouvrage": [
        _option("collectivite", "Collectivité / établissement public"),
        _option("promoteur_prive", "Promoteur / investisseur privé"),
        _option("bailleur_social", "Bailleur social"),
        _option("syndicat_copropriete", "Syndicat / copropriété"),
    ],
    "maitrise_oeuvre": [
        _option("architecte", "Architecte mandataire"),
        _option("equipe_pluridisciplinaire", "Équipe pluridisciplinaire"),
        _option("opc", "OPC / AMO technique"),
        _option("economiste_associe", "Économiste associé"),
    ],
    "entreprise": [
        _option("entreprise_generale", "Entreprise générale"),
        _option("lot_separe", "Lot séparé"),
        _option("groupement", "Groupement / co-traitance"),
        _option("sous_traitance", "Sous-traitance"),
    ],
    "autre": [
        _option("partenaire", "Partenaire"),
        _option("association", "Association / organisme"),
        _option("amo", "AMO / conseil"),
        _option("autre", "Autre"),
    ],
}

CONTEXTES_CONTRACTUELS_PAR_FAMILLE = {
    "maitrise_ouvrage": [
        _option("marche_public", "Marché public"),
        _option("marche_prive", "Marché privé"),
        _option("accord_cadre", "Accord-cadre / marché subséquent"),
        _option("consultation_directe", "Consultation directe"),
    ],
    "maitrise_oeuvre": [
        _option("conception", "Mission de conception"),
        _option("dce_consultation", "DCE / consultation"),
        _option("analyse_offres", "Analyse des offres"),
        _option("suivi_execution", "Suivi d'exécution"),
    ],
    "entreprise": [
        _option("appel_offres", "Réponse à appel d'offres"),
        _option("consultation_directe", "Consultation / devis direct"),
        _option("cotraitance", "Co-traitance"),
        _option("sous_traitance", "Sous-traitance"),
    ],
    "autre": [
        _option("partenariat", "Partenariat"),
        _option("amo", "Assistance / conseil"),
        _option("convention", "Convention / mission ponctuelle"),
        _option("autre", "Autre"),
    ],
}

MISSIONS_MAITRISE_OEUVRE_BATIMENT = [
    _option("esq", "ESQ", "Esquisse"),
    _option("aps", "APS", "Avant-projet sommaire"),
    _option("apd", "APD", "Avant-projet définitif"),
    _option("pro", "PRO / DCE", "Projet et consultation"),
    _option("act", "ACT", "Analyse des offres"),
    _option("exe", "EXE", "Études d'exécution"),
    _option("visa", "VISA", "Visa d'exécution"),
    _option("det", "DET", "Direction de l'exécution"),
    _option("opc", "OPC", "Ordonnancement et pilotage"),
    _option("aor", "AOR", "Assistance à la réception"),
    _option("estimation_par_lot", "Estimation par lot", "Prestations économiques complémentaires."),
    _option("redaction_cctp", "Rédaction CCTP"),
    _option("redaction_bpu", "Rédaction BPU"),
    _option("redaction_dpgf", "Rédaction DPGF"),
    _option("redaction_ccap", "Rédaction CCAP"),
    _option("redaction_rc", "Rédaction RC"),
    _option("rapport_analyse_offres", "Rapport d'analyse des offres"),
    _option("planning_previsionnel_travaux", "Planning prévisionnel des travaux"),
    _option("mission_economique_transversale", "Mission économique transversale"),
]

MISSIONS_MAITRISE_OEUVRE_INFRA = [
    _option("diagnostic_infrastructure", "Diagnostic infrastructure"),
    _option("etudes_preliminaires_infrastructure", "Études préliminaires infrastructure"),
    _option("avp_infrastructure", "AVP infrastructure"),
    _option("pro_infrastructure", "PRO infrastructure"),
    _option("act_infrastructure", "ACT infrastructure"),
    _option("visa_infrastructure", "VISA infrastructure"),
    _option("det_infrastructure", "DET infrastructure"),
    _option("opc_infrastructure", "OPC infrastructure"),
    _option("aor_infrastructure", "AOR infrastructure"),
    _option("estimation_infrastructure", "Estimation infrastructure"),
    _option("redaction_pieces_marche_infrastructure", "Rédaction des pièces de marché infrastructure"),
    _option("analyse_offres_infrastructure", "Analyse des offres infrastructure"),
    _option("planning_travaux_infrastructure", "Planning travaux infrastructure"),
]

MISSIONS_ENTREPRISE = [
    _option("reponse_appel_offres", "Réponse à appel d'offres"),
    _option("chiffrage_direct", "Chiffrage direct"),
    _option("devis", "Devis / offre directe"),
    _option("planning_execution", "Planning d'exécution"),
    _option("suivi_rentabilite", "Suivi de rentabilité"),
    _option("memoire_technique", "Mémoire technique"),
    _option("bpu_dpgf_dqe_entreprise", "BPU / DPGF / DQE entreprise"),
    _option("calcul_debourses_secs", "Calcul des déboursés secs"),
    _option("coefficient_k", "Coefficient K"),
]

MISSIONS_MAITRISE_OUVRAGE = [
    _option("verifier_enveloppe", "Vérification d'enveloppe"),
    _option("note_budget", "Note budgétaire"),
    _option("estimation_previsionnelle", "Estimation prévisionnelle"),
    _option("analyse_programme", "Analyse du programme"),
]

MISSIONS_AUTRES = [
    _option("mission_generale", "Mission générale"),
    _option("audit", "Audit / expertise"),
    _option("assistance", "Assistance ponctuelle"),
]

PHASES_BATIMENT = [
    _option("esq", "ESQ"),
    _option("aps", "APS"),
    _option("apd", "APD"),
    _option("pro", "PRO / DCE"),
    _option("act", "ACT"),
    _option("exe", "EXE"),
    _option("visa", "VISA"),
    _option("det", "DET"),
    _option("opc", "OPC"),
    _option("aor", "AOR"),
]

PHASES_INFRA = [
    _option("diagnostic_infrastructure", "Diagnostic"),
    _option("etudes_preliminaires_infrastructure", "Études préliminaires"),
    _option("avp_infrastructure", "AVP"),
    _option("pro_infrastructure", "PRO"),
    _option("act_infrastructure", "ACT"),
    _option("visa_infrastructure", "VISA"),
    _option("det_infrastructure", "DET"),
    _option("opc_infrastructure", "OPC"),
    _option("aor_infrastructure", "AOR"),
]

SOUS_MISSIONS = [
    _option("metres_detail", "Métrés détaillés", types_livrables=["tableaux_quantitatifs"]),
    _option("synthese_budgetaire", "Synthèse budgétaire", types_livrables=["note_estimation"]),
    _option("analyse_variante", "Analyse des variantes", types_livrables=["rapport_analyse"]),
    _option("planning_detaille", "Planning détaillé", types_livrables=["planning"]),
    _option("tableau_comparatif_offres", "Tableau comparatif des offres", types_livrables=["rapport_analyse"]),
    _option("bordereaux_finalises", "Bordereaux finalisés", types_livrables=["bpu", "dpgf", "dqe"]),
]

REFERENCES_INDICES_PRIX = [
    {
        "code": "BT01",
        "libelle": "Index général bâtiment BT01",
        "type_index": "BT",
        "territoire": "France entière",
        "periodicite": "mensuelle",
        "base_reference": "2010",
        "derniere_valeur": None,
    },
    {
        "code": "BT45",
        "libelle": "Couverture, plomberie et chauffage",
        "type_index": "BT",
        "territoire": "France entière",
        "periodicite": "mensuelle",
        "base_reference": "2010",
        "derniere_valeur": None,
    },
    {
        "code": "BT50",
        "libelle": "Electricité",
        "type_index": "BT",
        "territoire": "France entière",
        "periodicite": "mensuelle",
        "base_reference": "2010",
        "derniere_valeur": None,
    },
    {
        "code": "TP01",
        "libelle": "Index général travaux publics TP01",
        "type_index": "TP",
        "territoire": "France entière",
        "periodicite": "mensuelle",
        "base_reference": "2010",
        "derniere_valeur": None,
    },
    {
        "code": "TP02",
        "libelle": "Travaux de terrassement",
        "type_index": "TP",
        "territoire": "France entière",
        "periodicite": "mensuelle",
        "base_reference": "2010",
        "derniere_valeur": None,
    },
    {
        "code": "TP09",
        "libelle": "Voirie et réseaux divers",
        "type_index": "TP",
        "territoire": "France entière",
        "periodicite": "mensuelle",
        "base_reference": "2010",
        "derniere_valeur": None,
    },
]


def lister_references_indices_prix(limite: int | None = None) -> list[dict[str, Any]]:
    references = deepcopy(REFERENCES_INDICES_PRIX)
    if limite is not None and limite > 0:
        return references[:limite]
    return references


def reference_indice_par_code(code: str | None) -> dict[str, Any] | None:
    code_normalise = (code or "").strip().upper()
    for reference in REFERENCES_INDICES_PRIX:
        if reference["code"] == code_normalise:
            return deepcopy(reference)
    return None


def _missions_pour_famille(famille_client: str, nature_ouvrage: str) -> list[dict[str, Any]]:
    if famille_client == "maitrise_ouvrage":
        return deepcopy(MISSIONS_MAITRISE_OUVRAGE)
    if famille_client == "maitrise_oeuvre":
        missions = deepcopy(MISSIONS_MAITRISE_OEUVRE_BATIMENT)
        if nature_ouvrage in {"infrastructure", "mixte"}:
            missions.extend(deepcopy(MISSIONS_MAITRISE_OEUVRE_INFRA))
        return missions
    if famille_client == "entreprise":
        return deepcopy(MISSIONS_ENTREPRISE)
    return deepcopy(MISSIONS_AUTRES)


def _phases_pour_famille(famille_client: str, nature_ouvrage: str) -> list[dict[str, Any]]:
    if famille_client != "maitrise_oeuvre":
        return []
    phases = deepcopy(PHASES_BATIMENT)
    if nature_ouvrage in {"infrastructure", "mixte"}:
        phases.extend(deepcopy(PHASES_INFRA))
    return phases


def _champs_dynamiques(famille_client: str) -> list[dict[str, Any]]:
    groupe_cadrage = []
    groupe_economie = []

    if famille_client == "entreprise":
        groupe_cadrage.extend(
            [
                {
                    "id": "reference_consultation",
                    "code": "reference_consultation",
                    "libelle": "Référence consultation",
                    "type_champ": "texte",
                    "groupe": "cadrage",
                    "section": "Cadrage commercial",
                    "placeholder": "RC-2026-015",
                    "aide_courte": "Référence dossier ou consultation.",
                    "obligatoire": False,
                    "multiple": False,
                    "options": [],
                    "source_reglementaire": "",
                },
                {
                    "id": "delai_reponse",
                    "code": "delai_reponse",
                    "libelle": "Délai de réponse",
                    "type_champ": "texte",
                    "groupe": "cadrage",
                    "section": "Cadrage commercial",
                    "placeholder": "JJ/MM/AAAA ou nombre de jours",
                    "aide_courte": "Date limite ou délai de remise.",
                    "obligatoire": False,
                    "multiple": False,
                    "options": [],
                    "source_reglementaire": "",
                },
            ]
        )
        groupe_economie.extend(
            [
                {
                    "id": "budget_cible",
                    "code": "budget_cible",
                    "libelle": "Budget cible / montant offre",
                    "type_champ": "montant",
                    "groupe": "economie",
                    "section": "Données économiques",
                    "placeholder": "Montant HT estimé",
                    "aide_courte": "Budget ou montant cible connu.",
                    "obligatoire": False,
                    "multiple": False,
                    "options": [],
                    "source_reglementaire": "",
                },
                {
                    "id": "variante_autorisee",
                    "code": "variante_autorisee",
                    "libelle": "Variante autorisée",
                    "type_champ": "booleen",
                    "groupe": "economie",
                    "section": "Données économiques",
                    "placeholder": "",
                    "aide_courte": "Le règlement autorise-t-il les variantes ?",
                    "obligatoire": False,
                    "multiple": False,
                    "options": [],
                    "source_reglementaire": "",
                },
            ]
        )
    else:
        groupe_cadrage.extend(
            [
                {
                    "id": "reference_consultation",
                    "code": "reference_consultation",
                    "libelle": "Référence opération",
                    "type_champ": "texte",
                    "groupe": "cadrage",
                    "section": "Cadrage opération",
                    "placeholder": "Référence interne ou consultation",
                    "aide_courte": "Identifiant dossier ou consultation.",
                    "obligatoire": False,
                    "multiple": False,
                    "options": [],
                    "source_reglementaire": "",
                },
                {
                    "id": "commune_operation",
                    "code": "commune_operation",
                    "libelle": "Commune de l'opération",
                    "type_champ": "texte",
                    "groupe": "cadrage",
                    "section": "Cadrage opération",
                    "placeholder": "Mamoudzou",
                    "aide_courte": "Localisation principale du projet.",
                    "obligatoire": False,
                    "multiple": False,
                    "options": [],
                    "source_reglementaire": "",
                },
            ]
        )
        groupe_economie.extend(
            [
                {
                    "id": "surface_plancher",
                    "code": "surface_plancher",
                    "libelle": "Surface / métrique de base",
                    "type_champ": "nombre",
                    "groupe": "economie",
                    "section": "Données techniques",
                    "placeholder": "m², ml, m³…",
                    "aide_courte": "Surface ou grandeur principale utile à l'estimation.",
                    "obligatoire": False,
                    "multiple": False,
                    "options": [],
                    "source_reglementaire": "",
                },
                {
                    "id": "budget_travaux",
                    "code": "budget_travaux",
                    "libelle": "Budget travaux",
                    "type_champ": "montant",
                    "groupe": "economie",
                    "section": "Données techniques",
                    "placeholder": "Montant HT",
                    "aide_courte": "Enveloppe connue ou estimée.",
                    "obligatoire": False,
                    "multiple": False,
                    "options": [],
                    "source_reglementaire": "",
                },
            ]
        )

    groupes = []
    if groupe_cadrage:
        groupes.append({"groupe": "cadrage", "champs": groupe_cadrage})
    if groupe_economie:
        groupes.append({"groupe": "economie", "champs": groupe_economie})
    return groupes


def referentiels_projet(famille_client: str = "", nature_ouvrage: str = "batiment") -> dict[str, list[dict[str, Any]]]:
    famille = famille_client if famille_client in SOUS_TYPES_CLIENT_PAR_FAMILLE else "autre"
    return {
        "familles_client": deepcopy(FAMILLES_CLIENT),
        "sous_types_client": deepcopy(SOUS_TYPES_CLIENT_PAR_FAMILLE.get(famille, SOUS_TYPES_CLIENT_PAR_FAMILLE["autre"])),
        "contextes_contractuels": deepcopy(CONTEXTES_CONTRACTUELS_PAR_FAMILLE.get(famille, CONTEXTES_CONTRACTUELS_PAR_FAMILLE["autre"])),
        "missions_principales": _missions_pour_famille(famille, nature_ouvrage),
        "sous_missions": deepcopy(SOUS_MISSIONS),
        "phases_intervention": _phases_pour_famille(famille, nature_ouvrage),
    }


def _aplatir_dossiers(dossiers: list[dict[str, Any]], parent_code: str | None = None) -> list[dict[str, Any]]:
    resultat: list[dict[str, Any]] = []
    for dossier in dossiers:
        resultat.append(
            {
                "code": dossier["code"],
                "intitule": dossier["intitule"],
                "description": dossier.get("description", ""),
                "parent_code": parent_code,
            }
        )
        enfants = dossier.get("enfants") or []
        resultat.extend(_aplatir_dossiers(enfants, dossier["code"]))
    return resultat


def construire_parcours_projet(
    *,
    famille_client: str = "",
    sous_type_client: str = "",
    contexte_contractuel: str = "",
    missions_principales: list[str] | None = None,
    phase_intervention: str = "",
    nature_ouvrage: str = "batiment",
    nature_marche: str = "public",
) -> dict[str, Any]:
    referentiels = referentiels_projet(famille_client=famille_client, nature_ouvrage=nature_ouvrage)

    from .services import construire_dossiers_documentaires

    clientele_service = clientele_depuis_famille(famille_client)
    objectif_service = objectif_depuis_contexte(
        famille_client=famille_client,
        mission_principale=phase_intervention or (missions_principales or [""])[0],
        contexte_contractuel=contexte_contractuel,
    )
    dossiers_ged = _aplatir_dossiers(
        construire_dossiers_documentaires(
            clientele_cible=clientele_service,
            objectif_mission=objectif_service,
        )
    )

    return {
        "etapes": [
            {"code": "qualification", "titre": "Qualification", "ordre": 1},
            {"code": "sources", "titre": "Sources", "ordre": 2},
            {"code": "donnees", "titre": "Données", "ordre": 3},
            {"code": "livrables", "titre": "Livrables", "ordre": 4},
            {"code": "synthese", "titre": "Synthèse", "ordre": 5},
        ],
        "selection": {
            "nature_marche": nature_marche,
            "nature_ouvrage": nature_ouvrage,
            "missions_principales": missions_principales or [],
            "famille_client": famille_client,
            "sous_type_client": sous_type_client,
            "contexte_contractuel": contexte_contractuel,
            "phase_intervention": phase_intervention,
        },
        "referentiels": referentiels,
        "champs_dynamiques": _champs_dynamiques(famille_client or "autre"),
        "dossiers_ged": dossiers_ged,
    }


def clientele_depuis_famille(famille_client: str | None) -> str:
    return {
        "maitrise_ouvrage": "moa_publique",
        "maitrise_oeuvre": "moe_conception",
        "entreprise": "entreprise_travaux",
        "autre": "autre",
    }.get((famille_client or "").strip(), "autre")


def objectif_depuis_contexte(
    *,
    famille_client: str | None,
    mission_principale: str | None,
    contexte_contractuel: str | None = None,
) -> str:
    mission = (mission_principale or "").strip()
    famille = (famille_client or "").strip()
    contexte = (contexte_contractuel or "").strip()

    if famille == "entreprise":
        if mission == "planning_execution":
            return "suivi_execution"
        if mission in {"devis", "chiffrage_direct"}:
            return "devis_entreprise"
        return "reponse_ao_entreprise"
    if famille == "maitrise_oeuvre":
        if mission in {"act", "pro", "redaction_cctp", "redaction_bpu", "redaction_dpgf", "redaction_ccap", "redaction_rc", "pro_infrastructure"}:
            return "redaction_dce_cctp"
        if mission in {"exe", "visa", "det", "opc", "aor", "det_infrastructure", "opc_infrastructure", "aor_infrastructure"} or contexte == "suivi_execution":
            return "suivi_execution"
        return "estimation_moe"
    if famille == "maitrise_ouvrage":
        return "verifier_enveloppe"
    return "autre"


def phase_depuis_contexte(phase_intervention: str | None, mission_principale: str | None) -> str:
    return (phase_intervention or mission_principale or "").strip()


def normaliser_contexte_persistant(contexte: dict[str, Any] | None) -> dict[str, Any]:
    source = contexte or {}
    missions_associees = source.get("missions_associees") or source.get("missions_principales") or []
    return {
        "famille_client": source.get("famille_client") or "",
        "sous_type_client": source.get("sous_type_client") or "",
        "contexte_contractuel": source.get("contexte_contractuel") or "",
        "mission_principale": source.get("mission_principale") or "",
        "missions_associees": [valeur for valeur in missions_associees if valeur],
        "phase_intervention": source.get("phase_intervention") or "",
        "nature_ouvrage": source.get("nature_ouvrage") or "batiment",
        "nature_marche": source.get("nature_marche") or "public",
        "partie_contractante": source.get("partie_contractante") or "",
        "role_lbh": source.get("role_lbh") or "",
        "methode_estimation": source.get("methode_estimation") or "",
        "donnees_entree": source.get("donnees_entree") or {},
        "trace_preremplissage": source.get("trace_preremplissage") or {},
        "sous_missions": [valeur for valeur in (source.get("sous_missions") or []) if valeur],
    }


def normaliser_mode_variation_persistant(mode: dict[str, Any] | None) -> dict[str, Any]:
    source = mode or {}
    return {
        "type_evolution": source.get("type_evolution") or "aucune",
        "cadre_juridique": source.get("cadre_juridique") or "public",
        "indice_reference": (source.get("indice_reference") or "").strip().upper(),
        "formule_personnalisee": source.get("formule_personnalisee") or "",
        "date_prix_initial": source.get("date_prix_initial") or "",
        "date_remise_offre": source.get("date_remise_offre") or "",
        "date_demarrage": source.get("date_demarrage") or "",
        "periodicite_revision": source.get("periodicite_revision") or "",
        "clause_applicable": source.get("clause_applicable") or "",
        "part_fixe": source.get("part_fixe") or "",
    }


def _trouver_option(options: list[dict[str, Any]], code: str) -> dict[str, Any] | None:
    for option in options:
        if option["id"] == code or option["code"] == code:
            return deepcopy(option)
    return None


def _mission_depuis_bdd(code: str) -> dict[str, Any] | None:
    """Résout un code de mission depuis la base de données (MissionClient)."""
    if not code:
        return None
    try:
        from applications.projets.models import MissionClient
        m = MissionClient.objects.filter(code=code).values("code", "libelle", "description").first()
        if m:
            return _option(m["code"], m["libelle"], m.get("description", ""))
    except Exception:
        pass
    return None


def _resoudre_mission(referentiel_statique: list[dict[str, Any]], code: str) -> dict[str, Any]:
    """Cherche d'abord dans le référentiel statique, puis en BDD, puis retourne le code brut."""
    return (
        _trouver_option(referentiel_statique, code)
        or _mission_depuis_bdd(code)
        or _option(code, code)
    )


def contexte_projet_pour_projet(projet) -> dict[str, Any] | None:
    qualification = getattr(projet, "qualification_wizard", {}) or {}
    contexte = qualification.get("contexte_projet") or {}
    if not contexte and qualification:
        contexte = qualification
    contexte_normalise = normaliser_contexte_persistant(contexte)
    if not any(
        [
            contexte_normalise["famille_client"],
            contexte_normalise["sous_type_client"],
            contexte_normalise["contexte_contractuel"],
            contexte_normalise["mission_principale"],
            contexte_normalise["phase_intervention"],
            contexte_normalise["donnees_entree"],
            contexte_normalise["sous_missions"],
        ]
    ):
        return None

    referentiels = referentiels_projet(
        famille_client=contexte_normalise["famille_client"],
        nature_ouvrage=contexte_normalise["nature_ouvrage"],
    )

    missions_statiques = referentiels["missions_principales"]

    return {
        "famille_client": _trouver_option(referentiels["familles_client"], contexte_normalise["famille_client"]) or _option(contexte_normalise["famille_client"], contexte_normalise["famille_client"] or "—"),
        "sous_type_client": _trouver_option(referentiels["sous_types_client"], contexte_normalise["sous_type_client"]) or _option(contexte_normalise["sous_type_client"], contexte_normalise["sous_type_client"] or "—"),
        "contexte_contractuel": _trouver_option(referentiels["contextes_contractuels"], contexte_normalise["contexte_contractuel"]) or _option(contexte_normalise["contexte_contractuel"], contexte_normalise["contexte_contractuel"] or "—"),
        "mission_principale": _resoudre_mission(missions_statiques, contexte_normalise["mission_principale"]) if contexte_normalise["mission_principale"] else _option("", "—"),
        "missions_associees": [
            _resoudre_mission(missions_statiques, code)
            for code in contexte_normalise["missions_associees"]
        ],
        "phase_intervention": _trouver_option(referentiels["phases_intervention"], contexte_normalise["phase_intervention"]) if contexte_normalise["phase_intervention"] else None,
        "nature_ouvrage": contexte_normalise["nature_ouvrage"],
        "nature_marche": contexte_normalise["nature_marche"],
        "partie_contractante": contexte_normalise["partie_contractante"],
        "role_lbh": contexte_normalise["role_lbh"],
        "methode_estimation": contexte_normalise["methode_estimation"],
        "donnees_entree": contexte_normalise["donnees_entree"],
        "sous_missions": [
            _trouver_option(referentiels["sous_missions"], code) or _mission_depuis_bdd(code) or _option(code, code)
            for code in contexte_normalise["sous_missions"]
        ],
    }


def mode_variation_pour_projet(projet) -> dict[str, Any] | None:
    qualification = getattr(projet, "qualification_wizard", {}) or {}
    mode = qualification.get("mode_variation_prix") or {}
    normalise = normaliser_mode_variation_persistant(mode)
    if normalise["type_evolution"] == "aucune" and not any(
        [
            normalise["indice_reference"],
            normalise["formule_personnalisee"],
            normalise["date_prix_initial"],
            normalise["date_remise_offre"],
            normalise["date_demarrage"],
            normalise["periodicite_revision"],
            normalise["clause_applicable"],
            normalise["part_fixe"],
        ]
    ):
        return None
    normalise["reference_officielle"] = reference_indice_par_code(normalise["indice_reference"])
    return normalise
