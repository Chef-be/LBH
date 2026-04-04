from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("site_public", "0004_charte_graphique_theme"),
    ]

    operations = [
        migrations.AlterField(
            model_name="configurationsite",
            name="nom_bureau",
            field=models.CharField(
                blank=True,
                default="",
                max_length=200,
                verbose_name="Nom du bureau d'études",
            ),
        ),
        migrations.AlterField(
            model_name="configurationsite",
            name="titre_hero",
            field=models.CharField(
                default="",
                max_length=300,
                verbose_name="Titre du héros",
            ),
        ),
        migrations.AlterField(
            model_name="configurationsite",
            name="sous_titre_hero",
            field=models.TextField(
                blank=True,
                default="",
                verbose_name="Sous-titre du héros",
            ),
        ),
        migrations.AlterField(
            model_name="configurationsite",
            name="texte_cta_principal",
            field=models.CharField(
                blank=True,
                default="",
                max_length=100,
                verbose_name="Texte du bouton principal",
            ),
        ),
        migrations.AlterField(
            model_name="configurationsite",
            name="texte_cta_secondaire",
            field=models.CharField(
                blank=True,
                default="",
                max_length=100,
                verbose_name="Texte du bouton secondaire",
            ),
        ),
        migrations.AlterField(
            model_name="configurationsite",
            name="etiquette_hero",
            field=models.CharField(
                blank=True,
                default="",
                max_length=200,
                verbose_name="Étiquette héros (bandeau discret au-dessus du titre)",
            ),
        ),
        migrations.AlterField(
            model_name="configurationsite",
            name="pays",
            field=models.CharField(
                blank=True,
                default="",
                max_length=100,
                verbose_name="Pays",
            ),
        ),
        migrations.AlterField(
            model_name="configurationsite",
            name="texte_cta_bandeau",
            field=models.CharField(
                blank=True,
                default="",
                max_length=300,
                verbose_name="Titre du bandeau CTA",
            ),
        ),
    ]
