"""Services de mapping manuel assisté des documents de prix."""

from __future__ import annotations

import re
from decimal import Decimal
from typing import Any

from django.db import transaction

from .models import DevisAnalyse, LignePrixMarche, ModeleMappingDocumentPrix
from .moteur_import_prix import (
    analyser_structure_ligne_prix,
    classifier_ligne,
    convertir_decimal,
    detecter_colonnes,
    nettoyer_ligne,
    parser_ligne_prix_candidate,
)
from .services import detecter_corps_etat, estimer_sdp_depuis_prix, normaliser_designation, tronquer_champ


CHAMPS_MAPPING = [
    "numero",
    "chapitre",
    "sous_chapitre",
    "designation",
    "description",
    "unite",
    "quantite",
    "prix_unitaire_ht",
    "montant_ht",
    "total_ht",
    "lot",
    "corps_etat",
    "observation",
    "ignorer",
]

SEPARATEURS_DESCRIPTION = (
    "Ce prix comprend",
    "Ce prix rémunère",
    "Y compris",
    "Comprenant",
    "La prestation comprend",
)


def _decimal_vers_json(valeur: Any) -> Any:
    if isinstance(valeur, Decimal):
        return str(valeur)
    if isinstance(valeur, list):
        return [_decimal_vers_json(item) for item in valeur]
    if isinstance(valeur, dict):
        return {cle: _decimal_vers_json(item) for cle, item in valeur.items()}
    return valeur


def _normaliser_cellule(valeur: Any) -> str:
    return nettoyer_ligne(str(valeur or ""))


def _extraire_tableaux(devis: DevisAnalyse) -> list[dict[str, Any]]:
    donnees = devis.donnees_extraction or {}
    tableaux_bruts = donnees.get("tableaux") or donnees.get("tables") or []
    tableaux: list[dict[str, Any]] = []
    if isinstance(tableaux_bruts, dict):
        tableaux_bruts = tableaux_bruts.get("resultats") or tableaux_bruts.get("tableaux") or []

    for index, tableau in enumerate(tableaux_bruts if isinstance(tableaux_bruts, list) else [], start=1):
        lignes = tableau.get("lignes") if isinstance(tableau, dict) else tableau
        if not isinstance(lignes, list):
            continue
        lignes_normalisees = [
            [_normaliser_cellule(cellule) for cellule in (ligne or [])]
            for ligne in lignes
            if isinstance(ligne, list)
        ]
        if lignes_normalisees:
            tableaux.append({
                "id": f"tableau_{index}",
                "libelle": f"Tableau détecté {index}",
                "page": tableau.get("page") if isinstance(tableau, dict) else None,
                "lignes": lignes_normalisees,
                "nb_lignes": len(lignes_normalisees),
                "nb_colonnes": max(len(ligne) for ligne in lignes_normalisees),
            })
    return tableaux


def _tableau_depuis_texte(texte: str) -> list[list[str]]:
    lignes: list[list[str]] = []
    for ligne in (texte or "").splitlines():
        propre = nettoyer_ligne(ligne)
        if not propre:
            continue
        if "\t" in propre or ";" in propre:
            cellules = re.split(r"\t|;", propre)
        else:
            cellules = re.split(r"\s{2,}", propre)
        cellules = [_normaliser_cellule(cellule) for cellule in cellules if _normaliser_cellule(cellule)]
        if len(cellules) == 1:
            cellules = [propre]
        lignes.append(cellules)
    return lignes


def _colonnes_depuis_tableau(tableau: list[list[str]]) -> dict[str, dict[str, Any]]:
    if not tableau:
        return {}
    candidates = detecter_colonnes(tableau[0])
    if len(candidates) < 3:
        for ligne in tableau[1:6]:
            detectees = detecter_colonnes(ligne)
            if len(detectees) > len(candidates):
                candidates = detectees
    alias = {
        "prix_unitaire": "prix_unitaire_ht",
        "montant": "montant_ht",
    }
    resultat: dict[str, dict[str, Any]] = {}
    for champ, index in candidates.items():
        cle = alias.get(champ, champ)
        resultat[cle] = {"index": index, "libelle": f"Colonne {chr(65 + index)}"}
    return resultat


def preparer_mapping_document(devis_id) -> dict[str, Any]:
    devis = DevisAnalyse.objects.get(pk=devis_id)
    tableaux = _extraire_tableaux(devis)
    texte = devis.texte_extrait_apercu or ""
    tableau_texte = _tableau_depuis_texte(texte)
    if tableau_texte:
        tableaux.append({
            "id": "texte_extrait",
            "libelle": "Texte extrait reconstruit",
            "page": None,
            "lignes": tableau_texte[:500],
            "nb_lignes": len(tableau_texte),
            "nb_colonnes": max(len(ligne) for ligne in tableau_texte),
        })

    premier_tableau = tableaux[0]["lignes"] if tableaux else []
    return {
        "devis": {"id": str(devis.id), "nom_original": devis.nom_original, "type_document": devis.type_document},
        "texte_extrait": texte,
        "pages": [{"numero": 1, "libelle": "Document complet"}],
        "feuilles": [],
        "tableaux": tableaux,
        "colonnes_candidates": _colonnes_depuis_tableau(premier_tableau),
        "champs_mapping": CHAMPS_MAPPING,
        "separateurs_description": SEPARATEURS_DESCRIPTION,
        "apercu_structure": {
            "nb_tableaux": len(tableaux),
            "nb_lignes_texte": len(tableau_texte),
            "methode_extraction": devis.methode_extraction,
            "score_qualite_extraction": str(devis.score_qualite_extraction),
        },
    }


def detecter_colonnes_mapping(tableau) -> dict[str, Any]:
    lignes = tableau.get("lignes") if isinstance(tableau, dict) else tableau
    if not isinstance(lignes, list):
        return {}
    return _colonnes_depuis_tableau(lignes)


def _ligne_depuis_colonnes(cellules: list[str], colonnes: dict[str, Any]) -> dict[str, str]:
    resultat: dict[str, str] = {}
    for champ in CHAMPS_MAPPING:
        config = colonnes.get(champ)
        index = config.get("index") if isinstance(config, dict) else config
        try:
            index_int = int(index)
        except (TypeError, ValueError):
            continue
        resultat[champ] = cellules[index_int] if 0 <= index_int < len(cellules) else ""
    return resultat


def _separer_description(designation: str, description: str, separateur: str = "") -> tuple[str, str]:
    texte = designation or ""
    separateurs = [separateur] if separateur else list(SEPARATEURS_DESCRIPTION)
    for sep in separateurs:
        if sep and sep.lower() in texte.lower():
            index = texte.lower().find(sep.lower())
            return nettoyer_ligne(texte[:index]), nettoyer_ligne(f"{texte[index:]} {description}")
    return nettoyer_ligne(designation), nettoyer_ligne(description)


def _est_ligne_ignoree(mapped: dict[str, str], brut: str, regles: dict[str, Any]) -> bool:
    if mapped.get("ignorer"):
        return True
    classe = classifier_ligne(brut)
    if classe == "entete_tableau" and regles.get("ignorer_entetes", True):
        return True
    if classe == "sous_total" and regles.get("ignorer_sous_totaux", True):
        return True
    if classe in {"total", "total_general"} and regles.get("ignorer_totaux", True):
        return True
    if classe in {"ligne_vide", "ligne_pointilles", "ignoree"}:
        return True
    return False


def _ligne_preview(mapped: dict[str, str], ordre: int, regles: dict[str, Any], chapitre_courant: str = "") -> dict[str, Any]:
    designation, description = _separer_description(
        mapped.get("designation", ""),
        mapped.get("description", ""),
        regles.get("separateur_description") or "",
    )
    morceaux = [
        mapped.get("numero", ""),
        mapped.get("chapitre", "") or chapitre_courant,
        designation,
        mapped.get("unite", ""),
        mapped.get("quantite", ""),
        mapped.get("prix_unitaire_ht", ""),
        mapped.get("montant_ht") or mapped.get("total_ht", ""),
    ]
    brut = nettoyer_ligne(" ".join(str(morceau or "") for morceau in morceaux))
    if _est_ligne_ignoree(mapped, brut, regles):
        return {
            "ordre": ordre,
            "numero": mapped.get("numero", ""),
            "chapitre": mapped.get("chapitre", "") or chapitre_courant,
            "designation": designation or brut,
            "description": description,
            "unite": mapped.get("unite", ""),
            "quantite": None,
            "prix_unitaire_ht": None,
            "montant_ht": None,
            "montant_recalcule_ht": None,
            "ecart_montant_ht": None,
            "type_ligne": classifier_ligne(brut),
            "statut_controle": "ignoree",
            "statut": "Ignorée",
            "capitalisable": False,
            "alertes": ["Ligne ignorée par les règles de mapping."],
            "corrections_proposees": [],
            "score_confiance": "0",
            "designation_originale": brut,
        }

    candidat = parser_ligne_prix_candidate(brut)
    structure = analyser_structure_ligne_prix(brut, {"chapitre_courant": chapitre_courant})
    quantite = convertir_decimal(mapped.get("quantite")) or (candidat.quantite if candidat else None)
    pu = convertir_decimal(mapped.get("prix_unitaire_ht")) or (candidat.prix_unitaire_ht if candidat else None)
    montant = convertir_decimal(mapped.get("montant_ht") or mapped.get("total_ht")) or (candidat.montant_ht if candidat else None)
    if quantite and montant and not pu:
        pu = (montant / quantite).quantize(Decimal("0.0001"))
    if quantite and pu and not montant:
        montant = (quantite * pu).quantize(Decimal("0.01"))
    montant_recalcule = (quantite * pu).quantize(Decimal("0.01")) if quantite and pu else None
    ecart = abs(montant_recalcule - montant.quantize(Decimal("0.01"))) if montant_recalcule is not None and montant is not None else None

    designation_finale = designation or (candidat.designation if candidat else structure.get("designation") or "")
    alertes = list(candidat.alertes if candidat else structure.get("alertes") or [])
    corrections = list(candidat.corrections_proposees if candidat else structure.get("corrections_proposees") or [])
    statut_controle = candidat.statut_controle if candidat else structure.get("statut_controle", "alerte")
    score = candidat.score_confiance if candidat else structure.get("score_confiance", Decimal("0.45"))
    if not designation_finale or not mapped.get("unite") and not (candidat and candidat.unite):
        statut_controle = "alerte"
        alertes.append("Désignation ou unité à vérifier.")
    if ecart is not None and montant is not None:
        tolerance = max(Decimal("0.05"), abs(montant) * Decimal("0.05"))
        if ecart > tolerance:
            statut_controle = "alerte"
            alertes.append("Triplet quantité / PU / montant incohérent.")
            corrections.append("Triplet quantité / PU / montant à vérifier.")

    type_ligne = candidat.type_ligne if candidat else structure.get("type_ligne", "ligne_a_verifier")
    capitalisable = bool(
        type_ligne == "article"
        and statut_controle in {"ok", "corrigee"}
        and designation_finale
        and (mapped.get("unite") or (candidat and candidat.unite))
        and pu
        and Decimal(score) >= Decimal("0.55")
    )
    statut = "OK" if capitalisable else ("À vérifier" if statut_controle == "alerte" else "Non capitalisable")

    return {
        "ordre": ordre,
        "numero": mapped.get("numero") or (candidat.numero if candidat else structure.get("numero", "")),
        "chapitre": mapped.get("chapitre") or (candidat.chapitre if candidat else structure.get("chapitre", "")) or chapitre_courant,
        "designation": designation_finale,
        "description": description,
        "unite": mapped.get("unite") or (candidat.unite if candidat else structure.get("unite", "")),
        "quantite": quantite,
        "prix_unitaire_ht": pu,
        "montant_ht": montant,
        "montant_recalcule_ht": montant_recalcule,
        "ecart_montant_ht": ecart,
        "type_ligne": type_ligne,
        "statut_controle": statut_controle,
        "statut": statut,
        "capitalisable": capitalisable,
        "alertes": alertes,
        "corrections_proposees": corrections,
        "score_confiance": score,
        "designation_originale": brut,
    }


def _lignes_source(devis: DevisAnalyse, mapping: dict[str, Any]) -> list[list[str]]:
    if isinstance(mapping.get("lignes"), list):
        return [[_normaliser_cellule(cellule) for cellule in ligne] for ligne in mapping["lignes"] if isinstance(ligne, list)]
    texte = mapping.get("texte") or ""
    if texte:
        return _tableau_depuis_texte(texte)
    tableau_id = mapping.get("tableau_id")
    for tableau in _extraire_tableaux(devis):
        if tableau["id"] == tableau_id:
            return tableau["lignes"]
    return _tableau_depuis_texte(devis.texte_extrait_apercu or "")


def appliquer_mapping_document(devis_id, mapping: dict[str, Any]) -> dict[str, Any]:
    devis = DevisAnalyse.objects.get(pk=devis_id)
    regles = mapping.get("regles") or {}
    colonnes = mapping.get("colonnes") or {}
    lignes = _lignes_source(devis, mapping)
    premiere = max(int(regles.get("premiere_ligne") or 1), 1)
    derniere = int(regles.get("derniere_ligne") or len(lignes) or 0)
    lignes = lignes[premiere - 1:derniere if derniere > 0 else None]

    previews: list[dict[str, Any]] = []
    chapitre_courant = ""
    buffer_designation = ""
    for index, cellules in enumerate(lignes, start=1):
        mapped = _ligne_depuis_colonnes(cellules, colonnes)
        brut_ligne = " ".join(cellules)
        classe = classifier_ligne(brut_ligne)
        if regles.get("utiliser_ligne_precedente_comme_chapitre") and classe == "chapitre":
            chapitre_courant = nettoyer_ligne(brut_ligne)
            continue
        if regles.get("cellules_vides_continuation_designation") and not mapped.get("designation") and cellules:
            buffer_designation = nettoyer_ligne(f"{buffer_designation} {' '.join(cellules)}")
            continue
        if buffer_designation and mapped.get("designation"):
            mapped["designation"] = nettoyer_ligne(f"{buffer_designation} {mapped['designation']}")
            buffer_designation = ""
        previews.append(_ligne_preview(mapped, index, regles, chapitre_courant))

    resume = {
        "total": len(previews),
        "ok": sum(1 for ligne in previews if ligne["capitalisable"]),
        "a_verifier": sum(1 for ligne in previews if ligne["statut_controle"] == "alerte"),
        "ignorees": sum(1 for ligne in previews if ligne["statut_controle"] == "ignoree"),
        "non_capitalisables": sum(1 for ligne in previews if not ligne["capitalisable"] and ligne["statut_controle"] != "ignoree"),
    }
    return {"lignes": _decimal_vers_json(previews), "resume": resume}


def previsualiser_mapping_document(devis_id, mapping: dict[str, Any]) -> dict[str, Any]:
    return appliquer_mapping_document(devis_id, mapping)


@transaction.atomic
def valider_mapping_document(devis_id, mapping: dict[str, Any], options: dict[str, Any] | None = None) -> dict[str, Any]:
    devis = DevisAnalyse.objects.select_for_update().get(pk=devis_id)
    options = options or {}
    resultat = appliquer_mapping_document(devis.id, mapping)
    lignes = resultat["lignes"]
    importer_corrigees = options.get("importer_corrigees", True)
    creees = 0
    ignorees = []
    for ligne in lignes:
        if ligne["statut_controle"] == "ignoree":
            ignorees.append({"ordre": ligne["ordre"], "raison": "Ligne ignorée."})
            continue
        if not ligne["capitalisable"] and not (importer_corrigees and ligne["statut_controle"] == "alerte"):
            ignorees.append({"ordre": ligne["ordre"], "raison": "Ligne non capitalisable."})
            continue
        pu = convertir_decimal(ligne.get("prix_unitaire_ht"))
        if not pu or pu <= 0:
            ignorees.append({"ordre": ligne["ordre"], "raison": "Prix unitaire manquant."})
            continue
        quantite = convertir_decimal(ligne.get("quantite")) or Decimal("1")
        montant = convertir_decimal(ligne.get("montant_ht")) or (quantite * pu).quantize(Decimal("0.01"))
        corps_code, corps_libelle = detecter_corps_etat(ligne.get("designation") or "")
        sdp = estimer_sdp_depuis_prix(pu, corps_libelle)
        LignePrixMarche.objects.create(
            devis_source=devis,
            ordre=int(ligne.get("ordre") or creees + 1),
            numero=tronquer_champ(ligne.get("numero") or "", 80),
            designation=tronquer_champ(ligne.get("designation") or "", 500),
            designation_originale=ligne.get("designation_originale") or ligne.get("designation") or "",
            designation_normalisee=tronquer_champ(normaliser_designation(ligne.get("designation") or ""), 500),
            unite=tronquer_champ(ligne.get("unite") or "U", 20),
            quantite=quantite,
            prix_ht_original=pu,
            montant_ht=montant,
            montant_recalcule_ht=convertir_decimal(ligne.get("montant_recalcule_ht")) or (quantite * pu).quantize(Decimal("0.01")),
            ecart_montant_ht=convertir_decimal(ligne.get("ecart_montant_ht")) or Decimal("0"),
            type_ligne=ligne.get("type_ligne") or "article",
            statut_controle="corrigee" if ligne.get("statut_controle") == "alerte" else "ok",
            score_confiance=convertir_decimal(ligne.get("score_confiance")) or Decimal("0.80"),
            corrections_proposees=ligne.get("corrections_proposees") or ["Ligne créée par mapping assisté."],
            donnees_import={
                "methode_extraction": "mapping_assiste",
                "mapping": mapping,
                "capitalisable": ligne.get("capitalisable"),
                "chapitre": ligne.get("chapitre"),
                "description": ligne.get("description"),
                "alertes": ligne.get("alertes") or [],
            },
            decision_import="importer",
            indice_code=devis.indice_base_code or "BT01",
            indice_valeur_base=devis.indice_base_valeur,
            localite=devis.localite or "",
            corps_etat=corps_code,
            corps_etat_libelle=corps_libelle,
            debourse_sec_estime=sdp.get("debourse_sec"),
            kpv_estime=sdp.get("kpv"),
            pct_mo_estime=sdp.get("pct_mo"),
            pct_materiaux_estime=sdp.get("pct_materiaux"),
            pct_materiel_estime=sdp.get("pct_materiel"),
        )
        creees += 1

    devis.statut = "termine" if creees else "a_verifier"
    devis.erreur_detail = "" if creees else devis.erreur_detail
    devis.message_analyse = f"{creees} ligne(s) importée(s) par mapping assisté."
    devis.nb_lignes_detectees = devis.lignes.count()
    devis.nb_lignes_a_verifier = devis.lignes.filter(statut_controle__in=["alerte", "corrigee"]).count()
    devis.methode_extraction = "mapping_assiste"
    devis.save(update_fields=[
        "statut", "erreur_detail", "message_analyse", "nb_lignes_detectees",
        "nb_lignes_a_verifier", "methode_extraction",
    ])
    return {"lignes_importees": creees, "ignorees": ignorees, "resume": resultat["resume"]}


def sauvegarder_modele_mapping(mapping: dict[str, Any]) -> ModeleMappingDocumentPrix:
    return ModeleMappingDocumentPrix.objects.create(
        nom=mapping.get("nom") or "Mapping document prix",
        type_document=mapping.get("type_document") or "",
        entreprise_source=mapping.get("entreprise_source") or "",
        colonnes_mapping=mapping.get("colonnes") or mapping.get("colonnes_mapping") or {},
        regles_nettoyage=mapping.get("regles") or mapping.get("regles_nettoyage") or {},
        regles_ignore=mapping.get("regles_ignore") or {},
        separateur_description=mapping.get("separateur_description") or (mapping.get("regles") or {}).get("separateur_description") or "",
    )
