"""
Modèles des organisations — Structures juridiques et groupes d'utilisateurs.
Plateforme LBH — Bureau d'Études Économiste
"""

import uuid
from django.db import models


class Organisation(models.Model):
    """
    Structure juridique participant à la plateforme.
    Peut représenter un bureau d'études, une entreprise, un maître d'ouvrage,
    un partenaire ou un sous-traitant.
    """

    TYPES_ORGANISATION = [
        ("bureau_etudes", "Bureau d'études"),
        ("entreprise", "Entreprise"),
        ("maitre_ouvrage", "Maître d'ouvrage"),
        ("partenaire", "Partenaire"),
        ("sous_traitant", "Sous-traitant"),
    ]

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
        verbose_name="Identifiant",
    )
    code = models.CharField(
        max_length=50,
        unique=True,
        verbose_name="Code organisation",
    )
    nom = models.CharField(
        max_length=255,
        verbose_name="Nom",
    )
    type_organisation = models.CharField(
        max_length=30,
        choices=TYPES_ORGANISATION,
        verbose_name="Type d'organisation",
    )

    # Informations légales
    siret = models.CharField(
        max_length=14,
        blank=True,
        verbose_name="Numéro SIRET",
    )

    # Adresse
    adresse = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="Adresse",
    )
    code_postal = models.CharField(
        max_length=10,
        blank=True,
        verbose_name="Code postal",
    )
    ville = models.CharField(
        max_length=100,
        blank=True,
        verbose_name="Ville",
    )
    pays = models.CharField(
        max_length=100,
        default="France",
        verbose_name="Pays",
    )

    # Coordonnées
    telephone = models.CharField(
        max_length=20,
        blank=True,
        verbose_name="Téléphone",
    )
    courriel = models.EmailField(
        blank=True,
        verbose_name="Adresse de courriel",
    )
    site_web = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="Site web",
    )

    # Identité visuelle
    logo = models.ImageField(
        upload_to="logos_organisations/",
        null=True,
        blank=True,
        verbose_name="Logo",
    )

    # Statut
    est_active = models.BooleanField(
        default=True,
        verbose_name="Organisation active",
    )

    # Hiérarchie (agences, antennes régionales, etc.)
    organisation_parente = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="organisations_filles",
        verbose_name="Organisation parente",
        help_text="Renseigner pour les agences et antennes rattachées à une structure mère.",
    )

    # Horodatage
    date_creation = models.DateTimeField(
        auto_now_add=True,
        verbose_name="Date de création",
    )
    date_modification = models.DateTimeField(
        auto_now=True,
        verbose_name="Date de dernière modification",
    )

    class Meta:
        db_table = "organisations_organisation"
        verbose_name = "Organisation"
        verbose_name_plural = "Organisations"
        ordering = ["nom"]

    def __str__(self):
        return f"{self.nom} ({self.code})"


class GroupeUtilisateurs(models.Model):
    """
    Groupe d'utilisateurs au sein d'une organisation.
    Permet de regrouper des membres pour faciliter l'attribution de droits
    ou l'affectation à des projets.
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
        verbose_name="Identifiant",
    )
    organisation = models.ForeignKey(
        Organisation,
        on_delete=models.CASCADE,
        related_name="groupes",
        verbose_name="Organisation",
    )
    nom = models.CharField(
        max_length=200,
        verbose_name="Nom du groupe",
    )
    description = models.TextField(
        blank=True,
        verbose_name="Description",
    )

    # Membres du groupe (relation many-to-many vers Utilisateur)
    membres = models.ManyToManyField(
        "comptes.Utilisateur",
        blank=True,
        related_name="groupes",
        verbose_name="Membres",
    )

    class Meta:
        db_table = "organisations_groupe"
        verbose_name = "Groupe d'utilisateurs"
        verbose_name_plural = "Groupes d'utilisateurs"
        ordering = ["organisation", "nom"]
        constraints = [
            models.UniqueConstraint(
                fields=["organisation", "nom"],
                name="unicite_nom_groupe_par_organisation",
            )
        ]

    def __str__(self):
        return f"{self.nom} — {self.organisation.nom}"
