"""Tâches Celery asynchrones — Métrés visuels."""

from celery import shared_task


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
