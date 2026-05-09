# Administration des traitements métier

## Objectif fonctionnel

Centraliser les configurations des traitements métier automatisés par module : ressources devis, prix marché, estimations, bibliothèque de prix, CCTP et pièces écrites.

## Workflow

Le super-administrateur crée une configuration avec fournisseur, modèle, modèle de secours, prompts, seuils, règles de validation et coût maximal. Les pages métier choisissent une configuration active et journalisent chaque lancement.

## Modèles backend

- `ConfigurationIAFonctionnelle` : configuration administrable par module.
- `TraitementIA` : journal d'exécution avec entrée, sortie, score, coûts et utilisateur.
- `CorrectionIA` : correction proposée, validée séparément.

## Endpoints

- `GET|POST /api/administration/ia/configurations/`
- `PATCH /api/administration/ia/configurations/{id}/`
- `POST /api/administration/ia/configurations/{id}/tester/`
- `GET /api/administration/ia/journaux/`
- `GET /api/administration/ia/couts/`

## Composants frontend

- `PageParametrageIA`
- `ModalConfigurationIA`
- test de prompt intégré

## Règles métier

Les clés fournisseur restent côté backend. Aucun secret n'est sérialisé. Les validations humaines restent activées par défaut.

## Permissions

Accès réservé au super-administrateur.

## Tests

À couvrir : création, modification, test, accès non autorisé, journalisation.

## Limites connues

Le test de prompt journalise un contrôle local si la clé fournisseur n'est pas disponible.

## Prochaines évolutions

Ajouter le relevé réel des modèles disponibles depuis le fournisseur configuré.
