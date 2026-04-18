"""
Module Pilotage Société — Honoraires, devis, facturation, trésorerie.
Plateforme LBH — Bureau d'Études Économiste
"""

import uuid
from decimal import Decimal
from django.db import models
from django.utils import timezone


# ─────────────────────────────────────────────
# Profils horaires
# ─────────────────────────────────────────────

class ProfilHoraire(models.Model):
    """
    Profil de facturation avec taux horaire.
    Chaque profil correspond à un type d'intervenant (économiste senior, chef de projet…).
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=50, unique=True, verbose_name="Code")
    libelle = models.CharField(max_length=150, verbose_name="Libellé")
    description = models.TextField(blank=True, verbose_name="Description")
    taux_horaire_ht = models.DecimalField(
        max_digits=8, decimal_places=2, verbose_name="Taux horaire HT (€/h)"
    )
    couleur = models.CharField(max_length=7, default="#6366f1", verbose_name="Couleur affichage")
    actif = models.BooleanField(default=True, verbose_name="Actif")
    ordre = models.PositiveSmallIntegerField(default=0, verbose_name="Ordre d'affichage")
    date_creation = models.DateTimeField(auto_now_add=True)
    date_modification = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "societe_profil_horaire"
        verbose_name = "Profil horaire"
        verbose_name_plural = "Profils horaires"
        ordering = ["ordre", "libelle"]

    def __str__(self):
        return f"{self.libelle} — {self.taux_horaire_ht} €/h"


# ─────────────────────────────────────────────
# Devis d'honoraires
# ─────────────────────────────────────────────

class DevisHonoraires(models.Model):
    """
    Devis d'honoraires émis par le cabinet pour une mission.
    Peut être lié à un projet existant ou être autonome (prospection).
    """

    STATUTS = [
        ("brouillon", "Brouillon"),
        ("envoye", "Envoyé"),
        ("accepte", "Accepté"),
        ("refuse", "Refusé"),
        ("expire", "Expiré"),
        ("annule", "Annulé"),
    ]

    TAUX_TVA = [
        (Decimal("0.20"), "20 %"),
        (Decimal("0.10"), "10 %"),
        (Decimal("0.055"), "5,5 %"),
        (Decimal("0.00"), "Exonéré (0 %)"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    reference = models.CharField(
        max_length=30, unique=True, verbose_name="Référence",
        help_text="Ex : DVZ-2026-001"
    )
    projet = models.ForeignKey(
        "projets.Projet", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="devis_honoraires", verbose_name="Projet lié"
    )
    intitule = models.CharField(max_length=300, verbose_name="Intitulé de la mission")
    statut = models.CharField(max_length=20, choices=STATUTS, default="brouillon")

    # Client destinataire
    client_nom = models.CharField(max_length=200, verbose_name="Nom du client")
    client_contact = models.CharField(max_length=150, blank=True, verbose_name="Interlocuteur")
    client_email = models.EmailField(blank=True, verbose_name="Email")
    client_telephone = models.CharField(max_length=20, blank=True, verbose_name="Téléphone")
    client_adresse = models.TextField(blank=True, verbose_name="Adresse")

    # Dates
    date_emission = models.DateField(default=timezone.now, verbose_name="Date d'émission")
    date_validite = models.DateField(verbose_name="Date de validité")
    date_acceptation = models.DateField(null=True, blank=True, verbose_name="Date d'acceptation")
    date_refus = models.DateField(null=True, blank=True, verbose_name="Date de refus")

    # Conditions financières
    taux_tva = models.DecimalField(
        max_digits=5, decimal_places=3, choices=TAUX_TVA, default=Decimal("0.20"),
        verbose_name="Taux TVA"
    )
    acompte_pct = models.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal("30.00"),
        verbose_name="Acompte à la commande (%)"
    )
    delai_paiement_jours = models.PositiveSmallIntegerField(
        default=30, verbose_name="Délai de paiement (jours)"
    )

    # Totaux (recalculés à chaque sauvegarde des lignes)
    montant_ht = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))
    montant_tva = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))
    montant_ttc = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))

    # Textes libres
    objet = models.TextField(blank=True, verbose_name="Objet / contexte de la mission")
    conditions_particulieres = models.TextField(blank=True, verbose_name="Conditions particulières")
    notes_internes = models.TextField(blank=True, verbose_name="Notes internes")

    cree_par = models.ForeignKey(
        "comptes.Utilisateur", on_delete=models.PROTECT,
        null=True, related_name="devis_crees"
    )
    date_creation = models.DateTimeField(auto_now_add=True)
    date_modification = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "societe_devis_honoraires"
        verbose_name = "Devis d'honoraires"
        verbose_name_plural = "Devis d'honoraires"
        ordering = ["-date_emission"]

    def __str__(self):
        return f"{self.reference} — {self.intitule}"

    def recalculer_totaux(self):
        """Recalcule les totaux depuis les lignes."""
        ht = sum(l.montant_ht for l in self.lignes.all())
        tva = ht * self.taux_tva
        self.montant_ht = ht
        self.montant_tva = tva.quantize(Decimal("0.01"))
        self.montant_ttc = (ht + tva).quantize(Decimal("0.01"))
        self.save(update_fields=["montant_ht", "montant_tva", "montant_ttc"])


class LigneDevis(models.Model):
    """
    Ligne d'un devis d'honoraires.
    Peut être calculée par heures × taux ou en forfait direct.
    """

    TYPES = [
        ("horaire", "Rémunération horaire"),
        ("forfait", "Forfait"),
        ("frais", "Remboursement de frais"),
        ("sous_traitance", "Sous-traitance"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    devis = models.ForeignKey(
        DevisHonoraires, on_delete=models.CASCADE, related_name="lignes"
    )
    ordre = models.PositiveSmallIntegerField(default=0)
    type_ligne = models.CharField(max_length=20, choices=TYPES, default="horaire")

    # Phase ou section libre
    phase_code = models.CharField(max_length=30, blank=True, verbose_name="Code phase")
    intitule = models.CharField(max_length=300, verbose_name="Intitulé")
    description = models.TextField(blank=True, verbose_name="Description")

    # Calcul horaire
    profil = models.ForeignKey(
        ProfilHoraire, on_delete=models.SET_NULL, null=True, blank=True,
        verbose_name="Profil intervenant"
    )
    nb_heures = models.DecimalField(
        max_digits=8, decimal_places=2, null=True, blank=True,
        verbose_name="Nombre d'heures"
    )
    taux_horaire = models.DecimalField(
        max_digits=8, decimal_places=2, null=True, blank=True,
        verbose_name="Taux horaire HT (€/h)"
    )

    # Forfait ou frais
    montant_unitaire_ht = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True,
        verbose_name="Prix unitaire HT"
    )
    quantite = models.DecimalField(
        max_digits=8, decimal_places=2, default=Decimal("1"),
        verbose_name="Quantité"
    )
    unite = models.CharField(max_length=30, default="forfait", verbose_name="Unité")

    # Résultat
    montant_ht = models.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal("0"),
        verbose_name="Montant HT"
    )

    class Meta:
        db_table = "societe_ligne_devis"
        verbose_name = "Ligne de devis"
        verbose_name_plural = "Lignes de devis"
        ordering = ["devis", "ordre"]

    def __str__(self):
        return f"{self.devis.reference} — {self.intitule}"

    def calculer_montant(self):
        """Calcule le montant HT selon le type de ligne."""
        if self.type_ligne == "horaire" and self.nb_heures and self.taux_horaire:
            self.montant_ht = (self.nb_heures * self.taux_horaire).quantize(Decimal("0.01"))
        elif self.montant_unitaire_ht is not None:
            self.montant_ht = (self.quantite * self.montant_unitaire_ht).quantize(Decimal("0.01"))
        return self.montant_ht


# ─────────────────────────────────────────────
# Facturation
# ─────────────────────────────────────────────

class Facture(models.Model):
    """
    Facture d'honoraires émise par le cabinet.
    Peut être générée depuis un devis accepté ou créée manuellement.
    """

    STATUTS = [
        ("brouillon", "Brouillon"),
        ("emise", "Émise"),
        ("en_retard", "En retard"),
        ("partiellement_payee", "Partiellement payée"),
        ("payee", "Payée"),
        ("annulee", "Annulée"),
        ("avoir", "Avoir"),
    ]

    TAUX_TVA = [
        (Decimal("0.20"), "20 %"),
        (Decimal("0.10"), "10 %"),
        (Decimal("0.055"), "5,5 %"),
        (Decimal("0.00"), "Exonéré (0 %)"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    reference = models.CharField(max_length=30, unique=True, verbose_name="Référence")
    devis = models.ForeignKey(
        DevisHonoraires, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="factures", verbose_name="Devis d'origine"
    )
    projet = models.ForeignKey(
        "projets.Projet", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="factures", verbose_name="Projet lié"
    )
    intitule = models.CharField(max_length=300, verbose_name="Intitulé")
    statut = models.CharField(max_length=25, choices=STATUTS, default="brouillon")

    # Client (copié depuis le devis ou saisi manuellement)
    client_nom = models.CharField(max_length=200, verbose_name="Nom du client")
    client_contact = models.CharField(max_length=150, blank=True)
    client_email = models.EmailField(blank=True)
    client_adresse = models.TextField(blank=True)

    # Dates
    date_emission = models.DateField(default=timezone.now, verbose_name="Date d'émission")
    date_echeance = models.DateField(verbose_name="Date d'échéance")

    # Jalons de relance (renseignés automatiquement)
    date_relance_1 = models.DateField(null=True, blank=True, verbose_name="1re relance")
    date_relance_2 = models.DateField(null=True, blank=True, verbose_name="2e relance")
    date_relance_3 = models.DateField(null=True, blank=True, verbose_name="3e relance")

    # Conditions
    taux_tva = models.DecimalField(
        max_digits=5, decimal_places=3, choices=TAUX_TVA, default=Decimal("0.20")
    )
    penalites_retard_pct = models.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal("3.00"),
        verbose_name="Taux pénalités de retard (%)"
    )

    # Montants
    montant_ht = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))
    montant_tva = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))
    montant_ttc = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))
    montant_paye = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))

    notes = models.TextField(blank=True, verbose_name="Notes / mentions légales")
    notes_internes = models.TextField(blank=True)

    cree_par = models.ForeignKey(
        "comptes.Utilisateur", on_delete=models.PROTECT,
        null=True, related_name="factures_creees"
    )
    date_creation = models.DateTimeField(auto_now_add=True)
    date_modification = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "societe_facture"
        verbose_name = "Facture"
        verbose_name_plural = "Factures"
        ordering = ["-date_emission"]

    def __str__(self):
        return f"{self.reference} — {self.client_nom}"

    @property
    def montant_restant(self):
        return self.montant_ttc - self.montant_paye

    @property
    def est_en_retard(self):
        from datetime import date
        return (
            self.statut in ("emise", "partiellement_payee")
            and self.date_echeance < date.today()
        )

    def recalculer_totaux(self):
        ht = sum(l.montant_ht for l in self.lignes.all())
        tva = ht * self.taux_tva
        self.montant_ht = ht
        self.montant_tva = tva.quantize(Decimal("0.01"))
        self.montant_ttc = (ht + tva).quantize(Decimal("0.01"))
        self.save(update_fields=["montant_ht", "montant_tva", "montant_ttc"])

    def mettre_a_jour_statut(self):
        """Met à jour le statut selon les paiements enregistrés."""
        if self.statut in ("brouillon", "annulee", "avoir"):
            return
        restant = self.montant_restant
        if restant <= 0:
            self.statut = "payee"
        elif self.montant_paye > 0:
            self.statut = "partiellement_payee"
        elif self.est_en_retard:
            self.statut = "en_retard"
        else:
            self.statut = "emise"
        self.save(update_fields=["statut"])


class LigneFacture(models.Model):
    """Ligne d'une facture d'honoraires."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    facture = models.ForeignKey(Facture, on_delete=models.CASCADE, related_name="lignes")
    ordre = models.PositiveSmallIntegerField(default=0)
    intitule = models.CharField(max_length=300, verbose_name="Désignation")
    description = models.TextField(blank=True)
    quantite = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("1"))
    unite = models.CharField(max_length=30, default="forfait")
    prix_unitaire_ht = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))
    montant_ht = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))

    class Meta:
        db_table = "societe_ligne_facture"
        verbose_name = "Ligne de facture"
        verbose_name_plural = "Lignes de facture"
        ordering = ["facture", "ordre"]

    def calculer_montant(self):
        self.montant_ht = (self.quantite * self.prix_unitaire_ht).quantize(Decimal("0.01"))
        return self.montant_ht


# ─────────────────────────────────────────────
# Paiements
# ─────────────────────────────────────────────

class Paiement(models.Model):
    """Enregistrement d'un encaissement sur une facture."""

    MODES = [
        ("virement", "Virement bancaire"),
        ("cheque", "Chèque"),
        ("especes", "Espèces"),
        ("carte", "Carte bancaire"),
        ("prelevement", "Prélèvement automatique"),
        ("autre", "Autre"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    facture = models.ForeignKey(Facture, on_delete=models.CASCADE, related_name="paiements")
    date_paiement = models.DateField(verbose_name="Date de paiement")
    montant = models.DecimalField(max_digits=12, decimal_places=2, verbose_name="Montant encaissé TTC")
    mode = models.CharField(max_length=20, choices=MODES, default="virement")
    reference = models.CharField(
        max_length=100, blank=True, verbose_name="Référence",
        help_text="Numéro de virement, chèque, etc."
    )
    notes = models.TextField(blank=True)
    enregistre_par = models.ForeignKey(
        "comptes.Utilisateur", on_delete=models.PROTECT, null=True
    )
    date_creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "societe_paiement"
        verbose_name = "Paiement"
        verbose_name_plural = "Paiements"
        ordering = ["-date_paiement"]

    def __str__(self):
        return f"{self.facture.reference} — {self.montant} € le {self.date_paiement}"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        # Recalculer le montant payé sur la facture
        total_paye = sum(p.montant for p in self.facture.paiements.all())
        self.facture.montant_paye = total_paye
        self.facture.save(update_fields=["montant_paye"])
        self.facture.mettre_a_jour_statut()
