# Refonte du parcours projet

## Ce qui a été supprimé

- la dépendance fonctionnelle du formulaire de création projet à `qualification_wizard`
- l’endpoint `/api/projets/orientation/` comme moteur de création
- le composant frontend `WizardQualificationProjet.tsx`

## Ce qui a été créé

- un noyau de référentiels métier en base :
  - `FamilleClient`
  - `SousTypeClient`
  - `ContexteContractuel`
  - `PhaseIntervention`
  - `TypeMission`
  - `SousMission`
  - `ModeleChampContexte`
- une structuration projet persistée :
  - `ProjetContexte`
  - `ProjetSousMission`
  - `ProjetReponseChamp`
  - `ProjetModeVariationPrix`
- un endpoint de parcours :
  - `GET /api/projets/parcours/`

## Fonctionnement de la création de projet

Le projet est créé par étapes :

1. Client et contexte
   - identification du client
   - sous-type
   - contexte contractuel
   - mission principale
   - phase
   - nature du marché
   - rôle de LBH

2. Pièces sources
   - ajout des fichiers avant finalisation
   - prise en charge des archives ZIP
   - import dans la GED une fois le projet créé

3. Données d’entrée métier
   - champs pilotés par `ModeleChampContexte`
   - affichage filtré selon famille client, sous-type, contexte, mission et phase

4. Structuration
   - sous-missions activées
   - méthode d’estimation
   - paramétrage initial de variation de prix
   - aperçu des dossiers GED projet

5. Validation
   - synthèse des données
   - contrôle documentaire attendu

## Structuration des bibliothèques

Les bibliothèques globales restent destinées à être consommées dans les projets.
Dans cette tranche, le rattachement projet a été recentré sur le contexte métier et la GED projet.

La bibliothèque de prix a été étendue avec :

- `AliasLignePrixBibliotheque`
- `PrixRetourExperience`
- `RapprochementLignePrix`

L’import d’un BPU, DPGF, DQE ou devis ne remplace plus aveuglément une ligne analytique :

- si une prestation proche existe, le prix est ajouté en REX sur la ligne existante
- sinon une nouvelle ligne est créée
- si la similarité est intermédiaire, un rapprochement est tracé pour validation ultérieure
- les libellés sources sont conservés en alias métier

## Capitalisation économique

La double logique est maintenant amorcée :

- méthode analytique
- méthode par retour d’expérience

Le choix de méthode est maintenant stocké dans `ProjetContexte.methode_estimation`.
La projection legacy continue d’alimenter les services existants pour ne pas casser les écrans aval.

Chaque import documentaire économique produit désormais :

- une ligne analytique conservée comme référence
- un ou plusieurs prix de retour d’expérience rattachés
- une trace de score de rapprochement
- des alias exploitables pour les correspondances futures

## Actualisation / révision

Le paramétrage initial est porté par `ProjetModeVariationPrix` :

- type d’évolution
- cadre juridique
- indice / index de référence
- formule personnalisée
- dates structurantes
- historique gelé des valeurs

Un endpoint de calcul est maintenant disponible :

- `POST /api/projets/<id>/variation-prix/calculer/`

Le calcul prend en compte :

- le type d’évolution
- la part fixe éventuelle
- le ratio d’index
- une formule personnalisée si renseignée
- la neutralisation des trois mois pour l’actualisation en cadre public lorsque le délai entre remise d’offre et démarrage la rend applicable

Le résultat peut être enregistré dans l’historique du projet.

## Analyse des offres

L’analyse d’offres a été renforcée dans `applications.appels_offres` :

- stockage des paramètres d’analyse au niveau de la consultation
- stockage d’une synthèse d’analyse
- stockage d’une analyse détaillée par offre
- endpoint d’analyse traçable sur `POST /api/appels-offres/<id>/analyser/`

Méthodes prix disponibles :

- proportionnelle à la moins-disante
- linéaire par écart à la moins-disante
- linéaire par écart à l’estimation
- écart à la moyenne des offres
- barème paramétrable
- formule personnalisée

## Hypothèses retenues

- conservation transitoire des champs legacy `clientele_cible`, `objectif_mission` et `qualification_wizard` pour compatibilité de migration
- projection automatique du nouveau contexte vers les champs legacy tant que les autres modules aval n’ont pas tous été refondus
- champs dynamiques pilotés par la base côté backend, sans texte pédagogique lourd côté frontend
- conservation de la chaîne documentaire existante, réancrée sur le nouveau contexte projet
