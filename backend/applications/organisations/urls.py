from django.urls import path
from .views import VueListeOrganisations, VueDetailOrganisation, VueGroupesOrganisation, vue_recherche_entreprises_publiques

urlpatterns = [
    path("", VueListeOrganisations.as_view(), name="organisations-liste"),
    path("recherche-entreprises/", vue_recherche_entreprises_publiques, name="organisations-recherche-entreprises"),
    path("<uuid:pk>/", VueDetailOrganisation.as_view(), name="organisations-detail"),
    path("<uuid:org_id>/groupes/", VueGroupesOrganisation.as_view(), name="organisations-groupes"),
]
