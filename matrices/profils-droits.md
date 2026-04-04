# MATRICE DES PROFILS ET DROITS — Plateforme LBH

---

## 1. PROFILS DISPONIBLES

| Code profil | Libellé | Description |
|---|---|---|
| `SUPER_ADMIN` | Administrateur système | Accès total à tous les modules, y compris la supervision et le centre de mise à jour |
| `ADMIN_BUREAU` | Administrateur du bureau | Accès total au métier, gestion des utilisateurs de son organisation |
| `DIRECTEUR_TECH` | Directeur technique | Accès en lecture/écriture à tous les projets, validation finale |
| `ECONOMISTE_SR` | Économiste senior | Accès complet aux modules économie, métrés, rentabilité, bibliothèque |
| `ECONOMISTE_JR` | Économiste junior | Accès en lecture, saisie sous validation, pas de suppression |
| `CHARGE_AFFAIRES` | Chargé d'affaires | Accès aux affaires qui lui sont attribuées, appels d'offres, suivi |
| `CONDUCTEUR_TRAVAUX` | Conducteur de travaux | Accès au suivi d'exécution, ordres de service, comptes rendus |
| `REDACTEUR_TECH` | Rédacteur technique | Accès aux pièces écrites, modèles, génération de documents |
| `CLIENT` | Client / Maître d'ouvrage | Accès en lecture aux dossiers qui lui sont partagés |
| `PARTENAIRE` | Partenaire / Co-traitant | Accès limité aux lots qui lui sont attribués |
| `SOUS_TRAITANT` | Sous-traitant | Accès très limité aux documents de sa mission |
| `LECTURE_SEULE` | Visiteur | Lecture seule sur les projets autorisés |

---

## 2. MATRICE DES DROITS PAR MODULE

### Légende
- `A` : Accès complet (Créer, Lire, Modifier, Supprimer, Valider)
- `E` : Écriture (Créer, Lire, Modifier)
- `V` : Validation (Lire, Valider)
- `L` : Lecture seule
- `S` : Accès sur son périmètre attribué uniquement
- `-` : Aucun accès

| Module | SUPER_ADMIN | ADMIN_BUREAU | DIRECTEUR_TECH | ECONOMISTE_SR | ECONOMISTE_JR | CHARGE_AFFAIRES | CONDUCTEUR_TRAVAUX | REDACTEUR_TECH | CLIENT | PARTENAIRE | SOUS_TRAITANT |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Utilisateurs** | A | A | L | - | - | - | - | - | - | - | - |
| **Organisations** | A | A | L | L | - | L | - | - | - | - | - |
| **Profils et droits** | A | A | - | - | - | - | - | - | - | - | - |
| **Fonctionnalités activables** | A | A | - | - | - | - | - | - | - | - | - |
| **Paramètres système** | A | A | - | - | - | - | - | - | - | - | - |
| **Site public** | A | A | L | - | - | - | - | E | - | - | - |
| **Projets (tous)** | A | A | A | A | S | S | S | S | S | S | S |
| **Projets (création)** | A | A | A | A | - | A | - | - | - | - | - |
| **Documents** | A | A | A | A | E | E | E | E | L | L | L |
| **OCR** | A | A | A | A | E | - | - | - | - | - | - |
| **Analyse PDF** | A | A | A | A | E | E | - | - | - | - | - |
| **Analyse DWG/DXF** | A | A | A | A | E | - | - | - | - | - | - |
| **Métrés** | A | A | A | A | E | L | - | - | - | - | - |
| **Bibliothèque de prix** | A | A | A | A | E | L | - | - | - | - | - |
| **Économie** | A | A | A | A | E | L | - | - | - | - | - |
| **Rentabilité** | A | A | A | A | L | L | - | - | - | - | - |
| **Graphiques** | A | A | A | A | A | A | L | - | L | - | - |
| **Simulation variantes** | A | A | A | A | E | - | - | - | - | - | - |
| **Indices actualisation** | A | A | A | A | L | - | - | - | - | - | - |
| **Voirie** | A | A | A | A | E | L | - | - | - | - | - |
| **Bâtiment encadré** | A | A | A | A | E | L | - | - | - | - | - |
| **Pièces écrites** | A | A | A | A | E | E | E | A | L | - | - |
| **Modèles de documents** | A | A | A | A | L | - | - | A | - | - | - |
| **Appels d'offres** | A | A | A | A | E | A | - | E | - | - | - |
| **Suivi d'exécution** | A | A | A | A | L | A | A | - | L | L | L |
| **Ordres de service** | A | A | V | A | L | A | E | - | L | - | - |
| **Comptes rendus** | A | A | A | A | E | A | A | - | L | L | - |
| **Webmail** | A | A | A | A | A | A | A | A | - | - | - |
| **Supervision** | A | A | - | - | - | - | - | - | - | - | - |
| **Centre de mise à jour** | A | - | - | - | - | - | - | - | - | - | - |

---

## 3. DROITS FINS PAR ACTION (EXEMPLES)

### Module Projets

| Action | SUPER_ADMIN | ADMIN_BUREAU | DIRECTEUR_TECH | ECONOMISTE_SR | ECONOMISTE_JR | CHARGE_AFFAIRES |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Créer un projet | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ |
| Modifier statut projet | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ |
| Archiver un projet | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| Supprimer un projet | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Affecter des intervenants | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ |
| Voir tous les projets | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| Voir ses projets | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Exporter un dossier | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ |
| Publier sur le site public | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |

### Module Économie

| Action | ECONOMISTE_SR | ECONOMISTE_JR | CHARGE_AFFAIRES | CONDUCTEUR_TRAVAUX |
|---|:---:|:---:|:---:|:---:|
| Créer une ligne de prix | ✓ | ✓ | ✗ | ✗ |
| Modifier un prix | ✓ | ✓ sous validation | ✗ | ✗ |
| Valider un prix | ✓ | ✗ | ✗ | ✗ |
| Supprimer une ligne | ✓ | ✗ | ✗ | ✗ |
| Lancer analyse rentabilité | ✓ | ✗ | ✓ lecture résult. | ✗ |
| Simuler une variante | ✓ | ✗ | ✗ | ✗ |
| Accéder aux marges | ✓ | ✗ | ✗ | ✗ |
| Exporter DQE/BPU/DPGF | ✓ | ✓ | ✓ | ✗ |

---

## 4. DROITS PAR ORGANISATION

Chaque droit est par défaut limité à l'organisation de l'utilisateur.
Un administrateur peut étendre l'accès à d'autres organisations explicitement.

| Niveau d'accès | Description |
|---|---|
| Organisation propre | Accès par défaut à son organisation |
| Inter-organisations | Accordé explicitement par SUPER_ADMIN |
| Accès client | Accordé projet par projet via partage |
| Accès partenaire | Accordé lot par lot via groupement |

---

## 5. DROITS INDIVIDUELS (SURCHARGE)

Les droits individuels peuvent surcharger (en plus ou en moins) les droits du profil :
- Ajouter un droit spécifique à un utilisateur sans changer son profil.
- Retirer un droit spécifique à un utilisateur sans changer son profil.
- Valable pour un projet ou un document spécifique.

Priorité de résolution :
1. Droits individuels explicites (priorité maximale)
2. Droits du projet (accordés à l'intervenant)
3. Droits du groupe
4. Droits du profil
5. Refus par défaut

---

## 6. PROFILS ET FONCTIONNALITÉS ACTIVABLES

Certains profils ne voient certains modules que s'ils sont activés pour leur organisation.
Voir `matrices/modules-activables.md` pour la liste complète.
