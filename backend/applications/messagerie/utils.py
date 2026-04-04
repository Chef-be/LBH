"""Utilitaires partagés pour les contenus de messagerie."""

from django.conf import settings


def obtenir_nom_plateforme() -> str:
    """Retourne le nom public de la plateforme avec repli sûr."""
    try:
        from applications.site_public.models import ConfigurationSite

        nom_bureau = ConfigurationSite.obtenir().nom_bureau.strip()
        if nom_bureau:
            return nom_bureau
    except Exception:
        pass

    try:
        from applications.parametres.models import Parametre

        parametre = Parametre.objects.filter(cle="NOM_PLATEFORME").first()
        if parametre:
            valeur = str(parametre.valeur_typee() or "").strip()
            if valeur:
                return valeur
    except Exception:
        pass

    return getattr(settings, "NOM_PLATEFORME", "Plateforme")
