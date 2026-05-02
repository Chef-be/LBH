"""Abstraction des paiements carte, virement et statuts prestataires."""

from __future__ import annotations

from .services_commercial import creer_lien_paiement, confirmer_paiement_manuel


def creer_intention_paiement(facture):
    return creer_lien_paiement(facture)


def traiter_webhook_paiement(payload):
    return {"statut": "recu", "payload": payload}


def confirmer_paiement(transaction):
    return transaction


def rembourser_paiement(transaction):
    return {"statut": "remboursement_a_traiter", "transaction": transaction}


def synchroniser_statut_paiement(transaction):
    return {"statut": getattr(transaction, "statut", "inconnu")}
