"""Stratégies indépendantes du moteur adaptatif de prix."""

from __future__ import annotations

from decimal import Decimal
from typing import Iterable

from .comparaison import mediane_decimale
from .contexte import ContextePrix, decimal_ou_none
from .coefficients import detecter_famille
from .decomposition import decomposer_debourse
from .resultats import PropositionStrategie


def _prix_bibliotheque(ligne) -> Decimal | None:
    if not ligne:
        return None
    prix = decimal_ou_none(getattr(ligne, "prix_vente_unitaire", None))
    if prix and prix > 0:
        return prix
    debourse = decimal_ou_none(getattr(ligne, "debourse_sec_unitaire", None))
    if debourse and debourse > 0:
        return debourse
    return None


def strategie_bibliotheque_exacte(contexte: ContextePrix) -> PropositionStrategie | None:
    """Utilise une ligne de bibliothèque explicitement liée."""
    prix = _prix_bibliotheque(contexte.ligne_bibliotheque)
    if not prix:
        return None
    fiabilite = decimal_ou_none(getattr(contexte.ligne_bibliotheque, "fiabilite", None)) or Decimal("3")
    confiance = min(Decimal("0.95"), Decimal("0.55") + fiabilite * Decimal("0.08"))
    return PropositionStrategie(
        strategie="bibliotheque_exacte",
        prix_propose=prix,
        confiance=confiance,
        valeurs={"prix_vente_unitaire": prix},
        justification="Prix repris depuis la ligne de bibliothèque liée à la ligne étudiée.",
    )


def strategie_bibliotheque_similaire(contexte: ContextePrix) -> PropositionStrategie | None:
    """Recherche des lignes proches dans la bibliothèque locale."""
    try:
        from applications.bibliotheque.models import LignePrixBibliotheque
    except Exception:
        return None

    mots = [mot for mot in (contexte.designation or "").split() if len(mot) >= 4][:5]
    if not mots:
        return None
    qs = LignePrixBibliotheque.objects.filter(statut_validation="valide")
    if contexte.unite:
        qs = qs.filter(unite__iexact=contexte.unite)
    for mot in mots[:3]:
        qs = qs.filter(designation_courte__icontains=mot)
    lignes = list(qs[:12])
    prix = [_prix_bibliotheque(ligne) for ligne in lignes]
    mediane = mediane_decimale([p for p in prix if p])
    if not mediane:
        return None
    confiance = min(Decimal("0.82"), Decimal("0.45") + Decimal(len(lignes)) * Decimal("0.035"))
    return PropositionStrategie(
        strategie="bibliotheque_similaire",
        prix_propose=mediane,
        confiance=confiance,
        valeurs={"prix_vente_unitaire": mediane, "nb_references": len(lignes)},
        justification=f"{len(lignes)} ligne(s) de bibliothèque proche(s) ont été comparées.",
    )


def strategie_etude_prix_validee(contexte: ContextePrix) -> PropositionStrategie | None:
    """Utilise des études de prix validées ou publiées proches."""
    etudes: Iterable = contexte.etudes_prix_similaires or []
    prix = []
    for etude in etudes:
        pv = decimal_ou_none(getattr(etude, "prix_vente_ht", None))
        if pv and pv > 0:
            prix.append(pv)
    mediane = mediane_decimale(prix)
    if not mediane:
        return None
    return PropositionStrategie(
        strategie="etude_prix_validee",
        prix_propose=mediane,
        confiance=min(Decimal("0.86"), Decimal("0.52") + Decimal(len(prix)) * Decimal("0.05")),
        valeurs={"prix_vente": mediane, "nb_etudes": len(prix)},
        justification="Prix rapproché depuis des études de prix validées ou publiées.",
    )


def strategie_prix_marche(contexte: ContextePrix) -> PropositionStrategie | None:
    """Utilise des prix de marché fournis dans le contexte."""
    prix = []
    for item in contexte.prix_marche_similaires or []:
        valeur = decimal_ou_none(item.get("prix_unitaire_ht") or item.get("prix_vente_unitaire") or item.get("prix"))
        if valeur and valeur > 0:
            prix.append(valeur)
    mediane = mediane_decimale(prix)
    if not mediane:
        return None
    return PropositionStrategie(
        strategie="prix_marche",
        prix_propose=mediane,
        confiance=min(Decimal("0.88"), Decimal("0.46") + Decimal(len(prix)) * Decimal("0.04")),
        valeurs={"prix_vente_unitaire": mediane, "nb_prix_marche": len(prix)},
        justification="Prix proposé depuis la médiane des prix de marché similaires.",
    )


def strategie_ratios_famille(contexte: ContextePrix) -> PropositionStrategie | None:
    """Reconstitue une proposition depuis les ratios de famille."""
    base = contexte.debourse_sec or contexte.cout_direct or contexte.cout_revient
    k = contexte.coefficient_k or Decimal("1.45")
    if base and base > 0:
        prix = (base * k).quantize(Decimal("0.0001"))
        decomposition, famille = decomposer_debourse(base, designation=contexte.designation, lot=contexte.lot, famille=contexte.famille)
        return PropositionStrategie(
            strategie="ratios_famille",
            prix_propose=prix,
            confiance=Decimal("0.58"),
            valeurs={"prix_vente_unitaire": prix, "debourse_sec": base, "famille": famille, "decomposition": decomposition},
            justification="Prix reconstruit depuis le déboursé connu et les ratios de la famille d'ouvrage.",
        )
    return None


def strategie_k_entreprise(contexte: ContextePrix) -> PropositionStrategie | None:
    """Applique le coefficient K disponible sur un coût connu."""
    base = contexte.debourse_sec or contexte.cout_direct
    if not base or base <= 0 or not contexte.coefficient_k or contexte.coefficient_k <= 0:
        return None
    prix = (base * contexte.coefficient_k).quantize(Decimal("0.0001"))
    return PropositionStrategie(
        strategie="coefficient_k",
        prix_propose=prix,
        confiance=Decimal("0.64"),
        valeurs={"prix_vente_unitaire": prix, "coefficient_k": contexte.coefficient_k},
        justification="Prix calculé depuis le coût connu et le coefficient K retenu.",
    )


def strategie_prix_impose(contexte: ContextePrix) -> PropositionStrategie | None:
    """Part d'un prix imposé et reconstitue les valeurs économiques possibles."""
    prix = contexte.prix_vente or contexte.prix_unitaire_ht
    if not prix or prix <= 0:
        return None
    valeurs = {"prix_vente_unitaire": prix}
    if contexte.coefficient_k and contexte.coefficient_k > 0:
        valeurs["debourse_sec"] = (prix / contexte.coefficient_k).quantize(Decimal("0.0001"))
    return PropositionStrategie(
        strategie="prix_impose",
        prix_propose=prix,
        confiance=Decimal("0.72"),
        valeurs=valeurs,
        justification="Prix de vente fourni par l'utilisateur ou par le document source.",
    )


def strategie_debourse_impose(contexte: ContextePrix) -> PropositionStrategie | None:
    """Part d'un déboursé connu et calcule le prix de vente probable."""
    if not contexte.debourse_sec or contexte.debourse_sec <= 0:
        return None
    k = contexte.coefficient_k or Decimal("1.45")
    prix = (contexte.debourse_sec * k).quantize(Decimal("0.0001"))
    return PropositionStrategie(
        strategie="debourse_impose",
        prix_propose=prix,
        confiance=Decimal("0.66") if contexte.coefficient_k else Decimal("0.48"),
        valeurs={"prix_vente_unitaire": prix, "debourse_sec": contexte.debourse_sec, "coefficient_k": k},
        justification="Prix de vente calculé depuis le déboursé sec connu.",
    )


def strategie_montant_quantite(contexte: ContextePrix) -> PropositionStrategie | None:
    """Recalcule le prix unitaire à partir d'un montant total et d'une quantité."""
    if not contexte.montant_total_ht or not contexte.quantite or contexte.quantite <= 0:
        return None
    prix = (contexte.montant_total_ht / contexte.quantite).quantize(Decimal("0.0001"))
    return PropositionStrategie(
        strategie="montant_quantite",
        prix_propose=prix,
        confiance=Decimal("0.78"),
        valeurs={"prix_unitaire_ht": prix, "montant_total_ht": contexte.montant_total_ht},
        justification="Prix unitaire recalculé depuis le montant total et la quantité.",
    )


def strategie_actualisation_indice(contexte: ContextePrix) -> PropositionStrategie | None:
    """Actualise un prix ancien si les indices sont fournis."""
    prix = contexte.prix_unitaire_ht or contexte.prix_vente
    if not prix or not contexte.indice_reference or not contexte.indice_actuel or contexte.indice_reference <= 0:
        return None
    prix_actualise = (prix * contexte.indice_actuel / contexte.indice_reference).quantize(Decimal("0.0001"))
    return PropositionStrategie(
        strategie="actualisation_indice",
        prix_propose=prix_actualise,
        confiance=Decimal("0.62"),
        valeurs={"prix_vente_unitaire": prix_actualise},
        justification="Prix actualisé depuis les indices fournis.",
    )


def strategie_fallback_heuristique(contexte: ContextePrix) -> PropositionStrategie:
    """Dernier recours : propose une base contrôlable sans prétendre à une forte fiabilité."""
    prix = contexte.prix_unitaire_ht or contexte.prix_vente or contexte.montant_total_ht or contexte.debourse_sec
    famille = detecter_famille(contexte.designation, contexte.lot, contexte.famille)
    return PropositionStrategie(
        strategie="fallback_heuristique",
        prix_propose=prix,
        confiance=Decimal("0.22") if prix else Decimal("0.10"),
        valeurs={"prix_vente_unitaire": prix, "famille": famille},
        justification="Peu de données fiables sont disponibles ; validation humaine nécessaire.",
    )


STRATEGIES = [
    strategie_bibliotheque_exacte,
    strategie_bibliotheque_similaire,
    strategie_etude_prix_validee,
    strategie_prix_marche,
    strategie_ratios_famille,
    strategie_k_entreprise,
    strategie_prix_impose,
    strategie_debourse_impose,
    strategie_montant_quantite,
    strategie_actualisation_indice,
]


def executer_strategies(contexte: ContextePrix) -> list[PropositionStrategie]:
    """Exécute toutes les stratégies applicables et retourne les propositions classées."""
    propositions = []
    for strategie in STRATEGIES:
        try:
            proposition = strategie(contexte)
        except Exception:
            proposition = None
        if proposition:
            propositions.append(proposition)
    propositions.append(strategie_fallback_heuristique(contexte))
    propositions.sort(key=lambda item: item.confiance, reverse=True)
    return propositions
