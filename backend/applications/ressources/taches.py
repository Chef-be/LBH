"""Tâches Celery pour l'analyse asynchrone de devis et d'estimations."""

from celery import shared_task

import logging

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=2, default_retry_delay=30)
def tache_analyser_devis(self, devis_id: str) -> dict:
    """Analyse un devis téléversé et crée les lignes de prix marché correspondantes."""
    from .models import DevisAnalyse
    from .services import analyser_devis

    try:
        devis = DevisAnalyse.objects.get(pk=devis_id)
    except DevisAnalyse.DoesNotExist:
        logger.error("DevisAnalyse introuvable : %s", devis_id)
        return {"erreur": "Devis introuvable"}

    devis.statut = "en_cours"
    devis.save(update_fields=["statut"])

    try:
        lignes = analyser_devis(devis)
        devis.statut = "termine"
        devis.save(update_fields=["statut"])
        return {"lignes_extraites": len(lignes)}
    except Exception as exc:
        logger.exception("Erreur analyse devis %s : %s", devis_id, exc)
        devis.statut = "erreur"
        devis.erreur_detail = str(exc)
        devis.save(update_fields=["statut", "erreur_detail"])
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=2, default_retry_delay=30)
def tache_analyser_estimation(self, source_id: str) -> dict:
    """Analyse une source d'estimation et génère une fiche ratio."""
    from .models import EstimationSource, FicheRatioCout
    from .services import analyser_estimation_source

    try:
        source = EstimationSource.objects.get(pk=source_id)
    except EstimationSource.DoesNotExist:
        logger.error("EstimationSource introuvable : %s", source_id)
        return {"erreur": "Source introuvable"}

    source.statut = "en_cours"
    source.save(update_fields=["statut"])

    try:
        resultats = analyser_estimation_source(source)

        # Créer la fiche ratio depuis les résultats
        fiche = FicheRatioCout.objects.create(
            source=source,
            intitule=source.nom_original,
            shon=resultats.get("shon"),
            shab=resultats.get("shab"),
            emprise_sol=resultats.get("emprise_sol"),
            nombre_niveaux_hors_sol=resultats.get("niveaux_hs"),
            nombre_niveaux_sous_sol=resultats.get("niveaux_ss") or 0,
            type_fondation=resultats.get("type_fondation", "non_identifie"),
            cout_total_ht=resultats.get("cout_total_ht"),
            observations=resultats.get("observations", ""),
        )
        fiche.calculer_ratios()
        fiche.save()

        source.statut = "termine"
        source.save(update_fields=["statut"])
        return {"fiche_id": str(fiche.id)}
    except Exception as exc:
        logger.exception("Erreur analyse estimation %s : %s", source_id, exc)
        source.statut = "erreur"
        source.erreur_detail = str(exc)
        source.save(update_fields=["statut", "erreur_detail"])
        raise self.retry(exc=exc)


@shared_task
def tache_actualiser_indices() -> dict:
    """Actualise tous les prix marché avec les indices courants (tâche mensuelle)."""
    from .services import actualiser_toutes_les_lignes

    total = 0
    for code in ["BTM", "TPM", "BT01", "BT02", "TP01"]:
        nb = actualiser_toutes_les_lignes(code)
        total += nb
        logger.info("Actualisation %s : %d lignes", code, nb)

    return {"total_actualise": total}


@shared_task
def tache_supprimer_devis_expires() -> dict:
    """Supprime les devis dont la date de suppression programmée est dépassée."""
    from django.utils import timezone
    from .models import DevisAnalyse, EstimationSource

    date_auj = timezone.now().date()
    nb_devis = DevisAnalyse.objects.filter(date_suppression_programmee__lt=date_auj).delete()[0]
    nb_estim = EstimationSource.objects.filter(date_suppression_programmee__lt=date_auj).delete()[0]
    logger.info("Suppression programmée : %d devis, %d estimations", nb_devis, nb_estim)
    return {"devis_supprimes": nb_devis, "estimations_supprimees": nb_estim}
