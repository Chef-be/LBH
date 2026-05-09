# Journal des modifications fonctionnelles

## 2026-05-09

- Gestion utilisateurs : retrait de la colonne Organisation, ajout fonction/profil/dernière connexion, drawer de détail et modale de suppression.
- Sécurité utilisateurs : protection du compte courant, protection du dernier super-administrateur actif, motif obligatoire pour suppression définitive.
- Supervision : renommage des sections, traduction des états techniques et ajout des parcours détail, logs, redémarrage et note d'incident.
- Menu latéral : retrait du lien public du menu fonctionnel.
- Projets : retrait du libellé de création commerciale et renvoi vers les affaires validées.
- Administration : ajout du paramétrage des traitements métier automatisés, journaux et coûts.
- Ressources : ajout des lancements contrôlés devis, prix marché et estimations.
- Bibliothèque : ajout recherche intelligente et génération CCTP en statut à vérifier.
- Administration des traitements métier : suppression du modèle imposé par défaut, ajout de la récupération serveur des modèles disponibles, tests simulation/réel, préréglages métier, schémas JSON, options par module, synthèse, journaux et coûts.
- Serveur : ajout du service centralisé `services_ia_metier`, journalisation enrichie des modèles, prompts, entrées, sorties, tokens, coûts, erreurs et utilisateur.
- CCTP : suppression du faux contenu statique ; la génération exige un fournisseur réel disponible et crée uniquement des articles en statut `a_verifier`.

## Tests attendus

Backend, frontend lint/build et tests ciblés doivent être exécutés avant publication.
