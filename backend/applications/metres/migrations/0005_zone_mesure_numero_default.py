from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('metres', '0004_zone_mesure_hierarchie'),
    ]

    operations = [
        migrations.RunSQL(
            sql="ALTER TABLE metres_zone_mesure ALTER COLUMN numero SET DEFAULT '';",
            reverse_sql="ALTER TABLE metres_zone_mesure ALTER COLUMN numero DROP DEFAULT;",
        ),
        migrations.AlterField(
            model_name='zonemesure',
            name='numero',
            field=models.CharField(blank=True, default='', max_length=20, verbose_name='Numéro de zone (ex: 1, 1.1, 1.2)'),
        ),
    ]
