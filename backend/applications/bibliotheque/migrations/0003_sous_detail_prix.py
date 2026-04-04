# Migration : ajout du modèle SousDetailPrix — sous-détail d'une ligne de bibliothèque de prix.

import uuid
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('bibliotheque', '0002_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='SousDetailPrix',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('ordre', models.PositiveSmallIntegerField(default=1, verbose_name="Ordre d'affichage")),
                ('type_ressource', models.CharField(
                    choices=[
                        ('mo', "Main-d'œuvre"),
                        ('matiere', 'Matière / Fourniture'),
                        ('materiel', 'Matériel / Engin'),
                        ('sous_traitance', 'Sous-traitance'),
                        ('transport', 'Transport'),
                        ('frais_divers', 'Frais divers'),
                    ],
                    max_length=20,
                    verbose_name='Type de ressource',
                )),
                ('code', models.CharField(blank=True, max_length=50, verbose_name='Code ressource')),
                ('designation', models.CharField(max_length=300, verbose_name='Désignation')),
                ('unite', models.CharField(max_length=20, verbose_name='Unité')),
                ('quantite', models.DecimalField(
                    decimal_places=6, default=1, max_digits=14,
                    verbose_name="Quantité par unité d'ouvrage",
                )),
                ('cout_unitaire_ht', models.DecimalField(
                    decimal_places=6, default=0, max_digits=12,
                    verbose_name='Coût unitaire HT (€)',
                )),
                ('montant_ht', models.DecimalField(
                    decimal_places=4, default=0, max_digits=14,
                    verbose_name='Montant HT (calculé)',
                )),
                ('taux_horaire', models.DecimalField(
                    decimal_places=4, default=0, max_digits=8,
                    verbose_name="Taux horaire MO (€/h)",
                    help_text="Renseigné pour les ressources main-d'œuvre uniquement",
                )),
                ('zone_taux', models.CharField(
                    blank=True, max_length=5,
                    choices=[
                        ('A', 'Zone A — Province (41 €/h)'),
                        ('B', 'Zone B — IDF (56 €/h)'),
                    ],
                    verbose_name='Zone tarifaire ARTIPRIX',
                )),
                ('observations', models.TextField(blank=True)),
                ('date_modification', models.DateTimeField(auto_now=True)),
                ('ligne_prix', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='sous_details',
                    to='bibliotheque.ligneprixbibliotheque',
                    verbose_name='Ligne de prix parente',
                )),
            ],
            options={
                'verbose_name': 'Sous-détail de prix',
                'verbose_name_plural': 'Sous-détails de prix',
                'db_table': 'bibliotheque_sous_detail_prix',
                'ordering': ['ligne_prix', 'ordre'],
            },
        ),
        migrations.AddIndex(
            model_name='sousdetailprix',
            index=models.Index(fields=['ligne_prix', 'ordre'], name='bib_sdp_ligne_ordre_idx'),
        ),
        migrations.AddIndex(
            model_name='sousdetailprix',
            index=models.Index(fields=['type_ressource'], name='bib_sdp_type_ressource_idx'),
        ),
    ]
