"""
Modèles de gestion documentaire — Plateforme LBH.
Gestion, classification, versionnement et workflows des documents techniques.
"""

import uuid
from django.db import models


class TypeDocument(models.Model):
    """Type de document métier (plan, note de calcul, CCTP, etc.)."""

    code = models.CharField(max_length=50, unique=True, verbose_name="Code")
    libelle = models.CharField(max_length=200, verbose_name="Libellé")
    description = models.TextField(blank=True)
    icone = models.CharField(max_length=100, blank=True, verbose_name="Icône")
    ordre_affichage = models.PositiveSmallIntegerField(default=100)

    class Meta:
        db_table = "documents_type"
        verbose_name = "Type de document"
        verbose_name_plural = "Types de documents"
        ordering = ["ordre_affichage", "libelle"]

    def __str__(self):
        return self.libelle


class DossierDocumentProjet(models.Model):
    """Dossier GED rattaché à un projet."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    projet = models.ForeignKey(
        "projets.Projet", on_delete=models.CASCADE,
        related_name="dossiers_documents", verbose_name="Projet",
    )
    parent = models.ForeignKey(
        "self", on_delete=models.CASCADE,
        null=True, blank=True, related_name="enfants",
        verbose_name="Dossier parent",
    )
    code = models.CharField(max_length=80, verbose_name="Code")
    intitule = models.CharField(max_length=200, verbose_name="Intitulé")
    description = models.TextField(blank=True)
    ordre = models.PositiveSmallIntegerField(default=100)
    est_systeme = models.BooleanField(default=False, verbose_name="Dossier système")
    date_creation = models.DateTimeField(auto_now_add=True)
    date_modification = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "documents_dossier_projet"
        verbose_name = "Dossier documentaire projet"
        verbose_name_plural = "Dossiers documentaires projet"
        ordering = ["ordre", "intitule"]
        unique_together = [("projet", "parent", "code")]
        indexes = [
            models.Index(fields=["projet", "ordre"]),
            models.Index(fields=["projet", "code"]),
        ]

    def __str__(self):
        return f"{self.projet.reference} — {self.intitule}"


class Document(models.Model):
    """
    Document technique rattaché à un projet.
    Chaque version est un enregistrement distinct (versionnement linéaire).
    """

    STATUTS = [
        ("brouillon", "Brouillon"),
        ("en_revision", "En révision"),
        ("en_validation", "En validation"),
        ("valide", "Validé"),
        ("diffuse", "Diffusé"),
        ("obsolete", "Obsolète"),
        ("archive", "Archivé"),
    ]

    ORIGINES = [
        ("interne", "Produit en interne"),
        ("recu", "Reçu de l'extérieur"),
        ("ocr", "Numérisé via OCR"),
        ("genere", "Généré automatiquement"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Identification
    reference = models.CharField(max_length=100, verbose_name="Référence document")
    intitule = models.CharField(max_length=500, verbose_name="Intitulé")
    type_document = models.ForeignKey(
        TypeDocument, on_delete=models.PROTECT,
        related_name="documents", verbose_name="Type",
    )

    # Rattachement
    projet = models.ForeignKey(
        "projets.Projet", on_delete=models.CASCADE,
        related_name="documents", verbose_name="Projet",
    )
    lot = models.ForeignKey(
        "projets.Lot", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="documents", verbose_name="Lot",
    )
    dossier = models.ForeignKey(
        DossierDocumentProjet, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="documents", verbose_name="Dossier GED",
    )

    # Versionnement
    version = models.CharField(max_length=20, default="A", verbose_name="Indice / version")
    est_version_courante = models.BooleanField(default=True, verbose_name="Version courante")
    document_parent = models.ForeignKey(
        "self", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="versions",
        verbose_name="Version précédente",
    )

    # Fichier (stocké dans MinIO via django-storages)
    fichier = models.FileField(
        upload_to="documents/%Y/%m/",
        null=True, blank=True,
        verbose_name="Fichier",
    )
    nom_fichier_origine = models.CharField(max_length=255, blank=True)
    taille_octets = models.PositiveBigIntegerField(null=True, blank=True)
    type_mime = models.CharField(max_length=100, blank=True)
    empreinte_sha256 = models.CharField(max_length=64, blank=True, verbose_name="SHA-256")

    # État
    statut = models.CharField(
        max_length=30, choices=STATUTS, default="brouillon", verbose_name="Statut",
    )
    origine = models.CharField(
        max_length=20, choices=ORIGINES, default="interne", verbose_name="Origine",
    )

    # OCR / traitement automatique
    ocr_effectue = models.BooleanField(default=False, verbose_name="OCR effectué")
    contenu_texte = models.TextField(blank=True, verbose_name="Contenu extrait (OCR)")
    mots_cles = models.JSONField(default=list, blank=True, verbose_name="Mots-clés extraits")
    analyse_automatique_effectuee = models.BooleanField(
        default=False,
        verbose_name="Analyse automatique effectuée",
    )
    date_analyse_automatique = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Date d'analyse automatique",
    )
    analyse_automatique = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="Résultats d'analyse automatique",
    )

    # Traçabilité
    auteur = models.ForeignKey(
        "comptes.Utilisateur", on_delete=models.PROTECT,
        related_name="documents_crees", null=True, blank=True,
        verbose_name="Auteur",
    )
    date_creation = models.DateTimeField(auto_now_add=True)
    date_modification = models.DateTimeField(auto_now=True)
    date_validation = models.DateTimeField(null=True, blank=True)
    valide_par = models.ForeignKey(
        "comptes.Utilisateur", on_delete=models.PROTECT,
        null=True, blank=True, related_name="documents_valides",
        verbose_name="Validé par",
    )

    # Partage et diffusion
    acces_client = models.BooleanField(default=False, verbose_name="Accessible au client")
    acces_partenaire = models.BooleanField(default=False, verbose_name="Accessible au partenaire")
    confidentiel = models.BooleanField(default=False, verbose_name="Confidentiel")

    class Meta:
        db_table = "documents_document"
        verbose_name = "Document"
        verbose_name_plural = "Documents"
        ordering = ["-date_modification"]
        indexes = [
            models.Index(fields=["projet", "statut"]),
            models.Index(fields=["projet", "dossier"]),
            models.Index(fields=["reference"]),
            models.Index(fields=["type_document"]),
        ]

    def __str__(self):
        return f"{self.reference} — {self.intitule[:60]} (v{self.version})"


class AnnotationDocument(models.Model):
    """Annotation ou commentaire sur un document."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    document = models.ForeignKey(
        Document, on_delete=models.CASCADE, related_name="annotations",
    )
    auteur = models.ForeignKey(
        "comptes.Utilisateur", on_delete=models.CASCADE,
    )
    contenu = models.TextField(verbose_name="Contenu de l'annotation")
    page = models.PositiveSmallIntegerField(null=True, blank=True, verbose_name="Page")
    resolue = models.BooleanField(default=False, verbose_name="Résolue")
    date_creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "documents_annotation"
        verbose_name = "Annotation"
        verbose_name_plural = "Annotations"
        ordering = ["document", "date_creation"]

    def __str__(self):
        etat = "résolue" if self.resolue else "ouverte"
        return f"Annotation ({etat}) — {self.document.reference}"


class DiffusionDocument(models.Model):
    """Traçabilité de la diffusion d'un document vers un tiers."""

    document = models.ForeignKey(
        Document, on_delete=models.CASCADE, related_name="diffusions",
    )
    destinataire = models.ForeignKey(
        "organisations.Organisation", on_delete=models.CASCADE,
        verbose_name="Destinataire",
    )
    destinataire_contact = models.CharField(max_length=200, blank=True)
    mode_diffusion = models.CharField(
        max_length=50,
        choices=[
            ("courriel", "Courriel"),
            ("courrier", "Courrier postal"),
            ("plateforme", "Plateforme en ligne"),
            ("main_propre", "Remise en main propre"),
        ],
        default="courriel",
    )
    date_diffusion = models.DateTimeField(auto_now_add=True)
    observations = models.TextField(blank=True)

    class Meta:
        db_table = "documents_diffusion"
        verbose_name = "Diffusion"
        verbose_name_plural = "Diffusions"
        ordering = ["-date_diffusion"]

    def __str__(self):
        return f"{self.document.reference} → {self.destinataire.nom}"
