"""Modèles de journalisation des courriels émis par la plateforme."""

import uuid

from django.db import models


class JournalCourriel(models.Model):
    """Trace un envoi de courriel applicatif ou webmail."""

    STATUTS = [
        ("succes", "Succès"),
        ("echec", "Échec"),
    ]
    ORIGINES = [
        ("plateforme", "Plateforme"),
        ("notification", "Notification"),
        ("invitation", "Invitation"),
        ("reinitialisation", "Réinitialisation"),
        ("contact", "Contact"),
        ("webmail", "Webmail"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    utilisateur = models.ForeignKey(
        "comptes.Utilisateur",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="journaux_courriels",
    )
    origine = models.CharField(max_length=32, choices=ORIGINES, default="plateforme")
    statut = models.CharField(max_length=16, choices=STATUTS)
    sujet = models.CharField(max_length=255)
    expediteur = models.EmailField()
    destinataires = models.JSONField(default=list, blank=True)
    copie = models.JSONField(default=list, blank=True)
    copie_cachee = models.JSONField(default=list, blank=True)
    message_id = models.CharField(max_length=255, blank=True)
    erreur = models.TextField(blank=True)
    contexte = models.JSONField(default=dict, blank=True)
    nombre_pieces_jointes = models.PositiveSmallIntegerField(default=0)
    date_envoi = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "messagerie_journal_courriel"
        verbose_name = "Journal de courriel"
        verbose_name_plural = "Journal des courriels"
        ordering = ["-date_envoi"]

    def __str__(self):
        return f"{self.get_origine_display()} - {self.sujet}"
