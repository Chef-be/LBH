"""
Chargement des lots et prescriptions CCTP en base.
Sources :
  - Descriptifs et CCTP de projets — Widloecher & Cusant 3e éd. (Eyrolles 2020)
  - Tous Corps d'État Bâtiment — Granier/Platzer 8e éd. (Le Moniteur 2021)
  - DTU, Eurocodes, normes NF EN applicables par corps d'état
  - Guides CSTB, CCTG, RE 2020, NF C 15-100

Exécution : docker compose exec lbh-backend python manage.py charger_prescriptions_cctp
            Ajouter --reinitialiser pour supprimer et recharger depuis zéro.
"""

from django.core.management.base import BaseCommand
from django.db import transaction
from applications.pieces_ecrites.models import LotCCTP, ChapitrePrescrip, PrescriptionCCTP


# =============================================================================
# DONNÉES DES LOTS — normes complètes et prescriptions structurées
# =============================================================================

LOTS = [
    # =========================================================================
    # VRD — Voirie et Réseaux Divers
    # =========================================================================
    {
        "code": "VRD",
        "intitule": "VRD et réseaux",
        "description": (
            "Voirie, réseaux divers, terrassements de voirie, assainissement, "
            "réseaux secs et humides, éclairage extérieur, signalisation."
        ),
        "normes_principales": [
            "CCTG fascicule 70 — Ouvrages d'assainissement",
            "CCTG fascicule 71 — Fourniture et pose de canalisations d'eau",
            "NF EN 1610 — Pose et essais des collecteurs d'assainissement",
            "NF EN 805 — Alimentation en eau hors bâtiments",
            "NF EN 1916 — Tuyaux et pièces en béton armé",
            "NF EN 1401 — Systèmes de canalisations PVC-U pour assainissement",
            "NF EN 124 — Dispositifs de couronnement et fermeture",
            "NF P 98-200 — Chaussées — couches de fondation",
            "NF EN 13043 — Granulats pour mélanges hydrocarbonés",
            "NF P 98-150 — Enrobés bitumineux — exécution",
            "NF P 98-130 — Chaussées — grave-bitume",
            "NF P 11-300 — Classification des matériaux",
            "NF EN 13242 — Granulats non traités (GNT)",
            "NF P 94-093 — Essai Proctor modifié",
            "DTU 65.10 — Canalisations d'eau chaude ou froide sous pression",
            "NF EN 1091 — Systèmes d'évacuation sous pression",
            "NF EN 545 — Tuyaux en fonte ductile",
            "NF C 17-200 — Installations d'éclairage extérieur",
            "Arrêté du 15/02/2012 — Prescriptions techniques applicables aux réseaux",
        ],
        "ordre": 1,
        "chapitres": [
            {
                "numero": "1",
                "intitule": "Généralités",
                "ordre": 1,
                "prescriptions": [
                    {
                        "intitule": "Objet du lot VRD",
                        "corps": (
                            "Le présent lot comprend l'ensemble des travaux de voirie, réseaux divers et "
                            "terrassements de voirie nécessaires à l'opération. L'entrepreneur prendra "
                            "connaissance de l'ensemble des pièces du dossier avant de remettre son offre. "
                            "Il est responsable de la coordination avec les concessionnaires de réseaux "
                            "(ENEDIS, GRDF, Orange, eau potable, assainissement)."
                        ),
                        "type_prescription": "generalites",
                        "niveau": "obligatoire",
                        "normes": ["CCTG fascicule 70", "NF P 98-200"],
                        "ordre": 1,
                    },
                    {
                        "intitule": "Documents de référence VRD",
                        "corps": (
                            "Les travaux seront exécutés conformément aux documents suivants :\n"
                            "— Fascicule 70 du CCTG : Ouvrages d'assainissement\n"
                            "— Fascicule 71 du CCTG : Fourniture et pose de canalisations d'eau\n"
                            "— NF EN 1610 : Mise en place et essais des collecteurs d'assainissement\n"
                            "— NF EN 805 : Alimentation en eau — exigences pour les systèmes hors bâtiments\n"
                            "— NF P 98-200 : Chaussées — couches de fondation — généralités\n"
                            "— Guide technique SÉTRA : Conception et dimensionnement des chaussées\n"
                            "— NF EN 124 : Dispositifs de couronnement et fermeture pour zones de circulation\n"
                            "— Arrêté du 15/02/2012 : Prescriptions techniques réseaux"
                        ),
                        "type_prescription": "documents_reference",
                        "niveau": "obligatoire",
                        "normes": ["CCTG fascicule 70", "CCTG fascicule 71", "NF EN 1610", "NF EN 805", "NF P 98-200", "NF EN 124"],
                        "ordre": 2,
                    },
                ],
            },
            {
                "numero": "2",
                "intitule": "Terrassements de voirie et chaussées",
                "ordre": 2,
                "prescriptions": [
                    {
                        "intitule": "Décapage et structure de chaussée",
                        "corps": (
                            "La terre végétale sera décapée sur {epaisseur_decapage:-0,30 m} et stockée "
                            "en merlon pour réutilisation. La structure de chaussée comprendra, de bas en haut :\n"
                            "— Couche de forme : GNT 0/31,5 — épaisseur {ep_forme:-0,20 m}\n"
                            "— Couche de fondation : GNT 0/31,5 — épaisseur {ep_fondation:-0,20 m}\n"
                            "— Couche de base : GB3 — épaisseur {ep_base:-0,07 m}\n"
                            "— Couche de roulement : BBSG ou BBM — épaisseur {ep_roulement:-0,05 m}\n"
                            "Les matériaux seront conformes aux normes NF EN 13043 et NF P 98-150."
                        ),
                        "type_prescription": "mise_en_oeuvre",
                        "niveau": "obligatoire",
                        "normes": ["NF EN 13043", "NF P 98-150", "NF P 98-130", "NF P 11-300"],
                        "contient_variables": True,
                        "ordre": 1,
                    },
                    {
                        "intitule": "Compactage — contrôle",
                        "corps": (
                            "Le compactage sera vérifié par essais de plaque (module EV2 ≥ 50 MPa en couche "
                            "de forme, rapport EV2/EV1 ≤ 2,2) et essais Proctor modifié (NF P 94-093). "
                            "Un essai pour 500 m² minimum, à chaque changement de matériaux."
                        ),
                        "type_prescription": "controles",
                        "niveau": "obligatoire",
                        "normes": ["NF P 94-093", "NF P 98-115"],
                        "ordre": 2,
                    },
                ],
            },
            {
                "numero": "3",
                "intitule": "Réseaux d'assainissement et pluvial",
                "ordre": 3,
                "prescriptions": [
                    {
                        "intitule": "Canalisations d'assainissement",
                        "corps": (
                            "Les canalisations d'assainissement seront en PVC CR8 (NF EN 1401) ou béton armé "
                            "(NF EN 1916). Pose conforme NF EN 1610, essais d'étanchéité par mise en pression "
                            "(0,5 bar, 30 min). Lit de pose en sable de rivière 0/4, épaisseur minimale 0,10 m "
                            "sous la génératrice inférieure. Enrobage sableux jusqu'à 0,10 m au-dessus de la "
                            "génératrice supérieure."
                        ),
                        "type_prescription": "mise_en_oeuvre",
                        "niveau": "obligatoire",
                        "normes": ["NF EN 1401", "NF EN 1610", "NF EN 1916", "CCTG fascicule 70"],
                        "ordre": 1,
                    },
                    {
                        "intitule": "Regards et ouvrages hydrauliques",
                        "corps": (
                            "Les regards de visite seront en béton préfabriqué conformes NF EN 1917 ou "
                            "construits en place en béton C25/30. Tampons fonte classe D400 (NF EN 124) en "
                            "voirie, C250 en trottoir. Cunette obligatoire pour regards > DN300."
                        ),
                        "type_prescription": "mise_en_oeuvre",
                        "niveau": "obligatoire",
                        "normes": ["NF EN 1917", "NF EN 124"],
                        "ordre": 2,
                    },
                ],
            },
        ],
    },

    # =========================================================================
    # TERR — Terrassements généraux
    # =========================================================================
    {
        "code": "TERR",
        "intitule": "Terrassements",
        "description": (
            "Terrassements généraux, fouilles en masse et en tranchées, "
            "déblais/remblais, blindages, drainage périphérique."
        ),
        "normes_principales": [
            "NF P 11-300 — Classification des matériaux de remblais",
            "NF P 94-500 — Missions géotechniques — Classification et spécifications",
            "NF P 94-050 — Détermination de la teneur en eau pondérale",
            "NF P 94-051 — Limites d'Atterberg",
            "NF P 94-093 — Essai Proctor modifié",
            "NF P 94-061-1 — Cisaillement à la boîte",
            "NF EN 14688-1 — Identification et classification des sols",
            "NF EN 14688-2 — Principes de classification",
            "NF EN 1536 — Exécution des pieux forés",
            "NF EN 1538 — Exécution des parois moulées",
            "DTU 13.3 — Dallages — conception, calcul et exécution",
            "GTR SÉTRA/LCPC — Guide des Terrassements Routiers",
            "NF EN 13242 — Granulats non liés",
        ],
        "ordre": 2,
        "chapitres": [
            {
                "numero": "1",
                "intitule": "Généralités et reconnaissance de sol",
                "ordre": 1,
                "prescriptions": [
                    {
                        "intitule": "Objet du lot terrassements",
                        "corps": (
                            "Le présent lot comprend : terrassements généraux, fouilles en masse, "
                            "fouilles en rigoles et en tranchées, remblaiement compacté, évacuation "
                            "des terres excédentaires, épuisements provisoires et toutes sujétions "
                            "d'exécution. L'entrepreneur prendra connaissance du rapport géotechnique "
                            "de type G2 avant remise de son offre (NF P 94-500)."
                        ),
                        "type_prescription": "generalites",
                        "niveau": "obligatoire",
                        "normes": ["NF P 94-500"],
                        "ordre": 1,
                    },
                    {
                        "intitule": "Fouilles — exécution et sécurité",
                        "corps": (
                            "Les fouilles seront exécutées selon les plans et préconisations de l'étude "
                            "géotechnique G2 Pro. Tout talutage ou blindage nécessaire à la stabilité est "
                            "à la charge de l'entrepreneur. En présence d'eau, un épuisement provisoire "
                            "est obligatoire. Les fonds de fouilles seront réceptionnés par le géotechnicien "
                            "avant tout bétonnage."
                        ),
                        "type_prescription": "mise_en_oeuvre",
                        "niveau": "obligatoire",
                        "normes": ["NF P 94-500", "NF EN 1538"],
                        "ordre": 2,
                    },
                    {
                        "intitule": "Drainage périphérique",
                        "corps": (
                            "Un drain périphérique en tuyau PVC annelé perforé DN100 minimum sera mis en "
                            "place en pied de fondations. Entouré d'un géotextile non tissé filtrant, "
                            "recouvert de gravillons 10/25 drainants. Pente minimale 0,5 % vers les regards. "
                            "Conforme DTU 13.3 et DTU 20.1."
                        ),
                        "type_prescription": "mise_en_oeuvre",
                        "niveau": "recommande",
                        "normes": ["DTU 13.3", "DTU 20.1"],
                        "ordre": 3,
                    },
                ],
            },
        ],
    },

    # =========================================================================
    # GO — Gros Œuvre
    # =========================================================================
    {
        "code": "GO",
        "intitule": "Gros Œuvre",
        "description": (
            "Fondations, structure béton armé (voiles, poteaux, poutres, planchers), "
            "maçonnerie de remplissage, dallages sur terre-plein."
        ),
        "normes_principales": [
            "NF DTU 21 — Exécution des travaux en béton",
            "NF DTU 20.1 — Maçonnerie de petits éléments — parois et murs",
            "NF DTU 23.1 — Murs en béton banché",
            "NF DTU 13.1 — Fondations superficielles",
            "NF DTU 13.2 — Fondations profondes pour bâtiment",
            "NF DTU 13.3 — Dallages — conception, calcul et exécution",
            "NF EN 1992-1-1 (EC2) — Calcul des structures en béton",
            "NF EN 1992-1-2 (EC2) — Comportement au feu",
            "NF EN 206/CN — Béton — spécifications, performances, production",
            "NF EN 197-1 — Ciments — composition et spécifications",
            "NF EN 10080 — Aciers pour armatures — B500B/B500C",
            "NF EN 13670 — Exécution des structures en béton",
            "NF P 18-201 — Béton — code d'application des normes",
            "NF EN 1997-1 (EC7) — Calcul géotechnique",
            "NF P 94-500 — Missions géotechniques",
            "NF EN 771-1 à 771-6 — Éléments de maçonnerie",
            "NF EN 998-2 — Mortiers de maçonnerie — mortiers de montage",
            "NF EN 845-1 — Aciers d'armature des maçonneries",
            "Décret n° 2011-1461 — Réglementation thermique (planchers)",
        ],
        "ordre": 3,
        "chapitres": [
            {
                "numero": "1",
                "intitule": "Généralités",
                "ordre": 1,
                "prescriptions": [
                    {
                        "intitule": "Objet du lot Gros Œuvre",
                        "corps": (
                            "Le présent lot comprend l'ensemble des travaux de gros œuvre : fondations, "
                            "structure béton armé (voiles, poteaux, poutres, planchers), maçonnerie de "
                            "remplissage, dallages sur terre-plein et toutes sujétions d'exécution. "
                            "L'entrepreneur est responsable de la stabilité en cours de chantier et doit "
                            "soumettre les plans d'exécution au visa du bureau de contrôle avant tout "
                            "bétonnage. Conformité obligatoire à la NF EN 13670."
                        ),
                        "type_prescription": "generalites",
                        "niveau": "obligatoire",
                        "normes": ["NF DTU 21", "NF EN 1992-1-1", "NF EN 13670"],
                        "ordre": 1,
                    },
                    {
                        "intitule": "Documents de référence Gros Œuvre",
                        "corps": (
                            "Les travaux seront exécutés conformément aux :\n"
                            "— NF DTU 21 : Exécution des travaux en béton\n"
                            "— NF EN 206/CN : Spécifications béton\n"
                            "— NF EN 1992-1-1 (Eurocode 2) : Calcul des structures en béton\n"
                            "— NF EN 197-1 : Ciments\n"
                            "— NF EN 10080 : Aciers pour armatures (B500B/C)\n"
                            "— NF EN 13670 : Exécution des structures en béton\n"
                            "— NF DTU 13.1 : Fondations superficielles\n"
                            "— NF DTU 13.3 : Dallages"
                        ),
                        "type_prescription": "documents_reference",
                        "niveau": "obligatoire",
                        "normes": ["NF DTU 21", "NF EN 206/CN", "NF EN 1992-1-1", "NF EN 197-1", "NF EN 10080", "NF EN 13670", "NF DTU 13.1", "NF DTU 13.3"],
                        "ordre": 2,
                    },
                ],
            },
            {
                "numero": "2",
                "intitule": "Béton et matériaux",
                "ordre": 2,
                "prescriptions": [
                    {
                        "intitule": "Qualité des bétons",
                        "corps": (
                            "Les bétons seront de classe de résistance minimale :\n"
                            "— Béton de propreté : C10/12\n"
                            "— Fondations : {classe_beton_fondations:-C25/30} XC2\n"
                            "— Structure (voiles, poteaux, poutres) : {classe_beton_structure:-C25/30} XC1\n"
                            "— Dallage sur terre-plein : C25/30 XC2, épaisseur {ep_dallage:-0,15 m}\n"
                            "Dosage minimal en ciment : 300 kg/m³ pour les parties en contact avec le sol. "
                            "Rapport E/C ≤ 0,55 pour les zones XC3/XC4. Affaissement S3 sauf accord MOE."
                        ),
                        "type_prescription": "materiaux",
                        "niveau": "obligatoire",
                        "normes": ["NF EN 206/CN", "NF EN 1992-1-1", "NF EN 197-1"],
                        "contient_variables": True,
                        "ordre": 1,
                    },
                    {
                        "intitule": "Armatures et enrobages",
                        "corps": (
                            "Les armatures seront en acier B500B ou B500C (NF EN 10080). "
                            "Enrobages nominaux minimaux :\n"
                            "— Fondations en contact avec le sol : cnom = 50 mm\n"
                            "— Éléments intérieurs (XC1) : cnom = 20 mm\n"
                            "— Éléments extérieurs (XC3/XC4) : cnom = 30 mm\n"
                            "Recouvrements selon plans d'armatures visés par le bureau de contrôle. "
                            "Ligatures ou soudures par points autorisées uniquement si aciers soudables certifiés."
                        ),
                        "type_prescription": "mise_en_oeuvre",
                        "niveau": "obligatoire",
                        "normes": ["NF EN 10080", "NF EN 1992-1-1"],
                        "contient_variables": True,
                        "ordre": 2,
                    },
                ],
            },
            {
                "numero": "3",
                "intitule": "Maçonnerie",
                "ordre": 3,
                "prescriptions": [
                    {
                        "intitule": "Maçonnerie de remplissage",
                        "corps": (
                            "Les maçonneries de remplissage seront exécutées conformément au NF DTU 20.1. "
                            "Blocs béton creux NF EN 771-3 : résistance ≥ 5 MPa, montés au mortier M5 "
                            "(NF EN 998-2) ou à la colle (blocs rectifiés). Chaînages horizontaux et "
                            "verticaux conformes aux plans. Appui minimum des planchers sur maçonnerie : 0,20 m. "
                            "Tolérance de planéité : ± 5 mm sous la règle de 2 m."
                        ),
                        "type_prescription": "mise_en_oeuvre",
                        "niveau": "obligatoire",
                        "normes": ["NF DTU 20.1", "NF EN 771-3", "NF EN 998-2"],
                        "ordre": 1,
                    },
                ],
            },
            {
                "numero": "4",
                "intitule": "Fondations",
                "ordre": 4,
                "prescriptions": [
                    {
                        "intitule": "Fondations superficielles",
                        "corps": (
                            "Les fondations superficielles seront exécutées conformément au NF DTU 13.1 "
                            "et aux recommandations de l'étude géotechnique G2 Pro. La contrainte admissible "
                            "du sol sera {contrainte_sol:-0,20 MPa}. Largeur minimale de semelle : "
                            "{largeur_semelle:-0,60 m}. Profondeur de fondation conforme au hors-gel local. "
                            "Aucun bétonnage sans réception du fond de fouille par le géotechnicien."
                        ),
                        "type_prescription": "mise_en_oeuvre",
                        "niveau": "obligatoire",
                        "normes": ["NF DTU 13.1", "NF P 94-500", "NF EN 1997-1"],
                        "contient_variables": True,
                        "ordre": 1,
                    },
                ],
            },
        ],
    },

    # =========================================================================
    # FAC — Façades et bardages
    # =========================================================================
    {
        "code": "FAC",
        "intitule": "Façades et bardages",
        "description": (
            "Enduits de façade, isolation thermique par l'extérieur (ITE), "
            "bardages bois, métal et composite, ravalement."
        ),
        "normes_principales": [
            "NF DTU 26.1 — Travaux d'enduits de mortiers",
            "NF DTU 26.2 — Chapes et dalles à base de liants hydrauliques",
            "NF EN 998-1 — Mortiers pour enduits intérieurs et extérieurs",
            "NF EN 13914-1 — Application enduits extérieurs",
            "NF EN 13163 — Panneaux PSE (isolation extérieure)",
            "NF EN 13164 — Panneaux XPS",
            "NF EN 13494 — Systèmes ITE — résistance adhérence",
            "ETAG 004 — Systèmes composites d'isolation thermique par l'extérieur",
            "NF DTU 41.2 — Revêtements extérieurs en bois",
            "NF EN 14915 — Bardages bois massif et lamellé-collé",
            "NF EN 14782 — Feuilles métalliques autoportantes couverture/bardage",
            "NF EN 508-1 — Acier inoxydable couverture/bardage",
            "RE 2020 — Réglementation environnementale (performance thermique)",
            "NF EN 13830 — Murs-rideaux — norme produit",
            "Arrêté du 26/10/2010 — Caractéristiques thermiques bâtiments neufs",
        ],
        "ordre": 4,
        "chapitres": [
            {
                "numero": "1",
                "intitule": "Généralités",
                "ordre": 1,
                "prescriptions": [
                    {
                        "intitule": "Objet du lot façades",
                        "corps": (
                            "Le présent lot comprend l'ensemble des travaux de façade : enduits extérieurs, "
                            "isolation thermique par l'extérieur (ITE), bardages et habillages extérieurs. "
                            "L'entrepreneur vérifiera la compatibilité des systèmes avec le support béton "
                            "ou maçonnerie avant toute mise en œuvre. Tous les systèmes d'ITE doivent "
                            "disposer d'un Avis Technique (ATec) ou d'un Document Technique d'Application (DTA) "
                            "en cours de validité."
                        ),
                        "type_prescription": "generalites",
                        "niveau": "obligatoire",
                        "normes": ["NF DTU 26.1", "ETAG 004"],
                        "ordre": 1,
                    },
                    {
                        "intitule": "Isolation thermique par l'extérieur (ITE)",
                        "corps": (
                            "Le système ITE sera conforme à l'ATec ou DTA fourni. Résistance thermique "
                            "minimale de l'isolant : {R_isolant:-3,70 m²·K/W} (RE 2020). "
                            "Panneaux PSE (NF EN 13163) ou laine de roche (NF EN 13162). "
                            "Collage au mortier-colle puis fixation mécanique selon le DTU applicable. "
                            "Treillis de renfort fibres de verre dans l'enduit de base. "
                            "Finition en enduit de parement mince teinté dans la masse ou peinture minérale."
                        ),
                        "type_prescription": "mise_en_oeuvre",
                        "niveau": "obligatoire",
                        "normes": ["ETAG 004", "NF EN 13163", "NF EN 13164", "NF EN 13494", "RE 2020"],
                        "contient_variables": True,
                        "ordre": 2,
                    },
                    {
                        "intitule": "Enduits extérieurs",
                        "corps": (
                            "Les enduits extérieurs seront exécutés conformément au NF DTU 26.1. "
                            "Deux couches minimum sur maçonnerie : gobetis d'accrochage + corps d'enduit. "
                            "Finition selon plans. Mortier M5 minimum, conforme NF EN 998-1. "
                            "Joints de fractionnement tous les 3 m maximum pour éviter la fissuration. "
                            "Arrêts sur profilés de départ avec pare-pluie."
                        ),
                        "type_prescription": "mise_en_oeuvre",
                        "niveau": "obligatoire",
                        "normes": ["NF DTU 26.1", "NF EN 998-1", "NF EN 13914-1"],
                        "ordre": 3,
                    },
                ],
            },
        ],
    },

    # =========================================================================
    # MRC — Murs-rideaux
    # =========================================================================
    {
        "code": "MRC",
        "intitule": "Murs-rideaux",
        "description": (
            "Façades légères structurées en aluminium avec vitrages isolants, "
            "murs-rideaux et façades semi-rideaux."
        ),
        "normes_principales": [
            "NF EN 13830 — Murs-rideaux — norme produit",
            "NF EN 12207 — Fenêtres et portes — perméabilité à l'air",
            "NF EN 12208 — Fenêtres et portes — étanchéité à l'eau",
            "NF EN 12210 — Fenêtres et portes — résistance au vent",
            "NF EN 12211 — Fenêtres et portes — méthode d'essai résistance au vent",
            "NF EN 1279-2 — Verre feuilleté — essais longue durée",
            "NF EN 1279-5 — Vitrage isolant — marquage CE",
            "NF EN 14351-1 — Fenêtres et portes extérieures — marquage CE",
            "ETAG 002 — Systèmes de murs-rideaux",
            "DTU 33.1 — Façades rideaux",
            "NF EN 13022-1 — Vitrage structurel",
            "RE 2020 — Performance thermique (Uf, Ug, Psi)",
        ],
        "ordre": 5,
        "chapitres": [
            {
                "numero": "1",
                "intitule": "Généralités",
                "ordre": 1,
                "prescriptions": [
                    {
                        "intitule": "Objet du lot murs-rideaux",
                        "corps": (
                            "Le présent lot comprend la fourniture et pose des façades légères de type "
                            "mur-rideau, incluant profilés aluminium à rupture de pont thermique, vitrages "
                            "isolants, joints d'étanchéité et fixations. Les performances exigées sont :\n"
                            "— Perméabilité à l'air : classe {classe_air:-AE 2} (NF EN 12207)\n"
                            "— Étanchéité à l'eau : classe {classe_eau:-RE 7A} (NF EN 12208)\n"
                            "— Résistance au vent : classe {classe_vent:-WE C3} (NF EN 12210)\n"
                            "— Uf ≤ {Uf:-1,4} W/m²·K — Ug ≤ {Ug:-1,0} W/m²·K (RE 2020)"
                        ),
                        "type_prescription": "generalites",
                        "niveau": "obligatoire",
                        "normes": ["NF EN 13830", "NF EN 12207", "NF EN 12208", "NF EN 12210", "RE 2020"],
                        "contient_variables": True,
                        "ordre": 1,
                    },
                ],
            },
        ],
    },

    # =========================================================================
    # MOB — Construction ossature bois
    # =========================================================================
    {
        "code": "MOB",
        "intitule": "Construction ossature bois",
        "description": (
            "Charpente légère bois, ossature bois (MOB/COB), "
            "isolation entre montants, pare-vapeur et pare-pluie."
        ),
        "normes_principales": [
            "NF DTU 31.1 — Charpente et escaliers en bois",
            "NF DTU 31.2 — Construction de maisons et bâtiments à ossature bois",
            "NF DTU 31.4 — Façades en bois",
            "NF EN 1995-1-1 (EC5) — Conception des structures en bois",
            "NF EN 1995-1-2 (EC5) — Comportement au feu",
            "NF B 52-001 — Règles d'utilisation du bois en construction",
            "NF EN 14592 — Éléments d'assemblage — chevilles et vis",
            "NF EN 1912 — Bois de structure — classes de résistance",
            "NF EN 13986 — Panneaux dérivés du bois",
            "NF EN 13171 — Isolation thermique — panneaux de fibres de bois",
            "RE 2020 — Performance thermique des constructions bois",
            "Arrêté du 22/10/2010 — Classement au feu des matériaux",
        ],
        "ordre": 6,
        "chapitres": [
            {
                "numero": "1",
                "intitule": "Généralités",
                "ordre": 1,
                "prescriptions": [
                    {
                        "intitule": "Objet du lot ossature bois",
                        "corps": (
                            "Le présent lot comprend la fourniture et pose de la structure bois : "
                            "ossature porteuse (montants, lisses, traverses), revêtements de contreventement, "
                            "isolation thermique entre montants, pare-vapeur et pare-pluie. "
                            "Les bois de structure seront de classe de résistance {classe_bois:-C24} minimum "
                            "(NF EN 1912), avec marquage CE. Humidité des bois ≤ 18 % à la mise en œuvre. "
                            "Traitement fongicide classe 2 minimum (NF EN 335)."
                        ),
                        "type_prescription": "generalites",
                        "niveau": "obligatoire",
                        "normes": ["NF DTU 31.2", "NF EN 1995-1-1", "NF EN 1912", "NF EN 335"],
                        "contient_variables": True,
                        "ordre": 1,
                    },
                    {
                        "intitule": "Pare-vapeur et gestion de l'humidité",
                        "corps": (
                            "Le pare-vapeur sera continu, sans perforation, avec Sd ≥ 18 m. "
                            "Raccords et jonctions au ruban adhésif spécifique du système. "
                            "Lame d'air ventilée de 22 mm minimum entre isolant et bardage extérieur. "
                            "Pare-pluie respirant (Sd ≤ 0,02 m) côté extérieur. Vérification "
                            "hygrothermique selon NF EN ISO 13788."
                        ),
                        "type_prescription": "mise_en_oeuvre",
                        "niveau": "obligatoire",
                        "normes": ["NF DTU 31.2", "NF EN ISO 13788", "RE 2020"],
                        "ordre": 2,
                    },
                ],
            },
        ],
    },

    # =========================================================================
    # CHMET — Charpente métallique
    # =========================================================================
    {
        "code": "CHMET",
        "intitule": "Charpente métallique",
        "description": (
            "Charpente et structure en acier : portiques, poutres, poteaux, "
            "contreventements, ossature secondaire et bardage métallique."
        ),
        "normes_principales": [
            "NF DTU 32.1 — Charpente en acier",
            "NF EN 1993-1-1 (EC3) — Calcul des structures en acier",
            "NF EN 1993-1-2 (EC3) — Comportement au feu",
            "NF EN 10025-1 — Produits laminés à chaud — généralités",
            "NF EN 10025-2 — Aciers S235, S275, S355, S420, S460",
            "NF EN 10034 — Profils I et H en acier de construction",
            "NF EN 15048-1 — Assemblages boulonnés non précontraints",
            "NF EN 14399-1 — Boulons à serrage contrôlé",
            "NF EN 1090-2 — Exécution des structures en acier",
            "NF EN ISO 9692-1 — Soudage — préparation des joints",
            "NF EN 22553 — Représentation des soudures",
            "CM 66 — Règles de calcul des constructions en acier (référence historique)",
            "NF EN 1461 — Articles en fonte malléable galvanisée",
            "ISO 12944 — Peintures et vernis — anticorrosion",
        ],
        "ordre": 7,
        "chapitres": [
            {
                "numero": "1",
                "intitule": "Généralités",
                "ordre": 1,
                "prescriptions": [
                    {
                        "intitule": "Objet du lot charpente métallique",
                        "corps": (
                            "Le présent lot comprend la fourniture, fabrication en atelier et pose sur "
                            "chantier de la structure métallique : portiques, poteaux, poutres, pannes, "
                            "lisses, contreventements, platines d'ancrage et toutes sujétions. "
                            "L'acier sera de nuance {nuance_acier:-S235JR} minimum (NF EN 10025-2). "
                            "L'exécution sera de classe EXC2 conformément à NF EN 1090-2. "
                            "Les plans d'atelier seront soumis au visa du MOE avant fabrication."
                        ),
                        "type_prescription": "generalites",
                        "niveau": "obligatoire",
                        "normes": ["NF DTU 32.1", "NF EN 1993-1-1", "NF EN 1090-2", "NF EN 10025-2"],
                        "contient_variables": True,
                        "ordre": 1,
                    },
                    {
                        "intitule": "Protection contre la corrosion",
                        "corps": (
                            "La protection anticorrosion sera assurée selon ISO 12944 en fonction "
                            "de la catégorie de corrosivité de l'environnement :\n"
                            "— Intérieur sec (C2) : primaire époxy + finition alkyde\n"
                            "— Extérieur (C3) : galvanisation à chaud (NF EN ISO 1461) ou système "
                            "époxy bi-composant avec finition polyuréthane\n"
                            "Épaisseur de film sec minimum : {epaisseur_film:-120 µm} pour C3. "
                            "Teinte selon plan façade."
                        ),
                        "type_prescription": "mise_en_oeuvre",
                        "niveau": "obligatoire",
                        "normes": ["ISO 12944", "NF EN ISO 1461"],
                        "contient_variables": True,
                        "ordre": 2,
                    },
                ],
            },
        ],
    },

    # =========================================================================
    # CHCZ — Charpente-Couverture-Zinguerie
    # =========================================================================
    {
        "code": "CHCZ",
        "intitule": "Charpente-Couverture-Zinguerie",
        "description": (
            "Charpente bois traditionnelle ou industrielle, couverture tuiles/ardoises/zinc, "
            "évacuations pluviales, zinguerie."
        ),
        "normes_principales": [
            "NF DTU 31.1 — Charpente et escaliers en bois",
            "NF DTU 31.3 — Charpentes en fermettes à base de connecteurs métalliques",
            "NF DTU 40.11 — Ardoises naturelles",
            "NF DTU 40.14 — Ardoises de fibres-ciment",
            "NF DTU 40.21 — Tuiles en terre cuite à emboîtement",
            "NF DTU 40.22 — Tuiles en terre cuite à glissement",
            "NF DTU 40.23 — Tuiles en béton",
            "NF DTU 40.29 — Tuiles en terre cuite canal",
            "NF DTU 40.35 — Couverture en zinc",
            "NF DTU 40.41 — Couverture en ardoises de fibre-ciment",
            "NF EN 502 — Feuilles pour toitures en zinc",
            "NF EN 506 — Feuilles en cuivre ou alliage de cuivre",
            "NF DTU 40.5 — Évacuation des eaux pluviales",
            "NF EN 607 — Gouttières en PVC-U",
            "NF EN 612 — Gouttières et tuyaux de descente en acier/zinc",
            "NF EN 1991-1-3 (EC1) — Actions — neige",
            "NF EN 1991-1-4 (EC1) — Actions — vent",
        ],
        "ordre": 8,
        "chapitres": [
            {
                "numero": "1",
                "intitule": "Charpente",
                "ordre": 1,
                "prescriptions": [
                    {
                        "intitule": "Charpente bois — qualité et exécution",
                        "corps": (
                            "La charpente sera réalisée en bois massif ou lamellé-collé de classe "
                            "de résistance {classe_bois:-C24} (NF EN 1912). Humidité ≤ 18 % à la pose. "
                            "Pour les fermettes industrielles (NF DTU 31.3), les plans de calcul seront "
                            "fournis par le fabricant, signés par un ingénieur compétent. "
                            "Traitement fongique et insecticide classe 2 minimum (NF EN 335)."
                        ),
                        "type_prescription": "materiaux",
                        "niveau": "obligatoire",
                        "normes": ["NF DTU 31.1", "NF DTU 31.3", "NF EN 1912", "NF EN 335"],
                        "contient_variables": True,
                        "ordre": 1,
                    },
                ],
            },
            {
                "numero": "2",
                "intitule": "Couverture",
                "ordre": 2,
                "prescriptions": [
                    {
                        "intitule": "Couverture — pente et mise en œuvre",
                        "corps": (
                            "La couverture sera réalisée en {materiau_couverture:-tuiles béton}. "
                            "Pente minimale conforme au DTU applicable. Litelage ou voliges selon DTU. "
                            "Sous-toiture obligatoire si pente < 40 % ou en zone de vent et pluie. "
                            "Crochets inox pour ardoises, fixation selon DTU pour tuiles. "
                            "Faîtage, noues, arêtiers et rives conformes au DTU applicable."
                        ),
                        "type_prescription": "mise_en_oeuvre",
                        "niveau": "obligatoire",
                        "normes": ["NF DTU 40.21", "NF DTU 40.11", "NF DTU 40.35"],
                        "contient_variables": True,
                        "ordre": 1,
                    },
                    {
                        "intitule": "Zinguerie et évacuations pluviales",
                        "corps": (
                            "Les évacuations pluviales seront conformes au NF DTU 40.5. "
                            "Gouttières pendantes ou à l'anglaise en zinc (NF EN 502) ou cuivre (NF EN 506), "
                            "pente minimale 3 mm/m. Descentes d'eaux pluviales : section calculée selon "
                            "NF EN 12056-3. Solins, bavettes, noues et capotages en zinc ou plomb. "
                            "Protection anticorrosion des pièces de fixation."
                        ),
                        "type_prescription": "mise_en_oeuvre",
                        "niveau": "obligatoire",
                        "normes": ["NF DTU 40.5", "NF EN 502", "NF EN 506", "NF EN 12056-3"],
                        "ordre": 2,
                    },
                ],
            },
        ],
    },

    # =========================================================================
    # ETAN — Étanchéité
    # =========================================================================
    {
        "code": "ETAN",
        "intitule": "Étanchéité",
        "description": (
            "Étanchéité des toitures-terrasses (accessible, inaccessible, technique), "
            "relevés d'étanchéité, isolation thermique en toiture."
        ),
        "normes_principales": [
            "NF DTU 43.1 — Travaux d'étanchéité des toitures-terrasses",
            "NF DTU 43.2 — Toitures sur éléments porteurs en maçonnerie en bitume armé",
            "NF DTU 43.3 — Toitures en tôles d'acier nervurées avec revêtement d'étanchéité",
            "NF DTU 43.4 — Toitures en éléments porteurs bois avec revêtement d'étanchéité",
            "NF DTU 43.5 — Réfection des ouvrages d'étanchéité de toitures",
            "NF EN 13707 — Feuilles souples d'étanchéité — bitume armé pour toiture",
            "NF EN 13956 — Feuilles synthétiques pour toiture (PVC, TPO, EPDM)",
            "NF EN 13163 — Panneaux en PSE pour isolation toiture",
            "NF EN 13164 — Panneaux en XPS pour isolation toiture",
            "NF EN 13167 — Panneaux en verre cellulaire",
            "NF P 84-204 — Règles de l'art de l'étanchéité",
            "Règles RAGE 2012 — Étanchéité à l'air des bâtiments",
            "RE 2020 — Isolation toiture",
        ],
        "ordre": 9,
        "chapitres": [
            {
                "numero": "1",
                "intitule": "Généralités",
                "ordre": 1,
                "prescriptions": [
                    {
                        "intitule": "Objet du lot étanchéité",
                        "corps": (
                            "Le présent lot comprend l'étanchéité des toitures-terrasses, relevés, "
                            "isolation thermique associée, protections et finitions. "
                            "L'entrepreneur disposera d'un certificat de qualification professionnelle "
                            "(QUALIBAT 3111 ou équivalent). Tous les matériaux feront l'objet d'une "
                            "fiche technique remise au MOE avant commande. ATec exigé pour tout système "
                            "non couvert par un NF DTU."
                        ),
                        "type_prescription": "generalites",
                        "niveau": "obligatoire",
                        "normes": ["NF DTU 43.1", "NF EN 13707"],
                        "ordre": 1,
                    },
                    {
                        "intitule": "Isolation thermique de toiture",
                        "corps": (
                            "L'isolant de toiture sera de résistance thermique minimale "
                            "{R_toiture:-6,00 m²·K/W} (RE 2020). Panneaux PSE (NF EN 13163) ou "
                            "XPS (NF EN 13164) posés à joints décalés. Pente minimale de la forme "
                            "de pente : 1,5 %. Forme de pente en béton de ciment maigre ou en "
                            "panneaux isolants pentés selon ATec du système."
                        ),
                        "type_prescription": "mise_en_oeuvre",
                        "niveau": "obligatoire",
                        "normes": ["NF DTU 43.1", "NF EN 13163", "NF EN 13164", "RE 2020"],
                        "contient_variables": True,
                        "ordre": 2,
                    },
                    {
                        "intitule": "Relevés et points singuliers",
                        "corps": (
                            "Les relevés d'étanchéité seront exécutés sur une hauteur minimale de 0,15 m "
                            "au-dessus de la protection. Relevé sous couvre-joint ou fixation mécanique. "
                            "Platines de fixation de relevés à la charge du lot étanchéité. "
                            "Joints de dilatation des relevés tous les 5 m maximum. "
                            "Évacuations pluviales en nombre et position conformes aux plans, section "
                            "calculée selon NF EN 12056-3."
                        ),
                        "type_prescription": "mise_en_oeuvre",
                        "niveau": "obligatoire",
                        "normes": ["NF DTU 43.1", "NF EN 12056-3"],
                        "ordre": 3,
                    },
                ],
            },
        ],
    },

    # =========================================================================
    # MENUEXT — Menuiseries extérieures
    # =========================================================================
    {
        "code": "MENUEXT",
        "intitule": "Menuiseries extérieures",
        "description": (
            "Fenêtres, portes-fenêtres, portes d'entrée, volets, "
            "vitrages isolants, fermetures et occultations."
        ),
        "normes_principales": [
            "NF EN 14351-1 — Fenêtres et portes extérieures — marquage CE",
            "NF DTU 36.1 — Menuiserie en bois",
            "NF DTU 36.2 — Menuiserie en aluminium — fenêtres, portes-fenêtres",
            "NF DTU 36.5 — Mise en œuvre des fenêtres et portes extérieures",
            "NF DTU 37.1 — Menuiserie métallique : portes, fenêtres, façades",
            "NF EN 12207 — Fenêtres et portes — perméabilité à l'air (classes 1 à 4)",
            "NF EN 12208 — Fenêtres et portes — étanchéité à l'eau (classes 1A à E9A)",
            "NF EN 12210 — Fenêtres et portes — résistance au vent (classes 1 à C5)",
            "NF EN 1279-5 — Vitrage isolant — marquage CE",
            "NF EN 1096-4 — Verre à couche basse-émissivité",
            "NF EN 12150 — Verre trempé de sécurité",
            "NF EN 14449 — Verre feuilleté de sécurité",
            "NF EN ISO 6946 — Résistance thermique et coefficient U des parois",
            "RE 2020 — Performance Uw ≤ 1,3 W/m²·K (fenêtres neuves logement)",
            "NF P 01-012 — Sécurité garde-corps",
        ],
        "ordre": 10,
        "chapitres": [
            {
                "numero": "1",
                "intitule": "Généralités",
                "ordre": 1,
                "prescriptions": [
                    {
                        "intitule": "Objet du lot menuiseries extérieures",
                        "corps": (
                            "Le présent lot comprend la fourniture et pose de toutes les menuiseries "
                            "extérieures : fenêtres, portes-fenêtres, portes d'entrée, volets roulants "
                            "et battants, occultations. Performances minimales exigées :\n"
                            "— Perméabilité à l'air : classe {classe_air_mext:-3} (NF EN 12207)\n"
                            "— Étanchéité à l'eau : classe {classe_eau_mext:-7A} (NF EN 12208)\n"
                            "— Résistance au vent : classe {classe_vent_mext:-C2} (NF EN 12210)\n"
                            "— Uw ≤ {Uw:-1,3} W/m²·K (RE 2020)"
                        ),
                        "type_prescription": "generalites",
                        "niveau": "obligatoire",
                        "normes": ["NF EN 14351-1", "NF EN 12207", "NF EN 12208", "NF EN 12210", "RE 2020"],
                        "contient_variables": True,
                        "ordre": 1,
                    },
                    {
                        "intitule": "Vitrages isolants",
                        "corps": (
                            "Les doubles vitrages seront de type {type_vitrage:-4/16Ar/4} avec lame d'argon. "
                            "Coefficient Ug ≤ {Ug_ext:-1,1} W/m²·K, facteur solaire g ≤ {g_ext:-0,60}. "
                            "Verre feuilleté de sécurité (NF EN 14449) en allège et parties basses "
                            "(< 0,90 m du sol). Verre trempé (NF EN 12150) pour surfaces > 3 m² ou "
                            "zones de circulation. Marquage CE obligatoire (NF EN 1279-5)."
                        ),
                        "type_prescription": "materiaux",
                        "niveau": "obligatoire",
                        "normes": ["NF EN 1279-5", "NF EN 12150", "NF EN 14449"],
                        "contient_variables": True,
                        "ordre": 2,
                    },
                    {
                        "intitule": "Pose et calfeutrement",
                        "corps": (
                            "La mise en œuvre sera conforme au NF DTU 36.5. Appui sur cales de "
                            "déchargement. Calfeutrement périphérique : fond de joint polyéthylène + "
                            "mastic silicone neutre bicomposant ou mastics joints à froid. "
                            "Mousse polyuréthane interdite en joint final visible. "
                            "Lame d'air ventilée entre dormant et tableau si menuiseries rénovées."
                        ),
                        "type_prescription": "mise_en_oeuvre",
                        "niveau": "obligatoire",
                        "normes": ["NF DTU 36.5", "NF DTU 36.1"],
                        "ordre": 3,
                    },
                ],
            },
        ],
    },

    # =========================================================================
    # MENUINT — Menuiseries intérieures et serrurerie
    # =========================================================================
    {
        "code": "MENUINT",
        "intitule": "Menuiseries intérieures et serrurerie",
        "description": (
            "Portes intérieures, blocs-portes, cloisons, placards, "
            "huisseries, quincailleries et garde-corps intérieurs."
        ),
        "normes_principales": [
            "NF DTU 36.1 — Menuiserie en bois",
            "NF DTU 37.1 — Menuiserie métallique",
            "NF EN 14351-2 — Portes intérieures — marquage CE",
            "NF P 01-012 — Sécurité — garde-corps des bâtiments",
            "NF P 01-013 — Sécurité — garde-corps — essais",
            "NF EN 1154 — Ferme-portes — exigences et méthodes d'essai",
            "NF EN 1303 — Serrures à cylindre — exigences",
            "NF EN 12046-1 — Forces d'actionnement des portes",
            "NF EN 1634-1 — Résistance au feu des portes et volets",
            "Réglementation ERP — Portes EI30, EI60, EI90",
            "NF S 61-937 — Sécurité incendie — sécurité des personnes",
            "Arrêté du 01/08/2006 — Accessibilité PMR",
        ],
        "ordre": 11,
        "chapitres": [
            {
                "numero": "1",
                "intitule": "Généralités",
                "ordre": 1,
                "prescriptions": [
                    {
                        "intitule": "Objet du lot menuiseries intérieures",
                        "corps": (
                            "Le présent lot comprend la fourniture et pose de toutes les menuiseries "
                            "intérieures : blocs-portes, huisseries, placards, cloisons légères, "
                            "garde-corps intérieurs et quincaillerie. Les blocs-portes coupe-feu "
                            "seront conformes aux exigences règlementaires (EI30, EI60 selon ERP). "
                            "Accessibilité PMR : largeur utile ≥ 0,83 m pour les portes principales."
                        ),
                        "type_prescription": "generalites",
                        "niveau": "obligatoire",
                        "normes": ["NF DTU 36.1", "NF EN 1634-1", "Arrêté du 01/08/2006"],
                        "ordre": 1,
                    },
                    {
                        "intitule": "Garde-corps intérieurs",
                        "corps": (
                            "Les garde-corps seront conformes à la NF P 01-012. "
                            "Hauteur minimale : {hauteur_gc:-1,00 m} pour les logements, 1,10 m si la "
                            "partie basse est franchissable (h < 0,45 m). Résistance à la poussée "
                            "linéique ≥ 1,0 kN/m. Verre feuilleté 33.2 minimum si garde-corps vitré. "
                            "Aucun barreau horizontal favorisant l'escalade."
                        ),
                        "type_prescription": "mise_en_oeuvre",
                        "niveau": "obligatoire",
                        "normes": ["NF P 01-012", "NF P 01-013"],
                        "contient_variables": True,
                        "ordre": 2,
                    },
                ],
            },
        ],
    },

    # =========================================================================
    # IPP — Isolation-Plâtrerie-Peinture
    # =========================================================================
    {
        "code": "IPP",
        "intitule": "Isolation-Plâtrerie-Peinture",
        "description": (
            "Cloisons, doublages, plafonds suspendus, isolation acoustique et thermique "
            "intérieure, plâtrerie, peintures et revêtements muraux."
        ),
        "normes_principales": [
            "NF DTU 25.1 — Travaux de bâtiment — enduits aux plâtres",
            "NF DTU 25.31 — Ouvrages verticaux en plâtre — cloisons menuisées",
            "NF DTU 25.41 — Ouvrages en plaques de plâtre",
            "NF DTU 45.10 — Isolation des combles perdus par soufflage",
            "NF DTU 45.11 — Isolation thermique des combles par laines",
            "NF DTU 59.1 — Travaux de peintures — spécifications",
            "NF DTU 59.2 — Travaux de revêtements plastiques épais sur béton",
            "NF DTU 59.3 — Travaux de peinture de sols",
            "NF EN 13162 — Produits isolants — laine minérale (LM)",
            "NF EN 13163 — Produits isolants — mousse de polystyrène expansé (PSE)",
            "NF EN 13171 — Produits isolants — panneaux de fibres de bois",
            "NF EN 520 — Plaques de plâtre — définitions et spécifications",
            "NF EN 14190 — Produits dérivés des plaques de plâtre",
            "RE 2020 — Résistance thermique des parois intérieures",
            "NRA 2000 (NF S 31-073) — Acoustique des bâtiments — logements",
            "NF EN ISO 10140 — Acoustique en laboratoire des éléments de construction",
            "Arrêté du 30/05/1996 — Règlement de construction acoustique",
        ],
        "ordre": 12,
        "chapitres": [
            {
                "numero": "1",
                "intitule": "Cloisons et doublages",
                "ordre": 1,
                "prescriptions": [
                    {
                        "intitule": "Cloisons distributives",
                        "corps": (
                            "Les cloisons distributives seront réalisées en plaques de plâtre sur ossature "
                            "métallique (NF DTU 25.41). Composition standard : "
                            "{composition_cloison:-BA13 / 48/150 + laine 45 / BA13}. "
                            "Indice d'affaiblissement acoustique Rw+C ≥ {Rw_cloison:-45} dB. "
                            "Plaques hydrofugées (H) dans les locaux humides (salle de bains, cuisine). "
                            "Plaques techniques (F ou FR) selon classement de réaction au feu exigé."
                        ),
                        "type_prescription": "mise_en_oeuvre",
                        "niveau": "obligatoire",
                        "normes": ["NF DTU 25.41", "NF EN 520", "NRA 2000"],
                        "contient_variables": True,
                        "ordre": 1,
                    },
                    {
                        "intitule": "Doublage isolant",
                        "corps": (
                            "Les doublages thermiques sur murs extérieurs seront composés d'une lame d'air "
                            "de 20 mm minimum et d'un panneau isolant (laine de verre NF EN 13162 ou "
                            "PSE NF EN 13163) avec résistance thermique {R_doublage:-3,20 m²·K/W} minimum. "
                            "Plaques de plâtre BA13 sur ossature métallique ou collées selon NF DTU 25.41. "
                            "Pare-vapeur continu côté chaud (intérieur)."
                        ),
                        "type_prescription": "mise_en_oeuvre",
                        "niveau": "obligatoire",
                        "normes": ["NF DTU 25.41", "NF EN 13162", "NF EN 13163", "RE 2020"],
                        "contient_variables": True,
                        "ordre": 2,
                    },
                ],
            },
            {
                "numero": "2",
                "intitule": "Peintures et finitions",
                "ordre": 2,
                "prescriptions": [
                    {
                        "intitule": "Peintures intérieures",
                        "corps": (
                            "Les travaux de peinture seront exécutés conformément au NF DTU 59.1. "
                            "Degré de finition selon destination :\n"
                            "— Parties communes (logements) : degré 2 (courant)\n"
                            "— Logements et bureaux : degré 2 (courant)\n"
                            "— Locaux de prestige : degré 3 (soigné)\n"
                            "Impression sur supports neufs avant toute peinture. "
                            "COV des peintures : classe A+ (émissions faibles) obligatoire. "
                            "Nombre de couches : {nb_couches:-2} couches de finition après impression."
                        ),
                        "type_prescription": "mise_en_oeuvre",
                        "niveau": "obligatoire",
                        "normes": ["NF DTU 59.1", "NF EN 13300"],
                        "contient_variables": True,
                        "ordre": 1,
                    },
                ],
            },
        ],
    },

    # =========================================================================
    # RSC — Revêtements de sols et carrelage
    # =========================================================================
    {
        "code": "RSC",
        "intitule": "Revêtements de sols et carrelage",
        "description": (
            "Carrelage collé et scellé, parquets collés et flottants, "
            "revêtements de sols souples, chapes, ragréages."
        ),
        "normes_principales": [
            "NF DTU 52.1 — Revêtements de sol scellés",
            "NF DTU 52.2 — Pose collée des revêtements céramiques et assimilés",
            "NF DTU 52.3 — Revêtements de sol en carreaux et dalles de pierres naturelles",
            "NF DTU 51.1 — Pose des parquets à clouer",
            "NF DTU 51.2 — Parquet collé",
            "NF DTU 51.3 — Planchers en bois ou panneaux dérivés du bois",
            "NF DTU 53.1 — Revêtements de sol textiles",
            "NF DTU 53.2 — Revêtements de sol PVC collés",
            "NF EN 12004-1 — Colles pour carrelage — définitions, spécifications",
            "NF EN 13813 — Chapes de sol — définitions, spécifications",
            "NF EN ISO 10545 — Carrelages céramiques — caractéristiques",
            "Classement UPEC — Usage, Poinçonnement, Eau, produits Chimiques",
            "NF EN 13748-1 — Carreaux en terrazzo",
            "NF EN 14411 — Carreaux céramiques — définitions et classification",
            "NF EN 1186 — Matériaux et articles en contact avec les denrées",
            "NF P 61-203 — Revêtements de sol — méthodes d'essai",
        ],
        "ordre": 13,
        "chapitres": [
            {
                "numero": "1",
                "intitule": "Préparation des supports et chapes",
                "ordre": 1,
                "prescriptions": [
                    {
                        "intitule": "Chape de ragréage et nivellement",
                        "corps": (
                            "Les supports recevront un ragréage autolissant ou fibré conformément à la "
                            "NF EN 13813 avant pose de tout revêtement. Épaisseur minimale : 3 mm. "
                            "Planéité du support après ragréage : écart < 3 mm sous la règle de 2 m. "
                            "Humidité résiduelle ≤ 3 % avant pose de revêtements (mesure à l'hygromètre). "
                            "Primaire d'accrochage sur béton lisse ou ancien carrelage."
                        ),
                        "type_prescription": "mise_en_oeuvre",
                        "niveau": "obligatoire",
                        "normes": ["NF EN 13813", "NF DTU 52.1", "NF DTU 52.2"],
                        "ordre": 1,
                    },
                ],
            },
            {
                "numero": "2",
                "intitule": "Carrelage",
                "ordre": 2,
                "prescriptions": [
                    {
                        "intitule": "Carrelage collé — matériaux et classement UPEC",
                        "corps": (
                            "Les carreaux céramiques seront conformes à la NF EN 14411. "
                            "Classement UPEC minimal selon usage :\n"
                            "— Séjours, chambres : U2P2E2\n"
                            "— Cuisines, salles de bains : U3P3E3\n"
                            "— Circulations, halls : U3P3E2\n"
                            "— Extérieur : U4P4E3C2\n"
                            "Colle C2 (NF EN 12004) minimum, C2F en zones humides, C2TE sur plancher "
                            "chauffant. Joints de dilatation tous les 3 m maximum, remplis de mastic."
                        ),
                        "type_prescription": "materiaux",
                        "niveau": "obligatoire",
                        "normes": ["NF DTU 52.2", "NF EN 14411", "NF EN 12004-1"],
                        "ordre": 1,
                    },
                    {
                        "intitule": "Tolérance et réception du carrelage",
                        "corps": (
                            "Tolérance de planéité : ± 3 mm sous la règle de 2 m. "
                            "Tolérance d'alignement des joints : ± 1 mm/m. "
                            "Absence de pièce sonnant creux (test au marteau). "
                            "Les carrelages anti-dérapants R9 minimum pour les sols extérieurs et "
                            "locaux humides, R11 pour les terrasses et abords de piscine."
                        ),
                        "type_prescription": "tolerances",
                        "niveau": "obligatoire",
                        "normes": ["NF DTU 52.2", "NF P 61-203"],
                        "ordre": 2,
                    },
                ],
            },
            {
                "numero": "3",
                "intitule": "Parquets",
                "ordre": 3,
                "prescriptions": [
                    {
                        "intitule": "Parquet collé",
                        "corps": (
                            "Les parquets massifs ou contrecollés seront posés conformément au NF DTU 51.2. "
                            "Taux d'humidité du bois ≤ 10 %. Humidité du support (béton/chape) ≤ 3 %. "
                            "Colle polyuréthane mono ou bicomposante, étalée à la spatule crantée. "
                            "Laisser une dilatation périphérique de 10 mm. Ponçage et vitrification "
                            "après pose si parquet massif brut."
                        ),
                        "type_prescription": "mise_en_oeuvre",
                        "niveau": "obligatoire",
                        "normes": ["NF DTU 51.2"],
                        "ordre": 1,
                    },
                ],
            },
        ],
    },

    # =========================================================================
    # ELEC — Électricité
    # =========================================================================
    {
        "code": "ELEC",
        "intitule": "Électricité courants forts et faibles",
        "description": (
            "Distribution électrique BT, tableaux, éclairage, prises, "
            "câblage courants faibles (VDI, alarme, contrôle d'accès, vidéosurveillance)."
        ),
        "normes_principales": [
            "NF C 15-100 — Installations électriques basse tension",
            "NF C 14-100 — Installations de branchement BT",
            "NF EN 60898-1 — Disjoncteurs pour installations domestiques",
            "NF EN 60947-2 — Disjoncteurs industriels",
            "NF EN 61439-1 — Ensembles d'appareillage basse tension",
            "UTE C 15-520 — Canalisations — modes de pose",
            "NF C 63-021 — Prises de courant — spécifications",
            "NF C 15-900 — Installations photovoltaïques raccordées au réseau",
            "NF C 17-200 — Installations d'éclairage extérieur",
            "NF EN 12464-1 — Éclairage des lieux de travail intérieurs",
            "NF EN 12464-2 — Éclairage des lieux de travail extérieurs",
            "NF EN 1838 — Éclairage de sécurité",
            "NF C 48-150 — Câbles d'énergie — classement au feu",
            "UTE C 15-401 — Chauffage électrique à accumulation",
            "RE 2020 — Consommation énergie primaire des installations",
            "Décret 2011-1700 — Réglementation thermique (CEP)",
        ],
        "ordre": 14,
        "chapitres": [
            {
                "numero": "1",
                "intitule": "Généralités",
                "ordre": 1,
                "prescriptions": [
                    {
                        "intitule": "Objet du lot électricité",
                        "corps": (
                            "Le présent lot comprend tous les travaux d'installation électrique basse "
                            "tension, courants forts et faibles : TGBT, tableau de distribution, "
                            "câblage, appareillages, éclairage intérieur et extérieur, détection "
                            "incendie, câblage VDI, contrôle d'accès et vidéosurveillance. "
                            "L'entreprise sera certifiée QUALIFELEC R ou équivalent. "
                            "Conformité obligatoire à la NF C 15-100."
                        ),
                        "type_prescription": "generalites",
                        "niveau": "obligatoire",
                        "normes": ["NF C 15-100", "NF C 14-100"],
                        "ordre": 1,
                    },
                    {
                        "intitule": "Documents de référence électricité",
                        "corps": (
                            "Les installations seront exécutées conformément :\n"
                            "— NF C 15-100 : Installations électriques basse tension\n"
                            "— UTE C 15-520 : Canalisations — modes de pose\n"
                            "— NF EN 12464-1 : Éclairage des lieux de travail intérieurs\n"
                            "— NF EN 1838 : Éclairage de sécurité\n"
                            "— NF C 17-200 : Éclairage extérieur\n"
                            "— Règlement sécurité incendie type ERP/IGH si applicable\n"
                            "— RE 2020 : Performance énergétique"
                        ),
                        "type_prescription": "documents_reference",
                        "niveau": "obligatoire",
                        "normes": ["NF C 15-100", "UTE C 15-520", "NF EN 12464-1", "NF EN 1838", "NF C 17-200", "RE 2020"],
                        "ordre": 2,
                    },
                    {
                        "intitule": "Vérifications et essais",
                        "corps": (
                            "Avant la réception, l'entrepreneur réalisera les vérifications initiales "
                            "conformément à la NF C 15-100 art. 61 : mesure de résistance d'isolement, "
                            "essai de continuité des conducteurs de protection, mesure de la résistance "
                            "de la prise de terre (≤ 30 Ω), test des disjoncteurs différentiels. "
                            "Un rapport de vérification sera fourni au MOE."
                        ),
                        "type_prescription": "controles",
                        "niveau": "obligatoire",
                        "normes": ["NF C 15-100"],
                        "ordre": 3,
                    },
                ],
            },
        ],
    },

    # =========================================================================
    # PLB — Plomberie sanitaires
    # =========================================================================
    {
        "code": "PLB",
        "intitule": "Plomberie sanitaires",
        "description": (
            "Alimentation en eau froide et chaude, appareils sanitaires, "
            "évacuations EU/EV/EP, production eau chaude sanitaire."
        ),
        "normes_principales": [
            "NF DTU 60.1 — Travaux de bâtiment — canalisations en cuivre",
            "NF DTU 60.11 — Règles de calcul des installations EF et ECS",
            "NF DTU 60.2 — Canalisations en chlorure de polyvinyle non plastifié",
            "NF DTU 60.31 — Travaux de bâtiment — canalisations en PVC évacuation",
            "NF DTU 60.32 — Canalisations en polypropylène renforcé",
            "NF DTU 64.1 — Mise en œuvre des dispositifs d'assainissement autonome",
            "NF DTU 65.10 — Canalisations d'eau chaude ou froide sous pression",
            "NF EN 806-1 à 806-5 — Installations sanitaires — eau à l'intérieur des bâtiments",
            "NF EN 1057 — Tubes en cuivre ronds — spécifications",
            "NF EN ISO 15875 — Systèmes de canalisations PER",
            "NF EN 12056-1 à 12056-5 — Systèmes d'évacuation gravitaire intérieur",
            "NF EN 14154 — Compteurs d'eau",
            "Arrêté du 30/11/2005 — Qualité de l'eau potable (paramètres sanitaires)",
            "Règlement sanitaire départemental (RSD) — Installations d'eau sanitaire",
            "Arrêté du 23/06/1978 — Installations fixes destinées au chauffage et ECS",
        ],
        "ordre": 15,
        "chapitres": [
            {
                "numero": "1",
                "intitule": "Alimentation en eau",
                "ordre": 1,
                "prescriptions": [
                    {
                        "intitule": "Canalisations d'alimentation",
                        "corps": (
                            "Les canalisations d'eau froide et chaude sanitaire seront en cuivre "
                            "(NF EN 1057) ou PER (NF EN ISO 15875). Les assemblages seront réalisés "
                            "par soudure brasure tendre (cuivre) ou sertissage (PER/multicouche). "
                            "Isolation thermique des tuyauteries ECS : épaisseur conforme à la RE 2020. "
                            "Pose avec pente minimum 3 mm/m vers les points bas avec robinets de vidange. "
                            "Pression d'épreuve : 1,5 × pression de service, maintenue 30 min."
                        ),
                        "type_prescription": "mise_en_oeuvre",
                        "niveau": "obligatoire",
                        "normes": ["NF DTU 60.1", "NF EN 1057", "NF EN ISO 15875", "NF EN 806-3"],
                        "ordre": 1,
                    },
                    {
                        "intitule": "Évacuations EU/EV",
                        "corps": (
                            "Les évacuations eaux usées (EU) et eaux vannes (EV) seront en PVC série B "
                            "ou SN4 (NF DTU 60.31). Pente minimale : {pente_eu:-1,5} cm/m pour EU, "
                            "1 cm/m pour EV. Accès de dégorgement tous les 10 m maximum. "
                            "Siphons de sol inox ou fonte dans les zones humides. "
                            "Colonnes de chute en PVC phonique dans les locaux habitables."
                        ),
                        "type_prescription": "mise_en_oeuvre",
                        "niveau": "obligatoire",
                        "normes": ["NF DTU 60.31", "NF EN 12056-2"],
                        "contient_variables": True,
                        "ordre": 2,
                    },
                ],
            },
            {
                "numero": "2",
                "intitule": "Appareils sanitaires",
                "ordre": 2,
                "prescriptions": [
                    {
                        "intitule": "Appareils sanitaires — qualité et pose",
                        "corps": (
                            "Les appareils sanitaires seront de la gamme {gamme_sanitaires:-standard} "
                            "avec marquage CE. Pose conformément aux notices fabricant et au DTU 60.1. "
                            "Joints silicone neutre à l'interface avec les parois. "
                            "Robinetterie monocommande conforme NF EN 817, débit ≤ {debit_robinet:-8} L/min. "
                            "WC : réservoir 6/3 L dual-flush obligatoire (économie d'eau)."
                        ),
                        "type_prescription": "mise_en_oeuvre",
                        "niveau": "obligatoire",
                        "normes": ["NF DTU 60.1", "NF EN 817", "NF EN 806-5"],
                        "contient_variables": True,
                        "ordre": 1,
                    },
                ],
            },
        ],
    },

    # =========================================================================
    # CVC — Chauffage Ventilation Climatisation
    # =========================================================================
    {
        "code": "CVC",
        "intitule": "CVC — Chauffage Ventilation Climatisation",
        "description": (
            "Chauffage central (chaudière, PAC, plancher chauffant), "
            "ventilation mécanique contrôlée (VMC), climatisation."
        ),
        "normes_principales": [
            "NF DTU 65.11 — Dispositifs d'évacuation des produits de combustion",
            "NF DTU 65.12 — Réseaux de distribution de chaleur",
            "NF DTU 68.3 — Travaux de bâtiment — installation de VMC",
            "NF EN 12831-1 — Performance énergétique des bâtiments — calcul de déperditions",
            "NF EN 12831-3 — Puissance de chauffage des locaux",
            "NF EN 13384-1 — Systèmes de conduits de fumée — calcul thermique",
            "NF EN 13779 — Ventilation des bâtiments non résidentiels",
            "NF EN 15316-4-1 — Chauffage par les espaces — chaudières",
            "NF EN 14825 — Conditionneurs d'air — essais à charge partielle",
            "RE 2020 — Performance énergie primaire et Cep",
            "Arrêté du 23/06/1978 — Installations chauffage et ECS",
            "Arrêté du 02/08/1977 — VMC logement",
            "Décret 2016-1104 — Plancher chauffant hydroélectrique",
            "NF EN 1264-1 à 1264-5 — Systèmes de planchers chauffants",
        ],
        "ordre": 16,
        "chapitres": [
            {
                "numero": "1",
                "intitule": "Généralités",
                "ordre": 1,
                "prescriptions": [
                    {
                        "intitule": "Objet du lot CVC",
                        "corps": (
                            "Le présent lot comprend l'ensemble des équipements de chauffage, ventilation "
                            "et climatisation : production (chaudière, PAC), émetteurs, réseau de "
                            "distribution, VMC et climatisation. L'entreprise sera certifiée QUALICLIMÉ "
                            "ou équivalent. Les calculs de puissance seront réalisés selon NF EN 12831-1 "
                            "avec les données climatiques de la zone {zone_climatique:-H1a}."
                        ),
                        "type_prescription": "generalites",
                        "niveau": "obligatoire",
                        "normes": ["NF DTU 65.11", "NF EN 12831-1", "RE 2020"],
                        "contient_variables": True,
                        "ordre": 1,
                    },
                    {
                        "intitule": "VMC — Ventilation mécanique contrôlée",
                        "corps": (
                            "La VMC sera de type {type_vmc:-double flux} avec échangeur à haute efficacité "
                            "(η ≥ 85 % pour double flux, RE 2020). Conformité au NF DTU 68.3 et à l'arrêté "
                            "du 02/08/1977. Débits minimaux conformes à NF EN 15251 et RE 2020. "
                            "Étanchéité des réseaux : classe D selon EN 12237. "
                            "Niveaux acoustiques : Lw ≤ {Lw_vmc:-30} dB(A) en service."
                        ),
                        "type_prescription": "mise_en_oeuvre",
                        "niveau": "obligatoire",
                        "normes": ["NF DTU 68.3", "NF EN 13779", "RE 2020"],
                        "contient_variables": True,
                        "ordre": 2,
                    },
                    {
                        "intitule": "Équilibrage et réglage",
                        "corps": (
                            "L'installation sera équilibrée et réglée selon les préconisations du bureau "
                            "d'études thermiques. Un procès-verbal de mise en service sera établi, "
                            "incluant : puissances mesurées, températures de consigne, débits VMC mesurés. "
                            "DOE (Dossier des Ouvrages Exécutés) complet remis au maître d'ouvrage."
                        ),
                        "type_prescription": "reception",
                        "niveau": "obligatoire",
                        "normes": ["NF DTU 65.12", "NF EN 12831-1"],
                        "ordre": 3,
                    },
                ],
            },
        ],
    },

    # =========================================================================
    # ASC — Ascenseur et monte-charge
    # =========================================================================
    {
        "code": "ASC",
        "intitule": "Ascenseur et monte-charge",
        "description": (
            "Ascenseurs électriques et hydrauliques, monte-charges, "
            "accessibilité PMR, conformité directive européenne."
        ),
        "normes_principales": [
            "NF EN 81-1 — Règles de sécurité — ascenseurs électriques",
            "NF EN 81-2 — Règles de sécurité — ascenseurs hydrauliques",
            "NF EN 81-20 — Règles de sécurité — ascenseurs neufs (remplacement EN 81-1/2)",
            "NF EN 81-50 — Règles de conception et essais — composants",
            "NF EN 81-70 — Accessibilité des ascenseurs — PMR",
            "NF EN 81-73 — Comportement au feu (évacuation personnes)",
            "NF EN 115-1 — Escaliers mécaniques et trottoirs roulants",
            "Directive 2014/33/UE — Ascenseurs et composants de sécurité",
            "Décret n° 2004-964 du 09/09/2004 — Ascenseurs — obligations",
            "Arrêté du 18/11/2004 — Appareils d'ascenseur — obligation de mise en conformité",
            "Arrêté du 01/08/2006 — Accessibilité PMR bâtiments (cabine 1,10 × 1,40 m min.)",
            "NF EN 13015 — Maintenance pour ascenseurs et escaliers mécaniques",
        ],
        "ordre": 17,
        "chapitres": [
            {
                "numero": "1",
                "intitule": "Généralités",
                "ordre": 1,
                "prescriptions": [
                    {
                        "intitule": "Objet du lot ascenseur",
                        "corps": (
                            "Le présent lot comprend la fourniture, l'installation, la mise en service "
                            "et la maintenance pendant la période de garantie de {nb_ascenseurs:-1} "
                            "ascenseur(s). Caractéristiques minimales :\n"
                            "— Charge nominale : {charge_nominale:-630} kg ({nb_personnes:-8} personnes)\n"
                            "— Vitesse : {vitesse:-1,0} m/s\n"
                            "— Niveaux desservis : {nb_niveaux:-} niveaux\n"
                            "— Cabine PMR : {largeur_cab:-1,10} × {profondeur_cab:-1,40} m (NF EN 81-70)\n"
                            "Marquage CE obligatoire (Directive 2014/33/UE). Déclaration de conformité fournie."
                        ),
                        "type_prescription": "generalites",
                        "niveau": "obligatoire",
                        "normes": ["NF EN 81-20", "NF EN 81-70", "Directive 2014/33/UE"],
                        "contient_variables": True,
                        "ordre": 1,
                    },
                    {
                        "intitule": "Maintenance et contrat",
                        "corps": (
                            "Un contrat de maintenance «Liftud» ou équivalent sera souscrit pour une durée "
                            "de {duree_maintenance:-12} mois à compter de la réception. Visites semestrielles "
                            "obligatoires (décret 2004-964). Le carnet d'entretien sera tenu à jour et "
                            "accessible au propriétaire à tout moment. Contrôle technique quinquennal "
                            "obligatoire par organisme agréé."
                        ),
                        "type_prescription": "entretien",
                        "niveau": "obligatoire",
                        "normes": ["NF EN 13015", "Décret n° 2004-964"],
                        "contient_variables": True,
                        "ordre": 2,
                    },
                ],
            },
        ],
    },

    # =========================================================================
    # PAY — Aménagements paysagers et espaces verts
    # =========================================================================
    {
        "code": "PAY",
        "intitule": "Aménagements paysagers et espaces verts",
        "description": (
            "Plantations, gazons, aménagements extérieurs paysagers, "
            "arrosage automatique, mobilier urbain."
        ),
        "normes_principales": [
            "NF V 12-055 — Matériaux terreux — terre végétale",
            "NF V 12-040 — Plants forestiers",
            "NF V 12-051 — Plants de pépinière — arbres",
            "NF V 12-052 — Plants de pépinière — arbustes",
            "NF P 98-200 — Chaussées et voiries",
            "NF EN 1176-1 — Équipements d'aires de jeux — généralités",
            "NF EN 1177 — Revêtements de sols absorbant les chocs",
            "NF EN 14966 — Géotextiles — caractéristiques",
            "Norme NFU 44-051 — Amendements organiques",
            "Guide PLANTE & CITÉ — Référentiel technique des espaces verts",
        ],
        "ordre": 18,
        "chapitres": [
            {
                "numero": "1",
                "intitule": "Généralités",
                "ordre": 1,
                "prescriptions": [
                    {
                        "intitule": "Objet du lot paysager",
                        "corps": (
                            "Le présent lot comprend : préparation des terres, plantations d'arbres et "
                            "arbustes, création de gazons et prairie, arrosage automatique, fourniture "
                            "et pose de mobilier de jardin et clôtures paysagères. "
                            "Les végétaux seront conformes aux normes NF V 12-051 et NF V 12-052 et "
                            "accompagnés d'un passeport phytosanitaire. Garantie de reprise : "
                            "{garantie_reprise:-1} an à compter de la réception des travaux."
                        ),
                        "type_prescription": "generalites",
                        "niveau": "obligatoire",
                        "normes": ["NF V 12-051", "NF V 12-052", "NF V 12-055"],
                        "contient_variables": True,
                        "ordre": 1,
                    },
                    {
                        "intitule": "Terre végétale et amendements",
                        "corps": (
                            "La terre végétale utilisée sera conforme à NF V 12-055 : "
                            "pH entre 6,0 et 7,5, teneur en matière organique ≥ 2 %, "
                            "absence de cailloux > 40 mm. Épaisseur minimale : "
                            "{ep_terre_vegetale:-0,40} m pour gazons, {ep_arbustes:-0,60} m pour arbustes. "
                            "Amendement calcaire ou organique selon résultats d'analyse de sol."
                        ),
                        "type_prescription": "materiaux",
                        "niveau": "obligatoire",
                        "normes": ["NF V 12-055", "NFU 44-051"],
                        "contient_variables": True,
                        "ordre": 2,
                    },
                    {
                        "intitule": "Aires de jeux",
                        "corps": (
                            "Les équipements d'aires de jeux seront conformes à NF EN 1176. "
                            "Revêtement de sol amortissant sous les équipements : NF EN 1177. "
                            "Hauteur de chute libre maximale : {hauteur_chute:-1,50} m pour gazons. "
                            "Signalétique de sécurité obligatoire sur chaque équipement. "
                            "Inspection initiale avant mise en service par organisme agréé."
                        ),
                        "type_prescription": "securite",
                        "niveau": "obligatoire",
                        "normes": ["NF EN 1176-1", "NF EN 1177"],
                        "contient_variables": True,
                        "ordre": 3,
                    },
                ],
            },
        ],
    },
]


# =============================================================================
# COMMANDE DE CHARGEMENT
# =============================================================================

class Command(BaseCommand):
    help = "Charge ou met à jour les lots, chapitres et prescriptions CCTP en base"

    def add_arguments(self, parser):
        parser.add_argument(
            "--reinitialiser",
            action="store_true",
            help="Supprime toutes les prescriptions existantes avant le chargement",
        )

    def handle(self, *args, **options):
        if options["reinitialiser"]:
            self.stdout.write(self.style.WARNING("Suppression des prescriptions existantes..."))
            PrescriptionCCTP.objects.all().delete()
            ChapitrePrescrip.objects.all().delete()
            LotCCTP.objects.all().delete()
            self.stdout.write(self.style.SUCCESS("Suppression terminée."))

        nb_lots = nb_chapitres = nb_prescrip = 0

        with transaction.atomic():
            for data_lot in LOTS:
                lot, created = LotCCTP.objects.update_or_create(
                    code=data_lot["code"],
                    defaults={
                        "intitule": data_lot["intitule"],
                        "description": data_lot.get("description", ""),
                        "normes_principales": data_lot.get("normes_principales", []),
                        "est_actif": True,
                        "ordre": data_lot.get("ordre", 0),
                    },
                )
                nb_lots += 1
                action = "Créé" if created else "Mis à jour"
                self.stdout.write(f"  {action} lot : {lot.code} — {lot.intitule}")

                for data_chapitre in data_lot.get("chapitres", []):
                    chapitre, _ = ChapitrePrescrip.objects.update_or_create(
                        lot=lot,
                        numero=data_chapitre["numero"],
                        defaults={
                            "intitule": data_chapitre["intitule"],
                            "ordre": data_chapitre.get("ordre", 0),
                        },
                    )
                    nb_chapitres += 1

                    for data_prescrip in data_chapitre.get("prescriptions", []):
                        PrescriptionCCTP.objects.update_or_create(
                            lot=lot,
                            chapitre=chapitre,
                            intitule=data_prescrip["intitule"],
                            defaults={
                                "corps": data_prescrip.get("corps", ""),
                                "type_prescription": data_prescrip.get("type_prescription", "mise_en_oeuvre"),
                                "niveau": data_prescrip.get("niveau", "recommande"),
                                "normes": data_prescrip.get("normes", []),
                                "contient_variables": data_prescrip.get("contient_variables", False),
                                "ordre": data_prescrip.get("ordre", 0),
                                "est_actif": True,
                                "source": "Widloecher & Cusant 3e éd. / TCE Granier-Platzer 8e éd.",
                            },
                        )
                        nb_prescrip += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"\nChargement terminé : {nb_lots} lots, {nb_chapitres} chapitres, {nb_prescrip} prescriptions."
            )
        )
