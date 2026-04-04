from django.db import migrations, models
import django.db.models.deletion
import decimal
import uuid


def creer_convention_et_regles(apps, schema_editor):
    ConventionCollective = apps.get_model("economie", "ConventionCollective")
    RegleConventionnelleProfil = apps.get_model("economie", "RegleConventionnelleProfil")
    ProfilMainOeuvre = apps.get_model("economie", "ProfilMainOeuvre")

    convention, _ = ConventionCollective.objects.update_or_create(
        code="BETIC_SYNTEC",
        defaults={
            "libelle": "Bureaux d’études techniques, cabinets d’ingénieurs-conseils et sociétés de conseils",
            "idcc": "1486",
            "localisation": "nationale",
            "contingent_heures_supp_non_cadre": 220,
            "contingent_heures_supp_cadre": 220,
            "source_officielle": "https://code.travail.gouv.fr/contribution/1486-comment-determiner-lanciennete-du-salarie",
            "observations": "Convention de référence paramétrable pour un bureau d’études. Les minima et règles restent ajustables depuis l’interface.",
            "est_active": True,
        },
    )

    regles = [
        {
            "code": "TECH_NON_CADRE",
            "libelle": "Technicien études non cadre",
            "categorie": "technicien",
            "statut_cadre": False,
            "niveau_classification": "Technicien / ETAM",
            "salaire_brut_minimum_mensuel": decimal.Decimal("2200.00"),
            "mutuelle_employeur_mensuelle_defaut": decimal.Decimal("55.00"),
            "taux_absenteisme_defaut": decimal.Decimal("0.0300"),
            "taux_temps_improductif_defaut": decimal.Decimal("0.1100"),
            "cout_recrutement_initial_defaut": decimal.Decimal("1800.00"),
            "ordre_affichage": 10,
        },
        {
            "code": "INGE_CADRE",
            "libelle": "Ingénieur / économiste cadre",
            "categorie": "ingenieur",
            "statut_cadre": True,
            "niveau_classification": "Cadre ingénierie",
            "salaire_brut_minimum_mensuel": decimal.Decimal("3200.00"),
            "mutuelle_employeur_mensuelle_defaut": decimal.Decimal("65.00"),
            "taux_absenteisme_defaut": decimal.Decimal("0.0250"),
            "taux_temps_improductif_defaut": decimal.Decimal("0.1500"),
            "cout_recrutement_initial_defaut": decimal.Decimal("3500.00"),
            "ordre_affichage": 20,
        },
        {
            "code": "REDACTEUR_NON_CADRE",
            "libelle": "Rédacteur technique non cadre",
            "categorie": "redacteur",
            "statut_cadre": False,
            "niveau_classification": "Rédaction technique",
            "salaire_brut_minimum_mensuel": decimal.Decimal("2100.00"),
            "mutuelle_employeur_mensuelle_defaut": decimal.Decimal("55.00"),
            "taux_absenteisme_defaut": decimal.Decimal("0.0300"),
            "taux_temps_improductif_defaut": decimal.Decimal("0.1200"),
            "cout_recrutement_initial_defaut": decimal.Decimal("1500.00"),
            "ordre_affichage": 30,
        },
    ]

    regles_creees = {}
    for regle in regles:
        regle_obj, _ = RegleConventionnelleProfil.objects.update_or_create(
            convention=convention,
            code=regle["code"],
            defaults=regle,
        )
        regles_creees[regle["code"]] = regle_obj

    correspondances = {
        "TECHNICIEN_ETUDES": "TECH_NON_CADRE",
        "INGENIEUR_PROJET": "INGE_CADRE",
        "ECONOMISTE_LBH": "INGE_CADRE",
    }

    for code_profil, code_regle in correspondances.items():
        try:
            profil = ProfilMainOeuvre.objects.get(code=code_profil)
        except ProfilMainOeuvre.DoesNotExist:
            continue
        profil.convention_collective = convention
        profil.regle_conventionnelle = regles_creees[code_regle]
        profil.save(update_fields=["convention_collective", "regle_conventionnelle"])


class Migration(migrations.Migration):

    dependencies = [
        ("economie", "0004_profils_main_oeuvre_et_affectations"),
    ]

    operations = [
        migrations.CreateModel(
            name="ConventionCollective",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("code", models.CharField(max_length=50, unique=True, verbose_name="Code convention")),
                ("libelle", models.CharField(max_length=255, verbose_name="Libellé")),
                ("idcc", models.CharField(blank=True, max_length=20, verbose_name="IDCC")),
                ("localisation", models.CharField(choices=[("nationale", "Nationale"), ("metropole", "Métropole"), ("mayotte", "Mayotte"), ("dom", "Autre DOM")], default="nationale", max_length=20)),
                ("contingent_heures_supp_non_cadre", models.PositiveSmallIntegerField(default=220)),
                ("contingent_heures_supp_cadre", models.PositiveSmallIntegerField(default=220)),
                ("source_officielle", models.URLField(blank=True, verbose_name="Source officielle")),
                ("observations", models.TextField(blank=True)),
                ("est_active", models.BooleanField(default=True)),
                ("date_creation", models.DateTimeField(auto_now_add=True)),
                ("date_modification", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "Convention collective",
                "verbose_name_plural": "Conventions collectives",
                "db_table": "economie_convention_collective",
                "ordering": ["libelle"],
            },
        ),
        migrations.CreateModel(
            name="RegleConventionnelleProfil",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("code", models.CharField(max_length=50, verbose_name="Code règle")),
                ("libelle", models.CharField(max_length=255, verbose_name="Libellé")),
                ("categorie", models.CharField(choices=[("ouvrier", "Ouvrier"), ("compagnon", "Compagnon qualifié"), ("technicien", "Technicien"), ("conducteur", "Conducteur de travaux"), ("ingenieur", "Ingénieur"), ("economiste", "Économiste"), ("redacteur", "Rédacteur technique"), ("administratif", "Administratif"), ("autre", "Autre profil")], default="technicien", max_length=30)),
                ("statut_cadre", models.BooleanField(default=False)),
                ("niveau_classification", models.CharField(blank=True, max_length=100, verbose_name="Niveau / position")),
                ("salaire_brut_minimum_mensuel", models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ("heures_contractuelles_mensuelles_defaut", models.DecimalField(decimal_places=2, default=decimal.Decimal("151.67"), max_digits=8)),
                ("heures_par_jour_defaut", models.DecimalField(decimal_places=2, default=decimal.Decimal("7.00"), max_digits=5)),
                ("mutuelle_employeur_mensuelle_defaut", models.DecimalField(decimal_places=2, default=55, max_digits=10)),
                ("titres_restaurant_employeur_mensuels_defaut", models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ("prime_transport_mensuelle_defaut", models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ("taux_absenteisme_defaut", models.DecimalField(decimal_places=4, default=decimal.Decimal("0.0300"), max_digits=6)),
                ("taux_temps_improductif_defaut", models.DecimalField(decimal_places=4, default=decimal.Decimal("0.1200"), max_digits=6)),
                ("cout_recrutement_initial_defaut", models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ("observations", models.TextField(blank=True)),
                ("ordre_affichage", models.PositiveSmallIntegerField(default=100)),
                ("est_active", models.BooleanField(default=True)),
                ("date_creation", models.DateTimeField(auto_now_add=True)),
                ("date_modification", models.DateTimeField(auto_now=True)),
                ("convention", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="regles_profils", to="economie.conventioncollective")),
            ],
            options={
                "verbose_name": "Règle conventionnelle de profil",
                "verbose_name_plural": "Règles conventionnelles de profils",
                "db_table": "economie_regle_conventionnelle_profil",
                "ordering": ["convention", "ordre_affichage", "libelle"],
                "unique_together": {("convention", "code")},
            },
        ),
        migrations.AddField(
            model_name="profilmainoeuvre",
            name="convention_collective",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="profils_main_oeuvre", to="economie.conventioncollective"),
        ),
        migrations.AddField(
            model_name="profilmainoeuvre",
            name="regle_conventionnelle",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="profils_main_oeuvre", to="economie.regleconventionnelleprofil"),
        ),
        migrations.RunPython(creer_convention_et_regles, migrations.RunPython.noop),
    ]
