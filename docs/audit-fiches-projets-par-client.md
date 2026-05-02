# Audit des fiches projets par type de client

## 1. Objectif de la fiche projet

La fiche projet est la fiche métier du dossier. Elle doit expliquer le contexte contractuel, la mission confiée à LBH, les pièces sources, les livrables, les contrôles métier et les actions utiles pour faire avancer le dossier.

Elle ne doit pas devenir un tableau de bord interne de l'entreprise.

## 2. Ce qui relève de la fiche projet

- type de client et rôle de LBH ;
- contexte contractuel ;
- nature d'ouvrage et nature de marché ;
- phase d'intervention ;
- pièces sources attendues, disponibles et manquantes ;
- livrables attendus, produits et manquants ;
- documents à produire ;
- modules métier pertinents ;
- contrôles métier ;
- synthèse économique compacte du dossier ;
- alertes et actions recommandées.

## 3. Ce qui relève de Pilotage société

Les éléments suivants restent hors de la fiche projet principale :

- pointage salarié ;
- absences et congés ;
- charge annuelle des équipes ;
- rentabilité globale de la société ;
- facturation et encaissements tous dossiers confondus ;
- tableaux RH ou administratifs internes.

## 4. Profil maîtrise d'ouvrage

La fiche MOA est orientée besoin, programme, enveloppe financière, scénarios, risques et aide à la décision.

Pièces sources attendues : programme, surfaces, enveloppe, plans existants, études antérieures.

Modules pertinents : Documents, Ressources économiques, Économie simplifiée, Pièces écrites si une note ou un rapport est attendu.

Livrables attendus : note budgétaire, estimation prévisionnelle, comparaison de scénarios.

## 5. Profil maîtrise d'œuvre

La fiche MOE dépend de la phase.

En APS/APD, elle suit l'estimation par lots, les hypothèses, les surfaces, les quantités sommaires et la note économique.

En PRO/DCE, elle active les métrés, CCTP, DPGF quantitative, BPU/DQE si prévu, estimation et contrôles de cohérence CCTP / DPGF / métré.

En ACT, elle active l'analyse des offres, le tableau comparatif et le rapport d'analyse.

## 6. Profil entreprise

La fiche entreprise est orientée consultation, chiffrage et offre.

Pièces sources attendues : RC, AE, CCAP, CCTP, BPU, DPGF, DQE, plans, additifs.

Modules pertinents : Documents, Ressources / analyse de devis, Métrés, Économie, Planning, Pièces écrites pour mémoire technique.

Livrables attendus : analyse DCE, étude de prix, mémoire technique, offre finale.

## 7. Profil co-traitance

La fiche co-traitance suit l'organisation du groupement, le mandataire, les cotraitants, le rôle de LBH, le périmètre confié, les interfaces et les validations croisées.

## 8. Profil sous-traitance

La fiche sous-traitance suit le donneur d'ordre, la mission confiée, les pièces entrantes, le format attendu, l'échéance, le contrôle interne et la transmission.

## 9. Profil AMO / conseil

La fiche AMO est orientée analyse, diagnostic, recommandations, rapport et aide à la décision.

## 10. Modules actifs par type de client

Les modules actifs sont calculés côté backend par `construire_fiche_metier_projet`.

Chaque module indique son code, son libellé, sa raison d'activation, son niveau de pertinence, ses dépendances, ses livrables associés et ses actions recommandées.

Le frontend affiche cette structure au lieu de reconstruire seul la logique métier.

## 11. Livrables attendus par type de client

Les livrables sont structurés dans le modèle `LivrableProjet`. Ils portent un statut métier, un module source, un lien documentaire possible, une date prévue, une date de production et une date de validation.

Ils peuvent être générés depuis le parcours métier via l'endpoint projet dédié.

## 12. Pièces sources attendues par type de client

La fiche distingue :

- pièces attendues ;
- pièces disponibles ;
- pièces manquantes ;
- pièces analysées.

Les pièces sources guident les alertes métier et les actions recommandées.

## 13. Synthèse des doublons supprimés

La fiche principale ne présente plus deux synthèses financières concurrentes. L'ancien dashboard financier et la carte financière locale sont remplacés par une seule synthèse économique compacte.

## 14. Règles de non-duplication financière

La fiche projet conserve uniquement :

- enveloppe ou montant estimé de l'opération ;
- montant marché si connu ;
- honoraires ou montant de mission si connu ;
- état économique du dossier ;
- lien vers le module Économie.

La facturation détaillée, les encaissements et la rentabilité globale restent dans les modules spécialisés.

## 15. Architecture cible backend

Le backend expose :

- `GET /api/projets/{id}/fiche-metier/` ;
- `GET /api/projets/{id}/livrables/` ;
- `POST /api/projets/{id}/livrables/generer-depuis-parcours/` ;
- `PATCH /api/projets/{id}/livrables/{livrable_id}/`.

Le service central `construire_fiche_metier_projet` assemble le profil, le contexte, les modules actifs, les pièces sources, les livrables, les documents à produire, la synthèse économique, les alertes et les actions.

## 16. Architecture cible frontend

La page projet consomme `/fiche-metier/` et affiche une fiche métier unique avec :

- en-tête dossier ;
- contexte métier ;
- pièces sources ;
- livrables ;
- documents à produire ;
- synthèse économique compacte ;
- modules actifs ;
- alertes ;
- actions recommandées.

La navigation projet utilise les modules actifs renvoyés par le backend.
