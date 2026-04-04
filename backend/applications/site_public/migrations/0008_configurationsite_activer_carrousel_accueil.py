from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("site_public", "0007_configurationsite_contenus_pages"),
    ]

    operations = [
        migrations.AddField(
            model_name="configurationsite",
            name="activer_carrousel_accueil",
            field=models.BooleanField(
                default=True,
                help_text="Permet d'afficher ou de masquer le carrousel sans supprimer ses diapositives.",
                verbose_name="Activer le carrousel d'accueil",
            ),
        ),
    ]
