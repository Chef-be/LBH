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
    """
    Retourne (xmin, ymin, xmax, ymax) depuis $EXTMIN/$EXTMAX si valides.
    Fallback : calcul depuis la bounding-box réelle des entités du modelspace.
    """
    import math
    try:
        extmin = doc.header.get("$EXTMIN")
        extmax = doc.header.get("$EXTMAX")
        if extmin and extmax:
            xmin, ymin = float(extmin[0]), float(extmin[1])
            xmax, ymax = float(extmax[0]), float(extmax[1])
            # Valeurs "unset" qu'AutoCAD place souvent dans les headers invalides
            INVALIDE = 1e+20
            if (all(math.isfinite(v) for v in (xmin, ymin, xmax, ymax))
                    and xmax > xmin and ymax > ymin
                    and abs(xmin) < INVALIDE and abs(ymin) < INVALIDE):
                return xmin, ymin, xmax, ymax
    except Exception:
        pass

    # Fallback : parcourt les entités du modelspace pour calculer le bbox réel
    try:
        from ezdxf.bbox import BoundingBox2d
        bb = BoundingBox2d()
        for entity in doc.modelspace():
            try:
                t = entity.dxftype()
                if t == "LINE":
                    bb.extend([entity.dxf.start[:2], entity.dxf.end[:2]])
                elif t in ("LWPOLYLINE",):
                    bb.extend([v[:2] for v in entity.get_points()])
                elif t in ("ARC", "CIRCLE"):
                    c = entity.dxf.center
                    r = entity.dxf.radius
                    bb.extend([(c.x - r, c.y - r), (c.x + r, c.y + r)])
                elif t in ("INSERT", "TEXT", "MTEXT"):
                    ins = entity.dxf.insert
                    bb.extend([(ins.x, ins.y)])
            except Exception:
                pass
        if bb.has_data:
            xmin, ymin = bb.extmin
            xmax, ymax = bb.extmax
            if xmax > xmin and ymax > ymin:
                return float(xmin), float(ymin), float(xmax), float(ymax)
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

    # Configure les répertoires de polices système pour ezdxf (substitution Arial, Times…)
    ezdxf.options.support_dirs = [
        "/usr/share/fonts/truetype/liberation",
        "/usr/share/fonts/truetype/dejavu",
        "/usr/share/fonts/type1/urw-base35",
        "/usr/share/fonts",
    ]

    try:
        doc = ezdxf.readfile(chemin_dxf)
    except Exception:
        doc, _ = ezdxf.recover.readfile(chemin_dxf)

    # Substitue les polices manquantes par Liberation Sans (≈ Arial)
    import os
    polices_disponibles = {
        f.lower() for rep in [
            "/usr/share/fonts/truetype/liberation",
            "/usr/share/fonts/truetype/dejavu",
        ]
        for f in (os.listdir(rep) if os.path.isdir(rep) else [])
    }
    for style in doc.styles:
        font_name = (getattr(style.dxf, "font", "") or "").strip()
        if font_name and font_name.lower() not in polices_disponibles:
            style.dxf.font = "LiberationSans-Regular.ttf"

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
    apercu_ok = False
    try:
        apercu_bytes = convertir_dxf_en_png(fond_plan.fichier, largeur_px=1200, hauteur_px=850)
        apercu_ok = True
    except Exception:
        logger.error("Aperçu CAO échoué pour %s — placeholder affiché.", fond_plan.fichier.name, exc_info=True)
        apercu_bytes = _generer_placeholder_dwg_png()

    fond_plan.apercu.save(f"{nom_base}_apercu.png", ContentFile(apercu_bytes), save=True)
    if apercu_ok:
        logger.info("Aperçu CAO généré pour %s", fond_plan.fichier.name)

    # 2. Miniature haute résolution (7016px ≈ A1 à 150 DPI) — pour le zoom
    try:
        hd_bytes = convertir_dxf_en_png(fond_plan.fichier, largeur_px=7016, hauteur_px=4961)
    except Exception:
        logger.error("Miniature HD CAO échouée pour %s — repli sur l'aperçu.", fond_plan.fichier.name, exc_info=True)
        hd_bytes = apercu_bytes

    fond_plan.miniature.save(f"{nom_base}_miniature.png", ContentFile(hd_bytes), save=True)
    logger.info("Miniature HD CAO générée pour %s", fond_plan.fichier.name)
    return True


# Correspondance $INSUNITS DXF → mètres par unité
_INSUNITS_METRES = {
    0: 0.001,     # sans unité → suppose mm (architecture)
    1: 0.0254,    # pouces
    2: 0.3048,    # pieds
    3: 1609.344,  # miles
    4: 0.001,     # mm
    5: 0.01,      # cm
    6: 1.0,       # m
    7: 1000.0,    # km
    8: 1e-6,      # microns
    13: 0.1,      # décimètres
}
_INSUNITS_NOMS = {
    0: "mm (par défaut)", 1: "pouces", 2: "pieds",
    4: "mm", 5: "cm", 6: "m", 7: "km", 13: "dm",
}


def detecter_echelle_auto(fond_plan) -> dict:
    """
    Détecte automatiquement l'échelle (px/m) d'un fond de plan DXF.
    Pour DXF : utilise $INSUNITS + extents + dimensions de l'image aperçu.
    Retourne un dict avec `echelle`, `confiance` ("haute"/"moyenne"/"faible"), `methode`, `details`.
    """
    import os
    import tempfile
    import logging

    logger = logging.getLogger(__name__)

    if not (fond_plan.fichier and fond_plan.fichier.name):
        return {"echelle": None, "confiance": "aucune", "methode": None, "details": "Aucun fichier"}

    nom = fond_plan.fichier.name.lower()
    fmt = fond_plan.format_fichier or ""

    # --- DXF : détection fiable via $INSUNITS et extents ---
    if fmt == "dxf" or nom.endswith(".dxf"):
        try:
            import ezdxf, ezdxf.recover

            with tempfile.NamedTemporaryFile(suffix=".dxf", delete=False) as tmp:
                tmp.write(fond_plan.fichier.read())
                chemin = tmp.name

            try:
                try:
                    doc = ezdxf.readfile(chemin)
                except Exception:
                    doc, _ = ezdxf.recover.readfile(chemin)

                ext = _extents_valides(doc)
                if not ext:
                    return {"echelle": None, "confiance": "faible", "methode": "dxf", "details": "Extents DXF indisponibles"}

                xmin, ymin, xmax, ymax = ext
                dx = xmax - xmin
                dy = ymax - ymin
                marge = max(dx, dy) * 0.03
                total_w = dx + 2 * marge
                total_h = dy + 2 * marge

                # Dimensions de l'aperçu rendu (dpi=200, max 1200×850)
                LARG_APE, HAUT_APE, DPI_APE = 1200, 850, 200
                ratio = total_w / total_h
                if ratio >= LARG_APE / HAUT_APE:
                    img_w_px = LARG_APE
                else:
                    img_w_px = HAUT_APE * ratio

                px_par_unite_dxf = img_w_px / total_w

                insunits = int(doc.header.get("$INSUNITS", 0))
                metres_par_unite = _INSUNITS_METRES.get(insunits, 0.001)
                echelle = px_par_unite_dxf / metres_par_unite

                # Confiance : haute si unité explicite (mm/cm/m), moyenne si supposée
                confiance = "haute" if insunits in (4, 5, 6, 1, 2) else "moyenne"
                unite_nom = _INSUNITS_NOMS.get(insunits, f"unité {insunits}")

                details = (
                    f"Unité DXF : {unite_nom} — "
                    f"Étendue : {dx:.1f}×{dy:.1f} unités — "
                    f"Image aperçu : {img_w_px:.0f}px — "
                    f"Échelle calculée : {echelle:.1f} px/m"
                )
                logger.info("Échelle auto DXF détectée : %.1f px/m (%s) pour %s", echelle, confiance, fond_plan.fichier.name)
                return {"echelle": round(echelle, 2), "confiance": confiance, "methode": "dxf_insunits", "details": details}
            finally:
                os.unlink(chemin)

        except Exception:
            logger.error("Détection échelle DXF échouée pour %s", fond_plan.fichier.name, exc_info=True)
            return {"echelle": None, "confiance": "faible", "methode": "dxf", "details": "Erreur lors de la détection"}

    # --- PDF : taille de page vs format standard ---
    if fmt == "pdf" or nom.endswith(".pdf"):
        try:
            import fitz

            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
                tmp.write(fond_plan.fichier.read())
                chemin = tmp.name
            try:
                doc = fitz.open(chemin)
                page = doc[0]
                rect = page.rect
                w_pt, h_pt = rect.width, rect.height  # en points (1pt = 1/72 pouce)
                doc.close()
            finally:
                os.unlink(chemin)

            # Cherche une annotation de type "scale" ou "échelle" dans les métadonnées
            # (heuristique simple — pas d'OCR)
            # On peut donner la taille réelle du PDF en mm pour aider l'utilisateur
            w_mm = w_pt * 25.4 / 72
            h_mm = h_pt * 25.4 / 72

            # Formats papier standards (tolérance 5%)
            formats = {
                "A0": (841, 1189), "A1": (594, 841), "A2": (420, 594),
                "A3": (297, 420), "A4": (210, 297),
            }
            format_detecte = None
            for nom_fmt, (fw, fh) in formats.items():
                if (abs(w_mm - fw) < fw * 0.05 and abs(h_mm - fh) < fh * 0.05) or \
                   (abs(w_mm - fh) < fh * 0.05 and abs(h_mm - fw) < fw * 0.05):
                    format_detecte = nom_fmt
                    break

            details = f"PDF {w_mm:.0f}×{h_mm:.0f} mm"
            if format_detecte:
                details += f" ({format_detecte})"
            details += " — calibrez manuellement avec la règle pour définir l'échelle"

            return {
                "echelle": None, "confiance": "faible", "methode": "pdf_taille",
                "details": details, "format_papier": format_detecte,
                "largeur_mm": round(w_mm), "hauteur_mm": round(h_mm),
            }
        except Exception:
            pass

    return {"echelle": None, "confiance": "faible", "methode": None, "details": "Format non supporté pour la détection automatique"}


def _dedupliquer_points(points: list, tolerance: float = 0.0015) -> list:
    """Déduplique une liste de points [x, y, type] normalisés par grille (priorité : e > q > m > c > z)."""
    PRIORITE = {"e": 0, "q": 1, "m": 2, "c": 3, "z": 4}
    grille: dict = {}
    for p in points:
        clef = (int(p[0] / tolerance), int(p[1] / tolerance))
        typ = p[2] if len(p) > 2 else "e"
        if clef not in grille or PRIORITE.get(typ, 9) < PRIORITE.get(grille[clef][2], 9):
            grille[clef] = p
    return list(grille.values())


def _normaliser_point(x: float, y: float, x0: float, y0: float, total_w: float, total_h: float):
    """Convertit des coordonnées monde → [0,1] normalisées (Y flippé, 0=haut image)."""
    nx = (x - x0) / total_w
    ny = 1.0 - (y - y0) / total_h
    if -0.02 <= nx <= 1.02 and -0.02 <= ny <= 1.02:
        return [round(max(0.0, min(1.0, nx)), 6), round(max(0.0, min(1.0, ny)), 6)]
    return None


def _extraire_points_dxf(chemin: str) -> list:
    """
    Extrait les points d'accroche d'un fichier DXF :
    endpoints, milieux de segments, sommets de polylignes, arcs, cercles, blocs.
    Retourne une liste de [x, y] en coordonnées normalisées [0,1].
    """
    import math
    import ezdxf
    import ezdxf.recover

    try:
        doc = ezdxf.readfile(chemin)
    except Exception:
        doc, _ = ezdxf.recover.readfile(chemin)

    ext = _extents_valides(doc)
    if not ext:
        return []

    xmin, ymin, xmax, ymax = ext
    dx = xmax - xmin
    dy = ymax - ymin
    marge = max(dx, dy) * 0.03
    x0, y0 = xmin - marge, ymin - marge
    total_w, total_h = dx + 2 * marge, dy + 2 * marge

    def norm(x, y):
        return _normaliser_point(x, y, x0, y0, total_w, total_h)

    def appliquer_transform(lx, ly, ox, oy, sx, sy, cos_r, sin_r):
        cx, cy = lx * sx, ly * sy
        if cos_r != 1.0 or sin_r != 0.0:
            cx, cy = cx * cos_r - cy * sin_r, cx * sin_r + cy * cos_r
        return cx + ox, cy + oy

    points: list = []
    MAX = 10000

    def ajouter(wx, wy, typ="e"):
        if len(points) < MAX:
            p = norm(wx, wy)
            if p:
                points.append([p[0], p[1], typ])

    def ajouter_milieu(ax, ay, bx, by):
        ajouter((ax + bx) / 2, (ay + by) / 2, "m")

    def traiter(entity, ox=0.0, oy=0.0, sx=1.0, sy=1.0, cos_r=1.0, sin_r=0.0, profondeur=0):
        if len(points) >= MAX or profondeur > 5:
            return
        t = entity.dxftype()
        try:
            if t == "LINE":
                s, e = entity.dxf.start, entity.dxf.end
                ax, ay = appliquer_transform(s.x, s.y, ox, oy, sx, sy, cos_r, sin_r)
                bx, by = appliquer_transform(e.x, e.y, ox, oy, sx, sy, cos_r, sin_r)
                ajouter(ax, ay)
                ajouter(bx, by)
                ajouter_milieu(ax, ay, bx, by)

            elif t == "LWPOLYLINE":
                pts_lw = list(entity.get_points())
                for i, v in enumerate(pts_lw):
                    wx, wy = appliquer_transform(v[0], v[1], ox, oy, sx, sy, cos_r, sin_r)
                    ajouter(wx, wy)
                    if i > 0:
                        px, py = appliquer_transform(pts_lw[i - 1][0], pts_lw[i - 1][1], ox, oy, sx, sy, cos_r, sin_r)
                        ajouter_milieu(px, py, wx, wy)
                if entity.is_closed and len(pts_lw) > 1:
                    ax, ay = appliquer_transform(pts_lw[-1][0], pts_lw[-1][1], ox, oy, sx, sy, cos_r, sin_r)
                    bx, by = appliquer_transform(pts_lw[0][0], pts_lw[0][1], ox, oy, sx, sy, cos_r, sin_r)
                    ajouter_milieu(ax, ay, bx, by)

            elif t == "POLYLINE":
                verts = list(entity.vertices)
                for i, vertex in enumerate(verts):
                    loc = vertex.dxf.location
                    wx, wy = appliquer_transform(loc.x, loc.y, ox, oy, sx, sy, cos_r, sin_r)
                    ajouter(wx, wy)
                    if i > 0:
                        prev = verts[i - 1].dxf.location
                        px, py = appliquer_transform(prev.x, prev.y, ox, oy, sx, sy, cos_r, sin_r)
                        ajouter_milieu(px, py, wx, wy)

            elif t == "SPLINE":
                # Flattening réel (points sur la courbe) — bien plus précis que les points de contrôle
                try:
                    pts_flat = list(entity.flattening(0.01))
                    n = len(pts_flat)
                    for i, v in enumerate(pts_flat):
                        wx, wy = appliquer_transform(float(v[0]), float(v[1]), ox, oy, sx, sy, cos_r, sin_r)
                        typ = "e" if (i == 0 or i == n - 1) else "m"
                        ajouter(wx, wy, typ)
                        if i > 0:
                            prev = pts_flat[i - 1]
                            px, py = appliquer_transform(float(prev[0]), float(prev[1]), ox, oy, sx, sy, cos_r, sin_r)
                            ajouter_milieu(px, py, wx, wy)
                except Exception:
                    for i, v in enumerate(entity.control_points):
                        wx, wy = appliquer_transform(v[0], v[1], ox, oy, sx, sy, cos_r, sin_r)
                        ajouter(wx, wy, "e")
                        if i > 0:
                            prev = list(entity.control_points)[i - 1]
                            px, py = appliquer_transform(prev[0], prev[1], ox, oy, sx, sy, cos_r, sin_r)
                            ajouter_milieu(px, py, wx, wy)

            elif t == "ARC":
                c, r = entity.dxf.center, entity.dxf.radius
                sa = math.radians(entity.dxf.start_angle)
                ea = math.radians(entity.dxf.end_angle)
                if ea <= sa:
                    ea += 2 * math.pi
                # Extrémités
                for angle in (sa, ea):
                    lx, ly = c.x + r * math.cos(angle), c.y + r * math.sin(angle)
                    wx, wy = appliquer_transform(lx, ly, ox, oy, sx, sy, cos_r, sin_r)
                    ajouter(wx, wy, "e")
                # Milieu
                mid = (sa + ea) / 2
                lx, ly = c.x + r * math.cos(mid), c.y + r * math.sin(mid)
                wx, wy = appliquer_transform(lx, ly, ox, oy, sx, sy, cos_r, sin_r)
                ajouter(wx, wy, "m")
                # Centre
                wx, wy = appliquer_transform(c.x, c.y, ox, oy, sx, sy, cos_r, sin_r)
                ajouter(wx, wy, "c")
                # Quadrants dans l'étendue de l'arc
                for qa in (0.0, math.pi / 2, math.pi, 3 * math.pi / 2):
                    if sa <= qa <= ea or sa <= qa + 2 * math.pi <= ea:
                        lx, ly = c.x + r * math.cos(qa), c.y + r * math.sin(qa)
                        wx, wy = appliquer_transform(lx, ly, ox, oy, sx, sy, cos_r, sin_r)
                        ajouter(wx, wy, "q")

            elif t == "CIRCLE":
                c, r = entity.dxf.center, entity.dxf.radius
                wx, wy = appliquer_transform(c.x, c.y, ox, oy, sx, sy, cos_r, sin_r)
                ajouter(wx, wy, "c")
                # 4 quadrants
                for qa in (0.0, math.pi / 2, math.pi, 3 * math.pi / 2):
                    lx, ly = c.x + r * math.cos(qa), c.y + r * math.sin(qa)
                    wx, wy = appliquer_transform(lx, ly, ox, oy, sx, sy, cos_r, sin_r)
                    ajouter(wx, wy, "q")

            elif t == "ELLIPSE":
                c = entity.dxf.center
                wx, wy = appliquer_transform(c.x, c.y, ox, oy, sx, sy, cos_r, sin_r)
                ajouter(wx, wy, "c")
                try:
                    major = entity.dxf.major_axis
                    ratio = entity.dxf.ratio
                    for fx, fy in ((1, 1), (-1, -1)):
                        ex, ey = c.x + major.x * fx, c.y + major.y * fx
                        wx, wy = appliquer_transform(ex, ey, ox, oy, sx, sy, cos_r, sin_r)
                        ajouter(wx, wy, "q")
                        ex2 = c.x + (-major.y * ratio) * fy
                        ey2 = c.y + (major.x * ratio) * fy
                        wx, wy = appliquer_transform(ex2, ey2, ox, oy, sx, sy, cos_r, sin_r)
                        ajouter(wx, wy, "q")
                except Exception:
                    pass

            elif t in ("TEXT", "MTEXT"):
                ins = entity.dxf.insert if entity.dxf.hasattr("insert") else None
                if ins:
                    wx, wy = appliquer_transform(ins.x, ins.y, ox, oy, sx, sy, cos_r, sin_r)
                    ajouter(wx, wy)

            elif t == "INSERT":
                ins = entity.dxf.insert
                isx = entity.dxf.xscale if entity.dxf.hasattr("xscale") else 1.0
                isy = entity.dxf.yscale if entity.dxf.hasattr("yscale") else 1.0
                irot = math.radians(entity.dxf.rotation) if entity.dxf.hasattr("rotation") else 0.0
                # Compose la rotation avec le parent
                icos, isin = math.cos(irot), math.sin(irot)
                new_cos = cos_r * icos - sin_r * isin
                new_sin = cos_r * isin + sin_r * icos
                # Compose l'offset (le point d'insertion est lui-même transformé par le parent)
                ix, iy = appliquer_transform(ins.x, ins.y, ox, oy, sx, sy, cos_r, sin_r)
                block_name = entity.dxf.name
                if block_name in doc.blocks:
                    for blk_ent in doc.blocks[block_name]:
                        traiter(blk_ent, ix, iy, isx * sx, isy * sy, new_cos, new_sin, profondeur + 1)

            elif t == "HATCH":
                for path in entity.paths:
                    try:
                        if hasattr(path, "edges"):
                            for edge in path.edges:
                                et = getattr(edge, "EDGE_TYPE", "")
                                if et in ("LineEdge", "LINE"):
                                    ax2, ay2 = appliquer_transform(edge.start.x, edge.start.y, ox, oy, sx, sy, cos_r, sin_r)
                                    bx2, by2 = appliquer_transform(edge.end.x, edge.end.y, ox, oy, sx, sy, cos_r, sin_r)
                                    ajouter(ax2, ay2, "e"); ajouter(bx2, by2, "e")
                                    ajouter_milieu(ax2, ay2, bx2, by2)
                                elif et in ("ArcEdge", "ARC"):
                                    cx2 = getattr(edge, "center", None)
                                    if cx2:
                                        wx2, wy2 = appliquer_transform(cx2.x, cx2.y, ox, oy, sx, sy, cos_r, sin_r)
                                        ajouter(wx2, wy2, "c")
                        elif hasattr(path, "vertices"):
                            pts_h = list(path.vertices)
                            for i, v in enumerate(pts_h):
                                wx2, wy2 = appliquer_transform(v[0], v[1], ox, oy, sx, sy, cos_r, sin_r)
                                ajouter(wx2, wy2, "e")
                                if i > 0:
                                    prev = pts_h[i - 1]
                                    px2, py2 = appliquer_transform(prev[0], prev[1], ox, oy, sx, sy, cos_r, sin_r)
                                    ajouter_milieu(px2, py2, wx2, wy2)
                    except Exception:
                        pass

            elif t in ("3DFACE", "SOLID"):
                for attr in ("vtx0", "vtx1", "vtx2", "vtx3"):
                    if entity.dxf.hasattr(attr):
                        v = getattr(entity.dxf, attr)
                        wx2, wy2 = appliquer_transform(v.x, v.y, ox, oy, sx, sy, cos_r, sin_r)
                        ajouter(wx2, wy2, "e")

            elif t == "WIPEOUT":
                try:
                    pts_w = list(entity.boundary_path)
                    for i, v in enumerate(pts_w):
                        wx2, wy2 = appliquer_transform(v[0], v[1], ox, oy, sx, sy, cos_r, sin_r)
                        ajouter(wx2, wy2, "e")
                        if i > 0:
                            prev = pts_w[i - 1]
                            px2, py2 = appliquer_transform(prev[0], prev[1], ox, oy, sx, sy, cos_r, sin_r)
                            ajouter_milieu(px2, py2, wx2, wy2)
                except Exception:
                    pass

            elif t == "DIMENSION":
                for attr in ("defpoint", "defpoint2", "defpoint3", "text_midpoint"):
                    if entity.dxf.hasattr(attr):
                        v = getattr(entity.dxf, attr)
                        wx, wy = appliquer_transform(v.x, v.y, ox, oy, sx, sy, cos_r, sin_r)
                        ajouter(wx, wy)
        except Exception:
            pass

    for entity in doc.modelspace():
        traiter(entity)

    return points


def _extraire_points_pdf(chemin: str) -> list:
    """
    Extrait les points d'accroche d'un PDF via PyMuPDF.
    Retourne une liste de [x, y] en coordonnées normalisées [0,1].
    """
    import fitz

    doc = fitz.open(chemin)
    page = doc[0]
    rect = page.rect
    w, h = rect.width, rect.height
    if w <= 0 or h <= 0:
        return []

    points: list = []

    def norm(px, py):
        nx, ny = px / w, py / h
        if 0 <= nx <= 1 and 0 <= ny <= 1:
            return [round(nx, 6), round(ny, 6)]
        return None

    def milieu(ax, ay, bx, by):
        return norm((ax + bx) / 2, (ay + by) / 2)

    def ap(p, typ="e"):
        if p:
            points.append([p[0], p[1], typ])

    def bezier_pts(p1, p2, p3, p4, n=4):
        """Subdivise une cubique de Bézier en n points intermédiaires."""
        res = []
        for i in range(1, n):
            t = i / n
            mt = 1 - t
            x = mt**3*p1.x + 3*mt**2*t*p2.x + 3*mt*t**2*p3.x + t**3*p4.x
            y = mt**3*p1.y + 3*mt**2*t*p2.y + 3*mt*t**2*p3.y + t**3*p4.y
            res.append((x, y))
        return res

    for path in page.get_drawings():
        for item in path.get("items", []):
            try:
                op = item[0]
                if op == "m":  # moveto — extrémité de sous-chemin
                    p1 = item[1]
                    ap(norm(p1.x, p1.y), "e")
                elif op == "l":  # segment
                    p1, p2 = item[1], item[2]
                    ap(norm(p1.x, p1.y), "e")
                    ap(norm(p2.x, p2.y), "e")
                    ap(milieu(p1.x, p1.y, p2.x, p2.y), "m")
                elif op == "re":  # rectangle
                    r = item[1]
                    corners = [(r.x0, r.y0), (r.x1, r.y0), (r.x1, r.y1), (r.x0, r.y1)]
                    for cx, cy in corners:
                        ap(norm(cx, cy), "e")
                    for i in range(4):
                        ax, ay = corners[i]
                        bx, by = corners[(i + 1) % 4]
                        ap(milieu(ax, ay, bx, by), "m")
                elif op == "c":  # cubique de Bézier
                    p1, p2, p3, p4 = item[1], item[2], item[3], item[4]
                    ap(norm(p1.x, p1.y), "e")
                    ap(norm(p4.x, p4.y), "e")
                    # Points intermédiaires sur la courbe
                    for bx, by in bezier_pts(p1, p2, p3, p4, 4):
                        ap(norm(bx, by), "m")
                elif op == "qu":  # arc quadrant
                    p1, p2 = item[1], item[2]
                    ap(norm(p1.x, p1.y), "q")
                    ap(norm(p2.x, p2.y), "q")
                    ap(milieu(p1.x, p1.y, p2.x, p2.y), "m")
            except Exception:
                pass

        # Centroïde des chemins fermés (utile pour les symboles)
        try:
            r = path.get("rect")
            if r and path.get("closePath"):
                ap(norm((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2), "c")
        except Exception:
            pass

    doc.close()
    return points


def _extraire_points_image(chemin: str) -> list:
    """
    Extrait les points d'accroche d'une image raster via deux méthodes complémentaires :
    1. Canny + findContours + approxPolyDP → coins exacts des contours (méthode principale)
    2. Shi-Tomasi goodFeaturesToTrack → coins non capturés par les contours
    Retourne une liste de [x, y, type] en coordonnées normalisées [0,1].
    """
    import cv2
    import numpy as np

    img = cv2.imread(chemin, cv2.IMREAD_GRAYSCALE)
    if img is None:
        return []

    h, w = img.shape
    if w <= 0 or h <= 0:
        return []

    # Réduction pour les très grandes images
    MAX_DIM = 2000
    facteur = min(MAX_DIM / max(w, h), 1.0)
    if facteur < 1.0:
        img = cv2.resize(img, (int(w * facteur), int(h * facteur)), interpolation=cv2.INTER_AREA)
    rh, rw = img.shape

    # Pré-traitement : CLAHE (contraste adaptatif par tuiles) + flou léger
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    img = clahe.apply(img)
    blurred = cv2.GaussianBlur(img, (3, 3), 0)

    points: list = []

    def ajouter_pt(px, py, typ="e"):
        nx, ny = px / rw, py / rh
        if 0 <= nx <= 1 and 0 <= ny <= 1:
            points.append([round(nx, 6), round(ny, 6), typ])

    # --- Méthode 1 : Canny + contours + approximation polygonale ---
    # Seuils Canny calculés depuis la médiane (robuste quelle que soit la plage de niveaux de gris)
    median = float(np.median(blurred))
    lo = max(0, int(median * 0.5))
    hi = min(255, int(median * 1.5))
    edges = cv2.Canny(blurred, lo, hi)

    # Légère dilatation pour fermer les gaps dans les traits fins
    edges = cv2.dilate(edges, np.ones((2, 2), np.uint8), iterations=1)

    contours, _ = cv2.findContours(edges, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    min_arc = max(8, int(min(rw, rh) * 0.005))  # ignore les micro-contours

    for cnt in contours:
        arc_len = cv2.arcLength(cnt, True)
        if arc_len < min_arc:
            continue
        # Tolérance d'approximation progressive : 0.5 % de la longueur, min 1.5 px
        epsilon = max(1.5, arc_len * 0.005)
        approx = cv2.approxPolyDP(cnt, epsilon, True)
        pts = approx.reshape(-1, 2)
        n = len(pts)
        for i, (px, py) in enumerate(pts):
            typ = "e" if n <= 8 else "m"  # sommet réel si peu de points, sinon milieu
            ajouter_pt(float(px), float(py), typ)
            if i > 0:
                prev = pts[i - 1]
                ajouter_pt((float(px) + float(prev[0])) / 2, (float(py) + float(prev[1])) / 2, "m")
        # Fermer la polyligne si nécessaire
        if n > 1 and cv2.contourArea(cnt) > 0:
            ajouter_pt((float(pts[-1][0]) + float(pts[0][0])) / 2,
                       (float(pts[-1][1]) + float(pts[0][1])) / 2, "m")

    # --- Méthode 2 : Shi-Tomasi pour coins fins non détectés par Canny ---
    shi = cv2.goodFeaturesToTrack(
        blurred,
        maxCorners=2000,
        qualityLevel=0.01,
        minDistance=max(6, int(min(rw, rh) * 0.004)),
        blockSize=5,
    )
    if shi is not None:
        for c in shi:
            ajouter_pt(float(c[0][0]), float(c[0][1]), "e")

    return points


def extraire_geometrie_fond_plan(fond_plan) -> dict:
    """
    Point d'entrée unique pour l'extraction des points d'accroche.
    Dispatche vers la méthode adaptée selon le format du fond de plan.
    Retourne {"points": [[x, y], ...], "format": str, "nb_points": int}.
    """
    import os
    import tempfile
    import logging

    logger = logging.getLogger(__name__)

    if not (fond_plan.fichier and fond_plan.fichier.name):
        return {"points": [], "format": "inconnu", "nb_points": 0}

    nom = fond_plan.fichier.name.lower()
    fmt = fond_plan.format_fichier or ""

    # Déterminer le format et l'extension de téléchargement
    if fmt == "dxf" or nom.endswith(".dxf"):
        suffix, extracteur = ".dxf", _extraire_points_dxf
    elif fmt == "pdf" or nom.endswith(".pdf"):
        suffix, extracteur = ".pdf", _extraire_points_pdf
    elif fmt == "image" or any(nom.endswith(e) for e in (".jpg", ".jpeg", ".png", ".tif", ".tiff", ".bmp")):
        suffix = os.path.splitext(nom)[1] or ".png"
        extracteur = _extraire_points_image
    else:
        return {"points": [], "format": fmt, "nb_points": 0}

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(fond_plan.fichier.read())
        chemin = tmp.name

    try:
        points_bruts = extracteur(chemin)
        points = _dedupliquer_points(points_bruts)
        logger.info("Accroche %s : %d points extraits pour %s", fmt or suffix, len(points), fond_plan.fichier.name)
        return {"points": points, "format": fmt or suffix, "nb_points": len(points)}
    except Exception:
        logger.error("Extraction accroche échouée pour %s", fond_plan.fichier.name, exc_info=True)
        return {"points": [], "format": fmt, "nb_points": 0}
    finally:
        os.unlink(chemin)


# Alias pour compatibilité avec la commande tester_rendu_dxf
def extraire_geometrie_dxf(fond_plan) -> dict:
    return extraire_geometrie_fond_plan(fond_plan)


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
        localisation=getattr(zone, "localisation", "") or "",
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
