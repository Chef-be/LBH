from django.db.models.signals import post_delete, pre_save
from django.dispatch import receiver

from .models import ModeleDocument, PieceEcrite


def _supprimer_fichier(champ_fichier):
    if champ_fichier and getattr(champ_fichier, "name", ""):
        champ_fichier.delete(save=False)


@receiver(pre_save, sender=ModeleDocument)
def supprimer_ancien_gabarit_modele(sender, instance, **kwargs):
    if not instance.pk:
        return

    try:
        precedent = sender.objects.get(pk=instance.pk)
    except sender.DoesNotExist:
        return

    if precedent.gabarit and precedent.gabarit != instance.gabarit:
        _supprimer_fichier(precedent.gabarit)


@receiver(post_delete, sender=ModeleDocument)
def supprimer_gabarit_modele(sender, instance, **kwargs):
    _supprimer_fichier(instance.gabarit)


@receiver(pre_save, sender=PieceEcrite)
def supprimer_ancien_fichier_piece(sender, instance, **kwargs):
    if not instance.pk:
        return

    try:
        precedent = sender.objects.get(pk=instance.pk)
    except sender.DoesNotExist:
        return

    if precedent.fichier_genere and precedent.fichier_genere != instance.fichier_genere:
        _supprimer_fichier(precedent.fichier_genere)


@receiver(post_delete, sender=PieceEcrite)
def supprimer_fichier_piece(sender, instance, **kwargs):
    _supprimer_fichier(instance.fichier_genere)
