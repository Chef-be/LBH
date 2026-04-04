"""
Modèles de comptes : utilisateurs, profils, droits et activation sécurisée.
"""

import secrets
import uuid
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone


class GestionnaireUtilisateur(BaseUserManager):
    """Gestionnaire personnalisé — le courriel remplace le nom d'utilisateur."""

    def create_user(self, courriel: str, password: str = None, **champs_supplementaires):
        if not courriel:
            raise ValueError("L'adresse de courriel est obligatoire.")
        courriel = self.normalize_email(courriel)
        utilisateur = self.model(courriel=courriel, **champs_supplementaires)
        utilisateur.set_password(password)
        utilisateur.save(using=self._db)
        return utilisateur

    def create_superuser(self, courriel: str, password: str = None, **champs_supplementaires):
        champs_supplementaires.setdefault("est_staff", True)
        champs_supplementaires.setdefault("est_super_admin", True)
        champs_supplementaires.setdefault("is_superuser", True)
        return self.create_user(courriel, password, **champs_supplementaires)


class Utilisateur(AbstractBaseUser, PermissionsMixin):
    """
    Utilisateur de la plateforme.
    Le courriel sert d'identifiant de connexion.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    courriel = models.EmailField(unique=True, verbose_name="Adresse de courriel")
    prenom = models.CharField(max_length=100, verbose_name="Prénom")
    nom = models.CharField(max_length=100, verbose_name="Nom")
    telephone = models.CharField(max_length=20, blank=True, verbose_name="Téléphone")
    fonction = models.CharField(max_length=200, blank=True, verbose_name="Fonction")
    avatar = models.ImageField(upload_to="avatars/", null=True, blank=True)

    # Organisation principale (FK déclarée en chaîne pour éviter l'import circulaire)
    organisation = models.ForeignKey(
        "organisations.Organisation",
        on_delete=models.PROTECT,
        null=True, blank=True,
        related_name="membres",
        verbose_name="Organisation principale",
    )

    # Profil de droits
    profil = models.ForeignKey(
        "ProfilDroit",
        on_delete=models.PROTECT,
        null=True, blank=True,
        related_name="utilisateurs",
        verbose_name="Profil de droits",
    )

    # Statut
    est_actif = models.BooleanField(default=True, verbose_name="Compte actif")
    est_staff = models.BooleanField(default=False)
    est_super_admin = models.BooleanField(default=False, verbose_name="Super-administrateur")

    # Suivi des connexions
    date_creation = models.DateTimeField(auto_now_add=True)
    date_modification = models.DateTimeField(auto_now=True)
    courriel_verifie_le = models.DateTimeField(null=True, blank=True)
    invitation_envoyee_le = models.DateTimeField(null=True, blank=True)
    derniere_connexion_ip = models.GenericIPAddressField(null=True, blank=True)
    tentatives_connexion = models.PositiveSmallIntegerField(default=0)
    verrouille_jusqu_au = models.DateTimeField(null=True, blank=True)

    # Préférences
    langue = models.CharField(max_length=5, default="fr", verbose_name="Langue")
    fuseau_horaire = models.CharField(max_length=50, default="Europe/Paris")
    notifications_courriel = models.BooleanField(default=True)

    objects = GestionnaireUtilisateur()

    USERNAME_FIELD = "courriel"
    REQUIRED_FIELDS = ["prenom", "nom"]

    class Meta:
        db_table = "comptes_utilisateur"
        verbose_name = "Utilisateur"
        verbose_name_plural = "Utilisateurs"
        ordering = ["nom", "prenom"]

    def __str__(self):
        return f"{self.prenom} {self.nom} <{self.courriel}>"

    @property
    def nom_complet(self) -> str:
        return f"{self.prenom} {self.nom}".strip()

    @property
    def est_verrouille(self) -> bool:
        if self.verrouille_jusqu_au and self.verrouille_jusqu_au > timezone.now():
            return True
        return False

    @property
    def is_active(self):
        return self.est_actif

    @property
    def is_staff(self):
        return self.est_staff or self.est_super_admin

    @property
    def invitation_en_attente(self) -> bool:
        return self.invitations.filter(utilise_le__isnull=True, expire_le__gt=timezone.now()).exists()

    def a_droit(self, code_droit: str) -> bool:
        """
        Vérifie si l'utilisateur possède un droit spécifique.
        Priorité : super-admin > droit individuel > droit profil > refus.
        """
        if self.est_super_admin:
            return True
        # Droits individuels explicites (surcharge du profil)
        droit_indiv = self.droits_individuels.filter(code=code_droit).first()
        if droit_indiv is not None:
            return droit_indiv.accorde
        # Droits du profil
        if self.profil:
            droit_profil = self.profil.droits.filter(code=code_droit).first()
            if droit_profil:
                return droit_profil.accorde
        return False


class ProfilDroit(models.Model):
    """Profil de droits prédéfini (ECONOMISTE_SR, CLIENT, etc.)"""

    CODE_PROFILS = [
        ("SUPER_ADMIN", "Administrateur système"),
        ("ADMIN_BUREAU", "Administrateur du bureau"),
        ("DIRECTEUR_TECH", "Directeur technique"),
        ("ECONOMISTE_SR", "Économiste senior"),
        ("ECONOMISTE_JR", "Économiste junior"),
        ("CHARGE_AFFAIRES", "Chargé d'affaires"),
        ("CONDUCTEUR_TRAVAUX", "Conducteur de travaux"),
        ("REDACTEUR_TECH", "Rédacteur technique"),
        ("CLIENT", "Client / Maître d'ouvrage"),
        ("PARTENAIRE", "Partenaire / Co-traitant"),
        ("SOUS_TRAITANT", "Sous-traitant"),
        ("LECTURE_SEULE", "Visiteur — lecture seule"),
    ]

    code = models.CharField(max_length=50, unique=True, choices=CODE_PROFILS)
    libelle = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    est_actif = models.BooleanField(default=True)
    ordre_affichage = models.PositiveSmallIntegerField(default=100)

    class Meta:
        db_table = "comptes_profil_droit"
        verbose_name = "Profil de droits"
        verbose_name_plural = "Profils de droits"
        ordering = ["ordre_affichage", "libelle"]

    def __str__(self):
        return self.libelle


class DroitFin(models.Model):
    """Droit fin — grain élémentaire d'autorisation."""

    code = models.CharField(max_length=100, verbose_name="Code du droit")
    module = models.CharField(max_length=100, verbose_name="Module")
    action = models.CharField(max_length=100, verbose_name="Action")
    libelle = models.CharField(max_length=200)
    accorde = models.BooleanField(default=True)

    profil = models.ForeignKey(
        ProfilDroit, on_delete=models.CASCADE,
        null=True, blank=True, related_name="droits",
    )
    utilisateur = models.ForeignKey(
        Utilisateur, on_delete=models.CASCADE,
        null=True, blank=True, related_name="droits_individuels",
    )

    class Meta:
        db_table = "comptes_droit_fin"
        verbose_name = "Droit fin"
        verbose_name_plural = "Droits fins"

    def __str__(self):
        cible = self.profil or self.utilisateur
        return f"{self.code} → {'✅' if self.accorde else '❌'} ({cible})"


class JournalConnexion(models.Model):
    """Journal des connexions pour audit de sécurité."""

    utilisateur = models.ForeignKey(
        Utilisateur, on_delete=models.SET_NULL,
        null=True, related_name="journal_connexions",
    )
    courriel_saisi = models.EmailField()
    date_tentative = models.DateTimeField(auto_now_add=True)
    succes = models.BooleanField()
    adresse_ip = models.GenericIPAddressField(null=True, blank=True)
    agent_navigateur = models.TextField(blank=True)
    motif_echec = models.CharField(max_length=200, blank=True)

    class Meta:
        db_table = "comptes_journal_connexion"
        verbose_name = "Journal de connexion"
        verbose_name_plural = "Journaux de connexion"
        ordering = ["-date_tentative"]


class InvitationUtilisateur(models.Model):
    """Jeton d'invitation permettant l'activation d'un compte utilisateur."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    utilisateur = models.ForeignKey(
        Utilisateur,
        on_delete=models.CASCADE,
        related_name="invitations",
    )
    courriel = models.EmailField()
    token = models.CharField(max_length=128, unique=True, db_index=True)
    cree_par = models.ForeignKey(
        Utilisateur,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="invitations_emises",
    )
    date_creation = models.DateTimeField(auto_now_add=True)
    expire_le = models.DateTimeField()
    utilise_le = models.DateTimeField(null=True, blank=True)
    message_id = models.CharField(max_length=255, blank=True)

    class Meta:
        db_table = "comptes_invitation_utilisateur"
        verbose_name = "Invitation utilisateur"
        verbose_name_plural = "Invitations utilisateurs"
        ordering = ["-date_creation"]

    def __str__(self):
        return f"Invitation {self.courriel}"

    @property
    def est_valide(self) -> bool:
        return self.utilise_le is None and self.expire_le > timezone.now()

    @classmethod
    def generer_token(cls) -> str:
        while True:
            token = secrets.token_urlsafe(32)
            if not cls.objects.filter(token=token).exists():
                return token


class JetonReinitialisationMotDePasse(models.Model):
    """Jeton temporaire pour réinitialiser un mot de passe oublié."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    utilisateur = models.ForeignKey(
        Utilisateur,
        on_delete=models.CASCADE,
        related_name="jetons_reinitialisation",
    )
    courriel = models.EmailField()
    token = models.CharField(max_length=128, unique=True, db_index=True)
    date_creation = models.DateTimeField(auto_now_add=True)
    expire_le = models.DateTimeField()
    utilise_le = models.DateTimeField(null=True, blank=True)
    message_id = models.CharField(max_length=255, blank=True)

    class Meta:
        db_table = "comptes_jeton_reinitialisation"
        verbose_name = "Jeton de réinitialisation"
        verbose_name_plural = "Jetons de réinitialisation"
        ordering = ["-date_creation"]

    def __str__(self):
        return f"Réinitialisation {self.courriel}"

    @property
    def est_valide(self) -> bool:
        return self.utilise_le is None and self.expire_le > timezone.now()

    @classmethod
    def generer_token(cls) -> str:
        while True:
            token = secrets.token_urlsafe(32)
            if not cls.objects.filter(token=token).exists():
                return token
