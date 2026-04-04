from django.urls import path
from .views import VueListeOrganisations, VueDetailOrganisation, VueGroupesOrganisation

urlpatterns = [
    path("", VueListeOrganisations.as_view(), name="organisations-liste"),
    path("<uuid:pk>/", VueDetailOrganisation.as_view(), name="organisations-detail"),
    path("<uuid:org_id>/groupes/", VueGroupesOrganisation.as_view(), name="organisations-groupes"),
]
