from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from applications.comptes.models import InvitationUtilisateur, JetonReinitialisationMotDePasse, ProfilDroit
from applications.organisations.models import Organisation


class ComptesInvitationEtReinitialisationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.organisation = Organisation.objects.create(
            code="ORG-COMPTES",
            nom="Organisation comptes",
            type_organisation="bureau_etudes",
            est_active=True,
        )
        self.profil = ProfilDroit.objects.create(
            code="ECONOMISTE_JR",
            libelle="Économiste junior",
            est_actif=True,
            ordre_affichage=10,
        )
        self.admin = get_user_model().objects.create_user(
            courriel="superadmin@example.com",
            password="secret-test-123",
            prenom="Super",
            nom="Admin",
            organisation=self.organisation,
            est_staff=True,
            est_super_admin=True,
        )
        self.client.force_authenticate(self.admin)

    @patch("applications.comptes.views.envoyer_courriel")
    def test_creation_utilisateur_envoie_invitation(self, mock_envoyer_courriel):
        mock_envoyer_courriel.return_value = {"message_id": "<invitation@test>", "expediteur": "noreply@example.com", "destinataires": ["invite@example.com"]}

        reponse = self.client.post(
            "/api/auth/utilisateurs/",
            {
                "courriel": "invite@example.com",
                "prenom": "Marie",
                "nom": "Dupont",
                "profil": self.profil.id,
            },
            format="json",
        )

        self.assertEqual(reponse.status_code, status.HTTP_201_CREATED, reponse.data)
        utilisateur = get_user_model().objects.get(courriel="invite@example.com")
        self.assertFalse(utilisateur.est_actif)
        self.assertTrue(InvitationUtilisateur.objects.filter(utilisateur=utilisateur).exists())

    def test_activation_invitation_active_le_compte(self):
        utilisateur = get_user_model().objects.create_user(
            courriel="activation@example.com",
            password=None,
            prenom="Jean",
            nom="Martin",
            organisation=self.organisation,
            profil=self.profil,
            est_actif=False,
        )
        utilisateur.set_unusable_password()
        utilisateur.save(update_fields=["password"])
        invitation = InvitationUtilisateur.objects.create(
            utilisateur=utilisateur,
            courriel=utilisateur.courriel,
            token="token-activation",
            cree_par=self.admin,
            expire_le=timezone.now() + timedelta(days=7),
        )

        self.client.force_authenticate(user=None)
        reponse = self.client.post(
            "/api/auth/invitations/token-activation/activer/",
            {
                "mot_de_passe": "mot-de-passe-tres-solide",
                "mot_de_passe_confirmation": "mot-de-passe-tres-solide",
            },
            format="json",
        )

        self.assertEqual(reponse.status_code, status.HTTP_200_OK, reponse.data)
        utilisateur.refresh_from_db()
        invitation.refresh_from_db()
        self.assertTrue(utilisateur.est_actif)
        self.assertIsNotNone(utilisateur.courriel_verifie_le)
        self.assertIsNotNone(invitation.utilise_le)

    @patch("applications.comptes.views.envoyer_courriel")
    def test_demande_reinitialisation_genere_un_jeton(self, mock_envoyer_courriel):
        mock_envoyer_courriel.return_value = {"message_id": "<reset@test>", "expediteur": "noreply@example.com", "destinataires": ["reset@example.com"]}
        utilisateur = get_user_model().objects.create_user(
            courriel="reset@example.com",
            password="secret-test-123",
            prenom="Reset",
            nom="User",
            organisation=self.organisation,
            est_actif=True,
        )

        self.client.force_authenticate(user=None)
        reponse = self.client.post(
            "/api/auth/mot-de-passe-oublie/",
            {"courriel": utilisateur.courriel},
            format="json",
        )

        self.assertEqual(reponse.status_code, status.HTTP_200_OK, reponse.data)
        self.assertTrue(JetonReinitialisationMotDePasse.objects.filter(utilisateur=utilisateur).exists())
