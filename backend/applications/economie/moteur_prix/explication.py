"""Génération d'explications métier synthétiques."""

from __future__ import annotations

from .resultats import ResultatPrix


def expliquer_resultat(resultat: ResultatPrix) -> str:
    valeurs = {**resultat.valeurs_calculees, **resultat.valeurs_estimees}
    prix = valeurs.get("prix_vente_unitaire") or valeurs.get("prix_unitaire_ht") or valeurs.get("prix_vente")
    strategie = resultat.strategie_utilisee.replace("_", " ")
    morceaux = [f"Analyse réalisée avec la stratégie principale « {strategie} »."]
    if prix:
        morceaux.append(f"Prix de référence retenu : {prix} € HT.")
    if resultat.hypotheses:
        morceaux.append(f"{len(resultat.hypotheses)} hypothèse(s) explicite(s) ont été formulées.")
    if resultat.alertes:
        morceaux.append(f"{len(resultat.alertes)} alerte(s) demandent une validation.")
    else:
        morceaux.append("Aucune incohérence bloquante détectée.")
    morceaux.append(f"Niveau de confiance : {resultat.niveau_confiance_global}.")
    return " ".join(morceaux)

