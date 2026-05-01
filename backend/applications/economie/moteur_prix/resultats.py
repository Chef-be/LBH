"""Objets de sortie standardisés du moteur de prix."""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any


def quantifier(valeur: Decimal | None, precision: str = "0.0001") -> Decimal | None:
    if valeur is None:
        return None
    return valeur.quantize(Decimal(precision))


def decimal_json(valeur: Any) -> Any:
    if isinstance(valeur, Decimal):
        return str(valeur)
    if isinstance(valeur, dict):
        return {cle: decimal_json(v) for cle, v in valeur.items()}
    if isinstance(valeur, list):
        return [decimal_json(v) for v in valeur]
    return valeur


@dataclass
class HypothesePrix:
    code: str
    libelle: str
    description: str = ""
    valeur: Any = None
    source: str = ""
    niveau_confiance: Decimal = Decimal("0.50")
    raison: str = ""
    impact_sur_prix: Any = None
    est_modifiable: bool = True
    est_validee: bool = False

    def vers_dict(self) -> dict[str, Any]:
        return decimal_json(self.__dict__)


@dataclass
class VerificationPrix:
    type: str
    statut: str
    message: str
    score: Decimal = Decimal("0")
    donnees: dict[str, Any] = field(default_factory=dict)

    def vers_dict(self) -> dict[str, Any]:
        return decimal_json(self.__dict__)


@dataclass
class CorrectionPrix:
    champ: str
    valeur_actuelle: Any
    valeur_proposee: Any
    raison: str
    methode: str
    confiance: Decimal
    impact: dict[str, Any] = field(default_factory=dict)
    niveau_risque: str = "moyen"

    def vers_dict(self) -> dict[str, Any]:
        return decimal_json(self.__dict__)


@dataclass
class PropositionStrategie:
    strategie: str
    prix_propose: Decimal | None
    confiance: Decimal
    valeurs: dict[str, Any] = field(default_factory=dict)
    justification: str = ""

    def vers_dict(self) -> dict[str, Any]:
        return decimal_json(self.__dict__)


@dataclass
class ResultatPrix:
    statut: str = "a_verifier"
    valeurs_calculees: dict[str, Any] = field(default_factory=dict)
    valeurs_estimees: dict[str, Any] = field(default_factory=dict)
    valeurs_corrigees: dict[str, Any] = field(default_factory=dict)
    hypotheses: list[HypothesePrix] = field(default_factory=list)
    alertes: list[str] = field(default_factory=list)
    erreurs: list[str] = field(default_factory=list)
    verifications: list[VerificationPrix] = field(default_factory=list)
    niveau_confiance_global: str = "faible"
    score_confiance: Decimal = Decimal("0")
    score_coherence: Decimal = Decimal("0")
    strategie_utilisee: str = "aucune"
    strategies_comparees: list[PropositionStrategie] = field(default_factory=list)
    justification: str = ""
    corrections_proposees: list[CorrectionPrix] = field(default_factory=list)
    donnees_a_valider: list[str] = field(default_factory=list)
    formule_appliquee: str = ""
    tracabilite: list[str] = field(default_factory=list)
    decomposition: dict[str, Any] = field(default_factory=dict)

    def recalculer_niveau(self) -> None:
        score = max(Decimal("0"), min(self.score_confiance, Decimal("1")))
        if score >= Decimal("0.85"):
            self.niveau_confiance_global = "élevé"
        elif score >= Decimal("0.70"):
            self.niveau_confiance_global = "bon"
        elif score >= Decimal("0.50"):
            self.niveau_confiance_global = "moyen"
        elif score >= Decimal("0.30"):
            self.niveau_confiance_global = "faible"
        else:
            self.niveau_confiance_global = "très faible"

    def vers_dict(self) -> dict[str, Any]:
        self.recalculer_niveau()
        return decimal_json({
            "statut": self.statut,
            "niveau_confiance": self.niveau_confiance_global,
            "score_confiance": self.score_confiance,
            "score_coherence": self.score_coherence,
            "strategie_principale": self.strategie_utilisee,
            "strategies_comparees": [s.vers_dict() for s in self.strategies_comparees],
            "valeurs": {**self.valeurs_calculees, **self.valeurs_estimees, **self.valeurs_corrigees},
            "valeurs_calculees": self.valeurs_calculees,
            "valeurs_estimees": self.valeurs_estimees,
            "valeurs_corrigees": self.valeurs_corrigees,
            "decomposition": self.decomposition,
            "hypotheses": [h.vers_dict() for h in self.hypotheses],
            "verifications": [v.vers_dict() for v in self.verifications],
            "alertes": self.alertes,
            "erreurs": self.erreurs,
            "corrections_proposees": [c.vers_dict() for c in self.corrections_proposees],
            "donnees_a_valider": self.donnees_a_valider,
            "formule_appliquee": self.formule_appliquee,
            "justification": self.justification,
            "tracabilite": self.tracabilite,
        })

