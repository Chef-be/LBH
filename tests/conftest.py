"""
Fixtures pytest pour les tests Django de la Plateforme BEE.
Fournit des objets de base : utilisateur authentifié, organisation, projet.
"""

import pytest
from decimal import Decimal
from django.test import TestCase


# ---------------------------------------------------------------------------
# Fixtures Django — nécessitent @pytest.mark.django_db
# ---------------------------------------------------------------------------

@pytest.fixture
def organisation(db):
    """Organisation de base (bureau d'études) pour les tests."""
    from applications.organisations.models import Organisation
    return Organisation.objects.create(
        code="TEST-ORG",
        nom="Bureau d'études de test",
        type_organisation="bureau_etudes",
    )


@pytest.fixture
def utilisateur(db, organisation):
    """Utilisateur authentifié basique pour les tests."""
    from applications.comptes.models import Utilisateur
    u = Utilisateur.objects.create_user(
        courriel="test@example.com",
        password="MotDePasseTest!123",
        prenom="Test",
        nom="Utilisateur",
        organisation=organisation,
    )
    return u


@pytest.fixture
def client_authentifie(utilisateur):
    """Client HTTP DRF authentifié via force_authenticate."""
    from rest_framework.test import APIClient
    client = APIClient()
    client.force_authenticate(user=utilisateur)
    return client


@pytest.fixture
def projet(db, organisation, utilisateur):
    """Projet de base pour les tests."""
    from applications.projets.models import Projet
    return Projet.objects.create(
        reference="TEST-2026-001",
        intitule="Projet de test automatisé",
        type_projet="etude",
        statut="en_cours",
        organisation=organisation,
        responsable=utilisateur,
    )
