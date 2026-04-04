from decimal import Decimal
import django.db.models.deletion
from django.db import migrations, models


def initialiser_sous_details_main_oeuvre(apps, schema_editor):
    SousDetailPrix = apps.get_model("bibliotheque", "SousDetailPrix")
    for sous_detail in SousDetailPrix.objects.filter(type_ressource="mo"):
        updates = []
        if not sous_detail.nombre_ressources:
            sous_detail.nombre_ressources = Decimal("1")
            updates.append("nombre_ressources")
        if not sous_detail.temps_unitaire and sous_detail.quantite:
            sous_detail.temps_unitaire = sous_detail.quantite
            updates.append("temps_unitaire")
        if updates:
            sous_detail.save(update_fields=updates)


class Migration(migrations.Migration):

    dependencies = [
        ('bibliotheque', '0006_ligneprixbibliotheque_cahier_des_charges_structure_and_more'),
        ('economie', '0007_ligneprixetude_nombre_ressources_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='sousdetailprix',
            name='nombre_ressources',
            field=models.DecimalField(decimal_places=3, default=1, max_digits=8, verbose_name='Nombre de ressources'),
        ),
        migrations.AddField(
            model_name='sousdetailprix',
            name='profil_main_oeuvre',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='sous_details_bibliotheque', to='economie.profilmainoeuvre', verbose_name="Profil de main-d'œuvre"),
        ),
        migrations.AddField(
            model_name='sousdetailprix',
            name='temps_unitaire',
            field=models.DecimalField(decimal_places=6, default=0, max_digits=12, verbose_name='Temps unitaire (h)'),
        ),
        migrations.RunPython(initialiser_sous_details_main_oeuvre, migrations.RunPython.noop),
    ]
