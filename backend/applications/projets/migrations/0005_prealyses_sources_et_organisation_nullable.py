from django.db import migrations, models
import django.db.models.deletion
import uuid


def _rendre_organisation_nullable_si_necessaire(apps, schema_editor):
    with schema_editor.connection.cursor() as curseur:
        curseur.execute(
            """
            SELECT is_nullable
            FROM information_schema.columns
            WHERE table_name = 'projets_projet' AND column_name = 'organisation_id'
            """
        )
        ligne = curseur.fetchone()
    if ligne and ligne[0] == "NO":
        schema_editor.execute("ALTER TABLE projets_projet ALTER COLUMN organisation_id DROP NOT NULL")


def _creer_table_preanalyse_si_absente(apps, schema_editor):
    tables = set(schema_editor.connection.introspection.table_names())
    if "projets_preanalyse_sources" in tables:
        return

    utilisateur_table = apps.get_model("comptes", "Utilisateur")._meta.db_table
    schema_editor.execute(
        f"""
        CREATE TABLE projets_preanalyse_sources (
            id uuid NOT NULL PRIMARY KEY,
            statut varchar(20) NOT NULL,
            progression smallint NOT NULL CHECK (progression >= 0),
            message varchar(255) NOT NULL DEFAULT '',
            nombre_fichiers integer NOT NULL CHECK (nombre_fichiers >= 0),
            resultat jsonb NOT NULL DEFAULT '{{}}'::jsonb,
            erreur text NOT NULL DEFAULT '',
            parametres jsonb NOT NULL DEFAULT '{{}}'::jsonb,
            chemin_stockage varchar(500) NOT NULL DEFAULT '',
            tache_celery_id varchar(255) NOT NULL DEFAULT '',
            date_creation timestamptz NOT NULL,
            date_modification timestamptz NOT NULL,
            date_fin timestamptz NULL,
            utilisateur_id uuid NOT NULL REFERENCES {utilisateur_table} (id) DEFERRABLE INITIALLY DEFERRED
        )
        """
    )
    schema_editor.execute(
        "CREATE INDEX projets_preanalyse_sources_utilisateur_id_idx ON projets_preanalyse_sources (utilisateur_id)"
    )


class Migration(migrations.Migration):

    dependencies = [
        ("comptes", "0003_activation_compte_et_reinitialisation"),
        ("organisations", "0001_initial"),
        ("projets", "0004_projet_qualification_wizard"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunPython(
                    _rendre_organisation_nullable_si_necessaire,
                    reverse_code=migrations.RunPython.noop,
                ),
                migrations.RunPython(
                    _creer_table_preanalyse_si_absente,
                    reverse_code=migrations.RunPython.noop,
                ),
            ],
            state_operations=[
                migrations.AlterField(
                    model_name="projet",
                    name="organisation",
                    field=models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="projets",
                        to="organisations.organisation",
                        verbose_name="Bureau d'études",
                    ),
                ),
                migrations.CreateModel(
                    name="PreanalyseSourcesProjet",
                    fields=[
                        ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                        ("statut", models.CharField(choices=[("en_attente", "En attente"), ("en_cours", "En cours"), ("terminee", "Terminée"), ("echec", "Échec")], default="en_attente", max_length=20)),
                        ("progression", models.PositiveSmallIntegerField(default=0)),
                        ("message", models.CharField(blank=True, default="", max_length=255)),
                        ("nombre_fichiers", models.PositiveIntegerField(default=0)),
                        ("resultat", models.JSONField(blank=True, default=dict)),
                        ("erreur", models.TextField(blank=True, default="")),
                        ("contexte", models.JSONField(blank=True, db_column="parametres", default=dict)),
                        ("repertoire_temp", models.CharField(blank=True, db_column="chemin_stockage", default="", max_length=500)),
                        ("tache_celery_id", models.CharField(blank=True, default="", max_length=255)),
                        ("date_creation", models.DateTimeField(auto_now_add=True)),
                        ("date_modification", models.DateTimeField(auto_now=True)),
                        ("date_fin", models.DateTimeField(blank=True, null=True)),
                        (
                            "utilisateur",
                            models.ForeignKey(
                                on_delete=django.db.models.deletion.CASCADE,
                                related_name="preanalyses_sources_projets",
                                to="comptes.utilisateur",
                            ),
                        ),
                    ],
                    options={
                        "verbose_name": "Préanalyse des sources projet",
                        "verbose_name_plural": "Préanalyses des sources projet",
                        "db_table": "projets_preanalyse_sources",
                        "ordering": ["-date_creation"],
                    },
                ),
            ],
        ),
    ]
