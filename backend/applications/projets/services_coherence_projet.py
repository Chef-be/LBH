"""Moteur de cohérence du wizard et des fiches métier projet."""

from __future__ import annotations

from copy import deepcopy
from typing import Any


def option(code: str, libelle: str, description: str = "", **extras: Any) -> dict[str, Any]:
    return {"id": code, "code": code, "libelle": libelle, "description": description, **extras}


TYPES_CLIENT = [
    option("maitrise_ouvrage", "Maîtrise d'ouvrage", "Client final ou donneur d'ordre."),
    option("maitrise_oeuvre", "Maîtrise d'œuvre", "Architecte, mandataire ou équipe de conception."),
    option("entreprise", "Entreprise", "Entreprise générale, lot séparé ou groupement."),
    option("cotraitance", "Co-traitance", "LBH intervient dans un groupement."),
    option("sous_traitance", "Sous-traitance", "LBH produit pour un donneur d'ordre."),
    option("amo", "AMO / conseil", "Assistance, revue, audit ou aide à la décision."),
    option("autre", "Autre", "Contexte spécifique."),
]

SOUS_TYPES = {
    "maitrise_ouvrage": [
        option("collectivite", "Collectivité"),
        option("promoteur", "Promoteur"),
        option("bailleur", "Bailleur"),
        option("copropriete", "Copropriété"),
    ],
    "maitrise_oeuvre": [
        option("architecte_mandataire", "Architecte mandataire"),
        option("equipe_moe", "Équipe MOE"),
        option("economiste_associe", "Économiste associé"),
        option("opc_amo_technique", "OPC / AMO technique"),
    ],
    "entreprise": [
        option("entreprise_generale", "Entreprise générale"),
        option("lot_separe", "Lot séparé"),
        option("groupement", "Groupement"),
        option("sous_traitant", "Sous-traitant"),
    ],
    "cotraitance": [option("mandataire", "Mandataire"), option("cotraitant", "Cotraitant")],
    "sous_traitance": [option("donneur_ordre", "Donneur d'ordre"), option("prestataire", "Prestataire")],
    "amo": [option("amo", "AMO"), option("conseil", "Conseil"), option("audit", "Audit")],
    "autre": [option("autre", "Autre")],
}

CADRES_JURIDIQUES = [
    option("public", "Marché public"),
    option("prive", "Marché privé"),
    option("mixte", "Mixte"),
    option("hors_marche", "Hors marché / conseil / assistance ponctuelle"),
]

MODES_COMMANDE = {
    "maitrise_ouvrage": [
        option("consultation_directe", "Consultation directe"),
        option("appel_offres", "Appel d'offres"),
        option("accord_cadre", "Accord-cadre"),
        option("marche_subsequent", "Marché subséquent"),
        option("mission_amo", "Mission AMO"),
        option("audit", "Audit / expertise"),
    ],
    "maitrise_oeuvre": [
        option("mission_conception", "Mission de conception"),
        option("mission_execution", "Mission d'exécution"),
        option("appel_offres", "Appel d'offres"),
        option("accord_cadre", "Accord-cadre"),
    ],
    "entreprise": [
        option("consultation_directe", "Consultation directe"),
        option("appel_offres", "Appel d'offres"),
        option("accord_cadre", "Accord-cadre"),
        option("marche_subsequent", "Marché subséquent"),
    ],
    "cotraitance": [option("cotraitance", "Co-traitance"), option("convention", "Convention")],
    "sous_traitance": [option("sous_traitance", "Sous-traitance"), option("consultation_directe", "Consultation directe")],
    "amo": [option("mission_amo", "AMO / conseil"), option("audit", "Audit / expertise")],
    "autre": [option("convention", "Convention"), option("audit", "Audit / expertise")],
}

ROLES_LBH = {
    "maitrise_ouvrage": [
        option("amo_conseil", "AMO / conseil"),
        option("verificateur_economique", "Vérificateur économique"),
        option("observateur_conseil", "Observateur / conseil"),
    ],
    "maitrise_oeuvre": [
        option("economiste_conception", "Économiste de conception"),
        option("verificateur_economique", "Vérificateur économique"),
        option("cotraitant", "Cotraitant"),
    ],
    "entreprise": [
        option("economiste_entreprise", "Économiste d'entreprise"),
        option("appui_ponctuel", "Appui ponctuel"),
    ],
    "cotraitance": [option("cotraitant", "Cotraitant")],
    "sous_traitance": [
        option("sous_traitant_metres", "Sous-traitant métrés"),
        option("sous_traitant_cctp", "Sous-traitant CCTP"),
        option("sous_traitant_etude_prix", "Sous-traitant étude de prix"),
    ],
    "amo": [option("amo_conseil", "AMO / conseil"), option("observateur_conseil", "Observateur / conseil")],
    "autre": [option("appui_ponctuel", "Appui ponctuel")],
}

PHASES_MOE = [
    option("esq", "ESQ"), option("aps", "APS"), option("apd", "APD"),
    option("pro", "PRO / DCE"), option("dce", "DCE"), option("act", "ACT"),
    option("visa", "VISA"), option("det", "DET"), option("opc", "OPC"), option("aor", "AOR"),
]
PHASES_AMO = [
    option("programmation", "Programmation"), option("faisabilite", "Faisabilité"),
    option("revue_aps", "Revue APS"), option("revue_apd", "Revue APD"),
    option("revue_pro", "Revue PRO"), option("revue_act", "Revue ACT"),
    option("suivi_execution", "Suivi exécution"),
]
PHASES_ENTREPRISE = [
    option("consultation", "Consultation"), option("mise_au_point_offre", "Mise au point offre"),
    option("preparation", "Préparation"), option("execution", "Exécution"), option("cloture", "Clôture"),
]

MISSIONS = {
    "maitrise_ouvrage": [
        option("analyse_programme", "Analyse programme"),
        option("verifier_enveloppe", "Vérification d'enveloppe"),
        option("aide_decision", "Aide à décision"),
        option("rapport_recommandations", "Rapport de recommandations"),
    ],
    "maitrise_oeuvre": [
        option("economie_conception", "Économie de conception"),
        option("redaction_pieces_ecrites", "Rédaction pièces écrites"),
        option("estimation", "Estimation"),
        option("analyse_offres", "Analyse offres"),
        option("suivi_economique", "Suivi économique"),
        option("assistance_reception", "Assistance réception"),
    ],
    "entreprise": [
        option("reponse_appel_offres", "Réponse à appel d'offres"),
        option("chiffrage_direct", "Chiffrage direct"),
        option("devis_direct", "Devis direct"),
        option("etude_prix", "Étude de prix"),
        option("memoire_technique", "Mémoire technique"),
        option("planning_execution", "Planning d'exécution"),
    ],
    "cotraitance": [
        option("perimetre_lbh", "Définition du périmètre LBH"),
        option("production_livrables_lbh", "Production des livrables LBH"),
        option("coordination_interfaces", "Coordination des interfaces"),
    ],
    "sous_traitance": [
        option("metres", "Métrés"),
        option("cctp", "CCTP"),
        option("etude_prix", "Étude de prix"),
        option("production_livrable", "Production du livrable attendu"),
    ],
    "amo": [
        option("analyse_programme", "Analyse programme"),
        option("verifier_enveloppe", "Vérification d'enveloppe"),
        option("revue_estimation_pro", "AMO — revue de l'estimation PRO"),
        option("audit_economique", "Audit économique"),
        option("aide_decision", "Aide à décision"),
        option("rapport_recommandations", "Rapport de recommandations"),
    ],
    "autre": [option("mission_generale", "Mission générale"), option("audit", "Audit / expertise")],
}

METHODES_ESTIMATION_PAR_CONTEXTE = {
    "moa_faisabilite": ["ratio_m2", "ratio_fonctionnel", "retour_experience", "macro_lots", "comparaison_enveloppe_programme"],
    "moa_revue_pro": ["revue_estimation_moe", "controle_ratios", "analyse_ecarts", "comparaison_references"],
    "moe_aps_apd": ["estimation_lots", "ratios_ajustes", "quantites_sommaires", "retour_experience"],
    "moe_pro_dce": ["avant_metre", "dpgf_quantitative", "estimation_detaillee_lots", "bpu_dqe"],
    "entreprise": ["etude_prix", "sous_detail_prix", "debourse_sec", "coefficient_k", "analyse_bpu_dpgf", "bibliotheque_prix"],
    "sous_traitance": ["selon_mission_confiee"],
}

LIBELLES_METHODES = {
    "ratio_m2": "Ratio au m²", "ratio_fonctionnel": "Ratio fonctionnel",
    "retour_experience": "Retour d'expérience", "macro_lots": "Estimation macro-lots",
    "comparaison_enveloppe_programme": "Comparaison enveloppe / programme",
    "revue_estimation_moe": "Revue estimation MOE", "controle_ratios": "Contrôle ratios",
    "analyse_ecarts": "Analyse écarts", "comparaison_references": "Comparaison références",
    "estimation_lots": "Estimation par lots", "ratios_ajustes": "Ratios ajustés",
    "quantites_sommaires": "Quantités sommaires", "avant_metre": "Avant-métré",
    "dpgf_quantitative": "DPGF quantitative", "estimation_detaillee_lots": "Estimation détaillée par lots",
    "bpu_dqe": "BPU / DQE", "etude_prix": "Étude de prix", "sous_detail_prix": "Sous-détail de prix",
    "debourse_sec": "Déboursé sec", "coefficient_k": "Coefficient K",
    "analyse_bpu_dpgf": "Analyse BPU / DPGF", "bibliotheque_prix": "Bibliothèque de prix",
    "selon_mission_confiee": "Selon mission confiée",
}

LIBELLES_CODES = {
    **{o["code"]: o["libelle"] for o in TYPES_CLIENT + CADRES_JURIDIQUES + PHASES_MOE + PHASES_AMO + PHASES_ENTREPRISE},
    **{o["code"]: o["libelle"] for valeurs in SOUS_TYPES.values() for o in valeurs},
    **{o["code"]: o["libelle"] for valeurs in MODES_COMMANDE.values() for o in valeurs},
    **{o["code"]: o["libelle"] for valeurs in ROLES_LBH.values() for o in valeurs},
    **{o["code"]: o["libelle"] for valeurs in MISSIONS.values() for o in valeurs},
    "batiment": "Bâtiment", "infrastructure": "Infrastructure / VRD", "mixte": "Mixte",
}


def _type_client(payload: dict[str, Any]) -> str:
    famille = payload.get("type_client") or payload.get("famille_client") or "autre"
    sous_type = payload.get("sous_type_client") or ""
    mode = payload.get("mode_commande") or payload.get("contexte_contractuel") or ""
    if famille == "entreprise" and sous_type == "groupement":
        return "cotraitance"
    if famille == "entreprise" and sous_type in {"sous_traitance", "sous_traitant"}:
        return "sous_traitance"
    if mode == "cotraitance":
        return "cotraitance"
    if mode == "sous_traitance":
        return "sous_traitance"
    if mode in {"mission_amo", "audit"} and famille in {"autre", "maitrise_ouvrage"}:
        return "amo" if famille == "autre" else famille
    return famille if famille in {o["code"] for o in TYPES_CLIENT} else "autre"


def _phase(payload: dict[str, Any]) -> str:
    return payload.get("phase_intervention") or payload.get("phase") or ""


def _missions(payload: dict[str, Any]) -> list[str]:
    valeurs = payload.get("missions_principales") or payload.get("missions") or []
    if isinstance(valeurs, str):
        valeurs = [valeurs]
    mission = payload.get("mission_principale")
    if mission and mission not in valeurs:
        valeurs.insert(0, mission)
    return [v for v in valeurs if v]


def _contexte_methode(payload: dict[str, Any]) -> str:
    tc = _type_client(payload)
    phase = _phase(payload)
    missions = set(_missions(payload))
    if tc == "maitrise_ouvrage":
        if phase == "revue_pro" or "revue_estimation_pro" in missions:
            return "moa_revue_pro"
        return "moa_faisabilite"
    if tc == "maitrise_oeuvre":
        if phase in {"pro", "dce"}:
            return "moe_pro_dce"
        return "moe_aps_apd"
    if tc == "entreprise":
        return "entreprise"
    if tc == "sous_traitance":
        return "sous_traitance"
    return "moa_faisabilite"


def libeller_code(code: str) -> dict[str, str]:
    return {"code": code or "", "libelle": LIBELLES_CODES.get(code or "", code or "Non renseigné")}


def suggerer_missions(payload: dict[str, Any]) -> list[dict[str, Any]]:
    tc = _type_client(payload)
    phase = _phase(payload)
    missions = deepcopy(MISSIONS.get(tc, MISSIONS["autre"]))
    if tc == "maitrise_oeuvre" and phase == "act":
        return [m for m in missions if m["code"] in {"analyse_offres", "estimation"}]
    if tc == "maitrise_oeuvre" and phase in {"pro", "dce"}:
        return [m for m in missions if m["code"] in {"economie_conception", "redaction_pieces_ecrites", "estimation"}]
    if tc == "maitrise_ouvrage" and phase == "pro":
        return [option("revue_estimation_pro", "AMO — revue de l'estimation PRO"), option("audit_economique", "Audit économique")]
    return missions


def suggerer_methodes_estimation(payload: dict[str, Any]) -> list[dict[str, Any]]:
    return [option(code, LIBELLES_METHODES[code]) for code in METHODES_ESTIMATION_PAR_CONTEXTE[_contexte_methode(payload)]]


def _champ(code: str, libelle: str, type_champ: str = "texte", groupe: str = "donnees", obligatoire: bool = False, aide: str = "") -> dict[str, Any]:
    return {
        "id": code, "code": code, "libelle": libelle, "type_champ": type_champ,
        "groupe": groupe, "section": "Données métier", "placeholder": "",
        "aide_courte": aide, "obligatoire": obligatoire, "multiple": False,
        "options": [], "source_reglementaire": "",
    }


def suggerer_champs_donnees_techniques(payload: dict[str, Any]) -> list[dict[str, Any]]:
    tc = _type_client(payload)
    nature = payload.get("nature_ouvrage") or "batiment"
    if tc == "maitrise_ouvrage" and nature == "infrastructure":
        return [_champ("lineaire_voirie", "Linéaire de voirie", "nombre"), _champ("surface_chaussee", "Surface de chaussée", "nombre"), _champ("lineaire_reseaux", "Linéaire réseaux", "nombre"), _champ("nombre_ouvrages", "Nombre d'ouvrages", "nombre"), _champ("enveloppe_cible", "Enveloppe cible", "montant"), _champ("contraintes_principales", "Contraintes principales", "texte_long")]
    if tc == "maitrise_ouvrage":
        return [_champ("surface_utile", "Surface utile", "nombre"), _champ("surface_plancher", "Surface de plancher", "nombre"), _champ("nombre_logements_equipements", "Nombre de logements ou équipements", "nombre"), _champ("niveau_prestation", "Niveau de prestation"), _champ("enveloppe_cible", "Enveloppe cible", "montant"), _champ("ratio_reference", "Ratio de référence", "nombre")]
    if tc == "maitrise_oeuvre":
        return [_champ("nombre_lots", "Nombre de lots", "nombre"), _champ("niveau_detail_attendu", "Niveau de détail attendu"), _champ("plans_disponibles", "Plans disponibles", "booleen"), _champ("cctp_a_produire", "CCTP à produire", "booleen"), _champ("dpgf_a_produire", "DPGF à produire", "booleen"), _champ("bpu_dqe_a_produire", "BPU / DQE à produire", "booleen")]
    if tc == "entreprise":
        return [_champ("date_limite_remise", "Date limite de remise", "date"), _champ("type_dce_recu", "Type de DCE reçu"), _champ("lots_concernes", "Lots concernés", "texte_long"), _champ("coefficient_k_cible", "Coefficient K cible", "nombre"), _champ("frais_generaux", "Frais généraux", "nombre"), _champ("marge_cible", "Marge cible", "nombre"), _champ("variantes_autorisees", "Variantes autorisées", "booleen")]
    if tc == "sous_traitance":
        return [_champ("format_attendu", "Format attendu", obligatoire=True), _champ("delai", "Délai", "date", obligatoire=True), _champ("perimetre_confie", "Périmètre confié", "texte_long", obligatoire=True), _champ("niveau_detail", "Niveau de détail")]
    return [_champ("question_client", "Question client", "texte_long"), _champ("hypotheses", "Hypothèses", "texte_long")]


def construire_livrables_attendus(payload: dict[str, Any]) -> list[dict[str, Any]]:
    tc = _type_client(payload)
    phase = _phase(payload)
    if tc == "maitrise_oeuvre" and phase in {"pro", "dce"}:
        codes = [("cctp", "CCTP"), ("dpgf", "DPGF"), ("bpu_dqe", "BPU / DQE"), ("estimation", "Estimation")]
    elif tc == "maitrise_oeuvre" and phase == "act":
        codes = [("rapport_analyse_offres", "Rapport analyse offres"), ("tableau_comparatif", "Tableau comparatif")]
    elif tc == "entreprise":
        codes = [("analyse_dce", "Analyse DCE"), ("etude_prix", "Étude de prix"), ("memoire_technique", "Mémoire technique")]
    elif tc == "maitrise_ouvrage":
        codes = [("note_budgetaire", "Note budgétaire"), ("rapport_recommandations", "Rapport de recommandations")]
    elif tc == "cotraitance":
        codes = [("perimetre_lbh", "Périmètre LBH"), ("livrables_lbh", "Livrables LBH"), ("interfaces_partenaires", "Interfaces partenaires")]
    elif tc == "sous_traitance":
        codes = [("livrable_sortant", "Livrable sortant"), ("controle_interne", "Contrôle interne")]
    else:
        codes = [("rapport", "Rapport")]
    return [{"code": c, "libelle": l, "statut": "attendu"} for c, l in codes]


def construire_modules_actifs(payload: dict[str, Any]) -> list[dict[str, Any]]:
    tc = _type_client(payload)
    phase = _phase(payload)
    nature = payload.get("nature_ouvrage") or "batiment"

    def module(code, libelle, raison, niveau="recommande", actif=True, ordre=10):
        return {"code": code, "libelle": libelle, "actif": actif, "raison_activation": raison, "niveau_pertinence": niveau, "dependances": [], "livrables_associes": [], "actions_recommandees": [], "ordre": ordre}

    modules = [module("documents", "Documents", "Les pièces sources et livrables doivent être classés.", "obligatoire", ordre=10)]
    if tc == "maitrise_ouvrage":
        modules += [module("ressources", "Ressources économiques", "Comparaison avec ratios, références économiques et retours d'expérience.", ordre=20), module("economie", "Économie", "Suivi de l'enveloppe et des scénarios budgétaires.", "obligatoire", ordre=30)]
    elif tc == "maitrise_oeuvre":
        modules += [module("economie", "Économie", "Production de l'estimation et suivi économique par phase.", "obligatoire", ordre=20)]
        if phase in {"pro", "dce"}:
            modules += [module("metres", "Métrés", "Avant-métré nécessaire à la génération de la DPGF.", "obligatoire", ordre=30), module("pieces-ecrites", "Pièces écrites", "CCTP et pièces marché attendus en PRO / DCE.", "obligatoire", ordre=40)]
        if phase == "act":
            modules.append(module("appels-offres", "Appels d'offres", "Rapport d'analyse et tableau comparatif attendus en ACT.", "obligatoire", ordre=50))
    elif tc == "entreprise":
        modules += [module("ressources", "Ressources", "Analyse de DCE, BPU, DPGF et prix de marché.", "obligatoire", ordre=20), module("economie", "Économie", "Étude de prix, déboursés secs et coefficient K.", "obligatoire", ordre=30), module("pieces-ecrites", "Pièces écrites", "Mémoire technique et offre écrite.", ordre=40), module("planning", "Planning", "Planning de remise ou d'exécution selon le dossier.", ordre=50)]
        if payload.get("contexte_contractuel") == "appel_offres" or "reponse_appel_offres" in _missions(payload):
            modules.append(module("appels-offres", "Appels d'offres", "Réponse à consultation et suivi des pièces de remise.", "recommande", ordre=60))
    elif tc in {"cotraitance", "sous_traitance", "amo"}:
        modules += [module("economie", "Économie", "Contrôle économique limité au périmètre confié.", ordre=20), module("pieces-ecrites", "Pièces écrites", "Livrables rédactionnels liés à la mission.", ordre=30)]
    if nature in {"infrastructure", "mixte"}:
        modules.append(module("voirie", "Voirie", "Nature d'ouvrage infrastructure / VRD.", "optionnel", ordre=90))
    if nature in {"batiment", "mixte", ""}:
        modules.append(module("batiment", "Bâtiment", "Nature d'ouvrage bâtiment.", "optionnel", ordre=100))
    return modules


def valider_combinaison_projet(payload: dict[str, Any]) -> dict[str, Any]:
    tc = _type_client(payload)
    phase = _phase(payload)
    missions = set(_missions(payload))
    bloquant: list[dict[str, str]] = []
    alertes: list[dict[str, str]] = []
    suggestions: list[dict[str, str]] = []
    if tc == "maitrise_ouvrage" and phase in {"pro", "dce"} and "verifier_enveloppe" in missions:
        bloquant.append({"code": "moa_phase_pro", "message": "La phase PRO correspond normalement à une mission de conception MOE. Pour une maîtrise d'ouvrage, reformulez la mission en AMO — revue de l'estimation PRO ou choisissez une phase de programmation/faisabilité."})
        suggestions.append({"code": "revue_estimation_pro", "message": "Choisir AMO — revue de l'estimation PRO."})
    if tc == "maitrise_oeuvre" and any(m in {p["code"] for p in PHASES_MOE} for m in missions):
        alertes.append({"code": "phase_en_mission", "message": "Les phases ESQ, APS, APD, PRO, DCE, ACT, VISA, DET, OPC et AOR doivent être renseignées comme phases, pas comme missions principales."})
    if tc == "cotraitance" and not payload.get("role_lbh"):
        bloquant.append({"code": "role_lbh_manquant", "message": "Le rôle de LBH dans le groupement doit être précisé."})
    donnees = payload.get("donnees_entree") or {}
    if tc == "sous_traitance":
        for champ, libelle in {"donneur_ordre": "donneur d'ordre", "format_attendu": "format de remise"}.items():
            if not donnees.get(champ) and not payload.get(champ):
                alertes.append({"code": f"{champ}_manquant", "message": f"Le {libelle} doit être précisé pour une sous-traitance."})
    return {"valide": not bloquant, "bloquant": bloquant, "alertes": alertes, "suggestions": suggestions}


def construire_options_wizard_contexte(payload: dict[str, Any]) -> dict[str, Any]:
    tc = _type_client(payload)
    return {
        "types_client": deepcopy(TYPES_CLIENT),
        "sous_types_client": deepcopy(SOUS_TYPES.get(tc, SOUS_TYPES["autre"])),
        "cadres_juridiques": deepcopy(CADRES_JURIDIQUES),
        "modes_commande": deepcopy(MODES_COMMANDE.get(tc, MODES_COMMANDE["autre"])),
        "roles_lbh": deepcopy(ROLES_LBH.get(tc, ROLES_LBH["autre"])),
        "phases_intervention": deepcopy(PHASES_MOE if tc == "maitrise_oeuvre" else PHASES_AMO if tc in {"maitrise_ouvrage", "amo"} else PHASES_ENTREPRISE if tc == "entreprise" else []),
        "missions": suggerer_missions(payload),
        "methodes_estimation": suggerer_methodes_estimation(payload),
        "champs_donnees_techniques": suggerer_champs_donnees_techniques(payload),
        "livrables_attendus": construire_livrables_attendus(payload),
        "modules_actifs": construire_modules_actifs(payload),
        "controle_coherence": valider_combinaison_projet(payload),
    }
