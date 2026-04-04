# Rapport d'avancement — 2026-04-02

## Objet

Ce document sert de point de reprise opérationnel pour la plateforme LBH.

## État global

La plateforme a fortement évolué sur les volets suivants :

- refonte des paramètres avec système d'onglets ;
- intégration de la messagerie et du webmail ;
- invitations utilisateurs, activation de compte, réinitialisation de mot de passe, édition du profil ;
- journal des e-mails ;
- enrichissement important du module documentaire ;
- import et analyse d'archives ZIP ;
- enrichissement de la bibliothèque de prix ;
- simulateur avancé de coût main-d'oeuvre et de pilotage d'activité ;
- modèles documentaires métier et éditeur enrichi ;
- planning chantier/Gantt avec recalcul automatique, chemin critique et exports.

## Lots validés récemment

### Messagerie et comptes

- `Paramètres` réorganisé avec onglets, dont `Messagerie`.
- Webmail intégré côté plateforme.
- Invitations par e-mail avec création de compte après validation de l'adresse.
- Réinitialisation de mot de passe oublié depuis la page de connexion.
- Édition du profil utilisateur et du mot de passe.
- Journal des e-mails réservé au super-admin.
- Améliorations du rendu webmail :
  - décodage correct des objets MIME ;
  - affichage HTML corrigé ;
  - libellés de dossiers au lieu des noms IMAP techniques ;
  - meilleure gestion des pièces jointes ;
  - éditeur enrichi plus complet.

### Documents, ressources, automatisation

- Analyse automatique des documents téléversés.
- Exploitation des services OCR, analyse PDF et analyse CAO selon le type de fichier.
- Import d'archives ZIP avec extraction, analyse, création des documents et classement.
- Suggestions de reclassement par projet et par type de document.
- Prévisualisation et validation avant reclassement en masse.
- Lecture des PDF du partage Samba `admin/ressources`, renommage métier des fichiers et synthèse documentaire.

### Pièces écrites

- Modèles documentaires enrichis.
- Variables de fusion éditables.
- Éditeur visuel enrichi pour les modèles.
- Génération de :
  - CCTP ;
  - lettre de candidature ;
  - mémoire technique ;
  - planning de tâches ;
  - rapport d'analyse.
- Exports `DOCX` et `PDF`.

### Économie, bibliothèque de prix et main-d'oeuvre

- Bibliothèque de prix enrichie avec données analytiques.
- Import massif de bordereaux de prix.
- Simulateur de coût main-d'oeuvre :
  - taux horaire ;
  - taux journalier ;
  - coût employeur ;
  - coefficient `K` détaillé ;
  - variantes conventionnelles ;
  - référentiels territoriaux ;
  - prise en compte des spécificités de Mayotte sans bloquer le système sur ce territoire.
- Outil de pilotage d'activité et de recrutement.

### Métré

- Saisie par formules.
- Variables intermédiaires.
- Calcul détaillé et restitué à l'utilisateur.

### Exécution et planning chantier

- Génération de tâches depuis étude économique / DPGF ou étude de prix.
- Affectation d'équipes par tâche.
- Calcul de durée selon quantité, temps unitaire, effectif et rendement.
- Gestion des dépendances entre tâches.
- Chemin critique automatique.
- Prise en compte des décalages.
- Calendrier ouvré paramétrable.
- Lissage des ressources partagées.
- Exports planning :
  - `XLSX`
  - `PDF`
  - archive

## Vérifications validées

Contrôles confirmés sur l'état actuel :

- `python3 -m py_compile` sur les fichiers backend récemment touchés : OK
- `docker exec lbh-backend python manage.py migrate` : OK
- `docker exec lbh-backend python manage.py check` : OK
- `docker exec lbh-backend python manage.py test --keepdb applications.execution.tests applications.economie.tests` : OK
- `curl -I http://127.0.0.1:3082/api/sante/` : `200`
- `curl -I http://127.0.0.1:3082/projets` : `200`
- conteneurs `lbh-backend`, `lbh-frontend`, `lbh-nginx` : sains

## Point technique important

L'export PDF du planning utilise WeasyPrint quand la pile native est disponible. Un mode de secours PDF a aussi été ajouté en Python pour ne pas bloquer l'export tant que la pile graphique native n'est pas entièrement reconstruite dans l'image backend.

## Fichiers centraux à relire pour reprendre

### Planning chantier

- `backend/applications/execution/services.py`
- `backend/applications/execution/views.py`
- `backend/applications/execution/models.py`
- `backend/applications/execution/serialiseurs.py`
- `backend/applications/execution/tests.py`
- `frontend/src/composants/execution/SuiviExecutionProjet.tsx`

### Économie et main-d'oeuvre

- `backend/applications/economie/services.py`
- `backend/applications/economie/models.py`
- `backend/applications/economie/views.py`
- `frontend/src/app/(espace-prive)/economie/simulateur-main-oeuvre/page.tsx`
- `frontend/src/app/(espace-prive)/economie/pilotage-activite/page.tsx`

### Pièces écrites

- `backend/applications/pieces_ecrites/services.py`
- `backend/applications/pieces_ecrites/models.py`
- `frontend/src/composants/ui/EditeurTexteRiche.tsx`
- `frontend/src/app/(espace-prive)/administration/modeles-documents/page.tsx`

### Documents

- `backend/applications/documents/services.py`
- `backend/applications/documents/views.py`
- `frontend/src/composants/documents/ListeDocumentsGlobale.tsx`
- `docs/metier/synthese-ressources-samba.md`

## Points ouverts / suite logique

- finaliser si besoin le rebuild backend complet avec pile native WeasyPrint ;
- approfondir les dépendances avancées de planning si besoin métier supplémentaire ;
- continuer la professionnalisation OPC / exécution ;
- poursuivre l'industrialisation des processus par type de clientèle ;
- affiner encore la bibliothèque de prix et les automatisations d'analyse.

## Reprise recommandée

Pour reprendre efficacement :

1. lire ce rapport ;
2. relire les dernières décisions d'architecture et de déploiement déjà consignées dans le dépôt ;
3. lire `docs/metier/synthese-ressources-samba.md` ;
4. relire les fichiers centraux du module visé avant nouvelle implémentation.
