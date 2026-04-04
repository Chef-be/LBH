# Migration : enrichissement Prestation (slug, catégorie) + modèle Actualite

import django.db.models.deletion
import uuid
from django.conf import settings
from django.db import migrations, models
from django.utils.text import slugify


def generer_slugs_prestations(apps, schema_editor):
    """Génère un slug à partir du titre pour chaque prestation existante."""
    Prestation = apps.get_model("site_public", "Prestation")
    vus = set()
    for p in Prestation.objects.all():
        base = slugify(p.titre) or f"prestation-{p.pk}"
        slug = base
        compteur = 1
        while slug in vus:
            slug = f"{base}-{compteur}"
            compteur += 1
        vus.add(slug)
        p.slug = slug
        p.save(update_fields=["slug"])


class Migration(migrations.Migration):

    dependencies = [
        ('site_public', '0002_configuration_statistiques_valeurs_demarche'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # ── Champs enrichis sur Prestation ─────────────────────────────────
        migrations.AddField(
            model_name='prestation',
            name='accroche_page',
            field=models.TextField(blank=True, verbose_name="Texte d'accroche page détail"),
        ),
        migrations.AddField(
            model_name='prestation',
            name='avantages',
            field=models.JSONField(blank=True, default=list, help_text="Liste JSON d'objets {icone, titre, description}.", verbose_name='Avantages client'),
        ),
        migrations.AddField(
            model_name='prestation',
            name='categorie',
            field=models.CharField(choices=[('economie', 'Économie de la construction'), ('vrd', 'Voirie et réseaux divers'), ('batiment', 'Bâtiment'), ('assistance', "Assistance maîtrise d'œuvre"), ('documents', 'Documents de marché'), ('autre', 'Autre')], default='autre', max_length=20, verbose_name='Catégorie'),
        ),
        migrations.AddField(
            model_name='prestation',
            name='livrables',
            field=models.JSONField(blank=True, default=list, help_text='Liste JSON de textes (documents/rendus fournis).', verbose_name='Livrables'),
        ),
        migrations.AddField(
            model_name='prestation',
            name='meta_description',
            field=models.CharField(blank=True, max_length=500, verbose_name='Meta description'),
        ),
        migrations.AddField(
            model_name='prestation',
            name='meta_titre',
            field=models.CharField(blank=True, max_length=300, verbose_name='Meta titre'),
        ),
        migrations.AddField(
            model_name='prestation',
            name='titre_page',
            field=models.CharField(blank=True, max_length=300, verbose_name='Titre page détail'),
        ),

        # ── Slug : ajout via SQL brut puis contrainte unique en deux temps ──
        # Étape 1 : colonne simple, sans index
        migrations.RunSQL(
            sql="ALTER TABLE site_public_prestation ADD COLUMN IF NOT EXISTS slug varchar(120) NOT NULL DEFAULT '';",
            reverse_sql="ALTER TABLE site_public_prestation DROP COLUMN IF EXISTS slug;",
        ),
        # Étape 2 : sync de l'état Django (le champ sans unique pour l'instant)
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=[
                migrations.AddField(
                    model_name='prestation',
                    name='slug',
                    field=models.SlugField(blank=True, max_length=120, unique=False),
                ),
            ],
        ),
        # Étape 3 : remplir les slugs
        migrations.RunPython(generer_slugs_prestations, migrations.RunPython.noop),
        # Étape 4 : ajouter la contrainte unique via SQL pour éviter l'index _like en double
        migrations.RunSQL(
            sql="ALTER TABLE site_public_prestation ADD CONSTRAINT site_public_prestation_slug_key UNIQUE (slug);",
            reverse_sql="ALTER TABLE site_public_prestation DROP CONSTRAINT IF EXISTS site_public_prestation_slug_key;",
        ),
        # Étape 5 : mettre à jour l'état Django pour refléter unique=True
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=[
                migrations.AlterField(
                    model_name='prestation',
                    name='slug',
                    field=models.SlugField(blank=True, help_text='Identifiant URL unique (généré automatiquement depuis le titre).', max_length=120, unique=True),
                ),
            ],
        ),

        # ── Modèle Actualite ────────────────────────────────────────────────
        migrations.CreateModel(
            name='Actualite',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('slug', models.SlugField(blank=True, max_length=150, unique=True)),
                ('titre', models.CharField(max_length=300)),
                ('extrait', models.CharField(blank=True, max_length=500, verbose_name='Extrait')),
                ('contenu', models.TextField(blank=True, verbose_name='Contenu complet')),
                ('image', models.ImageField(blank=True, null=True, upload_to='site_public/actualites/')),
                ('categorie', models.CharField(blank=True, max_length=100)),
                ('tags', models.JSONField(blank=True, default=list)),
                ('etat', models.CharField(choices=[('brouillon', 'Brouillon'), ('publie', 'Publié'), ('archive', 'Archivé')], default='brouillon', max_length=20)),
                ('date_publication', models.DateTimeField(blank=True, null=True)),
                ('date_creation', models.DateTimeField(auto_now_add=True)),
                ('date_modification', models.DateTimeField(auto_now=True)),
                ('auteur', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='actualites', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'Actualité',
                'verbose_name_plural': 'Actualités',
                'db_table': 'site_public_actualite',
                'ordering': ['-date_publication', '-date_creation'],
            },
        ),
    ]
