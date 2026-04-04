# Migration : ajout des modèles EtudePrix et LignePrixEtude.
# EtudePrix = étude de prix analytique alimentant la bibliothèque.
# LignePrixEtude = ressource élémentaire (MO, matière, matériel, ST, transport).

import decimal
import uuid
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('bibliotheque', '0003_sous_detail_prix'),
        ('economie', '0001_initial'),
        ('organisations', '0001_initial'),
        ('projets', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='EtudePrix',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('intitule', models.CharField(max_length=300, verbose_name="Intitulé de l'étude de prix")),
                ('code', models.CharField(blank=True, max_length=50, verbose_name='Code')),
                ('description', models.TextField(blank=True, verbose_name='Description')),
                ('methode', models.CharField(
                    choices=[
                        ('analytique', 'Analytique — déboursé sec ressource par ressource'),
                        ('decompte', 'Décompte — depuis un bordereau chiffré'),
                        ('artiprix', 'ARTIPRIX — depuis le bordereau de prix unitaires 2025'),
                        ('constate', 'Constaté — relevé de chantier réel'),
                        ('estimatif', 'Estimatif — sans sous-détail'),
                    ],
                    default='analytique',
                    max_length=30,
                    verbose_name='Méthode',
                )),
                ('lot_type', models.CharField(
                    blank=True,
                    choices=[
                        ('7.1', '7.1 — VRD'), ('7.2', '7.2 — Terrassements'),
                        ('7.3', '7.3 — Gros Œuvre'), ('7.4', '7.4 — Façades'),
                        ('7.5', '7.5 — Murs-rideaux'), ('7.6', '7.6 — Construction Ossature Bois'),
                        ('7.7', '7.7 — Charpente métallique'), ('7.8', '7.8 — Charpente-Couverture-Zinguerie'),
                        ('7.9', '7.9 — Étanchéité'), ('7.10', '7.10 — Menuiseries extérieures'),
                        ('7.11', '7.11 — Menuiseries intérieures'), ('7.12', '7.12 — Isolation-Plâtrerie-Peinture'),
                        ('7.13', '7.13 — Revêtements sols et carrelage'), ('7.14', '7.14 — Électricité'),
                        ('7.15', '7.15 — Plomberie'), ('7.16', '7.16 — CVC'),
                        ('7.17', '7.17 — Ascenseur'), ('7.18', '7.18 — Aménagements paysagers'),
                        ('autre', 'Autre'),
                    ],
                    max_length=10,
                    verbose_name='Lot / Corps d\'état',
                )),
                ('millesime', models.PositiveSmallIntegerField(
                    default=2025,
                    verbose_name='Millésime',
                    help_text='Année de référence des prix utilisés',
                )),
                ('zone_taux_horaire', models.CharField(
                    choices=[('A', 'Zone A — Province (41 €/h)'), ('B', 'Zone B — IDF (56 €/h)')],
                    default='A',
                    max_length=5,
                    verbose_name='Zone tarifaire',
                )),
                ('taux_horaire_mo', models.DecimalField(
                    decimal_places=4, default=decimal.Decimal('41.0000'), max_digits=8,
                    verbose_name='Taux horaire MO retenu (€/h)',
                )),
                ('hypotheses', models.TextField(blank=True, verbose_name='Hypothèses de calcul')),
                ('observations', models.TextField(blank=True)),
                ('statut', models.CharField(
                    choices=[
                        ('brouillon', 'Brouillon'), ('en_cours', 'En cours'),
                        ('a_valider', 'À valider'), ('validee', 'Validée'),
                        ('publiee', 'Publiée en bibliothèque'), ('archivee', 'Archivée'),
                    ],
                    default='brouillon',
                    max_length=30,
                )),
                ('date_etude', models.DateField(blank=True, null=True, verbose_name="Date de l'étude")),
                ('date_validation', models.DateField(blank=True, null=True, verbose_name='Date de validation')),
                ('total_mo_ht', models.DecimalField(decimal_places=4, default=0, max_digits=14)),
                ('total_matieres_ht', models.DecimalField(decimal_places=4, default=0, max_digits=14)),
                ('total_materiel_ht', models.DecimalField(decimal_places=4, default=0, max_digits=14)),
                ('total_sous_traitance_ht', models.DecimalField(decimal_places=4, default=0, max_digits=14)),
                ('total_transport_ht', models.DecimalField(decimal_places=4, default=0, max_digits=14)),
                ('total_frais_divers_ht', models.DecimalField(decimal_places=4, default=0, max_digits=14)),
                ('debourse_sec_ht', models.DecimalField(
                    decimal_places=4, default=0, max_digits=14,
                    verbose_name='Déboursé sec total HT',
                )),
                ('date_creation', models.DateTimeField(auto_now_add=True)),
                ('date_modification', models.DateTimeField(auto_now=True)),
                ('auteur', models.ForeignKey(
                    null=True, on_delete=django.db.models.deletion.PROTECT,
                    related_name='etudes_de_prix_creees', to=settings.AUTH_USER_MODEL,
                    verbose_name='Auteur',
                )),
                ('validateur', models.ForeignKey(
                    blank=True, null=True, on_delete=django.db.models.deletion.PROTECT,
                    related_name='etudes_de_prix_validees', to=settings.AUTH_USER_MODEL,
                    verbose_name='Validateur',
                )),
                ('projet', models.ForeignKey(
                    blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                    related_name='etudes_de_prix', to='projets.projet',
                    verbose_name='Projet associé',
                )),
                ('organisation', models.ForeignKey(
                    blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                    related_name='etudes_de_prix', to='organisations.organisation',
                    verbose_name='Organisation',
                )),
                ('ligne_bibliotheque', models.ForeignKey(
                    blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                    related_name='etudes_source', to='bibliotheque.ligneprixbibliotheque',
                    verbose_name='Ligne de bibliothèque publiée',
                )),
            ],
            options={
                'verbose_name': 'Étude de prix',
                'verbose_name_plural': 'Études de prix',
                'db_table': 'economie_etude_prix',
            },
        ),
        migrations.CreateModel(
            name='LignePrixEtude',
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
                ('unite', models.CharField(default='u', max_length=20, verbose_name='Unité')),
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
                    verbose_name='Taux horaire MO (€/h)',
                    help_text='Pour les ressources MO : montant = quantité (h) × taux horaire',
                )),
                ('observations', models.TextField(blank=True)),
                ('etude', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='lignes',
                    to='economie.etudeprix',
                    verbose_name='Étude de prix',
                )),
            ],
            options={
                'verbose_name': 'Ligne de ressource',
                'verbose_name_plural': 'Lignes de ressource (études de prix)',
                'db_table': 'economie_ligne_prix_etude',
                'ordering': ['etude', 'ordre'],
            },
        ),
        migrations.AddIndex(
            model_name='etudeprix',
            index=models.Index(fields=['statut', 'millesime'], name='eco_ep_statut_millesime_idx'),
        ),
        migrations.AddIndex(
            model_name='etudeprix',
            index=models.Index(fields=['lot_type'], name='eco_ep_lot_type_idx'),
        ),
    ]
