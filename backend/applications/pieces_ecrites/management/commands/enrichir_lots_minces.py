"""
Enrichit les lots CCTP à faible couverture de prescriptions.
Lots ciblés : TERR, MRC, MOB, CHMET, MENUINT, ASC
Sources : Widloecher & Cusant 3e éd., DTU, NF EN, CCTG, RT 2012 / RE 2020.

Exécution :
    docker compose exec lbh-backend python manage.py enrichir_lots_minces
    Ajouter --lot TERR pour ne traiter qu'un seul lot.
"""

from django.core.management.base import BaseCommand
from django.db import transaction

from applications.pieces_ecrites.models import LotCCTP, ChapitrePrescrip, PrescriptionCCTP


# =============================================================================
# DONNÉES D'ENRICHISSEMENT PAR LOT
# =============================================================================

ENRICHISSEMENTS = {

    # =========================================================================
    # TERR — Terrassements
    # =========================================================================
    "TERR": {
        "chapitres_a_ajouter": [
            {
                "numero": "2",
                "intitule": "Terrassements en masse et en fouilles",
                "ordre": 2,
                "prescriptions": [
                    {
                        "code": "TERR-2.1",
                        "intitule": "Décapage de la terre végétale",
                        "corps": (
                            "La terre végétale sera décapée sur la totalité de l'emprise des travaux sur une "
                            "épaisseur adaptée aux conditions rencontrées (minimum 20 cm sauf avis géotechnicien "
                            "contraire). La terre décapée sera stockée sur le chantier dans des zones prévues à "
                            "cet effet pour réemploi en remblais paysagers, ou évacuée en décharge agréée si "
                            "elle n'est pas réutilisable.\n"
                            "Matériaux : tous types de terres végétales, couverture herbeuse, racines.\n"
                            "Contrôle : épaisseur de décapage vérifiée par sondages ponctuels."
                        ),
                        "type_prescription": "mise_en_oeuvre",
                        "niveau": "obligatoire",
                        "normes": ["NF P 11-300", "Guide technique GTR 2000"],
                        "ordre": 1,
                    },
                    {
                        "code": "TERR-2.2",
                        "intitule": "Fouilles en grande masse et en rigoles",
                        "corps": (
                            "Les fouilles seront exécutées mécaniquement jusqu'aux cotes indiquées sur les plans "
                            "de terrassement. Les parois des fouilles seront maintenues stables par blindage, "
                            "talutage ou tout autre dispositif adapté à la nature du sol et à la profondeur.\n\n"
                            "Blindage : obligatoire au-delà de 1,30 m de profondeur (Code du travail art. R4534-1). "
                            "Calcul de stabilité fourni par l'entrepreneur si profondeur > 3,00 m.\n\n"
                            "Fond de fouille : réception par le maître d'œuvre avant tout début de bétonnage. "
                            "En cas de sol non portant : purge et substitution par matériau d'apport (GNT 0/31,5).\n\n"
                            "Rabattement de nappe : si nappe rencontrée, dispositif de rabattement mis en place "
                            "par l'entrepreneur à sa charge, sans supplément de prix."
                        ),
                        "type_prescription": "mise_en_oeuvre",
                        "niveau": "obligatoire",
                        "normes": [
                            "NF P 94-500 — Classification des missions géotechniques",
                            "NF EN 1997-1 (Eurocode 7) — Calcul géotechnique",
                            "Code du travail R4534-1 à R4534-24",
                        ],
                        "ordre": 2,
                    },
                    {
                        "code": "TERR-2.3",
                        "intitule": "Réception du fond de fouille",
                        "corps": (
                            "Avant tout coulage de béton de propreté ou pose de fondation, l'entrepreneur "
                            "soumettra le fond de fouille à la réception du maître d'œuvre.\n\n"
                            "Contrôles à réaliser :\n"
                            "— Mesure de la portance : essai à la plaque (EV2 ≥ 50 MPa en règle générale) "
                            "ou pénétromètre dynamique selon mission géotechnique.\n"
                            "— Contrôle visuel : absence d'eau stagnante, de remblais non compactés, "
                            "de matériaux meubles ou organiques.\n\n"
                            "En cas de fond de fouille non conforme : purge et substitution aux frais de l'entrepreneur "
                            "si la cause est une mauvaise exécution, ou fait de prix si cause géologique imprévue "
                            "(à justifier par essais de sol complémentaires)."
                        ),
                        "type_prescription": "controles",
                        "niveau": "obligatoire",
                        "normes": [
                            "NF P 94-117-1 — Essai à la plaque",
                            "NF EN ISO 22476-2 — Pénétromètre dynamique",
                        ],
                        "ordre": 3,
                    },
                ],
            },
            {
                "numero": "3",
                "intitule": "Remblais et compactage",
                "ordre": 3,
                "prescriptions": [
                    {
                        "code": "TERR-3.1",
                        "intitule": "Matériaux de remblai",
                        "corps": (
                            "Les matériaux de remblai seront choisis conformément au Guide Technique de Réalisation "
                            "des Remblais (GTR 2000) et à la norme NF P 11-300 :\n\n"
                            "— Matériaux de classe A (limons, argiles peu plastiques) : utilisables sous conditions "
                            "d'état hydrique favorable (Wn ≤ Wopn + 2%).\n"
                            "— Matériaux de classe B (sables, graves) : utilisables sans restriction particulière.\n"
                            "— Matériaux de classe C (calcaires, craies) : selon avis géotechnicien.\n"
                            "— Matériaux de classe D (schistes, ardoises) : avis spécialisé requis.\n"
                            "— Matériaux de classes F et R : interdit en remblai sous bâtiment.\n\n"
                            "Les matériaux organiques, les déchets de chantier et les matériaux gelés sont "
                            "strictement interdits en remblai."
                        ),
                        "type_prescription": "materiaux",
                        "niveau": "obligatoire",
                        "normes": [
                            "NF P 11-300 — Classification des matériaux",
                            "Guide Technique Réalisation des Remblais (GTR 2000 — LCPC/SETRA)",
                        ],
                        "ordre": 1,
                    },
                    {
                        "code": "TERR-3.2",
                        "intitule": "Compactage des remblais",
                        "corps": (
                            "Les remblais seront mis en place par couches successives selon les prescriptions du "
                            "GTR 2000. L'épaisseur des couches et le type d'engin de compactage seront définis "
                            "par l'entrepreneur en fonction de la nature des matériaux et soumis à validation.\n\n"
                            "Objectifs de densification :\n"
                            "— Remblais courants sous voirie légère : q3 (95% OPN)\n"
                            "— Remblais sous dallage ou fondation : q4 (98% OPN)\n"
                            "— Zone de non-compactage sur ouvrages enterrés : 30 cm de part et d'autre, "
                            "compactage à la dame manuelle ou compacteur vibrant léger.\n\n"
                            "Essais de réception :\n"
                            "— Essai Proctor modifié NF P 94-093 : valeur de référence\n"
                            "— Contrôle en place : gammadensimètre ou essai à la plaque tous les 500 m² ou fraction."
                        ),
                        "type_prescription": "mise_en_oeuvre",
                        "niveau": "obligatoire",
                        "normes": [
                            "NF P 94-093 — Essai Proctor modifié",
                            "NF P 94-061-1 — Mesure à la sonde nucléaire",
                            "GTR 2000 — Guide Technique Réalisation des Remblais",
                        ],
                        "ordre": 2,
                    },
                    {
                        "code": "TERR-3.3",
                        "intitule": "Évacuation des terres excédentaires",
                        "corps": (
                            "Les terres excédentaires seront évacuées en décharge agréée par l'entrepreneur. "
                            "Avant tout départ en décharge, l'entrepreneur communiquera au maître d'œuvre le nom "
                            "et l'adresse de la décharge ainsi que les bordereaux de suivi de déchets (BSD).\n\n"
                            "En cas de suspicion de pollution des terres (anciens sites industriels, présence "
                            "d'hydrocarbures, métaux lourds) : des analyses seront réalisées avant évacuation "
                            "(ICS — Inventaire de Contamination des Sols). Les terres polluées seront traitées "
                            "selon la réglementation en vigueur et filière adaptée.\n\n"
                            "Traçabilité : l'entrepreneur fournira les tickets de pesée de la décharge à la "
                            "réception des travaux."
                        ),
                        "type_prescription": "environnement",
                        "niveau": "obligatoire",
                        "normes": [
                            "Loi déchets 2020 — tri à la source 5 flux",
                            "Réglementation ICPE pour décharges de classe 3",
                            "Décret n° 2020-1817 relatif aux déchets de chantier",
                        ],
                        "ordre": 3,
                    },
                ],
            },
            {
                "numero": "4",
                "intitule": "Tolérances et réception",
                "ordre": 4,
                "prescriptions": [
                    {
                        "code": "TERR-4.1",
                        "intitule": "Tolérances d'exécution des terrassements",
                        "corps": (
                            "Les tolérances d'exécution pour les terrassements sont les suivantes :\n\n"
                            "Altimétrie (cotes de fond de fouille) :\n"
                            "— Terrassements courants : ± 5 cm\n"
                            "— Sous dallage ou semelle : + 0 / - 3 cm (pas de surcreusement non compacté)\n\n"
                            "Planimétrie :\n"
                            "— Implantation des fouilles : ± 5 cm par rapport aux plans\n"
                            "— Talus et pentes : ± 5% de la valeur prescrite\n\n"
                            "Profil en travers :\n"
                            "— Bombement des plateformes : 2,5% minimum pour l'écoulement des eaux\n"
                            "— Dérasement de plateforme : ± 3 cm sous règle de 3 m"
                        ),
                        "type_prescription": "tolerances",
                        "niveau": "obligatoire",
                        "normes": ["NF P 98-115 — Assises de chaussées — Exécution"],
                        "ordre": 1,
                    },
                ],
            },
        ],
    },

    # =========================================================================
    # MRC — Murs-rideaux
    # =========================================================================
    "MRC": {
        "chapitres_a_ajouter": [
            {
                "numero": "2",
                "intitule": "Matériaux et composants",
                "ordre": 2,
                "prescriptions": [
                    {
                        "code": "MRC-2.1",
                        "intitule": "Profilés aluminium de murs-rideaux",
                        "corps": (
                            "Les profilés aluminium seront de qualité architecturale, en alliage 6060 ou 6063 "
                            "traitement T5 ou T6, finition thermolaquée ou anodisée selon plan de façade.\n\n"
                            "Traitement thermique des profilés :\n"
                            "— Rupture de pont thermique obligatoire si Uf < 2,4 W/(m².K) requis\n"
                            "— Matériau de rupture : polyamide chargé fibres de verre (PA 66 GF 25)\n"
                            "— Résistance mécanique de l'assemblage rupture de pont thermique : "
                            "conforme NF EN 14024\n\n"
                            "Finition :\n"
                            "— Thermolaquage : norme QUALICOAT classe 1 ou 2 selon exposition, "
                            "épaisseur minimale 60 µm\n"
                            "— Anodisation : norme QUALANOD, épaisseur selon classe d'exposition AA15 à AA25"
                        ),
                        "type_prescription": "materiaux",
                        "niveau": "obligatoire",
                        "normes": [
                            "NF EN 14024 — Profilés métalliques à rupture de pont thermique",
                            "NF EN 573-3 — Alliages d'aluminium",
                            "QUALICOAT — Spécifications thermolaquage aluminium",
                            "QUALANOD — Spécifications anodisation aluminium",
                        ],
                        "ordre": 1,
                    },
                    {
                        "code": "MRC-2.2",
                        "intitule": "Vitrages et calfeutrements",
                        "corps": (
                            "Les vitrages seront conformes aux prescriptions du DTU 39 et aux performances "
                            "thermiques et acoustiques indiquées au CCAP.\n\n"
                            "Types de vitrages admis :\n"
                            "— Double vitrage feuilleté extérieur / lame argon / verre intérieur\n"
                            "— Coefficient Ug ≤ valeur prescrite en CCAP (en général ≤ 1,0 W/(m².K))\n"
                            "— Facteur solaire g : selon orientation (en général ≤ 0,35 pour façade Sud)\n"
                            "— Verre extérieur feuilleté si hauteur ≥ 4 m ou zone d'accès public\n\n"
                            "Joints de calfeutrement :\n"
                            "— Extérieur : joint souple compatible verre et aluminium, classe F25 LM\n"
                            "— Intérieur : cordon de mastic silicone neutre + appui EPDM\n"
                            "— Joints à lèvres EPDM pour contact verre/alliage sur toute la périphérie"
                        ),
                        "type_prescription": "materiaux",
                        "niveau": "obligatoire",
                        "normes": [
                            "DTU 39 — Travaux de miroiterie-vitrerie",
                            "NF EN 1279 — Composants pour vitrages isolants",
                            "NF EN 14449 — Verre feuilleté",
                            "NF EN 673 — Coefficient Ug des vitrages",
                        ],
                        "ordre": 2,
                    },
                ],
            },
            {
                "numero": "3",
                "intitule": "Mise en œuvre et tolérances",
                "ordre": 3,
                "prescriptions": [
                    {
                        "code": "MRC-3.1",
                        "intitule": "Fixations et reprises de charges",
                        "corps": (
                            "Les fixations du mur-rideau sur la structure porteuse seront calculées par "
                            "l'entrepreneur sous la responsabilité d'un ingénieur structure. Les notes de calcul "
                            "seront soumises au maître d'œuvre avant démarrage.\n\n"
                            "Équerres et pattes de scellement :\n"
                            "— En acier inoxydable A4 (316L) ou aluminium anodisé selon exposition\n"
                            "— Jeux de réglage : ± 30 mm en toutes directions\n"
                            "— Reprises : efforts de poids propre, vent (pression et dépression), "
                            "dilatation thermique (coefficient linéaire α = 23.10⁻⁶ /°C pour aluminium)\n\n"
                            "Dilatation : les joints de dilatation du mur-rideau seront positionnés tous les "
                            "12 à 15 m ou au droit des joints de structure."
                        ),
                        "type_prescription": "mise_en_oeuvre",
                        "niveau": "obligatoire",
                        "normes": [
                            "NF EN 1991-1-4 — Eurocode 1 — Actions du vent",
                            "NF P 28-003 — Façades légères",
                            "DTU 33.1 — Façades rideaux",
                        ],
                        "ordre": 1,
                    },
                    {
                        "code": "MRC-3.2",
                        "intitule": "Tolérances d'exécution murs-rideaux",
                        "corps": (
                            "Les tolérances d'exécution du mur-rideau sont les suivantes :\n\n"
                            "— Planéité de la façade : écart max. 3 mm sous règle de 2 m\n"
                            "— Verticalité des montants : ± 2 mm / m, maxi ± 6 mm sur hauteur d'étage\n"
                            "— Rectitude des montants : flèche ≤ L/500 sous charge permanente\n"
                            "— Jeu entre vitrages : ± 2 mm par rapport à la valeur nominale\n"
                            "— Largeur de joint apparent : ± 2 mm par rapport à la valeur nominale\n\n"
                            "Contrôle : mesures réalisées sur 10% des travées minimum, en présence du "
                            "maître d'œuvre, avant pose des finitions intérieures."
                        ),
                        "type_prescription": "tolerances",
                        "niveau": "obligatoire",
                        "normes": [
                            "DTU 33.1 — Façades rideaux",
                            "NF P 28-003 — Façades légères, enveloppes légères",
                        ],
                        "ordre": 2,
                    },
                    {
                        "code": "MRC-3.3",
                        "intitule": "Essais en usine et contrôles AEV",
                        "corps": (
                            "Avant démarrage des travaux, l'entrepreneur fournira les rapports d'essais en "
                            "laboratoire agréé démontrant les performances AEV du système retenu :\n\n"
                            "— A (Air) : perméabilité à l'air classe 4 (EN 12153 / EN 12152)\n"
                            "— E (Eau) : étanchéité à l'eau classe 9A ou supérieure (EN 12155 / EN 12154)\n"
                            "— V (Vent) : résistance au vent selon calcul de charge (EN 12179 / EN 13116)\n\n"
                            "En cas de système sans référence d'essai, réalisation d'essais de convenance "
                            "sur maquette à l'échelle 1, avant démarrage de la fabrication en série."
                        ),
                        "type_prescription": "controles",
                        "niveau": "obligatoire",
                        "normes": [
                            "NF EN 12152 / 12153 — Perméabilité à l'air murs-rideaux",
                            "NF EN 12154 / 12155 — Étanchéité à l'eau murs-rideaux",
                            "NF EN 13116 — Résistance aux charges de vent",
                        ],
                        "ordre": 3,
                    },
                ],
            },
        ],
    },

    # =========================================================================
    # MOB — Construction ossature bois
    # =========================================================================
    "MOB": {
        "chapitres_a_ajouter": [
            {
                "numero": "2",
                "intitule": "Structure et assemblages",
                "ordre": 2,
                "prescriptions": [
                    {
                        "code": "MOB-2.1",
                        "intitule": "Ossature bois — classes de service et sections",
                        "corps": (
                            "L'ossature bois sera réalisée en bois massif ou bois lamellé-collé GL24h/GL28h. "
                            "La classe de service sera déterminée selon la norme NF EN 1995-1-1 (Eurocode 5) "
                            "en fonction de l'hygrométrie du local et de la protection extérieure.\n\n"
                            "Classes de service courantes en construction bois :\n"
                            "— Classe 1 (intérieur sec) : humidité du bois ≤ 12%\n"
                            "— Classe 2 (intérieur humide) : humidité ≤ 20%, classe de durabilité D2-D3\n"
                            "— Classe 3 (extérieur, exposé) : traitement de préservation classe 4 minimum\n\n"
                            "Sections minimales :\n"
                            "— Montants ossature : sections calculées sous charges combinées (structure + vent)\n"
                            "— Entraxe des montants : 600 mm ou 400 mm selon isolation projetée\n"
                            "— Lisse basse et haute : même section que les montants, traitement humidité classe 3\n\n"
                            "Contremarques et marques de qualité acceptées : CE + CTB, NF Bois de Construction."
                        ),
                        "type_prescription": "materiaux",
                        "niveau": "obligatoire",
                        "normes": [
                            "NF EN 1995-1-1 (Eurocode 5) — Conception et calcul des structures en bois",
                            "NF EN 338 — Bois de structure — classes de résistance",
                            "NF EN 14080 — Bois lamellé-collé",
                            "DTU 31.2 — Construction de maisons et bâtiments à ossature en bois",
                        ],
                        "ordre": 1,
                    },
                    {
                        "code": "MOB-2.2",
                        "intitule": "Contreventement et stabilité",
                        "corps": (
                            "Le contreventement de la structure ossature bois sera assuré par :\n\n"
                            "— Panneaux de contreventement rigides (OSB 3 ou 4, CtbX, ou panneaux "
                            "de fibres-ciment) cloués ou vissés sur les montants\n"
                            "— Ou croix de Saint-André en bois ou en métal\n"
                            "— Ou murs en maçonnerie intégrés si présents\n\n"
                            "Calcul de stabilité : note de calcul fournie par le bureau d'études structure de "
                            "l'entrepreneur, vérifiée par le bureau de contrôle. L'effort de vent (NF EN 1991-1-4) "
                            "sera repris par les diaphragmes horizontaux (planchers) et les voiles de contreventement.\n\n"
                            "Assemblages mécaniques :\n"
                            "— Vis et pointes en acier zingué (classe de corrosion C2 mini) ou inox A4\n"
                            "— Connecteurs métalliques (Simpson, Rothoblaas ou équivalent) pour noeuds critiques\n"
                            "— Pas de collage structural sans avis spécialisé"
                        ),
                        "type_prescription": "mise_en_oeuvre",
                        "niveau": "obligatoire",
                        "normes": [
                            "NF EN 1995-1-1 (Eurocode 5)",
                            "NF EN 1991-1-4 — Actions du vent",
                            "DTU 31.2",
                            "NF EN 300 — Panneaux OSB",
                        ],
                        "ordre": 2,
                    },
                    {
                        "code": "MOB-2.3",
                        "intitule": "Isolation et performance thermique",
                        "corps": (
                            "L'isolation thermique de l'ossature bois sera réalisée selon les prescriptions "
                            "de la RE 2020 (bâtiments neufs) ou de la réglementation thermique applicable.\n\n"
                            "Types d'isolants admis en paroi ossature bois :\n"
                            "— Laine minérale (MW) : λ ≤ 0,040 W/(m.K), classement Euroclasse A1 ou A2\n"
                            "— Fibre de bois (WF) : λ ≤ 0,038 W/(m.K), classement Euroclasse E\n"
                            "— Ouate de cellulose en vrac : DTA ou Avis Technique requis\n"
                            "— PSE, XPS, PUR : utilisables si non exposés à la vapeur intérieure\n\n"
                            "Pont thermique :\n"
                            "— Isolation par l'extérieur (ITE sarking) pour réduire les ponts thermiques des montants\n"
                            "— Ou double ossature croisée intérieure\n"
                            "— Coupure thermique sur lisse basse et ancrages si contact sol\n\n"
                            "Contrôle : test d'étanchéité à l'air (porte soufflante) n50 ≤ 0,6 vol/h "
                            "(niveau Passif) ou ≤ 1,0 vol/h (RE 2020 standard)."
                        ),
                        "type_prescription": "mise_en_oeuvre",
                        "niveau": "obligatoire",
                        "normes": [
                            "RE 2020 — Réglementation Environnementale 2020",
                            "NF EN 13162 à 13171 — Produits isolants thermiques",
                            "DTU 31.2",
                            "NF EN 13829 — Perméabilité à l'air des bâtiments",
                        ],
                        "ordre": 3,
                    },
                    {
                        "code": "MOB-2.4",
                        "intitule": "Protection incendie des structures bois",
                        "corps": (
                            "La résistance au feu des éléments de structure en bois sera déterminée "
                            "conformément à l'Eurocode 5 partie 1-2 (NF EN 1995-1-2) et aux exigences "
                            "réglementaires (arrêté du 31/01/1986 pour les ERP, arrêté du 30/12/2011 "
                            "pour les immeubles d'habitation).\n\n"
                            "Méthodes de justification :\n"
                            "— Calcul de la section résiduelle : vitesse de carbonisation β₀ = 0,65 mm/min "
                            "pour bois massif, β₀ = 0,70 mm/min pour lamellé-collé\n"
                            "— Doublage par un parement coupe-feu (BA13 F ou BA18) : solution simplifiée\n"
                            "— Protection par enduit intumescent : sur avis technique\n\n"
                            "Objectifs courants : R30 à R60 pour les structures portantes, "
                            "EI30 à EI60 pour les parois séparatives."
                        ),
                        "type_prescription": "securite",
                        "niveau": "obligatoire",
                        "normes": [
                            "NF EN 1995-1-2 (Eurocode 5 partie feu)",
                            "Arrêté du 31/01/1986 — ERP",
                            "NF EN 13501-2 — Classification au feu",
                        ],
                        "ordre": 4,
                    },
                ],
            },
        ],
    },

    # =========================================================================
    # CHMET — Charpente métallique
    # =========================================================================
    "CHMET": {
        "chapitres_a_ajouter": [
            {
                "numero": "2",
                "intitule": "Matériaux et assemblages",
                "ordre": 2,
                "prescriptions": [
                    {
                        "code": "CHMET-2.1",
                        "intitule": "Acier de construction — nuances, essais et certifications",
                        "corps": (
                            "Les aciers de construction seront conformes à la norme NF EN 10025-2 :\n"
                            "— S235JR : usage courant, épaisseur ≤ 16 mm, Reh ≥ 235 N/mm²\n"
                            "— S275JR ou S275J0 : usage courant, eléments principaux\n"
                            "— S355J0 ou S355JR : éléments sollicités en fatigue ou exposés au froid\n"
                            "— S355K2 : zones sismiques ou structures très sollicitées\n\n"
                            "Certificats matière :\n"
                            "— Certificats NF EN 10204-3.1 ou 3.2 exigés pour tous les éléments de structure\n"
                            "— Traçabilité des coulées jusqu'à la mise en œuvre\n\n"
                            "Contrôle d'entrée :\n"
                            "— Vérification du marquage CE et des certificats avant découpe\n"
                            "— Contrôle dimensionnel selon NF EN 10034 (IPE/HEA/HEB) ou NF EN 10210/10219 "
                            "(tubes) ou NF EN 10162 (profilés à froid)"
                        ),
                        "type_prescription": "materiaux",
                        "niveau": "obligatoire",
                        "normes": [
                            "NF EN 10025-2 — Produits laminés à chaud — acier non allié",
                            "NF EN 10204 — Documents de contrôle",
                            "NF EN 10034 — Tolérances profilés IPE/HEA/HEB",
                            "NF EN 1090-1 — Exécution des structures en acier",
                        ],
                        "ordre": 1,
                    },
                    {
                        "code": "CHMET-2.2",
                        "intitule": "Assemblages boulonnés et soudés",
                        "corps": (
                            "Assemblages boulonnés :\n"
                            "— Boulons HR (haute résistance) : classe 8.8 ou 10.9 selon effort\n"
                            "— Écrous et rondelles associés selon EN 14399-1\n"
                            "— Serrage contrôlé : méthode du couple (clé dynamométrique) ou du tour (méthode DTI)\n"
                            "— Couples de serrage selon NF EN 1090-2 tableau 17\n"
                            "— Boulons ordinaires (classe 4.6 ou 5.6) : assemblages secondaires uniquement\n\n"
                            "Assemblages soudés :\n"
                            "— Qualification des modes opératoires : QMOS selon ISO 15614-1\n"
                            "— Qualification des soudeurs : QS selon ISO 9606-1\n"
                            "— Classe d'exécution EXC2 ou EXC3 selon NF EN 1090-2 et niveau de conséquence\n"
                            "— Contrôle des soudures : visuel 100%, ressuage ou magnétoscopie 10-20%, "
                            "ultrasons sur soudures de pénétration complète\n"
                            "— Groupe de qualité des soudures selon EN ISO 5817 niveau B ou C"
                        ),
                        "type_prescription": "mise_en_oeuvre",
                        "niveau": "obligatoire",
                        "normes": [
                            "NF EN 1090-2 — Exécution des structures en acier",
                            "ISO 15614-1 — Qualification des modes opératoires de soudage",
                            "ISO 9606-1 — Qualification des soudeurs",
                            "EN ISO 5817 — Niveaux de qualité soudures",
                        ],
                        "ordre": 2,
                    },
                    {
                        "code": "CHMET-2.3",
                        "intitule": "Tolérances d'exécution — charpente métallique",
                        "corps": (
                            "Les tolérances d'exécution de la charpente métallique sont définies dans "
                            "la norme NF EN 1090-2 :\n\n"
                            "Tolérances essentielles (catégorie E) :\n"
                            "— Rectitude des colonnes : Δ ≤ H/750 (H = hauteur entre nœuds)\n"
                            "— Verticalité globale : Δ ≤ H_total/500\n"
                            "— Niveau des poutres : Δ ≤ L/500 + 10 mm (flèche sous poids propre)\n"
                            "— Dénivelé au niveau des appuis de poutres : ± 3 mm\n\n"
                            "Tolérances fonctionnelles (catégorie F) :\n"
                            "— Déformation des assemblages boulonnés : ± 2 mm\n"
                            "— Faux-aplomb des colonnes : ≤ 1/200 de la hauteur d'étage\n\n"
                            "Contrôle géométrique : relevé topographique par géomètre-expert "
                            "après montage et avant soudures de finition."
                        ),
                        "type_prescription": "tolerances",
                        "niveau": "obligatoire",
                        "normes": [
                            "NF EN 1090-2 Annexe D — Tolérances géométriques",
                        ],
                        "ordre": 3,
                    },
                    {
                        "code": "CHMET-2.4",
                        "intitule": "Réception et levage de la charpente",
                        "corps": (
                            "Plan de montage : l'entrepreneur soumettra un plan de montage détaillant "
                            "les séquences de montage, les étaiements provisoires, les moyens de levage "
                            "et les vérifications intermédiaires. Ce plan sera validé par l'ingénieur "
                            "structure avant démarrage.\n\n"
                            "Levage :\n"
                            "— Masse des éléments à vérifier par rapport à la capacité des engins de levage\n"
                            "— Points de levage indiqués sur les plans de fabrication\n"
                            "— Équilibre des éléments levés : plat avec écart d'aplomb ≤ 1/100\n\n"
                            "Contrôles de réception :\n"
                            "— Contrôle géométrique final (topographie)\n"
                            "— Réception des soudures (rapports de CND)\n"
                            "— Réception des peintures (épaisseur, adhérence)\n"
                            "— Procès-verbal de réception signé par le maître d'œuvre"
                        ),
                        "type_prescription": "reception",
                        "niveau": "obligatoire",
                        "normes": [
                            "NF EN 1090-2",
                            "CSTB — Recommandations pour le montage des structures métalliques",
                        ],
                        "ordre": 4,
                    },
                ],
            },
        ],
    },

    # =========================================================================
    # MENUINT — Menuiseries intérieures et serrurerie
    # =========================================================================
    "MENUINT": {
        "chapitres_a_ajouter": [
            {
                "numero": "2",
                "intitule": "Cloisons et doublages",
                "ordre": 2,
                "prescriptions": [
                    {
                        "code": "MENUINT-2.1",
                        "intitule": "Cloisons en plaques de plâtre",
                        "corps": (
                            "Les cloisons légères en plaques de plâtre seront conformes au DTU 25.41. "
                            "L'entrepreneur s'assurera de la compatibilité entre la cloison proposée et les "
                            "performances acoustiques et coupe-feu requises.\n\n"
                            "Plaques de plâtre :\n"
                            "— Plaques standard BA13 (type A) : locaux secs\n"
                            "— Plaques hydrofuges BA13 (type H1/H2) : locaux humides (salles de bain, cuisines)\n"
                            "— Plaques coupe-feu BA13F ou BA18F : couloirs, circulations\n"
                            "— Plaques haute dureté HD (type D) : murs susceptibles de chocs\n\n"
                            "Ossature :\n"
                            "— Rails et montants acier galvanisé, épaisseur ≥ 0,6 mm\n"
                            "— Isolation phonique : laine minérale 45 mm ou 90 mm selon performance requise\n\n"
                            "Performances acoustiques minimales (selon usage) :\n"
                            "— Séparation bureau/bureau : Rw+C ≥ 38 dB\n"
                            "— Séparation appartement/appartement : Rw+C ≥ 53 dB (NRA 2000)"
                        ),
                        "type_prescription": "materiaux",
                        "niveau": "obligatoire",
                        "normes": [
                            "DTU 25.41 — Ouvrages en plaques de plâtre",
                            "NF EN 520 — Plaques de plâtre",
                            "NF EN 13964 — Plafonds suspendus",
                            "Arrêté NRA 2000 — Nouvelle Réglementation Acoustique",
                        ],
                        "ordre": 1,
                    },
                    {
                        "code": "MENUINT-2.2",
                        "intitule": "Portes intérieures — bâtis, vantaux et quincaillerie",
                        "corps": (
                            "Les portes intérieures seront de type bloc-porte à huisserie ou bâti. "
                            "Les performances (acoustique, coupe-feu, PMR) seront définies selon les locaux "
                            "desservis conformément à la réglementation applicable.\n\n"
                            "Bâtis et huisseries :\n"
                            "— Bâtis métalliques galvanisés ou bois massif selon finition\n"
                            "— Réglage : ± 5 mm en toutes directions avant scellement ou vissage\n\n"
                            "Vantaux :\n"
                            "— Portes stratifiées postformées (SPF) : usage courant\n"
                            "— Portes en bois massif ou placage : locaux nobles\n"
                            "— Portes coupe-feu : certifiées (essai de type EI30/EI60) — marquage CE obligatoire\n\n"
                            "Quincaillerie :\n"
                            "— Gonds / paumelles : acier inoxydable ou laiton chromé, 3 paumelles par vantail > 70 kg\n"
                            "— Serrures : NF ou A2P selon niveau de sécurité requis\n"
                            "— Poignées : conformes accessibilité PMR (NF EN 179 ou NF EN 1125)\n"
                            "— Ferme-portes : EN 1154, force appropriée à la masse du vantail"
                        ),
                        "type_prescription": "materiaux",
                        "niveau": "obligatoire",
                        "normes": [
                            "DTU 36.2 — Menuiseries intérieures en bois",
                            "NF EN 14351-2 — Portes et fenêtres intérieures",
                            "NF EN 179 — Dispositifs de sortie à poignée",
                            "NF EN 1125 — Dispositifs antipanique",
                        ],
                        "ordre": 2,
                    },
                    {
                        "code": "MENUINT-2.3",
                        "intitule": "Serrurerie — garde-corps et rampes",
                        "corps": (
                            "Les garde-corps et rampes d'escalier seront conformes au NF P 01-013 et "
                            "à la norme européenne NF EN 1337-3.\n\n"
                            "Hauteur des garde-corps :\n"
                            "— ERP et logements collectifs : 1,00 m minimum\n"
                            "— Hauteur de chute > 1 m : 1,00 m (h chute < 1 m), 1,05 m si l'écart est supérieur\n"
                            "— Escaliers ERP : 1,10 m recommandé côté chute\n\n"
                            "Résistance mécanique :\n"
                            "— Charge horizontale répartie : 0,60 kN/m\n"
                            "— Charge horizontale concentrée : 1,00 kN en tout point\n"
                            "— Charge verticale : 1,20 kN/m sur la main courante\n"
                            "— Note de calcul fournie par l'entrepreneur avant fabrication\n\n"
                            "Matériaux admis :\n"
                            "— Acier galvanisé + thermolaquage : zones intérieures sèches\n"
                            "— Acier inoxydable AISI 304 : zones humides\n"
                            "— Acier inoxydable AISI 316 : zones très humides ou agressives\n"
                            "— Verre feuilleté : verre de sécurité 66.2 mini, avec certification"
                        ),
                        "type_prescription": "mise_en_oeuvre",
                        "niveau": "obligatoire",
                        "normes": [
                            "NF P 01-013 — Garde-corps — Règles de sécurité",
                            "NF EN 1337-3 — Garde-corps",
                            "Arrêté du 22/02/1974 (ERP)",
                        ],
                        "ordre": 3,
                    },
                    {
                        "code": "MENUINT-2.4",
                        "intitule": "Tolérances et contrôles — menuiseries intérieures",
                        "corps": (
                            "Tolérances d'exécution pour les menuiseries intérieures (DTU 36.2) :\n\n"
                            "Pose des bâtis et huisseries :\n"
                            "— Aplomb : ± 2 mm / m, maxi ± 4 mm sur hauteur totale\n"
                            "— Niveau linteau : ± 3 mm par rapport au nu fini du plafond\n"
                            "— Jeu vantail/bâti : 2 à 4 mm en fond de feuillure\n"
                            "— Jeu bas de vantail / sol fini : 8 à 10 mm (ou 15 mm si retour d'air prévu)\n\n"
                            "Contrôles avant réception :\n"
                            "— Vérification de l'ouverture et fermeture sans forcer\n"
                            "— Vérification du fonctionnement de la serrure et des organes de sécurité\n"
                            "— Contrôle visuel du calfeutrement (bandes d'étanchéité EPDM)\n"
                            "— Vérification de la mise à niveau des seuils (accessible PMR si requis)"
                        ),
                        "type_prescription": "tolerances",
                        "niveau": "recommande",
                        "normes": ["DTU 36.2", "Référentiel PMR — Arrêté du 20/04/2017"],
                        "ordre": 4,
                    },
                ],
            },
        ],
    },

    # =========================================================================
    # ASC — Ascenseur et monte-charge
    # =========================================================================
    "ASC": {
        "chapitres_a_ajouter": [
            {
                "numero": "2",
                "intitule": "Gaine, cuvette et local machinerie",
                "ordre": 2,
                "prescriptions": [
                    {
                        "code": "ASC-2.1",
                        "intitule": "Gaine d'ascenseur — dimensions et résistance au feu",
                        "corps": (
                            "La gaine d'ascenseur sera réalisée par le lot Gros Œuvre selon les plans "
                            "fournis par le fabricant d'ascenseur. L'entrepreneur du présent lot vérifiera "
                            "la conformité de la gaine avant démarrage de ses travaux.\n\n"
                            "Dimensions minimales de gaine :\n"
                            "— Dégagement libre entre parois : selon gabarit fourni par le fabricant + "
                            "250 mm de jeu par côté minimum\n"
                            "— Hauteur de débord en tête de gaine : selon calcul fabricant (≥ 500 mm)\n"
                            "— Profondeur de cuvette : selon fabricant, en général 1 100 à 1 400 mm\n\n"
                            "Résistance au feu de la gaine :\n"
                            "— EI60 minimum en IGH et ERP\n"
                            "— EI30 en bâtiments d'habitation et bureaux < 28 m\n"
                            "— Porte palière : EI30 minimum, anti-fumée\n\n"
                            "Ventilation de gaine : ouverture de ventilation haute ≥ 1% de la surface de gaine, "
                            "protégée de la pluie."
                        ),
                        "type_prescription": "mise_en_oeuvre",
                        "niveau": "obligatoire",
                        "normes": [
                            "NF EN 81-20 — Ascenseurs — Règles de sécurité",
                            "Directive 2014/33/UE (Directive Ascenseurs)",
                            "NF EN 81-21 — Ascenseurs existants",
                        ],
                        "ordre": 1,
                    },
                    {
                        "code": "ASC-2.2",
                        "intitule": "Équipements de la cabine et accessibilité PMR",
                        "corps": (
                            "La cabine de l'ascenseur sera conforme aux exigences d'accessibilité PMR "
                            "(Arrêté du 20/04/2017 et NF EN 81-70).\n\n"
                            "Dimensions minimales de la cabine :\n"
                            "— Logement collectif : 1,00 m × 1,25 m (profondeur) — 8 personnes / 630 kg\n"
                            "— ERP (catégories 1 à 4) : 1,10 m × 1,40 m — 10 personnes / 800 kg\n"
                            "— ERP catégorie 5 : 1,00 m × 1,30 m minimum\n\n"
                            "Équipements obligatoires :\n"
                            "— Téléphone bi-directionnel : liaison permanente avec poste de sécurité\n"
                            "— Éclairage de secours : autonomie ≥ 1 heure\n"
                            "— Miroir en fond de cabine (PMR)\n"
                            "— Main courante sur trois parois (ERP)\n"
                            "— Bandeau de protection en bas de porte palière\n"
                            "— Affichage braille sur tous les boutons\n"
                            "— Message vocal automatique à chaque étage\n\n"
                            "Portes :\n"
                            "— Portes automatiques coulissantes côté cabine et palier\n"
                            "— Largeur utile de passage : ≥ 900 mm en ERP, ≥ 800 mm en logement"
                        ),
                        "type_prescription": "mise_en_oeuvre",
                        "niveau": "obligatoire",
                        "normes": [
                            "NF EN 81-70 — Accessibilité des ascenseurs",
                            "Arrêté du 20/04/2017 — Accessibilité PMR",
                            "NF EN 81-20 / 81-50",
                        ],
                        "ordre": 2,
                    },
                    {
                        "code": "ASC-2.3",
                        "intitule": "Énergie et performance",
                        "corps": (
                            "La consommation énergétique de l'ascenseur sera conforme à la classe VDI 4707 "
                            "ou ISO 25745.\n\n"
                            "Classe de consommation minimale :\n"
                            "— Logement collectif : classe C ou mieux\n"
                            "— ERP et tertiaire : classe B recommandée\n\n"
                            "Motorisation :\n"
                            "— Moteur à aimants permanents (gearless) ou variation de fréquence : recommandé\n"
                            "— Puissance d'éclairage cabine : LED, ≤ 5 W en veille\n"
                            "— Récupération d'énergie au freinage : option à prévoir\n\n"
                            "Dimensionnement électrique :\n"
                            "— L'entrepreneur du lot Électricité fournira l'alimentation jusqu'au tableau "
                            "d'ascenseur dans la gaine ou la machinerie\n"
                            "— Puissance de raccordement fournie par le fabricant d'ascenseur"
                        ),
                        "type_prescription": "materiaux",
                        "niveau": "recommande",
                        "normes": [
                            "ISO 25745 — Performance énergétique des ascenseurs",
                            "VDI 4707 — Ascenseurs et escaliers mécaniques — Performance énergétique",
                        ],
                        "ordre": 3,
                    },
                    {
                        "code": "ASC-2.4",
                        "intitule": "Réception, essais et remise des documents",
                        "corps": (
                            "L'ascenseur fera l'objet d'une vérification initiale par un organisme de contrôle "
                            "agréé (APAVE, SOCOTEC, Bureau Veritas ou équivalent) avant mise en service.\n\n"
                            "Essais de réception :\n"
                            "— Essai de charge nominale : 125% de la charge nominale pendant 30 min\n"
                            "— Essai de vitesse : vitesse nominale à charge nominale (± 5%)\n"
                            "— Essai de freinage : arrêt en charge normale et en surcharge\n"
                            "— Essai des dispositifs de sécurité (parachute, limiteur de vitesse, contact "
                            "de fond de cuvette, fin de course)\n"
                            "— Test téléphone : appel bi-directionnel fonctionnel\n"
                            "— Test éclairage de secours : fonctionnement en coupure secteur\n\n"
                            "Documents remis à la réception :\n"
                            "— Déclaration de conformité CE (marquage CE)\n"
                            "— Rapport de vérification initiale de l'organisme de contrôle\n"
                            "— Notice d'instruction et carnet d'entretien\n"
                            "— Schémas électriques et plans de la gaine\n"
                            "— Contrat d'entretien proposé (au minimum)"
                        ),
                        "type_prescription": "reception",
                        "niveau": "obligatoire",
                        "normes": [
                            "NF EN 81-20 — Règles de sécurité pour ascenseurs",
                            "Directive 2014/33/UE — Ascenseurs",
                            "Décret n° 2000-810 du 24/08/2000 — Vérification des ascenseurs",
                        ],
                        "ordre": 4,
                    },
                ],
            },
        ],
    },
}


# =============================================================================
# COMMANDE
# =============================================================================

class Command(BaseCommand):
    help = "Enrichit les lots CCTP à faible couverture (TERR, MRC, MOB, CHMET, MENUINT, ASC)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--lot",
            type=str,
            default=None,
            help="Code du lot à enrichir (ex: TERR). Par défaut : tous les lots configurés.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Affiche ce qui serait créé sans écrire en base.",
        )

    def handle(self, *args, **options):
        lot_cible = options.get("lot")
        dry_run = options.get("dry_run", False)

        codes = [lot_cible] if lot_cible else list(ENRICHISSEMENTS.keys())
        nb_total = 0

        for code in codes:
            if code not in ENRICHISSEMENTS:
                self.stderr.write(f"Lot inconnu : {code}")
                continue

            try:
                lot = LotCCTP.objects.get(code=code)
            except LotCCTP.DoesNotExist:
                self.stderr.write(f"Lot {code} non trouvé en base.")
                continue

            config = ENRICHISSEMENTS[code]
            nb_lot = self._enrichir_lot(lot, config, dry_run)
            nb_total += nb_lot

        mode = "[DRY-RUN] " if dry_run else ""
        self.stdout.write(
            self.style.SUCCESS(f"{mode}{nb_total} prescription(s) ajoutée(s).")
        )

    @transaction.atomic
    def _enrichir_lot(self, lot: LotCCTP, config: dict, dry_run: bool) -> int:
        nb = 0
        for ch_cfg in config.get("chapitres_a_ajouter", []):
            # Vérifier si le chapitre existe déjà
            chapitre, cree = ChapitrePrescrip.objects.get_or_create(
                lot=lot,
                numero=ch_cfg["numero"],
                defaults={
                    "intitule": ch_cfg["intitule"],
                    "ordre": ch_cfg["ordre"],
                },
            )
            if not cree and not dry_run:
                # Mettre à jour l'intitulé si différent
                if chapitre.intitule != ch_cfg["intitule"]:
                    chapitre.intitule = ch_cfg["intitule"]
                    chapitre.save(update_fields=["intitule"])

            action = "CRÉÉ" if cree else "EXISTANT"
            self.stdout.write(f"  {lot.code} / Chapitre {ch_cfg['numero']} [{action}]")

            for p_cfg in ch_cfg.get("prescriptions", []):
                code_prescription = p_cfg.get("code", "")
                # Ne pas dupliquer si prescription avec même intitulé existe déjà
                existe = PrescriptionCCTP.objects.filter(
                    lot=lot,
                    intitule=p_cfg["intitule"],
                ).exists()

                if existe:
                    self.stdout.write(f"    → [IGNORÉ — déjà en base] {p_cfg['intitule']}")
                    continue

                if dry_run:
                    self.stdout.write(
                        f"    → [DRY-RUN] {p_cfg['intitule'][:80]}"
                    )
                    nb += 1
                    continue

                PrescriptionCCTP.objects.create(
                    lot=lot,
                    chapitre=chapitre,
                    code=code_prescription,
                    intitule=p_cfg["intitule"],
                    corps=p_cfg["corps"],
                    type_prescription=p_cfg["type_prescription"],
                    niveau=p_cfg["niveau"],
                    normes=p_cfg["normes"],
                    est_actif=True,
                    ordre=p_cfg["ordre"],
                )
                self.stdout.write(
                    f"    ✓ {p_cfg['intitule'][:80]}"
                )
                nb += 1

        return nb
