# Métrés visuels, avant-métré et DPGF quantitative

## Rôle du module Métrés

Le module Métrés sert à préparer les quantités d'ouvrage d'un projet. Il couvre l'avant-métré manuel, le métré visuel sur fond de plan et la préparation d'une DPGF quantitative.

Le module ne valorise pas les ouvrages. Les prix unitaires, déboursés, coefficients, marges et estimations restent traités dans le module Économie.

## Différence entre métré, avant-métré, DPGF et économie

- **Avant-métré** : relevé préparatoire des ouvrages, localisations, unités et quantités.
- **Métré visuel** : mesure graphique sur fond de plan PDF, image ou DXF.
- **DPGF quantitative** : bordereau structuré des désignations, localisations, quantités et unités, sans prix.
- **Économie** : étape ultérieure de chiffrage et de valorisation financière.

## Pourquoi aucun prix dans le métré

Le métré doit rester un document quantitatif. Il peut conserver des champs historiques de prix pour relire les anciennes données, mais l'interface métier et la DPGF générée n'utilisent pas ces champs.

Cette séparation évite de confondre :

- la quantité mesurée ;
- la désignation technique issue du CCTP ;
- la valorisation économique réalisée ensuite.

## Lien avec les articles CCTP

Une ligne d'avant-métré peut être liée à un article CCTP. Le lien permet de reprendre :

- le code de référence ;
- le libellé technique ;
- le chapitre ;
- le lot CCTP.

Si l'article n'existe pas, l'utilisateur peut créer rapidement un article CCTP à compléter. La ligne peut aussi rester en désignation libre, mais elle sera signalée dans les contrôles de cohérence.

## Workflow manuel

1. Créer un avant-métré depuis un projet.
2. Ajouter une ligne d'avant-métré.
3. Renseigner la localisation, la désignation, l'unité et la quantité.
4. Lier la ligne à un article CCTP ou la laisser libre à compléter.
5. Contrôler la cohérence avant génération de DPGF.

## Workflow visuel

1. Ajouter un fond de plan.
2. Calibrer le plan avec deux points de référence.
3. Dessiner une surface, une longueur, un périmètre ou un comptage.
4. Calculer la zone.
5. Convertir la zone en ligne d'avant-métré.
6. Synchroniser la ligne si la géométrie de la zone est modifiée.

## Calibration

La calibration s'appuie sur deux points et une distance connue. Le système calcule l'échelle en pixels par mètre et met à jour le statut du fond de plan.

Les champs historiques restent compatibles. Les nouveaux champs `echelle_x`, `echelle_y`, `statut_calibration` et `transformation_coordonnees` préparent les cas plus avancés.

## Vectorisation et accroche objet

Le module stocke une géométrie unifiée par fond de plan via `GeometrieFondPlan` :

- points d'accroche ;
- segments ;
- contours ;
- calques ;
- statistiques d'extraction.

Pour un DXF, le service extrait les points exploitables avec `ezdxf` si disponible. Pour un PDF ou une image, le système fournit un fallback propre et peut être enrichi par des traitements de vectorisation raster.

Les traitements lourds peuvent être lancés en tâche asynchrone :

- génération d'aperçus ;
- extraction géométrique ;
- vectorisation ;
- détection de contours.

## Synchronisation zones / lignes

Une zone mesurée peut créer une ligne d'avant-métré. La ligne conserve la zone et le fond de plan source.

Si la géométrie de la zone change après conversion, le statut passe en désynchronisé. L'utilisateur peut resynchroniser la ligne depuis la zone pour reprendre la quantité, l'unité, la localisation et les informations CCTP.

## Contrôles de cohérence

Avant validation ou génération de DPGF, le contrôle vérifie notamment :

- ligne sans désignation ;
- ligne sans quantité ;
- ligne sans unité ;
- ligne sans article CCTP lié ;
- zone non calculée ;
- zone non convertie ;
- ligne issue d'une zone désynchronisée ;
- fond de plan non calibré ;
- fond de plan en erreur ;
- doublon de désignation et localisation.

Les erreurs bloquantes empêchent la génération. Les alertes peuvent être corrigées ou acceptées selon le contexte du projet.

## Génération de DPGF

La génération de DPGF quantitative crée :

- une `DPGFQuantitative` liée au projet et au métré source ;
- des `LigneDPGFQuantitative` reprenant les lignes incluses dans la DPGF.

Chaque ligne contient uniquement :

- lot ;
- chapitre ;
- code article ;
- désignation ;
- localisation ;
- quantité ;
- unité ;
- observations ;
- statut.

Aucun prix unitaire, montant, coefficient ou marge n'est stocké dans ces modèles.

## Transmission au module Économie

La DPGF quantitative peut être marquée comme transmise au module Économie. Cette action indique que la base quantitative est prête pour un chiffrage ultérieur.

La transmission ne calcule pas de prix. Le module Économie reste responsable de la valorisation financière.

## Endpoints principaux

- `GET /api/metres/{id}/controle-coherence/`
- `GET /api/metres/{id}/previsualiser-dpgf/`
- `POST /api/metres/{id}/generer-dpgf/`
- `POST /api/metres/{id}/synchroniser-zones/`
- `POST /api/metres/{metre_id}/fonds-plan/{id}/vectoriser/`
- `GET /api/metres/{metre_id}/fonds-plan/{id}/geometrie/`
- `GET /api/metres/{metre_id}/fonds-plan/{id}/points-accroche/`
- `POST /api/metres/{metre_id}/fonds-plan/{fond_id}/zones/{id}/synchroniser-ligne/`
- `GET /api/metres/dpgf/{id}/`
- `POST /api/metres/dpgf/{id}/transmettre-economie/`

## Limites techniques

La qualité de vectorisation dépend du support :

- un DXF propre donne les meilleurs points d'accroche ;
- un PDF vectoriel peut être exploitable selon la qualité des tracés ;
- un PDF scanné ou une image nécessite une vectorisation assistée, à valider manuellement ;
- les calques, hachures et blocs complexes peuvent nécessiter une correction utilisateur.

## Procédure de test

1. Créer un avant-métré dans un projet.
2. Ajouter une ligne libre sans prix.
3. Lier une ligne à un article CCTP.
4. Ajouter un fond de plan et le calibrer.
5. Créer une zone, la calculer puis la convertir en ligne.
6. Modifier la zone et vérifier le statut désynchronisé.
7. Resynchroniser la ligne.
8. Lancer le contrôle de cohérence.
9. Prévisualiser la DPGF.
10. Générer la DPGF et vérifier l'absence de tout champ de prix.
