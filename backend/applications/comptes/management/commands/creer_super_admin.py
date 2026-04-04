"""
Commande de gestion : créer_super_admin
Crée le premier super-administrateur de la plateforme interactivement.
Usage : python manage.py creer_super_admin
"""

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction


class Command(BaseCommand):
    help = "Crée le premier super-administrateur de la plateforme."

    def add_arguments(self, parser):
        parser.add_argument("--courriel", type=str, help="Adresse de courriel")
        parser.add_argument("--prenom", type=str, help="Prénom")
        parser.add_argument("--nom", type=str, help="Nom")
        parser.add_argument("--mot-de-passe", type=str, help="Mot de passe (déconseillé en CLI)")

    def handle(self, *args, **options):
        from applications.comptes.models import Utilisateur

        self.stdout.write(self.style.SUCCESS("=== Création du super-administrateur ==="))

        courriel = options.get("courriel") or self._demander("Adresse de courriel : ")
        prenom = options.get("prenom") or self._demander("Prénom : ")
        nom = options.get("nom") or self._demander("Nom : ")

        if options.get("mot_de_passe"):
            mot_de_passe = options["mot_de_passe"]
        else:
            import getpass
            mot_de_passe = getpass.getpass("Mot de passe (min. 12 caractères) : ")
            confirmation = getpass.getpass("Confirmer le mot de passe : ")
            if mot_de_passe != confirmation:
                raise CommandError("Les mots de passe ne correspondent pas.")

        if len(mot_de_passe) < 12:
            raise CommandError("Le mot de passe doit comporter au moins 12 caractères.")

        if Utilisateur.objects.filter(courriel=courriel).exists():
            raise CommandError(f"Un utilisateur avec l'adresse {courriel} existe déjà.")

        with transaction.atomic():
            utilisateur = Utilisateur.objects.create_superuser(
                courriel=courriel,
                password=mot_de_passe,
                prenom=prenom,
                nom=nom,
            )

        self.stdout.write(
            self.style.SUCCESS(
                f"\nSuper-administrateur créé avec succès :\n"
                f"  Courriel : {utilisateur.courriel}\n"
                f"  Nom      : {utilisateur.nom_complet}\n"
                f"  UUID     : {utilisateur.id}\n"
            )
        )

    def _demander(self, prompt: str) -> str:
        valeur = input(prompt).strip()
        if not valeur:
            raise CommandError("Ce champ est obligatoire.")
        return valeur
