# Fiches projets métier interactives

## Objectif

La fiche projet est le tableau de bord métier du dossier. Elle ne remplace pas le pilotage société, la facturation, le pointage ou les tableaux RH.

Elle priorise :

- le rôle de LBH ;
- la mission confiée ;
- les pièces sources attendues et disponibles ;
- les modules utiles ;
- les dépendances métier ;
- les livrables attendus ;
- les alertes ;
- les actions recommandées ;
- la progression globale.

## Ce qui relève de la fiche projet

- qualification client et mission ;
- cadre juridique et mode de commande ;
- phase d'intervention ;
- nature d'ouvrage ;
- pièces sources ;
- livrables ;
- documents à produire ;
- contrôles métier ;
- score de cohérence ;
- modules actifs.

## Ce qui relève de Pilotage société

- pointage salarié ;
- absences ;
- charge annuelle ;
- rentabilité globale de l'entreprise ;
- facturation générale ;
- indicateurs RH.

## Structure interactive

La fiche principale affiche :

- un bandeau synthèse ;
- des KPI ;
- un anneau de progression ;
- une timeline de parcours métier ;
- des cartes modules ;
- des blocs compacts pièces sources et livrables ;
- les alertes prioritaires ;
- les actions recommandées.

Le contexte complet est accessible dans une modal afin d'éviter un formulaire géant dans la fiche principale.

## KPI

Les KPI affichés sont :

- pièces sources disponibles / attendues ;
- livrables produits / attendus ;
- modules obligatoires prêts / attendus ;
- alertes bloquantes et alertes attention ;
- progression globale ;
- état économique.

## Score de cohérence

Le score démarre à 100 et baisse selon :

- alertes bloquantes ;
- alertes attention ;
- absence de pièces sources ;
- absence de livrables produits ;
- incohérence Économie détaillée sans Métrés.

Les statuts sont :

- cohérent ;
- à vérifier ;
- incohérent ;
- prêt.

## Modules actifs

Chaque module indique :

- son libellé ;
- son niveau de pertinence ;
- sa raison d'activation ;
- ses dépendances ;
- ses livrables associés ;
- ses actions recommandées.

## Économie amont et économie détaillée

L'économie amont peut fonctionner sans métré détaillé :

- faisabilité ;
- programmation ;
- vérification d'enveloppe ;
- estimation par ratios ;
- scénarios budgétaires.

L'économie détaillée nécessite un quantitatif :

- PRO / DCE ;
- DPGF ;
- BPU / DQE ;
- étude de prix entreprise ;
- estimation détaillée par lots.

Dans ce cas, le module Métrés devient obligatoire et la dépendance Économie vers Métrés est affichée.

## Modals et drawers

- Contexte projet : modal.
- Contrôle de cohérence : modal.
- Modification de mission : modal.
- Pièces sources : modal.
- Livrables : modal.
- Détail module : drawer.

Les erreurs doivent rester locales à la fiche. Une action de fiche ne doit pas déclencher l'écran global d'incident applicatif.
