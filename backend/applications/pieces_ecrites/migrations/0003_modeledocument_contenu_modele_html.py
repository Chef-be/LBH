from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("pieces_ecrites", "0002_pieceecrite_variables_personnalisees"),
    ]

    operations = [
        migrations.AddField(
            model_name="modeledocument",
            name="contenu_modele_html",
            field=models.TextField(
                blank=True,
                help_text="Contenu HTML rédigé dans l'éditeur visuel et utilisé pour générer la pièce.",
                verbose_name="Contenu visuel du modèle",
            ),
        ),
    ]
