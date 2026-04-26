"""
Modèles de projets / affaires / missions.
Plateforme LBH — Bureau d'Études Économiste

Le projet est le cœur de la plateforme : tout s'organise autour de lui.
"""

import uuid
from django.db import models
from django.utils import timezone


class Projet(models.Model):
    """Projet / affaire / mission — entité centrale de la plateforme."""

    TYPES = [
        ("etude", "Étude"),
        ("travaux", "Travaux"),
        ("mission_moe", "Mission maîtrise d'œuvre"),
        ("assistance", "Assistance à maîtrise d'ouvrage"),
        ("expertise", "Expertise"),
        ("autre", "Autre"),
    ]

    STATUTS = [
        ("prospection", "Prospection"),
        ("en_cours", "En cours"),
        ("suspendu", "Suspendu"),
        ("termine", "Terminé"),
        ("abandonne", "Abandonné"),
        ("archive", "Archivé"),
    ]

    PHASES = [
        ("faisabilite", "Faisabilité"),
        ("programmation", "Programmation"),
        ("esquisse", "Esquisse / ESQ"),
        ("avp", "Avant-projet sommaire / APS"),
        ("pro", "Avant-projet définitif / APD / PRO"),
        ("dce", "Dossier de consultation / DCE"),
        ("ao", "Appel d'offres"),
        ("exe", "Exécution / DET"),
        ("reception", "Réception / AOR"),
        ("clos", "Clos"),
    ]

    CLIENTELES_CIBLES = [
        ("moa_publique", "Maîtrise d'ouvrage publique"),
        ("moe_conception", "Équipe de maîtrise d'œuvre"),
        ("entreprise_travaux", "Entreprise de travaux"),
        ("cotraitrance", "Co-traitance"),
        ("sous_traitance", "Sous-traitance"),
        ("autre", "Autre contexte"),
    ]

    OBJECTIFS_MISSION = [
        ("verifier_enveloppe", "Vérifier l'enveloppe budgétaire"),
        ("estimation_moe", "Estimation analytique de maîtrise d'œuvre"),
        ("redaction_dce_cctp", "Rédaction DCE / CCTP"),
        ("reponse_ao_entreprise", "Réponse à appel d'offres entreprise"),
        ("devis_entreprise", "Chiffrage de devis / BPU / DPGF"),
        ("prospection_ao", "Prospection et sélection d'appels d'offres"),
        ("suivi_execution", "Suivi d'exécution et bilan"),
        ("autre", "Autre objectif"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Identification
    reference = models.CharField(max_length=50, unique=True, verbose_name="Référence")
    intitule = models.CharField(max_length=500, verbose_name="Intitulé")
    type_projet = models.CharField(max_length=50, choices=TYPES, default="etude", verbose_name="Type")
    type_projet_autre = models.CharField(
        max_length=120,
        blank=True,
        default="",
        verbose_name="Type de projet personnalisé",
    )
    clientele_cible = models.CharField(
        max_length=30,
        choices=CLIENTELES_CIBLES,
        default="moa_publique",
        verbose_name="Clientèle cible",
    )
    objectif_mission = models.CharField(
        max_length=40,
        choices=OBJECTIFS_MISSION,
        default="verifier_enveloppe",
        verbose_name="Objectif principal de la mission",
    )
    statut = models.CharField(max_length=30, choices=STATUTS, default="en_cours", verbose_name="Statut")
    phase_actuelle = models.CharField(max_length=30, choices=PHASES, blank=True, verbose_name="Phase actuelle")

    # Parties prenantes
    organisation = models.ForeignKey(
        "organisations.Organisation", on_delete=models.PROTECT,
        null=True, blank=True,
        related_name="projets", verbose_name="Bureau d'études",
    )
    maitre_ouvrage = models.ForeignKey(
        "organisations.Organisation", on_delete=models.PROTECT,
        null=True, blank=True, related_name="projets_en_tant_que_mo",
        verbose_name="Maître d'ouvrage",
    )
    maitre_oeuvre = models.ForeignKey(
        "organisations.Organisation", on_delete=models.PROTECT,
        null=True, blank=True, related_name="projets_en_tant_que_moe",
        verbose_name="Maître d'œuvre",
    )

    # Responsable interne
    responsable = models.ForeignKey(
        "comptes.Utilisateur", on_delete=models.PROTECT,
        related_name="projets_responsable", verbose_name="Responsable",
    )

    # Localisation
    commune = models.CharField(max_length=200, blank=True, verbose_name="Commune")
    departement = models.CharField(max_length=3, blank=True, verbose_name="Département")

    # Calendrier
    date_debut_prevue = models.DateField(null=True, blank=True, verbose_name="Début prévu")
    date_fin_prevue = models.DateField(null=True, blank=True, verbose_name="Fin prévue")
    date_debut_reelle = models.DateField(null=True, blank=True, verbose_name="Début réel")
    date_fin_reelle = models.DateField(null=True, blank=True, verbose_name="Fin réelle")

    # Financier
    montant_estime = models.DecimalField(
        max_digits=15, decimal_places=2, null=True, blank=True,
        verbose_name="Montant estimé HT (€)",
    )
    montant_marche = models.DecimalField(
        max_digits=15, decimal_places=2, null=True, blank=True,
        verbose_name="Montant du marché HT (€)",
    )
    honoraires_prevus = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True,
        verbose_name="Honoraires prévus HT (€)",
    )

    # Notes
    description = models.TextField(blank=True, verbose_name="Description")
    observations = models.TextField(blank=True, verbose_name="Observations")
    qualification_wizard = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="Qualification métier du projet",
    )

    # Publication site public
    publier_sur_site = models.BooleanField(default=False, verbose_name="Publier sur le site vitrine")

    # Métadonnées
    date_creation = models.DateTimeField(auto_now_add=True)
    date_modification = models.DateTimeField(auto_now=True)
    cree_par = models.ForeignKey(
        "comptes.Utilisateur", on_delete=models.PROTECT,
        related_name="projets_crees", null=True, blank=True,
    )

    class Meta:
        db_table = "projets_projet"
        verbose_name = "Projet"
        verbose_name_plural = "Projets"
        ordering = ["-date_modification"]
        indexes = [
            models.Index(fields=["statut"]),
            models.Index(fields=["organisation"]),
            models.Index(fields=["reference"]),
        ]

    def __str__(self):
        return f"{self.reference} — {self.intitule[:60]}"

    def generer_reference(self):
        """Génère une référence automatique si non fournie."""
        annee = timezone.now().year
        dernier = Projet.objects.filter(
            reference__startswith=f"{annee}-"
        ).count() + 1
        return f"{annee}-{dernier:04d}"

    def save(self, *args, **kwargs):
        if not self.reference:
            self.reference = self.generer_reference()
        super().save(*args, **kwargs)


class Lot(models.Model):
    """Lot ou sous-ensemble d'un projet."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    projet = models.ForeignKey(Projet, on_delete=models.CASCADE, related_name="lots")
    numero = models.PositiveSmallIntegerField(verbose_name="Numéro de lot")
    intitule = models.CharField(max_length=300, verbose_name="Intitulé")
    description = models.TextField(blank=True)
    montant_estime = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)

    class Meta:
        db_table = "projets_lot"
        verbose_name = "Lot"
        verbose_name_plural = "Lots"
        unique_together = [("projet", "numero")]
        ordering = ["projet", "numero"]

    def __str__(self):
        return f"Lot {self.numero} — {self.intitule}"


class Intervenant(models.Model):
    """Intervenant affecté à un projet."""

    ROLES = [
        ("responsable", "Responsable"),
        ("charge_affaires", "Chargé d'affaires"),
        ("economiste", "Économiste"),
        ("redacteur", "Rédacteur"),
        ("verificateur", "Vérificateur"),
        ("conducteur_travaux", "Conducteur de travaux"),
        ("observateur", "Observateur"),
    ]

    projet = models.ForeignKey(Projet, on_delete=models.CASCADE, related_name="intervenants")
    utilisateur = models.ForeignKey("comptes.Utilisateur", on_delete=models.PROTECT)
    role = models.CharField(max_length=50, choices=ROLES, default="economiste")
    date_debut = models.DateField(null=True, blank=True)
    date_fin = models.DateField(null=True, blank=True)

    class Meta:
        db_table = "projets_intervenant"
        verbose_name = "Intervenant"
        unique_together = [("projet", "utilisateur")]

    def __str__(self):
        return f"{self.utilisateur.nom_complet} ({self.get_role_display()}) — {self.projet.reference}"


class AffectationProjet(models.Model):
    """Affectation ciblée d'un salarié sur une mission, un livrable ou le projet complet."""

    NATURES = [
        ("projet", "Projet complet"),
        ("mission", "Mission"),
        ("livrable", "Livrable"),
    ]

    ROLES = [
        ("pilotage", "Pilotage"),
        ("contribution", "Contribution"),
        ("redaction", "Rédaction"),
        ("etude_prix", "Étude de prix"),
        ("verification", "Vérification"),
        ("planning", "Planning"),
        ("opc", "OPC"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    projet = models.ForeignKey(Projet, on_delete=models.CASCADE, related_name="affectations")
    utilisateur = models.ForeignKey("comptes.Utilisateur", on_delete=models.PROTECT, related_name="affectations_projet")
    nature = models.CharField(max_length=20, choices=NATURES, default="mission")
    code_cible = models.CharField(max_length=120, blank=True, default="", verbose_name="Code mission/livrable")
    libelle_cible = models.CharField(max_length=255, blank=True, default="", verbose_name="Libellé ciblé")
    role = models.CharField(max_length=30, choices=ROLES, default="contribution")
    commentaires = models.TextField(blank=True, default="")
    cree_par = models.ForeignKey(
        "comptes.Utilisateur",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="affectations_projet_creees",
    )
    date_creation = models.DateTimeField(auto_now_add=True)
    date_modification = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "projets_affectation"
        verbose_name = "Affectation projet"
        verbose_name_plural = "Affectations projet"
        ordering = ["nature", "libelle_cible", "date_creation"]
        constraints = [
            models.UniqueConstraint(
                fields=["projet", "utilisateur", "nature", "code_cible"],
                name="projets_affectation_unique_cible",
            )
        ]

    def __str__(self):
        cible = self.libelle_cible or self.code_cible or self.get_nature_display()
        return f"{self.utilisateur.nom_complet} — {cible}"


class MissionClient(models.Model):
    """Mission prédéfinie par type de client — configurable en administration."""

    FAMILLES_CLIENT = [
        ("maitrise_ouvrage", "Maîtrise d'ouvrage"),
        ("maitrise_oeuvre", "Maîtrise d'œuvre"),
        ("entreprise", "Entreprise"),
        ("autre", "Autre contexte"),
    ]

    NATURES_OUVRAGE = [
        ("batiment", "Bâtiment"),
        ("infrastructure", "Infrastructure / VRD"),
        ("mixte", "Mixte"),
        ("tous", "Tous types"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.SlugField(max_length=80, unique=True, verbose_name="Code")
    libelle = models.CharField(max_length=200, verbose_name="Libellé")
    description = models.TextField(blank=True, verbose_name="Description")
    famille_client = models.CharField(
        max_length=30, choices=FAMILLES_CLIENT, verbose_name="Famille client",
    )
    sous_types_client = models.JSONField(
        default=list, blank=True,
        verbose_name="Sous-types clients",
        help_text="Liste de codes sous-types applicables (vide = tous)",
    )
    nature_ouvrage = models.CharField(
        max_length=20, choices=NATURES_OUVRAGE, default="tous",
        verbose_name="Nature d'ouvrage",
    )
    phases_concernees = models.JSONField(
        default=list, blank=True,
        verbose_name="Phases MOP concernées",
        help_text="Codes des phases : esq, aps, apd, pro, act, exe, det, opc, aor",
    )
    icone = models.CharField(
        max_length=60, blank=True, verbose_name="Icône",
        help_text="Nom d'icône Lucide (ex: FileText, Calculator)",
    )
    couleur = models.CharField(
        max_length=20, blank=True, verbose_name="Couleur",
        help_text="Couleur Tailwind (ex: blue, green, amber)",
    )
    est_active = models.BooleanField(default=True, verbose_name="Active")
    est_obligatoire = models.BooleanField(default=False, verbose_name="Obligatoire")
    profil_horaire_defaut = models.ForeignKey(
        "societe.ProfilHoraire",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="missions_client_defaut",
        verbose_name="Profil horaire par défaut",
    )
    duree_etude_heures = models.DecimalField(
        max_digits=7,
        decimal_places=2,
        default=8,
        verbose_name="Durée d'étude par défaut",
    )
    ordre = models.PositiveSmallIntegerField(default=0, verbose_name="Ordre d'affichage")
    date_creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "projets_mission_client"
        verbose_name = "Mission client"
        verbose_name_plural = "Missions clients"
        ordering = ["famille_client", "ordre", "libelle"]

    def __str__(self):
        return f"[{self.get_famille_client_display()}] {self.libelle}"


class LivrableType(models.Model):
    """Livrable type associé à une ou plusieurs missions client."""

    TYPES_DOCUMENT = [
        ("cctp", "CCTP"),
        ("dpgf", "DPGF"),
        ("bpu", "BPU"),
        ("dqe", "DQE"),
        ("note_calcul", "Note de calcul"),
        ("planning", "Planning"),
        ("rapport", "Rapport / analyse"),
        ("plan", "Plan / dessin"),
        ("devis", "Devis"),
        ("contrat", "Contrat / marché"),
        ("pv_reception", "PV de réception"),
        ("dce", "DCE complet"),
        ("memoire_technique", "Mémoire technique"),
        ("dgd", "DGD"),
        ("avenant", "Avenant"),
        ("situation", "Situation de travaux"),
        ("estimation", "Estimation budgétaire"),
        ("autre", "Autre"),
    ]

    FORMATS_ATTENDUS = [
        ("pdf", "PDF"),
        ("docx", "Word (.docx)"),
        ("xlsx", "Excel (.xlsx)"),
        ("odt", "Writer (.odt)"),
        ("ods", "Calc (.ods)"),
        ("zip", "Archive (.zip)"),
        ("autre", "Autre"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.SlugField(max_length=80, unique=True, verbose_name="Code")
    libelle = models.CharField(max_length=200, verbose_name="Libellé")
    type_document = models.CharField(
        max_length=30, choices=TYPES_DOCUMENT, verbose_name="Type de document",
    )
    format_attendu = models.CharField(
        max_length=10, choices=FORMATS_ATTENDUS, default="pdf",
        verbose_name="Format attendu",
    )
    description = models.TextField(blank=True, verbose_name="Description")
    missions = models.ManyToManyField(
        MissionClient, related_name="livrables", blank=True,
        verbose_name="Missions associées",
    )
    icone = models.CharField(max_length=60, blank=True, verbose_name="Icône")
    couleur = models.CharField(max_length=20, blank=True, verbose_name="Couleur")
    est_active = models.BooleanField(default=True, verbose_name="Actif")
    ordre = models.PositiveSmallIntegerField(default=0, verbose_name="Ordre d'affichage")

    class Meta:
        db_table = "projets_livrable_type"
        verbose_name = "Livrable type"
        verbose_name_plural = "Livrables types"
        ordering = ["ordre", "libelle"]

    def __str__(self):
        return f"{self.libelle} ({self.get_type_document_display()})"


class ModeleDocument(models.Model):
    """Modèle de document paramétrable configurable depuis l'administration."""

    TYPES_MODELE = [
        ("cctp", "CCTP"),
        ("dpgf", "DPGF"),
        ("bpu", "BPU / DQE"),
        ("os", "Ordre de service"),
        ("decompte", "Décompte / DGD"),
        ("avenant", "Avenant"),
        ("rapport_analyse", "Rapport d'analyse des offres"),
        ("cr_chantier", "Compte-rendu de chantier"),
        ("contrat", "Contrat / marché"),
        ("memoire_technique", "Mémoire technique"),
        ("note_estimation", "Note d'estimation budgétaire"),
        ("planning", "Planning prévisionnel"),
        ("autre", "Autre"),
    ]

    FORMATS_SORTIE = [
        ("docx", "Word (.docx)"),
        ("xlsx", "Excel (.xlsx)"),
        ("odt", "Writer (.odt)"),
        ("ods", "Calc (.ods)"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.SlugField(max_length=80, unique=True, verbose_name="Code")
    libelle = models.CharField(max_length=200, verbose_name="Libellé")
    type_modele = models.CharField(
        max_length=30, choices=TYPES_MODELE, verbose_name="Type de modèle",
    )
    format_sortie = models.CharField(
        max_length=10, choices=FORMATS_SORTIE, default="docx",
        verbose_name="Format de sortie",
    )
    description = models.TextField(blank=True, verbose_name="Description")
    familles_client = models.JSONField(
        default=list, blank=True,
        verbose_name="Familles client",
        help_text="Familles client pour lesquelles ce modèle est disponible (vide = toutes)",
    )
    variables_parametrables = models.JSONField(
        default=list, blank=True,
        verbose_name="Variables paramétrables",
        help_text='Ex: [{"code": "nom_projet", "libelle": "Nom du projet", "type": "texte", "obligatoire": true}]',
    )
    template_fichier = models.FileField(
        upload_to="modeles-documents/", null=True, blank=True,
        verbose_name="Fichier modèle",
        help_text="Fichier source (.docx, .xlsx, .odt, .ods) utilisé pour la génération",
    )
    apercu_image = models.ImageField(
        upload_to="modeles-documents/apercu/", null=True, blank=True,
        verbose_name="Image d'aperçu",
    )
    est_actif = models.BooleanField(default=True, verbose_name="Actif")
    ordre = models.PositiveSmallIntegerField(default=0, verbose_name="Ordre d'affichage")
    date_creation = models.DateTimeField(auto_now_add=True)
    date_modification = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "projets_modele_document"
        verbose_name = "Modèle de document"
        verbose_name_plural = "Modèles de documents"
        ordering = ["type_modele", "ordre", "libelle"]

    def __str__(self):
        return f"{self.get_type_modele_display()} — {self.libelle}"


class PreanalyseSourcesProjet(models.Model):
    """Tâche asynchrone de préanalyse des pièces sources avant création d'un projet."""

    STATUTS = [
        ("en_attente", "En attente"),
        ("en_cours", "En cours"),
        ("terminee", "Terminée"),
        ("echec", "Échec"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    utilisateur = models.ForeignKey(
        "comptes.Utilisateur",
        on_delete=models.CASCADE,
        related_name="preanalyses_sources_projets",
    )
    statut = models.CharField(max_length=20, choices=STATUTS, default="en_attente")
    progression = models.PositiveSmallIntegerField(default=0)
    message = models.CharField(max_length=255, blank=True, default="")
    nombre_fichiers = models.PositiveIntegerField(default=0)
    resultat = models.JSONField(default=dict, blank=True)
    erreur = models.TextField(blank=True, default="")
    contexte = models.JSONField(default=dict, blank=True, db_column="parametres")
    repertoire_temp = models.CharField(max_length=500, blank=True, default="", db_column="chemin_stockage")
    tache_celery_id = models.CharField(max_length=255, blank=True, default="")
    date_creation = models.DateTimeField(auto_now_add=True)
    date_modification = models.DateTimeField(auto_now=True)
    date_fin = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "projets_preanalyse_sources"
        verbose_name = "Préanalyse des sources projet"
        verbose_name_plural = "Préanalyses des sources projet"
        ordering = ["-date_creation"]

    def __str__(self):
        return f"Préanalyse {self.pk} ({self.get_statut_display()})"
