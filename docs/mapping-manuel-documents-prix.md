# Mapping manuel assisté des documents de prix

Le mapping manuel assisté complète le moteur automatique d’analyse des devis, BPU, DPGF et DQE. Il sert lorsque l’extraction automatique ne produit aucune ligne, produit peu de lignes capitalisables ou signale trop de lignes à vérifier.

## Principe

L’utilisateur reste dans l’analyse du devis et reprend la main sur la structure du document :

- choix du texte ou du tableau détecté ;
- association des colonnes ;
- règles d’ignore des en-têtes, sous-totaux et totaux ;
- fusion des désignations multi-lignes ;
- séparation entre désignation et description ;
- prévisualisation contrôlée avant import.

Le mapping ne contourne pas les contrôles métier. Chaque ligne passe encore par les vérifications de désignation, unité, quantité, prix unitaire, montant et cohérence quantité x PU.

## Colonnes mappables

Les champs disponibles sont :

- numéro de prix ;
- chapitre ;
- sous-chapitre ;
- désignation ;
- description ;
- unité ;
- quantité ;
- prix unitaire HT ;
- montant HT ;
- total HT ;
- lot ;
- corps d’état ;
- observation ;
- ligne à ignorer.

## Statuts de prévisualisation

La prévisualisation classe les lignes :

- `OK` : ligne importable et capitalisable ;
- `À vérifier` : ligne importable comme corrigée, mais à contrôler avant capitalisation ;
- `Non capitalisable` : ligne insuffisante ou incohérente ;
- `Ignorée` : en-tête, sous-total, total, pointillés ou ligne explicitement ignorée.

## Modèles réutilisables

Un mapping peut être sauvegardé comme modèle lorsqu’un fournisseur, bureau d’études ou logiciel produit toujours le même format de BPU, DPGF ou DQE. Le modèle conserve :

- les colonnes mappées ;
- les règles de lecture ;
- les règles d’ignore ;
- le séparateur de description.

## Capitalisation

Après validation, seules les lignes de prix propres peuvent alimenter la banque de prix. Les lignes douteuses restent traçables dans le devis, avec leurs alertes et corrections proposées, mais ne sont pas capitalisées automatiquement.
