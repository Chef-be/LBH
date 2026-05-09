# Supervision serveur et services

## Objectif fonctionnel

Transformer la supervision en centre actionnable : vue d'ensemble, services de la plateforme, détails techniques, alertes et messagerie.

## Workflow

La vue d'ensemble résume l'état global, les ressources et les alertes. Les services ouvrent un drawer de détail, une modale de logs ou une confirmation de redémarrage.

## Modèles backend

- `InstantaneServeur`
- `AlerteSupervision`
- `EvenementSysteme`
- `ServeurMail`

## Endpoints

- `GET /api/supervision/`
- `POST /api/supervision/alertes/{id}/acquitter/`
- `GET|POST /api/supervision/serveurs-mail/`

## Composants frontend

- `TableauBordSupervision`
- `DrawerDetailService`
- `ModalVoirLogsService`
- `ModalRedemarrerService`
- `ModalNoteIncident`

## Règles métier

Les états techniques sont affichés en français. Les actions critiques passent par une confirmation et doivent rester réservées au super-administrateur côté API.

## Permissions

Super-administrateur pour les données de supervision et la messagerie.

## Tests

À couvrir : traductions, alertes, acquittement, accès réservé, absence de doublons.

## Limites connues

Les modales de logs et redémarrage exposent le parcours UX ; l'action système réelle reste à relier à un endpoint dédié.

## Prochaines évolutions

Ajouter historique d'incidents complet et téléchargement de rapport serveur.
