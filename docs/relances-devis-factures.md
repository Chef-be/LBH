# Relances devis et factures

## Objectif

Les relances doivent sécuriser le cycle commercial sans créer de projet depuis une affaire non validée.

## Relances devis

Une relance devis concerne uniquement les devis :

- envoyés ;
- non acceptés ;
- non refusés ;
- non annulés ;
- non expirés.

Chaque relance est journalisée dans `RelanceAutomatique`.

Niveaux :

- relance 1 ;
- relance 2 ;
- relance 3 ;
- mise en demeure si une règle commerciale future le prévoit.

Un devis accepté ou refusé ne doit plus être relancé.

## Relances factures

Une relance facture concerne les factures émises, envoyées, en attente de paiement, partiellement payées ou en retard.

Les factures payées, annulées, avoirs et brouillons sont exclues.

La relance peut adapter son message selon le mode :

- virement ;
- carte ;
- Chorus Pro ;
- mixte.

## Intérêts moratoires

Le calcul est paramétrable :

- délai avant application ;
- taux annuel ;
- indemnité forfaitaire ;
- règle marché public ou privé ;
- activation automatique ou manuelle.

Aucun taux juridique n'est codé en dur. Les taux et conditions doivent être vérifiés juridiquement avant activation automatique.

## Sécurité et traçabilité

Chaque relance doit conserver :

- la cible ;
- le niveau ;
- la date prévue ;
- la date d'envoi ;
- le destinataire ;
- l'objet ;
- le contenu ;
- le statut d'envoi.

