# Facturation, paiements et livraison des livrables

## Facturation

Une facture commerciale peut être liée à une affaire, un devis et un projet.

Types prévus :

- acompte ;
- situation d'avancement ;
- solde ;
- avoir ;
- proforma.

Statuts suivis :

- brouillon ;
- émise ;
- envoyée ;
- déposée Chorus Pro ;
- en attente de paiement ;
- partiellement payée ;
- payée ;
- en retard ;
- relancée ;
- contentieux ;
- annulée.

## Paiements

Modes prévus :

- virement ;
- carte bancaire via prestataire ;
- Chorus Pro ;
- saisie manuelle ;
- mixte.

Aucune donnée de carte bancaire ne doit être stockée. Le système conserve uniquement les références de transaction, statuts, montants, prestataire et métadonnées utiles au rapprochement.

Le virement peut être confirmé manuellement par l'administration. Le montant payé de la facture est recalculé depuis les paiements confirmés.

## Paiement carte

Le service de paiement prépare une abstraction pour brancher un prestataire :

- création d'intention ;
- génération de lien ;
- traitement webhook ;
- confirmation ;
- remboursement ;
- synchronisation.

Si aucun prestataire n'est configuré, l'interface doit afficher que le paiement carte est indisponible et proposer virement ou Chorus Pro selon le dossier.

## Livraison des livrables

Les livrables finaux doivent être envoyés par lien sécurisé temporaire.

Conditions de livraison possibles :

- paiement reçu ;
- facture déposée Chorus Pro ;
- validation administrateur ;
- gratuit.

Un livrable reste bloqué si la condition choisie n'est pas remplie. Une validation administrateur doit être motivée et tracée.

