"""
Commande de test préventif : vérifie que le rendu DXF fonctionne correctement.
Usage : docker compose exec lbh-backend python manage.py tester_rendu_dxf
"""

import sys
from django.core.management.base import BaseCommand


PLACEHOLDER_SEUIL_OCTETS = 5_000  # Le placeholder fait ~2 Ko, un vrai rendu > 5 Ko


def _creer_dxf_minimal_bytes() -> bytes:
    """Crée un DXF minimal en mémoire avec des lignes, texte et arcs."""
    import ezdxf
    import tempfile, os

    doc = ezdxf.new("R2010")
    msp = doc.modelspace()
    msp.add_line((0, 0), (100, 0))
    msp.add_line((100, 0), (100, 60))
    msp.add_line((100, 60), (0, 60))
    msp.add_line((0, 60), (0, 0))
    msp.add_line((0, 0), (100, 60))
    msp.add_arc(center=(50, 30), radius=20, start_angle=0, end_angle=180)
    msp.add_text("Test LBH", dxfattribs={"height": 5, "insert": (10, 10)})
    doc.header["$EXTMIN"] = (0, 0, 0)
    doc.header["$EXTMAX"] = (100, 60, 0)

    with tempfile.NamedTemporaryFile(suffix=".dxf", delete=False) as tmp:
        chemin = tmp.name
    doc.saveas(chemin)
    with open(chemin, "rb") as f:
        data = f.read()
    os.unlink(chemin)
    return data


class Command(BaseCommand):
    help = "Vérifie que le pipeline de rendu DXF → PNG est opérationnel."

    def handle(self, *args, **options):
        import tempfile
        import os
        from applications.metres.services import convertir_dxf_en_png, extraire_geometrie_fond_plan

        erreurs = []
        ok_count = 0

        # --- Test 1 : rendu aperçu ---
        self.stdout.write("Test 1 : rendu aperçu (1200×850 px)…")
        try:
            dxf_bytes = _creer_dxf_minimal_bytes()
            with tempfile.NamedTemporaryFile(suffix=".dxf", delete=False) as tmp:
                tmp.write(dxf_bytes)
                chemin = tmp.name
            png = convertir_dxf_en_png(chemin, largeur_px=1200, hauteur_px=850)
            os.unlink(chemin)
            if len(png) < PLACEHOLDER_SEUIL_OCTETS:
                erreurs.append(f"Aperçu trop petit ({len(png)} o) — probable placeholder généré.")
            else:
                self.stdout.write(self.style.SUCCESS(f"  OK — {len(png):,} octets"))
                ok_count += 1
        except Exception as exc:
            erreurs.append(f"Rendu aperçu : {exc}")

        # --- Test 2 : rendu HD ---
        self.stdout.write("Test 2 : rendu HD (2480×1754 px)…")
        try:
            dxf_bytes = _creer_dxf_minimal_bytes()
            with tempfile.NamedTemporaryFile(suffix=".dxf", delete=False) as tmp:
                tmp.write(dxf_bytes)
                chemin = tmp.name
            png = convertir_dxf_en_png(chemin, largeur_px=2480, hauteur_px=1754)
            os.unlink(chemin)
            if len(png) < PLACEHOLDER_SEUIL_OCTETS:
                erreurs.append(f"HD trop petit ({len(png)} o) — probable placeholder généré.")
            else:
                self.stdout.write(self.style.SUCCESS(f"  OK — {len(png):,} octets"))
                ok_count += 1
        except Exception as exc:
            erreurs.append(f"Rendu HD : {exc}")

        # --- Test 3 : extraction géométrie sur les FondPlan DXF existants ---
        self.stdout.write("Test 3 : extraction géométrie sur les fonds de plan existants…")
        try:
            from applications.metres.models import FondPlan

            fps = FondPlan.objects.filter(format_fichier="dxf")
            if not fps.exists():
                self.stdout.write("  (aucun fond de plan DXF en base — test ignoré)")
                ok_count += 1
            else:
                for fp in fps[:3]:
                    geo = extraire_geometrie_fond_plan(fp)
                    n = len(geo.get("points", []))
                    self.stdout.write(self.style.SUCCESS(f"  OK — {fp.fichier.name[:60]} → {n} points"))
                ok_count += 1
        except Exception as exc:
            erreurs.append(f"Extraction géométrie : {exc}")

        # --- Résumé ---
        self.stdout.write("")
        if erreurs:
            self.stdout.write(self.style.ERROR(f"ÉCHEC — {len(erreurs)} erreur(s) :"))
            for e in erreurs:
                self.stdout.write(self.style.ERROR(f"  • {e}"))
            sys.exit(1)
        else:
            self.stdout.write(self.style.SUCCESS(f"Tous les tests passent ({ok_count}/3). Pipeline DXF opérationnel."))
