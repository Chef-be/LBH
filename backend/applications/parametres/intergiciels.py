"""
Intergiciel (middleware) de vérification des fonctionnalités activables.
Retourne une réponse 404 propre si un module est désactivé.
"""

import re
from django.http import JsonResponse


# Carte des préfixes d'URL vers les codes de fonctionnalité
PREFIXES_FONCTIONNALITES = {
    r"^/api/documents/": "GESTION_DOCUMENTAIRE",
    r"^/api/metres/": "METRES_QUANTITATIFS",
    r"^/api/economie/": "ECONOMIE_CONSTRUCTION",
    r"^/api/bibliotheque/": "BIBLIOTHEQUE_PRIX",
    r"^/api/voirie/": "DIMENSIONNEMENT_VOIRIE",
    r"^/api/batiment/": "PRESIZING_BATIMENT",
    r"^/api/pieces-ecrites/": "PIECES_ECRITES",
    r"^/api/appels-offres/": "APPELS_OFFRES",
    r"^/api/execution/": "SUIVI_EXECUTION",
    r"^/api/messagerie/": "MODULE_WEBMAIL",
    r"^/api/supervision/": "SUPERVISION",
}


class VerificationFonctionnaliteIntergiciel:
    """
    Vérifie que la fonctionnalité correspondant à la route demandée est active.
    Si elle est désactivée : retourne HTTP 404 avec un message explicite.
    Ne lève jamais d'exception — ne casse jamais les autres modules.
    """

    def __init__(self, obtenir_reponse):
        self.obtenir_reponse = obtenir_reponse

    def __call__(self, requete):
        code_fonctionnalite = self._trouver_fonctionnalite(requete.path)

        if code_fonctionnalite:
            try:
                from applications.parametres.models import FonctionnaliteActivable
                utilisateur = getattr(requete, "user", None)
                if not FonctionnaliteActivable.est_active_pour(
                    code=code_fonctionnalite,
                    utilisateur=utilisateur,
                    organisation=getattr(utilisateur, "organisation", None) if utilisateur else None,
                ):
                    return JsonResponse(
                        {
                            "detail": "Ce module est désactivé sur cette plateforme.",
                            "code": "module_desactive",
                        },
                        status=404,
                    )
            except Exception:
                # En cas d'erreur (BDD indisponible, etc.) : laisser passer
                pass

        return self.obtenir_reponse(requete)

    def _trouver_fonctionnalite(self, chemin: str):
        for pattern, code in PREFIXES_FONCTIONNALITES.items():
            if re.match(pattern, chemin):
                return code
        return None
