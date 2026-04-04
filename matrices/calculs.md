# MATRICE DES FORMULES DE CALCUL — Plateforme LBH

---

## 1. DOMAINE VOIRIE / VRD

### 1.1 Trafic et essieux équivalents

#### Trafic journalier moyen initial (T₀)
```
T₀ = MJA_PL × pourcentage_voie_chargée
```
- `MJA_PL` : Moyenne journalière annuelle de poids lourds
- `pourcentage_voie_chargée` : fraction du trafic sur la voie la plus chargée (défaut 0.5)
- **Domaine de validité** : T₀ > 0
- **Source** : Guide STRA / Catalogue des structures

#### Trafic cumulé avec croissance géométrique (Nj)
```
Nj = T₀ × [(1 + τ)ⁿ - 1] / τ  (si τ ≠ 0)
Nj = T₀ × n × 365              (si τ = 0)
```
- `τ` : taux de croissance annuel (en décimal, ex : 0.02 pour 2%)
- `n` : durée de service en années
- **Domaine de validité** : n ∈ [1, 50], τ ∈ [-0.05, 0.10]
- **Alerte** : si τ > 0.05, vérifier la cohérence du scénario

#### Nombre d'essieux équivalents de référence (Ne)
```
Ne = Nj × 365 × CAM
```
- `CAM` : coefficient d'agressivité moyen du trafic
- **Défaut CAM** : 0.5 (faible agressivité) / 1.0 (moyenne) / 2.0 (forte)
- **Domaine de validité** : CAM ∈ [0.1, 5.0]

#### Classe de trafic (T)
| Ne (en 10⁶ essieux 13 t) | Classe |
|---|---|
| < 0.1 | T5 |
| 0.1 – 0.3 | T4 |
| 0.3 – 1 | T3+ |
| 1 – 3 | T3 |
| 3 – 10 | T2 |
| 10 – 30 | T1 |
| > 30 | T0 |

### 1.2 Portance de la plate-forme

#### Classe de plate-forme (PF)
| EV2 (MPa) | Classe |
|---|---|
| < 20 | PF1 |
| 20 – 50 | PF2 |
| 50 – 120 | PF3 |
| > 120 | PF4 |

#### Portance CBR estimée
```
EV2_approx = 10 × CBR^0.67   (approximation empirique)
```
- **Alerte** : valeur d'approximation uniquement — mesure EV2 in situ recommandée

### 1.3 Quantitatifs voirie

#### Volume terrassement (déblai général)
```
V_deblai = L × (l_p + l_crêtes) / 2 × (H_deblai_gauche + H_deblai_droit) / 2
```

#### Surface de chaussée
```
S_chaussee = L × l_chaussee
```

#### Volume couche de forme
```
V_couche_forme = S_chaussee × e_couche_forme
```
- `e_couche_forme` : épaisseur en mètres

#### Volume par couche de structure
```
V_couche = S_chaussee × e_couche
```

#### Linéaire de bordures
```
L_bordures = L × (2 si double filière)
```

---

## 2. DOMAINE ÉCONOMIE DE LA CONSTRUCTION

### 2.1 Déboursé et prix de vente

#### Déboursé sec unitaire (DSu)
```
DSu = (T_MO × C_MO) + C_Matières + C_Matériel + C_Sous-traitance + C_Transport
```
- `T_MO` : temps unitaire de main-d'œuvre (en h/unité)
- `C_MO` : coût horaire de la main-d'œuvre
- **Domaine** : DSu > 0

#### Déboursé sec total (DS)
```
DS = DSu × Q
```
- `Q` : quantité totale

#### Coût direct unitaire (CDu)
```
CDu = DSu × (1 + τ_pertes) × (1 + τ_frais_chantier)
```
- `τ_pertes` : taux de pertes matières (défaut : 5%)
- `τ_frais_chantier` : taux de frais de chantier (défaut : 12%)

#### Coût de revient unitaire (CRu)
```
CRu = CDu × (1 + τ_frais_generaux) × (1 + τ_aleas)
```
- `τ_frais_generaux` : taux de frais généraux (défaut : 10%)
- `τ_aleas` : taux d'aléas (défaut : 3%)

#### Prix de vente unitaire (PVu)
```
PVu = CRu / (1 - τ_marge)
```
ou équivalent :
```
PVu = CRu × (1 + τ_marge_sur_coût)
```
- `τ_marge` : taux de marge sur prix de vente
- `τ_marge_sur_coût` : taux de marge sur coût de revient
- **Attention** : ces deux taux ne sont pas équivalents

#### DHMO (Déboursé Horaire Moyen Ouvrier)
```
DHMO = Σ(salaire_brut_i × (1 + τ_charges_i)) / heures_productives
```
- `heures_productives` : nombre d'heures productives annuelles par ouvrier (défaut : 1 600 h/an)
- `τ_charges` : coefficient de charges sociales (défaut : 0.85)

### 2.2 Marges et rentabilité

#### Marge brute unitaire (MBu)
```
MBu = PVu - DSu
```

#### Marge brute totale (MB)
```
MB = MBu × Q
```

#### Marge nette unitaire (MNu)
```
MNu = PVu - CRu
```

#### Marge nette totale (MN)
```
MN = MNu × Q
```

#### Taux de marge brute (τMB)
```
τMB = MBu / PVu × 100
```

#### Taux de marge nette (τMN)
```
τMN = MNu / PVu × 100
```

#### Contribution à la marge du lot (C)
```
C = MN_ligne / MN_lot × 100
```

### 2.3 Seuils de rentabilité

#### Quantité minimale pour couvrir les frais fixes (Q_min)
```
Q_min = Frais_fixes / (PVu - CDu)
```
- `Frais_fixes` : frais fixes du lot ou du projet
- `CDu` : coût direct variable unitaire

#### Prix de vente minimum de rentabilité nulle (PV_min)
```
PV_min = CRu
```

#### Prix de vente de marge cible (PV_cible)
```
PV_cible = CRu / (1 - τ_marge_cible)
```

#### Seuil de quantité critique (Q_critique)
Pour que la marge nette soit nulle :
```
Q_critique = Frais_fixes_lot / MNu
```

#### Indice de sensibilité à la quantité (IS_Q)
```
IS_Q = MNu / CRu × 100
```
Plus cet indice est élevé, plus la ligne est sensible aux variations de quantité.

#### Indice de sensibilité au coût matière (IS_CM)
```
IS_CM = C_Matières / DSu × 100
```

#### Indice de sensibilité au temps de main-d'œuvre (IS_MO)
```
IS_MO = (T_MO × C_MO) / DSu × 100
```

### 2.4 États de rentabilité

| Condition | État |
|---|---|
| τMN ≥ τ_marge_cible | Rentable |
| τ_alerte ≤ τMN < τ_marge_cible | À surveiller |
| 0 < τMN < τ_alerte | Faiblement rentable |
| τMN = 0 | Seuil de rentabilité |
| τMN < 0 ET DSu < PVu | Non rentable (frais indirects mal absorbés) |
| CRu > PVu | Déficitaire |
| DSu > PVu | Déficitaire dès l'origine |
| Q_réelle < Q_critique | Rentable sous condition de quantité |

- `τ_alerte` : paramètre externalisé (défaut : 3%)
- `τ_marge_cible` : paramètre externalisé (défaut : 8%)

### 2.5 Révision et actualisation des prix

#### Coefficient d'actualisation simple (K_actualisation)
```
K_actualisation = Index_cible / Index_référence
```

#### Révision de prix par formule paramétrique
```
P_révisé = P₀ × (a × I_main_oeuvre/I₀_main_oeuvre + b × I_matériaux/I₀_matériaux + c)
```
- `a`, `b`, `c` : coefficients de la formule (a + b + c = 1)
- `I₀` : index à la date de référence
- `I` : index à la date de révision
- **Source** : Formule type marché public français

---

## 3. DOMAINE BÂTIMENT ENCADRÉ

> **Avertissement** : Les formules suivantes sont des pré-dimensionnements encadrés,
> valables uniquement dans des conditions géotechniques et structurelles normales.
> Elles ne se substituent pas à une étude de structure complète par un ingénieur.

### 3.1 Fondations superficielles (semelles filantes)

#### Largeur minimale de semelle filante (B_min)
```
B_min = q_total / q_sol_admissible
```
- `q_total` : charge linéaire descendante (en kN/ml)
- `q_sol_admissible` : contrainte admissible du sol (en kPa)
- **Domaine** : q_sol_admissible ∈ [100 kPa, 500 kPa]
- **Alerte si** : B_min < 0.4 m (vérifier la charge) ou B_min > 1.5 m (sol faible, étude requise)

#### Profondeur d'ancrage minimale (D)
```
D ≥ max(0.5 m ; profondeur_hors_gel)
```
- **Profondeur hors gel** : variable selon la zone climatique (0.6 m à 1.0 m en France)

### 3.2 Dallages

#### Épaisseur de dallage (e)
```
e_min = max(12 cm ; L/30)
```
- `L` : portée entre appuis ou distance entre joints (en cm)
- **Domaine** : e ∈ [12 cm, 35 cm] pour dallages courants
- **Alerte si** : charge > 5 kN/m² ou charges locales concentrées (étude requise)

### 3.3 Maçonnerie portante (pré-dimensionnement simplifié)

#### Contrainte de compression dans le mur (σ)
```
σ = N / (t × L)
```
- `N` : charge axiale (en kN)
- `t` : épaisseur du mur (en m)
- `L` : longueur du mur (en m)
- **Contrainte admissible** : σ ≤ f_d = f_k / γM
  - `f_k` : résistance caractéristique en compression (défaut : 5 MPa pour blocs béton courants)
  - `γM` : coefficient partiel de sécurité (défaut : 3.0)
- **Domaine** : murs courants, H/t ≤ 20

---

## 4. QUANTITATIFS GÉNÉRAUX

### 4.1 Surfaces

| Forme | Formule |
|---|---|
| Rectangle | S = L × l |
| Triangle | S = (b × h) / 2 |
| Trapèze | S = (b₁ + b₂) / 2 × h |
| Cercle | S = π × R² |
| Couronne | S = π × (R² - r²) |

### 4.2 Volumes

| Forme | Formule |
|---|---|
| Parallélépipède | V = L × l × h |
| Cylindre | V = π × R² × h |
| Cône | V = π × R² × h / 3 |
| Prismatique (section constante) | V = S_section × L |
| Prismatique (sections variables) | V = (S₁ + S₂) / 2 × L (prismatoïde approché) |

### 4.3 Tranchées

#### Volume de terrassement de tranchée
```
V = L × [(l_fond + (l_fond + 2 × talus × H)) / 2] × H
```
- `l_fond` : largeur de fond de tranchée
- `H` : profondeur
- `talus` : pente des talus (horizontal/vertical)

#### Volume de remblai
```
V_remblai = V_tranchée - V_lit_pose - V_canalisation
```

---

## 5. CONVENTIONS DE CALCUL

| Convention | Règle |
|---|---|
| **Précision des résultats** | 2 décimales pour les montants, 3 pour les ratios |
| **Unités** | SI (mètres, mètres cubes, kN, MPa) sauf mention contraire |
| **Arrondis** | Arrondis au centième pour les prix, au dixième pour les quantités |
| **Taux** | Toujours exprimés en décimaux en interne, convertis en % pour l'affichage |
| **Traçabilité** | Chaque calcul stocke ses hypothèses, sa version de formule et ses sources |
| **Versionnement** | Chaque formule a un numéro de version interne |
| **Domaine de validité** | Tout résultat hors domaine déclenche une alerte |
| **Hypothèses** | Distinguer : certaine / estimée / par défaut / à vérifier |
