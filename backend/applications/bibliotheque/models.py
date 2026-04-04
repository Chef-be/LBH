"""
Bibliothèque de prix intelligente — Modèles.
Plateforme LBH — Bureau d'Études Économiste
"""

import uuid
from django.db import models


class LignePrixBibliotheque(models.Model):
    """
    Ligne de la bibliothèque de prix.
    Multi-niveaux : référence générale → territoire → entreprise → affaire.
    """

    NIVEAUX = [
        ("reference", "Prix de référence général"),
        ("territorial", "Prix territorial"),
        ("entreprise", "Prix entreprise"),
        ("affaire", "Prix affaire"),
        ("negocie", "Prix négocié"),
        ("constate", "Prix constaté en bilan"),
    ]

    STATUTS_VALIDATION = [
        ("brouillon", "Brouillon"),
        ("a_valider", "À valider"),
        ("valide", "Validé"),
        ("obsolete", "Obsolète"),
    ]

    SOURCES_IMPORT = [
        ("interne", "Saisie interne"),
        ("bordereau_pdf", "Bordereau PDF"),
        ("prix_construction", "Prix Construction"),
        ("etude_prix", "Étude de prix"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Niveau de prix
    niveau = models.CharField(max_length=30, choices=NIVEAUX, default="reference")
    organisation = models.ForeignKey(
        "organisations.Organisation", on_delete=models.CASCADE,
        null=True, blank=True, related_name="bibliotheque_prix",
        verbose_name="Organisation (vide = référentiel général)",
    )
    projet = models.ForeignKey(
        "projets.Projet", on_delete=models.CASCADE,
        null=True, blank=True, related_name="bibliotheque_prix",
        verbose_name="Projet (pour niveau affaire)",
    )

    # Classification
    code = models.CharField(max_length=50, verbose_name="Code")
    famille = models.CharField(max_length=100, verbose_name="Famille")
    sous_famille = models.CharField(max_length=100, blank=True, verbose_name="Sous-famille")
    corps_etat = models.CharField(max_length=100, blank=True, verbose_name="Corps d'état")
    lot = models.CharField(max_length=100, blank=True, verbose_name="Lot")
    origine_import = models.CharField(
        max_length=30, choices=SOURCES_IMPORT, default="interne", verbose_name="Origine d'import",
    )
    code_source_externe = models.CharField(max_length=80, blank=True, verbose_name="Code source externe")
    url_source = models.URLField(blank=True, verbose_name="URL source")

    # Désignation
    designation_longue = models.TextField(verbose_name="Désignation longue")
    designation_courte = models.CharField(max_length=300, verbose_name="Désignation courte")
    unite = models.CharField(max_length=20, verbose_name="Unité")

    # Contexte d'emploi et hypothèses
    hypotheses = models.TextField(blank=True, verbose_name="Hypothèses de calcul")
    contexte_emploi = models.TextField(blank=True, verbose_name="Contexte d'emploi")
    observations_techniques = models.TextField(blank=True)
    observations_economiques = models.TextField(blank=True)
    prescriptions_techniques = models.TextField(blank=True, verbose_name="Prescriptions techniques")
    criteres_metre = models.TextField(blank=True, verbose_name="Critères de métré")
    normes_applicables = models.JSONField(default=list, blank=True, verbose_name="Normes applicables")
    phases_execution = models.JSONField(default=list, blank=True, verbose_name="Phases d'exécution")
    dechets_generes = models.JSONField(default=list, blank=True, verbose_name="Déchets générés")
    cahier_des_charges_structure = models.JSONField(
        default=list, blank=True, verbose_name="Structure du cahier des charges",
    )
    donnees_analytiques = models.JSONField(default=dict, blank=True, verbose_name="Données analytiques")

    # Composantes prix (déboursé sec unitaire ventilé)
    temps_main_oeuvre = models.DecimalField(max_digits=10, decimal_places=4, default=0)
    cout_horaire_mo = models.DecimalField(max_digits=10, decimal_places=4, default=0)
    cout_matieres = models.DecimalField(max_digits=12, decimal_places=4, default=0)
    cout_materiel = models.DecimalField(max_digits=12, decimal_places=4, default=0)
    cout_sous_traitance = models.DecimalField(max_digits=12, decimal_places=4, default=0)
    cout_transport = models.DecimalField(max_digits=12, decimal_places=4, default=0)
    cout_frais_divers = models.DecimalField(max_digits=12, decimal_places=4, default=0)
    debourse_sec_unitaire = models.DecimalField(max_digits=12, decimal_places=4, default=0)
    prix_vente_unitaire = models.DecimalField(max_digits=12, decimal_places=4, default=0)

    # Traçabilité
    source = models.CharField(max_length=200, blank=True, verbose_name="Source")
    auteur = models.ForeignKey(
        "comptes.Utilisateur", on_delete=models.PROTECT,
        null=True, blank=True, related_name="lignes_bibliotheque",
    )
    fiabilite = models.PositiveSmallIntegerField(
        default=3, verbose_name="Indice de fiabilité (1-5)",
        help_text="1 = estimatif, 5 = issu de bilan réel",
    )
    periode_validite_debut = models.DateField(null=True, blank=True)
    periode_validite_fin = models.DateField(null=True, blank=True)

    # Versionnement
    version = models.PositiveSmallIntegerField(default=1)
    statut_validation = models.CharField(
        max_length=30, choices=STATUTS_VALIDATION, default="brouillon",
    )
    ligne_parente = models.ForeignKey(
        "self", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="versions", verbose_name="Version précédente",
    )

    # Ajustement contextuel
    territoire = models.CharField(max_length=100, blank=True)
    saison = models.CharField(max_length=50, blank=True)
    coefficient_territoire = models.DecimalField(
        max_digits=5, decimal_places=3, default=1.0,
        verbose_name="Coefficient territorial",
    )

    date_creation = models.DateTimeField(auto_now_add=True)
    date_modification = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "bibliotheque_ligne_prix"
        verbose_name = "Ligne de bibliothèque de prix"
        verbose_name_plural = "Bibliothèque de prix"
        indexes = [
            models.Index(fields=["famille", "sous_famille"]),
            models.Index(fields=["code"]),
            models.Index(fields=["niveau", "organisation"]),
            models.Index(fields=["origine_import", "code_source_externe"]),
        ]

    def __str__(self):
        return f"[{self.niveau}] {self.code} — {self.designation_courte}"


class SousDetailPrix(models.Model):
    """
    Sous-détail d'une ligne de la bibliothèque de prix.
    Décompose le coût unitaire en ressources élémentaires (MO, matières, matériel…).
    Conforme à la méthode d'étude de prix analytique (déboursé sec ressource par ressource).
    """

    TYPES_RESSOURCE = [
        ("mo", "Main-d'œuvre"),
        ("matiere", "Matière / Fourniture"),
        ("materiel", "Matériel / Engin"),
        ("sous_traitance", "Sous-traitance"),
        ("transport", "Transport"),
        ("frais_divers", "Frais divers"),
    ]

    ZONES_TAUX = [
        ("A", "Zone A — Province (41 €/h)"),
        ("B", "Zone B — IDF (56 €/h)"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    ligne_prix = models.ForeignKey(
        LignePrixBibliotheque, on_delete=models.CASCADE,
        related_name="sous_details", verbose_name="Ligne de prix parente",
    )

    ordre = models.PositiveSmallIntegerField(default=1, verbose_name="Ordre d'affichage")
    type_ressource = models.CharField(
        max_length=20, choices=TYPES_RESSOURCE, verbose_name="Type de ressource",
    )

    # Identification de la ressource
    code = models.CharField(max_length=50, blank=True, verbose_name="Code ressource")
    designation = models.CharField(max_length=300, verbose_name="Désignation")
    unite = models.CharField(max_length=20, verbose_name="Unité")

    # Quantité et prix
    quantite = models.DecimalField(
        max_digits=14, decimal_places=6, default=1,
        verbose_name="Quantité par unité d'ouvrage",
    )
    cout_unitaire_ht = models.DecimalField(
        max_digits=12, decimal_places=6, default=0,
        verbose_name="Coût unitaire HT (€)",
    )
    montant_ht = models.DecimalField(
        max_digits=14, decimal_places=4, default=0,
        verbose_name="Montant HT (calculé)",
    )

    # Spécifique main-d'œuvre
    profil_main_oeuvre = models.ForeignKey(
        "economie.ProfilMainOeuvre",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sous_details_bibliotheque",
        verbose_name="Profil de main-d'œuvre",
    )
    nombre_ressources = models.DecimalField(
        max_digits=8,
        decimal_places=3,
        default=1,
        verbose_name="Nombre de ressources",
    )
    temps_unitaire = models.DecimalField(
        max_digits=12,
        decimal_places=6,
        default=0,
        verbose_name="Temps unitaire (h)",
    )
    taux_horaire = models.DecimalField(
        max_digits=8, decimal_places=4, default=0,
        verbose_name="Taux horaire MO (€/h)",
        help_text="Renseigné pour les ressources main-d'œuvre uniquement",
    )
    zone_taux = models.CharField(
        max_length=5, choices=ZONES_TAUX, blank=True,
        verbose_name="Zone tarifaire ARTIPRIX",
    )

    observations = models.TextField(blank=True)
    date_modification = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "bibliotheque_sous_detail_prix"
        verbose_name = "Sous-détail de prix"
        verbose_name_plural = "Sous-détails de prix"
        ordering = ["ligne_prix", "ordre"]
        indexes = [
            models.Index(fields=["ligne_prix", "ordre"]),
            models.Index(fields=["type_ressource"]),
        ]

    def save(self, *args, **kwargs):
        if self.type_ressource == "mo":
            if self.profil_main_oeuvre_id and not self.designation:
                self.designation = self.profil_main_oeuvre.libelle
            if self.profil_main_oeuvre_id and not self.code:
                self.code = self.profil_main_oeuvre.code
            if self.profil_main_oeuvre_id and (not self.taux_horaire or self.taux_horaire <= 0):
                from applications.economie.services import calculer_taux_horaire_reference_profil

                self.taux_horaire = calculer_taux_horaire_reference_profil(self.profil_main_oeuvre)
            if self.nombre_ressources and self.temps_unitaire:
                self.quantite = self.nombre_ressources * self.temps_unitaire
            if self.taux_horaire:
                self.cout_unitaire_ht = self.taux_horaire
            if not self.unite:
                self.unite = "h"
        else:
            self.profil_main_oeuvre = None
            self.nombre_ressources = 1
            self.temps_unitaire = 0
            self.taux_horaire = 0
        self.montant_ht = self.quantite * self.cout_unitaire_ht
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.get_type_ressource_display()} — {self.designation[:60]}"
