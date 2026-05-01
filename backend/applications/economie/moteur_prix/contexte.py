"""Contexte métier transmis au moteur adaptatif de prix."""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any


def decimal_ou_none(valeur: Any) -> Decimal | None:
    """Convertit proprement une valeur numérique optionnelle."""
    if valeur in (None, ""):
        return None
    try:
        return Decimal(str(valeur))
    except Exception:
        return None


@dataclass
class ContextePrix:
    """Regroupe toutes les données connues avant résolution."""

    designation: str = ""
    unite: str = ""
    quantite: Decimal | None = None
    prix_unitaire_ht: Decimal | None = None
    montant_total_ht: Decimal | None = None
    debourse_sec: Decimal | None = None
    cout_direct: Decimal | None = None
    cout_revient: Decimal | None = None
    prix_vente: Decimal | None = None
    coefficient_k: Decimal | None = None
    taux_frais_chantier: Decimal | None = None
    taux_frais_generaux: Decimal | None = None
    taux_aleas: Decimal | None = None
    taux_marge: Decimal | None = None
    lot: str = ""
    famille: str = ""
    sous_famille: str = ""
    article_cctp: Any = None
    ligne_bibliotheque: Any = None
    prix_marche_similaires: list[dict[str, Any]] = field(default_factory=list)
    etudes_prix_similaires: list[Any] = field(default_factory=list)
    date_prix: Any = None
    indice_reference: Decimal | None = None
    indice_actuel: Decimal | None = None
    localite: str = ""
    source_document: str = ""
    type_document: str = ""
    niveau_fiabilite_source: Decimal | None = None
    contraintes_connues: dict[str, Any] = field(default_factory=dict)
    hypotheses_autorisees: bool = True

    @classmethod
    def depuis_ligne_etude(cls, etude, ligne=None) -> "ContextePrix":
        """Construit un contexte depuis une étude de prix LBH."""
        quantite = Decimal("1")
        prix_unitaire = None
        montant_total = decimal_ou_none(getattr(etude, "prix_vente_ht", None))
        debourse = decimal_ou_none(getattr(etude, "debourse_sec_ht", None))
        coefficient_k = decimal_ou_none(getattr(etude, "coefficient_k", None))
        designation = getattr(etude, "intitule", "") or ""
        unite = "u"
        if ligne is not None:
            designation = getattr(ligne, "designation", "") or designation
            unite = getattr(ligne, "unite", "") or unite
            quantite = decimal_ou_none(getattr(ligne, "quantite", None)) or Decimal("1")
            prix_unitaire = decimal_ou_none(getattr(ligne, "cout_unitaire_ht", None))
            montant_total = decimal_ou_none(getattr(ligne, "montant_ht", None))
            debourse = prix_unitaire

        return cls(
            designation=designation,
            unite=unite,
            quantite=quantite,
            prix_unitaire_ht=prix_unitaire,
            montant_total_ht=montant_total,
            debourse_sec=debourse,
            prix_vente=decimal_ou_none(getattr(etude, "prix_vente_ht", None)),
            coefficient_k=coefficient_k if coefficient_k and coefficient_k > 0 else None,
            taux_frais_chantier=decimal_ou_none(getattr(etude, "taux_frais_chantier", None)),
            taux_frais_generaux=decimal_ou_none(getattr(etude, "taux_frais_generaux", None)),
            taux_aleas=decimal_ou_none(getattr(etude, "taux_aleas", None)),
            taux_marge=decimal_ou_none(getattr(etude, "taux_marge_cible", None)),
            lot=getattr(etude, "lot_type", "") or "",
            famille=getattr(etude, "get_lot_type_display", lambda: "")() or "",
            ligne_bibliotheque=getattr(etude, "ligne_bibliotheque", None),
            localite=getattr(getattr(etude, "projet", None), "commune", "") or "",
            source_document="etude_prix",
            type_document=getattr(etude, "methode", "") or "",
        )

