from django.core.management.base import BaseCommand

from applications.bibliotheque.services import importer_bordereaux_prix_references


class Command(BaseCommand):
    help = "Importe les bordereaux de prix de référence présents dans le partage documentaire métier."

    def handle(self, *args, **options):
        resultat = importer_bordereaux_prix_references()
        self.stdout.write(
            self.style.SUCCESS(
                "Import terminé — "
                f"{resultat['creees']} créées, "
                f"{resultat['mises_a_jour']} mises à jour, "
                f"{resultat['lignes']} lignes analysées."
            )
        )
