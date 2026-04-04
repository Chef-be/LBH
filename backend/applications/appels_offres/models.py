"""
Modèles des appels d'offres — Plateforme BEE.
Gestion des consultations, DCE, réponses des entreprises et analyse des offres.
"""

import uuid
from django.db import models


class AppelOffres(models.Model):
    """
    Procédure d'appel d'offres lancée dans le cadre d'un projet.
    """

    TYPES_PROCEDURE = [
        ("appel_offres_ouvert", "Appel d'offres ouvert"),
        ("appel_offres_restreint", "Appel d'offres restreint"),
        ("procedure_adaptee", "Procédure adaptée (MAPA)"),
        ("procedure_negociee", "Procédure négociée"),
        ("marche_gre_a_gre", "Marché de gré à gré"),
        ("concours", "Concours"),
    ]

    STATUTS = [
        ("preparation", "Préparation du DCE"),
        ("publie", "Publié"),
        ("questions_reponses", "Questions / réponses"),
        ("clos", "Clos"),
        ("depouille", "Dépouillé"),
        ("attribue", "Attribué"),
        ("infructueux", "Infructueux"),
        ("abandonne", "Abandonné"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    projet = models.ForeignKey(
        "projets.Projet", on_delete=models.CASCADE,
        related_name="appels_offres", verbose_name="Projet",
    )
    lot = models.ForeignKey(
        "projets.Lot", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="appels_offres",
        verbose_name="Lot",
    )

    intitule = models.CharField(max_length=300, verbose_name="Intitulé")
    type_procedure = models.CharField(
        max_length=30, choices=TYPES_PROCEDURE,
        verbose_name="Type de procédure",
    )
    statut = models.CharField(
        max_length=20, choices=STATUTS,
        default="preparation", verbose_name="Statut",
    )

    # Calendrier
    date_publication = models.DateField(null=True, blank=True, verbose_name="Date de publication")
    date_limite_questions = models.DateField(null=True, blank=True, verbose_name="Date limite des questions")
    date_limite_remise = models.DateTimeField(null=True, blank=True, verbose_name="Date limite de remise")
    date_ouverture_plis = models.DateTimeField(null=True, blank=True, verbose_name="Date d'ouverture des plis")
    date_attribution = models.DateField(null=True, blank=True, verbose_name="Date d'attribution prévue")

    # Estimatif
    montant_estime_ht = models.DecimalField(
        max_digits=14, decimal_places=2,
        null=True, blank=True,
        verbose_name="Montant estimé HT (€)",
    )

    # Critères de jugement
    criteres_jugement = models.JSONField(
        default=list, blank=True,
        verbose_name="Critères de jugement",
        help_text="[{libelle, ponderation_pct, description}]",
    )
    pieces_consultation = models.JSONField(
        default=list,
        blank=True,
        verbose_name="Pièces de consultation",
    )
    points_vigilance = models.JSONField(
        default=list,
        blank=True,
        verbose_name="Points de vigilance",
    )
    analyse_contractuelle = models.TextField(
        blank=True,
        verbose_name="Analyse contractuelle",
    )
    conditions_paiement = models.TextField(
        blank=True,
        verbose_name="Conditions de paiement",
    )
    garanties_exigees = models.TextField(
        blank=True,
        verbose_name="Garanties et assurances",
    )
    delai_execution_jours = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        verbose_name="Délai d'exécution visé (jours ouvrés)",
    )
    variantes_autorisees = models.BooleanField(
        default=False,
        verbose_name="Variantes autorisées",
    )

    observations = models.TextField(blank=True)
    date_creation = models.DateTimeField(auto_now_add=True)
    date_modification = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "appels_offres_ao"
        verbose_name = "Appel d'offres"
        verbose_name_plural = "Appels d'offres"
        ordering = ["-date_creation"]

    def __str__(self):
        return f"{self.intitule} — {self.projet.reference}"


class OffreEntreprise(models.Model):
    """
    Offre reçue d'une entreprise en réponse à un appel d'offres.
    """

    STATUTS = [
        ("recue", "Reçue"),
        ("non_conforme", "Non conforme"),
        ("conforme", "Conforme"),
        ("retenue", "Retenue"),
        ("rejetee", "Rejetée"),
    ]
    STATUTS_CONFORMITE = [
        ("a_verifier", "À vérifier"),
        ("conforme", "Conforme"),
        ("reserve", "Avec réserve"),
        ("non_conforme", "Non conforme"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    appel_offres = models.ForeignKey(
        AppelOffres, on_delete=models.CASCADE,
        related_name="offres", verbose_name="Appel d'offres",
    )
    entreprise = models.ForeignKey(
        "organisations.Organisation", on_delete=models.PROTECT,
        related_name="offres_deposees", verbose_name="Entreprise soumissionnaire",
    )

    statut = models.CharField(
        max_length=20, choices=STATUTS, default="recue",
        verbose_name="Statut",
    )

    # Montants
    montant_offre_ht = models.DecimalField(
        max_digits=14, decimal_places=2,
        null=True, blank=True,
        verbose_name="Montant de l'offre HT (€)",
    )
    montant_negociee_ht = models.DecimalField(
        max_digits=14, decimal_places=2,
        null=True, blank=True,
        verbose_name="Montant négocié HT (€)",
    )

    # Délai proposé
    delai_propose_jours = models.PositiveSmallIntegerField(
        null=True, blank=True, verbose_name="Délai proposé (jours ouvrés)",
    )
    conformite_administrative = models.CharField(
        max_length=20,
        choices=STATUTS_CONFORMITE,
        default="a_verifier",
        verbose_name="Conformité administrative",
    )
    conformite_technique = models.CharField(
        max_length=20,
        choices=STATUTS_CONFORMITE,
        default="a_verifier",
        verbose_name="Conformité technique",
    )
    points_forts = models.TextField(
        blank=True,
        verbose_name="Points forts",
    )
    points_faibles = models.TextField(
        blank=True,
        verbose_name="Points faibles",
    )

    # Analyse multicritères
    notes_criteres = models.JSONField(
        default=dict, blank=True,
        verbose_name="Notes par critère",
        help_text="{code_critere: note}",
    )
    note_globale = models.DecimalField(
        max_digits=5, decimal_places=2,
        null=True, blank=True,
        verbose_name="Note globale (/100)",
    )

    observations = models.TextField(blank=True)
    date_reception = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "appels_offres_offre"
        verbose_name = "Offre d'entreprise"
        verbose_name_plural = "Offres d'entreprises"
        ordering = ["appel_offres", "note_globale"]
        unique_together = [("appel_offres", "entreprise")]

    def __str__(self):
        return f"{self.entreprise.nom} — {self.appel_offres.intitule}"

    @property
    def ecart_estimation_pct(self):
        montant_estime = self.appel_offres.montant_estime_ht
        if not montant_estime or self.montant_offre_ht is None:
            return None
        return round(((self.montant_offre_ht - montant_estime) / montant_estime) * 100, 2)
