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
    arbre = ast.parse(expression, mode="eval")
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
