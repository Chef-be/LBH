"""Tâches planifiées du pilotage commercial et financier."""

from __future__ import annotations

from datetime import timedelta

from celery import shared_task
from django.utils import timezone

from .models import DevisHonoraires, Facture, RelanceAutomatique


@shared_task
def tache_relance_devis_en_attente():
    maintenant = timezone.now()
    devis_a_relancer = DevisHonoraires.objects.filter(statut__in=["envoye", "consulte"])
    compteur = 0
    for devis in devis_a_relancer:
        if devis.date_expiration_validation and devis.date_expiration_validation < maintenant:
            devis.statut = "expire"
            devis.save(update_fields=["statut", "date_modification"])
            continue
        RelanceAutomatique.objects.create(
            type="devis_en_attente",
            cible_type="devis",
            cible_id=str(devis.id),
            niveau="relance_1",
            statut="planifiee",
            date_prevue=maintenant + timedelta(days=1),
            email_destinataire=devis.client_email,
            objet=f"Relance devis {devis.reference}",
            corps=f"Le devis {devis.reference} est en attente de retour client.",
        )
        devis.date_derniere_relance = maintenant if hasattr(devis, "date_derniere_relance") else None
        compteur += 1
    return {"relances_planifiees": compteur}


@shared_task
def tache_relance_factures_impayees():
    maintenant = timezone.now()
    factures = Facture.objects.filter(statut__in=["emise", "envoyee", "en_attente_paiement", "partiellement_payee", "en_retard"])
    compteur = 0
    for facture in factures:
        if facture.montant_restant <= 0:
            continue
        niveau = "relance_1" if facture.nombre_relances == 0 else "relance_2" if facture.nombre_relances == 1 else "relance_3"
        RelanceAutomatique.objects.create(
            type="facture_retard" if facture.est_en_retard else "facture_impayee",
            cible_type="facture",
            cible_id=str(facture.id),
            niveau=niveau,
            statut="planifiee",
            date_prevue=maintenant + timedelta(days=1),
            email_destinataire=facture.client_email,
            objet=f"Relance facture {facture.reference}",
            corps=f"La facture {facture.reference} présente un reste à payer de {facture.montant_restant} EUR.",
        )
        facture.nombre_relances += 1
        facture.date_derniere_relance = maintenant
        facture.statut = "relancee"
        facture.save(update_fields=["nombre_relances", "date_derniere_relance", "statut", "date_modification"])
        compteur += 1
    return {"relances_planifiees": compteur}
