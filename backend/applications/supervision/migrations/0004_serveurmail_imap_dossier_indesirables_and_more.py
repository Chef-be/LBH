from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("supervision", "0003_serveurmail_imap"),
    ]

    operations = [
        migrations.AddField(
            model_name="serveurmail",
            name="imap_dossier_indesirables",
            field=models.CharField(blank=True, max_length=120, verbose_name="Dossier IMAP des indésirables"),
        ),
        migrations.AddField(
            model_name="serveurmail",
            name="imap_dossier_corbeille",
            field=models.CharField(blank=True, max_length=120, verbose_name="Dossier IMAP de la corbeille"),
        ),
    ]
