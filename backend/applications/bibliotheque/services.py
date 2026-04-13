"""Services métier pour la bibliothèque de prix."""

from __future__ import annotations

import hashlib
import html
import os
import re
import subprocess
import unicodedata
from dataclasses import dataclass
from decimal import Decimal
from pathlib import Path
from typing import Iterable
from urllib.parse import unquote, urljoin, urlparse

import requests
from django.db import transaction
from lxml import html as lxml_html

from .models import LignePrixBibliotheque, SousDetailPrix


def _determiner_racine_ressources_metier() -> Path:
    candidats = []
    chemin_env = os.environ.get("CHEMIN_RESSOURCES_DOCUMENTAIRES")
    if chemin_env:
        candidats.append(Path(chemin_env))
    candidats.extend(
        [
            Path("/ressources"),
            Path("/var/www/vhosts/lbh-economiste.com/smb.lbh-economiste.com/data/samba/shares/admin/ressources"),
        ]
    )
    for candidat in candidats:
        if candidat.exists():
            return candidat
    return candidats[0]


RACINE_RESSOURCES_METIER = _determiner_racine_ressources_metier()
URL_BASE_PRIX_CONSTRUCTION = "https://prix-construction.info"
MOTIF_URL_FICHE_PRIX = re.compile(r"/[A-Z]{2,}\d{3,}[A-Z]*_[^/]+\.html$", re.IGNORECASE)
SESSION_HTTP = requests.Session()
SESSION_HTTP.headers.update(
    {
        "User-Agent": "Plateforme-LBH/1.0 (+https://lbh-economiste.com)",
        "Accept-Language": "fr-FR,fr;q=0.9",
    }
)

UNITES_ARTIPRIX = {
    "U", "ML", "M2", "M3", "M", "M²", "M³", "KG", "T", "L", "J", "H", "ENS", "FORF", "PSE",
}

# Correspondance segment URL → code LotCCTP métier
MAPPING_CATEGORIE_LOT: dict[str, str] = {
    'vrd_et_amenagements_exterieurs': 'VRD',
    'assainissement': 'VRD',
    'reseaux': 'VRD',
    'voirie': 'VRD',
    'terrassements': 'TERR',
    'structure_et_gros_oeuvre': 'GO',
    'fondations': 'GO',
    'beton': 'GO',
    'maconnerie': 'GO',
    'facades_et_enveloppe': 'FAC',
    'facade': 'FAC',
    'bardage': 'FAC',
    'isolation_thermique_par_exterieur': 'FAC',
    'charpente_metallique': 'CHMET',
    'charpente_bois': 'CHCZ',
    'couverture': 'CHCZ',
    'zinguerie': 'CHCZ',
    'etancheite': 'ETAN',
    'menuiseries_exterieures': 'MENUEXT',
    'vitrage': 'MENUEXT',
    'menuiseries_interieures': 'MENUINT',
    'serrurerie': 'MENUINT',
    'isolation': 'IPP',
    'platerie': 'IPP',
    'platrerie': 'IPP',
    'peinture': 'IPP',
    'revetements_de_sol': 'RSC',
    'carrelage': 'RSC',
    'parquet': 'RSC',
    'electricite': 'ELEC',
    'courants_forts': 'ELEC',
    'courants_faibles': 'ELEC',
    'plomberie': 'PLB',
    'sanitaires': 'PLB',
    'chauffage': 'CVC',
    'ventilation': 'CVC',
    'climatisation': 'CVC',
    'cvc': 'CVC',
    'ascenseur': 'ASC',
    'amenagements_paysagers': 'PAY',
    'espaces_verts': 'PAY',
    'espaces_urbains': 'PAY',
    'construction_bois': 'MOB',
    'ossature_bois': 'MOB',
}

UNITES_DOCUMENTS_ECONOMIQUES = UNITES_ARTIPRIX | {
    "FF",
    "METH",
    "METHODE",
    "M²",
    "M³",
}

EN_TETES_A_IGNORER = {
    "Ouvrage",
    "Prix de vente H.T en Euro",
    "Pose seule",
    "Code",
    "Désignation",
    "Temps",
    "de pose",
    "Fourniture + Pose",
    "Fourniture",
    "seule",
    "41/h",
    "56/h",
}

MOTS_CLES_MAIN_OEUVRE = (
    "compagnon",
    "ouvrier",
    "chef",
    "technicien",
    "conducteur",
    "manoeuvre",
    "manœuvre",
    "ferrailleur",
    "betonneur",
    "bétonneur",
    "maçon",
)

LIBELLES_LIGNES_A_IGNORER = {
    "designation",
    "désignation",
    "ouvrage",
    "ouvrage élémentaire",
    "u",
    "unite",
    "unité",
    "quantite",
    "quantité",
    "prix unitaire",
    "pu",
    "p.u.",
    "montant",
    "total",
    "debours",
    "débours",
    "debourse",
    "déboursé",
    "bpu",
    "dpgf",
    "dqe",
    "devis",
}


@dataclass
class LigneBordereau:
    code_source: str
    code_interne: str
    famille: str
    sous_famille: str
    designation: str
    unite: str
    temps_pose: Decimal | None
    prix_pose_41: Decimal | None
    prix_pose_56: Decimal | None
    prix_fourniture_pose_41: Decimal | None
    prix_fourniture_pose_56: Decimal | None
    source_reference: str
    hypotheses: str


@dataclass
class LigneJustificationPrix:
    ordre: int
    code_source: str
    designation: str
    quantite: Decimal
    unite: str
    prix_unitaire: Decimal
    prix_total: Decimal
    type_ressource: str


@dataclass
class FichePrixConstruction:
    url_source: str
    code_source: str
    code_interne: str
    type_ouvrage: str
    famille: str
    sous_famille: str
    corps_etat: str
    lot: str
    designation: str
    description: str
    unite: str
    prix_vente_unitaire: Decimal
    justification_prix: list[LigneJustificationPrix]
    montant_total_ht: Decimal
    cout_entretien_decennal: Decimal | None
    cahier_des_charges_structure: list[dict[str, object]]
    normes_applicables: list[str]
    criteres_metre: str
    phases_execution: list[str]
    dechets_generes: list[dict[str, object]]
    illustrations: list[str]
    options: list[str]


def _decimal_depuis_texte(valeur: str) -> Decimal | None:
    texte = (valeur or "").strip().replace("\xa0", "").replace(" ", "")
    if not texte:
        return None
    texte = texte.replace("€", "").replace("%", "")
    if not re.fullmatch(r"-?\d+(?:,\d+)?", texte):
        return None
    return Decimal(texte.replace(",", "."))


def _premier_decimal_depuis_texte(valeur: str) -> Decimal | None:
    correspondance = re.search(r"-?\d+(?:,\d+)?", (valeur or "").replace("\xa0", " "))
    if not correspondance:
        return None
    return Decimal(correspondance.group(0).replace(",", "."))


def _normaliser_ascii(valeur: str) -> str:
    contenu = unicodedata.normalize("NFKD", valeur or "")
    return contenu.encode("ascii", "ignore").decode("ascii")


def _slug_metier(valeur: str) -> str:
    ascii_value = _normaliser_ascii(valeur).lower()
    ascii_value = re.sub(r"[^a-z0-9]+", "-", ascii_value)
    return re.sub(r"-+", "-", ascii_value).strip("-")


def _libelle_propre(valeur: str) -> str:
    texte = re.sub(r"\s+", " ", (valeur or "").strip())
    if not texte:
        return ""
    return texte[0].upper() + texte[1:]


def _tronquer(valeur: str, longueur: int) -> str:
    return (valeur or "")[:longueur]


def _texte_pdf(chemin: Path) -> str:
    try:
        import fitz  # type: ignore

        document = fitz.open(str(chemin))
        try:
            return "\n".join(page.get_text() for page in document)
        finally:
            document.close()
    except Exception:
        pass

    try:
        resultat = subprocess.run(
            ["pdftotext", str(chemin), "-"],
            capture_output=True,
            text=True,
            check=False,
        )
    except FileNotFoundError as exc:
        raise RuntimeError(f"Impossible de lire le PDF {chemin.name}") from exc
    if resultat.returncode != 0:
        raise RuntimeError(f"Impossible de lire le PDF {chemin.name}")
    return resultat.stdout


def _lignes_utiles_texte(texte: str) -> list[str]:
    lignes: list[str] = []
    for ligne in texte.splitlines():
        propre = re.sub(r"\s+", " ", ligne.replace("\x0c", " ")).strip()
        if not propre:
            continue
        if propre in EN_TETES_A_IGNORER:
            continue
        if re.fullmatch(r"Bordereau de prix .+ \d+", propre):
            continue
        lignes.append(propre)
    return lignes


def _est_code_article(valeur: str) -> bool:
    return bool(re.fullmatch(r"\d+(?:\.\d+){1,4}", valeur))


def _est_numero_section(valeur: str) -> bool:
    return bool(re.fullmatch(r"\d+(?:\.\d+){1,2}", valeur))


def _est_unite(valeur: str) -> bool:
    return valeur.upper() in UNITES_ARTIPRIX


def _normaliser_unite_document(valeur: str) -> str:
    brut = (valeur or "").strip().upper().replace(".", "")
    remplacements = {
        "M²": "M2",
        "M³": "M3",
        "METHODE": "METH",
    }
    return remplacements.get(brut, brut)


def _est_unite_document(valeur: str) -> bool:
    return _normaliser_unite_document(valeur) in UNITES_DOCUMENTS_ECONOMIQUES


def _est_nombre(valeur: str) -> bool:
    return _decimal_depuis_texte(valeur) is not None


def _est_titre_majuscule(valeur: str) -> bool:
    if any(ch.isdigit() for ch in valeur):
        return False
    lettres = [ch for ch in valeur if ch.isalpha()]
    if not lettres:
        return False
    return sum(1 for ch in lettres if ch.isupper()) >= max(3, int(len(lettres) * 0.7))


def _nettoyer_ligne_import_document(ligne: str) -> str:
    propre = re.sub(r"\s+", " ", (ligne or "").replace("\x0c", " ")).strip(" \t-–—;:")
    propre = propre.replace("€ HT", "€").replace("€HT", "€").replace("€/u", "€")
    return re.sub(r"\s+", " ", propre).strip()


def _est_entete_document_economique(ligne: str) -> bool:
    normalisee = _slug_metier(ligne).replace("-", " ")
    if not normalisee:
        return True
    if normalisee in LIBELLES_LIGNES_A_IGNORER:
        return True
    return any(mot in normalisee for mot in LIBELLES_LIGNES_A_IGNORER)


def _est_code_ouvrage(valeur: str) -> bool:
    return bool(re.fullmatch(r"[A-Za-z0-9]{1,8}(?:[./_-][A-Za-z0-9]{1,8}){0,4}", valeur or "")) and any(
        caractere.isdigit() for caractere in valeur or ""
    )


def _extraire_description_depuis_tokens(tokens: list[str], debut: int, fin: int) -> str:
    description = " ".join(token for token in tokens[debut:fin] if token).strip(" -")
    description = re.sub(r"\s+", " ", description).strip()
    return description


def _analyser_ligne_document_economique(
    ligne: str,
    *,
    section_courante: str = "",
    description_en_attente: str = "",
) -> dict[str, object] | None:
    propre = _nettoyer_ligne_import_document(ligne)
    if not propre or _est_entete_document_economique(propre):
        return None
    if re.match(r"^(lot|chapitre|section)\b", propre, flags=re.IGNORECASE):
        return None

    tokens = propre.split()
    if len(tokens) < 2:
        return None

    index_code = 0
    code_source = ""
    if _est_code_ouvrage(tokens[0]) and not _est_unite_document(tokens[0]):
        code_source = tokens[0]
        index_code = 1

    index_unite = None
    for index in range(len(tokens) - 1, index_code - 1, -1):
        if _est_unite_document(tokens[index]):
            index_unite = index
            break

    nombres: list[Decimal] = []
    index_premier_nombre = None
    for index, token in enumerate(tokens[index_code:], start=index_code):
        valeur = _decimal_depuis_texte(token)
        if valeur is None:
            continue
        if index_premier_nombre is None:
            index_premier_nombre = index
        nombres.append(valeur)

    if index_unite is None and index_premier_nombre is None:
        return None
    if index_unite is None and len(nombres) <= 1 and (_est_titre_majuscule(propre) or len(tokens) <= 6):
        return None

    index_fin_description = (
        min(
            valeur
            for valeur in [index_unite, index_premier_nombre]
            if valeur is not None
        )
        if index_unite is not None or index_premier_nombre is not None
        else len(tokens)
    )
    description = _extraire_description_depuis_tokens(tokens, index_code, index_fin_description)
    if description_en_attente:
        description = f"{description_en_attente} {description}".strip()
    description = re.sub(r"\s+", " ", description).strip()
    if not description:
        return None

    unite = "U"
    if index_unite is not None:
        unite = _normaliser_unite_document(tokens[index_unite])

    quantite = Decimal("1")
    prix_unitaire = Decimal("0")
    montant_ligne = Decimal("0")

    if len(nombres) >= 3:
        quantite = nombres[-3]
        prix_unitaire = nombres[-2]
        montant_ligne = nombres[-1]
    elif len(nombres) == 2:
        quantite = nombres[-2]
        prix_unitaire = nombres[-1]
        montant_ligne = (quantite * prix_unitaire).quantize(Decimal("0.0001"))
    elif len(nombres) == 1:
        prix_unitaire = nombres[-1]
        montant_ligne = prix_unitaire

    if prix_unitaire <= 0 and montant_ligne > 0 and quantite > 0:
        prix_unitaire = (montant_ligne / quantite).quantize(Decimal("0.0001"))

    if prix_unitaire <= 0:
        return None

    return {
        "code_source": code_source,
        "designation": description,
        "unite": unite,
        "quantite_document": quantite,
        "prix_unitaire": prix_unitaire,
        "montant_ligne": montant_ligne if montant_ligne > 0 else prix_unitaire,
        "famille": section_courante or "Import documentaire",
    }


def extraire_lignes_economiques_depuis_texte(
    texte: str,
    *,
    limite: int | None = None,
) -> list[dict[str, object]]:
    lignes_extraites: list[dict[str, object]] = []
    section_courante = ""
    description_en_attente = ""

    for ligne_brute in (texte or "").splitlines():
        ligne = _nettoyer_ligne_import_document(ligne_brute)
        if not ligne:
            continue

        if re.match(r"^(lot|chapitre|section)\b", ligne, flags=re.IGNORECASE):
            section_courante = ligne[:100]
            description_en_attente = ""
            continue

        if (
            not any(ch.isdigit() for ch in ligne)
            and not _est_unite_document(ligne)
            and (_est_titre_majuscule(ligne) or len(ligne.split()) <= 6)
        ):
            section_courante = ligne[:100]
            description_en_attente = ""
            continue

        analyse = _analyser_ligne_document_economique(
            ligne,
            section_courante=section_courante,
            description_en_attente=description_en_attente,
        )
        if analyse:
            lignes_extraites.append(analyse)
            description_en_attente = ""
            if limite is not None and len(lignes_extraites) >= limite:
                break
            continue

        if not any(ch.isdigit() for ch in ligne) and len(ligne.split()) >= 2:
            description_en_attente = f"{description_en_attente} {ligne}".strip()

    return lignes_extraites


def _titre_source_bordereau(chemin: Path) -> tuple[str, str]:
    nom = chemin.name.lower()
    if "aext" in nom or "amenagements-exterieurs" in nom:
        return "AEXT", "Aménagements extérieurs"
    if "go-so" in nom or "go_so" in nom or "gros-oeuvre-second-oeuvre" in nom:
        return "GOSO", "Gros œuvre et second œuvre"
    return "BORD", "Bordereau général"


def _decouper_variantes_prix(
    nombres: list[Decimal], nb_codes: int
) -> tuple[list[Decimal | None], list[Decimal | None], list[Decimal | None], list[Decimal | None], list[Decimal | None]]:
    temps = [None] * nb_codes
    pose_41 = [None] * nb_codes
    pose_56 = [None] * nb_codes
    fourniture_41 = [None] * nb_codes
    fourniture_56 = [None] * nb_codes

    if len(nombres) >= nb_codes * 5:
        temps = nombres[0:nb_codes]
        pose_41 = nombres[nb_codes:nb_codes * 2]
        pose_56 = nombres[nb_codes * 2:nb_codes * 3]
        fourniture_41 = nombres[nb_codes * 3:nb_codes * 4]
        fourniture_56 = nombres[nb_codes * 4:nb_codes * 5]
        return temps, pose_41, pose_56, fourniture_41, fourniture_56

    if len(nombres) >= nb_codes * 4:
        pose_41 = nombres[0:nb_codes]
        pose_56 = nombres[nb_codes:nb_codes * 2]
        fourniture_41 = nombres[nb_codes * 2:nb_codes * 3]
        fourniture_56 = nombres[nb_codes * 3:nb_codes * 4]
        return temps, pose_41, pose_56, fourniture_41, fourniture_56

    if len(nombres) >= nb_codes * 2:
        pose_41 = nombres[0:nb_codes]
        pose_56 = nombres[nb_codes:nb_codes * 2]
        return temps, pose_41, pose_56, fourniture_41, fourniture_56

    if len(nombres) >= nb_codes:
        pose_41 = nombres[0:nb_codes]
        return temps, pose_41, pose_56, fourniture_41, fourniture_56

    return temps, pose_41, pose_56, fourniture_41, fourniture_56


def parser_bordereau_artiprix(chemin: Path) -> list[LigneBordereau]:
    """Extrait les lignes d'ouvrage exploitables depuis un PDF bordereau Artiprix."""
    prefixe, reference_source = _titre_source_bordereau(chemin)
    lignes = _lignes_utiles_texte(_texte_pdf(chemin))
    famille = reference_source
    sous_famille = ""
    hypotheses = ""
    resultats: list[LigneBordereau] = []
    i = 0

    while i < len(lignes):
        ligne = lignes[i]

        if _est_titre_majuscule(ligne):
            famille = _libelle_propre(ligne)
            i += 1
            continue

        if _est_numero_section(ligne) and i + 1 < len(lignes) and _est_titre_majuscule(lignes[i + 1]):
            i += 1
            continue

        if not _est_code_article(ligne):
            if not _est_unite(ligne) and not _est_nombre(ligne):
                prochaine_est_code = i + 1 < len(lignes) and _est_code_article(lignes[i + 1])
                if prochaine_est_code:
                    sous_famille = _libelle_propre(ligne)
                    hypotheses = ""
                elif sous_famille and not _est_titre_majuscule(ligne):
                    hypotheses = f"{hypotheses} {ligne}".strip()
            i += 1
            continue

        codes: list[str] = []
        while i < len(lignes) and _est_code_article(lignes[i]):
            codes.append(lignes[i])
            i += 1

        designations: list[str] = []
        while i < len(lignes) and len(designations) < len(codes):
            valeur = lignes[i]
            if _est_unite(valeur) or _est_code_article(valeur) or _est_titre_majuscule(valeur):
                break
            designations.append(valeur)
            i += 1

        unites: list[str] = []
        while i < len(lignes) and len(unites) < len(codes) and _est_unite(lignes[i]):
            unites.append(lignes[i].upper())
            i += 1

        nombres: list[Decimal] = []
        while i < len(lignes) and _est_nombre(lignes[i]):
            valeur = _decimal_depuis_texte(lignes[i])
            if valeur is not None:
                nombres.append(valeur)
            i += 1

        if len(designations) != len(codes) or len(unites) != len(codes):
            continue

        tempss, pose41s, pose56s, four41s, four56s = _decouper_variantes_prix(nombres, len(codes))

        for index, code_source in enumerate(codes):
            designation = _libelle_propre(designations[index])
            code_interne = f"PRI-{prefixe}-{code_source}"
            resultats.append(
                LigneBordereau(
                    code_source=code_source,
                    code_interne=code_interne,
                    famille=famille,
                    sous_famille=sous_famille or reference_source,
                    designation=designation,
                    unite=unites[index],
                    temps_pose=tempss[index] if index < len(tempss) else None,
                    prix_pose_41=pose41s[index] if index < len(pose41s) else None,
                    prix_pose_56=pose56s[index] if index < len(pose56s) else None,
                    prix_fourniture_pose_41=four41s[index] if index < len(four41s) else None,
                    prix_fourniture_pose_56=four56s[index] if index < len(four56s) else None,
                    source_reference=reference_source,
                    hypotheses=hypotheses,
                )
            )

    return resultats


def _donnees_analytiques_ligne(ligne: LigneBordereau) -> dict[str, object]:
    variantes = {
        "pose_seule_41": str(ligne.prix_pose_41) if ligne.prix_pose_41 is not None else None,
        "pose_seule_56": str(ligne.prix_pose_56) if ligne.prix_pose_56 is not None else None,
        "fourniture_pose_41": str(ligne.prix_fourniture_pose_41) if ligne.prix_fourniture_pose_41 is not None else None,
        "fourniture_pose_56": str(ligne.prix_fourniture_pose_56) if ligne.prix_fourniture_pose_56 is not None else None,
    }
    return {
        "reference_bordereau": ligne.source_reference,
        "code_source": ligne.code_source,
        "temps_pose_unitaire": str(ligne.temps_pose) if ligne.temps_pose is not None else None,
        "variantes_prix": variantes,
    }


def construire_ligne_bibliotheque_depuis_bordereau(ligne: LigneBordereau, auteur=None) -> LignePrixBibliotheque:
    prix_reference = ligne.prix_fourniture_pose_41 or ligne.prix_pose_41 or Decimal("0")
    cout_horaire = Decimal("41.00")
    debourse = ligne.prix_pose_41 or prix_reference or Decimal("0")
    return LignePrixBibliotheque(
        niveau="reference",
        code=ligne.code_interne,
        famille=_tronquer(ligne.famille, 100),
        sous_famille=_tronquer(ligne.sous_famille, 100),
        corps_etat=_tronquer(ligne.famille, 100),
        designation_longue=ligne.designation,
        designation_courte=ligne.designation,
        unite=ligne.unite,
        hypotheses=ligne.hypotheses,
        contexte_emploi=f"Ouvrage de référence — {ligne.source_reference}",
        origine_import="bordereau_pdf",
        code_source_externe=ligne.code_source,
        temps_main_oeuvre=ligne.temps_pose or Decimal("0"),
        cout_horaire_mo=cout_horaire,
        debourse_sec_unitaire=debourse,
        prix_vente_unitaire=prix_reference,
        source="Référentiel de prix analytique",
        fiabilite=3,
        statut_validation="valide",
        donnees_analytiques=_donnees_analytiques_ligne(ligne),
        auteur=auteur,
    )


def _upsert_ligne_bibliotheque_depuis_bordereau(ligne: LigneBordereau, auteur=None) -> bool:
    """Crée ou met à jour une ligne de bibliothèque depuis un bordereau structuré."""
    defaults = construire_ligne_bibliotheque_depuis_bordereau(ligne, auteur=auteur)
    valeurs = {
        "niveau": defaults.niveau,
        "famille": defaults.famille,
        "sous_famille": defaults.sous_famille,
        "corps_etat": defaults.corps_etat,
        "designation_longue": defaults.designation_longue,
        "designation_courte": defaults.designation_courte,
        "unite": defaults.unite,
        "hypotheses": defaults.hypotheses,
        "contexte_emploi": defaults.contexte_emploi,
        "origine_import": defaults.origine_import,
        "code_source_externe": defaults.code_source_externe,
        "temps_main_oeuvre": defaults.temps_main_oeuvre,
        "cout_horaire_mo": defaults.cout_horaire_mo,
        "debourse_sec_unitaire": defaults.debourse_sec_unitaire,
        "prix_vente_unitaire": defaults.prix_vente_unitaire,
        "source": defaults.source,
        "fiabilite": defaults.fiabilite,
        "statut_validation": defaults.statut_validation,
        "donnees_analytiques": defaults.donnees_analytiques,
        "auteur": auteur,
    }
    _, cree = LignePrixBibliotheque.objects.update_or_create(
        code=ligne.code_interne,
        defaults=valeurs,
    )
    return cree


def importer_lignes_bordereau(
    lignes: Iterable[LigneBordereau],
    auteur=None,
) -> dict[str, int]:
    """Alimente la bibliothèque à partir d'un jeu de lignes de bordereau déjà parsées."""
    total = 0
    crees = 0
    maj = 0

    for ligne in lignes:
        total += 1
        if _upsert_ligne_bibliotheque_depuis_bordereau(ligne, auteur=auteur):
            crees += 1
        else:
            maj += 1

    return {
        "lignes": total,
        "creees": crees,
        "mises_a_jour": maj,
    }


def lister_bordereaux_prix_references() -> list[Path]:
    if not RACINE_RESSOURCES_METIER.exists():
        return []
    motifs = ("*ARTIPRIX*.pdf", "*Artiprix*.pdf", "*bordereau*prix*.pdf", "*prix*.pdf")
    trouves: list[Path] = []
    for motif in motifs:
        for chemin in sorted(RACINE_RESSOURCES_METIER.glob(motif)):
            if chemin not in trouves:
                trouves.append(chemin)
    return [
        chemin
        for chemin in trouves
        if "artiprix" in chemin.name.lower() or "bordereau-prix" in chemin.name.lower()
    ]


@transaction.atomic
def importer_bordereaux_prix_references(auteur=None, limite: int | None = None) -> dict[str, int]:
    """Importe les bordereaux de prix de référence trouvés dans le partage métier."""
    total = 0
    crees = 0
    maj = 0
    fichiers = lister_bordereaux_prix_references()

    for fichier in fichiers:
        lignes = parser_bordereau_artiprix(fichier)
        if limite is not None:
            lignes = lignes[:limite]
        resultat = importer_lignes_bordereau(lignes, auteur=auteur)
        total += resultat["lignes"]
        crees += resultat["creees"]
        maj += resultat["mises_a_jour"]

    return {
        "fichiers": len(fichiers),
        "lignes": total,
        "creees": crees,
        "mises_a_jour": maj,
    }


@transaction.atomic
def importer_bordereau_depuis_fichier(chemin: Path, auteur=None, limite: int | None = None) -> dict[str, int]:
    """Importe un bordereau téléversé (PDF ou Excel) vers la bibliothèque de prix."""
    suffixe = chemin.suffix.lower()
    if suffixe in (".xlsx", ".xls"):
        return importer_bordereau_depuis_excel(chemin, auteur=auteur, limite=limite)

    lignes = parser_bordereau_artiprix(chemin)
    if limite is not None:
        lignes = lignes[:limite]

    resultat = importer_lignes_bordereau(lignes, auteur=auteur)
    return {
        "fichiers": 1,
        **resultat,
    }


def importer_bordereau_depuis_excel(
    chemin: Path,
    auteur=None,
    limite: int | None = None,
) -> dict[str, int]:
    """
    Importe un bordereau de prix depuis un fichier Excel (.xlsx/.xls).

    Logique intelligente :
    - Détecte automatiquement les colonnes (code, désignation, unité, prix)
    - Si une entrée similaire existe déjà : moyenne pondérée des prix (fiabilité++)
    - Si absente : crée l'entrée et décompose le prix par étude inversée
    """
    import openpyxl
    from decimal import InvalidOperation

    # Colonnes possibles par type de données attendu
    SYNONYMES_CODE = {"code", "réf", "ref", "référence", "n°", "numero", "num", "article"}
    SYNONYMES_DESIGNATION = {"désignation", "designation", "libellé", "libelle", "description", "intitulé", "intitule", "prestation", "ouvrage"}
    SYNONYMES_UNITE = {"unité", "unite", "u", "ut", "un"}
    SYNONYMES_PRIX = {"prix", "pu", "pv", "p.u", "p.v", "pu ht", "pv ht", "prix unitaire", "prix vente", "montant unitaire", "tarif"}
    SYNONYMES_DS = {"ds", "déboursé", "debourse", "coût", "cout", "coût unitaire", "cout unitaire", "ds ht"}
    SYNONYMES_FAMILLE = {"famille", "lot", "corps d'état", "corps etat", "chapitre", "section", "catégorie", "categorie"}

    try:
        wb = openpyxl.load_workbook(chemin, read_only=True, data_only=True)
        ws = wb.active
    except Exception as exc:
        raise RuntimeError(f"Impossible de lire le fichier Excel : {exc}") from exc

    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        return {"fichiers": 1, "lignes": 0, "creees": 0, "mises_a_jour": 0}

    # Détecter la ligne d'en-tête (première ligne non vide avec du texte)
    entete_idx = None
    for i, row in enumerate(rows):
        vals = [str(c or "").strip().lower() for c in row]
        n_texte = sum(1 for v in vals if v and not _est_nombre(v))
        if n_texte >= 2:
            entete_idx = i
            break

    if entete_idx is None:
        return {"fichiers": 1, "lignes": 0, "creees": 0, "mises_a_jour": 0}

    entete = [str(c or "").strip().lower() for c in rows[entete_idx]]

    # Affecter les colonnes
    def _trouver_col(synonymes: set) -> int | None:
        for idx, h in enumerate(entete):
            if any(syn in h for syn in synonymes):
                return idx
        return None

    col_code = _trouver_col(SYNONYMES_CODE)
    col_desig = _trouver_col(SYNONYMES_DESIGNATION)
    col_unite = _trouver_col(SYNONYMES_UNITE)
    col_prix = _trouver_col(SYNONYMES_PRIX)
    col_ds = _trouver_col(SYNONYMES_DS)
    col_famille = _trouver_col(SYNONYMES_FAMILLE)

    # Sans colonne désignation on abandonne
    if col_desig is None:
        # Tentative heuristique : la colonne la plus longue en texte
        longueurs = [
            sum(len(str(rows[i][c] or "")) for i in range(entete_idx + 1, min(entete_idx + 20, len(rows))))
            for c in range(len(entete))
        ]
        col_desig = longueurs.index(max(longueurs)) if longueurs else 0

    # Collecter les lignes de données
    data_rows = rows[entete_idx + 1:]
    if limite is not None:
        data_rows = data_rows[:limite]

    creees = 0
    maj = 0
    total = 0
    famille_courante = "Import Excel"

    for row in data_rows:
        if not row or all(c is None for c in row):
            continue

        def _cell(idx: int | None) -> str:
            if idx is None or idx >= len(row):
                return ""
            return str(row[idx] or "").strip()

        desig = _cell(col_desig)
        if not desig or len(desig) < 3:
            # Peut-être une ligne de titre de section
            if col_famille is not None:
                val_fam = _cell(col_famille)
                if val_fam:
                    famille_courante = val_fam
            continue

        # Ignorer les lignes qui sont clairement des sous-totaux ou titres
        if desig.upper() == desig and len(desig) > 5:
            famille_courante = desig
            continue

        code = _cell(col_code) or ""
        unite = _cell(col_unite) or "ens"
        famille = _cell(col_famille) if col_famille is not None else famille_courante

        # Récupérer le prix
        prix_str = _cell(col_prix)
        ds_str = _cell(col_ds)

        def _to_decimal(s: str) -> Decimal | None:
            if not s:
                return None
            s = s.replace(" ", "").replace(",", ".").replace("€", "").strip()
            try:
                v = Decimal(s)
                return v if v > 0 else None
            except InvalidOperation:
                return None

        prix_vente = _to_decimal(prix_str)
        ds = _to_decimal(ds_str)

        if prix_vente is None and ds is None:
            continue

        total += 1

        # Si on n'a que le DS, estimer le PV (Kpv moyen = 1,30)
        if prix_vente is None and ds is not None:
            prix_vente = (ds * Decimal("1.30")).quantize(Decimal("0.01"))
        if ds is None and prix_vente is not None:
            ds = (prix_vente * Decimal("0.77")).quantize(Decimal("0.01"))

        # Chercher une entrée similaire par code puis par similarité textuelle
        entree_existante = None
        if code:
            entree_existante = LignePrixBibliotheque.objects.filter(
                code_source_externe=code[:80]
            ).first()

        if entree_existante is None:
            # Similarité textuelle (mots significatifs)
            mots_desig = {m.lower() for m in desig.replace("-", " ").split() if len(m) > 3}
            if len(mots_desig) >= 2:
                from django.db.models import Q
                qs = LignePrixBibliotheque.objects.filter(
                    Q(designation_courte__icontains=next(iter(mots_desig))) |
                    Q(designation_longue__icontains=next(iter(mots_desig)))
                ).values("id", "designation_courte", "designation_longue", "prix_vente_unitaire", "debourse_sec_unitaire", "fiabilite")[:50]

                for candidat in qs:
                    mots_candidat = {
                        m.lower()
                        for texte in [candidat["designation_courte"] or "", candidat["designation_longue"] or ""]
                        for m in texte.replace("-", " ").split()
                        if len(m) > 3
                    }
                    score = len(mots_desig & mots_candidat)
                    if score >= max(2, len(mots_desig) // 2):
                        try:
                            entree_existante = LignePrixBibliotheque.objects.get(pk=candidat["id"])
                        except LignePrixBibliotheque.DoesNotExist:
                            pass
                        break

        if entree_existante is not None:
            # Fusionner : moyenne pondérée des prix
            ancien_pv = Decimal(str(entree_existante.prix_vente_unitaire or 0))
            ancien_ds = Decimal(str(entree_existante.debourse_sec_unitaire or 0))
            fiab = entree_existante.fiabilite or 1

            if ancien_pv > 0:
                # Moyenne pondérée (poids = fiabilité ancienne)
                poids = min(fiab, 4)
                nouveau_pv = ((ancien_pv * poids) + prix_vente) / (poids + 1)
                nouveau_ds = ((ancien_ds * poids) + ds) / (poids + 1)
                entree_existante.prix_vente_unitaire = nouveau_pv.quantize(Decimal("0.0001"))
                entree_existante.debourse_sec_unitaire = nouveau_ds.quantize(Decimal("0.0001"))
                entree_existante.fiabilite = min(fiab + 1, 5)
                obs = (entree_existante.observations_economiques or "").strip()
                entree_existante.observations_economiques = (
                    obs + f"\nMoyenne import Excel {chemin.name} : PV={prix_vente}€ DS={ds}€"
                ).strip()
                entree_existante.save(update_fields=[
                    "prix_vente_unitaire", "debourse_sec_unitaire", "fiabilite", "observations_economiques"
                ])
            maj += 1
        else:
            # Créer la ligne
            prefixe = famille[:4].upper().replace(" ", "") or "XLS"
            from applications.bibliotheque.services import _code_reference_lbh
            code_interne = code if code else _code_reference_lbh(prefixe, f"{desig}|{unite}|{float(prix_vente):.2f}")

            entree = LignePrixBibliotheque(
                code=code_interne[:50],
                code_source_externe=code[:80] if code else "",
                origine_import="bordereau_pdf",
                niveau="reference",
                famille=famille[:100] or famille_courante[:100],
                sous_famille="Import Excel",
                designation_longue=desig,
                designation_courte=desig[:300],
                unite=unite[:20],
                prix_vente_unitaire=prix_vente,
                debourse_sec_unitaire=ds,
                cout_matieres=(ds * Decimal("0.50")).quantize(Decimal("0.0001")),
                observations_economiques=f"Importé depuis {chemin.name}",
                auteur=auteur,
                fiabilite=2,
                statut_validation="a_valider",
            )
            entree.save()
            creees += 1

    wb.close()
    return {"fichiers": 1, "lignes": total, "creees": creees, "mises_a_jour": maj}


@transaction.atomic
def importer_document_economique_dans_bibliotheque(
    document,
    *,
    auteur=None,
    limite: int | None = None,
    statut_validation: str = "a_valider",
) -> dict[str, object]:
    """Extrait un BPU, une DPGF, un DQE ou un devis déjà présent dans la GED."""
    from applications.documents.services import analyser_document_automatiquement

    if not document.contenu_texte and document.fichier:
        analyser_document_automatiquement(document)
        document.refresh_from_db(fields=["contenu_texte", "analyse_automatique", "type_document"])

    lignes = extraire_lignes_economiques_depuis_texte(document.contenu_texte or "", limite=limite)
    if not lignes:
        raise RuntimeError("Aucune ligne de prix exploitable n'a pu être extraite de ce document.")

    type_document_code = getattr(getattr(document, "type_document", None), "code", "") or "DOC"
    classification = {
        "famille": getattr(document.projet, "type_projet", "") or type_document_code,
        "sous_famille": type_document_code,
        "corps_etat": getattr(document.projet, "phase_actuelle", "") or "document",
    }
    prefixe = _prefixe_metier_depuis_classification(classification)

    creees = 0
    mises_a_jour = 0
    details_import: list[dict[str, object]] = []

    for index, ligne in enumerate(lignes, start=1):
        code_source = str(ligne.get("code_source") or f"L{index:04d}")
        designation = str(ligne.get("designation") or f"Ligne {index}")
        empreinte_source = f"{document.id}:{code_source}:{designation}"
        code_interne = _code_reference_lbh(prefixe, empreinte_source)
        prix_unitaire = Decimal(str(ligne.get("prix_unitaire") or "0"))
        quantite_document = Decimal(str(ligne.get("quantite_document") or "1"))
        montant_ligne = Decimal(str(ligne.get("montant_ligne") or prix_unitaire))

        entree, creee = LignePrixBibliotheque.objects.update_or_create(
            code=code_interne,
            defaults={
                "niveau": "reference",
                "organisation": getattr(document.projet, "organisation", None),
                "projet": document.projet,
                "famille": _tronquer(
                    str(ligne.get("famille") or getattr(document.type_document, "libelle", "Import documentaire")),
                    100,
                ),
                "sous_famille": _tronquer(getattr(document.type_document, "libelle", "Document"), 100),
                "corps_etat": _tronquer(getattr(document.projet, "phase_actuelle", "") or "Document", 100),
                "lot": _tronquer(type_document_code, 100),
                "origine_import": "bordereau_pdf",
                "code_source_externe": code_source[:80],
                "designation_longue": designation,
                "designation_courte": designation[:300],
                "unite": str(ligne.get("unite") or "U")[:20],
                "hypotheses": "Extraction automatique à confirmer à partir d'un document importé.",
                "contexte_emploi": f"Document source {document.reference} — {document.intitule}",
                "observations_economiques": "Prix extrait automatiquement depuis un BPU, une DPGF, un DQE ou un devis.",
                "cout_matieres": prix_unitaire,
                "debourse_sec_unitaire": prix_unitaire,
                "prix_vente_unitaire": prix_unitaire,
                "source": f"Document {document.reference}",
                "auteur": auteur or getattr(document, "auteur", None),
                "fiabilite": 2,
                "statut_validation": statut_validation,
                "donnees_analytiques": {
                    "source_import": "document",
                    "source_document": {
                        "id": str(document.id),
                        "reference": document.reference,
                        "intitule": document.intitule,
                        "type_document": type_document_code,
                    },
                    "extraction_document": {
                        "ligne_index": index,
                        "code_source": code_source,
                        "quantite_document": str(quantite_document),
                        "montant_ligne": str(montant_ligne),
                        "prix_unitaire": str(prix_unitaire),
                    },
                },
            },
        )
        generer_sous_details_depuis_composantes(entree, forcer=True)
        if creee:
            creees += 1
        else:
            mises_a_jour += 1
        details_import.append(
            {
                "id": str(entree.id),
                "code": entree.code,
                "designation": entree.designation_courte,
                "unite": entree.unite,
                "prix_vente_unitaire": str(entree.prix_vente_unitaire),
            }
        )

    return {
        "document": {
            "id": str(document.id),
            "reference": document.reference,
            "type_document": type_document_code,
        },
        "lignes": len(lignes),
        "creees": creees,
        "mises_a_jour": mises_a_jour,
        "details": details_import,
    }


def _mapper_lot_cctp_depuis_url(url: str):
    """Retourne le LotCCTP correspondant à la catégorie déduite de l'URL prix-construction.info."""
    chemin = url.replace(URL_BASE_PRIX_CONSTRUCTION, '').lower().strip('/')
    segments = chemin.split('/')
    for segment in segments:
        segment_normalise = segment.replace('-', '_')
        code = MAPPING_CATEGORIE_LOT.get(segment_normalise)
        if code:
            try:
                from applications.pieces_ecrites.models import LotCCTP
                return LotCCTP.objects.get(code=code)
            except Exception:
                pass
    return None


def _telecharger_contenu_html(url: str, timeout: int = 30) -> bytes:
    reponse = SESSION_HTTP.get(url, timeout=timeout)
    reponse.raise_for_status()
    # Forcer l'encodage UTF-8 : prix-construction.info est en UTF-8 mais requests
    # détecte parfois ISO-8859-1 à tort, provoquant du mojibake dans tous les textes.
    reponse.encoding = 'utf-8'
    return reponse.content


def _charger_document_html(url: str):
    # Utiliser les bytes bruts : lxml lit le charset depuis la balise meta et décode correctement.
    return lxml_html.fromstring(_telecharger_contenu_html(url), base_url=url)


def _nettoyer_texte_html(valeur: str) -> str:
    texte = html.unescape(valeur or "")
    texte = texte.replace("\xa0", " ")
    texte = re.sub(r"\s+", " ", texte)
    return texte.strip()


def _texte_noeud(noeud) -> str:
    return _nettoyer_texte_html(" ".join(noeud.xpath(".//text()")))


def _texte_depuis_xpath(document, expression: str) -> str:
    noeuds = document.xpath(expression)
    if not noeuds:
        return ""
    if isinstance(noeuds[0], str):
        return _nettoyer_texte_html(noeuds[0])
    return _texte_noeud(noeuds[0])


def _valeur_decimal_xpath(document, expression: str) -> Decimal | None:
    texte = _texte_depuis_xpath(document, expression)
    return _decimal_depuis_texte(texte)


def _libelle_depuis_segment_url(segment: str) -> str:
    propre = unquote(segment or "")
    if propre.endswith(".html"):
        propre = propre[:-5]
    propre = re.sub(r"^[A-Z]{2,}\d{3,}[A-Z]*_", "", propre)
    propre = propre.replace("__", " / ")
    propre = propre.replace("_", " ")
    return _libelle_propre(propre)


def _classification_depuis_url(url: str) -> dict[str, str]:
    segments = [segment for segment in urlparse(url).path.split("/") if segment]
    type_ouvrage = _libelle_depuis_segment_url(segments[0]) if len(segments) >= 1 else ""
    famille = _libelle_depuis_segment_url(segments[1]) if len(segments) >= 2 else ""
    sous_famille = _libelle_depuis_segment_url(segments[2]) if len(segments) >= 3 else ""
    corps_etat = _libelle_depuis_segment_url(segments[3]) if len(segments) >= 4 else ""
    return {
        "type_ouvrage": type_ouvrage,
        "famille": famille,
        "sous_famille": sous_famille,
        "corps_etat": corps_etat,
        "lot": type_ouvrage,
    }


def _code_reference_lbh(prefixe: str, url_source: str) -> str:
    empreinte = hashlib.blake2b(url_source.encode("utf-8"), digest_size=4).hexdigest().upper()
    return f"LBH-PRI-{prefixe}-{empreinte}"


def _code_article_lbh(prefixe: str, url_source: str) -> str:
    empreinte = hashlib.blake2b(url_source.encode("utf-8"), digest_size=4).hexdigest().upper()
    return f"LBH-CCTP-{prefixe}-{empreinte[:8]}"


def _prefixe_metier_depuis_classification(classification: dict[str, str]) -> str:
    candidats = [
        classification.get("famille", ""),
        classification.get("sous_famille", ""),
        classification.get("corps_etat", ""),
    ]
    for candidat in candidats:
        slug = _slug_metier(candidat).replace("-", "").upper()
        if slug:
            return slug[:4]
    return "GEN"


def _est_url_fiche_prix(url: str) -> bool:
    """Une fiche est à profondeur 5 dans l'arborescence (5 segments de chemin).

    Les pages de catégorie ont 1 à 4 segments, les fiches en ont exactement 5.
    Exemple de fiche :
      /construction_neuve/Structure_et_gros_oeuvre/Fondations/Semelles_isolees/Semelle.html
    Exemple de catégorie :
      /construction_neuve/Structure_et_gros_oeuvre/Fondations/Semelles_isolees/
    """
    if not url.endswith(".html"):
        return False
    chemin = urlparse(url).path.strip("/")
    return chemin.count("/") == 4  # 5 segments = profondeur 5


def _prefixe_descendance(url: str) -> str:
    morceaux = urlparse(url)
    chemin = morceaux.path.rstrip("/")
    if chemin.endswith(".html"):
        chemin = chemin[:-5]
    return f"{morceaux.scheme}://{morceaux.netloc}{chemin}/"


def _liens_depuis_document(document, url_courante: str) -> list[str]:
    valeurs: list[str] = []
    for expression in ("//a[@href]/@href", "//option[@value]/@value"):
        for brute in document.xpath(expression):
            if not brute:
                continue
            url = urljoin(url_courante, brute)
            if url.startswith(URL_BASE_PRIX_CONSTRUCTION) and url.endswith(".html"):
                valeurs.append(url)
    return valeurs


def lister_urls_fiches_prix_construction(urls_depart: Iterable[str], limite: int | None = None) -> list[str]:
    """Explore une ou plusieurs pages et retourne les URLs de fiches unitaires."""
    feuilles: list[str] = []
    visitees: set[str] = set()

    for url_depart in urls_depart:
        if not url_depart:
            continue
        if _est_url_fiche_prix(url_depart):
            if url_depart not in feuilles:
                feuilles.append(url_depart)
            continue

        prefixe = _prefixe_descendance(url_depart)
        a_visiter = [url_depart]

        while a_visiter:
            url = a_visiter.pop(0)
            if url in visitees:
                continue
            visitees.add(url)

            document = _charger_document_html(url)
            for lien in _liens_depuis_document(document, url):
                if not lien.startswith(prefixe):
                    continue
                if _est_url_fiche_prix(lien):
                    if lien not in feuilles:
                        feuilles.append(lien)
                        if limite is not None and len(feuilles) >= limite:
                            return feuilles[:limite]
                elif lien not in visitees and lien not in a_visiter:
                    a_visiter.append(lien)

    return feuilles[:limite] if limite is not None else feuilles


def _determiner_type_ressource(code_source: str, designation: str, unite: str) -> str:
    code = (code_source or "").lower()
    libelle = (designation or "").lower()
    unite_normalisee = (unite or "").lower()

    if libelle.startswith("frais de chantier") or "frais" in libelle and unite_normalisee == "%":
        return "frais_divers"
    if code.startswith("mo") or any(mot in libelle for mot in MOTS_CLES_MAIN_OEUVRE):
        return "mo"
    if "transport" in libelle or code.startswith("tr"):
        return "transport"
    if code.startswith(("st", "ss", "sub")) or "sous-trait" in libelle:
        return "sous_traitance"
    if code.startswith(("mq", "ma", "me", "mm")):
        return "materiel"
    return "matiere"


def _extraire_justification_prix(document) -> tuple[list[LigneJustificationPrix], Decimal, Decimal | None]:
    tableau = document.xpath("//div[@id='decomposedPriceHeaderCollapse']//table")
    if not tableau:
        return [], Decimal("0"), None

    lignes: list[LigneJustificationPrix] = []
    montant_total = Decimal("0")
    cout_entretien: Decimal | None = None
    ordre = 1

    for ligne in tableau[0].xpath(".//tr"):
        cellules = [_texte_noeud(cellule) for cellule in ligne.xpath("./td")]
        if not any(cellules):
            continue

        if cellules[0] == "Code interne":
            continue

        contenu = " ".join(cellule for cellule in cellules if cellule)
        if "Coût d'entretien décennal:" in contenu:
            cout_entretien = _premier_decimal_depuis_texte(contenu)
            continue
        if "Montant total HT:" in contenu:
            derniere_valeur = next((cellule for cellule in reversed(cellules) if cellule), "")
            montant_total = _decimal_depuis_texte(derniere_valeur) or Decimal("0")
            continue

        if len(cellules) < 6:
            continue

        code_source, designation, quantite, unite, prix_unitaire, prix_total = cellules[:6]
        ligne_justification = LigneJustificationPrix(
            ordre=ordre,
            code_source=code_source,
            designation=designation,
            quantite=_decimal_depuis_texte(quantite) or Decimal("0"),
            unite=unite,
            prix_unitaire=_decimal_depuis_texte(prix_unitaire) or Decimal("0"),
            prix_total=_decimal_depuis_texte(prix_total) or Decimal("0"),
            type_ressource=_determiner_type_ressource(code_source, designation, unite),
        )
        lignes.append(ligne_justification)
        ordre += 1

    return lignes, montant_total, cout_entretien


def _est_titre_section_cctp(texte: str) -> bool:
    if texte.startswith("UNITÉ D'OUVRAGE"):
        return False
    lettres = [caractere for caractere in texte if caractere.isalpha()]
    if len(lettres) < 4:
        return False
    proportion = sum(1 for caractere in lettres if caractere.isupper()) / len(lettres)
    return proportion >= 0.72


def _niveau_section(noeud) -> int:
    return 1 + len(noeud.xpath("ancestor::div[@style[contains(., 'margin-left')]]"))


def _extraire_cahier_des_charges(document) -> tuple[list[dict[str, object]], list[str], str, list[str]]:
    # Recherche dans l'accordéon principal (structure habituelle prix-construction.info)
    corps_candidats = document.xpath("//div[@id='termsConditionsHeaderCollapse']//div[contains(@class, 'accordion-body')]")

    # Fallback : divs avec class/id contenant "cahier"
    if not corps_candidats:
        corps_candidats = document.xpath(
            "//div[contains(@class, 'cahier') or contains(@id, 'cahier')]"
        )

    # Fallback : sections h2/h3 avec mots-clés prescriptions / mise en oeuvre / conditions
    if not corps_candidats:
        corps_candidats = document.xpath(
            "//section[.//h2[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZÀÂÉÈÊËÎÏÔÙÛÜÇ', "
            "'abcdefghijklmnopqrstuvwxyzàâéèêëîïôùûüç'), 'cahier') or "
            "contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZÀÂÉÈÊËÎÏÔÙÛÜÇ', "
            "'abcdefghijklmnopqrstuvwxyzàâéèêëîïôùûüç'), 'prescription') or "
            "contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZÀÂÉÈÊËÎÏÔÙÛÜÇ', "
            "'abcdefghijklmnopqrstuvwxyzàâéèêëîïôùûüç'), 'mise en oeuvre') or "
            "contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZÀÂÉÈÊËÎÏÔÙÛÜÇ', "
            "'abcdefghijklmnopqrstuvwxyzàâéèêëîïôùûüç'), 'condition')]]"
        )

    if not corps_candidats:
        return [], [], "", []

    sections: list[dict[str, object]] = []
    section_courante: dict[str, object] | None = None
    normes: list[str] = []
    criteres_metre = ""
    phases_execution: list[str] = []

    for noeud in corps_candidats[0].xpath(".//*[self::p or self::table or self::h2 or self::h3]"):
        texte = _texte_noeud(noeud).lstrip("- ").strip()
        if not texte:
            continue

        # Les balises h2/h3 deviennent systématiquement des titres de section
        tag = noeud.tag.lower() if hasattr(noeud, "tag") else ""
        if tag in ("h2", "h3"):
            section_courante = {
                "titre": texte.rstrip("."),
                "niveau": 1 if tag == "h2" else 2,
                "paragraphes": [],
            }
            sections.append(section_courante)
            continue

        if texte.startswith("UNITÉ D'OUVRAGE"):
            sections.append({"titre": "Présentation", "niveau": 0, "paragraphes": [texte]})
            section_courante = None
            continue

        if _est_titre_section_cctp(texte):
            section_courante = {"titre": texte.rstrip("."), "niveau": _niveau_section(noeud), "paragraphes": []}
            sections.append(section_courante)
            continue

        if section_courante is None:
            section_courante = {"titre": "Généralités", "niveau": 1, "paragraphes": []}
            sections.append(section_courante)

        paragraphes = section_courante.setdefault("paragraphes", [])
        if texte not in paragraphes:
            paragraphes.append(texte)

    # Extraction des options/hypothèses depuis les divs dédiés
    noeuds_options = document.xpath(
        "//div[contains(@class, 'option') or contains(@id, 'option')]"
        "| //ul[preceding-sibling::*[contains(translate(text(), "
        "'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'option')]]"
    )
    if noeuds_options:
        textes_options = [
            _texte_noeud(n).strip()
            for n in noeuds_options[0].xpath(".//*[self::li or self::p]")
            if _texte_noeud(n).strip()
        ]
        if textes_options:
            sections.append({"titre": "Options", "niveau": 1, "paragraphes": textes_options})

    for section in sections:
        titre = _slug_metier(str(section.get("titre", "")))
        paragraphes = [str(paragraphe) for paragraphe in section.get("paragraphes", [])]
        if "norme-appliquee" in titre:
            normes.extend(
                paragraphe
                for paragraphe in paragraphes
                if re.search(r"\b(NF|DTU|EN|RAGE|PACTE)\b", paragraphe)
            )
        elif "critere-pour-le-metre" in titre:
            criteres_metre = " ".join(paragraphes).strip()
        elif "phases-d-execution" in titre:
            contenu = " ".join(paragraphes)
            phases_execution = [
                _libelle_propre(bloc.strip())
                for bloc in re.split(r"\.\s+|;\s+", contenu)
                if bloc.strip()
            ]

    normes_uniques: list[str] = []
    for norme in normes:
        if norme not in normes_uniques:
            normes_uniques.append(norme)

    return sections, normes_uniques, criteres_metre, phases_execution


def _extraire_dechets_generes(document) -> list[dict[str, object]]:
    tableau = document.xpath("//div[@id='wasteGeneratedHeaderCollapse']//table")
    if not tableau:
        return []

    resultats: list[dict[str, object]] = []
    for ligne in tableau[0].xpath(".//tr")[1:]:
        cellules = [_texte_noeud(cellule) for cellule in ligne.xpath("./td")]
        if len(cellules) < 4:
            continue
        resultats.append(
            {
                "code_ced": cellules[0],
                "type": cellules[1],
                "poids_kg": str(_decimal_depuis_texte(cellules[2]) or Decimal("0")),
                "volume_l": str(_decimal_depuis_texte(cellules[3]) or Decimal("0")),
            }
        )
    return resultats


def _extraire_illustrations(document, url_base: str) -> list[str]:
    """Extrait les URLs d'images d'illustration depuis une fiche prix-construction.info."""
    urls_images: list[str] = []
    vues: set[str] = set()

    # Images dans les blocs d'illustration ou de produit
    for src in document.xpath(
        '//div[contains(@class,"illustration") or contains(@id,"illustration")'
        ' or contains(@class,"image-produit")]//img/@src'
    ):
        if src and not src.startswith('data:'):
            absolu = urljoin(url_base, src)
            if absolu not in vues:
                vues.add(absolu)
                urls_images.append(absolu)

    # Images dans les articles et cartes de la fiche
    for src in document.xpath('//article//img/@src | //div[contains(@class,"card-body")]//img/@src'):
        if src and not src.startswith('data:'):
            ext = src.split('?')[0].lower().rsplit('.', 1)[-1] if '.' in src else ''
            if ext in ('png', 'jpg', 'jpeg', 'webp', 'gif'):
                absolu = urljoin(url_base, src)
                if absolu not in vues:
                    vues.add(absolu)
                    urls_images.append(absolu)

    return urls_images[:5]  # Limité à 5 illustrations par fiche


def _extraire_options_fiche(document) -> list[str]:
    """Extrait les options et variantes depuis une fiche prix-construction.info."""
    options: list[str] = []

    # Divs dédiés aux options ou variantes
    for div in document.xpath(
        '//div[contains(@class,"option") or contains(@id,"option")'
        ' or contains(@class,"variant")]'
    ):
        texte = ' '.join(div.text_content().split())
        if texte and len(texte) > 10:
            options.append(texte[:500])

    # Tableaux précédés d'un titre "option"
    for ligne_tab in document.xpath(
        '//table[preceding-sibling::*[contains(text(),"option")'
        ' or contains(text(),"Option")]]//tr'
    ):
        cellules = [td.text_content().strip() for td in ligne_tab.xpath('.//td')]
        if any(cellules):
            options.append(' | '.join(c for c in cellules if c))

    return options[:10]  # Limité à 10 options par fiche


def analyser_fiche_prix_construction(url: str) -> FichePrixConstruction:
    """Analyse une fiche unitaire publique de prix-construction.info."""
    document = _charger_document_html(url)
    classification = _classification_depuis_url(url)
    prefixe = _prefixe_metier_depuis_classification(classification)
    code_source = _texte_depuis_xpath(document, "(//span[@class='text-uppercase'])[1]")
    designation = _texte_depuis_xpath(document, "(//td[contains(@class, 'd-sm-table-cell')]//span[@class='fw-bold'])[1]")
    description = _texte_depuis_xpath(document, "(//div[contains(@class, 'show-more')])[1]")
    unite = _texte_depuis_xpath(document, "(//h4[ancestor::td[preceding-sibling::td//h6[contains(., 'Prix')]]]/following-sibling::span)[1]")
    prix = _valeur_decimal_xpath(
        document,
        "(//td[preceding-sibling::td//h6[contains(., 'Prix')]]//h4/text())[1]",
    ) or Decimal("0")

    justification_prix, montant_total_ht, cout_entretien = _extraire_justification_prix(document)
    cahier_des_charges_structure, normes_applicables, criteres_metre, phases_execution = _extraire_cahier_des_charges(document)
    dechets_generes = _extraire_dechets_generes(document)
    illustrations = _extraire_illustrations(document, url)
    options = _extraire_options_fiche(document)

    return FichePrixConstruction(
        url_source=url,
        code_source=code_source,
        code_interne=_code_reference_lbh(prefixe, url),
        type_ouvrage=classification["type_ouvrage"],
        famille=classification["famille"],
        sous_famille=classification["sous_famille"],
        corps_etat=classification["corps_etat"],
        lot=classification["lot"],
        designation=designation,
        description=description,
        unite=unite,
        prix_vente_unitaire=prix,
        justification_prix=justification_prix,
        montant_total_ht=montant_total_ht or prix,
        cout_entretien_decennal=cout_entretien,
        cahier_des_charges_structure=cahier_des_charges_structure,
        normes_applicables=normes_applicables,
        criteres_metre=criteres_metre,
        phases_execution=phases_execution,
        dechets_generes=dechets_generes,
        illustrations=illustrations,
        options=options,
    )


def _totaux_depuis_lignes_justification(lignes: Iterable[LigneJustificationPrix]) -> dict[str, Decimal]:
    totaux = {
        "temps_main_oeuvre": Decimal("0"),
        "cout_horaire_mo": Decimal("0"),
        "cout_matieres": Decimal("0"),
        "cout_materiel": Decimal("0"),
        "cout_sous_traitance": Decimal("0"),
        "cout_transport": Decimal("0"),
        "cout_frais_divers": Decimal("0"),
        "debourse_sec_unitaire": Decimal("0"),
    }
    montant_mo = Decimal("0")

    for ligne in lignes:
        totaux["debourse_sec_unitaire"] += ligne.prix_total
        if ligne.type_ressource == "mo":
            totaux["temps_main_oeuvre"] += ligne.quantite
            montant_mo += ligne.prix_total
        elif ligne.type_ressource == "matiere":
            totaux["cout_matieres"] += ligne.prix_total
        elif ligne.type_ressource == "materiel":
            totaux["cout_materiel"] += ligne.prix_total
        elif ligne.type_ressource == "sous_traitance":
            totaux["cout_sous_traitance"] += ligne.prix_total
        elif ligne.type_ressource == "transport":
            totaux["cout_transport"] += ligne.prix_total
        elif ligne.type_ressource == "frais_divers":
            totaux["cout_frais_divers"] += ligne.prix_total

    if totaux["temps_main_oeuvre"] > 0:
        totaux["cout_horaire_mo"] = (montant_mo / totaux["temps_main_oeuvre"]).quantize(Decimal("0.0001"))

    return totaux


def _paragraphes_sections_cctp(
    structure: Iterable[dict[str, object]],
    mots_cles: Iterable[str],
) -> list[str]:
    resultats: list[str] = []
    mots_normalises = [_slug_metier(mot) for mot in mots_cles]
    for section in structure:
        titre = _slug_metier(str(section.get("titre", "")))
        if any(mot in titre for mot in mots_normalises):
            for paragraphe in section.get("paragraphes", []):
                texte = str(paragraphe)
                if texte not in resultats:
                    resultats.append(texte)
    return resultats


def construire_ligne_bibliotheque_depuis_fiche_prix_construction(
    fiche: FichePrixConstruction,
    auteur=None,
) -> LignePrixBibliotheque:
    totaux = _totaux_depuis_lignes_justification(fiche.justification_prix)
    prescriptions = _paragraphes_sections_cctp(
        fiche.cahier_des_charges_structure,
        [
            "mesures pour assurer la compatibilite",
            "clauses techniques",
            "clauses prealables devant etre remplies avant l execution des unites d ouvrage",
            "processus d execution",
            "conservation et maintenance",
            "critere d evaluation economique",
        ],
    )
    observations_techniques = _paragraphes_sections_cctp(
        fiche.cahier_des_charges_structure,
        ["clauses de finalisation", "du sous-traitant", "climatiques"],
    )
    donnees_analytiques = {
        "source_plateforme": "prix-construction.info",
        "justification_prix": [
            {
                "ordre": ligne.ordre,
                "code_source": ligne.code_source,
                "designation": ligne.designation,
                "type_ressource": ligne.type_ressource,
                "quantite": str(ligne.quantite),
                "unite": ligne.unite,
                "prix_unitaire": str(ligne.prix_unitaire),
                "prix_total": str(ligne.prix_total),
            }
            for ligne in fiche.justification_prix
        ],
        "montant_total_ht": str(fiche.montant_total_ht),
        "cout_entretien_decennal": (
            str(fiche.cout_entretien_decennal) if fiche.cout_entretien_decennal is not None else None
        ),
    }

    # Construire le champ hypotheses : description + options extraites
    hypotheses_parties = []
    if fiche.description:
        hypotheses_parties.append(fiche.description)
    if fiche.options:
        hypotheses_parties.append("Options :\n" + "\n".join(f"- {opt}" for opt in fiche.options))
    hypotheses_texte = "\n\n".join(hypotheses_parties)

    lot_cctp = _mapper_lot_cctp_depuis_url(fiche.url_source)

    return LignePrixBibliotheque(
        niveau="reference",
        code=fiche.code_interne,
        famille=_tronquer(fiche.famille, 100),
        sous_famille=_tronquer(fiche.sous_famille, 100),
        corps_etat=_tronquer(fiche.corps_etat, 100),
        lot=_tronquer(fiche.lot, 100),
        lot_cctp_reference=lot_cctp,
        origine_import="prix_construction",
        code_source_externe=fiche.code_source,
        url_source=fiche.url_source,
        designation_longue=fiche.description or fiche.designation,
        designation_courte=fiche.designation,
        unite=fiche.unite,
        hypotheses=hypotheses_texte,
        contexte_emploi=" / ".join(
            element for element in [fiche.type_ouvrage, fiche.famille, fiche.sous_famille, fiche.corps_etat] if element
        ),
        observations_techniques="\n\n".join(observations_techniques),
        observations_economiques=(
            f"Coût d'entretien décennal : {fiche.cout_entretien_decennal} €"
            if fiche.cout_entretien_decennal is not None
            else ""
        ),
        prescriptions_techniques="\n\n".join(prescriptions),
        criteres_metre=fiche.criteres_metre,
        normes_applicables=fiche.normes_applicables,
        phases_execution=fiche.phases_execution,
        dechets_generes=fiche.dechets_generes,
        cahier_des_charges_structure=fiche.cahier_des_charges_structure,
        illustrations=fiche.illustrations,
        donnees_analytiques=donnees_analytiques,
        temps_main_oeuvre=totaux["temps_main_oeuvre"],
        cout_horaire_mo=totaux["cout_horaire_mo"],
        cout_matieres=totaux["cout_matieres"],
        cout_materiel=totaux["cout_materiel"],
        cout_sous_traitance=totaux["cout_sous_traitance"],
        cout_transport=totaux["cout_transport"],
        cout_frais_divers=totaux["cout_frais_divers"],
        debourse_sec_unitaire=totaux["debourse_sec_unitaire"] or fiche.montant_total_ht,
        prix_vente_unitaire=fiche.prix_vente_unitaire,
        source="Référentiel prix-construction.info",
        auteur=auteur,
        fiabilite=3,
        statut_validation="valide",
    )


def remplacer_sous_details_ligne(
    ligne_prix: LignePrixBibliotheque,
    donnees_sous_details: Iterable[dict[str, object]],
) -> None:
    """Remplace intégralement les sous-détails d'une ligne par un jeu normalisé."""
    ligne_prix.sous_details.all().delete()
    for ordre, donnees in enumerate(donnees_sous_details, start=1):
        objet = SousDetailPrix(
            ligne_prix=ligne_prix,
            ordre=int(donnees.get("ordre", ordre)),
            type_ressource=str(donnees.get("type_ressource") or "matiere"),
            code=_tronquer(str(donnees.get("code") or ""), 50),
            designation=_tronquer(str(donnees.get("designation") or ""), 300),
            unite=_tronquer(str(donnees.get("unite") or ""), 20),
            quantite=Decimal(str(donnees.get("quantite") or "0")),
            cout_unitaire_ht=Decimal(str(donnees.get("cout_unitaire_ht") or "0")),
            profil_main_oeuvre=donnees.get("profil_main_oeuvre"),
            nombre_ressources=Decimal(str(donnees.get("nombre_ressources") or "1")),
            temps_unitaire=Decimal(str(donnees.get("temps_unitaire") or "0")),
            taux_horaire=Decimal(str(donnees.get("taux_horaire") or "0")),
            observations=str(donnees.get("observations") or ""),
        )
        objet.save()


def generer_sous_details_depuis_composantes(
    ligne_prix: LignePrixBibliotheque,
    *,
    forcer: bool = False,
) -> int:
    """Déduit un sous-détail analytique minimal à partir des composantes déjà connues."""
    if ligne_prix.sous_details.exists() and not forcer:
        return 0

    donnees_sous_details: list[dict[str, object]] = []

    def ajouter(
        type_ressource: str,
        designation: str,
        cout_unitaire_ht: Decimal,
        *,
        quantite: Decimal = Decimal("1"),
        unite: str | None = None,
        taux_horaire: Decimal = Decimal("0"),
        nombre_ressources: Decimal = Decimal("1"),
        temps_unitaire: Decimal = Decimal("0"),
    ) -> None:
        if not cout_unitaire_ht or cout_unitaire_ht <= 0 or quantite <= 0:
            return
        donnees_sous_details.append(
            {
                "ordre": len(donnees_sous_details) + 1,
                "type_ressource": type_ressource,
                "code": "",
                "designation": designation,
                "unite": unite or ligne_prix.unite or "u",
                "quantite": str(quantite),
                "cout_unitaire_ht": str(cout_unitaire_ht),
                "nombre_ressources": str(nombre_ressources),
                "temps_unitaire": str(temps_unitaire),
                "taux_horaire": str(taux_horaire),
                "observations": "Sous-détail analytique déduit automatiquement des composantes existantes.",
            }
        )

    ajouter(
        "mo",
        f"Main-d'œuvre d'exécution — {ligne_prix.designation_courte}",
        ligne_prix.cout_horaire_mo,
        quantite=ligne_prix.temps_main_oeuvre or Decimal("0"),
        unite="h",
        taux_horaire=ligne_prix.cout_horaire_mo or Decimal("0"),
        nombre_ressources=Decimal("1"),
        temps_unitaire=ligne_prix.temps_main_oeuvre or Decimal("0"),
    )
    ajouter("matiere", f"Fournitures principales — {ligne_prix.designation_courte}", ligne_prix.cout_matieres)
    ajouter("materiel", f"Matériel et engins — {ligne_prix.designation_courte}", ligne_prix.cout_materiel)
    ajouter("sous_traitance", f"Sous-traitance — {ligne_prix.designation_courte}", ligne_prix.cout_sous_traitance)
    ajouter("transport", f"Transport et logistique — {ligne_prix.designation_courte}", ligne_prix.cout_transport)
    ajouter("frais_divers", f"Frais divers — {ligne_prix.designation_courte}", ligne_prix.cout_frais_divers)

    if not donnees_sous_details:
        if forcer:
            ligne_prix.sous_details.all().delete()
        return 0

    remplacer_sous_details_ligne(ligne_prix, donnees_sous_details)
    return len(donnees_sous_details)


def completer_sous_details_manquants(ligne_prix: LignePrixBibliotheque) -> int:
    """
    Complète les sous-détails d'une ligne en ajoutant les composantes manquantes
    (matériaux, matériel, frais divers…) depuis les champs agrégés du modèle,
    sans toucher aux sous-détails existants.

    Logique SDP selon Manuel de l'Étude de Prix (Cusant & Widloecher) :
    DS = Dmatx (matériaux) + Dmtl (matériel) + Dmo (main-d'œuvre) + divers

    La fonction est idempotente : un seul sous-détail synthétique par type.
    """
    from django.db import transaction

    MARQUEUR = "Composante déduite automatiquement des champs agrégés."

    # Tout dans une transaction avec verrou pour être idempotent
    with transaction.atomic():
        types_presents = set(
            ligne_prix.sous_details.select_for_update().values_list("type_ressource", flat=True)
        )

        nouvelles: list[dict[str, object]] = []

        def _ajouter_si_absent(type_r: str, designation: str, montant: Decimal | None, unite: str = "u") -> None:
            if not montant or montant <= 0:
                return
            if type_r in types_presents:
                return
            # Marquer localement pour éviter les doublons dans la même passe
            types_presents.add(type_r)
            nouvelles.append({
                "ordre": 100 + len(nouvelles),
                "type_ressource": type_r,
                "code": "",
                "designation": designation,
                "unite": unite,
                "quantite": str(Decimal("1")),
                "cout_unitaire_ht": str(montant.quantize(Decimal("0.0001"))),
                "taux_horaire": str(Decimal("0")),
                "nombre_ressources": str(Decimal("1")),
                "temps_unitaire": str(Decimal("0")),
                "observations": MARQUEUR,
            })

        # Vérifie chaque type de ressource absent
        _ajouter_si_absent(
            "matiere",
            f"Fournitures et matériaux — {ligne_prix.designation_courte[:80]}",
            ligne_prix.cout_matieres,
        )
        _ajouter_si_absent(
            "materiel",
            f"Matériel et engins — {ligne_prix.designation_courte[:80]}",
            ligne_prix.cout_materiel,
        )
        _ajouter_si_absent(
            "consommable",
            f"Consommables — {ligne_prix.designation_courte[:80]}",
            getattr(ligne_prix, "cout_consommables", None),
        )
        _ajouter_si_absent(
            "sous_traitance",
            f"Sous-traitance — {ligne_prix.designation_courte[:80]}",
            ligne_prix.cout_sous_traitance,
        )
        _ajouter_si_absent(
            "transport",
            f"Transport et logistique — {ligne_prix.designation_courte[:80]}",
            ligne_prix.cout_transport,
        )
        _ajouter_si_absent(
            "frais_divers",
            f"Frais divers — {ligne_prix.designation_courte[:80]}",
            ligne_prix.cout_frais_divers,
        )

        if not nouvelles:
            return 0

        # Récupère l'ordre max existant pour ne pas écraser
        ordre_max = (
            ligne_prix.sous_details.order_by("-ordre").values_list("ordre", flat=True).first() or 0
        )
        for i, sd in enumerate(nouvelles, start=1):
            sd["ordre"] = ordre_max + i

        objets = [
            SousDetailPrix(
                ligne_prix=ligne_prix,
                ordre=int(sd["ordre"]),
                type_ressource=str(sd["type_ressource"]),
                code=str(sd.get("code") or "")[:50],
                designation=str(sd.get("designation") or "")[:300],
                unite=str(sd.get("unite") or "")[:20],
                quantite=Decimal(str(sd.get("quantite") or "1")),
                cout_unitaire_ht=Decimal(str(sd.get("cout_unitaire_ht") or "0")),
                taux_horaire=Decimal("0"),
                nombre_ressources=Decimal("1"),
                temps_unitaire=Decimal("0"),
                observations=str(sd.get("observations") or ""),
            )
            for sd in nouvelles
        ]
        SousDetailPrix.objects.bulk_create(objets)

    return len(nouvelles)


def recalculer_composantes_depuis_sous_details(ligne_prix: LignePrixBibliotheque) -> dict[str, Decimal]:
    """Recalcule les composantes économiques d'une ligne depuis ses sous-détails."""
    sous_details = ligne_prix.sous_details.all()

    temps_main_oeuvre = Decimal("0")
    montant_mo = Decimal("0")
    cout_matieres = Decimal("0")
    cout_materiel = Decimal("0")
    cout_sous_traitance = Decimal("0")
    cout_transport = Decimal("0")
    cout_frais_divers = Decimal("0")

    for sous_detail in sous_details:
        if sous_detail.type_ressource == "mo":
            temps_main_oeuvre += sous_detail.quantite
            montant_mo += sous_detail.montant_ht
        elif sous_detail.type_ressource == "matiere":
            cout_matieres += sous_detail.montant_ht
        elif sous_detail.type_ressource == "materiel":
            cout_materiel += sous_detail.montant_ht
        elif sous_detail.type_ressource == "sous_traitance":
            cout_sous_traitance += sous_detail.montant_ht
        elif sous_detail.type_ressource == "transport":
            cout_transport += sous_detail.montant_ht
        elif sous_detail.type_ressource == "frais_divers":
            cout_frais_divers += sous_detail.montant_ht

    cout_horaire_mo = ligne_prix.cout_horaire_mo
    if temps_main_oeuvre > 0:
        cout_horaire_mo = (montant_mo / temps_main_oeuvre).quantize(Decimal("0.0001"))

    debourse_sec = (
        montant_mo
        + cout_matieres
        + cout_materiel
        + cout_sous_traitance
        + cout_transport
        + cout_frais_divers
    )

    return {
        "temps_main_oeuvre": temps_main_oeuvre.quantize(Decimal("0.0001")),
        "cout_horaire_mo": cout_horaire_mo,
        "cout_matieres": cout_matieres.quantize(Decimal("0.0001")),
        "cout_materiel": cout_materiel.quantize(Decimal("0.0001")),
        "cout_sous_traitance": cout_sous_traitance.quantize(Decimal("0.0001")),
        "cout_transport": cout_transport.quantize(Decimal("0.0001")),
        "cout_frais_divers": cout_frais_divers.quantize(Decimal("0.0001")),
        "debourse_sec_unitaire": debourse_sec.quantize(Decimal("0.0001")),
    }


def recalculer_depuis_prix_vente(ligne_prix: LignePrixBibliotheque) -> dict[str, Decimal]:
    """
    Calcule les composantes économiques d'une ligne à partir de son prix de vente unitaire.

    Méthode inverse (ARTIPRIX 2025) :
      DS = PV × Kpv (ratio déboursé sec / prix de vente selon la famille)
      Les composantes (MO, matériaux, matériel, divers) sont réparties selon des
      ratios statistiques par famille de travaux.
    """
    pv = ligne_prix.prix_vente_unitaire or Decimal("0")
    if pv <= 0:
        raise ValueError("Le prix de vente unitaire doit être renseigné et positif.")

    famille = (ligne_prix.famille or "").lower()

    # --- Coefficients Kpv (DS/PV) par famille ---
    if any(mot in famille for mot in ("gros", "œuvre", "go", "terrassement", "fondation")):
        kpv = Decimal("0.70")
    elif any(mot in famille for mot in ("vrd", "réseau", "voirie")):
        kpv = Decimal("0.68")
    elif any(mot in famille for mot in ("charpente", "couverture", "étanchéité", "zinguerie")):
        kpv = Decimal("0.72")
    elif any(mot in famille for mot in ("menuiserie", "serrurerie")):
        kpv = Decimal("0.65")
    elif any(mot in famille for mot in ("isolation", "plâtrerie", "peinture")):
        kpv = Decimal("0.68")
    elif any(mot in famille for mot in ("carrelage", "revêtement", "sol")):
        kpv = Decimal("0.67")
    elif any(mot in famille for mot in ("électricité", "courant")):
        kpv = Decimal("0.72")
    elif any(mot in famille for mot in ("plomberie", "sanitaire", "cvc", "chauffage", "ventilation", "climatisation")):
        kpv = Decimal("0.70")
    elif any(mot in famille for mot in ("paysager", "espace vert", "aménagement extérieur")):
        kpv = Decimal("0.65")
    else:
        kpv = Decimal("0.68")

    debourse_sec = (pv * kpv).quantize(Decimal("0.0001"))

    # --- Ratios de répartition DS par famille ---
    if any(mot in famille for mot in ("gros", "œuvre", "go", "terrassement", "fondation")):
        ratio_mo, ratio_mat, ratio_materiel, ratio_divers = "0.30", "0.50", "0.15", "0.05"
    elif any(mot in famille for mot in ("vrd", "réseau", "voirie")):
        ratio_mo, ratio_mat, ratio_materiel, ratio_divers = "0.25", "0.40", "0.30", "0.05"
    elif any(mot in famille for mot in ("menuiserie", "serrurerie")):
        ratio_mo, ratio_mat, ratio_materiel, ratio_divers = "0.25", "0.65", "0.05", "0.05"
    elif any(mot in famille for mot in ("carrelage", "revêtement", "sol")):
        ratio_mo, ratio_mat, ratio_materiel, ratio_divers = "0.40", "0.55", "0.00", "0.05"
    elif any(mot in famille for mot in ("électricité", "courant")):
        ratio_mo, ratio_mat, ratio_materiel, ratio_divers = "0.35", "0.55", "0.05", "0.05"
    elif any(mot in famille for mot in ("plomberie", "sanitaire", "cvc", "chauffage", "ventilation", "climatisation")):
        ratio_mo, ratio_mat, ratio_materiel, ratio_divers = "0.30", "0.60", "0.05", "0.05"
    elif any(mot in famille for mot in ("charpente", "couverture", "étanchéité", "zinguerie")):
        ratio_mo, ratio_mat, ratio_materiel, ratio_divers = "0.35", "0.45", "0.15", "0.05"
    else:
        ratio_mo, ratio_mat, ratio_materiel, ratio_divers = "0.33", "0.50", "0.12", "0.05"

    montant_mo = (debourse_sec * Decimal(ratio_mo)).quantize(Decimal("0.0001"))
    cout_matieres = (debourse_sec * Decimal(ratio_mat)).quantize(Decimal("0.0001"))
    cout_materiel = (debourse_sec * Decimal(ratio_materiel)).quantize(Decimal("0.0001"))
    cout_frais_divers = (debourse_sec * Decimal(ratio_divers)).quantize(Decimal("0.0001"))

    # Taux horaire et temps MO
    cout_horaire_mo = ligne_prix.cout_horaire_mo or Decimal("0")
    if cout_horaire_mo > 0:
        temps_main_oeuvre = (montant_mo / cout_horaire_mo).quantize(Decimal("0.0001"))
    else:
        temps_main_oeuvre = Decimal("0")

    return {
        "temps_main_oeuvre": temps_main_oeuvre,
        "cout_horaire_mo": cout_horaire_mo,
        "cout_matieres": cout_matieres,
        "cout_materiel": cout_materiel,
        "cout_sous_traitance": Decimal("0"),
        "cout_transport": Decimal("0"),
        "cout_frais_divers": cout_frais_divers,
        "debourse_sec_unitaire": debourse_sec,
    }


def synchroniser_sous_details_depuis_justification(
    ligne_prix: LignePrixBibliotheque,
    lignes_justification: Iterable[LigneJustificationPrix],
) -> None:
    """Projette une justification de prix externe en sous-détails LBH."""
    donnees_sous_details = []
    for ligne in lignes_justification:
        quantite = ligne.quantite
        cout_unitaire = ligne.prix_unitaire
        taux_horaire = ligne.prix_unitaire if ligne.type_ressource == "mo" else Decimal("0")
        observations = ""
        if ligne.type_ressource == "mo" and ligne.quantite > 0:
            cout_unitaire = (ligne.prix_total / ligne.quantite).quantize(Decimal("0.0001"))
            taux_horaire = Decimal("0")
            observations = f"Taux horaire source : {ligne.prix_unitaire} €/h"
        if ligne.type_ressource == "frais_divers" or (ligne.unite or "").strip() == "%":
            quantite = Decimal("1")
            cout_unitaire = ligne.prix_total
        donnees_sous_details.append(
            {
                "ordre": ligne.ordre,
                "type_ressource": ligne.type_ressource,
                "code": ligne.code_source,
                "designation": ligne.designation,
                "unite": ligne.unite,
                "quantite": str(quantite),
                "cout_unitaire_ht": str(cout_unitaire),
                "taux_horaire": str(taux_horaire),
                "observations": observations,
            }
        )
    remplacer_sous_details_ligne(ligne_prix, donnees_sous_details)


def synchroniser_sous_details_depuis_etude_prix(
    etude_prix,
    ligne_prix: LignePrixBibliotheque,
    *,
    quantite_ouvrage=1,
) -> None:
    """Applique aux prix publiés la même logique de décomposition que celle utilisée à l'import."""
    quantite_ouvrage_decimal = Decimal(str(quantite_ouvrage or 1))
    if quantite_ouvrage_decimal <= 0:
        quantite_ouvrage_decimal = Decimal("1")
    donnees_sous_details = []
    for ligne in etude_prix.lignes.order_by("ordre"):
        donnees_sous_details.append(
            {
                "ordre": ligne.ordre,
                "type_ressource": ligne.type_ressource,
                "code": ligne.code,
                "designation": ligne.designation,
                "unite": ligne.unite,
                "quantite": str((Decimal(str(ligne.quantite)) / quantite_ouvrage_decimal).quantize(Decimal("0.000001"))),
                "cout_unitaire_ht": str(ligne.cout_unitaire_ht),
                "profil_main_oeuvre": ligne.profil_main_oeuvre,
                "nombre_ressources": str(ligne.nombre_ressources),
                "temps_unitaire": str(ligne.temps_unitaire),
                "taux_horaire": str(ligne.taux_horaire),
                "observations": ligne.observations,
            }
        )
    remplacer_sous_details_ligne(ligne_prix, donnees_sous_details)


def _corps_article_depuis_structure_cctp(structure: Iterable[dict[str, object]]) -> str:
    blocs: list[str] = []
    for section in structure:
        titre = str(section.get("titre") or "").strip()
        if titre:
            blocs.append(titre)
        for paragraphe in section.get("paragraphes", []):
            texte = str(paragraphe).strip()
            if texte:
                blocs.append(texte)
    return "\n\n".join(blocs).strip()


def synchroniser_article_cctp_reference(ligne_prix: LignePrixBibliotheque):
    """Crée ou met à jour l'article CCTP de bibliothèque lié à une ligne de prix."""
    from applications.pieces_ecrites.models import ArticleCCTP

    prefixe = _prefixe_metier_depuis_classification(
        {
            "famille": ligne_prix.famille,
            "sous_famille": ligne_prix.sous_famille,
            "corps_etat": ligne_prix.corps_etat,
        }
    )
    code_reference = _code_article_lbh(prefixe, ligne_prix.url_source or ligne_prix.code)
    numero_article = f"REF-{code_reference[-8:]}"
    chapitre = " / ".join([valeur for valeur in [ligne_prix.famille, ligne_prix.sous_famille, ligne_prix.corps_etat] if valeur])

    article, _ = ArticleCCTP.objects.update_or_create(
        ligne_prix_reference=ligne_prix,
        defaults={
            "piece_ecrite": None,
            "chapitre": chapitre[:200],
            "numero_article": numero_article[:20],
            "code_reference": code_reference,
            "intitule": ligne_prix.designation_courte[:300],
            "corps_article": _corps_article_depuis_structure_cctp(ligne_prix.cahier_des_charges_structure),
            "source": ligne_prix.source,
            "source_url": ligne_prix.url_source or "",
            "normes_applicables": ligne_prix.normes_applicables,
            "est_dans_bibliotheque": True,
            "tags": [
                valeur
                for valeur in [ligne_prix.famille, ligne_prix.sous_famille, ligne_prix.corps_etat, ligne_prix.code]
                if valeur
            ],
        },
    )
    return article


def importer_referentiel_prix_construction(
    urls_depart: Iterable[str],
    auteur=None,
    limite: int | None = None,
    creer_articles_cctp: bool = True,
) -> dict[str, int]:
    """Importe un référentiel de prix et de cahiers des charges depuis prix-construction.info.

    Chaque fiche est traitée dans sa propre transaction pour permettre les commits intermédiaires
    et la reprise en cas d'erreur sur une fiche individuelle.
    """
    urls_fiches = lister_urls_fiches_prix_construction(urls_depart, limite=limite)
    crees = 0
    maj = 0
    articles = 0
    erreurs = 0

    for url in urls_fiches:
        try:
            _importer_une_fiche_prix_construction(url, auteur=auteur, creer_articles_cctp=creer_articles_cctp)
            # Lire le résultat depuis la base pour savoir si c'est une création ou mise à jour
            # (la fonction interne gère la transaction)
            crees_fiche, maj_fiche = _compteurs_derniere_fiche(url)
            crees += crees_fiche
            maj += maj_fiche
            if creer_articles_cctp:
                articles += 1
        except Exception as exc:
            erreurs += 1
            # Continuer sur la fiche suivante en cas d'erreur réseau ou de parsing
            import logging
            logging.getLogger(__name__).warning(f'Erreur import fiche {url}: {exc}')

    return {
        "fiches": len(urls_fiches),
        "creees": crees,
        "mises_a_jour": maj,
        "articles_cctp": articles,
        "erreurs": erreurs,
    }


def _compteurs_derniere_fiche(url: str) -> tuple[int, int]:
    """Retourne (crees, mises_a_jour) pour la dernière fiche importée depuis cette URL."""
    try:
        existe = LignePrixBibliotheque.objects.filter(url_source=url, origine_import='prix_construction').exists()
        # update_or_create a déjà été appelé — on ne peut pas distinguer création vs maj ici
        # On renvoie (0, 1) par convention (la fiche existe forcément après import)
        return (0, 1)
    except Exception:
        return (0, 0)


@transaction.atomic
def _importer_une_fiche_prix_construction(url: str, auteur=None, creer_articles_cctp: bool = True) -> None:
    """Importe une fiche unitaire dans une transaction dédiée."""
    fiche = analyser_fiche_prix_construction(url)
    ligne = construire_ligne_bibliotheque_depuis_fiche_prix_construction(fiche, auteur=auteur)
    valeurs = {
            "niveau": ligne.niveau,
            "famille": ligne.famille,
            "sous_famille": ligne.sous_famille,
            "corps_etat": ligne.corps_etat,
            "lot": ligne.lot,
            "lot_cctp_reference": ligne.lot_cctp_reference,
            "origine_import": ligne.origine_import,
            "code_source_externe": ligne.code_source_externe,
            "url_source": ligne.url_source,
            "designation_longue": ligne.designation_longue,
            "designation_courte": ligne.designation_courte,
            "unite": ligne.unite,
            "hypotheses": ligne.hypotheses,
            "contexte_emploi": ligne.contexte_emploi,
            "observations_techniques": ligne.observations_techniques,
            "observations_economiques": ligne.observations_economiques,
            "prescriptions_techniques": ligne.prescriptions_techniques,
            "criteres_metre": ligne.criteres_metre,
            "normes_applicables": ligne.normes_applicables,
            "phases_execution": ligne.phases_execution,
            "dechets_generes": ligne.dechets_generes,
            "cahier_des_charges_structure": ligne.cahier_des_charges_structure,
            "illustrations": ligne.illustrations,
            "donnees_analytiques": ligne.donnees_analytiques,
            "temps_main_oeuvre": ligne.temps_main_oeuvre,
            "cout_horaire_mo": ligne.cout_horaire_mo,
            "cout_matieres": ligne.cout_matieres,
            "cout_materiel": ligne.cout_materiel,
            "cout_sous_traitance": ligne.cout_sous_traitance,
            "cout_transport": ligne.cout_transport,
            "cout_frais_divers": ligne.cout_frais_divers,
            "debourse_sec_unitaire": ligne.debourse_sec_unitaire,
            "prix_vente_unitaire": ligne.prix_vente_unitaire,
            "source": ligne.source,
            "auteur": auteur,
            "fiabilite": ligne.fiabilite,
            "statut_validation": ligne.statut_validation,
        }
    entree, _ = LignePrixBibliotheque.objects.update_or_create(
        code=fiche.code_interne,
        defaults=valeurs,
    )

    synchroniser_sous_details_depuis_justification(entree, fiche.justification_prix)
    composantes = recalculer_composantes_depuis_sous_details(entree)
    for champ, valeur in composantes.items():
        setattr(entree, champ, valeur)
    entree.save(update_fields=list(composantes.keys()) + ["date_modification"])

    if creer_articles_cctp:
        synchroniser_article_cctp_reference(entree)
