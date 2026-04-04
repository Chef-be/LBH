"""
Modèles des paramètres — Paramètres système, journal des modifications
et fonctionnalités activables.
Plateforme LBH — Bureau d'Études Économiste
"""

import json
import uuid
from decimal import Decimal, InvalidOperation

from django.db import models


class Parametre(models.Model):
    """
    Paramètre système externalisé.
    Toute valeur métier susceptible d'évoluer doit être stockée ici
    plutôt que codée en dur dans l'application.
    Exemples de clés : ECONO_TAUX_MARGE_CIBLE, VOIRIE_LARGEUR_MIN_TROTTOIR.
    """

    TYPES_VALEUR = [
        ("texte", "Texte"),
        ("entier", "Entier"),
        ("decimal", "Décimal"),
        ("booleen", "Booléen"),
        ("liste", "Liste"),
        ("json", "JSON"),
    ]

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
        verbose_name="Identifiant",
    )
    cle = models.CharField(
        max_length=100,
        unique=True,
        verbose_name="Clé",
        help_text="Identifiant technique unique, ex : ECONO_TAUX_MARGE_CIBLE.",
    )
    valeur = models.TextField(
        verbose_name="Valeur courante",
    )
    type_valeur = models.CharField(
        max_length=10,
        choices=TYPES_VALEUR,
        default="texte",
        verbose_name="Type de valeur",
    )
    libelle = models.CharField(
        max_length=255,
        verbose_name="Libellé",
    )
    description = models.TextField(
        blank=True,
        verbose_name="Description",
    )
    module = models.CharField(
        max_length=100,
        verbose_name="Module",
        help_text="Module applicatif auquel appartient ce paramètre (ex : ECONOMIE, VOIRIE).",
    )

    # Verrouillage — si True, la valeur n'est pas modifiable via l'interface
    est_verrouille = models.BooleanField(
        default=False,
        verbose_name="Verrouillé",
        help_text="Si activé, ce paramètre ne peut être modifié que directement en base ou via un script.",
    )

    valeur_par_defaut = models.TextField(
        verbose_name="Valeur par défaut",
        help_text="Valeur appliquée lors d'une réinitialisation.",
    )

    # Horodatage
    date_creation = models.DateTimeField(
        auto_now_add=True,
        verbose_name="Date de création",
    )
    date_modification = models.DateTimeField(
        auto_now=True,
        verbose_name="Date de dernière modification",
    )

    # Traçabilité
    modifie_par = models.ForeignKey(
        "comptes.Utilisateur",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="parametres_modifies",
        verbose_name="Modifié par",
    )

    class Meta:
        db_table = "parametres_parametre"
        verbose_name = "Paramètre"
        verbose_name_plural = "Paramètres"
        ordering = ["module", "cle"]

    def __str__(self):
        return f"[{self.module}] {self.cle} = {self.valeur}"

    def valeur_typee(self):
        """
        Retourne la valeur convertie dans le type natif Python correspondant
        au type_valeur déclaré sur ce paramètre.

        Conversions :
        - texte   → str
        - entier  → int
        - decimal → Decimal
        - booleen → bool  (valeurs acceptées : "true"/"1"/"oui" → True, tout le reste → False)
        - liste   → list  (chaîne de valeurs séparées par des virgules)
        - json    → dict ou list selon le contenu JSON
        """
        valeur_brute = self.valeur

        if self.type_valeur == "texte":
            return valeur_brute

        if self.type_valeur == "entier":
            try:
                return int(valeur_brute)
            except (ValueError, TypeError):
                return None

        if self.type_valeur == "decimal":
            try:
                # On remplace la virgule décimale française par un point
                return Decimal(valeur_brute.replace(",", "."))
            except (InvalidOperation, AttributeError):
                return None

        if self.type_valeur == "booleen":
            return valeur_brute.strip().lower() in ("true", "1", "oui", "vrai")

        if self.type_valeur == "liste":
            # Découpe sur la virgule et nettoie les espaces superflus
            return [element.strip() for element in valeur_brute.split(",") if element.strip()]

        if self.type_valeur == "json":
            try:
                return json.loads(valeur_brute)
            except (json.JSONDecodeError, TypeError):
                return None

        # Type inconnu — on retourne la valeur brute par sécurité
        return valeur_brute


class JournalModificationParametre(models.Model):
    """
    Historique des modifications apportées aux paramètres système.
    Chaque enregistrement est immuable (pas de mise à jour, uniquement des insertions).
    """

    parametre = models.ForeignKey(
        Parametre,
        on_delete=models.CASCADE,
        related_name="journal_modifications",
        verbose_name="Paramètre",
    )
    ancienne_valeur = models.TextField(
        verbose_name="Ancienne valeur",
    )
    nouvelle_valeur = models.TextField(
        verbose_name="Nouvelle valeur",
    )
    modifie_par = models.ForeignKey(
        "comptes.Utilisateur",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="journal_parametres",
        verbose_name="Modifié par",
    )
    date_modification = models.DateTimeField(
        auto_now_add=True,
        verbose_name="Date de modification",
    )

    class Meta:
        db_table = "parametres_journal_modification"
        verbose_name = "Journal de modification de paramètre"
        verbose_name_plural = "Journal des modifications de paramètres"
        ordering = ["-date_modification"]

    def __str__(self):
        return (
            f"{self.parametre.cle} : "
            f"« {self.ancienne_valeur} » → « {self.nouvelle_valeur} » "
            f"({self.date_modification:%d/%m/%Y %H:%M})"
        )


class FonctionnaliteActivable(models.Model):
    """
    Fonctionnalité activable — remplace la notion de « feature flag ».
    Permet d'activer ou de désactiver des modules selon le contexte :
    au niveau système, organisation, groupe ou utilisateur.

    Un module désactivé ne doit jamais lever d'erreur ni casser les autres modules.
    """

    NIVEAUX_CONTROLE = [
        ("systeme", "Système"),
        ("organisation", "Organisation"),
        ("groupe", "Groupe"),
        ("utilisateur", "Utilisateur"),
        ("profil", "Profil de droits"),
    ]

    module = models.CharField(
        max_length=100,
        blank=True,
        default="",
        verbose_name="Module",
        help_text="Module applicatif auquel appartient cette fonctionnalité.",
    )
    code = models.CharField(
        max_length=100,
        unique=True,
        verbose_name="Code",
        help_text="Identifiant technique unique, ex : MODULE_VOIRIE.",
    )
    libelle = models.CharField(
        max_length=255,
        verbose_name="Libellé",
    )
    description = models.TextField(
        blank=True,
        verbose_name="Description",
    )
    est_active = models.BooleanField(
        default=True,
        verbose_name="Fonctionnalité active",
    )
    niveau_controle = models.CharField(
        max_length=20,
        choices=NIVEAUX_CONTROLE,
        default="systeme",
        verbose_name="Niveau de contrôle",
        help_text="Granularité à laquelle s'applique cette activation.",
    )

    # Contexte d'activation (uniquement l'un des trois est renseigné à la fois)
    organisation = models.ForeignKey(
        "organisations.Organisation",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="fonctionnalites_activables",
        verbose_name="Organisation",
        help_text="Renseigner pour une activation restreinte à une organisation.",
    )
    profil = models.ForeignKey(
        "comptes.ProfilDroit",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="fonctionnalites_activables",
        verbose_name="Profil de droits",
        help_text="Renseigner pour une activation restreinte à un profil de droits.",
    )
    utilisateur = models.ForeignKey(
        "comptes.Utilisateur",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="fonctionnalites_activables",
        verbose_name="Utilisateur",
        help_text="Renseigner pour une activation restreinte à un utilisateur.",
    )

    # Dépendances — codes séparés par des virgules (ex : "MODULE_VOIRIE,MODULE_METRES")
    modules_dependants = models.CharField(
        max_length=500,
        blank=True,
        verbose_name="Modules dépendants",
        help_text=(
            "Codes des fonctionnalités devant être actives pour que celle-ci puisse l'être. "
            "Séparer les codes par des virgules."
        ),
    )

    # Horodatage et traçabilité
    date_modification = models.DateTimeField(
        auto_now=True,
        verbose_name="Date de dernière modification",
    )
    modifie_par = models.ForeignKey(
        "comptes.Utilisateur",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="fonctionnalites_modifiees",
        verbose_name="Modifié par",
    )

    class Meta:
        db_table = "parametres_fonctionnalite_activable"
        verbose_name = "Fonctionnalité activable"
        verbose_name_plural = "Fonctionnalités activables"
        ordering = ["code"]

    def __str__(self):
        etat = "active" if self.est_active else "inactive"
        return f"{self.code} ({etat} — niveau : {self.get_niveau_controle_display()})"

    @staticmethod
    def est_active_pour(code: str, utilisateur=None, organisation=None) -> bool:
        """
        Vérifie si une fonctionnalité identifiée par son code est active
        pour un contexte donné (utilisateur et/ou organisation).

        Règles de priorité (de la plus spécifique à la plus générale) :
        1. Désactivation explicite au niveau utilisateur → False
        2. Activation explicite au niveau utilisateur → True
        3. Désactivation explicite au niveau profil (via le profil de l'utilisateur) → False
        4. Activation explicite au niveau profil → True
        5. Désactivation explicite au niveau organisation → False
        6. Activation explicite au niveau organisation → True
        7. Enregistrement au niveau système → valeur de est_active
        8. Aucun enregistrement → False (fermé par défaut)

        Les dépendances sont vérifiées récursivement : si un module dépendant
        est inactif, la fonctionnalité est considérée inactive quel que soit
        son propre état.

        :param code: Code de la fonctionnalité à vérifier.
        :param utilisateur: Instance de comptes.Utilisateur ou None.
        :param organisation: Instance de organisations.Organisation ou None.
        :return: True si la fonctionnalité est active dans le contexte fourni.
        """
        # --- Niveau utilisateur ---
        if utilisateur is not None:
            enregistrement_utilisateur = FonctionnaliteActivable.objects.filter(
                code=code,
                niveau_controle="utilisateur",
                utilisateur=utilisateur,
            ).first()
            if enregistrement_utilisateur is not None:
                if not enregistrement_utilisateur.est_active:
                    return False
                resultat = enregistrement_utilisateur.est_active
                # Vérification des dépendances avant de valider
                return resultat and FonctionnaliteActivable._dependances_actives(
                    enregistrement_utilisateur, utilisateur, organisation
                )

            # --- Niveau profil (déduit du profil de l'utilisateur) ---
            profil_utilisateur = getattr(utilisateur, "profil", None)
            if profil_utilisateur is not None:
                enregistrement_profil = FonctionnaliteActivable.objects.filter(
                    code=code,
                    niveau_controle="profil",
                    profil=profil_utilisateur,
                ).first()
                if enregistrement_profil is not None:
                    if not enregistrement_profil.est_active:
                        return False
                    return enregistrement_profil.est_active and FonctionnaliteActivable._dependances_actives(
                        enregistrement_profil, utilisateur, organisation
                    )

        # --- Niveau organisation ---
        if organisation is not None:
            enregistrement_org = FonctionnaliteActivable.objects.filter(
                code=code,
                niveau_controle="organisation",
                organisation=organisation,
            ).first()
            if enregistrement_org is not None:
                if not enregistrement_org.est_active:
                    return False
                return enregistrement_org.est_active and FonctionnaliteActivable._dependances_actives(
                    enregistrement_org, utilisateur, organisation
                )

        # --- Niveau système ---
        enregistrement_systeme = FonctionnaliteActivable.objects.filter(
            code=code,
            niveau_controle="systeme",
        ).first()
        if enregistrement_systeme is not None:
            return enregistrement_systeme.est_active and FonctionnaliteActivable._dependances_actives(
                enregistrement_systeme, utilisateur, organisation
            )

        # Aucun enregistrement trouvé → fermé par défaut
        return False

    @staticmethod
    def _dependances_actives(
        fonctionnalite: "FonctionnaliteActivable",
        utilisateur=None,
        organisation=None,
    ) -> bool:
        """
        Vérifie récursivement que toutes les fonctionnalités dont dépend
        celle passée en paramètre sont elles-mêmes actives dans le contexte donné.

        :param fonctionnalite: Instance de FonctionnaliteActivable.
        :param utilisateur: Instance de comptes.Utilisateur ou None.
        :param organisation: Instance de organisations.Organisation ou None.
        :return: True si toutes les dépendances sont actives.
        """
        if not fonctionnalite.modules_dependants:
            return True

        codes_dependants = [
            c.strip()
            for c in fonctionnalite.modules_dependants.split(",")
            if c.strip()
        ]
        for code_dependant in codes_dependants:
            if not FonctionnaliteActivable.est_active_pour(
                code_dependant,
                utilisateur=utilisateur,
                organisation=organisation,
            ):
                return False
        return True
