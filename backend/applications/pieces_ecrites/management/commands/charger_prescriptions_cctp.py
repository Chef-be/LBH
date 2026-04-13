"""
Chargement des lots et prescriptions CCTP en base.
Données issues des descriptifs CCTP — Widloecher & Cusant 3e éd.
et des guides techniques CSTB, DTU, Eurocodes.
"""
from django.core.management.base import BaseCommand
from applications.pieces_ecrites.models import LotCCTP, ChapitrePrescrip, PrescriptionCCTP

LOTS = [
    # -----------------------------------------------------------------------
    # 7.1 — VRD et réseaux
    # -----------------------------------------------------------------------
    {
        "numero": "7.1",
        "intitule": "VRD et réseaux",
        "description": "Voirie, réseaux divers, terrassements de voirie, assainissement, réseaux secs et humides.",
        "normes_principales": ["NF EN 1610", "NF EN 805", "NF P 98-200", "DTU 65.10", "CCTG fascicule 70"],
        "ordre": 1,
        "chapitres": [
            {
                "numero": "1",
                "intitule": "Généralités",
                "ordre": 1,
                "prescriptions": [
                    {
                        "intitule": "Objet du lot VRD",
                        "corps": "Le présent lot a pour objet la réalisation de l'ensemble des travaux de voirie, réseaux divers et terrassements de voirie nécessaires à l'opération définie dans les documents graphiques et pièces du présent marché. L'entrepreneur prendra connaissance de l'ensemble des pièces du dossier de consultation avant de remettre son offre.",
                        "type_prescription": "generalites",
                        "niveau": "obligatoire",
                        "normes": ["CCTG fascicule 70", "NF P 98-200"],
                        "ordre": 1,
                    },
                    {
                        "intitule": "Documents de référence VRD",
                        "corps": "Les travaux seront exécutés conformément aux documents suivants :\n- Fascicule 70 du CCTG : Ouvrages d'assainissement\n- NF EN 1610 : Mise en place et essais des branchements et collecteurs d'assainissement\n- NF EN 805 : Alimentation en eau — exigences pour les systèmes en dehors des bâtiments\n- NF P 98-200 : Chaussées — couches de fondation — généralités\n- Guide technique SETRA : Conception et dimensionnement des structures de chaussée\n- NF EN 124 : Dispositifs de couronnement et de fermeture pour les zones de circulation",
                        "type_prescription": "documents_reference",
                        "niveau": "obligatoire",
                        "normes": ["CCTG fascicule 70", "NF EN 1610", "NF EN 805", "NF P 98-200"],
                        "ordre": 2,
                    },
                ],
            },
            {
                "numero": "2",
                "intitule": "Terrassements de voirie",
                "ordre": 2,
                "prescriptions": [
                    {
                        "intitule": "Décapage de terre végétale",
                        "corps": "La terre végétale sera décapée sur une épaisseur minimale de {epaisseur_decapage:-0,30 m} et stockée en merlon sur le site pour réutilisation en espaces verts. Les excédants seront évacués en décharge agréée. Le décapage sera réalisé par engins mécaniques, les terres restant stables.",
                        "type_prescription": "mise_en_oeuvre",
                        "niveau": "obligatoire",
                        "normes": ["NF P 11-300"],
                        "contient_variables": True,
                        "ordre": 1,
                    },
                    {
                        "intitule": "Compactage des remblais",
                        "corps": "Les remblais seront compactés par couches successives de 0,30 m maximum. Le taux de compactage minimal sera de 95 % de l'OPM pour les couches supérieures à 0,50 m du sol fini et de 92 % de l'OPM pour les couches inférieures. Des essais de compactage (essai Proctor modifié) seront réalisés à la charge de l'entrepreneur à raison d'un essai tous les 500 m² de remblai et à chaque changement de matériaux.",
                        "type_prescription": "controles",
                        "niveau": "obligatoire",
                        "normes": ["NF P 94-093", "NF P 98-115"],
                        "ordre": 2,
                    },
                ],
            },
            {
                "numero": "3",
                "intitule": "Chaussées et revêtements",
                "ordre": 3,
                "prescriptions": [
                    {
                        "intitule": "Structure de chaussée",
                        "corps": "La structure de chaussée sera conforme aux plans et coupes figurant dans les documents graphiques. Elle comprendra, de bas en haut :\n- Couche de forme : grave non traitée 0/31,5 — épaisseur {ep_couche_forme:-0,20 m}\n- Couche de fondation : GNT 0/31,5 — épaisseur {ep_fondation:-0,20 m}\n- Couche de base : GB3 — épaisseur {ep_base:-0,07 m}\n- Couche de roulement : BBSG ou BBM — épaisseur {ep_roulement:-0,05 m}\nLes caractéristiques des matériaux seront conformes aux normes NF EN 13043 et NF P 98-150.",
                        "type_prescription": "mise_en_oeuvre",
                        "niveau": "obligatoire",
                        "normes": ["NF EN 13043", "NF P 98-150", "NF P 98-130"],
                        "contient_variables": True,
                        "ordre": 1,
                    },
                    {
                        "intitule": "Réseaux d'assainissement — matériaux et pose",
                        "corps": "Les canalisations d'assainissement seront en PVC CR8 (NF EN 1401) ou en béton armé conformément à la NF EN 1916. La pose sera réalisée conformément à la NF EN 1610 avec essais d'étanchéité par mise en pression (pression d'épreuve 0,5 bar, durée 30 minutes). Le lit de pose sera en sable de rivière 0/4 sur une épaisseur minimale de 0,10 m sous la génératrice inférieure.",
                        "type_prescription": "mise_en_oeuvre",
                        "niveau": "obligatoire",
                        "normes": ["NF EN 1401", "NF EN 1610", "NF EN 1916"],
                        "ordre": 2,
                    },
                ],
            },
        ],
    },
    # -----------------------------------------------------------------------
    # 7.2 — Terrassements
    # -----------------------------------------------------------------------
    {
        "numero": "7.2",
        "intitule": "Terrassements",
        "description": "Terrassements généraux, fouilles, déblais/remblais, blindages, drainage.",
        "normes_principales": ["NF P 11-300", "NF P 94-500", "NF EN 1536", "DTU 13.3"],
        "ordre": 2,
        "chapitres": [
            {
                "numero": "1",
                "intitule": "Généralités et reconnaissance",
                "ordre": 1,
                "prescriptions": [
                    {
                        "intitule": "Objet du lot terrassements",
                        "corps": "Le présent lot comprend l'ensemble des travaux de terrassement général, fouilles en masse, fouilles en tranchées, remblaiement, évacuation des terres excédentaires et toutes sujétions d'exécution. L'entrepreneur devra prendre connaissance du rapport d'étude géotechnique de type G2 avant remise de son offre.",
                        "type_prescription": "generalites",
                        "niveau": "obligatoire",
                        "normes": ["NF P 94-500"],
                        "ordre": 1,
                    },
                    {
                        "intitule": "Fouilles — exécution et sécurité",
                        "corps": "Les fouilles seront exécutées conformément aux plans de terrassement et aux préconisations de l'étude géotechnique G2. Tout talutage ou blindage nécessaire à la stabilité des fouilles sera à la charge de l'entrepreneur. La profondeur des fouilles sera réalisée jusqu'à la cote de fond de forme définie sur les plans. En présence d'eau, un épuisement provisoire sera prévu.",
                        "type_prescription": "mise_en_oeuvre",
                        "niveau": "obligatoire",
                        "normes": ["NF P 94-500", "NF EN 1538"],
                        "ordre": 2,
                    },
                    {
                        "intitule": "Drainage périphérique",
                        "corps": "Un drain périphérique en tuyau PVC annelé perforé DN100 minimum sera mis en place en pied de fondations. Il sera entouré d'un géotextile non tissé filtrant et recouvert de gravillons 10/25 drainants. La pente minimale sera de 0,5 % vers les regards de collecte. Conformément au DTU 20.1 et au DTU 13.3.",
                        "type_prescription": "mise_en_oeuvre",
                        "niveau": "recommande",
                        "normes": ["DTU 13.3", "DTU 20.1"],
                        "ordre": 3,
                    },
                ],
            },
        ],
    },
    # -----------------------------------------------------------------------
    # 7.3 — Gros Œuvre
    # -----------------------------------------------------------------------
    {
        "numero": "7.3",
        "intitule": "Gros Œuvre",
        "description": "Fondations, structure béton armé, maçonnerie porteuse, dallages, voiles, poteaux, poutres.",
        "normes_principales": ["DTU 21", "DTU 20.1", "NF EN 1992", "NF EN 206", "NF P 18-201"],
        "ordre": 3,
        "chapitres": [
            {
                "numero": "1",
                "intitule": "Généralités",
                "ordre": 1,
                "prescriptions": [
                    {
                        "intitule": "Objet du lot Gros Œuvre",
                        "corps": "Le présent lot comprend l'ensemble des travaux de gros œuvre : fondations, structure béton armé (voiles, poteaux, poutres, planchers), maçonnerie de remplissage, dallages sur terre-plein et toutes sujétions d'exécution. L'entrepreneur est responsable de la stabilité de l'ouvrage en cours de chantier et devra prendre en compte les plans d'exécution visés par le bureau de contrôle.",
                        "type_prescription": "generalites",
                        "niveau": "obligatoire",
                        "normes": ["DTU 21", "NF EN 1992-1-1"],
                        "ordre": 1,
                    },
                    {
                        "intitule": "Documents de référence Gros Œuvre",
                        "corps": "Les travaux de gros œuvre seront exécutés conformément aux documents suivants :\n- DTU 21 (NF P 18-201) : Travaux de bâtiment — Exécution des travaux en béton\n- NF EN 206 : Béton — Spécification, performances, production et conformité\n- NF EN 1992-1-1 (Eurocode 2) : Calcul des structures en béton\n- DTU 20.1 : Travaux de maçonnerie de petits éléments\n- NF EN 771-1 : Spécifications pour éléments de maçonnerie — Briques de terre cuite\n- NF EN 845-3 : Armatures pour maçonnerie\n- NF EN 10080 : Aciers pour béton armé",
                        "type_prescription": "documents_reference",
                        "niveau": "obligatoire",
                        "normes": ["DTU 21", "NF EN 206", "NF EN 1992-1-1", "DTU 20.1"],
                        "ordre": 2,
                    },
                ],
            },
            {
                "numero": "2",
                "intitule": "Béton armé — matériaux",
                "ordre": 2,
                "prescriptions": [
                    {
                        "intitule": "Béton armé — conformité NF EN 206",
                        "corps": "Tous les bétons utilisés seront conformes à la norme NF EN 206 et au DTU 21. Les bétons de structure seront de classe minimale C25/30 pour les éléments courants et C30/37 pour les éléments exposés aux classes d'exposition XC3/XC4. Le rapport Eau/Ciment (E/C) maximal sera de 0,55 pour XC3 et 0,50 pour XC4. La consistance sera contrôlée à la mise en œuvre (affaissement au cône d'Abrams selon NF EN 12350-2).",
                        "type_prescription": "materiaux",
                        "niveau": "obligatoire",
                        "normes": ["NF EN 206", "DTU 21", "NF EN 12350-2", "NF EN 1992-1-1"],
                        "ordre": 1,
                    },
                    {
                        "intitule": "Aciers de béton armé — enrobages",
                        "corps": "Les aciers seront de nuance B500B conformément à la NF EN 10080. Les enrobages nominaux (c_nom) seront définis selon l'Eurocode 2 (NF EN 1992-1-1) en fonction de la classe d'exposition et de la classe structurale :\n- Éléments en contact avec le sol : c_nom ≥ 50 mm\n- Éléments extérieurs (XC3/XC4) : c_nom ≥ 35 mm\n- Éléments intérieurs protégés (XC1) : c_nom ≥ 20 mm\nLes aciers seront conformes aux plans d'armatures visés par le bureau de contrôle. Tout changement de nuance ou de diamètre devra être soumis à l'approbation du bureau de contrôle.",
                        "type_prescription": "materiaux",
                        "niveau": "obligatoire",
                        "normes": ["NF EN 10080", "NF EN 1992-1-1", "DTU 21"],
                        "ordre": 2,
                    },
                ],
            },
            {
                "numero": "3",
                "intitule": "Coffrages et bétonnage",
                "ordre": 3,
                "prescriptions": [
                    {
                        "intitule": "Coffrages — types et états de surface",
                        "corps": "Les coffrages seront dimensionnés pour résister aux poussées du béton frais (EN 12812). Les parements vus seront obtenus par coffrages soignés (type coffrage bois ou métal) assurant un parement de classe de finition P2 minimum selon DTU 21. Les reprises de bétonnage seront nettoyées et humidifiées avant bétonnage. Toute huile de décoffrage sera sans silicone pour les parements devant recevoir un enduit ou une peinture.",
                        "type_prescription": "mise_en_oeuvre",
                        "niveau": "obligatoire",
                        "normes": ["DTU 21", "NF EN 12812"],
                        "ordre": 1,
                    },
                    {
                        "intitule": "Bétonnage — conditions et vibration",
                        "corps": "Le bétonnage sera réalisé conformément au DTU 21 :\n- Température ambiante comprise entre +5 °C et +35 °C. En dehors de ces limites, des dispositions spéciales (étuvage, chauffage, ombrage) seront soumises à l'agrément du bureau de contrôle.\n- Le béton sera vibré mécaniquement par aiguille vibrante (fréquence ≥ 6 000 tr/min) par couches de 0,40 m maximum.\n- La hauteur de chute libre du béton ne dépassera pas 1,50 m pour éviter toute ségrégation.\n- Le délai entre deux bétonnages successifs sera conforme au plan de coulage approuvé.",
                        "type_prescription": "mise_en_oeuvre",
                        "niveau": "obligatoire",
                        "normes": ["DTU 21", "NF EN 13670"],
                        "ordre": 2,
                    },
                    {
                        "intitule": "Tolérances d'exécution des ouvrages en béton",
                        "corps": "Les tolérances d'exécution des ouvrages en béton armé seront conformes au DTU 21 et à la norme NF EN 13670 :\n- Désaffleur de niveau (plancher, dalle) : ≤ 5 mm sous règle de 2 m\n- Verticalité des voiles et poteaux : ≤ H/500 avec maxi 30 mm\n- Implantation en plan : ≤ ± 10 mm par rapport aux axes théoriques\n- Rectitude des arêtes : ≤ 5 mm sous règle de 2 m\nTout dépassement des tolérances sera signalé au maître d'œuvre avant tout recouvrement.",
                        "type_prescription": "tolerances",
                        "niveau": "obligatoire",
                        "normes": ["DTU 21", "NF EN 13670"],
                        "ordre": 3,
                    },
                    {
                        "intitule": "Contrôles du béton — épreuves d'étude et de convenance",
                        "corps": "Avant tout démarrage des travaux de bétonnage, l'entrepreneur soumettra à l'agrément du bureau de contrôle une fiche de données béton (FDB) pour chaque type de béton. Des épreuves de convenance seront réalisées conformément au DTU 21. Des prélèvements d'épreuves de contrôle seront effectués en cours de chantier à raison d'au moins un prélèvement (3 éprouvettes) par 50 m³ de béton coulé avec un minimum d'un prélèvement par jour de bétonnage. Les résistances caractéristiques minimales devront être atteintes à 28 jours.",
                        "type_prescription": "controles",
                        "niveau": "obligatoire",
                        "normes": ["DTU 21", "NF EN 206", "NF EN 12390"],
                        "ordre": 4,
                    },
                ],
            },
            {
                "numero": "4",
                "intitule": "Fondations",
                "ordre": 4,
                "prescriptions": [
                    {
                        "intitule": "Fondations — nature et dimensionnement",
                        "corps": "La nature et les dimensions des fondations seront conformes aux plans de structure et aux préconisations de l'étude géotechnique de type G2 PRO. Les fondations superficielles (semelles filantes, isolées, radier) seront dimensionnées selon l'Eurocode 7 (NF EN 1997-1). La contrainte admissible du sol de fondation sera celle définie dans le rapport géotechnique. Tout fond de fouille douteux sera soumis à l'approbation du bureau de contrôle avant bétonnage.",
                        "type_prescription": "mise_en_oeuvre",
                        "niveau": "obligatoire",
                        "normes": ["NF EN 1997-1", "NF P 94-500", "DTU 13.11", "DTU 13.12"],
                        "ordre": 1,
                    },
                ],
            },
        ],
    },
    # -----------------------------------------------------------------------
    # 7.4 — Façades et bardages
    # -----------------------------------------------------------------------
    {
        "numero": "7.4",
        "intitule": "Façades et bardages",
        "description": "Ravalement, enduits de façade, bardages rapportés métalliques, bois ou composite.",
        "normes_principales": ["DTU 42.1", "DTU 41.2", "NF EN 15 651", "Cahier CSTB 3194"],
        "ordre": 4,
        "chapitres": [
            {
                "numero": "1",
                "intitule": "Généralités",
                "ordre": 1,
                "prescriptions": [
                    {
                        "intitule": "Objet du lot façades et bardages",
                        "corps": "Le présent lot comprend la réalisation des façades de l'ouvrage : enduits de façade, bardages rapportés sur ossature, joints de dilatation et toutes prestations concourant à l'étanchéité et à l'aspect des façades. L'entrepreneur fournira des fiches techniques et des Avis Techniques (AT) ou Document Technique d'Application (DTA) pour tous les procédés utilisés.",
                        "type_prescription": "generalites",
                        "niveau": "obligatoire",
                        "normes": ["DTU 42.1"],
                        "ordre": 1,
                    },
                    {
                        "intitule": "Bardage rapporté — mise en œuvre",
                        "corps": "Le bardage rapporté sur ossature secondaire sera mis en œuvre conformément à l'Avis Technique ou au Document Technique d'Application (DTA) du procédé retenu. L'ossature de bardage sera en aluminium ou en acier galvanisé, dimensionnée pour résister aux charges de vent selon la NV 65/N 84 (ou EN 1991-1-4). La lame d'air ventilée entre le bardage et l'isolant sera d'au moins 20 mm. Les fixations seront en acier inoxydable A2 minimum.",
                        "type_prescription": "mise_en_oeuvre",
                        "niveau": "obligatoire",
                        "normes": ["DTU 41.2", "NF EN 1991-1-4"],
                        "ordre": 2,
                    },
                    {
                        "intitule": "Joints de façade et étanchéité",
                        "corps": "Les joints entre éléments de bardage ou en périphérie de baies seront réalisés avec des mastics conformes à la norme NF EN 15 651. Les joints de dilatation de structure seront matérialisés dans le bardage par des profils spécifiques assurant la continuité de l'étanchéité à l'eau et à l'air. Aucun pont thermique direct entre structure porteuse et façade extérieure ne sera admis.",
                        "type_prescription": "mise_en_oeuvre",
                        "niveau": "obligatoire",
                        "normes": ["NF EN 15 651", "Cahier CSTB 3194"],
                        "ordre": 3,
                    },
                ],
            },
        ],
    },
    # -----------------------------------------------------------------------
    # 7.5 — Murs-rideaux
    # -----------------------------------------------------------------------
    {
        "numero": "7.5",
        "intitule": "Murs-rideaux",
        "description": "Façades rideaux aluminium, vitrages double ou triple, quincaillerie, joints.",
        "normes_principales": ["DTU 33.1", "NF EN 13830", "NF P 08-302", "EN 12210"],
        "ordre": 5,
        "chapitres": [
            {
                "numero": "1",
                "intitule": "Généralités",
                "ordre": 1,
                "prescriptions": [
                    {
                        "intitule": "Objet du lot murs-rideaux",
                        "corps": "Le présent lot comprend la fourniture et la pose des façades rideaux, murs-poteaux ou façades structurales, incluant les profilés aluminium, les vitrages, les joints d'étanchéité et les liaisons à la structure porteuse. Le système sera conforme à la norme NF EN 13830 et disposera d'un Avis Technique ou DTA en cours de validité.",
                        "type_prescription": "generalites",
                        "niveau": "obligatoire",
                        "normes": ["NF EN 13830", "DTU 33.1"],
                        "ordre": 1,
                    },
                    {
                        "intitule": "Performances AEV murs-rideaux",
                        "corps": "Le système de mur-rideau satisfera aux exigences minimales d'étanchéité à l'air, à l'eau et de résistance au vent (AEV) conformément à la norme EN 12210 :\n- Perméabilité à l'air : classe A3 minimum\n- Étanchéité à l'eau : classe RE 1050 minimum selon exposition\n- Résistance au vent : calculée selon EN 1991-1-4, vérifiée par essais selon EN 12211\nUn essai de type (ET) sur prototype sera fourni si exigé par le bureau de contrôle.",
                        "type_prescription": "controles",
                        "niveau": "obligatoire",
                        "normes": ["EN 12210", "EN 12211", "NF EN 1991-1-4"],
                        "ordre": 2,
                    },
                    {
                        "intitule": "Vitrages de murs-rideaux",
                        "corps": "Les vitrages seront de type feuilleté ou trempé-feuilleté conformes à la NF P 08-302 et aux fiches techniques du procédé. Les performances thermiques seront Ug ≤ {valeur_ug:-1,0 W/m².K} (double vitrage 4/16Ar/4 ou triple selon DPGF). Les vitrages de sécurité (planchers, allèges à risque de chute) seront de type feuilleté 44.2 minimum (VSG).",
                        "type_prescription": "materiaux",
                        "niveau": "obligatoire",
                        "normes": ["NF P 08-302", "NF EN 14449", "NF EN 12600"],
                        "contient_variables": True,
                        "ordre": 3,
                    },
                ],
            },
        ],
    },
    # -----------------------------------------------------------------------
    # 7.6 — Construction ossature bois
    # -----------------------------------------------------------------------
    {
        "numero": "7.6",
        "intitule": "Construction ossature bois",
        "description": "Ossature bois (COB), panneaux CLT, poteaux-poutres bois, isolation, pare-vapeur.",
        "normes_principales": ["DTU 31.2", "NF EN 1995-1-1", "NF B 52-001", "Eurocode 5"],
        "ordre": 6,
        "chapitres": [
            {
                "numero": "1",
                "intitule": "Généralités",
                "ordre": 1,
                "prescriptions": [
                    {
                        "intitule": "Objet du lot ossature bois",
                        "corps": "Le présent lot comprend la fourniture et la mise en œuvre de la structure en bois : ossature légère (COB), panneaux à lamelles croisées (CLT), poteaux, poutres, pannes et contreventements. L'ensemble sera dimensionné selon l'Eurocode 5 (NF EN 1995-1-1) et les plans d'exécution visés par le bureau de contrôle. Les plans de fabrication seront soumis à l'agrément avant tout démarrage de chantier.",
                        "type_prescription": "generalites",
                        "niveau": "obligatoire",
                        "normes": ["DTU 31.2", "NF EN 1995-1-1"],
                        "ordre": 1,
                    },
                    {
                        "intitule": "Bois — classes de résistance et humidité",
                        "corps": "Les bois de structure seront de classe de résistance C24 minimum (NF EN 338) ou GL24h pour le bois lamellé-collé (NF EN 14080). L'humidité des bois à la mise en œuvre ne dépassera pas 18 % pour les bois massifs et 15 % pour le lamellé-collé, mesurée au hygromètre électronique. Les bois seront traités selon la classe d'emploi CTB définie par la norme NF EN 335 en fonction des conditions d'exposition.",
                        "type_prescription": "materiaux",
                        "niveau": "obligatoire",
                        "normes": ["NF EN 338", "NF EN 14080", "NF EN 335"],
                        "ordre": 2,
                    },
                    {
                        "intitule": "Pare-vapeur et étanchéité à l'air ossature bois",
                        "corps": "Un frein-vapeur ou pare-vapeur (Sd ≥ 18 m) sera posé côté chaud de l'isolant, conformément au DTU 31.2. Les jonctions entre lés seront assurées par ruban adhésif double face compatible. L'ensemble du complexe pare-vapeur constituera une enveloppe continue garantissant une perméabilité à l'air n50 ≤ 1 vol/h (objectif BBC). Les traversées de gaines et câbles seront colmatées par manchons étanches.",
                        "type_prescription": "mise_en_oeuvre",
                        "niveau": "obligatoire",
                        "normes": ["DTU 31.2", "NF EN 13859-1"],
                        "ordre": 3,
                    },
                ],
            },
        ],
    },
    # -----------------------------------------------------------------------
    # 7.7 — Charpente métallique
    # -----------------------------------------------------------------------
    {
        "numero": "7.7",
        "intitule": "Charpente métallique",
        "description": "Ossature acier, poutres, poteaux HEA/HEB/IPE, assemblages boulonnés ou soudés, protection anti-feu.",
        "normes_principales": ["DTU 32.1", "NF EN 1993", "NF A 35-019", "NF EN ISO 9606", "AISC"],
        "ordre": 7,
        "chapitres": [
            {
                "numero": "1",
                "intitule": "Généralités",
                "ordre": 1,
                "prescriptions": [
                    {
                        "intitule": "Objet du lot charpente métallique",
                        "corps": "Le présent lot comprend l'ensemble des travaux de charpente métallique : fourniture, fabrication en atelier, transport et montage sur site des éléments de structure acier (poteaux, poutres, contreventements, platines d'ancrage). Les études d'exécution et les plans de fabrication seront établis par le titulaire sous contrôle du bureau de contrôle. La conception sera conforme à l'Eurocode 3 (NF EN 1993-1-1).",
                        "type_prescription": "generalites",
                        "niveau": "obligatoire",
                        "normes": ["DTU 32.1", "NF EN 1993-1-1"],
                        "ordre": 1,
                    },
                    {
                        "intitule": "Acier de construction — nuances et qualité",
                        "corps": "Les aciers de construction seront de nuance S235 ou S355 selon NF EN 10025, de qualité J2 minimum pour les pièces soumises à flexion. Les profils laminés seront conformes aux normes NF EN 10034 (profils H et I) et NF EN 10056 (cornières). Les tôles seront conformes à la NF EN 10029. Tout certificat de qualité (attestation de conformité de la coulée) sera fourni avant la mise en fabrication.",
                        "type_prescription": "materiaux",
                        "niveau": "obligatoire",
                        "normes": ["NF EN 10025", "NF EN 10034", "NF EN 1993-1-1"],
                        "ordre": 2,
                    },
                    {
                        "intitule": "Protection incendie de la charpente métallique",
                        "corps": "La protection au feu de la charpente métallique sera assurée conformément aux exigences réglementaires (ERP, locaux de travail, ERT) et au rapport de bureau de contrôle. Elle sera obtenue par :\n- Peinture intumescente : système certifié ACERMI/Avis Technique, épaisseur définie par le procédé pour le degré coupe-feu requis\n- Ou flocage projeté à base de fibres minérales : épaisseur certifiée pour le degré requis\n- Ou plaquage plaque de plâtre BA13 (cloisonnement)\nLe degré de stabilité au feu requis est {degre_feu:-SF 60} conformément au règlement de sécurité incendie applicable.",
                        "type_prescription": "securite",
                        "niveau": "obligatoire",
                        "normes": ["NF EN 13381-4", "NF EN 13381-8"],
                        "contient_variables": True,
                        "ordre": 3,
                    },
                ],
            },
        ],
    },
    # -----------------------------------------------------------------------
    # 7.8 — Charpente-Couverture-Zinguerie
    # -----------------------------------------------------------------------
    {
        "numero": "7.8",
        "intitule": "Charpente-Couverture-Zinguerie",
        "description": "Charpente bois traditionnelle, tuiles, ardoises, bacs acier, zinguerie, gouttières, noues.",
        "normes_principales": ["DTU 31.1", "DTU 40.1", "DTU 40.11", "DTU 40.29", "NF EN 14782"],
        "ordre": 8,
        "chapitres": [
            {
                "numero": "1",
                "intitule": "Généralités",
                "ordre": 1,
                "prescriptions": [
                    {
                        "intitule": "Objet du lot charpente-couverture-zinguerie",
                        "corps": "Le présent lot comprend : la charpente bois traditionnelle ou industrielle, les liteaux, les écrans de sous-toiture, les tuiles ou ardoises de couverture, les éléments de zinguerie (faîtage, noues, rives, chéneaux, gouttières, descentes EP) et les sorties de toiture (lanterneaux, châssis de désenfumage). La pente de couverture et les matériaux de couverture sont définis sur les plans architecte.",
                        "type_prescription": "generalites",
                        "niveau": "obligatoire",
                        "normes": ["DTU 31.1", "DTU 40.1"],
                        "ordre": 1,
                    },
                    {
                        "intitule": "Écran de sous-toiture",
                        "corps": "Un écran de sous-toiture HPV (Hautement Perméable à la Vapeur) de résistance à l'eau W1 minimum (NF EN 13859-1) sera posé sous les liteaux sur toute la superficie de la toiture. Le clouage sera réalisé à chaque liteaux et les recouvrements seront de 150 mm minimum. Les sorties de toiture (conduits, châssis) seront raccordées à l'écran par des manchons ou bavettes étanches fournis par le fabricant.",
                        "type_prescription": "mise_en_oeuvre",
                        "niveau": "obligatoire",
                        "normes": ["NF EN 13859-1", "DTU 40.29"],
                        "ordre": 2,
                    },
                    {
                        "intitule": "Zinguerie — matériaux et mise en œuvre",
                        "corps": "La zinguerie sera réalisée en zinc naturel épaisseur minimale 0,65 mm (grade Z15 selon NF EN 988) ou en zinc pré-patiné de même épaisseur. La dilatation libre des feuilles de zinc sera assurée par des joints debout ou par agrafes avec espacement maximum de 0,40 m pour les joints et 0,50 m pour les bords. Les chéneaux et descentes EP seront dimensionnés selon la norme NF P 16-202 en fonction de la surface de toiture collectée.",
                        "type_prescription": "mise_en_oeuvre",
                        "niveau": "obligatoire",
                        "normes": ["NF EN 988", "NF P 16-202", "DTU 40.41"],
                        "ordre": 3,
                    },
                ],
            },
        ],
    },
    # -----------------------------------------------------------------------
    # 7.9 — Étanchéité
    # -----------------------------------------------------------------------
    {
        "numero": "7.9",
        "intitule": "Étanchéité",
        "description": "Étanchéité de toitures-terrasses inaccessibles, accessibles, jardins, parkings, terrasses bois.",
        "normes_principales": ["DTU 43.1", "DTU 43.3", "NF EN 13956", "Cahier CSTB 3680"],
        "ordre": 9,
        "chapitres": [
            {
                "numero": "1",
                "intitule": "Généralités",
                "ordre": 1,
                "prescriptions": [
                    {
                        "intitule": "Objet du lot étanchéité",
                        "corps": "Le présent lot comprend la réalisation de l'étanchéité des toitures-terrasses, des terrasses accessibles et jardins : isolation thermique support d'étanchéité, relevés d'étanchéité, protection, évacuations des eaux pluviales (EEP) et toutes sujétions. Les procédés utilisés seront conformes aux DTU et disposant d'un Avis Technique en cours de validité.",
                        "type_prescription": "generalites",
                        "niveau": "obligatoire",
                        "normes": ["DTU 43.1", "DTU 43.3"],
                        "ordre": 1,
                    },
                    {
                        "intitule": "Étanchéité toiture-terrasse inaccessible — mise en œuvre",
                        "corps": "L'étanchéité sera réalisée par un complexe bitumineux bicouche (SBS ou APP) ou membrane synthétique (TPO, PVC-P) conformément au DTU 43.1. La couche d'impression sera obligatoirement appliquée sur support béton ou isolant avant pose des membranes. Les relevés d'étanchéité remonteront à 15 cm minimum au-dessus de la protection horizontale et seront fixés mécaniquement sous lisse de rive métallique. La protection de l'étanchéité sera assurée par une couche de gravier roulé 10/20 de 0,05 m d'épaisseur minimum ou par dalle béton.",
                        "type_prescription": "mise_en_oeuvre",
                        "niveau": "obligatoire",
                        "normes": ["DTU 43.1", "NF EN 13956"],
                        "ordre": 2,
                    },
                    {
                        "intitule": "Évacuations des eaux pluviales",
                        "corps": "Les évacuations des eaux pluviales (EEP) seront dimensionnées conformément à la norme NF P 16-202 (DTU 60.11) en fonction de la surface collectée et de la pluviométrie locale. Le nombre et le diamètre des EEP seront conformes aux plans. La pente minimale vers les EEP sera de 1 %. Un trop-plein de sécurité (EEP de sécurité ou gargouille) sera prévu à 30 mm au-dessus des EEP principales. Les boîtes à eau seront accessibles depuis la toiture.",
                        "type_prescription": "mise_en_oeuvre",
                        "niveau": "obligatoire",
                        "normes": ["NF P 16-202", "DTU 60.11"],
                        "ordre": 3,
                    },
                ],
            },
        ],
    },
    # -----------------------------------------------------------------------
    # 7.10 — Menuiseries extérieures
    # -----------------------------------------------------------------------
    {
        "numero": "7.10",
        "intitule": "Menuiseries extérieures",
        "description": "Fenêtres, portes-fenêtres, baies coulissantes, volets, stores, en PVC, aluminium ou bois.",
        "normes_principales": ["DTU 36.5", "NF EN 14351-1", "NF EN 12207", "NF EN 12208", "NF EN 12210"],
        "ordre": 10,
        "chapitres": [
            {
                "numero": "1",
                "intitule": "Généralités",
                "ordre": 1,
                "prescriptions": [
                    {
                        "intitule": "Objet du lot menuiseries extérieures",
                        "corps": "Le présent lot comprend la fourniture et la pose de l'ensemble des menuiseries extérieures : fenêtres, portes-fenêtres, baies coulissantes, portes d'entrée, volets battants ou roulants, stores extérieurs et jalousies. Les menuiseries sont définies au DPGF et sur les plans façades. Toute modification de dimension ou de type sera soumise à l'agrément préalable du maître d'œuvre.",
                        "type_prescription": "generalites",
                        "niveau": "obligatoire",
                        "normes": ["DTU 36.5", "NF EN 14351-1"],
                        "ordre": 1,
                    },
                    {
                        "intitule": "Documents de référence menuiseries extérieures",
                        "corps": "Les menuiseries extérieures seront conformes aux normes suivantes :\n- NF EN 14351-1 : Fenêtres et portes — norme produit, caractéristiques de performance\n- NF EN 12207 : Perméabilité à l'air — classification\n- NF EN 12208 : Étanchéité à l'eau — classification\n- NF EN 12210 : Résistance au vent — classification\n- DTU 36.5 : Mise en œuvre des fenêtres et portes extérieures\n- NF EN 12600 : Essai au pendule (vitrages)\n- NF P 01-012 : Garde-corps — règles de sécurité",
                        "type_prescription": "documents_reference",
                        "niveau": "obligatoire",
                        "normes": ["NF EN 14351-1", "NF EN 12207", "NF EN 12208", "NF EN 12210", "DTU 36.5"],
                        "ordre": 2,
                    },
                    {
                        "intitule": "Performances AEV et thermiques des menuiseries",
                        "corps": "Les menuiseries extérieures satisferont aux classements AEV minimaux en fonction de la zone climatique :\n- Perméabilité à l'air : classe A*3 minimum (NF EN 12207)\n- Étanchéité à l'eau : classe E*7B minimum (NF EN 12208)\n- Résistance au vent : classe C*3 minimum (NF EN 12210)\nLes performances thermiques minimales seront :\n- Coefficient Uw ≤ {valeur_uw:-1,3 W/m².K} (cadre + vitrage)\n- Facteur solaire g ≤ 0,6 (façades exposées à l'Ouest, Sud et Est)\nLes caractéristiques AEV seront justifiées par des essais de type conformes aux normes EN.",
                        "type_prescription": "materiaux",
                        "niveau": "obligatoire",
                        "normes": ["NF EN 12207", "NF EN 12208", "NF EN 12210"],
                        "contient_variables": True,
                        "ordre": 3,
                    },
                    {
                        "intitule": "Pose des menuiseries — DTU 36.5",
                        "corps": "La pose des menuiseries sera réalisée conformément au DTU 36.5. Le cadre dormant sera fixé par pattes d'ancrage réglables dans la maçonnerie ou le béton par cheville métallique. L'écartement des fixations ne dépassera pas 700 mm avec un minimum de deux fixations par côté. Les jeux de pose seront comblés par mousse expansive co-extrudée ou PU projetée avec une compressibilité permettant la dilatation. L'apport de lumière naturelle sera vérifié avant pose définitive (orientation, protection brise-soleil).",
                        "type_prescription": "mise_en_oeuvre",
                        "niveau": "obligatoire",
                        "normes": ["DTU 36.5"],
                        "ordre": 4,
                    },
                    {
                        "intitule": "Calfeutrement et raccordement des menuiseries",
                        "corps": "Le calfeutrement entre la menuiserie et le gros œuvre sera réalisé en deux phases :\n1. Côté intérieur : fond de joint mousse polyéthylène + mastic silicone ou acrylique de classe F25 LM (NF EN ISO 11600) en finition lisse.\n2. Côté extérieur : joint comprimé à mémoire de forme (EPDM ou mousses pré-imprégnées) posé en compression pour assurer l'étanchéité à l'eau et à l'air sans mastic apparent, ou mastic façade de classe F25 E.\nLe raccordement à l'isolation thermique extérieure (ITE) ou à l'enduit sera assuré par profilé de raccordement (appui de fenêtre, bavette de tableau) fourni par le menuisier.",
                        "type_prescription": "mise_en_oeuvre",
                        "niveau": "obligatoire",
                        "normes": ["DTU 36.5", "NF EN ISO 11600"],
                        "ordre": 5,
                    },
                ],
            },
        ],
    },
    # -----------------------------------------------------------------------
    # 7.11 — Menuiseries intérieures et serrurerie
    # -----------------------------------------------------------------------
    {
        "numero": "7.11",
        "intitule": "Menuiseries intérieures et serrurerie",
        "description": "Portes intérieures, cloisons vitrées, garde-corps, rampes d'escalier, serrurerie.",
        "normes_principales": ["DTU 36.2", "NF EN 16232", "NF P 01-012", "NF P 01-013"],
        "ordre": 11,
        "chapitres": [
            {
                "numero": "1",
                "intitule": "Généralités",
                "ordre": 1,
                "prescriptions": [
                    {
                        "intitule": "Objet du lot menuiseries intérieures",
                        "corps": "Le présent lot comprend la fourniture et la pose des portes intérieures, blocs-portes (placages ou stratifiés), portes coupe-feu, cloisons vitrées intérieures, garde-corps, rampes d'escalier et serrurerie associée. Les performances acoustiques et de résistance au feu seront conformes aux exigences réglementaires applicables à chaque local.",
                        "type_prescription": "generalites",
                        "niveau": "obligatoire",
                        "normes": ["DTU 36.2", "NF P 01-012"],
                        "ordre": 1,
                    },
                    {
                        "intitule": "Portes coupe-feu — classement et mise en œuvre",
                        "corps": "Les portes coupe-feu seront certifiées PV (procès-verbal) de résistance au feu selon la norme NF EN 1634-1. Le classement requis est défini par le règlement de sécurité incendie applicable (ERP, habitation, locaux de travail). Les blocs-portes seront posés conformément au procès-verbal de résistance au feu et aux instructions du fabricant. Les joints de dilatation entre bâti et maçonnerie seront obturés par mortier ou laine de roche haute densité conforme au classement feu. Les ferme-portes seront conformes à la NF EN 1154.",
                        "type_prescription": "mise_en_oeuvre",
                        "niveau": "obligatoire",
                        "normes": ["NF EN 1634-1", "NF EN 1154"],
                        "ordre": 2,
                    },
                    {
                        "intitule": "Garde-corps — résistance mécanique",
                        "corps": "Les garde-corps seront dimensionnés conformément à la norme NF P 01-012 (et NF P 01-013 pour les ERP). La charge linéaire horizontale minimale admissible sera de 60 daN/ml pour les logements et 100 daN/ml pour les ERP. La hauteur minimale sera de 1,00 m en présence de risque de chute ≤ 1,00 m et 1,10 m au-delà. Les vitrages de garde-corps seront de type feuilleté (VSG) conformes à la NF P 08-302.",
                        "type_prescription": "mise_en_oeuvre",
                        "niveau": "obligatoire",
                        "normes": ["NF P 01-012", "NF P 01-013", "NF P 08-302"],
                        "ordre": 3,
                    },
                ],
            },
        ],
    },
    # -----------------------------------------------------------------------
    # 7.12 — Isolation-Plâtrerie-Peinture
    # -----------------------------------------------------------------------
    {
        "numero": "7.12",
        "intitule": "Isolation-Plâtrerie-Peinture",
        "description": "Isolation thermique et acoustique, plâtrerie sèche, enduits, peintures intérieures.",
        "normes_principales": ["DTU 25.41", "DTU 25.31", "NF EN 13162", "NF P 74-201", "NF P 74-212"],
        "ordre": 12,
        "chapitres": [
            {
                "numero": "1",
                "intitule": "Généralités",
                "ordre": 1,
                "prescriptions": [
                    {
                        "intitule": "Objet du lot isolation-plâtrerie-peinture",
                        "corps": "Le présent lot comprend : l'isolation thermique et acoustique intérieure (laine minérale, PSE, PU), la plâtrerie sèche (cloisons et doublages en plaques de plâtre sur ossature métallique), les enduits intérieurs de lissage, les faux-plafonds suspendus et les peintures intérieures. L'ensemble sera réalisé conformément aux DTU correspondants.",
                        "type_prescription": "generalites",
                        "niveau": "obligatoire",
                        "normes": ["DTU 25.41", "DTU 25.31"],
                        "ordre": 1,
                    },
                    {
                        "intitule": "Documents de référence plâtrerie-isolation",
                        "corps": "Les travaux seront exécutés conformément aux documents de référence suivants :\n- DTU 25.41 : Ouvrages en plaques de plâtre — plafonds suspendus\n- DTU 25.31 : Ouvrages verticaux de plâtrerie ne nécessitant pas l'application d'un enduit\n- DTU 25.42 : Ouvrages de doublage et habillage en complexes et sandwichs\n- NF EN 13162 : Produits d'isolation thermique — laine minérale (MW)\n- NF EN 13163 : Produits d'isolation thermique — polystyrène expansé (EPS)\n- NF P 74-201 (DTU 59.1) : Travaux de peinture des bâtiments\n- NF P 74-212 : Travaux de revêtement mural intérieur",
                        "type_prescription": "documents_reference",
                        "niveau": "obligatoire",
                        "normes": ["DTU 25.41", "DTU 25.31", "NF EN 13162", "NF P 74-201"],
                        "ordre": 2,
                    },
                    {
                        "intitule": "Cloisons en plaques de plâtre — mise en œuvre DTU 25.41",
                        "corps": "Les cloisons de distribution seront réalisées sur ossature métallique (rails R et montants M) conformément au DTU 25.41. L'entraxe des montants sera de 600 mm maximum. Les plaques de plâtre seront de type BA13 pour les cloisons standard ou BA18 pour les locaux humides et zones soumises aux chocs. Le doublage des cloisons avec isolation acoustique sera réalisé par laine minérale {epaisseur_laine:-45 mm} de densité ≥ 15 kg/m³ (MW selon NF EN 13162). Les joints entre plaques seront réalisés au plâtre à joints ou à la colle à joint conforme à la NF EN 13963.",
                        "type_prescription": "mise_en_oeuvre",
                        "niveau": "obligatoire",
                        "normes": ["DTU 25.41", "NF EN 13162", "NF EN 13963"],
                        "contient_variables": True,
                        "ordre": 3,
                    },
                    {
                        "intitule": "Degrés de finition des enduits plâtre",
                        "corps": "Les degrés de finition des surfaces enduites seront conformes à la norme NF P 05-011 (Fini, Q1 à Q4) selon les prescriptions du DPGF :\n- Q1 : Renformis — état brut de projection ou de talochage\n- Q2 : Courant — finition pour peinture mate ou revêtement mural souple\n- Q3 : Soigné — finition pour peinture satinée ou brillante\n- Q4 : Très soigné — finition pour peinture laquée, locaux de prestige\nLe degré minimal exigé par local est défini au DPGF. Des témoins de finition seront réalisés avant démarrage des travaux de peinture.",
                        "type_prescription": "tolerances",
                        "niveau": "obligatoire",
                        "normes": ["NF P 05-011"],
                        "ordre": 4,
                    },
                    {
                        "intitule": "Peintures intérieures — systèmes et préparation des supports",
                        "corps": "Les travaux de peinture seront exécutés conformément au DTU 59.1 (NF P 74-201). Le support sera propre, sain, sec (humidité ≤ 3 % au carbure de calcium) et exempt de sels, de moisissures et de plâtre en excès. Le système de peinture comprendra au minimum :\n- 1 couche de fond isolant ou d'impression selon nature du support\n- 2 couches de peinture de finition en peinture acrylique lessivable de classe 3 minimum selon ISO 11998\nLa couleur et la texture seront définies par le maître d'œuvre sur cahier des couleurs. Des camaïeux de teinte seront soumis à approbation avant application.",
                        "type_prescription": "mise_en_oeuvre",
                        "niveau": "obligatoire",
                        "normes": ["DTU 59.1", "NF P 74-201", "ISO 11998"],
                        "ordre": 5,
                    },
                ],
            },
        ],
    },
    # -----------------------------------------------------------------------
    # 7.13 — Revêtements de sols et carrelage
    # -----------------------------------------------------------------------
    {
        "numero": "7.13",
        "intitule": "Revêtements de sols et carrelage",
        "description": "Carrelages céramiques, grès cérame, pierres naturelles, résines, parquets, moquettes.",
        "normes_principales": ["DTU 52.1", "DTU 52.2", "NF EN 14411", "NF P 61-106", "NF P 62-203"],
        "ordre": 13,
        "chapitres": [
            {
                "numero": "1",
                "intitule": "Généralités",
                "ordre": 1,
                "prescriptions": [
                    {
                        "intitule": "Objet du lot revêtements de sols et carrelage",
                        "corps": "Le présent lot comprend la fourniture et la pose de l'ensemble des revêtements de sols intérieurs et extérieurs : carrelages céramiques et grès cérame, pierres naturelles, résines de sol, parquets, moquettes et revêtements de sol souples. Les travaux incluent également les revêtements muraux en faïence ou grès cérame dans les pièces humides. Les prescriptions de sous-couche, de ragréage et de traitement de support sont incluses.",
                        "type_prescription": "generalites",
                        "niveau": "obligatoire",
                        "normes": ["DTU 52.1", "DTU 52.2"],
                        "ordre": 1,
                    },
                    {
                        "intitule": "Classement UPEC des carrelages",
                        "corps": "Les carrelages seront classifiés selon la norme NF P 61-106 (UPEC) adaptés aux usages des locaux :\n- U : Usure par le piétonnement — U2 pour locaux communs, U3 pour locaux techniques, U4 pour espaces extérieurs\n- P : Résistance à la Poinçonnement — P2 minimum pour locaux professionnels\n- E : Résistance à l'Eau — E1 minimum pour locaux humides, E2 pour douches et salles de bain\n- C : Résistance aux agents Chimiques — C0 courant, C1 produits ménagers, C2 produits professionnels\nLe classement UPEC de chaque local est défini dans le DPGF. Le carrelage sera conforme à la NF EN 14411 et au groupe de résistance à l'abrasion PEI adapté.",
                        "type_prescription": "materiaux",
                        "niveau": "obligatoire",
                        "normes": ["NF P 61-106", "NF EN 14411"],
                        "ordre": 2,
                    },
                    {
                        "intitule": "Pose des carrelages — DTU 52.2 (collage)",
                        "corps": "La pose des carrelages en collage sera réalisée conformément au DTU 52.2. Le support devra présenter une planéité de 7 mm sous règle de 2 m et 2 mm sous règle de 0,20 m. Un ragréage autolissant sera obligatoire pour toute irrégularité > 5 mm. La colle sera de classe C2F (améliorée, flexible) pour les pièces humides et C2TE (déformable à temps ouvert étendu) pour les grands formats > 30 cm de côté. L'application de la colle sera en double encollage (dos de carrelage + support) pour les carrelages > 40 × 40 cm. Le taux de remplissage minimal sous carrelage sera de 85 % en zone sèche et 95 % en zone humide.",
                        "type_prescription": "mise_en_oeuvre",
                        "niveau": "obligatoire",
                        "normes": ["DTU 52.2", "NF EN 12004"],
                        "ordre": 3,
                    },
                    {
                        "intitule": "Joints de carrelage — largeur, matériaux et joints de fractionnement",
                        "corps": "Les joints entre carreaux seront en coulis de joints conformes à la NF EN 13888. La largeur des joints sera de 2 mm minimum pour les carreaux rectifiés et 3 mm pour les carreaux calibrés. Des joints de fractionnement seront obligatoirement disposés :\n- En périphérie de chaque pièce (joint de dilatation entre carrelage et paroi)\n- Tous les 25 à 40 m² en zone intérieure et tous les 9 m² en zone extérieure exposée\n- Au droit des joints structuraux du bâtiment\nLes joints de fractionnement seront garnis de mastic élastique de classe F25 E LM (NF EN ISO 11600) ou de profilés métalliques de dilatation.",
                        "type_prescription": "mise_en_oeuvre",
                        "niveau": "obligatoire",
                        "normes": ["DTU 52.2", "NF EN 13888", "NF EN ISO 11600"],
                        "ordre": 4,
                    },
                    {
                        "intitule": "Tolérances d'exécution — carrelages",
                        "corps": "Les tolérances d'exécution des revêtements de sols en carrelage seront conformes au DTU 52.2 :\n- Planéité générale : ≤ 7 mm sous règle de 2 m\n- Planéité locale : ≤ 2 mm sous règle de 0,20 m\n- Désaffleur entre carreaux adjacents : ≤ 1 mm\n- Régularité des joints : ± 1 mm par rapport à la valeur théorique\n- Alignement des joints sur longueur de 3 m : ≤ 2 mm\nTout défaut constaté en réception (carreaux fêlés, décollés, sonnant creux sur > 15 % de la surface) donnera lieu à reprise aux frais de l'entrepreneur.",
                        "type_prescription": "tolerances",
                        "niveau": "obligatoire",
                        "normes": ["DTU 52.2"],
                        "ordre": 5,
                    },
                ],
            },
        ],
    },
    # -----------------------------------------------------------------------
    # 7.14 — Électricité courants forts et faibles
    # -----------------------------------------------------------------------
    {
        "numero": "7.14",
        "intitule": "Électricité courants forts et faibles",
        "description": "Distribution HTA/BT, TGBT, tableaux divisionnaires, éclairage, courants faibles (VDI, SSI, contrôle d'accès).",
        "normes_principales": ["NF C 15-100", "NF C 14-100", "NF EN 60439", "NF EN 60598", "UTE C 15-103"],
        "ordre": 14,
        "chapitres": [
            {
                "numero": "1",
                "intitule": "Généralités",
                "ordre": 1,
                "prescriptions": [
                    {
                        "intitule": "Objet du lot électricité",
                        "corps": "Le présent lot comprend l'ensemble des travaux d'électricité courants forts et courants faibles : alimentation TGBT, tableaux divisionnaires, distribution, éclairage intérieur et extérieur, prises de courant, courants faibles (VDI, téléphonie, TV, SSI, contrôle d'accès, interphonie). L'installation sera conforme à la norme NF C 15-100 en vigueur et aux prescriptions de ENEDIS (ex-ERDF) pour le raccordement réseau.",
                        "type_prescription": "generalites",
                        "niveau": "obligatoire",
                        "normes": ["NF C 15-100", "NF C 14-100"],
                        "ordre": 1,
                    },
                    {
                        "intitule": "Schéma de liaison à la terre — régime TT",
                        "corps": "L'installation sera réalisée en schéma TT (neutre du transformateur à la terre, masses des récepteurs à la terre) conformément à la norme NF C 15-100 article 413. La prise de terre du bâtiment sera réalisée par conducteur enterré en fond de fouilles (cuivre nu 29 mm² minimum) en boucle fermée sous l'empreinte du bâtiment. La résistance de la prise de terre sera ≤ 100 Ω (mesurée selon NF EN 61557-5). Chaque circuit sera protégé par un DDR 30 mA de type A (ou AC pour les circuits sans convertisseurs).",
                        "type_prescription": "mise_en_oeuvre",
                        "niveau": "obligatoire",
                        "normes": ["NF C 15-100", "NF EN 61557-5"],
                        "ordre": 2,
                    },
                    {
                        "intitule": "Tableaux électriques — composition et protection",
                        "corps": "Le TGBT et les tableaux divisionnaires seront conformes à la norme NF EN 61439-1 et -2. Chaque tableau comprendra :\n- Un interrupteur général de coupure\n- Des disjoncteurs divisionnaires pour chaque départ de circuit (calibre adapté à la section des conducteurs)\n- Des DDR 30 mA de type A pour tous les circuits prises de courant et circuits alimentant des locaux humides\n- Un parafoudre de type 2 (NF EN 61643-11) obligatoire pour les bâtiments ≥ 50 m² avec paratonnerre\nLes tableaux seront repérés, les circuits numérotés et une étiquette de repérage sera apposée sur chaque départ. Un certificat de conformité CONSUEL sera établi avant mise en service.",
                        "type_prescription": "mise_en_oeuvre",
                        "niveau": "obligatoire",
                        "normes": ["NF EN 61439-1", "NF C 15-100", "NF EN 61643-11"],
                        "ordre": 3,
                    },
                    {
                        "intitule": "Éclairage — niveaux d'éclairement et efficacité",
                        "corps": "Les niveaux d'éclairement seront conformes à la norme NF EN 12464-1 (lieux de travail intérieurs) :\n- Bureaux : 500 lux (Em) sur plan de travail\n- Circulations : 100 lux\n- Salles de réunion : 300 lux\n- Locaux techniques : 200 lux\nLes luminaires seront à technologie LED avec un indice de rendu des couleurs IRC ≥ 80 et une durée de vie ≥ 50 000 h (L70B10). L'installation sera conforme aux exigences de la RT 2012 ou RE 2020 en matière d'efficacité lumineuse : EPLJ ≤ {eplj:-1,6 W/m²/100lux} pour les zones à occupation continue.",
                        "type_prescription": "mise_en_oeuvre",
                        "niveau": "obligatoire",
                        "normes": ["NF EN 12464-1", "NF C 15-100"],
                        "contient_variables": True,
                        "ordre": 4,
                    },
                ],
            },
        ],
    },
    # -----------------------------------------------------------------------
    # 7.15 — Plomberie sanitaires
    # -----------------------------------------------------------------------
    {
        "numero": "7.15",
        "intitule": "Plomberie sanitaires",
        "description": "Alimentation eau froide/chaude, évacuations EU/EV, appareils sanitaires, robinetterie.",
        "normes_principales": ["DTU 60.1", "DTU 60.11", "DTU 65.10", "NF EN 806", "NF EN 1671"],
        "ordre": 15,
        "chapitres": [
            {
                "numero": "1",
                "intitule": "Généralités",
                "ordre": 1,
                "prescriptions": [
                    {
                        "intitule": "Objet du lot plomberie sanitaires",
                        "corps": "Le présent lot comprend la fourniture et la pose de l'ensemble des installations de plomberie sanitaire : alimentation eau froide et eau chaude sanitaire (ECS), production et distribution ECS, évacuations eaux usées (EU) et eaux vannes (EV), appareils sanitaires, robinetterie, comptage et toutes sujétions. L'installation sera conforme aux DTU 60.1, 60.11 et à la norme NF EN 806.",
                        "type_prescription": "generalites",
                        "niveau": "obligatoire",
                        "normes": ["DTU 60.1", "DTU 60.11", "NF EN 806"],
                        "ordre": 1,
                    },
                    {
                        "intitule": "Canalisations — matériaux et protection",
                        "corps": "Les canalisations d'alimentation en eau froide et eau chaude sanitaire seront en :\n- Cuivre écroui ou recuit (NF EN 1057) pour les réseaux apparents et encastrés dans les parois\n- PER (polyéthylène réticulé — NF EN ISO 15875) ou multicouche en gaine sous fourreaux pour les réseaux encastrés dans les dalles\n- Inox 316L (NF EN ISO 1127) pour les locaux à risques de corrosion\nToutes les canalisations métalliques seront protégées contre les condensations par calorifuge élastomère de 9 mm minimum. La pression de service sera maintenue entre 1 et 3 bar en tout point des installations.",
                        "type_prescription": "materiaux",
                        "niveau": "obligatoire",
                        "normes": ["NF EN 1057", "NF EN ISO 15875", "DTU 60.1"],
                        "ordre": 2,
                    },
                    {
                        "intitule": "Essais de pression des réseaux",
                        "corps": "Avant tout encastrement ou recouvrement, les réseaux d'alimentation en eau feront l'objet d'épreuves hydrauliques à la pression minimale de 1,5 fois la pression de service (minimum 9 bar) pendant 2 heures sans chute de pression supérieure à 0,2 bar, conformément au DTU 60.1. Un procès-verbal d'essai signé par l'entrepreneur sera remis au maître d'œuvre avant tout recouvrement. Les réseaux d'évacuation feront l'objet d'essais d'étanchéité par mise en charge d'eau ou par fumée.",
                        "type_prescription": "controles",
                        "niveau": "obligatoire",
                        "normes": ["DTU 60.1", "DTU 60.11"],
                        "ordre": 3,
                    },
                    {
                        "intitule": "Évacuations EU/EV — pentes et diamètres",
                        "corps": "Les canalisations d'évacuation des eaux usées et des eaux vannes seront en PVC acoustique (NF EN 1455 ou NF EN 1451) ou en fonte à joint élastomère (NF EN 877). Les pentes minimales seront de :\n- 1 % pour les collecteurs horizontaux EU et EV\n- 3 % pour les chutes et branchements directs\nLes diamètres minimaux seront :\n- Lavabo, évier : DN40\n- Douche, baignoire : DN50\n- WC : DN100\n- Collecteur EU : DN100 minimum\nChaque colonne disposera d'une ventilation primaire (extraction par toiture) et secondaire (ventilation secondaire par valve aéraulique si toiture inaccessible).",
                        "type_prescription": "mise_en_oeuvre",
                        "niveau": "obligatoire",
                        "normes": ["DTU 60.11", "NF EN 1455", "NF EN 877"],
                        "ordre": 4,
                    },
                ],
            },
        ],
    },
    # -----------------------------------------------------------------------
    # 7.16 — CVC — Chauffage Ventilation Climatisation
    # -----------------------------------------------------------------------
    {
        "numero": "7.16",
        "intitule": "CVC — Chauffage Ventilation Climatisation",
        "description": "Chaudières, PAC, VMC, climatisation, réseaux hydrauliques, régulation, GTB.",
        "normes_principales": ["DTU 65.11", "DTU 68.1", "NF EN 12831", "NF EN 15251", "RT 2012 / RE 2020"],
        "ordre": 16,
        "chapitres": [
            {
                "numero": "1",
                "intitule": "Généralités",
                "ordre": 1,
                "prescriptions": [
                    {
                        "intitule": "Objet du lot CVC",
                        "corps": "Le présent lot comprend la fourniture et la pose de l'ensemble des équipements de chauffage, ventilation et climatisation : production thermique (chaudière, PAC, échangeur), distribution hydraulique, émetteurs (radiateurs, planchers chauffants, ventilo-convecteurs), ventilation mécanique contrôlée (VMC simple ou double flux), traitement d'air et toutes sujétions de régulation, GTB et mise en service. Les calculs de dimensionnement seront conduits selon NF EN 12831 (déperditions) et NF EN 15251 (qualité d'air).",
                        "type_prescription": "generalites",
                        "niveau": "obligatoire",
                        "normes": ["DTU 65.11", "NF EN 12831"],
                        "ordre": 1,
                    },
                    {
                        "intitule": "Ventilation mécanique contrôlée — DTU 68.1",
                        "corps": "La ventilation mécanique contrôlée sera réalisée conformément au DTU 68.1 et à l'arrêté du 24 mars 1982 modifié. Les débits de ventilation seront conformes au règlement sanitaire départemental et aux exigences RE 2020 / RT 2012. La VMC double flux sera de classe A++ (NF EN 13141-7) avec un échangeur de chaleur de rendement ≥ 80 %. Les gaines seront en acier galvanisé ou en PVC rigide, calorifugées hors volume chauffé. La mise en service comprendra la mesure des débits sur chaque bouche de soufflage et d'extraction avec rapport de mise en service.",
                        "type_prescription": "mise_en_oeuvre",
                        "niveau": "obligatoire",
                        "normes": ["DTU 68.1", "NF EN 13141-7"],
                        "ordre": 2,
                    },
                    {
                        "intitule": "Réseaux hydrauliques — équilibrage et épreuves",
                        "corps": "Les réseaux hydrauliques de chauffage seront en acier noir (NF EN 10255) ou en multicouche PER-Alu-PER (NF EN ISO 21003). Tous les réseaux seront calorifugés conformément à la réglementation thermique. L'équilibrage hydraulique des circuits sera réalisé par robinets d'équilibrage à mesure (TA, Danfoss ou équivalent). Les réseaux feront l'objet d'une épreuve hydraulique à 1,5 fois la pression de service (minimum 6 bar) pendant 2 heures avant calorifugeage. Un rinçage chimique et un traitement de l'eau du circuit (inhibiteur de corrosion, antigel selon zone climatique) seront réalisés avant mise en service.",
                        "type_prescription": "controles",
                        "niveau": "obligatoire",
                        "normes": ["DTU 65.11", "NF EN 10255"],
                        "ordre": 3,
                    },
                ],
            },
        ],
    },
    # -----------------------------------------------------------------------
    # 7.17 — Ascenseur et monte-charge
    # -----------------------------------------------------------------------
    {
        "numero": "7.17",
        "intitule": "Ascenseur et monte-charge",
        "description": "Ascenseurs électriques ou hydrauliques, monte-charges, élévateurs PMR, conformité EN 81.",
        "normes_principales": ["NF EN 81-20", "NF EN 81-50", "NF EN 81-70", "Décret 2000-810", "Arrêté 18/11/2004"],
        "ordre": 17,
        "chapitres": [
            {
                "numero": "1",
                "intitule": "Généralités",
                "ordre": 1,
                "prescriptions": [
                    {
                        "intitule": "Objet du lot ascenseur",
                        "corps": "Le présent lot comprend la fourniture, la pose, les essais et la mise en service de l'(des) ascenseur(s) électrique(s) ou hydraulique(s) selon le DPGF. L'installation sera conforme à la norme NF EN 81-20 (ascenseurs électriques) ou NF EN 81-40 (ascenseurs hydrauliques), à la directive Ascenseurs 2014/33/UE (marquage CE), à la réglementation accessibilité (NF EN 81-70) et aux prescriptions de sécurité incendie. Le titulaire assurera la maintenance pendant la période de garantie.",
                        "type_prescription": "generalites",
                        "niveau": "obligatoire",
                        "normes": ["NF EN 81-20", "NF EN 81-70", "Décret 2000-810"],
                        "ordre": 1,
                    },
                    {
                        "intitule": "Accessibilité PMR des ascenseurs",
                        "corps": "Les ascenseurs desservant un bâtiment recevant du public (ERP) ou des logements collectifs seront conformes à la norme NF EN 81-70 (accessibilité personnes handicapées) et aux textes réglementaires d'accessibilité (Loi 2005-102, Décret 2006-555) :\n- Dimensions minimales de la cabine : 1,10 m × 1,40 m\n- Passage libre minimum des portes palières : 0,80 m\n- Boutons de commande en braille et en relief\n- Annonce sonore des niveaux\n- Miroir côté opposé aux portes\n- Commande prioritaire pompiers",
                        "type_prescription": "mise_en_oeuvre",
                        "niveau": "obligatoire",
                        "normes": ["NF EN 81-70", "Décret 2006-555"],
                        "ordre": 2,
                    },
                    {
                        "intitule": "Vérification initiale et mise en service de l'ascenseur",
                        "corps": "Avant mise en service, l'ascenseur fera l'objet d'une vérification initiale par un organisme agréé conformément à l'arrêté du 18 novembre 2004. Les essais porteront sur la sécurité des dispositifs, la précision d'arrêt (± 10 mm), la vitesse nominale, la charge nominale en essai de surcharge (125 % pendant 1 heure) et l'ensemble des dispositifs de sécurité. Le procès-verbal de vérification initiale sera remis au maître d'ouvrage avant réception. Le contrat de maintenance sera souscrit dès la mise en service.",
                        "type_prescription": "controles",
                        "niveau": "obligatoire",
                        "normes": ["NF EN 81-20", "Arrêté 18/11/2004"],
                        "ordre": 3,
                    },
                ],
            },
        ],
    },
    # -----------------------------------------------------------------------
    # 7.18 — Aménagements paysagers et espaces verts
    # -----------------------------------------------------------------------
    {
        "numero": "7.18",
        "intitule": "Aménagements paysagers et espaces verts",
        "description": "Plantations, engazonnement, arrosage automatique, mobilier urbain, clôtures.",
        "normes_principales": ["NF V 12-051", "NF V 12-054", "NF P 98-405", "DTU 65.12"],
        "ordre": 18,
        "chapitres": [
            {
                "numero": "1",
                "intitule": "Généralités",
                "ordre": 1,
                "prescriptions": [
                    {
                        "intitule": "Objet du lot aménagements paysagers",
                        "corps": "Le présent lot comprend la réalisation des espaces verts et aménagements paysagers : préparation des terres, plantations d'arbres, d'arbustes et de massifs, engazonnement, mise en place de substrats, installation d'arrosage automatique, mobilier urbain et clôtures. Les essences de plantations sont définies sur les plans de paysagiste et dans la liste des végétaux annexée au présent CCTP.",
                        "type_prescription": "generalites",
                        "niveau": "obligatoire",
                        "normes": ["NF V 12-051", "NF V 12-054"],
                        "ordre": 1,
                    },
                    {
                        "intitule": "Qualité des végétaux — normes de certification",
                        "corps": "Tous les végétaux fournis seront conformes aux normes NF V 12-051 (arbres d'ornement) et NF V 12-054 (arbustes et plantes vivaces). Ils seront livrés avec leur certificat phytosanitaire en cours de validité. La taille minimale des arbres sera définie au DPGF (ex : tronc 12/14 cm de circonférence à 1,00 m du sol). Les végétaux en conteneur seront enracinés depuis au moins deux saisons. Tout végétal non conforme sera refusé à la livraison.",
                        "type_prescription": "materiaux",
                        "niveau": "obligatoire",
                        "normes": ["NF V 12-051", "NF V 12-054"],
                        "ordre": 2,
                    },
                    {
                        "intitule": "Arrosage automatique — réseau et programmation",
                        "corps": "L'installation d'arrosage automatique comprendra : le compteur divisionnaire, le programmateur (multizone, avec sonde pluie et sonde humidimétrique), les électrovannes par zone, les canalisations enterrées en PE 10 bars, les têtes d'arrosage pop-up (secteur réglable) ou goutte-à-goutte. L'installation sera conforme au DTU 65.12 et raccordée au réseau eau de ville via un disconnecteur type EA (NF EN 1717) pour protéger le réseau contre tout retour de pollution. La mise en service comprendra la programmation saisonnière et la vérification de la couverture d'arrosage par zone.",
                        "type_prescription": "mise_en_oeuvre",
                        "niveau": "recommande",
                        "normes": ["DTU 65.12", "NF EN 1717"],
                        "ordre": 3,
                    },
                ],
            },
        ],
    },
]


class Command(BaseCommand):
    help = "Charge en base les 18 lots CCTP et leurs prescriptions types."

    def add_arguments(self, parser):
        parser.add_argument(
            "--reinitialiser",
            action="store_true",
            help="Supprime les données existantes avant le chargement.",
        )

    def handle(self, *args, **options):
        if options["reinitialiser"]:
            self.stdout.write("Suppression des données existantes...")
            PrescriptionCCTP.objects.all().delete()
            ChapitrePrescrip.objects.all().delete()
            LotCCTP.objects.all().delete()
            self.stdout.write(self.style.WARNING("Données supprimées."))

        nb_lots = 0
        nb_chapitres = 0
        nb_prescriptions = 0

        # Correspondance entre les anciens numéros de lot et les codes métier
        CODES_PAR_NUMERO = {
            "7.1": "VRD",
            "7.2": "TERR",
            "7.3": "GO",
            "7.4": "FAC",
            "7.5": "MRC",
            "7.6": "MOB",
            "7.7": "CHMET",
            "7.8": "CHCZ",
            "7.9": "ETAN",
            "7.10": "MENUEXT",
            "7.11": "MENUINT",
            "7.12": "IPP",
            "7.13": "RSC",
            "7.14": "ELEC",
            "7.15": "PLB",
            "7.16": "CVC",
            "7.17": "ASC",
            "7.18": "PAY",
        }

        for donnees_lot in LOTS:
            chapitres_data = donnees_lot.pop("chapitres", [])
            # Convertir le champ "numero" en "code" si nécessaire
            if "numero" in donnees_lot and "code" not in donnees_lot:
                numero_source = donnees_lot.pop("numero")
                donnees_lot["code"] = CODES_PAR_NUMERO.get(numero_source, numero_source)
            lot, cree = LotCCTP.objects.update_or_create(
                code=donnees_lot["code"],
                defaults=donnees_lot,
            )
            if cree:
                nb_lots += 1
                self.stdout.write(f"  Lot créé : {lot}")
            else:
                self.stdout.write(f"  Lot mis à jour : {lot}")

            for donnees_chapitre in chapitres_data:
                prescriptions_data = donnees_chapitre.pop("prescriptions", [])
                chapitre, _ = ChapitrePrescrip.objects.update_or_create(
                    lot=lot,
                    numero=donnees_chapitre["numero"],
                    defaults=donnees_chapitre,
                )
                nb_chapitres += 1

                for donnees_prescrip in prescriptions_data:
                    contient_variables = donnees_prescrip.pop("contient_variables", False)
                    prescrip, cree_p = PrescriptionCCTP.objects.update_or_create(
                        lot=lot,
                        chapitre=chapitre,
                        intitule=donnees_prescrip["intitule"],
                        defaults={**donnees_prescrip, "contient_variables": contient_variables},
                    )
                    if cree_p:
                        nb_prescriptions += 1

        self.stdout.write(self.style.SUCCESS(
            f"\nChargement terminé : {nb_lots} lots créés, "
            f"{nb_chapitres} chapitres, {nb_prescriptions} prescriptions."
        ))
