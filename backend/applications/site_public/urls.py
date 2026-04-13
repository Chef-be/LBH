"""Routes URL pour le site vitrine public — Plateforme LBH."""

from django.urls import path
from . import views

urlpatterns = [
    # Données agrégées page d'accueil (accès public)
    path("accueil/", views.vue_accueil, name="site-public-accueil"),

    # Configuration (GET public, PATCH super-admin)
    path("configuration/", views.vue_configuration, name="site-configuration"),
    path("configuration/rgpd/", views.vue_configuration_rgpd, name="site-configuration-rgpd"),
    path("configuration/televersement-media/", views.vue_televerser_media_site, name="site-configuration-televersement-media"),

    # Médias publics — logo, favicon (proxy vers le stockage objet)
    path("logo/", views.vue_logo, name="site-logo"),
    path("logo-pied-de-page/", views.vue_logo_pied_de_page, name="site-logo-pied-de-page"),
    path("favicon/", views.vue_favicon, name="site-favicon"),

    # Statistiques (GET public)
    path("statistiques/", views.VueListeStatistiques.as_view(), name="statistiques-liste"),
    path("statistiques/<uuid:pk>/", views.VueDetailStatistique.as_view(), name="statistique-detail"),

    # Valeurs / avantages (GET public)
    path("valeurs/", views.VueListeValeurs.as_view(), name="valeurs-liste"),
    path("valeurs/<uuid:pk>/", views.VueDetailValeur.as_view(), name="valeur-detail"),

    # Démarche (GET public)
    path("demarche/", views.VueListeDemarche.as_view(), name="demarche-liste"),
    path("demarche/<uuid:pk>/", views.VueDetailEtapeDemarche.as_view(), name="demarche-detail"),

    # Pages statiques (GET public)
    path("pages/", views.VueListePagesStatiques.as_view(), name="pages-statiques-liste"),

    # Pages statiques (admin authentifié)
    path("pages/admin/", views.VueAdminPagesStatiques.as_view(), name="pages-statiques-admin-liste"),
    path("pages/admin/<uuid:pk>/", views.VueAdminDetailPageStatique.as_view(), name="pages-statiques-admin-detail"),
    path("pages/<slug:code>/", views.vue_page_statique, name="page-statique-detail"),

    # Prestations (GET public)
    path("prestations/", views.VueListePrestations.as_view(), name="prestations-liste"),
    path("prestations/slug/<slug:slug>/", views.vue_prestation_par_slug, name="prestation-par-slug"),
    path("prestations/<uuid:pk>/", views.VueDetailPrestation.as_view(), name="prestation-detail"),

    # Réalisations (GET public)
    path("realisations/", views.VueListeRealisations.as_view(), name="realisations-liste"),
    path("realisations/<uuid:pk>/", views.VueDetailRealisation.as_view(), name="realisation-detail"),

    # Équipe (GET public)
    path("equipe/", views.VueListeEquipe.as_view(), name="equipe-liste"),
    path("equipe/<uuid:pk>/", views.VueDetailMembreEquipe.as_view(), name="membre-detail"),

    # Actualités (GET public)
    path("actualites/", views.VueListeActualites.as_view(), name="actualites-liste"),
    path("actualites/<slug:slug>/", views.vue_actualite_par_slug, name="actualite-detail"),

    # Contact
    path("contact/", views.vue_soumettre_contact, name="contact-soumettre"),
    path("contact/demandes/", views.VueListeDemandesContact.as_view(), name="contact-demandes"),
    path("contact/demandes/<uuid:pk>/traiter/", views.vue_marquer_contact_traite, name="contact-traiter"),
]
