"""Routes URL pour la supervision — Plateforme LBH."""

from django.urls import path
from . import views

urlpatterns = [
    path("", views.vue_tableau_bord_supervision, name="supervision-tableau-bord"),
    path("evenements/", views.VueListeEvenements.as_view(), name="supervision-evenements"),
    path("metriques/", views.VueListeMetriques.as_view(), name="supervision-metriques"),
    path("alertes/", views.VueListeAlertes.as_view(), name="supervision-alertes"),
    path("alertes/<uuid:pk>/acquitter/", views.vue_acquitter_alerte, name="supervision-acquitter"),
    path("serveurs-mail/", views.VueListeServeursMail.as_view(), name="supervision-serveurs-mail"),
    path("serveurs-mail/<uuid:pk>/", views.VueDetailServeurMail.as_view(), name="supervision-serveur-mail-detail"),
    path("serveurs-mail/<uuid:pk>/tester/", views.vue_tester_serveur_mail, name="supervision-serveur-mail-tester"),
]
