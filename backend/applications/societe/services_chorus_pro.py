"""Préparation de l'intégration Chorus Pro avec mode manuel par défaut."""

from __future__ import annotations

from django.conf import settings

from .services_commercial import preparer_facture_chorus, statut_chorus_manuel


def est_chorus_active() -> bool:
    return getattr(settings, "CHORUS_MODE", "manuel") != "desactive"


def deposer_facture_chorus(facture):
    if getattr(settings, "CHORUS_MODE", "manuel") != "api":
        return preparer_facture_chorus(facture)
    return preparer_facture_chorus(facture)


def synchroniser_statut_chorus(facture):
    return preparer_facture_chorus(facture)


def traiter_retour_chorus(payload):
    return {"statut": "recu", "payload": payload}


def journaliser_echange_chorus(facture, payload):
    historique = list(facture.historique_commercial or [])
    historique.append({"type": "chorus_pro", "payload": payload})
    facture.historique_commercial = historique
    facture.save(update_fields=["historique_commercial", "date_modification"])
    return facture
