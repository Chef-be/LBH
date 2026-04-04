from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("pieces_ecrites", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="pieceecrite",
            name="variables_personnalisees",
            field=models.JSONField(blank=True, default=dict, verbose_name="Variables de fusion personnalisées"),
        ),
    ]
