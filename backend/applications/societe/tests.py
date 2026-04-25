from datetime import timedelta
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient, APIRequestFactory, force_authenticate

from applications.comptes.models import Utilisateur
from applications.organisations.models import Organisation
from applications.projets.models import LivrableType, MissionClient, Projet, AffectationProjet
from applications.site_public.models import ConfigurationSite
from .models import DevisHonoraires, LigneDevis, ProfilHoraire, ProfilHoraireUtilisateur, TempsPasse
from .views import DevisHonorairesViewSet


class ApiSocieteTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.factory = APIRequestFactory()
        self.organisation = Organisation.objects.create(
            code="ORG-SOCIETE",
            nom="Organisation société",
            type_organisation="bureau_etudes",
        )
        self.utilisateur = Utilisateur.objects.create_user(
            courriel="societe@example.com",
            password="motdepasse123",
            prenom="Ada",
            nom="Lovlace",
            organisation=self.organisation,
            est_staff=True,
            est_super_admin=True,
        )
        self.client.force_authenticate(self.utilisateur)
        ConfigurationSite.obtenir()

        self.profil = ProfilHoraire.objects.create(
            code="CHEF",
            libelle="Chef de projet",
            taux_horaire_ht="95.00",
        )
        self.mission = MissionClient.objects.create(
            code="cctp-dpgf",
            libelle="CCTP / DPGF",
            famille_client="maitrise_oeuvre",
            nature_ouvrage="batiment",
            phases_concernees=["dce"],
        )
        self.livrable = LivrableType.objects.create(
            code="cctp-lot",
            libelle="CCTP par lot",
            type_document="cctp",
            format_attendu="docx",
        )
        self.livrable.missions.add(self.mission)

    def _creer_devis(self, **kwargs):
        devis = DevisHonoraires.objects.create(
            reference=kwargs.pop("reference", "DVZ-2026-001"),
            intitule=kwargs.pop("intitule", "Mission économiste"),
            statut=kwargs.pop("statut", "brouillon"),
            famille_client=kwargs.pop("famille_client", "maitrise_oeuvre"),
            sous_type_client=kwargs.pop("sous_type_client", "architecte"),
            contexte_contractuel=kwargs.pop("contexte_contractuel", "mission_complete"),
            nature_ouvrage=kwargs.pop("nature_ouvrage", "batiment"),
            nature_marche=kwargs.pop("nature_marche", "prive"),
            role_lbh=kwargs.pop("role_lbh", "economiste"),
            contexte_projet_saisie=kwargs.pop("contexte_projet_saisie", {
                "famille_client": "maitrise_oeuvre",
                "sous_type_client": "architecte",
                "contexte_contractuel": "mission_complete",
                "mission_principale": "cctp-dpgf",
                "missions_associees": ["cctp-dpgf"],
                "livrables_selectionnes": ["cctp-lot"],
                "phase_intervention": "",
                "nature_ouvrage": "batiment",
                "nature_marche": "prive",
                "role_lbh": "economiste",
                "methode_estimation": "",
                "donnees_entree": {},
            }),
            missions_selectionnees=kwargs.pop("missions_selectionnees", [
                {
                    "missionCode": "cctp-dpgf",
                    "missionLabel": "CCTP / DPGF",
                    "livrablesCodes": ["cctp-lot"],
                    "livrablesLabels": ["CCTP par lot"],
                }
            ]),
            client_nom=kwargs.pop("client_nom", "Client test"),
            client_contact=kwargs.pop("client_contact", "Mme Test"),
            client_email=kwargs.pop("client_email", "client@example.com"),
            date_validite=kwargs.pop("date_validite", timezone.localdate() + timedelta(days=15)),
            cree_par=self.utilisateur,
            **kwargs,
        )
        LigneDevis.objects.create(
            devis=devis,
            ordre=1,
            type_ligne="horaire",
            intitule="Production CCTP",
            profil=self.profil,
            nb_heures="12.00",
            taux_horaire="95.00",
            montant_ht="1140.00",
        )
        devis.recalculer_totaux()
        return devis

    def test_assistant_reutilise_les_missions_et_livrables_du_wizard_projet(self):
        request = self.factory.get(
            "/api/societe/devis/assistant/",
            {
                "famille_client": "maitrise_oeuvre",
                "sous_type_client": "architecte",
                "nature_ouvrage": "batiment",
                "contexte_contractuel": "mission_complete",
                "nature_marche": "prive",
                "role_lbh": "economiste",
            },
        )
        force_authenticate(request, user=self.utilisateur)
        response = DevisHonorairesViewSet.as_view({"get": "assistant"})(request)

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data["missions"][0]["code"], "cctp-dpgf")
        self.assertEqual(response.data["missions"][0]["livrables"][0]["code"], "cctp-lot")
        self.assertTrue(response.data["suggestions_prestations"])

    @patch("applications.societe.views.envoyer_courriel")
    def test_envoi_client_genere_un_jeton_et_passe_le_devis_a_envoye(self, mock_envoyer):
        devis = self._creer_devis()

        response = self.client.post(
            f"/api/societe/devis/{devis.id}/envoyer-client/",
            {"expiration_jours": 10},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        devis.refresh_from_db()
        self.assertEqual(devis.statut, "envoye")
        self.assertIsNotNone(devis.jeton_validation_client)
        self.assertIsNotNone(devis.date_envoi_client)
        self.assertTrue(mock_envoyer.called)

    def test_validation_client_accepte_le_devis(self):
        devis = self._creer_devis(
            statut="envoye",
            jeton_validation_client="jeton-test",
            date_expiration_validation=timezone.now() + timedelta(days=5),
        )

        response = self.client.get("/api/societe/validation-client/devis/jeton-test/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        devis.refresh_from_db()
        self.assertEqual(devis.statut, "accepte")
        self.assertEqual(devis.mode_validation, "client")
        self.assertIsNotNone(devis.date_validation_client)
        self.assertIsNone(devis.jeton_validation_client)

    def test_creer_projet_depuis_un_devis_accepte(self):
        devis = self._creer_devis(statut="accepte")

        response = self.client.post(f"/api/societe/devis/{devis.id}/creer-projet/", {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        devis.refresh_from_db()
        self.assertIsNotNone(devis.projet_id)
        projet = Projet.objects.get(pk=devis.projet_id)
        self.assertEqual(projet.responsable, self.utilisateur)
        self.assertEqual(projet.honoraires_prevus, devis.montant_ht)
        self.assertEqual(
            projet.qualification_wizard["statuts_livrables"]["cctp-lot"],
            "a_faire",
        )

    def test_enregistrer_temps_passe_et_remonter_dans_tableau_de_bord(self):
        devis = self._creer_devis(statut="accepte")
        projet = Projet.objects.create(
            reference="2026-3001",
            intitule="Projet rentabilité",
            organisation=self.organisation,
            responsable=self.utilisateur,
            cree_par=self.utilisateur,
            honoraires_prevus="1140.00",
        )
        devis.projet = projet
        devis.save(update_fields=["projet"])

        reponse_creation = self.client.post(
            "/api/societe/temps-passes/",
            {
                "projet": str(projet.id),
                "utilisateur": str(self.utilisateur.id),
                "profil_horaire": str(self.profil.id),
                "date_saisie": str(timezone.localdate()),
                "nature": "livrable",
                "code_cible": "cctp-lot",
                "libelle_cible": "CCTP lot",
                "nb_heures": "6.50",
                "commentaires": "Rédaction",
            },
            format="json",
        )

        self.assertEqual(reponse_creation.status_code, status.HTTP_201_CREATED, reponse_creation.data)
        temps = TempsPasse.objects.get()
        self.assertEqual(str(temps.taux_horaire), "95.00")
        self.assertEqual(str(temps.cout_total), "617.50")

        reponse_tdb = self.client.get("/api/societe/tableau-de-bord/")
        self.assertEqual(reponse_tdb.status_code, status.HTTP_200_OK, reponse_tdb.data)
        self.assertEqual(reponse_tdb.data["temps_passes_recents"][0]["libelle_cible"], "CCTP lot")
        self.assertEqual(reponse_tdb.data["rentabilite_par_salarie"][0]["nom_complet"], self.utilisateur.nom_complet)
        self.assertEqual(reponse_tdb.data["rentabilite_par_dossier"][0]["reference"], projet.reference)

    def test_suggestions_temps_reprennent_les_affectations_et_le_devis_accepte(self):
        devis = self._creer_devis(statut="accepte")
        projet = Projet.objects.create(
            reference="2026-3002",
            intitule="Projet suggestions",
            organisation=self.organisation,
            responsable=self.utilisateur,
            cree_par=self.utilisateur,
            qualification_wizard={"source_devis_id": str(devis.id)},
        )
        devis.projet = projet
        devis.save(update_fields=["projet"])
        affectation = AffectationProjet.objects.create(
            projet=projet,
            utilisateur=self.utilisateur,
            nature="livrable",
            code_cible="cctp-lot",
            libelle_cible="CCTP lot",
            role="redaction",
            cree_par=self.utilisateur,
        )

        reponse = self.client.get(f"/api/societe/temps-passes/suggestions/?projet={projet.id}&utilisateur={self.utilisateur.id}")

        self.assertEqual(reponse.status_code, status.HTTP_200_OK, reponse.data)
        self.assertEqual(reponse.data["devis_reference"], devis.reference)
        self.assertEqual(len(reponse.data["suggestions"]), 1)
        suggestion = reponse.data["suggestions"][0]
        self.assertEqual(suggestion["affectation_id"], str(affectation.id))
        self.assertEqual(suggestion["code_cible"], "cctp-lot")
        self.assertEqual(str(suggestion["nb_heures_suggerees"]), "12.00")

    def test_initialisation_brouillons_depuis_affectations(self):
        devis = self._creer_devis(statut="accepte")
        projet = Projet.objects.create(
            reference="2026-3003",
            intitule="Projet brouillons",
            organisation=self.organisation,
            responsable=self.utilisateur,
            cree_par=self.utilisateur,
            qualification_wizard={"source_devis_id": str(devis.id)},
        )
        devis.projet = projet
        devis.save(update_fields=["projet"])
        AffectationProjet.objects.create(
            projet=projet,
            utilisateur=self.utilisateur,
            nature="livrable",
            code_cible="cctp-lot",
            libelle_cible="CCTP lot",
            role="redaction",
            cree_par=self.utilisateur,
        )

        reponse = self.client.post(
            "/api/societe/temps-passes/initialiser-depuis-affectations/",
            {
                "projet": str(projet.id),
                "date_saisie": str(timezone.localdate()),
                "profil_horaire": str(self.profil.id),
            },
            format="json",
        )

        self.assertEqual(reponse.status_code, status.HTTP_201_CREATED, reponse.data)
        self.assertEqual(TempsPasse.objects.count(), 1)
        temps = TempsPasse.objects.get()
        self.assertEqual(temps.statut, "brouillon")
        self.assertEqual(str(temps.nb_heures), "12.00")
        self.assertEqual(str(temps.taux_horaire), "95.00")

        reponse_statut = self.client.post(
            f"/api/societe/temps-passes/{temps.id}/changer-statut/",
            {"statut": "valide"},
            format="json",
        )
        self.assertEqual(reponse_statut.status_code, status.HTTP_200_OK, reponse_statut.data)
        temps.refresh_from_db()
        self.assertEqual(temps.statut, "valide")

    def test_profil_horaire_par_defaut_salarie_est_repris_dans_suggestions_et_brouillons(self):
        devis = self._creer_devis(statut="accepte")
        profil_secondaire = ProfilHoraire.objects.create(
            code="REDAC",
            libelle="Rédacteur",
            taux_horaire_ht="72.00",
        )
        ProfilHoraireUtilisateur.objects.create(
            utilisateur=self.utilisateur,
            profil_horaire=profil_secondaire,
        )
        projet = Projet.objects.create(
            reference="2026-3004",
            intitule="Projet profils salariés",
            organisation=self.organisation,
            responsable=self.utilisateur,
            cree_par=self.utilisateur,
            qualification_wizard={"source_devis_id": str(devis.id)},
        )
        devis.projet = projet
        devis.save(update_fields=["projet"])
        AffectationProjet.objects.create(
            projet=projet,
            utilisateur=self.utilisateur,
            nature="livrable",
            code_cible="cctp-lot",
            libelle_cible="CCTP lot",
            role="redaction",
            cree_par=self.utilisateur,
        )

        reponse_suggestion = self.client.get(f"/api/societe/temps-passes/suggestions/?projet={projet.id}")
        self.assertEqual(reponse_suggestion.status_code, status.HTTP_200_OK, reponse_suggestion.data)
        self.assertEqual(str(reponse_suggestion.data["suggestions"][0]["taux_horaire_suggere"]), "72.00")

        reponse_generation = self.client.post(
            "/api/societe/temps-passes/initialiser-depuis-affectations/",
            {"projet": str(projet.id)},
            format="json",
        )
        self.assertEqual(reponse_generation.status_code, status.HTTP_201_CREATED, reponse_generation.data)
        temps = TempsPasse.objects.get(projet=projet)
        self.assertEqual(temps.profil_horaire, profil_secondaire)
        self.assertEqual(str(temps.taux_horaire), "72.00")
