"""Services métier transverses liés aux projets."""

from __future__ import annotations


CLIENTELES = {
    "moa_publique": "Maîtrise d'ouvrage publique",
    "moe_conception": "Équipe de maîtrise d'œuvre",
    "entreprise_travaux": "Entreprise de travaux",
    "cotraitrance": "Co-traitance",
    "sous_traitance": "Sous-traitance",
    "autre": "Contexte projet à préciser",
}

OBJECTIFS = {
    "verifier_enveloppe": "Vérification d'enveloppe budgétaire",
    "estimation_moe": "Estimation analytique de maîtrise d'œuvre",
    "redaction_dce_cctp": "Rédaction DCE / CCTP",
    "reponse_ao_entreprise": "Réponse à appel d'offres entreprise",
    "devis_entreprise": "Chiffrage de devis / BPU / DPGF",
    "prospection_ao": "Prospection et sélection d'appels d'offres",
    "suivi_execution": "Suivi d'exécution et bilan",
    "autre": "Objectif à préciser",
}

SOURCES_METHODOLOGIQUES = [
    "Manuel de l'étude de prix - Entreprises du BTP, 6e éd.",
    "Descriptifs et CCTP de projets de construction, 3e éd.",
    "Guide de la maîtrise d'œuvre travaux, avril 2020",
]

PHASES_PROJET_ORDONNEES = [
    "faisabilite",
    "programmation",
    "esquisse",
    "avp",
    "pro",
    "dce",
    "ao",
    "exe",
    "reception",
    "clos",
]

LIBELLES_PHASES_PROJET = {
    "faisabilite": "Faisabilité",
    "programmation": "Programmation",
    "esquisse": "Esquisse / ESQ",
    "avp": "Avant-projet sommaire / APS",
    "pro": "Avant-projet définitif / APD / PRO",
    "dce": "Dossier de consultation / DCE",
    "ao": "Appel d'offres",
    "exe": "Exécution / DET",
    "reception": "Réception / AOR",
    "clos": "Clos",
}

ALIASES_PHASES_PROJET = {
    "faisabilite": "faisabilite",
    "programmation": "programmation",
    "analyse_programme": "programmation",
    "note_budget": "programmation",
    "estimation_previsionnelle": "programmation",
    "verifier_enveloppe": "faisabilite",
    "esq": "esquisse",
    "esquisse": "esquisse",
    "aps": "avp",
    "apd": "pro",
    "avp": "avp",
    "avp_infrastructure": "avp",
    "diagnostic_infrastructure": "faisabilite",
    "etudes_preliminaires_infrastructure": "programmation",
    "pro": "pro",
    "pro_infrastructure": "pro",
    "estimation_par_lot": "pro",
    "estimation_infrastructure": "pro",
    "mission_economique_transversale": "pro",
    "redaction_cctp": "dce",
    "redaction_bpu": "dce",
    "redaction_dpgf": "dce",
    "redaction_ccap": "dce",
    "redaction_rc": "dce",
    "redaction_pieces_marche_infrastructure": "dce",
    "dce": "dce",
    "act": "ao",
    "act_infrastructure": "ao",
    "rapport_analyse_offres": "ao",
    "analyse_offres_infrastructure": "ao",
    "reponse_appel_offres": "ao",
    "prospection_ao": "ao",
    "ao": "ao",
    "exe": "exe",
    "visa": "exe",
    "det": "exe",
    "opc": "exe",
    "visa_infrastructure": "exe",
    "det_infrastructure": "exe",
    "opc_infrastructure": "exe",
    "planning_execution": "exe",
    "planning_previsionnel_travaux": "exe",
    "planning_travaux_infrastructure": "exe",
    "suivi_execution": "exe",
    "aor": "reception",
    "aor_infrastructure": "reception",
    "reception": "reception",
    "clos": "clos",
}


def normaliser_phase_projet(phase: str | None) -> str:
    code = str(phase or "").strip().lower()
    if not code:
        return ""
    return ALIASES_PHASES_PROJET.get(code, code if code in LIBELLES_PHASES_PROJET else "")


def libelle_phase_projet(phase: str | None) -> str:
    code = normaliser_phase_projet(phase)
    return LIBELLES_PHASES_PROJET.get(code, "")


def index_phase_projet(phase: str | None) -> int:
    code = normaliser_phase_projet(phase)
    return PHASES_PROJET_ORDONNEES.index(code) if code in PHASES_PROJET_ORDONNEES else -1


def construire_suggestion_phase_projet(projet) -> dict[str, object]:
    from applications.appels_offres.models import AppelOffres, OffreEntreprise
    from applications.batiment.models import ProgrammeBatiment
    from applications.documents.models import Document
    from applications.economie.models import EtudeEconomique
    from applications.execution.models import CompteRenduChantier, OrdreService, PlanningChantier, SituationTravaux, SuiviExecution
    from applications.metres.models import Metre
    from applications.pieces_ecrites.models import PieceEcrite
    from applications.voirie.models import EtudeVoirie

    phase_actuelle = normaliser_phase_projet(getattr(projet, "phase_actuelle", ""))
    index_actuel = index_phase_projet(phase_actuelle)

    documents = Document.objects.filter(projet=projet, est_version_courante=True)
    documents_consultation = documents.filter(
        type_document__code__in=["CCTP", "BPU", "DPGF", "DQE", "RC", "AE", "CCAP"]
    ).count()
    documents_reception = documents.filter(type_document__code__in=["PV_RECEPTION"]).count()

    pieces_consultation = PieceEcrite.objects.filter(
        projet=projet,
        modele__type_document__in=["cctp", "dpgf", "bpu", "dqe", "rc", "ae", "ccap"],
    ).count()
    etudes_economiques = EtudeEconomique.objects.filter(projet=projet).count()
    metres = Metre.objects.filter(projet=projet).count()
    programmes_batiment = ProgrammeBatiment.objects.filter(projet=projet).count()
    etudes_voirie = EtudeVoirie.objects.filter(projet=projet).count()

    appels_offres = AppelOffres.objects.filter(projet=projet)
    nb_appels_offres = appels_offres.count()
    ao_en_preparation = appels_offres.filter(statut="preparation").count()
    ao_actifs = appels_offres.exclude(statut="preparation").count()
    nb_offres = OffreEntreprise.objects.filter(appel_offres__projet=projet).count()

    suivis = SuiviExecution.objects.filter(projet=projet)
    nb_suivis = suivis.count()
    nb_plannings = PlanningChantier.objects.filter(suivi__projet=projet).count()
    nb_comptes_rendus = CompteRenduChantier.objects.filter(suivi__projet=projet).count()
    nb_situations = SituationTravaux.objects.filter(suivi__projet=projet).count()
    nb_ordres_service = OrdreService.objects.filter(suivi__projet=projet).count()
    situations_avancees = SituationTravaux.objects.filter(
        suivi__projet=projet,
        statut__in=["validee_moa", "payee"],
    ).count()
    comptes_rendus_finaux = CompteRenduChantier.objects.filter(
        suivi__projet=projet,
        avancement_physique_pct__gte=95,
    ).count()

    indices: list[str] = []
    phase_suggeree = ""
    raison = ""

    if projet.statut in {"termine", "archive"} and projet.date_fin_reelle:
        phase_suggeree = "clos"
        raison = "Le projet est clôturé métier avec une date de fin réelle renseignée."
        indices.extend(
            [
                f"Statut projet : {projet.get_statut_display()}",
                f"Date de fin réelle : {projet.date_fin_reelle.isoformat()}",
            ]
        )
    elif documents_reception or situations_avancees or comptes_rendus_finaux:
        phase_suggeree = "reception"
        raison = "Des indices de fin d'opération ou de réception ont été détectés."
        if documents_reception:
            indices.append(f"{documents_reception} document(s) de réception détecté(s)")
        if situations_avancees:
            indices.append(f"{situations_avancees} situation(s) validée(s) ou payée(s)")
        if comptes_rendus_finaux:
            indices.append(f"{comptes_rendus_finaux} compte(s) rendu(s) avec avancement >= 95 %")
    elif nb_suivis or nb_plannings or nb_comptes_rendus or nb_situations or nb_ordres_service:
        phase_suggeree = "exe"
        raison = "Le projet possède déjà des éléments actifs de suivi d'exécution."
        if nb_suivis:
            indices.append(f"{nb_suivis} suivi(s) d'exécution")
        if nb_plannings:
            indices.append(f"{nb_plannings} planning(s) chantier")
        if nb_comptes_rendus:
            indices.append(f"{nb_comptes_rendus} compte(s) rendu(s) de chantier")
        if nb_situations:
            indices.append(f"{nb_situations} situation(s) de travaux")
        if nb_ordres_service:
            indices.append(f"{nb_ordres_service} ordre(s) de service")
    elif ao_actifs or nb_offres:
        phase_suggeree = "ao"
        raison = "La consultation est engagée ou des offres ont déjà été reçues."
        if nb_appels_offres:
            indices.append(f"{nb_appels_offres} appel(s) d'offres")
        if ao_actifs:
            indices.append(f"{ao_actifs} consultation(s) hors préparation")
        if nb_offres:
            indices.append(f"{nb_offres} offre(s) entreprise reçue(s)")
    elif pieces_consultation or documents_consultation or ao_en_preparation:
        phase_suggeree = "dce"
        raison = "Des pièces de consultation ou une préparation de consultation sont déjà présentes."
        if pieces_consultation:
            indices.append(f"{pieces_consultation} pièce(s) écrite(s) de consultation")
        if documents_consultation:
            indices.append(f"{documents_consultation} document(s) GED de type consultation")
        if ao_en_preparation:
            indices.append(f"{ao_en_preparation} appel(s) d'offres en préparation")
    elif etudes_economiques or metres or etudes_voirie:
        phase_suggeree = "pro"
        raison = "Le projet contient déjà des productions d'estimation ou de quantification."
        if etudes_economiques:
            indices.append(f"{etudes_economiques} étude(s) économique(s)")
        if metres:
            indices.append(f"{metres} métré(s)")
        if etudes_voirie:
            indices.append(f"{etudes_voirie} étude(s) de voirie")
    elif programmes_batiment:
        phase_suggeree = "programmation"
        raison = "Le projet est structuré par un programme bâtiment sans production aval détectée."
        indices.append(f"{programmes_batiment} programme(s) bâtiment")
    elif projet.montant_estime or projet.maitre_ouvrage_id or projet.description:
        phase_suggeree = "faisabilite"
        raison = "Le projet est qualifié mais aucun livrable de phase avancée n'a encore été détecté."
        if projet.montant_estime:
            indices.append("Montant estimé renseigné")
        if projet.maitre_ouvrage_id:
            indices.append("Maître d'ouvrage renseigné")
        if projet.description:
            indices.append("Description projet renseignée")
    else:
        phase_suggeree = "faisabilite"
        raison = "Le projet existe mais ne contient pas encore d'indice suffisant pour une phase plus avancée."
        indices.append("Aucun artefact métier avancé détecté")

    index_suggere = index_phase_projet(phase_suggeree)
    return {
        "code": phase_suggeree,
        "libelle": libelle_phase_projet(phase_suggeree),
        "raison": raison,
        "indices": indices[:6],
        "differe": phase_suggeree != phase_actuelle,
        "avancee_superieure": index_suggere > index_actuel,
        "phase_actuelle": phase_actuelle,
        "phase_actuelle_libelle": libelle_phase_projet(phase_actuelle),
    }


def _piece_documentaire(
    code: str,
    intitule: str,
    description: str,
    *,
    obligatoire: bool = True,
    types_documents: list[str] | None = None,
    mots_cles: list[str] | None = None,
    dossier_code: str | None = None,
) -> dict[str, object]:
    return {
        "code": code,
        "intitule": intitule,
        "description": description,
        "obligatoire": obligatoire,
        "types_documents": types_documents or [],
        "mots_cles": mots_cles or [],
        "dossier_code": dossier_code,
    }


def _pieces_documentaires_attendues(clientele: str, objectif: str) -> list[dict[str, object]]:
    if clientele == "moa_publique":
        pieces = [
            _piece_documentaire(
                "programme",
                "Programme et besoins",
                "Programme, notice fonctionnelle, objectifs et hypothèses d'enveloppe.",
                types_documents=["RAPPORT"],
                mots_cles=["programme", "notice", "besoins", "enveloppe", "surfaces"],
                dossier_code="programme-sources",
            ),
            _piece_documentaire(
                "plans",
                "Plans et supports graphiques",
                "Plans, croquis, coupes, façades, relevés et supports graphiques.",
                types_documents=["PLAN"],
                mots_cles=["plan", "coupe", "facade", "croquis", "releve"],
                dossier_code="plans-et-maquettes",
            ),
            _piece_documentaire(
                "quantitatifs",
                "Quantitatifs et données mesurables",
                "Tableaux de surfaces, métrés, DQE ou quantitatifs d'entrée.",
                types_documents=["DQE", "DPGF", "BPU"],
                mots_cles=["quantitatif", "metre", "m2", "m3", "surface", "tableau de surfaces"],
                dossier_code="imports-quantitatifs",
            ),
            _piece_documentaire(
                "references_prix",
                "Références économiques",
                "Devis, marchés, BPU, DPGF et autres retours d'expérience exploitables.",
                types_documents=["BPU", "DPGF", "DQE"],
                mots_cles=["devis", "marche", "bordereau", "prix unitaires", "retour d'experience"],
                dossier_code="estimations-rex",
            ),
        ]
        if objectif == "suivi_execution":
            pieces.append(
                _piece_documentaire(
                    "suivi_execution",
                    "Suivi d'exécution",
                    "Comptes rendus, visas, constats, OPR et documents de clôture.",
                    types_documents=["CR_CHANTIER", "PV_RECEPTION", "NOTE_CALCUL"],
                    mots_cles=["chantier", "visa", "opr", "reserve", "reception", "ordre de service"],
                    dossier_code="execution-suivi",
                )
            )
        return pieces

    if clientele == "moe_conception":
        pieces = [
            _piece_documentaire(
                "programme_notice",
                "Programme et notice",
                "Programme, notice descriptive, diagnostic ou documents d'entrée de conception.",
                types_documents=["RAPPORT"],
                mots_cles=["programme", "notice", "diagnostic", "besoins", "contraintes"],
                dossier_code="programme-sources",
            ),
            _piece_documentaire(
                "plans_conception",
                "Plans de conception",
                "Plans, croquis, coupes, façades, maquettes et annexes graphiques.",
                types_documents=["PLAN"],
                mots_cles=["plan", "coupe", "facade", "niveau", "maquette", "releve"],
                dossier_code="plans-et-maquettes",
            ),
            _piece_documentaire(
                "quantitatifs",
                "Quantitatifs et métrés",
                "Métrés, quantitatifs ou extractions exploitables pour l'estimation.",
                types_documents=["DQE", "DPGF", "BPU"],
                mots_cles=["metre", "quantitatif", "dqe", "dpgf", "bpu", "surface"],
                dossier_code="imports-quantitatifs",
            ),
            _piece_documentaire(
                "prescriptions_techniques",
                "Prescriptions techniques",
                "CCTP, descriptifs techniques, notices ou éléments de prescription.",
                types_documents=["CCTP"],
                mots_cles=["cctp", "cahier des clauses techniques", "descriptif", "mise en oeuvre"],
                dossier_code="cctp-lot",
            ),
            _piece_documentaire(
                "cadres_prix",
                "Cadres de prix",
                "BPU, DPGF, DQE ou bordereaux à produire et contrôler.",
                types_documents=["BPU", "DPGF", "DQE"],
                mots_cles=["bordereau", "prix unitaires", "decomposition du prix global", "quantitatif estimatif"],
                dossier_code="bordereaux-prix",
            ),
        ]
        if objectif == "suivi_execution":
            pieces.extend(
                [
                    _piece_documentaire(
                        "execution",
                        "Pièces d'exécution",
                        "Documents EXE, visas, notes de calcul et documents d'approbation.",
                        types_documents=["NOTE_CALCUL", "PLAN"],
                        mots_cles=["visa", "execution", "exe", "note de calcul", "fiche produit"],
                        dossier_code="visa-execution",
                    ),
                    _piece_documentaire(
                        "suivi_chantier",
                        "Suivi de chantier",
                        "Comptes rendus, ordres de service, constats et documents de réception.",
                        types_documents=["CR_CHANTIER", "PV_RECEPTION"],
                        mots_cles=["compte rendu", "chantier", "ordre de service", "opr", "reception"],
                        dossier_code="comptes-rendus",
                    ),
                ]
            )
        return pieces

    if clientele in {"entreprise_travaux", "cotraitrance", "sous_traitance"}:
        return [
            _piece_documentaire(
                "consultation_technique",
                "Pièces techniques de consultation",
                "CCTP, notice technique, descriptif ou diagnostic servant de base au chiffrage.",
                types_documents=["CCTP", "RAPPORT"],
                mots_cles=["cctp", "descriptif", "notice", "clauses techniques", "ouvrage"],
                dossier_code="consultation-technique",
            ),
            _piece_documentaire(
                "cadres_prix",
                "Cadres de prix reçus",
                "BPU, DPGF, DQE, cadres de réponse et annexes financières.",
                types_documents=["BPU", "DPGF", "DQE"],
                mots_cles=["bpu", "dpgf", "dqe", "prix unitaires", "quantitatif estimatif"],
                dossier_code="consultation-financiere",
            ),
            _piece_documentaire(
                "plans",
                "Plans et pièces graphiques",
                "Plans, coupes, façades, détails et supports graphiques pour le métré.",
                types_documents=["PLAN"],
                mots_cles=["plan", "coupe", "facade", "detail", "dxf", "dwg"],
                dossier_code="consultation-technique",
            ),
            _piece_documentaire(
                "annexes_contractuelles",
                "Annexes contractuelles",
                "Acte d'engagement, règlement, pièces administratives et conditions de réponse.",
                obligatoire=False,
                types_documents=["AE"],
                mots_cles=["acte d'engagement", "reglement de consultation", "cadre de reponse", "ccap"],
                dossier_code="contexte-contractuel",
            ),
            _piece_documentaire(
                "sources_imports",
                "Sources bureautiques à extraire",
                "PDF, Word, Excel ou archives exploitables pour produire le chiffrage analytique.",
                obligatoire=False,
                mots_cles=["xlsx", "xls", "docx", "pdf", "bordereau", "devis", "quantitatif"],
                dossier_code="imports-bruts",
            ),
        ]

    return [
        _piece_documentaire(
            "pieces_sources",
            "Pièces sources",
            "Documents d'entrée nécessaires à la qualification du besoin et à la production.",
            mots_cles=["programme", "plan", "notice", "devis", "rapport"],
        )
    ]


def _controle_documentaire_attendu(clientele: str, objectif: str) -> dict[str, object]:
    return {
        "resume": (
            "Les pièces téléversées sont analysées par leur contenu extrait et leur classification documentaire "
            "afin de contrôler la présence ou l'absence des pièces attendues pour le projet."
        ),
        "pieces_attendues": _pieces_documentaires_attendues(clientele, objectif),
    }


def _normaliser_clientele(projet=None, clientele_cible: str | None = None) -> str:
    if clientele_cible:
        return clientele_cible

    valeur = getattr(projet, "clientele_cible", "") or ""
    if valeur:
        return valeur

    maitre_ouvrage = getattr(projet, "maitre_ouvrage", None)
    type_org = getattr(maitre_ouvrage, "type_organisation", "") if maitre_ouvrage else ""
    if type_org == "maitre_ouvrage":
        return "moa_publique"
    if type_org == "entreprise":
        return "entreprise_travaux"
    if type_org == "partenaire":
        return "cotraitrance"
    if type_org == "sous_traitant":
        return "sous_traitance"

    type_projet = getattr(projet, "type_projet", "")
    if type_projet == "mission_moe":
        return "moe_conception"
    return "autre"


def _normaliser_objectif(projet=None, objectif_mission: str | None = None, clientele_cible: str | None = None) -> str:
    if objectif_mission:
        return objectif_mission

    valeur = getattr(projet, "objectif_mission", "") or ""
    if valeur:
        return valeur

    clientele = _normaliser_clientele(projet=projet, clientele_cible=clientele_cible)
    type_projet = getattr(projet, "type_projet", "")
    phase = getattr(projet, "phase_actuelle", "")

    if clientele == "moa_publique":
        return "verifier_enveloppe"
    if clientele == "moe_conception":
        return "redaction_dce_cctp" if phase in {"pro", "dce", "ao"} or type_projet == "mission_moe" else "estimation_moe"
    if clientele == "entreprise_travaux":
        return "reponse_ao_entreprise" if phase == "ao" else "devis_entreprise"
    if clientele in {"cotraitrance", "sous_traitance"}:
        return "devis_entreprise"
    return "autre"


def _option(valeur: str, libelle: str) -> dict[str, str]:
    return {"value": valeur, "label": libelle}


def _question(identifiant: str, question: str, type_question: str, options: list[dict[str, str]], **extras) -> dict[str, object]:
    return {
        "id": identifiant,
        "question": question,
        "type": type_question,
        "options": options,
        "reponses": [option["label"] for option in options],
        **extras,
    }


def _etape(code: str, titre: str, description: str, questions: list[dict[str, object]]) -> dict[str, object]:
    return {
        "code": code,
        "titre": titre,
        "description": description,
        "questions": questions,
    }


def _questions_cadrage_moa() -> list[dict[str, object]]:
    return [
        _question(
            "niveau_definition",
            "Quel est le niveau de définition du programme à ce stade ?",
            "choix",
            [
                _option("programme_initial", "Programme initial"),
                _option("programme_fonctionnel", "Programme fonctionnel consolidé"),
                _option("esquisse", "Esquisse / faisabilité"),
                _option("aps_apd", "APS / APD / PRO"),
            ],
            obligatoire=True,
        ),
        _question(
            "enveloppe_initiale_connue",
            "L'enveloppe travaux de référence est-elle connue ?",
            "choix",
            [
                _option("ferme", "Oui, enveloppe arrêtée"),
                _option("a_consolider", "Oui, mais à consolider"),
                _option("a_definir", "Non, à construire"),
            ],
            obligatoire=True,
        ),
        _question(
            "sources_programme",
            "Quels supports de programme sont déjà disponibles ?",
            "cases",
            [
                _option("programme", "Programme détaillé"),
                _option("plans", "Plans ou croquis"),
                _option("surface", "Surfaces ou tableau de surfaces"),
                _option("quantitatif", "Quantitatif ou métré"),
                _option("photos", "Photos / diagnostic existant"),
                _option("retours_experience", "Références ou opérations similaires"),
            ],
            multiple=True,
        ),
        _question(
            "strategie_estimation_initiale",
            "Quelle chaîne d'estimation doit être suivie ?",
            "cases",
            [
                _option("ratio", "Ratio sur projets similaires"),
                _option("rex", "Retour d'expérience"),
                _option("analytique", "Analytique poste par poste"),
            ],
            multiple=True,
            obligatoire=True,
        ),
    ]


def _questions_cadrage_moe() -> list[dict[str, object]]:
    return [
        _question(
            "phase_mission_detaillee",
            "Quelle est la phase de mission dominante ?",
            "choix",
            [
                _option("esq", "ESQ / faisabilité"),
                _option("aps", "APS"),
                _option("apd_pro", "APD / PRO"),
                _option("dce", "DCE"),
                _option("ao", "Analyse des offres"),
                _option("exe_det", "EXE / DET / AOR"),
            ],
            obligatoire=True,
        ),
        _question(
            "pieces_a_rediger",
            "Quelles pièces doivent être produites ou consolidées ?",
            "cases",
            [
                _option("cctp", "CCTP"),
                _option("bpu", "BPU"),
                _option("dpgf", "DPGF"),
                _option("dqe", "DQE"),
                _option("ccap", "CCAP"),
                _option("rc", "Règlement de consultation"),
                _option("analyse_offres", "Analyse des offres"),
            ],
            multiple=True,
            obligatoire=True,
        ),
        _question(
            "bases_techniques",
            "Quelles données techniques sont disponibles pour rédiger et estimer ?",
            "cases",
            [
                _option("plans", "Plans de conception"),
                _option("programme", "Programme / notice"),
                _option("metres", "Quantitatifs / métrés"),
                _option("bibliotheque_prix", "Prix de référence"),
                _option("bibliotheque_cctp", "Prescriptions techniques"),
                _option("normes_dtu", "Normes, DTU, eurocodes ou avis techniques"),
            ],
            multiple=True,
        ),
        _question(
            "niveau_precision_attendu",
            "Quel niveau de précision économique est attendu ?",
            "choix",
            [
                _option("ordre_grandeur", "Ordre de grandeur"),
                _option("estimation_affinee", "Estimation affinée"),
                _option("analytique_5", "Estimation analytique objectif ±5 %"),
            ],
            obligatoire=True,
        ),
    ]


def _questions_cadrage_entreprise() -> list[dict[str, object]]:
    return [
        _question(
            "cadre_reponse",
            "Quel est le cadre de réponse à produire ?",
            "choix",
            [
                _option("devis", "Devis libre"),
                _option("bpu_dpgf", "BPU / DPGF / DQE"),
                _option("appel_offres", "Dossier de réponse à appel d'offres"),
                _option("sous_traitance", "Offre de sous-traitance"),
            ],
            obligatoire=True,
        ),
        _question(
            "pieces_consultation",
            "Quelles pièces ont été reçues ?",
            "cases",
            [
                _option("cctp", "CCTP"),
                _option("bpu", "BPU"),
                _option("dpgf", "DPGF"),
                _option("dqe", "DQE"),
                _option("plans", "Plans"),
                _option("notice", "Notice / descriptif"),
                _option("excel_pdf", "PDF, Word ou Excel à extraire"),
            ],
            multiple=True,
            obligatoire=True,
        ),
        _question(
            "niveau_sous_detail",
            "Quel niveau de sous-détail analytique est exigé ?",
            "choix",
            [
                _option("minimal", "Minimal sur postes sensibles"),
                _option("complet", "Complet sur toute l'offre"),
                _option("rapide", "Estimation rapide à consolider ensuite"),
            ],
            obligatoire=True,
        ),
        _question(
            "analyses_complementaires",
            "Quels compléments de gestion faut-il préparer ?",
            "cases",
            [
                _option("dhmo", "DHMO analytique par profil"),
                _option("rentabilite", "Seuil de rentabilité"),
                _option("achats", "Achats fournisseurs et conditionnements"),
                _option("memoire", "Mémoire technique"),
                _option("planning", "Planning prévisionnel"),
                _option("bilan", "Bilan d'opération"),
            ],
            multiple=True,
        ),
    ]


def _questions_documentaires_communes() -> list[dict[str, object]]:
    return [
        _question(
            "classement_documentaire",
            "Quels flux documentaires doivent être suivis dans la GED projet ?",
            "cases",
            [
                _option("sources", "Pièces sources"),
                _option("estimations", "Estimations / études de prix"),
                _option("pieces_ecrites", "Pièces écrites générées"),
                _option("echanges", "Échanges et visas"),
                _option("execution", "Exécution / suivi"),
                _option("reception", "Réception / clôture"),
            ],
            multiple=True,
        ),
        _question(
            "livrables_prioritaires",
            "Quels livrables doivent être générés automatiquement en priorité ?",
            "cases",
            [
                _option("note_budget", "Note d'enveloppe / note d'estimation"),
                _option("cctp", "CCTP"),
                _option("bpu_dpgf", "BPU / DPGF / DQE"),
                _option("memoire", "Mémoire technique / rapport"),
                _option("bon_commande", "Bon de commande fournisseurs"),
            ],
            multiple=True,
        ),
    ]


def _questions_autres() -> list[dict[str, object]]:
    return [
        _question(
            "nature_besoin",
            "Le besoin principal relève de quelle logique ?",
            "choix",
            [
                _option("estimer", "Estimer"),
                _option("rediger", "Rédiger"),
                _option("consulter", "Consulter"),
                _option("repondre", "Répondre à un appel d'offres"),
                _option("suivre", "Suivre l'exécution"),
            ],
            obligatoire=True,
        ),
        _question(
            "donnees_disponibles",
            "Quelles données sont déjà disponibles ?",
            "cases",
            [
                _option("programme", "Programme"),
                _option("plans", "Plans"),
                _option("quantitatif", "Quantitatif"),
                _option("documents_contractuels", "Pièces contractuelles"),
                _option("photos", "Photos / relevés"),
            ],
            multiple=True,
        ),
    ]


def construire_dossiers_documentaires(
    projet=None,
    *,
    clientele_cible: str | None = None,
    objectif_mission: str | None = None,
) -> list[dict[str, object]]:
    clientele = _normaliser_clientele(projet=projet, clientele_cible=clientele_cible)
    objectif = _normaliser_objectif(projet=projet, objectif_mission=objectif_mission, clientele_cible=clientele)

    def dossier(code: str, intitule: str, description: str, *, enfants: list[dict[str, object]] | None = None) -> dict[str, object]:
        return {
            "code": code,
            "intitule": intitule,
            "description": description,
            "est_systeme": True,
            "enfants": enfants or [],
        }

    if clientele in {"entreprise_travaux", "cotraitrance", "sous_traitance"}:
        dossiers = [
            dossier(
                "qualification-affaire",
                "01 - Qualification de l'affaire",
                "Cadrage de l'offre, contexte contractuel et réponses du wizard.",
                enfants=[
                    dossier("contexte-contractuel", "1.1 - Contexte contractuel", "Cadre du marché, interlocuteurs et conditions de réponse."),
                    dossier("strategie-reponse", "1.2 - Stratégie de réponse", "Hypothèses d'offre, variantes et positionnement."),
                ],
            ),
            dossier(
                "dossier-consultation",
                "02 - Dossier de consultation",
                "Pièces reçues : CCTP, BPU, DPGF, DQE, plans et annexes.",
                enfants=[
                    dossier("consultation-technique", "2.1 - Pièces techniques", "CCTP, notices, diagnostics, plans et annexes techniques."),
                    dossier("consultation-financiere", "2.2 - Cadres de prix", "BPU, DPGF, DQE, variantes financières et trames de réponse."),
                ],
            ),
            dossier(
                "quantitatifs-imports",
                "03 - Quantitatifs et imports",
                "Métrés, extractions PDF/Word/Excel et quantitatifs structurés.",
                enfants=[
                    dossier("imports-bruts", "3.1 - Imports bruts", "PDF, Word, Excel et OCR avant structuration."),
                    dossier("quantitatifs-valides", "3.2 - Quantitatifs validés", "Métrés consolidés et lignes d'ouvrages validées."),
                ],
            ),
            dossier(
                "chiffrage-sous-details",
                "04 - Chiffrage et sous-détails",
                "Études de prix, déboursés secs, DHMO et coefficients.",
                enfants=[
                    dossier("sous-details-analytiques", "4.1 - Sous-détails analytiques", "Déboursés secs, équipes, cadences et coefficients."),
                    dossier("syntheses-prix", "4.2 - Synthèses de prix", "Études de prix consolidées, comparatifs et ajustements."),
                ],
            ),
            dossier(
                "achats-fournisseurs",
                "05 - Achats fournisseurs",
                "Consultations, conditionnements, bons de commande et suivis.",
                enfants=[
                    dossier("consultations-fournisseurs", "5.1 - Consultations fournisseurs", "Demandes de prix, réponses fournisseurs et variantes d'achats."),
                    dossier("bons-commande", "5.2 - Bons de commande", "Commandes, conditionnements et suivis d'approvisionnement."),
                ],
            ),
            dossier(
                "offre-et-memoire",
                "06 - Offre et mémoire",
                "Offre finale, mémoire technique, acte d'engagement et pièces remises.",
                enfants=[
                    dossier("offre-financiere", "6.1 - Offre financière", "BPU, DPGF, DQE, devis et annexes chiffrées diffusables."),
                    dossier("memoire-technique", "6.2 - Mémoire technique", "Mémoire, planning, méthodologie et pièces de candidature."),
                ],
            ),
            dossier(
                "suivi-chantier",
                "07 - Suivi de chantier",
                "Budget de chantier, pointages, situations et constats.",
                enfants=[
                    dossier("budget-chantier", "7.1 - Budget de chantier", "Budgets d'exécution, pointages et suivis d'avancement."),
                    dossier("situations-chantier", "7.2 - Situations et constats", "Situations, attachements, constats et éléments de suivi."),
                ],
            ),
            dossier(
                "bilan-rentabilite",
                "08 - Bilan et rentabilité",
                "Bilan d'opération, retours d'expérience et mise à jour des bases.",
                enfants=[
                    dossier("bilan-operation", "8.1 - Bilan d'opération", "Marge réalisée, écarts et analyse finale."),
                    dossier("retours-experience-entreprise", "8.2 - Retour d'expérience", "Capitalisation des prix et enseignements de l'affaire."),
                ],
            ),
        ]
    else:
        dossiers = [
            dossier(
                "qualification-mission",
                "01 - Qualification de la mission",
                "Cadrage du besoin, réponses du wizard et pièces de référence.",
                enfants=[
                    dossier("cadrage-client", "1.1 - Cadrage client", "Programme, attentes, hypothèses et arbitrages de départ."),
                    dossier("hypotheses-mission", "1.2 - Hypothèses de mission", "Périmètre, phases, livrables et contraintes de production."),
                ],
            ),
            dossier(
                "programme-donnees-entree",
                "02 - Programme et données d'entrée",
                "Programme, plans, tableaux de surfaces, diagnostics et sources.",
                enfants=[
                    dossier("programme-sources", "2.1 - Programme et sources", "Programme, notices, diagnostics et tableaux de surfaces."),
                    dossier("plans-et-maquettes", "2.2 - Plans et maquettes", "Plans, croquis, coupes, modèles et annexes graphiques."),
                    dossier("imports-quantitatifs", "2.3 - Imports et quantitatifs", "Imports OCR, extractions et quantitatifs structurés."),
                ],
            ),
            dossier(
                "estimations-economie",
                "03 - Estimations et économie",
                "Ratios, retours d'expérience, études de prix et notes d'estimation.",
                enfants=[
                    dossier("estimations-ratio", "3.1 - Estimations par ratio", "Ratios, enveloppes initiales et comparatifs similaires."),
                    dossier("estimations-rex", "3.2 - Retours d'expérience", "Analyses de références, marchés antérieurs et comparatifs."),
                    dossier("estimations-analytiques", "3.3 - Estimations analytiques", "Analyses détaillées par poste, lot ou ouvrage."),
                ],
            ),
            dossier(
                "pieces-ecrites-dce",
                "04 - Pièces écrites et DCE",
                "CCTP, BPU, DPGF, DQE, CCAP, RC et variantes documentaires.",
                enfants=[
                    dossier("cctp-lot", "4.1 - CCTP par lot", "Prescriptions techniques et variantes par lot."),
                    dossier("bordereaux-prix", "4.2 - BPU / DPGF / DQE", "Bordereaux de prix et quantitatifs estimatifs."),
                    dossier("pieces-administratives", "4.3 - Pièces administratives", "CCAP, RC, AE et documents de consultation associés."),
                ],
            ),
            dossier(
                "consultation-analyse",
                "05 - Consultation et analyse",
                "Consultations, questions/réponses, analyse des offres et rapports.",
                enfants=[
                    dossier("questions-reponses", "5.1 - Questions / réponses", "Échanges, compléments et mises au point de consultation."),
                    dossier("analyse-offres", "5.2 - Analyse des offres", "Rapports d'analyse, tableaux comparatifs et recommandations."),
                ],
            ),
            dossier(
                "execution-suivi",
                "06 - Exécution et suivi",
                "Visa, DET, OPC, comptes-rendus, ordres de service et contrôle extérieur.",
                enfants=[
                    dossier("visa-execution", "6.1 - VISA / EXE", "Documents d'exécution, visas et contrôles de conformité."),
                    dossier("comptes-rendus", "6.2 - Comptes rendus", "Réunions de chantier, constats et suivi d'actions."),
                    dossier("ordres-service", "6.3 - Ordres de service", "OS, demandes de travaux et arbitrages d'exécution."),
                ],
            ),
            dossier(
                "reception-cloture",
                "07 - Réception et clôture",
                "OPR, réserves, DOE, DGD, garanties et remise d'ouvrage.",
                enfants=[
                    dossier("opr-reserves", "7.1 - OPR et réserves", "OPR, réserves, levées et suivi contradictoire."),
                    dossier("doe-garanties", "7.2 - DOE et garanties", "DOE, récolement, garanties et documents de clôture."),
                ],
            ),
            dossier(
                "livrables-client",
                "08 - Livrables client",
                "Documents générés diffusables au maître d'ouvrage ou à l'équipe de maîtrise d'œuvre.",
                enfants=[
                    dossier("notes-client", "8.1 - Notes et rapports", "Notes de synthèse, notes MOA/MOE et rapports diffusables."),
                    dossier("exports-diffusables", "8.2 - Exports diffusables", "Exports Word, PDF, tableurs et documents remis au client."),
                ],
            ),
        ]

    if objectif == "redaction_dce_cctp":
        dossiers.append(
            dossier(
                "bibliotheque-cctp-projet",
                "09 - Bibliothèque CCTP projet",
                "Prescriptions techniques, variantes et articles réemployables pour le projet.",
                enfants=[
                    dossier("articles-reference", "9.1 - Articles de référence", "Articles CCTP réemployables et textes normalisés."),
                    dossier("variantes-techniques", "9.2 - Variantes techniques", "Alternatives, options et points de vigilance projet."),
                ],
            )
        )

    def aplatir(elements: list[dict[str, object]], *, parent_code: str | None = None, parent_intitule: str | None = None) -> list[dict[str, object]]:
        resultat: list[dict[str, object]] = []
        for index, element in enumerate(elements, start=1):
            entree = {
                "code": element["code"],
                "intitule": element["intitule"],
                "description": element["description"],
                "ordre": index,
                "est_systeme": bool(element.get("est_systeme", True)),
            }
            if parent_code:
                entree["parent_code"] = parent_code
                entree["parent_intitule"] = parent_intitule
            resultat.append(entree)
            enfants = element.get("enfants") or []
            if enfants:
                resultat.extend(
                    aplatir(
                        enfants,
                        parent_code=str(element["code"]),
                        parent_intitule=str(element["intitule"]),
                    )
                )
        return resultat

    return aplatir(dossiers)


def _assistants_generation_documentaire(clientele: str, objectif: str) -> list[dict[str, str]]:
    if clientele == "moa_publique":
        return [
            {
                "code": "note-enveloppe",
                "intitule": "Note de vérification d'enveloppe",
                "description": "Prépare une note de cadrage économique pour comparer l'enveloppe initiale, les ratios et le retour d'expérience.",
                "type_document": "rapport_analyse",
                "dossier_code": "estimations-ratio",
                "action": "piece_ecrite",
            },
            {
                "code": "estimation-consolidee",
                "intitule": "Estimation consolidée par lots",
                "description": "Structure une note d'estimation consolidée, diffusable au maître d'ouvrage.",
                "type_document": "rapport",
                "dossier_code": "notes-client",
                "action": "piece_ecrite",
            },
        ]
    if clientele == "moe_conception":
        assistants = [
            {
                "code": "cctp-lot",
                "intitule": "CCTP par lot",
                "description": "Crée une pièce écrite CCTP structurée à partir de la bibliothèque CCTP et du contexte projet.",
                "type_document": "cctp",
                "dossier_code": "cctp-lot",
                "action": "piece_ecrite",
            },
            {
                "code": "bordereau-prix",
                "intitule": "BPU / DPGF / DQE",
                "description": "Prépare un bordereau de prix à compléter à partir des lignes de bibliothèque et du lot.",
                "type_document": "dpgf" if objectif == "estimation_moe" else "bpu",
                "dossier_code": "bordereaux-prix",
                "action": "piece_ecrite",
            },
            {
                "code": "note-estimation",
                "intitule": "Note d'estimation",
                "description": "Produit une note de synthèse pour tracer la logique ratio / retour d'expérience / analytique.",
                "type_document": "rapport_analyse",
                "dossier_code": "estimations-analytiques",
                "action": "piece_ecrite",
            },
        ]
        if objectif == "suivi_execution":
            assistants.extend(
                [
                    {
                        "code": "compte-rendu-chantier",
                        "intitule": "Compte rendu de chantier",
                        "description": "Prépare un compte rendu structuré pour la DET et le suivi d'exécution.",
                        "type_document": "rapport",
                        "dossier_code": "comptes-rendus",
                        "action": "piece_ecrite",
                    },
                    {
                        "code": "planning-execution",
                        "intitule": "Planning d'exécution",
                        "description": "Prépare un support de planning et d'ordonnancement pour l'exécution.",
                        "type_document": "planning_taches",
                        "dossier_code": "ordres-service",
                        "action": "piece_ecrite",
                    },
                ]
            )
        return assistants
    if clientele in {"entreprise_travaux", "cotraitrance", "sous_traitance"}:
        return [
            {
                "code": "devis-analytique",
                "intitule": "Devis / DPGF analytique",
                "description": "Prépare un support de chiffrage analytique relié aux sous-détails et aux déboursés secs.",
                "type_document": "dpgf",
                "dossier_code": "offre-financiere",
                "action": "piece_ecrite",
            },
            {
                "code": "memoire-technique",
                "intitule": "Mémoire technique",
                "description": "Crée la trame du mémoire technique et de la méthodologie de réponse.",
                "type_document": "memoire_technique",
                "dossier_code": "memoire-technique",
                "action": "piece_ecrite",
            },
            {
                "code": "lettre-candidature",
                "intitule": "Lettre de candidature",
                "description": "Prépare les éléments de candidature et d'accompagnement à l'offre.",
                "type_document": "lettre_candidature",
                "dossier_code": "memoire-technique",
                "action": "piece_ecrite",
            },
            {
                "code": "bilan-rentabilite",
                "intitule": "Bilan de rentabilité",
                "description": "Met en forme le bilan d'opération et les écarts entre prévisionnel et réalisé.",
                "type_document": "rapport_analyse",
                "dossier_code": "bilan-operation",
                "action": "piece_ecrite",
            },
        ]
    return [
        {
            "code": "note-cadrage",
            "intitule": "Note de cadrage",
            "description": "Prépare un document de cadrage générique du projet.",
            "type_document": "rapport",
            "dossier_code": "notes-client",
            "action": "piece_ecrite",
        }
    ]


def _documents_attendus(clientele: str, objectif: str) -> list[str]:
    if clientele in {"entreprise_travaux", "cotraitrance", "sous_traitance"}:
        return [
            "Pièces de consultation ou de devis : CCTP, BPU, DPGF, DQE, plans, annexes.",
            "Quantitatifs, métrés, tableaux Excel et imports PDF/Word à structurer.",
            "Études de prix analytiques, achats fournisseurs, mémoire technique et offre finale.",
        ]
    documents = [
        "Programme, plans, diagnostics, surfaces et pièces sources du projet.",
        "Estimations, études de prix, ratios et retours d'expérience.",
        "Pièces écrites structurées par lot et par phase du projet.",
    ]
    if objectif == "suivi_execution":
        documents.append("Comptes-rendus, ordres de service, visa, constats, OPR et DOE.")
    return documents


def _documents_a_generer(clientele: str, objectif: str) -> list[str]:
    if clientele == "moa_publique":
        return [
            "Note de vérification d'enveloppe",
            "Comparatif ratio / retour d'expérience / analytique",
            "Estimation consolidée par lots",
        ]
    if clientele == "moe_conception":
        documents = [
            "CCTP par lot",
            "BPU / DPGF / DQE",
            "Note d'estimation consolidée",
        ]
        if objectif == "suivi_execution":
            documents.extend(["Compte-rendu de chantier", "Visa / suivi d'exécution", "Réception / garanties"])
        return documents
    if clientele in {"entreprise_travaux", "cotraitrance", "sous_traitance"}:
        return [
            "Sous-détails analytiques exportables",
            "Bon de commande fournisseurs",
            "BPU / DPGF / devis chiffré",
            "Mémoire technique ou dossier de candidature",
            "Bilan de rentabilité",
        ]
    return ["Livrable à préciser après qualification du dossier"]


def _methodes_estimation(clientele: str, objectif: str) -> list[dict[str, str]]:
    if clientele == "moa_publique":
        return [
            {"code": "ratio", "libelle": "Estimation par ratio", "objectif": "Vérifier d'abord l'enveloppe de travaux à partir d'opérations similaires et d'un taux de similarité."},
            {"code": "rex", "libelle": "Retour d'expérience", "objectif": "Contrôler les résultats à partir de marchés, devis, BPU, DPGF et pièces déjà analysées."},
            {"code": "analytique", "libelle": "Analytique ciblée", "objectif": "Consolider les postes significatifs lorsque le niveau de définition devient suffisant."},
        ]
    if clientele == "moe_conception":
        return [
            {"code": "ratio", "libelle": "Avant-estimation par ratio", "objectif": "Cadrer rapidement le coût par familles d'ouvrages et vérifier l'économie générale du projet."},
            {"code": "rex", "libelle": "Retour d'expérience", "objectif": "Comparer les lots et ouvrages avec les opérations antérieures et la bibliothèque métier."},
            {"code": "analytique", "libelle": "Estimation analytique", "objectif": "Produire une estimation détaillée cohérente avec les pièces écrites et une cible de précision aboutie."},
        ]
    if clientele in {"entreprise_travaux", "cotraitrance", "sous_traitance"}:
        return [
            {"code": "analyse_dossier", "libelle": "Analyse du dossier", "objectif": "Décomposer le marché en ouvrages élémentaires à partir du cadre de réponse imposé."},
            {"code": "analytique", "libelle": "Sous-détail analytique", "objectif": "Calculer déboursés secs, DHMO, frais et coefficient de prix de vente."},
            {"code": "rentabilite", "libelle": "Rentabilité et bilan", "objectif": "Vérifier marges, seuil de rentabilité, achats et mise à jour des bases après chantier."},
        ]
    return [
        {"code": "qualification", "libelle": "Qualification du besoin", "objectif": "Identifier la méthode économique pertinente avant toute production."},
    ]


def _points_de_controle(clientele: str, objectif: str) -> list[str]:
    if clientele == "moa_publique":
        return [
            "Vérifier l'adéquation entre programme, enveloppe et niveau de définition.",
            "Contrôler la cohérence entre estimation par ratio, retour d'expérience et estimation consolidée.",
            "Tracer les arbitrages techniques proposés au maître d'ouvrage.",
        ]
    if clientele == "moe_conception":
        return [
            "Aligner strictement CCTP, BPU, DPGF, DQE et estimation par lot.",
            "Vérifier les normes, DTU, eurocodes, avis techniques et dispositions générales applicables.",
            "Tenir une traçabilité claire des versions, visas, observations et pièces diffusées.",
        ]
    if clientele in {"entreprise_travaux", "cotraitrance", "sous_traitance"}:
        return [
            "Décomposer chaque poste sensible en déboursés secs, équipes, temps unitaires et coefficients.",
            "Contrôler les achats en tenant compte des conditionnements réels et du coût commandé.",
            "Mesurer seuil de rentabilité, marge cible et bilan de fin d'opération.",
        ]
    return [
        "Qualifier le contexte contractuel et les livrables à produire.",
    ]


def _indicateurs_clefs(clientele: str) -> list[str]:
    if clientele == "moa_publique":
        return [
            "Taux de similarité du panel de référence",
            "Écart entre enveloppe initiale et estimation consolidée",
            "Part de coûts justifiée par données de retour d'expérience ou analytique",
        ]
    if clientele == "moe_conception":
        return [
            "Écart entre ratio, retour d'expérience et analytique",
            "Couverture des lots par prix de référence et articles CCTP",
            "Niveau de définition documentaire atteint par phase",
        ]
    if clientele in {"entreprise_travaux", "cotraitrance", "sous_traitance"}:
        return [
            "Déboursé sec unitaire et coefficient de prix de vente",
            "DHMO analytique par profil de main-d'œuvre",
            "Seuil de rentabilité et marge prévisionnelle",
        ]
    return ["Contexte à qualifier"]


def _automatismes(clientele: str, objectif: str) -> list[str]:
    automatismes = [
        "Extraction de données depuis PDF, Word et Excel pour renseigner la base projet.",
        "Classement automatique des documents générés dans la GED du projet par dossier.",
        "Lien entre bibliothèque de prix, sous-détails analytiques et bibliothèque CCTP.",
    ]
    if clientele in {"entreprise_travaux", "cotraitrance", "sous_traitance"}:
        automatismes.append("Préparation des achats fournisseurs, conditionnements et bons de commande à partir des lignes de chiffrage.")
    else:
        automatismes.append("Préparation des notes d'estimation, pièces écrites et contrôles de cohérence documentaire.")
    if objectif == "suivi_execution":
        automatismes.append("Préparation des visas, comptes rendus, réserves et dossiers de clôture.")
    return automatismes


def _wizard_etapes(clientele: str, objectif: str) -> list[dict[str, object]]:
    if clientele == "moa_publique":
        etapes = [
            _etape("cadrage", "1. Cadrage de la mission", "Qualification du programme, de l'enveloppe et des objectifs du maître d'ouvrage.", _questions_cadrage_moa()),
            _etape("donnees", "2. Données d'entrée", "Recenser les pièces disponibles pour alimenter les ratios, les retours d'expérience et l'estimation.", _questions_documentaires_communes()),
        ]
    elif clientele == "moe_conception":
        etapes = [
            _etape("cadrage", "1. Cadrage de la mission MOE", "Définir la phase, les pièces à produire et le niveau de précision attendu.", _questions_cadrage_moe()),
            _etape("donnees", "2. Base documentaire et technique", "Vérifier le programme, les plans, les quantitatifs et les références normatives.", _questions_documentaires_communes()),
        ]
    elif clientele in {"entreprise_travaux", "cotraitrance", "sous_traitance"}:
        etapes = [
            _etape("cadrage", "1. Qualification de l'affaire", "Identifier le cadre de réponse, le dossier reçu et le niveau de sous-détail attendu.", _questions_cadrage_entreprise()),
            _etape("documents", "2. Structuration documentaire", "Définir les documents sources, les pièces à générer et leur classement dans la GED projet.", _questions_documentaires_communes()),
        ]
    else:
        etapes = [
            _etape("qualification", "1. Qualification du besoin", "Déterminer la logique métier avant de lancer l'étude ou la rédaction.", _questions_autres()),
            _etape("documents", "2. Documents et livrables", "Identifier les pièces disponibles et le classement projet.", _questions_documentaires_communes()),
        ]

    if objectif in {"redaction_dce_cctp", "estimation_moe"}:
        etapes.append(
            _etape(
                "prescriptions",
                "3. Prescriptions et pièces écrites",
                "Méthode issue du manuel Descriptifs et CCTP : analyser l'ouvrage, la consistance de lot, les dispositions générales et les normes applicables.",
                [
                    _question(
                        "structure_prescriptions",
                        "Comment les prescriptions doivent-elles être structurées ?",
                        "cases",
                        [
                            _option("analyse_ouvrage", "Analyse de l'ouvrage élémentaire"),
                            _option("consistance_lot", "Consistance du lot"),
                            _option("dispositions_generales", "Dispositions générales"),
                            _option("normes_dtu", "Normes, DTU, eurocodes, avis techniques"),
                            _option("mise_en_oeuvre", "Mise en œuvre, contrôles et tolérances"),
                        ],
                        multiple=True,
                    ),
                ],
            )
        )

    if objectif in {"reponse_ao_entreprise", "devis_entreprise", "prospection_ao"}:
        etapes.append(
            _etape(
                "chiffrage",
                "3. Chiffrage analytique",
                "Méthode issue du Manuel de l'étude de prix : déboursés secs, DHMO, coefficient de prix de vente, seuil de rentabilité et bilan.",
                [
                    _question(
                        "axes_chiffrage",
                        "Quels axes analytiques doivent être renseignés ?",
                        "cases",
                        [
                            _option("debourses_secs", "Déboursés secs"),
                            _option("dhmo", "DHMO analytique / statistique"),
                            _option("coefficient_k", "Coefficient de prix de vente"),
                            _option("seuil_rentabilite", "Seuil de rentabilité"),
                            _option("budget_chantier", "Budget de chantier"),
                            _option("bilan_operation", "Bilan d'opération"),
                        ],
                        multiple=True,
                        obligatoire=True,
                    ),
                ],
            )
        )

    if objectif == "suivi_execution":
        etapes.append(
            _etape(
                "execution",
                "4. Exécution et clôture",
                "Méthode issue du Guide de la maîtrise d'œuvre travaux : visa, traçabilité, ordres de service, réception et dossier d'ouvrage.",
                [
                    _question(
                        "outils_execution",
                        "Quels outils de traçabilité faut-il préparer ?",
                        "cases",
                        [
                            _option("registre_chantier", "Registre de chantier"),
                            _option("suivi_documents", "Tableau de suivi des documents d'exécution"),
                            _option("cr_chantier", "Comptes rendus de chantier"),
                            _option("ordres_service", "Ordres de service"),
                            _option("constats", "Constats d'évènement et de mesure"),
                            _option("dossier_ouvrage", "Dossier d'ouvrage et récolement"),
                        ],
                        multiple=True,
                    ),
                ],
            )
        )

    return etapes


def _construire_chemin_dossier(document) -> str | None:
    dossier = getattr(document, "dossier", None)
    if not dossier:
        return None
    segments = [dossier.intitule]
    parent = dossier.parent
    while parent:
        segments.append(parent.intitule)
        parent = parent.parent
    return " / ".join(reversed(segments))


def _corpus_document(document) -> str:
    from applications.documents.services import normaliser_texte

    analyse = getattr(document, "analyse_automatique", {}) or {}
    classification = analyse.get("classification") if isinstance(analyse, dict) else {}
    suggestion_type = classification.get("type_document") if isinstance(classification, dict) else {}
    suggestion_actuelle = classification.get("type_document_actuel") if isinstance(classification, dict) else {}
    sources = [
        getattr(document, "reference", ""),
        getattr(document, "intitule", ""),
        getattr(document, "nom_fichier_origine", ""),
        getattr(document, "contenu_texte", "")[:12000],
        getattr(getattr(document, "type_document", None), "libelle", ""),
        suggestion_type.get("libelle", "") if isinstance(suggestion_type, dict) else "",
        suggestion_actuelle.get("libelle", "") if isinstance(suggestion_actuelle, dict) else "",
        " ".join(getattr(document, "mots_cles", []) or []),
    ]
    return normaliser_texte(" ".join(valeur for valeur in sources if valeur))


def _codes_document(document) -> set[str]:
    codes: set[str] = set()
    type_document = getattr(document, "type_document", None)
    if getattr(type_document, "code", ""):
        codes.add(type_document.code.upper())

    analyse = getattr(document, "analyse_automatique", {}) or {}
    classification = analyse.get("classification") if isinstance(analyse, dict) else {}
    if isinstance(classification, dict):
        for cle in ("type_document", "type_document_actuel"):
            suggestion = classification.get(cle)
            if isinstance(suggestion, dict) and suggestion.get("code"):
                codes.add(str(suggestion["code"]).upper())
    return codes


def _document_correspond_a_piece(document, piece: dict[str, object]) -> tuple[bool, list[str]]:
    from applications.documents.services import normaliser_texte

    raisons: list[str] = []
    codes = _codes_document(document)
    types_documents = {
        str(code).upper()
        for code in (piece.get("types_documents") or [])
        if code
    }
    intersection = sorted(codes & types_documents)
    if intersection:
        raisons.append(f"type:{', '.join(intersection)}")

    corpus = _corpus_document(document)
    for mot_cle in piece.get("mots_cles") or []:
        mot_normalise = normaliser_texte(str(mot_cle))
        if mot_normalise and mot_normalise in corpus:
            raisons.append(f"contenu:{mot_cle}")

    return bool(raisons), raisons[:6]


def construire_bilan_documentaire_projet(projet) -> dict[str, object]:
    from applications.documents.models import Document

    orientation = construire_processus_recommande(projet)
    pieces_attendues = orientation["controle_documentaire"]["pieces_attendues"]
    documents = list(
        Document.objects.filter(projet=projet, est_version_courante=True)
        .select_related("type_document", "dossier", "dossier__parent")
        .order_by("reference", "date_creation")
    )

    pieces: list[dict[str, object]] = []
    documents_couverts: set[str] = set()

    for piece in pieces_attendues:
        documents_matches: list[dict[str, object]] = []
        for document in documents:
            correspond, raisons = _document_correspond_a_piece(document, piece)
            if not correspond:
                continue
            documents_couverts.add(str(document.id))
            documents_matches.append(
                {
                    "id": str(document.id),
                    "reference": document.reference,
                    "intitule": document.intitule,
                    "type_document": getattr(document.type_document, "libelle", ""),
                    "type_document_code": getattr(document.type_document, "code", ""),
                    "dossier_chemin": _construire_chemin_dossier(document),
                    "analyse_effectuee": bool(document.analyse_automatique_effectuee),
                    "raisons_detection": raisons,
                }
            )
        pieces.append(
            {
                **piece,
                "presence": bool(documents_matches),
                "documents": documents_matches,
            }
        )

    documents_non_classes = [
        {
            "id": str(document.id),
            "reference": document.reference,
            "intitule": document.intitule,
            "type_document": getattr(document.type_document, "libelle", ""),
            "type_document_code": getattr(document.type_document, "code", ""),
            "dossier_chemin": _construire_chemin_dossier(document),
            "analyse_effectuee": bool(document.analyse_automatique_effectuee),
        }
        for document in documents
        if str(document.id) not in documents_couverts
    ]

    pieces_obligatoires = [piece for piece in pieces if piece.get("obligatoire")]
    pieces_couvertes = [piece for piece in pieces if piece["presence"]]
    pieces_manquantes = [piece for piece in pieces if piece.get("obligatoire") and not piece["presence"]]
    documents_analyses = [document for document in documents if document.analyse_automatique_effectuee]

    alertes: list[str] = []
    if pieces_manquantes:
        alertes.append(
            "Pièces obligatoires absentes : "
            + ", ".join(str(piece["intitule"]) for piece in pieces_manquantes[:5])
        )
    if documents and len(documents_analyses) < len(documents):
        alertes.append(
            f"{len(documents) - len(documents_analyses)} document(s) ne disposent pas encore d'une analyse complète."
        )

    return {
        "resume": orientation["controle_documentaire"]["resume"],
        "synthese": {
            "documents_total": len(documents),
            "documents_analyses": len(documents_analyses),
            "pieces_attendues": len(pieces),
            "pieces_obligatoires": len(pieces_obligatoires),
            "pieces_couvertes": len(pieces_couvertes),
            "pieces_manquantes": len(pieces_manquantes),
            "taux_couverture": round((len(pieces_couvertes) / len(pieces)) * 100, 1) if pieces else 0.0,
        },
        "pieces": pieces,
        "documents_non_classes": documents_non_classes,
        "alertes": alertes,
    }


def construire_processus_recommande(
    projet=None,
    *,
    clientele_cible: str | None = None,
    objectif_mission: str | None = None,
    type_projet: str | None = None,
    phase: str | None = None,
) -> dict[str, object]:
    clientele = _normaliser_clientele(projet=projet, clientele_cible=clientele_cible)
    objectif = _normaliser_objectif(projet=projet, objectif_mission=objectif_mission, clientele_cible=clientele)
    type_projet = type_projet or getattr(projet, "type_projet", "")
    phase = phase or getattr(projet, "phase_actuelle", "")

    dossiers_ged = construire_dossiers_documentaires(
        projet=projet,
        clientele_cible=clientele,
        objectif_mission=objectif,
    )
    etapes = _wizard_etapes(clientele, objectif)

    return {
        "clientele": {"code": clientele, "libelle": CLIENTELES.get(clientele, clientele)},
        "objectif": {"code": objectif, "libelle": OBJECTIFS.get(objectif, objectif)},
        "resume": "Wizard de qualification projet servant à structurer la saisie, les méthodes d'estimation, les livrables à produire et le classement GED du projet.",
        "tronc_commun": [
            "Qualifier précisément le contexte de mission avant de produire des estimations ou des pièces écrites.",
            "Tracer les hypothèses, les sources documentaires et les arbitrages retenus à l'échelle du projet.",
            "Classer systématiquement les documents générés et reçus dans la GED du projet par dossier métier.",
        ],
        "points_de_controle": _points_de_controle(clientele, objectif),
        "methodes_estimation": _methodes_estimation(clientele, objectif),
        "livrables_prioritaires": _documents_a_generer(clientele, objectif),
        "indicateurs_clefs": _indicateurs_clefs(clientele),
        "bibliotheques_a_mobiliser": [
            "Bibliothèque de prix",
            "Bibliothèque CCTP",
            "Profils et coûts de main-d'œuvre",
            "Retours d'expérience issus des documents téléversés",
        ],
        "questions_ouverture": [
            question
            for etape in etapes
            for question in etape["questions"]
        ],
        "automatismes": _automatismes(clientele, objectif),
        "assistants_generation_documentaire": _assistants_generation_documentaire(clientele, objectif),
        "sources_methodologiques": SOURCES_METHODOLOGIQUES,
        "controle_documentaire": _controle_documentaire_attendu(clientele, objectif),
        "dossiers_ged": dossiers_ged,
        "documents_attendus": _documents_attendus(clientele, objectif),
        "documents_a_generer": _documents_a_generer(clientele, objectif),
        "wizard": {
            "version": 1,
            "titre": f"Wizard projet — {CLIENTELES.get(clientele, clientele)}",
            "description": (
                "Ce wizard traduit les méthodes des guides métier en questions de cadrage, "
                "documents à collecter, livrables à produire et dossiers GED à alimenter."
            ),
            "type_projet": type_projet,
            "phase": phase,
            "etapes": etapes,
        },
    }
