from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("documents", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="document",
            name="analyse_automatique",
            field=models.JSONField(blank=True, default=dict, verbose_name="Résultats d'analyse automatique"),
        ),
        migrations.AddField(
            model_name="document",
            name="analyse_automatique_effectuee",
            field=models.BooleanField(default=False, verbose_name="Analyse automatique effectuée"),
        ),
        migrations.AddField(
            model_name="document",
            name="date_analyse_automatique",
            field=models.DateTimeField(blank=True, null=True, verbose_name="Date d'analyse automatique"),
        ),
    ]
