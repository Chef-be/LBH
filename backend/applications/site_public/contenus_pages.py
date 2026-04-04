"""Contenus éditoriaux par défaut des pages publiques du site."""


CONTENUS_PAGES_PAR_DEFAUT = {
    "contact": {
        "metadata": {
            "titre_page": "Nous contacter",
            "description_page": "Contactez le bureau pour vos projets de construction, demandes d'information, devis ou partenariats.",
        },
        "hero": {
            "badge": "Parlons de votre projet",
            "titre": "Nous contacter",
            "description": "Présentez votre besoin, votre contexte et vos objectifs. Nous reviendrons vers vous pour qualifier votre demande.",
        },
        "coordonnees": {
            "titre": "Coordonnées",
            "courriel": "Courriel",
            "telephone": "Téléphone",
            "adresse": "Adresse",
            "delai_titre": "Délai de réponse",
            "delai_valeur": "Sous 24 à 48 heures ouvrées",
        },
        "exemples": {
            "titre": "Exemples de demandes",
            "liste": [
                "Demande de devis pour un chiffrage",
                "Accompagnement maîtrise d'œuvre",
                "Réponse à un appel d'offres",
                "Analyse de rentabilité",
                "Dimensionnement voirie ou bâtiment",
            ],
        },
        "espace_prive": {
            "question": "Vous êtes un collaborateur ?",
            "bouton": "Espace de travail",
        },
        "formulaire": {
            "titre": "Votre demande",
        },
    },
    "notre_methode": {
        "metadata": {
            "titre_page": "Notre méthode",
            "description_page": "Découvrez notre méthode de travail : rigueur technique, traçabilité des calculs, conformité aux référentiels et accompagnement de bout en bout.",
        },
        "hero": {
            "badge": "Notre manière de travailler",
            "titre": "Notre méthode",
            "description": "Une approche structurée, documentée et contractuellement maîtrisée, de l'analyse initiale au bilan final de l'opération.",
        },
        "engagements": {
            "liste": [
                {"valeur": "100%", "libelle": "Calculs documentés et traçables"},
                {"valeur": "6", "libelle": "Domaines d'expertise couverts"},
                {"valeur": "0", "libelle": "Constante métier figée sans justification"},
            ],
        },
        "phases": {
            "badge": "De la commande à la clôture",
            "titre": "Nos six phases d'intervention",
            "liste": [
                {
                    "numero": "01",
                    "icone": "Search",
                    "titre": "Analyse du contexte",
                    "description": "Nous ouvrons systématiquement les pièces marché, plans, notes techniques et hypothèses économiques pour cadrer le besoin, les risques et le périmètre exact de mission.",
                    "points": [
                        "Lecture du DCE, des pièces contractuelles et du programme",
                        "Repérage des contraintes techniques et des interfaces",
                        "Qualification des hypothèses de métrés et de prix",
                        "Définition des livrables et points de vigilance",
                    ],
                },
                {
                    "numero": "02",
                    "icone": "PenTool",
                    "titre": "Production des études",
                    "description": "Chaque étude est construite sur une logique explicite : hypothèses, source, domaine de validité, contrôle interne et justification technique.",
                    "points": [
                        "Méthodes conformes aux guides de référence et règles de l'art",
                        "Traçabilité complète des hypothèses et calculs",
                        "Notes justificatives et alertes de domaine de validité",
                        "Contrôle interne systématique avant restitution",
                    ],
                },
                {
                    "numero": "03",
                    "icone": "BarChart3",
                    "titre": "Analyse économique",
                    "description": "Nous relions systématiquement les quantités, les rendements, les déboursés, les frais et la marge pour donner une lecture exploitable de la rentabilité réelle.",
                    "points": [
                        "Déboursé sec, coût direct, coût de revient et prix de vente",
                        "Analyse de rentabilité par poste, lot et variante",
                        "Comparaison de solutions techniques et seuils critiques",
                        "Révision et actualisation des prix",
                    ],
                },
                {
                    "numero": "04",
                    "icone": "FileText",
                    "titre": "Rédaction documentaire",
                    "description": "Les pièces écrites suivent une structure de lecture claire : consistance du lot, ouvrages élémentaires, points particuliers, contrôles et exigences d'exécution.",
                    "points": [
                        "CCTP lot par lot, CCAP, règlement de consultation",
                        "DPGF / BPU / DQE et tableaux quantitatifs",
                        "Mémoires techniques, notes de calcul et pièces de réponse",
                        "Documents exportables et versionnés",
                    ],
                },
                {
                    "numero": "05",
                    "icone": "Wrench",
                    "titre": "Accompagnement en phase travaux",
                    "description": "Nous suivons l'exécution, les interfaces et la documentation de chantier avec une logique MOE/OPC : visa, préparation, ordonnancement, aléas, modifications et réception.",
                    "points": [
                        "VISA des documents d'exécution",
                        "DET et suivi économique du chantier",
                        "Ordonnancement, pilotage et coordination",
                        "Situations, attachements et travaux modificatifs",
                        "Ordres de service, comptes rendus et délais",
                    ],
                },
                {
                    "numero": "06",
                    "icone": "ClipboardCheck",
                    "titre": "Bilan et clôture",
                    "description": "La clôture n'est pas une formalité : nous sécurisons la réception, les réserves, le règlement définitif des comptes et les garanties à l'ouvrage.",
                    "points": [
                        "AOR — Assistance lors des opérations de réception",
                        "Décompte Général et Définitif (DGD)",
                        "Analyse des écarts prévisionnel / réel",
                        "Bilan d'opération et traçabilité post-réception",
                    ],
                },
            ],
        },
        "referentiels": {
            "badge": "Nos fondements techniques",
            "titre": "Référentiels appliqués",
            "description": "Nos études s'appuient sur les guides et normes de référence du secteur.",
            "liste": [
                {
                    "titre": "SETRA / LCPC",
                    "description": "Guide Technique 1994 pour le dimensionnement des chaussées neuves et de renforcement.",
                },
                {
                    "titre": "Eurocodes (EC6, EC7)",
                    "description": "Maçonnerie, fondations et géotechnique selon les normes européennes.",
                },
                {
                    "titre": "DTU applicables",
                    "description": "Règles de l'art pour les ouvrages bâtiment, dallages et soubassements.",
                },
                {
                    "titre": "CCAG Travaux 2021",
                    "description": "Clauses contractuelles pour les marchés de travaux publics.",
                },
                {
                    "titre": "NF P03-001 / NF P03-002",
                    "description": "Cadres usuels des marchés privés bâtiment et génie civil, à contractualiser et adapter selon le marché.",
                },
                {
                    "titre": "BT / TP (indices)",
                    "description": "Indices officiels pour la révision et l'actualisation des prix de marché.",
                },
                {
                    "titre": "PAQ / qualité chantier",
                    "description": "Organisation, contrôle et enregistrement de la qualité d'exécution sur chantier.",
                },
            ],
        },
        "cta": {
            "titre": "Prêt à travailler avec nous ?",
            "description": "Décrivez-nous votre projet et nous vous proposerons une intervention adaptée.",
            "bouton_principal": "Nous contacter",
            "bouton_secondaire": "Voir nos prestations",
        },
    },
    "prestations": {
        "metadata": {
            "titre_page": "Nos prestations",
            "description_page": "Découvrez les prestations du bureau : économie de la construction, dimensionnement voirie, bâtiment, métrés, assistance maîtrise d'œuvre et appels d'offres.",
        },
        "hero": {
            "badge": "Nos domaines d'intervention",
            "titre": "Nos prestations",
            "description": "De l'estimation préalable à la réception des travaux, nous intervenons sur l'économie, les métrés, les pièces écrites, la voirie, le bâtiment et les consultations.",
        },
        "cta_bas_page": {
            "titre": "Votre projet nécessite une expertise combinée ?",
            "description": "Nous pouvons intervenir sur plusieurs volets d'une même opération pour conserver une cohérence technique, économique et documentaire.",
            "bouton": "Nous en parler",
        },
        "categories": {
            "economie": "Économie de la construction",
            "vrd": "Voirie et réseaux divers",
            "batiment": "Bâtiment",
            "assistance": "Assistance maîtrise d'œuvre",
            "documents": "Documents de marché",
            "autre": "Autres prestations",
        },
        "detail": {
            "retour": "Toutes nos prestations",
            "bouton_contact": "Demander un devis",
            "bloc_points_forts": "Ce que nous réalisons",
            "bloc_description": "En détail",
            "bloc_avantages": "Ce que vous gagnez",
            "bloc_livrables": "Livrables",
            "bloc_autres_titre": "Nos autres prestations",
            "bloc_autres_bouton": "Voir toutes les prestations",
            "cta_titre": "Besoin d'une intervention pour votre projet ?",
            "cta_description": "Nous structurons notre intervention selon votre niveau d'avancement, vos objectifs techniques et vos contraintes contractuelles.",
            "cta_bouton": "Nous contacter",
        },
    },
    "references": {
        "metadata": {
            "titre_page": "Références et réalisations",
            "description_page": "Découvrez des opérations menées en économie de la construction, VRD, bâtiment, assistance à maîtrise d'œuvre et appels d'offres.",
        },
        "hero": {
            "badge": "Notre expérience terrain",
            "titre": "Références et réalisations",
            "description": "Des opérations variées, menées avec rigueur, pour des acteurs publics et privés de la construction.",
        },
        "etat_vide": {
            "sur_titre": "Nos domaines d'intervention",
            "titre": "Types de missions réalisées",
            "description": "Nous intervenons sur des opérations de toute nature et toute taille, en milieu public comme privé.",
        },
        "liste": {
            "titre": "Nos réalisations",
        },
        "secteurs": {
            "titre": "Secteurs d'intervention",
            "liste": [
                "Logements collectifs",
                "Bâtiments publics",
                "Voirie communale",
                "Zones d'activités",
                "Réhabilitation",
                "Lotissements",
            ],
        },
        "cta": {
            "titre": "Votre projet peut devenir notre prochaine référence",
            "description": "Contactez-nous pour échanger sur votre opération et le cadre de notre intervention.",
            "bouton": "Nous contacter",
        },
        "domaines_exemple": [
            {
                "titre": "VRD — Lotissement résidentiel",
                "lieu": "Région Sud-Est",
                "tags": ["Dimensionnement voirie", "Métrés VRD", "DCE"],
            },
            {
                "titre": "Réhabilitation centre-bourg",
                "lieu": "Commune rurale",
                "tags": ["Économie TCE", "DPGF", "Suivi chantier"],
            },
            {
                "titre": "Bâtiment tertiaire — Phase DCE",
                "lieu": "Zone d'activités",
                "tags": ["Pièces écrites", "BPU/DPGF", "CCTP"],
            },
            {
                "titre": "Appel d'offres — Travaux VRD",
                "lieu": "Collectivité locale",
                "tags": ["Mémoire technique", "Offre financière"],
            },
            {
                "titre": "Chiffrage — Extension école",
                "lieu": "Commune périurbaine",
                "tags": ["Estimation préalable", "AMO"],
            },
            {
                "titre": "Analyse rentabilité — Promotion",
                "lieu": "Centre-ville",
                "tags": ["Analyse de rentabilité", "Bilan d'opération"],
            },
        ],
    },
}


def contenus_pages_par_defaut():
    """Retourne une copie indépendante des contenus publics par défaut."""
    import copy

    return copy.deepcopy(CONTENUS_PAGES_PAR_DEFAUT)
