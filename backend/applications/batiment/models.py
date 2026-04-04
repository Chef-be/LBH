"""
Modèles de pré-dimensionnement bâtiment — Plateforme LBH.
Estimation rapide de surfaces, volumes et coûts d'un programme immobilier.
"""

import uuid
from django.db import models


class ProgrammeBatiment(models.Model):
    """
    Programme immobilier — ensemble de locaux à créer ou réhabiliter.
    Sert de base au pré-dimensionnement et à l'estimation du coût de construction.
    """

    TYPES_OPERATION = [
        ("construction_neuve", "Construction neuve"),
        ("rehabilitation", "Réhabilitation"),
        ("extension", "Extension"),
        ("renovation_lourde", "Rénovation lourde"),
        ("demolition_reconstruction", "Démolition-reconstruction"),
    ]

    TYPES_BATIMENT = [
        ("logement_collectif", "Logement collectif"),
        ("logement_individuel", "Logement individuel"),
        ("bureaux", "Bureaux"),
        ("commerce", "Commerce"),
        ("enseignement", "Enseignement"),
        ("sante", "Santé"),
        ("sport_loisirs", "Sport et loisirs"),
        ("industrie_logistique", "Industrie / logistique"),
        ("autre", "Autre"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    projet = models.ForeignKey(
        "projets.Projet", on_delete=models.CASCADE,
        related_name="programmes_batiment", verbose_name="Projet",
    )
    intitule = models.CharField(max_length=300, verbose_name="Intitulé du programme")
    type_operation = models.CharField(
        max_length=30, choices=TYPES_OPERATION,
        default="construction_neuve", verbose_name="Type d'opération",
    )
    type_batiment = models.CharField(
        max_length=30, choices=TYPES_BATIMENT,
        default="logement_collectif", verbose_name="Type de bâtiment",
    )

    # Surfaces
    shon_totale = models.DecimalField(
        max_digits=10, decimal_places=2,
        null=True, blank=True,
        verbose_name="SHON totale (m²)",
    )
    shab_totale = models.DecimalField(
        max_digits=10, decimal_places=2,
        null=True, blank=True,
        verbose_name="Surface habitable totale (m²)",
    )
    emprise_sol = models.DecimalField(
        max_digits=10, decimal_places=2,
        null=True, blank=True,
        verbose_name="Emprise au sol (m²)",
    )

    # Niveaux
    nombre_niveaux_hors_sol = models.PositiveSmallIntegerField(
        default=1, verbose_name="Nombre de niveaux hors sol",
    )
    nombre_niveaux_sous_sol = models.PositiveSmallIntegerField(
        default=0, verbose_name="Nombre de niveaux sous sol",
    )

    # Coût estimé global
    cout_estime_ht = models.DecimalField(
        max_digits=14, decimal_places=2,
        null=True, blank=True,
        verbose_name="Coût estimé global HT (€)",
    )
    cout_par_m2_shon_ht = models.DecimalField(
        max_digits=10, decimal_places=2,
        null=True, blank=True,
        verbose_name="Coût / m² SHON HT (€)",
    )

    # Paramètres de calcul (surchargent les paramètres système)
    indice_base = models.CharField(
        max_length=20, blank=True,
        verbose_name="Indice BT de base (ex : BT01)",
    )
    date_valeur = models.DateField(
        null=True, blank=True,
        verbose_name="Date de valeur de l'estimation",
    )

    observations = models.TextField(blank=True)
    date_creation = models.DateTimeField(auto_now_add=True)
    date_modification = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "batiment_programme"
        verbose_name = "Programme bâtiment"
        verbose_name_plural = "Programmes bâtiment"
        ordering = ["-date_modification"]

    def __str__(self):
        return f"{self.intitule} — {self.projet.reference}"


class LocalProgramme(models.Model):
    """
    Local élémentaire d'un programme bâtiment.
    Ex : logement T3, salle de classe, bureau open-space, etc.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    programme = models.ForeignKey(
        ProgrammeBatiment, on_delete=models.CASCADE,
        related_name="locaux", verbose_name="Programme",
    )
    designation = models.CharField(max_length=200, verbose_name="Désignation")
    categorie = models.CharField(max_length=100, blank=True, verbose_name="Catégorie")
    nombre = models.PositiveSmallIntegerField(default=1, verbose_name="Nombre")
    surface_unitaire_m2 = models.DecimalField(
        max_digits=8, decimal_places=2,
        verbose_name="Surface unitaire (m²)",
    )

    class Meta:
        db_table = "batiment_local"
        verbose_name = "Local"
        verbose_name_plural = "Locaux"
        ordering = ["programme", "categorie", "designation"]

    def __str__(self):
        return f"{self.nombre} × {self.designation} ({self.surface_unitaire_m2} m²)"

    @property
    def surface_totale_m2(self):
        return self.nombre * self.surface_unitaire_m2
