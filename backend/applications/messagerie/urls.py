"""Routes API de la messagerie."""

from django.urls import path

from . import views


urlpatterns = [
    path("serveurs/", views.VueListeServeursMessagerie.as_view(), name="messagerie-serveurs-liste"),
    path("serveurs/<uuid:pk>/", views.VueDetailServeurMessagerie.as_view(), name="messagerie-serveur-detail"),
    path("journal/", views.VueListeJournalCourriels.as_view(), name="messagerie-journal"),
    path("roundcube/configuration/", views.vue_configuration_roundcube, name="roundcube-configuration"),
    path("roundcube/logo/", views.vue_logo_roundcube, name="roundcube-logo"),
    path("roundcube/watermark/", views.vue_watermark_roundcube, name="roundcube-watermark"),
]
