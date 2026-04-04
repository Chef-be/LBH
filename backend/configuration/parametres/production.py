"""
Paramètres Django — Environnement production.
"""
from .base import *  # noqa

DEBUG = False

# Sécurité renforcée en production
SECURE_SSL_REDIRECT = False  # Géré par Plesk/Nginx
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True

# Journalisation en production — vers fichier
LOGGING["handlers"]["fichier"]["class"] = "logging.handlers.RotatingFileHandler"
try:
    LOGGING["loggers"]["applications"]["handlers"] = ["console", "fichier"]
    LOGGING["loggers"]["django"]["handlers"] = ["console", "fichier"]
except Exception:
    pass
