from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from applications.organisations.models import Organisation
from applications.pieces_ecrites.models import ArticleCCTP
from applications.projets.models import Projet
from applications.metres.models import (
    DPGFQuantitative,
    FondPlan,
    GeometrieFondPlan,
    LigneMetre,
    Metre,
    ZoneMesure,
)
from applications.metres.services import (
    creer_ligne_depuis_zone,
    extraire_et_stocker_geometrie_fond_plan,
    synchroniser_ligne_depuis_zone,
)


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

    def test_creation_ligne_metre_quantitative_sans_prix(self):
        reponse = self.client.post(
            f"/api/metres/{self.metre.id}/lignes/",
            {
                "numero_ordre": 2,
                "designation": "Cloisons de distribution",
                "nature": "travaux",
                "quantite": "18.500",
                "unite": "m2",
                "designation_source": "libre",
            },
            format="json",
        )

        self.assertEqual(reponse.status_code, status.HTTP_201_CREATED, reponse.data)
        ligne = LigneMetre.objects.get(pk=reponse.data["id"])
        self.assertIsNone(ligne.prix_unitaire_ht)
        self.assertIsNone(reponse.data["montant_ht"])

    def test_creation_ligne_liee_article_cctp(self):
        article = ArticleCCTP.objects.create(
            numero_article="A-001",
            code_reference="CCTP-001",
            intitule="Enduit monocouche",
            corps_article="",
            chapitre="Façades",
            est_dans_bibliotheque=True,
            statut="valide",
        )

        reponse = self.client.post(
            f"/api/metres/{self.metre.id}/lignes/",
            {
                "numero_ordre": 3,
                "article_cctp": str(article.id),
                "designation": "Enduit monocouche",
                "nature": "travaux",
                "quantite": "42.000",
                "unite": "m2",
            },
            format="json",
        )

        self.assertEqual(reponse.status_code, status.HTTP_201_CREATED, reponse.data)
        ligne = LigneMetre.objects.get(pk=reponse.data["id"])
        self.assertEqual(ligne.designation_source, "cctp")
        self.assertEqual(ligne.article_cctp_code, "CCTP-001")

    def test_creation_ligne_libre_signalee_sans_article(self):
        ligne = LigneMetre.objects.create(
            metre=self.metre,
            numero_ordre=4,
            designation="Désignation libre à qualifier",
            nature="travaux",
            quantite="1.000",
            unite="u",
        )

        reponse = self.client.get(f"/api/metres/{self.metre.id}/controle-coherence/")

        self.assertEqual(reponse.status_code, status.HTTP_200_OK, reponse.data)
        self.assertEqual(reponse.data["nb_lignes_sans_article_cctp"], 1)
        self.assertTrue(any(item["ligne"] == str(ligne.id) for item in reponse.data["alertes"]))

    def test_calcul_zone_surface_et_longueur(self):
        fond = FondPlan.objects.create(
            metre=self.metre,
            intitule="Plan RDC",
            format_fichier="image",
            echelle="10.000000",
        )
        surface = ZoneMesure.objects.create(
            fond_plan=fond,
            designation="Sol pièce 1",
            type_mesure="surface",
            points_px=[[0, 0], [20, 0], [20, 10], [0, 10]],
        )
        longueur = ZoneMesure.objects.create(
            fond_plan=fond,
            designation="Plinthe",
            type_mesure="longueur",
            points_px=[[0, 0], [30, 0]],
        )

        reponse_surface = self.client.post(
            f"/api/metres/{self.metre.id}/fonds-plan/{fond.id}/zones/{surface.id}/calculer/",
            {},
            format="json",
        )
        reponse_longueur = self.client.post(
            f"/api/metres/{self.metre.id}/fonds-plan/{fond.id}/zones/{longueur.id}/calculer/",
            {},
            format="json",
        )

        self.assertEqual(reponse_surface.status_code, status.HTTP_200_OK, reponse_surface.data)
        self.assertEqual(reponse_longueur.status_code, status.HTTP_200_OK, reponse_longueur.data)
        surface.refresh_from_db()
        longueur.refresh_from_db()
        self.assertEqual(float(surface.valeur_nette), 2.0)
        self.assertEqual(float(longueur.valeur_nette), 3.0)

    def test_conversion_zone_ligne_et_synchronisation(self):
        fond = FondPlan.objects.create(
            metre=self.metre,
            intitule="Plan étage",
            format_fichier="image",
            echelle="10.000000",
        )
        zone = ZoneMesure.objects.create(
            fond_plan=fond,
            designation="Carrelage cuisine",
            localisation="RDC cuisine",
            type_mesure="surface",
            points_px=[[0, 0], [20, 0], [20, 10], [0, 10]],
            valeur_nette="2.0000",
            unite="m²",
            statut_calcul="calculee",
        )

        ligne = creer_ligne_depuis_zone(zone, self.metre, 5)
        self.assertEqual(ligne.source_type, "zone_visuelle")
        self.assertEqual(ligne.statut_synchronisation, "synchronisee")
        zone.refresh_from_db()
        self.assertEqual(zone.statut_conversion, "synchronisee")

        zone.points_px = [[0, 0], [30, 0], [30, 10], [0, 10]]
        zone.valeur_nette = "3.0000"
        zone.save()
        ligne.refresh_from_db()
        self.assertEqual(ligne.statut_synchronisation, "desynchronisee")

        ligne = synchroniser_ligne_depuis_zone(zone)
        self.assertEqual(float(ligne.quantite), 3.0)
        self.assertEqual(ligne.statut_synchronisation, "synchronisee")

    def test_previsualisation_et_generation_dpgf_sans_prix(self):
        article = ArticleCCTP.objects.create(
            numero_article="A-002",
            code_reference="CCTP-002",
            intitule="Peinture murs",
            corps_article="",
            chapitre="Revêtements",
            est_dans_bibliotheque=True,
            statut="valide",
        )
        LigneMetre.objects.create(
            metre=self.metre,
            numero_ordre=6,
            article_cctp=article,
            designation="Peinture murs",
            nature="travaux",
            localisation="RDC",
            quantite="25.000",
            unite="m2",
        )

        apercu = self.client.get(f"/api/metres/{self.metre.id}/previsualiser-dpgf/")
        self.assertEqual(apercu.status_code, status.HTTP_200_OK, apercu.data)
        self.assertEqual(apercu.data["nb_lignes"], 1)
        self.assertNotIn("prix_unitaire_ht", apercu.data["lignes"][0])
        self.assertNotIn("montant_ht", apercu.data["lignes"][0])

        creation = self.client.post(f"/api/metres/{self.metre.id}/generer-dpgf/", {}, format="json")
        self.assertEqual(creation.status_code, status.HTTP_201_CREATED, creation.data)
        dpgf = DPGFQuantitative.objects.get(pk=creation.data["dpgf_id"])
        ligne_dpgf = dpgf.lignes.get()
        self.assertEqual(ligne_dpgf.designation, "Peinture murs")
        self.assertFalse(hasattr(ligne_dpgf, "prix_unitaire_ht"))
        self.assertFalse(hasattr(ligne_dpgf, "montant_ht"))

    def test_vectorisation_fond_plan_fallback_sans_fichier(self):
        fond = FondPlan.objects.create(
            metre=self.metre,
            intitule="Plan scanné",
            format_fichier="image",
        )

        resultat = extraire_et_stocker_geometrie_fond_plan(fond)

        self.assertEqual(resultat["statut"], "termine")
        self.assertEqual(resultat["nb_segments"], 0)
        self.assertTrue(GeometrieFondPlan.objects.filter(fond_plan=fond, statut="disponible").exists())

    def test_extraction_dxf_genere_points_accroche_si_dependance_disponible(self):
        try:
            import ezdxf
        except Exception:
            self.skipTest("ezdxf indisponible dans l'environnement de test.")

        import io
        document = ezdxf.new("R2010")
        document.modelspace().add_line((0, 0), (10, 0), dxfattribs={"layer": "MURS"})
        tampon = io.StringIO()
        document.write(tampon)
        contenu = tampon.getvalue()
        fond = FondPlan.objects.create(
            metre=self.metre,
            intitule="Plan DXF",
            format_fichier="dxf",
        )
        fond.fichier.save("plan-test.dxf", ContentFile(contenu.encode("utf-8")), save=True)

        resultat = extraire_et_stocker_geometrie_fond_plan(fond)

        self.assertEqual(resultat["statut"], "termine")
        self.assertGreaterEqual(len(resultat["points_accroche"]), 2)

    def test_ancienne_ligne_avec_prix_reste_lisible(self):
        ligne = LigneMetre.objects.create(
            metre=self.metre,
            numero_ordre=7,
            designation="Ancienne ligne",
            nature="travaux",
            quantite="2.000",
            unite="u",
            prix_unitaire_ht="10.0000",
        )

        reponse = self.client.get(f"/api/metres/{self.metre.id}/lignes/{ligne.id}/")

        self.assertEqual(reponse.status_code, status.HTTP_200_OK, reponse.data)
        self.assertEqual(reponse.data["montant_ht"], 20.0)
