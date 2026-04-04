"""
Commande d'import des données ARTIPRIX 2025 dans la bibliothèque de prix.

Usage :
    python manage.py import_artiprix
    python manage.py import_artiprix --millésime 2025 --famille "Démolition-Dépose"
    python manage.py import_artiprix --effacer-existants

Les prix sont issus des bordereaux ARTIPRIX Go/So 2025 et AExt 2025.
Taux de référence : Zone A = 41 €/h (province), Zone B = 56 €/h (IDF).
"""

from decimal import Decimal
from django.core.management.base import BaseCommand
from django.db import transaction

from applications.bibliotheque.models import LignePrixBibliotheque, SousDetailPrix


# ─── Données de référence ARTIPRIX 2025 ───────────────────────────────────────
# Structure : code | désignation | unité | temps_pose_h | fp_zone_a | fp_zone_b |
#             fourniture_seule | pose_zone_a | pose_zone_b | famille | sous_famille

ARTIPRIX_GO_SO_2025 = [

    # ── Chapitre 1 : Démolition volumique ──────────────────────────────────────
    {
        "code": "GO-DEM-001", "famille": "Démolition-Dépose",
        "sous_famille": "Démolition volumique",
        "designation": "Démolition de maçonneries à l'engin mécanique",
        "unite": "M3",
        "debourse_sec_zone_a": Decimal("6.97"),
        "debourse_sec_zone_b": Decimal("9.52"),
        "lot": "7.3",
    },
    {
        "code": "GO-DEM-002", "famille": "Démolition-Dépose",
        "sous_famille": "Démolition volumique",
        "designation": "Démolition de béton armé au marteau piqueur",
        "unite": "M3",
        "debourse_sec_zone_a": Decimal("364.90"),
        "debourse_sec_zone_b": Decimal("498.40"),
        "lot": "7.3",
    },
    {
        "code": "GO-DEM-003", "famille": "Démolition-Dépose",
        "sous_famille": "Démolition volumique",
        "designation": "Démolition de béton non armé au marteau piqueur",
        "unite": "M3",
        "debourse_sec_zone_a": Decimal("231.65"),
        "debourse_sec_zone_b": Decimal("316.40"),
        "lot": "7.3",
    },
    {
        "code": "GO-DEM-004", "famille": "Démolition-Dépose",
        "sous_famille": "Démolition volumique",
        "designation": "Démolition de matériaux creux et plâtras",
        "unite": "M3",
        "debourse_sec_zone_a": Decimal("61.50"),
        "debourse_sec_zone_b": Decimal("84.00"),
        "lot": "7.3",
    },
    {
        "code": "GO-DEM-005", "famille": "Démolition-Dépose",
        "sous_famille": "Démolition volumique",
        "designation": "Démolition de béton armé à l'engin mécanique",
        "unite": "M3",
        "debourse_sec_zone_a": Decimal("94.30"),
        "debourse_sec_zone_b": Decimal("128.80"),
        "lot": "7.3",
    },
    {
        "code": "GO-DEM-006", "famille": "Démolition-Dépose",
        "sous_famille": "Démolition surfacique",
        "designation": "Démolition d'un mur en agglomérés 20 cm (manuel, sans évacuation)",
        "unite": "M2",
        "debourse_sec_zone_a": Decimal("18.45"),
        "debourse_sec_zone_b": Decimal("25.20"),
        "lot": "7.3",
    },
    {
        "code": "GO-DEM-007", "famille": "Démolition-Dépose",
        "sous_famille": "Démolition surfacique",
        "designation": "Démolition d'un mur en briques 20 cm (manuel, sans évacuation)",
        "unite": "M2",
        "debourse_sec_zone_a": Decimal("16.40"),
        "debourse_sec_zone_b": Decimal("22.40"),
        "lot": "7.3",
    },
    {
        "code": "GO-DEM-008", "famille": "Démolition-Dépose",
        "sous_famille": "Démolition surfacique",
        "designation": "Démolition d'un plancher poutrelles-hourdis (mécanique)",
        "unite": "M2",
        "debourse_sec_zone_a": Decimal("8.20"),
        "debourse_sec_zone_b": Decimal("11.20"),
        "lot": "7.3",
    },
    {
        "code": "GO-DEM-009", "famille": "Démolition-Dépose",
        "sous_famille": "Démolition surfacique",
        "designation": "Démolition d'une dalle pleine 15 cm (mécanique)",
        "unite": "M2",
        "debourse_sec_zone_a": Decimal("10.25"),
        "debourse_sec_zone_b": Decimal("14.00"),
        "lot": "7.3",
    },
    {
        "code": "GO-DEM-010", "famille": "Démolition-Dépose",
        "sous_famille": "Démolition unitaire",
        "designation": "Démolition d'un escalier BA avec garde-corps",
        "unite": "U",
        "debourse_sec_zone_a": Decimal("246.00"),
        "debourse_sec_zone_b": Decimal("336.00"),
        "lot": "7.3",
    },

    # ── Chapitre 1 : Dépose second-œuvre ───────────────────────────────────────
    {
        "code": "SO-DEP-001", "famille": "Démolition-Dépose",
        "sous_famille": "Dépose carrelages",
        "designation": "Dépose de carrelage collé",
        "unite": "M2",
        "debourse_sec_zone_a": Decimal("24.60"),
        "debourse_sec_zone_b": Decimal("33.60"),
        "lot": "7.13",
    },
    {
        "code": "SO-DEP-002", "famille": "Démolition-Dépose",
        "sous_famille": "Dépose carrelages",
        "designation": "Dépose de carrelage scellé",
        "unite": "M2",
        "debourse_sec_zone_a": Decimal("26.65"),
        "debourse_sec_zone_b": Decimal("36.40"),
        "lot": "7.13",
    },
    {
        "code": "SO-DEP-003", "famille": "Démolition-Dépose",
        "sous_famille": "Dépose carrelages",
        "designation": "Dépose de faïence collée",
        "unite": "M2",
        "debourse_sec_zone_a": Decimal("12.30"),
        "debourse_sec_zone_b": Decimal("16.80"),
        "lot": "7.13",
    },
    {
        "code": "SO-DEP-004", "famille": "Démolition-Dépose",
        "sous_famille": "Dépose planchers",
        "designation": "Dépose de parquet collé",
        "unite": "M2",
        "debourse_sec_zone_a": Decimal("10.25"),
        "debourse_sec_zone_b": Decimal("14.00"),
        "lot": "7.13",
    },
    {
        "code": "SO-DEP-005", "famille": "Démolition-Dépose",
        "sous_famille": "Dépose planchers",
        "designation": "Dépose de parquet sur lambourdes",
        "unite": "M2",
        "debourse_sec_zone_a": Decimal("18.45"),
        "debourse_sec_zone_b": Decimal("25.20"),
        "lot": "7.13",
    },
    {
        "code": "SO-DEP-006", "famille": "Démolition-Dépose",
        "sous_famille": "Dépose planchers",
        "designation": "Dépose de revêtement stratifié clipsé",
        "unite": "M2",
        "debourse_sec_zone_a": Decimal("4.10"),
        "debourse_sec_zone_b": Decimal("5.60"),
        "lot": "7.13",
    },
    {
        "code": "SO-DEP-007", "famille": "Démolition-Dépose",
        "sous_famille": "Dépose sanitaires",
        "designation": "Dépose de WC suspendu",
        "unite": "U",
        "debourse_sec_zone_a": Decimal("71.75"),
        "debourse_sec_zone_b": Decimal("98.00"),
        "lot": "7.15",
    },
    {
        "code": "SO-DEP-008", "famille": "Démolition-Dépose",
        "sous_famille": "Dépose sanitaires",
        "designation": "Dépose de WC au sol",
        "unite": "U",
        "debourse_sec_zone_a": Decimal("32.80"),
        "debourse_sec_zone_b": Decimal("44.80"),
        "lot": "7.15",
    },
    {
        "code": "SO-DEP-009", "famille": "Démolition-Dépose",
        "sous_famille": "Dépose sanitaires",
        "designation": "Dépose de lavabo sur console",
        "unite": "U",
        "debourse_sec_zone_a": Decimal("24.60"),
        "debourse_sec_zone_b": Decimal("33.60"),
        "lot": "7.15",
    },
    {
        "code": "SO-DEP-010", "famille": "Démolition-Dépose",
        "sous_famille": "Dépose sanitaires",
        "designation": "Dépose de baignoire en fonte",
        "unite": "U",
        "debourse_sec_zone_a": Decimal("61.50"),
        "debourse_sec_zone_b": Decimal("84.00"),
        "lot": "7.15",
    },
    {
        "code": "SO-DEP-011", "famille": "Démolition-Dépose",
        "sous_famille": "Dépose sanitaires",
        "designation": "Dépose de receveur de douche",
        "unite": "U",
        "debourse_sec_zone_a": Decimal("47.15"),
        "debourse_sec_zone_b": Decimal("64.40"),
        "lot": "7.15",
    },
    {
        "code": "SO-DEP-012", "famille": "Démolition-Dépose",
        "sous_famille": "Dépose chauffage",
        "designation": "Dépose de chaudière murale",
        "unite": "U",
        "debourse_sec_zone_a": Decimal("32.80"),
        "debourse_sec_zone_b": Decimal("44.80"),
        "lot": "7.16",
    },
    {
        "code": "SO-DEP-013", "famille": "Démolition-Dépose",
        "sous_famille": "Dépose menuiseries",
        "designation": "Dépose de fenêtre 2 vantaux",
        "unite": "U",
        "debourse_sec_zone_a": Decimal("17.63"),
        "debourse_sec_zone_b": Decimal("24.08"),
        "lot": "7.10",
    },
    {
        "code": "SO-DEP-014", "famille": "Démolition-Dépose",
        "sous_famille": "Dépose menuiseries",
        "designation": "Dépose de porte-fenêtre 2 vantaux",
        "unite": "U",
        "debourse_sec_zone_a": Decimal("19.27"),
        "debourse_sec_zone_b": Decimal("26.32"),
        "lot": "7.10",
    },
]


ARTIPRIX_AEXT_2025 = [

    # ── Chapitre 2 : Terrassements ─────────────────────────────────────────────
    {
        "code": "AE-TER-001", "famille": "Terrassements",
        "sous_famille": "Décapage",
        "designation": "Décapage mécanique de terres végétales — épaisseur 10 cm",
        "unite": "M2",
        "debourse_sec_zone_a": Decimal("0.82"),
        "debourse_sec_zone_b": Decimal("1.12"),
        "lot": "7.2",
    },
    {
        "code": "AE-TER-002", "famille": "Terrassements",
        "sous_famille": "Décapage",
        "designation": "Décapage mécanique de terres végétales — épaisseur 20 cm",
        "unite": "M2",
        "debourse_sec_zone_a": Decimal("1.23"),
        "debourse_sec_zone_b": Decimal("1.68"),
        "lot": "7.2",
    },
    {
        "code": "AE-TER-003", "famille": "Terrassements",
        "sous_famille": "Fouilles en pleine masse",
        "designation": "Fouilles en pleine masse — sol classe A — volume < 500 m³",
        "unite": "M3",
        "debourse_sec_zone_a": Decimal("1.23"),
        "debourse_sec_zone_b": Decimal("1.68"),
        "lot": "7.2",
        "hypotheses": "Classe A : terrain ordinaire, terre végétale, sable. Coefficient de foisonnement 20 %.",
    },
    {
        "code": "AE-TER-004", "famille": "Terrassements",
        "sous_famille": "Fouilles en pleine masse",
        "designation": "Fouilles en pleine masse — sol classe B — volume < 500 m³",
        "unite": "M3",
        "debourse_sec_zone_a": Decimal("2.26"),
        "debourse_sec_zone_b": Decimal("3.08"),
        "lot": "7.2",
        "hypotheses": "Classe B : terrain argileux ou caillouteux non compact. Coefficient de foisonnement 50 %.",
    },
    {
        "code": "AE-TER-005", "famille": "Terrassements",
        "sous_famille": "Fouilles en pleine masse",
        "designation": "Fouilles en pleine masse — sol classe C — volume < 500 m³",
        "unite": "M3",
        "debourse_sec_zone_a": Decimal("4.51"),
        "debourse_sec_zone_b": Decimal("6.16"),
        "lot": "7.2",
        "hypotheses": "Classe C : argiles compactes, sables agglomérés. Coefficient de foisonnement 25 %. Engin mécanique.",
    },
    {
        "code": "AE-TER-006", "famille": "Terrassements",
        "sous_famille": "Fouilles en pleine masse",
        "designation": "Fouilles en pleine masse — sol classe D — volume < 500 m³",
        "unite": "M3",
        "debourse_sec_zone_a": Decimal("7.79"),
        "debourse_sec_zone_b": Decimal("10.64"),
        "lot": "7.2",
        "hypotheses": "Classe D : roche attaquable au pic, calcaire tendre, craie. Coefficient de foisonnement 50 %. Engin mécanique.",
    },
    {
        "code": "AE-TER-007", "famille": "Travaux communs",
        "sous_famille": "Installations de chantier",
        "designation": "Location benne 10 m³ (transport non compris)",
        "unite": "J",
        "debourse_sec_zone_a": Decimal("274.82"),
        "debourse_sec_zone_b": Decimal("274.82"),
        "lot": "7.1",
        "hypotheses": "Prix identique zones A et B — coût de fourniture uniquement.",
    },
    {
        "code": "AE-TER-008", "famille": "Travaux communs",
        "sous_famille": "Installations de chantier",
        "designation": "Location WC chimique de chantier — mensuel",
        "unite": "M",
        "debourse_sec_zone_a": Decimal("385.69"),
        "debourse_sec_zone_b": Decimal("385.69"),
        "lot": "7.1",
    },
    {
        "code": "AE-TER-009", "famille": "Travaux communs",
        "sous_famille": "Installations de chantier",
        "designation": "Baraque de chantier mobile — installation et repli",
        "unite": "U",
        "debourse_sec_zone_a": Decimal("287.00"),
        "debourse_sec_zone_b": Decimal("392.00"),
        "lot": "7.1",
    },
    {
        "code": "AE-TER-010", "famille": "Travaux communs",
        "sous_famille": "Nettoyage",
        "designation": "Nettoyage de fin de chantier",
        "unite": "M2",
        "debourse_sec_zone_a": Decimal("1.23"),
        "debourse_sec_zone_b": Decimal("1.68"),
        "lot": "7.1",
    },
]


class Command(BaseCommand):
    """Import des données ARTIPRIX 2025 dans la bibliothèque de prix."""

    help = "Importe les prix de référence ARTIPRIX 2025 dans la bibliothèque de prix."

    def add_arguments(self, parser):
        parser.add_argument(
            "--zone",
            choices=["A", "B", "les-deux"],
            default="les-deux",
            help="Zone tarifaire à importer (A = province 41 €/h, B = IDF 56 €/h, les-deux = les deux zones).",
        )
        parser.add_argument(
            "--famille",
            type=str,
            default=None,
            help="Importer uniquement une famille (ex: 'Démolition-Dépose').",
        )
        parser.add_argument(
            "--effacer-existants",
            action="store_true",
            default=False,
            help="Efface les entrées ARTIPRIX existantes avant l'import.",
        )
        parser.add_argument(
            "--simulation",
            action="store_true",
            default=False,
            help="Simulation sans écriture en base (dry run).",
        )

    def handle(self, *args, **options):
        zone = options["zone"]
        famille_filtre = options.get("famille")
        effacer = options["effacer_existants"]
        simulation = options["simulation"]

        if simulation:
            self.stdout.write(self.style.WARNING("⚠ Mode simulation — aucune écriture en base."))

        toutes_les_entrees = ARTIPRIX_GO_SO_2025 + ARTIPRIX_AEXT_2025

        if famille_filtre:
            toutes_les_entrees = [e for e in toutes_les_entrees if e["famille"] == famille_filtre]
            self.stdout.write(f"Filtre famille : {famille_filtre} — {len(toutes_les_entrees)} entrée(s)")

        if not toutes_les_entrees:
            self.stdout.write(self.style.WARNING("Aucune entrée à importer."))
            return

        zones_a_importer = []
        if zone in ("A", "les-deux"):
            zones_a_importer.append("A")
        if zone in ("B", "les-deux"):
            zones_a_importer.append("B")

        nb_crees = 0
        nb_mis_a_jour = 0

        with transaction.atomic():
            if effacer and not simulation:
                nb_supprimes = LignePrixBibliotheque.objects.filter(
                    source__startswith="ARTIPRIX"
                ).count()
                LignePrixBibliotheque.objects.filter(source__startswith="ARTIPRIX").delete()
                self.stdout.write(f"Suppression de {nb_supprimes} entrée(s) ARTIPRIX existantes.")

            for donnees in toutes_les_entrees:
                for z in zones_a_importer:
                    code_complet = f"{donnees['code']}-Z{z}"
                    prix_fp = donnees["debourse_sec_zone_a"] if z == "A" else donnees["debourse_sec_zone_b"]

                    valeurs = {
                        "niveau": "reference",
                        "famille": donnees["famille"],
                        "sous_famille": donnees.get("sous_famille", ""),
                        "lot": donnees.get("lot", ""),
                        "designation_courte": donnees["designation"][:300],
                        "designation_longue": donnees["designation"],
                        "unite": donnees["unite"],
                        "hypotheses": donnees.get("hypotheses", ""),
                        "cout_horaire_mo": Decimal("41.0000") if z == "A" else Decimal("56.0000"),
                        "debourse_sec_unitaire": prix_fp,
                        "source": f"ARTIPRIX Go/So ou AExt 2025 — Zone {z}",
                        "fiabilite": 4,
                        "statut_validation": "valide",
                        "territoire": "IDF" if z == "B" else "Province",
                        "coefficient_territoire": Decimal("1.000"),
                    }

                    if not simulation:
                        entree, cree = LignePrixBibliotheque.objects.update_or_create(
                            code=code_complet,
                            defaults=valeurs,
                        )
                        if cree:
                            nb_crees += 1
                        else:
                            nb_mis_a_jour += 1
                    else:
                        self.stdout.write(f"  [SIM] {code_complet} — {donnees['designation'][:50]} — {prix_fp} €/{donnees['unite']}")

            if simulation:
                transaction.set_rollback(True)

        if not simulation:
            self.stdout.write(
                self.style.SUCCESS(
                    f"Import ARTIPRIX 2025 terminé : {nb_crees} créée(s), {nb_mis_a_jour} mise(s) à jour."
                )
            )
        else:
            self.stdout.write(
                self.style.SUCCESS(
                    f"Simulation terminée : {len(toutes_les_entrees) * len(zones_a_importer)} entrée(s) concernée(s)."
                )
            )
