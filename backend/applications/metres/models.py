"""
Modèles des métrés — Quantitatifs et métrés de travaux.
Plateforme LBH — Bureau d'Études Économiste
"""

import uuid
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
    Ligne d'un métré — ouvrage élémentaire avec quantité et prix unitaire.
    """

    NATURES = [
        ("travaux", "Travaux"),
        ("fourniture", "Fourniture"),
        ("prestation", "Prestation de service"),
        ("installation_chantier", "Installation de chantier"),
        ("provision", "Provision / réserve"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    metre = models.ForeignKey(
        Metre, on_delete=models.CASCADE, related_name="lignes",
    )

    # Position dans le bordereau
    numero_ordre = models.PositiveSmallIntegerField(verbose_name="N° d'ordre")
    code_article = models.CharField(max_length=50, blank=True, verbose_name="Code article")
    localisation = models.CharField(max_length=200, blank=True, default="", verbose_name="Localisation (pièce, niveau, bâtiment)")
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

    # Pour les PDFs multipages
    numero_page = models.PositiveSmallIntegerField(default=1, verbose_name="Page du PDF")
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
    designation = models.CharField(max_length=300, verbose_name="Désignation de la zone")
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
    date_modification = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "metres_zone_mesure"
        verbose_name = "Zone mesurée"
        verbose_name_plural = "Zones mesurées"
        ordering = ["fond_plan", "ordre"]

    def __str__(self):
        return f"{self.type_mesure} — {self.designation[:60]}"


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
