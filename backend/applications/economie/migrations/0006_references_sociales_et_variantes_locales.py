from django.db import migrations, models
import django.db.models.deletion
import decimal
import uuid


def initialiser_references_et_variantes(apps, schema_editor):
    ReferenceSocialeLocalisation = apps.get_model("economie", "ReferenceSocialeLocalisation")
    RegleConventionnelleProfil = apps.get_model("economie", "RegleConventionnelleProfil")
    VarianteLocaleRegleConventionnelle = apps.get_model("economie", "VarianteLocaleRegleConventionnelle")

    references = [
        {
            "code": "SOCIAL_METROPOLE",
            "libelle": "Référentiel social Métropole",
            "localisation": "metropole",
            "smic_horaire": decimal.Decimal("12.02"),
            "heures_legales_mensuelles": decimal.Decimal("151.67"),
            "commentaire_reglementaire": (
                "Référentiel générique métropole. À compléter selon les accords d'entreprise, la mutuelle,"
                " les exonérations spécifiques ou les conventions collectives réellement appliquées."
            ),
            "source_officielle": "https://code.travail.gouv.fr/fiche-service-public/reduction-generale-des-cotisations-patronales-ex-reduction-fillon",
            "est_active": True,
        },
        {
            "code": "SOCIAL_DOM",
            "libelle": "Référentiel social Autres DOM",
            "localisation": "dom",
            "smic_horaire": decimal.Decimal("12.02"),
            "heures_legales_mensuelles": decimal.Decimal("151.67"),
            "commentaire_reglementaire": (
                "Référentiel générique DOM hors Mayotte. Les régimes dérogatoires type Lodeom ou dispositifs locaux"
                " doivent être ajustés dans les variantes territoriales."
            ),
            "source_officielle": "https://code.travail.gouv.fr/fiche-service-public/reduction-generale-des-cotisations-patronales-ex-reduction-fillon",
            "est_active": True,
        },
        {
            "code": "SOCIAL_MAYOTTE",
            "libelle": "Référentiel social Mayotte",
            "localisation": "mayotte",
            "smic_horaire": decimal.Decimal("9.33"),
            "heures_legales_mensuelles": decimal.Decimal("151.67"),
            "commentaire_reglementaire": (
                "Mayotte dispose d'un Smic distinct et peut relever de dispositifs spécifiques. Le CICE Mayotte,"
                " les suspensions ou aides exceptionnelles éventuelles et les charges réelles restent à paramétrer"
                " au cas par cas."
            ),
            "source_officielle": "https://entreprendre.service-public.fr/vosdroits/F31326",
            "est_active": True,
        },
    ]

    for reference in references:
        ReferenceSocialeLocalisation.objects.update_or_create(
            code=reference["code"],
            defaults=reference,
        )

    for code_regle in ("TECH_NON_CADRE", "INGE_CADRE", "REDACTEUR_NON_CADRE"):
        try:
            regle = RegleConventionnelleProfil.objects.get(code=code_regle)
        except RegleConventionnelleProfil.DoesNotExist:
            continue

        VarianteLocaleRegleConventionnelle.objects.update_or_create(
            regle=regle,
            localisation="mayotte",
            defaults={
                "libelle": f"{regle.libelle} — Mayotte",
                "source_officielle": "https://entreprendre.service-public.fr/vosdroits/F31326",
                "observations": (
                    "Variante prête à être affinée pour Mayotte. Les paramètres chiffrés restent volontairement"
                    " éditables afin d'éviter de figer des hypothèses locales sans validation métier."
                ),
                "est_active": True,
            },
        )


class Migration(migrations.Migration):

    dependencies = [
        ("economie", "0005_conventions_collectives_et_regles"),
    ]

    operations = [
        migrations.CreateModel(
            name="ReferenceSocialeLocalisation",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("code", models.CharField(max_length=50, unique=True, verbose_name="Code référentiel")),
                ("libelle", models.CharField(max_length=255, verbose_name="Libellé")),
                ("localisation", models.CharField(choices=[("nationale", "Nationale"), ("metropole", "Métropole"), ("mayotte", "Mayotte"), ("dom", "Autre DOM")], max_length=20, unique=True)),
                ("smic_horaire", models.DecimalField(decimal_places=2, default=0, max_digits=8, verbose_name="Smic horaire brut")),
                ("heures_legales_mensuelles", models.DecimalField(decimal_places=2, default=decimal.Decimal("151.67"), max_digits=8, verbose_name="Heures légales mensuelles")),
                ("commentaire_reglementaire", models.TextField(blank=True)),
                ("source_officielle", models.URLField(blank=True, verbose_name="Source officielle")),
                ("est_active", models.BooleanField(default=True)),
                ("date_creation", models.DateTimeField(auto_now_add=True)),
                ("date_modification", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "Référentiel social par localisation",
                "verbose_name_plural": "Référentiels sociaux par localisation",
                "db_table": "economie_reference_sociale_localisation",
                "ordering": ["localisation", "libelle"],
            },
        ),
        migrations.CreateModel(
            name="VarianteLocaleRegleConventionnelle",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("localisation", models.CharField(choices=[("nationale", "Nationale"), ("metropole", "Métropole"), ("mayotte", "Mayotte"), ("dom", "Autre DOM")], default="metropole", max_length=20)),
                ("libelle", models.CharField(blank=True, max_length=255, verbose_name="Libellé localisé")),
                ("salaire_brut_minimum_mensuel", models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True)),
                ("heures_contractuelles_mensuelles_defaut", models.DecimalField(blank=True, decimal_places=2, max_digits=8, null=True)),
                ("heures_par_jour_defaut", models.DecimalField(blank=True, decimal_places=2, max_digits=5, null=True)),
                ("taux_charges_salariales_defaut", models.DecimalField(blank=True, decimal_places=4, max_digits=6, null=True)),
                ("taux_charges_patronales_defaut", models.DecimalField(blank=True, decimal_places=4, max_digits=6, null=True)),
                ("mutuelle_employeur_mensuelle_defaut", models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True)),
                ("titres_restaurant_employeur_mensuels_defaut", models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True)),
                ("prime_transport_mensuelle_defaut", models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True)),
                ("taux_absenteisme_defaut", models.DecimalField(blank=True, decimal_places=4, max_digits=6, null=True)),
                ("taux_temps_improductif_defaut", models.DecimalField(blank=True, decimal_places=4, max_digits=6, null=True)),
                ("taux_occupation_facturable_defaut", models.DecimalField(blank=True, decimal_places=4, max_digits=6, null=True)),
                ("cout_recrutement_initial_defaut", models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True)),
                ("source_officielle", models.URLField(blank=True, verbose_name="Source officielle")),
                ("observations", models.TextField(blank=True)),
                ("est_active", models.BooleanField(default=True)),
                ("date_creation", models.DateTimeField(auto_now_add=True)),
                ("date_modification", models.DateTimeField(auto_now=True)),
                ("regle", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="variantes_locales", to="economie.regleconventionnelleprofil")),
            ],
            options={
                "verbose_name": "Variante locale de règle conventionnelle",
                "verbose_name_plural": "Variantes locales de règles conventionnelles",
                "db_table": "economie_variante_locale_regle_conventionnelle",
                "ordering": ["regle", "localisation"],
                "unique_together": {("regle", "localisation")},
            },
        ),
        migrations.RunPython(initialiser_references_et_variantes, migrations.RunPython.noop),
    ]
