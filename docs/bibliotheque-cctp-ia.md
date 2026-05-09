# Bibliothèque, CCTP et recherche intelligente

## Objectif fonctionnel

Structurer la bibliothèque autour des prix, articles CCTP, corps d'état, unités, familles, prescriptions et recherche métier.

## Workflow

La recherche intelligente interroge les lignes de prix et prépare un groupement par familles de résultats. La génération CCTP crée une proposition en statut `à vérifier`.

## Modèles backend

- `LignePrixBibliotheque`
- `ArticleCCTP`
- `TraitementIA`

## Endpoints

- `GET /api/bibliotheque/recherche-intelligente/`
- `POST /api/bibliotheque/generer-article-cctp/`

## Composants frontend

- `BarreRechercheIntelligenteBibliotheque`
- `ModalGenerationCCTPIA`

## Règles métier

Un article généré reste en statut `a_verifier` tant qu'un utilisateur ne l'a pas relu et validé. La structure s'inspire des générateurs de prix publics : corps d'état, familles, unités, options, justification et exigences techniques, sans reprise de contenu protégé.

## Permissions

Utilisateur authentifié pour rechercher et générer une proposition ; validation à réserver aux profils autorisés.

## Tests

À couvrir : recherche, génération, statut à vérifier, rattachement lot/prix.

## Limites connues

Le groupement prescriptions/modèles est préparé dans la réponse mais pas encore enrichi.

## Prochaines évolutions

Ajouter similarité sémantique, variantes et rattachement assisté aux DPGF.
