# Plateforme LBH — Bureau d'Études Économiste

Plateforme web complète pour l'économie de la construction, le dimensionnement voirie, la gestion de projets BTP/VRD, les métrés, le chiffrage, la rédaction de pièces écrites et le suivi d'exécution.

---

## Présentation

La Plateforme LBH est une solution métier complète destinée aux :
- Bureaux d'études économiques
- Maîtres d'ouvrage publics et privés
- Maîtres d'œuvre
- Économistes de la construction
- Entreprises BTP et VRD
- Conducteurs de travaux et chargés d'affaires

Tout s'organise autour du **projet** : documents, plans, métrés, calculs, prix, pièces écrites, mails, tâches, validations, suivi financier et archivage.

---

## Architecture technique

| Composant | Technologie | Version |
|---|---|---|
| Interface | Next.js + TypeScript | 15+ |
| Cœur applicatif | Django + DRF | 5.x |
| Services spécialisés | FastAPI | 0.115+ |
| Base de données | PostgreSQL + PostGIS | 16 + 3.4 |
| File d'attente | Redis | 7 |
| Traitements asynchrones | Celery | 5.x |
| Stockage objet | MinIO | dernière stable |
| Analyse OCR | Tesseract 5 + pytesseract | 5.x |
| Analyse PDF | PyMuPDF + pdfplumber | dernières stables |
| Analyse DXF | ezdxf | 1.x |
| Conteneurisation | Docker Compose | v2 |
| Proxy interne | Nginx | alpine |
| Proxy externe | Plesk Nginx | — |

---

## Modules

| Module | Description | Phase |
|---|---|---|
| Site public | Présentation, références, contact, devis | 1 |
| Authentification | Connexion, profils, droits RBAC | 1 |
| Projets / Affaires | Gestion complète des missions | 1 |
| Fonctionnalités activables | Activation/désactivation par module | 1 |
| Gestion documentaire | Dépôt, classement, versionnement, recherche | 2 |
| Analyse OCR | Texte natif, scan, tableaux, zones | 2 |
| Analyse PDF | Clauses, montants, dates, prescriptions | 2 |
| Analyse DWG/DXF | Calques, textes, surfaces, longueurs | 2 |
| Métrés et quantitatifs | Manuels, semi-auto, auto assistés | 2 |
| Bibliothèque de prix | Référentiel multi-niveaux | 2 |
| Économie de la construction | DS, DU, DR, prix de vente, marges | 3 |
| Analyse de rentabilité | Par ligne, lot, affaire, variante | 3 |
| Graphiques et visualisations | Coûts, marges, écarts, sensibilités | 3 |
| Simulation et variantes | Comparaison de scénarios | 3 |
| Indices et actualisation | Révision des prix, index, formules | 3 |
| Dimensionnement voirie | Trafic, structures, variantes, notes | 4 |
| Pré-dimensionnement bâtiment | Fondations, dallages, maçonnerie | 4 |
| Pièces écrites | Modèles, fusion, CCTP, OS, PV | 2-4 |
| Appels d'offres | Lecture dossier, checklist, réponse | 5 |
| Suivi d'exécution | OS, CR, situations, réceptions | 5 |
| Webmail intégré | Lecture, rédaction, rattachement projet | 5 |
| Supervision | Serveur, conteneurs, journaux, alertes | 5 |
| Centre de mise à jour | Git, SSH, simulation, sauvegarde, retour | 5 |

---

## Installation

### Prérequis
- Serveur Debian 12
- Docker 20.10+ et Docker Compose v2
- Plesk Obsidian
- 8 Go RAM minimum (16 Go recommandés)
- 100 Go disque minimum

### Installation guidée par navigateur

L'installateur par navigateur est disponible après la première construction :

```bash
cd /var/www/vhosts/lbh-economiste.com/httpdocs
docker compose -f compose.installateur.yaml up
```

Puis accéder à : `http://[domaine]/installer/`

### Installation manuelle

```bash
# Cloner le dépôt
git clone [url-depot] /var/www/vhosts/lbh-economiste.com/plateforme-lbh

# Configurer les variables d'environnement
cp .env.example .env
# Éditer .env avec les valeurs réelles

# Construire et démarrer
docker compose build
docker compose up -d

# Migrations de base de données
docker compose exec lbh-backend python manage.py migrate

# Créer le compte administrateur
docker compose exec lbh-backend python manage.py creersuper
```

---

## Configuration Plesk

Ajouter une règle de proxy inverse dans Plesk pour le domaine ou sous-domaine choisi :

```
Location : /
Proxy vers : http://127.0.0.1:3082
```

---

## Structure du répertoire

Voir `docs/architecture/structure-repertoire.md` pour l'arborescence complète.

---

## Documentation

- [Architecture détaillée](docs/architecture/)
- [Guide d'installation](docs/installation/)
- [Documentation métier](docs/metier/)
- [Documentation API](docs/api/)
- [Guide de déploiement](docs/deploiement/)
- [Sécurité](docs/securite/)

---

## Matrices de conception

- [Profils et droits](matrices/profils-droits.md)
- [Modules activables](matrices/modules-activables.md)
- [Variables externalisées](matrices/variables-externalisees.md)
- [Formules de calcul](matrices/calculs.md)
- [Documents générables](matrices/documents-generables.md)
- [Plan de tests](matrices/tests.md)

---

## Licence et confidentialité

Projet propriétaire — Usage interne uniquement.
Toute reproduction ou diffusion sans autorisation est interdite.

---

*Plateforme LBH — Bureau d'Études Économiste*
