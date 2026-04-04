"""
Commande de gestion : initialiser_site
Injecte les données initiales du site vitrine depuis un fichier JSON dédié.
Usage : python manage.py initialiser_site [--reinitialiser]
"""

import json
from pathlib import Path

from django.core.management.base import BaseCommand

from applications.site_public.models import (
    ConfigurationSite,
    EtapeDemarche,
    Prestation,
    StatistiqueSite,
    ValeurSite,
)


CHEMIN_DONNEES = (
    Path(__file__).resolve().parents[2]
    / "donnees_initiales"
    / "site_public_initial.json"
)


def charger_donnees_initiales() -> dict:
    with CHEMIN_DONNEES.open("r", encoding="utf-8") as fichier:
        return json.load(fichier)


class Command(BaseCommand):
    help = "Initialise les données du site vitrine depuis un fichier JSON versionné."

    def add_arguments(self, parser):
        parser.add_argument(
            "--reinitialiser",
            action="store_true",
            help="Supprime et recrée toutes les données existantes.",
        )

    def handle(self, *args, **options):
        reinitialiser = options["reinitialiser"]
        donnees = charger_donnees_initiales()

        self._initialiser_configuration(
            donnees.get("configuration", {}),
            reinitialiser=reinitialiser,
        )
        self._initialiser_prestations(
            donnees.get("prestations", []),
            reinitialiser=reinitialiser,
        )
        self._initialiser_statistiques(
            donnees.get("statistiques", []),
            reinitialiser=reinitialiser,
        )
        self._initialiser_valeurs(
            donnees.get("valeurs", []),
            reinitialiser=reinitialiser,
        )
        self._initialiser_demarche(
            donnees.get("demarche", []),
            reinitialiser=reinitialiser,
        )

        self.stdout.write(
            self.style.SUCCESS(
                "\nInitialisation du site vitrine terminée avec succès."
            )
        )

    def _initialiser_configuration(self, donnees: dict, reinitialiser: bool):
        configuration = ConfigurationSite.obtenir()
        champs_a_mettre_a_jour = {}

        for champ, valeur in donnees.items():
            valeur_actuelle = getattr(configuration, champ, None)
            if reinitialiser or not valeur_actuelle:
                champs_a_mettre_a_jour[champ] = valeur

        if champs_a_mettre_a_jour:
            for champ, valeur in champs_a_mettre_a_jour.items():
                setattr(configuration, champ, valeur)
            configuration.save(update_fields=list(champs_a_mettre_a_jour.keys()))

        self.stdout.write(f"  Configuration : {configuration}")

    def _initialiser_prestations(self, donnees: list[dict], reinitialiser: bool):
        if reinitialiser:
            Prestation.objects.all().delete()
            self.stdout.write("  Prestations existantes supprimées.")

        nb_creees = 0
        for data in donnees:
            prestation, creee = Prestation.objects.get_or_create(
                titre=data["titre"],
                defaults={k: v for k, v in data.items() if k != "titre"},
            )
            if not creee and not reinitialiser:
                updated = False
                for champ, valeur in data.items():
                    if champ == "titre":
                        continue
                    if getattr(prestation, champ, None) in ("", None, [], {}):
                        setattr(prestation, champ, valeur)
                        updated = True
                if updated:
                    prestation.save()
            if creee:
                nb_creees += 1

        self.stdout.write(
            self.style.SUCCESS(f"  {nb_creees} prestation(s) créée(s).")
        )

    def _initialiser_statistiques(self, donnees: list[dict], reinitialiser: bool):
        if reinitialiser:
            StatistiqueSite.objects.all().delete()

        nb_creees = 0
        for data in donnees:
            _, creee = StatistiqueSite.objects.get_or_create(
                libelle=data["libelle"],
                defaults=data,
            )
            if creee:
                nb_creees += 1

        self.stdout.write(
            self.style.SUCCESS(f"  {nb_creees} statistique(s) créée(s).")
        )

    def _initialiser_valeurs(self, donnees: list[dict], reinitialiser: bool):
        if reinitialiser:
            ValeurSite.objects.all().delete()

        nb_creees = 0
        for data in donnees:
            _, creee = ValeurSite.objects.get_or_create(
                titre=data["titre"],
                defaults=data,
            )
            if creee:
                nb_creees += 1

        self.stdout.write(
            self.style.SUCCESS(f"  {nb_creees} valeur(s) créée(s).")
        )

    def _initialiser_demarche(self, donnees: list[dict], reinitialiser: bool):
        if reinitialiser:
            EtapeDemarche.objects.all().delete()

        nb_creees = 0
        for data in donnees:
            _, creee = EtapeDemarche.objects.get_or_create(
                numero=data["numero"],
                defaults=data,
            )
            if creee:
                nb_creees += 1

        self.stdout.write(
            self.style.SUCCESS(f"  {nb_creees} étape(s) de démarche créée(s).")
        )
