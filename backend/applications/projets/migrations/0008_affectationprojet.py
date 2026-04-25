from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ("comptes", "0001_initial"),
        ("projets", "0007_supprimer_colonne_univers_metier"),
    ]

    operations = [
        migrations.CreateModel(
            name="AffectationProjet",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("nature", models.CharField(choices=[("projet", "Projet complet"), ("mission", "Mission"), ("livrable", "Livrable")], default="mission", max_length=20)),
                ("code_cible", models.CharField(blank=True, default="", max_length=120, verbose_name="Code mission/livrable")),
                ("libelle_cible", models.CharField(blank=True, default="", max_length=255, verbose_name="Libellé ciblé")),
                ("role", models.CharField(choices=[("pilotage", "Pilotage"), ("contribution", "Contribution"), ("redaction", "Rédaction"), ("etude_prix", "Étude de prix"), ("verification", "Vérification"), ("planning", "Planning"), ("opc", "OPC")], default="contribution", max_length=30)),
                ("commentaires", models.TextField(blank=True, default="")),
                ("date_creation", models.DateTimeField(auto_now_add=True)),
                ("date_modification", models.DateTimeField(auto_now=True)),
                ("cree_par", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="affectations_projet_creees", to="comptes.utilisateur")),
                ("projet", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="affectations", to="projets.projet")),
                ("utilisateur", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="affectations_projet", to="comptes.utilisateur")),
            ],
            options={
                "verbose_name": "Affectation projet",
                "verbose_name_plural": "Affectations projet",
                "db_table": "projets_affectation",
                "ordering": ["nature", "libelle_cible", "date_creation"],
            },
        ),
        migrations.AddConstraint(
            model_name="affectationprojet",
            constraint=models.UniqueConstraint(fields=("projet", "utilisateur", "nature", "code_cible"), name="projets_affectation_unique_cible"),
        ),
    ]
