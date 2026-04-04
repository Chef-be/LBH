"""
Commande de gestion : initialiser_donnees_base
Charge les données de référence initiales de la plateforme :
  - Profils de droits
  - Paramètres métier par défaut
  - Fonctionnalités activables
  - Types de documents
  - Modèles de pièces écrites
Usage : python manage.py initialiser_donnees_base
"""

from django.core.management.base import BaseCommand
from django.db import transaction


# ---------------------------------------------------------------------------
# Données de référence — Paramètres métier
# ---------------------------------------------------------------------------

PARAMETRES_DEFAUT = [
    # --- Économie de la construction ---
    ("TAUX_FRAIS_CHANTIER", "0.08", "decimal", "economie",
     "Taux de frais de chantier (installation, repli, etc.)"),
    ("TAUX_FRAIS_GENERAUX", "0.12", "decimal", "economie",
     "Taux de frais généraux du bureau d'études"),
    ("TAUX_ALEA", "0.03", "decimal", "economie",
     "Taux d'aléas et imprévus"),
    ("TAUX_MARGE_CIBLE", "0.08", "decimal", "economie",
     "Taux de marge commerciale cible"),
    ("SEUIL_RENTABILITE_ALERTE", "0.03", "decimal", "economie",
     "Seuil de marge en dessous duquel une alerte est émise"),
    ("SEUIL_RENTABILITE_DANGER", "0.00", "decimal", "economie",
     "Seuil de marge en dessous duquel le projet est considéré en danger"),
    ("TAUX_PERTES_MATERIAUX", "0.05", "decimal", "economie",
     "Taux de pertes sur matériaux (chutes, casse)"),
    ("TVA_TAUX_NORMAL", "20.0", "decimal", "economie",
     "Taux de TVA normal (%)"),
    ("TVA_TAUX_REDUIT", "10.0", "decimal", "economie",
     "Taux de TVA réduit — travaux de rénovation (%)"),
    # --- Voirie ---
    ("VOIRIE_TAUX_CROISSANCE_TRAFIC", "0.02", "decimal", "voirie",
     "Taux de croissance annuel du trafic PL par défaut"),
    ("VOIRIE_DUREE_VIE_ANS", "20", "entier", "voirie",
     "Durée de vie cible des chaussées (années)"),
    ("VOIRIE_CAM_MOYEN", "0.8", "decimal", "voirie",
     "Coefficient d'agressivité moyen des poids lourds"),
    # --- Bâtiment ---
    ("BATIMENT_COUT_M2_LOGEMENT_COLLECTIF", "1800", "decimal", "batiment",
     "Coût de construction neuve / m² SHON — logement collectif (€ HT)"),
    ("BATIMENT_COUT_M2_BUREAUX", "1600", "decimal", "batiment",
     "Coût de construction neuve / m² SHON — bureaux (€ HT)"),
    ("BATIMENT_COUT_M2_ENSEIGNEMENT", "1500", "decimal", "batiment",
     "Coût de construction neuve / m² SHON — enseignement (€ HT)"),
    # --- Général ---
    ("NOM_PLATEFORME", "LBH Economiste", "texte", "general",
     "Nom affiché de la plateforme"),
    ("DEVISE", "EUR", "texte", "general",
     "Devise utilisée pour les montants"),
    ("FORMAT_DATE", "dd/mm/yyyy", "texte", "general",
     "Format d'affichage des dates"),
    # --- Messagerie / Roundcube ---
    ("ROUNDCUBE_NOM_APPLICATION", "Messagerie", "texte", "messagerie",
     "Nom affiché dans l'interface Roundcube."),
    ("ROUNDCUBE_LANGUE", "fr_FR", "texte", "messagerie",
     "Langue d'interface Roundcube (ex. fr_FR)."),
    ("ROUNDCUBE_TACHE_DEFAUT", "mail", "texte", "messagerie",
     "Tâche ouverte par défaut dans la messagerie intégrée (mail, settings, addressbook)."),
    ("ROUNDCUBE_LOGO_LIEN", "/roundcube/?_task=mail", "texte", "messagerie",
     "Lien appliqué au logo affiché dans Roundcube."),
    ("ROUNDCUBE_URL_AIDE", "", "texte", "messagerie",
     "URL d'assistance ou de documentation affichée dans Roundcube."),
]

# ---------------------------------------------------------------------------
# Données de référence — Profils de droits
# ---------------------------------------------------------------------------

PROFILS_DEFAUT = [
    ("SUPER_ADMIN", "Administrateur système", 1),
    ("ADMIN_BUREAU", "Administrateur du bureau", 2),
    ("DIRECTEUR_TECH", "Directeur technique", 3),
    ("ECONOMISTE_SR", "Économiste senior", 4),
    ("ECONOMISTE_JR", "Économiste junior", 5),
    ("CHARGE_AFFAIRES", "Chargé d'affaires", 6),
    ("CONDUCTEUR_TRAVAUX", "Conducteur de travaux", 7),
    ("REDACTEUR_TECH", "Rédacteur technique", 8),
    ("CLIENT", "Client / Maître d'ouvrage", 9),
    ("PARTENAIRE", "Partenaire / Co-traitant", 10),
    ("SOUS_TRAITANT", "Sous-traitant", 11),
    ("LECTURE_SEULE", "Visiteur — lecture seule", 12),
]

# ---------------------------------------------------------------------------
# Données de référence — Fonctionnalités activables
# ---------------------------------------------------------------------------

FONCTIONNALITES_DEFAUT = [
    # Module, Code, Libellé, Activée par défaut, Contrôle
    ("projets", "GESTION_PROJETS", "Gestion des projets", True, "systeme"),
    ("documents", "GESTION_DOCUMENTAIRE", "Gestion documentaire", True, "systeme"),
    ("documents", "OCR_AUTOMATIQUE", "OCR automatique des documents", False, "organisation"),
    ("documents", "ANALYSE_DXF", "Analyse des plans DWG/DXF", False, "organisation"),
    ("economie", "ECONOMIE_CONSTRUCTION", "Économie de la construction", True, "systeme"),
    ("economie", "CALCUL_RENTABILITE", "Calcul de rentabilité", True, "systeme"),
    ("bibliotheque", "BIBLIOTHEQUE_PRIX", "Bibliothèque de prix", True, "systeme"),
    ("metres", "METRES_QUANTITATIFS", "Métrés et quantitatifs", True, "systeme"),
    ("voirie", "DIMENSIONNEMENT_VOIRIE", "Dimensionnement voirie", True, "organisation"),
    ("batiment", "PRESIZING_BATIMENT", "Pré-dimensionnement bâtiment", True, "organisation"),
    ("pieces_ecrites", "PIECES_ECRITES", "Pièces écrites (CCTP, DPGF)", True, "systeme"),
    ("appels_offres", "APPELS_OFFRES", "Appels d'offres", True, "systeme"),
    ("execution", "SUIVI_EXECUTION", "Suivi d'exécution des travaux", True, "organisation"),
    ("messagerie", "MODULE_WEBMAIL", "Webmail intégré", True, "systeme"),
    ("supervision", "SUPERVISION", "Supervision de la plateforme", True, "systeme"),
]

# ---------------------------------------------------------------------------
# Types de documents
# ---------------------------------------------------------------------------

TYPES_DOCUMENTS_DEFAUT = [
    ("PLAN", "Plan technique", 1),
    ("NOTE_CALCUL", "Note de calcul", 2),
    ("RAPPORT", "Rapport technique", 3),
    ("CCTP", "Cahier des Clauses Techniques Particulières", 4),
    ("DPGF", "Décomposition du Prix Global et Forfaitaire", 5),
    ("BPU", "Bordereau des Prix Unitaires", 6),
    ("DQE", "Détail Quantitatif Estimatif", 7),
    ("AE", "Acte d'Engagement", 8),
    ("PV_RECEPTION", "Procès-verbal de réception", 9),
    ("CR_CHANTIER", "Compte rendu de chantier", 10),
    ("PHOTO", "Photographie", 11),
    ("AUTRE", "Autre document", 99),
]

# ---------------------------------------------------------------------------
# Modèles de pièces écrites
# ---------------------------------------------------------------------------

MODELES_PIECES_ECRITES_DEFAUT = [
    (
        "CCTP_STANDARD",
        "CCTP standard",
        "cctp",
        "Base de cahier des clauses techniques particulières pour consultations travaux.",
        [
            {"nom": "nom_projet", "description": "Intitulé du projet", "exemple": "Réhabilitation de la mairie"},
            {"nom": "reference_projet", "description": "Référence du projet", "exemple": "2026-0001"},
            {"nom": "maitre_ouvrage", "description": "Nom du maître d'ouvrage", "exemple": "Commune de Mamoudzou"},
        ],
    ),
    (
        "DPGF_STANDARD",
        "DPGF standard",
        "dpgf",
        "Trame de décomposition du prix global et forfaitaire.",
        [
            {"nom": "nom_projet", "description": "Intitulé du projet", "exemple": "Construction de bureaux"},
            {"nom": "reference_projet", "description": "Référence du projet", "exemple": "2026-0002"},
        ],
    ),
    (
        "BPU_STANDARD",
        "BPU standard",
        "bpu",
        "Bordereau de prix unitaires pour lot séparé ou marché à bons de commande.",
        [
            {"nom": "nom_projet", "description": "Intitulé du projet", "exemple": "Aménagement VRD"},
            {"nom": "reference_projet", "description": "Référence du projet", "exemple": "2026-0003"},
        ],
    ),
    (
        "RC_STANDARD",
        "Règlement de consultation standard",
        "rc",
        "Trame de règlement de consultation pour marché de travaux.",
        [
            {"nom": "nom_projet", "description": "Intitulé du projet", "exemple": "Extension école primaire"},
            {"nom": "date_limite_remise", "description": "Date limite des offres", "exemple": "30/04/2026"},
        ],
    ),
]


class Command(BaseCommand):
    help = "Charge les données de référence initiales de la plateforme."

    def add_arguments(self, parser):
        parser.add_argument(
            "--force",
            action="store_true",
            help="Écraser les données existantes.",
        )

    def handle(self, *args, **options):
        force = options["force"]

        with transaction.atomic():
            self._charger_profils(force)
            self._charger_parametres(force)
            self._charger_fonctionnalites(force)
            self._charger_types_documents(force)
            self._charger_modeles_pieces_ecrites(force)

        self.stdout.write(self.style.SUCCESS("\nDonnées de référence chargées avec succès."))

    def _charger_profils(self, force: bool):
        from applications.comptes.models import ProfilDroit
        crees = 0
        for code, libelle, ordre in PROFILS_DEFAUT:
            obj, created = ProfilDroit.objects.get_or_create(
                code=code,
                defaults={"libelle": libelle, "ordre_affichage": ordre},
            )
            if not created and force:
                obj.libelle = libelle
                obj.ordre_affichage = ordre
                obj.save()
            if created:
                crees += 1
        self.stdout.write(f"  Profils de droits : {crees} créés")

    def _charger_parametres(self, force: bool):
        from applications.parametres.models import Parametre
        crees = 0
        for cle, valeur, type_val, module, description in PARAMETRES_DEFAUT:
            obj, created = Parametre.objects.get_or_create(
                cle=cle,
                defaults={
                    "valeur": valeur,
                    "type_valeur": type_val,
                    "module": module,
                    "description": description,
                },
            )
            if not created and force and not obj.est_verrouille:
                obj.valeur = valeur
                obj.save()
            if created:
                crees += 1
        self.stdout.write(f"  Paramètres métier : {crees} créés")

    def _charger_fonctionnalites(self, force: bool):
        from applications.parametres.models import FonctionnaliteActivable
        crees = 0
        for module, code, libelle, active, controle in FONCTIONNALITES_DEFAUT:
            obj, created = FonctionnaliteActivable.objects.get_or_create(
                code=code,
                defaults={
                    "module": module,
                    "libelle": libelle,
                    "est_active": active,
                    "niveau_controle": controle,
                },
            )
            if created:
                crees += 1
        self.stdout.write(f"  Fonctionnalités activables : {crees} créées")

    def _charger_types_documents(self, force: bool):
        from applications.documents.models import TypeDocument
        crees = 0
        for code, libelle, ordre in TYPES_DOCUMENTS_DEFAUT:
            obj, created = TypeDocument.objects.get_or_create(
                code=code,
                defaults={"libelle": libelle, "ordre_affichage": ordre},
            )
            if created:
                crees += 1
        self.stdout.write(f"  Types de documents : {crees} créés")

    def _charger_modeles_pieces_ecrites(self, force: bool):
        from applications.pieces_ecrites.models import ModeleDocument

        crees = 0
        for code, libelle, type_document, description, variables_fusion in MODELES_PIECES_ECRITES_DEFAUT:
            obj, created = ModeleDocument.objects.get_or_create(
                code=code,
                defaults={
                    "libelle": libelle,
                    "type_document": type_document,
                    "description": description,
                    "variables_fusion": variables_fusion,
                    "est_actif": True,
                },
            )
            if not created and force:
                obj.libelle = libelle
                obj.type_document = type_document
                obj.description = description
                obj.variables_fusion = variables_fusion
                obj.est_actif = True
                obj.save()
            if created:
                crees += 1

        self.stdout.write(f"  Modèles de pièces écrites : {crees} créés")
