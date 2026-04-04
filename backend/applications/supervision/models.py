"""
Modèles de supervision — Alertes, journaux d'activité et métriques.
Plateforme LBH — Bureau d'Études Économiste
"""

import uuid
from django.db import models


class EvenementSysteme(models.Model):
    """
    Journal d'événements système (erreurs, démarrages, migrations, etc.).
    """

    NIVEAUX = [
        ("debug", "Débogage"),
        ("info", "Information"),
        ("avertissement", "Avertissement"),
        ("erreur", "Erreur"),
        ("critique", "Critique"),
    ]

    CATEGORIES = [
        ("securite", "Sécurité"),
        ("performance", "Performance"),
        ("erreur_applicative", "Erreur applicative"),
        ("maintenance", "Maintenance"),
        ("donnees", "Données"),
        ("authentification", "Authentification"),
        ("systeme", "Système"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    niveau = models.CharField(max_length=20, choices=NIVEAUX, default="info")
    categorie = models.CharField(max_length=30, choices=CATEGORIES, default="systeme")
    message = models.TextField(verbose_name="Message")
    details = models.JSONField(null=True, blank=True, verbose_name="Détails techniques")
    source = models.CharField(max_length=200, blank=True, verbose_name="Source (module, vue)")
    adresse_ip = models.GenericIPAddressField(null=True, blank=True)
    utilisateur = models.ForeignKey(
        "comptes.Utilisateur", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="evenements_systeme",
    )
    date_evenement = models.DateTimeField(auto_now_add=True)
    resolu = models.BooleanField(default=False)
    date_resolution = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "supervision_evenement"
        verbose_name = "Événement système"
        verbose_name_plural = "Événements système"
        ordering = ["-date_evenement"]
        indexes = [
            models.Index(fields=["niveau", "date_evenement"]),
            models.Index(fields=["categorie"]),
        ]

    def __str__(self):
        return f"[{self.niveau.upper()}] {self.message[:80]}"


class MetriqueService(models.Model):
    """
    Métrique de performance d'un service (backend, celery, postgresql, etc.).
    Stocke des instantanés périodiques pour le tableau de bord de supervision.
    """

    SERVICES = [
        ("backend", "Cœur applicatif"),
        ("celery", "File de tâches Celery"),
        ("postgresql", "Base de données PostgreSQL"),
        ("redis", "Cache Redis"),
        ("minio", "Stockage MinIO"),
        ("frontend", "Interface utilisateur"),
    ]

    service = models.CharField(max_length=30, choices=SERVICES)
    disponible = models.BooleanField(default=True, verbose_name="Service disponible")
    temps_reponse_ms = models.PositiveIntegerField(
        null=True, blank=True, verbose_name="Temps de réponse (ms)",
    )
    charge_cpu_pct = models.DecimalField(
        max_digits=5, decimal_places=2,
        null=True, blank=True, verbose_name="Charge CPU (%)",
    )
    memoire_pct = models.DecimalField(
        max_digits=5, decimal_places=2,
        null=True, blank=True, verbose_name="Mémoire utilisée (%)",
    )
    details = models.JSONField(null=True, blank=True)
    horodatage = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "supervision_metrique"
        verbose_name = "Métrique de service"
        verbose_name_plural = "Métriques de services"
        ordering = ["-horodatage"]
        indexes = [models.Index(fields=["service", "horodatage"])]

    def __str__(self):
        etat = "✓" if self.disponible else "✗"
        return f"{etat} {self.service} — {self.horodatage.strftime('%d/%m %H:%M')}"


class AlerteSupervision(models.Model):
    """
    Alerte déclenchée automatiquement par la supervision.
    """

    TYPES = [
        ("service_indisponible", "Service indisponible"),
        ("performance_degradee", "Performance dégradée"),
        ("espace_disque", "Espace disque critique"),
        ("erreurs_repetees", "Erreurs répétées"),
        ("tentatives_connexion", "Tentatives de connexion suspectes"),
        ("tache_bloquee", "Tâche Celery bloquée"),
        ("certificat_expiration", "Certificat SSL proche de l'expiration"),
    ]

    NIVEAUX = [
        ("info", "Information"),
        ("avertissement", "Avertissement"),
        ("critique", "Critique"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    type_alerte = models.CharField(max_length=40, choices=TYPES)
    niveau = models.CharField(max_length=20, choices=NIVEAUX, default="avertissement")
    titre = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    service_concerne = models.CharField(max_length=100, blank=True)
    est_active = models.BooleanField(default=True, verbose_name="Alerte active")
    date_declenchement = models.DateTimeField(auto_now_add=True)
    date_resolution = models.DateTimeField(null=True, blank=True)
    acquittee_par = models.ForeignKey(
        "comptes.Utilisateur", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="alertes_acquittees",
    )

    class Meta:
        db_table = "supervision_alerte"
        verbose_name = "Alerte de supervision"
        verbose_name_plural = "Alertes de supervision"
        ordering = ["-date_declenchement"]

    def __str__(self):
        return f"{self.titre} ({self.niveau})"


class InstantaneServeur(models.Model):
    """
    Instantané périodique de la charge du serveur hôte.
    Utilisé pour afficher des graphiques d'évolution sur la page supervision.
    """

    charge_cpu_pct = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        verbose_name="Charge CPU (%)",
    )
    memoire_pct = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        verbose_name="Mémoire utilisée (%)",
    )
    disque_pct = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        verbose_name="Espace disque utilisé (%)",
    )
    charge_moyenne_1m = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name="Charge moyenne 1 min",
    )
    charge_moyenne_5m = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name="Charge moyenne 5 min",
    )
    charge_moyenne_15m = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name="Charge moyenne 15 min",
    )
    memoire_totale_octets = models.BigIntegerField(
        null=True,
        blank=True,
        verbose_name="Mémoire totale (octets)",
    )
    memoire_utilisee_octets = models.BigIntegerField(
        null=True,
        blank=True,
        verbose_name="Mémoire utilisée (octets)",
    )
    disque_total_octets = models.BigIntegerField(
        null=True,
        blank=True,
        verbose_name="Espace disque total (octets)",
    )
    disque_utilise_octets = models.BigIntegerField(
        null=True,
        blank=True,
        verbose_name="Espace disque utilisé (octets)",
    )
    details = models.JSONField(null=True, blank=True, verbose_name="Détails")
    horodatage = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "supervision_instantane_serveur"
        verbose_name = "Instantané serveur"
        verbose_name_plural = "Instantanés serveur"
        ordering = ["-horodatage"]
        indexes = [models.Index(fields=["horodatage"])]

    def __str__(self):
        return f"Serveur {self.horodatage:%d/%m/%Y %H:%M}"


class ServeurMail(models.Model):
    """
    Configuration des services de messagerie utilises par la plateforme.
    """

    CHIFFREMENTS = [
        ("aucun", "Aucun"),
        ("starttls", "STARTTLS"),
        ("ssl_tls", "SSL / TLS"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    nom = models.CharField(max_length=120, verbose_name="Nom")
    hote = models.CharField(max_length=255, verbose_name="Hôte SMTP")
    port = models.PositiveIntegerField(default=587, verbose_name="Port")
    chiffrement = models.CharField(
        max_length=20,
        choices=CHIFFREMENTS,
        default="starttls",
        verbose_name="Chiffrement",
    )
    utilisateur = models.CharField(max_length=255, blank=True, verbose_name="Utilisateur")
    mot_de_passe = models.TextField(blank=True, verbose_name="Mot de passe")
    expediteur_defaut = models.EmailField(blank=True, verbose_name="Expéditeur par défaut")
    reponse_a = models.EmailField(blank=True, verbose_name="Adresse de réponse")
    delai_connexion = models.PositiveIntegerField(default=15, verbose_name="Délai de connexion (s)")
    verifier_certificat = models.BooleanField(default=True, verbose_name="Vérifier le certificat TLS")
    imap_hote = models.CharField(max_length=255, blank=True, verbose_name="Hôte IMAP")
    imap_port = models.PositiveIntegerField(default=993, verbose_name="Port IMAP")
    imap_chiffrement = models.CharField(
        max_length=20,
        choices=CHIFFREMENTS,
        default="ssl_tls",
        verbose_name="Chiffrement IMAP",
    )
    imap_utilisateur = models.CharField(max_length=255, blank=True, verbose_name="Utilisateur IMAP")
    imap_mot_de_passe = models.TextField(blank=True, verbose_name="Mot de passe IMAP")
    imap_verifier_certificat = models.BooleanField(default=True, verbose_name="Vérifier le certificat IMAP")
    imap_dossier_envoyes = models.CharField(max_length=120, blank=True, verbose_name="Dossier IMAP des envoyés")
    imap_dossier_brouillons = models.CharField(max_length=120, blank=True, verbose_name="Dossier IMAP des brouillons")
    imap_dossier_archives = models.CharField(max_length=120, blank=True, verbose_name="Dossier IMAP des archives")
    imap_dossier_indesirables = models.CharField(max_length=120, blank=True, verbose_name="Dossier IMAP des indésirables")
    imap_dossier_corbeille = models.CharField(max_length=120, blank=True, verbose_name="Dossier IMAP de la corbeille")
    usage_envoi_plateforme = models.BooleanField(default=True, verbose_name="Envoi des courriels de la plateforme")
    usage_notifications = models.BooleanField(default=True, verbose_name="Envoi des notifications")
    est_actif = models.BooleanField(default=True, verbose_name="Serveur actif")
    est_defaut = models.BooleanField(default=False, verbose_name="Serveur par défaut")
    notes = models.TextField(blank=True, verbose_name="Notes")
    date_creation = models.DateTimeField(auto_now_add=True)
    date_modification = models.DateTimeField(auto_now=True)
    modifie_par = models.ForeignKey(
        "comptes.Utilisateur",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="serveurs_mail_modifies",
        verbose_name="Modifié par",
    )

    class Meta:
        db_table = "supervision_serveur_mail"
        verbose_name = "Serveur de mail"
        verbose_name_plural = "Serveurs de mail"
        ordering = ["-est_defaut", "nom"]
        indexes = [
            models.Index(fields=["est_actif", "est_defaut"]),
            models.Index(fields=["nom"]),
        ]

    def __str__(self):
        suffixe = " (défaut)" if self.est_defaut else ""
        return f"{self.nom} — {self.hote}:{self.port}{suffixe}"
