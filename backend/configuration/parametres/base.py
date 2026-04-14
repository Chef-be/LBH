"""
Paramètres de base Django — Plateforme LBH
Commun à tous les environnements.
Aucune valeur sensible ici — tout passe par les variables d'environnement.
"""

import os
from pathlib import Path
from decouple import config, Csv

# Répertoire de base du backend
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# ============================================================
# IDENTITÉ DE LA PLATEFORME
# (valeurs par défaut remplacées par le super-admin via l'interface)
# ============================================================
NOM_PLATEFORME = config("NOM_PLATEFORME", default="LBH Economiste")
PREFIXE_CONTENEURS = config("PREFIXE_CONTENEURS", default="lbh")
PREFIXE_CONTENEURS_SQL = PREFIXE_CONTENEURS.replace("-", "_") or "lbh"
URL_BASE = config("URL_BASE", default="")
COLLABORA_PUBLIC_URL = config("COLLABORA_PUBLIC_URL", default="https://lbh-economiste.com/collabora")
COLLABORA_URL = config("COLLABORA_URL", default="http://lbh-collabora:9980")
# URL de base utilisée pour construire les WOPISrc que Collabora rappelle.
# Doit être joignable depuis le conteneur lbh-collabora (URL interne backend ou publique).
WOPI_BASE_URL = config("WOPI_BASE_URL", default="http://lbh-backend:8000")
WOPI_SECRET = config("WOPI_SECRET", default="")

# ============================================================
# SÉCURITÉ
# ============================================================
SECRET_KEY = config("SECRET_DJANGO")
DEBUG = config("DEBUG", default=False, cast=bool)

ALLOWED_HOSTS = config("DOMAINES_AUTORISES", default="localhost", cast=Csv())
ALLOWED_HOSTS += [
    "127.0.0.1",
    "0.0.0.0",
    f"{PREFIXE_CONTENEURS}-backend",
    f"{PREFIXE_CONTENEURS}-frontend",
    f"{PREFIXE_CONTENEURS}-nginx",
]
ALLOWED_HOSTS = list(dict.fromkeys(hote for hote in ALLOWED_HOSTS if hote))

# Paramètres de sécurité en production
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "SAMEORIGIN"

# ============================================================
# APPLICATIONS INSTALLÉES
# ============================================================
INSTALLED_APPS = [
    # Django
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.gis",
    # Tiers
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "django_filters",
    "django_celery_beat",
    "django_celery_results",
    "health_check",
    # Applications métier
    "applications.comptes",
    "applications.organisations",
    "applications.projets",
    "applications.documents",
    "applications.metres",
    "applications.economie",
    "applications.bibliotheque",
    "applications.rentabilite",
    "applications.pieces_ecrites",
    "applications.appels_offres",
    "applications.execution",
    "applications.voirie",
    "applications.batiment",
    "applications.parametres",
    "applications.messagerie",
    "applications.supervision",
    "applications.site_public",
    "applications.ressources",
]

# ============================================================
# INTERGICIELS (MIDDLEWARES)
# ============================================================
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    # Fonctionnalités activables — vérifie si le module est actif
    "applications.parametres.intergiciels.VerificationFonctionnaliteIntergiciel",
]

ROOT_URLCONF = "noyau.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "gabarits"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
                # Contexte plateforme (nom, couleurs, logo)
                "applications.parametres.contextes.contexte_plateforme",
            ],
        },
    },
]

WSGI_APPLICATION = "noyau.wsgi.application"
ASGI_APPLICATION = "noyau.asgi.application"

# ============================================================
# BASE DE DONNÉES
# ============================================================
DATABASES = {
    "default": {
        "ENGINE": "django.contrib.gis.db.backends.postgis",
        "NAME": config("BDD_NOM", default=f"plateforme_{PREFIXE_CONTENEURS_SQL}"),
        "USER": config("BDD_UTILISATEUR", default=f"{PREFIXE_CONTENEURS_SQL}_appli"),
        "PASSWORD": config("BDD_MOT_DE_PASSE"),
        "HOST": config("BDD_HOTE", default="localhost"),
        "PORT": config("BDD_PORT", default="5432"),
        "OPTIONS": {
            "options": "-c search_path=public",
        },
        "CONN_MAX_AGE": 60,
    }
}

# ============================================================
# CACHE — Redis
# ============================================================
REDIS_URL = config("URL_REDIS", default="redis://localhost:6379")
REDIS_BD_CACHE = config("REDIS_BD_CACHE", default="0")
REDIS_BD_SESSION = config("REDIS_BD_SESSION", default="2")

CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": f"{REDIS_URL}/{REDIS_BD_CACHE}",
        "TIMEOUT": 3600,
    }
}

SESSION_ENGINE = "django.contrib.sessions.backends.cache"
SESSION_CACHE_ALIAS = "default"

# ============================================================
# CELERY — Traitements asynchrones
# ============================================================
CELERY_BROKER_URL = config("CELERY_COURTIER", default=f"{REDIS_URL}/1")
CELERY_RESULT_BACKEND = config("CELERY_RESULTATS", default=f"{REDIS_URL}/1")
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = config("FUSEAU_HORAIRE", default="Europe/Paris")
CELERY_TASK_TRACK_STARTED = True
CELERY_TASK_TIME_LIMIT = config("CELERY_DELAI_TACHE_MAX", default=3600, cast=int)
CELERY_TASK_MAX_RETRIES = config("CELERY_TENTATIVES_MAX", default=3, cast=int)

# Files Celery
CELERY_TASK_ROUTES = {
    "applications.documents.taches.*": {"queue": "documents"},
    "applications.economie.taches.*": {"queue": "calculs"},
    "applications.pieces_ecrites.taches.*": {"queue": "documents"},
    "applications.parametres.taches.*": {"queue": "principale"},
    "bibliotheque.*": {"queue": "calculs"},
    "applications.ressources.taches.*": {"queue": "documents"},
}

# ============================================================
# STOCKAGE OBJET — MinIO (compatible S3)
# ============================================================
DEFAULT_FILE_STORAGE = "storages.backends.s3boto3.S3Boto3Storage"
STATICFILES_STORAGE = "django.contrib.staticfiles.storage.StaticFilesStorage"

# Django 4.2+ — STORAGES prend la priorité sur DEFAULT_FILE_STORAGE
STORAGES = {
    "default": {
        "BACKEND": "storages.backends.s3boto3.S3Boto3Storage",
    },
    "staticfiles": {
        "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
    },
}

AWS_ACCESS_KEY_ID = config("MINIO_ACCES_CLE", default="")
AWS_SECRET_ACCESS_KEY = config("MINIO_SECRET_CLE", default="")
AWS_STORAGE_BUCKET_NAME = config("MINIO_CORBEILLE_DOCUMENTS", default="documents")
AWS_S3_ENDPOINT_URL = f"http://{config('MINIO_ENDPOINT', default='localhost:9000')}"
AWS_S3_USE_SSL = config("MINIO_SSL", default=False, cast=bool)
AWS_DEFAULT_ACL = "private"
AWS_QUERYSTRING_AUTH = True
AWS_QUERYSTRING_EXPIRE = 3600
AWS_S3_FILE_OVERWRITE = False

MINIO_TAILLE_MAX_IMPORT = config("MINIO_TAILLE_MAX_IMPORT", default=104857600, cast=int)
DATA_UPLOAD_MAX_MEMORY_SIZE = MINIO_TAILLE_MAX_IMPORT
FILE_UPLOAD_MAX_MEMORY_SIZE = MINIO_TAILLE_MAX_IMPORT

# ============================================================
# MODÈLE UTILISATEUR PERSONNALISÉ
# ============================================================
AUTH_USER_MODEL = "comptes.Utilisateur"

# ============================================================
# API REST
# ============================================================
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 50,
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
    ],
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": "100/day",
        "user": "2000/day",
    },
    "EXCEPTION_HANDLER": "applications.comptes.gestion_erreurs.gestionnaire_erreurs_api",
}

# ============================================================
# JWT — Jetons d'authentification
# ============================================================
from datetime import timedelta

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(hours=1),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "ALGORITHM": "HS256",
    "SIGNING_KEY": SECRET_KEY,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
}

# ============================================================
# CORS
# ============================================================
CORS_ALLOWED_ORIGINS = config("CORS_ORIGINES_AUTORISEES", default="http://localhost:3000", cast=Csv())
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_HEADERS = [
    "accept", "accept-encoding", "authorization", "content-type",
    "dnt", "origin", "user-agent", "x-csrftoken", "x-requested-with",
]

# ============================================================
# COURRIEL
# ============================================================
EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
EMAIL_HOST = config("COURRIEL_HOTE_SMTP", default="localhost")
EMAIL_PORT = config("COURRIEL_PORT_SMTP", default=587, cast=int)
EMAIL_USE_TLS = config("COURRIEL_TLS", default=True, cast=bool)
EMAIL_USE_SSL = config("COURRIEL_SSL", default=False, cast=bool)
EMAIL_HOST_USER = config("COURRIEL_UTILISATEUR", default="")
EMAIL_HOST_PASSWORD = config("COURRIEL_MOT_DE_PASSE", default="")
DEFAULT_FROM_EMAIL = config("COURRIEL_EXPEDITEUR_PAR_DEFAUT", default="")
SERVER_EMAIL = config("COURRIEL_ADMINISTRATEUR", default="")
COURRIEL_HOTE_IMAP = config("COURRIEL_HOTE_IMAP", default=EMAIL_HOST)
COURRIEL_PORT_IMAP = config("COURRIEL_PORT_IMAP", default=993, cast=int)
COURRIEL_IMAP_SSL = config("COURRIEL_IMAP_SSL", default=True, cast=bool)
COURRIEL_IMAP_STARTTLS = config("COURRIEL_IMAP_STARTTLS", default=False, cast=bool)
COURRIEL_IMAP_VERIFIER_CERTIFICAT = config("COURRIEL_IMAP_VERIFIER_CERTIFICAT", default=True, cast=bool)
COURRIEL_DELAI_CONNEXION = config("COURRIEL_DELAI_CONNEXION", default=15, cast=int)
COURRIEL_DOSSIER_ENVOYES = config("COURRIEL_DOSSIER_ENVOYES", default="Sent")
COURRIEL_DOSSIER_BROUILLONS = config("COURRIEL_DOSSIER_BROUILLONS", default="Drafts")
COURRIEL_DOSSIER_ARCHIVES = config("COURRIEL_DOSSIER_ARCHIVES", default="Archive")
COURRIEL_DOSSIER_INDESIRABLES = config("COURRIEL_DOSSIER_INDESIRABLES", default="Spam")
COURRIEL_DOSSIER_CORBEILLE = config("COURRIEL_DOSSIER_CORBEILLE", default="Trash")

# ============================================================
# INTERNATIONALISATION
# ============================================================
LANGUAGE_CODE = "fr-FR"
TIME_ZONE = config("FUSEAU_HORAIRE", default="Europe/Paris")
USE_I18N = True
USE_L10N = True
USE_TZ = True

# ============================================================
# FICHIERS STATIQUES ET MÉDIAS
# ============================================================
STATIC_URL = "/statiques/"
STATIC_ROOT = BASE_DIR / "statiques"
MEDIA_URL = "/medias/"
MEDIA_ROOT = BASE_DIR / "medias"

# ============================================================
# CLÉ PRIMAIRE PAR DÉFAUT
# ============================================================
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ============================================================
# JOURNALISATION
# ============================================================
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "[{levelname}] {asctime} {module} {process:d} {thread:d} {message}",
            "style": "{",
        },
        "simple": {
            "format": "[{levelname}] {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose",
        },
        "fichier": {
            "class": "logging.handlers.RotatingFileHandler",
            "filename": "/var/log/app/backend/application.log",
            "maxBytes": 10 * 1024 * 1024,
            "backupCount": 5,
            "formatter": "verbose",
            "delay": True,
        },
    },
    "root": {
        "handlers": ["console"],
        "level": config("JOURNALISATION_NIVEAU", default="INFO"),
    },
    "loggers": {
        "django": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
        "applications": {
            "handlers": ["console"],
            "level": "DEBUG",
            "propagate": False,
        },
        "celery": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
    },
}

# ============================================================
# ADMINISTRATION DJANGO
# Renommée pour éviter l'URL par défaut /admin/
# ============================================================
ADMIN_URL = config("ADMIN_URL", default="administration-technique/")

# ============================================================
# SANTÉ DE L'APPLICATION
# ============================================================
HEALTH_CHECK = {
    "DISK_USAGE_MAX": 90,  # %
    "MEMORY_MIN": 100,     # Mo
}
