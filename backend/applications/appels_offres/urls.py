"""Routes URL pour les appels d'offres — Plateforme LBH."""

from django.urls import path
from . import views

urlpatterns = [
    path("", views.VueListeAppelsOffres.as_view(), name="appels-offres-liste"),
    path("<uuid:pk>/", views.VueDetailAppelOffres.as_view(), name="appel-offres-detail"),
    path("<uuid:ao_id>/offres/", views.VueListeOffres.as_view(), name="offres-liste"),
    path("<uuid:ao_id>/offres/<uuid:pk>/", views.VueDetailOffre.as_view(), name="offre-detail"),
    path("<uuid:ao_id>/offres/<uuid:offre_id>/attribuer/", views.vue_attribuer_marche, name="offre-attribuer"),
    path("<uuid:ao_id>/analyser/", views.vue_analyser_offres, name="appel-offres-analyser"),
]
