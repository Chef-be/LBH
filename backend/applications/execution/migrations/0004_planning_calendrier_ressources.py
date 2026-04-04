from django.db import migrations, models


def jours_ouvres_defaut():
    return [0, 1, 2, 3, 4]


class Migration(migrations.Migration):

    dependencies = [
        ("execution", "0003_planning_chantier"),
    ]

    operations = [
        migrations.AddField(
            model_name="planningchantier",
            name="jours_feries",
            field=models.JSONField(blank=True, default=list, verbose_name="Jours fériés ou neutralisés"),
        ),
        migrations.AddField(
            model_name="planningchantier",
            name="jours_ouvres",
            field=models.JSONField(blank=True, default=jours_ouvres_defaut, verbose_name="Jours ouvrés actifs"),
        ),
        migrations.AddField(
            model_name="planningchantier",
            name="lisser_ressources_partagees",
            field=models.BooleanField(default=True, verbose_name="Lisser les ressources partagées"),
        ),
    ]
