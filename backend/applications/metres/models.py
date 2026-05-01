"""
Modèles des métrés — Quantitatifs et métrés de travaux.
Plateforme LBH — Bureau d'Études Économiste
"""

import uuid
from decimal import Decimal
from django.db import models


class Metre(models.Model):
    """
    Métré — document de quantification des ouvrages d'un projet.
    Peut être un avant-métré, un métré définitif ou un métré contradictoire.
    """

    TYPES = [
        ("avant_metre", "Avant-métré"),
        ("metre_definitif", "Métré définitif"),
        ("metre_contradictoire", "Métré contradictoire"),
    ]

    STATUTS = [
        ("en_cours", "En cours"),
        ("valide", "Validé"),
        ("archive", "Archivé"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    projet = models.ForeignKey(
        "projets.Projet", on_delete=models.CASCADE,
        related_name="metres", verbose_name="Projet",
    )
    lot = models.ForeignKey(
        "projets.Lot", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="metres", verbose_name="Lot",
    )

    type_metre = models.CharField(
        max_length=40, choices=TYPES, default="avant_metre",
        verbose_name="Type de métré",
    )
    intitule = models.CharField(max_length=300, verbose_name="Intitulé")
    statut = models.CharField(
        max_length=20, choices=STATUTS, default="en_cours",
        verbose_name="Statut",
    )

    date_creation = models.DateTimeField(auto_now_add=True)
    date_modification = models.DateTimeField(auto_now=True)
    cree_par = models.ForeignKey(
        "comptes.Utilisateur", on_delete=models.PROTECT,
        null=True, blank=True, related_name="metres_crees",
    )

    class Meta:
        db_table = "metres_metre"
        verbose_name = "Métré"
        verbose_name_plural = "Métrés"
        ordering = ["-date_modification"]

    def __str__(self):
        return f"{self.intitule} — {self.projet.reference}"

    @property
    def montant_total_ht(self):
        """Somme des montants HT de toutes les lignes."""
        return sum((ligne.montant_ht or 0) for ligne in self.lignes.all())


class LigneMetre(models.Model):
    """
    Ligne d'avant-métré — ouvrage élémentaire avec quantité et unité.
    Les anciens champs de prix restent présents pour compatibilité historique,
    mais le module Métrés n'utilise plus la valorisation financière.
    """

    NATURES = [
        ("travaux", "Travaux"),
        ("fourniture", "Fourniture"),
        ("prestation", "Prestation de service"),
        ("installation_chantier", "Installation de chantier"),
        ("provision", "Provision / réserve"),
    ]
    SOURCES_DESIGNATION = [
        ("cctp", "Article CCTP"),
        ("libre", "Désignation libre"),
        ("importee", "Importée"),
        ("zone_visuelle", "Zone visuelle"),
    ]
    SOURCES = [
        ("manuel", "Manuel"),
        ("formule", "Formule"),
        ("zone_visuelle", "Zone visuelle"),
        ("extraction_vectorielle", "Extraction vectorielle"),
        ("import", "Import"),
    ]
    STATUTS_LIGNE = [
        ("brouillon", "Brouillon"),
        ("calculee", "Calculée"),
        ("verifiee", "Vérifiée"),
        ("validee", "Validée"),
        ("integree_dpgf", "Intégrée DPGF"),
    ]
    STATUTS_SYNCHRONISATION = [
        ("manuel", "Manuel"),
        ("synchronisee", "Synchronisée"),
        ("desynchronisee", "Désynchronisée"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    metre = models.ForeignKey(
        Metre, on_delete=models.CASCADE, related_name="lignes",
    )

    # Position dans le bordereau
    numero_ordre = models.PositiveSmallIntegerField(verbose_name="N° d'ordre")
    code_article = models.CharField(max_length=50, blank=True, verbose_name="Code article")
    article_cctp = models.ForeignKey(
        "pieces_ecrites.ArticleCCTP",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="lignes_metre",
        verbose_name="Article CCTP lié",
    )
    article_cctp_code = models.CharField(max_length=80, blank=True, default="", verbose_name="Code article CCTP")
    article_cctp_libelle = models.CharField(max_length=400, blank=True, default="", verbose_name="Libellé article CCTP")
    chapitre_cctp = models.CharField(max_length=200, blank=True, default="", verbose_name="Chapitre CCTP")
    lot_cctp = models.CharField(max_length=200, blank=True, default="", verbose_name="Lot CCTP")
    designation_source = models.CharField(max_length=20, choices=SOURCES_DESIGNATION, default="libre", verbose_name="Source de désignation")
    article_a_completer = models.BooleanField(default=False, verbose_name="Article CCTP à compléter")
    localisation = models.CharField(max_length=200, blank=True, default="", verbose_name="Localisation (pièce, niveau, bâtiment)")
    niveau = models.CharField(max_length=120, blank=True, default="", verbose_name="Niveau")
    batiment_zone = models.CharField(max_length=160, blank=True, default="", verbose_name="Bâtiment / zone")
    piece = models.CharField(max_length=160, blank=True, default="", verbose_name="Pièce")
    designation = models.TextField(verbose_name="Désignation de l'ouvrage")
    nature = models.CharField(
        max_length=30, choices=NATURES, default="travaux",
        verbose_name="Nature",
    )

    # Quantitatif
    quantite = models.DecimalField(
        max_digits=14, decimal_places=3,
        verbose_name="Quantité",
    )
    unite = models.CharField(max_length=20, verbose_name="Unité")

    # Détail du métré (formule de calcul)
    detail_calcul = models.TextField(
        blank=True,
        verbose_name="Détail du métré (longueur × largeur × hauteur…)",
    )

    # Prix
    prix_unitaire_ht = models.DecimalField(
        max_digits=12, decimal_places=4,
        null=True, blank=True,
        verbose_name="Prix unitaire HT (€)",
    )

    # Lien optionnel vers la bibliothèque de prix
    ligne_bibliotheque = models.ForeignKey(
        "bibliotheque.LignePrixBibliotheque", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="lignes_metre",
        verbose_name="Référence bibliothèque",
    )
    source_type = models.CharField(max_length=30, choices=SOURCES, default="manuel", verbose_name="Source de la ligne")
    source_fond_plan = models.ForeignKey(
        "metres.FondPlan",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="lignes_metre_sources",
        verbose_name="Fond de plan source",
    )
    source_zone_mesure = models.ForeignKey(
        "metres.ZoneMesure",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="lignes_metre_sources",
        verbose_name="Zone mesurée source",
    )
    statut_ligne = models.CharField(max_length=20, choices=STATUTS_LIGNE, default="brouillon", verbose_name="Statut de ligne")
    statut_synchronisation = models.CharField(max_length=20, choices=STATUTS_SYNCHRONISATION, default="manuel", verbose_name="Synchronisation zone")
    date_derniere_synchronisation = models.DateTimeField(null=True, blank=True)
    quantite_modifiee_manuellement = models.BooleanField(default=False)
    ordre_dpgf = models.PositiveIntegerField(null=True, blank=True)
    inclure_dpgf = models.BooleanField(default=True, verbose_name="Inclure dans la DPGF")

    observations = models.TextField(blank=True)

    class Meta:
        db_table = "metres_ligne"
        verbose_name = "Ligne de métré"
        verbose_name_plural = "Lignes de métré"
        ordering = ["metre", "numero_ordre"]
        unique_together = [("metre", "numero_ordre")]

    def __str__(self):
        return f"{self.numero_ordre:03d} — {self.designation[:60]}"

    @property
    def montant_ht(self):
        if self.prix_unitaire_ht is not None:
            return self.quantite * self.prix_unitaire_ht
        return None

    def save(self, *args, **kwargs):
        if self.article_cctp_id:
            self.designation_source = "cctp"
            self.article_cctp_code = self.article_cctp.code_reference or self.article_cctp.numero_article
            self.article_cctp_libelle = self.article_cctp.intitule
            self.chapitre_cctp = self.article_cctp.chapitre or self.chapitre_cctp
            self.lot_cctp = getattr(self.article_cctp.lot, "intitule", "") or self.lot_cctp
            self.article_a_completer = self.article_cctp.statut == "a_completer"
            if not self.code_article:
                self.code_article = self.article_cctp_code
        super().save(*args, **kwargs)


class FondPlan(models.Model):
    """
    Fond de plan téléversé pour le métré visuel.
    Peut être un PDF (page de plan), une image (JPG/PNG) ou un DXF vectoriel.
    """

    FORMATS = [
        ("pdf",   "PDF — plan numérique"),
        ("image", "Image — JPG, PNG, TIFF"),
        ("dxf",   "DXF — plan vectoriel CAO"),
    ]
    STATUTS_TRAITEMENT = [
        ("televerse", "Téléversé"),
        ("rendu_en_cours", "Rendu en cours"),
        ("pret", "Prêt"),
        ("erreur", "Erreur"),
    ]
    STATUTS_CALIBRATION = [
        ("non_calibre", "Non calibré"),
        ("calibre", "Calibré"),
        ("calibration_a_verifier", "Calibration à vérifier"),
    ]
    STATUTS_VECTORISATION = [
        ("non_vectorise", "Non vectorisé"),
        ("en_cours", "En cours"),
        ("vectorise", "Vectorisé"),
        ("erreur", "Erreur"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    metre = models.ForeignKey(
        Metre, on_delete=models.CASCADE,
        related_name="fonds_plan", verbose_name="Métré associé",
    )
    intitule = models.CharField(max_length=200, blank=True, verbose_name="Intitulé du plan (ex: Niveau 0, Façade Sud)")
    format_fichier = models.CharField(max_length=10, choices=FORMATS, verbose_name="Format")
    fichier = models.FileField(
        upload_to="metres/fonds-plan/%Y/%m/",
        verbose_name="Fichier du fond de plan",
    )

    # Calibration (échelle)
    echelle = models.DecimalField(
        max_digits=10, decimal_places=6, null=True, blank=True,
        verbose_name="Échelle (px par mètre)",
        help_text="Calculée automatiquement lors de la calibration depuis le fond de plan",
    )
    reference_calibration = models.JSONField(
        default=dict, blank=True,
        verbose_name="Points de calibration",
        help_text="{point_a: [x,y], point_b: [x,y], distance_metres: float}",
    )
    statut_traitement = models.CharField(max_length=30, choices=STATUTS_TRAITEMENT, default="televerse")
    statut_calibration = models.CharField(max_length=30, choices=STATUTS_CALIBRATION, default="non_calibre")
    statut_vectorisation = models.CharField(max_length=30, choices=STATUTS_VECTORISATION, default="non_vectorise")
    message_traitement = models.TextField(blank=True, default="")
    message_vectorisation = models.TextField(blank=True, default="")

    # Pour les PDFs multipages
    numero_page = models.PositiveSmallIntegerField(default=1, verbose_name="Page du PDF")
    page_pdf_total = models.PositiveSmallIntegerField(default=1)
    rotation = models.PositiveSmallIntegerField(default=0)
    echelle_x = models.DecimalField(max_digits=12, decimal_places=6, null=True, blank=True)
    echelle_y = models.DecimalField(max_digits=12, decimal_places=6, null=True, blank=True)
    unite_plan = models.CharField(max_length=20, blank=True, default="m")
    transformation_coordonnees = models.JSONField(default=dict, blank=True)
    largeur_px = models.PositiveIntegerField(null=True, blank=True)
    hauteur_px = models.PositiveIntegerField(null=True, blank=True)

    # Aperçu basse résolution (~800px) — chargé en premier pour affichage immédiat
    apercu = models.FileField(
        upload_to="metres/apercus/%Y/%m/",
        null=True, blank=True, verbose_name="Aperçu rapide (PNG 800px)",
    )
    # Image haute résolution (~4960px) — chargée en arrière-plan pour le zoom
    miniature = models.FileField(
        upload_to="metres/miniatures/%Y/%m/",
        null=True, blank=True, verbose_name="Miniature HD (PNG)",
    )

    date_creation = models.DateTimeField(auto_now_add=True)
    cree_par = models.ForeignKey(
        "comptes.Utilisateur", on_delete=models.SET_NULL,
        null=True, blank=True,
    )

    class Meta:
        db_table = "metres_fond_plan"
        verbose_name = "Fond de plan"
        verbose_name_plural = "Fonds de plan"
        ordering = ["metre", "intitule"]

    def __str__(self):
        return f"{self.intitule} — {self.metre}"


class ZoneMesure(models.Model):
    """
    Zone mesurée visuellement sur un fond de plan.
    Peut être une surface (polygone), une longueur (polyligne) ou un comptage (point).
    Génère automatiquement une ligne de métré.
    """

    TYPES = [
        ("surface",  "Surface — polygone fermé"),
        ("longueur", "Longueur — polyligne"),
        ("comptage", "Comptage — point / objet"),
        ("perimetre", "Périmètre — contour d'une zone"),
    ]
    STATUTS_CALCUL = [
        ("brouillon", "Brouillon"),
        ("calculee", "Calculée"),
        ("erreur", "Erreur"),
    ]
    STATUTS_CONVERSION = [
        ("non_convertie", "Non convertie"),
        ("convertie", "Convertie"),
        ("desynchronisee", "Désynchronisée"),
        ("synchronisee", "Synchronisée"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    fond_plan = models.ForeignKey(
        FondPlan, on_delete=models.CASCADE,
        related_name="zones", verbose_name="Fond de plan",
    )
    zone_parente = models.ForeignKey(
        "self", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="sous_zones",
        verbose_name="Zone parente (hiérarchie)",
    )
    numero = models.CharField(
        max_length=20, blank=True, default="", verbose_name="Numéro de zone (ex: 1, 1.1, 1.2)",
    )
    ligne_metre = models.OneToOneField(
        LigneMetre, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="zone_mesure",
        verbose_name="Ligne de métré associée",
    )

    localisation = models.CharField(max_length=200, blank=True, default="", verbose_name="Localisation (pièce, niveau, bâtiment)")
    localisation_structuree = models.JSONField(default=dict, blank=True, verbose_name="Localisation structurée")
    designation = models.CharField(max_length=300, verbose_name="Désignation de la zone")
    article_cctp = models.ForeignKey(
        "pieces_ecrites.ArticleCCTP",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="zones_mesure",
        verbose_name="Article CCTP lié",
    )
    source_article_cctp = models.CharField(max_length=20, choices=LigneMetre.SOURCES_DESIGNATION, default="zone_visuelle")
    code_article = models.CharField(max_length=80, blank=True, default="")
    chapitre_cctp = models.CharField(max_length=200, blank=True, default="")
    lot_cctp = models.CharField(max_length=200, blank=True, default="")
    type_mesure = models.CharField(max_length=20, choices=TYPES, verbose_name="Type de mesure")

    # Géométrie en coordonnées pixel (JSON)
    points_px = models.JSONField(
        default=list,
        verbose_name="Points de la géométrie (px)",
        help_text="Liste de [x, y] en pixels sur le fond de plan",
    )

    # Déductions (ouvertures, réservations)
    deductions = models.JSONField(
        default=list, blank=True,
        verbose_name="Déductions",
        help_text="Liste de zones à soustraire : [{designation, points_px, surface_m2}]",
    )

    # Hauteur optionnelle — pour longueur × hauteur → surface (m²)
    hauteur = models.DecimalField(
        max_digits=8, decimal_places=3, null=True, blank=True,
        verbose_name="Hauteur (m)",
        help_text="Si renseignée, longueur × hauteur → surface en m²",
    )

    # Résultat calculé
    valeur_brute = models.DecimalField(
        max_digits=14, decimal_places=4, null=True, blank=True,
        verbose_name="Valeur brute (m², ml ou unité)",
    )
    valeur_deduction = models.DecimalField(
        max_digits=14, decimal_places=4, null=True, blank=True,
        verbose_name="Total des déductions",
    )
    valeur_nette = models.DecimalField(
        max_digits=14, decimal_places=4, null=True, blank=True,
        verbose_name="Valeur nette (après déductions)",
    )
    unite = models.CharField(max_length=10, default="m²")

    couleur = models.CharField(max_length=7, default="#3b82f6", verbose_name="Couleur d'affichage (#hex)")
    ordre = models.PositiveSmallIntegerField(default=0)
    statut_calcul = models.CharField(max_length=20, choices=STATUTS_CALCUL, default="brouillon")
    statut_conversion = models.CharField(max_length=20, choices=STATUTS_CONVERSION, default="non_convertie")
    statut_synchronisation = models.CharField(max_length=20, choices=STATUTS_CONVERSION, default="non_convertie")
    date_dernier_calcul = models.DateTimeField(null=True, blank=True)
    date_derniere_conversion = models.DateTimeField(null=True, blank=True)
    message_erreur_calcul = models.TextField(blank=True, default="")
    geometrie_modifiee_depuis_conversion = models.BooleanField(default=False)
    date_modification = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "metres_zone_mesure"
        verbose_name = "Zone mesurée"
        verbose_name_plural = "Zones mesurées"
        ordering = ["fond_plan", "ordre"]

    def __str__(self):
        return f"{self.type_mesure} — {self.designation[:60]}"

    def save(self, *args, **kwargs):
        if self.pk and self.ligne_metre_id:
            try:
                ancienne = ZoneMesure.objects.get(pk=self.pk)
                champs_geometrie = (
                    ancienne.points_px != self.points_px
                    or ancienne.deductions != self.deductions
                    or ancienne.hauteur != self.hauteur
                )
                if champs_geometrie:
                    self.geometrie_modifiee_depuis_conversion = True
                    self.statut_conversion = "desynchronisee"
                    self.statut_synchronisation = "desynchronisee"
                    LigneMetre.objects.filter(pk=self.ligne_metre_id).update(
                        statut_synchronisation="desynchronisee",
                    )
            except ZoneMesure.DoesNotExist:
                pass
        if self.article_cctp_id:
            self.code_article = self.article_cctp.code_reference or self.article_cctp.numero_article
            self.chapitre_cctp = self.article_cctp.chapitre or self.chapitre_cctp
            self.lot_cctp = getattr(self.article_cctp.lot, "intitule", "") or self.lot_cctp
        super().save(*args, **kwargs)


class GeometrieFondPlan(models.Model):
    """Géométrie unifiée extraite d'un fond de plan pour l'accroche objet."""

    TYPES_SOURCE = [
        ("dxf", "DXF/DWG"),
        ("pdf_vectoriel", "PDF vectoriel"),
        ("raster_vectorise", "Raster vectorisé"),
    ]
    STATUTS = [
        ("en_attente", "En attente"),
        ("en_cours", "En cours"),
        ("disponible", "Disponible"),
        ("erreur", "Erreur"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    fond_plan = models.ForeignKey(FondPlan, on_delete=models.CASCADE, related_name="geometries")
    page = models.PositiveSmallIntegerField(default=1)
    type_source = models.CharField(max_length=30, choices=TYPES_SOURCE)
    statut = models.CharField(max_length=20, choices=STATUTS, default="en_attente")
    donnees_geojson = models.JSONField(default=dict, blank=True)
    segments = models.JSONField(default=list, blank=True)
    contours = models.JSONField(default=list, blank=True)
    points_accroche = models.JSONField(default=list, blank=True)
    calques = models.JSONField(default=list, blank=True)
    statistiques = models.JSONField(default=dict, blank=True)
    message_erreur = models.TextField(blank=True, default="")
    date_generation = models.DateTimeField(null=True, blank=True)
    date_modification = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "metres_geometrie_fond_plan"
        verbose_name = "Géométrie de fond de plan"
        verbose_name_plural = "Géométries de fonds de plan"
        ordering = ["fond_plan", "page", "-date_generation"]


class DPGFQuantitative(models.Model):
    """DPGF quantitative issue d'un avant-métré, sans prix."""

    STATUTS = [
        ("brouillon", "Brouillon"),
        ("generee", "Générée"),
        ("transmise_economie", "Transmise à l'économie"),
        ("archivee", "Archivée"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    projet = models.ForeignKey("projets.Projet", on_delete=models.CASCADE, related_name="dpgf_quantitatives")
    metre_source = models.ForeignKey(Metre, on_delete=models.PROTECT, related_name="dpgf_quantitatives")
    intitule = models.CharField(max_length=300)
    statut = models.CharField(max_length=30, choices=STATUTS, default="generee")
    date_creation = models.DateTimeField(auto_now_add=True)
    date_modification = models.DateTimeField(auto_now=True)
    cree_par = models.ForeignKey("comptes.Utilisateur", on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        db_table = "metres_dpgf_quantitative"
        verbose_name = "DPGF quantitative"
        verbose_name_plural = "DPGF quantitatives"
        ordering = ["-date_modification"]

    def __str__(self):
        return f"{self.intitule} — {self.projet.reference}"


class LigneDPGFQuantitative(models.Model):
    """Ligne de DPGF quantitative sans prix unitaire ni montant."""

    STATUTS = [
        ("brouillon", "Brouillon"),
        ("validee", "Validée"),
        ("a_completer", "À compléter"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    dpgf = models.ForeignKey(DPGFQuantitative, on_delete=models.CASCADE, related_name="lignes")
    ligne_metre_source = models.ForeignKey(LigneMetre, on_delete=models.SET_NULL, null=True, blank=True, related_name="lignes_dpgf_quantitative")
    zone_mesure_source = models.ForeignKey(ZoneMesure, on_delete=models.SET_NULL, null=True, blank=True, related_name="lignes_dpgf_quantitative")
    article_cctp = models.ForeignKey("pieces_ecrites.ArticleCCTP", on_delete=models.SET_NULL, null=True, blank=True, related_name="lignes_dpgf_quantitative")
    lot = models.CharField(max_length=200, blank=True, default="")
    chapitre = models.CharField(max_length=200, blank=True, default="")
    code_article = models.CharField(max_length=80, blank=True, default="")
    designation = models.TextField()
    localisation = models.CharField(max_length=240, blank=True, default="")
    quantite = models.DecimalField(max_digits=14, decimal_places=3, default=Decimal("0.000"))
    unite = models.CharField(max_length=30, blank=True, default="")
    ordre = models.PositiveIntegerField(default=0)
    observations = models.TextField(blank=True, default="")
    statut = models.CharField(max_length=20, choices=STATUTS, default="brouillon")
    date_creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "metres_ligne_dpgf_quantitative"
        verbose_name = "Ligne DPGF quantitative"
        verbose_name_plural = "Lignes DPGF quantitatives"
        ordering = ["dpgf", "ordre"]


class ExtractionCAO(models.Model):
    """
    Résultat de l'extraction automatique depuis un fichier DXF/DWG.
    Propose des lignes de métré à partir des calques et géométries du plan.
    """

    STATUTS = [
        ("en_attente",   "En attente de traitement"),
        ("en_cours",     "Extraction en cours"),
        ("propose",      "Propositions disponibles"),
        ("valide",       "Propositions validées"),
        ("erreur",       "Erreur lors de l'extraction"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    metre = models.ForeignKey(Metre, on_delete=models.CASCADE, related_name="extractions_cao")
    fond_plan = models.ForeignKey(FondPlan, on_delete=models.SET_NULL, null=True, blank=True)
    statut = models.CharField(max_length=20, choices=STATUTS, default="en_attente")

    # Résultats bruts du service analyse-cao
    resultat_brut = models.JSONField(default=dict, blank=True, verbose_name="Résultat brut du service CAO")

    # Propositions de lignes de métré
    propositions = models.JSONField(
        default=list, blank=True,
        verbose_name="Lignes de métré proposées",
        help_text="[{designation, quantite, unite, calque, surface_m2, longueur_m}]",
    )

    # Statistiques
    nb_calques = models.PositiveIntegerField(default=0)
    nb_entites = models.PositiveIntegerField(default=0)
    nb_propositions = models.PositiveIntegerField(default=0)

    message_erreur = models.TextField(blank=True)
    date_extraction = models.DateTimeField(null=True, blank=True)
    date_creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "metres_extraction_cao"
        verbose_name = "Extraction CAO"
        ordering = ["-date_creation"]
