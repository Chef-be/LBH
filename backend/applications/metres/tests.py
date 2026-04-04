from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from applications.organisations.models import Organisation
from applications.projets.models import Projet
from applications.metres.models import LigneMetre, Metre


class MetresCalculTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        utilisateur_model = get_user_model()

        self.organisation = Organisation.objects.create(
            code="ORG-METRES",
            nom="Organisation métrés",
            type_organisation="bureau_etudes",
            est_active=True,
        )
        self.utilisateur = utilisateur_model.objects.create_user(
            courriel="metres@example.com",
            password="secret-test-123",
            prenom="Jean",
            nom="Métreur",
            organisation=self.organisation,
            est_staff=True,
        )
        self.client.force_authenticate(self.utilisateur)

        self.projet = Projet.objects.create(
            intitule="Projet métrés",
            type_projet="autre",
            type_projet_autre="Métrés",
            statut="en_cours",
            phase_actuelle="ao",
            organisation=self.organisation,
            maitre_ouvrage=self.organisation,
            responsable=self.utilisateur,
            cree_par=self.utilisateur,
        )
        self.metre = Metre.objects.create(
            projet=self.projet,
            intitule="Avant-métré principal",
            cree_par=self.utilisateur,
        )

    def test_apercu_calcul_metre_accepte_variables_et_lignes(self):
        reponse = self.client.post(
            "/api/metres/apercu-calcul/",
            {
                "detail_calcul": "L = 5,2\nl = 3,4\nL * l\n2 * 1,5",
            },
            format="json",
        )

        self.assertEqual(reponse.status_code, status.HTTP_200_OK, reponse.data)
        self.assertEqual(reponse.data["quantite_calculee"], 20.68)
        self.assertEqual(reponse.data["variables"]["L"], 5.2)
        self.assertEqual(reponse.data["variables"]["l"], 3.4)
        self.assertEqual(len(reponse.data["etapes"]), 4)

    def test_creation_ligne_metre_reprend_quantite_depuis_detail_calcul(self):
        reponse = self.client.post(
            f"/api/metres/{self.metre.id}/lignes/",
            {
                "numero_ordre": 1,
                "designation": "Murs périphériques",
                "nature": "travaux",
                "detail_calcul": "L = 5\nH = 2.8\n2 * (L + 3) * H",
                "unite": "m2",
                "prix_unitaire_ht": "42.50",
            },
            format="json",
        )

        self.assertEqual(reponse.status_code, status.HTTP_201_CREATED, reponse.data)
        ligne = LigneMetre.objects.get(pk=reponse.data["id"])
        self.assertEqual(float(ligne.quantite), 44.8)
        self.assertEqual(reponse.data["quantite_calculee"], 44.8)
        self.assertEqual(reponse.data["montant_ht"], 1904.0)
