from decimal import Decimal

from django.db import migrations, models
import django.db.models.deletion
import uuid
from django.utils import timezone


class Migration(migrations.Migration):

    dependencies = [
        ("economie", "0006_references_sociales_et_variantes_locales"),
        ("execution", "0002_pilotage_processus"),
    ]

    operations = [
        migrations.CreateModel(
            name="PlanningChantier",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("intitule", models.CharField(max_length=255, verbose_name="Intitulé")),
                ("source_donnees", models.CharField(choices=[("manuel", "Saisie manuelle"), ("etude_economique", "Étude économique / DPGF"), ("etude_prix", "Étude de prix")], default="manuel", max_length=30)),
                ("date_debut_reference", models.DateField(default=timezone.now, verbose_name="Début de référence")),
                ("heures_par_jour", models.DecimalField(decimal_places=2, default=Decimal("7.00"), max_digits=5)),
                ("coefficient_rendement_global", models.DecimalField(decimal_places=4, default=Decimal("1.0000"), max_digits=6)),
                ("chemin_critique", models.JSONField(blank=True, default=list)),
                ("synthese_calcul", models.JSONField(blank=True, default=dict)),
                ("date_creation", models.DateTimeField(auto_now_add=True)),
                ("date_modification", models.DateTimeField(auto_now=True)),
                ("etude_economique", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="plannings_chantier", to="economie.etudeeconomique")),
                ("etude_prix", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="plannings_chantier", to="economie.etudeprix")),
                ("suivi", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="plannings", to="execution.suiviexecution", verbose_name="Suivi")),
            ],
            options={
                "db_table": "execution_planning_chantier",
                "verbose_name": "Planning chantier",
                "verbose_name_plural": "Plannings chantier",
                "ordering": ["-date_modification"],
            },
        ),
        migrations.CreateModel(
            name="TachePlanning",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("numero_ordre", models.PositiveSmallIntegerField(default=1)),
                ("code", models.CharField(blank=True, max_length=50)),
                ("designation", models.CharField(max_length=500)),
                ("unite", models.CharField(blank=True, default="", max_length=20)),
                ("quantite", models.DecimalField(decimal_places=3, default=0, max_digits=15)),
                ("temps_unitaire_heures", models.DecimalField(decimal_places=4, default=0, max_digits=12)),
                ("heures_totales", models.DecimalField(decimal_places=4, default=0, max_digits=14)),
                ("effectif_alloue", models.PositiveSmallIntegerField(default=1)),
                ("duree_jours", models.DecimalField(decimal_places=2, default=1, max_digits=10)),
                ("decalage_jours", models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ("date_debut_calculee", models.DateField(blank=True, null=True)),
                ("date_fin_calculee", models.DateField(blank=True, null=True)),
                ("marge_libre_jours", models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ("est_critique", models.BooleanField(default=False)),
                ("mode_calcul", models.CharField(choices=[("auto", "Automatique"), ("manuel", "Forcé manuellement")], default="auto", max_length=20)),
                ("metadata_calcul", models.JSONField(blank=True, default=dict)),
                ("observations", models.TextField(blank=True)),
                ("planning", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="taches", to="execution.planningchantier", verbose_name="Planning")),
                ("ref_ligne_economique", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="taches_planning", to="economie.ligneprix")),
                ("ref_ligne_prix", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="taches_planning", to="economie.ligneprixetude")),
            ],
            options={
                "db_table": "execution_tache_planning",
                "verbose_name": "Tâche de planning",
                "verbose_name_plural": "Tâches de planning",
                "ordering": ["planning", "numero_ordre", "designation"],
            },
        ),
        migrations.CreateModel(
            name="AffectationEquipeTache",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("effectif", models.PositiveSmallIntegerField(default=1)),
                ("rendement_relatif", models.DecimalField(decimal_places=4, default=Decimal("1.0000"), max_digits=6)),
                ("est_chef_equipe", models.BooleanField(default=False)),
                ("profil", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="affectations_taches_planning", to="economie.profilmainoeuvre")),
                ("tache", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="affectations_equipe", to="execution.tacheplanning")),
            ],
            options={
                "db_table": "execution_affectation_equipe_tache",
                "verbose_name": "Affectation d'équipe à une tâche",
                "verbose_name_plural": "Affectations d'équipes aux tâches",
                "unique_together": {("tache", "profil")},
            },
        ),
        migrations.CreateModel(
            name="DependanceTachePlanning",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("type_dependance", models.CharField(choices=[("fd", "Fin -> Début"), ("dd", "Début -> Début")], default="fd", max_length=10)),
                ("decalage_jours", models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ("tache_amont", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="dependances_sortantes", to="execution.tacheplanning")),
                ("tache_aval", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="dependances_entrantes", to="execution.tacheplanning")),
            ],
            options={
                "db_table": "execution_dependance_tache_planning",
                "verbose_name": "Dépendance de tâche",
                "verbose_name_plural": "Dépendances de tâches",
                "unique_together": {("tache_amont", "tache_aval", "type_dependance")},
            },
        ),
    ]
