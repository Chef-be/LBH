from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("projets", "0006_ajoute_mission_client_livrable_modele_document"),
    ]

    operations = [
        migrations.RunSQL(
            sql="ALTER TABLE projets_projet DROP COLUMN IF EXISTS univers_metier;",
            reverse_sql=(
                "ALTER TABLE projets_projet "
                "ADD COLUMN IF NOT EXISTS univers_metier varchar(30);"
            ),
        ),
    ]
