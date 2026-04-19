"""Migration — ajout du champ statut à ArticleCCTP."""

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("pieces_ecrites", "0011_ajoute_ligne_dpgf"),
    ]

    operations = [
        migrations.AddField(
            model_name="articlecctp",
            name="statut",
            field=models.CharField(
                choices=[
                    ("brouillon", "Brouillon"),
                    ("a_completer", "À compléter — créé depuis le métré"),
                    ("valide", "Validé — article complet"),
                ],
                db_index=True,
                default="brouillon",
                max_length=20,
                verbose_name="Statut de complétion",
            ),
        ),
    ]
