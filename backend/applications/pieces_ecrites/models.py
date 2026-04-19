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

    # Lot CCTP de référence (pour les articles de bibliothèque)
    lot = models.ForeignKey(
        "LotCCTP", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="articles",
        verbose_name="Lot CCTP",
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

    STATUTS = [
        ("brouillon", "Brouillon"),
        ("a_completer", "À compléter — créé depuis le métré"),
        ("valide", "Validé — article complet"),
    ]
    statut = models.CharField(
        max_length=20, choices=STATUTS, default="brouillon",
        verbose_name="Statut de complétion",
        db_index=True,
    )

    date_creation = models.DateTimeField(auto_now_add=True)
    date_modification = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "pieces_ecrites_article_cctp"
        verbose_name = "Article CCTP"
        verbose_name_plural = "Articles CCTP"
        ordering = ["chapitre", "numero_article"]

    def __str__(self):
        return f"{self.numero_article} — {self.intitule[:80]}"


class LotCCTP(models.Model):
    """
    Lot de travaux pour un CCTP — correspond aux 18 lots types BTP.
    Pré-alimenté depuis les descriptifs CCTP (Widloecher & Cusant 3e éd.)
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=20, unique=True, db_index=True, verbose_name="Code lot")
    intitule = models.CharField(max_length=200, verbose_name="Intitulé")
    description = models.TextField(blank=True, verbose_name="Description")
    normes_principales = models.JSONField(default=list, blank=True, verbose_name="Normes et DTU principaux")
    est_actif = models.BooleanField(default=True)
    ordre = models.PositiveSmallIntegerField(default=0)

    class Meta:
        db_table = "pieces_ecrites_lot_cctp"
        verbose_name = "Lot CCTP"
        verbose_name_plural = "Lots CCTP"
        ordering = ["ordre", "code"]

    def __str__(self):
        return f"{self.code} — {self.intitule}"


class ChapitrePrescrip(models.Model):
    """Chapitre de prescription à l'intérieur d'un lot CCTP."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    lot = models.ForeignKey(LotCCTP, on_delete=models.CASCADE, related_name="chapitres")
    numero = models.CharField(max_length=20, verbose_name="Numéro (ex: 1, 1.1, A)")
    intitule = models.CharField(max_length=300, verbose_name="Intitulé du chapitre")
    ordre = models.PositiveSmallIntegerField(default=0)

    class Meta:
        db_table = "pieces_ecrites_chapitre_prescrip"
        verbose_name = "Chapitre de prescription"
        ordering = ["lot", "ordre", "numero"]

    def __str__(self):
        return f"{self.lot.code} / {self.numero} — {self.intitule}"


class PrescriptionCCTP(models.Model):
    """
    Prescription technique réutilisable pour un CCTP.
    Pré-alimentée depuis les descriptifs CCTP (Widloecher & Cusant 3e éd.)
    et les guides techniques CSTB, DTU, Eurocodes.
    """

    NIVEAUX = [
        ("obligatoire",  "Obligatoire — imposé par la norme ou le DTU"),
        ("recommande",   "Recommandé — bonne pratique"),
        ("alternatif",   "Alternatif — variante acceptable"),
        ("optionnel",    "Optionnel — à adapter selon le projet"),
    ]

    TYPES = [
        ("generalites",          "Généralités et objet du lot"),
        ("documents_reference",  "Documents de référence (DTU, NF, Eurocode)"),
        ("materiaux",            "Qualité et provenance des matériaux"),
        ("mise_en_oeuvre",       "Mise en œuvre et exécution"),
        ("controles",            "Contrôles et essais"),
        ("tolerances",           "Tolérances d'exécution"),
        ("garanties",            "Garanties et assurances"),
        ("interfaces",           "Interfaces avec les autres lots"),
        ("reception",            "Conditions de réception"),
        ("entretien",            "Entretien et maintenance"),
        ("securite",             "Sécurité et protection"),
        ("environnement",        "Environnement et gestion des déchets"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    chapitre = models.ForeignKey(
        ChapitrePrescrip, on_delete=models.CASCADE,
        related_name="prescriptions", verbose_name="Chapitre",
    )
    lot = models.ForeignKey(
        LotCCTP, on_delete=models.CASCADE,
        related_name="prescriptions", verbose_name="Lot",
    )

    code = models.CharField(max_length=30, blank=True, verbose_name="Code")
    intitule = models.CharField(max_length=400, verbose_name="Intitulé")
    corps = models.TextField(verbose_name="Corps de la prescription")

    type_prescription = models.CharField(
        max_length=30, choices=TYPES, default="mise_en_oeuvre",
        verbose_name="Type",
    )
    niveau = models.CharField(
        max_length=20, choices=NIVEAUX, default="recommande",
        verbose_name="Niveau",
    )

    normes = models.JSONField(default=list, blank=True, verbose_name="Normes citées (DTU, NF, Eurocode)")
    tags = models.JSONField(default=list, blank=True, verbose_name="Mots-clés")
    source = models.CharField(max_length=200, blank=True, verbose_name="Source")

    contient_variables = models.BooleanField(
        default=False,
        verbose_name="Contient des variables",
        help_text="Cocher si le texte contient des variables entre accolades {variable}",
    )

    est_actif = models.BooleanField(default=True)
    ordre = models.PositiveSmallIntegerField(default=0)
    date_creation = models.DateTimeField(auto_now_add=True)
    date_modification = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "pieces_ecrites_prescription_cctp"
        verbose_name = "Prescription CCTP"
        verbose_name_plural = "Prescriptions CCTP"
        ordering = ["lot", "chapitre", "ordre"]

    def __str__(self):
        return f"[{self.lot.code}] {self.intitule[:80]}"


class LigneDPGF(models.Model):
    """
    Ligne d'un DPGF, BPU ou DQE — modèle structuré avec quantité et prix.
    Permet la saisie ligne par ligne depuis l'interface web.
    """

    TYPES = [
        ("lot",         "En-tête de lot"),
        ("article",     "Article / Prestation"),
        ("sous_total",  "Sous-total de chapitre"),
        ("commentaire", "Commentaire / Note"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    piece_ecrite = models.ForeignKey(
        PieceEcrite, on_delete=models.CASCADE,
        related_name="lignes_dpgf", verbose_name="Pièce écrite",
    )
    ordre = models.PositiveIntegerField(default=0, verbose_name="Ordre")
    type_ligne = models.CharField(
        max_length=20, choices=TYPES, default="article",
        verbose_name="Type de ligne",
    )

    # Regroupement lot
    lot_code = models.CharField(max_length=20, blank=True, verbose_name="Code lot")
    lot_intitule = models.CharField(max_length=200, blank=True, verbose_name="Intitulé lot")

    # Données de la ligne
    numero = models.CharField(max_length=30, blank=True, verbose_name="Numéro")
    designation = models.CharField(max_length=500, verbose_name="Désignation")
    unite = models.CharField(max_length=30, blank=True, verbose_name="Unité")
    quantite = models.DecimalField(
        max_digits=14, decimal_places=4,
        null=True, blank=True, verbose_name="Quantité",
    )
    prix_unitaire_ht = models.DecimalField(
        max_digits=14, decimal_places=2,
        null=True, blank=True, verbose_name="Prix unitaire HT (€)",
    )

    date_creation = models.DateTimeField(auto_now_add=True)
    date_modification = models.DateTimeField(auto_now=True)

    @property
    def montant_ht(self):
        if self.quantite is not None and self.prix_unitaire_ht is not None:
            return float(self.quantite) * float(self.prix_unitaire_ht)
        return None

    class Meta:
        db_table = "pieces_ecrites_ligne_dpgf"
        verbose_name = "Ligne DPGF/DQE"
        verbose_name_plural = "Lignes DPGF/DQE"
        ordering = ["piece_ecrite", "ordre"]

    def __str__(self):
        return f"{self.numero} — {self.designation[:80]}"


class GenerateurCCTP(models.Model):
    """
    Session de génération d'un CCTP multi-lots à partir de la bibliothèque.
    Associée à un projet, elle permet de sélectionner les lots et prescriptions
    à inclure, puis de générer le document Word final.
    """

    STATUTS = [
        ("configuration", "Configuration — sélection des lots"),
        ("redaction",     "Rédaction — personnalisation des prescriptions"),
        ("generation",    "Génération en cours"),
        ("termine",       "Terminé — document disponible"),
        ("erreur",        "Erreur lors de la génération"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    projet = models.ForeignKey(
        "projets.Projet", on_delete=models.CASCADE,
        related_name="generateurs_cctp", verbose_name="Projet",
    )
    intitule = models.CharField(max_length=300, verbose_name="Intitulé du CCTP")
    statut = models.CharField(max_length=20, choices=STATUTS, default="configuration")

    # Configuration
    lots_selectionnes = models.ManyToManyField(
        LotCCTP, related_name="generateurs",
        blank=True, verbose_name="Lots inclus",
    )
    prescriptions_exclues = models.ManyToManyField(
        PrescriptionCCTP, related_name="generateurs_exclus",
        blank=True, verbose_name="Prescriptions exclues",
    )
    prescriptions_personnalisees = models.JSONField(
        default=dict, blank=True,
        verbose_name="Corps personnalisés par prescription",
        help_text="Dictionnaire {uuid_prescription: texte_personnalisé}",
    )
    variables_fusion = models.JSONField(
        default=dict, blank=True,
        verbose_name="Variables de fusion",
        help_text="{nom_projet, maitre_ouvrage, phase, date_redaction, ...}",
    )

    # Résultat
    piece_ecrite = models.ForeignKey(
        PieceEcrite, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="generateurs_cctp",
        verbose_name="Pièce écrite générée",
    )

    cree_par = models.ForeignKey(
        "comptes.Utilisateur", on_delete=models.PROTECT,
        null=True, blank=True, verbose_name="Créé par",
    )
    date_creation = models.DateTimeField(auto_now_add=True)
    date_modification = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "pieces_ecrites_generateur_cctp"
        verbose_name = "Générateur CCTP"
        verbose_name_plural = "Générateurs CCTP"
        ordering = ["-date_modification"]

    def __str__(self):
        return f"CCTP {self.intitule} — {self.projet.reference}"
