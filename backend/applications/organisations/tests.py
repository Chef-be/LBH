import json
from unittest.mock import patch

from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from applications.comptes.models import Utilisateur
from applications.organisations.models import Organisation


class ApiOrganisationsTests(TestCase):
    def setUp(self):
        self.organisation = Organisation.objects.create(
            code="LBH",
            nom="LBH",
            type_organisation="bureau_etudes",
        )
        self.utilisateur = Utilisateur.objects.create_user(
            courriel="orga@example.com",
            password="motdepasse123",
            prenom="Jean",
            nom="Dupont",
            organisation=self.organisation,
            est_super_admin=True,
        )
        self.client = APIClient()
        self.client.force_authenticate(self.utilisateur)

    @patch("applications.organisations.views.urllib_request.urlopen")
    def test_recherche_entreprises_publiques_normalise_la_reponse(self, mock_urlopen):
        class FauxHTTP:
            def __enter__(self):
                return self

            def __exit__(self, exc_type, exc, tb):
                return False

            def read(self):
                return json.dumps(
                    {
                        "results": [
                            {
                                "siren": "123456789",
                                "nom_complet": "SOCIETE TEST",
                                "nom_raison_sociale": "SOCIETE TEST",
                                "sigle": "ST",
                                "siege": {
                                    "siret": "12345678900011",
                                    "numero_voie": "10",
                                    "type_voie": "RUE",
                                    "libelle_voie": "DE TEST",
                                    "code_postal": "97600",
                                    "libelle_commune": "MAMOUDZOU",
                                    "etat_administratif": "A",
                                },
                                "activite_principale": "7112B",
                                "categorie_entreprise": "PME",
                                "date_creation": "2020-01-01",
                                "etat_administratif": "A",
                                "nature_juridique": "Commune",
                                "tranche_effectif_salarie": "11 à 19 salariés",
                            }
                        ]
                    }
                ).encode("utf-8")

        mock_urlopen.return_value = FauxHTTP()
        reponse = self.client.get("/api/organisations/recherche-entreprises/?q=commune&type_organisation=maitre_ouvrage&limit=3")

        self.assertEqual(reponse.status_code, status.HTTP_200_OK, reponse.data)
        self.assertEqual(len(reponse.data["results"]), 1)
        resultat = reponse.data["results"][0]
        self.assertEqual(resultat["nom"], "SOCIETE TEST")
        self.assertEqual(resultat["siret"], "12345678900011")
        self.assertTrue(resultat["est_service_public"])
