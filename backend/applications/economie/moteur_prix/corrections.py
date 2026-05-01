"""Corrections proposées par le moteur, sans application automatique."""

from __future__ import annotations

from decimal import Decimal

from .resultats import CorrectionPrix


def proposer_correction_montant_prix_unitaire(prix_unitaire: Decimal | None, montant_total: Decimal | None, quantite: Decimal | None) -> CorrectionPrix | None:
    if not prix_unitaire or not montant_total or not quantite or quantite <= 0:
        return None
    prix_recalcule = (montant_total / quantite).quantize(Decimal("0.0001"))
    if prix_recalcule <= 0:
        return None
    ratio = prix_unitaire / prix_recalcule
    if ratio >= Decimal("8") or ratio <= Decimal("0.125"):
        return CorrectionPrix(
            champ="prix_unitaire_ht",
            valeur_actuelle=prix_unitaire,
            valeur_proposee=prix_recalcule,
            raison="Le prix unitaire semble confondu avec un montant total ou une valeur d'une autre colonne.",
            methode="controle_montant_quantite",
            confiance=Decimal("0.82"),
            impact={"ecart_ratio": ratio},
            niveau_risque="élevé",
        )
    return None

