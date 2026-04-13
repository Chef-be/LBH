"""
Modèles d'économie de la construction.
Plateforme LBH — Bureau d'Études Économiste

Cœur économique : déboursé sec, coûts, prix de vente, marges.
Aucune valeur métier codée en dur — tout passe par les paramètres.
"""

import uuid
import decimal
from django.db import models


CATEGORIES_PROFILS_MAIN_OEUVRE = [
    ("ouvrier", "Ouvrier"),
    ("compagnon", "Compagnon qualifié"),
    ("technicien", "Technicien"),
    ("conducteur", "Conducteur de travaux"),
    ("ingenieur", "Ingénieur"),
    ("economiste", "Économiste"),
    ("redacteur", "Rédacteur technique"),
    ("administratif", "Administratif"),
    ("autre", "Autre profil"),
]

LOCALISATIONS_CONVENTIONNELLES = [
    ("nationale", "Nationale"),
    ("metropole", "Métropole"),
    ("mayotte", "Mayotte"),
    ("dom", "Autre DOM"),
]


class EtudeEconomique(models.Model):
    """Étude économique complète rattachée à un projet."""

    STATUTS = [
        ("brouillon", "Brouillon"),
        ("en_cours", "En cours"),
        ("a_valider", "À valider"),
        ("validee", "Validée"),
        ("archivee", "Archivée"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    projet = models.ForeignKey("projets.Projet", on_delete=models.CASCADE, related_name="etudes_economiques")
    lot = models.ForeignKey("projets.Lot", on_delete=models.SET_NULL, null=True, blank=True, related_name="etudes")
    intitule = models.CharField(max_length=300, verbose_name="Intitulé de l'étude")
    statut = models.CharField(max_length=30, choices=STATUTS, default="brouillon")
    version = models.PositiveSmallIntegerField(default=1)
    est_variante = models.BooleanField(default=False, verbose_name="Variante")
    etude_parente = models.ForeignKey(
        "self", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="variantes", verbose_name="Étude de base",
    )

    # Paramètres globaux de l'étude (surchargent les paramètres système)
    taux_frais_chantier = models.DecimalField(
        max_digits=6, decimal_places=4, null=True, blank=True,
        verbose_name="Taux frais de chantier",
        help_text="Laisser vide pour utiliser le paramètre système",
    )
    taux_frais_generaux = models.DecimalField(
        max_digits=6, decimal_places=4, null=True, blank=True,
        verbose_name="Taux frais généraux",
    )
    taux_aleas = models.DecimalField(
        max_digits=6, decimal_places=4, null=True, blank=True,
        verbose_name="Taux d'aléas",
    )
    taux_marge_cible = models.DecimalField(
        max_digits=6, decimal_places=4, null=True, blank=True,
        verbose_name="Taux de marge cible",
    )
    taux_pertes = models.DecimalField(
        max_digits=6, decimal_places=4, null=True, blank=True,
        verbose_name="Taux de pertes matières",
    )

    # Totaux calculés (mis à jour à chaque recalcul)
    total_debourse_sec = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    total_cout_direct = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    total_cout_revient = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    total_prix_vente = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    total_marge_brute = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    total_marge_nette = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    taux_marge_nette_global = models.DecimalField(max_digits=6, decimal_places=4, default=0)

    date_creation = models.DateTimeField(auto_now_add=True)
    date_modification = models.DateTimeField(auto_now=True)
    cree_par = models.ForeignKey("comptes.Utilisateur", on_delete=models.PROTECT, null=True)

    class Meta:
        db_table = "economie_etude_economique"
        verbose_name = "Étude économique"
        verbose_name_plural = "Études économiques"

    def __str__(self):
        return f"{self.intitule} v{self.version} — {self.projet.reference}"


class LignePrix(models.Model):
    """
    Ligne de prix dans une étude économique.
    Contient tous les éléments de calcul du déboursé sec au prix de vente.
    Les taux peuvent être surchargés individuellement ou hérités de l'étude/paramètres.
    """

    ETATS_RENTABILITE = [
        ("rentable", "Rentable"),
        ("surveiller", "À surveiller"),
        ("faible", "Faiblement rentable"),
        ("non_rentable", "Non rentable"),
        ("sous_condition", "Rentable sous condition"),
        ("deficitaire_origine", "Déficitaire dès l'origine"),
        ("indefini", "Non calculé"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    etude = models.ForeignKey(EtudeEconomique, on_delete=models.CASCADE, related_name="lignes")

    # Référence à la bibliothèque (optionnel — peut être saisi manuellement)
    ref_bibliotheque = models.ForeignKey(
        "bibliotheque.LignePrixBibliotheque", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="utilisations",
    )

    # Identification de la ligne
    numero_ordre = models.PositiveSmallIntegerField(default=1, verbose_name="N° d'ordre")
    code = models.CharField(max_length=50, blank=True, verbose_name="Code")
    designation = models.TextField(verbose_name="Désignation")
    unite = models.CharField(max_length=20, verbose_name="Unité", default="u")

    # Quantités
    quantite_prevue = models.DecimalField(max_digits=15, decimal_places=3, verbose_name="Quantité prévue")
    quantite_reelle = models.DecimalField(
        max_digits=15, decimal_places=3, null=True, blank=True,
        verbose_name="Quantité réelle",
    )

    # Composantes du déboursé sec unitaire
    temps_main_oeuvre = models.DecimalField(
        max_digits=10, decimal_places=4, default=0,
        verbose_name="Temps MO (h/unité)",
    )
    cout_horaire_mo = models.DecimalField(
        max_digits=10, decimal_places=4, default=0,
        verbose_name="Coût horaire MO (€/h)",
    )
    cout_matieres = models.DecimalField(
        max_digits=12, decimal_places=4, default=0,
        verbose_name="Coût matières unitaire (€/u)",
    )
    cout_materiel = models.DecimalField(
        max_digits=12, decimal_places=4, default=0,
        verbose_name="Coût matériel unitaire (€/u)",
    )
    cout_sous_traitance = models.DecimalField(
        max_digits=12, decimal_places=4, default=0,
        verbose_name="Coût sous-traitance unitaire (€/u)",
    )
    cout_transport = models.DecimalField(
        max_digits=12, decimal_places=4, default=0,
        verbose_name="Coût transport unitaire (€/u)",
    )

    # Surcharges de taux (null = hérite de l'étude ou des paramètres)
    taux_pertes_surcharge = models.DecimalField(
        max_digits=6, decimal_places=4, null=True, blank=True,
    )
    taux_frais_chantier_surcharge = models.DecimalField(
        max_digits=6, decimal_places=4, null=True, blank=True,
    )
    taux_frais_generaux_surcharge = models.DecimalField(
        max_digits=6, decimal_places=4, null=True, blank=True,
    )
    taux_aleas_surcharge = models.DecimalField(
        max_digits=6, decimal_places=4, null=True, blank=True,
    )
    taux_marge_surcharge = models.DecimalField(
        max_digits=6, decimal_places=4, null=True, blank=True,
    )

    # Résultats calculés (mis à jour par le moteur de calcul)
    debourse_sec_unitaire = models.DecimalField(max_digits=12, decimal_places=4, default=0)
    cout_direct_unitaire = models.DecimalField(max_digits=12, decimal_places=4, default=0)
    cout_revient_unitaire = models.DecimalField(max_digits=12, decimal_places=4, default=0)
    prix_vente_unitaire = models.DecimalField(max_digits=12, decimal_places=4, default=0)
    marge_brute_unitaire = models.DecimalField(max_digits=12, decimal_places=4, default=0)
    marge_nette_unitaire = models.DecimalField(max_digits=12, decimal_places=4, default=0)
    taux_marge_nette = models.DecimalField(max_digits=6, decimal_places=4, default=0)
    marge_brute_totale = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    marge_nette_totale = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    contribution_marge = models.DecimalField(
        max_digits=6, decimal_places=4, default=0,
        verbose_name="Contribution à la marge du lot (%)",
    )

    # Rentabilité
    etat_rentabilite = models.CharField(
        max_length=30, choices=ETATS_RENTABILITE, default="indefini",
        verbose_name="État de rentabilité",
    )
    seuil_quantite_critique = models.DecimalField(
        max_digits=15, decimal_places=3, null=True, blank=True,
        verbose_name="Quantité critique (seuil de rentabilité nulle)",
    )
    seuil_prix_minimum = models.DecimalField(
        max_digits=12, decimal_places=4, null=True, blank=True,
        verbose_name="Prix de vente minimum (rentabilité nulle)",
    )

    # Sensibilités calculées
    indice_sensibilite_quantite = models.DecimalField(
        max_digits=6, decimal_places=2, null=True, blank=True,
    )
    indice_sensibilite_main_oeuvre = models.DecimalField(
        max_digits=6, decimal_places=2, null=True, blank=True,
    )
    indice_sensibilite_matieres = models.DecimalField(
        max_digits=6, decimal_places=2, null=True, blank=True,
    )

    # Causes de non-rentabilité (liste JSON)
    causes_non_rentabilite = models.JSONField(default=list, blank=True)

    # Métadonnées
    observations = models.TextField(blank=True)
    date_modification = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "economie_ligne_prix"
        verbose_name = "Ligne de prix"
        verbose_name_plural = "Lignes de prix"
        ordering = ["etude", "numero_ordre"]

    def __str__(self):
        return f"{self.code} — {self.designation[:60]}"


class EtudePrix(models.Model):
    """
    Étude de prix formelle.
    Décompose le coût de réalisation d'un ouvrage élémentaire en ressources.
    Méthode : analytique (ressource par ressource) ou décompte (depuis bordereau).
    Peut alimenter la bibliothèque de prix une fois validée.
    """

    METHODES = [
        ("analytique", "Analytique — déboursé sec ressource par ressource"),
        ("decompte", "Décompte — depuis un bordereau chiffré"),
        ("artiprix", "ARTIPRIX — depuis le bordereau de prix unitaires 2025"),
        ("constate", "Constaté — relevé de chantier réel"),
        ("estimatif", "Estimatif — sans sous-détail"),
    ]

    STATUTS = [
        ("brouillon", "Brouillon"),
        ("en_cours", "En cours"),
        ("a_valider", "À valider"),
        ("validee", "Validée"),
        ("publiee", "Publiée en bibliothèque"),
        ("archivee", "Archivée"),
    ]

    LOTS_TYPES = [
        ("7.1", "7.1 — VRD"),
        ("7.2", "7.2 — Terrassements"),
        ("7.3", "7.3 — Gros Œuvre"),
        ("7.4", "7.4 — Façades"),
        ("7.5", "7.5 — Murs-rideaux"),
        ("7.6", "7.6 — Construction Ossature Bois"),
        ("7.7", "7.7 — Charpente métallique"),
        ("7.8", "7.8 — Charpente-Couverture-Zinguerie"),
        ("7.9", "7.9 — Étanchéité"),
        ("7.10", "7.10 — Menuiseries extérieures"),
        ("7.11", "7.11 — Menuiseries intérieures"),
        ("7.12", "7.12 — Isolation-Plâtrerie-Peinture"),
        ("7.13", "7.13 — Revêtements sols et carrelage"),
        ("7.14", "7.14 — Électricité"),
        ("7.15", "7.15 — Plomberie"),
        ("7.16", "7.16 — CVC"),
        ("7.17", "7.17 — Ascenseur"),
        ("7.18", "7.18 — Aménagements paysagers"),
        ("autre", "Autre"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Identification
    intitule = models.CharField(max_length=300, verbose_name="Intitulé de l'étude de prix")
    code = models.CharField(max_length=50, blank=True, verbose_name="Code")
    description = models.TextField(blank=True, verbose_name="Description")

    # Classification
    methode = models.CharField(
        max_length=30, choices=METHODES, default="analytique", verbose_name="Méthode",
    )
    lot_type = models.CharField(
        max_length=10, choices=LOTS_TYPES, blank=True, verbose_name="Lot / Corps d'état",
    )
    millesime = models.PositiveSmallIntegerField(
        default=2025, verbose_name="Millésime",
        help_text="Année de référence des prix utilisés",
    )

    # Contexte
    projet = models.ForeignKey(
        "projets.Projet", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="etudes_de_prix", verbose_name="Projet associé",
    )
    organisation = models.ForeignKey(
        "organisations.Organisation", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="etudes_de_prix", verbose_name="Organisation",
    )

    # Hypothèses de calcul
    zone_taux_horaire = models.CharField(
        max_length=5,
        choices=[("A", "Zone A — Province (41 €/h)"), ("B", "Zone B — IDF (56 €/h)")],
        default="A", verbose_name="Zone tarifaire",
    )
    taux_horaire_mo = models.DecimalField(
        max_digits=8, decimal_places=4, default=decimal.Decimal("41.0000"),
        verbose_name="Taux horaire MO retenu (€/h)",
    )
    taux_frais_chantier = models.DecimalField(
        max_digits=6,
        decimal_places=4,
        default=decimal.Decimal("0.0800"),
        verbose_name="Taux frais de chantier",
    )
    taux_frais_generaux = models.DecimalField(
        max_digits=6,
        decimal_places=4,
        default=decimal.Decimal("0.1200"),
        verbose_name="Taux frais généraux",
    )
    taux_aleas = models.DecimalField(
        max_digits=6,
        decimal_places=4,
        default=decimal.Decimal("0.0300"),
        verbose_name="Taux d'aléas",
    )
    taux_marge_cible = models.DecimalField(
        max_digits=6,
        decimal_places=4,
        default=decimal.Decimal("0.1000"),
        verbose_name="Taux de marge cible",
    )
    hypotheses = models.TextField(blank=True, verbose_name="Hypothèses de calcul")
    observations = models.TextField(blank=True)

    # Statut et circuit de validation
    statut = models.CharField(max_length=30, choices=STATUTS, default="brouillon")
    date_etude = models.DateField(null=True, blank=True, verbose_name="Date de l'étude")
    date_validation = models.DateField(null=True, blank=True, verbose_name="Date de validation")
    auteur = models.ForeignKey(
        "comptes.Utilisateur", on_delete=models.PROTECT, null=True,
        related_name="etudes_de_prix_creees", verbose_name="Auteur",
    )
    validateur = models.ForeignKey(
        "comptes.Utilisateur", on_delete=models.PROTECT, null=True, blank=True,
        related_name="etudes_de_prix_validees", verbose_name="Validateur",
    )

    # Totaux calculés (mis à jour automatiquement)
    total_mo_ht = models.DecimalField(max_digits=14, decimal_places=4, default=0)
    total_matieres_ht = models.DecimalField(max_digits=14, decimal_places=4, default=0)
    total_materiel_ht = models.DecimalField(max_digits=14, decimal_places=4, default=0)
    total_sous_traitance_ht = models.DecimalField(max_digits=14, decimal_places=4, default=0)
    total_transport_ht = models.DecimalField(max_digits=14, decimal_places=4, default=0)
    total_frais_divers_ht = models.DecimalField(max_digits=14, decimal_places=4, default=0)
    debourse_sec_ht = models.DecimalField(
        max_digits=14, decimal_places=4, default=0,
        verbose_name="Déboursé sec total HT",
    )
    montant_frais_chantier_ht = models.DecimalField(max_digits=14, decimal_places=4, default=0)
    montant_frais_generaux_ht = models.DecimalField(max_digits=14, decimal_places=4, default=0)
    montant_aleas_ht = models.DecimalField(max_digits=14, decimal_places=4, default=0)
    cout_revient_ht = models.DecimalField(max_digits=14, decimal_places=4, default=0)
    marge_previsionnelle_ht = models.DecimalField(max_digits=14, decimal_places=4, default=0)
    prix_vente_ht = models.DecimalField(max_digits=14, decimal_places=4, default=0)
    coefficient_k = models.DecimalField(max_digits=10, decimal_places=4, default=0)
    seuil_rentabilite_ht = models.DecimalField(max_digits=14, decimal_places=4, default=0)

    # Lien vers la bibliothèque (renseigné lors de la publication)
    ligne_bibliotheque = models.ForeignKey(
        "bibliotheque.LignePrixBibliotheque", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="etudes_source",
        verbose_name="Ligne de bibliothèque publiée",
    )

    date_creation = models.DateTimeField(auto_now_add=True)
    date_modification = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "economie_etude_prix"
        verbose_name = "Étude de prix"
        verbose_name_plural = "Études de prix"
        indexes = [
            models.Index(fields=["statut", "millesime"]),
            models.Index(fields=["lot_type"]),
        ]

    def recalculer_totaux(self):
        """Recalcule les totaux depuis les lignes de ressources."""
        from django.db.models import Sum
        from .services import calculer_indicateurs_commerciaux_etude_prix

        lignes = self.lignes.all()
        self.total_mo_ht = lignes.filter(type_ressource="mo").aggregate(
            s=Sum("montant_ht"))["s"] or 0
        self.total_matieres_ht = lignes.filter(type_ressource="matiere").aggregate(
            s=Sum("montant_ht"))["s"] or 0
        self.total_materiel_ht = lignes.filter(type_ressource="materiel").aggregate(
            s=Sum("montant_ht"))["s"] or 0
        self.total_sous_traitance_ht = lignes.filter(type_ressource="sous_traitance").aggregate(
            s=Sum("montant_ht"))["s"] or 0
        self.total_transport_ht = lignes.filter(type_ressource="transport").aggregate(
            s=Sum("montant_ht"))["s"] or 0
        self.total_frais_divers_ht = lignes.filter(type_ressource="frais_divers").aggregate(
            s=Sum("montant_ht"))["s"] or 0
        self.debourse_sec_ht = (
            self.total_mo_ht + self.total_matieres_ht + self.total_materiel_ht
            + self.total_sous_traitance_ht + self.total_transport_ht + self.total_frais_divers_ht
        )
        indicateurs = calculer_indicateurs_commerciaux_etude_prix(self)
        for champ, valeur in indicateurs.items():
            setattr(self, champ, valeur)
        self.save(update_fields=[
            "total_mo_ht", "total_matieres_ht", "total_materiel_ht",
            "total_sous_traitance_ht", "total_transport_ht", "total_frais_divers_ht",
            "debourse_sec_ht",
            "montant_frais_chantier_ht", "montant_frais_generaux_ht", "montant_aleas_ht",
            "cout_revient_ht", "marge_previsionnelle_ht", "prix_vente_ht",
            "coefficient_k", "seuil_rentabilite_ht",
        ])

    def __str__(self):
        return f"{self.code} — {self.intitule}" if self.code else self.intitule


class LignePrixEtude(models.Model):
    """
    Ligne de ressource élémentaire dans une étude de prix.
    Correspond à un poste : une heure de MO, un m³ de béton, une journée d'engin, etc.
    """

    TYPES_RESSOURCE = [
        ("mo", "Main-d'œuvre"),
        ("matiere", "Matière / Fourniture"),
        ("materiel", "Matériel / Engin"),
        ("sous_traitance", "Sous-traitance"),
        ("transport", "Transport"),
        ("frais_divers", "Frais divers"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    etude = models.ForeignKey(
        EtudePrix, on_delete=models.CASCADE, related_name="lignes",
        verbose_name="Étude de prix",
    )

    ordre = models.PositiveSmallIntegerField(default=1, verbose_name="Ordre d'affichage")
    type_ressource = models.CharField(
        max_length=20, choices=TYPES_RESSOURCE, verbose_name="Type de ressource",
    )

    # Identification
    code = models.CharField(max_length=50, blank=True, verbose_name="Code ressource")
    designation = models.CharField(max_length=300, verbose_name="Désignation")
    unite = models.CharField(max_length=20, default="u", verbose_name="Unité")

    # Calcul du montant
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
        related_name="lignes_etudes_prix",
        verbose_name="Profil de main-d'œuvre",
    )
    nombre_ressources = models.DecimalField(
        max_digits=8,
        decimal_places=3,
        default=1,
        verbose_name="Nombre de ressources",
        help_text="Effectif mobilisé sur la ressource analytique.",
    )
    temps_unitaire = models.DecimalField(
        max_digits=12,
        decimal_places=6,
        default=0,
        verbose_name="Temps unitaire (h)",
        help_text="Temps nécessaire par type d'ouvrier ou salarié pour une unité d'ouvrage.",
    )
    taux_horaire = models.DecimalField(
        max_digits=8, decimal_places=4, default=0,
        verbose_name="Taux horaire MO (€/h)",
        help_text="Pour les ressources MO : montant = quantité (h) × taux horaire",
    )

    observations = models.TextField(blank=True)

    class Meta:
        db_table = "economie_ligne_prix_etude"
        verbose_name = "Ligne de ressource"
        verbose_name_plural = "Lignes de ressource (études de prix)"
        ordering = ["etude", "ordre"]

    def save(self, *args, **kwargs):
        if self.type_ressource == "mo":
            if self.profil_main_oeuvre_id and not self.designation:
                self.designation = self.profil_main_oeuvre.libelle
            if self.profil_main_oeuvre_id and not self.code:
                self.code = self.profil_main_oeuvre.code
            if self.profil_main_oeuvre_id and (not self.taux_horaire or self.taux_horaire <= 0):
                from .services import calculer_taux_horaire_reference_profil

                self.taux_horaire = calculer_taux_horaire_reference_profil(self.profil_main_oeuvre)
            if self.nombre_ressources and self.temps_unitaire:
                self.quantite = self.nombre_ressources * self.temps_unitaire
            if self.taux_horaire:
                self.cout_unitaire_ht = self.taux_horaire
            if not self.unite:
                self.unite = "h"
        else:
            self.profil_main_oeuvre = None
            self.nombre_ressources = decimal.Decimal("1")
            self.temps_unitaire = decimal.Decimal("0")
            self.taux_horaire = decimal.Decimal("0")
        self.montant_ht = self.quantite * self.cout_unitaire_ht
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.get_type_ressource_display()} — {self.designation[:60]}"


class AchatEtudePrix(models.Model):
    """Achat ou approvisionnement rattaché à une étude de prix."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    etude = models.ForeignKey(
        EtudePrix,
        on_delete=models.CASCADE,
        related_name="achats",
        verbose_name="Étude de prix",
    )
    ligne_source = models.ForeignKey(
        LignePrixEtude,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="achats_proposes",
        verbose_name="Ligne de ressource source",
    )
    ordre = models.PositiveSmallIntegerField(default=1, verbose_name="Ordre")
    designation = models.CharField(max_length=300, verbose_name="Désignation")
    fournisseur = models.CharField(max_length=200, blank=True, verbose_name="Fournisseur")
    reference_fournisseur = models.CharField(max_length=80, blank=True, verbose_name="Référence fournisseur")
    unite_achat = models.CharField(max_length=30, default="u", verbose_name="Unité d'achat")
    quantite_besoin = models.DecimalField(max_digits=14, decimal_places=6, default=1)
    quantite_conditionnement = models.DecimalField(max_digits=14, decimal_places=6, default=1)
    nombre_conditionnements = models.DecimalField(max_digits=12, decimal_places=3, default=1)
    quantite_commandee = models.DecimalField(max_digits=14, decimal_places=6, default=1)
    prix_unitaire_achat_ht = models.DecimalField(max_digits=12, decimal_places=6, default=0)
    cout_total_achat_ht = models.DecimalField(max_digits=14, decimal_places=4, default=0)
    surcout_conditionnement_ht = models.DecimalField(max_digits=14, decimal_places=4, default=0)
    observations = models.TextField(blank=True)
    date_creation = models.DateTimeField(auto_now_add=True)
    date_modification = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "economie_achat_etude_prix"
        verbose_name = "Achat d'étude de prix"
        verbose_name_plural = "Achats d'étude de prix"
        ordering = ["etude", "ordre", "designation"]

    def save(self, *args, **kwargs):
        quantite_besoin = decimal.Decimal(str(self.quantite_besoin or "0"))
        conditionnement = decimal.Decimal(str(self.quantite_conditionnement or "0"))
        prix_unitaire_achat = decimal.Decimal(str(self.prix_unitaire_achat_ht or "0"))
        if conditionnement <= 0:
            conditionnement = decimal.Decimal("1")
            self.quantite_conditionnement = conditionnement

        if quantite_besoin <= 0:
            self.nombre_conditionnements = decimal.Decimal("0")
            self.quantite_commandee = decimal.Decimal("0")
            self.cout_total_achat_ht = decimal.Decimal("0")
            self.surcout_conditionnement_ht = decimal.Decimal("0")
        else:
            nombre = (quantite_besoin / conditionnement).quantize(decimal.Decimal("1"), rounding=decimal.ROUND_UP)
            quantite_commandee = nombre * conditionnement
            cout_total = nombre * prix_unitaire_achat
            cout_theorique = quantite_besoin * prix_unitaire_achat
            self.nombre_conditionnements = nombre
            self.quantite_commandee = quantite_commandee
            self.cout_total_achat_ht = cout_total
            self.surcout_conditionnement_ht = cout_total - cout_theorique

        super().save(*args, **kwargs)

    def __str__(self):
        return self.designation


class ConventionCollective(models.Model):
    """
    Convention collective paramétrable utilisée pour affiner les hypothèses
    sociales et économiques du simulateur.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=50, unique=True, verbose_name="Code convention")
    libelle = models.CharField(max_length=255, verbose_name="Libellé")
    idcc = models.CharField(max_length=20, blank=True, verbose_name="IDCC")
    localisation = models.CharField(max_length=20, choices=LOCALISATIONS_CONVENTIONNELLES, default="nationale")
    contingent_heures_supp_non_cadre = models.PositiveSmallIntegerField(default=220)
    contingent_heures_supp_cadre = models.PositiveSmallIntegerField(default=220)
    source_officielle = models.URLField(blank=True, verbose_name="Source officielle")
    observations = models.TextField(blank=True)
    est_active = models.BooleanField(default=True)
    date_creation = models.DateTimeField(auto_now_add=True)
    date_modification = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "economie_convention_collective"
        verbose_name = "Convention collective"
        verbose_name_plural = "Conventions collectives"
        ordering = ["libelle"]

    def __str__(self):
        return self.libelle


class RegleConventionnelleProfil(models.Model):
    """
    Règle conventionnelle rattachée à une convention collective et à un type de profil.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    convention = models.ForeignKey(
        ConventionCollective,
        on_delete=models.CASCADE,
        related_name="regles_profils",
    )
    code = models.CharField(max_length=50, verbose_name="Code règle")
    libelle = models.CharField(max_length=255, verbose_name="Libellé")
    categorie = models.CharField(max_length=30, choices=CATEGORIES_PROFILS_MAIN_OEUVRE, default="technicien")
    statut_cadre = models.BooleanField(default=False)
    niveau_classification = models.CharField(max_length=100, blank=True, verbose_name="Niveau / position")
    salaire_brut_minimum_mensuel = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    heures_contractuelles_mensuelles_defaut = models.DecimalField(
        max_digits=8, decimal_places=2, default=decimal.Decimal("151.67")
    )
    heures_par_jour_defaut = models.DecimalField(max_digits=5, decimal_places=2, default=decimal.Decimal("7.00"))
    mutuelle_employeur_mensuelle_defaut = models.DecimalField(max_digits=10, decimal_places=2, default=55)
    titres_restaurant_employeur_mensuels_defaut = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    prime_transport_mensuelle_defaut = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    taux_absenteisme_defaut = models.DecimalField(max_digits=6, decimal_places=4, default=decimal.Decimal("0.0300"))
    taux_temps_improductif_defaut = models.DecimalField(max_digits=6, decimal_places=4, default=decimal.Decimal("0.1200"))
    cout_recrutement_initial_defaut = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    observations = models.TextField(blank=True)
    ordre_affichage = models.PositiveSmallIntegerField(default=100)
    est_active = models.BooleanField(default=True)
    date_creation = models.DateTimeField(auto_now_add=True)
    date_modification = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "economie_regle_conventionnelle_profil"
        verbose_name = "Règle conventionnelle de profil"
        verbose_name_plural = "Règles conventionnelles de profils"
        ordering = ["convention", "ordre_affichage", "libelle"]
        unique_together = [("convention", "code")]

    def __str__(self):
        return f"{self.convention.libelle} — {self.libelle}"


class VarianteLocaleRegleConventionnelle(models.Model):
    """
    Surcharge localisée d'une règle conventionnelle.
    Permet de gérer Mayotte, la métropole ou les autres DOM sans dupliquer
    l'ensemble des conventions et profils.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    regle = models.ForeignKey(
        RegleConventionnelleProfil,
        on_delete=models.CASCADE,
        related_name="variantes_locales",
    )
    localisation = models.CharField(max_length=20, choices=LOCALISATIONS_CONVENTIONNELLES, default="metropole")
    libelle = models.CharField(max_length=255, blank=True, verbose_name="Libellé localisé")
    salaire_brut_minimum_mensuel = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    heures_contractuelles_mensuelles_defaut = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    heures_par_jour_defaut = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    taux_charges_salariales_defaut = models.DecimalField(max_digits=6, decimal_places=4, null=True, blank=True)
    taux_charges_patronales_defaut = models.DecimalField(max_digits=6, decimal_places=4, null=True, blank=True)
    mutuelle_employeur_mensuelle_defaut = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    titres_restaurant_employeur_mensuels_defaut = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    prime_transport_mensuelle_defaut = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    taux_absenteisme_defaut = models.DecimalField(max_digits=6, decimal_places=4, null=True, blank=True)
    taux_temps_improductif_defaut = models.DecimalField(max_digits=6, decimal_places=4, null=True, blank=True)
    taux_occupation_facturable_defaut = models.DecimalField(max_digits=6, decimal_places=4, null=True, blank=True)
    cout_recrutement_initial_defaut = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    source_officielle = models.URLField(blank=True, verbose_name="Source officielle")
    observations = models.TextField(blank=True)
    est_active = models.BooleanField(default=True)
    date_creation = models.DateTimeField(auto_now_add=True)
    date_modification = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "economie_variante_locale_regle_conventionnelle"
        verbose_name = "Variante locale de règle conventionnelle"
        verbose_name_plural = "Variantes locales de règles conventionnelles"
        ordering = ["regle", "localisation"]
        unique_together = [("regle", "localisation")]

    def __str__(self):
        return self.libelle or f"{self.regle.libelle} — {self.get_localisation_display()}"


class ReferenceSocialeLocalisation(models.Model):
    """
    Référentiel territorial éditable : Smic, durée légale et notes sociales
    applicables à une localisation donnée.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=50, unique=True, verbose_name="Code référentiel")
    libelle = models.CharField(max_length=255, verbose_name="Libellé")
    localisation = models.CharField(max_length=20, choices=LOCALISATIONS_CONVENTIONNELLES, unique=True)
    smic_horaire = models.DecimalField(max_digits=8, decimal_places=2, default=0, verbose_name="Smic horaire brut")
    heures_legales_mensuelles = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        default=decimal.Decimal("151.67"),
        verbose_name="Heures légales mensuelles",
    )
    commentaire_reglementaire = models.TextField(blank=True)
    source_officielle = models.URLField(blank=True, verbose_name="Source officielle")
    est_active = models.BooleanField(default=True)
    date_creation = models.DateTimeField(auto_now_add=True)
    date_modification = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "economie_reference_sociale_localisation"
        verbose_name = "Référentiel social par localisation"
        verbose_name_plural = "Référentiels sociaux par localisation"
        ordering = ["localisation", "libelle"]

    def __str__(self):
        return self.libelle


class ProfilMainOeuvre(models.Model):
    """
    Profil type de main-d'œuvre utilisé pour simuler des coûts salariaux
    et produire des taux horaires / journaliers réalistes.
    """

    CATEGORIES = CATEGORIES_PROFILS_MAIN_OEUVRE

    LOCALISATIONS = [item for item in LOCALISATIONS_CONVENTIONNELLES if item[0] != "nationale"]
    SECTEURS_ACTIVITE = [
        ("batiment", "Bâtiment"),
        ("vrd", "Voirie et réseaux divers"),
        ("maitrise_oeuvre", "Maîtrise d'œuvre / études"),
        ("entreprise_generale", "Entreprise générale"),
        ("support", "Support chantier / structure"),
        ("autre", "Autre"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=50, unique=True, verbose_name="Code profil")
    libelle = models.CharField(max_length=200, verbose_name="Libellé")
    categorie = models.CharField(max_length=30, choices=CATEGORIES, default="ouvrier")
    secteur_activite = models.CharField(
        max_length=30,
        choices=SECTEURS_ACTIVITE,
        default="batiment",
        verbose_name="Secteur d'activité",
    )
    corps_etat = models.CharField(
        max_length=120, blank=True,
        verbose_name="Corps d'état",
        help_text="Corps d'état BTP auquel ce profil est rattaché (ex : Gros Œuvre, Menuiseries, Électricité…).",
    )
    metier = models.CharField(max_length=120, blank=True, verbose_name="Métier")
    specialite = models.CharField(max_length=120, blank=True, verbose_name="Spécialité")
    niveau_classification = models.CharField(max_length=120, blank=True, verbose_name="Niveau / position")
    fonction_equipe = models.CharField(max_length=120, blank=True, verbose_name="Fonction dans l'équipe")
    description_emploi = models.TextField(blank=True, verbose_name="Description d'emploi")
    source_officielle = models.URLField(blank=True, verbose_name="Source officielle")
    localisation = models.CharField(max_length=20, choices=LOCALISATIONS, default="metropole")
    convention_collective = models.ForeignKey(
        ConventionCollective,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="profils_main_oeuvre",
    )
    regle_conventionnelle = models.ForeignKey(
        RegleConventionnelleProfil,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="profils_main_oeuvre",
    )

    salaire_brut_mensuel_defaut = models.DecimalField(max_digits=10, decimal_places=2, default=2200)
    primes_mensuelles_defaut = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    avantages_mensuels_defaut = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    heures_contractuelles_mensuelles = models.DecimalField(
        max_digits=8, decimal_places=2, default=decimal.Decimal("151.67")
    )
    heures_par_jour = models.DecimalField(max_digits=5, decimal_places=2, default=decimal.Decimal("7.00"))

    # Heures supplémentaires mensuelles par taux de majoration
    # Base conventionnelle BTP : 39h/semaine = 35h légal + 4h HS25% × 52/12 = 17,33 h/mois
    nb_heures_supp_25_mensuelles = models.DecimalField(
        max_digits=6, decimal_places=2, default=decimal.Decimal("17.33"),
        verbose_name="HS majorées à 25 % (h/mois)",
        help_text="Nombre d'heures supplémentaires mensuelles majorées à 25 % (base 39h/semaine BTP).",
    )
    nb_heures_supp_50_mensuelles = models.DecimalField(
        max_digits=6, decimal_places=2, default=decimal.Decimal("0.00"),
        verbose_name="HS majorées à 50 % (h/mois)",
        help_text="Nombre d'heures supplémentaires mensuelles majorées à 50 % (dimanches, fériés).",
    )

    # Compléments employeur mensuels
    panier_repas_journalier = models.DecimalField(
        max_digits=8, decimal_places=2, default=decimal.Decimal("9.00"),
        verbose_name="Panier repas journalier (€)",
        help_text="Montant journalier du panier repas (zone BTP, base conventionnelle).",
    )
    jours_travail_mensuels_defaut = models.DecimalField(
        max_digits=5, decimal_places=2, default=decimal.Decimal("21.67"),
        verbose_name="Jours de travail mensuels",
        help_text="Nombre moyen de jours travaillés par mois (base 260 j / 12).",
    )

    taux_charges_salariales = models.DecimalField(max_digits=6, decimal_places=4, default=decimal.Decimal("0.2200"))
    taux_charges_patronales = models.DecimalField(max_digits=6, decimal_places=4, default=decimal.Decimal("0.4200"))
    taux_absenteisme = models.DecimalField(max_digits=6, decimal_places=4, default=decimal.Decimal("0.0300"))
    taux_temps_improductif = models.DecimalField(max_digits=6, decimal_places=4, default=decimal.Decimal("0.1200"))
    taux_frais_agence = models.DecimalField(max_digits=6, decimal_places=4, default=decimal.Decimal("0.1200"))
    taux_risque_operationnel = models.DecimalField(max_digits=6, decimal_places=4, default=decimal.Decimal("0.0200"))
    taux_marge_cible = models.DecimalField(max_digits=6, decimal_places=4, default=decimal.Decimal("0.0800"))

    cout_equipement_mensuel = models.DecimalField(max_digits=10, decimal_places=2, default=80)
    cout_transport_mensuel = models.DecimalField(max_digits=10, decimal_places=2, default=50)
    cout_structure_mensuel = models.DecimalField(max_digits=10, decimal_places=2, default=250)

    est_actif = models.BooleanField(default=True)
    ordre_affichage = models.PositiveSmallIntegerField(default=100)
    date_creation = models.DateTimeField(auto_now_add=True)
    date_modification = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "economie_profil_main_oeuvre"
        verbose_name = "Profil de main-d'œuvre"
        verbose_name_plural = "Profils de main-d'œuvre"
        ordering = ["ordre_affichage", "libelle"]

    def __str__(self):
        return self.libelle

    def calculer_taux_horaire_recommande(self):
        from .services import calculer_taux_horaire_reference_profil

        return calculer_taux_horaire_reference_profil(self)


class AffectationProfilProjet(models.Model):
    """
    Affectation d'un profil de main-d'œuvre à un projet avec restitution
    des taux de vente recommandés et du coefficient K calculé.
    """

    MODES_FACTURATION = [
        ("horaire", "Taux horaire"),
        ("journalier", "Taux journalier"),
    ]

    CLIENTELES = [
        ("particulier_pme", "Particulier / petite PME"),
        ("public", "Maître d'ouvrage public"),
        ("cotraitrance", "Co-traitance"),
        ("sous_traitance", "Sous-traitance"),
        ("autre", "Autre contexte"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    projet = models.ForeignKey(
        "projets.Projet",
        on_delete=models.CASCADE,
        related_name="affectations_profils_main_oeuvre",
    )
    profil = models.ForeignKey(
        ProfilMainOeuvre,
        on_delete=models.PROTECT,
        related_name="affectations_projets",
    )
    clientele = models.CharField(max_length=20, choices=CLIENTELES, default="public")
    mode_facturation = models.CharField(max_length=20, choices=MODES_FACTURATION, default="journalier")
    charge_previsionnelle_jours = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    coefficient_k = models.DecimalField(max_digits=8, decimal_places=4, default=0)
    taux_horaire_recommande = models.DecimalField(max_digits=10, decimal_places=4, default=0)
    taux_journalier_recommande = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    dernier_calcul = models.JSONField(default=dict, blank=True)
    observations = models.TextField(blank=True)
    date_creation = models.DateTimeField(auto_now_add=True)
    date_modification = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "economie_affectation_profil_projet"
        verbose_name = "Affectation profil projet"
        verbose_name_plural = "Affectations profils projets"
        ordering = ["-date_modification"]
        unique_together = [("projet", "profil", "clientele")]

    def __str__(self):
        return f"{self.profil.libelle} — {self.projet.reference}"


class TypeClientEconomie(models.TextChoices):
    MOA_PUBLIC       = "moa_public",       "Maître d'ouvrage public"
    MOE              = "moe",              "Maître d'œuvre"
    ENTREPRISE_BTP   = "entreprise_btp",   "Entreprise BTP"


class MissionEconomique(models.Model):
    """
    Mission économique spécifique à un type de client.
    Détermine quels modules économiques sont pertinents dans le dossier d'affaire.
    """

    CODES_MISSIONS = [
        # MOA public
        ("estimation_tce",       "Estimation TCE — avant-projet"),
        ("dpgf_lots",            "DPGF — Décomposition du Prix Global par lot"),
        ("dqe_consultation",     "DQE — Détail Quantitatif Estimatif de consultation"),
        ("analyse_offres",       "Analyse comparative des offres reçues"),
        ("suivi_dgd",            "DGD — Suivi et liquidation du Décompte Général Définitif"),
        ("revision_prix",        "Révision de prix — formule paramétrique"),
        ("controle_situation",   "Contrôle des situations de travaux"),
        # MOE
        ("honoraires_moe",       "Calcul des honoraires MOE"),
        ("planning_mission",     "Planning de mission et jalons"),
        ("rapport_avancement",   "Rapport d'avancement mensuel"),
        ("mission_opc",          "Mission OPC — pilotage chantier"),
        # Entreprise
        ("etude_prix_analytique","Étude de prix analytique — DS→PV"),
        ("reponse_ao",           "Réponse à appel d'offres — BPU/DQE"),
        ("marge_lot",            "Analyse de marge par lot"),
        ("situation_travaux",    "Établissement des situations de travaux"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=40, choices=CODES_MISSIONS, unique=True)
    libelle = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    types_clients = models.JSONField(
        default=list,
        help_text="Liste des types de clients concernés : moa_public, moe, entreprise_btp",
    )
    est_actif = models.BooleanField(default=True)
    ordre = models.PositiveSmallIntegerField(default=0)

    class Meta:
        db_table = "economie_mission_economique"
        verbose_name = "Mission économique"
        ordering = ["ordre", "code"]

    def __str__(self):
        return f"{self.code} — {self.libelle}"


class DecompositionPrixInverse(models.Model):
    """
    Décomposition inverse d'un prix de vente connu.
    À partir du PV saisi, estime intelligemment DS, CD, CR, coefficients K
    en s'appuyant sur les ratios ARTIPRIX et les conventions BTP.
    """

    METHODES = [
        ("ratios_artiprix",   "Ratios ARTIPRIX 2025 — par lot/corps d'état"),
        ("ratios_manuels",    "Ratios manuels — valeurs saisies"),
        ("conventions_btp",   "Conventions collectives BTP — taux standards"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    etude = models.ForeignKey(
        EtudeEconomique, on_delete=models.CASCADE,
        related_name="decompositions_inverses", null=True, blank=True,
    )
    etude_prix = models.ForeignKey(
        EtudePrix, on_delete=models.CASCADE,
        related_name="decompositions_inverses", null=True, blank=True,
    )

    designation = models.CharField(max_length=300, verbose_name="Désignation de l'ouvrage")
    lot_type = models.CharField(max_length=10, blank=True, verbose_name="Lot / Corps d'état")
    unite = models.CharField(max_length=20, default="u")
    quantite = models.DecimalField(max_digits=14, decimal_places=3, default=1)

    # Prix connu (point de départ)
    prix_vente_unitaire_saisi = models.DecimalField(
        max_digits=12, decimal_places=4,
        verbose_name="Prix de vente unitaire HT saisi (€/unité)",
    )
    methode = models.CharField(max_length=30, choices=METHODES, default="ratios_artiprix")

    # Coefficients estimés ou saisis
    kpv_estime = models.DecimalField(
        max_digits=6, decimal_places=4, null=True, blank=True,
        verbose_name="Coefficient de vente Kpv estimé",
        help_text="PV = DS × Kpv. Kpv = 1 / (1 - taux_marge - taux_FG - taux_FC - taux_B&A)",
    )
    taux_mo_estime = models.DecimalField(
        max_digits=6, decimal_places=4, null=True, blank=True,
        verbose_name="Part MO dans DS (%)",
    )
    taux_matieres_estime = models.DecimalField(
        max_digits=6, decimal_places=4, null=True, blank=True,
        verbose_name="Part matières dans DS (%)",
    )
    taux_materiel_estime = models.DecimalField(
        max_digits=6, decimal_places=4, null=True, blank=True,
        verbose_name="Part matériel dans DS (%)",
    )
    taux_sous_traitance_estime = models.DecimalField(
        max_digits=6, decimal_places=4, null=True, blank=True,
        verbose_name="Part sous-traitance dans DS (%)",
    )

    # Résultats calculés
    debourse_sec_unitaire_calcule = models.DecimalField(max_digits=12, decimal_places=4, null=True, blank=True)
    cout_direct_unitaire_calcule = models.DecimalField(max_digits=12, decimal_places=4, null=True, blank=True)
    cout_revient_unitaire_calcule = models.DecimalField(max_digits=12, decimal_places=4, null=True, blank=True)
    marge_unitaire_calculee = models.DecimalField(max_digits=12, decimal_places=4, null=True, blank=True)
    taux_marge_calcule = models.DecimalField(max_digits=6, decimal_places=4, null=True, blank=True)

    # Coefficients résultants
    k_fc = models.DecimalField(max_digits=6, decimal_places=4, null=True, blank=True, verbose_name="Kfc (frais chantier)")
    k_fg = models.DecimalField(max_digits=6, decimal_places=4, null=True, blank=True, verbose_name="Kfg (frais généraux)")
    k_ba = models.DecimalField(max_digits=6, decimal_places=4, null=True, blank=True, verbose_name="Kba (bénéfices et aléas)")
    k_total = models.DecimalField(max_digits=6, decimal_places=4, null=True, blank=True, verbose_name="Kpv total")

    # Données source des ratios
    source_ratios = models.JSONField(default=dict, blank=True, verbose_name="Source et détail des ratios utilisés")

    commentaire = models.TextField(blank=True)
    date_calcul = models.DateTimeField(auto_now=True)
    calcule_par = models.ForeignKey(
        "comptes.Utilisateur", on_delete=models.SET_NULL, null=True, blank=True,
    )

    class Meta:
        db_table = "economie_decomposition_prix_inverse"
        verbose_name = "Décomposition inverse de prix"
        ordering = ["-date_calcul"]

    def __str__(self):
        return f"Décomposition {self.designation[:60]} — PV={self.prix_vente_unitaire_saisi} €/{self.unite}"
