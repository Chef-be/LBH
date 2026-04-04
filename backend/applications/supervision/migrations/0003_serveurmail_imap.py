from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("supervision", "0002_instantaneserveur_serveurmail"),
    ]

    operations = [
        migrations.AddField(
            model_name="serveurmail",
            name="imap_chiffrement",
            field=models.CharField(
                choices=[("aucun", "Aucun"), ("starttls", "STARTTLS"), ("ssl_tls", "SSL / TLS")],
                default="ssl_tls",
                max_length=20,
                verbose_name="Chiffrement IMAP",
            ),
        ),
        migrations.AddField(
            model_name="serveurmail",
            name="imap_dossier_archives",
            field=models.CharField(blank=True, max_length=120, verbose_name="Dossier IMAP des archives"),
        ),
        migrations.AddField(
            model_name="serveurmail",
            name="imap_dossier_brouillons",
            field=models.CharField(blank=True, max_length=120, verbose_name="Dossier IMAP des brouillons"),
        ),
        migrations.AddField(
            model_name="serveurmail",
            name="imap_dossier_envoyes",
            field=models.CharField(blank=True, max_length=120, verbose_name="Dossier IMAP des envoyés"),
        ),
        migrations.AddField(
            model_name="serveurmail",
            name="imap_hote",
            field=models.CharField(blank=True, max_length=255, verbose_name="Hôte IMAP"),
        ),
        migrations.AddField(
            model_name="serveurmail",
            name="imap_mot_de_passe",
            field=models.TextField(blank=True, verbose_name="Mot de passe IMAP"),
        ),
        migrations.AddField(
            model_name="serveurmail",
            name="imap_port",
            field=models.PositiveIntegerField(default=993, verbose_name="Port IMAP"),
        ),
        migrations.AddField(
            model_name="serveurmail",
            name="imap_utilisateur",
            field=models.CharField(blank=True, max_length=255, verbose_name="Utilisateur IMAP"),
        ),
        migrations.AddField(
            model_name="serveurmail",
            name="imap_verifier_certificat",
            field=models.BooleanField(default=True, verbose_name="Vérifier le certificat IMAP"),
        ),
    ]
