"""Routes URL pour la rentabilité — Plateforme BEE."""

from django.urls import path
from . import views

urlpatterns = [
    path("projet/<uuid:projet_id>/", views.vue_analyse_rentabilite_projet, name="rentabilite-projet"),
    path("simulation/<uuid:etude_id>/", views.vue_simulation_marge, name="rentabilite-simulation"),
]
