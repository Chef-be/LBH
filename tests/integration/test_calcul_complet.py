"""
Tests d'intégration — Plateforme LBH.
Vérifie la chaîne complète : création projet → étude → lignes → calcul → totaux cohérents.
"""

import pytest
from decimal import Decimal


pytestmark = pytest.mark.django_db


class TestChaineCréationCalcul:
    """Parcours complet : création via API → calcul → vérification des totaux."""

    def test_parcours_complet(self, client_authentifie, projet):
        """
        1. Créer une étude économique
        2. Ajouter deux lignes de prix
        3. Déclencher le calcul
        4. Vérifier la cohérence des totaux
        """
        # 1. Créer l'étude
        resp = client_authentifie.post("/api/economie/", {
            "projet": str(projet.id),
            "intitule": "Étude intégration",
        }, format="json")
        assert resp.status_code == 201
        etude_id = resp.data["id"]

        # 2. Ajouter deux lignes
        lignes = [
            {
                "etude": etude_id,
                "numero_ordre": 1,
                "designation": "Terrassements",
                "unite": "m³",
                "quantite_prevue": "200.00",
                "cout_matieres": "0",
                "temps_main_oeuvre": "0.50",
                "cout_horaire_mo": "35.00",
            },
            {
                "etude": etude_id,
                "numero_ordre": 2,
                "designation": "Béton fondations",
                "unite": "m³",
                "quantite_prevue": "50.00",
                "cout_matieres": "120.00",
                "temps_main_oeuvre": "2.00",
                "cout_horaire_mo": "38.00",
            },
        ]
        for ligne in lignes:
            resp = client_authentifie.post(f"/api/economie/{etude_id}/lignes/", ligne, format="json")
            assert resp.status_code == 201

        # 3. Calculer
        resp_calc = client_authentifie.post(f"/api/economie/{etude_id}/recalculer/", {}, format="json")
        assert resp_calc.status_code == 200

        # 4. Vérifier les totaux via le détail de l'étude
        resp_detail = client_authentifie.get(f"/api/economie/{etude_id}/")
        assert resp_detail.status_code == 200

        data = resp_detail.data
        assert float(data["total_debourse_sec"]) > 0
        assert float(data["total_cout_direct"]) > float(data["total_debourse_sec"])
        assert float(data["total_cout_revient"]) > float(data["total_cout_direct"])
        assert float(data["total_prix_vente"]) > float(data["total_cout_revient"])
        assert float(data["total_marge_nette"]) > 0

        # Vérifier que les lignes ont été calculées
        for ligne in data["lignes"]:
            assert ligne["etat_rentabilite"] != "indefini"
            assert float(ligne["prix_vente_unitaire"]) > 0


class TestVariantesEtude:
    """Création d'une variante depuis une étude existante."""

    def test_creer_variante(self, client_authentifie, projet):
        """Une variante est créée à partir d'une étude parente."""
        # Créer l'étude parente
        resp = client_authentifie.post("/api/economie/", {
            "projet": str(projet.id),
            "intitule": "Étude principale",
        }, format="json")
        assert resp.status_code == 201
        etude_id = resp.data["id"]

        # Dupliquer en variante
        resp_variante = client_authentifie.post(
            f"/api/economie/{etude_id}/dupliquer/",
            {"est_variante": True},
            format="json",
        )
        assert resp_variante.status_code == 201
        assert resp_variante.data["est_variante"] is True
        assert str(resp_variante.data["etude_parente"]) == etude_id
