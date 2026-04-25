"""Vues API pour l'authentification, le profil et l'activation des comptes."""

from datetime import timedelta

from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from applications.messagerie.services import MessagerieErreur, envoyer_courriel, obtenir_configuration_smtp
from applications.messagerie.utils import obtenir_nom_plateforme

from .models import (
    InvitationUtilisateur,
    JetonReinitialisationMotDePasse,
    JournalConnexion,
    ProfilDroit,
    Utilisateur,
)
from .serialiseurs import (
    ActivationInvitationSerialiseur,
    ConfirmationReinitialisationMotDePasseSerialiseur,
    ConnexionSerialiseur,
    DemandeReinitialisationMotDePasseSerialiseur,
    DetailJetonReinitialisationSerialiseur,
    InvitationDetailSerialiseur,
    ModificationMotDePasseSerialiseur,
    ProfilDroitSerialiseur,
    ProfilPersonnelSerialiseur,
    UtilisateurCreationSerialiseur,
    UtilisateurSerialiseur,
)


DUREE_VALIDITE_INVITATION = timedelta(days=7)
DUREE_VALIDITE_REINITIALISATION = timedelta(hours=4)


def _obtenir_ip(requete) -> str:
    entete_forwarded = requete.META.get("HTTP_X_FORWARDED_FOR")
    if entete_forwarded:
        return entete_forwarded.split(",")[0].strip()
    return requete.META.get("REMOTE_ADDR", "")


def _construire_url_frontend(requete, chemin: str) -> str:
    chemin_normalise = "/" + chemin.lstrip("/")
    return requete.build_absolute_uri(chemin_normalise)


def _peut_administrer_utilisateurs(utilisateur: Utilisateur) -> bool:
    return utilisateur.est_super_admin or utilisateur.a_droit("comptes.modifier_utilisateur")


def _serialiser_session(utilisateur: Utilisateur) -> dict:
    jeton = RefreshToken.for_user(utilisateur)
    return {
        "jetons": {
            "acces": str(jeton.access_token),
            "rafraichissement": str(jeton),
        },
        "utilisateur": UtilisateurSerialiseur(utilisateur).data,
    }


def _creer_invitation(utilisateur: Utilisateur, emetteur: Utilisateur, requete) -> InvitationUtilisateur:
    now = timezone.now()
    InvitationUtilisateur.objects.filter(
        utilisateur=utilisateur,
        utilise_le__isnull=True,
        expire_le__gt=now,
    ).update(expire_le=now)

    invitation = InvitationUtilisateur.objects.create(
        utilisateur=utilisateur,
        courriel=utilisateur.courriel,
        token=InvitationUtilisateur.generer_token(),
        cree_par=emetteur,
        expire_le=now + DUREE_VALIDITE_INVITATION,
    )

    nom_plateforme = obtenir_nom_plateforme()
    lien_activation = _construire_url_frontend(requete, f"/activer-compte/{invitation.token}")
    configuration = obtenir_configuration_smtp(usage="plateforme")
    resultat = envoyer_courriel(
        sujet=f"Invitation à rejoindre {nom_plateforme}",
        destinataires=[utilisateur.courriel],
        corps_texte=(
            f"Bonjour {utilisateur.prenom or utilisateur.courriel},\n\n"
            f"Un compte vous a été préparé sur {nom_plateforme}.\n"
            "Pour activer votre accès, valider votre adresse de courriel et définir votre mot de passe, "
            f"ouvrez ce lien :\n{lien_activation}\n\n"
            f"Ce lien restera valide jusqu'au {invitation.expire_le.strftime('%d/%m/%Y à %H:%M')}.\n\n"
            f"Cordialement,\n{nom_plateforme}"
        ),
        configuration=configuration,
        utilisateur=emetteur,
        origine="invitation",
        contexte_journal={
            "utilisateur_id": str(utilisateur.id),
            "invitation_id": str(invitation.id),
            "profil": utilisateur.profil.libelle if utilisateur.profil else "",
        },
    )
    invitation.message_id = resultat["message_id"]
    invitation.save(update_fields=["message_id"])
    utilisateur.invitation_envoyee_le = now
    utilisateur.save(update_fields=["invitation_envoyee_le"])
    return invitation


def _creer_jeton_reinitialisation(utilisateur: Utilisateur, requete) -> JetonReinitialisationMotDePasse:
    now = timezone.now()
    JetonReinitialisationMotDePasse.objects.filter(
        utilisateur=utilisateur,
        utilise_le__isnull=True,
        expire_le__gt=now,
    ).update(expire_le=now)

    jeton = JetonReinitialisationMotDePasse.objects.create(
        utilisateur=utilisateur,
        courriel=utilisateur.courriel,
        token=JetonReinitialisationMotDePasse.generer_token(),
        expire_le=now + DUREE_VALIDITE_REINITIALISATION,
    )

    nom_plateforme = obtenir_nom_plateforme()
    lien = _construire_url_frontend(requete, f"/reinitialiser-mot-de-passe/{jeton.token}")
    configuration = obtenir_configuration_smtp(usage="plateforme")
    resultat = envoyer_courriel(
        sujet=f"Réinitialisation de votre mot de passe {nom_plateforme}",
        destinataires=[utilisateur.courriel],
        corps_texte=(
            f"Bonjour {utilisateur.prenom or utilisateur.courriel},\n\n"
            f"Une demande de réinitialisation de mot de passe a été reçue pour votre compte {nom_plateforme}.\n"
            f"Pour définir un nouveau mot de passe, ouvrez ce lien :\n{lien}\n\n"
            f"Ce lien restera valide jusqu'au {jeton.expire_le.strftime('%d/%m/%Y à %H:%M')}.\n"
            "Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer ce message.\n\n"
            f"Cordialement,\n{nom_plateforme}"
        ),
        configuration=configuration,
        utilisateur=utilisateur,
        origine="reinitialisation",
        contexte_journal={"utilisateur_id": str(utilisateur.id), "jeton_id": str(jeton.id)},
    )
    jeton.message_id = resultat["message_id"]
    jeton.save(update_fields=["message_id"])
    return jeton


def _obtenir_invitation_valide(token: str) -> InvitationUtilisateur:
    invitation = get_object_or_404(
        InvitationUtilisateur.objects.select_related("utilisateur", "utilisateur__profil"),
        token=token,
    )
    if not invitation.est_valide:
        raise PermissionError("Ce lien d'invitation est expiré ou a déjà été utilisé.")
    return invitation


def _obtenir_jeton_reinitialisation_valide(token: str) -> JetonReinitialisationMotDePasse:
    jeton = get_object_or_404(
        JetonReinitialisationMotDePasse.objects.select_related("utilisateur"),
        token=token,
    )
    if not jeton.est_valide:
        raise PermissionError("Ce lien de réinitialisation est expiré ou a déjà été utilisé.")
    return jeton


class VueConnexion(generics.GenericAPIView):
    """Authentifie l'utilisateur et retourne une paire de jetons JWT."""

    serializer_class = ConnexionSerialiseur
    permission_classes = [permissions.AllowAny]

    def post(self, requete):
        serialiseur = self.get_serializer(data=requete.data, context={"request": requete})
        if not serialiseur.is_valid():
            JournalConnexion.objects.create(
                courriel_saisi=requete.data.get("courriel", ""),
                succes=False,
                adresse_ip=_obtenir_ip(requete),
                agent_navigateur=requete.META.get("HTTP_USER_AGENT", ""),
                motif_echec=str(serialiseur.errors),
            )
            return Response(serialiseur.errors, status=status.HTTP_401_UNAUTHORIZED)

        utilisateur = serialiseur.validated_data["utilisateur"]
        utilisateur.tentatives_connexion = 0
        utilisateur.verrouille_jusqu_au = None
        utilisateur.derniere_connexion_ip = _obtenir_ip(requete)
        utilisateur.save(update_fields=["tentatives_connexion", "verrouille_jusqu_au", "derniere_connexion_ip"])

        JournalConnexion.objects.create(
            utilisateur=utilisateur,
            courriel_saisi=utilisateur.courriel,
            succes=True,
            adresse_ip=_obtenir_ip(requete),
            agent_navigateur=requete.META.get("HTTP_USER_AGENT", ""),
        )
        return Response(_serialiser_session(utilisateur))


class VueDeconnexion(generics.GenericAPIView):
    """Révoque le jeton de rafraîchissement."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, requete):
        jeton_rafraichissement = requete.data.get("rafraichissement")
        if jeton_rafraichissement:
            try:
                RefreshToken(jeton_rafraichissement).blacklist()
            except Exception:
                pass
        return Response({"detail": "Déconnexion effectuée."}, status=status.HTTP_200_OK)


class VueMoiMeme(generics.RetrieveUpdateAPIView):
    """Lecture et modification du profil personnel."""

    serializer_class = ProfilPersonnelSerialiseur
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user


class VueModificationMotDePasse(generics.GenericAPIView):
    """Modification du mot de passe par l'utilisateur connecté."""

    serializer_class = ModificationMotDePasseSerialiseur
    permission_classes = [permissions.IsAuthenticated]

    def post(self, requete):
        serialiseur = self.get_serializer(data=requete.data, context={"request": requete})
        serialiseur.is_valid(raise_exception=True)
        requete.user.set_password(serialiseur.validated_data["nouveau_mot_de_passe"])
        requete.user.save(update_fields=["password"])
        return Response({"detail": "Mot de passe modifié avec succès."})


class VueEnvoyerVerificationCourriel(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, requete):
        utilisateur = requete.user
        if utilisateur.courriel_verifie_le:
            return Response({"detail": "Adresse de courriel déjà vérifiée."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            invitation = _creer_invitation(utilisateur, utilisateur, requete)
        except MessagerieErreur as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(
            {
                "detail": "Lien de vérification envoyé.",
                "invitation": {"id": str(invitation.id), "expire_le": invitation.expire_le},
            }
        )


class VueListeUtilisateurs(generics.ListCreateAPIView):
    """Liste les utilisateurs et crée de nouveaux comptes sur invitation."""

    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        return UtilisateurCreationSerialiseur if self.request.method == "POST" else UtilisateurSerialiseur

    def get_queryset(self):
        utilisateur = self.request.user
        if not _peut_administrer_utilisateurs(utilisateur) and not utilisateur.a_droit("comptes.lister_utilisateurs"):
            return Utilisateur.objects.none()
        queryset = Utilisateur.objects.select_related("profil", "organisation")
        if not utilisateur.est_super_admin and utilisateur.organisation:
            queryset = queryset.filter(organisation=utilisateur.organisation)
        return queryset

    def create(self, requete, *args, **kwargs):
        if not requete.user.est_super_admin:
            return Response(
                {"detail": "Seul le super-administrateur peut envoyer une invitation utilisateur."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serialiseur = self.get_serializer(data=requete.data)
        serialiseur.is_valid(raise_exception=True)
        try:
            with transaction.atomic():
                utilisateur = serialiseur.save()
                invitation = _creer_invitation(utilisateur, requete.user, requete)
        except MessagerieErreur as exc:
            return Response(
                {"detail": f"L'utilisateur n'a pas été créé car l'envoi de l'invitation a échoué : {exc}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        donnees = UtilisateurSerialiseur(utilisateur).data
        return Response(
            {
                "detail": "Utilisateur créé et invitation envoyée.",
                "utilisateur": donnees,
                "invitation": {
                    "id": str(invitation.id),
                    "expire_le": invitation.expire_le,
                },
            },
            status=status.HTTP_201_CREATED,
        )


class VueRenvoyerInvitationUtilisateur(generics.GenericAPIView):
    """Réémet une invitation pour un utilisateur non activé."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, requete, pk):
        if not requete.user.est_super_admin:
            return Response({"detail": "Accès réservé au super-administrateur."}, status=status.HTTP_403_FORBIDDEN)

        utilisateur = get_object_or_404(Utilisateur.objects.select_related("profil"), pk=pk)
        if utilisateur.courriel_verifie_le and utilisateur.est_actif:
            return Response(
                {"detail": "Ce compte est déjà activé. Aucune invitation n'est nécessaire."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            invitation = _creer_invitation(utilisateur, requete.user, requete)
        except MessagerieErreur as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(
            {
                "detail": "Invitation renvoyée.",
                "invitation": {"id": str(invitation.id), "expire_le": invitation.expire_le},
            }
        )


class VueEnvoyerReinitialisationUtilisateur(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, requete, pk):
        if not requete.user.est_super_admin:
            return Response({"detail": "Accès réservé au super-administrateur."}, status=status.HTTP_403_FORBIDDEN)

        utilisateur = get_object_or_404(Utilisateur.objects.select_related("profil"), pk=pk)
        if not utilisateur.est_actif:
            return Response(
                {"detail": "Le compte doit être actif pour envoyer une réinitialisation de mot de passe."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            jeton = _creer_jeton_reinitialisation(utilisateur, requete)
        except MessagerieErreur as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(
            {
                "detail": "Lien de réinitialisation envoyé.",
                "jeton": {"id": str(jeton.id), "expire_le": jeton.expire_le},
            }
        )


class VueListeProfilsDroits(generics.ListAPIView):
    """Liste des profils de droits disponibles."""

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ProfilDroitSerialiseur
    queryset = ProfilDroit.objects.filter(est_actif=True).order_by("ordre_affichage")


class VueDetailUtilisateur(generics.RetrieveUpdateDestroyAPIView):
    """Consultation, modification et désactivation d'un compte."""

    serializer_class = UtilisateurSerialiseur
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        if not _peut_administrer_utilisateurs(self.request.user):
            return Utilisateur.objects.none()
        return Utilisateur.objects.select_related("profil", "organisation")

    def destroy(self, requete, *args, **kwargs):
        objet = self.get_object()
        objet.est_actif = False
        objet.save(update_fields=["est_actif"])
        return Response({"detail": "Compte désactivé."}, status=status.HTTP_200_OK)


class VueInvitationDetail(generics.GenericAPIView):
    """Retourne le contexte public d'une invitation avant activation."""

    permission_classes = [permissions.AllowAny]

    def get(self, requete, token):
        try:
            invitation = _obtenir_invitation_valide(token)
        except PermissionError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(
            {
                **InvitationDetailSerialiseur(invitation).data,
                "nom_plateforme": obtenir_nom_plateforme(),
            }
        )


class VueActiverInvitation(generics.GenericAPIView):
    """Valide l'adresse de courriel et active le compte invité."""

    permission_classes = [permissions.AllowAny]
    serializer_class = ActivationInvitationSerialiseur

    def post(self, requete, token):
        try:
            invitation = _obtenir_invitation_valide(token)
        except PermissionError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        serialiseur = self.get_serializer(data=requete.data)
        serialiseur.is_valid(raise_exception=True)

        utilisateur = invitation.utilisateur
        utilisateur.prenom = serialiseur.validated_data.get("prenom", utilisateur.prenom)
        utilisateur.nom = serialiseur.validated_data.get("nom", utilisateur.nom)
        utilisateur.telephone = serialiseur.validated_data.get("telephone", utilisateur.telephone)
        utilisateur.fonction = serialiseur.validated_data.get("fonction", utilisateur.fonction)
        utilisateur.set_password(serialiseur.validated_data["mot_de_passe"])
        utilisateur.est_actif = True
        utilisateur.courriel_verifie_le = timezone.now()
        utilisateur.save(
            update_fields=[
                "prenom",
                "nom",
                "telephone",
                "fonction",
                "password",
                "est_actif",
                "courriel_verifie_le",
            ]
        )

        invitation.utilise_le = timezone.now()
        invitation.save(update_fields=["utilise_le"])
        return Response(_serialiser_session(utilisateur), status=status.HTTP_200_OK)


class VueDemandeReinitialisationMotDePasse(generics.GenericAPIView):
    """Crée un jeton de réinitialisation et envoie le lien par courriel."""

    permission_classes = [permissions.AllowAny]
    serializer_class = DemandeReinitialisationMotDePasseSerialiseur

    def post(self, requete):
        serialiseur = self.get_serializer(data=requete.data)
        serialiseur.is_valid(raise_exception=True)
        utilisateur = Utilisateur.objects.filter(
            courriel__iexact=serialiseur.validated_data["courriel"],
            est_actif=True,
        ).first()
        if utilisateur:
            try:
                _creer_jeton_reinitialisation(utilisateur, requete)
            except MessagerieErreur:
                return Response(
                    {"detail": "La demande a été enregistrée mais le courriel n'a pas pu être envoyé."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        return Response(
            {"detail": "Si un compte correspond à cette adresse, un lien de réinitialisation a été envoyé."}
        )


class VueDetailJetonReinitialisation(generics.GenericAPIView):
    """Retourne le contexte public d'un jeton de réinitialisation."""

    permission_classes = [permissions.AllowAny]

    def get(self, requete, token):
        try:
            jeton = _obtenir_jeton_reinitialisation_valide(token)
        except PermissionError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(
            {
                **DetailJetonReinitialisationSerialiseur(jeton).data,
                "nom_plateforme": obtenir_nom_plateforme(),
            }
        )


class VueConfirmerReinitialisationMotDePasse(generics.GenericAPIView):
    """Définit un nouveau mot de passe à partir d'un jeton temporaire."""

    permission_classes = [permissions.AllowAny]
    serializer_class = ConfirmationReinitialisationMotDePasseSerialiseur

    def post(self, requete, token):
        try:
            jeton = _obtenir_jeton_reinitialisation_valide(token)
        except PermissionError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        serialiseur = self.get_serializer(data=requete.data)
        serialiseur.is_valid(raise_exception=True)

        utilisateur = jeton.utilisateur
        utilisateur.set_password(serialiseur.validated_data["mot_de_passe"])
        utilisateur.save(update_fields=["password"])
        jeton.utilise_le = timezone.now()
        jeton.save(update_fields=["utilise_le"])
        return Response({"detail": "Votre mot de passe a bien été réinitialisé."})
