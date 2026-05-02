from __future__ import annotations

import tempfile
from decimal import Decimal
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from .models import DevisAnalyse, LignePrixMarche
from .moteur_import_prix import (
    LigneCandidate,
    analyser_structure_ligne_prix,
    classifier_ligne,
    controler_ligne,
    nettoyer_designation_prix_extraite,
    parser_ligne_prix_candidate,
    reconstruire_lignes_depuis_texte,
)
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
    def test_entete_somme_ht_classee_entete(self):
        self.assertEqual(classifier_ligne("Somme (€ H.T.)"), "entete_tableau")

    def test_entete_tableau_complete_classee_entete(self):
        self.assertEqual(classifier_ligne("N° Prix Désignation Unité Quantité P.U. Somme H.T."), "entete_tableau")

    def test_ligne_pointilles_ignoree(self):
        self.assertEqual(classifier_ligne("........................................................................"), "ligne_pointilles")

    def test_numero_article_pas_prix_unitaire(self):
        structure = analyser_structure_ligne_prix("101 Fourniture et pose de regard U 2 650,00 1 300,00")
        self.assertEqual(structure["numero"], "101")
        self.assertEqual(structure["prix_unitaire_ht"], Decimal("650.00"))
        self.assertNotEqual(structure["prix_unitaire_ht"], Decimal("101"))

    def test_numero_article_bt_conserve(self):
        structure = analyser_structure_ligne_prix("203 raccordement BT sur coffret existant U 1 288,00 288,00")
        self.assertEqual(structure["numero"], "203")
        self.assertIn("raccordement bt", structure["designation"].lower())

    def test_numero_article_alphanumerique_conserve(self):
        structure = analyser_structure_ligne_prix("100l câble Alu NF C33-210 ml 5 12,00 60,00")
        self.assertEqual(structure["numero"], "100l")
        self.assertEqual(structure["prix_unitaire_ht"], Decimal("12.00"))

    def test_codes_sans_libelle_a_verifier_ou_ignores(self):
        structure = analyser_structure_ligne_prix("213-c 213-d 213-e")
        self.assertIn(structure["type_ligne"], {"ligne_a_verifier", "commentaire"})
        self.assertNotEqual(structure["type_ligne"], "article")

    def test_basse_tension_classe_chapitre(self):
        self.assertEqual(classifier_ligne("BASSE TENSION"), "chapitre")

    def test_chapitre_designation_separes(self):
        structure = analyser_structure_ligne_prix("BASSE TENSION - câble Alu NF C33-210 ml 2 10,00 20,00")
        self.assertEqual(structure["chapitre"], "BASSE TENSION")
        self.assertEqual(structure["designation"], "Câble Alu NF C33-210")

    def test_travaux_preparatoires_designation_separes(self):
        structure = analyser_structure_ligne_prix("TRAVAUX PREPARATOIRES - être linéaire provisoire ml 2 10,00 20,00")
        self.assertEqual(structure["chapitre"], "TRAVAUX PREPARATOIRES")
        self.assertEqual(structure["designation"], "Être linéaire provisoire")

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

    def test_nettoie_montants_avant_designation(self):
        designation, fragments = nettoyer_designation_prix_extraite("295 € 480 6,3% 135 € Démolition d'ouvrages")
        self.assertEqual(designation, "Démolition d'ouvrages")
        self.assertIn("295", fragments)

    def test_ligne_polluee_demolition(self):
        ligne = parser_ligne_prix_candidate("295 € 480 6,3% 135 € Démolition d'ouvrages U 1 2 000 € 2 000 €")
        self.assertIsNotNone(ligne)
        self.assertEqual(ligne.designation, "Démolition d'ouvrages")
        self.assertEqual(ligne.unite, "U")
        self.assertEqual(ligne.quantite, Decimal("1"))
        self.assertEqual(ligne.prix_unitaire_ht, Decimal("2000"))
        self.assertEqual(ligne.montant_ht, Decimal("2000"))
        self.assertTrue(ligne.nettoyage_designation)
        self.assertIn("295", ligne.designation_originale)

    def test_ligne_polluee_periode_preparation(self):
        ligne = parser_ligne_prix_candidate(
            "Période de préparation 15 22 500 € 0,00% 0 € Installation de chantier % 1 15 000 € 15 000 €"
        )
        self.assertIsNotNone(ligne)
        self.assertEqual(ligne.designation, "Installation de chantier")
        self.assertEqual(ligne.unite, "%")
        self.assertEqual(ligne.prix_unitaire_ht, Decimal("15000"))

    def test_ligne_polluee_deblais(self):
        ligne = parser_ligne_prix_candidate("330 € 258 10,0% 1 030 € Evacuation des déblais excédentaires de fouilles m³ 1 45,00 € 45,00 €")
        self.assertIsNotNone(ligne)
        self.assertEqual(ligne.designation, "Evacuation des déblais excédentaires de fouilles")
        self.assertEqual(ligne.unite, "m³")
        self.assertEqual(ligne.prix_unitaire_ht, Decimal("45.00"))
        self.assertEqual(ligne.montant_ht, Decimal("45.00"))

    def test_ligne_polluee_beton_c3037(self):
        ligne = parser_ligne_prix_candidate("€ 9 9,2% 38 € Béton C30/37 m³ 1 19 000,00 € 19 000,00 €")
        self.assertIsNotNone(ligne)
        self.assertEqual(ligne.designation, "Béton C30/37")

    def test_ligne_polluee_beton_c3037_variante(self):
        ligne = parser_ligne_prix_candidate("450 € 193 9,0% 777 € Béton C30/37 m³ 1 38 000,00 € 38 000,00 €")
        self.assertIsNotNone(ligne)
        self.assertEqual(ligne.designation, "Béton C30/37")

    def test_conserve_pourcentage_final_du_libelle(self):
        ligne = parser_ligne_prix_candidate("12,6% 223 € 1230 Divers non détaillé 12% Ft 1 7 000,00 € 7 000,00 €")
        self.assertIsNotNone(ligne)
        self.assertEqual(ligne.designation, "Divers non détaillé 12%")

    def test_conserve_nombre_utile_epaisseur(self):
        ligne = parser_ligne_prix_candidate("Béton de propreté (ep = 10 cm) m² 1 75,00 € 75,00 €")
        self.assertIsNotNone(ligne)
        self.assertEqual(ligne.designation, "Béton de propreté (ep = 10 cm)")

    def test_conserve_diametre_pehd(self):
        ligne = parser_ligne_prix_candidate("Canalisation PEHD Ø160 ml 25 85,00 € 2 125,00 €")
        self.assertIsNotNone(ligne)
        self.assertEqual(ligne.designation, "Canalisation PEHD Ø160")

    def test_conserve_granulometrie(self):
        ligne = parser_ligne_prix_candidate("Grave 0/31,5 m³ 10 42,00 € 420,00 €")
        self.assertIsNotNone(ligne)
        self.assertEqual(ligne.designation, "Grave 0/31,5")

    def test_designation_brute_a_verifier(self):
        ligne = parser_ligne_prix_candidate("brute % 1 1 110,00 € 1 110,00 €")
        self.assertIsNotNone(ligne)
        self.assertEqual(ligne.statut_controle, "alerte")

    def test_designation_originale_conserve_chaine_brute(self):
        ligne = parser_ligne_prix_candidate("450 € 193 9,0% 777 € Béton C30/37 m³ 1 38 000,00 € 38 000,00 €")
        self.assertIsNotNone(ligne)
        self.assertIn("450 €", ligne.designation_originale)
        self.assertEqual(ligne.designation, "Béton C30/37")


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

    def test_capitalisation_ligne_suspecte_bloquee(self):
        devis = _devis()
        ligne = LignePrixMarche.objects.create(
            devis_source=devis,
            designation="........................................................................",
            designation_normalisee="",
            unite="U",
            prix_ht_original=Decimal("100.00"),
            type_ligne="ligne_pointilles",
            statut_controle="ignoree",
            score_confiance=Decimal("0.00"),
        )
        client = APIClient()
        utilisateur = get_user_model().objects.create_user(
            courriel="ressources2@example.com",
            password="secret-test-123",
            prenom="Test",
            nom="Ressources",
        )
        client.force_authenticate(utilisateur)
        reponse = client.post(f"/api/ressources/prix-marche/{ligne.id}/capitaliser/")
        self.assertEqual(reponse.status_code, 400)
        self.assertIn("pas un article", reponse.json()["detail"])

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

    def test_designation_tres_longue_ne_bloque_pas_l_import(self):
        devis = _devis("long.pdf")
        designation = " ".join(["Désignation très détaillée"] * 40)
        texte = f"{designation} F 1 100,00 100,00"
        with patch("applications.ressources.services.requests.post", return_value=FauxReponsePdf(texte)):
            lignes = analyser_devis(devis)

        self.assertEqual(len(lignes), 1)
        ligne = LignePrixMarche.objects.get(devis_source=devis)
        self.assertLessEqual(len(ligne.designation), 500)
        self.assertGreater(len(ligne.designation_originale), 500)
        self.assertLessEqual(len(ligne.designation_normalisee), 500)

    def test_analyse_devis_trace_nettoyage_designation(self):
        devis = _devis("pollue.pdf")
        texte = "295 € 480 6,3% 135 € Démolition d'ouvrages U 1 2 000 € 2 000 €"
        with patch("applications.ressources.services.requests.post", return_value=FauxReponsePdf(texte)):
            lignes = analyser_devis(devis)

        self.assertEqual(len(lignes), 1)
        ligne = LignePrixMarche.objects.get(devis_source=devis)
        self.assertEqual(ligne.designation, "Démolition d'ouvrages")
        self.assertIn("295 €", ligne.designation_originale)
        self.assertTrue(ligne.donnees_import["nettoyage_designation"])
        self.assertIn("295", ligne.donnees_import["fragments_supprimes"])
