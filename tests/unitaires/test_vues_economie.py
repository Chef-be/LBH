"""
Tests des vues API économie — Plateforme LBH.
Couvre : création d'étude, liste, lignes de prix, déclenchement du calcul.
"""

import pytest
from decimal import Decimal


pytestmark = pytest.mark.django_db


# ---------------------------------------------------------------------------
# Fixture étude économique
# ---------------------------------------------------------------------------

@pytest.fixture
def etude(db, projet, utilisateur):
    """Étude économique de base pour les tests."""
    from applications.economie.models import EtudeEconomique
    return EtudeEconomique.objects.create(
        projet=projet,
        intitule="Étude de test",
        statut="brouillon",
        cree_par=utilisateur,
    )


# ---------------------------------------------------------------------------
# Liste et création d'études
# ---------------------------------------------------------------------------

class TestListeEtudes:
    url = "/api/economie/"

    def test_anonyme_rejete(self):
        """Accès sans authentification → 401."""
        from rest_framework.test import APIClient
        resp = APIClient().get(self.url)
        assert resp.status_code == 401

    def test_liste_vide(self, client_authentifie):
        """Aucune étude → liste vide."""
        resp = client_authentifie.get(self.url)
        assert resp.status_code == 200
        assert resp.data["count"] == 0

    def test_liste_avec_etude(self, client_authentifie, etude):
        """L'étude créée est retournée."""
        resp = client_authentifie.get(self.url)
        assert resp.status_code == 200
        assert resp.data["count"] == 1
        assert resp.data["results"][0]["intitule"] == "Étude de test"

    def test_filtre_par_projet(self, client_authentifie, etude, projet):
        """Filtrer par projet_id retourne seulement les études de ce projet."""
        resp = client_authentifie.get(f"{self.url}?projet={projet.id}")
        assert resp.status_code == 200
        assert resp.data["count"] == 1

    def test_filtre_projet_inexistant(self, client_authentifie, etude):
        """Filtrer sur un projet inconnu retourne 0 résultats."""
        import uuid
        resp = client_authentifie.get(f"{self.url}?projet={uuid.uuid4()}")
        assert resp.status_code == 200
        assert resp.data["count"] == 0


class TestCreationEtude:
    url = "/api/economie/"

    def test_creation_valide(self, client_authentifie, projet):
        """Créer une étude avec les champs requis."""
        payload = {
            "projet": str(projet.id),
            "intitule": "Nouvelle étude",
            "statut": "brouillon",
        }
        resp = client_authentifie.post(self.url, payload, format="json")
        assert resp.status_code == 201
        assert resp.data["intitule"] == "Nouvelle étude"

    def test_intitule_obligatoire(self, client_authentifie, projet):
        """L'intitulé est requis."""
        payload = {"projet": str(projet.id)}
        resp = client_authentifie.post(self.url, payload, format="json")
        assert resp.status_code == 400

    def test_projet_obligatoire(self, client_authentifie):
        """Le projet est requis."""
        payload = {"intitule": "Sans projet"}
        resp = client_authentifie.post(self.url, payload, format="json")
        assert resp.status_code == 400


# ---------------------------------------------------------------------------
# Détail d'une étude
# ---------------------------------------------------------------------------

class TestDetailEtude:
    def test_detail_accessible(self, client_authentifie, etude):
        """Le détail inclut les lignes et les totaux."""
        resp = client_authentifie.get(f"/api/economie/{etude.id}/")
        assert resp.status_code == 200
        assert "lignes" in resp.data
        assert "total_prix_vente" in resp.data

    def test_etude_inexistante(self, client_authentifie):
        """Une étude inexistante retourne 404."""
        import uuid
        resp = client_authentifie.get(f"/api/economie/{uuid.uuid4()}/")
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Lignes de prix
# ---------------------------------------------------------------------------

class TestLignesPrix:
    def test_liste_lignes_vide(self, client_authentifie, etude):
        """Aucune ligne → liste vide."""
        resp = client_authentifie.get(f"/api/economie/{etude.id}/lignes/")
        assert resp.status_code == 200

    def test_creer_ligne(self, client_authentifie, etude):
        """Créer une ligne de prix dans une étude."""
        payload = {
            "etude": str(etude.id),
            "numero_ordre": 1,
            "designation": "Terrassements généraux",
            "unite": "m³",
            "quantite_prevue": "100.00",
            "cout_matieres": "5.00",
            "cout_horaire_mo": "35.00",
            "temps_main_oeuvre": "0.50",
        }
        resp = client_authentifie.post(
            f"/api/economie/{etude.id}/lignes/",
            payload,
            format="json",
        )
        assert resp.status_code == 201
        assert resp.data["designation"] == "Terrassements généraux"

    def test_designation_obligatoire(self, client_authentifie, etude):
        """La désignation est requise pour créer une ligne."""
        payload = {
            "etude": str(etude.id),
            "numero_ordre": 1,
            "unite": "m²",
            "quantite_prevue": "10.00",
        }
        resp = client_authentifie.post(f"/api/economie/{etude.id}/lignes/", payload, format="json")
        assert resp.status_code == 400


# ---------------------------------------------------------------------------
# Calcul de l'étude
# ---------------------------------------------------------------------------

class TestCalculEtude:
    def test_calculer_etude_vide(self, client_authentifie, etude):
        """Calculer une étude sans ligne ne plante pas."""
        resp = client_authentifie.post(f"/api/economie/{etude.id}/recalculer/", {}, format="json")
        # Le calcul doit réussir même sans ligne (totaux à 0)
        assert resp.status_code == 200

    def test_calculer_etude_avec_ligne(self, client_authentifie, etude):
        """Calculer une étude avec une ligne met à jour les totaux."""
        from applications.economie.models import LignePrix
        LignePrix.objects.create(
            etude=etude,
            numero_ordre=1,
            designation="Test",
            unite="u",
            quantite_prevue=Decimal("10"),
            cout_matieres=Decimal("50"),
            temps_main_oeuvre=Decimal("1"),
            cout_horaire_mo=Decimal("35"),
        )

        resp = client_authentifie.post(f"/api/economie/{etude.id}/recalculer/", {}, format="json")
        assert resp.status_code == 200

        etude.refresh_from_db()
        assert etude.total_debourse_sec > 0
        assert etude.total_prix_vente > 0
