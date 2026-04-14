"""
Configuration Celery — Plateforme LBH.
File d'attente de tâches asynchrones pour le traitement documentaire,
les calculs différés et l'envoi de courriels.
"""

import os

from celery import Celery
from celery.schedules import crontab
from django.conf import settings

# Variable d'environnement indiquant le module de paramètres Django
os.environ.setdefault(
    "DJANGO_SETTINGS_MODULE",
    "configuration.parametres.developpement",
)

application_celery = Celery("plateforme_lbh")

# Lecture de la configuration depuis les paramètres Django (préfixe CELERY_)
application_celery.config_from_object("django.conf:settings", namespace="CELERY")

# Découverte automatique des tâches dans toutes les applications Django installées
# Le projet utilise "taches" au lieu du nom par défaut "tasks"
application_celery.autodiscover_tasks(lambda: settings.INSTALLED_APPS, related_name="taches")


# ---------------------------------------------------------------------------
# Tâches périodiques (beat)
# ---------------------------------------------------------------------------

application_celery.conf.beat_schedule = {
    # Purge des jetons JWT révoqués — chaque nuit à 02h00
    "purger-jetons-expires": {
        "task": "applications.comptes.taches.purger_jetons_expires",
        "schedule": crontab(hour=2, minute=0),
    },
    # Vérification de la santé des services — toutes les 5 minutes
    "verifier-sante-services": {
        "task": "applications.supervision.taches.verifier_sante",
        "schedule": crontab(minute="*/5"),
    },
    # Nettoyage des fichiers temporaires d'OCR — chaque jour à 03h30
    "nettoyer-fichiers-temporaires-ocr": {
        "task": "applications.documents.taches.nettoyer_fichiers_temporaires",
        "schedule": crontab(hour=3, minute=30),
    },
    # Recalcul des indicateurs de projets — chaque jour à 01h00
    "recalculer-indicateurs-projets": {
        "task": "applications.projets.taches.recalculer_indicateurs",
        "schedule": crontab(hour=1, minute=0),
    },
    # Liaison automatique lignes de prix ↔ articles CCTP — chaque jour à 03h30
    "lier-auto-prix-articles": {
        "task": "bibliotheque.lier_auto_prix_articles",
        "schedule": crontab(hour=3, minute=30),
    },
    # Récupération automatique des indices INSEE — chaque lundi à 07h00
    "recuperer-indices-insee": {
        "task": "applications.ressources.taches.tache_recuperer_indices_insee",
        "schedule": crontab(hour=7, minute=0, day_of_week=1),
    },
    # Actualisation des prix marché avec les indices courants — chaque mois le 1er à 06h00
    "actualiser-indices-revision-prix": {
        "task": "applications.ressources.taches.tache_actualiser_indices",
        "schedule": crontab(hour=6, minute=0, day_of_month=1),
    },
    # Suppression des devis et estimations expirés — chaque jour à 04h00
    "supprimer-devis-expires": {
        "task": "applications.ressources.taches.tache_supprimer_devis_expires",
        "schedule": crontab(hour=4, minute=0),
    },
}

application_celery.conf.timezone = "Europe/Paris"


@application_celery.task(bind=True, ignore_result=True)
def tache_debogage(self):
    """Tâche de débogage — vérifie que Celery répond correctement."""
    print(f"Tâche de débogage exécutée — identifiant : {self.request.id}")
