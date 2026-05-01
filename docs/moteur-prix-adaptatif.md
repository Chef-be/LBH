# Moteur de prix adaptatif

## Objectif

Le moteur de prix du module Économie sert à auditer, compléter et contrôler une ligne de prix ou une étude de prix avec des données parfois incomplètes. Il ne remplace pas la validation de l'économiste : il formule des hypothèses, compare plusieurs méthodes, vérifie les incohérences et propose des corrections sans les appliquer automatiquement.

## Architecture

Le moteur est découpé en briques indépendantes dans `backend/applications/economie/moteur_prix/` :

- `contexte.py` : données connues transmises au moteur.
- `solveur.py` : orchestration, calculs déductifs, choix de stratégie et sortie finale.
- `strategies.py` : stratégies indépendantes de proposition de prix.
- `verifications.py` : contrôles arithmétiques, métier, statistiques, documentaires et croisés.
- `decomposition.py` : ventilation adaptative du déboursé sec.
- `corrections.py` : corrections proposées sans application automatique.
- `normalisation.py` : normalisation des unités et désignations.
- `resultats.py` : structures de sortie standardisées.
- `explication.py` : explication métier synthétique.

## Données d'entrée

Le contexte peut contenir notamment :

- désignation ;
- unité ;
- quantité ;
- prix unitaire HT ;
- montant total HT ;
- déboursé sec ;
- coût direct ;
- coût de revient ;
- prix de vente ;
- coefficient K ;
- taux de frais ;
- taux de marge ;
- lot, famille et sous-famille ;
- ligne de bibliothèque ;
- prix de marché similaires ;
- études de prix similaires ;
- indices d'actualisation ;
- source documentaire ;
- contraintes connues.

## Stratégies

Le moteur peut comparer plusieurs approches :

- bibliothèque exacte ;
- bibliothèque similaire ;
- étude de prix validée ;
- prix de marché ;
- ratios de famille ;
- coefficient K ;
- prix imposé ;
- déboursé imposé ;
- montant et quantité ;
- actualisation par indice ;
- repli heuristique.

La stratégie principale est celle qui obtient le meilleur niveau de confiance, mais les autres restent visibles dans la sortie.

## Calculs déductifs

Le solveur calcule automatiquement ce qui peut être déduit :

- `prix_unitaire_ht = montant_total_ht / quantite` ;
- `montant_total_ht = prix_unitaire_ht × quantite` ;
- `debourse_sec = prix_vente / coefficient_k` ;
- `prix_vente = debourse_sec × coefficient_k` ;
- `marge_estimee = prix_vente - debourse_sec` ;
- `coefficient_k_reel = prix_vente / debourse_sec` ;
- actualisation par indice si les indices sont fournis.

Chaque valeur estimée est accompagnée d'une hypothèse explicite.

## Vérifications

Les contrôles couvrent :

- cohérence quantité × prix unitaire ;
- cohérence déboursé sec × K ;
- unité compatible avec la désignation ;
- déboursé sec inférieur au prix de vente ;
- coefficient K dans une plage plausible ;
- comparaison aux prix de marché ;
- convergence ou divergence des stratégies ;
- fiabilité de la source documentaire.

Une erreur critique place le résultat en statut `incoherent`. Une alerte laisse le statut `a_verifier`.

## Corrections proposées

Le moteur ne corrige pas automatiquement. Il peut proposer, par exemple :

- un prix unitaire recalculé si le montant total semble avoir été importé comme prix unitaire ;
- une unité plus cohérente avec la désignation ;
- une vérification du coefficient K s'il est trop bas ou trop haut.

L'utilisateur peut accepter, refuser ou modifier une proposition. La décision est enregistrée dans `DecisionMoteurPrix`.

## Paramétrage

Les modèles suivants préparent le paramétrage métier :

- `ParametreMoteurPrix` ;
- `FamilleDecompositionPrix` ;
- `RegleControlePrix` ;
- `PlageCoefficientK` ;
- `PlagePrixFamille` ;
- `ScenarioDecompositionPrix`.

Ces modèles permettent de faire évoluer les seuils, ratios, scénarios et fourchettes sans transformer le moteur en formule figée.

## API

### Auditer un contexte libre

`POST /api/economie/moteur-prix/auditer/`

Retourne :

- statut ;
- niveau de confiance ;
- stratégie principale ;
- stratégies comparées ;
- valeurs calculées ;
- hypothèses ;
- vérifications ;
- alertes ;
- erreurs ;
- corrections proposées ;
- justification.

### Auditer une étude de prix

`GET /api/economie/etudes-de-prix/{id}/audit-prix/`

Construit le contexte depuis l'étude, ses totaux, son coefficient K, sa bibliothèque liée et les études validées similaires.

### Historiser une décision

`POST /api/economie/moteur-prix/decisions/enregistrer/`

Enregistre la décision humaine :

- acceptée ;
- refusée ;
- modifiée.

## Interface

La page de détail d'une étude de prix propose un bouton `Auditer le prix`. L'audit affiche :

- synthèse ;
- niveau de confiance ;
- stratégie retenue ;
- hypothèses ;
- vérifications ;
- corrections proposées.

## Limites

Le moteur reste un outil d'aide à la décision. Les prix importés, les ratios, les indices, les références de marché et les hypothèses de marge doivent être contrôlés par un économiste, un responsable d'étude ou une personne habilitée avant utilisation contractuelle.
