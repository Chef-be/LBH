"""
Migration : restructuration LotCCTP — remplacement du champ `numero` (avec choices)
par un champ `code` libre (max_length=20).

Étapes :
1. Ajout de la colonne `code` temporaire (nullable)
2. Renseignement des 18 codes métier depuis les valeurs existantes de `numero`
3. Suppression de la colonne `numero`
4. Mise en place des contraintes (unique, db_index) sur `code`
5. Mise à jour de l'ordering
"""

from django.db import migrations, models


CODES_PAR_NUMERO = {
    "7.1":  "VRD",
    "7.2":  "TERR",
    "7.3":  "GO",
    "7.4":  "FAC",
    "7.5":  "MRC",
    "7.6":  "MOB",
    "7.7":  "CHMET",
    "7.8":  "CHCZ",
    "7.9":  "ETAN",
    "7.10": "MENUEXT",
    "7.11": "MENUINT",
    "7.12": "IPP",
    "7.13": "RSC",
    "7.14": "ELEC",
    "7.15": "PLB",
    "7.16": "CVC",
    "7.17": "ASC",
    "7.18": "PAY",
}


def migrer_numero_vers_code(apps, schema_editor):
    """Convertit les valeurs existantes de `numero` en codes métier dans `code`."""
    LotCCTP = apps.get_model("pieces_ecrites", "LotCCTP")
    for lot in LotCCTP.objects.all():
        lot.code = CODES_PAR_NUMERO.get(lot.numero, lot.numero)
        lot.save(update_fields=["code"])


def retablir_code_vers_numero(apps, schema_editor):
    """Opération inverse : recopie `code` dans `numero` (restauration approximative)."""
    codes_inverses = {v: k for k, v in CODES_PAR_NUMERO.items()}
    LotCCTP = apps.get_model("pieces_ecrites", "LotCCTP")
    for lot in LotCCTP.objects.all():
        lot.numero = codes_inverses.get(lot.code, lot.code[:10])
        lot.save(update_fields=["numero"])


class Migration(migrations.Migration):

    dependencies = [
        ("pieces_ecrites", "0008_prescriptions_cctp"),
    ]

    operations = [
        # 1. Ajout de la colonne code (nullable dans un premier temps)
        migrations.AddField(
            model_name="lotcctp",
            name="code",
            field=models.CharField(
                max_length=20,
                null=True,
                blank=True,
                verbose_name="Code lot",
            ),
        ),

        # 2. Renseignement des codes depuis les numéros existants
        migrations.RunPython(migrer_numero_vers_code, retablir_code_vers_numero),

        # 3. Rendre le champ code obligatoire et unique avec index
        migrations.AlterField(
            model_name="lotcctp",
            name="code",
            field=models.CharField(
                max_length=20,
                unique=True,
                db_index=True,
                verbose_name="Code lot",
            ),
        ),

        # 4. Suppression de l'ancienne colonne numero
        migrations.RemoveField(
            model_name="lotcctp",
            name="numero",
        ),

        # 5. Mise à jour de l'ordering
        migrations.AlterModelOptions(
            name="lotcctp",
            options={
                "ordering": ["ordre", "code"],
                "verbose_name": "Lot CCTP",
                "verbose_name_plural": "Lots CCTP",
            },
        ),
    ]
