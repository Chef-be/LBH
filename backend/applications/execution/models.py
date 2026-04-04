"""
Modèles de suivi d'exécution des travaux — Plateforme BEE.
Direction de l'exécution des travaux (DET), situations de travaux, OPR/AOR.
"""

import uuid
from decimal import Decimal
from django.db import models
from django.utils import timezone


def obtenir_processus_execution_par_defaut():
    """Retourne la grille de pilotage MOE/OPC par défaut."""
    return {
        "registre_chantier": False,
        "planning_detaille": False,
        "visa_execution": False,
        "suivi_qualite": False,
        "plan_controle_exterieur": False,
        "gestion_modifications": False,
        "opr_preparees": False,
        "dossier_ouvrage": False,
    }


def obtenir_jours_ouvres_par_defaut():
    """Retourne les jours ouvrés standards du lundi au vendredi."""
    return [0, 1, 2, 3, 4]


class SuiviExecution(models.Model):
    """
    Dossier de suivi d'exécution rattaché à un projet.
    Regroupe les comptes rendus de chantier, situations et ordres de service.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    projet = models.OneToOneField(
        "projets.Projet", on_delete=models.CASCADE,
        related_name="suivi_execution", verbose_name="Projet",
    )
    entreprise_principale = models.ForeignKey(
        "organisations.Organisation", on_delete=models.PROTECT,
        null=True, blank=True, related_name="suivis_en_tant_qu_entreprise",
        verbose_name="Entreprise principale",
    )

    # Calendrier contractuel
    date_os_demarrage = models.DateField(
        null=True, blank=True, verbose_name="Date de l'OS de démarrage",
    )
    duree_contractuelle_jours = models.PositiveSmallIntegerField(
        null=True, blank=True, verbose_name="Durée contractuelle (jours ouvrés)",
    )
    date_fin_contractuelle = models.DateField(
        null=True, blank=True, verbose_name="Date de fin contractuelle",
    )

    # Montant du marché
    montant_marche_ht = models.DecimalField(
        max_digits=15, decimal_places=2,
        null=True, blank=True,
        verbose_name="Montant initial du marché HT (€)",
    )
    montant_travaux_supplementaires_ht = models.DecimalField(
        max_digits=14, decimal_places=2,
        default=0,
        verbose_name="Travaux supplémentaires / avenants HT (€)",
    )
    processus_maitrise = models.JSONField(
        default=obtenir_processus_execution_par_defaut,
        blank=True,
        verbose_name="Processus maîtrisés",
    )
    points_vigilance = models.JSONField(
        default=list,
        blank=True,
        verbose_name="Points de vigilance",
    )
    prochaines_actions = models.JSONField(
        default=list,
        blank=True,
        verbose_name="Prochaines actions",
    )
    observations_pilotage = models.TextField(
        blank=True,
        verbose_name="Observations de pilotage",
    )

    date_creation = models.DateTimeField(auto_now_add=True)
    date_modification = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "execution_suivi"
        verbose_name = "Suivi d'exécution"
        verbose_name_plural = "Suivis d'exécution"

    def __str__(self):
        return f"Suivi — {self.projet.reference}"

    @property
    def montant_total_ht(self):
        montant = self.montant_marche_ht or 0
        return montant + (self.montant_travaux_supplementaires_ht or 0)

    @property
    def total_processus(self):
        return len(self.processus_maitrise or {})

    @property
    def nb_processus_maitrises(self):
        return sum(1 for actif in (self.processus_maitrise or {}).values() if actif)

    @property
    def taux_maitrise_processus(self):
        total = self.total_processus
        if total == 0:
            return 0
        return round((self.nb_processus_maitrises / total) * 100)


class PlanningChantier(models.Model):
    """Planning opérationnel rattaché à un suivi d'exécution."""

    SOURCES = [
        ("manuel", "Saisie manuelle"),
        ("etude_economique", "Étude économique / DPGF"),
        ("etude_prix", "Étude de prix"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    suivi = models.ForeignKey(
        SuiviExecution, on_delete=models.CASCADE, related_name="plannings", verbose_name="Suivi",
    )
    intitule = models.CharField(max_length=255, verbose_name="Intitulé")
    source_donnees = models.CharField(max_length=30, choices=SOURCES, default="manuel")
    etude_economique = models.ForeignKey(
        "economie.EtudeEconomique",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="plannings_chantier",
    )
    etude_prix = models.ForeignKey(
        "economie.EtudePrix",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="plannings_chantier",
    )
    date_debut_reference = models.DateField(default=timezone.now, verbose_name="Début de référence")
    heures_par_jour = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("7.00"))
    coefficient_rendement_global = models.DecimalField(max_digits=6, decimal_places=4, default=Decimal("1.0000"))
    jours_ouvres = models.JSONField(
        default=obtenir_jours_ouvres_par_defaut,
        blank=True,
        verbose_name="Jours ouvrés actifs",
    )
    jours_feries = models.JSONField(
        default=list,
        blank=True,
        verbose_name="Jours fériés ou neutralisés",
    )
    lisser_ressources_partagees = models.BooleanField(
        default=True,
        verbose_name="Lisser les ressources partagées",
    )
    chemin_critique = models.JSONField(default=list, blank=True)
    synthese_calcul = models.JSONField(default=dict, blank=True)
    date_creation = models.DateTimeField(auto_now_add=True)
    date_modification = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "execution_planning_chantier"
        verbose_name = "Planning chantier"
        verbose_name_plural = "Plannings chantier"
        ordering = ["-date_modification"]

    def __str__(self):
        return f"{self.intitule} — {self.suivi.projet.reference}"


class TachePlanning(models.Model):
    """Tâche de planning calculée ou saisie pour un chantier."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    planning = models.ForeignKey(
        PlanningChantier, on_delete=models.CASCADE, related_name="taches", verbose_name="Planning",
    )
    numero_ordre = models.PositiveSmallIntegerField(default=1)
    code = models.CharField(max_length=50, blank=True)
    designation = models.CharField(max_length=500)
    unite = models.CharField(max_length=20, blank=True, default="")
    quantite = models.DecimalField(max_digits=15, decimal_places=3, default=0)
    temps_unitaire_heures = models.DecimalField(max_digits=12, decimal_places=4, default=0)
    heures_totales = models.DecimalField(max_digits=14, decimal_places=4, default=0)
    effectif_alloue = models.PositiveSmallIntegerField(default=1)
    duree_jours = models.DecimalField(max_digits=10, decimal_places=2, default=1)
    decalage_jours = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    date_debut_calculee = models.DateField(null=True, blank=True)
    date_fin_calculee = models.DateField(null=True, blank=True)
    marge_libre_jours = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    est_critique = models.BooleanField(default=False)
    mode_calcul = models.CharField(
        max_length=20,
        choices=[("auto", "Automatique"), ("manuel", "Forcé manuellement")],
        default="auto",
    )
    ref_ligne_economique = models.ForeignKey(
        "economie.LignePrix",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="taches_planning",
    )
    ref_ligne_prix = models.ForeignKey(
        "economie.LignePrixEtude",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="taches_planning",
    )
    metadata_calcul = models.JSONField(default=dict, blank=True)
    observations = models.TextField(blank=True)

    class Meta:
        db_table = "execution_tache_planning"
        verbose_name = "Tâche de planning"
        verbose_name_plural = "Tâches de planning"
        ordering = ["planning", "numero_ordre", "designation"]

    def __str__(self):
        return self.designation


class DependanceTachePlanning(models.Model):
    """Dépendance entre tâches de planning."""

    TYPES = [
        ("fd", "Fin -> Début"),
        ("dd", "Début -> Début"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tache_amont = models.ForeignKey(
        TachePlanning, on_delete=models.CASCADE, related_name="dependances_sortantes",
    )
    tache_aval = models.ForeignKey(
        TachePlanning, on_delete=models.CASCADE, related_name="dependances_entrantes",
    )
    type_dependance = models.CharField(max_length=10, choices=TYPES, default="fd")
    decalage_jours = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    class Meta:
        db_table = "execution_dependance_tache_planning"
        verbose_name = "Dépendance de tâche"
        verbose_name_plural = "Dépendances de tâches"
        unique_together = [("tache_amont", "tache_aval", "type_dependance")]


class AffectationEquipeTache(models.Model):
    """Équipe réellement affectée à une tâche de planning."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tache = models.ForeignKey(
        TachePlanning, on_delete=models.CASCADE, related_name="affectations_equipe",
    )
    profil = models.ForeignKey(
        "economie.ProfilMainOeuvre",
        on_delete=models.PROTECT,
        related_name="affectations_taches_planning",
    )
    effectif = models.PositiveSmallIntegerField(default=1)
    rendement_relatif = models.DecimalField(max_digits=6, decimal_places=4, default=Decimal("1.0000"))
    est_chef_equipe = models.BooleanField(default=False)

    class Meta:
        db_table = "execution_affectation_equipe_tache"
        verbose_name = "Affectation d'équipe à une tâche"
        verbose_name_plural = "Affectations d'équipes aux tâches"
        unique_together = [("tache", "profil")]


class CompteRenduChantier(models.Model):
    """Compte rendu de réunion de chantier hebdomadaire."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    suivi = models.ForeignKey(
        SuiviExecution, on_delete=models.CASCADE,
        related_name="comptes_rendus", verbose_name="Suivi",
    )
    numero = models.PositiveSmallIntegerField(verbose_name="Numéro de réunion")
    date_reunion = models.DateField(verbose_name="Date de la réunion")
    redacteur = models.ForeignKey(
        "comptes.Utilisateur", on_delete=models.PROTECT,
        null=True, blank=True, related_name="comptes_rendus_rediges",
        verbose_name="Rédacteur",
    )

    ordre_du_jour = models.TextField(blank=True, verbose_name="Ordre du jour")
    contenu = models.TextField(verbose_name="Contenu de la réunion")
    decisions = models.TextField(blank=True, verbose_name="Décisions et points à traiter")

    avancement_physique_pct = models.DecimalField(
        max_digits=5, decimal_places=2,
        null=True, blank=True,
        verbose_name="Avancement physique (%)",
    )

    date_creation = models.DateTimeField(auto_now_add=True)
    date_diffusion = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "execution_compte_rendu"
        verbose_name = "Compte rendu de chantier"
        verbose_name_plural = "Comptes rendus de chantier"
        ordering = ["suivi", "-date_reunion"]
        unique_together = [("suivi", "numero")]

    def __str__(self):
        return f"CR n°{self.numero} du {self.date_reunion} — {self.suivi.projet.reference}"


class SituationTravaux(models.Model):
    """Situation mensuelle de travaux — décompte provisoire."""

    STATUTS = [
        ("en_cours", "En cours de rédaction"),
        ("soumise", "Soumise à l'entreprise"),
        ("acceptee", "Acceptée"),
        ("contestee", "Contestée"),
        ("validee_moa", "Validée par la MOA"),
        ("payee", "Payée"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    suivi = models.ForeignKey(
        SuiviExecution, on_delete=models.CASCADE,
        related_name="situations", verbose_name="Suivi",
    )
    numero = models.PositiveSmallIntegerField(verbose_name="Numéro de situation")
    periode_debut = models.DateField(verbose_name="Début de période")
    periode_fin = models.DateField(verbose_name="Fin de période")
    statut = models.CharField(
        max_length=20, choices=STATUTS, default="en_cours",
    )

    # Montants
    montant_cumule_ht = models.DecimalField(
        max_digits=14, decimal_places=2,
        verbose_name="Montant cumulé HT (€)",
    )
    montant_periode_ht = models.DecimalField(
        max_digits=14, decimal_places=2,
        verbose_name="Montant de la période HT (€)",
    )
    avancement_financier_pct = models.DecimalField(
        max_digits=5, decimal_places=2,
        null=True, blank=True,
        verbose_name="Avancement financier (%)",
    )

    date_creation = models.DateTimeField(auto_now_add=True)
    date_modification = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "execution_situation"
        verbose_name = "Situation de travaux"
        verbose_name_plural = "Situations de travaux"
        ordering = ["suivi", "numero"]
        unique_together = [("suivi", "numero")]

    def __str__(self):
        return f"Situation n°{self.numero} — {self.suivi.projet.reference}"


class OrdreService(models.Model):
    """Ordre de service — instruction écrite à l'entreprise."""

    TYPES = [
        ("demarrage", "Ordre de démarrage"),
        ("suspension", "Ordre de suspension"),
        ("reprise", "Ordre de reprise"),
        ("modification", "Ordre de modification"),
        ("arret_definitif", "Arrêt définitif"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    suivi = models.ForeignKey(
        SuiviExecution, on_delete=models.CASCADE,
        related_name="ordres_service", verbose_name="Suivi",
    )
    numero = models.PositiveSmallIntegerField(verbose_name="Numéro")
    type_ordre = models.CharField(max_length=20, choices=TYPES, verbose_name="Type")
    date_emission = models.DateField(verbose_name="Date d'émission")
    objet = models.CharField(max_length=500, verbose_name="Objet")
    contenu = models.TextField(blank=True, verbose_name="Contenu")

    class Meta:
        db_table = "execution_ordre_service"
        verbose_name = "Ordre de service"
        verbose_name_plural = "Ordres de service"
        ordering = ["suivi", "numero"]

    def __str__(self):
        return f"OS n°{self.numero} — {self.type_ordre} — {self.suivi.projet.reference}"
