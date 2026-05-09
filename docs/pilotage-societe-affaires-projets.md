# Pilotage société, affaires et projets

## Objectif fonctionnel

Maintenir la règle : l'affaire est créée et validée dans Pilotage société ; le projet est la conséquence opérationnelle d'une affaire validée.

## Workflow

La page Projets liste et suit les projets. Elle renvoie vers les affaires validées au lieu de porter la création commerciale.

## Modèles backend

- `Affaire`
- `DevisHonoraires`
- `Projet`

## Endpoints

Les endpoints existants de `societe` et `projets` restent les sources de vérité.

## Composants frontend

- `ModalNouvelleAffaire`
- `BoutonNouveauProjet`
- `ListeProjets`

## Règles métier

Projet créé depuis affaire validée, pas depuis devis refusé. La page Projets n'est pas le point d'entrée commercial.

## Permissions

Création d'affaire réservée aux profils de pilotage société.

## Tests

À couvrir : bouton retiré, lien secondaire, création depuis Pilotage société.

## Limites connues

Les validations fines restent dans les endpoints société existants.

## Prochaines évolutions

Ajouter un filtre direct des affaires validées disponibles à transformer en projet.
