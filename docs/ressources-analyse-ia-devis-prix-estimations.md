# Ressources : analyses contrôlées

## Objectif fonctionnel

Permettre aux pages devis, prix marché et estimations de lancer des analyses contrôlées, paramétrées depuis l'administration.

## Workflow

L'utilisateur choisit une configuration, active les options de correction, normalisation, classification et rapprochement, puis lance l'analyse. Les propositions sont retournées et journalisées sans application automatique.

## Modèles backend

- `DevisAnalyse`
- `LignePrixMarche`
- `FicheRatioCout`
- `TraitementIA`
- `CorrectionIA`

## Endpoints

- `POST /api/ressources/devis/{id}/analyser-ia/`
- `POST /api/ressources/prix-marche/analyser-ia/`
- `POST /api/ressources/estimations/generer-ia/`

## Composants frontend

- `ActionsAnalyseIA`
- `ModalAnalyseIADevis`
- `ModalAnalyseIAPrixMarche`
- `ModalGenerationEstimationIA`

## Règles métier

Les propositions n'écrasent pas le texte original. La capitalisation et les fusions restent soumises à validation humaine sauf configuration explicite.

## Permissions

Utilisateur authentifié pour lancer, super-administrateur pour configurer.

## Tests

À couvrir : analyse devis, anomalies, doublons prix, scénarios estimation, journalisation.

## Limites connues

Le premier lot prépare les traitements et les journaux ; l'appel fournisseur réel doit être branché derrière la configuration.

## Prochaines évolutions

Ajouter l'application sélective des corrections proposées ligne par ligne.
