"""
Paramètres Django — Environnement recette (staging).
"""
from .production import *  # noqa

# En recette, l'expéditeur reste piloté par l'environnement
DEFAULT_FROM_EMAIL = config("COURRIEL_EXPEDITEUR_PAR_DEFAUT", default="")  # noqa
