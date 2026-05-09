# Bibliothèque, CCTP et recherche intelligente

## Objectif fonctionnel

Structurer la bibliothèque autour des prix, articles CCTP, corps d'état, unités, familles, prescriptions et recherche métier.

## Workflow

La recherche intelligente interroge les lignes de prix et prépare un groupement par familles de résultats. La génération CCTP charge la configuration active `bibliotheque_cctp`, construit une entrée structurée et appelle le service de traitements métier en mode réel.

## Modèles backend

- `LignePrixBibliotheque`
- `ArticleCCTP`
- `TraitementIA`
- `ConfigurationIAFonctionnelle`

## Endpoints

- `GET /api/bibliotheque/recherche-intelligente/`
- `POST /api/bibliotheque/generer-article-cctp/`

## Composants frontend

- `BarreRechercheIntelligenteBibliotheque`
- `ModalGenerationCCTPIA`

## Règles métier

Un article généré reste en statut `a_verifier` tant qu'un utilisateur ne l'a pas relu et validé. La structure s'inspire des générateurs de prix publics : corps d'état, familles, unités, options, justification et exigences techniques, sans reprise de contenu protégé.

Si aucune clé fournisseur n'est configurée ou si le mode réel est désactivé, le backend ne génère pas de faux texte statique. Il retourne une erreur propre et invite à créer un brouillon manuel.

La sortie attendue contient notamment : titre, désignation courte, description technique, cahier des charges, mise en œuvre, contrôles, limites, options, variantes, déchets, mots-clés, unité suggérée, corps d'état et justification.

## Permissions

Utilisateur authentifié pour rechercher et générer une proposition ; validation à réserver aux profils autorisés.

## Tests

Tests ajoutés : génération refusée sans clé, absence de faux contenu statique, génération avec service mocké, création d'un article en statut `a_verifier`, rattachement du journal au nouvel article.

## Limites connues

Le groupement prescriptions/modèles est préparé dans la réponse mais pas encore enrichi. Le rattachement automatique aux prix associés reste soumis à validation humaine.

## Prochaines évolutions

Ajouter similarité sémantique, variantes et rattachement assisté aux DPGF.
