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
from decimal import Decimal
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

# URLs des services d'analyse
URL_SERVICE_PDF = "http://localhost:8011"
URL_SERVICE_OCR = "http://localhost:8010"
URL_SERVICE_CAO = "http://localhost:8012"

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
    """
    Normalise une désignation pour la comparaison de similarité :
    - Minuscules
    - Suppression des accents
    - Suppression des stopwords et unités
    - Suppression des caractères non alphabétiques
    """
    texte = texte.lower().strip()
    texte = unicodedata.normalize("NFKD", texte)
    texte = "".join(c for c in texte if not unicodedata.combining(c))
    texte = _RE_UNITES.sub(" ", texte)
    texte = re.sub(r"[^a-z0-9\s]", " ", texte)
    mots = [m for m in texte.split() if m not in _STOPWORDS and len(m) > 2]
    return " ".join(mots)


def similarite_cosinus(texte_a: str, texte_b: str) -> float:
    """
    Calcule la similarité cosinus TF-IDF simplifiée entre deux désignations normalisées.
    Retourne un score entre 0 et 1.
    """
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
    """Lit un paramètre de type décimal depuis la table Parametre."""
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
    """Seuil de similarité pour la fusion des lignes (0 à 1)."""
    return float(_lire_parametre_decimal("RESSOURCES_SEUIL_SIMILARITE_PCT", Decimal("80"))) / 100


def retention_devis_jours() -> int:
    """Durée de rétention des fichiers devis en jours."""
    return _lire_parametre_entier("RESSOURCES_RETENTION_DEVIS_JOURS", 365)


# ---------------------------------------------------------------------------
# Indice BT/TP courant
# ---------------------------------------------------------------------------


def indice_bt_courant(code: str = "BT01") -> Optional[Decimal]:
    """Retourne la valeur la plus récente de l'indice demandé."""
    from .models import IndiceRevisionPrix
    try:
        return IndiceRevisionPrix.objects.filter(code=code).order_by("-date_publication").first().valeur
    except Exception:
        return None


def actualiser_prix(prix_original: Decimal, indice_base: Decimal, indice_actuel: Decimal) -> Decimal:
    """
    Actualise un prix selon la formule simple (sans part fixe) :
      P_actuel = P_original × (indice_actuel / indice_base)
    """
    if indice_base <= 0:
        return prix_original
    return (prix_original * indice_actuel / indice_base).quantize(Decimal("0.01"))


def actualiser_prix_revision(prix_original: Decimal, indice_base: Decimal, indice_actuel: Decimal) -> Decimal:
    """
    Actualise selon la formule de révision CCAG Travaux 2021 :
      P = P0 × [0.125 + 0.875 × (BT / BT0)]
    """
    if indice_base <= 0:
        return prix_original
    facteur = Decimal("0.125") + Decimal("0.875") * (indice_actuel / indice_base)
    return (prix_original * facteur).quantize(Decimal("0.01"))


# ---------------------------------------------------------------------------
# Estimation SDP depuis prix de vente (méthode inversée)
# ---------------------------------------------------------------------------

def _ratios_par_famille(famille: str, sous_famille: str = "") -> tuple[str, str, str, str, str]:
    """
    Retourne (kpv_ds_sur_pv, ratio_mo, ratio_matx, ratio_matl, ratio_divers)
    calibrés sur ARTIPRIX 2025 + Manuel Cusant & Widloecher.
    """
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

    # Défaut — tous corps d'état
    return "0.70", "0.33", "0.47", "0.15", "0.05"


def estimer_sdp_depuis_prix(
    prix_ht: Decimal,
    famille: str = "",
    sous_famille: str = "",
) -> dict:
    """
    Génère un SDP estimé à partir du prix de vente HT.
    Retourne un dict avec DS, composantes et Kpv.
    """
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
    """
    Détecte le corps d'état (code lot CCTP) depuis une désignation.
    Retourne (code, libelle).
    """
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
# Analyse d'un devis (extraction via service PDF)
# ---------------------------------------------------------------------------


def analyser_devis(devis_analyse) -> list[dict]:
    """
    Envoie le fichier au service d'analyse PDF (port 8011) et retourne
    la liste des lignes extraites sous forme de dict normalisé.

    Format de retour :
    [
        {
            "designation": str,
            "unite": str,
            "quantite": Decimal,
            "prix_ht": Decimal,
            "montant_ht": Decimal,
        },
        ...
    ]
    """
    from .models import LignePrixMarche

    fichier_path = devis_analyse.fichier.path if hasattr(devis_analyse.fichier, "path") else None

    lignes_extraites = []

    # Tentative d'appel au service PDF
    try:
        with devis_analyse.fichier.open("rb") as f:
            resp = requests.post(
                f"{URL_SERVICE_PDF}/extraire-tableau/",
                files={"fichier": (devis_analyse.nom_original, f)},
                timeout=120,
            )
            resp.raise_for_status()
            lignes_brutes = resp.json().get("lignes", [])
    except requests.exceptions.ConnectionError:
        logger.warning("Service PDF non disponible (port 8011) — extraction simulée")
        lignes_brutes = []
    except Exception as exc:
        logger.error("Erreur service PDF : %s", exc)
        lignes_brutes = []

    # Récupérer l'indice courant pour actualisation
    indice_actuel = indice_bt_courant(devis_analyse.indice_base_code or "BT01")
    indice_base = devis_analyse.indice_base_valeur

    with transaction.atomic():
        for i, ligne in enumerate(lignes_brutes):
            designation = str(ligne.get("designation", "")).strip()
            if not designation:
                continue

            unite = str(ligne.get("unite", "")).strip()
            try:
                prix_ht = Decimal(str(ligne.get("prix_unitaire", 0)))
            except Exception:
                prix_ht = Decimal("0")
            try:
                montant_ht = Decimal(str(ligne.get("montant", 0)))
            except Exception:
                montant_ht = Decimal("0")
            try:
                quantite = Decimal(str(ligne.get("quantite", 1)))
            except Exception:
                quantite = Decimal("1")

            if prix_ht <= 0 and montant_ht > 0 and quantite > 0:
                prix_ht = (montant_ht / quantite).quantize(Decimal("0.0001"))

            # Détection corps d'état
            code_lot, libelle_lot = detecter_corps_etat(designation)

            # SDP estimé
            sdp = estimer_sdp_depuis_prix(prix_ht) if prix_ht > 0 else {}

            # Actualisation
            prix_actualise = None
            if prix_ht > 0 and indice_base and indice_actuel:
                prix_actualise = actualiser_prix(prix_ht, indice_base, indice_actuel)

            # Normalisation pour similarité
            designation_norm = normaliser_designation(designation)

            # Vérifier si une ligne similaire existe déjà
            seuil = seuil_similarite()
            ligne_existante = trouver_ligne_similaire(designation_norm, code_lot, seuil)

            if ligne_existante:
                # Fusionner : moyenne pondérée
                n = ligne_existante.nb_occurrences
                nouveau_prix = (
                    (ligne_existante.prix_ht_original * n + prix_ht) / (n + 1)
                ).quantize(Decimal("0.0001"))
                ligne_existante.prix_ht_original = nouveau_prix
                ligne_existante.nb_occurrences = n + 1
                ligne_existante.est_ligne_commune = True
                if prix_actualise:
                    ligne_existante.prix_ht_actualise = actualiser_prix(
                        nouveau_prix, indice_base, indice_actuel
                    )
                ligne_existante.save()
                ligne_marche = ligne_existante
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
                "est_fusion": ligne_existante is not None,
            })

    return lignes_extraites


def trouver_ligne_similaire(
    designation_norm: str,
    corps_etat: str,
    seuil: float,
):
    """Cherche une LignePrixMarche similaire dans le même corps d'état."""
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
# Actualisation périodique (appelée par Celery)
# ---------------------------------------------------------------------------


def actualiser_toutes_les_lignes(code_indice: str = "BT01") -> int:
    """
    Met à jour le prix actualisé de toutes les lignes de prix marché
    en utilisant le dernier indice publié.
    """
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
        ancien = ligne.prix_ht_actualise
        ligne.prix_ht_actualise = actualiser_prix(
            ligne.prix_ht_original, ligne.indice_valeur_base, indice_val
        )
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
    """
    Crée ou met à jour une LignePrixBibliotheque depuis une LignePrixMarche,
    et génère l'article CCTP correspondant.
    """
    from applications.bibliotheque.models import LignePrixBibliotheque
    from applications.pieces_ecrites.models import ArticleCCTP, LotCCTP
    from applications.bibliotheque.services import generer_sous_details_depuis_composantes

    prix_ref = ligne_marche.prix_ht_actualise or ligne_marche.prix_ht_original
    sdp = estimer_sdp_depuis_prix(prix_ref, ligne_marche.corps_etat_libelle)

    with transaction.atomic():
        # Lot CCTP
        lot = None
        if ligne_marche.corps_etat:
            try:
                lot = LotCCTP.objects.get(code=ligne_marche.corps_etat)
            except LotCCTP.DoesNotExist:
                pass

        # Ligne bibliothèque
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

        # Lier la ligne marché
        ligne_marche.ligne_bibliotheque = ligne_bib
        ligne_marche.save(update_fields=["ligne_bibliotheque"])

        # Générer les sous-détails
        if creee:
            generer_sous_details_depuis_composantes(ligne_bib, forcer=True)

        # Article CCTP
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
    Analyse un document source d'estimation (PDF, image, archive)
    via les services OCR et CAO pour extraire les éléments de fiche ratio.
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

    # Appel au service CAO pour extraction des surfaces
    try:
        with source.fichier.open("rb") as f:
            resp = requests.post(
                f"{URL_SERVICE_CAO}/analyser-plan/",
                files={"fichier": (source.nom_original, f)},
                timeout=180,
            )
            resp.raise_for_status()
            data = resp.json()
            resultats.update({
                "shon": _to_decimal(data.get("shon")),
                "shab": _to_decimal(data.get("shab")),
                "emprise_sol": _to_decimal(data.get("emprise_sol")),
                "niveaux_hs": data.get("niveaux_hors_sol"),
                "niveaux_ss": data.get("niveaux_sous_sol", 0),
            })
    except requests.exceptions.ConnectionError:
        logger.warning("Service CAO non disponible (port 8012)")
    except Exception as exc:
        logger.error("Erreur service CAO : %s", exc)

    # Appel OCR si image ou PDF scanné
    if not resultats["cout_total_ht"]:
        try:
            with source.fichier.open("rb") as f:
                resp = requests.post(
                    f"{URL_SERVICE_OCR}/extraire-texte/",
                    files={"fichier": (source.nom_original, f)},
                    timeout=120,
                )
                resp.raise_for_status()
                texte = resp.json().get("texte", "")
                # Extraction du coût total depuis le texte
                montant = _extraire_montant_total(texte)
                if montant:
                    resultats["cout_total_ht"] = montant
                    resultats["observations"] = f"Montant extrait par OCR : {montant} €"
                # Détection fondation
                resultats["type_fondation"] = _detecter_fondation(texte)
        except requests.exceptions.ConnectionError:
            logger.warning("Service OCR non disponible (port 8010)")
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
    """Extrait un montant total depuis un texte OCR (heuristique)."""
    patterns = [
        r"total\s+ht\s*[:\s]+([0-9\s.,]+)\s*€",
        r"montant\s+ht\s*[:\s]+([0-9\s.,]+)\s*€",
        r"total\s+général\s*[:\s]+([0-9\s.,]+)\s*€",
    ]
    for pattern in patterns:
        m = re.search(pattern, texte, re.IGNORECASE)
        if m:
            valeur_str = m.group(1).replace(" ", "").replace(",", ".")
            try:
                return Decimal(valeur_str)
            except Exception:
                pass
    return None


def _detecter_fondation(texte: str) -> str:
    """Détecte le type de fondation depuis un texte OCR."""
    texte = texte.lower()
    if "micropieu" in texte:
        return "profonde_micropieux"
    if "paroi moulée" in texte or "paroi moulee" in texte:
        return "profonde_paroi_moulee"
    if "pieu métallique" in texte or "pieu metallique" in texte:
        return "profonde_pieux_metalliques"
    if "pieu" in texte or "pieu foré" in texte:
        return "profonde_pieux_beton"
    if "radier" in texte:
        return "superficielle_radier"
    if "semelle" in texte:
        return "superficielle_semelle"
    return "non_identifie"
