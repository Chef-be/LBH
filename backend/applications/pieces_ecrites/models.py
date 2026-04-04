"""
Modèles des pièces écrites — CCTP, DPGF, BPU, RC, etc.
Plateforme LBH — Bureau d'Études Économiste
"""

import uuid
from django.db import models


class ModeleDocument(models.Model):
    """
    Modèle de document réutilisable (gabarit Word/ODT avec variables de fusion).
    Permet la génération automatique des pièces écrites.
    """

    TYPES = [
        ("cctp", "CCTP — Cahier des Clauses Techniques Particulières"),
        ("dpgf", "DPGF — Décomposition du Prix Global et Forfaitaire"),
        ("bpu", "BPU — Bordereau des Prix Unitaires"),
        ("dqe", "DQE — Détail Quantitatif Estimatif"),
        ("rc", "RC — Règlement de Consultation"),
        ("ae", "AE — Acte d'Engagement"),
        ("ccap", "CCAP — Cahier des Clauses Administratives Particulières"),
        ("lettre_candidature", "Lettre de candidature"),
        ("memoire_technique", "Mémoire technique"),
        ("planning_taches", "Planning de tâches"),
        ("rapport_analyse", "Rapport d'analyse"),
        ("rapport", "Rapport technique"),
        ("note_calcul", "Note de calcul"),
        ("autre", "Autre pièce écrite"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=50, unique=True, verbose_name="Code")
    libelle = models.CharField(max_length=200, verbose_name="Libellé")
    type_document = models.CharField(
        max_length=20, choices=TYPES, verbose_name="Type",
    )
    description = models.TextField(blank=True)

    # Fichier gabarit (stocké dans MinIO)
    gabarit = models.FileField(
        upload_to="gabarits/",
        null=True, blank=True,
        verbose_name="Fichier gabarit",
    )
    variables_fusion = models.JSONField(
        default=list, blank=True,
        verbose_name="Variables de fusion disponibles",
        help_text="Liste des variables {nom, description, exemple}",
    )
    contenu_modele_html = models.TextField(
        blank=True,
        verbose_name="Contenu visuel du modèle",
        help_text="Contenu HTML rédigé dans l'éditeur visuel et utilisé pour générer la pièce.",
    )

    est_actif = models.BooleanField(default=True)
    date_creation = models.DateTimeField(auto_now_add=True)
    date_modification = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "pieces_ecrites_modele"
        verbose_name = "Modèle de document"
        verbose_name_plural = "Modèles de documents"
        ordering = ["type_document", "libelle"]

    def __str__(self):
        return f"{self.code} — {self.libelle}"


class PieceEcrite(models.Model):
    """
    Pièce écrite générée pour un projet — instance d'un modèle.
    """

    STATUTS = [
        ("brouillon", "Brouillon"),
        ("en_relecture", "En relecture"),
        ("valide", "Validée"),
        ("diffuse", "Diffusée"),
        ("archive", "Archivée"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    projet = models.ForeignKey(
        "projets.Projet", on_delete=models.CASCADE,
        related_name="pieces_ecrites", verbose_name="Projet",
    )
    lot = models.ForeignKey(
        "projets.Lot", on_delete=models.SET_NULL,
        null=True, blank=True, verbose_name="Lot",
    )
    modele = models.ForeignKey(
        ModeleDocument, on_delete=models.PROTECT,
        related_name="instances", verbose_name="Modèle",
    )

    intitule = models.CharField(max_length=500, verbose_name="Intitulé")
    statut = models.CharField(
        max_length=20, choices=STATUTS, default="brouillon",
        verbose_name="Statut",
    )

    # Contenu (éditable en ligne ou importé)
    contenu_html = models.TextField(blank=True, verbose_name="Contenu (HTML/Markdown)")
    variables_personnalisees = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="Variables de fusion personnalisées",
    )

    # Fichier généré
    fichier_genere = models.FileField(
        upload_to="pieces_ecrites/%Y/%m/",
        null=True, blank=True,
        verbose_name="Fichier généré",
    )
    document_ged = models.ForeignKey(
        "documents.Document", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="pieces_ecrites_sources",
        verbose_name="Document GED lié",
    )
    date_generation = models.DateTimeField(null=True, blank=True)

    # Traçabilité
    redacteur = models.ForeignKey(
        "comptes.Utilisateur", on_delete=models.PROTECT,
        null=True, blank=True, related_name="pieces_ecrites_redigees",
        verbose_name="Rédacteur",
    )
    date_creation = models.DateTimeField(auto_now_add=True)
    date_modification = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "pieces_ecrites_piece"
        verbose_name = "Pièce écrite"
        verbose_name_plural = "Pièces écrites"
        ordering = ["-date_modification"]

    def __str__(self):
        return f"{self.intitule} — {self.projet.reference}"


class ArticleCCTP(models.Model):
    """
    Article d'un CCTP — description technique d'un ouvrage ou d'une prestation.
    Réutilisable entre projets via la bibliothèque d'articles.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Rattachement à une pièce écrite (optionnel pour la bibliothèque)
    piece_ecrite = models.ForeignKey(
        PieceEcrite, on_delete=models.CASCADE,
        null=True, blank=True, related_name="articles",
        verbose_name="Pièce écrite",
    )

    # Classification
    chapitre = models.CharField(max_length=200, blank=True, verbose_name="Chapitre")
    numero_article = models.CharField(max_length=20, verbose_name="Numéro d'article")
    code_reference = models.CharField(max_length=50, blank=True, verbose_name="Code de référence")
    intitule = models.CharField(max_length=300, verbose_name="Intitulé")
    corps_article = models.TextField(verbose_name="Corps de l'article")
    source = models.CharField(max_length=200, blank=True, verbose_name="Source")
    source_url = models.URLField(blank=True, verbose_name="URL source")
    ligne_prix_reference = models.ForeignKey(
        "bibliotheque.LignePrixBibliotheque", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="articles_cctp",
        verbose_name="Ligne de prix de référence",
    )

    # Normes et références
    normes_applicables = models.JSONField(
        default=list, blank=True,
        verbose_name="Normes applicables",
    )

    # Réutilisabilité
    est_dans_bibliotheque = models.BooleanField(
        default=False, verbose_name="Disponible dans la bibliothèque",
    )
    tags = models.JSONField(default=list, blank=True, verbose_name="Tags")

    date_creation = models.DateTimeField(auto_now_add=True)
    date_modification = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "pieces_ecrites_article_cctp"
        verbose_name = "Article CCTP"
        verbose_name_plural = "Articles CCTP"
        ordering = ["chapitre", "numero_article"]

    def __str__(self):
        return f"{self.numero_article} — {self.intitule[:80]}"
