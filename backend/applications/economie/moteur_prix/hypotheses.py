"""Fabrique d'hypothèses métier."""

from __future__ import annotations

from decimal import Decimal
from .resultats import HypothesePrix


def hypothese(code: str, libelle: str, *, valeur=None, source="", confiance="0.50", raison="", description="") -> HypothesePrix:
    return HypothesePrix(
        code=code,
        libelle=libelle,
        description=description,
        valeur=valeur,
        source=source,
        niveau_confiance=Decimal(str(confiance)),
        raison=raison,
    )

