"""
Modèles voirie — Études de dimensionnement de chaussées.
Plateforme LBH — Bureau d'Études Économiste
"""

import uuid
from django.db import models


class EtudeVoirie(models.Model):
    """
    Étude de dimensionnement de chaussée rattachée à un projet.
    Stocke les données d'entrée et les résultats du moteur de calcul.
    """

    TYPES_VOIE = [
        ("voie_urbaine", "Voie urbaine"),
        ("route_departementale", "Route départementale"),
        ("voie_communale", "Voie communale"),
        ("parking", "Parking / aire de stationnement"),
        ("voie_industrielle", "Voie industrielle / desserte"),
        ("piste_cyclable", "Piste cyclable"),
        ("trottoir", "Trottoir / cheminement piéton"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    projet = models.ForeignKey(
        "projets.Projet", on_delete=models.CASCADE,
        related_name="etudes_voirie", verbose_name="Projet",
    )
    lot = models.ForeignKey(
        "projets.Lot", on_delete=models.SET_NULL,
        null=True, blank=True, verbose_name="Lot",
    )

    intitule = models.CharField(max_length=300, verbose_name="Intitulé de l'étude")
    type_voie = models.CharField(
        max_length=30, choices=TYPES_VOIE, default="voie_urbaine",
        verbose_name="Type de voie",
    )

    # ---- Données d'entrée trafic ----
    tmja_vl = models.PositiveIntegerField(
        default=0, verbose_name="TMJA — véhicules légers (VL/j)",
    )
    tmja_pl = models.PositiveIntegerField(
        default=0, verbose_name="TMJA — poids lourds (PL/j)",
    )
    duree_vie_ans = models.PositiveSmallIntegerField(
        null=True, blank=True, verbose_name="Durée de vie cible (ans)",
        help_text="Laisser vide pour utiliser le paramètre système.",
    )
    taux_croissance_annuel = models.DecimalField(
        max_digits=5, decimal_places=4,
        null=True, blank=True,
        verbose_name="Taux de croissance annuel du trafic",
        help_text="Ex : 0.02 pour 2 %. Laisser vide pour utiliser le paramètre système.",
    )

    # ---- Données sol ----
    cbr = models.DecimalField(
        max_digits=5, decimal_places=2,
        null=True, blank=True,
        verbose_name="Indice CBR mesuré",
    )
    classe_plateforme = models.CharField(
        max_length=5,
        choices=[("PF1", "PF1"), ("PF2", "PF2"), ("PF3", "PF3"), ("PF4", "PF4")],
        blank=True,
        verbose_name="Classe de plate-forme",
        help_text="Si CBR non disponible.",
    )
    zone_climatique = models.CharField(
        max_length=20,
        choices=[
            ("temperee", "Tempérée"),
            ("montagneuse", "Montagneuse"),
            ("oceanique", "Océanique"),
        ],
        default="temperee",
        verbose_name="Zone climatique",
    )
    proximite_eau = models.BooleanField(
        default=False, verbose_name="Zone humide / proximité eau",
    )

    # ---- Contraintes ----
    epaisseur_totale_max_cm = models.DecimalField(
        max_digits=5, decimal_places=1,
        null=True, blank=True,
        verbose_name="Épaisseur totale maximale (cm)",
    )
    type_structure_prefere = models.CharField(
        max_length=20,
        choices=[
            ("SOUPLE", "Structure souple"),
            ("SEMI_RIGIDE", "Structure semi-rigide"),
            ("GB", "Grave-bitume"),
            ("BC", "Béton de ciment"),
        ],
        blank=True,
        verbose_name="Type de structure préféré",
    )

    # ---- Résultats (stockés après calcul) ----
    resultats_calcul = models.JSONField(
        null=True, blank=True,
        verbose_name="Résultats du dimensionnement",
        help_text="Résultat JSON complet retourné par le moteur de calcul.",
    )
    date_calcul = models.DateTimeField(null=True, blank=True, verbose_name="Date du dernier calcul")
    calcul_conforme = models.BooleanField(
        null=True, blank=True, verbose_name="Résultat conforme",
    )

    observations = models.TextField(blank=True)
    date_creation = models.DateTimeField(auto_now_add=True)
    date_modification = models.DateTimeField(auto_now=True)
    cree_par = models.ForeignKey(
        "comptes.Utilisateur", on_delete=models.PROTECT,
        null=True, blank=True, related_name="etudes_voirie_creees",
    )

    class Meta:
        db_table = "voirie_etude"
        verbose_name = "Étude de voirie"
        verbose_name_plural = "Études de voirie"
        ordering = ["-date_modification"]

    def __str__(self):
        return f"{self.intitule} — {self.projet.reference}"
