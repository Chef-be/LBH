from decimal import Decimal
from unittest.mock import patch

from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from applications.comptes.models import Utilisateur
from applications.organisations.models import Organisation
from applications.bibliotheque.models import LignePrixBibliotheque, SousDetailPrix
from applications.bibliotheque.services import (
    analyser_fiche_prix_construction,
    extraire_lignes_economiques_depuis_texte,
    generer_sous_details_depuis_composantes,
    importer_bordereau_depuis_fichier,
    importer_bordereaux_prix_references,
    importer_document_economique_dans_bibliotheque,
    importer_referentiel_prix_construction,
    parser_bordereau_artiprix,
)
from applications.documents.models import Document, TypeDocument
from applications.economie.models import ProfilMainOeuvre
from applications.projets.models import Projet


EXTRAIT_BORDEREAU = """
DÉMOLITION - DÉPOSE
Démolition de clôtures en briques pleines
1.1.36
1.1.37
Muret en briques pleines
Pilier en briques pleines
ML
U
0,250
0,500
10,25
20,50
14,00
28,00
10,25
20,50
14,00
28,00
"""

EXTRAIT_PRIX_CONSTRUCTION = """
<html>
  <body>
    <table class="table">
      <tr>
        <td class="bg-body-highlight text-center"><span class="text-uppercase">GFF010</span></td>
        <td class="px-3 d-none d-sm-table-cell"><span class="fw-bold">Semelle filante de fondation en béton armé</span></td>
      </tr>
      <tr>
        <td colspan="2"><div class="show-more">Semelle filante de fondation en béton armé, réalisée en excavation préalable.</div></td>
      </tr>
    </table>
    <table class="table">
      <tr>
        <td><h6>Prix</h6></td>
        <td><h4>450,45€</h4><span>m³</span></td>
      </tr>
    </table>
    <div id="decomposedPriceHeaderCollapse">
      <table>
        <tr>
          <td>Code interne</td><td>Désignation</td><td>Quantité</td><td>Unité</td><td>Prix unitaire</td><td>Prix total</td>
        </tr>
        <tr>
          <td>mt07aco020a</td><td>Séparateur homologué pour fondations.</td><td>7,000</td><td>U</td><td>0,15</td><td>1,05</td>
        </tr>
        <tr>
          <td>mt07aco050a</td><td>Ferraille élaborée en atelier industriel.</td><td>100,000</td><td>kg</td><td>2,62</td><td>262,00</td>
        </tr>
        <tr>
          <td>mo043</td><td>Compagnon professionnel III/CP2 ferrailleur.</td><td>0,160</td><td>h</td><td>32,19</td><td>5,15</td>
        </tr>
        <tr>
          <td></td><td>Frais de chantier des unités d'ouvrage</td><td>2,000</td><td>%</td><td>441,62</td><td>8,83</td>
        </tr>
        <tr>
          <td colspan="3">Coût d'entretien décennal: 13,51€ les 10 premières années.</td>
          <td></td>
          <td>Montant total HT:</td>
          <td>450,45</td>
        </tr>
      </table>
    </div>
    <div id="termsConditionsHeaderCollapse">
      <div class="accordion-body">
        <p><b>UNITÉ D'OUVRAGE GFF010: SEMELLE FILANTE DE FONDATION EN BÉTON ARMÉ.</b></p>
        <p><b>CLAUSES TECHNIQUES</b></p>
        <p>Semelle filante de fondation en béton armé, réalisée en excavation préalable.</p>
        <p><b>NORME APPLIQUÉE</b></p>
        <p>Élaboration, transport et mise en oeuvre du béton:</p>
        <table><tr><td>-</td><td></td><td><p>NF EN 206. Béton. Spécification, performance, production et conformité.</p></td></tr></table>
        <p><b>CRITÈRE POUR LE MÉTRÉ</b></p>
        <p>Volume moyen sur les sections théoriques de l'excavation.</p>
        <p><b>PROCESSUS D'EXÉCUTION</b></p>
        <div style="margin-left:+2em">
          <p><b>PHASES D'EXÉCUTION.</b></p>
          <p>Implantation et tracé. Coulage et compactage du béton. Séchage du béton.</p>
        </div>
        <p><b>CRITÈRE D'ÉVALUATION ÉCONOMIQUE</b></p>
        <p>Le prix comprend le ferraillage et la pose sur site.</p>
      </div>
    </div>
    <div id="wasteGeneratedHeaderCollapse">
      <table>
        <tr><td>Code CED</td><td>Type</td><td>Poids (kg)</td><td>Volume (l)</td></tr>
        <tr><td>17 01 01</td><td>Béton</td><td>12,500</td><td>8,000</td></tr>
      </table>
    </div>
  </body>
</html>
"""

EXTRAIT_BPU_DOCUMENT = """
LOT 01 GROS OEUVRE
1.1 Terrassement en déblais m3 12,00 45,50 546,00
1.2 Béton de propreté m3 4,00 138,25 553,00
1.3 Coffrage de rive ml 18,00 16,40 295,20
"""


class BibliothequePrixTests(TestCase):
    def test_parser_bordereau_artiprix_extrait_codes_designations_et_variantes(self):
        with patch("applications.bibliotheque.services._texte_pdf", return_value=EXTRAIT_BORDEREAU):
            lignes = parser_bordereau_artiprix(__import__("pathlib").Path("ARTIPRIX-AExt.pdf"))

        self.assertEqual(len(lignes), 2)
        self.assertEqual(lignes[0].code_interne, "PRI-AEXT-1.1.36")
        self.assertEqual(lignes[0].designation, "Muret en briques pleines")
        self.assertEqual(lignes[0].unite, "ML")
        self.assertEqual(lignes[0].temps_pose, Decimal("0.250"))
        self.assertEqual(lignes[0].prix_pose_41, Decimal("10.25"))
        self.assertEqual(lignes[0].prix_fourniture_pose_56, Decimal("14.00"))

    def test_import_bordereaux_alimente_la_bibliotheque(self):
        with patch(
            "applications.bibliotheque.services.lister_bordereaux_prix_references",
            return_value=[__import__("pathlib").Path("ARTIPRIX-AExt.pdf")],
        ), patch("applications.bibliotheque.services._texte_pdf", return_value=EXTRAIT_BORDEREAU):
            resultat = importer_bordereaux_prix_references()

        self.assertEqual(resultat["lignes"], 2)
        self.assertEqual(resultat["creees"], 2)

        ligne = LignePrixBibliotheque.objects.get(code="PRI-AEXT-1.1.36")
        self.assertEqual(ligne.prix_vente_unitaire, Decimal("10.25"))
        self.assertEqual(ligne.donnees_analytiques["variantes_prix"]["pose_seule_56"], "14.00")

    def test_import_bordereau_depuis_fichier_alimente_la_bibliotheque(self):
        with patch("applications.bibliotheque.services._texte_pdf", return_value=EXTRAIT_BORDEREAU):
            resultat = importer_bordereau_depuis_fichier(__import__("pathlib").Path("bordereau.pdf"))

        self.assertEqual(resultat["fichiers"], 1)
        self.assertEqual(resultat["lignes"], 2)
        self.assertEqual(LignePrixBibliotheque.objects.count(), 2)

    @patch("applications.bibliotheque.services._telecharger_contenu_html", return_value=EXTRAIT_PRIX_CONSTRUCTION)
    def test_analyse_fiche_prix_construction_extrait_justification_et_cctp(self, _telechargement):
        fiche = analyser_fiche_prix_construction(
            "https://prix-construction.info/construction_neuve/Structure_et_gros_oeuvre/Fondations/Semelles_filantes/GFF010_Semelle_filante_de_fondation_en_bet.html"
        )

        self.assertEqual(fiche.code_source, "GFF010")
        self.assertEqual(fiche.designation, "Semelle filante de fondation en béton armé")
        self.assertEqual(fiche.unite, "m³")
        self.assertEqual(fiche.prix_vente_unitaire, Decimal("450.45"))
        self.assertEqual(len(fiche.justification_prix), 4)
        self.assertEqual(fiche.justification_prix[2].type_ressource, "mo")
        self.assertEqual(
            fiche.normes_applicables[0],
            "NF EN 206. Béton. Spécification, performance, production et conformité.",
        )
        self.assertEqual(fiche.criteres_metre, "Volume moyen sur les sections théoriques de l'excavation.")
        self.assertIn("Implantation et tracé", fiche.phases_execution[0])
        self.assertEqual(fiche.dechets_generes[0]["code_ced"], "17 01 01")

    @patch("applications.bibliotheque.services._telecharger_contenu_html", return_value=EXTRAIT_PRIX_CONSTRUCTION)
    @patch(
        "applications.bibliotheque.services.lister_urls_fiches_prix_construction",
        return_value=[
            "https://prix-construction.info/construction_neuve/Structure_et_gros_oeuvre/Fondations/Semelles_filantes/GFF010_Semelle_filante_de_fondation_en_bet.html"
        ],
    )
    def test_import_prix_construction_alimente_bibliotheque_sous_details_et_articles(self, _urls, _telechargement):
        resultat = importer_referentiel_prix_construction(
            ["https://prix-construction.info/construction_neuve/Structure_et_gros_oeuvre/Fondations/Semelles_filantes.html"]
        )

        self.assertEqual(resultat["fiches"], 1)
        self.assertEqual(resultat["creees"], 1)
        self.assertEqual(resultat["articles_cctp"], 1)

        ligne = LignePrixBibliotheque.objects.get(origine_import="prix_construction")
        self.assertTrue(ligne.code.startswith("LBH-PRI-"))
        self.assertEqual(ligne.code_source_externe, "GFF010")
        self.assertEqual(ligne.cout_frais_divers, Decimal("8.8300"))
        self.assertEqual(ligne.debourse_sec_unitaire, Decimal("277.0300"))
        self.assertGreater(len(ligne.cahier_des_charges_structure), 0)

        sous_details = SousDetailPrix.objects.filter(ligne_prix=ligne).order_by("ordre")
        self.assertEqual(sous_details.count(), 4)
        self.assertEqual(sous_details[2].type_ressource, "mo")

        from applications.pieces_ecrites.models import ArticleCCTP

        article = ArticleCCTP.objects.get(ligne_prix_reference=ligne)
        self.assertTrue(article.code_reference.startswith("LBH-CCTP-"))
        self.assertIn("CLAUSES TECHNIQUES", article.corps_article)

    def test_generation_sous_details_depuis_composantes_cree_une_decomposition_minimale(self):
        ligne = LignePrixBibliotheque.objects.create(
            code="LBH-TEST-001",
            famille="Gros œuvre",
            designation_courte="Mur en agglos",
            designation_longue="Mur en agglos de 20 cm",
            unite="m²",
            temps_main_oeuvre=Decimal("1.2500"),
            cout_horaire_mo=Decimal("32.5000"),
            cout_matieres=Decimal("18.7500"),
            cout_materiel=Decimal("4.0000"),
            cout_transport=Decimal("1.5000"),
            cout_frais_divers=Decimal("0.7500"),
            debourse_sec_unitaire=Decimal("65.6250"),
            prix_vente_unitaire=Decimal("82.0000"),
        )

        nombre = generer_sous_details_depuis_composantes(ligne)

        self.assertEqual(nombre, 5)
        self.assertEqual(ligne.sous_details.count(), 5)
        self.assertEqual(ligne.sous_details.filter(type_ressource="mo").count(), 1)
        self.assertEqual(ligne.sous_details.filter(type_ressource="matiere").count(), 1)

    def test_import_document_economique_alimente_la_bibliotheque(self):
        organisation = Organisation.objects.create(
            code="ORG-DOC-BIB",
            nom="Organisation doc bib",
            type_organisation="bureau_etudes",
        )
        auteur = Utilisateur.objects.create_user(
            courriel="doc-bib@example.com",
            password="motdepasse123",
            prenom="Doc",
            nom="Bibliotheque",
            organisation=organisation,
        )
        projet = Projet.objects.create(
            reference="2026-0420",
            intitule="Chiffrage gros oeuvre",
            organisation=organisation,
            responsable=auteur,
            type_projet="mission_moe",
        )
        type_bpu = TypeDocument.objects.create(code="BPU", libelle="Bordereau des prix unitaires", ordre_affichage=10)
        document = Document.objects.create(
            reference="DOC-BPU-001",
            intitule="BPU lot gros oeuvre",
            type_document=type_bpu,
            projet=projet,
            auteur=auteur,
            contenu_texte=EXTRAIT_BPU_DOCUMENT,
            analyse_automatique_effectuee=True,
        )

        lignes = extraire_lignes_economiques_depuis_texte(EXTRAIT_BPU_DOCUMENT)
        self.assertEqual(len(lignes), 3)

        resultat = importer_document_economique_dans_bibliotheque(document, auteur=auteur)

        self.assertEqual(resultat["lignes"], 3)
        self.assertEqual(resultat["creees"], 3)
        ligne = LignePrixBibliotheque.objects.get(code_source_externe="1.1")
        self.assertEqual(ligne.statut_validation, "a_valider")
        self.assertEqual(ligne.prix_vente_unitaire, Decimal("45.50"))
        self.assertEqual(ligne.donnees_analytiques["source_document"]["reference"], "DOC-BPU-001")
        self.assertEqual(ligne.sous_details.count(), 1)


class ApiBibliothequeTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.organisation = Organisation.objects.create(
            code="ORG-BIB",
            nom="Organisation bibliothèque",
            type_organisation="bureau_etudes",
        )
        self.admin = Utilisateur.objects.create_user(
            courriel="admin-bibliotheque@example.com",
            password="motdepasse123",
            prenom="Admin",
            nom="Bibliothèque",
            organisation=self.organisation,
            est_staff=True,
            est_super_admin=True,
        )
        self.client.force_authenticate(self.admin)
        self.profil_mo = ProfilMainOeuvre.objects.create(
            code="ELEC_TEST_BIB",
            libelle="Compagnon électricien test",
            categorie="compagnon",
            secteur_activite="batiment",
            metier="Électricien",
            niveau_classification="CP2",
            salaire_brut_mensuel_defaut="2400.00",
            taux_charges_patronales="0.4040",
            cout_equipement_mensuel="90.00",
            cout_transport_mensuel="75.00",
        )

    def test_recalcul_global_genere_les_sous_details_absents(self):
        ligne = LignePrixBibliotheque.objects.create(
            code="LBH-BATCH-001",
            famille="VRD",
            designation_courte="Décapage",
            designation_longue="Décapage sur 20 cm",
            unite="m²",
            temps_main_oeuvre=Decimal("0.2500"),
            cout_horaire_mo=Decimal("28.0000"),
            cout_materiel=Decimal("6.0000"),
            debourse_sec_unitaire=Decimal("13.0000"),
            prix_vente_unitaire=Decimal("16.5000"),
            statut_validation="valide",
        )

        reponse = self.client.post("/api/bibliotheque/recalculer-tous/", {}, format="json")

        self.assertEqual(reponse.status_code, status.HTTP_200_OK, reponse.data)
        ligne.refresh_from_db()
        self.assertEqual(reponse.data["lignes_regenerees"], 1)
        self.assertEqual(ligne.sous_details.count(), 2)
        self.assertEqual(ligne.debourse_sec_unitaire, Decimal("13.0000"))

    def test_super_admin_peut_vider_entierement_la_bibliotheque(self):
        LignePrixBibliotheque.objects.create(
            code="LBH-DEL-001",
            famille="Second œuvre",
            designation_courte="Peinture",
            designation_longue="Peinture murs",
            unite="m²",
        )
        LignePrixBibliotheque.objects.create(
            code="LBH-DEL-002",
            famille="Second œuvre",
            designation_courte="Revêtement",
            designation_longue="Revêtement sol",
            unite="m²",
        )

        reponse = self.client.delete("/api/bibliotheque/vider/")

        self.assertEqual(reponse.status_code, status.HTTP_200_OK, reponse.data)
        self.assertEqual(reponse.data["lignes_supprimees"], 2)
        self.assertEqual(LignePrixBibliotheque.objects.count(), 0)

    def test_creation_sous_detail_mo_avec_profil_calcule_quantite_et_taux(self):
        ligne = LignePrixBibliotheque.objects.create(
            code="LBH-MO-001",
            famille="Électricité",
            designation_courte="Cheminement CFO",
            designation_longue="Cheminement CFO en apparent",
            unite="ml",
        )

        reponse = self.client.post(
            f"/api/bibliotheque/{ligne.id}/sous-details/",
            {
                "ligne_prix": str(ligne.id),
                "type_ressource": "mo",
                "profil_main_oeuvre": str(self.profil_mo.id),
                "designation": "Pose par compagnon électricien",
                "nombre_ressources": "2",
                "temps_unitaire": "0.75",
            },
            format="json",
        )

        self.assertEqual(reponse.status_code, status.HTTP_201_CREATED, reponse.data)
        sous_detail = SousDetailPrix.objects.get(pk=reponse.data["id"])
        self.assertEqual(str(sous_detail.quantite), "1.500000")
        self.assertGreater(sous_detail.taux_horaire, 0)
        self.assertEqual(sous_detail.cout_unitaire_ht, sous_detail.taux_horaire)
