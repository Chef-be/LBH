from unittest.mock import patch

from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from applications.comptes.models import Utilisateur
from applications.organisations.models import Organisation
from applications.site_public.models import ConfigurationSite, DemandeContact, Realisation


class SitePublicContactTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        configuration = ConfigurationSite.obtenir()
        configuration.courriel_contact = "contact@example.com"
        configuration.save(update_fields=["courriel_contact"])

    @patch("applications.site_public.views.envoyer_courriel")
    @patch("applications.site_public.views.obtenir_configuration_smtp")
    def test_soumission_contact_declenche_notifications(self, mock_obtenir_configuration, mock_envoyer_courriel):
        mock_obtenir_configuration.return_value = object()

        reponse = self.client.post(
            "/api/site/contact/",
            {
                "nom": "Jean Test",
                "courriel": "jean@example.com",
                "telephone": "0269000000",
                "organisation": "Commune test",
                "sujet": "information",
                "message": "Bonjour, je souhaite etre recontacte.",
            },
            format="json",
        )

        self.assertEqual(reponse.status_code, status.HTTP_201_CREATED, reponse.data)
        self.assertEqual(DemandeContact.objects.count(), 1)
        self.assertEqual(mock_envoyer_courriel.call_count, 2)


class SitePublicConfigurationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.organisation = Organisation.objects.create(
            code="ORG-SITE",
            nom="Organisation site public",
            type_organisation="bureau_etudes",
        )
        self.admin = Utilisateur.objects.create_user(
            courriel="admin-site@example.com",
            password="motdepasse123",
            prenom="Admin",
            nom="Site",
            organisation=self.organisation,
            est_staff=True,
            est_super_admin=True,
        )
        self.client.force_authenticate(self.admin)
        self.configuration = ConfigurationSite.obtenir()

    def test_patch_json_ignore_les_urls_media_existantes(self):
        reponse = self.client.patch(
            "/api/site/configuration/",
            {
                "nom_bureau": "LBH Economiste",
                "logo": "https://www.lbh-economiste.com/media/site_public/logo/logo-existant.png",
                "logo_pied_de_page": "https://www.lbh-economiste.com/media/site_public/logo/logo-pied.png",
                "favicon": "https://www.lbh-economiste.com/media/site_public/favicon/favicon.png",
            },
            format="json",
        )

        self.assertEqual(reponse.status_code, status.HTTP_200_OK, reponse.data)
        self.configuration.refresh_from_db()
        self.assertEqual(self.configuration.nom_bureau, "LBH Economiste")

    def test_configuration_masque_le_meta_titre_legacy(self):
        self.configuration.nom_bureau = "LBH Economiste"
        self.configuration.meta_titre = "LBH — Bureau d'Études Économiste"
        self.configuration.save(update_fields=["nom_bureau", "meta_titre"])

        self.client.force_authenticate(user=None)
        reponse = self.client.get("/api/site/configuration/")

        self.assertEqual(reponse.status_code, status.HTTP_200_OK, reponse.data)
        self.assertEqual(reponse.data["nom_bureau"], "LBH Economiste")
        self.assertEqual(reponse.data["meta_titre"], "")


class SitePublicRealisationsTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.realisation = Realisation.objects.create(
            titre="Réhabilitation groupe scolaire",
            description="<p>Mission complète de maîtrise d'œuvre économique.</p>",
            client="Commune test",
            lieu="Mamoudzou",
            annee=2026,
            tags=["Économie", "CCTP"],
            est_publie=True,
        )

    def test_detail_realisation_est_accessible_publiquement_si_publiee(self):
        reponse = self.client.get(f"/api/site/realisations/{self.realisation.id}/")

        self.assertEqual(reponse.status_code, status.HTTP_200_OK, reponse.data)
        self.assertEqual(reponse.data["titre"], self.realisation.titre)

    def test_detail_realisation_refuse_les_realisations_non_publiees_en_public(self):
        self.realisation.est_publie = False
        self.realisation.save(update_fields=["est_publie"])

        reponse = self.client.get(f"/api/site/realisations/{self.realisation.id}/")

        self.assertEqual(reponse.status_code, status.HTTP_404_NOT_FOUND, reponse.data)
