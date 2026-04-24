"""Services métier pour les métrés et le calcul de formules quantitatives."""

from __future__ import annotations

import ast
import operator
import re
from decimal import Decimal, ROUND_HALF_UP


OPERATEURS_BINAIRES = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.Pow: operator.pow,
}

OPERATEURS_UNAIRES = {
    ast.UAdd: operator.pos,
    ast.USub: operator.neg,
}


def arrondir_quantite(valeur: Decimal, decimales: int = 3) -> Decimal:
    quantification = Decimal(f"0.{'0' * decimales}")
    return valeur.quantize(quantification, rounding=ROUND_HALF_UP)


def _normaliser_expression(expression: str) -> str:
    return (
        (expression or "")
        .replace("×", "*")
        .replace("÷", "/")
        .replace("−", "-")
        .replace(",", ".")
        .replace(";", "\n")
    )


def _evaluer_ast(noeud: ast.AST, variables: dict[str, Decimal]) -> Decimal:
    if isinstance(noeud, ast.Expression):
        return _evaluer_ast(noeud.body, variables)
    if isinstance(noeud, ast.Constant):
        if isinstance(noeud.value, (int, float)):
            return Decimal(str(noeud.value))
        raise ValueError("Constante non autorisée dans la formule.")
    if isinstance(noeud, ast.Name):
        if noeud.id not in variables:
            raise ValueError(f"Variable inconnue : {noeud.id}")
        return variables[noeud.id]
    if isinstance(noeud, ast.BinOp):
        operateur = OPERATEURS_BINAIRES.get(type(noeud.op))
        if not operateur:
            raise ValueError("Opérateur non autorisé dans la formule.")
        gauche = _evaluer_ast(noeud.left, variables)
        droite = _evaluer_ast(noeud.right, variables)
        if isinstance(noeud.op, ast.Div) and droite == 0:
            raise ValueError("Division par zéro dans la formule.")
        return Decimal(str(operateur(gauche, droite)))
    if isinstance(noeud, ast.UnaryOp):
        operateur = OPERATEURS_UNAIRES.get(type(noeud.op))
        if not operateur:
            raise ValueError("Opérateur unaire non autorisé dans la formule.")
        return Decimal(str(operateur(_evaluer_ast(noeud.operand, variables))))
    raise ValueError("Expression de calcul non prise en charge.")


def evaluer_expression_quantitative(expression: str, variables: dict[str, Decimal]) -> Decimal:
    expression = expression.strip()
    if not expression:
        raise ValueError("L'expression est vide.")
    try:
        arbre = ast.parse(expression, mode="eval")
    except SyntaxError as exc:
        raise ValueError(f"Expression de calcul invalide : {exc}") from exc
    return _evaluer_ast(arbre, variables)


def analyser_detail_calcul(detail_calcul: str) -> dict[str, object]:
    texte = _normaliser_expression(detail_calcul)
    lignes = [ligne.strip() for ligne in texte.splitlines() if ligne.strip()]
    if not lignes:
        raise ValueError("Aucun détail de calcul n'a été fourni.")

    variables: dict[str, Decimal] = {
        "pi": Decimal("3.141592653589793"),
    }
    etapes: list[dict[str, object]] = []
    total = Decimal("0")

    for index, ligne in enumerate(lignes, start=1):
        correspondance = re.match(r"^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$", ligne)
        if correspondance:
            nom_variable, expression = correspondance.groups()
            valeur = evaluer_expression_quantitative(expression, variables)
            variables[nom_variable] = valeur
            etapes.append(
                {
                    "type": "variable",
                    "libelle": nom_variable,
                    "expression": expression.strip(),
                    "valeur": float(arrondir_quantite(valeur)),
                }
            )
            continue

        valeur = evaluer_expression_quantitative(ligne, variables)
        total += valeur
        etapes.append(
            {
                "type": "ligne",
                "libelle": f"Ligne {index}",
                "expression": ligne,
                "valeur": float(arrondir_quantite(valeur)),
            }
        )

    return {
        "detail_normalise": "\n".join(lignes),
        "quantite_calculee": float(arrondir_quantite(total)),
        "etapes": etapes,
        "variables": {
            cle: float(arrondir_quantite(valeur))
            for cle, valeur in variables.items()
            if cle != "pi"
        },
    }


import math


def calculer_surface_polygone_px(points_px: list, echelle_px_par_m: float) -> float:
    """
    Calcule la surface en m² d'un polygone défini en coordonnées pixel.
    Utilise la formule du lacet de Gauss (shoelace formula).
    """
    if len(points_px) < 3:
        return 0.0

    n = len(points_px)
    aire_px2 = 0.0
    for i in range(n):
        j = (i + 1) % n
        aire_px2 += points_px[i][0] * points_px[j][1]
        aire_px2 -= points_px[j][0] * points_px[i][1]
    aire_px2 = abs(aire_px2) / 2.0

    # Convertir px² en m² : surface_m2 = aire_px2 / echelle²
    if echelle_px_par_m and echelle_px_par_m > 0:
        return aire_px2 / (echelle_px_par_m ** 2)
    return aire_px2  # Retourne en px² si pas d'échelle


def calculer_longueur_polyligne_px(points_px: list, echelle_px_par_m: float) -> float:
    """Calcule la longueur en mètres d'une polyligne en coordonnées pixel."""
    if len(points_px) < 2:
        return 0.0

    longueur_px = 0.0
    for i in range(len(points_px) - 1):
        dx = points_px[i + 1][0] - points_px[i][0]
        dy = points_px[i + 1][1] - points_px[i][1]
        longueur_px += math.sqrt(dx ** 2 + dy ** 2)

    if echelle_px_par_m and echelle_px_par_m > 0:
        return longueur_px / echelle_px_par_m
    return longueur_px


def calculer_zone_mesure(zone) -> dict:
    """
    Calcule les valeurs (brute, déductions, nette) d'une ZoneMesure.
    Retourne un dict avec les résultats.
    """
    echelle = float(zone.fond_plan.echelle or 1.0)
    points = zone.points_px or []

    if zone.type_mesure == "surface":
        valeur_brute = calculer_surface_polygone_px(points, echelle)
        total_deductions = sum(
            calculer_surface_polygone_px(d.get("points_px", []), echelle)
            for d in (zone.deductions or [])
        )
        valeur_nette = max(0.0, valeur_brute - total_deductions)
        unite = "m²"

    elif zone.type_mesure in ("longueur", "perimetre"):
        valeur_brute = calculer_longueur_polyligne_px(points, echelle)
        total_deductions = 0.0
        valeur_nette = valeur_brute
        unite = "ml"

    elif zone.type_mesure == "comptage":
        valeur_brute = float(len(points))
        total_deductions = 0.0
        valeur_nette = valeur_brute
        unite = "u"

    else:
        valeur_brute = total_deductions = valeur_nette = 0.0
        unite = zone.unite or "u"

    return {
        "valeur_brute": round(valeur_brute, 4),
        "valeur_deduction": round(total_deductions, 4),
        "valeur_nette": round(valeur_nette, 4),
        "unite": unite,
    }


def creer_ligne_depuis_zone(zone, metre, numero_ordre: int):
    """Crée une LigneMetre à partir d'une ZoneMesure calculée."""
    from .models import LigneMetre

    resultats = calculer_zone_mesure(zone)
    detail = f"Mesure visuelle {zone.type_mesure}"
    if zone.type_mesure == "surface":
        detail = (
            f"Brut {resultats['valeur_brute']:.3f} m2"
            f" - Deductions {resultats['valeur_deduction']:.3f} m2"
            f" = Net {resultats['valeur_nette']:.3f} m2"
        )
    elif zone.type_mesure in ("longueur", "perimetre"):
        detail = f"Longueur {resultats['valeur_nette']:.3f} ml"

    ligne = LigneMetre.objects.create(
        metre=metre,
        numero_ordre=numero_ordre,
        designation=zone.designation,
        nature="travaux",
        quantite=Decimal(str(resultats["valeur_nette"])),
        unite=resultats["unite"],
        detail_calcul=detail,
    )
    zone.ligne_metre = ligne
    zone.valeur_brute = Decimal(str(resultats["valeur_brute"]))
    zone.valeur_deduction = Decimal(str(resultats["valeur_deduction"]))
    zone.valeur_nette = Decimal(str(resultats["valeur_nette"]))
    zone.unite = resultats["unite"]
    zone.save()
    return ligne
