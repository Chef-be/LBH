# MATRICE DES VARIABLES EXTERNALISÉES — Plateforme LBH

Toute valeur métier ou technique susceptible d'évoluer doit être externalisée.
Ces variables sont stockées dans le modèle `Parametre` de la base de données
et éditables par les administrateurs via l'interface de paramétrage.

---

## 1. PARAMÈTRES SYSTÈME

| Clé | Description | Type | Valeur par défaut | Unité |
|---|---|---|---|---|
| `SYS_LANGUE` | Langue de l'interface | Texte | `fr` | — |
| `SYS_FUSEAU_HORAIRE` | Fuseau horaire | Texte | `Europe/Paris` | — |
| `SYS_NOM_APPLICATION` | Nom affiché de l'application | Texte | `Plateforme LBH` | — |
| `SYS_LOGO_URL` | URL du logo | Texte | — | — |
| `SYS_COULEUR_PRINCIPALE` | Couleur principale de l'interface | Texte | `#1e3a5f` | HEX |
| `SYS_TAILLE_MAX_IMPORT` | Taille maximale d'un fichier importé | Entier | `104857600` | octets |
| `SYS_RETENTION_JOURNAUX` | Durée de rétention des journaux | Entier | `30` | jours |
| `SYS_SAUVEGARDE_AUTO` | Activer les sauvegardes automatiques | Booléen | `true` | — |
| `SYS_HEURE_SAUVEGARDE` | Heure quotidienne de sauvegarde | Texte | `02:00` | HH:MM |
| `SYS_CONTACT_ADMIN` | Courriel de l'administrateur système | Texte | — | — |
| `SYS_TENTATIVES_CONNEXION_MAX` | Tentatives avant verrouillage | Entier | `5` | — |
| `SYS_DUREE_VERROUILLAGE` | Durée de verrouillage après échecs | Entier | `1800` | secondes |

---

## 2. PARAMÈTRES OCR

| Clé | Description | Type | Valeur par défaut | Unité |
|---|---|---|---|---|
| `OCR_LANGUES` | Langues Tesseract | Texte | `fra,eng` | — |
| `OCR_DPI_MIN` | DPI minimum accepté | Entier | `150` | dpi |
| `OCR_DPI_OPTIMAL` | DPI optimal pour la qualité | Entier | `300` | dpi |
| `OCR_SEUIL_CONFIANCE` | Seuil de confiance minimum | Décimal | `60.0` | % |
| `OCR_TAILLE_MAX_FICHIER` | Taille max fichier OCR | Entier | `52428800` | octets |
| `OCR_TIMEOUT_TRAITEMENT` | Délai max de traitement | Entier | `300` | secondes |
| `OCR_MODE_PAGE` | Mode de segmentation de page | Entier | `3` | — |

---

## 3. PARAMÈTRES MÉTIER — VOIRIE / VRD

| Clé | Description | Type | Valeur par défaut | Unité |
|---|---|---|---|---|
| `VRD_DUREE_SERVICE_DEFAUT` | Durée de service par défaut | Entier | `20` | années |
| `VRD_TAUX_CROISSANCE_DEFAUT` | Taux de croissance trafic par défaut | Décimal | `2.0` | % |
| `VRD_CAM_FAIBLE` | CAM pour trafic faible | Décimal | `0.5` | — |
| `VRD_CAM_MOYEN` | CAM pour trafic moyen | Décimal | `1.0` | — |
| `VRD_CAM_FORT` | CAM pour trafic fort | Décimal | `2.0` | — |
| `VRD_PORTANCE_CBR_MIN` | CBR minimum sans traitement | Entier | `3` | % |
| `VRD_EV2_PF1_MAX` | EV2 max pour classe PF1 | Décimal | `20.0` | MPa |
| `VRD_EV2_PF2_MAX` | EV2 max pour classe PF2 | Décimal | `50.0` | MPa |
| `VRD_EV2_PF3_MAX` | EV2 max pour classe PF3 | Décimal | `120.0` | MPa |
| `VRD_PROFONDEUR_HORS_GEL` | Profondeur hors gel locale | Décimal | `0.8` | mètres |
| `VRD_TALUS_DEBLAI_DEFAUT` | Pente talus déblai par défaut | Décimal | `1.5` | H/V |
| `VRD_TALUS_REMBLAI_DEFAUT` | Pente talus remblai par défaut | Décimal | `2.0` | H/V |
| `VRD_FOISONNEMENT_DEFAUT` | Coefficient de foisonnement | Décimal | `1.2` | — |
| `VRD_TAUX_COMPACTAGE_DEFAUT` | Taux de compactage remblai | Décimal | `0.9` | — |

---

## 4. PARAMÈTRES MÉTIER — ÉCONOMIE DE LA CONSTRUCTION

| Clé | Description | Type | Valeur par défaut | Unité |
|---|---|---|---|---|
| `ECONO_HEURES_PROD_ANNUELLES` | Heures productives par ouvrier/an | Entier | `1600` | h/an |
| `ECONO_TAUX_CHARGES_SOCIALES` | Coefficient de charges sociales | Décimal | `0.85` | — |
| `ECONO_TAUX_FRAIS_CHANTIER` | Taux de frais de chantier | Décimal | `0.12` | — |
| `ECONO_TAUX_FRAIS_GENERAUX` | Taux de frais généraux | Décimal | `0.10` | — |
| `ECONO_TAUX_ALEAS` | Taux d'aléas | Décimal | `0.03` | — |
| `ECONO_TAUX_MARGE_CIBLE` | Taux de marge cible | Décimal | `0.08` | — |
| `ECONO_TAUX_PERTES` | Taux de pertes matières | Décimal | `0.05` | — |
| `ECONO_SEUIL_ALERTE_MARGE` | Seuil d'alerte taux de marge nette | Décimal | `0.03` | — |
| `ECONO_SEUIL_DANGER_MARGE` | Seuil de danger taux de marge nette | Décimal | `0.00` | — |
| `ECONO_DEVISE` | Devise utilisée | Texte | `EUR` | ISO 4217 |
| `ECONO_FORMAT_NOMBRE` | Format d'affichage des montants | Texte | `fr-FR` | — |
| `ECONO_DECIMAL_PRIX` | Décimales pour les prix | Entier | `2` | — |
| `ECONO_DECIMAL_QUANTITES` | Décimales pour les quantités | Entier | `3` | — |
| `ECONO_TVA_TAUX_NORMAL` | Taux de TVA normal | Décimal | `0.20` | — |
| `ECONO_TVA_TAUX_REDUIT` | Taux de TVA réduit | Décimal | `0.10` | — |
| `ECONO_TVA_TAUX_TRAVAUX` | Taux de TVA travaux de rénovation | Décimal | `0.10` | — |
| `ECONO_COEFF_ACIER_BETON` | Ratio kg acier / m³ béton | Décimal | `80.0` | kg/m³ |

---

## 5. PARAMÈTRES MÉTIER — BÂTIMENT ENCADRÉ

| Clé | Description | Type | Valeur par défaut | Unité |
|---|---|---|---|---|
| `BATI_CONTRAINTE_SOL_MIN` | Contrainte admissible sol minimum | Décimal | `0.1` | MPa |
| `BATI_CONTRAINTE_SOL_MAX` | Contrainte admissible sol maximum | Décimal | `0.5` | MPa |
| `BATI_PROFONDEUR_ANCRAGE_MIN` | Profondeur d'ancrage minimum | Décimal | `0.6` | mètres |
| `BATI_RESISTANCE_MAÇON_DEFAUT` | Résistance caractéristique maçonnerie | Décimal | `5.0` | MPa |
| `BATI_GAMMA_M_MAÇON` | Coefficient partiel sécurité maçonnerie | Décimal | `3.0` | — |
| `BATI_EPAISSEUR_DALLAGE_MIN` | Épaisseur minimale dallage | Entier | `12` | cm |
| `BATI_CHARGE_ADMISSIBLE_DALLAGE_MAX` | Charge maximale dallage encadré | Décimal | `5.0` | kN/m² |
| `BATI_ELANCEMENT_MAX_MUR` | Élancement maximal mur porteur | Decimal | `20.0` | H/t |

---

## 6. PARAMÈTRES INDICES ET RÉVISION

| Clé | Description | Type | Valeur par défaut | Unité |
|---|---|---|---|---|
| `INDEX_SOURCE_DEFAUT` | Source des index (INSEE, etc.) | Texte | `INSEE` | — |
| `INDEX_PERIODE_ACTUALISATION` | Fréquence de mise à jour des index | Texte | `mensuelle` | — |
| `REVISION_PART_FIXE_DEFAUT` | Part fixe de la formule de révision | Décimal | `0.15` | — |
| `REVISION_PART_MO_DEFAUT` | Part main-d'œuvre | Décimal | `0.35` | — |
| `REVISION_PART_MAT_DEFAUT` | Part matériaux | Décimal | `0.50` | — |

---

## 7. PARAMÈTRES SUPERVISION ET ALERTES

| Clé | Description | Type | Valeur par défaut | Unité |
|---|---|---|---|---|
| `SUPERV_SEUIL_CPU` | Seuil alerte CPU | Entier | `80` | % |
| `SUPERV_SEUIL_MEMOIRE` | Seuil alerte mémoire | Entier | `85` | % |
| `SUPERV_SEUIL_DISQUE` | Seuil alerte disque | Entier | `85` | % |
| `SUPERV_INTERVAL_VERIFICATION` | Intervalle de vérification | Entier | `60` | secondes |
| `SUPERV_RETENTION_METRIQUES` | Rétention des métriques | Entier | `7` | jours |

---

## 8. RÈGLES DE GESTION DES PARAMÈTRES

- Tout paramètre a un type (texte, entier, décimal, booléen, liste).
- Tout paramètre a une valeur par défaut non nulle (sauf exceptions documentées).
- Tout paramètre a une description lisible par l'administrateur.
- La modification d'un paramètre est journalisée (qui, quand, ancienne valeur → nouvelle valeur).
- Certains paramètres sont verrouillés en production (non modifiables via l'interface) et ne passent que par le fichier `.env`.
- Les paramètres liés aux calculs sont versionnés pour assurer la traçabilité des résultats historiques.
