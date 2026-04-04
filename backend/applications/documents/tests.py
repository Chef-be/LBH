import io
import zipfile
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.test.utils import override_settings
from rest_framework import status
from rest_framework.test import APIClient

from applications.comptes.models import Utilisateur
from applications.bibliotheque.models import LignePrixBibliotheque
from applications.documents.models import DossierDocumentProjet, Document, TypeDocument
from applications.documents.services import (
    appliquer_suggestions_document,
    inferer_projet_initial,
    importer_archive_documents,
    previsualiser_suggestions_document,
    suggerer_type_document,
)
from applications.organisations.models import Organisation
from applications.projets.models import Projet


class ServicesDocumentsTests(TestCase):
    def setUp(self):
        self.organisation = Organisation.objects.create(
            code="LBH",
            nom="LBH",
            type_organisation="bureau_etudes",
        )
        self.responsable = Utilisateur.objects.create_user(
            courriel="responsable@example.com",
            password="motdepasse123",
            prenom="Jean",
            nom="Dupont",
            organisation=self.organisation,
        )
        self.projet = Projet.objects.create(
            reference="2026-0001",
            intitule="Réhabilitation de la mairie de Mamoudzou",
            organisation=self.organisation,
            responsable=self.responsable,
            commune="Mamoudzou",
        )
        self.autre_projet = Projet.objects.create(
            reference="2026-0009",
            intitule="Extension du groupe scolaire",
            organisation=self.organisation,
            responsable=self.responsable,
            commune="Koungou",
        )
        TypeDocument.objects.create(code="AUTRE", libelle="Autre document", ordre_affichage=99)
        TypeDocument.objects.create(code="NOTE_CALCUL", libelle="Note de calcul", ordre_affichage=2)
        TypeDocument.objects.create(code="BPU", libelle="Bordereau des prix unitaires", ordre_affichage=10)

    def test_suggere_type_document_depuis_nom_et_texte(self):
        suggestion = suggerer_type_document(
            nom_fichier="note_de_calcul_fondations.pdf",
            texte="Cette note de calcul présente le dimensionnement et les hypothèses de charge.",
            type_mime="application/pdf",
        )

        self.assertIsNotNone(suggestion)
        self.assertEqual(suggestion["code"], "NOTE_CALCUL")

    def test_inferer_projet_initial_depuis_reference(self):
        projet = inferer_projet_initial(
            reference="DOC-2026-0001-NC-01",
            intitule="Note de calcul mairie",
            nom_fichier="2026-0001-note-calcul.pdf",
        )

        self.assertIsNotNone(projet)
        self.assertEqual(projet.pk, self.projet.pk)

    def test_appliquer_suggestions_document(self):
        type_autre = TypeDocument.objects.get(code="AUTRE")
        document = Document.objects.create(
            reference="DOC-01",
            intitule="Document test",
            type_document=type_autre,
            projet=self.autre_projet,
            auteur=self.responsable,
            analyse_automatique={
                "classification": {
                    "type_document": {"code": "NOTE_CALCUL", "libelle": "Note de calcul", "score": 14}
                },
                "suggestions": {
                    "projet": {
                        "id": str(self.projet.id),
                        "reference": self.projet.reference,
                        "intitule": self.projet.intitule,
                        "score": 12,
                    }
                },
            },
        )

        changements = appliquer_suggestions_document(document)
        document.refresh_from_db()

        self.assertEqual(document.type_document.code, "NOTE_CALCUL")
        self.assertEqual(document.projet_id, self.projet.id)
        self.assertIn("type_document", changements)
        self.assertIn("projet", changements)

    def test_previsualiser_suggestions_document(self):
        type_autre = TypeDocument.objects.get(code="AUTRE")
        document = Document.objects.create(
            reference="DOC-02",
            intitule="Document test",
            type_document=type_autre,
            projet=self.autre_projet,
            auteur=self.responsable,
            analyse_automatique={
                "classification": {
                    "type_document": {"code": "NOTE_CALCUL", "libelle": "Note de calcul", "score": 14}
                },
                "suggestions": {
                    "projet": {
                        "id": str(self.projet.id),
                        "reference": self.projet.reference,
                        "intitule": self.projet.intitule,
                        "score": 12,
                    }
                },
            },
        )

        apercu = previsualiser_suggestions_document(document)

        self.assertEqual(apercu["reference"], "DOC-02")
        self.assertEqual(len(apercu["changements"]), 2)

    @patch("applications.documents.services.analyser_document_automatiquement")
    def test_import_archive_documents_cree_des_documents_versionnes(self, mock_analyse):
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w") as archive:
            archive.writestr("2026-0001-note-calcul-fondations.pdf", b"%PDF-1.4 test")
            archive.writestr("2026-0001-note-calcul-fondations-v2.pdf", b"%PDF-1.4 test 2")

        resultat = importer_archive_documents(
            contenu_archive=buffer.getvalue(),
            nom_archive="documents.zip",
            utilisateur=self.responsable,
            projet_defaut=self.projet,
        )

        self.assertEqual(resultat["importes"], 2)
        self.assertEqual(Document.objects.filter(projet=self.projet).count(), 2)
        self.assertEqual(mock_analyse.call_count, 2)

    @patch("applications.documents.services.analyser_document_automatiquement")
    def test_import_archive_documents_classe_les_fichiers_dans_la_ged_projet(self, mock_analyse):
        def faux_classement(document, forcer=False):
            document.type_document = TypeDocument.objects.get(code="BPU")
            document.analyse_automatique_effectuee = True
            document.save(update_fields=["type_document", "analyse_automatique_effectuee"])
            return {}

        mock_analyse.side_effect = faux_classement
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w") as archive:
            archive.writestr("2026-0001-bpu-vrd.xlsx", b"contenu")

        resultat = importer_archive_documents(
            contenu_archive=buffer.getvalue(),
            nom_archive="documents.zip",
            utilisateur=self.responsable,
            projet_defaut=self.projet,
        )

        self.assertEqual(resultat["importes"], 1)
        document = Document.objects.get(projet=self.projet, reference="2026-0001-BPU-VRD")
        self.assertIsNotNone(document.dossier)
        self.assertEqual(document.dossier.code, "bordereaux-prix")


@override_settings(ALLOWED_HOSTS=["testserver", "lbh-economiste.com", "localhost"])
class ApiDocumentsTests(TestCase):
    def setUp(self):
        self.organisation = Organisation.objects.create(
            code="LBH",
            nom="LBH",
            type_organisation="bureau_etudes",
        )
        self.utilisateur = Utilisateur.objects.create_user(
            courriel="admin@example.com",
            password="motdepasse123",
            prenom="Jean",
            nom="Dupont",
            organisation=self.organisation,
        )
        self.projet = Projet.objects.create(
            reference="2026-0001",
            intitule="Réhabilitation de la mairie de Mamoudzou",
            organisation=self.organisation,
            responsable=self.utilisateur,
            commune="Mamoudzou",
        )
        TypeDocument.objects.create(code="AUTRE", libelle="Autre document", ordre_affichage=99)
        self.client = APIClient(HTTP_HOST="lbh-economiste.com")
        self.client.force_authenticate(user=self.utilisateur)

    @patch("applications.documents.views.analyser_document_automatiquement")
    def test_creation_document_utilise_le_projet_unique_par_defaut(self, mock_analyse):
        fichier = SimpleUploadedFile(
            "test.pdf",
            b"%PDF-1.4 test",
            content_type="application/pdf",
        )

        reponse = self.client.post(
            "/api/documents/",
            {
                "fichier": fichier,
                "intitule": "Document test",
                "reference": "DOC-TEST-001",
            },
            format="multipart",
        )

        self.assertEqual(reponse.status_code, 201)
        document = Document.objects.get(reference="DOC-TEST-001")
        self.assertEqual(document.projet_id, self.projet.id)
        self.assertTrue(document.est_version_courante)
        mock_analyse.assert_called_once()

    @patch("applications.documents.services.analyser_document_automatiquement")
    def test_import_archive_utilise_le_projet_unique_par_defaut(self, mock_analyse):
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w") as archive:
            archive.writestr("note-calcul.pdf", b"%PDF-1.4 test")

        fichier = SimpleUploadedFile(
            "documents.zip",
            buffer.getvalue(),
            content_type="application/zip",
        )

        reponse = self.client.post(
            "/api/documents/importer-archive/",
            {"fichier": fichier},
            format="multipart",
        )

        self.assertEqual(reponse.status_code, 201)
        self.assertEqual(reponse.data["importes"], 1)
        document = Document.objects.get(reference="NOTE-CALCUL")
        self.assertEqual(document.projet_id, self.projet.id)
        mock_analyse.assert_called_once()

    def test_super_admin_peut_supprimer_physiquement_un_document(self):
        self.utilisateur.est_super_admin = True
        self.utilisateur.save(update_fields=["est_super_admin"])

        type_autre = TypeDocument.objects.get(code="AUTRE")
        document = Document.objects.create(
            reference="DOC-SUPPR-001",
            intitule="Document à supprimer",
            type_document=type_autre,
            projet=self.projet,
            auteur=self.utilisateur,
        )

        reponse = self.client.delete(f"/api/documents/{document.id}/")

        self.assertEqual(reponse.status_code, status.HTTP_200_OK, reponse.data)
        self.assertFalse(Document.objects.filter(pk=document.pk).exists())

    def test_import_document_bibliotheque_depuis_fiche_document(self):
        type_bpu = TypeDocument.objects.create(code="BPU", libelle="Bordereau des prix unitaires", ordre_affichage=10)
        document = Document.objects.create(
            reference="DOC-BPU-TEST",
            intitule="BPU test",
            type_document=type_bpu,
            projet=self.projet,
            auteur=self.utilisateur,
            contenu_texte=(
                "LOT 01 VRD\n"
                "1.1 Décapage de terre végétale m2 25,00 4,20 105,00\n"
                "1.2 Réglage de forme m2 25,00 3,60 90,00\n"
            ),
            analyse_automatique_effectuee=True,
        )

        reponse = self.client.post(f"/api/documents/{document.id}/importer-bibliotheque/", {})

        self.assertEqual(reponse.status_code, status.HTTP_200_OK, reponse.data)
        self.assertEqual(reponse.data["lignes"], 2)
        self.assertEqual(LignePrixBibliotheque.objects.filter(projet=self.projet).count(), 2)

    def test_liste_dossiers_documents_projet_retourne_larborescence_systeme(self):
        reponse = self.client.get("/api/documents/dossiers/", {"projet": str(self.projet.id)})

        self.assertEqual(reponse.status_code, status.HTTP_200_OK, reponse.data)
        resultats = reponse.data["results"] if isinstance(reponse.data, dict) and "results" in reponse.data else reponse.data
        codes = {item["code"] for item in resultats}
        self.assertIn("qualification-mission", codes)
        self.assertIn("estimations-economie", codes)
        self.assertIn("cctp-lot", codes)

    @patch("applications.documents.views.analyser_document_automatiquement")
    def test_creation_document_accepte_un_dossier_projet(self, mock_analyse):
        dossier = DossierDocumentProjet.objects.create(
            projet=self.projet,
            code="test-dossier",
            intitule="Test dossier",
            ordre=1,
        )
        type_autre = TypeDocument.objects.get(code="AUTRE")
        fichier = SimpleUploadedFile(
            "test.pdf",
            b"%PDF-1.4 test",
            content_type="application/pdf",
        )

        reponse = self.client.post(
            "/api/documents/",
            {
                "fichier": fichier,
                "intitule": "Document avec dossier",
                "reference": "DOC-DOSSIER-001",
                "type_document": str(type_autre.id),
                "projet": str(self.projet.id),
                "dossier": str(dossier.id),
            },
            format="multipart",
        )

        self.assertEqual(reponse.status_code, status.HTTP_201_CREATED, reponse.data)
        document = Document.objects.get(reference="DOC-DOSSIER-001")
        self.assertEqual(document.dossier_id, dossier.id)

    @patch("applications.documents.views.analyser_document_automatiquement")
    def test_creation_document_classe_automatiquement_dans_un_sous_dossier(self, mock_analyse):
        type_bpu, _ = TypeDocument.objects.get_or_create(
            code="BPU",
            defaults={"libelle": "BPU — Bordereau des Prix Unitaires"},
        )
        fichier = SimpleUploadedFile(
            "bpu-test.pdf",
            b"%PDF-1.4 test",
            content_type="application/pdf",
        )

        reponse = self.client.post(
            "/api/documents/",
            {
                "fichier": fichier,
                "intitule": "BPU de consultation",
                "reference": "DOC-BPU-001",
                "type_document": str(type_bpu.id),
                "projet": str(self.projet.id),
            },
            format="multipart",
        )

        self.assertEqual(reponse.status_code, status.HTTP_201_CREATED, reponse.data)
        document = Document.objects.get(reference="DOC-BPU-001")
        self.assertIsNotNone(document.dossier)
        self.assertEqual(document.dossier.code, "bordereaux-prix")
