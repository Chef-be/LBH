"""Solveur adaptatif du moteur de prix."""

from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP
from typing import Any

from .contexte import ContextePrix, decimal_ou_none
from .corrections import proposer_correction_montant_prix_unitaire
from .decomposition import decomposer_debourse, scenarios_decomposition
from .explication import expliquer_resultat
from .hypotheses import hypothese
from .normalisation import normaliser_unite, proposer_unite
from .resultats import ResultatPrix
from .strategies import executer_strategies
from .verifications import executer_verifications


def _q(valeur: Decimal | None, precision: str = "0.0001") -> Decimal | None:
    if valeur is None:
        return None
    return valeur.quantize(Decimal(precision), rounding=ROUND_HALF_UP)


def _contexte_depuis_dict(donnees: dict[str, Any]) -> ContextePrix:
    champs_decimaux = {
        "quantite", "prix_unitaire_ht", "montant_total_ht", "debourse_sec",
        "cout_direct", "cout_revient", "prix_vente", "coefficient_k",
        "taux_frais_chantier", "taux_frais_generaux", "taux_aleas", "taux_marge",
        "indice_reference", "indice_actuel", "niveau_fiabilite_source",
    }
    valeurs = {}
    for champ, valeur in donnees.items():
        valeurs[champ] = decimal_ou_none(valeur) if champ in champs_decimaux else valeur
    champs_valides = set(ContextePrix.__dataclass_fields__.keys())
    return ContextePrix(**{k: v for k, v in valeurs.items() if k in champs_valides})


def completer_valeurs_connues(contexte: ContextePrix, resultat: ResultatPrix) -> dict[str, Any]:
    """Déduit toutes les valeurs certaines calculables depuis les données connues."""
    valeurs: dict[str, Any] = {}

    quantite = contexte.quantite
    prix_unitaire = contexte.prix_unitaire_ht
    montant = contexte.montant_total_ht
    prix_vente = contexte.prix_vente
    debourse = contexte.debourse_sec
    k = contexte.coefficient_k

    if quantite is not None:
        valeurs["quantite"] = quantite
    if prix_unitaire is not None:
        valeurs["prix_unitaire_ht"] = prix_unitaire
    if montant is not None:
        valeurs["montant_total_ht"] = montant
    if prix_vente is not None:
        valeurs["prix_vente"] = prix_vente
        valeurs.setdefault("prix_vente_unitaire", prix_vente)
    if debourse is not None:
        valeurs["debourse_sec"] = debourse
    if k is not None:
        valeurs["coefficient_k"] = k

    if montant and quantite and quantite > 0 and not prix_unitaire:
        prix_unitaire = _q(montant / quantite)
        valeurs["prix_unitaire_ht"] = prix_unitaire
        resultat.hypotheses.append(hypothese(
            "prix_unitaire_depuis_montant_quantite",
            "Prix unitaire recalculé",
            valeur=prix_unitaire,
            source="montant_total_ht + quantite",
            confiance="0.90",
            raison="Le montant total et la quantité permettent de recalculer le prix unitaire HT.",
        ))

    if prix_unitaire and quantite and quantite > 0 and not montant:
        montant = _q(prix_unitaire * quantite)
        valeurs["montant_total_ht"] = montant
        resultat.hypotheses.append(hypothese(
            "montant_depuis_prix_quantite",
            "Montant total recalculé",
            valeur=montant,
            source="prix_unitaire_ht + quantite",
            confiance="0.90",
            raison="Le prix unitaire et la quantité permettent de recalculer le montant total.",
        ))

    if prix_vente and k and k > 0 and not debourse:
        debourse = _q(prix_vente / k)
        valeurs["debourse_sec"] = debourse
        resultat.hypotheses.append(hypothese(
            "debourse_depuis_pv_k",
            "Déboursé sec reconstitué",
            valeur=debourse,
            source="prix_vente + coefficient_k",
            confiance="0.82",
            raison="Le prix de vente et le coefficient K permettent de reconstituer le déboursé sec.",
        ))

    if debourse and k and k > 0 and not prix_vente:
        prix_vente = _q(debourse * k)
        valeurs["prix_vente"] = prix_vente
        valeurs["prix_vente_unitaire"] = prix_vente
        resultat.hypotheses.append(hypothese(
            "pv_depuis_debourse_k",
            "Prix de vente calculé",
            valeur=prix_vente,
            source="debourse_sec + coefficient_k",
            confiance="0.82",
            raison="Le déboursé sec et le coefficient K permettent de calculer le prix de vente.",
        ))

    if prix_vente and contexte.taux_marge is not None and contexte.taux_marge < 1 and not debourse:
        debourse = _q(prix_vente * (Decimal("1") - contexte.taux_marge))
        valeurs["debourse_sec"] = debourse
        resultat.hypotheses.append(hypothese(
            "debourse_depuis_taux_marge",
            "Déboursé maximal depuis marge cible",
            valeur=debourse,
            source="prix_vente + taux_marge",
            confiance="0.70",
            raison="Le prix imposé et la marge cible permettent d'estimer un déboursé admissible.",
        ))

    if prix_vente and debourse:
        valeurs["marge_estimee"] = _q(prix_vente - debourse)
        if prix_vente > 0:
            valeurs["taux_marge_estime"] = _q((prix_vente - debourse) / prix_vente)
        if debourse > 0:
            valeurs["coefficient_k_reel"] = _q(prix_vente / debourse)

    if contexte.indice_reference and contexte.indice_actuel and contexte.indice_reference > 0 and prix_unitaire:
        valeurs["prix_actualise"] = _q(prix_unitaire * contexte.indice_actuel / contexte.indice_reference)
        resultat.hypotheses.append(hypothese(
            "actualisation_indice",
            "Prix actualisé par indice",
            valeur=valeurs["prix_actualise"],
            source="indices fournis",
            confiance="0.72",
            raison="Les indices de référence et actuel permettent d'actualiser le prix.",
        ))

    unite_normale = normaliser_unite(contexte.unite)
    unite_proposee, confiance_unite, raison_unite = proposer_unite(contexte.designation)
    if unite_normale:
        valeurs["unite_normalisee"] = unite_normale
    if unite_proposee and (not unite_normale or unite_normale != unite_proposee):
        resultat.hypotheses.append(hypothese(
            "unite_proposee",
            "Unité proposée",
            valeur=unite_proposee,
            source="désignation",
            confiance=confiance_unite,
            raison=raison_unite,
        ))

    return valeurs


def calculer_score(resultat: ResultatPrix) -> None:
    score = Decimal("0.20")
    if resultat.strategies_comparees:
        score += min(Decimal("0.45"), max(s.confiance for s in resultat.strategies_comparees) * Decimal("0.45"))
    for verification in resultat.verifications:
        score += verification.score
    if resultat.erreurs:
        score -= Decimal("0.30")
    if resultat.alertes:
        score -= min(Decimal("0.20"), Decimal(len(resultat.alertes)) * Decimal("0.04"))
    resultat.score_confiance = max(Decimal("0"), min(Decimal("1"), score.quantize(Decimal("0.0001"))))
    scores_ok = sum(Decimal("1") for v in resultat.verifications if v.statut == "ok")
    resultat.score_coherence = min(Decimal("1"), (scores_ok / Decimal(max(1, len(resultat.verifications)))).quantize(Decimal("0.0001")))
    resultat.recalculer_niveau()


def auditer_prix(contexte: ContextePrix | dict[str, Any]) -> dict[str, Any]:
    """Point d'entrée public : résout, compare, vérifie et explique un prix."""
    if isinstance(contexte, dict):
        contexte = _contexte_depuis_dict(contexte)

    resultat = ResultatPrix()
    resultat.tracabilite.append("Contexte normalisé.")

    valeurs = completer_valeurs_connues(contexte, resultat)
    propositions = executer_strategies(contexte)
    resultat.strategies_comparees = propositions
    if propositions:
        principale = propositions[0]
        resultat.strategie_utilisee = principale.strategie
        for cle, valeur in principale.valeurs.items():
            valeurs.setdefault(cle, valeur)
        if principale.prix_propose:
            valeurs.setdefault("prix_vente_unitaire", principale.prix_propose)
        resultat.tracabilite.append(f"Stratégie principale retenue : {principale.strategie}.")

    correction = proposer_correction_montant_prix_unitaire(
        contexte.prix_unitaire_ht,
        contexte.montant_total_ht,
        contexte.quantite,
    )
    if correction:
        resultat.corrections_proposees.append(correction)
        resultat.alertes.append("Une correction de prix unitaire est proposée, sans application automatique.")

    pv = valeurs.get("prix_vente_unitaire") or valeurs.get("prix_vente") or contexte.prix_vente or contexte.prix_unitaire_ht
    ds = valeurs.get("debourse_sec") or contexte.debourse_sec
    if not ds and pv:
        k = valeurs.get("coefficient_k") or contexte.coefficient_k or Decimal("1.45")
        ds = _q(pv / k)
        valeurs["debourse_sec_estime"] = ds
        resultat.hypotheses.append(hypothese(
            "debourse_estime_par_k_defaut",
            "Déboursé sec estimé",
            valeur=ds,
            source="prix connu + K estimatif",
            confiance="0.48" if not contexte.coefficient_k else "0.66",
            raison="Aucun déboursé sec n'est connu ; une estimation est proposée pour permettre le contrôle.",
        ))

    if ds:
        decomposition, famille = decomposer_debourse(ds, designation=contexte.designation, lot=contexte.lot, famille=contexte.famille)
        resultat.decomposition = decomposition
        valeurs["famille_detectee"] = famille
        resultat.hypotheses.append(hypothese(
            "decomposition_ratios_famille",
            "Décomposition par ratios de famille",
            valeur=famille,
            source="famille d'ouvrage",
            confiance="0.55",
            raison="La ventilation est estimée depuis les ratios médians de la famille détectée.",
        ))

    if pv:
        resultat.valeurs_estimees["scenarios"] = scenarios_decomposition(
            pv,
            contexte.coefficient_k,
            designation=contexte.designation,
            lot=contexte.lot,
            famille=contexte.famille,
        )

    resultat.verifications = executer_verifications(contexte, valeurs, propositions)
    for verification in resultat.verifications:
        if verification.statut == "critique":
            resultat.erreurs.append(verification.message)
        elif verification.statut == "alerte":
            resultat.alertes.append(verification.message)

    valeurs_calculees = {}
    valeurs_estimees = {}
    for cle, valeur in valeurs.items():
        if cle in {"prix_unitaire_ht", "montant_total_ht", "prix_vente", "prix_vente_unitaire", "marge_estimee", "taux_marge_estime", "coefficient_k_reel", "prix_actualise"}:
            valeurs_calculees[cle] = valeur
        else:
            valeurs_estimees[cle] = valeur
    resultat.valeurs_calculees = valeurs_calculees
    resultat.valeurs_estimees.update(valeurs_estimees)
    resultat.formule_appliquee = "Solveur multi-stratégies : données connues, hypothèses, comparaisons, vérifications."
    resultat.donnees_a_valider = [
        h.libelle for h in resultat.hypotheses if not h.est_validee and h.niveau_confiance < Decimal("0.80")
    ]
    resultat.statut = "incoherent" if resultat.erreurs else "a_verifier" if resultat.alertes or resultat.donnees_a_valider else "coherent"
    calculer_score(resultat)
    resultat.justification = expliquer_resultat(resultat)
    return resultat.vers_dict()
