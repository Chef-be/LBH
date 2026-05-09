# Modales et drawers métier

## Objectif fonctionnel

Harmoniser les interactions : création en modal wizard, édition en modal, détail en drawer, analyse en modal, action dangereuse en confirmation.

## Workflow

Les nouvelles zones utilisateurs, supervision, ressources, bibliothèque et administration suivent ce modèle.

## Modèles backend

Sans modèle dédié ; les modales consomment les endpoints métier existants.

## Endpoints

Les endpoints sont décrits dans les documentations de chaque module.

## Composants frontend

- `ModalSuppressionUtilisateur`
- `DrawerDetailUtilisateur`
- `DrawerDetailService`
- `ModalRedemarrerService`
- `ModalVoirLogsService`
- `ModalConfigurationIA`
- `ActionsAnalyseIA`

## Règles métier

Pas de `window.prompt` ni `window.confirm` pour les nouveaux flux. Les erreurs restent locales.

## Permissions

Les actions sensibles doivent être confirmées et vérifiées côté API.

## Tests

À couvrir : rendu thème sombre, fermeture, erreurs locales, absence de page blanche.

## Limites connues

Certains anciens composants contiennent encore des confirmations natives hors périmètre de ce lot.

## Prochaines évolutions

Extraire un composant drawer partagé.
