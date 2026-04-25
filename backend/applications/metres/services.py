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


def _est_dwg_binaire(chemin: str) -> bool:
    """Retourne True si le fichier est un DWG binaire AutoCAD (magic bytes AC + version)."""
    try:
        with open(chemin, "rb") as f:
            entete = f.read(8)
        return entete[:2] == b"AC" and entete[2:6].isdigit()
    except OSError:
        return False


def _convertir_dwg_en_dxf(chemin_dwg: str) -> str:
    """
    Convertit un fichier DWG binaire en DXF via dwg2dxf (LibreDWG).
    Retourne le chemin du fichier DXF temporaire généré.
    Lève ValueError si dwg2dxf est absent ou si la conversion échoue.
    """
    import os
    import shutil
    import subprocess
    import tempfile

    dwg2dxf = shutil.which("dwg2dxf")
    if not dwg2dxf:
        raise ValueError("dwg2dxf introuvable. LibreDWG n'est pas installé.")

    tmpdir = tempfile.mkdtemp()
    nom_base = os.path.splitext(os.path.basename(chemin_dwg))[0]
    chemin_dxf = os.path.join(tmpdir, f"{nom_base}.dxf")

    resultat = subprocess.run(
        [dwg2dxf, "--as", "r2000", chemin_dwg, "-o", chemin_dxf],
        capture_output=True, timeout=120,
    )
    stderr_txt = resultat.stderr.decode("utf-8", errors="replace") if resultat.stderr else ""
    if resultat.returncode != 0 or not os.path.exists(chemin_dxf):
        raise ValueError(f"Échec dwg2dxf (code {resultat.returncode}) : {stderr_txt[:400]}")

    return chemin_dxf


def _extents_valides(doc) -> tuple | None:
    """Retourne (xmin, ymin, xmax, ymax) depuis $EXTMIN/$EXTMAX si valides, sinon None."""
    import math
    try:
        extmin = doc.header.get("$EXTMIN")
        extmax = doc.header.get("$EXTMAX")
        if not (extmin and extmax):
            return None
        xmin, ymin = float(extmin[0]), float(extmin[1])
        xmax, ymax = float(extmax[0]), float(extmax[1])
        if all(math.isfinite(v) for v in (xmin, ymin, xmax, ymax)) and xmax > xmin and ymax > ymin:
            return xmin, ymin, xmax, ymax
    except Exception:
        pass
    return None


def _couleur_hachure(entity, doc) -> tuple:
    """Résout la couleur RGB d'une entité HATCH DXF (ACI ou true color)."""
    import ezdxf.colors as ezc
    try:
        if entity.dxf.hasattr("true_color"):
            tc = entity.dxf.true_color
            return ((tc >> 16) & 0xFF, (tc >> 8) & 0xFF, tc & 0xFF)
        aci = entity.dxf.color if entity.dxf.hasattr("color") else 256
        if aci == 0:
            aci = 7
        if aci == 256:
            layer = doc.layers.get(entity.dxf.layer, None)
            if layer and layer.dxf.hasattr("color"):
                aci = layer.dxf.color
            else:
                aci = 7
        if 1 <= aci <= 255:
            return ezc.aci2rgb(aci)
    except Exception:
        pass
    return (100, 100, 100)


def _dessiner_fills_hachures(doc, msp, img_w: int, img_h: int,
                              xmin: float, ymin: float,
                              total_w: float, total_h: float) -> "Image":
    """
    Dessine les remplissages des entités HATCH directement via PIL.
    Les polygones sont clippés nativement par PIL.ImageDraw.polygon().
    Retourne une image RGBA (fond transparent).
    """
    from PIL import Image, ImageDraw

    def utm_vers_px(x: float, y: float):
        px = (x - xmin) / total_w * img_w
        py = img_h - (y - ymin) / total_h * img_h
        return (int(round(px)), int(round(py)))

    couche = Image.new("RGBA", (img_w, img_h), (255, 255, 255, 0))
    draw = ImageDraw.Draw(couche)

    for entity in msp:
        if entity.dxftype() != "HATCH":
            continue
        r, g, b = _couleur_hachure(entity, doc)
        fill_color = (r, g, b, 200)

        for boundary_path in entity.paths:
            try:
                vertices = None
                if hasattr(boundary_path, "vertices"):
                    vertices = [(v[0], v[1]) for v in boundary_path.vertices]
                elif hasattr(boundary_path, "edges"):
                    pts = []
                    for edge in boundary_path.edges:
                        if hasattr(edge, "start"):
                            pts.append((edge.start[0], edge.start[1]))
                        elif hasattr(edge, "center"):
                            pts.append((edge.center[0], edge.center[1]))
                    vertices = pts if pts else None
                if vertices and len(vertices) >= 3:
                    pts_px = [utm_vers_px(v[0], v[1]) for v in vertices]
                    draw.polygon(pts_px, fill=fill_color)
            except Exception:
                pass

    return couche


def _rendre_dxf_en_png(chemin_dxf: str, largeur_px: int, hauteur_px: int) -> bytes:
    """
    Rend un fichier DXF en PNG en 2 passes :
    1. ezdxf + matplotlib (SHOW_OUTLINE) — lignes et texte sans débordement
    2. PIL polygones HATCH — remplissages colorés clippés nativement
    Les deux couches sont composées (fills sous les lignes).
    """
    import io
    import ezdxf
    import ezdxf.recover
    from ezdxf.addons.drawing import RenderContext, Frontend
    from ezdxf.addons.drawing.matplotlib import MatplotlibBackend
    from ezdxf.addons.drawing.config import Configuration, HatchPolicy
    from PIL import Image
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    try:
        doc = ezdxf.readfile(chemin_dxf)
    except Exception:
        doc, _ = ezdxf.recover.readfile(chemin_dxf)

    msp = doc.modelspace()
    BG = "#ffffff"
    ext = _extents_valides(doc)

    # DPI de rendu : 200 pour l'aperçu, 300 pour la HD → meilleure qualité textes et lignes fines
    dpi_rendu = 200 if largeur_px <= 2000 else 300

    if ext:
        xmin, ymin, xmax, ymax = ext
        dx = xmax - xmin
        dy = ymax - ymin
        marge = max(dx, dy) * 0.03
        ratio = (dx + 2 * marge) / (dy + 2 * marge)
        if ratio >= largeur_px / hauteur_px:
            w = largeur_px / dpi_rendu
            h = max(w / ratio, 2)
        else:
            h = hauteur_px / dpi_rendu
            w = max(h * ratio, 2)
    else:
        w, h = largeur_px / dpi_rendu, hauteur_px / dpi_rendu
        marge = None

    # --- Phase 1 : rendu ezdxf + matplotlib (SHOW_OUTLINE uniquement) ---
    # fond transparent : matplotlib exporte le PNG avec alpha=0 sur le fond,
    # ce qui préserve tous les textes et lignes de toute couleur.
    fig, ax = plt.subplots(figsize=(w, h), dpi=dpi_rendu)
    fig.patch.set_alpha(0)
    ax.set_facecolor((0, 0, 0, 0))
    ax.axis("off")
    plt.subplots_adjust(left=0, right=1, top=1, bottom=0)
    ax.set_aspect("equal", adjustable="box")
    if ext:
        ax.set_xlim(xmin - marge, xmax + marge)
        ax.set_ylim(ymin - marge, ymax + marge)

    ctx = RenderContext(doc)
    ctx.current_layout_properties.set_colors(BG)
    out = MatplotlibBackend(ax)
    config = Configuration.defaults().with_changes(hatch_policy=HatchPolicy.SHOW_OUTLINE)
    Frontend(ctx, out, config=config).draw_layout(msp, finalize=False)

    if ext:
        ax.autoscale(False)
        ax.set_xlim(xmin - marge, xmax + marge)
        ax.set_ylim(ymin - marge, ymax + marge)

    tampon = io.BytesIO()
    fig.savefig(tampon, format="png", dpi=dpi_rendu, transparent=True, bbox_inches=None)
    plt.close(fig)
    tampon.seek(0)
    img_lignes = Image.open(tampon).convert("RGBA")
    img_w, img_h = img_lignes.size

    # Neutralise les pixels blancs opaques : un texte ou trait blanc (RGB≈255)
    # sur fond transparent est invisible une fois composité sur fond blanc.
    # On les bascule en noir en préservant leur alpha.
    import numpy as np
    arr = np.array(img_lignes)
    masque_blanc_opaque = (
        (arr[:, :, 0] >= 230) &
        (arr[:, :, 1] >= 230) &
        (arr[:, :, 2] >= 230) &
        (arr[:, :, 3] > 30)
    )
    arr[masque_blanc_opaque, 0] = 0
    arr[masque_blanc_opaque, 1] = 0
    arr[masque_blanc_opaque, 2] = 0
    img_lignes = Image.fromarray(arr, "RGBA")

    # --- Phase 2 : remplissages HATCH via PIL (clipping natif par polygone) ---
    if ext:
        total_w = dx + 2 * marge
        total_h = dy + 2 * marge
        couche_fills = _dessiner_fills_hachures(
            doc, msp, img_w, img_h,
            xmin - marge, ymin - marge,
            total_w, total_h,
        )
        fond = Image.new("RGBA", (img_w, img_h), (255, 255, 255, 255))
        fond_avec_fills = Image.alpha_composite(fond, couche_fills)
        img_finale = Image.alpha_composite(fond_avec_fills, img_lignes)
    else:
        fond = Image.new("RGBA", (img_w, img_h), (255, 255, 255, 255))
        img_finale = Image.alpha_composite(fond, img_lignes)

    tampon_final = io.BytesIO()
    img_finale.convert("RGB").save(tampon_final, format="png")
    tampon_final.seek(0)
    return tampon_final.read()


def convertir_dxf_en_png(source, largeur_px: int = 2480, hauteur_px: int = 1754) -> bytes:
    """
    Convertit un fichier DXF ou DWG en image PNG.
    - DXF texte : rendu direct via ezdxf + matplotlib.
    - DWG binaire : conversion DWG→DXF via dwg2dxf (LibreDWG) puis rendu.
    `source` peut être un chemin str ou un FieldFile Django (MinIO).
    """
    import os
    import tempfile

    # Télécharger depuis le stockage MinIO si nécessaire
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

    chemin_dxf_temp = None
    try:
        if _est_dwg_binaire(chemin):
            # DWG binaire → conversion LibreDWG → DXF → PNG
            chemin_dxf_temp = _convertir_dwg_en_dxf(chemin)
            return _rendre_dxf_en_png(chemin_dxf_temp, largeur_px, hauteur_px)
        else:
            # DXF texte → rendu direct
            return _rendre_dxf_en_png(chemin, largeur_px, hauteur_px)
    finally:
        if supprimer_temp:
            try:
                os.unlink(chemin)
            except OSError:
                pass
        if chemin_dxf_temp:
            import shutil
            try:
                shutil.rmtree(os.path.dirname(chemin_dxf_temp), ignore_errors=True)
            except OSError:
                pass


def _generer_placeholder_dwg_png(largeur_px: int = 2480, hauteur_px: int = 1754) -> bytes:
    """Génère une image PNG informative pour les DWG non lisibles."""
    import io
    from PIL import Image, ImageDraw, ImageFont

    img = Image.new("RGB", (largeur_px, hauteur_px), color=(248, 249, 250))
    dessin = ImageDraw.Draw(img)
    for x in range(0, largeur_px, 80):
        dessin.line([(x, 0), (x, hauteur_px)], fill=(220, 225, 230), width=1)
    for y in range(0, hauteur_px, 80):
        dessin.line([(0, y), (largeur_px, y)], fill=(220, 225, 230), width=1)
    cx, cy = largeur_px // 2, hauteur_px // 2
    try:
        police = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 48)
        police_sm = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 32)
    except OSError:
        police = police_sm = ImageFont.load_default()
    dessin.text((cx, cy - 60), "Fichier DWG", fill=(59, 130, 246), font=police, anchor="mm")
    dessin.text((cx, cy + 10), "Format non lisible — aperçu indisponible", fill=(100, 116, 139), font=police_sm, anchor="mm")
    dessin.text((cx, cy + 60), "Convertissez en DXF pour obtenir un rendu", fill=(148, 163, 184), font=police_sm, anchor="mm")
    tampon = io.BytesIO()
    img.save(tampon, format="PNG", optimize=True)
    tampon.seek(0)
    return tampon.read()


def generer_miniature_fond_plan(fond_plan) -> bool:
    """
    Génère et enregistre l'aperçu (800px) et la miniature HD (4960px) d'un FondPlan DXF/DWG.
    L'aperçu est produit en premier pour un affichage immédiat dans le canvas.
    Retourne True si au moins un rendu a été produit.
    """
    import logging
    import os
    from django.core.files.base import ContentFile

    logger = logging.getLogger(__name__)

    if not (fond_plan.fichier and fond_plan.fichier.name):
        return False
    nom = fond_plan.fichier.name.lower()
    if not (nom.endswith(".dxf") or nom.endswith(".dwg")):
        return False

    nom_base = os.path.splitext(os.path.basename(fond_plan.fichier.name))[0]

    # 1. Aperçu rapide (1200px) — disponible rapidement pour le canvas
    try:
        apercu_bytes = convertir_dxf_en_png(fond_plan.fichier, largeur_px=1200, hauteur_px=850)
    except Exception as exc:
        logger.warning("Aperçu CAO échoué pour %s : %s", fond_plan.fichier.name, exc)
        apercu_bytes = _generer_placeholder_dwg_png()

    fond_plan.apercu.save(f"{nom_base}_apercu.png", ContentFile(apercu_bytes), save=True)
    logger.info("Aperçu CAO généré pour %s", fond_plan.fichier.name)

    # 2. Miniature haute résolution (7016px ≈ A1 à 150 DPI) — pour le zoom
    try:
        hd_bytes = convertir_dxf_en_png(fond_plan.fichier, largeur_px=7016, hauteur_px=4961)
    except Exception as exc:
        logger.warning("Miniature HD CAO échouée pour %s : %s — copie de l'aperçu.", fond_plan.fichier.name, exc)
        hd_bytes = apercu_bytes

    fond_plan.miniature.save(f"{nom_base}_miniature.png", ContentFile(hd_bytes), save=True)
    logger.info("Miniature HD CAO générée pour %s", fond_plan.fichier.name)
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
