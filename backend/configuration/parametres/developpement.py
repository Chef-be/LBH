"""
Paramètres Django — Environnement développement.
"""
from .base import *  # noqa

DEBUG = True

# Stockage local en développement (pas de MinIO requis)
DEFAULT_FILE_STORAGE = "django.core.files.storage.FileSystemStorage"
STATICFILES_STORAGE = "django.contrib.staticfiles.storage.StaticFilesStorage"

# CORS permissif en développement
CORS_ALLOW_ALL_ORIGINS = True

# Courriel dans la console en développement
EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

# Base de données sans PostGIS hors-Docker (GDAL non disponible sur l'hôte)
# En conteneur Docker, PostGIS est disponible — la base.py s'applique intégralement.
import os as _os
if not _os.environ.get("DANS_CONTENEUR"):
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": _os.environ.get("BDD_NOM", f"plateforme_{PREFIXE_CONTENEURS_SQL}"),
            "USER": _os.environ.get("BDD_UTILISATEUR", f"{PREFIXE_CONTENEURS_SQL}_appli"),
            "PASSWORD": _os.environ.get("BDD_MOT_DE_PASSE", ""),
            "HOST": _os.environ.get("BDD_HOTE", "localhost"),
            "PORT": _os.environ.get("BDD_PORT", "5432"),
        }
    }
    INSTALLED_APPS = [a for a in INSTALLED_APPS if a != "django.contrib.gis"]  # noqa

# Journalisation console uniquement en développement (pas de fichier)
LOGGING["handlers"]["fichier"]["class"] = "logging.StreamHandler"  # noqa
LOGGING["handlers"]["fichier"].pop("filename", None)  # noqa
LOGGING["handlers"]["fichier"].pop("maxBytes", None)  # noqa
LOGGING["handlers"]["fichier"].pop("backupCount", None)  # noqa
LOGGING["handlers"]["fichier"].pop("delay", None)  # noqa

# Barre de débogage Django (optionnel)
# INSTALLED_APPS += ["debug_toolbar"]
