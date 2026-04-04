from django.db import migrations


PARAMETRES_ROUNDCUBE = [
    (
        "ROUNDCUBE_NOM_APPLICATION",
        "Messagerie",
        "texte",
        "messagerie",
        "Nom affiché dans l'interface Roundcube.",
    ),
    (
        "ROUNDCUBE_LANGUE",
        "fr_FR",
        "texte",
        "messagerie",
        "Langue d'interface Roundcube (ex. fr_FR).",
    ),
    (
        "ROUNDCUBE_TACHE_DEFAUT",
        "mail",
        "texte",
        "messagerie",
        "Tâche ouverte par défaut dans la messagerie intégrée (mail, settings, addressbook).",
    ),
    (
        "ROUNDCUBE_LOGO_LIEN",
        "/roundcube/?_task=mail",
        "texte",
        "messagerie",
        "Lien appliqué au logo affiché dans Roundcube.",
    ),
    (
        "ROUNDCUBE_URL_AIDE",
        "",
        "texte",
        "messagerie",
        "URL d'assistance ou de documentation affichée dans Roundcube.",
    ),
]


def ajouter_parametres_roundcube(apps, schema_editor):
    Parametre = apps.get_model("parametres", "Parametre")
    for cle, valeur, type_valeur, module, description in PARAMETRES_ROUNDCUBE:
        Parametre.objects.get_or_create(
            cle=cle,
            defaults={
                "valeur": valeur,
                "valeur_par_defaut": valeur,
                "type_valeur": type_valeur,
                "libelle": cle.replace("_", " ").title(),
                "description": description,
                "module": module,
                "est_verrouille": False,
            },
        )


def supprimer_parametres_roundcube(apps, schema_editor):
    Parametre = apps.get_model("parametres", "Parametre")
    Parametre.objects.filter(cle__in=[cle for cle, *_ in PARAMETRES_ROUNDCUBE]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("parametres", "0002_fonctionnaliteactivable_module"),
    ]

    operations = [
        migrations.RunPython(ajouter_parametres_roundcube, supprimer_parametres_roundcube),
    ]
