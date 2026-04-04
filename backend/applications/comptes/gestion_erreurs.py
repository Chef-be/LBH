"""
Gestionnaire d'erreurs API personnalisé — Plateforme LBH.
Retourne des messages d'erreur en français avec un format homogène.
"""

import logging
from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status

journal = logging.getLogger("applications.comptes")


def gestionnaire_erreurs_api(exc, context):
    """
    Gestionnaire d'exceptions DRF personnalisé.
    Adapte les messages d'erreur en français et normalise le format de réponse.
    """
    reponse = exception_handler(exc, context)

    if reponse is not None:
        # Normalisation du format : {detail, code, errors}
        donnees = reponse.data

        if isinstance(donnees, dict):
            if "detail" not in donnees and "non_field_errors" not in donnees:
                # Erreurs de validation par champ — les conserver telles quelles
                pass
            elif "detail" in donnees:
                # Traduire les messages DRF courants
                message = str(donnees["detail"])
                donnees["detail"] = _traduire_message(message)

        reponse.data = donnees

    return reponse


def _traduire_message(message: str) -> str:
    """Traduit les messages d'erreur DRF courants en français."""
    traductions = {
        "Authentication credentials were not provided.": "Authentification requise. Veuillez vous connecter.",
        "Given token not valid for any token type": "Jeton d'authentification invalide ou expiré.",
        "Token is invalid or expired": "Jeton d'authentification invalide ou expiré.",
        "No active account found with the given credentials": "Identifiants incorrects.",
        "You do not have permission to perform this action.": "Vous n'avez pas les droits nécessaires pour effectuer cette action.",
        "Not found.": "Ressource introuvable.",
        "Method Not Allowed": "Méthode HTTP non autorisée.",
        "Throttled.": "Trop de requêtes. Veuillez patienter avant de réessayer.",
    }
    return traductions.get(message, message)
