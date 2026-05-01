"""Paramètres et coefficients par défaut du moteur adaptatif."""

from __future__ import annotations

from decimal import Decimal


PARAMETRES_DEFAUT = {
    "seuil_ecart_prix_marche": Decimal("0.25"),
    "seuil_k_bas": Decimal("1.10"),
    "seuil_k_haut": Decimal("2.80"),
    "seuil_marge_faible": Decimal("0.05"),
    "seuil_anomalie_montant": Decimal("8.00"),
    "ponderations": {
        "bibliotheque_exacte": Decimal("0.30"),
        "bibliotheque_similaire": Decimal("0.20"),
        "etude_prix_validee": Decimal("0.25"),
        "prix_marche": Decimal("0.20"),
        "ratios_famille": Decimal("0.12"),
        "coherence_arithmetique": Decimal("0.10"),
        "coherence_unite": Decimal("0.05"),
    },
}


RATIOS_FAMILLES_DEFAUT = {
    "vrd": {"main_oeuvre": Decimal("0.28"), "materiaux": Decimal("0.42"), "materiel": Decimal("0.18"), "transport": Decimal("0.08"), "frais_divers": Decimal("0.04")},
    "terrassement": {"main_oeuvre": Decimal("0.18"), "materiaux": Decimal("0.10"), "materiel": Decimal("0.48"), "transport": Decimal("0.20"), "frais_divers": Decimal("0.04")},
    "peinture": {"main_oeuvre": Decimal("0.68"), "materiaux": Decimal("0.24"), "materiel": Decimal("0.03"), "transport": Decimal("0.02"), "frais_divers": Decimal("0.03")},
    "gros_oeuvre": {"main_oeuvre": Decimal("0.35"), "materiaux": Decimal("0.45"), "materiel": Decimal("0.12"), "transport": Decimal("0.04"), "frais_divers": Decimal("0.04")},
    "defaut": {"main_oeuvre": Decimal("0.40"), "materiaux": Decimal("0.35"), "materiel": Decimal("0.10"), "transport": Decimal("0.05"), "frais_divers": Decimal("0.10")},
}


def detecter_famille(designation: str = "", lot: str = "", famille: str = "") -> str:
    texte = f"{designation} {lot} {famille}".lower()
    if any(mot in texte for mot in ["vrd", "canalisation", "bordure", "réseau", "reseau"]):
        return "vrd"
    if any(mot in texte for mot in ["terrassement", "déblai", "deblai", "remblai"]):
        return "terrassement"
    if any(mot in texte for mot in ["peinture", "acrylique", "enduit"]):
        return "peinture"
    if any(mot in texte for mot in ["gros", "béton", "beton", "maçonnerie", "maconnerie"]):
        return "gros_oeuvre"
    return "defaut"


def ratios_pour_famille(famille: str) -> dict[str, Decimal]:
    return RATIOS_FAMILLES_DEFAUT.get(famille, RATIOS_FAMILLES_DEFAUT["defaut"])

