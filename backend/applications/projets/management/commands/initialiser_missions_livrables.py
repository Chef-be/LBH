"""
Commande de management pour initialiser les missions et livrables par défaut.
Plateforme LBH — Bureau d'Études Économiste

Usage :
    docker compose exec lbh-backend python manage.py initialiser_missions_livrables
"""

from django.core.management.base import BaseCommand
from applications.projets.models import MissionClient, LivrableType


# ── Définition des missions ────────────────────────────────────────────────────

MISSIONS = [
    # ─ Maîtrise d'ouvrage ─────────────────────────────────────────────────────
    {
        "code": "moa-faisabilite-budgetaire",
        "libelle": "Faisabilité budgétaire",
        "description": "Première estimation de l'enveloppe budgétaire à partir du programme.",
        "famille_client": "maitrise_ouvrage",
        "sous_types_client": [],
        "nature_ouvrage": "tous",
        "phases_concernees": ["faisabilite", "programmation"],
        "icone": "Calculator",
        "couleur": "blue",
        "est_obligatoire": True,
        "ordre": 10,
    },
    {
        "code": "moa-estimation-esq-aps",
        "libelle": "Estimation ESQ / APS",
        "description": "Estimation budgétaire en phase esquisse et avant-projet sommaire.",
        "famille_client": "maitrise_ouvrage",
        "sous_types_client": [],
        "nature_ouvrage": "tous",
        "phases_concernees": ["esq", "aps"],
        "icone": "TrendingUp",
        "couleur": "blue",
        "est_obligatoire": False,
        "ordre": 20,
    },
    {
        "code": "moa-estimation-apd-pro",
        "libelle": "Estimation APD / PRO",
        "description": "Estimation budgétaire détaillée en phase avant-projet définitif et projet.",
        "famille_client": "maitrise_ouvrage",
        "sous_types_client": [],
        "nature_ouvrage": "tous",
        "phases_concernees": ["apd", "pro"],
        "icone": "BarChart3",
        "couleur": "blue",
        "est_obligatoire": False,
        "ordre": 30,
    },
    {
        "code": "moa-analyse-offres",
        "libelle": "Analyse des offres reçues",
        "description": "Comparaison et analyse des offres des entreprises suite à appel d'offres.",
        "famille_client": "maitrise_ouvrage",
        "sous_types_client": [],
        "nature_ouvrage": "tous",
        "phases_concernees": ["ao"],
        "icone": "FileSearch",
        "couleur": "blue",
        "est_obligatoire": False,
        "ordre": 40,
    },
    {
        "code": "moa-suivi-economique",
        "libelle": "Suivi économique chantier",
        "description": "Suivi des dépenses, avenants et décomptes en phase travaux.",
        "famille_client": "maitrise_ouvrage",
        "sous_types_client": [],
        "nature_ouvrage": "tous",
        "phases_concernees": ["exe", "det"],
        "icone": "Activity",
        "couleur": "blue",
        "est_obligatoire": False,
        "ordre": 50,
    },
    {
        "code": "moa-dgd-cloture",
        "libelle": "DGD et clôture financière",
        "description": "Établissement du décompte général définitif et clôture financière.",
        "famille_client": "maitrise_ouvrage",
        "sous_types_client": [],
        "nature_ouvrage": "tous",
        "phases_concernees": ["reception", "aor"],
        "icone": "CheckSquare",
        "couleur": "blue",
        "est_obligatoire": False,
        "ordre": 60,
    },
    {
        "code": "moa-contre-estimation",
        "libelle": "Contre-estimation / vérification",
        "description": "Vérification de l'enveloppe budgétaire proposée par la maîtrise d'œuvre.",
        "famille_client": "maitrise_ouvrage",
        "sous_types_client": ["collectivite", "promoteur_prive", "bailleur_social"],
        "nature_ouvrage": "tous",
        "phases_concernees": [],
        "icone": "ShieldCheck",
        "couleur": "indigo",
        "est_obligatoire": False,
        "ordre": 70,
    },
    # ─ Maîtrise d'œuvre ───────────────────────────────────────────────────────
    {
        "code": "moe-estimation-phases-conception",
        "libelle": "Estimations phases de conception",
        "description": "Estimations successives tout au long des phases ESQ → PRO pour maintenir le budget.",
        "famille_client": "maitrise_oeuvre",
        "sous_types_client": [],
        "nature_ouvrage": "batiment",
        "phases_concernees": ["esq", "aps", "apd", "pro"],
        "icone": "Layers",
        "couleur": "violet",
        "est_obligatoire": True,
        "ordre": 10,
    },
    {
        "code": "moe-redaction-cctp",
        "libelle": "Rédaction CCTP",
        "description": "Rédaction du Cahier des Clauses Techniques Particulières par lot.",
        "famille_client": "maitrise_oeuvre",
        "sous_types_client": [],
        "nature_ouvrage": "batiment",
        "phases_concernees": ["pro", "dce"],
        "icone": "FileText",
        "couleur": "violet",
        "est_obligatoire": True,
        "ordre": 20,
    },
    {
        "code": "moe-redaction-dpgf",
        "libelle": "Rédaction DPGF",
        "description": "Établissement de la Décomposition du Prix Global et Forfaitaire.",
        "famille_client": "maitrise_oeuvre",
        "sous_types_client": [],
        "nature_ouvrage": "batiment",
        "phases_concernees": ["pro", "dce"],
        "icone": "Table",
        "couleur": "violet",
        "est_obligatoire": True,
        "ordre": 30,
    },
    {
        "code": "moe-redaction-bpu-dqe",
        "libelle": "Rédaction BPU / DQE",
        "description": "Établissement du Bordereau des Prix Unitaires et Détail Quantitatif Estimatif.",
        "famille_client": "maitrise_oeuvre",
        "sous_types_client": [],
        "nature_ouvrage": "tous",
        "phases_concernees": ["pro", "dce"],
        "icone": "ListOrdered",
        "couleur": "violet",
        "est_obligatoire": False,
        "ordre": 35,
    },
    {
        "code": "moe-analyse-offres-dce",
        "libelle": "Analyse des offres (ACT)",
        "description": "Rapport comparatif d'analyse des offres entreprises avec recommandation.",
        "famille_client": "maitrise_oeuvre",
        "sous_types_client": [],
        "nature_ouvrage": "tous",
        "phases_concernees": ["ao", "act"],
        "icone": "BarChart2",
        "couleur": "violet",
        "est_obligatoire": False,
        "ordre": 40,
    },
    {
        "code": "moe-visa-exe",
        "libelle": "VISA des études d'exécution",
        "description": "Vérification de la conformité des études d'exécution.",
        "famille_client": "maitrise_oeuvre",
        "sous_types_client": [],
        "nature_ouvrage": "tous",
        "phases_concernees": ["exe", "visa"],
        "icone": "Stamp",
        "couleur": "violet",
        "est_obligatoire": False,
        "ordre": 50,
    },
    {
        "code": "moe-suivi-economique-chantier",
        "libelle": "Suivi économique de chantier (DET)",
        "description": "Contrôle des situations de travaux, ordres de service et avenants.",
        "famille_client": "maitrise_oeuvre",
        "sous_types_client": [],
        "nature_ouvrage": "tous",
        "phases_concernees": ["exe", "det"],
        "icone": "Wallet",
        "couleur": "violet",
        "est_obligatoire": False,
        "ordre": 60,
    },
    {
        "code": "moe-planning-previsionnel",
        "libelle": "Planning prévisionnel des travaux",
        "description": "Établissement du planning détaillé des travaux.",
        "famille_client": "maitrise_oeuvre",
        "sous_types_client": [],
        "nature_ouvrage": "tous",
        "phases_concernees": ["pro", "dce", "exe"],
        "icone": "CalendarRange",
        "couleur": "violet",
        "est_obligatoire": False,
        "ordre": 70,
    },
    {
        "code": "moe-opc",
        "libelle": "OPC — Ordonnancement Pilotage Coordination",
        "description": "Mission d'ordonnancement, pilotage et coordination du chantier.",
        "famille_client": "maitrise_oeuvre",
        "sous_types_client": ["opc"],
        "nature_ouvrage": "tous",
        "phases_concernees": ["exe", "opc", "det"],
        "icone": "Network",
        "couleur": "purple",
        "est_obligatoire": False,
        "ordre": 80,
    },
    {
        "code": "moe-dgd-aor",
        "libelle": "DGD et assistance à la réception (AOR)",
        "description": "Décompte général définitif et assistance aux opérations de réception.",
        "famille_client": "maitrise_oeuvre",
        "sous_types_client": [],
        "nature_ouvrage": "tous",
        "phases_concernees": ["reception", "aor"],
        "icone": "ClipboardCheck",
        "couleur": "violet",
        "est_obligatoire": False,
        "ordre": 90,
    },
    # ─ Infrastructure / VRD ──────────────────────────────────────────────────
    {
        "code": "moe-estimation-infra",
        "libelle": "Estimation infrastructure / VRD",
        "description": "Estimation budgétaire pour les travaux d'infrastructure et VRD.",
        "famille_client": "maitrise_oeuvre",
        "sous_types_client": [],
        "nature_ouvrage": "infrastructure",
        "phases_concernees": ["esq", "aps", "apd", "pro"],
        "icone": "Road",
        "couleur": "teal",
        "est_obligatoire": False,
        "ordre": 15,
    },
    {
        "code": "moe-pieces-marche-infra",
        "libelle": "Pièces de marché VRD",
        "description": "CCTP, BPU, DQE pour les marchés d'infrastructure et VRD.",
        "famille_client": "maitrise_oeuvre",
        "sous_types_client": [],
        "nature_ouvrage": "infrastructure",
        "phases_concernees": ["pro", "dce"],
        "icone": "FileStack",
        "couleur": "teal",
        "est_obligatoire": False,
        "ordre": 25,
    },
    # ─ Entreprise ─────────────────────────────────────────────────────────────
    {
        "code": "ent-reponse-appel-offres",
        "libelle": "Réponse à appel d'offres",
        "description": "Chiffrage et constitution du dossier de réponse à un appel d'offres.",
        "famille_client": "entreprise",
        "sous_types_client": [],
        "nature_ouvrage": "tous",
        "phases_concernees": [],
        "icone": "Send",
        "couleur": "amber",
        "est_obligatoire": True,
        "ordre": 10,
    },
    {
        "code": "ent-chiffrage-devis",
        "libelle": "Chiffrage / Devis",
        "description": "Établissement d'un devis ou offre de prix pour un client direct.",
        "famille_client": "entreprise",
        "sous_types_client": [],
        "nature_ouvrage": "tous",
        "phases_concernees": [],
        "icone": "Receipt",
        "couleur": "amber",
        "est_obligatoire": False,
        "ordre": 20,
    },
    {
        "code": "ent-debourses-secs",
        "libelle": "Calcul des déboursés secs",
        "description": "Décomposition analytique des coûts MO, matériaux et matériels.",
        "famille_client": "entreprise",
        "sous_types_client": [],
        "nature_ouvrage": "tous",
        "phases_concernees": [],
        "icone": "Sigma",
        "couleur": "amber",
        "est_obligatoire": False,
        "ordre": 30,
    },
    {
        "code": "ent-memoire-technique",
        "libelle": "Mémoire technique",
        "description": "Rédaction du mémoire technique de l'offre.",
        "famille_client": "entreprise",
        "sous_types_client": [],
        "nature_ouvrage": "tous",
        "phases_concernees": [],
        "icone": "BookOpen",
        "couleur": "amber",
        "est_obligatoire": False,
        "ordre": 40,
    },
    {
        "code": "ent-planning-execution",
        "libelle": "Planning d'exécution",
        "description": "Planning détaillé de réalisation des travaux.",
        "famille_client": "entreprise",
        "sous_types_client": [],
        "nature_ouvrage": "tous",
        "phases_concernees": [],
        "icone": "Calendar",
        "couleur": "amber",
        "est_obligatoire": False,
        "ordre": 50,
    },
    {
        "code": "ent-suivi-rentabilite",
        "libelle": "Suivi de rentabilité chantier",
        "description": "Suivi et analyse de la rentabilité en cours et en fin de chantier.",
        "famille_client": "entreprise",
        "sous_types_client": [],
        "nature_ouvrage": "tous",
        "phases_concernees": [],
        "icone": "PieChart",
        "couleur": "amber",
        "est_obligatoire": False,
        "ordre": 60,
    },
    # ─ Autre / AMO ────────────────────────────────────────────────────────────
    {
        "code": "autre-amo-conseil",
        "libelle": "AMO / Assistance conseil",
        "description": "Assistance à maîtrise d'ouvrage et conseil ponctuel.",
        "famille_client": "autre",
        "sous_types_client": ["amo", "partenaire"],
        "nature_ouvrage": "tous",
        "phases_concernees": [],
        "icone": "Lightbulb",
        "couleur": "slate",
        "est_obligatoire": False,
        "ordre": 10,
    },
    {
        "code": "autre-audit-expertise",
        "libelle": "Audit / Expertise",
        "description": "Mission d'audit technique ou expertise ponctuelle.",
        "famille_client": "autre",
        "sous_types_client": [],
        "nature_ouvrage": "tous",
        "phases_concernees": [],
        "icone": "Search",
        "couleur": "slate",
        "est_obligatoire": False,
        "ordre": 20,
    },
]


# ── Définition des livrables ───────────────────────────────────────────────────

LIVRABLES = [
    {
        "code": "livrable-note-estimation",
        "libelle": "Note d'estimation budgétaire",
        "type_document": "estimation",
        "format_attendu": "pdf",
        "icone": "FileText",
        "couleur": "blue",
        "ordre": 10,
        "missions": [
            "moa-faisabilite-budgetaire", "moa-estimation-esq-aps", "moa-estimation-apd-pro",
            "moe-estimation-phases-conception", "moe-estimation-infra",
        ],
    },
    {
        "code": "livrable-cctp",
        "libelle": "CCTP — Cahier des Clauses Techniques Particulières",
        "type_document": "cctp",
        "format_attendu": "docx",
        "icone": "FileText",
        "couleur": "violet",
        "ordre": 20,
        "missions": ["moe-redaction-cctp", "moe-pieces-marche-infra"],
    },
    {
        "code": "livrable-dpgf",
        "libelle": "DPGF — Décomposition du Prix Global et Forfaitaire",
        "type_document": "dpgf",
        "format_attendu": "xlsx",
        "icone": "Table",
        "couleur": "green",
        "ordre": 30,
        "missions": ["moe-redaction-dpgf", "ent-reponse-appel-offres"],
    },
    {
        "code": "livrable-bpu",
        "libelle": "BPU — Bordereau des Prix Unitaires",
        "type_document": "bpu",
        "format_attendu": "xlsx",
        "icone": "ListOrdered",
        "couleur": "teal",
        "ordre": 35,
        "missions": ["moe-redaction-bpu-dqe", "moe-pieces-marche-infra"],
    },
    {
        "code": "livrable-dqe",
        "libelle": "DQE — Détail Quantitatif Estimatif",
        "type_document": "dqe",
        "format_attendu": "xlsx",
        "icone": "Hash",
        "couleur": "teal",
        "ordre": 40,
        "missions": ["moe-redaction-bpu-dqe", "moe-pieces-marche-infra"],
    },
    {
        "code": "livrable-rapport-analyse-offres",
        "libelle": "Rapport d'analyse des offres",
        "type_document": "rapport",
        "format_attendu": "pdf",
        "icone": "BarChart2",
        "couleur": "orange",
        "ordre": 50,
        "missions": ["moa-analyse-offres", "moe-analyse-offres-dce"],
    },
    {
        "code": "livrable-planning",
        "libelle": "Planning prévisionnel des travaux",
        "type_document": "planning",
        "format_attendu": "xlsx",
        "icone": "CalendarRange",
        "couleur": "indigo",
        "ordre": 60,
        "missions": [
            "moe-planning-previsionnel", "ent-planning-execution", "moe-opc",
        ],
    },
    {
        "code": "livrable-situation-travaux",
        "libelle": "Situation de travaux",
        "type_document": "situation",
        "format_attendu": "pdf",
        "icone": "Wallet",
        "couleur": "blue",
        "ordre": 70,
        "missions": ["moe-suivi-economique-chantier", "moa-suivi-economique"],
    },
    {
        "code": "livrable-dgd",
        "libelle": "DGD — Décompte Général Définitif",
        "type_document": "dgd",
        "format_attendu": "pdf",
        "icone": "ClipboardCheck",
        "couleur": "red",
        "ordre": 80,
        "missions": ["moa-dgd-cloture", "moe-dgd-aor"],
    },
    {
        "code": "livrable-avenant",
        "libelle": "Avenant au marché",
        "type_document": "avenant",
        "format_attendu": "pdf",
        "icone": "FileDiff",
        "couleur": "orange",
        "ordre": 90,
        "missions": ["moe-suivi-economique-chantier", "moa-suivi-economique"],
    },
    {
        "code": "livrable-note-calcul",
        "libelle": "Note de calcul",
        "type_document": "note_calcul",
        "format_attendu": "pdf",
        "icone": "Calculator",
        "couleur": "amber",
        "ordre": 100,
        "missions": ["ent-debourses-secs", "moa-faisabilite-budgetaire"],
    },
    {
        "code": "livrable-memoire-technique",
        "libelle": "Mémoire technique",
        "type_document": "memoire_technique",
        "format_attendu": "pdf",
        "icone": "BookOpen",
        "couleur": "amber",
        "ordre": 110,
        "missions": ["ent-memoire-technique", "ent-reponse-appel-offres"],
    },
    {
        "code": "livrable-devis",
        "libelle": "Devis / Offre de prix",
        "type_document": "devis",
        "format_attendu": "pdf",
        "icone": "Receipt",
        "couleur": "amber",
        "ordre": 120,
        "missions": ["ent-chiffrage-devis"],
    },
    {
        "code": "livrable-pv-reception",
        "libelle": "PV de réception des travaux",
        "type_document": "pv_reception",
        "format_attendu": "pdf",
        "icone": "BadgeCheck",
        "couleur": "green",
        "ordre": 130,
        "missions": ["moe-dgd-aor", "moa-dgd-cloture"],
    },
]


class Command(BaseCommand):
    help = "Initialise les missions et livrables types par défaut pour la plateforme LBH."

    def add_arguments(self, parser):
        parser.add_argument(
            "--reinitialiser",
            action="store_true",
            help="Supprime et recrée toutes les missions et livrables (attention : données perdues).",
        )

    def handle(self, *args, **options):
        reinit = options["reinitialiser"]

        if reinit:
            self.stdout.write("⚠ Suppression des missions et livrables existants…")
            LivrableType.objects.all().delete()
            MissionClient.objects.all().delete()
            self.stdout.write(self.style.WARNING("Données supprimées."))

        # ── Créer ou mettre à jour les missions ──
        missions_creees = 0
        missions_mises_a_jour = 0
        missions_par_code = {}

        for m in MISSIONS:
            obj, cree = MissionClient.objects.update_or_create(
                code=m["code"],
                defaults={
                    "libelle": m["libelle"],
                    "description": m["description"],
                    "famille_client": m["famille_client"],
                    "sous_types_client": m["sous_types_client"],
                    "nature_ouvrage": m["nature_ouvrage"],
                    "phases_concernees": m["phases_concernees"],
                    "icone": m["icone"],
                    "couleur": m["couleur"],
                    "est_obligatoire": m["est_obligatoire"],
                    "est_active": True,
                    "ordre": m["ordre"],
                },
            )
            missions_par_code[m["code"]] = obj
            if cree:
                missions_creees += 1
            else:
                missions_mises_a_jour += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"✓ Missions : {missions_creees} créées, {missions_mises_a_jour} mises à jour"
            )
        )

        # ── Créer ou mettre à jour les livrables ──
        livrables_crees = 0
        livrables_mises_a_jour = 0

        for lv in LIVRABLES:
            codes_missions = lv.pop("missions", [])
            obj, cree = LivrableType.objects.update_or_create(
                code=lv["code"],
                defaults={
                    "libelle": lv["libelle"],
                    "type_document": lv["type_document"],
                    "format_attendu": lv["format_attendu"],
                    "icone": lv["icone"],
                    "couleur": lv["couleur"],
                    "est_active": True,
                    "ordre": lv["ordre"],
                },
            )

            # Associer les missions
            missions_associees = [
                missions_par_code[code]
                for code in codes_missions
                if code in missions_par_code
            ]
            obj.missions.set(missions_associees)

            if cree:
                livrables_crees += 1
            else:
                livrables_mises_a_jour += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"✓ Livrables : {livrables_crees} créés, {livrables_mises_a_jour} mis à jour"
            )
        )

        self.stdout.write(self.style.SUCCESS("✅ Initialisation terminée."))
