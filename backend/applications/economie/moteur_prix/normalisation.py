"""Normalisation des désignations, unités et valeurs."""

from __future__ import annotations

import re
from decimal import Decimal


UNITES_PAR_MOTS_CLES = {
    "ml": ["canalisation", "bordure", "réseau", "reseau", "tranchée", "tranchee", "câble", "cable"],
    "m2": ["peinture", "enduit", "carrelage", "revêtement", "revetement", "surface", "faïence", "faience"],
    "m3": ["terrassement", "déblai", "deblai", "remblai", "béton", "beton", "volume"],
    "u": ["porte", "fenêtre", "fenetre", "regard", "appareil", "unité", "unite"],
}


def normaliser_texte(valeur: str | None) -> str:
    valeur = (valeur or "").lower().strip()
    valeur = valeur.replace("œ", "oe").replace("²", "2").replace("³", "3")
    return re.sub(r"\s+", " ", valeur)


def normaliser_unite(unite: str | None) -> str:
    valeur = normaliser_texte(unite)
    correspondances = {
        "m²": "m2", "m2": "m2", "m 2": "m2",
        "m³": "m3", "m3": "m3", "m 3": "m3",
        "ml": "ml", "mètre linéaire": "ml", "metre lineaire": "ml",
        "u": "u", "un": "u", "unité": "u", "unite": "u", "ens": "ens",
        "h": "h", "heure": "h",
    }
    return correspondances.get(valeur, valeur or "")


def proposer_unite(designation: str) -> tuple[str, Decimal, str]:
    texte = normaliser_texte(designation)
    for unite, mots in UNITES_PAR_MOTS_CLES.items():
        if any(mot in texte for mot in mots):
            return unite, Decimal("0.78"), f"Unité proposée d'après les mots-clés de la désignation : {', '.join(mots[:3])}."
    return "u", Decimal("0.35"), "Aucune unité métier évidente détectée, unité forfaitaire proposée par défaut."

