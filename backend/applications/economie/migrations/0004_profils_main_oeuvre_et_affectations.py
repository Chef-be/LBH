from django.db import migrations, models
import django.db.models.deletion
import uuid
import decimal


def creer_profils_defaut(apps, schema_editor):
    ProfilMainOeuvre = apps.get_model("economie", "ProfilMainOeuvre")
    profils = [
        {
            "code": "OUVRIER_STANDARD",
            "libelle": "Ouvrier standard",
            "categorie": "ouvrier",
            "salaire_brut_mensuel_defaut": decimal.Decimal("1850.00"),
            "taux_charges_patronales": decimal.Decimal("0.38"),
            "taux_frais_agence": decimal.Decimal("0.10"),
            "cout_equipement_mensuel": decimal.Decimal("90.00"),
            "cout_transport_mensuel": decimal.Decimal("70.00"),
            "ordre_affichage": 10,
        },
        {
            "code": "TECHNICIEN_ETUDES",
            "libelle": "Technicien études",
            "categorie": "technicien",
            "salaire_brut_mensuel_defaut": decimal.Decimal("2500.00"),
            "taux_charges_patronales": decimal.Decimal("0.42"),
            "taux_frais_agence": decimal.Decimal("0.12"),
            "cout_structure_mensuel": decimal.Decimal("320.00"),
            "ordre_affichage": 20,
        },
        {
            "code": "INGENIEUR_PROJET",
            "libelle": "Ingénieur projet",
            "categorie": "ingenieur",
            "salaire_brut_mensuel_defaut": decimal.Decimal("3800.00"),
            "taux_charges_patronales": decimal.Decimal("0.45"),
            "taux_frais_agence": decimal.Decimal("0.14"),
            "cout_structure_mensuel": decimal.Decimal("420.00"),
            "ordre_affichage": 30,
        },
        {
            "code": "ECONOMISTE_LBH",
            "libelle": "Économiste de la construction",
            "categorie": "economiste",
            "salaire_brut_mensuel_defaut": decimal.Decimal("3200.00"),
            "taux_charges_patronales": decimal.Decimal("0.44"),
            "taux_frais_agence": decimal.Decimal("0.13"),
            "cout_structure_mensuel": decimal.Decimal("380.00"),
            "ordre_affichage": 40,
        },
    ]
    for profil in profils:
        ProfilMainOeuvre.objects.update_or_create(code=profil["code"], defaults=profil)


class Migration(migrations.Migration):

    dependencies = [
        ("economie", "0003_rename_eco_ep_statut_millesime_idx_economie_et_statut_90433d_idx_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="ProfilMainOeuvre",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("code", models.CharField(max_length=50, unique=True, verbose_name="Code profil")),
                ("libelle", models.CharField(max_length=200, verbose_name="Libellé")),
                ("categorie", models.CharField(choices=[("ouvrier", "Ouvrier"), ("compagnon", "Compagnon qualifié"), ("technicien", "Technicien"), ("conducteur", "Conducteur de travaux"), ("ingenieur", "Ingénieur"), ("economiste", "Économiste"), ("redacteur", "Rédacteur technique"), ("administratif", "Administratif"), ("autre", "Autre profil")], default="ouvrier", max_length=30)),
                ("localisation", models.CharField(choices=[("metropole", "Métropole"), ("mayotte", "Mayotte"), ("dom", "Autre DOM")], default="metropole", max_length=20)),
                ("salaire_brut_mensuel_defaut", models.DecimalField(decimal_places=2, default=2200, max_digits=10)),
                ("primes_mensuelles_defaut", models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ("avantages_mensuels_defaut", models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ("heures_contractuelles_mensuelles", models.DecimalField(decimal_places=2, default=decimal.Decimal("151.67"), max_digits=8)),
                ("heures_par_jour", models.DecimalField(decimal_places=2, default=decimal.Decimal("7.00"), max_digits=5)),
                ("taux_charges_salariales", models.DecimalField(decimal_places=4, default=decimal.Decimal("0.2200"), max_digits=6)),
                ("taux_charges_patronales", models.DecimalField(decimal_places=4, default=decimal.Decimal("0.4200"), max_digits=6)),
                ("taux_absenteisme", models.DecimalField(decimal_places=4, default=decimal.Decimal("0.0300"), max_digits=6)),
                ("taux_temps_improductif", models.DecimalField(decimal_places=4, default=decimal.Decimal("0.1200"), max_digits=6)),
                ("taux_frais_agence", models.DecimalField(decimal_places=4, default=decimal.Decimal("0.1200"), max_digits=6)),
                ("taux_risque_operationnel", models.DecimalField(decimal_places=4, default=decimal.Decimal("0.0200"), max_digits=6)),
                ("taux_marge_cible", models.DecimalField(decimal_places=4, default=decimal.Decimal("0.0800"), max_digits=6)),
                ("cout_equipement_mensuel", models.DecimalField(decimal_places=2, default=80, max_digits=10)),
                ("cout_transport_mensuel", models.DecimalField(decimal_places=2, default=50, max_digits=10)),
                ("cout_structure_mensuel", models.DecimalField(decimal_places=2, default=250, max_digits=10)),
                ("est_actif", models.BooleanField(default=True)),
                ("ordre_affichage", models.PositiveSmallIntegerField(default=100)),
                ("date_creation", models.DateTimeField(auto_now_add=True)),
                ("date_modification", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "Profil de main-d'œuvre",
                "verbose_name_plural": "Profils de main-d'œuvre",
                "db_table": "economie_profil_main_oeuvre",
                "ordering": ["ordre_affichage", "libelle"],
            },
        ),
        migrations.CreateModel(
            name="AffectationProfilProjet",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("clientele", models.CharField(choices=[("particulier_pme", "Particulier / petite PME"), ("public", "Maître d'ouvrage public"), ("cotraitrance", "Co-traitance"), ("sous_traitance", "Sous-traitance"), ("autre", "Autre contexte")], default="public", max_length=20)),
                ("mode_facturation", models.CharField(choices=[("horaire", "Taux horaire"), ("journalier", "Taux journalier")], default="journalier", max_length=20)),
                ("charge_previsionnelle_jours", models.DecimalField(decimal_places=2, default=0, max_digits=8)),
                ("coefficient_k", models.DecimalField(decimal_places=4, default=0, max_digits=8)),
                ("taux_horaire_recommande", models.DecimalField(decimal_places=4, default=0, max_digits=10)),
                ("taux_journalier_recommande", models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ("dernier_calcul", models.JSONField(blank=True, default=dict)),
                ("observations", models.TextField(blank=True)),
                ("date_creation", models.DateTimeField(auto_now_add=True)),
                ("date_modification", models.DateTimeField(auto_now=True)),
                ("profil", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="affectations_projets", to="economie.profilmainoeuvre")),
                ("projet", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="affectations_profils_main_oeuvre", to="projets.projet")),
            ],
            options={
                "verbose_name": "Affectation profil projet",
                "verbose_name_plural": "Affectations profils projets",
                "db_table": "economie_affectation_profil_projet",
                "ordering": ["-date_modification"],
                "unique_together": {("projet", "profil", "clientele")},
            },
        ),
        migrations.RunPython(creer_profils_defaut, migrations.RunPython.noop),
    ]
