"""Sérialiseurs pour l'application comptes."""

from django.contrib.auth import authenticate
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

from .models import (
    InvitationUtilisateur,
    JetonReinitialisationMotDePasse,
    JournalConnexion,
    ProfilDroit,
    Utilisateur,
)


class ProfilDroitSerialiseur(serializers.ModelSerializer):
    class Meta:
        model = ProfilDroit
        fields = ["id", "code", "libelle", "description"]


class UtilisateurSerialiseur(serializers.ModelSerializer):
    """Sérialiseur public de l'utilisateur (sans données sensibles)."""

    nom_complet = serializers.CharField(read_only=True)
    profil_libelle = serializers.CharField(source="profil.libelle", read_only=True)
    organisation_nom = serializers.CharField(source="organisation.nom", read_only=True)
    invitation_en_attente = serializers.BooleanField(read_only=True)

    class Meta:
        model = Utilisateur
        fields = [
            "id", "courriel", "prenom", "nom", "nom_complet",
            "telephone", "fonction", "avatar",
            "organisation", "organisation_nom",
            "profil", "profil_libelle",
            "est_actif", "est_super_admin",
            "langue", "fuseau_horaire", "notifications_courriel",
            "date_creation", "derniere_connexion_ip",
            "courriel_verifie_le", "invitation_envoyee_le", "invitation_en_attente",
        ]
        read_only_fields = ["id", "date_creation", "est_super_admin"]


class UtilisateurCreationSerialiseur(serializers.ModelSerializer):
    """Création d'un compte avec invitation différée."""

    class Meta:
        model = Utilisateur
        fields = [
            "courriel", "prenom", "nom",
            "telephone", "fonction",
            "organisation", "profil",
        ]

    def validate(self, donnees):
        courriel = donnees.get("courriel", "").lower()
        if Utilisateur.objects.filter(courriel__iexact=courriel).exists():
            raise serializers.ValidationError(
                {"courriel": "Un utilisateur avec cette adresse de courriel existe déjà."}
            )
        donnees["courriel"] = courriel
        return donnees

    def create(self, donnees_validees):
        utilisateur = Utilisateur.objects.create_user(
            password=None,
            est_actif=False,
            **donnees_validees,
        )
        utilisateur.set_unusable_password()
        utilisateur.save(update_fields=["password"])
        return utilisateur


class ProfilPersonnelSerialiseur(serializers.ModelSerializer):
    """Mise à jour du profil personnel de l'utilisateur connecté."""

    nom_complet = serializers.CharField(read_only=True)
    profil_libelle = serializers.CharField(source="profil.libelle", read_only=True)
    organisation_nom = serializers.CharField(source="organisation.nom", read_only=True)

    class Meta:
        model = Utilisateur
        fields = [
            "id",
            "courriel",
            "prenom",
            "nom",
            "nom_complet",
            "telephone",
            "fonction",
            "langue",
            "fuseau_horaire",
            "notifications_courriel",
            "organisation_nom",
            "profil_libelle",
            "courriel_verifie_le",
        ]
        read_only_fields = [
            "id",
            "courriel",
            "prenom",
            "nom",
            "nom_complet",
            "fonction",
            "organisation_nom",
            "profil_libelle",
            "courriel_verifie_le",
        ]


class ConnexionSerialiseur(serializers.Serializer):
    """Sérialiseur pour la connexion (obtention d'un jeton JWT)."""

    courriel = serializers.EmailField()
    mot_de_passe = serializers.CharField(write_only=True)

    def validate(self, donnees):
        courriel = donnees.get("courriel", "").lower()
        mot_de_passe = donnees.get("mot_de_passe")

        utilisateur = authenticate(
            request=self.context.get("request"),
            username=courriel,
            password=mot_de_passe,
        )

        if not utilisateur:
            raise serializers.ValidationError(
                "Identifiants incorrects. Vérifiez votre adresse de courriel et votre mot de passe."
            )

        if utilisateur.est_verrouille:
            raise serializers.ValidationError(
                f"Ce compte est temporairement verrouillé jusqu'au "
                f"{utilisateur.verrouille_jusqu_au.strftime('%d/%m/%Y à %H:%M')}."
            )

        if not utilisateur.est_actif:
            if utilisateur.invitation_en_attente:
                raise serializers.ValidationError(
                    "Ce compte n'est pas encore activé. Utilisez le lien d'invitation reçu par courriel."
                )
            raise serializers.ValidationError("Ce compte est désactivé.")

        donnees["utilisateur"] = utilisateur
        return donnees

    def obtenir_jetons(self) -> dict:
        utilisateur = self.validated_data["utilisateur"]
        jeton = RefreshToken.for_user(utilisateur)
        return {
            "acces": str(jeton.access_token),
            "rafraichissement": str(jeton),
        }


class ModificationMotDePasseSerialiseur(serializers.Serializer):
    """Modification du mot de passe par l'utilisateur connecté."""

    ancien_mot_de_passe = serializers.CharField(write_only=True)
    nouveau_mot_de_passe = serializers.CharField(write_only=True, min_length=12)
    confirmation = serializers.CharField(write_only=True)

    def validate(self, donnees):
        utilisateur = self.context["request"].user
        if not utilisateur.check_password(donnees["ancien_mot_de_passe"]):
            raise serializers.ValidationError(
                {"ancien_mot_de_passe": "L'ancien mot de passe est incorrect."}
            )
        if donnees["nouveau_mot_de_passe"] != donnees["confirmation"]:
            raise serializers.ValidationError(
                {"confirmation": "Les nouveaux mots de passe ne correspondent pas."}
            )
        return donnees


class InvitationDetailSerialiseur(serializers.ModelSerializer):
    nom_complet = serializers.CharField(source="utilisateur.nom_complet", read_only=True)
    profil_libelle = serializers.CharField(source="utilisateur.profil.libelle", read_only=True)

    class Meta:
        model = InvitationUtilisateur
        fields = [
            "courriel",
            "expire_le",
            "nom_complet",
            "profil_libelle",
        ]


class ActivationInvitationSerialiseur(serializers.Serializer):
    prenom = serializers.CharField(required=False, max_length=100)
    nom = serializers.CharField(required=False, max_length=100)
    telephone = serializers.CharField(required=False, allow_blank=True, max_length=20)
    fonction = serializers.CharField(required=False, allow_blank=True, max_length=200)
    mot_de_passe = serializers.CharField(write_only=True, min_length=12)
    mot_de_passe_confirmation = serializers.CharField(write_only=True)

    def validate(self, donnees):
        if donnees["mot_de_passe"] != donnees["mot_de_passe_confirmation"]:
            raise serializers.ValidationError(
                {"mot_de_passe_confirmation": "Les mots de passe ne correspondent pas."}
            )
        return donnees


class DemandeReinitialisationMotDePasseSerialiseur(serializers.Serializer):
    courriel = serializers.EmailField()


class DetailJetonReinitialisationSerialiseur(serializers.ModelSerializer):
    nom_complet = serializers.CharField(source="utilisateur.nom_complet", read_only=True)

    class Meta:
        model = JetonReinitialisationMotDePasse
        fields = ["courriel", "expire_le", "nom_complet"]


class ConfirmationReinitialisationMotDePasseSerialiseur(serializers.Serializer):
    mot_de_passe = serializers.CharField(write_only=True, min_length=12)
    mot_de_passe_confirmation = serializers.CharField(write_only=True)

    def validate(self, donnees):
        if donnees["mot_de_passe"] != donnees["mot_de_passe_confirmation"]:
            raise serializers.ValidationError(
                {"mot_de_passe_confirmation": "Les mots de passe ne correspondent pas."}
            )
        return donnees
