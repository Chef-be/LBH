# Ressources : analyses contrôlées

## Objectif fonctionnel

Permettre aux pages devis, prix marché et estimations de lancer des analyses contrôlées, paramétrées depuis l'administration.

## Workflow

L'utilisateur choisit une configuration active du module concerné, active les options de correction, normalisation, classification et rapprochement, puis lance l'analyse. Le backend appelle le service de traitements métier : simulation si le fournisseur n'est pas configuré, mode réel si la configuration l'autorise. Les propositions sont retournées et journalisées sans application automatique.

## Modèles backend

- `DevisAnalyse`
- `LignePrixMarche`
- `FicheRatioCout`
- `TraitementIA`
- `CorrectionIA`
- `ConfigurationIAFonctionnelle`

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

Les traitements stockent le modèle utilisé, le prompt système, le prompt utilisateur, l'entrée structurée, la sortie, le statut, l'utilisateur, les coûts estimés/réels et les erreurs éventuelles.

## Permissions

Utilisateur authentifié pour lancer, super-administrateur pour configurer.

## Tests

À couvrir : analyse devis, anomalies, doublons prix, scénarios estimation, journalisation.

## Limites connues

L'application sélective des corrections proposées reste à finaliser dans les tableaux de lignes.

## Prochaines évolutions

Ajouter l'application sélective des corrections proposées ligne par ligne.
