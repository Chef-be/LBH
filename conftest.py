"""
Fixtures globales pytest pour la Plateforme LBH.
Disponibles dans tous les sous-répertoires de tests.
"""

import sys
import os

# Rend le répertoire backend accessible (pour les imports Django)
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "calculs"))

import pytest
from decimal import Decimal


# ---------------------------------------------------------------------------
# Fixtures calculs (sans Django)
# ---------------------------------------------------------------------------

@pytest.fixture
def params_calcul_defaut():
    """Paramètres économiques par défaut pour les tests de calcul."""
    from calculs.economie.moteur_rentabilite import ParametresCalcul
    return ParametresCalcul(
        taux_frais_chantier=Decimal("0.08"),
        taux_frais_generaux=Decimal("0.10"),
        taux_aleas=Decimal("0.03"),
        taux_marge_cible=Decimal("0.10"),
        taux_pertes=Decimal("0.05"),
    )
