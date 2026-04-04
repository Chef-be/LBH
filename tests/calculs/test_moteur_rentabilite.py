"""
Tests du moteur de rentabilité — Plateforme LBH.
Couvre : déboursé sec, coûts, prix de vente, marges, états de rentabilité, seuils.
"""

import pytest
from decimal import Decimal
from calculs.economie.moteur_rentabilite import (
    ParametresCalcul,
    ComposantesDebourse,
    ResultatLigne,
    EtatRentabilite,
    calculer_ligne,
    calculer_debourse_sec_unitaire,
    calculer_cout_direct_unitaire,
    calculer_cout_revient_unitaire,
    calculer_prix_vente_unitaire,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def params_standard():
    """Paramètres économiques standards pour les tests."""
    return ParametresCalcul(
        taux_frais_chantier=Decimal("0.08"),
        taux_frais_generaux=Decimal("0.10"),
        taux_aleas=Decimal("0.03"),
        taux_marge_cible=Decimal("0.10"),
        taux_pertes=Decimal("0.05"),
    )


@pytest.fixture
def composantes_simples():
    """Composantes simples : 1 h de MO à 35 €/h + 20 € de matières."""
    return ComposantesDebourse(
        temps_main_oeuvre=Decimal("1.0"),
        cout_horaire_mo=Decimal("35.0"),
        cout_matieres=Decimal("20.0"),
        cout_materiel=Decimal("0"),
        cout_sous_traitance=Decimal("0"),
        cout_transport=Decimal("0"),
    )


@pytest.fixture
def composantes_sous_traitance():
    """Ligne entièrement sous-traitée."""
    return ComposantesDebourse(
        temps_main_oeuvre=Decimal("0"),
        cout_horaire_mo=Decimal("0"),
        cout_matieres=Decimal("0"),
        cout_materiel=Decimal("0"),
        cout_sous_traitance=Decimal("100.0"),
        cout_transport=Decimal("5.0"),
    )


# ---------------------------------------------------------------------------
# Tests déboursé sec
# ---------------------------------------------------------------------------

class TestDebourse:
    def test_debourse_mo_matieres(self, composantes_simples):
        """DSu = MO + matières = 1×35 + 20 = 55."""
        dsu = calculer_debourse_sec_unitaire(composantes_simples)
        assert dsu == Decimal("55.0000")

    def test_debourse_sous_traitance(self, composantes_sous_traitance):
        """DSu = ST + transport = 100 + 5 = 105."""
        dsu = calculer_debourse_sec_unitaire(composantes_sous_traitance)
        assert dsu == Decimal("105.0000")

    def test_debourse_zero(self):
        """Déboursé nul si toutes composantes à 0."""
        c = ComposantesDebourse()
        dsu = calculer_debourse_sec_unitaire(c)
        assert dsu == Decimal("0")

    def test_debourse_composantes_multiples(self):
        """Somme correcte de toutes les composantes."""
        c = ComposantesDebourse(
            temps_main_oeuvre=Decimal("2"),
            cout_horaire_mo=Decimal("30"),
            cout_matieres=Decimal("50"),
            cout_materiel=Decimal("10"),
            cout_sous_traitance=Decimal("20"),
            cout_transport=Decimal("5"),
        )
        dsu = calculer_debourse_sec_unitaire(c)
        assert dsu == Decimal("145.0000")  # 60 + 50 + 10 + 20 + 5


# ---------------------------------------------------------------------------
# Tests coûts
# ---------------------------------------------------------------------------

class TestCouts:
    def test_cout_direct(self):
        """CDu = DSu × (1 + τpertes) × (1 + τFC)."""
        dsu = Decimal("100")
        cdu = calculer_cout_direct_unitaire(dsu, Decimal("0.05"), Decimal("0.08"))
        attendu = Decimal("100") * Decimal("1.05") * Decimal("1.08")
        assert abs(cdu - attendu) < Decimal("0.01")

    def test_cout_revient(self):
        """CRu = CDu × (1 + τFG) × (1 + τaléas)."""
        cdu = Decimal("100")
        cru = calculer_cout_revient_unitaire(cdu, Decimal("0.10"), Decimal("0.03"))
        attendu = Decimal("100") * Decimal("1.10") * Decimal("1.03")
        assert abs(cru - attendu) < Decimal("0.01")

    def test_prix_vente(self):
        """PVu = CRu / (1 - τmarge)."""
        cru = Decimal("100")
        pvu = calculer_prix_vente_unitaire(cru, Decimal("0.20"))
        assert abs(pvu - Decimal("125")) < Decimal("0.01")

    def test_prix_vente_marge_nulle(self):
        """Taux de marge 0% → PVu = CRu."""
        cru = Decimal("100")
        pvu = calculer_prix_vente_unitaire(cru, Decimal("0"))
        assert pvu == cru

    def test_prix_vente_marge_invalide(self):
        """Taux ≥ 100% doit lever ValueError."""
        with pytest.raises(ValueError):
            calculer_prix_vente_unitaire(Decimal("100"), Decimal("1.0"))


# ---------------------------------------------------------------------------
# Tests calculer_ligne (intégration moteur complet)
# ---------------------------------------------------------------------------

class TestCalculerLigne:
    def test_ligne_standard(self, composantes_simples, params_standard):
        """Calcul complet d'une ligne simple."""
        res = calculer_ligne(composantes_simples, Decimal("10"), params_standard)

        assert isinstance(res, ResultatLigne)
        assert res.quantite_prevue == Decimal("10")
        assert res.debourse_sec_unitaire == Decimal("55.0000")
        assert res.cout_direct_unitaire > res.debourse_sec_unitaire
        assert res.cout_revient_unitaire > res.cout_direct_unitaire
        assert res.prix_vente_unitaire > res.cout_revient_unitaire
        assert res.marge_nette_unitaire > Decimal("0")
        assert res.taux_marge_nette > Decimal("0")

    def test_marge_nette_totale(self, composantes_simples, params_standard):
        """Marge nette totale = marge nette unitaire × quantité."""
        q = Decimal("10")
        res = calculer_ligne(composantes_simples, q, params_standard)
        attendu = (res.marge_nette_unitaire * q).quantize(Decimal("0.01"))
        assert res.marge_nette_totale == attendu

    def test_etat_rentable(self, composantes_simples, params_standard):
        """Avec marge cible 10% et taux standards, la ligne doit être rentable."""
        res = calculer_ligne(composantes_simples, Decimal("10"), params_standard)
        assert res.etat_rentabilite == EtatRentabilite.RENTABLE

    def test_etat_non_rentable_prix_force_trop_bas(self, composantes_simples, params_standard):
        """Si le prix est forcé en dessous du coût de revient → non rentable."""
        res = calculer_ligne(
            composantes_simples,
            Decimal("10"),
            params_standard,
            prix_vente_unitaire_force=Decimal("50"),  # bien en dessous du CR
        )
        assert res.etat_rentabilite in (
            EtatRentabilite.NON_RENTABLE,
            EtatRentabilite.DEFICITAIRE_ORIGINE,
        )

    def test_quantite_zero_leve_erreur(self, composantes_simples, params_standard):
        """Quantité ≤ 0 doit lever ValueError."""
        with pytest.raises(ValueError):
            calculer_ligne(composantes_simples, Decimal("0"), params_standard)

    def test_quantite_negative_leve_erreur(self, composantes_simples, params_standard):
        with pytest.raises(ValueError):
            calculer_ligne(composantes_simples, Decimal("-1"), params_standard)

    def test_surcharge_taux_marge(self, composantes_simples, params_standard):
        """La surcharge de taux de marge doit remplacer le paramètre système."""
        res_normal = calculer_ligne(composantes_simples, Decimal("10"), params_standard)
        res_surcharge = calculer_ligne(
            composantes_simples, Decimal("10"), params_standard,
            taux_marge_surcharge=Decimal("0.20"),
        )
        assert res_surcharge.prix_vente_unitaire > res_normal.prix_vente_unitaire
        assert res_surcharge.taux_marge_nette > res_normal.taux_marge_nette

    def test_prix_vente_force_calcul_a_rebours(self, composantes_simples, params_standard):
        """Avec prix forcé, la marge est calculée à rebours."""
        prix_force = Decimal("100")
        res = calculer_ligne(
            composantes_simples, Decimal("10"), params_standard,
            prix_vente_unitaire_force=prix_force,
        )
        assert res.prix_vente_unitaire == prix_force
        assert res.marge_nette_unitaire == prix_force - res.cout_revient_unitaire

    def test_consistance_totaux(self, composantes_simples, params_standard):
        """PV total = PV unitaire × quantité (cohérence)."""
        q = Decimal("5")
        res = calculer_ligne(composantes_simples, q, params_standard)
        pv_total_calc = res.prix_vente_unitaire * q
        # Comparer avec tolérance d'arrondi
        assert abs(pv_total_calc - (res.marge_nette_totale + res.cout_revient_unitaire * q)) < Decimal("0.01")


# ---------------------------------------------------------------------------
# Tests états de rentabilité
# ---------------------------------------------------------------------------

class TestEtatsRentabilite:
    def test_rentable_taux_eleve(self, params_standard):
        """Ligne avec taux de marge élevé → RENTABLE."""
        c = ComposantesDebourse(
            temps_main_oeuvre=Decimal("0"),
            cout_horaire_mo=Decimal("0"),
            cout_matieres=Decimal("10"),
            cout_materiel=Decimal("0"),
            cout_sous_traitance=Decimal("0"),
            cout_transport=Decimal("0"),
        )
        res = calculer_ligne(c, Decimal("100"), params_standard)
        assert res.etat_rentabilite == EtatRentabilite.RENTABLE

    def test_causes_renseignees_si_non_rentable(self, params_standard):
        """Les causes de non-rentabilité doivent être renseignées."""
        c = ComposantesDebourse(
            temps_main_oeuvre=Decimal("2"),
            cout_horaire_mo=Decimal("50"),
            cout_matieres=Decimal("0"),
            cout_materiel=Decimal("0"),
            cout_sous_traitance=Decimal("0"),
            cout_transport=Decimal("0"),
        )
        res = calculer_ligne(
            c, Decimal("1"), params_standard,
            prix_vente_unitaire_force=Decimal("60"),
        )
        if res.etat_rentabilite not in (EtatRentabilite.RENTABLE, EtatRentabilite.INDEFINI):
            assert len(res.causes_non_rentabilite) > 0
