"""Comparaisons entre propositions de prix."""

from __future__ import annotations

from decimal import Decimal
from statistics import median


def mediane_decimale(valeurs: list[Decimal]) -> Decimal | None:
    valeurs_valides = [v for v in valeurs if v is not None and v > 0]
    if not valeurs_valides:
        return None
    return Decimal(str(median([float(v) for v in valeurs_valides]))).quantize(Decimal("0.0001"))


def ecart_relatif(valeur: Decimal | None, reference: Decimal | None) -> Decimal | None:
    if valeur is None or reference is None or reference == 0:
        return None
    return (abs(valeur - reference) / abs(reference)).quantize(Decimal("0.0001"))

