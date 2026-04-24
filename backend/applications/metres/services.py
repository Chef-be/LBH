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


def _est_dxf_texte(chemin: str) -> bool:
    """Vérifie si le fichier est un DXF textuel (vs DWG binaire)."""
    try:
        with open(chemin, "rb") as f:
            entete = f.read(8)
        # DWG binaire : commence par AC + code version (ex: AC1027)
        if entete[:2] == b"AC" and entete[2:6].isdigit():
            return False
        # DXF textuel : commence généralement par "  0" (groupe code)
        return True
    except OSError:
        return False


def _generer_placeholder_dwg_png(largeur_px: int = 2480, hauteur_px: int = 1754) -> bytes:
    """Génère une image PNG informative pour les fichiers DWG binaires."""
    import io
    from PIL import Image, ImageDraw, ImageFont

    img = Image.new("RGB", (largeur_px, hauteur_px), color=(248, 249, 250))
    dessin = ImageDraw.Draw(img)

    # Grille de fond
    for x in range(0, largeur_px, 80):
        dessin.line([(x, 0), (x, hauteur_px)], fill=(220, 225, 230), width=1)
    for y in range(0, hauteur_px, 80):
        dessin.line([(0, y), (largeur_px, y)], fill=(220, 225, 230), width=1)

    # Message central
    cx, cy = largeur_px // 2, hauteur_px // 2
    try:
        police = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 48)
        police_sm = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 32)
    except OSError:
        police = police_sm = ImageFont.load_default()

    texte_titre = "Fichier DWG"
    texte_info = "Format binaire AutoCAD - Aperçu non disponible"
    texte_aide = "Utilisez l'outil de tracé pour mesurer sur ce fond de plan"

    dessin.text((cx, cy - 60), texte_titre, fill=(59, 130, 246), font=police, anchor="mm")
    dessin.text((cx, cy + 10), texte_info, fill=(100, 116, 139), font=police_sm, anchor="mm")
    dessin.text((cx, cy + 60), texte_aide, fill=(148, 163, 184), font=police_sm, anchor="mm")

    tampon = io.BytesIO()
    img.save(tampon, format="PNG", optimize=True)
    tampon.seek(0)
    return tampon.read()


def convertir_dxf_en_png(source, largeur_px: int = 2480, hauteur_px: int = 1754) -> bytes:
    """
    Convertit un fichier DXF en image PNG via ezdxf + matplotlib.
    Pour les DWG binaires, génère un placeholder informatif.
    `source` peut être un chemin str ou un FieldFile Django (MinIO).
    """
    import io
    import os
    import tempfile
    import ezdxf
    import ezdxf.recover
    from ezdxf.addons.drawing import RenderContext, Frontend
    from ezdxf.addons.drawing.matplotlib import MatplotlibBackend
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    # Télécharger le fichier depuis le stockage si nécessaire
    if isinstance(source, str):
        chemin = source
        supprimer_temp = False
        ext = os.path.splitext(source)[1].lower()
    else:
        ext = os.path.splitext(source.name)[1].lower()
        with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
            with source.open("rb") as f:
                tmp.write(f.read())
            chemin = tmp.name
        supprimer_temp = True

    try:
        # Les DWG binaires ne sont pas lisibles par ezdxf
        if not _est_dxf_texte(chemin):
            return _generer_placeholder_dwg_png(largeur_px, hauteur_px)

        try:
            doc = ezdxf.readfile(chemin)
        except Exception:
            doc, _ = ezdxf.recover.readfile(chemin)

        msp = doc.modelspace()
        fig = plt.figure(figsize=(largeur_px / 100, hauteur_px / 100), dpi=100)
        ax = fig.add_axes([0, 0, 1, 1])
        ax.set_aspect("equal")
        ax.axis("off")
        fig.patch.set_facecolor("white")

        ctx = RenderContext(doc)
        out = MatplotlibBackend(ax)
        Frontend(ctx, out).draw_layout(msp, finalize=True)

        tampon = io.BytesIO()
        fig.savefig(tampon, format="png", dpi=100, bbox_inches="tight",
                    facecolor="white", pad_inches=0.05)
        plt.close(fig)
        tampon.seek(0)
        return tampon.read()
    finally:
        if supprimer_temp:
            try:
                os.unlink(chemin)
            except OSError:
                pass


def generer_miniature_fond_plan(fond_plan) -> bool:
    """
    Génère et enregistre la miniature PNG d'un FondPlan DXF/DWG.
    Retourne True si la miniature a été générée.
    """
    from django.core.files.base import ContentFile

    if not (fond_plan.fichier and fond_plan.fichier.name):
        return False
    nom = fond_plan.fichier.name.lower()
    if not (nom.endswith(".dxf") or nom.endswith(".dwg")):
        return False

    try:
        png_bytes = convertir_dxf_en_png(fond_plan.fichier)
    except Exception as exc:
        raise ValueError(f"Impossible de convertir le fichier CAO en image : {exc}") from exc

    import os
    nom_base = os.path.splitext(os.path.basename(fond_plan.fichier.name))[0]
    nom_miniature = f"{nom_base}_miniature.png"
    fond_plan.miniature.save(nom_miniature, ContentFile(png_bytes), save=True)
    return True


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
