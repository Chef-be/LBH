"""
Tests du moteur de dimensionnement voirie — Plateforme LBH.
Couvre : classification plateforme, trafic cumulé, choix structure, dimensionnement.
"""

import pytest
from decimal import Decimal
from calculs.voirie.moteur_chaussee import (
    ClasseDeformation,
    ClasseTrafficPoids,
    TypeStructure,
    ParametresCalculVoirie,
    DonneesEntreeVoirie,
    ResultatDimensionnement,
    cbr_vers_classe_plateforme,
    calculer_trafic_cumule,
    tmja_pl_vers_classe_trafic,
    dimensionner_chaussee,
)


# ---------------------------------------------------------------------------
# Classification plateforme CBR → PF
# ---------------------------------------------------------------------------

class TestClassificationPlateforme:
    def test_cbr_tres_faible_pf1(self):
        """CBR ≤ 5 → PF1."""
        assert cbr_vers_classe_plateforme(Decimal("3")) == ClasseDeformation.PF1
        assert cbr_vers_classe_plateforme(Decimal("5")) == ClasseDeformation.PF1

    def test_cbr_normal_pf2(self):
        """5 < CBR ≤ 10 → PF2."""
        assert cbr_vers_classe_plateforme(Decimal("6")) == ClasseDeformation.PF2
        assert cbr_vers_classe_plateforme(Decimal("10")) == ClasseDeformation.PF2

    def test_cbr_bon_pf3(self):
        """10 < CBR ≤ 25 → PF3."""
        assert cbr_vers_classe_plateforme(Decimal("15")) == ClasseDeformation.PF3
        assert cbr_vers_classe_plateforme(Decimal("25")) == ClasseDeformation.PF3

    def test_cbr_tres_bon_pf4(self):
        """CBR > 25 → PF4."""
        assert cbr_vers_classe_plateforme(Decimal("30")) == ClasseDeformation.PF4
        assert cbr_vers_classe_plateforme(Decimal("100")) == ClasseDeformation.PF4


# ---------------------------------------------------------------------------
# Classification trafic PL → classe T
# ---------------------------------------------------------------------------

class TestClassificationTrafic:
    def test_faible_t5(self):
        """< 25 PL/j → T5."""
        assert tmja_pl_vers_classe_trafic(10) == ClasseTrafficPoids.T5
        assert tmja_pl_vers_classe_trafic(24) == ClasseTrafficPoids.T5

    def test_t4(self):
        """25–85 PL/j → T4."""
        assert tmja_pl_vers_classe_trafic(25) == ClasseTrafficPoids.T4
        assert tmja_pl_vers_classe_trafic(85) == ClasseTrafficPoids.T4

    def test_t2(self):
        """150–300 PL/j → T2."""
        assert tmja_pl_vers_classe_trafic(200) == ClasseTrafficPoids.T2

    def test_te2_tres_fort(self):
        """Au-delà de 5 000 PL/j → TE2."""
        assert tmja_pl_vers_classe_trafic(10000) == ClasseTrafficPoids.TE2


# ---------------------------------------------------------------------------
# Trafic cumulé
# ---------------------------------------------------------------------------

class TestTraficCumule:
    def _params_defaut(self):
        return ParametresCalculVoirie()

    def test_sans_croissance(self):
        """Taux de croissance 0% → TC proportionnel à TMJA × durée."""
        tc = calculer_trafic_cumule(
            tmja_pl=100,
            duree_vie_ans=20,
            taux_croissance=Decimal("0"),
            cam=Decimal("0.8"),
            coeff_distribution=Decimal("0.5"),
        )
        assert tc > 0

    def test_avec_croissance_superieur(self):
        """Avec croissance positive, TC > TC sans croissance."""
        tc_sans = calculer_trafic_cumule(100, 20, Decimal("0"), Decimal("0.8"), Decimal("0.5"))
        tc_avec = calculer_trafic_cumule(100, 20, Decimal("0.02"), Decimal("0.8"), Decimal("0.5"))
        assert tc_avec > tc_sans

    def test_duree_longue_donne_tc_plus_grand(self):
        """Une durée plus longue produit un TC plus grand."""
        tc_court = calculer_trafic_cumule(100, 10, Decimal("0.02"), Decimal("0.8"), Decimal("0.5"))
        tc_long = calculer_trafic_cumule(100, 30, Decimal("0.02"), Decimal("0.8"), Decimal("0.5"))
        assert tc_long > tc_court


# ---------------------------------------------------------------------------
# Dimensionnement complet
# ---------------------------------------------------------------------------

class TestDimensionnement:
    def _entree(self, cbr=10, tmja_pl=100) -> DonneesEntreeVoirie:
        return DonneesEntreeVoirie(
            tmja_pl=tmja_pl,
            tmja_vl=1000,
            cbr=Decimal(str(cbr)),
            zone_climatique="temperee",
            proximite_eau=False,
        )

    def test_retourne_resultat(self):
        """Le dimensionnement retourne un ResultatDimensionnement."""
        entree = self._entree()
        res = dimensionner_chaussee(entree)
        assert isinstance(res, ResultatDimensionnement)

    def test_epaisseur_positive(self):
        """L'épaisseur totale calculée est positive."""
        entree = self._entree()
        res = dimensionner_chaussee(entree)
        assert res.epaisseur_totale_cm > 0

    def test_couches_non_vides(self):
        """La structure comporte au moins une couche."""
        entree = self._entree()
        res = dimensionner_chaussee(entree)
        assert len(res.couches) > 0

    def test_trafic_fort_donne_structure_plus_epaisse(self):
        """Un trafic PL fort produit une structure plus épaisse."""
        res_faible = dimensionner_chaussee(self._entree(tmja_pl=20))
        res_fort = dimensionner_chaussee(self._entree(tmja_pl=2000))
        assert res_fort.epaisseur_totale_cm >= res_faible.epaisseur_totale_cm

    def test_cbr_faible_donne_structure_plus_epaisse(self):
        """Un CBR faible (sol médiocre) produit une structure plus épaisse."""
        res_bon = dimensionner_chaussee(self._entree(cbr=30))
        res_mauvais = dimensionner_chaussee(self._entree(cbr=3))
        assert res_mauvais.epaisseur_totale_cm >= res_bon.epaisseur_totale_cm

    def test_parametres_surcharges(self):
        """On peut surcharger les paramètres par défaut."""
        params = ParametresCalculVoirie()
        params.duree_vie_ans = 30
        res = dimensionner_chaussee(self._entree(), params)
        assert isinstance(res, ResultatDimensionnement)
