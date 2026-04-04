from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from applications.documents.models import DossierDocumentProjet, Document, TypeDocument
from applications.comptes.models import Utilisateur
from applications.organisations.models import Organisation
from applications.projets.models import Projet


class ApiProjetsTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.organisation = Organisation.objects.create(
            code="ORG-PROJ",
            nom="Organisation projets",
            type_organisation="bureau_etudes",
        )
        self.admin = Utilisateur.objects.create_user(
            courriel="admin-projets@example.com",
            password="motdepasse123",
            prenom="Admin",
            nom="Projets",
            organisation=self.organisation,
            est_staff=True,
            est_super_admin=True,
        )
        self.client.force_authenticate(self.admin)
        self.projet = Projet.objects.create(
            reference="2026-0099",
            intitule="Projet à supprimer",
            organisation=self.organisation,
            responsable=self.admin,
            clientele_cible="moe_conception",
            objectif_mission="redaction_dce_cctp",
        )
        TypeDocument.objects.create(code="AUTRE", libelle="Autre document", ordre_affichage=99)
        TypeDocument.objects.create(code="PLAN", libelle="Plan", ordre_affichage=10)

    def test_super_admin_peut_supprimer_physiquement_un_projet(self):
        reponse = self.client.delete(f"/api/projets/{self.projet.id}/")

        self.assertEqual(reponse.status_code, status.HTTP_200_OK, reponse.data)
        self.assertFalse(Projet.objects.filter(pk=self.projet.pk).exists())

    def test_orientation_projet_retourne_les_methodes_selon_la_clientele(self):
        reponse = self.client.get(
            "/api/projets/orientation/",
            {
                "clientele_cible": "moa_publique",
                "objectif_mission": "verifier_enveloppe",
                "type_projet": "assistance",
            },
        )

        self.assertEqual(reponse.status_code, status.HTTP_200_OK, reponse.data)
        self.assertEqual(reponse.data["clientele"]["code"], "moa_publique")
        self.assertEqual(reponse.data["methodes_estimation"][0]["code"], "ratio")
        self.assertTrue(reponse.data["wizard"]["etapes"])
        self.assertTrue(reponse.data["dossiers_ged"])
        self.assertTrue(reponse.data["assistants_generation_documentaire"])
        self.assertTrue(reponse.data["controle_documentaire"]["pieces_attendues"])
        self.assertIn("Guide de la maîtrise d'œuvre travaux, avril 2020", reponse.data["sources_methodologiques"])

    def test_creation_projet_initialise_les_dossiers_ged_et_le_wizard(self):
        reponse = self.client.post(
            "/api/projets/",
            {
                "reference": "2026-0120",
                "intitule": "Projet wizard GED",
                "type_projet": "mission_moe",
                "clientele_cible": "moe_conception",
                "objectif_mission": "redaction_dce_cctp",
                "statut": "en_cours",
                "organisation": str(self.organisation.id),
                "qualification_wizard": {
                    "niveau_definition": "apd_pro",
                    "pieces_a_rediger": ["cctp", "dpgf"],
                },
            },
            format="json",
        )

        self.assertEqual(reponse.status_code, status.HTTP_201_CREATED, reponse.data)
        projet = Projet.objects.get(pk=reponse.data["id"])
        self.assertEqual(projet.qualification_wizard["niveau_definition"], "apd_pro")
        self.assertTrue(DossierDocumentProjet.objects.filter(projet=projet).exists())
        self.assertTrue(
            DossierDocumentProjet.objects.filter(
                projet=projet,
                code="pieces-ecrites-dce",
            ).exists()
        )
        self.assertTrue(
            DossierDocumentProjet.objects.filter(
                projet=projet,
                code="cctp-lot",
            ).exists()
        )

    def test_qualification_documentaire_projet_detecte_presence_et_absence_des_pieces(self):
        type_autre = TypeDocument.objects.get(code="AUTRE")
        type_plan = TypeDocument.objects.get(code="PLAN")

        Document.objects.create(
            reference="DOC-CCTP-01",
            intitule="Descriptif lot gros oeuvre",
            type_document=type_autre,
            projet=self.projet,
            auteur=self.admin,
            contenu_texte="Cahier des clauses techniques particulières - mise en oeuvre et descriptif détaillé.",
            analyse_automatique_effectuee=True,
            analyse_automatique={
                "classification": {
                    "type_document": {"code": "CCTP", "libelle": "CCTP", "score": 12},
                }
            },
        )
        Document.objects.create(
            reference="DOC-PLAN-01",
            intitule="Plans architecte",
            type_document=type_plan,
            projet=self.projet,
            auteur=self.admin,
            contenu_texte="Plan de niveau et coupe de principe.",
            analyse_automatique_effectuee=True,
        )

        reponse = self.client.get(f"/api/projets/{self.projet.id}/qualification-documentaire/")

        self.assertEqual(reponse.status_code, status.HTTP_200_OK, reponse.data)
        self.assertEqual(reponse.data["synthese"]["documents_total"], 2)
        self.assertGreaterEqual(reponse.data["synthese"]["pieces_manquantes"], 1)
        pieces = {piece["code"]: piece for piece in reponse.data["pieces"]}
        self.assertTrue(pieces["prescriptions_techniques"]["presence"])
        self.assertTrue(pieces["plans_conception"]["presence"])
        self.assertFalse(pieces["cadres_prix"]["presence"])
