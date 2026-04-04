"""
Commande de gestion : ingerer_ressources
Aligne l'interface Django avec le script d'analyse des ressources serveur.
"""

from pathlib import Path
import subprocess
import sys

from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = "Lance l'ingestion, l'analyse ou le résumé des ressources documentaires."

    def add_arguments(self, parser):
        parser.add_argument(
            "--mode",
            choices=["ingestion", "analyse", "resume"],
            default="ingestion",
            help="Mode d'exécution du script ressources.",
        )

    def handle(self, *args, **options):
        racine_projet = Path(__file__).resolve().parents[5]
        script = racine_projet / "scripts" / "analyser-ressources.py"
        mode = options["mode"]

        if not script.exists():
            raise CommandError(f"Script introuvable : {script}")

        resultat = subprocess.run(
            [sys.executable, str(script), "--mode", mode],
            cwd=racine_projet,
            capture_output=True,
            text=True,
            check=False,
        )

        if resultat.stdout:
            self.stdout.write(resultat.stdout.rstrip())

        if resultat.returncode != 0:
            if resultat.stderr:
                self.stderr.write(resultat.stderr.rstrip())
            raise CommandError(
                f"L'ingestion des ressources a échoué (code {resultat.returncode})."
            )

        if resultat.stderr:
            self.stderr.write(resultat.stderr.rstrip())
