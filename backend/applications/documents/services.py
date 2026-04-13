"""Services d'analyse documentaire et de classification automatique."""

from __future__ import annotations

import json
import io
import hashlib
import mimetypes
import os
import re
import unicodedata
import uuid
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib import error as urllib_error
from urllib import request as urllib_request

from django.core.files.base import ContentFile
from django.utils import timezone
from django.utils.text import slugify

from applications.projets.models import Projet

from .models import DossierDocumentProjet, Document, TypeDocument


MOTS_CLES_TYPES: dict[str, tuple[str, ...]] = {
    "PLAN": (
        "plan masse",
        "plan niveau",
        "plan de situation",
        "plan d execution",
        "plan de recollement",
        "schema de principe",
        "schema unifilaire",
        "synoptique",
        "coupe",
        "facade",
        "elevation",
        "cartouche",
        "calque",
        "dxf",
        "dwg",
    ),
    "NOTE_CALCUL": ("note de calcul", "dimensionnement", "descente de charges", "justification", "calcul", "note technique"),
    "RAPPORT": (
        "rapport",
        "diagnostic",
        "expertise",
        "etude technique",
        "synthese",
        "programme",
        "notice",
        "memoire",
        "contexte",
        "presentation",
        "planning",
        "planification",
    ),
    "CCTP": ("cctp", "cahier des clauses techniques particulieres"),
    "DPGF": ("dpgf", "decomposition du prix global et forfaitaire"),
    "BPU": ("bpu", "bordereau des prix unitaires"),
    "DQE": ("dqe", "detail quantitatif estimatif"),
    "AE": ("acte d'engagement", "ae"),
    "PV_RECEPTION": ("proces verbal de reception", "pv reception", "reception des travaux"),
    "CR_CHANTIER": ("compte rendu de chantier", "cr chantier", "reunion de chantier"),
    "PHOTO": ("photo", "photographie", "image chantier"),
}

TYPES_DOCUMENTS_PAR_DEFAUT: dict[str, tuple[str, int]] = {
    "PLAN": ("Plan technique", 5),
    "RAPPORT": ("Rapport technique", 15),
    "CCTP": ("Cahier des clauses techniques particulières", 20),
    "CCAP": ("Cahier des clauses administratives particulières", 21),
    "RC": ("Règlement de consultation", 22),
    "BPU": ("Bordereau des prix unitaires", 10),
    "DPGF": ("Décomposition du prix global et forfaitaire", 11),
    "DQE": ("Détail quantitatif estimatif", 12),
    "AE": ("Acte d'engagement", 13),
    "NOTE_CALCUL": ("Note de calcul", 2),
    "PV_RECEPTION": ("Procès-verbal de réception", 30),
    "CR_CHANTIER": ("Compte rendu de chantier", 31),
    "PHOTO": ("Photographie", 40),
    "AUTRE": ("Autre document", 99),
}

REGLES_TYPES: dict[str, tuple[str, ...]] = {
    "CCTP": (r"\bcctp\b", r"clauses techniques"),
    "DPGF": (r"\bdpgf\b", r"prix global"),
    "BPU": (r"\bbpu\b", r"prix unitaires"),
    "DQE": (r"\bdqe\b", r"quantitatif estimatif"),
    "AE": (r"\bae\b", r"acte d.?engagement"),
    "PV_RECEPTION": (r"\bpv\b", r"reception"),
    "CR_CHANTIER": (r"\bcr\b", r"chantier"),
    "PLAN": (
        r"\bplan(?: de| d[' ])?(?:masse|niveau|situation|recollement|execution|implantation|rep[eé]rage)\b",
        r"\bcoupe\b",
        r"\bfacade\b",
        r"\belevation\b",
        r"\bschema(?: de principe)?\b",
        r"\bsynoptique\b",
    ),
}

REGLES_NEGATIVES_TYPES: dict[str, tuple[str, ...]] = {
    "PLAN": (
        r"\bplanning\b",
        r"\bplanification\b",
        r"\bplan d[' ]action\b",
        r"\bplan de financement\b",
        r"\bprogramme\b",
        r"\bnotice\b",
        r"\bmemoire\b",
        r"\bcontexte\b",
        r"\brapport\b",
        r"\bdiagnostic\b",
    ),
}

EXTENSIONS_IMAGES = {"png", "jpg", "jpeg", "tif", "tiff", "bmp", "webp"}
EXTENSIONS_CAO = {"dwg", "dxf"}
EXTENSIONS_BUREAUTIQUE_TEXTE = {"doc", "docx", "odt", "rtf", "txt", "md"}
EXTENSIONS_TABLEUR = {"xls", "xlsx", "xlsm", "ods", "csv"}
EXTENSIONS_BUREAUTIQUE = EXTENSIONS_BUREAUTIQUE_TEXTE | EXTENSIONS_TABLEUR
EXTENSIONS_BUREAUTIQUE_EDITABLES = {"doc", "docx", "xls", "xlsx", "xlsm", "odt", "ods"}
TOKENS_NOM_IGNORE_REFERENCE = {
    "copie",
    "copy",
    "version",
    "ver",
    "rev",
    "revision",
    "final",
    "finale",
    "def",
    "definitif",
    "definitive",
    "signed",
    "scan",
    "scanne",
    "scanned",
    "document",
    "doc",
    "fichier",
    "piece",
}


class ErreurServiceAnalyse(Exception):
    """Erreur fonctionnelle lors d'un appel à un microservice d'analyse."""


@dataclass
class SuggestionProjet:
    projet: Projet
    score: int
    raisons: list[str]


def _prefixe_plateforme() -> str:
    return (os.getenv("PREFIXE_CONTENEURS") or "lbh").strip() or "lbh"


def _construire_corps_multipart(nom_champ: str, nom_fichier: str, contenu: bytes, type_mime: str):
    delimiteur = f"{_prefixe_plateforme()}-{uuid.uuid4().hex}"
    en_tete = "\r\n".join(
        [
            f"--{delimiteur}",
            f'Content-Disposition: form-data; name="{nom_champ}"; filename="{nom_fichier}"',
            f"Content-Type: {type_mime}",
            "",
            "",
        ]
    ).encode("utf-8")
    pied = f"\r\n--{delimiteur}--\r\n".encode("utf-8")
    return delimiteur, en_tete + contenu + pied


def normaliser_texte(valeur: str) -> str:
    contenu = unicodedata.normalize("NFKD", valeur or "")
    ascii_value = contenu.encode("ascii", "ignore").decode("ascii")
    return re.sub(r"\s+", " ", ascii_value.lower()).strip()


def extraire_mots_cles(texte: str) -> list[str]:
    candidats = re.findall(r"[A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9_-]{3,}", texte or "")
    resultat: list[str] = []
    deja_vus: set[str] = set()
    for mot in candidats:
        cle = normaliser_texte(mot)
        if len(cle) < 4 or cle.isdigit() or cle in deja_vus:
            continue
        deja_vus.add(cle)
        resultat.append(cle)
        if len(resultat) >= 50:
            break
    return resultat


def appeler_service_analyse(url: str, nom_fichier: str, contenu: bytes, type_mime: str, timeout: int = 120) -> dict[str, Any]:
    delimiteur, corps = _construire_corps_multipart(
        nom_champ="fichier",
        nom_fichier=nom_fichier,
        contenu=contenu,
        type_mime=type_mime or "application/octet-stream",
    )
    requete = urllib_request.Request(
        url,
        data=corps,
        method="POST",
        headers={
            "Content-Type": f"multipart/form-data; boundary={delimiteur}",
            "Content-Length": str(len(corps)),
        },
    )
    try:
        with urllib_request.urlopen(requete, timeout=timeout) as reponse:
            return json.loads(reponse.read().decode("utf-8"))
    except urllib_error.HTTPError as exc:
        try:
            detail = json.loads(exc.read().decode("utf-8")).get("detail")
        except Exception:
            detail = None
        raise ErreurServiceAnalyse(detail or f"Erreur HTTP {exc.code} sur {url}") from exc
    except urllib_error.URLError as exc:
        raise ErreurServiceAnalyse(f"Service inaccessible : {url}") from exc


def extension_depuis_nom_fichier(nom_fichier: str) -> str:
    return nom_fichier.rsplit(".", 1)[-1].lower() if "." in nom_fichier else ""


def est_document_bureautique_editable(nom_fichier: str | None = None, type_mime: str | None = None) -> bool:
    extension = extension_depuis_nom_fichier(nom_fichier or "")
    if extension in EXTENSIONS_BUREAUTIQUE_EDITABLES:
        return True
    return (type_mime or "") in {
        "application/msword",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.oasis.opendocument.text",
        "application/vnd.oasis.opendocument.spreadsheet",
    }


def nettoyer_nom_document(nom_fichier: str, *, longueur_max: int = 180) -> str:
    stem = Path(nom_fichier).stem
    stem = unicodedata.normalize("NFKC", stem)
    stem = re.sub(r"[_\-]+", " ", stem)
    stem = re.sub(
        r"\b(?:rev(?:ision)?|indice)\s*[-_. ]*(?:v(?:ersion)?\s*)?([0-9]{1,3}|[a-c])\b",
        " ",
        stem,
        flags=re.IGNORECASE,
    )
    stem = re.sub(
        r"\bv(?:ersion)?\s*[-_. ]*([0-9]{1,3}|[a-c])\b",
        " ",
        stem,
        flags=re.IGNORECASE,
    )
    stem = re.sub(r"\b(?:finale?|definitif|definitive|copie|scan(?:ne)?|signed)\b", " ", stem, flags=re.IGNORECASE)
    stem = re.sub(r"\b20\d{2}[-_. ](?:0[1-9]|1[0-2])[-_. ](?:0[1-9]|[12]\d|3[01])\b", " ", stem)
    stem = re.sub(r"\s+", " ", stem).strip(" ._-")
    return (stem[:longueur_max].strip() or "document importe")


def _obtenir_ou_creer_type_document_standard(code: str) -> TypeDocument | None:
    type_document = TypeDocument.objects.filter(code=code).first()
    if type_document:
        return type_document

    definition = TYPES_DOCUMENTS_PAR_DEFAUT.get(code)
    if not definition:
        return None

    libelle, ordre_affichage = definition
    type_document, _ = TypeDocument.objects.get_or_create(
        code=code,
        defaults={
            "libelle": libelle,
            "ordre_affichage": ordre_affichage,
        },
    )
    return type_document


def intitule_document_depuis_nom_fichier(nom_fichier: str) -> str:
    intitule = nettoyer_nom_document(nom_fichier, longueur_max=220)
    return intitule[:1].upper() + intitule[1:] if intitule else "Document importé"


def reference_document_depuis_nom_fichier(nom_fichier: str) -> str:
    base = nettoyer_nom_document(nom_fichier, longueur_max=160)
    ascii_value = unicodedata.normalize("NFKD", base).encode("ascii", "ignore").decode("ascii")
    tokens = [
        token.upper()
        for token in re.split(r"[^A-Za-z0-9]+", ascii_value)
        if token and token.lower() not in TOKENS_NOM_IGNORE_REFERENCE
    ]
    if not tokens:
        return "DOC"
    return "-".join(tokens[:6])[:100]


def nom_stockage_document(nom_fichier: str) -> str:
    extension = Path(nom_fichier).suffix.lower()
    base = slugify(nettoyer_nom_document(nom_fichier, longueur_max=120)) or "document"
    return f"{base[:120]}{extension}"


def suggerer_type_document(nom_fichier: str, texte: str, type_mime: str) -> dict[str, Any] | None:
    corpus_nom = normaliser_texte(nom_fichier)
    corpus_texte = normaliser_texte(texte[:30000])
    corpus_total = f"{corpus_nom} {corpus_texte}".strip()
    extension = extension_depuis_nom_fichier(nom_fichier)
    meilleur: dict[str, Any] | None = None

    for code, expressions in MOTS_CLES_TYPES.items():
        score = 0
        raisons: list[str] = []
        for expression in expressions:
            expr = normaliser_texte(expression)
            if expr and expr in corpus_nom:
                score += 6
                raisons.append(f"nom:{expression}")
            if expr and expr in corpus_texte:
                score += 3
                raisons.append(f"texte:{expression}")
        if code == "PLAN":
            if extension in EXTENSIONS_CAO:
                score += 10
                raisons.append("extension-cao")
            elif extension in EXTENSIONS_IMAGES:
                score += 4
                raisons.append("extension-image")
            elif extension == "pdf":
                score += 3
                raisons.append("extension-pdf")
            if type_mime in {"image/png", "image/jpeg", "image/tiff", "image/webp"}:
                score += 4
                raisons.append("format-technique")
            if extension in EXTENSIONS_BUREAUTIQUE:
                score -= 8
                raisons.append("format-bureautique")
        if code == "PHOTO" and type_mime.startswith("image/"):
            score += 5
            raisons.append("format-image")
        if code == "PLAN" and extension in {"pdf", "dxf", "dwg"}:
            score += 2
            raisons.append("extension-technique")
        if code == "RAPPORT" and extension in EXTENSIONS_BUREAUTIQUE_TEXTE | {"pdf"}:
            score += 3
            raisons.append("format-redactionnel")
        for motif in REGLES_TYPES.get(code, ()):
            if re.search(motif, corpus_total):
                score += 4
                raisons.append(f"regle:{motif}")
        for motif in REGLES_NEGATIVES_TYPES.get(code, ()):
            if re.search(motif, corpus_total):
                score -= 5
                raisons.append(f"contre-indice:{motif}")

        if score <= 0:
            continue
        if not meilleur or score > int(meilleur["score"]):
            meilleur = {"code": code, "score": score, "raisons": raisons}

    if not meilleur:
        return None

    type_document = _obtenir_ou_creer_type_document_standard(meilleur["code"])
    if not type_document:
        return None

    return {
        "code": type_document.code,
        "libelle": type_document.libelle,
        "score": meilleur["score"],
        "raisons": meilleur["raisons"][:8],
        "objet": type_document,
    }


def _scorer_projet(projet: Projet, corpus: str) -> SuggestionProjet | None:
    score = 0
    raisons: list[str] = []
    reference = normaliser_texte(projet.reference)
    intitule = normaliser_texte(projet.intitule)
    commune = normaliser_texte(projet.commune)

    if reference and reference in corpus:
        score += 10
        raisons.append(f"référence:{projet.reference}")

    if commune and commune in corpus:
        score += 2
        raisons.append(f"commune:{projet.commune}")

    jetons = [
        jeton for jeton in re.split(r"[^a-z0-9]+", intitule)
        if len(jeton) >= 5 and jeton not in {"projet", "travaux", "mission", "etude"}
    ]
    correspondances = 0
    for jeton in jetons[:5]:
        if jeton and jeton in corpus:
            correspondances += 1
    if correspondances:
        score += min(6, correspondances * 2)
        raisons.append(f"intitulé:{correspondances} mot(s)")

    if score < 4:
        return None
    return SuggestionProjet(projet=projet, score=score, raisons=raisons)


def suggerer_projet(corpus_sources: list[str]) -> dict[str, Any] | None:
    corpus = normaliser_texte(" ".join(source for source in corpus_sources if source))
    if not corpus:
        return None

    suggestions = [
        suggestion
        for suggestion in (
            _scorer_projet(projet, corpus)
            for projet in Projet.objects.only("id", "reference", "intitule", "commune")
        )
        if suggestion
    ]
    if not suggestions:
        return None

    suggestions.sort(key=lambda item: item.score, reverse=True)
    meilleure = suggestions[0]
    if meilleure.score < 6:
        return None

    return {
        "id": str(meilleure.projet_id if hasattr(meilleure, "projet_id") else meilleure.projet.id),
        "reference": meilleure.projet.reference,
        "intitule": meilleure.projet.intitule,
        "score": meilleure.score,
        "raisons": meilleure.raisons,
        "objet": meilleure.projet,
    }


def inferer_projet_initial(reference: str, intitule: str, nom_fichier: str) -> Projet | None:
    suggestion = suggerer_projet([reference, intitule, nom_fichier])
    if not suggestion or suggestion["score"] < 8:
        return None
    return suggestion["objet"]


def obtenir_projet_unique() -> Projet | None:
    """Retourne le seul projet existant quand il n'y en a qu'un."""
    projets = list(Projet.objects.only("id")[:2])
    if len(projets) == 1:
        return projets[0]
    return None


def extraire_suggestions_document(document: Document) -> dict[str, Any]:
    analyse = document.analyse_automatique or {}
    classification = analyse.get("classification") if isinstance(analyse, dict) else {}
    suggestions = analyse.get("suggestions") if isinstance(analyse, dict) else {}

    reponse: dict[str, Any] = {}

    if isinstance(classification, dict) and isinstance(classification.get("type_document"), dict):
        suggestion_type = classification["type_document"]
        reponse["type_document"] = {
            "code": suggestion_type.get("code"),
            "libelle": suggestion_type.get("libelle"),
            "score": suggestion_type.get("score"),
            "raisons": suggestion_type.get("raisons") or [],
            "applicable": bool(
                suggestion_type.get("code")
                and getattr(document.type_document, "code", None) != suggestion_type.get("code")
            ),
        }

    if isinstance(suggestions, dict) and isinstance(suggestions.get("projet"), dict):
        suggestion_projet = suggestions["projet"]
        reponse["projet"] = {
            "id": suggestion_projet.get("id"),
            "reference": suggestion_projet.get("reference"),
            "intitule": suggestion_projet.get("intitule"),
            "score": suggestion_projet.get("score"),
            "raisons": suggestion_projet.get("raisons") or [],
            "applicable": bool(
                suggestion_projet.get("id")
                and str(document.projet_id) != str(suggestion_projet.get("id"))
            ),
        }

    return reponse


def previsualiser_suggestions_document(document: Document) -> dict[str, Any]:
    suggestions = extraire_suggestions_document(document)
    previsualisation = {
        "id": str(document.id),
        "reference": document.reference,
        "intitule": document.intitule,
        "actuel": {
            "type_document": {
                "code": getattr(document.type_document, "code", ""),
                "libelle": getattr(document.type_document, "libelle", ""),
            },
            "projet": {
                "id": str(document.projet_id) if document.projet_id else None,
                "reference": document.projet.reference if document.projet_id else "",
                "intitule": document.projet.intitule if document.projet_id else "",
            },
        },
        "suggere": {},
        "changements": [],
    }

    suggestion_type = suggestions.get("type_document")
    if suggestion_type:
        previsualisation["suggere"]["type_document"] = suggestion_type
        if suggestion_type.get("applicable"):
            previsualisation["changements"].append(
                f"Type : {getattr(document.type_document, 'libelle', '—')} -> {suggestion_type.get('libelle', '—')}"
            )

    suggestion_projet = suggestions.get("projet")
    if suggestion_projet:
        previsualisation["suggere"]["projet"] = suggestion_projet
        if suggestion_projet.get("applicable"):
            reference_actuelle = document.projet.reference if document.projet_id else "—"
            reference_suggeree = suggestion_projet.get("reference", "—")
            previsualisation["changements"].append(
                f"Projet : {reference_actuelle} -> {reference_suggeree}"
            )

    return previsualisation


def appliquer_suggestions_document(document: Document) -> dict[str, Any]:
    suggestions = extraire_suggestions_document(document)
    changements: dict[str, Any] = {}
    update_fields: list[str] = []

    suggestion_type = suggestions.get("type_document")
    if suggestion_type and suggestion_type.get("applicable"):
        type_document = TypeDocument.objects.filter(code=suggestion_type["code"]).first()
        if type_document:
            document.type_document = type_document
            update_fields.append("type_document")
            changements["type_document"] = {
                "code": type_document.code,
                "libelle": type_document.libelle,
            }

    suggestion_projet = suggestions.get("projet")
    if suggestion_projet and suggestion_projet.get("applicable"):
        projet = Projet.objects.filter(pk=suggestion_projet["id"]).first()
        if projet:
            document.projet = projet
            update_fields.append("projet")
            changements["projet"] = {
                "id": str(projet.id),
                "reference": projet.reference,
                "intitule": projet.intitule,
            }

    if update_fields:
        document.save(update_fields=update_fields)

    return changements


def generer_resume_analyse_pdf(resultat: dict[str, Any]) -> dict[str, Any]:
    metadonnees = resultat.get("metadonnees") or {}
    return {
        "titre": metadonnees.get("titre", ""),
        "auteur": metadonnees.get("auteur", ""),
        "sujet": metadonnees.get("sujet", ""),
        "createur": metadonnees.get("createur", ""),
        "nb_pages": metadonnees.get("nb_pages", 0),
        "taille_octets": metadonnees.get("taille_octets", 0),
        "nb_tableaux": resultat.get("nb_tableaux", 0),
        "nb_images": resultat.get("nb_images", 0),
    }


def analyser_document_automatiquement(document: Document, forcer: bool = False) -> dict[str, Any]:
    if not document.fichier:
        raise ErreurServiceAnalyse("Aucun fichier n'est rattaché à ce document.")

    if document.analyse_automatique_effectuee and not forcer:
        return document.analyse_automatique or {}

    with document.fichier.open("rb") as fichier:
        contenu = fichier.read()

    nom_fichier = document.nom_fichier_origine or os.path.basename(document.fichier.name) or "document"
    type_mime = document.type_mime or "application/octet-stream"
    extension = nom_fichier.rsplit(".", 1)[-1].lower() if "." in nom_fichier else ""

    analyse: dict[str, Any] = {
        "statut": "terminee",
        "horodatage": timezone.now().isoformat(),
        "services": {},
        "classification": {},
        "suggestions": {},
        "erreurs": [],
    }

    texte_extrait = document.contenu_texte or ""
    ocr_effectue = document.ocr_effectue

    if type_mime == "application/pdf" or extension == "pdf":
        prefixe = _prefixe_plateforme()
        url_pdf = f"http://{os.getenv('ANALYSE_PDF_HOTE', f'{prefixe}-analyse-pdf')}:{os.getenv('ANALYSE_PDF_PORT', '8011')}/pdf/analyser"
        try:
            resultat_pdf = appeler_service_analyse(url_pdf, nom_fichier, contenu, type_mime)
            analyse["services"]["pdf"] = generer_resume_analyse_pdf(resultat_pdf)
            texte_pdf = (resultat_pdf.get("texte_brut") or "").strip()
            if texte_pdf and len(texte_pdf) > len(texte_extrait):
                texte_extrait = texte_pdf
        except ErreurServiceAnalyse as exc:
            analyse["erreurs"].append({"service": "pdf", "detail": str(exc)})

    if extension == "dxf" or "dxf" in type_mime or extension == "dwg":
        prefixe = _prefixe_plateforme()
        url_cao = f"http://{os.getenv('ANALYSE_CAO_HOTE', f'{prefixe}-analyse-cao')}:{os.getenv('ANALYSE_CAO_PORT', '8012')}/cao/analyser"
        try:
            resultat_cao = appeler_service_analyse(url_cao, nom_fichier, contenu, type_mime)
            analyse["services"]["cao"] = {
                "format": resultat_cao.get("format"),
                "version_dxf": resultat_cao.get("version_dxf"),
                "nb_calques": resultat_cao.get("nb_calques", 0),
                "calques": (resultat_cao.get("calques") or [])[:20],
                "nb_entites": resultat_cao.get("nb_entites", 0),
                "emprise": resultat_cao.get("emprise"),
            }
        except ErreurServiceAnalyse as exc:
            analyse["erreurs"].append({"service": "cao", "detail": str(exc)})

    if not texte_extrait and (
        type_mime in {"application/pdf", "image/png", "image/jpeg", "image/tiff", "image/bmp", "image/webp"}
        or extension in {"pdf", "png", "jpg", "jpeg", "tif", "tiff", "bmp", "webp"}
    ):
        prefixe = _prefixe_plateforme()
        url_ocr = f"http://{os.getenv('OCR_HOTE', f'{prefixe}-ocr')}:{os.getenv('OCR_PORT', '8010')}/ocr/extraire"
        try:
            resultat_ocr = appeler_service_analyse(url_ocr, nom_fichier, contenu, type_mime)
            texte_ocr = (resultat_ocr.get("texte") or "").strip()
            if texte_ocr:
                texte_extrait = texte_ocr
                ocr_effectue = True
            analyse["services"]["ocr"] = {
                "pages": resultat_ocr.get("pages", 0),
                "confiance": resultat_ocr.get("confiance", 0),
                "caracteres": len(texte_ocr),
            }
        except ErreurServiceAnalyse as exc:
            analyse["erreurs"].append({"service": "ocr", "detail": str(exc)})

    suggestion_type = suggerer_type_document(nom_fichier, texte_extrait, type_mime)
    if suggestion_type:
        analyse["classification"]["type_document"] = {
            "code": suggestion_type["code"],
            "libelle": suggestion_type["libelle"],
            "score": suggestion_type["score"],
            "raisons": suggestion_type["raisons"],
        }

    suggestion_projet = suggerer_projet(
        [
            document.reference,
            document.intitule,
            nom_fichier,
            texte_extrait[:20000],
        ]
    )
    if suggestion_projet:
        analyse["suggestions"]["projet"] = {
            "id": suggestion_projet["id"],
            "reference": suggestion_projet["reference"],
            "intitule": suggestion_projet["intitule"],
            "score": suggestion_projet["score"],
            "raisons": suggestion_projet["raisons"],
            "correspond_au_document": suggestion_projet["id"] == str(document.projet_id),
        }

    type_document = document.type_document
    type_applique = False
    if suggestion_type and (not type_document or type_document.code == "AUTRE"):
        type_document = suggestion_type["objet"]
        type_applique = True

    metadonnees = analyse.setdefault("metadonnees", {})
    metadonnees["nom_fichier"] = nom_fichier
    metadonnees["type_mime"] = type_mime
    metadonnees["taille_octets"] = len(contenu)

    document.type_document = type_document
    document.ocr_effectue = ocr_effectue
    document.contenu_texte = (texte_extrait or "")[:100000]
    document.mots_cles = extraire_mots_cles(document.contenu_texte)
    document.analyse_automatique_effectuee = True
    document.date_analyse_automatique = timezone.now()
    analyse["classification"]["type_applique"] = type_applique
    analyse["classification"]["type_document_actuel"] = {
        "code": document.type_document.code,
        "libelle": document.type_document.libelle,
    }
    document.analyse_automatique = analyse
    document.save(
        update_fields=[
            "type_document",
            "ocr_effectue",
            "contenu_texte",
            "mots_cles",
            "analyse_automatique_effectuee",
            "date_analyse_automatique",
            "analyse_automatique",
        ]
    )
    return analyse


def _version_depuis_nom_fichier(nom_fichier: str) -> str | None:
    stem = Path(nom_fichier).stem
    motifs = (
        r"(?:^|[-_\s])(v(?:ersion)?)[-_ ]?([0-9]{1,2}|[a-z])(?:$|[-_\s])",
        r"(?:^|[-_\s])(?:indice|rev|revision)[-_ ]?([0-9]{1,2}|[a-z])(?:$|[-_\s])",
    )
    for motif in motifs:
        correspondance = re.search(motif, stem, flags=re.IGNORECASE)
        if correspondance:
            groupe = correspondance.groups()[-1]
            return str(groupe).upper()
    return None


def _reference_depuis_nom_fichier(nom_fichier: str) -> str:
    return reference_document_depuis_nom_fichier(nom_fichier)


def _intitule_depuis_nom_fichier(nom_fichier: str) -> str:
    return intitule_document_depuis_nom_fichier(nom_fichier)


def _prochaine_version_pour_reference(projet: Projet, reference: str) -> tuple[str, Document | None]:
    documents = list(
        Document.objects.filter(projet=projet, reference=reference)
        .order_by("-date_modification")
    )
    if not documents:
        return "A", None

    parent = next((doc for doc in documents if doc.est_version_courante), documents[0])
    version_parent = parent.version or "A"
    if version_parent.isalpha() and len(version_parent) == 1:
        return chr(min(ord(version_parent.upper()) + 1, ord("Z"))), parent
    if version_parent.isdigit():
        return str(int(version_parent) + 1), parent
    return f"{version_parent}-1", parent


def importer_archive_documents(
    contenu_archive: bytes,
    nom_archive: str,
    utilisateur,
    projet_defaut: Projet | None = None,
) -> dict[str, Any]:
    try:
        archive = zipfile.ZipFile(io.BytesIO(contenu_archive))
    except Exception as exc:
        raise ErreurServiceAnalyse("Seules les archives ZIP sont actuellement prises en charge.") from exc

    total = 0
    importes = 0
    erreurs: list[dict[str, str]] = []
    details: list[dict[str, Any]] = []
    projet_unique = obtenir_projet_unique() if projet_defaut is None else None

    with archive:
        for membre in archive.infolist():
            if membre.is_dir():
                continue
            nom_membre = Path(membre.filename).name
            if not nom_membre or nom_membre.startswith("."):
                continue

            total += 1
            try:
                contenu = archive.read(membre)
                intitule = _intitule_depuis_nom_fichier(nom_membre)
                reference = _reference_depuis_nom_fichier(nom_membre)
                version = _version_depuis_nom_fichier(nom_membre)
                projet = projet_defaut or inferer_projet_initial(
                    reference=reference,
                    intitule=intitule,
                    nom_fichier=nom_membre,
                ) or projet_unique
                if not projet:
                    raise ErreurServiceAnalyse(
                        f"Aucun projet détecté pour « {nom_membre} ». Sélectionnez un projet par défaut."
                    )

                if not version:
                    version, parent = _prochaine_version_pour_reference(projet, reference)
                else:
                    parent = Document.objects.filter(
                        projet=projet,
                        reference=reference,
                        est_version_courante=True,
                    ).first()

                if parent:
                    Document.objects.filter(projet=projet, reference=reference).update(est_version_courante=False)

                type_document = TypeDocument.objects.filter(code="AUTRE").first() or TypeDocument.objects.order_by("ordre_affichage").first()
                if not type_document:
                    raise ErreurServiceAnalyse("Aucun type de document n'est configuré.")

                dossier_cible = determiner_dossier_cible_document(
                    projet,
                    type_document_code=type_document.code,
                    contexte_generation="document-importe",
                )
                dossier = obtenir_ou_creer_dossier_document(
                    projet,
                    dossier_cible["code"],
                    parent_code=dossier_cible.get("parent_code"),
                    intitule=dossier_cible["intitule"],
                    parent_intitule=dossier_cible.get("parent_intitule"),
                )

                mime = {
                    ".pdf": "application/pdf",
                    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    ".doc": "application/msword",
                    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    ".xls": "application/vnd.ms-excel",
                    ".png": "image/png",
                    ".jpg": "image/jpeg",
                    ".jpeg": "image/jpeg",
                }.get(Path(nom_membre).suffix.lower(), "application/octet-stream")

                document = Document.objects.create(
                    reference=reference,
                    intitule=intitule,
                    type_document=type_document,
                    projet=projet,
                    dossier=dossier,
                    version=version,
                    est_version_courante=True,
                    document_parent=parent,
                    statut="brouillon",
                    origine="recu",
                    auteur=utilisateur,
                    nom_fichier_origine=nom_membre,
                    taille_octets=len(contenu),
                    type_mime=mime,
                )
                nom_stockage = nom_stockage_document(nom_membre)
                document.fichier.save(
                    nom_stockage,
                    ContentFile(contenu, name=nom_stockage),
                    save=False,
                )
                document.save(update_fields=[
                    "fichier",
                    "nom_fichier_origine",
                    "taille_octets",
                    "type_mime",
                ])
                analyser_document_automatiquement(document)
                reclasser_document_dans_ged(document, contexte_generation="document-importe", forcer=True)
                importes += 1
                details.append(
                    {
                        "id": str(document.id),
                        "reference": document.reference,
                        "intitule": document.intitule,
                        "projet_reference": document.projet.reference,
                        "version": document.version,
                        "type_document": document.type_document.libelle,
                    }
                )
            except Exception as exc:
                erreurs.append({"fichier": nom_membre, "detail": str(exc)})

    return {
        "archive": nom_archive,
        "total_fichiers": total,
        "importes": importes,
        "erreurs": erreurs,
        "documents": details,
    }


def importer_fichier_source_dans_projet(
    *,
    projet: Projet,
    utilisateur,
    nom_fichier: str,
    contenu: bytes,
    type_mime: str = "",
) -> Document:
    intitule = _intitule_depuis_nom_fichier(nom_fichier)
    reference = _reference_depuis_nom_fichier(nom_fichier)
    version = _version_depuis_nom_fichier(nom_fichier)

    if not version:
        version, parent = _prochaine_version_pour_reference(projet, reference)
    else:
        parent = Document.objects.filter(
            projet=projet,
            reference=reference,
            est_version_courante=True,
        ).first()

    if parent:
        Document.objects.filter(projet=projet, reference=reference).update(est_version_courante=False)

    type_document = TypeDocument.objects.filter(code="AUTRE").first() or TypeDocument.objects.order_by("ordre_affichage").first()
    if not type_document:
        raise ErreurServiceAnalyse("Aucun type de document n'est configuré.")

    dossier_cible = determiner_dossier_cible_document(
        projet,
        type_document_code=type_document.code,
        contexte_generation="document-importe",
    )
    dossier = obtenir_ou_creer_dossier_document(
        projet,
        dossier_cible["code"],
        parent_code=dossier_cible.get("parent_code"),
        intitule=dossier_cible["intitule"],
        parent_intitule=dossier_cible.get("parent_intitule"),
    )

    type_mime_effectif = type_mime or mimetypes.guess_type(nom_fichier)[0] or "application/octet-stream"
    document = Document.objects.create(
        reference=reference,
        intitule=intitule,
        type_document=type_document,
        projet=projet,
        dossier=dossier,
        version=version,
        est_version_courante=True,
        document_parent=parent,
        statut="brouillon",
        origine="recu",
        auteur=utilisateur,
        nom_fichier_origine=nom_fichier,
        taille_octets=len(contenu),
        type_mime=type_mime_effectif,
    )
    nom_stockage = nom_stockage_document(nom_fichier)
    document.fichier.save(
        nom_stockage,
        ContentFile(contenu, name=nom_stockage),
        save=False,
    )
    document.save(update_fields=[
        "fichier",
        "nom_fichier_origine",
        "taille_octets",
        "type_mime",
    ])
    analyser_document_automatiquement(document)
    reclasser_document_dans_ged(document, contexte_generation="document-importe", forcer=True)
    return document


def synchroniser_dossiers_projet(projet: Projet) -> list[DossierDocumentProjet]:
    from applications.projets.services import construire_dossiers_documentaires

    dossiers_crees: list[DossierDocumentProjet] = []
    index_instances: dict[str, DossierDocumentProjet] = {}

    for dossier in construire_dossiers_documentaires(projet=projet):
        parent = None
        parent_code = dossier.get("parent_code")
        if parent_code:
            parent = index_instances.get(str(parent_code))
            if not parent:
                parent = DossierDocumentProjet.objects.filter(
                    projet=projet,
                    code=parent_code,
                ).first()
        instance, _ = DossierDocumentProjet.objects.update_or_create(
            projet=projet,
            parent=parent,
            code=dossier["code"],
            defaults={
                "intitule": dossier["intitule"],
                "description": dossier.get("description", ""),
                "ordre": dossier.get("ordre", 100),
                "est_systeme": bool(dossier.get("est_systeme", True)),
            },
        )
        index_instances[str(dossier["code"])] = instance
        dossiers_crees.append(instance)
    return dossiers_crees


def obtenir_ou_creer_dossier_document(
    projet: Projet,
    code: str,
    *,
    parent_code: str | None = None,
    intitule: str | None = None,
    parent_intitule: str | None = None,
    description: str = "",
    ordre: int = 100,
    est_systeme: bool = True,
) -> DossierDocumentProjet:
    synchroniser_dossiers_projet(projet)
    parent = None
    if parent_code:
        parent = DossierDocumentProjet.objects.filter(projet=projet, code=parent_code).first()
        if not parent:
            parent = obtenir_ou_creer_dossier_document(
                projet,
                parent_code,
                intitule=parent_intitule or parent_code.replace("-", " ").capitalize(),
                ordre=max(1, ordre - 1),
                est_systeme=True,
            )
    dossier = DossierDocumentProjet.objects.filter(projet=projet, code=code, parent=parent).first()
    if dossier:
        return dossier
    dossier, _ = DossierDocumentProjet.objects.get_or_create(
        projet=projet,
        parent=parent,
        code=code,
        defaults={
            "intitule": intitule or code.replace("-", " ").capitalize(),
            "description": description,
            "ordre": ordre,
            "est_systeme": est_systeme,
        },
    )
    return dossier


def reclasser_document_dans_ged(
    document: Document,
    *,
    contexte_generation: str = "document-importe",
    forcer: bool = False,
) -> Document:
    if not document.projet_id:
        return document
    if document.dossier_id and not forcer:
        return document

    dossier_cible = determiner_dossier_cible_document(
        document.projet,
        type_document_code=getattr(document.type_document, "code", ""),
        contexte_generation=contexte_generation,
    )
    dossier = obtenir_ou_creer_dossier_document(
        document.projet,
        dossier_cible["code"],
        parent_code=dossier_cible.get("parent_code"),
        intitule=dossier_cible["intitule"],
        parent_intitule=dossier_cible.get("parent_intitule"),
    )
    if document.dossier_id != dossier.id:
        document.dossier = dossier
        document.save(update_fields=["dossier"])
    return document


def _obtenir_ou_creer_type_document_genere(code: str, libelle: str) -> TypeDocument:
    type_document, _ = TypeDocument.objects.get_or_create(
        code=code,
        defaults={
            "libelle": libelle,
            "ordre_affichage": 50,
        },
    )
    return type_document


def determiner_dossier_cible_document(
    projet: Projet,
    *,
    type_document_code: str,
    contexte_generation: str = "",
) -> dict[str, str]:
    clientele = getattr(projet, "clientele_cible", "")
    code_normalise = (type_document_code or "").upper()
    contexte = (contexte_generation or "").lower()

    if clientele in {"entreprise_travaux", "cotraitrance", "sous_traitance"}:
        if code_normalise in {"BPU", "DPGF", "DQE", "AE", "MEMOIRE_TECHNIQUE", "LETTRE_CANDIDATURE"}:
            if code_normalise in {"MEMOIRE_TECHNIQUE", "LETTRE_CANDIDATURE"}:
                return {
                    "code": "memoire-technique",
                    "intitule": "6.2 - Mémoire technique",
                    "parent_code": "offre-et-memoire",
                    "parent_intitule": "06 - Offre et mémoire",
                }
            return {
                "code": "offre-financiere",
                "intitule": "6.1 - Offre financière",
                "parent_code": "offre-et-memoire",
                "parent_intitule": "06 - Offre et mémoire",
            }
        if code_normalise in {"CCTP", "RAPPORT", "NOTE_CALCUL"} or "chiffrage" in contexte:
            return {
                "code": "sous-details-analytiques",
                "intitule": "4.1 - Sous-détails analytiques",
                "parent_code": "chiffrage-sous-details",
                "parent_intitule": "04 - Chiffrage et sous-détails",
            }
        if "commande" in contexte:
            return {
                "code": "bons-commande",
                "intitule": "5.2 - Bons de commande",
                "parent_code": "achats-fournisseurs",
                "parent_intitule": "05 - Achats fournisseurs",
            }
        return {
            "code": "imports-bruts",
            "intitule": "3.1 - Imports bruts",
            "parent_code": "quantitatifs-imports",
            "parent_intitule": "03 - Quantitatifs et imports",
        }

    if code_normalise in {"CCTP", "BPU", "DPGF", "DQE", "CCAP", "RC", "AE"}:
        if code_normalise == "CCTP":
            return {
                "code": "cctp-lot",
                "intitule": "4.1 - CCTP par lot",
                "parent_code": "pieces-ecrites-dce",
                "parent_intitule": "04 - Pièces écrites et DCE",
            }
        if code_normalise in {"CCAP", "RC", "AE"}:
            return {
                "code": "pieces-administratives",
                "intitule": "4.3 - Pièces administratives",
                "parent_code": "pieces-ecrites-dce",
                "parent_intitule": "04 - Pièces écrites et DCE",
            }
        return {
            "code": "bordereaux-prix",
            "intitule": "4.2 - BPU / DPGF / DQE",
            "parent_code": "pieces-ecrites-dce",
            "parent_intitule": "04 - Pièces écrites et DCE",
        }
    if code_normalise in {"RAPPORT", "NOTE_CALCUL"} or "estimation" in contexte:
        return {
            "code": "estimations-analytiques",
            "intitule": "3.3 - Estimations analytiques",
            "parent_code": "estimations-economie",
            "parent_intitule": "03 - Estimations et économie",
        }
    if "reception" in contexte or "aor" in contexte:
        return {
            "code": "opr-reserves",
            "intitule": "7.1 - OPR et réserves",
            "parent_code": "reception-cloture",
            "parent_intitule": "07 - Réception et clôture",
        }
    return {
        "code": "notes-client",
        "intitule": "8.1 - Notes et rapports",
        "parent_code": "livrables-client",
        "parent_intitule": "08 - Livrables client",
    }


def enregistrer_document_genere_projet(
    *,
    projet: Projet,
    reference: str,
    intitule: str,
    type_document_code: str,
    type_document_libelle: str,
    auteur,
    contenu: bytes,
    nom_fichier: str,
    type_mime: str,
    document_existant: Document | None = None,
    statut: str = "brouillon",
    contexte_generation: str = "",
    confidentiel: bool = False,
) -> Document:
    type_document = _obtenir_ou_creer_type_document_genere(type_document_code, type_document_libelle)
    dossier_cible = determiner_dossier_cible_document(
        projet,
        type_document_code=type_document_code,
        contexte_generation=contexte_generation,
    )
    dossier = obtenir_ou_creer_dossier_document(
        projet,
        dossier_cible["code"],
        parent_code=dossier_cible.get("parent_code"),
        intitule=dossier_cible["intitule"],
        parent_intitule=dossier_cible.get("parent_intitule"),
    )

    document = document_existant or Document(
        projet=projet,
        auteur=auteur,
        origine="genere",
        version="A",
        est_version_courante=True,
    )
    document.reference = reference
    document.intitule = intitule
    document.type_document = type_document
    document.dossier = dossier
    document.statut = statut
    document.confidentiel = confidentiel
    document.nom_fichier_origine = nom_fichier
    document.taille_octets = len(contenu)
    document.type_mime = type_mime
    document.empreinte_sha256 = hashlib.sha256(contenu).hexdigest()
    document.fichier.save(
        str(Path("documents_generes") / nom_fichier),
        ContentFile(contenu, name=nom_fichier),
        save=False,
    )
    document.save()
    return document
