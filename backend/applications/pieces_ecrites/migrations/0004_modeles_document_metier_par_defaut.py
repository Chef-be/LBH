from django.db import migrations


def creer_modeles_metier_par_defaut(apps, schema_editor):
    ModeleDocument = apps.get_model("pieces_ecrites", "ModeleDocument")

    modeles = [
        {
            "code": "CCTP_STANDARD",
            "libelle": "CCTP standard",
            "type_document": "cctp",
            "description": "Base de CCTP structurée par contexte de projet, prescriptions générales et postes significatifs.",
            "variables_fusion": [
                {"nom": "piece_intitule", "description": "Intitulé de la pièce"},
                {"nom": "reference_projet", "description": "Référence du projet"},
                {"nom": "nom_projet", "description": "Nom du projet"},
                {"nom": "lot_intitule", "description": "Intitulé du lot"},
            ],
        },
        {
            "code": "LETTRE_CANDIDATURE_STANDARD",
            "libelle": "Lettre de candidature",
            "type_document": "lettre_candidature",
            "description": "Lettre de candidature adaptée à une consultation publique ou privée.",
            "variables_fusion": [
                {"nom": "piece_intitule", "description": "Intitulé de la lettre"},
                {"nom": "reference_projet", "description": "Référence du projet"},
                {"nom": "nom_projet", "description": "Nom du projet"},
                {"nom": "maitre_ouvrage", "description": "Maître d'ouvrage"},
            ],
        },
        {
            "code": "MEMOIRE_TECHNIQUE_STANDARD",
            "libelle": "Mémoire technique",
            "type_document": "memoire_technique",
            "description": "Mémoire technique orienté compréhension du besoin, méthodologie, moyens et engagements.",
            "variables_fusion": [
                {"nom": "piece_intitule", "description": "Intitulé du mémoire"},
                {"nom": "reference_projet", "description": "Référence du projet"},
                {"nom": "nom_projet", "description": "Nom du projet"},
                {"nom": "maitre_ouvrage", "description": "Maître d'ouvrage"},
            ],
        },
        {
            "code": "PLANNING_TACHES_DPGF",
            "libelle": "Planning de tâches depuis DPGF",
            "type_document": "planning_taches",
            "description": "Planning prévisionnel déduit des lignes DPGF / étude économique et des temps de main-d'œuvre.",
            "variables_fusion": [
                {"nom": "piece_intitule", "description": "Intitulé du planning"},
                {"nom": "reference_projet", "description": "Référence du projet"},
                {"nom": "nom_projet", "description": "Nom du projet"},
            ],
        },
        {
            "code": "RAPPORT_ANALYSE_STANDARD",
            "libelle": "Rapport d'analyse",
            "type_document": "rapport_analyse",
            "description": "Rapport d'analyse des documents, coûts, risques et points d'attention du projet.",
            "variables_fusion": [
                {"nom": "piece_intitule", "description": "Intitulé du rapport"},
                {"nom": "reference_projet", "description": "Référence du projet"},
                {"nom": "nom_projet", "description": "Nom du projet"},
            ],
        },
    ]

    for modele in modeles:
        ModeleDocument.objects.update_or_create(code=modele["code"], defaults=modele)


class Migration(migrations.Migration):

    dependencies = [
        ("pieces_ecrites", "0003_modeledocument_contenu_modele_html"),
    ]

    operations = [
        migrations.RunPython(creer_modeles_metier_par_defaut, migrations.RunPython.noop),
    ]
