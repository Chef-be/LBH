"""Tâches asynchrones liées aux projets."""

from __future__ import annotations

import json
import logging
import mimetypes
import os
import re
import shutil
import zipfile
from collections import Counter
from pathlib import Path
from typing import Any

from celery import shared_task
from django.utils import timezone

from applications.comptes.models import Utilisateur
from applications.documents.services import (
    extraire_mots_cles,
    importer_archive_documents,
    importer_fichier_source_dans_projet,
    intitule_document_depuis_nom_fichier,
    nettoyer_nom_document,
    suggerer_type_document,
)

from .models import PreanalyseSourcesProjet, Projet


MOTS_CLES_INFRA = ("vrd", "voirie", "assainissement", "resea", "canalis", "chauss", "terrassement", "tp", "infrastructure")
MOTS_CLES_PUBLIC = ("dce", "rc", "ccap", "marché public", "marche public", "acte d'engagement", "bpu", "dpgf", "dqe")
MOTS_CLES_CCTP = ("cctp", "clauses techniques")
journal = logging.getLogger(__name__)


def _mettre_a_jour(preanalyse: PreanalyseSourcesProjet, **champs: Any) -> None:
    for cle, valeur in champs.items():
        setattr(preanalyse, cle, valeur)
    champs.setdefault("date_modification", timezone.now())
    preanalyse.save(update_fields=list(champs.keys()))


def _lire_texte_brut(nom: str, contenu: bytes) -> str:
    extension = Path(nom).suffix.lower()
    if extension not in {".txt", ".csv", ".md", ".json"}:
        return ""
    for encodage in ("utf-8", "latin-1"):
        try:
            return contenu.decode(encodage)
        except UnicodeDecodeError:
            continue
    return ""


def _detecter_reference(noms: list[str]) -> str:
    motif = re.compile(r"\b([A-Z]{2,8}[-_/ ]?\d{2,6}(?:[-_/ ]?[A-Z0-9]{1,6}){0,3})\b")
    for nom in noms:
        candidat = motif.search(Path(nom).stem.upper())
        if candidat:
            return candidat.group(1).replace("_", "-").replace(" ", "-")
    return ""


def _determiner_nature_ouvrage(noms: list[str]) -> str:
    corpus = " ".join(noms).lower()
    if any(mot in corpus for mot in MOTS_CLES_INFRA):
        return "infrastructure"
    return "batiment"


def _determiner_nature_marche(noms: list[str], types_detectes: Counter[str]) -> str:
    corpus = " ".join(noms).lower()
    if any(mot in corpus for mot in MOTS_CLES_PUBLIC) or any(code in types_detectes for code in ("BPU", "DPGF", "DQE", "AE")):
        return "public"
    return "prive"


def _determiner_contexte_contractuel(famille_client: str, types_detectes: Counter[str], noms: list[str]) -> str:
    corpus = " ".join(noms).lower()
    if famille_client == "entreprise":
        if any(code in types_detectes for code in ("BPU", "DPGF", "DQE", "AE")) or "offre" in corpus:
            return "appel_offres"
        return "consultation_directe"
    if famille_client == "maitrise_oeuvre":
        if any(code in types_detectes for code in ("BPU", "DPGF", "DQE")):
            return "dce_consultation"
        if "offre" in corpus:
            return "analyse_offres"
        return "conception"
    if famille_client == "maitrise_ouvrage":
        return "marche_public" if any(code in types_detectes for code in ("AE", "BPU", "DPGF", "DQE")) else "consultation_directe"
    return "partenariat"


def _missions_suggerees(famille_client: str, nature_ouvrage: str, types_detectes: Counter[str], noms: list[str]) -> list[str]:
    corpus = " ".join(noms).lower()
    if famille_client == "entreprise":
        if any(code in types_detectes for code in ("BPU", "DPGF", "DQE", "AE")):
            return ["reponse_appel_offres"]
        return ["devis"]
    if famille_client == "maitrise_oeuvre":
        if nature_ouvrage == "infrastructure":
            if any(code in types_detectes for code in ("BPU", "DPGF", "DQE")) or any(mot in corpus for mot in MOTS_CLES_CCTP):
                return ["pro_infrastructure"]
            return ["avp_infrastructure"]
        if any(code in types_detectes for code in ("BPU", "DPGF", "DQE")) or any(mot in corpus for mot in MOTS_CLES_CCTP):
            return ["pro"]
        return ["aps"]
    if famille_client == "maitrise_ouvrage":
        return ["verifier_enveloppe"]
    return ["mission_generale"]


def _methode_estimation(types_detectes: Counter[str]) -> str:
    if any(code in types_detectes for code in ("BPU", "DPGF", "DQE", "NOTE_CALCUL")):
        return "analytique"
    if any(code in types_detectes for code in ("PLAN", "RAPPORT", "CCTP")):
        return "retour_experience"
    return "ratio"


def _analyse_fichier(nom_fichier: str, contenu: bytes, type_mime: str = "", source_parent: str | None = None) -> dict[str, Any]:
    texte = _lire_texte_brut(nom_fichier, contenu)
    suggestion = suggerer_type_document(nom_fichier, texte, type_mime or mimetypes.guess_type(nom_fichier)[0] or "")
    type_piece = None
    confiance = 0
    detail = ""
    if suggestion:
        type_piece = {"code": suggestion["code"], "libelle": suggestion["libelle"]}
        confiance = int(suggestion.get("score", 0))
        if suggestion.get("raisons"):
            detail = ", ".join(str(raison) for raison in suggestion["raisons"][:4])
    return {
        "nom_fichier": nom_fichier,
        "nom_affichage": intitule_document_depuis_nom_fichier(nom_fichier),
        "extension": Path(nom_fichier).suffix.lower().lstrip("."),
        "type_mime": type_mime or mimetypes.guess_type(nom_fichier)[0] or "",
        "source_parent": source_parent,
        "detail": detail,
        "confiance": confiance,
        "mots_cles": extraire_mots_cles(f"{nom_fichier} {texte}")[:8],
        "type_piece": type_piece,
    }


def _analyser_entree(path: Path) -> list[dict[str, Any]]:
    if path.suffix.lower() != ".zip":
        return [_analyse_fichier(path.name, path.read_bytes(), mimetypes.guess_type(path.name)[0] or "application/octet-stream")]

    analyses: list[dict[str, Any]] = []
    with zipfile.ZipFile(path, "r") as archive:
        for membre in archive.infolist():
            if membre.is_dir():
                continue
            nom = Path(membre.filename).name
            if not nom or nom.startswith("."):
                continue
            try:
                contenu = archive.read(membre)
            except Exception:
                continue
            analyses.append(
                _analyse_fichier(
                    nom,
                    contenu,
                    mimetypes.guess_type(nom)[0] or "application/octet-stream",
                    source_parent=path.name,
                )
            )
    return analyses


def _construire_resultat(analyses: list[dict[str, Any]], contexte: dict[str, Any]) -> dict[str, Any]:
    noms = [analyse["nom_fichier"] for analyse in analyses]
    types_detectes = Counter(
        analyse["type_piece"]["code"]
        for analyse in analyses
        if analyse.get("type_piece")
    )
    famille_client = contexte.get("famille_client") or "autre"
    nature_ouvrage = contexte.get("nature_ouvrage") or _determiner_nature_ouvrage(noms)
    nature_marche = contexte.get("nature_marche") or _determiner_nature_marche(noms, types_detectes)
    contexte_contractuel = contexte.get("contexte_contractuel") or _determiner_contexte_contractuel(famille_client, types_detectes, noms)
    intitule = ""
    for analyse in analyses:
        type_piece = analyse.get("type_piece") or {}
        if type_piece.get("code") in {"RAPPORT", "CCTP", "DQE", "DPGF", "BPU"}:
            intitule = analyse["nom_affichage"]
            break
    if not intitule and analyses:
        intitule = analyses[0]["nom_affichage"]

    return {
        "analyses": analyses,
        "resume": {
            "fichiers_analyses": len(analyses),
            "types_detectes": [
                {
                    "code": code,
                    "libelle": analyses_types_libelle(analyses, code),
                    "occurrences": occurrences,
                }
                for code, occurrences in types_detectes.most_common()
            ],
            "lignes_economiques": sum(1 for analyse in analyses if (analyse.get("type_piece") or {}).get("code") in {"BPU", "DPGF", "DQE"}),
            "nature_ouvrage": nature_ouvrage,
            "nature_marche": nature_marche,
            "contexte_contractuel": contexte_contractuel,
        },
        "pre_remplissage": {
            "donnees_entree": {
                **({"reference_consultation": _detecter_reference(noms)} if _detecter_reference(noms) else {}),
            },
            "trace": {
                "famille_client": famille_client,
                "types_detectes": dict(types_detectes),
            },
            "missions_suggerees": _missions_suggerees(famille_client, nature_ouvrage, types_detectes, noms),
            "methode_estimation": _methode_estimation(types_detectes),
            "intitule": intitule,
        },
    }


def analyses_types_libelle(analyses: list[dict[str, Any]], code: str) -> str:
    for analyse in analyses:
        type_piece = analyse.get("type_piece") or {}
        if type_piece.get("code") == code:
            return type_piece.get("libelle") or code
    return code


@shared_task(
    name="applications.projets.taches.executer_preanalyse_sources_projet",
    queue="principale",
    routing_key="principale",
)
def executer_preanalyse_sources_projet(preanalyse_id: str) -> None:
    preanalyse = PreanalyseSourcesProjet.objects.get(pk=preanalyse_id)
    _mettre_a_jour(preanalyse, statut="en_cours", progression=5, message="Analyse des pièces en cours")

    repertoire = Path(preanalyse.repertoire_temp or "")
    try:
        analyses: list[dict[str, Any]] = []
        fichiers = sorted(path for path in repertoire.iterdir() if path.is_file())
        total = max(len(fichiers), 1)
        for index, path in enumerate(fichiers, start=1):
            analyses.extend(_analyser_entree(path))
            progression = min(95, int(index / total * 90))
            _mettre_a_jour(
                preanalyse,
                progression=progression,
                message=f"Analyse de {index} fichier(s) sur {total}",
            )

        resultat = _construire_resultat(analyses, preanalyse.contexte or {})
        _mettre_a_jour(
            preanalyse,
            statut="terminee",
            progression=100,
            message="Analyse terminée",
            resultat=resultat,
            erreur="",
            date_fin=timezone.now(),
        )
    except Exception as exc:
        _mettre_a_jour(
            preanalyse,
            statut="echec",
            progression=100,
            message="Analyse impossible",
            erreur=str(exc),
            date_fin=timezone.now(),
        )
        raise
    finally:
        if repertoire.exists():
            shutil.rmtree(repertoire, ignore_errors=True)


@shared_task(
    name="applications.projets.taches.importer_sources_preanalyse_dans_projet",
    queue="documents",
    routing_key="documents",
)
def importer_sources_preanalyse_dans_projet(preanalyse_id: str, projet_id: str, utilisateur_id: str) -> None:
    preanalyse = PreanalyseSourcesProjet.objects.get(pk=preanalyse_id)
    projet = Projet.objects.get(pk=projet_id)
    utilisateur = Utilisateur.objects.get(pk=utilisateur_id)
    repertoire = Path(preanalyse.repertoire_temp or "")

    if not repertoire.exists():
        journal.warning("Répertoire de préanalyse introuvable pour %s", preanalyse_id)
        return

    try:
        for chemin in sorted(path for path in repertoire.iterdir() if path.is_file()):
            if chemin.suffix.lower() == ".zip":
                importer_archive_documents(
                    contenu_archive=chemin.read_bytes(),
                    nom_archive=chemin.name,
                    utilisateur=utilisateur,
                    projet_defaut=projet,
                )
                continue

            importer_fichier_source_dans_projet(
                projet=projet,
                utilisateur=utilisateur,
                nom_fichier=chemin.name,
                contenu=chemin.read_bytes(),
                type_mime=mimetypes.guess_type(chemin.name)[0] or "application/octet-stream",
            )
    except Exception:
        journal.exception(
            "Échec de l'import différé des sources de préanalyse %s vers le projet %s",
            preanalyse_id,
            projet_id,
        )
    finally:
        shutil.rmtree(repertoire, ignore_errors=True)


@shared_task(name="applications.projets.taches.recalculer_indicateurs", queue="principale", routing_key="principale")
def recalculer_indicateurs() -> str:
    """Tâche planifiée laissée volontairement légère tant qu'aucun recalcul dédié n'est requis."""
    return json.dumps({"detail": "Aucun recalcul spécifique à exécuter."})
