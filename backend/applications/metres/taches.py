"""Tâches Celery asynchrones — Métrés visuels."""

from celery import shared_task


def _extraire_geometrie(fond_plan_id: str):
    import logging
    from .models import FondPlan
    from .services import extraire_et_stocker_geometrie_fond_plan

    logger = logging.getLogger(__name__)
    try:
        fond = FondPlan.objects.get(pk=fond_plan_id)
    except FondPlan.DoesNotExist:
        logger.warning("FondPlan %s introuvable — extraction annulée.", fond_plan_id)
        return None

    try:
        return extraire_et_stocker_geometrie_fond_plan(fond)
    except Exception as exc:
        fond.statut_vectorisation = "erreur"
        fond.message_vectorisation = str(exc)
        fond.save(update_fields=["statut_vectorisation", "message_vectorisation"])
        raise


@shared_task(bind=True, max_retries=2, default_retry_delay=10, name="metres.generer_miniature_fond_plan")
def tache_generer_miniature_fond_plan(self, fond_plan_id: str):
    """
    Génère la miniature PNG d'un fond de plan DXF/DWG en arrière-plan.
    Déclenchée après l'upload pour éviter les timeouts sur les gros fichiers.
    """
    import logging
    from .models import FondPlan
    from .services import generer_miniature_fond_plan

    logger = logging.getLogger(__name__)
    try:
        fp = FondPlan.objects.get(pk=fond_plan_id)
    except FondPlan.DoesNotExist:
        logger.warning("FondPlan %s introuvable — tâche annulée.", fond_plan_id)
        return

    try:
        generer_miniature_fond_plan(fp)
        logger.info("Miniature générée pour FondPlan %s.", fond_plan_id)
    except Exception as exc:
        logger.error("Erreur génération miniature %s : %s", fond_plan_id, exc)
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=2, default_retry_delay=10, name="metres.generer_apercus_fond_plan")
def tache_generer_apercus_fond_plan(self, fond_plan_id: str):
    """Génère les aperçus d'un fond de plan et met à jour son statut de traitement."""
    import logging
    from .models import FondPlan
    from .services import generer_miniature_fond_plan

    logger = logging.getLogger(__name__)
    try:
        fond = FondPlan.objects.get(pk=fond_plan_id)
    except FondPlan.DoesNotExist:
        logger.warning("FondPlan %s introuvable — tâche aperçus annulée.", fond_plan_id)
        return

    try:
        fond.statut_traitement = "rendu_en_cours"
        fond.message_traitement = ""
        fond.save(update_fields=["statut_traitement", "message_traitement"])
        generer_miniature_fond_plan(fond)
        fond.statut_traitement = "pret"
        fond.message_traitement = ""
        fond.save(update_fields=["statut_traitement", "message_traitement"])
        logger.info("Aperçus générés pour FondPlan %s.", fond_plan_id)
    except Exception as exc:
        fond.statut_traitement = "erreur"
        fond.message_traitement = str(exc)
        fond.save(update_fields=["statut_traitement", "message_traitement"])
        logger.error("Erreur génération aperçus %s : %s", fond_plan_id, exc)
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=1, default_retry_delay=10, name="metres.extraire_geometrie_fond_plan")
def tache_extraire_geometrie_fond_plan(self, fond_plan_id: str):
    """Extrait la géométrie exploitable pour l'accroche objet."""
    import logging

    logger = logging.getLogger(__name__)
    try:
        return _extraire_geometrie(fond_plan_id)
    except Exception as exc:
        logger.error("Erreur extraction géométrie %s : %s", fond_plan_id, exc)
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=1, default_retry_delay=10, name="metres.vectoriser_fond_plan")
def tache_vectoriser_fond_plan(self, fond_plan_id: str):
    """Vectorise un fond de plan raster ou extrait sa géométrie native si possible."""
    try:
        return _extraire_geometrie(fond_plan_id)
    except Exception as exc:
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=1, default_retry_delay=10, name="metres.detecter_contours_fond_plan")
def tache_detecter_contours_fond_plan(self, fond_plan_id: str):
    """Détecte les contours exploitables ; fallback sur l'extraction géométrique disponible."""
    try:
        return _extraire_geometrie(fond_plan_id)
    except Exception as exc:
        raise self.retry(exc=exc)
