# Pilotage RH, badgeage et assignation automatique

## Objectif

Le module Pilotage société calcule désormais la disponibilité des salariés à partir des profils RH, du calendrier de travail, des pointages, des absences, des formations et des affectations projet. L'assignation automatique ne se limite plus au nombre d'affectations : elle classe les salariés selon leur capacité réelle sur la période analysée.

## Références et limites réglementaires

Les règles françaises de durée du travail peuvent dépendre du Code du travail, de la convention collective, du contrat, d'un accord d'entreprise, du forfait heures ou jours et du contexte local. L'application stocke donc des paramètres modifiables et ne fige pas une règle juridique unique.

Références vérifiées :

- Service-Public rappelle qu'un temps plein est généralement fixé à 35 h par semaine, 151,67 h par mois et 1 607 h par an, sauf dispositions conventionnelles : https://www.service-public.fr/particuliers/vosdroits/F1911
- Service-Public précise que les heures effectuées au-delà de la durée légale peuvent constituer des heures supplémentaires : https://www.service-public.fr/particuliers/vosdroits/F2391
- Service-Public indique que le repos hebdomadaire minimal combine 24 h de repos hebdomadaire et 11 h de repos quotidien, soit 35 h consécutives : https://www.service-public.fr/particuliers/vosdroits/F2327
- La CNIL rappelle que les dispositifs de contrôle d'horaires doivent informer les salariés, limiter les accès, respecter les droits d'accès et de rectification, et que les données de suivi du temps de travail sont conservées 5 ans : https://www.cnil.fr/fr/lacces-aux-locaux-et-le-controle-des-horaires-sur-le-lieu-de-travail
- La CNIL rappelle les principes de finalité claire, proportionnalité et information préalable pour les dispositifs de suivi du temps de travail : https://www.cnil.fr/fr/les-questions-reponses-de-la-cnil-sur-le-teletravail

Les paramètres RH doivent être validés par l'employeur, le gestionnaire de paie ou le conseil juridique en fonction de la convention collective applicable.

## Concepts ajoutés

- `ProfilRHSalarie` : contrat, régime de temps, jours travaillés, horaires théoriques, taux d'activité, droits congés/RTT et profil horaire société.
- `CalendrierTravailSociete` : année, zone, semaine type, jours fériés et jours non travaillés exceptionnels.
- `PointageJournalier` : arrivée, départ, pause, source, statut, commentaires et validation.
- `EvenementPointage` : journal minimal des arrivées, départs, corrections, validations et rejets, sans géolocalisation par défaut.
- `DemandeAbsence` : congés, RTT, maladie, formation, récupération ou autre absence, avec calcul des jours ouvrés et heures.
- `SoldeAbsenceSalarie` : acquis, pris, en attente, report, ajustement et solde.
- `CompteurTempsSalarie` : agrégats recalculables de temps théoriques, pointés, productifs, non productifs, absences, formations et heures supplémentaires.

## Badgeage

Un salarié peut pointer son arrivée, son départ et une pause depuis son espace. Une journée validée ne doit plus être modifiée directement : une correction justifiée est attendue, puis validée.

Endpoints principaux :

- `GET /api/societe/pointages/`
- `POST /api/societe/pointages/pointer-arrivee/`
- `POST /api/societe/pointages/pointer-depart/`
- `POST /api/societe/pointages/debut-pause/`
- `POST /api/societe/pointages/fin-pause/`
- `PATCH /api/societe/pointages/{id}/corriger/`
- `POST /api/societe/pointages/{id}/valider/`
- `POST /api/societe/pointages/{id}/rejeter/`

## Absences, RTT et formation

Une absence est créée en brouillon, soumise, puis validée ou refusée. Les jours ouvrés sont calculés à partir du profil RH et du calendrier société. Les soldes ne sont décomptés comme pris qu'après validation ; les demandes soumises apparaissent en attente.

Endpoints principaux :

- `GET /api/societe/absences/`
- `POST /api/societe/absences/`
- `POST /api/societe/absences/{id}/soumettre/`
- `POST /api/societe/absences/{id}/valider/`
- `POST /api/societe/absences/{id}/refuser/`
- `POST /api/societe/absences/{id}/annuler/`
- `GET /api/societe/soldes-absences/`
- `POST /api/societe/soldes-absences/recalculer/`

## Calcul de capacité

Formule simplifiée utilisée par le service :

```text
heures_theoriques = jours_travailles_ouvres × heures_contractuelles_jour × taux_activite
capacite_nette = heures_theoriques - absences_validees - formations_validees
heures_disponibles = capacite_nette - charge_previsionnelle_restante
taux_charge = charge_previsionnelle_restante / capacite_nette
disponibilite = 1 - taux_charge, bornée entre 0 et 1
```

La charge prévisionnelle restante provient des affectations actives et de leurs heures objectif ou heures restantes. Les heures réalisées proviennent des temps passés imputés aux projets.

Endpoints :

- `GET /api/societe/capacite-salaries/?date_debut=YYYY-MM-DD&date_fin=YYYY-MM-DD`
- `GET /api/societe/capacite-salaries/{utilisateur_id}/`

## Assignation automatique

Le score d'assignation combine :

- disponibilité sur la période ;
- adéquation du profil recherché ;
- charge actuelle ;
- continuité sur le dossier ;
- capacité à absorber l'objectif avant l'échéance.

Le moteur renvoie un score, une justification lisible et des alertes : indisponibilité, surcharge, absence validée, absence en attente, formation prévue ou profil à vérifier.

Endpoints :

- `GET /api/societe/assignation-automatique/`
- `POST /api/societe/assignation-automatique/`
- `POST /api/societe/assignation-automatique/simuler/`

## Tableau de bord RH

Le tableau de bord société consomme `GET /api/societe/tableau-de-bord-rh/` pour afficher :

- heures théoriques ;
- heures pointées ;
- heures productives ;
- heures non productives ;
- absences ;
- formations ;
- heures supplémentaires estimées ;
- taux de charge moyen ;
- taux d'occupation facturable ;
- écart objectif / réel ;
- salariés à surveiller.

## RGPD et sécurité

Le pointage ne stocke pas de géolocalisation par défaut. Les traces techniques sont limitées à l'adresse IP et au navigateur lorsqu'un événement de pointage est enregistré. Les accès aux données doivent rester limités aux salariés concernés, aux responsables habilités et aux administrateurs.

À vérifier avant déploiement opérationnel :

- information préalable des salariés ;
- inscription au registre des traitements ;
- durée de conservation documentée ;
- procédure d'accès et de rectification ;
- habilitations manager/RH ;
- procédure de correction et validation ;
- validation des paramètres par la paie ou le conseil juridique.

## Procédure de vérification

1. Créer ou vérifier un profil RH salarié.
2. Vérifier le calendrier société et les jours fériés.
3. Pointer une arrivée, une pause et un départ.
4. Soumettre puis valider une absence.
5. Vérifier le solde mis à jour.
6. Calculer une assignation sur un projet avec heures objectif.
7. Vérifier les alertes de surcharge ou d'absence.
8. Contrôler le tableau de bord RH société.
9. Exécuter les tests backend et le build frontend.
