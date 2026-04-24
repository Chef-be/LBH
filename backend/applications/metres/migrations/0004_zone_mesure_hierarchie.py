from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('metres', '0003_fond_plan_intitule_optionnel'),
    ]

    operations = [
        migrations.AddField(
            model_name='zonemesure',
            name='zone_parente',
            field=models.ForeignKey(
                blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                related_name='sous_zones', to='metres.zonemesure',
                verbose_name='Zone parente (hiérarchie)',
            ),
        ),
        migrations.AddField(
            model_name='zonemesure',
            name='numero',
            field=models.CharField(blank=True, max_length=20, verbose_name='Numéro de zone (ex: 1, 1.1, 1.2)'),
        ),
    ]
