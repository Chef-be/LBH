"""
Enrichit la bibliothèque d'articles CCTP depuis les prescriptions existantes.

Pour chaque PrescriptionCCTP de la base, crée un ArticleCCTP en bibliothèque
si un article identique n'existe pas déjà.

Exécution :
    docker compose exec lbh-backend python manage.py enrichir_bibliotheque_cctp
    Ajouter --reinitialiser pour recréer tous les articles depuis les prescriptions.
"""

from django.core.management.base import BaseCommand
from django.db import transaction


TEMPLATE_CORPS = """<p>{contenu}</p>

<p><strong>Normes et références applicables :</strong></p>
<ul>{normes}</ul>

<p><strong>Niveau d'exigence :</strong> {niveau}</p>"""


def _construire_corps(prescription) -> str:
    """Génère le corps HTML d'un article depuis une prescription."""
    normes = "".join(
        f"<li>{norme}</li>"
        for norme in (prescription.normes or [])
    )
    return TEMPLATE_CORPS.format(
        contenu=prescription.corps or "",
        normes=normes or "<li>—</li>",
        niveau=prescription.get_niveau_display(),
    )


def _numero_article(prescription) -> str:
    """Calcule le numéro d'article Widloecher & Cusant : II.{chap}.{ordre}"""
    chapitre = prescription.chapitre
    if chapitre:
        return f"II.{chapitre.numero}.{prescription.ordre}"
    return f"II.{prescription.ordre}"


class Command(BaseCommand):
    help = "Enrichit la bibliothèque d'articles CCTP depuis les prescriptions existantes."

    def add_arguments(self, parser):
        parser.add_argument(
            "--reinitialiser",
            action="store_true",
            help="Supprime les articles issus de prescriptions avant de recréer.",
        )
        parser.add_argument(
            "--lot",
            type=str,
            default=None,
            help="Code du lot CCTP à traiter (ex: GO). Par défaut : tous les lots.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        from applications.pieces_ecrites.models import PrescriptionCCTP, ArticleCCTP

        filtre_lot = options.get("lot")
        qs = PrescriptionCCTP.objects.select_related("lot", "chapitre").order_by(
            "lot__ordre", "lot__code", "chapitre__ordre", "ordre"
        )
        if filtre_lot:
            qs = qs.filter(lot__code=filtre_lot.upper())

        if options["reinitialiser"]:
            nb_supprimes = ArticleCCTP.objects.filter(
                est_dans_bibliotheque=True,
                tags__contains=["depuis-prescription"],
            ).delete()[0]
            self.stdout.write(f"  {nb_supprimes} article(s) supprimé(s) avant rechargement.")

        prescriptions = list(qs)
        nb_crees = 0
        nb_ignores = 0

        for prescription in prescriptions:
            intitule = prescription.intitule[:300]
            lot = prescription.lot
            numero = _numero_article(prescription)

            if not options["reinitialiser"] and ArticleCCTP.objects.filter(
                intitule__iexact=intitule,
                lot=lot,
                est_dans_bibliotheque=True,
            ).exists():
                nb_ignores += 1
                continue

            corps = _construire_corps(prescription)
            ArticleCCTP.objects.create(
                piece_ecrite=None,
                lot=lot,
                chapitre=prescription.chapitre.intitule if prescription.chapitre else "",
                numero_article=numero,
                intitule=intitule,
                corps_article=corps,
                source="Prescriptions CCTP — Widloecher & Cusant 3e éd.",
                est_dans_bibliotheque=True,
                normes_applicables=prescription.normes or [],
                tags=["depuis-prescription", lot.code if lot else "non-classe"],
            )
            nb_crees += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Enrichissement terminé : {nb_crees} article(s) créé(s), "
                f"{nb_ignores} ignoré(s) (doublon)."
            )
        )
