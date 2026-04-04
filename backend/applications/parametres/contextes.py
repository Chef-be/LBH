"""
Contexte de gabarit global — Plateforme LBH.
Injecte le nom, le logo et les paramètres de la plateforme dans tous les gabarits Django.
"""

import logging
from django.conf import settings

journal = logging.getLogger("applications.parametres")


def contexte_plateforme(requete):
    """
    Processeur de contexte — injecte les paramètres plateforme dans tous les gabarits.
    Utilisé principalement pour l'interface d'administration.
    """
    contexte = {
        "NOM_PLATEFORME": getattr(settings, "NOM_PLATEFORME", "LBH Economiste"),
        "VERSION_PLATEFORME": "1.0.0",
    }

    try:
        from .models import Parametre
        nom = Parametre.objects.filter(cle="NOM_PLATEFORME").first()
        if nom:
            contexte["NOM_PLATEFORME"] = nom.valeur_typee()
    except Exception:
        # Pas de base disponible (migrations en cours, etc.) — valeur par défaut
        pass

    return contexte
