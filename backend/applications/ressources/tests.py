from __future__ import annotations

import tempfile
from decimal import Decimal
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from .models import DevisAnalyse, LignePrixMarche
from .moteur_import_prix import LigneCandidate, controler_ligne, reconstruire_lignes_depuis_texte
from .services import analyser_devis
from .taches import tache_analyser_devis


MEDIA_ROOT_TEST = tempfile.mkdtemp()


def _devis(nom: str = "devis.pdf") -> DevisAnalyse:
    return DevisAnalyse.objects.create(
        fichier=SimpleUploadedFile(nom, b"%PDF-1.4 test", content_type="application/pdf"),
        nom_original=nom,
        type_document="dpgf",
    )


class FauxReponsePdf:
    def __init__(self, texte: str):
        self.texte = texte

    def raise_for_status(self):
        return None

    def json(self):
        return {"texte_brut": self.texte, "tableaux": [], "nb_tableaux": 0, "nb_images": 0}


class MoteurImportPrixTests(TestCase):
    def test_ligne_complete_sur_une_ligne(self):
        lignes, diagnostic = reconstruire_lignes_depuis_texte(
            "Installation de chantier Fft 1,00 25 000,00 € 25 000,00 €"
        )
        self.assertEqual(len(lignes), 1)
        self.assertEqual(lignes[0]["designation"], "Installation de chantier")
        self.assertEqual(lignes[0]["unite"], "Fft")
        self.assertEqual(lignes[0]["quantite"], Decimal("1.00"))
        self.assertEqual(lignes[0]["prix_unitaire"], Decimal("25000.00"))
        self.assertEqual(lignes[0]["montant"], Decimal("25000.00"))
        self.assertEqual(diagnostic["nb_lignes_candidates"], 1)

    def test_designation_multiligne_valeurs_derniere_ligne(self):
        lignes, _ = reconstruire_lignes_depuis_texte(
            "1,1,1\n"
            "Installation de chantier et signalisation provisoire\n"
            "Fft 1,00 25 000,00 € 25 000,00 €"
        )
        self.assertEqual(len(lignes), 1)
        self.assertEqual(lignes[0]["numero"], "1,1,1")
        self.assertIn("Installation de chantier", lignes[0]["designation"])

    def test_cellules_eclatees_une_par_ligne(self):
        lignes, _ = reconstruire_lignes_depuis_texte(
            "Installation de chantier\n%\n1\n15 000 €\n15 000 €"
        )
        self.assertEqual(len(lignes), 1)
        self.assertEqual(lignes[0]["unite"], "%")
        self.assertEqual(lignes[0]["prix_unitaire"], Decimal("15000"))
        self.assertEqual(lignes[0]["montant"], Decimal("15000"))

    def test_montants_sans_decimales(self):
        lignes, _ = reconstruire_lignes_depuis_texte("Dépose soignée Ft 2 15000 30000")
        self.assertEqual(len(lignes), 1)
        self.assertEqual(lignes[0]["prix_unitaire"], Decimal("15000"))
        self.assertEqual(lignes[0]["montant"], Decimal("30000"))

    def test_unites_reconnues(self):
        texte = "\n".join([
            "Poste F 1 10 10",
            "Poste Ft 1 10 10",
            "Poste Fft 1 10 10",
            "Poste % 1 10 10",
            "Poste Ft/ml 1 10 10",
        ])
        lignes, _ = reconstruire_lignes_depuis_texte(texte)
        self.assertEqual([ligne["unite"] for ligne in lignes], ["F", "Ft", "Fft", "%", "Ft/ml"])

    def test_sous_article_rattache_au_parent(self):
        lignes, _ = reconstruire_lignes_depuis_texte(
            "301 Canalisations PE Annelé SN8 / SN16\n"
            "a _De350/Di300 ml 220 100,00 22 000,00"
        )
        self.assertEqual(len(lignes), 1)
        self.assertEqual(lignes[0]["numero"], "301a")
        self.assertIn("Canalisations PE", lignes[0]["designation"])
        self.assertIn("De350", lignes[0]["designation"])

    def test_sous_total_et_total_general_ignores(self):
        lignes, _ = reconstruire_lignes_depuis_texte(
            "Sous-total lot 1 25 000,00 €\n"
            "Total général HT 25 000,00 €\n"
            "Installation F 1 100 100"
        )
        self.assertEqual(len(lignes), 1)
        self.assertEqual(lignes[0]["designation"], "Installation")

    def test_pu_recalcule_depuis_quantite_et_montant(self):
        ligne = controler_ligne(LigneCandidate(
            designation="Installation",
            unite="F",
            quantite=Decimal("2"),
            montant_ht=Decimal("300"),
        ))
        self.assertEqual(ligne.prix_unitaire_ht, Decimal("150.0000"))

    def test_montant_recalcule_depuis_quantite_et_pu(self):
        ligne = controler_ligne(LigneCandidate(
            designation="Installation",
            unite="F",
            quantite=Decimal("2"),
            prix_unitaire_ht=Decimal("150"),
        ))
        self.assertEqual(ligne.montant_ht, Decimal("300.00"))

    def test_alerte_si_quantite_pu_differe_du_montant(self):
        ligne = controler_ligne(LigneCandidate(
            designation="Installation",
            unite="F",
            quantite=Decimal("2"),
            prix_unitaire_ht=Decimal("150"),
            montant_ht=Decimal("1000"),
        ))
        self.assertEqual(ligne.statut_controle, "alerte")
        self.assertGreater(ligne.ecart_montant_ht, Decimal("0"))


@override_settings(MEDIA_ROOT=MEDIA_ROOT_TEST)
class AnalyseDevisTests(TestCase):
    def test_devis_termine_avec_lignes_detectees(self):
        devis = _devis()
        with patch("applications.ressources.services.analyser_devis", return_value=[{"id": "x"}]):
            resultat = tache_analyser_devis.run(str(devis.id))
        devis.refresh_from_db()
        self.assertEqual(devis.statut, "termine")
        self.assertEqual(resultat["lignes_extraites"], 1)

    def test_devis_a_verifier_si_zero_ligne(self):
        devis = _devis()
        with patch("applications.ressources.services.analyser_devis", return_value=[]):
            resultat = tache_analyser_devis.run(str(devis.id))
        devis.refresh_from_db()
        self.assertEqual(devis.statut, "a_verifier")
        self.assertEqual(resultat["statut"], "a_verifier")
        self.assertIn("Aucune ligne de prix", devis.message_analyse)

    def test_capitalisation_bloquee_si_zero_ligne(self):
        devis = _devis()
        client = APIClient()
        utilisateur = get_user_model().objects.create_user(
            courriel="ressources@example.com",
            password="secret-test-123",
            prenom="Test",
            nom="Ressources",
        )
        client.force_authenticate(utilisateur)
        reponse = client.post(f"/api/ressources/devis/{devis.id}/capitaliser/")
        devis.refresh_from_db()
        self.assertEqual(reponse.status_code, 400)
        self.assertFalse(devis.capitalise)
        self.assertIn("Aucune ligne à capitaliser", reponse.json()["detail"])

    def test_ligne_extraite_reste_liee_au_devis_courant_malgre_similaire(self):
        ancien = _devis("ancien.pdf")
        courant = _devis("courant.pdf")
        LignePrixMarche.objects.create(
            devis_source=ancien,
            designation="Installation de chantier",
            designation_normalisee="installation chantier",
            unite="F",
            prix_ht_original=Decimal("900.00"),
            corps_etat="",
        )

        texte = "Installation de chantier F 1 1 000,00 1 000,00"
        with patch("applications.ressources.services.requests.post", return_value=FauxReponsePdf(texte)):
            lignes = analyser_devis(courant)

        self.assertEqual(len(lignes), 1)
        self.assertEqual(LignePrixMarche.objects.filter(devis_source=courant).count(), 1)
        self.assertEqual(LignePrixMarche.objects.filter(devis_source=ancien).count(), 1)
