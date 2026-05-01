"""Contrôles arithmétiques, métier et statistiques du moteur de prix."""

from __future__ import annotations

from decimal import Decimal

from .comparaison import ecart_relatif, mediane_decimale
from .contexte import ContextePrix, decimal_ou_none
from .normalisation import normaliser_unite, proposer_unite
from .resultats import VerificationPrix


def verifier_arithmetique(contexte: ContextePrix, valeurs: dict) -> list[VerificationPrix]:
    controles: list[VerificationPrix] = []
    quantite = contexte.quantite
    prix = valeurs.get("prix_unitaire_ht") or valeurs.get("prix_vente_unitaire") or contexte.prix_unitaire_ht
    montant = valeurs.get("montant_total_ht") or contexte.montant_total_ht
    if quantite and quantite > 0 and prix and montant:
        attendu = (quantite * prix).quantize(Decimal("0.0001"))
        ecart = ecart_relatif(attendu, montant)
        if ecart is not None and ecart <= Decimal("0.01"):
            controles.append(VerificationPrix("arithmetique", "ok", "Le montant correspond à la quantité × prix unitaire.", Decimal("0.10"), {"ecart": ecart}))
        else:
            controles.append(VerificationPrix("arithmetique", "alerte", "Le montant ne correspond pas à la quantité × prix unitaire.", Decimal("-0.18"), {"montant_attendu": attendu, "montant_lu": montant, "ecart": ecart}))

    debourse = valeurs.get("debourse_sec") or contexte.debourse_sec
    k = valeurs.get("coefficient_k") or contexte.coefficient_k
    pv = valeurs.get("prix_vente_unitaire") or valeurs.get("prix_vente") or contexte.prix_vente
    if debourse and k and pv and debourse > 0 and k > 0:
        attendu = (debourse * k).quantize(Decimal("0.0001"))
        ecart = ecart_relatif(attendu, pv)
        if ecart is not None and ecart <= Decimal("0.02"):
            controles.append(VerificationPrix("arithmetique", "ok", "Le prix de vente est cohérent avec le déboursé sec × K.", Decimal("0.08"), {"ecart": ecart}))
        else:
            controles.append(VerificationPrix("arithmetique", "alerte", "Le prix de vente n'est pas cohérent avec le déboursé sec × K.", Decimal("-0.12"), {"prix_attendu": attendu, "prix_lu": pv, "ecart": ecart}))
    return controles


def verifier_metier(contexte: ContextePrix, valeurs: dict) -> list[VerificationPrix]:
    controles: list[VerificationPrix] = []
    unite = normaliser_unite(contexte.unite)
    unite_proposee, confiance, raison = proposer_unite(contexte.designation)
    if unite and unite_proposee and unite != unite_proposee and confiance >= Decimal("0.70"):
        controles.append(VerificationPrix("metier", "alerte", f"Unité à vérifier : {raison}", Decimal("-0.05"), {"unite_lue": unite, "unite_proposee": unite_proposee}))
    elif unite:
        controles.append(VerificationPrix("metier", "ok", "L'unité ne présente pas d'incohérence évidente avec la désignation.", Decimal("0.04"), {"unite": unite}))

    pv = valeurs.get("prix_vente_unitaire") or valeurs.get("prix_vente") or contexte.prix_vente
    ds = valeurs.get("debourse_sec") or contexte.debourse_sec
    if pv and ds:
        if ds > pv:
            controles.append(VerificationPrix("metier", "critique", "Le déboursé sec est supérieur au prix de vente.", Decimal("-0.30"), {"debourse_sec": ds, "prix_vente": pv}))
        else:
            controles.append(VerificationPrix("metier", "ok", "Le déboursé sec reste inférieur au prix de vente.", Decimal("0.06"), {"debourse_sec": ds, "prix_vente": pv}))

    k = valeurs.get("coefficient_k") or contexte.coefficient_k
    if k:
        if k < Decimal("1.10"):
            controles.append(VerificationPrix("metier", "alerte", "Coefficient K très bas : vérifier les frais et la marge.", Decimal("-0.10"), {"coefficient_k": k}))
        elif k > Decimal("2.80"):
            controles.append(VerificationPrix("metier", "alerte", "Coefficient K élevé : vérifier le contexte, les aléas ou une erreur de prix.", Decimal("-0.08"), {"coefficient_k": k}))
        else:
            controles.append(VerificationPrix("metier", "ok", "Le coefficient K est dans une plage usuelle paramétrable.", Decimal("0.05"), {"coefficient_k": k}))
    return controles


def verifier_statistique(contexte: ContextePrix, valeurs: dict) -> list[VerificationPrix]:
    prix_reference = valeurs.get("prix_vente_unitaire") or valeurs.get("prix_unitaire_ht") or contexte.prix_unitaire_ht or contexte.prix_vente
    if not prix_reference:
        return []
    prix_marche = []
    for item in contexte.prix_marche_similaires or []:
        valeur = decimal_ou_none(item.get("prix_unitaire_ht") or item.get("prix_vente_unitaire") or item.get("prix"))
        if valeur and valeur > 0:
            prix_marche.append(valeur)
    mediane = mediane_decimale(prix_marche)
    if not mediane:
        return [VerificationPrix("comparaison_marche", "info", "Aucun prix de marché comparable n'a été fourni.", Decimal("-0.02"))]
    ecart = ecart_relatif(prix_reference, mediane)
    if ecart is not None and ecart <= Decimal("0.15"):
        return [VerificationPrix("comparaison_marche", "ok", "Le prix est proche de la médiane des prix similaires.", Decimal("0.10"), {"mediane": mediane, "ecart": ecart})]
    if ecart is not None and ecart <= Decimal("0.35"):
        return [VerificationPrix("comparaison_marche", "alerte", "Le prix s'écarte sensiblement de la médiane des prix similaires.", Decimal("-0.06"), {"mediane": mediane, "ecart": ecart})]
    return [VerificationPrix("comparaison_marche", "critique", "Le prix est très éloigné des prix de marché similaires.", Decimal("-0.18"), {"mediane": mediane, "ecart": ecart})]


def verifier_documentaire(contexte: ContextePrix) -> list[VerificationPrix]:
    controles: list[VerificationPrix] = []
    if contexte.type_document:
        controles.append(VerificationPrix("documentaire", "info", f"Source analysée : {contexte.type_document}.", Decimal("0.01")))
    if contexte.source_document and not contexte.niveau_fiabilite_source:
        controles.append(VerificationPrix("documentaire", "alerte", "La source documentaire est indiquée sans niveau de fiabilité.", Decimal("-0.03")))
    return controles


def verifier_coherence_croisee(propositions: list, valeurs: dict) -> list[VerificationPrix]:
    prix = [p.prix_propose for p in propositions if p.prix_propose and p.confiance >= Decimal("0.45")]
    if len(prix) < 2:
        return [VerificationPrix("coherence_croisee", "info", "Pas assez de stratégies fiables pour mesurer une convergence.", Decimal("0"))]
    mediane = mediane_decimale(prix)
    ecarts = [ecart_relatif(p, mediane) for p in prix if mediane]
    ecarts_valides = [e for e in ecarts if e is not None]
    if ecarts_valides and max(ecarts_valides) <= Decimal("0.12"):
        return [VerificationPrix("coherence_croisee", "ok", "Les stratégies disponibles convergent vers une valeur proche.", Decimal("0.12"), {"mediane": mediane})]
    return [VerificationPrix("coherence_croisee", "alerte", "Les stratégies disponibles divergent : validation humaine requise.", Decimal("-0.10"), {"mediane": mediane})]


def executer_verifications(contexte: ContextePrix, valeurs: dict, propositions: list) -> list[VerificationPrix]:
    controles: list[VerificationPrix] = []
    controles.extend(verifier_arithmetique(contexte, valeurs))
    controles.extend(verifier_metier(contexte, valeurs))
    controles.extend(verifier_statistique(contexte, valeurs))
    controles.extend(verifier_documentaire(contexte))
    controles.extend(verifier_coherence_croisee(propositions, valeurs))
    return controles
