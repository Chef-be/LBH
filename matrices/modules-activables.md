# MATRICE DES FONCTIONNALITÉS ACTIVABLES — Plateforme BEE

---

## 1. PRINCIPE DE FONCTIONNEMENT

Chaque fonctionnalité activable peut être :
- **Activée / Désactivée** : au niveau du système (par SUPER_ADMIN)
- **Masquée / Visible** : au niveau d'une organisation, d'un groupe ou d'un utilisateur
- Sans jamais provoquer d'erreur technique ni de cassure visuelle
- Les routes désactivées retournent un 404 propre avec message explicatif

---

## 2. LISTE COMPLÈTE DES FONCTIONNALITÉS ACTIVABLES

| Code | Libellé | Description | Activée par défaut | Niveau de contrôle |
|---|---|---|:---:|---|
| `MODULE_VOIRIE` | Module voirie / VRD | Dimensionnement de chaussée, VRD, drainage | ✓ | Système / Organisation |
| `MODULE_BATIMENT` | Module bâtiment encadré | Pré-dimensionnement, fondations, maçonnerie | ✓ | Système / Organisation |
| `MODULE_OCR` | Analyse OCR | Reconnaissance de caractères sur documents scannés | ✓ | Système |
| `MODULE_ANALYSE_PDF` | Analyse PDF métier | Extraction intelligente de données depuis PDF | ✓ | Système |
| `MODULE_ANALYSE_CAO` | Analyse DWG / DXF | Analyse des plans CAO | ✓ | Système |
| `MODULE_WEBMAIL` | Webmail intégré | Messagerie intégrée avec rattachement aux projets | ✓ | Système / Organisation |
| `MODULE_SUPERVISION` | Supervision système | Supervision des conteneurs et du serveur | ✓ | Système (SUPER_ADMIN) |
| `MODULE_MAJ` | Centre de mise à jour | Gestion des mises à jour Git/SSH | ✓ | Système (SUPER_ADMIN) |
| `MODULE_SITE_PUBLIC` | Site public | Vitrine publique administrable | ✓ | Système |
| `MODULE_APPELS_OFFRES` | Appels d'offres | Assistance à la consultation et aux réponses | ✓ | Système / Organisation |
| `MODULE_EXECUTION` | Suivi d'exécution | Suivi de chantier et maîtrise d'œuvre travaux | ✓ | Système / Organisation |
| `MODULE_PIECES_ECRITES` | Pièces écrites | Génération de documents à partir de modèles | ✓ | Système |
| `MODULE_RENTABILITE` | Analyse de rentabilité | Analyse et simulation de rentabilité | ✓ | Système / Organisation |
| `MODULE_INDICES` | Indices et actualisation | Révision et actualisation des prix | ✓ | Système |
| `MODULE_BIBLIOTHEQUE` | Bibliothèque de prix | Référentiel de prix multi-niveaux | ✓ | Système |
| `FONC_GRAPHIQUES_AVANCES` | Graphiques avancés | Graphiques de sensibilité et simulation | ✓ | Organisation / Profil |
| `FONC_EXPORT_EXCEL` | Export Excel | Export des données en format tableur | ✓ | Organisation |
| `FONC_EXPORT_PDF` | Export PDF | Génération de rapports PDF | ✓ | Organisation |
| `FONC_IMPORT_DWG` | Import DWG | Import des fichiers DWG (requiert ODA Converter) | ✗ | Système |
| `FONC_MULTI_ORGANISATION` | Multi-organisation | Gestion de plusieurs structures | ✓ | Système |
| `FONC_PORTAIL_CLIENT` | Portail client | Accès client limité aux dossiers partagés | ✓ | Organisation |
| `FONC_PORTAIL_PARTENAIRE` | Portail partenaire | Accès partenaire aux lots attribués | ✓ | Organisation |
| `FONC_SIGNATURE_ELECTRONIQUE` | Signature électronique | Signature des documents (intégration externe) | ✗ | Système |
| `FONC_OCR_TABLEAUX` | OCR tableaux | Extraction structurée de tableaux depuis l'OCR | ✓ | Système |
| `FONC_COMPARAISON_PLANS` | Comparaison de plans | Comparaison visuelle de deux versions d'un plan | ✓ | Système |
| `FONC_HISTORIQUE_PRIX` | Historique des prix | Visualisation de l'évolution des prix dans le temps | ✓ | Organisation |
| `FONC_RAPPORT_RENTABILITE_AUTO` | Rapport rentabilité auto | Génération automatique de rapport de rentabilité | ✓ | Organisation |
| `FONC_ALERTES_SMS` | Alertes par SMS | Notifications SMS pour les événements critiques | ✗ | Système |
| `FONC_API_EXTERNE` | API externe | Exposition d'une API REST pour intégrations tierces | ✗ | Système |
| `FONC_SAUVEGARDE_AUTO` | Sauvegarde automatique | Sauvegarde automatique planifiée de la base | ✓ | Système (SUPER_ADMIN) |
| `FONC_PUBLICATION_SITE` | Publication site public | Publication de dossiers terminés sur le site vitrine | ✓ | Organisation |
| `FONC_WATERMARK` | Filigrane documents | Ajout automatique de filigrane sur les exports | ✗ | Organisation |
| `FONC_SIMULATION_QUANTITES` | Simulation quantités | Simulation des variantes de quantités | ✓ | Organisation |

---

## 3. NIVEAUX DE CONTRÔLE

| Niveau | Description | Qui peut modifier |
|---|---|---|
| **Système** | Activation globale pour toute la plateforme | SUPER_ADMIN uniquement |
| **Organisation** | Activation pour une organisation spécifique | SUPER_ADMIN + ADMIN_BUREAU |
| **Groupe** | Activation pour un groupe d'utilisateurs | ADMIN_BUREAU |
| **Utilisateur** | Activation pour un utilisateur spécifique | ADMIN_BUREAU |
| **Profil** | Activation selon le profil de l'utilisateur | SUPER_ADMIN |

---

## 4. COMPORTEMENT EN CAS DE DÉSACTIVATION

### Ce qui est garanti lors d'une désactivation
- Les menus et boutons liés à la fonctionnalité disparaissent proprement.
- Les routes retournent un 404 avec message explicatif : "Cette fonctionnalité n'est pas activée pour votre compte."
- Les données déjà saisies sont conservées intactes (la désactivation n'efface pas les données).
- Les dépendances entre modules sont vérifiées avant désactivation (avertissement si des données dépendantes existent).

### Dépendances critiques
| Module à désactiver | Modules qui en dépendent | Avertissement requis |
|---|---|---|
| `MODULE_OCR` | `MODULE_ANALYSE_PDF` (extraction partielle) | Oui |
| `MODULE_BIBLIOTHEQUE` | `MODULE_VOIRIE`, `MODULE_BATIMENT`, Économie | Oui |
| `MODULE_WEBMAIL` | Aucun | Non |
| `MODULE_EXECUTION` | Ordres de service, comptes rendus | Oui |

---

## 5. AUDIT DES ACTIVATIONS

Chaque modification d'une fonctionnalité activable est journalisée avec :
- Utilisateur ayant effectué la modification
- Date et heure
- Fonctionnalité concernée
- Niveau de contrôle
- Organisation concernée
- Ancienne valeur → Nouvelle valeur
