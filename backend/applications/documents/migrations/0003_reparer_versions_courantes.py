from django.db import migrations


def reparer_versions_courantes(apps, schema_editor):
    """
    Corrige les documents créés via multipart avec est_version_courante=False.
    Si aucune version courante n'existe pour un couple (projet, référence),
    la version non archivée la plus récente redevient courante.
    """

    Document = apps.get_model("documents", "Document")

    documents = Document.objects.exclude(statut="archive").order_by(
        "projet_id",
        "reference",
        "date_creation",
        "pk",
    )

    cle_courante = None
    groupe = []

    def traiter_groupe(documents_groupe):
        if not documents_groupe:
            return
        if any(document.est_version_courante for document in documents_groupe):
            return

        document_courant = documents_groupe[-1]
        Document.objects.filter(pk=document_courant.pk).update(est_version_courante=True)

    for document in documents.iterator():
        cle = (document.projet_id, document.reference)
        if cle != cle_courante:
            traiter_groupe(groupe)
            groupe = [document]
            cle_courante = cle
            continue
        groupe.append(document)

    traiter_groupe(groupe)


class Migration(migrations.Migration):

    dependencies = [
        ("documents", "0002_document_analyse_automatique"),
    ]

    operations = [
        migrations.RunPython(reparer_versions_courantes, migrations.RunPython.noop),
    ]
