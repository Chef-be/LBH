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
    if extension == ".pdf":
        return _extraire_texte_pdf(contenu)
    if extension not in {".txt", ".csv", ".md", ".json"}:
        return ""
    for encodage in ("utf-8", "latin-1"):
        try:
            return contenu.decode(encodage)
        except UnicodeDecodeError:
            continue
    return ""


def _extraire_texte_pdf(contenu: bytes) -> str:
    """Extraction de texte brut depuis un PDF sans dépendance externe lourde."""
    try:
        import io
        texte_lignes: list[str] = []
        # Tentative d'extraction basique via pypdf si disponible
        try:
            import pypdf  # type: ignore
            lecteur = pypdf.PdfReader(io.BytesIO(contenu))
            for page in lecteur.pages[:30]:
                try:
                    texte_lignes.append(page.extract_text() or "")
                except Exception:
                    pass
            return "\n".join(texte_lignes)
        except ImportError:
            pass
        # Tentative via pdfminer si disponible
        try:
            from pdfminer.high_level import extract_text as pdfminer_extract  # type: ignore
            return pdfminer_extract(io.BytesIO(contenu))
        except ImportError:
            pass
        # Extraction brute de chaînes lisibles comme dernier recours
        texte_brut = contenu.decode("latin-1", errors="replace")
        # Extraire les chaînes de plus de 4 caractères imprimables
        chaines = re.findall(r"[\x20-\x7E\xA0-\xFF]{4,}", texte_brut)
        return " ".join(chaines[:2000])
    except Exception:
        return ""


def _champ(valeur: str, confiance: float, source: str) -> dict[str, object]:
    return {"valeur": valeur, "confiance": round(confiance, 2), "source": source}


def _champ_numerique(valeur: float, confiance: float, source: str) -> dict[str, object]:
    return {"valeur": valeur, "confiance": round(confiance, 2), "source": source}


def _extraire_champs_projet_depuis_texte(
    texte: str,
    noms_fichiers: list[str],
) -> dict[str, object]:
    """
    Applique des expressions régulières sur le texte fusionné pour extraire
    les principaux champs de la fiche projet avec un score de confiance.
    """
    champs: dict[str, object] = {}
    source_principale = noms_fichiers[0] if noms_fichiers else "fichier"

    # --- Maître d'ouvrage ---
    motif_moa = re.compile(
        r"(?:ma[iî]tre\s+d['\u2019]ouvrage|(?<!\w)MOA(?!\w)|ma[iî]trise\s+d['\u2019]ouvrage)\s*[:\-–—]?\s*([^\n\r]{3,80})",
        re.IGNORECASE,
    )
    occurrences_moa = motif_moa.findall(texte)
    if occurrences_moa:
        valeur = occurrences_moa[0].strip().rstrip(".,;")
        confiance = min(0.95, 0.65 + 0.05 * len(occurrences_moa))
        champs["maitre_ouvrage_nom"] = _champ(valeur, confiance, source_principale)

    # --- Maître d'œuvre ---
    motif_moe = re.compile(
        r"(?:ma[iî]tre\s+d['\u2019]\u0153uvre|ma[iî]tre\s+d['\u2019]oeuvre|(?<!\w)MOE(?!\w)|ma[iî]trise\s+d['\u2019]\u0153uvre)\s*[:\-–—]?\s*([^\n\r]{3,80})",
        re.IGNORECASE,
    )
    occurrences_moe = motif_moe.findall(texte)
    if occurrences_moe:
        valeur = occurrences_moe[0].strip().rstrip(".,;")
        confiance = min(0.95, 0.65 + 0.05 * len(occurrences_moe))
        champs["maitre_oeuvre_nom"] = _champ(valeur, confiance, source_principale)

    # --- Commune ---
    motif_commune = re.compile(
        r"(?:commune|ville|localit[eé]|situ[eé][e]?\s+[àa]|adresse)\s*[:\-–—]?\s*([A-ZÀ-Ÿa-zà-ÿ][a-zà-ÿA-ZÀ-Ÿ\-]+(?:\s+[A-ZÀ-Ÿa-zà-ÿ][a-zà-ÿA-ZÀ-Ÿ\-]+){0,3})",
        re.IGNORECASE,
    )
    occurrences_commune = motif_commune.findall(texte)
    if occurrences_commune:
        valeur = occurrences_commune[0].strip().rstrip(".,;")
        confiance = min(0.90, 0.55 + 0.07 * len(occurrences_commune))
        champs["commune"] = _champ(valeur, confiance, source_principale)

    # --- Département (code ou nom) ---
    motif_dept_code = re.compile(r"\b(0[1-9]|[1-9]\d|2[AB]|9[0-5]|97[1-6])\b")
    # Chercher un code postal pour en déduire le département
    motif_cp = re.compile(r"\b(0[1-9]\d{3}|[1-9]\d{4})\b")
    codes_postaux = motif_cp.findall(texte)
    if codes_postaux:
        dept = codes_postaux[0][:2]
        champs["departement"] = _champ(dept, 0.70, source_principale)
    else:
        motif_dept_texte = re.compile(
            r"(?:d[eé]partement)\s*[:\-–—]?\s*(" + motif_dept_code.pattern + r"|[A-ZÀ-Ÿ][a-zà-ÿ\-]+(?:\s+[A-ZÀ-Ÿa-zà-ÿ\-]+){0,2})",
            re.IGNORECASE,
        )
        occ_dept = motif_dept_texte.findall(texte)
        if occ_dept:
            champs["departement"] = _champ(str(occ_dept[0]).strip(), 0.55, source_principale)

    # --- Montant / budget ---
    motif_montant = re.compile(
        r"(?:montant|budget|enveloppe|estimation|travaux\s+HT|march[eé]\s+HT|MAPA)\s*[:\-–—]?\s*([\d\s.,]+)\s*(?:€|EUR|euros?|k€|M€|K€)?",
        re.IGNORECASE,
    )
    occurrences_montant = motif_montant.findall(texte)
    if occurrences_montant:
        valeur_brute = occurrences_montant[0].strip().replace("\u202f", "").replace(" ", "").replace(",", ".")
        # Gérer k€ / M€ dans le contexte autour de la valeur
        try:
            valeur_num = float(valeur_brute.replace("\xa0", ""))
            # Heuristique : si valeur < 10 000, c'est probablement en k€
            if valeur_num < 10_000 and any(k in texte[max(0, texte.find(occurrences_montant[0]) - 20):texte.find(occurrences_montant[0]) + 30].lower() for k in ("k€", "k ", "000 €")):
                valeur_num = valeur_num * 1_000
            confiance = min(0.90, 0.60 + 0.05 * len(occurrences_montant))
            champs["montant_estime"] = _champ_numerique(valeur_num, confiance, source_principale)
        except (ValueError, TypeError):
            pass

    # --- Phase ---
    PHASES_BTP = {
        "esquisse": ("esquisse", "esq"),
        "avp": ("avant-projet sommaire", "aps", "a.p.s"),
        "pro": ("avant-projet d[eé]finitif", "apd", "pro ", "a.p.d"),
        "dce": ("dossier de consultation", "dce", "d.c.e"),
        "ao": ("appel d'offres", "ao ", "a.o."),
        "exe": ("ex[eé]cution", "det ", "d.e.t", "visa "),
        "reception": ("r[eé]ception", "aor ", "a.o.r", "livraison"),
        "faisabilite": ("faisabilit[eé]", "programmation"),
    }
    texte_min = texte.lower()
    phase_detectee = ""
    confiance_phase = 0.0
    for code_phase, mots_cles in PHASES_BTP.items():
        occurrences = sum(1 for mot in mots_cles if re.search(mot, texte_min))
        if occurrences > 0:
            confiance_locale = min(0.85, 0.50 + 0.10 * occurrences)
            if confiance_locale > confiance_phase:
                confiance_phase = confiance_locale
                phase_detectee = code_phase
    if phase_detectee:
        champs["phase"] = _champ(phase_detectee, confiance_phase, source_principale)

    # --- Référence de dossier / d'affaire ---
    motif_ref = re.compile(
        r"(?:r[eé]f[eé]rence|dossier|affaire|op[eé]ration)\s*[:\-–—]?\s*([\w\-/]{3,25})",
        re.IGNORECASE,
    )
    occ_ref = motif_ref.findall(texte)
    if occ_ref:
        candidat = occ_ref[0].strip().rstrip(".,;")
        if len(candidat) >= 3:
            champs["reference"] = _champ(candidat, 0.55, source_principale)

    # --- Intitulé (depuis noms de fichiers ou titre de document) ---
    motif_titre = re.compile(
        r"(?:objet\s*(?:du\s*march[eé]|des\s*travaux|de\s*la\s*mission|de\s*l['\u2019]op[eé]ration)|intitul[eé])\s*[:\-–—]?\s*([^\n\r]{5,120})",
        re.IGNORECASE,
    )
    occ_titre = motif_titre.findall(texte)
    if occ_titre:
        valeur = occ_titre[0].strip().rstrip(".,;")
        champs["intitule"] = _champ(valeur, 0.75, source_principale)

    # --- Lots ---
    motif_lot = re.compile(
        r"[Ll]ot\s+n?[°o]?\s*(\d+)\s*[-:—\u2013]\s*([^\n\r]{3,80})",
    )
    lots_trouves = motif_lot.findall(texte)
    lots: list[dict[str, object]] = []
    vus: set[str] = set()
    for numero, intitule_lot in lots_trouves:
        cle = f"{numero}-{intitule_lot[:30].lower()}"
        if cle not in vus:
            vus.add(cle)
            lots.append({"numero": numero, "intitule": intitule_lot.strip().rstrip(".,;")})
    if lots:
        champs["lots"] = lots

    # --- Date de début ---
    motif_date = re.compile(
        r"(?:d[eé]but|d[eé]marrage|notification|lancement)\s*[:\-–—]?\s*(\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{4})",
        re.IGNORECASE,
    )
    occ_date = motif_date.findall(texte)
    if occ_date:
        champs["date_debut_prevue"] = _champ(occ_date[0], 0.60, source_principale)

    # --- Type de projet ---
    if any(mot in texte_min for mot in ("vrd", "voirie", "réseau", "assainissement", "canalisati")):
        champs["type_projet"] = _champ("travaux", 0.65, source_principale)
    elif any(mot in texte_min for mot in ("mission de ma[iî]trise", "moe", "études")):
        champs["type_projet"] = _champ("mission_moe", 0.60, source_principale)
    elif any(mot in texte_min for mot in ("travaux", "chantier", "entreprise")):
        champs["type_projet"] = _champ("travaux", 0.55, source_principale)

    return champs


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
        "_texte_brut": texte,
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

    # Agréger le texte brut de tous les fichiers pour l'extraction de champs
    texte_fusionne = "\n\n".join(
        analyse.get("_texte_brut") or ""
        for analyse in analyses
        if analyse.get("_texte_brut")
    )

    intitule = ""
    for analyse in analyses:
        type_piece = analyse.get("type_piece") or {}
        if type_piece.get("code") in {"RAPPORT", "CCTP", "DQE", "DPGF", "BPU"}:
            intitule = analyse["nom_affichage"]
            break
    if not intitule and analyses:
        intitule = analyses[0]["nom_affichage"]

    # Extraction des champs projet depuis le texte brut
    champs_extraits = _extraire_champs_projet_depuis_texte(texte_fusionne, noms)

    # Si l'intitulé a été extrait depuis le contenu, il prend la priorité sur le nom de fichier
    if "intitule" in champs_extraits:
        intitule = str(champs_extraits["intitule"].get("valeur", intitule))  # type: ignore[union-attr]

    # Nettoyer les clés internes (_texte_brut) avant de sérialiser
    analyses_serializees = [
        {cle: valeur for cle, valeur in analyse.items() if not cle.startswith("_")}
        for analyse in analyses
    ]

    return {
        "analyses": analyses_serializees,
        "texte_brut_extrait": len(texte_fusionne) > 0,
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
            "champs": champs_extraits,
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
