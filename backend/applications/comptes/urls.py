"""Routes URL de l'application comptes."""

from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    VueActiverInvitation,
    VueConfirmerReinitialisationMotDePasse,
    VueConnexion,
    VueDemandeReinitialisationMotDePasse,
    VueDeconnexion,
    VueDetailJetonReinitialisation,
    VueDetailUtilisateur,
    VueInvitationDetail,
    VueListeProfilsDroits,
    VueRenvoyerInvitationUtilisateur,
    VueListeUtilisateurs,
    VueMoiMeme,
    VueModificationMotDePasse,
)

urlpatterns = [
    # Authentification
    path("connexion/", VueConnexion.as_view(), name="auth-connexion"),
    path("deconnexion/", VueDeconnexion.as_view(), name="auth-deconnexion"),
    path("rafraichir/", TokenRefreshView.as_view(), name="auth-rafraichir-jeton"),

    # Profil utilisateur connecté
    path("moi/", VueMoiMeme.as_view(), name="auth-moi"),
    path("modifier-mot-de-passe/", VueModificationMotDePasse.as_view(), name="auth-modifier-mdp"),
    path("mot-de-passe-oublie/", VueDemandeReinitialisationMotDePasse.as_view(), name="auth-mdp-oublie"),
    path("reinitialisation/<str:token>/", VueDetailJetonReinitialisation.as_view(), name="auth-reinitialisation-detail"),
    path("reinitialisation/<str:token>/confirmer/", VueConfirmerReinitialisationMotDePasse.as_view(), name="auth-reinitialisation-confirmer"),
    path("invitations/<str:token>/", VueInvitationDetail.as_view(), name="auth-invitation-detail"),
    path("invitations/<str:token>/activer/", VueActiverInvitation.as_view(), name="auth-invitation-activer"),

    # Profils de droits
    path("profils/", VueListeProfilsDroits.as_view(), name="profils-liste"),

    # Gestion des utilisateurs (admin)
    path("utilisateurs/", VueListeUtilisateurs.as_view(), name="utilisateurs-liste"),
    path("utilisateurs/<uuid:pk>/", VueDetailUtilisateur.as_view(), name="utilisateurs-detail"),
    path("utilisateurs/<uuid:pk>/renvoyer-invitation/", VueRenvoyerInvitationUtilisateur.as_view(), name="utilisateurs-renvoyer-invitation"),
]
