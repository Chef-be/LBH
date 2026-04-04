# SYNTHÈSE MÉTIER — RESSOURCES SAMBA ADMIN

Date de lecture : 2026-04-01

## Répertoires de référence

- Partage documentaire source : `/var/www/vhosts/lbh-economiste.com/smb.lbh-economiste.com/data/samba/shares/admin/ressources`
- Répertoire de travail LBH : `/var/www/vhosts/lbh-economiste.com/ressources`

## Rôle de cette bibliothèque

Ce partage constitue la base documentaire métier à utiliser pour comprendre :

- la logique de chiffrage et d'étude de prix ;
- les processus de rédaction des pièces écrites ;
- l'organisation des missions MOE et OPC ;
- les exigences qualité chantier ;
- la gestion contractuelle et la clôture des marchés ;
- les référentiels de construction bâtiment et VRD.

## Documents lus et apports principaux

### Manuel de l'étude de prix

Source : `793522059-Manuel-de-l-Etude-de-Prix-1.pdf`

- Relie explicitement l'offre de prix au coût de revient puis au prix de vente.
- Structure la démarche : prérequis, outils de base, approfondissement, suivi économique des travaux, bilan d'opération.
- Confirme l'importance du DHMO, des pertes, frais de chantier, frais généraux, aléas et seuils de rentabilité.

### Descriptifs et CCTP de projets de construction

Source : `822465512-Descriptifs-Et-Cctp-de-Projets-de-Construction-Ed3-v1.pdf`

- Cadre la rédaction des descriptifs par analyse du projet, ouvrage élémentaire, consistance du lot et dispositions générales.
- Confirme qu'un CCTP doit rester contextualisé, cohérent, lisible et attaché à une phase de projet.
- Donne une structure utile pour l'interface "pièces écrites" et les générateurs documentaires.

### Guide de la maîtrise d'œuvre travaux

Source : `493634310-Guide-de-La-MOE-Travaux-General.pdf`

- Organise la mission autour de fiches : organisation du maître d'œuvre, CCAP, CCTP, préparation de chantier, sous-traitance, facturation, modificatifs, délais, réception, remise d'ouvrage.
- Renforce la nécessité d'un suivi d'exécution orienté procédures, décisions et preuves.

### Méthodologie de réalisation des missions OPC

Source : `467960216-272465341-Methodologie-de-Realisation-Des-Missions-Opc.pdf`

- Met l'accent sur la maîtrise des délais, l'interdépendance des intervenants et la valeur des check-lists.
- Justifie des interfaces dédiées à l'ordonnancement, au pilotage et au retour d'expérience.

### Plans d'assurance qualité chantiers

Source : `538842637-Plans-dAssurance-qualite-chantiers-converti.pdf`

- Résume la logique PAQ : écrire ce que l'on fait, faire ce qui est écrit, écrire ce qui a été fait.
- Confirme le besoin de traçabilité, contrôles et enregistrements qualité dans l'exécution.

### Guide FNTP marchés privés 2025

Source : `891029698-Guide-FNTP-Marches-prives-2025.pdf`

- Structure le cycle contractuel : négociation, préparation du chantier, gestion administrative et contractuelle, réception, règlement définitif, garanties.
- Met en avant NF P03-001 et NF P03-002 comme cadres de référence usuels en marchés privés.

## Conséquences fonctionnelles pour la plateforme

- Le site public doit refléter le périmètre réel : étude de prix, pièces écrites, MOE, OPC, qualité, gestion contractuelle.
- Le moteur économique doit continuer à expliciter les formules, hypothèses et domaines de validité.
- Les modules documents, appels d'offres et exécution doivent rester centrés sur les preuves, les statuts et la traçabilité.
- La personnalisation du site doit permettre logo, favicon, carrousel et identité éditoriale sans recoder.

## Formules et référentiels déjà cohérents dans le dépôt

- `calculs/economie/moteur_rentabilite.py`
- `matrices/calculs.md`

Les formules DSu, CDu, CRu, PVu, marge nette, seuil de rentabilité et indices de sensibilité sont cohérentes avec la logique d'étude de prix observée dans les documents lus.
