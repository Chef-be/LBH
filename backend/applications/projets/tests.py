from django.test import TestCase
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status
from rest_framework.test import APIClient
from unittest.mock import patch

from applications.documents.models import DossierDocumentProjet, Document, TypeDocument
from applications.comptes.models import Utilisateur
from applications.organisations.models import Organisation
from applications.projets.models import Projet, PreanalyseSourcesProjet, AffectationProjet, LivrableProjet
from applications.pieces_ecrites.models import ModeleDocument, PieceEcrite
from applications.appels_offres.models import AppelOffres


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
        self.assertIsNotNone(projet.date_debut_prevue)
        self.assertTrue(
            projet.intervenants.filter(
                utilisateur=self.admin,
                role="responsable",
            ).exists()
        )
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

    def test_affectation_ciblee_cree_un_intervenant_et_est_listable(self):
        collaborateur = Utilisateur.objects.create_user(
            courriel="collab-projets@example.com",
            password="motdepasse123",
            prenom="Collab",
            nom="Projet",
            organisation=self.organisation,
        )

        reponse = self.client.post(
            f"/api/projets/{self.projet.id}/affectations/",
            {
                "utilisateur": str(collaborateur.id),
                "nature": "livrable",
                "code_cible": "livrable-cctp",
                "libelle_cible": "CCTP lot Gros Oeuvre",
                "role": "redaction",
                "commentaires": "Rédaction du lot principal",
            },
            format="json",
        )

        self.assertEqual(reponse.status_code, status.HTTP_201_CREATED, reponse.data)
        self.assertTrue(
            AffectationProjet.objects.filter(
                projet=self.projet,
                utilisateur=collaborateur,
                code_cible="livrable-cctp",
            ).exists()
        )
        self.assertTrue(
            self.projet.intervenants.filter(utilisateur=collaborateur).exists()
        )

        liste = self.client.get(f"/api/projets/{self.projet.id}/affectations/")
        self.assertEqual(liste.status_code, status.HTTP_200_OK, liste.data)
        resultats = liste.data["results"] if isinstance(liste.data, dict) and "results" in liste.data else liste.data
        self.assertEqual(resultats[0]["utilisateur_nom"], "Collab Projet")

    def test_vue_mes_affectations_retourne_les_affectations_de_l_utilisateur_connecte(self):
        collaborateur = Utilisateur.objects.create_user(
            courriel="affecte-projets@example.com",
            password="motdepasse123",
            prenom="Alice",
            nom="Affectee",
            organisation=self.organisation,
        )
        AffectationProjet.objects.create(
            projet=self.projet,
            utilisateur=collaborateur,
            nature="mission",
            code_cible="mission-cctp",
            libelle_cible="Rédaction CCTP",
            role="redaction",
            cree_par=self.admin,
        )
        autre = Utilisateur.objects.create_user(
            courriel="autre-projets@example.com",
            password="motdepasse123",
            prenom="Autre",
            nom="Utilisateur",
            organisation=self.organisation,
        )
        AffectationProjet.objects.create(
            projet=self.projet,
            utilisateur=autre,
            nature="livrable",
            code_cible="livrable-dpgf",
            libelle_cible="DPGF",
            role="contribution",
            cree_par=self.admin,
        )

        self.client.force_authenticate(collaborateur)
        reponse = self.client.get("/api/projets/mes-affectations/")

        self.assertEqual(reponse.status_code, status.HTTP_200_OK, reponse.data)
        self.assertEqual(len(reponse.data["affectations"]), 1)
        affectation = reponse.data["affectations"][0]
        self.assertEqual(affectation["code_cible"], "mission-cctp")
        self.assertEqual(affectation["nature"], "mission")
        self.assertEqual(affectation["projet"]["reference"], self.projet.reference)
        self.assertEqual(affectation["projet"]["responsable_nom"], self.admin.nom_complet)

    def test_parcours_projet_retourne_les_referentiels_front(self):
        reponse = self.client.get(
            "/api/projets/parcours/",
            {
                "famille_client": "entreprise",
                "nature_ouvrage": "batiment",
                "nature_marche": "public",
            },
        )

        self.assertEqual(reponse.status_code, status.HTTP_200_OK, reponse.data)
        self.assertIn("referentiels", reponse.data)
        self.assertTrue(reponse.data["referentiels"]["familles_client"])
        self.assertTrue(reponse.data["referentiels"]["missions_principales"])
        self.assertTrue(reponse.data["champs_dynamiques"])
        self.assertTrue(reponse.data["dossiers_ged"])

    def test_creation_projet_avance_accepte_contexte_front_sans_bureau_etudes(self):
        reponse = self.client.post(
            "/api/projets/",
            {
                "reference": "2026-0450",
                "intitule": "Réponse AO marché école",
                "type_projet": "etude",
                "statut": "en_cours",
                "organisation": None,
                "contexte_projet_saisie": {
                    "famille_client": "entreprise",
                    "sous_type_client": "groupement",
                    "contexte_contractuel": "appel_offres",
                    "mission_principale": "reponse_appel_offres",
                    "missions_associees": ["reponse_appel_offres", "memoire_technique"],
                    "phase_intervention": "",
                    "nature_ouvrage": "batiment",
                    "nature_marche": "public",
                    "partie_contractante": "Ville de Mamoudzou",
                    "role_lbh": "Co-traitant économiste",
                    "methode_estimation": "analytique",
                    "donnees_entree": {"reference_consultation": "RC-2026-015"},
                    "sous_missions": ["bordereaux_finalises"],
                    "trace_preremplissage": {"source": "test"},
                },
                "mode_variation_prix_saisie": {
                    "type_evolution": "revision",
                    "cadre_juridique": "public",
                    "indice_reference": "BT01",
                    "periodicite_revision": "mensuelle",
                },
            },
            format="json",
        )

        self.assertEqual(reponse.status_code, status.HTTP_201_CREATED, reponse.data)
        projet = Projet.objects.get(pk=reponse.data["id"])
        self.assertIsNone(projet.organisation)
        self.assertEqual(projet.clientele_cible, "entreprise_travaux")
        self.assertEqual(projet.objectif_mission, "reponse_ao_entreprise")
        self.assertEqual(projet.qualification_wizard["contexte_projet"]["famille_client"], "entreprise")
        self.assertEqual(projet.qualification_wizard["mode_variation_prix"]["indice_reference"], "BT01")

        detail = self.client.get(f"/api/projets/{projet.id}/")
        self.assertEqual(detail.status_code, status.HTTP_200_OK, detail.data)
        self.assertEqual(detail.data["contexte_projet"]["famille_client"]["code"], "entreprise")
        self.assertEqual(detail.data["mode_variation_prix"]["indice_reference"], "BT01")

    @patch("applications.projets.views.importer_sources_preanalyse_dans_projet.apply_async")
    def test_creation_projet_planifie_import_des_sources_preanalyse(self, mock_apply_async):
        preanalyse = PreanalyseSourcesProjet.objects.create(
            utilisateur=self.admin,
            statut="terminee",
            progression=100,
            message="Préanalyse terminée",
            nombre_fichiers=2,
            repertoire_temp="/tmp/preanalyse-tests",
            resultat={"resume": {"fichiers_analyses": 2}},
        )

        reponse = self.client.post(
            "/api/projets/",
            {
                "reference": "2026-0451",
                "intitule": "Projet avec import différé",
                "type_projet": "etude",
                "statut": "en_cours",
                "organisation": str(self.organisation.id),
                "preanalyse_sources_id": str(preanalyse.id),
            },
            format="json",
        )

        self.assertEqual(reponse.status_code, status.HTTP_201_CREATED, reponse.data)
        mock_apply_async.assert_called_once_with(
            args=[str(preanalyse.id), reponse.data["id"], str(self.admin.id)],
            queue="documents",
            routing_key="documents",
        )

    @patch("applications.projets.views.executer_preanalyse_sources_projet.apply_async")
    def test_creation_preanalyse_sources_projet_cree_une_tache(self, mock_apply_async):
        mock_apply_async.return_value.id = "tache-test-123"
        fichier = SimpleUploadedFile("programme-contexte.docx", b"contenu", content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document")

        reponse = self.client.post(
            "/api/projets/preanalyse-sources/taches/",
            {
                "fichiers": [fichier],
                "famille_client": "maitrise_oeuvre",
                "nature_ouvrage": "batiment",
                "nature_marche": "public",
            },
            format="multipart",
        )

        self.assertEqual(reponse.status_code, status.HTTP_201_CREATED, reponse.data)
        preanalyse = PreanalyseSourcesProjet.objects.get(pk=reponse.data["id"])
        self.assertEqual(preanalyse.nombre_fichiers, 1)
        self.assertEqual(preanalyse.contexte["famille_client"], "maitrise_oeuvre")
        self.assertEqual(preanalyse.tache_celery_id, "tache-test-123")
        mock_apply_async.assert_called_once_with(
            args=[str(preanalyse.id)],
            queue="principale",
            routing_key="principale",
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

    def test_detail_projet_expose_une_phase_suggeree_selon_les_artefacts_reels(self):
        modele_cctp = ModeleDocument.objects.create(
            code="MODELE-CCTP-TEST",
            libelle="Modèle CCTP test",
            type_document="cctp",
        )
        modele_dpgf = ModeleDocument.objects.create(
            code="MODELE-DPGF-TEST",
            libelle="Modèle DPGF test",
            type_document="dpgf",
        )
        PieceEcrite.objects.create(
            projet=self.projet,
            modele=modele_cctp,
            intitule="CCTP lot 01",
        )
        PieceEcrite.objects.create(
            projet=self.projet,
            modele=modele_dpgf,
            intitule="DPGF lot 01",
        )
        AppelOffres.objects.create(
            projet=self.projet,
            intitule="Consultation lots séparés",
            type_procedure="procedure_adaptee",
            statut="preparation",
        )

        reponse = self.client.get(f"/api/projets/{self.projet.id}/")

        self.assertEqual(reponse.status_code, status.HTTP_200_OK, reponse.data)
        self.assertEqual(reponse.data["phase_suggeree"]["code"], "dce")
        self.assertTrue(reponse.data["phase_suggeree"]["differe"])

    def test_application_phase_suggeree_met_a_jour_la_phase_officielle(self):
        modele_cctp = ModeleDocument.objects.create(
            code="MODELE-CCTP-APPLY",
            libelle="Modèle CCTP apply",
            type_document="cctp",
        )
        PieceEcrite.objects.create(
            projet=self.projet,
            modele=modele_cctp,
            intitule="CCTP lot 02",
        )

        reponse = self.client.post(f"/api/projets/{self.projet.id}/phase-suggeree/appliquer/", {}, format="json")

        self.assertEqual(reponse.status_code, status.HTTP_200_OK, reponse.data)
        self.projet.refresh_from_db()
        self.assertEqual(self.projet.phase_actuelle, "dce")
        self.assertEqual(reponse.data["projet"]["phase_actuelle"], "dce")

    def test_synthese_normalise_les_codes_historiques_de_phase(self):
        self.projet.phase_actuelle = "act"
        self.projet.save(update_fields=["phase_actuelle"])

        reponse = self.client.get(f"/api/projets/{self.projet.id}/synthese/")

        self.assertEqual(reponse.status_code, status.HTTP_200_OK, reponse.data)
        self.assertEqual(reponse.data["phase_code"], "ao")
        self.assertEqual(reponse.data["phase_index"], 6)

    def test_fiche_metier_moa_verifie_enveloppe(self):
        self.projet.clientele_cible = "moa_publique"
        self.projet.objectif_mission = "verifier_enveloppe"
        self.projet.qualification_wizard = {
            "contexte_projet": {
                "famille_client": "maitrise_ouvrage",
                "contexte_contractuel": "marche_public",
                "mission_principale": "verifier_enveloppe",
                "nature_ouvrage": "batiment",
                "nature_marche": "public",
            }
        }
        self.projet.save(update_fields=["clientele_cible", "objectif_mission", "qualification_wizard"])

        reponse = self.client.get(f"/api/projets/{self.projet.id}/fiche-metier/")

        self.assertEqual(reponse.status_code, status.HTTP_200_OK, reponse.data)
        self.assertEqual(reponse.data["profil_fiche"], "moa_enveloppe")
        self.assertIn("programme", [p["code"] for p in reponse.data["pieces_sources"]["attendues"]])
        self.assertNotIn("execution", [m["code"] for m in reponse.data["modules_actifs"]])
        self.assertEqual(reponse.data["synthese_economique"]["lien_module"], "economie")

    def test_fiche_metier_moe_dce_active_metres_et_pieces(self):
        self.projet.phase_actuelle = "dce"
        self.projet.qualification_wizard = {
            "contexte_projet": {
                "famille_client": "maitrise_oeuvre",
                "contexte_contractuel": "dce_consultation",
                "mission_principale": "redaction_cctp",
                "phase_intervention": "pro",
                "nature_ouvrage": "batiment",
                "nature_marche": "public",
            }
        }
        self.projet.save(update_fields=["phase_actuelle", "qualification_wizard"])

        reponse = self.client.get(f"/api/projets/{self.projet.id}/fiche-metier/")

        self.assertEqual(reponse.status_code, status.HTTP_200_OK, reponse.data)
        modules = {m["code"]: m for m in reponse.data["modules_actifs"]}
        self.assertEqual(reponse.data["profil_fiche"], "moe_dce")
        self.assertIn("metres", modules)
        self.assertIn("pieces-ecrites", modules)
        self.assertIn("dpgf", [l["code"] for l in reponse.data["livrables"]["attendus"]])

    def test_fiche_metier_entreprise_appel_offres_active_ressources(self):
        self.projet.clientele_cible = "entreprise_travaux"
        self.projet.objectif_mission = "reponse_ao_entreprise"
        self.projet.qualification_wizard = {
            "contexte_projet": {
                "famille_client": "entreprise",
                "sous_type_client": "entreprise_generale",
                "contexte_contractuel": "appel_offres",
                "mission_principale": "reponse_appel_offres",
                "nature_ouvrage": "batiment",
            }
        }
        self.projet.save(update_fields=["clientele_cible", "objectif_mission", "qualification_wizard"])

        reponse = self.client.get(f"/api/projets/{self.projet.id}/fiche-metier/")

        self.assertEqual(reponse.status_code, status.HTTP_200_OK, reponse.data)
        self.assertEqual(reponse.data["profil_fiche"], "entreprise_ao")
        modules = [m["code"] for m in reponse.data["modules_actifs"]]
        self.assertIn("ressources", modules)
        self.assertIn("appels-offres", modules)
        self.assertIn("dpgf", [p["code"] for p in reponse.data["pieces_sources"]["attendues"]])

    def test_generation_livrables_depuis_parcours(self):
        self.projet.qualification_wizard = {
            "contexte_projet": {
                "famille_client": "maitrise_oeuvre",
                "contexte_contractuel": "dce_consultation",
                "mission_principale": "redaction_cctp",
                "phase_intervention": "pro",
            }
        }
        self.projet.save(update_fields=["qualification_wizard"])

        reponse = self.client.post(f"/api/projets/{self.projet.id}/livrables/generer-depuis-parcours/", {}, format="json")

        self.assertEqual(reponse.status_code, status.HTTP_201_CREATED, reponse.data)
        self.assertTrue(LivrableProjet.objects.filter(projet=self.projet, code="cctp").exists())
        liste = self.client.get(f"/api/projets/{self.projet.id}/livrables/")
        self.assertEqual(liste.status_code, status.HTTP_200_OK, liste.data)
        self.assertGreaterEqual(len(liste.data), 1)
