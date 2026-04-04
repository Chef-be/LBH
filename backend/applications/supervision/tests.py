from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from applications.organisations.models import Organisation
from applications.supervision.models import ServeurMail


class SupervisionApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        utilisateur_model = get_user_model()

        self.organisation = Organisation.objects.create(
            code="ORG-TEST-SUP",
            nom="Organisation supervision",
            type_organisation="bureau_etudes",
            est_active=True,
        )
        self.utilisateur = utilisateur_model.objects.create_user(
            courriel="supervision-tests@example.com",
            password="secret-test-123",
            prenom="Super",
            nom="Admin",
            organisation=self.organisation,
            est_staff=True,
            est_super_admin=True,
        )
        self.client.force_authenticate(self.utilisateur)

    def test_tableau_bord_supervision_repond_meme_sans_socket_docker(self):
        reponse = self.client.get("/api/supervision/")

        self.assertEqual(reponse.status_code, status.HTTP_200_OK, reponse.data)
        self.assertIn("serveur", reponse.data)
        self.assertIn("historique_serveur", reponse.data)
        self.assertIn("services", reponse.data)
        self.assertIn("conteneurs", reponse.data)
        self.assertIn("meta", reponse.data)

    def test_creation_serveur_mail_bascule_le_defaut(self):
        premier = self.client.post(
            "/api/supervision/serveurs-mail/",
            {
                "nom": "SMTP principal",
                "hote": "smtp-1.example.com",
                "port": 587,
                "chiffrement": "starttls",
                "utilisateur": "noreply@example.com",
                "mot_de_passe": "secret-1",
                "est_actif": True,
                "est_defaut": True,
                "usage_envoi_plateforme": True,
                "usage_notifications": True,
            },
            format="json",
        )
        self.assertEqual(premier.status_code, status.HTTP_201_CREATED, premier.data)

        second = self.client.post(
            "/api/supervision/serveurs-mail/",
            {
                "nom": "SMTP secondaire",
                "hote": "smtp-2.example.com",
                "port": 465,
                "chiffrement": "ssl_tls",
                "utilisateur": "notifications@example.com",
                "mot_de_passe": "secret-2",
                "est_actif": True,
                "est_defaut": True,
                "usage_envoi_plateforme": False,
                "usage_notifications": True,
            },
            format="json",
        )
        self.assertEqual(second.status_code, status.HTTP_201_CREATED, second.data)

        premier_objet = ServeurMail.objects.get(pk=premier.data["id"])
        second_objet = ServeurMail.objects.get(pk=second.data["id"])
        self.assertFalse(premier_objet.est_defaut)
        self.assertTrue(second_objet.est_defaut)

    def test_desactivation_du_serveur_defaut_promeut_un_autre_serveur_actif(self):
        principal = ServeurMail.objects.create(
            nom="SMTP principal",
            hote="smtp-1.example.com",
            port=587,
            chiffrement="starttls",
            utilisateur="principal@example.com",
            mot_de_passe="secret-1",
            est_actif=True,
            est_defaut=True,
            modifie_par=self.utilisateur,
        )
        secondaire = ServeurMail.objects.create(
            nom="SMTP secondaire",
            hote="smtp-2.example.com",
            port=465,
            chiffrement="ssl_tls",
            utilisateur="secondaire@example.com",
            mot_de_passe="secret-2",
            est_actif=True,
            est_defaut=False,
            modifie_par=self.utilisateur,
        )

        reponse = self.client.patch(
            f"/api/supervision/serveurs-mail/{principal.id}/",
            {"est_actif": False},
            format="json",
        )

        self.assertEqual(reponse.status_code, status.HTTP_200_OK, reponse.data)
        principal.refresh_from_db()
        secondaire.refresh_from_db()
        self.assertFalse(principal.est_actif)
        self.assertFalse(principal.est_defaut)
        self.assertTrue(secondaire.est_defaut)

    @patch("applications.supervision.views.tester_configuration_smtp")
    def test_test_smtp_retourne_la_latence(self, mock_testeur):
        serveur = ServeurMail.objects.create(
            nom="SMTP test",
            hote="smtp.example.com",
            port=587,
            chiffrement="starttls",
            utilisateur="technique@example.com",
            mot_de_passe="secret",
            est_actif=True,
            est_defaut=True,
            modifie_par=self.utilisateur,
        )
        mock_testeur.return_value = type(
            "Resultat",
            (),
            {"succes": True, "detail": "Connexion SMTP réussie.", "latence_ms": 187},
        )()

        reponse = self.client.post(f"/api/supervision/serveurs-mail/{serveur.id}/tester/", {}, format="json")

        self.assertEqual(reponse.status_code, status.HTTP_200_OK, reponse.data)
        self.assertEqual(reponse.data["latence_ms"], 187)
        self.assertTrue(reponse.data["succes"])
