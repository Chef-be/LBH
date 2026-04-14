"""
Services métier — Capitalisation des prix marché et analyse de devis.

Chaîne DS → PV selon Manuel Cusant & Widloecher (Eyrolles 6e éd.) :
  DS = Dmatx + Dmtl + Dmo
  CD = DS + FC + Fop
  PV HT = CD / (1 - FG% - B&A%)
  Kpv = PV HT / DS
"""

from __future__ import annotations

import logging
import math
import re
import unicodedata
from decimal import Decimal, InvalidOperation
from typing import Optional

import requests
from django.db import transaction
from django.utils import timezone

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constantes — taux médianes BTP (calibrés sur ARTIPRIX 2025 + Manuel Cusant)
# ---------------------------------------------------------------------------

TAUX_FC_DEFAUT = Decimal("0.10")    # Frais de chantier — 10% DS (plage 5–15%)
TAUX_FOP_DEFAUT = Decimal("0.015")  # Frais d'opération — 1.5% DS (plage 1–2%)
TAUX_FG_DEFAUT = Decimal("0.10")    # Frais généraux — 10% PV (plage 8–12%)
TAUX_BA_DEFAUT = Decimal("0.06")    # Bénéfice & aléas — 6% PV (plage 4–8%)

# Kpv médiane : PV = DS × (1 + FC + Fop) / (1 - FG - B&A)
# = DS × 1.115 / 0.84 ≈ DS × 1.327
KPV_MEDIAN = (1 + TAUX_FC_DEFAUT + TAUX_FOP_DEFAUT) / (1 - TAUX_FG_DEFAUT - TAUX_BA_DEFAUT)

# URLs des services (noms de conteneurs Docker Compose)
URL_SERVICE_PDF = "http://lbh-analyse-pdf:8011"
URL_SERVICE_OCR = "http://lbh-ocr:8010"
URL_SERVICE_CAO = "http://lbh-analyse-cao:8012"

# ---------------------------------------------------------------------------
# Normalisation des désignations (pour détection de similarité)
# ---------------------------------------------------------------------------

_STOPWORDS = {
    "de", "du", "des", "le", "la", "les", "un", "une", "en", "et", "ou",
    "par", "pour", "sur", "sous", "avec", "sans", "dans", "au", "aux",
    "y", "compris", "fourni", "pose", "mise", "oeuvre", "œuvre",
}

_RE_UNITES = re.compile(
    r"\b(ml|m²|m2|m³|m3|m|u|ens|forf|kg|t|l|h|j|pse|u\.)\b",
    re.IGNORECASE,
)


def normaliser_designation(texte: str) -> str:
    texte = texte.lower().strip()
    texte = unicodedata.normalize("NFKD", texte)
    texte = "".join(c for c in texte if not unicodedata.combining(c))
    texte = _RE_UNITES.sub(" ", texte)
    texte = re.sub(r"[^a-z0-9\s]", " ", texte)
    mots = [m for m in texte.split() if m not in _STOPWORDS and len(m) > 2]
    return " ".join(mots)


def similarite_cosinus(texte_a: str, texte_b: str) -> float:
    mots_a = set(texte_a.split())
    mots_b = set(texte_b.split())
    if not mots_a or not mots_b:
        return 0.0
    intersection = mots_a & mots_b
    return len(intersection) / math.sqrt(len(mots_a) * len(mots_b))


# ---------------------------------------------------------------------------
# Récupération des paramètres configurables
# ---------------------------------------------------------------------------


def _lire_parametre_decimal(cle: str, defaut: Decimal) -> Decimal:
    try:
        from applications.parametres.models import Parametre
        p = Parametre.objects.get(cle=cle)
        return Decimal(str(p.valeur))
    except Exception:
        return defaut


def _lire_parametre_entier(cle: str, defaut: int) -> int:
    try:
        from applications.parametres.models import Parametre
        p = Parametre.objects.get(cle=cle)
        return int(p.valeur)
    except Exception:
        return defaut


def seuil_similarite() -> float:
    return float(_lire_parametre_decimal("RESSOURCES_SEUIL_SIMILARITE_PCT", Decimal("80"))) / 100


def retention_devis_jours() -> int:
    return _lire_parametre_entier("RESSOURCES_RETENTION_DEVIS_JOURS", 365)


# ---------------------------------------------------------------------------
# Indice BT/TP courant
# ---------------------------------------------------------------------------


def indice_bt_courant(code: str = "BT01") -> Optional[Decimal]:
    from .models import IndiceRevisionPrix
    try:
        return IndiceRevisionPrix.objects.filter(code=code).order_by("-date_publication").first().valeur
    except Exception:
        return None


def actualiser_prix(prix_original: Decimal, indice_base: Decimal, indice_actuel: Decimal) -> Decimal:
    if indice_base <= 0:
        return prix_original
    return (prix_original * indice_actuel / indice_base).quantize(Decimal("0.01"))


def actualiser_prix_revision(prix_original: Decimal, indice_base: Decimal, indice_actuel: Decimal) -> Decimal:
    if indice_base <= 0:
        return prix_original
    facteur = Decimal("0.125") + Decimal("0.875") * (indice_actuel / indice_base)
    return (prix_original * facteur).quantize(Decimal("0.01"))


# ---------------------------------------------------------------------------
# Estimation SDP depuis prix de vente (méthode inversée)
# ---------------------------------------------------------------------------

def _ratios_par_famille(famille: str, sous_famille: str = "") -> tuple[str, str, str, str, str]:
    ref = (famille + " " + sous_famille).lower()

    if any(m in ref for m in ("béton", "banche", "voile", "dalle", "poteau", "poutre", "coffrage")):
        return "0.72", "0.38", "0.27", "0.30", "0.05"
    if any(m in ref for m in ("terrassement", "déblai", "remblai", "excavation")):
        return "0.73", "0.10", "0.10", "0.75", "0.05"
    if any(m in ref for m in ("fondation", "radier", "semelle", "micropieu", "pieu")):
        return "0.71", "0.25", "0.40", "0.30", "0.05"
    if any(m in ref for m in ("maçonnerie", "parpaing", "brique", "bloc")):
        return "0.70", "0.35", "0.55", "0.05", "0.05"
    if any(m in ref for m in ("gros", "œuvre", "go")):
        return "0.71", "0.33", "0.40", "0.22", "0.05"
    if any(m in ref for m in ("vrd", "réseau", "voirie", "assainissement", "canalisation")):
        return "0.68", "0.22", "0.40", "0.33", "0.05"
    if any(m in ref for m in ("menuiserie extérieure", "vitrage", "aluminium", "façade")):
        return "0.64", "0.20", "0.72", "0.03", "0.05"
    if any(m in ref for m in ("menuiserie", "serrurerie")):
        return "0.66", "0.25", "0.65", "0.05", "0.05"
    if any(m in ref for m in ("carrelage", "faïence")):
        return "0.67", "0.42", "0.50", "0.03", "0.05"
    if any(m in ref for m in ("parquet", "plancher")):
        return "0.68", "0.30", "0.62", "0.03", "0.05"
    if any(m in ref for m in ("peinture",)):
        return "0.70", "0.50", "0.40", "0.05", "0.05"
    if any(m in ref for m in ("isolation", "plâtrerie", "enduit", "cloison")):
        return "0.68", "0.38", "0.50", "0.07", "0.05"
    if any(m in ref for m in ("électricité", "courant", "câblage")):
        return "0.72", "0.38", "0.52", "0.05", "0.05"
    if any(m in ref for m in ("plomberie", "sanitaire")):
        return "0.70", "0.30", "0.60", "0.05", "0.05"
    if any(m in ref for m in ("cvc", "chauffage", "ventilation", "climatisation")):
        return "0.71", "0.28", "0.60", "0.07", "0.05"
    if any(m in ref for m in ("charpente",)):
        return "0.72", "0.30", "0.45", "0.20", "0.05"
    if any(m in ref for m in ("couverture", "zinguerie")):
        return "0.72", "0.38", "0.48", "0.09", "0.05"
    if any(m in ref for m in ("étanchéité",)):
        return "0.70", "0.35", "0.50", "0.10", "0.05"
    if any(m in ref for m in ("paysager", "espace vert", "plantation")):
        return "0.65", "0.35", "0.40", "0.20", "0.05"
    if any(m in ref for m in ("démolition", "déconstruction")):
        return "0.68", "0.25", "0.05", "0.65", "0.05"

    return "0.70", "0.33", "0.47", "0.15", "0.05"


def estimer_sdp_depuis_prix(
    prix_ht: Decimal,
    famille: str = "",
    sous_famille: str = "",
) -> dict:
    kpv_ds_pv, r_mo, r_matx, r_matl, r_div = _ratios_par_famille(famille, sous_famille)
    kpv_ds_pv_d = Decimal(kpv_ds_pv)

    ds = (prix_ht * kpv_ds_pv_d).quantize(Decimal("0.0001"))
    kpv = (prix_ht / ds).quantize(Decimal("0.0001")) if ds > 0 else Decimal("0")

    montant_mo = (ds * Decimal(r_mo)).quantize(Decimal("0.0001"))
    montant_matx = (ds * Decimal(r_matx)).quantize(Decimal("0.0001"))
    montant_matl = (ds * Decimal(r_matl)).quantize(Decimal("0.0001"))
    montant_div = (ds * Decimal(r_div)).quantize(Decimal("0.0001"))

    fc = (ds * TAUX_FC_DEFAUT).quantize(Decimal("0.01"))
    fop = (ds * TAUX_FOP_DEFAUT).quantize(Decimal("0.01"))
    cd = ds + fc + fop
    pv_estime = (cd / (1 - TAUX_FG_DEFAUT - TAUX_BA_DEFAUT)).quantize(Decimal("0.01"))

    return {
        "debourse_sec": ds,
        "kpv": kpv,
        "montant_mo": montant_mo,
        "montant_materiaux": montant_matx,
        "montant_materiel": montant_matl,
        "montant_divers": montant_div,
        "pct_mo": float(Decimal(r_mo) * 100),
        "pct_materiaux": float(Decimal(r_matx) * 100),
        "pct_materiel": float(Decimal(r_matl) * 100),
        "fc_estime": fc,
        "fop_estime": fop,
        "cd_estime": cd,
        "pv_estime": pv_estime,
        "famille": famille,
    }


# ---------------------------------------------------------------------------
# Détection du corps d'état depuis la désignation
# ---------------------------------------------------------------------------

_MAPPING_CORPS_ETAT = [
    ("GO", ["béton", "banche", "voile", "dalle", "poteau", "fondation", "radier", "semelle",
            "maçonnerie", "parpaing", "brique", "ferraillage", "coffrage", "armature"]),
    ("TERR", ["terrassement", "déblai", "remblai", "excavation", "décaissement", "fouille"]),
    ("VRD", ["canalisation", "réseau", "voirie", "assainissement", "regard", "caniveau",
             "chaussée", "trottoir", "bordure", "grille"]),
    ("CHCZ", ["charpente", "couverture", "tuile", "ardoise", "zinguerie", "gouttière", "faîtage"]),
    ("ETAN", ["étanchéité", "membrane", "bitume", "iptm", "complexe", "terrasse"]),
    ("FAC", ["façade", "bardage", "ite", "isolation extérieure", "enduit extérieur"]),
    ("MENUEXT", ["fenêtre", "porte-fenêtre", "vitrage", "menuiserie extérieure", "aluminium"]),
    ("MENUINT", ["porte intérieure", "serrure", "menuiserie intérieure", "garde-corps", "escalier"]),
    ("IPP", ["isolation", "plâtrerie", "cloison", "enduit intérieur", "faux-plafond"]),
    ("RSC", ["carrelage", "faïence", "parquet", "revêtement", "sol souple", "moquette"]),
    ("IPP", ["peinture", "lasure", "vernis"]),
    ("ELEC", ["électricité", "câble", "tableau", "prise", "luminaire", "éclairage"]),
    ("PLB", ["plomberie", "sanitaire", "tuyauterie", "robinetterie", "eaux", "évacuation"]),
    ("CVC", ["chauffage", "ventilation", "climatisation", "cvc", "pac", "radiateur"]),
    ("PAY", ["paysager", "plantation", "engazonnement", "arbuste", "arbre"]),
]


def detecter_corps_etat(designation: str) -> tuple[str, str]:
    texte = designation.lower()
    for code, mots_cles in _MAPPING_CORPS_ETAT:
        if any(m in texte for m in mots_cles):
            try:
                from applications.pieces_ecrites.models import LotCCTP
                lot = LotCCTP.objects.get(code=code)
                return code, lot.intitule
            except Exception:
                return code, code
    return "", "Non classifié"


# ---------------------------------------------------------------------------
# Parsing du texte brut d'un devis (extrait par le service PDF)
# ---------------------------------------------------------------------------

# Patterns numériques pour détecter prix/quantité/montant
_RE_NOMBRE = re.compile(r"^[\d\s]+[.,]?\d*$")
_RE_PRIX = re.compile(r"([\d\s]{1,10}[.,]\d{1,4})")
_RE_UNITE = re.compile(
    r"\b(ml|m\.l\.|m²|m2|m³|m3|m\.3|u\.|ens\.?|forf\.?|kg|t\.?|l\.|h\.|j\.|pse|u|m|%)\b",
    re.IGNORECASE,
)

def _to_decimal_safe(val: str) -> Optional[Decimal]:
    if not val:
        return None
    val = val.strip().replace(" ", "").replace(",", ".")
    try:
        return Decimal(val)
    except InvalidOperation:
        return None


def parser_lignes_devis_depuis_texte(texte_brut: str) -> list[dict]:
    """
    Parse le texte brut d'un devis BTP pour en extraire les lignes.
    Stratégie :
    1. Chercher des lignes avec au moins un montant HT lisible (≥ 1 €)
    2. Extraire désignation, unité, quantité, prix unitaire, montant
    """
    lignes_extraites = []

    # Patterns de lignes de devis typiques
    # Format : DESIGNATION  UNITE  QUANTITE  PU_HT  MONTANT_HT
    # Ou : DESIGNATION  PU_HT  (si devis simplifié)
    _re_ligne_complete = re.compile(
        r"^(.{5,120}?)\s{2,}"          # désignation (au moins 5 car, séparée par ≥2 espaces)
        r"(m[l²³23]?|u\.?|ens\.?|forf\.?|kg|t|h|j)\s+"  # unité
        r"([\d\s]+[.,]\d+)\s+"         # quantité
        r"([\d\s]+[.,]\d+)\s+"         # prix unitaire HT
        r"([\d\s]+[.,]\d+)\s*$",       # montant HT
        re.IGNORECASE,
    )

    _re_ligne_simple = re.compile(
        r"^(.{10,200}?)\s{2,}"         # désignation (≥10 car, séparée par ≥2 espaces)
        r"([\d\s]{1,12}[.,]\d{2})\s*$",  # montant ou PU en fin de ligne
        re.IGNORECASE,
    )

    # Lignes avec motif montant explicite (chercher des montants ≥ 10 €)
    _re_montant_fin = re.compile(
        r"^(.{10,200}?)\s{2,}([\d ]{1,10}[,.]\d{2})\s*$"
    )

    for ligne in texte_brut.splitlines():
        ligne = ligne.strip()
        if not ligne or len(ligne) < 10:
            continue
        # Ignorer les lignes d'en-tête typiques
        if re.match(r"^(désignation|libellé|description|article|total|sous-total|tva|ttc|ht|page)", ligne, re.IGNORECASE):
            continue

        # Tenter la reconnaissance de ligne complète
        m = _re_ligne_complete.match(ligne)
        if m:
            designation = m.group(1).strip()
            unite = m.group(2).strip()
            quantite = _to_decimal_safe(m.group(3))
            prix_u = _to_decimal_safe(m.group(4))
            montant = _to_decimal_safe(m.group(5))
            if prix_u and prix_u >= Decimal("1") and designation:
                lignes_extraites.append({
                    "designation": designation,
                    "unite": unite,
                    "quantite": float(quantite or 1),
                    "prix_unitaire": float(prix_u),
                    "montant": float(montant or (prix_u * (quantite or 1))),
                })
                continue

        # Tenter la reconnaissance de ligne simplifiée (désig + montant en fin)
        m2 = _re_montant_fin.match(ligne)
        if m2:
            designation = m2.group(1).strip()
            montant = _to_decimal_safe(m2.group(2))
            if montant and montant >= Decimal("10") and designation and len(designation) >= 10:
                # Chercher une unité dans la désignation
                unite = ""
                u_m = _RE_UNITE.search(designation)
                if u_m:
                    unite = u_m.group(0)
                    designation = designation[:u_m.start()].strip()
                lignes_extraites.append({
                    "designation": designation,
                    "unite": unite,
                    "quantite": 1.0,
                    "prix_unitaire": float(montant),
                    "montant": float(montant),
                })
                continue

    # Dédoublonnage par désignation normalisée
    vus = set()
    lignes_dedup = []
    for l in lignes_extraites:
        cle = normaliser_designation(l["designation"])[:60]
        if cle not in vus:
            vus.add(cle)
            lignes_dedup.append(l)

    logger.info("Parser devis : %d lignes trouvées dans le texte brut", len(lignes_dedup))
    return lignes_dedup


# ---------------------------------------------------------------------------
# Analyse d'un devis (via service PDF → texte brut → parsing)
# ---------------------------------------------------------------------------


def analyser_devis(devis_analyse) -> list[dict]:
    """
    Envoie le fichier au service PDF (lbh-analyse-pdf:8011/pdf/analyser),
    récupère le texte brut, le parse pour extraire les lignes, et les
    enregistre en LignePrixMarche.
    """
    from .models import LignePrixMarche

    texte_brut = ""

    try:
        with devis_analyse.fichier.open("rb") as f:
            resp = requests.post(
                f"{URL_SERVICE_PDF}/pdf/analyser",
                files={"fichier": (devis_analyse.nom_original, f, "application/pdf")},
                timeout=120,
            )
            resp.raise_for_status()
            data = resp.json()
            texte_brut = data.get("texte_brut", "")
            logger.info(
                "Service PDF : %d caractères extraits, %d tableaux, %d images",
                len(texte_brut),
                data.get("nb_tableaux", 0),
                data.get("nb_images", 0),
            )
    except requests.exceptions.ConnectionError:
        logger.warning("Service PDF non disponible (lbh-analyse-pdf:8011)")
    except requests.exceptions.HTTPError as exc:
        logger.error("Erreur HTTP service PDF : %s", exc)
    except Exception as exc:
        logger.error("Erreur service PDF : %s", exc)

    # Parser le texte brut
    lignes_brutes = parser_lignes_devis_depuis_texte(texte_brut) if texte_brut else []

    # Récupérer l'indice courant pour actualisation
    indice_actuel = indice_bt_courant(devis_analyse.indice_base_code or "BT01")
    indice_base = devis_analyse.indice_base_valeur

    lignes_extraites = []
    seuil = seuil_similarite()

    with transaction.atomic():
        for ligne in lignes_brutes:
            designation = str(ligne.get("designation", "")).strip()
            if not designation:
                continue

            unite = str(ligne.get("unite", "")).strip()
            try:
                prix_ht = Decimal(str(ligne.get("prix_unitaire", 0)))
            except (InvalidOperation, TypeError):
                prix_ht = Decimal("0")
            try:
                montant_ht = Decimal(str(ligne.get("montant", 0)))
            except (InvalidOperation, TypeError):
                montant_ht = Decimal("0")
            try:
                quantite = Decimal(str(ligne.get("quantite", 1)))
            except (InvalidOperation, TypeError):
                quantite = Decimal("1")

            if prix_ht <= 0 and montant_ht > 0 and quantite > 0:
                prix_ht = (montant_ht / quantite).quantize(Decimal("0.0001"))

            if prix_ht <= 0:
                continue

            code_lot, libelle_lot = detecter_corps_etat(designation)
            sdp = estimer_sdp_depuis_prix(prix_ht, libelle_lot)

            prix_actualise = None
            if indice_base and indice_actuel:
                prix_actualise = actualiser_prix(prix_ht, indice_base, indice_actuel)

            designation_norm = normaliser_designation(designation)
            ligne_existante = trouver_ligne_similaire(designation_norm, code_lot, seuil)

            if ligne_existante:
                n = ligne_existante.nb_occurrences
                nouveau_prix = ((ligne_existante.prix_ht_original * n + prix_ht) / (n + 1)).quantize(Decimal("0.0001"))
                ligne_existante.prix_ht_original = nouveau_prix
                ligne_existante.nb_occurrences = n + 1
                ligne_existante.est_ligne_commune = True
                if prix_actualise and indice_base:
                    ligne_existante.prix_ht_actualise = actualiser_prix(nouveau_prix, indice_base, indice_actuel)
                ligne_existante.save()
                ligne_marche = ligne_existante
                est_fusion = True
            else:
                ligne_marche = LignePrixMarche.objects.create(
                    devis_source=devis_analyse,
                    designation=designation,
                    designation_normalisee=designation_norm,
                    unite=unite,
                    prix_ht_original=prix_ht,
                    prix_ht_actualise=prix_actualise,
                    date_indice_actualisation=timezone.now().date() if prix_actualise else None,
                    indice_code=devis_analyse.indice_base_code or "BT01",
                    indice_valeur_base=indice_base,
                    indice_valeur_actuelle=indice_actuel,
                    localite=devis_analyse.localite or "",
                    corps_etat=code_lot,
                    corps_etat_libelle=libelle_lot,
                    debourse_sec_estime=sdp.get("debourse_sec"),
                    kpv_estime=sdp.get("kpv"),
                    pct_mo_estime=sdp.get("pct_mo"),
                    pct_materiaux_estime=sdp.get("pct_materiaux"),
                    pct_materiel_estime=sdp.get("pct_materiel"),
                )
                est_fusion = False

            lignes_extraites.append({
                "id": str(ligne_marche.id),
                "designation": designation,
                "unite": unite,
                "quantite": float(quantite),
                "prix_ht_original": float(prix_ht),
                "prix_ht_actualise": float(prix_actualise) if prix_actualise else None,
                "corps_etat": code_lot,
                "corps_etat_libelle": libelle_lot,
                "sdp": {k: float(v) for k, v in sdp.items() if isinstance(v, Decimal)},
                "est_fusion": est_fusion,
            })

    return lignes_extraites


def trouver_ligne_similaire(
    designation_norm: str,
    corps_etat: str,
    seuil: float,
):
    from .models import LignePrixMarche

    candidats = LignePrixMarche.objects.filter(
        corps_etat=corps_etat,
    ).exclude(designation_normalisee="")[:500]

    meilleur_score = 0.0
    meilleure_ligne = None

    for candidat in candidats:
        score = similarite_cosinus(designation_norm, candidat.designation_normalisee)
        if score > meilleur_score:
            meilleur_score = score
            meilleure_ligne = candidat

    if meilleur_score >= seuil:
        return meilleure_ligne
    return None


# ---------------------------------------------------------------------------
# Extraction de métadonnées depuis le texte brut d'un devis
# ---------------------------------------------------------------------------

_RE_DATE_LABEL = re.compile(
    r"(?:date\s+(?:d[eu']?\s+)?(?:devis|offre|émission|proposition|établissement)?|"
    r"établi\s+le|émis\s+le|fait\s+le|le\s*:)\s*[:\s]*"
    r"(\d{1,2}[\s\/\-\.]\d{1,2}[\s\/\-\.]\d{4})",
    re.IGNORECASE,
)
_RE_DATE_FR = re.compile(r"\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})\b")
_RE_CP_VILLE = re.compile(r"\b((?:F[\s\-])?\d{5})\s+([A-ZÀ-Ü][A-Za-zÀ-üÀ-ü\s\-]{2,35})")
_RE_LOCALITE_LABEL = re.compile(
    r"(?:localité|ville|commune|chantier|lieu des travaux|agence|adresse des travaux)"
    r"\s*[:\s]+([A-ZÀ-Ü][^\n\r]{2,60})",
    re.IGNORECASE,
)
_RE_ENTREPRISE_LABEL = re.compile(
    r"(?:entreprise|société|émetteur|prestataire|établie par|présentée par|titulaire|de\s*:)"
    r"\s*[:\s]+([A-ZÀ-Ü][^\n\r]{3,80})",
    re.IGNORECASE,
)
_RE_FORME_JURIDIQUE = re.compile(
    r"([A-ZÀ-Ü][A-Za-zÀ-üÀ-ü&\-'. ]{2,50})"
    r"\s+(?:SARL|SAS\b|SA\b|EURL|SNC|SASU|EI\b|EIRL|SCI|SCOP|GIE|SEM|SEML|SPL|EPIC|SARI)\b",
)


def extraire_metadonnees_devis(texte_brut: str, nom_fichier: str = "") -> dict:
    """
    Analyse les premiers caractères du texte brut d'un devis PDF pour en déduire
    les métadonnées : entreprise, localité, date d'émission, type de document,
    indice BT dominant.
    Retourne un dict avec les clés du modèle DevisAnalyse (chaînes vides si non détecté).
    """
    resultat: dict = {
        "entreprise": "",
        "localite": "",
        "date_emission": "",
        "type_document": "devis",
        "indice_base_code": "BT01",
    }

    # N'analyser que les premières lignes (en-tête du document)
    texte_entete = texte_brut[:3000]
    texte_upper = texte_entete.upper()

    # --- Type de document (texte + nom de fichier) ---
    nom_up = nom_fichier.upper()
    for cle in (texte_upper, nom_up):
        if "DPGF" in cle or "DÉCOMPOSITION DU PRIX" in cle:
            resultat["type_document"] = "dpgf"; break
        if "DQE" in cle or "DÉTAIL QUANTITATIF" in cle or "DETAIL QUANTITATIF" in cle:
            resultat["type_document"] = "dqe"; break
        if "BORDEREAU DE PRIX" in cle or re.search(r"\bBPU\b", cle):
            resultat["type_document"] = "bpu"; break
        if "BON DE COMMANDE" in cle:
            resultat["type_document"] = "bon_commande"; break

    # --- Entreprise ---
    m = _RE_ENTREPRISE_LABEL.search(texte_entete)
    if m:
        resultat["entreprise"] = m.group(1).strip()[:100]
    else:
        m2 = _RE_FORME_JURIDIQUE.search(texte_entete)
        if m2:
            resultat["entreprise"] = m2.group(0).strip()[:100]

    # --- Date (cherche d'abord avec label, sinon première date valide) ---
    m = _RE_DATE_LABEL.search(texte_entete)
    date_str = m.group(1).strip() if m else ""
    if not date_str:
        m2 = _RE_DATE_FR.search(texte_entete)
        if m2:
            date_str = f"{m2.group(1)}/{m2.group(2)}/{m2.group(3)}"

    if date_str:
        # Normaliser en YYYY-MM-DD
        md = re.match(r"(\d{1,2})[\s\/\-\.](\d{1,2})[\s\/\-\.](\d{4})", date_str)
        if md:
            j, mo, a = md.group(1).zfill(2), md.group(2).zfill(2), md.group(3)
            resultat["date_emission"] = f"{a}-{mo}-{j}"

    # --- Localité ---
    m = _RE_LOCALITE_LABEL.search(texte_entete)
    if m:
        resultat["localite"] = m.group(1).strip()[:100]
    else:
        m2 = _RE_CP_VILLE.search(texte_entete)
        if m2:
            resultat["localite"] = f"{m2.group(1)} {m2.group(2).strip()}"[:100]

    # --- Indice BT dominant (corps d'état le plus mentionné) ---
    familles = {
        "BT01": ["béton", "maçonnerie", "gros oeuvre", "coffrages", "ferraillage"],
        "BT28": ["peinture", "enduit peinture", "lasure"],
        "BT37": ["menuiserie bois", "parquet", "escalier bois"],
        "BT40": ["serrurerie", "métallerie", "garde-corps"],
        "BT50": ["plomberie", "sanitaire", "tuyauterie"],
        "BT51": ["chauffage", "cvc", "ventilation", "climatisation"],
        "BT60": ["électricité", "câblage", "tableau électrique"],
        "TP01": ["terrassement", "voirie", "vrd", "canalisation", "déblai"],
    }
    texte_lower = texte_brut[:6000].lower()
    scores = {code: sum(texte_lower.count(m) for m in mots) for code, mots in familles.items()}
    best = max(scores, key=scores.get)
    if scores[best] > 0:
        resultat["indice_base_code"] = best

    logger.debug(
        "Métadonnées extraites : entreprise=%r localite=%r date=%r type=%s indice=%s",
        resultat["entreprise"], resultat["localite"], resultat["date_emission"],
        resultat["type_document"], resultat["indice_base_code"],
    )
    return resultat


def previsualiser_devis_depuis_fichier(fichier_bytes: bytes, nom_fichier: str) -> dict:
    """
    Appelle le service PDF pour extraire le texte brut, puis en dérive les métadonnées.
    Retourne les métadonnées suggérées (sans créer d'enregistrement en base).
    """
    texte_brut = ""
    try:
        resp = requests.post(
            f"{URL_SERVICE_PDF}/pdf/analyser",
            files={"fichier": (nom_fichier, fichier_bytes, "application/pdf")},
            timeout=30,
        )
        resp.raise_for_status()
        texte_brut = resp.json().get("texte_brut", "")
    except requests.exceptions.ConnectionError:
        logger.warning("Service PDF non disponible pour la prévisualisation")
    except Exception as exc:
        logger.warning("Erreur prévisualisation : %s", exc)

    return extraire_metadonnees_devis(texte_brut, nom_fichier)


# ---------------------------------------------------------------------------
# Actualisation périodique
# ---------------------------------------------------------------------------


def actualiser_toutes_les_lignes(code_indice: str = "BT01") -> int:
    from .models import LignePrixMarche

    indice_val = indice_bt_courant(code_indice)
    if not indice_val:
        logger.warning("Aucun indice %s disponible pour l'actualisation", code_indice)
        return 0

    lignes = LignePrixMarche.objects.filter(
        indice_code=code_indice,
        indice_valeur_base__isnull=False,
        indice_valeur_base__gt=0,
    )

    nb = 0
    for ligne in lignes.iterator(chunk_size=500):
        ligne.prix_ht_actualise = actualiser_prix(ligne.prix_ht_original, ligne.indice_valeur_base, indice_val)
        ligne.indice_valeur_actuelle = indice_val
        ligne.date_indice_actualisation = timezone.now().date()
        ligne.save(update_fields=["prix_ht_actualise", "indice_valeur_actuelle", "date_indice_actualisation"])
        nb += 1

    logger.info("Actualisation terminée : %d lignes mises à jour (indice %s = %s)", nb, code_indice, indice_val)
    return nb


# ---------------------------------------------------------------------------
# Capitalisation → bibliothèque
# ---------------------------------------------------------------------------


def capitaliser_ligne_en_bibliotheque(ligne_marche) -> "LignePrixBibliotheque":
    from applications.bibliotheque.models import LignePrixBibliotheque
    from applications.pieces_ecrites.models import ArticleCCTP, LotCCTP
    from applications.bibliotheque.services import generer_sous_details_depuis_composantes

    prix_ref = ligne_marche.prix_ht_actualise or ligne_marche.prix_ht_original
    sdp = estimer_sdp_depuis_prix(prix_ref, ligne_marche.corps_etat_libelle)

    with transaction.atomic():
        lot = None
        if ligne_marche.corps_etat:
            try:
                lot = LotCCTP.objects.get(code=ligne_marche.corps_etat)
            except LotCCTP.DoesNotExist:
                pass

        ligne_bib, creee = LignePrixBibliotheque.objects.update_or_create(
            designation_courte=ligne_marche.designation[:200],
            defaults={
                "unite": ligne_marche.unite or "U",
                "prix_vente_unitaire": prix_ref,
                "debourse_sec_unitaire": sdp["debourse_sec"],
                "cout_matieres": sdp["montant_materiaux"],
                "cout_materiel": sdp["montant_materiel"],
                "cout_main_oeuvre": sdp["montant_mo"],
                "cout_frais_divers": sdp["montant_divers"],
                "famille": ligne_marche.corps_etat_libelle or "",
                "source": f"Prix marché — {ligne_marche.localite or 'France'}",
                "lot_cctp_reference": lot,
            },
        )

        ligne_marche.ligne_bibliotheque = ligne_bib
        ligne_marche.save(update_fields=["ligne_bibliotheque"])

        if creee:
            generer_sous_details_depuis_composantes(ligne_bib, forcer=True)

        if lot:
            ArticleCCTP.objects.get_or_create(
                intitule=ligne_marche.designation[:200],
                lot=lot,
                defaults={
                    "corps_article": f"<p>{ligne_marche.designation}</p>",
                    "est_dans_bibliotheque": True,
                    "ligne_prix_reference": ligne_bib,
                    "source": f"Capitalisé depuis prix marché — {ligne_marche.localite or ''}",
                },
            )

    return ligne_bib


# ---------------------------------------------------------------------------
# Analyse d'estimation pour fiches ratio
# ---------------------------------------------------------------------------


def analyser_estimation_source(source) -> dict:
    """
    Analyse un document source d'estimation via le service PDF et/ou OCR.
    Le service CAO est utilisé pour les fichiers DXF.
    Retourne un dict compatible avec les champs de FicheRatioCout.
    """
    resultats = {
        "shon": None,
        "shab": None,
        "emprise_sol": None,
        "niveaux_hs": None,
        "niveaux_ss": None,
        "type_fondation": "non_identifie",
        "cout_total_ht": None,
        "observations": "",
    }

    nom = (source.nom_original or "").lower()
    est_dxf = nom.endswith(".dxf") or nom.endswith(".dwg")

    # ---- Service CAO (fichiers DXF) ----
    if est_dxf:
        try:
            with source.fichier.open("rb") as f:
                resp = requests.post(
                    f"{URL_SERVICE_CAO}/cao/analyser",
                    files={"fichier": (source.nom_original, f)},
                    timeout=180,
                )
                resp.raise_for_status()
                data = resp.json()
                # Extraire l'emprise (bounding box en unités du DXF)
                emprise = data.get("emprise") or {}
                if emprise:
                    xmin = emprise.get("xmin", 0)
                    xmax = emprise.get("xmax", 0)
                    ymin = emprise.get("ymin", 0)
                    ymax = emprise.get("ymax", 0)
                    largeur = abs(xmax - xmin)
                    hauteur = abs(ymax - ymin)
                    # En DXF, les coordonnées sont souvent en millimètres ou en mètres
                    # Si les dimensions semblent en mm (> 1000), convertir en m
                    if largeur > 1000 or hauteur > 1000:
                        largeur /= 1000
                        hauteur /= 1000
                    superficie = round(largeur * hauteur, 2)
                    if superficie > 1:
                        resultats["emprise_sol"] = Decimal(str(superficie))
                        # Estimation SHON depuis emprise × nb niveaux probable
                        resultats["shon"] = resultats["emprise_sol"]

                # Extraire le nb de niveaux depuis les calques
                calques = [c.lower() for c in data.get("calques", [])]
                hs = sum(1 for c in calques if re.search(r"(niv|niveau|etage|r[+]\d|rdc)", c))
                ss = sum(1 for c in calques if re.search(r"(ss|sous.sol|sous_sol|basement)", c))
                if hs > 0:
                    resultats["niveaux_hs"] = hs
                if ss > 0:
                    resultats["niveaux_ss"] = ss

                logger.info(
                    "Service CAO : %d calques, %d entités, emprise=%s m²",
                    data.get("nb_calques", 0),
                    data.get("nb_entites", 0),
                    resultats.get("emprise_sol"),
                )
        except requests.exceptions.ConnectionError:
            logger.warning("Service CAO non disponible (lbh-analyse-cao:8012)")
        except Exception as exc:
            logger.error("Erreur service CAO : %s", exc)

    # ---- Service PDF (tous les fichiers PDF/image) ----
    if not est_dxf:
        try:
            with source.fichier.open("rb") as f:
                resp = requests.post(
                    f"{URL_SERVICE_PDF}/pdf/analyser",
                    files={"fichier": (source.nom_original, f, "application/pdf")},
                    timeout=120,
                )
                resp.raise_for_status()
                data = resp.json()
                texte = data.get("texte_brut", "")
                if texte:
                    montant = _extraire_montant_total(texte)
                    if montant:
                        resultats["cout_total_ht"] = montant
                        resultats["observations"] = f"Montant extrait du PDF : {montant} €"
                    # Surfaces
                    shon = _extraire_surface(texte, ("shon", "surface hors œuvre nette", "surface totale"))
                    shab = _extraire_surface(texte, ("shab", "surface habitable", "surface de plancher"))
                    emprise = _extraire_surface(texte, ("emprise", "emprise au sol"))
                    if shon:
                        resultats["shon"] = shon
                    if shab:
                        resultats["shab"] = shab
                    if emprise:
                        resultats["emprise_sol"] = emprise
                    # Niveaux
                    niv = _extraire_niveaux(texte)
                    if niv:
                        resultats["niveaux_hs"] = niv
                    # Type fondation
                    resultats["type_fondation"] = _detecter_fondation(texte)
        except requests.exceptions.ConnectionError:
            logger.warning("Service PDF non disponible (lbh-analyse-pdf:8011)")
        except Exception as exc:
            logger.error("Erreur service PDF estimation : %s", exc)

    # ---- Service OCR pour les images ----
    nom_base = nom.rsplit(".", 1)[-1] if "." in nom else ""
    est_image = nom_base in ("jpg", "jpeg", "png", "tif", "tiff", "bmp")

    if est_image and not resultats["cout_total_ht"]:
        try:
            with source.fichier.open("rb") as f:
                resp = requests.post(
                    f"{URL_SERVICE_OCR}/ocr/extraire",
                    files={"fichier": (source.nom_original, f)},
                    timeout=120,
                )
                resp.raise_for_status()
                data = resp.json()
                texte = data.get("texte", "")
                if texte:
                    montant = _extraire_montant_total(texte)
                    if montant:
                        resultats["cout_total_ht"] = montant
                        confiance = data.get("confiance", 0)
                        resultats["observations"] = f"Montant extrait par OCR (confiance {confiance:.0%}) : {montant} €"
                    resultats["type_fondation"] = _detecter_fondation(texte)
                    shon = _extraire_surface(texte, ("shon", "surface hors œuvre"))
                    if shon:
                        resultats["shon"] = shon
        except requests.exceptions.ConnectionError:
            logger.warning("Service OCR non disponible (lbh-ocr:8010)")
        except Exception as exc:
            logger.error("Erreur service OCR : %s", exc)

    return resultats


def _to_decimal(val) -> Optional[Decimal]:
    if val is None:
        return None
    try:
        return Decimal(str(val))
    except Exception:
        return None


def _extraire_montant_total(texte: str) -> Optional[Decimal]:
    patterns = [
        r"total\s+(?:général\s+)?ht\s*[:\s]+([0-9\s]+[.,]\d{2})\s*€?",
        r"montant\s+ht\s*[:\s]+([0-9\s]+[.,]\d{2})\s*€?",
        r"total\s+(?:général|travaux)\s*[:\s]+([0-9\s]+[.,]\d{2})\s*€?",
        r"([0-9\s]{4,12}[.,]\d{2})\s*€?\s*(?:ht|hors\s+taxe)\s*$",
    ]
    for pattern in patterns:
        m = re.search(pattern, texte, re.IGNORECASE | re.MULTILINE)
        if m:
            valeur_str = m.group(1).replace(" ", "").replace(",", ".")
            try:
                val = Decimal(valeur_str)
                if val > 100:  # Ignorer les valeurs absurdes
                    return val
            except InvalidOperation:
                pass
    return None


def _extraire_surface(texte: str, cles: tuple) -> Optional[Decimal]:
    """Extrait une surface en m² depuis le texte."""
    for cle in cles:
        pattern = rf"{re.escape(cle)}\s*[=:]*\s*([\d\s]+[.,]?\d*)\s*m[²2]?"
        m = re.search(pattern, texte, re.IGNORECASE)
        if m:
            val = _to_decimal_safe(m.group(1))
            if val and val > 1:
                return val
    return None


def _extraire_niveaux(texte: str) -> Optional[int]:
    """Extrait le nombre de niveaux hors sol depuis le texte."""
    patterns = [
        r"(r\+\d+)",
        r"(\d+)\s+(?:niveaux?|étages?)\s+(?:hors\s+sol|hs)",
        r"(\d+)\s+niveaux?\s+au-dessus",
    ]
    for pattern in patterns:
        m = re.search(pattern, texte, re.IGNORECASE)
        if m:
            g = m.group(1)
            if g.lower().startswith("r+"):
                try:
                    return int(g[2:]) + 1  # R+3 = 4 niveaux
                except ValueError:
                    pass
            else:
                try:
                    return int(g)
                except ValueError:
                    pass
    return None


def _detecter_fondation(texte: str) -> str:
    texte = texte.lower()
    if "micropieu" in texte:
        return "profonde_micropieux"
    if "paroi moulée" in texte or "paroi moulee" in texte:
        return "profonde_paroi_moulee"
    if "pieu métallique" in texte or "pieu metallique" in texte:
        return "profonde_pieux_metalliques"
    if "pieu foré" in texte or "pieux béton" in texte or "pieux beton" in texte:
        return "profonde_pieux_beton"
    if "radier" in texte:
        return "superficielle_radier"
    if "semelle" in texte:
        return "superficielle_semelle"
    return "non_identifie"
