# Generated manually — ajout du champ module à FonctionnaliteActivable

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("parametres", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="fonctionnaliteactivable",
            name="module",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Module applicatif auquel appartient cette fonctionnalité.",
                max_length=100,
                verbose_name="Module",
            ),
        ),
    ]
