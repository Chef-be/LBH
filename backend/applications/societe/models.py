"""
Module Pilotage Société — Honoraires, devis, facturation, trésorerie.
Plateforme LBH — Bureau d'Études Économiste
"""

import uuid
from decimal import Decimal
from django.db import models
from django.utils import timezone


def jours_travailles_standard():
    return ["lundi", "mardi", "mercredi", "jeudi", "vendredi"]


def semaine_type_standard():
    return {
        "lundi": True,
        "mardi": True,
        "mercredi": True,
        "jeudi": True,
        "vendredi": True,
        "samedi": False,
        "dimanche": False,
    }


# ─────────────────────────────────────────────
# Profils horaires
# ─────────────────────────────────────────────

class ProfilHoraire(models.Model):
    """
    Profil de facturation avec coût interne et taux de vente.
    La logique principale applique le coefficient K société au coût direct
    horaire. Les anciens champs de marge restent présents pour compatibilité.
    """
    TYPE_PROFIL_CHOICES = [
        ("be", "Bureau d'études"),
        ("autre", "Autre"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=50, unique=True, verbose_name="Code")
    libelle = models.CharField(max_length=150, verbose_name="Libellé")
    description = models.TextField(blank=True, verbose_name="Description")
    taux_horaire_ht = models.DecimalField(
        max_digits=8, decimal_places=2, verbose_name="Taux horaire HT (€/h)"
    )
    couleur = models.CharField(max_length=7, default="#6366f1", verbose_name="Couleur affichage")
    actif = models.BooleanField(default=True, verbose_name="Actif")
    ordre = models.PositiveSmallIntegerField(default=0, verbose_name="Ordre d'affichage")

    # Paramètres de calcul salarial
    type_profil = models.CharField(
        max_length=10, choices=TYPE_PROFIL_CHOICES, default="be",
        verbose_name="Type de profil",
    )
    taux_charges_salariales = models.DecimalField(
        max_digits=6, decimal_places=4, default=Decimal("0.2200"),
        verbose_name="Taux charges salariales",
        help_text="Part salariale : Net = Brut × (1 − taux). Défaut 22 %.",
    )
    taux_charges_patronales = models.DecimalField(
        max_digits=6, decimal_places=4, default=Decimal("0.4200"),
        verbose_name="Taux charges patronales",
        help_text="Charges employeur sur brut. Défaut 42 %.",
    )
    heures_productives_an = models.DecimalField(
        max_digits=7, decimal_places=2, default=Decimal("1600.00"),
        verbose_name="Heures productives / an",
        help_text="Heures vendables après congés, administratif et formation. Défaut 1 600 h/an.",
    )
    taux_marge_vente = models.DecimalField(
        max_digits=6, decimal_places=4, default=Decimal("0.1500"),
        verbose_name="Marge de vente cible",
        help_text="Taux de marge sur prix de vente. Défaut 15 %.",
    )

    # Taux calculé (moyenne des simulations) et mode de pilotage
    taux_horaire_ht_calcule = models.DecimalField(
        max_digits=8, decimal_places=2, null=True, blank=True,
        verbose_name="Taux calculé (moyenne simulations)",
    )
    cout_direct_horaire = models.DecimalField(
        max_digits=8, decimal_places=2, default=Decimal("0.00"),
        verbose_name="Coût direct horaire",
    )
    taux_vente_horaire_calcule = models.DecimalField(
        max_digits=8, decimal_places=2, default=Decimal("0.00"),
        verbose_name="Taux de vente horaire calculé",
    )
    forfait_jour_ht_calcule = models.DecimalField(
        max_digits=10, decimal_places=2, default=Decimal("0.00"),
        verbose_name="Forfait jour HT calculé",
    )
    poids_ponderation = models.DecimalField(
        max_digits=8, decimal_places=2, default=Decimal("1.00"),
        verbose_name="Poids de pondération",
    )
    inclure_taux_moyen = models.BooleanField(
        default=True,
        verbose_name="Inclus dans le taux moyen pondéré",
    )
    coefficient_k_applique = models.DecimalField(
        max_digits=8, decimal_places=4, default=Decimal("1.0000"),
        verbose_name="Coefficient K appliqué",
    )
    utiliser_calcul = models.BooleanField(
        default=False,
        verbose_name="Piloter par les simulations",
        help_text="Si activé, taux_horaire_ht est mis à jour automatiquement depuis la moyenne des simulations.",
    )

    date_creation = models.DateTimeField(auto_now_add=True)
    date_modification = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "societe_profil_horaire"
        verbose_name = "Profil horaire"
        verbose_name_plural = "Profils horaires"
        ordering = ["ordre", "libelle"]

    def __str__(self):
        return f"{self.libelle} — {self.taux_horaire_ht} €/h"


class SimulationSalaire(models.Model):
    """
    Simulation salariale rattachée à un profil horaire.
    Saisie : salaire net → calcul automatique de la fiche de paie analytique.
    La moyenne des DHMO des simulations actives alimente le taux horaire du profil.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    profil = models.ForeignKey(
        ProfilHoraire,
        on_delete=models.CASCADE,
        related_name="simulations",
        verbose_name="Profil horaire",
    )
    libelle = models.CharField(max_length=150, verbose_name="Libellé de la simulation",
                               help_text="Ex : Hypothèse basse, Salarié actuel, Recrutement prévu…")
    salaire_net_mensuel = models.DecimalField(
        max_digits=10, decimal_places=2, verbose_name="Salaire net mensuel (€)"
    )
    primes_mensuelles = models.DecimalField(
        max_digits=10, decimal_places=2, default=Decimal("0.00"),
        verbose_name="Primes mensuelles (€)",
    )
    avantages_mensuels = models.DecimalField(
        max_digits=10, decimal_places=2, default=Decimal("0.00"),
        verbose_name="Avantages en nature mensuels (€)",
    )

    # Champs calculés — stockés pour export et affichage rapide
    salaire_brut_estime = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0"))
    charges_salariales = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0"))
    charges_patronales = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0"))
    cout_employeur_mensuel = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0"))
    cout_annuel = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))
    dhmo = models.DecimalField(max_digits=8, decimal_places=4, default=Decimal("0"),
                               verbose_name="DHMO (€/h coût)")
    taux_vente_horaire = models.DecimalField(max_digits=8, decimal_places=4, default=Decimal("0"),
                                             verbose_name="Taux de vente horaire (€/h)")
    cout_direct_horaire = models.DecimalField(max_digits=8, decimal_places=4, default=Decimal("0"),
                                              verbose_name="Coût direct horaire")
    taux_vente_horaire_calcule_k = models.DecimalField(max_digits=8, decimal_places=4, default=Decimal("0"),
                                                       verbose_name="Taux de vente horaire via coefficient K")
    forfait_jour_ht_calcule = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0"),
                                                  verbose_name="Forfait jour HT calculé")

    actif = models.BooleanField(default=True, verbose_name="Inclus dans la moyenne")
    ordre = models.PositiveSmallIntegerField(default=0)
    date_creation = models.DateTimeField(auto_now_add=True)
    date_modification = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "societe_simulation_salaire"
        verbose_name = "Simulation salariale"
        verbose_name_plural = "Simulations salariales"
        ordering = ["profil", "ordre", "date_creation"]

    def __str__(self):
        return f"{self.profil.libelle} — {self.libelle} ({self.taux_vente_horaire} €/h)"

    def calculer(self):
        """Recalcule tous les champs dérivés depuis le salaire net et les paramètres du profil."""
        from applications.societe.services import calculer_fiche_salaire
        fiche = calculer_fiche_salaire(
            salaire_net=self.salaire_net_mensuel,
            primes=self.primes_mensuelles,
            avantages=self.avantages_mensuels,
            taux_sal=self.profil.taux_charges_salariales,
            taux_pat=self.profil.taux_charges_patronales,
            heures_an=self.profil.heures_productives_an,
            taux_marge=self.profil.taux_marge_vente,
        )
        self.salaire_brut_estime = fiche["salaire_brut_estime"]
        self.charges_salariales = fiche["charges_salariales"]
        self.charges_patronales = fiche["charges_patronales"]
        self.cout_employeur_mensuel = fiche["cout_employeur_mensuel"]
        self.cout_annuel = fiche["cout_annuel"]
        self.dhmo = fiche["dhmo"]
        self.cout_direct_horaire = fiche["cout_direct_horaire"]
        self.taux_vente_horaire = fiche["taux_vente_horaire"]
        self.taux_vente_horaire_calcule_k = fiche.get("taux_vente_horaire_calcule_k", fiche["taux_vente_horaire"])
        self.forfait_jour_ht_calcule = fiche.get("forfait_jour_ht_calcule", Decimal("0.00"))

    def save(self, *args, **kwargs):
        self.calculer()
        super().save(*args, **kwargs)
        from applications.societe.services import recalculer_taux_profil
        recalculer_taux_profil(self.profil)


class ProfilHoraireUtilisateur(models.Model):
    """Profil horaire par défaut affecté à un salarié."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    utilisateur = models.OneToOneField(
        "comptes.Utilisateur",
        on_delete=models.CASCADE,
        related_name="profil_horaire_societe",
        verbose_name="Salarié",
    )
    profil_horaire = models.ForeignKey(
        ProfilHoraire,
        on_delete=models.CASCADE,
        related_name="affectations_utilisateurs",
        verbose_name="Profil horaire",
    )
    date_creation = models.DateTimeField(auto_now_add=True)
    date_modification = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "societe_profil_horaire_utilisateur"
        verbose_name = "Affectation profil horaire salarié"
        verbose_name_plural = "Affectations profils horaires salariés"
        ordering = ["utilisateur__nom", "utilisateur__prenom"]

    def __str__(self):
        return f"{self.utilisateur.nom_complet} — {self.profil_horaire.libelle}"


# ─────────────────────────────────────────────
# Pilotage RH, pointage et absences
# ─────────────────────────────────────────────

class ProfilRHSalarie(models.Model):
    """Paramètres RH utilisés pour calculer la capacité productive d'un salarié."""

    TYPES_CONTRAT = [
        ("cdi", "CDI"),
        ("cdd", "CDD"),
        ("alternance", "Alternance"),
        ("stage", "Stage"),
        ("prestation", "Prestation"),
        ("autre", "Autre"),
    ]
    REGIMES_TEMPS = [
        ("heures", "Heures"),
        ("forfait_jours", "Forfait jours"),
        ("temps_partiel", "Temps partiel"),
        ("autre", "Autre"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    utilisateur = models.OneToOneField(
        "comptes.Utilisateur",
        on_delete=models.CASCADE,
        related_name="profil_rh_societe",
        verbose_name="Salarié",
    )
    organisation = models.ForeignKey(
        "organisations.Organisation",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="profils_rh_salaries",
        verbose_name="Organisation",
    )
    profil_horaire_societe = models.ForeignKey(
        ProfilHoraire,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="profils_rh",
        verbose_name="Profil horaire société",
    )
    type_contrat = models.CharField(max_length=20, choices=TYPES_CONTRAT, default="cdi")
    regime_temps_travail = models.CharField(max_length=20, choices=REGIMES_TEMPS, default="heures")
    heures_hebdomadaires_contractuelles = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("35.00"))
    jours_travailles_semaine = models.JSONField(default=jours_travailles_standard, blank=True)
    heure_debut_theorique = models.TimeField(null=True, blank=True)
    heure_fin_theorique = models.TimeField(null=True, blank=True)
    pause_midi_minutes = models.PositiveSmallIntegerField(default=60)
    taux_activite = models.DecimalField(max_digits=5, decimal_places=4, default=Decimal("1.0000"))
    droit_rtt_annuel = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal("0.00"))
    droit_conges_payes_annuel = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal("25.00"))
    solde_rtt_initial = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal("0.00"))
    solde_conges_initial = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal("0.00"))
    solde_recuperation_initial = models.DecimalField(max_digits=7, decimal_places=2, default=Decimal("0.00"))
    date_entree = models.DateField(null=True, blank=True)
    date_sortie = models.DateField(null=True, blank=True)
    actif = models.BooleanField(default=True)
    date_creation = models.DateTimeField(auto_now_add=True)
    date_modification = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "societe_profil_rh_salarie"
        verbose_name = "Profil RH salarié"
        verbose_name_plural = "Profils RH salariés"
        ordering = ["utilisateur__nom", "utilisateur__prenom"]

    def __str__(self):
        return f"Profil RH — {self.utilisateur.nom_complet}"


class CalendrierTravailSociete(models.Model):
    """Calendrier de travail paramétrable par année et organisation."""

    ZONES = [
        ("mayotte", "Mayotte"),
        ("france_metropolitaine", "France métropolitaine"),
        ("autre", "Autre"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organisation = models.ForeignKey(
        "organisations.Organisation",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="calendriers_travail_societe",
    )
    annee = models.PositiveSmallIntegerField(default=2026)
    libelle = models.CharField(max_length=160, default="Calendrier société")
    zone = models.CharField(max_length=40, choices=ZONES, default="mayotte")
    jours_feries = models.JSONField(default=list, blank=True)
    jours_non_travailles_exceptionnels = models.JSONField(default=list, blank=True)
    semaine_type = models.JSONField(default=semaine_type_standard, blank=True)
    actif = models.BooleanField(default=True)
    date_creation = models.DateTimeField(auto_now_add=True)
    date_modification = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "societe_calendrier_travail"
        verbose_name = "Calendrier de travail société"
        verbose_name_plural = "Calendriers de travail société"
        ordering = ["-annee", "libelle"]

    def __str__(self):
        return f"{self.libelle} {self.annee}"


class PointageJournalier(models.Model):
    """Pointage journalier validable, distinct des temps productifs imputés aux projets."""

    SOURCES = [
        ("manuel", "Manuel"),
        ("badgeuse", "Badgeuse"),
        ("import", "Import"),
        ("correction", "Correction"),
    ]
    STATUTS = [
        ("brouillon", "Brouillon"),
        ("soumis", "Soumis"),
        ("valide", "Validé"),
        ("rejete", "Rejeté"),
        ("corrige", "Corrigé"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    utilisateur = models.ForeignKey("comptes.Utilisateur", on_delete=models.CASCADE, related_name="pointages_journaliers")
    date = models.DateField(default=timezone.localdate)
    heure_arrivee = models.TimeField(null=True, blank=True)
    heure_depart = models.TimeField(null=True, blank=True)
    pause_minutes = models.PositiveSmallIntegerField(default=0)
    source = models.CharField(max_length=20, choices=SOURCES, default="manuel")
    statut = models.CharField(max_length=20, choices=STATUTS, default="brouillon")
    commentaire_salarie = models.TextField(blank=True, default="")
    commentaire_validateur = models.TextField(blank=True, default="")
    valide_par = models.ForeignKey(
        "comptes.Utilisateur",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="pointages_valides",
    )
    date_validation = models.DateTimeField(null=True, blank=True)
    date_creation = models.DateTimeField(auto_now_add=True)
    date_modification = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "societe_pointage_journalier"
        verbose_name = "Pointage journalier"
        verbose_name_plural = "Pointages journaliers"
        ordering = ["-date", "utilisateur__nom"]
        constraints = [
            models.UniqueConstraint(fields=["utilisateur", "date"], name="uniq_pointage_utilisateur_date"),
        ]

    @property
    def minutes_travaillees(self):
        if not self.heure_arrivee or not self.heure_depart:
            return 0
        debut = timezone.datetime.combine(self.date, self.heure_arrivee)
        fin = timezone.datetime.combine(self.date, self.heure_depart)
        minutes = int((fin - debut).total_seconds() // 60) - int(self.pause_minutes or 0)
        return max(0, minutes)

    @property
    def heures_travaillees(self):
        return (Decimal(self.minutes_travaillees) / Decimal("60")).quantize(Decimal("0.01"))

    def __str__(self):
        return f"{self.utilisateur.nom_complet} — {self.date}"


class EvenementPointage(models.Model):
    """Journal minimal des événements de pointage, sans géolocalisation par défaut."""

    TYPES = [
        ("arrivee", "Arrivée"),
        ("depart", "Départ"),
        ("debut_pause", "Début pause"),
        ("fin_pause", "Fin pause"),
        ("correction", "Correction"),
        ("validation", "Validation"),
        ("rejet", "Rejet"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    utilisateur = models.ForeignKey("comptes.Utilisateur", on_delete=models.CASCADE, related_name="evenements_pointage")
    pointage = models.ForeignKey(PointageJournalier, on_delete=models.CASCADE, null=True, blank=True, related_name="evenements")
    horodatage = models.DateTimeField(default=timezone.now)
    type_evenement = models.CharField(max_length=20, choices=TYPES)
    source = models.CharField(max_length=20, choices=PointageJournalier.SOURCES, default="manuel")
    adresse_ip = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True, default="")
    commentaire = models.TextField(blank=True, default="")
    date_creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "societe_evenement_pointage"
        verbose_name = "Événement de pointage"
        verbose_name_plural = "Événements de pointage"
        ordering = ["-horodatage"]


class DemandeAbsence(models.Model):
    """Demande d'absence ou de formation avec validation responsable."""

    TYPES_ABSENCE = [
        ("conge_paye", "Congé payé"),
        ("rtt", "RTT"),
        ("maladie", "Maladie"),
        ("formation", "Formation"),
        ("absence_autorisee", "Absence autorisée"),
        ("absence_non_remuneree", "Absence non rémunérée"),
        ("recuperation", "Récupération"),
        ("evenement_familial", "Événement familial"),
        ("autre", "Autre"),
    ]
    STATUTS = [
        ("brouillon", "Brouillon"),
        ("soumis", "Soumis"),
        ("valide", "Validé"),
        ("refuse", "Refusé"),
        ("annule", "Annulé"),
    ]
    DEMI_JOURNEES = [
        ("", "Journée complète"),
        ("matin", "Matin"),
        ("apres_midi", "Après-midi"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    utilisateur = models.ForeignKey("comptes.Utilisateur", on_delete=models.CASCADE, related_name="demandes_absence")
    type_absence = models.CharField(max_length=30, choices=TYPES_ABSENCE)
    date_debut = models.DateField()
    date_fin = models.DateField()
    demi_journee_debut = models.CharField(max_length=20, choices=DEMI_JOURNEES, blank=True, default="")
    demi_journee_fin = models.CharField(max_length=20, choices=DEMI_JOURNEES, blank=True, default="")
    nombre_jours_ouvres_calcule = models.DecimalField(max_digits=7, decimal_places=2, default=Decimal("0.00"))
    nombre_heures_calcule = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("0.00"))
    statut = models.CharField(max_length=20, choices=STATUTS, default="brouillon")
    motif = models.TextField(blank=True, default="")
    justificatif = models.FileField(upload_to="absences/justificatifs/", null=True, blank=True)
    commentaire_salarie = models.TextField(blank=True, default="")
    commentaire_validateur = models.TextField(blank=True, default="")
    valide_par = models.ForeignKey(
        "comptes.Utilisateur",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="absences_validees",
    )
    date_validation = models.DateTimeField(null=True, blank=True)
    impacte_solde = models.BooleanField(default=True)
    impacte_capacite = models.BooleanField(default=True)
    date_creation = models.DateTimeField(auto_now_add=True)
    date_modification = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "societe_demande_absence"
        verbose_name = "Demande d'absence"
        verbose_name_plural = "Demandes d'absence"
        ordering = ["-date_debut", "-date_creation"]

    def __str__(self):
        return f"{self.utilisateur.nom_complet} — {self.get_type_absence_display()} du {self.date_debut}"


class SoldeAbsenceSalarie(models.Model):
    """Solde annuel par type d'absence suivi pour un salarié."""

    TYPES_ABSENCE_SOLDE = [
        ("conge_paye", "Congé payé"),
        ("rtt", "RTT"),
        ("recuperation", "Récupération"),
        ("autre", "Autre"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    utilisateur = models.ForeignKey("comptes.Utilisateur", on_delete=models.CASCADE, related_name="soldes_absence")
    annee = models.PositiveSmallIntegerField(default=2026)
    type_absence = models.CharField(max_length=30, choices=TYPES_ABSENCE_SOLDE)
    acquis = models.DecimalField(max_digits=7, decimal_places=2, default=Decimal("0.00"))
    pris = models.DecimalField(max_digits=7, decimal_places=2, default=Decimal("0.00"))
    en_attente_validation = models.DecimalField(max_digits=7, decimal_places=2, default=Decimal("0.00"))
    solde = models.DecimalField(max_digits=7, decimal_places=2, default=Decimal("0.00"))
    report_annee_precedente = models.DecimalField(max_digits=7, decimal_places=2, default=Decimal("0.00"))
    ajuste_manuellement = models.DecimalField(max_digits=7, decimal_places=2, default=Decimal("0.00"))
    commentaire = models.TextField(blank=True, default="")
    date_creation = models.DateTimeField(auto_now_add=True)
    date_modification = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "societe_solde_absence_salarie"
        verbose_name = "Solde d'absence salarié"
        verbose_name_plural = "Soldes d'absence salariés"
        ordering = ["-annee", "utilisateur__nom", "type_absence"]
        constraints = [
            models.UniqueConstraint(fields=["utilisateur", "annee", "type_absence"], name="uniq_solde_absence_utilisateur_annee_type"),
        ]

    def recalculer_solde(self):
        self.solde = (
            Decimal(self.acquis or 0)
            + Decimal(self.report_annee_precedente or 0)
            + Decimal(self.ajuste_manuellement or 0)
            - Decimal(self.pris or 0)
        ).quantize(Decimal("0.01"))


class CompteurTempsSalarie(models.Model):
    """Agrégat recalculable de temps par salarié et période."""

    STATUTS = [
        ("provisoire", "Provisoire"),
        ("valide", "Validé"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    utilisateur = models.ForeignKey("comptes.Utilisateur", on_delete=models.CASCADE, related_name="compteurs_temps")
    periode_debut = models.DateField()
    periode_fin = models.DateField()
    heures_theoriques = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("0.00"))
    heures_pointees = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("0.00"))
    heures_normales = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("0.00"))
    heures_supplementaires = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("0.00"))
    heures_weekend = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("0.00"))
    heures_jour_ferie = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("0.00"))
    heures_absence = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("0.00"))
    heures_formation = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("0.00"))
    heures_productives = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("0.00"))
    heures_non_productives = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("0.00"))
    heures_recuperation_acquises = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("0.00"))
    heures_recuperation_prises = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("0.00"))
    solde_recuperation = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("0.00"))
    statut = models.CharField(max_length=20, choices=STATUTS, default="provisoire")
    date_calcul = models.DateTimeField(default=timezone.now)
    details_calcul = models.JSONField(default=dict, blank=True)
    date_creation = models.DateTimeField(auto_now_add=True)
    date_modification = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "societe_compteur_temps_salarie"
        verbose_name = "Compteur de temps salarié"
        verbose_name_plural = "Compteurs de temps salariés"
        ordering = ["-periode_debut", "utilisateur__nom"]


# ─────────────────────────────────────────────
# Paramètres économiques société
# ─────────────────────────────────────────────

class ParametreSociete(models.Model):
    MODES_ARRONDI_TARIF = [
        ("aucun", "Aucun"),
        ("euro", "Euro"),
        ("cinq_euros", "5 euros"),
        ("dix_euros", "10 euros"),
    ]
    STRATEGIES_TARIFAIRES = [
        ("taux_unique", "Taux moyen unique"),
        ("taux_par_profil", "Taux par profil"),
        ("mixte", "Mixte"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    annee = models.PositiveSmallIntegerField(default=2026, unique=True)
    zone_smic = models.CharField(max_length=80, default="Mayotte")
    smic_horaire_brut = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("9.33"))
    pmss = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("4005.00"))
    pass_annuel = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("48060.00"))
    taux_charges_salariales = models.DecimalField(max_digits=6, decimal_places=4, default=Decimal("0.2200"))
    taux_charges_patronales = models.DecimalField(max_digits=6, decimal_places=4, default=Decimal("0.4200"))
    heures_productives_be = models.DecimalField(max_digits=7, decimal_places=2, default=Decimal("1600.00"))
    decomposition_heures_productives = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="Décomposition heures productives BE",
    )
    heures_facturables_jour = models.DecimalField(max_digits=4, decimal_places=2, default=Decimal("7.00"))
    objectif_marge_nette = models.DecimalField(max_digits=6, decimal_places=4, default=Decimal("0.1500"))
    taux_frais_generaux = models.DecimalField(max_digits=6, decimal_places=4, default=Decimal("0.0000"))
    taux_frais_commerciaux = models.DecimalField(max_digits=6, decimal_places=4, default=Decimal("0.0000"))
    taux_risque_alea = models.DecimalField(max_digits=6, decimal_places=4, default=Decimal("0.0000"))
    taux_imponderables = models.DecimalField(max_digits=6, decimal_places=4, default=Decimal("0.0000"))
    taux_marge_cible = models.DecimalField(max_digits=6, decimal_places=4, default=Decimal("0.1500"))
    mode_arrondi_tarif = models.CharField(max_length=20, choices=MODES_ARRONDI_TARIF, default="aucun")
    pas_arrondi_tarif = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("1.00"))
    strategie_tarifaire = models.CharField(max_length=20, choices=STRATEGIES_TARIFAIRES, default="mixte")
    taux_tva_defaut = models.DecimalField(max_digits=5, decimal_places=3, default=Decimal("0.200"))
    date_creation = models.DateTimeField(auto_now_add=True)
    date_modification = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "societe_parametre"
        ordering = ["-annee"]

    def __str__(self):
        return f"Paramètres société {self.annee}"


class ChargeFixeStructure(models.Model):
    CATEGORIES = [
        ("loyer", "Loyer"),
        ("logiciels", "Logiciels"),
        ("assurances", "Assurances"),
        ("comptabilite", "Comptabilité"),
        ("vehicule", "Véhicule"),
        ("telephonie", "Téléphonie"),
        ("materiel", "Matériel"),
        ("documentation", "Documentation"),
        ("frais_bancaires", "Frais bancaires"),
        ("sous_traitance_structurelle", "Sous-traitance structurelle"),
        ("commercial", "Commercial"),
        ("autres", "Autres"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    libelle = models.CharField(max_length=200)
    categorie = models.CharField(max_length=40, choices=CATEGORIES, default="autres")
    montant_mensuel = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    actif = models.BooleanField(default=True)
    ordre = models.PositiveSmallIntegerField(default=0)
    date_creation = models.DateTimeField(auto_now_add=True)
    date_modification = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "societe_charge_fixe_structure"
        ordering = ["ordre", "libelle"]

    @property
    def montant_annuel(self):
        return (self.montant_mensuel * Decimal("12")).quantize(Decimal("0.01"))

    def __str__(self):
        return self.libelle


# ─────────────────────────────────────────────
# Devis d'honoraires
# ─────────────────────────────────────────────

class DevisHonoraires(models.Model):
    """
    Devis d'honoraires émis par le cabinet pour une mission.
    Peut être lié à un projet existant ou être autonome (prospection).
    """

    STATUTS = [
        ("brouillon", "Brouillon"),
        ("envoye", "Envoyé"),
        ("accepte", "Accepté"),
        ("refuse", "Refusé"),
        ("expire", "Expiré"),
        ("annule", "Annulé"),
    ]

    MODES_VALIDATION = [
        ("manuel", "Validation manuelle"),
        ("client", "Validation client"),
    ]

    TAUX_TVA = [
        (Decimal("0.20"), "20 %"),
        (Decimal("0.10"), "10 %"),
        (Decimal("0.055"), "5,5 %"),
        (Decimal("0.00"), "Exonéré (0 %)"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    reference = models.CharField(
        max_length=30, unique=True, verbose_name="Référence",
        help_text="Ex : DVZ-2026-001"
    )
    projet = models.ForeignKey(
        "projets.Projet", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="devis_honoraires", verbose_name="Projet lié"
    )
    intitule = models.CharField(max_length=300, verbose_name="Intitulé de la mission")
    statut = models.CharField(max_length=20, choices=STATUTS, default="brouillon")
    famille_client = models.CharField(max_length=40, blank=True, default="", verbose_name="Famille client")
    sous_type_client = models.CharField(max_length=60, blank=True, default="", verbose_name="Sous-type client")
    contexte_contractuel = models.CharField(max_length=60, blank=True, default="", verbose_name="Contexte contractuel")
    nature_ouvrage = models.CharField(max_length=20, blank=True, default="", verbose_name="Nature d'ouvrage")
    nature_marche = models.CharField(max_length=20, blank=True, default="", verbose_name="Nature de marché")
    role_lbh = models.CharField(max_length=60, blank=True, default="", verbose_name="Rôle LBH")
    contexte_projet_saisie = models.JSONField(default=dict, blank=True, verbose_name="Contexte projet préparé")
    missions_selectionnees = models.JSONField(default=list, blank=True, verbose_name="Missions et livrables vendus")

    # Client destinataire
    client_nom = models.CharField(max_length=200, verbose_name="Nom du client")
    client_contact = models.CharField(max_length=150, blank=True, verbose_name="Interlocuteur")
    client_email = models.EmailField(blank=True, verbose_name="Email")
    client_telephone = models.CharField(max_length=20, blank=True, verbose_name="Téléphone")
    client_adresse = models.TextField(blank=True, verbose_name="Adresse")

    # Dates
    date_emission = models.DateField(default=timezone.now, verbose_name="Date d'émission")
    date_validite = models.DateField(verbose_name="Date de validité")
    date_acceptation = models.DateField(null=True, blank=True, verbose_name="Date d'acceptation")
    date_refus = models.DateField(null=True, blank=True, verbose_name="Date de refus")
    date_envoi_client = models.DateTimeField(null=True, blank=True, verbose_name="Date d'envoi client")
    date_validation_client = models.DateTimeField(null=True, blank=True, verbose_name="Date de validation client")
    date_expiration_validation = models.DateTimeField(null=True, blank=True, verbose_name="Expiration validation client")
    jeton_validation_client = models.CharField(
        max_length=64, unique=True, null=True, blank=True, verbose_name="Jeton validation client",
    )
    mode_validation = models.CharField(
        max_length=10, choices=MODES_VALIDATION, blank=True, default="", verbose_name="Mode de validation",
    )

    # Conditions financières
    taux_tva = models.DecimalField(
        max_digits=5, decimal_places=3, choices=TAUX_TVA, default=Decimal("0.20"),
        verbose_name="Taux TVA"
    )
    acompte_pct = models.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal("30.00"),
        verbose_name="Acompte à la commande (%)"
    )
    delai_paiement_jours = models.PositiveSmallIntegerField(
        default=30, verbose_name="Délai de paiement (jours)"
    )

    # Totaux (recalculés à chaque sauvegarde des lignes)
    montant_ht = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))
    montant_tva = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))
    montant_ttc = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))

    # Textes libres
    objet = models.TextField(blank=True, verbose_name="Objet / contexte de la mission")
    conditions_particulieres = models.TextField(blank=True, verbose_name="Conditions particulières")
    notes_internes = models.TextField(blank=True, verbose_name="Notes internes")

    cree_par = models.ForeignKey(
        "comptes.Utilisateur", on_delete=models.PROTECT,
        null=True, related_name="devis_crees"
    )
    date_creation = models.DateTimeField(auto_now_add=True)
    date_modification = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "societe_devis_honoraires"
        verbose_name = "Devis d'honoraires"
        verbose_name_plural = "Devis d'honoraires"
        ordering = ["-date_emission"]

    def __str__(self):
        return f"{self.reference} — {self.intitule}"

    def recalculer_totaux(self):
        """Recalcule les totaux depuis les lignes."""
        ht = sum(l.montant_ht for l in self.lignes.all())
        tva = ht * self.taux_tva
        self.montant_ht = ht
        self.montant_tva = tva.quantize(Decimal("0.01"))
        self.montant_ttc = (ht + tva).quantize(Decimal("0.01"))
        self.save(update_fields=["montant_ht", "montant_tva", "montant_ttc"])

    @property
    def validation_client_active(self):
        if not self.jeton_validation_client or not self.date_expiration_validation:
            return False
        return self.date_expiration_validation >= timezone.now() and self.statut == "envoye"


class LigneDevis(models.Model):
    """
    Ligne d'un devis d'honoraires.
    Peut être calculée par heures × taux ou en forfait direct.
    """

    TYPES = [
        ("horaire", "Rémunération horaire"),
        ("forfait", "Forfait"),
        ("frais", "Remboursement de frais"),
        ("sous_traitance", "Sous-traitance"),
    ]
    MODES_CHIFFRAGE = [
        ("taux_moyen_be", "Taux horaire moyen BE"),
        ("taux_profil", "Taux horaire profil"),
        ("forfait_jour_profil", "Forfait jour profil"),
        ("forfait_mission", "Forfait mission"),
        ("frais", "Frais / débours"),
        ("sous_traitance", "Sous-traitance"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    devis = models.ForeignKey(
        DevisHonoraires, on_delete=models.CASCADE, related_name="lignes"
    )
    ordre = models.PositiveSmallIntegerField(default=0)
    type_ligne = models.CharField(max_length=20, choices=TYPES, default="horaire")
    mode_chiffrage = models.CharField(
        max_length=30,
        choices=MODES_CHIFFRAGE,
        blank=True,
        default="",
        verbose_name="Mode de chiffrage",
    )

    # Phase ou section libre
    phase_code = models.CharField(max_length=30, blank=True, verbose_name="Code phase")
    intitule = models.CharField(max_length=300, verbose_name="Intitulé")
    description = models.TextField(blank=True, verbose_name="Description")

    # Calcul horaire
    profil = models.ForeignKey(
        ProfilHoraire, on_delete=models.SET_NULL, null=True, blank=True,
        verbose_name="Profil intervenant"
    )
    nb_heures = models.DecimalField(
        max_digits=8, decimal_places=2, null=True, blank=True,
        verbose_name="Nombre d'heures"
    )
    nb_jours = models.DecimalField(
        max_digits=8, decimal_places=2, null=True, blank=True,
        verbose_name="Nombre de jours",
    )
    taux_horaire = models.DecimalField(
        max_digits=8, decimal_places=2, null=True, blank=True,
        verbose_name="Taux horaire HT (€/h)"
    )

    # Forfait ou frais
    montant_unitaire_ht = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True,
        verbose_name="Prix unitaire HT"
    )
    quantite = models.DecimalField(
        max_digits=8, decimal_places=2, default=Decimal("1"),
        verbose_name="Quantité"
    )
    unite = models.CharField(max_length=30, default="forfait", verbose_name="Unité")

    # Résultat
    montant_ht = models.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal("0"),
        verbose_name="Montant HT"
    )
    cout_direct_horaire_reference = models.DecimalField(
        max_digits=8, decimal_places=2, null=True, blank=True,
        verbose_name="Coût direct horaire de référence",
    )
    cout_direct_total_estime = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True,
        verbose_name="Coût direct total estimé",
    )
    coefficient_k_applique = models.DecimalField(
        max_digits=8, decimal_places=4, null=True, blank=True,
        verbose_name="Coefficient K appliqué",
    )
    marge_estimee_ht = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True,
        verbose_name="Marge estimée HT",
    )
    taux_marge_estime = models.DecimalField(
        max_digits=8, decimal_places=4, null=True, blank=True,
        verbose_name="Taux de marge estimé",
    )
    forfait_jour_ht_reference = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True,
        verbose_name="Forfait jour HT de référence",
    )
    source_tarif = models.CharField(max_length=80, blank=True, default="", verbose_name="Source tarif")

    class Meta:
        db_table = "societe_ligne_devis"
        verbose_name = "Ligne de devis"
        verbose_name_plural = "Lignes de devis"
        ordering = ["devis", "ordre"]

    def __str__(self):
        return f"{self.devis.reference} — {self.intitule}"

    def calculer_montant(self):
        """Calcule le montant HT et la marge depuis le service économique."""
        from applications.societe.services import calculer_ligne_devis

        valeurs = calculer_ligne_devis(self)
        for champ, valeur in valeurs.items():
            setattr(self, champ, valeur)
        return self.montant_ht


# ─────────────────────────────────────────────
# Facturation
# ─────────────────────────────────────────────

class Facture(models.Model):
    """
    Facture d'honoraires émise par le cabinet.
    Peut être générée depuis un devis accepté ou créée manuellement.
    """

    STATUTS = [
        ("brouillon", "Brouillon"),
        ("emise", "Émise"),
        ("en_retard", "En retard"),
        ("partiellement_payee", "Partiellement payée"),
        ("payee", "Payée"),
        ("annulee", "Annulée"),
        ("avoir", "Avoir"),
    ]

    TAUX_TVA = [
        (Decimal("0.20"), "20 %"),
        (Decimal("0.10"), "10 %"),
        (Decimal("0.055"), "5,5 %"),
        (Decimal("0.00"), "Exonéré (0 %)"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    reference = models.CharField(max_length=30, unique=True, verbose_name="Référence")
    devis = models.ForeignKey(
        DevisHonoraires, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="factures", verbose_name="Devis d'origine"
    )
    projet = models.ForeignKey(
        "projets.Projet", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="factures", verbose_name="Projet lié"
    )
    intitule = models.CharField(max_length=300, verbose_name="Intitulé")
    statut = models.CharField(max_length=25, choices=STATUTS, default="brouillon")

    # Client (copié depuis le devis ou saisi manuellement)
    client_nom = models.CharField(max_length=200, verbose_name="Nom du client")
    client_contact = models.CharField(max_length=150, blank=True)
    client_email = models.EmailField(blank=True)
    client_adresse = models.TextField(blank=True)

    # Dates
    date_emission = models.DateField(default=timezone.now, verbose_name="Date d'émission")
    date_echeance = models.DateField(verbose_name="Date d'échéance")

    # Jalons de relance (renseignés automatiquement)
    date_relance_1 = models.DateField(null=True, blank=True, verbose_name="1re relance")
    date_relance_2 = models.DateField(null=True, blank=True, verbose_name="2e relance")
    date_relance_3 = models.DateField(null=True, blank=True, verbose_name="3e relance")

    # Conditions
    taux_tva = models.DecimalField(
        max_digits=5, decimal_places=3, choices=TAUX_TVA, default=Decimal("0.20")
    )
    penalites_retard_pct = models.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal("3.00"),
        verbose_name="Taux pénalités de retard (%)"
    )

    # Montants
    montant_ht = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))
    montant_tva = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))
    montant_ttc = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))
    montant_paye = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))

    notes = models.TextField(blank=True, verbose_name="Notes / mentions légales")
    notes_internes = models.TextField(blank=True)

    cree_par = models.ForeignKey(
        "comptes.Utilisateur", on_delete=models.PROTECT,
        null=True, related_name="factures_creees"
    )
    date_creation = models.DateTimeField(auto_now_add=True)
    date_modification = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "societe_facture"
        verbose_name = "Facture"
        verbose_name_plural = "Factures"
        ordering = ["-date_emission"]

    def __str__(self):
        return f"{self.reference} — {self.client_nom}"

    @property
    def montant_restant(self):
        return self.montant_ttc - self.montant_paye

    @property
    def est_en_retard(self):
        from datetime import date
        return (
            self.statut in ("emise", "partiellement_payee")
            and self.date_echeance < date.today()
        )

    def recalculer_totaux(self):
        ht = sum(l.montant_ht for l in self.lignes.all())
        tva = ht * self.taux_tva
        self.montant_ht = ht
        self.montant_tva = tva.quantize(Decimal("0.01"))
        self.montant_ttc = (ht + tva).quantize(Decimal("0.01"))
        self.save(update_fields=["montant_ht", "montant_tva", "montant_ttc"])

    def mettre_a_jour_statut(self):
        """Met à jour le statut selon les paiements enregistrés."""
        if self.statut in ("brouillon", "annulee", "avoir"):
            return
        restant = self.montant_restant
        if restant <= 0:
            self.statut = "payee"
        elif self.montant_paye > 0:
            self.statut = "partiellement_payee"
        elif self.est_en_retard:
            self.statut = "en_retard"
        else:
            self.statut = "emise"
        self.save(update_fields=["statut"])


class LigneFacture(models.Model):
    """Ligne d'une facture d'honoraires."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    facture = models.ForeignKey(Facture, on_delete=models.CASCADE, related_name="lignes")
    ordre = models.PositiveSmallIntegerField(default=0)
    intitule = models.CharField(max_length=300, verbose_name="Désignation")
    description = models.TextField(blank=True)
    quantite = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("1"))
    unite = models.CharField(max_length=30, default="forfait")
    prix_unitaire_ht = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))
    montant_ht = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))

    class Meta:
        db_table = "societe_ligne_facture"
        verbose_name = "Ligne de facture"
        verbose_name_plural = "Lignes de facture"
        ordering = ["facture", "ordre"]

    def calculer_montant(self):
        self.montant_ht = (self.quantite * self.prix_unitaire_ht).quantize(Decimal("0.01"))
        return self.montant_ht


# ─────────────────────────────────────────────
# Paiements
# ─────────────────────────────────────────────

class Paiement(models.Model):
    """Enregistrement d'un encaissement sur une facture."""

    MODES = [
        ("virement", "Virement bancaire"),
        ("cheque", "Chèque"),
        ("especes", "Espèces"),
        ("carte", "Carte bancaire"),
        ("prelevement", "Prélèvement automatique"),
        ("autre", "Autre"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    facture = models.ForeignKey(Facture, on_delete=models.CASCADE, related_name="paiements")
    date_paiement = models.DateField(verbose_name="Date de paiement")
    montant = models.DecimalField(max_digits=12, decimal_places=2, verbose_name="Montant encaissé TTC")
    mode = models.CharField(max_length=20, choices=MODES, default="virement")
    reference = models.CharField(
        max_length=100, blank=True, verbose_name="Référence",
        help_text="Numéro de virement, chèque, etc."
    )
    notes = models.TextField(blank=True)
    enregistre_par = models.ForeignKey(
        "comptes.Utilisateur", on_delete=models.PROTECT, null=True
    )
    date_creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "societe_paiement"
        verbose_name = "Paiement"
        verbose_name_plural = "Paiements"
        ordering = ["-date_paiement"]

    def __str__(self):
        return f"{self.facture.reference} — {self.montant} € le {self.date_paiement}"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        # Recalculer le montant payé sur la facture
        total_paye = sum(p.montant for p in self.facture.paiements.all())
        self.facture.montant_paye = total_paye
        self.facture.save(update_fields=["montant_paye"])
        self.facture.mettre_a_jour_statut()


class TempsPasse(models.Model):
    """Saisie de temps passé pour le pilotage de rentabilité."""

    STATUTS = [
        ("brouillon", "Brouillon"),
        ("valide", "Validé"),
    ]
    CATEGORIES_TEMPS = [
        ("production", "Production"),
        ("administratif", "Administratif"),
        ("commercial", "Commercial"),
        ("formation", "Formation"),
        ("veille", "Veille"),
        ("absence", "Absence"),
        ("reunion_interne", "Réunion interne"),
        ("autre", "Autre"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    projet = models.ForeignKey(
        "projets.Projet",
        on_delete=models.CASCADE,
        related_name="temps_passes",
        verbose_name="Projet",
    )
    utilisateur = models.ForeignKey(
        "comptes.Utilisateur",
        on_delete=models.PROTECT,
        related_name="temps_passes",
        verbose_name="Salarié",
    )
    profil_horaire = models.ForeignKey(
        ProfilHoraire,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="temps_passes",
        verbose_name="Profil horaire",
    )
    date_saisie = models.DateField(default=timezone.now, verbose_name="Date")
    nature = models.CharField(
        max_length=20,
        choices=[
            ("projet", "Projet"),
            ("mission", "Mission"),
            ("livrable", "Livrable"),
        ],
        default="mission",
        verbose_name="Nature",
    )
    statut = models.CharField(
        max_length=20,
        choices=STATUTS,
        default="brouillon",
        verbose_name="Statut",
    )
    code_cible = models.CharField(max_length=120, blank=True, default="", verbose_name="Code cible")
    libelle_cible = models.CharField(max_length=255, blank=True, default="", verbose_name="Libellé cible")
    pointage_journalier = models.ForeignKey(
        PointageJournalier,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="temps_passes",
        verbose_name="Pointage journalier",
    )
    est_productif = models.BooleanField(default=True, verbose_name="Temps productif")
    categorie_temps = models.CharField(max_length=30, choices=CATEGORIES_TEMPS, default="production", verbose_name="Catégorie de temps")
    nb_heures = models.DecimalField(max_digits=8, decimal_places=2, verbose_name="Nombre d'heures")
    heures_objectif_associees = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("0.00"), verbose_name="Heures objectif associées")
    ecart_heures = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("0.00"), verbose_name="Écart heures")
    taux_horaire = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("0"), verbose_name="Taux horaire")
    taux_vente_horaire = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("0"), verbose_name="Taux de vente horaire")
    taux_vente_horaire_reference = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("0"), verbose_name="Taux de vente horaire de référence")
    cout_direct_horaire = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("0"), verbose_name="Coût direct horaire")
    montant_vendu_associe = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"), verbose_name="Montant vendu associé")
    marge_estimee = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"), verbose_name="Marge estimée")
    cout_total = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"), verbose_name="Coût total")
    cout_total_interne = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"), verbose_name="Coût total interne")
    commentaires = models.TextField(blank=True, verbose_name="Commentaires")
    cree_par = models.ForeignKey(
        "comptes.Utilisateur",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="temps_passes_crees",
    )
    date_creation = models.DateTimeField(auto_now_add=True)
    date_modification = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "societe_temps_passe"
        verbose_name = "Temps passé"
        verbose_name_plural = "Temps passés"
        ordering = ["-date_saisie", "-date_creation"]

    def __str__(self):
        return f"{self.projet.reference} — {self.utilisateur.nom_complet} — {self.nb_heures} h"

    def save(self, *args, **kwargs):
        if self.profil_horaire_id:
            if not self.cout_direct_horaire or self.cout_direct_horaire == Decimal("0"):
                self.cout_direct_horaire = self.profil_horaire.cout_direct_horaire or self.profil_horaire.taux_horaire_ht
            if not self.taux_vente_horaire or self.taux_vente_horaire == Decimal("0"):
                self.taux_vente_horaire = self.profil_horaire.taux_horaire_ht
            if not self.taux_horaire or self.taux_horaire == Decimal("0"):
                self.taux_horaire = self.cout_direct_horaire
        if not self.taux_vente_horaire_reference or self.taux_vente_horaire_reference == Decimal("0"):
            self.taux_vente_horaire_reference = self.taux_vente_horaire
        self.ecart_heures = (Decimal(self.nb_heures or 0) - Decimal(self.heures_objectif_associees or 0)).quantize(Decimal("0.01"))
        self.cout_total = (self.nb_heures * self.cout_direct_horaire).quantize(Decimal("0.01"))
        self.cout_total_interne = self.cout_total
        self.montant_vendu_associe = (self.nb_heures * self.taux_vente_horaire).quantize(Decimal("0.01"))
        self.marge_estimee = (self.montant_vendu_associe - self.cout_total).quantize(Decimal("0.01"))
        super().save(*args, **kwargs)
