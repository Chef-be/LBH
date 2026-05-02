# Pilotage société : cycle affaire, devis et projet

## Principe

Un projet ne naît plus d'une création isolée dans le module Projets. Il doit provenir d'une affaire commerciale validée.

Cycle cible :

1. Créer une affaire commerciale depuis Pilotage société.
2. Préparer un devis rattaché à cette affaire.
3. Envoyer le devis au client avec un lien sécurisé.
4. Attendre l'acceptation client ou une validation manuelle super administrateur motivée.
5. Créer le projet depuis l'affaire validée.
6. Produire les livrables, facturer, encaisser puis livrer via lien sécurisé.

## Statuts principaux

Affaire commerciale :

- `brouillon` : affaire en préparation.
- `devis_a_preparer` : devis à produire.
- `devis_envoye` : devis transmis au client.
- `devis_accepte` : validation client reçue.
- `affaire_validee` : validation manuelle super administrateur.
- `affaire_perdue` : devis refusé ou opportunité abandonnée.
- `projet_cree` : projet créé depuis l'affaire.

Devis :

- `brouillon`, `pret`, `envoye`, `consulte`, `accepte`, `refuse`, `expire`, `annule`, `remplace`.

## Règles métier

- Un devis refusé bloque la création du projet.
- Un devis accepté permet la création du projet depuis l'affaire.
- Une affaire peut être validée manuellement uniquement par super administrateur, avec motif obligatoire.
- La validation manuelle conserve une trace dans l'historique de l'affaire.
- Une affaire déjà convertie en projet ne doit pas recréer un second projet sauf autorisation spéciale.

## Création projet

Le projet créé depuis l'affaire hérite :

- du client et du contact ;
- du devis accepté ;
- des missions et livrables vendus ;
- du montant d'honoraires ;
- du mode de facturation ;
- du mode de paiement prévu ;
- du contexte métier saisi dans le devis.

La création directe depuis `/projets/nouveau` affiche désormais un blocage fonctionnel et renvoie vers Pilotage société.

