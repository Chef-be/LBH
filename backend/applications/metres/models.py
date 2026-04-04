"""
Modèles des métrés — Quantitatifs et métrés de travaux.
Plateforme BEE — Bureau d'Études Économiste
"""

import uuid
from django.db import models


class Metre(models.Model):
    """
    Métré — document de quantification des ouvrages d'un projet.
    Peut être un avant-métré, un métré définitif ou un métré contradictoire.
    """

    TYPES = [
        ("avant_metre", "Avant-métré (estimatif)"),
        ("metre_definitif", "Métré définitif (descriptif)"),
        ("metre_contradictoire", "Métré contradictoire"),
        ("metre_travaux_en_cours", "Situation de travaux"),
        ("metre_decompte", "Décompte général définitif"),
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
