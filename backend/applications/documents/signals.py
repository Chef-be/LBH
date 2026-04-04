from django.db.models.signals import post_delete, pre_save
from django.dispatch import receiver

from .models import Document


def _supprimer_fichier(champ_fichier):
    if champ_fichier and getattr(champ_fichier, "name", ""):
        champ_fichier.delete(save=False)


@receiver(pre_save, sender=Document)
def supprimer_ancien_fichier_document(sender, instance, **kwargs):
    if not instance.pk:
        return

    try:
        precedent = sender.objects.get(pk=instance.pk)
    except sender.DoesNotExist:
        return

    if precedent.fichier and precedent.fichier != instance.fichier:
        _supprimer_fichier(precedent.fichier)


@receiver(post_delete, sender=Document)
def supprimer_fichier_document(sender, instance, **kwargs):
    _supprimer_fichier(instance.fichier)
