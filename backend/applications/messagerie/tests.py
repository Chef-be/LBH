from email import policy
from email.parser import BytesParser
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APIClient

from applications.messagerie.services import (
    _decoder_entete_mime,
    _decoder_liste_adresses,
    _extraire_corps,
    obtenir_configuration_imap,
    obtenir_configuration_smtp,
)
from applications.organisations.models import Organisation
from applications.parametres.models import Parametre
from applications.site_public.models import ConfigurationSite
from applications.supervision.models import ServeurMail


class MessagerieServicesTests(TestCase):
    def setUp(self):
        self.organisation = Organisation.objects.create(
            code="ORG-MAIL",
            nom="Organisation messagerie",
            type_organisation="bureau_etudes",
            est_active=True,
        )
        self.utilisateur = get_user_model().objects.create_user(
            courriel="messagerie-tests@example.com",
            password="secret-test-123",
            prenom="Mail",
            nom="Admin",
            organisation=self.organisation,
            est_staff=True,
            est_super_admin=True,
        )

    def test_resolution_smtp_reutilise_le_serveur_defaut(self):
        ServeurMail.objects.create(
            nom="Serveur principal",
            hote="smtp.exemple.fr",
            port=465,
            chiffrement="ssl_tls",
            utilisateur="plateforme@exemple.fr",
            mot_de_passe="secret",
            expediteur_defaut="plateforme@exemple.fr",
            est_actif=True,
            est_defaut=True,
            usage_envoi_plateforme=True,
            modifie_par=self.utilisateur,
        )

        configuration = obtenir_configuration_smtp(usage="plateforme")

        self.assertEqual(configuration.hote, "smtp.exemple.fr")
        self.assertEqual(configuration.port, 465)
        self.assertEqual(configuration.chiffrement, "ssl_tls")
        self.assertEqual(configuration.expediteur_defaut, "plateforme@exemple.fr")

    def test_resolution_imap_reutilise_les_champs_dedies(self):
        ServeurMail.objects.create(
            nom="Serveur messagerie",
            hote="smtp.exemple.fr",
            port=587,
            chiffrement="starttls",
            utilisateur="plateforme@exemple.fr",
            mot_de_passe="secret",
            imap_hote="imap.exemple.fr",
            imap_port=993,
            imap_chiffrement="ssl_tls",
            imap_utilisateur="boite@exemple.fr",
            imap_mot_de_passe="secret-imap",
            imap_dossier_envoyes="INBOX.Sent",
            imap_dossier_brouillons="INBOX.Drafts",
            imap_dossier_indesirables="INBOX.Spam",
            imap_dossier_corbeille="INBOX.Trash",
            est_actif=True,
            est_defaut=True,
            modifie_par=self.utilisateur,
        )

        configuration = obtenir_configuration_imap()

        self.assertEqual(configuration.hote, "imap.exemple.fr")
        self.assertEqual(configuration.utilisateur, "boite@exemple.fr")
        self.assertEqual(configuration.dossier_envoyes, "INBOX.Sent")
        self.assertEqual(configuration.dossier_indesirables, "INBOX.Spam")
        self.assertEqual(configuration.dossier_corbeille, "INBOX.Trash")

    def test_decode_liste_adresses_accepte_les_objets_address(self):
        adresses = _decoder_liste_adresses(
            [
                SimpleNamespace(name="Boinaheri Laheri", mailbox="boinaheri.laheri", host="laposte.net"),
                SimpleNamespace(name=b"Support", mailbox=b"support", host=b"example.com"),
            ]
        )

        self.assertEqual(
            adresses,
            [
                {"nom": "Boinaheri Laheri", "adresse": "boinaheri.laheri@laposte.net"},
                {"nom": "Support", "adresse": "support@example.com"},
            ],
        )

    def test_decode_entete_mime_decode_un_objet_utf8(self):
        sujet = "=?utf-8?Q?R=C3=A9union_de_chantier_=E2=80=94_Mise_=C3=A0_jour?="
        self.assertEqual(_decoder_entete_mime(sujet), "Réunion de chantier — Mise à jour")

    def test_extraire_corps_promeut_le_html_mal_etiquete(self):
        brut = (
            b"Subject: Test\r\n"
            b"Content-Type: text/plain; charset=utf-8\r\n"
            b"\r\n"
            b"<html><body><div><p>Bonjour <strong>Mayotte</strong></p></div></body></html>"
        )
        message = BytesParser(policy=policy.default).parsebytes(brut)

        corps = _extraire_corps(message)

        self.assertIn("<strong>Mayotte</strong>", corps["html"])
        self.assertEqual(corps["texte"], "Bonjour Mayotte")


class RoundcubeConfigurationApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.organisation = Organisation.objects.create(
            code="ORG-ROUND",
            nom="Organisation roundcube",
            type_organisation="bureau_etudes",
            est_active=True,
        )
        self.utilisateur = get_user_model().objects.create_user(
            courriel="roundcube-tests@example.com",
            password="secret-test-123",
            prenom="Round",
            nom="Cube",
            organisation=self.organisation,
            est_staff=True,
            est_super_admin=True,
        )
        ConfigurationSite.obtenir()
        configuration = ConfigurationSite.objects.get(pk=1)
        configuration.nom_bureau = "LBH Économiste"
        configuration.logo = "site_public/logo/logo-test.png"
        configuration.save(update_fields=["nom_bureau", "logo"])

        ServeurMail.objects.create(
            nom="Serveur principal",
            hote="mail.example.com",
            port=465,
            chiffrement="ssl_tls",
            utilisateur="smtp@example.com",
            mot_de_passe="secret",
            imap_hote="mail.example.com",
            imap_port=993,
            imap_chiffrement="ssl_tls",
            imap_dossier_envoyes="INBOX.Sent",
            imap_dossier_brouillons="INBOX.Drafts",
            imap_dossier_indesirables="INBOX.Spam",
            imap_dossier_corbeille="INBOX.Trash",
            est_actif=True,
            est_defaut=True,
            usage_envoi_plateforme=True,
            modifie_par=self.utilisateur,
        )
        Parametre.objects.update_or_create(
            cle="ROUNDCUBE_NOM_APPLICATION",
            defaults={
                "valeur": "Messagerie LBH",
                "valeur_par_defaut": "Messagerie LBH",
                "type_valeur": "texte",
                "libelle": "Nom Roundcube",
                "description": "Nom affiché",
                "module": "messagerie",
            },
        )
        Parametre.objects.update_or_create(
            cle="ROUNDCUBE_LOGO_LIEN",
            defaults={
                "valeur": "/roundcube/?_task=mail",
                "valeur_par_defaut": "/roundcube/?_task=mail",
                "type_valeur": "texte",
                "libelle": "Lien du logo Roundcube",
                "description": "Lien appliqué au logo affiché dans Roundcube.",
                "module": "messagerie",
            },
        )

    @override_settings(URL_BASE="https://lbh-economiste.com")
    def test_configuration_roundcube_est_publique_et_dynamique(self):
        reponse = self.client.get("/api/messagerie/roundcube/configuration/")

        self.assertEqual(reponse.status_code, status.HTTP_200_OK, reponse.data)
        self.assertEqual(reponse.data["product_name"], "Messagerie LBH")
        self.assertEqual(reponse.data["imap_host"], "ssl://mail.example.com:993")
        self.assertEqual(reponse.data["smtp_host"], "ssl://mail.example.com:465")
        self.assertEqual(reponse.data["junk_mbox"], "INBOX.Spam")
        self.assertEqual(reponse.data["trash_mbox"], "INBOX.Trash")
        self.assertEqual(
            reponse.data["logo_url"],
            "https://lbh-economiste.com/api/messagerie/roundcube/logo/",
        )
        self.assertEqual(
            reponse.data["logo_link"],
            "https://lbh-economiste.com/roundcube/?_task=mail",
        )
        self.assertEqual(
            reponse.data["blankpage_url"],
            "https://lbh-economiste.com/api/messagerie/roundcube/watermark/",
        )
        self.assertEqual(reponse["Cache-Control"], "no-store, no-cache, max-age=0, must-revalidate")

    @override_settings(URL_BASE="https://lbh-economiste.com")
    def test_watermark_roundcube_reference_le_logo_dynamique(self):
        reponse = self.client.get("/api/messagerie/roundcube/watermark/")

        self.assertEqual(reponse.status_code, status.HTTP_200_OK)
        contenu = reponse.content.decode("utf-8")
        self.assertIn("https://lbh-economiste.com/api/messagerie/roundcube/logo/", contenu)
        self.assertEqual(reponse["Cache-Control"], "no-store, no-cache, max-age=0, must-revalidate")

    @override_settings(URL_BASE="https://lbh-economiste.com")
    def test_logo_roundcube_sert_le_logo_du_site(self):
        with TemporaryDirectory() as tempdir:
            with self.settings(MEDIA_ROOT=tempdir):
                configuration = ConfigurationSite.objects.get(pk=1)
                configuration.logo = SimpleUploadedFile(
                    "logo-roundcube-test.png",
                    b"\x89PNG\r\n\x1a\ncontenu-test",
                    content_type="image/png",
                )
                configuration.save(update_fields=["logo"])

                reponse = self.client.get("/api/messagerie/roundcube/logo/")

                self.assertEqual(reponse.status_code, status.HTTP_200_OK)
                self.assertEqual(reponse["Content-Type"], "image/png")
                self.assertEqual(
                    b"".join(reponse.streaming_content),
                    b"\x89PNG\r\n\x1a\ncontenu-test",
                )
                self.assertEqual(
                    reponse["Cache-Control"],
                    "no-store, no-cache, max-age=0, must-revalidate",
                )

                chemin_logo = Path(tempdir) / configuration.logo.name
                self.assertTrue(chemin_logo.exists())
