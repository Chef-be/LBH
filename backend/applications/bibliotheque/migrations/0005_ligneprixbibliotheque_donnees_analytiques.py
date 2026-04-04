from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("bibliotheque", "0004_rename_bib_sdp_ligne_ordre_idx_bibliothequ_ligne_p_83796f_idx_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="ligneprixbibliotheque",
            name="criteres_metre",
            field=models.TextField(blank=True, verbose_name="Critères de métré"),
        ),
        migrations.AddField(
            model_name="ligneprixbibliotheque",
            name="dechets_generes",
            field=models.JSONField(blank=True, default=list, verbose_name="Déchets générés"),
        ),
        migrations.AddField(
            model_name="ligneprixbibliotheque",
            name="donnees_analytiques",
            field=models.JSONField(blank=True, default=dict, verbose_name="Données analytiques"),
        ),
        migrations.AddField(
            model_name="ligneprixbibliotheque",
            name="normes_applicables",
            field=models.JSONField(blank=True, default=list, verbose_name="Normes applicables"),
        ),
        migrations.AddField(
            model_name="ligneprixbibliotheque",
            name="phases_execution",
            field=models.JSONField(blank=True, default=list, verbose_name="Phases d'exécution"),
        ),
        migrations.AddField(
            model_name="ligneprixbibliotheque",
            name="prescriptions_techniques",
            field=models.TextField(blank=True, verbose_name="Prescriptions techniques"),
        ),
    ]
