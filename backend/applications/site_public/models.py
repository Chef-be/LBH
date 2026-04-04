"""
Modèles du site vitrine public — Plateforme BEE.
Contenu éditorial du site public : configuration, prestations, réalisations,
équipe, statistiques, démarche, RGPD, pages statiques.
"""

import uuid
from pathlib import Path
from django.db import models
from django.core.files.storage import default_storage
from django.utils import timezone
from django.utils.text import slugify
from .contenu_accueil import contenu_accueil_par_defaut
from .contenus_pages import contenus_pages_par_defaut


# ---------------------------------------------------------------------------
# Configuration générale du site (singleton — toujours id=1)
# ---------------------------------------------------------------------------

class ConfigurationSite(models.Model):
    """
    Configuration générale du site vitrine (singleton).
    Un seul enregistrement doit exister (id=1).
    Toutes les modifications sont traçées via JournalModification.
    """

    # Identité
    nom_bureau = models.CharField(
        max_length=200, blank=True, default="", verbose_name="Nom du bureau d'études"
    )
    slogan = models.CharField(max_length=500, blank=True, verbose_name="Slogan")
    sigle = models.CharField(
        max_length=12,
        blank=True,
        default="",
        verbose_name="Sigle de remplacement",
        help_text="Utilisé si aucun logo n'est chargé.",
    )
    description_courte = models.TextField(
        blank=True, verbose_name="Description courte"
    )

    # Médias
    logo = models.ImageField(
        upload_to="site_public/logo/", null=True, blank=True, verbose_name="Logo"
    )
    logo_pied_de_page = models.ImageField(
        upload_to="site_public/logo/",
        null=True, blank=True,
        verbose_name="Logo pied de page (optionnel — utilise logo principal si absent)",
    )
    favicon = models.ImageField(
        upload_to="site_public/favicon/", null=True, blank=True, verbose_name="Favicon"
    )

    # Section héros
    titre_hero = models.CharField(
        max_length=300,
        default="",
        verbose_name="Titre du héros",
    )
    sous_titre_hero = models.TextField(
        blank=True,
        verbose_name="Sous-titre du héros",
        default="",
    )
    texte_cta_principal = models.CharField(
        max_length=100, blank=True, default="", verbose_name="Texte du bouton principal"
    )
    texte_cta_secondaire = models.CharField(
        max_length=100, blank=True, default="", verbose_name="Texte du bouton secondaire"
    )
    etiquette_hero = models.CharField(
        max_length=200,
        blank=True,
        default="",
        verbose_name="Étiquette héros (bandeau discret au-dessus du titre)",
    )

    # Coordonnées affichées dans le pied de page
    courriel_contact = models.EmailField(blank=True, verbose_name="Courriel de contact")
    telephone_contact = models.CharField(
        max_length=30, blank=True, verbose_name="Téléphone de contact"
    )
    adresse = models.TextField(blank=True, verbose_name="Adresse")
    ville = models.CharField(max_length=100, blank=True, verbose_name="Ville")
    code_postal = models.CharField(max_length=10, blank=True, verbose_name="Code postal")
    pays = models.CharField(max_length=100, blank=True, default="", verbose_name="Pays")

    # Sections activables/désactivables
    afficher_stats = models.BooleanField(
        default=True, verbose_name="Afficher les chiffres clés"
    )
    afficher_valeurs = models.BooleanField(
        default=True, verbose_name="Afficher les valeurs / avantages"
    )
    afficher_demarche = models.BooleanField(
        default=True, verbose_name="Afficher la section démarche"
    )
    afficher_realisations = models.BooleanField(
        default=False, verbose_name="Afficher les réalisations"
    )
    afficher_equipe = models.BooleanField(
        default=False, verbose_name="Afficher la section équipe"
    )
    afficher_contact = models.BooleanField(
        default=True, verbose_name="Afficher le formulaire de contact"
    )
    texte_cta_bandeau = models.CharField(
        max_length=300,
        blank=True,
        default="",
        verbose_name="Titre du bandeau CTA",
    )
    texte_description_bandeau = models.TextField(
        blank=True,
        verbose_name="Texte descriptif du bandeau CTA",
    )

    # Charte graphique & thème
    THEMES_COULEUR = [
        ("bleu_marine",   "Bleu marine (défaut)"),
        ("bleu_ciel",     "Bleu ciel"),
        ("emeraude",      "Émeraude"),
        ("violet",        "Violet"),
        ("ardoise",       "Ardoise"),
        ("rouge_brique",  "Rouge brique"),
        ("teal",          "Teal"),
        ("brun_dore",     "Brun doré"),
    ]
    MODES_THEME = [
        ("automatique", "Automatique (suit le système)"),
        ("clair",       "Toujours clair"),
        ("sombre",      "Toujours sombre"),
    ]
    POLICES = [
        ("inter",    "Inter (défaut)"),
        ("roboto",   "Roboto"),
        ("poppins",  "Poppins"),
        ("raleway",  "Raleway"),
        ("lato",     "Lato"),
    ]

    couleur_theme = models.CharField(
        max_length=20, choices=THEMES_COULEUR, default="bleu_marine",
        verbose_name="Thème couleur",
    )
    mode_theme_defaut = models.CharField(
        max_length=15, choices=MODES_THEME, default="automatique",
        verbose_name="Mode par défaut (clair/sombre/automatique)",
    )
    police_principale = models.CharField(
        max_length=20, choices=POLICES, default="inter",
        verbose_name="Police principale",
    )
    activer_carrousel_accueil = models.BooleanField(
        default=True,
        verbose_name="Activer le carrousel d'accueil",
        help_text="Permet d'afficher ou de masquer le carrousel sans supprimer ses diapositives.",
    )
    carousel_accueil = models.JSONField(
        default=list, blank=True,
        verbose_name="Diapositives du carrousel héros",
        help_text=(
            "Liste JSON d'objets "
            "{titre, sous_titre, image_url, cta_texte, cta_lien, couleur_fond}. "
            "Si vide, la section héros statique est affichée."
        ),
    )
    contenu_accueil = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="Contenu éditorial de la page d'accueil",
        help_text=(
            "Contient les textes et blocs éditoriaux de la page d'accueil : "
            "sections, labels, indicateurs, secteurs et méthodes."
        ),
    )
    contenus_pages = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="Contenus éditoriaux des pages publiques",
        help_text=(
            "Contient les textes structurés des pages publiques : "
            "contact, méthode, prestations et références."
        ),
    )

    # SEO
    meta_titre = models.CharField(
        max_length=300, blank=True, verbose_name="Meta titre (balise <title>)"
    )
    meta_description = models.CharField(
        max_length=500, blank=True, verbose_name="Meta description"
    )
    mots_cles = models.CharField(
        max_length=500, blank=True, verbose_name="Mots-clés SEO"
    )

    date_modification = models.DateTimeField(auto_now=True)
    modifie_par = models.ForeignKey(
        "comptes.Utilisateur",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="configurations_site",
    )

    class Meta:
        db_table = "site_public_configuration"
        verbose_name = "Configuration du site"
        verbose_name_plural = "Configuration du site"

    def __str__(self):
        return f"Configuration — {self.nom_bureau}"

    @classmethod
    def obtenir(cls) -> "ConfigurationSite":
        """Retourne le singleton de configuration, le crée si inexistant."""
        instance, _ = cls.objects.get_or_create(id=1)
        champs_a_mettre_a_jour = []
        if not instance.contenu_accueil:
            instance.contenu_accueil = contenu_accueil_par_defaut()
            champs_a_mettre_a_jour.append("contenu_accueil")
        if not instance.contenus_pages:
            instance.contenus_pages = contenus_pages_par_defaut()
            champs_a_mettre_a_jour.append("contenus_pages")
        if champs_a_mettre_a_jour:
            instance.save(update_fields=champs_a_mettre_a_jour)
        return instance

    @staticmethod
    def televerser_media_site(fichier, sous_repertoire: str = "divers"):
        """Enregistre un média du site et retourne son URL relative."""
        horodatage = timezone.now().strftime("%Y%m%d%H%M%S")
        nom_base = Path(fichier.name).stem[:80]
        extension = Path(fichier.name).suffix.lower()
        nom_fichier = f"{slugify(nom_base) or 'media'}-{horodatage}{extension}"
        chemin = f"site_public/{sous_repertoire}/{nom_fichier}"
        chemin_stocke = default_storage.save(chemin, fichier)
        return default_storage.url(chemin_stocke)


# ---------------------------------------------------------------------------
# Prestations (existant — enrichi avec points forts et couleur)
# ---------------------------------------------------------------------------

class Prestation(models.Model):
    """Prestation proposée par le bureau d'études — affichée sur le site vitrine."""

    COULEURS = [
        ("primaire", "Bleu primaire"),
        ("amber", "Ambre"),
        ("green", "Vert"),
        ("indigo", "Indigo"),
        ("purple", "Violet"),
        ("rose", "Rose"),
        ("slate", "Ardoise"),
        ("orange", "Orange"),
    ]

    CATEGORIES = [
        ("economie", "Économie de la construction"),
        ("vrd", "Voirie et réseaux divers"),
        ("batiment", "Bâtiment"),
        ("assistance", "Assistance maîtrise d'œuvre"),
        ("documents", "Documents de marché"),
        ("autre", "Autre"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    slug = models.SlugField(
        max_length=120, unique=True, blank=True,
        help_text="Identifiant URL unique (généré automatiquement depuis le titre).",
    )
    titre = models.CharField(max_length=200)
    categorie = models.CharField(
        max_length=20, choices=CATEGORIES, default="autre",
        verbose_name="Catégorie",
    )
    description_courte = models.CharField(max_length=400, blank=True)
    description_longue = models.TextField(blank=True)
    icone = models.CharField(
        max_length=100, blank=True,
        help_text="Nom de l'icône lucide-react (ex : TrendingUp, Hammer).",
    )
    couleur = models.CharField(
        max_length=20, choices=COULEURS, default="primaire",
        verbose_name="Couleur de la carte",
    )
    points_forts = models.JSONField(
        default=list, blank=True,
        verbose_name="Points forts",
        help_text="Liste JSON de textes courts (ex : [\"Devis détaillés\", \"Traçabilité\"]).",
    )
    # Contenu détaillé page prestation
    titre_page = models.CharField(max_length=300, blank=True, verbose_name="Titre page détail")
    accroche_page = models.TextField(blank=True, verbose_name="Texte d'accroche page détail")
    avantages = models.JSONField(
        default=list, blank=True,
        verbose_name="Avantages client",
        help_text="Liste JSON d'objets {icone, titre, description}.",
    )
    livrables = models.JSONField(
        default=list, blank=True,
        verbose_name="Livrables",
        help_text="Liste JSON de textes (documents/rendus fournis).",
    )
    # SEO
    meta_titre = models.CharField(max_length=300, blank=True, verbose_name="Meta titre")
    meta_description = models.CharField(max_length=500, blank=True, verbose_name="Meta description")

    ordre_affichage = models.PositiveSmallIntegerField(default=100)
    est_publie = models.BooleanField(default=True)
    date_modification = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "site_public_prestation"
        verbose_name = "Prestation"
        verbose_name_plural = "Prestations"
        ordering = ["ordre_affichage"]

    def __str__(self):
        return self.titre

    def save(self, *args, **kwargs):
        if not self.slug:
            base_slug = slugify(self.titre)
            slug = base_slug
            compteur = 1
            while Prestation.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                slug = f"{base_slug}-{compteur}"
                compteur += 1
            self.slug = slug
        super().save(*args, **kwargs)


# ---------------------------------------------------------------------------
# Actualités
# ---------------------------------------------------------------------------

class Actualite(models.Model):
    """Actualité publiée sur le site vitrine."""

    ETATS = [
        ("brouillon", "Brouillon"),
        ("publie", "Publié"),
        ("archive", "Archivé"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    slug = models.SlugField(max_length=150, unique=True, blank=True)
    titre = models.CharField(max_length=300)
    extrait = models.CharField(max_length=500, blank=True, verbose_name="Extrait")
    contenu = models.TextField(blank=True, verbose_name="Contenu complet")
    image = models.ImageField(upload_to="site_public/actualites/", null=True, blank=True)
    categorie = models.CharField(max_length=100, blank=True)
    tags = models.JSONField(default=list, blank=True)
    etat = models.CharField(max_length=20, choices=ETATS, default="brouillon")
    date_publication = models.DateTimeField(null=True, blank=True)
    date_creation = models.DateTimeField(auto_now_add=True)
    date_modification = models.DateTimeField(auto_now=True)
    auteur = models.ForeignKey(
        "comptes.Utilisateur", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="actualites",
    )

    class Meta:
        db_table = "site_public_actualite"
        verbose_name = "Actualité"
        verbose_name_plural = "Actualités"
        ordering = ["-date_publication", "-date_creation"]

    def __str__(self):
        return self.titre

    def save(self, *args, **kwargs):
        if not self.slug:
            base_slug = slugify(self.titre)
            slug = base_slug
            compteur = 1
            while Actualite.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                slug = f"{base_slug}-{compteur}"
                compteur += 1
            self.slug = slug
        super().save(*args, **kwargs)


# ---------------------------------------------------------------------------
# Chiffres clés / statistiques
# ---------------------------------------------------------------------------

class StatistiqueSite(models.Model):
    """Chiffre clé affiché dans la section statistiques de la page d'accueil."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    valeur = models.CharField(max_length=50, verbose_name="Valeur (ex : 15, 100%)")
    unite = models.CharField(max_length=50, blank=True, verbose_name="Unité (optionnel)")
    libelle = models.CharField(max_length=200, verbose_name="Libellé descriptif")
    ordre_affichage = models.PositiveSmallIntegerField(default=100)
    est_publie = models.BooleanField(default=True)

    class Meta:
        db_table = "site_public_statistique"
        verbose_name = "Chiffre clé"
        verbose_name_plural = "Chiffres clés"
        ordering = ["ordre_affichage"]

    def __str__(self):
        return f"{self.valeur}{self.unite} — {self.libelle}"


# ---------------------------------------------------------------------------
# Valeurs / avantages
# ---------------------------------------------------------------------------

class ValeurSite(models.Model):
    """Valeur ou avantage affiché dans la section valeurs de la page d'accueil."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    icone = models.CharField(
        max_length=100, blank=True,
        help_text="Nom de l'icône lucide-react (ex : Shield, BarChart3).",
    )
    titre = models.CharField(max_length=200)
    description = models.TextField()
    ordre_affichage = models.PositiveSmallIntegerField(default=100)
    est_publiee = models.BooleanField(default=True)

    class Meta:
        db_table = "site_public_valeur"
        verbose_name = "Valeur / avantage"
        verbose_name_plural = "Valeurs / avantages"
        ordering = ["ordre_affichage"]

    def __str__(self):
        return self.titre


# ---------------------------------------------------------------------------
# Étapes de la démarche
# ---------------------------------------------------------------------------

class EtapeDemarche(models.Model):
    """Étape de la démarche affichée dans la section démarche."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    numero = models.CharField(max_length=10, verbose_name="Numéro affiché (ex : 01, 02)")
    titre = models.CharField(max_length=200)
    description = models.TextField()
    ordre_affichage = models.PositiveSmallIntegerField(default=100)
    est_publiee = models.BooleanField(default=True)

    class Meta:
        db_table = "site_public_etape_demarche"
        verbose_name = "Étape de la démarche"
        verbose_name_plural = "Étapes de la démarche"
        ordering = ["ordre_affichage"]

    def __str__(self):
        return f"{self.numero}. {self.titre}"


# ---------------------------------------------------------------------------
# Pages statiques (politique de confidentialité, mentions légales, CGU…)
# ---------------------------------------------------------------------------

class PageStatique(models.Model):
    """Page statique éditable par le super-admin."""

    TYPES = [
        ("politique_confidentialite", "Politique de confidentialité"),
        ("mentions_legales", "Mentions légales"),
        ("cgu", "Conditions générales d'utilisation"),
        ("gestion_cookies", "Gestion des cookies"),
        ("autre", "Autre"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.SlugField(
        max_length=80, unique=True,
        help_text="Identifiant URL (ex : politique-de-confidentialite).",
    )
    type_page = models.CharField(max_length=40, choices=TYPES, default="autre")
    titre = models.CharField(max_length=300)
    contenu = models.TextField(
        help_text="Contenu en HTML ou Markdown. Affiché tel quel côté client."
    )
    est_publiee = models.BooleanField(default=True, verbose_name="Publiée")
    afficher_dans_pied_de_page = models.BooleanField(
        default=True, verbose_name="Lien dans le pied de page"
    )
    date_modification = models.DateTimeField(auto_now=True)
    modifie_par = models.ForeignKey(
        "comptes.Utilisateur",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="pages_statiques_modifiees",
    )

    class Meta:
        db_table = "site_public_page_statique"
        verbose_name = "Page statique"
        verbose_name_plural = "Pages statiques"
        ordering = ["ordre"] if False else ["titre"]

    def __str__(self):
        return self.titre


# ---------------------------------------------------------------------------
# Configuration RGPD (singleton — toujours id=1)
# ---------------------------------------------------------------------------

class ConfigurationRGPD(models.Model):
    """
    Configuration du bandeau de consentement cookies et politique RGPD (singleton).
    Un seul enregistrement doit exister (id=1).
    """

    # Bandeau de consentement
    bandeau_actif = models.BooleanField(
        default=True, verbose_name="Bandeau de consentement actif"
    )
    texte_bandeau = models.TextField(
        blank=True,
        verbose_name="Texte du bandeau",
        default=(
            "Nous utilisons des cookies strictement nécessaires au fonctionnement "
            "de la plateforme. Aucun cookie de traçage ou publicitaire n'est utilisé."
        ),
    )
    texte_bouton_accepter = models.CharField(
        max_length=100, default="Accepter", verbose_name="Texte bouton Accepter"
    )
    texte_bouton_refuser = models.CharField(
        max_length=100, default="Refuser", verbose_name="Texte bouton Refuser"
    )
    texte_bouton_personnaliser = models.CharField(
        max_length=100, default="Personnaliser", verbose_name="Texte bouton Personnaliser"
    )
    afficher_bouton_personnaliser = models.BooleanField(
        default=False, verbose_name="Afficher le bouton Personnaliser"
    )
    duree_consentement_jours = models.PositiveIntegerField(
        default=365, verbose_name="Durée de validité du consentement (jours)"
    )

    # Catégories de cookies
    cookies_necessaires_description = models.TextField(
        blank=True,
        default="Cookies indispensables au fonctionnement du site (session, sécurité).",
        verbose_name="Description cookies nécessaires",
    )
    cookies_analytiques_actifs = models.BooleanField(
        default=False, verbose_name="Activer les cookies analytiques"
    )
    cookies_analytiques_description = models.TextField(
        blank=True,
        verbose_name="Description cookies analytiques",
        default="Cookies permettant d'analyser l'audience du site de manière anonyme.",
    )
    cookies_marketing_actifs = models.BooleanField(
        default=False, verbose_name="Activer les cookies marketing"
    )
    cookies_marketing_description = models.TextField(
        blank=True,
        verbose_name="Description cookies marketing",
        default="Cookies permettant de personnaliser les publicités.",
    )

    # Lien vers la politique
    lien_politique_confidentialite = models.CharField(
        max_length=200,
        default="/politique-de-confidentialite",
        verbose_name="Lien vers la politique de confidentialité",
    )
    lien_gestion_cookies = models.CharField(
        max_length=200,
        default="/gestion-des-cookies",
        verbose_name="Lien vers la page de gestion des cookies",
    )

    date_modification = models.DateTimeField(auto_now=True)
    modifie_par = models.ForeignKey(
        "comptes.Utilisateur",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="configurations_rgpd",
    )

    class Meta:
        db_table = "site_public_configuration_rgpd"
        verbose_name = "Configuration RGPD"
        verbose_name_plural = "Configuration RGPD"

    def __str__(self):
        return "Configuration RGPD"

    @classmethod
    def obtenir(cls) -> "ConfigurationRGPD":
        """Retourne le singleton RGPD, le crée si inexistant."""
        instance, _ = cls.objects.get_or_create(id=1)
        return instance


# ---------------------------------------------------------------------------
# Réalisations (existant — inchangé)
# ---------------------------------------------------------------------------

class Realisation(models.Model):
    """
    Réalisation mise en avant sur le site vitrine.
    Peut être liée à un projet interne (si publier_sur_site = True).
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    projet = models.OneToOneField(
        "projets.Projet", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="realisation_vitrine",
    )

    titre = models.CharField(max_length=300)
    description = models.TextField(blank=True)
    client = models.CharField(max_length=200, blank=True)
    lieu = models.CharField(max_length=200, blank=True)
    annee = models.PositiveSmallIntegerField(null=True, blank=True)
    montant_travaux_ht = models.DecimalField(
        max_digits=14, decimal_places=2,
        null=True, blank=True,
        verbose_name="Montant travaux HT (€)",
    )
    image_principale = models.ImageField(
        upload_to="site_public/realisations/", null=True, blank=True,
    )
    tags = models.JSONField(default=list, blank=True)
    est_publie = models.BooleanField(default=False)
    ordre_affichage = models.PositiveSmallIntegerField(default=100)
    date_publication = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "site_public_realisation"
        verbose_name = "Réalisation"
        verbose_name_plural = "Réalisations"
        ordering = ["-annee", "ordre_affichage"]

    def __str__(self):
        return f"{self.titre} ({self.annee or '—'})"


# ---------------------------------------------------------------------------
# Membres de l'équipe (existant — inchangé)
# ---------------------------------------------------------------------------

class MembreEquipe(models.Model):
    """Membre de l'équipe affiché sur la page À propos du site vitrine."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    utilisateur = models.OneToOneField(
        "comptes.Utilisateur", on_delete=models.CASCADE,
        null=True, blank=True, related_name="profil_vitrine",
    )
    prenom = models.CharField(max_length=100)
    nom = models.CharField(max_length=100)
    fonction = models.CharField(max_length=200, blank=True)
    biographie = models.TextField(blank=True)
    photo = models.ImageField(upload_to="site_public/equipe/", null=True, blank=True)
    ordre_affichage = models.PositiveSmallIntegerField(default=100)
    est_publie = models.BooleanField(default=True)

    class Meta:
        db_table = "site_public_membre"
        verbose_name = "Membre de l'équipe"
        verbose_name_plural = "Membres de l'équipe"
        ordering = ["ordre_affichage", "nom"]

    def __str__(self):
        return f"{self.prenom} {self.nom}"


# ---------------------------------------------------------------------------
# Demandes de contact (existant — inchangé)
# ---------------------------------------------------------------------------

class DemandeContact(models.Model):
    """Demande de contact reçue via le formulaire du site vitrine."""

    SUJETS = [
        ("devis", "Demande de devis"),
        ("information", "Demande d'information"),
        ("partenariat", "Partenariat"),
        ("recrutement", "Candidature"),
        ("autre", "Autre"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    nom = models.CharField(max_length=200)
    courriel = models.EmailField()
    telephone = models.CharField(max_length=20, blank=True)
    organisation = models.CharField(max_length=200, blank=True)
    sujet = models.CharField(max_length=20, choices=SUJETS, default="information")
    message = models.TextField()
    traitee = models.BooleanField(default=False)
    date_reception = models.DateTimeField(auto_now_add=True)
    adresse_ip = models.GenericIPAddressField(null=True, blank=True)

    class Meta:
        db_table = "site_public_contact"
        verbose_name = "Demande de contact"
        verbose_name_plural = "Demandes de contact"
        ordering = ["-date_reception"]

    def __str__(self):
        return f"{self.nom} — {self.sujet} ({self.date_reception.strftime('%d/%m/%Y')})"
