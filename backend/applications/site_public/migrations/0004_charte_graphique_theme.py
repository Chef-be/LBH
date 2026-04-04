"""Migration : charte graphique, thème couleur, mode sombre, police, carrousel."""

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("site_public", "0003_ajout_slug_actualite_prestation"),
    ]

    operations = [
        migrations.AddField(
            model_name="configurationsite",
            name="couleur_theme",
            field=models.CharField(
                choices=[
                    ("bleu_marine", "Bleu marine (défaut)"),
                    ("bleu_ciel", "Bleu ciel"),
                    ("emeraude", "Émeraude"),
                    ("violet", "Violet"),
                    ("ardoise", "Ardoise"),
                    ("rouge_brique", "Rouge brique"),
                    ("teal", "Teal"),
                    ("brun_dore", "Brun doré"),
                ],
                default="bleu_marine",
                max_length=20,
                verbose_name="Thème couleur",
            ),
        ),
        migrations.AddField(
            model_name="configurationsite",
            name="mode_theme_defaut",
            field=models.CharField(
                choices=[
                    ("automatique", "Automatique (suit le système)"),
                    ("clair", "Toujours clair"),
                    ("sombre", "Toujours sombre"),
                ],
                default="automatique",
                max_length=15,
                verbose_name="Mode par défaut (clair/sombre/automatique)",
            ),
        ),
        migrations.AddField(
            model_name="configurationsite",
            name="police_principale",
            field=models.CharField(
                choices=[
                    ("inter", "Inter (défaut)"),
                    ("roboto", "Roboto"),
                    ("poppins", "Poppins"),
                    ("raleway", "Raleway"),
                    ("lato", "Lato"),
                ],
                default="inter",
                max_length=20,
                verbose_name="Police principale",
            ),
        ),
        migrations.AddField(
            model_name="configurationsite",
            name="carousel_accueil",
            field=models.JSONField(
                blank=True,
                default=list,
                help_text=(
                    "Liste JSON d'objets "
                    "{titre, sous_titre, image_url, cta_texte, cta_lien, couleur_fond}. "
                    "Si vide, la section héros statique est affichée."
                ),
                verbose_name="Diapositives du carrousel héros",
            ),
        ),
    ]
