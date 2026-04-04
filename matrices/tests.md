# MATRICE DES TESTS — Plateforme BEE

---

## 1. STRATÉGIE GÉNÉRALE DE TESTS

### Pyramide des tests
```
        [ Tests d'interface (E2E) ]        ← peu nombreux, parcours critiques
      [ Tests d'intégration ]               ← services, API, base de données
    [ Tests unitaires ]                     ← fonctions, calculs, sérialiseurs
```

### Couverture minimale cible
- Tests unitaires : 80% des fonctions de calcul
- Tests d'intégration : 100% des endpoints API critiques
- Tests d'interface : 17 parcours définis (voir section 5)

---

## 2. TESTS UNITAIRES

### 2.1 Module Calculs Voirie

| Test | Fonction testée | Cas couverts |
|---|---|---|
| `test_trafic_cumule_sans_croissance` | Trafic cumulé | τ=0 |
| `test_trafic_cumule_avec_croissance` | Trafic cumulé | τ>0 |
| `test_trafic_cumule_croissance_negative` | Trafic cumulé | τ<0 |
| `test_classe_trafic_T5` | Classe de trafic | Ne < 0.1 |
| `test_classe_trafic_T0` | Classe de trafic | Ne > 30 |
| `test_portance_ev2_depuis_cbr` | Conversion CBR → EV2 | domaine normal |
| `test_portance_alerte_cbr_faible` | Alerte portance | CBR < min |
| `test_volume_terrassement_simple` | Volume déblai | rectangle |
| `test_volume_couche_chaussee` | Volume couche | épaisseur variable |
| `test_surface_chaussee` | Surface | L et l positifs |
| `test_erreur_duree_negative` | Validation | n < 0 |
| `test_erreur_croissance_excessive` | Validation | τ > 10% |

### 2.2 Module Calculs Économie

| Test | Fonction testée | Cas couverts |
|---|---|---|
| `test_debourse_sec_unitaire` | DSu | cas nominal |
| `test_debourse_sec_total` | DS | quantité positive |
| `test_cout_direct_unitaire` | CDu | avec pertes et frais chantier |
| `test_cout_revient_unitaire` | CRu | avec FG et aléas |
| `test_prix_vente_depuis_taux_marge` | PVu | τ_marge = 8% |
| `test_marge_brute` | MBu, MB | cas nominal |
| `test_marge_nette` | MNu, MN | cas nominal |
| `test_taux_marge_nette` | τMN | cas nominal |
| `test_contribution_lot` | Contribution | part dans le lot |
| `test_dhmo_calcul` | DHMO | équipe standard |
| `test_seuil_rentabilite_quantite` | Q_min | frais fixes non nuls |
| `test_seuil_rentabilite_prix` | PV_min | cas nominal |
| `test_etat_rentable` | État rentabilité | τMN ≥ τ_cible |
| `test_etat_a_surveiller` | État rentabilité | τ_alerte ≤ τMN < τ_cible |
| `test_etat_deficitaire` | État rentabilité | CRu > PVu |
| `test_revision_prix_formule_param` | Révision | formule paramétrique |
| `test_actualisation_prix` | Actualisation | index simple |
| `test_sensibilite_quantite` | IS_Q | variation +/-10% |
| `test_sensibilite_main_oeuvre` | IS_MO | variation +/-10% |
| `test_sensibilite_cout_matiere` | IS_CM | variation +/-10% |

### 2.3 Module Calculs Bâtiment

| Test | Fonction testée | Cas couverts |
|---|---|---|
| `test_largeur_semelle_filante` | B_min | sol normal |
| `test_largeur_semelle_alerte_faible` | B_min | sol faible → alerte |
| `test_profondeur_ancrage` | D | zone climatique standard |
| `test_epaisseur_dallage` | e | charge normale |
| `test_dallage_alerte_charge_excessive` | e | charge > seuil → alerte |
| `test_contrainte_mur_maconnerie` | σ | mur courant |
| `test_elancement_mur_alerte` | H/t | H/t > 20 → alerte |

### 2.4 Module Gestion Documentaire

| Test | Fonction testée | Cas couverts |
|---|---|---|
| `test_normalisation_nom_fichier` | Normalisation | caractères spéciaux |
| `test_detection_type_document` | Détection | CCTP, DPGF, plan |
| `test_versionnement` | Versionneur | v1 → v2 |
| `test_indexation` | Indexation | mots-clés extraits |

### 2.5 Module Permissions

| Test | Fonction testée | Cas couverts |
|---|---|---|
| `test_permission_profil_economiste` | Droits profil | accès autorisé |
| `test_permission_profil_client` | Droits profil | accès refusé |
| `test_permission_individuelle_surcharge` | Droit individuel | surcharge profil |
| `test_module_desactive` | Fonctionnalité activable | module désactivé → 404 |
| `test_module_reactive` | Fonctionnalité activable | module réactivé |

---

## 3. TESTS D'INTÉGRATION

### 3.1 API — Authentification

| Test | Méthode | Route | Assertions |
|---|---|---|---|
| `test_connexion_valide` | POST | `/api/auth/connexion/` | 200, token retourné |
| `test_connexion_invalide` | POST | `/api/auth/connexion/` | 401 |
| `test_deconnexion` | POST | `/api/auth/deconnexion/` | 200 |
| `test_rafraichissement_token` | POST | `/api/auth/rafraichir/` | 200, nouveau token |
| `test_verrouillage_apres_echecs` | POST | `/api/auth/connexion/` | 5 échecs → 429 |

### 3.2 API — Projets

| Test | Méthode | Route | Assertions |
|---|---|---|---|
| `test_creer_projet` | POST | `/api/projets/` | 201, id retourné |
| `test_lister_projets` | GET | `/api/projets/` | 200, liste filtrée |
| `test_lire_projet` | GET | `/api/projets/{id}/` | 200 ou 404 |
| `test_modifier_projet` | PATCH | `/api/projets/{id}/` | 200 |
| `test_archiver_projet` | POST | `/api/projets/{id}/archiver/` | 200 |
| `test_isolation_organisation` | GET | `/api/projets/` | projets autres orgs absents |

### 3.3 API — Documents

| Test | Méthode | Route | Assertions |
|---|---|---|---|
| `test_depot_document` | POST | `/api/documents/` | 201, fichier dans MinIO |
| `test_lister_documents` | GET | `/api/documents/` | 200 |
| `test_telecharger_document` | GET | `/api/documents/{id}/telecharger/` | 200, contenu correct |
| `test_versionnement_document` | POST | `/api/documents/{id}/nouvelle-version/` | 201 |

### 3.4 API — Calculs Rentabilité

| Test | Méthode | Route | Assertions |
|---|---|---|---|
| `test_analyse_rentabilite_lot` | POST | `/api/rentabilite/analyser/` | 200, résultat complet |
| `test_simulation_variation` | POST | `/api/rentabilite/simuler/` | 200, variante calculée |
| `test_explication_non_rentabilite` | GET | `/api/rentabilite/{id}/expliquer/` | 200, causes listées |

### 3.5 Celery — Tâches asynchrones

| Test | Tâche | Assertions |
|---|---|---|
| `test_tache_ocr_image` | `traiter_ocr` | Résultat dans Redis |
| `test_tache_analyse_pdf` | `analyser_pdf` | Données extraites |
| `test_tache_sauvegarde` | `sauvegarder_base` | Fichier créé |

---

## 4. TESTS DE SÉCURITÉ

| Test | Description |
|---|---|
| `test_csrf_protection` | Vérifier que les endpoints POST nécessitent un token CSRF |
| `test_injection_sql` | Soumettre des chaînes SQL dans les paramètres |
| `test_xss_entrees` | Soumettre des balises HTML/JS dans les champs texte |
| `test_upload_fichier_malveillant` | Tenter d'uploader un .php, .exe, .sh |
| `test_acces_sans_authentification` | Accéder aux routes protégées sans token |
| `test_acces_mauvais_role` | Accéder à un endpoint avec un profil insuffisant |
| `test_force_brute_connexion` | Vérifier le rate limiting sur la connexion |
| `test_token_expire` | Utiliser un token expiré |

---

## 5. TESTS D'INTERFACE — PARCOURS UTILISATEURS

### Environnement de test d'interface
- Outil : Playwright (Node.js)
- Navigateurs : Chromium (principal), Firefox, WebKit
- Mode : sans interface graphique (headless) en CI/CD
- Données de test : base de données dédiée aux tests

### Parcours 01 — Ouverture de l'accueil public
```
Ouvrir /
Vérifier : titre de la page, menu de navigation, section prestations
Vérifier : absence de données confidentielles
Vérifier : liens de navigation fonctionnels
```

### Parcours 02 — Navigation publique complète
```
Naviguer : /, /prestations, /realisations, /contact, /devis
Vérifier : chaque page se charge sans erreur
Vérifier : formulaire de contact accessible
```

### Parcours 03 — Connexion administrateur
```
Ouvrir /connexion
Saisir identifiants administrateur
Cliquer : Se connecter
Vérifier : redirection vers /tableau-de-bord
Vérifier : menu complet visible
Vérifier : nom de l'utilisateur affiché
```

### Parcours 04 — Création d'un projet
```
Aller sur /projets/nouveau
Saisir : référence, intitulé, maître d'ouvrage, type, dates
Cliquer : Enregistrer
Vérifier : confirmation de création
Vérifier : projet visible dans la liste
Vérifier : numéro de projet attribué automatiquement
```

### Parcours 05 — Dépôt d'un document
```
Ouvrir un projet existant
Aller sur Gestion documentaire
Cliquer : Déposer un document
Sélectionner un fichier PDF
Vérifier : upload en cours, barre de progression
Vérifier : document visible avec nom normalisé
Vérifier : métadonnées enregistrées
```

### Parcours 06 — Analyse OCR
```
Sélectionner un document scanné (image/PDF scan)
Cliquer : Lancer l'analyse OCR
Vérifier : tâche soumise, indicateur de traitement
Attendre : résultat (max 60s)
Vérifier : texte extrait visible
Vérifier : score de confiance affiché
```

### Parcours 07 — Création d'une ligne de prix
```
Aller dans un projet → Économie → Bibliothèque
Cliquer : Nouvelle ligne
Saisir : code, désignation, unité, déboursé sec
Saisir : taux (frais chantier, FG, aléas, marge)
Vérifier : calcul automatique du prix de vente
Vérifier : ligne enregistrée dans la bibliothèque
```

### Parcours 08 — Analyse de rentabilité
```
Aller dans un projet → Analyse de rentabilité
Cliquer : Analyser la rentabilité
Vérifier : résultat par lot affiché
Vérifier : code couleur des états (vert/orange/rouge)
Cliquer : Expliquer le résultat sur une ligne non rentable
Vérifier : causes listées et compréhensibles
Cliquer : Simuler une variation (ex: +10% quantité)
Vérifier : résultat simulé affiché correctement
```

### Parcours 09 — Affichage des graphiques
```
Aller dans un projet → Graphiques
Vérifier : graphique de répartition des coûts par lot
Vérifier : graphique de marges
Vérifier : filtres fonctionnels (par lot, par période)
Cliquer : Exporter le graphique
Vérifier : fichier PNG ou PDF téléchargé
```

### Parcours 10 — Génération d'un document
```
Aller dans Pièces écrites → Nouveau document
Sélectionner un modèle (ex: CCTP standard)
Vérifier : variables pré-remplies depuis le projet
Modifier une clause
Cliquer : Générer le document Word
Vérifier : fichier .docx téléchargé
Vérifier : variables fusionnées correctement
```

### Parcours 11 — Envoi d'un courriel avec pièce jointe
```
Aller dans Webmail
Cliquer : Nouveau message
Saisir destinataire, objet, corps
Joindre un fichier depuis les documents du projet
Cliquer : Envoyer
Vérifier : message dans Envoyés
Vérifier : courriel rattaché au projet
```

### Parcours 12 — Désactivation d'une fonctionnalité
```
Aller dans Paramètres → Fonctionnalités activables
Désactiver le module Voirie
Vérifier : confirmation demandée
Confirmer
Vérifier : menu Voirie disparu
Vérifier : accès direct à /voirie retourne 404 propre
Vérifier : aucune erreur dans les autres modules
```

### Parcours 13 — Vérification du masquage propre
```
(Suite du parcours 12)
Se déconnecter et se reconnecter
Vérifier : module Voirie toujours masqué
Réactiver le module Voirie
Vérifier : module visible à nouveau
```

### Parcours 14 — Consultation de la supervision
```
Se connecter en tant que SUPER_ADMIN
Aller dans /supervision
Vérifier : état de tous les conteneurs affiché
Vérifier : métriques CPU, mémoire, disque
Vérifier : journaux récents accessibles
Vérifier : aucune fuite de données sensibles dans les journaux
```

### Parcours 15 — Test de connectivité SSH (Centre de mise à jour)
```
Aller dans /centre-de-mise-a-jour
Cliquer : Tester la connectivité SSH
Vérifier : résultat du test affiché
Cliquer : Tester Git (dépôt configuré)
Vérifier : dernière version disponible affichée
```

### Parcours 16 — Simulation d'une mise à jour
```
Aller dans /centre-de-mise-a-jour
Cliquer : Simulation sans exécution
Vérifier : résumé des modifications à appliquer
Vérifier : aucune modification réelle effectuée
Vérifier : rapport de simulation lisible
```

### Parcours 17 — Déconnexion
```
Cliquer : Déconnexion (menu utilisateur)
Vérifier : redirection vers /connexion
Vérifier : accès à /tableau-de-bord refusé (401)
Vérifier : token invalidé côté serveur
```

---

## 6. TESTS DE CALCUL (TESTS NUMÉRIQUES)

Chaque formule de la matrice `calculs.md` doit avoir un test avec :
- Valeur attendue précise (arrondie à 2 décimales)
- Jeu de données de référence documenté
- Cas limites (valeurs min/max du domaine)
- Cas d'erreur (valeurs hors domaine)

Les résultats de référence sont stockés dans `tests/calculs/jeux-de-reference/`.

---

## 7. TESTS D'INSTALLATION

| Test | Description |
|---|---|
| `test_installateur_accessible` | L'installateur par navigateur répond |
| `test_detection_ports_libres` | Ports suggérés sont réellement libres |
| `test_generation_dotenv` | Fichier .env généré correctement |
| `test_generation_secrets` | Secrets générés aléatoirement |
| `test_lancement_conteneurs` | Tous les conteneurs démarrent |
| `test_creation_admin` | Compte administrateur créé |
| `test_verrouillage_apres_install` | Installateur inaccessible après installation |
| `test_reprise_installation` | Reprise possible après échec partiel |

---

## 8. EXÉCUTION DES TESTS

```bash
# Tests unitaires Python
docker compose exec bee-backend pytest tests/unitaires/ -v

# Tests d'intégration Python
docker compose exec bee-backend pytest tests/integration/ -v

# Tests de calcul
docker compose exec bee-backend pytest tests/calculs/ -v

# Tests d'interface (Playwright)
cd tests/interface && npx playwright test

# Tous les tests
docker compose exec bee-backend pytest -v && npx playwright test

# Rapport de couverture
docker compose exec bee-backend pytest --cov=applications --cov-report=html
```
