# Administration des traitements métier

## Objectif fonctionnel

Centraliser le pilotage des traitements métier paramétrables : analyse de devis, prix marché, estimations, bibliothèque de prix, CCTP et pièces écrites. L'administration ne doit pas imposer de modèle : le super-administrateur choisit un modèle récupéré côté serveur ou saisit manuellement une référence fournisseur.

## Architecture serveur

Le service `applications.parametres.services_ia_metier` concentre les appels fournisseur, l'estimation de coût, la journalisation, les tests et l'enregistrement des corrections. Les vues API ne manipulent jamais de clé côté frontend et délèguent les traitements à ce service.

Fonctions principales :

- `fournisseur_disponible`
- `lister_modeles_disponibles`
- `tester_configuration_ia`
- `executer_traitement_ia`
- `estimer_cout_traitement`
- `journaliser_traitement_ia`
- `enregistrer_corrections_ia`

## Sécurité des clés

Les clés restent dans les variables d'environnement serveur : `OPENAI_API_KEY` ou `CLE_API_OPENAI`. Aucune réponse API ne sérialise ces valeurs. Si aucune clé n'est configurée, les endpoints retournent une erreur locale explicite ou un test simulé selon le mode demandé.

## Modèles backend

- `ConfigurationIAFonctionnelle` : fournisseur, modèle principal, modèle de secours, prompts spécialisés, seuils, options métier, modes simulation/réel, schéma de sortie et exemple attendu.
- `TraitementIA` : entrée, sortie, modèle utilisé, prompts envoyés, statut, mode d'exécution, durée, tokens, coûts, utilisateur et erreur.
- `CorrectionIA` : correction proposée, statut de décision et justification.

## Endpoints

- `GET|POST /api/administration/ia/configurations/`
- `PATCH /api/administration/ia/configurations/{id}/`
- `GET /api/administration/ia/modeles-disponibles/`
- `POST /api/administration/ia/configurations/{id}/tester/`
- `GET /api/administration/ia/presets/`
- `GET /api/administration/ia/synthese/`
- `GET /api/administration/ia/journaux/`
- `GET /api/administration/ia/couts/`

## Workflow

Le super-administrateur crée une configuration depuis un formulaire vide ou un préréglage métier. Il peut récupérer les modèles disponibles côté serveur, renseigner les prompts, valider le schéma JSON, activer le mode réel, puis tester en simulation ou en réel. Les pages métier utilisent la configuration active de leur module et journalisent chaque traitement.

## Interface

La page `Administration -> Intelligence artificielle métier` affiche :

- cartes de synthèse par module ;
- nombre de configurations actives ;
- dernier traitement ;
- erreurs récentes ;
- coûts estimés et réels ;
- filtres module, état et recherche ;
- modal avancée à onglets ;
- drawer de résultat de test et journal.

Onglets de configuration :

- Général ;
- Comportement ;
- Prompts ;
- Schéma ;
- Options métier ;
- Test ;
- Journaux.

## Presets

Les préréglages disponibles sont modifiables avant enregistrement :

- Analyse devis / BPU / DPGF / DQE ;
- Normalisation prix marché ;
- Estimation par ratios ;
- Génération article CCTP ;
- Recherche intelligente bibliothèque ;
- Audit de ligne de prix ;
- Décomposition de prix.

## Test simulation et test réel

Le mode simulation journalise un traitement sans appeler de fournisseur. Le mode réel appelle le modèle configuré uniquement si une clé serveur existe, si un modèle est renseigné et si la configuration autorise le mode réel. La réponse affiche modèle utilisé, durée, sortie, tokens et erreurs éventuelles.

## Règles métier

Les validations humaines restent activées par défaut. Les fusions de prix, capitalisations et contenus CCTP ne sont jamais validés automatiquement sans paramètre explicite et score suffisant. Les contenus CCTP générés restent en statut `a_verifier`.

## Permissions

Tous les endpoints d'administration sont réservés au super-administrateur.

## Tests

Tests ajoutés :

- erreur propre si clé fournisseur absente ;
- liste de modèles avec fournisseur mocké ;
- absence de modèle imposé par défaut ;
- test simulation journalisé ;
- test réel avec service mocké ;
- accès refusé aux non super-administrateurs ;
- journalisation des entrées, sorties, statut et utilisateur.

## Limites connues

L'estimation de coût reste volontairement prudente et indépendante d'une grille tarifaire codée en dur. Les coûts réels sont enregistrés quand le fournisseur renvoie les informations nécessaires.

## Prochaines évolutions

Ajouter l'application sélective des corrections depuis les journaux et un tableau mensuel détaillé par utilisateur, module et configuration.
