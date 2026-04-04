# MATRICE DES DOCUMENTS GÉNÉRABLES — Plateforme LBH

---

## 1. CATÉGORIES DE DOCUMENTS

| Catégorie | Description | Format de sortie |
|---|---|---|
| Pièces contractuelles | CCTP, DPGF, BPU, DQE | DOCX, XLSX, PDF |
| Pièces financières | Situations, décomptes, ordres de service | DOCX, PDF |
| Notes techniques | Dimensionnement, calculs | DOCX, PDF |
| Rapports | Rentabilité, analyse, synthèse | DOCX, PDF |
| Tableaux export | Quantitatifs, métrés, bibliothèque | XLSX, CSV |
| Courriers | Lettres, mises en demeure | DOCX, PDF |
| Procès-verbaux | Réceptions, réunions | DOCX, PDF |

---

## 2. LISTE DES MODÈLES DE DOCUMENTS

### 2.1 Pièces de consultation (AO)

| Code | Libellé | Variables clés | Phase |
|---|---|---|---|
| `MOD_CCTP_VOIRIE` | CCTP Voirie / VRD | Projet, lot, prescriptions techniques | AO |
| `MOD_CCTP_BATIMENT` | CCTP Bâtiment | Projet, lots, matériaux, méthodes | AO |
| `MOD_CCTP_GENERIQUE` | CCTP Générique | Projet, désignation, prescriptions | AO |
| `MOD_BPU` | Bordereau des Prix Unitaires | Lignes de prix, unités, désignations | AO |
| `MOD_DQE` | Détail Quantitatif Estimatif | Lignes, quantités, prix, montants | AO |
| `MOD_DPGF` | Décomposition du Prix Global et Forfaitaire | Lots, sous-lots, montants | AO |
| `MOD_ACTE_ENGAGEMENT` | Acte d'engagement | Entreprise, montant, durée | AO |
| `MOD_RC` | Règlement de la consultation | Critères, délais, pièces exigées | AO |

### 2.2 Pièces de candidature (réponse AO)

| Code | Libellé | Variables clés | Phase |
|---|---|---|---|
| `MOD_LETTRE_CANDIDATURE` | Lettre de candidature (DC1) | Candidat, objet | Candidature |
| `MOD_MEMOIRE_TECHNIQUE` | Mémoire technique | Méthodologie, moyens, références | Candidature |
| `MOD_FICHE_REFERENCES` | Fiche de références | Opérations similaires | Candidature |
| `MOD_ORGANIGRAMME_EQUIPE` | Organigramme de l'équipe | Intervenants, rôles | Candidature |

### 2.3 Pièces d'exécution

| Code | Libellé | Variables clés | Phase |
|---|---|---|---|
| `MOD_OS_DEMARRAGE` | Ordre de service de démarrage | Date démarrage, délais | Exécution |
| `MOD_OS_ARRET` | Ordre de service d'arrêt | Date arrêt, motif | Exécution |
| `MOD_OS_REPRISE` | Ordre de service de reprise | Date reprise, conditions | Exécution |
| `MOD_OS_MODIFICATION` | Ordre de service de modification | Travaux modifiés, impact délais/prix | Exécution |
| `MOD_OS_TRAVAUX_SUPPLEMENTAIRES` | Ordre de service travaux supplémentaires | Désignation, prix, délais | Exécution |
| `MOD_SITUATION_TRAVAUX` | Situation de travaux (mensuelle) | Quantités réalisées, montants | Exécution |
| `MOD_ATTACHEMENT` | Bordereau d'attachements | Relevés, métrés, constats | Exécution |
| `MOD_DECOMPTE_MENSUEL` | Décompte mensuel | Cumuls, acomptes, retenues | Exécution |
| `MOD_DECOMPTE_GENERAL` | Décompte général définitif | Bilan financier complet | Réception |

### 2.4 Procès-verbaux et comptes rendus

| Code | Libellé | Variables clés | Phase |
|---|---|---|---|
| `MOD_CR_CHANTIER` | Compte rendu de chantier | Date, présents, points, décisions | Exécution |
| `MOD_CR_REUNION_SYNTH` | Compte rendu de réunion de synthèse | Ordre du jour, décisions | Toutes |
| `MOD_PV_RECEPTION` | Procès-verbal de réception | Date, réserves, levée réserves | Réception |
| `MOD_PV_LEVEE_RESERVES` | PV de levée de réserves | Réserves levées, constats | Réception |
| `MOD_PV_CONTRADICTION` | PV de contradiction | Points contestés | Exécution |

### 2.5 Courriers et correspondances

| Code | Libellé | Variables clés | Phase |
|---|---|---|---|
| `MOD_LETTRE_TYPE` | Lettre type | Destinataire, objet, corps | Toutes |
| `MOD_MISE_EN_DEMEURE` | Mise en demeure | Objet, délai, sanction | Exécution |
| `MOD_PENALITES` | Notification de pénalités | Calcul, montant, période | Exécution |
| `MOD_GARANTIE_DECENNALE` | Attestation garantie décennale | Entreprise, assureur, période | Réception |

### 2.6 Notes techniques et rapports

| Code | Libellé | Variables clés | Phase |
|---|---|---|---|
| `MOD_NOTE_DIMENSIONNEMENT_VOIRIE` | Note de dimensionnement voirie | Trafic, portance, structure, variantes | Étude |
| `MOD_NOTE_PREADIMENSIONNEMENT_BATI` | Note de pré-dimensionnement bâtiment | Fondations, dallage, maçonnerie | Étude |
| `MOD_RAPPORT_RENTABILITE` | Rapport d'analyse de rentabilité | Marges, seuils, causes, graphiques | Toutes |
| `MOD_RAPPORT_ANALYSE_OFFRES` | Rapport d'analyse des offres | Critères, notation, classement | AO |
| `MOD_RAPPORT_AVANCEMENT` | Rapport d'avancement | État d'avancement, planning | Exécution |
| `MOD_RAPPORT_FINANCIER` | Rapport financier | Engagé, réalisé, prévisionnel | Toutes |
| `MOD_FICHE_SYNTHESE_PROJET` | Fiche de synthèse projet | Données clés, statut, contacts | Toutes |

---

## 3. VARIABLES DE FUSION DISPONIBLES

### Variables projet
| Variable | Description |
|---|---|
| `{{projet.reference}}` | Référence interne du projet |
| `{{projet.intitule}}` | Intitulé complet |
| `{{projet.maitre_ouvrage}}` | Nom du maître d'ouvrage |
| `{{projet.maitre_oeuvre}}` | Nom du maître d'œuvre |
| `{{projet.date_debut}}` | Date de démarrage |
| `{{projet.date_fin_prevue}}` | Date de fin prévisionnelle |
| `{{projet.montant_marche}}` | Montant du marché HT |
| `{{projet.phase_actuelle}}` | Phase en cours |

### Variables organisation
| Variable | Description |
|---|---|
| `{{bureau.nom}}` | Nom du bureau d'études |
| `{{bureau.adresse}}` | Adresse complète |
| `{{bureau.telephone}}` | Téléphone |
| `{{bureau.courriel}}` | Adresse de courriel |
| `{{bureau.siret}}` | SIRET |
| `{{bureau.logo}}` | Logo (intégré dans le document) |

### Variables économiques
| Variable | Description |
|---|---|
| `{{lot.montant_ht}}` | Montant HT du lot |
| `{{lot.montant_ttc}}` | Montant TTC du lot |
| `{{ligne.prix_unitaire}}` | Prix unitaire de la ligne |
| `{{ligne.quantite}}` | Quantité de la ligne |
| `{{ligne.montant_total}}` | Montant total de la ligne |
| `{{bilan.marge_nette}}` | Marge nette globale |
| `{{bilan.taux_marge}}` | Taux de marge global |

### Variables de dates
| Variable | Description |
|---|---|
| `{{date.aujourd_hui}}` | Date du jour |
| `{{date.aujourd_hui_long}}` | Date du jour en format long |
| `{{date.mois_en_cours}}` | Mois en cours (ex: mars 2026) |
| `{{utilisateur.nom_complet}}` | Nom de l'utilisateur connecté |
| `{{utilisateur.fonction}}` | Fonction de l'utilisateur |

---

## 4. FORMATS DE SORTIE

| Format | Cas d'usage | Outil de génération |
|---|---|---|
| `.docx` | Documents Word modifiables | python-docx |
| `.xlsx` | Tableaux Excel | openpyxl |
| `.pdf` | Exports pour transmission | WeasyPrint / LibreOffice conversion |
| `.csv` | Exports bruts pour traitement externe | pandas |
| `.json` | Exports API | DRF sérialiseur |

---

## 5. CONTRAINTES DE GÉNÉRATION

- Tout document généré est horodaté et versionné.
- Les documents sont stockés dans MinIO avec lien au projet.
- Une génération de document crée une entrée dans le journal de génération.
- Les modèles sont modifiables par les utilisateurs habilités sans recoder.
- Les variables non renseignées sont remplacées par un marqueur visible : `[NON RENSEIGNÉ]`.
- Les modèles incluent un pied de page avec : nom du bureau, date de génération, version du document, numéro de projet.
