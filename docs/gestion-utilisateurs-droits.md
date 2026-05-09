# Gestion des utilisateurs et droits

## Objectif fonctionnel

Gérer les utilisateurs comme des employés internes : fonction, profil, statut, sécurité, dernière connexion et actions d'administration.

## Workflow

La grille liste les informations opérationnelles. Le drawer affiche l'identité, le profil, l'organisation technique et les actions de sécurité. La suppression passe par une modale dédiée.

## Modèles backend

- `Utilisateur`
- `ProfilDroit`
- `InvitationUtilisateur`
- `JetonReinitialisationMotDePasse`

## Endpoints

- `GET|POST /api/auth/utilisateurs/`
- `PATCH|DELETE /api/auth/utilisateurs/{id}/`
- `POST /api/auth/utilisateurs/{id}/renvoyer-invitation/`
- `POST /api/auth/utilisateurs/{id}/envoyer-reinitialisation/`

## Composants frontend

- `DrawerDetailUtilisateur`
- `ModalSuppressionUtilisateur`

## Règles métier

Un utilisateur actif est désactivé par défaut. Un inactif peut être supprimé avec motif. Le compte courant et le dernier super-administrateur actif sont protégés.

## Permissions

Administration réservée au super-administrateur ou aux profils dotés du droit utilisateur.

## Tests

À couvrir : retrait colonne Organisation, désactivation, suppression inactif, dernier super-admin, compte courant.

## Limites connues

Le transfert détaillé des responsabilités reste à spécialiser par module métier.

## Prochaines évolutions

Ajouter un écran de transfert multi-objet avant suppression définitive.
