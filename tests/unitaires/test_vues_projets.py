"""
Tests des vues API des projets — Plateforme LBH.
Couvre : liste, création, détail, modification, archivage, lots, intervenants.
"""

import pytest
from django.urls import reverse


pytestmark = pytest.mark.django_db


# ---------------------------------------------------------------------------
# Liste des projets
# ---------------------------------------------------------------------------

class TestListeProjets:
    url = "/api/projets/"

    def test_anonyme_rejete(self, client):
        """Un appel sans authentification doit retourner 401."""
        from rest_framework.test import APIClient
        resp = APIClient().get(self.url)
        assert resp.status_code == 401

    def test_liste_vide(self, client_authentifie):
        """Liste vide si aucun projet pour l'organisation."""
        resp = client_authentifie.get(self.url)
        assert resp.status_code == 200
        assert resp.data["count"] == 0

    def test_liste_avec_projet(self, client_authentifie, projet):
        """Le projet créé apparaît dans la liste."""
        resp = client_authentifie.get(self.url)
        assert resp.status_code == 200
        assert resp.data["count"] == 1
        assert resp.data["results"][0]["reference"] == "TEST-2026-001"

    def test_filtre_par_statut(self, client_authentifie, projet):
        """Filtrer par statut ne retourne que les projets correspondants."""
        resp_en_cours = client_authentifie.get(self.url + "?statut=en_cours")
        assert resp_en_cours.data["count"] == 1

        resp_termine = client_authentifie.get(self.url + "?statut=termine")
        assert resp_termine.data["count"] == 0

    def test_recherche_par_reference(self, client_authentifie, projet):
        """La recherche par référence fonctionne."""
        resp = client_authentifie.get(self.url + "?search=TEST-2026")
        assert resp.data["count"] == 1

        resp_inconnu = client_authentifie.get(self.url + "?search=INCONNU-9999")
        assert resp_inconnu.data["count"] == 0


# ---------------------------------------------------------------------------
# Création de projet
# ---------------------------------------------------------------------------

class TestCreationProjet:
    url = "/api/projets/"

    def test_creation_valide(self, client_authentifie, organisation):
        """Créer un projet avec les champs requis."""
        payload = {
            "reference": "NEW-2026-001",
            "intitule": "Nouveau projet de test",
            "type_projet": "travaux",
            "statut": "en_cours",
        }
        resp = client_authentifie.post(self.url, payload, format="json")
        assert resp.status_code == 201
        assert resp.data["reference"] == "NEW-2026-001"

    def test_reference_dupliquee_rejetee(self, client_authentifie, projet):
        """Deux projets ne peuvent pas avoir la même référence."""
        payload = {
            "reference": "TEST-2026-001",  # déjà utilisée
            "intitule": "Doublon",
            "type_projet": "etude",
            "statut": "en_cours",
        }
        resp = client_authentifie.post(self.url, payload, format="json")
        assert resp.status_code == 400

    def test_reference_manquante_rejetee(self, client_authentifie):
        """La référence est obligatoire."""
        payload = {
            "intitule": "Sans référence",
            "type_projet": "etude",
            "statut": "en_cours",
        }
        resp = client_authentifie.post(self.url, payload, format="json")
        assert resp.status_code == 400


# ---------------------------------------------------------------------------
# Détail d'un projet
# ---------------------------------------------------------------------------

class TestDetailProjet:
    def test_detail_accessible(self, client_authentifie, projet):
        """Le détail d'un projet existant est retourné."""
        resp = client_authentifie.get(f"/api/projets/{projet.id}/")
        assert resp.status_code == 200
        assert resp.data["reference"] == "TEST-2026-001"
        assert "statut_libelle" in resp.data
        assert "type_libelle" in resp.data

    def test_libelles_presents(self, client_authentifie, projet):
        """Les libellés calculés (statut, type, phase) sont inclus."""
        resp = client_authentifie.get(f"/api/projets/{projet.id}/")
        assert resp.status_code == 200
        assert resp.data["statut_libelle"] == "En cours"
        assert resp.data["type_libelle"] == "Étude"

    def test_projet_inexistant(self, client_authentifie):
        """Un projet inexistant retourne 404."""
        import uuid
        resp = client_authentifie.get(f"/api/projets/{uuid.uuid4()}/")
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Modification d'un projet
# ---------------------------------------------------------------------------

class TestModificationProjet:
    def test_patch_intitule(self, client_authentifie, projet):
        """Modifier l'intitulé via PATCH."""
        resp = client_authentifie.patch(
            f"/api/projets/{projet.id}/",
            {"intitule": "Intitulé modifié"},
            format="json",
        )
        assert resp.status_code == 200
        assert resp.data["intitule"] == "Intitulé modifié"

    def test_patch_statut(self, client_authentifie, projet):
        """Modifier le statut via PATCH."""
        resp = client_authentifie.patch(
            f"/api/projets/{projet.id}/",
            {"statut": "termine"},
            format="json",
        )
        assert resp.status_code == 200
        assert resp.data["statut"] == "termine"


# ---------------------------------------------------------------------------
# Suppression (archivage) d'un projet
# ---------------------------------------------------------------------------

class TestArchivageProjet:
    def test_delete_archive_le_projet(self, client_authentifie, projet):
        """DELETE archive le projet au lieu de le supprimer physiquement."""
        resp = client_authentifie.delete(f"/api/projets/{projet.id}/")
        # Le projet est archivé, pas supprimé → 200 ou 204
        assert resp.status_code in (200, 204)

        # Vérification en base
        from applications.projets.models import Projet
        projet.refresh_from_db()
        assert projet.statut == "archive"


# ---------------------------------------------------------------------------
# Lots
# ---------------------------------------------------------------------------

class TestLots:
    def test_creer_lot(self, client_authentifie, projet):
        """Ajouter un lot à un projet."""
        payload = {
            "projet": str(projet.id),
            "numero": 1,
            "intitule": "Gros œuvre",
        }
        resp = client_authentifie.post(f"/api/projets/{projet.id}/lots/", payload, format="json")
        assert resp.status_code == 201
        assert resp.data["intitule"] == "Gros œuvre"

    def test_liste_lots(self, client_authentifie, projet):
        """La liste des lots est retournée dans le détail du projet."""
        from applications.projets.models import Lot
        Lot.objects.create(projet=projet, numero=1, intitule="VRD")

        resp = client_authentifie.get(f"/api/projets/{projet.id}/")
        assert resp.status_code == 200
        assert len(resp.data["lots"]) == 1
        assert resp.data["lots"][0]["intitule"] == "VRD"
