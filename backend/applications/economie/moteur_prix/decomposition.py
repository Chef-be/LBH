"""Décomposition adaptative d'un prix."""

from __future__ import annotations

from decimal import Decimal

from .coefficients import detecter_famille, ratios_pour_famille


def decomposer_debourse(debourse_sec: Decimal | None, *, designation: str = "", lot: str = "", famille: str = "") -> tuple[dict[str, Decimal], str]:
    """Propose une ventilation du déboursé sec par ratios métier."""
    if debourse_sec is None or debourse_sec <= 0:
        return {}, "Aucun déboursé sec disponible pour ventiler le prix."
    famille_detectee = detecter_famille(designation, lot, famille)
    ratios = ratios_pour_famille(famille_detectee)
    return {
        composante: (debourse_sec * ratio).quantize(Decimal("0.0001"))
        for composante, ratio in ratios.items()
    }, famille_detectee


def scenarios_decomposition(prix_vente: Decimal | None, coefficient_k: Decimal | None, *, designation: str = "", lot: str = "", famille: str = "") -> list[dict]:
    """Retourne trois scénarios métier si le prix de vente est connu."""
    if prix_vente is None or prix_vente <= 0:
        return []
    k_standard = coefficient_k or Decimal("1.45")
    scenarios = [
        ("economique", max(Decimal("1.05"), k_standard - Decimal("0.15")), "Hypothèses minimales et marge réduite."),
        ("standard", k_standard, "Ratios médians de la famille d'ouvrage."),
        ("prudent", k_standard + Decimal("0.20"), "Aléas renforcés, transport et contexte local à surveiller."),
    ]
    sortie = []
    for code, k, justification in scenarios:
        ds = (prix_vente / k).quantize(Decimal("0.0001"))
        decomposition, famille_detectee = decomposer_debourse(ds, designation=designation, lot=lot, famille=famille)
        sortie.append({
            "scenario": code,
            "debourse_sec": ds,
            "coefficient_k": k.quantize(Decimal("0.0001")),
            "prix_vente": prix_vente,
            "marge": (prix_vente - ds).quantize(Decimal("0.0001")),
            "famille": famille_detectee,
            "decomposition": decomposition,
            "justification": justification,
        })
    return sortie

