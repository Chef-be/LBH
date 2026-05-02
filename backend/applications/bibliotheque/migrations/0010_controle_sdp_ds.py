from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("bibliotheque", "0009_ajout_illustrations_ligne_prix"),
    ]

    operations = [
        migrations.AddField(
            model_name="ligneprixbibliotheque",
            name="source_ds",
            field=models.CharField(
                choices=[
                    ("sdp_reel", "Sous-détail analytique réel"),
                    ("estimation_inverse", "Estimation inverse"),
                    ("saisie_manuelle", "Saisie manuelle"),
                    ("import", "Import"),
                    ("inconnu", "Inconnu"),
                ],
                default="inconnu",
                max_length=30,
            ),
        ),
        migrations.AddField(
            model_name="ligneprixbibliotheque",
            name="date_dernier_recalcul_sdp",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="ligneprixbibliotheque",
            name="ds_justifie_par_sdp",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="ligneprixbibliotheque",
            name="message_controle_sdp_ds",
            field=models.TextField(blank=True),
        ),
    ]
