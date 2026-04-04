# PLAN DE TRAVAIL PAR PHASES — Plateforme LBH

---

## PHASE 1 — Infrastructure, base et accueil (PRIORITÉ MAXIMALE)

**Objectif :** Avoir une plateforme déployable avec authentification, gestion de projets et accueil public.

### 1.1 Infrastructure Docker
- [x] Fichier `compose.yaml` complet
- [x] Fichier `.env.example` exhaustif
- [x] Configuration Nginx interne
- [x] Configuration Redis
- [x] Script d'initialisation PostgreSQL
- [ ] Création des répertoires de volumes
- [ ] Premier démarrage et vérification de santé

### 1.2 Backend Django — Base
- [ ] Projet Django initialisé (`startproject configuration`)
- [ ] Applications créées (`startapp` pour chaque module)
- [ ] Modèles de base : Organisation, Utilisateur, Profil, Droits
- [ ] Modèle FonctionnaliteActivable
- [ ] Modèle Parametre
- [ ] Système d'authentification (JWT via djangorestframework-simplejwt)
- [ ] API REST de base (authentification, profil, paramètres)
- [ ] Tests unitaires des modèles de base
- [ ] Migrations initiales

### 1.3 Frontend Next.js — Base
- [ ] Projet Next.js initialisé avec TypeScript
- [ ] Configuration ESLint et Prettier
- [ ] Mise en page principale (navigation, pied de page)
- [ ] Page d'accueil public minimale
- [ ] Page de connexion
- [ ] Tableau de bord post-connexion
- [ ] Gestion de l'état d'authentification (NextAuth.js)
- [ ] Routage protégé

### 1.4 Gestion des profils et droits
- [ ] Middleware de contrôle d'accès Django
- [ ] Décorateurs de permission en français
- [ ] Interface de gestion des utilisateurs
- [ ] Interface de gestion des profils
- [ ] Interface de gestion des fonctionnalités activables

### 1.5 Gestion des projets
- [ ] Modèle Projet, Lot, Intervenant, Phase
- [ ] CRUD complet des projets
- [ ] Interface de liste et de détail des projets
- [ ] Filtres et recherche

### 1.6 Site public administrable
- [ ] Modèles : Page, Section, Media, Reference
- [ ] Interface d'administration du contenu
- [ ] Rendu public des pages
- [ ] Formulaire de contact
- [ ] SEO de base (balises meta, sitemap)

**Livrable Phase 1 :** Plateforme déployée, connexion fonctionnelle, premier projet créable.

---

## PHASE 2 — Gestion documentaire, OCR et pièces écrites

**Objectif :** Pouvoir déposer, classer, analyser et utiliser les documents du projet.

### 2.1 Gestion documentaire
- [ ] Modèles : Document, Version, Tag, Famille
- [ ] Dépôt de fichiers vers MinIO
- [ ] Normalisation automatique des noms
- [ ] Versionnement des documents
- [ ] Recherche plein texte (PostgreSQL full-text)
- [ ] Interface de gestion documentaire

### 2.2 Service OCR
- [ ] Dockerfile du service OCR (Tesseract 5 + Python)
- [ ] API FastAPI du service OCR
- [ ] Traitement asynchrone via Celery
- [ ] Extraction de texte, tableaux, zones
- [ ] Score de confiance et correction manuelle
- [ ] Interface de résultat OCR

### 2.3 Analyse PDF
- [ ] Service d'analyse PDF (PyMuPDF + pdfplumber)
- [ ] Extraction : dates, montants, clauses, obligations
- [ ] Rattachement des extractions au projet

### 2.4 Analyse DWG / DXF
- [ ] Service d'analyse DXF (ezdxf)
- [ ] Extraction : calques, textes, surfaces, longueurs, comptages
- [ ] Note sur la limitation DWG (format propriétaire)

### 2.5 Bibliothèque de prix — Base
- [ ] Modèle LignePrix avec tous les attributs
- [ ] Niveaux de prix (référence, territoire, affaire...)
- [ ] Interface de saisie et de recherche
- [ ] Import/export de bibliothèque (XLSX)

### 2.6 Pièces écrites — Base
- [ ] Modèles : ModeleDocument, VariableFusion
- [ ] Moteur de fusion (python-docx)
- [ ] Interface de gestion des modèles
- [ ] Génération DOCX et PDF

**Livrable Phase 2 :** Dépôt, OCR, analyse et génération de documents opérationnels.

---

## PHASE 3 — Économie complète, rentabilité et graphiques

**Objectif :** Le cœur économique de la plateforme est opérationnel.

### 3.1 Métrés et quantitatifs
- [ ] Saisie manuelle des métrés
- [ ] Formules de base (surfaces, volumes, linéaires)
- [ ] Traçabilité des sources
- [ ] Variantes de métrés

### 3.2 Économie de la construction
- [ ] Modèles : EtudeEconomique, Lot, LignePrixAffaire
- [ ] Calcul DSu, CDu, CRu, PVu
- [ ] Calcul DHMO
- [ ] DQE, DPGF, BPU
- [ ] Import depuis bibliothèque de prix

### 3.3 Analyse de rentabilité
- [ ] Calcul des marges par ligne, lot, affaire
- [ ] États de rentabilité avec codes couleur
- [ ] Explication automatique des causes de non-rentabilité
- [ ] Seuils critiques (quantité, prix, temps)
- [ ] Boutons : Analyser, Simuler, Expliquer, Comparer

### 3.4 Graphiques et visualisations
- [ ] Choix de la bibliothèque (Recharts ou Chart.js)
- [ ] Graphiques de répartition des coûts
- [ ] Graphiques de marges et rentabilité
- [ ] Graphiques de sensibilité
- [ ] Filtres et exports (PNG, PDF)

### 3.5 Simulation et variantes
- [ ] Moteur de simulation de variantes
- [ ] Comparaison de scénarios
- [ ] Seuil de basculement entre variantes

### 3.6 Indices et actualisation
- [ ] Modèles : Index, FormulaRevision, Coefficient
- [ ] Recalcul par ligne, lot, affaire
- [ ] Comparaison avant/après actualisation

**Livrable Phase 3 :** Analyse économique complète avec rentabilité et graphiques.

---

## PHASE 4 — Modules techniques voirie et bâtiment

### 4.1 Dimensionnement voirie
- [ ] Saisie des données trafic et portance
- [ ] Calcul du trafic cumulé (géométrique et arithmétique)
- [ ] Calcul des essieux équivalents
- [ ] Sélection de la structure de chaussée
- [ ] Variantes de structures
- [ ] Génération de la note technique de dimensionnement

### 4.2 Pré-dimensionnement bâtiment
- [ ] Saisie des hypothèses (sol, charges, géométrie)
- [ ] Calcul fondations superficielles
- [ ] Calcul dallages
- [ ] Vérification maçonnerie portante
- [ ] Alertes de domaine de validité
- [ ] Génération de la note de pré-dimensionnement

### 4.3 Quantitatifs voirie et bâtiment
- [ ] Formules de métrés spécialisés
- [ ] Liaisons avec les modules de dimensionnement

**Livrable Phase 4 :** Modules techniques voirie et bâtiment opérationnels.

---

## PHASE 5 — Modules complets, intégrations et exploitation

### 5.1 Appels d'offres
- [ ] Import et analyse du dossier de consultation
- [ ] Checklist de conformité
- [ ] Vérification des pièces manquantes
- [ ] Aide à la rédaction du mémoire technique
- [ ] Interface de réponse à AO

### 5.2 Suivi d'exécution
- [ ] Ordres de service (créer, valider, notifier)
- [ ] Comptes rendus de chantier
- [ ] Situations de travaux
- [ ] Attachements et décomptes
- [ ] Réceptions et réserves
- [ ] Tableau de bord d'exécution

### 5.3 Webmail intégré
- [ ] Connexion IMAP/SMTP
- [ ] Interface de lecture et rédaction
- [ ] Rattachement automatique aux projets
- [ ] Modèles de courriels

### 5.4 Supervision
- [ ] Métriques des conteneurs (via API Docker)
- [ ] Métriques serveur (CPU, RAM, disque)
- [ ] Vue des journaux applicatifs
- [ ] Alertes configurables
- [ ] Interface de terminal pour opérations ciblées

### 5.5 Centre de mise à jour
- [ ] Test de connectivité SSH et Git
- [ ] Simulation sans exécution
- [ ] Sauvegarde avant mise à jour
- [ ] Construction, migration, redémarrage
- [ ] Vérification post-mise à jour
- [ ] Retour arrière automatisé

**Livrable Phase 5 :** Plateforme complète avec tous les modules fonctionnels.

---

## PHASE 6 — Optimisation, sécurité et production

### 6.1 Durcissement sécurité
- [ ] Audit de sécurité complet
- [ ] En-têtes HTTP de sécurité
- [ ] Rate limiting sur tous les endpoints
- [ ] Chiffrement des données sensibles en base
- [ ] Revue des permissions

### 6.2 Optimisation des performances
- [ ] Cache Redis pour les requêtes fréquentes
- [ ] Pagination des grandes listes
- [ ] Index de base de données optimisés
- [ ] Compression des réponses API
- [ ] Optimisation des images et assets

### 6.3 Tests complets
- [ ] Exécution de tous les tests unitaires
- [ ] Exécution de tous les tests d'intégration
- [ ] Exécution des 17 parcours d'interface
- [ ] Tests de charge
- [ ] Tests de sécurité

### 6.4 Documentation finale
- [ ] Documentation d'installation complète
- [ ] Guide d'administration
- [ ] Guide utilisateur par profil
- [ ] Documentation API
- [ ] Guide de maintenance

### 6.5 Installateur par navigateur
- [ ] Interface d'installation étape par étape
- [ ] Détection des prérequis
- [ ] Génération du fichier .env
- [ ] Lancement et vérification
- [ ] Verrouillage post-installation

**Livrable Phase 6 :** Plateforme prête pour la production.

---

## PRIORITÉS IMMÉDIATES (démarrage Phase 1)

1. Créer les répertoires de volumes Docker
2. Initialiser le projet Django
3. Initialiser le projet Next.js
4. Construire les images Docker de base
5. Premier `docker compose up` et vérification
6. Modèles de base et migrations
7. Authentification JWT fonctionnelle
8. Page de connexion et tableau de bord

---

## DÉCISIONS D'ARCHITECTURE EN ATTENTE

| Décision | Options | Recommandation |
|---|---|---|
| Bibliothèque de graphiques | Recharts, Chart.js, Visx | Recharts (React-natif, maintenable) |
| Éditeur de texte riche | Tiptap, Quill, Lexical | Tiptap (extensible, moderne) |
| Gestion d'état frontend | Zustand, Jotai, Redux | Zustand (léger, simple) |
| Gestion des données serveur | React Query / TanStack Query | TanStack Query v5 |
| Export PDF | WeasyPrint, LibreOffice, Puppeteer | LibreOffice (qualité DOCX→PDF) |
| Analyse DWG | ODA Converter, LibreCAD | ODA Converter si disponible, sinon DXF seul |
