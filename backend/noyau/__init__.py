"""
Noyau de la Plateforme LBH.
Initialisation de l'application Celery pour la découverte automatique des tâches.
"""

# Importer l'application Celery au démarrage de Django
# pour que les décorateurs @shared_task fonctionnent correctement.
from configuration.celery import application_celery as celery_app

__all__ = ("celery_app",)
