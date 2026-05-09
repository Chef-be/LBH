from unittest.mock import Mock, patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APIClient

from applications.parametres.models import ConfigurationIAFonctionnelle, TraitementIA


class AdministrationTraitementsMetierTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = get_user_model().objects.create_user(
            courriel="admin-traitements@example.com",
            password="secret-test-123",
            prenom="Admin",
            nom="Traitements",
            est_staff=True,
            est_super_admin=True,
        )
        self.utilisateur = get_user_model().objects.create_user(
            courriel="lecture-traitements@example.com",
            password="secret-test-123",
            prenom="Lecture",
            nom="Traitements",
        )
        self.client.force_authenticate(self.admin)

    def creer_configuration(self, **champs):
        valeurs = {
            "code": "TEST_TRAITEMENTS",
            "libelle": "Configuration de test",
            "module": "bibliotheque_cctp",
            "fournisseur": "openai",
            "modele": "",
            "mode_reel_autorise": True,
            "mode_simulation_autorise": True,
            "prompt_systeme": "Prompt système de test",
            "prompt_controle": "Contrôle les données.",
            "schema_sortie": {"titre": "", "description_technique": ""},
        }
        valeurs.update(champs)
        return ConfigurationIAFonctionnelle.objects.create(**valeurs)

    @override_settings(OPENAI_API_KEY="", CLE_API_OPENAI="")
    def test_liste_modeles_erreur_propre_si_cle_absente(self):
        reponse = self.client.get("/api/administration/ia/modeles-disponibles/")

        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(reponse.data["modeles"], [])
        self.assertIn("Aucune clé fournisseur", reponse.data["detail"])
        self.assertNotIn("secret-test", str(reponse.data))

    @override_settings(OPENAI_API_KEY="cle-serveur-test")
    @patch("applications.parametres.services_ia_metier.requests.get")
    def test_liste_modeles_fournisseur_mocke(self, mock_get):
        reponse_fournisseur = Mock()
        reponse_fournisseur.raise_for_status.return_value = None
        reponse_fournisseur.json.return_value = {
            "data": [
                {"id": "modele-b", "owned_by": "fournisseur"},
                {"id": "modele-a", "owned_by": "fournisseur"},
            ]
        }
        mock_get.return_value = reponse_fournisseur

        reponse = self.client.get("/api/administration/ia/modeles-disponibles/")

        self.assertEqual(reponse.status_code, status.HTTP_200_OK)
        self.assertEqual([modele["id"] for modele in reponse.data["modeles"]], ["modele-a", "modele-b"])
        self.assertNotIn("cle-serveur-test", str(reponse.data))

    def test_configuration_ne_force_pas_de_modele_par_defaut(self):
        reponse = self.client.post(
            "/api/administration/ia/configurations/",
            {
                "code": "SANS_MODELE",
                "libelle": "Sans modèle imposé",
                "module": "ressources_devis",
                "fournisseur": "openai",
                "modele": "",
            },
            format="json",
        )

        self.assertEqual(reponse.status_code, status.HTTP_201_CREATED, reponse.data)
        self.assertEqual(reponse.data["modele"], "")
        modele_interdit = "gpt-" + "5.1"
        self.assertNotEqual(reponse.data["modele"], modele_interdit)

    @override_settings(OPENAI_API_KEY="", CLE_API_OPENAI="")
    def test_test_simulation_journalise(self):
        configuration = self.creer_configuration(mode_reel_autorise=False)

        reponse = self.client.post(
            f"/api/administration/ia/configurations/{configuration.id}/tester/",
            {"mode": "simulation", "prompt_test": "Contrôle rapide"},
            format="json",
        )

        self.assertEqual(reponse.status_code, status.HTTP_200_OK, reponse.data)
        traitement = TraitementIA.objects.get(id=reponse.data["traitement"]["id"])
        self.assertEqual(traitement.mode_execution, "simulation")
        self.assertEqual(traitement.statut, "simulation")
        self.assertEqual(traitement.utilisateur, self.admin)

    @override_settings(OPENAI_API_KEY="cle-serveur-test")
    @patch("applications.parametres.services_ia_metier._appeler_openai")
    def test_test_reel_appelle_service_mocke(self, mock_appeler):
        configuration = self.creer_configuration(modele="modele-test", mode_reel_autorise=True)
        mock_appeler.return_value = {
            "output_text": '{"resultat":"ok","score_confiance":0.91}',
            "usage": {"input_tokens": 12, "output_tokens": 8},
        }

        reponse = self.client.post(
            f"/api/administration/ia/configurations/{configuration.id}/tester/",
            {"mode": "reel", "prompt_test": "Contrôle réel"},
            format="json",
        )

        self.assertEqual(reponse.status_code, status.HTTP_200_OK, reponse.data)
        self.assertTrue(mock_appeler.called)
        traitement = TraitementIA.objects.get(id=reponse.data["traitement"]["id"])
        self.assertEqual(traitement.mode_execution, "reel")
        self.assertEqual(traitement.statut, "termine")
        self.assertEqual(traitement.tokens_entree, 12)
        self.assertEqual(traitement.sortie["resultat"], "ok")

    def test_acces_reserve_super_admin(self):
        self.client.force_authenticate(self.utilisateur)

        reponse = self.client.get("/api/administration/ia/configurations/")

        self.assertEqual(reponse.status_code, status.HTTP_403_FORBIDDEN)
