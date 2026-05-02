"""Modèles pour la capitalisation des prix marché et des estimations."""

import uuid

from django.db import models
from django.utils import timezone


# ---------------------------------------------------------------------------
# Indices de révision BT/TP
# ---------------------------------------------------------------------------


class IndiceRevisionPrix(models.Model):
    """
    Historique des indices BT (bâtiment) et TP (travaux publics) publiés par l'INSEE.
    Utilisé pour l'actualisation automatique des prix de devis.
    Formule : P_actuel = P_original × (indice_actuel / indice_date_devis)
    """

    CODE_CHOICES = [
        # Indices Mayotte (IEDOM — source hors INSEE SDMX)
        ("BTM", "BTM — Bâtiment Mayotte"),
        ("TPM", "TPM — Travaux Publics Mayotte"),
        # Indices Bâtiment — base 2010 (INSEE)
        ("BT01",  "BT01 — Tous corps d'état"),
        ("BT02",  "BT02 — Terrassements"),
        ("BT03",  "BT03 — Maçonnerie et canalisations béton"),
        ("BT06",  "BT06 — Ossature, ouvrages en béton armé"),
        ("BT07",  "BT07 — Ossature et charpentes métalliques"),
        ("BT08",  "BT08 — Plâtre et préfabriqués"),
        ("BT09",  "BT09 — Carrelage et revêtement céramique"),
        ("BT10",  "BT10 — Revêtements plastiques"),
        ("BT16b", "BT16b — Charpente bois"),
        ("BT18a", "BT18a — Menuiserie intérieure bois"),
        ("BT19b", "BT19b — Menuiserie extérieure bois"),
        ("BT26",  "BT26 — Fermeture de baies en plastique / PVC"),
        ("BT27",  "BT27 — Fermeture de baies en aluminium"),
        ("BT28",  "BT28 — Fermeture de baies en métal ferreux"),
        ("BT30",  "BT30 — Couverture en ardoises"),
        ("BT32",  "BT32 — Couverture en tuiles terre cuite"),
        ("BT34",  "BT34 — Couverture en zinc et métal"),
        ("BT38",  "BT38 — Plomberie sanitaire"),
        ("BT40",  "BT40 — Chauffage central"),
        ("BT41",  "BT41 — Ventilation et conditionnement d'air"),
        ("BT47",  "BT47 — Électricité"),
        ("BT50",  "BT50 — Rénovation, entretien tous corps d'état"),
        ("BT51",  "BT51 — Menuiseries PVC"),
        # Indices Travaux Publics — base 2010 (INSEE)
        ("TP01",  "TP01 — Index général tous travaux"),
        ("TP02",  "TP02 — Génie civil et ouvrages d'art"),
        ("TP03a", "TP03a — Grands terrassements"),
        ("TP04",  "TP04 — Fondations et travaux géotechniques"),
        ("TP05a", "TP05a — Travaux souterrains traditionnels"),
        ("TP08",  "TP08 — Voirie rurale et urbaine"),
        ("TP09",  "TP09 — Fabrication et mise en œuvre d'enrobés"),
        ("TP10b", "TP10b — Canalisations sans fourniture de tuyaux"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=10, choices=CODE_CHOICES, verbose_name="Code indice")
    valeur = models.DecimalField(max_digits=8, decimal_places=2, verbose_name="Valeur")
    date_publication = models.DateField(verbose_name="Date de publication")
    source = models.CharField(max_length=200, default="INSEE", verbose_name="Source")
    date_creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date_publication", "code"]
        unique_together = [("code", "date_publication")]
        verbose_name = "Indice de révision des prix"
        verbose_name_plural = "Indices de révision des prix"

    def __str__(self) -> str:
        return f"{self.code} = {self.valeur} ({self.date_publication.strftime('%m/%Y')})"


# ---------------------------------------------------------------------------
# Analyse de devis
# ---------------------------------------------------------------------------


class DevisAnalyse(models.Model):
    """
    Devis, bordereau de prix ou DQE téléversé pour analyse et capitalisation.
    """

    STATUTS = [
        ("en_attente", "En attente"),
        ("en_cours", "Analyse en cours"),
        ("termine", "Terminé"),
        ("a_verifier", "À vérifier"),
        ("erreur", "Erreur"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    fichier = models.FileField(upload_to="ressources/devis/%Y/%m/", verbose_name="Fichier")
    nom_original = models.CharField(max_length=255, verbose_name="Nom du fichier")
    type_document = models.CharField(
        max_length=50,
        choices=[("devis", "Devis"), ("dqe", "DQE"), ("bpu", "BPU"), ("dpgf", "DPGF"), ("bon_commande", "Bon de commande"), ("autre", "Autre")],
        default="devis",
        verbose_name="Type de document",
    )
    entreprise = models.CharField(max_length=200, blank=True, verbose_name="Entreprise émettrice")
    localite = models.CharField(max_length=200, blank=True, verbose_name="Localité / Zone géographique")
    date_emission = models.DateField(null=True, blank=True, verbose_name="Date d'émission")
    indice_base_code = models.CharField(max_length=10, default="BT01", verbose_name="Indice de base")
    indice_base_valeur = models.DecimalField(
        max_digits=8, decimal_places=2, null=True, blank=True,
        verbose_name="Valeur de l'indice à la date d'émission",
    )
    statut = models.CharField(max_length=20, choices=STATUTS, default="en_attente", verbose_name="Statut")
    erreur_detail = models.TextField(blank=True, verbose_name="Détail de l'erreur")
    nb_lignes_detectees = models.PositiveIntegerField(default=0)
    nb_lignes_rejetees = models.PositiveIntegerField(default=0)
    nb_lignes_a_verifier = models.PositiveIntegerField(default=0)
    score_qualite_extraction = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    methode_extraction = models.CharField(max_length=80, blank=True)
    message_analyse = models.TextField(blank=True)
    texte_extrait_apercu = models.TextField(blank=True)
    donnees_extraction = models.JSONField(default=dict, blank=True)
    date_suppression_programmee = models.DateField(
        null=True, blank=True,
        verbose_name="Suppression programmée le",
        help_text="Laisser vide pour conserver indéfiniment.",
    )
    capitalise = models.BooleanField(default=False, verbose_name="Capitalisé en bibliothèque")
    date_creation = models.DateTimeField(auto_now_add=True)
    date_modification = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date_creation"]
        verbose_name = "Devis analysé"
        verbose_name_plural = "Devis analysés"

    def __str__(self) -> str:
        return f"{self.nom_original} ({self.get_statut_display()})"


# ---------------------------------------------------------------------------
# Lignes de prix marché
# ---------------------------------------------------------------------------


class LignePrixMarche(models.Model):
    """
    Ligne de prix extraite d'un devis analysé ou saisie manuellement.
    Constitue la banque de prix marché, sectorisée par localité et corps d'état.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    devis_source = models.ForeignKey(
        DevisAnalyse,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="lignes",
        verbose_name="Devis source",
    )
    ordre = models.PositiveIntegerField(default=0)
    numero = models.CharField(max_length=80, blank=True)
    designation = models.CharField(max_length=500, verbose_name="Désignation")
    designation_originale = models.TextField(blank=True)
    designation_normalisee = models.CharField(
        max_length=500, blank=True,
        verbose_name="Désignation normalisée",
        help_text="Version nettoyée pour la détection de similarité.",
    )
    unite = models.CharField(max_length=20, blank=True, verbose_name="Unité")
    quantite = models.DecimalField(max_digits=14, decimal_places=4, null=True, blank=True)
    prix_ht_original = models.DecimalField(max_digits=12, decimal_places=4, verbose_name="Prix HT original (€)")
    montant_ht = models.DecimalField(max_digits=14, decimal_places=4, null=True, blank=True)
    montant_recalcule_ht = models.DecimalField(max_digits=14, decimal_places=4, null=True, blank=True)
    ecart_montant_ht = models.DecimalField(max_digits=14, decimal_places=4, null=True, blank=True)
    type_ligne = models.CharField(
        max_length=30,
        choices=[
            ("article", "Article"),
            ("titre", "Titre"),
            ("sous_total", "Sous-total"),
            ("total", "Total"),
            ("commentaire", "Commentaire"),
        ],
        default="article",
    )
    statut_controle = models.CharField(
        max_length=30,
        choices=[
            ("ok", "OK"),
            ("alerte", "Alerte"),
            ("erreur", "Erreur"),
            ("ignoree", "Ignorée"),
            ("corrigee", "Corrigée"),
        ],
        default="ok",
    )
    score_confiance = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    corrections_proposees = models.JSONField(default=list, blank=True)
    donnees_import = models.JSONField(default=dict, blank=True)
    decision_import = models.CharField(
        max_length=30,
        choices=[
            ("a_decider", "À décider"),
            ("importer", "Importer"),
            ("ignorer", "Ignorer"),
            ("fusionner", "Fusionner"),
            ("mettre_a_jour", "Mettre à jour"),
        ],
        default="a_decider",
    )
    prix_ht_actualise = models.DecimalField(
        max_digits=12, decimal_places=4, null=True, blank=True,
        verbose_name="Prix HT actualisé (€)",
    )
    date_indice_actualisation = models.DateField(
        null=True, blank=True,
        verbose_name="Date d'actualisation",
    )
    indice_code = models.CharField(max_length=10, default="BT01", verbose_name="Indice utilisé")
    indice_valeur_base = models.DecimalField(
        max_digits=8, decimal_places=2, null=True, blank=True,
        verbose_name="Valeur indice à la date du devis",
    )
    indice_valeur_actuelle = models.DecimalField(
        max_digits=8, decimal_places=2, null=True, blank=True,
        verbose_name="Valeur indice actuelle",
    )
    localite = models.CharField(max_length=200, blank=True, verbose_name="Localité")
    corps_etat = models.CharField(max_length=20, blank=True, verbose_name="Corps d'état (code lot)")
    corps_etat_libelle = models.CharField(max_length=200, blank=True, verbose_name="Corps d'état (libellé)")

    # Sous-détail estimé
    debourse_sec_estime = models.DecimalField(
        max_digits=12, decimal_places=4, null=True, blank=True,
        verbose_name="Déboursé sec estimé (€)",
    )
    kpv_estime = models.DecimalField(
        max_digits=6, decimal_places=4, null=True, blank=True,
        verbose_name="Kpv estimé",
    )
    pct_mo_estime = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True, verbose_name="% MO estimé")
    pct_materiaux_estime = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True, verbose_name="% Matériaux estimé")
    pct_materiel_estime = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True, verbose_name="% Matériel estimé")

    # Capitalisation
    ligne_bibliotheque = models.ForeignKey(
        "bibliotheque.LignePrixBibliotheque",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="prix_marche",
        verbose_name="Ligne bibliothèque liée",
    )
    est_ligne_commune = models.BooleanField(
        default=False,
        verbose_name="Ligne commune (fusion de similaires)",
    )
    nb_occurrences = models.PositiveIntegerField(
        default=1,
        verbose_name="Nombre d'occurrences fusionnées",
    )

    date_creation = models.DateTimeField(auto_now_add=True)
    date_modification = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date_creation"]
        verbose_name = "Ligne de prix marché"
        verbose_name_plural = "Lignes de prix marché"

    def __str__(self) -> str:
        return f"{self.designation[:60]} — {self.prix_ht_original} €/{self.unite}"


# ---------------------------------------------------------------------------
# Estimation sources et fiches ratio
# ---------------------------------------------------------------------------


class EstimationSource(models.Model):
    """
    Document source d'une estimation (PDF, image, archive, etc.)
    Utilisé pour la banque de données d'estimation et la création de fiches ratio.
    """

    TYPES = [
        ("pdf", "PDF"),
        ("image", "Image (JPG/PNG)"),
        ("archive", "Archive (ZIP/RAR)"),
        ("tableur", "Tableur (XLSX/ODS)"),
        ("autre", "Autre"),
    ]

    STATUTS = [
        ("en_attente", "En attente"),
        ("en_cours", "Analyse en cours"),
        ("termine", "Terminé"),
        ("erreur", "Erreur"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    fichier = models.FileField(upload_to="ressources/estimations/%Y/%m/", verbose_name="Fichier")
    nom_original = models.CharField(max_length=255, verbose_name="Nom du fichier")
    type_document = models.CharField(max_length=20, choices=TYPES, default="pdf", verbose_name="Type")
    statut = models.CharField(max_length=20, choices=STATUTS, default="en_attente", verbose_name="Statut")
    erreur_detail = models.TextField(blank=True)
    date_suppression_programmee = models.DateField(null=True, blank=True, verbose_name="Suppression programmée le")
    date_creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date_creation"]
        verbose_name = "Source d'estimation"
        verbose_name_plural = "Sources d'estimation"

    def __str__(self) -> str:
        return self.nom_original


class FicheRatioCout(models.Model):
    """
    Fiche ratio de coût de construction extraite d'une estimation source.
    Permet la comparaison rapide par m² SHON, SHAB, emprise au sol.

    Logique de décomposition :
      - Infrastructure (fondations) : type et profondeur influencent fortement le coût
      - Superstructure (bâti) : niveaux, matériaux, complexité
      - Ratio infra/supra = part relative des coûts infrastructure vs superstructure
    """

    TYPES_FONDATION = [
        ("superficielle_semelle", "Semelles superficielles"),
        ("superficielle_radier", "Radier général"),
        ("profonde_pieux_beton", "Pieux béton forés"),
        ("profonde_pieux_metalliques", "Pieux métalliques"),
        ("profonde_micropieux", "Micropieux"),
        ("profonde_paroi_moulee", "Paroi moulée"),
        ("non_identifie", "Non identifié"),
    ]

    TYPES_PROJET = [
        ("logement_collectif", "Logement collectif"),
        ("logement_individuel", "Logement individuel"),
        ("bureaux", "Bureaux"),
        ("equipement_scolaire", "Équipement scolaire"),
        ("equipement_sportif", "Équipement sportif"),
        ("equipement_culturel", "Équipement culturel"),
        ("commerce", "Commerce / Retail"),
        ("industrie", "Industrie / Entrepôt"),
        ("sante", "Santé / ERP"),
        ("vrd_amenagements", "VRD / Aménagements extérieurs"),
        ("autre", "Autre"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    source = models.ForeignKey(
        EstimationSource,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="fiches_ratio",
        verbose_name="Source",
    )
    intitule = models.CharField(max_length=300, verbose_name="Intitulé du projet")
    type_projet = models.CharField(max_length=50, choices=TYPES_PROJET, default="logement_collectif", verbose_name="Type de projet")
    localite = models.CharField(max_length=200, blank=True, verbose_name="Localité")
    annee_reference = models.PositiveSmallIntegerField(null=True, blank=True, verbose_name="Année de référence")

    # Surfaces et géométrie
    shon = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, verbose_name="SHON (m²)")
    shab = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, verbose_name="SHAB (m²)")
    emprise_sol = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, verbose_name="Emprise au sol (m²)")
    nombre_niveaux_hors_sol = models.PositiveSmallIntegerField(null=True, blank=True, verbose_name="Niveaux hors sol")
    nombre_niveaux_sous_sol = models.PositiveSmallIntegerField(default=0, verbose_name="Niveaux en sous-sol")

    # Fondations
    type_fondation = models.CharField(max_length=50, choices=TYPES_FONDATION, default="non_identifie", verbose_name="Type de fondation")
    profondeur_fondation_m = models.DecimalField(
        max_digits=6, decimal_places=2, null=True, blank=True,
        verbose_name="Profondeur de fondation (m)",
    )
    nature_sol = models.CharField(max_length=200, blank=True, verbose_name="Nature du sol")

    # Coûts
    cout_total_ht = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True, verbose_name="Coût total HT (€)")
    cout_infrastructure_ht = models.DecimalField(
        max_digits=14, decimal_places=2, null=True, blank=True,
        verbose_name="Coût infrastructure HT (€)",
        help_text="Fondations, terrassements, réseaux sous-dallage",
    )
    cout_superstructure_ht = models.DecimalField(
        max_digits=14, decimal_places=2, null=True, blank=True,
        verbose_name="Coût superstructure HT (€)",
        help_text="Structure bâtie hors fondations",
    )

    # Ratios calculés
    cout_m2_shon = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, verbose_name="Coût/m² SHON (€/m²)")
    cout_m2_shab = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, verbose_name="Coût/m² SHAB (€/m²)")
    cout_m2_emprise = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, verbose_name="Coût/m² emprise (€/m²)")
    ratio_infra_pct = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True,
        verbose_name="Part infrastructure (%)",
        help_text="% du coût total imputé à l'infrastructure",
    )
    ratio_supra_pct = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True,
        verbose_name="Part superstructure (%)",
    )

    # Indices pour actualisation
    indice_code = models.CharField(max_length=10, default="BT01", verbose_name="Indice de référence")
    indice_valeur_reference = models.DecimalField(
        max_digits=8, decimal_places=2, null=True, blank=True,
        verbose_name="Valeur de l'indice à la date de référence",
    )

    # Source et traçabilité
    reference_externe = models.CharField(max_length=300, blank=True, verbose_name="Référence externe")
    observations = models.TextField(blank=True, verbose_name="Observations")
    lots_cctp = models.ManyToManyField(
        "pieces_ecrites.LotCCTP",
        blank=True,
        related_name="fiches_ratio",
        verbose_name="Corps d'état concernés",
    )

    date_creation = models.DateTimeField(auto_now_add=True)
    date_modification = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date_creation"]
        verbose_name = "Fiche ratio de coût"
        verbose_name_plural = "Fiches ratio de coût"

    def __str__(self) -> str:
        return f"{self.intitule} — {self.cout_m2_shon or '?'} €/m² SHON"

    def calculer_ratios(self) -> None:
        """Recalcule les ratios dérivés depuis les champs de surface et de coût."""
        if self.cout_total_ht and self.shon and self.shon > 0:
            self.cout_m2_shon = self.cout_total_ht / self.shon
        if self.cout_total_ht and self.shab and self.shab > 0:
            self.cout_m2_shab = self.cout_total_ht / self.shab
        if self.cout_total_ht and self.emprise_sol and self.emprise_sol > 0:
            self.cout_m2_emprise = self.cout_total_ht / self.emprise_sol
        if self.cout_infrastructure_ht and self.cout_total_ht and self.cout_total_ht > 0:
            self.ratio_infra_pct = (self.cout_infrastructure_ht / self.cout_total_ht) * 100
        if self.cout_superstructure_ht and self.cout_total_ht and self.cout_total_ht > 0:
            self.ratio_supra_pct = (self.cout_superstructure_ht / self.cout_total_ht) * 100
